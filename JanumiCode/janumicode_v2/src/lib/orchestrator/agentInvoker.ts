/**
 * AgentInvoker — routes invocations to CLIInvoker or LLMCaller.
 * Based on JanumiCode Spec v2.3, §7.8.
 *
 * CLI-backed agents: spawns child process via CLIInvoker.
 * Direct LLM API agents: calls LLMCaller directly.
 */

import { CLIInvoker, type CLIInvocationResult } from '../cli/cliInvoker';
import { type OutputParser } from '../cli/outputParser';
import { LLMCaller, type LLMCallOptions, type LLMCallResult } from '../llm/llmCaller';

// ── Types ───────────────────────────────────────────────────────────

export type BackingTool = 'claude_code_cli' | 'gemini_cli' | 'codex_cli' | 'direct_llm_api';

export interface AgentInvocationOptions {
  /** Agent role name */
  agentRole: string;
  /** Backing tool type */
  backingTool: BackingTool;
  /** Invocation ID for tracking */
  invocationId: string;
  /** Stdin content (CLI agents) or prompt (LLM API agents) */
  prompt: string;
  /** System prompt (LLM API agents) */
  system?: string;
  /** Working directory (CLI agents) */
  cwd: string;
  /** Environment variables (CLI agents) */
  env?: Record<string, string>;
  /** LLM provider (direct_llm_api only) */
  provider?: string;
  /** LLM model (direct_llm_api only) */
  model?: string;
  /** Response format */
  responseFormat?: 'json' | 'text';
  /** Temperature */
  temperature?: number;
}

export interface AgentInvocationResult {
  /** Whether the invocation succeeded */
  success: boolean;
  /** CLI result (CLI-backed agents) */
  cliResult?: CLIInvocationResult;
  /** LLM result (direct LLM API agents) */
  llmResult?: LLMCallResult;
  /** Error message if failed */
  error?: string;
}

// ── AgentInvoker ────────────────────────────────────────────────────

export class AgentInvoker {
  private cliInvoker = new CLIInvoker();
  private outputParsers = new Map<string, OutputParser>();

  constructor(
    private readonly llmCaller: LLMCaller,
    private readonly cliConfig: {
      timeoutSeconds: number;
      idleTimeoutSeconds: number;
      bufferMaxEvents: number;
    },
  ) {}

  /**
   * Register an output parser for a backing tool.
   */
  registerOutputParser(backingTool: string, parser: OutputParser): void {
    this.outputParsers.set(backingTool, parser);
  }

  /**
   * Invoke an agent.
   */
  async invoke(options: AgentInvocationOptions): Promise<AgentInvocationResult> {
    if (options.backingTool === 'direct_llm_api') {
      return this.invokeLLM(options);
    }
    return this.invokeCLI(options);
  }

  private async invokeCLI(options: AgentInvocationOptions): Promise<AgentInvocationResult> {
    const parser = this.outputParsers.get(options.backingTool);
    if (!parser) {
      return {
        success: false,
        error: `No output parser registered for backing tool: ${options.backingTool}`,
      };
    }

    parser.reset();

    const { command, args } = this.buildCLICommand(options);

    try {
      const result = await this.cliInvoker.invoke({
        command,
        args,
        stdinContent: options.prompt,
        cwd: options.cwd,
        env: options.env,
        timeoutSeconds: this.cliConfig.timeoutSeconds,
        idleTimeoutSeconds: this.cliConfig.idleTimeoutSeconds,
        bufferMaxEvents: this.cliConfig.bufferMaxEvents,
        outputParser: parser,
      });

      return {
        success: result.exitCode === 0 && !result.timedOut,
        cliResult: result,
        error: result.timedOut
          ? 'Process timed out'
          : result.idledOut
          ? 'Process idle timeout'
          : result.exitCode !== 0
          ? `Process exited with code ${result.exitCode}`
          : undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async invokeLLM(options: AgentInvocationOptions): Promise<AgentInvocationResult> {
    if (!options.provider || !options.model) {
      return {
        success: false,
        error: 'direct_llm_api requires provider and model',
      };
    }

    try {
      const callOptions: LLMCallOptions = {
        provider: options.provider,
        model: options.model,
        system: options.system,
        prompt: options.prompt,
        responseFormat: options.responseFormat,
        temperature: options.temperature,
      };

      const result = await this.llmCaller.call(callOptions);
      return { success: true, llmResult: result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private buildCLICommand(options: AgentInvocationOptions): { command: string; args: string[] } {
    switch (options.backingTool) {
      case 'claude_code_cli':
        return {
          command: 'claude',
          args: ['-p', options.prompt, '--output-format', 'stream-json'],
        };
      case 'gemini_cli':
        return {
          command: 'gemini',
          args: ['--prompt', options.prompt, '--format', 'json'],
        };
      case 'codex_cli':
        return {
          command: 'codex',
          args: ['-q', options.prompt],
        };
      default:
        throw new Error(`Unknown backing tool: ${options.backingTool}`);
    }
  }
}
