"""Format ONLY the changed files that were already prettier-clean at HEAD (the repo's format:check is red repo-wide;
running prettier --write on a file that was not clean reformats the whole file, and that churn breaks
content-anchored instruments - it unanchored mutant F159 once).

usage: format_clean.py <jpwb_root> <changed.txt> <dirty_at_head.txt>
  changed.txt: JPWB-relative paths (from check_wave.py); dirty_at_head.txt: paths prettier --list-different printed at HEAD
Each candidate is re-checked against HEAD's bytes first (git show HEAD:<path> piped to prettier --check), so a file is
formatted only when its HEAD version is provably clean.
"""
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
root = sys.argv[1].replace("\\", "/").rstrip("/")
changed = [l.strip() for l in open(sys.argv[2], encoding="utf-8") if l.strip()]
dirty = {l.strip().replace("\\", "/") for l in open(sys.argv[3], encoding="utf-8") if l.strip()}
PRETTIER = ["node", "node_modules/prettier/bin/prettier.cjs"]

formatted, skipped = [], []
for rel in changed:
    if rel in dirty:
        skipped.append((rel, "dirty at HEAD"))
        continue
    head = subprocess.run(["git", "-C", root, "--no-optional-locks", "show", "HEAD:./" + rel], capture_output=True, check=True).stdout
    chk = subprocess.run(PRETTIER + ["--check", "--stdin-filepath", rel], input=head, capture_output=True, cwd=root)
    if chk.returncode != 0:
        skipped.append((rel, "HEAD bytes not prettier-clean"))
        continue
    w = subprocess.run(PRETTIER + ["--write", rel], capture_output=True, text=True, cwd=root)
    if w.returncode != 0:
        skipped.append((rel, "prettier --write failed: " + (w.stderr or w.stdout)[:200]))
        continue
    formatted.append(rel)
print("formatted (clean at HEAD):", len(formatted))
for r in formatted:
    print("   ", r)
print("left unformatted:", len(skipped))
for r, why in skipped:
    print("    %s  (%s)" % (r, why))
