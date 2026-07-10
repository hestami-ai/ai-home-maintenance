import { describe, it, expect } from 'vitest';
import { validateSourceItemEnumerationCompleteness } from '../../../../../../lib/review/harness/validators/deterministic/sourceItemEnumerationCompleteness';
import { makeRuntime } from './_helpers';

// Characterization tests: pin the CURRENT observable behavior of
// validateSourceItemEnumerationCompleteness across every dispatch branch
// (no-config, semantic, id_match, vocabulary_grounding, missing-field).

describe('source_item_enumeration_completeness (deterministic)', () => {
  it('returns [] when no config matches the (agentRole, subPhaseId)', () => {
    const findings = validateSourceItemEnumerationCompleteness(
      makeRuntime({
        agentRole: 'orchestrator',
        subPhaseId: 'intent_quality_check',
        originalPrompt: 'FR-001 NFR-002',
        outputContent: { system_requirements: [] },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('returns [] for semantic mode (system_boundary) regardless of content', () => {
    const findings = validateSourceItemEnumerationCompleteness(
      makeRuntime({
        agentRole: 'systems_agent',
        subPhaseId: 'system_boundary',
        originalPrompt: 'FR-001 NFR-002',
        outputContent: {},
      }),
    );
    expect(findings).toEqual([]);
  });

  describe('id_match mode (system_requirements)', () => {
    const base = {
      agentRole: 'systems_agent',
      subPhaseId: 'system_requirements',
    } as const;

    it('flags every source id as output_field_missing (HIGH) when field is absent', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'Requirements: FR-001 and NFR-002',
          outputContent: {},
        }),
      );
      expect(findings.length).toBe(2);
      const ids = findings.map((f) => f.location);
      expect(new Set(findings.map((f) => f.type))).toEqual(
        new Set(['output_field_missing']),
      );
      expect(new Set(findings.map((f) => f.severity))).toEqual(new Set(['HIGH']));
      expect(new Set(ids)).toEqual(new Set(['$.system_requirements']));
      expect(findings[0].validatorId).toBe('source_item_enumeration_completeness');
    });

    it('returns [] when every source id is referenced', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'FR-001 and NFR-002',
          outputContent: {
            system_requirements: [
              { source_requirement_ids: ['FR-001', 'NFR-002'] },
            ],
          },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags the dropped id as source_item_silently_dropped (HIGH)', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'FR-001 and NFR-002',
          outputContent: {
            system_requirements: [{ source_requirement_ids: ['FR-001'] }],
          },
        }),
      );
      expect(findings.length).toBe(1);
      expect(findings[0].type).toBe('source_item_silently_dropped');
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].location).toBe(
        '$.system_requirements[*].source_requirement_ids',
      );
      expect(findings[0].summary).toContain('NFR-002');
    });

    it('resolves a single string ref (not only arrays)', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'FR-001',
          outputContent: {
            system_requirements: [{ source_requirement_ids: 'FR-001' }],
          },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('returns [] when the prompt contains no source ids', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'no ids here',
          outputContent: { system_requirements: [] },
        }),
      );
      expect(findings).toEqual([]);
    });
  });

  describe('vocabulary_grounding mode (software_domains)', () => {
    const base = {
      agentRole: 'architecture_agent',
      subPhaseId: 'software_domains',
    } as const;

    it('flags an SR not traced by any term', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'SR-001 SR-002',
          outputContent: { domains: [{ traces_to: ['SR-001'] }] },
        }),
      );
      expect(findings.length).toBe(1);
      expect(findings[0].type).toBe('source_item_silently_dropped');
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].location).toBe(
        '$.domains[*].ubiquitous_language[*].traces_to',
      );
      expect(findings[0].summary).toContain('SR-002');
    });

    it('returns [] when all SRs are covered via traces_to', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'SR-001 SR-002',
          outputContent: { domains: [{ traces_to: ['SR-001', 'SR-002'] }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('resolves coverage via the source_requirements fallback field', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'SR-001',
          outputContent: { domains: [{ source_requirements: ['SR-001'] }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('resolves coverage via the sr_refs fallback field', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'SR-001',
          outputContent: { domains: [{ sr_refs: ['SR-001'] }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags output_field_missing when the domains field is absent', () => {
      const findings = validateSourceItemEnumerationCompleteness(
        makeRuntime({
          ...base,
          originalPrompt: 'SR-001 SR-002',
          outputContent: {},
        }),
      );
      expect(findings.length).toBe(2);
      expect(new Set(findings.map((f) => f.type))).toEqual(
        new Set(['output_field_missing']),
      );
      expect(new Set(findings.map((f) => f.location))).toEqual(
        new Set(['$.domains']),
      );
    });
  });
});
