/**
 * Prompt probes: Phase 3 — System Specification
 *   3.1 — System Boundary
 *   3.2 — System Requirements
 *   3.3 — Interface Contracts
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: System Boundary (3.1)', () => {
  it('produces valid system_boundary with external systems', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_3_1_system_boundary',
      agentRole: 'systems_agent',
      subPhase: '03_1_system_boundary',
      variables: {
        active_constraints: 'No constraints',
        intent_statement_summary: 'TaskFlow — task management with email notifications and GitHub integration',
        functional_requirements_summary: '5 user stories: task CRUD, kanban, assign, notify, GitHub sync',
        non_functional_requirements_summary: 'NFRs: 99.9% uptime, p95 < 300ms',
        detail_file_path: '/dev/null',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'system_boundary',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.in_scope)) errors.push('Missing in_scope');
        if (!Array.isArray(parsed.out_of_scope)) errors.push('Missing out_of_scope');
        if (!Array.isArray(parsed.external_systems)) errors.push('Missing external_systems');
        return errors;
      },
      judgeRubric: {
        name: 'System Boundary for TaskFlow with email + GitHub',
        criteria: [
          'in_scope covers task management, kanban, and team functionality',
          'external_systems contains at least an email/SMTP service AND GitHub',
          'Every external system has a name, purpose, and interface_type',
          'out_of_scope is populated with explicit exclusions',
        ],
        reasoningCriteria: [
          'The agent recognized "email notifications" as requiring an external SMTP/email service',
          'The agent recognized "GitHub integration" as requiring the external GitHub API',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});

describe('Probe: System Requirements (3.2)', () => {
  it('produces system_requirements with traceability to FRs', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_3_2_system_requirements',
      agentRole: 'systems_agent',
      subPhase: '03_2_system_requirements',
      variables: {
        active_constraints: 'No constraints',
        system_boundary_summary: 'In scope: task management. Out of scope: mobile. External: GitHub, SMTP',
        functional_requirements_summary: 'FR-001: create tasks. FR-002: assign tasks. FR-003: notify on overdue',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'system_requirements',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.items)) {
          errors.push('Missing items array');
          return errors;
        }
        const items = parsed.items as Record<string, unknown>[];
        for (const item of items) {
          if (!item.id) errors.push('SR missing id');
          if (!item.statement) errors.push('SR missing statement');
          if (!Array.isArray(item.source_requirement_ids)) errors.push('SR missing source_requirement_ids');
        }
        return errors;
      },
      judgeRubric: {
        name: 'System Requirements derivation with traceability',
        criteria: [
          'At least 3 system requirements (one for each FR-001, FR-002, FR-003)',
          'Every SR has source_requirement_ids referencing the FR IDs (FR-001, FR-002, FR-003)',
          'Every SR has a clear formal statement (not vague)',
          'Every SR has a priority assigned',
          'No SRs traced to non-existent FRs',
        ],
        reasoningCriteria: [
          'Each FR is covered by at least one SR (Phase Gate Invariant)',
          'The SRs are formal restatements of the FRs at the system level, not paraphrases',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});

describe('Probe: Interface Contracts (3.3)', () => {
  it('produces contracts with error responses', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_3_3_interface_contracts',
      agentRole: 'systems_agent',
      subPhase: '03_3_interface_contracts',
      variables: {
        active_constraints: 'No constraints',
        system_boundary_summary: 'External systems: GitHub API, SMTP server',
        external_systems_list: '- github_api: REST API for repository operations\n- smtp_server: SMTP for outbound email',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'interface_contracts',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.contracts)) {
          errors.push('Missing contracts array');
          return errors;
        }
        const contracts = parsed.contracts as Record<string, unknown>[];
        for (const c of contracts) {
          if (!Array.isArray(c.systems_involved) || (c.systems_involved as unknown[]).length < 2) {
            errors.push('Contract must have at least 2 systems_involved');
          }
          if (!c.protocol) errors.push('Contract missing protocol');
        }
        return errors;
      },
      judgeRubric: {
        name: 'Interface Contracts for github_api + smtp_server',
        criteria: [
          'At least 2 contracts (one for github_api, one for smtp_server)',
          'Every contract has at least 2 systems_involved',
          'Every contract specifies protocol (HTTPS, SMTP, etc)',
          'Every contract has at least one error_response (Invariant IC-001)',
          'auth_mechanism is specified for github_api (OAuth or API token)',
          'data_format is specified (JSON for github, RFC822 for SMTP, etc)',
        ],
        reasoningCriteria: [
          'The agent recognized that GitHub API uses HTTPS+REST and SMTP uses its own protocol',
          'The agent specified appropriate authentication mechanisms for each external system',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
