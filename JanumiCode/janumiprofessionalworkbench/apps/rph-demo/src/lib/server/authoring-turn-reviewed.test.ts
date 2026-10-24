// ── AN AUTHORING TURN REVIEWED BY A REAL REVIEWER CAN BE ACCEPTED (`JAN-CRITREAD` `TT-2`, `REG-F-425`) ──────────
//
// THE DEFECT: every real review writes its try to the CANONICAL log as a `MODEL_EXCHANGE` record — deliberately
// (`floor.ts`'s drain; PER-9 / `REG-D-055`: a try that was made is recorded even if the turn is discarded) — and the
// turn's commit guard refused any growth of that log since the turn began. So every real-reviewer turn refused its
// own candidate: `CONFLICTED "@event-log changed from revision N to N+1."` The mock reviewer never captures, which
// is why no gated lane saw it.
//
// ⭐ THESE TESTS DRIVE THE PRODUCTION COMPOSITION, NOT A HAND-WIRED ONE. The module engine (`resetEngine`), the
// turn's DEFAULT canonical handle, and `runPwaFloor` called with NO `canonical` — exactly as the agent route calls
// it (`agent/+server.ts`). Only the model call is replaced, through the validator's own `print` seam, by a reviewer
// that returns a well-formed judgement — the assurance OUTCOME is not the subject here; the COMMIT is.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { listByType, listPwuTypes, type AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_CREDENTIAL } from './identity.js';
import { getEngine, mintUiId, resetEngine } from './workbench.js';
import {
	beginAuthoringTurn,
	canonicalActsOf,
	clearAuthoringTurns,
	commitAuthoringTurn,
	declaredDependenciesOf,
	discardAuthoringTurn,
	markAuthoringTurnAssured,
	markAuthoringTurnRevisionRequired,
	markAuthoringTurnValid,
	resumeAuthoringTurn,
	type AuthoringTurn
} from './authoring-turn.js';
import { reasoningReviewCriteria, runPwaFloor, type FloorProducer } from './floor.js';
import { clearingJudgement, withLiveReviewerSeam } from './assurance/clearing-reviewer.testing.js';

const TS = '2026-09-22T09:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00';
const OTHER_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P01';
const PRODUCER: FloorProducer = {
	agentId: 'jpwb-authoring-agent',
	modelId: 'pi-authoring',
	providerId: 'janumi'
};

let session: AuthedEngineHandle;
let sequence = 0;

function createPwa(pwaId: string, name: string): void {
	sequence += 1;
	const command: DomainCommand = {
		commandId: `setup-${sequence}`,
		commandType: 'CreatePwa',
		commandSchemaVersion: 1,
		targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		targetAggregateId: pwaId,
		issuedAt: TS,
		correlationId: 'setup',
		idempotencyKey: `setup-idem-${sequence}`,
		payload: {
			pwaId,
			name,
			description: 'A DRAFT PWA authored by a turn.',
			domain: 'software',
			version: '1.0.0'
		}
	};
	expect(session.dispatch(command).status).toBe('ACCEPTED');
}

/** A reviewer that answers every criterion, clean — the review's CONTENT is not what these tests are about. */
const clearing = async () => clearingJudgement(reasoningReviewCriteria(session));
/** First reply unparseable, then clean: the validator's repair path, so ONE floor run records TWO tries. */
function repairing() {
	let calls = 0;
	return async () =>
		++calls === 1 ? 'this is not json' : clearingJudgement(reasoningReviewCriteria(session));
}

/** The floor exactly as the agent route runs it on a turn: on `turn.engine`, and with NO explicit canonical. */
function reviewOnTurn(
	turn: AuthoringTurn,
	pwaId: string,
	print: () => Promise<string>,
	subjectHash: string
) {
	return withLiveReviewerSeam(() =>
		runPwaFloor(
			pwaId,
			{ prompt: 'Author the plan.', producer: PRODUCER, print, candidateSubjectHash: subjectHash },
			turn.engine
		)
	);
}

const exchanges = () => listByType(session, 'MODEL_EXCHANGE').length;

/** The refusal a professional reads (§5.4): every change, in the order the store recorded it. */
const disclosure = (...items: string[]) => `Changed since this draft began: ${items.join('; ')}.`;
/** One group's change, named from the canonical log's OWN record of the first event that touched the aggregate. */
function touched(role: string, aggregateId: string): string {
	const first = session.readAllEvents().find((event) => event.aggregateId === aggregateId);
	expect(first, `arrangement: ${aggregateId} has an event on canonical`).toBeDefined();
	return (
		`${role} ${aggregateId} was changed by ${first!.eventType} ` +
		`(actor ${first!.actor.actorId}, correlation ${first!.correlationId})`
	);
}

function setupCommand(
	commandType: string,
	targetAggregateType: string,
	id: string,
	payload: unknown
) {
	sequence += 1;
	return {
		commandId: `setup-${sequence}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType,
		targetAggregateId: id,
		issuedAt: TS,
		correlationId: 'setup',
		idempotencyKey: `setup-idem-${sequence}`,
		payload
	} satisfies DomainCommand;
}
/** Two ACTIVE, non-floor policies from the seeded library — one a draft references, one nothing references. */
const seededPolicy = (index: number): string => {
	const policyId = getEngine().ontology.seedPolicies[index]?.policyId;
	expect(policyId, `arrangement: the library seeds policy #${String(index)}`).toBeDefined();
	return policyId!;
};

/**
 * ⭐ The review in parts, B3 (`REG-D-125`) — a type of the PWA on canonical, before any draft: the floor reviews each type as
 * a part, so a floor over a PWA with none records no reasoning review and no exchange.
 */
function canonicalType(name: string): string {
	const typeId = mintUiId('pwut');
	expect(
		session.dispatch(
			setupCommand('DefinePwuType', 'PWU_TYPE', typeId, {
				pwuTypeId: typeId,
				pwaId: PWA,
				pwuKind: 'SURVEY',
				name,
				purpose: 'Survey the site',
				isRoot: true,
				permittedChildTypeIds: [],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: []
			})
		).status,
		`arrangement: the canonical type ${name}`
	).toBe('ACCEPTED');
	return typeId;
}

/** A REAL `RecordModelExchange`, captured off a floor run straight on canonical — no turn, so nobody's witness. */
async function capturedExchangeCommand(): Promise<DomainCommand> {
	canonicalType('Survey');
	const captured: DomainCommand[] = [];
	const spy: AuthedEngineHandle = {
		...session,
		dispatch: (command) => {
			captured.push(structuredClone(command));
			return session.dispatch(command);
		}
	};
	await withLiveReviewerSeam(() =>
		runPwaFloor(
			PWA,
			{ prompt: 'Assess the draft.', producer: PRODUCER, print: clearing, canonical: spy },
			session
		)
	);
	const exchange = captured.find((command) => command.commandType === 'RecordModelExchange');
	expect(exchange, 'arrangement: the floor drained a real exchange command').toBeDefined();
	return exchange!;
}

/** The same try's content as a NEW try: new command, key and aggregate — so it is ACCEPTED, not a replay. */
function asNewTry(command: DomainCommand): DomainCommand {
	const exchangeId = mintUiId('mex');
	return {
		...command,
		commandId: mintUiId('cmd'),
		targetAggregateId: exchangeId,
		idempotencyKey: `mex:${exchangeId}`,
		payload: { ...(command.payload as Record<string, unknown>), exchangeId }
	};
}

/** A turn with one defined type, validated — ready for a review and an acceptance. */
function validatedTurn(): { turn: AuthoringTurn; subjectHash: string } {
	const turn = beginAuthoringTurn(PWA);
	expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
	return { turn, subjectHash: markAuthoringTurnValid(turn) };
}

beforeEach(() => {
	sequence = 0;
	resetEngine('empty');
	session = getEngine().as(SESSION_CREDENTIAL);
	createPwa(PWA, 'Reviewed PWA');
});

afterEach(() => {
	clearAuthoringTurns();
});

describe('an authoring turn reviewed by a real reviewer commits its exact candidate (REG-F-425)', () => {
	it('PR-1 — the production composition: review, then accept — and the exchange records stay canonical', async () => {
		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		expect(
			await reviewOnTurn(turn, PWA, clearing, subjectHash),
			'the floor did not run'
		).toBeDefined();

		const recorded = exchanges();
		expect(
			recorded,
			'PER-9: the try is recorded canonically BEFORE acceptance'
		).toBeGreaterThanOrEqual(1);
		expect(listPwuTypes(session, PWA), 'canonical STATE is unchanged until acceptance').toEqual([]);

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));

		expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
		expect(listPwuTypes(session, PWA).map((t) => t.state.name)).toEqual(['Plan']);
		expect(exchanges(), 'the commit neither duplicates nor drops the records').toBe(recorded);
	});

	it('PR-1r — a repair try records TWO exchanges in one floor run; the commit still lands', async () => {
		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		await reviewOnTurn(turn, PWA, repairing(), subjectHash);
		expect(exchanges(), 'the repair path recorded both tries').toBe(2);

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));
		expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
	});

	it('PR-1p — exchanges ALREADY on canonical before the turn began are part of its base, not of its acts', async () => {
		// A review run straight on canonical (no turn), immediately before the turn begins: its records sit at the END
		// of the base log — the position a fix that re-derived the base from "events that are not exchanges" would
		// mis-slice. ⭐ B3: over a type of the PWA, the part a review is recorded under.
		canonicalType('Survey');
		await withLiveReviewerSeam(() =>
			runPwaFloor(
				PWA,
				{ prompt: 'Assess the draft.', producer: PRODUCER, print: clearing },
				session
			)
		);
		const before = exchanges();
		expect(before, 'arrangement: the base ends with exchange records').toBeGreaterThanOrEqual(1);
		const tail = session.readAllEvents().at(-1);
		expect(tail?.aggregateType, 'arrangement: the LAST base event is an exchange').toBe(
			'MODEL_EXCHANGE'
		);

		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		await reviewOnTurn(turn, PWA, clearing, subjectHash);
		expect(exchanges()).toBeGreaterThan(before);

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));
		expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
	});

	it('PR-1s — review, revise, resume, review again: every try across the resume is the turn’s own', async () => {
		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const first = markAuthoringTurnValid(turn);
		await reviewOnTurn(turn, PWA, clearing, first);
		markAuthoringTurnRevisionRequired(turn, 'the reviewer asked for more');

		const resumed = resumeAuthoringTurn(PWA);
		expect(resumed, 'the turn resumes').toBeDefined();
		expect(resumed!.broker.defineType({ name: 'Build', pwuKind: 'BUILD' }).ok).toBe(true);
		const second = markAuthoringTurnValid(resumed!);
		await reviewOnTurn(resumed!, PWA, clearing, second);
		// ⭐ B3 — one try per part: the first run reviewed one type, the second the two the resumed turn holds.
		expect(exchanges(), 'two floor runs, one try per part each').toBe(3);

		const result = commitAuthoringTurn(resumed!, markAuthoringTurnAssured(resumed!, second));
		expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
	});

	it('PR-3 — PER-9 survives a discard: the tries a discarded turn made stay on canonical', async () => {
		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		await reviewOnTurn(turn, PWA, clearing, markAuthoringTurnValid(turn));
		const recorded = exchanges();
		expect(recorded).toBeGreaterThanOrEqual(1);

		expect(discardAuthoringTurn(PWA)).toBe(true);

		expect(exchanges(), 'a made try is an act that happened, not candidate state').toBe(recorded);
		expect(listPwuTypes(session, PWA)).toEqual([]);
	});
});

describe('the witness admits the turn’s own tries and nothing else', () => {
	it('W1 — it writes exchange records only: any other command is refused, and canonical is unchanged', () => {
		const { turn } = validatedTurn();
		const witness = canonicalActsOf(turn.engine);
		expect(witness, 'an active turn’s fork has a witness').toBeDefined();
		const before = session.readAllEvents().length;
		const createOther: DomainCommand = {
			commandId: 'w1-create',
			commandType: 'CreatePwa',
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			targetAggregateId: OTHER_PWA,
			issuedAt: TS,
			correlationId: 'w1',
			idempotencyKey: 'w1-create',
			payload: {
				pwaId: OTHER_PWA,
				name: 'Back door',
				description: 'Not an exchange.',
				domain: 'software',
				version: '1.0.0'
			}
		};

		expect(() => witness!.dispatch(createOther)).toThrow(
			"An authoring turn writes only its exchange records to canonical before acceptance; CreatePwa belongs on the turn's candidate engine."
		);
		expect(session.readAllEvents(), 'nothing reached canonical').toHaveLength(before);
		expect(session.loadObject(OTHER_PWA)).toBeUndefined();
	});

	// ⭐ RE-AIMED BY `REG-D-070` (`JAN-CRITREAD` `DD-3`). This case used to be "a DUPLICATE of an act from BEFORE the fork
	// is not admitted", and the dependency rule makes that vacuous — an event before the fork is never in the tail. It
	// does NOT make the property vacuous: a DUPLICATE of ANOTHER writer's act made AFTER the fork carries events that ARE
	// in the tail, on a member of G4, and noting them as the turn's own would admit exactly the change the draft must be
	// refused for. (The design's §5.8 abolished this guard; this case is why it stays.)
	it('W2 — a DUPLICATE of another writer’s act after the fork is not the turn’s: not admitted, and the commit is refused', async () => {
		const template = await capturedExchangeCommand();
		const { turn, subjectHash } = validatedTurn();
		const theirs = asNewTry(template);
		expect(
			session.dispatch(theirs).status,
			'arrangement: another writer records a try after the fork'
		).toBe('ACCEPTED');

		const replay = canonicalActsOf(turn.engine)!.dispatch(theirs);
		expect(replay.status, 'arrangement: an idempotent replay').toBe('DUPLICATE');
		expect(
			replay.producedEventIds,
			'arrangement: carrying the OTHER writer’s event'
		).not.toHaveLength(0);

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		// ⭐ B3 — the other writer's try is about a type of the PWA, which the draft holds: the part's group refuses it.
		expect(result.ok ? '' : result.detail).toBe(
			disclosure(touched('a reviewer exchange about a type of your PWA', theirs.targetAggregateId))
		);
	});

	// ⭐ G4 ITSELF — the group of a reviewer's exchange about the PWA, kept by ruling (`REG-D-070` Q2). The floor now records each
	// try under the part it reviewed (`floor.ts`), so another writer's try ABOUT THE PWA is arranged from a real one, its subject
	// moved to the PWA.
	it('W2g — another writer’s exchange about the PWA itself, after the fork, refuses the draft by G4', async () => {
		const template = await capturedExchangeCommand();
		const { turn, subjectHash } = validatedTurn();
		const aboutThePwa = asNewTry({
			...template,
			payload: {
				...(template.payload as Record<string, unknown>),
				subjectObjectId: PWA,
				subjectObjectType: 'PROFESSIONAL_WORK_ARCHITECTURE'
			}
		});
		expect(session.dispatch(aboutThePwa).status, 'arrangement: another writer records a try about the PWA').toBe(
			'ACCEPTED'
		);

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toBe(
			disclosure(touched('a reviewer exchange about your PWA', aboutThePwa.targetAggregateId))
		);
	});

	it('W3 — a discarded turn’s late try is recorded (PER-9), and refuses its successor rather than joining it', async () => {
		const template = await capturedExchangeCommand();
		const discarded = beginAuthoringTurn(PWA);
		const lateWitness = canonicalActsOf(discarded.engine)!;
		expect(discardAuthoringTurn(PWA)).toBe(true);
		expect(
			canonicalActsOf(discarded.engine),
			'a discarded turn’s fork has no witness'
		).toBeUndefined();

		const { turn, subjectHash } = validatedTurn();
		const lateTry = asNewTry(template);
		expect(lateWitness.dispatch(lateTry).status, 'PER-9: the late try is still recorded').toBe(
			'ACCEPTED'
		);

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toBe(
			disclosure(touched('a reviewer exchange about a type of your PWA', lateTry.targetAggregateId))
		);
	});

	it('W4 — an explicit canonical on an active turn’s fork is refused before any work', async () => {
		const { turn, subjectHash } = validatedTurn();
		const before = session.readAllEvents().length;
		const staged = turn.commands.length;

		await expect(
			withLiveReviewerSeam(() =>
				runPwaFloor(
					PWA,
					{
						prompt: 'Author the plan.',
						producer: PRODUCER,
						print: clearing,
						candidateSubjectHash: subjectHash,
						canonical: session
					},
					turn.engine
				)
			)
		).rejects.toThrow(
			'runPwaFloor on an authoring turn records its tries through the turn’s own canonical witness; ' +
				'an explicit `canonical` would drain them unwitnessed and the turn would refuse its own candidate.'
		);
		expect(session.readAllEvents(), 'no try was drained anywhere').toHaveLength(before);
		expect(turn.commands, 'and nothing was recorded on the candidate').toHaveLength(staged);
	});
});

describe('what no longer refuses a draft — another PWA’s acts, an unrelated policy (REG-D-069, REG-D-070)', () => {
	// ⭐ `REG-F-430` CLOSED HERE. Under the whole-log rule this was refused ("disclosed, not solved"): ANY write
	// anywhere destroyed every open draft. Another professional's reviewer try is about ANOTHER PWA — no member of
	// anything this draft declares — so the draft commits.
	it('PR-2a — ANOTHER turn’s exchange record, about ANOTHER PWA, is not this draft’s business: the commit lands', async () => {
		createPwa(OTHER_PWA, 'Another professional’s PWA');
		const mine = beginAuthoringTurn(PWA);
		expect(mine.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const mineHash = markAuthoringTurnValid(mine);
		await reviewOnTurn(mine, PWA, clearing, mineHash);

		const theirs = beginAuthoringTurn(OTHER_PWA);
		expect(theirs.broker.defineType({ name: 'Survey', pwuKind: 'SURVEY', isRoot: true }).ok).toBe(
			true
		);
		const before = exchanges();
		await reviewOnTurn(theirs, OTHER_PWA, clearing, markAuthoringTurnValid(theirs));
		expect(exchanges() - before, 'arrangement: the other turn recorded exactly one try').toBe(1);

		const result = commitAuthoringTurn(mine, markAuthoringTurnAssured(mine, mineHash));

		expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
		expect(listPwuTypes(session, PWA).map((t) => t.state.name)).toEqual(['Plan']);
	});

	// ⭐ THE ALL-POLICIES PIN IS RETIRED (§5.1). A policy the draft neither references nor is floored by is only SHOWN
	// to the agent; editing it mid-draft used to refuse the draft, and must not.
	it('a policy the draft does not depend on, suspended mid-draft, is not its business: the commit lands', () => {
		const { turn, subjectHash } = validatedTurn();
		const unrelated = seededPolicy(0);
		expect(
			session.dispatch(
				setupCommand('SuspendAssurancePolicy', 'ASSURANCE_POLICY', unrelated, {
					policyId: unrelated
				})
			).status,
			'arrangement: the policy moved'
		).toBe('ACCEPTED');

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));

		expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
	});
});

describe('what a draft depends on refuses it, by name (REG-D-070 §5.1)', () => {
	// ⭐ G3 — THE REVIEW RECORDS A CANONICAL READER RANKS, which this draft's own commit writes into (§3.2, job (b)).
	// Another run's floor for the PWA, recorded on canonical after the draft began, is a member; the mock reviewer
	// records no exchange, so G4 has nothing to see and G3 alone refuses.
	it('G3 — floor records for the PWA written on canonical after the draft began refuse it, naming each one', async () => {
		const { turn, subjectHash } = validatedTurn();
		const position = session.readAllEvents().length;
		await runPwaFloor(PWA, { prompt: 'Assess the draft.', producer: PRODUCER }, session);
		expect(exchanges(), 'arrangement: the mock reviewer recorded no exchange').toBe(0);
		const recorded = [
			...new Set(
				session
					.readAllEvents()
					.slice(position)
					.filter((event) => event.aggregateType === 'ASSURANCE_ASSESSMENT')
					.map((event) => event.aggregateId)
			)
		];
		expect(recorded.length, 'arrangement: the floor recorded review records').toBeGreaterThan(0);

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toBe(
			disclosure(
				...recorded.map((id) => touched('your PWA’s review record under a floor policy', id))
			)
		);
	});

	// ⭐⭐ The review in parts, B3 (`REG-D-125`; design D6) — AND THE REVIEW RECORDS OF EACH TYPE OF THE DRAFT: the floor records
	// a type's reasoning review under the type, and the round reader ranks it there, so another run's review of one of the
	// draft's types, recorded on canonical after the draft began, is a change to it. PREDICTED RED WITHOUT THE PART GROUPS:
	// only the PWA's two deterministic records are named, and the part's is committed past unseen.
	it('G3p — a review record of a type the draft holds, written on canonical after the draft began, refuses it by name', async () => {
		const typeId = canonicalType('Survey');
		const { turn, subjectHash } = validatedTurn();
		const position = session.readAllEvents().length;
		await runPwaFloor(PWA, { prompt: 'Assess the draft.', producer: PRODUCER }, session);
		const recorded = (subject: string) => [
			...new Set(
				session
					.readAllEvents()
					.slice(position)
					.filter(
						(event) =>
							event.aggregateType === 'ASSURANCE_ASSESSMENT' &&
							((session.loadObject(event.aggregateId)?.state as { subjectObjectIds?: string[] } | undefined)?.subjectObjectIds ?? []).includes(subject)
					)
					.map((event) => event.aggregateId)
			)
		];
		expect(recorded(typeId), 'arrangement: the part’s review record').toHaveLength(1);

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toBe(
			disclosure(
				...recorded(PWA).map((id) => touched('your PWA’s review record under a floor policy', id)),
				...recorded(typeId).map((id) =>
					touched('the review record of a type of your PWA under a floor policy', id)
				)
			)
		);
	});

	// ⭐ PIN 3 — THE POLICIES THE REPLAY WILL VALIDATE, COMMAND BY COMMAND. A draft removes a policy from a type and
	// adds it back: the re-add newly references it against ITS OWN prior state, so the replay re-validates it. A
	// derivation against the type's BASE state would see "retained" and leave it unpinned — and a concurrent suspension
	// would then surface as the replay's refusal, a lost draft, instead of a named conflict.
	it('a policy the draft removes and re-adds, suspended concurrently, refuses it by name', () => {
		const policy = seededPolicy(1);
		const typeId = mintUiId('pwut');
		expect(
			session.dispatch(
				setupCommand('DefinePwuType', 'PWU_TYPE', typeId, {
					pwuTypeId: typeId,
					pwaId: PWA,
					pwuKind: 'PLAN',
					name: 'Plan',
					purpose: 'Plan the work',
					isRoot: true,
					permittedChildTypeIds: [],
					requiredInputs: [],
					requiredOutputs: [],
					requiredAssurancePolicyIds: [policy]
				})
			).status,
			'arrangement: a type that declares the policy'
		).toBe('ACCEPTED');
		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.editType(typeId, { requiredAssurancePolicyIds: [] }).ok).toBe(true);
		expect(turn.broker.editType(typeId, { requiredAssurancePolicyIds: [policy] }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		const revision = session.loadObject(policy)!.revision;
		expect(
			session.dispatch(
				setupCommand('SuspendAssurancePolicy', 'ASSURANCE_POLICY', policy, { policyId: policy })
			).status,
			'arrangement: the policy is suspended concurrently'
		).toBe('ACCEPTED');

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toBe(
			disclosure(
				`a policy this draft newly references ${policy} is at revision ${String(revision + 1)}, ` +
					`not revision ${String(revision)}`
			)
		);
	});

	// ⭐ PIN 4 — THE VALIDATOR A RECORDED REVIEW NAMES. The replay reads it by id (a DISABLED validator refuses the
	// review). On the authoring path it names nothing in the store, and the rule says so: it is held ABSENT.
	it('the validator each recorded review names is pinned — held absent, as the store holds it', async () => {
		const { turn, subjectHash } = validatedTurn();
		await reviewOnTurn(turn, PWA, clearing, subjectHash);
		const named = [
			...new Set(
				turn.commands
					.map(
						(command) =>
							(command.payload as { validatorResult?: { validatorId?: unknown } } | undefined)
								?.validatorResult?.validatorId
					)
					.filter((id): id is string => typeof id === 'string')
			)
		];
		expect(named.length, 'arrangement: the review recorded a named validator').toBeGreaterThan(0);

		const { pins } = declaredDependenciesOf(turn);

		for (const validatorId of named) {
			expect(session.loadObject(validatorId), 'the store holds no such entry').toBeUndefined();
			expect(pins).toContainEqual({
				aggregateId: validatorId,
				mustNotExist: true,
				role: 'the validator a recorded review names'
			});
		}
	});
});
