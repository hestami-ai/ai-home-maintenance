// ⭐⭐ THE SIGN-OFF ASSESSES WHAT THE PWU DECLARES — `JAN-EXEC` Phase 6b / `R22`, design §4.15.
//
// ── ⛔ WHAT THIS REPLACES, AND WHY IT WAS ONE BYPASS RATHER THAN TWO SHORTCUTS ────────────────────────────────
//
// `recordAssurance` opened ONE assessment under `DEMO_POLICY_ID` and completed it with `producer: evaluator` —
// the operator recorded as both the producer of the work and its assessor. The PWU it then claimed SATISFIED
// declares its PwuType's `requiredAssurancePolicyIds`, none of which is the demo policy, and every one of which
// demands a reviewer distinct from the producer. `demo-policy.ts` states the other half in its own words:
// independence NONE *"so `completeAssuranceAssessment` skips the independence check"*.
//
// ⚠ Declaring policies that require independence and assessing a DIFFERENT policy that requires none is not two
// shortcuts. It is one arrangement, and `RPH-PWU-007`'s §28.2 fold is what finally put both halves in the same
// sentence.
//
// ── ⭑ WHY THE SELECTION IS THE ENGINE'S AND NOT A LOCAL JOIN ─────────────────────────────────────────────────
//
// `selectGoverningPolicies` is `DECLARED ∩ DETERMINED`: the PWU's own `assurancePolicyIds` unioned with its
// PwuType's `requiredAssurancePolicyIds`, intersected with the policies that EXIST, are ACTIVE, and whose §5.1
// rule admits this subject. The kernel guard that refuses an unsupported satisfaction folds the SAME set. Two
// spellings of *"which policies must this PWU satisfy"* is precisely the drift that would let the surface
// satisfy a PWU the engine then refuses — or, worse, the reverse.
//
// ⛔ AND THE EXCLUSIONS ARE RETURNED RATHER THAN DISCARDED, because a declared policy that governs nothing is
// something the operator is entitled to see. `governing-policies.ts` made that argument first: *"a governance
// decision nobody can read is the shape half this register is about."*
//
// ── ⚠ WHAT THE DEMO'S REVIEWER HONESTLY IS, DISCLOSED IN THE RECORD ITSELF ────────────────────────────────────
//
// This reviewer does not evaluate each policy's criteria one by one; it records a demonstration sign-off, the
// same act the demo policy always recorded, now performed by the party the declared policies require and over
// the policies the PWU actually names. An assessment that overstated its own depth would be the fiction this
// surface has twice been caught in, so the shortfall is written into every verdict.
//
// ⛔ IN TWO FIELDS, AND THE SECOND ONE IS THE FINDING. §20 `limitations` is where this belongs — and it reaches
// NO READER. `completeAssuranceAssessment` reads nine ValidatorResult fields and `limitations` is not among
// them; the ratified `AssuranceAssessmentCompleted` payload is a `strictObject` that does not declare it; and
// no assessment object stores it. A field every caller fills and nothing reads is the *hollow governed layer*
// this repository keeps finding, and writing the disclosure THERE ALONE would have been a disclosure nobody
// could read — measured, not assumed, which is why it is also written to `residualUncertainty`, which the
// event DOES carry. Filed as design §4.15.7; not fixed here, because widening a ratified event payload is a
// governance act and not a rider on a demo fix.
import { driveAssessmentToAssessing, selectGoverningPolicies } from '@janumipwb/rph-engine';
import type { EngineHandle } from '@janumipwb/rph-engine';
import type { ActorReference } from '@janumipwb/rph-contracts';

/** The dispositions this reviewer can reach. Negative outcomes belong to `recordBlockingFinding`, which is a
 *  different act by a different route — a reviewer that could reject here would collapse the two. */
export type AssessmentDisposition = 'SATISFIED' | 'CONDITIONALLY_SATISFIED' | 'INCONCLUSIVE';

/** One dispatchable step, in the shape the surface's batch helpers already take. */
export type SignoffStep = [
	commandType: string,
	aggType: string,
	aggId: string,
	payload: unknown
];

export interface DeclaredSignoff {
	/** The governing declared policies, in selection order. EMPTY when the PWU declares nothing that governs. */
	readonly policyIds: readonly string[];
	/** The assessment minted for each policy, positionally aligned with `policyIds`. */
	readonly assessmentIds: readonly string[];
	/** Everything DECLARED that did not survive determination, each with the engine's own reason. */
	readonly excluded: ReadonlyArray<{ readonly policyId: string; readonly reason: string }>;
	/** The disposition reached for each policy, positionally aligned with `policyIds`. */
	readonly dispositions: readonly AssessmentDisposition[];
	/**
	 * ⭐ THE PWU's OWN ASSURANCE AXIS, FOLDED — the STRICTEST verdict, which is §28.2's rule and not a choice
	 * made here. `undefined` when nothing governs, so the caller's existing demo-policy path is untouched.
	 *
	 * ⛔ THE CONTROLLER MAY NOT ASSERT A STRONGER AXIS THAN ITS OWN VERDICTS SUPPORT, and `RPH-PWU-007` now
	 * refuses it if it tries. Folding here is not belt-and-braces — it is the surface asking the question the
	 * kernel will ask, so the operator gets a PWU in the state its assurance actually reached rather than a
	 * refusal they cannot act on.
	 */
	readonly foldedAssuranceState?: AssessmentDisposition;
	/** The reviewer's commands, in §30 order. Issued as ONE batch, by the reviewer's own session. */
	readonly steps: readonly SignoffStep[];
}

/**
 * ⚠ THE LIMITATION EVERY DEMO VERDICT CARRIES. `ValidatorResult.limitations` is a ratified §20 field and it is
 * the honest home for this: the reviewer is independent of the producer, which is what the policies demand and
 * what this phase delivers — and it did not walk the policy's criteria, which they also expect and this does
 * not supply. Saying so in the record costs nothing and is the difference between a demonstration and a claim.
 */
export const DEMO_REVIEW_LIMITATION =
	'Workbench demonstration review: the reviewer is independent of the producer (DOC-004 §39 invariant 8) ' +
	'but did not evaluate this policy criterion by criterion. The disposition records an independent sign-off, ' +
	'not a criteria-level evaluation.';

/** `validatorId` for the demo's independent review — distinct from `workbench.demo-signoff`, because it is a
 *  different act by a different party and a shared id would make the two indistinguishable in the record. */
export const DEMO_REVIEW_VALIDATOR_ID = 'workbench.independent-review';

/**
 * ⭐⭐ THE STRONGEST POSITIVE DISPOSITION THIS POLICY'S EVIDENCE SUPPORTS — not the one the caller would like.
 *
 * ⛔ THE DEMO HAS NO EVIDENCE FOR THESE POLICIES AND MUST NOT CERTIFY PAST THAT. Gate A refuses a positive
 * disposition whose own mandatory evidence is unmet — *"a positive disposition cannot stand with unmet
 * mandatory evidence (§10.3)"* — and its message names both remedies: submit the evidence, **or return a
 * non-satisfied disposition**. This surface has none to submit, so it takes the second.
 *
 * ⭑ THIS IS `earnAssurance`'s RULING, NOT A NEW ONE: *"A policy whose required evidence this undertaking cannot
 * supply does not get the caller's requested SATISFIED — it gets CONDITIONALLY_SATISFIED, which is what the
 * evidence actually supports. Gate A would refuse the stronger verdict anyway; asking for it and being refused,
 * or lowering it here, differ only in whether the drive tells the truth first."*
 *
 * ⚠ DERIVED FROM `requiredForDispositions`, NEVER FROM TODAY'S CATALOG. Every requirement the current ontology
 * declares happens to be `SATISFIED_ONLY`, so a two-valued rule would pass every test today and be wrong the
 * first time an `ALL` requirement is authored — at which point NO positive disposition stands and the honest
 * answer is INCONCLUSIVE. The predicate below is Gate A's, applied to an empty received-set.
 */
function supportedDisposition(engine: EngineHandle, policyId: string): AssessmentDisposition {
	const required = ((engine.loadObject(policyId)?.state as { requiredEvidence?: unknown } | undefined)
		?.requiredEvidence ?? []) as ReadonlyArray<{
		requiredForDispositions?: string;
		cardinality?: string;
	}>;
	// `ZERO_OR_MORE` demands no instance, so it gates nothing — the same exemption Gate A applies via
	// `demandsAnInstance`. Reproducing the exemption matters: without it the demo policy's own ZERO_OR_MORE
	// requirement would read as unmet and silently downgrade a verdict that Gate A would have admitted.
	const demanded = required.filter((r) => r?.cardinality !== 'ZERO_OR_MORE');
	const gates = (rfd: string | undefined, disposition: AssessmentDisposition): boolean =>
		rfd === 'ALL' ||
		rfd === 'CONDITIONAL_OR_SATISFIED' ||
		(rfd === 'SATISFIED_ONLY' && disposition === 'SATISFIED');
	if (!demanded.some((r) => gates(r?.requiredForDispositions, 'SATISFIED'))) return 'SATISFIED';
	if (!demanded.some((r) => gates(r?.requiredForDispositions, 'CONDITIONALLY_SATISFIED')))
		return 'CONDITIONALLY_SATISFIED';
	// ⛔ NOT A POSITIVE DISPOSITION AT ALL, and saying so is the point. INCONCLUSIVE is what an assessment that
	// could not reach a conclusion on the evidence available IS; `unconcludedReviews` then stops the PWU from
	// claiming satisfaction, with a message naming this policy.
	return 'INCONCLUSIVE';
}

/** The policy's own declared version, read from the stored object. ⛔ NOT a constant: the assessment is pinned
 *  to a policy VERSION (§18), and a literal here would silently pin the wrong one the day a policy is
 *  superseded — the drift `demo-policy.ts` already warns about for its own payload. */
function versionOf(engine: EngineHandle, policyId: string): string {
	const v = (engine.loadObject(policyId)?.state as { version?: unknown } | undefined)?.version;
	return typeof v === 'string' ? v : '1.0.0';
}

/**
 * Plan the independent review of `pwuId`: one assessment per governing declared policy, driven through the
 * ratified §30 sequence and completed with a §20 verdict naming ITS OWN policy.
 *
 * ⛔ RETURNS AN EMPTY PLAN RATHER THAN THROWING when nothing governs. A PWU may lawfully declare no policy —
 * `undertakings/[id]` proposes ad-hoc PWUs with `assurancePolicyIds: []` — and `RPH-PWU-007` has no opinion
 * about those. Failing loud here would invent a requirement that every PWU declare something, which is a
 * different rule with a different argument. The caller's existing demo-policy path stays untouched for them.
 */
export function planDeclaredSignoff(opts: {
	readonly engine: EngineHandle;
	readonly pwuId: string;
	readonly subjectSemanticVersion: number;
	/** The reviewer, which MUST be the identity whose session issues `steps` (`R22`). */
	readonly evaluator: ActorReference;
	/** The party that produced the work — the operator. Supplied so independence is CHECKED, not skipped. */
	readonly producer: ActorReference;
	/** Evidence this review considered. The same set on every verdict: one reviewer read it once. */
	readonly evidenceConsideredIds?: readonly string[];
	readonly mintId: (prefix: string) => string;
}): DeclaredSignoff {
	const { engine, pwuId, subjectSemanticVersion, evaluator, producer, mintId } = opts;
	const considered = [...(opts.evidenceConsideredIds ?? [])];
	const { selected, excluded } = selectGoverningPolicies(engine, pwuId);
	const assessmentIds = selected.map(() => mintId('asm'));
	// ⛔ PER POLICY, NOT ONE VALUE FOR THE BATCH. Two policies governing one PWU can be evidenced to different
	// depths, and a single disposition applied to both would either certify past one policy's gaps or withhold a
	// verdict the other has earned.
	const dispositions = selected.map((policyId) => supportedDisposition(engine, policyId));
	const steps: SignoffStep[] = [];

	for (const [i, policyId] of selected.entries()) {
		const assessmentId = assessmentIds[i]!;
		const policyVersion = versionOf(engine, policyId);
		// The ratified §30 sequence through the ONE helper that knows it (REG-F-021 increment 4) — and it NAMES
		// its evaluator, which is what gives "who assessed" a governed home instead of letting it arrive only
		// inside the verdict.
		driveAssessmentToAssessing(
			(commandType, targetAggregateType, targetAggregateId, payload) =>
				steps.push([commandType, targetAggregateType, targetAggregateId, payload]),
			{
				assessmentId,
				assurancePolicyId: policyId,
				policyVersion,
				subjectObjectIds: [pwuId],
				subjectSemanticVersions: { [pwuId]: subjectSemanticVersion },
				claimIds: [],
				evaluator
			}
		);
		steps.push([
			'CompleteAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			assessmentId,
			{
				validatorResult: {
					validatorId: DEMO_REVIEW_VALIDATOR_ID,
					validatorVersion: '1',
					// ⭐ ITS OWN POLICY, NOT A CONSTANT. A verdict naming another policy is *"a verdict attributed
					// to criteria it was not measured against"*, and since Phase 6b the kernel refuses it outright
					// (`completeAssuranceAssessment`, design §4.15.5). This is the line that guard protects.
					policyId,
					policyVersion,
					assessmentId,
					subjectObjectIds: [pwuId],
					subjectSemanticVersions: { [pwuId]: subjectSemanticVersion },
					claimResults: [],
					evidenceConsideredIds: [...considered],
					evidenceRejected: [],
					observations: [],
					dispositionRecommendation: dispositions[i]!,
					recommendedControlActions: [],
					// BOTH, for the reason in the header: `limitations` is the right home and is dropped at the
					// event boundary; `residualUncertainty` is carried, so it is the one a reader can reach.
					residualUncertainty: [DEMO_REVIEW_LIMITATION],
					limitations: [DEMO_REVIEW_LIMITATION],
					executionProvenance: { evaluator }
				},
				// ⛔ THE OPERATOR, NOT THE REVIEWER, AND THIS FIELD IS THE WHOLE POINT OF THE PHASE. Supplying it
				// is what makes the §39 invariant-8 check RUN: `completeAssuranceAssessment` skips independence
				// when either operand is absent, so omitting the producer would buy a green by removing the
				// question rather than answering it.
				producer
			}
		]);
	}

	// §28.2's ladder, strictest-first: the axis is the WEAKEST verdict any declared policy reached.
	const STRICTEST: readonly AssessmentDisposition[] = [
		'INCONCLUSIVE',
		'CONDITIONALLY_SATISFIED',
		'SATISFIED'
	];
	const foldedAssuranceState = dispositions.length
		? STRICTEST.find((d) => dispositions.includes(d))
		: undefined;
	return { policyIds: selected, assessmentIds, dispositions, excluded, foldedAssuranceState, steps };
}

/**
 * ⭐⭐ WHICH DECLARED POLICIES THIS REVIEW CANNOT CONCLUDE IN FAVOUR OF — answered BEFORE anything is dispatched.
 *
 * ⛔ IT MOVED AHEAD OF DISPATCH FOR `R23`, AND THE MOVE IS THE IMPROVEMENT. The first version read the STORE
 * after the reviewer's batch had committed, which meant the only way to learn the answer was to have already
 * written something — and `SPEC-001-INV-14` forbids exactly that residue (*"a partially-applied sequence SHALL
 * NOT leave committed state behind"*). The disposition each policy can reach is computable from the policy's own
 * `requiredEvidence` with no dispatch at all, so the refusal now happens with the store untouched.
 *
 * ⚠ THE GUARANTEE IS UNCHANGED: a verdict that is not a satisfaction must never be reported as a concluded
 * review. Only the moment it is asked has moved earlier, and earlier is strictly safer.
 *
 * ⭑ WHAT THIS DELIBERATELY DOES NOT COVER: an INDEPENDENCE_VIOLATION, which is not knowable without
 * dispatching — `completeAssuranceAssessment` ACCEPTS a self-review and records the §30 arrow rather than
 * refusing it. That case is held by the ATOMIC batch instead: the violated assessments never reach a satisfying
 * disposition, `RPH-PWU-007` refuses the controller's hop, and the whole transaction — both parties' commands —
 * unwinds. A weaker envelope would have needed this function to catch it; `R23` is why it does not.
 */
export function unsatisfyingReviews(
	plan: DeclaredSignoff
): ReadonlyArray<{ readonly policyId: string; readonly disposition: AssessmentDisposition }> {
	const SATISFYING = new Set<AssessmentDisposition>(['SATISFIED', 'CONDITIONALLY_SATISFIED']);
	return plan.policyIds
		.map((policyId, i) => ({ policyId, disposition: plan.dispositions[i]! }))
		.filter((r) => !SATISFYING.has(r.disposition));
}
