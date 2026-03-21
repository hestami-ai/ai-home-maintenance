/**
 * Primitive Safety
 *
 * Validates preconditions, checks plan safety, and enforces blocked sequences.
 */

import type { PrimitiveDefinition, ExecutionContext, PreconditionResult } from './types';
import { PrimitiveSafety } from './types';
import type { PrimitiveRegistry } from './registry';
import type { Plan, PlanStep } from '../orchestrator/types';

/**
 * Blocked sequences — primitive ID patterns that are never valid together.
 */
const BLOCKED_SEQUENCES: Array<{ pattern: string[]; reason: string }> = [
	{
		pattern: ['control.killAllProcesses', 'control.runWorkflowCycle'],
		reason: 'Killing processes then immediately re-running is contradictory',
	},
];

/**
 * Validate all preconditions for a primitive before execution.
 */
export function validatePreconditions(
	def: PrimitiveDefinition,
	params: Record<string, unknown>,
	ctx: ExecutionContext
): { valid: true } | { valid: false; violations: string[] } {
	if (!def.preconditions || def.preconditions.length === 0) {
		return { valid: true };
	}

	const violations: string[] = [];
	for (const check of def.preconditions) {
		const result: PreconditionResult = check(params, ctx);
		if (!result.ok) {
			violations.push(result.reason);
		}
	}

	return violations.length === 0
		? { valid: true }
		: { valid: false, violations };
}

/**
 * Find all RESTRICTED steps in a plan.
 */
export function findRestrictedSteps(
	plan: Plan,
	registry: PrimitiveRegistry
): PlanStep[] {
	return plan.steps.filter((step) => {
		const def = registry.get(step.primitiveId);
		return def?.safety === PrimitiveSafety.RESTRICTED;
	});
}

/**
 * Validate plan safety:
 * - All primitive IDs must exist in the registry
 * - No RESTRICTED primitives (blocked for orchestrator use)
 * - No blocked sequences
 * - Required params must be present (or be bind expressions)
 * - Step IDs must be unique
 * - Bind references must point to earlier steps
 */
export function validatePlanSafety(
	plan: Plan,
	registry: PrimitiveRegistry,
	_dialogueId: string
): { safe: true } | { safe: false; warnings: string[] } {
	const warnings: string[] = [];

	if (!plan.steps || plan.steps.length === 0) {
		return { safe: true }; // Empty plan is safe (no-op)
	}

	const stepIds = new Set<string>();
	const primitiveSequence: string[] = [];

	for (const step of plan.steps) {
		// Unique step IDs
		if (stepIds.has(step.id)) {
			warnings.push(`Duplicate step ID: ${step.id}`);
		}
		stepIds.add(step.id);

		// Primitive must exist
		const def = registry.get(step.primitiveId);
		if (!def) {
			warnings.push(`Unknown primitive: ${step.primitiveId}`);
			continue;
		}

		// No RESTRICTED primitives
		if (def.safety === PrimitiveSafety.RESTRICTED) {
			warnings.push(
				`Primitive "${step.primitiveId}" is RESTRICTED and cannot be used by the orchestrator`
			);
		}

		// Required params must be present
		for (const param of def.params) {
			if (param.required && !(param.name in step.params)) {
				// Allow if dialogueId — often supplied via $context.dialogueId
				if (param.name === 'dialogueId') {continue;}
				warnings.push(
					`Step "${step.id}": missing required param "${param.name}" for ${step.primitiveId}`
				);
			}
		}

		// Validate bind references point to earlier steps
		for (const [key, value] of Object.entries(step.params)) {
			if (typeof value === 'string' && value.startsWith('$') && !value.startsWith('$context.')) {
				const match = value.match(/^\$(\w+)\./);
				if (match && !stepIds.has(match[1])) {
					// The referenced step hasn't been defined yet (checking against steps seen so far,
					// but stepIds includes the current step too — we need to check excluding current)
					const priorIds = new Set(stepIds);
					priorIds.delete(step.id);
					if (!priorIds.has(match[1])) {
						warnings.push(
							`Step "${step.id}": bind "${value}" references step "${match[1]}" which hasn't executed yet`
						);
					}
				}
			}
		}

		primitiveSequence.push(step.primitiveId);
	}

	// Check blocked sequences
	for (const blocked of BLOCKED_SEQUENCES) {
		if (containsSubsequence(primitiveSequence, blocked.pattern)) {
			warnings.push(`Blocked sequence detected: ${blocked.reason}`);
		}
	}

	return warnings.length === 0
		? { safe: true }
		: { safe: false, warnings };
}

/**
 * Check if an array contains a subsequence (adjacent elements).
 */
function containsSubsequence(arr: string[], sub: string[]): boolean {
	for (let i = 0; i <= arr.length - sub.length; i++) {
		let match = true;
		for (let j = 0; j < sub.length; j++) {
			if (arr[i + j] !== sub[j]) {
				match = false;
				break;
			}
		}
		if (match) {return true;}
	}
	return false;
}
