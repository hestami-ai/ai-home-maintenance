// ⭐⭐ `JAN-EXEC` Phase 7, package L16 — design D71 (`REG-D-163` (2); `REG-F-640`; `REG-Q-034`) — A UNIT ITS DECLARED REVIEWS REJECT CAN HAVE
// ITS WORK RE-RUN, IN PLACE, WITH THEIR FINDINGS: WHAT THE PAGE OFFERS, AND WHAT THE RE-RUN CARRIES, READ FROM THE RECORD.
//
// ⛔ WHAT WAS WRONG (`REG-F-640`). P6 again's eighth run's Requirements Specification was rejected by its declared assumption-disclosure review
// for AD-04, and the run ended there: the page re-ran work only from a unit stopped mid-execution, and the contracted transition table had no
// edge from a rejected declared assurance back to work. `REG-Q-034` forbade inventing one; the sponsor ratified one (`REG-D-163` (2)).
// ⭑ WHAT IS READ HERE, AND WHY HERE: the page offers the act, and the route's action accepts it, by ONE reading, so the page never offers what
// the server refuses — and the kernel (`changePwuState`, `rejectUnauthorizedRework`) refuses the move itself without what this names.
import { listByType, listExecutionPlans, type EngineHandle } from '@janumipwb/rph-engine';
import {
	governingDeclaredPolicies,
	latestDeclaredVerdicts,
	type LatestDeclaredVerdict
} from '../assurance/declared-policy-signoff.js';

/** ⭐ D71 — the option a person's re-run of the work its declared reviews rejected selects, on its Decision: a free string, as `RERUN_WORK`. */
export const RERUN_REJECTED_WORK = 'RERUN_REJECTED_WORK';

/**
 * ⭐ D71 — THE RECORDED RESULTS A RE-RUN CARRIES (the lead's): neither MET nor NOT_APPLICABLE. ⛔ A criterion answered NOT_APPLICABLE is no
 * finding, and one answered MET was met.
 */
const CARRIED_RESULTS: ReadonlySet<string> = new Set(['NOT_MET', 'PARTIALLY_MET', 'UNABLE_TO_DETERMINE']);

/** ⭐ D71 — what the page offers a unit its declared reviews rejected, and what its re-run carries. */
export interface RejectedRerunOffer {
	/** The governing declared policies whose latest verdict over the unit is REJECTED, in the selection's order. */
	readonly rejected: readonly LatestDeclaredVerdict[];
	/**
	 * Each rejecting verdict's carried criteria (`CARRIED_RESULTS`), policy by policy in the selection's order and each policy's criteria in
	 * its own order: coded by the criterion's id, its statement the verdict's recorded rationale for it (the lead's).
	 */
	readonly findings: readonly { readonly code: string; readonly statement: string }[];
	/** The rejecting verdicts' observations — what the person's Decision considered (RD4). */
	readonly consideredObservationIds: readonly string[];
	/** The unit's ACTIVE plans: the one the new plan supersedes (RD5's edge; one plan per unit may be ACTIVE). */
	readonly activePlanIds: readonly string[];
}

/** One criterion's last recorded result on `assessmentId` (`AssuranceCriterionEvaluated`), by its id: its result and its rationale. */
function recordedResultsOf(engine: EngineHandle, assessmentId: string): ReadonlyMap<string, { readonly result: string; readonly rationale: string }> {
	const results = new Map<string, { readonly result: string; readonly rationale: string }>();
	for (const e of engine.readAllEvents()) {
		if (e.eventType !== 'AssuranceCriterionEvaluated' || e.aggregateId !== assessmentId) continue;
		const p = (e.payload ?? {}) as { criterionId?: unknown; result?: unknown; rationale?: unknown };
		if (typeof p.criterionId !== 'string') continue;
		results.set(p.criterionId, {
			result: typeof p.result === 'string' ? p.result : '',
			rationale: typeof p.rationale === 'string' ? p.rationale : ''
		});
	}
	return results;
}

/**
 * ⭐⭐ D71 — WHETHER A PERSON MAY RE-RUN THE WORK OF `pwuId` WITH ITS DECLARED REVIEWS' FINDINGS, AND WHAT THE RE-RUN CARRIES: read from the
 * record. ⛔ Refused, with why, unless the unit is UNDER_ASSURANCE with its execution SUCCEEDED and its assurance REJECTED — the state a
 * declared REJECTED leaves it in at its sign-off (`declaredHop`) — and at least one governing declared policy's latest verdict over it is
 * REJECTED: its assurance was concluded REJECTED by its declared policies' verdicts. A unit rejected otherwise (the operator's blocking
 * finding) is not offered it.
 */
export function rejectedRerunOffer(engine: EngineHandle, pwuId: string): RejectedRerunOffer | { readonly refusedBecause: string } {
	const unit = engine.loadObject(pwuId)?.state as
		| { workLifecycleState?: unknown; executionState?: unknown; assuranceState?: unknown }
		| undefined;
	if (unit?.workLifecycleState !== 'UNDER_ASSURANCE' || unit.executionState !== 'SUCCEEDED' || unit.assuranceState !== 'REJECTED')
		return {
			refusedBecause:
				`the unit is ${String(unit?.workLifecycleState ?? 'unknown')} with its execution ${String(unit?.executionState ?? 'unknown')} ` +
				`and its assurance ${String(unit?.assuranceState ?? 'unknown')}; only a unit its declared reviews rejected at its sign-off ` +
				'(UNDER_ASSURANCE, SUCCEEDED, REJECTED) may have its work re-run with their findings (REG-D-163 (2))'
		};
	// ⚠ THE BUILDER'S READING, named: only a unit a model does the work of has work to re-run — the act runs the step as a work re-run does
	// (D71), and an operator's unit (a root or a composite whose discharge is HUMAN) has no model step to run again. Offered there, the act
	// would be pressed only to be refused — and the lane would count a whole press of reviewer calls for nothing.
	const typeId = (engine.loadObject(pwuId)?.state as { pwuTypeId?: unknown } | undefined)?.pwuTypeId;
	const discharge =
		typeof typeId === 'string' ? (engine.loadObject(typeId)?.state as { workDischarge?: unknown } | undefined)?.workDischarge : undefined;
	if (discharge !== 'MODEL')
		return {
			refusedBecause:
				`its type does not say a model does its work (its work discharge is ${String(discharge ?? 'not stated')}), and only a unit a ` +
				'model does the work of has work to re-run with its declared reviews’ findings (REG-D-163 (2))'
		};
	const { policies } = governingDeclaredPolicies(engine, pwuId);
	const latest = latestDeclaredVerdicts(
		engine,
		pwuId,
		policies.map((p) => p.policyId)
	);
	const rejecting = policies.filter((p) => latest.get(p.policyId)?.state === 'REJECTED');
	if (rejecting.length === 0)
		return {
			refusedBecause:
				'no governing declared policy of this unit holds a REJECTED verdict over it, so its assurance was not rejected by its declared ' +
				'reviews at its sign-off, and nothing here may be re-run with their findings (REG-D-163 (2))'
		};
	const rejected = rejecting.map((p) => latest.get(p.policyId)!);
	const findings = rejecting.flatMap((p) => {
		const recorded = recordedResultsOf(engine, latest.get(p.policyId)!.assessmentId);
		return p.criteria.flatMap((c) => {
			const r = recorded.get(c.id);
			if (r === undefined || !CARRIED_RESULTS.has(r.result)) return [];
			return [
				{
					code: c.id,
					// ⚠ The builder's reading, named: a criterion recorded with no rationale is carried with its result instead.
					statement: r.rationale.trim() === '' ? `Criterion ${c.id} was answered ${r.result}, with no rationale recorded.` : r.rationale
				}
			];
		});
	});
	const verdictIds = new Set(rejected.map((v) => v.assessmentId));
	return {
		rejected,
		findings,
		consideredObservationIds: listByType(engine, 'ASSURANCE_OBSERVATION')
			.filter((o) => verdictIds.has(String((o.state.assessmentId ?? '') as string)))
			.map((o) => o.id),
		activePlanIds: listExecutionPlans(engine)
			.filter((p) => p.state.workUnitId === pwuId && p.state.status === 'ACTIVE')
			.map((p) => p.id)
	};
}
