# Aliasing experiments: same model, two names, and the ethics of asking

**Claim.** Providers route the same underlying model under multiple aliases (vendor name, aggregator name, "turbo"/"max" tiers, dated snapshots). Whether alias affects behavior is an empirical question answerable with paired experiments — but the experiment design must survive the accusation of fingerprinting or terms-violation, so it should use ordinary traffic shapes, public endpoints, and published aggregate statistics only.

**Why it is measurable.** If two aliases serve the same checkpoint with the same routing, their behavior distributions (latency shape, error mix, tokenizer quirks, refusal boundaries on a fixed probe set) should be statistically indistinguishable at reasonable sample sizes. Systematic divergence is evidence of different routing, quantization, or checkpoint — worth publishing as *divergence*, without claiming to know its cause.

**Protocol.**
- Fixed probe set: N benign prompts spanning formats (JSON-out, code-out, long-context recall), identical across aliases.
- Paired design: same prompt, both aliases, interleaved order, same time window; compare within-pair differences, not marginals.
- Report distributions and effect sizes with confidence intervals; a single quirky prompt is an anecdote.
- Record resolved model IDs where the API exposes them; when it does not, say the alias is opaque and treat identity as unknown.

**Ethics and terms.** Stay inside ordinary usage: no probe volumes that resemble load testing, no attempts to extract system prompts or routing internals, no publishing per-account observations. The claim we make is "these two public aliases behaved differently on this public probe set during this window" — a statement about a product surface, not about infrastructure.

**Failure example (why pairing matters).** Comparing alias A's Monday traffic to alias B's Tuesday traffic confounds alias with day-of-week capacity patterns. Paired, interleaved, same-window comparison removes that confound — and is the difference between a finding and a coincidence.

**Counter-note.** Some divergence is *documented* (tiers differ by design: rate limits, context windows). Check the docs first; an experiment confirming a documented difference is a demo, not a discovery. The interesting case is divergence where docs claim equivalence.
