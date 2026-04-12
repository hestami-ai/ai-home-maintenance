/**
 * Prompt probes: Phase 5 — Technical Specification
 *   5.1 — Data Models
 *   5.2 — API Definitions
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Data Models (5.1)', () => {
  it('produces data_models with field types specified', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_5_1_data_models',
      agentRole: 'technical_spec_agent',
      subPhase: '05_1_data_models',
      variables: {
        active_constraints: 'No constraints',
        component_model_summary: 'Components: AuthService (handles users), TaskService (handles tasks)',
        software_domains_summary: 'Domains: auth, tasks',
        detail_file_path: '/dev/null',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'data_models',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.models)) {
          errors.push('Missing models array');
          return errors;
        }
        const models = parsed.models as Record<string, unknown>[];
        for (const m of models) {
          if (!m.component_id) errors.push('Model missing component_id');
          if (!Array.isArray(m.entities)) errors.push('Model missing entities');
          // Check Invariant DM-001: every field has a type
          const entities = (m.entities as Record<string, unknown>[]) ?? [];
          for (const e of entities) {
            const fields = (e.fields as Record<string, unknown>[]) ?? [];
            for (const f of fields) {
              if (!f.type) errors.push(`Entity ${e.name} field ${f.name}: missing type (Invariant DM-001)`);
            }
          }
        }
        return errors;
      },
      judgeRubric: {
        name: 'Data Models for AuthService + TaskService',
        criteria: [
          'At least 2 models — one for AuthService (User entity), one for TaskService (Task entity)',
          'Every entity field has a CONCRETE type (string, integer, uuid, timestamp, boolean — NOT vague types like "data" or "object")',
          'User entity has at least id and credential-related fields (email, password_hash, etc)',
          'Task entity has at least id, title, status, and possibly assignee fields',
          'Relationships between entities are documented where applicable',
          'No invented entities not justified by component responsibilities',
        ],
        reasoningCriteria: [
          'The agent used appropriate types for each field (e.g. uuid for IDs, not generic string)',
          'The agent did not omit constraints (NOT NULL, UNIQUE, FK)',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});

describe('Probe: API Definitions (5.2)', () => {
  it('produces api_definitions with auth_requirement on every endpoint', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_5_2_api_definitions',
      agentRole: 'technical_spec_agent',
      subPhase: '05_2_api_definitions',
      variables: {
        active_constraints: 'No constraints',
        component_model_summary: 'Components: AuthService, TaskService',
        interface_contracts_summary: 'Internal REST contracts between services',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'api_definitions',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.definitions)) {
          errors.push('Missing definitions array');
          return errors;
        }
        const defs = parsed.definitions as Record<string, unknown>[];
        for (const d of defs) {
          const endpoints = (d.endpoints as Record<string, unknown>[]) ?? [];
          for (const e of endpoints) {
            // Invariant API-001: every endpoint has auth_requirement
            if (!e.auth_requirement) {
              errors.push(`Endpoint ${e.method} ${e.path}: missing auth_requirement (Invariant API-001)`);
            }
          }
        }
        return errors;
      },
      judgeRubric: {
        name: 'API Definitions for AuthService + TaskService',
        criteria: [
          'At least 2 definitions — one per component',
          'Every endpoint has an explicit auth_requirement field (Invariant API-001) — this is the #1 failure mode',
          'AuthService has login/register endpoints with auth_requirement="public" or "anonymous"',
          'TaskService has CRUD endpoints with auth_requirement="authenticated" or specific role',
          'Every endpoint has at least one error_code defined',
          'inputs and outputs schemas are populated',
        ],
        reasoningCriteria: [
          'The agent recognized that even login endpoints need auth_requirement set (to "public" or similar)',
          'The agent did not silently omit auth_requirement on any endpoint',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
