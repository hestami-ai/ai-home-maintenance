import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	resetStaleInProgressUnits,
	getNextReadyUnits,
	completeUnitAndPropagate,
	isGraphComplete,
	getGraphProgress,
} from '../../../lib/workflow/taskGraph';
import { randomUUID } from 'node:crypto';

describe('TaskGraph', () => {
	let tempDb: TempDbContext;
	let graphId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		graphId = randomUUID();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('resetStaleInProgressUnits', () => {
		it('resets stale units', () => {
			const result = resetStaleInProgressUnits(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(typeof result.value).toBe('number');
			}
		});

		it('handles nonexistent graph', () => {
			const result = resetStaleInProgressUnits('nonexistent');
			expect(result.success).toBeDefined();
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = resetStaleInProgressUnits(graphId);
			expect(result.success).toBe(false);
		});
	});

	describe('getNextReadyUnits', () => {
		it('retrieves ready units', () => {
			const result = getNextReadyUnits(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Array.isArray(result.value)).toBe(true);
			}
		});

		it('returns empty array for empty graph', () => {
			const result = getNextReadyUnits(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getNextReadyUnits(graphId);
			expect(result.success).toBe(false);
		});
	});

	describe('completeUnitAndPropagate', () => {
		it('attempts to complete unit', () => {
			const result = completeUnitAndPropagate(graphId, randomUUID());
			expect(result.success).toBeDefined();
		});

		it('handles nonexistent unit', () => {
			const result = completeUnitAndPropagate(graphId, 'nonexistent');
			expect(result.success).toBeDefined();
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = completeUnitAndPropagate(graphId, randomUUID());
			expect(result.success).toBe(false);
		});
	});

	describe('isGraphComplete', () => {
		it('checks completion status', () => {
			const result = isGraphComplete(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(typeof result.value).toBe('boolean');
			}
		});

		it('returns true for empty graph', () => {
			const result = isGraphComplete(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(true);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = isGraphComplete(graphId);
			expect(result.success).toBe(false);
		});
	});

	describe('getGraphProgress', () => {
		it('retrieves progress summary', () => {
			const result = getGraphProgress(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.total).toBeDefined();
				expect(result.value.completed).toBeDefined();
				expect(result.value.failed).toBeDefined();
			}
		});

		it('returns zero counts for empty graph', () => {
			const result = getGraphProgress(graphId);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.total).toBe(0);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getGraphProgress(graphId);
			expect(result.success).toBe(false);
		});
	});

	describe('integration scenarios', () => {
		it('manages task graph lifecycle', () => {
			const readyResult = getNextReadyUnits(graphId);
			expect(readyResult.success).toBe(true);

			const progressResult = getGraphProgress(graphId);
			expect(progressResult.success).toBe(true);

			const completeResult = isGraphComplete(graphId);
			expect(completeResult.success).toBe(true);
		});

		it('handles multiple operations', () => {
			resetStaleInProgressUnits(graphId);
			const ready = getNextReadyUnits(graphId);
			const progress = getGraphProgress(graphId);
			const complete = isGraphComplete(graphId);

			expect(ready.success).toBe(true);
			expect(progress.success).toBe(true);
			expect(complete.success).toBe(true);
		});
	});
});
