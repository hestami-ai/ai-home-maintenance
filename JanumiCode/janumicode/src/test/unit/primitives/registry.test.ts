import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrimitiveRegistry } from '../../../lib/primitives/registry';
import { PrimitiveCategory, PrimitiveSafety } from '../../../lib/primitives/types';
import type { PrimitiveDefinition, PrimitiveParam } from '../../../lib/primitives/types';

// ─── Canonical fixture builders ──────────────────────────────────────

function makeParam(overrides: Partial<PrimitiveParam> & Pick<PrimitiveParam, 'name'>): PrimitiveParam {
	return {
		type: 'string',
		description: `${overrides.name} parameter`,
		required: true,
		...overrides,
	};
}

function makePrimitive(overrides: Partial<PrimitiveDefinition> & Pick<PrimitiveDefinition, 'id'>): PrimitiveDefinition {
	return {
		name: overrides.id,
		description: 'Test primitive',
		category: PrimitiveCategory.STATE_READ,
		safety: PrimitiveSafety.OPEN,
		params: [],
		returns: 'string',
		execute: vi.fn(),
		...overrides,
	};
}

describe('PrimitiveRegistry', () => {
	let registry: PrimitiveRegistry;

	beforeEach(() => {
		registry = new PrimitiveRegistry();
	});

	describe('register', () => {
		it('registers a primitive definition', () => {
			const primitive = makePrimitive({ id: 'test.primitive' });

			registry.register(primitive);

			expect(registry.get('test.primitive')).toBe(primitive);
		});

		it('overwrites existing primitive with same ID', () => {
			const primitive1 = makePrimitive({
				id: 'test.primitive',
				description: 'First version',
			});
			const primitive2 = makePrimitive({
				id: 'test.primitive',
				category: PrimitiveCategory.STATE_MUTATION,
				safety: PrimitiveSafety.GUARDED,
				description: 'Second version',
				returns: 'number',
			});

			registry.register(primitive1);
			registry.register(primitive2);

			expect(registry.get('test.primitive')).toBe(primitive2);
		});
	});

	describe('get', () => {
		it('retrieves registered primitive by ID', () => {
			const primitive = makePrimitive({
				id: 'state.getWorkflowState',
				description: 'Get workflow state',
				params: [makeParam({ name: 'dialogueId', type: 'string', required: true })],
				returns: 'WorkflowState',
			});

			registry.register(primitive);

			expect(registry.get('state.getWorkflowState')).toBe(primitive);
		});

		it('returns undefined for unknown primitive', () => {
			expect(registry.get('unknown.primitive')).toBeUndefined();
		});
	});

	describe('getByCategory', () => {
		it('returns all primitives in a category', () => {
			const read1 = makePrimitive({ id: 'state.read1', description: 'Read 1' });
			const read2 = makePrimitive({ id: 'state.read2', description: 'Read 2' });
			const mutation = makePrimitive({
				id: 'state.mutate',
				category: PrimitiveCategory.STATE_MUTATION,
				safety: PrimitiveSafety.GUARDED,
				description: 'Mutate',
				returns: 'void',
			});

			registry.register(read1);
			registry.register(read2);
			registry.register(mutation);

			const reads = registry.getByCategory(PrimitiveCategory.STATE_READ);

			expect(reads).toHaveLength(2);
			expect(reads).toContain(read1);
			expect(reads).toContain(read2);
			expect(reads).not.toContain(mutation);
		});

		it('returns empty array for category with no primitives', () => {
			const result = registry.getByCategory(PrimitiveCategory.UI_COMMUNICATION);

			expect(result).toEqual([]);
		});
	});

	describe('getAll', () => {
		it('returns all registered primitives', () => {
			const prim1 = makePrimitive({ id: 'prim1', description: 'Prim 1' });
			const prim2 = makePrimitive({
				id: 'prim2',
				category: PrimitiveCategory.STATE_MUTATION,
				safety: PrimitiveSafety.GUARDED,
				description: 'Prim 2',
				returns: 'void',
			});

			registry.register(prim1);
			registry.register(prim2);

			const all = registry.getAll();

			expect(all).toHaveLength(2);
			expect(all).toContain(prim1);
			expect(all).toContain(prim2);
		});

		it('returns empty array when no primitives registered', () => {
			expect(registry.getAll()).toEqual([]);
		});
	});

	describe('generateCatalog', () => {
		beforeEach(() => {
			registry.register(makePrimitive({
				id: 'state.getState',
				description: 'Get state',
				params: [makeParam({ name: 'dialogueId', type: 'string' })],
				returns: 'State',
			}));

			registry.register(makePrimitive({
				id: 'mutation.updateState',
				category: PrimitiveCategory.STATE_MUTATION,
				safety: PrimitiveSafety.GUARDED,
				description: 'Update state',
				params: [
					makeParam({ name: 'dialogueId', type: 'string' }),
					makeParam({ name: 'updates', type: 'object' }),
				],
				returns: 'void',
			}));

			registry.register(makePrimitive({
				id: 'restricted.dangerous',
				category: PrimitiveCategory.WORKFLOW_CONTROL,
				safety: PrimitiveSafety.RESTRICTED,
				description: 'Dangerous operation',
				returns: 'void',
			}));
		});

		it('generates catalog grouped by category', () => {
			const catalog = registry.generateCatalog();

			expect(catalog).toContain('State Reads');
			expect(catalog).toContain('State Mutations');
		});

		it('includes primitive ID, params, and description', () => {
			const catalog = registry.generateCatalog();

			expect(catalog).toContain('state.getState');
			expect(catalog).toContain('dialogueId: string');
			expect(catalog).toContain('Get state');
		});

		it('marks optional parameters with question mark', () => {
			registry.register(makePrimitive({
				id: 'test.optional',
				description: 'Test',
				params: [
					makeParam({ name: 'required', type: 'string', required: true }),
					makeParam({ name: 'optional', type: 'number', required: false }),
				],
			}));

			const catalog = registry.generateCatalog();

			expect(catalog).toContain('required: string');
			expect(catalog).toContain('optional?: number');
		});

		it('shows return type', () => {
			const catalog = registry.generateCatalog();

			expect(catalog).toContain('→ State');
			expect(catalog).toContain('→ void');
		});

		it('excludes RESTRICTED primitives by default', () => {
			const catalog = registry.generateCatalog();

			expect(catalog).not.toContain('restricted.dangerous');
		});

		it('includes RESTRICTED primitives when requested', () => {
			const catalog = registry.generateCatalog({ includeRestricted: true });

			expect(catalog).toContain('restricted.dangerous');
		});

		it('skips empty categories', () => {
			const emptyRegistry = new PrimitiveRegistry();
			const catalog = emptyRegistry.generateCatalog();

			expect(catalog.trim()).toBe('');
		});

		it('formats multiple parameters correctly', () => {
			const catalog = registry.generateCatalog();

			expect(catalog).toContain('dialogueId: string, updates: object');
		});
	});

	describe('edge cases', () => {
		it('handles primitive with no parameters', () => {
			registry.register(makePrimitive({ id: 'util.noParams', description: 'No params' }));

			const catalog = registry.generateCatalog();

			// Catalog format wraps id in markdown bold: **util.noParams**()
			expect(catalog).toContain('**util.noParams**()');
		});

		it('handles UI communication category', () => {
			registry.register(makePrimitive({
				id: 'ui.showMessage',
				category: PrimitiveCategory.UI_COMMUNICATION,
				description: 'Show message',
				params: [makeParam({ name: 'message', type: 'string' })],
				returns: 'void',
			}));

			const catalog = registry.generateCatalog();

			expect(catalog).toContain('UI Communication');
			expect(catalog).toContain('ui.showMessage');
		});

		it('handles workflow control category', () => {
			registry.register(makePrimitive({
				id: 'workflow.pause',
				category: PrimitiveCategory.WORKFLOW_CONTROL,
				safety: PrimitiveSafety.GUARDED,
				description: 'Pause workflow',
				returns: 'void',
			}));

			const catalog = registry.generateCatalog();

			expect(catalog).toContain('Workflow Control');
			expect(catalog).toContain('workflow.pause');
		});

		it('handles object and string[] parameter types', () => {
			registry.register(makePrimitive({
				id: 'complex.test',
				category: PrimitiveCategory.STATE_MUTATION,
				safety: PrimitiveSafety.GUARDED,
				description: 'Complex',
				params: [
					makeParam({ name: 'config', type: 'object' }),
					makeParam({ name: 'options', type: 'string[]', required: false }),
				],
				returns: 'void',
			}));

			const catalog = registry.generateCatalog();

			expect(catalog).toContain('config: object');
			expect(catalog).toContain('options?: string[]');
			expect(catalog).toContain('→ void');
		});

		it('maintains registration order within categories', () => {
			const prim1 = makePrimitive({ id: 'state.first', description: 'First' });
			const prim2 = makePrimitive({ id: 'state.second', description: 'Second' });

			registry.register(prim1);
			registry.register(prim2);

			const primitives = registry.getByCategory(PrimitiveCategory.STATE_READ);

			expect(primitives[0]).toBe(prim1);
			expect(primitives[1]).toBe(prim2);
		});
	});
});
