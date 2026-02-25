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

			const raw = await spawnCLIWithStdin(claudePath, args, cwd, timeout, options.stdinContent);
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
					const event = normalizeClaudeCodeStreamEvent(line);
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

			return {
				success: true,
				value: {
					response: raw.stdout,
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
	];

	if (options.model) {
		args.push('--model', options.model);
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
 * Normalize a single JSONL line from Claude Code stream-json into CLIActivityEvent.
 */
function normalizeClaudeCodeStreamEvent(line: string): CLIActivityEvent | null {
	try {
		const event = JSON.parse(line);

		// Claude Code stream-json events vary by type
		if (event.type === 'tool_use' || event.tool) {
			const toolName = event.tool || event.name || event.type;
			const isFileRead = /read/i.test(toolName);
			const isFileWrite = /write|edit|create/i.test(toolName);
			const isBash = /bash|shell|command/i.test(toolName);
			const isGlob = /glob/i.test(toolName);

			let eventType: CLIActivityEvent['eventType'] = 'tool_call';
			if (isFileRead) {
				eventType = 'file_read';
			} else if (isFileWrite) {
				eventType = 'file_write';
			} else if (isBash) {
				eventType = 'command_exec';
			}

			// Extract structured tool input
			let input: string | undefined;
			if (isBash) {
				input = event.input?.command ?? '';
			} else if (isFileRead) {
				input = event.input?.file_path ?? event.input?.path ?? '';
			} else if (isGlob) {
				input = event.input?.pattern ?? '';
			} else if (isFileWrite) {
				input = event.input?.file_path ?? event.input?.path ?? '';
			} else if (event.input) {
				input = JSON.stringify(event.input);
			}

			return {
				timestamp: new Date().toISOString(),
				eventType,
				summary: `${toolName}${event.input?.path ? `: ${event.input.path}` : ''}`,
				detail: JSON.stringify(event),
				toolName,
				filePath: event.input?.path || event.input?.file_path,
				input,
				toolUseId: event.id,
			};
		}

		if (event.type === 'tool_result') {
			// Extract readable output text
			let output: string | undefined;
			if (typeof event.content === 'string') {
				output = event.content;
			} else if (Array.isArray(event.content)) {
				output = event.content
					.filter((b: { type?: string }) => b.type === 'text')
					.map((b: { text?: string }) => b.text ?? '')
					.join('\n');
			} else if (event.output) {
				output = String(event.output);
			}

			return {
				timestamp: new Date().toISOString(),
				eventType: 'tool_result',
				summary: `Tool result: ${event.status || 'completed'}`,
				detail: JSON.stringify(event),
				status: event.error ? 'error' : 'success',
				output: output?.substring(0, 2000),
				toolUseId: event.tool_use_id,
			};
		}

		if (event.type === 'assistant' || event.role === 'assistant') {
			const content = event.content || event.text || '';
			return {
				timestamp: new Date().toISOString(),
				eventType: 'message',
				summary: typeof content === 'string' ? content.substring(0, 100) : 'Assistant message',
				detail: typeof content === 'string' ? content : JSON.stringify(content),
			};
		}

		if (event.type === 'error') {
			return {
				timestamp: new Date().toISOString(),
				eventType: 'error',
				summary: event.message || event.error || 'Unknown error',
				detail: JSON.stringify(event),
				status: 'error',
			};
		}

		// Generic event — store at Level 3 only
		return {
			timestamp: new Date().toISOString(),
			eventType: 'message',
			summary: event.type || 'Event',
			detail: JSON.stringify(event),
		};
	} catch {
		// Not valid JSON — treat as plain text message
		if (line.trim()) {
			return {
				timestamp: new Date().toISOString(),
				eventType: 'message',
				summary: line.substring(0, 100),
				detail: line,
			};
		}
		return null;
	}
}
