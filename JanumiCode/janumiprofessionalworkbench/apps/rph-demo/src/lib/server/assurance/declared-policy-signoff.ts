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
// ── ~~⚠ WHAT THE DEMO'S REVIEWER HONESTLY IS, DISCLOSED IN THE RECORD ITSELF~~ ──────────────────────────────────
//
// ~~This reviewer does not evaluate each policy's criteria one by one; it records a demonstration sign-off, the
// same act the demo policy always recorded, now performed by the party the declared policies require and over
// the policies the PWU actually names. An assessment that overstated its own depth would be the fiction this
// surface has twice been caught in, so the shortfall is written into every verdict.~~ ⛔ STRUCK BY E2, BELOW: the
// declared policies are judged now, criterion by criterion, so `DEMO_REVIEW_LIMITATION` is gone (design B2).
//
// ~~⛔ IN TWO FIELDS, AND THE SECOND ONE IS THE FINDING.~~ §20 `limitations` reaches NO READER — the ratified
// `AssuranceAssessmentCompleted` payload is a `strictObject` that does not declare it (design §4.15.7) — which is why a
// review's own limitations are written to `residualUncertainty` too, which the event DOES carry.
//
// ── ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — THE DECLARED POLICIES JUDGE (`REG-F-523`; `REG-D-110` (3); `REG-D-111`;
// `DESIGN-phase-7-completion.md` B1–B3, B6, B7) ──────────────────────────────────────────────────────────────────
//
// ⛔ WHAT WAS WRONG (`REG-F-523`): each verdict was computed from the policy's `requiredEvidence` alone
// (`supportedDisposition`, below) and issued with `claimResults: []` and no criterion result, so the same SATISFIED was
// issued for every unit of every Undertaking, whatever it built — the reading `R25` keeps forbidden.
// ⭐ NOW, ONE REVIEW PER (UNIT, POLICY) PAIR (`REG-D-110` (3)), its answers handed in (`DeclaredPolicyAnswer`,
// `declared-policy-review.ts`):
//   · ONE `RecordCriterionResult` PER CRITERION OF THE POLICY, in the policy's order — the reviewer's answer, or
//     `UNABLE_TO_DETERMINE` where it gave none, a test's stipulation beside it where the stand-in stipulated (design B2).
//     ⭑ Every criterion is recorded, so the record never stands on a criterion nobody recorded (`RPH-CON-005`'s question).
//   · EACH FAILED CRITERION AN OPEN FINDING, at the POLICY's declared severity (`R25`) — a BLOCKING one is canon's
//     *"blocking finding"* (`REG-D-111` (1)). ⚠ `E12F` F8 — THAT IS THE FIRST HALF OF CANON'S ROUTE, AND ONLY IT: canon's route
//     goes on `UNDER_ASSURANCE → REJECTED` on the work LIFECYCLE, and this sign-off does not take that hop. A REJECTED
//     verdict moves the unit's ASSURANCE axis to REJECTED, and its lifecycle STAYS `UNDER_ASSURANCE` — a departure from
//     `REG-D-111` (1) as the design wrote it (B3), kept on purpose (the route says why) and the lead's to record.
//   · ⭐ THE VERDICT FROM THE ANSWERS: `dispositionFromFindings` over those rows and findings (design B2), never the
//     reviewer's recommendation — so REJECTED and CONDITIONALLY_SATISFIED are reachable — and never past what the policy's
//     own evidence supports (`supportedDisposition`, kept as the CEILING it always was).
//   · ⭐ THE EVALUATOR IS WHO JUDGED: the reviewer's actual identity, the review's invocation beside it; ⭐ AND THE PRODUCER
//     IS THE UNIT'S OWN EXECUTOR where the record holds it (`REG-F-514`), handed in by the route. ⛔ `E12F` F9 — ~~IS WHO DID
//     THE WORK~~: that holds for a unit that did its own work (a phase) and for no other. A unit composed of others (the
//     root) is judged over its CHILDREN's work (`REG-D-111` (2)), yet its producer is ITS OWN executor — the operator, who
//     ran its TRANSFORMATION — so its independence is checked against the operator, never against the agents whose work
//     the review judged. Each child's own verdicts checked those; the root's do not.
//   · ⭐ A POLICY DEMANDING A HUMAN (`pol_fitness_for_purpose`) is recorded as the OPERATOR's decision, as a HUMAN actor,
//     each criterion result citing the reviewer's answer — the reviewer's answers are its evidence (`REG-D-111` (3)); its
//     commands are the operator's to issue (`humanSteps`).
// ⚠ ON THE ASSURANCE PLANE ONLY (`REG-D-111` (4)): nothing here gates `CompleteExecutionStep` (`REG-F-406` item 2, `R20`).
import { driveAssessmentToAssessing, listAssessments, selectGoverningPolicies } from '@janumipwb/rph-engine';
import type { EngineHandle } from '@janumipwb/rph-engine';
import type { ActorReference, AssessmentCriterion } from '@janumipwb/rph-contracts';
import {
	BLOCKING_SEVERITIES,
	dispositionFromFindings,
	type FloorCriterion,
	type Identity
} from '@janumipwb/rph-assurance';
import type { DeclaredPolicyAnswer } from './declared-policy-review.js';

/**
 * ~~The dispositions this reviewer can reach. Negative outcomes belong to `recordBlockingFinding`, which is a different
 * act by a different route — a reviewer that could reject here would collapse the two.~~
 * ⭐ E2 (design B2, B3; `REG-D-111` (1)) — AND REJECTED: a verdict computed from criterion answers can be against the work,
 * and a paid review's verdict is RECORDED (PER-9), never refused before dispatch. ⛔ `recordBlockingFinding` stays the
 * OPERATOR's adverse act; this is the reviewer's, ~~reached through the same canon route~~ — a blocking finding, then the
 * unit's ASSURANCE axis REJECTED. ⚠ `E12F` F8 — NOT CANON'S WHOLE ROUTE: canon's ends `UNDER_ASSURANCE → REJECTED` on the
 * work lifecycle, and the unit's lifecycle here stays `UNDER_ASSURANCE` (a departure from `REG-D-111` (1); the header says
 * why it is kept).
 */
export type AssessmentDisposition = 'SATISFIED' | 'CONDITIONALLY_SATISFIED' | 'INCONCLUSIVE' | 'REJECTED';

/** One dispatchable step, in the shape the surface's batch helpers already take. */
export type SignoffStep = [
	commandType: string,
	aggType: string,
	aggId: string,
	payload: unknown
];

/** ⭐ E2 — one governing declared policy, as the review of it needs it: read from the stored policy, never a constant. */
export interface GoverningDeclaredPolicy {
	readonly policyId: string;
	readonly version: string;
	readonly name: string;
	readonly purpose: string;
	/** The policy's OWN criteria — the review's rubric, and the rows the sign-off records. */
	readonly criteria: readonly AssessmentCriterion[];
	readonly independenceRequirement: string;
	/** The strongest disposition the policy's own §6.1 evidence supports (`supportedDisposition`) — the verdict's ceiling. */
	readonly evidenceCeiling: Exclude<AssessmentDisposition, 'REJECTED'>;
}

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
	/** The reviewer's commands, in §30 order — every policy a reviewer judged. Issued by the reviewer's own session (`R22`). */
	readonly steps: readonly SignoffStep[];
	/** ⭐ E2 (`REG-D-111` (3)) — the OPERATOR's commands: each policy demanding a HUMAN evaluator, recorded as their decision. */
	readonly humanSteps: readonly SignoffStep[];
	/** ⭐ E2 (`REG-D-111` (1)) — the blocking findings recorded: what a REJECTED unit's assurance axis cites beside its verdict. */
	readonly blockingObservationIds: readonly string[];
	/** ⭐ E2 — the criterion results recorded: one per criterion of each governing policy (design B2). */
	readonly criterionResults: number;
}

/**
 * ~~⚠ THE LIMITATION EVERY DEMO VERDICT CARRIES.~~ ⛔ `DEMO_REVIEW_LIMITATION` IS GONE (E2; design B2): it said the reviewer
 * *"did not evaluate this policy criterion by criterion"*, and now it does — every verdict is computed from one recorded
 * answer per criterion. A review's own limitations ride its verdict instead (`DeclaredPolicyAnswer.limitations`).
 */

/** ~~`validatorId` for the demo's independent review~~ — ⛔ E2: a verdict is recorded under its REVIEWER's id now
 *  (`DeclaredPolicyAnswer.validatorId`: `reviewer.declared-policy`, or the stand-in's), so this one names no record made
 *  after E2. ⚠ Kept, exported, because records made before E2 carry it and a reader of them keys on it
 *  (`scripts/phase7/run-report-core.ts`). */
export const DEMO_REVIEW_VALIDATOR_ID = 'workbench.independent-review';

/**
 * ⭐⭐ THE STRONGEST POSITIVE DISPOSITION THIS POLICY'S EVIDENCE SUPPORTS — not the one the caller would like.
 * ⭐ E2: the CEILING of a verdict computed from criterion answers (design B2), never the verdict itself.
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
function supportedDisposition(
	engine: EngineHandle,
	policyId: string
): Exclude<AssessmentDisposition, 'REJECTED'> {
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
	// could not reach a conclusion on the evidence available IS; `evidenceRefusals` then stops the PWU before any
	// review is asked for, with a message naming this policy.
	return 'INCONCLUSIVE';
}

/** The policy's stored state, as far as this module reads it. */
function policyState(
	engine: EngineHandle,
	policyId: string
): {
	version?: unknown;
	name?: unknown;
	purpose?: unknown;
	criteria?: unknown;
	independenceRequirement?: unknown;
} {
	return (engine.loadObject(policyId)?.state ?? {}) as Record<string, unknown>;
}

/** The policy's own declared version, read from the stored object. ⛔ NOT a constant: the assessment is pinned
 *  to a policy VERSION (§18), and a literal here would silently pin the wrong one the day a policy is
 *  superseded — the drift `demo-policy.ts` already warns about for its own payload. */
function versionOf(engine: EngineHandle, policyId: string): string {
	const v = policyState(engine, policyId).version;
	return typeof v === 'string' ? v : '1.0.0';
}

/**
 * ⭐ E2 — THE GOVERNING DECLARED POLICIES OF `pwuId`, each with what its review needs: its name, purpose and criteria,
 * read from the STORED policy (`ASR-4`: the rubric is the policy's own), its independence requirement, and the ceiling its
 * own evidence sets (`supportedDisposition`). The selection is the engine's (`selectGoverningPolicies`), its exclusions
 * returned.
 */
export function governingDeclaredPolicies(
	engine: EngineHandle,
	pwuId: string
): {
	readonly policies: readonly GoverningDeclaredPolicy[];
	readonly excluded: ReadonlyArray<{ readonly policyId: string; readonly reason: string }>;
} {
	const { selected, excluded } = selectGoverningPolicies(engine, pwuId);
	return {
		policies: selected.map((policyId) => {
			const s = policyState(engine, policyId);
			return {
				policyId,
				version: versionOf(engine, policyId),
				name: typeof s.name === 'string' ? s.name : policyId,
				purpose: typeof s.purpose === 'string' ? s.purpose : '',
				criteria: Array.isArray(s.criteria) ? (s.criteria as AssessmentCriterion[]) : [],
				independenceRequirement:
					typeof s.independenceRequirement === 'string' ? s.independenceRequirement : 'NONE',
				evidenceCeiling: supportedDisposition(engine, policyId)
			};
		}),
		excluded
	};
}

/**
 * ⭐⭐ WHICH DECLARED POLICIES NO REVIEW CAN CONCLUDE IN FAVOUR OF — answered BEFORE anything is dispatched, and ⭐ E2: before
 * any reviewer is ASKED. A policy whose §6.1 evidence gates EVERY positive disposition stops its assessment one arrow
 * before the verdict (its `BeginAssuranceAssessment` is refused in `EVIDENCE_PENDING`), so a review of it would be a paid
 * call whose verdict could never be recorded.
 *
 * ⛔ IT MOVED AHEAD OF DISPATCH FOR `R23`, AND THE MOVE IS THE IMPROVEMENT: `SPEC-001-INV-14` forbids a partially-applied
 * sequence's residue, and this answer is computable from the policy objects alone.
 */
export function evidenceRefusals(
	policies: readonly GoverningDeclaredPolicy[]
): ReadonlyArray<{ readonly policyId: string; readonly disposition: AssessmentDisposition }> {
	return policies
		.filter((p) => p.evidenceCeiling === 'INCONCLUSIVE')
		.map((p) => ({ policyId: p.policyId, disposition: p.evidenceCeiling }));
}

/** §28.2's ladder, strictest first — the order a fold reads, and the order two verdicts are compared in. */
const STRICTEST: readonly AssessmentDisposition[] = [
	'REJECTED',
	'INCONCLUSIVE',
	'CONDITIONALLY_SATISFIED',
	'SATISFIED'
];
const stricter = (a: AssessmentDisposition, b: AssessmentDisposition): AssessmentDisposition =>
	STRICTEST.indexOf(a) <= STRICTEST.indexOf(b) ? a : b;

/**
 * ⭐ E2 — EVERY CRITERION OF THE POLICY, AS THE REVIEW ANSWERED IT, in the policy's order: the reviewer's row where it gave
 * one, and `UNABLE_TO_DETERMINE` where it did not — a review that failed answered none. ⛔ Built over the POLICY's
 * criteria, never the answer's rows alone: a row missing from an answer would otherwise go unrecorded and a verdict could
 * stand on a criterion nobody recorded (`RPH-CON-005`'s question). `mandatory` is the policy's (`R25`).
 */
function rowsOf(policy: GoverningDeclaredPolicy, answer: DeclaredPolicyAnswer): FloorCriterion[] {
	const answered = new Map(answer.criteria.map((c) => [c.criterionId, c]));
	return policy.criteria.map((c) => {
		const row = answer.failure === undefined ? answered.get(c.id) : undefined;
		const mandatory = BLOCKING_SEVERITIES.has(c.severityIfNotMet);
		if (row) return { ...row, mandatory };
		return {
			criterionId: c.id,
			mandatory,
			outcome: 'UNABLE_TO_DETERMINE' as const,
			rationale:
				answer.failure === undefined
					? 'The review gave no answer for this criterion.'
					: 'No answer: the review produced none (see its VALIDATOR_EXECUTION_FAILED finding).'
		};
	});
}

/**
 * ⭐⭐ E2 (design B2) — THE VERDICT, COMPUTED FROM THE ANSWERS: `dispositionFromFindings` over the recorded rows and the open
 * findings, never the reviewer's recommendation, and never past the policy's own evidence (its ceiling).
 *   · ⛔ A review that produced no answer is INCONCLUSIVE — nothing was judged.
 *   · ⛔ `E12F` F6 — AND SO IS A POLICY THAT DECLARES NO CRITERION, its list empty or absent (`governingDeclaredPolicies`
 *     reads an absent list as empty): `dispositionFromFindings` over no row and no finding answers SATISFIED, so such a
 *     policy was signed off with nothing checked — `REG-F-523`'s shape, one policy down. The record says why
 *     (`noCriterionDeclared`, beside the verdict).
 *   · ⭑ IN AN ENGINE BUILT TO ADMIT THEM — never durable, by the `Engine`'s own refusal — a row recorded
 *     `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it counts as met, as the floor's ladder counts one
 *     (`REG-D-071` Q5 (a)); the engine's Gate E reads the same rows the same way, so the verdict and the gate agree.
 */
function verdictOf(
	policy: GoverningDeclaredPolicy,
	answer: DeclaredPolicyAnswer,
	rows: readonly FloorCriterion[],
	admitStipulatedAnswers: boolean
): AssessmentDisposition {
	if (answer.failure !== undefined) return 'INCONCLUSIVE';
	if (policy.criteria.length === 0) return 'INCONCLUSIVE';
	const counted = rows.map((c) =>
		admitStipulatedAnswers && c.outcome === 'UNABLE_TO_DETERMINE' && c.stipulated === 'MET'
			? { ...c, outcome: 'MET' as const }
			: c
	);
	const fromAnswers = dispositionFromFindings({
		findings: answer.observations.map((o) => ({ severity: o.severity, open: o.open })),
		criteria: counted
	});
	// ⚠ The ladder never answers ESCALATED (`assurance-rules.ts`); an unforeseen value is read as nothing concluded.
	const verdict: AssessmentDisposition = (STRICTEST as readonly string[]).includes(fromAnswers)
		? (fromAnswers as AssessmentDisposition)
		: 'INCONCLUSIVE';
	return stricter(verdict, policy.evidenceCeiling);
}

/**
 * ⭐ E2 — THE REVIEWER, AS THE RECORD NAMES AN ACTOR: its actual identity (§8.4), and the review's INVOCATION — the token
 * its calls are recorded under — as its `executionInstanceId`, so a `DIFFERENT_INVOCATION` demand is DECIDED against the
 * producer's attempt (`REG-F-514` remedy 1) rather than failing closed on an absent field.
 */
function reviewerActor(evaluator: Identity, invocationId: string | undefined): ActorReference {
	const agentId = evaluator.agentId ?? evaluator.modelId ?? 'declared-reviewer';
	return {
		actorId: agentId,
		actorType: evaluator.actorType === 'HUMAN' || evaluator.actorType === 'AGENT' ? evaluator.actorType : 'SERVICE',
		displayName: evaluator.modelId ? `${agentId} (${evaluator.modelId})` : agentId,
		...(evaluator.modelId ? { modelId: evaluator.modelId } : {}),
		...(evaluator.providerId ? { providerId: evaluator.providerId } : {}),
		...(invocationId ? { executionInstanceId: invocationId } : {})
	};
}

/** ⭐ E2 (`REG-D-111` (3)) — a HUMAN decision's criterion result: the reviewer's answer, cited as its evidence. */
function citedRationale(reviewer: ActorReference, row: FloorCriterion): string {
	const said = row.rationale ? `: ${row.rationale}` : '';
	return `The reviewer ${reviewer.displayName ?? reviewer.actorId} answered ${row.outcome}${said}`;
}

/**
 * ⛔ `E12F` F6 — WHAT THE RECORD SAYS BESIDE THE VERDICT OF A POLICY THAT DECLARES NO CRITERION: nothing was checked, so the
 * verdict is INCONCLUSIVE whatever the reviewer recommended (`verdictOf`).
 */
export const noCriterionDeclared = (policyId: string): string =>
	`${policyId} declares no criterion, so nothing was checked: its verdict is INCONCLUSIVE, never SATISFIED.`;

/** ⭐ E2 — what a governing policy that was never reviewed is answered with: nothing, and why. ⛔ Never a pass. */
const unreviewed = (policyId: string): DeclaredPolicyAnswer => ({
	policyId,
	validatorId: 'declared-policy-review.missing',
	evaluator: { actorType: 'SYSTEM', agentId: 'declared-policy-review.missing' },
	criteria: [],
	observations: [],
	recommendation: 'INCONCLUSIVE',
	residualUncertainty: [],
	limitations: [],
	failure: `No review of ${policyId} was made, so none of its criteria was answered.`
});

/**
 * Plan the review of `pwuId`'s declared policies: one assessment per governing declared policy, driven through the
 * ratified §30 sequence, its criteria recorded one by one, its failed criteria as open findings, and completed with a
 * §20 verdict naming ITS OWN policy — the verdict computed from the answers (⭐ E2, design B2).
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
	/** ⭐ E2 — the HUMAN who records a HUMAN-evaluated policy's decision (`REG-D-111` (3)): the operator, whose session
	 *  issues `humanSteps`. */
	readonly operator: ActorReference;
	/**
	 * The party that produced the work. Supplied so independence is CHECKED, not skipped. ⭐ E2 (`REG-F-514`): the unit's
	 * EXECUTOR where the record holds one — the model, its attempt as its invocation — ~~and the operator only where the
	 * operator did the work~~ and the operator otherwise; the route reads it from the record. ⛔ `E12F` F9 — the unit's OWN
	 * executor, which is who did the judged work for a phase only: for a unit composed of others (the root) it is the
	 * operator who ran its TRANSFORMATION, while the work judged is its children's (header).
	 */
	readonly producer: ActorReference;
	/** ⭐ E2 — each governing policy's review, as its reviewer answered it: one per policy (`REG-D-110` (3)). */
	readonly answers: ReadonlyMap<string, DeclaredPolicyAnswer>;
	/** ⭐ E2 — each review's invocation, by policy: the token its calls were recorded under. */
	readonly invocations?: ReadonlyMap<string, string>;
	/** ⭐ E2 — whether the engine this records into admits test-stipulated answers (`EngineHandle.admitStipulatedAnswers`). */
	readonly admitStipulatedAnswers: boolean;
	/** Evidence this review considered. The same set on every verdict: one reviewer read it once. */
	readonly evidenceConsideredIds?: readonly string[];
	readonly mintId: (prefix: string) => string;
	/**
	 * ⭐ `E12F` F3 (`REG-D-112` (a)) — ONLY THESE governing policies are planned: a person's re-run of the declared reviews
	 * that did not conclude (`declaredRerunOffer`), each a NEW assessment beside the one it re-runs. Absent: every one.
	 */
	readonly onlyPolicyIds?: ReadonlySet<string>;
}): DeclaredSignoff {
	const { engine, pwuId, subjectSemanticVersion, operator, producer, mintId } = opts;
	const considered = [...(opts.evidenceConsideredIds ?? [])];
	const governing = governingDeclaredPolicies(engine, pwuId);
	const only = opts.onlyPolicyIds;
	const policies = only ? governing.policies.filter((p) => only.has(p.policyId)) : governing.policies;
	const { excluded } = governing;
	const selected = policies.map((p) => p.policyId);
	const assessmentIds = selected.map(() => mintId('asm'));
	const dispositions: AssessmentDisposition[] = [];
	const steps: SignoffStep[] = [];
	const humanSteps: SignoffStep[] = [];
	const blockingObservationIds: string[] = [];
	let criterionResults = 0;

	for (const [i, policy] of policies.entries()) {
		const { policyId } = policy;
		const policyVersion = policy.version;
		const assessmentId = assessmentIds[i]!;
		const answer = opts.answers.get(policyId) ?? unreviewed(policyId);
		const rows = rowsOf(policy, answer);
		// ⛔ PER POLICY, NOT ONE VALUE FOR THE BATCH: each policy is judged on its own answers and its own evidence.
		const disposition = verdictOf(policy, answer, rows, opts.admitStipulatedAnswers);
		dispositions.push(disposition);
		const reviewer = reviewerActor(answer.evaluator, opts.invocations?.get(policyId));
		// ⭐ `REG-D-111` (3) — A POLICY DEMANDING A HUMAN is the operator's decision, issued by the operator's own session.
		const human = policy.independenceRequirement === 'HUMAN';
		const evaluator = human ? operator : reviewer;
		const party = human ? humanSteps : steps;
		// The ratified §30 sequence through the ONE helper that knows it (REG-F-021 increment 4) — and it NAMES
		// its evaluator, which is what gives "who assessed" a governed home instead of letting it arrive only
		// inside the verdict.
		driveAssessmentToAssessing(
			(commandType, targetAggregateType, targetAggregateId, payload) =>
				party.push([commandType, targetAggregateType, targetAggregateId, payload]),
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
		// ⭐⭐ E2 (design B2) — ONE `RecordCriterionResult` PER CRITERION, the stipulation beside a stipulated row (form D).
		for (const row of rows) {
			party.push([
				'RecordCriterionResult',
				'ASSURANCE_ASSESSMENT',
				assessmentId,
				{
					criterionId: row.criterionId,
					result: row.outcome,
					...(human
						? { rationale: citedRationale(reviewer, row) }
						: row.rationale
							? { rationale: row.rationale }
							: {}),
					...(row.stipulated !== undefined ? { stipulated: row.stipulated } : {})
				}
			]);
			criterionResults += 1;
		}
		// ⭐ E2 — EACH FAILED CRITERION AN OPEN FINDING at the policy's severity; and a review that produced nothing, the
		// failure's own finding, so a reader sees why nothing was judged (PER-9).
		const findings = [
			...answer.observations.map((o) => ({
				code: o.code,
				severity: o.severity,
				statement: o.statement.trim() || `Criterion ${o.code} was answered NOT MET, with no statement.`
			})),
			...(answer.failure === undefined
				? []
				: [{ code: 'VALIDATOR_EXECUTION_FAILED', severity: 'MATERIAL' as const, statement: answer.failure }])
		];
		for (const f of findings) {
			const observationId = mintId('obs');
			party.push([
				'RecordAssuranceObservation',
				'ASSURANCE_OBSERVATION',
				observationId,
				{ assessmentId, observationType: 'FINDING', findingCode: f.code, severity: f.severity, statement: f.statement }
			]);
			// ⭐ `REG-D-111` (1) — CANON'S "BLOCKING FINDING": what a REJECTED unit's assurance axis cites.
			if (BLOCKING_SEVERITIES.has(f.severity)) blockingObservationIds.push(observationId);
		}
		// ⭐ What the record says beside the verdict, where a reader can reach it (`residualUncertainty`; the header's §20 note).
		const noted = [
			...answer.residualUncertainty,
			...answer.limitations,
			// ⛔ `E12F` F6 — a policy with no criterion: why its verdict is INCONCLUSIVE.
			...(policy.criteria.length === 0 ? [noCriterionDeclared(policyId)] : []),
			...(answer.recommendation === disposition
				? []
				: [
						`The reviewer recommended ${answer.recommendation}; the verdict, ${disposition}, is computed from its criterion answers (REG-D-110 (3)).`
					]),
			...(human
				? [
						`The HUMAN decision (REG-D-111 (3)): the operator's Record Assurance adopted the reviewer's criterion answers, each cited on its criterion result; no separate human judgement of each criterion was recorded.`
					]
				: [])
		];
		party.push([
			'CompleteAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			assessmentId,
			{
				validatorResult: {
					validatorId: answer.validatorId,
					validatorVersion: '1',
					// ⭐ ITS OWN POLICY, NOT A CONSTANT. A verdict naming another policy is *"a verdict attributed
					// to criteria it was not measured against"*, and since Phase 6b the kernel refuses it outright
					// (`completeAssuranceAssessment`, design §4.15.5). This is the line that guard protects.
					policyId,
					policyVersion,
					assessmentId,
					subjectObjectIds: [pwuId],
					subjectSemanticVersions: { [pwuId]: subjectSemanticVersion },
					// ⚠ STILL EMPTY: §20 routes criterion results through a CLAIM id this assessment does not have; they are
					// recorded one by one above, through §32's `RecordCriterionResult` (`record-assurance.ts` says why).
					claimResults: [],
					evidenceConsideredIds: [...considered],
					evidenceRejected: [],
					observations: findings.map((f) => ({
						findingCode: f.code,
						severity: f.severity,
						statement: f.statement,
						subjectObjectIds: [pwuId]
					})),
					dispositionRecommendation: disposition,
					recommendedControlActions: [],
					// BOTH, for the reason in the header: `limitations` is the right home and is dropped at the
					// event boundary; `residualUncertainty` is carried, so it is the one a reader can reach.
					residualUncertainty: noted,
					limitations: [...answer.limitations],
					executionProvenance: { evaluator }
				},
				// ⛔ THE PARTY THAT DID THE WORK, NOT THE REVIEWER, AND THIS FIELD IS THE WHOLE POINT OF THE PHASE. Supplying it
				// is what makes the §39 invariant-8 check RUN: `completeAssuranceAssessment` skips independence
				// when either operand is absent, so omitting the producer would buy a green by removing the
				// question rather than answering it. ⚠ `E12F` F9 — for a unit composed of others, the party that ran ITS
				// transformation (the operator), not the agents whose work the review judged (the header).
				producer
			}
		]);
	}

	// §28.2's ladder, strictest-first: the axis is the WEAKEST verdict any declared policy reached.
	const foldedAssuranceState = dispositions.length
		? STRICTEST.find((d) => dispositions.includes(d))
		: undefined;
	return {
		policyIds: selected,
		assessmentIds,
		dispositions,
		excluded,
		...(foldedAssuranceState ? { foldedAssuranceState } : {}),
		steps,
		humanSteps,
		blockingObservationIds,
		criterionResults
	};
}

/**
 * ⭐⭐ WHICH DECLARED POLICIES THIS REVIEW DID NOT CONCLUDE IN FAVOUR OF.
 *
 * ~~Answered BEFORE anything is dispatched~~ ⭐ E2 (design B3): read off the PLAN, after the reviews were made — a verdict
 * against the work, or one that could not conclude, is RECORDED and then reported, never refused before dispatch: a paid
 * call was made, and PER-9 wants its record. The pre-dispatch refusal that remains is the evidence one
 * (`evidenceRefusals`), answerable before any review is asked for.
 *
 * ⚠ THE GUARANTEE IS UNCHANGED: a verdict that is not a satisfaction must never be reported as a concluded review.
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

// ── ⭐⭐ `E12F` F3 — A DECLARED REVIEW THAT DID NOT CONCLUDE MAY BE RE-RUN, BY THE PERSON (`REG-D-112` (a)) ───────────────────
//
// ⛔ WHAT WAS WRONG: one INCONCLUSIVE declared verdict STRANDED its unit. The fold of its verdicts is no value of the unit's
// assurance axis, so the unit stayed UNDER_ASSURANCE and ASSESSING — and Record Assurance is offered only while EXECUTING,
// and P7-6R's re-run reaches a unit WAITING after a refused step (`stopped-unit-recovery.ts`), never one under assurance.
// Nothing the page offered could move it but Abandon.
// ⭐ `REG-D-112` (a): *a declared review that did not conclude may be re-run, by the person*, as P7-6R re-runs a review that
// did not conclude (`REG-D-104` (1), `REG-D-105` (3)):
//   · ONLY the declared reviews whose LATEST verdict is INCONCLUSIVE are re-run; one that concluded is never re-reviewed —
//     a SATISFIED keeps its verdict, and a declared REJECTED goes canon's route (`REG-D-111` (1)), never re-reviewed
//     (`REG-D-105` (3)'s rule: the latest assessment wins, so a re-review run until one said SATISFIED would clear a
//     reasoned refusal). ⚠ ACROSS POLICIES, THE STRICTEST WINS, as for P7-6R: a unit carrying a REJECTED is offered none.
//   · EACH A NEW ASSESSMENT, the old one kept: the latest per policy speaks (the floor gate's rule, `RPH-PWU-007`'s reading).
//   · Recorded as the PERSON's Decision, its rationale theirs and its citation the decision (`recovery-authority.ts`).

/**
 * ⭐ `E12F` F3 — the option a person's re-run of the declared reviews selects, on its Decision. ⭑ A free string, as P7-6R's
 * `RERUN_REVIEW` is (`Decision.selectedOption` is `z.string()`).
 */
export const RERUN_DECLARED_REVIEWS = 'RERUN_DECLARED_REVIEWS';

/** ⭐ `E12F` F3 — one governing declared policy's LATEST verdict over a unit: the assessment that speaks for it, and its state. */
export interface LatestDeclaredVerdict {
	readonly policyId: string;
	readonly assessmentId: string;
	readonly state: string;
}

/**
 * ⭐ `E12F` F3 — THE LATEST ASSESSMENT PER GOVERNING DECLARED POLICY OVER `pwuId`: the floor gate's rule — by `updatedAt`, ties
 * to the last seen (`latestAssessmentByPolicy`, `assessment-index.ts`), which `RPH-PWU-007`'s fold reads too — so the page,
 * the re-run and the kernel's guard agree on which verdict speaks. A policy never assessed has no row.
 */
export function latestDeclaredVerdicts(
	engine: EngineHandle,
	pwuId: string,
	policyIds: readonly string[]
): ReadonlyMap<string, LatestDeclaredVerdict> {
	const wanted = new Set(policyIds);
	const latest = new Map<string, LatestDeclaredVerdict & { readonly at: string }>();
	for (const a of listAssessments(engine, { kind: 'WORKSPACE' })) {
		const s = a.state as { assurancePolicyId?: unknown; subjectObjectIds?: unknown; updatedAt?: unknown; assessmentState?: unknown };
		const policyId = typeof s.assurancePolicyId === 'string' ? s.assurancePolicyId : '';
		const subjects = Array.isArray(s.subjectObjectIds) ? s.subjectObjectIds : [];
		if (!wanted.has(policyId) || !subjects.includes(pwuId)) continue;
		const at = typeof s.updatedAt === 'string' ? s.updatedAt : '';
		const prev = latest.get(policyId);
		if (!prev || at >= prev.at)
			latest.set(policyId, { policyId, assessmentId: a.id, state: String(s.assessmentState ?? ''), at });
	}
	return new Map([...latest].map(([k, { at: _at, ...v }]) => [k, v]));
}

/** ⭐ E12's re-review F3 — the state of a governing policy with no assessment over the unit: the kernel's own word for it. */
export const NEVER_ASSESSED = 'NEVER_ASSESSED';

/**
 * ⭐ E12's re-review F3 — a governing policy NOT re-run, as the unit's fold reads it beside a re-run: its latest verdict, or —
 * never assessed — no assessment and the state `NEVER_ASSESSED`, which folds as a verdict that did not conclude.
 */
export type OtherDeclaredVerdict =
	| LatestDeclaredVerdict
	| { readonly policyId: string; readonly assessmentId: null; readonly state: typeof NEVER_ASSESSED };

/** ⭐ `E12F` F3 — what the person is offered on a unit stranded by a declared review that did not conclude. */
export interface DeclaredRerunOffer {
	/** The governing policies whose latest verdict is INCONCLUSIVE — the reviews re-run, in selection order. */
	readonly policies: readonly GoverningDeclaredPolicy[];
	/** Their INCONCLUSIVE assessments, kept: the Decision's subjects beside the unit. */
	readonly inconclusive: readonly LatestDeclaredVerdict[];
	/**
	 * Every OTHER governing policy's latest verdict: what the unit's assurance is folded with after the re-run. ⭐ E12's
	 * re-review F3 — a policy never assessed is carried too (`NEVER_ASSESSED`), never dropped.
	 */
	readonly others: readonly OtherDeclaredVerdict[];
}

/**
 * ⭐⭐ `E12F` F3 (`REG-D-112` (a)) — WHETHER THE PERSON MAY RE-RUN `pwuId`'s DECLARED REVIEWS, AND WHICH: read from the record,
 * so the page offers what the server will accept. ⛔ Refused, with why, unless the unit is UNDER_ASSURANCE and ASSESSING
 * (the state an INCONCLUSIVE fold leaves it in), no governing policy's latest verdict is REJECTED (`REG-D-105` (3)), and at
 * least one is INCONCLUSIVE.
 */
export function declaredRerunOffer(
	engine: EngineHandle,
	pwuId: string
): DeclaredRerunOffer | { readonly refusedBecause: string } {
	const { policies } = governingDeclaredPolicies(engine, pwuId);
	const latest = latestDeclaredVerdicts(
		engine,
		pwuId,
		policies.map((p) => p.policyId)
	);
	// ⭑ ASKED FIRST, so a unit whose declared review concluded against it is told the RULE, not only its state.
	const rejected = [...latest.values()].filter((v) => v.state === 'REJECTED');
	if (rejected.length > 0)
		return {
			refusedBecause:
				`a declared review concluded against the work (${rejected.map((v) => `${v.policyId} REJECTED`).join('; ')}): a REJECTED ` +
				'is not re-reviewed — the latest verdict wins, so a re-review could clear a reasoned refusal (REG-D-105 (3)); it goes ' +
				"canon's route, a blocking finding (REG-D-111 (1))"
		};
	const unit = engine.loadObject(pwuId)?.state as { workLifecycleState?: unknown; assuranceState?: unknown } | undefined;
	if (unit?.workLifecycleState !== 'UNDER_ASSURANCE' || unit.assuranceState !== 'ASSESSING')
		return {
			refusedBecause:
				`the unit is ${String(unit?.workLifecycleState ?? 'unknown')} with its assurance ${String(unit?.assuranceState ?? 'unknown')}; ` +
				'only a unit left under assessment by a declared review that did not conclude may have its declared reviews re-run (REG-D-112 (a))'
		};
	const inconclusive = policies.filter((p) => latest.get(p.policyId)?.state === 'INCONCLUSIVE');
	if (inconclusive.length === 0)
		return { refusedBecause: 'no declared review of this unit ended INCONCLUSIVE, so none is re-run (REG-D-112 (a))' };
	return {
		policies: inconclusive,
		inconclusive: inconclusive.map((p) => latest.get(p.policyId)!),
		// ⛔ E12's re-review F3 — ~~`flatMap(latest ?? [])`~~: a governing policy with no assessment was DROPPED, so the fold
		// passed over it and only the kernel's NEVER_ASSESSED rung stopped a SATISFIED hop. It is carried, and folds below.
		others: policies
			.filter((p) => !inconclusive.includes(p))
			.map(
				(p): OtherDeclaredVerdict =>
					latest.get(p.policyId) ?? { policyId: p.policyId, assessmentId: null, state: NEVER_ASSESSED }
			)
	};
}

/**
 * ⭐ `E12F` F3 — THE UNIT'S FOLD AFTER A RE-RUN: §28.2's strictest over the re-run policies' NEW verdicts and every other
 * governing policy's latest — never the re-run's alone, or a policy not re-run would go unfolded. A policy never assessed
 * (`NEVER_ASSESSED`) folds as INCONCLUSIVE: nothing concluded it.
 */
export function foldAfterRerun(
	plan: DeclaredSignoff,
	others: readonly OtherDeclaredVerdict[]
): AssessmentDisposition {
	const states = [
		...plan.dispositions,
		...others.map((v): AssessmentDisposition =>
			(STRICTEST as readonly string[]).includes(v.state) ? (v.state as AssessmentDisposition) : 'INCONCLUSIVE'
		)
	];
	return STRICTEST.find((d) => states.includes(d)) ?? 'INCONCLUSIVE';
}
