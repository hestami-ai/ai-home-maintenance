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
import { LLMCaller } from '../llm/llmCaller';
import { EventBus } from '../events/eventBus';
import { DecisionTraceGenerator } from '../memory/decisionTraceGenerator';
import { NarrativeMemoryGenerator } from '../memory/narrativeMemoryGenerator';
import type { ConfigManager } from '../config/configManager';
import type { PhaseId, WorkflowRun } from '../types/records';
import { PHASE_NAMES } from '../types/records';

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

export type DecisionSurfaceType = 'mirror' | 'menu' | 'decision_bundle' | 'phase_gate';

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

  private readonly phaseHandlers = new Map<PhaseId, PhaseHandler>();
  private readonly versionSha: string;
  private readonly pendingDecisions = new Map<string, PendingDecision>();

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
    private readonly db: Database,
    private readonly configManager: ConfigManager,
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

    this.agentInvoker = new AgentInvoker(this.llmCaller, {
      timeoutSeconds: config.cli_invocation.timeout_seconds,
      idleTimeoutSeconds: config.cli_invocation.idle_timeout_seconds,
      bufferMaxEvents: config.cli_invocation.buffer_max_events,
    });

    this.eventBus = new EventBus();

    // Connect the writer to the eventBus so every successful write emits
    // `record:added`. The webview view provider subscribes and forwards
    // these to the webview as `addRecord` postMessage payloads.
    this.writer.setEventBus(this.eventBus);

    this.decisionTraceGenerator = new DecisionTraceGenerator(db);
    this.narrativeMemoryGenerator = new NarrativeMemoryGenerator(this.llmCaller, this.templateLoader, {
      provider: 'ollama',
      model: 'qwen3.5:9b',
      temperature: 0.3,
      janumiCodeVersionSha: this.versionSha,
    });
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

    this.eventBus.emit('phase:started', {
      phaseId,
      phaseName: PHASE_NAMES[phaseId] ?? phaseId,
    });
    getLogger().info('workflow', 'Phase started', { workflow_run_id: runId, phase_id: phaseId, phase_name: PHASE_NAMES[phaseId] }, phaseTrace);

    const result = await handler.execute({ workflowRun: run, engine: this });

    if (result.success) {
      this.eventBus.emit('phase:completed', {
        phaseId,
        phaseName: PHASE_NAMES[phaseId] ?? phaseId,
      });
      getLogger().info('workflow', 'Phase completed', { workflow_run_id: runId, phase_id: phaseId, artifact_count: result.artifactIds.length }, phaseTrace);
    } else {
      getLogger().error('workflow', 'Phase failed', { workflow_run_id: runId, phase_id: phaseId, error: result.error }, phaseTrace);
    }

    return result;
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
      const synthetic: DecisionResolution =
        surfaceType === 'menu' || surfaceType === 'decision_bundle'
          ? { type: 'menu_selection', payload: { selected: [] } }
          : surfaceType === 'phase_gate'
            ? { type: 'phase_gate_approval' }
            : { type: 'mirror_approval' };
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

  generateId(): string {
    return randomUUID();
  }
}
