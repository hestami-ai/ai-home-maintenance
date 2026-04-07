import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validatePreconditions, findRestrictedSteps, validatePlanSafety } from '../../../lib/primitives/safety';
import { PrimitiveRegistry } from '../../../lib/primitives/registry';
import { PrimitiveCategory, PrimitiveSafety } from '../../../lib/primitives/types';
import type { PrimitiveDefinition, ExecutionContext } from '../../../lib/primitives/types';
import type { Plan } from '../../../lib/orchestrator/types';

describe('Primitive Safety', () => {
	let registry: PrimitiveRegistry;

	beforeEach(() => {
		registry = new PrimitiveRegistry();
	});

	describe('validatePreconditions', () => {
		it('returns valid when no preconditions defined', () => {
			const def: PrimitiveDefinition = {
				id: 'test.noPreconditions',
				name: 'No Preconditions',
				description: 'Test',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			const result = validatePreconditions(def, {}, {} as ExecutionContext);

			expect(result.valid).toBe(true);
		});

		it('returns valid when all preconditions pass', () => {
			const def: PrimitiveDefinition = {
				id: 'test.withPreconditions',
				name: 'With Preconditions',
				description: 'Test',
				category: PrimitiveCategory.STATE_MUTATION,
				safety: PrimitiveSafety.GUARDED,
				params: [],
				returns: 'void',
				preconditions: [
					() => ({ ok: true }),
					() => ({ ok: true }),
				],
				execute: vi.fn(),
			};

			const result = validatePreconditions(def, {}, {} as ExecutionContext);

			expect(result.valid).toBe(true);
		});

		it('returns violations when preconditions fail', () => {
			const def: PrimitiveDefinition = {
				id: 'test.failingPreconditions',
				name: 'Failing Preconditions',
				description: 'Test',
				category: PrimitiveCategory.STATE_MUTATION,
				safety: PrimitiveSafety.GUARDED,
				params: [],
				returns: 'void',
				preconditions: [
					() => ({ ok: false, reason: 'Gate not open' }),
					() => ({ ok: false, reason: 'Claim not verified' }),
				],
				execute: vi.fn(),
			};

			const result = validatePreconditions(def, {}, {} as ExecutionContext);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.violations).toContain('Gate not open');
				expect(result.violations).toContain('Claim not verified');
			}
		});

		it('only includes violations from failed preconditions', () => {
			const def: PrimitiveDefinition = {
				id: 'test.mixedPreconditions',
				name: 'Mixed Preconditions',
				description: 'Test',
				category: PrimitiveCategory.STATE_MUTATION,
				safety: PrimitiveSafety.GUARDED,
				params: [],
				returns: 'void',
				preconditions: [
					() => ({ ok: true }),
					() => ({ ok: false, reason: 'Failed check' }),
					() => ({ ok: true }),
				],
				execute: vi.fn(),
			};

			const result = validatePreconditions(def, {}, {} as ExecutionContext);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.violations).toHaveLength(1);
				expect(result.violations[0]).toBe('Failed check');
			}
		});
	});

	describe('findRestrictedSteps', () => {
		it('finds all restricted steps in plan', () => {
			const restrictedDef: PrimitiveDefinition = {
				id: 'restricted.dangerous',
				name: 'Dangerous',
				description: 'Restricted operation',
				category: PrimitiveCategory.WORKFLOW_CONTROL,
				safety: PrimitiveSafety.RESTRICTED,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			const safeDef: PrimitiveDefinition = {
				id: 'safe.operation',
				name: 'Safe',
				description: 'Safe operation',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(restrictedDef);
			registry.register(safeDef);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'safe.operation', params: {}, reason: 'Safe' },
					{ id: 's2', primitiveId: 'restricted.dangerous', params: {}, reason: 'Restricted' },
					{ id: 's3', primitiveId: 'safe.operation', params: {}, reason: 'Safe' },
				],
				expectedOutcome: 'Result',
			};

			const restricted = findRestrictedSteps(plan, registry);

			expect(restricted).toHaveLength(1);
			expect(restricted[0].primitiveId).toBe('restricted.dangerous');
		});

		it('returns empty array when no restricted steps', () => {
			const safeDef: PrimitiveDefinition = {
				id: 'safe.operation',
				name: 'Safe',
				description: 'Safe operation',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(safeDef);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'safe.operation', params: {}, reason: 'Safe' },
				],
				expectedOutcome: 'Result',
			};

			const restricted = findRestrictedSteps(plan, registry);

			expect(restricted).toEqual([]);
		});
	});

	describe('validatePlanSafety', () => {
		it('validates empty plan as safe', () => {
			const plan: Plan = {
				intent: 'Empty plan',
				steps: [],
				expectedOutcome: 'Nothing',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(true);
		});

		it('detects unknown primitives', () => {
			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'unknown.primitive', params: {}, reason: 'Test' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(false);
			if (!result.safe) {
				expect(result.warnings).toContain('Unknown primitive: unknown.primitive');
			}
		});

		it('detects restricted primitives', () => {
			const restrictedDef: PrimitiveDefinition = {
				id: 'restricted.operation',
				name: 'Restricted',
				description: 'Restricted operation',
				category: PrimitiveCategory.WORKFLOW_CONTROL,
				safety: PrimitiveSafety.RESTRICTED,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(restrictedDef);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'restricted.operation', params: {}, reason: 'Test' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(false);
			if (!result.safe) {
				expect(result.warnings.some(w => w.includes('RESTRICTED'))).toBe(true);
			}
		});

		it('detects duplicate step IDs', () => {
			const safeDef: PrimitiveDefinition = {
				id: 'safe.operation',
				name: 'Safe',
				description: 'Safe operation',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(safeDef);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'safe.operation', params: {}, reason: 'First' },
					{ id: 's1', primitiveId: 'safe.operation', params: {}, reason: 'Duplicate' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(false);
			if (!result.safe) {
				expect(result.warnings).toContain('Duplicate step ID: s1');
			}
		});

		it('detects missing required parameters', () => {
			const def: PrimitiveDefinition = {
				id: 'test.withParams',
				name: 'With Params',
				description: 'Test',
				category: PrimitiveCategory.STATE_MUTATION,
				safety: PrimitiveSafety.GUARDED,
				params: [
					{ name: 'required', type: 'string', description: 'Required param', required: true },
				],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(def);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'test.withParams', params: {}, reason: 'Test' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(false);
			if (!result.safe) {
				expect(result.warnings.some(w => w.includes('missing required param'))).toBe(true);
			}
		});

		it('allows missing dialogueId parameter', () => {
			const def: PrimitiveDefinition = {
				id: 'test.withDialogueId',
				name: 'With Dialogue ID',
				description: 'Test',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [
					{ name: 'dialogueId', type: 'string', description: 'Dialogue ID', required: true },
				],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(def);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'test.withDialogueId', params: {}, reason: 'Test' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(true);
		});

		it('detects forward bind references', () => {
			const def: PrimitiveDefinition = {
				id: 'test.operation',
				name: 'Operation',
				description: 'Test',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(def);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'test.operation', params: { value: '$s2.value' }, reason: 'First' },
					{ id: 's2', primitiveId: 'test.operation', params: {}, reason: 'Second' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(false);
			if (!result.safe) {
				expect(result.warnings.some(w => w.includes("hasn't executed yet"))).toBe(true);
			}
		});

		it('allows backward bind references', () => {
			const def: PrimitiveDefinition = {
				id: 'test.operation',
				name: 'Operation',
				description: 'Test',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(def);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'test.operation', params: {}, reason: 'First' },
					{ id: 's2', primitiveId: 'test.operation', params: { value: '$s1.value' }, reason: 'Second' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(true);
		});

		it('allows $context bind references', () => {
			const def: PrimitiveDefinition = {
				id: 'test.operation',
				name: 'Operation',
				description: 'Test',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(def);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'test.operation', params: { id: '$context.dialogueId' }, reason: 'Test' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(true);
		});

		it('detects blocked sequences', () => {
			const kill: PrimitiveDefinition = {
				id: 'control.killAllProcesses',
				name: 'Kill Processes',
				description: 'Kill all processes',
				category: PrimitiveCategory.WORKFLOW_CONTROL,
				safety: PrimitiveSafety.RESTRICTED,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			const run: PrimitiveDefinition = {
				id: 'control.runWorkflowCycle',
				name: 'Run Cycle',
				description: 'Run workflow cycle',
				category: PrimitiveCategory.WORKFLOW_CONTROL,
				safety: PrimitiveSafety.RESTRICTED,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(kill);
			registry.register(run);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'control.killAllProcesses', params: {}, reason: 'Kill' },
					{ id: 's2', primitiveId: 'control.runWorkflowCycle', params: {}, reason: 'Run' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(false);
			if (!result.safe) {
				expect(result.warnings.some(w => w.includes('Blocked sequence'))).toBe(true);
			}
		});

		it('validates safe plan with all checks passing', () => {
			const def: PrimitiveDefinition = {
				id: 'safe.operation',
				name: 'Safe Operation',
				description: 'Safe operation',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [
					{ name: 'param1', type: 'string', description: 'Param 1', required: true },
				],
				returns: 'string',
				execute: vi.fn(),
			};

			registry.register(def);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'safe.operation', params: { param1: 'value' }, reason: 'First' },
					{ id: 's2', primitiveId: 'safe.operation', params: { param1: '$s1.value' }, reason: 'Second' },
				],
				expectedOutcome: 'Success',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('handles plan with no steps array', () => {
			const plan = {
				intent: 'Test',
				expectedOutcome: 'Result',
			} as Plan;

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(true);
		});

		it('handles empty preconditions array', () => {
			const def: PrimitiveDefinition = {
				id: 'test.emptyPreconditions',
				name: 'Empty Preconditions',
				description: 'Test',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [],
				returns: 'void',
				preconditions: [],
				execute: vi.fn(),
			};

			const result = validatePreconditions(def, {}, {} as ExecutionContext);

			expect(result.valid).toBe(true);
		});

		it('handles nested bind expressions', () => {
			const def: PrimitiveDefinition = {
				id: 'test.operation',
				name: 'Operation',
				description: 'Test',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(def);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'test.operation', params: {}, reason: 'First' },
					{ id: 's2', primitiveId: 'test.operation', params: { value: '$s1.value.nested.field' }, reason: 'Second' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(true);
		});

		it('accumulates multiple warnings', () => {
			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'unknown.primitive', params: {}, reason: 'First' },
					{ id: 's1', primitiveId: 'another.unknown', params: {}, reason: 'Duplicate' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(false);
			if (!result.safe) {
				expect(result.warnings.length).toBeGreaterThan(1);
			}
		});

		it('handles optional parameters correctly', () => {
			const def: PrimitiveDefinition = {
				id: 'test.optionalParams',
				name: 'Optional Params',
				description: 'Test',
				category: PrimitiveCategory.STATE_READ,
				safety: PrimitiveSafety.OPEN,
				params: [
					{ name: 'required', type: 'string', description: 'Required', required: true },
					{ name: 'optional', type: 'string', description: 'Optional', required: false },
				],
				returns: 'void',
				execute: vi.fn(),
			};

			registry.register(def);

			const plan: Plan = {
				intent: 'Test plan',
				steps: [
					{ id: 's1', primitiveId: 'test.optionalParams', params: { required: 'value' }, reason: 'Test' },
				],
				expectedOutcome: 'Result',
			};

			const result = validatePlanSafety(plan, registry, 'dialogue-123');

			expect(result.safe).toBe(true);
		});
	});
});
