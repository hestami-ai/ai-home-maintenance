# PostgreSQL 18 + PostGIS 3.6 + pgvector 0.8.1
FROM postgis/postgis:18-3.6

# Install pgvector and additional extensions
RUN apt-get update && apt-get install -y \
    postgresql-18-pgvector \
    && rm -rf /var/lib/apt/lists/*

# Copy initialization script
COPY init-extensions.sql /docker-entrypoint-initdb.d/01-init-extensions.sql

# Set proper permissions
RUN chmod 755 /docker-entrypoint-initdb.d/01-init-extensions.sql

# Expose PostgreSQL port
EXPOSE 5432
