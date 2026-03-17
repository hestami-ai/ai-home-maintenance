/**
 * Shared CLI Role Invoker
 *
 * Provides a single entry point for invoking any CLI provider with streaming,
 * auto-approve, and optional workflow command tracking. Eliminates boilerplate
 * across all role invocation functions.
 *
 * All invocations are streaming by default (`outputFormat: 'stream-json'`,
 * `autoApprove: true`). The final model response is extracted from the JSONL
 * stream automatically.
 *
 * Provider-agnostic: works identically with Claude Code, Codex CLI, and Gemini CLI.
 */

import type { Result } from '../types';
import type { RoleCLIProvider } from './roleCLIProvider';
import type { RoleCLIResult, RoleCLIInvocationOptions, CLIActivityEvent } from './types';
import { extractFinalResponseFromStream } from './types';

/** No-op event handler for invocations that don't need event forwarding. */
const noop: (event: CLIActivityEvent) => void = () => {};

/**
 * Options for the core streaming invocation.
 * Only `provider` and `stdinContent` are required — everything else has sensible defaults.
 */
export interface RoleInvokeOptions {
	/** The resolved CLI provider to use. */
	provider: RoleCLIProvider;

	/** stdin content (system prompt + context). */
	stdinContent: string;

	/** Streaming event callback. Defaults to no-op. */
	onEvent?: (event: CLIActivityEvent) => void;

	/** Working directory for the CLI process. */
	workingDirectory?: string;

	/** Timeout in milliseconds (default: provider default, typically 300s). */
	timeout?: number;

	/** MCP config file paths (Claude Code only). Cleaned up automatically after invocation. */
	mcpConfigPaths?: string[];

	/** Restrict which tools the CLI can use without approval (Claude Code). */
	allowedTools?: string[];

	/** Sandbox mode for Codex CLI ('read-only' | 'workspace-write' | 'full-access'). */
	sandboxMode?: RoleCLIInvocationOptions['sandboxMode'];

	/** MCP tool name for permission prompt handling (Claude Code). */
	permissionPromptTool?: string;

	/** Model override. */
	model?: string;

	/** AbortSignal for cancellation. */
	signal?: AbortSignal;
}

/**
 * Invoke a CLI provider with streaming, auto-approve, and automatic response extraction.
 *
 * This is the core invocation function used by all roles. It:
 * 1. Calls `provider.invokeStreaming()` with `outputFormat: 'stream-json'` and `autoApprove: true`
 * 2. Forwards streaming events to `onEvent` (or discards them with a no-op)
 * 3. Extracts the final model response from the JSONL stream
 *
 * @returns Result containing the CLI result with the extracted response in `.response`
 */
export async function invokeRoleStreaming(
	options: RoleInvokeOptions
): Promise<Result<RoleCLIResult>> {
	const invokeOptions: RoleCLIInvocationOptions = {
		stdinContent: options.stdinContent,
		outputFormat: 'stream-json',
		autoApprove: true,
	};

	// Apply optional fields only when provided
	if (options.workingDirectory) { invokeOptions.workingDirectory = options.workingDirectory; }
	if (options.timeout !== undefined) { invokeOptions.timeout = options.timeout; }
	if (options.mcpConfigPaths) { invokeOptions.mcpConfigPaths = options.mcpConfigPaths; }
	if (options.allowedTools) { invokeOptions.allowedTools = options.allowedTools; }
	if (options.sandboxMode) { invokeOptions.sandboxMode = options.sandboxMode; }
	if (options.permissionPromptTool) { invokeOptions.permissionPromptTool = options.permissionPromptTool; }
	if (options.model) { invokeOptions.model = options.model; }
	if (options.signal) { invokeOptions.signal = options.signal; }

	const result = await options.provider.invokeStreaming(
		invokeOptions,
		options.onEvent ?? noop
	);

	// Extract final model response from JSONL stream output
	if (result.success) {
		result.value.response = extractFinalResponseFromStream(result.value.rawOutput);

		// Treat non-zero exit code as failure — the CLI process ran but the model
		// encountered an error (e.g., token limit, tool failure, invalid output).
		if (result.value.exitCode !== 0 && result.value.exitCode !== undefined) {
			return {
				success: false,
				error: new Error(
					`CLI exited with code ${result.value.exitCode}` +
					(result.value.response ? `: ${result.value.response.substring(0, 200)}` : '')
				),
			};
		}
	}

	return result;
}
