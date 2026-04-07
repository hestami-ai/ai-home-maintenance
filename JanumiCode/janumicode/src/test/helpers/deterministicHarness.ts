import { vi } from 'vitest';
import { useDeterministicClock, type DeterministicClock } from './fakeClock';
import { useDeterministicIds, type DeterministicIds } from './fakeIds';

export interface DeterministicHarness {
	seed: number;
	clock: DeterministicClock | null;
	ids: DeterministicIds;
	restore: () => void;
}

function parseSeed(raw?: string): number {
	if (!raw) { return 1337; }
	const n = Number.parseInt(raw, 10);
	if (Number.isNaN(n)) { return 1337; }
	return n >>> 0;
}

function createSeededRandom(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		// LCG constants from Numerical Recipes
		s = (1664525 * s + 1013904223) >>> 0;
		return s / 0x100000000;
	};
}

/**
 * Install deterministic test primitives:
 * - fake clock
 * - deterministic UUID sequence
 * - deterministic Math.random() (seeded)
 */
export function useDeterministicHarness(options?: {
	seed?: number;
	startTime?: number;
	useClock?: boolean;
}): DeterministicHarness {
	const seed = options?.seed ?? parseSeed(process.env.JANUMICODE_TEST_SEED);
	const useClock = options?.useClock ?? true;
	const clock = useClock ? useDeterministicClock(options?.startTime) : null;
	const ids = useDeterministicIds();
	const seededRandom = createSeededRandom(seed);
	const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seededRandom());

	return {
		seed,
		clock,
		ids,
		restore: () => {
			randomSpy.mockRestore();
			ids.restore();
			clock?.restore();
		},
	};
}
