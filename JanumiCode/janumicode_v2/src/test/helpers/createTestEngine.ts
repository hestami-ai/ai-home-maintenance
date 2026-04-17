/**
 * createTestEngine — shared engine bootstrap factory used by BOTH:
 *   - workflowDriver.ts (vitest inner-loop tests)
 *   - src/cli/runner.ts (CLI headless pipeline runner)
 *
 * Eliminates the duplicated bootstrap code and ensures both systems
 * register the same phases, wire the same providers, and produce
 * identical governed-stream behavior.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, initializeDatabase, type Database } from '../../lib/database/init';
import { ConfigManager } from '../../lib/config/configManager';
import { OrchestratorEngine } from '../../lib/orchestrator/orchestratorEngine';
import { Phase0Handler } from '../../lib/orchestrator/phases/phase0';
import { Phase1Handler } from '../../lib/orchestrator/phases/phase1';
import { Phase2Handler } from '../../lib/orchestrator/phases/phase2';
import { Phase3Handler } from '../../lib/orchestrator/phases/phase3';
import { Phase4Handler } from '../../lib/orchestrator/phases/phase4';
import { Phase5Handler } from '../../lib/orchestrator/phases/phase5';
import { Phase6Handler } from '../../lib/orchestrator/phases/phase6';
import { Phase7Handler } from '../../lib/orchestrator/phases/phase7';
import { Phase8Handler } from '../../lib/orchestrator/phases/phase8';
import { Phase9Handler } from '../../lib/orchestrator/phases/phase9';
import { Phase10Handler } from '../../lib/orchestrator/phases/phase10';
import { EmbeddingService } from '../../lib/embedding/embeddingService';
import { ClientLiaisonAgent } from '../../lib/agents/clientLiaisonAgent';
import type { LLMProviderAdapter } from '../../lib/llm/llmCaller';
import { MockLLMProvider, type MockFixture } from './mockLLMProvider';
import type { PhaseId } from '../../lib/types/records';

// ── Public types ────────────────────────────────────────────────────

export interface TestEngineOptions {
  /**
   * Database path. Use ':memory:' (default) for vitest, or a file path
   * for CLI isolated runs that need post-mortem inspection.
   */
  dbPath?: string;
  /**
   * Extension root — where `.janumicode/schemas/`, `.janumicode/prompts/`,
   * and `.janumicode/schemas/invariants/` live. Defaults to the repo root.
   */
  extensionPath?: string;
  /**
   * Workspace path — where detail files and the governed_stream DB go.
   * Defaults to the same as extensionPath.
   */
  workspacePath?: string;
  /**
   * Auto-approve all human-in-loop decisions (mirrors, menus, phase gates).
   * Default: true. Set false when the test wants to drive decisions manually.
   */
  autoApprove?: boolean;
  /**
   * Inline MockLLMProvider fixtures keyed by a substring of the rendered
   * prompt. These are registered on the mock immediately.
   */
  llmFixtures?: Record<string, Omit<MockFixture, 'match'>>;
  /**
   * Directory containing JSON fixture files for the mock provider. Loaded
   * asynchronously before returning. Used by the CLI's `--fixture-dir` flag.
   */
  fixtureDir?: string;
  /**
   * LLM mode:
   *   - 'mock' (default): all providers route to MockLLMProvider
   *   - 'real': register real Ollama/Anthropic/Google providers (requires
   *     running LLM backends). Mock is still available under the 'mock' name.
   *   - 'capture': same as 'real' but wraps providers so every call is
   *     recorded by MockLLMProvider's capture mode for fixture generation.
   */
  llmMode?: 'mock' | 'real' | 'capture';
  /**
   * @deprecated Use llmMode: 'real' instead.
   */
  useRealProviders?: boolean;
  /** Optional phase limit for test isolation. */
  phaseLimit?: PhaseId | null;
  /**
   * Override `llm_routing.orchestrator` to steer Phase 1.0's Intent
   * Quality Check (and any future orchestrator-role LLM work) to a
   * specific backing. Defaults vary by mode:
   *
   *   - mock   → `{ backing_tool: 'direct_llm_api', provider: 'ollama',
   *                 model: 'qwen3.5:9b' }` so the call routes through
   *                 MockLLMProvider like every other role.
   *   - real   → production default (gemini_cli).
   *   - custom → pass explicit config; test harness real-mode sets
   *              `{ backing_tool: 'claude_code_cli', model: 'qwen3.5:9b' }`
   *              to exercise the CLI path with a router proxy.
   *
   * When set to a CLI backing, createTestEngine automatically calls
   * `engine.registerBuiltinCLIParsers()` so `validateLLMRouting()`
   * passes.
   */
  orchestratorRouting?: {
    backing_tool: string;
    provider?: string;
    model?: string;
    temperature?: number;
  };
}

export interface TestEngine {
  engine: OrchestratorEngine;
  liaison: ClientLiaisonAgent;
  db: Database;
  mockLLM: MockLLMProvider;
  embedding: EmbeddingService;
  /** Tear down: close DB, stop embedding. Always call in a finally block. */
  cleanup(): void;
}

// ── Factory ─────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

export async function createTestEngine(
  opts: TestEngineOptions = {},
): Promise<TestEngine> {
  const extensionPath = opts.extensionPath ?? REPO_ROOT;
  // Default to an empty temp workspace — Phase 0 scans the workspace for
  // artifact ingestion, and defaulting to REPO_ROOT would pull the entire
  // JanumiCode codebase into each test's governed stream. Tests that want
  // the real workspace (e.g. harness) pass `workspacePath` explicitly.
  const workspacePath = opts.workspacePath
    ?? fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));

  // 1. Database
  const db =
    !opts.dbPath || opts.dbPath === ':memory:'
      ? createTestDatabase()
      : initializeDatabase({ path: opts.dbPath, extensionPath });

  // 2. Config
  const configManager = new ConfigManager(workspacePath);

  // 2b. Orchestrator routing override. Production default is
  // `gemini_cli` which isn't appropriate for most tests — mock mode
  // needs a direct_llm_api backing so the MockLLMProvider intercepts
  // the call, and real-mode harnesses steer to a specific CLI via
  // opts.orchestratorRouting. When the routing is a CLI backing, we
  // register the builtin parsers so validateLLMRouting passes.
  const effectiveModeForRouting = opts.llmMode
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ?? (opts.useRealProviders ? 'real' : 'mock');
  const orchestratorRouting = opts.orchestratorRouting ?? (
    effectiveModeForRouting === 'mock'
      ? { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' }
      : undefined
  );

  // 3. Engine
  const engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
  if (orchestratorRouting) {
    configManager.setOrchestratorRouting({
      primary: {
        backing_tool: orchestratorRouting.backing_tool,
        provider: orchestratorRouting.provider,
        model: orchestratorRouting.model,
      },
      temperature: orchestratorRouting.temperature,
    });
  }
  if (orchestratorRouting && orchestratorRouting.backing_tool !== 'direct_llm_api') {
    // CLI backing — register the builtin parsers so validateLLMRouting
    // finds the one the orchestrator is configured to use. Mock mode
    // stays quiet (no parsers) so Phase 9 still fast-fails without
    // trying to spawn a real CLI subprocess.
    engine.registerBuiltinCLIParsers();
  }
  if (opts.autoApprove !== false) {
    engine.setAutoApproveDecisions(true);
  }
  if (opts.phaseLimit !== undefined) {
    engine.setPhaseLimit(opts.phaseLimit);
  }

  // 4. Register phase handlers
  engine.registerPhase(new Phase0Handler());
  engine.registerPhase(new Phase1Handler());
  engine.registerPhase(new Phase2Handler());
  engine.registerPhase(new Phase3Handler());
  engine.registerPhase(new Phase4Handler());
  engine.registerPhase(new Phase5Handler());
  engine.registerPhase(new Phase6Handler());
  engine.registerPhase(new Phase7Handler());
  engine.registerPhase(new Phase8Handler());
  engine.registerPhase(new Phase9Handler());
  engine.registerPhase(new Phase10Handler());

  // 5. Embedding (created but NOT started — tests don't need background embedding)
  const embedding = new EmbeddingService(db, {
    provider: 'ollama',
    model: 'qwen3-embedding:8b',
    maxParallel: 1,
  });

  // 6. LLM provider setup — mode-dependent.
  const mockLLM = new MockLLMProvider();
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const effectiveMode = opts.llmMode ?? (opts.useRealProviders ? 'real' : 'mock');

  // Only attach the embedding service to the engine (and therefore to DMR's
  // vector-similarity path) when the test mode uses real LLM providers.
  // Tests using mock LLMs won't have Ollama running and the embedding fetch
  // hangs on connect. DMR degrades gracefully without semantic similarity —
  // it still uses FTS5 and authority-weighted harvest.
  if (effectiveMode !== 'mock') {
    engine.setEmbeddingService(embedding);
  }

  // Register inline fixtures (useful in all modes for fallback)
  if (opts.llmFixtures) {
    for (const [key, fixture] of Object.entries(opts.llmFixtures)) {
      mockLLM.setFixture(key, fixture);
    }
  }

  // Load directory fixtures (useful in all modes for fallback)
  if (opts.fixtureDir) {
    await mockLLM.loadFixturesFromDir(opts.fixtureDir);
  }

  if (effectiveMode === 'mock') {
    // Mock mode: every provider name routes to the fixture store.
    engine.llmCaller.registerProvider(mockLLM);
    engine.llmCaller.registerProvider(mockLLM.bindAsProvider('ollama'));
    engine.llmCaller.registerProvider(mockLLM.bindAsProvider('anthropic'));
    engine.llmCaller.registerProvider(mockLLM.bindAsProvider('google'));
  } else {
    // Real or capture mode: register actual providers.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OllamaProvider } = require('../../lib/llm/providers/ollama');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AnthropicProvider } = require('../../lib/llm/providers/anthropic');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleProvider } = require('../../lib/llm/providers/google');

    const ollama = new OllamaProvider();
    const anthropic = new AnthropicProvider();
    const google = new GoogleProvider();

    if (effectiveMode === 'capture') {
      // Capture mode: wrap each real provider so every call is intercepted
      // and recorded by MockLLMProvider for fixture generation. The wrapper
      // preserves the provider name so routing is unchanged.
      mockLLM.enableCapture();
      engine.llmCaller.registerProvider(mockLLM.wrapForCapture(ollama));
      engine.llmCaller.registerProvider(mockLLM.wrapForCapture(anthropic));
      engine.llmCaller.registerProvider(mockLLM.wrapForCapture(google));
    } else {
      // Pure real mode: register providers directly.
      engine.llmCaller.registerProvider(ollama);
      engine.llmCaller.registerProvider(anthropic);
      engine.llmCaller.registerProvider(google);
    }
    // Keep mock available as a fallback provider name
    engine.llmCaller.registerProvider(mockLLM);
  }

  // 7. ClientLiaisonAgent — provider config matches the mode so Phase
  //    handlers and the Liaison's classifier/synthesizer route correctly.
  const liaisonProvider = effectiveMode === 'mock' ? 'mock' : 'ollama';
  const liaisonModel = effectiveMode === 'mock' ? 'mock-model' : (process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b');

  const liaison = new ClientLiaisonAgent(
    db,
    engine,
    {
      provider: liaisonProvider,
      model: liaisonModel,
      embeddingService: embedding,
    },
    null, // no extension host adapter in test/CLI mode
  );

  // Register providers on the Liaison's internal PriorityLLMCaller too.
  if (effectiveMode === 'mock') {
    liaison.registerProviders(mockLLM as unknown as LLMProviderAdapter);
    liaison.registerProviders(mockLLM.bindAsProvider('ollama') as unknown as LLMProviderAdapter);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OllamaProvider: OllamaP } = require('../../lib/llm/providers/ollama');
    const ollamaForLiaison = new OllamaP();
    if (effectiveMode === 'capture') {
      liaison.registerProviders(mockLLM.wrapForCapture(ollamaForLiaison) as unknown as LLMProviderAdapter);
    } else {
      liaison.registerProviders(ollamaForLiaison as unknown as LLMProviderAdapter);
    }
    liaison.registerProviders(mockLLM as unknown as LLMProviderAdapter); // fallback
  }
  liaison.setEventBus(engine.eventBus);

  // Verify that every provider referenced in llm_routing config is actually
  // registered. If not, engine.validateLLMRouting() throws with a clear
  // remediation message. This ensures correctness-validation roles
  // (Reasoning Review, Domain Compliance) can never silently skip due to
  // a misconfigured provider name.
  engine.validateLLMRouting();

  return {
    engine,
    liaison,
    db,
    mockLLM,
    embedding,
    cleanup() {
      try { db.close(); } catch { /* ignore */ }
    },
  };
}
