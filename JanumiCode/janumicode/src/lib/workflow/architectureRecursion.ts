/**
 * Architecture Recursive Decomposition
 *
 * Implements the recursive "Local Planner" logic for the DESIGNING sub-state.
 * Evaluates each component against stopping criteria and decomposes further
 * if needed, up to a configurable max depth and breadth.
 *
 * Stopping Criteria (all must be true for a component to be "atomic"):
 *   - context_fit: scope fits within token budget
 *   - verifiable_output: produces testable outputs
 *   - clear_inputs: all dependencies are explicit
 *   - single_responsibility: serves ≤ threshold workflows
 *
 * Recursion Control:
 *   - max_depth: configurable (default 3 levels)
 *   - max_breadth: max components per level (default 25)
 *   - Each level produces ComponentSpec[] with parent_component_id linking
 *
 * Decomposition Strategy:
 *   When components violate stopping criteria, all violating components at the
 *   same depth level are batched into a single LLM-driven decomposition request.
 *   This gives the agent full architecture context for coherent decomposition.
 *   The agent may keep components intact if they are semantically cohesive.
 */

import type { Result } from '../types';
import type {
	ComponentSpec,
	WorkflowNode,
	StoppingCriteria,
	DecompositionConfig,
} from '../types/architecture';
import { DEFAULT_DECOMPOSITION_CONFIG } from '../types/architecture';
import { getLogger, isLoggerInitialized } from '../logging';
import { emitWorkflowCommand } from '../integration/eventBus';

// ==================== DECOMPOSITION CALLBACK ====================

/**
 * Callback for LLM-driven batch decomposition.
 * Receives all violating components at a depth level and returns sub-components.
 * The callback sees the full architecture context to make coherent decisions.
 * May return components unchanged if they are semantically cohesive.
 * Returns empty array if no decomposition is viable.
 */
export type DecomposeFn = (
	violating: Array<{ component: ComponentSpec; violations: string[] }>,
) => Promise<ComponentSpec[]>;

// ==================== STOPPING CRITERIA EVALUATION ====================

/**
 * Evaluate stopping criteria for a single component.
 * Returns which criteria are satisfied and which are violated.
 */
export function evaluateStoppingCriteria(
	component: ComponentSpec,
	workflows: WorkflowNode[],
	config: DecompositionConfig
): StoppingCriteria {
	// 1. Context fit: estimate token footprint
	const contextFit = estimateContextFit(component, config.context_token_limit);

	// 2. Verifiable output: component has a non-empty file_scope and responsibility
	const verifiableOutput = Boolean(
		component.responsibility.length > 0 &&
		component.file_scope.length > 0
	);

	// 3. Clear inputs: all dependencies reference known components (checked by caller)
	//    Here we check that the component's dependency list is explicit (not empty when it clearly needs deps)
	const clearInputs = component.dependencies.length > 0 || component.workflows_served.length <= 1;

	// 4. Single responsibility: serves ≤ threshold workflows
	const singleResponsibility = component.workflows_served.length <= config.responsibility_threshold;

	return {
		context_fit: contextFit,
		verifiable_output: verifiableOutput,
		clear_inputs: clearInputs,
		single_responsibility: singleResponsibility,
	};
}

/**
 * Estimate whether a component's scope fits within the context token budget.
 * Uses a heuristic based on responsibility text length, workflow count,
 * and dependency count as a proxy for implementation complexity.
 */
function estimateContextFit(component: ComponentSpec, tokenLimit: number): boolean {
	// Rough heuristic: each workflow served adds ~1500 tokens of context,
	// each dependency adds ~500 tokens, base component overhead ~1000 tokens
	const estimatedTokens =
		1000 +
		component.workflows_served.length * 1500 +
		component.dependencies.length * 500 +
		(component.responsibility.length / 4); // ~4 chars per token

	return estimatedTokens < tokenLimit;
}

/**
 * Check if all stopping criteria are satisfied (component is "atomic").
 */
export function isAtomic(criteria: StoppingCriteria): boolean {
	return criteria.context_fit &&
		criteria.verifiable_output &&
		criteria.clear_inputs &&
		criteria.single_responsibility;
}

/**
 * Get a human-readable summary of which criteria are violated.
 */
export function getViolationSummary(criteria: StoppingCriteria): string[] {
	const violations: string[] = [];
	if (!criteria.context_fit) {violations.push('context_fit: scope exceeds token budget');}
	if (!criteria.verifiable_output) {violations.push('verifiable_output: missing file_scope or responsibility');}
	if (!criteria.clear_inputs) {violations.push('clear_inputs: dependencies may be implicit');}
	if (!criteria.single_responsibility) {violations.push('single_responsibility: serves too many workflows');}
	return violations;
}

// ==================== RECURSIVE DECOMPOSITION ====================

/**
 * Apply recursive decomposition to a set of components.
 *
 * Processes components level by level (breadth-first by depth). At each depth:
 * 1. Evaluate all components against stopping criteria
 * 2. Keep atomic components as-is
 * 3. Batch all violating components into a single LLM decomposition request
 * 4. Sub-components from decomposition form the next depth level
 *
 * Recursion is bounded by max_depth and max_breadth.
 * Returns a flat array of all components (original atomics + decomposed children).
 */
export async function applyRecursiveDecomposition(
	dialogueId: string,
	components: ComponentSpec[],
	workflows: WorkflowNode[],
	config: DecompositionConfig = DEFAULT_DECOMPOSITION_CONFIG,
	tokenBudget: number = 10000,
	options?: { commandId?: string; dialogueId?: string; forcedMinDepth?: number; decomposeFn?: DecomposeFn }
): Promise<Result<ComponentSpec[]>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architectureRecursion' })
		: null;

	try {
		const allComponents: ComponentSpec[] = [];
		let currentLevel = components.map(c => ({ component: c, depth: 0 }));

		while (currentLevel.length > 0) {
			const currentDepth = currentLevel[0].depth;
			const atomics: ComponentSpec[] = [];
			const violating: Array<{ component: ComponentSpec; violations: string[]; depth: number }> = [];

			// Evaluate all components at this depth level
			for (const { component, depth } of currentLevel) {
				const criteria = evaluateStoppingCriteria(component, workflows, config);
				const forcedDecompose = (options?.forcedMinDepth ?? 0) > depth;

				if (depth >= config.max_depth) {
					// Max depth reached — keep as-is regardless of criteria
					atomics.push(component);
					if (!isAtomic(criteria)) {
						const violations = getViolationSummary(criteria);
						log?.warn('Max decomposition depth reached for non-atomic component', {
							componentId: component.component_id,
							label: component.label,
							violations,
							depth,
						});
						if (options?.commandId && options?.dialogueId) {
							emitWorkflowCommand({
								dialogueId: options.dialogueId,
								commandId: options.commandId,
								action: 'output',
								commandType: 'role_invocation',
								label: 'Recursive Decomposition',
								summary: `⚠ ${component.label} — max depth reached (depth ${depth}), keeping as-is`,
								detail: `Violations: ${violations.join(', ')}`,
								timestamp: new Date().toISOString(),
							});
						}
					} else if (options?.commandId && options?.dialogueId) {
						emitWorkflowCommand({
							dialogueId: options.dialogueId,
							commandId: options.commandId,
							action: 'output',
							commandType: 'role_invocation',
							label: 'Recursive Decomposition',
							summary: `✓ ${component.label} — atomic (all stopping criteria satisfied)`,
							timestamp: new Date().toISOString(),
						});
					}
				} else if (isAtomic(criteria) && !forcedDecompose) {
					// Component passes all stopping criteria — keep as-is
					atomics.push(component);
					if (options?.commandId && options?.dialogueId) {
						emitWorkflowCommand({
							dialogueId: options.dialogueId,
							commandId: options.commandId,
							action: 'output',
							commandType: 'role_invocation',
							label: 'Recursive Decomposition',
							summary: `✓ ${component.label} — atomic (all stopping criteria satisfied)`,
							timestamp: new Date().toISOString(),
						});
					}
				} else {
					// Component violates stopping criteria — needs decomposition
					const violations = getViolationSummary(criteria);
					log?.info('Component violates stopping criteria', {
						componentId: component.component_id,
						label: component.label,
						violations,
						depth,
					});
					violating.push({ component, violations, depth });
				}
			}

			// Keep all atomic components
			allComponents.push(...atomics);

			// If no violations at this depth, we're done
			if (violating.length === 0) {
				break;
			}

			// Attempt LLM-driven batch decomposition for all violating components
			let subComponents: ComponentSpec[] = [];
			if (options?.decomposeFn) {
				try {
					log?.info('Invoking LLM batch decomposition', {
						violatingCount: violating.length,
						depth: currentDepth,
						components: violating.map(v => v.component.label),
					});

					subComponents = await options.decomposeFn(
						violating.map(v => ({ component: v.component, violations: v.violations }))
					);

					log?.info('LLM batch decomposition returned', {
						subComponentCount: subComponents.length,
						depth: currentDepth,
					});
				} catch (err) {
					log?.warn('LLM batch decomposition failed, keeping components as-is', {
						error: err instanceof Error ? err.message : String(err),
						depth: currentDepth,
					});
				}
			}

			// Determine which violating components were actually decomposed
			const violatingIds = new Set(violating.map(v => v.component.component_id));
			const newChildren = subComponents.filter(
				c => c.parent_component_id && violatingIds.has(c.parent_component_id)
			);
			// Components returned unchanged by the LLM (no parent_component_id, or parent not in violating set)
			const keptIntact = subComponents.filter(
				c => !c.parent_component_id || !violatingIds.has(c.parent_component_id)
			);

			if (newChildren.length === 0) {
				// No viable decomposition — keep all violating components as-is
				for (const v of violating) {
					allComponents.push(v.component);
					if (options?.commandId && options?.dialogueId) {
						emitWorkflowCommand({
							dialogueId: options.dialogueId,
							commandId: options.commandId,
							action: 'output',
							commandType: 'role_invocation',
							label: 'Recursive Decomposition',
							summary: `• ${v.component.label} — LLM determined component is cohesive, keeping as-is`,
							detail: `Violations: ${v.violations.join(', ')}`,
							timestamp: new Date().toISOString(),
						});
					}
				}
				break;
			}

			// Breadth check: would adding children exceed max_breadth?
			const projectedTotal = allComponents.length + violating.length + newChildren.length;
			if (projectedTotal > config.max_breadth) {
				log?.warn('Max breadth would be exceeded by LLM decomposition, keeping components as-is', {
					currentTotal: allComponents.length,
					wouldAdd: newChildren.length,
					maxBreadth: config.max_breadth,
				});
				for (const v of violating) {
					allComponents.push(v.component);
					if (options?.commandId && options?.dialogueId) {
						emitWorkflowCommand({
							dialogueId: options.dialogueId,
							commandId: options.commandId,
							action: 'output',
							commandType: 'role_invocation',
							label: 'Recursive Decomposition',
							summary: `⚠ ${v.component.label} — breadth limit reached (${projectedTotal} > ${config.max_breadth})`,
							timestamp: new Date().toISOString(),
						});
					}
				}
				break;
			}

			// Accept decomposition: keep parents as grouping nodes, queue children for next level
			for (const v of violating) {
				const myChildren = newChildren.filter(c => c.parent_component_id === v.component.component_id);
				if (myChildren.length > 0) {
					// Parent was decomposed — keep as grouping node
					allComponents.push(v.component);
					if (options?.commandId && options?.dialogueId) {
						const subLabels = myChildren.map(s => s.label).join(', ');
						emitWorkflowCommand({
							dialogueId: options.dialogueId,
							commandId: options.commandId,
							action: 'output',
							commandType: 'role_invocation',
							label: 'Recursive Decomposition',
							summary: `↳ ${v.component.label} → ${myChildren.length} sub-components (depth ${currentDepth + 1})`,
							detail: `Violations: ${v.violations.join(', ')}\nSub-components: ${subLabels}`,
							timestamp: new Date().toISOString(),
						});
					}
				} else {
					// LLM kept this component intact
					allComponents.push(v.component);
					if (options?.commandId && options?.dialogueId) {
						emitWorkflowCommand({
							dialogueId: options.dialogueId,
							commandId: options.commandId,
							action: 'output',
							commandType: 'role_invocation',
							label: 'Recursive Decomposition',
							summary: `• ${v.component.label} — LLM determined component is cohesive, keeping as-is`,
							detail: `Violations: ${v.violations.join(', ')}`,
							timestamp: new Date().toISOString(),
						});
					}
				}
			}

			// Any components returned intact by LLM that weren't in the violating set
			allComponents.push(...keptIntact);

			// Queue children for next depth level
			currentLevel = newChildren.map(c => ({ component: c, depth: currentDepth + 1 }));
		}

		log?.info('Recursive decomposition complete', {
			inputComponents: components.length,
			outputComponents: allComponents.length,
		});

		return { success: true, value: allComponents };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}
