"""For each open tier-AB finding OUTSIDE anchored text, print the wave agents' own skip reasons (same file, same rule).

usage: skip_reasons.py <triage_out.json> <anchors.json> <mech-results.json>

Wave lines are the lines at the wave's start, so findings are matched by file and rule, not line; every skip
entry of that file and rule is printed, verbatim, so the reader sees which one is about which site.
"""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
tri = json.load(open(sys.argv[1], encoding="utf-8"))
anchors = json.load(open(sys.argv[2], encoding="utf-8"))
res = json.load(open(sys.argv[3], encoding="utf-8"))["results"]
PREFIX = "JanumiCode/janumiprofessionalworkbench/"
skips = {}
for r in res:
    rel = r["rel"][len(PREFIX):] if r["rel"].startswith(PREFIX) else r["rel"]
    for s in r.get("skipped", []):
        skips.setdefault((rel, s["rule"]), []).append(s)

for rel, f in sorted(tri["files"].items()):
    text = open(f["abs"], encoding="utf-8", newline="").read()
    ranges = []
    for a in anchors.get(rel, []):
        if a["history"] or text.count(a["find"]) != 1:
            continue
        i = text.index(a["find"])
        st = text.count("\n", 0, i) + 1
        ranges.append((st, st + a["find"].count("\n")))
    for r in f["findings"]:
        if r["tier"] != "AB" or any(s <= r["line"] <= e for s, e in ranges):
            continue
        print("=" * 100)
        print("%s %s:%d | %s" % (r["rule"], rel, r["line"], r["message"][:120]))
        for s in skips.get((rel, r["rule"]), []):
            print("  wave L%-5s needsManual=%-5s %s" % (s["line"], s["needsManual"], s["reason"]))
        if (rel, r["rule"]) not in skips:
            print("  (no skip entry for this file and rule in the wave results)")
