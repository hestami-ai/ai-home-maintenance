/**
 * GovernedStreamViewProvider — the VS Code webview view provider for the
 * JanumiCode sidebar. Replaces the inline stub in extension.ts.
 *
 * Responsibilities:
 *   - Build the webview HTML with nonce-based CSP and load the bundled
 *     Svelte client.
 *   - Subscribe to engine events (record:added, phase:started, phase:completed,
 *     phase_gate:pending, error:occurred, llm:queued/started/finished,
 *     decision:requested) and forward them as outbound postMessage calls.
 *   - Route inbound postMessage payloads (submitIntent, submitOpenQuery,
 *     pickFile, resolveMention, decision) to the orchestrator, Liaison, or
 *     DecisionRouter as appropriate.
 *   - Handle webview reload by rebuilding the snapshot from the database
 *     and re-creating any unresolved pending decisions.
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Database } from '../database/init';
import type { OrchestratorEngine } from '../orchestrator/orchestratorEngine';
import type { DecisionRouter, InboundDecision } from '../orchestrator/decisionRouter';
import type { ClientLiaisonAgent } from '../agents/clientLiaisonAgent';
import { makeUserInput } from '../agents/clientLiaisonAgent';
import type { CapabilityContext } from '../agents/clientLiaison/capabilities/index';
import type {
  GovernedStreamRecord,
  PhaseId,
  WorkflowRun,
  AuthorityLevel,
  AgentRole,
  WorkflowRunStatus,
} from '../types/records';
import type { MentionExtensionHost } from '../agents/clientLiaison/mentionResolver';
import type { MentionCandidate } from '../agents/clientLiaison/types';
import type { SerializedRecord } from '../events/eventBus';
import { getLogger } from '../logging';

export interface WorkflowSession {
  currentRunId: string | null;
}

interface InboundMessage {
  type: string;
  [key: string]: unknown;
}

export class GovernedStreamViewProvider implements vscode.WebviewViewProvider {
  private webview: vscode.Webview | null = null;
  private readonly disposers: Array<() => void> = [];
  /**
   * Tracks the last sub-phase id we posted to the webview so the
   * record:added handler can detect transitions cheaply (only re-posts
   * when the sub-phase actually changes, not on every governed-stream
   * write). Reset on workflow:started.
   */
  private lastPostedSubPhaseId: string | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly engine: OrchestratorEngine,
    private readonly db: Database,
    private readonly liaison: ClientLiaisonAgent,
    private readonly decisionRouter: DecisionRouter,
    private readonly session: WorkflowSession,
    private readonly workspaceId: string,
    private readonly workspaceRoot: string,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    getLogger().info('ui', 'resolveWebviewView called by VS Code');
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    this.webview = view.webview;
    try {
      view.webview.html = this.buildHtml(view.webview);
      getLogger().info('ui', 'webview HTML set', {
        htmlBytes: view.webview.html.length,
      });
    } catch (err) {
      getLogger().error('ui', 'Failed to build webview HTML', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // Inbound messages
    view.webview.onDidReceiveMessage((msg: InboundMessage) => {
      // Webview-side errors are forwarded so they show up in the extension's
      // output channel rather than the inaccessible webview devtools console.
      if (msg.type === 'webviewError') {
        getLogger().error('ui', 'Webview runtime error', {
          message: (msg as { message?: string }).message,
          stack: (msg as { stack?: string }).stack,
          source: (msg as { source?: string }).source,
        });
        return;
      }
      if (msg.type === 'webviewLog') {
        const level = (msg as { level?: string }).level ?? 'info';
        const text = (msg as { message?: string }).message ?? '';
        if (level === 'error') {
          getLogger().error('ui', `[webview] ${text}`);
        } else if (level === 'warn') {
          getLogger().warn('ui', `[webview] ${text}`);
        } else {
          getLogger().info('ui', `[webview] ${text}`);
        }
        return;
      }

      this.handleMessage(msg).catch((err) => {
        getLogger().warn('ui', 'Webview message handler failed', {
          type: msg.type,
          error: String(err),
        });
        this.post({ type: 'error', message: String(err) });
      });
    });

    // Outbound: forward eventBus events to the webview.
    //
    // Sub-phase change detection: stateMachine.setSubPhase() updates
    // workflow_runs.current_sub_phase_id but emits NO event, so the
    // webview's PhaseIndicator never learned that 1.0 → 1.1b → 1.2
    // happened — Phase 1's sub-list stayed unticked all the way to
    // 1.3. We piggy-back on `record:added` (every record carries a
    // sub_phase_id when one applies) and detect the transition by
    // comparing against the last-posted value. The recompute queries
    // are cheap (single DISTINCT scan keyed by run id), and we only
    // re-post the phaseUpdate when the sub-phase actually changes.
    const off1 = this.engine.eventBus.on('record:added', (p) => {
      this.post({ type: 'addRecord', record: p.record });
      const newSubPhase = (p.record as { sub_phase_id?: string | null }).sub_phase_id ?? null;
      if (
        this.session.currentRunId &&
        newSubPhase &&
        newSubPhase !== this.lastPostedSubPhaseId
      ) {
        this.lastPostedSubPhaseId = newSubPhase;
        const completedPhases = this.getCompletedPhases(this.session.currentRunId);
        const completedSubPhases = this.getCompletedSubPhases(this.session.currentRunId);
        const skippedSubPhases = this.getSkippedSubPhases(this.session.currentRunId);
        const run = this.engine.stateMachine.getWorkflowRun(this.session.currentRunId);
        this.post({
          type: 'phaseUpdate',
          event: 'sub_phase:changed',
          payload: {
            phaseId: run?.current_phase_id ?? undefined,
            subPhaseId: newSubPhase,
            completedPhases,
            completedSubPhases,
            skippedSubPhases,
            workflowRunId: this.session.currentRunId,
          },
        });
      }
    });
    // workflow:started fires BEFORE phase:started during intent submission.
    // Sync the session run id here so the phaseUpdate payloads emitted by
    // the subsequent phase:started handler carry a non-null workflowRunId —
    // the webview's PhaseIndicator hides itself when workflowRunId is null.
    const off0 = this.engine.eventBus.on('workflow:started', (p) => {
      this.session.currentRunId = p.workflowRunId;
      this.lastPostedSubPhaseId = null;
      this.post({
        type: 'phaseUpdate',
        event: 'workflow:started',
        payload: {
          phaseId: '0',
          subPhaseId: null,
          completedPhases: [],
          completedSubPhases: [],
          skippedSubPhases: [],
          status: 'active',
          workflowRunId: p.workflowRunId,
        },
      });
    });
    const off2 = this.engine.eventBus.on('phase:started', (p) => {
      const completedPhases = this.session.currentRunId ? this.getCompletedPhases(this.session.currentRunId) : [];
      const completedSubPhases = this.session.currentRunId ? this.getCompletedSubPhases(this.session.currentRunId) : [];
      const skippedSubPhases = this.session.currentRunId ? this.getSkippedSubPhases(this.session.currentRunId) : [];
      this.post({
        type: 'phaseUpdate',
        event: 'phase:started',
        payload: { ...p, completedPhases, completedSubPhases, skippedSubPhases, workflowRunId: this.session.currentRunId },
      });
    });
    const off3 = this.engine.eventBus.on('phase:completed', (p) => {
      const completedPhases = this.session.currentRunId ? this.getCompletedPhases(this.session.currentRunId) : [];
      const completedSubPhases = this.session.currentRunId ? this.getCompletedSubPhases(this.session.currentRunId) : [];
      const skippedSubPhases = this.session.currentRunId ? this.getSkippedSubPhases(this.session.currentRunId) : [];
      this.post({
        type: 'phaseUpdate',
        event: 'phase:completed',
        payload: { ...p, completedPhases, completedSubPhases, skippedSubPhases, workflowRunId: this.session.currentRunId },
      });
    });
    const off4 = this.engine.eventBus.on('phase_gate:pending', (p) => {
      const completedPhases = this.session.currentRunId ? this.getCompletedPhases(this.session.currentRunId) : [];
      const completedSubPhases = this.session.currentRunId ? this.getCompletedSubPhases(this.session.currentRunId) : [];
      const skippedSubPhases = this.session.currentRunId ? this.getSkippedSubPhases(this.session.currentRunId) : [];
      this.post({
        type: 'phaseUpdate',
        event: 'phase_gate:pending',
        payload: { ...p, completedPhases, completedSubPhases, skippedSubPhases, workflowRunId: this.session.currentRunId },
      });
    });
    const off5 = this.engine.eventBus.on('error:occurred', (p) => {
      this.post({ type: 'error', message: p.message, context: p.context });
    });
    const off6 = this.engine.eventBus.on('llm:queued', (p) => {
      this.post({ type: 'llmStatus', event: 'queued', payload: p });
    });
    const off7 = this.engine.eventBus.on('llm:started', (p) => {
      this.post({ type: 'llmStatus', event: 'started', payload: p });
    });
    const off8 = this.engine.eventBus.on('llm:finished', (p) => {
      this.post({ type: 'llmStatus', event: 'finished', payload: p });
    });
    // Forward streaming chunks (LLM tokens + CLI stdout/stderr) directly to
    // the webview without persisting them. The transient store keyed by
    // invocationId in the webview reassembles them for live rendering;
    // once `agent_output` lands, the card switches to its authoritative
    // text and the transient buffer is dropped.
    const off9 = this.engine.eventBus.on('llm:stream_chunk', (p) => {
      this.post({ type: 'streamChunk', payload: p });
    });

    this.disposers.push(off0, off1, off2, off3, off4, off5, off6, off7, off8, off9);

    view.onDidDispose(() => {
      for (const d of this.disposers) d();
      this.disposers.length = 0;
      this.webview = null;
    });
  }

  /** Focus the sidebar (used by the startWorkflowRun command). */
  async focusComposer(): Promise<void> {
    await vscode.commands.executeCommand('janumicode.governedStream.focus');
  }

  postFindFocus(): void {
    this.post({ type: 'focusFind' });
  }

  /**
   * Build a CapabilityContext for direct command/slash invocation. Used by
   * the showWorkflowStatus command.
   */
  getCapabilityContext(): CapabilityContext {
    const activeRun = this.session.currentRunId
      ? this.engine.stateMachine.getWorkflowRun(this.session.currentRunId)
      : null;
    return this.buildCapabilityContext(activeRun);
  }

  // ── Inbound message routing ───────────────────────────────────

  private async handleMessage(msg: InboundMessage): Promise<void> {
    switch (msg.type) {
      case 'webviewReady':
        await this.handleWebviewReady();
        return;
      case 'submitIntent':
        await this.handleSubmitIntent(msg as unknown as { text: string; attachments?: string[]; references?: never[] });
        return;
      case 'submitOpenQuery':
        await this.handleSubmitOpenQuery(msg as unknown as { text: string; references?: never[]; forceCapability?: string });
        return;
      case 'pickFile':
        await this.handlePickFile(msg as unknown as { requestId: string; multiple?: boolean });
        return;
      case 'resolveMention':
        await this.handleResolveMention(msg as unknown as { requestId: string; query: string; types?: never[] });
        return;
      case 'decision':
        this.handleDecision(msg as unknown as { recordId: string; decision: InboundDecision });
        return;
      case 'decisionBatch':
        this.handleDecisionBatch(msg as unknown as {
          recordId: string;
          decisions: Array<{ itemId: string; action: string; payload?: Record<string, unknown> }>;
        });
        return;
      case 'decisionBundleSubmit':
        this.handleDecisionBundleSubmit(msg as unknown as {
          recordId: string;
          surfaceId: string;
          mirror_decisions: Array<{ item_id: string; action: string; edited_text?: string }>;
          menu_selections: Array<{ option_id: string; free_text?: string }>;
        });
        return;
      case 'focusComposer':
        // Best-effort nudge emitted by DecisionBundleCard when the user
        // hits "Ask more" — the webview focuses its own textarea, but
        // this ensures the sidebar panel itself has focus so keyboard
        // input lands in the composer without an extra click.
        void this.focusComposer();
        return;
      default:
        getLogger().debug('ui', 'Unhandled webview message', { type: msg.type });
    }
  }

  private async handleWebviewReady(): Promise<void> {
    // Recover the latest workflow run if the session lost its currentRunId
    // (e.g. on a webview reload).
    if (!this.session.currentRunId) {
      const latest = this.liaison.getDB().getCurrentWorkflowRun();
      if (latest) {
        this.session.currentRunId = latest.id;
      }
    }

    // Build and stream the snapshot from the database. Pagination keeps the
    // RPC bridge bounded — without it, a workflow with thousands of records
    // can produce a single response payload bigger than the SharedArrayBuffer
    // can carry, which surfaces as the "RPC error: offset is out of bounds"
    // the user reported on extension restart.
    if (this.session.currentRunId) {
      this.streamSnapshot(this.session.currentRunId);
    } else {
      this.post({ type: 'snapshot', records: [] });
    }

    // Send phase update so the composer mode flips to Open Query.
    if (this.session.currentRunId) {
      const run = this.engine.stateMachine.getWorkflowRun(this.session.currentRunId);
      const completedPhases = this.getCompletedPhases(this.session.currentRunId);
      const completedSubPhases = this.getCompletedSubPhases(this.session.currentRunId);
      const skippedSubPhases = this.getSkippedSubPhases(this.session.currentRunId);
      if (run?.current_phase_id) {
        this.post({
          type: 'phaseUpdate',
          event: 'phase:started',
          payload: {
            phaseId: run.current_phase_id,
            subPhaseId: run.current_sub_phase_id,
            completedPhases,
            completedSubPhases,
            skippedSubPhases,
            status: run.status === 'in_progress' ? 'active' : run.status,
            workflowRunId: this.session.currentRunId,
          },
        });
      }

      // Re-create pending decisions so the user can resume mid-flow after reload.
      const pending = this.liaison.getDB().getPendingDecisions(this.session.currentRunId);
      for (const surface of pending) {
        const surfaceType = this.surfaceTypeOf(surface.record_type);
        if (surfaceType) {
          // Fire-and-forget — the user will resolve via the next decision message.
          void this.engine.recreatePendingFromRecord(
            this.session.currentRunId,
            surface.id,
            surfaceType,
          );
        }
      }
    }
  }

  private async handleSubmitIntent(msg: {
    text: string;
    attachments?: string[];
  }): Promise<void> {
    if (this.session.currentRunId) {
      const existing = this.engine.stateMachine.getWorkflowRun(this.session.currentRunId);
      if (existing && (existing.status === 'in_progress' || existing.status === 'initiated')) {
        this.post({
          type: 'error',
          message: 'A workflow is already active. Ask a question or wait for it to finish.',
        });
        return;
      }
    }

    // Build a UserInput.
    const input = makeUserInput({
      text: msg.text,
      attachments: (msg.attachments ?? []).map((uri) => ({
        uri,
        name: path.basename(uri),
        type: 'file' as const,
      })),
      inputMode: 'raw_intent',
      workflowRunId: null,
      currentPhaseId: null,
    });

    // The Liaison will classify as workflow_initiation, dispatch startWorkflow.
    const ctx = this.buildCapabilityContext(null);
    const response = await this.liaison.handleUserInput(input, ctx);

    // After startWorkflow runs, the engine has a new active run id; update the session.
    const newRun = this.liaison.getDB().getCurrentWorkflowRun();
    if (newRun) this.session.currentRunId = newRun.id;

    if (response.escalatedToOrchestrator) {
      // Already handled inside handleUserInput
    }
  }

  private async handleSubmitOpenQuery(msg: {
    text: string;
    forceCapability?: string;
  }): Promise<void> {
    if (!this.session.currentRunId) {
      this.post({
        type: 'error',
        message: 'No active workflow. Type your intent first to start one.',
      });
      return;
    }
    const activeRun = this.engine.stateMachine.getWorkflowRun(this.session.currentRunId);
    const input = makeUserInput({
      text: msg.text,
      inputMode: 'open_query',
      workflowRunId: this.session.currentRunId,
      currentPhaseId: activeRun?.current_phase_id ?? null,
      forceCapability: msg.forceCapability,
    });
    const ctx = this.buildCapabilityContext(activeRun);
    await this.liaison.handleUserInput(input, ctx);
  }

  private async handlePickFile(msg: { requestId: string; multiple?: boolean }): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: msg.multiple ?? true,
      canSelectFiles: true,
      canSelectFolders: false,
    });
    this.post({
      type: 'pickFileResult',
      requestId: msg.requestId,
      uris: (uris ?? []).map((u) => ({ fsPath: u.fsPath, basename: path.basename(u.fsPath) })),
    });
  }

  private async handleResolveMention(msg: {
    requestId: string;
    query: string;
    types?: Array<'file' | 'symbol' | 'decision' | 'constraint' | 'phase' | 'run'>;
  }): Promise<void> {
    const candidates = await this.liaison.resolveMention(msg.query, msg.types);
    this.post({
      type: 'mentionCandidates',
      requestId: msg.requestId,
      candidates,
    });
  }

  private handleDecision(msg: { recordId: string; decision: InboundDecision }): void {
    if (!this.session.currentRunId) {
      this.post({ type: 'error', message: 'No active workflow run.' });
      return;
    }
    this.decisionRouter.route(this.session.currentRunId, msg.decision);
  }

  private handleDecisionBatch(msg: {
    recordId: string;
    decisions: Array<{
      itemId: string;
      action: string;
      payload?: Record<string, unknown>;
    }>;
  }): void {
    if (!this.session.currentRunId) {
      this.post({ type: 'error', message: 'No active workflow run.' });
      return;
    }
    this.decisionRouter.routeBatch(this.session.currentRunId, {
      recordId: msg.recordId,
      decisions: msg.decisions.map(d => ({
        itemId: d.itemId,
        action: d.action as 'accepted' | 'rejected' | 'deferred' | 'edited',
        payload: d.payload,
      })),
    });
  }

  private handleDecisionBundleSubmit(msg: {
    recordId: string;
    surfaceId: string;
    mirror_decisions: Array<{ item_id: string; action: string; edited_text?: string }>;
    menu_selections: Array<{ option_id: string; free_text?: string }>;
  }): void {
    if (!this.session.currentRunId) {
      this.post({ type: 'error', message: 'No active workflow run.' });
      return;
    }
    this.decisionRouter.routeBundle(this.session.currentRunId, {
      recordId: msg.recordId,
      surfaceId: msg.surfaceId,
      mirrorDecisions: msg.mirror_decisions.map(d => ({
        item_id: d.item_id,
        action: d.action as 'accepted' | 'rejected' | 'edited' | 'deferred',
        edited_text: d.edited_text,
      })),
      menuSelections: msg.menu_selections,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  private buildCapabilityContext(activeRun: WorkflowRun | null): CapabilityContext {
    return {
      workspaceId: this.workspaceId,
      workspaceRoot: this.workspaceRoot,
      activeRun,
      currentPhase: activeRun?.current_phase_id ?? null,
      currentSubPhase: activeRun?.current_sub_phase_id ?? null,
      runStatus: activeRun?.status ?? null,
      orchestrator: this.engine,
      db: this.liaison.getDB(),
      eventBus: this.engine.eventBus,
      embedding: (this.liaison as unknown as { config: { embeddingService: import('../embedding/embeddingService').EmbeddingService } }).config.embeddingService,
    };
  }

  private surfaceTypeOf(recordType: string): 'mirror' | 'decision_bundle' | 'phase_gate' | null {
    switch (recordType) {
      case 'mirror_presented': return 'mirror';
      case 'decision_bundle_presented': return 'decision_bundle';
      case 'phase_gate_evaluation': return 'phase_gate';
      default: return null;
    }
  }

  /**
   * Stream a workflow's records to the webview in pages so neither the RPC
   * bridge (capped by SharedArrayBuffer size) nor the postMessage channel
   * has to carry the full snapshot in one shot. Sends:
   *   - one `snapshotStart` so the webview can clear/reset stores
   *   - N × `snapshotChunk` with batches of records
   *   - one `snapshotComplete` so the webview can finalize (scroll, unlock
   *     composer, etc.) once the last batch is in.
   * Page size is generous (500 rows) but small enough that even rich
   * agent_invocation rows with multi-KB prompts stay well under the 32MB
   * RPC ceiling.
   */
  private streamSnapshot(runId: string): void {
    const PAGE_SIZE = 500;
    this.post({ type: 'snapshotStart' });
    let offset = 0;
    const stmt = this.db.prepare(
      `SELECT * FROM governed_stream
        WHERE workflow_run_id = ? AND is_current_version = 1
        ORDER BY produced_at ASC
        LIMIT ? OFFSET ?`,
    );
    while (true) {
      const rows = stmt.all(runId, PAGE_SIZE, offset) as Record<string, unknown>[];
      if (rows.length === 0) break;
      const records = rows.map((r) => this.serialize(this.rowToRecord(r)));
      this.post({ type: 'snapshotChunk', records });
      if (rows.length < PAGE_SIZE) break;
      offset += rows.length;
    }
    this.post({ type: 'snapshotComplete' });
  }

  /**
   * Get list of completed phase IDs for a workflow run.
   * Completed phases are those with phase_gate_approved records.
   */
  private getCompletedPhases(runId: string): PhaseId[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT phase_id FROM governed_stream
         WHERE workflow_run_id = ?
           AND record_type = 'phase_gate_approved'
           AND is_current_version = 1
         ORDER BY produced_at ASC`,
      )
      .all(runId) as { phase_id: string }[];
    return rows.map((r) => r.phase_id as PhaseId);
  }

  /**
   * Get list of completed sub-phase IDs for a workflow run.
   * Completed sub-phases are those that have records produced after them
   * (indicating the sub-phase finished). We track by looking at all sub_phase_id
   * values that appear in records, excluding the current one.
   */
  private getCompletedSubPhases(runId: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT sub_phase_id FROM governed_stream
         WHERE workflow_run_id = ?
           AND sub_phase_id IS NOT NULL
           AND sub_phase_id != ''
           AND is_current_version = 1
         ORDER BY produced_at ASC`,
      )
      .all(runId) as { sub_phase_id: string }[];
    // Get current sub-phase to exclude it
    const run = this.engine.stateMachine.getWorkflowRun(runId);
    const currentSubPhase = run?.current_sub_phase_id;
    return rows
      .map((r) => r.sub_phase_id)
      .filter((sp) => sp !== currentSubPhase);
  }

  /**
   * Get list of skipped sub-phase IDs for a workflow run.
   * Skipped sub-phases are conditional sub-phases that don't apply:
   * - Brownfield-only sub-phases (0.2, 0.2b, 0.3) for greenfield projects
   * - Phase 0.5 sub-phases when Phase 0.5 was not triggered
   */
  private getSkippedSubPhases(runId: string): string[] {
    const skipped: string[] = [];

    // Check if workspace is greenfield (skip brownfield-only sub-phases)
    const classificationRow = this.db
      .prepare(
        `SELECT content FROM governed_stream
         WHERE workflow_run_id = ?
           AND record_type = 'workspace_classification'
           AND is_current_version = 1
         LIMIT 1`,
      )
      .get(runId) as { content: string } | undefined;

    if (classificationRow) {
      try {
        const content = JSON.parse(classificationRow.content) as { workspace_type?: string };
        if (content.workspace_type === 'greenfield') {
          // Brownfield-only sub-phases to skip
          skipped.push('0.2', '0.2b', '0.3');
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check if Phase 0.5 was triggered (skip if not)
    const phase05Triggered = this.db
      .prepare(
        `SELECT 1 FROM governed_stream
         WHERE workflow_run_id = ?
           AND phase_id = '0.5'
           AND is_current_version = 1
         LIMIT 1`,
      )
      .get(runId);

    if (!phase05Triggered) {
      // Phase 0.5 sub-phases to skip
      skipped.push('0.5.1', '0.5.2');
    }

    return skipped;
  }

  private serialize(record: GovernedStreamRecord): SerializedRecord {
    return {
      id: record.id,
      record_type: record.record_type,
      phase_id: record.phase_id,
      sub_phase_id: record.sub_phase_id,
      produced_by_agent_role: record.produced_by_agent_role,
      produced_at: record.produced_at,
      authority_level: record.authority_level,
      quarantined: record.quarantined,
      derived_from_record_ids: record.derived_from_record_ids ?? [],
      content: record.content,
    };
  }

  private rowToRecord(row: Record<string, unknown>): GovernedStreamRecord {
    return {
      id: row.id as string,
      record_type: row.record_type as never,
      schema_version: row.schema_version as string,
      workflow_run_id: row.workflow_run_id as string,
      phase_id: (row.phase_id as string) || null,
      sub_phase_id: (row.sub_phase_id as string) || null,
      produced_by_agent_role: (row.produced_by_agent_role as AgentRole) || null,
      produced_by_record_id: (row.produced_by_record_id as string) || null,
      produced_at: row.produced_at as string,
      effective_at: (row.effective_at as string) || null,
      janumicode_version_sha: row.janumicode_version_sha as string,
      authority_level: row.authority_level as AuthorityLevel,
      derived_from_system_proposal: !!(row.derived_from_system_proposal as number),
      is_current_version: !!(row.is_current_version as number),
      superseded_by_id: (row.superseded_by_id as string) || null,
      superseded_at: (row.superseded_at as string) || null,
      superseded_by_record_id: (row.superseded_by_record_id as string) || null,
      source_workflow_run_id: row.source_workflow_run_id as string,
      derived_from_record_ids: JSON.parse((row.derived_from_record_ids as string) || '[]'),
      quarantined: !!(row.quarantined as number),
      sanitized: !!(row.sanitized as number),
      sanitized_fields: JSON.parse((row.sanitized_fields as string) || '[]'),
      content: JSON.parse(row.content as string),
    };
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'main.js'),
    );
    const nonce = this.generateNonce();

    // Read the JanumiCode design system CSS from the built webview dir.
    // This file is the single source of truth for design tokens (colors,
    // spacing, radii, transitions, typography) — it's copied into dist/
    // by esbuild's copy-design-system-css plugin. We inline its contents
    // rather than linking so Svelte components can reference `var(--jc-*)`
    // immediately without a second HTTP request (and without needing to
    // loosen CSP for an extra stylesheet).
    const designSystemCss = this.readDesignSystemCss();

    getLogger().info('ui', 'Building webview HTML', {
      scriptUri: scriptUri.toString(),
      cspSource: webview.cspSource,
    });

    // Static fallback inside #app: Svelte's mount() will replace it on success.
    // If we still see this content in the webview after load, it means the
    // bundled script either failed to load (404, CSP) or threw before mount().
    // The inline error-capture script forwards any uncaught error to the
    // extension host's output channel via postMessage.
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}' ${webview.cspSource};">
  <title>Governed Stream</title>
  <style>
    /* ── JanumiCode Design System (inlined from design-system.css) ──── */
    ${designSystemCss}

    /* ── Webview-specific base rules (not design tokens) ──────────── */
    html, body { margin: 0; padding: 0; height: 100vh; }
    body {
      font-family: var(--jc-font-body);
      /* Webview base font size. VS Code's default --vscode-font-size is
         13px, which cascades through our em-based components down to
         7–9px on badges and output blocks — unreadably small. Force a
         16px floor; respects larger user settings via max(). */
      font-size: max(16px, var(--vscode-font-size, 16px));
      color: var(--jc-on-surface);
      background: var(--jc-surface);
    }
    #app { height: 100vh; display: flex; flex-direction: column; }
    .boot-fallback {
      padding: 24px 16px;
      text-align: center;
      opacity: 0.75;
    }
    .boot-fallback h2 { margin: 0 0 8px; font-size: 1.05em; font-family: var(--jc-font-headline); }
    .boot-fallback p { margin: 4px 0; font-size: 0.85em; }
    .boot-fallback .hint { margin-top: 16px; opacity: 0.6; font-size: 0.8em; }
  </style>
</head>
<body>
  <div id="app">
    <div class="boot-fallback">
      <h2>JanumiCode v2</h2>
      <p>Loading webview…</p>
      <p class="hint">If this message persists, the bundled UI failed to load. Check the JanumiCode Logs output channel.</p>
    </div>
  </div>
  <script nonce="${nonce}">
    // Capture errors before the bundle loads so even bundle-load failures
    // get reported back to the extension host.
    (function () {
      var vscode = acquireVsCodeApi();
      window.__janumiVscode = vscode;
      function post(type, data) {
        try { vscode.postMessage(Object.assign({ type: type }, data)); } catch (e) { /* nothing we can do */ }
      }
      window.addEventListener('error', function (e) {
        post('webviewError', {
          message: e.message,
          source: e.filename + ':' + e.lineno + ':' + e.colno,
          stack: e.error && e.error.stack ? String(e.error.stack) : undefined,
        });
      });
      window.addEventListener('unhandledrejection', function (e) {
        var reason = e.reason;
        post('webviewError', {
          message: 'unhandledrejection: ' + (reason && reason.message ? reason.message : String(reason)),
          stack: reason && reason.stack ? String(reason.stack) : undefined,
        });
      });
      post('webviewLog', { level: 'info', message: 'inline bootstrap script ran; about to load main.js' });
    })();
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private generateNonce(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * Cached copy of the design system CSS — read once from disk on first
   * call and reused for every subsequent buildHtml(). The file is copied
   * into dist/webview/ by esbuild's copy-design-system-css plugin so it
   * sits next to the bundled main.js at runtime. Falls back to an empty
   * string if the file is missing — the inline body rules below keep the
   * webview functional even when tokens are unavailable.
   */
  private cachedDesignSystemCss: string | null = null;
  private readDesignSystemCss(): string {
    if (this.cachedDesignSystemCss !== null) return this.cachedDesignSystemCss;
    const cssPath = path.join(
      this.extensionUri.fsPath,
      'dist', 'webview', 'design-system.css',
    );
    try {
      this.cachedDesignSystemCss = fs.readFileSync(cssPath, 'utf-8');
    } catch (err) {
      getLogger().warn('ui', 'Failed to read design-system.css — falling back to empty tokens', {
        path: cssPath,
        error: err instanceof Error ? err.message : String(err),
      });
      this.cachedDesignSystemCss = '';
    }
    return this.cachedDesignSystemCss;
  }

  private post(message: Record<string, unknown>): void {
    if (!this.webview) return;
    void this.webview.postMessage(message);
  }
}

/** Default extension-host implementation of the MentionResolver's host adapter. */
export function buildExtensionHost(): MentionExtensionHost {
  return {
    findFiles: async (query: string): Promise<MentionCandidate[]> => {
      try {
        const uris = await vscode.workspace.findFiles(`**/*${query}*`, '**/node_modules/**', 20);
        return uris.map((u) => ({
          type: 'file' as const,
          id: u.fsPath,
          label: path.basename(u.fsPath),
          detail: vscode.workspace.asRelativePath(u),
          uri: u.toString(),
        }));
      } catch {
        return [];
      }
    },
    findSymbols: async (query: string): Promise<MentionCandidate[]> => {
      try {
        const symbols = (await vscode.commands.executeCommand(
          'vscode.executeWorkspaceSymbolProvider',
          query,
        )) as Array<{ name: string; location: { uri: vscode.Uri; range: vscode.Range } }>;
        return (symbols ?? []).slice(0, 10).map((s) => ({
          type: 'symbol' as const,
          id: `${s.location.uri.fsPath}:${s.name}`,
          label: s.name,
          detail: path.basename(s.location.uri.fsPath),
        }));
      } catch {
        return [];
      }
    },
  };
}

// Re-export so the workflow status check works regardless of import path.
export type { WorkflowRunStatus };
