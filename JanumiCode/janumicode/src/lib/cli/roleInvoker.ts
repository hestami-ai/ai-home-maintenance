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
import { reviewAgentReasoning } from '../review/reasoningReviewer';
import * as vscode from 'vscode';
import { getActiveDialogue } from '../dialogue/lifecycle';

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

	/** Pre-registered MCP server names to allow (Gemini CLI --allowed-mcp-server-names). */
	allowedMcpServerNames?: string[];

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

	/** Dialogue ID — if provided, reasoning review concerns are stored as dialogue events. */
	dialogueId?: string;

	/**
	 * JSON Schema string for structured output enforcement (Claude Code --json-schema).
	 * Passed through to the provider unchanged; ignored by non-Claude-Code providers.
	 */
	jsonSchema?: string;
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
	if (options.allowedMcpServerNames) { invokeOptions.allowedMcpServerNames = options.allowedMcpServerNames; }
	if (options.allowedTools) { invokeOptions.allowedTools = options.allowedTools; }
	if (options.sandboxMode) { invokeOptions.sandboxMode = options.sandboxMode; }
	if (options.permissionPromptTool) { invokeOptions.permissionPromptTool = options.permissionPromptTool; }
	if (options.model) { invokeOptions.model = options.model; }
	if (options.signal) { invokeOptions.signal = options.signal; }
	if (options.jsonSchema) { invokeOptions.jsonSchema = options.jsonSchema; }

	const result = await options.provider.invokeStreaming(
		invokeOptions,
		options.onEvent ?? noop
	);

	// Extract final model response from JSONL stream output
	if (result.success) {
		result.value.response = extractFinalResponseFromStream(result.value.rawOutput);

		// Non-zero exit code handling:
		// Gemini CLI fatal exit codes (41–53) always indicate a hard failure —
		// skip the heuristic and fail immediately. Other non-zero codes (e.g. 1)
		// are ambiguous: Gemini emits exit code 1 even on successful completions,
		// so we fall through to the model-output heuristic for those.
		if (result.value.exitCode !== 0 && result.value.exitCode !== undefined) {
			if (isGeminiFatalExitCode(result.value.exitCode)) {
				const resp = (result.value.response ?? '').trim();
				const diagnostic = resp || (result.value.rawOutput ?? '').trim();
				return {
					success: false,
					error: new Error(
						`CLI exited with fatal code ${result.value.exitCode}` +
						(diagnostic ? `: ${diagnostic.substring(0, 500)}` : '')
					),
				};
			}

			// For other non-zero exit codes: check if the response looks like genuine
			// model output or a CLI error message (auth failure, SSL, missing module, etc.)
			const resp = (result.value.response ?? '').trim();
			const looksLikeModelOutput = resp.length > 50 && resp.includes('{') && !isCliErrorMessage(resp);

			if (looksLikeModelOutput) {
				// Response looks like actual model output — return it with a warning flag
				result.value.warning = `CLI exited with code ${result.value.exitCode} but produced a response`;
			} else {
				// Include both response and raw output for maximum diagnostic info
				const diagnostic = resp || (result.value.rawOutput ?? '').trim();
				return {
					success: false,
					error: new Error(
						`CLI exited with code ${result.value.exitCode}` +
						(diagnostic ? `: ${diagnostic.substring(0, 500)}` : '')
					),
				};
			}
		}
	}

	// Run reasoning review on successful results (non-blocking — attached to result)
	if (result.success && result.value.response) {
		try {
			const minSev = vscode?.workspace?.getConfiguration('janumicode')
				?.get<string>('reasoningReviewer.minSeverity', 'MEDIUM') as import('../review/reviewTypes').ReviewSeverity | undefined;

			const review = await reviewAgentReasoning({
				rawStreamOutput: result.value.rawOutput,
				finalResponse: result.value.response,
				role: options.provider?.id,
				minSeverity: minSev,
			});

			// Always persist the review result — even clean reviews and failures —
			// so the user can see that a review was attempted and what happened.
			try {
				const dialogueId = options.dialogueId ?? getActiveDialogueId();
				if (dialogueId) {
					const db = (await import('../database/init.js')).getDatabase();
					if (db) {
						const cmd = db.prepare(`
							SELECT command_id FROM workflow_commands
							WHERE dialogue_id = ?
							ORDER BY started_at DESC LIMIT 1
						`).get(dialogueId) as { command_id: string } | undefined;

						if (cmd) {
							const { appendCommandOutput } = await import('../workflow/commandStore.js');
							if (review) {
								result.value.reasoningReview = review.hasConcerns ? review : undefined;
								const reviewData = {
									concerns: review.concerns,
									overallAssessment: review.overallAssessment || (review.hasConcerns ? '' : 'No concerns found — reasoning appears sound.'),
									reviewerModel: review.reviewerModel,
									durationMs: review.reviewDurationMs,
									reviewPrompt: review.reviewPrompt,
								};
								appendCommandOutput(
									cmd.command_id,
									'reasoning_review' as import('../workflow/commandStore.js').WorkflowCommandOutput['line_type'],
									JSON.stringify(reviewData),
									new Date().toISOString(),
								);
								// Emit event so the webview can render the review card immediately
								try {
									const { getEventBus } = await import('../integration/eventBus.js');
									getEventBus().emit('reasoning:review_ready' as never, {
										commandId: cmd.command_id,
										dialogueId,
										review: reviewData,
									} as never);
								} catch { /* non-fatal */ }
							} else {
								// Review returned null — provider unavailable or call failed
								appendCommandOutput(
									cmd.command_id,
									'reasoning_review' as import('../workflow/commandStore.js').WorkflowCommandOutput['line_type'],
									JSON.stringify({
										concerns: [],
										overallAssessment: 'Reasoning review could not be completed — reviewer unavailable or LLM call failed.',
										reviewerModel: 'unknown',
										durationMs: 0,
										failed: true,
									}),
									new Date().toISOString(),
								);
							}
						}
					}
				}
			} catch { /* non-fatal — don't block the workflow */ }
		} catch (reviewError) {
			// Reviewer failure is non-fatal — but log it so we know it's happening
			try {
				const dialogueId = options.dialogueId ?? getActiveDialogueId();
				if (dialogueId) {
					const db = (await import('../database/init.js')).getDatabase();
					if (db) {
						const cmd = db.prepare(`
							SELECT command_id FROM workflow_commands
							WHERE dialogue_id = ?
							ORDER BY started_at DESC LIMIT 1
						`).get(dialogueId) as { command_id: string } | undefined;
						if (cmd) {
							const { appendCommandOutput } = await import('../workflow/commandStore.js');
							appendCommandOutput(
								cmd.command_id,
								'reasoning_review' as import('../workflow/commandStore.js').WorkflowCommandOutput['line_type'],
								JSON.stringify({
									concerns: [],
									overallAssessment: `Reasoning review failed: ${reviewError instanceof Error ? reviewError.message : String(reviewError)}`,
									reviewerModel: 'unknown',
									durationMs: 0,
									failed: true,
								}),
								new Date().toISOString(),
							);
						}
					}
				}
			} catch { /* truly non-fatal fallback */ }
		}
	}

	// Soft pause for HIGH-severity reasoning reviews — gives user time to act
	if (result.success && result.value.reasoningReview?.hasConcerns) {
		const hasHighSeverity = result.value.reasoningReview.concerns.some(
			(c: { severity: string }) => c.severity === 'HIGH'
		);
		if (hasHighSeverity) {
			const pauseSec = vscode?.workspace?.getConfiguration('janumicode')
				?.get<number>('reasoningReviewer.highSeverityPauseSeconds', 15) ?? 15;
			if (pauseSec > 0) {
				// Emit event so UI can show countdown
				options.onEvent?.({
					timestamp: new Date().toISOString(),
					eventType: 'message',
					summary: `Reasoning review found HIGH-severity concerns — pausing ${pauseSec}s for review`,
				});
				// Wait (interruptible via abort signal)
				await new Promise<void>((resolve) => {
					const timer = setTimeout(resolve, pauseSec * 1000);
					options.signal?.addEventListener('abort', () => {
						clearTimeout(timer);
						resolve();
					}, { once: true });
				});
			}
		}
	}

	return result;
}

/** Resolve the active dialogue ID from the database (fallback when callers don't pass it). */
function getActiveDialogueId(): string | null {
	try {
		const result = getActiveDialogue();
		return result.success && result.value ? result.value.dialogue_id : null;
	} catch {
		return null;
	}
}

/**
 * Gemini CLI fatal exit codes — always a hard failure, no heuristic needed.
 * https://google-gemini.github.io/gemini-cli/docs/troubleshooting.html
 */
function isGeminiFatalExitCode(code: number): boolean {
	// 41=FatalAuthenticationError, 42=FatalInputError, 44=FatalSandboxError,
	// 52=FatalConfigError, 53=FatalTurnLimitedError
	return code === 41 || code === 42 || code === 44 || code === 52 || code === 53;
}

/**
 * Detect CLI error messages that should NOT be treated as model output.
 * These are infrastructure errors from the CLI tool itself, not LLM responses.
 * Covers common patterns from Claude Code, Codex, and Gemini CLI error output.
 */
function isCliErrorMessage(text: string): boolean {
	// Only scan the first 500 chars — CLI error messages appear at the start of output,
	// not buried in model-generated content that may contain any architectural terminology
	// (e.g. "authentication", "not found", "ssl" appear legitimately in architecture docs).
	const lower = text.substring(0, 500).toLowerCase();
	const errorPatterns = [
		// Quota / billing
		'usage limit',
		'rate limit',
		'quota exceeded',
		'upgrade to pro',
		'api key',
		// Auth (Gemini: "failed to login", "invalid argument"; generic)
		'authentication failed',
		'authentication error',
		'failed to login',
		'invalid argument',
		'unauthorized',
		'forbidden',
		// Network / TLS (Gemini: "unable_to_get_issuer_cert_locally")
		'connection refused',
		'network error',
		'timed out',
		'econnrefused',
		'enotfound',
		'certificate error',
		'ssl error',
		'unable_to_get_issuer_cert_locally',
		'unable to get local issuer certificate',
		// Runtime / module errors (Gemini: "MODULE_NOT_FOUND", "command not found")
		'module_not_found',
		'command not found',
		'operation not permitted',
		'permission denied',
		// HTTP server errors
		'internal server error',
		'502 bad gateway',
		'503 service unavailable',
	];
	return errorPatterns.some(pattern => lower.includes(pattern));
}
