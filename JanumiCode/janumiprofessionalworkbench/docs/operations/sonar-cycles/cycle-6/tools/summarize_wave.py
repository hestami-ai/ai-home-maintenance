"""Summarise a fix wave from its workflow journals: applied by rule, skipped by rule and reason category.

usage: summarize_wave.py <out.json> <journal.jsonl> [<journal.jsonl> ...]
Skip categories (from the agent's own reason text): anchor (an anchored text or a mutation's replace blocks it),
es2023, prior (an earlier cycle's ruling, kept and recorded), refused (a principled won't-fix: the fix would change
behaviour), other. 'refused' and 'other' are printed in full for audit; the rest are counted.
"""
import json
import re
import sys
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
out = sys.argv[1]
results = []
for j in sys.argv[2:]:
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
        if isinstance(v, dict) and "applied" in v:
            results.append(v)


def norm(rel):
    return re.sub(r"^.*?janumiprofessionalworkbench/", "", rel.replace("\\", "/"))


def category(reason):
    r = reason.lower()
    if "anchor" in r or "ledger" in r or "mutant" in r:
        return "anchor"
    if "es2023" in r:
        return "es2023"
    if "prior ruling" in r or "earlier cycle" in r or "ruled 2026" in r:
        return "prior"
    if "won't-fix" in r or "wont-fix" in r or "would change" in r or "not equivalent" in r or "behaviour" in r or "behavior" in r:
        return "refused"
    return "other"


applied, skipped = Counter(), defaultdict(Counter)
audit = []
for v in results:
    rel = norm(v.get("rel", "?"))
    for a in v["applied"]:
        applied[a["rule"]] += 1
    for s in v["skipped"]:
        c = category(s.get("reason", ""))
        skipped[s["rule"]][c] += 1
        if c in ("refused", "other"):
            audit.append((c, rel, s["rule"], s["line"], s.get("needsManual"), s.get("reason", "")))
json.dump({"results": results}, open(out, "w", encoding="utf-8"), indent=1)
print("agent results:", len(results), "| changed:", sum(1 for v in results if v.get("changed")))
print("applied:", sum(applied.values()), dict(applied.most_common()))
tot = Counter()
for rule, c in skipped.items():
    tot.update(c)
print("skipped:", sum(tot.values()), dict(tot))
for rule, c in sorted(skipped.items(), key=lambda kv: -sum(kv[1].values())):
    print("   %-7s %s" % (rule, dict(c)))
print("\n== refused / other skips, for audit:")
for c, rel, rule, line, nm, reason in sorted(audit):
    print("[%s] %s %s L%s manual=%s\n      %s" % (c, rel, rule, line, nm, reason[:420]))
