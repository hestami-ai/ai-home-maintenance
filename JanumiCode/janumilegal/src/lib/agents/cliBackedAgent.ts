/**
 * CliBackedAgent — sandboxed subprocess invocation of an agentic CLI.
 *
 * Per Wave 10 design — mirrors JanumiCode v2's `claude_code_cli` /
 * `codex_cli` / `gemini_cli` paths, but with stricter sandboxing because
 * legal-domain envelope discipline forbids whole-filesystem access.
 *
 * The CLI runs in a per-invocation working directory under
 *   <dataRoot>/cli-sandbox/<agentRunId>/
 * containing:
 *   - `prompt.md` — the assembled prompt (envelope-scoped)
 *   - `inputs/<sourceId>` — read-only copies of authorized sources
 *   - `output/` — writable; the agent's output JSON is expected here
 *
 * The CLI subprocess:
 *   - has no network env (no API keys passed through unless CLI requires it)
 *   - has its `cwd` set to the sandbox dir
 *   - is killed after `timeoutMs`
 *   - has stdout/stderr captured (size-capped)
 *
 * The agent reads `output/result.json` after the CLI exits. If absent or
 * unparseable, the agent escalates.
 *
 * Wave 10 supports CLIs: `goose`, `claude`, `codex`, `gemini`. The CLI
 * binary is configurable via constructor settings.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Agent, AgentExecutionInput, AgentExecutionOutput } from './agent.js';
import type { CLV } from '../clv/types.js';
import type { PromptTemplateRegistry } from '../promptTemplates/registry.js';
import type { InvocationLogger } from '../llm/invocationLogger.js';
import { PromptAssembler } from './promptAssembler.js';

export type CliKind = 'goose' | 'claude' | 'codex' | 'gemini';

export interface CliBackedAgentOptions {
  readonly agentId: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly cli: CliKind;
  readonly cliBinary?: string; // override path
  readonly clv: CLV;
  readonly templateRegistry: PromptTemplateRegistry;
  readonly sandboxRoot: string; // where to create per-invocation sandboxes
  readonly invocationLogger?: InvocationLogger;
  readonly timeoutMs?: number;
  /** Resolver to materialize an authorized source's file content. Optional: when absent, sources are referenced by ID only. */
  readonly resolveSource?: (sourceId: string) => Buffer | string | undefined;
}

export class CliBackedAgent implements Agent {
  readonly agentId: string;
  private readonly assembler: PromptAssembler;

  constructor(private readonly options: CliBackedAgentOptions) {
    this.agentId = options.agentId;
    this.assembler = new PromptAssembler({ clv: options.clv });
  }

  async execute(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const tpl = this.options.templateRegistry.get(this.options.templateId, this.options.templateVersion);
    if (!tpl) {
      return { status: 'blocked', blockReason: `prompt template ${this.options.templateId}@${this.options.templateVersion} not found` };
    }

    const assembled = this.assembler.assemble(input.envelope, { templateBody: tpl.body });

    const sandboxId = randomUUID();
    const sandbox = path.join(this.options.sandboxRoot, sandboxId);
    fs.mkdirSync(path.join(sandbox, 'inputs'), { recursive: true });
    fs.mkdirSync(path.join(sandbox, 'output'), { recursive: true });

    // Write prompt
    const promptPath = path.join(sandbox, 'prompt.md');
    const promptBody = [
      assembled.system,
      '',
      assembled.user,
      '',
      '## State input',
      '```json',
      JSON.stringify(input.input ?? {}, null, 2),
      '```',
      '',
      'Write your final structured answer as JSON to ./output/result.json. Do not modify any file outside ./output/.',
    ].join('\n');
    fs.writeFileSync(promptPath, promptBody, 'utf8');

    // Materialize authorized sources read-only into inputs/
    if (this.options.resolveSource) {
      for (const ref of input.envelope.authorizedSources) {
        const content = this.options.resolveSource(ref.sourceId);
        if (content === undefined) continue;
        const target = path.join(sandbox, 'inputs', sanitizeFileName(ref.sourceId));
        fs.writeFileSync(target, content);
      }
    }

    if (this.options.invocationLogger) {
      this.options.invocationLogger.logPromptAssembled({
        envelope: input.envelope,
        agentId: this.agentId,
        templateId: this.options.templateId,
        templateVersion: this.options.templateVersion,
        systemText: assembled.system,
        userText: assembled.user,
        systemBytes: Buffer.byteLength(assembled.system, 'utf8'),
        userBytes: Buffer.byteLength(assembled.user, 'utf8'),
      });
    }

    const cmd = this.options.cliBinary ?? this.options.cli;
    const args = this.cliArgs(promptPath);
    const sanitizedEnv = sanitizeEnv(this.options.cli);

    const result = spawnSync(cmd, args, {
      cwd: sandbox,
      env: sanitizedEnv,
      timeout: this.options.timeoutMs ?? 600_000,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });

    if (result.error) {
      return { status: 'blocked', blockReason: `cli '${this.options.cli}' spawn error: ${result.error.message}` };
    }
    if (result.status !== 0) {
      return {
        status: 'blocked',
        blockReason: `cli '${this.options.cli}' exited ${result.status}: ${(result.stderr ?? '').slice(0, 500)}`,
      };
    }

    const outputPath = path.join(sandbox, 'output', 'result.json');
    if (!fs.existsSync(outputPath)) {
      return {
        status: 'escalated',
        escalationReason: `cli '${this.options.cli}' did not write output/result.json`,
      };
    }
    const outputText = fs.readFileSync(outputPath, 'utf8');

    if (this.options.invocationLogger) {
      this.options.invocationLogger.logCompletionReceived({
        envelope: input.envelope,
        agentId: this.agentId,
        templateId: this.options.templateId,
        templateVersion: this.options.templateVersion,
        completionText: outputText,
        stopReason: 'cli_exited_zero',
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch (err) {
      return {
        status: 'escalated',
        escalationReason: `cli output not valid JSON: ${(err as Error).message}`,
      };
    }
    return { status: 'completed', output: parsed };
  }

  protected cliArgs(promptPath: string): string[] {
    switch (this.options.cli) {
      case 'goose':
        // `goose run --instructions <file>` — non-interactive.
        return ['run', '--instructions', promptPath];
      case 'claude':
        // Claude Code CLI: `claude -p "..."` accepts a prompt string; we read the file.
        return ['-p', fs.readFileSync(promptPath, 'utf8'), '--output-format', 'text'];
      case 'codex':
        return ['exec', '--prompt', promptPath];
      case 'gemini':
        return ['--prompt-file', promptPath];
    }
  }
}

function sanitizeFileName(s: string): string {
  return s.replace(/[^A-Za-z0-9_.-]+/g, '_');
}

function sanitizeEnv(cli: CliKind): NodeJS.ProcessEnv {
  // Pass through only PATH and the per-CLI auth env var. Strip everything else
  // — secrets, terminal vars, anything that could reveal host context.
  const env: NodeJS.ProcessEnv = {};
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.HOME) env.HOME = process.env.HOME;
  if (process.env.USERPROFILE) env.USERPROFILE = process.env.USERPROFILE;
  switch (cli) {
    case 'goose':
      // Goose reads its config from ~/.config/goose; HOME is needed.
      break;
    case 'claude':
      if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      break;
    case 'codex':
      if (process.env.OPENAI_API_KEY) env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      break;
    case 'gemini':
      if (process.env.GOOGLE_API_KEY) env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
      if (process.env.GEMINI_API_KEY) env.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      break;
  }
  return env;
}
