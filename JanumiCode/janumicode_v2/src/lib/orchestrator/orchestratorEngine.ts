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
import {
  createClaudeCodeParser,
  createCodexCliParser,
  createGeminiCliParser,
  createGooseCliParser,
} from '../cli/outputParser';
import { LLMCaller } from '../llm/llmCaller';
import { parseJsonWithRecovery } from '../llm/jsonRecovery';
import { EventBus } from '../events/eventBus';
import { DecisionTraceGenerator } from '../memory/decisionTraceGenerator';
import { NarrativeMemoryGenerator } from '../memory/narrativeMemoryGenerator';
import { DeepMemoryResearchAgent, type MaterialityWeights } from '../agents/deepMemoryResearch';
import type { EmbeddingService } from '../embedding/embeddingService';
import type { ConfigManager } from '../config/configManager';
import type { PhaseId, WorkflowRun } from '../types/records';
import { PHASE_NAMES, PHASE_ORDER } from '../types/records';

// ── Phase Handler Interface ─────────────────────────────────────────

export interface PhaseHandler {
  phaseId: PhaseId;
  execute(context: PhaseContext): Promise<PhaseResult>;
}

export interface PhaseContext {
  workflowRun: WorkflowRun;
  engine: OrchestratorEngine;
}

export interface PhaseResult {
  success: boolean;
  error?: string;
  /** Artifact IDs produced by this phase */
  artifactIds: string[];
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
    this.schemaValidator = new SchemaValidator(extensionPath);
    this.invariantChecker = new InvariantChecker(
      `${extensionPath}/.janumicode/schemas/invariants`,
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

    this.agentInvoker = new AgentInvoker(this.llmCaller, {
      timeoutSeconds: config.cli_invocation.timeout_seconds,
      idleTimeoutSeconds: config.cli_invocation.idle_timeout_seconds,
      bufferMaxEvents: config.cli_invocation.buffer_max_events,
    });
    this.agentInvoker.setWriter(this.writer, this.versionSha);

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

    this.decisionTraceGenerator = new DecisionTraceGenerator(db);
    this.narrativeMemoryGenerator = new NarrativeMemoryGenerator(this.llmCaller, this.templateLoader, {
      provider: 'ollama',
      model: 'qwen3.5:9b',
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
    this.deepMemoryResearch = new DeepMemoryResearchAgent(
      db, this.llmCaller, weights,
      { janumiCodeVersionSha: this.versionSha },
      this.templateLoader,
      undefined, // embedding service — attached later
      this.writer,
    );

    this.workspacePath = workspacePath;
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
    (this as unknown as { deepMemoryResearch: DeepMemoryResearchAgent }).deepMemoryResearch =
      new DeepMemoryResearchAgent(
        this.db, this.llmCaller, weights.materiality_weights,
        { janumiCodeVersionSha: this.versionSha },
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
    getLogger().info('workflow', 'Workflow started', { workflow_run_id: runId, workspace_id: workspaceId, trace_id: trace.trace_id }, trace);
    return { run, trace };
  }

  /** Number of phase executions currently in-flight. Used by quiescence detection. */
  private _executingPhaseCount = 0;
  get executingPhaseCount(): number { return this._executingPhaseCount; }

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
      try {
        result = await handler.execute({ workflowRun: run, engine: this });
      } catch (err) {
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

        // In auto-approve mode, chain to the next phase automatically.
        // In normal (webview) mode, the DecisionRouter handles this when
        // the human approves the phase gate. We await here (not fire-and-forget)
        // so the full pipeline completes before the caller returns, which
        // lets waitForQuiescence track in-flight LLM calls correctly.
        // Skip Phase 0 — the ClientLiaisonAgent handles 0→1 advancement itself.
        if (this.autoApproveDecisions && phaseId !== '0') {
          // phaseLimit stops the chain AFTER the named phase completes,
          // so the harness can capture phase-N fixtures + assertions in
          // isolation instead of running the whole pipeline to phase 10.
          if (this.phaseLimit && phaseId === this.phaseLimit) {
            getLogger().info('workflow', 'Phase limit reached; halting auto-advance', {
              workflow_run_id: runId,
              phase_id: phaseId,
              phase_limit: this.phaseLimit,
            }, phaseTrace);
          } else {
            const idx = PHASE_ORDER.indexOf(phaseId);
            if (idx >= 0 && idx < PHASE_ORDER.length - 1) {
              const nextPhase = PHASE_ORDER[idx + 1];
              if (this.phaseHandlers.has(nextPhase)) {
                const advanced = this.advanceToNextPhase(runId, nextPhase);
                if (advanced) {
                  await this.executeCurrentPhase(runId, phaseTrace);
                }
              }
            } else if (idx === PHASE_ORDER.length - 1) {
              this.stateMachine.completeWorkflowRun(runId);
              this.eventBus.emit('workflow:completed', { workflowRunId: runId });
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
      const run = this.stateMachine.getWorkflowRun(runId);
      const currentSubPhase = run?.current_sub_phase_id ?? null;
      const overrideSelection = currentSubPhase
        ? this.decisionOverrides.get(currentSubPhase)
        : undefined;

      const synthetic = this.synthesizeResolution(
        decisionId,
        surfaceType,
        overrideSelection,
      );

      // Write an attribution record so the audit trail (and the harness
      // oracle) can distinguish a headless auto-approval from a human
      // approval. Without this, the governed stream is silent at every
      // decision point in auto-approve mode — the gap report can't tell
      // whether a phase gate was actually approved or just skipped.
      try {
        this.writer.writeRecord({
          record_type: 'decision_trace',
          schema_version: '1.0',
          workflow_run_id: runId,
          phase_id: run?.current_phase_id ?? null,
          sub_phase_id: currentSubPhase,
          janumicode_version_sha: this.versionSha,
          derived_from_record_ids: [decisionId],
          content: {
            decision_type: synthetic.type,
            target_record_id: decisionId,
            surface_type: surfaceType,
            attribution: overrideSelection ? 'headless_override' : 'auto_approve',
            auto_approved: !overrideSelection,
            auto_approved_by: overrideSelection ? null : 'orchestrator_auto_approve',
            override_selection: overrideSelection ?? null,
            payload: synthetic.payload ?? {},
          },
        });
      } catch {
        // Best-effort — attribution must never block the resolution.
      }

      this.eventBus.emit('decision:requested', { runId, decisionId, surfaceType });
      this.eventBus.emit('decision:resolved', { runId, decisionId, resolution: synthetic });
      return Promise.resolve(synthetic);
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
    });
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
    const { backing_tool, provider, model } = roleRouting.primary;
    const temperature = options.temperature ?? roleRouting.temperature ?? 0.3;

    if (backing_tool === 'direct_llm_api') {
      if (!provider) {
        throw new Error(`role '${role}' direct_llm_api backing requires a provider`);
      }
      return this.llmCaller.call({
        provider,
        model: model ?? '',
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
function extractFinalText(
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
