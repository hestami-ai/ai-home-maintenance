#!/usr/bin/env node
/**
 * Architecture Drift Detection Script
 * Compares current metrics against baseline and fails if architecture degrades
 */

import * as fs from 'fs';
import * as path from 'path';

const METRICS_DIR = path.resolve(__dirname, '../../.arch-metrics');
const DRIFT_THRESHOLD = 0.1; // 10% increase in violations

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
		grade: string;
		trend: string;
	};
}

function loadLatestMetrics(): ArchitectureMetrics | null {
	const latestPath = path.join(METRICS_DIR, 'latest.json');
	if (!fs.existsSync(latestPath)) {
		return null;
	}
	const content = fs.readFileSync(latestPath, 'utf-8');
	return JSON.parse(content);
}

function loadBaselineMetrics(): ArchitectureMetrics | null {
	const baselinePath = path.join(METRICS_DIR, 'baseline.json');
	if (!fs.existsSync(baselinePath)) {
		return null;
	}
	const content = fs.readFileSync(baselinePath, 'utf-8');
	return JSON.parse(content);
}

function detectDrift(current: ArchitectureMetrics, baseline: ArchitectureMetrics): {
	hasDrift: boolean;
	violations: string[];
	improvements: string[];
} {
	const violations: string[] = [];
	const improvements: string[] = [];

	// Check error increase
	const errorIncrease = current.summary.errors - baseline.summary.errors;
	if (errorIncrease > 0) {
		violations.push(`❌ Errors increased by ${errorIncrease} (${baseline.summary.errors} → ${current.summary.errors})`);
	} else if (errorIncrease < 0) {
		improvements.push(`✅ Errors decreased by ${Math.abs(errorIncrease)} (${baseline.summary.errors} → ${current.summary.errors})`);
	}

	// Check warning drift
	const warningIncrease = current.summary.warnings - baseline.summary.warnings;
	const warningThreshold = Math.ceil(baseline.summary.warnings * DRIFT_THRESHOLD);
	if (warningIncrease > warningThreshold) {
		violations.push(`⚠️  Warnings increased by ${warningIncrease}, exceeding threshold of ${warningThreshold} (${baseline.summary.warnings} → ${current.summary.warnings})`);
	} else if (warningIncrease < -5) {
		improvements.push(`✅ Warnings decreased by ${Math.abs(warningIncrease)} (${baseline.summary.warnings} → ${current.summary.warnings})`);
	}

	// Check circular dependencies
	const cycleIncrease = current.dependencies.circularDependencies - baseline.dependencies.circularDependencies;
	if (cycleIncrease > 0) {
		violations.push(`🔄 Circular dependencies increased by ${cycleIncrease} (${baseline.dependencies.circularDependencies} → ${current.dependencies.circularDependencies})`);
	} else if (cycleIncrease < 0) {
		improvements.push(`✅ Circular dependencies decreased by ${Math.abs(cycleIncrease)} (${baseline.dependencies.circularDependencies} → ${current.dependencies.circularDependencies})`);
	}

	// Check high fan-out modules
	const fanOutIncrease = current.dependencies.highFanOutModules - baseline.dependencies.highFanOutModules;
	if (fanOutIncrease > 2) {
		violations.push(`📦 High fan-out modules increased by ${fanOutIncrease} (${baseline.dependencies.highFanOutModules} → ${current.dependencies.highFanOutModules})`);
	}

	// Check health score degradation
	const scoreDrop = baseline.health.score - current.health.score;
	if (scoreDrop > 10) {
		violations.push(`💔 Health score dropped by ${scoreDrop} points (${baseline.health.score} → ${current.health.score})`);
	} else if (scoreDrop < -5) {
		improvements.push(`💚 Health score improved by ${Math.abs(scoreDrop)} points (${baseline.health.score} → ${current.health.score})`);
	}

	return {
		hasDrift: violations.length > 0,
		violations,
		improvements
	};
}

async function main(): Promise<void> {
	console.log('🔍 Detecting architecture drift...\n');

	const current = loadLatestMetrics();
	if (!current) {
		console.error('❌ No current metrics found. Run "pnpm run arch:metrics" first.');
		process.exit(1);
	}

	const baseline = loadBaselineMetrics();
	if (!baseline) {
		console.log('⚠️  No baseline found. Creating baseline from current metrics...');
		fs.writeFileSync(
			path.join(METRICS_DIR, 'baseline.json'),
			JSON.stringify(current, null, 2)
		);
		console.log('✅ Baseline created. Run this command again after making changes.');
		process.exit(0);
	}

	const drift = detectDrift(current, baseline);

	console.log('📊 Current vs Baseline:');
	console.log(`   Errors:      ${current.summary.errors} (baseline: ${baseline.summary.errors})`);
	console.log(`   Warnings:    ${current.summary.warnings} (baseline: ${baseline.summary.warnings})`);
	console.log(`   Cycles:      ${current.dependencies.circularDependencies} (baseline: ${baseline.dependencies.circularDependencies})`);
	console.log(`   Health:      ${current.health.score}/100 (baseline: ${baseline.health.score}/100)`);
	console.log();

	if (drift.improvements.length > 0) {
		console.log('✨ Improvements:');
		drift.improvements.forEach(imp => console.log(`   ${imp}`));
		console.log();
	}

	if (drift.hasDrift) {
		console.log('🚨 DRIFT DETECTED:');
		drift.violations.forEach(vio => console.log(`   ${vio}`));
		console.log();
		console.log('❌ Architecture has degraded. Please fix violations before merging.');
		process.exit(1);
	} else {
		console.log('✅ No significant drift detected. Architecture is stable.');
		if (drift.improvements.length > 0) {
			console.log('🎉 Architecture has improved!');
		}
		process.exit(0);
	}
}

main().catch(console.error);
