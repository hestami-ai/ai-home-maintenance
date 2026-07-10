import { describe, it, expect } from 'vitest';
import { validateExtractionIdTraceability } from '../../../../../../lib/review/harness/validators/deterministic/extractionIdTraceability';
import { makeRuntime } from './_helpers';

describe('extraction_id_traceability (deterministic)', () => {
  it('returns [] when outputContent is null', () => {
    expect(
      validateExtractionIdTraceability(makeRuntime({ outputContent: null })),
    ).toEqual([]);
  });

  it('flags a duplicate id (HIGH + targetField) when path resolves to a top-level field', () => {
    const findings = validateExtractionIdTraceability(
      makeRuntime({
        outputContent: {
          user_stories: [{ id: 'US-001' }, { id: 'US-001' }],
        },
      }),
    );
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.validatorId).toBe('extraction_id_traceability');
    expect(f.type).toBe('duplicate_id');
    expect(f.severity).toBe('HIGH');
    expect(f.location).toBe('$.user_stories[1].id');
    expect(f.targetField).toBe('user_stories');
    expect(f.targetIdentifier).toBe('US-001');
    expect(f.detail).toContain('$.user_stories[0].id');
  });

  it('flags a duplicate id at a root-array path as MEDIUM with no targetField', () => {
    const findings = validateExtractionIdTraceability(
      makeRuntime({
        outputContent: [{ id: 'US-001' }, { id: 'US-001' }],
      }),
    );
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.type).toBe('duplicate_id');
    expect(f.severity).toBe('MEDIUM');
    expect(f.location).toBe('$[1].id');
    expect(f.targetField).toBeUndefined();
    expect(f.targetIdentifier).toBeUndefined();
  });

  it('flags a malformed id (HIGH + targetField) when it does not match PREFIX-NNN', () => {
    const findings = validateExtractionIdTraceability(
      makeRuntime({
        outputContent: { items: [{ id: 'bad_id' }] },
      }),
    );
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.type).toBe('malformed_id');
    expect(f.severity).toBe('HIGH');
    expect(f.location).toBe('$.items[0].id');
    expect(f.targetField).toBe('items');
    expect(f.targetIdentifier).toBe('bad_id');
  });

  it('does not run the prefix check when subPhaseId has no PREFIX_RULES entry', () => {
    const findings = validateExtractionIdTraceability(
      makeRuntime({
        subPhaseId: 'intent_quality_check',
        outputContent: { items: [{ id: 'XX-001' }] },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags an unexpected prefix (MEDIUM) for a pass with PREFIX_RULES', () => {
    const findings = validateExtractionIdTraceability(
      makeRuntime({
        subPhaseId: 'vv_requirements_discovery',
        outputContent: { items: [{ id: 'XX-001' }] },
      }),
    );
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.type).toBe('unexpected_prefix');
    expect(f.severity).toBe('MEDIUM');
    expect(f.location).toBe('$.items[0].id');
    // The prefix finding does not carry a targetField.
    expect(f.targetField).toBeUndefined();
  });

  it('does not flag an id that carries the expected prefix for the pass', () => {
    const findings = validateExtractionIdTraceability(
      makeRuntime({
        subPhaseId: 'vv_requirements_discovery',
        outputContent: { items: [{ id: 'VV-001' }] },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('emits duplicate findings before malformed findings', () => {
    const findings = validateExtractionIdTraceability(
      makeRuntime({
        outputContent: {
          user_stories: [{ id: 'DUP-001' }, { id: 'DUP-001' }],
          other: [{ id: 'bad' }],
        },
      }),
    );
    expect(findings).toHaveLength(2);
    expect(findings[0].type).toBe('duplicate_id');
    expect(findings[1].type).toBe('malformed_id');
  });
});
