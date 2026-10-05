# The probe set is the instrument — design it like one

**Claim.** A reliability study's probe set (the fixed prompts/requests sent to providers) is a measurement instrument, and must be built like one: versioned, stable, benign, and covering the failure classes you intend to observe. Probes that drift between runs make time series incomparable; probes that are clever measure prompt-sensitivity instead of reliability.

**Why.** Every statistic in this repo is conditioned on the probe set. Change the probes and the error mix changes for reasons that have nothing to do with providers. Conversely, a probe set of one trivial prompt observes almost nothing: truncation, tool-call corruption, and long-context failures each need a probe shaped to provoke them *benignly*.

**Design rules.**
- **Versioned artifact:** probes live in a file with a version; every event row records probe id and probe-set version.
- **Benign content:** reliability probes ask for JSON, code, summaries, recall over provided text. Jailbreak or refusal-boundary probes belong to safety studies, with their own ethics and disclosure — not smuggled into a reliability run.
- **Shape diversity:** one probe per failure class you track (truncation-prone long outputs, tool-call JSON, unicode, whitespace-sensitive formats, long-context recall).
- **Length bands:** short/medium/long inputs and outputs, because cache behavior and stall profiles differ by size.
- **Stability over cleverness:** a boring probe that runs identically for a year beats a clever one that needs editing next month.

**Failure example.** A study adds a "harder" probe mid-series to catch truncation; the provider's truncation rate appears to jump. The jump is the new probe, not the provider — invisible in any aggregate that lacks probe ids.

**Counter-note.** If the research question *is* how providers handle difficult or adversarial input, that is a different study: say so, design probes for it deliberately, and keep its data out of the reliability time series. Instruments answer the question they were built for.
