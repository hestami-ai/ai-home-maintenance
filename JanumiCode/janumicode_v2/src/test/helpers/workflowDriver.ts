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

import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../lib/database/init';
import { ConfigManager } from '../../lib/config/configManager';
import { OrchestratorEngine } from '../../lib/orchestrator/orchestratorEngine';
import { Phase0Handler } from '../../lib/orchestrator/phases/phase0';
import { Phase1Handler } from '../../lib/orchestrator/phases/phase1';
import { EmbeddingService } from '../../lib/embedding/embeddingService';
import { ClientLiaisonAgent, makeUserInput } from '../../lib/agents/clientLiaisonAgent';
import type { CapabilityContext } from '../../lib/agents/clientLiaison/capabilities/index';
import type { LiaisonResponse, Reference } from '../../lib/agents/clientLiaison/types';
import type { SerializedRecord, EventType, EventPayload } from '../../lib/events/eventBus';
import type { LLMProviderAdapter } from '../../lib/llm/llmCaller';
import { MockLLMProvider } from './mockLLMProvider';

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
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const extensionPath = opts.extensionPath ?? repoRoot;
  const workspacePath = opts.workspacePath ?? extensionPath;

  // 1. In-memory database.
  const db = createTestDatabase();

  // 2. ConfigManager — defaults are fine for tests.
  const configManager = new ConfigManager();

  // 3. Engine. Auto-approve is default-on so tests don't deadlock on mirrors.
  const engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
  if (opts.autoApprove !== false) {
    engine.setAutoApproveDecisions(true);
  }
  engine.registerPhase(new Phase0Handler());
  engine.registerPhase(new Phase1Handler());

  // 4. Embedding service — instantiated for completeness so the writer's
  //    embedding hook doesn't error, but never started so it doesn't try to
  //    talk to a real Ollama. Tests don't depend on vector search.
  const embedding = new EmbeddingService(db, {
    provider: 'ollama',
    model: 'qwen3-embedding:8b',
    maxParallel: 1,
  });
  // NOTE: deliberately NOT calling embedding.start() — we don't want the
  // worker queue running in test mode.

  // 5. Mock LLM provider. Registered under every provider name the engine
  //    and Liaison might use (ollama, anthropic, google, mock) so we don't
  //    have to stub out the call sites' provider strings. All wrappers share
  //    the same fixture store via mockLLM.bindAsProvider(name).
  const mockLLM = new MockLLMProvider();
  if (opts.llmFixtures) {
    for (const [key, fixture] of Object.entries(opts.llmFixtures)) {
      mockLLM.setFixture(key, fixture);
    }
  }

  if (opts.useLiveOllama) {
    // Lazy-import so tests that don't need it don't pay the cost.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OllamaProvider } = require('../../lib/llm/providers/ollama');
    engine.llmCaller.registerProvider(new OllamaProvider());
  } else {
    // Mock everything: every provider name routes to the same fixture store.
    engine.llmCaller.registerProvider(mockLLM);
    engine.llmCaller.registerProvider(mockLLM.bindAsProvider('ollama'));
    engine.llmCaller.registerProvider(mockLLM.bindAsProvider('anthropic'));
    engine.llmCaller.registerProvider(mockLLM.bindAsProvider('google'));
  }

  const previousProvider = process.env.JANUMICODE_LLM_PROVIDER;
  process.env.JANUMICODE_LLM_PROVIDER = opts.useLiveOllama ? 'ollama' : 'mock';

  // 6. ClientLiaisonAgent (universal router).
  const liaison = new ClientLiaisonAgent(
    db,
    engine,
    {
      provider: opts.useLiveOllama ? 'ollama' : 'mock',
      model: opts.useLiveOllama ? 'qwen3.5:9b' : 'mock-model',
      embeddingService: embedding,
    },
    null, // no extension host adapter in tests
  );
  // The Liaison's internal PriorityLLMCaller is a separate instance — register
  // the same mock provider on it so its classifier/synthesizer route correctly.
  liaison.registerProviders(mockLLM as unknown as LLMProviderAdapter);
  liaison.setEventBus(engine.eventBus);

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
      try { db.close(); } catch { /* ignore */ }
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
  while (Date.now() < deadline) {
    const run = engine.stateMachine.getWorkflowRun(runId);
    if (!run) return;
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'rolled_back') {
      return;
    }
    // If the engine has no pending decisions and is sitting on a phase gate
    // (the typical Phase 1 terminal state with auto-approve), we're done.
    if (run.current_sub_phase_id && !engine['pendingDecisions'].size) {
      // Give one more microtask tick for any in-flight then-callbacks.
      await new Promise((r) => setTimeout(r, 5));
      const after = engine.stateMachine.getWorkflowRun(runId);
      if (after && after.current_sub_phase_id === run.current_sub_phase_id) return;
    }
    await new Promise((r) => setTimeout(r, 10));
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
