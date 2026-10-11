// ⭐⭐ `JAN-EXEC` P7-6 fix round C, C2 (`DESIGN-the-reviewer-isolated.md` §4d I5; `REG-F-552`) — THE TRY A FLOOR RUN'S
// REVIEW CONCLUDED FROM (`concludedTry`), the rule `loadReviewerAnswer` shows an answer by.
//
// `pwa-reviewer-answer-join.test.ts` holds the reader through the PWA page on real floor runs. This holds the RULE on each
// arrangement it decides, one conjunct at a time ("two guards, one arrangement" proves neither): every chain below is
// the product's own — a review run through the REAL agy validator with its model stubbed (`AgyPrint`), each try projected
// by the floor's recorder (`toRecordModelExchange`) — and where a case needs a record the validator never writes (the
// marker beside another outcome; a JSON repair's first reply that parsed and could not be coerced; a substitute's
// refusal), ONE field of a real record is edited, and the case says which.
// No model is called.
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { describe, expect, it } from 'vitest';
import { createExchangeSink } from './exchange-capture.js';
import { mintIdsFor, toRecordModelExchange } from './exchange-recorder.js';
import { createAgyReasoningReviewValidator, type AgyPrint } from './reasoning-review-validator.js';
import { concludedTry, type Try } from './reviewer-answer.js';
import { pairRun, type StoredObject } from '../../../../../../scripts/phase7/run-report-core.js';

/** A reply that PARSES and answers no criterion — the measured run's own shape (`REG-F-552`). */
const NO_ROWS = '{"findings":[],"recommendation":"SATISFIED","residualUncertainty":["x"]}';
/** A reply answering every seeded criterion, met. */
const ANSWERS = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'met' })),
	recommendation: 'SATISFIED'
});
/** A reply that parses and answers none AGAIN — its one row names no criterion id. */
const NONE_AGAIN = '{"findings":[{"failed":false,"statement":"met"}],"recommendation":"SATISFIED"}';
/** A reply no JSON can be read from. */
const PROSE = "I'll check the files the work product names first.";

/**
 * ONE REVIEW'S TRIES AS THE FLOOR STORES THEM: the real validator, its model giving each of `replies` in turn (an `Error`
 * is a call that got no reply), each drained record projected by `toRecordModelExchange`. ⚠ A review whose JSON repair
 * also fails THROWS (the validator's rule); its records are drained all the same, as the floor drains them.
 */
async function tries(...replies: (string | Error)[]): Promise<Try[]> {
	let n = 0;
	const print: AgyPrint = async () => {
		const r = replies[n++] ?? '';
		if (r instanceof Error) throw r;
		return r;
	};
	const exchanges = createExchangeSink();
	await createAgyReasoningReviewValidator({ print, modelId: 'fixture-judge', exchanges })
		.evaluate(
			{
				subjectId: 'art_1',
				objectType: 'ARTIFACT',
				semanticVersion: 1,
				isAiProduced: true,
				producer: { actorType: 'AGENT', agentId: 'executor', modelId: 'executor-model', providerId: 'executor-provider' }
			},
			{
				reasoningReview: {
					criteria: SEEDED_REASONING_REVIEW_CRITERIA,
					framing: 'WORK_PRODUCT',
					prompt: 'Write the design',
					content: '# Design',
					narration: ''
				}
			}
		)
		.catch(() => undefined);
	const records = exchanges.drain();
	let minted = 0;
	const ids = mintIdsFor(records, () => `mex_${++minted}`);
	return records.map((rec) => {
		const p = toRecordModelExchange(
			rec,
			{
				runToken: 'run_1',
				plane: 'ASSURANCE',
				invokerId: 'floor.reasoning-review',
				assurancePolicyId: 'floor.reasoning-review',
				subjectObjectId: 'art_1',
				subjectObjectType: 'ARTIFACT',
				subjectSemanticVersion: 1,
				// The run's own mint, which the projection does not call: the ids are minted above, for the whole drain.
				newId: (prefix) => `${prefix}_unused`
			},
			ids
		);
		return { id: `${p.exchangeRole}:${p.attemptOrdinal}`, state: p };
	});
}

/** `t` with its E-5 outcome replaced — the one field a case edits — its detail kept as the validator wrote it. */
const withOutcome = (t: Try, outcome: string): Try => {
	const s = t.state as { parseOutcome: { detail: string } };
	return { id: t.id, state: { ...s, parseOutcome: { outcome, detail: s.parseOutcome.detail } } };
};
const calls = (ts: readonly Try[]): string[] =>
	ts.map((t) => {
		const s = t.state as { exchangeRole: string; disposition: string; parseOutcome: { outcome: string } };
		return `${s.exchangeRole}:${s.disposition}:${s.parseOutcome.outcome}`;
	});

describe('⭐⭐ P7-6 C2 — the try a floor run’s review concluded from (REG-F-552)', () => {
	it('⭐ an answered first call concluded it: the one try', async () => {
		const t = await tries(ANSWERS);
		expect(calls(t), 'arrangement').toEqual(['INITIAL:ACCEPTED:PARSED']);
		expect(concludedTry(t)?.id).toBe('INITIAL:1');
	});

	it('⭐ I5 — a criterion repair that ANSWERS concluded it: the repair', async () => {
		const t = await tries(NO_ROWS, ANSWERS);
		expect(calls(t), 'arrangement').toEqual(['INITIAL:REPAIR_REQUESTED:SCHEMA_COERCION_FAILED', 'REPAIR:ACCEPTED:PARSED']);
		expect(concludedTry(t)?.id).toBe('REPAIR:2');
	});

	it.each([
		['answered none again', NONE_AGAIN, 'REPAIR:REJECTED:SCHEMA_COERCION_FAILED'],
		['did not parse', PROSE, 'REPAIR:REJECTED:JSON_EXTRACTION_FAILED'],
		['got no reply', new Error('devin invocation failed: connection reset'), 'REPAIR:NO_RESPONSE:NOT_ATTEMPTED']
	] as const)('⛔ I5 — a criterion repair that %s: the review kept the FIRST reply’s judgement, so the FIRST reply', async (_how, repair, recorded) => {
		const t = await tries(NO_ROWS, repair);
		expect(calls(t), 'arrangement').toEqual(['INITIAL:REPAIR_REQUESTED:SCHEMA_COERCION_FAILED', recorded]);
		expect(concludedTry(t)?.id, 'the repair the review did not conclude from').toBe('INITIAL:1');
	});

	it('⭐ a JSON repair chain is read by its last try: the repair the review concluded from, or failed on', async () => {
		const answered = await tries(PROSE, ANSWERS);
		expect(calls(answered), 'arrangement').toEqual(['INITIAL:REPAIR_REQUESTED:JSON_EXTRACTION_FAILED', 'REPAIR:ACCEPTED:PARSED']);
		expect(concludedTry(answered)?.id).toBe('REPAIR:2');
		const failed = await tries(PROSE, PROSE);
		expect(calls(failed), 'arrangement').toEqual(['INITIAL:REPAIR_REQUESTED:JSON_EXTRACTION_FAILED', 'REPAIR:REJECTED:JSON_EXTRACTION_FAILED']);
		expect(concludedTry(failed)?.id).toBe('REPAIR:2');
	});

	it('⭑ CONTROL — the outcome WITHOUT the marker is not I5: a JSON repair’s first reply that parsed and could not be coerced', async () => {
		// The one edit: the first reply's outcome, as `classifyParse` gives a reply that parsed and could not be coerced.
		const [first, repair] = await tries(PROSE, PROSE);
		expect(concludedTry([withOutcome(first!, 'SCHEMA_COERCION_FAILED'), repair!])?.id, 'read as I5 by its outcome alone').toBe('REPAIR:2');
	});

	it('⭑ CONTROL — the marker beside ANOTHER outcome is not I5: the pair is both', async () => {
		// The one edit: the request's outcome — its detail, the marker, kept as the validator wrote it.
		const [asked, repair] = await tries(NO_ROWS, PROSE);
		expect(concludedTry([withOutcome(asked!, 'JSON_PARSE_FAILED'), repair!])?.id, 'read as I5 by its marker alone').toBe('REPAIR:2');
	});

	it('⛔ I5 — a criterion repair refused for WHO answered it (a substitute) failed the review: the repair, as the run report reads it', async () => {
		// The one edit: the repair's outcome — a substitute is refused unread, `NOT_ATTEMPTED`.
		const [asked, repair] = await tries(NO_ROWS, PROSE);
		expect(concludedTry([asked!, withOutcome(repair!, 'NOT_ATTEMPTED')])?.id).toBe('REPAIR:2');
	});

	it('⭐ after a throw, the first reply is its RETRY’s: an I5 retry whose repair added nothing concluded it', async () => {
		// Renumbered behind a call that threw: the stub validator runs no retry, since it declares no bound (`P7-2b`).
		const [asked, repair] = await tries(NO_ROWS, PROSE);
		const at = (t: Try, role: string, ordinal: number): Try => ({
			id: `${role}:${ordinal}`,
			state: { ...(t.state as object), exchangeRole: role, attemptOrdinal: ordinal }
		});
		const threw: Try = { id: 'INITIAL:1', state: { disposition: 'NO_RESPONSE', attemptOrdinal: 1, parseOutcome: { outcome: 'NOT_ATTEMPTED' } } };
		expect(concludedTry([threw, at(asked!, 'RETRY', 2), at(repair!, 'REPAIR', 3)])?.id).toBe('RETRY:2');
	});

	it('⭑ CONTROL — no try, nothing concluded: undefined, never a view of nothing', () => {
		expect(concludedTry([])).toBeUndefined();
	});

	// ⛔⛔ `P76F-D` D3 — A REPAIR THAT IS NOT ON THE RECORD CONCLUDED NOTHING THE RECORD CAN SHOW. The reader returned the FIRST
	// reply of an I5 chain whose repair the record does not hold — its capture threw, or its record was lost — while the run
	// report (`criterionRepairConclusion`) names no call: the review did not conclude from that reply, which ASKED for a
	// repair. So the page showed, as the answer a review concluded from, a reply it did not conclude from.
	it('⛔ P76F-D D3 — an I5 repair-request whose repair is not on the record: no answer — the review did not conclude from it', async () => {
		// The one edit: the repair's record dropped, as when its capture threw or its record was lost.
		const [asked] = await tries(NO_ROWS, PROSE);
		expect(calls([asked!]), 'arrangement').toEqual(['INITIAL:REPAIR_REQUESTED:SCHEMA_COERCION_FAILED']);
		expect(concludedTry([asked!]), 'the reply that asked for a repair is shown as what the review concluded from').toBeUndefined();
	});

	// ⭐ `P76F-D` D3 — AND ITS GENERAL FORM: any chain whose last try is not one a review concludes on (a reply that asked for
	// a JSON repair, the repair not on the record) shows no answer, as the report names none (`concludedBy`).
	it('⛔ P76F-D D3 — a JSON repair-request whose repair is not on the record: no answer either', async () => {
		const [first] = await tries(PROSE, PROSE);
		expect(calls([first!]), 'arrangement').toEqual(['INITIAL:REPAIR_REQUESTED:JSON_EXTRACTION_FAILED']);
		expect(concludedTry([first!]), 'a reply that asked for a repair is shown as what the review concluded from').toBeUndefined();
	});
});

// ── ⭐⭐ `P76F-D` D3 — THE READER AND THE RUN REPORT NAME THE SAME TRY, ON EVERY CHAIN ─────────────────────────────────────
// `concludedTry`'s header claims it reads the rule the Phase 7 run report reads (`criterionRepairConclusion`, `concludedBy`,
// `scripts/phase7/run-report-core.ts`) from the same records. ⛔ It did not, on a chain whose repair is not on the record —
// and nothing held the two together, so the claim was the reader's word. Now each chain this file builds is read by BOTH,
// through the report's own entry (`pairRun`, one floor run's calls), and the try each names must be the same — or none.
describe('⭐⭐ P76F-D D3 — the PWA reader and the run report name the same try, or none, on every chain', () => {
	/** `t` as the run report reads a run's calls from the archived store. */
	const stored = (t: readonly Try[]): StoredObject[] =>
		t.map((x, i) => ({
			id: x.id,
			objectType: 'MODEL_EXCHANGE',
			state: x.state as Readonly<Record<string, unknown>>,
			firstSequence: i + 1
		}));
	/** `t` with its disposition replaced — the one field a case edits. */
	const withDisposition = (t: Try, disposition: string): Try => ({
		id: t.id,
		state: { ...(t.state as object), disposition }
	});
	const pairOf = async (
		build: () => Promise<readonly Try[]>
	): Promise<{ readonly reader: string | null; readonly report: string | null }> => {
		const t = await build();
		return { reader: concludedTry(t)?.id ?? null, report: pairRun('run_1', stored(t)).concludedBy };
	};
	const CHAINS: readonly (readonly [string, () => Promise<readonly Try[]>])[] = [
		['an answered first call', () => tries(ANSWERS)],
		['a first call that threw, and nothing more', () => tries(new Error('devin invocation failed: connection reset'))],
		['I5, its repair answering', () => tries(NO_ROWS, ANSWERS)],
		['I5, its repair answering none again', () => tries(NO_ROWS, NONE_AGAIN)],
		['I5, its repair not parsing', () => tries(NO_ROWS, PROSE)],
		['I5, its repair getting no reply', () => tries(NO_ROWS, new Error('devin invocation failed: connection reset'))],
		['I5, its repair refused as a substitute', async () => {
			const [asked, repair] = await tries(NO_ROWS, PROSE);
			return [asked!, withOutcome(repair!, 'NOT_ATTEMPTED')];
		}],
		['I5, its repair not on the record', async () => (await tries(NO_ROWS, PROSE)).slice(0, 1)],
		['I5, its repair recorded as asking for a repair itself (never written by the validator)', async () => {
			const [asked, repair] = await tries(NO_ROWS, PROSE);
			return [asked!, withDisposition(repair!, 'REPAIR_REQUESTED')];
		}],
		['a JSON repair answering', () => tries(PROSE, ANSWERS)],
		['a JSON repair failing', () => tries(PROSE, PROSE)],
		['a JSON repair not on the record', async () => (await tries(PROSE, PROSE)).slice(0, 1)],
		['the outcome without the marker', async () => {
			const [first, repair] = await tries(PROSE, PROSE);
			return [withOutcome(first!, 'SCHEMA_COERCION_FAILED'), repair!];
		}],
		['the marker beside another outcome', async () => {
			const [asked, repair] = await tries(NO_ROWS, PROSE);
			return [withOutcome(asked!, 'JSON_PARSE_FAILED'), repair!];
		}],
		['no try', async () => []]
	];

	it.each(CHAINS)('⭐ %s', async (_label, build) => {
		const { reader, report } = await pairOf(build);
		expect(reader, 'the PWA reader names a try the run report does not').toBe(report);
	});
});
