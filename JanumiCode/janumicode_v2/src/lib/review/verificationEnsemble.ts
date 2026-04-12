/**
 * Verification Ensemble — two Reasoning Review calls on the same output
 * using different model providers.
 * Based on JanumiCode Spec v2.3, §8.1 (Verification Ensemble section).
 *
 * Triggered at: Phase Gate evaluations, implementation_divergence checks.
 * Agreement requires both: identical overall_pass AND no severity disagreements.
 */

import {
  ReasoningReview,
  type ReasoningReviewInput,
  type ReasoningReviewResult,
  type ReasoningReviewConfig,
} from './reasoningReview';
import { getLogger } from '../logging';
import { LLMCaller } from '../llm/llmCaller';
import { ContextBuilder } from '../orchestrator/contextBuilder';
import { TemplateLoader } from '../orchestrator/templateLoader';

// ── Types ───────────────────────────────────────────────────────────

export type AgreementType = 'full' | 'severity_disagreement' | 'overall_disagreement';

export interface SeverityDisagreement {
  flawType: string;
  primarySeverity: 'high' | 'low' | 'absent';
  secondarySeverity: 'high' | 'low' | 'absent';
}

export interface EnsembleResult {
  primaryResult: ReasoningReviewResult;
  secondaryResult: ReasoningReviewResult | null;
  agreement: boolean;
  agreementType: AgreementType;
  severityDisagreements: SeverityDisagreement[];
  /** Whether the secondary provider failed (primary accepted without confirmation) */
  secondaryFailed: boolean;
  secondaryFailureReason?: string;
}

export interface EnsembleConfig {
  primaryConfig: ReasoningReviewConfig;
  secondaryConfig: ReasoningReviewConfig;
  /** Whether to warn on same-provider configuration */
  warnOnSameProvider: boolean;
}

// ── VerificationEnsemble ────────────────────────────────────────────

export class VerificationEnsemble {
  private primaryReview: ReasoningReview;
  private secondaryReview: ReasoningReview;
  private sameProviderWarned = false;

  constructor(
    llmCaller: LLMCaller,
    contextBuilder: ContextBuilder,
    templateLoader: TemplateLoader,
    private readonly config: EnsembleConfig,
  ) {
    this.primaryReview = new ReasoningReview(llmCaller, contextBuilder, templateLoader, config.primaryConfig);
    this.secondaryReview = new ReasoningReview(llmCaller, contextBuilder, templateLoader, config.secondaryConfig);

    // Same-provider detection per spec
    if (config.warnOnSameProvider &&
        config.primaryConfig.provider === config.secondaryConfig.provider &&
        config.primaryConfig.model === config.secondaryConfig.model &&
        !this.sameProviderWarned) {
      getLogger().warn('validation', 'Verification Ensemble configured with identical providers — no independent signal provided', {
        primary_provider: config.primaryConfig.provider,
        primary_model: config.primaryConfig.model,
        secondary_provider: config.secondaryConfig.provider,
        secondary_model: config.secondaryConfig.model,
      });
      this.sameProviderWarned = true;
    }
  }

  /**
   * Run the Verification Ensemble — primary + secondary review.
   */
  async evaluate(input: ReasoningReviewInput): Promise<EnsembleResult> {
    // Run primary
    const primaryResult = await this.primaryReview.review(input);

    // Run secondary
    let secondaryResult: ReasoningReviewResult | null = null;
    let secondaryFailed = false;
    let secondaryFailureReason: string | undefined;

    try {
      secondaryResult = await this.secondaryReview.review(input);
    } catch (err) {
      secondaryFailed = true;
      secondaryFailureReason = err instanceof Error ? err.message : String(err);
    }

    // If secondary failed, accept primary without confirmation
    if (secondaryFailed || !secondaryResult) {
      return {
        primaryResult,
        secondaryResult: null,
        agreement: true, // Primary accepted by default
        agreementType: 'full',
        severityDisagreements: [],
        secondaryFailed: true,
        secondaryFailureReason,
      };
    }

    // Compare results
    const { agreement, agreementType, severityDisagreements } =
      this.compareResults(primaryResult, secondaryResult);

    return {
      primaryResult,
      secondaryResult,
      agreement,
      agreementType,
      severityDisagreements,
      secondaryFailed: false,
    };
  }

  /**
   * Compare primary and secondary results.
   * Agreement requires BOTH: identical overall_pass AND no severity disagreements.
   */
  private compareResults(
    primary: ReasoningReviewResult,
    secondary: ReasoningReviewResult,
  ): { agreement: boolean; agreementType: AgreementType; severityDisagreements: SeverityDisagreement[] } {
    // Check overall_pass agreement
    if (primary.overallPass !== secondary.overallPass) {
      return {
        agreement: false,
        agreementType: 'overall_disagreement',
        severityDisagreements: [],
      };
    }

    // Check severity disagreements
    const severityDisagreements = this.findSeverityDisagreements(primary, secondary);

    if (severityDisagreements.length > 0) {
      return {
        agreement: false,
        agreementType: 'severity_disagreement',
        severityDisagreements,
      };
    }

    return {
      agreement: true,
      agreementType: 'full',
      severityDisagreements: [],
    };
  }

  /**
   * Find flaws where one review found severity:high and the other found
   * severity:low or nothing for the same flaw type.
   */
  private findSeverityDisagreements(
    primary: ReasoningReviewResult,
    secondary: ReasoningReviewResult,
  ): SeverityDisagreement[] {
    const disagreements: SeverityDisagreement[] = [];

    // Build severity maps
    const primaryFlawMap = new Map<string, 'high' | 'low'>();
    for (const f of primary.flaws) {
      const existing = primaryFlawMap.get(f.flawType);
      if (!existing || f.severity === 'high') {
        primaryFlawMap.set(f.flawType, f.severity);
      }
    }

    const secondaryFlawMap = new Map<string, 'high' | 'low'>();
    for (const f of secondary.flaws) {
      const existing = secondaryFlawMap.get(f.flawType);
      if (!existing || f.severity === 'high') {
        secondaryFlawMap.set(f.flawType, f.severity);
      }
    }

    // Check all flaw types from both
    const allFlawTypes = new Set([...primaryFlawMap.keys(), ...secondaryFlawMap.keys()]);

    for (const flawType of allFlawTypes) {
      const pSev = primaryFlawMap.get(flawType) ?? 'absent';
      const sSev = secondaryFlawMap.get(flawType) ?? 'absent';

      // Disagreement: one is high, the other is low or absent
      if ((pSev === 'high' && sSev !== 'high') || (sSev === 'high' && pSev !== 'high')) {
        disagreements.push({
          flawType,
          primarySeverity: pSev,
          secondarySeverity: sSev,
        });
      }
    }

    return disagreements;
  }
}
