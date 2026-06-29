#!/usr/bin/env bash
# Initialize a numbered calibration workspace and launch a full-intent calibration run.
#
# The launcher is MODEL-AGNOSTIC: -m sets the model for the 3 main planning roles
# (orchestrator / domain_interpreter / requirements_agent) and the Phase-9 executor
# defaults to the SAME model via the local Ollama provider. It writes an EXPLICIT
# .janumicode/config.json (it no longer seeds from a prior cal workspace — the legacy
# cal-* runs require no backwards-compat and will be deleted).
#
# Usage:
#   scripts/init-calibration-run.sh [-n <N>] [-s <spec-path>] [-m <model>]
#                                   [-x <executor-model-ref>] [-c <ctx>] [-X <executor-backing>]
#                                   [-y] [--dry-run] [-- <extra-args-for-wave6>]
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) cal_number="$2"; shift 2 ;;
    -s) spec_path="$2"; shift 2 ;;
    -m) planning_model="$2"; shift 2 ;;
    -x) executor_model="$2"; shift 2 ;;
    -c) executor_context="$2"; shift 2 ;;
    -X) executor_backing="$2"; shift 2 ;;
    -y) skip_confirm=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    --) shift; forwarded_args=("$@"); break ;;
    -h|--help) sed -n '2,38p' "$0"; exit 0 ;;
    *) echo "[init-cal] unknown option: $1" >&2; exit 2 ;;
  esac
done
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
# would break json_repair's required temp-0 determinism). The executor backing is
# documentary here — the env vars exported below are authoritative for mimo.
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
