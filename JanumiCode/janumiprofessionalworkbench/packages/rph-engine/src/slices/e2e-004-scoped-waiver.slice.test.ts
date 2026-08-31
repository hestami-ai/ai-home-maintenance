// JAN-SLICE-SWP-03 — RPH-E2E-004, the journey where a human ACCEPTS a residual risk instead of resolving it.
//
// The ratified statement (`packages/rph-domain/vocab/m12-conformance.json`, `sourceRef: "§24"`), verbatim:
//   "When an authorized human grants a scoped waiver for a material but noncritical open observation, the finding
//    remains visible, the waiver records rationale and expiration, assurance becomes waived or conditionally
//    satisfied, the baseline package includes the waiver, and unrelated findings remain unaffected."
//
// The worked scenario it was distilled from — `docs/Recursive Professional Harness/… Executable Invariant and
// Conformance Test Specification.md`, `# 24. End-to-End Scenarios`, `## RPH-E2E-004 — Human waiver`, verbatim:
//   Given   "A material but noncritical observation remains open."
//   When    "an authorized human grants a scoped waiver."
//   Then    "* finding remains visible;
//            * waiver records rationale and expiration;
//            * assurance becomes waived or conditionally satisfied;
//            * baseline package includes the waiver;
//            * unrelated findings remain unaffected."
//
// ⚠ AND A SECOND WORKED SCENARIO SAYS SOMETHING DIFFERENT ABOUT THE SAME ACT, which matters for clause (c). The
// Canonical Domain Model doc's `# 39. Migration Acceptance Tests`, `## Scenario 4: Human waiver`, verbatim:
//   "* blocking observation remains visible;
//    * waiver includes scope, rationale, authority, and duration;
//    * assurance state becomes `WAIVED` or conditionally satisfied;
//    * baseline record includes waiver."
// §24 says EXPIRATION; §39 says DURATION. They are not the same datum, and this engine records them in DIFFERENT
// places — `expiresAt` on the Decision object, `duration` on the events and nowhere else. Both are driven below,
// so a reader can see which limb of which document is satisfied where instead of taking "the waiver records its
// term" on trust.
//
// ── WHY THIS SLICE IS DIFFERENT FROM E2E-002, AND WHY THAT IS THE POINT ──────────────────────────────────────
// `RPH-E2E-002` is the profession saying NO. This is the profession saying "yes, KNOWINGLY" — the one path where
// governed work reaches an authoritative baseline while a real, recorded, unresolved finding is still open. It is
// the hardest thing for a harness to get right, because the two failure modes are opposite: an engine that lets
// the waiver ERASE the finding has laundered a defect, and an engine that lets the waiver do NOTHING has an
// authority that is decoration. Canon ASR-14 states the line in one sentence — *"A waiver accepts risk; it never
// rewrites truth."* Clauses (b) and (f) are the "never rewrites truth" half; clause (d) is the "accepts risk"
// half; and they are asserted separately because an engine can fail either one alone.
//
// ⚠ ASR-14 HAS A SECOND LIMB THIS SLICE DOES NOT GET TO ASSERT — *"Critical integrity failures … cannot be waived
// by ordinary product authority — waiver authority is tiered."* Nothing in this engine checks a tier, because no
// field on the Decision records one. That is disclosed where the antecedent is arranged (`grantScopedWaiver`)
// rather than left to be inferred from the clauses that ARE asserted.
//
// ── HOW THE CLAUSES ARE LETTERED HERE ────────────────────────────────────────────────────────────────────────
// `(a)` is the rule's WHEN — "an authorized human grants a scoped waiver" — which is arranged rather than
// asserted, so there is no `O-a`. `(b)` … `(f)` are the five Then-clauses in the order the ratified statement
// gives them, and each has exactly one test named for it. The lettering follows the E2E-002 Slice's convention of
// one letter per clause of the ratified sentence, read left to right.
//
// ── WHAT IS ASSERTED, AND WHAT IS DISCLOSED INSTEAD ─────────────────────────────────────────────────────────
// All five ratified Then-clauses hold and are asserted as ratified. NONE is narrowed. What this Slice adds is
// three findings that only appear when the journey is DRIVEN, each in its own test named for the finding:
//
//   `O-d(absent)`  WAIVED is reachable on exactly ONE of the SEVEN machines that declare it. The count is
//                  DERIVED from `transitions.data.ts`, not listed — an earlier draft said FOUR, which is the
//                  enumerate-don't-derive defect one level up from the one this finding reports. The PWU's
//                  assurance axis can carry it; `AssuranceAssessment.state`, `AssuranceAssessment.disposition`,
//                  `AssuranceObservation.disposition` and `Claim.status` each cannot, for FOUR DIFFERENT
//                  reasons, all four driven. `Obligation.status` and `Constraint.status` are named as
//                  birth-only and NOT driven, and the test says so rather than leaving the silence.
//   `O-e(disclosure)` The consequence: `PROMOTABLE_DISPOSITIONS` in the baseline gate is `{SATISFIED, WAIVED}`
//                  and its WAIVED arm is dead, because the value it tests can never be written. A waiver does not
//                  carry a required assessment past the promotion gate — driven, and REFUSED.
//   `O-f`          The waiver's SCOPE is read at the DOOR and nowhere after it. `requestWaiver` DOES read
//                  `waivedCriterionId` and `compensatingControls`, against the waived policy's `waiverRules` —
//                  but only when that policy declares some, and this journey's policy declares none. At the
//                  point of USE nothing reads either, and `waivedFindingIds` is read by no guard anywhere. So
//                  "unrelated findings remain unaffected" is true, and so is "the waived finding is unaffected"
//                  — the waiver moves an axis, it does not touch an observation.
//
// ⚠ THE RECON THIS SLICE STARTED FROM SAID CLAUSE (e) WAS ABSENT — "the baseline package includes the waiver" —
// on the strength of there being no waiver field on a Baseline. It is WRONG, and driving is what settled it:
// `CreateBaselinePayload.itemObjectIds` is `z.array(z.string())` with no type restriction, so a WAIVER Decision
// id IS a baseline item, and it survives into the frozen `itemObjectVersions`, into `BaselineCreated`, into
// `BaselinePromoted`, and out into the traceability projection as a `BASELINES` link. Recording that absence
// would have been the worst outcome available here: a false gap is harder to remove than a real one.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE — the prohibition the E2E-001 and E2E-002 Slices both record. It
// converts a false clause into a green suite, which is `SL-8`'s "weakened to green" wearing a different hat.
import {
	buildAssuranceView,
	outboundLinks,
	rebuildProjection,
	traceabilityProjector
} from '@janumipwb/rph-projections';
import { describe, expect, it } from 'vitest';

import {
	beginJourney,
	changeState,
	executeWork,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	verdict,
	JOURNEY_ACTOR,
	JOURNEY_POLICY,
	type Journey
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'E2E-004',
	title: 'An authorized human waives a material finding, and the finding survives the waiver',
	plane: 'ENGINE',
	// ⚠ THE ROADMAP'S §9 TABLE PROPOSES `alternate valid path` FOR THIS RULE AND ITS OWN PREAMBLE FORBIDS
	// INHERITING IT — the assignments "MUST be ratified in SWP-02 and SWP-03, not inherited from this table".
	// Ratified here. ALL SEVEN rejected candidates are named, so the enumeration is complete against
	// `SCENARIO_CLASSES`'s eight members (`packages/rph-contracts/src/slice.ts:32-42`) rather than merely
	// plausible — an earlier draft named four and claimed the choice was checkable, which it was not:
	//   NOT `normal path` — that is `RPH-E2E-001`, which reaches a baseline with nothing outstanding. This
	//     journey reaches an AUTHORITATIVE baseline with a real finding still OPEN. Same destination, different
	//     road, and the difference is the professional content of the rule.
	//   NOT `permission-denied path` — nothing is denied. The human HOLDS the authority (`REG-F-014`: the
	//     Decision's declared authority equals the issuing actor) and the grant is ACCEPTED. The one refusal this
	//     Slice drives is a CONTROL over the guard, not a step of the journey.
	//   NOT `user-error path` — no command in the journey is malformed; every act is ACCEPTED. The two refusals
	//     this Slice drives are CONTROLS over guards (`O-d`, `O-d(absent)`), not steps of the journey.
	//   NOT `system-failure path` — nothing fails, nothing is unavailable, nothing is retried.
	//   NOT `interrupted or resumed path` — the journey runs to completion in one session on one engine, with no
	//     restart and no resumption. That is `RPH-E2E-006`, which owns the class.
	//   NOT `data-unavailable path` — every object every act reads is in the store when it is read. `O-d`'s
	//     refusal is a CATEGORY error over a present object, not a lookup that found nothing.
	//   NOT `cancellation path` — nothing is cancelled, withdrawn or abandoned. A waiver ACCEPTS the residual and
	//     carries the work forward; it is the opposite act, and DenyWaiver (the cancelling one) is never sent.
	// What remains is a journey every step of which is legal and accepted, whose OUTCOME differs from the normal
	// path because a governance authority made a different professional choice. That is the definition of an
	// alternate valid path.
	scenarioClass: 'alternate valid path',
	citedRules: ['RPH-E2E-004'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'E2E-004-M1',
			file: 'packages/rph-projections/src/assurance-view.ts',
			find: '		observations: [...existing.observations, observation]',
			replace: '		observations: existing.observations',
			expectRed: ['O-b'],
			predictedMessage:
				'the waived finding must still be listed by the assurance read model after the grant — clause (b), at the layer where "visible" actually means something',
			why: "Proves clause (b) is asserted on the read model a professional would actually look at, not merely on the stored object. VISIBILITY IS A READ-MODEL PROPERTY: an engine that kept the observation row and stopped projecting it would satisfy an object-only assertion and hide the finding from every human. ⚠ The object limb is asserted in the same test and is deliberately NOT what this mutant attacks — nothing in this engine can alter an observation object (see `O-f`), so an object-only assertion for clause (b) is unfalsifiable and would prove nothing. ⚠ AND `O-f` HAD TO GIVE UP A LINE FOR THIS MUTANT TO STAY SINGLE-VICTIM: its first draft also read the projected observation rows, which this mutant empties, so it would have reddened here and there at once. The line was removed and the removal is recorded in `O-f` rather than left as a silence."
		},
		{
			id: 'E2E-004-M2',
			file: 'packages/rph-application/src/handlers/governance.ts',
			find: '			...(p.expiresAt ? { expiresAt: p.expiresAt } : {}),',
			replace: '			...(false ? { expiresAt: p.expiresAt } : {}),',
			expectRed: ['O-c'],
			predictedMessage:
				'the waiver Decision must record the expiration the grant was given under — clause (c), the half §24 names and §39 does not',
			why: "Proves clause (c)'s EXPIRATION limb is asserted on the Decision object's `WaiverDetail`, which is the only durable home the datum has. ⚠ THE ANCHOR IS THE OBJECT SITE, NOT THE EVENT SITE, AND THAT IS THE WHOLE CARE OF THIS MUTANT: `requestWaiver` spreads the same conditional twice, once into `state.waiver` and once into `eventPayload`, and the two lines differ ONLY by the trailing comma. Anchoring on the comma-less one would have reddened the event assertion instead and left the object claim unproven. Measured with `grep -Fc`: this string occurs exactly once."
		},
		{
			id: 'E2E-004-M3',
			file: 'packages/rph-application/src/handlers/pwu.ts',
			find: "	if (p.assuranceState !== 'WAIVED') return undefined;",
			replace: "	if (p.assuranceState.length >= 0) return undefined;",
			expectRed: ['O-d'],
			predictedMessage:
				'assurance must not read WAIVED unless an authorized, version-bound waiver Decision backs it — clause (d), and the guard that makes the word mean something',
			why: "Proves clause (d) is asserted on `rejectUnauthorizedWaiver`, the guard REG-Q-030 promised and `waiver-authorization.ts` implements, rather than on the mere fact that the axis can hold the string. The replacement makes the early return unconditional, so the guard never runs and an un-backed WAIVED is ACCEPTED. ⚠ AND IT IS SPELLED AS AN ALWAYS-TRUE LENGTH TEST BECAUSE THE OBVIOUS SPELLING DOES NOT COMPILE: the first draft was `p.assuranceState !== 'NOT_AN_ASSURANCE_STATE'`, and `assuranceState` is `AssuranceStateSchema`, a literal union, so `tsc --strict` rejects that comparison TS2367, the types having no overlap (measured on an isolated file, not reasoned). vitest transpiles without type-checking, so it would have run and reddened correctly while a type-checking mutation harness scored it a BUILD BREAK rather than a killed mutant. `p.assuranceState.length >= 0` compiles and changes the same behaviour. ⚠ NOTE WHAT THIS MEANS FOR THE POSITIVE HALF OF THE TEST: with the guard disabled the ACCEPTED hop still succeeds, so a Slice asserting only \"the axis reads WAIVED\" would stay GREEN through this mutant — which is exactly why the refusal limb is in the same test and is the limb this mutant attacks."
		},
		{
			id: 'E2E-004-M4',
			file: 'packages/rph-contracts/src/enums.ts',
			find: 'export const AssuranceDispositionRecommendationSchema = z.enum([',
			replace: "export const AssuranceDispositionRecommendationSchema = z.enum([\n\t'WAIVED',",
			expectRed: ['O-d(absent)'],
			predictedMessage:
				'no validator may recommend WAIVED — the schema must refuse it, which is why the assessment axis can never carry the word',
			why: 'Proves the FIRST of the FOUR unreachability grounds is asserted on the ratified enum that causes it, not on an observation that the value merely happens not to appear. ⚠ THE OTHER THREE GROUNDS IN THAT TEST CARRY NO MUTANT, WHICH IS STATED HERE RATHER THAN LEFT AS A SILENCE (SL-3a): the missing-`disposition`-property limb and the observation-disposition limb are derived absences with no single narrow victim, and the `Claim.status` limb added later would need a mutation of `CLAIM_STATUS_EVENT` whose blast radius (the engine event gate) could not be verified without applying it, so none is declared rather than one guessed at. Adding WAIVED to the recommendation options makes the refused completion ACCEPTED, so both the status assertion and the refusal-message assertion redden. ⚠ It leaves the journey untouched: the journey completes its assessment CONDITIONALLY_SATISFIED, a value in the enum either way, so no other test moves.'
		},
		{
			id: 'E2E-004-M5',
			file: 'packages/rph-application/src/handlers/governance.ts',
			find: '	const itemObjectVersions = p.itemObjectIds.map((objectId) => {',
			replace: '	const itemObjectVersions = p.itemObjectIds.slice(0, 1).map((objectId) => {',
			expectRed: ['O-e'],
			predictedMessage:
				'the waiver Decision must be frozen INTO the baseline package, not merely mentioned near it — clause (e), read off the Baseline the engine committed',
			why: "Proves clause (e) is asserted on the item set the BASELINE ITSELF froze, rather than on the payload the caller happened to send. ⚠ AND NOT BECAUSE THE VERSION ARM READS IT — IT DOES NOT, and an earlier draft of this line said it did. `promoteBaseline` builds `candidateItems` from `p.expectedItemObjectVersions` (governance.ts:896) and then passes `reviewedItems: candidateItems` (:929), so RPH-BAS-002's reviewed-vs-promoted comparison is a SELF-comparison at this call site and `findVersionMismatches` can never fire here. The frozen set reaches the gate only as `baselineItemIds` (:917-921), which scopes the open-observation and contested-claim arms, and reaches the authoritative record through `eventPayload` (:1012) — which is what this mutant actually attacks. Truncating the frozen set to its first item keeps the PWU and drops the waiver, so the promotion still succeeds and the test reaches its assertion instead of dying at an arrangement step. ⚠ `BaselineCreated`'s payload emits `p.itemObjectIds` DIRECTLY and is therefore untouched by this mutant — that limb is asserted in the same test and is proven by nothing here, which is stated rather than left for a reader to assume."
		},
		{
			id: 'E2E-004-M6',
			file: 'packages/rph-domain/src/governance.ts',
			find: "const PROMOTABLE_DISPOSITIONS = new Set(['SATISFIED', 'WAIVED']);",
			replace: "const PROMOTABLE_DISPOSITIONS = new Set(['SATISFIED', 'WAIVED', 'CONDITIONALLY_SATISFIED']);",
			expectRed: ['O-e(disclosure)'],
			predictedMessage:
				'a conditionally-satisfied required assessment must still refuse the promotion — the granted waiver does not carry it past the gate',
			why: 'Proves the disclosure is asserted on the gate that actually decides it. Widening the promotable set admits the CONDITIONALLY_SATISFIED assessment, the promotion is ACCEPTED, and the refusal assertion reddens. ⚠ The neighbouring `O-e` promotion cites NO required assessment and is unaffected, so this mutant separates the two promotions rather than reddening both.'
		},
		{
			id: 'E2E-004-M7',
			file: 'packages/rph-projections/src/assurance-view.ts',
			find: '		waivedFindingIds: strArr(p.waivedFindingIds),',
			replace: '		waivedFindingIds: strArr(p.subjectObjectIds),',
			expectRed: ['O-f'],
			predictedMessage:
				'the projected waiver must name the ONE finding it waives and no other — the recorded scope is all the scoping there is',
			why: "Proves clause (f) is asserted on the waiver's recorded scope rather than on the tautology that the other observation still exists. The replacement makes the projected waiver name its SUBJECT instead of its finding — a plausible-looking substitution that would silently widen every waiver in the read model to the whole PWU. ⚠ A mutant on the observation fold was rejected for this test: it would have reddened `O-b` as well, and `SL-3a` says a mutant that reddens two clauses proves neither."
		}
	]
};

const INTENT = 'int_04ARZ3NDEKTSV4RRFFQ69G5T00';
const PWU = 'pwu_04ARZ3NDEKTSV4RRFFQ69G5T10';
const CLAIM = 'clm_04ARZ3NDEKTSV4RRFFQ69G5T20';
const EVIDENCE = 'evd_04ARZ3NDEKTSV4RRFFQ69G5T30';
const PLAN = 'plan_04ARZ3NDEKTSV4RRFFQ69G5T40';
const STEP = 'step_04ARZ3NDEKTSV4RRFFQ69G5T50';
const ATTEMPT = 'att_04ARZ3NDEKTSV4RRFFQ69G5T60';
const ASSESSMENT = 'assess_04ARZ3NDEKTSV4RRFFQ69G5T70';
/** The MATERIAL, noncritical finding the human waives — the rule's Given. */
const OBS_WAIVED = 'obs_04ARZ3NDEKTSV4RRFFQ69G5T80';
/** A second, UNRELATED finding the waiver never names — the rule's clause (f). */
const OBS_OTHER = 'obs_04ARZ3NDEKTSV4RRFFQ69G5T81';
const WAIVER = 'dec_04ARZ3NDEKTSV4RRFFQ69G5T90';
const PROMOTION = 'dec_04ARZ3NDEKTSV4RRFFQ69G5TA0';
const BASELINE = 'base_04ARZ3NDEKTSV4RRFFQ69G5TB0';
/** A second assessment, used ONLY by `O-d(absent)` to drive a disposition the engine must refuse. */
const PROBE_ASSESSMENT = 'assess_04ARZ3NDEKTSV4RRFFQ69G5T71';

const WAIVER_EXPIRES = '2026-11-30T00:00:00Z';
const WAIVER_DURATION = 'P90D';
const WAIVER_RATIONALE =
	'The isolation gap is MATERIAL, not blocking: a compensating quarterly review carries the residual until the next architecture revision.';

/**
 * The journey, up to the moment the human is asked to decide.
 *
 * ⚠ THE SEVERITY IS `MATERIAL` AND THAT IS THE RULE'S OWN ANTECEDENT, NOT A CONVENIENCE. §24's Given reads "A
 * material but noncritical observation remains open", and the engine treats that severity band as a distinct
 * regime in two places that both matter here:
 *   1. `POSITIVE_DISPOSITIONS` in `assurance.ts` forecloses SATISFIED / CONDITIONALLY_SATISFIED only while a
 *      BLOCKING or CRITICAL finding is open — so a MATERIAL finding permits the CONDITIONALLY_SATISFIED landing
 *      the ratified clause (d) names as its second arm. A BLOCKING finding would have been refused here, and the
 *      Slice would have been red for a reason the rule does not describe.
 *   2. `BLOCKING_SEVERITIES` in `governance.ts` is the same pair, so a MATERIAL finding does not raise
 *      `OPEN_BLOCKING_FINDING` at the promotion gate. That is what makes clause (e) reachable at all, and it is
 *      the exact hinge between this rule and `RPH-E2E-002`, whose finding IS blocking and whose promotion IS
 *      refused. The two Slices differ in ONE field of ONE command.
 *
 * ⚠ AND THE OBSERVATIONS ARE RECORDED WHILE THE ASSESSMENT IS OPEN. `RecordAssuranceObservation` inherits its
 * `subjectObjectIds` FROM THE ASSESSMENT — the caller never names the PWU — so the finding can only reach the
 * right subject through a live assessment. The same order the E2E-002 Slice records, for the same reason.
 */
function journey(): Journey {
	const j = beginJourney();
	seedJourneyPolicy(j);
	seedIntentAndArchitecture(j, { intentId: INTENT, pwuId: PWU });
	executeWork(j, {
		pwuId: PWU,
		planId: PLAN,
		stepId: STEP,
		attemptId: ATTEMPT,
		claimId: CLAIM,
		evidenceId: EVIDENCE
	});

	j.send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
		assessmentId: ASSESSMENT,
		assurancePolicyId: JOURNEY_POLICY,
		policyVersion: '1.0.0',
		subjectObjectIds: [PWU],
		subjectSemanticVersions: { [PWU]: 1 },
		claimIds: [CLAIM]
	});
	j.send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {});

	// The finding that will be waived.
	j.send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', OBS_WAIVED, {
		assessmentId: ASSESSMENT,
		observationType: 'FINDING',
		findingCode: 'MISSING_SECURITY_BOUNDARY',
		severity: 'MATERIAL',
		statement: 'The tenant isolation boundary is documented but not yet evidenced end to end.'
	});
	// The finding that will NOT be — clause (f)'s subject. Deliberately the SAME severity and the SAME subject as
	// the waived one, so the only thing distinguishing them is whether the waiver names it. A control that
	// differed in severity would let a passing (f) be explained by the severity band instead of by the scope.
	j.send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', OBS_OTHER, {
		assessmentId: ASSESSMENT,
		observationType: 'FINDING',
		findingCode: 'UNDOCUMENTED_RETENTION_POLICY',
		severity: 'MATERIAL',
		statement: 'The data retention policy for tenant audit logs is not stated.'
	});

	// (d), second arm: the assessment itself lands CONDITIONALLY_SATISFIED. The §30 machine's own trigger text for
	// that arrow reads "typically an open MATERIAL finding", so this is the ratified landing for this Given rather
	// than a choice made to keep the Slice green.
	j.send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
		validatorResult: verdict({
			assessmentId: ASSESSMENT,
			subjectId: PWU,
			subjectSemanticVersion: 1,
			disposition: 'CONDITIONALLY_SATISFIED'
		})
	});
	return j;
}

/**
 * The rule's When: an authorized human requests and GRANTS a scoped waiver.
 *
 * ⚠ TWO ACTS, NOT ONE, AND THE SPLIT CARRIES THE AUTHORITY. `RequestWaiver` mints the WAIVER Decision in
 * PROPOSED — a request, not a grant — and `GrantWaiver` drives PROPOSED -> EFFECTIVE through the same authority
 * gate an approval passes. `governance.ts` records why the pair cannot be collapsed: `ApproveDecision` aimed at a
 * PROPOSED WAIVER used to drive it EFFECTIVE while emitting `DecisionEffective`, so the waiver became effective
 * with NO `WaiverGranted` fact recorded. The refusal that closed that hole is why this Slice uses `GrantWaiver`.
 *
 * ⚠ AND THE ACTOR IS `JOURNEY_ACTOR` BY NECESSITY. `requestWaiver` sets `authority: command.issuedBy` — the
 * declared authority is not the caller's to choose — and `GrantWaiver` re-reads it: `grantWaiver` is built from
 * `makeDecisionEffective` (governance.ts:656, :283) whose PROPOSED -> EFFECTIVE guard refuses unless the RECORDED
 * `authority.actorType` is `HUMAN` (:317-320). Nothing in the payload can forge it, so "a HUMAN" is enforced and
 * unforgeable.
 *
 * ⚠ AND THAT IS THE WHOLE OF WHAT "AN AUTHORIZED HUMAN" GETS HERE — STATED SO THE ARRANGEMENT IS NOT MISTAKEN
 * FOR A SATISFIED ANTECEDENT. The engine performs NO authorization check beyond `actorType === 'HUMAN'`. ASR-14's
 * other limb — *"Critical integrity failures … cannot be waived by ordinary product authority — waiver authority
 * is tiered"* — is unenforceable in this build, and the repository already records it twice, in the two files
 * this Slice's clause (d) is asserted against: `waiver-authorization.ts`'s own header says the tier limb is left
 * unchecked because **"no field on the Decision records an authority tier"**, and `rejectUnauthorizedWaiver`'s
 * docblock (`pwu.ts:1404-1408`) repeats it. `resolveWaiverAuthorization` does not read `authority` at all: it
 * reads existence, objectType, parse, `decisionType`, `status`, subjects and the version pin. So a HUMAN of any
 * standing whatever can grant this waiver, and no clause of RPH-E2E-004 as ratified would catch it.
 */
function grantScopedWaiver(j: Journey): void {
	j.send('RequestWaiver', 'DECISION', WAIVER, {
		subjectObjectIds: [PWU],
		scope: 'criterion SJ-01 of the Slice Journey Architecture Review, on the Architecture PWU at version 1',
		rationale: WAIVER_RATIONALE,
		duration: WAIVER_DURATION,
		affectedObjectIds: [PWU],
		waivedPolicyId: JOURNEY_POLICY,
		waivedCriterionId: 'SJ-01',
		waivedFindingIds: [OBS_WAIVED],
		expiresAt: WAIVER_EXPIRES,
		compensatingControls: ['quarterly tenant-isolation review by the security discipline'],
		reviewConditions: ['re-assess at the next architecture semantic version']
	});
	j.send('GrantWaiver', 'DECISION', WAIVER, { waiverDecisionId: WAIVER, duration: WAIVER_DURATION });
}

/**
 * Carry the waived verdict onto the work itself.
 *
 * ⚠ FOUR HOPS, NOT ONE, FOR THE REASONS THE E2E-002 SLICE ESTABLISHED: `PWU.assuranceState` has no
 * `UNASSESSED -> ASSESSING` arrow and `workLifecycleState` has no `EXECUTING -> UNDER_ASSURANCE` arrow, so both
 * machines are walked along their ratified paths, an axis holding at its current value where it is not moving.
 *
 * ⚠ THE LAST HOP IS THE ONE THIS RULE IS ABOUT, AND ITS SUPPORTING OBJECT CHANGES. The first three cite the
 * ASSESSMENT; the WAIVED hop cites the WAIVER, because `rejectUnauthorizedWaiver` resolves the citation as a
 * Decision and an assessment is refused there as a CATEGORY ERROR ("is a ASSURANCE_ASSESSMENT, not a DECISION").
 * That refusal is driven in `O-d` rather than described here.
 *
 * ⚠ AND `workLifecycleState` HOLDS AT `UNDER_ASSURANCE`. There is no `UNDER_ASSURANCE -> WAIVED` arrow on the
 * lifecycle machine at all — WAIVED is not one of its twenty values — so a waived PWU stays under assurance while
 * its assurance axis reads WAIVED. The ratified clause says "assurance becomes waived", and it is the ASSURANCE
 * axis that does; a reader must not conclude from this green that the work lifecycle reaches a waived state,
 * because that state does not exist.
 */
function carryWaiverToPwu(j: Journey): void {
	const hop = (
		previousState: string,
		newState: string,
		assuranceState: string,
		supporting: readonly string[]
	): void =>
		changeState(j, PWU, {
			previousState,
			newState,
			executionState: 'SUCCEEDED',
			assuranceState,
			supportingObjectIds: supporting
		});
	hop('EXECUTING', 'EVIDENCE_PENDING', 'EVIDENCE_REQUIRED', [ASSESSMENT]);
	hop('EVIDENCE_PENDING', 'EVIDENCE_PENDING', 'READY_FOR_ASSESSMENT', [ASSESSMENT]);
	hop('EVIDENCE_PENDING', 'UNDER_ASSURANCE', 'ASSESSING', [ASSESSMENT]);
	hop('UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'WAIVED', [WAIVER]);
}

/**
 * Build the baseline package around the waiver and approve it. Promotion is a separate act, because two tests
 * promote the SAME baseline under different required-assessment sets and must not share the outcome.
 *
 * ⚠ THE WAIVER DECISION IS A BASELINE ITEM, AND THAT IS THE MECHANISM CLAUSE (e) RUNS ON.
 * `CreateBaselinePayload.itemObjectIds` is `z.array(z.string())` with no type restriction, and `createBaseline`
 * pins each id to the version the store currently holds. So "the baseline package includes the waiver" is not a
 * metaphor here: the waiver is frozen alongside the work it qualifies, at the version it was granted against.
 */
function baselineIncludingWaiver(j: Journey): void {
	j.send('CreateBaseline', 'BASELINE', BASELINE, {
		baselineType: 'ARCHITECTURE',
		itemObjectIds: [PWU, WAIVER],
		assuranceAssessmentIds: [ASSESSMENT]
	});
	j.send('SubmitBaselineForReview', 'BASELINE', BASELINE, {});
	j.send('ApproveBaseline', 'BASELINE', BASELINE, {});
	// The promotion authority. It must NAME the baseline: `canPromoteBaseline` raises
	// PROMOTION_DECISION_OUT_OF_SCOPE otherwise (REG-F-073 — before that, any effective promotion decision in the
	// store authorized any promotion). It names the waiver too, because the waiver is one of the items it freezes.
	j.send('ProposeDecision', 'DECISION', PROMOTION, {
		decisionType: 'PROMOTE_BASELINE',
		subjectObjectIds: [PWU, BASELINE, WAIVER],
		selectedOption: 'promote',
		rationale: 'The architecture is baselined with the material finding waived and its residual accepted.',
		authority: JOURNEY_ACTOR
	});
	j.send('ApproveDecision', 'DECISION', PROMOTION, {
		selectedOption: 'promote',
		rationale: 'The architecture is baselined with the material finding waived and its residual accepted.',
		consideredEvidenceIds: [],
		consideredObservationIds: [OBS_WAIVED, OBS_OTHER],
		subjectSemanticVersions: { [PWU]: 1, [BASELINE]: 1, [WAIVER]: 1 }
	});
}

const promote = (j: Journey, requiredAssessmentIds: readonly string[]) =>
	j.attempt('PromoteBaseline', 'BASELINE', BASELINE, {
		promotionDecisionId: PROMOTION,
		expectedItemObjectVersions: [
			{ objectId: PWU, semanticVersion: 1 },
			{ objectId: WAIVER, semanticVersion: 1 }
		],
		requiredAssessmentIds
	});

const waiverRow = (j: Journey) =>
	buildAssuranceView(j.engine.readAllEvents()).assessments[ASSESSMENT]?.waivers?.[0];

const observationRows = (j: Journey) =>
	buildAssuranceView(j.engine.readAllEvents()).assessments[ASSESSMENT]?.observations ?? [];

describe('SLICE E2E-004 — an authorized human waives a material finding and the finding survives it', () => {
	// ⚠⚠ THIS CLAUSE IS TRUE, AND THE INTERESTING PART IS *WHY* IT IS TRUE. "The finding remains visible" is
	// satisfied here VACUOUSLY at the object layer: `ASSURANCE_OBSERVATION` has exactly ONE command in the entire
	// registry — `RecordAssuranceObservation`, its birth — so nothing in this system can delete, edit or
	// re-dispose an observation, and no arrangement could make this half of the clause fail. `verif/
	// observation-command-surface.test.ts` pins that command surface BY NAME precisely so the day it changes is
	// visible. A Slice that asserted only the object would therefore be asserting an unfalsifiable thing.
	//
	// So the load-bearing assertion is the READ MODEL: after the grant, the assurance view still lists the waived
	// finding, with its severity, its statement and its OPEN disposition intact. That is the layer at which a
	// professional could actually lose sight of a finding, and it is where `E2E-004-M1` attacks.
	//
	// ⚠ AND NOTE WHAT DOES *NOT* HAPPEN: the disposition stays `OPEN`, not `WAIVED`. `RPH-GOV-004`'s second limb
	// — "disposition becomes WAIVED" — names a transition no dispatch performs, and the enforcement register
	// records it as such. This test asserts the E2E-004 clause, which says only "remains visible"; it must not be
	// read as evidence for the GOV-004 clause it deliberately does not claim. `O-d(absent)` drives that gap.
	it('O-b — the waived finding is still there, still OPEN, and still listed by the assurance read model after the grant', () => {
		const j = journey();
		const before = j.state(OBS_WAIVED);
		grantScopedWaiver(j);
		carryWaiverToPwu(j);

		expect(
			j.state(OBS_WAIVED),
			'granting the waiver must not alter the observation object in any respect — canon ASR-14, "a waiver accepts risk; it never rewrites truth"'
		).toEqual(before);

		const rows = observationRows(j);
		expect(
			rows.find((o) => o.observationId === OBS_WAIVED),
			'the waived finding must still be listed by the assurance read model after the grant — clause (b), at the layer where "visible" actually means something'
		).toEqual({
			observationId: OBS_WAIVED,
			findingCode: 'MISSING_SECURITY_BOUNDARY',
			severity: 'MATERIAL',
			statement: 'The tenant isolation boundary is documented but not yet evidenced end to end.',
			disposition: 'OPEN'
		});
	});

	// ⚠⚠ TWO DOCUMENTS NAME TWO DIFFERENT DATA AND THIS ENGINE STORES THEM IN TWO DIFFERENT PLACES, so the clause
	// is asserted three times rather than once:
	//
	//   RATIONALE   reaches the Decision OBJECT, the `WaiverRequested` EVENT, and the assurance READ MODEL. Fully
	//               carried, all the way to a surface.
	//   EXPIRATION  (§24's word) reaches the Decision object's `WaiverDetail` and the `WaiverRequested` event —
	//               and STOPS THERE.
	//   DURATION    (§39's word) reaches the `WaiverRequested` and `WaiverGranted` events and NOTHING ELSE. BOTH
	//               limbs are pinned below. An earlier draft asserted only the request event and left the grant's
	//               `duration` — a real field, `WaiverGrantedPayloadSchema` (messages.ts:1639-1644), written at
	//               governance.ts:693 — unread, so half of the §24-vs-§39 divergence rested on prose alone.
	//               `WaiverDetailSchema` has no `duration` field at all, which `governance.ts` states outright:
	//               it is "the one declared field with no home on `DecisionObjectSchema`".
	//
	// ⚠ AND THE EXPIRATION REACHES NO READ MODEL AND NO SURFACE. Searched in BOTH directions before this was
	// written down: `AssuranceWaiverView` declares no such field, and `grep -rn "expir" packages/rph-projections/
	// src` and `grep -rn "expiresAt" apps` are EMPTY — the concept, not merely the field name, is absent from
	// every projection and every page. The third assertion below PINS that, so the disclosure cannot outlive the
	// thing it discloses.
	//
	// This is not a narrowing of the ratified clause — the WAIVER does record both, which is what the clause says.
	// It is the operative fact a reader needs: an expiry a human cannot see is an expiry a human cannot honour,
	// and `RPH-GOV-006` (UNENFORCED_DISCLOSED in the register) is the machine-side half of the same silence — an
	// expired waiver has no effect on baseline promotion, because nothing marks a waiver as required by one.
	it('O-c — the granted waiver records its rationale and its expiration on the Decision and in the event; no read model carries the expiration', () => {
		const j = journey();
		grantScopedWaiver(j);

		const decision = (j.state(WAIVER) ?? {}) as { rationale?: string; waiver?: Record<string, unknown> };
		expect(
			decision.rationale,
			'the waiver Decision must record the rationale it was granted on — clause (c), first half'
		).toBe(WAIVER_RATIONALE);
		expect(
			decision.waiver?.expiresAt,
			'the waiver Decision must record the expiration the grant was given under — clause (c), the half §24 names and §39 does not'
		).toBe(WAIVER_EXPIRES);

		const requested = j.engine.readAllEvents().find((e) => e.eventType === 'WaiverRequested');
		const granted = j.engine.readAllEvents().find((e) => e.eventType === 'WaiverGranted');
		expect(
			requested?.payload,
			'and the governed record of the request must carry rationale, expiration AND the §39 duration together — the event is the only place all three meet'
		).toMatchObject({
			rationale: WAIVER_RATIONALE,
			expiresAt: WAIVER_EXPIRES,
			duration: WAIVER_DURATION
		});
		expect(
			(granted?.payload as { status?: string; duration?: string } | undefined)?.status,
			'and the GRANT must record that the waiver became effective — the fact REG-F-020 found missing from this very event'
		).toBe('EFFECTIVE');
		expect(
			(granted?.payload as { status?: string; duration?: string } | undefined)?.duration,
			"and the GRANT must carry the §39 duration too — the SECOND of the two events the disclosure above says DURATION reaches, pinned so that limb cannot rot while the prose keeps claiming it"
		).toBe(WAIVER_DURATION);

		// PINNED DEFECT. Written to FAIL the day a read model starts carrying the expiration, so the disclosure
		// above cannot rot into a false claim. `rationale` IS carried, in the same row, which is what makes this a
		// specific gap rather than a projection that drops everything.
		const row = waiverRow(j);
		expect(row?.rationale, 'the read model does carry the rationale — this is the control for the line below').toBe(
			WAIVER_RATIONALE
		);
		expect(
			row,
			'PINNED DEFECT: no projection and no page in this repository carries a waiver expiration — searched as a concept, not a field name. Repair that and this assertion is what tells you the disclosure above is now stale.'
		).not.toHaveProperty('expiresAt');
	});

	// ⚠⚠ THE FIRST ARM OF CLAUSE (d), AND THE ONLY AXIS IN THE SYSTEM THAT CAN CARRY IT.
	//
	// Two facts are asserted together because either alone is worthless. That the PWU's assurance axis READS
	// `WAIVED` proves nothing on its own — `C-0b` measured exactly that state being reached with
	// `supportingObjectIds: []` and no Decision of any kind, which is the hole `rejectUnauthorizedWaiver` was
	// built to close. And a refusal alone proves nothing either: a guard that refuses everything is not a guard.
	// So the test drives BOTH: the same hop, refused when it cites the assessment and accepted when it cites the
	// granted waiver, with everything else held constant.
	//
	// ⚠ THE REFUSED CITATION IS THE ASSESSMENT, NOT NOTHING, AND THAT IS DELIBERATE — AND THE ARGUMENT IS NOW
	// ASSERTED RATHER THAN ONLY ARGUED. Citing an empty list is refused too, and `with no authorized waiver to
	// back it` is a CONSTANT PREFIX of that refusal (`pwu.ts:1443-1452`), so the first message assertion below
	// passes identically for `supportingObjectIds: []`. Driven both ways to be sure: the empty list returns
	// … `Supplied: [nothing].`, and citing the assessment returns `Supplied: [<id>: <id> is a
	// ASSURANCE_ASSESSMENT, not a DECISION].` — the interpolated half at `pwu.ts:1451`, carrying
	// `resolveWaiverAuthorization`'s category error. THAT is the only part of the message that distinguishes the
	// two arrangements, and it is what the second assertion reads: without it this test's own account of why it
	// cites the assessment would be unproven, and the arrangement could be swapped for `[]` with the suite still
	// green. The message is asserted, not the code: an `RPH_INVARIANT_VIOLATION` here is emitted by many guards
	// and would not tell them apart.
	//
	// ⚠ AND `UNDER_ASSURANCE` HOLDS ON THE LIFECYCLE AXIS THROUGHOUT. See `carryWaiverToPwu`: there is no waived
	// work-lifecycle state to reach. A reader must not take this green as evidence that the WORK became waived.
	it('O-d — the PWU assurance axis becomes WAIVED, and only because an EFFECTIVE version-bound waiver Decision backs it', () => {
		const j = journey();
		grantScopedWaiver(j);
		changeState(j, PWU, {
			previousState: 'EXECUTING',
			newState: 'EVIDENCE_PENDING',
			executionState: 'SUCCEEDED',
			assuranceState: 'EVIDENCE_REQUIRED',
			supportingObjectIds: [ASSESSMENT]
		});
		changeState(j, PWU, {
			previousState: 'EVIDENCE_PENDING',
			newState: 'EVIDENCE_PENDING',
			executionState: 'SUCCEEDED',
			assuranceState: 'READY_FOR_ASSESSMENT',
			supportingObjectIds: [ASSESSMENT]
		});
		changeState(j, PWU, {
			previousState: 'EVIDENCE_PENDING',
			newState: 'UNDER_ASSURANCE',
			executionState: 'SUCCEEDED',
			assuranceState: 'ASSESSING',
			supportingObjectIds: [ASSESSMENT]
		});

		const unbacked = j.attempt('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', PWU, {
			previousState: 'UNDER_ASSURANCE',
			newState: 'UNDER_ASSURANCE',
			executionState: 'SUCCEEDED',
			assuranceState: 'WAIVED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: [ASSESSMENT]
		});
		expect(unbacked.status, 'the un-backed waive must not be accepted').not.toBe('ACCEPTED');
		expect(
			JSON.stringify(unbacked.error ?? {}),
			'assurance must not read WAIVED unless an authorized, version-bound waiver Decision backs it — clause (d), and the guard that makes the word mean something'
		).toContain('with no authorized waiver to back it');
		expect(
			JSON.stringify(unbacked.error ?? {}),
			"and the refusal must say which KIND of thing it demands — the `Supplied:` clause carries `resolveWaiverAuthorization`'s CATEGORY error, and it is the only part of this message that an empty citation would not have produced",
		).toContain(`${ASSESSMENT}: ${ASSESSMENT} is a ASSURANCE_ASSESSMENT, not a DECISION`);
		expect(
			(j.state(PWU) ?? {}).assuranceState,
			'and the refused act must have changed nothing — the axis is still where it was'
		).toBe('ASSESSING');

		// The identical hop, citing the granted waiver instead.
		changeState(j, PWU, {
			previousState: 'UNDER_ASSURANCE',
			newState: 'UNDER_ASSURANCE',
			executionState: 'SUCCEEDED',
			assuranceState: 'WAIVED',
			supportingObjectIds: [WAIVER]
		});
		expect(
			(j.state(PWU) ?? {}).assuranceState,
			'assurance becomes WAIVED — clause (d), first arm, on the one axis that can carry it'
		).toBe('WAIVED');
		expect(
			(j.state(PWU) ?? {}).workLifecycleState,
			'and the work lifecycle holds at UNDER_ASSURANCE, because no waived work-lifecycle state exists'
		).toBe('UNDER_ASSURANCE');
	});

	// ⚠⚠ A FINDING, NOT A CLAUSE, AND IT IS THE ANSWER TO A QUESTION THE RECON GOT HALF RIGHT.
	//
	// SEVEN ratified machines declare a `WAIVED` value — DERIVED, not listed. Extracting each machine's `states`
	// array from `packages/rph-domain/src/transitions.data.ts` and filtering for the literal yields
	// `PWU.assuranceState` (L759), `Obligation.status` (L938), `Constraint.status` (L1020), `Claim.status`
	// (L1386), `AssuranceAssessment.disposition` (L1564), `AssuranceAssessment.state` (L1655) and
	// `AssuranceObservation.disposition` (L1873).
	//
	// ⚠ AN EARLIER DRAFT OF THIS HEADER SAID **FOUR**, HAND-ENUMERATED, AND ITS TEST NAME SAID SO TOO. This test
	// IS a census — its whole claim is "exactly ONE of N can reach it" — so a count taken from memory rather
	// than from the transition data is the enumerate-do-not-derive defect one level up from the one being
	// reported. The three it missed are not incidental: `Claim.status` declares CONTESTED -> WAIVED and
	// UNDER_ASSESSMENT -> WAIVED with trigger **`WaiverGranted`** (transitions.data.ts:1455-1466), the exact
	// event `grantScopedWaiver` emits, and this journey holds a live CLAIM. That machine is now DRIVEN below
	// rather than omitted.
	//
	// Driving them one at a time shows exactly ONE can reach it, and that the four driven others fail for FOUR
	// DIFFERENT REASONS — which is why "how many are really unreachable" could not be answered by reading:
	//
	//   `PWU.assuranceState`             REACHABLE. Driven in `O-d`.
	//   `AssuranceAssessment.state`      UNREACHABLE — no command can ask for it. The only writer of that field is
	//                                    `completeAssuranceAssessment`, which derives its landing from
	//                                    `validatorResult.dispositionRecommendation`, and
	//                                    `AssuranceDispositionRecommendationSchema` has five options that do not
	//                                    include WAIVED. Driven below: the completion is refused AT THE SCHEMA.
	//   `AssuranceAssessment.disposition` UNREACHABLE, AND NOT FOR THAT REASON. The field does not exist:
	//                                    `NOT_STATE_MACHINES` records it RETIRED (REG-F-068) as "a machine over a
	//                                    field the aggregate does not have", checked against the ratified object
	//                                    schema. Asserted below by looking for the property and not finding it.
	//   `AssuranceObservation.disposition` UNREACHABLE, AND NOT FOR EITHER OF THOSE REASONS. The field exists and
	//                                    is written — exactly once, at birth, with `OPEN`. There is no command
	//                                    that could ask for anything else; the aggregate's whole command surface
	//                                    is one creation.
	//   `Claim.status`                   UNREACHABLE, AND FOR A FOURTH REASON — no EVENT NAME exists for the
	//                                    state. `recordClaimAssessment` looks its destination up in
	//                                    `CLAIM_STATUS_EVENT` (assurance.ts:719-729), which maps SUPPORTED,
	//                                    CONTESTED, REJECTED and UNDER_ASSESSMENT only, and refuses anything
	//                                    else in its own voice rather than inventing one. Driven below TWICE:
	//                                    the refusal, and the claim standing still through the very
	//                                    `WaiverGranted` the ratified machine names as the trigger that would
	//                                    move it.
	//   `Obligation.status` /            NAMED AND NOT DRIVEN — stated rather than left as a silence. Both are
	//   `Constraint.status`              birth-only aggregates in this build: the command registry
	//                                    (`handlers/registry.ts:234-235`) holds `AssertObligation` and
	//                                    `AssertConstraint` and nothing else for either, and both births write
	//                                    `status: 'PROPOSED'`. Same shape as the observation axis above, but
	//                                    this journey creates neither object, so this Slice proves nothing
	//                                    about them.
	//
	// ⚠ AND THE ARROW CENSUS IS DELIBERATELY *NOT* CITED AS CORROBORATION, BECAUSE IT CANNOT DISCRIMINATE. An
	// earlier draft said `verif/arrow-command-census.baseline.json` "lists both of that machine's WAIVED arrows
	// among its uncovered set, which agrees". It does — and its `uncovered` array ALSO contains
	// `PWU.assuranceState  ASSESSING -> WAIVED`, the arrow `O-d` drives and asserts as ACCEPTED. All ELEVEN
	// WAIVED arrows in this build are in that list. `uncovered` there means "no declared command trigger maps
	// to this arrow", NOT "unreachable" — `ChangePwuState` is a multi-axis setter and is uncovered by
	// construction. An instrument that returns the same verdict for the subject and for the control is not
	// agreement, and reading it as agreement is exactly the failure this Slice exists to catch.
	//
	// So the ratified sentence "assurance becomes waived" is satisfied ONLY at the level of the work. Whatever a
	// reader concludes from `O-d`'s green, they must not conclude that the ASSESSMENT, the FINDING or the CLAIM
	// became waived. None can.
	it('O-d(absent) — WAIVED is reachable on the PWU axis alone; of the six other machines that declare it, four are driven unreachable for four different reasons and two are named as birth-only and not driven', () => {
		const j = journey();
		grantScopedWaiver(j);

		// 1. AssuranceAssessment.state — no validator may recommend it.
		j.send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', PROBE_ASSESSMENT, {
			assessmentId: PROBE_ASSESSMENT,
			assurancePolicyId: JOURNEY_POLICY,
			policyVersion: '1.0.0',
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimIds: []
		});
		j.send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', PROBE_ASSESSMENT, {});
		const refused = j.attempt('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', PROBE_ASSESSMENT, {
			validatorResult: verdict({
				assessmentId: PROBE_ASSESSMENT,
				subjectId: PWU,
				subjectSemanticVersion: 1,
				disposition: 'WAIVED'
			})
		});
		const issues =
			(refused.error as { details?: { issues?: { path?: string; message?: string }[] } } | undefined)?.details
				?.issues ?? [];
		// The status assertion is the direct victim of `E2E-004-M4`: widening the ratified enum makes this
		// completion legal, and no schema issue is raised at all. The message assertion below is what identifies
		// WHICH schema refused, and it is stated separately because an `RPH_VALIDATION_SCHEMA_FAILED` alone would
		// not tell the enums apart.
		expect(refused.status, 'a validator recommending WAIVED must be refused outright').not.toBe('ACCEPTED');
		expect(
			issues.map((i) => i.message).join(' | '),
			'no validator may recommend WAIVED — the schema must refuse it, which is why the assessment axis can never carry the word'
		).toContain('"SATISFIED"|"CONDITIONALLY_SATISFIED"|"REJECTED"|"INCONCLUSIVE"|"ESCALATED"');
		expect(
			(j.state(PROBE_ASSESSMENT) ?? {}).assessmentState,
			'and the assessment is left where it was, not nudged toward a state it cannot occupy'
		).toBe('ASSESSING');

		// 2. AssuranceAssessment.disposition — the field the machine is named for does not exist on the object.
		expect(
			j.state(ASSESSMENT),
			'the assessment object carries no `disposition` property at all — a machine over a field the ratified schema does not declare (REG-F-068)'
		).not.toHaveProperty('disposition');

		// 3. AssuranceObservation.disposition — one command, one write, at birth.
		expect(
			(j.state(OBS_WAIVED) ?? {}).disposition,
			'the waived finding is still OPEN — nothing in this engine can move an observation disposition, so RPH-GOV-004\'s "disposition becomes WAIVED" limb names a transition no dispatch performs'
		).toBe('OPEN');

		// 4. Claim.status — the machine names `WaiverGranted` as the trigger, and no command mints that event
		//    name for this destination. This is the machine the earlier FOUR-machine census omitted, and it is
		//    the one with the strongest prima facie case for reachability in THIS journey.
		const claimWaived = j.attempt('RecordClaimAssessment', 'CLAIM', CLAIM, { targetStatus: 'WAIVED' });
		expect(claimWaived.status, 'the claim may not be recorded WAIVED').not.toBe('ACCEPTED');
		expect(
			JSON.stringify(claimWaived.error ?? {}),
			'`Claim.status` declares two WaiverGranted-triggered arrows into WAIVED and no command can perform either — the build mints no event name for the state, and refuses rather than inventing one'
		).toContain('RecordClaimAssessment cannot record WAIVED: this build mints no event name for it');
		expect(
			(j.state(CLAIM) ?? {}).status,
			"and the grant above did not move the claim either — this journey emitted the exact `WaiverGranted` the ratified machine names as that arrow's trigger, with a live CLAIM naming the waived PWU among its subjects, and the claim did not move"
		).toBe('OPEN');
	});

	// ⚠⚠ ASSERTED AT FOUR LAYERS, BECAUSE "INCLUDES" IS A DIFFERENT CLAIM AT EACH ONE and an engine can carry the
	// waiver into one and drop it from the next:
	//   the Baseline OBJECT's frozen `itemObjectVersions`  — what the engine COMMITTED, and what scopes the gate;
	//   the `BaselineCreated` EVENT                        — what a rebuild replays;
	//   the `BaselinePromoted` EVENT                       — what the authoritative record says was baselined;
	//   the traceability PROJECTION's `BASELINES` link     — what a surface can render.
	//
	// ⚠ "WHAT SCOPES THE GATE" IS EXACT, AND THE LOOSER PHRASING IT REPLACES WAS WRONG. The frozen set reaches
	// `canPromoteBaseline` only as `baselineItemIds` (governance.ts:917-921), which bounds the open-observation
	// and contested-claim arms. It is NOT the version arm's input: `candidateItems` comes from
	// `p.expectedItemObjectVersions` (:896) and is passed as `reviewedItems` too (:929), so RPH-BAS-002's
	// reviewed-vs-promoted comparison is a SELF-comparison at this call site and can never fire. Recorded here
	// because it is a real engine fact, and because `E2E-004-M5`'s rationale used to state the opposite.
	//
	// ⚠ THE PROMOTION HERE CITES NO REQUIRED ASSESSMENT, AND SAYING SO IS THE POINT OF THE NEXT TEST. This one
	// asserts what the baseline package CONTAINS; `O-e(disclosure)` drives what happens when the same promotion
	// names the assessment, and the two must not be conflated. Passing `[]` is not a weakening of clause (e) —
	// clause (e) is about the package's contents — but it IS an arrangement choice, and it is stated rather than
	// left for a reader to discover in the payload.
	//
	// ⚠ AND THE PROMOTION SUCCEEDS ONLY BECAUSE THE FINDING IS MATERIAL. `BLOCKING_SEVERITIES` is
	// `{BLOCKING, CRITICAL}`, so `findOpenBlockingObservations` sees nothing here. With a BLOCKING finding this
	// promotion would be refused `OPEN_BLOCKING_FINDING` — which is `RPH-E2E-002`'s clause (e), the mirror image
	// of this one. The waiver is NOT what unblocks this promotion, and a reader must not think it is: no code
	// path consults it. See `O-f`.
	it('O-e — the baseline package includes the waiver: frozen in the Baseline, in both baseline events, and projected as a BASELINES link', () => {
		const j = journey();
		grantScopedWaiver(j);
		carryWaiverToPwu(j);
		baselineIncludingWaiver(j);

		expect(
			(j.state(BASELINE) ?? {}).itemObjectVersions,
			'the waiver Decision must be frozen INTO the baseline package, not merely mentioned near it — clause (e), read off the Baseline the engine committed'
		).toEqual([
			{ objectId: PWU, semanticVersion: 1 },
			{ objectId: WAIVER, semanticVersion: 1 }
		]);

		const created = j.engine.readAllEvents().find((e) => e.eventType === 'BaselineCreated');
		expect(
			(created?.payload as { itemObjectIds?: string[] } | undefined)?.itemObjectIds,
			'and the creation event must record the waiver among the items, so a rebuild reproduces the package'
		).toEqual([PWU, WAIVER]);

		const promoted = promote(j, []);
		expect(
			promoted.status,
			`the promotion must be accepted for this Slice to say anything about the promoted record: ${JSON.stringify(promoted.error ?? {})}`
		).toBe('ACCEPTED');

		const promotedEvent = j.engine.readAllEvents().find((e) => e.eventType === 'BaselinePromoted');
		expect(
			(promotedEvent?.payload as { itemObjectVersions?: { objectId: string }[] } | undefined)?.itemObjectVersions?.map(
				(i) => i.objectId
			),
			'and the authoritative record must say the waiver was baselined with the work — clause (e) at the layer an auditor reads'
		).toEqual([PWU, WAIVER]);

		const trace = rebuildProjection(traceabilityProjector, j.engine.readAllEvents());
		expect(
			outboundLinks(trace, BASELINE, 'BASELINES').map((l) => l.to),
			'and the waiver must be reachable FROM the baseline in the projection a surface renders'
		).toEqual([PWU, WAIVER]);
	});

	// ⚠⚠ THE CONSEQUENCE OF `O-d(absent)`, DRIVEN RATHER THAN INFERRED — and it is the sharpest thing this Slice
	// found.
	//
	// `PROMOTABLE_DISPOSITIONS` in the baseline gate is `{SATISFIED, WAIVED}`, and its own comment explains the
	// second member: "WAIVED = an authorized waiver carries the residual (§39 Scenario 4)". That is this exact
	// rule, named in the kernel. But the value it tests is `assessmentState`, and `assessmentState` can never be
	// WAIVED — so the arm is dead by construction, and the residual is carried by nobody.
	//
	// Driven below: the SAME baseline, the SAME granted waiver, the SAME promotion decision, differing from `O-e`
	// in one field — `requiredAssessmentIds` names the assessment — is REFUSED, and refused
	// `REQUIRED_ASSESSMENT_NOT_SATISFIED`. The waiver is EFFECTIVE, names the PWU, pins its version, and changes
	// nothing about this outcome.
	//
	// WHAT THIS DOES NOT SAY: that the engine is wrong to refuse. A CONDITIONALLY_SATISFIED assessment has unmet
	// conditions and the kernel's comment says so. What it says is that the ratified sentence "assurance becomes
	// waived OR conditionally satisfied … the baseline package includes the waiver" describes a path the engine
	// can only walk by NOT naming its assessment — and that is a gap in the rule's realization, not a bug in the
	// gate.
	it('O-e(disclosure) — the granted waiver does not carry a conditionally-satisfied required assessment past the promotion gate; the gate\'s WAIVED arm is unreachable', () => {
		const j = journey();
		grantScopedWaiver(j);
		carryWaiverToPwu(j);
		baselineIncludingWaiver(j);

		const refused = promote(j, [ASSESSMENT]);
		expect(refused.status, 'the promotion naming the assessment must not be accepted').not.toBe('ACCEPTED');
		expect(
			JSON.stringify(refused.error ?? {}),
			'a conditionally-satisfied required assessment must still refuse the promotion — the granted waiver does not carry it past the gate'
		).toContain('REQUIRED_ASSESSMENT_NOT_SATISFIED');
		expect(
			(j.state(BASELINE) ?? {}).status,
			'and the baseline is still APPROVED — a refused promotion promotes nothing'
		).toBe('APPROVED');
		// The disposition the gate WOULD have admitted, and the reason it never arrives.
		expect(
			(j.state(ASSESSMENT) ?? {}).assessmentState,
			'the assessment is CONDITIONALLY_SATISFIED and can never be WAIVED, so PROMOTABLE_DISPOSITIONS\'s WAIVED member is tested against a value nothing writes'
		).toBe('CONDITIONALLY_SATISFIED');
	});

	// ⚠⚠ THE CLAUSE HOLDS, AND DRIVING IT SHOWS THE ENGINE HOLDS SOMETHING STRONGER AND WEAKER AT ONCE.
	//
	// STRONGER: the unrelated finding is not merely "unaffected" — it is UNTOUCHABLE, for the same reason the
	// waived one is (`O-b`). Nothing can alter any observation.
	//
	// WEAKER, AND STATED NARROWLY BECAUSE THE GENERAL FORM OF IT IS FALSE.
	//
	// ⚠ AN EARLIER DRAFT OF THIS HEADER SAID THE SCOPE "is recorded and consulted by NOTHING" AND "referenced
	// by no guard". THAT WAS WRONG, and wrong in the worst direction available in this exercise: an ABSENCE
	// recorded over something PRESENT. Three of the recorded scope fields have live production readers, and all
	// three were established by DRIVING, not by grepping the field name:
	//
	//   `waivedCriterionId`     READ BY A GUARD. `requestWaiver` tests it against the waived POLICY's
	//                           `waiverRules` at rph-application/src/handlers/governance.ts:553 —
	//                           `r.eligibleCriteriaIds.includes(p.waivedCriterionId)`. Driven under a policy
	//                           that declares rules: `RequestWaiver` is REJECTED
	//                           `RPH_VALIDATION_SEMANTIC_FAILED`, verbatim: "RequestWaiver: policy pol_[id] does
	//                           not permit waiving criterion 'SJ-99-DOES-NOT-EXIST' — no waiver rule allows it
	//                           (DOC-004 §12 waiverRules)."
	//   `compensatingControls`  READ BY THE SAME GUARD, at :563. Driven: an ELIGIBLE criterion whose rule
	//                           requires a control the request omits is REJECTED too, verbatim: "RequestWaiver:
	//                           policy pol_[id]'s waiver rule requires compensating control(s) [quarterly review]
	//                           that the request does not declare (DOC-004 §12.2 / JCPWA §36.4 — a waiver
	//                           may not drop a control to nothing)."
	//   `waivedPolicyId`        READ BY THE PROJECTION, as its ATTACHMENT PREDICATE. `foldWaiverRequested`
	//                           (rph-projections/src/assurance-view.ts:301, :312) attaches a waiver only to
	//                           assessments under that policy, and governance.ts:614 states it in terms. The
	//                           waiver `waiverRow()` finds below is found BY this field.
	//
	// ⚠ AND THE WHOLE OF THAT GUARD IS SKIPPED IN THIS JOURNEY. THIS IS THE ARRANGEMENT DEPENDENCY THE FINDING
	// RESTS ON, and it is disclosed here rather than left for a reader to discover in a helper: governance.ts:
	// 549-550 makes the entire waiver-rules gate conditional on `waiverRules.length > 0`, and `seedJourneyPolicy`
	// declares NO `waiverRules` — `createAssurancePolicy` stores `p.waiverRules ?? []`, so the policy this
	// journey is judged under carries the empty array and the gate never runs. It is PINNED below, so this
	// disclosure cannot outlive the arrangement it depends on.
	//
	// WHAT SURVIVES IS NARROWER, AND IS WHAT THIS TEST ASSERTS:
	//   1. `waivedFindingIds` is read by NO GUARD ANYWHERE. Searched in both directions over `packages/**/src`
	//      and `apps/**/src`: its only production readers are the projection fold that copies it into the read
	//      model (assurance-view.ts:308) and the demo page that renders it
	//      (`apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:340`). Nothing DECIDES anything on it.
	//   2. `resolveWaiverAuthorization` — the only production reader of a waiver AT THE POINT OF USE — reads
	//      NEITHER scope field. Its own docblock says SEVEN ordered checks and there are seven
	//      (waiver-authorization.ts:49, :54-116): the object exists, it is a DECISION, it PARSES as one, its
	//      `decisionType` is WAIVER, its `status` is EFFECTIVE, it names this object, and it pins this semantic
	//      version. An earlier draft of this paragraph said "four questions" and omitted the existence check,
	//      the parse check and — notably — the `objectType !== 'DECISION'` check, which is the very limb `O-d`'s
	//      arrangement is chosen to exercise.
	//   3. The kernel predicate `waiverCovers` (rph-domain/src/governance.ts:127-137), which exists precisely to
	//      answer "does this waiver cover this criterion", has NO production caller. The enforcement register
	//      says so in terms (REG-F-202) and a grep over `packages/**/src` agrees: unit test and register only.
	//
	// So the criterion is checked ONCE, at the door, by a rule THIS policy does not declare, and never again.
	// Under `seedJourneyPolicy` this waiver would have authorized the WAIVED hop just as well had it named a
	// criterion that does not exist and no finding at all — driven, and ACCEPTED. Under a policy that DOES
	// declare waiver rules the same request is refused at the door and the WAIVED hop is never reachable, so the
	// counterfactual is a fact about this ARRANGEMENT and not about the engine. "Unrelated findings remain
	// unaffected" is TRUE either way, and true for a reason that gives a professional nothing at the point of
	// use: the waiver does not reach findings, related or unrelated.
	//
	// What is asserted, then, is the strongest true thing: the unrelated finding is byte-identical after the
	// grant, the waiver's RECORDED scope names one finding and not the other, and the policy that would have
	// policed that scope declares no rule. The middle one is where `E2E-004-M7` attacks, because a projection
	// that widened the recorded scope would be the one way this fact could quietly become false.
	it('O-f — the unrelated finding is untouched by the grant; the recorded waiver scope names the waived finding alone, and this policy declares no waiver rule that would police it', () => {
		const j = journey();
		const before = j.state(OBS_OTHER);
		grantScopedWaiver(j);
		carryWaiverToPwu(j);

		expect(
			j.state(OBS_OTHER),
			'the unrelated finding must be unchanged in every respect by a waiver that never named it — clause (f)'
		).toEqual(before);

		// ⚠ THIS TEST DELIBERATELY READS NO OBSERVATION ROW FROM THE PROJECTION, AND THE OMISSION IS `SL-3a`, NOT
		// an oversight. The obvious assertion here — "both findings are still projected, side by side" — was
		// WRITTEN, DRIVEN GREEN, AND THEN REMOVED: `E2E-004-M1` empties the observation fold, so that line would
		// have reddened in `O-b` and here at once, and a mutant that reddens two clauses proves neither. The
		// unrelated finding's survival is asserted on its OBJECT above, which M1 does not touch; its projected
		// visibility is `O-b`'s claim about the same fold and is not restated here as if it were independent.
		const row = waiverRow(j);
		expect(
			row?.waivedFindingIds,
			'the projected waiver must name the ONE finding it waives and no other — the recorded scope is all the scoping there is'
		).toEqual([OBS_WAIVED]);
		expect(
			row?.waivedCriterionId,
			"and the criterion it was granted against — read ONCE, at the door, by `requestWaiver`'s waiverRules gate, and by nothing at the point of use: `resolveWaiverAuthorization` never consults it and `waiverCovers`, which would, has no production caller"
		).toBe('SJ-01');
		expect(row?.status, 'and it is EFFECTIVE — this is a granted waiver, not a request').toBe('EFFECTIVE');

		// PINNED ARRANGEMENT DEPENDENCY. Everything above about the criterion being unpoliced is true ONLY
		// because this policy declares no `waiverRules`: governance.ts:549-550 skips `requestWaiver`'s criterion
		// and compensating-control checks entirely when the array is empty, and both of those checks DO read the
		// recorded scope. Written to FAIL the day `seedJourneyPolicy` declares a rule, because on that day the
		// disclosure above is stale and the counterfactual it rests on stops holding. Same discipline as the
		// `expiresAt` pin in `O-c`: a disclosure that cannot rot.
		expect(
			(j.state(JOURNEY_POLICY) ?? {}).waiverRules,
			'PINNED ARRANGEMENT DEPENDENCY: the waived policy declares no waiverRules, so requestWaiver\'s criterion and compensating-control checks never run in this journey. Declare one and O-f\'s disclosure must be rewritten, because the counterfactual it states would then be REFUSED at the door.'
		).toEqual([]);
	});
});
