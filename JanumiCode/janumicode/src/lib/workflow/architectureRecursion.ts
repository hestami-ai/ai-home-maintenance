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
	InterfaceSpec,
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
export interface InterfaceProviderRemap {
	interface_id: string;
	new_provider_component: string;
}

export type DecomposeFn = (
	violating: Array<{ component: ComponentSpec; violations: string[] }>,
) => Promise<{ components: ComponentSpec[]; interfaces: InterfaceSpec[]; interfaceProviderRemap: InterfaceProviderRemap[] }>;

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

// Private type aliases
type ApplyOptions = {
	commandId?: string;
	dialogueId?: string;
	forcedMinDepth?: number;
	decomposeFn?: DecomposeFn;
};
type Log = ReturnType<ReturnType<typeof getLogger>['child']> | null;
type LeveledComponent = { component: ComponentSpec; depth: number };
type ViolatingRecord = { component: ComponentSpec; violations: string[]; depth: number };

/**
 * Classify components in a depth level into atomics vs. violating.
 * Emits per-component events and handles max-depth termination.
 */
function classifyLevel(
	thisLevel: LeveledComponent[],
	workflows: WorkflowNode[],
	config: DecompositionConfig,
	options: ApplyOptions | undefined,
	log: Log,
): { atomics: ComponentSpec[]; violating: ViolatingRecord[] } {
	const atomics: ComponentSpec[] = [];
	const violating: ViolatingRecord[] = [];

	for (const { component, depth } of thisLevel) {
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

	return { atomics, violating };
}

/**
 * Invoke the LLM batch-decomposition callback. Partitions the response into
 * structural children (parent_component_id ∈ violating set) and keptIntact.
 * Returns empty arrays on missing/throwing decomposeFn.
 */
async function invokeDecomposition(
	violating: ViolatingRecord[],
	decomposeFn: DecomposeFn | undefined,
	currentDepth: number,
	log: Log,
): Promise<{
	newChildren: ComponentSpec[];
	keptIntact: ComponentSpec[];
	interfaces: InterfaceSpec[];
	providerRemap: InterfaceProviderRemap[];
}> {
	let subComponents: ComponentSpec[] = [];
	let interfaces: InterfaceSpec[] = [];
	let providerRemap: InterfaceProviderRemap[] = [];

	if (decomposeFn) {
		try {
			log?.info('Invoking LLM batch decomposition', {
				violatingCount: violating.length,
				depth: currentDepth,
				components: violating.map(v => v.component.label),
			});

			const decomp = await decomposeFn(
				violating.map(v => ({ component: v.component, violations: v.violations }))
			);
			subComponents = decomp.components;
			interfaces = decomp.interfaces;
			providerRemap = decomp.interfaceProviderRemap;

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

	const violatingIds = new Set(violating.map(v => v.component.component_id));
	const newChildren = subComponents.filter(
		c => c.parent_component_id && violatingIds.has(c.parent_component_id)
	);
	const keptIntact = subComponents.filter(
		c => !c.parent_component_id || !violatingIds.has(c.parent_component_id)
	);

	return { newChildren, keptIntact, interfaces, providerRemap };
}

/**
 * Extract in-place refactored versions from keptIntact (matched by component_id
 * to a violating component). Mutates keptIntact by splicing out matches.
 */
function extractRefactors(
	violating: ViolatingRecord[],
	keptIntact: ComponentSpec[],
): Map<string, ComponentSpec> {
	const refactoredById = new Map<string, ComponentSpec>();
	for (const v of violating) {
		const idx = keptIntact.findIndex(c => c.component_id === v.component.component_id);
		if (idx >= 0) {
			refactoredById.set(v.component.component_id, keptIntact[idx]);
			keptIntact.splice(idx, 1);
		}
	}
	return refactoredById;
}

/**
 * Process each violating component into one of three outcomes:
 *   - structural decomposition: parent kept as grouping node, children queued at v.depth+1
 *   - in-place refactor: re-evaluate stopping criteria; atomic → accept, else requeue at v.depth+1
 *   - keep-original: LLM made no change, or breadth limit was exceeded
 *
 * All depth attribution uses each violating component's own `v.depth`, never a
 * shared `currentDepth` (Fixes C1, H1, C2). Refactors are also screened for
 * orphan-shaped output before being accepted (Fix M4).
 *
 * Returns accepted components, items to requeue (refactors-still-violating AND
 * structural children, all at the right depth), and a progress flag.
 */
function processViolatingBatch(
	violating: ViolatingRecord[],
	newChildren: ComponentSpec[],
	refactoredById: Map<string, ComponentSpec>,
	breadthExceeded: boolean,
	ctx: {
		workflows: WorkflowNode[];
		config: DecompositionConfig;
		options: ApplyOptions | undefined;
		projectedTotal: number;
		log: Log;
	},
): {
	acceptedComponents: ComponentSpec[];
	requeued: LeveledComponent[];
	progressMade: boolean;
} {
	const acceptedComponents: ComponentSpec[] = [];
	const requeued: LeveledComponent[] = [];
	let progressMade = false;
	const { workflows, config, options, projectedTotal, log } = ctx;

	for (const v of violating) {
		const myChildren = breadthExceeded
			? []
			: newChildren.filter(c => c.parent_component_id === v.component.component_id);
		const refactored = refactoredById.get(v.component.component_id);
		const childDepth = v.depth + 1;

		if (myChildren.length > 0 && refactored) {
			log?.warn('LLM returned both children and an in-place refactor for the same component; preferring children', {
				componentId: v.component.component_id, label: v.component.label,
			});
		}

		if (myChildren.length > 0) {
			// Parent was decomposed — keep as grouping node, children queued at v.depth+1
			acceptedComponents.push(v.component);
			for (const child of myChildren) {
				requeued.push({ component: child, depth: childDepth });
			}
			progressMade = true;
			if (options?.commandId && options?.dialogueId) {
				const subLabels = myChildren.map(s => s.label).join(', ');
				emitWorkflowCommand({
					dialogueId: options.dialogueId,
					commandId: options.commandId,
					action: 'output',
					commandType: 'role_invocation',
					label: 'Recursive Decomposition',
					summary: `↳ ${v.component.label} → ${myChildren.length} sub-components (depth ${childDepth})`,
					detail: `Violations: ${v.violations.join(', ')}\nSub-components: ${subLabels}`,
					timestamp: new Date().toISOString(),
				});
			}
		} else if (refactored) {
			// Reject orphan-shaped refactors (M4)
			if (refactored.workflows_served.length === 0 && !refactored.parent_component_id) {
				log?.warn('Rejected orphan-shaped refactor from LLM (no workflows, no parent); keeping original', {
					componentId: refactored.component_id, label: refactored.label,
				});
				acceptedComponents.push(v.component);
				continue;
			}
			// In-place rewrite — re-evaluate stopping criteria. If still violating, requeue at v.depth+1.
			const criteria = evaluateStoppingCriteria(refactored, workflows, config);
			if (isAtomic(criteria)) {
				acceptedComponents.push(refactored);
			} else {
				requeued.push({ component: refactored, depth: childDepth });
				log?.info('Refactored component still violates stopping criteria, queued for next iteration', {
					componentId: refactored.component_id, label: refactored.label,
					depth: childDepth,
					violations: getViolationSummary(criteria),
				});
			}
			progressMade = true;
			if (options?.commandId && options?.dialogueId) {
				emitWorkflowCommand({
					dialogueId: options.dialogueId,
					commandId: options.commandId,
					action: 'output',
					commandType: 'role_invocation',
					label: 'Recursive Decomposition',
					summary: `✎ ${v.component.label} — LLM refactored in-place`,
					detail: `Violations: ${v.violations.join(', ')}`,
					timestamp: new Date().toISOString(),
				});
			}
		} else {
			// LLM did not return this component — keep original
			acceptedComponents.push(v.component);
			if (options?.commandId && options?.dialogueId) {
				const reason = breadthExceeded
					? `breadth limit reached (${projectedTotal} > ${config.max_breadth})`
					: 'LLM determined component is cohesive, keeping as-is';
				emitWorkflowCommand({
					dialogueId: options.dialogueId,
					commandId: options.commandId,
					action: 'output',
					commandType: 'role_invocation',
					label: 'Recursive Decomposition',
					summary: `${breadthExceeded ? '⚠' : '•'} ${v.component.label} — ${reason}`,
					detail: `Violations: ${v.violations.join(', ')}`,
					timestamp: new Date().toISOString(),
				});
			}
		}
	}

	return { acceptedComponents, requeued, progressMade };
}

/**
 * Validate keptIntact components after refactor extraction. Rejects orphans
 * (no workflows, no parent), accepts atomics, requeues non-atomic at the
 * supplied requeueDepth (typically min violating depth + 1, so the iteration
 * cap and max_depth check still bound termination).
 */
function validateKeptIntact(
	keptIntact: ComponentSpec[],
	requeueDepth: number,
	workflows: WorkflowNode[],
	config: DecompositionConfig,
	log: Log,
): {
	acceptedComponents: ComponentSpec[];
	requeued: LeveledComponent[];
} {
	const acceptedComponents: ComponentSpec[] = [];
	const requeued: LeveledComponent[] = [];

	for (const component of keptIntact) {
		if (component.workflows_served.length === 0 && !component.parent_component_id) {
			log?.warn('Rejected orphan component from LLM (no workflows, no parent)', {
				componentId: component.component_id, label: component.label,
			});
			continue;
		}
		const criteria = evaluateStoppingCriteria(component, workflows, config);
		if (isAtomic(criteria)) {
			acceptedComponents.push(component);
		} else {
			requeued.push({ component, depth: requeueDepth });
			log?.info('keptIntact component queued for decomposition', {
				componentId: component.component_id, label: component.label,
				depth: requeueDepth,
			});
		}
	}

	return { acceptedComponents, requeued };
}

/**
 * Remap dependency edges from decomposed parents to their children.
 * When COMP-A is decomposed into COMP-A1 and COMP-A2, any peer component
 * that declares dependencies: ["COMP-A"] should now reference the children.
 *
 * Mutation contract (H2): mutates `comp.dependencies` in place on every component
 * whose deps reference a decomposed parent. The components flowing through
 * decomposition ARE the working architecture document — these mutations are
 * intended to persist downstream. Callers MUST NOT pass shared references they
 * expect to remain unchanged.
 *
 * Phase 3: this function is now exported so it can be called from architecturePhase
 * AFTER RC4 dedupe (so it operates on the same set as RC5 interface remap).
 */
export function remapDependencyEdges(allComponents: ComponentSpec[], log: Log = null): void {
	// Build parent → children map. Gating on finalComponentIds keeps this in
	// lockstep with RC5's interface remap in architecturePhase.ts — both passes
	// must build identical maps so dep edges and interface edges remap consistently.
	const finalComponentIds = new Set(allComponents.map(c => c.component_id));
	const parentToChildrenMap = new Map<string, string[]>();
	for (const comp of allComponents) {
		if (comp.parent_component_id && finalComponentIds.has(comp.parent_component_id)) {
			const siblings = parentToChildrenMap.get(comp.parent_component_id) || [];
			siblings.push(comp.component_id);
			parentToChildrenMap.set(comp.parent_component_id, siblings);
		}
	}

	if (parentToChildrenMap.size === 0) { return; }

	for (const comp of allComponents) {
		if (comp.dependencies.length === 0) { continue; }
		const remapped: string[] = [];
		for (const dep of comp.dependencies) {
			const children = parentToChildrenMap.get(dep);
			if (children && children.length > 0) {
				remapped.push(...children);
			} else {
				remapped.push(dep);
			}
		}
		comp.dependencies = [...new Set(remapped)].filter(d => d !== comp.component_id);
	}
	log?.info('Dependency edges remapped after decomposition', {
		parentsDecomposed: parentToChildrenMap.size,
	});
}

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
	components: ComponentSpec[],
	workflows: WorkflowNode[],
	config: DecompositionConfig = DEFAULT_DECOMPOSITION_CONFIG,
	options?: ApplyOptions
): Promise<Result<{ components: ComponentSpec[]; interfaces: InterfaceSpec[]; interfaceProviderRemap: InterfaceProviderRemap[] }>> {
	const log: Log = isLoggerInitialized()
		? getLogger().child({ component: 'architectureRecursion' })
		: null;

	// Hard iteration cap as a backstop against pathological LLM cycles where
	// the same components keep coming back without depth advancement (Fix C3).
	const MAX_ITERATIONS = 20;

	try {
		const allComponents: ComponentSpec[] = [];
		const aggregatedInterfaces: InterfaceSpec[] = [];
		const aggregatedProviderRemap: InterfaceProviderRemap[] = [];
		let currentLevel: LeveledComponent[] = components.map(c => ({ component: c, depth: 0 }));
		let iterations = 0;

		while (currentLevel.length > 0) {
			if (++iterations > MAX_ITERATIONS) {
				log?.warn('Recursive decomposition iteration cap reached, accepting remaining components as-is', {
					iterationCap: MAX_ITERATIONS,
					remainingInQueue: currentLevel.length,
				});
				for (const { component } of currentLevel) {
					allComponents.push(component);
				}
				break;
			}

			// Snapshot and reset: items requeued by helpers flow into the fresh
			// currentLevel for the next iteration.
			const thisLevel = currentLevel;
			currentLevel = [];
			// Use min depth across the level for keptIntact requeue attribution.
			// Per-violating decisions inside processViolatingBatch use v.depth directly.
			const minDepth = thisLevel.reduce((m, l) => Math.min(m, l.depth), thisLevel[0].depth);

			const { atomics, violating } = classifyLevel(thisLevel, workflows, config, options, log);
			allComponents.push(...atomics);

			if (violating.length === 0) {
				break;
			}

			const decomp = await invokeDecomposition(violating, options?.decomposeFn, minDepth, log);

			const refactoredById = extractRefactors(violating, decomp.keptIntact);

			const projectedTotal = allComponents.length + violating.length + decomp.newChildren.length;
			const breadthExceeded = decomp.newChildren.length > 0 && projectedTotal > config.max_breadth;
			if (breadthExceeded) {
				log?.warn('Max breadth would be exceeded by LLM decomposition, keeping components as-is', {
					currentTotal: allComponents.length,
					wouldAdd: decomp.newChildren.length,
					maxBreadth: config.max_breadth,
				});
			} else {
				// C4: only commit interfaces and provider remaps if we actually accept this batch.
				// Children dropped due to breadth-exceeded would leave dangling references.
				aggregatedInterfaces.push(...decomp.interfaces);
				aggregatedProviderRemap.push(...decomp.providerRemap);
			}

			const batchResult = processViolatingBatch(
				violating, decomp.newChildren, refactoredById, breadthExceeded,
				{ workflows, config, options, projectedTotal, log },
			);
			allComponents.push(...batchResult.acceptedComponents);
			currentLevel.push(...batchResult.requeued);

			const intactResult = validateKeptIntact(decomp.keptIntact, minDepth + 1, workflows, config, log);
			allComponents.push(...intactResult.acceptedComponents);
			currentLevel.push(...intactResult.requeued);

			if (breadthExceeded) {
				break;
			}

			if (!batchResult.progressMade && currentLevel.length === 0) {
				break;
			}
		}

		// Note: dependency edge remapping moved to architecturePhase.ts (Phase 3 / Fix H3)
		// so it runs AFTER RC4 dedupe alongside RC5 interface remap, on the same component set.

		log?.info('Recursive decomposition complete', {
			inputComponents: components.length,
			outputComponents: allComponents.length,
		});

		return { success: true, value: { components: allComponents, interfaces: aggregatedInterfaces, interfaceProviderRemap: aggregatedProviderRemap } };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}
