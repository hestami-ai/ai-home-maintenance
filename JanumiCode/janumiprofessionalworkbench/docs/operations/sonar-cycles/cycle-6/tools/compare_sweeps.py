"""Compare a re-sonar of changed files against the pre-wave sweep: what cleared, what was introduced.

usage: compare_sweeps.py <jpwb_root> <before_outdir_or_worklist> <after_outdir_or_worklist> [--files <changed.txt>]
Findings are matched per file by (rule, message) multiset, because line numbers shift after edits; S3776 messages
carry the complexity value, so an S3776 still present at a lower value shows as one cleared + one introduced and is
printed with both values. Only files present in the AFTER sweep are compared (that is what was re-sonared).
"""
import json
import os
import sys
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
root = sys.argv[1].replace("\\", "/").rstrip("/")


def load(p):
    if os.path.isdir(p):
        p = os.path.join(p, "worklist.json")
    return json.load(open(p, encoding="utf-8"))["files"]


before, after = load(sys.argv[2]), load(sys.argv[3])
only = None
if "--files" in sys.argv:
    only = {root + "/" + l.strip() for l in open(sys.argv[sys.argv.index("--files") + 1], encoding="utf-8") if l.strip()}

tot_clear = tot_new = 0
for f in sorted(after):
    if only is not None and f not in only:
        continue
    b = Counter((str(x["rule"]).split(":")[-1], x["message"]) for x in before.get(f, []))
    a = Counter((str(x["rule"]).split(":")[-1], x["message"]) for x in after[f])
    cleared, introduced = b - a, a - b
    tot_clear += sum(cleared.values())
    tot_new += sum(introduced.values())
    if cleared or introduced:
        print(f.replace(root + "/", ""), "| before %d  after %d" % (sum(b.values()), sum(a.values())))
        for (r, m), n in sorted(cleared.items()):
            print("    cleared    %dx %s  %s" % (n, r, (m or "")[:150]))
        for (r, m), n in sorted(introduced.items()):
            lines = [x["line"] for x in after[f] if str(x["rule"]).split(":")[-1] == r and x["message"] == m]
            print("    INTRODUCED %dx %s @L%s  %s" % (n, r, lines, (m or "")[:150]))
print("\nTOTAL cleared %d | introduced %d | files compared %d" % (tot_clear, tot_new, len(after) if only is None else len(only & set(after))))
