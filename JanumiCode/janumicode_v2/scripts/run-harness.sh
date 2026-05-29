#!/usr/bin/env bash
# Prompt-iteration harness for the JanumiCode v2 workflow.
#
# Goal: a fast end-to-end pass that exercises each prompt template at
# least once via the existing --thin-slice depth=2 fanout=1 constraint,
# but strips out the noise layers that dominate iteration time when the
# bug under investigation is in a proposer template:
#
#   - reasoning_review harness (10-15 validator LLM calls per sub-phase)
#   - Stage III ingestion (1-2 LLM calls per artifact_produced record)
#
# The audit-pause stays ON by default — the auditor (Claude) walks each
# sub-phase boundary, does the inline audit, and acks with action:continue
# or action:abort. The pause IS the audit gate; turning it off would
# remove the visibility that's the entire point.
#
# Usage:
#   scripts/run-harness.sh [-n <slice-number>] [-s <spec-path>] [-y]
#                          [--no-gatekeeper] [--no-pause]
#
# Options:
#   -n <N>            Slice number (defaults to next sequential).
#   -s <spec-path>    Source spec (defaults to tinyurl thin-slice spec).
#   -y                Skip confirmation.
#   --no-gatekeeper   Disable scope_gatekeeper (default: ON — so each
#                     bloom output gets cross-checked against the
#                     accepted upstream sets; ts-109 documented the
#                     cost of letting expansive blooms through).
#   --no-pause        Disable audit pause (un-attended mode — only useful
#                     for full smoke runs, not for iteration).
#
# What the harness does NOT change:
#   - --thin-slice (depth=2 fanout=1) still applies — each decomposition
#     template fires at root + 1 child + 1 grandchild.
#   - JSON repair, json_repair_record, llm_api_failure/recovery records
#     all still fire (these are inputs to template debugging).
#   - Deterministic verifiers (coverage_verifier, 1.8 release verifier)
#     still run — they're free.
#   - Audit pause defaults to ON so Claude can audit each sub-phase.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SLICE_ROOT="${REPO_ROOT}/test-and-evaluation/thin-slice-workspaces"
TINYURL_SPEC="${REPO_ROOT}/test-and-evaluation/thin-slice-specs/tinyurl-thin-slice.md"

slice_number=""
spec_path="${TINYURL_SPEC}"
skip_confirm=0
no_gatekeeper=0
no_pause=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) slice_number="$2"; shift 2 ;;
    -s) spec_path="$2"; shift 2 ;;
    -y) skip_confirm=1; shift ;;
    --no-gatekeeper) no_gatekeeper=1; shift ;;
    --no-pause) no_pause=1; shift ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "[harness] unknown option: $1" >&2; exit 2 ;;
  esac
done

# Auto-pick next slice number when not specified.
if [[ -z "${slice_number}" ]]; then
  highest=0
  if [[ -d "${SLICE_ROOT}" ]]; then
    while IFS= read -r dir; do
      n="${dir##*thin-slice-workspace-}"
      if [[ "${n}" =~ ^[0-9]+$ ]] && (( n > highest )); then
        highest=$n
      fi
    done < <(find "${SLICE_ROOT}" -maxdepth 1 -type d -name 'thin-slice-workspace-*' 2>/dev/null)
  fi
  slice_number=$((highest + 1))
fi

# Harness env profile.
export JANUMICODE_REVIEW_ENABLED=false              # disable reasoning_review harness hook
export JANUMICODE_INGESTION_STAGE3_OFF=1            # skip per-record Stage III LLM calls
if (( no_pause )); then
  export JANUMICODE_AUDIT_PAUSE=0
else
  export JANUMICODE_AUDIT_PAUSE=1                   # default: audit pause ON for Claude review
fi
if (( no_gatekeeper )); then
  export JANUMICODE_SCOPE_GATEKEEPER=off
else
  export JANUMICODE_SCOPE_GATEKEEPER=on             # default: gatekeeper ON — Phase 1 + Phase 2/4/6/7 cross-checks
fi

echo "[harness] profile:"
echo "[harness]   JANUMICODE_REVIEW_ENABLED       = ${JANUMICODE_REVIEW_ENABLED}"
echo "[harness]   JANUMICODE_INGESTION_STAGE3_OFF = ${JANUMICODE_INGESTION_STAGE3_OFF}"
echo "[harness]   JANUMICODE_AUDIT_PAUSE          = ${JANUMICODE_AUDIT_PAUSE}"
echo "[harness]   JANUMICODE_SCOPE_GATEKEEPER     = ${JANUMICODE_SCOPE_GATEKEEPER}"
echo "[harness]   slice number                    = ${slice_number}"
echo "[harness]   spec                            = ${spec_path}"

if (( ! skip_confirm )); then
  read -r -p "[harness] Proceed? [y/N] " confirm
  case "${confirm}" in
    y|Y|yes|YES) ;;
    *) echo "[harness] aborted."; exit 0 ;;
  esac
fi

# Delegate to the existing init-thin-slice runner.
#
# Use `exec` so this bash process is REPLACED by the init script's
# bash (PID stays the same). This collapses the multi-bash supervisor
# chain to a single supervisor, which the node parent-watcher can
# reliably detect when killed.
#
# History: an earlier version used `bash ... & wait` here with a
# cleanup trap. That created TWO bash supervisors (this one + the
# init script's). Killing the outer one via TerminateProcess
# (Bash tool TaskStop on Windows) bypassed the trap AND left the
# inner bash + node + sidecar as orphans, because node's
# parent-watcher only watches its direct parent (the inner bash),
# which stays alive. Collapsing to one bash supervisor fixes both:
# the bash trap MAY fire on SIGTERM, and if not, node's watcher
# sees its direct parent gone and self-exits.
exec bash "${SCRIPT_DIR}/init-thin-slice-run.sh" -n "${slice_number}" -s "${spec_path}" -y
