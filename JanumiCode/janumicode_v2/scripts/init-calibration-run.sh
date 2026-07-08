#!/usr/bin/env bash
# Initialize a numbered calibration workspace and launch a full-intent calibration run.
#
# The launcher is MODEL-AGNOSTIC: -m sets the model for the 3 main planning roles
# (orchestrator / domain_interpreter / requirements_agent) and the Phase-9 executor
# defaults to the SAME model via the local Ollama provider. It writes an EXPLICIT
# .janumicode/config.json (it no longer seeds from a prior cal workspace — the legacy
# cal-* runs require no backwards-compat and will be deleted).
#
# Usage (fresh run):
#   scripts/init-calibration-run.sh [-n <N>] [-s <spec-path>] [-m <model>]
#                                   [-x <executor-model-ref>] [-c <ctx>] [-X <executor-backing>]
#                                   [-y] [--dry-run] [-- <extra-args-for-wave6>]
#
# Usage (resume after a stop-and-fix — re-run cal-N from a phase/sub-phase):
#   scripts/init-calibration-run.sh -R <N> (-S <sub-phase> | -P <phase>) [-x <exec>] [-y]
#   e.g.  scripts/init-calibration-run.sh -R 39 -S user_journey_bloom -y
#
# Options:
#   -n <N>           Calibration number (e.g. 29 → cal-29). Defaults to
#                    one greater than the highest existing calibration-workspace-cal-* dir.
#   -s <spec-path>   Override the source spec file. Defaults to the canonical
#                    Hestami product description in ../janumicode/docs/.
#   -m <model>       Ollama model for orchestrator/domain_interpreter/requirements_agent
#                    (the "LLM API call" roles). Default: gemma4:31b-it-qat. Aux roles
#                    are fixed (reasoning_review=gemma4:e4b, json_repair=qwen3.5:9b).
#   -x <ref>         Phase-9 executor (mimo) model ref. Default: ollama-local/<-m model>.
#   -c <ctx>         Executor context window (== Ollama's loaded num_ctx). Default 131072.
#   -X <backing>     Executor backing tool. Default mimo_cli.
#   -R <N>           RESUME cal-N (reuses its workspace/config/intent + latest DB)
#                    instead of a fresh run. Requires -S or -P. The CLI rolls back
#                    records at-or-after the cutoff + re-executes their pipeline
#                    (cached LLM calls replay). By default Phase 6/7/8 re-run their
#                    INCREMENTAL cycle-delta path once the run has cycled; add -F to
#                    force full regeneration when a fix lives in the main generator.
#   -S <sub-phase>   Resume at this sub-phase (e.g. user_journey_bloom); precedence over -P.
#   -P <phase>       Resume at this phase (e.g. 1).
#   -F               Force full re-execution on resume: zero the cycle counter so
#                    Phase 6/7/8 run their full execute() path (generation +
#                    gatekeepers), not the cycle-delta orphan path. Use when the fix
#                    must be exercised through the main generator (e.g. a Phase-7
#                    test-plan gatekeeper change).
#   -y               Skip confirmation prompt.
#   --dry-run        Print actions without creating files or launching.
#
# Anything after `--` is forwarded verbatim to scripts/wave6-calibration-run.js.
# Examples:
#   scripts/init-calibration-run.sh -y                       # next cal, default spec + models
#   scripts/init-calibration-run.sh -n 29 -m gemma4:31b-it-qat -y
#   scripts/init-calibration-run.sh -- --budget-cap 5000     # forward to wave6
#
# Prereq: Ollama's server default context length must be 131072 (the mimo /v1 executor
# does NOT forward num_ctx), and -m / aux / embedding models must be pulled.

set -euo pipefail

# Resolve repo root (parent of scripts/) regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

CAL_ROOT="${REPO_ROOT}/test-and-evaluation/calibration-workspaces"
DEFAULT_SPEC="${REPO_ROOT}/../janumicode/docs/Hestami AI Real Property OS and Platform Product Description.md"
SPEC_SLUG="hestami-ai-real-property-os"

cal_number=""
spec_path="${DEFAULT_SPEC}"
skip_confirm=0
dry_run=0
forwarded_args=()
# Model routing (parameterized; legacy cal runs need no backwards-compat). -m sets
# the 3 main planning roles; the executor defaults to the same model via the local
# (Ollama OpenAI-compatible) provider. Aux roles are fixed defaults below.
planning_model="gemma4:31b-it-qat"
executor_backing="mimo_cli"
executor_model=""
executor_context="131072"
# Resume mode (stop-and-fix): re-run an existing cal-N from a phase/sub-phase
# instead of a cold start. Only valid when the fix does NOT change how upstream
# artifacts are GENERATED (post-processing/validation fixes only) — cached LLM
# calls replay; the affected deterministic step + downstream re-execute.
resume_cal=""
resume_phase=""
resume_sub_phase=""
resume_reset_cycles=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) cal_number="$2"; shift 2 ;;
    -s) spec_path="$2"; shift 2 ;;
    -m) planning_model="$2"; shift 2 ;;
    -x) executor_model="$2"; shift 2 ;;
    -c) executor_context="$2"; shift 2 ;;
    -X) executor_backing="$2"; shift 2 ;;
    -R) resume_cal="$2"; shift 2 ;;
    -P) resume_phase="$2"; shift 2 ;;
    -S) resume_sub_phase="$2"; shift 2 ;;
    -F) resume_reset_cycles=1; shift ;;
    -y) skip_confirm=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    --) shift; forwarded_args=("$@"); break ;;
    -h|--help) sed -n '2,53p' "$0"; exit 0 ;;
    *) echo "[init-cal] unknown option: $1" >&2; exit 2 ;;
  esac
done

# ── Resume mode ─────────────────────────────────────────────────────
# Resume an existing cal-N after a stop-and-fix, re-running only the affected
# deterministic step + downstream against the existing workspace DB (cached LLM
# calls replay). Reuses cal-N's workspace / config.json / intent.md verbatim —
# so the fix must NOT change how UPSTREAM artifacts are GENERATED.
if [[ -n "${resume_cal}" ]]; then
  if [[ -z "${resume_phase}" && -z "${resume_sub_phase}" ]]; then
    echo "[init-cal] resume (-R <N>) requires -P <phase> or -S <sub-phase>" >&2; exit 2
  fi
  resume_ws="${CAL_ROOT}/calibration-workspace-cal-${resume_cal}"
  [[ -d "${resume_ws}" ]] || { echo "[init-cal] resume workspace not found: ${resume_ws}" >&2; exit 1; }
  resume_db="$(ls -t "${resume_ws}/.janumicode/test-harness/"*.db 2>/dev/null | head -n1 || true)"
  [[ -n "${resume_db}" ]] || { echo "[init-cal] no run DB under ${resume_ws}/.janumicode/test-harness/" >&2; exit 1; }
  resume_intent="${resume_ws}/.janumicode/intent.md"
  resume_config="${resume_ws}/.janumicode/config.json"
  # Executor model: -x wins; else read it from the run's own config.json so the
  # resumed executor matches the original (awk finds the model on the executor line).
  if [[ -z "${executor_model}" ]]; then
    executor_model="$(awk '/"executor"/{f=1} f&&/"model"/{sub(/.*"model"[[:space:]]*:[[:space:]]*"/,"");sub(/".*/,"");print;exit}' "${resume_config}" 2>/dev/null || true)"
  fi
  executor_model="${executor_model:-ollama-local/${planning_model}}"
  resume_args=(--resume-from-db "${resume_db}")
  if [[ -n "${resume_sub_phase}" ]]; then
    resume_args+=(--resume-at-sub-phase "${resume_sub_phase}")
    resume_target="sub-phase ${resume_sub_phase}"
  else
    resume_args+=(--resume-at-phase "${resume_phase}")
    resume_target="phase ${resume_phase}"
  fi
  if (( resume_reset_cycles )); then
    resume_args+=(--resume-reset-cycles)
    resume_target="${resume_target} (full re-execution: cycle counter reset)"
  fi
  echo "[init-cal] RESUME cal-${resume_cal}"
  echo "[init-cal] workspace   : ${resume_ws}"
  echo "[init-cal] resume DB   : ${resume_db}"
  echo "[init-cal] resume at   : ${resume_target}"
  echo "[init-cal] executor    : ${executor_backing}  model=${executor_model}  ctx=${executor_context}"
  if (( dry_run )); then echo "[init-cal] --dry-run set; would resume as above. No changes made."; exit 0; fi
  if (( ! skip_confirm )); then
    read -r -p "[init-cal] Proceed with resume? [y/N] " confirm
    case "${confirm}" in y|Y|yes|YES) ;; *) echo "[init-cal] aborted."; exit 0 ;; esac
  fi
  export JANUMICODE_EXECUTOR_BACKING_TOOL="${executor_backing}"
  export JANUMICODE_MIMO_MODEL="${executor_model}"
  export JANUMICODE_MIMO_OPENAI_CONTEXT="${executor_context}"
  export JANUMICODE_MIMO_OPENAI_MAX_OUTPUT="${JANUMICODE_MIMO_OPENAI_MAX_OUTPUT:-32768}"
  export JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S="${JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S:-3600}"
  if [[ ! -f "${REPO_ROOT}/dist/cli/janumicode.js" ]]; then
    echo "[init-cal] dist/cli/janumicode.js not found; building first..."
    ( cd "${REPO_ROOT}" && pnpm build )
  fi
  echo "[init-cal] launching wave6-calibration-run.js (resume)..."
  exec node "${SCRIPT_DIR}/wave6-calibration-run.js" \
    --intent "${resume_intent}" \
    --workspace "${resume_ws}" \
    "${resume_args[@]}" \
    "${forwarded_args[@]}"
fi

# Executor model defaults to the planning model via the local provider.
executor_model="${executor_model:-ollama-local/${planning_model}}"

# Auto-detect next cal number if not provided.
if [[ -z "${cal_number}" ]]; then
  highest=0
  if [[ -d "${CAL_ROOT}" ]]; then
    while IFS= read -r dir; do
      n="${dir##*calibration-workspace-cal-}"
      # Strip non-numeric suffixes (e.g. "22b", "21 - Copy") — only pure integers count.
      if [[ "${n}" =~ ^[0-9]+$ ]] && (( n > highest )); then
        highest=$n
      fi
    done < <(find "${CAL_ROOT}" -maxdepth 1 -type d -name 'calibration-workspace-cal-*' 2>/dev/null)
  fi
  cal_number=$((highest + 1))
fi

if ! [[ "${cal_number}" =~ ^[0-9]+$ ]]; then
  echo "[init-cal] -n must be a positive integer, got: ${cal_number}" >&2
  exit 2
fi

workspace="${CAL_ROOT}/calibration-workspace-cal-${cal_number}"

if [[ -e "${workspace}" ]]; then
  echo "[init-cal] workspace already exists: ${workspace}" >&2
  echo "[init-cal] refusing to clobber. Pass a different -n or remove it manually." >&2
  exit 1
fi

if [[ ! -f "${spec_path}" ]]; then
  echo "[init-cal] spec file not found: ${spec_path}" >&2
  exit 1
fi

spec_basename="$(basename "${spec_path}")"
target_spec_dir="${workspace}/specs/${SPEC_SLUG}"
target_spec="${target_spec_dir}/${spec_basename}"

# Intent file path. Filled in after the spec is copied; Phase 0's
# external_reference_resolution does NOT inject file contents into the
# intent block, so we inline the spec under an `=== ATTACHED DOCUMENT ===`
# marker (the convention cal-25 used) and pass the file path to wave6,
# which expands it to the file's contents.
intent_string=""

echo "[init-cal] cal number      : ${cal_number}"
echo "[init-cal] workspace        : ${workspace}"
echo "[init-cal] source spec      : ${spec_path}"
echo "[init-cal] target spec      : ${target_spec}"
echo "[init-cal] planning model   : ${planning_model}  (orchestrator/domain_interpreter/requirements_agent)"
echo "[init-cal] executor         : ${executor_backing}  model=${executor_model}  ctx=${executor_context}"
echo "[init-cal] intent file      : (will be written to ${workspace}/.janumicode/intent.md)"
if [[ ${#forwarded_args[@]} -gt 0 ]]; then
  echo "[init-cal] forwarded args   : ${forwarded_args[*]}"
fi

if (( dry_run )); then
  echo "[init-cal] --dry-run set; no changes made."
  exit 0
fi

if (( ! skip_confirm )); then
  read -r -p "[init-cal] Proceed? [y/N] " confirm
  case "${confirm}" in
    y|Y|yes|YES) ;;
    *) echo "[init-cal] aborted."; exit 0 ;;
  esac
fi

mkdir -p "${target_spec_dir}"
cp "${spec_path}" "${target_spec}"
echo "[init-cal] copied spec → ${target_spec}"

# Build an intent.md with the spec inlined under the convention Phase 0
# expects ("=== ATTACHED DOCUMENT: <basename> ==="). Phase 0's
# external_reference_resolution does NOT inject file content into the
# intent block — it persists referenced files as separate ingestion
# records that the orchestrator/intent_quality_check role can't see at
# inference time. cal-25 worked because its operator pre-resolved the
# document inline; replicating that shape here.
mkdir -p "${workspace}/.janumicode"
intent_file="${workspace}/.janumicode/intent.md"
{
  echo "Execute the intent described in the attached document."
  echo ""
  echo "=== ATTACHED DOCUMENT: ${spec_basename} ==="
  cat "${spec_path}"
} > "${intent_file}"
echo "[init-cal] wrote intent → ${intent_file} ($(wc -c < "${intent_file}") bytes)"
intent_string="${intent_file}"

# Write an EXPLICIT .janumicode/config.json (no longer seeded from a prior cal —
# legacy cal-* runs need no backwards-compat). Every role needs explicit routing or
# the runtime falls back to a llama-swap default (port 11435) and Phase 1 dies on
# ECONNREFUSED. The 3 planning roles use -m via direct_llm_api/ollama; aux roles are
# fixed (reasoning_review=gemma4:e4b — wave6 re-asserts this; json_repair=qwen3.5:9b,
# kept non-gemma because the ollama provider pins all gemma calls to temp 1, which
# would break json_repair's required temp-0 determinism). reconnaissance is its OWN
# role (Phase-9 stack/topology judgment) routed to the CAPABLE planning model, not
# the 4B reasoning_review reviewer — else recon over-decomposes greenfield into
# microservices. The executor backing is documentary here — the env vars exported
# below are authoritative for mimo.
mkdir -p "${workspace}/.janumicode"
cat > "${workspace}/.janumicode/config.json" <<JSON
{
  "decomposition": {
    "reasoning_review_on_tier_c": true,
    "budget_cap": 5000,
    "component_budget_cap": 1000,
    "task_budget_cap": 1500,
    "data_model_budget_cap": 800,
    "test_budget_cap": 1500
  },
  "execution": {
    "auto_approve_wave_gates": true,
    "unattended_skip_permissions": true,
    "leaf_retry_budget": 2,
    "deferred_retry_budget": 2,
    "tests_per_leaf": {
      "enabled": true,
      "test_command_resolution": "package_json_scripts",
      "timeout_ms": 180000
    }
  },
  "llm_routing": {
    "orchestrator":       { "primary": { "backing_tool": "direct_llm_api", "provider": "ollama", "model": "${planning_model}" }, "temperature": 1 },
    "domain_interpreter": { "primary": { "backing_tool": "direct_llm_api", "provider": "ollama", "model": "${planning_model}" }, "temperature": 1 },
    "requirements_agent": { "primary": { "backing_tool": "direct_llm_api", "provider": "ollama", "model": "${planning_model}" }, "temperature": 1 },
    "reasoning_review":   { "primary": { "provider": "ollama", "model": "gemma4:e4b" }, "temperature": 1, "trace_max_tokens": 8000 },
    "reconnaissance":     { "primary": { "provider": "ollama", "model": "${planning_model}" }, "temperature": 0.2 },
    "json_repair":        { "primary": { "provider": "ollama", "model": "qwen3.5:9b" }, "fallback": { "provider": "ollama", "model": "gemma4:e4b" }, "temperature": 0, "fallback_temperature": 0 },
    "executor":           { "primary": { "backing_tool": "${executor_backing}", "model": "${executor_model}" }, "temperature": 1 }
  }
}
JSON
echo "[init-cal] wrote explicit config → ${workspace}/.janumicode/config.json (planning=${planning_model})"

# Verify the CLI bundle is built before invoking wave6 (which would also fail,
# but a clearer message up front saves a confused operator).
if [[ ! -f "${REPO_ROOT}/dist/cli/janumicode.js" ]]; then
  echo "[init-cal] dist/cli/janumicode.js not found; building first..."
  ( cd "${REPO_ROOT}" && pnpm build )
fi

# Executor wiring (authoritative for the mimo path — JANUMICODE_EXECUTOR_BACKING_TOOL
# overrides config.executor.backing_tool; the mimo model comes from JANUMICODE_MIMO_MODEL,
# not config). wave6 spawns the CLI with the inherited env, so these flow through.
#   - MIMO_OPENAI_CONTEXT must equal Ollama's loaded num_ctx (mimo /v1 doesn't forward it).
#   - IDLE_TIMEOUT_S: a 1h no-SSE-progress backstop for the long uncapped run (vs the 24h
#     default) so a stuck leaf aborts without hanging the run for a day.
export JANUMICODE_EXECUTOR_BACKING_TOOL="${executor_backing}"
export JANUMICODE_MIMO_MODEL="${executor_model}"
export JANUMICODE_MIMO_OPENAI_CONTEXT="${executor_context}"
export JANUMICODE_MIMO_OPENAI_MAX_OUTPUT="${JANUMICODE_MIMO_OPENAI_MAX_OUTPUT:-32768}"
export JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S="${JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S:-3600}"

echo "[init-cal] executor env     : backing=${JANUMICODE_EXECUTOR_BACKING_TOOL} model=${JANUMICODE_MIMO_MODEL} ctx=${JANUMICODE_MIMO_OPENAI_CONTEXT} idle=${JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S}s"
echo "[init-cal] launching wave6-calibration-run.js..."
exec node "${SCRIPT_DIR}/wave6-calibration-run.js" \
  --intent "${intent_string}" \
  --workspace "${workspace}" \
  "${forwarded_args[@]}"
