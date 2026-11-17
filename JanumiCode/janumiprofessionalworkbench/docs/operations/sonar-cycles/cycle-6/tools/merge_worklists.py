"""Merge sweeps into one current view: a base sweep, with every file re-sonared later replaced by its latest result.

usage: merge_worklists.py <out_dir> <base_outdir> <override_outdir> [<override_outdir> ...]
Writes <out_dir>/worklist.json and <out_dir>/ledger.json in batch-runner's format, so triage.py can read the result.
Later overrides win. A file absent from every override keeps its base findings (it was not edited since).
"""
import json
import os
import sys

out_dir, base, overrides = sys.argv[1], sys.argv[2], sys.argv[3:]


def load(d):
    w = json.load(open(os.path.join(d, "worklist.json"), encoding="utf-8"))
    l = json.load(open(os.path.join(d, "ledger.json"), encoding="utf-8"))
    return w, l


w, l = load(base)
files, results = dict(w["files"]), dict(l.get("results", {}))
for d in overrides:
    ow, ol = load(d)
    files.update(ow["files"])
    results.update(ol.get("results", {}))
os.makedirs(out_dir, exist_ok=True)
by_rule, total = {}, 0
for items in files.values():
    for x in items:
        by_rule[x["rule"]] = by_rule.get(x["rule"], 0) + 1
        total += 1
json.dump({"workspace": w.get("workspace"), "totalFiles": len(files), "analyzed": len(files), "totalFindings": total,
           "byRule": dict(sorted(by_rule.items(), key=lambda kv: -kv[1])), "files": files},
          open(os.path.join(out_dir, "worklist.json"), "w", encoding="utf-8"), indent=1)
json.dump({"results": results, "done": list(results)}, open(os.path.join(out_dir, "ledger.json"), "w", encoding="utf-8"), indent=1)
print("merged: %d files, %d findings (base %s + %d override sweeps)" % (len(files), total, os.path.basename(base), len(overrides)))
