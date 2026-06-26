/**
 * Lifecycle manager for `mimo serve` instances backing the Phase-9 executor.
 *
 * mimo binds every session to the SERVER's launch cwd (the POST-body
 * `directory` is ignored), so we run ONE server per project root (the Phase-9
 * `projectRoot`) and reuse it across all leaves — each leaf is a fresh
 * `POST /session`. The server is started lazily on first use, kept warm (the
 * first start pays a one-time ~20s DB-migrate/import cost), and torn down at
 * Phase-9 end + on process exit.
 *
 * One-time per project root, before the server starts, we:
 *   - write a deny-by-default `mimocode.json` permission policy into the root, and
 *   - add the root to `~/.local/share/mimocode/trusted-workspaces.json`
 * so the headless server never blocks on a permission `ask` or trust prompt.
 *
 * Hard-won gotchas baked in (see memory project_mimo_executor_evaluation):
 *   - policy MUST be valid JSON — use `~/…` tilde paths, never backslash Windows
 *     paths (invalid JSON escape → mimo silently bails, looks like a "stall");
 *   - `bash` must be allowed (scoped) — compose leads with `ls`, verifies with `go test`;
 *   - `external_directory` must allow mimo's own `~/.local/share/mimocode/**`;
 *   - no `ask` entries in static mode (would hang headless).
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getLogger } from '../../logging';
import { MimoClient, parseModelRef } from './mimoClient';

export type MimoPermissionMode = 'static' | 'relay';

export interface MimoConfig {
  /** Binary (default `mimo`, overridable via JANUMICODE_MIMO_PATH). */
  binary: string;
  /** `provider/model` (default `mimo/mimo-auto`). */
  model: string;
  /** Primary agent (default `compose`). */
  agent: string;
  permissionMode: MimoPermissionMode;
}

export function resolveMimoConfig(env: NodeJS.ProcessEnv = process.env): MimoConfig {
  return {
    binary: env.JANUMICODE_MIMO_PATH || 'mimo',
    model: env.JANUMICODE_MIMO_MODEL || 'mimo/mimo-auto',
    agent: env.JANUMICODE_MIMO_AGENT || 'compose',
    permissionMode: (env.JANUMICODE_MIMO_PERMISSION_MODE as MimoPermissionMode) === 'relay' ? 'relay' : 'static',
  };
}

/**
 * Environment for the `mimo serve` child. JanumiCode never needs mimo to import
 * the user's `~/.claude/projects` sessions — that startup `claude-import` (35s+)
 * and the subsequent session backfill bloat `mimocode.db` and race in-flight
 * compose turns (observed: a 2.3GB DB → ~2.5min startup storm that dropped the
 * Phase-9 turn mid-stream). Disable it, plus auto-update (no mid-run self-update
 * churn). The caller can still opt back in by pre-setting either env var.
 */
export function buildServerEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...env,
    MIMOCODE_DISABLE_CLAUDE_IMPORT: env.MIMOCODE_DISABLE_CLAUDE_IMPORT ?? '1',
    MIMOCODE_DISABLE_AUTOUPDATE: env.MIMOCODE_DISABLE_AUTOUPDATE ?? '1',
  };
}

/**
 * Build the project-root `mimocode.json` permission policy.
 * `static`: deny-by-default, no `ask` (headless). `relay`: sensitive tools
 * (shell/network/out-of-dir) become `ask` so a human approves via the relay.
 */
export function buildPermissionPolicy(mode: MimoPermissionMode): Record<string, unknown> {
  const sensitive = mode === 'relay' ? 'ask' : 'deny';
  return {
    $schema: 'https://mimo.xiaomi.com//config.json',
    permission: {
      read: 'allow', edit: 'allow', glob: 'allow', grep: 'allow', lsp: 'allow', task: 'allow', skill: 'allow',
      webfetch: sensitive, websearch: sensitive, codesearch: sensitive,
      // `question` stays denied even in relay: the executor is non-conversational.
      question: 'deny',
      doom_loop: mode === 'relay' ? 'ask' : 'deny',
      bash: {
        '*': sensitive,
        // Read/inspect + directory creation (the executor must be able to mkdir
        // its own component directory — denying it deadlocks the leaf).
        'ls*': 'allow', 'cat *': 'allow', 'grep *': 'allow', 'git status*': 'allow',
        'mkdir *': 'allow', 'touch *': 'allow',
        // Stack-generic build/test runners (node, python, rust, go, java) so the
        // per-leaf gate command resolved by gateCommands.ts can actually run. A
        // node-only allowlist silently fails every python/rust/etc gate.
        'npm *': 'allow', 'node *': 'allow', 'pnpm *': 'allow',
        'python *': 'allow', 'python3 *': 'allow', 'pytest*': 'allow', 'pip *': 'allow', 'pip3 *': 'allow',
        'go *': 'allow', 'cargo *': 'allow', 'mvn *': 'allow', 'gradle *': 'allow',
      },
      external_directory: {
        '*': sensitive,
        // mimo's own data dir — needed for plans/tool-output/compose skills.
        '~/.local/share/mimocode/**': 'allow',
      },
    },
  };
}

/**
 * Provider id for a LOCAL, OpenAI-compatible endpoint (Ollama by default, but
 * any `/v1`-shaped server — vLLM, llama.cpp — via JANUMICODE_MIMO_OPENAI_BASE_URL).
 * mimo ships only `ollama-cloud` (→ ollama.com); there is no built-in *local*
 * ollama provider, so we synthesize one. Selecting it removes Xiaomi's free-tier
 * cloud from the executor loop entirely → a deterministic, offline executor.
 */
export const LOCAL_PROVIDER_ID = 'ollama-local';

/**
 * When `model` targets the local provider (`ollama-local/<model>`), synthesize
 * the mimocode.json `provider` block that points an openai-compatible client at
 * the local endpoint. Returns null for any cloud model (`mimo/*`,
 * `ollama-cloud/*`, …) so the cloud path's written config is byte-unchanged.
 *
 * mimo bundles `@ai-sdk/openai-compatible` (its built-in `ollama-cloud` uses it),
 * so referencing it by `npm` resolves without an install. Ollama's `/v1`
 * endpoint ignores the key, but the SDK wants a non-empty `apiKey` → placeholder.
 */
export function buildLocalProvider(
  model: string,
  env: NodeJS.ProcessEnv = process.env,
): { provider: Record<string, unknown>; model: string } | null {
  const { providerID, modelID } = parseModelRef(model);
  if (providerID !== LOCAL_PROVIDER_ID) return null;
  const baseURL = env.JANUMICODE_MIMO_OPENAI_BASE_URL || 'http://localhost:11434/v1';
  // CRITICAL: declare the model's context/output window. A custom openai-compatible
  // provider model with NO `limit` makes mimo fall back to a small default context,
  // and mimo's conversation COMPACTION then summarizes earlier context away once the
  // (under-declared) window fills — silently truncating large prompts (e.g. the
  // inlined engineering constitution) server-side before the model ever sees them.
  // Declaring the REAL window (Ollama loads gemma4:26b at 262144) stops the spurious
  // compaction. Override per local model via env when its window differs.
  const contextWindow = Number(env.JANUMICODE_MIMO_OPENAI_CONTEXT) || 262144;
  const maxOutput = Number(env.JANUMICODE_MIMO_OPENAI_MAX_OUTPUT) || 32768;
  return {
    provider: {
      [LOCAL_PROVIDER_ID]: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Local (OpenAI-compatible)',
        options: { baseURL, apiKey: env.JANUMICODE_MIMO_OPENAI_API_KEY || 'ollama' },
        // Custom openai-compatible providers don't auto-discover; declare the
        // model AND its capabilities. `tool_call: true` is REQUIRED — the
        // tool-heavy `compose` agent only receives tools for tool-capable models
        // (use a tool-calling Ollama model: qwen3.*, gpt-oss, granite). `reasoning`
        // off so a thinking model's chain-of-thought is treated as plain output
        // (no `reasoning_content` field is demanded of Ollama's `/v1`). `limit`
        // declares the real context window so mimo doesn't truncate/compact (above).
        models: {
          [modelID]: {
            name: modelID, tool_call: true, reasoning: false, attachment: false,
            limit: { context: contextWindow, output: maxOutput },
          },
        },
      },
    },
    model: `${LOCAL_PROVIDER_ID}/${modelID}`,
  };
}

/**
 * The full `mimocode.json` written into a project root: the permission policy
 * plus, when a local provider is selected, the synthesized `provider` + default
 * `model`. mimocode.json is OpenCode's unified config (permission + provider +
 * model in one file), so both live together — and because `writePolicyAndTrust`
 * rewrites this file on every `ensure()`, the provider MUST be merged here
 * rather than written to a separate file it would clobber.
 */
export function buildProjectConfig(cfg: MimoConfig, env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const config: Record<string, unknown> = buildPermissionPolicy(cfg.permissionMode);
  const local = buildLocalProvider(cfg.model, env);
  if (local) {
    config.provider = local.provider;
    config.model = local.model;
  }
  return config;
}

/** Parse `mimocode server listening on http://127.0.0.1:PORT` from server stdout. */
export function parseListeningUrl(text: string): string | null {
  const m = /listening on (https?:\/\/[^\s]+)/i.exec(text);
  return m ? m[1].replace(/\/+$/, '') : null;
}

/** Add `projectRoot` (native form) to mimo's trusted-workspaces file, idempotently. */
export function addTrustedPath(trustFilePath: string, projectRoot: string): void {
  let json: { version?: number; trustedPaths?: string[] } = { version: 1, trustedPaths: [] };
  try {
    json = JSON.parse(fs.readFileSync(trustFilePath, 'utf8'));
  } catch {
    /* fresh file */
  }
  json.version ??= 1;
  json.trustedPaths ??= [];
  const native = path.resolve(projectRoot);
  if (!json.trustedPaths.includes(native)) json.trustedPaths.push(native);
  fs.mkdirSync(path.dirname(trustFilePath), { recursive: true });
  fs.writeFileSync(trustFilePath, JSON.stringify(json, null, 2));
}

interface RunningServer {
  proc: ChildProcess;
  baseUrl: string;
  client: MimoClient;
}

/**
 * Process-wide singleton. One server per projectRoot; reused across leaves.
 */
class MimoServerManagerImpl {
  private readonly servers = new Map<string, RunningServer>();
  private exitHooked = false;

  /** Ensure a warm server for `projectRoot`; returns its base URL + client. */
  async ensure(projectRoot: string, cfg: MimoConfig = resolveMimoConfig()): Promise<RunningServer> {
    const key = path.resolve(projectRoot);
    const existing = this.servers.get(key);
    if (existing && existing.proc.exitCode === null) return existing;

    this.writePolicyAndTrust(key, cfg);
    const server = await this.spawnServer(key, cfg);
    this.servers.set(key, server);
    this.hookProcessExit();
    return server;
  }

  private writePolicyAndTrust(projectRoot: string, cfg: MimoConfig): void {
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'mimocode.json'),
      JSON.stringify(buildProjectConfig(cfg), null, 2),
      'utf8',
    );
    addTrustedPath(path.join(os.homedir(), '.local', 'share', 'mimocode', 'trusted-workspaces.json'), projectRoot);
  }

  private spawnServer(projectRoot: string, cfg: MimoConfig): Promise<RunningServer> {
    const proc = spawn(cfg.binary, ['serve', '--port', '0', '--hostname', '127.0.0.1'], {
      cwd: projectRoot,
      env: buildServerEnv(),
      // shell:true so Windows resolves the `mimo` npm shim (.cmd) on PATH.
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return new Promise<RunningServer>((resolve, reject) => {
      let out = '';
      const timer = setTimeout(() => {
        reject(new Error(`mimo serve did not report a listening URL within 60s. stderr/out:\n${out.slice(-800)}`));
      }, 60_000);

      const onData = (d: Buffer) => {
        out += d.toString();
        const url = parseListeningUrl(out);
        if (!url) return;
        clearTimeout(timer);
        proc.stdout?.off('data', onData);
        proc.stderr?.off('data', onData);
        const client = new MimoClient(url);
        // Readiness: poll createSession until it succeeds (DB migrate may lag the log line).
        this.waitReady(client).then(
          () => resolve({ proc, baseUrl: url, client }),
          (err) => reject(err),
        );
      };
      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);
      proc.on('error', (err) => { clearTimeout(timer); reject(err); });
      proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`mimo serve exited early (code ${code}):\n${out.slice(-800)}`)); });
    });
  }

  private async waitReady(client: MimoClient): Promise<void> {
    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        await client.createSession();
        return;
      } catch {
        if (Date.now() > deadline) throw new Error('mimo server not ready within 60s');
        await delay(1000);
      }
    }
  }

  /** Tear down one server (Phase-9 end) or all (default). */
  shutdown(projectRoot?: string): void {
    const keys = projectRoot ? [path.resolve(projectRoot)] : [...this.servers.keys()];
    for (const key of keys) {
      const s = this.servers.get(key);
      if (!s) continue;
      try {
        if (s.proc.pid && process.platform === 'win32') {
          spawn('taskkill', ['/PID', String(s.proc.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
        } else {
          s.proc.kill('SIGTERM');
        }
      } catch (err) {
        getLogger().debug('workflow', 'mimo server shutdown failed (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
      }
      this.servers.delete(key);
    }
  }

  private hookProcessExit(): void {
    if (this.exitHooked) return;
    this.exitHooked = true;
    const onExit = () => this.shutdown();
    process.once('exit', onExit);
    process.once('SIGINT', () => { this.shutdown(); process.exit(130); });
    process.once('SIGTERM', () => { this.shutdown(); process.exit(143); });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Process-wide singleton instance. */
export const MimoServerManager = new MimoServerManagerImpl();
