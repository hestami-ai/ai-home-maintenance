/**
 * Reasoning-Review Harness — dispatch loop (Wave 11).
 *
 * Per docs/design/wave11_reasoning_review_harness.md §3 §9.
 *
 * Behavior:
 *   1. Select applicable validators from the registry.
 *   2. Run deterministic validators in registry order (sequential).
 *   3. Run LLM validators in registry order, threading upstreamFindings.
 *   4. final_synthesis (the last LLM validator) reads all upstream findings
 *      and emits decision: pass | escalate | block.
 *   5. Failures (validator throws, missing invoke fn, missing prompt)
 *      surface as `validator_unavailable` LOW findings — never throw.
 *   6. Reviewer-provider unreachable → decision pinned to `escalate`.
 *
 * The harness DOES NOT write matter-track events directly. It returns a
 * HarnessRunSummary and lets the caller (orchestrator) write the events
 * using the matter-bound MatterTrackWriter — that is the only authority
 * for privilege classification and key selection.
 */

import { randomUUID } from 'node:crypto';
import type {
  ValidatorEntry,
  ValidatorFinding,
  ValidatorRuntimeParams,
  HarnessDecision,
  HarnessRunSummary,
  Severity,
  LlmValidatorInvokeDeps,
} from './types.js';
import type { ReasoningReviewRegistry } from './registry.js';
import type { LLMProvider } from '../llm/provider.js';
import type { PromptTemplateRegistry } from '../promptTemplates/registry.js';
import type { CLV } from '../clv/types.js';

export interface HarnessOptions {
  readonly registry: ReasoningReviewRegistry;
  /** Reviewer LLM provider — must be decorrelated from the primary provider (caller enforces). */
  readonly reviewerProvider?: LLMProvider;
  readonly templateRegistry?: PromptTemplateRegistry;
  readonly clv?: CLV;
  /** Reviewer model name — surfaced in run summary metadata. */
  readonly reviewerModel?: string;
}

export class ReasoningReviewHarness {
  constructor(private readonly opts: HarnessOptions) {}

  async review(p: ValidatorRuntimeParams): Promise<HarnessRunSummary> {
    const harnessRunId = randomUUID();
    const validatorsRun: string[] = [];
    const validatorsUnavailable: string[] = [];
    const findings: ValidatorFinding[] = [];

    const selected = this.opts.registry.select({ stateId: p.stateId, output: p.stateOutput });
    const reviewerUnavailable =
      !this.opts.reviewerProvider || !this.opts.templateRegistry || !this.opts.clv;

    // Run deterministic validators first, then LLM (registry order is preserved
    // within each kind by the catalog; we just stable-partition).
    const deterministic = selected.filter((e): e is Extract<ValidatorEntry, { kind: 'deterministic' }> => e.kind === 'deterministic');
    const llm = selected.filter((e): e is Extract<ValidatorEntry, { kind: 'llm' }> => e.kind === 'llm');

    for (const entry of deterministic) {
      validatorsRun.push(entry.id);
      if (!entry.validate) {
        validatorsUnavailable.push(entry.id);
        findings.push(unavailableFinding(entry.id, 'deterministic validator has no implementation'));
        continue;
      }
      try {
        const raw = entry.validate(p);
        for (const f of raw) {
          findings.push({
            ...f,
            findingId: randomUUID(),
            validatorId: entry.id,
            classification: 'work_product_factual',
          });
        }
      } catch (err) {
        validatorsUnavailable.push(entry.id);
        findings.push(unavailableFinding(entry.id, `validator threw: ${(err as Error).message}`));
      }
    }

    if (reviewerUnavailable) {
      // No reviewer provider — surface the LLM validators as unavailable.
      for (const entry of llm) {
        validatorsRun.push(entry.id);
        validatorsUnavailable.push(entry.id);
        findings.push(unavailableFinding(entry.id, 'reviewer provider not configured'));
      }
      return summarize({ harnessRunId, p, findings, validatorsRun, validatorsUnavailable, decision: 'escalate', reviewerModel: this.opts.reviewerModel });
    }

    const deps: LlmValidatorInvokeDeps = {
      provider: this.opts.reviewerProvider!,
      templateRegistry: this.opts.templateRegistry!,
      clv: this.opts.clv!,
    };

    for (const entry of llm) {
      validatorsRun.push(entry.id);
      if (!entry.invoke) {
        validatorsUnavailable.push(entry.id);
        findings.push(unavailableFinding(entry.id, 'llm validator invoke not implemented (calibration pending)'));
        continue;
      }
      // Final synthesis sees all prior findings.
      const params: ValidatorRuntimeParams =
        entry.id === 'final_synthesis'
          ? { ...p, upstreamFindings: findings.filter((f) => !f.unavailable) }
          : p;
      try {
        const raw = await entry.invoke(params, deps);
        for (const f of raw) {
          findings.push({
            ...f,
            findingId: randomUUID(),
            validatorId: entry.id,
            classification: 'work_product_mental',
          });
        }
      } catch (err) {
        validatorsUnavailable.push(entry.id);
        findings.push(unavailableFinding(entry.id, `validator threw: ${(err as Error).message}`));
      }
    }

    // Determine decision. If final_synthesis emitted a structured decision,
    // honor it. Otherwise derive from severity counts.
    const synth = findings.find((f) => f.validatorId === 'final_synthesis' && f.evidence?.decision);
    const decision: HarnessDecision = synth
      ? (synth.evidence!.decision as HarnessDecision)
      : deriveDecision(findings);

    return summarize({ harnessRunId, p, findings, validatorsRun, validatorsUnavailable, decision, reviewerProvider: this.opts.reviewerProvider?.name, reviewerModel: this.opts.reviewerModel });
  }
}

function unavailableFinding(validatorId: string, message: string): ValidatorFinding {
  return {
    findingId: randomUUID(),
    validatorId,
    severity: 'LOW',
    type: 'validator_unavailable',
    message,
    clvScope: [],
    classification: 'work_product_factual',
    unavailable: true,
  };
}

function deriveDecision(findings: readonly ValidatorFinding[]): HarnessDecision {
  const real = findings.filter((f) => !f.unavailable);
  if (real.some((f) => f.severity === 'HIGH')) return 'escalate';
  return 'pass';
}

function summarize(args: {
  harnessRunId: string;
  p: ValidatorRuntimeParams;
  findings: readonly ValidatorFinding[];
  validatorsRun: readonly string[];
  validatorsUnavailable: readonly string[];
  decision: HarnessDecision;
  reviewerProvider?: string;
  reviewerModel?: string;
}): HarnessRunSummary {
  const real = args.findings.filter((f) => !f.unavailable);
  return {
    harnessRunId: args.harnessRunId,
    stateId: args.p.stateId,
    agentId: args.p.agentId,
    decision: args.decision,
    findings: args.findings,
    severityCounts: {
      HIGH: real.filter((f) => f.severity === 'HIGH').length,
      MEDIUM: real.filter((f) => f.severity === 'MEDIUM').length,
      LOW: real.filter((f) => f.severity === 'LOW').length,
    },
    validatorsRun: args.validatorsRun,
    validatorsUnavailable: args.validatorsUnavailable,
    reviewerProvider: args.reviewerProvider,
    reviewerModel: args.reviewerModel,
  };
}
