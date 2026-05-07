import { describe, it, expect } from 'vitest';
import { validateEntityKindConsistency } from '../../../../../../lib/review/harness/validators/deterministic/entityKindConsistencyValidator';
import { makeRuntime } from './_helpers';

describe('entity_kind_consistency_validator (deterministic)', () => {
  it('returns [] when outputContent is null', () => {
    expect(validateEntityKindConsistency(makeRuntime({ outputContent: null }))).toEqual([]);
  });

  it('returns [] when no children present', () => {
    expect(
      validateEntityKindConsistency(makeRuntime({ outputContent: { children: [] } })),
    ).toEqual([]);
  });

  it('returns [] for value_type child with no identity signal', () => {
    expect(
      validateEntityKindConsistency(
        makeRuntime({
          outputContent: {
            children: [{ name: 'Address', kind: 'value_type', is_identity: false }],
          },
        }),
      ),
    ).toEqual([]);
  });

  it('returns [] for identity-named child correctly classified as aggregate_root', () => {
    expect(
      validateEntityKindConsistency(
        makeRuntime({
          outputContent: {
            children: [{ name: 'PropertyIdentity', kind: 'aggregate_root' }],
          },
        }),
      ),
    ).toEqual([]);
  });

  it('flags MEDIUM when is_identity=true child is classified as value_type', () => {
    const findings = validateEntityKindConsistency(
      makeRuntime({
        outputContent: {
          children: [{ name: 'Foo', kind: 'value_type', is_identity: true }],
        },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('MEDIUM');
    expect(findings[0].type).toBe('pk_holder_classified_as_value_type');
    expect(findings[0].location).toBe('$.children[0].kind');
  });

  it('flags when child name matches identity pattern (PropertyIdentity)', () => {
    const findings = validateEntityKindConsistency(
      makeRuntime({
        outputContent: {
          children: [{ name: 'PropertyIdentity', kind: 'value_type' }],
        },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].validatorId).toBe('entity_kind_consistency_validator');
  });

  it('flags when child name matches "Root" pattern', () => {
    const findings = validateEntityKindConsistency(
      makeRuntime({
        outputContent: {
          children: [{ name: 'WorkOrderRoot', kind: 'value_type' }],
        },
      }),
    );
    expect(findings).toHaveLength(1);
  });

  it('falls back to entity_name then id when name is absent', () => {
    const findings = validateEntityKindConsistency(
      makeRuntime({
        outputContent: {
          children: [{ entity_name: 'AssetIdentity', kind: 'value_type' }],
        },
      }),
    );
    expect(findings).toHaveLength(1);
  });

  it('uses decomposed_children when children is absent', () => {
    const findings = validateEntityKindConsistency(
      makeRuntime({
        outputContent: {
          decomposed_children: [{ name: 'FooIdentity', kind: 'value_type' }],
        },
      }),
    );
    expect(findings).toHaveLength(1);
  });

  it('skips non-object child entries safely', () => {
    expect(
      validateEntityKindConsistency(
        makeRuntime({
          outputContent: { children: [null, 'string', 42, { name: 'OK', kind: 'entity' }] },
        }),
      ),
    ).toEqual([]);
  });
});
