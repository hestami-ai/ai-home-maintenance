#!/usr/bin/env bash
# Stop a running JanumiCode workflow CLI cleanly by reading its PID file.
#
# Usage:
#   scripts/stop-workflow-run.sh <workspace-path>
#
# Example:
#   scripts/stop-workflow-run.sh test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-6
#
# Reads `<workspace>/.janumicode/run.pid` (written by the CLI at startup),
# extracts the PID, and sends SIGTERM. The CLI's signal handler removes
# the PID file and exits cleanly. If the process is unresponsive after
# 30 seconds, escalate to SIGKILL.
#
# Exit codes:
#   0 — process stopped (or wasn't running)
#   2 — PID file missing or unreadable
#   3 — process didn't stop after escalation

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <workspace-path>" >&2
  exit 2
fi

workspace="$1"
pid_file="${workspace}/.janumicode/run.pid"

if [[ ! -f "${pid_file}" ]]; then
  echo "[stop-workflow] no PID file at ${pid_file}" >&2
  echo "[stop-workflow] either the workflow isn't running, or it wasn't started via the CLI" >&2
  exit 2
fi

# Extract pid — prefer jq when available, fall back to a regex.
if command -v jq >/dev/null 2>&1; then
  pid=$(jq -r '.pid' "${pid_file}")
else
  pid=$(grep -oE '"pid"[[:space:]]*:[[:space:]]*[0-9]+' "${pid_file}" | grep -oE '[0-9]+' | head -1)
fi

if [[ -z "${pid}" || ! "${pid}" =~ ^[0-9]+$ ]]; then
  echo "[stop-workflow] could not parse PID from ${pid_file}" >&2
  exit 2
fi

# Windows note: taskkill without /F sends WM_CLOSE which a headless
# console app (our CLI) ignores — it returns "could not be terminated".
# We always use /F on Windows; the CLI's signal handlers + PID-file
# cleanup don't run on /F, but the script removes the PID file below
# after confirming exit. On Unix-like systems, send SIGTERM first
# (graceful), then escalate to SIGKILL if the process doesn't exit
# within 30 seconds (handled in the wait loop below).
if command -v taskkill >/dev/null 2>&1; then
  echo "[stop-workflow] taskkill //F //PID ${pid} (Windows force-kill)"
  taskkill //F //PID "${pid}" 2>&1 || true
else
  echo "[stop-workflow] sending SIGTERM to PID ${pid}"
  kill -TERM "${pid}" 2>&1 || true
fi

# Wait up to 30 seconds for the process to exit.
for i in $(seq 1 30); do
  if ! kill -0 "${pid}" 2>/dev/null; then
    echo "[stop-workflow] PID ${pid} stopped after ${i}s"
    # Best-effort PID file cleanup — the CLI's signal handler should
    # have done this, but if it didn't (e.g., hard kill), remove it
    # here so the next run starts clean.
    rm -f "${pid_file}" 2>/dev/null || true
    exit 0
  fi
  sleep 1
done

echo "[stop-workflow] PID ${pid} did not stop after 30s, escalating to SIGKILL" >&2
if command -v taskkill >/dev/null 2>&1; then
  taskkill //PID "${pid}" //F 2>&1 || true
else
  kill -KILL "${pid}" 2>&1 || true
fi
sleep 2

if kill -0 "${pid}" 2>/dev/null; then
  echo "[stop-workflow] PID ${pid} still running after SIGKILL — manual intervention needed" >&2
  exit 3
fi

rm -f "${pid_file}" 2>/dev/null || true
echo "[stop-workflow] PID ${pid} force-killed"
exit 0
