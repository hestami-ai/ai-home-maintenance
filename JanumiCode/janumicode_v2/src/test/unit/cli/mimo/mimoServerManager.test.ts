import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildPermissionPolicy,
  buildExecutorAgentPrompt,
  parseListeningUrl,
  addTrustedPath,
  resolveMimoConfig,
  buildServerEnv,
  buildLocalProvider,
  buildProjectConfig,
  LOCAL_PROVIDER_ID,
} from '../../../../lib/cli/mimo/mimoServerManager';

describe('buildServerEnv', () => {
  it('disables the startup claude-import + auto-update by default (avoids the DB-bloat startup storm)', () => {
    const env = buildServerEnv({ PATH: '/x' });
    expect(env.MIMOCODE_DISABLE_CLAUDE_IMPORT).toBe('1');
    expect(env.MIMOCODE_DISABLE_AUTOUPDATE).toBe('1');
    expect(env.PATH).toBe('/x'); // base env preserved
  });

  it('respects a caller-set value (opt back in)', () => {
    const env = buildServerEnv({ MIMOCODE_DISABLE_CLAUDE_IMPORT: '0' });
    expect(env.MIMOCODE_DISABLE_CLAUDE_IMPORT).toBe('0');
  });
});

describe('buildPermissionPolicy', () => {
  it('static mode: valid JSON, deny-by-default, NO ask, tilde external_directory', () => {
    const policy = buildPermissionPolicy('static');
    const json = JSON.stringify(policy);
    expect(() => JSON.parse(json)).not.toThrow();
    // No `ask` anywhere in static mode (would hang headless).
    expect(json).not.toContain('"ask"');
    const perm = (policy as { permission: Record<string, unknown> }).permission;
    expect(perm.edit).toBe('allow');
    expect(perm.webfetch).toBe('deny');
    // bash scoped: deny-* but allow ls/go (compose leads with ls, verifies with go test).
    expect((perm.bash as Record<string, string>)['*']).toBe('deny');
    expect((perm.bash as Record<string, string>)['ls*']).toBe('allow');
    // mkdir MUST be allowed — the executor creates its own component dir (a deny
    // deadlocks the leaf, observed in the ws-156 TUI run).
    expect((perm.bash as Record<string, string>)['mkdir *']).toBe('allow');
    // Stack-generic test/build runners (not node-only) so python/rust/etc gates run.
    expect((perm.bash as Record<string, string>)['python *']).toBe('allow');
    expect((perm.bash as Record<string, string>)['pytest*']).toBe('allow');
    expect((perm.bash as Record<string, string>)['pip *']).toBe('allow');
    expect((perm.bash as Record<string, string>)['cargo *']).toBe('allow');
    // mimo's own dir allowed via a tilde path (NOT a backslash Windows path).
    const ext = perm.external_directory as Record<string, string>;
    expect(ext['*']).toBe('deny');
    expect(ext['~/.local/share/mimocode/**']).toBe('allow');
    expect(json).not.toMatch(/\\\\/); // no backslash escapes that would break mimo's JSON parse
  });

  it('relay mode: sensitive tools become ask; edit/read stay allow', () => {
    const perm = (buildPermissionPolicy('relay') as { permission: Record<string, unknown> }).permission;
    expect(perm.webfetch).toBe('ask');
    expect((perm.bash as Record<string, string>)['*']).toBe('ask');
    expect((perm.external_directory as Record<string, string>)['*']).toBe('ask');
    expect(perm.edit).toBe('allow');
    // `question` is governed by the SEPARATE attended axis, not by relay: default
    // (headless) denies it even in relay (there is no human + mimo can't inject an
    // answer over the compose API).
    expect(perm.question).toBe('deny');
  });

  it('question tool is denied HEADLESS (attended=false) and asked ATTENDED (attended=true), in either mode', () => {
    const q = (mode: 'static' | 'relay', attended: boolean) =>
      ((buildPermissionPolicy(mode, attended) as { permission: Record<string, unknown> }).permission).question;
    expect(q('static', false)).toBe('deny');
    expect(q('relay', false)).toBe('deny');
    expect(q('static', true)).toBe('ask'); // surfaced to the responder/human by the adapter
    expect(q('relay', true)).toBe('ask');
  });
});

describe('buildLocalProvider', () => {
  it('returns null for cloud models (cloud config path unchanged)', () => {
    expect(buildLocalProvider('mimo/mimo-auto', {})).toBeNull();
    expect(buildLocalProvider('ollama-cloud/deepseek-v4-flash', {})).toBeNull();
  });

  it('synthesizes a local openai-compatible provider from an ollama-local model ref', () => {
    const local = buildLocalProvider(`${LOCAL_PROVIDER_ID}/qwen3.6:27b-q4_K_M`, {});
    expect(local).not.toBeNull();
    expect(local!.model).toBe(`${LOCAL_PROVIDER_ID}/qwen3.6:27b-q4_K_M`);
    const p = (local!.provider as Record<string, { npm: string; options: { baseURL: string; apiKey: string }; models: Record<string, unknown> }>)[LOCAL_PROVIDER_ID];
    expect(p.npm).toBe('@ai-sdk/openai-compatible');
    expect(p.options.baseURL).toBe('http://localhost:11434/v1'); // Ollama default
    expect(p.options.apiKey).toBe('ollama'); // non-empty placeholder
    // The exact model id (colon and all) is declared with tool_call enabled —
    // custom providers don't auto-discover, and compose needs tools. A `limit`
    // with the real context window is REQUIRED so mimo doesn't compact/truncate
    // large prompts (the engineering constitution) server-side.
    expect(p.models['qwen3.6:27b-q4_K_M']).toEqual({
      name: 'qwen3.6:27b-q4_K_M', tool_call: true, reasoning: false, attachment: false,
      limit: { context: 262144, output: 32768 },
    });
  });

  it('honors a custom OpenAI base URL + key (vLLM/llama.cpp)', () => {
    const local = buildLocalProvider(`${LOCAL_PROVIDER_ID}/llama3`, {
      JANUMICODE_MIMO_OPENAI_BASE_URL: 'http://localhost:8000/v1',
      JANUMICODE_MIMO_OPENAI_API_KEY: 'sk-local',
    });
    const p = (local!.provider as Record<string, { options: { baseURL: string; apiKey: string } }>)[LOCAL_PROVIDER_ID];
    expect(p.options.baseURL).toBe('http://localhost:8000/v1');
    expect(p.options.apiKey).toBe('sk-local');
  });

  it('honors a custom context/output window (smaller local model)', () => {
    const local = buildLocalProvider(`${LOCAL_PROVIDER_ID}/llama3`, {
      JANUMICODE_MIMO_OPENAI_CONTEXT: '32768',
      JANUMICODE_MIMO_OPENAI_MAX_OUTPUT: '4096',
    });
    const p = (local!.provider as Record<string, { models: Record<string, { limit: { context: number; output: number } }> }>)[LOCAL_PROVIDER_ID];
    expect(p.models['llama3'].limit).toEqual({ context: 32768, output: 4096 });
  });
});

describe('buildProjectConfig', () => {
  it('cloud model: permission policy only, no provider/model keys', () => {
    const cfg = resolveMimoConfig({}); // mimo/mimo-auto
    const config = buildProjectConfig(cfg, {});
    expect(config.permission).toBeDefined();
    expect(config.provider).toBeUndefined();
    expect(config.model).toBeUndefined();
  });

  it('local model: merges the synthesized provider + default model into the policy (valid JSON, no backslash escapes)', () => {
    const cfg = resolveMimoConfig({ JANUMICODE_MIMO_MODEL: `${LOCAL_PROVIDER_ID}/gpt-oss:20b` });
    const config = buildProjectConfig(cfg, {});
    expect(config.permission).toBeDefined(); // policy still present
    expect((config.provider as Record<string, unknown>)[LOCAL_PROVIDER_ID]).toBeDefined();
    expect(config.model).toBe(`${LOCAL_PROVIDER_ID}/gpt-oss:20b`);
    const json = JSON.stringify(config);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).not.toMatch(/\\\\/); // no backslash escapes that break mimo's JSON parse
  });

  it('defines the janumicode executor agent: mimo default coding prompt, anti-comment line removed, constitution NOT embedded', () => {
    const config = buildProjectConfig(resolveMimoConfig({}), {});
    const agent = (config.agent as Record<string, { mode?: string; prompt?: string }>).janumicode;
    expect(agent).toBeDefined();
    expect(agent.mode).toBe('primary');
    // The one conflicting line is removed — the prompt no longer suppresses comments.
    expect(agent.prompt).not.toMatch(/DO NOT ADD .*COMMENTS|AVOID adding comments/i);
    // It is baselined off mimo's default coding prompt (its guidance is preserved).
    expect(agent.prompt).toMatch(/Following conventions/);
    expect(agent.prompt).toMatch(/lint.*typecheck|typecheck/i);
    expect(agent.prompt).toMatch(/file_path:line_number/);
    // The Engineering Constitution stays in the TASK CONTEXT — it is NOT embedded
    // in the harness agent prompt (per the architecture: generic agent, per-leaf craft).
    expect(agent.prompt).not.toMatch(/Engineering Constitution/i);
    expect(agent.prompt).not.toMatch(/CC-001/);
    expect(agent.prompt).not.toMatch(/doc-comment/i);
  });

  it('disables mimo auto-compaction by default (prevents the checkpoint-writer fork wedge)', () => {
    const config = buildProjectConfig(resolveMimoConfig({}), {});
    // compaction.auto=false stops mimo from forking its native checkpoint-writer
    // subagent (which fails "missing forkContext" and retry-loops, wedging a leaf).
    expect(config.compaction).toEqual({ auto: false });
  });

  it('JANUMICODE_MIMO_AUTOCOMPACT=1 opts back into mimo auto-compaction', () => {
    const config = buildProjectConfig(resolveMimoConfig({}), { JANUMICODE_MIMO_AUTOCOMPACT: '1' });
    expect(config.compaction).toBeUndefined();
  });
});

describe('buildExecutorAgentPrompt (mode-aware framing)', () => {
  const headless = buildExecutorAgentPrompt(false);
  const attended = buildExecutorAgentPrompt(true);

  it('preserves mimo\'s coding guidance and the anti-comment removal in BOTH modes', () => {
    for (const p of [headless, attended]) {
      expect(p).toMatch(/Following conventions/);
      expect(p).toMatch(/file_path:line_number/);
      expect(p).not.toMatch(/DO NOT ADD .*COMMENTS/i);
      // Craft standard stays in the per-leaf task context, never embedded here.
      expect(p).not.toMatch(/Engineering Constitution/i);
    }
  });
  it('HEADLESS states there is no interactive user + tells the agent to self-resolve', () => {
    expect(headless).toMatch(/headlessly/i);
    expect(headless).toMatch(/no interactive user/i);
    expect(headless).toMatch(/best spec-consistent choice|make the best/i);
    expect(headless).not.toMatch(/voice-of-intent/i);
  });
  it('ATTENDED frames the voice-of-intent reviewer + escalation, but still forbids stalling', () => {
    expect(attended).toMatch(/voice-of-intent/i);
    expect(attended).toMatch(/escalates to a human/i);
    expect(attended).toMatch(/never stall/i);
    expect(attended).not.toMatch(/no interactive user/i);
  });
  it('buildProjectConfig renders the attended framing when cfg.attended is set', () => {
    const cfg = { ...resolveMimoConfig({}), attended: true };
    const config = buildProjectConfig(cfg, {});
    const agent = (config.agent as Record<string, { prompt?: string }>).janumicode;
    expect(agent.prompt).toMatch(/voice-of-intent/i);
    // and the question tool is asked (surfaced), not denied, when attended
    expect(((config.permission as Record<string, unknown>).question)).toBe('ask');
  });
});

describe('parseListeningUrl', () => {
  it('extracts the base URL from the serve log line', () => {
    expect(parseListeningUrl('Warning: ...\nmimocode server listening on http://127.0.0.1:4096\n'))
      .toBe('http://127.0.0.1:4096');
  });
  it('returns null before the line appears', () => {
    expect(parseListeningUrl('booting...')).toBeNull();
  });
});

describe('resolveMimoConfig', () => {
  it('defaults: mimo binary, mimo/mimo-auto, janumicode agent, static, headless (attended=false)', () => {
    expect(resolveMimoConfig({})).toEqual({ binary: 'mimo', model: 'mimo/mimo-auto', agent: 'janumicode', permissionMode: 'static', attended: false });
  });
  it('honors env overrides (incl. JANUMICODE_MIMO_ATTENDED=1)', () => {
    const cfg = resolveMimoConfig({ JANUMICODE_MIMO_MODEL: 'mimo/mimo-pro', JANUMICODE_MIMO_AGENT: 'build', JANUMICODE_MIMO_PERMISSION_MODE: 'relay', JANUMICODE_MIMO_ATTENDED: '1' });
    expect(cfg).toMatchObject({ model: 'mimo/mimo-pro', agent: 'build', permissionMode: 'relay', attended: true });
  });
});

describe('addTrustedPath', () => {
  let dir: string;
  let trustFile: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-mimo-trust-'));
    trustFile = path.join(dir, 'trusted-workspaces.json');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('creates the file and adds the native project path', () => {
    addTrustedPath(trustFile, path.join(dir, 'proj'));
    const j = JSON.parse(fs.readFileSync(trustFile, 'utf8'));
    expect(j.version).toBe(1);
    expect(j.trustedPaths).toContain(path.resolve(dir, 'proj'));
  });

  it('is idempotent and preserves existing entries', () => {
    fs.writeFileSync(trustFile, JSON.stringify({ version: 1, trustedPaths: ['/existing'] }));
    addTrustedPath(trustFile, path.join(dir, 'proj'));
    addTrustedPath(trustFile, path.join(dir, 'proj'));
    const j = JSON.parse(fs.readFileSync(trustFile, 'utf8'));
    expect(j.trustedPaths).toContain('/existing');
    expect(j.trustedPaths.filter((p: string) => p === path.resolve(dir, 'proj'))).toHaveLength(1);
  });
});
