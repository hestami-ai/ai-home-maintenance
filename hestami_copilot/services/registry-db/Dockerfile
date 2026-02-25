# Registry Database
# PostgreSQL for model registry, decisions, and specs
FROM postgres:16-alpine

# Set environment variables for PostgreSQL
ENV POSTGRES_USER=hestami
ENV POSTGRES_DB=historian_registry

# Copy initialization scripts
# Paths are relative to build context (project root)
COPY services/registry-db/migrations/*.sql /docker-entrypoint-initdb.d/
COPY services/registry-db/seed/*.sql /docker-entrypoint-initdb.d/

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD pg_isready -U $POSTGRES_USER -d $POSTGRES_DB || exit 1

EXPOSE 5432
