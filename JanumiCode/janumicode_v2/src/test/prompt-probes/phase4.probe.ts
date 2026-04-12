/**
 * Prompt probes: Phase 4 — Architecture Definition
 *   4.1 — Software Domains
 *   4.2 — Component Decomposition
 *   4.3 — ADR Capture
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Software Domains (4.1)', () => {
  it('produces software_domains with ubiquitous language', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_4_1_software_domains',
      agentRole: 'architecture_agent',
      subPhase: '04_1_software_domains',
      variables: {
        active_constraints: 'No constraints',
        system_boundary_summary: 'In scope: task management, user accounts, notifications',
        system_requirements_summary: 'SR-001: auth. SR-002: task CRUD. SR-003: notifications',
        detail_file_path: '/dev/null',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'software_domains',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.domains)) {
          errors.push('Missing domains array');
          return errors;
        }
        const domains = parsed.domains as Record<string, unknown>[];
        for (const d of domains) {
          if (!d.id) errors.push('Domain missing id');
          if (!d.name) errors.push('Domain missing name');
          if (!Array.isArray(d.ubiquitous_language)) errors.push('Domain missing ubiquitous_language');
        }
        return errors;
      },
      judgeRubric: {
        name: 'Software Domains for TaskFlow',
        criteria: [
          'At least 3 domains identified (covering auth, tasks, and notifications)',
          'Each domain has a clear name and bounded context',
          'Each domain has ubiquitous_language entries with term + definition',
          'Domain names do NOT use JanumiCode canonical vocabulary terms (Component, Workflow Run, Phase Gate, Mirror, Artifact)',
          'Each domain references at least one system_requirement_id',
        ],
        reasoningCriteria: [
          'The agent recognized auth, tasks, and notifications as distinct bounded contexts',
          'The agent did not collapse all functionality into a single domain',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});

describe('Probe: Component Decomposition (4.2)', () => {
  it('produces component_model with single-concern responsibilities', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_4_2_component_decomposition',
      agentRole: 'architecture_agent',
      subPhase: '04_2_component_decomposition',
      variables: {
        active_constraints: 'No constraints',
        software_domains_summary: 'Domains: auth, tasks, notifications',
        system_requirements_summary: 'SR-001: user authentication. SR-002: task CRUD',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'component_model',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.components)) {
          errors.push('Missing components array');
          return errors;
        }
        const components = parsed.components as Record<string, unknown>[];
        for (const c of components) {
          if (!c.id) errors.push('Component missing id');
          if (!Array.isArray(c.responsibilities) || (c.responsibilities as unknown[]).length === 0) {
            errors.push('Component must have at least one responsibility (Invariant CM-002)');
          }
          // Check for forbidden conjunctions in responsibility statements (Invariant CM-001)
          const resps = (c.responsibilities as Record<string, unknown>[]) ?? [];
          for (const r of resps) {
            const stmt = r.statement as string;
            if (stmt && /\b(and|or)\b/i.test(stmt)) {
              errors.push(`Component ${c.id}: responsibility "${stmt}" contains conjunction (Invariant CM-001)`);
            }
          }
        }
        return errors;
      },
      judgeRubric: {
        name: 'Component Decomposition with single-concern responsibilities',
        criteria: [
          'At least 2 components (one for auth, one for tasks)',
          'Every component has at least one responsibility (Invariant CM-002)',
          'NO responsibility statement contains the conjunctions "and"/"or" connecting distinct concerns (Invariant CM-001) — this is the #1 failure mode for models',
          'Each responsibility describes a SINGLE concern',
          'Components have explicit dependencies where applicable',
          'No invented responsibilities not traceable to system requirements',
        ],
        reasoningCriteria: [
          'The agent split compound responsibilities into separate single-concern statements',
          'The agent recognized that "Handle authentication and authorization" is two concerns and should be split',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
    // Note: Invariant CM-001 (no conjunctions) is the most common probe failure for new models —
    // this is the bug we want to catch in production prompt templates
  }, 600000);
});

describe('Probe: ADR Capture (4.3)', () => {
  it('produces ADRs with status, decision, and rationale', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_4_3_adr_capture',
      agentRole: 'architecture_agent',
      subPhase: '04_3_adr_capture',
      variables: {
        active_constraints: 'No constraints',
        component_model_summary: 'Components: AuthService, TaskService, NotificationService',
        software_domains_summary: 'Domains: auth, tasks, notifications',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'architectural_decisions',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.adrs)) {
          errors.push('Missing adrs array');
          return errors;
        }
        const adrs = parsed.adrs as Record<string, unknown>[];
        for (const adr of adrs) {
          if (!adr.id) errors.push('ADR missing id');
          if (!adr.status) errors.push('ADR missing status (Invariant ADR-001)');
          if (!adr.decision) errors.push('ADR missing decision (Invariant ADR-001)');
          if (!adr.rationale) errors.push('ADR missing rationale (Invariant ADR-002)');
        }
        return errors;
      },
      judgeRubric: {
        name: 'ADR Capture for TaskFlow components',
        criteria: [
          'At least one ADR per major architectural decision (component boundaries, data storage, communication patterns)',
          'Every ADR has all required fields: id, title, status, decision, rationale (Invariants ADR-001, ADR-002)',
          'Each ADR documents at least one alternative considered',
          'Each ADR has a non-trivial rationale (not just "best practice")',
          'consequences are populated where applicable',
        ],
        reasoningCriteria: [
          'The agent captured the ACTUAL decisions implied by the component model, not generic best-practice ADRs',
          'Each rationale grounds the decision in the specific context (TaskFlow scope, requirements)',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
