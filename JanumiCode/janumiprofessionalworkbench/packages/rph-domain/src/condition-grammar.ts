// The execution-scoped condition grammar (JAN-EXECPLAN-DR-004 DWP-02, Tier 3C-ii). A FRESH, sponsor-granted (R1),
// declarative, replay-safe predicate over a plan's own committed step state — used to guard CONDITIONAL transition
// edges (BRANCH selection lands in DWP-03).
//
// HAND-AUTHORED, not vocab-generated: the object-schema generator cannot emit a discriminated union / recursive helper
// (it forces such helpers to `z.record` — cf. ApplicabilityExpression), so the contract's ExecutionTransition
// .conditionExpression stays an opaque jsonb envelope and THIS module is its typed interpretation layer (DR-004 §19-B1).
// UNRATIFIED-AUTHORED under R1, citing DOC-009 §10.3 (condition_expression jsonb) as the ratified envelope.
//
// Replay-safe by construction: the grammar is DATA (a discriminated union), never executable code; the evaluator is a
// pure function of (expr, subject); and the subject is folded ONLY from committed plan state + this plan's own event
// log (no wall-clock, no random, no cross-aggregate read). INV-5: a condition guards EXECUTION flow, never assurance.
import { z } from 'zod';

/** The numeric comparators available to count/threshold guards (the gap ApplicabilityExpression could not express). */
const NumericComparatorSchema = z.enum(['==', '>=', '>', '<', '<=']);
export type NumericComparator = z.infer<typeof NumericComparatorSchema>;

/** The condition grammar (a discriminated union tagged by `op`). Leaves read a step's committed facts; ALL/ANY/NOT
 *  combine. Recursive — hence the explicit type + `z.lazy`. */
export type ConditionExpression =
	| { op: 'STEP_STATE'; stepId: string; state: string }
	| { op: 'STEP_SUCCEEDED'; stepId: string }
	| { op: 'OUTPUT_COUNT'; stepId: string; cmp: NumericComparator; value: number }
	| { op: 'ATTEMPTS'; stepId: string; cmp: NumericComparator; value: number }
	| { op: 'RESULT_EQUALS'; stepId: string; path: string; value: string | number | boolean }
	| { op: 'ALL'; operands: ConditionExpression[] }
	| { op: 'ANY'; operands: ConditionExpression[] }
	| { op: 'NOT'; operand: ConditionExpression };

/** The Zod schema — hand-authored (the generator cannot produce this shape). `z.lazy` + the explicit annotation give a
 *  recursive discriminated union. Used at proposeExecutionPlan to REJECT a malformed conditionExpression. */
export const ConditionExpressionSchema: z.ZodType<ConditionExpression> = z.lazy(() =>
	z.discriminatedUnion('op', [
		z.strictObject({ op: z.literal('STEP_STATE'), stepId: z.string(), state: z.string() }),
		z.strictObject({ op: z.literal('STEP_SUCCEEDED'), stepId: z.string() }),
		z.strictObject({ op: z.literal('OUTPUT_COUNT'), stepId: z.string(), cmp: NumericComparatorSchema, value: z.number() }),
		z.strictObject({ op: z.literal('ATTEMPTS'), stepId: z.string(), cmp: NumericComparatorSchema, value: z.number() }),
		z.strictObject({
			op: z.literal('RESULT_EQUALS'),
			stepId: z.string(),
			path: z.string(),
			value: z.union([z.string(), z.number(), z.boolean()])
		}),
		z.strictObject({ op: z.literal('ALL'), operands: z.array(ConditionExpressionSchema) }),
		z.strictObject({ op: z.literal('ANY'), operands: z.array(ConditionExpressionSchema) }),
		z.strictObject({ op: z.literal('NOT'), operand: ConditionExpressionSchema })
	])
);

/** The projected, replay-safe subject an evaluation reads — one entry per step, folded from committed state + events. */
export interface ConditionSubjectStep {
	readonly stepState: string;
	readonly outputArtifactIds: readonly string[];
	readonly attemptsMade: number;
	readonly structuredResult?: unknown;
}
export interface ConditionSubject {
	readonly steps: Readonly<Record<string, ConditionSubjectStep>>;
}

/** The minimal event shape the subject fold reads (a subset of DomainEvent). */
export interface ConditionSubjectEvent {
	readonly eventType: string;
	readonly aggregateId: string;
	readonly payload: unknown;
}

function assertNever(x: never): never {
	throw new Error(`unhandled condition grammar case: ${JSON.stringify(x)}`);
}

function numericCompare(actual: number, cmp: NumericComparator, expected: number): boolean {
	switch (cmp) {
		case '==':
			return actual === expected;
		case '>=':
			return actual >= expected;
		case '>':
			return actual > expected;
		case '<':
			return actual < expected;
		case '<=':
			return actual <= expected;
		default:
			return assertNever(cmp);
	}
}

/** Resolve a dot-path (e.g. "review.outcome") against an opaque structuredResult; undefined if any segment is missing
 *  or a non-object is traversed. */
function resolvePath(root: unknown, path: string): unknown {
	let cur: unknown = root;
	for (const seg of path.split('.')) {
		if (cur === null || typeof cur !== 'object') return undefined;
		cur = (cur as Record<string, unknown>)[seg];
	}
	return cur;
}

/**
 * Evaluate a condition against a subject. PURE and total over the union (fail-loud on an impossible op via
 * assertNever). Replay-safe: reads only the projected subject. A missing step (bad ref — rejected at propose) yields a
 * conservative false for its leaf.
 */
export function evaluateCondition(expr: ConditionExpression, subject: ConditionSubject): boolean {
	const step = subject.steps[stepIdOf(expr)];
	switch (expr.op) {
		case 'STEP_STATE':
			return step?.stepState === expr.state;
		case 'STEP_SUCCEEDED':
			return step?.stepState === 'SUCCEEDED';
		case 'OUTPUT_COUNT':
			return numericCompare(step?.outputArtifactIds.length ?? 0, expr.cmp, expr.value);
		case 'ATTEMPTS':
			return numericCompare(step?.attemptsMade ?? 0, expr.cmp, expr.value);
		case 'RESULT_EQUALS':
			return resolvePath(step?.structuredResult, expr.path) === expr.value;
		case 'ALL':
			return expr.operands.every((o) => evaluateCondition(o, subject));
		case 'ANY':
			return expr.operands.some((o) => evaluateCondition(o, subject));
		case 'NOT':
			return !evaluateCondition(expr.operand, subject);
		default:
			return assertNever(expr);
	}
}

/** The stepId a LEAF references (empty for the combinators, whose steps come from their operands). */
function stepIdOf(expr: ConditionExpression): string {
	switch (expr.op) {
		case 'STEP_STATE':
		case 'STEP_SUCCEEDED':
		case 'OUTPUT_COUNT':
		case 'ATTEMPTS':
		case 'RESULT_EQUALS':
			return expr.stepId;
		default:
			return '';
	}
}

/** Every stepId a condition references (for propose-time ref-resolution: each must be a declared step). */
export function conditionStepRefs(expr: ConditionExpression): string[] {
	switch (expr.op) {
		case 'STEP_STATE':
		case 'STEP_SUCCEEDED':
		case 'OUTPUT_COUNT':
		case 'ATTEMPTS':
		case 'RESULT_EQUALS':
			return [expr.stepId];
		case 'ALL':
		case 'ANY':
			return expr.operands.flatMap(conditionStepRefs);
		case 'NOT':
			return conditionStepRefs(expr.operand);
		default:
			return assertNever(expr);
	}
}

/**
 * Fold a plan's committed steps + this plan's own event log into the evaluation subject (DWP-02/D4). Per step:
 * stepState (from the aggregate), outputArtifactIds + structuredResult (from its latest ExecutionStepSucceeded),
 * attemptsMade (count of ExecutionStepStarted — mirrors attemptsMadeForStep). Single-aggregate + committed-only ⇒
 * replay-pure; no cross-aggregate read, no clock, no random.
 */
export function buildConditionSubject(
	steps: readonly { readonly id: string; readonly stepState: string }[],
	events: readonly ConditionSubjectEvent[],
	planId: string
): ConditionSubject {
	const acc = new Map<
		string,
		{ stepState: string; outputArtifactIds: string[]; attemptsMade: number; structuredResult?: unknown }
	>();
	for (const s of steps) acc.set(s.id, { stepState: s.stepState, outputArtifactIds: [], attemptsMade: 0 });
	for (const e of events) {
		if (e.aggregateId !== planId) continue;
		const p = (e.payload ?? {}) as Record<string, unknown>;
		if (e.eventType === 'ExecutionStepStarted') {
			const rec = acc.get(String(p.stepId ?? ''));
			if (rec) rec.attemptsMade += 1;
		} else if (e.eventType === 'ExecutionStepSucceeded') {
			const rec = acc.get(String(p.executionStepId ?? ''));
			if (rec) {
				rec.outputArtifactIds = Array.isArray(p.outputArtifactIds)
					? p.outputArtifactIds.map((x) => String(x))
					: [];
				rec.structuredResult = p.structuredResult;
			}
		}
	}
	const out: Record<string, ConditionSubjectStep> = {};
	for (const [id, rec] of acc) out[id] = rec;
	return { steps: out };
}
