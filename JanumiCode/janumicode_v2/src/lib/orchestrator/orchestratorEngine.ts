/**
 * OrchestratorEngine — the master coordinator that wires all components
 * and sequences phases.
 * Based on JanumiCode Spec v2.3, §7.
 *
 * Wave 5: Phase 0 (Workspace Initialization) + Phase 1 (Intent Capture).
 * Later waves add remaining phases via the handler registry.
 */

import { randomUUID } from 'node:crypto';
import type { Database } from '../database/init';
import { getLogger, createTraceContext, type TraceContext } from '../logging';
import { StateMachine } from './stateMachine';
import { GovernedStreamWriter } from './governedStreamWriter';
import { projectRootOf } from './workspaceLayout';
import { runReviewHarness } from '../review/harness/reviewHarness';
import { SchemaValidator } from './schemaValidator';
import { InvariantChecker } from './invariantChecker';
import { TemplateLoader } from './templateLoader';
import { ContextBuilder } from './contextBuilder';
import { PhaseGateEvaluator } from './phaseGateEvaluator';
import { MirrorGenerator } from './mirrorGenerator';
import { BloomPruneCoordinator } from './bloomPruneCoordinator';
import { LoopDetectionMonitor } from './loopDetectionMonitor';
import { IngestionPipelineRunner } from './ingestionPipelineRunner';
import { AgentInvoker } from './agentInvoker';
import { resolveExecutorIdleTimeoutS, resolveExecutorWallclockTimeoutS } from '../cli/session/executorTimeouts';
import {
  createClaudeCodeParser,
  createCodexCliParser,
  createGeminiCliParser,
  createGooseCliParser,
  createMimoCliParser,
} from '../cli/outputParser';
import { LLMCaller } from '../llm/llmCaller';
import { withTraceContext } from '../trace/traceContext';
import { configureAuditPause } from './auditPause';
import {
  DEFAULT_RETENTION,
  consumeSubPhaseState,
  emit as aoddEmit,
  endRun as aoddEndRun,
  initialize as initializeAodd,
  pruneAoddRuns,
  registerAoddLogHandler,
  startRun as aoddStartRun,
  type RetentionConfig,
} from '../aodd';
import { parseJsonWithRecovery } from '../llm/jsonRecovery';
import { EventBus } from '../events/eventBus';
import { DecisionTraceGenerator } from '../memory/decisionTraceGenerator';
import { NarrativeMemoryGenerator } from '../memory/narrativeMemoryGenerator';
import { DeepMemoryResearchAgent, type MaterialityWeights } from '../agents/deepMemoryResearch';
import type { EmbeddingService } from '../embedding/embeddingService';
import type { ConfigManager } from '../config/configManager';
import type { PhaseId, WorkflowRun } from '../types/records';
import { PHASE_NAMES, PHASE_ORDER } from '../types/records';
import { isCrossRunInterfaceKind } from './phases/crossRunImpact';

// ── Phase Handler Interface ─────────────────────────────────────────

export interface PhaseHandler {
  phaseId: PhaseId;
  execute(context: PhaseContext): Promise<PhaseResult>;
}

export interface PhaseContext {
  workflowRun: WorkflowRun;
  engine: OrchestratorEngine;
}

// ── Headless decision injection (semantic supersession) ─────────────

/** Resolves to one existing governed_stream record at injection time. */
export interface RecordSelector {
  /** record_type to match (e.g. 'artifact_produced', 'interface_contracts'). */
  recordType: string;
  /** Optional substring matched against the record's JSON content (e.g. a
   *  kind or a statement fragment) to disambiguate. */
  contentMatch?: string;
  /** 'any' (default — finds prior-run records too, which is what semantic
   *  supersession overrides) or 'current_run'. */
  scope?: 'any' | 'current_run';
}

/**
 * A scripted `prior_decision_override` injected during a headless run, so the
 * semantic-supersession path (supersedes Memory Edge → DMR Stage 5
 * supersession_chains) can be exercised end-to-end. `superseded` is the prior
 * governing record being overridden; `superseding` is the new governing
 * position — either an existing record (selector) or a synthetic governing
 * artifact written from a statement.
 */
export interface OverrideInjectionSpec {
  /** Fire after this phase completes (in the auto-advance loop). */
  afterPhase: PhaseId;
  superseded: RecordSelector;
  superseding?: RecordSelector | { statement: string; kind: string };
}

/**
 * Result of `detectCrossRunImpactTrigger` — present only when Phase 0.5's
 * entry criterion is met (a prior-run, certified interface artifact was
 * overridden in this run). Consumed by the routing logic and by Phase 0.5.1.
 */
export interface CrossRunImpactTrigger {
  triggered: true;
  /** The prior_decision_override decision_trace id. */
  overrideTraceId: string;
  /** The superseded (prior-run) interface artifact id being changed. */
  changedInterfaceId: string;
  /** The new governing record id, when the override named one. */
  supersedingRecordId?: string;
  /** workflow_run_id of the prior run that produced the changed interface. */
  priorWorkflowRunId: string;
  /** content.kind of the changed interface (interface_contracts | api_definitions | data_models). */
  interfaceKind: string;
}

export interface PhaseResult {
  success: boolean;
  error?: string;
  /** Artifact IDs produced by this phase */
  artifactIds: string[];
  /**
   * Cycle-restart back-transition target. When set by a phase handler
   * (currently only Phase 9's cycle_controller sub-phase), the
   * orchestrator skips the normal forward-advance logic and routes the
   * workflow back to this phase to start a new cycle. The state
   * machine's `cycleRestartPhase` method allows the specific
   * back-transitions used by the iterative-implementation-backlog
   * design.
   *
   * See docs/design/iterative-implementation-backlog.md §3.
   */
  cycleRestartTo?: PhaseId;
  /**
   * Phase 0.5 "Revise the override" back-transition. When Phase 0.5.2's
   * human decision is (B) Revise, the handler sets `reviseTo = '1'` so the
   * orchestrator routes back to Phase 1 to reconsider the interface change
   * (spec §4 Phase 0.5.2, StateMachine allows 0.5→1). Distinct from
   * `cycleRestartTo`, which is the Phase-9 iterative-backlog loop.
   */
  reviseTo?: PhaseId;
}

// ── Decision Surface Types ──────────────────────────────────────────

export type DecisionSurfaceType = 'mirror' | 'decision_bundle' | 'phase_gate';

export interface DecisionResolution {
  type: string;
  payload?: Record<string, unknown>;
}

interface PendingDecision {
  runId: string;
  decisionId: string;
  surfaceType: DecisionSurfaceType;
  resolver: (resolution: DecisionResolution) => void;
  rejecter: (err: Error) => void;
  createdAt: number;
}

// ── OrchestratorEngine ──────────────────────────────────────────────

export class OrchestratorEngine {
  // ── Core components (§7.8) ──────────────────────────────────────
  readonly stateMachine: StateMachine;
  readonly writer: GovernedStreamWriter;
  readonly schemaValidator: SchemaValidator;
  readonly invariantChecker: InvariantChecker;
  readonly templateLoader: TemplateLoader;
  readonly contextBuilder: ContextBuilder;
  readonly phaseGateEvaluator: PhaseGateEvaluator;
  readonly mirrorGenerator: MirrorGenerator;
  readonly bloomPruneCoordinator: BloomPruneCoordinator;
  readonly loopDetectionMonitor: LoopDetectionMonitor;
  readonly ingestionPipeline: IngestionPipelineRunner;
  readonly agentInvoker: AgentInvoker;
  readonly llmCaller: LLMCaller;
  readonly eventBus: EventBus;
  readonly decisionTraceGenerator: DecisionTraceGenerator;
  readonly narrativeMemoryGenerator: NarrativeMemoryGenerator;
  readonly deepMemoryResearch: DeepMemoryResearchAgent;
  readonly workspacePath: string;
  /**
   * Agent-owned generated-code root = `<workspacePath>/<PROJECT_CODE_DIR>`.
   * Distinct from `workspacePath` (control plane) so the coding agent's cwd
   * never includes `.janumicode`. See workspaceLayout.ts.
   */
  readonly projectRoot: string;

  private readonly phaseHandlers = new Map<PhaseId, PhaseHandler>();
  private readonly versionSha: string;
  private readonly pendingDecisions = new Map<string, PendingDecision>();

  /**
   * Session-scoped abort signal, plumbed into LLM calls via
   * `callForRole` / `llmCaller.call`. The CLI's waitForQuiescence
   * stall detector fires `this.abortSession()` when a run goes
   * records-silent past the threshold — that cancels any in-flight
   * ollama streaming call, the saturation loop's catch block writes
   * a deferred supersession for the offending node, and the phase
   * handler unwinds cleanly. Without this, a hung ollama generation
   * holds the await indefinitely and the quiescence watchdog can
   * only log (not intervene).
   */
  private sessionAbortController: AbortController | null = null;

  /**
   * Set the session abort controller. Called once per CLI invocation
   * before any phase execution starts. The signal is attached to every
   * LLM call this engine makes thereafter.
   */
  setSessionAbortController(controller: AbortController): void {
    this.sessionAbortController = controller;
  }

  /**
   * Read-only accessor for the session abort signal. Phase handlers
   * pass this into embedding calls and other long-running ops so the
   * same abort that cancels the main LLM call also cancels those.
   */
  getSessionAbortSignal(): AbortSignal | undefined {
    return this.sessionAbortController?.signal;
  }

  /**
   * Wave 6 dedup — optional override for the embedding client used by
   * Phase 2.1a / 2.2a's flag-but-don't-merge dedup pass. Tests inject
   * a fake client to exercise the dedup code paths without requiring
   * a live ollama instance. Production code leaves this unset; the
   * saturation loop constructs a default `OllamaEmbeddingClient()`.
   */
  private embeddingClientOverride: import('../llm/embeddings').EmbeddingClient | null = null;
  setEmbeddingClientOverride(client: import('../llm/embeddings').EmbeddingClient | null): void {
    this.embeddingClientOverride = client;
  }
  getEmbeddingClientOverride(): import('../llm/embeddings').EmbeddingClient | null {
    return this.embeddingClientOverride;
  }

  /**
   * Abort the current session — fires the session abort signal,
   * cancelling any in-flight LLM call that observes the signal
   * (today: ollama streaming). Callers should abort, then wait for
   * the phase promise to resolve/reject (it will reject with an
   * AbortError the saturation loop catches).
   */
  abortSession(reason: string): void {
    if (this.sessionAbortController && !this.sessionAbortController.signal.aborted) {
      getLogger().warn('workflow', `Session abort: ${reason}`);
      this.sessionAbortController.abort(new Error(reason));
    }
  }

  /**
   * @param db              SQLite database (direct or sidecar-backed)
   * @param configManager   Loaded configuration
   * @param workspacePath   The user's workspace folder. The governed_stream
   *                        database, detail files, and config overrides live
   *                        under `workspacePath/.janumicode/`.
   * @param extensionPath   The JanumiCode extension's own root directory.
   *                        Schemas, invariants, and prompt templates ship
   *                        with the extension and are loaded from
   *                        `extensionPath/.janumicode/`. Defaults to
   *                        `workspacePath` for backward compatibility with
   *                        tests that treat the repo root as both.
   */
  constructor(
    readonly db: Database,
    readonly configManager: ConfigManager,
    workspacePath: string,
    extensionPath: string = workspacePath,
  ) {
    const config = configManager.get();
    this.versionSha = config.janumicode_version_sha || 'dev';

    // Initialize all components. Schemas, invariants, and prompt templates
    // are extension-resident resources — they're loaded from the extension
    // root, not from the user's workspace. The governed_stream DB, detail
    // files, and config overrides are workspace-resident and use workspacePath.
    this.stateMachine = new StateMachine(db);
    this.writer = new GovernedStreamWriter(db, () => randomUUID());

    // Legacy `transforms.jsonl` and `lifecycle.ndjson` writers have
    // been removed entirely. Observability is provided by the AODD
    // layer (configured below).
    // Audit-pause gate: configure with the workspace root so pause
    // markers + ack files land under .janumicode/audit/. The pause
    // itself is opted in via JANUMICODE_AUDIT_PAUSE=1 at runtime
    // (isAuditPauseEnabled() reads that flag). The db handle enables
    // the cascade-skip optimization that auto-resumes pauses for
    // sub-phases that produced zero records this process (cached
    // replays during --resume-from-db flows).
    // ackTimeoutSeconds: env override for long interactive audits. The
    // default (4h) is fine for unattended abort-on-abandon, but an agent
    // walking every sub-phase across a multi-hour session can leave a
    // pause outstanding longer than that while implementing a fix — which
    // would kill the run mid-audit (ts-115 died this way). Operators set
    // JANUMICODE_AUDIT_ACK_TIMEOUT_SECONDS to widen the window.
    const ackTimeoutEnv = process.env.JANUMICODE_AUDIT_ACK_TIMEOUT_SECONDS;
    const ackTimeoutSeconds = ackTimeoutEnv && Number.isFinite(Number(ackTimeoutEnv))
      ? Number(ackTimeoutEnv)
      : undefined;
    configureAuditPause({ workspaceRoot: workspacePath, db, ackTimeoutSeconds });

    // AODD observability layer (docs/design/aodd-{principles,design}.md).
    // Parallel observability surface for AI coding agents finishing v2;
    // file-first NDJSON under runs/<run_id>/aodd/. Opt-out via
    // JANUMICODE_AODD=off. P2 wires the Logger handler here so log
    // entries become log.<level> AODD events when a run is active;
    // the run lifecycle (startRun / endRun) is wired in P3. P9 adds
    // retention pruning right after initialize (before any new run
    // is started), so the new run does not race against prune.
    if ((process.env.JANUMICODE_AODD ?? 'on') !== 'off') {
      initializeAodd({
        workspaceRoot: workspacePath,
        janumicodeVersionSha: this.versionSha,
        enabled: true,
      });
      // Retention: read the optional `aodd.retention` block from the
      // workspace config; fall back to DEFAULT_RETENTION. Pruning is
      // synchronous and deterministic — runs before any new AODD
      // activity for this process.
      const aoddCfg = (config as { aodd?: { retention?: Partial<RetentionConfig> } }).aodd;
      const retention: RetentionConfig = {
        max_runs: aoddCfg?.retention?.max_runs ?? DEFAULT_RETENTION.max_runs,
        ttl_days: aoddCfg?.retention?.ttl_days ?? DEFAULT_RETENTION.ttl_days,
        min_runs: aoddCfg?.retention?.min_runs ?? DEFAULT_RETENTION.min_runs,
      };
      pruneAoddRuns(workspacePath, retention);
      registerAoddLogHandler(getLogger());
    } else {
      initializeAodd(null);
    }

    this.schemaValidator = new SchemaValidator(extensionPath);
    this.invariantChecker = new InvariantChecker(
      `${extensionPath}/schemas/invariants`,
    );
    this.templateLoader = new TemplateLoader(extensionPath);
    this.contextBuilder = new ContextBuilder({
      stdinMaxTokens: config.context_assembly.cli_agents.stdin_max_tokens,
      detailFileMaxBytes: config.context_assembly.cli_agents.detail_file_max_bytes,
      detailFilePathTemplate: `${workspacePath}/${config.context_assembly.cli_agents.detail_file_path_template}`,
      workspacePath,
    });
    this.phaseGateEvaluator = new PhaseGateEvaluator();
    this.mirrorGenerator = new MirrorGenerator();
    this.bloomPruneCoordinator = new BloomPruneCoordinator();
    this.loopDetectionMonitor = new LoopDetectionMonitor();
    this.ingestionPipeline = new IngestionPipelineRunner(db, () => randomUUID());

    this.llmCaller = new LLMCaller({
      maxRetries: config.workflow.max_retry_attempts_per_subphase,
    });
    // Wave 5b: instrument every LLM call with agent_invocation /
    // agent_output / tool_call records so the AgentInvocationCard has data
    // to render. The writer's eventBus auto-emit forwards each record to
    // the webview as it lands, so the user sees agent activity live.
    this.llmCaller.setWriter(this.writer, this.versionSha);

    // Wire the reasoning-review HARNESS (Track D Commit 10) on every
    // successful agent_output. The hook runs synchronously after each
    // LLM call so harness findings land in the governed_stream BEFORE
    // the next phase scrolls them out of the user's attention. The
    // harness owns its own loop-guard (skips agentRole ∈ {harness,
    // json_repair, reasoning_review}) so it never reviews itself.
    //
    // Auto-disabled in vitest: review issues a real LLM call which
    // would either hit Ollama (network) or fail expectations counting
    // governed_stream records. Same pattern as createEmbeddingClient.
    // Explicit override: JANUMICODE_REVIEW_ENABLED=false disables in
    // production runs (e.g. operator triage); =true forces it on in
    // tests if a future test needs it.
    const reviewEnabledFlag = process.env.JANUMICODE_REVIEW_ENABLED;
    const reviewEnabled = reviewEnabledFlag === 'true'
      ? true
      : reviewEnabledFlag === 'false'
        ? false
        : process.env.VITEST !== 'true' && process.env.NODE_ENV !== 'test';
    if (reviewEnabled) {
      // Harness LLM validators route through the same provider/model the
      // legacy reasoning_review step used (Track D Commit 10). Falling
      // back to undefined when unconfigured leaves validators stub-routed
      // → validator_unavailable, which is what tests expect.
      const reasoningReviewCfg = this.configManager.getLLMRouting().reasoning_review;
      const harnessRouting = reasoningReviewCfg?.primary?.provider && reasoningReviewCfg?.primary?.model
        ? {
            provider: reasoningReviewCfg.primary.provider,
            model: reasoningReviewCfg.primary.model,
            temperature: reasoningReviewCfg.temperature ?? 0,
          }
        : undefined;
      this.llmCaller.setReviewHarnessHook(async (params) => {
        // Harness owns its own loop-guard, empty-output handling, and
        // failure recording. The orchestrator wiring stays thin.
        await runReviewHarness(
          params,
          this.llmCaller,
          this.writer,
          this.versionSha,
          this.templateLoader,
          harnessRouting,
        );
      });
    }

    // LLM-based JSON repair fallback (json_repair agent role): when a
    // call requests `responseFormat: 'json'` and the response doesn't
    // parse, the LLMCaller hands the broken text to a dedicated repair
    // sequence — primary model first, fallback model if primary fails.
    // Both attempts include the original prompt + system + thinking
    // chain (and optional schema hint) as grounding context. Read from
    // `config.llm_routing.json_repair`. Skipped silently if not
    // configured (caller halts on parse failure).
    const jsonRepairConfig = this.configManager.getLLMRouting().json_repair;
    if (jsonRepairConfig?.primary?.provider && jsonRepairConfig?.primary?.model) {
      this.llmCaller.setJsonRepairRouting({
        primary: {
          provider: jsonRepairConfig.primary.provider,
          model: jsonRepairConfig.primary.model,
          baseUrl: jsonRepairConfig.primary.base_url,
          temperature: jsonRepairConfig.temperature ?? 0,
        },
        fallback: jsonRepairConfig.fallback?.provider && jsonRepairConfig.fallback?.model
          ? {
              provider: jsonRepairConfig.fallback.provider,
              model: jsonRepairConfig.fallback.model,
              baseUrl: jsonRepairConfig.fallback.base_url,
              temperature: jsonRepairConfig.fallback_temperature ?? 0,
            }
          : undefined,
      });
    }

    // Executor backstops come from the SHARED policy (executorTimeouts), not the
    // (short) `cli_invocation` config — those local defaults are exactly what let
    // the 300s undici timeout guillotine long mimo turns. Every executor adapter
    // inherits the same generous idle (24h) + wall-clock (25h) backstops via the
    // ExecutorTaskRequest, and self-terminates on its own signal. Env-tunable.
    const idleTimeoutSeconds = resolveExecutorIdleTimeoutS();
    this.agentInvoker = new AgentInvoker(this.llmCaller, {
      timeoutSeconds: resolveExecutorWallclockTimeoutS(idleTimeoutSeconds),
      idleTimeoutSeconds,
      // No-content (alive but never produced output) gets the same generous
      // budget — a slow-to-first-token agent must not be killed prematurely; a
      // crashed process exits and is detected via the process-exit path instead.
      noContentTimeoutSeconds: idleTimeoutSeconds,
      bufferMaxEvents: config.cli_invocation.buffer_max_events,
    });
    this.agentInvoker.setWriter(this.writer, this.versionSha);

    // Session Responder (session_responder agent role): the LLM playing the
    // human side of an interactive Phase-9 executor session — answers the
    // coding agent's clarifying questions from the task spec and composes
    // contextual continuation nudges. Read from
    // `config.llm_routing.session_responder`, env-overridable for live
    // calibration (JANUMICODE_SESSION_RESPONDER_PROVIDER / _MODEL). Skipped
    // silently when unconfigured — interactive adapters fall back to their
    // canned responses.
    const responderConfig = this.configManager.getLLMRouting().session_responder;
    const responderProvider = process.env.JANUMICODE_SESSION_RESPONDER_PROVIDER ?? responderConfig?.primary?.provider;
    const responderModel = process.env.JANUMICODE_SESSION_RESPONDER_MODEL ?? responderConfig?.primary?.model;
    if (responderProvider && responderModel) {
      this.agentInvoker.setSessionResponderRoute({
        provider: responderProvider,
        model: responderModel,
        baseUrl: responderConfig?.primary?.base_url,
        temperature: responderConfig?.temperature,
        maxTokens: responderConfig?.max_tokens,
      });
    }

    this.eventBus = new EventBus();

    // Connect the writer to the eventBus so every successful write emits
    // `record:added`. The webview view provider subscribes and forwards
    // these to the webview as `addRecord` postMessage payloads.
    this.writer.setEventBus(this.eventBus);

    // Connect the plain LLMCaller to the eventBus too. Phase handlers and
    // DMR all use this caller (the priority caller is a Liaison-only
    // thing); without wiring here, the webview's ActivityStrip would
    // report "Idle" during the ~95% of the workflow where phase LLM calls
    // are in flight.
    this.llmCaller.setEventBus(this.eventBus);
    // CLI agent invocations stream stdout/stderr chunks through the same
    // eventBus → llm:stream_chunk channel as LLM calls.
    this.agentInvoker.setEventBus(this.eventBus);

    // Wire the IngestionPipelineRunner with the dependencies its Stage III
    // (LLM Relationship Extraction, spec §8.12) needs. Uses the same LLM
    // routing as DMR (domain_interpreter primary). Without these deps,
    // Stage III is a no-op — appropriate for fast unit tests that
    // construct a minimal pipeline. Real runs pay the per-record cost.
    // Harness opt-out: when JANUMICODE_INGESTION_STAGE3_OFF=1, skip wiring
    // Stage III deps so the per-record relationship-extraction LLM call
    // never fires. Used by the prompt-iteration harness — Stage III adds
    // 1-2 LLM calls per artifact_produced record and is noise when the
    // bug under investigation is in a proposer template.
    const stage3Off = process.env.JANUMICODE_INGESTION_STAGE3_OFF === '1';
    const ipRouting = this.configManager.getLLMRouting().domain_interpreter?.primary;
    if (ipRouting?.provider && ipRouting?.model && !stage3Off) {
      this.ingestionPipeline.setStage3LLMDependencies({
        llmCaller: this.llmCaller,
        templateLoader: this.templateLoader,
        writer: this.writer,
        provider: ipRouting.provider,
        model: ipRouting.model,
        baseUrl: ipRouting.base_url,
        janumiCodeVersionSha: this.versionSha,
      });
    }

    this.decisionTraceGenerator = new DecisionTraceGenerator(db);
    const nmRoute = this.configManager.getRoutingModel('requirements_agent');
    this.narrativeMemoryGenerator = new NarrativeMemoryGenerator(this.llmCaller, this.templateLoader, {
      provider: nmRoute.provider,
      model: nmRoute.model,
      baseUrl: nmRoute.baseUrl,
      temperature: 0.3,
      janumiCodeVersionSha: this.versionSha,
    });

    // Deep Memory Research Agent (§8.4) — always instantiated. Embedding
    // service is optional and can be attached later via setEmbeddingService()
    // so the engine can be constructed before the embedding backend is
    // known to be healthy.
    const dmrConfig = (config as unknown as Record<string, unknown>).deep_memory_research as
      { materiality_weights?: MaterialityWeights } | undefined;
    const weights: MaterialityWeights = dmrConfig?.materiality_weights ?? {
      semantic_similarity: 0.20,
      constraint_relevance: 0.25,
      authority_level: 0.20,
      temporal_recency: 0.15,
      causal_relevance: 0.10,
      contradiction_signal: 0.10,
    };
    // DMR Stage 1 + Stage 7 LLM calls used to hardcode ollama/qwen3.5:9b,
    // bypassing llm_routing entirely. cal-22b surfaced this — every
    // phase's context-packet build was hitting ollama on CPU even
    // though llm_routing.domain_interpreter was pointing at llamacpp.
    // Borrow domain_interpreter routing for DMR since it's the closest
    // semantic role match (knowledge synthesis from prior decisions).
    const diRoute = this.configManager.getRoutingModel('domain_interpreter');
    this.deepMemoryResearch = new DeepMemoryResearchAgent(
      db, this.llmCaller, weights,
      {
        janumiCodeVersionSha: this.versionSha,
        provider: diRoute.provider,
        model: diRoute.model,
        baseUrl: diRoute.baseUrl,
      },
      this.templateLoader,
      undefined, // embedding service — attached later
      this.writer,
    );

    this.workspacePath = workspacePath;
    this.projectRoot = projectRootOf(workspacePath);
  }

  /**
   * Attach an embedding service to the Deep Memory Research Agent. The
   * agent can run without it (degraded semantic similarity) but attaching
   * enables vector-based candidate harvest and similarity scoring.
   */
  setEmbeddingService(embedding: EmbeddingService): void {
    const weights = (this.configManager.get() as unknown as Record<string, unknown>).deep_memory_research as
      { materiality_weights: MaterialityWeights };
    // Rebuild DMR with the embedding wired. This is idempotent.
    // Same routing pull as the constructor — DMR's provider/model/baseUrl
    // come from llm_routing.domain_interpreter, not the hardcoded
    // ollama/qwen3.5:9b default.
    const diRoute = this.configManager.getRoutingModel('domain_interpreter');
    (this as unknown as { deepMemoryResearch: DeepMemoryResearchAgent }).deepMemoryResearch =
      new DeepMemoryResearchAgent(
        this.db, this.llmCaller, weights.materiality_weights,
        {
          janumiCodeVersionSha: this.versionSha,
          provider: diRoute.provider,
          model: diRoute.model,
          baseUrl: diRoute.baseUrl,
        },
        this.templateLoader,
        embedding,
        this.writer,
      );
  }

  // ── Phase Handler Registry ──────────────────────────────────────

  /**
   * Register a phase handler.
   */
  registerPhase(handler: PhaseHandler): void {
    this.phaseHandlers.set(handler.phaseId, handler);
  }

  /**
   * Get a registered phase handler.
   */
  getPhaseHandler(phaseId: PhaseId): PhaseHandler | undefined {
    return this.phaseHandlers.get(phaseId);
  }

  // ── Workflow Lifecycle ──────────────────────────────────────────

  /**
   * Start a new Workflow Run.
   *
   * @param workspaceId   Stable workspace identifier
   * @param rawIntentText Optional user prompt text. When omitted, downstream phase
   *                      handlers fall back to a JSON-stringified status payload.
   */
  startWorkflowRun(
    workspaceId: string,
    rawIntentText?: string,
  ): { run: WorkflowRun; trace: TraceContext } {
    const runId = randomUUID();
    const trace = createTraceContext({ workflow_run_id: runId });
    const run = this.stateMachine.createWorkflowRun({
      id: runId,
      workspace_id: workspaceId,
      janumicode_version_sha: this.versionSha,
    });

    // Record the workflow start. Phase 1 reads `content.text` first; without this
    // field the bloom would describe the JSON-stringified status payload instead
    // of the user's actual intent.
    this.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '0',
      janumicode_version_sha: this.versionSha,
      content: {
        text: rawIntentText ?? '',
        status: 'workflow_initiated',
      },
    });

    this.eventBus.emit('workflow:started', { workflowRunId: runId });
    // AODD: open the per-run trace directory before any logger.info or
    // downstream emit so they're captured into events.ndjson. Paired
    // with the legacy EventBus emit above per design memo §5 dual-emit.
    aoddStartRun(runId);
    aoddEmit('run.started', { intent_brief: rawIntentText ?? null });
    getLogger().info('workflow', 'Workflow started', { workflow_run_id: runId, workspace_id: workspaceId, trace_id: trace.trace_id }, trace);
    return { run, trace };
  }

  /** Number of phase executions currently in-flight. Used by quiescence detection. */
  private _executingPhaseCount = 0;
  get executingPhaseCount(): number { return this._executingPhaseCount; }

  /**
   * Emit a terminal `sub_phase.exited` AODD event for the workflow's
   * current sub-phase, if any. Used at phase exit so the final
   * sub-phase of each phase gets its summary written incrementally
   * rather than only via the endRun bulk pass.
   *
   * stateMachine.setSubPhase only fires sub_phase.exited for the
   * *prior* sub-phase when a new one is set — so without this helper
   * the LAST sub-phase of every phase never has an exit event during
   * the run.
   */
  private emitFinalSubPhaseExitedIfAny(runId: string): void {
    const current = this.stateMachine.getWorkflowRun(runId)?.current_sub_phase_id;
    if (!current) return;
    const exitState = consumeSubPhaseState(current);
    aoddEmit(
      'sub_phase.exited',
      { status: exitState.status, duration_ms: exitState.duration_ms },
      { sub_phase_id_override: current },
    );
  }

  /**
   * Execute the current phase of a workflow run.
   */
  async executeCurrentPhase(runId: string, trace?: TraceContext): Promise<PhaseResult> {
    const run = this.stateMachine.getWorkflowRun(runId);
    if (!run) {
      return { success: false, error: `Workflow run ${runId} not found`, artifactIds: [] };
    }

    const phaseId = run.current_phase_id;
    if (!phaseId) {
      return { success: false, error: 'No current phase', artifactIds: [] };
    }

    // Phase-limit gate. Also respected by the auto-advance block below,
    // but enforcing it HERE catches the startWorkflow capability's
    // fire-and-forget advance → executeCurrentPhase path too. Without
    // this check, `--phase-limit 0` still runs Phase 1 because the
    // Client Liaison's startWorkflow capability kicks it off regardless
    // of the engine's own advance policy.
    if (this.phaseLimit) {
      const limitIdx = PHASE_ORDER.indexOf(this.phaseLimit);
      const phaseIdx = PHASE_ORDER.indexOf(phaseId);
      if (limitIdx >= 0 && phaseIdx > limitIdx) {
        getLogger().info('workflow', 'Skipping phase execution (past phase-limit)', {
          workflow_run_id: runId,
          phase_id: phaseId,
          phase_limit: this.phaseLimit,
        });
        return { success: true, artifactIds: [] };
      }
    }

    // Create or update trace context with current phase
    const phaseTrace = trace
      ? { ...trace, phase_id: phaseId }
      : createTraceContext({ workflow_run_id: runId, phase_id: phaseId });

    const handler = this.phaseHandlers.get(phaseId);
    if (!handler) {
      return {
        success: false,
        error: `No handler registered for phase ${phaseId}`,
        artifactIds: [],
      };
    }

    this._executingPhaseCount++;
    try {
      this.eventBus.emit('phase:started', {
        phaseId,
        phaseName: PHASE_NAMES[phaseId] ?? phaseId,
      });
      getLogger().info('workflow', 'Phase started', { workflow_run_id: runId, phase_id: phaseId, phase_name: PHASE_NAMES[phaseId] }, phaseTrace);

      // Convert thrown errors from the handler into `success: false`
      // phase results. Serial-pipeline invariant: an unrecoverable LLM /
      // CLI failure at any sub-phase HALTS the workflow — downstream
      // phases reason on upstream artifacts, so a silent fallback
      // corrupts every phase that follows. Phase handlers therefore
      // let LLM helpers throw instead of returning default values;
      // this catch is the engine-level seam that turns those throws
      // into gap-reportable phase failures.
      let result: PhaseResult;
      const phaseStartedAt = Date.now();
      try {
        // Wrap the handler's execution in a TraceCtx so any nested code
        // (LLM calls, normalizers, context assemblers) can emit
        // transformation_step records without arg-threading. Sub-phase
        // id is null at the frame root; downstream code (notably the
        // LLM caller) supplies sub_phase_id_override at emit time based
        // on its LLMTraceContext.
        result = await withTraceContext(
          { workflow_run_id: runId, phase_id: phaseId, sub_phase_id: null },
          async () => {
            aoddEmit('phase.entered', {
              phase_name: PHASE_NAMES[phaseId] ?? phaseId,
            });
            const r = await handler.execute({ workflowRun: run, engine: this });
            // Cover the last sub-phase of the phase: stateMachine.setSubPhase
            // only fires sub_phase.exited for the *prior* sub-phase when a
            // new one is set, so the final sub-phase never gets one.
            // Emit it here so per-sub-phase-exit summary writes also cover
            // the terminal sub-phase, and so its diagnostic status carries
            // through.
            this.emitFinalSubPhaseExitedIfAny(runId);
            const phaseDuration = Date.now() - phaseStartedAt;
            aoddEmit('phase.exited', {
              phase_name: PHASE_NAMES[phaseId] ?? phaseId,
              status: r.success ? 'success' : 'failed',
              duration_ms: phaseDuration,
              artifact_count: r.artifactIds.length,
              ...(r.success ? {} : { error: { message: r.error ?? 'unknown error' } }),
            });
            return r;
          },
        );
      } catch (err) {
        const phaseDuration = Date.now() - phaseStartedAt;
        const errMsg = err instanceof Error ? err.message : String(err);
        // Same coverage as the happy path: close out the current sub-phase
        // before emitting phase.exited so the bulk-derive and per-exit
        // summary writers see a complete picture.
        this.emitFinalSubPhaseExitedIfAny(runId);
        aoddEmit('phase.exited', {
          phase_name: PHASE_NAMES[phaseId] ?? phaseId,
          status: 'failed',
          duration_ms: phaseDuration,
          artifact_count: 0,
          error: { message: errMsg },
        });
        const message = err instanceof Error ? err.message : String(err);
        const subPhase = this.stateMachine.getWorkflowRun(runId)?.current_sub_phase_id;
        const location = subPhase ? `Phase ${subPhase}` : `Phase ${phaseId}`;
        getLogger().error('workflow', 'Phase handler threw — halting workflow', {
          workflow_run_id: runId,
          phase_id: phaseId,
          sub_phase_id: subPhase,
          error: message,
        }, phaseTrace);
        result = {
          success: false,
          error: `${location} halted: ${message}`,
          artifactIds: [],
        };
      }

      if (result.success) {
        this.eventBus.emit('phase:completed', {
          phaseId,
          phaseName: PHASE_NAMES[phaseId] ?? phaseId,
        });
        getLogger().info('workflow', 'Phase completed', { workflow_run_id: runId, phase_id: phaseId, artifact_count: result.artifactIds.length }, phaseTrace);

        // Phase 0.5.2 "Revise the override" back-transition (spec §4 Phase
        // 0.5.2 B) — honored in BOTH approval modes (it is a deterministic
        // routing instruction, not a gate approval, and the revise branch
        // writes no phase gate). Clearing the trigger prevents Phase 1 from
        // immediately bouncing back into 0.5 on its re-run.
        if (result.reviseTo) {
          this.stateMachine.setCrossRunImpactTriggered(runId, false);
          const reback = this.advanceToNextPhase(runId, result.reviseTo);
          if (reback) {
            getLogger().info('workflow', 'Phase 0.5 revise — returning to Phase 1', {
              workflow_run_id: runId, to_phase: result.reviseTo,
            }, phaseTrace);
            await this.executeCurrentPhase(runId, phaseTrace);
          }
        }
        // In auto-approve mode, chain to the next phase automatically.
        // In normal (webview) mode, the DecisionRouter handles this when
        // the human approves the phase gate. We await here (not fire-and-forget)
        // so the full pipeline completes before the caller returns, which
        // lets waitForQuiescence track in-flight LLM calls correctly.
        // Skip Phase 0 — the ClientLiaisonAgent handles 0→1 advancement itself.
        else if (this.autoApproveDecisions && phaseId !== '0') {
          // Headless simulate-human-decisions: certify this phase's gate the
          // way a human approval would — writing phase_gate_approved + ingesting
          // it so `validates` edges form and the phase's governing artifacts
          // elevate to Authority 6 (which the DMR surfaces as active_constraints).
          // Auto-approve otherwise advances silently and never certifies. [headless injection]
          if (this.simulateHumanDecisions) {
            this.simulateGateApproval(runId, phaseId);
          }
          // Fire any scripted prior_decision_override injections registered for
          // this just-completed phase (semantic-supersession exerciser). [headless injection]
          this.runOverrideInjectionsForPhase(runId, phaseId);
          // phaseLimit stops the chain AFTER the named phase completes,
          // so the harness can capture phase-N fixtures + assertions in
          // isolation instead of running the whole pipeline to phase 10.
          if (this.phaseLimit && phaseId === this.phaseLimit) {
            getLogger().info('workflow', 'Phase limit reached; halting auto-advance', {
              workflow_run_id: runId,
              phase_id: phaseId,
              phase_limit: this.phaseLimit,
            }, phaseTrace);
          } else if (result.cycleRestartTo) {
            // Cycle controller back-transition (Phase 9 → Phase 6/7/8).
            // The iterative-implementation-backlog cycle controller has
            // decided to loop instead of advancing to Phase 10.
            const restart = this.stateMachine.cycleRestartPhase(runId, result.cycleRestartTo);
            if (restart.success) {
              getLogger().info('workflow', 'Cycle restart — looping back', {
                workflow_run_id: runId,
                from_phase: phaseId,
                to_phase: result.cycleRestartTo,
              }, phaseTrace);
              await this.executeCurrentPhase(runId, phaseTrace);
            } else {
              getLogger().error('workflow', 'Cycle restart failed', {
                workflow_run_id: runId,
                target_phase: result.cycleRestartTo,
                error: restart.error,
              }, phaseTrace);
            }
          } else {
            // Cross-run impact routing (spec §4 Phase 0.5): after Phase 1, if a
            // prior_decision_override changed a certified prior-run interface,
            // detour through Phase 0.5 before Phase 2. Phase 0.5 itself advances
            // to Phase 2. All other phases follow PHASE_ORDER.
            const idx = PHASE_ORDER.indexOf(phaseId);
            let nextPhase: PhaseId | undefined;
            if (phaseId === '1') {
              if (this.detectCrossRunImpactTrigger(runId)) {
                this.stateMachine.setCrossRunImpactTriggered(runId, true);
                nextPhase = '0.5';
              } else {
                nextPhase = '2';
              }
            } else if (phaseId === '0.5') {
              nextPhase = '2';
            } else if (idx >= 0 && idx < PHASE_ORDER.length - 1) {
              nextPhase = PHASE_ORDER[idx + 1];
            }
            if (nextPhase) {
              if (this.phaseHandlers.has(nextPhase)) {
                const advanced = this.advanceToNextPhase(runId, nextPhase);
                if (advanced) {
                  await this.executeCurrentPhase(runId, phaseTrace);
                }
              }
            } else if (idx === PHASE_ORDER.length - 1) {
              this.stateMachine.completeWorkflowRun(runId);
              this.eventBus.emit('workflow:completed', { workflowRunId: runId });
              // AODD: close the trace. endRun emits run.completed and
              // writes index.json. After this point, AODD emits for runId
              // are no-ops until startRun is called again.
              aoddEndRun({ status: 'success' });
            }
          }
        }
      } else {
        getLogger().error('workflow', 'Phase failed', { workflow_run_id: runId, phase_id: phaseId, error: result.error }, phaseTrace);
      }

      return result;
    } finally {
      this._executingPhaseCount--;
    }
  }

  /**
   * Advance to the next phase after Phase Gate approval.
   */
  advanceToNextPhase(runId: string, targetPhase: PhaseId): boolean {
    const result = this.stateMachine.advancePhase(runId, targetPhase);
    return result.success;
  }

  // ── Human-In-Loop Pause/Resume (§4 Phase 1, §17.3) ──────────────

  /**
   * Test-mode auto-approve. When true, every `pauseForDecision` resolves
   * synchronously with a synthetic mirror_approval / menu_selection /
   * phase_gate_approval. Used by unit tests that exercise multi-phase
   * pipelines without a webview.
   */
  private autoApproveDecisions = false;
  setAutoApproveDecisions(enabled: boolean): void {
    this.autoApproveDecisions = enabled;
  }

  /**
   * Headless simulate-human-decisions mode. When true (and autoApprove is on),
   * the auto-advance loop CERTIFIES each phase gate through the same path a
   * human approval would (writes `phase_gate_approved` + ingests it →
   * `validates` edges → Authority-6 elevation) instead of silently advancing.
   * This lets a headless run exercise the governance machinery the DMR
   * depends on — active_constraints accumulation in particular — which is
   * otherwise dormant because auto-approve never produces a phase_gate_approved
   * record. Off by default so existing harness runs are unchanged.
   */
  private simulateHumanDecisions = false;
  setSimulateHumanDecisions(enabled: boolean): void {
    this.simulateHumanDecisions = enabled;
  }

  /**
   * Headless gate-approval injection: find this phase's gate evaluation, write
   * a `simulated_human_approval` decision_trace, and certify it. Best-effort —
   * a phase with no gate evaluation (or a transient DB error) is a no-op, never
   * a halt. Called from the auto-advance loop when simulateHumanDecisions is on.
   */
  private simulateGateApproval(runId: string, phaseId: PhaseId): void {
    try {
      const gate = this.db.prepare(`
        SELECT id FROM governed_stream
        WHERE workflow_run_id = ? AND phase_id = ? AND record_type = 'phase_gate_evaluation'
          AND is_current_version = 1
        ORDER BY produced_at DESC LIMIT 1
      `).get(runId, phaseId) as { id: string } | undefined;
      if (!gate) return;
      const trace = this.writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: phaseId,
        janumicode_version_sha: this.versionSha,
        derived_from_record_ids: [gate.id],
        content: {
          decision_type: 'phase_gate_approval',
          target_record_id: gate.id,
          attribution: 'simulated_human_approval',
          auto_approved: false,
        },
      });
      this.certifyPhaseGate(runId, gate.id, trace.id);
    } catch (err) {
      getLogger().warn('workflow', 'simulateGateApproval failed — gate not certified', {
        runId, phaseId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Certify a phase gate: write the `phase_gate_approved` record carrying the
   * gate-evaluated artifacts top-level as `approved_artifact_ids`, ingest it so
   * the Ingestion Pipeline's Stage II asserts the `validates` edges (which
   * elevate those artifacts to Authority 6 — effectiveAuthority.ts), and write
   * the `phase_gates` row the dependency-closure resolver reads. Does NOT
   * resolve the pending decision or advance the phase — the caller owns that.
   *
   * Single-sourced here so the webview approval path (DecisionRouter.route) and
   * the headless simulate path share one certification implementation.
   * Returns the approved record id.
   */
  certifyPhaseGate(
    runId: string,
    gateEvaluationRecordId: string,
    decisionTraceId: string,
    payload: Record<string, unknown> = {},
  ): string {
    const approvedArtifactIds = this.certifiedArtifactIds(gateEvaluationRecordId);
    const approved = this.writer.writeRecord({
      record_type: 'phase_gate_approved',
      schema_version: '1.0',
      workflow_run_id: runId,
      janumicode_version_sha: this.versionSha,
      derived_from_record_ids: [gateEvaluationRecordId],
      content: {
        target_record_id: gateEvaluationRecordId,
        payload,
        ...(approvedArtifactIds.length > 0 ? { approved_artifact_ids: approvedArtifactIds } : {}),
      },
    });
    try {
      this.ingestionPipeline.ingest(approved);
    } catch (err) {
      getLogger().warn('decision', 'Ingestion of phase_gate_approved failed — validates edges not created', {
        recordId: approved.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const run = this.stateMachine.getWorkflowRun(runId);
    const phaseId = run?.current_phase_id ?? null;
    if (phaseId) {
      this.db.prepare(`
        INSERT INTO phase_gates
          (id, workflow_run_id, phase_id, sub_phase_id, completed_at,
           human_approved, approval_record_id, decision_trace_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        approved.id, runId, phaseId, run?.current_sub_phase_id ?? null,
        new Date().toISOString(), 1, approved.id, decisionTraceId,
      );
    } else {
      getLogger().warn('decision', 'certifyPhaseGate without current_phase_id; phase_gates row skipped', {
        runId, gateEvaluationRecordId,
      });
    }
    return approved.id;
  }

  /**
   * The artifacts a phase gate certifies = the records the
   * `phase_gate_evaluation` derived from (its inputs ARE the phase's governing
   * artifacts). Excludes the gate record itself and blank ids.
   */
  private certifiedArtifactIds(gateEvaluationRecordId: string): string[] {
    const gate = this.writer.getRecord(gateEvaluationRecordId);
    if (!gate) return [];
    return (gate.derived_from_record_ids ?? []).filter(
      (id) => typeof id === 'string' && id.length > 0 && id !== gateEvaluationRecordId,
    );
  }

  /**
   * Scripted prior_decision_override injections, fired from the auto-advance
   * loop after their `afterPhase` completes (simulate-human-decisions mode).
   * Each fires at most once.
   */
  private overrideInjections: OverrideInjectionSpec[] = [];
  private firedOverrideInjections = new Set<OverrideInjectionSpec>();
  setOverrideInjections(specs: OverrideInjectionSpec[]): void {
    this.overrideInjections = specs;
    this.firedOverrideInjections.clear();
  }

  /** Fire any override injections registered for a just-completed phase. */
  private runOverrideInjectionsForPhase(runId: string, phaseId: PhaseId): void {
    for (const spec of this.overrideInjections) {
      if (spec.afterPhase !== phaseId || this.firedOverrideInjections.has(spec)) continue;
      this.firedOverrideInjections.add(spec);
      this.injectPriorDecisionOverride(runId, spec);
    }
  }

  /**
   * Phase 0.5 entry test (spec §4 Phase 0.5 entry criterion). Returns trigger
   * metadata when a `prior_decision_override` decision_trace in THIS run
   * overrides a Phase-Gate-Certified Interface Contract / API Definition /
   * Data Model that was produced in a PRIOR Workflow Run; otherwise null.
   *
   * Three conditions, all required:
   *   (a) the superseded record belongs to a different (prior) workflow run —
   *       this is what distinguishes a true cross-run change from the
   *       within-run supersession the headless harness also exercises;
   *   (b) it is an interface artifact (`content.kind` ∈ the cross-run kinds);
   *   (c) it is Phase-Gate-Certified — the target of a `validates` edge from a
   *       `phase_gate_approved` record (same signal effectiveAuthority uses to
   *       elevate to Authority 6).
   *
   * Read-only and defensive: any missing record / table-schema drift yields
   * null (Phase 0.5 simply does not trigger), never a throw.
   */
  detectCrossRunImpactTrigger(runId: string): CrossRunImpactTrigger | null {
    try {
      // Newest current-version prior_decision_override in this run.
      const traceRow = this.db.prepare(`
        SELECT id, content FROM governed_stream
        WHERE workflow_run_id = ? AND record_type = 'decision_trace'
          AND is_current_version = 1
          AND content LIKE '%"decision_type":"prior_decision_override"%'
        ORDER BY produced_at DESC LIMIT 1
      `).get(runId) as { id: string; content: string } | undefined;
      if (!traceRow) return null;

      let traceContent: Record<string, unknown>;
      try {
        traceContent = JSON.parse(traceRow.content) as Record<string, unknown>;
      } catch {
        return null;
      }
      const supersededId = typeof traceContent.superseded_record_id === 'string'
        ? traceContent.superseded_record_id
        : undefined;
      if (!supersededId) return null;

      const superseded = this.writer.getRecord(supersededId);
      if (!superseded) return null;

      // (a) Must originate in a PRIOR workflow run.
      if (!superseded.workflow_run_id || superseded.workflow_run_id === runId) return null;

      // (b) Must be an interface artifact (artifact_produced carrying a
      //     cross-run-significant content.kind).
      if (superseded.record_type !== 'artifact_produced') return null;
      const kind = (superseded.content as Record<string, unknown> | undefined)?.kind;
      if (!isCrossRunInterfaceKind(kind)) return null;

      // (c) Must be Phase-Gate-Certified (target of a validates edge from a
      //     phase_gate_approved record — the Authority-6 elevation signal).
      const certified = this.db.prepare(`
        SELECT 1 FROM memory_edge me
        JOIN governed_stream gs ON gs.id = me.source_record_id
        WHERE me.edge_type = 'validates'
          AND me.target_record_id = ?
          AND gs.record_type = 'phase_gate_approved'
          AND gs.is_current_version = 1
        LIMIT 1
      `).get(supersededId) as { 1: number } | undefined;
      if (!certified) return null;

      const supersedingId = typeof traceContent.superseding_record_id === 'string'
        ? traceContent.superseding_record_id
        : undefined;

      return {
        triggered: true,
        overrideTraceId: traceRow.id,
        changedInterfaceId: supersededId,
        supersedingRecordId: supersedingId,
        priorWorkflowRunId: superseded.workflow_run_id,
        interfaceKind: kind,
      };
    } catch (err) {
      getLogger().warn('workflow', 'detectCrossRunImpactTrigger failed — Phase 0.5 not triggered', {
        runId, error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Inject a semantic supersession: resolve the prior governing record being
   * overridden (and the new governing record, synthesising one from a
   * statement if asked), then write a `prior_decision_override` decision_trace
   * (superseded/superseding ids top-level) and ingest it so Stage II asserts
   * the `supersedes` edge the DMR's Stage 5 surfaces as a supersession_chain.
   * Returns the decision_trace id, or null when the superseded record can't be
   * resolved (a no-op, never a halt).
   */
  injectPriorDecisionOverride(runId: string, spec: OverrideInjectionSpec): string | null {
    const supersededId = this.resolveRecordBySelector(runId, spec.superseded);
    if (!supersededId) {
      getLogger().warn('decision', 'injectPriorDecisionOverride: superseded record not found — skipped', {
        runId, selector: spec.superseded,
      });
      return null;
    }
    let supersedingId: string | undefined;
    if (spec.superseding) {
      supersedingId = 'statement' in spec.superseding
        ? this.writeSupersedingArtifact(runId, spec.superseding)
        : (this.resolveRecordBySelector(runId, spec.superseding) ?? undefined);
    }

    const run = this.stateMachine.getWorkflowRun(runId);
    const trace = this.writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: run?.current_phase_id ?? null,
      sub_phase_id: run?.current_sub_phase_id ?? null,
      janumicode_version_sha: this.versionSha,
      derived_from_record_ids: supersedingId ? [supersededId, supersedingId] : [supersededId],
      content: {
        decision_type: 'prior_decision_override',
        target_record_id: supersededId,
        superseded_record_id: supersededId,
        ...(supersedingId ? { superseding_record_id: supersedingId } : {}),
        attribution: 'simulated_human_override',
        auto_approved: false,
      },
    });
    try {
      this.ingestionPipeline.ingest(trace);
    } catch (err) {
      getLogger().warn('decision', 'Ingestion of injected prior_decision_override failed — supersedes edge not created', {
        recordId: trace.id, error: err instanceof Error ? err.message : String(err),
      });
    }
    return trace.id;
  }

  /** Resolve a selector to the most recent current-version record id, or null. */
  private resolveRecordBySelector(runId: string, sel: RecordSelector): string | null {
    const clauses = ['record_type = ?', 'is_current_version = 1'];
    const params: unknown[] = [sel.recordType];
    if (sel.scope === 'current_run') {
      clauses.push('workflow_run_id = ?');
      params.push(runId);
    }
    if (sel.contentMatch) {
      clauses.push('content LIKE ?');
      params.push(`%${sel.contentMatch}%`);
    }
    const row = this.db.prepare(
      `SELECT id FROM governed_stream WHERE ${clauses.join(' AND ')} ORDER BY produced_at DESC LIMIT 1`,
    ).get(...params) as { id: string } | undefined;
    return row?.id ?? null;
  }

  /** Write (and ingest) a new governing artifact representing the human's
   *  superseding decision, so the supersedes edge originates from a real,
   *  harvestable record. */
  private writeSupersedingArtifact(runId: string, spec: { statement: string; kind: string }): string {
    const run = this.stateMachine.getWorkflowRun(runId);
    const rec = this.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: run?.current_phase_id ?? null,
      janumicode_version_sha: this.versionSha,
      content: { kind: spec.kind, statement: spec.statement, source: 'simulated_human_override' },
    });
    try {
      this.ingestionPipeline.ingest(rec);
    } catch { /* best-effort; edge creation tolerates an unindexed source */ }
    return rec.id;
  }

  /**
   * Opt-in: register the built-in CLI output parsers so Phase 9's
   * executor (and any other CLI-backed agent) can actually spawn a real
   * coding agent subprocess. Gated behind an explicit call because
   * mock-mode tests (e.g. createTestEngine in vitest) don't want the
   * executor to reach the point of spawning `claude` — they expect the
   * invoker to fail fast with "No output parser registered". Real
   * pipeline runs (the CLI's --llm-mode real path) call this before
   * Phase 9 runs so the Claude Code subprocess is reachable.
   */
  registerBuiltinCLIParsers(): void {
    this.agentInvoker.registerOutputParser('claude_code_cli', createClaudeCodeParser());
    this.agentInvoker.registerOutputParser('gemini_cli', createGeminiCliParser());
    this.agentInvoker.registerOutputParser('goose_cli', createGooseCliParser());
    this.agentInvoker.registerOutputParser('codex_cli', createCodexCliParser());
    this.agentInvoker.registerOutputParser('mimo_cli', createMimoCliParser());
  }

  /**
   * Phase-limit: when set to a PhaseId, the engine's auto-advance loop
   * stops after completing that phase even if `autoApproveDecisions` is
   * true. Used by the test harness CLI's `--phase-limit N` so a coder
   * can debug phase N in isolation (capture fixtures for phase N, assert
   * against phase N contracts) without the engine sliding into phase
   * N+1 and masking the signal.
   *
   * Null = no limit (default: run to completion).
   */
  private phaseLimit: PhaseId | null = null;
  setPhaseLimit(phase: PhaseId | null): void {
    this.phaseLimit = phase;
  }
  getPhaseLimit(): PhaseId | null { return this.phaseLimit; }

  /**
   * Per-sub-phase decision overrides, consumed by `pauseForDecision` in
   * auto-approve mode. The key is a canonical sub-phase id (e.g. "1.3");
   * the value is an `index_N` selector or a literal option_id. When the
   * current sub-phase has an override, it wins over the default
   * "accept-everything" synthesis, so a headless run can deterministically
   * steer Phase 1's candidate picker (and any future menus) without a
   * human in the loop.
   *
   * Empty map = default behavior (accept all mirror items, no menu
   * picks). Set via `setDecisionOverrides` from `HeadlessLiaisonAdapter`.
   */
  private decisionOverrides: Map<string, string> = new Map();
  setDecisionOverrides(overrides: Map<string, string>): void {
    this.decisionOverrides = overrides;
  }
  getDecisionOverrideForSubPhase(subPhaseId: string): string | undefined {
    return this.decisionOverrides.get(subPhaseId);
  }

  /**
   * Pause the current phase handler until a human decision arrives.
   * Resolves with the user's resolution when DecisionRouter calls
   * `resolveDecision(decisionId, ...)`.
   *
   * `decisionId` is conventionally the record id of the surface that
   * is presented to the human (mirror_presented / menu_presented /
   * phase_gate_evaluation), so reload recovery can match by id.
   */
  pauseForDecision(
    runId: string,
    decisionId: string,
    surfaceType: DecisionSurfaceType,
  ): Promise<DecisionResolution> {
    if (this.autoApproveDecisions) {
      return this.resolveHeadless(runId, decisionId, surfaceType);
    }

    return new Promise((resolve, reject) => {
      this.pendingDecisions.set(decisionId, {
        runId,
        decisionId,
        surfaceType,
        resolver: resolve,
        rejecter: reject,
        createdAt: Date.now(),
      });
      this.eventBus.emit('decision:requested', { runId, decisionId, surfaceType });
      aoddEmit('decision.requested', { decision_id: decisionId, surface_type: surfaceType });
    });
  }

  /**
   * Headless decision resolution. Default = `synthesizeResolution` (auto-approve
   * / injected override), recorded as an `auto_approve`/`headless_override`
   * attribution. When `JANUMICODE_SIMULATE_DECISION_AGENT=1` AND there is no
   * explicit override, a lightweight LLM "decision-maker" instead PICKS among
   * the surface's options and records a one-line rationale — so the
   * decision_trace carries a real selection + reasoning (which the DMR surfaces)
   * rather than an empty auto-approval. Falls back to the default on any agent
   * failure. (Extracted from pauseForDecision so the agent call can be async.)
   */
  private async resolveHeadless(
    runId: string,
    decisionId: string,
    surfaceType: DecisionSurfaceType,
  ): Promise<DecisionResolution> {
    const run = this.stateMachine.getWorkflowRun(runId);
    const currentSubPhase = run?.current_sub_phase_id ?? null;
    const overrideSelection = currentSubPhase
      ? this.decisionOverrides.get(currentSubPhase)
      : undefined;

    const agent = (!overrideSelection && process.env.JANUMICODE_SIMULATE_DECISION_AGENT === '1')
      ? await this.runDecisionAgent(decisionId, surfaceType).catch(() => null)
      : null;

    let resolution: DecisionResolution;
    let content: Record<string, unknown>;
    if (agent) {
      resolution = agent.resolution;
      content = {
        decision_type: resolution.type,
        target_record_id: decisionId,
        surface_type: surfaceType,
        attribution: 'simulated_decision_agent',
        auto_approved: false,
        auto_approved_by: null,
        override_selection: null,
        human_selection: agent.humanSelection,
        rationale_captured: agent.rationale,
        context_presented: agent.contextPresented,
        payload: (resolution as { payload?: unknown }).payload ?? {},
      };
    } else {
      resolution = this.synthesizeResolution(decisionId, surfaceType, overrideSelection);
      content = {
        decision_type: resolution.type,
        target_record_id: decisionId,
        surface_type: surfaceType,
        attribution: overrideSelection ? 'headless_override' : 'auto_approve',
        auto_approved: !overrideSelection,
        auto_approved_by: overrideSelection ? null : 'orchestrator_auto_approve',
        override_selection: overrideSelection ?? null,
        payload: (resolution as { payload?: unknown }).payload ?? {},
      };
    }

    // Attribution decision_trace — distinguishes auto-approval / override /
    // simulated-agent in the audit trail. Best-effort: never blocks resolution.
    try {
      this.writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: run?.current_phase_id ?? null,
        sub_phase_id: currentSubPhase,
        janumicode_version_sha: this.versionSha,
        derived_from_record_ids: [decisionId],
        content,
      });
    } catch { /* best-effort */ }

    this.eventBus.emit('decision:requested', { runId, decisionId, surfaceType });
    this.eventBus.emit('decision:resolved', { runId, decisionId, resolution });
    aoddEmit('decision.requested', { decision_id: decisionId, surface_type: surfaceType });
    aoddEmit('decision.resolved', {
      decision_id: decisionId,
      resolution: { type: resolution.type, payload: (resolution as { payload?: unknown }).payload },
    });
    return resolution;
  }

  /**
   * LLM decision-maker for headless runs (opt-in via
   * JANUMICODE_SIMULATE_DECISION_AGENT=1). Reads the presented surface, asks the
   * orchestrator-routed model to choose among its options + justify in one
   * sentence, and maps the answer to a DecisionResolution plus the
   * human_selection / rationale_captured / context_presented fields. Best-effort:
   * returns null (→ caller falls back to auto-approve) on any problem.
   */
  private async runDecisionAgent(
    decisionId: string,
    surfaceType: DecisionSurfaceType,
  ): Promise<{ resolution: DecisionResolution; humanSelection: string; rationale: string; contextPresented: string } | null> {
    let surface = '';
    try {
      const row = this.db.prepare('SELECT content FROM governed_stream WHERE id = ?')
        .get(decisionId) as { content: string } | undefined;
      // No size cap: decision surfaces are single-artifact JSON (typically a few
      // KB). A premature 4000-char cap silently cut a 4539-char requirements
      // mirror mid-acceptance-criterion, which the agent then (correctly)
      // rejected as "incomplete" — failing the phase and a multi-hour run. Sizes
      // aren't characterized yet and a bad cap costs a full rerun, so pass the
      // whole surface and make the prompt robust to truncation from ANY layer.
      if (row?.content) surface = String(row.content);
    } catch { /* surface unavailable */ }

    // This agent is a TEST FIXTURE that stands in for the human stakeholder
    // reading/judging/deciding on a presented surface, so the human-decision-
    // dependent DMR paths (certified gates → active_constraints; overrides →
    // supersession_chains; decision_trace content) get exercised headless. It is
    // an ADJUDICATOR of what is shown — not a scope-minimizer and not an author
    // of new requirements. Fidelity = decide as the in-role stakeholder building
    // the FULL product would; the prior "senior engineer minimizing scope"
    // framing made it prune like a cost-cutter, dropping on-scope items and
    // killing the run (and the DMR test) at coverage gates.
    const allowed = surfaceType === 'phase_gate' ? "'approve'"
      : surfaceType === 'mirror' ? "'approve' or 'reject'"
      : "the option_id of a specific item to DROP, or 'approve' to keep the whole proposed set";
    const posture = surfaceType === 'phase_gate'
      ? 'This is a phase-gate approval. Approve unless the surface shows a BLOCKING inconsistency a reviewer would actually halt the build for. Default: approve.'
      : surfaceType === 'mirror'
        ? 'This is a review mirror. If it presents a complete, coherent artifact, APPROVE it. Reject ONLY for a substantive defect in what is shown — never because you would have scoped it more narrowly. Default: approve.'
        : 'This surface proposes a set of items expansively ("keep what belongs to the product, reject what does not"). Because you are building the FULL product, ENDORSE the whole proposed set with "approve"; reject only a specific item that is genuinely OUTSIDE this product. Dropping items that belong leaves journeys/workflows/components uncovered and blocks the build. Default: approve (keep all).';
    const prompt =
      'You stand in for the HUMAN STAKEHOLDER reviewing ONE decision surface in an automated build. '
      + 'You are committed to building the FULL product described by the intent — NOT a reduced MVP — and you '
      + 'decide exactly as that stakeholder would when reading and judging what is shown. You do not invent new '
      + 'requirements; you only adjudicate what is presented.\n'
      + `Decision surface type: ${surfaceType}.\n${posture}\n\nSurface content (JSON):\n${surface || '(unavailable)'}\n\n`
      + 'Give a ONE-sentence rationale grounded in the surface. '
      + 'The surface above is authoritative as provided; if any field looks cut off, treat that as a '
      + 'rendering artifact of this prompt and do NOT reject solely because content appears truncated '
      + 'or incomplete — reject only for a substantive defect in what is shown. '
      + `"selection" must be ${allowed}.\n`
      + 'Return ONLY JSON: {"selection": "...", "rationale": "..."}';

    let parsed: { selection?: unknown; rationale?: unknown } | null = null;
    try {
      const res = await this.callForRole('orchestrator', { prompt, responseFormat: 'json', temperature: 0.2 });
      parsed = (res.parsed as { selection?: unknown; rationale?: unknown }) ?? null;
    } catch { return null; }
    if (!parsed) return null;

    const selection = typeof parsed.selection === 'string' ? parsed.selection.trim() : '';
    const rationale = typeof parsed.rationale === 'string' ? parsed.rationale.trim() : '';
    if (!rationale) return null;

    let resolution: DecisionResolution;
    if (surfaceType === 'phase_gate') {
      resolution = { type: 'phase_gate_approval' };
    } else if (surfaceType === 'mirror') {
      resolution = /^rej/i.test(selection)
        ? { type: 'mirror_rejection', payload: { decisions: [] } }
        : { type: 'mirror_approval' };
    } else {
      // decision_bundle — map the literal/index selection to a real option_id.
      const optionId = this.resolveBundleOptionId(decisionId, selection)
        ?? (selection && !/^(app|rej)/i.test(selection) ? selection : null);
      resolution = optionId
        ? { type: 'decision_bundle_resolution', payload: { mirror_decisions: [], menu_selections: [{ option_id: optionId }] } }
        : { type: 'decision_bundle_resolution', payload: { mirror_decisions: [], menu_selections: [] } };
    }

    return {
      resolution,
      humanSelection: selection || resolution.type,
      rationale,
      contextPresented: `${surfaceType} surface presented (${surface.length} chars)`,
    };
  }

  /**
   * Translate the chosen surface + optional override into a concrete
   * DecisionResolution. Extracted so `pauseForDecision` stays readable
   * and the override wiring has one well-tested home.
   *
   * Supported override selectors:
   *   - `index_N` / `N` / `option_N` — pick the Nth option from the
   *     first menu in a `decision_bundle` (0-indexed).
   *   - A literal option_id string — pick that option by id.
   *   - `approve` / `accept` — explicit approval on a mirror or gate.
   *   - `reject` — mirror_rejection on a mirror surface. Gate rejection
   *     isn't a supported headless outcome (no downstream handler), so
   *     a `reject` override on a phase_gate is ignored and falls back
   *     to approval with a warning — the gap report surfaces the
   *     mismatch anyway.
   *
   * When no override is provided, the legacy "accept everything / empty
   * menu selections" default applies — matches pre-override behavior.
   */
  private synthesizeResolution(
    decisionId: string,
    surfaceType: DecisionSurfaceType,
    overrideSelection: string | undefined,
  ): DecisionResolution {
    if (surfaceType === 'phase_gate') {
      // Phase gates only have "approve" as a headless outcome today.
      // Any override value collapses to approval.
      return { type: 'phase_gate_approval' };
    }

    if (surfaceType === 'mirror') {
      if (overrideSelection === 'reject' || overrideSelection === 'rejected') {
        return { type: 'mirror_rejection', payload: { decisions: [] } };
      }
      return { type: 'mirror_approval' };
    }

    // decision_bundle
    if (!overrideSelection) {
      return {
        type: 'decision_bundle_resolution',
        payload: { mirror_decisions: [], menu_selections: [] },
      };
    }

    // Resolve the override into an option_id by reading the presented
    // bundle record. If the record isn't a bundle surface, fall through
    // to the default empty payload rather than crashing — the override
    // was addressed to a sub-phase that doesn't actually present a
    // menu, so there's nothing to pick.
    const optionId = this.resolveBundleOptionId(decisionId, overrideSelection);
    if (!optionId) {
      return {
        type: 'decision_bundle_resolution',
        payload: { mirror_decisions: [], menu_selections: [] },
      };
    }
    return {
      type: 'decision_bundle_resolution',
      payload: {
        mirror_decisions: [],
        menu_selections: [{ option_id: optionId }],
      },
    };
  }

  /**
   * Look up the decision_bundle_presented record by id and translate an
   * override selector (index_N / literal option_id) into the concrete
   * option_id on its first menu. Returns null when the record isn't a
   * bundle, has no menu, or the index is out of range.
   */
  private resolveBundleOptionId(
    bundleRecordId: string,
    selection: string,
  ): string | null {
    let row: { content: string } | undefined;
    try {
      row = this.db.prepare(
        `SELECT content FROM governed_stream
         WHERE id = ? AND record_type = 'decision_bundle_presented'`,
      ).get(bundleRecordId) as { content: string } | undefined;
    } catch {
      return null;
    }
    if (!row) return null;

    interface BundleMenuOption { id: string; label?: string }
    interface BundleContent {
      menu?: { options?: BundleMenuOption[] };
    }

    let content: BundleContent;
    try { content = JSON.parse(row.content) as BundleContent; }
    catch { return null; }
    const options = content.menu?.options;
    if (!Array.isArray(options) || options.length === 0) return null;

    const indexMatch = /^(?:index_|option_)?(\d+)$/.exec(selection);
    if (indexMatch) {
      const idx = Number.parseInt(indexMatch[1], 10);
      return options[idx]?.id ?? null;
    }
    // Literal option_id: confirm it exists on this bundle; otherwise
    // swallow silently so a typo doesn't pick the wrong row.
    return options.find((o) => o.id === selection)?.id ?? null;
  }

  /**
   * Resolve a pending decision. Returns true if a pending entry was
   * found and resolved, false otherwise (e.g. webview reload races).
   */
  resolveDecision(decisionId: string, resolution: DecisionResolution): boolean {
    const pending = this.pendingDecisions.get(decisionId);
    if (!pending) return false;
    this.pendingDecisions.delete(decisionId);
    this.eventBus.emit('decision:resolved', {
      runId: pending.runId,
      decisionId,
      resolution,
    });
    aoddEmit('decision.resolved', {
      decision_id: decisionId,
      resolution: { type: resolution.type, payload: (resolution as { payload?: unknown }).payload },
    });
    pending.resolver(resolution);
    return true;
  }

  /**
   * Reject a pending decision (e.g. on workflow cancel).
   */
  rejectDecision(decisionId: string, reason: string): boolean {
    const pending = this.pendingDecisions.get(decisionId);
    if (!pending) return false;
    this.pendingDecisions.delete(decisionId);
    pending.rejecter(new Error(reason));
    return true;
  }

  /**
   * Surface ids of the decisions currently AWAITING a human decision for a
   * run. Lets the Client Liaison resolve an open bloom gate programmatically
   * — e.g. a "generate more" regeneration that injects free-text feedback
   * into the bloom loop (`runBloomRoundWithFeedbackLoop`). Returns [] when
   * nothing is pending (the collection is past its gate).
   */
  pendingDecisionSurfaces(runId: string): Array<{ decisionId: string; surfaceType: DecisionSurfaceType }> {
    const out: Array<{ decisionId: string; surfaceType: DecisionSurfaceType }> = [];
    for (const p of this.pendingDecisions.values()) {
      if (p.runId === runId) out.push({ decisionId: p.decisionId, surfaceType: p.surfaceType });
    }
    return out;
  }

  /**
   * On webview reload, in-memory pending decisions are lost. The provider
   * scans for unresolved surface records and re-creates pending entries
   * so the user's next click can drive the phase handler forward.
   *
   * Phase handlers must be idempotent on re-entry — calling them twice
   * with the same input must produce the same record ids and surface state.
   */
  recreatePendingFromRecord(
    runId: string,
    decisionId: string,
    surfaceType: DecisionSurfaceType,
  ): Promise<DecisionResolution> {
    return this.pauseForDecision(runId, decisionId, surfaceType);
  }

  /**
   * Inspect a pending decision (for diagnostics).
   */
  hasPendingDecision(decisionId: string): boolean {
    return this.pendingDecisions.has(decisionId);
  }

  // ── Inconsistency Escalation (§8.11) ────────────────────────────

  /**
   * Called by the Client Liaison when a CONSISTENCY_CHALLENGE query reveals
   * an actual inconsistency. Writes a `consistency_challenge_escalation`
   * record, emits an event so the user sees a banner card, and pauses the
   * run pending bloom-and-prune resolution.
   */
  escalateInconsistency(escalation: {
    runId: string;
    userQueryRecordId: string;
    conflictingRecordIds: string[];
    description: string;
  }): string {
    const record = this.writer.writeRecord({
      record_type: 'consistency_challenge_escalation',
      schema_version: '1.0',
      workflow_run_id: escalation.runId,
      janumicode_version_sha: this.versionSha,
      derived_from_record_ids: [
        escalation.userQueryRecordId,
        ...escalation.conflictingRecordIds,
      ],
      content: {
        description: escalation.description,
        conflicting_record_ids: escalation.conflictingRecordIds,
        user_query_record_id: escalation.userQueryRecordId,
        status: 'awaiting_resolution',
      },
    });

    this.eventBus.emit('inconsistency:escalated', {
      runId: escalation.runId,
      escalationRecordId: record.id,
      description: escalation.description,
    });
    aoddEmit('decision.escalated', {
      escalation_record_id: record.id,
      description: escalation.description,
    });
    this.eventBus.emit('error:occurred', {
      message: `Consistency escalation: ${escalation.description}`,
      context: record.id,
    });

    return record.id;
  }

  // ── Utility Methods ─────────────────────────────────────────────

  get janumiCodeVersionSha(): string {
    return this.versionSha;
  }

  /**
   * LLM routing config (§10). Phases that invoke LLMs for specific roles
   * (Reasoning Review, Domain Compliance Review, etc.) read their
   * provider/model from here rather than hardcoding. See also
   * `validateLLMRouting()` for startup-time verification that all
   * referenced providers are registered.
   */
  get llmRouting() {
    return this.configManager.get().llm_routing;
  }

  /**
   * Verify that every provider referenced by `llm_routing` in config is
   * registered with the LLMCaller. Call this AFTER all providers have been
   * registered (i.e. after test/CLI/extension bootstrap wires things up).
   *
   * Correctness-validation roles (Reasoning Review, Domain Compliance)
   * cannot silently fall back without undermining the system's trust model.
   * If validation fails, the engine logs fatal errors and throws — the
   * caller must either register the missing provider or override the
   * config before proceeding.
   *
   * @throws Error listing every missing provider when validation fails
   */
  validateLLMRouting(): void {
    const registered = new Set(this.llmCaller.getRegisteredProviderNames());
    const backingTools = new Set(this.agentInvoker.getRegisteredBackingTools());
    const errors = this.configManager.validateLLMRouting(registered, backingTools);
    if (errors.length > 0) {
      for (const e of errors) {
        getLogger().error('activation', `LLM routing misconfiguration: ${e}`);
      }
      // Include the specific validation errors in the thrown message
      // so callers asserting on the failure don't have to scrape the
      // logger output. The umbrella summary goes first, then every
      // individual error on its own line for readability.
      throw new Error(
        `LLM routing misconfiguration — ${errors.length} issue(s) in config:\n  - ` +
        errors.join('\n  - '),
      );
    }
  }

  /**
   * Call the configured backing — API or CLI — for a specific role.
   * Today supports the `orchestrator` role (Intent Quality Check,
   * future phase-gate reasoning). Looks up `llm_routing[role]` and
   * dispatches to LLMCaller or AgentInvoker transparently, so the
   * caller doesn't branch on backing type.
   *
   * Returns a uniform `LLMCallResult`-shaped envelope. For CLI
   * backings, the `text` field is the best-effort final synthesized
   * output (result envelope for Claude Code, concatenated text blocks
   * otherwise), and `parsed` is the JSON parse of that text when
   * responseFormat='json'.
   */
  async callForRole(
    role: 'orchestrator' | 'domain_interpreter' | 'requirements_agent',
    options: {
      prompt: string;
      responseFormat?: 'json' | 'text';
      temperature?: number;
      traceContext?: import('../llm/llmCaller').LLMTraceContext;
      cwd?: string;
    },
  ): Promise<import('../llm/llmCaller').LLMCallResult> {
    const routing = this.configManager.getLLMRouting();
    const roleRouting = routing[role];
    if (!roleRouting?.primary) {
      throw new Error(
        `No llm_routing entry for role '${role}'. Set llm_routing.${role} in ` +
        `.janumicode/config.json or DEFAULT_CONFIG.`,
      );
    }
    const { backing_tool, provider, model, base_url } = roleRouting.primary;
    const temperature = options.temperature ?? roleRouting.temperature ?? 0.3;

    if (backing_tool === 'direct_llm_api') {
      if (!provider) {
        throw new Error(`role '${role}' direct_llm_api backing requires a provider`);
      }
      return this.llmCaller.call({
        provider,
        model: model ?? '',
        baseUrl: base_url,
        prompt: options.prompt,
        responseFormat: options.responseFormat,
        temperature,
        traceContext: options.traceContext,
        abortSignal: this.sessionAbortController?.signal,
      });
    }

    // CLI dispatch: agentInvoker.invoke() returns cliResult with
    // parsed events. Pull the final text + parse JSON so callers get
    // the same shape as a direct LLM call.
    const invocationId = randomUUID();
    // LLMTraceContext's `phaseId` is a loose string; CLITraceContext
    // wants a PhaseId literal. The values are identical at runtime,
    // so the narrowing cast is safe.
    const cliTraceContext = options.traceContext
      ? {
          workflowRunId: options.traceContext.workflowRunId,
          phaseId: options.traceContext.phaseId as PhaseId | null | undefined,
          subPhaseId: options.traceContext.subPhaseId,
          agentRole: options.traceContext.agentRole,
          label: options.traceContext.label,
        }
      : undefined;
    // Normalize friendly alias — config may use 'openai_codex_cli'; the
    // agentInvoker switch expects 'codex_cli'.
    const normalizedBackingTool = backing_tool === 'openai_codex_cli' ? 'codex_cli' : backing_tool;
    const result = await this.agentInvoker.invoke({
      agentRole: role,
      backingTool: normalizedBackingTool as import('./agentInvoker').BackingTool,
      invocationId,
      prompt: options.prompt,
      cwd: options.cwd ?? this.workspacePath,
      model,
      responseFormat: options.responseFormat,
      temperature,
      traceContext: cliTraceContext,
    });

    // Surface CLI invocation failures as thrown errors. Without this,
    // a non-zero exit (gemini arg-parse error, missing binary, timeout)
    // silently produced `{text:'', parsed:null}` and the caller saw a
    // success-shaped result — phase handlers then fell through on
    // `result.parsed ?? defaultReport` and the workflow kept running
    // with an invalid default. A CLI failure at the Orchestrator role
    // is a hard stop, not a soft fallback.
    if (!result.success || (result.cliResult && result.cliResult.exitCode !== 0)) {
      const exitCode = result.cliResult?.exitCode ?? 'null';
      const stderr = (result.cliResult?.stderr ?? '').trim().slice(0, 400);
      const reason = result.error ?? `process exited with code ${exitCode}`;
      throw new Error(
        `callForRole('${role}') backing '${backing_tool}' failed: ${reason}` +
        (stderr ? `\nstderr: ${stderr}` : ''),
      );
    }

    // Prefer the raw stdout (stdoutText) over the line-per-event
    // reconstruction. The per-line parser is shape-specific (Claude
    // stream-json vs Goose message envelopes); Gemini emits plain
    // text so its events land as typeless fragments that
    // extractFinalText's type-filter couldn't concatenate. stdoutText
    // captures the full output losslessly — extractFinalText remains
    // the fallback for cases where the CLI invoker didn't populate
    // stdoutText (older code paths / tests with stubbed cliInvoker).
    //
    // Exception: codex_cli --json emits pure JSONL, so stdoutText is
    // multi-event NDJSON that would break parseJsonWithRecovery (first-
    // brace-to-last-brace spans all events). For codex we reach through
    // to extractFinalText which knows the agent_message shape.
    const events = result.cliResult?.events ?? [];
    const stdoutText = result.cliResult?.stdoutText ?? '';
    const useEventsFirst = normalizedBackingTool === 'codex_cli';
    const text = useEventsFirst
      ? (extractFinalText(events) || stdoutText)
      : (stdoutText || extractFinalText(events));
    let parsed: Record<string, unknown> | null = null;
    if (options.responseFormat === 'json' && text) {
      // Use parseJsonWithRecovery so trailing commas, code-fence
      // wrappers, and single-quoted strings survive the round trip.
      // Bare JSON.parse lost a Phase 1.2 bloom worth 9KB of real
      // content to a single trailing comma at position 7217 — the
      // Orchestrator's 1.0 IQC is just as vulnerable.
      const recovered = parseJsonWithRecovery(text);
      parsed = recovered.parsed;
    }
    return {
      text,
      parsed,
      toolCalls: [],
      provider: backing_tool,
      model: model ?? '',
      inputTokens: null,
      outputTokens: null,
      usedFallback: false,
      retryAttempts: 0,
    };
  }

  generateId(): string {
    return randomUUID();
  }
}

/**
 * Extract the final synthesized text from a CLI invocation's parsed
 * events. Priority order:
 *   1. Terminal `result` envelope with `data.result` (Claude Code).
 *   2. Last `text`-typed content item (Goose + flat fallback).
 *   3. Concatenation of all `text` content items.
 *
 * Thinking-only events are excluded — they describe reasoning, not
 * the model's final answer, and would pollute a JSON parse attempt.
 */
export function extractFinalText(
  events: ReadonlyArray<import('../cli/outputParser').ParsedEvent>,
): string {
  // Prefer the terminal result envelope (Claude Code).
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.data.type === 'result' && typeof e.data.result === 'string') {
      return e.data.result;
    }
  }
  // Codex Responses API: item.completed with nested agent_message.
  // Ported from v1 codexCli.ts:parseCodexOutput — scan from the end
  // for the most recent agent_message so reasoning-intermediate
  // messages don't shadow the final answer.
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.data.type === 'item.completed') {
      const item = (e.data as { item?: { type?: string; text?: string } }).item;
      if (item?.type === 'agent_message' && typeof item.text === 'string') {
        return item.text;
      }
    }
  }
  // Fall back to the last text content item.
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.data.type === 'text' && typeof e.data.text === 'string') {
      return e.data.text;
    }
  }
  // Concatenate every text content item (Goose streams these
  // one-token-per-event, so concatenation reassembles the response).
  const parts: string[] = [];
  for (const e of events) {
    if (e.data.type === 'text' && typeof e.data.text === 'string') {
      parts.push(e.data.text);
    }
  }
  return parts.join('');
}

/**
 * Extract the agent's reasoning/thinking content from a CLI invocation's
 * events. Concatenates any intermediate thinking, assistant-style
 * messages, and reasoning steps — explicitly skips `tool_use` and
 * `tool_result` events per the cal-24 design (tool-call output bloats
 * the review prompt without surfacing reasoning flaws the reviewer can
 * act on).
 *
 * Used by the reasoning-review hook in agentInvoker to populate the
 * `thinking` channel for CLI-dispatched agents (Goose, Claude Code,
 * Gemini, Codex). When the CLI emits no separable reasoning channel
 * (e.g. Gemini plain text), the result is empty and the reviewer just
 * sees prompt + final response.
 */
export function extractReasoningText(
  events: ReadonlyArray<import('../cli/outputParser').ParsedEvent>,
): string {
  const parts: string[] = [];
  // Track which events to exclude as the "final answer" so they're not
  // double-counted (final answer goes in the `text` channel separately).
  let lastResultIndex = -1;
  let lastAgentMessageIndex = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (lastResultIndex === -1 && e.data.type === 'result') {
      lastResultIndex = i;
    }
    const item = (e.data as { item?: { type?: string } }).item;
    if (lastAgentMessageIndex === -1 && e.data.type === 'item.completed' && item?.type === 'agent_message') {
      lastAgentMessageIndex = i;
    }
  }
  for (let i = 0; i < events.length; i++) {
    if (i === lastResultIndex || i === lastAgentMessageIndex) continue;
    const e = events[i];
    const t = e.data.type;
    // Tool-call activity — excluded per design.
    if (t === 'tool_use' || t === 'tool_result' || t === 'tool_call') continue;
    // Type-only event envelopes that carry no readable text.
    if (t === 'result') continue;
    // Reasoning / message text. The CLI parser normalizes thinking
    // payloads into `text` / `content` so we read either.
    const data = e.data as { text?: unknown; content?: unknown; thinking?: unknown };
    const text = typeof data.text === 'string'
      ? data.text
      : (typeof data.content === 'string'
        ? data.content
        : (typeof data.thinking === 'string' ? data.thinking : ''));
    if (text.trim().length > 0) parts.push(text);
  }
  return parts.join('\n');
}
