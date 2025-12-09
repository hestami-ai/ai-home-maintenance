-- Initialize PostgreSQL extensions for hestami-ai
-- This script runs automatically when the database is first created

-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable pgvector for vector embeddings and semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable text search extensions for better full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- Trigram matching for fuzzy search
CREATE EXTENSION IF NOT EXISTS btree_gin;    -- Better JSONB indexing performance
CREATE EXTENSION IF NOT EXISTS unaccent;     -- Remove accents for better text search

-- Verify installations
DO $$
BEGIN
    RAISE NOTICE 'PostGIS version: %', PostGIS_version();
    RAISE NOTICE 'Extensions installed successfully';
END $$;
