/**
 * PhaseGateEvaluator — evaluates Phase Gate criteria in strict order with short-circuit.
 * Based on JanumiCode Spec v2.3, §7.11.
 *
 * Evaluation order:
 *   1. Schema validation (deterministic)
 *   2. Invariant checks (deterministic)
 *   3. Reasoning Review results (cached from sub-phases)
 *   4. Consistency report: zero critical failures
 *   5. Domain attestation confirmed (human input)
 *   6. Verification Ensemble (LLM — invoked at gate time)
 *   7. Human approval
 *
 * Short-circuit: if any criterion fails, remaining criteria are NOT evaluated.
 */

// ── Types ───────────────────────────────────────────────────────────

export type GateCriterionType =
  | 'schema_validation'
  | 'invariant_checks'
  | 'reasoning_review'
  | 'consistency_report'
  | 'domain_attestation'
  | 'verification_ensemble'
  | 'human_approval';

export interface GateCriterionResult {
  criterion: GateCriterionType;
  passed: boolean;
  details: string;
  /** Whether this criterion was actually evaluated (false if short-circuited) */
  evaluated: boolean;
}

export interface PhaseGateResult {
  phaseId: string;
  overallPass: boolean;
  criteria: GateCriterionResult[];
  /** The first criterion that failed (if any) */
  failedAt: GateCriterionType | null;
  /** Whether Verification Ensemble was triggered */
  verificationEnsembleUsed: boolean;
}

/**
 * Input providers for each criterion. The PhaseGateEvaluator calls these
 * lazily — short-circuit means later providers may never be called.
 */
export interface GateCriterionProviders {
  /** Check all artifacts are schema-valid */
  checkSchemaValidation: () => GateCriterionResult;
  /** Check all invariants pass */
  checkInvariantChecks: () => GateCriterionResult;
  /** Check cached Reasoning Review results from sub-phases */
  checkReasoningReview: () => GateCriterionResult;
  /** Check consistency report has zero critical failures */
  checkConsistencyReport: () => GateCriterionResult;
  /** Check domain attestation was confirmed (Phase 2 only, others skip) */
  checkDomainAttestation: () => GateCriterionResult;
  /** Run Verification Ensemble (async — LLM call at gate time) */
  runVerificationEnsemble: () => Promise<GateCriterionResult>;
  /** Check human has approved */
  checkHumanApproval: () => GateCriterionResult;
}

// ── PhaseGateEvaluator ──────────────────────────────────────────────

export class PhaseGateEvaluator {
  /**
   * Evaluate all Phase Gate criteria in order with short-circuit.
   */
  async evaluate(
    phaseId: string,
    providers: GateCriterionProviders,
    options?: {
      /** Skip Verification Ensemble (for phases that don't require it) */
      skipVerificationEnsemble?: boolean;
      /** Skip domain attestation (for phases that don't require it) */
      skipDomainAttestation?: boolean;
      /** Skip human approval (for automated testing) */
      skipHumanApproval?: boolean;
    },
  ): Promise<PhaseGateResult> {
    const criteria: GateCriterionResult[] = [];
    let failedAt: GateCriterionType | null = null;
    let verificationEnsembleUsed = false;

    // Helper to evaluate a criterion and short-circuit on failure
    const evalCriterion = (result: GateCriterionResult): boolean => {
      criteria.push(result);
      if (!result.passed) {
        failedAt = result.criterion;
        return false; // short-circuit
      }
      return true;
    };

    const skipCriterion = (criterion: GateCriterionType, reason: string): void => {
      criteria.push({
        criterion,
        passed: true,
        details: `Skipped: ${reason}`,
        evaluated: false,
      });
    };

    // 1. Schema validation (deterministic)
    if (!evalCriterion(providers.checkSchemaValidation())) {
      return this.buildResult(phaseId, criteria, failedAt, verificationEnsembleUsed);
    }

    // 2. Invariant checks (deterministic)
    if (!evalCriterion(providers.checkInvariantChecks())) {
      return this.buildResult(phaseId, criteria, failedAt, verificationEnsembleUsed);
    }

    // 3. Reasoning Review results (cached)
    if (!evalCriterion(providers.checkReasoningReview())) {
      return this.buildResult(phaseId, criteria, failedAt, verificationEnsembleUsed);
    }

    // 4. Consistency report
    if (!evalCriterion(providers.checkConsistencyReport())) {
      return this.buildResult(phaseId, criteria, failedAt, verificationEnsembleUsed);
    }

    // 5. Domain attestation (only required for Phase 2)
    if (options?.skipDomainAttestation) {
      skipCriterion('domain_attestation', 'Not required for this phase');
    } else {
      if (!evalCriterion(providers.checkDomainAttestation())) {
        return this.buildResult(phaseId, criteria, failedAt, verificationEnsembleUsed);
      }
    }

    // 6. Verification Ensemble (LLM — async)
    if (options?.skipVerificationEnsemble) {
      skipCriterion('verification_ensemble', 'Disabled for this evaluation');
    } else {
      verificationEnsembleUsed = true;
      const ensembleResult = await providers.runVerificationEnsemble();
      if (!evalCriterion(ensembleResult)) {
        return this.buildResult(phaseId, criteria, failedAt, verificationEnsembleUsed);
      }
    }

    // 7. Human approval
    if (options?.skipHumanApproval) {
      skipCriterion('human_approval', 'Automated testing mode');
    } else {
      if (!evalCriterion(providers.checkHumanApproval())) {
        return this.buildResult(phaseId, criteria, failedAt, verificationEnsembleUsed);
      }
    }

    return this.buildResult(phaseId, criteria, failedAt, verificationEnsembleUsed);
  }

  private buildResult(
    phaseId: string,
    criteria: GateCriterionResult[],
    failedAt: GateCriterionType | null,
    verificationEnsembleUsed: boolean,
  ): PhaseGateResult {
    return {
      phaseId,
      overallPass: failedAt === null,
      criteria,
      failedAt,
      verificationEnsembleUsed,
    };
  }
}
