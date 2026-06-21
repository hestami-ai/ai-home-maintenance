import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mergeExecutorConfig, prepareConfigWorkspace, seedGooseConfig } from '../../../../../scripts/model-bakeoff/corpusPrep';
import type { CandidateSpec } from '../../../../../scripts/model-bakeoff/bakeoffConfig';

const CANDIDATE: CandidateSpec = {
  slug: 'gemma4-12b-test',
  modelTag: 'gemma4:12b-it-qat',
  server: {},
};

const REFERENCE_CONFIG = {
  decomposition: { budget_cap: 5000 },
  execution: { leaf_retry_budget: 2 },
  llm_routing: {
    domain_interpreter: { primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'gpt-oss:20b' } },
    executor: { primary: { backing_tool: 'goose_cli', model: 'gpt-oss:20b' }, temperature: 1 },
  },
};

describe('mergeExecutorConfig', () => {
  it('points the executor at the candidate model, keeps everything else', () => {
    const merged = mergeExecutorConfig(structuredClone(REFERENCE_CONFIG), CANDIDATE) as typeof REFERENCE_CONFIG & {
      llm_routing: { executor: { primary: Record<string, string>; temperature: number } };
      execution: Record<string, unknown>;
    };
    expect(merged.llm_routing.executor.primary).toEqual({
      backing_tool: 'goose_cli',
      provider: 'ollama',
      model: 'gemma4:12b-it-qat',
    });
    // Upstream roles untouched (executor-only is a locked sweep decision).
    expect(merged.llm_routing.domain_interpreter.primary.model).toBe('gpt-oss:20b');
    expect(merged.llm_routing.executor.temperature).toBe(1);
    expect(merged.decomposition.budget_cap).toBe(5000);
    expect(merged.execution.auto_approve_wave_gates).toBe(true);
    expect(merged.execution.unattended_skip_permissions).toBe(true);
    expect(merged.execution.leaf_retry_budget).toBe(2);
  });

  it('does not mutate the input and tolerates missing blocks', () => {
    const input = {};
    const merged = mergeExecutorConfig(input, CANDIDATE) as {
      llm_routing: { executor: { primary: { model: string } } };
    };
    expect(input).toEqual({});
    expect(merged.llm_routing.executor.primary.model).toBe('gemma4:12b-it-qat');
  });
});

describe('prepareConfigWorkspace', () => {
  let root: string;
  let referenceWorkspace: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bakeoff-prep-'));
    referenceWorkspace = join(root, 'reference');
    mkdirSync(join(referenceWorkspace, '.janumicode'), { recursive: true });
    writeFileSync(join(referenceWorkspace, '.janumicode', 'intent.md'), '# TinyURL intent\n', 'utf-8');
    writeFileSync(
      join(referenceWorkspace, '.janumicode', 'config.json'),
      JSON.stringify(REFERENCE_CONFIG),
      'utf-8',
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('seeds a fresh workspace with intent + merged config', () => {
    const { workspaceDir, intentPath } = prepareConfigWorkspace({
      referenceWorkspace,
      candidate: CANDIDATE,
      workspacesRoot: join(root, 'out', 'workspaces'),
    });
    expect(workspaceDir).toBe(join(root, 'out', 'workspaces', CANDIDATE.slug));
    expect(readFileSync(intentPath, 'utf-8')).toContain('TinyURL');
    const config = JSON.parse(readFileSync(join(workspaceDir, '.janumicode', 'config.json'), 'utf-8'));
    expect(config.llm_routing.executor.primary.model).toBe('gemma4:12b-it-qat');
    // No scaffold/test-harness dirs copied — codegen can't leak between configs.
    expect(existsSync(join(workspaceDir, '.janumicode', 'test-harness'))).toBe(false);
  });

  it('refuses to reuse an existing workspace', () => {
    const opts = { referenceWorkspace, candidate: CANDIDATE, workspacesRoot: join(root, 'out', 'workspaces') };
    prepareConfigWorkspace(opts);
    expect(() => prepareConfigWorkspace(opts)).toThrow(/already exists/);
  });

  it('fails clearly when the reference workspace is incomplete', () => {
    rmSync(join(referenceWorkspace, '.janumicode', 'intent.md'));
    expect(() =>
      prepareConfigWorkspace({
        referenceWorkspace,
        candidate: CANDIDATE,
        workspacesRoot: join(root, 'out', 'workspaces'),
      }),
    ).toThrow(/intent\.md/);
  });
});

describe('seedGooseConfig', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'goose-seed-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('writes config/config.yaml with telemetry consent + a configured ollama provider at the system port', () => {
    const p = seedGooseConfig(root, { modelTag: 'gpt-oss:20b', ollamaPort: 11434 });
    expect(p).toBe(join(root, 'config', 'config.yaml'));
    const yaml = readFileSync(p, 'utf-8');
    // Telemetry key present ⇒ goose treats consent as decided ⇒ no onboarding prompt.
    expect(yaml).toMatch(/GOOSE_TELEMETRY_ENABLED:/);
    expect(yaml).toContain('active_provider: ollama');
    expect(yaml).toContain('configured: true');
    expect(yaml).toContain('model: gpt-oss:20b');
    expect(yaml).toContain('http://127.0.0.1:11434');
  });
});
