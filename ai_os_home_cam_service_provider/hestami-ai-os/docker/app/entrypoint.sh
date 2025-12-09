#!/bin/sh
set -e

echo "Starting Hestami AI OS..."

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
    npx prisma db push --schema=./prisma/schema.prisma --config=./prisma/prisma.config.ts --skip-generate
else
    echo "Applying database migrations (deploy mode)..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma --config=./prisma/prisma.config.ts
fi

echo "Database ready. Starting application..."

# Start the application with PM2
exec pm2-runtime ecosystem.config.cjs
