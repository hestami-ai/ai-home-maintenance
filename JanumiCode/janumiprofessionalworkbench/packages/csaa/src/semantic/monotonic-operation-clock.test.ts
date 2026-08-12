import { describe, expect, it, vi } from 'vitest';

import { createMonotonicOperationClock } from './monotonic-operation-clock.js';

describe('createMonotonicOperationClock', () => {
	it('anchors once to wall time and advances only by monotonic elapsed milliseconds', () => {
		const wallNow = vi.fn().mockReturnValueOnce(10_000).mockReturnValueOnce(1);
		const monotonicValues = [250.25, 250.75, 251.25, 255.99];
		const clock = createMonotonicOperationClock({
			monotonicNow: () => monotonicValues.shift()!,
			wallNow
		});
		expect(clock.startedAtMs).toBe(10_000);
		expect([clock.now(), clock.now(), clock.now()]).toEqual([10_000, 10_001, 10_005]);
		expect(wallNow).toHaveBeenCalledTimes(1);
	});

	it('fails closed if its monotonic source regresses or becomes invalid', () => {
		const regressedValues = [100, 101, 100.5];
		const regressed = createMonotonicOperationClock({
			monotonicNow: () => regressedValues.shift()!,
			wallNow: () => 1_000
		});
		expect(regressed.now()).toBe(1_001);
		expect(() => regressed.now()).toThrow('Operation monotonic clock failed closed.');

		const invalidValues = [100, Number.NaN];
		const invalid = createMonotonicOperationClock({
			monotonicNow: () => invalidValues.shift()!,
			wallNow: () => 1_000
		});
		expect(() => invalid.now()).toThrow('Operation monotonic clock failed closed.');
	});

	it('rejects invalid anchors and safe-integer overflow', () => {
		expect(() =>
			createMonotonicOperationClock({ monotonicNow: () => 0, wallNow: () => 1.5 })
		).toThrow('wall-clock anchor');
		expect(() =>
			createMonotonicOperationClock({ monotonicNow: () => Number.POSITIVE_INFINITY })
		).toThrow('monotonic-clock anchor');

		const values = [0, 2];
		const overflow = createMonotonicOperationClock({
			monotonicNow: () => values.shift()!,
			wallNow: () => Number.MAX_SAFE_INTEGER
		});
		expect(() => overflow.now()).toThrow('safe integer');
	});
});
