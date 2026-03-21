/**
 * OpenCode CLI — RoleCLIProvider Implementation
 * Wraps the opencode CLI for use as a role execution backend.
 * OpenCode runs in WSL 2 and is backed by Cerebras models.
 *
 * Invocation: echo "prompt" | opencode run
 * Output: plain text (status lines + response)
 *
 * See: wslUtils.ts for WSL detection and path conversion.
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
import { spawnCLIWithStdin, spawnCLIStreamingWithStdin } from '../spawnUtils';
import {
	detectWSL,
	isRunningInWSL,
	buildWslCommand,
	isCommandAvailableInWSL,
} from '../wslUtils';

/**
 * OpenCode CLI provider implementation of RoleCLIProvider.
 * Invokes `opencode run` via stdin piping, optionally wrapped in wsl.exe.
 */
export class OpenCodeCLIProvider implements RoleCLIProvider {
	readonly id = 'opencode-cli';
	readonly name = 'OpenCode CLI';

	async detect(): Promise<Result<CLIProviderInfo>> {
		try {
			const enabled = vscode.workspace
				.getConfiguration('janumicode.cli.providers.opencode')
				.get<boolean>('enabled', false);

			if (!enabled) {
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

			const { available, version } = await detectOpenCode();
			const apiKeyConfigured = checkOpenCodeApiKey();

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
			const { command, args, cwd } = await resolveOpenCodeCommand(options);
			const timeout = options.timeout || 300000;

			const raw = await spawnCLIWithStdin(
				command, args, cwd, timeout, options.stdinContent, options.signal,
			);
			const executionTime = Date.now() - startTime;
			const parsed = parseOpenCodeOutput(raw.stdout);

			return {
				success: true,
				value: {
					response: parsed.response,
					exitCode: raw.exitCode,
					executionTime,
					rawOutput: raw.stdout,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: new CodedError(
					'OPENCODE_EXECUTION_FAILED',
					error instanceof Error ? error.message : 'OpenCode CLI execution failed',
				),
			};
		}
	}

	async invokeStreaming(
		options: RoleCLIInvocationOptions,
		onEvent: (event: CLIActivityEvent) => void,
	): Promise<Result<RoleCLIResult>> {
		const startTime = Date.now();

		try {
			const { command, args, cwd } = await resolveOpenCodeCommand(options);
			const timeout = options.timeout || 300000;

			// Emit init event with the full CLI command for observability
			const commandPreview = `${command} ${args.join(' ')}`;
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'init',
				summary: `OpenCode CLI: ${commandPreview}`,
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
				command, args, cwd, timeout, options.stdinContent,
				(line) => {
					const event = normalizeOpenCodeStreamLine(line);
					if (event) {
						onEvent(event);
					}
				},
				options.signal,
			);

			const executionTime = Date.now() - startTime;

			const stderrText = raw.stderr?.trim() || '';
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
				summary: `Completed (exit code ${raw.exitCode})`
					+ (stderrText ? ` — ${stderrText.substring(0, 200)}` : ''),
				status: raw.exitCode === 0 ? 'success' : 'error',
			});

			const parsed = parseOpenCodeOutput(raw.stdout);

			return {
				success: true,
				value: {
					response: parsed.response || stderrText,
					exitCode: raw.exitCode,
					executionTime,
					rawOutput: raw.stdout,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: new CodedError(
					'OPENCODE_STREAMING_FAILED',
					error instanceof Error ? error.message : 'OpenCode CLI streaming failed',
				),
			};
		}
	}

	getCommandPreview(options: RoleCLIInvocationOptions): Result<string> {
		const args = buildOpenCodeArgs(options);
		return {
			success: true,
			value: `echo "<stdin>" | opencode ${args.join(' ')}`,
		};
	}
}

// ==================== Detection ====================

async function detectOpenCode(): Promise<{ version?: string; available: boolean }> {
	const distro = getConfiguredDistro();

	if (isRunningInWSL()) {
		// Extension host is in WSL — check directly
		const result = await isCommandAvailableInWSL(distro, resolveOpenCodePath());
		return { version: result.version, available: result.available };
	}

	// Windows host — check via WSL
	const wsl = await detectWSL();
	if (!wsl.available) {
		return { available: false };
	}

	if (!wsl.distros.includes(distro)) {
		return { available: false };
	}

	const result = await isCommandAvailableInWSL(distro, resolveOpenCodePath());
	return { version: result.version, available: result.available };
}

function checkOpenCodeApiKey(): boolean {
	return !!(process.env.CEREBRAS_API_KEY || process.env.OPENCODE_API_KEY);
}

function resolveOpenCodePath(): string {
	const config = vscode.workspace.getConfiguration('janumicode.cli.providers.opencode');
	return config.get<string>('path', 'opencode');
}

function getConfiguredDistro(): string {
	const config = vscode.workspace.getConfiguration('janumicode.cli.providers.opencode');
	return config.get<string>('wslDistro', 'Ubuntu-22.04');
}

// ==================== Command Building ====================

/**
 * Build CLI arguments for opencode run.
 * opencode reads the prompt from stdin.
 */
function buildOpenCodeArgs(options: RoleCLIInvocationOptions): string[] {
	const args = ['run'];

	// Model override: explicit option > VS Code setting > opencode default
	const model = options.model
		|| vscode.workspace.getConfiguration('janumicode.cli.providers.opencode')
			.get<string>('model', '')
		|| '';
	if (model) {
		args.push('--model', model);
	}

	return args;
}

/**
 * Resolve the full spawn command, handling WSL wrapping and cwd conversion.
 */
async function resolveOpenCodeCommand(options: RoleCLIInvocationOptions): Promise<{
	command: string;
	args: string[];
	cwd: string;
}> {
	const opencodePath = resolveOpenCodePath();
	const distro = getConfiguredDistro();
	const args = buildOpenCodeArgs(options);

	const windowsCwd = options.workingDirectory
		|| vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		|| process.cwd();

	if (isRunningInWSL()) {
		// Extension host is in WSL — spawn directly
		return { command: opencodePath, args, cwd: windowsCwd };
	}

	// Windows host — wrap via wsl.exe with cwd translation
	const wslCmd = buildWslCommand(distro, opencodePath, args, windowsCwd);
	// When using wsl.exe, Node's cwd should be a valid Windows path
	// (wsl.exe doesn't need it, but spawn() validates it exists)
	return { command: wslCmd.command, args: wslCmd.args, cwd: windowsCwd };
}

// ==================== Output Parsing ====================

/**
 * Parse OpenCode CLI plain text output.
 *
 * OpenCode output is plain text with status lines that can appear
 * before OR after the response content:
 *   > build · mimo-v2-omni-free     ← status line (may contain ANSI escapes)
 *   $ echo '...'                     ← command echo
 *   <actual response content>        ← the response
 *
 * Strategy:
 * 1. Strip ANSI escape codes
 * 2. Filter out status lines (> prefix, $ prefix) from anywhere in output
 * 3. Remaining non-empty lines are the response
 * 4. If the response looks like JSON in code fences, extract it
 */
function parseOpenCodeOutput(stdout: string): { response: string } {
	// Strip ANSI escape codes
	 
	const clean = stdout.replaceAll(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

	const lines = clean.split('\n');
	const responseLines: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		// Skip status lines and empty lines
		if (trimmed.startsWith('>') || trimmed.startsWith('$') || trimmed === '') {
			continue;
		}
		responseLines.push(line);
	}

	let response = responseLines.join('\n').trim();

	// If the response is empty, fall back to full cleaned stdout
	if (!response) {
		response = clean.trim();
	}

	// Try to extract JSON if response contains code fences
	const jsonMatch = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(response);
	if (jsonMatch) {
		try {
			JSON.parse(jsonMatch[1]);
			// Valid JSON inside fences — return just the JSON
			response = jsonMatch[1].trim();
		} catch {
			// Not valid JSON, keep full response
		}
	}

	return { response };
}

// ==================== Stream Event Normalization ====================

/**
 * Normalize a single stdout line from opencode into a CLIActivityEvent.
 *
 * Since opencode outputs plain text (not JSONL), we classify lines by prefix:
 * - Lines starting with ">" → init/status events
 * - Lines starting with "$" → command_exec events
 * - Everything else → message events
 */
function normalizeOpenCodeStreamLine(line: string): CLIActivityEvent | null {
	const trimmed = line.trim();
	if (!trimmed) {
		return null;
	}

	// Status line: > build · mimo-v2-omni-free
	if (trimmed.startsWith('>')) {
		return {
			timestamp: new Date().toISOString(),
			eventType: 'init',
			summary: trimmed.substring(1).trim(),
		};
	}

	// Command echo: $ echo '...'
	if (trimmed.startsWith('$')) {
		return {
			timestamp: new Date().toISOString(),
			eventType: 'command_exec',
			summary: 'shell',
			toolName: 'shell',
			input: trimmed.substring(1).trim(),
		};
	}

	// Regular output line → message event
	return {
		timestamp: new Date().toISOString(),
		eventType: 'message',
		summary: trimmed.substring(0, 100),
		detail: trimmed,
	};
}
