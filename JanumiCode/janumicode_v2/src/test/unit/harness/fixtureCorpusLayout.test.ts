/**
 * Regression tests for the phase-organized corpus layout.
 *
 * The spec requires fixtures to be grouped under `phase_NN/` directories
 * so an incremental capture workflow (`--phase-limit N` iterated for N
 * in [1,9]) produces one canonical corpus directory tree. The old
 * loader was flat-only and the old saver dumped every file at the
 * output-dir root, which meant captures from different phases
 * overwrote each other by key-collision on sequence-only keys.
 *
 * These tests pin:
 *   1. Recursive loading — fixtures under `phase_01/`, `phase_05/`, …
 *      all resolve via the top-level corpus dir.
 *   2. Flat layout still works (legacy todo-app corpus unchanged).
 *   3. Per-call probe subdirectories are not mistakenly re-loaded as
 *      fixtures (they carry filenames with `__` that would otherwise
 *      recurse).
 *   4. `saveCapturedFixtures` writes captures into `phase_NN/` keyed off
 *      the call's sub_phase_id.
 *   5. By default, existing fixture files are NOT overwritten — a
 *      later `--phase-limit 3` run must not clobber fixtures captured
 *      during an earlier `--phase-limit 2` run.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';
import type { LLMCallOptions, LLMCallResult } from '../../../lib/llm/llmCaller';

describe('MockLLMProvider — phase-organized fixture corpus', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-fixture-'));
  });

  afterEach(() => {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  function writeFixture(rel: string, match: string, extras: Record<string, unknown> = {}): void {
    const full = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify({ match, text: 'hello', ...extras }), 'utf-8');
  }

  describe('loadFixturesFromDir', () => {
    it('loads fixtures from phase_NN/ subdirectories', async () => {
      writeFixture('phase_00/workspace_scan.json', 'Workspace Scan');
      writeFixture('phase_01/bloom.json', 'Intent Domain Bloom');
      writeFixture('phase_05/data_models.json', 'Data Models');

      const provider = new MockLLMProvider();
      await provider.loadFixturesFromDir(tmp);

      const fixtures = (provider as unknown as { fixtures: Array<{ match: string }> }).fixtures;
      const matches = fixtures.map((f) => f.match).sort();
      expect(matches).toEqual(['Data Models', 'Intent Domain Bloom', 'Workspace Scan']);
    });

    it('still loads fixtures from a flat layout (legacy todo-app corpus)', async () => {
      writeFixture('intent_bloom.json', 'Intent Domain Bloom');
      writeFixture('intent_synthesis.json', 'Intent Statement Synthesis');

      const provider = new MockLLMProvider();
      await provider.loadFixturesFromDir(tmp);

      const fixtures = (provider as unknown as { fixtures: Array<{ match: string }> }).fixtures;
      expect(fixtures).toHaveLength(2);
    });

    it('skips per-call probe directories (filenames with __)', async () => {
      // Flat fixture next to its probe directory — the probe dir name
      // has `__` (v1 `role__subphase__seq` key). Loader must walk the
      // fixture JSON but skip the probe subdirectory entirely.
      writeFixture('requirements_agent__2_1__01.json', 'Functional Requirements');
      fs.mkdirSync(path.join(tmp, 'requirements_agent__2_1__01'), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, 'requirements_agent__2_1__01', 'response.json'),
        JSON.stringify({ text: 'probe dump — not a fixture' }),
        'utf-8',
      );

      const provider = new MockLLMProvider();
      await provider.loadFixturesFromDir(tmp);

      const fixtures = (provider as unknown as { fixtures: Array<{ match: string }> }).fixtures;
      // Exactly one fixture — the probe dump should NOT have been
      // loaded as a fixture even though it's a .json file.
      expect(fixtures).toHaveLength(1);
      expect(fixtures[0].match).toBe('Functional Requirements');
    });

    it('ignores manifest.json at the corpus root', async () => {
      writeFixture('phase_01/bloom.json', 'Intent Domain Bloom');
      fs.writeFileSync(
        path.join(tmp, 'manifest.json'),
        JSON.stringify({ version: '1.0', fixtures: [] }),
        'utf-8',
      );

      const provider = new MockLLMProvider();
      await provider.loadFixturesFromDir(tmp);

      const fixtures = (provider as unknown as { fixtures: Array<{ match: string }> }).fixtures;
      expect(fixtures).toHaveLength(1);
    });
  });

  describe('saveCapturedFixtures — phase-organized output', () => {
    function seedCapture(
      provider: MockLLMProvider,
      key: string,
      subPhaseId: string,
      match = 'Test Template',
    ): void {
      const options: LLMCallOptions = {
        provider: 'ollama',
        model: 'qwen3.5:9b',
        prompt: 'test prompt',
        traceContext: {
          workflowRunId: 'run-1',
          phaseId: subPhaseId.split('.')[0],
          subPhaseId,
          agentRole: 'orchestrator',
          label: 'test',
        },
      };
      const result: LLMCallResult = {
        text: 'captured output',
        parsed: null,
        toolCalls: [],
        provider: 'ollama',
        model: 'qwen3.5:9b',
        inputTokens: 1,
        outputTokens: 2,
        usedFallback: false,
        retryAttempts: 0,
      };
      // Push into internal array so saveCapturedFixtures sees it.
      (provider as unknown as {
        capturedCalls: Array<{ options: LLMCallOptions; result: LLMCallResult; fixture: { match: string; key: string }; timestamp: number }>;
      }).capturedCalls.push({
        options,
        result,
        fixture: { match, key },
        timestamp: Date.now(),
      });
    }

    it('routes captures to phase_NN/ based on sub_phase_id', async () => {
      const provider = new MockLLMProvider();
      seedCapture(provider, 'orchestrator__1_0__01', '1.0');
      seedCapture(provider, 'requirements_agent__2_1__01', '2.1');
      seedCapture(provider, 'executor_agent__9_1__01', '9.1');

      const saved = await provider.saveCapturedFixtures(tmp, 'dev');
      const paths = saved.map((p) => path.relative(tmp, p).replace(/\\/g, '/'));
      expect(paths).toContain('phase_01/orchestrator__1_0__01.json');
      expect(paths).toContain('phase_02/requirements_agent__2_1__01.json');
      expect(paths).toContain('phase_09/executor_agent__9_1__01.json');
    });

    it('lands Phase 10 captures in phase_10 (zero-padded)', async () => {
      const provider = new MockLLMProvider();
      seedCapture(provider, 'orchestrator__10_3__01', '10.3');
      const saved = await provider.saveCapturedFixtures(tmp, 'dev');
      expect(saved.map((p) => path.relative(tmp, p).replace(/\\/g, '/')))
        .toContain('phase_10/orchestrator__10_3__01.json');
    });

    it('does NOT overwrite an existing fixture by default', async () => {
      const provider = new MockLLMProvider();
      // Seed a pre-existing fixture that a prior run would have written.
      const preexisting = path.join(tmp, 'phase_01', 'orchestrator__1_0__01.json');
      fs.mkdirSync(path.dirname(preexisting), { recursive: true });
      fs.writeFileSync(preexisting, JSON.stringify({ match: 'Preserved', text: 'old' }), 'utf-8');

      seedCapture(provider, 'orchestrator__1_0__01', '1.0');
      const saved = await provider.saveCapturedFixtures(tmp, 'dev');

      // The path was not overwritten → not in the saved list.
      expect(saved).not.toContain(preexisting);
      const contents = JSON.parse(fs.readFileSync(preexisting, 'utf-8')) as { match: string };
      expect(contents.match).toBe('Preserved');
    });

    it('overwrites when opts.overwrite = true (fresh-capture mode)', async () => {
      const provider = new MockLLMProvider();
      const preexisting = path.join(tmp, 'phase_01', 'orchestrator__1_0__01.json');
      fs.mkdirSync(path.dirname(preexisting), { recursive: true });
      fs.writeFileSync(preexisting, JSON.stringify({ match: 'Old', text: 'old' }), 'utf-8');

      seedCapture(provider, 'orchestrator__1_0__01', '1.0', 'New');
      const saved = await provider.saveCapturedFixtures(tmp, 'dev', { overwrite: true });

      expect(saved).toContain(preexisting);
      const contents = JSON.parse(fs.readFileSync(preexisting, 'utf-8')) as { match: string };
      expect(contents.match).toBe('New');
    });
  });
});
