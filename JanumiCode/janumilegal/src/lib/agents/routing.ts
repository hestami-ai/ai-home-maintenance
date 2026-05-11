/**
 * Layer 1 — agent routing types.
 *
 * Per Wave 10.1: a routing config selects which execution kind (LLM / CLI /
 * replay) drives each lens state. Layer 3 firm configs reference this type;
 * Layer 2 agent factories consume it. The types live here so Layer 2 can
 * import them without violating the layer 1 < layer 2 < layer 3 import rule.
 */

import type { CliKind } from './cliBackedAgent.js';
import type { ProviderName } from '../llm/providerRegistry.js';

export interface StateAgentRouting {
  readonly stateId: string;
  readonly kind: 'llm' | 'cli' | 'replay';
  readonly provider?: ProviderName;
  readonly fallback?: ProviderName;
  readonly cli?: CliKind;
  readonly sampling?: { temperature?: number; maxTokens?: number; model?: string };
}

export interface AgentRoutingConfig {
  readonly defaultKind: 'llm' | 'cli' | 'replay';
  readonly defaultProvider?: ProviderName;
  readonly defaultFallback?: ProviderName;
  readonly defaultCli?: CliKind;
  readonly perState?: readonly StateAgentRouting[];
  readonly providerSettings?: Readonly<Record<ProviderName, Readonly<Record<string, unknown>>>>;

  /**
   * Wave 11: reviewer provider for the reasoning-review harness. MUST
   * resolve to a different (provider, model) tuple than `defaultProvider`
   * + the model the primary state agent uses. Decorrelation invariant is
   * enforced at agent-build time — see `assertReviewerDecorrelated`.
   *
   * When omitted, the harness still runs deterministic validators but
   * surfaces every LLM validator as `validator_unavailable`.
   */
  readonly reviewerProvider?: ProviderName;
  readonly reviewerModel?: string;
  readonly reviewerFallback?: ProviderName;
}

/**
 * Decorrelation invariant: throws when reviewer == primary on the
 * (provider, model) tuple. Caller passes the resolved primary tuple.
 */
export function assertReviewerDecorrelated(args: {
  primaryProvider: ProviderName | undefined;
  primaryModel: string | undefined;
  reviewerProvider: ProviderName | undefined;
  reviewerModel: string | undefined;
}): void {
  if (!args.reviewerProvider) return; // reviewer optional
  if (
    args.primaryProvider === args.reviewerProvider &&
    (args.primaryModel ?? '') === (args.reviewerModel ?? '')
  ) {
    throw new Error(
      `reasoning-review decorrelation invariant violated: reviewer (${args.reviewerProvider}/${args.reviewerModel ?? 'default'}) equals primary (${args.primaryProvider}/${args.primaryModel ?? 'default'})`,
    );
  }
}
