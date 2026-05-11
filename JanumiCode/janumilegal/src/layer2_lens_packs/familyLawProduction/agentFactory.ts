/**
 * Family Law Production Lens — agent factory.
 *
 * Per Wave 10: builds the per-state agent set for the Family Law lens
 * given a provider routing config. Handles three agent kinds:
 *   - 'llm'     → LlmBackedAgent
 *   - 'cli'     → CliBackedAgent
 *   - 'replay'  → caller-supplied replay agent
 *
 * Returns a map agentId → Agent ready for AgentRuntime.bindAgent().
 */

import type { Agent } from '../../lib/agents/agent.js';
import type { CLV } from '../../lib/clv/types.js';
import type { LLMProvider } from '../../lib/llm/provider.js';
import type { PromptTemplateRegistry } from '../../lib/promptTemplates/registry.js';
import type { InvocationLogger } from '../../lib/llm/invocationLogger.js';
import { LlmBackedAgent } from '../../lib/agents/llmBackedAgent.js';
import { CliBackedAgent, type CliKind } from '../../lib/agents/cliBackedAgent.js';
import { FAMILY_LAW_AGENTS } from './manifest.js';
import { FAMILY_LAW_PROMPT_TEMPLATES } from './promptTemplates.js';

export interface FamilyLawAgentFactoryDeps {
  readonly clv: CLV;
  readonly templateRegistry: PromptTemplateRegistry;
  readonly providerByStateId: ReadonlyMap<string, LLMProvider>;
  readonly cliByStateId?: ReadonlyMap<string, { cli: CliKind; sandboxRoot: string }>;
  readonly invocationLogger?: InvocationLogger;
  readonly replayByAgentId?: ReadonlyMap<string, Agent>;
  /** Resolves an authorized source's content for CLI input materialization. */
  readonly resolveSource?: (sourceId: string) => Buffer | string | undefined;
}

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

export function buildFamilyLawAgents(deps: FamilyLawAgentFactoryDeps): Map<string, Agent> {
  const agents = new Map<string, Agent>();
  for (const r of STATE_TO_AGENT) {
    if (deps.replayByAgentId?.has(r.agentId)) {
      agents.set(r.agentId, deps.replayByAgentId.get(r.agentId)!);
      continue;
    }
    if (deps.cliByStateId?.has(r.stateId)) {
      const cliCfg = deps.cliByStateId.get(r.stateId)!;
      agents.set(r.agentId, new CliBackedAgent({
        agentId: r.agentId,
        templateId: r.templateId,
        templateVersion: 'v1',
        cli: cliCfg.cli,
        clv: deps.clv,
        templateRegistry: deps.templateRegistry,
        sandboxRoot: cliCfg.sandboxRoot,
        invocationLogger: deps.invocationLogger,
        resolveSource: deps.resolveSource,
      }));
      continue;
    }
    const provider = deps.providerByStateId.get(r.stateId);
    if (!provider) {
      throw new Error(`buildFamilyLawAgents: no provider, CLI, or replay configured for state ${r.stateId}`);
    }
    agents.set(r.agentId, new LlmBackedAgent({
      agentId: r.agentId,
      templateId: r.templateId,
      templateVersion: 'v1',
      provider,
      clv: deps.clv,
      templateRegistry: deps.templateRegistry,
      invocationLogger: deps.invocationLogger,
    }));
  }
  return agents;
}

export function registerFamilyLawTemplates(registry: PromptTemplateRegistry): void {
  for (const t of FAMILY_LAW_PROMPT_TEMPLATES) {
    const result = registry.register({
      templateId: t.templateId,
      templateVersion: t.templateVersion,
      lensId: t.lensId,
      stateId: t.stateId,
      body: t.body,
      clvBindings: t.clvBindings,
    });
    if (!result.ok) {
      throw new Error(`failed to register Family Law template ${t.templateId}: ${result.errors.join('; ')}`);
    }
  }
}
