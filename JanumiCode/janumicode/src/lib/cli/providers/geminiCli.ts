/**
 * Gemini CLI — RoleCLIProvider Implementation
 * Wraps Google Gemini CLI for use as a role execution backend.
 * Used by the Verifier and Historian-Interpreter roles.
 *
 * Invocation: stdin piped | gemini --output-format json --include-directories <dirs>
 * Streaming:  stdin piped | gemini --output-format stream-json --include-directories <dirs>
 *
 * See: docs/Multi-CLI Integration Spec.md — Sections 4.3, 4.4
 * Gemini CLI docs: https://geminicli.com/docs/cli/headless/
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
 * Google Gemini CLI provider implementation of RoleCLIProvider.
 * Invokes `gemini` via stdin piping with JSON or stream-JSON output.
 */
export class GeminiCLIProvider implements RoleCLIProvider {
	readonly id = 'gemini-cli';
	readonly name = 'Gemini CLI';

	async detect(): Promise<Result<CLIProviderInfo>> {
		try {
			const { version, available } = await detectGeminiCli();
			const apiKeyConfigured = await checkGeminiApiKey();

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
			const geminiPath = await resolveGeminiPath();
			const cwd = options.workingDirectory
				|| vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				|| process.cwd();
			const timeout = options.timeout || 300000;
			const outputFormat = options.outputFormat || 'json';

			const args = buildGeminiArgs(outputFormat, options);
			const raw = await spawnCLIWithStdin(geminiPath, args, cwd, timeout, options.stdinContent, options.signal);
			const executionTime = Date.now() - startTime;

			const parsed = parseGeminiOutput(raw.stdout, outputFormat);

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
					'GEMINI_EXECUTION_FAILED',
					error instanceof Error ? error.message : 'Gemini CLI execution failed'
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
			const geminiPath = await resolveGeminiPath();
			const cwd = options.workingDirectory
				|| vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				|| process.cwd();
			const timeout = options.timeout || 300000;

			const args = buildGeminiArgs('stream-json', options);

			const commandPreview = `${geminiPath} ${args.join(' ')}`;
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'init',
				summary: `Gemini CLI: ${commandPreview}`,
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
				geminiPath, args, cwd, timeout, options.stdinContent,
				(line) => {
					const event = normalizeGeminiStreamEvent(line);
					if (event) {
						onEvent(event);
					}
				},
				options.signal,
			);

			const executionTime = Date.now() - startTime;
			const stderrText = raw.stderr?.trim() || '';

			// Surface stderr as a diagnostic event when the CLI fails
			if (raw.exitCode !== 0 && stderrText) {
				onEvent({
					timestamp: new Date().toISOString(),
					eventType: 'error',
					summary: 'CLI stderr output',
					detail: stderrText,
					status: 'error',
				});
			}

			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'complete',
				summary: `Completed (exit code ${raw.exitCode})` + (stderrText && raw.exitCode !== 0 ? ` — ${stderrText.substring(0, 200)}` : ''),
				status: raw.exitCode === 0 ? 'success' : 'error',
			});

			// Use stderr as response text when stdout is empty and CLI failed
			const responseText = raw.stdout || (raw.exitCode !== 0 ? stderrText : '');

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
					'GEMINI_STREAMING_FAILED',
					error instanceof Error ? error.message : 'Gemini CLI streaming failed'
				),
			};
		}
	}

	getCommandPreview(options: RoleCLIInvocationOptions): Result<string> {
		const outputFormat = options.outputFormat || 'json';
		const args = buildGeminiArgs(outputFormat, options);
		return {
			success: true,
			value: `echo "<stdin>" | gemini ${args.join(' ')}`,
		};
	}
}

// ==================== Detection ====================

async function detectGeminiCli(): Promise<{ version?: string; available: boolean }> {
	try {
		const { stdout } = await execAsync('gemini --version');
		const match = /(\d+\.\d+\.\d+)/.exec(stdout.trim());
		return {
			version: match ? match[1] : stdout.trim(),
			available: true,
		};
	} catch {
		return { available: false };
	}
}

async function checkGeminiApiKey(): Promise<boolean> {
	if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
		return true;
	}
	// Google Cloud default credentials may also suffice
	if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		return true;
	}
	return false;
}

async function resolveGeminiPath(): Promise<string> {
	const config = vscode.workspace.getConfiguration('janumicode.cli.providers.geminiCli');
	const customPath = config.get<string>('path');
	if (customPath) {
		return customPath;
	}
	return 'gemini';
}

// ==================== Argument Building ====================

function buildGeminiArgs(outputFormat: string, options: RoleCLIInvocationOptions): string[] {
	const args = [
		'--output-format', outputFormat,
	];

	if (options.includedDirectories && options.includedDirectories.length > 0) {
		args.push('--include-directories', options.includedDirectories.join(','));
	}

	// Model: explicit option > VS Code setting > Gemini CLI default
	const model = options.model
		|| vscode.workspace.getConfiguration('janumicode').get<string>('cli.gemini.model', '')
		|| '';
	if (model) {
		args.push('--model', model);
	}

	// Gemini CLI requires --approval-mode and --yolo to be mutually exclusive.
	// Use --approval-mode=yolo to auto-approve all, or --approval-mode plan for read-only sandbox.
	if (options.autoApprove) {
		args.push('--approval-mode', 'yolo');
	} else if (options.sandboxMode === 'read-only') {
		args.push('--approval-mode', 'plan');
	}

	return args;
}

// Process spawning delegated to shared spawnUtils (Windows-compatible, rich error diagnostics)

// ==================== Output Parsing ====================

/**
 * Parse Gemini CLI JSON output.
 * Gemini --output-format json returns: { response, stats, error }
 */
function parseGeminiOutput(
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

		const result: ReturnType<typeof parseGeminiOutput> = {
			response: parsed.response || '',
		};

		// Extract token usage from stats.models
		if (parsed.stats?.models) {
			let totalInput = 0;
			let totalOutput = 0;
			let totalTokens = 0;
			for (const modelStats of Object.values(parsed.stats.models) as Record<string, any>[]) {
				totalInput += modelStats.tokens?.prompt || 0;
				totalOutput += modelStats.tokens?.candidates || 0;
				totalTokens += modelStats.tokens?.total || 0;
			}
			result.tokenUsage = {
				inputTokens: totalInput,
				outputTokens: totalOutput,
				totalTokens,
			};
		}

		// Extract tool stats
		if (parsed.stats?.tools) {
			result.toolStats = {
				totalCalls: parsed.stats.tools.totalCalls || 0,
				totalSuccess: parsed.stats.tools.totalSuccess || 0,
				totalFail: parsed.stats.tools.totalFail || 0,
			};
		}

		// Extract file modifications
		if (parsed.stats?.files) {
			const added = parsed.stats.files.totalLinesAdded || 0;
			const removed = parsed.stats.files.totalLinesRemoved || 0;
			if (added > 0 || removed > 0) {
				result.filesModified = [`${added} lines added, ${removed} lines removed`];
			}
		}

		return result;
	} catch {
		return { response: stdout };
	}
}

// ==================== Stream Event Normalization ====================

/**
 * Normalize a single JSONL line from Gemini stream-json.
 * Gemini emits event types: init, message, tool_use, tool_result, error, result
 */
function normalizeGeminiStreamEvent(line: string): CLIActivityEvent | null {
	try {
		const event = JSON.parse(line);

		switch (event.type) {
			case 'init':
				return {
					timestamp: event.timestamp || new Date().toISOString(),
					eventType: 'init',
					summary: `Gemini session started (model: ${event.model || 'default'})`,
					detail: JSON.stringify(event),
				};

			case 'tool_use': {
				const toolName = event.tool_name || 'unknown';
				const eventType = classifyToolEvent(toolName);
				const pathInfo = event.parameters?.command || event.parameters?.path || '';
				const suffix = pathInfo ? `: ${String(pathInfo).substring(0, 80)}` : '';

				// Extract structured input
				let input: string | undefined;
				const isBash = /bash|shell|command/i.test(toolName);
				const isGlob = /glob/i.test(toolName);
				if (isBash) {
					input = event.parameters?.command ?? '';
				} else if (isGlob) {
					input = event.parameters?.pattern ?? '';
				} else if (event.parameters?.path) {
					input = event.parameters.path;
				} else if (event.parameters) {
					input = JSON.stringify(event.parameters);
				}

				return {
					timestamp: event.timestamp || new Date().toISOString(),
					eventType,
					summary: `${toolName}${suffix}`,
					detail: JSON.stringify(event),
					toolName,
					filePath: event.parameters?.path,
					input,
					toolUseId: event.tool_id,
				};
			}

			case 'tool_result':
				return {
					timestamp: event.timestamp || new Date().toISOString(),
					eventType: 'tool_result',
					summary: `Tool ${event.tool_id || ''}: ${event.status || 'completed'}`,
					detail: JSON.stringify(event),
					status: event.status === 'success' ? 'success' : 'error',
					output: event.output ? String(event.output) : undefined,
					toolUseId: event.tool_id,
				};

			case 'message':
				if (event.role === 'assistant') {
					const content = event.content || '';
					return {
						timestamp: event.timestamp || new Date().toISOString(),
						eventType: 'message',
						summary: String(content).substring(0, 100),
						detail: String(content),
					};
				}
				return null; // Skip user messages

			case 'error':
				return {
					timestamp: event.timestamp || new Date().toISOString(),
					eventType: 'error',
					summary: event.message || 'Unknown error',
					detail: JSON.stringify(event),
					status: 'error',
				};

			case 'result':
				return {
					timestamp: event.timestamp || new Date().toISOString(),
					eventType: 'complete',
					summary: `Completed (${event.status || 'done'})`,
					detail: JSON.stringify(event),
					status: event.status === 'success' ? 'success' : 'error',
				};

			default:
				return null;
		}
	} catch {
		return null;
	}
}

/**
 * Classify a tool name into a CLIActivityEventType.
 */
function classifyToolEvent(toolName: string): CLIActivityEvent['eventType'] {
	const lower = toolName.toLowerCase();
	if (lower.includes('read') || lower.includes('cat') || lower.includes('view')) {
		return 'file_read';
	}
	if (lower.includes('write') || lower.includes('edit') || lower.includes('create') || lower.includes('patch')) {
		return 'file_write';
	}
	if (lower.includes('bash') || lower.includes('shell') || lower.includes('exec')) {
		return 'command_exec';
	}
	return 'tool_call';
}
