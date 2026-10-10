// ⭐⭐ `JAN-EXEC` Phase 7, P7-6R, R-1 (`docs/_working/DESIGN-the-stopped-unit-recovery.md`; `REG-D-104` (1); `REG-D-105` (3);
// `REG-F-511`) — A UNIT WHOSE REVIEW REFUSED IT WAITS FOR A PERSON, AND THIS MODULE READS, FROM THE RECORD, WHAT THE PERSON
// MAY DO NEXT.
//
// ⛔ EVERYTHING HERE IS READ FROM THE RECORD, NEVER FROM MEMORY. The refusal happened in one request (Begin & Execute, or a
// re-run); the person's choice arrives in another, possibly after a restart. So the choice is decided by what the store
// holds: the waiting step, the attempt that made the refused work product (RD6's `producingExecutionAttemptId`), the
// recorded floor assessments over it and over its command evidence, and the Decisions already taken.
//
// ── ⭐ RD3 — WHAT THE PERSON IS OFFERED FOLLOWS WHAT THE REFUSAL WAS ─────────────────────────────────────────────────────
// The floor already sorts a refusal into a problem with the REVIEW or a problem with the WORK (`isOperationalRemediation`,
// `../floor.ts`), and this module reuses that sort rather than restating it:
//   · the review DID NOT CONCLUDE (an operational action other than an escalation: a validator or transport failure, an
//     INCONCLUSIVE review, a reply answering no criterion — `REG-F-552`) → re-run the review, re-run the work, abandon;
//   · ⭐ `P76F-A` A4 — the review was refused for WHO reviewed: a substituted model, or a reviewer not independent of the
//     producer (`REVIEWER_MUST_CHANGE`) → abandon ALONE. Each re-run is reviewed by that same reviewer, so the unit waits
//     for the reviewer to change, or is abandoned. ⚠ A departure from RD3's table, which files both under "did not
//     conclude": the classifier's own guidance says a retry "does not fix this".
//   · the review CONCLUDED AGAINST THE WORK (`REFINE_SUBJECT`, or a deterministic floor finding beside a review that
//     passed, `RESOLVE_OTHER_FLOOR_FINDINGS`) → re-run the work with the findings, abandon;
//   · the review ESCALATED → re-run the work with the subject findings, abandon. ⛔ The escalation itself is never fed
//     back (`REG-D-090`).
// ⛔ RE-REVIEW AFTER A CONCLUDED REFUSAL IS NOT OFFERED, BY THE SPONSOR'S RULING (`REG-D-105` (3)): the floor reads the
// latest assessment per policy, so a second review of the same work product, run until one said SATISFIED, would clear a
// refusal the first review reasoned out — reviewer shopping, against ASR-12 in substance, and `REG-F-474`'s defect for an
// escalation. ⚠ ACROSS SUBJECTS, THE STRICTEST WINS: one concluded refusal among several makes the whole stop CONCLUDED,
// because a re-review re-runs every refused floor and would re-run that one too.
//
// ── ⭐ RD7 — WHAT A RE-REVIEW REBUILDS, AND ITS REFUSAL WHEN IT CANNOT ──────────────────────────────────────────────────
// The floor took four things from memory when it first ran: the producing prompt, the producer's rationale, the producer's
// identity, and each command's run. A re-review rebuilds each from the record, checks each against what the record says
// it was, and REFUSES — the unit keeps waiting — if any part cannot be rebuilt. It never reviews a partial reconstruction.
import { createHash } from 'node:crypto';
import {
	prepareModelInvocation,
	readAnswerSpan,
	resolveInvocationSubject,
	type ResolvableExchange
} from '@janumipwb/rph-application';
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import type {
	ContextSpecification,
	ObservedToolCallReport,
	PromptTemplate
} from '@janumipwb/rph-contracts';
import { attemptsMadeFrom } from '@janumipwb/rph-domain';
import {
	getObject,
	getObjectOfType,
	listAssessments,
	listByType,
	listExecutionPlans,
	listObservations,
	type AuthedEngineHandle,
	type EngineHandle
} from '@janumipwb/rph-engine';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import { processRunFromEvidence } from '../assurance/process-result-render.js';
import {
	classifyFloorRemediation,
	isOperationalRemediation,
	loadPwaFloor,
	type FloorRemediationAction,
	type FloorView
} from '../floor.js';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import { resolveContextPolicy } from './context-policy.js';
import { splitExecutionEnvelope } from './execution-contract.js';

/** The two re-runs a REPLAN Decision may select (RD4). ⭑ Free strings: `Decision.selectedOption` is `z.string()`. */
export const RERUN_REVIEW = 'RERUN_REVIEW';
export const RERUN_WORK = 'RERUN_WORK';

/**
 * ⭐ RD4 — WHAT THE PERSON MUST TYPE. A re-run or an abandonment from waiting is a person's Decision, and its rationale is the
 * only part of it a later reader can use to learn WHY; a defaulted rationale would record a reason nobody gave.
 */
export const RATIONALE_REQUIRED =
	'This unit waits for a person’s choice, and the choice is recorded as your Decision: say why, in your own words — the rationale is required (REG-D-104 (1); DESIGN-the-stopped-unit-recovery.md RD4).';

/**
 * ⭐ RD6 — THE ATTEMPT'S KEY: `<stepId>#<n>`, the n-th `ExecutionStepStarted` of the step. ⛔ THE SAME KEY THE ATTEMPT
 * PROJECTION MINTS (`rph-projections` `execution-attempts.ts`, `idempotencyKey`), from the SAME kernel count
 * (`attemptsMadeFrom`), so the work product names the attempt the page lists, not a second numbering of it.
 */
export function attemptKeyOf(engine: EngineHandle, planId: string, stepId: string): string {
	return `${stepId}#${attemptsMadeFrom(engine.readAllEvents(), planId, stepId)}`;
}

/** The step an attempt key names: everything before its last `#` — this module's own format, so a structural split. */
export function attemptStepOf(attemptKey: string): string {
	return attemptKey.slice(0, attemptKey.lastIndexOf('#'));
}

/**
 * How one refusal reads to RD3: the review did not conclude, concluded against the work, or escalated — ⭐ `P76F-A` A4: or
 * was refused for WHO reviewed, which only a different or re-qualified reviewer can fix (`REVIEWER_MUST_CHANGE`).
 */
export type RefusalKind = 'NOT_CONCLUDED' | 'CONCLUDED' | 'ESCALATED' | 'REVIEWER_MUST_CHANGE';

/**
 * ⭐⭐ `P76F-A` A4 — THE TWO REFUSALS ONLY A DIFFERENT OR RE-QUALIFIED REVIEWER CAN FIX, each with why, in the classifier's own
 * terms (`../floor.ts`, `classifyFloorRemediation`):
 *   · `REQUALIFY_OR_RESELECT_REVIEWER` — the reviewing tool reported that a model other than the configured and selected one
 *     answered (`JAN-SELREV` D6). Its guidance: *"Retrying or reconfiguring the same selection does not fix this: another
 *     call is billed and may be served the same way."*
 *   · `CHANGE_REVIEWER` — the review was not independent of the producer (ASR-13). The same reviewer against the same
 *     producer is refused the same way; its guidance: *"Select a permitted reviewer/model/provider that satisfies the
 *     policy independence rule"*.
 * ⛔ EACH WAS SORTED "DID NOT CONCLUDE" — both are operational (`isOperationalRemediation`) — so a re-review was offered and
 * the paid lane's rule pressed it (`REG-D-105` (4)): another billed call to the reviewer the refusal had just refused.
 * Neither re-run is offered for them now: a re-run of the WORK is reviewed by that same reviewer too. The unit waits for
 * the reviewer to change, or is abandoned.
 * ⚠ READ FROM THE RECORD, LIKE EVERY OFFER HERE: a reviewer re-selected after the refusal does not re-open the offer — the
 * recorded refusal still names the one refused, and nothing recorded says which reviewer would run now. Disclosed (the
 * builder's report); RD3 has no row for it.
 */
const REVIEWER_MUST_CHANGE: Readonly<Partial<Record<FloorRemediationAction, string>>> = {
	REQUALIFY_OR_RESELECT_REVIEWER:
		'the reviewing tool reported that a model other than the configured and selected one answered, so the review was refused (REQUALIFY_OR_RESELECT_REVIEWER)',
	CHANGE_REVIEWER: 'the review was not independent of the producer (CHANGE_REVIEWER)'
};

/**
 * ⭐ RD3, FOR ONE REFUSED SUBJECT — the floor's own sort (`isOperationalRemediation`), with the escalation taken out of the
 * operational side: it is a review that CONCLUDED (it named a human), and re-reviewing it is `REG-F-474`'s defect. ⭐ And,
 * `P76F-A` A4, the two refusals of WHO reviewed taken out too (`REVIEWER_MUST_CHANGE`): no re-run fixes them.
 */
export function refusalKindOf(action: FloorRemediationAction): RefusalKind {
	if (action === 'ESCALATE_REVIEW') return 'ESCALATED';
	if (REVIEWER_MUST_CHANGE[action] !== undefined) return 'REVIEWER_MUST_CHANGE';
	return isOperationalRemediation(action) ? 'NOT_CONCLUDED' : 'CONCLUDED';
}

/**
 * ⭐ RD3, ACROSS SUBJECTS — the strictest: a reviewer that must change first (`P76F-A` A4: any re-run is reviewed by it
 * again, so one such subject withholds both re-runs), then one concluded refusal makes the stop concluded, then one
 * escalation.
 */
export function strictestKind(kinds: readonly RefusalKind[]): RefusalKind {
	if (kinds.includes('REVIEWER_MUST_CHANGE')) return 'REVIEWER_MUST_CHANGE';
	if (kinds.includes('CONCLUDED')) return 'CONCLUDED';
	if (kinds.includes('ESCALATED')) return 'ESCALATED';
	return 'NOT_CONCLUDED';
}

/** One subject the refused attempt produced whose floor is NOT satisfied, as the record holds it. */
export interface RecordedRefusal {
	readonly subjectId: string;
	readonly objectType: 'ARTIFACT' | 'EVIDENCE';
	/** What the floor's classifier answers this subject's recorded floor with. */
	readonly action: FloorRemediationAction;
	/** Each floor policy whose latest assessment is not SATISFIED, `policyId=disposition` as the engine names it. */
	readonly unsatisfied: readonly { readonly policyId: string; readonly disposition: string }[];
	/** The observations of those assessments — what RD4's Decision considered. */
	readonly observationIds: readonly string[];
	/** ⛔ The classifier's SUBJECT findings only: never an operational code, never the escalation recommendation. */
	readonly findings: readonly { readonly code: string; readonly statement: string }[];
}

/** A unit waiting for a person's choice, read from the record (RD2-RD4). */
export interface StoppedUnit {
	readonly pwuId: string;
	readonly planId: string;
	readonly stepId: string;
	readonly stepType: string;
	/** The attempt that produced the refused work product (RD6). */
	readonly attemptKey: string;
	readonly workProductId: string;
	/** Every command evidence that attempt produced, in the order it was recorded. */
	readonly evidenceIds: readonly string[];
	readonly refusals: readonly RecordedRefusal[];
	readonly kind: RefusalKind;
	readonly offers: {
		readonly rerunReview: boolean;
		readonly rerunWork: boolean;
		readonly abandon: boolean;
	};
	/** RD8 — the subject findings a re-run of the work carries, de-duplicated, in the order the refusals list them. */
	readonly findings: readonly { readonly code: string; readonly statement: string }[];
	/** RD4 — every refusing assessment's observations. */
	readonly consideredObservationIds: readonly string[];
	/** RD9 — how many re-runs the unit has had: its EFFECTIVE `REPLAN` Decisions. */
	readonly reruns: number;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The unit's ACTIVE plan and its WAITING step — the wait RD2 records — or undefined when it has none. */
export function waitingStepOf(
	engine: EngineHandle,
	pwuId: string
):
	| {
			readonly planId: string;
			readonly stepId: string;
			readonly stepType: string;
			readonly step: Record<string, unknown>;
	  }
	| undefined {
	for (const plan of listExecutionPlans(engine)) {
		if (plan.state.workUnitId !== pwuId || plan.state.status !== 'ACTIVE') continue;
		const steps = (plan.state.steps as Record<string, unknown>[] | undefined) ?? [];
		const step = steps.find((s) => s.stepState === 'WAITING');
		if (step) return { planId: plan.id, stepId: str(step.id), stepType: str(step.stepType), step };
	}
	return undefined;
}

/** The latest floor assessment per policy over `subjectId` — the floor gate's rule: by `updatedAt`, ties to the last seen. */
function latestFloorAssessmentIds(engine: EngineHandle, subjectId: string): Map<string, string> {
	const floorPolicies = new Set<string>(Object.values(FLOOR_POLICY_IDS));
	const latest = new Map<string, { id: string; at: string; state: string }>();
	for (const a of listAssessments(engine, { kind: 'WORKSPACE' })) {
		const subjects = (a.state.subjectObjectIds as unknown[] | undefined) ?? [];
		const policyId = str(a.state.assurancePolicyId);
		if (!subjects.includes(subjectId) || !floorPolicies.has(policyId)) continue;
		const at = str(a.state.updatedAt);
		const prev = latest.get(policyId);
		if (!prev || at >= prev.at)
			latest.set(policyId, { id: a.id, at, state: str(a.state.assessmentState) });
	}
	return new Map(
		[...latest].filter(([, a]) => a.state !== 'SATISFIED').map(([policyId, a]) => [policyId, a.id])
	);
}

/** A subject's recorded refusal, or undefined when its floor is SATISFIED. */
function recordedRefusalOf(
	engine: AuthedEngineHandle,
	subjectId: string,
	objectType: 'ARTIFACT' | 'EVIDENCE'
): RecordedRefusal | undefined {
	// ⭑ `loadPwaFloor` IS SUBJECT-AGNOSTIC — it keys on `subjectObjectIds` alone; its name is the authoring plane's, its
	// first caller's. A subject with no floor recorded at all reads as a review that did not run.
	const view: FloorView = loadPwaFloor(subjectId, engine) ?? {
		subjectId,
		aggregate: 'UNASSESSED',
		satisfied: false,
		waived: false,
		policies: [],
		reasoningGaps: []
	};
	if (view.satisfied) return undefined;
	const remediation = classifyFloorRemediation(view);
	const refusing = latestFloorAssessmentIds(engine, subjectId);
	const refusingIds = new Set(refusing.values());
	return {
		subjectId,
		objectType,
		action: remediation.action,
		unsatisfied: view.policies
			.filter((p) => p.disposition !== 'SATISFIED')
			.map((p) => ({ policyId: p.policyId, disposition: p.disposition })),
		observationIds: listObservations(engine, { kind: 'WORKSPACE' })
			.filter((o) => refusingIds.has(str(o.state.assessmentId)))
			.map((o) => o.id),
		findings: remediation.findings.map((f) => ({ code: f.code, statement: f.statement }))
	};
}

/**
 * ⭐ THE STOPPED UNIT, FROM THE RECORD — or why it is not one a re-run can start from.
 *
 * ⛔ A REVIEW STEP NAMES ITS SUBJECT AS ITS INPUT: an `ASSURANCE_INVOCATION` step (a re-review's plan, RD5) runs no producer
 * and makes no work product, so the refused work product is its one input binding, and the attempt is the one that made
 * it. A PRODUCER step's attempt is its own latest Start, and its work product the LAST one that attempt recorded — the one
 * its refused completion named, since each try records its own and the completion names the last.
 */
export function stoppedUnitOf(
	engine: AuthedEngineHandle,
	pwuId: string
):
	| { readonly ok: true; readonly unit: StoppedUnit }
	| { readonly ok: false; readonly refusedBecause: string } {
	const pwu = getObjectOfType(engine, 'PROFESSIONAL_WORK_UNIT', pwuId);
	if (!pwu) return { ok: false, refusedBecause: `${pwuId} names no work unit.` };
	if (pwu.workLifecycleState !== 'EXECUTING' || pwu.executionState !== 'WAITING')
		return {
			ok: false,
			refusedBecause: `work unit ${pwuId} is ${str(pwu.workLifecycleState)} with its execution ${str(pwu.executionState)}, not waiting for a person’s choice after a refused review.`
		};
	const waiting = waitingStepOf(engine, pwuId);
	if (!waiting)
		return {
			ok: false,
			refusedBecause: `work unit ${pwuId} has no ACTIVE plan whose step is WAITING.`
		};
	let attemptKey: string;
	let workProductId: string;
	if (waiting.stepType === 'ASSURANCE_INVOCATION') {
		const inputs = (waiting.step.inputBindings as { artifactId?: string }[] | undefined) ?? [];
		workProductId = str(inputs[0]?.artifactId);
		attemptKey = str(getObject(engine, workProductId)?.producingExecutionAttemptId);
	} else {
		attemptKey = attemptKeyOf(engine, waiting.planId, waiting.stepId);
		workProductId =
			listByType(engine, 'ARTIFACT')
				.filter((a) => a.state.producingExecutionAttemptId === attemptKey)
				.at(-1)?.id ?? '';
	}
	if (!workProductId || !attemptKey)
		return {
			ok: false,
			refusedBecause: `the record names no work product of the refused attempt on step ${waiting.stepId} (RD6: a work product names the attempt that made it), so there is nothing to re-review and no findings to carry.`
		};
	const evidenceIds = listByType(engine, 'EVIDENCE')
		.filter(
			(e) =>
				(e.state.contentReference as { producingExecutionAttemptId?: unknown } | undefined)
					?.producingExecutionAttemptId === attemptKey
		)
		.map((e) => e.id);
	const refusals = [
		recordedRefusalOf(engine, workProductId, 'ARTIFACT'),
		...evidenceIds.map((id) => recordedRefusalOf(engine, id, 'EVIDENCE'))
	].filter((r): r is RecordedRefusal => r !== undefined);
	const kind = strictestKind(refusals.map((r) => refusalKindOf(r.action)));
	const seen = new Set<string>();
	const findings = refusals
		.flatMap((r) => r.findings)
		.filter((f) => {
			const key = `${f.code}\u0000${f.statement}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	const reruns = listByType(engine, 'DECISION').filter(
		(d) =>
			d.state.decisionType === 'REPLAN' &&
			d.state.status === 'EFFECTIVE' &&
			((d.state.subjectObjectIds as unknown[] | undefined) ?? []).includes(pwuId)
	).length;
	return {
		ok: true,
		unit: {
			pwuId,
			planId: waiting.planId,
			stepId: waiting.stepId,
			stepType: waiting.stepType,
			attemptKey,
			workProductId,
			evidenceIds,
			refusals,
			kind,
			offers: {
				// ⛔ `REG-D-105` (3): only a review that did not conclude may be re-run — and only when one was refused.
				rerunReview: kind === 'NOT_CONCLUDED' && refusals.length > 0,
				// ⛔ `P76F-A` A4: and the work, after any refusal SAVE one only a different reviewer can fix — the new work would be
				// reviewed by the reviewer just refused.
				rerunWork: kind !== 'REVIEWER_MUST_CHANGE',
				abandon: true
			},
			findings,
			consideredObservationIds: refusals.flatMap((r) => r.observationIds),
			reruns
		}
	};
}

/** Each refused subject and the policies that refused it, as the engine names them: `<id>: <policy>=<disposition>, …`. */
export function describeRefusals(
	refusals: readonly {
		readonly subjectId: string;
		readonly unsatisfied: readonly { readonly policyId: string; readonly disposition: string }[];
	}[]
): string {
	return refusals
		.map(
			(r) =>
				`${r.subjectId}: ${r.unsatisfied.map((p) => `${p.policyId}=${p.disposition}`).join(', ') || 'no floor recorded'}`
		)
		.join('; ');
}

/**
 * ⭐ RD2 — THE WAIT'S REASON, written where the refusal happens: each refusing subject with each policy and its disposition,
 * and what the unit now waits for. ⭑ From the floor runs the route just made, never re-read — the same facts the record
 * now holds, in the engine's own `policyId=disposition` form.
 */
export function waitReasonFor(
	refusals: readonly {
		readonly subjectId: string;
		readonly unsatisfied: readonly { readonly policyId: string; readonly disposition: string }[];
	}[],
	engineRefusal: string
): string {
	const named = describeRefusals(refusals);
	return (
		`The assurance floor refused the completion — ${named || engineRefusal}. The unit waits for a person to choose: ` +
		're-run the review, re-run the work with the findings, or abandon it (REG-D-104 (1)).'
	);
}

/**
 * ⭐⭐ `P76F-A` A4 — WHY NEITHER RE-RUN IS OFFERED, for a stop only a different or re-qualified reviewer can fix: each such
 * refused subject with the classifier's reason, then the remedy, which is the reviewer's, never a re-run's. Null for any
 * other stop. ⭑ ONE TEXT, read by the page (`RecoveryView.rerunsWithheld`) and by the server's refusal of each re-run.
 */
export function reviewerMustChange(unit: StoppedUnit): string | null {
	if (unit.kind !== 'REVIEWER_MUST_CHANGE') return null;
	const why = unit.refusals.flatMap((r) => {
		const reason = REVIEWER_MUST_CHANGE[r.action];
		return reason === undefined ? [] : [`${r.subjectId}: ${reason}`];
	});
	return (
		`the reviewer must change before anything is re-run (${why.join('; ')}). A re-run of the review, or of the work, is ` +
		'reviewed by that same reviewer: another billed call, refused the same way, so re-running does not fix this. The unit ' +
		'waits until the reviewer is re-qualified or re-selected (REG-D-084, REG-D-086), or one independent of the producer is ' +
		'selected — or it is abandoned.'
	);
}

/** ⛔ `REG-D-105` (3) — why a re-review is refused for this stop, or null when it is offered. */
export function rerunReviewRefusal(unit: StoppedUnit): string | null {
	if (unit.offers.rerunReview) return null;
	// ⭐ `P76F-A` A4 — first: a reviewer that must change refuses the re-review whatever else was refused.
	const mustChange = reviewerMustChange(unit);
	if (mustChange) return mustChange;
	if (unit.refusals.length === 0)
		return 'no review of the refused attempt is refused on the record, so there is nothing to re-review.';
	return unit.kind === 'ESCALATED'
		? `the review escalated (${describeRefusals(unit.refusals)}); a re-review would let an automated reviewer clear an escalation meant for a person (REG-F-474). Re-run the work, or abandon the unit (REG-D-105 (3)).`
		: `the review concluded against the work (${describeRefusals(unit.refusals)}); the floor reads the latest assessment, so a second review of the same work product could clear a reasoned refusal. Re-run the work with the findings, or abandon the unit (REG-D-105 (3)).`;
}

/**
 * ⭐ `P76F-A` A4 — why a re-run of the work is refused for this stop, or null when it is offered: only a stop the reviewer
 * must change for withholds it (`reviewerMustChange`).
 */
export function rerunWorkRefusal(unit: StoppedUnit): string | null {
	if (unit.offers.rerunWork) return null;
	return reviewerMustChange(unit) ?? 'a re-run of the work is not offered for this stop.';
}

/** What the Undertaking page shows of a waiting unit, and offers (R-1d). Serializable. */
export interface RecoveryView {
	readonly kind: RefusalKind | 'UNREADABLE';
	readonly refusal: string;
	/** ⭐ `P76F-A` A4 — why NEITHER re-run is offered, when only a different reviewer can fix the refusal; else null. */
	readonly rerunsWithheld: string | null;
	readonly offers: {
		readonly rerunReview: boolean;
		readonly rerunWork: boolean;
		readonly abandon: boolean;
	};
	/** How many subject findings a re-run of the work would carry. */
	readonly findings: number;
	readonly reruns: number;
	readonly stepId: string;
}

/** The page's view of a waiting unit — or, when the record cannot say what refused it, Abandon alone, saying why. */
export function recoveryViewOf(
	engine: AuthedEngineHandle,
	pwuId: string
): RecoveryView | undefined {
	// ⭑ The unit's own axis first: the page asks this of every unit, and only a waiting one is worth a scan of the plans.
	const pwu = getObjectOfType(engine, 'PROFESSIONAL_WORK_UNIT', pwuId);
	if (pwu?.executionState !== 'WAITING') return undefined;
	const waiting = waitingStepOf(engine, pwuId);
	if (!waiting) return undefined;
	const stopped = stoppedUnitOf(engine, pwuId);
	if (!stopped.ok)
		return {
			kind: 'UNREADABLE',
			refusal: stopped.refusedBecause,
			rerunsWithheld: null,
			offers: { rerunReview: false, rerunWork: false, abandon: true },
			findings: 0,
			reruns: 0,
			stepId: waiting.stepId
		};
	const u = stopped.unit;
	return {
		kind: u.kind,
		refusal: describeRefusals(u.refusals),
		rerunsWithheld: reviewerMustChange(u),
		offers: u.offers,
		findings: u.findings.length,
		reruns: u.reruns,
		stepId: u.stepId
	};
}

// ── ⭐ RD7 — THE REBUILD ─────────────────────────────────────────────────────────────────────────────────────────────────

const sha256 = (bytes: string): string =>
	`sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;

/** What a re-review needs of the turn that produced the refused work product, rebuilt from the record. */
export interface RebuiltProducingTurn {
	readonly artifact: Record<string, unknown>;
	/** The work product's bytes, verified against the ARTIFACT's own content hash. */
	readonly answer: string;
	/** The EXECUTION exchange that produced it. */
	readonly exchange: ResolvableExchange & Record<string, unknown>;
	/** The instruction, re-rendered and checked against the exchange's `promptTemplateFingerprint`. */
	readonly producingPrompt: string;
	readonly producerModelId: string;
	readonly producerProviderId: string;
	readonly rationale?: ProfessionalRationaleSummary;
	readonly observedToolCalls?: ObservedToolCallReport;
}

type Rebuilt<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly refusedBecause: string };

/**
 * ⭐ RD7 — THE PRODUCING TURN, REBUILT: the prompt re-rendered from the type's template and the subject and checked against
 * the exchange's fingerprint; the rationale split from the exchange's retained answer span, as Begin & Execute split it
 * (`splitExecutionEnvelope`), and checked to split into the very bytes the ARTIFACT names; the producer's identity from
 * that exchange. ⛔ Any part that cannot be rebuilt, or does not check, refuses the whole.
 */
export async function rebuildProducingTurn(
	engine: EngineHandle,
	store: ArtifactStore,
	args: {
		readonly pwuId: string;
		readonly workProductId: string;
		readonly attemptKey: string;
		readonly pwuTypeId: string;
		readonly template: PromptTemplate | undefined;
		readonly purpose?: string;
		readonly contextSpecification?: ContextSpecification;
	}
): Promise<Rebuilt<RebuiltProducingTurn>> {
	const refuse = (why: string): Rebuilt<RebuiltProducingTurn> => ({
		ok: false,
		refusedBecause: why
	});
	const artifact = getObjectOfType(engine, 'ARTIFACT', args.workProductId);
	if (!artifact) return refuse(`${args.workProductId} names no recorded work product.`);
	const storageKey = str(artifact.storageKey);
	// 1. THE WORK PRODUCT'S BYTES, re-hashed: a re-review of bytes the record does not name would review something else.
	const answer = await verifiedBytes(
		store,
		storageKey,
		str(artifact.contentHash),
		'the work product’s bytes'
	);
	if (!answer.ok) return answer;
	// 2. THE EXECUTION EXCHANGE THAT PRODUCED THEM.
	const exchange = producingExchangeOf(engine, args.pwuId, args.workProductId, storageKey);
	if (!exchange)
		return refuse(
			`no EXECUTION exchange of work unit ${args.pwuId} recorded before ${args.workProductId} names its bytes, so the turn that produced it cannot be read.`
		);
	const exchangeId = str(exchange.exchangeId) || str(exchange.id);
	// 3. THE PROMPT, RE-RENDERED, and checked against the fingerprint the exchange recorded.
	const instruction = rerenderedInstruction(engine, args);
	if (!instruction.ok) return instruction;
	const mismatch = fingerprintRefusal(instruction.value.fingerprint, exchange);
	if (mismatch) return refuse(mismatch);
	// 4. THE RATIONALE: the exchange's retained answer span, verified, split as Begin & Execute split it.
	const span = await readAnswerSpan(exchange as unknown as ResolvableExchange, store);
	if (!span.available)
		return refuse(`exchange ${exchangeId}’s answer span cannot be read: ${span.refusedBecause}`);
	const envelope = splitExecutionEnvelope(span.bytes);
	const unsplit = splitRefusal(envelope.workProduct, answer.value, exchangeId, args.workProductId);
	if (unsplit) return refuse(unsplit);
	// 5. THE PRODUCER'S IDENTITY, as the exchange recorded it.
	const producer = producerOf(exchange);
	if ('refusedBecause' in producer) return refuse(producer.refusedBecause);
	return {
		ok: true,
		value: {
			artifact,
			answer: answer.value,
			exchange: exchange as ResolvableExchange & Record<string, unknown>,
			producingPrompt: instruction.value.prompt,
			producerModelId: producer.modelId,
			producerProviderId: producer.providerId,
			...(envelope.rationale ? { rationale: envelope.rationale } : {}),
			...(exchange.observedToolCalls
				? { observedToolCalls: exchange.observedToolCalls as ObservedToolCallReport }
				: {})
		}
	};
}

/** Bytes from the content store, re-hashed against the hash their record names — or why not. */
async function verifiedBytes(
	store: ArtifactStore,
	storageKey: string,
	contentHash: string,
	what: string
): Promise<Rebuilt<string>> {
	const bytes = await store.get(storageKey);
	if (bytes === undefined)
		return {
			ok: false,
			refusedBecause: `${what} at '${storageKey}' are not in the content store.`
		};
	if (sha256(bytes) !== contentHash)
		return {
			ok: false,
			refusedBecause: `${what} at '${storageKey}' hash to ${sha256(bytes)}, not the ${contentHash} its record names.`
		};
	return { ok: true, value: bytes };
}

/**
 * ⭐ RD7 — THE EXECUTION EXCHANGE THAT PRODUCED A WORK PRODUCT: the LAST one of the unit recorded BEFORE the work product,
 * whose declared work-product address is the work product's own (`workProductDerivation`, R11). ⭑ By the log's order,
 * because the route records each try's exchange and then its work product, and identical bytes from two tries share one
 * content-addressed key — so the key alone could name an earlier try's exchange, and its rationale.
 */
export function producingExchangeOf(
	engine: EngineHandle,
	pwuId: string,
	workProductId: string,
	storageKey: string
): Record<string, unknown> | undefined {
	const events = engine.readAllEvents();
	const recordedAt = events.findIndex(
		(e) => e.eventType === 'ArtifactRecorded' && e.aggregateId === workProductId
	);
	let exchange: Record<string, unknown> | undefined;
	for (const e of events.slice(0, Math.max(recordedAt, 0))) {
		if (e.eventType !== 'ModelExchangeRecorded') continue;
		const x = getObject(engine, e.aggregateId);
		const derived = (x?.workProductDerivation as { storageKey?: unknown } | undefined)?.storageKey;
		if (x?.plane === 'EXECUTION' && x.subjectObjectId === pwuId && derived === storageKey)
			exchange = x;
	}
	return exchange;
}

/**
 * ⭐ RD7 — THE PRODUCING PROMPT, RE-RENDERED from the type's template and the subject, under the context policy the producing
 * step was bound to — as Begin & Execute renders it (`prepareModelInvocation`), the instruction with no repair assembled.
 */
function rerenderedInstruction(
	engine: EngineHandle,
	args: {
		readonly pwuId: string;
		readonly attemptKey: string;
		readonly pwuTypeId: string;
		readonly template: PromptTemplate | undefined;
		readonly purpose?: string;
		readonly contextSpecification?: ContextSpecification;
	}
): Rebuilt<{ readonly prompt: string; readonly fingerprint: string }> {
	let policy;
	try {
		policy = resolveContextPolicy(engine, attemptStepOf(args.attemptKey)).policy;
	} catch (e) {
		return {
			ok: false,
			refusedBecause: `the producing step’s context policy cannot be resolved: ${e instanceof Error ? e.message : String(e)}`
		};
	}
	const subject = {
		...resolveInvocationSubject(
			(id) => getObjectOfType(engine, 'PROFESSIONAL_WORK_UNIT', id),
			args.pwuId
		),
		...(args.purpose ? { purpose: args.purpose } : {})
	};
	const plan = prepareModelInvocation(subject, args.pwuTypeId, args.template, {
		policy,
		alsoAssembles: [],
		...(args.contextSpecification ? { specification: args.contextSpecification } : {})
	});
	if (!plan.ready)
		return {
			ok: false,
			refusedBecause: `the producing prompt cannot be re-rendered: ${plan.reason}`
		};
	return { ok: true, value: { prompt: plan.prompt, fingerprint: plan.fingerprint } };
}

/**
 * ⭐ RD7 — THE RE-RENDERED PROMPT'S FINGERPRINT MUST BE THE ONE THE PRODUCING EXCHANGE RECORDED (`run-model-step.ts`,
 * `promptTemplateFingerprint`) — or the template is not the one that produced the work product. Null when they agree.
 */
export function fingerprintRefusal(
	rendered: string,
	exchange: Readonly<Record<string, unknown>>
): string | null {
	const recorded = str(exchange.promptTemplateFingerprint);
	if (rendered === recorded) return null;
	const exchangeId = str(exchange.exchangeId) || str(exchange.id);
	return `the prompt re-renders under ${rendered}, and exchange ${exchangeId} records ${recorded || 'no fingerprint'}: the template is not the one that produced the work product.`;
}

/**
 * ⭐ RD7 — THE ANSWER SPAN MUST SPLIT INTO THE VERY WORK PRODUCT THE ARTIFACT NAMES, or the rationale beside it is not the
 * one that was reviewed. Null when it does.
 */
export function splitRefusal(
	splitWorkProduct: string,
	workProduct: string,
	exchangeId: string,
	workProductId: string
): string | null {
	return splitWorkProduct === workProduct
		? null
		: `exchange ${exchangeId}’s answer span does not split into the work product ${workProductId} names, so the rationale beside it is not the one that was reviewed.`;
}

/**
 * ⭐ RD7 — THE PRODUCER'S IDENTITY, AS THE PRODUCING EXCHANGE RECORDED IT: the model and the provider. ⛔ Both, or a refusal:
 * the reasoning review's `DIFFERENT_MODEL` independence compares them, and an absence cannot evidence independence.
 */
export function producerOf(
	exchange: Readonly<Record<string, unknown>>
): { readonly modelId: string; readonly providerId: string } | { readonly refusedBecause: string } {
	const modelId = str((exchange.resolvedModel as { value?: unknown } | undefined)?.value);
	const providerId = str((exchange.resolvedProvider as { value?: unknown } | undefined)?.value);
	if (modelId && providerId) return { modelId, providerId };
	const exchangeId = str(exchange.exchangeId) || str(exchange.id);
	return {
		refusedBecause: `exchange ${exchangeId} records no producing model and provider, so the review’s independence cannot be decided.`
	};
}

/**
 * ⭐ RD7 — ONE COMMAND'S RUN, REBUILT FROM ITS EVIDENCE: the command, exit code, deadline and duration from the EVIDENCE's
 * `contentReference`; the streams, the capture's cuts and its completeness from the stored bytes the join minted
 * (`renderProcessResultEvidence`), re-hashed against the record.
 *
 * ⛔ SELF-VERIFYING: the rebuilt run is RE-RENDERED and must reproduce the stored bytes EXACTLY, so a parse that read the
 * rendering wrongly refuses rather than reviewing something else. ⛔ AND AN AMBIGUOUS SPLIT REFUSES: a stdout that itself
 * holds the stderr heading's line could split two ways that render identically, and which one ran cannot be told.
 * ⭑ Both are `processRunFromEvidence`'s, in the renderer's own module, since that read binds the error stream (`REG-Q-066`;
 * moved there after the gate's `verif/agy-stderr-unbound.test.ts` named this file's two bindings).
 * ⚠ TWO FIELDS ARE NOT IN THE EVIDENCE, AND NO FLOOR READS EITHER (grep, 2026-10-10: neither `process-result-render.ts`,
 * `review-input.ts` nor `process-result-floor.ts` reads `ordinal` or an omission's `reason`): `ordinal` is the run's place
 * among the attempt's evidence, and each cut's `reason` says it is not in the evidence rather than inventing one.
 */
export async function rebuildProcessRun(
	evidence: Record<string, unknown>,
	store: ArtifactStore,
	ordinal: number
): Promise<Rebuilt<ObservedProcessRun>> {
	const id = str(evidence.id);
	const refuse = (why: string): Rebuilt<ObservedProcessRun> => ({
		ok: false,
		refusedBecause: `${id}: ${why}`
	});
	const ref = evidence.contentReference as
		| {
				mint?: { storageKey?: unknown; contentHash?: unknown };
				capture?: Record<string, unknown>;
				command?: unknown;
				exitCode?: unknown;
				timedOut?: unknown;
				durationMs?: unknown;
		  }
		| undefined;
	const argv = Array.isArray(ref?.command) ? ref.command.map(String) : undefined;
	if (
		!ref?.mint ||
		!ref.capture ||
		!argv ||
		!(typeof ref.exitCode === 'number' || ref.exitCode === null) ||
		typeof ref.timedOut !== 'boolean' ||
		typeof ref.durationMs !== 'number'
	)
		return refuse(
			'its content reference does not hold the command, its exit, its deadline and its duration.'
		);
	const storageKey = str(ref.mint.storageKey);
	const bytes = await store.get(storageKey);
	if (bytes === undefined)
		return refuse(`its bytes at '${storageKey}' are not in the content store.`);
	if (sha256(bytes) !== str(ref.mint.contentHash))
		return refuse(
			`its bytes at '${storageKey}' do not hash to the ${str(ref.mint.contentHash)} it names.`
		);
	// ⛔ READ BACK BY THE RENDERER'S OWN MODULE, NEVER HERE: the read binds the run's error stream, and only a site with
	// a retention disposition may bind it (`REG-Q-066`; `verif/agy-stderr-unbound.test.ts`). The record supplies what
	// the bytes do not carry.
	const capture = ref.capture;
	const read = processRunFromEvidence(
		bytes,
		{
			ordinal,
			argv,
			exitCode: ref.exitCode,
			timedOut: ref.timedOut,
			durationMs: ref.durationMs
		},
		(omittedRegions) =>
			capture.retained === true
				? {
						retained: true,
						workspaceOwnerId: str(capture.workspaceOwnerId),
						purgeability: capture.purgeability as 'PURGEABLE_AT_EXPIRY',
						stdoutPath: str(capture.stdoutPath),
						stderrPath: str(capture.stderrPath),
						omittedRegions,
						omissionsPath: str(capture.omissionsPath)
					}
				: { retained: false, notRetainedBecause: str(capture.notRetainedBecause) }
	);
	return 'run' in read ? { ok: true, value: read.run } : refuse(read.refusedBecause);
}
