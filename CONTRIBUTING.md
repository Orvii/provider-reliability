# Contributing

This repo publishes **method**, not measurements of named providers. That line is the contribution policy.

## Welcome

- New notes in the house shape: claim / why / failure example / rule / counter-note.
- Improvements to the event schema in `harness-design.md` — with a migration note for existing logs.
- Analyzer extensions in `examples/synthetic/analyze.py`, proven against the synthetic log (add rows to `events.jsonl` if the statistic needs them).
- Probe-set additions in `probes/`: benign, versioned, one per failure class; bump the set version and say why.

## Not welcome

- Raw traffic, prompts, completions, headers, or anything account-identifying — see [sanitization-boundary](notes/sanitization-boundary.md). PRs containing them will be closed without review.
- Named-provider rankings or leaderboards. Datasets and methods publish; rankings rot into slander (see harness-design "What we deliberately do not build").
- Measurements without the environment block and probe-set version ([the environment block is part of the result](https://github.com/Orvii/equivalence-notes/blob/main/notes/environment-is-part-of-the-program.md), [probe-set-design](notes/probe-set-design.md)).

## If you measured something real

Publish the method here and the data where your own policy allows. Link the two. A method note citing your dataset is a contribution; a dataset dump is not.
