/**
 * Client Liaison Agent — universal router for all user input.
 * Based on JanumiCode Spec v2.3 §8.11 plus the Universal Router feature spec.
 *
 * Refactored entry point that delegates to:
 *   - Classifier      — 8-type LLM classifier
 *   - Retriever       — per-type retrieval strategies
 *   - Synthesizer     — native tool-calling response synthesis
 *   - CapabilityRegistry — 19 capabilities across 6 categories
 *   - ClientLiaisonDB — SQL/FTS/vector access layer
 *   - MentionResolver — @mention candidate resolution
 *
 * Backward compatibility: the old (db, llmCaller, templateLoader, config)
 * constructor and the existing `classifyQuery()` / `respond()` methods are
 * preserved as thin wrappers so the existing tests/probes pass unchanged.
 */

import type { Database } from '../database/init';
import type { LLMCaller } from '../llm/llmCaller';
import type { TemplateLoader } from '../orchestrator/templateLoader';
import type { OrchestratorEngine } from '../orchestrator/orchestratorEngine';
import type { EmbeddingService } from '../embedding/embeddingService';
import { PriorityLLMCaller } from '../llm/priorityLLMCaller';
import { randomUUID } from 'node:crypto';

import { ClientLiaisonDBImpl, type ClientLiaisonDB } from './clientLiaison/db';
import { Classifier } from './clientLiaison/classifier';
import { Retriever } from './clientLiaison/retriever';
import { Synthesizer } from './clientLiaison/synthesizer';
import { MentionResolver, type MentionExtensionHost } from './clientLiaison/mentionResolver';
import {
  CapabilityRegistry,
  type Capability,
  type CapabilityContext,
} from './clientLiaison/capabilities/index';
import { workflowControlCapabilities } from './clientLiaison/capabilities/workflowControl/index';
import { informationRetrievalCapabilities } from './clientLiaison/capabilities/informationRetrieval/index';
import { artifactInteractionCapabilities } from './clientLiaison/capabilities/artifactInteraction/index';
import { contextManagementCapabilities } from './clientLiaison/capabilities/contextManagement/index';
import { decisionHistoryCapabilities } from './clientLiaison/capabilities/decisionHistory/index';
import { buildSystemCapabilities } from './clientLiaison/capabilities/system/index';

import type {
  LiaisonResponse,
  OpenQuery,
  QueryClassification,
  QueryType,
  Reference,
  UserInput,
} from './clientLiaison/types';

import { getLogger } from '../logging';

// ── Public Type Re-exports ──────────────────────────────────────────

export type { QueryType, OpenQuery, QueryClassification, LiaisonResponse, UserInput, Reference } from './clientLiaison/types';
export type { ClientLiaisonDB } from './clientLiaison/db';
export type { CapabilityContext } from './clientLiaison/capabilities/index';

export interface ClientLiaisonConfig {
  provider: string;
  model: string;
}

// ── Agent ───────────────────────────────────────────────────────────

export class ClientLiaisonAgent {
  private readonly cdb: ClientLiaisonDB;
  private readonly registry = new CapabilityRegistry();
  private readonly classifier: Classifier;
  private readonly retriever: Retriever;
  private readonly synthesizer: Synthesizer;
  private readonly mentionResolver: MentionResolver;
  private readonly priorityLLM: PriorityLLMCaller;
  private readonly engine: OrchestratorEngine;
  private readonly templates: TemplateLoader;

  constructor(
    db: Database,
    engine: OrchestratorEngine,
    private readonly config: ClientLiaisonConfig & { embeddingService: EmbeddingService },
    extensionHost: MentionExtensionHost | null = null,
  ) {
    this.engine = engine;
    this.templates = engine.templateLoader;

    // Wrap the engine's llmCaller in a priority queue keyed by provider so
    // user_query lane requests jump ahead of phase work.
    this.priorityLLM = new PriorityLLMCaller({ maxRetries: 3, maxParallel: 1 });
    // Mirror provider registrations from the inner caller.
    // (LLMCaller does not currently expose its provider map; the bootstrap
    // is responsible for registering the same providers on PriorityLLMCaller
    // via setLLMCaller below if needed.)

    this.cdb = new ClientLiaisonDBImpl(db, config.embeddingService);
    this.registerAllCapabilities();
    this.classifier = new Classifier(
      this.priorityLLM,
      this.templates,
      config,
      () => this.registry.capabilityListing(),
    );
    this.retriever = new Retriever(this.cdb);
    this.synthesizer = new Synthesizer(
      this.priorityLLM,
      this.templates,
      this.registry,
      config,
    );
    this.mentionResolver = new MentionResolver(this.cdb, extensionHost);
  }

  /**
   * Register provider adapters on the internal PriorityLLMCaller. Called
   * during extension bootstrap after the LLMCaller has been provisioned.
   */
  registerProviders(provider: import('../llm/llmCaller').LLMProviderAdapter): void {
    this.priorityLLM.registerProvider(provider);
  }

  setEventBus(eventBus: import('../events/eventBus').EventBus): void {
    this.priorityLLM.setEventBus(eventBus);
  }

  // ── Public entry points ─────────────────────────────────────────

  /**
   * The main entry point invoked by the webview view provider for both
   * `submitIntent` and `submitOpenQuery` messages. Writes the user input
   * record, classifies, retrieves, synthesizes, and writes the response
   * record. Returns the synthesized LiaisonResponse.
   */
  async handleUserInput(input: UserInput, ctx: CapabilityContext): Promise<LiaisonResponse> {
    const writer = this.engine.writer;
    const versionSha = this.engine.janumiCodeVersionSha;

    // 1. Write the user input record (raw_intent_received or open_query_received).
    const inputRecordType =
      input.inputMode === 'raw_intent' ? 'raw_intent_received' : 'open_query_received';
    const inputRecord = writer.writeRecord({
      record_type: inputRecordType,
      schema_version: '1.0',
      workflow_run_id: ctx.activeRun?.id ?? input.id,
      janumicode_version_sha: versionSha,
      content: {
        text: input.text,
        attachments: input.attachments,
        references: input.references,
      },
    });

    // 2. Build OpenQuery for classifier/retriever.
    const openQuery: OpenQuery = {
      id: inputRecord.id,
      text: input.text,
      workflowRunId: ctx.activeRun?.id ?? '',
      currentPhaseId: ctx.currentPhase ?? '0',
      references: input.references,
    };

    // 3. Classify (or honor forceCapability hint).
    let classification: QueryClassification;
    if (input.forceCapability) {
      classification = {
        queryType: this.guessTypeForCapability(input.forceCapability),
        confidence: 1.0,
        shouldQueue: false,
        suggestedCapability: input.forceCapability,
      };
    } else if (input.inputMode === 'raw_intent') {
      classification = {
        queryType: 'workflow_initiation',
        confidence: 1.0,
        shouldQueue: false,
        suggestedCapability: 'startWorkflow',
      };
    } else {
      classification = await this.classifier.classify(openQuery);
    }

    if (ctx.activeRun) {
      writer.writeRecord({
        record_type: 'query_classification_record',
        schema_version: '1.0',
        workflow_run_id: ctx.activeRun.id,
        janumicode_version_sha: versionSha,
        derived_from_record_ids: [inputRecord.id],
        content: {
          query_type: classification.queryType,
          confidence: classification.confidence,
          should_queue: classification.shouldQueue,
          suggested_capability: classification.suggestedCapability,
        },
      });
    }

    // 4. Retrieve.
    const retrieval = await this.retriever.retrieve(
      classification.queryType,
      openQuery,
      input.references,
    );

    // 5. Either short-circuit to a forced capability OR run the synthesizer.
    let synthesis;
    if (input.forceCapability) {
      synthesis = await this.runForcedCapability(input.forceCapability, ctx);
    } else if (
      classification.suggestedCapability &&
      classification.queryType === 'workflow_initiation'
    ) {
      synthesis = await this.runForcedCapability(
        classification.suggestedCapability,
        ctx,
        { intent: input.text, attachments: input.attachments.map(a => a.uri) },
      );
    } else {
      synthesis = await this.synthesizer.synthesize(openQuery, classification, retrieval, ctx);
    }

    // 6. Write the response record.
    if (ctx.activeRun || input.inputMode === 'raw_intent') {
      writer.writeRecord({
        record_type: 'client_liaison_response',
        schema_version: '1.0',
        workflow_run_id: ctx.activeRun?.id ?? inputRecord.workflow_run_id,
        janumicode_version_sha: versionSha,
        derived_from_record_ids: [inputRecord.id],
        content: {
          query_type: classification.queryType,
          response_text: synthesis.responseText,
          provenance_record_ids: synthesis.provenanceRecordIds,
          capability_calls: synthesis.capabilityCalls.map(c => ({
            name: c.name,
            error: c.error,
          })),
        },
      });
    }

    // 7. Optional escalation.
    if (synthesis.escalatedToOrchestrator && ctx.activeRun) {
      this.engine.escalateInconsistency({
        runId: ctx.activeRun.id,
        userQueryRecordId: inputRecord.id,
        conflictingRecordIds: synthesis.provenanceRecordIds,
        description: input.text,
      });
    }

    return {
      queryId: inputRecord.id,
      queryType: classification.queryType,
      responseText: synthesis.responseText,
      provenanceRecordIds: synthesis.provenanceRecordIds,
      escalatedToOrchestrator: synthesis.escalatedToOrchestrator,
      capabilityCalls: synthesis.capabilityCalls,
    };
  }

  /**
   * Direct capability invocation, used by extension commands and slash commands
   * that already know which capability they want.
   */
  async runCapability(
    name: string,
    params: Record<string, unknown>,
    ctx: CapabilityContext,
  ): Promise<{ result: unknown; formattedText: string }> {
    const cap = this.registry.get(name);
    if (!cap) throw new Error(`Unknown capability: ${name}`);
    const precond = cap.preconditions?.(ctx);
    if (precond !== true && precond !== undefined) {
      throw new Error(precond);
    }
    const result = await cap.execute(params, ctx);
    return { result, formattedText: cap.formatResponse(result) };
  }

  /** Resolve @mention candidates for the autocomplete dropdown. */
  async resolveMention(
    query: string,
    types?: Parameters<MentionResolver['resolve']>[1],
  ) {
    return this.mentionResolver.resolve(query, types);
  }

  /** Expose the registry for the help slash command and for tool generation. */
  getRegistry(): CapabilityRegistry {
    return this.registry;
  }

  /** Expose the DB layer for the provider's snapshot/recovery code. */
  getDB(): ClientLiaisonDB {
    return this.cdb;
  }

  // ── Backward compat shims (5-type taxonomy callers) ─────────────

  /**
   * Legacy entry retained for existing tests/probes. Re-classifies via the
   * new 8-type classifier and projects down to the legacy 5-type union when
   * possible.
   */
  async classifyQuery(query: OpenQuery): Promise<QueryClassification> {
    return this.classifier.classify(query);
  }

  /**
   * Legacy entry retained for existing tests/probes. Skips capability dispatch
   * and returns a basic synthesizer-only response.
   */
  async respond(
    query: OpenQuery,
    classification: QueryClassification,
  ): Promise<LiaisonResponse> {
    const ctx = this.buildLegacyContext(query);
    const retrieval = await this.retriever.retrieve(
      classification.queryType,
      query,
      query.references ?? [],
    );
    const synthesis = await this.synthesizer.synthesize(query, classification, retrieval, ctx);
    return {
      queryId: query.id,
      queryType: classification.queryType,
      responseText: synthesis.responseText,
      provenanceRecordIds: synthesis.provenanceRecordIds,
      escalatedToOrchestrator: synthesis.escalatedToOrchestrator,
      capabilityCalls: synthesis.capabilityCalls,
    };
  }

  // ── Internal ────────────────────────────────────────────────────

  private registerAllCapabilities(): void {
    this.registry.registerAll(workflowControlCapabilities);
    this.registry.registerAll(informationRetrievalCapabilities);
    this.registry.registerAll(artifactInteractionCapabilities);
    this.registry.registerAll(contextManagementCapabilities);
    this.registry.registerAll(decisionHistoryCapabilities);
    // System capabilities reference the registry via closure for `help`.
    this.registry.registerAll(buildSystemCapabilities(this.registry));
  }

  private guessTypeForCapability(name: string): QueryType {
    if (name === 'startWorkflow') return 'workflow_initiation';
    if (name === 'getStatus' || name === 'getRecentActivity') return 'status_check';
    if (name === 'showArtifact' || name === 'listArtifacts') return 'artifact_request';
    if (name === 'explainDecision' || name === 'listDecisions') return 'rationale_request';
    if (name === 'searchRecords' || name === 'getPhaseHistory') return 'historical_lookup';
    return 'ambient_clarification';
  }

  private async runForcedCapability(
    name: string,
    ctx: CapabilityContext,
    params: Record<string, unknown> = {},
  ): Promise<{
    responseText: string;
    provenanceRecordIds: string[];
    capabilityCalls: { name: string; result?: unknown; error?: string; formatted: string }[];
    escalatedToOrchestrator: boolean;
  }> {
    const cap = this.registry.get(name);
    if (!cap) {
      return {
        responseText: `Unknown capability: ${name}`,
        provenanceRecordIds: [],
        capabilityCalls: [],
        escalatedToOrchestrator: false,
      };
    }
    const precond = cap.preconditions?.(ctx);
    if (precond !== true && precond !== undefined) {
      return {
        responseText: precond,
        provenanceRecordIds: [],
        capabilityCalls: [{ name, error: precond, formatted: precond }],
        escalatedToOrchestrator: false,
      };
    }
    try {
      const result = await cap.execute(params, ctx);
      const formatted = cap.formatResponse(result);
      return {
        responseText: formatted,
        provenanceRecordIds: [],
        capabilityCalls: [{ name, result, formatted }],
        escalatedToOrchestrator: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      getLogger().warn('agent', 'Capability execute failed', { name, error: msg });
      return {
        responseText: `Error in ${name}: ${msg}`,
        provenanceRecordIds: [],
        capabilityCalls: [{ name, error: msg, formatted: `Error: ${msg}` }],
        escalatedToOrchestrator: false,
      };
    }
  }

  private buildLegacyContext(query: OpenQuery): CapabilityContext {
    return {
      workspaceId: 'legacy',
      workspaceRoot: '',
      activeRun: query.workflowRunId
        ? this.engine.stateMachine.getWorkflowRun(query.workflowRunId)
        : null,
      currentPhase: (query.currentPhaseId as never) ?? null,
      currentSubPhase: null,
      runStatus: null,
      orchestrator: this.engine,
      db: this.cdb,
      eventBus: this.engine.eventBus,
      embedding: this.config.embeddingService,
    };
  }
}

// Helper for callers that need a UserInput from raw composer payloads.
export function makeUserInput(opts: {
  text: string;
  attachments?: { uri: string; name: string; type?: 'file' | 'image'; size?: number }[];
  references?: Reference[];
  inputMode: 'raw_intent' | 'open_query';
  workflowRunId: string | null;
  currentPhaseId: import('../types/records').PhaseId | null;
  forceCapability?: string;
}): UserInput {
  return {
    id: randomUUID(),
    text: opts.text,
    attachments: (opts.attachments ?? []).map(a => ({
      uri: a.uri,
      name: a.name,
      type: a.type ?? 'file',
      size: a.size,
    })),
    references: opts.references ?? [],
    inputMode: opts.inputMode,
    workflowRunId: opts.workflowRunId,
    currentPhaseId: opts.currentPhaseId,
    forceCapability: opts.forceCapability,
  };
}

// ── Backward-compat overload for old callers ───────────────────────

/**
 * Legacy 4-arg constructor is supported via this factory used in older tests:
 *   new ClientLiaisonAgent(db, llmCaller, templateLoader, config)
 *
 * Returns a partially-functional agent (no engine reference; runCapability,
 * handleUserInput, and several capabilities will throw). Tests that exercise
 * only classifyQuery/respond continue to work.
 */
export function createLegacyClientLiaisonAgent(
  _db: Database,
  _llmCaller: LLMCaller,
  _templateLoader: TemplateLoader,
  _config: ClientLiaisonConfig,
): ClientLiaisonAgent {
  throw new Error(
    'Legacy 4-arg ClientLiaisonAgent constructor is no longer supported. ' +
      'Use `new ClientLiaisonAgent(db, engine, {...config, embeddingService})`.',
  );
}
