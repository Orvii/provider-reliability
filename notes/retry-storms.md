# Your retries are part of the system you are measuring

**Claim.** A reliability harness that retries failures measures a **closed loop**, not a provider: every retry adds load to the very capacity whose failure you are recording, and backoff shape changes the provider's observed error mix. Report retry depth alongside every reliability figure, and run a no-retry control arm, or your numbers describe your client as much as their service.

**Why.** Overload errors are load-dependent. A harness with 3 retries and 1s backoff converts a 5% instantaneous failure rate into a bursty second wave of requests arriving correlated in time — precisely the traffic shape that extends an overload event. Two harnesses measuring the same provider during the same incident will report different reliabilities because their retry policies differ.

**Failure example.** Provider incident, 60 seconds. Harness A (no retries) records 8% failed attempts. Harness B (3 retries, exponential backoff) records 4% failed *requests* — better! — while sending 22% more traffic during the incident and extending it. B's number is not wrong; it answers a different question ("did my user eventually get served") and hides its own contribution.

**Protocol.**
- Always run a **no-retry arm** in parallel with the production-shaped arm; publish both.
- Record `retry_depth` on every event so any statistic can be sliced by it.
- Cap harness-induced load: fixed concurrency, not "as fast as responses allow", so the measurement cannot become a load test.
- When an overload signature appears (429/503 cluster), mark the window; report in-incident and out-of-incident statistics separately.

**Counter-note.** If the question is user-experienced availability ("what fraction of my users' intents succeeded?"), retries *are* the product and the no-retry arm is the counterfactual, not the headline. The rule is not "retries are bad"; it is "say which arm is which".
