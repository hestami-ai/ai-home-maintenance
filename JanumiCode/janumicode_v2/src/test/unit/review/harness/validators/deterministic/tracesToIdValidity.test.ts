import { describe, it, expect } from 'vitest';
import { validateTracesToIdValidity } from '../../../../../../lib/review/harness/validators/deterministic/tracesToIdValidity';
import { makeRuntime } from './_helpers';

describe('traces_to_id_validity (deterministic)', () => {
  it('returns [] when no config for (agentRole, subPhaseId)', () => {
    expect(
      validateTracesToIdValidity(
        makeRuntime({
          agentRole: 'unknown_agent',
          subPhaseId: 'unknown_phase',
          outputContent: { children: [] },
        }),
      ),
    ).toEqual([]);
  });

  it('returns [] when children is empty', () => {
    expect(
      validateTracesToIdValidity(
        makeRuntime({
          agentRole: 'requirements_agent',
          subPhaseId: 'fr_saturation',
          outputContent: { children: [], handoff_context: [] },
        }),
      ),
    ).toEqual([]);
  });

  it('returns [] when all traces_to ids are in handoff_context', () => {
    const findings = validateTracesToIdValidity(
      makeRuntime({
        agentRole: 'requirements_agent',
        subPhaseId: 'fr_saturation',
        outputContent: {
          depth: 1,
          children: [
            { id: 'FR-001-D1', traces_to: ['FR-001'] },
          ],
          handoff_context: [{ id: 'FR-001' }],
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags broken reference when traces_to id not in known set', () => {
    const findings = validateTracesToIdValidity(
      makeRuntime({
        agentRole: 'requirements_agent',
        subPhaseId: 'fr_saturation',
        outputContent: {
          depth: 2,
          children: [
            { id: 'FR-001-D1', traces_to: ['FR-VIOL-DEL-001.2.1.1.C-02-D-01'] },
          ],
          handoff_context: [{ id: 'FR-001' }],
        },
      }),
    );
    expect(findings.length).toBeGreaterThan(0);
    const finding = findings[0];
    expect(finding.severity).toBe('HIGH'); // depth=2
    expect(finding.type).toBe('broken_reference');
  });

  it('uses LOW severity at shallow depth (depth=0)', () => {
    const findings = validateTracesToIdValidity(
      makeRuntime({
        agentRole: 'requirements_agent',
        subPhaseId: 'fr_saturation',
        outputContent: {
          depth: 0,
          children: [
            { id: 'FR-001-D1', traces_to: ['UNKNOWN-ID'] },
          ],
          handoff_context: [],
        },
      }),
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe('LOW');
  });

  it('uses MEDIUM severity when depth is unknown', () => {
    const findings = validateTracesToIdValidity(
      makeRuntime({
        agentRole: 'requirements_agent',
        subPhaseId: 'fr_saturation',
        outputContent: {
          // no depth field
          children: [{ id: 'FR-001-D1', traces_to: ['UNKNOWN-ID'] }],
          handoff_context: [],
        },
      }),
    );
    expect(findings[0].severity).toBe('MEDIUM');
  });

  it('resolves ids extracted from the original prompt', () => {
    // Prompt contains FR-002 — should be in known set
    const findings = validateTracesToIdValidity(
      makeRuntime({
        agentRole: 'requirements_agent',
        subPhaseId: 'fr_saturation',
        originalPrompt: 'The handoff contains FR-002 and FR-003.',
        outputContent: {
          depth: 1,
          children: [{ id: 'child-1', traces_to: ['FR-002'] }],
          handoff_context: [],
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  // --- Characterization tests: pin current behavior on branches the
  // --- refactor isolates into helpers (saturation_depth, sub_array_field
  // --- refMode, component_id / [idx] item-id resolution).

  it('uses saturation_depth when depth is absent (>=2 → HIGH)', () => {
    const findings = validateTracesToIdValidity(
      makeRuntime({
        agentRole: 'requirements_agent',
        subPhaseId: 'fr_saturation',
        outputContent: {
          saturation_depth: 2,
          children: [{ id: 'FR-001-D1', traces_to: ['UNKNOWN-ID'] }],
          handoff_context: [],
        },
      }),
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe('HIGH');
  });

  it('flags sub_array_field refs and resolves item id from component_id', () => {
    const findings = validateTracesToIdValidity(
      makeRuntime({
        agentRole: 'domain_interpreter',
        subPhaseId: 'component_saturation',
        outputContent: {
          depth: 2,
          children: [
            {
              component_id: 'COMP-A',
              dependencies: [
                { component_id: 'COMP-B' },
                { component_id: 'COMP-UNKNOWN' },
              ],
            },
          ],
          sibling_context: [{ id: 'COMP-B' }],
        },
      }),
    );
    expect(findings.length).toBe(1);
    const finding = findings[0];
    expect(finding.severity).toBe('HIGH');
    expect(finding.type).toBe('broken_reference');
    expect(finding.summary).toBe(
      "Item 'COMP-A' references unknown id 'COMP-UNKNOWN'",
    );
    expect(finding.location).toBe('$.children[0].dependencies');
  });

  it('falls back to positional [idx] item id when no id fields present', () => {
    const findings = validateTracesToIdValidity(
      makeRuntime({
        agentRole: 'requirements_agent',
        subPhaseId: 'fr_saturation',
        outputContent: {
          depth: 2,
          children: [{ traces_to: ['UNKNOWN-ID'] }],
          handoff_context: [],
        },
      }),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].summary).toBe(
      "Item '[0]' references unknown id 'UNKNOWN-ID'",
    );
  });
});
