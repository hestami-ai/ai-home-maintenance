#!/usr/bin/env node
/**
 * Architecture Fix Suggestion Generator
 * Analyzes violations and generates actionable fix suggestions
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { getTypeScriptFiles, extractImports } from '../../src/test/structural/helpers/dependencyParser';
import { buildDependencyGraph, detectCycles } from '../../src/test/structural/helpers/graphBuilder';
import type { Violation } from '../../src/test/structural/helpers/reporter';
import { suggestCycleFixes } from '../../src/test/structural/helpers/cycleVisualizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '../../src/lib');
const WEBVIEW_DIR = path.resolve(__dirname, '../../src/webview');

interface FixSuggestion {
	priority: 'critical' | 'high' | 'medium' | 'low';
	category: string;
	title: string;
	description: string;
	affectedFiles: string[];
	suggestedActions: string[];
	estimatedEffort: 'small' | 'medium' | 'large';
}

function collectFoundationViolations(): Violation[] {
	const violations: Violation[] = [];
	const FORBIDDEN_PATHS = [
		'/ui/', '/webview/', '/workflow/', '/database/',
		'/roles/', '/orchestrator/', '/llm/', '/cli/'
	];

	const foundationFiles = [
		...getTypeScriptFiles(path.join(SRC_DIR, 'types'), [/\.test\.ts$/, /node_modules/]),
		...getTypeScriptFiles(path.join(SRC_DIR, 'primitives'), [/\.test\.ts$/, /node_modules/])
	];

	for (const file of foundationFiles) {
		const imports = extractImports(file);
		for (const imp of imports.imports) {
			if (FORBIDDEN_PATHS.some(p => imp.source.includes(p))) {
				violations.push({
					file: file.replace(SRC_DIR, 'src/lib').replace(WEBVIEW_DIR, 'src/webview'),
					import: imp.source,
					line: imp.line,
					pattern: 'foundation-upward-deps'
				});
			}
		}
	}

	return violations;
}

function generateFixSuggestions(): FixSuggestion[] {
	const suggestions: FixSuggestion[] = [];

	// 1. Foundation violations
	const foundationViolations = collectFoundationViolations();
	if (foundationViolations.length > 0) {
		const fileGroups = new Map<string, Violation[]>();
		for (const v of foundationViolations) {
			const existing = fileGroups.get(v.file) || [];
			existing.push(v);
			fileGroups.set(v.file, existing);
		}

		for (const [file, violations] of fileGroups) {
			suggestions.push({
				priority: 'critical',
				category: 'Foundation Integrity',
				title: `Move ${path.basename(file)} to correct layer`,
				description: `This file in foundation layer imports from ${violations.length} application layer(s). Foundation modules must have zero upward dependencies.`,
				affectedFiles: [file],
				suggestedActions: [
					`Analyze what ${path.basename(file)} does - is it truly a reusable primitive?`,
					`If it contains business logic, move to workflow/ or appropriate layer`,
					`If it's a type definition, ensure it only imports from types/ or stdlib`,
					`Extract any pure utilities that should remain in primitives/`
				],
				estimatedEffort: 'medium'
			});
		}
	}

	// 2. Circular dependencies
	const allFiles = [
		...getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]),
		...getTypeScriptFiles(WEBVIEW_DIR, [/\.test\.ts$/, /node_modules/])
	];
	const fileImports = allFiles.map(file => extractImports(file));
	const graph = buildDependencyGraph(fileImports);
	const cycles = detectCycles(graph);

	for (const cycle of cycles.slice(0, 5)) {
		const fix = suggestCycleFixes(cycle, graph, SRC_DIR);
		const topSuggestion = fix.suggestions[0];

		if (topSuggestion) {
			suggestions.push({
				priority: 'high',
				category: 'Circular Dependencies',
				title: `Break cycle: ${topSuggestion.from} ↔ ${topSuggestion.to}`,
				description: topSuggestion.reason,
				affectedFiles: fix.cycle,
				suggestedActions: [
					`Review the Mermaid diagram to visualize the cycle`,
					`${topSuggestion.action.toUpperCase()}: ${topSuggestion.reason}`,
					`Impact: ${topSuggestion.impact}`,
					`Consider extracting shared interfaces to a common module`
				],
				estimatedEffort: getEstimatedEffort(topSuggestion.impact)
			});
		}
	}

	// 3. High fan-out modules
	const highFanOut = [];
	for (const [modulePath, node] of graph.nodes.entries()) {
		if (node.dependencies.length > 20) {
			highFanOut.push({ path: modulePath, count: node.dependencies.length });
		}
	}

	for (const module of highFanOut.slice(0, 3)) {
		suggestions.push({
			priority: 'medium',
			category: 'God Module',
			title: `Refactor ${path.basename(module.path)} (${module.count} dependencies)`,
			description: `This module has ${module.count} dependencies, making it hard to maintain and test.`,
			affectedFiles: [module.path.replace(SRC_DIR, 'src/lib')],
			suggestedActions: [
				'Extract utility functions to primitives/ or shared/',
				'Use dependency injection instead of direct imports',
				'Split into smaller, focused modules',
				'Group related dependencies into higher-level abstractions'
			],
			estimatedEffort: 'large'
		});
	}

	// Sort by priority
	const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
	suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

	return suggestions;
}

function formatSuggestions(suggestions: FixSuggestion[]): string {
	let output = '\n';
	output += '╔═══════════════════════════════════════════════════════════╗\n';
	output += '║         ARCHITECTURE FIX SUGGESTIONS                      ║\n';
	output += '╚═══════════════════════════════════════════════════════════╝\n\n';

	if (suggestions.length === 0) {
		output += '✅ No fix suggestions - architecture is clean!\n';
		return output;
	}

	const critical = suggestions.filter(s => s.priority === 'critical');
	const high = suggestions.filter(s => s.priority === 'high');
	const medium = suggestions.filter(s => s.priority === 'medium');
	const low = suggestions.filter(s => s.priority === 'low');

	if (critical.length > 0) {
		output += '🚨 CRITICAL (fix immediately)\n';
		output += '═══════════════════════════════\n\n';
		critical.forEach((s, i) => {
			output += `${i + 1}. [${s.category}] ${s.title}\n`;
			output += `   ${s.description}\n\n`;
			output += `   Suggested actions:\n`;
			s.suggestedActions.forEach(action => {
				output += `   • ${action}\n`;
			});
			output += `\n   Affected files: ${s.affectedFiles.length}\n`;
			output += `   Estimated effort: ${s.estimatedEffort}\n\n`;
		});
	}

	if (high.length > 0) {
		output += '⚠️  HIGH PRIORITY (fix soon)\n';
		output += '═══════════════════════════════\n\n';
		high.forEach((s, i) => {
			output += `${i + 1}. [${s.category}] ${s.title}\n`;
			output += `   ${s.description}\n\n`;
			output += `   Suggested actions:\n`;
			s.suggestedActions.forEach(action => {
				output += `   • ${action}\n`;
			});
			output += `\n   Effort: ${s.estimatedEffort}\n\n`;
		});
	}

	if (medium.length > 0) {
		output += '📋 MEDIUM PRIORITY\n';
		output += '═══════════════════════════════\n\n';
		medium.slice(0, 5).forEach((s, i) => {
			output += `${i + 1}. [${s.category}] ${s.title}\n`;
			output += `   ${s.description}\n`;
			output += `   Effort: ${s.estimatedEffort}\n\n`;
		});
		if (medium.length > 5) {
			output += `   ... and ${medium.length - 5} more medium priority items\n\n`;
		}
	}

	output += '───────────────────────────────────────────────────────────\n';
	output += `Total suggestions: ${suggestions.length}\n`;
	output += `  Critical: ${critical.length} | High: ${high.length} | Medium: ${medium.length} | Low: ${low.length}\n`;
	output += '───────────────────────────────────────────────────────────\n\n';

	return output;
}

function getEstimatedEffort(impact: 'low' | 'medium' | 'high'): 'small' | 'medium' | 'large' {
	if (impact === 'low') {
		return 'small';
	}
	if (impact === 'medium') {
		return 'medium';
	}
	return 'large';
}

async function main(): Promise<void> {
	console.log('🔍 Analyzing architecture and generating fix suggestions...\n');

	const suggestions = generateFixSuggestions();
	console.log(formatSuggestions(suggestions));

	if (suggestions.length > 0) {
		console.log('💡 TIP: Run "pnpm run test:structure" to see detailed violation reports\n');
	}
}

main().catch(console.error);
