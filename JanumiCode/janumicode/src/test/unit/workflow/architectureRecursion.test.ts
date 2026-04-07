import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	evaluateStoppingCriteria,
	isAtomic,
	getViolationSummary,
	applyRecursiveDecomposition,
} from '../../../lib/workflow/architectureRecursion';
import { DEFAULT_DECOMPOSITION_CONFIG } from '../../../lib/types/architecture';
import type { ComponentSpec, WorkflowNode, StoppingCriteria } from '../../../lib/types/architecture';
import { randomUUID } from 'node:crypto';

describe('ArchitectureRecursion', () => {
	beforeEach(() => {
		initTestLogger();
	});

	afterEach(() => {
		teardownTestLogger();
	});

	describe('evaluateStoppingCriteria', () => {
		it('evaluates context fit', () => {
			const component: ComponentSpec = {
				component_id: 'comp-1',
				label: 'Small Component',
				responsibility: 'Simple task',
				rationale: 'Test',
				workflows_served: [],
				dependencies: [],
				interaction_patterns: [],
				technology_notes: '',
				file_scope: 'src/small.ts',
				parent_component_id: null,
			};

			const criteria = evaluateStoppingCriteria(component, [], DEFAULT_DECOMPOSITION_CONFIG);

			expect(criteria.context_fit).toBe(true);
		});

		it('detects context overflow', () => {
			const component: ComponentSpec = {
				component_id: 'comp-1',
				label: 'Large Component',
				responsibility: 'Very long responsibility '.repeat(200),
				rationale: 'Test',
				workflows_served: Array(10).fill('wf-1'),
				dependencies: Array(20).fill('dep-1'),
				interaction_patterns: [],
				technology_notes: '',
				file_scope: 'src/large.ts',
				parent_component_id: null,
			};

			const config = { ...DEFAULT_DECOMPOSITION_CONFIG, context_token_limit: 1000 };
			const criteria = evaluateStoppingCriteria(component, [], config);

			expect(criteria.context_fit).toBe(false);
		});

		it('evaluates verifiable output', () => {
			const componentWithScope: ComponentSpec = {
				component_id: 'comp-1',
				label: 'Component',
				responsibility: 'Has responsibility',
				rationale: 'Test',
				workflows_served: [],
				dependencies: [],
				interaction_patterns: [],
				technology_notes: '',
				file_scope: 'src/component.ts',
				parent_component_id: null,
			};

			const criteria = evaluateStoppingCriteria(componentWithScope, [], DEFAULT_DECOMPOSITION_CONFIG);

			expect(criteria.verifiable_output).toBe(true);
		});

		it('detects missing verifiable output', () => {
			const componentNoScope: ComponentSpec = {
				component_id: 'comp-1',
				label: 'Component',
				responsibility: '',
				rationale: 'Test',
				workflows_served: [],
				dependencies: [],
				interaction_patterns: [],
				technology_notes: '',
				file_scope: '',
				parent_component_id: null,
			};

			const criteria = evaluateStoppingCriteria(componentNoScope, [], DEFAULT_DECOMPOSITION_CONFIG);

			expect(criteria.verifiable_output).toBe(false);
		});

		it('evaluates clear inputs', () => {
			const component: ComponentSpec = {
				component_id: 'comp-1',
				label: 'Component',
				responsibility: 'Task',
				rationale: 'Test',
				workflows_served: [],
				dependencies: ['dep-1'],
				interaction_patterns: [],
				technology_notes: '',
				file_scope: 'src/comp.ts',
				parent_component_id: null,
			};

			const criteria = evaluateStoppingCriteria(component, [], DEFAULT_DECOMPOSITION_CONFIG);

			expect(criteria.clear_inputs).toBe(true);
		});

		it('evaluates single responsibility', () => {
			const component: ComponentSpec = {
				component_id: 'comp-1',
				label: 'Component',
				responsibility: 'Single task',
				rationale: 'Test',
				workflows_served: ['wf-1'],
				dependencies: [],
				interaction_patterns: [],
				technology_notes: '',
				file_scope: 'src/comp.ts',
				parent_component_id: null,
			};

			const criteria = evaluateStoppingCriteria(component, [], DEFAULT_DECOMPOSITION_CONFIG);

			expect(criteria.single_responsibility).toBe(true);
		});

		it('detects multiple responsibilities', () => {
			const component: ComponentSpec = {
				component_id: 'comp-1',
				label: 'Component',
				responsibility: 'Many tasks',
				rationale: 'Test',
				workflows_served: ['wf-1', 'wf-2', 'wf-3', 'wf-4'],
				dependencies: [],
				interaction_patterns: [],
				technology_notes: '',
				file_scope: 'src/comp.ts',
				parent_component_id: null,
			};

			const config = { ...DEFAULT_DECOMPOSITION_CONFIG, responsibility_threshold: 2 };
			const criteria = evaluateStoppingCriteria(component, [], config);

			expect(criteria.single_responsibility).toBe(false);
		});
	});

	describe('isAtomic', () => {
		it('returns true when all criteria satisfied', () => {
			const criteria: StoppingCriteria = {
				context_fit: true,
				verifiable_output: true,
				clear_inputs: true,
				single_responsibility: true,
			};

			expect(isAtomic(criteria)).toBe(true);
		});

		it('returns false when any criterion violated', () => {
			const criteriaViolated: StoppingCriteria = {
				context_fit: false,
				verifiable_output: true,
				clear_inputs: true,
				single_responsibility: true,
			};

			expect(isAtomic(criteriaViolated)).toBe(false);
		});

		it('returns false when multiple criteria violated', () => {
			const criteriaMultipleViolations: StoppingCriteria = {
				context_fit: false,
				verifiable_output: false,
				clear_inputs: true,
				single_responsibility: true,
			};

			expect(isAtomic(criteriaMultipleViolations)).toBe(false);
		});

		it('returns false when all criteria violated', () => {
			const criteriaAllViolated: StoppingCriteria = {
				context_fit: false,
				verifiable_output: false,
				clear_inputs: false,
				single_responsibility: false,
			};

			expect(isAtomic(criteriaAllViolated)).toBe(false);
		});
	});

	describe('getViolationSummary', () => {
		it('returns empty array for no violations', () => {
			const criteria: StoppingCriteria = {
				context_fit: true,
				verifiable_output: true,
				clear_inputs: true,
				single_responsibility: true,
			};

			const summary = getViolationSummary(criteria);

			expect(summary).toEqual([]);
		});

		it('identifies context fit violation', () => {
			const criteria: StoppingCriteria = {
				context_fit: false,
				verifiable_output: true,
				clear_inputs: true,
				single_responsibility: true,
			};

			const summary = getViolationSummary(criteria);

			expect(summary).toContain('context_fit: scope exceeds token budget');
		});

		it('identifies verifiable output violation', () => {
			const criteria: StoppingCriteria = {
				context_fit: true,
				verifiable_output: false,
				clear_inputs: true,
				single_responsibility: true,
			};

			const summary = getViolationSummary(criteria);

			expect(summary).toContain('verifiable_output: missing file_scope or responsibility');
		});

		it('identifies clear inputs violation', () => {
			const criteria: StoppingCriteria = {
				context_fit: true,
				verifiable_output: true,
				clear_inputs: false,
				single_responsibility: true,
			};

			const summary = getViolationSummary(criteria);

			expect(summary).toContain('clear_inputs: dependencies may be implicit');
		});

		it('identifies single responsibility violation', () => {
			const criteria: StoppingCriteria = {
				context_fit: true,
				verifiable_output: true,
				clear_inputs: true,
				single_responsibility: false,
			};

			const summary = getViolationSummary(criteria);

			expect(summary).toContain('single_responsibility: serves too many workflows');
		});

		it('identifies multiple violations', () => {
			const criteria: StoppingCriteria = {
				context_fit: false,
				verifiable_output: false,
				clear_inputs: true,
				single_responsibility: true,
			};

			const summary = getViolationSummary(criteria);

			expect(summary.length).toBe(2);
			expect(summary).toContain('context_fit: scope exceeds token budget');
			expect(summary).toContain('verifiable_output: missing file_scope or responsibility');
		});

		it('identifies all violations', () => {
			const criteria: StoppingCriteria = {
				context_fit: false,
				verifiable_output: false,
				clear_inputs: false,
				single_responsibility: false,
			};

			const summary = getViolationSummary(criteria);

			expect(summary.length).toBe(4);
		});
	});

	describe('applyRecursiveDecomposition', () => {
		it('returns atomic components unchanged', async () => {
			const components: ComponentSpec[] = [
				{
					component_id: 'comp-1',
					label: 'Atomic Component',
					responsibility: 'Single task',
					rationale: 'Test',
					workflows_served: ['wf-1'],
					dependencies: ['dep-1'],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: 'src/comp.ts',
					parent_component_id: null,
				},
			];

			const result = await applyRecursiveDecomposition(
				components,
				[],
				DEFAULT_DECOMPOSITION_CONFIG,
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.components.length).toBe(1);
			}
		});

		it('handles empty component array', async () => {
			const result = await applyRecursiveDecomposition(
				[],
				[],
				DEFAULT_DECOMPOSITION_CONFIG,
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.components).toEqual([]);
			}
		});

		it('respects max depth limit', async () => {
			const components: ComponentSpec[] = [
				{
					component_id: 'comp-1',
					label: 'Component',
					responsibility: 'Task',
					rationale: 'Test',
					workflows_served: [],
					dependencies: [],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: 'src/comp.ts',
					parent_component_id: null,
				},
			];

			const config = { ...DEFAULT_DECOMPOSITION_CONFIG, max_depth: 0 };
			const result = await applyRecursiveDecomposition(
				components,
				[],
				config,
			);

			expect(result.success).toBe(true);
		});

		it('respects max breadth limit', async () => {
			const components: ComponentSpec[] = Array(30).fill(null).map((_, i) => ({
				component_id: `comp-${i}`,
				label: `Component ${i}`,
				responsibility: 'Task',
				rationale: 'Test',
				workflows_served: [],
				dependencies: [],
				interaction_patterns: [],
				technology_notes: '',
				file_scope: 'src/comp.ts',
				parent_component_id: null,
			}));

			const config = { ...DEFAULT_DECOMPOSITION_CONFIG, max_breadth: 25 };
			const result = await applyRecursiveDecomposition(
				components,
				[],
				config,
			);

			expect(result.success).toBe(true);
		});

		it('handles custom decomposition function', async () => {
			const components: ComponentSpec[] = [
				{
					component_id: 'comp-1',
					label: 'Component',
					responsibility: '',
					rationale: 'Test',
					workflows_served: [],
					dependencies: [],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: '',
					parent_component_id: null,
				},
			];

			const decomposeFn = async () => {
				return {
					components: [
						{
							component_id: 'sub-1',
							label: 'Sub Component',
							responsibility: 'Sub task',
							rationale: 'Test',
							workflows_served: [],
							dependencies: [],
							interaction_patterns: [],
							technology_notes: '',
							file_scope: 'src/sub.ts',
							parent_component_id: 'comp-1',
						},
					],
					interfaces: [],
					interfaceProviderRemap: [],
				};
			};

			const result = await applyRecursiveDecomposition(
				components,
				[],
				DEFAULT_DECOMPOSITION_CONFIG,
				{ decomposeFn }
			);

			expect(result.success).toBe(true);
		});

		it('handles forced minimum depth', async () => {
			const components: ComponentSpec[] = [
				{
					component_id: 'comp-1',
					label: 'Component',
					responsibility: 'Task',
					rationale: 'Test',
					workflows_served: ['wf-1'],
					dependencies: ['dep-1'],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: 'src/comp.ts',
					parent_component_id: null,
				},
			];

			const result = await applyRecursiveDecomposition(
				components,
				[],
				DEFAULT_DECOMPOSITION_CONFIG,
				{ forcedMinDepth: 1 }
			);

			expect(result.success).toBe(true);
		});

		it('passes command ID to options', async () => {
			const components: ComponentSpec[] = [
				{
					component_id: 'comp-1',
					label: 'Component',
					responsibility: 'Task',
					rationale: 'Test',
					workflows_served: [],
					dependencies: [],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: 'src/comp.ts',
					parent_component_id: null,
				},
			];

			const commandId = randomUUID();
			const result = await applyRecursiveDecomposition(
				components,
				[],
				DEFAULT_DECOMPOSITION_CONFIG,
				{ commandId }
			);

			expect(result.success).toBe(true);
		});
	});

	describe('integration scenarios', () => {
		it('evaluates and decomposes non-atomic components', async () => {
			const component: ComponentSpec = {
				component_id: 'comp-1',
				label: 'Large Component',
				responsibility: '',
				rationale: 'Test',
				workflows_served: ['wf-1', 'wf-2', 'wf-3'],
				dependencies: [],
				interaction_patterns: [],
				technology_notes: '',
				file_scope: '',
				parent_component_id: null,
			};

			const criteria = evaluateStoppingCriteria(component, [], DEFAULT_DECOMPOSITION_CONFIG);
			const atomic = isAtomic(criteria);
			const violations = getViolationSummary(criteria);

			expect(atomic).toBe(false);
			expect(violations.length).toBeGreaterThan(0);
		});

		it('validates atomic components', async () => {
			const component: ComponentSpec = {
				component_id: 'comp-1',
				label: 'Atomic Component',
				responsibility: 'Single clear task',
				rationale: 'Test',
				workflows_served: ['wf-1'],
				dependencies: ['dep-1'],
				interaction_patterns: [],
				technology_notes: '',
				file_scope: 'src/atomic.ts',
				parent_component_id: null,
			};

			const criteria = evaluateStoppingCriteria(component, [], DEFAULT_DECOMPOSITION_CONFIG);
			const atomic = isAtomic(criteria);
			const violations = getViolationSummary(criteria);

			expect(atomic).toBe(true);
			expect(violations).toEqual([]);
		});

		it('processes mixed atomic and non-atomic components', async () => {
			const components: ComponentSpec[] = [
				{
					component_id: 'atomic-1',
					label: 'Atomic',
					responsibility: 'Clear task',
					rationale: 'Test',
					workflows_served: ['wf-1'],
					dependencies: ['dep-1'],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: 'src/atomic.ts',
					parent_component_id: null,
				},
				{
					component_id: 'non-atomic-1',
					label: 'Non-Atomic',
					responsibility: '',
					rationale: 'Test',
					workflows_served: ['wf-1', 'wf-2', 'wf-3'],
					dependencies: [],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: '',
					parent_component_id: null,
				},
			];

			const result = await applyRecursiveDecomposition(
				components,
				[],
				DEFAULT_DECOMPOSITION_CONFIG,
			);

			expect(result.success).toBe(true);
		});
	});

	describe('error handling', () => {
		it('handles decomposition errors gracefully', async () => {
			const components: ComponentSpec[] = [
				{
					component_id: 'comp-1',
					label: 'Component',
					responsibility: '',
					rationale: 'Test',
					workflows_served: [],
					dependencies: [],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: '',
					parent_component_id: null,
				},
			];

			const decomposeFn = async (): Promise<{ components: ComponentSpec[]; interfaces: never[]; interfaceProviderRemap: never[] }> => {
				throw new Error('Decomposition failed');
			};

			const result = await applyRecursiveDecomposition(
				components,
				[],
				DEFAULT_DECOMPOSITION_CONFIG,
				{ decomposeFn }
			);

			// invokeDecomposition catches errors from decomposeFn and logs a WARN,
			// then proceeds with empty subComponents — keeps original components as-is.
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.components.length).toBeGreaterThanOrEqual(1);
			}
		});

		it('validates decomposition config', async () => {
			const components: ComponentSpec[] = [
				{
					component_id: 'comp-1',
					label: 'Component',
					responsibility: 'Task',
					rationale: 'Test',
					workflows_served: [],
					dependencies: [],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: 'src/comp.ts',
					parent_component_id: null,
				},
			];

			const result = await applyRecursiveDecomposition(
				components,
				[],
				DEFAULT_DECOMPOSITION_CONFIG,
			);

			expect(result.success).toBe(true);
		});
	});

	describe('safety nets and pathological inputs', () => {
		// Helper: build a non-atomic violating component
		const violatingComp = (id: string): ComponentSpec => ({
			component_id: id,
			label: `Component ${id}`,
			responsibility: '',         // empty → fails verifiable_output
			rationale: 'Test',
			workflows_served: ['wf-1', 'wf-2', 'wf-3', 'wf-4'],  // > responsibility_threshold
			dependencies: [],
			interaction_patterns: [],
			technology_notes: '',
			file_scope: '',             // empty → fails verifiable_output
			parent_component_id: null,
		});

		// Pathological A: LLM echoes the same components every iteration → MAX_ITERATIONS cap saves us.
		// This is a regression guard for C3: if anyone removes the iteration cap, this test will hang
		// and the test runner's timeout will catch it.
		it('terminates within iteration cap when LLM keeps echoing same non-atomic components', async () => {
			const components: ComponentSpec[] = [violatingComp('comp-1')];

			// LLM keeps returning the same component as a "kept intact" sibling — never decomposes,
			// never refactors → triggers infinite-loop scenario without C3.
			const decomposeFn = async () => ({
				components: [{ ...components[0], parent_component_id: null }],  // same comp_id, no parent
				interfaces: [],
				interfaceProviderRemap: [],
			});

			const start = Date.now();
			const result = await applyRecursiveDecomposition(
				components,
				[],
				{ ...DEFAULT_DECOMPOSITION_CONFIG, max_depth: 100 },  // intentionally high so iteration cap is the only bound
				{ decomposeFn },
			);
			const elapsedMs = Date.now() - start;

			expect(result.success).toBe(true);
			expect(elapsedMs).toBeLessThan(2000);  // sanity: we did NOT hang
		});

		// M4: refactor that returns an orphan-shaped component (no workflows, no parent) must
		// be rejected — the original is kept instead.
		it('rejects orphan-shaped refactors and keeps the original component', async () => {
			const original = violatingComp('comp-1');
			const decomposeFn = async () => ({
				components: [
					{
						component_id: 'comp-1',           // same id → identified as refactor
						label: 'Refactored Empty',
						responsibility: '',
						rationale: 'broken',
						workflows_served: [],              // empty
						dependencies: [],
						interaction_patterns: [],
						technology_notes: '',
						file_scope: '',
						parent_component_id: null,         // no parent → orphan-shaped
					},
				],
				interfaces: [],
				interfaceProviderRemap: [],
			});

			const result = await applyRecursiveDecomposition(
				[original],
				[],
				DEFAULT_DECOMPOSITION_CONFIG,
				{ decomposeFn },
			);

			expect(result.success).toBe(true);
			if (result.success) {
				const found = result.value.components.find(c => c.component_id === 'comp-1');
				expect(found).toBeDefined();
				// The orphan refactor should NOT have replaced the original — label should be unchanged
				expect(found?.label).toBe('Component comp-1');
			}
		});

		// C4: when the LLM returns more children than max_breadth allows, the abandoned-batch
		// interfaces and provider remaps must NOT be aggregated into the result.
		it('discards interfaces from a batch that exceeds max_breadth', async () => {
			const components: ComponentSpec[] = [violatingComp('parent-1')];
			const decomposeFn = async () => ({
				// 30 children — will trip max_breadth=5
				components: Array.from({ length: 30 }, (_, i) => ({
					component_id: `child-${i}`,
					label: `Child ${i}`,
					responsibility: 'leaf',
					rationale: 'split',
					workflows_served: ['wf-1'],
					dependencies: [],
					interaction_patterns: [],
					technology_notes: '',
					file_scope: `src/child-${i}.ts`,
					parent_component_id: 'parent-1',
				})),
				interfaces: [{
					interface_id: 'API-DOOMED',
					type: 'REST' as const,
					label: 'doomed contract',
					description: '',
					provider_component: 'child-0',
					consumer_components: ['child-1'],
					contract: '',
					source_workflows: [],
				}],
				interfaceProviderRemap: [{ interface_id: 'API-DOOMED', new_provider_component: 'child-0' }],
			});

			const result = await applyRecursiveDecomposition(
				components,
				[],
				{ ...DEFAULT_DECOMPOSITION_CONFIG, max_breadth: 5 },
				{ decomposeFn },
			);

			expect(result.success).toBe(true);
			if (result.success) {
				// The doomed interface must not have been committed
				expect(result.value.interfaces.find(i => i.interface_id === 'API-DOOMED')).toBeUndefined();
				expect(result.value.interfaceProviderRemap.length).toBe(0);
			}
		});
	});
});
