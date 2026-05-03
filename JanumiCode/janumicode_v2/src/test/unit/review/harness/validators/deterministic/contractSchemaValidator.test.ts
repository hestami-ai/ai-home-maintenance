import { describe, it, expect } from 'vitest';
import { validateContractSchema } from '../../../../../../lib/review/harness/validators/deterministic/contractSchemaValidator';
import { makeRuntime } from './_helpers';

describe('contract_schema_validator (deterministic)', () => {
  it('returns [] for valid IQC output', () => {
    const findings = validateContractSchema(
      makeRuntime({
        outputContent: { overall_status: 'pass', concerns: [] },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH for missing required field', () => {
    const findings = validateContractSchema(
      makeRuntime({ outputContent: { concerns: [] } }),
    );
    const high = findings.filter((f) => f.severity === 'HIGH');
    expect(high.length).toBeGreaterThan(0);
    expect(high[0].type).toBe('missing_required_field');
    expect(high[0].location).toBe('$.overall_status');
  });

  it('flags MEDIUM for wrong-enum value', () => {
    const findings = validateContractSchema(
      makeRuntime({
        outputContent: { overall_status: 'maybe', concerns: [] },
      }),
    );
    const med = findings.find((f) => f.severity === 'MEDIUM');
    expect(med).toBeDefined();
    expect(med?.type).toBe('wrong_enum');
  });

  it('flags HIGH on parse failure (outputContent=null with non-empty text)', () => {
    const findings = validateContractSchema(
      makeRuntime({ outputContent: null, outputText: 'not json' }),
    );
    expect(findings[0].type).toBe('invalid_json');
    expect(findings[0].severity).toBe('HIGH');
  });

  it('returns [] for unsampled (role, sub_phase) pair', () => {
    const findings = validateContractSchema(
      makeRuntime({
        agentRole: 'systems_agent',
        subPhaseId: 'unknown_sub_phase',
        outputContent: { foo: 'bar' },
      }),
    );
    expect(findings).toEqual([]);
  });
});
