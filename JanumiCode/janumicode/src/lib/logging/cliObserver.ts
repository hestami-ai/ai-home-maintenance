/**
 * CLI Observability Hooks
 * Provides structured logging for all CLI provider lifecycle events:
 * detection, resolution, invocation, process spawning, and completion.
 *
 * Usage:
 *   import { cliObserver } from '../logging';
 *   cliObserver.onDetect('gemini-cli', detectionResult);
 *   cliObserver.onResolve('executor', 'claude-code', 'configured');
 *   cliObserver.onInvoke('claude-code', { command: '...', stdinSize: 1234 });
 *   cliObserver.onComplete('claude-code', { exitCode: 0, elapsed: 4500 });
 */

import type { LogContext } from './logger';
import { getLogger, isLoggerInitialized } from './logger';
import type { CLIProviderInfo } from '../cli/types';
import type { Result } from '../types';

/**
 * Lazily get a child logger scoped to 'cli'.
 * Returns null if the logger hasn't been initialized yet.
 */
function getCLILogger(extra?: LogContext) {
	if (!isLoggerInitialized()) {
		return null;
	}
	const base = getLogger().child({ component: 'cli' });
	return extra ? base.child(extra) : base;
}

// ── Detection ─────────────────────────────────────────────────────────

/**
 * Log the result of a CLI provider detection attempt.
 */
export function onDetect(
	providerId: string,
	result: Result<CLIProviderInfo>,
	elapsedMs?: number
): void {
	const log = getCLILogger({ providerId });
	if (!log) {
		return;
	}

	if (result.success && result.value.available) {
		log.info('CLI detected', {
			version: result.value.version,
			apiKeyConfigured: result.value.apiKeyConfigured,
			elapsedMs,
		});
	} else if (result.success && !result.value.available) {
		log.warn('CLI not available', {
			requiresApiKey: result.value.requiresApiKey,
			apiKeyConfigured: result.value.apiKeyConfigured,
			elapsedMs,
		});
	} else {
		log.error('CLI detection failed', {
			error: result.success ? undefined : result.error.message,
			elapsedMs,
		});
	}
}

// ── Resolution ────────────────────────────────────────────────────────

export type ResolutionOutcome =
	| 'configured-cli'
	| 'api-fallback'
	| 'not-available'
	| 'not-found'
	| 'error';

/**
 * Log the outcome of resolving a CLI provider for a role.
 */
export function onResolve(
	role: string,
	providerId: string,
	outcome: ResolutionOutcome,
	detail?: string
): void {
	const log = getCLILogger({ role, providerId });
	if (!log) {
		return;
	}

	switch (outcome) {
		case 'configured-cli':
			log.info('Provider resolved via CLI', { role });
			break;
		case 'api-fallback':
			log.info('Provider resolved via API fallback', { role, detail });
			break;
		case 'not-available':
			log.warn('Configured CLI not available — resolution failed', { role, detail });
			break;
		case 'not-found':
			log.warn('CLI provider not registered — resolution failed', { role, detail });
			break;
		case 'error':
			log.error('Provider resolution error', { role, detail });
			break;
	}
}

// ── Invocation ────────────────────────────────────────────────────────

export interface InvokeLogData {
	command?: string;
	args?: string[];
	stdinSize?: number;
	cwd?: string;
	outputFormat?: string;
}

/**
 * Log the start of a CLI invocation (before spawn).
 */
export function onInvokeStart(
	providerId: string,
	data: InvokeLogData,
	context?: LogContext
): void {
	const log = getCLILogger({ providerId, ...context });
	if (!log) {
		return;
	}

	log.debug('Invoking CLI', {
		command: data.command,
		args: data.args?.join(' '),
		stdinSize: data.stdinSize,
		cwd: data.cwd,
		outputFormat: data.outputFormat,
	});
}

// ── Spawn / Process ───────────────────────────────────────────────────

/**
 * Log a process spawn event.
 */
export function onSpawn(
	providerId: string,
	pid: number | undefined,
	context?: LogContext
): void {
	const log = getCLILogger({ providerId, ...context });
	if (!log) {
		return;
	}
	log.debug('Process spawned', { pid });
}

/**
 * Log process stderr output (truncated).
 */
export function onStderr(
	providerId: string,
	stderr: string,
	context?: LogContext
): void {
	const log = getCLILogger({ providerId, ...context });
	if (!log) {
		return;
	}
	const truncated = stderr.length > 500 ? `${stderr.substring(0, 500)}…` : stderr;
	log.warn('CLI stderr output', { stderr: truncated });
}

// ── Completion ────────────────────────────────────────────────────────

export interface CompletionLogData {
	exitCode: number;
	elapsedMs: number;
	responseSize?: number;
	stdout?: string;
	stderr?: string;
}

/**
 * Log CLI invocation completion (success or failure).
 */
export function onComplete(
	providerId: string,
	data: CompletionLogData,
	context?: LogContext
): void {
	const log = getCLILogger({ providerId, ...context });
	if (!log) {
		return;
	}

	if (data.exitCode === 0) {
		log.info('CLI completed successfully', {
			exitCode: data.exitCode,
			elapsedMs: data.elapsedMs,
			responseSize: data.responseSize,
		});
	} else {
		const stderrSnippet = data.stderr
			? data.stderr.substring(0, 300)
			: undefined;
		log.error('CLI exited with error', {
			exitCode: data.exitCode,
			elapsedMs: data.elapsedMs,
			stderr: stderrSnippet,
		});
	}
}

// ── Spawn Errors ──────────────────────────────────────────────────────

/**
 * Log a spawn/OS-level error (e.g. ENOENT, EACCES).
 */
export function onSpawnError(
	providerId: string,
	error: Error,
	command?: string,
	context?: LogContext
): void {
	const log = getCLILogger({ providerId, ...context });
	if (!log) {
		return;
	}
	log.error('CLI spawn failed', {
		errorCode: (error as NodeJS.ErrnoException).code,
		errorMessage: error.message,
		command,
	});
}
