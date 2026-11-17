"""Summarize the family-refutation workflow's result: per batch counts, the wording verdict, and every non-HOLDS site.

usage: summarize_refute.py <task_output_file> [--holds]
The task output holds the workflow's return value as JSON ({report, full}); with --holds, HOLDS sites are listed too.
"""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
doc = json.load(open(sys.argv[1], encoding="utf-8"))
res = doc["result"] if "result" in doc else doc  # the task output wraps the return value under "result"
HOLDS = "--holds" in sys.argv

tot = {}
for x, full in zip(res["report"], res["full"]):
    print("=" * 110)
    print("%s batch %d: given %d returned %d missing %s extra %s counts %s" % (
        x["rule"], x["chunk"], x["given"], x["returned"], x.get("missing"), x.get("extra"), x.get("counts")))
    for k, v in (x.get("counts") or {}).items():
        tot.setdefault(x["rule"], {}).setdefault(k, 0)
        tot[x["rule"]][k] += v
    print("  wording accurate: %s" % x.get("wordingAccurate"))
    print("  suggested wording: %s" % x.get("suggestedWording"))
    for s in (full or {}).get("sites", []):
        if s["verdict"] == "HOLDS" and not HOLDS:
            continue
        print("  -- [%s] %s:%s" % (s["verdict"], s["rel"], s["line"]))
        print("     what: %s" % s["what"])
        print("     reason: %s" % s["reason"])
        print("     evidence: %s" % s["evidence"][:400])
print("=" * 110)
print("TOTALS by rule:", json.dumps(tot))
