# An error taxonomy, or "99.2% success" means nothing

**Claim.** Provider reliability numbers are uninterpretable without an error class system that separates *provider fault* from *client fault* from *ambiguous*. A single success-rate figure mixes your malformed requests, your quota exhaustion, their outages, and the network between — and every stakeholder reads the mixture as evidence for their own position.

**Classes we use.**
1. `client-request` — 400-class from malformed input, schema violations. Provider is right; you are wrong.
2. `client-quota` — 401/403/429 attributable to *your* account limits (headers say so). Not provider unreliability; provider policy.
3. `provider-overload` — 429/503 with retry-after or overload semantics not tied to your quota. Their capacity, their problem.
4. `provider-fault` — 5xx without overload semantics, connection resets mid-stream, protocol violations.
5. `semantic-failure` — HTTP 200 with a broken contract: truncated JSON in a tool call, `finish_reason: stop` on visibly incomplete output, wrong content type. The class everyone forgets and users feel most.
6. `network` — TLS/DNS/connect failures before first byte. Often yours, sometimes theirs, rarely knowable — keep it separate and say so.

**Why class 5 matters most.** Classes 1-4 announce themselves with status codes. Class 5 returns success and ships garbage; without content-level checks your success rate is a lie with a green checkmark.

**Failure example.** A provider reports 99.9% availability while 2% of streaming responses truncate tool-call JSON mid-object. Under class-5 counting its real reliability for agent workloads is ~97.9% — and the difference is invisible to any status-page SLA.

**Counter-note.** Taxonomies invite lawyering: every team reclassifies failures toward `client-*` or `network`. Freeze the classifier as code, version it, and publish the classifier with the numbers — a reclassification is then a visible diff, not a quiet restatement.
