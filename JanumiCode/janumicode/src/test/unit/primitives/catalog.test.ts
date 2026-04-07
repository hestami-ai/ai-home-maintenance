import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../lib/workflow/stateMachine');
vi.mock('../../../lib/workflow/gates');
vi.mock('../../../lib/events/writer');
vi.mock('../../../lib/events/reader');
vi.mock('../../../lib/workflow/humanGateHandling');
vi.mock('../../../lib/database/makerStore');
vi.mock('../../../lib/workflow/taskGraph');
vi.mock('../../../lib/cli/spawnUtils');
vi.mock('../../../lib/ui/governedStream/textCommands');
vi.mock('../../../lib/database');

describe('Primitive Catalog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('registerAllPrimitives', () => {
		it('imports catalog module', async () => {
			const catalog = await import('../../../lib/primitives/catalog');
			
			expect(catalog).toBeDefined();
			expect(catalog.registerAllPrimitives).toBeDefined();
		});

		it('registers primitives into registry', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			const registerSpy = vi.spyOn(registry, 'register');

			registerAllPrimitives(registry);

			expect(registerSpy).toHaveBeenCalled();
			expect(registerSpy.mock.calls.length).toBeGreaterThan(0);
		});
	});

	describe('state read primitives', () => {
		it('registers state.getWorkflowState', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getWorkflowState');

			expect(primitive).toBeDefined();
			expect(primitive?.id).toBe('state.getWorkflowState');
		});

		it('state.getWorkflowState executes successfully', async () => {
			const { getWorkflowState } = await import('../../../lib/workflow/stateMachine');
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: {
					current_phase: 'INTAKE',
					previous_phase: null,
					metadata: '{"key":"value"}',
				} as any,
			});

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getWorkflowState');
			const result = await primitive!.execute({ dialogueId: 'dialogue-123' }, {} as any);

			expect(result.success).toBe(true);
		});

		it('registers state.getOpenGates', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getOpenGates');

			expect(primitive).toBeDefined();
			expect(primitive?.params.some(p => p.name === 'dialogueId')).toBe(true);
		});

		it('registers state.getGate', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getGate');

			expect(primitive).toBeDefined();
			expect(primitive?.params.some(p => p.name === 'gateId')).toBe(true);
		});

		it('registers state.getBlockingClaims', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getBlockingClaims');

			expect(primitive).toBeDefined();
		});

		it('registers state.getClaims', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getClaims');

			expect(primitive).toBeDefined();
			expect(primitive?.params.some(p => p.name === 'dialogueId')).toBe(true);
		});

		it('state.getClaims executes with filters', async () => {
			const { getDatabase } = await import('../../../lib/database');
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([{ claim_id: 'claim-1' }]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getClaims');
			const result = await primitive!.execute({
				dialogueId: 'dialogue-123',
				status: 'OPEN',
			}, {} as any);

			expect(result.success).toBe(true);
		});

		it('registers state.getVerdicts', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getVerdicts');

			expect(primitive).toBeDefined();
		});
	});

	describe('state mutation primitives', () => {
		it('registers mutation.updateMetadata', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('mutation.updateMetadata');

			expect(primitive).toBeDefined();
		});

		it('mutation.updateMetadata executes', async () => {
			const { updateWorkflowMetadata } = await import('../../../lib/workflow/stateMachine');
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			vi.mocked(updateWorkflowMetadata).mockReturnValue({
				success: true,
				value: {
					dialogue_id: 'test',
					current_phase: 'INTAKE',
					sub_state: null,
					metadata: '{}',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				} as never,
			});

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('mutation.updateMetadata');
			const result = await primitive!.execute({
				dialogueId: 'dialogue-123',
				updates: { key: 'value' },
			}, {} as any);

			expect(result.success).toBe(true);
		});

		it('registers mutation.resolveGate', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('mutation.resolveGate');

			expect(primitive).toBeDefined();
		});

		it('registers mutation.recordHumanDecision', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('mutation.recordHumanDecision');

			expect(primitive).toBeDefined();
		});

		it('registers mutation.updateTaskUnitStatus', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('mutation.updateTaskUnitStatus');

			expect(primitive).toBeDefined();
		});
	});

	describe('UI communication primitives', () => {
		it('registers ui.showMessage', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('ui.showMessage');

			expect(primitive).toBeDefined();
		});

		it('ui.showMessage executes', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const mockUIChannel = {
				postSystemMessage: vi.fn(),
			};

			const primitive = registry.get('ui.showMessage');
			const result = await primitive!.execute(
				{ message: 'Test message' },
				{ uiChannel: mockUIChannel } as any
			);

			expect(result.success).toBe(true);
			expect(mockUIChannel.postSystemMessage).toHaveBeenCalledWith('Test message');
		});

		it('registers ui.setProcessing', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('ui.setProcessing');

			expect(primitive).toBeDefined();
		});

		it('registers ui.setInputEnabled', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('ui.setInputEnabled');

			expect(primitive).toBeDefined();
		});

		it('registers ui.refreshView', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('ui.refreshView');

			expect(primitive).toBeDefined();
		});
	});

	describe('workflow control primitives', () => {
		it('registers workflow.triggerCycle', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('workflow.triggerCycle');

			expect(primitive).toBeDefined();
		});

		it('workflow.triggerCycle executes', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const mockUIChannel = {
				runWorkflowCycle: vi.fn().mockResolvedValue(undefined),
			};

			const primitive = registry.get('workflow.triggerCycle');
			const result = await primitive!.execute(
				{},
				{ uiChannel: mockUIChannel } as any
			);

			expect(result.success).toBe(true);
			expect(mockUIChannel.runWorkflowCycle).toHaveBeenCalled();
		});
	});

	describe('edge cases', () => {
		it('handles missing database gracefully', async () => {
			const { getDatabase } = await import('../../../lib/database');
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			vi.mocked(getDatabase).mockReturnValue(null);

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getClaims');
			const result = await primitive!.execute({
				dialogueId: 'dialogue-123',
			}, {} as any);

			expect(result.success).toBe(false);
		});

		it('handles workflow state errors', async () => {
			const { getWorkflowState } = await import('../../../lib/workflow/stateMachine');
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			vi.mocked(getWorkflowState).mockReturnValue({
				success: false,
				error: new Error('State not found'),
			});

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getWorkflowState');
			const result = await primitive!.execute({ dialogueId: 'dialogue-999' }, {} as any);

			expect(result.success).toBe(false);
		});

		it('parses metadata JSON in workflow state', async () => {
			const { getWorkflowState } = await import('../../../lib/workflow/stateMachine');
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: {
					current_phase: 'INTAKE',
					previous_phase: null,
					metadata: '{"lastError":"test error"}',
				} as any,
			});

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const primitive = registry.get('state.getWorkflowState');
			const result = await primitive!.execute({ dialogueId: 'dialogue-123' }, {} as any);

			expect(result.success).toBe(true);
			if (result.success) {
				expect((result.value as any).metadata).toEqual({ lastError: 'test error' });
			}
		});

		it('all primitives have required fields', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const all = registry.getAll();

			for (const primitive of all) {
				expect(primitive.id).toBeTruthy();
				expect(primitive.name).toBeTruthy();
				expect(primitive.description).toBeTruthy();
				expect(primitive.category).toBeTruthy();
				expect(primitive.safety).toBeTruthy();
				expect(primitive.params).toBeDefined();
				expect(primitive.returns).toBeTruthy();
				expect(primitive.execute).toBeInstanceOf(Function);
			}
		});

		it('all parameters have required fields', async () => {
			const { PrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { registerAllPrimitives } = await import('../../../lib/primitives/catalog');

			const registry = new PrimitiveRegistry();
			registerAllPrimitives(registry);

			const all = registry.getAll();

			for (const primitive of all) {
				for (const param of primitive.params) {
					expect(param.name).toBeTruthy();
					expect(param.type).toBeTruthy();
					expect(param.description).toBeTruthy();
					expect(typeof param.required).toBe('boolean');
				}
			}
		});
	});
});
