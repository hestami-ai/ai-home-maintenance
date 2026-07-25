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

/**
 * THE ATTEMPT-EFFECT TABLE (JAN-EXECREM WP-13 / F-36 + F-45) — TOTAL over every ExecutionStep* event.
 *
 * WHAT WAS WRONG. The fold handled THREE event types (Started, Succeeded, Failed) and silently skipped the other
 * seven. The header explained only why `ExecutionStepRetried` was absent; `ExecutionStepCancelled` was simply
 * unconsidered — so cancelling a RUNNING step (a first-class, tested path, legal even under a superseded plan)
 * left its attempt open forever: `state: 'RUNNING'`, no `completedAt`, on every replay. Deterministic, and
 * deterministically WRONG: the projection permanently contradicted the aggregate, and the UI rendered a live
 * in-flight attempt for a step the operator had aborted.
 *
 * An event type absent from a `Map` of appliers is INVISIBLE. A table over a closed set is not: NONE is a
 * DECLARATION with a stated reason rather than an omission, and WP-16's conformance sweep iterates this table
 * rather than restating it. Same mechanism as `STEP_COMMAND_SPECS`, for the same reason.
 *
 * PER-ENTRY KEY EXTRACTORS ARE LOAD-BEARING. These events do not agree on where the step id lives —
 * `ExecutionStepSucceeded` uses `executionStepId` (the ratified §16.2 shape) and every other uses `stepId` — and
 * the fields carrying explanatory text differ too (`failureReason` vs `reason`). A table assuming one key would
 * silently no-op on the events that use the other: the same invisibility, in a new place.
 */
type AttemptEffect =
	/** Opens attempt n+1 and makes it the step's open draft. */
	| { readonly kind: 'OPEN'; readonly stepIdKey: string }
	/** Closes the step's OPEN draft (if any) into a terminal state. */
	| {
			readonly kind: 'CLOSE';
			readonly stepIdKey: string;
			readonly state: string;
			/** Where this event carries its explanatory text, if anywhere. */
			readonly errorKey?: string;
	  }
	/** Moves an OPEN draft's state WITHOUT closing it — suspension is not termination. */
	| { readonly kind: 'MARK'; readonly stepIdKey: string; readonly state: string }
	/** Declares that this event affects no attempt, and why. */
	| { readonly kind: 'NONE'; readonly why: string };

const ATTEMPT_EFFECTS: Readonly<Record<string, AttemptEffect>> = {
	// One Started = one RUNNING episode = one attempt (§19 L3-3).
	ExecutionStepStarted: { kind: 'OPEN', stepIdKey: 'stepId' },
	// §16.2 names the step `executionStepId` here and nowhere else.
	ExecutionStepSucceeded: { kind: 'CLOSE', stepIdKey: 'executionStepId', state: 'SUCCEEDED' },
	ExecutionStepFailed: { kind: 'CLOSE', stepIdKey: 'stepId', state: 'FAILED', errorKey: 'failureReason' },
	// F-36, the omission: cancelling a RUNNING step left its attempt open forever.
	ExecutionStepCancelled: { kind: 'CLOSE', stepIdKey: 'stepId', state: 'CANCELLED', errorKey: 'reason' },
	// F-45: suspension is NOT termination. A WAITING step's attempt has not ended — but reporting it as RUNNING
	// contradicts the step row on the same page. MARK moves the state and leaves `completedAt` undefined, so it is
	// still the attempt a later Succeeded/Failed/Cancelled closes.
	ExecutionStepWaiting: { kind: 'MARK', stepIdKey: 'stepId', state: 'WAITING' },
	ExecutionStepWaitResolved: { kind: 'MARK', stepIdKey: 'stepId', state: 'RUNNING' },
	// Declared silences, each with its reason — not omissions.
	ExecutionStepRetried: {
		kind: 'NONE',
		why: 'a re-queue MARKER, not an attempt: counting it would double-count every retry (§19 L3-3). The attempt it re-opens is opened by the NEXT Started, as attempt n+1.'
	},
	ExecutionStepSkipped: {
		kind: 'NONE',
		why: 'Skip drives READY|QUEUED -> SKIPPED, so the step was never RUNNING and has no open attempt. A step cannot be skipped mid-flight; that is Cancel.'
	},
	ExecutionStepPruned: {
		kind: 'NONE',
		why: 'Prune drives NOT_READY|READY|QUEUED -> SKIPPED — the same argument as Skip: no attempt was ever opened.'
	},
	ExecutionStepReady: {
		kind: 'NONE',
		why: 'scheduling only (NOT_READY -> READY); no attempt exists until Started.'
	}
};

/** The event types this fold DECLARES an effect for — enumerable, so a sweep can check the table against the
 *  contract registry instead of trusting that nothing was forgotten. */
export const ATTEMPT_EFFECT_EVENT_TYPES: readonly string[] = Object.keys(ATTEMPT_EFFECTS);

/**
 * The step's OPEN attempt, or undefined.
 *
 * OPENNESS, NOT PRESENCE — and this is what makes the table above safe to extend. `current` records the step's
 * LATEST draft and is never cleared, so a CLOSED attempt stays in it. The sequence Start -> Fail -> Retry ->
 * Cancel is fully legal (Retry drives FAILED -> QUEUED; Cancel's source set includes QUEUED) and produces exactly
 * ONE Started, hence ONE attempt — already closed as FAILED. A close that looked `current` up by PRESENCE would
 * find attempt #1 and rewrite it FAILED -> CANCELLED, MOVING its completedAt: the projection would report that
 * the attempt which failed had in fact been cancelled, and at the wrong time. Testing `completedAt === undefined`
 * is what makes a close a close rather than an overwrite.
 */
function openDraft(
	state: FoldState,
	planId: string,
	stepId: string | undefined
): AttemptDraft | undefined {
	if (!stepId) return undefined;
	const draft = state.current.get(key(planId, stepId));
	return draft && draft.completedAt === undefined ? draft : undefined;
}

function applyAttemptEffect(
	state: FoldState,
	event: DomainEvent,
	p: Record<string, unknown>,
	planId: string,
	effect: AttemptEffect
): void {
	if (effect.kind === 'NONE') return;
	const stepId = str(p[effect.stepIdKey]);
	if (effect.kind === 'OPEN') {
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
		return;
	}
	const draft = openDraft(state, planId, stepId);
	if (!draft) return;
	if (effect.kind === 'MARK') {
		draft.state = effect.state;
		return;
	}
	draft.state = effect.state;
	draft.completedAt = str(event.occurredAt);
	if (effect.errorKey !== undefined) draft.error = str(p[effect.errorKey]) ?? effect.state.toLowerCase();
	if (p.executionProvenance !== undefined) draft.provenance = p.executionProvenance;
}

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
		// `Object.hasOwn` rather than a bare index: a hostile or degenerate eventType — '__proto__' — must
		// resolve to nothing rather than surfacing Object.prototype (the reason the previous form used a Map).
		if (!Object.hasOwn(ATTEMPT_EFFECTS, event.eventType)) continue;
		const effect = ATTEMPT_EFFECTS[event.eventType];
		if (effect) applyAttemptEffect(state, event, asRec(event.payload), event.aggregateId, effect);
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
