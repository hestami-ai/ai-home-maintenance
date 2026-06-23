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
import { MimoClient } from './mimoClient';

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
        'ls*': 'allow', 'cat *': 'allow', 'go *': 'allow', 'npm *': 'allow',
        'node *': 'allow', 'pnpm *': 'allow', 'grep *': 'allow', 'git status*': 'allow',
      },
      external_directory: {
        '*': sensitive,
        // mimo's own data dir — needed for plans/tool-output/compose skills.
        '~/.local/share/mimocode/**': 'allow',
      },
    },
  };
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

    this.writePolicyAndTrust(key, cfg.permissionMode);
    const server = await this.spawnServer(key, cfg);
    this.servers.set(key, server);
    this.hookProcessExit();
    return server;
  }

  private writePolicyAndTrust(projectRoot: string, mode: MimoPermissionMode): void {
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'mimocode.json'),
      JSON.stringify(buildPermissionPolicy(mode), null, 2),
      'utf8',
    );
    addTrustedPath(path.join(os.homedir(), '.local', 'share', 'mimocode', 'trusted-workspaces.json'), projectRoot);
  }

  private spawnServer(projectRoot: string, cfg: MimoConfig): Promise<RunningServer> {
    const proc = spawn(cfg.binary, ['serve', '--port', '0', '--hostname', '127.0.0.1'], {
      cwd: projectRoot,
      env: process.env,
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
