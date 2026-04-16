/**
 * MockLLMProvider — hermetic LLM provider adapter for tests.
 *
 * Used by Layer A (workflowDriver) and Layer C (e2e smoke). Lets tests
 * register fixture responses keyed by a substring of the rendered prompt;
 * the first matching fixture wins. Returns a default empty-success response
 * when no fixture matches so tests don't crash on uncovered prompts.
 *
 * Fixtures can be:
 *   - inline objects via setFixture(matchKey, fixture)
 *   - JSON files under src/test/fixtures/llm/<name>.json loaded via
 *     loadFixturesFromDir()
 *
 * The mock provider responds under BOTH the 'mock' provider name AND any
 * other provider name passed in the LLMCallOptions, so tests don't have to
 * stub out the JANUMICODE_LLM_PROVIDER env var to use it. The phase
 * handlers and the Liaison both call `provider: 'ollama'` directly; the
 * mock just intercepts those calls when registered.
 *
 * Wave 3 Enhancements:
 *   - Context drift detection via prompt_context_payload hash comparison
 *   - Fixture generator for capturing LLM calls as fixtures
 *   - Manifest schema support for fixture validation
 */

import * as crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  ToolCall,
} from '../../lib/llm/llmCaller';
import type { FixtureFile, FixtureManifest } from '../harness/types';

export interface MockFixture {
  /** Substring matched against the rendered prompt. First match wins. */
  match: string;
  /** Plain text response (used when no parsedJson is provided). */
  text?: string;
  /** Parsed JSON object (Phase 1 templates expect responseFormat: 'json'). */
  parsedJson?: Record<string, unknown>;
  /** Thinking/reasoning chain captured from thinking-mode models. */
  thinking?: string;
  /** Tool calls returned by the model (for native tool-calling tests). */
  toolCalls?: ToolCall[];
  /** Synthetic latency in ms (default 0). */
  latencyMs?: number;
  /** --- Wave 3 fields --- */
  /** Fixture key (e.g., "requirements_agent__01_3__01") */
  key?: string;
  /** Agent role that produced this fixture */
  agent_role?: string;
  /** Sub-phase ID */
  sub_phase_id?: string;
  /** Call sequence number (1-indexed) */
  call_sequence?: number;
  /** Prompt template used */
  prompt_template?: string;
  /** Hash of the prompt template for drift detection */
  prompt_template_hash?: string;
  /** Structured context payload for drift detection */
  prompt_context_payload?: Record<string, unknown>;
  /** Hash of the context payload */
  prompt_context_hash?: string;
  /** When this fixture was captured */
  captured_at?: string;
  /** JanumiCode version SHA when captured */
  janumicode_version_sha?: string;
  /** LLM provider used */
  llm_provider?: string;
  /** LLM model used */
  llm_model?: string;
}

export interface ContextDriftResult {
  /** Whether drift was detected */
  drifted: boolean;
  /** Keys of fixtures that drifted */
  driftedKeys: string[];
  /** Keys of fixtures missing context hash */
  missingHash: string[];
  /** Details of drift for each affected fixture */
  details: Array<{
    key: string;
    expectedHash: string;
    actualHash: string;
  fields: string[];
  }>;
}

export class MockLLMProvider implements LLMProviderAdapter {
  /**
   * The provider adapter name. The Liaison registers this provider on its
   * internal PriorityLLMCaller as well, so it answers to both 'mock' and
   * any provider name the call site uses (we just pretend to be that
   * provider in the response).
   */
  readonly name = 'mock';

  private readonly fixtures: MockFixture[] = [];
  private readonly callLog: Array<{
    options: LLMCallOptions;
    matchedFixture: string | null;
    timestamp: number;
    contextHash?: string;
  }> = [];
  private captureMode = false;
  private capturedCalls: Array<{
    options: LLMCallOptions;
    result: LLMCallResult;
    fixture: MockFixture;
  timestamp: number;
  }> = [];

  /** Register an inline fixture. Most recent registration wins on ties. */
  setFixture(matchKey: string, fixture: Omit<MockFixture, 'match'>): void {
    this.fixtures.unshift({ match: matchKey, ...fixture });
  }

  /**
   * Load fixtures from a directory tree. Walks recursively so a phase-
   * organized corpus (`phase_00/`, `phase_01/`, …) works alongside the
   * flat todo-app layout. Per-call probe subdirectories (named after
   * a fixture key like `requirements_agent__2_1__04/`) are skipped —
   * they hold prompt/request/response probe artifacts, not fixtures.
   */
  async loadFixturesFromDir(dir: string): Promise<void> {
    await this.walkForFixtures(dir);
  }

  private async walkForFixtures(dir: string): Promise<void> {
    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Per-call probe directories have a fixture-key name with a `__`
        // sequence separator. Skip them — the matching `.json` next to
        // the directory is the authoritative fixture.
        if (entry.name.includes('__')) continue;
        await this.walkForFixtures(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      if (entry.name === 'manifest.json') continue;
      try {
        const raw = await fs.readFile(full, 'utf-8');
        const fixture = JSON.parse(raw) as MockFixture;
        if (fixture.match) this.fixtures.push(fixture);
      } catch {
        // Malformed or non-fixture JSON — skip silently; the corpus may
        // include other metadata files in the tree.
      }
    }
  }

  /** All recorded calls, in submission order. Useful for assertions. */
  getCallLog(): ReadonlyArray<{
    options: LLMCallOptions;
    matchedFixture: string | null;
    timestamp: number;
  }> {
    return this.callLog;
  }

  /** Reset state between tests. */
  reset(): void {
    this.fixtures.length = 0;
    this.callLog.length = 0;
    this.capturedCalls.length = 0;
    this.captureMode = false;
  }

  // --- Wave 3: Context Drift Detection ---

  /**
   * Compute a hash of the context payload for drift detection.
   */
  hashContextPayload(payload: Record<string, unknown>): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  }

  /**
   * Check for context drift between loaded fixtures and current calls.
   */
  detectContextDrift(): ContextDriftResult {
    const driftedKeys: string[] = [];
    const missingHash: string[] = [];
    const details: Array<{ key: string; expectedHash: string; actualHash: string; fields: string[] }> = [];

    for (const fixture of this.fixtures) {
      if (!fixture.key) continue;

      if (!fixture.prompt_context_hash) {
        missingHash.push(fixture.key);
        continue;
      }

      // Find matching call in log
      const matchingCall = this.callLog.find(log =>
        log.matchedFixture === fixture.match && log.contextHash
      );

      if (matchingCall && matchingCall.contextHash !== fixture.prompt_context_hash) {
        driftedKeys.push(fixture.key);
        details.push({
          key: fixture.key,
          expectedHash: fixture.prompt_context_hash,
          actualHash: matchingCall.contextHash!,
          fields: this.detectDriftedFields(fixture, matchingCall.options),
        });
      }
    }

    return {
      drifted: driftedKeys.length > 0,
      driftedKeys,
      missingHash,
      details,
    };
  }

  private detectDriftedFields(fixture: MockFixture, options: LLMCallOptions): string[] {
    const fields: string[] = [];
    if (fixture.prompt_context_payload) {
      const expected = fixture.prompt_context_payload;
      // Simple heuristic: check if key fields are present in prompt
      for (const key of Object.keys(expected)) {
        if (!options.prompt.includes(String(expected[key]))) {
          fields.push(key);
        }
      }
    }
    return fields;
  }

  // --- Wave 3: Fixture Generator ---

  /**
   * Enable capture mode to record all LLM calls as fixtures.
   */
  enableCapture(): void {
    this.captureMode = true;
    this.capturedCalls.length = 0;
  }

  /**
   * Disable capture mode.
   */
  disableCapture(): void {
    this.captureMode = false;
  }

  /**
   * Get all captured calls.
   */
  getCapturedCalls(): ReadonlyArray<{
    options: LLMCallOptions;
    result: LLMCallResult;
    fixture: MockFixture;
    timestamp: number;
  }> {
    return this.capturedCalls;
  }

  /**
   * Generate a fixture key from call options.
   */
  generateFixtureKey(options: LLMCallOptions, sequence: number): string {
    const role = options.traceContext?.agentRole ?? 'unknown';
    const subPhase = options.traceContext?.subPhaseId ?? '00';
    const normalizedSubPhase = subPhase.replace('.', '_');
    return `${role}__${normalizedSubPhase}__${sequence.toString().padStart(2, '0')}`;
  }

  /**
   * Save captured calls as fixture files plus probe-style inspection
   * artifacts (prompt.txt, request.json, response.json, thinking.txt,
   * parsed.json) in per-call subdirectories.
   *
   * Captures are organized under `phase_NN/` subdirectories keyed off
   * the LLM call's sub_phase_id (so `1.2` → `phase_01`, `10.3` →
   * `phase_10`). Calls without a trace context land at the root. This
   * matches the spec corpus layout and lets a harness run with
   * `--fixture-dir src/test/fixtures/hestami-product-description` pick
   * up fixtures for every phase via the recursive loader.
   *
   * Pre-existing fixtures with the same filename are NOT overwritten —
   * the incremental capture workflow (`--phase-limit N`, rerun per
   * phase) depends on resume-friendly writes so already-captured
   * phases aren't clobbered by later runs.
   */
  async saveCapturedFixtures(
    outputDir: string,
    janumicodeSha: string,
    opts: { overwrite?: boolean } = {},
  ): Promise<string[]> {
    const saved: string[] = [];
    await fs.mkdir(outputDir, { recursive: true });

    // Group by key prefix to handle sequences
    const byKey = new Map<string, Array<{ fixture: MockFixture; result: LLMCallResult; options: LLMCallOptions }>>();
    for (const call of this.capturedCalls) {
      const baseKey = call.fixture.key ?? 'unknown';
      if (!byKey.has(baseKey)) {
        byKey.set(baseKey, []);
      }
      byKey.get(baseKey)!.push({ fixture: call.fixture, result: call.result, options: call.options });
    }

    for (const [baseKey, calls] of byKey) {
      for (let i = 0; i < calls.length; i++) {
        const { fixture, result, options } = calls[i];
        const key = calls.length > 1 ? `${baseKey}_${i + 1}` : baseKey;
        const enrichedFixture: MockFixture = {
          ...fixture,
          key,
          captured_at: new Date().toISOString(),
          janumicode_version_sha: janumicodeSha,
          llm_provider: result.provider,
          llm_model: result.model,
          text: result.text,
          parsedJson: result.parsed ?? undefined,
          thinking: result.thinking,
        };

        const phaseDir = subPhaseToPhaseDir(options.traceContext?.subPhaseId);
        const targetDir = phaseDir ? path.join(outputDir, phaseDir) : outputDir;
        await fs.mkdir(targetDir, { recursive: true });

        // 1. Fixture JSON (for mock-mode replay)
        const filePath = path.join(targetDir, `${key}.json`);
        if (!opts.overwrite && await fileExists(filePath)) {
          // Preserve prior captures — an earlier `--phase-limit 2` run
          // writes phase_01/phase_02 fixtures; a later `--phase-limit 3`
          // re-emits LLM calls for 1-2 as part of the rerun. We keep
          // the first capture to prevent accidental regressions.
          continue;
        }
        await fs.writeFile(filePath, JSON.stringify(enrichedFixture, null, 2), 'utf-8');
        saved.push(filePath);

        // 2. Probe-style inspection artifacts in a subdirectory
        const probeDir = path.join(targetDir, key);
        await fs.mkdir(probeDir, { recursive: true });

        // Full rendered prompt
        await fs.writeFile(
          path.join(probeDir, 'prompt.txt'),
          options.prompt,
          'utf-8',
        );

        // Request body (for manual curl/Postman replay)
        const requestBody = {
          model: options.model,
          provider: options.provider,
          prompt: options.prompt,
          system: options.system ?? null,
          responseFormat: options.responseFormat ?? 'text',
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          traceContext: options.traceContext,
        };
        await fs.writeFile(
          path.join(probeDir, 'request.json'),
          JSON.stringify(requestBody, null, 2),
          'utf-8',
        );

        // Full response with metadata
        await fs.writeFile(
          path.join(probeDir, 'response.json'),
          JSON.stringify({
            text: result.text,
            parsed: result.parsed,
            thinking: result.thinking,
            provider: result.provider,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            usedFallback: result.usedFallback,
            retryAttempts: result.retryAttempts,
          }, null, 2),
          'utf-8',
        );

        // Thinking chain (plain text for easy reading)
        if (result.thinking) {
          await fs.writeFile(
            path.join(probeDir, 'thinking.txt'),
            result.thinking,
            'utf-8',
          );
        }

        // Parsed JSON output
        if (result.parsed) {
          await fs.writeFile(
            path.join(probeDir, 'parsed.json'),
            JSON.stringify(result.parsed, null, 2),
            'utf-8',
          );
        }
      }
    }

    return saved;
  }

  /**
   * Generate a manifest from captured calls.
   */
  generateManifest(janumicodeSha: string, corpusSha: string): FixtureManifest {
    const fixtures: FixtureFile[] = this.capturedCalls.map((call, index) => ({
      key: call.fixture.key ?? `unknown_${index}`,
      agent_role: call.fixture.agent_role ?? call.options.traceContext?.agentRole ?? 'unknown',
      sub_phase_id: call.fixture.sub_phase_id ?? call.options.traceContext?.subPhaseId ?? '0.0',
      call_sequence: call.fixture.call_sequence ?? index + 1,
      prompt_template: call.fixture.prompt_template ?? '',
      prompt_template_hash: call.fixture.prompt_template_hash ?? '',
      prompt_context_payload: call.fixture.prompt_context_payload ?? {},
      response_raw: call.result.text,
      response_parsed: call.result.parsed ?? undefined,
      captured_at: new Date().toISOString(),
      janumicode_version_sha: janumicodeSha,
      llm_provider: call.result.provider,
      llm_model: call.result.model,
    }));

    return {
      version: '1.0',
      janumicode_version_sha: janumicodeSha,
      corpus_sha: corpusSha,
      generated_at: new Date().toISOString(),
      fixtures,
    };
  }

  /**
   * Save a manifest to disk.
   */
  async saveManifest(manifest: FixtureManifest, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * Return a wrapper LLMProviderAdapter with a different `name` that
   * forwards to this mock's call() method (and shares its fixture store).
   * Used by workflowDriver to register the mock under every provider name
   * the engine and Liaison might call (`ollama`, `anthropic`, `google`)
   * without duplicating fixture state.
   */
  bindAsProvider(name: string): LLMProviderAdapter {
    return {
      name,
      call: (options: LLMCallOptions) => this.call({ ...options, provider: name }),
    };
  }

  /**
   * Wrap a real LLMProviderAdapter so every call flows through the real
   * provider but the input/output is captured on this MockLLMProvider's
   * capturedCalls list. Used in `capture` mode to record actual LLM
   * responses for fixture generation.
   *
   * The wrapper preserves the real provider's `name` so the LLMCaller
   * routes to it by the original name (e.g., 'ollama').
   */
  wrapForCapture(realProvider: LLMProviderAdapter): LLMProviderAdapter {
    const mock = this;
    return {
      name: realProvider.name,
      async call(options: LLMCallOptions): Promise<LLMCallResult> {
        const result = await realProvider.call(options);

        // Record the call exactly as enableCapture() does in call().
        const sequence = mock.capturedCalls.length + 1;
        const contextHash = options.prompt
          ? mock.hashContextPayload({ prompt: options.prompt.slice(0, 500) })
          : undefined;
        const capturedFixture: MockFixture = {
          match: options.prompt.slice(0, 100),
          key: mock.generateFixtureKey(options, sequence),
          agent_role: options.traceContext?.agentRole as string | undefined,
          sub_phase_id: options.traceContext?.subPhaseId as string | undefined,
          call_sequence: sequence,
          prompt_context_payload: { prompt: options.prompt.slice(0, 500) },
          prompt_context_hash: contextHash,
          text: result.text,
          parsedJson: result.parsed ?? undefined,
          thinking: result.thinking,
        };
        mock.capturedCalls.push({
          options,
          result,
          fixture: capturedFixture,
          timestamp: Date.now(),
        });

        return result;
      },
    };
  }

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const fixture = this.fixtures.find((f) => options.prompt.includes(f.match));

    // Compute context hash from prompt content (simple heuristic)
    const contextHash = options.prompt
      ? this.hashContextPayload({ prompt: options.prompt.slice(0, 500) })
      : undefined;

    this.callLog.push({
      options,
      matchedFixture: fixture?.match ?? null,
      timestamp: Date.now(),
      contextHash,
    });

    if (fixture?.latencyMs) {
      await new Promise((r) => setTimeout(r, fixture.latencyMs));
    }

    // Per-call context-drift warning: if the fixture has a saved context
    // payload and the rendered prompt's structure has diverged significantly,
    // log a warning so the developer knows the fixture may be stale. Uses
    // Jaccard similarity on payload keys (intersection / union) — a ratio
    // below 0.7 means > 30% of the expected context fields are missing or
    // new fields appeared, suggesting the prompt template changed.
    if (fixture?.prompt_context_payload && options.prompt) {
      const similarity = this.computeJaccardSimilarity(
        fixture.prompt_context_payload,
        options.prompt,
      );
      if (similarity < 0.7) {
        console.warn(
          `[MockLLMProvider] Context drift detected for fixture "${fixture.match}" ` +
          `(Jaccard similarity: ${similarity.toFixed(2)}). The prompt template may have ` +
          `changed since the fixture was captured. Consider re-capturing fixtures.`,
        );
      }
    }

    let result: LLMCallResult;
    if (fixture) {
      result = this.buildResult(options, fixture);
    } else {
      // Default: empty-success response. Phase 1 fallback paths handle empty
      // parsed JSON gracefully so tests don't crash on uncovered prompts.
      result = this.buildEmptyResult(options);
    }

    // Capture mode: record this call
    if (this.captureMode) {
      const sequence = this.capturedCalls.length + 1;
      const capturedFixture: MockFixture = {
        match: fixture?.match ?? options.prompt.slice(0, 100),
        key: this.generateFixtureKey(options, sequence),
        agent_role: options.traceContext?.agentRole as string | undefined,
        sub_phase_id: options.traceContext?.subPhaseId as string | undefined,
        call_sequence: sequence,
        prompt_template: undefined,
        prompt_template_hash: undefined,
        prompt_context_payload: { prompt: options.prompt.slice(0, 500) },
        prompt_context_hash: contextHash,
        text: result.text,
        parsedJson: result.parsed ?? undefined,
      };
      this.capturedCalls.push({
        options,
        result,
        fixture: capturedFixture,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  private buildResult(options: LLMCallOptions, fixture: MockFixture): LLMCallResult {
    const text = fixture.parsedJson
      ? JSON.stringify(fixture.parsedJson)
      : fixture.text ?? '';
    return {
      text,
      parsed: fixture.parsedJson ?? null,
      thinking: fixture.thinking,
      toolCalls: fixture.toolCalls ?? [],
      provider: options.provider, // pretend to be the requested provider
      model: options.model,
      inputTokens: Math.ceil((options.prompt.length + (options.system?.length ?? 0)) / 4),
      outputTokens: Math.ceil(text.length / 4),
      usedFallback: false,
      retryAttempts: 0,
    };
  }

  private buildEmptyResult(options: LLMCallOptions): LLMCallResult {
    // For json mode, return a structurally valid empty object so callers
    // that read parsed.foo don't blow up with "cannot read property of null".
    if (options.responseFormat === 'json') {
      const empty = {};
      return {
        text: '{}',
        parsed: empty,
        toolCalls: [],
        provider: options.provider,
        model: options.model,
        inputTokens: Math.ceil((options.prompt.length + (options.system?.length ?? 0)) / 4),
        outputTokens: 1,
        usedFallback: false,
        retryAttempts: 0,
      };
    }
    return {
      text: '',
      parsed: null,
      toolCalls: [],
      provider: options.provider,
      model: options.model,
      inputTokens: Math.ceil((options.prompt.length + (options.system?.length ?? 0)) / 4),
      outputTokens: 0,
      usedFallback: false,
      retryAttempts: 0,
    };
  }

  /**
   * Compute Jaccard similarity between a fixture's saved context payload
   * and the actual rendered prompt. Extracts "keys" from the payload object
   * and checks how many of them appear as substrings in the prompt text.
   *
   * Returns a ratio between 0 (no overlap) and 1 (all keys present).
   * A value < 0.7 suggests the prompt template has drifted significantly
   * since the fixture was captured.
   */
  private computeJaccardSimilarity(
    savedPayload: Record<string, unknown>,
    prompt: string,
  ): number {
    const keys = Object.keys(savedPayload);
    if (keys.length === 0) return 1.0;

    let matched = 0;
    for (const key of keys) {
      const value = savedPayload[key];
      // Check if the key name OR its stringified value appears in the prompt.
      // This catches both template variable names and their rendered values.
      const valueStr = typeof value === 'string'
        ? value.slice(0, 200)
        : JSON.stringify(value).slice(0, 200);
      if (prompt.includes(key) || prompt.includes(valueStr)) {
        matched++;
      }
    }

    return matched / keys.length;
  }
}

// ── Corpus layout helpers ──────────────────────────────────────────

/**
 * Map a sub-phase id (e.g. '1.2', '10.3', '0.5.1') to its phase-level
 * directory name (`phase_01`, `phase_10`, `phase_00`). Returns null
 * when the sub-phase id is missing — those captures land at the
 * corpus root instead.
 */
function subPhaseToPhaseDir(subPhaseId: string | null | undefined): string | null {
  if (!subPhaseId) return null;
  const head = subPhaseId.split('.')[0];
  const num = Number.parseInt(head, 10);
  if (Number.isNaN(num)) return null;
  return `phase_${String(num).padStart(2, '0')}`;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
