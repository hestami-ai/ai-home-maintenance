// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D73's rule with D87 and D72 (`REG-D-166` (2), (5), (6); `REG-D-167` (1), (2); the lead's
// rulings 3, 4, 7 and 14 on L17b2's Stage 0) — THE WAY BACK THE STRUCTURE OFFERS, CHOSEN FROM THE ROUND'S RECORDS ALONE.
//
// ⭑ THE CHOICE, as one pure function over the round as the record holds it (`wayBackChoice`); its reading from the record is
// `wayBackOffer`, held through the page (`assurance-stage.route.test.ts`). In order:
//   · no stage of the round yet: the stage, and no way back (D72's "When", with D76's interim; ruling 3);
//   · the Historian's latest answer recommending `REQUEST_HUMAN_DECISION`: no way back — the sponsor decides (D79, D87);
//   · the Historian not concluded — INCONCLUSIVE, refused at its completion, or not run: asked once more (ruling 7); not concluded twice: no
//     way back — the sponsor decides;
//   · otherwise, `RESHAPE_PWU` as nothing recommended, its reason carried (D87; ruling 4): the diagnosis naming the rejected unit, its own work
//     re-run in place (D71); naming an earlier candidate, the work sent back to that unit alone (D72); naming none, or a diagnosis refused,
//     failing or not run, the person's choice — the re-run beside every candidate.
import { describe, expect, it } from 'vitest';
import { wayBackChoice, type RoundReading } from './loop-rule.js';

const SOURCE = { id: 'pwu_source', title: 'Source Construction' };
const TESTS = { id: 'pwu_tests', title: 'Unit Test Suite' };
const NOTHING = { concluded: true, recommendedControlAction: null } as const;
const round = (over: Partial<RoundReading>): RoundReading => ({
	stageRan: true,
	historianAsks: [NOTHING],
	diagnosis: { status: 'recorded', named: SOURCE.id },
	rejectedUnitId: 'pwu_verification',
	candidates: [SOURCE, TESTS],
	rerunInPlaceOffered: true,
	...over
});

describe('⭐⭐ L17b2 (D73, D87, D72) — the way back, chosen from the round’s records alone', () => {
	it('⛔ RED FIRST — no stage of the round yet: the stage, and no way back', () => {
		expect(wayBackChoice(round({ stageRan: false, historianAsks: [], diagnosis: undefined }))).toEqual({ kind: 'RUN_STAGE' });
	});

	it('⛔ RED FIRST — the Historian recommends REQUEST_HUMAN_DECISION: no way back, the sponsor decides — whatever the diagnosis names', () => {
		for (const named of [SOURCE.id, 'pwu_verification', null])
			expect
				.soft(wayBackChoice(round({ historianAsks: [{ concluded: true, recommendedControlAction: { action: 'REQUEST_HUMAN_DECISION', reason: 'stuck' } }], diagnosis: { status: 'recorded', named } })), String(named))
				.toEqual({ kind: 'SPONSOR_DECIDES', because: 'REQUEST_HUMAN_DECISION' });
	});

	it('⛔ RED FIRST — not concluded once: the Historian asked again; not concluded twice: no way back, the sponsor decides', () => {
		const notConcluded = { concluded: false, recommendedControlAction: null };
		expect.soft(wayBackChoice(round({ historianAsks: [notConcluded] }))).toEqual({ kind: 'ASK_HISTORIAN_AGAIN' });
		expect.soft(wayBackChoice(round({ historianAsks: [] })), 'a stage whose Historian left no answer').toEqual({ kind: 'ASK_HISTORIAN_AGAIN' });
		expect.soft(wayBackChoice(round({ historianAsks: [notConcluded, notConcluded] }))).toEqual({ kind: 'SPONSOR_DECIDES', because: 'NOT_CONCLUDED_TWICE' });
	});

	it('⛔ RED FIRST — asked again and concluded: the way back by the diagnosis, as at a first answer', () => {
		expect(wayBackChoice(round({ historianAsks: [{ concluded: false, recommendedControlAction: null }, NOTHING] }))).toEqual({ kind: 'SEND_BACK', candidate: SOURCE });
	});

	it('⛔ RED FIRST — nothing recommended: the diagnosis names the rejected unit — its own work re-run in place; an earlier candidate — the work sent back to it alone', () => {
		expect.soft(wayBackChoice(round({ diagnosis: { status: 'recorded', named: 'pwu_verification' } }))).toEqual({ kind: 'RERUN_IN_PLACE' });
		expect.soft(wayBackChoice(round({ diagnosis: { status: 'recorded', named: TESTS.id } }))).toEqual({ kind: 'SEND_BACK', candidate: TESTS });
	});

	it('⛔ RED FIRST — the diagnosis names none, or was refused, failing or not run: the person’s choice, the re-run beside every candidate', () => {
		const choice = { kind: 'PERSON_CHOOSES', rerunInPlace: true, candidates: [SOURCE, TESTS] };
		for (const diagnosis of [
			{ status: 'recorded', named: null },
			{ status: 'refused', named: 'pwu_outside' },
			{ status: 'failing', named: null },
			{ status: 'not-run', named: null },
			undefined
		])
			expect.soft(wayBackChoice(round({ diagnosis })), JSON.stringify(diagnosis)).toEqual(choice);
	});

	// ⭐⭐ L17b2, Stage 3b (the lead's §33, item 4; brief-3b item 6) — A TEST THE MUTANTS OWED: the rule following a diagnosis that is not recorded. The
	// test above hands it one refused diagnosis, naming a unit that is no candidate, and failing and not-run ones that name none — so a rule that
	// followed a refused diagnosis to a real candidate, or to the rejected unit itself, SURVIVED it.
	it('⛔ RED FIRST — a diagnosis that is not recorded is not followed, whatever it names — refused, failing or not run, naming a real candidate or the rejected unit itself: the person’s choice, never the work sent back to that unit alone, never the re-run in place alone', () => {
		for (const status of ['refused', 'failing', 'not-run'])
			for (const named of [SOURCE.id, TESTS.id, 'pwu_verification'])
				expect.soft(wayBackChoice(round({ diagnosis: { status, named } })), `${status}, naming ${named}: followed`).toEqual({
					kind: 'PERSON_CHOOSES',
					rerunInPlace: true,
					candidates: [SOURCE, TESTS]
				});
	});

	it('⛔ RED FIRST — the rejected unit named, its own re-run not offered (no model does its work): the person’s choice among the candidates', () => {
		expect(wayBackChoice(round({ diagnosis: { status: 'recorded', named: 'pwu_verification' }, rerunInPlaceOffered: false }))).toEqual({
			kind: 'PERSON_CHOOSES',
			rerunInPlace: false,
			candidates: [SOURCE, TESTS]
		});
	});

	it('⛔ RED FIRST — RESHAPE_PWU offers the way back as nothing recommended does, its reason carried', () => {
		const reshape = { concluded: true, recommendedControlAction: { action: 'RESHAPE_PWU', reason: 'Build the reader in parts, each checked.' } };
		expect.soft(wayBackChoice(round({ historianAsks: [reshape] }))).toEqual({ kind: 'SEND_BACK', candidate: SOURCE, reshapeReason: 'Build the reader in parts, each checked.' });
		expect.soft(wayBackChoice(round({ historianAsks: [reshape], diagnosis: { status: 'recorded', named: 'pwu_verification' } }))).toEqual({
			kind: 'RERUN_IN_PLACE',
			reshapeReason: 'Build the reader in parts, each checked.'
		});
		expect.soft(wayBackChoice(round({ historianAsks: [reshape], diagnosis: undefined }))).toEqual({
			kind: 'PERSON_CHOOSES',
			rerunInPlace: true,
			candidates: [SOURCE, TESTS],
			reshapeReason: 'Build the reader in parts, each checked.'
		});
	});

	it('⭑ CONTROL — an action the policy does not permit, had it been recorded, is no recommendation the choice reads: the way back as nothing recommended', () => {
		expect(wayBackChoice(round({ historianAsks: [{ concluded: true, recommendedControlAction: { action: 'CHANGE_MODEL', reason: 'r' } }] }))).toEqual({
			kind: 'SEND_BACK',
			candidate: SOURCE
		});
	});
});
