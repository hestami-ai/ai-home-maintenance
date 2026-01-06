#!/bin/sh
set -e

echo "Starting Hestami AI OS (Bun runtime)..."

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Database schema sync strategy:
# - Development (PRISMA_MIGRATE_MODE=push): Use db push for rapid iteration
# - Production (PRISMA_MIGRATE_MODE=deploy or unset): Use migrate deploy for safety

MIGRATE_MODE="${PRISMA_MIGRATE_MODE:-deploy}"

if [ "$MIGRATE_MODE" = "push" ]; then
    echo "Syncing database schema (push mode)..."
    bunx prisma db push --schema=./prisma/schema.prisma --config=./prisma/prisma.config.ts --skip-generate
else
    echo "Applying database migrations (deploy mode)..."
    bunx prisma migrate deploy --schema=./prisma/schema.prisma --config=./prisma/prisma.config.ts
fi

echo "Database ready. Starting application..."

# Start the application with Bun runtime
# - Single process per container (no PM2 clustering)
# - OTel SDK initialized in app startup (hooks.server.ts imports telemetry-init.ts)
# - App runs as PID 1 for proper signal handling
exec bun ./build/index.js
