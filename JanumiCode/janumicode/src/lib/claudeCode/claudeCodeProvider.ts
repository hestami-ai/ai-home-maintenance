/**
 * Claude Code CLI Provider
 * Implements ExecutionCLIProvider for Claude Code CLI.
 */

import type { Result } from '../types';
import { CodedError } from '../types';
import type {
	ExecutionCLIProvider,
	ExecutionCLIOptions,
	ExecutionCLIResult,
	ExecutionCLIInfo,
} from './cliProvider';
import {
	executeWithClaudeCode,
	executeWithClaudeCodeStreaming,
	getClaudeCodeCommand,
	type ClaudeCodeExecutionResult,
} from './invoker';
import { detectClaudeCode } from './detector';

/**
 * Map ClaudeCodeExecutionResult to ExecutionCLIResult
 * Ensures optional fields get default values.
 */
function toExecutionCLIResult(r: ClaudeCodeExecutionResult): ExecutionCLIResult {
	return {
		success: r.success,
		stdout: r.stdout ?? '',
		stderr: r.stderr ?? '',
		exitCode: r.exitCode,
		executionTime: r.executionTime,
		filesModified: r.filesModified,
	};
}

/**
 * Claude Code CLI provider implementation
 */
export class ClaudeCodeCLIProvider implements ExecutionCLIProvider {
	readonly id = 'claude-code';
	readonly name = 'Claude Code';

	async detect(): Promise<Result<ExecutionCLIInfo>> {
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

	async execute(options: ExecutionCLIOptions): Promise<Result<ExecutionCLIResult>> {
		const result = await executeWithClaudeCode({
			proposal: options.proposal,
			context: options.context,
			workingDirectory: options.workingDirectory,
			timeout: options.timeout,
		});
		if (!result.success) {
			return result;
		}
		return { success: true, value: toExecutionCLIResult(result.value) };
	}

	async executeStreaming(
		options: ExecutionCLIOptions,
		onOutput: (chunk: string) => void
	): Promise<Result<ExecutionCLIResult>> {
		const result = await executeWithClaudeCodeStreaming(
			{
				proposal: options.proposal,
				context: options.context,
				workingDirectory: options.workingDirectory,
				timeout: options.timeout,
			},
			onOutput
		);
		if (!result.success) {
			return result;
		}
		return { success: true, value: toExecutionCLIResult(result.value) };
	}

	async getCommandPreview(options: ExecutionCLIOptions): Promise<Result<string>> {
		return getClaudeCodeCommand({
			proposal: options.proposal,
			context: options.context,
			workingDirectory: options.workingDirectory,
			timeout: options.timeout,
		});
	}
}
