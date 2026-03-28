/**
 * Claude Code CLI — RoleCLIProvider Implementation
 * Wraps Claude Code CLI for use as a role execution backend.
 * Used by the Executor role for PROPOSE (read-only) and EXECUTE (write) phases.
 *
 * See: docs/Multi-CLI Integration Spec.md — Section 4.1
 */

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
import { detectClaudeCode } from '../../claudeCode/detector';
import { spawnCLIWithStdin, spawnCLIStreamingWithStdin } from '../spawnUtils';

/**
 * Claude Code CLI provider implementation of RoleCLIProvider.
 * Invokes `claude` via stdin piping with JSON or stream-JSON output.
 */
export class ClaudeCodeRoleCLIProvider implements RoleCLIProvider {
	readonly id = 'claude-code';
	readonly name = 'Claude Code';

	async detect(): Promise<Result<CLIProviderInfo>> {
		try {
			const detection = await detectClaudeCode();

			if (!detection.success) {
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

			return {
				success: true,
				value: {
					id: this.id,
					name: this.name,
					available: detection.value.installed && detection.value.compatible,
					version: detection.value.version,
					requiresApiKey: true,
					apiKeyConfigured: detection.value.apiKeyConfigured,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: new CodedError(
					'DETECTION_FAILED',
					error instanceof Error ? error.message : 'Unknown error'
				),
			};
		}
	}

	async invoke(options: RoleCLIInvocationOptions): Promise<Result<RoleCLIResult>> {
		const startTime = Date.now();

		try {
			const detection = await detectClaudeCode();
			if (!detection.success || !detection.value.installed || !detection.value.compatible) {
				return {
					success: false,
					error: new CodedError(
						'CLAUDE_CODE_NOT_AVAILABLE',
						'Claude Code CLI is not available or not compatible'
					),
				};
			}

			const claudePath = detection.value.path || 'claude';
			const cwd = options.workingDirectory
				|| vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				|| process.cwd();
			const timeout = options.timeout || 300000;
			const outputFormat = options.outputFormat || 'json';

			const args = buildArgs(outputFormat, options);

			const raw = await spawnCLIWithStdin(claudePath, args, cwd, timeout, options.stdinContent, options.signal);
			const executionTime = Date.now() - startTime;

			const parsed = parseClaudeCodeOutput(raw.stdout, outputFormat);

			return {
				success: true,
				value: {
					response: parsed.response,
					exitCode: raw.exitCode,
					executionTime,
					tokenUsage: parsed.tokenUsage,
					toolStats: parsed.toolStats,
					filesModified: parsed.filesModified,
					rawOutput: raw.stdout,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: new CodedError(
					'EXECUTION_FAILED',
					error instanceof Error ? error.message : 'Claude Code execution failed'
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
			const detection = await detectClaudeCode();
			if (!detection.success || !detection.value.installed || !detection.value.compatible) {
				return {
					success: false,
					error: new CodedError(
						'CLAUDE_CODE_NOT_AVAILABLE',
						'Claude Code CLI is not available or not compatible'
					),
				};
			}

			const claudePath = detection.value.path || 'claude';
			const cwd = options.workingDirectory
				|| vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				|| process.cwd();
			const timeout = options.timeout || 300000;

			const args = buildArgs('stream-json', options);

			const commandPreview = `${claudePath} ${args.join(' ')}`;
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'init',
				summary: `Claude Code: ${commandPreview}`,
			});

			if (options.stdinContent) {
				onEvent({
					timestamp: new Date().toISOString(),
					eventType: 'stdin',
					summary: `stdin (${options.stdinContent.length} chars)`,
					detail: options.stdinContent,
				});
			}

			const raw = await spawnCLIStreamingWithStdin(
				claudePath, args, cwd, timeout, options.stdinContent,
				(line) => {
					const events = normalizeClaudeCodeStreamEvent(line);
					for (const event of events) {
						onEvent(event);
					}
				},
				options.signal,
			);

			const executionTime = Date.now() - startTime;

			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'complete',
				summary: `Completed (exit code ${raw.exitCode})`,
				status: raw.exitCode === 0 ? 'success' : 'error',
			});

			// Surface stderr as a diagnostic event when the CLI fails
			if (raw.exitCode !== 0 && raw.stderr) {
				onEvent({
					timestamp: new Date().toISOString(),
					eventType: 'error',
					summary: 'CLI stderr output',
					detail: raw.stderr,
				});
			}

			// Use stderr as the response text when stdout is empty and CLI failed
			const responseText = raw.stdout || (raw.exitCode !== 0 ? raw.stderr : '');

			return {
				success: true,
				value: {
					response: responseText,
					exitCode: raw.exitCode,
					executionTime,
					rawOutput: raw.stdout,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: new CodedError(
					'STREAMING_EXECUTION_FAILED',
					error instanceof Error ? error.message : 'Claude Code streaming execution failed'
				),
			};
		}
	}

	getCommandPreview(options: RoleCLIInvocationOptions): Result<string> {
		const outputFormat = options.outputFormat || 'json';
		const args = buildArgs(outputFormat, options);
		return {
			success: true,
			value: `echo "<stdin>" | claude ${args.join(' ')}`,
		};
	}
}

/**
 * Build CLI arguments for Claude Code.
 * All large content goes through stdin — only short flags on the command line.
 */
function buildArgs(outputFormat: string, options: RoleCLIInvocationOptions): string[] {
	const args = [
		'-p', '-',
		'--output-format', outputFormat,
		'--no-session-persistence',
	];

	// stream-json requires --verbose when used with -p (print mode)
	if (outputFormat === 'stream-json') {
		args.push('--verbose');
	}

	if (options.model) {
		args.push('--model', options.model);
	}

	// MCP server configuration — pass config file paths to Claude Code CLI
	if (options.mcpConfigPaths && options.mcpConfigPaths.length > 0) {
		args.push('--mcp-config', ...options.mcpConfigPaths);
	}

	// Tool permission allow-list — enables non-interactive file writes etc.
	if (options.allowedTools && options.allowedTools.length > 0) {
		args.push('--allowedTools', options.allowedTools.join(','));
	}

	// MCP permission prompt tool — intercepts tool permission requests in non-interactive mode
	if (options.permissionPromptTool) {
		args.push('--permission-prompt-tool', options.permissionPromptTool);
	}

	// Structured output enforcement — validates final result against the provided JSON Schema.
	// Claude Code coerces its output to conform before returning, eliminating parse failures.
	if (options.jsonSchema) {
		args.push('--json-schema', options.jsonSchema);
	}

	return args;
}

// Process spawning delegated to shared spawnUtils (Windows-compatible, rich error diagnostics)

/**
 * Parse Claude Code JSON output into RoleCLIResult fields.
 */
function parseClaudeCodeOutput(
	stdout: string,
	outputFormat: string
): {
	response: string;
	tokenUsage?: RoleCLIResult['tokenUsage'];
	toolStats?: RoleCLIResult['toolStats'];
	filesModified?: string[];
} {
	if (outputFormat !== 'json') {
		return { response: stdout };
	}

	try {
		const parsed = JSON.parse(stdout);
		// Claude Code --output-format json wraps response in a JSON object
		return {
			response: typeof parsed.result === 'string'
				? parsed.result
				: typeof parsed.response === 'string'
					? parsed.response
					: JSON.stringify(parsed),
		};
	} catch {
		// If JSON parsing fails, return raw stdout as response
		return { response: stdout };
	}
}

/**
 * Normalize a single JSONL line from Claude Code stream-json into CLIActivityEvents.
 * Returns an array because a single assistant message may contain both text and
 * tool_use content blocks, each of which needs its own event.
 */
function normalizeClaudeCodeStreamEvent(line: string): CLIActivityEvent[] {
	try {
		const event = JSON.parse(line);

		// Assistant messages may contain both text and tool_use blocks.
		// Handle them specially to emit multiple events.
		if (event.type === 'assistant') {
			return normalizeAssistantMulti(event);
		}

		const handler = STREAM_EVENT_HANDLERS[event.type as string];
		if (handler) {
			const result = handler(event);
			return result ? [result] : [];
		}

		// tool_use events may not have type === 'tool_use' but do have .tool
		if (event.tool) { return [normalizeToolUse(event)]; }

		// Unknown event types — suppress rather than dump raw JSON
		return [];
	} catch {
		// Not valid JSON — treat as plain text message
		if (!line.trim()) { return []; }
		return [{
			timestamp: new Date().toISOString(),
			eventType: 'message',
			summary: line.substring(0, 150),
			detail: line.length > 150 ? line : undefined,
		}];
	}
}

 
type StreamEventHandler = (event: any) => CLIActivityEvent | null;

/** Dispatch table for stream-json event types. */
const STREAM_EVENT_HANDLERS: Record<string, StreamEventHandler> = {
	// Suppress system init — command header already shows CLI invocation.
	system: () => null,

	// User messages wrap tool_results. Individual tool_result events are
	// captured separately, so suppress conversation-level wrappers.
	// Exception: surface permission denials as actionable errors.
	user: (event) => {
		const blocks = event.message?.content;
		if (!Array.isArray(blocks)) { return null; }
		for (const block of blocks) {
			if (block.is_error && typeof block.content === 'string' &&
				block.content.includes('permissions')) {
				return {
					timestamp: new Date().toISOString(),
					eventType: 'error' as const,
					summary: block.content.substring(0, 120),
					status: 'error' as const,
				};
			}
		}
		return null;
	},

	// Final result — show completion text cleanly.
	result: (event) => {
		const text = typeof event.result === 'string' ? event.result : '';
		if (!text) { return null; }
		return {
			timestamp: new Date().toISOString(),
			eventType: 'message',
			summary: text.substring(0, 150),
			detail: text.length > 150 ? text : undefined,
		};
	},

	tool_use: normalizeToolUse,
	tool_result: normalizeToolResult,

	error: (event) => ({
		timestamp: new Date().toISOString(),
		eventType: 'error',
		summary: event.message || event.error || 'Unknown error',
		detail: JSON.stringify(event),
		status: 'error',
	}),
};

 
function normalizeToolUse(event: any): CLIActivityEvent {
	const toolName: string = event.tool || event.name || event.type;
	const eventType = classifyToolEventType(toolName);
	const input = extractToolInput(toolName, event.input);

	return {
		timestamp: new Date().toISOString(),
		eventType,
		summary: event.input?.path ? toolName + ': ' + event.input.path : toolName,
		detail: JSON.stringify(event),
		toolName,
		filePath: event.input?.path || event.input?.file_path,
		input,
		toolUseId: event.id,
	};
}

 
function normalizeToolResult(event: any): CLIActivityEvent {
	let output: string | undefined;
	if (typeof event.content === 'string') {
		output = event.content;
	} else if (Array.isArray(event.content)) {
		output = extractTextBlocks(event.content);
	} else if (event.output) {
		output = String(event.output);
	}

	return {
		timestamp: new Date().toISOString(),
		eventType: 'tool_result',
		summary: `Tool result: ${event.status || 'completed'}`,
		detail: JSON.stringify(event),
		status: event.error ? 'error' : 'success',
		output,
		toolUseId: event.tool_use_id,
	};
}

/**
 * Extract ALL events from an assistant message — both text and tool_use blocks.
 * Claude Code's stream-json format can embed tool_use content blocks alongside
 * text blocks in a single assistant message. We emit each as a separate event.
 */
 
function normalizeAssistantMulti(event: any): CLIActivityEvent[] {
	const msgContent = event.message?.content ?? event.content;
	const events: CLIActivityEvent[] = [];

	if (Array.isArray(msgContent)) {
		// Extract text blocks as a single message event
		const textContent = extractTextBlocks(msgContent);
		if (textContent.trim()) {
			events.push({
				timestamp: new Date().toISOString(),
				eventType: 'message',
				summary: textContent.substring(0, 150),
				detail: textContent.length > 150 ? textContent : undefined,
			});
		}

		// Extract tool_use blocks as individual tool_call events
		for (const block of msgContent) {
			if (block.type === 'tool_use') {
				events.push(normalizeToolUse({
					...block,
					tool: block.name,
					type: 'tool_use',
				}));
			}
		}
	} else {
		// Simple string or text content — just a message
		const textContent = typeof msgContent === 'string'
			? msgContent
			: typeof event.text === 'string' ? event.text : '';
		if (textContent.trim()) {
			events.push({
				timestamp: new Date().toISOString(),
				eventType: 'message',
				summary: textContent.substring(0, 150),
				detail: textContent.length > 150 ? textContent : undefined,
			});
		}
	}

	return events;
}

/** Map a tool name to its CLIActivityEvent type. */
function classifyToolEventType(toolName: string): CLIActivityEvent['eventType'] {
	if (/read/i.test(toolName)) { return 'file_read'; }
	if (/write|edit|create/i.test(toolName)) { return 'file_write'; }
	if (/bash|shell|command/i.test(toolName)) { return 'command_exec'; }
	return 'tool_call';
}

/** Extract the most meaningful input string from a tool_use event's input object. */
 
function extractToolInput(toolName: string, input: any): string | undefined {
	if (!input) { return undefined; }
	if (/bash|shell|command/i.test(toolName)) { return input.command ?? ''; }
	if (/read/i.test(toolName)) { return input.file_path ?? input.path ?? ''; }
	if (/glob/i.test(toolName)) { return input.pattern ?? ''; }
	if (/write|edit|create/i.test(toolName)) { return input.file_path ?? input.path ?? ''; }
	return JSON.stringify(input);
}

/** Join text blocks from a content array, ignoring tool_use and other block types. */
function extractTextBlocks(blocks: Array<{ type?: string; text?: string }>): string {
	return blocks
		.filter((b) => b.type === 'text')
		.map((b) => b.text ?? '')
		.join('\n');
}
