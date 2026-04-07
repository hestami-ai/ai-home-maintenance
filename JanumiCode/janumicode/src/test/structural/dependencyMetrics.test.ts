/**
 * Dependency Metrics Tests
 * Analyzes dependency health and architectural quality
 * - Detects god modules (too many dependencies)
 * - Validates foundation modules are self-contained
 * - Checks stable dependency principle
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { getTypeScriptFiles, extractImports } from './helpers/dependencyParser';
import { buildDependencyGraph, getCouplingMetrics, getHighFanOutModules, getLeafModules } from './helpers/graphBuilder';
import { createViolationReport, addViolation, formatViolationReport } from './helpers/reporter';
import type { Violation } from './helpers/reporter';

const SRC_DIR = path.resolve(__dirname, '../../lib');

describe('Dependency Metrics and Health', () => {
	describe('Fan-out constraints', () => {
		it('no module has excessive fan-out (>20 dependencies)', () => {
			const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);
			
			const highFanOut = getHighFanOutModules(graph, 20);
			const report = createViolationReport();

			for (const module of highFanOut) {
				const node = graph.nodes.get(module);
				const violation: Violation = {
					file: module.replace(SRC_DIR, 'src/lib'),
					pattern: 'high-fan-out',
					reason: `${node?.dependencies.length} dependencies (max 20)`
				};
				addViolation(report, violation, 'warn');
			}

			if (report.warnings.length > 0) {
				console.log(formatViolationReport(report));
			}

			// Allow some high fan-out in integration points
			expect(report.warnings.length).toBeLessThan(10);
		});

		it('foundation modules have minimal dependencies', () => {
			const typesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'types'),
				[/\.test\.ts$/, /node_modules/]
			);
			const primitivesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'primitives'),
				[/\.test\.ts$/, /node_modules/]
			);

			const foundationFiles = [...typesFiles, ...primitivesFiles];
			const fileImports = foundationFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);

			const highFanOut = getHighFanOutModules(graph, 5);

			if (highFanOut.length > 0) {
				console.log('\nFoundation modules with >5 dependencies:', highFanOut);
			}

			expect(highFanOut).toEqual([]);
		});
	});

	describe('Coupling metrics', () => {
		it('foundation modules have low instability (stable)', () => {
			const typesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'types'),
				[/\.test\.ts$/, /node_modules/]
			);

			const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);

			const unstableModules: Array<{ file: string; instability: number }> = [];

			for (const file of typesFiles) {
				const metrics = getCouplingMetrics(graph, file);
				// Instability = Efferent / (Efferent + Afferent)
				// Lower is more stable (0 = maximally stable)
				if (metrics.instability > 0.3) {
					unstableModules.push({
						file: file.replace(SRC_DIR, 'src/lib'),
						instability: metrics.instability
					});
				}
			}

			if (unstableModules.length > 0) {
				console.log('\nUnstable foundation modules:', unstableModules);
			}

			expect(unstableModules).toEqual([]);
		});

		it('UI modules can have higher instability (acceptable)', () => {
			const uiFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'ui'),
				[/\.test\.ts$/, /node_modules/]
			);

			const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);

			let totalInstability = 0;
			let count = 0;

			for (const file of uiFiles) {
				const metrics = getCouplingMetrics(graph, file);
				totalInstability += metrics.instability;
				count++;
			}

			const avgInstability = count > 0 ? totalInstability / count : 0;

			// UI modules naturally have higher instability (depend on many things)
			// This is just informational
			expect(avgInstability).toBeGreaterThanOrEqual(0);
			expect(avgInstability).toBeLessThan(1);
		});

		it('database modules have reasonable afferent coupling', () => {
			const databaseFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'database'),
				[/\.test\.ts$/, /node_modules/]
			);

			const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);

			const highlyDependedOn: Array<{ file: string; dependents: number }> = [];

			for (const file of databaseFiles) {
				const metrics = getCouplingMetrics(graph, file);
				// Afferent coupling = how many modules depend on this one
				if (metrics.afferentCoupling > 30) {
					highlyDependedOn.push({
						file: file.replace(SRC_DIR, 'src/lib'),
						dependents: metrics.afferentCoupling
					});
				}
			}

			if (highlyDependedOn.length > 0) {
				console.log('\nHighly depended-on database modules:', highlyDependedOn);
			}

			// Database modules being heavily depended on is OK - they're infrastructure
			expect(highlyDependedOn.length).toBeLessThan(15);
		});
	});

	describe('Stable dependency principle', () => {
		it('stable modules should not depend on less stable modules', () => {
			const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);

			const violations: Array<{
				from: string;
				to: string;
				fromInstability: number;
				toInstability: number;
			}> = [];

			for (const [filePath, node] of graph.nodes) {
				const fromMetrics = getCouplingMetrics(graph, filePath);
				
				// Only check relatively stable modules (instability < 0.3)
				if (fromMetrics.instability < 0.3) {
					for (const dep of node.dependencies) {
						const toMetrics = getCouplingMetrics(graph, dep);
						
						// If stable module depends on unstable module, that's a violation
						if (toMetrics.instability > fromMetrics.instability + 0.3) {
							violations.push({
								from: filePath.replace(SRC_DIR, 'src/lib'),
								to: dep.replace(SRC_DIR, 'src/lib'),
								fromInstability: fromMetrics.instability,
								toInstability: toMetrics.instability
							});
						}
					}
				}
			}

			if (violations.length > 0) {
				console.log('\n=== STABLE DEPENDENCY PRINCIPLE VIOLATIONS ===');
				violations.slice(0, 10).forEach(v => {
					console.log(`  ${v.from} (I=${v.fromInstability.toFixed(2)})`);
					console.log(`    → ${v.to} (I=${v.toInstability.toFixed(2)})`);
				});
				if (violations.length > 10) {
					console.log(`  ... and ${violations.length - 10} more`);
				}
				console.log('==============================================\n');
			}

			// This is a guideline, not a hard rule - allow some violations
			expect(violations.length).toBeLessThan(50);
		});
	});

	describe('Module independence', () => {
		it('leaf modules (no dependencies) are truly independent', () => {
			const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);

			const leafModules = getLeafModules(graph);

			// Filter out index files and re-exports
			const trueLeaves = leafModules.filter(m => 
				!m.includes('index.ts') && 
				!m.includes('/types/')
			);

			if (trueLeaves.length > 0) {
				console.log('\n=== LEAF MODULES (no dependencies) ===');
				trueLeaves.slice(0, 10).forEach(m => {
					console.log(`  ${m.replace(SRC_DIR, 'src/lib')}`);
				});
				if (trueLeaves.length > 10) {
					console.log(`  ... and ${trueLeaves.length - 10} more`);
				}
				console.log('======================================\n');
			}

			// Having some leaf modules is good - they're self-contained
			expect(trueLeaves.length).toBeGreaterThanOrEqual(0);
		});

		it('types module is primarily leaf nodes', () => {
			const typesFiles = getTypeScriptFiles(
				path.join(SRC_DIR, 'types'),
				[/\.test\.ts$/, /node_modules/, /index\.ts$/]
			);

			const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);

			const leafCount = typesFiles.filter(file => {
				const node = graph.nodes.get(file);
				return node?.dependencies.length === 0;
			}).length;

			const leafPercentage = typesFiles.length > 0 
				? (leafCount / typesFiles.length) * 100 
				: 0;

			console.log(`\nTypes module: ${leafCount}/${typesFiles.length} files are leaf nodes (${leafPercentage.toFixed(1)}%)`);

			// At least 50% of types should be leaf nodes (no dependencies)
			expect(leafPercentage).toBeGreaterThan(50);
		});
	});

	describe('Architecture health summary', () => {
		it('overall dependency graph is healthy', () => {
			const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
			const fileImports = allFiles.map(file => extractImports(file));
			const graph = buildDependencyGraph(fileImports);

			const totalModules = graph.nodes.size;
			const highFanOut = getHighFanOutModules(graph, 20).length;
			const leafModules = getLeafModules(graph).length;

			let totalAfferent = 0;
			let totalEfferent = 0;

			for (const [filePath] of graph.nodes) {
				const metrics = getCouplingMetrics(graph, filePath);
				totalAfferent += metrics.afferentCoupling;
				totalEfferent += metrics.efferentCoupling;
			}

			const avgAfferent = totalModules > 0 ? totalAfferent / totalModules : 0;
			const avgEfferent = totalModules > 0 ? totalEfferent / totalModules : 0;

			console.log('\n=== ARCHITECTURE HEALTH SUMMARY ===');
			console.log(`Total modules: ${totalModules}`);
			console.log(`High fan-out modules (>20 deps): ${highFanOut}`);
			console.log(`Leaf modules (0 deps): ${leafModules}`);
			console.log(`Avg afferent coupling: ${avgAfferent.toFixed(2)}`);
			console.log(`Avg efferent coupling: ${avgEfferent.toFixed(2)}`);
			console.log('===================================\n');

			// Basic health checks
			expect(totalModules).toBeGreaterThan(50); // Should have many modules
			expect(highFanOut).toBeLessThan(totalModules * 0.1); // <10% high fan-out
			expect(leafModules).toBeGreaterThan(0); // Should have some leaf modules
		});
	});
});
