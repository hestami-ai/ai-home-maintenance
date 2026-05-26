/**
 * Unit tests for the packet → executor context markdown formatter.
 */
import { describe, it, expect } from 'vitest';
import { formatPacketAsExecutorContext } from '../../../../lib/orchestrator/phases/packetSynthesis/packetContextFormatter';
import type { ImplementationPacketContent } from '../../../../lib/types/records';

function fullPacket(): ImplementationPacketContent {
  return {
    kind: 'implementation_packet',
    schemaVersion: '1.0',
    packet_id: 'pkt-1',
    task: {
      id: 'task-001', node_id: 'node-001', name: 'Implement /shorten endpoint',
      description: 'POST endpoint that validates and stores URL',
      task_type: 'standard', backing_tool: 'claude_code_cli', estimated_complexity: 'medium',
      completion_criteria: [{ criterion_id: 'CC-1', description: 'returns 201', verification_method: 'test' }],
      write_directory_paths: ['src/server/url_service'], read_directory_paths: [],
      dependency_task_ids: [],
    },
    user_stories: [{
      id: 'US-001', role: 'Link Sharer', action: 'shorten a URL', outcome: 'a short URL is returned',
      priority: 'critical',
      acceptance_criteria: [
        { id: 'AC-001', description: 'returns 201', measurable_condition: 'HTTP 201 with JSON body' },
        { id: 'AC-002', description: 'invalid URL returns 400', measurable_condition: 'HTTP 400 with code INVALID_URL' },
      ],
    }],
    nfrs: [{
      id: 'NFR-001', category: 'performance', description: 'redirect latency P95 ≤ 100ms',
      threshold: '100ms', measurement_method: 'server-side timing',
    }],
    component: {
      id: 'comp-001', name: 'URL Generation Service', domain_id: 'DOM-URL-SHORTENING',
      responsibilities: [{ id: 'resp-1', description: 'Generate unique short URL identifier' }],
      dependencies: [{ component_id: 'comp-002', kind: 'sync_call' }],
      active_constraints: ['TECH-PG-16'],
    },
    data_models: [{
      id: 'dm-001', name: 'UrlMapping', component_id: 'comp-001',
      fields: [
        { name: 'slug', type: 'string', constraints: 'unique, length=6' },
        { name: 'original_url_encrypted', type: 'byte_array' },
      ],
    }],
    api_definitions: [{
      id: 'api-001', method: 'POST', path: '/shorten',
      description: 'Submit a long URL for shortening',
      error_codes: ['INVALID_URL', 'MISSING_URL'],
    }],
    test_cases: [{
      test_case_id: 'TC-001', type: 'functional',
      acceptance_criterion_ids: ['AC-001'],
      preconditions: ['service deployed'], expected_outcome: 'POST /shorten returns 201 with slug',
    }],
    evaluation_criteria: [{
      kind: 'functional', target_id: 'US-001',
      evaluation_method: 'API contract test',
      success_condition: 'POST returns HTTP 201 within 2 seconds',
    }],
    active_constraints: [{
      id: 'TECH-PG-16', category: 'database', text: 'PostgreSQL 16+',
      technology: 'PostgreSQL', rationale: 'Spec mandates Postgres 16+',
    }],
    compliance_items: [{
      id: 'COMP-ENCRYPT-AT-REST', kind: 'compliance',
      description: 'Stored URLs must be encrypted at rest using AES-256',
      measurable_condition: 'Direct read of Postgres data files yields no plaintext URLs',
    }],
    depends_on_packets: [],
    coherence: {
      passed: true, blocking_failures: [], advisory_findings: [],
      annotations: { ai_proposed_root_count: 0, ai_proposed_root_ids: [] },
    },
    release_id: null,
    release_ordinal: null,
  };
}

describe('formatPacketAsExecutorContext — full packet', () => {
  it('renders every section when all bundled context is present', () => {
    const md = formatPacketAsExecutorContext(fullPacket());
    expect(md).toMatch(/# Implementation Packet Context/);
    expect(md).toMatch(/## User Stories This Task Implements/);
    expect(md).toMatch(/US-001 — As a Link Sharer/);
    expect(md).toMatch(/AC-001.*returns 201/);
    expect(md).toMatch(/Measurable: HTTP 201/);
    expect(md).toMatch(/## Non-Functional Requirements/);
    expect(md).toMatch(/NFR-001.*performance/);
    expect(md).toMatch(/## Component Contract/);
    expect(md).toMatch(/`comp-001` — URL Generation Service/);
    expect(md).toMatch(/Domain: `DOM-URL-SHORTENING`/);
    expect(md).toMatch(/## Data Models/);
    expect(md).toMatch(/`slug`: `string`/);
    expect(md).toMatch(/## API Endpoints/);
    expect(md).toMatch(/`POST \/shorten`/);
    expect(md).toMatch(/INVALID_URL/);
    expect(md).toMatch(/## Test Cases/);
    expect(md).toMatch(/TC-001.*functional.*verifies AC-001/);
    expect(md).toMatch(/## How This Task Will Be Evaluated/);
    expect(md).toMatch(/## Technical Constraints/);
    expect(md).toMatch(/TECH-PG-16/);
    expect(md).toMatch(/## Compliance/);
    expect(md).toMatch(/COMP-ENCRYPT-AT-REST/);
  });

  it('omits sections that are empty', () => {
    const p = fullPacket();
    p.user_stories = [];
    p.nfrs = [];
    p.test_cases = [];
    const md = formatPacketAsExecutorContext(p);
    expect(md).not.toMatch(/## User Stories/);
    expect(md).not.toMatch(/## Non-Functional Requirements/);
    expect(md).not.toMatch(/## Test Cases/);
    // But the always-rendered sections are still there
    expect(md).toMatch(/# Implementation Packet Context/);
  });

  it('emits coherence-notes section when ai_proposed_root_count > 0', () => {
    const p = fullPacket();
    p.coherence.annotations.ai_proposed_root_count = 3;
    p.coherence.annotations.ai_proposed_root_ids = ['US-001', 'comp-001', 'DOM-URL-SHORTENING'];
    const md = formatPacketAsExecutorContext(p);
    expect(md).toMatch(/## Packet Coherence Notes/);
    expect(md).toMatch(/3 upstream id\(s\) trace to ai-proposed/);
  });

  it('suppresses advisory findings from the executor prompt (issue #7)', () => {
    // Advisories are verifier signals retained on the packet record for
    // telemetry, not directions the executor can act on. The
    // formatter must not surface them into the prompt; they would
    // otherwise leak into the executor as unactionable noise.
    const p = fullPacket();
    p.coherence.advisory_findings = ['A1_TASK_OUTSIDE_COMPONENT_BOUNDARY: task task-001 writes outside comp-001'];
    const md = formatPacketAsExecutorContext(p);
    expect(md).not.toMatch(/Advisory findings/);
    expect(md).not.toMatch(/A1_TASK_OUTSIDE_COMPONENT_BOUNDARY/);
  });

  it('returns a non-empty string even for a minimal packet', () => {
    const p = fullPacket();
    p.user_stories = [];
    p.nfrs = [];
    p.data_models = [];
    p.api_definitions = [];
    p.test_cases = [];
    p.evaluation_criteria = [];
    p.active_constraints = [];
    p.compliance_items = [];
    const md = formatPacketAsExecutorContext(p);
    expect(md.length).toBeGreaterThan(0);
    expect(md).toMatch(/# Implementation Packet Context/);
  });
});
