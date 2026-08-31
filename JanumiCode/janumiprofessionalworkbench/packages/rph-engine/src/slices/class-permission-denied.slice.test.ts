// JAN-SLICE-SWP-03 — the ENGINE Slice for the ratified scenario class `permission-denied path`.
//
// ── THE JOURNEY, IN ONE SENTENCE ─────────────────────────────────────────────────────────────────────────────
// An Undertaking Owner builds an architecture; a Product Owner agent assures it, finds it satisfied, and
// recommends that it be baselined — and then cannot approve its own recommendation, cannot have it approved by
// anyone else, and the promotion that rests on it is refused until an authorized human decides for itself. Along
// the way the Owner is barred from assuring its own work. TWO DENIALS BELONG TO THE STORY — an authority denial
// and an independence block — and a THIRD is produced deliberately, from the same command against the same
// aggregate, as the control that proves this Slice can tell one mechanism from another (`O-2`). One professional
// lesson: WHO MAY ACT is a fact the engine holds separately from WHAT THE WORK IS WORTH.
//
// ── ⚠⚠ THE CENTRAL HAZARD OF THIS CLASS, AND WHAT THIS SLICE DOES ABOUT IT ───────────────────────────────────
// TWO ENTIRELY DIFFERENT PROFESSIONAL FACTS SURFACE AT THE SAME `status: 'UNAUTHORIZED'`:
//
//   `RPH_AUTHENTICATION_REQUIRED` — packages/rph-application/src/command-bus.ts, `stampOrRefuse`. NOBODY WAS
//       LOGGED IN. The acting principal could not be established, so the command cannot be attributed at all and
//       is refused before any effect.
//   `RPH_AUTHORITY_INSUFFICIENT` — packages/rph-application/src/handlers/governance.ts, the `guard` inside
//       `makeDecisionEffective`. SOMEBODY IS KNOWN AND MAY NOT DO THIS. `kit.ts`'s `STATUS_FOR_CODE` maps it to
//       UNAUTHORIZED, and the enforcement register records it as the FIRST row ever to sit at that status.
//
// A Slice asserting the STATUS cannot tell those apart, and a Slice asserting only the CODE is one rename away
// from proving nothing — `JAN-CSAA` closed 64 of 65 findings whose tests asserted a code alone, one of which had
// 116 distinct emitters. SO EVERY REFUSAL HERE IS ASSERTED ON ITS MESSAGE, and `O-2` is a CONTROL that produces
// the OTHER mechanism from the SAME command against the SAME aggregate, asserts the message that belongs to it,
// and asserts the ABSENCE of the other's marker. The two tests together are what makes this Slice discriminate;
// each alone would not.
//
// ⚠ THE DISCRIMINATION IS SYMMETRIC, AND THE TWO EXCEPTIONS ARE LABELLED WHERE THEY STAND. Every refusal this
// Slice reads on the UNAUTHORIZED path asserts BOTH DIRECTIONS — the marker that belongs to its own mechanism
// AND the absence of the other's — so no assertion here about WHICH mechanism fired is satisfiable by both. The
// two `status` assertions (`O-1`'s first, `O-2`'s first) ARE satisfiable by both, deliberately: they are what
// establishes that the hazard is real, and each is labelled at its own call site as non-discriminating so a
// later reader cannot mistake it for evidence of which mechanism fired.
//
// ── WHAT IS NOT CLAIMED HERE ─────────────────────────────────────────────────────────────────────────────────
// `RPH-EXE-003` ("starting execution with a runtime binding still in REQUESTED is rejected") is a third member of
// this class and is NOT cited: it already has a driven home at
// `packages/rph-application/src/handlers/exebind-wp1-binding-authority.test.ts`, and a Slice that re-drove it
// would add a second claim over one arrangement without adding a fact. Named here so a later reader does not
// read its absence as a gap.
//
// ⚠ `RPH-GOV-002` IS DISCUSSED THROUGHOUT AND IS DELIBERATELY *NOT* CITED. It was cited here until this revision;
// the argument for removing it is driven in `O-3` and stated in full above `citedRules`. Named in this section so
// its absence reads as a decision rather than an oversight — a rule a Slice discusses but does not ASSERT must
// not appear in `citedRules`, which is the defect (`F-3`) this programme exists to close.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE — the prohibition both sibling Slices record. It converts a
// false clause into a green suite, which is `SL-8`'s "weakened to green" wearing a different hat.
import { describe, expect, it } from 'vitest';

import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { Credential } from '@janumipwb/rph-ports';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';

import { createEngine, type AuthedEngineHandle } from './../index.js';
import {
	assess,
	changeState,
	executeWork,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	verdict,
	JOURNEY_ACTOR,
	JOURNEY_POLICY,
	JOURNEY_TS,
	type Journey
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'CLS-PERMISSION-DENIED',
	title:
		'An agent may recommend and may not approve: three permission denials in one journey, told apart by their messages',
	plane: 'ENGINE',
	// ── ⚠ THE CLASS IS RATIFIED HERE, WITH AN ARGUMENT, NOT INHERITED FROM A TABLE ───────────────────────────
	// `SL-5` names eight classes and this Slice claims one of them. The claim has to survive its neighbours:
	//
	//   NOT `alternate valid path`. That is what `E2E-002` is, and its own preamble states the test: there, every
	//     command is ACCEPTED and only the professional VERDICT differs. Here the defining act — `ApproveDecision`
	//     — is REFUSED, and refused on WHO IS ACTING. Nothing about the architecture differs between the world
	//     where promotion is denied (`O-3`) and the world where the same promotion succeeds (`O-4`): the same
	//     PWU, the same assessment, the same baseline, the same item versions. ONLY THE DECIDER CHANGES. A class
	//     whose sole variable is the actor's standing is not an alternate outcome of the work.
	//
	//   NOT `user-error path`. Nothing is malformed. Every payload is schema-valid and every act is a ratified
	//     one — `RPH-GOV-002` EXPRESSLY PERMITS an agent to recommend, and `proposeDecision` applies no check on
	//     the RANK of the proposing actor, so the agent's proposal is not an error but the very thing the rule
	//     contemplates. (It is not check-free: REG-F-014 added one, and it is an IDENTITY test rather than a rank
	//     test — see the note above the `ProposeDecision` call in `throughRecommendation`.) The refusal does not
	//     say "you stated this wrongly"; it says "you may not do this".
	//
	//   NOT `system-failure path`. Nothing failed. Every refusal is a governed outcome the engine produced on
	//     purpose, with a typed code, a status and a reason.
	//
	//   NOT `data-unavailable path`, WHICH IS THE CLOSEST NEIGHBOUR AND THE ONE WORTH ARGUING. `O-3`'s refusal
	//     reads "NO_EFFECTIVE_PROMOTION_DECISION", and "no effective decision" can be misread as a missing datum.
	//     It is not: the Decision object EXISTS, loads, is complete, names its subjects and pins their versions.
	//     What is absent is not data the engine could not find — it is AUTHORITY behind data the engine can see
	//     perfectly well. A data-unavailable path is one where the engine cannot look; this is one where it looks
	//     and denies on what it sees.
	scenarioClass: 'permission-denied path',
	// ── ⚠ WHAT IS CITED, AND THE ONE ID THAT WAS REMOVED ─────────────────────────────────────────────────────
	// Every id verified present in `packages/rph-domain/vocab/m12-conformance.json` (`RPH-GOV-001` §15,
	// `RPH-BAS-006` §16, `RPH-ASR-003` §14).
	//
	//   `RPH-GOV-001` — asserted whole by `O-1`, with `CLS-PD-M1` as its mutant.
	//   `RPH-BAS-006` — asserted on its CONSEQUENT by `O-3`/`O-4`, with `CLS-PD-M3` and `CLS-PD-M4`. Its
	//     ANTECEDENT ("committing source or architecture artifacts to version control") IS NOT ASSERTED AND
	//     CANNOT BE: no command in the registry commits anything to version control, so nothing can trip the rule
	//     from that direction. That is not this Slice's discovery — the register's own row says it, as its third
	//     declared mutation, and files the row ENFORCED "on the CONSEQUENT — no baseline becomes authoritative
	//     without a promotion decision — which is the half a dispatch can reach". `SL-2` is satisfied by NAMING
	//     the unasserted limb, which is what this paragraph does.
	//   `RPH-ASR-003` — asserted by `O-5`/`O-6` on two of its three consequents, with `CLS-PD-M5`/`CLS-PD-M6`.
	//     Its third consequent is a DISJUNCTION and only one disjunct is driven; the other is named as NOT
	//     ASSERTED, with the derivation, above `O-5`.
	//
	// ⚠ `RPH-GOV-002` WAS CITED HERE AND HAS BEEN REMOVED. Its evidence was `O-3`, and `O-3` cannot carry it. The
	// argument is driven at `O-3` and summarized here: the promotion gate's `decisionOk` is a FOUR-WAY
	// CONJUNCTION (`packages/rph-domain/src/governance.ts` — `!!d && d.status === 'EFFECTIVE' && d.authorityHeld
	// && (decisionType is PROMOTE_BASELINE or APPROVAL)`), and the agent's recommendation fails TWO of its limbs
	// INDEPENDENTLY: it is PROPOSED, and its recorded authority is an AGENT while `authorityHeld` is computed as
	// `authority?.actorType === 'HUMAN'` (packages/rph-application/src/handlers/governance.ts:892). An
	// arrangement that trips two conjuncts proves NEITHER. `RPH-GOV-002`'s consequent is the EFFECTIVENESS limb —
	// "creates no effective governance decision" — so `O-3` stays GREEN in a world where that rule is FALSE: make
	// an agent's PROPOSED recommendation count as effective and `authorityHeld` still refuses it, with the same
	// whole message. AND THAT IS NOT REPAIRABLE BY ARRANGEMENT: `authorityHeld` is false for EVERY
	// agent-authored decision by construction, so this gate can never isolate the limb for the actor the rule
	// names. `O-3` drives the converse half of that argument as a live fact.
	//
	// The one place in this file where `RPH-GOV-002`'s consequent IS falsifiable is `O-1` — but `O-1` is
	// `RPH-GOV-001`'s test and `CLS-PD-M1` is `RPH-GOV-001`'s mutant, so citing both there would give two rules
	// ONE refusal site and ONE mutant. The register refuses to do exactly that, in `RPH-GOV-002`'s own row:
	// "filing it ENFORCED would give two rules ONE refusal site, so a single mutant would redden both and the
	// register would report two enforced rules where one arrangement had ever been driven". `citedRules` is
	// published verbatim into `docs/tracking/slices/LEDGER.md`, where a narrowing comment does not travel — so
	// the id is removed rather than qualified.
	citedRules: ['RPH-GOV-001', 'RPH-BAS-006', 'RPH-ASR-003'],
	// Nothing is discharged. All three rules already carry register rows, and this Slice CONFIRMS them at journey
	// level rather than settling anything they leave open — see the note above each test.
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'CLS-PD-M1',
			file: 'packages/rph-application/src/handlers/governance.ts',
			find: "const authorityHeld = authority?.actorType === 'HUMAN';",
			replace: 'const authorityHeld = authority?.actorType !== undefined;',
			expectRed: ['O-1'],
			predictedMessage:
				'approving this decision must be refused because the AUTHORITY it records is insufficient — not because nobody was logged in (RPH-GOV-001)',
			why: "Proves O-1 rests on the authority computation itself and not on some unrelated ground the ApproveDecision path might also refuse for. `!== undefined` rather than `true` DELIBERATELY: a bare `true` orphans `authority` and a mutant that stops the file compiling reddens everything and proves nothing — the trap `drive-slice-mutants.ts` warns reads as TOO_WIDE. LOCATOR, CORRECTED: this anchor is `makeDecisionEffective`'s, in rph-APPLICATION. The PROMOTION gate computes a DIFFERENT `authorityHeld`, ~560 lines later in the same file (packages/rph-application/src/handlers/governance.ts:892, inside promoteBaseline's guard: `(decision.authority as { actorType?: string })?.actorType === 'HUMAN'`); the rph-domain kernel only READS the flag and never computes it. So this mutant cannot reach O-3, which dispatches no ApproveDecision at all, and cannot flip O-4, whose ApproveDecision names a HUMAN authority that `!== undefined` still admits."
		},
		{
			id: 'CLS-PD-M2',
			file: 'packages/rph-application/src/command-bus.ts',
			find: 'The acting principal could not be established from authenticated context ',
			replace: 'The acting principal was not resolvable from authenticated context ',
			expectRed: ['O-2'],
			predictedMessage:
				'a command with no established principal must be refused for that reason and say so — the message is the only thing that separates it from an authority denial at the same status',
			why: "THE CONTROL'S OWN MUTANT, which this repository has shipped three controls without. A control that cannot redden certifies nothing, and O-2 is the assertion the whole Slice's discrimination rests on. The replacement shares no substring with `could not be established`, so it cannot be the INERT_SUPERSTRING failure the ledger has a verdict for. It cannot touch O-1: that refusal is produced by a handler guard the bus never reaches."
		},
		{
			id: 'CLS-PD-M3',
			file: 'packages/rph-domain/src/governance.ts',
			find: "code: 'NO_EFFECTIVE_PROMOTION_DECISION',",
			replace: "code: 'EXPIRED_REQUIRED_WAIVER',",
			expectRed: ['O-3'],
			predictedMessage:
				'promotion on a decision that is not EFFECTIVE must be refused for the ABSENCE OF AN EFFECTIVE DECISION and for nothing else — an unapproved decision authorizes nothing (RPH-BAS-006)',
			why: "Proves BOTH of O-3's arrangements are asserted on the finding code the promotion gate emits for this exact ground, not on the bare fact that a promotion was refused. A promotion is refusable on ten enumerated grounds; O-3 asserts the WHOLE message twice, so a substituted code reddens it. `EXPIRED_REQUIRED_WAIVER` is chosen from `BaselinePromotionFindingCode` so the mutant TYPE-CHECKS — an invented code would not, and a mutant that breaks the build reddens everything. IT MUST NOT REACH O-4, and that is why O-4 asserts its refused half on `status` alone and leaves the message to O-3: the two arrangements are byte-identical, so a message assertion in both tests would give this mutant two victims and prove neither (SL-3a). This is the site and marker the register files under RPH-BAS-006 (`refusalMarker: 'NO_EFFECTIVE_PROMOTION_DECISION'`), which is the rule O-3 now cites."
		},
		{
			id: 'CLS-PD-M4',
			file: 'packages/rph-domain/src/governance.ts',
			find: '\t\td.authorityHeld &&',
			replace: '\t\t!d.authorityHeld &&',
			expectRed: ['O-4'],
			predictedMessage:
				'once an authorized human has decided, the SAME promotion must be ACCEPTED — which is what proves O-3 was refused for the missing approval and for nothing else in the arrangement',
			why: "Proves the positive control is load-bearing: neutralise the AUTHORITY limb of the promotion gate and the human-approved promotion stops being accepted. It cannot redden O-3, whose two decisions are BOTH still PROPOSED — `d.status === 'EFFECTIVE'` short-circuits ahead of this limb, so both of that test's whole-message assertions are unchanged. Nor can it redden O-4's REFUSED half, for the same reason; only O-4's ACCEPTED half moves. LOCATOR, CORRECTED: the two-tab prefix is what makes the anchor unique, because the kernel predicate `isEffectiveApproval` contains the same expression inline at packages/rph-domain/src/governance.ts:71 — ~305 lines EARLIER than this anchor at :376, not fifty. The occurrence counts quoted before were right: 2 for the bare substring, 1 with the two-tab indent."
		},
		{
			id: 'CLS-PD-M5',
			file: 'packages/rph-assurance/src/assurance-rules.ts',
			find: "return differs('agentId') ? { independent: true } : fail('same agent identity');",
			replace: 'return { independent: true };',
			expectRed: ['O-5'],
			predictedMessage:
				'the actor that produced the work must not be able to assure it under a DIFFERENT_AGENT policy — the assessment is blocked in INDEPENDENCE_VIOLATION and never reaches a disposition (RPH-ASR-003)',
			why: "Proves O-5 rests on the DIFFERENT_AGENT rung of `checkIndependence` and not on some other property of the completion. It cannot touch O-1..O-4: their assessment is completed through the shared `assess()` helper, which supplies no `producer`, and the independence gate does not run at all without one — driven and recorded in the note above `throughRecommendation`."
		},
		{
			id: 'CLS-PD-M6',
			file: 'packages/rph-assurance/src/assurance-rules.ts',
			find: "return differs('agentId') ? { independent: true } : fail('same agent identity');",
			replace: "return fail('same agent identity');",
			expectRed: ['O-6'],
			predictedMessage:
				'an INDEPENDENT evaluator must reach the disposition the same completion was blocked from reaching — the block was the identity, not the act of naming a producer and an evaluator',
			why: "THE CONTROL'S OWN MUTANT, and the one that keeps O-5 from being an arrangement that cannot discriminate. O-5 and O-6 differ in EXACTLY ONE FACT — the evaluator — so without a mutant that makes the independent case fail while the same-agent case still reports `same agent identity`, the pair could be passing for a reason unrelated to identity. Same anchor as M5, opposite direction: the driver applies each alone, and the anchor occurs once (measured)."
		}
	]
};

// ── THE CAST ─────────────────────────────────────────────────────────────────────────────────────────────────
//
// ⚠ THE SHARED FIXTURE CANNOT SUPPLY THIS AND MUST NOT BE MADE TO. `beginJourney` builds ONE directory holding
// ONE principal, and this class is unprovable with one: with a single actor, "this actor may not do this" has
// nothing to contrast against and every refusal is the only refusal available. `testDirectory` from
// `@janumipwb/rph-ports/testing` exists precisely for "the few tests that legitimately dispatch AS MORE THAN ONE
// ACTOR", and its own header states the property that keeps it honest — the caller may SELECT among principals
// the fixture registered up front, and cannot INVENT one at dispatch time. So the cast is declared here, in this
// file, and the shared fixture is left alone.
//
// `owner-1` is the SAME identity `JOURNEY_ACTOR` names, re-registered in this file's directory, so every shared
// arrangement helper below (`seedIntentAndArchitecture`, `executeWork`, `assess`) records true facts: the
// `producedBy` those helpers write is the principal that actually issued the commands. Had the agent driven the
// work, the evidence would have recorded a producer that did not produce it, which is the fabrication `SL-7`
// forbids — and `proposeEvidence` would not have caught it, because `producedBy` is copied from the payload with
// no reference to the issuer.
const OWNER = { ...JOURNEY_ACTOR, tenantId: 'tenant-test', organizationId: 'org-test' };

/**
 * The Product Owner agent — the actor `RPH-GOV-002` names by role.
 *
 * ⚠ `modelId` AND `providerId` ARE INERT ON EVERY PATH THIS SLICE DRIVES, AND THEY ARE KEPT ANYWAY. An earlier
 * revision of this comment claimed they were carried "because the independence ladder compares them" and that
 * without them the `DIFFERENT_AGENT` rung would "refuse by default". BOTH HALVES WERE FALSE, and the correction
 * is the seam worth recording:
 *
 *   - The `DIFFERENT_AGENT` rung compares `agentId` ALONE — `packages/rph-assurance/src/assurance-rules.ts`,
 *     `return differs('agentId') ? { independent: true } : fail('same agent identity')` — and `agentId` is never
 *     absent, because `actorReferenceToIdentity` maps it from `actorId`. Nothing refuses by default.
 *   - MORE DECISIVELY, THE LADDER NEVER SEES A `Principal` ON THIS PATH AT ALL. `completeAssuranceAssessment`
 *     takes both operands from the COMMAND PAYLOAD — the evaluator from
 *     `validatorResult.executionProvenance.evaluator` and the producer from `producer` — and each is a bare
 *     ratified `ActorReference` (`AGENT_REF`/`OWNER_REF` below: `actorId`, `actorType`, `displayName`). The
 *     Principal's `modelId`/`providerId` DO ride onto `issuedBy` (command-bus.ts, `stampOrRefuse`), and nothing
 *     on the independence path reads `issuedBy`.
 *   - DRIVEN, NOT REASONED: both fields were deleted from this literal and all six tests stayed GREEN.
 *
 * They are kept because `Principal` declares them for AGENT actors and an AGENT principal that omits them is not
 * the thing this Slice is about; and because keeping them makes the seam CONCRETE — the acting principal carries
 * the ladder's own dimensions and the ladder still does not consult it. The one production caller that WOULD
 * compare them is `packages/rph-assurance/src/floor.ts`'s `checkIndependence` call, whose operands come from a
 * floor plan rather than from a Principal either, and this Slice does not drive the floor. `assessWithEvaluator`'s
 * note records the consequence: the independence check compares two facts the CALLER asserts.
 */
const AGENT = {
	actorId: 'po-agent-1',
	actorType: 'AGENT' as const,
	displayName: 'Product Owner Agent',
	tenantId: 'tenant-test',
	organizationId: 'org-test',
	modelId: 'test-model',
	providerId: 'test-provider'
};

/** The wire `ActorReference` form of each principal — what a Decision's `authority` and a verdict's evaluator take. */
const OWNER_REF = { actorId: OWNER.actorId, actorType: 'HUMAN' as const, displayName: OWNER.displayName };
const AGENT_REF = { actorId: AGENT.actorId, actorType: 'AGENT' as const, displayName: AGENT.displayName };

const DIR = testDirectory([OWNER, AGENT]);

/**
 * A credential this file's directory does not resolve.
 *
 * ⚠ IT MUST STAY UNREGISTERED, and it must be a literal rather than `DIR.credentialFor(...)` — `credentialFor`
 * THROWS on an unregistered actor, by design, so the "nobody is logged in" session cannot be obtained through it.
 * `UNKNOWN_CRED` from the shared testing module would serve too; a local literal keeps the refusal this Slice
 * depends on inside the file that depends on it.
 */
const NO_CREDENTIAL = 'no-such-credential' as Credential;

/** The two refusal markers this Slice tells apart. Both are the LIVE strings, copied from what was driven. */
const AUTHORITY_MARKER = 'actor lacks sufficient authority to make this decision effective';
const AUTHENTICATION_MARKER = 'could not be established from authenticated context';

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5P00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5P10';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5P20';
const EVIDENCE = 'evd_01ARZ3NDEKTSV4RRFFQ69G5P30';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5P40';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5P50';
const ATTEMPT = 'att_01ARZ3NDEKTSV4RRFFQ69G5P60';
const ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5P70';
const BASELINE = 'base_01ARZ3NDEKTSV4RRFFQ69G5P80';
/** The agent's RECOMMENDATION — a Decision that reaches PROPOSED and, in this journey, goes no further. */
const RECOMMENDATION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5P90';
/** The Owner's OWN decision, proposed after the recommendation cannot be adopted. See `O-3` and `O-4`. */
const OWNER_DECISION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5PA0';

interface Cast {
	/** The Undertaking Owner: a HUMAN, and the only principal here that can make a decision effective. */
	readonly owner: Journey;
	/** The Product Owner agent: may propose, may evaluate, may not approve. */
	readonly agent: Journey;
	/** A session whose credential resolves to nothing. The CONTROL mechanism's only driver. */
	readonly anonymous: Journey;
}

/**
 * Three `Journey` views onto ONE engine and ONE store, differing only in the credential presented.
 *
 * ⚠ ONE COMMAND COUNTER ACROSS ALL THREE, NOT ONE PER SESSION. `idempotencyKey` is claimed per key in the store,
 * and the bus returns the PRIOR RESULT for a repeat key without re-running the handler. Three independent
 * counters would mint `pd-idem-34` three times, and the second and third dispatches — the ones this Slice's
 * discrimination depends on — would return the FIRST one's outcome. The refusals would then agree because they
 * were the same refusal, which is precisely the shape of "a control that fails like its subject".
 *
 * `send` is fail-loud and `attempt` is not, exactly as the shared fixture defines them: an arrangement step that
 * failed silently would leave a test asserting a true thing about a world it never built.
 */
function beginCast(): Cast {
	const store = new SqliteStorageAdapter({ now: () => JOURNEY_TS });
	let eventSeq = 0;
	const engine = createEngine({
		authenticate: DIR.authenticate,
		ontology,
		store,
		now: () => JOURNEY_TS,
		newEventId: () => `evt_${++eventSeq}`
	});

	let commandSeq = 0;
	const command = (
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	): DomainCommand => {
		commandSeq += 1;
		return {
			commandId: `pd-cmd-${commandSeq}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: JOURNEY_TS,
			correlationId: 'slice-permission-denied',
			idempotencyKey: `pd-idem-${commandSeq}`,
			payload
		};
	};

	const session = (handle: AuthedEngineHandle): Journey => {
		const attempt: Journey['attempt'] = (t, at, ai, p) => handle.dispatch(command(t, at, ai, p));
		return {
			engine: handle,
			store,
			attempt,
			send: (t, at, ai, p) => {
				const result = attempt(t, at, ai, p);
				if (result.status !== 'ACCEPTED' && result.status !== 'DUPLICATE')
					throw new Error(
						`permission-denied slice failed at #${commandSeq} ${t} (${ai}): ${result.status} ${JSON.stringify(result.error)}`
					);
			},
			state: (id) => handle.loadObject(id)?.state as Record<string, unknown> | undefined
		};
	};

	return {
		owner: session(engine.as(DIR.credentialFor(OWNER.actorId))),
		agent: session(engine.as(DIR.credentialFor(AGENT.actorId))),
		anonymous: session(engine.as(NO_CREDENTIAL))
	};
}

/** The prefix both threads share: a governing policy, an approved intent, an architecture PWU, and work that ran. */
function throughExecutedWork(): Cast {
	const cast = beginCast();
	// `independenceRequirement` is left at the fixture's default `DIFFERENT_AGENT`, which mirrors the ratified
	// `pol_architecture_coverage`. That default is what `O-5` and `O-6` turn on, and the fixture's own header
	// warns that NONE must never become the default — so this Slice states the reliance rather than assuming it.
	seedJourneyPolicy(cast.owner);
	seedIntentAndArchitecture(cast.owner, { intentId: INTENT, pwuId: PWU });
	executeWork(cast.owner, {
		pwuId: PWU,
		planId: PLAN,
		stepId: STEP,
		attemptId: ATTEMPT,
		claimId: CLAIM,
		evidenceId: EVIDENCE
	});
	return cast;
}

/**
 * The governance thread, driven to the moment the agent's recommendation stands and nothing has approved it.
 *
 * ⚠ THE ASSESSMENT HERE IS COMPLETED THROUGH THE SHARED `assess()` HELPER, WHICH SUPPLIES NO `producer`, SO THE
 * INDEPENDENCE GATE DOES NOT RUN ON IT. That is DISCLOSED rather than arranged away, and it is measured: the
 * assessment object this helper produces has `producer: undefined`, and `completeAssuranceAssessment` runs
 * `checkIndependence` only when the requirement resolves, is not NONE, AND BOTH OPERANDS ARE PRESENT — its own
 * comment calls the fall-through "recorded, never a fabricated pass".
 *
 * It is also WHY THE TWO THREADS ARE SEPARATE ARRANGEMENTS. Were the independence gate live on this assessment,
 * `CLS-PD-M6` would redden both `O-4` and `O-6` — a mutant with two victims proves neither (`SL-3a`), and the
 * enforcement register makes exactly that argument for keeping `RPH-GOV-001` and `RPH-GOV-002` on separate rows.
 * The independence claim is driven in `O-5`/`O-6`, where the producer IS supplied.
 */
function throughRecommendation(): Cast {
	const cast = throughExecutedWork();
	assess(cast.owner, { assessmentId: ASSESSMENT, pwuId: PWU, disposition: 'SATISFIED' });

	// Carry the verdict onto the work. FIVE HOPS, and both machines are why: `assuranceState` has no
	// UNASSESSED -> ASSESSING arrow, and `workLifecycleState` has no EXECUTING -> UNDER_ASSURANCE arrow. The
	// cross-axis guard on UNDER_ASSURANCE -> SATISFIED then requires `assuranceState` to already read SATISFIED,
	// which is property P1 and is why the assurance axis moves first.
	const hop = (previousState: string, newState: string, assuranceState: string): void =>
		changeState(cast.owner, PWU, {
			previousState,
			newState,
			executionState: 'SUCCEEDED',
			assuranceState,
			supportingObjectIds: [ASSESSMENT]
		});
	hop('EXECUTING', 'EVIDENCE_PENDING', 'EVIDENCE_REQUIRED');
	hop('EVIDENCE_PENDING', 'EVIDENCE_PENDING', 'READY_FOR_ASSESSMENT');
	hop('EVIDENCE_PENDING', 'UNDER_ASSURANCE', 'ASSESSING');
	hop('UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SATISFIED');
	hop('UNDER_ASSURANCE', 'SATISFIED', 'SATISFIED');

	cast.owner.send('CreateBaseline', 'BASELINE', BASELINE, {
		baselineType: 'ARCHITECTURE',
		itemObjectIds: [PWU],
		assuranceAssessmentIds: [ASSESSMENT]
	});
	cast.owner.send('SubmitBaselineForReview', 'BASELINE', BASELINE, {});
	cast.owner.send('ApproveBaseline', 'BASELINE', BASELINE, {});

	// ⚠ THE AGENT PROPOSES, AND IT IS ACCEPTED. That acceptance is not a hole — it is the first half of
	// `RPH-GOV-002`, which PERMITS an agent to recommend. `proposeDecision` applies NO CHECK ON THE RANK of the
	// proposing actor: an AGENT is admitted here exactly as a HUMAN is.
	//
	// ⚠ IT IS NOT CHECK-FREE, AND AN EARLIER REVISION OF THIS FILE SAID IT WAS. "`proposeDecision` applies no
	// authority check at all" was inherited verbatim from the register's `RPH-GOV-002` row and is false as
	// written: REG-F-014 added an IDENTITY check, and `proposeDecision` refuses with
	// `RPH_AUTHORITY_INSUFFICIENT` when the declared `authority` is not the issuing actor
	// (packages/rph-application/src/handlers/governance.ts). So the agent must record ITSELF. It cannot name the
	// Owner and then act as the Owner, and the register records that this exact forgery was live for four
	// commits. The class argument survives unchanged — the agent named itself, so nothing here is a malformed or
	// mis-stated payload — but the sibling `RPH-GOV-001` row already carries the 2026-08-03 correction, and this
	// file now carries it too.
	cast.agent.send('ProposeDecision', 'DECISION', RECOMMENDATION, {
		decisionType: 'PROMOTE_BASELINE',
		subjectObjectIds: [PWU, BASELINE],
		selectedOption: 'promote',
		rationale: 'assurance found the architecture satisfied; it is ready to baseline',
		authority: AGENT_REF
	});
	return cast;
}

/** The approval payload, byte-identical wherever it is issued from. The only variable is WHO issues it. */
const APPROVAL = {
	selectedOption: 'promote',
	rationale: 'assurance found the architecture satisfied; it is ready to baseline',
	consideredEvidenceIds: [],
	consideredObservationIds: [],
	subjectSemanticVersions: {}
};

/**
 * The promotion payload, minted from ONE literal so that "the same promotion" is a code fact rather than a claim
 * about two hand-copied object literals that can drift apart silently. `promotionDecisionId` is the ONLY field
 * that ever varies, and `O-4` varies not even that — it promotes the SAME decision id twice, before and after
 * approval, so the single fact separating its two worlds is the decision's `status`.
 */
const promotionCiting = (promotionDecisionId: string) => ({
	promotionDecisionId,
	expectedItemObjectVersions: [{ objectId: PWU, semanticVersion: 1 }],
	requiredAssessmentIds: [ASSESSMENT]
});

/**
 * The Owner's own PROMOTE_BASELINE decision, proposed in its own name and NOT approved.
 *
 * Every conjunct of the promotion gate's `decisionOk` holds for it EXCEPT `status === 'EFFECTIVE'`: its recorded
 * authority is a HUMAN (so `authorityHeld` is true), its `decisionType` is PROMOTE_BASELINE, and it names this
 * baseline among its subjects (so `PROMOTION_DECISION_OUT_OF_SCOPE` cannot fire either). That single-defect
 * property is what `O-3`'s second arrangement and `O-4`'s first world both depend on.
 */
function ownerProposesItsOwnDecision(cast: Cast): void {
	cast.owner.send('ProposeDecision', 'DECISION', OWNER_DECISION, {
		decisionType: 'PROMOTE_BASELINE',
		subjectObjectIds: [PWU, BASELINE],
		selectedOption: 'promote',
		rationale: 'assurance found the architecture satisfied; it is ready to baseline',
		authority: OWNER_REF
	});
}

/**
 * Request, begin and complete ONE assessment over the architecture, naming `evaluator` as the actor that judged
 * it and the Owner as the actor that produced it.
 *
 * ⚠ `producer: OWNER_REF` IS A TRUE STATEMENT ABOUT THIS JOURNEY, NOT A CONVENIENT ONE. `executeWork` records
 * `producedBy: JOURNEY_ACTOR` on the evidence, and `owner-1` is the principal that issued every one of those
 * commands. ⚠ AND THE ENGINE DOES NOT CHECK IT: `completeAssuranceAssessment` takes the producer from THIS
 * PAYLOAD and the evaluator from `validatorResult.executionProvenance.evaluator` — the handler's own comment
 * calls the latter "smuggled", because `selectAssuranceEvaluator` exists and this path does not read it. So the
 * independence check compares two facts the CALLER asserts. That is a disclosed seam, and a later reader must
 * not conclude from `O-5` that the engine can detect a caller who misdeclares its own producer.
 */
function assessWithEvaluator(cast: Cast, evaluator: typeof OWNER_REF | typeof AGENT_REF): void {
	cast.owner.send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
		assessmentId: ASSESSMENT,
		assurancePolicyId: JOURNEY_POLICY,
		policyVersion: '1.0.0',
		subjectObjectIds: [PWU],
		subjectSemanticVersions: { [PWU]: 1 },
		claimIds: [CLAIM]
	});
	cast.owner.send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {});
	cast.owner.send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
		validatorResult: {
			...verdict({
				assessmentId: ASSESSMENT,
				subjectId: PWU,
				subjectSemanticVersion: 1,
				disposition: 'SATISFIED'
			}),
			executionProvenance: { evaluator }
		},
		producer: OWNER_REF
	});
}

describe('SLICE CLS-PERMISSION-DENIED — an agent may recommend, and may not approve', () => {
	// ── RPH-GOV-001 ──────────────────────────────────────────────────────────────────────────────────────────
	// Ratified statement, verbatim (`m12-conformance.json`, §15):
	//   "An agent without approval authority issuing ApproveDecision is rejected with RPH_AUTHORITY_INSUFFICIENT."
	//
	// ⚠ TWO ISSUERS IN ONE TEST, AND THAT IS THE CLAIM RATHER THAN A CONVENIENCE. The ratified sentence describes
	// the AGENT issuing the command, and that is driven first. But the guard does not read the issuer at all — it
	// reads the RECORDED `authority` on the Decision — so the OWNER, a HUMAN who unquestionably holds approval
	// authority, is refused the same way with the same message. That is NOT a discovery of this Slice: the
	// enforcement register's `RPH-GOV-001` row states it in capitals ("THE SUBJECT IS THE RECORDED AUTHORITY, NOT
	// THE ISSUER of the command"). What this Slice adds is that it is true END TO END, on a live journey, and what
	// it means professionally: an agent's recommendation is a DEAD-END OBJECT. No authorized actor can adopt it.
	// The authorized actor must propose again in its own name, which is what `O-3` and `O-4` then have to do.
	//
	// They are one test because they are one guard. Splitting them would give `CLS-PD-M1` two victims and prove
	// neither of them (`SL-3a`).
	//
	// ⚠ BOTH ISSUERS ARE NOW DISCRIMINATED IN BOTH DIRECTIONS. The second issuer previously asserted only that the
	// message CONTAINED the authority marker. Containing it does exclude the authentication mechanism today — the
	// two strings are disjoint — but only for as long as they stay disjoint, and the whole point of this Slice is
	// that the day they converge must be a red test rather than a silent one. So the owner's refusal now carries
	// the code and the absence assertion that the agent's already did.
	it('O-1 — ApproveDecision on the agent\'s recommendation is refused for INSUFFICIENT AUTHORITY, whoever issues it: the guard reads the decision\'s RECORDED authority, not the issuer', () => {
		const cast = throughRecommendation();

		const bySelf = cast.agent.attempt('ApproveDecision', 'DECISION', RECOMMENDATION, APPROVAL);
		expect(
			bySelf.status,
			'⚠ THIS ASSERTION CANNOT DISCRIMINATE, AND IS HERE TO ESTABLISH THAT: the agent approving its own recommendation must be refused, but O-2 produces the SAME status from an entirely different mechanism — RPH-GOV-001, the arrangement its statement names'
		).toBe('UNAUTHORIZED');
		// The CODE is asserted because the ratified sentence names it. It is NOT the discriminator, and the note
		// at the top of this file says why: `RPH_AUTHENTICATION_REQUIRED` reaches the same status through an
		// entirely different mechanism, and a code is one rename from proving nothing.
		expect(bySelf.error?.code, 'and refused with the code the ratified sentence names').toBe(
			'RPH_AUTHORITY_INSUFFICIENT'
		);
		expect(
			bySelf.error?.message,
			'the refusal must say the ACTOR LACKS AUTHORITY — this is the mechanism, and the message is the only place it is stated'
		).toContain(AUTHORITY_MARKER);
		expect(
			bySelf.error?.message,
			'and it must NOT be the authentication refusal: a principal WAS established here, and "nobody is logged in" is a different professional fact at the same status'
		).not.toContain(AUTHENTICATION_MARKER);

		// The same act, from the one actor in this journey that holds approval authority.
		const byOwner = cast.owner.attempt('ApproveDecision', 'DECISION', RECOMMENDATION, APPROVAL);
		expect(
			byOwner.error?.code,
			'the AUTHORIZED HUMAN is refused on the same code — the guard reads the authority the DECISION records, not the standing of the actor at the keyboard'
		).toBe('RPH_AUTHORITY_INSUFFICIENT');
		expect(
			byOwner.error?.message,
			'and the AUTHORIZED HUMAN is refused identically — so the agent\'s recommendation cannot be adopted by anyone; it can only be re-proposed (see O-3 and O-4)'
		).toContain(AUTHORITY_MARKER);
		expect(
			byOwner.error?.message,
			'and this refusal too is NOT the authentication one: the owner is logged in, and the day these two messages converge this Slice must go red rather than quietly stop discriminating'
		).not.toContain(AUTHENTICATION_MARKER);
		expect(
			(cast.owner.state(RECOMMENDATION) ?? {}).status,
			'and after both attempts the recommendation is still only PROPOSED — no approval got through by either route'
		).toBe('PROPOSED');
		// ⚠ §35.5 IS QUOTED, NOT PARAPHRASED. Its ratified text reads, entire: "An approval command without
		// sufficient authority must be rejected before producing `DecisionEffective`." (`docs/Recursive
		// Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Command, Event,
		// Schema Contract Package.md`, §35.5.) An earlier revision of this comment presented "BEFORE ANY EFFECTIVE
		// EVENT" as the ratified wording; the section number and the substance were right and the quotation was
		// not.
		//
		// IT IS ASSERTED HERE RATHER THAN IN `O-3` ON PURPOSE. In THIS arrangement two approvals were actually
		// dispatched, so an empty stream is a falsifiable claim — neutralise the guard and the events appear.
		// Asserted in a test that never attempts an approval it would be empty in every world, which is the
		// "assertion that cannot fail" this programme has recorded by name.
		expect(
			cast.owner.engine
				.readAllEvents()
				.filter((e) => e.eventType === 'DecisionEffective' && e.aggregateId === RECOMMENDATION),
			'and NO DecisionEffective was emitted by either attempt — the approval commands were "rejected before producing DecisionEffective", which is what §35.5 requires of them'
		).toEqual([]);
	});

	// ── THE CONTROL, AND THE REASON THIS SLICE CAN BE BELIEVED ───────────────────────────────────────────────
	//
	// ⚠ WITHOUT THIS TEST, `O-1` IS AN ASSERTION THAT COULD NOT TELL ITS OWN SUBJECT FROM ITS NEIGHBOUR. The same
	// command, the same aggregate, the same payload — dispatched from a session whose credential resolves to
	// nothing — comes back at the SAME `status: 'UNAUTHORIZED'`, and the professional fact is completely
	// different: not "this actor may not do this" but "there is no actor". The two are told apart HERE, by
	// asserting the message that belongs to this mechanism and the ABSENCE of the marker that belongs to the
	// other. Neither assertion is vacuous: the first fails if the bus refuses for any other reason, the second
	// fails the day the two messages converge.
	//
	// ⚠ AND IT HAS ITS OWN MUTANT (`CLS-PD-M2`). A control that cannot redden is a control that certifies nothing
	// — this repository shipped three of those green before the rule was written down.
	it('O-2 (CONTROL) — the identical act with NO established principal is ALSO UNAUTHORIZED, and only the MESSAGE separates "nobody is logged in" from "this actor may not"', () => {
		const cast = throughRecommendation();

		const byNobody = cast.anonymous.attempt('ApproveDecision', 'DECISION', RECOMMENDATION, APPROVAL);
		expect(
			byNobody.status,
			'⚠ THIS ASSERTION CANNOT DISCRIMINATE EITHER, AND THAT IS THE HAZARD THIS CONTROL EXISTS TO EXPOSE: the status is identical to O-1\'s and carries none of the professional fact'
		).toBe('UNAUTHORIZED');
		expect(
			byNobody.error?.code,
			'but the CODE is the bus\'s, not a handler\'s: the principal could not be established, so no handler ever ran'
		).toBe('RPH_AUTHENTICATION_REQUIRED');
		expect(
			byNobody.error?.message,
			'and the message must say the PRINCIPAL COULD NOT BE ESTABLISHED — the refusal happens before any effect, and before any question of authority arises'
		).toContain(AUTHENTICATION_MARKER);
		expect(
			byNobody.error?.message,
			'and must NOT claim insufficient authority: nobody was identified, so nobody\'s authority was weighed. A Slice that could not separate these two would be reporting an unauthenticated caller as an unauthorized one.'
		).not.toContain(AUTHORITY_MARKER);
		expect(
			(cast.owner.state(RECOMMENDATION) ?? {}).status,
			'and the refusal is before any effect: the decision is untouched'
		).toBe('PROPOSED');
	});

	// ── RPH-BAS-006, ON ITS CONSEQUENT ───────────────────────────────────────────────────────────────────────
	// Ratified statement, verbatim (`m12-conformance.json`, §16):
	//   "Committing source or architecture artifacts to version control makes no baseline authoritative without a
	//    promotion decision and assurance (commit is not baseline)."
	//
	// ⚠ WHICH RULE THIS TEST BELONGS TO WAS WRONG UNTIL THIS REVISION, AND THE CORRECTION IS THE POINT. This test
	// asserts, whole, `Cannot promote baseline <id>: NO_EFFECTIVE_PROMOTION_DECISION`. THAT IS `RPH-BAS-006`'s
	// REGISTERED ENFORCEMENT SITE AND ITS REGISTERED MARKER, not `RPH-GOV-002`'s:
	//   - `packages/rph-domain/src/enforcement-register.ts`, row `RPH-BAS-006`, `kind: 'ENFORCED'`, `enforcedAt`
	//     "canPromoteBaseline's NO_EFFECTIVE_PROMOTION_DECISION arm ... ENFORCEMENT: promoteBaseline's guard",
	//     `refusalMarker: 'NO_EFFECTIVE_PROMOTION_DECISION'`;
	//   - the kernel's own comment at that arm reads "Effective, authorized promotion decision (RPH-BAS-006,
	//     §23.2)";
	//   - and `CLS-PD-M3` mutates that arm, a variant of the register's own second declared mutation for the row.
	// The earlier revision cited `RPH-GOV-002` here and never named `RPH-BAS-006` at all; `grep -n 'RPH-BAS'` over
	// this file returned nothing.
	//
	// ⚠ AND `RPH-GOV-002` IS NOT MERELY UNDER-DISCLOSED HERE — IT IS UNASSERTABLE HERE, WHICH IS WHAT THE SECOND
	// ARRANGEMENT BELOW DRIVES. `decisionOk` is a four-way conjunction and the agent's recommendation fails TWO
	// limbs independently: PROPOSED (not EFFECTIVE), and an AGENT authority where `authorityHeld` requires HUMAN.
	// An arrangement that trips two conjuncts proves neither. `RPH-GOV-002`'s consequent is the EFFECTIVENESS
	// limb, so this refusal is exactly what a GOV-002-FALSE world would also produce. The second arrangement
	// makes that concrete rather than argued: it promotes on a decision whose authority IS a HUMAN and whose ONLY
	// unmet conjunct is that it is still PROPOSED, and the engine returns THE SAME WHOLE MESSAGE. A message that
	// is invariant across "an agent recommended it" and "a human proposed it" is not evidence about agents.
	//
	// ⚠ THE WHOLE MESSAGE IS ASSERTED, NOT A SUBSTRING OF IT, AND THAT IS DELIBERATE. `canPromoteBaseline` can
	// refuse on ten enumerated grounds and joins every finding it makes into one string. An arrangement that
	// tripped two of them would prove neither. Asserting the message ENTIRE proves each arrangement is complete
	// in every other respect — satisfied assessment, no open blocking finding, current item versions, an APPROVED
	// baseline, a decision that names this baseline among its subjects — and that the ONE thing missing is an
	// EFFECTIVE decision. `O-4` then closes the loop by supplying exactly that one thing and nothing else.
	//
	// ⚠ THE RULE'S ANTECEDENT IS NOT ASSERTED AND CANNOT BE (`SL-2`): nothing in this engine commits anything to
	// version control, so no dispatch can enter the rule from that direction. The register's own row records the
	// same absence as its third declared mutation and files the row ENFORCED on the consequent. Stated here so
	// the citation is read at its true width.
	it('O-3 — a decision that is not EFFECTIVE authorizes no promotion, and the refusal says that and nothing else — identically for an agent\'s recommendation and for a human\'s unapproved proposal', () => {
		const cast = throughRecommendation();

		// The PREMISE, stated so the refusal below is read against the right world. ⚠ THE FIRST OF THESE IS NOT
		// LOAD-BEARING AND IS NOT PRETENDED TO BE: no act in this test could have moved the decision, so it holds
		// in every world this arrangement can reach. The falsifiable form of "nothing approved it" lives in `O-1`,
		// where approvals are actually attempted. The SECOND is load-bearing — `proposeDecision` could have
		// laundered the recorded authority into the human the agent named, and the register says it did exactly
		// that for four commits (REG-F-014).
		expect(
			(cast.owner.state(RECOMMENDATION) ?? {}).status,
			'PREMISE: the recommendation exists and is recorded — an agent MAY recommend, which is what RPH-GOV-002 permits'
		).toBe('PROPOSED');
		expect(
			(cast.owner.state(RECOMMENDATION) ?? {}).authority,
			'and it records the AGENT as its authority, so the record says who recommended rather than laundering it into a human'
		).toEqual(AGENT_REF);

		const onRecommendation = cast.owner.attempt(
			'PromoteBaseline',
			'BASELINE',
			BASELINE,
			promotionCiting(RECOMMENDATION)
		);
		expect(
			onRecommendation.status,
			'the promotion resting on the agent\'s recommendation must be refused'
		).toBe('REJECTED');
		expect(
			onRecommendation.error?.message,
			'and refused for the missing effective decision ALONE — the message is asserted entire so that a second, unrelated ground could not be mistaken for this one'
		).toBe(`Cannot promote baseline ${BASELINE}: NO_EFFECTIVE_PROMOTION_DECISION`);

		// ── THE SAME REFUSAL WITH THE AGENT TAKEN OUT OF THE ARRANGEMENT ─────────────────────────────────────
		// A HUMAN's own PROMOTE_BASELINE decision, proposed in its own name and never approved: `authorityHeld` is
		// TRUE for it, `decisionType` is right, and it names this baseline among its subjects — so the ONLY unmet
		// conjunct is `status === 'EFFECTIVE'`. If the message below is byte-identical to the one above, then the
		// message cannot be reporting anything about WHO authored the decision, and the citation this test used to
		// carry (`RPH-GOV-002`, "a Product Owner AGENT recommending approval creates no effective governance
		// decision") has no evidence here. It is identical, and that is why the id was removed from `citedRules`.
		ownerProposesItsOwnDecision(cast);
		const onUnapprovedHumanProposal = cast.owner.attempt(
			'PromoteBaseline',
			'BASELINE',
			BASELINE,
			promotionCiting(OWNER_DECISION)
		);
		expect(
			onUnapprovedHumanProposal.error?.message,
			'the SAME whole message, with no agent anywhere in the arrangement — so it names EFFECTIVENESS, which is RPH-BAS-006\'s conjunct, and says nothing at all about who authored the decision'
		).toBe(`Cannot promote baseline ${BASELINE}: NO_EFFECTIVE_PROMOTION_DECISION`);
		expect(
			(cast.owner.state(BASELINE) ?? {}).status,
			'and neither refusal moved the baseline: it is still APPROVED, awaiting an effective decision'
		).toBe('APPROVED');
	});

	// ── RPH-BAS-006's POSITIVE CONTROL ──────────────────────────────────────────────────────────────────────
	//
	// ⚠ WITHOUT THIS, `O-3` IS AN ASSERTION THAT COULD NOT FAIL FOR THE RIGHT REASON. A refusal proves the
	// promotion did not happen; it does not prove WHY, and an arrangement that was broken in some unrelated way
	// would refuse just as loudly.
	//
	// ⚠ ONE FACT CHANGES, AND IT IS NOW LITERALLY ONE. An earlier revision claimed "the identical promotion" and
	// "ONE FACT CHANGES BETWEEN THE TWO WORLDS" while comparing a promotion citing the agent's RECOMMENDATION
	// against one citing the owner's OWN decision — two different objects, differing in identity, recorded
	// authority AND status. The claim is now true as written: this test promotes THE SAME DECISION ID TWICE,
	// through `promotionCiting(OWNER_DECISION)` minted from one literal, before and after `ApproveDecision`. The
	// only fact that differs between the two dispatches is the decision's `status`.
	//
	// ⚠ THE REFUSED HALF ASSERTS ITS STATUS AND NOT ITS MESSAGE, ON PURPOSE. That arrangement's whole message is
	// asserted in `O-3`, whose second half is byte-identical to this one. Asserting it here too would give
	// `CLS-PD-M3` a second victim and prove neither clause (`SL-3a`), so the message claim is made once, in the
	// test that owns the mutant.
	//
	// ⚠ AND NOTE WHAT THE AUTHORIZED ACTOR HAS TO DO. It cannot approve the agent's recommendation — `O-1` drove
	// that and it is refused. It must PROPOSE AGAIN in its own name. So `RPH-GOV-002`'s ratified "until an
	// authorized actor approves it" is satisfied in this engine only in the form "until an authorized actor
	// decides for itself"; the recommendation informs that decision and is never adopted by it. Recorded rather
	// than smoothed over: a reader must not take this green as evidence that an agent's proposal can be
	// countersigned. It is also a second reason `RPH-GOV-002` is not cited — the rule's "until" clause names an
	// act this engine cannot perform on an agent's recommendation at all.
	it('O-4 (CONTROL for O-3) — the SAME promotion, on the SAME decision id, is refused while it is PROPOSED and ACCEPTED once it is EFFECTIVE: the decision\'s status is the only fact that moves', () => {
		const cast = throughRecommendation();
		ownerProposesItsOwnDecision(cast);

		const whileProposed = cast.owner.attempt(
			'PromoteBaseline',
			'BASELINE',
			BASELINE,
			promotionCiting(OWNER_DECISION)
		);
		expect(
			whileProposed.status,
			'WORLD 1: the authorized human has decided nothing yet — its own decision is still PROPOSED, and the promotion is refused (the whole message for this exact arrangement is asserted in O-3)'
		).toBe('REJECTED');
		expect(
			(cast.owner.state(BASELINE) ?? {}).status,
			'and the baseline is untouched by the refusal'
		).toBe('APPROVED');

		cast.owner.send('ApproveDecision', 'DECISION', OWNER_DECISION, APPROVAL);
		expect(
			(cast.owner.state(OWNER_DECISION) ?? {}).status,
			'THE ONE FACT THAT CHANGES: the authorized human\'s own decision reaches EFFECTIVE — the same command that was refused on the agent\'s recommendation in O-1'
		).toBe('EFFECTIVE');

		const whileEffective = cast.owner.attempt(
			'PromoteBaseline',
			'BASELINE',
			BASELINE,
			promotionCiting(OWNER_DECISION)
		);
		expect(
			whileEffective.status,
			'WORLD 2: the byte-identical promotion, on the byte-identical payload, now succeeds — so the refusal in world 1 was the decision\'s status and nothing else about the arrangement'
		).toBe('ACCEPTED');
		expect(
			(cast.owner.state(BASELINE) ?? {}).status,
			'and the baseline is AUTHORITATIVE: the recommendation was never the obstacle, the authority behind it was'
		).toBe('AUTHORITATIVE');
	});

	// ── RPH-ASR-003 ──────────────────────────────────────────────────────────────────────────────────────────
	// Ratified statement, verbatim (`m12-conformance.json`, §14):
	//   "When a policy requires DIFFERENT_AGENT and the same producing agent is selected as validator, evaluation
	//    is blocked, INDEPENDENCE_VIOLATION is recorded, and a different validator or waiver is required."
	//
	// ⚠ THE DISPATCH IS ACCEPTED, AND THAT IS THE RULE WORKING RATHER THAN FAILING. The enforcement register files
	// this row NOT_A_COMMAND_REFUSAL and gives the reason in canon's own words: the violation is "recorded as a
	// first-class OUTCOME". "Evaluation is blocked" is realized as a TERMINAL STATE the machine will not let reach
	// SATISFIED, not as a rejected command. So this is a permission denial that is NOT a refusal — which is
	// exactly why it belongs in this Slice: a reader who thinks `permission-denied path` means "a command comes
	// back rejected" would miss half the class.
	//
	// ── ⚠ THE THIRD CONSEQUENT IS A DISJUNCTION, AND ONLY ONE DISJUNCT IS ASSERTED (`SL-2`) ──────────────────
	// The rule requires "a different validator OR WAIVER". THE VALIDATOR DISJUNCT IS DRIVEN below, and driven
	// harder than the rule states: the blocked assessment is TERMINAL, so a different validator cannot be
	// substituted INTO it — a NEW assessment is required, which is what `O-6` starts.
	//
	// THE WAIVER DISJUNCT IS NOT ASSERTED, AND IT IS NOT ASSERTABLE IN THIS ENGINE. An earlier revision quoted the
	// rule with the disjunct in it and then silently restated the limb as "a different validator is required",
	// which is neither asserting it nor naming it unasserted — the gap `SL-2` exists to forbid. Three independent
	// findings, each read off production source rather than inferred from the one before it:
	//   1. THE GATE TAKES NO WAIVER OPERAND. `completeAssuranceAssessment` calls
	//      `checkIndependence(requirement, actorReferenceToIdentity(producer), actorReferenceToIdentity(evaluator))`
	//      — three operands, none of them a waiver, and no waiver is consulted before it or after it. So a waiver
	//      cannot pre-empt the violation either, not merely fail to clear it.
	//   2. `INDEPENDENCE_VIOLATION` IS A DECLARED TERMINAL STATE of `AssuranceAssessment.state` with NO outbound
	//      arrow (`packages/rph-domain/src/transitions.data.ts` — it is listed in `terminalStates`, and the only
	//      pairing the machine records leaving it is the ILLEGAL `INDEPENDENCE_VIOLATION -> SATISFIED`). So no
	//      waiver could move a blocked assessment even if one were recorded against it.
	//   3. THE TWO KERNEL PREDICATES THAT COULD CARRY IT HAVE NO PRODUCTION CALLER. `isWaiverApplicable`
	//      (`packages/rph-assurance/src/assurance-rules.ts`) is referenced only by its own definition and its unit
	//      test; `waiverCovers` (`packages/rph-domain/src/governance.ts`) lost its last production caller at
	//      REG-F-202, which the register records in its own words.
	// ⚠ THE DISJUNCT IS RATIFIED AND THE MACHINE ITSELF STILL NAMES IT — the illegal arrow's reason reads "Another
	// independent evaluator must be invoked or a waiver obtained first", and the ASSESSING ->
	// INDEPENDENCE_VIOLATION arrow's note repeats it. So this is AN ABSENCE IN THE ENGINE, not an absence in
	// canon, and it is recorded here rather than left for a later reader to mistake for coverage.
	it('O-5 — the actor that PRODUCED the architecture, put forward as its own evaluator under a DIFFERENT_AGENT policy, is blocked: INDEPENDENCE_VIOLATION is recorded and no disposition is ever reached', () => {
		const cast = throughExecutedWork();
		assessWithEvaluator(cast, OWNER_REF);

		const assessment = cast.owner.state(ASSESSMENT) ?? {};
		expect(
			assessment.assessmentState,
			'the assessment lands in the ratified INDEPENDENCE_VIOLATION state — evaluation is BLOCKED, and blocked as a recorded outcome rather than a rejected command'
		).toBe('INDEPENDENCE_VIOLATION');
		// ⚠ THE DISPOSITION IS READ OFF THE EVENT STREAM, NOT OFF THE FIELD THE LINE ABOVE JUST PINNED. An earlier
		// revision asserted `assessmentState).not.toBe('SATISFIED')` here — entailed by the assertion above it,
		// unable to fail while that one passes, and therefore exactly the "assertion that cannot fail" this
		// Slice's own header names as a recorded programme failure. The claim worth making is that the validator
		// ASKED for SATISFIED (`verdict({ disposition: 'SATISFIED' })`, in `assessWithEvaluator`) and the engine
		// recorded NO COMPLETION AT ALL: `AssuranceAssessmentCompleted` is the event that carries a disposition,
		// and this completion emitted `AssuranceIndependenceViolated` INSTEAD of it. Different source, different
		// question — a buggy engine could emit both.
		expect(
			cast.owner.engine
				.readAllEvents()
				.filter((e) => e.eventType === 'AssuranceAssessmentCompleted'),
			'and NO completion was recorded on the governed stream — the validator recommended SATISFIED and INV-8 forecloses it, so the disposition it asked for was never minted as a fact'
		).toEqual([]);
		// Both operands, because a violation whose record names neither cannot answer "producer X vs evaluator Y".
		expect(
			[assessment.producer, assessment.evaluator],
			'and the record names the pair that violated the requirement — the same actor on both sides'
		).toEqual([OWNER_REF, OWNER_REF]);

		const violations = cast.owner.engine
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceIndependenceViolated');
		expect(violations, 'exactly one violation is recorded, on the governed stream').toHaveLength(1);
		expect(
			violations[0]?.payload,
			'and it names the REQUIREMENT that was violated and WHY — not merely that something went wrong'
		).toMatchObject({
			assessmentId: ASSESSMENT,
			independenceRequirement: 'DIFFERENT_AGENT',
			reason: 'same agent identity'
		});

		// The VALIDATOR disjunct of the third consequent, driven: a different validator cannot be swapped into the
		// blocked assessment. (The WAIVER disjunct is named as NOT ASSERTED in the header above, with the three
		// findings that make it unassertable.)
		const substitute = cast.owner.attempt(
			'CompleteAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			ASSESSMENT,
			{
				validatorResult: {
					...verdict({
						assessmentId: ASSESSMENT,
						subjectId: PWU,
						subjectSemanticVersion: 1,
						disposition: 'SATISFIED'
					}),
					executionProvenance: { evaluator: AGENT_REF }
				},
				producer: OWNER_REF
			}
		);
		expect(
			substitute.error?.message,
			'and "a different validator is required" is stronger here than the rule states: the blocked assessment is TERMINAL, so an independent evaluator cannot be substituted into it — a NEW assessment is required'
		).toContain('to be ASSESSING, but it is INDEPENDENCE_VIOLATION');
	});

	// ── THE CONTROL FOR `O-5` ────────────────────────────────────────────────────────────────────────────────
	//
	// ⚠ WITHOUT THIS, `O-5` IS AN ARRANGEMENT THAT CANNOT DISCRIMINATE. A green `O-5` alone is consistent with the
	// completion having been blocked for any reason at all — a malformed verdict, a policy the gate did not like,
	// the mere act of supplying a `producer` at that seam for the first time. This test drives the SAME acts in
	// the SAME order with the SAME payloads and varies ONE FACT: the actor named as evaluator. The outcome
	// inverts. That is what makes the identity the cause rather than a correlate, and it is the failure this
	// programme has already recorded — a Slice that "drove" an ordering claim with two runs that held everything
	// identical and only swapped labels, and so could not tell the two worlds apart.
	it('O-6 (CONTROL for O-5) — the identical completion with an INDEPENDENT evaluator is not blocked and reaches its disposition: the block was the identity, not the arrangement', () => {
		const cast = throughExecutedWork();
		assessWithEvaluator(cast, AGENT_REF);

		const assessment = cast.owner.state(ASSESSMENT) ?? {};
		expect(
			assessment.assessmentState,
			'with the Product Owner agent as evaluator the DIFFERENT_AGENT requirement is met, and the assessment reaches the disposition the validator recommended'
		).toBe('SATISFIED');
		expect(
			assessment.evaluator,
			'and the evaluator recorded is the independent one — the single fact that differs from O-5'
		).toEqual(AGENT_REF);
		// The MIRROR of `O-5`'s stream assertion, so the pair is symmetric on BOTH sources rather than only on the
		// object field. `O-5` proves no completion was minted; this proves one WAS, carrying the disposition the
		// same validator recommended in both worlds.
		const completions = cast.owner.engine
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceAssessmentCompleted');
		expect(
			completions,
			'exactly one completion is recorded — the act O-5 was blocked from performing'
		).toHaveLength(1);
		expect(
			completions[0]?.payload,
			'and it carries the disposition the validator recommended, over the same assessment and the same subject'
		).toMatchObject({ assessmentId: ASSESSMENT, disposition: 'SATISFIED' });
		expect(
			cast.owner.engine
				.readAllEvents()
				.filter((e) => e.eventType === 'AssuranceIndependenceViolated'),
			'and NO violation is recorded: the gate is discriminating on identity, not refusing every assessment that names a producer'
		).toEqual([]);
	});
});
