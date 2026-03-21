/**
 * Plan Executor (Tier 2.5)
 *
 * Takes a validated Plan and executes it step-by-step:
 *  1. Static safety validation (unknown primitives, RESTRICTED, blocked sequences)
 *  2. Show plan summary to user
 *  3. Sequential execution with bind resolution, conditions, preconditions
 *  4. Stop on first failure, return results
 */

import type { Plan, PlanStep, StepExecutionResult, PlanExecutionResult } from './types';
import type { ExecutionContext, UIChannel } from '../primitives/types';
import { getPrimitiveRegistry } from '../primitives/registry';
import { validatePlanSafety, validatePreconditions } from '../primitives/safety';
import { getLogger, isLoggerInitialized } from '../logging';

/**
 * Execute a plan against the primitive registry.
 *
 * @returns PlanExecutionResult with per-step results and overall success.
 */
export async function executePlan(
	plan: Plan,
	dialogueId: string,
	uiChannel: UIChannel,
): Promise<PlanExecutionResult> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'orchestrator:executor' })
		: null;

	const registry = getPrimitiveRegistry();

	// ── Step 1: Static safety validation ──────────────────────────
	const safety = validatePlanSafety(plan, registry, dialogueId);
	if (!safety.safe) {
		const msg = `Plan rejected: ${safety.warnings.join('; ')}`;
		log?.warn('Orchestrator: plan failed safety check', { warnings: safety.warnings });
		uiChannel.postSystemMessage(msg);
		return {
			plan,
			steps: [],
			success: false,
			summary: msg,
		};
	}

	// ── Step 2: Show plan to user ─────────────────────────────────
	const planSummary = plan.steps
		.map((s, i) => `${i + 1}. ${s.reason}`)
		.join('\n');
	uiChannel.postSystemMessage(
		`**Plan** — ${plan.intent}\n${planSummary}`
	);

	// ── Step 3: Execute steps sequentially ────────────────────────
	const ctx: ExecutionContext = {
		dialogueId,
		stepResults: new Map(),
		uiChannel,
	};

	const stepResults: StepExecutionResult[] = [];

	for (const step of plan.steps) {
		// 3a. Evaluate condition (skip if false)
		if (step.condition) {
			const condResult = evaluateCondition(step.condition, ctx);
			if (!condResult) {
				log?.debug(`Orchestrator: skipping step ${step.id} — condition false`);
				stepResults.push({
					stepId: step.id,
					primitiveId: step.primitiveId,
					success: true,
					skipped: true,
				});
				continue;
			}
		}

		// 3b. Resolve bind expressions in params
		const resolvedParams = resolveBinds(step.params, ctx);

		// 3c. Look up primitive
		const def = registry.get(step.primitiveId);
		if (!def) {
			// Should not happen — safety check passed — but handle defensively
			const err = `Unknown primitive: ${step.primitiveId}`;
			stepResults.push({
				stepId: step.id,
				primitiveId: step.primitiveId,
				success: false,
				error: err,
			});
			log?.error(`Orchestrator: ${err}`);
			return buildResult(plan, stepResults, false, err);
		}

		// 3d. Check preconditions
		const precheck = validatePreconditions(def, resolvedParams, ctx);
		if (!precheck.valid) {
			const err = `Precondition failed for ${step.primitiveId}: ${precheck.violations.join('; ')}`;
			stepResults.push({
				stepId: step.id,
				primitiveId: step.primitiveId,
				success: false,
				error: err,
			});
			log?.warn(`Orchestrator: ${err}`);
			return buildResult(plan, stepResults, false, err);
		}

		// 3e. Execute
		try {
			const result = await def.execute(resolvedParams, ctx);

			if (result.success) {
				ctx.stepResults.set(step.id, result.value);
				stepResults.push({
					stepId: step.id,
					primitiveId: step.primitiveId,
					success: true,
					value: result.value,
				});
				log?.debug(`Orchestrator: step ${step.id} succeeded`);
			} else {
				const err = result.error instanceof Error
					? result.error.message
					: String(result.error);
				stepResults.push({
					stepId: step.id,
					primitiveId: step.primitiveId,
					success: false,
					error: err,
				});
				log?.warn(`Orchestrator: step ${step.id} failed`, { error: err });
				return buildResult(plan, stepResults, false, `Step "${step.id}" (${step.primitiveId}) failed: ${err}`);
			}
		} catch (thrown) {
			const err = thrown instanceof Error ? thrown.message : String(thrown);
			stepResults.push({
				stepId: step.id,
				primitiveId: step.primitiveId,
				success: false,
				error: err,
			});
			log?.error(`Orchestrator: step ${step.id} threw`, { error: err });
			return buildResult(plan, stepResults, false, `Step "${step.id}" threw: ${err}`);
		}
	}

	// ── Step 4: All steps succeeded ──────────────────────────────
	return buildResult(plan, stepResults, true, plan.expectedOutcome);
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildResult(
	plan: Plan,
	steps: StepExecutionResult[],
	success: boolean,
	summary: string,
): PlanExecutionResult {
	return { plan, steps, success, summary };
}

/**
 * Resolve bind expressions in step params.
 *
 * - `$context.dialogueId` → ctx.dialogueId
 * - `$s1.value.fieldName` → ctx.stepResults.get('s1').fieldName
 * - `$s1.value.0.gate_id` → ctx.stepResults.get('s1')[0].gate_id
 * - Literals pass through unchanged
 */
function resolveBinds(
	params: Record<string, unknown>,
	ctx: ExecutionContext,
): Record<string, unknown> {
	const resolved: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(params)) {
		if (typeof value === 'string' && value.startsWith('$')) {
			resolved[key] = resolveBind(value, ctx);
		} else if (value && typeof value === 'object' && !Array.isArray(value)) {
			// Recurse into nested objects
			resolved[key] = resolveBinds(value as Record<string, unknown>, ctx);
		} else {
			resolved[key] = value;
		}
	}

	return resolved;
}

/**
 * Resolve a single bind expression.
 */
function resolveBind(expr: string, ctx: ExecutionContext): unknown {
	// $context.dialogueId
	if (expr === '$context.dialogueId') {
		return ctx.dialogueId;
	}

	// $sN.value.path.to.field
	const match = expr.match(/^\$(\w+)\.value(?:\.(.+))?$/);
	if (!match) {
		return expr; // Not a valid bind — return as-is
	}

	const [, stepId, path] = match;
	const stepValue = ctx.stepResults.get(stepId);
	if (stepValue === undefined) {
		return undefined;
	}

	if (!path) {
		return stepValue;
	}

	// Navigate the path: "0.gate_id" → [0].gate_id
	return navigatePath(stepValue, path);
}

/**
 * Navigate a dot-separated path into an object/array.
 * Supports numeric indices for arrays.
 */
function navigatePath(obj: unknown, path: string): unknown {
	const segments = path.split('.');
	let current: unknown = obj;

	for (const seg of segments) {
		if (current === null || current === undefined) {return undefined;}

		if (typeof current === 'object') {
			// Try numeric index for arrays
			const idx = Number(seg);
			if (Array.isArray(current) && !isNaN(idx)) {
				current = current[idx];
			} else {
				current = (current as Record<string, unknown>)[seg];
			}
		} else {
			return undefined;
		}
	}

	return current;
}

/**
 * Evaluate a simple condition expression.
 *
 * Supported forms:
 * - `$s1.value.length > 0`
 * - `$s1.value != null`
 * - `$s1.value.metadata.lastFailedPhase != null`
 * - `$s1.value == true`
 */
function evaluateCondition(condition: string, ctx: ExecutionContext): boolean {
	// Parse: <expr> <op> <rhs>
	const opMatch = condition.match(/^(.+?)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
	if (!opMatch) {
		// If we can't parse, treat as truthy check on the expression
		const val = resolveBind(condition.trim(), ctx);
		return !!val;
	}

	const [, lhsExpr, op, rhsRaw] = opMatch;
	const lhs = resolveBind(lhsExpr.trim(), ctx);
	const rhs = parseRhs(rhsRaw.trim());

	switch (op) {
		case '==': return lhs === rhs || ((lhs === null || lhs === undefined) && (rhs === null || rhs === undefined));
		case '!=': return lhs !== rhs && !((lhs === null || lhs === undefined) && (rhs === null || rhs === undefined));
		case '>': return Number(lhs) > Number(rhs);
		case '<': return Number(lhs) < Number(rhs);
		case '>=': return Number(lhs) >= Number(rhs);
		case '<=': return Number(lhs) <= Number(rhs);
		default: return true;
	}
}

/**
 * Parse a right-hand-side literal from a condition expression.
 */
function parseRhs(raw: string): unknown {
	if (raw === 'null') {return null;}
	if (raw === 'undefined') {return undefined;}
	if (raw === 'true') {return true;}
	if (raw === 'false') {return false;}
	const num = Number(raw);
	if (!isNaN(num)) {return num;}
	// Strip quotes
	if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
		return raw.slice(1, -1);
	}
	return raw;
}
