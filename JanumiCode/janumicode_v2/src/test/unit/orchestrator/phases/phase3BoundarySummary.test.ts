/**
 * PA-8 regression — Phase 3 system-boundary summary must never render
 * "[object Object]".
 *
 * `SystemBoundary.in_scope` / `out_of_scope` are DECLARED `string[]`, but the
 * Systems-Agent LLM emits scope items as objects (`{ capability, description,
 * satisfies_fr }` — the boundary template requires objects). A raw `join('; ')`
 * leaked `[object Object]; [object Object]` into `system_boundary_summary`, the
 * variable fed into BOTH Phase 3.2 (system requirements) and Phase 3.3 (interface
 * contracts) — starving the derivation of the actual in-scope capabilities.
 * `formatSystemBoundarySummary` routes every scope item through
 * `displayCapability`, so it can never regress to `[object Object]`.
 */
import { describe, it, expect } from 'vitest';
import { formatSystemBoundarySummary } from '../../../../lib/orchestrator/phases/phase3';

type Boundary = Parameters<typeof formatSystemBoundarySummary>[0];

describe('PA-8 — formatSystemBoundarySummary never emits [object Object]', () => {
  it('renders OBJECT in_scope items via their capability label (the real LLM shape)', () => {
    const boundary = {
      in_scope: [
        { capability: 'Vendor Compliance Enforcement', description: 'x', satisfies_fr: ['FR-001'] },
        { capability: 'Service Call Intake' },
      ],
      out_of_scope: [{ capability: 'Tenant payment processing — deferred to Phase 2' }],
      open_questions: [],
      external_systems: [{ id: 'EXT-1', name: 'Permit API', purpose: 'p', interface_type: 'REST' }],
    } as unknown as Boundary;

    const out = formatSystemBoundarySummary(boundary, 'Real-property OS');
    expect(out).not.toContain('[object Object]');
    expect(out).toContain('In scope: Vendor Compliance Enforcement; Service Call Intake');
    expect(out).toContain('Out of scope: Tenant payment processing — deferred to Phase 2');
    expect(out).toContain('External systems: EXT-1: Permit API (REST)');
    expect(out).toContain('PROJECT TYPE: Real-property OS');
  });

  it('handles STRING scope items (legacy/declared shape) unchanged', () => {
    const boundary = {
      in_scope: ['Alpha', 'Beta'],
      out_of_scope: [],
      open_questions: ['What retention window is required?'],
      external_systems: [],
    } as unknown as Boundary;

    const out = formatSystemBoundarySummary(boundary, 'T');
    expect(out).not.toContain('[object Object]');
    expect(out).toContain('In scope: Alpha; Beta');
    expect(out).toContain('Out of scope: none');
    expect(out).toContain('Open questions (unresolved Phase 1 items): What retention window is required?');
    expect(out).toContain('External systems: none');
  });
});
