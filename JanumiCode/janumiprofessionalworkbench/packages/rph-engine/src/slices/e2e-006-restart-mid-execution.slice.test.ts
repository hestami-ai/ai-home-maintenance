// JAN-SLICE-SWP-03 — RPH-E2E-006, the journey where the PROCESS DIES with the work in flight and comes back.
//
// The ratified statement (`m12-conformance.json`, `sourceRef: "§24"`), verbatim:
//   "When the extension or runtime restarts during architecture generation before completion status is known, the
//    attempt state is reconciled, duplicate generation/side effects are avoided, execution resumes or is retried
//    per policy, and event history remains coherent."
//
// And the worked scenario it was distilled from — DOC-008 §24, "RPH-E2E-006 — Restart during architecture
// execution", verbatim, heading for heading:
//   Given:  "architecture generation begins."
//   When:   "the extension or runtime restarts before completion status is known."
//   Then:   "attempt state is reconciled;
//            duplicate generation or side effects are avoided;
//            execution resumes or is retried according to policy;
//            event history remains coherent."
//
// ── THE RESTART IS REAL, AND THAT IS THE FIRST THING TO CHECK ABOUT THIS FILE ────────────────────────────────
// `SL-7` forbids simulating a clause. So nothing here fakes a restart: the journey is driven into a FILE-BACKED
// `SqliteStorageAdapter`, the step is STARTED AND LEFT UNCOMPLETED, that adapter is CLOSED with its outbox
// undrained, and everything after that runs on a SECOND adapter and a SECOND `createEngine` over the same file —
// zero in-memory carry-over, exactly as `durability-roundtrip.test.ts` and `outbox-recovery.test.ts` establish the
// mechanism. Every assertion below is read back through that second engine.
//
// ⚠ AND THE FIXTURE COULD NOT BE USED WHOLE FOR THE SECOND SESSION, WHICH IS ITSELF WORTH RECORDING.
// `beginJourney` mints `evt_${++n}` and `sl-idem-${++c}` from PER-INSTANCE counters starting at 1, and
// `domain_events.event_id` is `NOT NULL UNIQUE` (persistence `schema.ts`). A second `beginJourney` over the same
// file therefore re-mints `evt_1` and re-claims `sl-idem-1` — the first would violate the unique index and the
// second would be answered `RPH_IDEMPOTENCY_CONFLICT` for a command it never issued. So session B stands up the
// same real engine with a distinct id space, inline. That is a FIXTURE limitation, not an engine one; it is
// reported as a fixture need rather than fixed here, because `slice-journey.ts` is shared with four other Slices.
//
// ── WHAT IS ASSERTED, AND WHAT IS DISCLOSED INSTEAD ──────────────────────────────────────────────────────────
// Two of the four ratified clauses hold as written and are asserted as such — (b) and (d). Two do not:
//
//   (a) "the attempt state is reconciled" is PARTIAL, and the gap is precise rather than vague. The interrupted
//       attempt IS reconstructed from the durable log, and the ratified classifier IS correct — driven below on
//       input DERIVED from the reopened engine's own event stream, not on a hand-written literal. But nothing in
//       the engine calls it, and THERE IS NOWHERE TO PUT ITS ANSWER: the ratified M11 vocab declares
//       `externalOperationId` and `reconciliationState` as fields of `executionAttempt` with their own
//       `sourceRef`s, and no contract, schema, store column or projection field was ever generated for either.
//       ⚠ AND THE GAP IS NOT THAT THE VOCABULARY LACKS THE CONCEPT — it HAS it: `RPH_EXTERNAL_OPERATION_UNCERTAIN`
//       is a ratified `RphErrorCodeSchema` member for exactly this condition, with ZERO emitters anywhere in the
//       repository. Pinned, and stated in full, in `O-a(partial)`. See `O-a(partial)`.
//   (c) "execution resumes or is retried per policy" is PARTIAL in the disjunct: RESUME is what a restart
//       licenses and is driven; RETRY is unreachable from the restarted state and is reachable only after a
//       controller DECLARES the attempt failed — which is the one judgement RPH-PER-012 says a restart must not
//       make. See `O-c(partial)`.
//
// ⚠ AND THE ANTECEDENT IS HALF UNDRIVABLE. "the extension or runtime restarts" is a disjunction, and only its
// second limb has a referent here. `ls apps/` returns exactly one entry, `rph-demo`, a SvelteKit web host; there
// is no extension package, manifest or activation event anywhere in the repository. The enforcement register says
// the same thing in its own words at `RPH-PER-013`: *"the 'extension' the rule names does not exist as a package:
// this engine ships as a web host."* So this Slice drives the RUNTIME limb and claims nothing about the other.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE — the same prohibition the E2E-001 and E2E-002 Slices record. It
// converts a false clause into a green suite, which is `SL-8`'s "weakened to green" wearing a different hat.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { ExecutionStateSchema, RphErrorCodeSchema, StepStateSchema } from '@janumipwb/rph-contracts';
import { classifyInterruptedAttempt, ENFORCEMENT_REGISTER } from '@janumipwb/rph-domain';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { executionAttempts } from '@janumipwb/rph-projections';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createEngine, type AuthedEngineHandle } from './../index.js';
import {
	beginJourney,
	changeState,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	JOURNEY_ACTOR,
	JOURNEY_TS
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'E2E-006',
	title: 'The runtime dies mid-generation, comes back, and neither repeats the work nor forgets it',
	plane: 'ENGINE',
	// ⚠ THE ROADMAP'S §9 TABLE PROPOSES THIS ASSIGNMENT AND ITS OWN PREAMBLE FORBIDS INHERITING IT — the
	// assignments "MUST be ratified in SWP-02 and SWP-03, not inherited from this table". RATIFIED HERE, with the
	// reason, and the reason is the ratified sentence's own vocabulary: the antecedent IS an interruption ("the
	// runtime restarts ... before completion status is known") and the third Then clause IS a resumption
	// ("execution resumes"). No other class fits without misdescribing the journey. It is NOT a `system-failure
	// path`: nothing failed — the work was in flight and the HOST went away, which is why the step is still
	// RUNNING and not FAILED, and why `RetryExecutionStep` is refused below. It is NOT a `data-unavailable path`:
	// the whole point is that the data IS available, from a durable store, after the process that wrote it is
	// gone. It is NOT an `alternate valid path` (E2E-002's class): there the profession reaches a different
	// VERDICT on work that ran to completion; here the same verdict is still pending and only the carrier broke.
	scenarioClass: 'interrupted or resumed path',
	citedRules: ['RPH-E2E-006'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'E2E-006-M1',
			file: 'packages/rph-projections/src/execution-attempts.ts',
			find: "ExecutionStepStarted: { kind: 'OPEN', stepIdKey: 'stepId' },",
			replace: "ExecutionStepStarted: { kind: 'OPEN', stepIdKey: 'executionStepId' },",
			expectRed: ['O-a(partial)'],
			predictedMessage:
				'the interrupted attempt must be RECONSTRUCTED from the durable log alone — one attempt, opened by the pre-crash ExecutionStepStarted',
			why: "Proves the reconstruction limb of clause (a) is asserted on the fold that actually reads the durable stream, and specifically on the per-event KEY EXTRACTOR. `ExecutionStepStarted` carries the step under `stepId` while `ExecutionStepSucceeded` carries it under `executionStepId` — the projection's own header records that these events do not agree — so a fold that read the wrong key would silently open NO attempt and the restart would have nothing to reconcile. Siting the mutant on the event TYPE instead would have proved less: `kind: 'NONE'` also reddens, but it reddens for the trivial reason that the table stopped handling the event, not for the reason the projection's header says is dangerous."
		},
		{
			id: 'E2E-006-M2',
			file: 'packages/rph-domain/src/execution.ts',
			find: "	return 'COMPLETION_UNCERTAIN';",
			replace: "	return 'DEFINITELY_NOT_STARTED';",
			expectRed: ['O-a(partial)'],
			predictedMessage:
				"RPH-PER-012's own classifier, fed the reopened engine's reconstruction, must call this attempt COMPLETION_UNCERTAIN — the classification the engine never asks for",
			why: "Proves the classifier limb of clause (a) is asserted on `classifyInterruptedAttempt`'s FALLBACK arm — the arm an interrupted attempt with no external signal actually lands in — rather than on any of the four terminal arms. ⚠ THE NARROWNESS OF THIS MUTANT IS ITSELF THE FINDING. The enforcement register records `RPH-PER-012` as UNENFORCED_DISCLOSED with `guard.kind: 'DEAD_PREDICATE'` because this function has exactly two repo-wide references, its own definition and its own unit test. This Slice is the third, and it is still not a CALLER — which is why breaking the predicate reddens one assertion here and nothing in the engine at all. A guard whose mutant cannot reach production is a guard production does not run."
		},
		{
			id: 'E2E-006-M3',
			file: 'packages/rph-application/src/command-bus.ts',
			find: 'if (prior) return this.answerFromReceipt(prior, command, base, payloadHash, correlationId);',
			replace:
				"if (prior && command.commandType === 'NoSuchCommandTypeExists') return this.answerFromReceipt(prior, command, base, payloadHash, correlationId);",
			expectRed: ['O-b'],
			predictedMessage:
				'the identical StartExecutionStep re-issued after the restart must be answered DUPLICATE from the durable command receipt, never executed a second time',
			why: "Proves clause (b)'s duplicate-GENERATION half is asserted on the receipt lookup that survives the process, not on some incidental refusal. ⚠ WITHOUT THE RECEIPT THE RE-ISSUE IS STILL REFUSED — the step is RUNNING and `StartExecutionStep` declares drivesFrom QUEUED — so a bare `expect(...).not.toBe('ACCEPTED')` would stay GREEN with idempotency entirely disabled. That is this Slice's instance of the two-guard trap: the assertion must name DUPLICATE specifically, and this mutant is what makes the difference between the two guards visible. The replacement shares no substring with the anchor's condition, so it cannot pass a `toContain` the way E2E-002-M1's first draft did."
		},
		{
			id: 'E2E-006-M4',
			file: 'packages/rph-application/src/command-bus.ts',
			find: 'this.store.markOutboxPublished(pending.map((p) => p.outboxId));',
			replace: 'this.store.markOutboxPublished([]);',
			expectRed: ['O-b'],
			predictedMessage:
				'a second recovery after the restart must deliver NOTHING — an already-published event is never re-delivered, which is what "duplicate side effects are avoided" means at the delivery seam',
			why: "Proves clause (b)'s duplicate-SIDE-EFFECT half is asserted on the CHECKPOINT (`markOutboxPublished`), the only thing that stops a second recovery re-driving the whole log. ⚠ AND THE ASSERTION IT BREAKS IS DELIBERATELY NOT `recoverOutbox() === 0` ON ITS OWN. A drain with no subscriber registered ALSO returns 0 and leaves every row PENDING (`drainOutbox`'s own docblock records that correction) — so `0` is the pass value in both worlds and the assertion could not fail. The test registers a subscriber FIRST and asserts the first recovery delivered every committed event exactly once; only then does the second recovery's `0` mean anything, and only then does this mutant redden it."
		},
		{
			id: 'E2E-006-M5',
			file: 'packages/rph-domain/src/step-command-spec.ts',
			find: "sourceStates: ['FAILED'],",
			replace: "sourceStates: ['RUNNING'],",
			expectRed: ['O-c(partial)'],
			predictedMessage:
				'RetryExecutionStep must be refused on the interrupted step because it declares drivesFrom FAILED — a restart does not licence the judgement that the attempt failed',
			why: "Proves the unreachable-disjunct limb of clause (c) is asserted on RetryExecutionStep's DECLARED source set, which is the thing that makes the retry arm unreachable from a restart. The assertion is on the refusal MESSAGE, not on the status: `RUNNING -> QUEUED` may or may not be an arrow the stepState machine declares, and a status-only assertion could not tell the declared-source refusal apart from a machine refusal — the arrangement would trip two guards and prove neither. With the source set mutated the phrase `declares drivesFrom FAILED` cannot be emitted at all, whichever guard ends up answering."
		},
		{
			id: 'E2E-006-M6',
			file: 'packages/rph-application/src/handlers/execution.ts',
			find: 'const maxAttempts = retryCapFrom(plan.retryPolicy);',
			replace: 'const maxAttempts = retryCapFrom(undefined);',
			expectRed: ['O-c(partial)'],
			predictedMessage:
				"the retry cap must come from THIS plan's declared RetryPolicy of 2 total attempts, which is the only sense the ratified phrase \"per policy\" has in this engine",
			why: "Proves the per-policy limb of clause (c) is asserted on the PLAN'S OWN RetryPolicy rather than on `DEFAULT_RETRY_CAP`. The plan in this journey declares `maxAttempts: 2` precisely because the conventional default is 3: with the policy severed the cap falls back to 3, the second retry is ACCEPTED instead of refused, and the assertion on the cap message reddens. A journey that had left `retryPolicy: {}` (as the shared fixture does) could not have distinguished the two at all — it would have read 3 either way, and this mutant would have been green."
		},
		{
			id: 'E2E-006-M7',
			file: 'packages/rph-application/src/handlers/execution.ts',
			find: 'aggregateRevision: newRevision,',
			replace: 'aggregateRevision: newRevision + 1,',
			expectRed: ['O-d'],
			predictedMessage:
				'every aggregate\'s revisions must read 0,1,2,… contiguously in log order across the restart — a gap is a history that cannot be replayed, which is what "coherent" forbids',
			why: 'Proves clause (d) is asserted on the RECORDED revision of the step events on both sides of the crash, and not merely on the log growing. The mutant is sited on the event envelope alone, so the stored object still advances normally and every command stays ACCEPTED — the journey completes, the log is append-only, the pre-crash prefix is still byte-identical, and ONLY the contiguity assertion fails. That is the point: a Slice that asserted "the log grew and nothing was rewritten" would have called this coherent.'
		}
	]
};

// ── IDS ──────────────────────────────────────────────────────────────────────────────────────────────────────
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G6T00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G6T10';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G6T20';
const EVIDENCE = 'evd_01ARZ3NDEKTSV4RRFFQ69G6T30';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G6T40';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G6T50';
const ATTEMPT = 'att_01ARZ3NDEKTSV4RRFFQ69G6T60';

/**
 * ⚠ THE PLAN DECLARES `maxAttempts: 2`, AND THAT IS LOAD-BEARING RATHER THAN ARBITRARY. `retryCapFrom` falls back
 * to `DEFAULT_RETRY_CAP` (3) for any absent or degenerate policy, and the shared fixture's `executeWork` proposes
 * `retryPolicy: {}` — so a journey borrowing it would read 3 whether or not the plan's policy was consulted, and
 * the ratified words "per policy" would be untestable. Two is the smallest cap that can be told apart from the
 * default, and the refusal message quotes it back.
 */
const DECLARED_MAX_ATTEMPTS = 2;

/**
 * THE ONE COMMAND THAT IS RE-ISSUED VERBATIM AFTER THE RESTART.
 *
 * ⚠ IT IS HAND-BUILT RATHER THAN SENT THROUGH THE FIXTURE, AND THE IDEMPOTENCY KEY IS WHY. `beginJourney`'s `send`
 * mints `sl-idem-${c}` from a private counter, so the caller cannot know — let alone reproduce — the key of any
 * act it performed. Clause (b) is about re-presenting THE SAME COMMAND to a NEW PROCESS, which requires the key to
 * be stable and stated. Every field here is fixed, so the re-issue after the restart is byte-identical: the bus
 * compares command type, target aggregate AND payload hash before answering from a receipt (`REG-F-012`), and a
 * re-issue differing in any of the three is a CONFLICT rather than a duplicate.
 */
const START_STEP: DomainCommand = {
	commandId: 'e2e006-cmd-start-step',
	commandType: 'StartExecutionStep',
	commandSchemaVersion: 1,
	targetAggregateType: 'EXECUTION_PLAN',
	targetAggregateId: PLAN,
	issuedAt: JOURNEY_TS,
	correlationId: 'slice-e2e-006',
	idempotencyKey: 'e2e006-idem-start-step',
	payload: { stepId: STEP }
};

/**
 * The acting principal, re-established after the restart.
 *
 * A restart re-establishes an identity from the same host; it does not introduce a new cast. This mirrors
 * `slice-journey.ts`'s own directory entry field for field (and `outbox-recovery.test.ts` makes the same argument
 * in its own header), so session B authenticates as the very principal that stamped every pre-crash event.
 */
const DIR = testDirectory([
	{
		...JOURNEY_ACTOR,
		executionInstanceId: 'exec-production',
		tenantId: 'tenant-test',
		organizationId: 'org-test'
	}
]);

/**
 * The ratified fields of `executionAttempt` that exist FOR restart reconciliation, DERIVED from the M11 vocab
 * rather than listed here.
 *
 * ⚠ DERIVED, BECAUSE HAND-LISTING WOULD BE THE DEFECT ONE LEVEL UP. An absence claim built on a list the author
 * typed is a claim about the author's memory. The filter keys on the CONCEPT ("reconcil") across each field's name
 * AND its note, so `externalOperationId` is caught by its note ("Observable external ID used for restart
 * reconciliation") even though its name does not contain the word — which is exactly the miss a name-only search
 * would make. The test asserts the derived list is non-empty and asserts what it derived, so a filter that
 * silently matched nothing cannot make the absence claim vacuous.
 */
const M11_RESTART_FIELDS: readonly string[] = (
	JSON.parse(
		readFileSync(
			new URL('./../../../rph-domain/vocab/m11-execution.json', import.meta.url),
			'utf8'
		)
	) as {
		executionStep: { executionAttempt: { fields: { name: string; note?: string }[] } };
	}
).executionStep.executionAttempt.fields
	.filter((f) => /reconcil/i.test(`${f.name} ${f.note ?? ''}`))
	.map((f) => f.name);

// ── THE ARRANGEMENT ──────────────────────────────────────────────────────────────────────────────────────────

interface Tracked {
	readonly store: SqliteStorageAdapter;
	open: boolean;
}

interface Resumed {
	/** The SECOND engine, over the SAME file. Nothing of session A survives in memory. */
	readonly engine: AuthedEngineHandle;
	readonly store: SqliteStorageAdapter;
	/** The whole event log exactly as it stood at the instant of the crash. */
	readonly before: ReturnType<SqliteStorageAdapter['readAllEvents']>;
	/** How many committed events were still PENDING in the outbox when the process died. */
	readonly pendingAtCrash: number;
	/** Dispatch through the reopened engine and RETURN the result unchecked. */
	readonly attempt: (
		commandType: string,
		aggregateType: string,
		aggregateId: string,
		payload: unknown
	) => ReturnType<AuthedEngineHandle['dispatch']>;
	/** Dispatch through the reopened engine and REQUIRE acceptance. */
	readonly send: (
		commandType: string,
		aggregateType: string,
		aggregateId: string,
		payload: unknown
	) => void;
	readonly state: (objectId: string) => Record<string, unknown>;
	readonly events: () => ReturnType<SqliteStorageAdapter['readAllEvents']>;
}

const temps: string[] = [];
const tracked: Tracked[] = [];

/**
 * Drive architecture generation to a step that is STARTED AND NOT COMPLETED, kill the process, and come back.
 *
 * ⚠ THE PREFIX IS INLINED RATHER THAN TAKEN FROM `executeWork`, AND THE SHARED FIXTURE'S OWN HEADER SAYS WHY IT
 * HAD TO BE. It records that the reference drive "is monolithic, with no stop-at-step-N option ... so it cannot be
 * INTERRUPTED — which is the entire antecedent of `RPH-E2E-006`". `executeWork` inherited exactly that shape: it
 * runs from `AssertClaim` to a SUCCEEDED step in one call. So the acts below are `executeWork`'s prefix, stopping
 * at `StartExecutionStep`. Reported as a fixture need; not fixed here, because that file is shared.
 *
 * ⚠ AND THE CRASH IS `close()` WITHOUT A DRAIN, WHICH IS THE HONEST SHAPE OF "before completion status is known".
 * `dispatch` commits state, events, outbox rows and the receipt atomically and delivers NOTHING; delivery is a
 * separate drain. Closing here therefore leaves every committed event durably PENDING — the state a crash between
 * commit and delivery actually produces, asserted rather than assumed in `O-antecedent`.
 */
function generationInterruptedByRestart(): Resumed {
	const dbPath = join(
		tmpdir(),
		`rph-slice-e2e006-${process.pid}-${Date.now()}-${temps.length}.db`
	);
	temps.push(dbPath);

	const storeA = new SqliteStorageAdapter({ filename: dbPath, now: () => JOURNEY_TS });
	const a: Tracked = { store: storeA, open: true };
	tracked.push(a);

	const j = beginJourney({ store: storeA });
	seedJourneyPolicy(j);
	seedIntentAndArchitecture(j, { intentId: INTENT, pwuId: PWU });
	j.send('AssertClaim', 'CLAIM', CLAIM, {
		statement: 'The architecture enforces tenant isolation',
		claimType: 'FITNESS',
		subjectObjectIds: [PWU]
	});
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
				stepType: 'TRANSFORMATION',
				purpose: 'Produce the architecture definition',
				inputBindings: [],
				outputBindings: [],
				preconditions: [],
				postconditions: [],
				stepState: 'QUEUED'
			}
		],
		transitions: [],
		retryPolicy: { maxAttempts: DECLARED_MAX_ATTEMPTS },
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

	// ARCHITECTURE GENERATION BEGINS. The attempt is open and its outcome is not recorded anywhere.
	const opened = j.engine.dispatch(START_STEP);
	if (opened.status !== 'ACCEPTED')
		throw new Error(`arrangement failed to open the attempt: ${JSON.stringify(opened)}`);
	changeState(j, PWU, {
		previousState: 'EXECUTING',
		newState: 'EXECUTING',
		executionState: 'RUNNING',
		assuranceState: 'UNASSESSED',
		supportingObjectIds: [PLAN]
	});

	const before = storeA.readAllEvents();
	const pendingAtCrash = storeA.readPendingOutbox().length;

	// ── THE CRASH ────────────────────────────────────────────────────────────────────────────────────────────
	storeA.close();
	a.open = false;

	// ── THE RESTART ──────────────────────────────────────────────────────────────────────────────────────────
	const storeB = new SqliteStorageAdapter({ filename: dbPath, now: () => JOURNEY_TS });
	tracked.push({ store: storeB, open: true });
	let n = 0;
	let c = 0;
	const engine = createEngine({
		authenticate: DIR.authenticate,
		ontology,
		store: storeB,
		now: () => JOURNEY_TS,
		// A DISTINCT ID SPACE, for the reason the file header gives: `evt_1` is already taken, durably.
		newEventId: () => `evt_restart_${++n}`
	}).as(DIR.credentialFor(JOURNEY_ACTOR.actorId));

	const attempt: Resumed['attempt'] = (commandType, aggregateType, aggregateId, payload) => {
		c += 1;
		return engine.dispatch({
			commandId: `e2e006-resumed-${c}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggregateType,
			targetAggregateId: aggregateId,
			issuedAt: JOURNEY_TS,
			correlationId: 'slice-e2e-006-resumed',
			idempotencyKey: `e2e006-resumed-idem-${c}`,
			payload
		});
	};

	return {
		engine,
		store: storeB,
		before,
		pendingAtCrash,
		attempt,
		send: (t, at, ai, p) => {
			const result = attempt(t, at, ai, p);
			if (result.status !== 'ACCEPTED')
				throw new Error(
					`resumed journey failed at ${t} (${ai}): ${result.status} ${JSON.stringify(result.error)}`
				);
		},
		state: (id) => (engine.loadObject(id)?.state ?? {}) as Record<string, unknown>,
		events: () => storeB.readAllEvents()
	};
}

/** The one step of the plan, as the reopened engine reads it back. */
const stepOf = (r: Resumed): Record<string, unknown> =>
	((r.state(PLAN).steps ?? []) as Record<string, unknown>[])[0] ?? {};

/** Step events of one type, for this step, in log order. Reads the LOG, never a projection. */
function stepEvents(
	events: readonly { eventType: string; payload?: unknown }[],
	eventType: string
): unknown[] {
	return events.filter((e) => {
		if (e.eventType !== eventType) return false;
		const p = (e.payload ?? {}) as Record<string, unknown>;
		// §16.2 names the step `executionStepId` on Succeeded and `stepId` on every other execution event; a
		// filter keying on one alone would silently return nothing for half the family.
		return p.stepId === STEP || p.executionStepId === STEP;
	});
}

/** Resume the interrupted step to SUCCEEDED. The evidence is real: `completeExecutionStep` refuses an empty result. */
function resumeToCompletion(r: Resumed): void {
	r.send('ProposeEvidence', 'EVIDENCE', EVIDENCE, {
		evidenceId: EVIDENCE,
		evidenceType: 'ARTIFACT',
		contentReference: {
			kind: 'INLINE',
			note: `Architecture definition produced by step ${STEP}, completed after the runtime restart`
		},
		producedBy: JOURNEY_ACTOR,
		supportsClaimIds: [CLAIM],
		contradictsClaimIds: [],
		scope: 'Architecture Definition',
		limitations: [],
		capturedAt: JOURNEY_TS
	});
	r.send('CompleteExecutionStep', 'EXECUTION_PLAN', PLAN, {
		executionStepId: STEP,
		executionAttemptId: ATTEMPT,
		resultStatus: 'SUCCEEDED',
		outputArtifactIds: [],
		proposedEvidenceIds: [EVIDENCE],
		detectedAssumptionIds: [],
		structuredResult: {},
		executionProvenance: { evaluator: JOURNEY_ACTOR }
	});
}

describe('SLICE E2E-006 — the runtime restarts during architecture generation', () => {
	afterEach(() => {
		for (const t of tracked.splice(0)) if (t.open) t.store.close();
		for (const p of temps.splice(0))
			for (const suffix of ['', '-wal', '-shm']) {
				const f = `${p}${suffix}`;
				if (existsSync(f)) rmSync(f);
			}
	});

	// ⚠ THE ANTECEDENT, AND IT IS A CONTROL RATHER THAN A CLAUSE. Every clause below is a statement about a world
	// in which a real restart happened with the outcome genuinely unknown; if the arrangement never reached that
	// world, four green tests would be four statements about nothing. So the world is asserted first.
	//
	// ⚠ AND THIS TEST DECLARES NO MUTANT, WHICH IS A FINDING AND NOT AN OVERSIGHT (`SL-3a`). Every production edit
	// that could falsify it — durability, the state table, the event log, `StartExecutionStep`'s declared source
	// set — also falsifies the arrangement of all four clauses, and a mutant that reddens everything proves
	// nothing about any one thing. The mechanism this control depends on has its own dedicated controls elsewhere:
	// `durability-roundtrip.test.ts` (a fresh adapter over the same file reads identical canonical state) and
	// `outbox-recovery.test.ts` (a crash with the outbox undrained). The inability to isolate it here is stated
	// rather than papered over.
	//
	// ⚠ AND ONE COMPONENT OF ONE ASSERTION IS WEAKER STILL — RECORDED HERE RATHER THAN LEFT FOR A READER TO FIND.
	// `pendingAtCrash === before.length` is true at every instant of session A and cannot be reddened by any edit
	// that leaves this arrangement standing; the note at that assertion gives the three reasons and states what it
	// therefore does and does not evidence. The other components are genuinely falsifiable: the step state is read
	// back through the REOPENED engine, the terminal-event family is an absence with its own positive control, and
	// the undelivered set is re-read through the SECOND adapter after the writing process is gone.
	it('O-antecedent (control) — the restart is REAL: a second engine over the same file finds the architecture step still RUNNING with its completion unrecorded', () => {
		const r = generationInterruptedByRestart();

		expect(
			stepOf(r).stepState,
			'the interrupted step must read RUNNING through the REOPENED engine — the attempt was opened before the crash and nothing in memory carries it'
		).toBe('RUNNING');
		// "before completion status is known" — asserted as the ABSENCE of any settling event for this step,
		// searched across the whole terminal family rather than the one this journey happens to avoid.
		expect(
			['ExecutionStepSucceeded', 'ExecutionStepFailed', 'ExecutionStepCancelled'].flatMap((t) =>
				stepEvents(r.before, t)
			),
			'no completion, failure or cancellation may have been recorded for the step — that is what "before completion status is known" means in a log-authoritative engine'
		).toEqual([]);
		// ⚠ THE POSITIVE CONTROL FOR THE ABSENCE ABOVE, and it is the reason this assertion is here rather than
		// merely nice to have: a `stepEvents` that matched nothing at all would satisfy the empty-set claim
		// vacuously. This one demands a HIT from the same helper, on the same log, for the event that must exist.
		expect(
			stepEvents(r.before, 'ExecutionStepStarted'),
			'and exactly one ExecutionStepStarted must stand in the durable log: architecture generation BEGAN, which is the scenario Given'
		).toHaveLength(1);
		// ⚠ THE OUTBOX LIMB, AND IT IS NAMED FOR WHAT IT ESTABLISHES RATHER THAN FOR WHAT IT LOOKS LIKE. It does
		// NOT establish that the crash landed BETWEEN COMMIT AND DELIVERY — an earlier draft of this file said so,
		// and nothing in this arrangement could show it, because in session A delivery never had a chance to
		// happen at all. Three facts make `pendingAtCrash === before.length` true at EVERY instant of session A,
		// crash or no crash: `dispatch` commits state, events, outbox rows and the receipt in ONE transaction and
		// delivers nothing; `drainOutbox` has exactly two callers (`recoverOutbox` and the host handle) and
		// session A invokes neither; and `beginJourney` registers no subscriber, so even an explicit drain would
		// have returned 0 and marked nothing (`drainOutbox`'s own no-subscriber arm, which leaves rows PENDING on
		// purpose). ⚠ THAT FIRST COMPONENT IS THEREFORE A CONTROL THAT CANNOT FAIL WHILE THE ARRANGEMENT STANDS,
		// and it is disclosed here rather than dressed up: the only production edit that reddens it is a mutation
		// of the outbox insert loop, which reddens O-b's whole recovery limb too, so no narrow mutant isolates it.
		//
		// ⚠ WHICH IS WHY IT IS NOT ASSERTED ALONE. The second component reads the SAME rows back through the
		// SECOND adapter, over the same file, after the process that wrote them is gone — and THAT can fail: an
		// outbox that did not survive the process, or that did not preserve delivery order, reads back empty or
		// reordered here while `pendingAtCrash` is unchanged. Together they state the true, narrower claim —
		// NOTHING WAS EVER DELIVERED AND THE WHOLE UNDELIVERED SET SURVIVED THE RESTART — which is the durable
		// precondition O-b's recovery limb consumes, pinned here so that limb's `r.before.length` is not an
		// assumption.
		expect(
			[r.pendingAtCrash, r.store.readPendingOutbox().map((m) => m.event.eventId)],
			'nothing had been delivered when the process died, and the whole undelivered set must survive it: every committed event was still PENDING at the crash, and the REOPENED store reads back those same rows, in log order'
		).toEqual([r.before.length, r.before.map((e) => e.eventId)]);
	});

	// ⚠⚠ NAMED FOR WHAT IT PROVES, NOT FOR THE CLAUSE IT WOULD LIKE TO CLAIM. The ratified clause is "the attempt
	// state is reconciled". Four things are true, and they had to be driven and grepped BOTH WAYS to be told apart:
	//
	//   1. The attempt IS reconstructed. `executionAttempts` folds the durable stream into the ratified §10.4
	//      shape, and after the restart it yields exactly one attempt, number 1, RUNNING, with no `completedAt`.
	//      Asserted. So the material a reconciler would need is available to the reopened process.
	//   2. The RATIFIED CLASSIFIER IS CORRECT, and this Slice drives it on input DERIVED FROM THE LOG rather than
	//      hand-written. That distinction is the register's own complaint about the existing coverage of
	//      RPH-PER-012: `execution.test.ts` "builds `InterruptedAttemptView` object literals BY HAND ... No
	//      engine, no store, no restart, no dispatch." Here every field of the view comes from the reopened
	//      engine's reconstruction of its own event stream.
	//   3. ⚠ AND NOTHING CALLS IT. `classifyInterruptedAttempt` has two repo-wide references — its definition and
	//      its unit test — and the enforcement register disposes `RPH-PER-012` as UNENFORCED_DISCLOSED with
	//      `guard.kind: 'DEAD_PREDICATE'`. That disposition is asserted below as a PIN: it is written to FAIL the
	//      day the rule becomes enforced, so this narrowing cannot outlive the gap it describes.
	//   4. ⚠ AND THERE IS NOWHERE TO PUT THE ANSWER, WHICH IS THE STRONGER AND MORE PRECISE FINDING. The ratified
	//      M11 vocab declares `externalOperationId` ("Observable external ID used for restart reconciliation",
	//      sourceRef "Persistence §10.4; §35") and `reconciliationState` ("Set on restart when completion is
	//      uncertain", sourceRef "Persistence §10.4; RPH-PER-012") as FIELDS OF `executionAttempt`. Neither was
	//      ever generated. GREPPED IN BOTH DIRECTIONS, and both directions are recorded because an ABSENT verdict
	//      that is really PRESENT is the worst outcome available here:
	//        • by FIELD NAME — `externalOperationId|reconciliationState|external_operation_id|reconciliation_state`
	//          across `packages/` returns FOUR files: the M11 vocab (the ratified declaration itself),
	//          `rph-domain/src/execution.ts` (the dead classifier's INPUT interface), that file's own unit test,
	//          and the enforcement register's disclosure. NOT `rph-contracts` (no schema), NOT `rph-persistence`
	//          (no column), NOT `rph-projections` (no view field).
	//        • by CONCEPT — `reconcil|resume|recover` across `rph-contracts/src` non-test sources returns only
	//          `recoveryReason`/`recoveredFrom` on `UnblockPwu`/`PwuUnblocked` (a PWU leaving BLOCKED — a
	//          different subject entirely) and the string `'interrupted or resumed path'`, which is a scenario
	//          CLASS LABEL. And of the 106 members of `COMMANDS`, ZERO match
	//          `recon|resum|recover|uncert|doubt|restart|idempot`: there is no Reconcile, Resume or Recover
	//          command for a controller to issue.
	//        • ⚠ AND THAT CONCEPT SEARCH WAS NARROWER THAN THE CONCEPT, WHICH IS CORRECTED HERE RATHER THAN LEFT
	//          STANDING. `reconcil|resume|recover` does not contain `uncert`, and over `rph-contracts/src` that
	//          is the one word that returns something: `RPH_EXTERNAL_OPERATION_UNCERTAIN` is a RATIFIED member of
	//          `RphErrorCodeSchema` (`rph-contracts/src/errors.ts`), categorised `EXTERNAL_DEPENDENCY`, and
	//          generated into `schemas/objects/RphError.json` and `vocab/canonical-vocabulary.json`. So THE
	//          RATIFIED VOCABULARY DOES HAVE A WORD FOR "WE DO NOT KNOW". The ABSENT verdict is not falsified by
	//          it — it is SHARPENED, and the other direction was checked too: that code's only repo references
	//          are its own declaration, its category map, those generated artifacts, and
	//          `enforcement-register.ts`, which names it as one of RPH-PER-012's "FOUR NEAR-MISSES". ZERO
	//          EMITTERS — no handler, no guard, no kernel function ever returns it. That is the same shape as the
	//          two M11 fields this test pins: ratified, then never wired. Asserted in (5) rather than only
	//          written, DERIVED from the enum with the same three concept words the closed-set limb uses.
	//          ⚠ WHAT A READER MUST NOT TAKE FROM THIS SLICE: that the vocabulary has no word for uncertainty. It
	//          has exactly one, and the gap is that nothing ever says it.
	//        • by CLOSED SET — asserted below rather than grepped, because these are the only two enums a
	//          reconciliation state could live in: `StepStateSchema` (10 members) and `ExecutionStateSchema` (10
	//          members) contain no RECONCILING, UNCERTAIN or IN_DOUBT member.
	//
	// So the clause is asserted at the level where it is true (the attempt is reconstructible and classifiable)
	// and disclosed at the level where it is not (nothing classifies it, and no field could hold the result).
	// WHAT A READER MUST NOT CONCLUDE FROM THIS GREEN: that any restart in this engine reconciles anything. It
	// does not. It reconstructs.
	it('O-a(partial) — the interrupted attempt is RECONSTRUCTED from the durable log and the ratified classifier calls it COMPLETION_UNCERTAIN; nothing in the engine asks, and no field exists to record the answer', () => {
		const r = generationInterruptedByRestart();

		// (1) Reconstruction, from the reopened engine's event log alone.
		const attempts = executionAttempts(r.events(), { [STEP]: 'TRANSFORMATION' });
		expect(
			attempts,
			'the interrupted attempt must be RECONSTRUCTED from the durable log alone — one attempt, opened by the pre-crash ExecutionStepStarted'
		).toHaveLength(1);
		// ⚠ READ AS AN OPEN BAG, THROUGH `unknown`, AND BOTH HALVES OF THAT ARE DELIBERATE. The bag is what makes
		// the `f in attempt` probe below meaningful: the two M11 fields are absent from `ExecutionAttemptView` BY
		// HYPOTHESIS, so a typed read would be a compile error rather than the measurement this test is making.
		// The `unknown` hop is required and not cosmetic — `ExecutionAttemptView` is an interface and so carries no
		// implicit index signature, and `attempts[0]` is `| undefined` under `noUncheckedIndexedAccess`; the direct
		// cast this line used to carry was a TS2352 that `vitest` never sees because it transpiles without type
		// checking. The identity of the object is preserved, so `in` still reads the RECONSTRUCTED attempt itself
		// rather than a copy, and the `toHaveLength(1)` directly above is what licenses index 0.
		const attempt = attempts[0] as unknown as Record<string, unknown>;
		expect(
			[attempt.attemptNumber, attempt.state, attempt.completedAt, attempt.idempotencyKey],
			'and it must come back as attempt 1, still RUNNING, still open, under the §10.4 functional idempotency key — a nonterminal attempt is exactly what Persistence §35 says a restart must classify'
		).toEqual([1, 'RUNNING', undefined, `${STEP}#1`]);

		// (2) The ratified classifier, fed the reconstruction rather than a literal.
		expect(
			classifyInterruptedAttempt({
				// Every limb DERIVED from the reconstruction, never asserted by this test: `startedAt` is written
				// only by the fold's OPEN effect, so it IS the log's statement that the attempt began.
				started: attempt.startedAt !== undefined,
				localResultRecorded: attempt.state === 'SUCCEEDED',
				localErrorRecorded: attempt.error !== undefined
			}),
			"RPH-PER-012's own classifier, fed the reopened engine's reconstruction, must call this attempt COMPLETION_UNCERTAIN — the classification the engine never asks for"
		).toBe('COMPLETION_UNCERTAIN');

		// (3) PINNED DISCLOSURE, not a certification. This assertion is written to FAIL the day RPH-PER-012 is
		// enforced, so the narrowing in this test's name cannot outlive the gap it describes.
		//
		// ⚠ ALL THREE KEYED FIELDS ARE PINNED, BECAUSE `kind` ALONE IS THE WRONG ONE TO PIN. The prose above
		// (item 3), the file header and E2E-006-M2's `why` all rest on `guard.kind: 'DEAD_PREDICATE'` with
		// `deadPredicate: 'classifyInterruptedAttempt'` — and it is the GUARD, not the disposition, that the
		// register's own companion gate makes checkable: `enforcement-register.test.ts` greps the tree for that
		// predicate's production references and asserts them against `referencedOnlyBy`, so wiring the predicate
		// into a handler reddens THERE. The same gate actively pushes a DEAD_PREDICATE row whose census already
		// names a command-layer file toward an OBSERVED_ADMISSION guard — and such a re-disposition leaves `kind`
		// at UNENFORCED_DISCLOSED. A `kind`-only pin would therefore have stayed GREEN while the stated ground for
		// the "(partial)" in this test's name (a dead predicate that nothing calls) had silently changed
		// underneath it, which is the disclosure outliving one of the two facts it rests on.
		const per012 = ENFORCEMENT_REGISTER['RPH-PER-012'];
		const per012Guard = per012.kind === 'UNENFORCED_DISCLOSED' ? per012.guard : undefined;
		expect(
			[
				per012.kind,
				per012Guard?.kind,
				per012Guard?.kind === 'DEAD_PREDICATE' ? per012Guard.deadPredicate : undefined
			],
			'PINNED DISCLOSURE: RPH-PER-012 is disposed UNENFORCED_DISCLOSED with a DEAD_PREDICATE guard over classifyInterruptedAttempt. Enforce it — or re-dispose that guard to OBSERVED_ADMISSION — and this assertion is what tells you the "(partial)" in this test name is now stale.'
		).toEqual(['UNENFORCED_DISCLOSED', 'DEAD_PREDICATE', 'classifyInterruptedAttempt']);

		// (4) The absence, with its own positive control so it cannot pass vacuously.
		expect(
			M11_RESTART_FIELDS,
			'the ratified M11 vocab must actually declare fields FOR restart reconciliation — if this derivation matched nothing, the absence claimed below would be a claim about a broken filter'
		).toEqual(['externalOperationId', 'reconciliationState']);
		expect(
			M11_RESTART_FIELDS.filter((f) => f in attempt),
			'PINNED GAP: no ratified restart-reconciliation field reaches the reconstructed attempt — the engine has no place to record that this attempt was reconciled, or how'
		).toEqual([]);
		// ⚠ THE TWO ENUMS ARE THE CLOSED SETS, and their SIZE is asserted first for the same reason the M11
		// derivation's non-emptiness is: a search over an empty vocabulary finds nothing and proves nothing.
		const stateVocabulary = [...StepStateSchema.options, ...ExecutionStateSchema.options];
		expect(
			stateVocabulary.length,
			'control: the two ratified state vocabularies an attempt could be moved into must be non-empty, or the absence claimed next is a claim about an empty search'
		).toBe(20);
		expect(
			stateVocabulary.filter((s) => /RECONCIL|UNCERTAIN|DOUBT/.test(s)),
			'and neither ratified state enum has a member an uncertain attempt could be moved INTO — there is no state for "we do not know", only for outcomes we do'
		).toEqual([]);

		// (5) ⚠ THE ONE PLACE THE VOCABULARY DOES CARRY THE CONCEPT, PINNED SO THIS SLICE CANNOT BE READ AS
		// CLAIMING OTHERWISE. Searched with the SAME three concept words as the closed-set limb above, over the
		// ratified error enum instead of the two state enums — and there the search is NOT empty. The absence this
		// test records is therefore narrower and worse than "the engine has no word for it": it has the word, as a
		// ratified error code, and nothing in the repository ever emits it (checked in both directions; its only
		// references are its declaration, its category map, the generated artifacts, and the enforcement register's
		// own "FOUR NEAR-MISSES" note for RPH-PER-012). The emitter census is offline and stated; what is pinned
		// live is that the word exists and that there is exactly ONE of it — so a reader cannot come away from a
		// green run believing the vocabulary is silent on uncertainty.
		// ⚠ AND IT DECLARES NO MUTANT (`SL-3a`), which is the finding restated rather than an omission: the only
		// edit that could redden it is deleting or renaming a ratified enum member. There is no production code
		// path to mutate here, BECAUSE THERE IS NO PRODUCTION CODE PATH — that is precisely what "zero emitters"
		// means, and a guard with no call site has nothing a mutant can reach.
		expect(
			RphErrorCodeSchema.options.filter((c) => /RECONCIL|UNCERTAIN|DOUBT/.test(c)),
			'the ratified error vocabulary must carry exactly one word for an unresolved external outcome — RPH_EXTERNAL_OPERATION_UNCERTAIN exists for precisely this condition, which is why the gap is a missing EMITTER and a missing FIELD rather than a missing word'
		).toEqual(['RPH_EXTERNAL_OPERATION_UNCERTAIN']);
	});

	// Clause (b), and it holds as ratified — at BOTH the levels the clause names, which are different mechanisms
	// that a single assertion would have conflated:
	//
	//   • DUPLICATE GENERATION is stopped by `command_receipts`, which is durable and therefore survives the
	//     process. The identical `StartExecutionStep` re-presented to the new engine is answered DUPLICATE from
	//     the receipt, carrying the ORIGINAL event id, and no second event is written.
	//   • DUPLICATE SIDE EFFECTS are stopped by the outbox checkpoint. Every event committed before the crash was
	//     still PENDING; recovery delivers each exactly once, and a second recovery delivers nothing.
	//
	// ⚠ THE `DUPLICATE` STATUS IS ASSERTED BY NAME, AND A WEAKER ASSERTION WOULD HAVE PROVED NOTHING. The re-issue
	// is refusable on a second, entirely independent ground — the step is RUNNING and `StartExecutionStep`
	// declares drivesFrom QUEUED — so `not.toBe('ACCEPTED')` would stay green with idempotency wholly disabled.
	// That is the two-guard trap, and E2E-006-M3 is what tells the two apart.
	//
	// ⚠ AND THE OUTBOX HALF IS NOT ASSERTED AS `recoverOutbox() === 0`. A drain with NO SUBSCRIBER also returns 0
	// and leaves every row PENDING — `drainOutbox`'s own docblock records that correction — so 0 is the pass value
	// in both worlds and such an assertion could not fail. The subscriber is registered FIRST and the FIRST
	// recovery is asserted to have delivered every committed event exactly once.
	it('O-b — the identical command re-issued after the restart is answered from the durable receipt, and recovery delivers each committed event exactly once', () => {
		const r = generationInterruptedByRestart();
		const startedEventIds = r.before
			.filter((e) => e.eventType === 'ExecutionStepStarted')
			.map((e) => e.eventId);

		// (1) The same command, to a new process.
		const reissued = r.engine.dispatch(START_STEP);
		expect(
			reissued.status,
			'the identical StartExecutionStep re-issued after the restart must be answered DUPLICATE from the durable command receipt, never executed a second time'
		).toBe('DUPLICATE');
		expect(
			reissued.producedEventIds,
			'and the answer must carry the ORIGINAL event id — a duplicate returns the prior result, it does not manufacture a new one'
		).toEqual(startedEventIds);

		// (2) No second generation. Read from the LOG, which is authoritative, rather than from any projection.
		expect(
			r.events(),
			'the durable log must not have grown by a single event: a duplicate emits none'
		).toHaveLength(r.before.length);
		expect(
			stepEvents(r.events(), 'ExecutionStepStarted'),
			'and the step must still have been started exactly ONCE — attemptsMade is defined as the count of ExecutionStepStarted, so a second one IS a duplicate generation'
		).toHaveLength(1);

		// (3) A DIFFERENTLY-KEYED re-issue is refused too, by a different guard, and the message says which.
		// ⚠ THIS LIMB DECLARES NO MUTANT AND CANNOT HONESTLY HAVE ONE: any mutation of `StartExecutionStep`'s
		// declared source set also breaks the act that OPENS the attempt in the arrangement, reddening every
		// clause in this file. The declared-source guard is isolated instead by
		// `execrem-wp9-source-state-battery.test.ts`, one per command.
		const freshKey = r.attempt('StartExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
		expect(
			JSON.stringify(freshKey.error ?? {}),
			'a re-issue under a NEW idempotency key gets past the receipt and is stopped by the machine instead — it must name the declared source set, because that is a different defence from the receipt'
		).toContain('declares drivesFrom QUEUED');

		// (4) Side effects: delivered exactly once across the restart, and never again.
		const delivered: string[] = [];
		r.engine.subscribe((e) => delivered.push(e.eventId));
		const recovered = r.engine.recoverOutbox();
		expect(
			[recovered, delivered.length, new Set(delivered).size],
			'recovery must re-drive every event the crash left undelivered, exactly once each — the count, the deliveries and the DISTINCT deliveries must all agree, or "exactly once" is not what happened'
		).toEqual([r.before.length, r.before.length, r.before.length]);
		expect(
			[r.engine.recoverOutbox(), delivered.length],
			'a second recovery after the restart must deliver NOTHING — an already-published event is never re-delivered, which is what "duplicate side effects are avoided" means at the delivery seam'
		).toEqual([0, r.before.length]);
	});

	// ⚠⚠ NAMED FOR WHAT IT PROVES. The ratified clause is a DISJUNCTION — "execution resumes OR is retried per
	// policy" — and the two arms are not equally available after a restart. Three things, driven:
	//
	//   1. RESUME IS WHAT THE RESTART LICENSES, and it works. The step is RUNNING, `CompleteExecutionStep`
	//      declares drivesFrom RUNNING, and the reopened engine completes the very attempt the dead process
	//      opened — one Started, one Succeeded, no second attempt.
	//   2. RETRY IS UNREACHABLE FROM THE RESTARTED STATE. `RetryExecutionStep` declares drivesFrom FAILED, so
	//      reaching it requires a `FailExecutionStep` — a controller JUDGEMENT that the attempt failed, which is
	//      precisely the judgement RPH-PER-012 forbids a restart to make ("must not blindly repeat the side
	//      effect"). The refusal MESSAGE is asserted, not the status: `RUNNING -> QUEUED` might be refused by the
	//      state machine as well, and a status-only assertion could not tell the two guards apart.
	//   3. "PER POLICY" MEANS EXACTLY ONE KEY. `retryCapFrom` reads `maxAttempts` off the plan's RetryPolicy bag
	//      and nothing else — the bag has no ratified field list at all (JAN-CAPBIND DS-001) — so the third limb
	//      drives the retry arm to its cap in a SECOND journey, one where a controller HAS declared the attempt
	//      failed, and asserts the refusal quotes THIS PLAN'S declared cap of 2 rather than the conventional
	//      default of 3.
	//
	// WHAT A READER MUST NOT CONCLUDE FROM THIS GREEN: that a restart retries anything. It does not, and it must
	// not. Limb 3 is reached by a controller's explicit failure judgement, not by the restart.
	it('O-c(partial) — execution RESUMES across the restart as the same attempt; the retry arm is unreachable without a failure judgement the restart never made, and its cap is the plan\'s declared policy', () => {
		const r = generationInterruptedByRestart();

		// (2) first, because completing the step would make the retry refusal uninteresting.
		const retry = r.attempt('RetryExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
		expect(
			JSON.stringify(retry.error ?? {}),
			'RetryExecutionStep must be refused on the interrupted step because it declares drivesFrom FAILED — a restart does not licence the judgement that the attempt failed'
		).toContain('declares drivesFrom FAILED');

		// (1) Resume. The same attempt, finished by a different process.
		resumeToCompletion(r);
		expect(
			stepOf(r).stepState,
			'the interrupted step must reach SUCCEEDED through the REOPENED engine — that is what "execution resumes" means when the process that started it is gone'
		).toBe('SUCCEEDED');
		expect(
			[
				stepEvents(r.events(), 'ExecutionStepStarted').length,
				stepEvents(r.events(), 'ExecutionStepSucceeded').length
			],
			'and it must be the SAME attempt: one Started and one Succeeded, so the resumed work was finished rather than re-run'
		).toEqual([1, 1]);

		// (3) The retry arm, in a second journey where a controller HAS declared the failure. Two attempts are
		// permitted by the plan; the third request is refused, and the refusal quotes the plan's own cap.
		const s = generationInterruptedByRestart();
		s.send('FailExecutionStep', 'EXECUTION_PLAN', PLAN, {
			stepId: STEP,
			failureReason: 'the response to the generation call was never observed'
		});
		s.send('RetryExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
		s.send('StartExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
		s.send('FailExecutionStep', 'EXECUTION_PLAN', PLAN, {
			stepId: STEP,
			failureReason: 'the second generation call was not observed either'
		});
		const capped = s.attempt('RetryExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
		expect(
			JSON.stringify(capped.error ?? {}),
			`the retry cap must come from THIS plan's declared RetryPolicy of ${String(DECLARED_MAX_ATTEMPTS)} total attempts, which is the only sense the ratified phrase "per policy" has in this engine`
		).toContain(`the retry cap (${String(DECLARED_MAX_ATTEMPTS)} total attempts) is reached`);
	});

	// Clause (d), and it holds as ratified. "Coherent" is asserted as three separable properties, because the
	// weakest of them is the one a careless Slice would settle for:
	//
	//   • APPEND-ONLY — the pre-crash log is byte-identical afterwards. Nothing was rewritten, reordered or
	//     re-stamped by the process that inherited it.
	//   • CONTIGUOUS — every aggregate's revisions read 0,1,2,… in log order. A gap is a history that cannot be
	//     replayed, and the envelope contract says `aggregateRevision` "must equal prior + 1".
	//   • CONTINUED — the post-restart event on the plan carries the pre-crash revision PLUS ONE. The reopened
	//     engine holds nothing in memory, so this number can only have come from the durable log.
	//
	// ⚠ THE FIRST PROPERTY ALONE WOULD HAVE BEEN A FALSE COMFORT, which is why E2E-006-M7 is sited where it is: a
	// mutant that gaps every step event's recorded revision leaves the prefix byte-identical and the log
	// append-only, and only the contiguity assertion notices.
	it('O-d — event history remains coherent across the restart: the pre-crash log is byte-identical, the new events are appended, and the plan aggregate continues at prior + 1', () => {
		const r = generationInterruptedByRestart();
		const planRevisionBefore = Math.max(
			...r.before.filter((e) => e.aggregateId === PLAN).map((e) => e.aggregateRevision)
		);

		resumeToCompletion(r);
		const after = r.events();

		// APPEND-ONLY.
		expect(
			after.slice(0, r.before.length),
			'every event committed before the crash must survive the restart UNCHANGED, in order — an engine that re-stamps inherited history cannot be replayed against its own past'
		).toEqual(r.before);
		expect(
			after.length,
			'and the resumed work must have been APPENDED: the evidence and the completion are two new events on the end, not a rewrite'
		).toBe(r.before.length + 2);

		// CONTIGUOUS.
		const revisionsByAggregate = new Map<string, number[]>();
		for (const e of after)
			revisionsByAggregate.set(e.aggregateId, [
				...(revisionsByAggregate.get(e.aggregateId) ?? []),
				e.aggregateRevision
			]);
		const gapped = [...revisionsByAggregate.entries()].filter(
			([, revs]) => !revs.every((rev, i) => rev === i)
		);
		expect(
			gapped,
			'every aggregate\'s revisions must read 0,1,2,… contiguously in log order across the restart — a gap is a history that cannot be replayed, which is what "coherent" forbids'
		).toEqual([]);

		// CONTINUED.
		const resumedPlanEvent = after
			.slice(r.before.length)
			.find((e) => e.aggregateId === PLAN && e.eventType === 'ExecutionStepSucceeded');
		expect(
			resumedPlanEvent?.aggregateRevision,
			'the completion written by the SECOND process must carry the plan\'s pre-crash revision plus one — with nothing in memory, that number can only have come from the durable log'
		).toBe(planRevisionBefore + 1);
	});
});
