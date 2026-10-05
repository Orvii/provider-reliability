/**
 * Reference runner: arms, retries, incident windows, event log.
 *
 * Status: REFERENCE, UNVERIFIED against live providers by design (see
 * adapter.ts header). Implements the protocol decisions from the notes:
 *   - two arms per probe: "no-retry" and "production-shaped" (retry-storms.md)
 *   - fixed concurrency: the harness must not become a load test
 *   - incident windows: a cluster of overload signatures marks the window,
 *     and rows inside it are flagged for separate reporting
 *   - the event log is the deliverable (harness-design.md)
 */
import { appendFileSync } from "node:fs";
import { attempt, type AdapterConfig, type EventRow, type Probe } from "./adapter.ts";

const OVERLOAD_CLASSES = new Set(["provider-overload", "provider-fault"]);
const INCIDENT_WINDOW_MS = 60_000;
const INCIDENT_THRESHOLD = 3; // overload-class rows inside one window

export interface RunConfig {
  adapters: AdapterConfig[];
  probes: Probe[];
  concurrency: number; // fixed, small; e.g. 2
  productionRetries: number; // e.g. 2
  backoffMs: number; // e.g. 1000, linear or exponential by policy
}

async function oneProbe(cfg: AdapterConfig, probe: Probe, run: RunConfig): Promise<EventRow[]> {
  const rows: EventRow[] = [];

  // arm 1: no retries — the counterfactual
  rows.push(await attempt(cfg, probe, "no-retry", 0));

  // arm 2: production-shaped — retries allowed, depth recorded
  let depth = 0;
  for (;;) {
    const row = await attempt(cfg, probe, "production-shaped", depth);
    rows.push(row);
    const retryable = OVERLOAD_CLASSES.has(row.status_class) || row.status_class === "network";
    if (!retryable || depth >= run.productionRetries) break;
    depth += 1;
    await new Promise((r) => setTimeout(r, run.backoffMs * depth));
  }
  return rows;
}

/** Mark rows inside overload clusters so reports can slice them out. */
function flagIncidents(rows: EventRow[]): void {
  const byWindow = new Map<string, EventRow[]>();
  for (const r of rows) {
    const k = `${r.provider}|${r.ts_window}`;
    const list = byWindow.get(k) ?? [];
    list.push(r);
    byWindow.set(k, list);
  }
  for (const list of byWindow.values()) {
    const overload = list.filter((r) => OVERLOAD_CLASSES.has(r.status_class)).length;
    if (overload >= INCIDENT_THRESHOLD) for (const r of list) r.incident_window = true;
  }
}

export async function run(runCfg: RunConfig, sink: (row: EventRow) => void): Promise<EventRow[]> {
  const queue: Array<() => Promise<EventRow[]>> = [];
  for (const adapter of runCfg.adapters)
    for (const probe of runCfg.probes) queue.push(() => oneProbe(adapter, probe, runCfg));

  const collected: EventRow[] = [];
  // fixed-concurrency worker pool: bounded load by construction
  const workers = Array.from({ length: Math.min(runCfg.concurrency, queue.length) }, async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      collected.push(...(await job()));
    }
  });
  await Promise.all(workers);

  // incident flags need the whole run: mark, then sink in stable order
  flagIncidents(collected);
  collected.sort((a, b) => a.ts_window.localeCompare(b.ts_window));
  for (const row of collected) sink(row);
  return collected;
}

/** Append-only JSONL sink: the event log file is the published artifact. */
export function jsonlSink(path: string): (row: EventRow) => void {
  // append semantics on purpose: a crashed run keeps every row already written
  return (row: EventRow) => {
    appendFileSync(path, JSON.stringify(row) + "\n");
  };
}

export { flagIncidents };
