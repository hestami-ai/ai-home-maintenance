#!/usr/bin/env bash
# Hard-cleanup hammer: find every JanumiCode-related process (CLI,
# sidecar DB server, supervising bash scripts) and terminate them.
#
# Why this exists: on Windows the standard Bash-tool TaskStop /
# Ctrl-C / kill-the-wrapper paths do not reliably collapse the
# multi-level bash → bash → node → sidecar tree. TerminateProcess
# bypasses bash traps, and intermediate bashes that are blocked in
# `wait $!` survive their parent's death. This script is the brute-
# force fallback.
#
# Usage:
#   scripts/stop-harness.sh        # kill all JC processes
#   scripts/stop-harness.sh --dry  # list what would be killed
#
# Matches:
#   - node procs running janumicode.js or sidecar/dbServer.js
#   - bash procs running init-thin-slice-run.sh, resume-thin-slice-run.sh,
#     or run-harness.sh
#
# Idempotent — safe to run when nothing is alive.

set -uo pipefail

dry=0
if [[ "${1:-}" == "--dry" ]] || [[ "${1:-}" == "--dry-run" ]]; then
  dry=1
fi

# Pattern matched against the process command-line. Order matters only
# for readability — we collect all matches then taskkill them all.
PATTERNS=(
  'janumicode\.js'
  'sidecar/dbServer\.js'
  'init-thin-slice-run\.sh'
  'resume-thin-slice-run\.sh'
  'run-harness\.sh'
)

# Detect Windows (Git Bash / MSYS).
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) is_windows=1 ;;
  *) is_windows=0 ;;
esac

if (( is_windows )); then
  # Iterate node + bash processes; check command-line; collect matching PIDs.
  collect_pids() {
    local image="$1"
    tasklist //FI "IMAGENAME eq ${image}" //NH 2>/dev/null | awk '{print $2}' | while read -r pid; do
      [[ -z "${pid}" ]] && continue
      [[ "${pid}" =~ ^[0-9]+$ ]] || continue
      local cmd
      cmd=$(wmic process where "processid=${pid}" get commandline 2>/dev/null | tail -2 | head -1 | tr -d '\r')
      for pat in "${PATTERNS[@]}"; do
        if echo "${cmd}" | grep -qE "${pat}"; then
          echo "${pid}"
          break
        fi
      done
    done
  }
  mapfile -t targets < <( { collect_pids node.exe; collect_pids bash.exe; } | sort -u )
else
  # POSIX: pgrep-style match on full command line.
  collect_unix() {
    local pat="$1"
    pgrep -f "${pat}" 2>/dev/null || true
  }
  mapfile -t targets < <(
    for pat in "${PATTERNS[@]}"; do collect_unix "${pat}"; done | sort -u
  )
fi

if (( ${#targets[@]} == 0 )); then
  echo "[stop-harness] no JanumiCode processes alive."
  exit 0
fi

echo "[stop-harness] targets:"
for pid in "${targets[@]}"; do
  if (( is_windows )); then
    cmd=$(wmic process where "processid=${pid}" get commandline 2>/dev/null | tail -2 | head -1 | tr -d '\r' | head -c 140)
  else
    cmd=$(ps -p "${pid}" -o args= 2>/dev/null | head -c 140)
  fi
  printf "  %-8s  %s\n" "${pid}" "${cmd}"
done

if (( dry )); then
  echo "[stop-harness] --dry: nothing killed."
  exit 0
fi

# Kill — Windows: taskkill /F /T (tree) for each. POSIX: kill -TERM then -KILL.
for pid in "${targets[@]}"; do
  if (( is_windows )); then
    taskkill //F //T //PID "${pid}" 2>&1 | head -1
  else
    kill -TERM "${pid}" 2>/dev/null || true
  fi
done

# Brief settle window for graceful exits.
sleep 2

# Force-kill survivors.
for pid in "${targets[@]}"; do
  if (( is_windows )); then
    if tasklist //FI "PID eq ${pid}" //NH 2>/dev/null | grep -qE "node|bash"; then
      taskkill //F //PID "${pid}" 2>&1 | head -1
    fi
  else
    kill -KILL "${pid}" 2>/dev/null || true
  fi
done

echo "[stop-harness] done."
