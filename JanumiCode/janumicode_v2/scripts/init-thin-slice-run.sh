#!/usr/bin/env bash
# Initialize a numbered thin-slice workspace and launch a thin-slice run.
#
# A thin-slice run is end-to-end across the full workflow but with the
# decomposition tree constrained (depth=2, fanout=1, ~2 root FRs/NFRs,
# all reasoning_review on) so every sub-phase prompt template fires at
# least once in hours instead of days. Used to validate prompt templates
# between full calibration runs.
#
# This deliberately bypasses wave6-calibration-run.js — gold extraction
# is for regression artifacts, not prompt-template validation. The
# governed_stream DB itself is the validation surface; an Item 4
# reviewer pass walks it after the run completes.
#
# Usage:
#   scripts/init-thin-slice-run.sh [-n <N>] [-s <spec-path>] [-y] [--dry-run]
#
# Options:
#   -n <N>          Slice number (e.g. 3 → thin-slice-3). Defaults to one
#                   greater than the highest existing thin-slice-workspace-* dir.
#   -s <spec-path>  Source spec (defaults to the Item-3 tiny spec when it lands;
#                   falls back to the canonical Hestami product description).
#   -y              Skip confirmation.
#   --dry-run       Print actions without creating files or launching.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SLICE_ROOT="${REPO_ROOT}/test-and-evaluation/thin-slice-workspaces"
TINY_SPEC_DIR="${REPO_ROOT}/test-and-evaluation/thin-slice-specs"
HESTAMI_SPEC="${REPO_ROOT}/../janumicode/docs/Hestami AI Real Property OS and Platform Product Description.md"

# Prefer the Item-3 tiny spec when it exists; otherwise fall back to
# the Hestami doc so Item 1 is independently runnable today. The match
# excludes coverage / readme files so it picks an actual product spec.
DEFAULT_SPEC=""
if [[ -d "${TINY_SPEC_DIR}" ]]; then
  for candidate in "${TINY_SPEC_DIR}"/*.md; do
    [[ -f "${candidate}" ]] || continue
    base="$(basename "${candidate}")"
    case "${base}" in
      expected_coverage.md|README.md|readme.md) continue ;;
    esac
    DEFAULT_SPEC="${candidate}"
    break
  done
fi
if [[ -z "${DEFAULT_SPEC}" ]]; then DEFAULT_SPEC="${HESTAMI_SPEC}"; fi

slice_number=""
spec_path="${DEFAULT_SPEC}"
skip_confirm=0
dry_run=0
two_run=0
full=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) slice_number="$2"; shift 2 ;;
    -s) spec_path="$2"; shift 2 ;;
    -y) skip_confirm=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    --two-run) two_run=1; shift ;;
    --full) full=1; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "[init-thin-slice] unknown option: $1" >&2; exit 2 ;;
  esac
done

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

if ! [[ "${slice_number}" =~ ^[0-9]+$ ]]; then
  echo "[init-thin-slice] -n must be a positive integer, got: ${slice_number}" >&2
  exit 2
fi

workspace="${SLICE_ROOT}/thin-slice-workspace-${slice_number}"

if [[ -e "${workspace}" ]]; then
  echo "[init-thin-slice] workspace already exists: ${workspace}" >&2
  echo "[init-thin-slice] refusing to clobber. Pass a different -n or remove it manually." >&2
  exit 1
fi

if [[ ! -f "${spec_path}" ]]; then
  echo "[init-thin-slice] spec file not found: ${spec_path}" >&2
  exit 1
fi

spec_basename="$(basename "${spec_path}")"

echo "[init-thin-slice] slice number    : ${slice_number}"
echo "[init-thin-slice] workspace        : ${workspace}"
echo "[init-thin-slice] source spec      : ${spec_path}"

if (( dry_run )); then
  echo "[init-thin-slice] --dry-run set; no changes made."
  exit 0
fi

if (( ! skip_confirm )); then
  read -r -p "[init-thin-slice] Proceed? [y/N] " confirm
  case "${confirm}" in
    y|Y|yes|YES) ;;
    *) echo "[init-thin-slice] aborted."; exit 0 ;;
  esac
fi

mkdir -p "${workspace}/.janumicode"
intent_file="${workspace}/.janumicode/intent.md"
{
  echo "Execute the intent described in the attached document."
  echo ""
  echo "=== ATTACHED DOCUMENT: ${spec_basename} ==="
  cat "${spec_path}"
} > "${intent_file}"
echo "[init-thin-slice] wrote intent → ${intent_file} ($(wc -c < "${intent_file}") bytes)"

# Seed config from the most recent calibration workspace so LLM routing
# (orchestrator / domain_interpreter / requirements_agent / json_repair /
# reasoning_review / executor) is inherited. The --thin-slice flag
# applies decomposition overrides at runtime, on top of this seed.
CAL_ROOT="${REPO_ROOT}/test-and-evaluation/calibration-workspaces"
prior_cal_config=""
for prior in $(find "${CAL_ROOT}" -maxdepth 1 -type d -name 'calibration-workspace-cal-*' 2>/dev/null | sort -V -r); do
  prior_n="${prior##*calibration-workspace-cal-}"
  if [[ "${prior_n}" =~ ^[0-9]+$ ]] && [[ -f "${prior}/.janumicode/config.json" ]]; then
    prior_cal_config="${prior}/.janumicode/config.json"
    break
  fi
done
if [[ -n "${prior_cal_config}" ]]; then
  cp "${prior_cal_config}" "${workspace}/.janumicode/config.json"
  echo "[init-thin-slice] seeded config from ${prior_cal_config}"
else
  echo "[init-thin-slice] no prior cal config found; CLI will use defaults"
fi

# Always rebuild before launching. A thin slice costs hours of real LLM
# time — a ~3s build is rounding error against the cost of running an
# entire slice against a stale dist. ts-14/ts-15 (2026-05-18) burned
# two consecutive slices on this exact footgun: a normalizer fix in
# src/ wasn't picked up because the previous slice had populated dist/
# (so the file-existence check passed) but with a now-outdated bundle.
echo "[init-thin-slice] rebuilding dist..."
(cd "${REPO_ROOT}" && pnpm build)

echo "[init-thin-slice] launching CLI in --thin-slice mode..."
export JANUMICODE_EXECUTOR_UNATTENDED=1
# Force DIRECT better-sqlite3 (the headless CLI is plain Node, never the VS Code
# extension host). Without this, launching from a VS Code terminal leaks
# VSCODE_PID into the environment, which the DB factory misreads as
# "extension host" and selects the sidecar — whose startup ping then hangs when
# reopening an existing DB (seen on the two-run driver's run 2). Direct mode is
# what tests use and avoids the sidecar entirely.
export JANUMICODE_DB_MODE="${JANUMICODE_DB_MODE:-direct}"
# JANUMICODE_INSPECT: V8 inspector flag. Defaults to `--inspect` (port
# open, no initial pause) so the CDP harness can always attach mid-run
# if needed. Override with explicit empty (`JANUMICODE_INSPECT=`) to
# disable, or with `--inspect-brk` to pause-on-start. ts-19 demonstrated
# that --inspect-brk breaks the sidecar via execArgv propagation;
# --inspect is the safe default.
#
# Process management: launch as a background child + wait, with a trap
# that propagates kill signals down to the node process and its
# subtree (sidecar DB server is spawned as a child of node and would
# otherwise outlive the wrapper if we just `exec`ed).
#
# Why not exec: `exec node ...` replaces the bash process with node,
# which means any caller managing this process by PID via Bash tool
# wrappers / pipes (e.g. `bash script.sh | tee log`) can fail to
# deliver signals through the pipe boundary on Windows/Git-Bash. The
# background+wait+trap pattern keeps the bash supervisor alive to
# guarantee child cleanup on SIGTERM/SIGINT/EXIT.
cleanup_child() {
  local code=$?
  if [[ -n "${node_pid:-}" ]] && kill -0 "${node_pid}" 2>/dev/null; then
    echo "[init-thin-slice] cleanup: terminating node pid=${node_pid}" >&2
    kill -TERM "${node_pid}" 2>/dev/null || true
    # Give it a moment to drain; force-kill if it doesn't exit.
    for _ in 1 2 3 4 5; do
      kill -0 "${node_pid}" 2>/dev/null || break
      sleep 1
    done
    kill -KILL "${node_pid}" 2>/dev/null || true
  fi
  exit "${code}"
}
trap cleanup_child EXIT INT TERM HUP

if (( two_run )); then
  # ── TWO-RUN cross-run driver (semantic supersession + Phase 0.5) ─────
  # Two Workflow Runs share one DB so run 2's all_runs DMR sees run 1. Run 1
  # establishes + gate-certifies the governing artifacts; run 2 injects a
  # prior_decision_override of a CERTIFIED INTERFACE from run 1. Targeting an
  # interface_contracts (vs a system_boundary) exercises BOTH:
  #   (a) cross-run semantic supersession (spec §5.2 — supersedes edge + DMR
  #       supersession_chains), and
  #   (b) Phase 0.5 Cross-Run Impact Analysis (spec §4 Phase 0.5 → 6 → 9.1 →
  #       10.1), because the override changes a certified prior-run interface.
  #
  # Overridable env:
  #   JANUMICODE_TWO_RUN_LIMIT       run-1 phase-limit (default: none — run the
  #                                  FULL pipeline so run 1 EXECUTES (Phase 9)
  #                                  and writes its source files INTO THE SHARED
  #                                  WORKSPACE. This is what makes run 2 a faithful
  #                                  brownfield refactor: the prior-run files
  #                                  physically exist, so the Refactoring Tasks
  #                                  have real targets and a non-empty pre-state
  #                                  hash. Set e.g. =5 for a cheap establish-only
  #                                  run that certifies interfaces but writes no
  #                                  code (refactor tasks then have no file to
  #                                  modify — they rely solely on the inlined
  #                                  refactoring_instructions).
  #   JANUMICODE_TWO_RUN_RUN2_LIMIT  run-2 phase-limit (default: none — run the
  #                                  FULL pipeline so 0.5 → 6 (refactoring tasks)
  #                                  → 9.1 (cross_run_modification) → 10.1
  #                                  (verification) all execute).
  #   JANUMICODE_OVERRIDE_SPEC       --inject-overrides JSON (default below).
  #
  # NOTE: both runs share one --workspace AND one --db-path, so run 1's files
  # and governed-stream records are present for run 2 (true brownfield).
  shared_db="${workspace}/.janumicode/test-harness/two-run-shared.db"
  run1_limit="${JANUMICODE_TWO_RUN_LIMIT:-}"
  run2_limit="${JANUMICODE_TWO_RUN_RUN2_LIMIT:-}"
  # Default override spec kept in a single-quoted literal (its JSON braces would
  # otherwise close a ${VAR:-default} parameter-expansion early). Override the
  # whole thing via JANUMICODE_OVERRIDE_SPEC.
  #
  # afterPhase=1 is deliberate: it fires BEFORE run 2 regenerates its own
  # interface_contracts (phase 3), so the selector resolves run 1's certified
  # record — a genuine CROSS-run change (Phase 0.5 detectCrossRunImpactTrigger
  # requires the superseded record to belong to a prior run). Firing later would
  # match run 2's own fresh interface and route as a within-run override.
  override_spec='[{"afterPhase":"1","superseded":{"recordType":"artifact_produced","contentMatch":"interface_contracts"},"superseding":{"statement":"Interface revised by human override of the PRIOR run: the delete-by-key endpoint is REMOVED from the contract.","kind":"interface_contracts"}}]'
  if [[ -n "${JANUMICODE_OVERRIDE_SPEC:-}" ]]; then override_spec="${JANUMICODE_OVERRIDE_SPEC}"; fi

  echo "[init-thin-slice] TWO-RUN mode — shared DB: ${shared_db} (run1 phase-limit=${run1_limit:-none}, run2 phase-limit=${run2_limit:-none})"
  echo "[init-thin-slice] === RUN 1/2: establish + EXECUTE (writes prior-run files) + certify gates (--simulate-human-decisions) ==="
  run1_phase_limit_arg=()
  if [[ -n "${run1_limit}" ]]; then run1_phase_limit_arg=(--phase-limit "${run1_limit}"); fi
  node ${JANUMICODE_INSPECT---inspect} "${REPO_ROOT}/dist/cli/janumicode.js" run \
    --intent "@${intent_file}" \
    --workspace "${workspace}" \
    --llm-mode real \
    --auto-approve \
    --simulate-human-decisions \
    --db-path "${shared_db}" \
    "${run1_phase_limit_arg[@]}" \
    --thin-slice &
  node_pid=$!
  # A phase-limited run exits 1 (partial — the normal "gap found" virtuous-cycle
  # signal), so do NOT let `set -e` abort the driver here. Tolerate 0/1; only a
  # hard exception (>=2) aborts before run 2.
  set +e; wait "${node_pid}"; run1_code=$?; set -e
  echo "[init-thin-slice] run 1 exited ${run1_code} (0=success, 1=partial — both expected for a phase-limited establish run)"
  if (( run1_code >= 2 )); then
    echo "[init-thin-slice] run 1 hard-failed (exit ${run1_code}) — aborting two-run before run 2" >&2
    exit "${run1_code}"
  fi

  echo "[init-thin-slice] === RUN 2/2: inject prior_decision_override → Phase 0.5 cross-run impact ==="
  run2_phase_limit_arg=()
  if [[ -n "${run2_limit}" ]]; then run2_phase_limit_arg=(--phase-limit "${run2_limit}"); fi
  node ${JANUMICODE_INSPECT---inspect} "${REPO_ROOT}/dist/cli/janumicode.js" run \
    --intent "@${intent_file}" \
    --workspace "${workspace}" \
    --llm-mode real \
    --auto-approve \
    --simulate-human-decisions \
    --db-path "${shared_db}" \
    --inject-overrides "${override_spec}" \
    "${run2_phase_limit_arg[@]}" \
    --thin-slice &
  node_pid=$!
  set +e; wait "${node_pid}"; run2_code=$?; set -e
  echo "[init-thin-slice] run 2 exited ${run2_code} (0/1 expected)"

  echo "[init-thin-slice] === TWO-RUN verification (shared DB) ==="
  node "${REPO_ROOT}/scripts/verify-two-run-supersession.mjs" "${shared_db}" || true
  echo "[init-thin-slice] === PHASE 0.5 cross-run-impact verification (shared DB) ==="
  node "${REPO_ROOT}/scripts/verify-cross-run-impact.mjs" "${shared_db}" || true
  exit 0
fi

# JANUMICODE_SIMULATE_DECISIONS=1 adds --simulate-human-decisions so the run
# certifies each phase gate through the real approval path (phase_gate_approved
# + validates edges → Authority-6 elevation), exercising the DMR's
# active_constraints accumulation that is otherwise dormant headless.
# --full uses --full-slice: drops the depth/fanout caps so the run implements
# the ENTIRE intent, while KEEPING the operational rails (60-min stall window,
# forced goose_cli executor, 30-min call cap).
thin_slice_arg=(--thin-slice)
if (( full )); then
  thin_slice_arg=(--full-slice)
  echo "[init-thin-slice] FULL mode — decomposition caps DISABLED (entire intent); operational rails (goose_cli, 60-min stall, 30-min call cap) KEPT. Long run."
fi
node ${JANUMICODE_INSPECT---inspect} "${REPO_ROOT}/dist/cli/janumicode.js" run \
  --intent "@${intent_file}" \
  --workspace "${workspace}" \
  --llm-mode real \
  --auto-approve \
  ${JANUMICODE_SIMULATE_DECISIONS:+--simulate-human-decisions} \
  "${thin_slice_arg[@]}" &
node_pid=$!
wait "${node_pid}"
