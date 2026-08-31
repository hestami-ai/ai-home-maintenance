// JAN-SLICE-SWP-03 — RPH-E2E-007, the journey where the ARCHITECTURE MOVED and the authorization did not move
// with it.
//
// The ratified statement (`m12-conformance.json`, `sourceRef: "§24"`), verbatim:
//   "When Architecture changes from approved version 2 to version 3 before baseline promotion, promotion using
//    the version-2 decision is rejected and assurance and approval for version 3 are required (changed artifact
//    after approval)."
//
// The worked scenario it is distilled from (`docs/Recursive Professional Harness/Janumi Professional Workbench
// Recursive Professional Harness - Executable Invariant and Conformance Test Specification.md`, §24), verbatim:
//
//   ## RPH-E2E-007 — Changed artifact after approval
//   ### Given
//   Architecture version 2 is approved.
//   ### When
//   the artifact changes to version 3 before baseline promotion.
//   ### Then
//   * promotion using version-2 decision is rejected;
//   * assurance and approval for version 3 are required.
//
// ── WHICH OBJECT IS "ARCHITECTURE", AND WHY THE CHOICE HAD TO BE MADE DELIBERATELY ───────────────────────────
// The rule's subject is an object that HOLDS semantic version 2 and then holds 3. Only THREE aggregates in this
// engine can ever move a `semanticVersion` at all, and the set was DERIVED rather than recalled — every
// `semanticVersion + 1` in the handler layer:
//
//   INTENT                         — `intent.ts:329` (ReviseIntent, via `bumpSemanticVersion: true`)
//   DECOMPOSITION_CONTRACT         — `decomposition.ts:495` (ReviseDecomposition, the same flag)
//   PROFESSIONAL_WORK_ARCHITECTURE — `pwa-authoring.ts:178` (`bumpPwaSemanticVersion`)
//
// A PROFESSIONAL_WORK_UNIT's version never moves, and neither does an ARTIFACT's: `ARTIFACT` is a real object
// type (`enums.ts:610`, `objects.ts:855`, id prefix `art`) and NOTHING bumps it. So the two readings of
// "Architecture" a reader reaches for first are both unavailable, and the third is the one the engine actually
// names ARCHITECTURE:
//
//   THE SUBJECT HERE IS THE PWA — `PROFESSIONAL_WORK_ARCHITECTURE`. `bumpPwaSemanticVersion` raises it on every
//   material graph edit, and its three call sites (DefinePwuType / EditPwuType / RemovePwuType) are repeatable,
//   so two successive `DefinePwuType` calls take a DRAFT PWA 1 -> 2 -> 3. DRIVEN, not assumed: the versions are
//   asserted below at the hops that matter.
//
// ⚠ AND THE RATIFIED FIXTURE MODELS THE SAME PAIR A WAY THIS ENGINE CANNOT CHECK, WHICH IS ITSELF A FINDING.
// `m13-replay.json`'s last open item says: *"art_fsm_architecture_001 (candidate, §19 subject) vs
// art_fsm_architecture_002 (approved/baselined, §22-23) are two semantic versions of the architecture artifact
// … This version pair is what makes RPH-E2E-007 ('changed artifact after approval') and Test 5 checkable —
// preserve both."* That models "version 2 vs version 3" as TWO SUCCESSIVE OBJECTS WITH DIFFERENT IDS. The
// engine's staleness guard cannot see that at all: `decisionAuthorizesVersions` iterates the decision's OWN
// `subjectSemanticVersions` and compares each subject id against ITS OWN current version, so a decision that
// pinned `art_…_001` says nothing whatever about `art_…_002`, an id it never named. The fixture's
// representation and the engine's mechanism disagree, and a Slice built on the fixture's shape would have
// measured nothing while looking exactly like it had. This Slice therefore drives ONE object whose version
// really moves.
//
// ── SL-S4: WHAT THE REPOSITORY ALREADY HAS, AND WHAT THIS ADDS ───────────────────────────────────────────────
// The stale-decision refusal is already unit-driven twice and is NOT re-derived here:
//   `packages/rph-application/src/handlers/baseline-stale-decision-version.test.ts` — the live-pipeline probe of
//     RPH-GOV-003 at the PromoteBaseline call site. Its moving subject is the INTENT, and its own header
//     explains why: it needed an aggregate whose version can move, and it censused the same three.
//   `packages/rph-application/src/handlers/decision-version-pin.test.ts` — REG-F-017: the version pin is written
//     at PROPOSAL and is immutable at approval.
// What is new here is the JOURNEY: the moving subject is the object the rule NAMES, the version pair is the one
// the rule names (2 -> 3), and the journey does not stop at the refusal — it re-earns the authorization and
// completes, which is what makes clause (b)'s two halves separable at all.
//
// ── WHAT IS ASSERTED, AND WHAT IS DISCLOSED INSTEAD ──────────────────────────────────────────────────────────
// The Then block has two bullets and the second is a CONJUNCTION of two different obligations, which come apart
// under driving:
//
//   (a)           promotion using the version-2 decision is rejected  — ASSERTED AS RATIFIED. RPH-GOV-003 /
//                 Property P5, live at the promotion gate.
//   (b-approval)  approval for version 3 is required                  — ASSERTED AS RATIFIED, in both
//                 directions: a decision PINNED at 3 authorizes the promotion (O-b-approval), a decision pinned
//                 at 2 does not (O-a), and a version-2 approval cannot be laundered onto the version-3 decision.
//                 The exclusive half lives in O-a and is named there, not claimed by O-b-approval's title.
//   (b-assurance) assurance for version 3 is required                 — NOT ENFORCED. Named `(partial)`, with
//                 the narrower true thing asserted and the defect PINNED — in TWO limbs, because the gap has two
//                 halves: the gate has no version to read, AND the assessment set it reads is the promoter's.
//
// ⚠ (b-assurance) WAS INVESTIGATED IN BOTH DIRECTIONS BEFORE BEING RECORDED ABSENT, BECAUSE AN "ABSENT" THAT IS
// REALLY "PRESENT" IS THE WORST OUTCOME AVAILABLE HERE. Two candidate mechanisms were proposed, and BOTH were
// DRIVEN rather than read:
//
//   1. `findVersionMismatches` / `BASELINE_VERSION_MISMATCH` (RPH-BAS-002, *"candidate item versions+hashes must
//      match the reviewed set exactly"*) — the arm that reads exactly like a changed-artifact-after-approval
//      check. IT IS INERT AT THE LIVE CALL SITE: `promoteBaseline` passes ONE array as BOTH `candidateItems` and
//      `reviewedItems`, so every item is compared to itself and no mismatch is expressible. Driven in the
//      control test below: a promotion naming semantic version 999 against a baseline frozen at 3 is ACCEPTED
//      and the baseline goes AUTHORITATIVE.
//   2. A comparison of the required assessment's bound subject version against the current one — THERE IS NO
//      SUCH FIELD TO COMPARE. `RequiredAssessmentView` (`rph-domain/src/governance.ts:195`) is
//      `{ assessmentId, complete, disposition }`. The promotion gate's model of a required assessment carries
//      no version at all.
//   3. ⚠ AND A THIRD FACT, FOUND WHILE CHECKING (2) AND WORSE THAN IT, WHICH THIS SLICE NOW DRIVES: even a
//      repaired (2) would not bind the clause, because the gate does not choose WHICH assessments to consult.
//      `promoteBaseline` maps `p.requiredAssessmentIds` — the promoting command's own array
//      (`rph-application/src/handlers/governance.ts:901`) — while the Baseline's frozen `assuranceAssessmentIds`
//      (`:749`) reaches the gate nowhere and appears only in the emitted event (`:1013`). The payload field is
//      `z.array(z.string())` with no `.min(1)` and `findAssessmentDefects` loops over it, so an EMPTY array is
//      accepted and finds nothing. Driven in `O-b-assurance(control-2)`: the same baseline, the same re-earned
//      version-3 decision, `requiredAssessmentIds: []` — AUTHORITATIVE, citing no assurance at all.
//
// SEARCHED FOR THE CONCEPT, NOT THE FIELD NAME, AND IN BOTH DIRECTIONS. `grep -rniE
// "re-?assess|re-?assur|stale (assessment|assurance|floor)|assessedVersion|assessmentVersion"` over
// `packages/*/src` (excluding tests) returns exactly ONE production site that compares an assessment's bound
// subject version to a current version: `floor-gate.ts`'s `versionOk` (`rec?.version === opts.subjectVersion`),
// reached from `pwaFloorGate` on PublishPwa and from the execution-plane gate.
//
// ⚠⚠ AND THE SENTENCE THAT USED TO FOLLOW WAS FALSE ABOUT THIS SLICE'S OWN SUBJECT, CORRECTED HERE RATHER THAN
// DELETED. It read: *"That is real enforcement — over a DIFFERENT subject and at a DIFFERENT act."* It is real
// enforcement over the SAME subject at a DIFFERENT act. `pwaFloorGate` passes `command.targetAggregateId` on
// PublishPwa — the PWA, which is the object lines 21-38 above establish at length IS "Architecture" — together
// with `subjectVersion: Number(state.semanticVersion)`, and `floor-gate.ts:295` says in terms that *"a floor
// recorded against a DIFFERENT subject semanticVersion does NOT count — a stale floor cannot authorize a
// re-versioned subject"*, which `pwa-authoring.ts:948` repeats as *"version-bound, so a stale floor cannot
// authorize a re-versioned PWA"*. The repository already DRIVES it end to end, over this very object and this
// very drift: `rph-application/src/handlers/pwa-publish-stale-floor.test.ts` records a floor, edits the graph so
// the PWA's `semanticVersion` moves, and asserts PublishPwa refuses. So "a version-2 assessment cannot satisfy
// version 3" has a live, gated, documented implementation over the Architecture. It is not at the promotion gate.
//
// THE SENTENCE WAS INHERITED, AND THE INHERITANCE IS WHAT BROKE IT. It is `RPH-ASR-010`'s `why` verbatim
// (`enforcement-register.ts:1362-1363`), written about the rule quantified over ANY assessment subject — for
// which "a different subject" is true of the general case. Narrowing the subject to the PWA, which this Slice
// does deliberately and argues for, silently falsifies it. A claim that survives only at the generality it was
// written at may not be carried down to a narrower one without being re-driven.
//
// ⚠ THE TRUE, NARROW CLAIM, AND THE ARRANGEMENT DEPENDENCY IT RESTS ON. At the PROMOTION gate there is nothing
// to compare with: `RequiredAssessmentView` (`rph-domain/src/governance.ts:195`) is
// `{ assessmentId, complete, disposition }`, so `canPromoteBaseline` cannot ask what version an assessment
// assessed even in principle. The comparing site is reachable only through PublishPwa, and THIS JOURNEY CANNOT
// REACH IT — twice over, both facts derived from the code and stated so a reader can check them:
//   1. The PWA never leaves DRAFT. `publishPwa` is `fromStates('VALIDATED')`, reached only through
//      SubmitPwaForReview -> ValidatePwa; this journey issues CreatePwa and two DefinePwuType and stops.
//   2. Even from VALIDATED it would be BLOCKED rather than checked. `floorGateBlock` iterates
//      `FLOOR_POLICY_IDS_REQUIRED` — the three `floor.*` policies from `@janumipwb/rph-assurance` — and this
//      journey's only assessment cites `JOURNEY_POLICY`, so `latestFloorDispositions` holds no record under any
//      of the three ids, all three resolve `MISSING`, and `versionOk` has nothing to compare against — the gate
//      refuses on absence, never on currency. (The early return `!aiProduced && latest.size === 0` does not save
//      it either: the map is non-empty, keyed by `JOURNEY_POLICY`.) The shared fixture seeds no floor policy —
//      `seedFloorPolicies` is a different fixture in `rph-application`, used by the floor tests — so the
//      comparing arm is off this journey's path by construction.
// That is a fact about THIS Slice's reach, not a fact about the engine, and it is recorded as such.
//
// ⚠ AND THE INVALIDATION FAMILY WAS CHECKED AND IS NOT APPLICABLE — recorded because the declared regex above
// does not contain `invalidat`, and the concept's nearest neighbour in this repository is spelled that way, so
// leaving it out would make the search narrower than the claim. All three members were followed:
//   * `foldInvalidation` (`rph-projections/src/assurance-view.ts:342-360`) stamps `SUBJECT_INVALIDATED` onto
//     every assessment naming the invalidated subject, and cites *"§39 invariant … 16 (a subject change
//     invalidates/reviews prior assessments)"* — the exact concept. It is fed by exactly two events
//     (`:393-396`), `EvidenceInvalidated` and `PwuInvalidated`; the subject arm is PWU-only, so a PWA can never
//     enter it. It is also a READ MODEL, not a gate: nothing refuses on an `invalidations` entry.
//   * `InvalidateAssuranceAssessment` is not a command at all. `transitions.data.ts:1786,1794` declares two
//     arrows triggered by it, and the register states the reason independently: *"there is no ContestClaim and
//     no InvalidateAssuranceAssessment in the ratified vocabulary"* (`enforcement-register.ts:1011`).
//   * `InvalidatePwu` / `PwuInvalidated` (`pwu.ts:873-932`) is a real command over a real object — and it is an
//     EXPLICIT act someone must issue, not something a version bump causes.
// The common shape is what makes the family inapplicable rather than absent: every member requires an explicit
// invalidation command, and a PWA semantic-version bump issues none. `bumpPwaSemanticVersion`
// (`pwa-authoring.ts:178-192`) emits exactly one event, `PwaEdited`, whose whole payload is `{ pwaId }`.
//
// And the opposite direction, the field: `subjectSemanticVersions` on an ASSURANCE_ASSESSMENT is written at
// request (`assurance.ts:1384`), echoed into the completion events, and checked for COMPLETENESS at
// `parseCompletion` — never for CURRENCY, anywhere.
//
// ⚠ AND THE REPOSITORY'S OWN REGISTER AGREES ON THE OUTCOME AND IS CORRECTED ON ONE LIMB. It is corroboration
// and not the source of the claim — it was found after the drive. `RPH-ASR-010` ("Creating Architecture version
// 3 means a version-2 assessment cannot satisfy version 3 (semantic change invalidates prior assessment)") is
// `UNENFORCED_DISCLOSED` in `rph-domain/src/enforcement-register.ts`, and its `why` reaches the same conclusion
// independently: the only comparing site is the floor gate, adopting it here "would be the layer/subject
// substitution this register exists to prevent", and so the rule's second clause "has no reader at all: nothing
// recomputes, invalidates, or even flags a prior assessment when its subject moves." Both of those survive.
// What does NOT survive, at this Slice's chosen subject, is the clause immediately before them — "real
// enforcement over a different subject" — for the reason set out above: on the PublishPwa path the floor gate's
// subject IS the Architecture. The register row is a claim about the rule at ITS generality and is not amended
// by this file; the correction recorded here is that the sentence may not be carried down to the PWA.
//
// This Slice drives the half that register's own OBSERVED_ADMISSION does not — not a validator MISREPORTING a
// version, but an honest version-2 verdict that the world walked away from, consumed by a PROMOTION.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE — the same prohibition the E2E-001 and E2E-002 Slices record.
// It converts a false clause into a green suite, which is `SL-8`'s "weakened to green" wearing a different hat.
import { describe, expect, it } from 'vitest';

import {
	beginJourney,
	executeWork,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	JOURNEY_ACTOR,
	JOURNEY_POLICY,
	type Journey
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'E2E-007',
	title:
		'The Architecture moves from approved version 2 to version 3, and the version-2 authorization does not move with it',
	plane: 'ENGINE',
	// ⚠ THE ROADMAP'S §9 TABLE PROPOSES `alternate valid path` FOR `RPH-E2E-002/003/004/005/007` AND ITS OWN
	// PREAMBLE FORBIDS INHERITING IT — "the assignments MUST be ratified in `SWP-02` and `SWP-03`, not inherited
	// from this table". So the proposal is evidence of nothing here, and the class is ratified below from the
	// journey. The argument is about WHAT HAPPENS IN THIS JOURNEY, and each rival is refused on a fact of it.
	//
	// THE POSITIVE CASE. The ratified destination of the baseline family is an AUTHORITATIVE baseline, and this
	// journey REACHES IT — by a longer route, and the extra length is the whole content of the rule. The
	// professional earns an approval over Architecture version 2; the work then legitimately changes to version 3
	// (`DefinePwuType`, a normal authoring act, not an error and not a failure); the promotion under the version-2
	// approval is refused; the authorization is RE-EARNED over version 3 and the promotion completes. Every act on
	// that route is one a competent professional performs on purpose. That — same destination, longer legitimate
	// route, taken because the work moved — is what distinguishes an alternate valid path from a normal one.
	//
	// THE SEVEN RIVALS ARE THE RATIFIED EIGHT MINUS THE ONE DECLARED, AND EACH IS REFUSED ON A FACT OF THIS
	// JOURNEY RATHER THAN BY ELIMINATION:
	//   `normal path`                — refused: the journey contains a REFUSAL that a normal path does not, and
	//                                  O-a asserts it. A normal promotion never needs a second approval.
	//   `user-error path`            — refused, and this is the closest rival: nothing about the refused promotion
	//                                  is malformed. Its payload validates (it is the SAME payload shape that is
	//                                  ACCEPTED in O-b-approval, differing only in which decision it names), its
	//                                  authority holds, and its decision is EFFECTIVE, of type PROMOTE_BASELINE,
	//                                  and in scope for this very baseline. It is refused because THE WORLD MOVED
	//                                  after the approval was earned — a professional re-review requirement, not a
	//                                  mistake in the request.
	//   `permission-denied path`     — refused ON A DRIVEN FACT, not on a reading. `STATUS_FOR_CODE`
	//                                  (`rph-application/src/handlers/kit.ts:91-95`) maps ONLY
	//                                  `RPH_AUTHORITY_INSUFFICIENT` to `UNAUTHORIZED`; the staleness refusal is
	//                                  `RPH_INVARIANT_VIOLATION`, which is unlisted and therefore `REJECTED`.
	//                                  O-a asserts that status exactly, so this rival's refusal reddens if the
	//                                  refusal ever becomes an authority one.
	//   `system-failure path`        — refused: nothing fails. No `FailExecutionStep`/`FailExecutionPlan`, no
	//                                  `failureClass`, no adapter error; every command is answered by the engine.
	//   `interrupted or resumed path`— refused: one `beginJourney`, one engine, no restart and no re-open. The
	//                                  journey is continuous; what is discontinuous is the AUTHORIZATION.
	//   `data-unavailable path`      — refused: every object the journey reads is present when it is read. The
	//                                  refusal is about a version being WRONG, never about a fact being missing.
	//   `cancellation path`          — refused: nothing is cancelled or abandoned. The version-2 approval is
	//                                  SUPERSEDED IN EFFECT by the world moving, but it is never withdrawn — it
	//                                  stays EFFECTIVE on the record, which is precisely why the staleness guard
	//                                  has to exist.
	//
	// ⚠ IT IS ALSO THE CLASS `E2E-002` DECLARES, AND THE GATE IS NOT INDIFFERENT TO THAT — the earlier reading of
	// `SL-5`'s gate recorded here was too weak and is corrected. `verif/slice-scenario-coverage.test.ts` builds
	// `covered` from the ledger's rows and asserts `SCENARIO_CLASSES.filter((c) => !covered.has(c) && EXEMPT[c]
	// === undefined)` is EMPTY, with `EXEMPT` declared `{}` and its header arguing at length that the emptiness is
	// a measured finding rather than a default. So the gate demands ALL EIGHT classes covered, and with a finite
	// Slice set every duplicate consumes a slot: it is silent about DISTRIBUTION but not indifferent to it.
	//
	// THAT IS A PROGRAMME OBLIGATION, AND IT IS NOT DISCHARGEABLE BY THIS FILE. The roadmap states the remedy
	// itself — `SWP-03` "MUST therefore either author Slices for [the missing classes] or record explicit,
	// reasoned inapplicability", through `SWP-02a`'s deferral plane, "not as prose in a document". Both remedies
	// live outside this Slice. And the one move that WOULD be available here is the one both the gate's header and
	// `SL-5` name as the defect they exist to catch: entering a class this journey is not, in order to fill a
	// table. The journey is an alternate valid path; it is declared as one; the coverage gap is recorded here as
	// the programme's, not paid for with a false declaration.
	scenarioClass: 'alternate valid path',
	citedRules: ['RPH-E2E-007'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'E2E-007-M1',
			file: 'packages/rph-domain/src/governance.ts',
			find: 'return { ok: staleSubjects.length === 0, staleSubjects };',
			replace: 'return { ok: true, staleSubjects };',
			expectRed: ['O-a'],
			predictedMessage:
				'a promotion carrying the version-2 decision must be REFUSED once the Architecture has moved to version 3 — clause (a) of the ratified Then block',
			why: "Proves clause (a) is asserted on the VERDICT of `decisionAuthorizesVersions`, the kernel predicate the promotion gate consults, and not on the mere fact that some refusal occurred. The verdict is disabled without disturbing the staleness COMPUTATION, so nothing else in the journey moves: the version-3 promotions in the other three tests are ACCEPTED either way, which is what keeps this mutant's victim single (SL-3a). ⚠ THE OBVIOUS MUTANT — INVERTING `currentVersion !== approvedVersion` TO `===` — WAS WORKED THROUGH AND REJECTED: it would redden O-a AND O-b-approval AND the control at once, because approved@3 current@3 would then read as stale, and it would therefore prove none of the three."
		},
		{
			id: 'E2E-007-M2',
			file: 'packages/rph-application/src/handlers/governance.ts',
			find: '.filter(([id, v]) => pinned[id] !== undefined && pinned[id] !== v)',
			replace: '.filter(() => false)',
			expectRed: ['O-b-approval'],
			predictedMessage:
				'the version-3 decision must refuse an approval that states version 2 — a version-2 review cannot be laundered onto the version-3 approval, which is clause (b) approval half',
			why: "Proves the approval half of clause (b) is asserted on the REG-F-017 post-state predicate in `approveDecision` — the guard that refuses an approver who states versions the decision did not pin. Narrow by construction: the OTHER approval in this journey (the version-2 decision, approved stating version 2) agrees with its own pin, so this mutant cannot reach it. It can only admit the laundering attempt that exists to be refused."
		},
		{
			id: 'E2E-007-M3',
			file: 'packages/rph-application/src/handlers/governance.ts',
			find: 'mutate: (base) => ({ ...base, promotionDecisionId: p.promotionDecisionId }),',
			replace: 'mutate: (base) => base,',
			expectRed: ['O-b-approval'],
			predictedMessage:
				'the promoted baseline must record the VERSION-3 approval as the authority that carried it, not the superseded version-2 one',
			why: 'Proves the second limb of the approval half: it is not enough that the promotion succeeds under a fresh approval — the governed record must name WHICH approval authorized it, or the audit trail cannot tell the re-earned authorization from the stale one it replaced. Sited on the only write of `promotionDecisionId`. It cannot reach O-a (that promotion never commits) and it cannot reach either assurance test (neither reads the field).'
		},
		{
			id: 'E2E-007-M4',
			file: 'packages/rph-application/src/handlers/governance.ts',
			find: 'reviewedItems: candidateItems,',
			replace:
				'reviewedItems: (state.itemObjectVersions as { objectId: string; semanticVersion: number }[]) ?? [],',
			expectRed: ['O-b-assurance(control)'],
			predictedMessage:
				'RPH-BAS-002 must not be able to fire here: the promoted item set is compared to ITSELF, so a promotion naming version 999 against a baseline frozen at version 3 is ACCEPTED',
			why: "REPAIR-SHAPED ON PURPOSE, because the assertion it defends is a PINNED DEFECT and the only thing that can redden a pinned defect is its repair. Replacing the self-comparison with the baseline's OWN frozen item set makes `findVersionMismatches` compare what is being PROMOTED against what was REVIEWED, which is what RPH-BAS-002 says, and the control goes red. It is narrow because every other promotion in this Slice names exactly the frozen versions; only the control lies about one. Without this mutant the control could not fail, and a control that cannot fail certifies nothing. ⚠ WHAT THIS MUTANT DOES NOT SHOW, STATED SO THE REPAIR IS NOT OVERSOLD: even under it, RPH-BAS-002 would still not catch THIS journey's changed artifact. `CreateBaseline` runs AFTER the version-3 edit, so the frozen set already names 3 and equals the candidate set. The repair makes a LYING promoter detectable, not a stale approval."
		},
		{
			id: 'E2E-007-M5',
			file: 'packages/rph-application/src/handlers/assurance.ts',
			find: "const unversioned = subjectIds.filter((id) => typeof versions[id] !== 'number');",
			replace: 'const unversioned: string[] = [];',
			expectRed: ['O-b-assurance(partial)'],
			predictedMessage:
				'an assessment that names the Architecture as a subject must state WHICH version of it was assessed — DOC-004 invariant 2, the fact the promotion gate then declines to read',
			why: "Proves the narrower TRUE half of clause (b)'s assurance limb: the assessed version is not merely recorded, it is REQUIRED at completion — so the FACT any re-assurance rule needs is present, and what is missing is downstream of it. ⚠ AND WHAT IS MISSING DOWNSTREAM IS TWO THINGS, NOT ONE, WHICH AN EARLIER DRAFT OF THIS FIELD UNDERSTATED AS \"a READER, not the fact\": there is no reader of the recorded version, AND no binding of WHICH assessments the gate must read — `promoteBaseline` maps `p.requiredAssessmentIds`, the promoter's own array. `O-b-assurance(control-2)` and M6 drive the second half. Without this mutant the recorded-version limb would rest on a `toEqual` that a defaulted empty record could also satisfy."
		},
		{
			id: 'E2E-007-M6',
			file: 'packages/rph-contracts/src/messages.ts',
			find: 'requiredAssessmentIds: z.array(z.string())',
			replace: 'requiredAssessmentIds: z.array(z.string()).min(1)',
			expectRed: ['O-b-assurance(control-2)'],
			predictedMessage:
				'PINNED DEFECT: `requiredAssessmentIds: []` carries the baseline to AUTHORITATIVE citing NO assurance at all — the promotion gate reads the set the PROMOTER hands it and never the `assuranceAssessmentIds` the Baseline itself froze',
			why: "REPAIR-SHAPED, like M4, and for the same reason: the assertion it defends is a PINNED DEFECT, and the only thing that can redden a pinned defect is its repair. `.min(1)` is the WEAKEST repair that closes the empty case — the real one binds the required set to the Baseline's own frozen `assuranceAssessmentIds` — and the weak form is chosen deliberately: a mutant that ALSO fixed the binding would change which assessments every promotion in this file reads and could redden three clauses, proving none (SL-3a). Narrow by construction: every other promotion here passes `requiredAssessmentIds: [ASSESSMENT]`, which `.min(1)` admits unchanged. ⚠ THE REPLACEMENT IS A SUPERSTRING OF THE ANCHOR, WHICH IS SAFE HERE ONLY BECAUSE THE DEFENDED ASSERTIONS ARE `toBe` ON A STATUS AND A STATE FIELD, NEVER A `toContain` ON A MESSAGE — the E2E-002-M1 trap, checked rather than assumed."
		}
	]
};

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5X00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X10';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5X20';
const EVIDENCE = 'evd_01ARZ3NDEKTSV4RRFFQ69G5X30';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5X40';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5X50';
const ATTEMPT = 'att_01ARZ3NDEKTSV4RRFFQ69G5X60';
const ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5X70';
/** THE ARCHITECTURE. The one object in this journey whose semantic version really moves. */
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5X80';
const TYPE_ARCH = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5X90';
const TYPE_BEHAVIOUR = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5XA0';
/** The approval earned over Architecture version 2. */
const DECISION_V2 = 'dec_01ARZ3NDEKTSV4RRFFQ69G5XB0';
/** The approval re-earned over Architecture version 3. */
const DECISION_V3 = 'dec_01ARZ3NDEKTSV4RRFFQ69G5XC0';
const BASELINE = 'base_01ARZ3NDEKTSV4RRFFQ69G5XD0';

/** The semantic version the store holds for `id` — the number every clause of this rule turns on. */
function versionOf(j: Journey, id: string): number | undefined {
	return j.engine.loadObject(id)?.semanticVersion;
}

/**
 * The journey as far as an OPEN assessment over the Architecture at version 2.
 *
 * ⚠ THE ASSESSMENT NAMES TWO SUBJECTS, AND WHICH ONE LEADS IS LOAD-BEARING FOR AN UNRELATED REASON.
 * `requestAssuranceAssessment`'s applicability gate reads `p.subjectObjectIds?.[0]` AND ONLY THAT ONE, then asks
 * `policyApplicability` whether the policy governs it. The Slice journey policy declares
 * `applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT']`, so leading with the PWA would be refused NOT_APPLICABLE.
 * Leading with the PWU is honest — the work unit IS the primary subject of this assessment — but a later reader
 * must not conclude from this green that the engine checks applicability for EVERY subject. It checks the first.
 */
function arrangeToOpenAssessment(j: Journey): void {
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

	// The Architecture is authored: created in DRAFT at version 1, then ONE material graph edit takes it to 2.
	j.send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
		pwaId: PWA,
		name: 'Field Service Architecture',
		description: 'The professional work architecture governing the field service undertaking',
		domain: 'field-service',
		version: '1.0.0'
	});
	j.send('DefinePwuType', 'PWU_TYPE', TYPE_ARCH, {
		pwuTypeId: TYPE_ARCH,
		pwaId: PWA,
		pwuKind: 'ARCHITECTURE_DEFINITION',
		name: 'Architecture Definition',
		purpose: 'Define the architecture that serves the approved intent',
		isRoot: true
	});

	j.send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
		assessmentId: ASSESSMENT,
		assurancePolicyId: JOURNEY_POLICY,
		policyVersion: '1.0.0',
		subjectObjectIds: [PWU, PWA],
		subjectSemanticVersions: { [PWU]: 1, [PWA]: 2 },
		claimIds: [CLAIM]
	});
	j.send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {});
}

/** The verdict, over Architecture VERSION 2. This is the assurance the promotion will later rest on. */
function recordTheVersionTwoVerdict(j: Journey): void {
	j.send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
		validatorResult: {
			validatorId: 'deterministic.slice-journey',
			validatorVersion: '1',
			policyId: JOURNEY_POLICY,
			policyVersion: '1.0.0',
			assessmentId: ASSESSMENT,
			subjectObjectIds: [PWU, PWA],
			// ⚠ THE HONEST NUMBER. The Architecture really IS at 2 when this verdict is given; nothing here
			// misreports a version. That matters, because the register's own OBSERVED_ADMISSION for RPH-ASR-010
			// arranges a validator that MISREPORTS one. This Slice asserts the other half of the same rule — a
			// truthful version-2 verdict that the subject then walks away from.
			subjectSemanticVersions: { [PWU]: 1, [PWA]: 2 },
			claimResults: [],
			evidenceConsideredIds: [EVIDENCE],
			evidenceRejected: [],
			observations: [],
			dispositionRecommendation: 'SATISFIED',
			recommendedControlActions: [],
			residualUncertainty: [],
			limitations: [],
			executionProvenance: {}
		}
	});
}

/**
 * Approve the promotion over Architecture VERSION 2; let the Architecture change to VERSION 3; then build the
 * baseline candidate and carry it to APPROVED. Everything is now in place for the promotion to be decided.
 *
 * ⚠ THE ORDER OF THESE ACTS IS NOT INCIDENTAL, AND THE ALTERNATIVE WAS DRIVEN. `proposeDecision` pins
 * `subjectVersions(ctx, p.subjectObjectIds)`, which SKIPS any subject the store cannot load, and
 * `decisionAuthorizesVersions` then iterates only what was pinned — with `if (currentVersion !== undefined && …)`
 * on the promotion side as a second fail-open. So a decision proposed BEFORE the Architecture exists pins
 * nothing for it and the staleness guard silently passes. MEASURED, not reasoned: with `ProposeDecision` issued
 * first, the pin came back `{pwu_…: 1}`, the PWA then reached version 3, and the promotion under that decision
 * was ACCEPTED with the baseline going AUTHORITATIVE. This arrangement creates the Architecture first because
 * the rule is about an approval that really did bind a version — not because the ordering is cosmetic.
 *
 * ⚠ AND THE BASELINE IS CREATED AFTER THE CHANGE, NOT BEFORE. `createBaseline` FREEZES each item at the version
 * the store holds at that moment, so the baseline candidate honestly names Architecture version 3 while the
 * decision authorizing it names version 2. That is the ratified Given/When exactly: version 2 approved, artifact
 * changed to version 3, promotion not yet performed.
 */
function arrangeToApprovedBaseline(j: Journey): void {
	j.send('ProposeDecision', 'DECISION', DECISION_V2, {
		decisionType: 'PROMOTE_BASELINE',
		// The BASELINE is named because `canPromoteBaseline` requires the decision to name the baseline it
		// authorizes (REG-F-073: without it, any effective promotion decision authorized any promotion). It does
		// not exist yet, so it is not pinned — which is correct: a baseline candidate has no reviewed version.
		subjectObjectIds: [PWU, PWA, BASELINE],
		selectedOption: 'promote',
		rationale: 'the architecture at version 2 was reviewed and assured',
		authority: JOURNEY_ACTOR
	});
	j.send('ApproveDecision', 'DECISION', DECISION_V2, {
		selectedOption: 'promote',
		rationale: 'the architecture at version 2 was reviewed and assured',
		consideredEvidenceIds: [EVIDENCE],
		consideredObservationIds: [],
		subjectSemanticVersions: { [PWU]: 1, [PWA]: 2 }
	});

	// ── THE WHEN: the artifact changes to version 3, before baseline promotion ────────────────────────────────
	j.send('DefinePwuType', 'PWU_TYPE', TYPE_BEHAVIOUR, {
		pwuTypeId: TYPE_BEHAVIOUR,
		pwaId: PWA,
		pwuKind: 'BEHAVIOR_DEFINITION',
		name: 'Product Behavior Definition',
		purpose: 'Define the observable behaviour the architecture must carry',
		isRoot: false,
		permittedParentTypeIds: [TYPE_ARCH]
	});

	j.send('CreateBaseline', 'BASELINE', BASELINE, {
		baselineType: 'ARCHITECTURE',
		itemObjectIds: [PWU, PWA],
		assuranceAssessmentIds: [ASSESSMENT]
	});
	j.send('SubmitBaselineForReview', 'BASELINE', BASELINE, {});
	j.send('ApproveBaseline', 'BASELINE', BASELINE, {});
}

/** The whole arrangement: assured at version 2, changed to version 3, baseline candidate APPROVED. */
function journey(): Journey {
	const j = beginJourney();
	arrangeToOpenAssessment(j);
	recordTheVersionTwoVerdict(j);
	arrangeToApprovedBaseline(j);
	return j;
}

/** Re-earn the authorization over Architecture VERSION 3. The pin is DERIVED from the store, never stated. */
function reApproveAtVersionThree(j: Journey): void {
	j.send('ProposeDecision', 'DECISION', DECISION_V3, {
		decisionType: 'PROMOTE_BASELINE',
		subjectObjectIds: [PWU, PWA, BASELINE],
		selectedOption: 'promote',
		rationale: 'the architecture changed to version 3 and the authorization was re-earned over it',
		authority: JOURNEY_ACTOR
	});
	j.send('ApproveDecision', 'DECISION', DECISION_V3, {
		selectedOption: 'promote',
		rationale: 'the architecture changed to version 3 and the authorization was re-earned over it',
		consideredEvidenceIds: [EVIDENCE],
		consideredObservationIds: [],
		subjectSemanticVersions: { [PWU]: 1, [PWA]: 3 }
	});
}

/** The promotion act, carrying the item versions the promoter CLAIMS to be promoting. */
function promote(
	j: Journey,
	decisionId: string,
	architectureVersion: number
): ReturnType<Journey['attempt']> {
	return j.attempt('PromoteBaseline', 'BASELINE', BASELINE, {
		promotionDecisionId: decisionId,
		expectedItemObjectVersions: [
			{ objectId: PWU, semanticVersion: 1 },
			{ objectId: PWA, semanticVersion: architectureVersion }
		],
		requiredAssessmentIds: [ASSESSMENT]
	});
}

describe('SLICE E2E-007 — the Architecture changes after approval and before baseline promotion', () => {
	it('O-a — the promotion carrying the version-2 decision is refused, and refused FOR the stale version binding', () => {
		const j = journey();

		// The Given and the When, ASSERTED rather than assumed. A Slice whose antecedent is unmeasured can report
		// a refusal that had nothing to do with the rule it cites.
		expect(
			versionOf(j, PWA),
			'the Architecture must really have moved to version 3 — otherwise this test asserts staleness over a world that did not change'
		).toBe(3);
		expect(
			(j.state(DECISION_V2) ?? {}).subjectSemanticVersions,
			'and the decision must really have bound the Architecture at version 2, pinned FROM THE STORE at proposal (REG-F-017) rather than stated by the approver'
		).toEqual({ [PWU]: 1, [PWA]: 2 });

		const refused = promote(j, DECISION_V2, 3);
		// ⚠ `toBe('REJECTED')`, NOT `not.toBe('ACCEPTED')`, AND THE STRENGTHENING IS LOAD-BEARING FOR THE
		// SCENARIO-CLASS RATIFICATION ABOVE. `STATUS_FOR_CODE` (`rph-application/src/handlers/kit.ts:91-95`)
		// reserves `UNAUTHORIZED` for `RPH_AUTHORITY_INSUFFICIENT` alone; this refusal is
		// `RPH_INVARIANT_VIOLATION`, which is unlisted and falls through to `REJECTED`. Pinning the status is what
		// makes "this is not a `permission-denied path`" a driven fact rather than a reading of the code, and it
		// reddens the day the staleness refusal is re-coded as an authority one.
		expect(
			refused.status,
			'a promotion carrying the version-2 decision must be REFUSED once the Architecture has moved to version 3 — clause (a) of the ratified Then block — and REJECTED rather than UNAUTHORIZED, which is what rules out the permission-denied class'
		).toBe('REJECTED');
		// ⚠ THE MESSAGE, NOT MERELY THE REFUSAL, AND NOT MERELY THE CODE. `RPH_INVARIANT_VIOLATION` is emitted by
		// many guards, and this promotion is refusable on several independent grounds at once; a bare
		// `not.toBe('ACCEPTED')` would be an arrangement that trips two guards and proves neither. The message
		// must name the staleness AND the exact version pair, so a refusal for any other reason reddens here.
		const message = JSON.stringify(refused.error ?? {});
		expect(
			message,
			'the refusal must be the STALE_DECISION_VERSION one — RPH-GOV-003 / Property P5, "a decision approving semantic version n never authorizes semantic version n+1"'
		).toContain('STALE_DECISION_VERSION');
		expect(
			message,
			'and it must name the ARCHITECTURE and the exact version pair the rule is about: approved at 2, current at 3'
		).toContain(`${PWA} approved@2 current@3`);
		expect(
			(j.state(BASELINE) ?? {}).status,
			'and the baseline must still be APPROVED — a refused promotion that nonetheless left the baseline AUTHORITATIVE would satisfy every assertion above and defeat the rule'
		).toBe('APPROVED');
	});

	// ⚠ ASSERTED IN BOTH DIRECTIONS ON PURPOSE. "Approval for version 3 is required" is only half a claim if the
	// version-3 approval is never shown to WORK: an engine that refused every promotion would satisfy "the
	// version-2 decision is rejected" and mean nothing. So this test re-earns the authorization and drives the
	// promotion to AUTHORITATIVE — and it does NOT first attempt the version-2 promotion, deliberately, so that
	// M1 (which disables the staleness verdict) cannot reach it by promoting the baseline early.
	//
	// ⚠ AND THE NAME NO LONGER SAYS "ONLY", WHICH IT USED TO AND COULD NOT SUPPORT. The exclusive half — that a
	// decision pinned at 2 does NOT authorize the promotion — is asserted in `O-a` and NOWHERE IN THIS TEST, for
	// the reason in the paragraph above. Under M1 this test stays green while `O-a` reddens, so a name claiming
	// exclusivity here would survive the mutant that falsifies it, which is the shape SL-2 exists to catch. What
	// this test does establish is the POSITIVE half plus the anti-laundering refusal, and it is named for that.
	it('O-b-approval — a decision pinned at version 3 authorizes the promotion, and a version-2 approval cannot be laundered onto it (the exclusive half is O-a)', () => {
		const j = journey();

		j.send('ProposeDecision', 'DECISION', DECISION_V3, {
			decisionType: 'PROMOTE_BASELINE',
			subjectObjectIds: [PWU, PWA, BASELINE],
			selectedOption: 'promote',
			rationale: 'the architecture changed to version 3 and the authorization was re-earned over it',
			authority: JOURNEY_ACTOR
		});
		expect(
			(j.state(DECISION_V3) ?? {}).subjectSemanticVersions,
			'the fresh decision must pin the Architecture at 3 — DERIVED from the store at proposal, which is what makes "approval for version 3" a fact about a moment rather than a number the approver typed'
		).toEqual({ [PWU]: 1, [PWA]: 3, [BASELINE]: 1 });

		// ── THE LAUNDERING ATTEMPT ────────────────────────────────────────────────────────────────────────────
		// The cheapest way to defeat this rule is not to forge a decision — it is to approve the NEW decision
		// while STATING the old version, so the governed record says version 2 was what was reviewed.
		// REG-F-017's post-state predicate refuses exactly that.
		const laundered = j.attempt('ApproveDecision', 'DECISION', DECISION_V3, {
			selectedOption: 'promote',
			rationale: 'reuse the version-2 review',
			consideredEvidenceIds: [EVIDENCE],
			consideredObservationIds: [],
			subjectSemanticVersions: { [PWA]: 2 }
		});
		expect(
			laundered.status,
			'the version-3 decision must refuse an approval that states version 2 — a version-2 review cannot be laundered onto the version-3 approval, which is clause (b) approval half'
		).not.toBe('ACCEPTED');
		expect(
			JSON.stringify(laundered.error ?? {}),
			'and the refusal must name the disagreement between what was STATED and what was PINNED, not merely fail'
		).toContain(`${PWA} stated@2 pinned@3`);

		// ── AND THE HONEST APPROVAL CARRIES THE PROMOTION ─────────────────────────────────────────────────────
		j.send('ApproveDecision', 'DECISION', DECISION_V3, {
			selectedOption: 'promote',
			rationale: 'the architecture changed to version 3 and the authorization was re-earned over it',
			consideredEvidenceIds: [EVIDENCE],
			consideredObservationIds: [],
			subjectSemanticVersions: { [PWU]: 1, [PWA]: 3 }
		});
		const promoted = promote(j, DECISION_V3, 3);
		expect(
			promoted.status,
			'and the promotion under the version-3 approval must be ACCEPTED — the authorization is re-earned, not permanently forfeited'
		).toBe('ACCEPTED');
		expect(
			(j.state(BASELINE) ?? {}).status,
			'the baseline must reach AUTHORITATIVE under the re-earned approval'
		).toBe('AUTHORITATIVE');
		expect(
			(j.state(BASELINE) ?? {}).promotionDecisionId,
			'the promoted baseline must record the VERSION-3 approval as the authority that carried it, not the superseded version-2 one'
		).toBe(DECISION_V3);
	});

	// ⚠⚠ NAMED FOR WHAT IT PROVES, NOT FOR THE CLAUSE IT WOULD LIKE TO CLAIM. The ratified clause is "assurance
	// … for version 3 [is] required", whose ratified ground is `RPH-ASR-010`: "Creating Architecture version 3
	// means a version-2 assessment cannot satisfy version 3 (semantic change invalidates prior assessment)."
	// That rule is `UNENFORCED_DISCLOSED` in the enforcement register, and this test drives the admission AT THE
	// PROMOTION GATE rather than restating the register's own.
	//
	// What IS true, and what this asserts: the engine RECORDS the assessed version and REQUIRES it to be stated,
	// so the fact any re-assurance rule would need is present and available. What is absent is any READER of it
	// at the promotion gate — `RequiredAssessmentView` (`rph-domain/src/governance.ts:195`) is
	// `{ assessmentId, complete, disposition }`, with no version field to read.
	//
	// ⚠ AND THE HOLE IS WIDER THAN "NO READER", WHICH AN EARLIER DRAFT OF THIS BLOCK UNDERSTATED. The required
	// assessment set the gate reads is CALLER-SUPPLIED, and the Baseline's own is never consulted:
	//   * `promoteBaseline` builds `requiredAssessments` by mapping `p.requiredAssessmentIds` — the promoting
	//     command's array (`rph-application/src/handlers/governance.ts:901`).
	//   * The Baseline froze its OWN `assuranceAssessmentIds` at `createBaseline` (`:749`) and that field reaches
	//     the gate NOWHERE. Its only other appearance is the `BaselinePromoted` payload (`:1013`) — recorded, and
	//     never read.
	//   * `PromoteBaselinePayloadSchema.requiredAssessmentIds` is `z.array(z.string())` with no `.min(1)`, and
	//     `findAssessmentDefects` is a `for` loop over that array, so an EMPTY array yields no findings at all.
	// `O-b-assurance(control-2)` drives that last step rather than reasoning it, and M6 makes it falsifiable.
	//
	// ⚠ WHAT A LATER READER MUST NOT CONCLUDE FROM THIS GREEN: that the promotion was checked against the
	// assurance it cites. It was not. The final assertions are a PINNED DEFECT — written to FAIL the day the
	// promotion gate starts comparing an assessment's bound version against the promoted one, so the repair
	// cannot land silently and this disclosure cannot outlive the thing it discloses.
	//
	// ⚠ AND THE REPAIR THIS DISCLOSURE POINTS AT IS TWO CHANGES, NOT ONE — the earlier single-change wording is
	// corrected here, because a recorded remedy is a hypothesis and this one would have sent its repairer to a
	// place where the repair does not hold. A version-currency check inserted into `promoteBaseline`'s
	// required-assessment mapping is NECESSARY AND NOT SUFFICIENT: it runs over `p.requiredAssessmentIds`, so the
	// party being gated still chooses the set, and `requiredAssessmentIds: []` defeats it silently. The other half
	// is to BIND that set — the Baseline's frozen `assuranceAssessmentIds`, or a `.min(1)` floor under it.
	//
	// ⚠ AND THIS PINNED LIMB HAS NO NARROW MUTANT, WHICH IS ITSELF A FINDING (SL-3). The only change that reddens
	// it is the version-currency half of that repair, which is new code, not a find/replace anchor. Every
	// find/replace that COULD break the version-3 promotion also breaks it in `O-b-approval` and in the control,
	// so it would redden three clauses and prove none of them (SL-3a). The recorded-version limb carries M5 and
	// the caller-supplied-set limb carries M6; THIS limb — the version-currency comparison the gate never makes —
	// is declared unmutatable rather than left to look covered.
	it('O-b-assurance(partial) — the engine RECORDS and REQUIRES the assessed version, and then promotes version 3 on the version-2 assessment: nothing at the promotion gate requires re-assurance', () => {
		const j = beginJourney();
		arrangeToOpenAssessment(j);

		// (1) THE VERSION FACT IS NOT OPTIONAL. A verdict that names the Architecture as a subject and no version
		// for it is schema-valid and meaningless; DOC-004 invariant 2 refuses it.
		const unversioned = j.attempt('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
			validatorResult: {
				validatorId: 'deterministic.slice-journey',
				validatorVersion: '1',
				policyId: JOURNEY_POLICY,
				policyVersion: '1.0.0',
				assessmentId: ASSESSMENT,
				subjectObjectIds: [PWU, PWA],
				subjectSemanticVersions: { [PWU]: 1 },
				claimResults: [],
				evidenceConsideredIds: [EVIDENCE],
				evidenceRejected: [],
				observations: [],
				dispositionRecommendation: 'SATISFIED',
				recommendedControlActions: [],
				residualUncertainty: [],
				limitations: [],
				executionProvenance: {}
			}
		});
		expect(
			unversioned.status,
			'an assessment that names the Architecture as a subject must state WHICH version of it was assessed — DOC-004 invariant 2, the fact the promotion gate then declines to read'
		).not.toBe('ACCEPTED');
		expect(
			JSON.stringify(unversioned.error ?? {}),
			'and the refusal must be about the MISSING VERSION specifically, naming the subject it is missing for'
		).toContain('must name a version for every subject');

		// (2) THE HONEST VERDICT, AND THE VERSION IT BINDS, RECORDED ON THE OBJECT.
		recordTheVersionTwoVerdict(j);
		expect(
			(j.state(ASSESSMENT) ?? {}).assessmentState,
			'the verdict over Architecture version 2 must be SATISFIED — this is real assurance, not a placeholder'
		).toBe('SATISFIED');
		expect(
			(j.state(ASSESSMENT) ?? {}).subjectSemanticVersions,
			'and the assessment must record that it assessed the Architecture at VERSION 2 — the fact any re-assurance rule would need is PRESENT'
		).toEqual({ [PWU]: 1, [PWA]: 2 });

		// (3) THE ARCHITECTURE MOVES, AND THE BASELINE HONESTLY FREEZES THE NEW VERSION.
		arrangeToApprovedBaseline(j);
		expect(versionOf(j, PWA), 'the Architecture is now at version 3').toBe(3);
		expect(
			(j.state(BASELINE) ?? {}).itemObjectVersions,
			'and the baseline candidate names version 3 — so the promoted version and the ASSESSED version disagree, on the record, before the promotion is even attempted'
		).toEqual([
			{ objectId: PWU, semanticVersion: 1 },
			{ objectId: PWA, semanticVersion: 3 }
		]);

		// (4) PINNED DEFECT. The APPROVAL is re-earned at version 3 — and the ASSURANCE is not, and nothing asks.
		reApproveAtVersionThree(j);
		const promoted = promote(j, DECISION_V3, 3);
		expect(
			promoted.status,
			'PINNED DEFECT (RPH-ASR-010, UNENFORCED_DISCLOSED): the baseline is promoted at Architecture version 3 while its only required assessment assessed version 2, and no gate objects. Repair this and this assertion is what tells you the disclosure above has gone stale.'
		).toBe('ACCEPTED');
		expect(
			(j.state(BASELINE) ?? {}).status,
			'the baseline reaches AUTHORITATIVE on version-2 assurance — the no-green-without-assurance gate read the assessment far enough to see SATISFIED and no further; it never asks WHICH subject, at WHICH version, that verdict was about'
		).toBe('AUTHORITATIVE');
	});

	// ⚠ THE SECOND CONTROL, AND IT IS STRICTLY STRONGER THAN THE VERSION-999 ONE BELOW. That control shows the
	// gate cannot catch a promotion that LIES about an item version. This one shows it does not require the
	// promotion to cite the Baseline's assurance AT ALL: the same journey, the same APPROVED baseline, the same
	// re-earned version-3 decision — and `requiredAssessmentIds: []` reaches AUTHORITATIVE citing nothing.
	//
	// THE MECHANISM, READ FROM THE CALL SITE AND THEN DRIVEN. `promoteBaseline` maps `p.requiredAssessmentIds`
	// into `requiredAssessments` (`rph-application/src/handlers/governance.ts:901`); `findAssessmentDefects`
	// (`rph-domain/src/governance.ts:324-341`) is a `for` loop over that array, so an empty one contributes no
	// finding; and `PromoteBaselinePayloadSchema.requiredAssessmentIds` is `z.array(z.string())` with no
	// `.min(1)`, so the empty array is not refused at the door either. The Baseline's own frozen
	// `assuranceAssessmentIds` — which THIS journey really did write, and which is asserted below so the
	// arrangement cannot be mistaken for one that never cited assurance — is read by no arm of the gate.
	//
	// ⚠ WHY THIS IS A CONTROL AND NOT A SEPARATE FINDING ABOUT SCOPE. It is here because it BOUNDS the disclosure
	// above: a reader who takes "the promotion gate has no version reader" as the whole gap would conclude that
	// binding a version to `RequiredAssessmentView` closes clause (b). It would not, while the promoter still
	// chooses which assessments are required. The two facts compose, and only the second is drivable today.
	it('O-b-assurance(control-2) — the required-assessment set belongs to the PROMOTER, not to the Baseline: an empty one promotes to AUTHORITATIVE citing no assurance at all', () => {
		const j = journey();
		reApproveAtVersionThree(j);
		expect(
			(j.state(BASELINE) ?? {}).assuranceAssessmentIds,
			'the Baseline really did freeze its own assurance at creation — so what follows is a gate declining to read a fact that is present, not a journey that never recorded one'
		).toEqual([ASSESSMENT]);

		const uncited = j.attempt('PromoteBaseline', 'BASELINE', BASELINE, {
			promotionDecisionId: DECISION_V3,
			expectedItemObjectVersions: [
				{ objectId: PWU, semanticVersion: 1 },
				{ objectId: PWA, semanticVersion: 3 }
			],
			requiredAssessmentIds: []
		});
		expect(
			uncited.status,
			'PINNED DEFECT: `requiredAssessmentIds: []` carries the baseline to AUTHORITATIVE citing NO assurance at all — the promotion gate reads the set the PROMOTER hands it and never the `assuranceAssessmentIds` the Baseline itself froze. Repair this and this assertion is what tells you the disclosure above has gone stale.'
		).toBe('ACCEPTED');
		expect(
			(j.state(BASELINE) ?? {}).status,
			'and the baseline is AUTHORITATIVE with no assessment named on the promoting act — "no green without assurance" is satisfiable by a promoter who simply declines to name any'
		).toBe('AUTHORITATIVE');
		// ⚠ AND THE FROZEN SET IS STILL THERE AFTERWARDS, WHICH IS WHAT MAKES THIS INVISIBLE. The Baseline still
		// says it rests on ASSESSMENT, and the promoted event echoes that field from the object rather than from
		// the payload — so the audit record shows a baseline WITH assurance, and nothing anywhere records that
		// the act which promoted it cited none.
		expect(
			(j.state(BASELINE) ?? {}).assuranceAssessmentIds,
			'the governed record still names the assessment, so the promotion that ignored it leaves no trace'
		).toEqual([ASSESSMENT]);
	});

	// ⚠ A CONTROL, AND IT HAS ITS OWN MUTANT (E2E-007-M4), BECAUSE A CONTROL THAT CANNOT FAIL CERTIFIES NOTHING.
	//
	// It exists because `findVersionMismatches` / `BASELINE_VERSION_MISMATCH` was proposed as the mechanism that
	// DOES enforce clause (b)'s assurance limb — RPH-BAS-002, "candidate item versions+hashes must match the
	// reviewed set exactly", which reads exactly like a changed-artifact-after-approval check. Reading the kernel
	// alone would have accepted that: the predicate is correct, it is called on every promotion, and it is not
	// dead. The defect is at the CALL SITE, where `promoteBaseline` passes one array as BOTH `candidateItems`
	// and `reviewedItems` — so every item is compared to itself and the arm cannot fire.
	//
	// Driving it is the only way to tell those two apart, and the number below is what a green here means: a
	// promotion may claim to be promoting semantic version 999 of an Architecture the baseline froze at 3, and
	// the baseline still goes AUTHORITATIVE.
	//
	// ⚠ AND THE NAME NO LONGER CALLS THIS "the arm that would have caught the changed artifact", BECAUSE IT
	// WOULD NOT — not even repaired. Under M4 (`reviewedItems` <- the Baseline's frozen `itemObjectVersions`)
	// RPH-BAS-002 still says nothing about THIS journey's changed artifact: `arrangeToApprovedBaseline` issues
	// the version-3-producing `DefinePwuType` BEFORE `CreateBaseline`, so `createBaseline` freezes the PWA at 3
	// and the candidate set EQUALS the reviewed set. What the repair makes detectable is a promoter LYING in
	// `expectedItemObjectVersions` — a different defect from the one the ratified clause names, and the one this
	// control actually drives. The clause's own gap stays where the disclosure above puts it: no version reader
	// on `RequiredAssessmentView`, and no binding of which assessments must be read.
	it('O-b-assurance(control) — RPH-BAS-002 compares the promoted item set to ITSELF at this call site: a promotion naming version 999 against a baseline frozen at 3 is ACCEPTED', () => {
		const j = journey();
		reApproveAtVersionThree(j);
		expect(
			(j.state(BASELINE) ?? {}).itemObjectVersions,
			'the baseline froze the Architecture at version 3 — the reviewed set this promotion is about to contradict'
		).toEqual([
			{ objectId: PWU, semanticVersion: 1 },
			{ objectId: PWA, semanticVersion: 3 }
		]);

		const lying = promote(j, DECISION_V3, 999);
		expect(
			lying.status,
			'RPH-BAS-002 must not be able to fire here: the promoted item set is compared to ITSELF, so a promotion naming version 999 against a baseline frozen at version 3 is ACCEPTED'
		).toBe('ACCEPTED');
		expect(
			(j.state(BASELINE) ?? {}).status,
			'and the baseline goes AUTHORITATIVE on a promotion whose claimed item versions match nothing that was ever reviewed'
		).toBe('AUTHORITATIVE');
		// ⚠ AND THE FROZEN SET STILL READS 3, WHICH IS WHY THIS IS INVISIBLE AFTERWARDS. The promoting payload
		// writes nothing onto the Baseline, so nothing downstream can see that the promotion claimed something
		// else. The contradiction leaves no residue; only the refusal that never happened would have recorded it.
		expect(
			(j.state(BASELINE) ?? {}).itemObjectVersions,
			'the frozen item set is unchanged by the promoting payload, so the contradiction leaves no trace in the governed record'
		).toEqual([
			{ objectId: PWU, semanticVersion: 1 },
			{ objectId: PWA, semanticVersion: 3 }
		]);
	});
});
