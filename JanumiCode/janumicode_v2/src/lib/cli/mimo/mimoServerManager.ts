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
import { assertNotReplayMode } from '../../replay/gpuGuard';
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
  /**
   * Whether a human is in the loop (= !unattendedSkipPermissions). Governs the
   * clarify-with-the-user (`question`) tool and the executor agent-prompt
   * framing: headless denies `question` (there is no human AND the compose HTTP
   * API cannot carry a text answer back) and tells the agent it runs headless;
   * attended sets `question:'ask'` so the adapter can surface the question to the
   * voice-of-intent reviewer + human before the agent self-resolves. Set by the
   * adapter from its build context (per-invocation); env `JANUMICODE_MIMO_ATTENDED=1`
   * is a standalone override. Default false — calibration/CI is the safe default.
   */
  attended: boolean;
}

/**
 * Custom mimo/OpenCode agent JanumiCode runs the executor as by DEFAULT. mimo's
 * built-in `compose`/`build` agents compose a base coding prompt (mimo's
 * `default.txt`) whose "# Code style" section says verbatim **"IMPORTANT: DO NOT
 * ADD ***ANY*** COMMENTS unless asked"** — a Claude-Code-lineage convention that,
 * being a SYSTEM instruction, overrides the task-context Engineering Constitution
 * and produced 0-comment code across every model (gemma4, qwen3.6; mostly
 * qwen3-coder). This agent's `prompt` ({@link buildExecutorAgentPrompt}) is
 * baselined off `default.txt` with ONLY that conflicting line removed — so mimo's
 * coding guidance is preserved and the comments the task context asks for are no
 * longer suppressed. The Engineering Constitution itself is NOT embedded here; it
 * stays in the per-leaf task context. Opt back into mimo's built-in (anti-comment)
 * agent with `JANUMICODE_MIMO_AGENT=compose`.
 */
export const EXECUTOR_AGENT_NAME = 'janumicode';

export function resolveMimoConfig(env: NodeJS.ProcessEnv = process.env): MimoConfig {
  return {
    binary: env.JANUMICODE_MIMO_PATH || 'mimo',
    model: env.JANUMICODE_MIMO_MODEL || 'mimo/mimo-auto',
    agent: env.JANUMICODE_MIMO_AGENT || EXECUTOR_AGENT_NAME,
    permissionMode: (env.JANUMICODE_MIMO_PERMISSION_MODE as MimoPermissionMode) === 'relay' ? 'relay' : 'static',
    // Default headless (calibration/CI); the executor adapter overrides this from
    // its per-invocation build context (= !unattendedSkipPermissions).
    attended: env.JANUMICODE_MIMO_ATTENDED === '1',
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
 * `attended` (a SEPARATE axis from `mode` — a human is in the loop this run)
 * governs only the clarify-with-the-user `question` tool.
 */
export function buildPermissionPolicy(mode: MimoPermissionMode, attended = false): Record<string, unknown> {
  const sensitive = mode === 'relay' ? 'ask' : 'deny';
  return {
    $schema: 'https://mimo.xiaomi.com//config.json',
    permission: {
      read: 'allow', edit: 'allow', glob: 'allow', grep: 'allow', lsp: 'allow', task: 'allow', skill: 'allow',
      webfetch: sensitive, websearch: sensitive, codesearch: sensitive,
      // The clarify-with-the-user `question` tool. HEADLESS → `deny`: there is no
      // human, AND mimo's compose HTTP API is non-conversational — a permission
      // answer carries only approve/deny (never a text reply), so a question can't
      // be answered in-band (the agent self-resolves per the execution directive).
      // ATTENDED → `ask`: the ask SURFACES as a `permission.asked` the adapter
      // routes to the voice-of-intent reviewer + human (mimoServerAdapter) before
      // the agent proceeds. NOT tied to `mode`: relay==static for `question`.
      question: attended ? 'ask' : 'deny',
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
/**
 * System prompt for the {@link EXECUTOR_AGENT_NAME} agent — the executor's base
 * coding prompt. It is BASELINED OFF mimo's own `default.txt` (its standard
 * coding agent prompt — Following conventions, Code style, Doing tasks with
 * lint/typecheck, Tool usage, Code References), so mimo's coding-quality guidance
 * is preserved. The ONLY change vs mimo's base prompt is REMOVING the single line
 * that conflicts with how JanumiCode delivers craft requirements —
 * `IMPORTANT: DO NOT ADD ***ANY*** COMMENTS unless asked` — which, as a SYSTEM
 * instruction, was overriding the task-context Engineering Constitution and
 * producing 0-comment code on every model. The interactive-chat-only sections of
 * default.txt (verbosity examples, one-word answers, proactiveness) are dropped
 * since the executor runs headless. NOTE: the Engineering Constitution + any
 * project-specific requirements are delivered in the TASK CONTEXT (per leaf), NOT
 * embedded here — this prompt stays a generic coding-agent prompt that simply no
 * longer suppresses the comments the task context asks for.
 */
export function buildExecutorAgentPrompt(attended = false): string {
  // Framing is MODE-AWARE. Headless: state plainly there is no human to converse
  // with (so the agent self-resolves rather than asking into a void). Attended: a
  // spec-grounded voice-of-intent reviewer answers where possible and escalates to
  // a human when it can't — but the agent still resolves what it can itself and
  // never stalls (mimo's compose API is non-conversational; see buildPermissionPolicy).
  // Both frame Research-Plan-Implement (read to reconcile the task with reality);
  // NEITHER bans reading — the old "no-crawl" absolutism blocked RPI.
  const framing = attended
    ? [
        'You are a coding agent implementing ONE precisely-specified software-engineering task inside an',
        'existing project under a governed session: a voice-of-intent reviewer, grounded in the spec, answers',
        'clarifying questions where this session supports it and escalates to a human when it cannot — but',
        'resolve what you can yourself from the task, spec, and codebase, and never stall waiting for a reply.',
        'The task — its specification, completion criteria, constraints, write scope, and supporting context —',
        'is delivered in your message context and is authoritative. Work only within the declared write scope.',
      ]
    : [
        'You are a coding agent implementing ONE precisely-specified software-engineering task inside an',
        'existing project, driven headlessly (there is no interactive user to converse with — resolve any',
        'ambiguity from the task, spec, and codebase, make the best spec-consistent choice, and proceed). The',
        'task — its specification, completion criteria, constraints, write scope, and supporting context — is',
        'delivered in your message context and is authoritative. Work only within the declared write scope.',
      ];
  return [
    ...framing,
    '',
    '# Following conventions',
    "When making changes to files, first understand the file's code conventions. Mimic code style, use",
    'existing libraries and utilities, and follow existing patterns.',
    '- NEVER assume that a given library is available, even if it is well known. Whenever you write code',
    '  that uses a library or framework, first check that this project already uses it (look at',
    '  neighboring files, or check the manifest — package.json / pyproject.toml / Cargo.toml / go.mod).',
    '- When you create a new file, first look at existing siblings to see how they are written; then',
    '  follow their framework choice, naming conventions, and typing.',
    '- When you edit code, read the surrounding context (especially imports) and make the change in the',
    '  most idiomatic way.',
    '- Always follow security best practices. Never introduce code that exposes or logs secrets or keys.',
    '',
    '# Code style',
    '- Do not add features, refactor, or introduce abstractions beyond what the task requires. A',
    '  one-shot operation does not need a helper; three similar lines is better than a premature',
    '  abstraction.',
    '- Do not add error handling, fallbacks, or validation for scenarios that cannot happen. Validate at',
    '  the system boundaries the task calls for (user input, external APIs).',
    '- If something is unused, delete it completely — no backwards-compatibility shims or `# removed`',
    '  markers.',
    '',
    '# Doing the task',
    '- Use the search/read tools to understand the existing code and conventions before writing. Search',
    '  in parallel where the queries are independent.',
    '- Implement the solution using the tools available to you.',
    '- Verify with tests. NEVER assume a specific test framework or script — check the project (README,',
    '  manifest, existing tests) to determine the testing approach.',
    '- VERY IMPORTANT: when you have completed the task, RUN the project lint, typecheck, and test',
    '  commands (e.g. ruff / mypy / pytest, or npm run lint / tsc / npm test) with Bash to confirm your',
    '  code is correct. Do not report success without having seen the verification pass.',
    '- Never commit changes.',
    '',
    '# Tool usage',
    '- Use dedicated tools (Read / Edit / Write) for file operations rather than bash cat / sed / echo;',
    '  reserve bash for real commands (build, test, lint).',
    '- You can call multiple tools in one response; batch independent calls so they run in parallel.',
    '- When referencing code locations, use the `file_path:line_number` pattern.',
    '',
    '# Executing actions with care',
    'Prefer editing an existing file over creating a new one, except where the task requires new files',
    'in its write scope. Report outcomes faithfully: if tests fail, say so with the output. If you find',
    'unexpected files or state, investigate before overwriting — do not use destructive shortcuts.',
  ].join('\n');
}

/**
 * The `mimocode.json` `agent` block for {@link EXECUTOR_AGENT_NAME}: a `primary`
 * coding agent whose `prompt` overrides mimo's anti-comment base prompt. Tools
 * are left to mimo's defaults (governed by the `permission` policy); the model
 * is inherited from the top-level `model` (the local provider).
 */
export function buildExecutorAgent(attended = false): Record<string, unknown> {
  return {
    [EXECUTOR_AGENT_NAME]: {
      description: 'JanumiCode Phase-9 executor — mimo default coding agent with the anti-comment rule removed (task context governs craft).',
      mode: 'primary',
      prompt: buildExecutorAgentPrompt(attended),
    },
  };
}

export function buildProjectConfig(cfg: MimoConfig, env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const config: Record<string, unknown> = buildPermissionPolicy(cfg.permissionMode, cfg.attended === true);
  const local = buildLocalProvider(cfg.model, env);
  if (local) {
    config.provider = local.provider;
    config.model = local.model;
  }
  // Always define our executor agent so the configured `agent` (default
  // EXECUTOR_AGENT_NAME) resolves; setting JANUMICODE_MIMO_AGENT=compose opts
  // back into mimo's built-in (anti-comment) agent. The agent prompt framing is
  // mode-aware (attended vs headless), consistent with the `question` policy.
  config.agent = buildExecutorAgent(cfg.attended === true);
  // Disable mimo's automatic conversation COMPACTION (config schema
  // `compaction.auto`, default true — "Enable automatic compaction when context
  // is full"). When a leaf's within-session context grows from many tool turns,
  // auto-compaction calls `tryStartCheckpointWriter`, which forks mimo's native
  // hidden `checkpoint-writer` subagent; that fork can fail with "missing
  // forkContext, failing actor" and mimo then RETRIES it ~1/sec forever, wedging
  // the leaf with zero progress (the orchestrator's idle-watchdog is 24h, so the
  // whole run hangs — observed 2026-06-27 on slice-156 leaf 15; see memory
  // project_mimo_checkpoint_writer_wedge). Disabling auto-compaction removes the
  // trigger entirely. It is also CORRECT for this executor regardless of the bug:
  // each leaf is a fresh single-task session that declares the model's full
  // context window (limit.context == loaded num_ctx), so we never want mimo
  // silently summarizing the binding task spec / Engineering Constitution away
  // mid-leaf — an over-long leaf should surface as an error (a decomposition
  // signal), not be papered over with lossy compaction. Opt back in with
  // JANUMICODE_MIMO_AUTOCOMPACT=1.
  if (env.JANUMICODE_MIMO_AUTOCOMPACT !== '1') {
    config.compaction = { auto: false };
  }
  return config;
}

/** Strip trailing `/` characters in linear time (avoids the `\/+$` ReDoS shape). */
function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.codePointAt(end - 1) === 47) end--;
  return s.slice(0, end);
}

/** Parse `mimocode server listening on http://127.0.0.1:PORT` from server stdout. */
export function parseListeningUrl(text: string): string | null {
  const m = /listening on (https?:\/\/[^\s]+)/i.exec(text);
  return m ? stripTrailingSlashes(m[1]) : null;
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
    if (existing?.proc.exitCode === null) return existing;

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
    assertNotReplayMode(`MimoServerManager.spawnServer binary=${cfg.binary}`);
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
          const taskkill = path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'taskkill.exe');
          spawn(taskkill, ['/PID', String(s.proc.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
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
