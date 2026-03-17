/**
 * Phase Runner — Step-Level Checkpoint Tracking
 *
 * Tracks step completion within a phase execution. When a phase fails
 * partway through, the checkpoint records which steps completed and
 * caches their results. On resume, completed steps are skipped and
 * cached results returned — avoiding expensive CLI re-invocations.
 *
 * Checkpoint data is stored in StateMetadata.phaseCheckpoint (SQLite JSON).
 * A version number ensures stale checkpoints (from code changes) are discarded.
 */

import { updateWorkflowMetadata, getWorkflowState } from './stateMachine';
import { getLogger, isLoggerInitialized } from '../logging';

// ==================== TYPES ====================

export interface PhaseCheckpoint {
	/** Which phase this checkpoint belongs to */
	phase: string;
	/** Bumped when phase step logic changes — stale checkpoints are discarded */
	version: number;
	/** Map of step name → completion/failure record */
	steps: Record<string, StepRecord>;
	/** ISO timestamp of checkpoint creation */
	startedAt: string;
	/** ISO timestamp of last step update */
	lastUpdatedAt: string;
}

export interface StepRecord {
	status: 'completed' | 'failed';
	/** Cached return value from the step (for expensive steps) */
	result?: unknown;
	/** Error message if step failed */
	error?: string;
	/** ISO timestamp of step completion/failure */
	completedAt: string;
}

// ==================== PHASE RUNNER ====================

export interface PhaseRunner {
	/**
	 * Execute a named step. If the step already completed in a prior run,
	 * returns the cached result without re-executing. Otherwise executes
	 * the function, saves the checkpoint, and returns the result.
	 *
	 * On failure, records the error in the checkpoint and re-throws.
	 *
	 * @param name Unique step name within this phase
	 * @param fn The function to execute
	 * @param options.cache Whether to cache the result (default: true)
	 */
	step<T>(name: string, fn: () => Promise<T> | T, options?: { cache?: boolean }): Promise<T>;

	/** Check if a specific step has already been completed. */
	isCompleted(name: string): boolean;

	/** Get the cached result from a completed step. */
	getCachedResult<T>(name: string): T | undefined;

	/**
	 * Clear the checkpoint entirely. Call on phase success
	 * so the next execution starts fresh.
	 */
	clear(): void;

	/** Get the name of the first failed step, if any. */
	getFailedStep(): string | undefined;

	/**
	 * Get a summary of checkpoint state for UI messaging.
	 * Returns null if no checkpoint exists (fresh run).
	 */
	getResumeSummary(): { completedCount: number; failedStep?: string; phase: string } | null;
}

/**
 * Create a PhaseRunner for step-level checkpoint tracking.
 *
 * @param dialogueId The dialogue this phase belongs to
 * @param phase Phase name (e.g., 'PROPOSE', 'VERIFY')
 * @param version Checkpoint version — increment when step logic changes
 */
export function createPhaseRunner(
	dialogueId: string,
	phase: string,
	version: number
): PhaseRunner {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'phaseRunner', dialogueId, phase })
		: undefined;

	// Load existing checkpoint from metadata
	const stateResult = getWorkflowState(dialogueId);
	let checkpoint: PhaseCheckpoint | undefined;

	if (stateResult.success) {
		const metadata = JSON.parse(stateResult.value.metadata);
		const existing = metadata.phaseCheckpoint as PhaseCheckpoint | undefined;

		if (existing && existing.phase === phase && existing.version === version) {
			checkpoint = existing;
			const completedSteps = Object.entries(existing.steps)
				.filter(([, s]) => s.status === 'completed')
				.map(([name]) => name);
			const failedStep = Object.entries(existing.steps)
				.find(([, s]) => s.status === 'failed')?.[0];
			log?.info('Resuming phase with checkpoint', { completedSteps, failedStep });
		} else if (existing) {
			log?.info('Discarding stale checkpoint', {
				existingPhase: existing.phase,
				existingVersion: existing.version,
				currentPhase: phase,
				currentVersion: version,
			});
		}
	}

	// Initialize fresh checkpoint if none loaded
	if (!checkpoint) {
		const now = new Date().toISOString();
		checkpoint = {
			phase,
			version,
			steps: {},
			startedAt: now,
			lastUpdatedAt: now,
		};
	}

	function saveCheckpoint(): void {
		updateWorkflowMetadata(dialogueId, { phaseCheckpoint: checkpoint });
	}

	return {
		async step<T>(
			name: string,
			fn: () => Promise<T> | T,
			options?: { cache?: boolean }
		): Promise<T> {
			const shouldCache = options?.cache !== false;

			// Check if step already completed
			const existing = checkpoint!.steps[name];
			if (existing?.status === 'completed') {
				log?.debug(`Step "${name}" already completed, returning cached result`);
				return existing.result as T;
			}

			// Execute the step
			log?.debug(`Executing step "${name}"`);
			try {
				const result = await fn();
				checkpoint!.steps[name] = {
					status: 'completed',
					result: shouldCache ? result : undefined,
					completedAt: new Date().toISOString(),
				};
				checkpoint!.lastUpdatedAt = new Date().toISOString();
				saveCheckpoint();
				return result;
			} catch (err) {
				checkpoint!.steps[name] = {
					status: 'failed',
					error: err instanceof Error ? err.message : String(err),
					completedAt: new Date().toISOString(),
				};
				checkpoint!.lastUpdatedAt = new Date().toISOString();
				saveCheckpoint();
				throw err;
			}
		},

		isCompleted(name: string): boolean {
			return checkpoint!.steps[name]?.status === 'completed';
		},

		getCachedResult<T>(name: string): T | undefined {
			const step = checkpoint!.steps[name];
			return step?.status === 'completed' ? step.result as T : undefined;
		},

		clear(): void {
			updateWorkflowMetadata(dialogueId, { phaseCheckpoint: undefined });
		},

		getFailedStep(): string | undefined {
			return Object.entries(checkpoint!.steps)
				.find(([, s]) => s.status === 'failed')?.[0];
		},

		getResumeSummary(): { completedCount: number; failedStep?: string; phase: string } | null {
			const completedCount = Object.values(checkpoint!.steps)
				.filter(s => s.status === 'completed').length;
			if (completedCount === 0 && !this.getFailedStep()) {
				return null; // Fresh run
			}
			return {
				completedCount,
				failedStep: this.getFailedStep(),
				phase,
			};
		},
	};
}
