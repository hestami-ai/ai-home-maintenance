// DOES THIS POLICY GOVERN THIS SUBJECT — the §5.1 determination, in ONE place, for the gates that ask it.
//
// ── ⭑ WHY IT IS A MODULE AND NOT A THIRD SPELLING ───────────────────────────────────────────────────────────
//
// `RequestAssuranceAssessment` has asked this since `REG-F-029`, inline. `selectGoverningPolicies` (rph-engine)
// asks it for the drive. `JAN-EXEC` Phase 6 gives it a THIRD reader: the guard that refuses a satisfaction
// claim must know which declared policies it may DEMAND an assessment from, because demanding one from a policy
// that does not govern is a refusal with no route forward.
//
// ⛔ THREE SPELLINGS WOULD BE THE DRIFT THIS REPOSITORY KEEPS FINDING, and the union beside it records the same
// argument in the same words: *"a second copy would be the drift … the drive and the gate would answer 'which
// policies are required here' differently, and the disagreement would present as a PWU that the seed can
// satisfy and the engine cannot (or worse, the reverse)."* This is that sentence applied to the OTHER half of
// `DECLARED ∩ DETERMINED`.
//
// ⚠ IT LIVES IN `rph-application` AND NOT IN THE KERNEL, DELIBERATELY. The determination needs the STORE (it
// loads the policy and the subject) and the §18 expression evaluator, and `rph-domain` may import neither —
// which is why `policyApplicability` takes the evaluator as a parameter. The kernel keeps the RULE; this keeps
// the two reads and the injection.
//
// ── ⭑ THE THREE ANSWERS, AND WHY "I CANNOT TELL" IS NOT "NO" ────────────────────────────────────────────────
//
// `GOVERNS` / `DOES_NOT_GOVERN` / `UNDECIDABLE`, and the third is not folded into either. The extracted logic
// already had this distinction and stated why, twice:
//   · *"IT REFUSES ONLY A DECIDED NEGATIVE. `applicabilityPermitsAssessment` admits every §5.2 outcome except
//     NOT_APPLICABLE — including REQUIRES_HUMAN_DETERMINATION … Blocking on a condition nobody can evaluate
//     would stop real work on the strength of not understanding it."*
//   · *"AND AN UNRESOLVABLE SUBJECT IS NOT A NEGATIVE … a decided negative manufactured from having no
//     information, at the call site of the kernel built to prevent exactly that."*
// ⛔ Both readers need that distinction and they need it in OPPOSITE directions, which is why it is returned
// rather than collapsed: the assessment gate lets an UNDECIDABLE policy proceed, and the satisfaction gate must
// decide for itself whether an undecidable policy is DEMANDED. A boolean would have made that choice for both.
import {
	applicabilityPermitsAssessment,
	applicabilitySubjectFrom,
	policyApplicability
} from '@janumipwb/rph-domain';
import { evaluateApplicability } from '@janumipwb/rph-assurance';
import type { HandlerContext } from './kit.js';

export type PolicyGovernance =
	/** The policy exists, is ACTIVE where the caller required it, and §5.1 admits this subject. */
	| 'GOVERNS'
	/** A DECIDED negative — §5.1 yields NOT_APPLICABLE for this subject. */
	| 'DOES_NOT_GOVERN'
	/** The policy object is absent, or not ACTIVE. It cannot govern; it also cannot be asked. */
	| 'NOT_AVAILABLE'
	/** Nothing here could decide — the subject would not resolve, or the rule needs a human. */
	| 'UNDECIDABLE';

/** The §5.1 outcome for one policy over one subject. Pure w.r.t. the store: it reads and writes nothing. */
export function policyGovernance(
	ctx: HandlerContext,
	policyId: string,
	subjectId: string
): PolicyGovernance {
	const policy = ctx.store.loadObject(policyId)?.state as
		| {
				status?: string;
				applicability?: unknown;
				applicableObjectTypes?: string[];
		  }
		| undefined;
	// ⛔ ABSENT AND NOT-ACTIVE ARE ONE ANSWER AND IT IS NOT `DOES_NOT_GOVERN`. A SUSPENDED policy has not been
	// determined inapplicable to anything — it has been taken out of service, which is a different fact with a
	// different remedy. Collapsing them would tell a reader the policy examined this subject and declined it.
	if (!policy) return 'NOT_AVAILABLE';
	if (policy.status !== 'ACTIVE') return 'NOT_AVAILABLE';
	// ⭑ ONE PROJECTOR (`JAN-APPLSUBJ`) — the projection lives beside the type in the kernel because two call
	// sites independently built it inline and BOTH dropped `riskProfile`, so a rule gated `RISK_AT_LEAST` read
	// `false` for every subject.
	const subject = applicabilitySubjectFrom(
		ctx.store.loadObject(subjectId)?.state as Record<string, unknown> | undefined
	);
	if (!subject) return 'UNDECIDABLE';
	const outcome = policyApplicability(
		// A policy created before `applicability` existed carries only `applicableObjectTypes`; deriving the rule
		// from it is what lets one determination read both shapes.
		policy.applicability ?? { objectTypeConditions: policy.applicableObjectTypes },
		subject,
		// The DOC-007 §18 evaluator, injected (rph-domain cannot import rph-assurance — cycle). Passing it is what
		// makes an `expression` DECIDE rather than come back undecidable; see `policyApplicability`'s note.
		(expr, subj) => evaluateApplicability(expr as never, subj)
	);
	if (outcome === 'NOT_APPLICABLE') return 'DOES_NOT_GOVERN';
	// ⚠ EVERYTHING ELSE `applicabilityPermitsAssessment` ADMITS IS `GOVERNS` EXCEPT THE ONE THAT MEANS "ASK A
	// HUMAN". The assessment gate treats those two the same because both PERMIT an assessment; a gate deciding
	// whether to DEMAND one must tell them apart, because demanding a verdict from a rule nobody could evaluate
	// is the over-refusal the extracted comment warns about.
	if (outcome === 'REQUIRES_HUMAN_DETERMINATION') return 'UNDECIDABLE';
	return applicabilityPermitsAssessment(outcome) ? 'GOVERNS' : 'UNDECIDABLE';
}
