/**
 * Reasoning-Review Harness — core types (Wave 11).
 *
 * Per docs/design/wave11_reasoning_review_harness.md §4.
 *
 * The harness runs a curated set of validators against each (state, prompt,
 * output) tuple after the primary state agent completes. Decorrelated
 * reviewer model required (enforced at agent-build time elsewhere).
 *
 * Findings are written through the matter-track writer at the appropriate
 * privilege classification:
 *   - deterministic findings → work_product_factual
 *   - LLM findings           → work_product_mental
 */

import type { AgentInvocationScope } from '../scope/agentInvocationScope.js';
import type { LLMProvider } from '../llm/provider.js';
import type { PromptTemplateRegistry } from '../promptTemplates/registry.js';
import type { CLV } from '../clv/types.js';

export type ValidatorFamily =
  | 'cross_state'
  | 'fact_extraction'
  | 'authority'
  | 'issue_bloom'
  | 'issue_prune'
  | 'conclusion'
  | 'client_advice'
  | 'filing'
  | 'release'
  | 'final_synthesis';

export type ValidatorKind = 'deterministic' | 'llm';

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export type HarnessDecision = 'pass' | 'escalate' | 'block';

export interface ValidatorRuntimeParams {
  readonly stateId: string;
  readonly agentId: string;
  /** Parsed JSON output (or undefined if upstream surfaced unparseable content). */
  readonly stateOutput: unknown;
  /** Raw completion text — for echo / extract / verbatim checks. */
  readonly stateOutputText: string;
  readonly assembledPrompt: { readonly system: string; readonly user: string };
  readonly envelope: AgentInvocationScope;
  /** Authorized prior artifacts from upstream states (CLV-scoped), keyed by stateId. */
  readonly priorArtifactsByState?: ReadonlyMap<string, unknown>;
  /** Findings produced earlier this turn (final_synthesis reads). */
  readonly upstreamFindings?: readonly ValidatorFinding[];
  /** Parsed authorized source bodies, keyed by sourceId — for grounding/quote checks. */
  readonly authorizedSourceContent?: ReadonlyMap<string, string>;
}

export interface ValidatorFinding {
  readonly findingId: string;
  readonly validatorId: string;
  readonly severity: Severity;
  /** Validator-specific finding type. */
  readonly type: string;
  readonly message: string;
  readonly clvScope: readonly string[];
  readonly classification: 'work_product_factual' | 'work_product_mental';
  readonly evidence?: Readonly<Record<string, unknown>>;
  /** When true, the harness will record validator_unavailable rather than the finding payload. */
  readonly unavailable?: boolean;
}

export interface ValidatorApplicabilityArgs {
  readonly stateId: string;
  readonly output: unknown;
}

interface BaseValidatorEntry {
  readonly id: string;
  readonly family: ValidatorFamily;
  readonly description: string;
  readonly appliesTo: (p: ValidatorApplicabilityArgs) => boolean;
  /** CLV terms the validator reasons about. */
  readonly clvScope: readonly string[];
}

export interface DeterministicValidatorEntry extends BaseValidatorEntry {
  readonly kind: 'deterministic';
  /** undefined → the registry surfaces validator_unavailable. */
  readonly validate?: (p: ValidatorRuntimeParams) => readonly Omit<ValidatorFinding, 'findingId' | 'classification' | 'validatorId'>[];
}

export interface LlmValidatorInvokeDeps {
  readonly provider: LLMProvider;
  readonly templateRegistry: PromptTemplateRegistry;
  readonly clv: CLV;
}

export interface LlmValidatorEntry extends BaseValidatorEntry {
  readonly kind: 'llm';
  /** templateId in the PromptTemplateRegistry. */
  readonly templateId: string;
  readonly templateVersion: string;
  /** undefined → the registry surfaces validator_unavailable. */
  readonly invoke?: (
    p: ValidatorRuntimeParams,
    deps: LlmValidatorInvokeDeps,
  ) => Promise<readonly Omit<ValidatorFinding, 'findingId' | 'classification' | 'validatorId'>[]>;
}

export type ValidatorEntry = DeterministicValidatorEntry | LlmValidatorEntry;

export interface HarnessRunSummary {
  readonly harnessRunId: string;
  readonly stateId: string;
  readonly agentId: string;
  readonly decision: HarnessDecision;
  readonly findings: readonly ValidatorFinding[];
  readonly severityCounts: { readonly HIGH: number; readonly MEDIUM: number; readonly LOW: number };
  readonly validatorsRun: readonly string[];
  readonly validatorsUnavailable: readonly string[];
  readonly reviewerProvider?: string;
  readonly reviewerModel?: string;
}
