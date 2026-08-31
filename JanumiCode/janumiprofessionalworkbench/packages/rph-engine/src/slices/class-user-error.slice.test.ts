// JAN-SLICE-SWP-03 — the USER-ERROR class: a well-meaning professional gets four things wrong in a row, and the
// engine refuses each one with a message that says what to do instead.
//
// ── THE JOURNEY, AS ONE STORY ────────────────────────────────────────────────────────────────────────────────
// One professional, one undertaking (the multi-tenant field service platform the other Slices carry), one work
// item. They are competent and in a hurry, and they make the four mistakes a competent person in a hurry makes:
//
//   1. They propose the Architecture work BEFORE capturing the intent it is meant to serve.       (U-1)
//   2. Told the intent must exist, they capture it — and immediately approve it, skipping the
//      discovery and formalization that give an approval anything to approve.                     (U-2)
//   3. Told the intent must be FORMALIZED first, they do that and re-propose the work — with one
//      property on the payload that this engine has never had.                                    (U-3)
//   4. Told which property is not theirs to send, they drop it and propose successfully, then try
//      to mark the work READY while its deliverable is still "to be decided".                     (U-4)
//
// ⚠ THAT IS THE STORY. THE ARRANGEMENT IS NARROWER THAN THE STORY, AND A READER MUST NOT INFER CONTINUITY FROM
// IT. Every test calls `atTheStart()`, which builds its own `SqliteStorageAdapter`, so no object survives from
// one test to the next: "the same work item" is id-equality across independent engines, not one aggregate being
// carried forward. And `U-2`'s refusal is about an INTENT, not a work item. What the four share is one
// professional's SEQUENCE of mistakes, not one object's history.
//
// The fifth test (`U-5`) applies the four corrections the four messages named — and nothing else — to a fresh
// journey, each at the act where that correction is PERFORMABLE, and that journey reaches READY. That is what
// makes this a Slice rather than four unit refusals: the corrections the messages name are SUFFICIENT, and they
// were driven rather than argued.
//
// ── THE FOURTH CORRECTION IS NOT PERFORMABLE WHERE ITS REFUSAL HAPPENS (`U-7`) ────────────────────────────────
// ⚠⚠ AND THAT IS THIS CLASS'S SHARPEST FINDING RATHER THAN A HOLE IN THE STORY, SO IT IS DRIVEN AND NOT PROSE.
// `U-4` refuses a SHAPING PWU whose `expectedOutputs` is empty, and names that limb. The professional holding
// that message has no act that supplies it to THAT PWU: `expectedOutputs` is carried by exactly ONE command in
// the whole surface (derived in `U-7` by sweeping every entry of `COMMANDS`, which IS the surface — the bus
// refuses anything absent from it with "Unknown command type"), and re-issuing that one command against a PWU
// that already exists is a revision CONFLICT, not a re-shaping. `pwu.ts` says the same thing in its own words at
// `markPwuReady` — *"No command writes a PWU's shape after `ProposePwu` — every later PWU command is a lifecycle
// move, `ReshapePwu` included"* — and `ReshapePwu` is not even reachable from SHAPING (`sourceStates:
// ['EXECUTING', 'UNDER_ASSURANCE']`).
//
// So `U-5` does NOT rescue `U-4`'s PWU and does not claim to. It supplies the expected output at PROPOSAL time,
// one act EARLIER than where the refusal occurred, in its own store. The refusal is still INTELLIGIBLE — it says
// exactly what was missing, which is the whole content of this scenario class — but what it asks for is a thing
// to HAVE DONE, not a thing to do. A test name claiming the four corrections carry "the same journey" past the
// refusal would be asserting a walk this engine cannot take, so no name here claims it.
//
// ── RATIFYING THE SCENARIO CLASS (SL-5) ──────────────────────────────────────────────────────────────────────
// `SL-5`'s own preamble forbids inheriting an assignment; this one is argued, and argued against its neighbours.
//
//   NOT `normal path`. Six of the seven tests read a REFUSAL back, and the refusal IS the assertion. Only `U-5`
//   asserts nothing but acceptance, and it exists to keep the other six honest.
//
//   NOT `alternate valid path` — the neighbour that has to be excluded first, because it is where the E2E-002
//   Slice sits and it also ends in a professional not getting what they wanted. That Slice ratifies its own
//   class in terms this one fails on every limb: *"every command in this journey is ACCEPTED and the work
//   genuinely succeeds. What differs from the normal path is the professional VERDICT, not an error"*. Here NO
//   verdict is reached about anything — the engine never gets far enough to have an opinion on the work, because
//   it declines to RECORD the act. An alternate valid path is the profession saying no to the work; this is the
//   engine saying no to the command.
//
//   NOT `permission-denied path`, though a refusal is a refusal and the two look alike from outside. DRIVEN, not
//   reasoned: the refusal codes observed below are RPH_VALIDATION_SEMANTIC_FAILED (`U-1`, `U-4`),
//   RPH_ILLEGAL_STATE_TRANSITION (`U-2`), RPH_INVARIANT_VIOLATION (`U-2`'s neighbouring site) and
//   RPH_VALIDATION_SCHEMA_FAILED (`U-3`), each asserted by name; the two revision conflicts (`U-6`'s control and
//   `U-7`) are pinned by STATUS and whole MESSAGE instead. NEITHER permission-denied mechanism appears: not
//   `RPH_AUTHENTICATION_REQUIRED` (the bus, where the principal could not be established) and not
//   `RPH_AUTHORITY_INSUFFICIENT` (the handlers) — and because EVERY refusal here is pinned with `toBe`, on its
//   code or on a status of REJECTED / VALIDATION_FAILED / CONFLICT, no test can pass while carrying an
//   UNAUTHORIZED refusal. The actor is the fully-authorized `JOURNEY_ACTOR` throughout.
//   ⚠ AND THE STATUS ALONE WOULD NOT HAVE BEEN ENOUGH TO SAY SO, which is why the codes are named: this
//   repository records that TWO permission-denied mechanisms share `status: 'UNAUTHORIZED'`, so a status probe
//   cannot tell them apart — it is their ABSENCE that is established here, and absence is what a pinned `toBe`
//   on some other value gives you.
//   ⚠ ONE LIMB OF THIS ARGUMENT IS A READING AND IS LABELLED AS ONE. That the same four commands from ANY other
//   principal would be refused for the same four reasons is NOT driven here: it would take a second actor with
//   different authority, and this Slice has one. What was read is that none of the four deciding sites takes the
//   principal as an input at all — `proposePwu`'s store lookup, `evaluatePrecondition`'s FROM_STATES arm, the
//   payload schema, and `checkPwuShapeReadiness` over `readinessFactsOf`. A reading, offered as a reading.
//
//   NOT `system-failure path`. Nothing failed. Every refusal here is the engine working exactly as built; a
//   system-failure path is one where an act that SHOULD have been recorded was not.
//
//   NOT `data-unavailable path`, which is the closest call in the file and belongs to `U-1` specifically. The
//   intent `U-1` cites is missing — but it is not unavailable, it is UNCREATED. Nothing is degraded, retryable
//   or elsewhere; the professional has simply done their own acts in the wrong order, and the remedy is theirs
//   to perform rather than the system's to recover from. The engine says so in the message, naming the id it
//   could not find, and `U-5` drives that remedy to completion. That asymmetry — the fix belongs to the CALLER —
//   is what separates this class from unavailability, and it is why `U-1` is a user error and not a data outage.
//
// ── WHAT IS ASSERTED, WHAT IS NARROWED, AND WHAT IS DISCLOSED (SL-2) ─────────────────────────────────────────
//   RPH-PWU-002  ASSERTED in full  (U-1) — the ratified statement reads *"a proposed PWU WITHOUT AN INTENT
//                REFERENCE is rejected"* and what `U-1` drives is a reference that RESOLVES TO NOTHING, which is
//                the register's own reading of the rule (it files PWU-002 at `proposePwu`'s store lookup). The
//                two are the same clause here, and that was DRIVEN rather than assumed: `intentId` is a required
//                field of `ProposePwuPayloadSchema`, so a proposal with no reference at all never reaches the
//                handler — it is refused at the boundary with `invalid_type@intentId`, which is RPH-CON-002's
//                site and not this one. The handler arm IS the only place this rule's antecedent can arrive.
//   RPH-INT-003  ASSERTED in full  (U-2)
//   RPH-CON-002  ASSERTED in full  (U-3)
//   RPH-PWU-004  ASSERTED NARROW   (U-4) — the ratified statement names TWO deficiencies: *"missing expected
//                outputs AND verification criteria"*. Only the expected-outputs limb is enforced. The other is
//                not merely unchecked: `readinessFactsOf` (pwu.ts) never builds a verification criterion into
//                the facts the contract sees, `proposePwu` hard-codes `verificationCriterionIds: []`, and `U-5`
//                OBSERVES a PWU reaching READY with that field empty. The test name carries the narrowing so
//                this green is never read as the whole rule. ⚠ AND A SECOND THING IS DISCLOSED ABOUT THE LIMB
//                THAT *IS* ENFORCED: `U-7` drives that the refused PWU can never satisfy it, because no command
//                writes a PWU's shape after `ProposePwu`. The rule refuses at a point where its own remedy is
//                out of reach, and that is recorded here rather than left for a reader to discover.
//   RPH-CON-003  NOT ASSERTED      (U-6) — and deliberately NOT cited, because this Slice asserts its NEGATION.
//                The enforcement register records it UNENFORCED_DISCLOSED, and `U-6` DRIVES that admission
//                rather than repeating the claim: the fifth mistake in this story is issuing an update without
//                declaring the revision the caller believes current, and the engine takes it. Citing a rule
//                whose refusal does not exist is exactly what `SL-1` is aimed at.
//
// ⚠ `it.fails` IS NOT USED, and no assertion here was weakened to reach green. Where a claim would not hold at
// full strength it was NARROWED and the NAME says so — the precedent E2E-002 sets for `O-c(partial)`.
import { COMMANDS } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';

import { beginJourney, JOURNEY_TS, type Journey } from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'CLS-USER-ERROR',
	title: 'A professional makes four mistakes in sequence and the engine refuses each one intelligibly',
	plane: 'ENGINE',
	scenarioClass: 'user-error path',
	// ⚠ RPH-CON-003 IS DELIBERATELY ABSENT. It is the fifth rule this Slice touches and the only one it does not
	// assert; `U-6` observes the engine ADMITTING the arrangement that rule would refuse. See the header.
	citedRules: ['RPH-CON-002', 'RPH-INT-003', 'RPH-PWU-002', 'RPH-PWU-004'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'CLS-USER-ERROR-M1',
			file: 'packages/rph-application/src/handlers/pwu.ts',
			find: 'const intentObj = ctx.store.loadObject(p.intentId);',
			replace: 'const intentObj = ctx.store.loadObject(p.intentId) ?? ({ state: {} } as never);',
			expectRed: ['U-1'],
			predictedMessage:
				'the proposal must be refused because the intent does not exist, and the refusal must name the intent id the professional cited — "ProposePwu requires an existing intent … (PWU-002)"',
			why: "Proves U-1 depends on proposePwu's existence check and not on some later guard tripping over an empty intent. ⚠ THE SHAPE OF THE MUTATION IS THE REGISTER'S OWN AND NOT A FREE CHOICE: RPH-PWU-002 records that a BARE deletion of the `if (!intentObj)` arm throws on the next line, which would redden the clause by CRASHING rather than by ADMITTING — a different result wearing the same colour. Substituting a truthy empty envelope is the F-30 shape: the guard still runs and can no longer fail."
		},
		{
			id: 'CLS-USER-ERROR-M2',
			file: 'packages/rph-application/src/handlers/intent.ts',
			find: "precondition: fromStates('FORMALIZED', 'REVISED'),",
			replace: "precondition: fromStates('RAW', 'FORMALIZED', 'REVISED'),",
			expectRed: ['U-2'],
			predictedMessage:
				'approving a RAW intent must be refused by the declared source-state precondition and say so — "ApproveIntent requires intent … to be FORMALIZED or REVISED, but it is RAW"',
			why: "Proves U-2 is asserted on the DECLARED PRECONDITION in intent.ts — the site the enforcement register names for RPH-INT-003 — and not on the mere fact of a refusal. ⚠ THE WARRANT THIS ENTRY ORIGINALLY CARRIED WAS FALSE AND IS CORRECTED HERE, because a wrong reason for a sound mutant is still a recorded claim. It said the widened precondition lets a DIFFERENT site refuse with the SAME code, so that a code-only test would stay GREEN and only the whole message could tell the two sites apart. It does not. advanceIntent's order is loadOrReject -> precondition -> precheck -> checkTransition, and the widened precondition falls straight into the INT-004 precheck, which refuses with RPH_INVARIANT_VIOLATION — a DIFFERENT code — because captureIntent hard-codes desiredOutcomes: [] and only FormalizeIntent writes them. checkTransition is never reached. The register states this verbatim as its FIRST declared mutation for RPH-INT-003 ('reports WRONG_CODE'); the SAME-code behaviour belongs to its SECOND ('widen the precondition AND delete the INT-004 precheck limb'), which is two edits and not expressible as one anchored replacement. The false warrant was inherited from the register's imprecise PROSE comment two lines above its own declaredMutations. CONSEQUENCE FOR THE SET: this mutant reddens U-2 through its CODE assertion, so M7 — not this one — is what proves U-2's whole-message assertion is load-bearing, and U-2 now DRIVES the INT-004 neighbour instead of inferring it."
		},
		{
			id: 'CLS-USER-ERROR-M3',
			file: 'packages/rph-contracts/src/messages.ts',
			find: 'export const ProposePwuPayloadSchema = z.strictObject({',
			replace: 'export const ProposePwuPayloadSchema = z.object({',
			expectRed: ['U-3'],
			predictedMessage:
				'a payload carrying a property the engine never declared must be refused at the boundary before any handler runs, and the refusal must name the property — issue \'Unrecognized key: "priority"\'',
			why: 'Proves U-3 depends on the STRICTNESS of the generated payload schema, which the enforcement register names as this rule\'s authority ("the ratified vocabulary generates a z.strictObject, and that schema IS the authority"). It is the register\'s own first declared mutation for RPH-CON-002, narrowed to the single command this journey sends: under it the stray property is silently dropped, ProposePwu is ACCEPTED, and the PWU is created — so U-3 reddens on all three of its assertions at once, the status, the issue array, and the object that must not exist. ⚠ TWO WIDER MUTATIONS WERE CONSIDERED AND REJECTED FOR BEING WIDER THAN THE CLAIM. Making `validateAgainst` return ok on `unrecognized_keys` also changes what EVERY successful validation returns (the raw input rather than `parsed.data`), which could redden tests of other commands through zod defaults and coercions — TOO_WIDE by construction, and SL-3a says such a mutant proves none of them. Swapping z.strictObject globally would do the same across 100+ schemas. This one moves exactly the schema U-3 sends.'
		},
		{
			id: 'CLS-USER-ERROR-M4',
			file: 'packages/rph-application/src/handlers/pwu.ts',
			find: 'const readiness = checkPwuShapeReadiness(readinessFactsOf(ctx, loaded.state));',
			replace: 'const readiness = { ok: true, unmet: [] as string[] };',
			expectRed: ['U-4'],
			predictedMessage:
				'a PWU whose deliverable is still undecided must not reach READY — "MarkPwuReady: PWU … does not satisfy the shape readiness contract (DOC-002 §9)"',
			why: 'Proves U-4 depends on the readiness contract being CONSULTED at all. With the check short-circuited, MarkPwuReady advances on transition legality alone and the PWU reaches READY carrying no expected output, so U-4 reddens on its status, its message and its "the work did not move" assertion together. It leaves U-5 untouched: that PWU satisfies the contract, so removing the contract changes nothing for it.'
		},
		{
			id: 'CLS-USER-ERROR-M5',
			file: 'packages/rph-domain/src/pwuGuards.ts',
			find: "unmet.push('expected output (DOC-002 §9.1)');",
			replace: "unmet.push('some deliverable, unspecified');",
			expectRed: ['U-4'],
			predictedMessage:
				'the readiness refusal must name the UNMET LIMB rather than merely report that some readiness requirement failed — the tail "expected output (DOC-002 §9.1)" and nothing after it',
			why: "The second mutant on the same clause, and the one that earns its keep. M4 proves the refusal EXISTS; this proves the refusal is INTELLIGIBLE, which is the entire content of this scenario class. The message is built as `…(DOC-002 §9): ${unmet.join('; ')}`, so a test asserting only the PREFIX would be satisfied by ANY readiness failure, including limbs this Slice never exercises. U-4 asserts the whole string, tail included, so renaming the limb reddens it. ⚠ THE REPLACEMENT SHARES NO SUBSTRING WITH THE ANCHOR'S QUOTED TEXT ON PURPOSE: a replacement containing 'expected output (DOC-002 §9.1)' could not redden an assertion looking for it."
		},
		{
			id: 'CLS-USER-ERROR-M6',
			file: 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
			find: "sourceStates: ['SHAPING']",
			replace: "sourceStates: ['PROPOSED']",
			expectRed: ['U-5'],
			predictedMessage:
				'the corrected journey must actually reach READY — a control that cannot be broken proves nothing about the four corrections it exists to validate',
			why: "The CONTROL'S OWN MUTANT, which this repository requires and has three times shipped without: a control that cannot fail certifies nothing. It must redden U-5 and ONLY U-5, and the ordering inside `markPwuReady` is what makes that possible — the readiness contract is consulted BEFORE `advancePwuLifecycle`, so U-4's PWU is still refused by readiness with its message unchanged, while U-5's now-conforming PWU is refused for a source state MarkPwuReady no longer declares. A mutant sited in `checkPwuShapeReadiness` instead would have reddened both and proved neither (SL-3a)."
		},
		{
			id: 'CLS-USER-ERROR-M7',
			file: 'packages/rph-application/src/handlers/command-precondition.ts',
			find: 'but it is ${from}. Re-issuing it would append a second ${site.eventType} recording a change that did not happen.',
			replace: 'but it is ${from}.',
			expectRed: ['U-2'],
			predictedMessage:
				'the FROM_STATES refusal must carry its tail as well as its head — "Re-issuing it would append a second IntentApproved recording a change that did not happen" — which is the marker the enforcement register pins for RPH-INT-003',
			why: "THE MUTANT THAT PROVES THE MESSAGE, AND M2 DOES NOT. M2 moves the refusal to a neighbouring site and reddens U-2 through its CODE; before this entry existed, NO declared mutant could redden U-2's whole-message assertion, which is the F-3 shape (a clause asserted with nothing live behind it) sitting inside a Slice that says the message is the point. This one changes ONLY the text: the status stays REJECTED and the code stays RPH_ILLEGAL_STATE_TRANSITION, so the sole thing it can redden is an assertion that reads the whole string. It is narrow INSIDE this Slice by construction — a FROM_STATES message is minted only when a declared precondition refuses, and U-2's is the only precondition refusal in the file (U-2's INT-004 neighbour is a precheck, U-4's is the readiness contract, U-6's is loadOrReject). ⚠ IT ALSO REDDENS command-precondition.test.ts AND THAT IS NOT A TOO_WIDE: scripts/drive-slice-mutants.ts applies a mutant and then calls runSlice on the declaring Slice's path ONLY, so no sibling suite can contribute to the verdict — read, not assumed, because this programme has recorded a mutant rationale that was a wrong hypothesis about this very driver."
		},
		{
			id: 'CLS-USER-ERROR-M8',
			file: 'packages/rph-contracts/src/messages.ts',
			find: 'export const MarkPwuReadyPayloadSchema = z.strictObject({\n\tshapeReadinessAssessmentId: z.string(),',
			replace:
				'export const MarkPwuReadyPayloadSchema = z.strictObject({\n\texpectedOutputs: z.array(OutputDefinitionSchema).optional(),\n\tshapeReadinessAssessmentId: z.string(),',
			expectRed: ['U-7'],
			predictedMessage:
				'the carrier set must be READ OFF the live COMMANDS registry rather than restated — a second command declaring expectedOutputs must make U-7 report two carriers where it asserts exactly one',
			why: "The control on the DERIVATION in U-7's first limb, without which that limb would be a hand-written list wearing a sweep's clothing — the failure this repository has recorded by name (a hand-listed set said 2 where the derivation said 8). U-7 sweeps every entry of COMMANDS, which IS the command surface (command-bus.ts looks the incoming commandType up in it and refuses anything absent with 'Unknown command type'), and asserts the answer is exactly ['ProposePwu']. Declaring the key on a SECOND command makes the sweep return two, so U-7 reddens if and only if it really reads the registry. ⚠ `.optional()` IS LOAD-BEARING IN THE MUTANT AND NOT TIDINESS: a REQUIRED field would make every MarkPwuReady in this file fail payload validation — U-4's refusal would change code and U-5's fail-loud send would throw — which is TOO_WIDE and proves none of them (SL-3a). Optional leaves both untouched and moves only the derived set."
		},
		{
			id: 'CLS-USER-ERROR-M9',
			file: 'packages/rph-application/src/handlers/kit.ts',
			find: 'Revision conflict on ${args.aggregateId} (actual revision ${String(result.actualRevision)})',
			replace: 'Revision conflict on ${args.aggregateId}',
			expectRed: ['U-7'],
			predictedMessage:
				'the re-proposal must be refused with the revision the store actually holds — "(actual revision 1)" — so the professional reads "this object already exists" rather than guessing their command was malformed',
			why: "The control on U-7's DRIVEN limb, sited on the message rather than the status on purpose: under it the status stays CONFLICT and the code stays RPH_REVISION_CONFLICT, so it can redden nothing but an assertion reading the whole string — which is what stops U-7 being satisfied by ANY conflict. ⚠ THIS IS NOT U-6's CONFLICT SITE, AND THE TWO MESSAGES ARE BYTE-DIFFERENT, WHICH IS WHY THE MUTANT NAMES ONE CLAUSE. U-6's control is refused by `loadOrReject` against the envelope's `expectedRevision` ('command expected revision 99, actual is 0'); U-7 is refused by the COMMIT path's optimistic-concurrency check ('(actual revision 1)'). The enforcement register records the same distinction in its own words — *'the store's own conflict message is Revision conflict on X (actual revision N) — byte-different'*."
		}
	]
};

// ── THE FIXTURE ──────────────────────────────────────────────────────────────────────────────────────────────
// ⚠ NEW IDS, NOT E2E-002'S. Two Slices sharing an aggregate id share nothing at runtime (each journey builds its
// own store) but they do share a reader, and a refusal quoting an id that also appears in another Slice's
// arrangement is a diagnosis waiting to go wrong. Crockford base32 excludes I, L, O and U — an id carrying one is
// refused by the envelope schema with `invalid_format@id`, which was driven here before it was written down.
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V10';

/** The undeclared property the professional sends in `U-3`. Named once, because three assertions quote it. */
const STRAY_PROPERTY = 'priority';

/**
 * The approval the professional issues, as ONE object dispatched from three places.
 *
 * ⚠ IT WAS TWO INDEPENDENT LITERALS AND THAT WAS A DRIFT SURFACE. `U-2` watches this payload refused on a RAW
 * intent, `withIntentApproved` sends the same bytes on a FORMALIZED one, and `U-2`'s INT-004 neighbour sends them
 * on a FORMALIZED intent with no outcomes. Every one of those comparisons is an argument that ONLY THE WORLD
 * DIFFERS — and an argument resting on byte-identity must not be maintained by copies that can be edited apart.
 */
const APPROVAL = { decisionId: 'dec_user_error_intent', approvedSemanticVersion: 1, approvalScope: 'full' };

/** The formalization. `U-2`'s neighbour re-sends it with `desiredOutcomes: []`, and nothing else changed. */
const FORMALIZATION = {
	formalizedObjective: 'A multi-tenant field service management SaaS with enforceable tenant isolation',
	desiredOutcomes: [{ description: 'Dispatch a job to a technician' }],
	successConditions: [{ statement: 'A customer request becomes an invoiced job' }],
	nonGoals: ['payroll'],
	ambiguityIds: [],
	constraintIds: [],
	stakeholderIds: []
};

/**
 * The proposal the professional means to make.
 *
 * ⚠ EVERY LIMB OF THE SHAPE READINESS CONTRACT IS SATISFIED HERE EXCEPT THE ONE UNDER TEST, and that is what
 * makes `U-4`'s assertion worth anything. `checkPwuShapeReadiness` names EVERY unmet limb in one message, joined
 * by '; ' — so a fixture that also left `inScope` or the risk profile empty would produce a longer message that a
 * `toContain` would still pass, and the Slice would be claiming the expected-outputs limb while proving only that
 * SOMETHING was unmet. Driven, not reasoned: the message asserted in `U-4` is the whole string, and it ends at
 * the one limb this fixture withholds.
 *
 * ⚠ AND `assurancePolicyIds` IS EMPTY, WHICH IS NOT AN OVERSIGHT. This journey never requests an assessment, so
 * seeding and activating a policy would be arrangement that no assertion depends on — and a policy id that is
 * cited but never seeded is the dangling-governance-fact defect `seedJourneyPolicy` exists to prevent.
 */
function proposal(over: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		pwuId: PWU,
		pwuKind: 'ARCHITECTURE_DEFINITION',
		title: 'Architecture Definition',
		description: 'The architecture for the multi-tenant field service platform',
		intentId: INTENT,
		boundaries: {
			inScope: ['tenant isolation boundary', 'data partitioning model'],
			outOfScope: ['billing integration'],
			permittedChanges: [],
			prohibitedChanges: []
		},
		obligationIds: [],
		constraintIds: [],
		assumptionIds: [],
		expectedOutputs: [{ outputId: 'out_user_error_architecture', kind: 'DOCUMENT' }],
		assurancePolicyIds: [],
		riskProfile: {
			consequence: 'HIGH',
			uncertainty: 'MEDIUM',
			irreversibility: 'MEDIUM',
			securitySensitivity: 'HIGH',
			regulatoryExposure: 'LOW'
		},
		...over
	};
}

/** Stage 0 — the professional sits down. Nothing has been recorded. `U-1` acts here. */
function atTheStart(): Journey {
	return beginJourney();
}

/** Stage 1 — the intent is captured, and is RAW. `U-2` and `U-6` act here. */
function withIntentCaptured(j: Journey): void {
	j.send('CaptureIntent', 'INTENT', INTENT, {
		intentId: INTENT,
		originatingExpression: 'ship a multi-tenant field service platform with enforceable tenant isolation',
		ontologyId: 'o',
		ontologyVersion: '1'
	});
}

/**
 * Stage 2 — the three acts `U-2`'s refusal asked for, and then the approval it refused.
 *
 * ⚠ THIS IS A POSITIVE CONTROL, AND IT IS A NARROWER ONE THAN IT ONCE CLAIMED TO BE. It was offered as proof
 * that *"the refusal in U-2 is about RAW and not about the command"*. It cannot carry that: this run differs
 * from `U-2`'s in TWO respects, not one — the intent is FORMALIZED rather than RAW, AND `FormalizeIntent` has
 * written a non-empty `desiredOutcomes` where `captureIntent` left `[]`. A control that varies two inputs cannot
 * attribute the difference to either, and the second variable is not idle: it is precisely what the INT-004
 * precheck reads, one line below the precondition (`U-2` drives that neighbour).
 *
 * WHAT IT DOES PROVE, which is worth having: the command itself is DISPATCHABLE by this principal on this
 * aggregate with this exact payload — same `APPROVAL` object, through the FAIL-LOUD `send`, so any refusal for a
 * reason unrelated to the intent's state would throw in arrangement and take four tests down with it. What pins
 * the SITE in `U-2` is not this control but `U-2`'s own whole-message assertion, and M7 is what proves that
 * assertion is load-bearing.
 */
function withIntentApproved(j: Journey): void {
	j.send('BeginIntentDiscovery', 'INTENT', INTENT, {});
	j.send('ProvisionIntent', 'INTENT', INTENT, { ambiguityIds: [] });
	j.send('FormalizeIntent', 'INTENT', INTENT, FORMALIZATION);
	j.send('ApproveIntent', 'INTENT', INTENT, APPROVAL);
}

/** Stage 3 — the proposal lands and shaping begins. `U-4` acts here. `over` carries the mistake, if any. */
function withPwuInShaping(j: Journey, over: Record<string, unknown> = {}): void {
	j.send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', PWU, proposal(over));
	j.send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', PWU, {});
}

/**
 * The readiness attestation. Identical in `U-4` and `U-5`; only the SHAPE underneath it differs.
 *
 * ⚠ AND `shapeReadinessAssessmentId` NAMES AN ATTESTATION NO ACT IN THIS FILE CREATES, WHICH IS THE PRACTICE THE
 * `proposal()` docblock below condemns — so it is disclosed here rather than left as a silent exception. The
 * asymmetry is real: `assurancePolicyIds` is left empty there because seeding a policy would be arrangement no
 * assertion needs, whereas this field is REQUIRED by `MarkPwuReadyPayloadSchema` and cannot be dropped. It is
 * also unchecked — `markPwuReady` never resolves it, and carries it straight onto the `PwuMarkedReady` event as
 * `shapeReadinessAttestationId` — so the governed stream records an attestation id that resolves to nothing.
 * That is an ENGINE gap, not a fixture choice, and the shared journey fixture makes the same citation
 * (`'assess_shape'`), so this is inherited precedent rather than novelty. Named because the file states the rule
 * it is breaking; not asserted, because no clause here turns on it and RPH-PWU-004 is not the rule that would.
 */
const MARK_READY = { shapeReadinessAssessmentId: 'assess_shape_user_error', expectedSemanticVersion: 1 };

/**
 * Dispatch with an ENVELOPE field the shared journey helper cannot set.
 *
 * ⚠ INLINED HERE RATHER THAN ADDED TO `slice-journey.ts`, WHICH IS SHARED. `expectedRevision` is a field of the
 * COMMAND ENVELOPE, not of any payload (DOC-007 §8), and `Journey.send` / `Journey.attempt` build the envelope
 * themselves — so `U-6`'s pair, whose entire content is the presence or absence of that one field, cannot be
 * expressed through them. The whole envelope is written out so a reader can see that the two runs in `U-6` differ
 * in exactly one key and in nothing else.
 */
function dispatchWithRevision(
	j: Journey,
	commandType: string,
	over: { readonly expectedRevision?: number }
): ReturnType<Journey['attempt']> {
	return j.engine.dispatch({
		commandId: 'cue-cmd-1',
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: 'INTENT',
		targetAggregateId: INTENT,
		issuedAt: JOURNEY_TS,
		correlationId: 'slice-user-error',
		idempotencyKey: 'cue-idem-1',
		payload: {},
		...over
	} as Parameters<Journey['engine']['dispatch']>[0]);
}

describe('SLICE CLS-USER-ERROR — four mistakes, four intelligible refusals, and the route out of them', () => {
	// ⚠ THE STATUS AND THE MESSAGE ARE BOTH ASSERTED, AND BOTH ARE NEEDED. `not.toBe('ACCEPTED')` would be
	// satisfied by a crash, a duplicate, or an envelope refusal; the exact message is what says WHICH guard ran.
	// And the message names the id the professional cited, which is the actionable half — a refusal reading only
	// "intent not found" would leave them guessing which of their ids was wrong.
	it('U-1 — proposing the work before its intent exists is refused, and the refusal names the intent it could not find (RPH-PWU-002)', () => {
		const j = atTheStart();
		const refused = j.attempt('ProposePwu', 'PROFESSIONAL_WORK_UNIT', PWU, proposal());
		expect(refused.status, 'the proposal must be refused, not merely left unrecorded').toBe('REJECTED');
		expect(
			refused.error?.code,
			'and refused as a SEMANTIC failure — the payload is well-formed; what is missing is the thing it points at'
		).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(
			refused.error?.message,
			'the refusal must name the intent the professional cited, so they can see that it is the ORDER of their own acts that is wrong — RPH-PWU-002'
		).toBe(`ProposePwu requires an existing intent ${INTENT} (PWU-002)`);
		// Not a vacuous absence check: under M1 this same id resolves to a PWU that was created citing an intent
		// that does not exist.
		expect(j.state(PWU), 'and no PWU may exist afterwards — a refused proposal proposes nothing').toBeUndefined();
	});

	// ⚠ THE MESSAGE HAS TWO HALVES AND BOTH ARE ASSERTED, because only the pair is actionable: the states the
	// command requires AND the state the intent is actually in. The tail — "Re-issuing it would append a second
	// IntentApproved" — is the marker the enforcement register pins for RPH-INT-003, and M7 is what proves this
	// test depends on it.
	//
	// ⚠⚠ THE REASON THIS TEST USED TO GIVE FOR THE TAIL WAS WRONG, AND THE CORRECTION IS DRIVEN BELOW RATHER THAN
	// ARGUED. It said: widening the precondition makes a DIFFERENT site refuse the same arrangement with the SAME
	// code, so only the whole string can tell the two sites apart. It does not. `advanceIntent` runs
	// loadOrReject -> precondition -> precheck -> checkTransition; widen the precondition and the arrangement
	// falls into the INT-004 PRECHECK, which refuses with RPH_INVARIANT_VIOLATION — a different code — because a
	// RAW intent's `desiredOutcomes` is always `[]` (`captureIntent` hard-codes it; only `FormalizeIntent` writes
	// outcomes). `checkTransition` is never reached at all. The claim was inherited from the register's prose
	// comment and is contradicted by that same row's own first declared mutation two lines below it.
	//
	// So the neighbouring site is REACHED HERE WITHOUT ANY MUTATION — by formalizing with no outcomes, which the
	// payload permits — and what it produces is asserted. That is what the whole-message `toBe` above is worth:
	// the two refusals sit one line apart in one primitive, on the same command and the same aggregate.
	it('U-2 — approving a RAW intent is refused, naming both the states required and the state it is in (RPH-INT-003)', () => {
		const j = atTheStart();
		withIntentCaptured(j);
		const refused = j.attempt('ApproveIntent', 'INTENT', INTENT, APPROVAL);
		expect(refused.status, 'the approval must be refused').toBe('REJECTED');
		expect(
			refused.error?.code,
			'with the code the ratified statement itself names — RPH-INT-003 says RPH_ILLEGAL_STATE_TRANSITION in terms'
		).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(
			refused.error?.message,
			'and the message must name the required states AND the current one; a refusal saying only "illegal transition" leaves the professional with nothing to do next'
		).toBe(
			`ApproveIntent requires intent ${INTENT} to be FORMALIZED or REVISED, but it is RAW. ` +
				'Re-issuing it would append a second IntentApproved recording a change that did not happen.'
		);
		expect(
			j.state(INTENT)?.intentStatus,
			'and the intent must not have moved — the refusal is a refusal, not a warning attached to a state change'
		).toBe('RAW');

		// The neighbouring site, driven. Same command, same aggregate id, the same `APPROVAL` bytes; the ONLY
		// difference is which of the two guards the intent's state walks into.
		const neighbour = atTheStart();
		withIntentCaptured(neighbour);
		neighbour.send('BeginIntentDiscovery', 'INTENT', INTENT, {});
		neighbour.send('ProvisionIntent', 'INTENT', INTENT, { ambiguityIds: [] });
		neighbour.send('FormalizeIntent', 'INTENT', INTENT, { ...FORMALIZATION, desiredOutcomes: [] });
		const byOutcomes = neighbour.attempt('ApproveIntent', 'INTENT', INTENT, APPROVAL);
		expect(
			byOutcomes.error?.code,
			'CORRECTION, DRIVEN: the guard one line past the precondition refuses with a DIFFERENT code, not the same one — so asserting RPH_ILLEGAL_STATE_TRANSITION is not the empty gesture this test used to claim it was'
		).toBe('RPH_INVARIANT_VIOLATION');
		expect(
			byOutcomes.error?.message,
			'and it says something else entirely — the two sites are separated by the message AND by the code, which is why M2 reddens this test through the code and M7 through the message'
		).toBe('An approved intent must record at least one desired outcome (INT-004)');
	});

	// ⚠⚠ A FALSE UNIVERSAL STOOD HERE AND IT IS WITHDRAWN. It read: *"every schema refusal in this engine carries
	// the CONSTANT string 'Schema validation failed'"*, and it was used to excuse not asserting the message at
	// all. One sweep for the CODE across `packages/*/src` refutes it. The constant belongs to ONE arm of ONE
	// function — `validateAgainst`'s payload-parse failure, which is the path this test drives — and every other
	// site minting `RPH_VALIDATION_SCHEMA_FAILED` carries text of its own: `Unknown command type: X`, `Command
	// envelope is missing required identity: …` and `Command payload cannot be canonicalized …` (command-bus.ts),
	// `X would emit a Y event whose payload violates its ratified contract …` (handlers/kit.ts), `Unknown schema
	// id: X` (contracts/validate.ts), and a malformed transition condition (domain/plan-proposal.ts, surfaced by
	// `proposeExecutionPlan`). The enumeration is what the sweep returned and is offered as a lower bound, not as
	// a census — the claim being withdrawn is a UNIVERSAL, and one counter-example was already enough.
	//
	// THE TRUE STATEMENT IS NARROWER AND STRONGER, and the assertions below now match it. The message is constant
	// ACROSS PAYLOAD FAILURES, so it cannot say WHICH property was wrong; but it is shared with NO other emitter
	// of this code, so asserting it EXCLUDES all of them at zero cost, and it is asserted. The part to act on
	// still lives in `details.issues`, and the enforcement register records the same finding for RPH-CON-002,
	// matching `<issueCode>@<dottedPath>` by EQUALITY rather than substring. `toEqual` on the whole array is the
	// strongest form available: it fixes the COUNT (exactly one thing was wrong), the PATH (the object root, which
	// is where zod reports a property belonging to no schema), the CODE, and the property's NAME.
	it('U-3 — a proposal carrying a property the engine never declared is refused at the boundary, and the refusal names the property (RPH-CON-002)', () => {
		const j = atTheStart();
		withIntentCaptured(j);
		withIntentApproved(j);
		const refused = j.attempt(
			'ProposePwu',
			'PROFESSIONAL_WORK_UNIT',
			PWU,
			proposal({ [STRAY_PROPERTY]: 'HIGH' })
		);
		expect(
			refused.status,
			'a boundary refusal carries VALIDATION_FAILED rather than REJECTED — the command never reached a handler'
		).toBe('VALIDATION_FAILED');
		expect(refused.error?.code, 'with the code RPH-CON-002 names').toBe('RPH_VALIDATION_SCHEMA_FAILED');
		expect(
			refused.error?.message,
			'and from the PAYLOAD-PARSE arm specifically — every other site minting this code carries text of its own, so the constant is what says the refusal came from parsing this command payload against its contract and not from an unknown command type, an unidentifiable envelope, an uncanonicalizable payload, an unknown schema id, or an outbound event'
		).toBe('Schema validation failed');
		expect(
			(refused.error?.details as { issues?: unknown[] } | undefined)?.issues,
			'exactly one thing is wrong, it is at the object root, and the professional is told WHICH property is not theirs to send — the only intelligible content a schema refusal carries here'
		).toEqual([
			{ path: '', code: 'unrecognized_keys', message: `Unrecognized key: "${STRAY_PROPERTY}"` }
		]);
		// The stray property is not silently dropped. Under M3 it IS dropped and this PWU exists.
		expect(
			j.state(PWU),
			'and nothing was created — a strict boundary refuses the command rather than accepting a cleaned-up version of it'
		).toBeUndefined();
	});

	// ⚠⚠ NARROWED IN THE NAME, AND THE NARROWING IS NOT COSMETIC. RPH-PWU-004 reads "MarkPwuReady on a PWU missing
	// expected outputs AND VERIFICATION CRITERIA is rejected". The second half is enforced NOWHERE, and that was
	// DRIVEN rather than searched: `readinessFactsOf` builds the facts `checkPwuShapeReadiness` sees and carries
	// no verification criterion at all, `proposePwu` hard-codes `verificationCriterionIds: []`, and `U-5` below
	// OBSERVES a PWU reaching READY with that field empty. So this test asserts the limb that exists, and its
	// name says which limb that is.
	//
	// ⚠ AND THE WHOLE MESSAGE IS ASSERTED, TAIL INCLUDED. Every unmet limb is joined into one string, so a
	// `toContain` on the prefix would be satisfied by a PWU missing four other things — the test would pass while
	// measuring something else entirely. `toBe` fixes that the expected-output limb is the ONLY thing this shape
	// lacks, which is what makes the fixture a minimal delta rather than a mess.
	it('U-4(narrowed) — MarkPwuReady on a PWU whose deliverable is undecided is refused naming that limb and no other; the rule’s verification-criteria half is enforced nowhere (RPH-PWU-004)', () => {
		const j = atTheStart();
		withIntentCaptured(j);
		withIntentApproved(j);
		withPwuInShaping(j, { expectedOutputs: [] });
		const refused = j.attempt('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', PWU, MARK_READY);
		expect(refused.status, 'readiness is a substantive gate, so the command must be refused').toBe('REJECTED');
		expect(refused.error?.code, 'as a semantic failure — the SHAPING -> READY arrow itself is legal').toBe(
			'RPH_VALIDATION_SEMANTIC_FAILED'
		);
		expect(
			refused.error?.message,
			'the refusal must name the unmet limb and end there; a message naming several limbs would mean this fixture is missing more than the one thing under test'
		).toBe(
			`MarkPwuReady: PWU ${PWU} does not satisfy the shape readiness contract (DOC-002 §9): ` +
				'expected output (DOC-002 §9.1)'
		);
		expect(
			j.state(PWU)?.workLifecycleState,
			'and the work must still be SHAPING — a refused readiness attestation leaves the professional where they were, holding a message that says what to add'
		).toBe('SHAPING');
	});

	// ⚠ THIS IS THE TEST THAT MAKES THE OTHER FOUR MORE THAN FOUR REFUSALS. Each refusal above named a correction;
	// this applies exactly those four and nothing else, and the work reaches READY. Without it the Slice would
	// prove that four commands can be refused and NOT that the refusals were intelligible — which is the entire
	// content of this scenario class.
	//
	// ⚠⚠ AND THE NAME SAYS "A JOURNEY", NOT "THE SAME JOURNEY", BECAUSE THIS IS A FRESH ONE AND THE FOURTH
	// CORRECTION IS APPLIED EARLIER THAN THE ACT THAT REFUSED IT. `atTheStart()` builds a new store, so nothing
	// here is U-4's PWU; and the expected output is supplied at PROPOSAL, one act before MarkPwuReady, because no
	// command writes a PWU's shape after `ProposePwu` — `U-7` drives that. A name reading "carries the SAME
	// journey to READY" would assert a walk from U-4's refusal to this green that the engine cannot perform, and
	// the four corrections would be composing into a route no professional could take. What IS established is
	// sufficiency: the corrections the four messages named, applied where each is performable, get the work
	// through. That is the honest claim and it is the one the class needs.
	//
	// ⚠ AND IT IS A CONTROL WITH ITS OWN MUTANT (M6). A control that cannot fail certifies nothing, and this
	// repository has shipped three that could not. M6 breaks THIS test while leaving U-4 green, which is what
	// makes the pair discriminating rather than mutually supporting.
	it('U-5 — the four corrections the four messages named are SUFFICIENT: applied at the acts where each is performable, a journey reaches READY', () => {
		const j = atTheStart();
		withIntentCaptured(j); //  correction 1 — U-1 said the intent must exist. Capture it FIRST.
		withIntentApproved(j); //  correction 2 — U-2 said FORMALIZED or REVISED. Discover, formalize, then approve.
		withPwuInShaping(j); //    corrections 3 and 4 — no stray property, and a declared expected output. ⚠ BOTH
		//                         ride on the PROPOSAL. Correction 3 must (the stray key is refused at the payload
		//                         boundary); correction 4 must too, and that is the finding U-7 records.
		j.send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', PWU, MARK_READY);
		expect(
			j.state(PWU)?.workLifecycleState,
			'the corrected journey must reach READY — four refusals that cannot be corrected are obstruction, not guidance'
		).toBe('READY');
		// ⚠ PINNED, NOT CERTIFIED. This is the OBSERVED half of U-4's narrowing: a PWU that reached READY carrying
		// no verification criterion at all. It is written to FAIL the day that limb of RPH-PWU-004 is enforced, so
		// the disclosure in U-4's name cannot outlive the gap it discloses.
		expect(
			j.state(PWU)?.verificationCriterionIds,
			'PINNED GAP: this PWU is READY with no verification criteria, so the second half of RPH-PWU-004 is admitted at the very site whose first half refuses. Repair that and this assertion is what tells you U-4’s narrowing has gone stale.'
		).toEqual([]);
	});

	// ⚠⚠ THIS TEST ASSERTS THE ENGINE FAILING TO REFUSE, WHICH IS WHY RPH-CON-003 IS NOT IN `citedRules`.
	// The fifth mistake in this story is the one a careful professional makes without noticing: issuing an update
	// without declaring the revision they believe current. DOC-003 §9 PER-4 requires that declaration and forbids
	// last-write-wins. The engine takes the command anyway, and the intent really moves.
	//
	// ⚠ THE TWO RUNS VARY EXACTLY ONE KEY, WHICH IS THE ONLY ARRANGEMENT THAT CAN DECIDE THIS. A disclosure needs
	// a CONTROL of the same shape, or it cannot tell "the engine does not police revisions" from "the engine
	// refuses this command for some unrelated reason". Same command type, same aggregate at the same revision,
	// same principal, same payload — one run OMITS `expectedRevision`, the other sends a wrong one. The first is
	// ACCEPTED and the state advances; the second is refused by `loadOrReject` with both revisions named. So the
	// gate is alive, and what it does not police is the ABSENT declaration — which is RPH-CON-003's escape clause
	// going unused: no exemption mechanism exists anywhere, so the rule is enforced for no command and exempt for
	// none.
	it('U-6(disclosed) — the one mistake here the engine does NOT refuse: an update declaring no expected revision is accepted and the work really moves (RPH-CON-003 is unenforced)', () => {
		const admitted = atTheStart();
		withIntentCaptured(admitted);
		expect(
			admitted.state(INTENT)?.intentStatus,
			'CONTROL: the intent starts RAW, so the update below is a real state change and not a no-op'
		).toBe('RAW');
		const omitted = dispatchWithRevision(admitted, 'BeginIntentDiscovery', {});
		expect(
			omitted.status,
			'PINNED GAP: an update declaring no expected revision is ADMITTED, which is the last-write-wins PER-4 forbids. This assertion fails the day RPH-CON-003 is enforced, and that is what it is for.'
		).toBe('ACCEPTED');
		expect(
			admitted.state(INTENT)?.intentStatus,
			'and the aggregate really moved — the admission is not a swallowed no-op'
		).toBe('UNDER_DISCOVERY');

		// The control: the SAME command, on an intent at the SAME revision, with one field added.
		const policed = atTheStart();
		withIntentCaptured(policed);
		const wrong = dispatchWithRevision(policed, 'BeginIntentDiscovery', { expectedRevision: 99 });
		expect(
			wrong.status,
			'CONTROL: the engine DOES police a revision that is wrong, so the admission above is a hole in a live guard rather than an absent guard'
		).toBe('CONFLICT');
		expect(
			wrong.error?.message,
			'and it names both revisions — the engine polices a declaration that is wrong while ignoring one that is absent'
		).toBe(`Revision conflict on ${INTENT}: command expected revision 99, actual is 0`);
		expect(
			policed.state(INTENT)?.intentStatus,
			'and that intent did NOT move, which is what distinguishes the two runs'
		).toBe('RAW');
	});

	// ⚠⚠ THE CORRECTION `U-4` ASKS FOR CANNOT BE MADE TO THE WORK ITEM `U-4` REFUSED. This is the fact the file's
	// thesis used to paper over — four messages "composing into a route" applied "to the same work item" — and it
	// is the most interesting thing this class has to say, so it is DRIVEN in two limbs rather than argued:
	//
	//   (a) DERIVED, NOT ENUMERATED. `COMMANDS` IS the command surface: command-bus.ts looks the incoming
	//       `commandType` up in it and refuses anything absent with "Unknown command type". Sweeping every entry's
	//       payload schema for an `expectedOutputs` key is therefore a question about the WHOLE surface, and it is
	//       asked here rather than answered from a list — a hand-written list is the defect one level up, and this
	//       repository has recorded it happening (a hand-listed set said 2 where the derivation said 8). M8 is the
	//       control: declare the key on a second command and this limb must report two.
	//
	//   (b) DRIVEN. That one command, re-issued against the PWU that exists, does not re-shape it. The commit
	//       path's optimistic-concurrency check refuses with a CONFLICT naming the revision it found, and the
	//       shape does not move. M9 is the control on the message.
	//
	// `pwu.ts` states the same conclusion independently, in `markPwuReady`'s own docblock: *"No command writes a
	// PWU's shape after `ProposePwu` — every later PWU command is a lifecycle move, `ReshapePwu` included (it
	// enters RESHAPING and writes no shape field)"*. And `ReshapePwu` is not even reachable from here — its
	// `sourceStates` are `['EXECUTING', 'UNDER_ASSURANCE']`.
	//
	// ⚠ THIS DOES NOT WEAKEN `U-4`, AND IT IS NOT A COMPLAINT ABOUT THE ENGINE. The refusal is exactly as
	// intelligible as `U-4` says: it names the missing limb precisely, and `U-5` shows the named correction works.
	// What is recorded is WHERE it works — at the proposal, not at the refusal — so that no future reader takes
	// `U-4`'s message as an instruction the holder of this PWU could carry out.
	it('U-7(disclosed) — the limb U-4 names cannot be supplied to the PWU U-4 refused: exactly one command in the whole surface carries expectedOutputs, and re-issuing it against an existing PWU is a revision conflict', () => {
		const carriers = Object.entries(COMMANDS as Record<string, { payload: unknown }>)
			.filter(
				([, spec]) =>
					'expectedOutputs' in ((spec.payload as { shape?: Record<string, unknown> }).shape ?? {})
			)
			.map(([commandType]) => commandType);
		expect(
			carriers,
			'swept over the whole command registry: exactly one command can carry an expected output, and it is the one that CREATES the PWU — so the shape is decided at proposal or not at all'
		).toEqual(['ProposePwu']);

		// U-4's world, rebuilt: the PWU is SHAPING and its deliverable is undecided. (MarkPwuReady is not
		// re-driven here — U-4 owns that assertion, and re-driving it would put U-4's mutants onto this clause.)
		const j = atTheStart();
		withIntentCaptured(j);
		withIntentApproved(j);
		withPwuInShaping(j, { expectedOutputs: [] });

		// The only act that could supply the limb, aimed at the object that lacks it.
		const remedy = j.attempt('ProposePwu', 'PROFESSIONAL_WORK_UNIT', PWU, proposal());
		expect(
			remedy.status,
			'the one carrying command is refused against an object that already exists — CONFLICT, not a re-shaping, and not a second PWU either'
		).toBe('CONFLICT');
		expect(
			remedy.error?.message,
			'and it names the revision the store actually holds, so the professional reads "this object exists" rather than "my command was malformed" — the refusal is intelligible, but what it asks of them is unavailable'
		).toBe(`Revision conflict on ${PWU} (actual revision 1)`);
		expect(
			j.state(PWU)?.expectedOutputs,
			'PINNED: the deliverable is still undecided after the only remedy the surface offers. The day a command can write a PWU shape in place, this assertion is what tells you U-7 has gone stale.'
		).toEqual([]);
	});
});
