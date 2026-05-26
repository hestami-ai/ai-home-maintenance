#!/usr/bin/env bash
# Resume a thin-slice run from a target sub-phase (or phase).
#
# Designed for the debug-iterate loop:
#   1. Operator runs `init-thin-slice-run.sh -n <N>` to start a slice.
#   2. Auditor flags a defect at sub-phase X.
#   3. Operator stops the run (`pnpm stop:run` or SIGINT).
#   4. Operator edits the prompt template / normalizer / phase handler.
#   5. Operator runs `resume-thin-slice-run.sh -n <N> -s X` to:
#        - rebuild dist
#        - roll back stale records produced at-or-after sub-phase X
#        - re-execute the workflow from there
#   6. New transformation_step + lifecycle events append to the same
#      .janumicode/runs/<run_id>/ files; a workflow.resumed marker
#      records exactly where the re-run started.
#
# Usage:
#   scripts/resume-thin-slice-run.sh -n <slice-number> -s <sub-phase-id> [-p <phase-id>] [-y]
#   scripts/resume-thin-slice-run.sh -n <slice-number> -p <phase-id> [-y]
#
# Options:
#   -n <N>          Slice number (workspace = thin-slice-workspace-<N>). Required.
#   -s <sub-phase>  Sub-phase to resume at. Takes precedence over -p.
#   -p <phase>      Phase to resume at (legacy, coarser granularity).
#   -y              Skip confirmation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SLICE_ROOT="${REPO_ROOT}/test-and-evaluation/thin-slice-workspaces"

slice_number=""
sub_phase=""
phase=""
skip_confirm=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) slice_number="$2"; shift 2 ;;
    -s) sub_phase="$2"; shift 2 ;;
    -p) phase="$2"; shift 2 ;;
    -y) skip_confirm=1; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "[resume-thin-slice] unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${slice_number}" ]]; then
  echo "[resume-thin-slice] -n <slice-number> is required" >&2
  exit 2
fi
if [[ -z "${sub_phase}" && -z "${phase}" ]]; then
  echo "[resume-thin-slice] -s <sub-phase> or -p <phase> is required" >&2
  exit 2
fi
if ! [[ "${slice_number}" =~ ^[0-9]+$ ]]; then
  echo "[resume-thin-slice] -n must be a positive integer" >&2
  exit 2
fi

workspace="${SLICE_ROOT}/thin-slice-workspace-${slice_number}"
if [[ ! -d "${workspace}" ]]; then
  echo "[resume-thin-slice] workspace does not exist: ${workspace}" >&2
  exit 1
fi

# Locate the most recent DB file in the workspace's test-harness dir.
# Prefer the original (numeric-name) DB to avoid copying-on-copy chains
# across multiple resumes. Fall back to any *.db if no original exists.
dbdir="${workspace}/.janumicode/test-harness"
if [[ ! -d "${dbdir}" ]]; then
  echo "[resume-thin-slice] no test-harness DB dir at ${dbdir}" >&2
  exit 1
fi

# Find the largest numeric-named .db file (these are the original
# per-run DBs from init-thin-slice-run.sh, named by timestamp).
src_db=""
largest_ts=0
for f in "${dbdir}"/*.db; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f" .db)"
  if [[ "${base}" =~ ^[0-9]+$ ]] && (( base > largest_ts )); then
    largest_ts=$base
    src_db="$f"
  fi
done

# Fall back to the most recent file (lexical, which includes resume-* DBs).
if [[ -z "${src_db}" ]]; then
  src_db="$(ls -t "${dbdir}"/*.db 2>/dev/null | head -1)"
fi
if [[ -z "${src_db}" ]]; then
  echo "[resume-thin-slice] no .db file in ${dbdir}" >&2
  exit 1
fi

intent_file="${workspace}/.janumicode/intent.md"
if [[ ! -f "${intent_file}" ]]; then
  echo "[resume-thin-slice] no intent.md in ${workspace}/.janumicode (corrupted workspace?)" >&2
  exit 1
fi

echo "[resume-thin-slice] slice number   : ${slice_number}"
echo "[resume-thin-slice] workspace       : ${workspace}"
echo "[resume-thin-slice] resume-from DB  : ${src_db}"
if [[ -n "${sub_phase}" ]]; then
  echo "[resume-thin-slice] resume-at-sub   : ${sub_phase}"
else
  echo "[resume-thin-slice] resume-at-phase : ${phase}"
fi

if (( ! skip_confirm )); then
  read -r -p "[resume-thin-slice] Proceed? [y/N] " confirm
  case "${confirm}" in
    y|Y|yes|YES) ;;
    *) echo "[resume-thin-slice] aborted."; exit 0 ;;
  esac
fi

# Always rebuild before resuming. A resume implies the operator just
# edited code (prompt template, normalizer, phase handler). Without
# rebuild the dist is stale and the resume re-runs against the same
# binary that produced the defect. Mirrors init-thin-slice-run.sh.
echo "[resume-thin-slice] rebuilding dist..."
(cd "${REPO_ROOT}" && pnpm build)

echo "[resume-thin-slice] launching CLI in resume mode..."
export JANUMICODE_EXECUTOR_UNATTENDED=1

resume_flag=""
if [[ -n "${sub_phase}" ]]; then
  resume_flag="--resume-at-sub-phase ${sub_phase}"
else
  resume_flag="--resume-at-phase ${phase}"
fi

# JANUMICODE_INSPECT: V8 inspector flag. Defaults to `--inspect` so the
# CDP harness can attach mid-run if needed. Override with explicit empty
# (`JANUMICODE_INSPECT=`) to disable. Parity with init-thin-slice-run.sh.
#
# Process management: background + wait + trap (NOT exec). Same
# rationale as init-thin-slice-run.sh — `exec node ...` replaces the
# bash supervisor and signals from a Bash tool wrapper / pipe can
# fail to reach the node process tree on Windows/Git-Bash. Keeping
# bash alive as a supervisor guarantees cleanup on SIGTERM/INT/HUP.
cleanup_child() {
  local code=$?
  if [[ -n "${node_pid:-}" ]] && kill -0 "${node_pid}" 2>/dev/null; then
    echo "[resume-thin-slice] cleanup: terminating node pid=${node_pid}" >&2
    kill -TERM "${node_pid}" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      kill -0 "${node_pid}" 2>/dev/null || break
      sleep 1
    done
    kill -KILL "${node_pid}" 2>/dev/null || true
  fi
  exit "${code}"
}
trap cleanup_child EXIT INT TERM HUP

node ${JANUMICODE_INSPECT---inspect} "${REPO_ROOT}/dist/cli/janumicode.js" run \
  --intent "@${intent_file}" \
  --workspace "${workspace}" \
  --llm-mode real \
  --auto-approve \
  --thin-slice \
  --resume-from-db "${src_db}" \
  ${resume_flag} &
node_pid=$!
wait "${node_pid}"
