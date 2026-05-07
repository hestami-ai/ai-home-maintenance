import { describe, it, expect } from 'vitest';
import { validateJsonOutputDiscipline } from '../../../../../../lib/review/harness/validators/deterministic/jsonOutputDisciplineCheck';
import { makeRuntime } from './_helpers';

describe('json_output_discipline_check (deterministic pre-validator)', () => {
  it('returns [] for a clean bare JSON object', () => {
    expect(
      validateJsonOutputDiscipline(makeRuntime({ outputText: '{"ok": true}' })),
    ).toEqual([]);
  });

  it('returns [] for a clean bare JSON array', () => {
    expect(
      validateJsonOutputDiscipline(makeRuntime({ outputText: '[1, 2, 3]' })),
    ).toEqual([]);
  });

  it('returns [] for empty outputText', () => {
    expect(validateJsonOutputDiscipline(makeRuntime({ outputText: '' }))).toEqual([]);
  });

  it('flags HIGH on markdown fence wrapper (```json)', () => {
    const findings = validateJsonOutputDiscipline(
      makeRuntime({ outputText: '```json\n{"key": "value"}\n```' }),
    );
    const high = findings.find((f) => f.severity === 'HIGH');
    expect(high).toBeDefined();
    expect(high?.type).toBe('markdown_fence_wrapper');
  });

  it('flags HIGH on plain ``` fence', () => {
    const findings = validateJsonOutputDiscipline(
      makeRuntime({ outputText: '```\n{"key": "value"}\n```' }),
    );
    expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
  });

  it('flags HIGH on leading prose before JSON', () => {
    const findings = validateJsonOutputDiscipline(
      makeRuntime({ outputText: 'Here is the output:\n{"key": "value"}' }),
    );
    const high = findings.find((f) => f.severity === 'HIGH');
    expect(high).toBeDefined();
    expect(high?.type).toBe('leading_prose');
  });

  it('flags MEDIUM on trailing prose after closing brace', () => {
    const findings = validateJsonOutputDiscipline(
      makeRuntime({ outputText: '{"key": "value"}\n\nHope this helps!' }),
    );
    const med = findings.find((f) => f.severity === 'MEDIUM');
    expect(med).toBeDefined();
    expect(med?.type).toBe('trailing_prose');
  });

  it('validatorId is correct on all findings', () => {
    const findings = validateJsonOutputDiscipline(
      makeRuntime({ outputText: '```json\n{}\n```' }),
    );
    for (const f of findings) {
      expect(f.validatorId).toBe('json_output_discipline_check');
    }
  });
});
