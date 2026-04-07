/**
 * Dependency Graph Builder - Build and analyze module dependency graphs
 * Detects circular dependencies and calculates coupling metrics
 */

import type { FileImports } from './dependencyParser';

export interface DependencyNode {
	filePath: string;
	dependencies: string[];
	dependents: string[];
}

export interface DependencyGraph {
	nodes: Map<string, DependencyNode>;
}

export interface Cycle {
	nodes: string[];
	length: number;
}

export interface CouplingMetrics {
	afferentCoupling: number;
	efferentCoupling: number;
	instability: number;
}

/**
 * Build a dependency graph from file imports
 */
export function buildDependencyGraph(fileImports: FileImports[]): DependencyGraph {
	const nodes = new Map<string, DependencyNode>();

	for (const fileImport of fileImports) {
		if (!nodes.has(fileImport.filePath)) {
			nodes.set(fileImport.filePath, {
				filePath: fileImport.filePath,
				dependencies: [],
				dependents: []
			});
		}

		const node = nodes.get(fileImport.filePath);
		if (node) {
			node.dependencies = fileImport.resolvedPaths;
		}

		for (const dep of fileImport.resolvedPaths) {
			if (!nodes.has(dep)) {
				nodes.set(dep, {
					filePath: dep,
					dependencies: [],
					dependents: []
				});
			}
			const depNode = nodes.get(dep);
			if (depNode && !depNode.dependents.includes(fileImport.filePath)) {
				depNode.dependents.push(fileImport.filePath);
			}
		}
	}

	return { nodes };
}

/**
 * Detect circular dependencies using Tarjan's algorithm
 */
export function detectCycles(graph: DependencyGraph): Cycle[] {
	const cycles: Cycle[] = [];
	const visited = new Set<string>();
	const recursionStack = new Set<string>();
	const currentPath: string[] = [];

	function dfs(node: string): void {
		visited.add(node);
		recursionStack.add(node);
		currentPath.push(node);

		const nodeData = graph.nodes.get(node);
		if (nodeData) {
			for (const dep of nodeData.dependencies) {
				if (!visited.has(dep)) {
					dfs(dep);
				} else if (recursionStack.has(dep)) {
					const cycleStart = currentPath.indexOf(dep);
					if (cycleStart !== -1) {
						const cycle = currentPath.slice(cycleStart);
						cycles.push({
							nodes: [...cycle, dep],
							length: cycle.length
						});
					}
				}
			}
		}

		currentPath.pop();
		recursionStack.delete(node);
	}

	for (const node of graph.nodes.keys()) {
		if (!visited.has(node)) {
			dfs(node);
		}
	}

	return cycles;
}

/**
 * Get strongly connected components (groups of mutually dependent modules)
 */
export function getStronglyConnectedComponents(graph: DependencyGraph): string[][] {
	const index = new Map<string, number>();
	const lowlink = new Map<string, number>();
	const onStack = new Set<string>();
	const stack: string[] = [];
	const components: string[][] = [];
	let currentIndex = 0;

	function strongConnect(node: string): void {
		index.set(node, currentIndex);
		lowlink.set(node, currentIndex);
		currentIndex++;
		stack.push(node);
		onStack.add(node);

		const nodeData = graph.nodes.get(node);
		if (nodeData) {
			for (const dep of nodeData.dependencies) {
				if (!index.has(dep)) {
					strongConnect(dep);
					const nodeLowlink = lowlink.get(node);
					const depLowlink = lowlink.get(dep);
					if (nodeLowlink !== undefined && depLowlink !== undefined) {
						lowlink.set(node, Math.min(nodeLowlink, depLowlink));
					}
				} else if (onStack.has(dep)) {
					const nodeLowlink = lowlink.get(node);
					const depIndex = index.get(dep);
					if (nodeLowlink !== undefined && depIndex !== undefined) {
						lowlink.set(node, Math.min(nodeLowlink, depIndex));
					}
				}
			}
		}

		if (lowlink.get(node) === index.get(node)) {
			const component: string[] = [];
			let w: string;
			do {
				w = stack.pop()!;
				onStack.delete(w);
				component.push(w);
			} while (w !== node);

			if (component.length > 1) {
				components.push(component);
			}
		}
	}

	for (const node of graph.nodes.keys()) {
		if (!index.has(node)) {
			strongConnect(node);
		}
	}

	return components;
}

/**
 * Calculate coupling metrics for a module
 * - Afferent Coupling (Ca): Number of modules that depend on this module
 * - Efferent Coupling (Ce): Number of modules this module depends on
 * - Instability (I): Ce / (Ce + Ca), range 0-1, where 0 is maximally stable
 */
export function getCouplingMetrics(graph: DependencyGraph, filePath: string): CouplingMetrics {
	const node = graph.nodes.get(filePath);
	if (!node) {
		return { afferentCoupling: 0, efferentCoupling: 0, instability: 0 };
	}

	const afferentCoupling = node.dependents.length;
	const efferentCoupling = node.dependencies.length;
	const total = afferentCoupling + efferentCoupling;
	const instability = total === 0 ? 0 : efferentCoupling / total;

	return {
		afferentCoupling,
		efferentCoupling,
		instability
	};
}

/**
 * Get modules with high fan-out (too many dependencies)
 */
export function getHighFanOutModules(graph: DependencyGraph, threshold: number): string[] {
	const result: string[] = [];

	for (const [filePath, node] of graph.nodes) {
		if (node.dependencies.length > threshold) {
			result.push(filePath);
		}
	}

	return result;
}

/**
 * Get leaf modules (no dependencies)
 */
export function getLeafModules(graph: DependencyGraph): string[] {
	const result: string[] = [];

	for (const [filePath, node] of graph.nodes) {
		if (node.dependencies.length === 0) {
			result.push(filePath);
		}
	}

	return result;
}

/**
 * Get root modules (nothing depends on them)
 */
export function getRootModules(graph: DependencyGraph): string[] {
	const result: string[] = [];

	for (const [filePath, node] of graph.nodes) {
		if (node.dependents.length === 0) {
			result.push(filePath);
		}
	}

	return result;
}
