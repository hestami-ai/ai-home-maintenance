// JAN-SLICE-SWP-03 — the CANCELLATION class: work that is under way and is CALLED OFF.
//
// The ratified obligation this Slice answers, verbatim from the M8 ontology
// (`packages/rph-product-realization-pwa/vocab/m8-ontology.json`, USER_JOURNEY_DEFINITION `completionClaims`):
//
//   "Applicable scenario classes (normal path, alternate valid path, user-error path, system-failure path,
//    permission-denied path, interrupted or resumed path, data-unavailable path, cancellation path) are covered
//    or their inapplicability is explicit."
//
// The authored material it draws on (`SL-S4`): the Field Service reference undertaking's exceptional path
// **"Customer cancels."** A technician is on site, the diagnosis step is RUNNING, and the customer stands the job
// down. Nothing has failed. Nothing is malformed. The work is simply not going to happen.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ THE FINDING THIS SLICE EXISTS TO RECORD, AND THE CORRECTION IT MAKES TO THE FINDING AS IT WAS HANDED OVER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// The finding as received: *"the ratified 125-rule M12 catalog has NO rule dedicated to cancellation."* Driven in
// both directions, that is TRUE — and the obvious next sentence, that cancellation is therefore ungoverned, is
// FALSE. Both halves are recorded, because the false half is the one a reader will supply for themselves.
//
// DIRECTION 1 — VOCABULARY → CATALOG. Sweeping all 125 `statement` fields for
// /cancel|abandon|skip|prune|terminat|withdraw/i returns EXACTLY ONE rule: `RPH-EXE-008`, and only through the
// last word of its consequent — *"After a retry policy's third attempt fails, the controller must not issue a
// fourth retry and must select change tactic, replan, escalate, reject, or abandon."* Its ANTECEDENT IS A
// FAILURE. The one rule that names the act names it as a consolation prize after three attempts died, which is
// precisely the path this Slice does NOT take. `O-8` gates that sweep so it cannot rot into prose.
//
// ⚠⚠ A COUNT CORRECTED — THE VERB SWEEP RETURNS ONE, THE *CONCEPT* SWEEP RETURNS TWO, AND THIS FILE USED TO
// REPORT BOTH AS ONE. An earlier draft of this header widened the sweep, listed `revoke` among the extra terms,
// and then disposed of the whole widening in a single clause — *"`supersede`/`revoke`/`void` hit rules about
// OTHER acts"* — without naming which rule or letting a gate hold the number. Re-run and counted: with `revoke`
// included the sweep returns **TWO of 125**, `RPH-EXE-008` and `RPH-GOV-007` — *"Revoking an effective
// Architecture approval makes the Architecture Baseline review-required or revoked, impacts downstream planning,
// and initiates impact analysis."* THE FINDING SURVIVES AND THE NUMBER DOES NOT: `RPH-GOV-007` withdraws an
// APPROVAL and its consequent is about a Baseline and an impact analysis, so it no more governs standing a job
// down than `RPH-EXE-008` does — TWO oblique mentions rather than one, neither with a call-off in its
// antecedent. `O-8` now gates BOTH counts, so neither can rot back into prose.
//
// ⚠ THE SWEEP WAS WIDENED BEFORE IT WAS BELIEVED, because an absence claim is a claim about MY SEARCH. Beyond
// the six terms above I also swept, case-insensitively, over every statement: `supersede`, `abort`, `halt`,
// `cease`, `discontinu`, `revoke`, `stop`, `call off`, `called off`, `curtail`, `rescind`, `retract`, `void`,
// `exit`, the five command names (`CancelExecutionPlan`, `CancelExecutionStep`, `PruneExecutionStep`,
// `SkipExecutionStep`, `AbandonPwu`), the two events (`ExecutionTerminated`, `PwuAbandoned`), and the terminal
// state names. `supersede`/`revoke`/`void` hit rules about OTHER acts — `revoke` reaching `RPH-GOV-007`, named
// above — and every cancellation-specific term returns zero. The verb sweep was also re-run over
// `JSON.stringify(rule)` rather than `statement` alone, in case a `sourceRef` or a layer note carried the word:
// still one hit, still `RPH-EXE-008`, and the widened concept sweep over `JSON.stringify(rule)` still returns
// exactly the same two.
//
// DIRECTION 2 — ENGINE → CATALOG. The engine has the RICHEST command family in the system for this class —
// `CancelExecutionPlan`, `CancelExecutionStep`, `PruneExecutionStep`, `SkipExecutionStep`, `AbandonPwu` — and not
// one of those five names appears in any rule statement. Sharper still, and DERIVED rather than enumerated
// (`O-9`): take the terminal state sets of the three ratified machines in `m2-transitions.json`
// (`PWU.workLifecycleState`, `ExecutionPlan.status`, `ExecutionStep.stepState`) and count the rules naming each.
//
// ⚠⚠ AND HERE IS WHERE THIS FILE'S OWN FINDING WAS OVER-READ — CORRECTED AGAINST THE MATCHER, NOT AGAINST
// TASTE. The sentence that used to stand here was *"Every terminal is named by at least one rule EXCEPT the
// three the cancellation family reaches"*, and the census under it is a bare case-insensitive SUBSTRING sweep
// with no attribution to the machine the terminal came from. The eight counts are true and reproduce exactly;
// the sentence is not what they measure. Read the actual hits: `COMPLETED: 2` is `RPH-BAS-004`'s *"has not
// completed"* and `RPH-CMP-001`'s *"completed intent PWUs"* — two English past participles, neither naming
// `ExecutionPlan.status COMPLETED`. `FAILED: 2` is `RPH-CON-002`'s error code `RPH_VALIDATION_SCHEMA_FAILED` and
// `RPH-ASR-006`'s `VALIDATOR_FAILED`, an AssuranceAssessment state — neither naming `ExecutionStep.stepState
// FAILED`. So the tidy 0-vs-2 contrast was in part an artifact of the matcher.
//
// THE RE-DERIVATION, AND IT IS SHARPER THAN THE THING IT REPLACES. `O-9` now runs TWO censuses over the same
// catalog and asserts both. The LOOSE one (substring, any case) is the instrument's proof of life. The SHARP one
// asks the like-for-like question — does any rule name this terminal AS A STATE TOKEN, i.e. does the uppercase
// name survive as its own word once the statement is split on non-letters? That excludes English participles
// (*"completed"*) and excludes `X_FAILED`-style error codes, because `_` is a word character and
// `RPH_VALIDATION_SCHEMA_FAILED` therefore tokenises whole. Under the sharp matcher FIVE of the eight terminals
// score zero: the three cancellation terminals AND `COMPLETED` AND `FAILED`.
//
// WHAT SURVIVES, STATED AS WHAT THE TWO MATCHERS JOINTLY ESTABLISH rather than as the slogan it replaces: the
// cancellation three are the only terminals scoring zero under BOTH. `ABANDONED`, `CANCELLED` and `SKIPPED` do
// not occur in any statement in ANY form — not as a state name, not as an English word, not inside an error
// code — whereas `COMPLETED` and `FAILED` at least have the catalog's prose and its error vocabulary around
// them. That is a STRICTLY STRONGER absence than the one first claimed, and `O-9` DERIVES it: it computes the
// both-zero set and the sharp-only-zero set from the censuses rather than restating them by hand.
//
// ⚠⚠ AND NOW THE HALF THAT REFUTES THE TEMPTING CONCLUSION. **CANON GOVERNS THIS ACT BY NAME, AND THE ENGINE
// ENFORCES IT.** JPWB-DOC-001 §5.2: *"Governance is an authority function outside the six disciplines. It alone
// authorizes waiver, risk acceptance, rejection or abandonment of governed work, and promotion."*
// `abandon-authorization.ts` implements seven ordered checks against that sentence, `REG-F-070` records the
// finding and its closure, and the engine's refusal QUOTES THE CANON SENTENCE BACK — which is why `O-1` asserts
// that message rather than a code. So the correct statement is narrower and more interesting than "cancellation
// is ungoverned":
//
//   **The act has CANON, and an ENFORCEMENT SITE, and no RULE ID.** The M12 catalog is the layer the conformance
//   manifest and `ENFORCEMENT_REGISTER` are keyed to — `RegisteredRuleId` is a union of `RPH-*` ids, and
//   `grep -c abandon packages/rph-domain/src/enforcement-register.ts` returns **0** (reproduced: 0
//   case-sensitive and 0 case-insensitive). No conformance question about this act can therefore be asked IN
//   RULE-ID TERMS: the rule-id-keyed apparatus has no X to ask about.
//
// ⚠⚠ AND THE SENTENCE THAT USED TO FOLLOW WAS FALSE — THIS PROGRAMME'S #1 RECORDED FAILURE MODE, APPEARING
// INSIDE THE PROGRAMME'S OWN ARTIFACT. It read: *"The apparatus that asks 'is rule X enforced?' cannot ask the
// question about the one act canon reserves to Governance by name... A guard nobody can interrogate is not the
// same as a guard nobody wrote, and this Slice is what stands in for the missing row until one exists."*
// **A SECOND REGISTER INTERROGATES THIS GUARD TODAY, AND IT IS GATED.**
// `verif/guard-enforcement-ledger.data.ts` is keyed by ARROW-GUARD TEXT rather than by rule id, and it carries
// the row `["Authorized decision (Decision.decisionType=ABANDON)"]` with `disposition: "ENFORCED"`, an
// `enforcingSite` in `packages/rph-application/src/handlers/pwu.ts`, an `enforcingAnchor` of
// *"AbandonPwu ${id}: ${verdict.reason}"* — which I verified resolves, uniquely, in that file — and an
// `evidence` field recording the very relocation to `abandonPwu` this header describes, re-driven through the
// bus (`AbandonPwu` naming a dangling id, a non-DECISION, an APPROVAL, a PROPOSED decision, another PWU's
// decision and an unpinned subject, each REJECTED). `verif/guard-enforcement-ledger.test.ts` holds every
// ENFORCED row to naming the line that refuses AND to carrying an anchor that still resolves uniquely, so that
// row asserts against production source rather than describing it.
//
// THE ERROR, NAMED SO IT IS NOT REPEATED: **I checked the FIELD NAME (`ENFORCEMENT_REGISTER` /
// `RegisteredRuleId`) and never the CONCEPT (an enforcement register keyed by something other than a rule id).**
// The narrow grep was true; the generalisation from *"no row in the rule-id-keyed register"* to *"no apparatus
// can interrogate this guard"* was not. THE NARROWED CLAIM, WHICH IS WHAT THIS SLICE ACTUALLY STANDS ON: the act
// has canon, an enforcement site, and a guard-keyed ledger row — and **no M12 rule id**, so it is invisible to
// the conformance manifest and to every count that runs off `RegisteredRuleId`. This Slice does not stand in for
// a missing row. It adds the one thing a per-arrow ledger row does not carry: a JOURNEY in which the act is
// authorized, performed, refused and its consequences driven end to end.
//
// ⚠ THAT ORPHANING IS OBSERVABLE, NOT INFERRED — AND IT IS TRUE OF A VALUE, NOT OF THE ARM.
// `canResumeExecutionOnPwu` refuses a closed unit with *"the PWU is ABANDONED, a terminal workLifecycleState"*
// — and the enforcement register's markers for the two rules sited there are *"a baselined PWU requires a
// successor revision before new execution"* (`RPH-PWU-010`) and *"the PWU is SUPERSEDED, a terminal
// workLifecycleState"* (`RPH-PWU-009`, `enforcement-register.ts:777`). The refusal a CALL-OFF observes matches
// NEITHER, and it comes from the arm that module's own comment labels a **DISCLOSED AUTHORED EXTENSION** — the
// derived terminal-set arm. That is why `O-3` carries `(narrowed)`.
//
// ⚠ BUT AN EARLIER DRAFT ADDED *"and no register row observes it"*, WHICH OVER-CLAIMED BY ONE STEP. The guard
// has exactly two branches (`packages/rph-domain/src/execution.ts:148-172`): the `BASELINED` literal, and the
// derived terminal-set branch everything else falls into — SUPERSEDED included. `RPH-PWU-009`'s registered
// `refusalMarker` is BYTE-IDENTICAL to that derived branch's reason string at the SUPERSEDED value, so a
// register row DOES observe the arm; what no row observes is the arm **AT THE ABANDONED VALUE**. That is now
// DRIVEN rather than argued: `O-4` runs the same command against the same site at BOTH terminals and asserts
// that the two refusals differ in the state name and in nothing else — which is also how `RPH-PWU-009` comes to
// be asserted here at its own ratified antecedent rather than merely cited.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RATIFYING THE SCENARIO CLASS (`SL-5`) — WHY THIS IS `cancellation path` AND NOT ONE OF ITS NEIGHBOURS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// The roadmap's §9 table proposes assignments and its own preamble forbids inheriting them, so this is argued
// here against the four classes it could plausibly be mistaken for.
//
//   * NOT `alternate valid path` — the class five of the seven existing Slices already carry. An alternate valid
//     path RUNS THE WORK TO A CONCLUSION and differs on the professional VERDICT: `E2E-002`'s architecture is
//     generated and then rejected, and there is a result to judge. Here there is no result and there never will
//     be. The distinguishing fact is driven, not asserted by taste: `O-3` shows an authorization that WOULD have
//     retired the step — accepted minutes earlier in the same arrangement — refused after the call-off, because
//     a skip mints TERMINAL SUCCESS and a called-off unit may accrue none. An alternate valid path ends with
//     something to assess; a cancellation ends with the engine refusing to let anything be assessed.
//   * NOT `system-failure path` — nothing failed. No step reaches FAILED, no retry is issued let alone
//     exhausted, and every act of the closing sequence is ACCEPTED. This is the distinction the catalog itself
//     blurs: `RPH-EXE-008` puts "abandon" downstream of three dead attempts, and taking that arm would have made
//     this Slice a failure journey wearing a cancellation label. Its consequent is therefore NOT ASSERTED here,
//     and `SL-2` requires that to be said rather than left to inference. AND BECAUSE IT IS NOT ASSERTED, ITS ID
//     IS NOT IN `citedRules` EITHER — the reasoning is at that field, and it is the F-3 correction this file
//     had to make against itself.
//   * NOT `interrupted or resumed path` — `E2E-006`'s class. An interruption is INVOLUNTARY and the journey
//     RESUMES; a restart is a fact about the process, not about the work. A call-off is deliberate, authorized,
//     and terminal — and `O-4` is that difference read from the other side: the engine refuses to resume it.
//   * NOT `permission-denied path` — `O-1` is a refusal, and it is not a permission one. The acting principal
//     HOLDS the authority: the same HUMAN proposes and approves both decisions, and `REG-F-014`'s identity check
//     passes. What is missing is a decision of the right KIND. The refusal code is `RPH_INVARIANT_VIOLATION`,
//     not either of the two mechanisms that surface `UNAUTHORIZED`, and the message names a `decisionType`
//     rather than a principal. Both are asserted in `O-1` so the two classes cannot be confused by a later
//     reader counting refusals.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT IS NEW HERE AND WHAT IS RESTATEMENT — DISCLOSED, BECAUSE A SLICE THAT LOOKS NOVEL AND IS NOT MISLEADS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Journey-level restatement of a unit test is the POINT of a Slice, so none of this is a defect — but the reader
// should not have to discover it. `packages/rph-application/src/handlers/execrem-wp12-authority.test.ts:461`
// (`openness/start-under-closed-pwu-REJECTS`) already drives `AbandonPwu` under an EFFECTIVE ABANDON decision
// and then `StartExecutionStep` on a QUEUED step, asserting REJECTED / `RPH_INVARIANT_VIOLATION` / the step
// stays QUEUED — that is `O-4`'s first half. Line 480 of the same file
// (`openness/cancel-under-closed-pwu-ACCEPTS — closing a PWU must never strand its live steps`) is `O-5`, and it
// carries the identical sentence this file quotes. `M4` is verbatim one of the `declaredMutations` already
// registered for `RPH-PWU-009` (`packages/rph-domain/src/enforcement-register.ts:783`).
//
// THE GENUINELY NEW WORK, so the claim of novelty is scoped to it: `O-1` and `O-2` (the authorization ladder and
// the provenance of the closure); `O-3`'s control/treatment pair — no skip-under-closed-PWU case exists anywhere
// else in the repository; `O-4`'s SECOND half, which drives the SAME site at SUPERSEDED and compares the two
// refusals, and which is what makes `RPH-PWU-009` asserted here rather than cited; and `O-8`/`O-9`, the two
// censuses over the ratified catalog.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE — the prohibition both existing Slice headers record. It turns
// a false clause into a green suite, which is `SL-8`'s "weakened to green" wearing a different hat.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	beginJourney,
	changeState,
	JOURNEY_ACTOR,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	type Journey
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'CLS-CANCELLATION',
	title: 'The customer calls the job off mid-flight: the unit closes, the exit stays open, and nothing may claim success',
	plane: 'ENGINE',
	scenarioClass: 'cancellation path',
	// ⚠⚠ THIS FIELD USED TO CARRY THREE IDS AND A COMMENT CONCEDING THAT NONE OF THE THREE WAS ASSERTED AT ITS
	// OWN RATIFIED ANTECEDENT. That is the F-3 defect exactly — the conformance gate that passed 125 of 125 rules
	// on CITATIONS while 38 of them had their id present only in a "not probed here" marker — reproduced inside
	// the programme's own artifact. `verif/slice-ledger.ts:452` publishes `citedRules` VERBATIM into
	// `docs/tracking/slices/LEDGER.md`, where a source comment does not travel: a reader of that table saw this
	// Slice credited with `RPH-PWU-009` and `RPH-PWU-010` with no disclaimer attached. Each id was therefore
	// re-decided one way or the other — ASSERT it, or DROP it and say why.
	//
	// KEPT AND NOW GENUINELY ASSERTED — `RPH-PWU-009`, *"A PWU in SUPERSEDED cannot start an execution step."*
	// `O-4`'s second half drives a PWU to SUPERSEDED through `SupersedePwu` and asserts that `StartExecutionStep`
	// is refused, that the step stays QUEUED, and that the refusal carries the rule's own registered
	// `refusalMarker`. That is the rule at its own antecedent, with its own consequent, and TWO declared mutants
	// redden it: `M4` (which makes the start succeed) and `M9` (which moves the refusal onto `RPH-PWU-010`'s
	// literal arm, so the SUPERSEDED limb is separable from the ABANDONED one rather than sharing its green).
	//
	// CONSIDERED AND DROPPED — `RPH-PWU-010`, *"A BASELINED PWU cannot resume execution against the same semantic
	// version..."*. Its antecedent is unreachable from this journey and not for want of trying: `BaselinePwu`
	// declares `sourceStates: ['SATISFIED','RECOMPOSED']`
	// (`packages/rph-domain/src/pwu-lifecycle-command-spec.ts:145`), so BASELINED is on the far side of a full
	// assurance journey whose class is not cancellation. This Slice never reaches BASELINED, so nothing here can
	// redden if `RPH-PWU-010` is broken, and citing it would credit `LEDGER.md` with an assertion that does not
	// exist. It is still NAMED — the refusal `O-3` and `O-4` observe ends with `(RPH-PWU-010 / §8.3)` because the
	// handler appends that citation to every openness refusal, and that mismatch is the header's finding.
	//
	// CONSIDERED AND DROPPED — `RPH-EXE-008`. What `O-8` asserts is a fact about the rule's TEXT — that it is one
	// of only two statements in the catalog that reach the concept, and that its antecedent is a failure. That is
	// a claim about the CATALOG, not conformance to the rule; the rule's behavioural consequent is explicitly not
	// driven here (see the class ratification above), and citing a rule for the wording of its own statement is
	// precisely what F-3 was. The id stays load-bearing in `O-8`'s assertions and leaves this field.
	//
	// A reader who wants "which rule squarely governs a call-off?" should read `O-8`: there is none, and that is
	// the point of the Slice.
	citedRules: ['RPH-PWU-009'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'CLS-CANCELLATION-M1',
			file: 'packages/rph-application/src/handlers/abandon-authorization.ts',
			find: "if (decision.decisionType !== 'ABANDON')",
			replace:
				"if (decision.decisionType !== 'ABANDON' && decision.decisionType !== 'REPLAN')",
			expectRed: ['O-1'],
			predictedMessage:
				'a REPLAN decision must not authorize a call-off — the refusal must name the decisionType=ABANDON requirement',
			why: "Proves O-1's arrangement trips EXACTLY ONE limb of the seven-check abandonment gate. The REPLAN offered there is EFFECTIVE, is a DECISION, parses, names this PWU, and binds it at its current semantic version — every limb but the kind check passes by construction. So admitting REPLAN at the kind check does not merely change a message: it makes the whole call-off SUCCEED, which is the only evidence that the refusal came from that limb and not from one of the six others sharing the same reject code."
		},
		{
			id: 'CLS-CANCELLATION-M2',
			file: 'packages/rph-application/src/handlers/pwu.ts',
			find: 'abandonmentDecisionId: p.abandonmentDecisionId,',
			replace: "abandonmentDecisionId: 'dec_no_such_authority',",
			expectRed: ['O-2'],
			predictedMessage:
				'the PwuAbandoned event must name the very Decision that authorized the call-off, not merely some id',
			why: 'Proves O-2 asserts the PROVENANCE of the closure and not just its state. A PWU reading ABANDONED is cheap; a PWU reading ABANDONED whose event names the governed decision that closed it is the fact a replay can audit. Sited on the event payload because that is the only place the link is recorded — the object state carries no abandonment id at all.'
		},
		{
			id: 'CLS-CANCELLATION-M3',
			file: 'packages/rph-domain/src/step-command-spec.ts',
			find: "pwuOpenness: 'REQUIRES_OPEN_PWU',\n\t\tpwuOpennessRationale:\n\t\t\t'SKIPPED",
			replace: "pwuOpenness: 'CLEANUP_EXEMPT',\n\t\tpwuOpennessRationale:\n\t\t\t'SKIPPED",
			expectRed: ['O-3'],
			predictedMessage:
				'after the call-off the authorized skip must be refused for the CLOSED UNIT — a called-off job mints no more terminal success',
			why: "Proves O-3 rests on Skip's own declared `pwuOpenness` column and not on the skip authorization, which O-3's control half shows is perfectly good. Sited on the COLUMN rather than on `canResumeExecutionOnPwu` deliberately: mutating the shared kernel would redden O-4 as well and prove neither (SL-3a). The two commands declare the limb separately, so each clause gets a mutant that reaches only it."
		},
		{
			id: 'CLS-CANCELLATION-M4',
			file: 'packages/rph-domain/src/step-command-spec.ts',
			find: "pwuOpenness: 'REQUIRES_OPEN_PWU',\n\t\tpwuOpennessRationale:\n\t\t\t'a closed PWU",
			replace: "pwuOpenness: 'CLEANUP_EXEMPT',\n\t\tpwuOpennessRationale:\n\t\t\t'a closed PWU",
			expectRed: ['O-4'],
			predictedMessage:
				'after the call-off no new attempt may be opened on the unit — StartExecutionStep must be refused for the closed unit',
			why: "The sibling of M3 on StartExecutionStep's row. Its existence is the reason M3 is sited on a column at all: two commands, two declarations, two mutants, so a green on one clause is not borrowed from the other."
		},
		{
			id: 'CLS-CANCELLATION-M5',
			file: 'packages/rph-domain/src/step-command-spec.ts',
			find: "pwuOpenness: 'CLEANUP_EXEMPT',\n\t\tpwuOpennessRationale:\n\t\t\t'the exit of last resort",
			replace:
				"pwuOpenness: 'REQUIRES_OPEN_PWU',\n\t\tpwuOpennessRationale:\n\t\t\t'the exit of last resort",
			expectRed: ['O-5'],
			predictedMessage:
				'the running step must stay cancellable after the UNIT is closed — closing a PWU must never strand its live steps',
			why: 'Proves O-5 asserts a POSITIVE exemption rather than an accident. Cancel is the one command exempt from the very limb M3 and M4 prove live, and O-5 would pass just as well in a world where nothing was gated at all — this mutant is what separates "the exit is deliberately open" from "no gate exists".'
		},
		{
			id: 'CLS-CANCELLATION-M6',
			file: 'packages/rph-domain/src/step-command-spec.ts',
			find: "planLiveness: 'CLEANUP_EXEMPT',\n\t\tactivePlanRationale:\n\t\t\t'INTENTIONAL: cancel is CLEANUP.",
			replace:
				"planLiveness: 'REQUIRES_ACTIVE_PLAN',\n\t\tactivePlanRationale:\n\t\t\t'INTENTIONAL: cancel is CLEANUP.",
			expectRed: ['O-6'],
			predictedMessage:
				'the running step must stay cancellable after the PLAN is cancelled — a dead plan must never strand its live steps',
			why: 'The second axis of the same exemption, and the reason O-5 and O-6 are separate clauses driven in OPPOSITE ORDERS. O-5 closes the unit first and leaves the plan ACTIVE; O-6 cancels the plan first and leaves the unit open. Each order isolates one column, so this mutant reaches O-6 and M5 reaches O-5, and neither can borrow the other clause’s green.'
		},
		{
			id: 'CLS-CANCELLATION-M7',
			file: 'packages/rph-domain/vocab/m12-conformance.json',
			find: 'escalate, reject, or abandon.',
			replace: 'escalate, reject, or stand the work down.',
			expectRed: ['O-8'],
			predictedMessage:
				'exactly one ratified M12 rule names the act of cancelling governed work in the VERB sweep, and it is RPH-EXE-008',
			why: 'Proves O-8 measures the CATALOG rather than restating a number someone typed. Removing the single word that produces the single hit must turn the census to zero; if it does not, the sweep is reading something other than what it claims to read.'
		},
		{
			id: 'CLS-CANCELLATION-M8',
			file: 'packages/rph-domain/vocab/m12-conformance.json',
			find: 'A PWU in SUPERSEDED cannot start an execution step.',
			replace: 'A PWU in a closed lifecycle state cannot start an execution step.',
			expectRed: ['O-9'],
			predictedMessage:
				'the loose census must move when a rule stops naming a terminal — a zero must mean the catalog is silent, not that the reader is broken',
			why: 'THE CONTROL GETS ITS OWN MUTANT, and it must redden the CONTROL rather than the clause it controls. O-9 exists to show that the zeros at ABANDONED/CANCELLED/SKIPPED are the catalog’s silence and not a broken reader; a control with no failure mode of its own certifies nothing (three such shipped green in this programme). This mutant drops the word SUPERSEDED from RPH-PWU-009 and must move that terminal in BOTH censuses O-9 now asserts — the loose one from 4 to 3 AND the sharp one from 3 to 2 — so a reader broken in either direction is caught. It must leave O-8 alone, because the words it removes are neither cancellation verbs nor `revoke`.'
		},
		{
			id: 'CLS-CANCELLATION-M9',
			file: 'packages/rph-domain/src/execution.ts',
			find: "if (pwuLifecycleState === 'BASELINED')",
			replace:
				"if (pwuLifecycleState === 'BASELINED' || pwuLifecycleState === 'SUPERSEDED')",
			expectRed: ['O-4'],
			predictedMessage:
				"and the refusal must carry RPH-PWU-009's own registered refusalMarker, so this is the rule's site and not merely a refusal that happened to arrive",
			why: "THE MUTANT THAT MAKES THE RPH-PWU-009 CITATION EARNED RATHER THAN DECLARED. O-4 now drives the same site at TWO terminals, and M4 reddens BOTH limbs at once — an arrangement that trips two limbs proves neither, so the SUPERSEDED limb needs a mutant that cannot reach the ABANDONED one. This one moves SUPERSEDED off the derived arm and onto RPH-PWU-010's BASELINED literal: the refusal SURVIVES (RPH-PWU-009 still holds, so this is not a false-negative dressed as a kill) but its reason becomes 'a baselined PWU requires a successor revision before new execution' and RPH-PWU-009's registered refusalMarker vanishes from the message. It reddens the SUPERSEDED limb and the byte-comparison of the two refusals; it CANNOT reach the ABANDONED limb or O-3, because ABANDONED still falls through to the derived arm unchanged. Sited on the FIRST branch rather than on the derived one deliberately: mutating the derived arm would redden O-3 and both limbs of O-4 together and prove none of them (SL-3a)."
		}
	]
};

// ── THE UNDERTAKING ──────────────────────────────────────────────────────────────────────────────────────────
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5C00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5C10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5C20';
/** The step the technician is actually performing when the phone rings. */
const STEP_ATTEND = 'step_01ARZ3NDEKTSV4RRFFQ69G5C30';
/** The step that never happens. */
const STEP_REPAIR = 'step_01ARZ3NDEKTSV4RRFFQ69G5C40';
/** The governed ABANDON decision that carries the customer's instruction. */
const CALLOFF = 'dec_01ARZ3NDEKTSV4RRFFQ69G5C50';
/** An EFFECTIVE REPLAN decision authorizing the repair step to be retired. Two jobs; see its builder. */
const REVISION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5C60';
/**
 * The successor named by `O-4`'s SUPERSEDED control.
 *
 * ⚠ DISCLOSED, NOT SMUGGLED: NOTHING SEEDS IT, AND THAT IS AN OBSERVED FACT ABOUT THE ENGINE RATHER THAN A
 * SHORTCUT. `SupersedePwuPayloadSchema` is `{ supersedingWorkUnitId: string }`
 * (`packages/rph-contracts/src/messages.ts:452`) and the command was driven with an id naming no object: it is
 * ACCEPTED and the unit commits to SUPERSEDED. The clause that uses it asserts nothing about the successor —
 * it is about the CLOSED unit — so no assertion here rests on the dangling id; but this file condemns cited-and-
 * never-seeded governance ids elsewhere, so the exception is stated rather than left for a reader to find.
 */
const SUCCESSOR = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5C70';

/**
 * The job, driven to the moment the customer calls: plan ACTIVE, the attend step RUNNING, the repair step QUEUED.
 *
 * ⚠ `executeWork` FROM THE SHARED FIXTURE IS DELIBERATELY NOT USED, and that is the whole arrangement. It drives
 * ONE step all the way to SUCCEEDED and takes the PWU to `executionState: 'SUCCEEDED'` with it — a journey that
 * has already finished. A cancellation has nothing to cancel unless the work is still running, so this Slice
 * stops mid-flight and needs a SECOND step that never starts, so that the acts a called-off unit may and may not
 * perform can be asked of a step in each condition. `slice-journey.ts` is SHARED and was not edited to add a
 * stop-at-step-N option; the arrangement is inlined here instead, and the need is reported rather than smuggled.
 *
 * Everything below is a real `DomainCommand` through the real bus into a real store, and every arranging act is
 * CHECKED (`send` throws on refusal). `SL-7` forbids the alternative.
 */
function jobUnderWay(): Journey {
	const j = beginJourney();
	seedJourneyPolicy(j);
	seedIntentAndArchitecture(j, { intentId: INTENT, pwuId: PWU });
	// PROPOSED -> SHAPING -> READY. `MarkPwuReady` declares only SHAPING as a source, and the bus refuses an
	// UNDECLARED ARROW distinctly from an illegal one (REG-F-114).
	j.send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', PWU, {});
	j.send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', PWU, {
		shapeReadinessAssessmentId: 'assess_shape',
		expectedSemanticVersion: 1
	});
	// ⚠ `TRANSFORMATION`, NOT `MODEL_INVOCATION`, for the reason the shared fixture states: `completeExecutionStep`
	// derives `aiProduced` FROM THE STEP TYPE, so an AI-authored step obliges the whole de minimis floor. This
	// Slice asserts nothing about the floor and completes no step at all, so claiming AI authorship would oblige
	// a floor whose satisfaction would be pure arrangement noise.
	const step = (id: string, purpose: string) => ({
		id,
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});
	j.send('ProposeExecutionPlan', 'EXECUTION_PLAN', PLAN, {
		executionPlanId: PLAN,
		workUnitId: PWU,
		steps: [
			step(STEP_ATTEND, 'Attend the site and diagnose the fault'),
			step(STEP_REPAIR, 'Complete the repair and hand over')
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
	j.send('StartExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP_ATTEND });
	changeState(j, PWU, {
		previousState: 'EXECUTING',
		newState: 'EXECUTING',
		executionState: 'RUNNING',
		assuranceState: 'UNASSESSED',
		supportingObjectIds: [PLAN]
	});
	return j;
}

/**
 * An EFFECTIVE `REPLAN` decision that authorizes retiring the repair step, scoped to this plan and this step.
 *
 * IT DOES TWO JOBS, AND THAT IS THE POINT OF BUILDING IT ONCE. In `O-3` it is a GOOD authorization — the skip it
 * backs is accepted while the unit is open — so the refusal that follows the call-off cannot be blamed on it.
 * In `O-1` the SAME object is offered as an abandonment authorization and refused, because a decision that
 * authorizes one governed act does not authorize another.
 *
 * ⚠ `REPLAN` AND NOT `WAIVER`, and `skip-authorization.ts` says why in its own words: `approveDecision` refuses
 * `decisionType === 'WAIVER'` outright — a waiver becomes EFFECTIVE only through `GrantWaiver`, which mandates
 * assurance-plane fields. REPLAN is the kind an execution-plane caller can actually drive to EFFECTIVE.
 */
function authorizeRetiringTheRepair(j: Journey): void {
	j.send('ProposeDecision', 'DECISION', REVISION, {
		decisionType: 'REPLAN',
		// The PWU is named as a subject too, deliberately: it is what makes this decision pass the abandonment
		// gate's SCOPE and VERSION limbs in O-1, so the only limb left to refuse there is the kind check.
		subjectObjectIds: [PLAN, PWU],
		selectedOption: 'retire the repair step under an authorized plan revision',
		rationale: 'the repair cannot proceed on this visit and the step is retired rather than left open',
		authority: JOURNEY_ACTOR,
		executionSkipAuthorization: {
			executionPlanId: PLAN,
			executionStepIds: [STEP_REPAIR],
			rationale: 'the repair step is retired under this revision'
		}
	});
	j.send('ApproveDecision', 'DECISION', REVISION, {
		selectedOption: 'retire the repair step under an authorized plan revision',
		rationale: 'the repair cannot proceed on this visit and the step is retired rather than left open',
		consideredEvidenceIds: [],
		consideredObservationIds: [],
		subjectSemanticVersions: { [PWU]: 1 }
	});
}

/**
 * The customer calls the job off, and the call-off is recorded the way canon requires: a governed ABANDON
 * decision, made EFFECTIVE by a held authority, and then CITED by the command that closes the work.
 *
 * ⚠ THREE ACTS, NOT ONE, AND THE MIDDLE ONE IS NOT OPTIONAL. Driving `AbandonPwu` against a decision still in
 * PROPOSED is refused with *"is PROPOSED, not EFFECTIVE — a proposed or revoked decision authorizes nothing
 * (ASR-15)"*. Observed, not assumed. A customer's instruction becomes authority when somebody with authority
 * accepts it, which is the whole content of `makeDecisionEffective`.
 *
 * ⚠ AND `subjectSemanticVersions` MUST BE STATED AT APPROVAL AND MUST MATCH THE PIN. `proposeDecision` pins the
 * subject versions FROM THE STORE at propose time and `approveDecision` refuses an approval that states
 * different ones. The pin is what `resolveAbandonAuthorization`'s seventh check reads.
 */
function customerCancels(j: Journey): void {
	j.send('ProposeDecision', 'DECISION', CALLOFF, {
		decisionType: 'ABANDON',
		subjectObjectIds: [PWU],
		selectedOption: 'stand the job down',
		rationale: 'the customer cancelled the job while the technician was on site; no further work is authorized',
		authority: JOURNEY_ACTOR
	});
	j.send('ApproveDecision', 'DECISION', CALLOFF, {
		selectedOption: 'stand the job down',
		rationale: 'the customer cancelled the job while the technician was on site; no further work is authorized',
		consideredEvidenceIds: [],
		consideredObservationIds: [],
		subjectSemanticVersions: { [PWU]: 1 }
	});
	j.send('AbandonPwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
		abandonmentDecisionId: CALLOFF,
		reasonCode: 'CONTROLLER',
		supportingObjectIds: [CALLOFF]
	});
}

const stepStateOf = (j: Journey, stepId: string): unknown =>
	((j.state(PLAN)?.steps as Array<Record<string, unknown>> | undefined) ?? []).find(
		(s) => s.id === stepId
	)?.stepState;

// ── THE RATIFIED CORPUS, READ FROM DISK ──────────────────────────────────────────────────────────────────────
// ⚠ READ, NOT IMPORTED FROM A HELPER THAT ALREADY SUMMARISES IT. `O-8` and `O-9` are claims ABOUT the catalog, so
// they must read the catalog. A derived constant would make the census a claim about whoever wrote the constant.
const vocab = <T,>(name: string): T =>
	JSON.parse(
		readFileSync(fileURLToPath(new URL(`../../../rph-domain/vocab/${name}`, import.meta.url)), 'utf8')
	) as T;

interface CatalogRule {
	readonly id: string;
	readonly statement: string;
}
interface Machine {
	readonly name: string;
	readonly terminalStates?: readonly string[];
}

const catalog = (): readonly CatalogRule[] =>
	vocab<{ ruleCatalog: CatalogRule[] }>('m12-conformance.json').ruleCatalog;

describe('SLICE CLS-CANCELLATION — a job under way is called off, deliberately, by an authorized party', () => {
	// ⚠ THE ARRANGEMENT IS BUILT SO THAT EXACTLY ONE LIMB CAN REFUSE, and that is what makes this test worth
	// anything. `resolveAbandonAuthorization` runs seven ordered checks and refuses all seven with the SAME code
	// (`RPH_INVARIANT_VIOLATION`), so a test asserting the code alone could not tell a dangling id from a
	// wrong-kind decision from a version drift — the `JAN-CSAA` failure exactly, where one code had 116 emitters.
	// The REPLAN offered here EXISTS, is a DECISION, PARSES, is EFFECTIVE, NAMES this PWU, and BINDS it at
	// version 1. Six limbs pass by construction; only the kind check can fire, and the message must say so.
	//
	// ⚠ AND THIS IS NOT THE `permission-denied path`. The issuer holds the authority — the same HUMAN proposed
	// and approved both decisions and `REG-F-014`'s identity check passed twice. The engine has TWO distinct
	// mechanisms that surface `UNAUTHORIZED` (`RPH_AUTHENTICATION_REQUIRED` in the bus,
	// `RPH_AUTHORITY_INSUFFICIENT` in the handlers) and this is NEITHER; the code is asserted below precisely so
	// this refusal cannot be miscounted as one of them by a later reader.
	it('O-1 — a call-off is refused unless a governed ABANDON decision authorizes it; a REPLAN that authorizes other acts does not', () => {
		const j = jobUnderWay();
		authorizeRetiringTheRepair(j);

		const refused = j.attempt('AbandonPwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
			abandonmentDecisionId: REVISION,
			reasonCode: 'CONTROLLER',
			supportingObjectIds: [REVISION]
		});
		expect(refused.status, 'the call-off must not land on a REPLAN authorization').not.toBe('ACCEPTED');
		expect(
			JSON.stringify(refused.error ?? {}),
			'a REPLAN decision must not authorize a call-off — the refusal must name the decisionType=ABANDON requirement'
		).toContain('abandoning governed work requires decisionType=ABANDON');
		// The canon sentence itself, quoted by the engine. This is the clause that governs the act — and it has no
		// M12 rule id, which is the finding this Slice's header derives and `O-8` gates.
		expect(
			JSON.stringify(refused.error ?? {}),
			'and the refusal must cite the canon that reserves the act, not merely decline it'
		).toContain('reserved to Governance');
		expect(
			refused.error?.code,
			'and it is an INVARIANT refusal, not a permission one — the issuer holds the authority; what is missing is a decision of the right kind'
		).toBe('RPH_INVARIANT_VIOLATION');
		// The world is unchanged: a refused call-off calls nothing off.
		expect(
			(j.state(PWU) ?? {}).workLifecycleState,
			'and the work must still be running afterwards — a refused call-off must not half-close the unit'
		).toBe('EXECUTING');
	});

	// The customer's instruction becomes a governed fact. Two things are asserted and the second is the one a
	// first draft would have skipped: a PWU reading ABANDONED is cheap, and a PWU whose closure names the
	// decision that authorized it is what a replay can audit. The engine records that link ONLY on the event —
	// the object state carries no abandonment id at all — so the event is where the assertion has to go.
	it('O-2 — the call-off lands as a governed fact: the unit closes ABANDONED and the event names the deciding Decision', () => {
		const j = jobUnderWay();
		customerCancels(j);

		expect(
			(j.state(PWU) ?? {}).workLifecycleState,
			'the unit of work must read ABANDONED once the call-off is authorized and issued'
		).toBe('ABANDONED');
		const abandoned = j.engine.readAllEvents().find((e) => e.eventType === 'PwuAbandoned');
		expect(
			(abandoned?.payload as { abandonmentDecisionId?: string } | undefined)?.abandonmentDecisionId,
			'the PwuAbandoned event must name the very Decision that authorized the call-off, not merely some id'
		).toBe(CALLOFF);
	});

	// ⚠⚠ THE DISCRIMINATING PAIR, AND THE TWO RUNS DIFFER BY EXACTLY ONE ACT. A Slice in this programme has
	// already been caught "driving" a claim with two runs that held the acts identical and only swapped labels,
	// so the arrangement here VARIES THE THING IT CLAIMS ABOUT and holds everything else fixed: same policy, same
	// intent, same plan, same step, same authorization object, same command, same payload. The only difference is
	// whether the customer called the job off first.
	//
	// WHAT THAT BUYS. Without the control, the refusal below could be the authorization being no good; with it,
	// the authorization is demonstrably good enough to retire the step seconds earlier. So the refusal is the
	// CALL-OFF's doing, and what it means is the substance of this scenario class: a skip drives a step to
	// SKIPPED, which is TERMINAL SUCCESS — `planEvidencesExecutionSuccess` accepts SKIPPED alongside SUCCEEDED as
	// backing — and a called-off unit may accrue no more of that. This is where a cancellation stops being an
	// alternate valid path: there is nothing left to judge, and the engine enforces that there never will be.
	//
	// ⚠ NAMED `(narrowed)`. The refusal cites `RPH-PWU-010 / §8.3` in its own text, but the ARM that fires is the
	// derived terminal-set arm `canResumeExecutionOnPwu` labels a DISCLOSED AUTHORED EXTENSION — not the
	// `BASELINED` literal the ratified statement names, and not `RPH-PWU-009`'s `SUPERSEDED` either. What is
	// proved is that the site refuses a CALLED-OFF unit. What is NOT proved BY THIS CLAUSE is either rule at its
	// own antecedent — `O-4` does prove `RPH-PWU-009` at its own, by driving the same guard at SUPERSEDED, and
	// `RPH-PWU-010`'s BASELINED antecedent is unreachable from this journey at all (the reasoning is at
	// `citedRules`, which is why only one of the two ids is cited).
	it('O-3(narrowed) — after the call-off the SAME authorized skip no longer retires the step: a closed unit mints no more terminal success', () => {
		// CONTROL: the job is NOT called off. The authorization is good and the step retires.
		const open = jobUnderWay();
		authorizeRetiringTheRepair(open);
		const allowed = open.attempt('SkipExecutionStep', 'EXECUTION_PLAN', PLAN, {
			stepId: STEP_REPAIR,
			waiverOrRevisionId: REVISION
		});
		expect(
			allowed.status,
			'CONTROL — while the job is live this authorization retires the repair step; without this the refusal below could be the authorization being no good'
		).toBe('ACCEPTED');
		expect(
			stepStateOf(open, STEP_REPAIR),
			'CONTROL — and the retirement is real: SKIPPED is terminal SUCCESS, which is exactly the credit a called-off unit must not be able to accrue'
		).toBe('SKIPPED');

		// THE SAME ACT, AFTER THE CALL-OFF.
		const cancelled = jobUnderWay();
		authorizeRetiringTheRepair(cancelled);
		customerCancels(cancelled);
		const refused = cancelled.attempt('SkipExecutionStep', 'EXECUTION_PLAN', PLAN, {
			stepId: STEP_REPAIR,
			waiverOrRevisionId: REVISION
		});
		expect(refused.status, 'the same authorized skip must not land on a called-off unit').not.toBe(
			'ACCEPTED'
		);
		expect(
			JSON.stringify(refused.error ?? {}),
			'after the call-off the authorized skip must be refused for the CLOSED UNIT — a called-off job mints no more terminal success'
		).toContain('a closed unit of work opens no new execution');
		expect(
			stepStateOf(cancelled, STEP_REPAIR),
			'and the step must be left exactly where it was; a refused skip retires nothing'
		).toBe('QUEUED');
	});

	// The same limb, at the other command that declares it — AND AT TWO TERMINALS, WHICH IS THE HALF THIS CLAUSE
	// USED TO BE MISSING. `StartExecutionStep` is the arrow that OPENS AN ATTEMPT, and `RPH-PWU-009` writes exactly
	// one sentence about it: *"A PWU in SUPERSEDED cannot start an execution step."* This clause now asks that
	// command of BOTH terminals — the one a cancellation reaches (`ABANDONED`, which no rule and no
	// rule-id-keyed register row names) and the one the rule itself names (`SUPERSEDED`). The first half is
	// `(narrowed)`; the second half is `RPH-PWU-009` at its own antecedent with its own consequent, and is why
	// that id is the one rule this Slice cites.
	//
	// ⚠ WHY BOTH LIMBS LIVE IN ONE CLAUSE RATHER THAN TWO. `M4` flips `StartExecutionStep`'s declared
	// `pwuOpenness` column, which makes BOTH starts succeed. Split across two tests it would redden both and come
	// back TOO_WIDE while proving neither; held in one clause it names one test and stays SOUND. `M9` then
	// separates the limbs from the inside — it moves SUPERSEDED onto `RPH-PWU-010`'s `BASELINED` literal and
	// leaves ABANDONED on the derived arm untouched — so the SUPERSEDED limb does not borrow the other's green.
	//
	// ⚠ AND THE LAST ASSERTION IS THE HEADER'S FINDING, MEASURED RATHER THAN ARGUED. The refusal's text is
	// identical to `O-3`'s but for the command name because both come from `pwuOpennessRefusal`; rather than
	// eyeball that, the two refusals are compared BYTE FOR BYTE after substituting one state name for the other.
	// If they match, ONE arm produced both, and the only thing separating a registered rule from an unregistered
	// narrowing is the value the unit happened to close at. (A mutant on `canResumeExecutionOnPwu` itself would
	// redden `O-3` and both limbs here together and prove none of them — `SL-3a`, which is why neither `M4` nor
	// `M9` is sited there.)
	it('O-4(narrowed at ABANDONED, RPH-PWU-009 at SUPERSEDED) — a closed unit opens no new attempt, and one arm refuses at both terminals', () => {
		const j = jobUnderWay();
		customerCancels(j);

		const refused = j.attempt('StartExecutionStep', 'EXECUTION_PLAN', PLAN, {
			stepId: STEP_REPAIR
		});
		expect(refused.status, 'a called-off unit must open no new attempt').not.toBe('ACCEPTED');
		// ⚠ THE MESSAGE, NOT THE SERIALIZED ERROR. `reject` also puts the ids on `targetObjectIds`, so a haystack of
		// `JSON.stringify(error)` can be satisfied by something other than the sentence being claimed.
		expect(
			refused.error?.message ?? '',
			'after the call-off no new attempt may be opened on the unit — StartExecutionStep must be refused for the closed unit'
		).toContain(
			'the PWU is ABANDONED, a terminal workLifecycleState — a closed unit of work opens no new execution'
		);
		expect(
			stepStateOf(j, STEP_REPAIR),
			'and the step must stay QUEUED — a refused start opens nothing'
		).toBe('QUEUED');

		// ── RPH-PWU-009 AT ITS OWN RATIFIED ANTECEDENT ────────────────────────────────────────────────────────
		// A SECOND undertaking, identical up to the closing act. `SupersedePwu` declares `EXECUTING` among its
		// `sourceStates`, so the very same mid-flight arrangement can be closed at the OTHER terminal without any
		// change to the job — which is what makes the comparison below a comparison and not two different stories.
		const superseded = jobUnderWay();
		expect(
			superseded.attempt('SupersedePwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
				supersedingWorkUnitId: SUCCESSOR
			}).status,
			'the unit must be closable at SUPERSEDED from the same arrangement — otherwise the two refusals compared below come from two different journeys'
		).toBe('ACCEPTED');
		expect(
			(superseded.state(PWU) ?? {}).workLifecycleState,
			'and it must actually read SUPERSEDED — this is the antecedent RPH-PWU-009 states'
		).toBe('SUPERSEDED');

		const refusedAsSuperseded = superseded.attempt('StartExecutionStep', 'EXECUTION_PLAN', PLAN, {
			stepId: STEP_REPAIR
		});
		expect(
			refusedAsSuperseded.status,
			'RPH-PWU-009, at its own antecedent: a PWU in SUPERSEDED cannot start an execution step'
		).not.toBe('ACCEPTED');
		expect(
			refusedAsSuperseded.error?.message ?? '',
			"and the refusal must carry RPH-PWU-009's own registered refusalMarker, so this is the rule's site and not merely a refusal that happened to arrive"
		).toContain('the PWU is SUPERSEDED, a terminal workLifecycleState');
		expect(
			stepStateOf(superseded, STEP_REPAIR),
			'and RPH-PWU-009 must leave the step exactly where it was — a refused start opens nothing here either'
		).toBe('QUEUED');

		expect(
			(refusedAsSuperseded.error?.message ?? '').split('SUPERSEDED').join('ABANDONED'),
			'ONE ARM PRODUCES BOTH: the registered rule and the unregistered narrowing differ in the state name and in nothing else — the header finding, measured'
		).toBe(refused.error?.message);
	});

	// ⚠ THE OTHER HALF OF THE CLASS, AND THE HALF AN ENGINE GETS WRONG BY BEING TOO STRICT. A cancellation that
	// closed the unit and then refused to let anybody tidy up would STRAND the technician's live step in RUNNING
	// for ever. `CancelExecutionStep` declares `pwuOpenness: 'CLEANUP_EXEMPT'` for exactly this — "the exit of
	// last resort, and the one every other refusal message points at" — and the refusals in O-3 and O-4 do point
	// at it, in terms: *"cleanup commands (Cancel / Fail / EnterWait) remain available."*
	//
	// So the same closure that forbids new work PRESERVES the honest exit. That asymmetry is the substance of the
	// class: a called-off job must be able to say what happened to the work that was already under way, and must
	// not be able to say it succeeded.
	it('O-5 — the exit survives the unit’s closure: the running step is still cancellable after the call-off', () => {
		const j = jobUnderWay();
		customerCancels(j);
		// The plan is deliberately left ACTIVE here. O-6 varies that; keeping it fixed is what isolates the axis.
		expect(
			(j.state(PLAN) ?? {}).status,
			'the plan is still ACTIVE at this point — this clause is about the UNIT being closed, not the plan'
		).toBe('ACTIVE');
		// ⚠ THE FACT THE CLAUSE'S NAME TURNS ON, PINNED RATHER THAN ASSUMED. `CancelExecutionStep` declares
		// `sourceStates: ['READY','QUEUED','RUNNING','WAITING','FAILED']`
		// (`packages/rph-domain/src/step-command-spec.ts:310`), so everything below would pass verbatim on a QUEUED
		// step and could not tell *"a LIVE step may still be cancelled"* from *"any non-terminal step may be"*.
		// `jobUnderWay` does leave it RUNNING and the call-off does not move it (both observed) — which is exactly
		// why the pin is cheap and its absence was invisible.
		expect(
			stepStateOf(j, STEP_ATTEND),
			'and the step the technician is on is RUNNING — this clause is named for a LIVE step, so the live-ness is asserted rather than left to the arrangement'
		).toBe('RUNNING');

		const cancelled = j.attempt('CancelExecutionStep', 'EXECUTION_PLAN', PLAN, {
			stepId: STEP_ATTEND,
			reason: 'the customer cancelled the job while the technician was on site'
		});
		expect(
			cancelled.status,
			'the running step must stay cancellable after the UNIT is closed — closing a PWU must never strand its live steps'
		).toBe('ACCEPTED');
		expect(
			stepStateOf(j, STEP_ATTEND),
			'and the record must be the honest one: CANCELLED is terminal NON-success, so nothing downstream can read it as work done'
		).toBe('CANCELLED');
	});

	// ⚠ THE SAME STORY IN THE OPPOSITE ORDER, AND THE ORDER IS THE VARIABLE. O-5 closes the unit and leaves the
	// plan ACTIVE; this run cancels the PLAN first and leaves the unit open. Both are legitimate ways to stand a
	// job down and the engine permits both, but they exercise DIFFERENT declared columns — `pwuOpenness` there,
	// `planLiveness` here — which is why they are two clauses with two mutants rather than one test asserting a
	// vague "cleanup works". Holding the act sequence fixed and only relabelling it is the failure this
	// programme has already recorded; here the sequence genuinely differs.
	it('O-6 — the exit survives the plan’s cancellation too: the running step is still cancellable on a CANCELLED plan', () => {
		const j = jobUnderWay();
		const terminated = j.attempt('CancelExecutionPlan', 'EXECUTION_PLAN', PLAN, {
			reason: 'the customer cancelled the job while the technician was on site'
		});
		expect(terminated.status, 'the plan itself must be cancellable while it is ACTIVE').toBe('ACCEPTED');
		expect((j.state(PLAN) ?? {}).status, 'and the plan must read CANCELLED').toBe('CANCELLED');
		expect(
			(j.state(PWU) ?? {}).workLifecycleState,
			'and the unit is still OPEN here — this clause is about the PLAN being dead, not the unit'
		).toBe('EXECUTING');
		// The same pin as O-5, and here it carries a second fact: cancelling the PLAN does not cascade to its steps.
		// Observed — the attend step is still RUNNING on a CANCELLED plan, which is precisely the stranding this
		// clause exists to show the engine avoids by leaving the exit open.
		expect(
			stepStateOf(j, STEP_ATTEND),
			'and the step is STILL RUNNING on the dead plan — the plan cancellation strands it rather than tidying it, which is what makes the exit below necessary rather than decorative'
		).toBe('RUNNING');

		const cancelled = j.attempt('CancelExecutionStep', 'EXECUTION_PLAN', PLAN, {
			stepId: STEP_ATTEND,
			reason: 'the plan under which this step was authorized has been cancelled'
		});
		expect(
			cancelled.status,
			'the running step must stay cancellable after the PLAN is cancelled — a dead plan must never strand its live steps'
		).toBe('ACCEPTED');
		expect(
			stepStateOf(j, STEP_ATTEND),
			'and the step must record the honest terminal, not be left dangling on a dead plan'
		).toBe('CANCELLED');
	});

	// ⚠⚠ DRIVEN, AND IT CORRECTED WHAT READING PREDICTED. `AbandonPwu` moves the WORK LIFECYCLE axis and nothing
	// else, so the moment after the call-off the unit reads `workLifecycleState: 'ABANDONED'` and
	// `executionState: 'RUNNING'` — simultaneously closed and running. That is asserted below as a PIN.
	//
	// ⚠ AND THE OBVIOUS NEXT CLAIM IS FALSE, WHICH IS WHY IT IS DRIVEN RATHER THAN WRITTEN. A first reading of
	// this concluded the execution axis was STRANDED — that a called-off unit must read RUNNING for ever, since
	// every arrow OUT of ABANDONED is refused (`ABANDONED -> EXECUTING` is declined by the machine, observed).
	// It is not stranded. `ChangePwuState` is a MULTI-AXIS setter and an axis may HOLD: a hop that keeps the work
	// lifecycle at ABANDONED while moving the execution axis to CANCELLED is ACCEPTED, and is driven below.
	//
	// SO WHAT IS RECORDED IS THE NARROWER, TRUE THING: the closure lands on ONE axis, and recording that the work
	// actually stopped is a SECOND, SEPARATE governed act that the controller must perform. That is the same
	// shape `E2E-002` records for the assurance verdict — completing a REJECTED assessment leaves the PWU at
	// `assuranceState: 'UNASSESSED'` until somebody CARRIES it — appearing again on the execution axis. It is not
	// a defect; it is the multi-axis machine being multi-axis. But a Slice that asserted only
	// `workLifecycleState === 'ABANDONED'` would report the job as fully closed while its execution axis still
	// claimed a technician was working.
	//
	// ⚠ NO MUTANT IS DECLARED FOR THIS CLAUSE, AND THE REASON IS THE CLAUSE'S OWN SHAPE. Its first half PINS AN
	// OMISSION — the absence of any line that resets the execution axis — and there is no line whose mutation
	// removes an absence. The pin's job is to REDDEN THE DAY THE OMISSION IS REPAIRED, so that the disclosure
	// above cannot outlive the thing it discloses. Declaring a mutant that merely broke the second half would
	// dress that up as coverage it is not.
	it('O-7(pinned) — the call-off closes ONE axis: execution still reads RUNNING until a second, separate act records that it stopped', () => {
		const j = jobUnderWay();
		customerCancels(j);

		expect(
			(j.state(PWU) ?? {}).workLifecycleState,
			'the work lifecycle axis closes on the call-off'
		).toBe('ABANDONED');
		expect(
			(j.state(PWU) ?? {}).executionState,
			'PINNED: and the EXECUTION axis does not move with it — the unit reads ABANDONED and RUNNING at once, because AbandonPwu drives one axis. Repair this and this assertion is what tells you the disclosure above is stale.'
		).toBe('RUNNING');

		// The second act. NOT a workaround for a defect — the governed way to record what became of the work.
		changeState(j, PWU, {
			previousState: 'ABANDONED',
			newState: 'ABANDONED',
			executionState: 'CANCELLED',
			assuranceState: 'UNASSESSED',
			supportingObjectIds: [CALLOFF]
		});
		expect(
			(j.state(PWU) ?? {}).executionState,
			'and the correction IS available: a multi-axis hop that HOLDS the closed lifecycle while moving the execution axis is accepted, so the axis is separate, not stranded'
		).toBe('CANCELLED');
		expect(
			(j.state(PWU) ?? {}).workLifecycleState,
			'and the closure holds through it — the unit does not reopen to record that its work stopped'
		).toBe('ABANDONED');
	});

	// ⚠ A CLAIM ABOUT THE RATIFIED CORPUS, GATED RATHER THAN WRITTEN IN A COMMENT. The sweep in this file's
	// header is the finding; a finding stated only in prose is the exact shape this programme keeps recording —
	// a rule stated in a document, relayed into a type, rendered into a report, and enforced by nothing. So the
	// census runs, against the catalog on disk, every time this Slice does.
	//
	// The positive result is what makes it non-vacuous: this is not `toEqual([])` on something empty in every
	// world. It asserts ONE named hit, and that hit's antecedent.
	it('O-8 — the ratified catalog reaches the act of cancelling twice, both times obliquely, and never in an antecedent', () => {
		const rules = catalog();
		expect(rules.length, 'the catalog really was read — 125 ratified rules').toBe(125);

		const namesTheAct = rules
			.filter((r) => /cancel|abandon|skip|prune|terminat|withdraw/i.test(r.statement))
			.map((r) => r.id);
		expect(
			namesTheAct,
			'exactly one ratified M12 rule names the act of cancelling governed work in the VERB sweep, and it is RPH-EXE-008'
		).toEqual(['RPH-EXE-008']);

		// ⚠ AND THE WIDER CONCEPT SWEEP, GATED BECAUSE THIS FILE ONCE REPORTED IT AS ONE. The header always claimed
		// to have widened the sweep, and `revoke` was on its list — but the widening was disposed of in a clause of
		// prose and never held to a number, so the number was wrong and nothing could catch it. It is TWO of 125.
		const reachesTheConcept = rules
			.filter((r) => /cancel|abandon|skip|prune|terminat|withdraw|revoke/i.test(r.statement))
			.map((r) => r.id);
		expect(
			reachesTheConcept,
			'the concept sweep returns TWO of 125 — RPH-EXE-008 and RPH-GOV-007 — not the one this file used to report'
		).toEqual(['RPH-EXE-008', 'RPH-GOV-007']);

		// AND NEITHER ANTECEDENT IS A CALL-OFF, which is what keeps both mentions oblique rather than governing.
		// The catalog reaches "abandon" only after three attempts have died, and reaches "revoke" only through the
		// withdrawal of an approval — so a deliberate call-off, this Slice's entire journey, falls outside both.
		const only = rules.find((r) => r.id === 'RPH-EXE-008');
		expect(
			only?.statement,
			"and the rule the VERB sweep finds says it downstream of a FAILURE — which is why this Slice's class is cancellation and not system-failure, and why that rule's consequent is not asserted here and its id is not cited"
		).toContain("After a retry policy's third attempt fails");
		expect(
			rules.find((r) => r.id === 'RPH-GOV-007')?.statement,
			'and the second is about withdrawing an APPROVAL, not about standing work down: its antecedent is a revoked Architecture approval and its consequent is a Baseline and an impact analysis'
		).toContain('Revoking an effective Architecture approval');
	});

	// ⚠ THE CONTROL, AND IT HAS ITS OWN MUTANT (`M8`). Three controls have shipped green in this programme while
	// proving nothing, because a control that cannot fail certifies only that it ran. `O-8`'s finding depends on
	// zeros, and a zero from a broken reader looks exactly like a zero from a silent catalog. So this test
	// derives the terminal states of the three ratified machines — never a hand-typed list, which is the defect
	// one level up — and counts the rules naming each.
	//
	// ⚠⚠ AND IT NOW RUNS TWO MATCHERS, BECAUSE THE FIRST ONE DID NOT MEASURE WHAT THIS FILE SAID IT MEASURED.
	// The census was a bare case-insensitive SUBSTRING sweep with no attribution to the machine the terminal came
	// from, and the sentence resting on it — *"Every terminal is named by at least one rule EXCEPT the three the
	// cancellation family reaches"* — is not what those counts establish. `COMPLETED: 2` is *"has not completed"*
	// and *"completed intent PWUs"*; `FAILED: 2` is `RPH_VALIDATION_SCHEMA_FAILED` and `VALIDATOR_FAILED`. So the
	// SHARP census asks the like-for-like question — does the terminal survive as its own UPPERCASE TOKEN once a
	// statement is split on non-letters — and under it FIVE of the eight score zero, not three.
	//
	// WHY BOTH ARE KEPT AND BOTH ASSERTED. The loose census is the PROOF OF LIFE: its non-zeros are what say the
	// reader is not broken, and a sharp census alone could not carry that. The sharp census is the CORRECTION.
	// And the finding is then DERIVED from the pair rather than restated: the cancellation three are the only
	// terminals silent in BOTH, i.e. absent from every statement in any form — state name, English word, or error
	// code — while `COMPLETED` and `FAILED` at least have the catalog's prose around them. Both matchers run
	// through ONE reader (`census` below), so the sharp result cannot be blamed on a second, different instrument.
	it('O-9(control) — two censuses, one reader: the loose one proves the instrument works, the sharp one shows the silence is wider than first claimed, and only the cancellation terminals are silent in both', () => {
		const machines = vocab<{ machines: Machine[] }>('m2-transitions.json').machines;
		const OF_INTEREST = ['PWU.workLifecycleState', 'ExecutionPlan.status', 'ExecutionStep.stepState'];
		const terminals = [
			...new Set(
				machines.filter((m) => OF_INTEREST.includes(m.name)).flatMap((m) => m.terminalStates ?? [])
			)
		].sort();
		expect(
			terminals,
			'the three machines that carry this journey must yield their terminal states — if this list is wrong every count below is meaningless'
		).toEqual([
			'ABANDONED',
			'BASELINED',
			'CANCELLED',
			'COMPLETED',
			'FAILED',
			'SKIPPED',
			'SUCCEEDED',
			'SUPERSEDED'
		]);

		const rules = catalog();
		/** ONE reader, two matchers — so a difference between the censuses is the matcher and never the instrument. */
		const census = (names: (statement: string, terminal: string) => boolean): Record<string, number> =>
			Object.fromEntries(
				terminals.map((t) => [t, rules.filter((r) => names(r.statement, t)).length])
			);

		// CENSUS 1 — LOOSE. The terminal's name as a case-insensitive SUBSTRING, anywhere in a statement. This is
		// the proof of life and NOTHING MORE: a hit here may be an English participle or a fragment of an error code.
		const loose = census((statement, t) => new RegExp(t, 'i').test(statement));
		expect(
			loose,
			'the loose census must move when a rule stops naming a terminal — a zero must mean the catalog is silent, not that the reader is broken'
		).toEqual({
			// The three the cancellation family reaches. Not present in any statement, in any form.
			ABANDONED: 0,
			CANCELLED: 0,
			SKIPPED: 0,
			// The other five. THESE ARE THE PROOF OF LIFE AND NOTHING STRONGER — see the sharp census below for what
			// they actually are; two of them are English past participles and error codes, not state names.
			BASELINED: 2,
			COMPLETED: 2,
			FAILED: 2,
			SUCCEEDED: 6,
			SUPERSEDED: 4
		});

		// CENSUS 2 — SHARP. Does the terminal survive as its OWN uppercase token once the statement is split on
		// non-letters? `_` is DELIBERATELY kept as a word character, so `RPH_VALIDATION_SCHEMA_FAILED` and
		// `VALIDATOR_FAILED` tokenise whole and do not count as `ExecutionStep.stepState FAILED`; and case is kept,
		// so *"has not completed"* and *"Architecture PWU baselined"* do not count as states either.
		const sharp = census((statement, t) => statement.split(/[^A-Za-z_]+/).includes(t));
		expect(
			sharp,
			'the sharp census is the like-for-like question: five of the eight terminals are named by no rule AS A STATE, not three'
		).toEqual({
			ABANDONED: 0,
			BASELINED: 1,
			CANCELLED: 0,
			COMPLETED: 0,
			FAILED: 0,
			SKIPPED: 0,
			SUCCEEDED: 4,
			SUPERSEDED: 3
		});

		// ── THE FINDING, DERIVED FROM THE PAIR RATHER THAN RESTATED ────────────────────────────────────────────
		expect(
			terminals.filter((t) => loose[t] === 0 && sharp[t] === 0),
			'THE FINDING: the cancellation terminals are the ONLY ones absent under both matchers — not named as a state, not used as an English word, not buried in an error code. That is a stronger absence than the one this file first claimed.'
		).toEqual(['ABANDONED', 'CANCELLED', 'SKIPPED']);
		expect(
			terminals.filter((t) => (loose[t] ?? 0) > 0 && sharp[t] === 0),
			'THE CORRECTION, GATED SO IT CANNOT BE FORGOTTEN: COMPLETED and FAILED are named by no rule AS A STATE either, so the old 0-vs-2 contrast was partly an artifact of the matcher and not a fact about the catalog'
		).toEqual(['COMPLETED', 'FAILED']);
	});
});
