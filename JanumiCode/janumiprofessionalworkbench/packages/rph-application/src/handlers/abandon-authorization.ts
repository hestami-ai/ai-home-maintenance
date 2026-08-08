// ABANDONMENT IS A GOVERNANCE ACT, AND UNTIL THIS MODULE ANY CONTROLLER COULD PERFORM IT.
//
// ── THE CANON, BYTE-EXACT ────────────────────────────────────────────────────────────────────────────────────
// JPWB-DOC-001 §5.2 (L168): *"**Governance is an authority function outside the six disciplines.** It alone
// authorizes waiver, risk acceptance, rejection or abandonment of governed work, and promotion. No discipline
// may absorb it."*
//
// All seventeen `-> ABANDONED` arrows on `PWU.workLifecycleState` already declared the guard *"Authorized
// decision (Decision.decisionType=ABANDON)"* and named the trigger *"Authorized abandonment (PwuAbandoned)"*.
// Nothing evaluated either. `changePwuState` ran three "may not be asserted" guards — disposition, baselining,
// execution success — and abandonment was not among them, so a PWU could be closed with `reasonCode: 'fixture'`
// and an empty `supportingObjectIds`. A shipped test did exactly that and was ACCEPTED (REG-F-070).
//
// ── WHY A SEPARATE MODULE, AND WHY SEVEN CHECKS RATHER THAN ONE PREDICATE ────────────────────────────────────
// This mirrors `skip-authorization.ts`, which resolves the §21.1 skip authorization in six ordered checks and
// refuses each with its own sentence. That shape exists because its predecessor was `!!p.waiverOrRevisionId` —
// a governed act satisfied by ANY NON-EMPTY STRING, so `'x'` retired a mandatory step. Ordered checks with
// distinct reasons are what make the difference between "rejected" and "rejected BECAUSE", and the reason is
// what a caller needs to fix it.
//
// ⚠ THE VERSION CONJUNCT IS THE ONE I WOULD HAVE OMITTED, AND CANON PUTS IT BEYOND ARGUMENT.
// JPWB-DOC-003 §8.7 ASR-15 (L307): *"Every material Decision binds exact subjects and semantic versions,
// decision type and selected option … Authority is checked *before* effect. **A decision approving version n
// never authorizes version n+1.** … An approval whose actor, subject, subject version, type, and time cannot be
// identified is not authority — it is provenance at best."* Its **WHY** (L308) settles the design question
// rather than merely permitting the check: *"authority that floats across versions, or that rewrites the record
// it overrides, is indistinguishable from no governance at all."* A subject-scope check without a version bind
// would let a decision taken against version 2 close version 7 — the exact float that sentence names.
//
// The fail-closed default is not this module's invention either. JPWB-CON-000 AX-2 (L73): *"approval and
// exception authority default to denied; no scenario, agent, validator, or registry grants itself authority."*
import { DecisionObjectSchema } from '@janumipwb/rph-contracts';
import type { HandlerContext } from './kit.js';

export interface AbandonAuthorizationQuery {
	/** The PWU being closed. */
	readonly pwuId: string;
	/** The id offered as the authorization — one entry of `supportingObjectIds`. */
	readonly authorizationId: string;
	/** The PWU's CURRENT semantic version, which the decision must bind (ASR-15). */
	readonly pwuSemanticVersion: number;
}

export type AbandonAuthorizationVerdict =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: string };

/**
 * Resolve one cited id to an authorization for abandoning `pwuId`, or say precisely why it is not one.
 *
 * Ordered so the FIRST failure is the most fundamental: a dangling id is a different mistake from a decision of
 * the wrong kind, which is a different mistake from a real ABANDON decision about somebody else's work.
 */
export function resolveAbandonAuthorization(
	ctx: HandlerContext,
	query: AbandonAuthorizationQuery
): AbandonAuthorizationVerdict {
	// 1. IT MUST EXIST. A dangling id is the cheapest possible forgery.
	const stored = ctx.store.loadObject(query.authorizationId);
	if (!stored) return { ok: false, reason: `${query.authorizationId} names no recorded object` };

	// 2. IT MUST BE A DECISION — the object kind that CARRIES governance authority. JPWB-DOC-003 §4 defines a
	//    Decision as an "Authorized selection or disposition binding exact subject versions … and authority
	//    proof". Naming an Artifact or a PWU is a category error, not a scope failure, and is told so.
	if (stored.objectType !== 'DECISION')
		return {
			ok: false,
			reason: `${query.authorizationId} is a ${stored.objectType}, not a DECISION — only a governed decision authorizes abandonment (JPWB-DOC-001 §5.2)`
		};

	// 3. It must PARSE as one. An object typed DECISION whose state is not a Decision cannot have its authority
	//    established, and guessing at the fields would be the field-name-inference defect this repo has recorded.
	const parsed = DecisionObjectSchema.safeParse(stored.state);
	if (!parsed.success)
		return {
			ok: false,
			reason: `decision ${query.authorizationId} does not parse as a Decision, so its authority cannot be established`
		};
	const decision = parsed.data;

	// 4. THE RIGHT KIND. ⚠ `ABANDON` EXACTLY — a generic `APPROVAL` is NOT accepted, and that is a deliberate
	//    divergence from `canPromoteBaseline`, which accepts `PROMOTE_BASELINE || APPROVAL`. No canon text
	//    licenses one decisionType standing in for another; AX-2 says authority "defaults to denied"; and
	//    `resolveSkipAuthorization` already refuses the same substitution in this repository, in terms —
	//    *"an APPROVAL or a PROMOTE_BASELINE authorizes something else entirely"*. Inheriting the promotion
	//    gate's generosity would spread an unratified permission rather than an enforced rule. The disagreement
	//    between the two existing gates is registered rather than silently resolved here (REG-F-076).
	if (decision.decisionType !== 'ABANDON')
		return {
			ok: false,
			reason: `decision ${query.authorizationId} is a ${decision.decisionType}; abandoning governed work requires decisionType=ABANDON (a general approval authorizes something else)`
		};

	// 5. EFFECTIVE, not merely proposed. ASR-15: "no effective governance decision exists until an authorized
	//    actor decides", and "Authority is checked BEFORE effect".
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

	// 7. VERSION. ASR-15: "A decision approving version n never authorizes version n+1." An absent binding is a
	//    FAILURE, not a pass — an approval whose subject version "cannot be identified is not authority".
	const bound = decision.subjectSemanticVersions[query.pwuId];
	if (bound !== query.pwuSemanticVersion)
		return {
			ok: false,
			reason: `decision ${query.authorizationId} binds ${query.pwuId} at semantic version ${bound ?? 'nothing'}, but the PWU is at ${query.pwuSemanticVersion} — a decision approving version n never authorizes version n+1 (ASR-15)`
		};

	return { ok: true };
}
