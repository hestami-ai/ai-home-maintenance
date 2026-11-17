"""Check that the bytes an equivalence review saw are the bytes being committed.

usage: python reviewed_equals_committed.py <jpwb_root> <base_commit> <changed_list> <review.workflow.js>...

For every review script, read its embedded `const files = [...]` line (entries
{rel, diff}, each diff taken with `git diff --relative -- rel` against the index
at review time).  For every file in <changed_list> (JPWB-relative paths), compute
`git diff --relative <base_commit> -- rel` now and compare it with the reviewed
diff, byte for byte.  Exit 1 if any committed file was not reviewed or differs.
"""
import json
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

root, base, changed_list = sys.argv[1], sys.argv[2], sys.argv[3]
scripts = sys.argv[4:]

reviewed = {}
for path in scripts:
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("const files = "):
                for e in json.loads(line[len("const files = "):]):
                    if e["rel"] in reviewed:
                        print("DUPLICATE in reviews:", e["rel"])
                    reviewed[e["rel"]] = e["diff"]
print("reviewed entries:", len(reviewed))

with open(changed_list, encoding="utf-8") as fh:
    committed = [l.strip() for l in fh if l.strip()]

bad = 0
for rel in committed:
    now = subprocess.run(["git", "-C", root, "--no-optional-locks", "diff", "--relative", base, "--", rel],
                         capture_output=True, text=True, encoding="utf-8", check=True).stdout
    if rel not in reviewed:
        print("NOT REVIEWED:", rel)
        bad += 1
    elif reviewed[rel] != now:
        print("DIFFERS since review:", rel)
        bad += 1
    else:
        print("same:", rel)

for rel in sorted(set(reviewed) - set(committed)):
    print("reviewed, not committed:", rel)

print("committed files: %d, problems: %d" % (len(committed), bad))
sys.exit(1 if bad else 0)
