#!/bin/bash
set -e

# Initialize Dolt repository if not already initialized
if [ ! -d "/var/lib/dolt/.dolt" ]; then
    echo "Initializing Dolt repository..."
    cd /var/lib/dolt
    dolt config --global --add user.email "historian@localhost"
    dolt config --global --add user.name "Historian System"
    dolt init

    # Run initialization SQL if present
    if [ -f "/docker-entrypoint-initdb.d/init.sql" ]; then
        echo "Running initialization SQL..."
        dolt sql -b < /docker-entrypoint-initdb.d/init.sql
        # Commit changes if any (may be empty if using CREATE DATABASE)
        dolt add . || true
        dolt commit -m "Initial schema setup" || echo "No changes to commit in root repo"
    fi

    echo "Dolt repository initialized."
else
    echo "Dolt repository already exists."
fi

cd /var/lib/dolt

# Start Dolt SQL server
# Note: --user and --password are deprecated in newer Dolt versions
# Dolt automatically creates a root user on first launch
# Use --allow-cleartext-passwords for pymysql compatibility
exec dolt sql-server --host=0.0.0.0 --port=3306 --allow-cleartext-passwords=true
