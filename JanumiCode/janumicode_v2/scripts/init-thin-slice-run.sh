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

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) slice_number="$2"; shift 2 ;;
    -s) spec_path="$2"; shift 2 ;;
    -y) skip_confirm=1; shift ;;
    --dry-run) dry_run=1; shift ;;
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

if [[ ! -f "${REPO_ROOT}/dist/cli/janumicode.js" ]]; then
  echo "[init-thin-slice] dist/cli/janumicode.js not found; building..."
  (cd "${REPO_ROOT}" && pnpm build)
fi

echo "[init-thin-slice] launching CLI in --thin-slice mode..."
export JANUMICODE_EXECUTOR_UNATTENDED=1
exec node "${REPO_ROOT}/dist/cli/janumicode.js" run \
  --intent "@${intent_file}" \
  --workspace "${workspace}" \
  --llm-mode real \
  --auto-approve \
  --thin-slice
