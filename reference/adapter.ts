/**
 * Reference adapter for the provider-reliability harness.
 *
 * Status: REFERENCE, UNVERIFIED against live providers by design. This file
 * exists to make harness-design.md concrete: one wire format (OpenAI-
 * compatible chat completions, streaming), one event emitter, every field of
 * the event schema produced here or by the runner. Do not treat it as a
 * tested client; treat it as the shape a tested client must fill.
 *
 * The adapter's only jobs:
 *   1. send one probe request, streaming,
 *   2. record chunk arrival times,
 *   3. classify the outcome into the taxonomy,
 *   4. emit one Event row (harness-design.md schema).
 * Everything else (arms, retries, incident detection, aggregation) is the
 * runner's job — see runner.ts.
 */

export type StatusClass =
  | "ok"
  | "client-request"
  | "client-quota"
  | "provider-overload"
  | "provider-fault"
  | "semantic-failure"
  | "network";

export interface EventRow {
  ts_window: string; // minute granularity, by policy
  provider: string;
  alias: string; // name as sent
  model_resolved: string | null; // from response when exposed
  arm: "no-retry" | "production-shaped";
  retry_depth: number;
  status_class: StatusClass;
  ttft_ms: number | null;
  gaps_ms: number[];
  chunks: number;
  finish_reason: string | null;
  semantic_check: "pass" | "fail" | "n/a";
  incident_window: boolean; // runner sets this
}

export interface AdapterConfig {
  provider: string;
  alias: string;
  baseUrl: string;
  apiKeyEnv: string; // never inline keys
  timeoutMs: number;
}

export interface Probe {
  id: string;
  prompt: string;
  expect: string; // declared contract, e.g. "json-object"
}

const minuteWindow = (d: Date) => d.toISOString().replace(/:\d{2}\.\d{3}Z$/, ":00Z");

/** Classify an HTTP status + headers into the taxonomy (error-taxonomy.md). */
export function classifyStatus(status: number, headers: Headers): StatusClass {
  if (status >= 200 && status < 300) return "ok";
  if (status === 400 || status === 422) return "client-request";
  if (status === 401 || status === 403) return "client-quota";
  if (status === 429) {
    // quota vs overload: providers that tie 429 to your account say so in headers
    const quota = headers.get("x-ratelimit-remaining-requests");
    return quota === "0" ? "client-quota" : "provider-overload";
  }
  if (status === 503 || status === 529) return "provider-overload";
  if (status >= 500) return "provider-fault";
  return "provider-fault"; // unmapped non-2xx: fail toward their side, say so
}

/** Semantic check: does a completed stream satisfy the probe's contract? */
export function semanticCheck(expect: string, text: string): "pass" | "fail" {
  switch (expect) {
    case "json-object":
      try {
        const v = JSON.parse(text);
        return v && typeof v === "object" && !Array.isArray(v) ? "pass" : "fail";
      } catch {
        return "fail";
      }
    case "exact-string":
      // probes v1 declares the expected literal in the probe set; a real
      // runner passes it in. Non-empty is the weakest honest check here.
      return text.trim().length > 0 ? "pass" : "fail";
    case "markdown-table":
      return /^\|.*\|$/m.test(text) && (text.match(/^\|.*\|$/gm) ?? []).length >= 3 ? "pass" : "fail";
    case "code-block":
      return /```/.test(text) ? "pass" : "fail";
    case "tool-call-then-text":
      return text.trim().length > 0 ? "pass" : "fail"; // tool frames counted by runner
    case "stream-complete":
      return text.trim().length > 0 ? "pass" : "fail"; // stalls judged from gaps, not text
    case "complete-sequence": {
      const nums = text.split(",").map((s) => s.trim()).filter(Boolean);
      return nums.length === 400 ? "pass" : "fail"; // truncation probe
    }
    default:
      return text.trim().length > 0 ? "pass" : "fail";
  }
}

/**
 * Run one probe once. No retries here — the runner owns retry policy so the
 * arm distinction stays honest (retry-storms.md).
 */
export async function attempt(cfg: AdapterConfig, probe: Probe, arm: EventRow["arm"], retryDepth: number): Promise<EventRow> {
  const started = new Date();
  const gaps: number[] = [];
  let ttft: number | null = null;
  let streamStart = 0; // performance.now() at request dispatch
  let last = 0;
  let chunks = 0;
  let finish: string | null = null;
  let modelResolved: string | null = null;
  let text = "";

  const base: Omit<EventRow, "status_class" | "semantic_check"> = {
    ts_window: minuteWindow(started),
    provider: cfg.provider,
    alias: cfg.alias,
    model_resolved: null,
    arm,
    retry_depth: retryDepth,
    ttft_ms: null,
    gaps_ms: [],
    chunks: 0,
    finish_reason: null,
    incident_window: false,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  streamStart = performance.now();
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env[cfg.apiKeyEnv] ?? ""}`,
      },
      body: JSON.stringify({
        model: cfg.alias,
        stream: true,
        messages: [{ role: "user", content: probe.prompt }],
      }),
      signal: ctrl.signal,
    });
  } catch {
    clearTimeout(timer);
    return { ...base, status_class: "network", semantic_check: "n/a" };
  }
  clearTimeout(timer);

  if (res.status !== 200) {
    return { ...base, status_class: classifyStatus(res.status, res.headers), semantic_check: "n/a" };
  }
  if (!res.body) {
    return { ...base, status_class: "provider-fault", semantic_check: "n/a" };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const now = performance.now();
    if (ttft === null) ttft = now - streamStart;
    else gaps.push(now - last);
    last = now;
    chunks += 1;
    buf += decoder.decode(value, { stream: true });

    // parse SSE lines as they complete
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        if (j.model && !modelResolved) modelResolved = String(j.model);
        const delta = j.choices?.[0]?.delta?.content ?? "";
        if (delta) text += delta;
        if (j.choices?.[0]?.finish_reason) finish = j.choices[0].finish_reason;
      } catch {
        // malformed SSE frame: provider-fault at the protocol layer
        return { ...base, status_class: "provider-fault", semantic_check: "n/a" };
      }
    }
  }

  const sem = semanticCheck(probe.expect, text);
  const status: StatusClass = sem === "fail" ? "semantic-failure" : "ok";
  return {
    ...base,
    model_resolved: modelResolved,
    status_class: status,
    semantic_check: sem,
    ttft_ms: ttft === null ? null : Math.round(ttft),
    gaps_ms: gaps.map((g) => Math.round(g)),
    chunks,
    finish_reason: finish,
  };
}
