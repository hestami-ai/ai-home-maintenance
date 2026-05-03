#!/usr/bin/env bash
# Initialize a numbered calibration workspace and launch a calibration run.
#
# Usage:
#   scripts/init-calibration-run.sh [-n <N>] [-s <spec-path>] [-- <extra-args-for-wave6>]
#
# Options:
#   -n <N>           Calibration number (e.g. 26 → cal-26). Defaults to
#                    one greater than the highest existing calibration-workspace-cal-* dir.
#   -s <spec-path>   Override the source spec file. Defaults to the canonical
#                    Hestami product description in ../janumicode/docs/.
#   -y               Skip confirmation prompt.
#   --dry-run        Print actions without creating files or launching.
#
# Anything after `--` is forwarded verbatim to scripts/wave6-calibration-run.js.
# Examples:
#   scripts/init-calibration-run.sh                          # next cal, default spec
#   scripts/init-calibration-run.sh -n 26                    # explicit cal-26
#   scripts/init-calibration-run.sh -- --budget-cap 5000     # forward to wave6
#   scripts/init-calibration-run.sh -- --llama-swap          # llama-swap mode

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

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) cal_number="$2"; shift 2 ;;
    -s) spec_path="$2"; shift 2 ;;
    -y) skip_confirm=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    --) shift; forwarded_args=("$@"); break ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "[init-cal] unknown option: $1" >&2; exit 2 ;;
  esac
done

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

# Seed a baseline .janumicode/config.json from the most recent prior cal
# workspace. wave6-calibration-run.js's patchConfigFlag only sets the
# `reasoning_review` and (optionally) `decomposition.budget_cap` slots — it
# leaves orchestrator / domain_interpreter / requirements_agent / json_repair
# / executor untouched. Without explicit routing for those roles, the runtime
# falls back to a llama-swap-style default (port 11435) and Phase 1 dies on
# ECONNREFUSED. Inheriting from the previous cal keeps the ollama/qwen routing
# intact across runs.
prior_cal_config=""
for prior in $(find "${CAL_ROOT}" -maxdepth 1 -type d -name 'calibration-workspace-cal-*' 2>/dev/null | sort -V -r); do
  prior_n="${prior##*calibration-workspace-cal-}"
  if [[ "${prior_n}" =~ ^[0-9]+$ ]] && (( prior_n < cal_number )) && [[ -f "${prior}/.janumicode/config.json" ]]; then
    prior_cal_config="${prior}/.janumicode/config.json"
    break
  fi
done

mkdir -p "${workspace}/.janumicode"
if [[ -n "${prior_cal_config}" ]]; then
  cp "${prior_cal_config}" "${workspace}/.janumicode/config.json"
  echo "[init-cal] seeded config from ${prior_cal_config}"
else
  echo "[init-cal] no prior cal config found; wave6 will write a fresh one (may need manual routing)"
fi

# Verify the CLI bundle is built before invoking wave6 (which would also fail,
# but a clearer message up front saves a confused operator).
if [[ ! -f "${REPO_ROOT}/dist/cli/janumicode.js" ]]; then
  echo "[init-cal] dist/cli/janumicode.js not found; building first..."
  ( cd "${REPO_ROOT}" && pnpm build )
fi

echo "[init-cal] launching wave6-calibration-run.js..."
exec node "${SCRIPT_DIR}/wave6-calibration-run.js" \
  --intent "${intent_string}" \
  --workspace "${workspace}" \
  "${forwarded_args[@]}"
