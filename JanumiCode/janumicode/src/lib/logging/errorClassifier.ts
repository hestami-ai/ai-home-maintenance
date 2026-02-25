/**
 * Error Classifier
 * Maps raw system errors (ENOENT, EACCES, timeouts, exit codes) to
 * user-friendly messages with actionable recovery suggestions.
 *
 * Usage:
 *   import { classifyCLIError } from '../logging';
 *   const classified = classifyCLIError(error, 'gemini-cli');
 *   vscode.window.showErrorMessage(classified.userMessage);
 */

/**
 * Classified error with user-friendly messaging.
 */
export interface ClassifiedError {
	/** Machine-readable error code for programmatic handling */
	code: CLIErrorCode;
	/** Short user-friendly message suitable for VS Code notifications */
	userMessage: string;
	/** Detailed message for the OutputChannel log */
	detailMessage: string;
	/** Actionable recovery steps */
	recoverySuggestions: string[];
	/** Whether the error is likely transient and retryable */
	retryable: boolean;
	/** Original error preserved for stack trace */
	originalError: Error;
}

/**
 * CLI-specific error codes.
 */
export enum CLIErrorCode {
	/** CLI binary not found on PATH */
	CLI_NOT_FOUND = 'CLI_NOT_FOUND',
	/** Permission denied executing CLI binary */
	CLI_PERMISSION_DENIED = 'CLI_PERMISSION_DENIED',
	/** CLI process timed out */
	CLI_TIMEOUT = 'CLI_TIMEOUT',
	/** CLI exited with non-zero exit code */
	CLI_EXIT_ERROR = 'CLI_EXIT_ERROR',
	/** CLI authentication/API key error */
	CLI_AUTH_ERROR = 'CLI_AUTH_ERROR',
	/** CLI rate limited */
	CLI_RATE_LIMITED = 'CLI_RATE_LIMITED',
	/** CLI output could not be parsed */
	CLI_PARSE_ERROR = 'CLI_PARSE_ERROR',
	/** CLI was killed (e.g. OOM, signal) */
	CLI_KILLED = 'CLI_KILLED',
	/** Network error during CLI execution */
	CLI_NETWORK_ERROR = 'CLI_NETWORK_ERROR',
	/** Unknown CLI error */
	CLI_UNKNOWN = 'CLI_UNKNOWN',
}

/**
 * Human-readable names for known CLI providers.
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
	'claude-code': 'Claude Code',
	'gemini-cli': 'Gemini CLI',
	'codex-cli': 'Codex CLI',
};

function providerDisplayName(providerId: string): string {
	return PROVIDER_DISPLAY_NAMES[providerId] ?? providerId;
}

/**
 * Classify a CLI-related error into a user-friendly ClassifiedError.
 *
 * @param error The raw error (from spawn, exit, parse, etc.)
 * @param providerId The CLI provider ID (e.g. 'gemini-cli')
 * @param exitCode Optional exit code if the process exited
 * @param stderr Optional stderr content for additional classification
 */
export function classifyCLIError(
	error: Error,
	providerId: string,
	exitCode?: number,
	stderr?: string
): ClassifiedError {
	const name = providerDisplayName(providerId);
	const errno = (error as NodeJS.ErrnoException).code;

	// ── Spawn-level errors ────────────────────────────────────────────

	if (errno === 'ENOENT') {
		return {
			code: CLIErrorCode.CLI_NOT_FOUND,
			userMessage: `${name} is not installed or not on your PATH.`,
			detailMessage: `spawn failed: ENOENT for provider '${providerId}'. The binary could not be found.`,
			recoverySuggestions: [
				...getInstallInstructions(providerId),
				'Ensure the binary is on your system PATH.',
				'Restart VS Code after installing.',
			],
			retryable: false,
			originalError: error,
		};
	}

	if (errno === 'EACCES' || errno === 'EPERM') {
		return {
			code: CLIErrorCode.CLI_PERMISSION_DENIED,
			userMessage: `Permission denied running ${name}. Check file permissions.`,
			detailMessage: `spawn failed: ${errno} for provider '${providerId}'.`,
			recoverySuggestions: [
				`Check that the ${name} binary is executable.`,
				'On macOS/Linux: chmod +x $(which <binary>)',
				'Try running VS Code with appropriate permissions.',
			],
			retryable: false,
			originalError: error,
		};
	}

	// ── Timeout ───────────────────────────────────────────────────────

	if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
		return {
			code: CLIErrorCode.CLI_TIMEOUT,
			userMessage: `${name} timed out. The task may be too large or the service may be slow.`,
			detailMessage: `CLI timed out for provider '${providerId}': ${error.message}`,
			recoverySuggestions: [
				'Try a simpler or smaller task.',
				'Check your network connection.',
				'Increase the timeout in settings if available.',
			],
			retryable: true,
			originalError: error,
		};
	}

	// ── Exit code analysis ────────────────────────────────────────────

	if (exitCode !== undefined && exitCode !== 0) {
		return classifyExitCode(error, providerId, exitCode, stderr);
	}

	// ── Parse errors ──────────────────────────────────────────────────

	if (error.message.includes('JSON') || error.message.includes('parse')) {
		return {
			code: CLIErrorCode.CLI_PARSE_ERROR,
			userMessage: `${name} returned an unexpected response format.`,
			detailMessage: `Output parse error for provider '${providerId}': ${error.message}`,
			recoverySuggestions: [
				`Check that ${name} is up to date.`,
				'Check the Output > JanumiCode log for the raw response.',
			],
			retryable: true,
			originalError: error,
		};
	}

	// ── Fallback ──────────────────────────────────────────────────────

	return {
		code: CLIErrorCode.CLI_UNKNOWN,
		userMessage: `${name} encountered an unexpected error.`,
		detailMessage: `Unknown CLI error for provider '${providerId}': ${error.message}`,
		recoverySuggestions: [
			'Check the Output > JanumiCode log for details.',
			`Verify ${name} works correctly from the terminal.`,
		],
		retryable: false,
		originalError: error,
	};
}

/**
 * Classify based on non-zero exit code + stderr content.
 */
function classifyExitCode(
	error: Error,
	providerId: string,
	exitCode: number,
	stderr?: string
): ClassifiedError {
	const name = providerDisplayName(providerId);
	const stderrLower = stderr?.toLowerCase() ?? '';

	// Authentication errors
	if (
		stderrLower.includes('api key') ||
		stderrLower.includes('unauthorized') ||
		stderrLower.includes('authentication') ||
		stderrLower.includes('401') ||
		stderrLower.includes('forbidden') ||
		stderrLower.includes('403')
	) {
		return {
			code: CLIErrorCode.CLI_AUTH_ERROR,
			userMessage: `${name} authentication failed. Check your API key.`,
			detailMessage: `Auth error (exit ${exitCode}) for '${providerId}': ${stderr?.substring(0, 300)}`,
			recoverySuggestions: [
				'Use "JanumiCode: Set API Key" to configure your key.',
				`Verify the API key works: run ${name} directly in the terminal.`,
			],
			retryable: false,
			originalError: error,
		};
	}

	// Rate limiting
	if (
		stderrLower.includes('rate limit') ||
		stderrLower.includes('429') ||
		stderrLower.includes('too many requests')
	) {
		return {
			code: CLIErrorCode.CLI_RATE_LIMITED,
			userMessage: `${name} is rate limited. Wait a moment and try again.`,
			detailMessage: `Rate limited (exit ${exitCode}) for '${providerId}': ${stderr?.substring(0, 300)}`,
			recoverySuggestions: [
				'Wait 30-60 seconds before retrying.',
				'Consider reducing request frequency.',
			],
			retryable: true,
			originalError: error,
		};
	}

	// Process killed (signal)
	if (exitCode === 137 || exitCode === 143 || stderrLower.includes('killed')) {
		return {
			code: CLIErrorCode.CLI_KILLED,
			userMessage: `${name} process was killed (exit ${exitCode}).`,
			detailMessage: `Process killed (exit ${exitCode}) for '${providerId}': ${stderr?.substring(0, 300)}`,
			recoverySuggestions: [
				'The process may have been killed due to memory limits.',
				'Try a simpler task or check system resources.',
			],
			retryable: true,
			originalError: error,
		};
	}

	// Network errors
	if (
		stderrLower.includes('network') ||
		stderrLower.includes('connection') ||
		stderrLower.includes('econnrefused') ||
		stderrLower.includes('enotfound')
	) {
		return {
			code: CLIErrorCode.CLI_NETWORK_ERROR,
			userMessage: `${name} network error. Check your internet connection.`,
			detailMessage: `Network error (exit ${exitCode}) for '${providerId}': ${stderr?.substring(0, 300)}`,
			recoverySuggestions: [
				'Check your internet connection.',
				'Check if the API service is accessible.',
				'If behind a proxy, ensure CLI is configured to use it.',
			],
			retryable: true,
			originalError: error,
		};
	}

	// Generic non-zero exit
	return {
		code: CLIErrorCode.CLI_EXIT_ERROR,
		userMessage: `${name} failed (exit code ${exitCode}). Check Output > JanumiCode for details.`,
		detailMessage: `CLI error (exit ${exitCode}) for '${providerId}': ${stderr?.substring(0, 500) ?? error.message}`,
		recoverySuggestions: [
			'Check the Output > JanumiCode log for the full error.',
			`Try running ${name} directly in the terminal to reproduce.`,
		],
		retryable: false,
		originalError: error,
	};
}

/**
 * Get installation instructions for a given CLI provider.
 */
function getInstallInstructions(providerId: string): string[] {
	switch (providerId) {
		case 'claude-code':
			return ['Install Claude Code: npm install -g @anthropic-ai/claude-code'];
		case 'gemini-cli':
			return ['Install Gemini CLI: npm install -g @anthropic-ai/gemini-cli'];
		case 'codex-cli':
			return ['Install Codex CLI: npm install -g @openai/codex'];
		default:
			return [`Install the ${providerId} CLI tool.`];
	}
}
