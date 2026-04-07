import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executePlan } from '../../../lib/orchestrator/executor';
import type { Plan } from '../../../lib/orchestrator/types';

vi.mock('../../../lib/primitives/registry');
vi.mock('../../../lib/primitives/safety');

describe('Orchestrator Executor', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const mockUIChannel = {
		postSystemMessage: vi.fn(),
		postUserMessage: vi.fn(),
		postAssistantMessage: vi.fn(),
	};

	describe('executePlan', () => {
		it('validates plan safety before execution', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety } = await import('../../../lib/primitives/safety');

			const mockRegistry = new Map();
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(validatePlanSafety).mockReturnValue({
				safe: false,
				warnings: ['Unknown primitive: test_primitive'],
			});

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [],
			};

			const result = await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(result.success).toBe(false);
			expect(result.summary).toContain('Plan rejected');
		});

		it('posts plan summary to UI', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety } = await import('../../../lib/primitives/safety');

			const mockRegistry = new Map();
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(validatePlanSafety).mockReturnValue({
				safe: true,
			});

			const plan: Plan = {
				intent: 'Create feature',
				expectedOutcome: 'Feature created',
				steps: [
					{
						id: 's1',
						primitiveId: 'test_prim',
						reason: 'Do something',
						params: {},
					},
				],
			};

			vi.mocked(getPrimitiveRegistry).mockReturnValue(
				new Map([
					[
						'test_prim',
						{
							id: 'test_prim',
							execute: vi.fn().mockResolvedValue({ success: true, value: {} }),
						},
					],
				]) as any
			);

			const { validatePreconditions } = await import('../../../lib/primitives/safety');
			vi.mocked(validatePreconditions).mockReturnValue({
				valid: true,
			});

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(mockUIChannel.postSystemMessage).toHaveBeenCalledWith(
				expect.stringContaining('Create feature')
			);
		});

		it('executes steps sequentially', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy1 = vi.fn().mockResolvedValue({ success: true, value: { result: 'step1' } });
			const executeSpy2 = vi.fn().mockResolvedValue({ success: true, value: { result: 'step2' } });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy1 }],
				['prim2', { id: 'prim2', execute: executeSpy2 }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Multi-step plan',
				expectedOutcome: 'Both steps complete',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
					{ id: 's2', primitiveId: 'prim2', reason: 'Step 2', params: {} },
				],
			};

			const result = await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy1).toHaveBeenCalled();
			expect(executeSpy2).toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(2);
		});

		it('stops on first failure', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy1 = vi.fn().mockResolvedValue({ success: false, error: new Error('Step 1 failed') });
			const executeSpy2 = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy1 }],
				['prim2', { id: 'prim2', execute: executeSpy2 }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
					{ id: 's2', primitiveId: 'prim2', reason: 'Step 2', params: {} },
				],
			};

			const result = await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy1).toHaveBeenCalled();
			expect(executeSpy2).not.toHaveBeenCalled();
			expect(result.success).toBe(false);
			expect(result.steps.length).toBe(1);
		});

		it('resolves $context.dialogueId binds', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{
						id: 's1',
						primitiveId: 'prim1',
						reason: 'Step 1',
						params: { dialogueId: '$context.dialogueId' },
					},
				],
			};

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy).toHaveBeenCalledWith(
				expect.objectContaining({ dialogueId: 'dialogue-123' }),
				expect.anything()
			);
		});

		it('resolves step result binds', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy1 = vi.fn().mockResolvedValue({
				success: true,
				value: { gateId: 'gate-456' },
			});
			const executeSpy2 = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy1 }],
				['prim2', { id: 'prim2', execute: executeSpy2 }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
					{
						id: 's2',
						primitiveId: 'prim2',
						reason: 'Step 2',
						params: { gateId: '$s1.value.gateId' },
					},
				],
			};

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy2).toHaveBeenCalledWith(
				expect.objectContaining({ gateId: 'gate-456' }),
				expect.anything()
			);
		});

		it('resolves nested path binds', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy1 = vi.fn().mockResolvedValue({
				success: true,
				value: [{ gate_id: 'gate-789' }],
			});
			const executeSpy2 = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy1 }],
				['prim2', { id: 'prim2', execute: executeSpy2 }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
					{
						id: 's2',
						primitiveId: 'prim2',
						reason: 'Step 2',
						params: { gateId: '$s1.value.0.gate_id' },
					},
				],
			};

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy2).toHaveBeenCalledWith(
				expect.objectContaining({ gateId: 'gate-789' }),
				expect.anything()
			);
		});

		it('skips steps with false conditions', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy1 = vi.fn().mockResolvedValue({ success: true, value: [] });
			const executeSpy2 = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy1 }],
				['prim2', { id: 'prim2', execute: executeSpy2 }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
					{
						id: 's2',
						primitiveId: 'prim2',
						reason: 'Step 2',
						params: {},
						condition: '$s1.value.length > 0',
					},
				],
			};

			const result = await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy1).toHaveBeenCalled();
			expect(executeSpy2).not.toHaveBeenCalled();
			expect(result.steps[1].skipped).toBe(true);
		});

		it('validates preconditions before execution', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({
				valid: false,
				violations: ['Missing required parameter: targetId'],
			});

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
				],
			};

			const result = await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy).not.toHaveBeenCalled();
			expect(result.success).toBe(false);
			expect(result.summary).toContain('Precondition failed');
		});

		it('handles unknown primitive gracefully', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety } = await import('../../../lib/primitives/safety');

			const mockRegistry = new Map();
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'unknown_prim', reason: 'Step 1', params: {} },
				],
			};

			const result = await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(result.success).toBe(false);
			expect(result.summary).toContain('Unknown primitive');
		});

		it('handles thrown errors', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy = vi.fn().mockRejectedValue(new Error('Unexpected error'));

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
				],
			};

			const result = await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(result.success).toBe(false);
			expect(result.summary).toContain('threw');
		});

		it('returns expected outcome on success', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Feature deployed successfully',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
				],
			};

			const result = await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(result.success).toBe(true);
			expect(result.summary).toBe('Feature deployed successfully');
		});
	});

	describe('condition evaluation', () => {
		it('evaluates equality conditions', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy1 = vi.fn().mockResolvedValue({ success: true, value: { status: 'active' } });
			const executeSpy2 = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy1 }],
				['prim2', { id: 'prim2', execute: executeSpy2 }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
					{
						id: 's2',
						primitiveId: 'prim2',
						reason: 'Step 2',
						params: {},
						condition: "$s1.value.status == 'active'",
					},
				],
			};

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy2).toHaveBeenCalled();
		});

		it('evaluates inequality conditions', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy1 = vi.fn().mockResolvedValue({ success: true, value: { status: 'inactive' } });
			const executeSpy2 = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy1 }],
				['prim2', { id: 'prim2', execute: executeSpy2 }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
					{
						id: 's2',
						primitiveId: 'prim2',
						reason: 'Step 2',
						params: {},
						condition: "$s1.value.status != 'active'",
					},
				],
			};

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy2).toHaveBeenCalled();
		});

		it('evaluates null checks', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy1 = vi.fn().mockResolvedValue({ success: true, value: { data: null } });
			const executeSpy2 = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy1 }],
				['prim2', { id: 'prim2', execute: executeSpy2 }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
					{
						id: 's2',
						primitiveId: 'prim2',
						reason: 'Step 2',
						params: {},
						condition: '$s1.value.data != null',
					},
				],
			};

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy2).not.toHaveBeenCalled();
		});

		it('evaluates numeric comparisons', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy1 = vi.fn().mockResolvedValue({ success: true, value: { count: 5 } });
			const executeSpy2 = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy1 }],
				['prim2', { id: 'prim2', execute: executeSpy2 }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{ id: 's1', primitiveId: 'prim1', reason: 'Step 1', params: {} },
					{
						id: 's2',
						primitiveId: 'prim2',
						reason: 'Step 2',
						params: {},
						condition: '$s1.value.count >= 3',
					},
				],
			};

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy2).toHaveBeenCalled();
		});
	});

	describe('edge cases', () => {
		it('handles nested object parameter resolution', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{
						id: 's1',
						primitiveId: 'prim1',
						reason: 'Step 1',
						params: {
							config: {
								dialogueId: '$context.dialogueId',
							},
						},
					},
				],
			};

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					config: { dialogueId: 'dialogue-123' },
				}),
				expect.anything()
			);
		});

		it('handles undefined step results gracefully', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety, validatePreconditions } = await import('../../../lib/primitives/safety');

			const executeSpy = vi.fn().mockResolvedValue({ success: true, value: {} });

			const mockRegistry = new Map([
				['prim1', { id: 'prim1', execute: executeSpy }],
			]);

			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });
			vi.mocked(validatePreconditions).mockReturnValue({ valid: true });

			const plan: Plan = {
				intent: 'Test plan',
				expectedOutcome: 'Success',
				steps: [
					{
						id: 's1',
						primitiveId: 'prim1',
						reason: 'Step 1',
						params: { value: '$sNonExistent.value.field' },
					},
				],
			};

			await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(executeSpy).toHaveBeenCalledWith(
				expect.objectContaining({ value: undefined }),
				expect.anything()
			);
		});

		it('handles empty plan', async () => {
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { validatePlanSafety } = await import('../../../lib/primitives/safety');

			vi.mocked(getPrimitiveRegistry).mockReturnValue(new Map() as any);
			vi.mocked(validatePlanSafety).mockReturnValue({ safe: true });

			const plan: Plan = {
				intent: 'Empty plan',
				expectedOutcome: 'Nothing',
				steps: [],
			};

			const result = await executePlan(plan, 'dialogue-123', mockUIChannel as any);

			expect(result.success).toBe(true);
			expect(result.steps.length).toBe(0);
		});
	});
});
