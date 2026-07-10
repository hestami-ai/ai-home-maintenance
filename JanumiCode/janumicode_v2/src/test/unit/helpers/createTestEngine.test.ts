/**
 * Characterization tests for createTestEngine — pins the observable
 * mock-mode contract of the shared engine bootstrap factory so the
 * S3776 decomposition of the factory is provably behavior-preserving.
 *
 * Scope: mock mode only (the path unit tests exercise). Real/capture
 * modes require live LLM backends and are intentionally out of scope.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestEngine, type TestEngine } from '../../helpers/createTestEngine';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { ClientLiaisonAgent } from '../../../lib/agents/clientLiaisonAgent';

describe('createTestEngine — mock-mode contract (characterization)', () => {
  let te: TestEngine | undefined;
  let workspace: string | undefined;

  afterEach(() => {
    te?.cleanup();
    te = undefined;
    if (workspace) {
      fs.rmSync(workspace, { recursive: true, force: true });
      workspace = undefined;
    }
  });

  function makeWorkspace(): string {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cte-char-'));
    return workspace;
  }

  it('returns all five handles plus a cleanup fn in default (mock) mode', async () => {
    te = await createTestEngine({ workspacePath: makeWorkspace() });

    expect(te.engine).toBeInstanceOf(OrchestratorEngine);
    expect(te.liaison).toBeInstanceOf(ClientLiaisonAgent);
    expect(te.mockLLM).toBeInstanceOf(MockLLMProvider);
    expect(te.embedding).toBeDefined();
    expect(te.db).toBeDefined();
    expect(typeof te.cleanup).toBe('function');
  });

  it('opens a usable in-memory database by default', async () => {
    te = await createTestEngine({ workspacePath: makeWorkspace() });
    const row = te.db.prepare('SELECT 1 AS x').get() as { x: number };
    expect(row.x).toBe(1);
  });

  it('registers mock providers so validateLLMRouting stays satisfied', async () => {
    te = await createTestEngine({ workspacePath: makeWorkspace() });
    // createTestEngine already ran validateLLMRouting() during construction
    // (it throws on a missing provider); re-invoking must remain a no-op
    // because every routed provider name is bound to the mock.
    expect(() => te!.engine.validateLLMRouting()).not.toThrow();
  });

  it('registers inline llmFixtures on the mock provider', async () => {
    te = await createTestEngine({
      workspacePath: makeWorkspace(),
      llmFixtures: { 'PING-MARKER': { text: 'PONG-RESPONSE' } },
    });

    const result = await te.mockLLM.call({
      provider: 'ollama',
      model: 'any-model',
      prompt: 'a prompt containing PING-MARKER somewhere',
    });

    expect(result.text).toBe('PONG-RESPONSE');
    // The mock pretends to be the requested provider.
    expect(result.provider).toBe('ollama');
  });

  it('returns an empty-success response when no fixture matches', async () => {
    te = await createTestEngine({ workspacePath: makeWorkspace() });
    const result = await te.mockLLM.call({
      provider: 'ollama',
      model: 'any-model',
      prompt: 'nothing here matches any registered fixture',
    });
    expect(result.text).toBe('');
    expect(result.parsed).toBeNull();
  });

  it('cleanup is best-effort and safe to call more than once', async () => {
    // Uses a local handle so afterEach does not double-invoke cleanup.
    const localTe = await createTestEngine({ workspacePath: makeWorkspace() });
    expect(() => {
      localTe.cleanup();
      localTe.cleanup();
    }).not.toThrow();
  });
});
