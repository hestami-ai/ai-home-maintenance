/**
 * Enhanced Test Reporter
 * Provides actionable violation reporting with severity levels and fix suggestions
 */

import type { ViolationSeverity } from './violationDocs';
import { getViolationFix, formatViolation } from './violationDocs';

export interface Violation {
	file: string;
	import?: string;
	line?: number;
	pattern: string;
	reason?: string;
}

export interface ViolationReport {
	errors: Violation[];
	warnings: Violation[];
	info: Violation[];
}

/**
 * Create empty violation report
 */
export function createViolationReport(): ViolationReport {
	return {
		errors: [],
		warnings: [],
		info: [],
	};
}

/**
 * Add violation to report
 */
export function addViolation(
	report: ViolationReport,
	violation: Violation,
	severity?: ViolationSeverity
): void {
	const fix = getViolationFix(violation.pattern);
	const actualSeverity = severity || fix?.severity || 'error';

	if (actualSeverity === 'error') {
		report.errors.push(violation);
	} else if (actualSeverity === 'warn') {
		report.warnings.push(violation);
	} else {
		report.info.push(violation);
	}
}

/**
 * Format full violation report with fix suggestions
 */
export function formatViolationReport(
	report: ViolationReport,
	options: {
		showFixes?: boolean;
		maxViolationsPerType?: number;
	} = {}
): string {
	const { showFixes = true, maxViolationsPerType = 10 } = options;

	let output = '\n';
	output += '═══════════════════════════════════════════════════════\n';
	output += '         ARCHITECTURAL VIOLATIONS REPORT\n';
	output += '═══════════════════════════════════════════════════════\n';

	// Summary
	const totalErrors = report.errors.length;
	const totalWarnings = report.warnings.length;
	const totalInfo = report.info.length;
	const total = totalErrors + totalWarnings + totalInfo;

	output += '\nSUMMARY:\n';
	output += `  ❌ Errors:   ${totalErrors} (blocks build)\n`;
	output += `  ⚠️  Warnings: ${totalWarnings} (technical debt)\n`;
	output += `  ℹ️  Info:     ${totalInfo} (informational)\n`;
	output += `  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
	output += `  Total:      ${total}\n`;

	if (total === 0) {
		output += '\n✅ No violations found! Architecture is clean.\n';
		return output;
	}

	// Errors
	if (totalErrors > 0) {
		output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
		output += '❌ ERRORS (must fix immediately)\n';
		output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

		const displayErrors = report.errors.slice(0, maxViolationsPerType);
		displayErrors.forEach((violation, index) => {
			const fix = getViolationFix(violation.pattern);
			if (showFixes && fix) {
				output += formatViolation(violation, fix);
			} else {
				output += `\n${index + 1}. ${violation.file}`;
				if (violation.import) {
					output += ` → ${violation.import}`;
				}
				output += '\n';
			}
		});

		if (totalErrors > maxViolationsPerType) {
			output += `\n... and ${totalErrors - maxViolationsPerType} more errors (run with --verbose to see all)\n`;
		}
	}

	// Warnings
	if (totalWarnings > 0) {
		output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
		output += '⚠️  WARNINGS (should fix soon)\n';
		output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

		const displayWarnings = report.warnings.slice(0, maxViolationsPerType);
		displayWarnings.forEach((violation, index) => {
			const fix = getViolationFix(violation.pattern);
			if (showFixes && fix) {
				output += formatViolation(violation, fix);
			} else {
				output += `\n${index + 1}. ${violation.file}`;
				if (violation.import) {
					output += ` → ${violation.import}`;
				}
				output += '\n';
			}
		});

		if (totalWarnings > maxViolationsPerType) {
			output += `\n... and ${totalWarnings - maxViolationsPerType} more warnings\n`;
		}
	}

	// Info
	if (totalInfo > 0) {
		output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
		output += 'ℹ️  INFO (for awareness)\n';
		output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

		output += `\n${totalInfo} informational items detected.\n`;
		output += 'Run with --verbose to see details.\n';
	}

	output += '\n═══════════════════════════════════════════════════════\n';

	return output;
}

/**
 * Group violations by pattern
 */
export function groupViolationsByPattern(violations: Violation[]): Map<string, Violation[]> {
	const grouped = new Map<string, Violation[]>();

	for (const violation of violations) {
		const existing = grouped.get(violation.pattern) || [];
		existing.push(violation);
		grouped.set(violation.pattern, existing);
	}

	return grouped;
}

/**
 * Get violation summary stats
 */
export function getViolationStats(report: ViolationReport): {
	total: number;
	errors: number;
	warnings: number;
	info: number;
	byPattern: Map<string, number>;
} {
	const allViolations = [...report.errors, ...report.warnings, ...report.info];
	const byPattern = new Map<string, number>();

	for (const violation of allViolations) {
		byPattern.set(violation.pattern, (byPattern.get(violation.pattern) || 0) + 1);
	}

	return {
		total: allViolations.length,
		errors: report.errors.length,
		warnings: report.warnings.length,
		info: report.info.length,
		byPattern,
	};
}

/**
 * Check if violations meet threshold
 */
export function meetsThreshold(
	report: ViolationReport,
	thresholds: {
		maxErrors?: number;
		maxWarnings?: number;
		maxInfo?: number;
	}
): boolean {
	const { maxErrors = 0, maxWarnings = Infinity, maxInfo = Infinity } = thresholds;

	return (
		report.errors.length <= maxErrors &&
		report.warnings.length <= maxWarnings &&
		report.info.length <= maxInfo
	);
}
