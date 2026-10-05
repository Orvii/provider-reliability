#!/usr/bin/env python3
"""Compute every statistic the notes promise, from an event log.

Usage: python3 analyze.py events.jsonl
The log schema is the one in ../../harness-design.md. This file is the
executable proof that the schema suffices: error mix, latency, gap
percentiles, stall rate and position, retry contribution, incident slices.
"""
import json
import statistics
import sys
from collections import Counter, defaultdict

STALL_MS = 10_000  # declared threshold; state yours when you reuse this


def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


def main(path):
    events = [json.loads(l) for l in open(path) if l.strip()]
    by_prov = defaultdict(list)
    for e in events:
        by_prov[e["provider"]].append(e)

    for prov, evs in sorted(by_prov.items()):
        print(f"== {prov} ({len(evs)} attempts)")
        mix = Counter(e["status_class"] for e in evs)
        print("  error mix:", dict(mix))

        ttft = [e["ttft_ms"] for e in evs if e["ttft_ms"] is not None]
        if ttft:
            print(f"  ttft ms: p50={pct(ttft, .5):.0f} p95={pct(ttft, .95):.0f} max={max(ttft)}")

        gaps = [g for e in evs for g in e["gaps_ms"]]
        if gaps:
            print(f"  gaps ms: p50={pct(gaps, .5):.0f} p99={pct(gaps, .99):.0f} max={max(gaps)}")
            stalls = [(e, g) for e in evs for g in e["gaps_ms"] if g > STALL_MS]
            if stalls:
                for e, g in stalls:
                    idx = e["gaps_ms"].index(g)
                    pos = idx / max(1, len(e["gaps_ms"]))
                    print(f"  stall: {g}ms at position {pos:.0%} of chunks (arm={e['arm']})")
            else:
                print("  stalls: none above threshold")

        sem = [e for e in evs if e["semantic_check"] == "fail"]
        if sem:
            print(f"  semantic failures: {len(sem)} of {mix['ok'] + len(sem)} HTTP-200-class rows")

        arms = defaultdict(list)
        for e in evs:
            arms[e["arm"]].append(e["status_class"] == "ok")
        for arm, oks in sorted(arms.items()):
            print(f"  arm {arm}: success {sum(oks)}/{len(oks)}")
        extra = sum(1 for e in evs if e["arm"] == "production-shaped") - sum(
            1 for e in evs if e["arm"] == "production-shaped" and e["retry_depth"] == 0
        )
        print(f"  retry-added traffic (production arm): {extra} attempt(s)")

        inc = [e for e in evs if e["incident_window"]]
        if inc:
            ok = sum(1 for e in inc if e["status_class"] == "ok")
            print(f"  incident window: {ok}/{len(inc)} ok (report separately)")

        unresolved = {e["alias"] for e in evs if e["model_resolved"] is None}
        if unresolved:
            print(f"  opaque aliases (model id not exposed): {sorted(unresolved)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "events.jsonl")
