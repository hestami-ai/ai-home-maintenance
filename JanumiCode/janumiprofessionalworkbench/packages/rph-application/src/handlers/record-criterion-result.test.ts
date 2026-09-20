// ⭐⭐ `JAN-CRITREAD` L3 `CB-02` — §32's LAST UNBUILT COMMAND THAT THIS ENGINE REACHES, DRIVEN.
//
// `completeAssuranceAssessment` has carried this note since its boundary was written: *"Criterion results ARE
// still dropped at the boundary: `recordCriterionResult` was never built."* It is built now, and this file is
// the drive that makes that true rather than declared.
//
// ⛔ THIS FILE IS ALSO WHAT MAKES THE DECLARATION LEGAL. `verif/command-dispatch-census.test.ts` refuses any
// `COMMANDS` key no test drives, and its `UNDRIVEN` allowance is empty by design — "driven" meaning the
// PascalCase name appears as a quoted literal in a `*.test.ts`. A production dispatcher does not count. So the
// vocabulary entry, the handler and this file are ONE commit; they cannot be separated.
//
// ⚠ AND THE PAYLOAD IS AUTHORED, NOT RATIFIED. §31 ratifies the event NAME `AssuranceCriterionEvaluated` and
// DOC-007 schematizes no interface for it; §31's own composition note classifies exactly that condition-set —
// *"a schema-and-wiring task, NOT a ratification decision."* The fields exist to source `RPH-CON-005`'s
// coverage question and `RPH-ASR-005`'s disposition question, and nothing here claims the shape is canon.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-09-20T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5C00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5C01';
const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5C02';
const POLICY = 'pol_criterion_recording';

/** ⭑ THE SEEDED POLICY DECLARES EXACTLY ONE CRITERION, `C1` (see `floor-fixtures.ts`). That is what makes the
 *  undeclared-criterion test meaningful: any other id is genuinely not in the rubric. */
const DECLARED = 'C1';

/** The §30 `READY -> ASSESSING` arrow names TWO acts, and both are driven below rather than skipped:
 *  selecting WHO assesses, then beginning. An arrangement that silently skipped the first would leave
 *  the assessment with no evaluator while still reaching ASSESSING — which it does, measurably. */
const EVALUATOR: ActorReference = {
	actorId: 'reviewer-crit',
	actorType: 'AGENT',
	displayName: 'Criterion Reviewer',
	modelId: 'model-x'
};

describe('⛔ RecordCriterionResult (DOC-004 §32) — the criterion results that used to be dropped', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_ASSESSMENT',
			targetAggregateId: ASSESS,
			issuedAt: TS,
			correlationId: 'corr-crit',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		});
	};

	const stateOf = () => store.loadObject(ASSESS)?.state as Record<string, unknown>;
	const evaluatedEvents = () =>
		store
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceCriterionEvaluated')
			.map((e) => e.payload as Record<string, unknown>);

	/** Drive READY -> ASSESSING through the two ratified acts the §30 arrow names. */
	const beginAssessing = () => {
		// ⛔ ASSERTED, NOT ASSUMED. The first draft passed `TEST_CRED.human.actor` — `undefined`, because
		// TEST_CRED holds bare credential STRINGS — so SelectAssuranceEvaluator was refused on every test
		// and the assessment reached ASSESSING anyway via Begin alone. Every assertion still passed or
		// failed for reasons unrelated to the evaluator. `REG-F-015`'s guard caught it: *“DISPATCH REFUSED
		// AND NEVER READ … if it was an arrangement, the arrangement did not happen and nothing here could
		// tell.”* A broken fixture IS the tell, and this is the line that makes it one.
		expect(dispatch('SelectAssuranceEvaluator', { evaluator: EVALUATOR }).status).toBe('ACCEPTED');
		expect(dispatch('BeginAssuranceAssessment', {}).status).toBe('ACCEPTED');
	};

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(TEST_CRED.human);
		seedPolicy(engine, POLICY);
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			{ targetAggregateId: INTENT, targetAggregateType: 'INTENT' }
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'T',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'LOW',
					uncertainty: 'LOW',
					irreversibility: 'LOW',
					securitySensitivity: 'NONE',
					regulatoryExposure: 'NONE'
				}
			},
			{ targetAggregateId: PWU, targetAggregateType: 'PROFESSIONAL_WORK_UNIT' }
		);
		dispatch('RequestAssuranceAssessment', {
			assessmentId: ASSESS,
			assurancePolicyId: POLICY,
			policyVersion: '1.0.0',
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimIds: []
		});
	});

	it('⭐ CONTROL — a declared criterion on an ASSESSING assessment is ACCEPTED and appends exactly one event', () => {
		beginAssessing();
		const before = stateOf();
		const r = dispatch('RecordCriterionResult', {
			criterionId: DECLARED,
			result: 'MET',
			rationale: 'the subject is fit for its approved need'
		});

		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');

		const events = evaluatedEvents();
		expect(events.length, 'exactly one criterion result was recorded').toBe(1);
		expect(events[0]).toMatchObject({
			assessmentId: ASSESS,
			criterionId: DECLARED,
			result: 'MET',
			rationale: 'the subject is fit for its approved need'
		});

		// ⛔ NO STATE DELTA — the judgement lives on the EVENT. This is the invariant that distinguishes the
		// chosen template (`submitEvidenceForAssessment`) from the rejected one (`recordAssuranceObservation`,
		// which mints a separate aggregate the assessment never sees).
		expect(
			stateOf().assessmentState,
			'recording a criterion result moved the state machine'
		).toBe(before.assessmentState);
	});

	it('⭐ the optional rationale is ABSENT when not supplied, never empty-stringed', () => {
		// ⚠ `rationale` is optional exactly as the sibling's `evidenceType` is, and the floor supplies one only
		// on failure (`validators.ts`). An absent rationale must stay absent: `''` would be a statement the
		// evaluator did not make.
		beginAssessing();
		expect(dispatch('RecordCriterionResult', { criterionId: DECLARED, result: 'NOT_APPLICABLE' }).status).toBe(
			'ACCEPTED'
		);
		expect(Object.keys(evaluatedEvents()[0] ?? {})).not.toContain('rationale');
	});

	it('⛔ refuses a criterion the policy does not declare, and NAMES it', () => {
		// THE MUTANT THAT KILLS THIS: drop the `declared.has(...)` guard. A result recorded against a criterion
		// the rubric never contained would answer a question nobody asked — and would count toward coverage of a
		// rubric it is not part of, which is precisely what RPH-CON-005 exists to refuse.
		beginAssessing();
		const r = dispatch('RecordCriterionResult', { criterionId: 'C-NOT-DECLARED', result: 'MET' });

		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message, 'the refusal must name the criterion it refused').toContain('C-NOT-DECLARED');
		expect(r.error?.message).toContain('not a criterion the assessment');
		expect(evaluatedEvents().length, 'a refused command must append nothing').toBe(0);
	});

	it('⛔ refuses a result recorded before the assessment is ASSESSING', () => {
		// ⭑ THE WINDOW IS NARROWER THAN THE EVIDENCE HANDLER'S ON PURPOSE. Evidence may arrive in
		// EVIDENCE_PENDING or READY because it is an INPUT to a verdict not yet given. A criterion result is a
		// piece of the verdict itself, so its window is the state in which judging happens.
		//
		// THE MUTANT: widen this to `submitEvidenceForAssessment`'s OPEN_FOR_EVIDENCE and this reddens.
		const r = dispatch('RecordCriterionResult', { criterionId: DECLARED, result: 'MET' });

		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain('not ASSESSING');
		expect(evaluatedEvents().length).toBe(0);
	});

	it('⛔ refuses a result against an assessment that does not exist', () => {
		// ⭑ THE AGGREGATE IS THE ASSESSMENT, so a criterion result addressed to a non-existent one must be
		// refused before any policy is consulted — otherwise the handler would load a policy for an assessment
		// that never existed and refuse on the WRONG ground, naming the criterion rather than the aggregate.
		const r = dispatch(
			'RecordCriterionResult',
			{ criterionId: DECLARED, result: 'MET' },
			{ targetAggregateId: 'assess_01ARZ3NDEKTSV4RRFFQ69G5CZZ' }
		);

		expect(r.status).toBe('REJECTED');
		expect(r.error?.message, 'the refusal must name the missing aggregate, not the criterion').toContain(
			'does not exist'
		);
		expect(evaluatedEvents().length).toBe(0);
	});

	it('⛔ refuses an outcome outside the ratified CriterionResultOutcome vocabulary', () => {
		// The enum is DERIVED from the ratified `CriterionResultOutcomeSchema` in the vocabulary entry rather
		// than restated, so this is the contract boundary refusing, not a hand-written list.
		beginAssessing();
		const r = dispatch('RecordCriterionResult', { criterionId: DECLARED, result: 'PROBABLY_FINE' });

		// ⭑ AND IT IS REFUSED AT THE CONTRACT BOUNDARY, NOT BY THE HANDLER — `VALIDATION_FAILED` with
		// `RPH_VALIDATION_SCHEMA_FAILED`, before any handler line runs. That is the point of deriving the
		// field from `CriterionResultOutcomeSchema` in the vocabulary rather than checking it in code: the
		// enum cannot drift from canon, because the handler never restates it.
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
		expect(evaluatedEvents().length).toBe(0);
	});

	it('⭐ records several criteria independently, so coverage is a FOLD rather than a single write', () => {
		// ⛔ WHY THIS EXISTS: `RPH-CON-005`'s question is "were ALL mandatory criteria answered?", which is only
		// answerable if each answer is its own durable record. One event per criterion is what makes the fold
		// possible — and a handler that overwrote a previous result would make the coverage question unanswerable
		// without anything going red elsewhere.
		beginAssessing();
		dispatch('RecordCriterionResult', { criterionId: DECLARED, result: 'PARTIALLY_MET' });
		dispatch('RecordCriterionResult', { criterionId: DECLARED, result: 'MET' });

		const events = evaluatedEvents();
		expect(events.length, 'each recording is its own durable event').toBe(2);
		expect(events.map((e) => e.result)).toEqual(['PARTIALLY_MET', 'MET']);
	});
});
