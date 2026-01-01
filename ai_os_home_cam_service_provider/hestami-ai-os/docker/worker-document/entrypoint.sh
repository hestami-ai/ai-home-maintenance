#!/bin/bash
set -e

# ClamAV update interval in hours (default: 6)
UPDATE_INTERVAL_HOURS=${CLAMAV_UPDATE_INTERVAL_HOURS:-6}
UPDATE_INTERVAL_SECONDS=$((UPDATE_INTERVAL_HOURS * 3600))

# Function to update ClamAV definitions
update_clamav() {
    echo "[ClamAV] Updating virus definitions..."
    if freshclam --config-file=/etc/clamav/freshclam.conf; then
        echo "[ClamAV] Update successful"
    else
        echo "[ClamAV] Update failed (may be rate-limited or network issue)"
    fi
}

# Function to run periodic updates in background
run_periodic_updates() {
    while true; do
        sleep $UPDATE_INTERVAL_SECONDS
        update_clamav
    done
}

# Check if ClamAV database exists, if not do initial download
if [ ! -f /var/lib/clamav/main.cvd ] && [ ! -f /var/lib/clamav/main.cld ]; then
    echo "[ClamAV] No virus definitions found, performing initial download..."
    update_clamav
else
    echo "[ClamAV] Virus definitions found, skipping initial download"
    # Check age of definitions and update if older than interval
    if [ -f /var/lib/clamav/main.cvd ]; then
        DB_AGE=$(( $(date +%s) - $(stat -c %Y /var/lib/clamav/main.cvd) ))
        if [ $DB_AGE -gt $UPDATE_INTERVAL_SECONDS ]; then
            echo "[ClamAV] Definitions are older than ${UPDATE_INTERVAL_HOURS}h, updating..."
            update_clamav
        fi
    fi
fi

# Start periodic update process in background
echo "[ClamAV] Starting periodic updates every ${UPDATE_INTERVAL_HOURS} hours"
run_periodic_updates &

# Start the main application
exec uvicorn server:app --host 0.0.0.0 --port 8000
