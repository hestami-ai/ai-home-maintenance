/**
 * Claude Code CLI Invoker
 * Implements Phase 9.3.3: Helper functions to invoke Claude Code CLI
 * Provides functions to execute proposals using Claude Code
 */

import { spawn } from 'node:child_process';
import * as vscode from 'vscode';
import type { Result } from '../types';
import { CodedError } from '../types';
import { detectClaudeCode } from './detector';

/**
 * Claude Code execution options
 */
export interface ClaudeCodeExecutionOptions {
	/** Execution proposal from Executor role */
	proposal: string;
	/** Context (verified claims, constraints) */
	context?: string;
	/** Working directory */
	workingDirectory?: string;
	/** Timeout in milliseconds */
	timeout?: number;
	/** Whether to capture output */
	captureOutput?: boolean;
}

/**
 * Claude Code execution result
 */
export interface ClaudeCodeExecutionResult {
	/** Whether execution succeeded */
	success: boolean;
	/** Standard output */
	stdout?: string;
	/** Standard error */
	stderr?: string;
	/** Exit code */
	exitCode: number;
	/** Execution time in milliseconds */
	executionTime: number;
	/** Files modified */
	filesModified?: string[];
}

/**
 * Execute proposal with Claude Code
 * Invokes Claude Code CLI using `claude -p "prompt"` for non-interactive execution.
 *
 * @param options Execution options
 * @returns Execution result
 */
export async function executeWithClaudeCode(
	options: ClaudeCodeExecutionOptions
): Promise<Result<ClaudeCodeExecutionResult>> {
	const startTime = Date.now();

	try {
		// Detect Claude Code
		const detection = await detectClaudeCode();

		if (!detection.success) {
			return {
				success: false,
				error: new CodedError(
					'CLAUDE_CODE_DETECTION_FAILED',
					'Failed to detect Claude Code CLI'
				),
			};
		}

		if (!detection.value.installed) {
			return {
				success: false,
				error: new CodedError(
					'CLAUDE_CODE_NOT_INSTALLED',
					'Claude Code CLI is not installed'
				),
			};
		}

		if (!detection.value.compatible) {
			return {
				success: false,
				error: new CodedError(
					'CLAUDE_CODE_VERSION_INCOMPATIBLE',
					`Claude Code version ${detection.value.version} is not compatible`
				),
			};
		}

		const claudePath = detection.value.path || 'claude';
		const workingDir = options.workingDirectory
			|| vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
			|| process.cwd();
		const timeout = options.timeout || 300000; // 5 minutes default

		// Build the prompt: combine proposal with context
		let prompt = options.proposal;
		if (options.context) {
			prompt = `Context:\n${options.context}\n\n---\n\nTask:\n${prompt}`;
		}

		// Build CLI args: `claude -p "prompt" --output-format json`
		const args = [
			'-p', prompt,
			'--output-format', 'json',
		];

		// Execute via spawn for better control
		const result = await spawnClaudeCode(claudePath, args, workingDir, timeout);

		const executionTime = Date.now() - startTime;

		return {
			success: true,
			value: {
				success: result.exitCode === 0,
				stdout: result.stdout,
				stderr: result.stderr,
				exitCode: result.exitCode,
				executionTime,
			},
		};
	} catch (error: unknown) {
		if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
			return {
				success: false,
				error: new CodedError(
					'EXECUTION_TIMEOUT',
					'Claude Code execution timed out'
				),
			};
		}

		return {
			success: false,
			error: new CodedError(
				'EXECUTION_FAILED',
				error instanceof Error ? error.message : 'Claude Code execution failed'
			),
		};
	}
}

/**
 * Spawn Claude Code CLI process and collect output
 */
function spawnClaudeCode(
	claudePath: string,
	args: string[],
	cwd: string,
	timeout: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	return new Promise((resolve, reject) => {
		const proc = spawn(claudePath, args, {
			cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout,
		});

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		proc.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
		proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

		proc.on('close', (code) => {
			resolve({
				stdout: Buffer.concat(stdoutChunks).toString('utf-8').trim(),
				stderr: Buffer.concat(stderrChunks).toString('utf-8').trim(),
				exitCode: code ?? 1,
			});
		});

		proc.on('error', (err) => reject(err));
	});
}

/**
 * Execute proposal with streaming output
 * Invokes Claude Code with real-time output streaming via spawn
 *
 * @param options Execution options
 * @param onOutput Callback for output chunks
 * @returns Execution result
 */
export async function executeWithClaudeCodeStreaming(
	options: ClaudeCodeExecutionOptions,
	onOutput: (chunk: string) => void
): Promise<Result<ClaudeCodeExecutionResult>> {
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
		const workingDir = options.workingDirectory
			|| vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
			|| process.cwd();
		const timeout = options.timeout || 300000;

		let prompt = options.proposal;
		if (options.context) {
			prompt = `Context:\n${options.context}\n\n---\n\nTask:\n${prompt}`;
		}

		const args = ['-p', prompt, '--output-format', 'stream-json'];

		return new Promise((resolve) => {
			const proc = spawn(claudePath, args, {
				cwd: workingDir,
				stdio: ['pipe', 'pipe', 'pipe'],
				timeout,
			});

			const stderrChunks: Buffer[] = [];
			let fullStdout = '';

			proc.stdout.on('data', (chunk: Buffer) => {
				const text = chunk.toString('utf-8');
				fullStdout += text;
				onOutput(text);
			});

			proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

			proc.on('close', (code) => {
				const executionTime = Date.now() - startTime;
				resolve({
					success: true,
					value: {
						success: code === 0,
						stdout: fullStdout.trim(),
						stderr: Buffer.concat(stderrChunks).toString('utf-8').trim(),
						exitCode: code ?? 1,
						executionTime,
					},
				});
			});

			proc.on('error', (err) => {
				resolve({
					success: false,
					error: new CodedError('EXECUTION_FAILED', err.message),
				});
			});
		});
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'EXECUTION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Get Claude Code execution command
 * Generates the command that would be executed (for display/logging)
 *
 * @param options Execution options
 * @returns Command string
 */
export async function getClaudeCodeCommand(
	options: ClaudeCodeExecutionOptions
): Promise<Result<string>> {
	try {
		const detection = await detectClaudeCode();

		if (!detection.success || !detection.value.installed) {
			return {
				success: false,
				error: new CodedError(
					'CLAUDE_CODE_NOT_AVAILABLE',
					'Claude Code CLI is not available'
				),
			};
		}

		const claudePath = detection.value.path || 'claude';
		const command = `"${claudePath}" -p "<prompt>" --output-format json`;

		return {
			success: true,
			value: command,
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'COMMAND_GENERATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Validate proposal before execution
 * Checks if proposal is valid for execution
 *
 * @param proposal Proposal to validate
 * @returns Validation result
 */
export function validateProposal(proposal: string): Result<{
	valid: boolean;
	issues: string[];
}> {
	try {
		const issues: string[] = [];

		// Check proposal is not empty
		if (!proposal || proposal.trim().length === 0) {
			issues.push('Proposal is empty');
		}

		// Check proposal size
		if (proposal.length > 1000000) {
			// 1MB limit
			issues.push('Proposal exceeds 1MB limit');
		}

		// Check for code blocks (optional, but recommended)
		if (!proposal.includes('```')) {
			issues.push('Proposal contains no code blocks (warning)');
		}

		return {
			success: true,
			value: {
				valid: issues.length === 0,
				issues,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'PROPOSAL_VALIDATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Parse execution output
 * Extracts information from Claude Code output
 *
 * @param stdout Standard output
 * @returns Parsed output information
 */
export function parseExecutionOutput(stdout: string): {
	filesCreated: string[];
	filesModified: string[];
	filesDeleted: string[];
	commandsExecuted: string[];
} {
	const result = {
		filesCreated: [] as string[],
		filesModified: [] as string[],
		filesDeleted: [] as string[],
		commandsExecuted: [] as string[],
	};

	// Parse output for file operations
	// This is a simplified parser - actual implementation would be more robust

	const lines = stdout.split('\n');

	for (const line of lines) {
		if (line.includes('Created file:')) {
			const match = line.match(/Created file: (.+)/);
			if (match) {
				result.filesCreated.push(match[1].trim());
			}
		} else if (line.includes('Modified file:')) {
			const match = line.match(/Modified file: (.+)/);
			if (match) {
				result.filesModified.push(match[1].trim());
			}
		} else if (line.includes('Deleted file:')) {
			const match = line.match(/Deleted file: (.+)/);
			if (match) {
				result.filesDeleted.push(match[1].trim());
			}
		} else if (line.includes('Executed command:')) {
			const match = line.match(/Executed command: (.+)/);
			if (match) {
				result.commandsExecuted.push(match[1].trim());
			}
		}
	}

	return result;
}

/**
 * Dry run execution
 * Simulates execution without making changes
 *
 * @param options Execution options
 * @returns Dry run result
 */
export async function dryRunExecution(
	options: ClaudeCodeExecutionOptions
): Promise<
	Result<{
		estimatedChanges: {
			filesAffected: number;
			commandsToExecute: number;
		};
	}>
> {
	try {
		// Detect Claude Code
		const detection = await detectClaudeCode();

		if (!detection.success || !detection.value.installed) {
			return {
				success: false,
				error: new CodedError(
					'CLAUDE_CODE_NOT_AVAILABLE',
					'Claude Code CLI is not available'
				),
			};
		}

		// Parse proposal to estimate changes
		const codeBlocks = (options.proposal.match(/```/g) || []).length / 2;
		const commands = (options.proposal.match(/^\s*\$\s+/gm) || []).length;

		return {
			success: true,
			value: {
				estimatedChanges: {
					filesAffected: Math.floor(codeBlocks),
					commandsToExecute: commands,
				},
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'DRY_RUN_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Execute proposal with progress reporting
 * Executes proposal and reports progress
 *
 * @param options Execution options
 * @param onProgress Progress callback
 * @returns Execution result
 */
export async function executeWithProgress(
	options: ClaudeCodeExecutionOptions,
	onProgress: (progress: { message: string; percentage: number }) => void
): Promise<Result<ClaudeCodeExecutionResult>> {
	try {
		onProgress({ message: 'Validating Claude Code installation...', percentage: 0 });

		// Validate Claude Code
		const detection = await detectClaudeCode();

		if (!detection.success || !detection.value.installed) {
			return {
				success: false,
				error: new CodedError(
					'CLAUDE_CODE_NOT_AVAILABLE',
					'Claude Code CLI is not available'
				),
			};
		}

		onProgress({ message: 'Preparing execution...', percentage: 20 });

		// Validate proposal
		const validation = validateProposal(options.proposal);

		if (!validation.success) {
			return {
				success: false,
				error: new CodedError(
					'INVALID_PROPOSAL',
					'Proposal validation failed'
				),
			};
		}

		if (!validation.value.valid) {
			return {
				success: false,
				error: new CodedError(
					'INVALID_PROPOSAL',
					validation.value.issues.join('; ') || 'Invalid proposal'
				),
			};
		}

		onProgress({ message: 'Executing proposal...', percentage: 50 });

		// Execute
		const result = await executeWithClaudeCode(options);

		if (!result.success) {
			return result;
		}

		onProgress({ message: 'Execution complete', percentage: 100 });

		return result;
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'EXECUTION_WITH_PROGRESS_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}
