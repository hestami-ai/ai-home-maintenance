// The Execution Attempt read-model (JAN-EXECPLAN-DR-002 DWP-03 / DS-002 3B+3D, fork A = projection).
//
// Intent: fold the Execution* event stream into the ratified DOC-009 §10.4 `execution_attempts` shape — one record
// per bounded try (§9.7). Fork A ruled the Attempt is a PROJECTION, not a typed object (§16 item 23 withholds the
// contract object); the content (runtimeBindingId, executionProvenance, executionAttemptId) is already recorded ONCE
// on the ExecutionStep{Started,Succeeded,Failed} events, so this READS them and writes nothing — no second source of
// truth, no O(N²) plan-embedded state (staged design §5).
//
// Boundary (EP-CMT-4 — crosses the event-stream ↔ attempt-record seam):
//  • attempt_number = count(ExecutionStepStarted) for the step, ALONE. Each Started (QUEUED→RUNNING) opens one
//    attempt; ExecutionStepRetried is a re-queue MARKER, not an attempt — counting it double-counts every retry
//    (§19 L3-3). The next Started after a retry opens attempt n+1.
//  • idempotency_key = `${stepId}#${attemptNumber}` — the §10.4 uq_execution_idempotency functional key; a
//    deterministic function of (stepId, attempt_number), so it is unique per attempt and identical on replay.
//  • runtime_binding_id comes from the Started event (absent when the step opened unbound — recorded honestly).
//  • provenance comes from ExecutionStepSucceeded.executionProvenance — SUCCEEDED attempts only; a FAILED attempt
//    has no provenance on its event (§19 L3-8), so `provenance` is undefined there (a disclosed divergence from
//    §10.4's `provenance not null`, acceptable for a read-model).
//
// Do not change: stepType is NOT on the Execution* events (ExecutionPlanProposed carries only stepIds), so the
//   AI-no-binding advisory takes `stepTypeById` from the CALLER (which holds the plan aggregate). The advisory is
//   ADVISORY (display-only) — it gates nothing, mirroring the codebase's advisory posture.
//
// Pure + browser-safe (type-only contract import), like the rest of rph-projections.
import type { DomainEvent } from '@janumipwb/rph-contracts';

/** Step types whose bounded try is an AI/agent invocation (§9.7). Broader than the floor gate's AI_STEP_TYPES
 *  (MODEL_INVOCATION only) — a TOOL_INVOCATION is also an agent-mediated try, so its attempt should carry a
 *  runtime binding; this set is the ATTEMPT-advisory set, deliberately distinct from the floor-gate signal. */
const AI_STEP_TYPES: ReadonlySet<string> = new Set(['MODEL_INVOCATION', 'TOOL_INVOCATION']);

/** One Execution Attempt, shaped to DOC-009 §10.4 (a projection, not the physical table). */
export interface ExecutionAttemptView {
	readonly executionPlanId: string;
	readonly stepId: string;
	readonly attemptNumber: number;
	readonly idempotencyKey: string;
	readonly state: string;
	readonly runtimeBindingId?: string;
	readonly startedAt?: string;
	readonly completedAt?: string;
	readonly error?: string;
	readonly provenance?: unknown;
	/** Coherence advisory: an AI step opened this attempt with no recorded runtime_binding_id (display-only). */
	readonly aiNoBinding: boolean;
}

const asRec = (v: unknown): Record<string, unknown> =>
	v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** Mutable interim during the fold; frozen into ExecutionAttemptView on return. */
interface AttemptDraft {
	executionPlanId: string;
	stepId: string;
	attemptNumber: number;
	idempotencyKey: string;
	state: string;
	runtimeBindingId?: string;
	startedAt?: string;
	completedAt?: string;
	error?: string;
	provenance?: unknown;
}

const key = (planId: string, stepId: string): string => `${planId}::${stepId}`;

/** Mutable fold accumulators, threaded by reference through the per-event-type appliers. */
interface FoldState {
	attempts: AttemptDraft[];
	startedCount: Map<string, number>; // planId::stepId -> attempts opened so far
	current: Map<string, AttemptDraft>; // planId::stepId -> the open/latest attempt
}

/** ExecutionStepStarted (QUEUED→RUNNING): opens attempt n+1 for the step and records it as the current draft. */
function applyStepStarted(
	state: FoldState,
	event: DomainEvent,
	p: Record<string, unknown>,
	planId: string
): void {
	const stepId = str(p.stepId);
	if (!stepId) return;
	const k = key(planId, stepId);
	const n = (state.startedCount.get(k) ?? 0) + 1;
	state.startedCount.set(k, n);
	const draft: AttemptDraft = {
		executionPlanId: planId,
		stepId,
		attemptNumber: n,
		idempotencyKey: `${stepId}#${n}`,
		state: 'RUNNING',
		...(str(p.runtimeBindingId) ? { runtimeBindingId: str(p.runtimeBindingId) } : {}),
		...(str(event.occurredAt) ? { startedAt: str(event.occurredAt) } : {})
	};
	state.attempts.push(draft);
	state.current.set(k, draft);
}

/** ExecutionStepSucceeded: closes the step's current attempt as SUCCEEDED (§16.2 uses `executionStepId`). */
function applyStepSucceeded(
	state: FoldState,
	event: DomainEvent,
	p: Record<string, unknown>,
	planId: string
): void {
	const stepId = str(p.executionStepId);
	const draft = stepId ? state.current.get(key(planId, stepId)) : undefined;
	if (!draft) return;
	draft.state = 'SUCCEEDED';
	draft.completedAt = str(event.occurredAt);
	if (p.executionProvenance !== undefined) draft.provenance = p.executionProvenance;
}

/** ExecutionStepFailed: closes the step's current attempt as FAILED with its failure reason. */
function applyStepFailed(
	state: FoldState,
	event: DomainEvent,
	p: Record<string, unknown>,
	planId: string
): void {
	const stepId = str(p.stepId);
	const draft = stepId ? state.current.get(key(planId, stepId)) : undefined;
	if (!draft) return;
	draft.state = 'FAILED';
	draft.completedAt = str(event.occurredAt);
	draft.error = str(p.failureReason) ?? 'failed';
}

type StepApplier = (
	state: FoldState,
	event: DomainEvent,
	p: Record<string, unknown>,
	planId: string
) => void;

// ExecutionStepRetried is intentionally absent (a re-queue marker; the next Started opens attempt n+1).
// A Map (not an object literal) so a hostile/degenerate event.eventType — e.g. "__proto__" — resolves to
// undefined and is ignored, exactly as the original if/else-if chain did (an object literal would surface
// Object.prototype and throw on the ?.() invocation).
const STEP_APPLIERS = new Map<string, StepApplier>([
	['ExecutionStepStarted', applyStepStarted],
	['ExecutionStepSucceeded', applyStepSucceeded],
	['ExecutionStepFailed', applyStepFailed]
]);

/**
 * Fold the Execution* event stream into per-attempt §10.4 records (global event order). `stepTypeById` (from the
 * caller's plan aggregate — the events don't carry stepType) drives the AI-no-binding advisory; omit it and no
 * advisory fires. Pure: reads events, writes nothing.
 */
export function executionAttempts(
	events: readonly DomainEvent[],
	stepTypeById: Readonly<Record<string, string>> = {}
): ExecutionAttemptView[] {
	const state: FoldState = { attempts: [], startedCount: new Map(), current: new Map() };

	for (const event of events) {
		STEP_APPLIERS.get(event.eventType)?.(state, event, asRec(event.payload), event.aggregateId);
	}

	return state.attempts.map((a) => ({
		...a,
		aiNoBinding: AI_STEP_TYPES.has(stepTypeById[a.stepId] ?? '') && a.runtimeBindingId === undefined
	}));
}

/** Per-step attempt rollup for the UI: attempts in order + the count + the latest state. */
export interface StepAttempts {
	readonly stepId: string;
	readonly attempts: ExecutionAttemptView[];
	readonly attemptCount: number;
	readonly latestState?: string;
}

/** Group an attempt list by step (order preserved), for the per-step attempt-history render (3D). */
export function attemptsByStep(attempts: readonly ExecutionAttemptView[]): StepAttempts[] {
	const groups = new Map<string, ExecutionAttemptView[]>();
	for (const a of attempts) groups.set(a.stepId, [...(groups.get(a.stepId) ?? []), a]);
	return [...groups.entries()].map(([stepId, list]) => ({
		stepId,
		attempts: list,
		attemptCount: list.length,
		latestState: list.at(-1)?.state
	}));
}
