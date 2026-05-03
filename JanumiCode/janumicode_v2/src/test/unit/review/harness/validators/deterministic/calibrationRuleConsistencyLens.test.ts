import { describe, it, expect } from 'vitest';
import { validateCalibrationRuleConsistencyLens } from '../../../../../../lib/review/harness/validators/deterministic/calibrationRuleConsistencyLens';
import { makeRuntime } from './_helpers';

describe('calibration_rule_consistency_lens (deterministic)', () => {
  const baseLens = (extra: Record<string, unknown>) =>
    makeRuntime({
      agentRole: 'orchestrator',
      subPhaseId: 'intent_lens_classification',
      outputContent: extra,
    });

  it('returns [] for high confidence with no competitor mention required', () => {
    const findings = validateCalibrationRuleConsistencyLens(
      baseLens({
        lens: 'product',
        confidence: 0.95,
        rationale: 'clear product framing',
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH on low confidence without competitor disclosure', () => {
    const findings = validateCalibrationRuleConsistencyLens(
      baseLens({
        lens: 'product',
        confidence: 0.6,
        lensCorrectnessRationale: 'unclear',
      }),
    );
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].type).toBe('missing_competitor_disclosure');
  });

  it('returns [] when low confidence rationale names a competitor', () => {
    const findings = validateCalibrationRuleConsistencyLens(
      baseLens({
        lens: 'product',
        confidence: 0.6,
        lensCorrectnessRationale: 'considered feature lens but settled on product',
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags MEDIUM on confidence outside [0,1]', () => {
    const findings = validateCalibrationRuleConsistencyLens(
      baseLens({ lens: 'product', confidence: 1.5, rationale: '' }),
    );
    const m = findings.find((f) => f.type === 'confidence_out_of_range');
    expect(m).toBeDefined();
    expect(m?.severity).toBe('MEDIUM');
  });

  it('returns [] when sub_phase is not lens classification', () => {
    const findings = validateCalibrationRuleConsistencyLens(
      makeRuntime({
        subPhaseId: 'other',
        outputContent: { confidence: 0.1 },
      }),
    );
    expect(findings).toEqual([]);
  });
});
