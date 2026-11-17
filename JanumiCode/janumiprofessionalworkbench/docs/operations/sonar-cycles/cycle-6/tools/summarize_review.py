"""Summarise review waves from their journals: verdicts, and every blocking/minor concern in full.

usage: summarize_review.py <journal.jsonl> [<journal.jsonl> ...]
"""
import json
import sys
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
res = []
for j in sys.argv[1:]:
    for line in open(j, encoding="utf-8"):
        try:
            rec = json.loads(line)
        except ValueError:
            continue
        if rec.get("type") != "result":
            continue
        v = rec.get("result") if "result" in rec else rec.get("value")
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except ValueError:
                continue
        if isinstance(v, dict) and "equivalent" in v:
            res.append(v)
sev = Counter(c["severity"] for v in res for c in v.get("concerns", []))
print("reviews:", len(res), "| equivalent:", sum(1 for v in res if v["equivalent"]), "| NOT equivalent:", [v["rel"] for v in res if not v["equivalent"]])
print("concerns by severity:", dict(sev))
for v in res:
    for c in v.get("concerns", []):
        if c["severity"] in ("blocking", "minor"):
            print("\n[%s] %s :: %s\n    %s" % (c["severity"], v["rel"], c["path"], c["detail"][:900]))
