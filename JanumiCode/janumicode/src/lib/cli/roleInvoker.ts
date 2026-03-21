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

		// Non-zero exit code handling:
		// If the CLI exited with a non-zero code but produced a response that looks
		// like actual model output (contains JSON), treat as soft failure.
		// Hard-fail if the response is empty, too short, or looks like a CLI error message.
		if (result.value.exitCode !== 0 && result.value.exitCode !== undefined) {
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
			if (review?.hasConcerns) {
				result.value.reasoningReview = review;

				// Persist as a command output on the most recent running/completed command.
				// This ensures the review renders alongside the command block it reviewed,
				// not as a standalone event at an unpredictable position.
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
										concerns: review.concerns,
										overallAssessment: review.overallAssessment,
										reviewerModel: review.reviewerModel,
										durationMs: review.reviewDurationMs,
									}),
									new Date().toISOString(),
								);
							}
						}
					}
				} catch { /* non-fatal */ }
			}
		} catch {
			// Reviewer failure is non-fatal — don't block the workflow
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
 * Detect CLI error messages that should NOT be treated as model output.
 * These are infrastructure errors from the CLI tool itself, not LLM responses.
 */
function isCliErrorMessage(text: string): boolean {
	const lower = text.toLowerCase();
	const errorPatterns = [
		'usage limit',
		'rate limit',
		'quota exceeded',
		'upgrade to pro',
		'api key',
		'authentication',
		'unauthorized',
		'forbidden',
		'connection refused',
		'network error',
		'timed out',
		'econnrefused',
		'enotfound',
		'certificate',
		'ssl',
		'permission denied',
		'not found',
		'internal server error',
		'502 bad gateway',
		'503 service unavailable',
	];
	return errorPatterns.some(pattern => lower.includes(pattern));
}
