# Changelog

## [2026-10-05] - Initial release: method, schema, probes, worked example

### Added
- `notes/` — error taxonomy (incl. semantic-failure class), stream stalls via inter-token gaps, retry-storm control arms, aliasing experiments with an ethics boundary, sanitization allowlist at collection, probe-set design
- `harness-design.md` — the event-log schema as the deliverable; adapter rules; what we deliberately do not build (no leaderboards)
- `probes/v1.jsonl` — versioned benign probe set: eight probes, one per tracked failure class
- `examples/synthetic/` — hand-written event log + `analyze.py` proving the schema suffices (stalls with positions, semantic failures, retry traffic, incident slices, opaque aliases)
- `hero.svg`, `CONTRIBUTING.md` — method yes; raw traffic and rankings no
