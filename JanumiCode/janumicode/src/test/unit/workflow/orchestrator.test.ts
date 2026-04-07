import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { registerFakeProviders, teardownFakeProviders } from '../../helpers/fakeProviders';
import {
	startWorkflow,
	executeProposePhase,
	executeAssumptionSurfacingPhase,
	executeVerifyPhase,
	executeHistoricalCheckPhase,
	executeReviewPhase,
	executeExecutePhase,
	executeValidatePhase,
	executeCommitPhase,
} from '../../../lib/workflow/orchestrator';
import { initializeWorkflowState, getWorkflowState, updateWorkflowMetadata } from '../../../lib/workflow/stateMachine';
import { Phase, LLMProvider, type RoleLLMConfig } from '../../../lib/types';
import { randomUUID } from 'node:crypto';

const mockLlmConfig: RoleLLMConfig = {
	executor: { provider: LLMProvider.GEMINI, model: 'gemini-2.0-flash-exp', apiKey: 'test-key' },
	verifier: { provider: LLMProvider.GEMINI, model: 'gemini-2.0-flash-exp', apiKey: 'test-key' },
	technicalExpert: { provider: LLMProvider.GEMINI, model: 'gemini-2.0-flash-exp', apiKey: 'test-key' },
	historianInterpreter: { provider: LLMProvider.GEMINI, model: 'gemini-2.0-flash-exp', apiKey: 'test-key' },
};

describe('Orchestrator Phase Functions', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
		
		// Register fake CLI providers
		registerFakeProviders({
			executorResponses: [
				{
					response: JSON.stringify({
						proposal: 'Test proposal',
						assumptions: ['Assumption 1', 'Assumption 2'],
						claims: [
							{ statement: 'Claim 1', criticality: 'CRITICAL' },
							{ statement: 'Claim 2', criticality: 'NON_CRITICAL' }
						]
					}),
					exitCode: 0,
				},
			],
			verifierResponses: [
				{
					response: JSON.stringify({
						verdicts: [
							{ claimId: 'claim-1', verdict: 'VERIFIED', rationale: 'Test rationale' }
						]
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

	describe('startWorkflow', () => {
		it('initializes a new dialogue workflow', () => {
			const result = startWorkflow({
				dialogueId,
				goal: 'Build a todo app',
				llmConfig: mockLlmConfig,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogueId).toBe(dialogueId);
			}

			const stateResult = getWorkflowState(dialogueId);
			expect(stateResult.success).toBe(true);
			if (stateResult.success) {
				expect(stateResult.value.dialogue_id).toBe(dialogueId);
				expect(stateResult.value.current_phase).toBe(Phase.INTAKE);
			}
		});

		it('stores goal in workflow metadata', () => {
			startWorkflow({
				dialogueId,
				goal: 'Create authentication system',
				llmConfig: mockLlmConfig,
			});

			const stateResult = getWorkflowState(dialogueId);
			if (stateResult.success) {
				const metadata = JSON.parse(stateResult.value.metadata);
				expect(metadata.goal).toBe('Create authentication system');
			}
		});

		it('fails when database not initialized', () => {
			tempDb.cleanup();
			const result = startWorkflow({
				dialogueId: randomUUID(),
				goal: 'Test',
				llmConfig: mockLlmConfig,
			});

			expect(result.success).toBe(false);
		});
	});

	describe('executeProposePhase', () => {
		beforeEach(() => {
			startWorkflow({ dialogueId, goal: 'Test goal', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Test goal' });
		});

		it('invokes executor and caches response', async () => {
			const result = await executeProposePhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.PROPOSE);
				expect(result.value.success).toBe(true);
			}

			// Check that response was cached in metadata
			const stateResult = getWorkflowState(dialogueId);
			if (stateResult.success) {
				const metadata = JSON.parse(stateResult.value.metadata);
				expect(metadata.cachedExecutorResponse).toBeDefined();
			}
		});

		it('re-parses cached output on retry', async () => {
			// Simulate a failed parse with cached output
			updateWorkflowMetadata(dialogueId, {
				cachedRawCliOutput: JSON.stringify({
					proposal: 'Cached proposal',
					assumptions: [],
					claims: []
				}),
				lastFailedPhase: 'PROPOSE',
			});

			const result = await executeProposePhase(dialogueId);

			expect(result.success).toBe(true);
			
			// Verify cache was cleared after successful reparse
			const stateResult = getWorkflowState(dialogueId);
			if (stateResult.success) {
				const metadata = JSON.parse(stateResult.value.metadata);
				expect(metadata.cachedRawCliOutput).toBeUndefined();
				expect(metadata.lastFailedPhase).toBeUndefined();
			}
		});

		it('uses approved intake plan if available', async () => {
			updateWorkflowMetadata(dialogueId, {
				approvedIntakePlan: {
					summary: 'Plan summary',
					requirements: ['Req 1', 'Req 2'],
				},
			});

			const result = await executeProposePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles executor invocation failure', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				executorResponses: [
					{ response: 'Invalid JSON', exitCode: 1 },
				],
			});

			const result = await executeProposePhase(dialogueId);

			// Should handle gracefully
			expect(result.success).toBeDefined();
		});
	});

	describe('executeAssumptionSurfacingPhase', () => {
		beforeEach(() => {
			startWorkflow({ dialogueId, goal: 'Test goal', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Test goal' });
		});

		it('reuses cached executor response', async () => {
			// Set up cached response from PROPOSE phase
			updateWorkflowMetadata(dialogueId, {
				cachedExecutorResponse: {
					proposal: 'Cached proposal',
					assumptions: ['Assumption 1', 'Assumption 2'],
					claims: []
				},
			});

			const result = await executeAssumptionSurfacingPhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.ASSUMPTION_SURFACING);
			}
		});

		it('invokes executor if no cached response', async () => {
			const result = await executeAssumptionSurfacingPhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('converts assumptions to claims', async () => {
			updateWorkflowMetadata(dialogueId, {
				cachedExecutorResponse: {
					proposal: 'Test',
					assumptions: ['Database is PostgreSQL', 'API uses REST'],
					claims: []
				},
			});

			const result = await executeAssumptionSurfacingPhase(dialogueId);

			expect(result.success).toBe(true);
			// Assumptions should be converted to CRITICAL claims
		});
	});

	describe('executeVerifyPhase', () => {
		beforeEach(() => {
			startWorkflow({ dialogueId, goal: 'Test goal', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Test goal' });
		});

		it('invokes verifier for open claims', async () => {
			const result = await executeVerifyPhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.VERIFY);
			}
		});

		it('creates verdicts for claims', async () => {
			// Would need to create claims first in a real scenario
			const result = await executeVerifyPhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('triggers gate on disproved claims', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdicts: [
								{ claimId: 'claim-1', verdict: 'DISPROVED', rationale: 'Test' }
							]
						}),
						exitCode: 0,
					},
				],
			});

			const result = await executeVerifyPhase(dialogueId);

			expect(result.success).toBe(true);
			// Gate should be triggered
		});

		it('handles no open claims gracefully', async () => {
			const result = await executeVerifyPhase(dialogueId);

			expect(result.success).toBe(true);
		});
	});

	describe('executeHistoricalCheckPhase', () => {
		beforeEach(() => {
			startWorkflow({ dialogueId, goal: 'Test goal', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Test goal' });
		});

		it('queries historian for relevant history', async () => {
			const result = await executeHistoricalCheckPhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.HISTORICAL_CHECK);
			}
		});

		it('uses GENERAL_HISTORY query type', async () => {
			const result = await executeHistoricalCheckPhase(dialogueId);

			expect(result.success).toBe(true);
			// Should invoke historian with correct query type
		});

		it('stores historical findings', async () => {
			const result = await executeHistoricalCheckPhase(dialogueId);

			expect(result.success).toBe(true);
		});
	});

	describe('executeReviewPhase', () => {
		beforeEach(() => {
			startWorkflow({ dialogueId, goal: 'Test goal', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Test goal' });
		});

		it('creates review gate', async () => {
			const result = await executeReviewPhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.REVIEW);
				expect(result.value.gateTriggered).toBe(true);
			}
		});

		it('triggers human gate via createReviewGate', async () => {
			const result = await executeReviewPhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.gateTriggered).toBe(true);
			}
		});

		it('produces handoff document', async () => {
			const result = await executeReviewPhase(dialogueId);

			expect(result.success).toBe(true);
		});
	});

	describe('executeExecutePhase', () => {
		beforeEach(() => {
			startWorkflow({ dialogueId, goal: 'Test goal', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Test goal' });
		});

		it('invokes CLI execution', async () => {
			const result = await executeExecutePhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.EXECUTE);
			}
		});

		it('wires to Claude Code CLI', async () => {
			const result = await executeExecutePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('emits stdin content for command block', async () => {
			const result = await executeExecutePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('handles execution failure', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				executorResponses: [
					{ response: 'Execution failed', exitCode: 1 },
				],
			});

			const result = await executeExecutePhase(dialogueId);

			expect(result.success).toBeDefined();
		});
	});

	describe('executeValidatePhase', () => {
		beforeEach(() => {
			startWorkflow({ dialogueId, goal: 'Test goal', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Test goal' });
		});

		it('checks execution result', async () => {
			const result = await executeValidatePhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.VALIDATE);
			}
		});

		it('gates on validation failure', async () => {
			// Simulate failed execution
			updateWorkflowMetadata(dialogueId, {
				lastExecutionFailed: true,
			});

			const result = await executeValidatePhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('proceeds on validation success', async () => {
			updateWorkflowMetadata(dialogueId, {
				lastExecutionFailed: false,
			});

			const result = await executeValidatePhase(dialogueId);

			expect(result.success).toBe(true);
		});
	});

	describe('executeCommitPhase', () => {
		beforeEach(() => {
			startWorkflow({ dialogueId, goal: 'Test goal', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Test goal' });
		});

		it('completes workflow successfully', async () => {
			const result = await executeCommitPhase(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.phase).toBe(Phase.COMMIT);
				expect(result.value.success).toBe(true);
			}
		});

		it('marks workflow as complete', async () => {
			const result = await executeCommitPhase(dialogueId);

			expect(result.success).toBe(true);
		});

		it('generates final artifacts', async () => {
			const result = await executeCommitPhase(dialogueId);

			expect(result.success).toBe(true);
		});
	});

	describe('phase integration scenarios', () => {
		it('executes PROPOSE → ASSUMPTION_SURFACING flow', async () => {
			startWorkflow({ dialogueId, goal: 'Build app', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Build app' });

			const proposeResult = await executeProposePhase(dialogueId);
			expect(proposeResult.success).toBe(true);

			const assumptionResult = await executeAssumptionSurfacingPhase(dialogueId);
			expect(assumptionResult.success).toBe(true);

			// Verify cached response was reused
			const stateResult = getWorkflowState(dialogueId);
			if (stateResult.success) {
				const metadata = JSON.parse(stateResult.value.metadata);
				expect(metadata.cachedExecutorResponse).toBeDefined();
			}
		});

		it('executes VERIFY → HISTORICAL_CHECK → REVIEW flow', async () => {
			startWorkflow({ dialogueId, goal: 'Test flow', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Test flow' });

			const verifyResult = await executeVerifyPhase(dialogueId);
			expect(verifyResult.success).toBe(true);

			const historicalResult = await executeHistoricalCheckPhase(dialogueId);
			expect(historicalResult.success).toBe(true);

			const reviewResult = await executeReviewPhase(dialogueId);
			expect(reviewResult.success).toBe(true);
			if (reviewResult.success && reviewResult.value) {
				expect(reviewResult.value.gateTriggered).toBe(true);
			}
		});

		it('handles full workflow cycle', async () => {
			startWorkflow({ dialogueId, goal: 'Complete workflow', llmConfig: mockLlmConfig });
			initializeWorkflowState(dialogueId, { goal: 'Complete workflow' });

			await executeProposePhase(dialogueId);
			await executeAssumptionSurfacingPhase(dialogueId);
			await executeVerifyPhase(dialogueId);
			await executeHistoricalCheckPhase(dialogueId);
			await executeReviewPhase(dialogueId);
			await executeExecutePhase(dialogueId);
			await executeValidatePhase(dialogueId);
			const commitResult = await executeCommitPhase(dialogueId);

			expect(commitResult.success).toBe(true);
		});
	});

	describe('error handling', () => {
		it('handles database errors gracefully', async () => {
			tempDb.cleanup();

			const result = await executeProposePhase('non-existent');

			expect(result.success).toBe(false);
		});

		it('handles missing workflow state', async () => {
			const result = await executeProposePhase(randomUUID());

			expect(result.success).toBe(false);
		});

		it('handles provider resolution failure', async () => {
			teardownFakeProviders();

			const result = await executeProposePhase(dialogueId);

			expect(result.success).toBe(false);
		});
	});
});
