#!/usr/bin/env node
/**
 * Architecture Metrics Collection Script
 * Collects architectural health metrics and saves to JSON
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getTypeScriptFiles, extractImports } from '../../src/test/structural/helpers/dependencyParser';
import { buildDependencyGraph, detectCycles, getCouplingMetrics, getHighFanOutModules } from '../../src/test/structural/helpers/graphBuilder';
import { createViolationReport, addViolation, getViolationStats } from '../../src/test/structural/helpers/reporter';
import type { Violation } from '../../src/test/structural/helpers/reporter';

const SRC_DIR = path.resolve(__dirname, '../../src/lib');
const WEBVIEW_DIR = path.resolve(__dirname, '../../src/webview');
const METRICS_DIR = path.resolve(__dirname, '../../.arch-metrics');

interface ArchitectureMetrics {
	timestamp: string;
	version: string;
	summary: {
		totalFiles: number;
		totalViolations: number;
		errors: number;
		warnings: number;
		info: number;
	};
	violations: {
		byPattern: Record<string, number>;
		topFiles: Array<{ file: string; count: number }>;
	};
	dependencies: {
		totalDependencies: number;
		circularDependencies: number;
		highFanOutModules: number;
		avgFanOut: number;
	};
	coupling: {
		avgInstability: number;
		unstableFoundationModules: number;
	};
	health: {
		score: number;
		grade: 'A' | 'B' | 'C' | 'D' | 'F';
		trend: 'improving' | 'stable' | 'degrading' | 'unknown';
	};
}

function ensureMetricsDir(): void {
	if (!fs.existsSync(METRICS_DIR)) {
		fs.mkdirSync(METRICS_DIR, { recursive: true });
	}
}

function collectViolationMetrics(): {
	report: ReturnType<typeof createViolationReport>;
	stats: ReturnType<typeof getViolationStats>;
} {
	const report = createViolationReport();
	
	// Scan all files
	const allFiles = [
		...getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]),
		...getTypeScriptFiles(WEBVIEW_DIR, [/\.test\.ts$/, /node_modules/])
	];

	// Check for foundation violations
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
				const violation: Violation = {
					file: file.replace(SRC_DIR, 'src/lib').replace(WEBVIEW_DIR, 'src/webview'),
					import: imp.source,
					line: imp.line,
					pattern: 'foundation-upward-deps'
				};
				addViolation(report, violation);
			}
		}
	}

	const stats = getViolationStats(report);
	return { report, stats };
}

function collectDependencyMetrics(): {
	totalDeps: number;
	cycles: number;
	highFanOut: number;
	avgFanOut: number;
} {
	const allFiles = [
		...getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]),
		...getTypeScriptFiles(WEBVIEW_DIR, [/\.test\.ts$/, /node_modules/])
	];

	const fileImports = allFiles.map(file => extractImports(file));
	const graph = buildDependencyGraph(fileImports);
	const cycles = detectCycles(graph);
	const highFanOut = getHighFanOutModules(graph, 20);

	let totalDeps = 0;
	for (const node of graph.nodes.values()) {
		totalDeps += node.dependencies.length;
	}

	const avgFanOut = graph.nodes.size > 0 ? totalDeps / graph.nodes.size : 0;

	return {
		totalDeps,
		cycles: cycles.length,
		highFanOut: highFanOut.length,
		avgFanOut: Math.round(avgFanOut * 100) / 100
	};
}

function collectCouplingMetrics(): {
	avgInstability: number;
	unstableFoundation: number;
} {
	const allFiles = getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]);
	const fileImports = allFiles.map(file => extractImports(file));
	const graph = buildDependencyGraph(fileImports);

	const foundationFiles = [
		...getTypeScriptFiles(path.join(SRC_DIR, 'types'), [/\.test\.ts$/, /node_modules/]),
		...getTypeScriptFiles(path.join(SRC_DIR, 'primitives'), [/\.test\.ts$/, /node_modules/])
	];

	let totalInstability = 0;
	let unstableCount = 0;

	for (const file of foundationFiles) {
		const metrics = getCouplingMetrics(graph, file);
		totalInstability += metrics.instability;
		if (metrics.instability > 0.3) {
			unstableCount++;
		}
	}

	const avgInstability = foundationFiles.length > 0 
		? Math.round((totalInstability / foundationFiles.length) * 100) / 100 
		: 0;

	return {
		avgInstability,
		unstableFoundation: unstableCount
	};
}

function calculateHealthScore(metrics: Omit<ArchitectureMetrics, 'health'>): number {
	let score = 100;

	// Deduct points for violations (max -50 points)
	score -= Math.min(50, metrics.summary.errors * 2);
	score -= Math.min(20, metrics.summary.warnings * 0.5);

	// Deduct points for circular dependencies (max -20 points)
	score -= Math.min(20, metrics.dependencies.circularDependencies * 5);

	// Deduct points for high fan-out (max -15 points)
	score -= Math.min(15, metrics.dependencies.highFanOutModules * 2);

	// Deduct points for unstable foundation (max -15 points)
	score -= Math.min(15, metrics.coupling.unstableFoundationModules * 3);

	return Math.max(0, Math.round(score));
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
	if (score >= 90) return 'A';
	if (score >= 80) return 'B';
	if (score >= 70) return 'C';
	if (score >= 60) return 'D';
	return 'F';
}

function getTrend(current: number, previous: number | null): 'improving' | 'stable' | 'degrading' | 'unknown' {
	if (previous === null) return 'unknown';
	const diff = current - previous;
	if (Math.abs(diff) < 5) return 'stable';
	return diff > 0 ? 'improving' : 'degrading';
}

function loadPreviousMetrics(): ArchitectureMetrics | null {
	const files = fs.readdirSync(METRICS_DIR).filter(f => f.startsWith('metrics-') && f.endsWith('.json'));
	if (files.length === 0) return null;

	files.sort().reverse();
	const latestFile = files[0];
	const content = fs.readFileSync(path.join(METRICS_DIR, latestFile), 'utf-8');
	return JSON.parse(content);
}

function getTopViolationFiles(stats: ReturnType<typeof getViolationStats>): Array<{ file: string; count: number }> {
	// This would require tracking violations per file - simplified for now
	return [];
}

async function main(): Promise<void> {
	console.log('🔍 Collecting architecture metrics...\n');

	ensureMetricsDir();

	const { stats } = collectViolationMetrics();
	const depMetrics = collectDependencyMetrics();
	const couplingMetrics = collectCouplingMetrics();

	const allFiles = [
		...getTypeScriptFiles(SRC_DIR, [/\.test\.ts$/, /node_modules/]),
		...getTypeScriptFiles(WEBVIEW_DIR, [/\.test\.ts$/, /node_modules/])
	];

	const metrics: Omit<ArchitectureMetrics, 'health'> = {
		timestamp: new Date().toISOString(),
		version: process.env.npm_package_version || '0.0.0',
		summary: {
			totalFiles: allFiles.length,
			totalViolations: stats.total,
			errors: stats.errors,
			warnings: stats.warnings,
			info: stats.info
		},
		violations: {
			byPattern: Object.fromEntries(stats.byPattern),
			topFiles: getTopViolationFiles(stats)
		},
		dependencies: {
			totalDependencies: depMetrics.totalDeps,
			circularDependencies: depMetrics.cycles,
			highFanOutModules: depMetrics.highFanOut,
			avgFanOut: depMetrics.avgFanOut
		},
		coupling: {
			avgInstability: couplingMetrics.avgInstability,
			unstableFoundationModules: couplingMetrics.unstableFoundation
		}
	};

	const score = calculateHealthScore(metrics);
	const previous = loadPreviousMetrics();
	const previousScore = previous?.health.score || null;

	const fullMetrics: ArchitectureMetrics = {
		...metrics,
		health: {
			score,
			grade: getGrade(score),
			trend: getTrend(score, previousScore)
		}
	};

	// Save metrics
	const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
	const filename = `metrics-${timestamp}.json`;
	const filepath = path.join(METRICS_DIR, filename);
	fs.writeFileSync(filepath, JSON.stringify(fullMetrics, null, 2));

	// Save latest snapshot
	fs.writeFileSync(
		path.join(METRICS_DIR, 'latest.json'),
		JSON.stringify(fullMetrics, null, 2)
	);

	console.log('📊 Metrics Summary:');
	console.log(`   Files:       ${metrics.summary.totalFiles}`);
	console.log(`   Violations:  ${stats.errors} errors, ${stats.warnings} warnings`);
	console.log(`   Cycles:      ${depMetrics.cycles}`);
	console.log(`   Health:      ${score}/100 (${fullMetrics.health.grade})`);
	console.log(`   Trend:       ${fullMetrics.health.trend}`);
	console.log(`\n✅ Metrics saved to ${filename}`);
}

main().catch(console.error);
