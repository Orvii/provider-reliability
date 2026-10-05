# Stream stalls: the failure that returns success

**Claim.** For streaming inference, latency must be measured as a **time series of inter-token gaps**, not one number per request. A stream that delivers 90% of tokens in two seconds and then hangs for forty before finishing is, to a mean-latency metric, a slightly slow success; to a user watching a cursor, it is an outage with extra steps.

**Why.** Aggregates hide shape. TTFT (time to first token) and total duration are both blind to a mid-stream stall: TTFT happened long ago, total duration looks like a long answer. The gap distribution — p50/p99/max of inter-token intervals — is the only place a stall leaves a fingerprint.

**Definitions that make it measurable.**
- `gap` = interval between consecutive chunk arrivals (not token counts; chunking varies by provider).
- `stall` = any gap exceeding a declared threshold (we use 10s for interactive-shaped workloads; state yours).
- `stall-position` = fraction of total chunks delivered before the stall — distinguishes "died at the start" from "died at the punchline".

**Failure example.** Two providers, same median total duration. Provider A's p99 gap is 400ms; provider B's is 22s with stalls in 3% of streams. Agent loops built on B time out mid-tool-call at exactly the rate users complain about — and no status code anywhere records it.

**Measurement rule.** Record every chunk timestamp; compute gap percentiles and stall rate per provider per model-id; publish stall-position histograms, because a provider that stalls at 95% delivered is a different product from one that stalls at 5%.

**Counter-note.** For batch workloads nobody watches, stalls only matter through total duration — the time series is overhead there. Match the metric to the consumer: interactive → gap distribution; batch → duration distribution. Publishing both for both is noise dressed as rigor.
