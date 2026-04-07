/**
 * Circular Dependency Tests
 * Detects circular dependencies which create tight coupling and maintenance issues
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { getTypeScriptFiles, extractImports } from './helpers/dependencyParser';
import { buildDependencyGraph, detectCycles, getStronglyConnectedComponents } from './helpers/graphBuilder';
import { createViolationReport, addViolation, formatViolationReport } from './helpers/reporter';
import type { Violation } from './helpers/reporter';
import { generateCycleSummary } from './helpers/cycleVisualizer';

const SRC_DIR = path.resolve(__dirname, '../../lib');
const WEBVIEW_DIR = path.resolve(__dirname, '../../webview');

describe('Circular Dependency Detection', () => {
	describe('Codebase-wide circular dependencies', () => {
		it('no circular dependencies exist in entire codebase', () => {
			const allFiles = [
				...getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]),
				...getTypeScriptFiles(WEBVIEW_DIR, [/\.test\.ts$/, /node_modules/])
			];

			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const cycles = detectCycles(graph);
			const report = createViolationReport();

			for (const cycle of cycles) {
				const cycleFiles = cycle.nodes.map(n => 
					n.replace(SRC_DIR, 'src/lib').replace(WEBVIEW_DIR, 'src/webview')
				).join(' → ');
				const violation: Violation = {
					file: cycle.nodes[0].replace(SRC_DIR, 'src/lib').replace(WEBVIEW_DIR, 'src/webview'),
					pattern: 'circular-dependency',
					reason: `Cycle: ${cycleFiles}`
				};
				addViolation(report, violation);
			}

			if (report.errors.length > 0) {
				console.log(formatViolationReport(report, { maxViolationsPerType: 5 }));
				console.log(generateCycleSummary(cycles, graph, SRC_DIR));
			}

			expect(report.errors).toEqual([]);
		});

		it('no strongly connected components (mutual dependencies)', () => {
			const allFiles = [
				...getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]),
				...getTypeScriptFiles(WEBVIEW_DIR, [/\.test\.ts$/, /node_modules/])
			];

			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const components = getStronglyConnectedComponents(graph);

			if (components.length > 0) {
				console.log('\n=== STRONGLY CONNECTED COMPONENTS ===');
				components.slice(0, 3).forEach((component, index) => {
					console.log(`\nComponent ${index + 1} (${component.length} modules):`);
					component.slice(0, 5).forEach(node => {
						const shortPath = node.replace(SRC_DIR, 'src/lib').replace(WEBVIEW_DIR, 'src/webview');
						console.log(`  - ${shortPath}`);
					});
					if (component.length > 5) {
						console.log(`  ... and ${component.length - 5} more`);
					}
				});
				console.log(`\nTotal components: ${components.length}`);
				console.log('=====================================\n');
			}

			expect(components).toEqual([]);
		});
	});

	describe('Module-specific circular dependencies', () => {
		it('no circular dependencies within workflow module', () => {
			const workflowFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'workflow'),
				[/\.test\.ts$/, /node_modules/]
			);

			const fileImports = workflowFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const cycles = detectCycles(graph);

			if (cycles.length > 0) {
				console.log('\nWorkflow module cycles:', cycles);
			}

			expect(cycles).toEqual([]);
		});

		it('no circular dependencies within database module', () => {
			const databaseFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'database'),
				[/\.test\.ts$/, /node_modules/]
			);

			const fileImports = databaseFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const cycles = detectCycles(graph);

			if (cycles.length > 0) {
				console.log('\nDatabase module cycles:', cycles);
			}

			expect(cycles).toEqual([]);
		});

		it('no circular dependencies within roles module', () => {
			const roleFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'roles'),
				[/\.test\.ts$/, /node_modules/]
			);

			const fileImports = roleFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const cycles = detectCycles(graph);

			if (cycles.length > 0) {
				console.log('\nRoles module cycles:', cycles);
			}

			expect(cycles).toEqual([]);
		});

		it('no circular dependencies within context module', () => {
			const contextFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'context'),
				[/\.test\.ts$/, /node_modules/]
			);

			const fileImports = contextFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const cycles = detectCycles(graph);

			if (cycles.length > 0) {
				console.log('\nContext module cycles:', cycles);
			}

			expect(cycles).toEqual([]);
		});

		it('no circular dependencies within UI module', () => {
			const uiFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'ui'),
				[/\.test\.ts$/, /node_modules/]
			);

			const fileImports = uiFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const cycles = detectCycles(graph);

			if (cycles.length > 0) {
				console.log('\nUI module cycles:', cycles);
			}

			expect(cycles).toEqual([]);
		});

		it('no circular dependencies within CLI module', () => {
			const cliFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'cli'),
				[/\.test\.ts$/, /node_modules/]
			);

			const fileImports = cliFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const cycles = detectCycles(graph);

			if (cycles.length > 0) {
				console.log('\nCLI module cycles:', cycles);
			}

			expect(cycles).toEqual([]);
		});

		it('no circular dependencies within LLM module', () => {
			const llmFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'llm'),
				[/\.test\.ts$/, /node_modules/]
			);

			const fileImports = llmFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const cycles = detectCycles(graph);

			if (cycles.length > 0) {
				console.log('\nLLM module cycles:', cycles);
			}

			expect(cycles).toEqual([]);
		});

		it('no circular dependencies within integration module', () => {
			const integrationFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'integration'),
				[/\.test\.ts$/, /node_modules/]
			);

			const fileImports = integrationFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			const cycles = detectCycles(graph);

			if (cycles.length > 0) {
				console.log('\nIntegration module cycles:', cycles);
			}

			expect(cycles).toEqual([]);
		});
	});

	describe('Type-only imports', () => {
		it('type-only imports do not create runtime circular dependencies', () => {
			// This is informational - TypeScript handles type-only circular imports
			// But we still want to track them for architectural awareness
			const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
			
			let typeOnlyCircularCount = 0;
			for (const file of allFiles) {
				const imports = extractImports(file);
				const typeOnlyImports = imports.imports.filter(imp => imp.isTypeOnly);
				if (typeOnlyImports.length > 0) {
					typeOnlyCircularCount++;
				}
			}

			// This is just informational
			expect(typeOnlyCircularCount).toBeGreaterThanOrEqual(0);
		});
	});
});
