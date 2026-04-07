/**
 * Fake ID generators for deterministic tests.
 * Mocks crypto.randomUUID to return sequential, predictable IDs.
 */

import { vi } from 'vitest';

export interface DeterministicIds {
	/** Get the next ID that will be generated */
	peekNext(): string;
	/** Reset the counter */
	reset(): void;
	/** Restore the real randomUUID */
	restore(): void;
}

function makeId(n: number): string {
	const hex = n.toString(16).padStart(12, '0');
	return `00000000-0000-0000-0000-${hex}`;
}

/**
 * Install a deterministic UUID generator.
 * Produces IDs like: 00000000-0000-0000-0000-000000000001, ...0002, etc.
 */
export function useDeterministicIds(): DeterministicIds {
	let counter = 0;

	const spy = vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => {
		counter++;
		return makeId(counter) as `${string}-${string}-${string}-${string}-${string}`;
	});

	return {
		peekNext(): string {
			return makeId(counter + 1);
		},
		reset(): void {
			counter = 0;
		},
		restore(): void {
			spy.mockRestore();
		},
	};
}
