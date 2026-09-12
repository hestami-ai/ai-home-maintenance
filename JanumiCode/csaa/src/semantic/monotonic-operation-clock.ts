import { performance } from 'node:perf_hooks';

export interface MonotonicOperationClock {
	readonly now: () => number;
	readonly startedAtMs: number;
}

export interface MonotonicOperationClockSources {
	readonly monotonicNow?: () => number;
	readonly wallNow?: () => number;
}

/**
 * Produces safe-integer, wall-anchored timestamps from elapsed monotonic time.
 * The wall clock is sampled exactly once, so later clock synchronization cannot
 * make an in-flight duration budget appear to run backward.
 */
export function createMonotonicOperationClock(
	sources: MonotonicOperationClockSources = {}
): MonotonicOperationClock {
	const wallNow = sources.wallNow ?? Date.now;
	const monotonicNow = sources.monotonicNow ?? (() => performance.now());
	const startedAtMs = wallNow();
	const monotonicStartedAtMs = monotonicNow();
	if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0)
		throw new Error('Operation wall-clock anchor must be a non-negative safe integer.');
	if (!Number.isFinite(monotonicStartedAtMs) || monotonicStartedAtMs < 0)
		throw new Error('Operation monotonic-clock anchor must be a finite non-negative number.');
	let lastMonotonicMs = monotonicStartedAtMs;
	let lastReturnedMs = startedAtMs;
	const now = (): number => {
		const observedMonotonicMs = monotonicNow();
		if (
			!Number.isFinite(observedMonotonicMs) ||
			observedMonotonicMs < lastMonotonicMs ||
			observedMonotonicMs < monotonicStartedAtMs
		)
			throw new Error('Operation monotonic clock failed closed.');
		lastMonotonicMs = observedMonotonicMs;
		const elapsedMs = Math.floor(observedMonotonicMs - monotonicStartedAtMs);
		const wallAnchoredMs = startedAtMs + elapsedMs;
		if (!Number.isSafeInteger(wallAnchoredMs) || wallAnchoredMs < lastReturnedMs)
			throw new Error('Operation wall-anchored monotonic time is not a safe integer.');
		lastReturnedMs = wallAnchoredMs;
		return wallAnchoredMs;
	};
	return Object.freeze({ now, startedAtMs });
}
