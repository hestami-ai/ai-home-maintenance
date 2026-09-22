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

/** A REAL `RecordModelExchange`, captured off a floor run straight on canonical — no turn, so nobody's witness. */
async function capturedExchangeCommand(): Promise<DomainCommand> {
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
		// mis-slice.
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
		expect(exchanges(), 'two floor runs, one try each').toBe(2);

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

	it('W2 — a DUPLICATE is an EARLIER act, not this turn’s: it is not admitted, and the commit lands', async () => {
		const earlier = await capturedExchangeCommand();
		const { turn, subjectHash } = validatedTurn();

		const replay = canonicalActsOf(turn.engine)!.dispatch(earlier);
		expect(replay.status, 'arrangement: an idempotent replay').toBe('DUPLICATE');
		expect(
			replay.producedEventIds,
			'arrangement: carrying the earlier act’s events'
		).not.toHaveLength(0);

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));
		expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
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
		expect(result.ok ? '' : result.detail).toContain(
			`First unadmitted event: ModelExchangeRecorded on MODEL_EXCHANGE ${lateTry.targetAggregateId}.`
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

describe('what the turn still refuses — disclosed, not solved (DESIGN §5.3)', () => {
	it('PR-2a — ANOTHER turn’s exchange record is a foreign event: the commit is refused, and says whose', async () => {
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
		const foreign = listByType(session, 'MODEL_EXCHANGE').slice(before);
		expect(foreign, 'arrangement: the other turn recorded exactly one try').toHaveLength(1);

		const result = commitAuthoringTurn(mine, markAuthoringTurnAssured(mine, mineHash));

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toMatch(
			/^@event-log changed from revision \d+ to \d+\. /
		);
		expect(result.ok ? '' : result.detail).toContain(
			`First unadmitted event: ModelExchangeRecorded on MODEL_EXCHANGE ${foreign[0]!.id}.`
		);
		expect(listPwuTypes(session, PWA)).toEqual([]);
	});
});
