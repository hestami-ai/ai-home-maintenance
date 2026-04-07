/**
 * Circular Dependency Visualization
 * Generates Mermaid diagrams and fix suggestions for circular dependencies
 */

import type { DependencyGraph, Cycle } from './graphBuilder';

export interface CycleFix {
	cycle: string[];
	visualization: string;
	suggestions: Array<{
		action: 'remove' | 'extract' | 'invert';
		from: string;
		to: string;
		reason: string;
		impact: 'low' | 'medium' | 'high';
	}>;
}

/**
 * Generate Mermaid diagram for a circular dependency
 */
export function generateMermaidDiagram(cycle: Cycle, basePath: string): string {
	const nodes = cycle.nodes.map(node => {
		const fileName = node.replace(basePath, '').split('/').pop()?.replace('.ts', '') || 'unknown';
		const sanitized = fileName.replace(/[^a-zA-Z0-9]/g, '_');
		return { original: node, sanitized, fileName };
	});

	let mermaid = '```mermaid\ngraph LR\n';

	// Add nodes with labels
	nodes.forEach(node => {
		mermaid += `    ${node.sanitized}["${node.fileName}"]\n`;
	});

	// Add edges to show the cycle
	for (let i = 0; i < nodes.length; i++) {
		const current = nodes[i];
		const next = nodes[(i + 1) % nodes.length];
		mermaid += `    ${current.sanitized} --> ${next.sanitized}\n`;
	}

	// Highlight the cycle
	mermaid += `    style ${nodes[0].sanitized} fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px\n`;
	if (nodes.length > 1) {
		mermaid += `    style ${nodes[nodes.length - 1].sanitized} fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px\n`;
	}

	mermaid += '```\n';
	return mermaid;
}

/**
 * Analyze coupling strength between modules in a cycle
 */
export function analyzeCouplingStrength(
	graph: DependencyGraph,
	from: string,
	to: string
): number {
	const fromNode = graph.nodes.get(from);
	if (!fromNode) {return 0;}

	// Count how many imports from 'from' point to 'to'
	const importsToTarget = fromNode.dependencies.filter(dep => dep === to).length;
	
	// Normalize by total dependencies
	const totalDeps = fromNode.dependencies.length;
	if (totalDeps === 0) {return 0;}

	return importsToTarget / totalDeps;
}

/**
 * Suggest fixes for breaking a circular dependency
 */
export function suggestCycleFixes(
	cycle: Cycle,
	graph: DependencyGraph,
	basePath: string
): CycleFix {
	const suggestions: CycleFix['suggestions'] = [];
	const cycleNodes = cycle.nodes;

	// Analyze each edge in the cycle
	for (let i = 0; i < cycleNodes.length; i++) {
		const from = cycleNodes[i];
		const to = cycleNodes[(i + 1) % cycleNodes.length];
		
		const coupling = analyzeCouplingStrength(graph, from, to);
		const fromNode = graph.nodes.get(from);
		const toNode = graph.nodes.get(to);

		if (!fromNode || !toNode) {continue;}

		const fromFile = from.replace(basePath, '').replace(/^\//, '');
		const toFile = to.replace(basePath, '').replace(/^\//, '');

		// Suggestion 1: Remove the weakest dependency
		if (coupling < 0.3) {
			suggestions.push({
				action: 'remove',
				from: fromFile,
				to: toFile,
				reason: `Weak coupling (${Math.round(coupling * 100)}%) - likely can be refactored away`,
				impact: 'low'
			});
		}

		// Suggestion 2: Extract shared dependencies
		if (fromNode.dependencies.length > 5 && toNode.dependencies.length > 5) {
			suggestions.push({
				action: 'extract',
				from: fromFile,
				to: toFile,
				reason: 'Both modules have many dependencies - extract common types/interfaces to shared module',
				impact: 'medium'
			});
		}

		// Suggestion 3: Dependency inversion
		if (coupling > 0.5) {
			suggestions.push({
				action: 'invert',
				from: fromFile,
				to: toFile,
				reason: `Strong coupling (${Math.round(coupling * 100)}%) - use dependency injection or events`,
				impact: 'high'
			});
		}
	}

	// Sort by impact (low first - easier fixes)
	const impactOrder = { low: 0, medium: 1, high: 2 };
	suggestions.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

	return {
		cycle: cycleNodes.map(n => n.replace(basePath, '').replace(/^\//, '')),
		visualization: generateMermaidDiagram(cycle, basePath),
		suggestions: suggestions.slice(0, 3) // Top 3 suggestions
	};
}

/**
 * Calculate impact radius of breaking a dependency
 */
export function calculateImpactRadius(
	graph: DependencyGraph,
	from: string,
	to: string
): {
	affectedModules: string[];
	cascadeDepth: number;
} {
	const affected = new Set<string>([from]);
	let depth = 0;
	let frontier = [from];

	// BFS to find all modules that depend on 'from'
	while (frontier.length > 0 && depth < 5) {
		const nextFrontier: string[] = [];
		
		for (const node of frontier) {
			for (const [modulePath, moduleNode] of graph.nodes.entries()) {
				if (moduleNode.dependencies.includes(node) && !affected.has(modulePath)) {
					affected.add(modulePath);
					nextFrontier.push(modulePath);
				}
			}
		}

		frontier = nextFrontier;
		depth++;
	}

	return {
		affectedModules: Array.from(affected),
		cascadeDepth: depth
	};
}

/**
 * Format cycle fix as human-readable text
 */
export function formatCycleFix(fix: CycleFix): string {
	let output = '\n';
	output += '🔄 CIRCULAR DEPENDENCY DETECTED\n';
	output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

	output += 'Cycle:\n';
	fix.cycle.forEach((file, i) => {
		output += `  ${i + 1}. ${file}\n`;
	});
	if (fix.cycle.length > 0) {
		output += `  └─> ${fix.cycle[0]} (back to start)\n`;
	}

	output += '\n' + fix.visualization + '\n';

	output += '💡 SUGGESTED FIXES (in order of difficulty):\n\n';
	fix.suggestions.forEach((suggestion, i) => {
		const icon = suggestion.impact === 'low' ? '✅' : suggestion.impact === 'medium' ? '⚡' : '🔧';
		output += `${i + 1}. ${icon} ${suggestion.action.toUpperCase()}: ${suggestion.from} → ${suggestion.to}\n`;
		output += `   Reason: ${suggestion.reason}\n`;
		output += `   Impact: ${suggestion.impact}\n\n`;
	});

	output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
	return output;
}

/**
 * Generate summary of all cycles with visualizations
 */
export function generateCycleSummary(
	cycles: Cycle[],
	graph: DependencyGraph,
	basePath: string
): string {
	if (cycles.length === 0) {
		return '\n✅ No circular dependencies detected!\n';
	}

	let output = '\n';
	output += `🚨 FOUND ${cycles.length} CIRCULAR DEPENDENC${cycles.length === 1 ? 'Y' : 'IES'}\n`;
	output += '═══════════════════════════════════════════════════════\n\n';

	cycles.slice(0, 5).forEach((cycle, index) => {
		output += `\n── Cycle ${index + 1} (${cycle.nodes.length} modules) ──\n`;
		const fix = suggestCycleFixes(cycle, graph, basePath);
		output += formatCycleFix(fix);
	});

	if (cycles.length > 5) {
		output += `\n... and ${cycles.length - 5} more cycles\n`;
		output += 'Run with --all to see all cycles\n';
	}

	return output;
}
