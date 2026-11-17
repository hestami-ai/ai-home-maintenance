"""Classify the findings of a triage output by where they sit relative to the mutation ledger's anchored text.

usage: classify_open.py <triage_out.json> <anchors.json> [--list]

A finding is INSIDE ANCHORED TEXT when its primary line falls within the lines a live ledger anchor's `find`
occupies in the file now (the anchor located by exact match; an anchor that does not occur exactly once is
reported and its range is unknown).  This is a reproducible proxy for "a fix here would change anchored bytes":
the fix may also touch lines around the primary one, so INSIDE is a lower bound on the anchor-blocked set.
Counts are printed per tier and rule; --list prints every open finding with its classification.
"""
import json
import sys
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
tri = json.load(open(sys.argv[1], encoding="utf-8"))
anchors = json.load(open(sys.argv[2], encoding="utf-8"))
LIST = "--list" in sys.argv
root = tri["root"]

rows = []
rot = []
for rel, f in sorted(tri["files"].items()):
    try:
        text = open(f["abs"], encoding="utf-8", newline="").read()
    except OSError:
        text = ""
    ranges = []
    for a in anchors.get(rel, []):
        if a["history"]:
            continue
        n = text.count(a["find"])
        if n != 1:
            rot.append((rel, a["id"], n))
            continue
        i = text.index(a["find"])
        start = text.count("\n", 0, i) + 1
        end = start + a["find"].count("\n")
        ranges.append((start, end, a["id"]))
    for r in f["findings"]:
        ln = r["line"]
        hit = [aid for (s, e, aid) in ranges if s <= ln <= e]
        rows.append({"rel": rel, "rule": r["rule"], "line": ln, "tier": r["tier"], "inside": hit, "message": r["message"]})

by = defaultdict(Counter)
for x in rows:
    by[x["tier"]][(x["rule"], "inside" if x["inside"] else "outside")] += 1

print("findings:", len(rows), "| anchors not exactly once:", len(rot))
for t in rot[:20]:
    print("  ROT", t)
for tier in sorted(by):
    c = by[tier]
    ins = sum(v for (r, k), v in c.items() if k == "inside")
    print("\ntier %-9s total %4d  inside anchored text %4d  outside %4d" % (tier, sum(c.values()), ins, sum(c.values()) - ins))
    rules = sorted({r for (r, k) in c}, key=lambda r: -(c[(r, "inside")] + c[(r, "outside")]))
    for r in rules:
        print("    %-7s inside %3d  outside %3d" % (r, c[(r, "inside")], c[(r, "outside")]))

if LIST:
    print("\n--- open findings (tiers AB, C, gen):")
    for x in rows:
        if x["tier"] in ("AB", "C", "gen"):
            where = ("INSIDE " + ",".join(x["inside"])) if x["inside"] else "outside"
            print("  [%s] %s %s:%d  %s | %s" % (x["tier"], x["rule"], x["rel"], x["line"], where, x["message"][:100]))
