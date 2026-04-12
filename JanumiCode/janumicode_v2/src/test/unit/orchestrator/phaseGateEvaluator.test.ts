import { describe, it, expect } from 'vitest';
import {
  PhaseGateEvaluator,
  type GateCriterionProviders,
  type GateCriterionResult,
} from '../../../lib/orchestrator/phaseGateEvaluator';

function pass(criterion: GateCriterionResult['criterion']): GateCriterionResult {
  return { criterion, passed: true, details: 'OK', evaluated: true };
}

function fail(criterion: GateCriterionResult['criterion'], details: string): GateCriterionResult {
  return { criterion, passed: false, details, evaluated: true };
}

function makeProviders(overrides: Partial<GateCriterionProviders> = {}): GateCriterionProviders {
  return {
    checkSchemaValidation: () => pass('schema_validation'),
    checkInvariantChecks: () => pass('invariant_checks'),
    checkReasoningReview: () => pass('reasoning_review'),
    checkConsistencyReport: () => pass('consistency_report'),
    checkDomainAttestation: () => pass('domain_attestation'),
    runVerificationEnsemble: async () => pass('verification_ensemble'),
    checkHumanApproval: () => pass('human_approval'),
    ...overrides,
  };
}

describe('PhaseGateEvaluator', () => {
  const evaluator = new PhaseGateEvaluator();

  it('passes when all criteria pass', async () => {
    const result = await evaluator.evaluate('1', makeProviders());
    expect(result.overallPass).toBe(true);
    expect(result.failedAt).toBeNull();
    expect(result.criteria.length).toBe(7);
  });

  describe('short-circuit evaluation', () => {
    it('stops at schema_validation failure', async () => {
      const providers = makeProviders({
        checkSchemaValidation: () => fail('schema_validation', 'Missing required field'),
      });

      const result = await evaluator.evaluate('1', providers);
      expect(result.overallPass).toBe(false);
      expect(result.failedAt).toBe('schema_validation');
      // Only schema_validation was evaluated
      expect(result.criteria.length).toBe(1);
      expect(result.criteria[0].criterion).toBe('schema_validation');
    });

    it('stops at invariant_checks failure (skips reasoning review and beyond)', async () => {
      const providers = makeProviders({
        checkInvariantChecks: () => fail('invariant_checks', 'CM-001 violation'),
      });

      const result = await evaluator.evaluate('1', providers);
      expect(result.overallPass).toBe(false);
      expect(result.failedAt).toBe('invariant_checks');
      expect(result.criteria.length).toBe(2); // schema + invariant
    });

    it('stops at reasoning_review failure', async () => {
      const providers = makeProviders({
        checkReasoningReview: () => fail('reasoning_review', 'High-severity flaw: unsupported_assumption'),
      });

      const result = await evaluator.evaluate('1', providers);
      expect(result.overallPass).toBe(false);
      expect(result.failedAt).toBe('reasoning_review');
      expect(result.criteria.length).toBe(3);
    });

    it('stops at consistency_report failure', async () => {
      const providers = makeProviders({
        checkConsistencyReport: () => fail('consistency_report', 'Critical traceability failure'),
      });

      const result = await evaluator.evaluate('1', providers);
      expect(result.overallPass).toBe(false);
      expect(result.failedAt).toBe('consistency_report');
      expect(result.criteria.length).toBe(4);
    });

    it('does not call LLM ensemble when deterministic checks fail', async () => {
      let ensembleCalled = false;
      const providers = makeProviders({
        checkSchemaValidation: () => fail('schema_validation', 'Bad schema'),
        runVerificationEnsemble: async () => {
          ensembleCalled = true;
          return pass('verification_ensemble');
        },
      });

      await evaluator.evaluate('1', providers);
      expect(ensembleCalled).toBe(false);
    });
  });

  describe('optional criteria', () => {
    it('skips domain attestation when option set', async () => {
      const result = await evaluator.evaluate('1', makeProviders(), {
        skipDomainAttestation: true,
      });

      expect(result.overallPass).toBe(true);
      const attestation = result.criteria.find(c => c.criterion === 'domain_attestation');
      expect(attestation?.evaluated).toBe(false);
      expect(attestation?.details).toContain('Skipped');
    });

    it('skips verification ensemble when option set', async () => {
      const result = await evaluator.evaluate('1', makeProviders(), {
        skipVerificationEnsemble: true,
      });

      expect(result.overallPass).toBe(true);
      expect(result.verificationEnsembleUsed).toBe(false);
    });

    it('skips human approval in automated testing mode', async () => {
      const result = await evaluator.evaluate('1', makeProviders(), {
        skipHumanApproval: true,
      });

      expect(result.overallPass).toBe(true);
      const approval = result.criteria.find(c => c.criterion === 'human_approval');
      expect(approval?.evaluated).toBe(false);
    });
  });

  it('records verificationEnsembleUsed when ensemble runs', async () => {
    const result = await evaluator.evaluate('1', makeProviders());
    expect(result.verificationEnsembleUsed).toBe(true);
  });
});
