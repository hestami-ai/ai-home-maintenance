/**
 * OpenAI Codex CLI — RoleCLIProvider Implementation
 * Wraps Codex CLI for use as a role execution backend.
 * Used by the Technical Expert role with read-only sandbox enforcement.
 *
 * Invocation: stdin piped | codex exec --sandbox read-only --json --output-schema <path> -
 *
 * See: docs/Multi-CLI Integration Spec.md — Section 4.2
 * Codex CLI docs: https://developers.openai.com/codex/cli/reference
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { Result } from '../../types';
import { CodedError } from '../../types';
import type { RoleCLIProvider } from '../roleCLIProvider';
import type {
	CLIProviderInfo,
	RoleCLIInvocationOptions,
	RoleCLIResult,
	CLIActivityEvent,
} from '../types';
import { spawnCLIWithStdin, spawnCLIStreamingWithStdin } from '../spawnUtils';

const execAsync = promisify(exec);

/**
 * OpenAI Codex CLI provider implementation of RoleCLIProvider.
 * Invokes `codex exec` via stdin piping with JSON output and read-only sandbox.
 */
export class CodexCLIProvider implements RoleCLIProvider {
	readonly id = 'codex-cli';
	readonly name = 'Codex CLI';

	async detect(): Promise<Result<CLIProviderInfo>> {
		try {
			const { version, available } = await detectCodexCli();
			const apiKeyConfigured = checkCodexApiKey();

			return {
				success: true,
				value: {
					id: this.id,
					name: this.name,
					available,
					version,
					requiresApiKey: true,
					apiKeyConfigured,
				},
			};
		} catch (_error) {
			return {
				success: true,
				value: {
					id: this.id,
					name: this.name,
					available: false,
					requiresApiKey: true,
					apiKeyConfigured: false,
				},
			};
		}
	}

	async invoke(options: RoleCLIInvocationOptions): Promise<Result<RoleCLIResult>> {
		const startTime = Date.now();

		try {
			const codexPath = await resolveCodexPath();
			const cwd = options.workingDirectory
				|| vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				|| process.cwd();
			const timeout = options.timeout || 300000;

			const args = buildCodexArgs(options);
			const raw = await spawnCLIWithStdin(codexPath, args, cwd, timeout, options.stdinContent);
			const executionTime = Date.now() - startTime;

			const parsed = parseCodexOutput(raw.stdout);

			return {
				success: true,
				value: {
					response: parsed.response,
					exitCode: raw.exitCode,
					executionTime,
					tokenUsage: parsed.tokenUsage,
					toolStats: parsed.toolStats,
					rawOutput: raw.stdout,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: new CodedError(
					'CODEX_EXECUTION_FAILED',
					error instanceof Error ? error.message : 'Codex CLI execution failed'
				),
			};
		}
	}

	async invokeStreaming(
		options: RoleCLIInvocationOptions,
		onEvent: (event: CLIActivityEvent) => void
	): Promise<Result<RoleCLIResult>> {
		const startTime = Date.now();

		try {
			const codexPath = await resolveCodexPath();
			const cwd = options.workingDirectory
				|| vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				|| process.cwd();
			const timeout = options.timeout || 300000;

			// Codex exec always uses --json for JSONL streaming
			const args = buildCodexArgs(options);

			// Emit init event with the full CLI command for observability
			const commandPreview = `${codexPath} ${args.join(' ')}`;
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'init',
				summary: `Codex CLI: ${commandPreview}`,
			});

			// Emit stdin content as a collapsible block for full observability
			if (options.stdinContent) {
				onEvent({
					timestamp: new Date().toISOString(),
					eventType: 'stdin',
					summary: `stdin (${options.stdinContent.length} chars)`,
					detail: options.stdinContent,
				});
			}

			const raw = await spawnCLIStreamingWithStdin(
				codexPath, args, cwd, timeout, options.stdinContent,
				(line) => {
					const event = normalizeCodexStreamEvent(line);
					if (event) {
						onEvent(event);
					}
				}
			);

			const executionTime = Date.now() - startTime;

			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'complete',
				summary: `Completed (exit code ${raw.exitCode})`,
				status: raw.exitCode === 0 ? 'success' : 'error',
			});

			// Extract final response from the accumulated JSONL output
			const parsed = parseCodexOutput(raw.stdout);

			return {
				success: true,
				value: {
					response: parsed.response,
					exitCode: raw.exitCode,
					executionTime,
					tokenUsage: parsed.tokenUsage,
					rawOutput: raw.stdout,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: new CodedError(
					'CODEX_STREAMING_FAILED',
					error instanceof Error ? error.message : 'Codex CLI streaming failed'
				),
			};
		}
	}

	getCommandPreview(options: RoleCLIInvocationOptions): Result<string> {
		const args = buildCodexArgs(options);
		return {
			success: true,
			value: `echo "<stdin>" | codex ${args.join(' ')}`,
		};
	}
}

// ==================== Detection ====================

async function detectCodexCli(): Promise<{ version?: string; available: boolean }> {
	try {
		const { stdout } = await execAsync('codex --version');
		const match = /(\d+\.\d+\.\d+)/.exec(stdout.trim());
		return {
			version: match ? match[1] : stdout.trim(),
			available: true,
		};
	} catch {
		return { available: false };
	}
}

function checkCodexApiKey(): boolean {
	return !!(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY);
}

async function resolveCodexPath(): Promise<string> {
	const config = vscode.workspace.getConfiguration('janumicode.cli.providers.codexCli');
	const customPath = config.get<string>('path');
	if (customPath) {
		return customPath;
	}
	return 'codex';
}

// ==================== Argument Building ====================

/**
 * Build CLI arguments for Codex exec.
 * Key flags:
 *   --sandbox read-only  — OS-level read-only enforcement
 *   --json               — JSONL event output
 *   --output-schema      — JSON Schema validation for structured output
 *   -                    — Read prompt from stdin
 */
function buildCodexArgs(options: RoleCLIInvocationOptions): string[] {
	const args = ['exec'];

	// Sandbox mode — defaults to read-only for safety
	const sandbox = options.sandboxMode || 'read-only';
	args.push('--sandbox', sandbox);

	// JSON output for structured/streaming events
	args.push('--json');

	// Output schema for structured output validation (Codex-specific feature)
	if (options.outputSchemaPath) {
		args.push('--output-schema', options.outputSchemaPath);
	}

	if (options.model) {
		args.push('--model', options.model);
	}

	if (options.workingDirectory) {
		args.push('--cd', options.workingDirectory);
	}

	// Full auto mode for unattended execution
	if (options.autoApprove) {
		args.push('--full-auto');
	}

	// Read prompt from stdin
	args.push('-');

	return args;
}

// Process spawning delegated to shared spawnUtils (Windows-compatible, rich error diagnostics)

// ==================== Output Parsing ====================

/**
 * Parse Codex CLI JSONL output.
 * Codex --json emits newline-delimited JSON events.
 * The final assistant message contains the response.
 */
function parseCodexOutput(stdout: string): {
	response: string;
	tokenUsage?: RoleCLIResult['tokenUsage'];
	toolStats?: RoleCLIResult['toolStats'];
} {
	const lines = stdout.split('\n').filter((l) => l.trim());
	let lastMessage = '';
	let totalToolCalls = 0;
	let totalSuccess = 0;
	let totalFail = 0;
	let tokenUsage: RoleCLIResult['tokenUsage'] | undefined;

	for (const line of lines) {
		try {
			const event = JSON.parse(line);

			// Track the last assistant message as the response
			if (event.role === 'assistant' && event.content) {
				lastMessage = event.content;
			} else if (event.type === 'message' && event.role === 'assistant') {
				lastMessage = event.content || lastMessage;
			}

			// Handle Codex Responses API format: item.completed with agent_message
			if (event.type === 'item.completed' && event.item) {
				if (event.item.type === 'agent_message' && event.item.text) {
					lastMessage = event.item.text;
				}
				// Track command executions as tool calls
				if (event.item.type === 'command_execution') {
					totalToolCalls++;
					if (event.item.exit_code === 0 || event.item.exit_code === undefined) {
						totalSuccess++;
					} else {
						totalFail++;
					}
				}
			}

			// Track tool stats (legacy format)
			if (event.type === 'tool_call' || event.type === 'function_call') {
				totalToolCalls++;
			}
			if (event.type === 'tool_result' || event.type === 'function_result') {
				if (event.error) {
					totalFail++;
				} else {
					totalSuccess++;
				}
			}

			// Final result event may contain the response
			if (event.type === 'result' && event.response) {
				lastMessage = event.response;
			}

			// Extract token usage from turn.completed events
			if (event.type === 'turn.completed' && event.usage) {
				tokenUsage = {
					inputTokens: event.usage.input_tokens ?? 0,
					outputTokens: event.usage.output_tokens ?? 0,
					totalTokens: (event.usage.input_tokens ?? 0) + (event.usage.output_tokens ?? 0),
				};
			}
		} catch {
			// Skip non-JSON lines
		}
	}

	const result: ReturnType<typeof parseCodexOutput> = {
		response: lastMessage || stdout,
	};

	if (tokenUsage) {
		result.tokenUsage = tokenUsage;
	}

	if (totalToolCalls > 0) {
		result.toolStats = {
			totalCalls: totalToolCalls,
			totalSuccess,
			totalFail,
		};
	}

	return result;
}

// ==================== Stream Event Normalization ====================

/**
 * Normalize a single JSONL line from Codex --json output.
 *
 * Codex CLI emits Responses-API-style events:
 *   item.created  { item: { type: 'function_call' | 'command_execution', ... } }
 *   item.completed { item: { type: 'function_call' | 'command_execution' | 'function_call_output' | 'agent_message', ... } }
 *   turn.completed { usage: ... }
 *
 * Legacy flat events (tool_call / tool_result) are also handled for backwards compat.
 */
function normalizeCodexStreamEvent(line: string): CLIActivityEvent | null {
	try {
		const event = JSON.parse(line);

		// ── Responses API format: item.created ──
		if (event.type === 'item.created' && event.item) {
			return normalizeCodexItemCreated(event);
		}

		// ── Responses API format: item.completed ──
		if (event.type === 'item.completed' && event.item) {
			return normalizeCodexItemCompleted(event);
		}

		// ── Responses API format: item.input_completed (arguments finalized) ──
		if (event.type === 'item.input_completed' && event.item) {
			return normalizeCodexItemCreated(event); // treat same as created with full args
		}

		// ── Legacy: flat tool_call / function_call ──
		if (event.type === 'tool_call' || event.type === 'function_call') {
			return normalizeLegacyToolCall(event);
		}

		// ── Legacy: flat tool_result / function_result ──
		if (event.type === 'tool_result' || event.type === 'function_result') {
			return normalizeLegacyToolResult(event);
		}

		// ── Assistant messages ──
		if (event.role === 'assistant' || (event.type === 'message' && event.role === 'assistant')) {
			const content = event.content || '';
			return {
				timestamp: new Date().toISOString(),
				eventType: 'message',
				summary: String(content).substring(0, 100),
				detail: String(content),
			};
		}

		// ── Turn completed (token usage — log as message) ──
		if (event.type === 'turn.completed' && event.usage) {
			const input = event.usage.input_tokens ?? 0;
			const output = event.usage.output_tokens ?? 0;
			return {
				timestamp: new Date().toISOString(),
				eventType: 'message',
				summary: `Turn completed (${input + output} tokens)`,
			};
		}

		// ── Error events ──
		if (event.type === 'error') {
			return {
				timestamp: new Date().toISOString(),
				eventType: 'error',
				summary: event.message || 'Unknown error',
				detail: JSON.stringify(event),
				status: 'error',
			};
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Handle Codex Responses API item.created / item.input_completed events.
 * These signal a tool call starting (function_call or command_execution).
 */
function normalizeCodexItemCreated(event: Record<string, unknown>): CLIActivityEvent | null {
	const item = event.item as Record<string, unknown>;
	if (!item) { return null; }

	const itemType = item.type as string;

	// function_call item → tool_call card
	if (itemType === 'function_call') {
		const toolName = (item.name as string) || 'tool';
		const eventType = classifyCodexToolEvent(toolName);
		const args = item.arguments as string | undefined;
		const input = extractInputFromArgs(args, toolName);

		return {
			timestamp: new Date().toISOString(),
			eventType,
			summary: toolName,
			detail: JSON.stringify(event),
			toolName,
			input,
			toolUseId: (item.call_id as string) || (item.id as string),
		};
	}

	// command_execution item → command_exec card
	if (itemType === 'command_execution') {
		const command = (item.command as string) || '';
		return {
			timestamp: new Date().toISOString(),
			eventType: 'command_exec',
			summary: 'shell',
			detail: JSON.stringify(event),
			toolName: 'shell',
			input: command || undefined,
			toolUseId: (item.call_id as string) || (item.id as string),
		};
	}

	return null;
}

/**
 * Handle Codex Responses API item.completed events.
 * These signal a tool result, message, or command output.
 */
function normalizeCodexItemCompleted(event: Record<string, unknown>): CLIActivityEvent | null {
	const item = event.item as Record<string, unknown>;
	if (!item) { return null; }

	const itemType = item.type as string;

	// agent_message → assistant message
	if (itemType === 'agent_message') {
		const text = (item.text as string) || '';
		return {
			timestamp: new Date().toISOString(),
			eventType: 'message',
			summary: text.substring(0, 100),
			detail: text,
		};
	}

	// command_execution completed → tool_result (include command as input for standalone cards)
	if (itemType === 'command_execution') {
		const command = (item.command as string) || '';
		const output = (item.output as string) ?? '';
		const exitCode = item.exit_code as number | undefined;
		const isError = exitCode !== undefined && exitCode !== 0;
		return {
			timestamp: new Date().toISOString(),
			eventType: 'tool_result',
			summary: isError ? `Command failed (exit ${exitCode})` : 'Command completed',
			detail: JSON.stringify(event),
			status: isError ? 'error' : 'success',
			output: output || undefined,
			toolName: 'shell',
			input: command || undefined,
			toolUseId: (item.call_id as string) || (item.id as string),
		};
	}

	// function_call_output → tool_result (include tool name from item)
	if (itemType === 'function_call_output') {
		const output = (item.output as string) ?? '';
		return {
			timestamp: new Date().toISOString(),
			eventType: 'tool_result',
			summary: 'Tool completed',
			detail: JSON.stringify(event),
			status: 'success',
			output: output || undefined,
			toolName: (item.name as string) || undefined,
			toolUseId: (item.call_id as string) || (item.id as string),
		};
	}

	// function_call completed (arguments finalized, but no output yet) — emit as tool_call
	if (itemType === 'function_call') {
		const toolName = (item.name as string) || 'tool';
		const eventType = classifyCodexToolEvent(toolName);
		const args = item.arguments as string | undefined;
		const input = extractInputFromArgs(args, toolName);

		return {
			timestamp: new Date().toISOString(),
			eventType,
			summary: toolName,
			detail: JSON.stringify(event),
			toolName,
			input,
			toolUseId: (item.call_id as string) || (item.id as string),
		};
	}

	return null;
}

/**
 * Extract a human-readable input string from tool arguments.
 */
function extractInputFromArgs(args: string | Record<string, unknown> | undefined, toolName: string): string | undefined {
	if (!args) { return undefined; }

	// String arguments — try to parse as JSON for structured extraction
	if (typeof args === 'string') {
		try {
			const parsed = JSON.parse(args) as Record<string, unknown>;
			return extractInputFromArgs(parsed, toolName);
		} catch {
			return args;
		}
	}

	// Object arguments — extract the most relevant string field
	if (typeof args.command === 'string') { return args.command; }
	if (typeof args.path === 'string') { return args.path; }
	if (typeof args.file_path === 'string') { return args.file_path; }
	if (typeof args.pattern === 'string') { return args.pattern; }
	if (typeof args.query === 'string') { return args.query; }
	return JSON.stringify(args);
}

/**
 * Normalize legacy flat tool_call / function_call events.
 */
function normalizeLegacyToolCall(event: Record<string, unknown>): CLIActivityEvent {
	const fn = event.function as Record<string, unknown> | undefined;
	const toolName = (event.name as string) || (fn?.name as string) || 'tool';
	const eventType = classifyCodexToolEvent(toolName);

	const args = event.input || event.arguments || fn?.arguments;
	const input = extractInputFromArgs(args as string | Record<string, unknown> | undefined, toolName);

	return {
		timestamp: new Date().toISOString(),
		eventType,
		summary: toolName,
		detail: JSON.stringify(event),
		toolName,
		input,
		toolUseId: (event.id as string) || (event.call_id as string),
	};
}

/**
 * Normalize legacy flat tool_result / function_result events.
 */
function normalizeLegacyToolResult(event: Record<string, unknown>): CLIActivityEvent {
	const output = (event.output ?? event.result) as string | undefined;
	const errorMsg = event.error ? String(event.error) : undefined;
	return {
		timestamp: new Date().toISOString(),
		eventType: 'tool_result',
		summary: errorMsg ? `Tool error: ${errorMsg}` : 'Tool completed',
		detail: JSON.stringify(event),
		status: errorMsg ? 'error' : 'success',
		output: output ? String(output) : undefined,
		toolUseId: (event.tool_use_id as string) || (event.call_id as string),
	};
}

/**
 * Classify a Codex tool name into a CLIActivityEventType.
 */
function classifyCodexToolEvent(toolName: string): CLIActivityEvent['eventType'] {
	const lower = toolName.toLowerCase();
	if (lower.includes('read') || lower.includes('cat') || lower.includes('view')) {
		return 'file_read';
	}
	if (lower.includes('write') || lower.includes('edit') || lower.includes('create') || lower.includes('patch')) {
		return 'file_write';
	}
	if (lower.includes('bash') || lower.includes('shell') || lower.includes('exec') || lower.includes('command')) {
		return 'command_exec';
	}
	return 'tool_call';
}
