-- Historian Registry Database Schema
-- Version: 1.0.0

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Decision status enum
CREATE TYPE decision_status AS ENUM ('ACTIVE', 'SUPERSEDED', 'RETIRED');

-- Trust tier enum
CREATE TYPE trust_tier AS ENUM ('HUMAN_APPROVED', 'HUMAN_NOTED', 'MODEL_DRAFT');

-- Adjudication status enum
CREATE TYPE adjudication_status AS ENUM ('CONSISTENT', 'INCONSISTENT', 'CONDITIONAL', 'UNKNOWN');

-- Model adapter status enum
CREATE TYPE adapter_status AS ENUM ('TRAINING', 'VALIDATING', 'PROMOTED', 'ARCHIVED', 'FAILED');

-- Spec documents table
CREATE TABLE spec_documents (
    doc_id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    version VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    file_path VARCHAR(1000) NOT NULL,
    content_hash VARCHAR(64),
    supersedes VARCHAR(255) REFERENCES spec_documents(doc_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spec sections table
CREATE TABLE spec_sections (
    stable_id VARCHAR(500) PRIMARY KEY,
    doc_id VARCHAR(255) NOT NULL REFERENCES spec_documents(doc_id) ON DELETE CASCADE,
    sec_id VARCHAR(255) NOT NULL,
    heading VARCHAR(500) NOT NULL,
    level INTEGER NOT NULL,
    content TEXT,
    line_start INTEGER,
    line_end INTEGER,
    parent_sec_id VARCHAR(255),
    quote_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Normative statements table
CREATE TABLE normative_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stable_id VARCHAR(500) NOT NULL UNIQUE,
    doc_id VARCHAR(255) NOT NULL REFERENCES spec_documents(doc_id) ON DELETE CASCADE,
    sec_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    context TEXT,
    line_number INTEGER,
    quote_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Decision traces table
CREATE TABLE decision_traces (
    decision_id VARCHAR(255) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    actors TEXT[] NOT NULL,
    summary VARCHAR(500) NOT NULL,
    details TEXT NOT NULL,
    "references" JSONB DEFAULT '[]'::JSONB,
    supersedes VARCHAR(255) REFERENCES decision_traces(decision_id),
    status decision_status NOT NULL DEFAULT 'ACTIVE',
    trust_tier trust_tier NOT NULL DEFAULT 'MODEL_DRAFT',
    related_action VARCHAR(255),
    scope VARCHAR(255) DEFAULT 'global',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Action proposals table (for audit trail)
CREATE TABLE action_proposals (
    action_id VARCHAR(255) PRIMARY KEY,
    feature VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    steps TEXT[] NOT NULL,
    preconditions TEXT[] DEFAULT '{}',
    dependencies TEXT[] DEFAULT '{}',
    expected_outcome TEXT NOT NULL,
    risks TEXT[] DEFAULT '{}',
    assumptions TEXT[] DEFAULT '{}',
    invariants TEXT[] DEFAULT '{}',
    spec_refs TEXT[] DEFAULT '{}',
    evidence_bundle JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adjudication responses table (for audit trail)
CREATE TABLE adjudication_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_id VARCHAR(255) REFERENCES action_proposals(action_id),
    status adjudication_status NOT NULL,
    anchor_sufficiency JSONB,
    evidence JSONB DEFAULT '[]'::JSONB,
    conflicts TEXT[] DEFAULT '{}',
    conditions TEXT[] DEFAULT '{}',
    verification_queries TEXT[] DEFAULT '{}',
    supersession_notes JSONB DEFAULT '[]'::JSONB,
    comments TEXT,
    model_adapter_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model adapters table (for lineage)
CREATE TABLE model_adapters (
    adapter_id VARCHAR(255) PRIMARY KEY,
    base_model VARCHAR(255) NOT NULL,
    training_batch_id VARCHAR(255),
    status adapter_status NOT NULL DEFAULT 'TRAINING',
    benchmark_scores JSONB,
    training_config JSONB,
    parent_adapter_id VARCHAR(255) REFERENCES model_adapters(adapter_id),
    promoted_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training batches table
CREATE TABLE training_batches (
    batch_id VARCHAR(255) PRIMARY KEY,
    adapter_id VARCHAR(255) REFERENCES model_adapters(adapter_id),
    decision_trace_ids TEXT[] DEFAULT '{}',
    replay_buffer_composition JSONB,
    training_items_count INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Benchmark results table
CREATE TABLE benchmark_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adapter_id VARCHAR(255) NOT NULL REFERENCES model_adapters(adapter_id),
    benchmark_name VARCHAR(255) NOT NULL,
    metrics JSONB NOT NULL,
    passed BOOLEAN NOT NULL,
    failure_reason TEXT,
    run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_spec_sections_doc ON spec_sections(doc_id);
CREATE INDEX idx_normative_doc ON normative_statements(doc_id);
CREATE INDEX idx_normative_type ON normative_statements(type);
CREATE INDEX idx_decision_status ON decision_traces(status);
CREATE INDEX idx_decision_trust ON decision_traces(trust_tier);
CREATE INDEX idx_adjudication_action ON adjudication_responses(action_id);
CREATE INDEX idx_adapter_status ON model_adapters(status);
CREATE INDEX idx_benchmark_adapter ON benchmark_results(adapter_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_spec_documents_updated_at
    BEFORE UPDATE ON spec_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_spec_sections_updated_at
    BEFORE UPDATE ON spec_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_decision_traces_updated_at
    BEFORE UPDATE ON decision_traces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_model_adapters_updated_at
    BEFORE UPDATE ON model_adapters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
