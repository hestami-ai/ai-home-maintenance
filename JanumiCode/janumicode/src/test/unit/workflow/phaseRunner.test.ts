import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { createPhaseRunner } from '../../../lib/workflow/phaseRunner';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../lib/database/init';

describe('PhaseRunner', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();

		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(dialogueId);

		db.prepare(
			`INSERT INTO workflow_state (dialogue_id, current_phase, metadata, created_at, updated_at)
			 VALUES (?, 'PROPOSE', '{}', datetime('now'), datetime('now'))`
		).run(dialogueId);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('step execution', () => {
		it('executes step and caches result', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			let executionCount = 0;

			const result = await runner.step('test-step', async () => {
				executionCount++;
				return { data: 'value' };
			});

			expect(result).toEqual({ data: 'value' });
			expect(executionCount).toBe(1);
			expect(runner.isCompleted('test-step')).toBe(true);
		});

		it('returns cached result on second execution', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			let executionCount = 0;

			const result1 = await runner.step('test-step', async () => {
				executionCount++;
				return { data: 'first' };
			});

			const result2 = await runner.step('test-step', async () => {
				executionCount++;
				return { data: 'second' };
			});

			expect(result1).toEqual({ data: 'first' });
			expect(result2).toEqual({ data: 'first' });
			expect(executionCount).toBe(1);
		});

		it('executes synchronous steps', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			const result = await runner.step('sync-step', () => {
				return 42;
			});

			expect(result).toBe(42);
			expect(runner.isCompleted('sync-step')).toBe(true);
		});

		it('executes multiple steps independently', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			const result1 = await runner.step('step1', () => 'value1');
			const result2 = await runner.step('step2', () => 'value2');
			const result3 = await runner.step('step3', () => 'value3');

			expect(result1).toBe('value1');
			expect(result2).toBe('value2');
			expect(result3).toBe('value3');
			expect(runner.isCompleted('step1')).toBe(true);
			expect(runner.isCompleted('step2')).toBe(true);
			expect(runner.isCompleted('step3')).toBe(true);
		});

		it('skips caching when cache option is false', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await runner.step('no-cache', () => 'value', { cache: false });

			const cached = runner.getCachedResult('no-cache');
			expect(cached).toBeUndefined();
			expect(runner.isCompleted('no-cache')).toBe(true);
		});

		it('handles primitive return values', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			const str = await runner.step('string', () => 'text');
			const num = await runner.step('number', () => 123);
			const bool = await runner.step('boolean', () => true);
			const nil = await runner.step('null', () => null);

			expect(str).toBe('text');
			expect(num).toBe(123);
			expect(bool).toBe(true);
			expect(nil).toBeNull();
		});

		it('handles complex object return values', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			const complexObj = {
				nested: { value: 42 },
				array: [1, 2, 3],
				date: new Date().toISOString(),
			};

			const result = await runner.step('complex', () => complexObj);

			expect(result).toEqual(complexObj);
			expect(runner.getCachedResult('complex')).toEqual(complexObj);
		});
	});

	describe('error handling', () => {
		it('records error on step failure', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await expect(
				runner.step('failing-step', async () => {
					throw new Error('Test error');
				})
			).rejects.toThrow('Test error');

			expect(runner.isCompleted('failing-step')).toBe(false);
			expect(runner.getFailedStep()).toBe('failing-step');
		});

		it('saves error to checkpoint', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await expect(
				runner.step('fail', () => {
					throw new Error('Step failed');
				})
			).rejects.toThrow('Step failed');

			const db = getDatabase()!;
			const state = db.prepare(
				'SELECT metadata FROM workflow_state WHERE dialogue_id = ?'
			).get(dialogueId) as { metadata: string };
			const metadata = JSON.parse(state.metadata);

			expect(metadata.phaseCheckpoint.steps.fail.status).toBe('failed');
			expect(metadata.phaseCheckpoint.steps.fail.error).toContain('Step failed');
		});

		it('handles non-Error throws', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await expect(
				runner.step('string-throw', () => {
					// eslint-disable-next-line no-throw-literal -- intentional: test exercises non-Error throw path
					throw 'String error';
				})
			).rejects.toBe('String error');

			expect(runner.getFailedStep()).toBe('string-throw');
		});

		it('continues executing other steps after failure', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await expect(
				runner.step('fail', () => {
					throw new Error('Failed');
				})
			).rejects.toThrow();

			const result = await runner.step('success', () => 'value');

			expect(result).toBe('value');
			expect(runner.isCompleted('success')).toBe(true);
			expect(runner.getFailedStep()).toBe('fail');
		});
	});

	describe('checkpoint persistence', () => {
		it('persists checkpoint to database', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await runner.step('step1', () => 'result');

			const db = getDatabase()!;
			const state = db.prepare(
				'SELECT metadata FROM workflow_state WHERE dialogue_id = ?'
			).get(dialogueId) as { metadata: string };
			const metadata = JSON.parse(state.metadata);

			expect(metadata.phaseCheckpoint).toBeDefined();
			expect(metadata.phaseCheckpoint.phase).toBe('PROPOSE');
			expect(metadata.phaseCheckpoint.version).toBe(1);
			expect(metadata.phaseCheckpoint.steps.step1).toBeDefined();
		});

		it('loads checkpoint from database on resume', async () => {
			const runner1 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner1.step('step1', () => 'cached-value');

			const runner2 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			let executionCount = 0;
			const result = await runner2.step('step1', () => {
				executionCount++;
				return 'new-value';
			});

			expect(result).toBe('cached-value');
			expect(executionCount).toBe(0);
			expect(runner2.isCompleted('step1')).toBe(true);
		});

		it('updates lastUpdatedAt on each step', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await runner.step('step1', () => 'result');
			const db = getDatabase()!;
			const state1 = db.prepare(
				'SELECT metadata FROM workflow_state WHERE dialogue_id = ?'
			).get(dialogueId) as { metadata: string };
			const time1 = JSON.parse(state1.metadata).phaseCheckpoint.lastUpdatedAt;

			await new Promise(resolve => setTimeout(resolve, 10));

			await runner.step('step2', () => 'result');
			const state2 = db.prepare(
				'SELECT metadata FROM workflow_state WHERE dialogue_id = ?'
			).get(dialogueId) as { metadata: string };
			const time2 = JSON.parse(state2.metadata).phaseCheckpoint.lastUpdatedAt;

			expect(time2).not.toBe(time1);
		});

		it('stores completion timestamp for each step', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await runner.step('step1', () => 'result');

			const db = getDatabase()!;
			const state = db.prepare(
				'SELECT metadata FROM workflow_state WHERE dialogue_id = ?'
			).get(dialogueId) as { metadata: string };
			const metadata = JSON.parse(state.metadata);

			expect(metadata.phaseCheckpoint.steps.step1.completedAt).toBeDefined();
			expect(new Date(metadata.phaseCheckpoint.steps.step1.completedAt).getTime()).toBeGreaterThan(0);
		});
	});

	describe('version management', () => {
		it('discards checkpoint with different version', async () => {
			const runner1 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner1.step('step1', () => 'old-value');

			const runner2 = createPhaseRunner(dialogueId, 'PROPOSE', 2);
			let executionCount = 0;
			const result = await runner2.step('step1', () => {
				executionCount++;
				return 'new-value';
			});

			expect(result).toBe('new-value');
			expect(executionCount).toBe(1);
		});

		it('discards checkpoint for different phase', async () => {
			const runner1 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner1.step('step1', () => 'propose-value');

			const runner2 = createPhaseRunner(dialogueId, 'VERIFY', 1);
			let executionCount = 0;
			const result = await runner2.step('step1', () => {
				executionCount++;
				return 'verify-value';
			});

			expect(result).toBe('verify-value');
			expect(executionCount).toBe(1);
		});

		it('reuses checkpoint with matching phase and version', async () => {
			const runner1 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner1.step('step1', () => 'cached');

			const runner2 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			const result = await runner2.step('step1', () => 'new');

			expect(result).toBe('cached');
		});
	});

	describe('isCompleted', () => {
		it('returns false for non-existent step', () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			expect(runner.isCompleted('nonexistent')).toBe(false);
		});

		it('returns true for completed step', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner.step('step1', () => 'result');

			expect(runner.isCompleted('step1')).toBe(true);
		});

		it('returns false for failed step', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await expect(
				runner.step('fail', () => {
					throw new Error('Failed');
				})
			).rejects.toThrow();

			expect(runner.isCompleted('fail')).toBe(false);
		});
	});

	describe('getCachedResult', () => {
		it('returns cached result for completed step', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner.step('step1', () => ({ data: 'value' }));

			const cached = runner.getCachedResult('step1');
			expect(cached).toEqual({ data: 'value' });
		});

		it('returns undefined for non-existent step', () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			expect(runner.getCachedResult('nonexistent')).toBeUndefined();
		});

		it('returns undefined for failed step', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await expect(
				runner.step('fail', () => {
					throw new Error('Failed');
				})
			).rejects.toThrow();

			expect(runner.getCachedResult('fail')).toBeUndefined();
		});

		it('returns undefined when caching disabled', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner.step('no-cache', () => 'value', { cache: false });

			expect(runner.getCachedResult('no-cache')).toBeUndefined();
		});
	});

	describe('clear', () => {
		it('removes checkpoint from database', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner.step('step1', () => 'result');

			runner.clear();

			const db = getDatabase()!;
			const state = db.prepare(
				'SELECT metadata FROM workflow_state WHERE dialogue_id = ?'
			).get(dialogueId) as { metadata: string };
			const metadata = JSON.parse(state.metadata);

			expect(metadata.phaseCheckpoint).toBeUndefined();
		});

		it('allows fresh execution after clear', async () => {
			const runner1 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner1.step('step1', () => 'old');
			runner1.clear();

			const runner2 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			let executionCount = 0;
			const result = await runner2.step('step1', () => {
				executionCount++;
				return 'new';
			});

			expect(result).toBe('new');
			expect(executionCount).toBe(1);
		});
	});

	describe('getFailedStep', () => {
		it('returns undefined when no steps failed', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner.step('step1', () => 'result');

			expect(runner.getFailedStep()).toBeUndefined();
		});

		it('returns name of failed step', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await expect(
				runner.step('failing-step', () => {
					throw new Error('Failed');
				})
			).rejects.toThrow();

			expect(runner.getFailedStep()).toBe('failing-step');
		});

		it('returns first failed step when multiple failures', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await expect(runner.step('fail1', () => { throw new Error('1'); })).rejects.toThrow();
			await expect(runner.step('fail2', () => { throw new Error('2'); })).rejects.toThrow();

			const failed = runner.getFailedStep();
			expect(failed).toBeTruthy();
			expect(['fail1', 'fail2']).toContain(failed);
		});
	});

	describe('getResumeSummary', () => {
		it('returns null for fresh run', () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			expect(runner.getResumeSummary()).toBeNull();
		});

		it('returns summary with completed count', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner.step('step1', () => 'r1');
			await runner.step('step2', () => 'r2');

			const summary = runner.getResumeSummary();
			expect(summary).not.toBeNull();
			expect(summary?.completedCount).toBe(2);
			expect(summary?.phase).toBe('PROPOSE');
			expect(summary?.failedStep).toBeUndefined();
		});

		it('includes failed step in summary', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner.step('step1', () => 'result');
			await expect(
				runner.step('fail', () => { throw new Error('Failed'); })
			).rejects.toThrow();

			const summary = runner.getResumeSummary();
			expect(summary).not.toBeNull();
			expect(summary?.completedCount).toBe(1);
			expect(summary?.failedStep).toBe('fail');
		});

		it('returns summary after resume', async () => {
			const runner1 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner1.step('step1', () => 'r1');

			const runner2 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			const summary = runner2.getResumeSummary();

			expect(summary).not.toBeNull();
			expect(summary?.completedCount).toBe(1);
		});
	});

	describe('integration scenarios', () => {
		it('handles complete phase execution with checkpoints', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			const result1 = await runner.step('analyze', async () => {
				return { findings: ['f1', 'f2'] };
			});

			const result2 = await runner.step('generate', async () => {
				return { proposal: 'Generated proposal' };
			});

			const result3 = await runner.step('validate', async () => {
				return { valid: true };
			});

			expect(result1.findings).toHaveLength(2);
			expect(result2.proposal).toBeDefined();
			expect(result3.valid).toBe(true);

			const summary = runner.getResumeSummary();
			expect(summary?.completedCount).toBe(3);
		});

		it('resumes phase after partial failure', async () => {
			const runner1 = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await runner1.step('step1', () => 'completed');
			await runner1.step('step2', () => 'completed');
			await expect(
				runner1.step('step3', () => { throw new Error('Failed'); })
			).rejects.toThrow();

			const runner2 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			let step1Count = 0;
			let step2Count = 0;
			let step3Count = 0;

			await runner2.step('step1', () => { step1Count++; return 'new'; });
			await runner2.step('step2', () => { step2Count++; return 'new'; });
			const result3 = await runner2.step('step3', () => { step3Count++; return 'success'; });

			expect(step1Count).toBe(0);
			expect(step2Count).toBe(0);
			expect(step3Count).toBe(1);
			expect(result3).toBe('success');
		});

		it('handles phase retry after fixing failure', async () => {
			const runner1 = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await expect(
				runner1.step('network-call', () => { throw new Error('Network error'); })
			).rejects.toThrow();

			const runner2 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			const result = await runner2.step('network-call', () => 'success');

			expect(result).toBe('success');
			expect(runner2.getFailedStep()).toBeUndefined();
		});

		it('supports multi-step workflow with dependencies', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			const config = await runner.step('load-config', () => ({ setting: 'value' }));
			const data = await runner.step('fetch-data', () => {
				return { items: [1, 2, 3], config: config.setting };
			});
			const processed = await runner.step('process', () => {
				return data.items.map(i => i * 2);
			});

			expect(processed).toEqual([2, 4, 6]);
		});

		it('clears checkpoint on successful completion', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);

			await runner.step('step1', () => 'r1');
			await runner.step('step2', () => 'r2');

			runner.clear();

			const db = getDatabase()!;
			const state = db.prepare(
				'SELECT metadata FROM workflow_state WHERE dialogue_id = ?'
			).get(dialogueId) as { metadata: string };
			const metadata = JSON.parse(state.metadata);

			expect(metadata.phaseCheckpoint).toBeUndefined();
		});

		it('preserves checkpoint across multiple runner instances', async () => {
			const runner1 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner1.step('step1', () => 'value1');

			const runner2 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			await runner2.step('step2', () => 'value2');

			const runner3 = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			expect(runner3.isCompleted('step1')).toBe(true);
			expect(runner3.isCompleted('step2')).toBe(true);
		});

		it('handles expensive operations with caching', async () => {
			const runner = createPhaseRunner(dialogueId, 'PROPOSE', 1);
			let expensiveCallCount = 0;

			const expensiveOperation = async () => {
				expensiveCallCount++;
				await new Promise(resolve => setTimeout(resolve, 10));
				return { computed: 'expensive-result' };
			};

			const result1 = await runner.step('expensive', expensiveOperation);
			const result2 = await runner.step('expensive', expensiveOperation);

			expect(expensiveCallCount).toBe(1);
			expect(result1).toEqual(result2);
		});
	});
});
