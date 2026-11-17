"""Build the refutation workflow's args from a triage output: every family-tier finding, grouped by rule, chunked.

usage: mk_family_args.py <triage_out.json> <out_args.json> [chunk_size]

Each chunk: {rule, rationale, sites: [{rel, line, message}]} - the message is Sonar's, VERBATIM; the rationale is the
one triage.py recorded (the claim the workflow tries to refute).  Sites keep sweep order (file, then line).
"""
import json
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
tri = json.load(open(sys.argv[1], encoding="utf-8"))
out_path = sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 14

by_rule = defaultdict(list)
rationale = {}
for rel, f in sorted(tri["files"].items()):
    for r in sorted(f["findings"], key=lambda r: r["line"]):
        if r["tier"] != "family":
            continue
        by_rule[r["rule"]].append({"rel": rel, "line": r["line"], "message": r["message"]})
        rationale.setdefault(r["rule"], r.get("note", ""))

chunks = []
for rule in sorted(by_rule, key=lambda s: -len(by_rule[s])):
    sites = by_rule[rule]
    n = (len(sites) + size - 1) // size
    per = (len(sites) + n - 1) // n  # even chunks
    for i in range(0, len(sites), per):
        chunks.append({"rule": rule, "rationale": rationale[rule], "sites": sites[i:i + per]})

json.dump({"chunks": chunks}, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("family findings:", sum(len(v) for v in by_rule.values()), "| by rule:", {k: len(v) for k, v in by_rule.items()})
print("chunks:", len(chunks), [(c["rule"], len(c["sites"])) for c in chunks])
