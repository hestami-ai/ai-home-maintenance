/**
 * workflowDriver — Layer A in-process workflow smoke harness.
 *
 * Spins up an in-memory database, OrchestratorEngine, Phase 0/1 handlers,
 * and a ClientLiaisonAgent — the same wiring as `src/extension.ts` minus the
 * VS Code provider — and drives a UserInput end to end. Captures every
 * eventBus event and every record written to the governed_stream into a
 * normalized buffer the test can assert on.
 *
 * The bread-and-butter debug loop. Runs in well under a second per call when
 * paired with MockLLMProvider, so it's the primary tool for iterating on
 * engine instrumentation, phase handlers, and the agent record shapes the
 * webview cards consume.
 *
 * Usage:
 *
 *   const stream = await driveWorkflow({ intent: 'Build a CLI todo app' });
 *   expect(stream.records.find(r => r.record_type === 'agent_invocation')).toBeDefined();
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Database } from '../../lib/database/init';
import { OrchestratorEngine } from '../../lib/orchestrator/orchestratorEngine';
import { ClientLiaisonAgent, makeUserInput } from '../../lib/agents/clientLiaisonAgent';
import type { CapabilityContext } from '../../lib/agents/clientLiaison/capabilities/index';
import type { LiaisonResponse, Reference } from '../../lib/agents/clientLiaison/types';
import type { SerializedRecord, EventType, EventPayload } from '../../lib/events/eventBus';
import type { PhaseId } from '../../lib/types/records';
import { MockLLMProvider } from './mockLLMProvider';
import { createTestEngine } from './createTestEngine';

// ── Public types ────────────────────────────────────────────────────

export interface CapturedEvent<T extends EventType = EventType> {
  type: T;
  payload: EventPayload[T];
  /** Milliseconds since the driver started (monotonic). */
  at: number;
}

export interface CapturedStream {
  /** Every record produced by the workflow run, in produced_at order. */
  records: SerializedRecord[];
  /** Every eventBus event, in firing order. */
  events: CapturedEvent[];
  /** Total wall-clock duration in ms. */
  durationMs: number;
  /** The LiaisonResponse from handleUserInput (the user-visible answer). */
  response: LiaisonResponse;
  /** The workflow run id that was created (or null if no run was started). */
  workflowRunId: string | null;
  /** Direct handles for assertions that need them. Don't reach into these in normal use. */
  engine: OrchestratorEngine;
  liaison: ClientLiaisonAgent;
  db: Database;
  /** Convenience: the mock LLM provider used (so tests can register fixtures). */
  mockLLM: MockLLMProvider;
  /**
   * Tear-down. Always call from the test's `afterEach` or in a try/finally,
   * otherwise the in-memory database leaks across tests and the embedding
   * worker keeps running.
   */
  cleanup(): void;
}

export interface DriveOptions {
  /** The user prompt text. */
  intent: string;
  /** Optional file URIs the user attached. */
  attachments?: string[];
  /** Optional structured @mention references. */
  references?: Reference[];
  /**
   * If true (default), Phase 1 mirrors auto-resolve via the engine's
   * setAutoApproveDecisions() flag. Set false when the test wants to drive
   * decisions manually via the returned `engine.resolveDecision(...)` API.
   */
  autoApprove?: boolean;
  /**
   * Whether to register a real provider adapter for actual LLM calls. Default
   * false — tests use the mock provider with pre-recorded fixtures so they
   * stay hermetic and fast. Set true only for live debugging against Ollama.
   */
  useLiveOllama?: boolean;
  /**
   * Optional fixture overrides for the mock provider, keyed by template name
   * fragment (matched as substring against the rendered prompt). When the
   * mock provider sees a prompt that matches a fixture key, it returns the
   * fixture's pre-built LLMCallResult.
   */
  llmFixtures?: Record<string, MockFixture>;
  /**
   * Extension root path. Defaults to the repo root, where `.janumicode/`
   * lives in tests.
   */
  extensionPath?: string;
  /**
   * Workspace path. Defaults to the same as extensionPath. Override only
   * when testing workspace-specific behavior (e.g. detail-file paths).
   */
  workspacePath?: string;
  /** Optional phase limit for test isolation. */
  phaseLimit?: PhaseId | null;
}

export interface MockFixture {
  /** Substring matched against the rendered prompt. First match wins. */
  match: string;
  /** Plain text response (used when no parsedJson is provided). */
  text?: string;
  /** Parsed JSON object (Phase 1 templates expect responseFormat: 'json'). */
  parsedJson?: Record<string, unknown>;
  /** Tool calls returned by the model (for native tool-calling tests). */
  toolCalls?: Array<{ name: string; params: Record<string, unknown>; id?: string }>;
}

// ── Driver entry point ──────────────────────────────────────────────

export async function driveWorkflow(opts: DriveOptions): Promise<CapturedStream> {
  const startedAt = Date.now();
  // Default workspacePath to an empty temp dir. Using the repo root as the
  // workspace means Phase 0 would treat the entire JanumiCode source tree
  // as brownfield artifacts, flooding the governed stream with hundreds
  // of unrelated source files and breaking Phase 1 test assertions.
  // Tests that want real file content should pass workspacePath explicitly.
  const workspacePath = opts.workspacePath
    ?? fs.mkdtempSync(path.join(os.tmpdir(), 'jc-drive-ws-'));

  // Shared engine bootstrap — same wiring as the CLI runner.
  const te = await createTestEngine({
    extensionPath: opts.extensionPath ?? path.resolve(__dirname, '..', '..', '..'),
    workspacePath,
    autoApprove: opts.autoApprove,
    llmFixtures: opts.llmFixtures,
    useRealProviders: opts.useLiveOllama,
    phaseLimit: opts.phaseLimit,
  });
  const { engine, liaison, db, mockLLM, embedding } = te;

  const previousProvider = process.env.JANUMICODE_LLM_PROVIDER;
  process.env.JANUMICODE_LLM_PROVIDER = opts.useLiveOllama ? 'ollama' : 'mock';

  // 7. Capture buffer — subscribe to every event we care about. Use string
  //    literals so we don't depend on private EventBus internals.
  const events: CapturedEvent[] = [];
  const captured = (type: EventType) => {
    return (payload: EventPayload[typeof type]) => {
      events.push({ type, payload, at: Date.now() - startedAt });
    };
  };

  const recordsBuffer: SerializedRecord[] = [];
  const recordCapture = (p: EventPayload['record:added']) => {
    recordsBuffer.push(p.record);
    events.push({ type: 'record:added', payload: p, at: Date.now() - startedAt });
  };

  const disposers: Array<() => void> = [];
  disposers.push(engine.eventBus.on('record:added', recordCapture));
  for (const eventName of [
    'phase:started',
    'phase:completed',
    'phase_gate:pending',
    'phase_gate:approved',
    'phase_gate:rejected',
    'workflow:started',
    'workflow:completed',
    'workflow:failed',
    'mirror:presented',
    'menu:presented',
    'decision:requested',
    'decision:resolved',
    'inconsistency:escalated',
    'llm:queued',
    'llm:started',
    'llm:finished',
    'context:updated',
    'error:occurred',
  ] as const) {
    disposers.push(engine.eventBus.on(eventName, captured(eventName)));
  }

  // 8. Build the UserInput and capability context, then drive it.
  const userInput = makeUserInput({
    text: opts.intent,
    attachments: (opts.attachments ?? []).map((uri) => ({
      uri,
      name: path.basename(uri),
      type: 'file' as const,
    })),
    references: opts.references,
    inputMode: 'raw_intent',
    workflowRunId: null,
    currentPhaseId: null,
  });

  const ctx: CapabilityContext = {
    workspaceId: 'test-workspace',
    workspaceRoot: workspacePath,
    activeRun: null,
    currentPhase: null,
    currentSubPhase: null,
    runStatus: null,
    orchestrator: engine,
    db: liaison.getDB(),
    eventBus: engine.eventBus,
    embedding,
  };

  let response: LiaisonResponse;
  try {
    response = await liaison.handleUserInput(userInput, ctx);
  } catch (err) {
    // Make the cleanup deterministic even on failure.
    for (const off of disposers) off();
    if (previousProvider !== undefined) process.env.JANUMICODE_LLM_PROVIDER = previousProvider;
    else delete process.env.JANUMICODE_LLM_PROVIDER;
    db.close();
    throw err;
  }

  // 9. Drain any in-flight async work (Phase 1 fire-and-forget executeCurrentPhase).
  //    Wait until either the workflow_run hits a terminal state or we time out.
  const newRun = liaison.getDB().getCurrentWorkflowRun();
  const workflowRunId = newRun?.id ?? null;

  if (workflowRunId) {
    await waitForQuiescence(engine, workflowRunId, 5000);
  }

  // 10. Sort the captured records by produced_at so consumers see them in
  //     deterministic order. The eventBus fires in write-order which is
  //     usually the same, but Phase 1's parallel decision awaits can race.
  recordsBuffer.sort((a, b) => a.produced_at.localeCompare(b.produced_at));

  const durationMs = Date.now() - startedAt;

  return {
    records: recordsBuffer,
    events,
    durationMs,
    response,
    workflowRunId,
    engine,
    liaison,
    db,
    mockLLM,
    cleanup() {
      for (const off of disposers) off();
      if (previousProvider !== undefined) process.env.JANUMICODE_LLM_PROVIDER = previousProvider;
      else delete process.env.JANUMICODE_LLM_PROVIDER;
      te.cleanup();
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Wait until the workflow run reaches a quiescent state — either it's
 * paused awaiting a decision (which auto-approve has already resolved by
 * this point), or it's reached a terminal status, or the deadline expires.
 *
 * In the auto-approve test mode this should resolve in a few microtasks
 * because every pauseForDecision returns synthetically and immediately.
 */
async function waitForQuiescence(
  engine: OrchestratorEngine,
  runId: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let stableIdlePolls = 0;
  while (Date.now() < deadline) {
    const run = engine.stateMachine.getWorkflowRun(runId);
    if (!run) return;
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'rolled_back') {
      return;
    }

    // Treat the run as quiescent only after several consecutive idle polls.
    // A single matching sub-phase is too weak because auto-approved decisions
    // can resume the workflow on the next microtask and race test cleanup.
    const isIdle =
      Boolean(run.current_sub_phase_id) &&
      !engine['pendingDecisions'].size &&
      engine.llmCaller.inFlightCount === 0;

    if (isIdle) {
      stableIdlePolls++;
      if (stableIdlePolls >= 5) return;
    } else {
      stableIdlePolls = 0;
    }

    await new Promise((r) => setTimeout(r, 20));
  }
}

/**
 * Convenience: filter a captured stream by record_type.
 */
export function recordsOfType(
  stream: CapturedStream,
  type: string | string[],
): SerializedRecord[] {
  const types = Array.isArray(type) ? new Set(type) : new Set([type]);
  return stream.records.filter((r) => types.has(r.record_type));
}

/**
 * Convenience: pretty-print a captured stream for debug logging in tests.
 */
export function formatStream(stream: CapturedStream): string {
  const lines: string[] = [
    `=== Captured workflow stream (${stream.records.length} records, ${stream.events.length} events, ${stream.durationMs}ms) ===`,
  ];
  for (const r of stream.records) {
    const phase = r.phase_id ? `P${r.phase_id}` : '-';
    const sub = r.sub_phase_id ? `.${r.sub_phase_id}` : '';
    const role = r.produced_by_agent_role ?? 'system';
    const preview = JSON.stringify(r.content).slice(0, 80);
    lines.push(`  [${phase}${sub} ${role}] ${r.record_type} :: ${preview}`);
  }
  return lines.join('\n');
}
