"""Build the headless-sweep file list from sonar-project.properties' scope.

Scope (the repository's single scope authority, docs/operations/sonarqube.md section 1):
  sonar.sources=packages,apps,verif,scripts
  sonar.exclusions=**/dist/**,**/node_modules/**,**/coverage/**,**/.svelte-kit/**,**/build/**,
                   **/e2e-results/**,**/*.test.ts,**/__tests__/**
Only tracked files (git ls-files) are listed, as absolute paths with an explicit drive-letter root
(never an MSYS /e/... path: Node marks those unreadable and the sweep silently reports zero).

usage: mk_filelist.py <jpwb_root> <out_dir> [shards]
writes <out_dir>/filelist.txt and, when shards > 1, filelist-shard<N>.txt balanced by bytes.
"""
import os
import subprocess
import sys
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
root = sys.argv[1].replace("\\", "/").rstrip("/")
out_dir = sys.argv[2]
shards = int(sys.argv[3]) if len(sys.argv) > 3 else 1

SOURCES = ("packages", "apps", "verif", "scripts")
EXCL_DIRS = ("dist", "node_modules", "coverage", ".svelte-kit", "build", "e2e-results", "__tests__")
JS_EXT = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts")

rels = subprocess.run(
    ["git", "-C", root, "--no-optional-locks", "ls-files"],
    capture_output=True, text=True, encoding="utf-8", check=True,
).stdout.splitlines()

kept, skipped = [], Counter()
for rel in rels:
    parts = rel.split("/")
    if parts[0] not in SOURCES:
        continue
    if any(p in EXCL_DIRS for p in parts[:-1]):
        skipped["excluded dir"] += 1
        continue
    if rel.endswith(".test.ts"):
        skipped["*.test.ts"] += 1
        continue
    ext = os.path.splitext(rel)[1].lower()
    if ext == ".svelte":
        skipped[".svelte (no analyzer)"] += 1
        continue
    if ext not in JS_EXT:
        continue
    kept.append(rel)

os.makedirs(out_dir, exist_ok=True)
abs_paths = [root + "/" + r for r in kept]
with open(os.path.join(out_dir, "filelist.txt"), "w", encoding="utf-8", newline="\n") as fh:
    fh.write("\n".join(abs_paths) + "\n")

print("files listed:", len(kept))
print("by top dir:", dict(Counter(r.split("/")[0] for r in kept)))
print("by extension:", dict(Counter(os.path.splitext(r)[1].lower() for r in kept)))
print(".d.ts among them:", sum(1 for r in kept if r.endswith(".d.ts")))
print("skipped:", dict(skipped))
missing = [p for p in abs_paths if not os.path.isfile(p)]
print("listed paths not readable on disk:", len(missing), missing[:3])

if shards > 1:
    sized = sorted(((os.path.getsize(p), p) for p in abs_paths), reverse=True)
    bins = [[0, []] for _ in range(shards)]
    for size, p in sized:
        b = min(bins, key=lambda x: x[0])
        b[0] += size
        b[1].append(p)
    for i, (total, ps) in enumerate(bins, 1):
        with open(os.path.join(out_dir, "filelist-shard%d.txt" % i), "w", encoding="utf-8", newline="\n") as fh:
            fh.write("\n".join(sorted(ps)) + "\n")
        print("shard %d: %d files, %.1f MB" % (i, len(ps), total / 1048576))
