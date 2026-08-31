// THE WORKBENCH DEMO SIGN-OFF POLICY — one definition, read by every assurance act the surface offers.
//
// ── WHY IT IS A MODULE AND NOT A LITERAL IN A ROUTE ACTION ────────────────────────────────────────────────────
// It was inline in `recordAssurance`. The moment a SECOND assurance act needed the same policy (S-1b's blocking
// finding), copying it would have produced two definitions of one governed object — which is exactly how four
// restatements of `AssessmentCriterion` came to disagree with each other and with the ratified shape
// (`assessment-criterion-contract.test.ts`). A policy is a governed object; it gets one home.
//
// ── ⚠ AND IT NOW DECLARES `dispositionRules`, WHICH IT DID NOT (S-1b / DESIGN-blocking-finding-capability §2) ──
// GATE C in `completeAssuranceAssessment` — `rejectForeclosedDisposition`, the DOC-004 §10.3 foreclosure — reads
// the POLICY's own rule:
//
//     const dispositionRule = (dispositionRules ?? []).find((r) => r?.disposition === disposition);
//     const forbidden = new Set(dispositionRule?.forbiddenOpenSeverities ?? []);
//     if (forbidden.size === 0) return null;          // ← no rule, no foreclosure
//
// `dispositionRules` is `.optional()` on `CreateAssurancePolicyPayload`, and this policy declared none. So on the
// only assurance surface the workbench has, **an operator could record a BLOCKING finding and still sign the work
// off SATISFIED.** The gate is correct, reachable, and was switched off by omission. An optional policy field
// that defaults to "no constraint" is a gate disabled by silence, which is the hardest kind to see.
import type { AssuranceSeverity } from '@janumipwb/rph-contracts';

/** The demo policy's stable id. */
export const DEMO_POLICY_ID = 'pol_01ARZ3NDEKTSV4RRFFQ69GDEM0';
export const DEMO_POLICY_VERSION = '1.0.0';
/** The finding code the adverse arm records against. Declared in `findingDefinitions` below. */
export const DEMO_FINDING_CODE = 'DEMO_UNFIT';
/**
 * The one evidence requirement this policy declares (JAN-SLICE-SWP-06).
 *
 * ⚠ EXPORTED SO THE ROUTE CANNOT TYPE A STRING THAT DRIFTS FROM THE POLICY. `submitEvidenceForAssessment` fails
 * closed on a `satisfiesRequirementId` the policy does not declare, so a literal in the action and a literal here
 * are two copies of one id whose disagreement would surface as a refusal nobody could explain. One home, the same
 * rule this module's header states for the policy itself.
 */
export const DEMO_EVIDENCE_REQUIREMENT_ID = 'DEMO-EV-01';

/** The severities that forbid a SATISFIED sign-off while still OPEN (DOC-004 §10.3's default ladder). */
export const DEMO_FORBIDDEN_OPEN_SEVERITIES: readonly AssuranceSeverity[] = ['BLOCKING', 'CRITICAL'];

/**
 * The `CreateAssurancePolicy` payload for the demo sign-off policy.
 *
 * ⚠ VERSIONING IS DISCLOSED, NOT AUTOMATED. The route creates this policy only if `DEMO_POLICY_ID` does not
 * already exist, so a DURABLE host that created it before `dispositionRules` landed keeps the old, unforeclosed
 * definition. Editing a live policy's meaning under the same version is precisely what `semanticVersion` and
 * `EditAssurancePolicy` exist to prevent, and silently re-writing it here would be the surface authoring a
 * governance change nobody decided. Test mode resets per spec, so E2E always gets this definition; a durable host
 * needs a deliberate policy version bump, which is a governance act and not this module's to perform.
 */
export const DEMO_POLICY_PAYLOAD = {
	policyId: DEMO_POLICY_ID,
	version: DEMO_POLICY_VERSION,
	name: 'Workbench Demo Sign-off',
	purpose: 'Operator sign-off that the demo PWU produced its expected output.',
	rationale:
		'The interactive demo drives the assurance axis; this assessment backs a SATISFIED disposition. Independence NONE — the operator is the reviewer.',
	applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
	evaluatedClaimTypes: ['FITNESS'],
	criteria: [
		{
			id: 'DEMO-01',
			name: 'Expected output present',
			description: 'The PWU has produced its declared expected output.',
			criterionType: 'QUALITATIVE',
			evaluationMethod: 'HUMAN_JUDGMENT',
			requiredEvidenceIds: [],
			severityIfNotMet: 'MATERIAL',
			mayBeNotApplicable: false
		}
	],
	evaluatorRole: 'REVIEWER',
	// NONE, and said out loud: one operator plays producer and reviewer in a standalone demo. Requiring a distinct
	// evaluator needs a second identity this host does not have. The field is enforced
	// (`assurance-independence.test.ts`); what is weak here is the DECLARATION, and it is weak on purpose.
	independenceRequirement: 'NONE',
	// GATE C's input. Without this the §10.3 foreclosure below cannot fire at all — see the header.
	dispositionRules: [
		{
			disposition: 'SATISFIED',
			condition: {},
			forbiddenOpenSeverities: [...DEMO_FORBIDDEN_OPEN_SEVERITIES]
		}
	],
	findingDefinitions: [
		{
			code: DEMO_FINDING_CODE,
			name: 'Output not fit for the approved need',
			description: 'The declared expected output is absent or does not serve the need.',
			defaultSeverity: 'MATERIAL',
			affectedClaimTypes: ['FITNESS'],
			defaultControlActions: ['GATHER_CONTEXT']
		}
	],
	permittedControlActions: ['CONTINUE', 'GATHER_CONTEXT'],
	// ── THE DECLARED EVIDENCE REQUIREMENT (JAN-SLICE-SWP-06) ──────────────────────────────────────────────────
	//
	// ⚠ WITHOUT THIS FIELD `SubmitEvidenceForAssessment` IS UNREACHABLE, AND NOT BY OVERSIGHT — BY DESIGN.
	// `submitEvidenceForAssessment` refuses any submission whose `satisfiesRequirementId` is not declared by the
	// assessment's policy: *"evidence can only be submitted against a declared requirement"* (DOC-004 §6.1),
	// failing closed so that "missing evidence" cannot be reduced by evidence satisfying nothing anyone asked
	// for. This policy declared none, so the command could be dispatched and could never be ACCEPTED. That is
	// the real shape of F-4's "the evidence stage has no browser path": not an absent route, an undeclared
	// requirement.
	//
	// ⚠⚠ `cardinality: 'ZERO_OR_MORE'` IS THE LOAD-BEARING FIELD, AND THE SITES IT ACTS ON ARE NAMED EXACTLY
	// BECAUSE A FIRST DRAFT NAMED THEM WRONG. The engine reads cardinality through one predicate —
	// `demandsAnInstance = cardinality !== 'ZERO_OR_MORE'` — at four sites. The two that keep THIS policy
	// behaviour-preserving are:
	//   • `requiredEvidenceIds` in `requestAssuranceAssessment` — the set that decides the assessment's BIRTH
	//     state and sources §38's "missing evidence". Filtered out, so the assessment is born READY and the view
	//     reports nothing missing.
	//   • `unmet` in Gate A (`rejectUnmetRequiredEvidence`) — filtered out, so a SATISFIED disposition is not
	//     refused for want of evidence.
	// ⚠ THE §30 `EVIDENCE_PENDING -> READY` ARROW IS **NOT** ONE OF THEM, and an earlier version of this
	// comment claimed it was. That site filters `requiredForDispositions === 'ALL'` FIRST, which discards a
	// `SATISFIED_ONLY` requirement before cardinality is ever consulted — and the assessment never reaches that
	// arrow anyway, being born READY. Citing a gate this policy cannot reach as the reason it is safe would have
	// been a plausible explanation for a true conclusion, which is the hardest kind of wrong to notice.
	//
	// So the requirement is DECLARED, making submission legal, and DEMANDS NOTHING at either live site — every
	// existing assurance path behaves exactly as before, and a sign-off with no evidence at all is still
	// ACCEPTED. **Adding a demanding requirement would have retroactively invalidated every evidence-free
	// sign-off this surface offers**, which is a governance change nobody decided.
	//
	// ⚠ "BEHAVIOUR-PRESERVING" IS PRECISE, NOT ABSOLUTE: no consumer's OUTPUT changes except one, and that one
	// IS the change — `submitEvidenceForAssessment`'s declared-requirement reader is deliberately UNFILTERED by
	// cardinality, so it stops refusing. The stored ASSURANCE_POLICY object also changes shape (no
	// `requiredEvidence` -> one) under an unbumped version; see the versioning note below.
	//
	// The pairing reads odd and is coherent: the two fields answer different questions. `requiredForDispositions`
	// says WHICH dispositions a requirement bears on; `cardinality` says HOW MANY instances are demanded. Taken
	// together — *this evidence bears on a SATISFIED verdict, and zero instances is acceptable* — which is
	// precisely what an `independenceRequirement: NONE`, `HUMAN_JUDGMENT` operator sign-off should say about
	// supporting evidence.
	//
	// ⚠ THIS IS NOT A FIX FOR `REG-F-022`, AND MUST NOT BE REPORTED AS ONE. What changes here is reachability,
	// not enforcement: the requirement is non-demanding, so the gating this policy sees stays vacuous.
	//
	// ⚠⚠ AND IT IS NOT "THE FIRST IN THE PRODUCT" — AN EARLIER VERSION OF THIS NOTE SAID SO AND IT IS FALSE.
	// MEASURED: `packages/rph-product-realization-pwa/vocab/m8-ontology.json` has `pol_intent_fidelity` (7
	// requirements) and `pol_intent_completeness` (6), THIRTEEN in total and several `AT_LEAST_ONE` — genuinely
	// demanding, and seeded since REG-E-026. The claim was inherited from engine comments that still assert
	// "no production path declares requiredEvidence on any policy"; those are stale too, and stale in the
	// direction that makes Gate A look unreachable when it is not. Filed as REG-F-308 rather than amended here,
	// because they belong to another programme's records. What is true of THIS policy is only that it is the
	// first to declare a requirement that demands nothing.
	//
	// ⚠ VERSIONING, ON THE SAME TERMS THE HEADER ALREADY SETS. `DEMO_POLICY_VERSION` is NOT bumped, following the
	// precedent of `dispositionRules`: the route creates this policy only when `DEMO_POLICY_ID` is absent, so a
	// durable host that created it earlier keeps the old definition and its operator will find submission
	// refused. Test mode resets per spec, so E2E always gets this one. Bumping the version is a governance act
	// and is still not this module's to perform.
	requiredEvidence: [
		{
			id: DEMO_EVIDENCE_REQUIREMENT_ID,
			// ⚠ DECLARATORY, NOT ENFORCED: `submitEvidenceForAssessment` never loads the Evidence object, so it
			// does not check a submission's type against this. It states what the policy expects; it refuses
			// nothing.
			evidenceType: 'ARTIFACT',
			description: 'An artifact supporting the operator’s sign-off that the PWU produced its output.',
			purpose: 'Let a sign-off cite something outside the reviewer’s own judgement.',
			cardinality: 'ZERO_OR_MORE',
			admissibilityRules: [],
			requiredForDispositions: 'SATISFIED_ONLY',
			// ⚠ FALSE, FOLLOWING THE RATIFIED FAIL-CLOSED CONVENTION. Nothing reads this field today, so the
			// value is free either way — which is exactly why it should be the conservative one.
			// `doc004-conformance.test.ts` states the ground: "the corpus nowhere states that a requirement may
			// be waived". This policy sits outside that test's population and would have escaped it; a default
			// that escapes its own convention by accident of population is how a permission gets granted that
			// nobody decided to grant.
			mayBeWaived: false
		}
	]
} as const;
