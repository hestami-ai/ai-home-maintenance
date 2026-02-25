/**
 * Claude Code Error Handler
 * Implements Phase 9.3.4: Graceful error handling for Claude Code
 * Provides error recovery and user-friendly messages
 */

import * as vscode from 'vscode';
import type { Result } from '../types';

/**
 * Claude Code error types
 */
export type ClaudeCodeErrorType =
	| 'NOT_INSTALLED'
	| 'VERSION_INCOMPATIBLE'
	| 'API_KEY_MISSING'
	| 'EXECUTION_FAILED'
	| 'EXECUTION_TIMEOUT'
	| 'INVALID_PROPOSAL'
	| 'FILE_OPERATION_FAILED'
	| 'PERMISSION_DENIED'
	| 'NETWORK_ERROR'
	| 'UNKNOWN';

/**
 * Claude Code error
 */
export interface ClaudeCodeError {
	/** Error type */
	type: ClaudeCodeErrorType;
	/** Error message */
	message: string;
	/** Original error */
	originalError?: Error;
	/** Recovery suggestions */
	recoverySuggestions: string[];
	/** Whether error is recoverable */
	recoverable: boolean;
}

/**
 * Handle Claude Code error
 * Processes error and provides recovery options
 *
 * @param error Error to handle
 * @returns Processed error with recovery options
 */
export function handleClaudeCodeError(error: any): ClaudeCodeError {
	// Determine error type
	const errorType = determineErrorType(error);

	// Get error-specific information
	const errorInfo = getErrorInfo(errorType, error);

	return {
		type: errorType,
		message: errorInfo.message,
		originalError: error instanceof Error ? error : undefined,
		recoverySuggestions: errorInfo.recoverySuggestions,
		recoverable: errorInfo.recoverable,
	};
}

/**
 * Determine error type from error object
 *
 * @param error Error object
 * @returns Error type
 */
function determineErrorType(error: any): ClaudeCodeErrorType {
	if (!error) {
		return 'UNKNOWN';
	}

	// Check error code
	if (error.code === 'CLAUDE_CODE_NOT_INSTALLED') {
		return 'NOT_INSTALLED';
	}
	if (error.code === 'CLAUDE_CODE_VERSION_INCOMPATIBLE') {
		return 'VERSION_INCOMPATIBLE';
	}
	if (error.code === 'API_KEY_NOT_CONFIGURED') {
		return 'API_KEY_MISSING';
	}
	if (error.code === 'EXECUTION_TIMEOUT' || error.code === 'ETIMEDOUT') {
		return 'EXECUTION_TIMEOUT';
	}
	if (error.code === 'INVALID_PROPOSAL') {
		return 'INVALID_PROPOSAL';
	}
	if (error.code === 'EACCES' || error.code === 'EPERM') {
		return 'PERMISSION_DENIED';
	}
	if (
		error.code === 'ECONNREFUSED' ||
		error.code === 'ENOTFOUND' ||
		error.code === 'ETIMEDOUT'
	) {
		return 'NETWORK_ERROR';
	}

	// Check error message
	const message = error.message?.toLowerCase() || '';

	if (message.includes('not installed') || message.includes('not found')) {
		return 'NOT_INSTALLED';
	}
	if (message.includes('version') || message.includes('incompatible')) {
		return 'VERSION_INCOMPATIBLE';
	}
	if (message.includes('api key')) {
		return 'API_KEY_MISSING';
	}
	if (message.includes('timeout')) {
		return 'EXECUTION_TIMEOUT';
	}
	if (message.includes('permission denied')) {
		return 'PERMISSION_DENIED';
	}
	if (message.includes('file') || message.includes('enoent')) {
		return 'FILE_OPERATION_FAILED';
	}

	return 'EXECUTION_FAILED';
}

/**
 * Get error-specific information
 *
 * @param errorType Error type
 * @param error Original error
 * @returns Error information
 */
function getErrorInfo(
	errorType: ClaudeCodeErrorType,
	error: any
): {
	message: string;
	recoverySuggestions: string[];
	recoverable: boolean;
} {
	switch (errorType) {
		case 'NOT_INSTALLED':
			return {
				message: 'Claude Code CLI is not installed',
				recoverySuggestions: [
					'Install Claude Code: npm install -g @anthropic-ai/claude-code',
					'Verify installation: claude --version',
					'Restart VS Code',
				],
				recoverable: true,
			};

		case 'VERSION_INCOMPATIBLE':
			return {
				message: 'Claude Code version is not compatible',
				recoverySuggestions: [
					'Update Claude Code: npm update -g @anthropic-ai/claude-code',
					'Check current version: claude --version',
					'Restart VS Code',
				],
				recoverable: true,
			};

		case 'API_KEY_MISSING':
			return {
				message: 'Anthropic API key is not configured',
				recoverySuggestions: [
					'Set API key: claude config set apiKey "your-key"',
					'Or set environment variable: export ANTHROPIC_API_KEY="your-key"',
					'Get API key: https://console.anthropic.com/settings/keys',
				],
				recoverable: true,
			};

		case 'EXECUTION_TIMEOUT':
			return {
				message: 'Claude Code execution timed out',
				recoverySuggestions: [
					'Increase timeout in settings: janumicode.claudeCode.timeout',
					'Check Claude Code logs for errors',
					'Try breaking down the proposal into smaller steps',
				],
				recoverable: true,
			};

		case 'INVALID_PROPOSAL':
			return {
				message: 'Execution proposal is invalid',
				recoverySuggestions: [
					'Check proposal format',
					'Ensure proposal contains valid code blocks',
					'Review proposal for syntax errors',
				],
				recoverable: false,
			};

		case 'FILE_OPERATION_FAILED':
			return {
				message: 'File operation failed',
				recoverySuggestions: [
					'Check file permissions',
					'Verify file paths exist',
					'Ensure workspace is accessible',
				],
				recoverable: true,
			};

		case 'PERMISSION_DENIED':
			return {
				message: 'Permission denied',
				recoverySuggestions: [
					'Check file permissions',
					'Run VS Code with appropriate permissions',
					'Verify workspace access',
				],
				recoverable: true,
			};

		case 'NETWORK_ERROR':
			return {
				message: 'Network error during execution',
				recoverySuggestions: [
					'Check internet connection',
					'Verify Anthropic API is accessible',
					'Check proxy settings',
					'Retry execution',
				],
				recoverable: true,
			};

		case 'EXECUTION_FAILED':
			return {
				message: error?.message || 'Claude Code execution failed',
				recoverySuggestions: [
					'Check Claude Code logs',
					'Verify workspace state',
					'Try executing manually: claude execute --proposal <file>',
					'Report issue if problem persists',
				],
				recoverable: true,
			};

		default:
			return {
				message: 'Unknown error occurred',
				recoverySuggestions: [
					'Check error logs',
					'Restart VS Code',
					'Report issue if problem persists',
				],
				recoverable: false,
			};
	}
}

/**
 * Show error to user
 * Displays error with recovery options
 *
 * @param error Claude Code error
 */
export async function showErrorToUser(error: ClaudeCodeError): Promise<void> {
	// Build error message
	let message = `Claude Code Error: ${error.message}\n\n`;

	if (error.recoverySuggestions.length > 0) {
		message += 'Recovery suggestions:\n';
		error.recoverySuggestions.forEach((suggestion, index) => {
			message += `${index + 1}. ${suggestion}\n`;
		});
	}

	// Show error with actions
	const actions: string[] = [];

	if (error.type === 'NOT_INSTALLED') {
		actions.push('Install Now', 'View Documentation');
	} else if (error.type === 'VERSION_INCOMPATIBLE') {
		actions.push('Update Now', 'View Documentation');
	} else if (error.type === 'API_KEY_MISSING') {
		actions.push('Configure API Key', 'Get API Key');
	} else if (error.recoverable) {
		actions.push('Retry', 'View Logs');
	} else {
		actions.push('View Logs');
	}

	const selection = await vscode.window.showErrorMessage(message, ...actions);

	// Handle action selection
	await handleErrorAction(error.type, selection);
}

/**
 * Handle error action selection
 *
 * @param errorType Error type
 * @param action Selected action
 */
async function handleErrorAction(
	errorType: ClaudeCodeErrorType,
	action: string | undefined
): Promise<void> {
	if (!action) {
		return;
	}

	const terminal = vscode.window.createTerminal('JanumiCode');

	switch (action) {
		case 'Install Now':
			terminal.show();
			terminal.sendText('npm install -g @anthropic-ai/claude-code');
			break;

		case 'Update Now':
			terminal.show();
			terminal.sendText('npm update -g @anthropic-ai/claude-code');
			break;

		case 'Configure API Key':
			terminal.show();
			terminal.sendText('claude config set apiKey ');
			break;

		case 'Get API Key':
			vscode.env.openExternal(
				vscode.Uri.parse('https://console.anthropic.com/settings/keys')
			);
			break;

		case 'View Documentation':
			vscode.env.openExternal(vscode.Uri.parse('https://docs.anthropic.com/claude-code'));
			break;

		case 'View Logs':
			vscode.commands.executeCommand('workbench.action.output.toggleOutput');
			break;

		case 'Retry':
			// Retry logic would be implemented by the caller
			vscode.window.showInformationMessage('Retry not yet implemented');
			break;
	}
}

/**
 * Log error to output channel
 *
 * @param error Claude Code error
 * @param outputChannel Output channel
 */
export function logError(error: ClaudeCodeError, outputChannel: vscode.OutputChannel): void {
	outputChannel.appendLine(`[ERROR] ${new Date().toISOString()}`);
	outputChannel.appendLine(`Type: ${error.type}`);
	outputChannel.appendLine(`Message: ${error.message}`);
	outputChannel.appendLine(`Recoverable: ${error.recoverable}`);

	if (error.originalError) {
		outputChannel.appendLine(`Original Error: ${error.originalError.message}`);
		if (error.originalError.stack) {
			outputChannel.appendLine(`Stack Trace:\n${error.originalError.stack}`);
		}
	}

	outputChannel.appendLine(`Recovery Suggestions:`);
	error.recoverySuggestions.forEach((suggestion, index) => {
		outputChannel.appendLine(`  ${index + 1}. ${suggestion}`);
	});

	outputChannel.appendLine('---');
}

/**
 * Attempt automatic recovery
 * Tries to recover from error automatically
 *
 * @param error Claude Code error
 * @returns Whether recovery succeeded
 */
export async function attemptAutoRecovery(error: ClaudeCodeError): Promise<boolean> {
	// Only attempt auto-recovery for specific error types
	if (!error.recoverable) {
		return false;
	}

	switch (error.type) {
		case 'EXECUTION_TIMEOUT':
			// Cannot auto-recover from timeout
			return false;

		case 'NETWORK_ERROR':
			// Could retry after delay
			await new Promise((resolve) => setTimeout(resolve, 5000));
			return true;

		case 'FILE_OPERATION_FAILED':
			// Cannot auto-recover from file errors
			return false;

		default:
			return false;
	}
}
