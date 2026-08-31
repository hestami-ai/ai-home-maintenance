// JAN-SLICE-SWP-03 — RPH-E2E-003, the journey where the PREMISE turns out to be false after the work was blessed.
//
// The ratified statement (`m12-conformance.json`, `sourceRef: "§24"`), verbatim:
//   "When the user clarifies national-enterprise scale against a small-business assumption, the assumption
//    becomes falsified, intent is revised, impact analysis identifies architecture and behavior PWUs, the
//    Architecture Baseline remains immutable but review-required, successor architecture work is created, and
//    the stale approval is not reused."
//
// And the worked scenario it was distilled from — `docs/Recursive Professional Harness/Janumi Professional
// Workbench Recursive Professional Harness - Executable Invariant and Conformance Test Specification.md`,
// §24, `## RPH-E2E-003 — Material assumption falsified`, verbatim:
//
//   ### Given
//   Architecture assumes small-business scale.
//   ### When
//   the user clarifies that the product must support national enterprises.
//   ### Then
//   * assumption becomes falsified;
//   * intent is revised;
//   * impact analysis identifies architecture and behavior PWUs;
//   * Architecture Baseline remains immutable but review-required;
//   * successor architecture work is created;
//   * stale approval is not reused.
//
// ── WHY THIS JOURNEY IS DIFFERENT FROM THE OTHER SIX ────────────────────────────────────────────────────────
// `RPH-E2E-002` is the profession saying NO to work that ran. This one is harder: the profession already said
// YES. The architecture was assured, approved by a human, frozen into an AUTHORITATIVE Baseline — and then the
// world supplied a fact that makes the ground it stood on false. Nothing FAILED. Nothing was malformed. What
// changed is that a premise stopped being true, and the question is what an engine owes the record when that
// happens. So the whole journey is arranged past the point of no return on purpose: the falsification lands on
// a PWU that is already BASELINED, because that is the only arrangement in which "the Baseline remains
// immutable" is a claim about anything.
//
// ── WHAT IS ASSERTED, AND WHAT IS RECORDED AS ABSENT ────────────────────────────────────────────────────────
// SIX ratified clauses, ONE of which is a conjunction and is split. Three hold as ratified. THREE DO NOT, and
// each is named for what it actually proves:
//
//   (a) FALSIFIED           — ASSERTED. Driven end to end: DISCLOSED -> FALSIFIED with contradicting evidence.
//   (b) INTENT REVISED      — ASSERTED. APPROVED -> REVISED, semanticVersion 1 -> 2.
//   (c) IMPACT ANALYSIS     — NOT ASSERTED as ratified. There is no impact analysis in this engine to identify
//                             anything. What the falsification emits is a VERBATIM REPLAY of the id list its own
//                             detector declared — proven below by planting an id that names no object at all and
//                             watching the engine hand it straight back. See `O-c(partial)` and the absence
//                             greps in the next block. ⚠ NOT "addressed to nobody": the ratified ontology names
//                             `INVALIDATE_DEPENDENTS` for exactly this falsification, and that control action is
//                             live under Gate B. What is absent is the LINK — the falsification event carries no
//                             control-action field, so nothing can aim it. Both halves are asserted.
//   (d-i) IMMUTABLE         — ASSERTED, and it holds by the ABSENCE OF A MUTATOR rather than by any guard. The
//                             enforcement register already rules this (`RPH-BAS-005`, NOT_A_COMMAND_REFUSAL);
//                             this Slice drives it instead of restating it.
//   (d-ii) REVIEW-REQUIRED  — NOT ASSERTED. No NAMED field, no post-promotion state and no command can mark a
//                             baseline review-required, and nothing did. ⚠ NOT "the flag could not be written":
//                             the object envelope's `tags`/`extensions` could hold one, and the narrowed claim
//                             is asserted with both carriers driven EMPTY. Searches run in both directions.
//   (e) SUCCESSOR WORK      — PARTIAL. The successor architecture PWU really is created and really reaches
//                             READY under the revised intent. The SUCCESSOR LINK to the baselined predecessor
//                             cannot be recorded by any route, and lives on no PWU field even when it can — but
//                             a SIBLING aggregate carries one (`IntentObjectSchema.supersedesIntentId`), so the
//                             absence is specific to the PWU and is asserted in both directions.
//   (f) STALE APPROVAL      — ASSERTED, on the SCOPE arm. Narrowed by CITATION, not by weakening: see below.
//
// ── THE ABSENCES, WITH THE SEARCHES RUN IN BOTH DIRECTIONS ──────────────────────────────────────────────────
// An absence claim is a claim about MY SEARCH, so each one below names what was searched FOR the concept as well
// as for the field name, and what the search DID return.
//
//   IMPACT ANALYSIS. Searched `/impact/i` over every `src/**` and `vocab/**` file in `packages/` — the CONCEPT,
//   not a field name — and separately derived the command, event and object-type vocabularies at runtime (the
//   assertions in `O-c(partial)` do the derivation rather than trusting this comment).
//
//   ⚠ THIS INVENTORY LISTED THREE HITS AND THE SEARCH IT CLAIMS RETURNS SIX. An absence claim is a claim about
//   MY SEARCH, so a search reported shorter than it ran is the defect one level up from the one being recorded.
//   The three that were missing are (4), (5) and (6), and (4) is the corpus speaking directly to this journey.
//   What EXISTS:
//     1. `impactAnalysisRequired`, a `z.literal(true)` on two ratified event payloads. It is a FLAG, and the
//        `falsifyAssumption` handler's own header says so: the cascade "is deliberately not built", licensed by
//        STA-7's *"flag for review rather than cascade destructively"*.
//     2. `impactAnalysisId`, an OPTIONAL string on `ReviseIntentPayloadSchema`. Driven below: it is accepted
//        pointing at an id no object in the store has ever had, and it reaches the EVENT and never the Intent
//        object — `IntentObjectSchema` has no such field.
//     3. `impactedObjects` and the seven `IMPACT_CLASSIFICATIONS` in `rph-domain/src/traceability.ts` — a real
//        kernel, with NO production caller. `handlers/decomposition.ts` says so in terms at its own deferral:
//        *"impact analysis has no plane in this engine: `impactedObjects` is a hollow-kernel-triage deferral"*.
//     4. ⚠ THE RATIFIED ONTOLOGY THIS ENGINE LOADS SAYS IT IN TERMS, ABOUT THIS EXACT SCENARIO.
//        `POL-ASSUMPTION-DISCLOSURE`'s finding `UNBOUNDED_ASSUMPTION_SCOPE` (`rph-product-realization-pwa/src/
//        ontology.data.ts`, and `vocab/m8-ontology.json`) reads: *"A disclosed assumption does not delimit the
//        objects it affects, so on falsification the impact analysis has no bounded set to work from and
//        INVALIDATE_DEPENDENTS cannot be aimed at anything."* `INVALIDATE_DEPENDENTS` is one of the 23 ratified
//        `ControlActionSchema` members and sits in the `permittedControlActions` of TWO ratified policies in that
//        same loaded ontology — and that field is LIVE, not decorative: Gate B
//        (`rejectUnpermittedControlActions`, `handlers/assurance.ts`) refuses a validator recommendation the
//        policy does not permit. So the corpus DOES name an aiming point for the cascade.
//     5. `WaiverDetail.downstreamImpactObjectIds` (`rph-contracts/src/objects.ts`) — a real impact field that a
//        PRODUCTION handler fills, from `p.affectedObjectIds`, in `grantScopedWaiver` (`handlers/governance.ts`).
//        It lives on the WAIVER aggregate and nothing on this journey's path writes or reads it.
//     6. `RevocationOutcome.impactedBaselineIds` (`rph-domain/src/governance.ts`) and `REPOSITORY_IMPACT_ANALYSIS`
//        in the ratified m8-ontology `candidateChildren`.
//   What does NOT exist, derived and asserted rather than asserted from reading: no `IMPACT_ANALYSIS` member of
//   `ProfessionalWorkObjectTypeSchema`; no command in the 106-member ratified `COMMANDS` registry whose name
//   matches `/impact|analys/i`; no event either. And — the narrowing (4) forces — no LINK from the flag to the
//   action the corpus names: `AssumptionFalsifiedPayloadSchema` is a `z.strictObject` of six fields and not one
//   of them is a control action, so `INVALIDATE_DEPENDENTS` cannot be aimed from here. (`selectControlAction`,
//   the kernel that would pick one, has no production caller either.) Both halves are asserted in `O-c(partial)`.
//
//   ⚠ AND NOTHING ANYWHERE DISCRIMINATES ARCHITECTURE FROM BEHAVIOUR. The ratified clause says impact analysis
//   *"identifies architecture and behavior PWUs"* — two KINDS, named. `affectedObjectIds` is a flat `string[]`
//   with no kind, no classification and no per-id verdict, so the distinction the clause turns on has nowhere to
//   live even if the analysis existed. That is the sharper half of this absence and it is easy to miss while
//   counting whether SOME ids came back.
//
//   REVIEW-REQUIRED. Searched `/review/i` over the Baseline vocabulary and `/REVIEW_REQUIRED|reviewRequired/`
//   over all of `packages/`. What EXISTS: `BaselineStatusSchema` has `UNDER_REVIEW`, and `assessDecisionRevocation`
//   in `rph-domain/src/governance.ts` returns `baselineDisposition: 'REVIEW_REQUIRED'`. NEITHER helps:
//     - `UNDER_REVIEW` is a PRE-promotion state. `Baseline.status`'s only in-arrow to it is `CANDIDATE ->
//       UNDER_REVIEW`, and AUTHORITATIVE has exactly two out-arrows, `SUPERSEDED` and `REVOKED`. Driven below.
//     - `assessDecisionRevocation` has NO non-test reference in the repository, and the enforcement register's
//       `RPH-GOV-007` row is blunter than I would have been: it "is a CONSTANT FUNCTION … can never return the
//       `REVOKED` half of its own declared union", so "its unit test therefore cannot discriminate".
//   And `BaselineObjectSchema` is a `z.strictObject` with no NAMED review, impact or staleness field.
//
//   ⚠ THAT IS THE WHOLE OF THE CLAIM, AND THE STRONGER ONE THAT STOOD HERE WAS FALSE. It read: *"so a
//   review-required flag could not be written even if something wanted to write one"*. It could.
//   `BaselineObjectSchema` spreads `objectEnvelopeShape` (`rph-contracts/src/envelopes.ts`), which carries
//   `tags: z.array(z.string())` and `extensions: z.array(ExtensionPayloadSchema)` — two untyped free-form
//   carriers — and the live baseline in this journey has both, both `[]`. A review marker could be parked in
//   either today. The derivation in `O-d(ii)(partial)` measures FIELD NAMES, and a name-absence is not an
//   impossibility: upgrading one into the other is the "grep the field name, not the concept" trap wearing the
//   opposite hat. So the true claim is narrower and is now DRIVEN rather than argued — no named field, no
//   post-promotion state to move to, no command that writes either, and the two generic carriers asserted EMPTY
//   so that "nothing recorded the falsification against the baseline" is measured.
//
// ── WHAT THIS SLICE DOES NOT DUPLICATE, AND WHY THAT IS NOT A GAP ───────────────────────────────────────────
// "Stale approval is not reused" has TWO arms in this engine and only ONE is asserted here.
//   - The VERSION arm — a decision that approved v1 does not authorize v2 — is already driven on the live bus by
//     `packages/rph-application/src/handlers/baseline-stale-decision-version.test.ts` (`RPH-GOV-003` / Property
//     P5, refusal marker `STALE_DECISION_VERSION`). It is CITED, not re-driven. A second copy would add a second
//     thing to maintain and no second fact.
//   - The SCOPE arm — an approval of ONE baseline does not authorize ANOTHER — is what `O-f` drives, because it
//     is the arm this journey actually creates: the falsification produces a SECOND, successor baseline, and the
//     question the scenario asks is whether the approval that blessed the first one can be reached for again.
//
// ⚠ AND THE ORDERING TRAP IS REAL AND WAS DESIGNED AROUND. `promoteBaseline` runs `canPromoteBaseline` BEFORE
// the stale-version arm, and `canPromoteBaseline` accumulates codes, so an arrangement that trips two guards
// reports both and proves neither. `O-f`'s successor is therefore FULLY assured on its own merits — its own
// execution, its own SATISFIED assessment, its own approved baseline — so that exactly ONE finding code can
// fire. Driven and confirmed: the refusal message contains `PROMOTION_DECISION_OUT_OF_SCOPE` and nothing else.
// ⚠ AND THAT "NOTHING ELSE" IS NOW PINNED RATHER THAN ARGUED. `canPromoteBaseline` joins its finding codes with
// `', '` into ONE message, so a `toContain` would pass unchanged for a refusal naming two codes — the whole
// over-built arrangement would have been unfalsifiable prose. `O-f` matches the code followed by the closing
// quote of the JSON `message`, which is what makes "exactly one guard spoke" fail the day it stops holding.
//
// ⚠ ONE RECON CLAIM WAS REFUTED BY DRIVING AND IS RECORDED RATHER THAN QUIETLY DROPPED. The reading that "the
// PWU is BASELINED, so nothing about it can move" is FALSE. `ChangePwuState` is a MULTI-AXIS setter and the
// workLifecycle axis is permitted to HOLD, so a BASELINED PWU is not frozen — other axes may still be driven
// subject to their own machines. What refuses `BASELINED -> SUPERSEDED` is narrower and had to be found: the
// arrow is ABSENT FROM THE MATRIX, and `SupersedePwu` separately does not DECLARE `BASELINED` among its source
// states. `O-e(partial)` asserts both messages, because a bare `not.toBe('ACCEPTED')` cannot tell them apart.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE — the prohibition the E2E-001 and E2E-002 Slices both record.
// It converts a false clause into a green suite, which is `SL-8`'s "weakened to green" wearing a different hat.
import {
	AssumptionFalsifiedPayloadSchema,
	BaselineObjectSchema,
	BaselineStatusSchema,
	COMMANDS,
	ControlActionSchema,
	IntentObjectSchema,
	ProfessionalWorkObjectTypeSchema,
	ProfessionalWorkUnitSchema
} from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';

import {
	assess,
	beginJourney,
	changeState,
	executeWork,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	JOURNEY_ACTOR,
	JOURNEY_POLICY,
	JOURNEY_TS,
	type Journey
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'E2E-003',
	title:
		'A material assumption is falsified after the architecture was baselined, and the record survives it',
	plane: 'ENGINE',
	// ⚠ RATIFIED HERE, NOT INHERITED. The roadmap's §9 table proposes `alternate valid path` for
	// `RPH-E2E-002/003/004/005/007` and its own §12 says the assignments "are proposed" and that only E2E-001 and
	// E2E-006 are settled — so accepting the row without a reason would be exactly the defect SL-5 names.
	//
	// The reason, stated for THIS journey rather than for the group: every command in it is ACCEPTED, and the two
	// refusals it asserts are refusals of acts a professional SHOULD NOT be able to perform, not of acts that
	// went wrong. Nothing is malformed, so it is not a `user-error path` — the user's clarification is CORRECT
	// information arriving late, which is the ordinary condition of professional work rather than a mistake.
	// Nothing fails, so it is not a `system-failure path`. No authority is lacking (the same Undertaking Owner
	// holds every act), no execution is interrupted, no data is unavailable, and nothing is cancelled — the
	// architecture keeps its baseline and its history intact throughout. What differs from `RPH-E2E-001` is that
	// the journey BRANCHES: the same undertaking continues down a second, equally legitimate route, revising and
	// re-doing rather than abandoning. That is the definition of an alternate valid path.
	//
	// ⚠ `cancellation path` WAS CONSIDERED AND REJECTED ON A DISTINCTION WORTH RECORDING: nothing here is
	// cancelled. The falsified assumption does not withdraw the architecture, does not revoke the decision and
	// does not touch the baseline. The prior work stands as a true record of what was professionally correct on
	// the evidence then available — which is PER-2, and is the opposite of a cancellation.
	scenarioClass: 'alternate valid path',
	citedRules: ['RPH-E2E-003'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'E2E-003-M1',
			file: 'packages/rph-application/src/handlers/assurance.ts',
			find: '\t\t\t\tpriorStatus,',
			replace: "\t\t\t\tpriorStatus: 'PROPOSED',",
			expectRed: ['O-a'],
			predictedMessage:
				'the falsification must record the DISCLOSED state it left — clause (a) is an ARROW that was walked, not a status that was assigned',
			why: "Proves clause (a) is asserted on the arrow rather than on the destination. `status === 'FALSIFIED'` alone would pass in a world where the command simply wrote a field; `priorStatus` on the ratified event is the only thing that says the assumption was DISCLOSED — the state it had to reach before it could be falsified at all, since FALSIFIED's in-arrows exclude PROPOSED. STA-7's *'history is never rewritten by invalidation'* is carried by this field and nothing else. ⚠ AND NOT 'that it had authorized work', which is what this field was previously said to record: in THIS arrangement the assumption authorized nothing. Both PWUs are proposed with `assumptionIds: []` and the assumption is detected AFTER the baseline was promoted, so `priorStatus` records the ARROW, never a dependency the work had on the premise."
		},
		{
			id: 'E2E-003-M2',
			file: 'packages/rph-application/src/handlers/intent.ts',
			find: '\t\tbumpSemanticVersion: true,',
			replace: '\t\tbumpSemanticVersion: false,',
			expectRed: ['O-b'],
			predictedMessage:
				'a revision must increment the semantic version — clause (b), and the increment is the whole mechanism by which any downstream approval can later be told it is stale',
			why: 'Proves clause (b) is asserted on the VERSION and not merely on the status word. `intentStatus === \'REVISED\'` is satisfiable by a status write that changes nothing else, and the version is what `approveIntent`\'s stale-approval guard and `decisionAuthorizesVersions` both key on — a revision that did not bump it would be a revision no guard downstream could see.'
		},
		{
			id: 'E2E-003-M3',
			file: 'packages/rph-domain/src/decomposition.ts',
			find: '\t\timpactedObjectIds: [...a.affectedObjectIds],',
			replace: '\t\timpactedObjectIds: [],',
			expectRed: ['O-c(partial)'],
			predictedMessage:
				'the falsification hands back the id list its own detector declared, unexamined and unfiltered — this is a REPLAY, and it is the only thing clause (c) has',
			why: "Proves the narrower claim `O-c(partial)` actually makes: that the ids on the event come from `assessFalsification` copying the assumption's own `affectedObjectIds`. ⚠ NOTE WHAT THIS MUTANT CANNOT DO, because it is the honest half: it cannot prove the ABSENCE of an impact analysis. No find/replace conjures a command, an object type or an event into existence, so the absence assertions in `O-c(partial)` are DERIVED from the ratified registries at runtime and carry no mutant. The inability is the finding — SL-3's own instruction where no narrow mutant exists."
		},
		{
			id: 'E2E-003-M4',
			file: 'packages/rph-application/src/handlers/governance.ts',
			find: "\t\tprecondition: fromStates('APPROVED'),",
			replace: "\t\tprecondition: fromStates('APPROVED', 'AUTHORITATIVE'),",
			expectRed: ['O-d(i)'],
			predictedMessage:
				'a promoted baseline may not be re-promoted, and the refusal must name the state it is in — clause (d), the immutability half',
			why: "Proves `O-d(i)`'s driven half keys on the STATE precondition that makes AUTHORITATIVE a one-way door, not merely on some refusal occurring. With the mutant the dispatch still fails — `canPromoteBaseline` finds AUTHORITATIVE -> AUTHORITATIVE illegal — but with a DIFFERENT message, which is exactly the pair of guards a bare `not.toBe('ACCEPTED')` would have conflated."
		},
		{
			id: 'E2E-003-M5',
			file: 'packages/rph-application/src/handlers/governance.ts',
			find: "\t\tprecondition: fromStates('CANDIDATE'),",
			replace: "\t\tprecondition: fromStates('CANDIDATE', 'AUTHORITATIVE'),",
			expectRed: ['O-d(ii)(partial)'],
			predictedMessage:
				'an authoritative baseline cannot be sent back for review — the one command whose name suggests it refuses on the state, which is why review-required has no home',
			why: "Proves the DRIVEN limb of the review-required absence. The absence itself is derived from the ratified enum and schema, which no mutant can remove; what a mutant CAN show is that `SubmitBaselineForReview` — the only command in the vocabulary whose name even sounds like the ratified clause — is refused on the baseline's state and not for some incidental reason. Under the mutant the refusal moves to the transition matrix and the message changes."
		},
		{
			id: 'E2E-003-M6',
			file: 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
			find: '\tif (spec.sourceStates.includes(current as WorkLifecycleState)) return { ok: true };',
			replace: '\tif (spec.sourceStates.length >= 0) return { ok: true };',
			expectRed: ['O-e(partial)'],
			predictedMessage:
				'SupersedePwu must refuse a BASELINED predecessor as an UNDECLARED ARROW — the command does not claim to be the one that performs it',
			why: "Proves `O-e(partial)`'s first refusal is the DECLARED-SOURCE check and not the transition matrix. The two are genuinely different refusals with different messages and the test asserts both separately; with this mutant the declared-source check passes unconditionally and the matrix refuses instead, so the first assertion reddens while the second stays green — which is precisely how the two mechanisms were told apart in the first place. ⚠ THE REPLACEMENT WAS RETARGETED BECAUSE THE FIRST ONE DID NOT COMPILE. It read `spec.target !== 'NO_SUCH_STATE'`, and `spec.target` is a `WorkLifecycleState`: `tsc` rejects a comparison with a literal outside that union as having no overlap. Vitest transpiles without type-checking, so the mutant ran and reddened correctly and the break was invisible — but a mutation harness that type-checks scores a build break, not a killed mutant, and a mutant that cannot be driven proves nothing. `spec.sourceStates.length >= 0` is the same behaviour change (the guard always passes) with no type error, keeps `current` used by the reason string below it, and shares no substring with the anchor."
		},
		{
			id: 'E2E-003-M7',
			file: 'packages/rph-application/src/handlers/pwu.ts',
			find: '\t\t\t\tsupersedingWorkUnitId: p.supersedingWorkUnitId,',
			replace: "\t\t\t\tsupersedingWorkUnitId: 'pwu_mutant_not_the_successor',",
			expectRed: ['O-e(partial)'],
			predictedMessage:
				'where the successor link CAN be written it names the successor, and it is written to the EVENT only — the PWU object has no field to hold it',
			why: "Proves the differential limb of `O-e(partial)`: that `SupersedePwu` performs the arrow it declares and carries a real successor id when its source state is one it claims. Without that limb the test would show only refusals, and a refusal proves nothing about a command that might be broken for unrelated reasons. ⚠ THE OTHER HALF OF THIS ASSERTION CARRIES NO MUTANT AND CANNOT: that the PWU object has no successor field is a property of a `z.strictObject`, derived at runtime, and there is no find/replace that adds a field to a schema without also adding the write that fills it."
		},
		{
			id: 'E2E-003-M8',
			file: 'packages/rph-domain/src/governance.ts',
			find: "\t\t\tcode: 'PROMOTION_DECISION_OUT_OF_SCOPE',",
			replace: "\t\t\tcode: 'MUTANT_UNRELATED_REFUSAL',",
			expectRed: ['O-f'],
			predictedMessage:
				'the successor baseline must be refused because the stale approval does not name it — an authorization does not bleed to another object',
			why: "Proves clause (f) is asserted on the CODE the scope arm emits rather than on the mere fact of a refusal, which is the `JAN-CSAA` lesson in its original form: a promotion is refusable on ten independent grounds and `RPH_INVARIANT_VIOLATION` is emitted by all of them. ⚠ THE REPLACEMENT SHARES NO SUBSTRING WITH THE ANCHOR ON PURPOSE — `E2E-002-M1` shipped a first version whose replacement CONTAINED the original and stayed green against a `toContain`. Both `O-f` assertions it reddens are anchored matches (`/: PROMOTION_DECISION_OUT_OF_SCOPE\"/`), so the substring hazard cannot recur here even by accident."
		},
		{
			id: 'E2E-003-M9',
			file: 'packages/rph-domain/src/pwuGuards.ts',
			find: "\t'REVISED'",
			replace: "\t'MUTANT_NOT_A_READY_STATUS'",
			expectRed: ['O-e(partial)', 'O-f'],
			predictedMessage:
				'MarkPwuReady: PWU pwu_01ARZ3NDEKTSV4RRFFQ69G5X12 does not satisfy the shape readiness contract (DOC-002 §9): root PWU intent must be at least PROVISIONAL, is REVISED (DOC-002 §6.3 L472)',
			why: "⚠ DECLARED BECAUSE THE ONLY ASSERTED HALF OF CLAUSE (e) HAD NO MUTANT, AND THE FILE DID NOT SAY SO. `expect(j.state(SUCCESSOR).workLifecycleState).toBe('READY')` is the whole of 'successor architecture work is created', and `M6`/`M7` both target the LINK — neither touches it. Worse, the outcome is WHITELISTED: `INTENT_AT_LEAST_PROVISIONAL` (`pwuGuards.ts`) is {PROVISIONAL, FORMALIZED, APPROVED, REVISED}, so 'the revision did not break the shape-readiness contract' could not have come out any other way, which made it the closest thing in this file to a control that cannot fail. This mutant removes REVISED from that set; `checkPwuShapeReadiness` then fails its root-intent limb for the successor (driven directly against the kernel: {ok:false, unmet:['root PWU intent must be at least PROVISIONAL, …']}), `markPwuReady` rejects, and the fail-loud `j.send` turns that into red. ⚠ AND THE HONEST HALF: it reddens TWO observations, not one, because `O-f` also marks the successor READY through `executeWork`. It still discriminates — `O-a`, `O-b`, `O-c(partial)`, `O-d(i)` and `O-d(ii)(partial)` all stay green, since the ARCHITECTURE is marked ready inside `journey()` while the intent is still APPROVED. The redness arrives as a refusal at the arranging command rather than at the assertion, which is why `predictedMessage` quotes the guard verbatim rather than the assertion it defends."
		}
	]
};

// ── The undertaking ──────────────────────────────────────────────────────────────────────────────────────────
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5X00';
const ARCHITECTURE = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X10';
const BEHAVIOUR = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X11';
const SUCCESSOR = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X12';
/**
 * ⚠ AN ID THAT NAMES NOTHING, PLANTED DELIBERATELY. It is never proposed, never created, never anything. It is
 * in the assumption's `affectedObjectIds` so that `O-c(partial)` can show the falsification hands it straight
 * back — which is what makes "replay" a measured claim rather than an adjective.
 */
const NEVER_CREATED = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X13';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5X20';
const EVIDENCE = 'evd_01ARZ3NDEKTSV4RRFFQ69G5X30';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5X40';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5X50';
const ATTEMPT = 'att_01ARZ3NDEKTSV4RRFFQ69G5X60';
const ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5X70';
const DECISION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5X80';
const BASELINE = 'base_01ARZ3NDEKTSV4RRFFQ69G5X90';
const ASSUMPTION = 'asm_01ARZ3NDEKTSV4RRFFQ69G5XA0';
const CONTRADICTION = 'evd_01ARZ3NDEKTSV4RRFFQ69G5XB0';
/** ⚠ AN ID THAT NAMES NOTHING EITHER — `ReviseIntent.impactAnalysisId` is unvalidated. See `O-c(partial)`. */
const IMPACT_ANALYSIS_THAT_DOES_NOT_EXIST = 'ia_01ARZ3NDEKTSV4RRFFQ69G5XZZ';

// The successor's own, separate professional apparatus. It earns its assurance rather than borrowing any.
const S_CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5XC0';
const S_EVIDENCE = 'evd_01ARZ3NDEKTSV4RRFFQ69G5XC1';
const S_PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5XC2';
const S_STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5XC3';
const S_ATTEMPT = 'att_01ARZ3NDEKTSV4RRFFQ69G5XC4';
const S_ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5XC5';
const S_BASELINE = 'base_01ARZ3NDEKTSV4RRFFQ69G5XC6';
const S_DECISION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5XC7';
/**
 * ⚠ THE SINGLE-VARIABLE CONTROL FOR `O-f`. A PROMOTE_BASELINE decision minted AFTER the falsification — same
 * side of the clarification as `S_DECISION` — that still names only the ORIGINAL baseline. It holds TIMING
 * constant and varies SCOPE alone, which the `DECISION`/`S_DECISION` pair cannot do because those two differ in
 * both at once.
 */
const LATE_DECISION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5XC8';

/**
 * Carry a PWU that has EXECUTED and been assessed SATISFIED all the way to workLifecycle SATISFIED.
 *
 * ⚠ FIVE HOPS, NOT ONE, AND BOTH MACHINES ARE WHY — the same fact the E2E-002 Slice records for the REJECTED
 * verdict, restated here because the SATISFIED path walks the identical spine. `PWU.assuranceState` has no
 * `UNASSESSED -> ASSESSING` arrow (it goes via EVIDENCE_REQUIRED and READY_FOR_ASSESSMENT) and
 * `workLifecycleState` has no `EXECUTING -> UNDER_ASSURANCE` arrow (it goes via EVIDENCE_PENDING). A multi-axis
 * setter permits an axis to HOLD, which is how the two are walked in step.
 */
function satisfy(j: Journey, pwuId: string, assessmentId: string): void {
	const hop = (previousState: string, newState: string, assuranceState: string): void =>
		changeState(j, pwuId, {
			previousState,
			newState,
			executionState: 'SUCCEEDED',
			assuranceState,
			supportingObjectIds: [assessmentId]
		});
	hop('EXECUTING', 'EVIDENCE_PENDING', 'EVIDENCE_REQUIRED');
	hop('EVIDENCE_PENDING', 'EVIDENCE_PENDING', 'READY_FOR_ASSESSMENT');
	hop('EVIDENCE_PENDING', 'UNDER_ASSURANCE', 'ASSESSING');
	hop('UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SATISFIED');
	hop('UNDER_ASSURANCE', 'SATISFIED', 'SATISFIED');
}

/**
 * The journey, to the point where every clause is decidable.
 *
 * ⚠ THE ARCHITECTURE IS TAKEN ALL THE WAY TO BASELINED BEFORE THE CLARIFICATION ARRIVES, AND THAT IS THE WHOLE
 * ARRANGEMENT. A falsification against work that had not yet been blessed would prove nothing about clause (d):
 * an APPROVED baseline is still editable (`assertBaselineItemSetImmutable('APPROVED').ok === true`), so
 * immutability is only a claim about an AUTHORITATIVE one. Getting there costs eleven acts and every one of them
 * is a real governed fact — including a human PROMOTE_BASELINE decision, because `canPromoteBaseline` refuses a
 * promotion that lacks one and refusing to arrange it would leave the Slice asserting things about a world it
 * never built.
 *
 * ⚠ AND THE BEHAVIOUR PWU IS A REAL OBJECT, NOT A NAME IN A LIST. The ratified clause says impact analysis
 * identifies architecture AND BEHAVIOR PWUs, so a Slice that never created a behaviour PWU could not tell the
 * difference between "the engine identified it" and "the engine echoed a string". It is proposed here so that
 * the id in `affectedObjectIds` resolves — and `NEVER_CREATED` sits beside it so the test can show that
 * resolving is not something the engine checks.
 */
function journey(): Journey {
	const j = beginJourney();
	seedJourneyPolicy(j);
	seedIntentAndArchitecture(j, { intentId: INTENT, pwuId: ARCHITECTURE });

	// The other half of the work the clarification will touch.
	j.send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', BEHAVIOUR, {
		pwuId: BEHAVIOUR,
		pwuKind: 'PRODUCT_BEHAVIOR_DEFINITION',
		title: 'Product Behaviour Definition',
		description: 'the behaviour the field service platform must exhibit',
		intentId: INTENT,
		boundaries: {
			inScope: ['job dispatch'],
			outOfScope: ['payroll'],
			permittedChanges: [],
			prohibitedChanges: []
		},
		obligationIds: [],
		constraintIds: [],
		assumptionIds: [],
		expectedOutputs: [{ outputId: 'out_slice_behaviour', kind: 'DOCUMENT' }],
		assurancePolicyIds: [JOURNEY_POLICY],
		riskProfile: {
			consequence: 'HIGH',
			uncertainty: 'MEDIUM',
			irreversibility: 'MEDIUM',
			securitySensitivity: 'MEDIUM',
			regulatoryExposure: 'LOW'
		}
	});

	// The architecture is designed, assured, approved and frozen. Everything below this line is legitimate.
	executeWork(j, {
		pwuId: ARCHITECTURE,
		planId: PLAN,
		stepId: STEP,
		attemptId: ATTEMPT,
		claimId: CLAIM,
		evidenceId: EVIDENCE
	});
	assess(j, { assessmentId: ASSESSMENT, pwuId: ARCHITECTURE, disposition: 'SATISFIED' });
	satisfy(j, ARCHITECTURE, ASSESSMENT);
	j.send('CreateBaseline', 'BASELINE', BASELINE, {
		baselineType: 'ARCHITECTURE',
		itemObjectIds: [ARCHITECTURE],
		assuranceAssessmentIds: [ASSESSMENT]
	});
	j.send('SubmitBaselineForReview', 'BASELINE', BASELINE, {});
	j.send('ApproveBaseline', 'BASELINE', BASELINE, {});
	j.send('ProposeDecision', 'DECISION', DECISION, {
		decisionType: 'PROMOTE_BASELINE',
		subjectObjectIds: [ARCHITECTURE, BASELINE],
		selectedOption: 'promote',
		rationale: 'the architecture serves the approved intent at the scale it was shaped for',
		// REG-F-014: a Decision's declared authority must EQUAL the issuing actor.
		authority: JOURNEY_ACTOR
	});
	j.send('ApproveDecision', 'DECISION', DECISION, {
		selectedOption: 'promote',
		rationale: 'the architecture serves the approved intent at the scale it was shaped for',
		consideredEvidenceIds: [EVIDENCE],
		consideredObservationIds: [],
		subjectSemanticVersions: { [ARCHITECTURE]: 1 }
	});
	j.send('PromoteBaseline', 'BASELINE', BASELINE, {
		promotionDecisionId: DECISION,
		expectedItemObjectVersions: [{ objectId: ARCHITECTURE, semanticVersion: 1 }],
		requiredAssessmentIds: [ASSESSMENT]
	});
	j.send('BaselinePwu', 'PROFESSIONAL_WORK_UNIT', ARCHITECTURE, { baselineId: BASELINE });

	// ── THE CLARIFICATION ────────────────────────────────────────────────────────────────────────────────────
	// "the user clarifies that the product must support national enterprises" (§24, Given/When).
	//
	// ⚠ IT ENTERS AS EVIDENCE AND IT HAS TO. `FalsifyAssumption` refuses a falsification citing no contradicting
	// evidence, and refuses one citing an id that is not an EVIDENCE object — both driven in
	// `assumption-falsification.test.ts`'s controls. So a clarification cannot falsify anything by being said;
	// it falsifies by being RECORDED, which is the professional point and not an implementation detail.
	j.send('ProposeEvidence', 'EVIDENCE', CONTRADICTION, {
		evidenceId: CONTRADICTION,
		evidenceType: 'OBSERVATION',
		contentReference: {
			kind: 'INLINE',
			note: 'The user states the product must support national enterprises, not small businesses.'
		},
		producedBy: JOURNEY_ACTOR,
		supportsClaimIds: [],
		contradictsClaimIds: [],
		scope: 'the scale of the undertaking',
		limitations: [],
		capturedAt: JOURNEY_TS
	});

	// ⚠ THE ASSUMPTION IS DETECTED HERE RATHER THAN AT SHAPING TIME, AND A READER SHOULD NOT TAKE THAT FOR THE
	// SCENARIO'S CLAIM. §24 says the architecture ASSUMES small-business scale — i.e. the premise was live all
	// along. `seedIntentAndArchitecture` proposes its PWU with `assumptionIds: []` and that fixture is shared
	// with four other Slices, so it is not changed here; the assumption is instead recorded with the affected
	// work named on IT. That is the direction the engine actually reads: `assessFalsification` takes the
	// assumption's `affectedObjectIds` and never consults any PWU's `assumptionIds`. The scenario is not weakened
	// by this — it is recorded at the moment the premise becomes VISIBLE, which is what a disclosure is.
	j.send('DetectAssumption', 'ASSUMPTION', ASSUMPTION, {
		assumptionId: ASSUMPTION,
		statement: 'The product serves small businesses only',
		introducedBy: JOURNEY_ACTOR,
		affectedObjectIds: [ARCHITECTURE, BEHAVIOUR, NEVER_CREATED],
		materiality: 'MATERIAL'
	});
	// ⚠ DISCLOSE IS NOT OPTIONAL AND NOT CEREMONY. FALSIFIED's in-arrows are DISCLOSED|UNDER_VERIFICATION|
	// ACCEPTED|VERIFIED — PROPOSED is absent from the machine, so an assumption nobody disclosed cannot be
	// falsified. `assumption-falsification.test.ts` drives that refusal as a named control.
	j.send('DiscloseAssumption', 'ASSUMPTION', ASSUMPTION, {});
	j.send('FalsifyAssumption', 'ASSUMPTION', ASSUMPTION, {
		contradictingEvidenceIds: [CONTRADICTION]
	});

	j.send('ReviseIntent', 'INTENT', INTENT, {
		changeRationale:
			'the user clarified national-enterprise scale, which the approved objective did not contemplate',
		impactAnalysisId: IMPACT_ANALYSIS_THAT_DOES_NOT_EXIST
	});
	return j;
}

/** Create the successor architecture work under the revised intent. Its own ids throughout; it borrows nothing. */
function proposeSuccessor(j: Journey): void {
	j.send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', SUCCESSOR, {
		pwuId: SUCCESSOR,
		pwuKind: 'ARCHITECTURE_DEFINITION',
		title: 'Architecture Definition at national-enterprise scale',
		description: 'the successor architecture, shaped for national enterprises',
		intentId: INTENT,
		boundaries: {
			inScope: ['multi-region data partitioning', 'tenant isolation boundary'],
			outOfScope: ['billing integration'],
			permittedChanges: [],
			prohibitedChanges: []
		},
		obligationIds: [],
		constraintIds: [],
		assumptionIds: [],
		expectedOutputs: [{ outputId: 'out_slice_successor', kind: 'DOCUMENT' }],
		assurancePolicyIds: [JOURNEY_POLICY],
		riskProfile: {
			consequence: 'CRITICAL',
			uncertainty: 'HIGH',
			irreversibility: 'MEDIUM',
			securitySensitivity: 'HIGH',
			regulatoryExposure: 'MEDIUM'
		}
	});
}

describe('SLICE E2E-003 — a material assumption is falsified after the architecture was baselined', () => {
	it('O-a — the small-business assumption really becomes FALSIFIED, on recorded contradicting evidence', () => {
		const j = journey();
		expect(
			(j.state(ASSUMPTION) ?? {}).status,
			'the assumption must read FALSIFIED — clause (a) of the ratified Then block'
		).toBe('FALSIFIED');

		const falsified = j.engine
			.readAllEvents()
			.find((e) => e.eventType === 'AssumptionFalsified');
		const payload = (falsified?.payload ?? {}) as Record<string, unknown>;
		// ⚠ THE ARROW, NOT THE DESTINATION. A status field reading FALSIFIED is satisfiable by a write. What says
		// a falsification HAPPENED is that the event records the state it left — and STA-7's "history is never
		// rewritten by invalidation" is carried by this field and by nothing else in the system.
		expect(
			payload.priorStatus,
			'the falsification must record the DISCLOSED state it left — clause (a) is an ARROW that was walked, not a status that was assigned'
		).toBe('DISCLOSED');
		expect(
			payload.contradictingEvidenceIds,
			'and it must cite the recorded clarification: an assumption is not falsified by being doubted, but by evidence that contradicts it'
		).toEqual([CONTRADICTION]);
	});

	it('O-b — the approved intent is revised, and the revision increments the version every stale-approval guard keys on', () => {
		const j = journey();
		expect(
			(j.state(INTENT) ?? {}).intentStatus,
			'the intent must read REVISED — clause (b), the APPROVED -> REVISED arrow'
		).toBe('REVISED');
		// ⚠ THE VERSION IS THE LOAD-BEARING HALF AND THE STATUS WORD IS NOT. `decisionAuthorizesVersions` and
		// `approveIntent`'s own stale-approval check both compare semantic versions; a revision that left the
		// version alone would be invisible to every guard downstream of it, including clause (f)'s.
		expect(
			j.engine.loadObject(INTENT)?.semanticVersion,
			'a revision must increment the semantic version — clause (b), and the increment is the whole mechanism by which any downstream approval can later be told it is stale'
		).toBe(2);
		const revised = j.engine.readAllEvents().find((e) => e.eventType === 'IntentRevised');
		expect(
			(revised?.payload as { semanticVersion?: number } | undefined)?.semanticVersion,
			'and the governed event must carry the version the revision landed on, not merely the fact that one happened'
		).toBe(2);
	});

	// ⚠⚠ NAMED FOR WHAT IT PROVES, NOT FOR THE CLAUSE IT WOULD LIKE TO CLAIM.
	//
	// The ratified clause is *"impact analysis identifies architecture and behavior PWUs"*. There is no impact
	// analysis in this engine. What there is:
	//   - a BOOLEAN FLAG on the event (`impactAnalysisRequired: true`), which the `falsifyAssumption` handler's
	//     own header describes as the ceiling STA-7 licenses: "flag for review rather than cascade destructively";
	//   - an id list that is a VERBATIM COPY of what the assumption's detector declared, proven below by the id
	//     that names no object at all coming straight back out;
	//   - an unvalidated `impactAnalysisId` on the revision, which points at nothing here and is accepted, and
	//     which reaches the EVENT and never the Intent object.
	// And NOTHING anywhere carries the architecture/behaviour DISTINCTION the clause turns on: `affectedObjectIds`
	// is a flat `string[]` with no kind and no per-id classification.
	//
	// So what is asserted is the replay and the absences. What a reader must NOT conclude from this green: that
	// anything examined the architecture, the behaviour, or their relationship. Nothing did.
	it('O-c(partial) — the falsification REPLAYS the ids its detector declared; no impact analysis exists to identify anything', () => {
		const j = journey();
		const falsified = j.engine
			.readAllEvents()
			.find((e) => e.eventType === 'AssumptionFalsified');
		const payload = (falsified?.payload ?? {}) as Record<string, unknown>;

		// (1) THE REPLAY, stated as an equality rather than as a membership test. `toContain` would have passed
		// for an engine that computed a superset, and the point is that it computes nothing.
		expect(
			payload.affectedObjectIds,
			'the falsification hands back the id list its own detector declared, unexamined and unfiltered — this is a REPLAY, and it is the only thing clause (c) has'
		).toEqual([ARCHITECTURE, BEHAVIOUR, NEVER_CREATED]);
		// And the proof that it is a replay and not a resolution: an id that names NO OBJECT survives the round
		// trip. An analysis would have had to look the object up; this did not.
		expect(
			j.engine.loadObject(NEVER_CREATED),
			'PINNED: the third id resolves to no object in the store, and the engine returned it anyway — the ids are echoed, never resolved'
		).toBeUndefined();
		expect(
			payload.impactAnalysisRequired,
			'what the engine records instead is a FLAG that one is required — the disclosure STA-7 licenses in place of a cascade'
		).toBe(true);

		// (2) THE ABSENCES, DERIVED FROM THE RATIFIED REGISTRIES AT RUNTIME. Written as derivations rather than
		// as hand-written lists on purpose: a hand-listed absence is a claim about my reading of the corpus that
		// nothing checks, and the day an IMPACT_ANALYSIS command is minted this test must go red by itself.
		expect(
			ProfessionalWorkObjectTypeSchema.options.filter((t) => /impact|analys/i.test(t)),
			'ABSENT: no object type in the ratified ontology carries an impact analysis, so there is nothing for one to be recorded ON'
		).toEqual([]);
		expect(
			Object.keys(COMMANDS).filter((c) => /impact|analys/i.test(c)),
			'ABSENT: no command in the ratified vocabulary requests, records or completes an impact analysis'
		).toEqual([]);
		expect(
			Object.values(COMMANDS)
				.map((s) => (s as { emitsEvent: string }).emitsEvent)
				.filter((e) => /impact|analys/i.test(e)),
			'ABSENT: and no event in the ratified vocabulary announces one either, so the flag above reaches no command and no event'
		).toEqual([]);

		// ⚠⚠ AND THE NARROWING THAT SENTENCE USED TO LACK, BECAUSE THE CORPUS ITSELF REFUTES THE STRONGER FORM.
		// This assertion's message read *"so the flag above is addressed to nobody"*, and that is FALSE. The
		// ratified ontology this engine loads names an addressee, in the falsification scenario, in terms:
		// `POL-ASSUMPTION-DISCLOSURE`'s `UNBOUNDED_ASSUMPTION_SCOPE` says on falsification "the impact analysis
		// has no bounded set to work from and INVALIDATE_DEPENDENTS cannot be aimed at anything". That control
		// action is ratified, is carried in two policies' `permittedControlActions`, and that field GOVERNS —
		// Gate B (`rejectUnpermittedControlActions`) refuses a recommendation a policy does not permit.
		//
		// So the two limbs below replace one over-claim with the pair of facts that are actually true, both
		// derived: the aiming point EXISTS, and the falsification event has no field that could aim it.
		expect(
			ControlActionSchema.options.filter((a) => a === 'INVALIDATE_DEPENDENTS'),
			'PRESENT, and it is why the sentence above is narrowed: the ratified control-action vocabulary DOES carry the cascade the corpus names for exactly this falsification'
		).toEqual(['INVALIDATE_DEPENDENTS']);
		expect(
			Object.keys(AssumptionFalsifiedPayloadSchema.shape).filter((k) =>
				/control|action|remediat/i.test(k)
			),
			'ABSENT: but the ratified falsification event carries no control action at all, so INVALIDATE_DEPENDENTS cannot be aimed from here — the flag names a requirement and no addressee'
		).toEqual([]);

		// (3) THE DANGLING REFERENCE, DRIVEN. `ReviseIntent.impactAnalysisId` is the one field in the ratified
		// vocabulary that names an impact analysis. It was ACCEPTED here pointing at an id nothing has ever
		// created — so the field cannot be evidence that an analysis happened — and it reaches the EVENT only.
		expect(
			j.engine.loadObject(IMPACT_ANALYSIS_THAT_DOES_NOT_EXIST),
			'PINNED: the revision was accepted citing an impact analysis that does not exist; nothing validates the reference'
		).toBeUndefined();
		// ⚠ THE FILTER IS TAKEN OVER A NAMED VARIABLE AND THE OBJECT'S EXISTENCE IS ASSERTED FIRST, BECAUSE
		// `Object.keys(j.state(INTENT) ?? {}).filter(…)` is EMPTY in two different worlds — "no impact key" and
		// "no object" — and cannot tell them apart. It is non-vacuous today, but a structurally vacuous-on-absence
		// assertion is the exact shape the rest of this file goes out of its way to avoid.
		const intentKeys = Object.keys(j.state(INTENT) ?? {});
		expect(
			intentKeys,
			'CONTROL: the filter below runs over a REAL object — an empty filter over a missing Intent would be indistinguishable from an empty filter over a present one'
		).toContain('intentStatus');
		expect(
			intentKeys.filter((k) => /impact/i.test(k)),
			'and the Intent OBJECT does not carry it at all, so no read model can even display the dangling citation'
		).toEqual([]);
	});

	// ⚠ THE IMMUTABILITY IS REAL AND ITS MECHANISM IS NOT A GUARD. The enforcement register's `RPH-BAS-005` row
	// rules the class: "NO DISPATCHABLE COMMAND CAN CHANGE A BASELINE'S ITEM SET … immutability holds by the
	// ABSENCE OF A MUTATOR, not by a guard", and it records that the predicate written for the rule,
	// `assertBaselineItemSetImmutable`, has no non-test reference. This test does not restate that; it DRIVES
	// the two halves the register's disposition leaves as reading — that the item set survives the falsification
	// untouched, and that the vocabulary really does hold no mutator.
	it('O-d(i) — the authoritative Architecture Baseline is untouched by the falsification, and the vocabulary holds no command that could touch it', () => {
		const j = journey();
		const baseline = j.state(BASELINE) ?? {};
		expect(
			baseline.status,
			'the baseline must still be AUTHORITATIVE after the premise under it was falsified — clause (d): falsification does not unmake a governance act'
		).toBe('AUTHORITATIVE');
		expect(
			baseline.itemObjectVersions,
			'and it must freeze exactly what it froze, at the version it froze — the item set is what "immutable" is about'
		).toEqual([{ objectId: ARCHITECTURE, semanticVersion: 1 }]);

		// The one command that could plausibly re-open it, driven. Asserted on the MESSAGE: this dispatch is
		// refusable on two independent grounds (the state precondition, and canPromoteBaseline's
		// ILLEGAL_PROMOTION_TRANSITION) and a bare non-ACCEPTED cannot say which one spoke.
		const rePromote = j.attempt('PromoteBaseline', 'BASELINE', BASELINE, {
			promotionDecisionId: DECISION,
			expectedItemObjectVersions: [{ objectId: ARCHITECTURE, semanticVersion: 1 }],
			requiredAssessmentIds: [ASSESSMENT]
		});
		expect(rePromote.status, 'a promoted baseline may not be promoted again').not.toBe('ACCEPTED');
		expect(
			JSON.stringify(rePromote.error ?? {}),
			'a promoted baseline may not be re-promoted, and the refusal must name the state it is in — clause (d), the immutability half'
		).toContain('to be APPROVED, but it is AUTHORITATIVE');

		// AND THE STRUCTURAL HALF, DERIVED. Five baseline commands exist and not one of them edits, amends or
		// adds an item; that is why immutability needs no guard. Derived from the ratified registry rather than
		// hand-listed, so a sixth command minted tomorrow reddens this instead of slipping past a comment.
		expect(
			Object.entries(COMMANDS)
				.filter(([, s]) => (s as { targetAggregateType: string }).targetAggregateType === 'BASELINE')
				.map(([name]) => name)
				.sort(),
			'ABSENCE OF A MUTATOR: the ratified vocabulary offers exactly five baseline commands, none of which can change an item set — this, and not a guard, is what makes an authoritative baseline immutable'
		).toEqual([
			'ApproveBaseline',
			'CreateBaseline',
			'PromoteBaseline',
			'SubmitBaselineForReview',
			'SupersedeBaseline'
		]);
	});

	// ⚠⚠ THIS CLAUSE IS NOT ASSERTED, AND THE NAME SAYS SO. The ratified conjunction is "immutable BUT
	// review-required". The first half is `O-d(i)`. The second half has no home in this engine at all, and the
	// searches were run in both directions — for the CONCEPT (`/review/i` over the Baseline vocabulary) and for
	// the spelling (`/REVIEW_REQUIRED|reviewRequired/` over `packages/`) — before that was written down.
	//
	// WHAT THE SEARCHES DID RETURN, and why neither is the clause:
	//   - `UNDER_REVIEW` is a real BaselineStatus, and it is a PRE-promotion state: the machine's only in-arrow
	//     to it is `CANDIDATE -> UNDER_REVIEW`, and AUTHORITATIVE has exactly two out-arrows, SUPERSEDED and
	//     REVOKED. Driven below rather than read off the matrix.
	//   - `assessDecisionRevocation` returns `baselineDisposition: 'REVIEW_REQUIRED'` — and it has NO non-test
	//     caller, and the enforcement register's RPH-GOV-007 row records that it "is a CONSTANT FUNCTION" whose
	//     "unit test therefore cannot discriminate". It is a name, not a mechanism.
	//
	// So a professional looking at this baseline after the falsification sees AUTHORITATIVE and nothing else.
	// The falsified premise is recorded on the ASSUMPTION and on the EVENT; the baseline that rests on it is not
	// marked in any way. That is the finding, and it is the reason this test exists rather than being skipped.
	it('O-d(ii)(partial) — the baseline cannot be marked review-required: no such state, no such arrow, no such field', () => {
		const j = journey();

		// The one command in the vocabulary whose name even sounds like the clause, driven against the
		// authoritative baseline. Asserted on the MESSAGE, because this dispatch is refusable on two grounds.
		const review = j.attempt('SubmitBaselineForReview', 'BASELINE', BASELINE, {});
		expect(review.status, 'an authoritative baseline cannot be sent back for review').not.toBe(
			'ACCEPTED'
		);
		expect(
			JSON.stringify(review.error ?? {}),
			'an authoritative baseline cannot be sent back for review — the one command whose name suggests it refuses on the state, which is why review-required has no home'
		).toContain('to be CANDIDATE, but it is AUTHORITATIVE');

		// AND THE VOCABULARY, DERIVED. One status mentions review and it is the pre-promotion one; the object has
		// no NAMED field that could hold a flag instead. Both derived, so a ratified addition reddens this test
		// rather than aging the comment above it.
		expect(
			BaselineStatusSchema.options.filter((s) => /review/i.test(s)),
			'ABSENT: the ratified Baseline status machine offers exactly one review state, and it is the PRE-promotion one — there is no post-promotion review-required state to move to'
		).toEqual(['UNDER_REVIEW']);
		expect(
			Object.keys(BaselineObjectSchema.shape).filter((k) => /review|impact|stale/i.test(k)),
			'ABSENT: BaselineObject carries no NAMED review, impact or staleness field — and this measures FIELD NAMES, which is exactly why the claim is narrowed below rather than stated as an impossibility'
		).toEqual([]);

		// ⚠⚠ AND THE NARROWING, DRIVEN — BECAUSE THE STRONGER CLAIM THAT STOOD HERE WAS FALSE. The message above
		// used to end *"so the flag could not be written even if a command wanted to write it"*. It could.
		// `BaselineObjectSchema` spreads `objectEnvelopeShape` (`rph-contracts/src/envelopes.ts`), which carries
		// `tags: z.array(z.string())` and `extensions: z.array(ExtensionPayloadSchema)` — two untyped carriers on
		// EVERY governed object — and the live baseline has both. A review marker could be parked in either
		// today. Silently upgrading a NAME-absence into a structural impossibility is the "grep the field name,
		// not the concept" trap wearing the opposite hat, so what is asserted instead is the fact that IS true:
		// the carriers exist, and nothing put anything in them. That is a claim about this journey, and it
		// reddens the day something starts tagging a baseline whose premise was falsified.
		//
		// ⚠ THE VERDICT IS UNCHANGED AND ITS OTHER TWO LIMBS ARE UNTOUCHED — the status machine has only the
		// PRE-promotion `UNDER_REVIEW`, and the AUTHORITATIVE -> UNDER_REVIEW arrow is refused above. What is
		// withdrawn is one over-claim, not the clause's NOT_ASSERTED disposition.
		const baselineState = j.state(BASELINE) ?? {};
		expect(
			[baselineState.tags, baselineState.extensions],
			'PRESENT BUT EMPTY: the envelope gives every object two free-form carriers a review marker COULD be written into — so the absence above is about NAMES, not about possibility — and the falsification put nothing in either'
		).toEqual([[], []]);
	});

	// ⚠ THE CLAUSE HOLDS FOR THE WORK AND FAILS FOR THE LINK, AND THE NAME CARRIES THE NARROWING.
	//
	// "successor architecture work is created" is TRUE: a new ARCHITECTURE_DEFINITION PWU is proposed under the
	// REVISED intent and reaches READY — which is not free, because `MarkPwuReady` enforces the shape readiness
	// contract and refuses a root PWU whose intent is still RAW. The revision did not break that.
	//
	// What is NOT true is that the succession is RECORDED. Two routes exist and both are closed, for two
	// DIFFERENT reasons that are asserted separately because a bare non-ACCEPTED would conflate them:
	//   1. `SupersedePwu` does not DECLARE BASELINED among its source states (an undeclared arrow, REG-F-114);
	//   2. the machine has no `BASELINED -> SUPERSEDED` arrow at all.
	//
	// ⚠ AND A RECON CLAIM DIED HERE. "The PWU is BASELINED, so nothing can move" is FALSE: `ChangePwuState` is a
	// multi-axis setter and an axis may HOLD, so a baselined PWU is not frozen. The refusal is specifically about
	// THIS ARROW, which is why both messages are asserted rather than the fact of refusal.
	//
	// The differential at the end is what stops this test being a pair of refusals that prove nothing: the SAME
	// command, against a PWU that is not baselined, is ACCEPTED and writes a real successor id. So the two
	// refusals above discriminate on BASELINED and on nothing else.
	it('O-e(partial) — the successor architecture PWU is created and reaches READY; the successor LINK to the baselined predecessor cannot be recorded at all', () => {
		const j = journey();
		proposeSuccessor(j);
		j.send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', SUCCESSOR, {});
		j.send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', SUCCESSOR, {
			shapeReadinessAssessmentId: 'assess_shape_successor',
			expectedSemanticVersion: 1
		});
		// ⚠ THIS IS THE ONLY ASSERTED HALF OF CLAUSE (e), AND IT SPENT ITS FIRST LIFE AS A CONTROL THAT COULD NOT
		// FAIL. `M6` and `M7` both target the LINK; neither touches READY. And the outcome is WHITELISTED —
		// `INTENT_AT_LEAST_PROVISIONAL` (`rph-domain/src/pwuGuards.ts`) is {PROVISIONAL, FORMALIZED, APPROVED,
		// REVISED} — so "the revision did not break the shape-readiness contract" could not have come out any
		// other way. `E2E-003-M9` now removes REVISED from that set: `checkPwuShapeReadiness` fails its root-intent
		// limb, `MarkPwuReady` refuses the successor, and this limb goes red. The inability is no longer the
		// finding here, but the disclosure stays because M9 reddens `O-f` too — `executeWork` marks the successor
		// READY on that path as well — and a mutant naming two observations is weaker than one naming one.
		expect(
			(j.state(SUCCESSOR) ?? {}).workLifecycleState,
			'successor architecture work must be creatable and shapeable under the revised intent — clause (e), the half that holds'
		).toBe('READY');
		// And UNDER THE REVISED INTENT, measured rather than assumed — otherwise this limb restates the seeding
		// fixture instead of the clause, which is decided by the intent's status at the moment READY was reached.
		expect(
			(j.state(INTENT) ?? {}).intentStatus,
			'and the intent it was shaped under must be the REVISED one — the clause is about work created AFTER the premise fell, not about work the fixture had already seeded'
		).toBe('REVISED');

		// Route 1: the named command.
		const superseded = j.attempt('SupersedePwu', 'PROFESSIONAL_WORK_UNIT', ARCHITECTURE, {
			supersedingWorkUnitId: SUCCESSOR
		});
		expect(superseded.status, 'the baselined predecessor cannot be marked superseded').not.toBe(
			'ACCEPTED'
		);
		expect(
			JSON.stringify(superseded.error ?? {}),
			'SupersedePwu must refuse a BASELINED predecessor as an UNDECLARED ARROW — the command does not claim to be the one that performs it'
		).toContain('does not declare BASELINED as a source state');

		// Route 2: the generic setter, refused for a DIFFERENT reason — the arrow is absent from the machine.
		const forced = j.attempt('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', ARCHITECTURE, {
			previousState: 'BASELINED',
			newState: 'SUPERSEDED',
			executionState: 'SUCCEEDED',
			assuranceState: 'SATISFIED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: []
		});
		expect(
			JSON.stringify(forced.error ?? {}),
			'and the generic setter cannot perform it either, for the separate reason that BASELINED -> SUPERSEDED is not in the machine'
		).toContain('not a legal PWU.workLifecycleState transition: BASELINED -> SUPERSEDED');

		// THE DIFFERENTIAL. The same command against a non-baselined PWU is ACCEPTED, so the refusals above
		// discriminate on BASELINED rather than on the command being broken.
		const control = j.attempt('SupersedePwu', 'PROFESSIONAL_WORK_UNIT', SUCCESSOR, {
			supersedingWorkUnitId: NEVER_CREATED
		});
		expect(
			control.status,
			'CONTROL: SupersedePwu performs the arrow it does declare, so the two refusals above are about BASELINED and not about a command that never works'
		).toBe('ACCEPTED');
		const supersededEvent = j.engine.readAllEvents().find((e) => e.eventType === 'PwuSuperseded');
		expect(
			(supersededEvent?.payload as { supersedingWorkUnitId?: string } | undefined)
				?.supersedingWorkUnitId,
			'where the successor link CAN be written it names the successor, and it is written to the EVENT only — the PWU object has no field to hold it'
		).toBe(NEVER_CREATED);

		// ⚠ TWO DISCLOSURES, BOTH DERIVED, BOTH WRITTEN TO FAIL THE DAY THEY STOP BEING TRUE.
		// (i) The successor relation lives on no PWU field. `supersedePwu` supplies no `mutate`, and
		//     `ProfessionalWorkUnitSchema` — a strictObject — has nowhere to put one. So for a PWU the link is
		//     recoverable only by replaying the event stream, and no read model can show a professional what
		//     superseded what.
		//
		//     ⚠ AND THE CLAIM IS ABOUT THE PWU, NOT ABOUT THE ONTOLOGY. This was written as "the successor
		//     relation has no object home" / "lives on NO object field anywhere", and that is FALSE: a SIBLING
		//     aggregate carries exactly such a field. The search is therefore run the other way immediately
		//     below, so the absence is recorded as SPECIFIC — which is the sharper finding anyway, because it
		//     means the ontology knows how to express succession and the PWU simply was not given it.
		expect(
			Object.keys(ProfessionalWorkUnitSchema.shape).filter((k) =>
				/supersed|success|predecess/i.test(k)
			),
			'PINNED DEFECT: the PWU object carries no successor or predecessor field, so PWU succession exists only in the event log'
		).toEqual([]);
		// `/supersed/i` and not the wider filter above, because on the Intent the wider one also catches
		// `successConditions` — a §6 outcome field that has nothing to do with succession. The narrower probe is
		// the one whose hit means what the sentence says it means.
		expect(
			Object.keys(IntentObjectSchema.shape).filter((k) => /supersed/i.test(k)),
			'THE SEARCH RUN THE OTHER WAY: a sibling aggregate DOES carry a succession field, so the absence above is specific to the PWU rather than a property of the ontology — the general claim was too strong'
		).toEqual(['supersedesIntentId']);
		// (ii) And nothing checks that the successor EXISTS. The accepted supersession above named an id that
		//     resolves to no object, exactly as the falsification did — the same unvalidated-forward-reference
		//     shape, in a second place.
		expect(
			j.engine.loadObject(NEVER_CREATED),
			'PINNED DEFECT: a supersession was accepted naming a superseding work unit that does not exist; nothing validates the reference'
		).toBeUndefined();
	});

	// ⚠ THE ARRANGEMENT IS DELIBERATELY OVER-BUILT SO THAT EXACTLY ONE GUARD CAN SPEAK.
	//
	// `promoteBaseline` evaluates `canPromoteBaseline` — which ACCUMULATES finding codes — before the
	// stale-version arm, so an arrangement that trips two guards reports both and proves neither. The successor
	// here therefore earns everything on its own: its own execution plan, its own step, its own evidence, its own
	// SATISFIED assessment, its own approved baseline. The ONLY thing wrong with the promotion is that the
	// approval it reaches for was granted for a different baseline, before the premise was falsified. Driven and
	// confirmed: the refusal names PROMOTION_DECISION_OUT_OF_SCOPE and nothing else.
	//
	// WHAT IS NOT DUPLICATED: the VERSION arm of "stale approval is not reused" (`RPH-GOV-003` / Property P5, a
	// v1 approval not authorizing v2) is already driven on the live bus by
	// `packages/rph-application/src/handlers/baseline-stale-decision-version.test.ts`, whose refusal marker is
	// STALE_DECISION_VERSION. It is cited, not re-driven — and the two arms are genuinely different rules, so
	// this is a division of labour rather than a gap.
	//
	// ⚠ AND THE TEST IS NAMED FOR SCOPE, NOT FOR TIMING, BECAUSE NO GUARD ON THIS PATH READS TIMING. It used to
	// be called "…on the architecture approval that PREDATES the falsification", and the only differential it
	// carried varied TWO things at once: `DECISION` names [ARCHITECTURE, BASELINE] and was minted BEFORE the
	// clarification; `S_DECISION` names [SUCCESSOR, S_BASELINE] and was minted AFTER it. Scope and timing moved
	// together, so the pair could not discriminate "out of scope" from "predates the falsification" — and the
	// engine is in fact entirely BLIND to the falsification here: `canPromoteBaseline`'s scope arm would refuse
	// an approval minted one millisecond ago that named the wrong baseline. `LATE_DECISION` below is the
	// single-variable control that settles it: minted after the falsification like `S_DECISION`, naming only the
	// OLD baseline like `DECISION`. It is refused with the SAME single code, which is what isolates SCOPE.
	it('O-f — the successor baseline is refused promotion on an approval whose SCOPE does not name it', () => {
		const j = journey();
		proposeSuccessor(j);
		executeWork(j, {
			pwuId: SUCCESSOR,
			planId: S_PLAN,
			stepId: S_STEP,
			attemptId: S_ATTEMPT,
			claimId: S_CLAIM,
			evidenceId: S_EVIDENCE
		});
		assess(j, { assessmentId: S_ASSESSMENT, pwuId: SUCCESSOR, disposition: 'SATISFIED' });
		satisfy(j, SUCCESSOR, S_ASSESSMENT);
		j.send('CreateBaseline', 'BASELINE', S_BASELINE, {
			baselineType: 'ARCHITECTURE',
			itemObjectIds: [SUCCESSOR],
			assuranceAssessmentIds: [S_ASSESSMENT]
		});
		j.send('SubmitBaselineForReview', 'BASELINE', S_BASELINE, {});
		j.send('ApproveBaseline', 'BASELINE', S_BASELINE, {});

		// The reuse: promote the successor's baseline on the decision that blessed the ORIGINAL architecture.
		const reused = j.attempt('PromoteBaseline', 'BASELINE', S_BASELINE, {
			promotionDecisionId: DECISION,
			expectedItemObjectVersions: [{ objectId: SUCCESSOR, semanticVersion: 1 }],
			requiredAssessmentIds: [S_ASSESSMENT]
		});
		expect(reused.status, 'the stale approval must not be reusable — clause (f)').not.toBe(
			'ACCEPTED'
		);
		// ⚠ ANCHORED, NOT `toContain`, AND THAT IS THE WHOLE POINT OF THE OVER-BUILT ARRANGEMENT ABOVE.
		// `canPromoteBaseline` accumulates findings and joins their codes with `', '` into ONE message
		// (`Cannot promote baseline <id>: <CODE, CODE, …>`), so `toContain('PROMOTION_DECISION_OUT_OF_SCOPE')`
		// passes unchanged for a refusal naming two codes — the "exactly one guard can speak" argument would have
		// been prose nothing could falsify. Matching the code followed by the closing quote of the JSON `message`
		// pins it: a second accumulated code would push a `, ` in and redden this.
		expect(
			JSON.stringify(reused.error ?? {}),
			'the successor baseline must be refused because the stale approval does not name it — an authorization does not bleed to another object, and EXACTLY ONE guard may speak or the refusal proves nothing'
		).toMatch(/: PROMOTION_DECISION_OUT_OF_SCOPE"/);
		expect(
			(j.state(S_BASELINE) ?? {}).status,
			'and the refusal must leave the successor baseline where it was: a refused promotion promotes nothing'
		).toBe('APPROVED');

		// ⚠ THE SINGLE-VARIABLE DIFFERENTIAL. A PROMOTE_BASELINE decision minted HERE — after the falsification,
		// after the intent was revised, on the same side of the clarification as the control at the end of this
		// test — that still names only the ORIGINAL baseline. Timing is held constant; SCOPE alone varies. It is
		// refused with the same single code, which is what licenses the test's name: the guard reads the
		// decision's `subjectObjectIds` and nothing about when it was made.
		j.send('ProposeDecision', 'DECISION', LATE_DECISION, {
			decisionType: 'PROMOTE_BASELINE',
			subjectObjectIds: [ARCHITECTURE, BASELINE],
			selectedOption: 'promote',
			rationale: 'a fresh authorization, but still over the original architecture baseline',
			authority: JOURNEY_ACTOR
		});
		j.send('ApproveDecision', 'DECISION', LATE_DECISION, {
			selectedOption: 'promote',
			rationale: 'a fresh authorization, but still over the original architecture baseline',
			consideredEvidenceIds: [EVIDENCE],
			consideredObservationIds: [],
			subjectSemanticVersions: { [ARCHITECTURE]: 1 }
		});
		const lateButOutOfScope = j.attempt('PromoteBaseline', 'BASELINE', S_BASELINE, {
			promotionDecisionId: LATE_DECISION,
			expectedItemObjectVersions: [{ objectId: SUCCESSOR, semanticVersion: 1 }],
			requiredAssessmentIds: [S_ASSESSMENT]
		});
		expect(
			JSON.stringify(lateButOutOfScope.error ?? {}),
			'SINGLE-VARIABLE CONTROL: an approval minted AFTER the falsification is refused by the same one guard when its scope does not name this baseline — so clause (f) here is about SCOPE, and the engine is blind to the falsification on this path'
		).toMatch(/: PROMOTION_DECISION_OUT_OF_SCOPE"/);

		// THE POSITIVE CONTROL. A decision that NAMES this baseline promotes it, so the two refusals above are
		// about scope and not about anything wrong with the successor's own assurance. Read with
		// `lateButOutOfScope`, the three attempts form a proper single-variable design: same timing + wrong
		// scope = refused; same timing + right scope = ACCEPTED.
		//
		// ⚠ THIS HALF CARRIES NO MUTANT, AND THE INABILITY IS ITSELF THE FINDING. Every mutation that could
		// redden it — weakening PROMOTABLE_DISPOSITIONS, breaking the assessment gate, breaking the decision
		// gate — also breaks the FAIL-LOUD promotion inside `journey()`, which would redden every test in this
		// file rather than this one assertion. A mutant that reddens the whole Slice discriminates nothing, so
		// none is declared; what protects this limb instead is that `journey()` throws on any refusal, so an
		// arrangement broken upstream can never present itself here as a quiet green.
		j.send('ProposeDecision', 'DECISION', S_DECISION, {
			decisionType: 'PROMOTE_BASELINE',
			subjectObjectIds: [SUCCESSOR, S_BASELINE],
			selectedOption: 'promote',
			rationale: 'the successor architecture serves the revised intent at national-enterprise scale',
			authority: JOURNEY_ACTOR
		});
		j.send('ApproveDecision', 'DECISION', S_DECISION, {
			selectedOption: 'promote',
			rationale: 'the successor architecture serves the revised intent at national-enterprise scale',
			consideredEvidenceIds: [S_EVIDENCE],
			consideredObservationIds: [],
			subjectSemanticVersions: { [SUCCESSOR]: 1 }
		});
		const fresh = j.attempt('PromoteBaseline', 'BASELINE', S_BASELINE, {
			promotionDecisionId: S_DECISION,
			expectedItemObjectVersions: [{ objectId: SUCCESSOR, semanticVersion: 1 }],
			requiredAssessmentIds: [S_ASSESSMENT]
		});
		expect(
			fresh.status,
			'CONTROL: a decision that NAMES this baseline promotes it, so the refusal above is the stale approval running out of scope and not the successor failing on its own merits'
		).toBe('ACCEPTED');
	});
});
