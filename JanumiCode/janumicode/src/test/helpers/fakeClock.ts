/**
 * Fake Clock for deterministic time in tests.
 * Wraps vitest's fake timers with a convenient API.
 */

import { vi } from 'vitest';

export interface DeterministicClock {
	/** Advance time by the given number of milliseconds */
	tick(ms: number): void;
	/** Get the current fake time */
	now(): number;
	/** Restore real timers */
	restore(): void;
}

/**
 * Install fake timers starting at a deterministic epoch.
 * Default start: 2026-01-01T00:00:00.000Z
 */
export function useDeterministicClock(
	startTime: number = Date.UTC(2026, 0, 1)
): DeterministicClock {
	vi.useFakeTimers({ now: startTime });

	return {
		tick(ms: number): void {
			vi.advanceTimersByTime(ms);
		},
		now(): number {
			return Date.now();
		},
		restore(): void {
			vi.useRealTimers();
		},
	};
}
