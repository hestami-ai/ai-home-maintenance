// ⭐⭐ `JAN-EXEC` Phase 7, package L16 — design D71 (`REG-D-163` (2); `REG-F-640`; `REG-Q-034`) — WHAT AUTHORIZES CANON'S ONE WAY BACK, OUT OF
// A REJECTED DECLARED ASSURANCE BACK TO PLANNING.
//
// The sponsor ratified one move into canon (`REG-D-163` (2)): `UNDER_ASSURANCE` → `PLANNED` on the work lifecycle, `SUCCEEDED` → `PLANNED` on
// the execution axis, `REJECTED` → `UNASSESSED` on the assurance axis, taken together. Its guard is the KERNEL's, never the page's alone: the
// unit's assurance REJECTED, concluded by its declared policies' verdicts at its sign-off, and a person's Decision (`REPLAN`) naming those
// verdicts (design D71, "The canon change"). ⭑ DERIVE-ON-READ, as `waiver-authorization.ts`: the caller names WHICH Decision authorizes it;
// this reads the Decision's type, status, authority, subjects and version pin, and the verdicts from the record — the caller asserts neither.
import { DecisionObjectSchema } from '@janumipwb/rph-contracts';
import { declaredAssurancePolicyIds } from '@janumipwb/rph-domain';
import { latestAssessmentByPolicy } from './assessment-index.js';
import { declaredPolicyVerdicts, type DeclaredPolicyVerdict } from './declared-assurance.js';
import type { HandlerContext } from './kit.js';
import { policyGovernance } from './policy-governs.js';

export interface ReworkAuthorizationQuery {
	/** the PWU that would go back to planning */
	readonly pwuId: string;
	/** the PWU's CURRENT semanticVersion — the verdicts and the Decision must be bound to this one (ASR-15) */
	readonly pwuSemanticVersion: number;
	/** what the command cites (`supportingObjectIds`): the Decision is found among them */
	readonly cited: readonly string[];
}

export type ReworkAuthorization = { ok: true } | { ok: false; reason: string };

/**
 * ⭐ THE UNIT'S DECLARED POLICIES WHOSE LATEST VERDICT OVER IT, AT ITS CURRENT VERSION, IS REJECTED — read as `RPH-PWU-007`'s fold reads them
 * (`declaredPolicyVerdicts` over `latestAssessmentByPolicy`, the unit's own declared policies joined with its type's), so the guard and the
 * satisfaction guard beside it agree on which verdict speaks for each policy. Empty when no declared review concluded REJECTED.
 */
export function rejectedDeclaredVerdicts(
	ctx: HandlerContext,
	pwuId: string,
	pwuSemanticVersion: number
): readonly DeclaredPolicyVerdict[] {
	const pwu = ctx.store.loadObject(pwuId)?.state as { assurancePolicyIds?: string[]; pwuTypeId?: string } | undefined;
	const pwuType = pwu?.pwuTypeId
		? (ctx.store.loadObject(pwu.pwuTypeId)?.state as { requiredAssurancePolicyIds?: string[] } | undefined)
		: undefined;
	return declaredPolicyVerdicts(
		declaredAssurancePolicyIds(pwu, pwuType),
		latestAssessmentByPolicy(ctx, pwuId),
		pwuSemanticVersion,
		(policyId) => policyGovernance(ctx, policyId, pwuId) === 'GOVERNS'
	).filter((v) => v.disposition === 'REJECTED');
}

/** Why `decisionId` does not authorize the move back, or null when it does. */
function decisionRefusal(
	ctx: HandlerContext,
	decisionId: string,
	query: ReworkAuthorizationQuery,
	rejected: readonly DeclaredPolicyVerdict[]
): string | null {
	const stored = ctx.store.loadObject(decisionId);
	if (!stored) return 'names no recorded object';
	if (stored.objectType !== 'DECISION') return `is a ${stored.objectType}, not a DECISION`;
	const parsed = DecisionObjectSchema.safeParse(stored.state);
	if (!parsed.success) return `does not parse as a DECISION: ${parsed.error.message}`;
	const decision = parsed.data;
	if (decision.decisionType !== 'REPLAN') return `is a ${decision.decisionType} decision, not a REPLAN`;
	// ⭑ "a person's Decision" (D71): an EFFECTIVE one is a person's by the kernel's own rule — `approveDecision` makes a Decision effective
	// only under a HUMAN recorded authority (`authorizeDecisionEffective`), and `proposeDecision` records only the issuer's — so EFFECTIVE is
	// asked, and no second check of the authority is written (one would be a mutant no arrangement could kill; the builder's reading).
	if (decision.status !== 'EFFECTIVE') return `is ${decision.status}, not EFFECTIVE: a proposed Decision is a request, not an authority`;
	// The schema requires both fields (`DecisionObjectSchema`: `subjectObjectIds`, `subjectSemanticVersions`), and the Decision is read only
	// through it, so each is read as given: a default here would be a branch no parsed Decision can take (package L16's facts §8.2).
	const subjects = decision.subjectObjectIds;
	if (!subjects.includes(query.pwuId)) return `does not name ${query.pwuId} among its subjects`;
	const unnamed = rejected.filter((v) => v.assessmentId === undefined || !subjects.includes(v.assessmentId));
	if (unnamed.length > 0)
		return `does not name the REJECTED verdict${unnamed.length === 1 ? '' : 's'} ${unnamed.map((v) => `${v.policyId}'s ${v.assessmentId ?? '(none)'}`).join(', ')} among its subjects`;
	const pinned = decision.subjectSemanticVersions[query.pwuId];
	if (pinned !== query.pwuSemanticVersion)
		return `pins ${query.pwuId} at semanticVersion ${String(pinned)}, but the PWU is at ${query.pwuSemanticVersion} (ASR-15)`;
	return null;
}

/**
 * ⭐⭐ D71 — DOES WHAT THE COMMAND CITES AUTHORIZE TAKING `pwuId` BACK TO PLANNING? ⛔ FAIL CLOSED, in two conditions, both the kernel's:
 *   1. its assurance REJECTED was concluded by its declared policies' verdicts — at least one declared policy's latest verdict over it, at its
 *      current version, is REJECTED (`rejectedDeclaredVerdicts`); a unit rejected otherwise (the operator's blocking finding under the demo
 *      policy) has none, and is refused;
 *   2. it cites a person's EFFECTIVE `REPLAN` Decision naming the unit and EVERY one of those verdicts, pinned at the unit's version.
 */
export function resolveReworkAuthorization(ctx: HandlerContext, query: ReworkAuthorizationQuery): ReworkAuthorization {
	const rejected = rejectedDeclaredVerdicts(ctx, query.pwuId, query.pwuSemanticVersion);
	if (rejected.length === 0)
		return {
			ok: false,
			reason:
				`no declared policy of ${query.pwuId} holds a REJECTED verdict over it at its current version, so its assurance was not ` +
				"concluded REJECTED by its declared policies' verdicts at its sign-off"
		};
	const why: string[] = [];
	for (const cited of query.cited) {
		const refusal = decisionRefusal(ctx, cited, query, rejected);
		if (refusal === null) return { ok: true };
		why.push(`${cited} ${refusal}`);
	}
	return { ok: false, reason: `no cited Decision authorizes it — ${why.join('; ') || 'nothing is cited'}` };
}
