"""After a wave settles: what changed, whether anything leaked, and whether every live mutation anchor is still unique.

usage: check_wave.py <jpwb_root> <anchors.json> <main_status_baseline.txt> <out_changed.txt> [<expected_rel> ...]
  - lists files changed in the worktree vs HEAD (tracked + untracked), JPWB-relative, into out_changed.txt
  - flags changed files outside the expected set (when one is given)
  - flags any NEW status line in the main checkout's JPWB folder (a leak from this cycle into live work)
  - checks every live ledger anchor occurs exactly once
exit code 1 when anything is flagged.
"""
import json
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
root = sys.argv[1].replace("\\", "/").rstrip("/")
anchors = json.load(open(sys.argv[2], encoding="utf-8"))
baseline = set(open(sys.argv[3], encoding="utf-8").read().splitlines())
out_changed = sys.argv[4]
expected = set(sys.argv[5:])


def git(*args, cwd=root):
    return subprocess.run(["git", "-C", cwd, "--no-optional-locks", *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout


changed = [l for l in git("diff", "--name-only", "--relative").splitlines() if l]
untracked = [l for l in git("ls-files", "--others", "--exclude-standard").splitlines() if l]
with open(out_changed, "w", encoding="utf-8", newline="\n") as fh:
    fh.write("\n".join(changed) + ("\n" if changed else ""))
print("changed tracked files:", len(changed), "| untracked files:", len(untracked))
print("shortstat:", git("diff", "--shortstat", "--relative").strip() or "(none)")
flag = False
if untracked:
    flag = True
    print("UNTRACKED (unexpected):", untracked[:20])
if expected:
    extra = sorted(set(changed) - expected)
    if extra:
        flag = True
        print("CHANGED OUTSIDE THE WAVE:", extra)
    print("wave files unchanged:", len(expected - set(changed)))

main_now = git("status", "--porcelain", "--", "JanumiCode/janumiprofessionalworkbench", cwd="E:/Projects/hestami-ai").splitlines()
leaks = [l for l in main_now if l not in baseline]
if leaks:
    flag = True
    print("MAIN CHECKOUT CHANGED SINCE BASELINE (possible leak):")
    for l in leaks:
        print("   ", l)
else:
    print("main checkout JPWB status: unchanged from baseline")

bad = []
for rel, lst in anchors.items():
    live = [a for a in lst if not a["history"]]
    if not live:
        continue
    try:
        text = open(root + "/" + rel, encoding="utf-8", newline="").read()
    except OSError:
        bad.append((rel, "FILE MISSING", 0))
        continue
    for a in live:
        n = text.count(a["find"])
        if n != 1:
            bad.append((rel, a["id"], n))
if bad:
    flag = True
    print("ANCHORS NOT EXACTLY ONCE:", len(bad))
    for b in bad[:30]:
        print("   ", b)
else:
    print("live anchors: all exactly once")
sys.exit(1 if flag else 0)
