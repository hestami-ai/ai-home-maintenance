/**
 * Family Law agent factory — routing-driven variant.
 *
 * Per Wave 10.1: builds the per-state agent set directly from a
 * `AgentRoutingConfig` config, resolving providers (with optional fallback) and
 * CLIs through the platform `providerRegistry`. Replay agents passed via
 * `replayByAgentId` win — used for tests / structural thin-slice runs.
 *
 * This is the entry point thin-slice / calibration / orchestrator code uses
 * when the user wants real LLM calls or CLI subprocesses to drive Family Law
 * states. The legacy `buildFamilyLawAgents()` (provider-by-state-map) is kept
 * for unit tests that pre-build providers.
 */

import type { Agent } from '../../lib/agents/agent.js';
import type { CLV } from '../../lib/clv/types.js';
import type { LLMProvider } from '../../lib/llm/provider.js';
import type { PromptTemplateRegistry } from '../../lib/promptTemplates/registry.js';
import type { InvocationLogger } from '../../lib/llm/invocationLogger.js';
import type { ProviderRegistry, ProviderName } from '../../lib/llm/providerRegistry.js';
import type { AgentRoutingConfig, StateAgentRouting } from '../../lib/agents/routing.js';
import { FallbackProvider } from '../../lib/llm/fallbackProvider.js';
import { LlmBackedAgent } from '../../lib/agents/llmBackedAgent.js';
import { CliBackedAgent, type CliKind } from '../../lib/agents/cliBackedAgent.js';
import { FAMILY_LAW_AGENTS } from './manifest.js';

const STATE_TO_AGENT: ReadonlyArray<{ stateId: string; agentId: string; templateId: string }> = [
  { stateId: 'MatterContextNormalize', agentId: FAMILY_LAW_AGENTS.matterContextNormalize, templateId: 'family_law.matter_context_normalize' },
  { stateId: 'JurisdictionCapture', agentId: FAMILY_LAW_AGENTS.jurisdictionCapture, templateId: 'family_law.jurisdiction_capture' },
  { stateId: 'FactExtraction', agentId: FAMILY_LAW_AGENTS.factExtraction, templateId: 'family_law.fact_extraction' },
  { stateId: 'ExistingOrderExtract', agentId: FAMILY_LAW_AGENTS.existingOrderExtract, templateId: 'family_law.existing_order_extract' },
  { stateId: 'IssueBloom', agentId: FAMILY_LAW_AGENTS.issueBloom, templateId: 'family_law.issue_bloom' },
  { stateId: 'IssuePrune', agentId: FAMILY_LAW_AGENTS.issuePrune, templateId: 'family_law.issue_prune' },
  { stateId: 'AuthorityVerification', agentId: FAMILY_LAW_AGENTS.authorityVerification, templateId: 'family_law.authority_verification' },
  { stateId: 'DirectLegalConclusionDraft', agentId: FAMILY_LAW_AGENTS.directLegalConclusion, templateId: 'family_law.direct_legal_conclusion' },
  { stateId: 'ClientAdviceDraft', agentId: FAMILY_LAW_AGENTS.clientAdviceDraft, templateId: 'family_law.client_advice_draft' },
  { stateId: 'CourtFilingDraftGenerate', agentId: FAMILY_LAW_AGENTS.courtFilingDraft, templateId: 'family_law.court_filing_draft' },
  { stateId: 'ReleaseStatusDetermine', agentId: FAMILY_LAW_AGENTS.releaseStatusDetermine, templateId: 'family_law.release_status_determine' },
];

export interface AgentFactoryFromRoutingDeps {
  readonly clv: CLV;
  readonly templateRegistry: PromptTemplateRegistry;
  readonly providerRegistry: ProviderRegistry;
  readonly routing: AgentRoutingConfig;
  readonly invocationLogger?: InvocationLogger;
  /** Override per agentId — wins over routing. Used for replay/tests. */
  readonly replayByAgentId?: ReadonlyMap<string, Agent>;
  /** Sandbox dir for CliBackedAgent (one per per-invocation subdir is created underneath). */
  readonly cliSandboxRoot?: string;
  /** Resolves an authorized source's content for CLI input materialization. */
  readonly resolveSource?: (sourceId: string) => Buffer | string | undefined;
}

interface ResolvedRouting {
  readonly kind: 'llm' | 'cli' | 'replay';
  readonly provider?: ProviderName;
  readonly fallback?: ProviderName;
  readonly cli?: CliKind;
  readonly sampling?: { temperature?: number; maxTokens?: number; model?: string };
}

function resolveRouting(routing: AgentRoutingConfig, stateId: string): ResolvedRouting {
  const override = routing.perState?.find((s: StateAgentRouting) => s.stateId === stateId);
  if (override) {
    return {
      kind: override.kind,
      provider: override.provider ?? routing.defaultProvider,
      fallback: override.fallback ?? routing.defaultFallback,
      cli: override.cli ?? routing.defaultCli,
      sampling: override.sampling,
    };
  }
  return {
    kind: routing.defaultKind,
    provider: routing.defaultProvider,
    fallback: routing.defaultFallback,
    cli: routing.defaultCli,
  };
}

export async function buildFamilyLawAgentsFromRouting(deps: AgentFactoryFromRoutingDeps): Promise<Map<string, Agent>> {
  const agents = new Map<string, Agent>();
  // Cache per (provider name) — providers are stateless across requests.
  const providerCache = new Map<ProviderName, LLMProvider>();
  const resolveProvider = async (name: ProviderName): Promise<LLMProvider> => {
    const cached = providerCache.get(name);
    if (cached) return cached;
    const settings = deps.routing.providerSettings?.[name] ?? {};
    const p = await deps.providerRegistry.resolve({ name, settings });
    providerCache.set(name, p);
    return p;
  };

  for (const r of STATE_TO_AGENT) {
    if (deps.replayByAgentId?.has(r.agentId)) {
      agents.set(r.agentId, deps.replayByAgentId.get(r.agentId)!);
      continue;
    }
    const route = resolveRouting(deps.routing, r.stateId);
    if (route.kind === 'replay') {
      throw new Error(
        `routing for state ${r.stateId} is 'replay' but no replay agent supplied for ${r.agentId}`,
      );
    }
    if (route.kind === 'cli') {
      if (!route.cli) throw new Error(`routing for state ${r.stateId} is 'cli' but no CLI kind supplied`);
      if (!deps.cliSandboxRoot) throw new Error(`routing for state ${r.stateId} is 'cli' but no cliSandboxRoot supplied`);
      agents.set(r.agentId, new CliBackedAgent({
        agentId: r.agentId,
        templateId: r.templateId,
        templateVersion: 'v1',
        cli: route.cli,
        clv: deps.clv,
        templateRegistry: deps.templateRegistry,
        sandboxRoot: deps.cliSandboxRoot,
        invocationLogger: deps.invocationLogger,
        resolveSource: deps.resolveSource,
      }));
      continue;
    }
    // llm
    if (!route.provider) throw new Error(`routing for state ${r.stateId} is 'llm' but no provider supplied`);
    const primary = await resolveProvider(route.provider);
    const provider = route.fallback
      ? new FallbackProvider(primary, [await resolveProvider(route.fallback)])
      : primary;
    agents.set(r.agentId, new LlmBackedAgent({
      agentId: r.agentId,
      templateId: r.templateId,
      templateVersion: 'v1',
      provider,
      clv: deps.clv,
      templateRegistry: deps.templateRegistry,
      invocationLogger: deps.invocationLogger,
      sampling: route.sampling,
    }));
  }
  return agents;
}
