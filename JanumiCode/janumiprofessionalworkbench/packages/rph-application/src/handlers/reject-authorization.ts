// REJECTING GOVERNED WORK IS A GOVERNANCE ACT, AND THE CORPUS SAYS SO IN THE SENTENCE THAT ANTICIPATES THE
// OBJECTION.
//
// ── WHY THIS IS NOT "JUST THE ASSESSMENT DISPOSITION" ────────────────────────────────────────────────────────
// The tempting reading is that `workLifecycleState -> REJECTED` merely mirrors an assurance verdict, so the
// authority question was settled upstream at the assessment. **The source of JPWB-DOC-001 §5.2 rules that out in
// one breath.** DOC-001's own provenance file records *"Governance outside the six: Guide L336"*, and Guide L336
// reads, byte-exact:
//
//   *"Assurance may record a `REJECTED` Assessment disposition under policy; Governance is an authority function
//    outside the six engineering disciplines and alone authorizes waiver, risk acceptance, rejection or
//    abandonment of governed work, and promotion."*
//
// One sentence, both clauses: the assessment disposition is carved OUT of the reserved act. DOC-002 states the
// same split operationally — *"Assurance evaluates; governance decides. The two vocabularies never substitute for
// each other."* And the two axes are genuinely uncoupled at runtime: the work axis could be driven to REJECTED
// while the assurance axis sat at ASSESSING, with no assessment object in existence.
//
// ⚠ TWO LIMBS OF THE ORIGINAL FINDING ARE WITHDRAWN AS EVIDENCE, because they were mine and they were weak.
//   (1) *"the arrow declares no guard, unlike the 17 ABANDONED arrows"* — core-model §8.2 has THREE columns
//       (Current | Trigger | Next) and no conditions column at all, so no §8.2 row could carry a guard. Every
//       guard on a §8.2-sourced arrow was reconciler-supplied. Guardlessness here is a reconciliation gap, not a
//       canonical statement — and under the opposite reading abandonment would need no authority either.
//   (2) *"the payload requires blockingObservationIds and no decision id"* — `PwuRejectedPayloadSchema` and
//       `PwuAbandonedPayloadSchema` BOTH carry the byte-identical *"Do NOT treat this sourceSection as proof the
//       shape is ratified"*. Contrasting two same-day authored guesses proves nothing about either.
// Withdrawing them leaves the finding resting on ratified text alone, which is stronger than it was.
//
// ⚠ AND THE DECISION TYPE IS `REJECTION`, NOT `REJECT`. `DecisionTypeSchema` spells it `REJECTION`; `REJECT` is
// the ControlAction spelling from the §37 controller menu. A guard copied from `abandon-authorization.ts` and
// left on the action name would match no Decision that can exist and would deny everything, silently — a gate
// that refuses for the wrong reason is not a working gate.
import { DecisionObjectSchema } from '@janumipwb/rph-contracts';
import type { HandlerContext } from './kit.js';

export interface RejectAuthorizationQuery {
	/** The PWU being rejected. */
	readonly pwuId: string;
	/** The id offered as the authorization — one entry of `supportingObjectIds`. */
	readonly authorizationId: string;
	/** The PWU's CURRENT semantic version, which the decision must bind (ASR-15). */
	readonly pwuSemanticVersion: number;
}

export type RejectAuthorizationVerdict =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: string };

/**
 * Resolve one cited id to an authorization for rejecting `pwuId`, or say precisely why it is not one.
 *
 * Deliberately the same seven ordered checks as `resolveAbandonAuthorization`, differing only in the decision
 * type. The two acts sit in the same §5.2 sentence; giving them different authority tests would be inventing a
 * distinction the clause that reserves them does not make.
 */
export function resolveRejectAuthorization(
	ctx: HandlerContext,
	query: RejectAuthorizationQuery
): RejectAuthorizationVerdict {
	// 1. IT MUST EXIST.
	const stored = ctx.store.loadObject(query.authorizationId);
	if (!stored) return { ok: false, reason: `${query.authorizationId} names no recorded object` };

	// 2. IT MUST BE A DECISION — the object kind that carries governance authority.
	if (stored.objectType !== 'DECISION')
		return {
			ok: false,
			reason: `${query.authorizationId} is a ${stored.objectType}, not a DECISION — only a governed decision authorizes rejection of governed work (JPWB-DOC-001 §5.2)`
		};

	// 3. It must PARSE as one.
	const parsed = DecisionObjectSchema.safeParse(stored.state);
	if (!parsed.success)
		return {
			ok: false,
			reason: `decision ${query.authorizationId} does not parse as a Decision, so its authority cannot be established`
		};
	const decision = parsed.data;

	// 4. THE RIGHT KIND — `REJECTION` exactly. A generic `APPROVAL` is refused, as in the abandonment gate and in
	//    `resolveSkipAuthorization`; the disagreement with `canPromoteBaseline` is registered as REG-F-076.
	if (decision.decisionType !== 'REJECTION')
		return {
			ok: false,
			reason: `decision ${query.authorizationId} is a ${decision.decisionType}; rejecting governed work requires decisionType=REJECTION (a general approval authorizes something else)`
		};

	// 5. EFFECTIVE, not merely proposed. ASR-15: "Authority is checked BEFORE effect."
	if (decision.status !== 'EFFECTIVE')
		return {
			ok: false,
			reason: `decision ${query.authorizationId} is ${decision.status}, not EFFECTIVE — a proposed or revoked decision authorizes nothing (ASR-15)`
		};

	// 6. SCOPE. RPH-GOV-005: an authorization does not bleed to another object.
	if (!decision.subjectObjectIds.includes(query.pwuId))
		return {
			ok: false,
			reason: `decision ${query.authorizationId} does not name ${query.pwuId} among its subjectObjectIds — an authorization does not bleed to another object (RPH-GOV-005)`
		};

	// 7. VERSION. ASR-15: "A decision approving version n never authorizes version n+1." An absent binding FAILS.
	const bound = decision.subjectSemanticVersions[query.pwuId];
	if (bound !== query.pwuSemanticVersion)
		return {
			ok: false,
			reason: `decision ${query.authorizationId} binds ${query.pwuId} at semantic version ${bound ?? 'nothing'}, but the PWU is at ${query.pwuSemanticVersion} — a decision approving version n never authorizes version n+1 (ASR-15)`
		};

	return { ok: true };
}
