/**
 * Bounded Repair Engine
 *
 * Classifies repair safety, checks budget constraints, and executes
 * bounded repair attempts for failed task units. Implements the
 * conservative repair policy from the Bounded Repair guidance doc.
 *
 * Policy: max 1 auto-repair attempt, max 2 total attempts per unit,
 * max 20 min wall-clock, immediate escalation for security/data/ambiguity.
 */

import { spawn } from 'node:child_process';
import type { Result } from '../types';
import type {
	TaskUnit,
	ValidationPacket,
	RepairPacket,
} from '../types/maker';
import {
	FailureType,
	RepairClassification,
	RepairResult,
	REPAIR_POLICY,
	SAFE_AUTO_REPAIR_TYPES,
	ALWAYS_ESCALATE_TYPES,
} from '../types/maker';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import { buildStdinContent } from '../cli/types';
import { createRepairPacket, getRepairPacketsForUnit } from '../database/makerStore';

const IS_WINDOWS = process.platform === 'win32';

// ==================== CLASSIFICATION ====================

/**
 * Classify whether a failure is safe to auto-repair, conditional, or must escalate.
 */
export function classifyRepairability(
	failureType: FailureType,
	_unit: TaskUnit,
	existingRepairs: RepairPacket[]
): RepairClassification {
	// Always escalate these failure types regardless
	if (ALWAYS_ESCALATE_TYPES.has(failureType)) {
		return RepairClassification.ESCALATE_REQUIRED;
	}

	// Escalate on repeated failure (same unit already had a repair attempt)
	if (existingRepairs.length > 0 && REPAIR_POLICY.escalate_on_repeated_failure) {
		return RepairClassification.ESCALATE_REQUIRED;
	}

	// Safe auto-repair for mechanical/local failures
	if (SAFE_AUTO_REPAIR_TYPES.has(failureType)) {
		return RepairClassification.AUTO_REPAIR_SAFE;
	}

	// Everything else is conditional (deferred in Phase 1 to escalation)
	return RepairClassification.CONDITIONAL;
}

// ==================== BUDGET CHECK ====================

/**
 * Check if a repair attempt is allowed within the budget constraints.
 */
export function canAttemptRepair(
	unit: TaskUnit,
	existingRepairs: RepairPacket[],
	executionStartTime: number
): { allowed: boolean; reason?: string } {
	// Check total attempt count
	if (existingRepairs.length >= REPAIR_POLICY.max_attempts_per_unit) {
		return {
			allowed: false,
			reason: `Maximum attempts (${REPAIR_POLICY.max_attempts_per_unit}) reached for unit "${unit.label}".`,
		};
	}

	// Check auto-repair count
	const autoRepairs = existingRepairs.filter(
		(r) => r.escalation_threshold === RepairClassification.AUTO_REPAIR_SAFE
	);
	if (autoRepairs.length >= REPAIR_POLICY.max_auto_repairs_per_unit) {
		return {
			allowed: false,
			reason: `Maximum auto-repairs (${REPAIR_POLICY.max_auto_repairs_per_unit}) reached for unit "${unit.label}".`,
		};
	}

	// Check wall-clock time
	const elapsedMs = Date.now() - executionStartTime;
	const maxMs = REPAIR_POLICY.max_minutes_per_unit * 60 * 1000;
	if (elapsedMs > maxMs) {
		return {
			allowed: false,
			reason: `Wall-clock limit (${REPAIR_POLICY.max_minutes_per_unit} min) exceeded for unit "${unit.label}".`,
		};
	}

	return { allowed: true };
}

// ==================== REPAIR EXECUTION ====================

/**
 * Execute a bounded repair attempt for a failed task unit.
 *
 * 1. Snapshot pre-repair state (git diff of max_change_scope)
 * 2. Build repair prompt from validation failure + suspected cause
 * 3. Invoke provider with constrained scope
 * 4. Capture post-repair diff
 * 5. Create and persist RepairPacket
 */
export async function attemptRepair(
	unit: TaskUnit,
	validation: ValidationPacket,
	classification: RepairClassification,
	provider: RoleCLIProvider,
	workspaceRoot: string
): Promise<Result<RepairPacket>> {
	const startTime = Date.now();

	try {
		// Get existing repair count for this unit
		const existingResult = getRepairPacketsForUnit(unit.unit_id);
		const existingCount = existingResult.success ? existingResult.value.length : 0;

		// Snapshot pre-repair state
		const diffBefore = await captureGitDiff(unit.max_change_scope, workspaceRoot);

		// Build repair prompt
		const suspectedCause = inferSuspectedCause(validation);
		const repairPrompt = buildRepairPrompt(unit, validation, suspectedCause);

		const stdinContent = buildStdinContent(REPAIR_SYSTEM_PROMPT, repairPrompt);

		// Invoke provider with timeout based on remaining budget
		const timeout = Math.min(
			REPAIR_POLICY.max_minutes_per_unit * 60 * 1000,
			300000 // 5 min max per single repair invocation
		);

		const invokeResult = await provider.invoke({
			stdinContent,
			workingDirectory: workspaceRoot,
			outputFormat: 'text',
			timeout,
		});

		const wallClockMs = Date.now() - startTime;

		// Capture post-repair diff
		const diffAfter = await captureGitDiff(unit.max_change_scope, workspaceRoot);

		// Determine result
		let result: RepairResult;
		if (!invokeResult.success) {
			result = RepairResult.FAILED;
		} else if (wallClockMs > REPAIR_POLICY.max_minutes_per_unit * 60 * 1000) {
			result = RepairResult.TIMED_OUT;
		} else {
			// Repair invocation succeeded — the caller must re-validate to confirm FIXED
			result = RepairResult.PARTIALLY_FIXED;
		}

		// Persist repair packet
		const repairStrategy = classification === RepairClassification.AUTO_REPAIR_SAFE
			? `Auto-repair for ${validation.failure_type ?? 'unknown'} failure`
			: `Conditional repair attempt for ${validation.failure_type ?? 'unknown'} failure`;

		const packetResult = createRepairPacket(unit.unit_id, {
			suspected_cause: suspectedCause,
			repair_strategy: repairStrategy,
			attempt_count: existingCount + 1,
			max_attempts: REPAIR_POLICY.max_attempts_per_unit,
			escalation_threshold: classification,
			diff_before: diffBefore,
			diff_after: diffAfter,
			result,
			wall_clock_ms: wallClockMs,
		});

		if (!packetResult.success) {
			return { success: false, error: packetResult.error };
		}

		return { success: true, value: packetResult.value };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Repair attempt failed'),
		};
	}
}

// ==================== REPAIR PROMPT ====================

const REPAIR_SYSTEM_PROMPT = `You are the REPAIR agent for JanumiCode.

Your job is to fix a specific, bounded validation failure for a single task unit.

# Constraints
- Fix ONLY the specific failure described below
- Do NOT expand scope beyond the declared max_change_scope
- Do NOT change acceptance criteria or postconditions
- Do NOT add new features or refactor unrelated code
- Do NOT touch protected areas (auth, security, tenancy, migrations) unless the unit is explicitly about those
- Keep changes minimal and local

# Output
Apply the fix directly. No explanation needed — just make the code changes.`;

/**
 * Build the user prompt for a repair invocation.
 */
export function buildRepairPrompt(
	unit: TaskUnit,
	validation: ValidationPacket,
	suspectedCause: string
): string {
	const failedChecks = validation.checks.filter((c) => !c.passed);

	const sections: string[] = [];

	sections.push(`# Task Unit
Label: ${unit.label}
Goal: ${unit.goal}
Max Change Scope: ${unit.max_change_scope}`);

	sections.push(`# Validation Failure
Type: ${validation.failure_type ?? 'UNKNOWN'}
Suspected Cause: ${suspectedCause}`);

	sections.push(`# Failed Checks
${failedChecks.map((c) => `## ${c.check_type}: ${c.command}
Exit Code: ${c.exit_code}
Output (excerpt):
\`\`\`
${c.stdout_excerpt}
\`\`\``).join('\n\n')}`);

	sections.push(`# Postconditions (must remain true)
${unit.postconditions.map((p) => `- ${p}`).join('\n') || '(none)'}`);

	sections.push('Fix the validation failure. Stay within the declared scope.');

	return sections.join('\n\n');
}

// ==================== HELPERS ====================

/**
 * Infer a suspected cause from the validation results.
 */
function inferSuspectedCause(validation: ValidationPacket): string {
	const failedChecks = validation.checks.filter((c) => !c.passed);
	if (failedChecks.length === 0) {
		return 'Unknown validation failure';
	}

	const first = failedChecks[0];
	const output = first.stdout_excerpt.toLowerCase();

	switch (validation.failure_type) {
		case FailureType.LINT_ERROR:
			return `Lint errors detected in ${first.command}`;
		case FailureType.FORMAT_ERROR:
			return 'Code formatting does not match project conventions';
		case FailureType.IMPORT_RESOLUTION:
			return extractImportError(output) || 'Unresolved import or missing module';
		case FailureType.LOCAL_TYPE_ERROR:
			return extractTypeError(output) || 'Type mismatch in modified code';
		case FailureType.GENERATED_ARTIFACT_STALE:
			return 'Generated artifacts are out of date after code changes';
		case FailureType.DETERMINISTIC_TEST_UPDATE:
			return 'Test expectations need updating after intentional code changes';
		default:
			return `Validation check "${first.check_type}" failed with exit code ${first.exit_code}`;
	}
}

function extractImportError(output: string): string | null {
	const match = output.match(/cannot find module ['"]([^'"]+)['"]/i)
		|| output.match(/has no exported member ['"]([^'"]+)['"]/i);
	return match ? `Cannot resolve: ${match[1]}` : null;
}

function extractTypeError(output: string): string | null {
	const match = output.match(/type '([^']+)' is not assignable to type '([^']+)'/i);
	return match ? `Type '${match[1]}' not assignable to '${match[2]}'` : null;
}

/**
 * Capture git diff for a specific scope within the workspace.
 */
async function captureGitDiff(scope: string, cwd: string): Promise<string> {
	try {
		const args = ['diff', '--', scope];
		const result = await execCommand(`git ${args.join(' ')}`, cwd, 10000);
		return result.stdout.substring(0, 5000); // Truncate to reasonable size
	} catch {
		return '(git diff unavailable)';
	}
}

function execCommand(
	command: string,
	cwd: string,
	timeout: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, [], {
			cwd,
			shell: true,
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout,
		});

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		proc.stdout!.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
		proc.stderr!.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

		proc.on('close', (code) => {
			resolve({
				stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
				stderr: Buffer.concat(stderrChunks).toString('utf-8'),
				exitCode: code ?? 1,
			});
		});

		proc.on('error', (err) => reject(err));
	});
}
