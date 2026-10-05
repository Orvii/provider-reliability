# Decide what survives aggregation before collection starts

**Claim.** A reliability dataset's privacy boundary must be fixed **before** the first request is recorded, written down as a schema rule, and enforced in the collector — not applied later by whoever writes the report. Retroactive sanitization fails because the person holding raw traffic can always see what they are trying to forget, and "we'll strip it before publishing" has no mechanism.

**Why.** Reliability logs naturally accumulate the sensitive: prompts (user data), completions (provider output, sometimes copyrighted), auth headers (if logging is sloppy), account-correlating timestamps at high resolution. Each is useful in the moment and toxic in aggregate. The boundary is a design decision about which questions the dataset may ever answer.

**Our boundary.**
- **Kept:** provider, alias, resolved model id if exposed, status class, retry depth, ttft, gap percentiles, finish reason, chunk counts, window timestamps at minute granularity.
- **Dropped at collection:** prompt text, completion text, headers, IPs, sub-minute timestamps, request ids that could join back to provider-side logs.
- **Derived, never raw:** error-message *classes* (regex-matched to the taxonomy), never verbatim error strings, which can embed request echoes.

**Failure example.** A public "helpful" reliability dataset included verbatim 500-response bodies; some contained echoed request fragments; some fragments contained API keys users had pasted into prompts. The dataset was retracted — but retraction does not un-index.

**Rule.** Write the boundary as code in the collector (an allowlist of fields, not a denylist), version it, and publish the collector with the dataset. An allowlist fails closed: a new sensitive field never enters by accident.

**Counter-note.** An over-tight boundary can kill the research: minute-granularity timestamps, for instance, hide minute-boundary rate-limit behavior. When a question needs finer data, the answer is a separate, explicitly-labeled internal dataset with its own access rules — never a quiet relaxation of the public one.
