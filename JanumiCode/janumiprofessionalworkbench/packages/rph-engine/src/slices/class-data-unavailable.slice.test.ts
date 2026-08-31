// JAN-SLICE-SWP-03 — the ENGINE Slice for the ratified scenario class `data-unavailable path`.
//
// THE STORY, and it is one story rather than a bag of refusals. The Field Service reference undertaking names
// "Network unavailable during field update" and "Technician unavailable" among its own exceptional paths (SL-S4
// directs that these be drawn on rather than new scenarios invented). Here that is a single professional episode:
// the architecture step is planned to read the on-site field survey, the survey was never captured because the
// network dropped and the technician could not be reached, and the engine is then asked, in order, to
//
//   1. START the step that needs it                   -> refused; the step is left NOT READY  (RPH-EXE-005 limb 1)
//                                                        and nothing is invoked                (RPH-EXE-005 limb 2)
//   2. admit a follow-up PWU to READY without it      -> refused; the shape cannot be stated   (RPH-PWU-004)
//   3. record the absence as a governed fact          -> ACCEPTED: BlockPwu, naming what is missing
//   4. record an absence that cannot be ITEMISED      -> ACCEPTED: `missingObjectIds` is optional
//   5. record a halt with no reason at all            -> refused: `blockReason` is not
//
// ── RATIFYING THE CLASS (SL-5), which is the whole point of this Slice ────────────────────────────────────────
// The roadmap's §9 table proposes assignments and its own preamble forbids inheriting them. Ratified here, and
// the argument is a DISTINCTION from the neighbours rather than a label:
//
//   • NOT `alternate valid path` — the closest class, and the one FIVE sibling Slices already carry: E2E-002,
//     -003, -004, -005 and -007. The number is DERIVED (sweep `scenarioClass:` across every `*.slice.test.ts`),
//     not counted by hand, because a draft of this line said "four" — which is the count BESIDES E2E-002, named
//     in the very next clause, and would have been inherited as the total by the next reader. E2E-002 states
//     that class's own criterion in its header: *"every command in this journey is ACCEPTED and the work
//     genuinely succeeds; what differs from the normal path is the professional VERDICT, not an error, a failure
//     or an unavailability."* This journey is the stated exception. Its headline acts are REFUSED, and refused
//     because a required object DOES NOT EXIST. No verdict is reached about anything, because the work never ran.
//   • NOT `user-error path` — nothing the caller supplied is malformed. The `StartExecutionStep` payload is
//     well-formed, the plan is ACTIVE, the step is QUEUED, the binding is perfectly well specified: `artifactId`
//     is a good reference to an artifact nobody recorded. The refusal is about the WORLD, not about the message.
//     ⚠ AND THE COUNT A DRAFT OF THIS BULLET GAVE WAS WRONG, recorded rather than quietly repaired. The draft
//     said the Slice "CONTAINS EXACTLY ONE GENUINE USER-ERROR REFUSAL". Derived from the statuses this file
//     actually asserts rather than from memory, THREE of its refusals are decided by the caller's message and
//     not by the world: `O-PWU004-VCRIT-NOTASSERTED` and `O-BLOCK-UNEXPLAINED` are both `VALIDATION_FAILED` —
//     the schema refusing an unknown key, and the schema refusing a missing required one — and
//     `O-PWU004-REFUSED` is `REJECTED` at a §9.1 contract limb read off a schema-VALID payload. The first two
//     are instruments rather than acts of the journey (one pins a disclosure, one is half of the discriminating
//     pair at the end); the third IS an act of the journey, and what connects it to the unavailability is
//     narrated rather than driven — see the ⚠ note on that test, which states the gap in the engine's terms.
//     THE CLASS SURVIVES ON THE CRITERION THIS BULLET STATES — malformedness — AND NEVER ON A COUNT: the two
//     headline acts, the refused `StartExecutionStep` and the block that records why, turn on an artifact that
//     does not exist, and no reader who deleted the class declaration would call those a user error.
//   • NOT `system-failure path` — nothing failed. No step is FAILED, no `failureClass` is recorded, no retry is
//     attempted. `FailExecutionStep` exists and is DELIBERATELY NOT USED: reporting an absence as a failure
//     would be a false statement about the work, and the engine behaved exactly as designed throughout.
//   • NOT `interrupted or resumed path` — E2E-006 owns that class, and its antecedent is a restart part-way
//     through execution. Here execution never began; there is nothing to resume.
//   • NOT `cancellation path` — nothing is cancelled or abandoned. BLOCKED is not ABANDONED, and `AbandonPwu`
//     is available and unused. The work is halted pending a datum, not withdrawn.
//   • NOT `permission-denied path` — no authority question arises. `blockPwu`'s own header records that blocking
//     is deliberately UNGATED ("a system that makes failure harder to report than success is worse than one that
//     checks neither"), so this journey cannot produce that class even by accident.
//   • NOT `normal path` — E2E-001 owns it.
//
// ── WHAT IS CITED, AND WHAT WAS CONSIDERED AND NOT CITED ─────────────────────────────────────────────────────
// `RPH-EXE-005` and `RPH-PWU-004` are cited. `RPH-CNS-004` was offered as a candidate and is NOT cited, because
// `citedRules` declares what a Slice ASSERTS and this Slice cannot assert it. The reason was checked directly
// rather than taken from the enforcement register's word:
//
//   READ, NOT DRIVEN, and labelled as such. `ConstraintPropagationSchema` (packages/rph-contracts/src/objects.ts,
//   L177) is a `z.strictObject` with six members — constraintId, childWorkUnitIds, disposition, rationale,
//   authorityDecisionId, supersededByConstraintId — and `waiverExpired` is not among them, while the kernel arm
//   that would fire (`decomposition.ts` L231, the WAIVED_EXPIRED branch) reads exactly that field. So no dispatch
//   can assert the rule's antecedent, and a journey cannot reach it. Citing a rule and asserting nothing is the
//   shape `SL-1` exists to prevent.
//
//   ⚠ AND THE ABSENCE HERE IS NARROWER THAN IT FIRST LOOKED — recorded because a draft of this header stated the
//   wider version and it would have been WRONG. Case-insensitive searches for `waiverexpir|expirewaiver|
//   WaiverExpired|ExpireConstraint` across every `packages/*/src` and `packages/*/vocab` find that the EVENT
//   EXISTS: `WaiverExpiredPayloadSchema` is declared (messages.ts L1635) and registered against the Decision
//   aggregate, `transitions.data.ts` L1802 carries the ratified trigger `expireAssuranceWaiver (WaiverExpired)`,
//   and `m10-governance.json` states the whole three-limb expiry behaviour by name. What does NOT exist is an
//   EMITTER and a COMMAND: `WaiverExpired` appears in `rph-application` only inside a comment, and the command
//   registry holds `ExpireAssumption` and no `ExpireWaiver` at all. "The shape is missing" would have been a
//   false absence; the true one is "the shape is declared and nothing produces it".
//
// ── AN ACT THIS JOURNEY CANNOT PERFORM, DRIVEN RATHER THAN ASSUMED ───────────────────────────────────────────
// `EscalatePwu` carries `unobtainableEvidenceIds` and the ratified trigger *"Evidence impossible to obtain"*, so
// it reads like the on-point act for this class. IT IS NOT AVAILABLE HERE, and the attempt was made:
// `EscalatePwu`'s only source state is EVIDENCE_PENDING (`pwu-lifecycle-command-spec.ts`), and the PWU machine's
// only in-arrows to EVIDENCE_PENDING are from EXECUTING and from ESCALATED itself (`m2-transitions.json`). The
// EXECUTING one is guarded by `WORK_LIFECYCLE_CROSS_AXIS_GUARDS['EXECUTING->EVIDENCE_PENDING']`, which requires
// `executionState === 'SUCCEEDED'`. Driven: the hop is refused with *"cross-axis guard failed for EXECUTING ->
// EVIDENCE_PENDING"*. So the two unavailability acts PARTITION by when the absence bites — `BlockPwu` when it
// stops work from starting or continuing, `EscalatePwu` when the work SUCCEEDED and the evidence still cannot be
// got. This Slice is the first case, and a later reader must not conclude that escalation is unreachable in
// general; it is unreachable from HERE, and for a stated reason.
//
// Signposted and NOT exercised: the ratified transition table also carries `AssuranceAssessment.state ASSESSING ->
// EVIDENCE_PENDING`, triggered by *"evidence access failure — required evidence cannot be retrieved (§34.3)"* —
// a second data-unavailable arrow, on the assurance plane. Nothing here asserts anything about it.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE — the prohibition the E2E-001 and E2E-002 Slices both record.
import { describe, expect, it } from 'vitest';

import {
	beginJourney,
	changeState,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	type Journey
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'CLS-DATA-UNAVAILABLE',
	title: 'The required field data was never captured: the step is not ready, the follow-up cannot be shaped, and the absence is recorded as a governed block',
	plane: 'ENGINE',
	scenarioClass: 'data-unavailable path',
	citedRules: ['RPH-EXE-005', 'RPH-PWU-004'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'CLS-DU-M1',
			file: 'packages/rph-application/src/handlers/execution.ts',
			find: "requires input artifact(s) [${missing.join(', ')}]",
			replace: 'requires input artifact(s) [redacted]',
			expectRed: ['O-EXE005-NOTREADY'],
			predictedMessage:
				'the refusal must NAME the artifact that did not resolve — an absence nobody can name is not a governed report of anything',
			why: "Proves the first limb of RPH-EXE-005 is asserted on a refusal that IDENTIFIES the missing input, not merely on the fact that a refusal happened. StartExecutionStep refuses on six declared grounds and `not.toBe('ACCEPTED')` cannot tell them apart. ⚠⚠ THIS MUTANT CAME BACK INERT (redCount 0) FROM `scripts/drive-slice-mutants.ts`, AND THE SITE WAS NOT THE FAULT — THE SLICE WAS. The first draft of `O-EXE005-NOTREADY` asserted `JSON.stringify(refused.error)`, and this same refusal ALSO passes `[stepId, ...missing]` as the reject's `targetObjectIds` (execution.ts L807), which `reject` (handlers/kit.ts) hands to `makeRphError` and `makeRphError` (rph-contracts/src/errors.ts) puts on the returned object — so the artifact id sat in the serialized blob independently of the message, and redacting the message moved nothing the assertion looked at. The assertion now reads `refused.error?.message`, which this mutant DOES move: the replacement shares no substring with the artifact id, so it is not the superstring-inert shape E2E-002-M1 recorded, and the id has no other route into the message. It deliberately leaves the rule's own words in the message, so the sibling containment stays green, and `O-EXE005-NOINVOKE` — which reads the STATUS and the event log and never the message — is untouched. The targetObjectIds naming is now asserted separately and carried by `CLS-DU-M8`, so neither mutant answers for two clauses."
		},
		{
			id: 'CLS-DU-M2',
			file: 'packages/rph-application/src/handlers/execution.ts',
			find: 'const check = stepMayBecomeReady(missing.length === 0);',
			replace: 'const check = stepMayBecomeReady(false);',
			expectRed: ['O-EXE005-NOINVOKE'],
			predictedMessage:
				'the SAME arrangement, differing only in that the field survey WAS recorded, must start — otherwise the absence asserted above is satisfied by an engine that does nothing at all',
			why: "Proves the second limb's POSITIVE CONTROL is load-bearing, which is what makes the absence a measurement. A guard that refused unconditionally would satisfy the no-invocation assertion in every world; this mutant is exactly that guard, and it must redden the control half. It leaves the absent-artifact world refused with an unchanged message, so `O-EXE005-NOTREADY` stays green. ⚠ THE MUTATION THE ENFORCEMENT REGISTER NAMES FOR THIS RULE — flipping `StartExecutionStep.inputReadiness` to NOT_CONSUMING — is DELIBERATELY NOT DECLARED HERE: it reddens both limbs at once and would therefore prove neither (SL-3a). It belongs at rule level, where it already is."
		},
		{
			id: 'CLS-DU-M3',
			file: 'packages/rph-domain/src/pwuGuards.ts',
			find: 'facts.expectedOutputs.length === 0',
			replace: 'facts.expectedOutputs.length === -1',
			expectRed: ['O-PWU004-REFUSED'],
			predictedMessage:
				'MarkPwuReady must be REFUSED on a follow-up PWU that can state no expected output — RPH-PWU-004, at the one limb the enforcement register pins',
			why: 'Proves the refusal is decided by the EXPECTED-OUTPUTS limb rather than by the readiness check merely being present. The comparison stays a comparison (it type-checks, and the predicate still runs), so this is not the F-30 shape of a guard deleted wholesale. It cannot be widened by accident: the journey\'s own architecture PWU carries one expected output, so it is unaffected, and the ARRANGEMENT of every test in this file already proves the check is not an unconditional deny — a `checkPwuShapeReadiness` that always failed would break `MarkPwuReady` in the shared arrangement and redden the whole file.'
		},
		{
			id: 'CLS-DU-M4',
			file: 'packages/rph-contracts/src/messages.ts',
			find: 'export const ProposePwuPayloadSchema = z.strictObject({',
			replace: 'export const ProposePwuPayloadSchema = z.object({',
			expectRed: ['O-PWU004-VCRIT-NOTASSERTED'],
			predictedMessage:
				'ProposePwu must REFUSE a verificationCriterionIds field — the ratified payload has no such key, which is why the second half of RPH-PWU-004 is NOT asserted by this Slice',
			why: "Proves the DISCLOSURE is pinned to a live fact and not to a comment. The ratified statement names two things — missing expected outputs AND verification criteria — and only the first refuses; the second is unenforceable because the field has no wire path at all. This mutant opens that wire path (a non-strict object strips the unknown key instead of refusing it), and the pin must go red the day it opens for real, so the disclosure cannot outlive the thing it discloses."
		},
		{
			id: 'CLS-DU-M5',
			file: 'packages/rph-application/src/handlers/pwu.ts',
			find: "blockedFrom: prior.workLifecycleState as PwuBlockedPayload['blockedFrom'],",
			replace: "blockedFrom: 'SHAPING' as PwuBlockedPayload['blockedFrom'],",
			expectRed: ['O-BLOCK-RECORDED'],
			predictedMessage:
				'the block must record the state the work was blocked OUT OF — EXECUTING — because that is the datum a recovery needs, and a block that dropped it would record strictly less than the generic state change it replaced',
			why: "Proves the block's origin is READ from the PWU rather than being any constant that happens to be a legal source state. 'SHAPING' is chosen precisely because it IS a legal `BlockPwu` source, so the cast type-checks and the mutant changes behaviour rather than breaking the build — the trap E2E-002-M3's first version fell into by renaming a function. It leaves `missingObjectIds` untouched, so the sibling BLOCK tests stay green."
		},
		{
			id: 'CLS-DU-M6',
			file: 'packages/rph-contracts/src/messages.ts',
			find: 'missingObjectIds: z.array(z.string()).optional(),\n\tsupportingObjectIds: z.array(z.string()).optional()',
			replace: 'missingObjectIds: z.array(z.string()),\n\tsupportingObjectIds: z.array(z.string()).optional()',
			expectRed: ['O-BLOCK-UNENUMERABLE'],
			predictedMessage:
				'a block whose missing objects cannot be itemised must still be ACCEPTED — the trigger is an ABSENCE, and requiring the list would make the honest case unreportable',
			why: "Proves the OPTIONALITY is a design commitment and not an accident of the schema. The two-line anchor is what makes it unique — the single line occurs twice in this file (the command payload and the event payload), and a mutant anchored on one occurrence would be UNANCHORED. The sibling `O-BLOCK-RECORDED` supplies the ids, so it is unaffected; `O-BLOCK-UNEXPLAINED` supplies a reason and no ids and would be caught by this too, which is why its own arrangement names the ids — see the note there."
		},
		{
			id: 'CLS-DU-M7',
			file: 'packages/rph-contracts/src/messages.ts',
			find: 'export const BlockPwuPayloadSchema = z.strictObject({\n\tblockReason: z.string(),',
			replace: "export const BlockPwuPayloadSchema = z.strictObject({\n\tblockReason: z.string().default('MUTANT_UNSTATED_REASON'),",
			expectRed: ['O-BLOCK-UNEXPLAINED'],
			predictedMessage:
				'a block stating NO reason must be refused — an unexplained halt is not a governed record of anything, and blockReason is the one substantive contract BlockPwu imposes',
			why: "Proves the REQUIREMENT is the schema's and is live. `.default()` is chosen over `.optional()` for a stated reason: in Zod the default makes the INPUT optional while the OUTPUT type stays `string`, so `BlockPwuPayload.blockReason` is still `string` and the handler's `satisfies PwuBlockedPayload` continues to type-check — an `.optional()` here would break compilation and redden the whole file, which proves nothing. The two-line anchor is again what makes it unique against the identically-shaped event payload."
		},
		{
			id: 'CLS-DU-M8',
			file: 'packages/rph-application/src/handlers/execution.ts',
			find: '[stepId, ...missing]',
			replace: '[stepId]',
			expectRed: ['O-EXE005-NOTREADY'],
			predictedMessage:
				'and the refusal must carry the step AND the unresolved artifact as its target objects, in that order — the naming a read model can act on, as against the one a human reads',
			why: "CLS-DU-M1's partner, and it exists because of what M1's INERT verdict exposed. The refusal names the missing artifact TWICE — once in the prose message and once in the machine-readable `targetObjectIds` — and the first draft's blob read collapsed the two, which is why redacting one moved nothing. Splitting them means each naming is asserted by a line only its own mutant can move: M1 redacts the MESSAGE, M8 drops the artifact from the TARGET LIST. `[stepId]` is not a superstring of `[stepId, ...missing]`, so it cannot be inert by shape, and it type-checks unchanged — `reject`'s fourth parameter is `string[]` and `stepId` is a `string`, so this changes behaviour rather than breaking the build (the trap E2E-002-M3's first version fell into). It cannot go wider than its clause: no other test in this file reads `error.targetObjectIds` — `O-EXE005-NOINVOKE` and `O-BLOCK-RECORDED` read only the status and the event log."
		}
	]
};

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5W00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5W20';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5W30';
/** The field survey the technician never captured. Referenced everywhere, recorded almost nowhere. */
const SURVEY = 'art_01ARZ3NDEKTSV4RRFFQ69G5W40';
/** The follow-up work the shaper tries to admit while the survey is still missing. */
const REVISIT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W50';

/**
 * The journey up to the moment the absence bites: an ACTIVE plan on an EXECUTING PWU, whose one step is a
 * MODEL_INVOCATION declaring the field survey as a REQUIRED input.
 *
 * ⚠ `recordSurvey` IS THE ONLY THING THAT VARIES BETWEEN THE TWO WORLDS, and that is the whole apparatus behind
 * the second limb. A pair of runs that held everything constant but the LABEL could not discriminate anything —
 * this repository has recorded a Slice that did exactly that. Here the two runs differ in ONE act: whether
 * `RecordArtifact` was ever issued for the survey.
 *
 * ⚠ THE STEP IS `MODEL_INVOCATION`, NOT `TRANSFORMATION`, AND THAT IS THE OPPOSITE CHOICE FROM `executeWork` IN
 * THE SHARED FIXTURE — deliberately. That helper picks TRANSFORMATION to avoid obliging the §8.4 de minimis floor
 * at COMPLETION. No step in this journey ever completes: the on-point one is refused at START, and the control
 * one is left RUNNING. So the floor is never reached, and the step type can be the one the rule is actually about
 * — "performs no model/tool invocation" is a claim about a MODEL INVOCATION.
 *
 * ⚠ AND EVERY OTHER GROUND `StartExecutionStep` CAN REFUSE ON IS DELIBERATELY SATISFIED. It declares six limbs;
 * five of them — plan liveness (the plan is ACTIVE), PWU openness (the PWU is EXECUTING), branch decision, binding
 * authority (the step names no runtime binding, so the limb is out of scope) and the linear start gate (one step,
 * no unfinished predecessor) — are all met here. The proof that they are met is not an argument: it is
 * `O-EXE005-NOINVOKE`'s control run, which is this same arrangement and STARTS. An arrangement that tripped two
 * guards would prove neither, which is why the assertions below are on the MESSAGE and not on the status alone.
 */
function journey(recordSurvey: boolean): Journey {
	const j = beginJourney();
	seedJourneyPolicy(j);
	seedIntentAndArchitecture(j, { intentId: INTENT, pwuId: PWU });

	if (recordSurvey) {
		j.send('RecordArtifact', 'ARTIFACT', SURVEY, {
			artifactId: SURVEY,
			artifactType: 'DOCUMENT',
			mediaType: 'text/markdown',
			storageProvider: 'inline',
			storageKey: 'k/field-survey',
			contentHash: 'sha256:0',
			securityClassification: 'INTERNAL',
			retentionClass: 'STANDARD',
			status: 'RECORDED'
		});
	}

	j.send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', PWU, {});
	j.send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', PWU, {
		shapeReadinessAssessmentId: 'assess_shape',
		expectedSemanticVersion: 1
	});
	j.send('ProposeExecutionPlan', 'EXECUTION_PLAN', PLAN, {
		executionPlanId: PLAN,
		workUnitId: PWU,
		steps: [
			{
				id: STEP,
				executionPlanId: PLAN,
				stepType: 'MODEL_INVOCATION',
				purpose: 'Draft the tenant isolation architecture from the on-site field survey',
				inputBindings: [{ artifactId: SURVEY, required: true }],
				outputBindings: [],
				preconditions: [],
				postconditions: [],
				stepState: 'QUEUED'
			}
		],
		transitions: [],
		retryPolicy: {},
		tacticalChangePolicy: {},
		escalationPolicy: {},
		terminationPolicy: {}
	});
	j.send('ApproveExecutionPlan', 'EXECUTION_PLAN', PLAN, {});
	j.send('ActivateExecutionPlan', 'EXECUTION_PLAN', PLAN, { authorizedRuntimeBindingIds: [] });
	changeState(j, PWU, {
		previousState: 'READY',
		newState: 'PLANNED',
		executionState: 'PLANNED',
		assuranceState: 'UNASSESSED',
		supportingObjectIds: [PLAN]
	});
	changeState(j, PWU, {
		previousState: 'PLANNED',
		newState: 'EXECUTING',
		executionState: 'QUEUED',
		assuranceState: 'UNASSESSED',
		supportingObjectIds: [PLAN]
	});
	return j;
}

/** The step's own state, read off the plan aggregate — not off the command result. */
const stepStateOf = (j: Journey): string | undefined =>
	((j.state(PLAN) as { steps?: readonly { id: string; stepState: string }[] } | undefined)?.steps ?? []).find(
		(s) => s.id === STEP
	)?.stepState;

/**
 * Every step the engine actually started, by id.
 *
 * ⚠ THE IDS, NOT A COUNT, AND NOT A BARE `length === 0`. `ExecutionStepStarted` is the one governed fact this
 * engine emits at the moment a step's declared inputs are consumed, and it is the closest observable there is to
 * "an invocation was performed" — see the narrowing recorded on `O-EXE005-NOINVOKE`.
 */
const startedStepIds = (j: Journey): string[] =>
	j.engine
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionStepStarted')
		.map((e) => String((e.payload as { stepId?: unknown }).stepId));

/** Propose the return-visit PWU and take it to SHAPING. `expectedOutputs` is the caller's, and it is the point. */
function proposeRevisit(j: Journey, expectedOutputs: readonly unknown[]): void {
	j.send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', REVISIT, {
		pwuId: REVISIT,
		pwuKind: 'ARCHITECTURE_DEFINITION',
		title: 'Return visit to capture the field survey',
		description: 'Re-attend the site and capture the survey the failed field update never transmitted',
		intentId: INTENT,
		// ⚠ EVERY OTHER §9.1 LIMB IS SATISFIED, AND THAT IS A MINIMAL-DELTA FIXTURE RATHER THAN TIDINESS. The
		// refusal message is built as `contract (DOC-002 §9): ${unmet.join('; ')}`, so a second unmet limb would
		// change the string and the assertion below would be reading a refusal it did not arrange. One limb unmet
		// means the refusal is attributable to it.
		boundaries: {
			inScope: ['re-capturing the on-site survey'],
			outOfScope: ['re-negotiating the service window'],
			permittedChanges: [],
			prohibitedChanges: []
		},
		obligationIds: [],
		constraintIds: [],
		assumptionIds: [],
		expectedOutputs,
		assurancePolicyIds: [],
		riskProfile: {
			consequence: 'HIGH',
			uncertainty: 'HIGH',
			irreversibility: 'MEDIUM',
			securitySensitivity: 'LOW',
			regulatoryExposure: 'LOW'
		}
	});
	j.send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', REVISIT, {});
}

describe('SLICE CLS-DATA-UNAVAILABLE — the field survey was never captured, and the engine will not proceed without it', () => {
	// ── RPH-EXE-005, LIMB 1: "leaves the step not ready" ────────────────────────────────────────────────────
	//
	// ASSERTED. Note what "not ready" is asserted ON: the STEP's own state on the plan aggregate, not the command
	// result. A refusal that still advanced the step would satisfy every assertion about the result and violate
	// the rule — which is why the state read is here and not left implied.
	it('O-EXE005-NOTREADY — the step is left QUEUED, and the refusal names the artifact that did not resolve', () => {
		const j = journey(false);

		const refused = j.attempt('StartExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
		expect(
			refused.status,
			'the start must be refused — RPH-EXE-005 opens "Starting a step whose required input artifact is absent"'
		).toBe('REJECTED');

		// ⚠ THE MESSAGE, NOT THE CODE, AND NOT THE STATUS. `RPH_INVARIANT_VIOLATION` is emitted by many guards and
		// `StartExecutionStep` refuses on six declared grounds; an arrangement that tripped two of them would
		// prove neither, and a code assertion could not tell. The rule's own words appear in this refusal and in
		// no other, which is what makes the attribution real. (JAN-CSAA closed 64 of 65 findings whose tests
		// asserted a code alone: one code had 116 distinct emitters.)
		//
		// ⚠⚠ AND `error.message`, NOT `JSON.stringify(error)` — THE NARROWING THAT MAKES `CLS-DU-M1` ABLE TO
		// REDDEN AT ALL. This was not reasoned; it was DRIVEN. `scripts/drive-slice-mutants.ts` returned M1 with
		// redCount 0 while every other declared mutant in the repository came back SOUND, which means the clause
		// below was resting on nothing. The mechanism, then read out of the source rather than guessed:
		// `inputReadinessRefusal` (packages/rph-application/src/handlers/execution.ts, the `reject(...)` at the
		// end) passes `[stepId, ...missing]` as the refusal's `targetObjectIds`; `reject` (handlers/kit.ts) hands
		// them to `makeRphError`; `makeRphError` (packages/rph-contracts/src/errors.ts) puts `targetObjectIds` on
		// the returned object; and the bus returns the handler's result untouched. So SURVEY was in the
		// serialized blob whether or not the message named it, and a mutant that redacted the message left the
		// assertion reading a value it had not changed.
		//
		// READING THE MESSAGE IS A NARROWING, NOT A WEAKENING: every world the blob read accepted, this one
		// accepts too, and it rejects the world where the message stopped naming the artifact — which is exactly
		// the world the clause is about. The refusal names the artifact in exactly TWO places (the message and
		// `targetObjectIds`; `code`, `category`, `retryable` and `correlationId` carry no ids), and the other one
		// is not dropped — it is asserted SEPARATELY below, under its own mutant `CLS-DU-M8`, so that no one line
		// answers for two facts and neither naming can go inert behind the other again.
		const message = refused.error?.message ?? '';
		expect(
			message,
			"the refusal must be the input-readiness limb and no other of the six StartExecutionStep declares — the rule's own words are what tell them apart"
		).toContain('the step is not ready and no model/tool invocation is performed');
		expect(
			message,
			'the refusal must NAME the artifact that did not resolve — an absence nobody can name is not a governed report of anything'
		).toContain(SURVEY);

		// THE SECOND, MACHINE-READABLE NAMING — the one a read model or a UI would act on, as against the one a
		// human reads. It is asserted rather than left in the comment above because it is a real commitment of
		// this refusal and because it is the fact that made the first draft pass for the wrong reason: an
		// undisclosed carrier of the same id is how an assertion goes inert. `CLS-DU-M8` is its mutant.
		expect(
			refused.error?.targetObjectIds,
			'and the refusal must carry the step AND the unresolved artifact as its target objects, in that order — the naming a read model can act on, as against the one a human reads'
		).toEqual([STEP, SURVEY]);

		expect(
			stepStateOf(j),
			'and the step itself must be left where it was, QUEUED — the first limb of RPH-EXE-005 is a claim about the STEP, not about the command result'
		).toBe('QUEUED');
	});

	// ── RPH-EXE-005, LIMB 2: "performs no model/tool invocation" ────────────────────────────────────────────
	//
	// ⚠⚠ ASSERTED, AND NARROWED, AND THE NARROWING IS NAMED IN THE TEST TITLE. Two things had to be settled by
	// looking rather than by assuming:
	//
	//   1. THERE IS NO MODEL OR TOOL PORT IN THIS ENGINE TO OBSERVE. `packages/rph-ports/src/ports/` holds three
	//      files — authentication.ts, logger.ts, storage.ts — and `CreateEngineDeps` (rph-engine/src/engine.ts)
	//      declares ontology, validateOntology, store, authenticate, now and newEventId. A search across
	//      rph-ports, rph-application and rph-engine sources for `modelPort|llm|invokeModel|toolPort|ModelClient|
	//      inference|openai|anthropic` returns no port and no client, and a second search of the same three trees
	//      for any outbound surface at all — `fetch(`, an http(s) URL, `child_process`, `axios`, `node:net`,
	//      `WebSocket`, `.request(` — returns nothing either. So "no invocation was performed" cannot be asserted
	//      as the absence of an outbound call: there is no call site to be absent from, in ANY world. An assertion
	//      that cannot fail is not an assertion, and saying so is cheaper than pretending otherwise.
	//      ⚠ `stepType: 'MODEL_INVOCATION'` IS A DECLARATION, NOT A DISPATCH, and the difference matters to this
	//      claim.
	//      ⚠⚠ A DRAFT OF THIS PARAGRAPH SAID "ITS ONLY PRODUCTION READER IS `floor-gate.ts`'s `AI_STEP_TYPES`",
	//      AND THAT WAS FALSE. It is recorded rather than silently corrected because a false absence is this
	//      programme's worst recorded defect, and because the WAY this one was reached is the reusable lesson:
	//      the search behind it was scoped to rph-ports | rph-application | rph-engine — the three trees where a
	//      PORT would live, which is what the paragraph above is about — and the second reader is a PROJECTION,
	//      in a fourth tree the scope never touched. `grep -rn AI_STEP_TYPES packages/*/src apps` returns TWO
	//      production declarations, and the check costs one command.
	//      THE TRUE STATEMENT IS NARROWER AND STRONGER. Its only reader that GATES anything is
	//      `packages/rph-application/src/handlers/floor-gate.ts` (`AI_STEP_TYPES` = {MODEL_INVOCATION}, declared
	//      L30 and read L77), which uses it to decide that the §8.4 de minimis floor applies because an AI shaped
	//      the output. The other reader is DISPLAY-ONLY: `packages/rph-projections/src/execution-attempts.ts`
	//      declares its own, deliberately BROADER set (L30, {MODEL_INVOCATION, TOOL_INVOCATION}) and reads it at
	//      L227 to compute the advisory `aiNoBinding` field of the DOC-009 §10.4 attempt read-model. That file
	//      names the floor gate by contrast in its own comment (L27-29, *"Broader than the floor gate's
	//      AI_STEP_TYPES (MODEL_INVOCATION only)"*), so it announces itself to anyone who greps the token.
	//      NEITHER READER IS A DISPATCH — one gates a floor, one decorates a view — so the conclusion the
	//      paragraph was drawing is untouched: the field names WHO produced the work, and nothing the engine calls.
	//   2. WHAT *CAN* BE OBSERVED is the governed act that would carry such an invocation. `ExecutionStepStarted`
	//      is emitted at the one moment a step's declared inputs are consumed and it enters RUNNING; the register
	//      records `inputReadiness` as the limb guarding "both arrows into RUNNING". If that event is absent, the
	//      step never entered the state in which an invocation could occur.
	//
	// SO THE CLAIM IS: no step was started. And an absence claim is satisfied by an engine that does nothing at
	// all, so it is asserted TOGETHER WITH ITS POSITIVE CONTROL, in one test, because the PAIR is the claim and
	// neither half is one alone. The two runs differ in exactly one act — whether `RecordArtifact` was issued.
	//
	// ⚠ WHAT A LATER READER MUST NOT CONCLUDE: that this proves no model was invoked. It proves the engine did not
	// enter the state in which it would invoke one, in a build that has nowhere to invoke one from. The day a
	// model port exists, this test is the narrower claim and will need a wider sibling.
	it('O-EXE005-NOINVOKE — no step is started while the survey is absent, and the same arrangement DOES start it once the survey is recorded', () => {
		const absent = journey(false);
		const refused = absent.attempt('StartExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
		expect(
			refused.status,
			'the start must be refused in the absent world — the antecedent of the whole rule'
		).toBe('REJECTED');
		expect(
			startedStepIds(absent),
			'no ExecutionStepStarted may exist: the step never entered RUNNING, which is the only state in which its declared inputs are consumed'
		).toEqual([]);

		const present = journey(true);
		const accepted = present.attempt('StartExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
		expect(
			accepted.status,
			'the SAME arrangement, differing only in that the field survey WAS recorded, must start — otherwise the absence asserted above is satisfied by an engine that does nothing at all'
		).toBe('ACCEPTED');
		expect(
			startedStepIds(present),
			'and it must be THIS step that started, named by id — a count would be satisfied by any step at all'
		).toEqual([STEP]);
		expect(
			stepStateOf(present),
			'the control step must actually be RUNNING; an accepted command that advanced nothing would satisfy the event assertion and prove nothing'
		).toBe('RUNNING');
	});

	// ── RPH-PWU-004, FIRST HALF: "missing expected outputs … is rejected" ───────────────────────────────────
	//
	// ASSERTED, and this is the point in the story where the absence stops being an execution problem and becomes
	// a SHAPING one. With the survey missing, the shaper cannot state what the return visit is meant to produce —
	// and the engine refuses to admit work whose shape is not stated, rather than letting the gap through because
	// the datum that would close it is unavailable. That is the class, one layer up from the step.
	//
	// ⚠⚠ AND THE LINK TO THE UNAVAILABILITY IS NARRATED, NOT DRIVEN. Disclosed here because the paragraph above
	// reads as though the ENGINE had noticed the missing survey, and it has not. `checkPwuShapeReadiness`
	// (packages/rph-domain/src/pwuGuards.ts L148) reads `facts.expectedOutputs.length === 0` and nothing else;
	// SURVEY is never loaded on this path, the REVISIT PWU does not reference it, and the empty array is simply
	// what `proposeRevisit` was handed by the caller. The professional story — a shaper who cannot say what the
	// return visit will produce because the survey is gone — is the AUTHOR's; the mechanical fact is a
	// shape-readiness refusal that would read identically in a journey with no unavailability in it at all.
	// It stays in this Slice because the class is defined by what the profession DOES about an absence and this
	// is the second thing it does, and because the assertion below is exact about the limb it names. What a later
	// reader must NOT take from the green is that the engine connected the two: only the header did.
	it('O-PWU004-REFUSED — the return-visit PWU cannot reach READY while its expected output cannot be stated', () => {
		const j = journey(false);
		proposeRevisit(j, []);

		const refused = j.attempt('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', REVISIT, {
			shapeReadinessAssessmentId: 'assess_shape_revisit',
			expectedSemanticVersion: 1
		});
		expect(
			refused.status,
			'MarkPwuReady must be REFUSED on a follow-up PWU that can state no expected output — RPH-PWU-004, at the one limb the enforcement register pins'
		).toBe('REJECTED');
		// The LIMB is part of what is asserted. The prefix alone ("does not satisfy the shape readiness contract")
		// would be satisfied by ANY of the eight limbs failing — including limbs this Slice does not exercise —
		// which is the same discipline the register's own `refusalMarker` uses for this rule.
		expect(
			JSON.stringify(refused.error ?? {}),
			'and it must be refused AT the expected-output limb, named — not merely somewhere inside the readiness contract'
		).toContain('shape readiness contract (DOC-002 §9): expected output (DOC-002 §9.1)');
		expect(
			(j.state(REVISIT) ?? {}).workLifecycleState,
			'and the PWU must be LEFT in SHAPING — "is rejected" is a claim about the work, not only about the command'
		).toBe('SHAPING');
	});

	// ── RPH-PWU-004, SECOND HALF: "and verification criteria" ───────────────────────────────────────────────
	//
	// ⚠⚠ NOT ASSERTED, NAMED AS NOT ASSERTED, AND PINNED SO THE DISCLOSURE CANNOT GO STALE (SL-2).
	//
	// The ratified statement names TWO missing things. Only the first refuses. The second is not something
	// `checkPwuShapeReadiness` forgot — `pwuGuards.ts` WITHHOLDS that limb by name and states why: the PWU object
	// carries `verificationCriterionIds`, but no ratified command writes it, `proposePwu` hardcodes it to `[]`
	// (pwu.ts L331), and enforcing the limb would make SHAPING -> READY unsatisfiable for every PWU forever.
	//
	// So the antecedent "a PWU missing … verification criteria" is TRUE OF EVERY PWU THIS ENGINE CAN BUILD, and
	// a test asserting it would be asserting something that cannot fail. What IS assertable, and is asserted
	// here, is the reason: the field has no wire path, because the ratified payload refuses it. That is a fact
	// that can change, and this test is written to redden when it does.
	//
	// ⚠ THIS IS THE ONE ACT IN THE FILE THAT IS A USER ERROR — a malformed command — and it is deliberately not
	// part of the journey. It is an instrument pointed at a disclosure. Said in terms so the class ratification
	// above is not read as a claim that no such refusal occurs anywhere in this file.
	it('O-PWU004-VCRIT-NOTASSERTED — the verification-criteria half is unassertable: the ratified ProposePwu payload has no such field', () => {
		const j = journey(false);

		const refused = j.attempt('ProposePwu', 'PROFESSIONAL_WORK_UNIT', REVISIT, {
			pwuId: REVISIT,
			pwuKind: 'ARCHITECTURE_DEFINITION',
			title: 'Return visit to capture the field survey',
			description: 'Re-attend the site and capture the survey the failed field update never transmitted',
			intentId: INTENT,
			boundaries: {
				inScope: ['re-capturing the on-site survey'],
				outOfScope: ['re-negotiating the service window'],
				permittedChanges: [],
				prohibitedChanges: []
			},
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [{ outputId: 'out_revisit_survey', kind: 'DOCUMENT' }],
			// The field the rule's second half quantifies over. There is nowhere to put it.
			verificationCriterionIds: ['vc_survey_captured'],
			assurancePolicyIds: [],
			riskProfile: {
				consequence: 'HIGH',
				uncertainty: 'HIGH',
				irreversibility: 'MEDIUM',
				securitySensitivity: 'LOW',
				regulatoryExposure: 'LOW'
			}
		});

		expect(
			refused.status,
			'ProposePwu must REFUSE a verificationCriterionIds field — the ratified payload has no such key, which is why the second half of RPH-PWU-004 is NOT asserted by this Slice'
		).toBe('VALIDATION_FAILED');
		expect(
			JSON.stringify(refused.error ?? {}),
			'PINNED DISCLOSURE: the refusal must name the field. Repair the wire path and this assertion is what tells you the withheld limb above can now be enforced and this Slice under-claims RPH-PWU-004.'
		).toContain('verificationCriterionIds');
	});

	// ── THE PROFESSIONAL TERMINUS: the absence becomes a governed fact ──────────────────────────────────────
	//
	// ⚠ THESE THREE TESTS ASSERT NO CLAUSE OF EITHER CITED RULE, AND SAY SO RATHER THAN LETTING A READER ASSUME
	// OTHERWISE. Neither RPH-EXE-005 nor RPH-PWU-004 says anything about what happens next. They are here because
	// a journey that only collected refusals would not be a journey — the class is defined by what the profession
	// DOES about an unavailability, and `BlockPwu` is the act the corpus gives it ("Missing information",
	// "Runtime dependency unavailable" are its verbatim ratified triggers).
	it('O-BLOCK-RECORDED — the absence is recorded as a governed block naming what is missing and where the work stopped', () => {
		const j = journey(false);
		// The refusal that occasioned the block, driven and READ — not narrated. An unread refusal is an
		// arrangement whose failure the test could not have noticed (REG-F-015).
		const refused = j.attempt('StartExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
		expect(refused.status, 'the block follows an actual refusal, not a supposed one').toBe('REJECTED');

		j.send('BlockPwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
			blockReason:
				'The on-site field survey was never captured: the network was unavailable during the field update and the technician could not be reached to re-transmit it.',
			missingObjectIds: [SURVEY]
		});

		expect(
			(j.state(PWU) ?? {}).workLifecycleState,
			'the work must read BLOCKED — a halt that leaves the PWU reading EXECUTING is a halt no read model can see'
		).toBe('BLOCKED');

		const blocked = (j.engine.readAllEvents().find((e) => e.eventType === 'PwuBlocked')?.payload ?? {}) as {
			missingObjectIds?: unknown;
			blockedFrom?: unknown;
		};
		expect(
			blocked.missingObjectIds,
			'the block must name the object whose absence caused it — the same artifact the step refusal named, so the two records agree about one fact'
		).toEqual([SURVEY]);
		expect(
			blocked.blockedFrom,
			'the block must record the state the work was blocked OUT OF — EXECUTING — because that is the datum a recovery needs, and a block that dropped it would record strictly less than the generic state change it replaced'
		).toBe('EXECUTING');
	});

	// ⚠ THE NEXT TWO ARE A DISCRIMINATING PAIR AND MUST BE READ TOGETHER. Separately each looks like a schema
	// fact; together they are the design's actual position on absence — you may always report that something is
	// missing, you may not always be able to say WHAT, and you may never decline to say WHY. `blockPwu`'s header
	// states the second half in terms: *"'missing information' frequently cannot enumerate what is missing.
	// Requiring the list would make the honest case unreportable."*
	it('O-BLOCK-UNENUMERABLE — an absence that cannot be itemised is still reportable: the enumeration is optional', () => {
		const j = journey(false);

		// ONE literal, SENT and then ASSERTED, so the identity the existence check below rests on cannot drift.
		const UNENUMERABLE_REASON =
			'The technician is unavailable and the site cannot be re-attended within the service window; what the survey would have contained is not known, so nothing can be named as missing.';
		const blocked = j.attempt('BlockPwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
			blockReason: UNENUMERABLE_REASON
		});
		expect(
			blocked.status,
			'a block whose missing objects cannot be itemised must still be ACCEPTED — the trigger is an ABSENCE, and requiring the list would make the honest case unreportable'
		).toBe('ACCEPTED');

		// AND THE EVENT MUST NOT INVENT ONE. A handler that defaulted the field to `[]` would record "nothing is
		// missing" about a block whose entire subject is that something is — the semantic-state-from-empty-array
		// error OBJ-1 forbids by name.
		//
		// ⚠ THE EVENT IS PROVED TO EXIST BEFORE ITS KEY SET IS READ, and that is not tidiness. `find(...)?.payload
		// ?? {}` yields `{}` in the world where NO `PwuBlocked` event was written at all, and
		// `Object.hasOwn({}, 'missingObjectIds')` is `false` — so the negative below passed in the very world it
		// is supposed to exclude. The claim being made is "the event OMITS the key"; "there is no event" falsified
		// that claim while satisfying the test. No declared mutant discriminated the two (`CLS-DU-M6` reddens the
		// ACCEPTED status above instead), so the discrimination is arranged here, in the Slice, at no cost to
		// production. `blockReason` is the field to read it off: `blockPwu` copies it from the command verbatim
		// (packages/rph-application/src/handlers/pwu.ts) and `PwuBlockedPayloadSchema` makes it the one REQUIRED
		// member, so it is present on every PwuBlocked there can be and on nothing else.
		const payload = (j.engine.readAllEvents().find((e) => e.eventType === 'PwuBlocked')?.payload ??
			{}) as Record<string, unknown>;
		expect(
			payload.blockReason,
			'the block must have been WRITTEN, and carry the reason that was sent — the omission asserted next is read off a `?? {}` fallback that also yields {} when no PwuBlocked event exists at all'
		).toBe(UNENUMERABLE_REASON);
		expect(
			Object.hasOwn(payload, 'missingObjectIds'),
			'and the event must OMIT the key rather than carry an empty list — an empty array here would read as "nothing is missing", which is the opposite of what this block records'
		).toBe(false);
	});

	it('O-BLOCK-UNEXPLAINED — but a halt with no stated reason is refused: the reason is not optional', () => {
		const j = journey(false);

		// ⚠ `missingObjectIds` IS SUPPLIED HERE ON PURPOSE, and it is the only reason this test discriminates.
		// Omitting it would leave TWO fields absent, and mutant CLS-DU-M6 (which makes the enumeration required)
		// would then redden this test as well as its own — an arrangement tripping two guards proves neither.
		// With the ids present, the ONLY thing this command lacks is the reason.
		const unexplained = j.attempt('BlockPwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
			missingObjectIds: [SURVEY]
		});
		expect(
			unexplained.status,
			'a block stating NO reason must be refused — an unexplained halt is not a governed record of anything, and blockReason is the one substantive contract BlockPwu imposes'
		).toBe('VALIDATION_FAILED');
		expect(
			JSON.stringify(unexplained.error ?? {}),
			'and the refusal must name blockReason as the missing field — a bare validation failure could be about any of the three'
		).toContain('blockReason');

		// AND NOTHING MOVED. A refusal that had already written the block would be worse than an acceptance.
		expect(
			(j.state(PWU) ?? {}).workLifecycleState,
			'the PWU must be left EXECUTING — the refused block must not have partially landed'
		).toBe('EXECUTING');
	});
});
