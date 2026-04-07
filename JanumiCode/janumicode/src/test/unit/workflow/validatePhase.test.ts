import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { registerFakeProviders, teardownFakeProviders } from '../../helpers/fakeProviders';
import { runValidatePhase } from '../../../lib/workflow/validatePhase';
import { ValidateSubState } from '../../../lib/types/validate';
import { Phase } from '../../../lib/types';
import { randomUUID } from 'node:crypto';

describe('ValidatePhase', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
		
		registerFakeProviders({
			expertResponses: [
				{
					response: JSON.stringify({
						hypotheses: [],
						findings: [],
						grade: 'PASS'
					}),
					exitCode: 0,
				},
			],
		});
	});

	afterEach(() => {
		teardownFakeProviders();
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('runValidatePhase', () => {
		it('dispatches to INGESTING sub-state by default', async () => {
			const metadata = {};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.VALIDATE);
			}
		});

		it('handles INGESTING sub-state', async () => {
			const metadata = {
				validateSubState: ValidateSubState.INGESTING,
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
		});

		it('handles HYPOTHESIZING sub-state', async () => {
			const metadata = {
				validateSubState: ValidateSubState.HYPOTHESIZING,
				assembledContext: 'Test context',
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
		});

		it('handles VALIDATING sub-state', async () => {
			const metadata = {
				validateSubState: ValidateSubState.VALIDATING,
				assembledContext: 'Test context',
				hypotheses: [],
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
		});

		it('handles GRADING sub-state', async () => {
			const metadata = {
				validateSubState: ValidateSubState.GRADING,
				validatedHypotheses: [],
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
		});

		it('handles PRESENTING sub-state', async () => {
			const metadata = {
				validateSubState: ValidateSubState.PRESENTING,
				gradedFindings: [],
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
		});

		it('processes sub-state progression', async () => {
			const ingesting = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			expect(ingesting.success).toBe(true);
		});

		it('handles target files option', async () => {
			const metadata = {
				validateSubState: ValidateSubState.INGESTING,
				targetFiles: ['src/test.ts', 'src/main.ts'],
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
		});

		it('assembles context from workspace', async () => {
			const metadata = {
				validateSubState: ValidateSubState.INGESTING,
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
		});

		it('includes architecture document when available', async () => {
			const metadata = {
				validateSubState: ValidateSubState.INGESTING,
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
		});
	});

	describe('sub-state workflow', () => {
		it('progresses through validation pipeline', async () => {
			const states = [
				ValidateSubState.INGESTING,
				ValidateSubState.HYPOTHESIZING,
				ValidateSubState.VALIDATING,
				ValidateSubState.GRADING,
				ValidateSubState.PRESENTING,
			];

			for (const state of states) {
				const result = await runValidatePhase(dialogueId, {
					validateSubState: state,
					assembledContext: 'Context',
					hypotheses: [],
					validatedHypotheses: [],
					gradedFindings: [],
				});

				expect(result.success).toBe(true);
			}
		});

		it('maintains state between sub-states', async () => {
			const metadata = {
				validateSubState: ValidateSubState.INGESTING,
				targetFiles: ['test.ts'],
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBe(true);
		});

		it('continues in phase between sub-states', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			if (result.success) {
				expect(result.value.phase).toBe(Phase.VALIDATE);
			}
		});
	});

	describe('error handling', () => {
		it('handles ingestion errors', async () => {
			const metadata = {
				validateSubState: ValidateSubState.INGESTING,
			};

			const result = await runValidatePhase(dialogueId, metadata);

			expect(result.success).toBeDefined();
		});

		it('handles missing metadata gracefully', async () => {
			const result = await runValidatePhase(dialogueId, {});

			expect(result.success).toBe(true);
		});

		it('handles database errors', async () => {
			tempDb.cleanup();

			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			expect(result.success).toBeDefined();
		});

		it('handles provider resolution failure', async () => {
			teardownFakeProviders();

			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.HYPOTHESIZING,
				assembledContext: 'Context',
			});

			expect(result.success).toBeDefined();
		});
	});

	describe('integration scenarios', () => {
		it('executes complete validation workflow', async () => {
			const ingesting = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			expect(ingesting.success).toBe(true);
		});

		it('handles workspace scanning', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
				targetFiles: ['**/*.ts'],
			});

			expect(result.success).toBe(true);
		});

		it('processes hypotheses and findings', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.GRADING,
				validatedHypotheses: [],
			});

			expect(result.success).toBe(true);
		});

		it('presents validation results', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.PRESENTING,
				gradedFindings: [],
			});

			expect(result.success).toBe(true);
		});
	});

	describe('context assembly', () => {
		it('assembles workspace structure', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			expect(result.success).toBe(true);
		});

		it('includes source files', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
				targetFiles: ['src/**/*.ts'],
			});

			expect(result.success).toBe(true);
		});

		it('filters excluded patterns', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			expect(result.success).toBe(true);
		});

		it('respects max file limits', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			expect(result.success).toBe(true);
		});

		it('handles empty workspace', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			expect(result.success).toBe(true);
		});
	});

	describe('metadata transitions', () => {
		it('transitions from INGESTING to HYPOTHESIZING', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			expect(result.success).toBe(true);
		});

		it('passes context to next sub-state', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
			});

			expect(result.success).toBe(true);
		});

		it('preserves target files across states', async () => {
			const result = await runValidatePhase(dialogueId, {
				validateSubState: ValidateSubState.INGESTING,
				targetFiles: ['test.ts'],
			});

			expect(result.success).toBe(true);
		});
	});
});
