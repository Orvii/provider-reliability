# Harness design — the event log is the deliverable

The reference harness is one request shape, N providers behind identical adapters, and a structured **event log**. Dashboards come and go; the log schema is what makes results reproducible and comparable across runs, people, and years.

## Request shape

One canonical probe request per experiment arm:

- fixed prompt set (versioned, published),
- streaming on (stall measurement requires it),
- temperature 0 where the provider allows, else recorded,
- fixed max tokens,
- no tools in the base arm (tool-call truncation gets its own arm).

Simplicity is a feature: every knob added to the request shape multiplies the comparison surface.

## Event schema (one row per attempt)

```jsonc
{
  "ts_window": "2026-10-05T09:17:00Z",   // minute granularity, by policy
  "provider": "…",
  "alias": "…",                          // name as sent
  "model_resolved": "… | null",          // from response, when exposed
  "arm": "no-retry | production-shaped",
  "retry_depth": 0,
  "status_class": "client-request | client-quota | provider-overload | provider-fault | semantic-failure | network | ok",
  "ttft_ms": 812,
  "gaps_ms": [41, 38, 55, 12040, 44],    // inter-chunk gaps; the stall fingerprint
  "chunks": 5,
  "finish_reason": "stop | length | tool_calls | error | null",
  "semantic_check": "pass | fail | n/a", // content-level contract check
  "incident_window": false               // set by the overload-cluster detector
}
```

Everything in the notes is computable from this row set: error mix by class, latency and gap distributions, stall rates and positions, retry contribution, alias divergence (paired rows), in-incident slices.

## Adapter rules

- Identical timeouts, identical retry policy per arm, identical parsing — adapters may differ only in the wire format each provider demands.
- The semantic check lives in the harness, not the adapters: parse tool-call JSON, verify declared finish reason against content shape.
- Concurrency is fixed per arm; the harness must not become a load test (see [retry-storms](notes/retry-storms.md)).
- The collector enforces the [sanitization boundary](notes/sanitization-boundary.md) as a field allowlist at write time.

## What we deliberately do not build

- No provider-specific dashboards: they invite per-provider narratives the data cannot support.
- No live public leaderboard: point-in-time rankings age into slander. Datasets and methods publish; rankings rot.
