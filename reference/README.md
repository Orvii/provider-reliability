# Reference implementation — read before running

Two files, one purpose: make [harness-design.md](../harness-design.md) concrete enough to argue with.

- `adapter.ts` — one wire format (OpenAI-compatible streaming), chunk timing, taxonomy classification, semantic checks, one event row per attempt.
- `runner.ts` — the two arms (no-retry / production-shaped with recorded depth), fixed-concurrency pool, incident-window flagging, append-only JSONL sink.

## Status: reference, not tested client

These files have **never contacted a provider** and are published unverified on purpose. They exist so the schema and the protocol decisions have a reviewable shape. Known simplifications, listed so nobody inherits them silently:

- SSE parsing is line-based and assumes one JSON object per `data:` line (true for the wire format targeted; not universal).
- `semanticCheck` for `exact-string` and `tool-call-then-text` is the weakest honest check; a real runner passes the probe's expected literal and counts tool frames.
- Retry backoff is linear-by-depth; the policy knob is in `RunConfig`, the choice is yours and should be published.
- No TLS/proxy/IPv6 handling: network-class rows will absorb those failures, which is what the taxonomy says they are.

## If you run it for real

1. Keys via env (`apiKeyEnv`), never in config files that get committed.
2. Respect provider terms: fixed small concurrency, no probe volumes resembling load tests (see [aliasing-experiments](../notes/aliasing-experiments.md), ethics paragraph).
3. Publish the event log with the [sanitization boundary](../notes/sanitization-boundary.md) enforced at write time — the sink appends rows as the adapter emits them, so filter in the adapter, not after.
4. Report arms separately. A single blended success rate re-commits the sin [retry-storms](../notes/retry-storms.md) exists to prevent.
