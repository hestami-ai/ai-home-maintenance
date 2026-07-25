// §21.1 skip authorization — RESOLVED, not assumed (JAN-EXECREM WP-12 / F-30).
//
// THE DEFECT. `canSkipStep` is the ratified kernel and it is correct; the CALLER supplied
// `hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId`. So §21.1's "an authorized plan revision or waiver" was
// satisfied by ANY NON-EMPTY STRING. `'x'` retired a mandatory step. The fail-closed lens that reviewed this code
// verified the OTHER input (`mandatory ?? true`) carefully and never asked what the second one resolved to — a
// truthiness check standing in for a governed act, which is the same shape as the `!!waiverOrRevisionId` family
// this programme has been removing everywhere else.
//
// WHY A NEW, EXECUTION-SCOPED FIELD RATHER THAN REUSING `WaiverDetail`. `WaiverDetail` is the ASSURANCE plane —
// `waivedPolicyId`, `waivedCriterionId`, `waivedFindingIds`. Those are meaningless for a step skip, and routing a
// skip through them would let a FLOOR waiver (an assurance-plane object) authorize an EXECUTION-plane act: a
// genuine INV-5 boundary crossing and a real bleeding hazard. A distinct optional field keeps the two planes'
// authorizations distinct BY CONSTRUCTION rather than by discipline.
//
// WHY PLAN-SCOPED SUBJECT PLUS AN EXPLICIT STEP LIST. An ExecutionStep is not a Professional Work Object — no
// envelope, no registry row, no semantic version (the argument `stepResultSubjects` already makes) — so the finest
// governed subject a Decision can NAME is the plan. The step list inside the authorization supplies the
// step-exactness RPH-GOV-005 demands ("a waiver does not bleed to another criterion, another object, or another
// version") without inventing a version for a non-object. Without it, ONE decision would retire EVERY mandatory
// step in the plan — exactly the unscoped waiver REG-Q-012 forbids.
import { DecisionObjectSchema } from '@janumipwb/rph-contracts';
import type { HandlerContext } from './kit.js';

/** The two decision kinds §21.1 names: an authorized plan REVISION, or a WAIVER. */
const AUTHORIZING_DECISION_TYPES = new Set(['REPLAN', 'WAIVER']);

export interface SkipAuthorizationQuery {
	readonly planId: string;
	readonly stepId: string;
	readonly authorizationId: string;
	/** The COMMAND's `issuedAt` — never a wall clock, so expiry replays deterministically (§10.2). */
	readonly now: string;
}

export type SkipAuthorizationVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Does `authorizationId` resolve to a governed authorization for skipping THIS step of THIS plan?
 *
 * Six ordered checks, each with its own message so a caller can see WHY an authorization was insufficient — the
 * same reason `effectiveFloorWaivers` returns views rather than a boolean. Ordering is category-error-first
 * (JAN-CMDPRE DWP-0's discipline): a mis-aimed id is told it named the wrong KIND of thing before it is told
 * anything about scope.
 *
 * NOTE ON REACHABILITY (the design's CONFLICT-11). `approveDecision` refuses `decisionType === 'WAIVER'` outright
 * — a waiver becomes EFFECTIVE only via `GrantWaiver`, which mandates assurance-plane fields. So REPLAN is the
 * kind an execution-plane caller can actually drive to EFFECTIVE today, and it is what the kill tests use. WAIVER
 * is still ACCEPTED here because §21.1 names it and a granted waiver carrying an execution scope is legitimate;
 * refusing it would be this module inventing a narrowing the rule does not state.
 */
export function resolveSkipAuthorization(
	ctx: HandlerContext,
	query: SkipAuthorizationQuery
): SkipAuthorizationVerdict {
	const stored = ctx.store.loadObject(query.authorizationId);
	// 1. It must exist. A dangling id is the cheapest possible forgery and was previously the winning one.
	if (!stored)
		return {
			ok: false,
			reason: `waiverOrRevisionId ${query.authorizationId} names no recorded object`
		};
	// 2. It must be a DECISION — the object kind that CARRIES governance authority. Naming an Artifact or a PWU is
	//    a category error, not a scope failure, and is told so.
	if (stored.objectType !== 'DECISION')
		return {
			ok: false,
			reason: `waiverOrRevisionId ${query.authorizationId} is a ${stored.objectType}, not a DECISION — only a governed decision authorizes a mandatory skip (§21.1)`
		};
	const parsed = DecisionObjectSchema.safeParse(stored.state);
	if (!parsed.success)
		return {
			ok: false,
			reason: `decision ${query.authorizationId} does not parse as a Decision, so its authority cannot be established`
		};
	const decision = parsed.data;
	// 3. The right KIND of decision. §21.1 names an authorized plan revision (REPLAN) or a waiver (WAIVER); an
	//    APPROVAL or a PROMOTE_BASELINE authorizes something else entirely.
	if (!AUTHORIZING_DECISION_TYPES.has(decision.decisionType))
		return {
			ok: false,
			reason: `decision ${query.authorizationId} is a ${decision.decisionType}; §21.1 requires an authorized plan revision (REPLAN) or a waiver (WAIVER)`
		};
	// 4. EFFECTIVE, not merely proposed. A decision somebody drafted is not a decision anybody made.
	if (decision.status !== 'EFFECTIVE')
		return {
			ok: false,
			reason: `decision ${query.authorizationId} is ${decision.status}, not EFFECTIVE — a proposed or revoked decision authorizes nothing`
		};
	// 5. SCOPE. The decision must name this plan as a subject AND its execution-skip detail must name this plan and
	//    THIS step. An absent detail authorizes NO skip — the fail-closed default, mirroring how the floor gate
	//    treats a WAIVER Decision carrying no `waiver` detail.
	const auth = decision.executionSkipAuthorization;
	if (!auth)
		return {
			ok: false,
			reason: `decision ${query.authorizationId} carries no executionSkipAuthorization, so it authorizes no step skip (an assurance-plane waiver does not reach the execution plane — INV-5)`
		};
	if (!decision.subjectObjectIds.includes(query.planId))
		return {
			ok: false,
			reason: `decision ${query.authorizationId} does not name plan ${query.planId} among its subjectObjectIds`
		};
	if (auth.executionPlanId !== query.planId)
		return {
			ok: false,
			reason: `decision ${query.authorizationId} authorizes skips on plan ${auth.executionPlanId}, not ${query.planId}`
		};
	if (!auth.executionStepIds.includes(query.stepId))
		return {
			ok: false,
			reason: `decision ${query.authorizationId} authorizes skipping [${auth.executionStepIds.join(', ') || 'no steps'}], which does not include ${query.stepId} — an authorization does not bleed to another step (RPH-GOV-005)`
		};
	// 6. EXPIRY, against the command's own issuedAt (§10.2 replay determinism), never a wall clock.
	if (auth.expiresAt !== undefined && auth.expiresAt <= query.now)
		return {
			ok: false,
			reason: `decision ${query.authorizationId} expired at ${auth.expiresAt} (command issued ${query.now})`
		};
	return { ok: true };
}
