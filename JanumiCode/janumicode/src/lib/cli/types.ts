/**
 * CLI Provider Types
 * Core type definitions for the multi-CLI integration layer.
 * See: docs/Multi-CLI Integration Spec.md
 */

import type { Role, Phase } from '../types';

/**
 * CLI provider detection info
 */
export interface CLIProviderInfo {
	/** Provider identifier */
	id: string;
	/** Human-readable name */
	name: string;
	/** Whether the CLI is installed and available */
	available: boolean;
	/** Version string (if detected) */
	version?: string;
	/** Whether the provider requires an API key */
	requiresApiKey: boolean;
	/** Whether the API key is configured */
	apiKeyConfigured: boolean;
}

/**
 * Options for invoking a CLI tool for a role task
 */
export interface RoleCLIInvocationOptions {
	/** The full prompt content to pipe via stdin (system prompt + context pack) */
	stdinContent: string;

	/** Working directory for the CLI process */
	workingDirectory?: string;

	/** Directories the CLI can access (Gemini --include-directories) */
	includedDirectories?: string[];

	/** Sandbox mode (Codex --sandbox) */
	sandboxMode?: 'read-only' | 'workspace-write' | 'full-access';

	/** Path to JSON schema for output validation (Codex --output-schema) */
	outputSchemaPath?: string;

	/** Output format preference */
	outputFormat?: 'json' | 'stream-json' | 'text';

	/** Model override */
	model?: string;

	/** Timeout in milliseconds (default: 300000 = 5 minutes) */
	timeout?: number;

	/** Whether to auto-approve tool use (for read-only roles) */
	autoApprove?: boolean;

	/** Paths to MCP config JSON files to pass via --mcp-config (Claude Code only) */
	mcpConfigPaths?: string[];
}

/**
 * Result from a CLI tool invocation
 */
export interface RoleCLIResult {
	/** Main response content (the CLI's answer/output) */
	response: string;

	/** Process exit code */
	exitCode: number;

	/** Execution time in milliseconds */
	executionTime: number;

	/** Token usage statistics (if available from CLI output) */
	tokenUsage?: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};

	/** Tool call statistics */
	toolStats?: {
		totalCalls: number;
		totalSuccess: number;
		totalFail: number;
	};

	/** Files modified during execution (if reported) */
	filesModified?: string[];

	/** Raw CLI output (for debugging) */
	rawOutput: string;
}

/**
 * Normalized CLI activity event.
 * Maps events from all CLI tools to a common format for UI and audit.
 */
export interface CLIActivityEvent {
	/** ISO-8601 timestamp */
	timestamp: string;

	/** Which role generated this event */
	role?: Role;

	/** Which workflow phase this event belongs to */
	phase?: Phase;

	/** Normalized event type */
	eventType: CLIActivityEventType;

	/** Human-readable one-line summary (displayed at Level 2) */
	summary: string;

	/** Full event content (displayed at Level 3) */
	detail?: string;

	/** Tool name if tool-related (e.g., "ReadFile", "Bash", "WriteFile") */
	toolName?: string;

	/** File path if file-related */
	filePath?: string;

	/** Success or error status */
	status?: 'success' | 'error';

	/** Structured tool input (the Bash command, file path, glob pattern, etc.) */
	input?: string;

	/** Structured tool output (stdout, file contents, glob results, etc.) */
	output?: string;

	/** Unique ID for correlating a tool_call with its tool_result */
	toolUseId?: string;
}

/**
 * CLI activity event types
 */
export type CLIActivityEventType =
	| 'init'          // CLI process started
	| 'stdin'         // Stdin content piped to CLI (for observability)
	| 'tool_call'     // CLI tool invoked a tool (file read, bash, etc.)
	| 'tool_result'   // Tool returned a result
	| 'file_read'     // File was read (high-signal for Verifier/Expert)
	| 'file_write'    // File was written (high-signal for Executor)
	| 'command_exec'  // Shell command executed
	| 'message'       // Model generated text
	| 'error'         // Non-fatal error or warning
	| 'complete';     // CLI process finished

/**
 * Stdin content separator.
 * System prompt and context pack are separated by this string.
 */
export const STDIN_SEPARATOR = '\n---\n';

/**
 * Split stdin content into system prompt and user content.
 * Convention: system prompt and user content separated by "\n---\n"
 */
export function splitStdinContent(stdinContent: string): [string, string] {
	const separatorIndex = stdinContent.indexOf(STDIN_SEPARATOR);
	if (separatorIndex === -1) {
		return ['', stdinContent];
	}
	return [
		stdinContent.substring(0, separatorIndex),
		stdinContent.substring(separatorIndex + STDIN_SEPARATOR.length),
	];
}

/**
 * Join system prompt and context into stdin content.
 */
export function buildStdinContent(systemPrompt: string, context: string): string {
	return `${systemPrompt}${STDIN_SEPARATOR}${context}`;
}
