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
    // Sections are framed as COMPONENT context (not the task's own work) so the
    // executor binds to its Completion Criteria, not the whole component's stories.
    expect(md).toMatch(/## Component Context — User Stories/);
    expect(md).toMatch(/component context/i);
    expect(md).not.toMatch(/This Task Implements/);
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
    expect(md).toMatch(/## Component Test Cases/);
    expect(md).toMatch(/TC-001.*functional.*verifies AC-001/);
    expect(md).toMatch(/## How This Component Is Evaluated/);
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

  it('surfaces coherence findings to the executor, split into actionable vs FYI', () => {
    // Reverses the ts-17 suppression: the packet's coherence findings are
    // already task-scoped; several are executor-actionable (author a missing
    // test, don't trust an invented id), the rest are labeled FYI.
    const p = fullPacket();
    p.coherence.blocking_failures = [
      'P3_AC_NO_TEST: US-005/AC-US005-001 has no test case',          // actionable
      'P7_INVENTED_ID_REFERENCE: \'TECH-POSTGRES-1\' not found upstream', // actionable
      'P4_USER_STORY_NO_EVAL: US-005 has no evaluation criterion',    // FYI
    ];
    p.coherence.advisory_findings = [
      'A3_UNMEASURABLE_EVAL_CRITERION: target NFR-008 lacks measurable predicate', // actionable
    ];
    const md = formatPacketAsExecutorContext(p);
    expect(md).toMatch(/## Upstream Coherence Findings/);
    expect(md).toMatch(/Act on these:/);
    expect(md).toMatch(/P3_AC_NO_TEST.*→ .*author one/i);
    expect(md).toMatch(/P7_INVENTED_ID_REFERENCE.*→ /);
    expect(md).toMatch(/A3_UNMEASURABLE_EVAL_CRITERION.*→ /);
    expect(md).toMatch(/FYI \(upstream gaps/);
    expect(md).toMatch(/P4_USER_STORY_NO_EVAL/);
  });

  // PD-7 — a component-scoped API join can bind >1 endpoint to a task's packet;
  // the executor was observed implementing the wrong one. Hedge the header on count.
  it('keeps the direct header when exactly one endpoint is present', () => {
    const md = formatPacketAsExecutorContext(fullPacket()); // one api_definition
    expect(md).toMatch(/## API Endpoints You Implement/);
    expect(md).not.toMatch(/## Component API Endpoints \(context/); // not the hedged form
  });

  it('hedges the header when MORE than one endpoint is present', () => {
    const p = fullPacket();
    p.api_definitions = [
      { id: 'api-001', method: 'POST', path: '/board-decisions', description: 'create' },
      { id: 'api-002', method: 'POST', path: '/decisions/{id}/approve', description: 'approve' },
    ];
    const md = formatPacketAsExecutorContext(p);
    expect(md).toMatch(/## Component API Endpoints \(context/);
    expect(md).toMatch(/implement ONLY the one\(s\) your task/);
    expect(md).not.toMatch(/## API Endpoints You Implement/);
  });

  // PD-11 — an unresolved constraint ref is carried as an empty-body placeholder so
  // the coherence verifier flags it; it must NOT be presented to the executor as a
  // binding "apply without exception" rule with no content.
  it('splits unresolved (empty-body) constraint refs out of the binding list (PD-11)', () => {
    const p = fullPacket();
    p.active_constraints = [
      { id: 'TECH-PG-16', category: 'database', text: 'PostgreSQL 16+', technology: 'PostgreSQL' },
      { id: 'TECH-BUN', category: '', text: '' }, // unresolved placeholder
    ];
    const md = formatPacketAsExecutorContext(p);
    expect(md).toMatch(/## Technical Constraints \(apply without exception\)/);
    expect(md).toMatch(/TECH-PG-16/);
    expect(md).not.toMatch(/\*\*TECH-BUN\*\*.*\(\):/); // not a binding empty rule
    expect(md).toMatch(/## Unresolved constraint references/);
    expect(md).toMatch(/`TECH-BUN`/);
  });

  it('omits the binding-constraints header entirely when every constraint ref is unresolved', () => {
    const p = fullPacket();
    p.active_constraints = [{ id: 'TECH-X', category: '', text: '' }];
    const md = formatPacketAsExecutorContext(p);
    expect(md).not.toMatch(/## Technical Constraints \(apply without exception\)/);
    expect(md).toMatch(/## Unresolved constraint references/);
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

describe('formatPacketAsExecutorContext — golden snapshot (characterization)', () => {
  // Pins the EXACT, whole-string output for the representative fullPacket(): every
  // section, line, blank-line separator, and ordering at once. Guards the pure
  // formatter against any behavioral drift during refactors (S3776 decomposition).
  it('renders the full packet to an exact markdown string', () => {
    const expected = [
      '# Implementation Packet Context',
      '',
      'Your authoritative deliverable is the **Implementation Task** and its **Completion Criteria** (in the GOVERNING CONSTRAINTS section below) — that is exactly what you must build and what you will be judged on.',
      '',
      'The sections below are the surrounding **component context**: the user stories, test cases, and evaluation methods for the *whole component* this task belongs to. Your task implements ONE slice of this component, not all of it. Use this context to stay consistent with the component — do NOT attempt to satisfy every story, test, or evaluation listed here in this single task, and do NOT invent ACs, tests, components, APIs, or constraints beyond what is given.',
      '',
      '## Component Context — User Stories',
      '',
      '### US-001 — As a Link Sharer, I want to shorten a URL, so that a short URL is returned.',
      'Priority: critical',
      '',
      '**Acceptance criteria for this story (component-level — your task may satisfy only the subset within its scope):**',
      '- **AC-001** — returns 201',
      '  Measurable: HTTP 201 with JSON body',
      '- **AC-002** — invalid URL returns 400',
      '  Measurable: HTTP 400 with code INVALID_URL',
      '',
      '## Non-Functional Requirements That Apply',
      '',
      '- **NFR-001** (performance): redirect latency P95 ≤ 100ms',
      '  Threshold: 100ms',
      '  Measurement: server-side timing',
      '',
      '## Component Contract',
      '',
      'Component: `comp-001` — URL Generation Service',
      'Domain: `DOM-URL-SHORTENING`',
      '',
      'Responsibilities:',
      '- `resp-1`: Generate unique short URL identifier',
      '',
      'Component dependencies:',
      '- `comp-002` (sync_call)',
      '',
      '## Data Models You May Read/Write',
      '',
      '### dm-001 — UrlMapping',
      'Fields:',
      '- `slug`: `string` _(unique, length=6)_',
      '- `original_url_encrypted`: `byte_array`',
      '',
      '## API Endpoints You Implement',
      '',
      '### api-001 — `POST /shorten`',
      'Submit a long URL for shortening',
      'Error codes: INVALID_URL, MISSING_URL',
      '',
      '## Component Test Cases (context — may belong to sibling tasks; your gate is the Completion Criteria, not these)',
      '',
      '### TC-001 (functional) — verifies AC-001',
      'Preconditions:',
      '- service deployed',
      'Expected outcome: POST /shorten returns 201 with slug',
      '',
      "## How This Component Is Evaluated (context — these are component/system-level methods, not your task's unit of work)",
      '',
      '- Target `US-001` (functional)',
      '  Method: API contract test',
      '  Success: POST returns HTTP 201 within 2 seconds',
      '',
      '## Technical Constraints (apply without exception)',
      '',
      '- **TECH-PG-16** [PostgreSQL] (database): PostgreSQL 16+',
      '  Rationale: Spec mandates Postgres 16+',
      '',
      '## Compliance / V&V / Quality Items That Apply',
      '',
      '- **COMP-ENCRYPT-AT-REST** (compliance): Stored URLs must be encrypted at rest using AES-256',
      '  Measurable: Direct read of Postgres data files yields no plaintext URLs',
      '',
    ].join('\n');
    expect(formatPacketAsExecutorContext(fullPacket())).toBe(expected);
  });
});
