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

	/** Pre-registered MCP server names to allow (Gemini CLI --allowed-mcp-server-names) */
	allowedMcpServerNames?: string[];

	/** Claude Code tool names to allow without interactive approval (--allowedTools) */
	allowedTools?: string[];

	/** MCP tool name for permission prompt handling (--permission-prompt-tool) */
	permissionPromptTool?: string;

	/** AbortSignal for cancelling the CLI process on extension disposal */
	signal?: AbortSignal;

	/**
	 * JSON Schema string for structured output enforcement (Claude Code --json-schema).
	 * When provided, Claude Code validates and coerces its final result to conform to
	 * this schema before returning — eliminating parse failures at the source.
	 * Print mode only; ignored by other CLI providers.
	 */
	jsonSchema?: string;
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

	/** Warning message when CLI exited non-zero but produced a usable response */
	warning?: string;

	/** Reasoning review results (if reviewer is enabled and found concerns) */
	reasoningReview?: import('../review/reviewTypes').ReasoningReview;
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

/** Try to extract a typed CLI result event from a single JSONL line. Returns the response string or null. */
function extractResultEventResponse(line: string): string | null {
	try {
		const event = JSON.parse(line);
		if (event.type === 'result' && typeof event.result === 'string') { return event.result; }
		// --json-schema structured output: result is an object, not a string.
		// Serialize it so callers receive a JSON string as normal.
		if (event.type === 'result' && event.result !== null && typeof event.result === 'object') {
			return JSON.stringify(event.result);
		}
		if (event.type === 'result' && typeof event.response === 'string') { return event.response; }
		if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text) {
			return String(event.item.text);
		}
	} catch { /* not a parseable event */ }
	return null;
}

/** Returns true if a line is a parseable JSONL event object (has a string `type` field). */
function isJsonlEventLine(line: string): boolean {
	try {
		const event = JSON.parse(line);
		return event.type !== null && event.type !== undefined && typeof event.type === 'string';
	} catch { return false; }
}

/** Extract Gemini assistant message chunks from JSONL stream lines. */
function extractGeminiMessageChunks(lines: string[]): string {
	const chunks: string[] = [];
	for (const line of lines) {
		try {
			const event = JSON.parse(line);
			if (event.type === 'message' && event.role === 'assistant' && event.content) {
				chunks.push(String(event.content));
			}
		} catch { /* skip non-JSON lines */ }
	}
	return chunks.join('');
}

/**
 * Extract the final model response from a streaming JSONL output.
 * Walks backward through lines to find the result event (emitted last by most CLIs).
 * Works with Claude Code, Codex, and Gemini stream formats.
 */
export function extractFinalResponseFromStream(rawOutput: string): string {
	const lines = rawOutput.split('\n').filter((l) => l.trim());

	// Pass 1: Explicit result/completion events (backward scan — Claude Code, Codex)
	for (let i = lines.length - 1; i >= 0; i--) {
		const response = extractResultEventResponse(lines[i]);
		if (response !== null) { return response; }
	}

	// Pass 2: Gemini message event chunks (forward scan)
	const messageText = extractGeminiMessageChunks(lines);
	if (messageText) { return messageText; }

	// Pass 3: Gemini 2.5 raw-text mode — output is plain text with only init/error events as JSONL.
	// Strip all parseable event objects and return the remaining content lines.
	const nonEventLines = lines.filter((l) => !isJsonlEventLine(l));
	if (nonEventLines.length > 0) { return nonEventLines.join('\n'); }

	return rawOutput;
}
