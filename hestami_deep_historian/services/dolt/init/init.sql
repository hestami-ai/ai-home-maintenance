-- Historian Agent Platform - Dolt Schema Initialization
-- This script creates the initial schema for the truth store.

-- =============================================================================
-- Database and User Setup
-- =============================================================================
-- Create the historian database
CREATE DATABASE IF NOT EXISTS historian;
USE historian;

-- Create root user that accepts remote connections (for Docker networking)
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%';
FLUSH PRIVILEGES;

-- =============================================================================
-- Metadata table for tracking spec versions and system state
-- =============================================================================
CREATE TABLE IF NOT EXISTS metadata (
    `key` VARCHAR(255) PRIMARY KEY,
    `value` TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert initial metadata
INSERT INTO metadata (`key`, `value`) VALUES ('spec_version', '1.0.0');
INSERT INTO metadata (`key`, `value`) VALUES ('schema_version', '1');
INSERT INTO metadata (`key`, `value`) VALUES ('index_version', 'initial');

-- =============================================================================
-- Specifications tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS specs (
    spec_id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    version VARCHAR(50),
    doc_path VARCHAR(1000),
    indexed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Interpretations - how spec sections should be understood
-- =============================================================================
CREATE TABLE IF NOT EXISTS interpretations (
    interpretation_id VARCHAR(255) PRIMARY KEY,
    section_id VARCHAR(255) NOT NULL,
    entry_type VARCHAR(50) NOT NULL DEFAULT 'interpretation',
    text TEXT NOT NULL,
    reference VARCHAR(255),
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_section (section_id)
);

-- =============================================================================
-- Exceptions - known waivers or exemptions to requirements
-- =============================================================================
CREATE TABLE IF NOT EXISTS exceptions (
    exception_id VARCHAR(255) PRIMARY KEY,
    requirement_id VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    ruling_id VARCHAR(255),
    conditions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_requirement (requirement_id),
    INDEX idx_active (is_active)
);

-- =============================================================================
-- Rulings - prior decisions and verdicts for reference
-- =============================================================================
CREATE TABLE IF NOT EXISTS rulings (
    ruling_id VARCHAR(255) PRIMARY KEY,
    topic VARCHAR(500) NOT NULL,
    summary TEXT NOT NULL,
    verdict VARCHAR(50),
    proposal_id VARCHAR(255),
    evidence_refs TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_topic (topic(100))
);

-- =============================================================================
-- Corrections - logged corrections to previous judgments
-- =============================================================================
CREATE TABLE IF NOT EXISTS corrections (
    correction_id VARCHAR(255) PRIMARY KEY,
    run_id VARCHAR(255) NOT NULL,
    issue_description TEXT NOT NULL,
    resolution TEXT NOT NULL,
    corrected_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_run (run_id)
);
