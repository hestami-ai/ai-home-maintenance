#!/usr/bin/env bash
#
# TRIAL: qwen3-coder:30b-a3b-q4_K_M as the Phase-9 mimo executor model.
#
# Motivation: gemma4:26b-a4b-it-qat, as the coding backing model, has not been
# following the engineering constitution (why-comments citing CC-/AC-/TECH- ids)
# in its generated output. A standalone qwen3-coder probe DID emit constitution-
# conformant code (docstrings citing CC-UTIL-001/002, TECH-AES-256-ENCRYPTION),
# so we trial it end-to-end in the real pipeline.
#
# This is Option A: no code change — the mimo `ollama-local` provider is generic
# (any model id; reasoning:false suits a NON-thinking model like qwen3-coder;
# tool_call:true for compose). The only thing that MUST be right is context:
#
#   ┌─ CRITICAL: mimo's declared limit.context MUST equal Ollama's loaded num_ctx.
#   │  - mimo side  : JANUMICODE_MIMO_OPENAI_CONTEXT=90000 (set below) → the
#   │                 ollama-local provider declares limit.context=90000 so mimo
#   │                 will not over-fill / mis-compact.
#   │  - Ollama side : qwen3-coder must be LOADED at num_ctx=90000. The mimo /v1
#   │                 (OpenAI) path does NOT send num_ctx, so pin it on the Ollama
#   │                 server (e.g. OLLAMA_CONTEXT_LENGTH=90000, or a Modelfile
#   │                 `PARAMETER num_ctx 90000`). The orchestrator gemma uses the
#   │                 native /api with an EXPLICIT num_ctx=262144, so a global
#   │                 OLLAMA_CONTEXT_LENGTH=90000 does NOT shrink gemma.
#   └─ Ollama is one-model/one-request at a time here → gemma (orchestrator) and
#      qwen3-coder (executor) SWAP the single GPU slot (load latency, no OOM).
#
# Apples-to-apples: resumes the SAME slice at Phase 9 (same packets/leaves as the
# gemma run), swapping ONLY the executor model. max_cycles is already 0 in the
# base DB, so it falls straight through to execution.
#
# Usage:  scripts/trial-qwen3-coder-executor.sh [-n <slice>] [-s <stack>] [-c <num_ctx>] [-l <max_leaves>] [-m <ollama_model>]
#   -n  thin-slice number       (default 156)
#   -s  forced stack            (default python)
#   -c  context window          (default 90000 — keep == Ollama's loaded num_ctx)
#   -l  cap executor leaves     (default: uncapped; e.g. 2 for a quick look)
#   -m  ollama model id         (default qwen3-coder:30b-a3b-q4_K_M — the executor-model
#                                bake-off lever; e.g. qwen3.6:27b-mtp-q4_K_M). NOTE: a
#                                THINKING model is fine (Ollama strips think tags from /v1
#                                content) but spends output budget thinking — keep
#                                JANUMICODE_MIMO_OPENAI_MAX_OUTPUT generous. A DENSE model
#                                uses more VRAM at a given num_ctx than an a3b MoE.
set -euo pipefail

slice=156; stack=python; ctx=90000; cap=""; model="qwen3-coder:30b-a3b-q4_K_M"
while getopts "n:s:c:l:m:" opt; do
  case "$opt" in
    n) slice="$OPTARG" ;; s) stack="$OPTARG" ;; c) ctx="$OPTARG" ;; l) cap="$OPTARG" ;; m) model="$OPTARG" ;;
    *) echo "usage: $0 [-n slice] [-s stack] [-c num_ctx] [-l max_leaves] [-m ollama_model]" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WS="${REPO_ROOT}/test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-${slice}"

echo "[trial-executor] model=${model} slice=${slice} stack=${stack} num_ctx=${ctx} cap=${cap:-none}"
echo "[trial-executor] REMINDER: ensure Ollama loads ${model} at num_ctx=${ctx} (OLLAMA_CONTEXT_LENGTH / desktop setting)."

# Clean base: drop any stale resume copy so we resume from the original base DB,
# and empty the generated project tree for a clean comparison.
if [[ -d "${WS}/.janumicode/test-harness" ]]; then
  mapfile -t resumes < <(ls -t "${WS}/.janumicode/test-harness"/resume-*.db 2>/dev/null || true)
  if (( ${#resumes[@]} > 1 )); then rm -f "${resumes[0]}" && echo "[trial-qwen3-coder] dropped stale resume DB $(basename "${resumes[0]}")"; fi
fi
rm -rf "${WS}/project"/* "${WS}/project"/.[!.]* 2>/dev/null || true
mkdir -p "${WS}/project"

export JANUMICODE_EXECUTOR_BACKING_TOOL=mimo_cli
export JANUMICODE_MIMO_MODEL="ollama-local/${model}"
export JANUMICODE_MIMO_OPENAI_CONTEXT="${ctx}"   # mimo limit.context (== Ollama num_ctx)
export JANUMICODE_FORCE_STACK="${stack}"
[[ -n "${cap}" ]] && export JANUMICODE_BAKEOFF_MAX_LEAVES="${cap}"

echo "[trial-executor] launching resume at Phase 9 (executor=${JANUMICODE_MIMO_MODEL})"
exec bash "${REPO_ROOT}/scripts/resume-thin-slice-run.sh" -n "${slice}" -p 9 -y
