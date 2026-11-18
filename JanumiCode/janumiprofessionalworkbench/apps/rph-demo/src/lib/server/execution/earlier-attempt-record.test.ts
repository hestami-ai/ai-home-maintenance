// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.43; `REG-D-173` (3), (4), (5)) — A
// REPLACEMENT'S RECORD OF THE UNITS IT REPLACES: the line of those units, the sentence its first turn says of them, their conversations read from
// the Governed Stream's record and rendered in parts, each read recorded before it is served, and the read-only tool that serves them.
//
// ⭑ WHAT MUST HOLD (D89, the lead's): the turn names each unit in the line, nearest first, with what the record holds of it, in the lead's draft
// words; the tool reads the nearest unit with a record by default; the rendering is the record's, never a harness's file — every exchange's bytes
// verified, each request message shown once, every answer shown, a turn's text alone, an encrypted reasoning item and a reply Pi dropped (D92)
// each said so — in parts of at most 20,000 characters, each headed, the first listing the exchanges and the part each begins in (the lead's
// ruling 3); every call of the tool recorded before it is answered, a call outside the units or parts among them (ruling 1); a read the store
// refuses to record never served.
// ⭑ THE RECORD IS BUILT BY HAND HERE, as the record's rows (`RecordRows`) and an in-memory content store: the shapes the page writes
// (`run-model-step.ts`, `exchange-recorder.ts`), and the ninth run's recorded request in form — a Responses request, its instructions and its
// items. Every text is this file's own.
// ⭐ STRENGTHENED 2026-11-18 (the independent review's L17-01, L17-02, L17-03 and L17-12, and the lead's ruling §7.4 (3); `l17b3-facts.md` §8): the
// tool over a line whose nearest unit left no record, one conversation per unit, so a wrong unit is seen — the default, an earlier unit asked for and
// a part after the first, zero and negative parts among the outside requests; the real read-record writer over a store whose `put` fails, whose
// bind is refused and which throws, joined to the tool, and a recording held open holding the tool's answer; a raw output, an answer span and a
// volunteered reasoning stored apart and read through the reader — the raw output first, the span where it is absent, neither, and bytes that do
// not match their hash; `SATISFIED` read as accepted; a request that carried D77's feedback alone holding findings, as D89 says; the rendering held
// to its content — instructions, arguments, results, a restarted request, a turn's text, every answer, the whole of a long line — and a dropped
// reply rendered in its place among the try's replies.
import { createHash } from 'node:crypto';
import { createInMemoryArtifactStore, createInMemoryWorkspace, createRefusingProcessRunner } from '@janumipwb/rph-ports';
import { validateToolArguments } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';
import { mintExecutionTools } from '../tools/execution-tool-surface.js';
import { createProcessRunObserver } from '../tools/process-run-observer.js';
import { toPiExecutionTools } from '../tools/pi-execution-tools.js';
import { DROPPED_REPLIES_SCHEMA, droppedRepliesNameOf } from './dropped-replies.js';
import {
	EARLIER_ATTEMPT_CAPABILITY,
	EARLIER_ATTEMPT_PART_BOUND,
	EARLIER_ATTEMPT_READ_SCHEMA,
	earlierAttemptReadNameOf,
	NO_RECORD_SENTENCE,
	READ_EARLIER_ATTEMPT_TOOL,
	readEarlierAttempt,
	recordEarlierAttemptRead,
	recordFilePath,
	recordHoldings,
	renderUnitConversation,
	replacedLineOf,
	replacedLineSentence,
	unitConversationOf,
	type EarlierAttemptPort,
	type EarlierAttemptRead,
	type RecordRows,
	type ReplacedUnit,
	type UnitConversation
} from './earlier-attempt-record.js';
import { CARRIED_FINDINGS_LINE, FEEDBACK_HEADING } from './executor-session.js';

const TENANT = 'tnt-test';
const sha = (text: string): string => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;

/** The record's rows, built as the page writes them: objects by id, and the events in their order. */
function rowsBuilder() {
	const objects = new Map<string, { type: string; state: Record<string, unknown> }>();
	const events: { seq: number; type: string; aggregateId: string; payload: Record<string, unknown> }[] = [];
	const event = (type: string, aggregateId: string, payload: Record<string, unknown> = {}) =>
		events.push({ seq: events.length + 1, type, aggregateId, payload });
	return {
		rows: (): RecordRows => ({ objects, events }),
		unit(id: string, title: string, assuranceState: string, supersedingWorkUnitId?: string) {
			objects.set(id, {
				type: 'PROFESSIONAL_WORK_UNIT',
				state: { id, title, assuranceState, ...(supersedingWorkUnitId ? { supersedingWorkUnitId, workLifecycleState: 'SUPERSEDED' } : {}) }
			});
			event('PwuProposed', id);
		},
		stepStarted(planId: string, unitId: string, stepId: string) {
			objects.set(planId, { type: 'EXECUTION_PLAN', state: { id: planId, workUnitId: unitId } });
			event('ExecutionStepStarted', planId, { stepId });
		},
		exchange(id: string, state: Record<string, unknown>) {
			objects.set(id, { type: 'MODEL_EXCHANGE', state: { id, ...state } });
			event('ModelExchangeRecorded', id);
		},
		artifact(id: string, state: Record<string, unknown>) {
			objects.set(id, { type: 'ARTIFACT', state: { id, ...state } });
			event('ArtifactRecorded', id);
		}
	};
}

/** A ref to bytes put in `store`, as a stored exchange names them. */
async function stored(store: ReturnType<typeof createInMemoryArtifactStore>, bytes: string) {
	const ref = await store.put({ tenantPrefix: TENANT, bytes, mediaType: 'text/plain', purgeability: 'RETAINED_BY_PARTICIPATION' });
	return { status: 'STORED', storageKey: ref.storageKey, contentHash: ref.contentHash, byteSize: ref.byteSize, purgeability: 'RETAINED_BY_PARTICIPATION' };
}
const PENDING = { status: 'PENDING_CONTENT_PLANE', reason: 'No volunteered reasoning arrived with this answer.' };
const ENVELOPE = (marker: string) =>
	JSON.stringify({ workProduct: { document: `${marker}: the work.` }, rationale: { rationale: `${marker}: the account.`, assumptions: [], limitations: [], residualUncertainty: [] } });
/** ⭐ L17-03 — the model's whole reply as the raw output keeps it: prose before the envelope, so it is not the answer span. */
const RAW = (n: number, marker: string) => `RAW-${n} the model’s whole reply, its prose before its envelope.\n${ENVELOPE(marker)}`;
const user = (text: string) => ({ role: 'user', content: [{ type: 'input_text', text }] });
const encrypted = (id: string) => ({ type: 'reasoning', id, summary: [], encrypted_content: `gAAAAB-${id}-ciphertext-that-must-never-be-shown` });
const call = (n: number, name = 'write_file', args: unknown = { path: `docs/${n}.md` }) => ({
	type: 'function_call',
	id: `fc_${n}`,
	call_id: `call_${n}`,
	name,
	arguments: JSON.stringify(args)
});
const output = (n: number, text = `wrote docs/${n}.md`) => ({ type: 'function_call_output', call_id: `call_${n}`, output: text });
const assistantSaid = (text: string, id = 'msg_1') => ({ type: 'message', id, role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] });
const replayed = (text: string) => assistantSaid(text);
const request = (items: readonly unknown[]) => JSON.stringify({ model: 'faux-model', store: false, stream: true, instructions: 'The execution contract.', input: items, tools: [{ type: 'function', name: 'write_file' }] });
const REPAIR_OPENING = 'An independent assurance review of the work product you just produced found the following:';

/**
 * A unit of one step and two tries — the second a repair on the same conversation — and its record. ⭐ L17-03: each try's raw output, answer span
 * and volunteered reasoning stored apart, the raw output the whole reply and the span its envelope alone, so which the reader shows is seen.
 */
async function unitWithARepair() {
	const store = createInMemoryArtifactStore();
	const b = rowsBuilder();
	b.unit('pwu_src', 'Source Construction', 'SATISFIED');
	b.stepStarted('plan_1', 'pwu_src', 'step_1');
	const first = [user('Write the Source.'), encrypted('rs_1'), call(1), output(1)];
	const a1 = ENVELOPE('FIRST');
	const raw1 = RAW(1, 'FIRST');
	b.exchange('mex_1', {
		plane: 'EXECUTION',
		invokerId: 'execution.model-invocation:pwut_src',
		subjectObjectId: 'pwu_src',
		requestedAt: '2026-11-17T10:00:00Z',
		materializedInputRef: await stored(store, request(first)),
		rawOutputBeforeCoercionRef: await stored(store, raw1),
		answerSpanRef: await stored(store, a1),
		volunteeredReasoningRef: await stored(store, 'VOLUNTEERED-1 the model’s own account, which is never shown'),
		workProductDerivation: { relation: 'ENVELOPE_FIELD', storageKey: 'wp_1' }
	});
	b.artifact('art_1', { storageKey: 'wp_1', producingPwuId: 'pwu_src', producingExecutionAttemptId: 'step_1#1' });
	const second = [...first, replayed(raw1), user(`${REPAIR_OPENING}\n- C1: no.`), call(2), output(2)];
	const a2 = ENVELOPE('SECOND');
	const raw2 = RAW(2, 'SECOND');
	b.exchange('mex_2', {
		plane: 'EXECUTION',
		invokerId: 'execution.model-invocation:pwut_src',
		subjectObjectId: 'pwu_src',
		requestedAt: '2026-11-17T10:05:00Z',
		materializedInputRef: await stored(store, request(second)),
		rawOutputBeforeCoercionRef: await stored(store, raw2),
		answerSpanRef: await stored(store, a2),
		volunteeredReasoningRef: await stored(store, 'VOLUNTEERED-2 the model’s own account, which is never shown'),
		workProductDerivation: { relation: 'ENVELOPE_FIELD', storageKey: 'wp_2' }
	});
	b.artifact('art_2', { storageKey: 'wp_2', producingPwuId: 'pwu_src', producingExecutionAttemptId: 'step_1#1' });
	// ⭑ The assurance stage's exchange over the round, on the EXECUTION plane: never one of the unit's (`isAssuranceStageExchange`).
	b.exchange('mex_stage', {
		plane: 'EXECUTION',
		invokerId: 'assurance-stage.hypothesizer',
		subjectObjectId: 'pwu_src',
		requestedAt: '2026-11-17T10:06:00Z',
		materializedInputRef: await stored(store, 'the Hypothesizer’s prompt'),
		rawOutputBeforeCoercionRef: PENDING,
		answerSpanRef: PENDING,
		volunteeredReasoningRef: PENDING
	});
	return { store, rows: b.rows(), a1, a2, raw1, raw2 };
}

/** ⭐ L17-03 — `rows` with one exchange's state changed by `over`. */
const withExchange = (rows: RecordRows, exchangeId: string, over: (state: Record<string, unknown>) => Record<string, unknown>): RecordRows => {
	const objects = new Map(rows.objects);
	const x = objects.get(exchangeId)!;
	objects.set(exchangeId, { ...x, state: over(x.state) });
	return { objects, events: rows.events };
};

const unit = (over: Partial<ReplacedUnit> & Pick<ReplacedUnit, 'unitId' | 'title'>): ReplacedUnit => ({ state: 'ACCEPTED', hasRecord: true, ...over });
const FAULTY_TAIL =
	'The feedback above says what that work got wrong; read the record only if you need more detail than the feedback gives — it shows what was tried and failed, so that you do not try it again, unless something material has changed that would let it succeed now.';
const OTHER_TAIL =
	'It is redone because work it used was replaced; read the record only if you need more detail than the feedback gives — it shows how that work was done on what it used then, which has since changed.';
const RECORDED = (title: string, id: string) => `The unit this one replaces, "${title}" (${id}), was worked on before, and its conversation is on the record.`;

/**
 * ⭐ L17-01 — a unit's conversation of one try whose request's tool result is one line long enough to span parts, every text its unit's own
 * (`marker`), so a part served from a wrong unit is seen.
 */
const longConversation = (unitId: string, title: string, marker: string): UnitConversation => ({
	unitId,
	title,
	exchanges: [
		{
			exchangeId: `mex_${marker}`,
			step: { ordinal: 1, stepId: 'step_1' },
			try: 1,
			request: {
				kind: 'PROVIDER_REQUEST',
				instructions: 'The execution contract.',
				items: [user(`${marker}: write it.`), call(1), output(1, `${marker} `.repeat(9_000))]
			},
			answer: { kind: 'RAW_OUTPUT', text: RAW(1, marker) },
			droppedReplies: []
		}
	]
});

describe('⭐⭐ L17b3 (D89) — the line of units replaced, and the first turn’s sentence', () => {
	it('⛔ RED FIRST — the faulty unit’s successor: the lead’s words, for a line of one unit with a record', () => {
		expect(replacedLineSentence([unit({ unitId: 'pwu_src', title: 'Source Construction' })], 'FAULTY'), 'the faulty successor’s sentence is not the lead’s draft').toBe(
			`${RECORDED('Source Construction', 'pwu_src')} You can read it with the read_earlier_attempt tool. ${FAULTY_TAIL}`
		);
	});

	it('⛔ RED FIRST — another successor: its unit’s recorded state, accepted, rejected by its reviews, or neither when it was replaced', () => {
		const said = (state: ReplacedUnit['state']) => replacedLineSentence([unit({ unitId: 'pwu_uts', title: 'Unit Test Suite', state })], 'OTHER');
		expect([said('ACCEPTED'), said('REJECTED'), said('NEITHER')], 'another successor’s sentence does not state its unit’s recorded state').toEqual(
			['Its work was accepted.', 'Its work was rejected by its reviews.', 'Its work had been neither accepted nor rejected when it was replaced.'].map(
				(state) => `${RECORDED('Unit Test Suite', 'pwu_uts')} You can read it with the read_earlier_attempt tool. ${state} ${OTHER_TAIL}`
			)
		);
	});

	it('⛔ RED FIRST — a line of units named nearest first, each with what the record holds of it', () => {
		const line = [unit({ unitId: 'pwu_c', title: 'C' }), unit({ unitId: 'pwu_b', title: 'B', hasRecord: false }), unit({ unitId: 'pwu_a', title: 'A' })];
		expect(replacedLineSentence(line, 'FAULTY'), 'the line is not named nearest first, each with what it left').toBe(
			`${RECORDED('C', 'pwu_c')} "B" (pwu_b) left no recorded conversation. ${RECORDED('A', 'pwu_a')} You can read each with the read_earlier_attempt tool, the nearest by default. ${FAULTY_TAIL}`
		);
	});

	it('⛔ RED FIRST — a line whose nearest unit left nothing and an earlier one a record', () => {
		const line = [unit({ unitId: 'pwu_b', title: 'B', hasRecord: false, state: 'REJECTED' }), unit({ unitId: 'pwu_a', title: 'A' })];
		expect(replacedLineSentence(line, 'OTHER'), 'the nearest unit’s absence or the earlier unit’s record is not said').toBe(
			`"B" (pwu_b) left no recorded conversation. ${RECORDED('A', 'pwu_a')} You can read it with the read_earlier_attempt tool. The work of "B" (pwu_b) was rejected by its reviews. ${OTHER_TAIL}`
		);
	});

	it('⛔ RED FIRST — a line with no record is told so, in place of the sentence', () => {
		const none = [unit({ unitId: 'pwu_b', title: 'B', hasRecord: false }), unit({ unitId: 'pwu_a', title: 'A', hasRecord: false })];
		expect([replacedLineSentence(none, 'FAULTY'), replacedLineSentence(none.slice(0, 1), 'OTHER')], 'a line with no record is not told so').toEqual([
			NO_RECORD_SENTENCE,
			NO_RECORD_SENTENCE
		]);
		expect(NO_RECORD_SENTENCE).toBe('The unit this one replaces left no recorded conversation.');
	});

	it('⛔ RED FIRST — the line read from the record’s links, nearest first: each unit’s state and whether it left an executor exchange', async () => {
		const { rows } = await unitWithARepair();
		const b = rowsBuilder();
		for (const [id, o] of rows.objects) b.rows().objects.set(id, o);
		b.unit('pwu_src', 'Source Construction', 'REJECTED', 'pwu_src2');
		b.unit('pwu_src2', 'Source Construction', 'UNASSESSED', 'pwu_src3');
		b.unit('pwu_src3', 'Source Construction', 'UNASSESSED');
		const merged: RecordRows = { objects: b.rows().objects, events: [...rows.events, ...b.rows().events] };
		expect(replacedLineOf(merged, 'pwu_src3'), 'the line is not read nearest first, each with its state and its record').toEqual([
			{ unitId: 'pwu_src2', title: 'Source Construction', state: 'NEITHER', hasRecord: false },
			{ unitId: 'pwu_src', title: 'Source Construction', state: 'REJECTED', hasRecord: true }
		]);
		expect(replacedLineOf(merged, 'pwu_src'), 'a unit that replaces none has a line').toEqual([]);
	});

	// ⭐ L17-03 — the accepted state read from the record, which the case above never met.
	it('⛔ RED FIRST — a unit’s recorded state read as the sentence states it: SATISFIED accepted, REJECTED rejected by its reviews, any other neither (the review’s L17-03)', () => {
		const b = rowsBuilder();
		b.unit('pwu_1', 'One', 'SATISFIED', 'pwu_2');
		b.unit('pwu_2', 'Two', 'REJECTED', 'pwu_3');
		b.unit('pwu_3', 'Three', 'ASSESSING', 'pwu_4');
		b.unit('pwu_4', 'Four', 'UNASSESSED');
		expect(
			replacedLineOf(b.rows(), 'pwu_4').map((x) => [x.unitId, x.state]),
			'a unit’s recorded assurance state is misread'
		).toEqual([
			['pwu_3', 'NEITHER'],
			['pwu_2', 'REJECTED'],
			['pwu_1', 'ACCEPTED']
		]);
	});
});

describe('⭐⭐ L17b3 (D89) — a unit’s conversation, read from the record', () => {
	it('⛔ RED FIRST — its executor exchanges in recorded order, the assurance stage’s left out, each named by its step and its try, every exchange’s bytes checked', async () => {
		const { store, rows, raw1, raw2 } = await unitWithARepair();
		const c = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		expect([c.unitId, c.title], 'the conversation is not the unit’s').toEqual(['pwu_src', 'Source Construction']);
		expect(
			c.exchanges.map((x) => [x.exchangeId, x.step.ordinal, x.step.stepId, x.try, x.request.kind, x.answer.kind]),
			'the exchanges are not the unit’s, in order, each with its step and try, its request read and its answer'
		).toEqual([
			['mex_1', 1, 'step_1', 1, 'PROVIDER_REQUEST', 'RAW_OUTPUT'],
			['mex_2', 1, 'step_1', 2, 'PROVIDER_REQUEST', 'RAW_OUTPUT']
		]);
		// ⭐ L17-03 — ~~`.toEqual([a1, a2])`~~: the raw output and the span are stored apart now, and the raw output is the answer read.
		expect(
			c.exchanges.map((x) => (x.answer.kind === 'RAW_OUTPUT' || x.answer.kind === 'ANSWER_SPAN' ? x.answer.text : '')),
			'every answer is not read back as recorded'
		).toEqual([raw1, raw2]);
	});

	it('⛔ RED FIRST — an exchange whose bytes cannot be read, or do not verify, is named in its place, never left out unsaid', async () => {
		const { store, rows } = await unitWithARepair();
		const tampered = new Map(rows.objects);
		const x1 = tampered.get('mex_1')!;
		tampered.set('mex_1', { ...x1, state: { ...x1.state, materializedInputRef: { ...(x1.state.materializedInputRef as object), contentHash: sha('other bytes') } } });
		const x2 = tampered.get('mex_2')!;
		tampered.set('mex_2', { ...x2, state: { ...x2.state, materializedInputRef: { ...(x2.state.materializedInputRef as object), storageKey: 'no-such-key' } } });
		const c = await unitConversationOf({ objects: tampered, events: rows.events }, store, TENANT, 'pwu_src');
		expect(c.exchanges.map((x) => [x.exchangeId, x.request.kind]), 'an unreadable exchange was left out, or read').toEqual([
			['mex_1', 'UNREADABLE'],
			['mex_2', 'UNREADABLE']
		]);
		const text = renderUnitConversation(c).join('\n');
		expect(text, 'an exchange that does not verify is not named in its place').toContain('[its request could not be read: ');
		expect(text.match(/── Exchange \d of 2 \(mex_\d\)/g), 'an unreadable exchange has no heading of its own').toEqual(['── Exchange 1 of 2 (mex_1)', '── Exchange 2 of 2 (mex_2)']);
		// ⭐ The lead's ruling 2 of §33 — and each named in its own exchange's place: after its heading, before the next one's (`bodyOf`).
		expect(
			[
				bodyOf(text, 'mex_1').filter((l) => l.startsWith('[its request could not be read: ')).map((l) => l.includes('hash to')),
				bodyOf(text, 'mex_2').filter((l) => l.startsWith('[its request could not be read: ')).map((l) => l.includes('are not in the content store'))
			],
			'an unreadable request is not named in its own exchange’s place'
		).toEqual([[true], [true]]);
	});

	// ⭐ L17-03 — the answer's source chosen by the READER, from refs stored apart: never a result made after the read.
	it('⛔ RED FIRST — the answer read from the record: the raw output where it was stored whole, the answer span where it was not, neither said so, and raw bytes that do not match their hash named in place — never the volunteered reasoning (the review’s L17-03)', async () => {
		const { store, rows, raw1, raw2, a2 } = await unitWithARepair();
		const spanOnly = withExchange(rows, 'mex_2', (s) => ({ ...s, rawOutputBeforeCoercionRef: PENDING }));
		const neither = withExchange(rows, 'mex_2', (s) => ({ ...s, rawOutputBeforeCoercionRef: PENDING, answerSpanRef: PENDING }));
		// ⭐ AMENDED FOR THE LEAD'S RULING §10.1 (1): ~~raw bytes that do not verify named in place, no fall back~~ — a raw output whose bytes do not
		// match their hash falls back to the span where IT verifies, the line saying which and why; only where neither verifies, or the span is absent,
		// is the answer named in place as unreadable. Each case through the reader.
		const unverified = (ref: unknown) => ({ ...(ref as object), contentHash: sha('bytes the model never wrote') });
		const corrupt = withExchange(rows, 'mex_2', (s) => ({ ...s, rawOutputBeforeCoercionRef: unverified(s.rawOutputBeforeCoercionRef) }));
		const corruptBoth = withExchange(rows, 'mex_2', (s) => ({
			...s,
			rawOutputBeforeCoercionRef: unverified(s.rawOutputBeforeCoercionRef),
			answerSpanRef: unverified(s.answerSpanRef)
		}));
		const corruptNoSpan = withExchange(rows, 'mex_2', (s) => ({ ...s, rawOutputBeforeCoercionRef: unverified(s.rawOutputBeforeCoercionRef), answerSpanRef: PENDING }));
		const read = async (r: RecordRows) => (await unitConversationOf(r, store, TENANT, 'pwu_src')).exchanges.map((x) => x.answer);
		const [whole, span, none, fellBack, both, noSpan] = [
			await read(rows),
			await read(spanOnly),
			await read(neither),
			await read(corrupt),
			await read(corruptBoth),
			await read(corruptNoSpan)
		];
		expect(
			[whole, span, none, fellBack, both, noSpan].map((answers) => answers.map((a) => a.kind)),
			'the answer’s source is not the raw output first, the span where it is absent or does not verify, neither said, or an answer that does not verify named'
		).toEqual([
			['RAW_OUTPUT', 'RAW_OUTPUT'],
			['RAW_OUTPUT', 'ANSWER_SPAN'],
			['RAW_OUTPUT', 'NONE'],
			['RAW_OUTPUT', 'ANSWER_SPAN'],
			['RAW_OUTPUT', 'UNREADABLE'],
			['RAW_OUTPUT', 'UNREADABLE']
		]);
		expect(
			[whole[1], span[1], fellBack[1]].map((a) => (a!.kind === 'RAW_OUTPUT' || a!.kind === 'ANSWER_SPAN' ? [a!.kind, a!.text] : [a!.kind])),
			'the answer read is not the bytes its source holds'
		).toEqual([
			['RAW_OUTPUT', raw2],
			['ANSWER_SPAN', a2],
			['ANSWER_SPAN', a2]
		]);
		const render = async (r: RecordRows) => renderUnitConversation(await unitConversationOf(r, store, TENANT, 'pwu_src')).join('\n');
		const [wholeText, spanText, noneText, fellBackText, bothText, noSpanText] = [
			await render(rows),
			await render(spanOnly),
			await render(neither),
			await render(corrupt),
			await render(corruptBoth),
			await render(corruptNoSpan)
		];
		const FELL_BACK = '[answer, as recorded: the answer span — the raw output could not be read: ';
		expect(
			[
				wholeText.includes(raw1) && wholeText.includes(raw2),
				spanText.includes(`[answer, as recorded: the answer span]\n${a2}`),
				noneText.includes('[no answer recorded: '),
				fellBackText.includes(FELL_BACK) && fellBackText.indexOf(a2) > fellBackText.indexOf(FELL_BACK),
				bothText.includes('[its answer could not be read: ') && noSpanText.includes('[its answer could not be read: '),
				[fellBackText, bothText, noSpanText].some((t) => t.includes('RAW-2 ')),
				bothText.includes(a2)
			],
			'an answer is not shown from its source, its fall back to the span not said with why, an answer that does not verify not named in place, or bytes that do not verify shown'
		).toEqual([true, true, true, true, true, false, false]);
		expect(
			[wholeText, spanText, noneText, fellBackText, bothText, noSpanText].some((t) => t.includes('VOLUNTEERED-')),
			'the volunteered reasoning is shown'
		).toBe(false);
		// ⭐ The lead's ruling 2 of §33 — and named in mex_2's own place: after its heading; mex_1's holds none of them.
		expect(
			[
				bodyOf(fellBackText, 'mex_2').some((l) => l.startsWith(FELL_BACK)),
				bodyOf(fellBackText, 'mex_1').some((l) => l.startsWith(FELL_BACK)),
				bodyOf(bothText, 'mex_2').some((l) => l.startsWith('[its answer could not be read: ')),
				bodyOf(noSpanText, 'mex_2').some((l) => l.startsWith('[its answer could not be read: ')),
				bodyOf(bothText, 'mex_1').some((l) => l.startsWith('[its answer could not be read: ')),
				// ⭐ The lead's ruling 3 of §39 — and the no-span case's absence from mex_1, which the comment above claims.
				bodyOf(noSpanText, 'mex_1').some((l) => l.startsWith('[its answer could not be read: '))
			],
			'an answer that could not be read is not named in its own exchange’s place'
			// ~~`).toEqual([true, false, true, true, false])`~~ — and the no-span case's absence from mex_1 (the lead's ruling 3 of §39).
		).toEqual([true, false, true, true, false, false]);
	});

	it('⛔ RED FIRST — what the record holds, for the declarations: an answer; findings, or the loop’s feedback a predecessor was given', async () => {
		const { store, rows } = await unitWithARepair();
		const c = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const once: UnitConversation = { ...c, exchanges: c.exchanges.slice(0, 1) };
		const none: UnitConversation = { ...c, exchanges: [] };
		expect([recordHoldings([c]), recordHoldings([once]), recordHoldings([none]), recordHoldings([])], 'what the record holds is misread').toEqual([
			{ answer: true, findings: true },
			{ answer: true, findings: false },
			{ answer: false, findings: false },
			{ answer: false, findings: false }
		]);
	});

	// ⭐ L17-03 — D89's text counts the loop's feedback a predecessor was given as findings the record holds (§12.43, "What a replacement's turns
	// declare": "`PRIOR_REVIEW_FINDING` where it holds findings or the loop's feedback a predecessor was given"), so a request that carried D77's
	// feedback alone holds findings; and so does one that carried a re-run's findings (RD8), as a provider request or as a turn's text alone.
	it('⛔ RED FIRST — a predecessor’s request that carried the loop’s feedback alone, or a re-run’s findings, holds findings; one that carried neither holds none (the review’s L17-03; D89)', () => {
		const one = (request: UnitConversation['exchanges'][number]['request']): UnitConversation => ({
			unitId: 'pwu_f',
			title: 'F',
			exchanges: [{ exchangeId: 'mex_f', step: { ordinal: 1, stepId: 'step_1' }, try: 1, request, answer: { kind: 'NONE', why: 'the model call itself failed' }, droppedReplies: [] }]
		});
		const provider = (text: string) => one({ kind: 'PROVIDER_REQUEST', instructions: 'The execution contract.', items: [user(text)] });
		expect(
			[
				recordHoldings([provider(`Write it.\n\n${FEEDBACK_HEADING}\n- The round’s failed criterion.`)]),
				recordHoldings([one({ kind: 'TURN_TEXT', text: `Write it.\n\n${FEEDBACK_HEADING}\n- The round’s failed criterion.` })]),
				recordHoldings([provider(`Write it.\n\n${CARRIED_FINDINGS_LINE}\n- C1: no.`)]),
				recordHoldings([provider('Write it.')])
			],
			'the loop’s feedback, or a re-run’s findings, a predecessor was given is not counted as findings the record holds'
		).toEqual([
			{ answer: false, findings: true },
			{ answer: false, findings: true },
			{ answer: false, findings: true },
			{ answer: false, findings: false }
		]);
	});
});

describe('⭐⭐ L17b3 (D89; the lead’s ruling 3) — the rendering', () => {
	it('⛔ RED FIRST — parts of at most 20,000 characters, each headed part n of N; the first opens with the unit and the list of its exchanges, each with the part it begins in', async () => {
		const { store, rows } = await unitWithARepair();
		const c = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		// ⭑ A tool result longer than two parts, in the first try's request: the rendering must cut its line and span parts. ⭐ L17-12 — ~~`'x'`~~: a
		// character no other text of the fixture holds, so the whole of the line can be counted across the parts.
		const long: UnitConversation = {
			...c,
			exchanges: c.exchanges.map((x, i) =>
				i === 0 && x.request.kind === 'PROVIDER_REQUEST' ? { ...x, request: { ...x.request, items: [...x.request.items, output(9, '¤'.repeat(45_000))] } } : x
			)
		};
		const parts = renderUnitConversation(long);
		expect(EARLIER_ATTEMPT_PART_BOUND).toBe(20_000);
		expect(parts.length, 'the rendering was not cut into parts').toBeGreaterThanOrEqual(3);
		expect(parts.every((p) => p.length <= 20_000), 'a part is over its bound').toBe(true);
		expect(parts.map((p) => p.split('\n')[0]), 'a part is not headed part n of N').toEqual(parts.map((_, i) => `part ${i + 1} of ${parts.length}`));
		const head = parts[0]!.split('\n');
		expect(head.slice(1, 5), 'the first part does not open with the unit and the list of its exchanges').toEqual([
			'The recorded conversation of "Source Construction" (pwu_src), as the Governed Stream recorded it: 2 exchange(s).',
			'Its exchanges, each with the part it begins in:',
			'- mex_1 — step 1, try 1: part 1',
			`- mex_2 — step 1, try 2: part ${parts.findIndex((p) => p.includes('── Exchange 2 of 2 (mex_2)')) + 1}`
		]);
		expect(parts.findIndex((p) => p.includes('── Exchange 2 of 2 (mex_2)')), 'the second exchange begins in the first part, past a long line').toBeGreaterThan(0);
		// ⭐ L17-12 — the whole of the long line is in the parts, none of it lost at a cut.
		expect(parts.join('').split('¤').length - 1, 'the long line is not whole across the parts').toBe(45_000);
	});

	it('⛔ RED FIRST — each request message shown once: a request that begins with the one before shows what follows it; one that does not is said to begin a new conversation; a replayed answer is not repeated', async () => {
		const { store, rows, raw1 } = await unitWithARepair();
		const c = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const text = renderUnitConversation(c).join('\n');
		const count = (s: string, of: string) => s.split(of).length - 1;
		expect(count(text, 'Write the Source.'), 'the first turn is shown more than once').toBe(1);
		expect(count(text, 'wrote docs/1.md'), 'the first try’s tool result is shown more than once').toBe(1);
		expect(text, 'the replayed answer is not said to be the one shown above').toContain('[assistant — the answer shown above, replayed]');
		// ⭐ L17-03 — ~~`text.split(a1)`~~: the answer shown is the raw output now.
		expect(count(text, raw1), 'the first answer is not shown exactly once').toBe(1);
		expect(text, 'a request that begins with the one before is said to begin a new one').not.toContain('[this request begins a new conversation]');
		// ⭐ L17-12 — each message's content, once: the instructions, each turn, each call by its arguments and each result.
		expect(
			[
				count(text, 'The execution contract.'),
				count(text, `${REPAIR_OPENING}\n- C1: no.`),
				count(text, '{"path":"docs/1.md"}'),
				count(text, '{"path":"docs/2.md"}'),
				count(text, 'wrote docs/2.md')
			],
			'the instructions, a turn, a call’s arguments or a tool’s result is not shown exactly once'
		).toEqual([1, 1, 1, 1, 1]);
		// ⭑ The second try's request NOT beginning with the first's (a compaction): shown whole, said to begin a new conversation.
		const restarted: UnitConversation = {
			...c,
			exchanges: c.exchanges.map((x, i) => (i === 1 && x.request.kind === 'PROVIDER_REQUEST' ? { ...x, request: { ...x.request, items: [user('A compaction summary.'), call(2), output(2)] } } : x))
		};
		const again = renderUnitConversation(restarted).join('\n');
		expect(again, 'a request that does not begin with the one before is not said to begin a new conversation').toContain('[this request begins a new conversation]');
		// ⭐ L17-12 — and shown whole after the line saying so: its own messages, its call and its result.
		const at = again.indexOf('[this request begins a new conversation]');
		expect(
			[again.indexOf('A compaction summary.') > at, again.lastIndexOf('{"path":"docs/2.md"}') > at, again.lastIndexOf('wrote docs/2.md') > at],
			'the request that begins a new conversation is not shown whole after the line saying so'
		).toEqual([true, true, true]);
	});

	it('⛔ RED FIRST — every answer shown, one that ended in an error among them; the raw output where it was stored whole, else the answer span, the line saying which; never the volunteered reasoning', async () => {
		const { store, rows, raw1, a2 } = await unitWithARepair();
		// ⭐ L17-03 — ~~`answer: { kind: 'ANSWER_SPAN', text: '{"workProduct":"the span alone"}' }`~~ injected after the read: the second try's raw output
		// is not stored, so the READER gives its span.
		const spanOnly = withExchange(rows, 'mex_2', (s) => ({ ...s, rawOutputBeforeCoercionRef: PENDING }));
		const text = renderUnitConversation(await unitConversationOf(spanOnly, store, TENANT, 'pwu_src')).join('\n');
		expect(text, 'the raw output is not said to be the answer shown').toContain(`[answer, as recorded: the raw output]\n${raw1}`);
		expect(text, 'the answer span is not said to be the answer shown').toContain(`[answer, as recorded: the answer span]\n${a2}`);
		expect([text.split(raw1).length - 1, text.split(a2).length - 1], 'an answer is not shown exactly once').toEqual([1, 1]);
		expect(text, 'volunteered reasoning is shown').not.toContain('VOLUNTEERED-');
	});

	it('⛔ RED FIRST — a turn’s text alone, an encrypted reasoning item, and this tool’s own call, each said so; a reply Pi dropped, shown as that, with its error (D92)', async () => {
		const { store, rows } = await unitWithARepair();
		const c = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const [x1, x2] = c.exchanges;
		const varied: UnitConversation = {
			...c,
			exchanges: [
				{ ...x1!, droppedReplies: [{ text: 'PARTIAL text before the break.', stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: 1, place: 1 }] },
				{ ...x2!, request: { kind: 'TURN_TEXT', text: 'The turn that threw.' }, answer: { kind: 'NONE', why: 'the model call itself failed' } },
				{
					...x2!,
					exchangeId: 'mex_3',
					try: 3,
					request: {
						kind: 'PROVIDER_REQUEST',
						instructions: 'The execution contract.',
						// ⭐ L17-12 — ~~`call(7, READ_EARLIER_ATTEMPT_TOOL)`~~ with a file's path: the tool's own call with its own arguments, shown by them.
						items: [user('Write it.'), call(7, READ_EARLIER_ATTEMPT_TOOL, { unit: 'pwu_src', part: 2 }), output(7, 'part 1 of 1\nthe earlier record, which must not be shown again')]
					}
				}
			]
		};
		const text = renderUnitConversation(varied).join('\n');
		expect(text, 'an encrypted reasoning item is not said so').toContain('[reasoning — held encrypted on the record, so it is not shown]');
		expect(text, 'an encrypted reasoning item’s ciphertext is shown').not.toContain('ciphertext-that-must-never-be-shown');
		expect(text, 'a turn’s text alone is not said so').toContain(
			'[this try’s turn, as the record holds it — not the provider request: the call threw, or its executor keeps no session]'
		);
		// ⭐ L17-12 — and the turn's text itself shown, after the line saying so.
		const turnLine = text.indexOf('[this try’s turn, as the record holds it');
		expect([text.split('The turn that threw.').length - 1, text.indexOf('The turn that threw.') > turnLine], 'a turn’s text alone is not shown once, after the line saying so').toEqual([1, true]);
		expect(text, 'a try that threw is not said to have recorded no answer').toContain('[no answer recorded: the model call itself failed]');
		expect(text, 'the tool’s own call is not shown by its arguments').toContain(`[tool call: ${READ_EARLIER_ATTEMPT_TOOL}]`);
		// ⭐ L17-12 — its arguments themselves, after its line.
		const callLine = text.indexOf(`[tool call: ${READ_EARLIER_ATTEMPT_TOOL}]`);
		expect(text.indexOf('{"unit":"pwu_src","part":2}') > callLine, 'the tool’s own call’s arguments are not shown after its line').toBe(true);
		expect(text, 'the tool’s own result is repeated').not.toContain('which must not be shown again');
		expect(text, 'the tool’s own result is not named').toContain('[tool result — this tool’s own, not repeated here]');
		expect(text, 'a dropped reply is not shown as one, with its error').toContain(
			'[a reply Pi dropped to go on — the conversation does not hold it; its error: 503 Service Unavailable]'
		);
		expect(text, 'a dropped reply’s text is not shown').toContain('PARTIAL text before the break.');
	});

	// ⭐⭐ The lead's ruling §7.4 (3) — A DROPPED REPLY RENDERED IN ITS PLACE: its ordinal among the try's assistant replies, dropped and kept counted
	// alike, in the order they arrived. The try's last captured request holds the kept replies before the answer (a reply's items its message, its
	// calls, then their results) and never a dropped one (D92), so the dropped reply is shown where it arrived among them; the answer, the joined text
	// of the kept replies, after the request as before.
	it('⛔ RED FIRST — a dropped reply shown in its place among the try’s replies: a kept reply with a tool call, then the dropped one, then the retry’s; and before the kept reply where it arrived first (§7.4 (3))', async () => {
		const { store, rows } = await unitWithARepair();
		const c = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const x = c.exchanges[0]!;
		const dropped = (place: number) => ({ text: 'PARTIAL-I text before the break.', stopReason: 'error' as const, errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY' as const, attempt: 1, place });
		const interleaved = (place: number): UnitConversation => ({
			...c,
			exchanges: [
				{
					...x,
					request: { kind: 'PROVIDER_REQUEST', instructions: 'The execution contract.', items: [user('Write it.'), assistantSaid('KEPT-I the first reply.', 'msg_k'), call(5), output(5)] },
					answer: { kind: 'RAW_OUTPUT', text: 'KEPT-I the first reply. ANSWER-I the retry answers.' },
					droppedReplies: [dropped(place)]
				}
			]
		});
		const after = renderUnitConversation(interleaved(2)).join('\n');
		const at = (s: string, of: string) => s.indexOf(of);
		expect(
			[
				at(after, 'Write it.') < at(after, 'KEPT-I the first reply.'),
				at(after, 'KEPT-I the first reply.') < at(after, 'wrote docs/5.md'),
				at(after, 'wrote docs/5.md') < at(after, '[a reply Pi dropped to go on'),
				at(after, '[a reply Pi dropped to go on') < at(after, 'PARTIAL-I text before the break.'),
				at(after, 'PARTIAL-I text before the break.') < at(after, '[answer, as recorded: the raw output]')
			],
			'a reply dropped after a kept reply and its tool call is not shown after them, before the answer'
		).toEqual([true, true, true, true, true]);
		const before = renderUnitConversation(interleaved(1)).join('\n');
		expect(
			[at(before, 'Write it.') < at(before, '[a reply Pi dropped to go on'), at(before, 'PARTIAL-I text before the break.') < at(before, 'KEPT-I the first reply.')],
			'a reply dropped before the kept one is not shown before it'
		).toEqual([true, true]);
	});

	// ⭐⭐ The lead's ruling §10.1 (3) — THE PLACE, CORRECTED: ~~after the (p−1)th kept reply~~ — after every reply that came before it, kept or dropped:
	// after the k-th kept reply of the request, counted from its last user entry, k = (p − 1) − (the dropped replies of a place below p); and after
	// the request where k passes its kept replies. Two dropped, then two kept with tool calls, then the answer: both dropped before the first kept.
	it('⛔ RED FIRST — two dropped replies, then two kept with tool calls, then the answer: each dropped reply after every reply that came before it, kept or dropped — both before the first kept reply (§10.1 (3))', async () => {
		const { store, rows } = await unitWithARepair();
		const c = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const dropped = (place: number) => ({ text: `PARTIAL-${place} text before the break.`, stopReason: 'error' as const, errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY' as const, attempt: place, place });
		const text = renderUnitConversation({
			...c,
			exchanges: [
				{
					...c.exchanges[0]!,
					request: {
						kind: 'PROVIDER_REQUEST',
						instructions: 'The execution contract.',
						items: [user('Write it.'), assistantSaid('KEPT-3 the third reply.', 'msg_3'), call(3), output(3), assistantSaid('KEPT-4 the fourth reply.', 'msg_4'), call(4), output(4)]
					},
					answer: { kind: 'RAW_OUTPUT', text: 'KEPT-3 the third reply. KEPT-4 the fourth reply. ANSWER-5 the last reply.' },
					droppedReplies: [dropped(1), dropped(2)]
				}
			]
		}).join('\n');
		const order = [
			'Write it.',
			'PARTIAL-1 text before the break.',
			'PARTIAL-2 text before the break.',
			'KEPT-3 the third reply.',
			'wrote docs/3.md',
			'KEPT-4 the fourth reply.',
			'wrote docs/4.md',
			'[answer, as recorded: the raw output]'
		].map((s) => text.indexOf(s));
		expect(
			order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]!)),
			`the replies are not shown in the order they came, each dropped one after every reply before it (at ${order.join(', ')})`
		).toBe(true);
	});

	it('⛔ RED FIRST — a reply recorded beside its exchange as one Pi dropped is read from the record by the exchange’s name (D92)', async () => {
		const { store, rows } = await unitWithARepair();
		// ⭐ §7.4 (3) — each dropped reply's place among the try's replies, on the record with it.
		const replies = [{ text: 'PARTIAL text before the break.', stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: 1, place: 1 }];
		const ref = await store.put({
			tenantPrefix: TENANT,
			bytes: JSON.stringify({ schema: DROPPED_REPLIES_SCHEMA, exchangeId: 'mex_1', replies }),
			mediaType: 'application/json',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		expect((await store.bindName(droppedRepliesNameOf(TENANT, 'mex_1'), ref.storageKey)).bound, 'arrangement: the name bound').toBe(true);
		const c = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		expect(c.exchanges.map((x) => x.droppedReplies), 'the dropped reply recorded beside the exchange is not read').toEqual([replies, []]);
	});
});

describe('⭐⭐ L17b3 (D89; the lead’s ruling 1) — each read recorded, and the tool', () => {
	it('⛔ RED FIRST — a read’s record on the content plane, bound to the step’s attempt: the unit, the part, the number of parts and the sha256 of the text returned', async () => {
		const store = createInMemoryArtifactStore();
		const read: EarlierAttemptRead = {
			attemptKey: 'step_9#1',
			ordinal: 1,
			try: 1,
			readerUnitId: 'pwu_src2',
			unitId: 'pwu_src',
			part: 2,
			parts: 5,
			outcome: 'SERVED',
			sha256: sha('the part'),
			chars: 8
		};
		const done = await recordEarlierAttemptRead(store, TENANT, read);
		expect(done.recorded, 'the read was not recorded').toBe(true);
		expect(earlierAttemptReadNameOf(TENANT, 'step_9#1', 1)).toBe(`${TENANT}/earlier-attempt-read/step_9#1/1`);
		const bound = await store.resolveName(earlierAttemptReadNameOf(TENANT, 'step_9#1', 1));
		expect(bound, 'the read is not bound to the step’s attempt').toBeDefined();
		expect(JSON.parse((await store.get(bound!.storageKey)) ?? '{}'), 'the record does not hold the read').toEqual({ schema: EARLIER_ATTEMPT_READ_SCHEMA, ...read });
		expect((await store.stat(bound!.storageKey))?.purgeability, 'the read record is purgeable').toBe('RETAINED_BY_PARTICIPATION');
	});

	/** The tool's ports: the Undertaking's workspace and runner as any step's, and the record's port as a case gives it. */
	const portsWith = (earlierAttempt?: EarlierAttemptPort) => ({
		workspace: createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_1', purgeability: 'RETAINED_BY_PARTICIPATION' }),
		runner: createRefusingProcessRunner(),
		processRuns: createProcessRunObserver(),
		...(earlierAttempt ? { earlierAttempt } : {})
	});
	/**
	 * ⭐ L17-01 — a port over the `line` of units, nearest first, each unit's own conversation from `byUnit` (a unit it holds none of answered with an
	 * empty one, so a part served from a wrong unit is seen); every unit asked for kept in `asked`; each read recorded into `reads`, or by `record`.
	 */
	const portOverLine = (
		line: readonly ReplacedUnit[],
		byUnit: Readonly<Record<string, UnitConversation>>,
		reads: EarlierAttemptRead[],
		asked: string[] = [],
		record?: EarlierAttemptPort['record']
	): EarlierAttemptPort => ({
		readerUnitId: 'pwu_src2',
		attemptKey: 'step_9#1',
		currentTry: () => 1,
		units: line,
		conversationOf: async (unitId: string) => {
			asked.push(unitId);
			return byUnit[unitId] ?? { unitId, title: '(a unit this port holds no conversation of)', exchanges: [] };
		},
		record:
			record ??
			(async (read) => {
				reads.push(read);
				return { recorded: true as const, storageKey: `k${reads.length}` };
			})
	});
	/** A port over `conversation`, a line of its one unit, recording each read into `reads`, or refusing them all where `refuse` says why. */
	const portOver = (conversation: UnitConversation, reads: EarlierAttemptRead[], refuse?: string): EarlierAttemptPort =>
		portOverLine(
			[unit({ unitId: conversation.unitId, title: conversation.title })],
			{ [conversation.unitId]: conversation },
			reads,
			[],
			refuse === undefined ? undefined : async () => ({ recorded: false as const, refusedBecause: refuse })
		);

	it('⛔ RED FIRST — the tool is minted only where the grant names earlier-attempt-record and a record to read is handed in', async () => {
		const { store, rows } = await unitWithARepair();
		const port = portOver(await unitConversationOf(rows, store, TENANT, 'pwu_src'), []);
		const minted = (granted: readonly string[], earlierAttempt?: EarlierAttemptPort) =>
			mintExecutionTools({ ports: portsWith(earlierAttempt) as never, grantedCapabilities: granted, bindingAuthorizationStatus: 'AUTHORIZED' }).map((t) => t.name);
		expect(EARLIER_ATTEMPT_CAPABILITY).toBe('earlier-attempt-record');
		expect(
			[minted([EARLIER_ATTEMPT_CAPABILITY], port), minted([EARLIER_ATTEMPT_CAPABILITY]), minted(['file-system'], port)],
			'the tool is minted without its grant, or without a record, or not with both'
		).toEqual([[READ_EARLIER_ATTEMPT_TOOL], [], ['write_file']]);
	});

	/** The minted tool's run, over `port`. */
	const toolOver = (port: EarlierAttemptPort) =>
		mintExecutionTools({ ports: portsWith(port) as never, grantedCapabilities: [EARLIER_ATTEMPT_CAPABILITY], bindingAuthorizationStatus: 'AUTHORIZED' }).find(
			(t) => t.name === READ_EARLIER_ATTEMPT_TOOL
		)!;

	it('⛔ RED FIRST — it serves the part asked for, the nearest unit with a record by default, each read recorded before it is served', async () => {
		const { store, rows } = await unitWithARepair();
		const conversation = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const reads: EarlierAttemptRead[] = [];
		const tool = toolOver(portOver(conversation, reads));
		const parts = renderUnitConversation(conversation);
		const served = await tool.run({});
		expect([served.ok, served.summary], 'the first part of the nearest unit was not served').toEqual([true, parts[0]]);
		expect(reads, 'the read was not recorded as served').toEqual([
			{
				attemptKey: 'step_9#1',
				ordinal: 1,
				try: 1,
				readerUnitId: 'pwu_src2',
				unitId: 'pwu_src',
				part: 1,
				parts: parts.length,
				outcome: 'SERVED',
				sha256: sha(parts[0]!),
				chars: parts[0]!.length
			}
		]);
		expect(tool.parameters, 'the tool’s parameters are not its unit and its part').toEqual({
			unit: expect.objectContaining({ type: 'string', required: false }),
			part: expect.objectContaining({ type: 'integer', required: false })
		});
	});

	// ⭐⭐ L17-01 — THE TOOL'S CHOICE OF UNIT AND PART, over a line whose nearest unit left no record and whose two earlier units each left a
	// conversation of several parts of its own.
	const LINE = [unit({ unitId: 'pwu_b', title: 'B', hasRecord: false }), unit({ unitId: 'pwu_c', title: 'C' }), unit({ unitId: 'pwu_a', title: 'A' })];
	const BY_UNIT = { pwu_c: longConversation('pwu_c', 'C', 'UNIT-C'), pwu_a: longConversation('pwu_a', 'A', 'UNIT-A') };

	it('⛔ RED FIRST — over a line whose nearest unit left no record: the nearest unit WITH one by default, an earlier unit asked for, and a part after the first — each unit’s own conversation, each read recorded (the review’s L17-01)', async () => {
		const reads: EarlierAttemptRead[] = [];
		const asked: string[] = [];
		const tool = toolOver(portOverLine(LINE, BY_UNIT, reads, asked));
		const partsC = renderUnitConversation(BY_UNIT.pwu_c);
		const partsA = renderUnitConversation(BY_UNIT.pwu_a);
		expect([partsC.length, partsA.length].every((n) => n >= 3), 'arrangement: each conversation is of several parts').toBe(true);

		const served = [await tool.run({}), await tool.run({ part: 2 }), await tool.run({ unit: 'pwu_a' }), await tool.run({ unit: 'pwu_a', part: 3 })];

		expect(served.map((s) => [s.ok, s.summary]), 'the part served is not the one asked for, of the unit asked for, or by default the nearest unit with a record').toEqual([
			[true, partsC[0]],
			[true, partsC[1]],
			[true, partsA[0]],
			[true, partsA[2]]
		]);
		expect(
			reads.map((r) => [r.ordinal, r.outcome, r.unitId, r.part, r.parts, r.sha256, r.chars]),
			'a read is not recorded as the part it served, of its unit'
		).toEqual([
			[1, 'SERVED', 'pwu_c', 1, partsC.length, sha(partsC[0]!), partsC[0]!.length],
			[2, 'SERVED', 'pwu_c', 2, partsC.length, sha(partsC[1]!), partsC[1]!.length],
			[3, 'SERVED', 'pwu_a', 1, partsA.length, sha(partsA[0]!), partsA[0]!.length],
			[4, 'SERVED', 'pwu_a', 3, partsA.length, sha(partsA[2]!), partsA[2]!.length]
		]);
		expect(asked.filter((id) => id !== 'pwu_c' && id !== 'pwu_a'), 'the conversation of a unit with no record was read').toEqual([]);
	});

	it('⛔ RED FIRST — a unit or a part outside the record is answered with what may be asked for, and that call is recorded too (OUTSIDE)', async () => {
		const { store, rows } = await unitWithARepair();
		const conversation = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const reads: EarlierAttemptRead[] = [];
		const tool = toolOver(portOver(conversation, reads));
		const parts = renderUnitConversation(conversation).length;
		const noUnit = await tool.run({ unit: 'pwu_nobody' });
		const noPart = await tool.run({ part: parts + 1 });
		expect([noUnit.ok, noPart.ok], 'an outside request was served').toEqual([false, false]);
		expect(noUnit.summary, 'an outside unit is not answered with the units that may be asked for').toContain('pwu_src');
		expect(noPart.summary, 'an outside part is not answered with the parts that may be asked for').toContain(`1 to ${parts}`);
		expect(reads.map((r) => [r.ordinal, r.outcome, r.unitId, r.part]), 'an outside call was not recorded').toEqual([
			[1, 'OUTSIDE', 'pwu_nobody', 1],
			[2, 'OUTSIDE', 'pwu_src', parts + 1]
		]);
	});

	// ⭐ L17-01 — the outside requests over the line: the unit in the line that left no record, a unit outside it, a part of zero, a negative part,
	// and a part past each unit's last.
	it('⛔ RED FIRST — over the line, a unit that left no record, a unit outside it, and a part of zero, a negative part or past the last are each answered with what may be asked for, served nothing, and recorded (OUTSIDE) (the review’s L17-01)', async () => {
		const reads: EarlierAttemptRead[] = [];
		const tool = toolOver(portOverLine(LINE, BY_UNIT, reads));
		const partsC = renderUnitConversation(BY_UNIT.pwu_c).length;
		const partsA = renderUnitConversation(BY_UNIT.pwu_a).length;

		const outside = [
			await tool.run({ unit: 'pwu_b' }),
			await tool.run({ unit: 'pwu_nobody' }),
			await tool.run({ part: 0 }),
			await tool.run({ part: -1 }),
			await tool.run({ part: partsC + 1 }),
			await tool.run({ unit: 'pwu_a', part: partsA + 1 })
		];

		expect(outside.map((o) => o.ok), 'an outside request was served').toEqual([false, false, false, false, false, false]);
		expect(
			outside.slice(0, 2).map((o) => [o.summary.includes('pwu_c'), o.summary.includes('pwu_a')]),
			'an outside unit is not answered with each unit that may be asked for'
		).toEqual([
			[true, true],
			[true, true]
		]);
		expect(
			outside.slice(2).map((o) => o.summary.includes(`1 to ${o === outside[5] ? partsA : partsC}`)),
			'an outside part is not answered with the parts of its unit that may be asked for'
		).toEqual([true, true, true, true]);
		expect(outside.some((o) => o.summary.includes('UNIT-C: write it.') || o.summary.includes('UNIT-A: write it.')), 'an outside request was served a part').toBe(false);
		expect(reads.map((r) => [r.ordinal, r.outcome, r.unitId, r.part]), 'an outside call was not recorded as asked').toEqual([
			[1, 'OUTSIDE', 'pwu_b', 1],
			[2, 'OUTSIDE', 'pwu_nobody', 1],
			[3, 'OUTSIDE', 'pwu_c', 0],
			[4, 'OUTSIDE', 'pwu_c', -1],
			[5, 'OUTSIDE', 'pwu_c', partsC + 1],
			[6, 'OUTSIDE', 'pwu_a', partsA + 1]
		]);
	});

	it('⛔ RED FIRST — a read the store refuses to record is not served: the tool says the read could not be recorded', async () => {
		const { store, rows } = await unitWithARepair();
		const conversation = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const tool = toolOver(portOver(conversation, [], 'the content store is read-only'));
		const out = await tool.run({});
		expect(out.ok, 'a read that could not be recorded was served').toBe(false);
		expect(out.summary, 'the tool does not say the read could not be recorded').toContain('could not be recorded');
		expect(out.summary, 'the part was served though its read was not recorded').not.toContain('part 1 of');
	});

	// ⭐⭐ L17-02 — THE REAL WRITER OVER A STORE THAT FAILS, joined to the tool: a `put` the store fails, a name it refuses to bind, and a bind that
	// throws. The writer answers each as a read not recorded, its reason said, and never throws; the tool over it serves nothing.
	const failingStore = (how: 'PUT_FAILS' | 'BIND_REFUSED' | 'BIND_THROWS') => {
		const store = createInMemoryArtifactStore();
		return new Proxy(store, {
			get: (target, property) => {
				if (property === 'put' && how === 'PUT_FAILS')
					return async () => {
						throw new Error('the content store is full');
					};
				if (property === 'bindName' && how === 'BIND_REFUSED') return async () => ({ bound: false as const, refusedBecause: 'the name is bound to other bytes' });
				if (property === 'bindName' && how === 'BIND_THROWS')
					return () => {
						throw new Error('the name index could not be written');
					};
				const value: unknown = Reflect.get(target, property, target);
				return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
			}
		});
	};
	const WHY = { PUT_FAILS: 'the content store is full', BIND_REFUSED: 'the name is bound to other bytes', BIND_THROWS: 'the name index could not be written' } as const;

	it('⛔ RED FIRST — the read record’s writer over a store whose put fails, whose bind is refused, or whose bind throws: the read not recorded, its reason said, nothing thrown (the review’s L17-02)', async () => {
		const read: EarlierAttemptRead = {
			attemptKey: 'step_9#1',
			ordinal: 1,
			try: 1,
			readerUnitId: 'pwu_src2',
			unitId: 'pwu_src',
			part: 1,
			parts: 1,
			outcome: 'SERVED',
			sha256: sha('the part'),
			chars: 8
		};
		const outcomes: unknown[] = [];
		for (const how of ['PUT_FAILS', 'BIND_REFUSED', 'BIND_THROWS'] as const) {
			outcomes.push(
				await recordEarlierAttemptRead(failingStore(how), TENANT, read).then(
					(done) => (done.recorded ? 'recorded' : done.refusedBecause.includes(WHY[how]) ? 'refused, its reason said' : `refused, its reason lost: ${done.refusedBecause}`),
					(e: unknown) => `threw: ${e instanceof Error ? e.message : String(e)}`
				)
			);
		}
		expect(outcomes, 'a read the store failed to record was taken as recorded, or its reason was lost, or the writer threw').toEqual([
			'refused, its reason said',
			'refused, its reason said',
			'refused, its reason said'
		]);
	});

	it('⛔ RED FIRST — the tool over the real writer and a store that fails serves nothing: it says the read could not be recorded, and why (the review’s L17-02)', async () => {
		const { store, rows } = await unitWithARepair();
		const conversation = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const seen: unknown[] = [];
		for (const how of ['PUT_FAILS', 'BIND_REFUSED', 'BIND_THROWS'] as const) {
			const failing = failingStore(how);
			const tool = toolOver(portOverLine([unit({ unitId: 'pwu_src', title: 'Source Construction' })], { pwu_src: conversation }, [], [], (read) => recordEarlierAttemptRead(failing, TENANT, read)));
			const out = await tool.run({});
			seen.push([out.ok, out.summary.includes('could not be recorded'), out.summary.includes(WHY[how]), out.summary.includes('part 1 of')]);
		}
		expect(seen, 'a read the store failed to record was served, or the tool did not say why it was not').toEqual([
			[false, true, true, false],
			[false, true, true, false],
			[false, true, true, false]
		]);
	});

	it('⛔ RED FIRST — the tool does not answer before its read is recorded: a recording held open holds the answer, a served read and an OUTSIDE one alike (the review’s L17-02)', async () => {
		const { store, rows } = await unitWithARepair();
		const conversation = await unitConversationOf(rows, store, TENANT, 'pwu_src');
		const held: (() => void)[] = [];
		const tool = toolOver(
			portOverLine([unit({ unitId: 'pwu_src', title: 'Source Construction' })], { pwu_src: conversation }, [], [], () =>
				new Promise((resolve) => held.push(() => resolve({ recorded: true as const, storageKey: 'k1' })))
			)
		);
		const seen: unknown[] = [];
		for (const args of [{}, { unit: 'pwu_nobody' }]) {
			let answered = false;
			const run = tool.run(args).then((r) => {
				answered = true;
				return r;
			});
			// ⭑ Every step the tool can take before its record is made, taken: a turn of the event loop, twice.
			await new Promise((r) => setTimeout(r, 0));
			await new Promise((r) => setTimeout(r, 0));
			const before = [answered, held.length];
			held.shift()?.();
			await run;
			seen.push([...before, answered]);
		}
		expect(seen, 'the tool answered before its read was recorded, or asked for no record').toEqual([
			[false, 1, true],
			[false, 1, true]
		]);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 1 (§16; the independent review's L17C-01) — ONLY AN ABSENT SELECTOR TAKES THE DEFAULT.
	// An empty `unit`, or one that is not a string, is a unit outside the record; an absent `part` is 1, and a `part` that is not a number that is an
	// integer, as the tool receives it, is outside the record — each answered with what may be asked for, and recorded; the handler converts none
	// itself. The record of such a call says what was asked, as the tool received it (`asked`, the builder's words, §19). Over the line whose nearest
	// unit with a record has a part 2, so a `'2'` read as 2 would be served.
	it('⛔ RED FIRST — a selector that is not one as the tool receives it — an empty or non-string unit, a part that is not an integer number — is outside the record: answered with what may be asked for, served nothing, recorded with what was asked (the lead’s ruling 1)', async () => {
		const reads: EarlierAttemptRead[] = [];
		const tool = toolOver(portOverLine(LINE, BY_UNIT, reads));
		const partsC = renderUnitConversation(BY_UNIT.pwu_c).length;
		expect(partsC, 'arrangement: the nearest unit with a record has a part 2').toBeGreaterThanOrEqual(2);
		const asked: readonly Record<string, unknown>[] = [
			{ unit: '' },
			{ unit: true },
			{ unit: {} },
			{ part: 1.5 },
			{ part: '2' },
			{ part: '0x1' },
			{ part: Number.NaN },
			{ part: true },
			{ part: {} }
		];
		const answered: { readonly ok: boolean; readonly summary: string }[] = [];
		for (const args of asked) answered.push(await tool.run(args));

		expect(answered.map((a) => a.ok), 'a selector that is not one was served').toEqual(asked.map(() => false));
		expect(answered.some((a) => a.summary.includes('UNIT-C: write it.') || a.summary.includes('UNIT-A: write it.')), 'a part was served for a selector that is not one').toBe(false);
		expect(
			reads.map((r) => [r.outcome, (r as { readonly asked?: string }).asked]),
			'a call with a selector that is not one was not recorded as outside the record, with what was asked'
		).toEqual([
			['OUTSIDE', 'unit "", part absent'],
			['OUTSIDE', 'unit true, part absent'],
			['OUTSIDE', 'unit {}, part absent'],
			['OUTSIDE', 'unit absent, part 1.5'],
			['OUTSIDE', 'unit absent, part "2"'],
			['OUTSIDE', 'unit absent, part "0x1"'],
			['OUTSIDE', 'unit absent, part NaN'],
			['OUTSIDE', 'unit absent, part true'],
			['OUTSIDE', 'unit absent, part {}']
		]);
		expect(
			answered.slice(0, 3).map((a) => [a.summary.includes('pwu_c'), a.summary.includes('pwu_a')]),
			'a unit that is not one is not answered with each unit that may be asked for'
		).toEqual([
			[true, true],
			[true, true],
			[true, true]
		]);
		expect(
			answered.slice(3).map((a) => a.summary.includes(`1 to ${partsC}`)),
			'a part that is not one is not answered with the parts that may be asked for'
		).toEqual([true, true, true, true, true, true]);
	});

	// ⭐ The lead's ruling 1 — THROUGH PI, ITS OWN VALIDATION CONVERTS A CALL'S ARGUMENTS TO THE TOOL'S SCHEMA BEFORE THE TOOL RUNS (`validateToolArguments`:
	// a clone of the arguments through TypeBox's `Value.Convert`), so the tool cannot tell 1.5 from 1. That is the harness's boundary for every Pi tool,
	// not undone here; the model's own arguments stay on the record, in its request. Held, so the design's statement of it is.
	it('⭑ CONTROL (characterization) — through Pi’s own validation the tool receives `part` as TypeBox converts it: 1.5 as 1, "2" as 2 (the lead’s ruling 1)', () => {
		const [definition] = toPiExecutionTools(
			mintExecutionTools({ ports: portsWith(portOverLine(LINE, BY_UNIT, [])) as never, grantedCapabilities: [EARLIER_ATTEMPT_CAPABILITY], bindingAuthorizationStatus: 'AUTHORIZED' })
		);
		const received = (args: Record<string, unknown>): unknown =>
			validateToolArguments(definition as never, { type: 'toolCall', id: 'call_1', name: READ_EARLIER_ATTEMPT_TOOL, arguments: args } as never);
		expect(definition?.name, 'arrangement: the record’s tool is the one Pi is handed').toBe(READ_EARLIER_ATTEMPT_TOOL);
		expect([received({ part: 1.5 }), received({ part: '2' })], 'Pi’s validation hands the tool another value than TypeBox’s conversion').toEqual([{ part: 1 }, { part: 2 }]);
	});

	it('⛔ RED FIRST — the roles’ record files: .jpwb/record/<slug>--<unit id>.md', () => {
		expect(recordFilePath('Source Construction', 'pwu_src'), 'the record file is not where the roles are told it is').toBe('.jpwb/record/source-construction--pwu_src.md');
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's rulings 6 and 10 (§16; the independent review's L17C-06 and question 2) — WHAT THE READER CANNOT
// READ IS SAID, AND A CALL'S ID IS ITS CONVERSATION'S. A record of an exchange's dropped replies that resolves but cannot be read is named in the
// exchange's place, with why — never read as none; a record never made is none. And the set of the tool's own call ids is begun again with each
// request that begins a new conversation, so another tool's result under a reused id is shown.
describe('⭐⭐ L17b3 (D89, D92; the lead’s rulings 6 and 10) — an unreadable record of dropped replies said, and a call id a conversation’s', () => {
	/** `store` with the dropped-replies record of `mex_1` holding `bytes`, read back as `how` says: whole, missing, other bytes, or a store that throws. */
	async function withDroppedRecord(how: 'whole' | 'missing' | 'other bytes' | 'throws', bytes: string) {
		const { store, rows } = await unitWithARepair();
		const ref = await store.put({ tenantPrefix: TENANT, bytes, mediaType: 'application/json', purgeability: 'RETAINED_BY_PARTICIPATION' });
		expect((await store.bindName(droppedRepliesNameOf(TENANT, 'mex_1'), ref.storageKey)).bound, 'arrangement: the name bound').toBe(true);
		const name = droppedRepliesNameOf(TENANT, 'mex_1');
		// ⭑ A proxy, every other member the store's own, bound to it: only the record's own bytes, or its name's read, answer otherwise.
		const over = new Proxy(store, {
			get: (target, property) => {
				if (property === 'get')
					return async (key: string) => {
						if (key !== ref.storageKey || how === 'whole' || how === 'throws') return target.get(key);
						return how === 'missing' ? undefined : `${bytes} — and bytes after them`;
					};
				if (property === 'resolveName')
					return async (n: string) => {
						if (how === 'throws' && n === name) throw new Error('the store’s names could not be read');
						return target.resolveName(n);
					};
				const value: unknown = Reflect.get(target, property, target);
				return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
			}
		});
		return renderUnitConversation(await unitConversationOf(rows, over, TENANT, 'pwu_src')).join('\n');
	}
	const REPLIES = [{ text: 'PARTIAL text before the break.', stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: 1, place: 1 }];
	const WHOLE = JSON.stringify({ schema: DROPPED_REPLIES_SCHEMA, exchangeId: 'mex_1', replies: REPLIES });

	it('⛔ RED FIRST — a record of dropped replies that resolves but cannot be read is named in its exchange’s place, and why — its bytes missing, not matching their hash, not JSON, of another schema, or a store that throws (the lead’s ruling 6)', async () => {
		const rendered = [
			await withDroppedRecord('missing', WHOLE),
			await withDroppedRecord('other bytes', WHOLE),
			await withDroppedRecord('whole', 'not the record’s JSON'),
			await withDroppedRecord('whole', JSON.stringify({ schema: 'jpwb.other/1', exchangeId: 'mex_1', replies: REPLIES })),
			await withDroppedRecord('throws', WHOLE)
		];
		const said = rendered.map((text) => text.split('\n').find((line) => line.startsWith('[its dropped replies could not be read: ')) ?? '');
		expect(said.map((line) => line !== ''), 'an unreadable record of dropped replies is not named in its exchange’s place').toEqual([true, true, true, true, true]);
		expect(
			[
				said[0]!.includes('are not in the content store'),
				said[1]!.includes('not the sha256:'),
				said[2]!.includes('not JSON'),
				said[3]!.includes('jpwb.other/1'),
				said[4]!.includes('the store’s names could not be read')
			],
			'the line does not say why the record could not be read'
		).toEqual([true, true, true, true, true]);
		expect(rendered.some((text) => text.includes('PARTIAL text before the break.')), 'an unreadable record’s reply was shown').toBe(false);
		// ⭐ The lead's ruling 2 of §33 — and each named in mex_1's own place: after its heading, before mex_2's; mex_2's holds none.
		expect(
			rendered.map((text) => [
				bodyOf(text, 'mex_1').some((l) => l.startsWith('[its dropped replies could not be read: ')),
				bodyOf(text, 'mex_2').some((l) => l.startsWith('[its dropped replies could not be read: '))
			]),
			'an unreadable record of dropped replies is not named in its own exchange’s place'
		).toEqual(rendered.map(() => [true, false]));
	});

	it('⭑ CONTROL — a record of dropped replies never made is none, unsaid; one that reads whole is shown in its place (the lead’s ruling 6)', async () => {
		const { store, rows } = await unitWithARepair();
		const none = renderUnitConversation(await unitConversationOf(rows, store, TENANT, 'pwu_src')).join('\n');
		const whole = await withDroppedRecord('whole', WHOLE);
		expect(
			[none.includes('could not be read'), none.includes('a reply Pi dropped'), whole.includes('PARTIAL text before the break.'), whole.includes('[its dropped replies could not be read')],
			'a record never made was said, or a whole one not shown'
		).toEqual([false, false, true, false]);
		// ⭐ The lead's ruling 2 of §33 — and shown in mex_1's own place: after its heading, before mex_2's; mex_2's holds no copy of it.
		expect(
			[bodyOf(whole, 'mex_1').includes('PARTIAL text before the break.'), bodyOf(whole, 'mex_2').includes('PARTIAL text before the break.')],
			'a whole record’s dropped reply is not shown in its own exchange’s place'
		).toEqual([true, false]);
	});

	it('⛔ RED FIRST — a tool call’s id is its conversation’s: a request that begins a new conversation and reuses the id of the tool’s own earlier call for another tool has that tool’s result shown (the lead’s ruling 10)', () => {
		const conversation: UnitConversation = {
			unitId: 'pwu_src',
			title: 'Source',
			exchanges: [
				{
					exchangeId: 'mex_1',
					step: { ordinal: 1, stepId: 'step_1' },
					try: 1,
					request: {
						kind: 'PROVIDER_REQUEST',
						instructions: 'The execution contract.',
						items: [user('Write the Source.'), call(1, READ_EARLIER_ATTEMPT_TOOL, {}), output(1, 'THE RECORD’S OWN PART, NOT TO BE REPEATED')]
					},
					answer: { kind: 'RAW_OUTPUT', text: 'The first answer.' },
					droppedReplies: []
				},
				{
					exchangeId: 'mex_2',
					step: { ordinal: 2, stepId: 'step_2' },
					try: 1,
					request: {
						kind: 'PROVIDER_REQUEST',
						instructions: 'The execution contract.',
						items: [user('Write the Source again.'), call(1, 'write_file', { path: 'docs/1.md' }), output(1, 'WROTE docs/1.md IN THE NEW CONVERSATION')]
					},
					answer: { kind: 'RAW_OUTPUT', text: 'The second answer.' },
					droppedReplies: []
				}
			]
		};
		const text = renderUnitConversation(conversation).join('\n');
		expect(text.includes('[this request begins a new conversation]'), 'arrangement: the second request begins a new conversation').toBe(true);
		expect(
			[text.includes('THE RECORD’S OWN PART, NOT TO BE REPEATED'), text.includes('WROTE docs/1.md IN THE NEW CONVERSATION')],
			'the tool’s own result was repeated, or another tool’s result in a new conversation hidden as the tool’s own'
		).toEqual([false, true]);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 2 of §23 (the re-check's L17R-02) and its general form — WHAT THE RECORD'S READER PARSES FROM
// THE STORE IS READ BY ITS SHAPE: a record of dropped replies whose elements are not replies (`DroppedReply`: an object; `text` a string; `stopReason`
// 'error' or 'aborted'; `wentOnBy` 'RETRY', 'COMPACTION' or 'NOT_SEEN'; `place` a positive integer; `errorMessage` and `attempt` absent or of their
// type) is unreadable as a whole, named in its exchange's place with which element and which field, none of its replies shown — through a provider
// request and through a turn's text. And the general form's three: a call's result with no output renders, nothing thrown; a call id that is not a
// string is no call's id; a reference recorded as STORED that names no storage key or content hash cannot be read, and says so (ruling 5's rule).
describe('⭐⭐ L17b3 (D89, D92; the lead’s ruling 2 of §23) — what the record’s reader parses, read by its shape', () => {
	const REPLY = { text: 'PARTIAL text before the break.', stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: 1, place: 1 };
	/** `mex_1`'s dropped-replies record holding `replies`, hashed whole and schema-tagged; its request a provider request or the turn's text. */
	async function renderedWith(kind: 'PROVIDER_REQUEST' | 'TURN_TEXT', replies: readonly unknown[]): Promise<string> {
		const { store, rows } = await unitWithARepair();
		const bytes = JSON.stringify({ schema: DROPPED_REPLIES_SCHEMA, exchangeId: 'mex_1', replies });
		const ref = await store.put({ tenantPrefix: TENANT, bytes, mediaType: 'application/json', purgeability: 'RETAINED_BY_PARTICIPATION' });
		expect((await store.bindName(droppedRepliesNameOf(TENANT, 'mex_1'), ref.storageKey)).bound, 'arrangement: the name bound').toBe(true);
		const turnText = await stored(store, 'Write the Source.');
		const over = kind === 'TURN_TEXT' ? withExchange(rows, 'mex_1', (s) => ({ ...s, materializedInputRef: turnText })) : rows;
		return renderUnitConversation(await unitConversationOf(over, store, TENANT, 'pwu_src')).join('\n');
	}

	it('⛔ RED FIRST — a record of dropped replies whose elements are not replies — null, a string, a reply with no place, a place of 0 or 1.5, a text that is a number, a stop of another word — is unreadable as a whole: named in its exchange’s place with which element and which field, none of its replies shown, nothing thrown — through a provider request and through a turn’s text (the lead’s ruling 2 of §23)', async () => {
		const withoutPlace = Object.fromEntries(Object.entries(REPLY).filter(([key]) => key !== 'place'));
		// ⭑ Each record holds a whole reply first and then the element that is not one, so none of its replies being shown is seen.
		const NOT_REPLIES: readonly (readonly [string, unknown, string])[] = [
			['null', null, 'its reply 2 is not an object'],
			['a string', 'a string', 'its reply 2 is not an object'],
			['no place', { ...withoutPlace }, 'its reply 2’s place'],
			['place 0', { ...REPLY, place: 0 }, 'its reply 2’s place'],
			['place 1.5', { ...REPLY, place: 1.5 }, 'its reply 2’s place'],
			['text 5', { ...REPLY, text: 5, place: 2 }, 'its reply 2’s text'],
			['another stop', { ...REPLY, stopReason: 'stop', place: 2 }, 'its reply 2’s stopReason']
		];
		// ⭐ The lead's ruling 2 of §33 — ~~`readonly shown: boolean }[]`~~: and where the notice stands, in mex_1's body and in mex_2's (`placed`).
		const seen: {
			readonly label: string;
			readonly kind: string;
			readonly threw: string;
			readonly notice: string;
			readonly shown: boolean;
			readonly placed: readonly boolean[];
		}[] = [];
		for (const [label, element] of NOT_REPLIES)
			for (const kind of ['PROVIDER_REQUEST', 'TURN_TEXT'] as const) {
				let text = '';
				let threw = '';
				try {
					text = await renderedWith(kind, [REPLY, element]);
				} catch (e) {
					threw = String(e);
				}
				const notice = text.split('\n').find((line) => line.startsWith('[its dropped replies could not be read: ')) ?? '';
				// ~~`seen.push({ label, kind, threw, notice, shown: … })`~~ — and `placed` (the lead's ruling 2 of §33).
				seen.push({ label, kind, threw, notice, shown: text.includes('PARTIAL text before the break.'), placed: [bodyOf(text, 'mex_1').some((l) => l.startsWith('[its dropped replies could not be read: ')), bodyOf(text, 'mex_2').some((l) => l.startsWith('[its dropped replies could not be read: '))] });
			}

		expect.soft(seen.map((s) => s.threw), 'a record whose element is not a reply threw where it is rendered').toEqual(seen.map(() => ''));
		expect.soft(seen.map((s) => s.notice !== ''), 'a record whose element is not a reply is not named in its exchange’s place').toEqual(seen.map(() => true));
		expect
			.soft(
				seen.map((s, i) => s.notice.includes(NOT_REPLIES[Math.floor(i / 2)]![2])),
				'the notice does not say which element is not a reply, and which field'
			)
			.toEqual(seen.map(() => true));
		expect.soft(seen.map((s) => s.shown), 'a reply of a record that is not one was shown').toEqual(seen.map(() => false));
		// ⭐ The lead's ruling 2 of §33 — and the notice in mex_1's own place: after its heading, before mex_2's; mex_2's holds none.
		expect
			.soft(seen.map((s) => s.placed), 'a record whose element is not a reply is not named in its own exchange’s place')
			.toEqual(seen.map(() => [true, false]));
	});

	// ⭐ L17b3 — the lead's ruling 2 of §31 (the lead's L-1) — THE THREE FIELD CHECKS THE TEST ABOVE GIVES NO WRONG VALUE: `wentOnBy`, `errorMessage` and
	// `attempt`. Written after the code, which checks them already: a CONTROL, each check's own mutant its proof that it discriminates (§32).
	it('⭑ CONTROL — a record of dropped replies whose second reply is whole but for its wentOnBy, its errorMessage or its attempt is unreadable as a whole: named in its exchange’s place with that field, none of its replies shown, nothing thrown — through a provider request and through a turn’s text (the lead’s ruling 2 of §31)', async () => {
		const NOT_REPLIES: readonly (readonly [unknown, string])[] = [
			[{ ...REPLY, wentOnBy: 'OTHER', place: 2 }, 'its reply 2’s wentOnBy'],
			[{ ...REPLY, errorMessage: 5, place: 2 }, 'its reply 2’s errorMessage'],
			[{ ...REPLY, attempt: 'x', place: 2 }, 'its reply 2’s attempt']
		];
		// ⭐ The lead's ruling 2 of §33 — ~~`readonly shown: boolean }[]`~~: and where the notice stands (`placed`).
		const seen: { readonly threw: string; readonly notice: string; readonly shown: boolean; readonly placed: readonly boolean[] }[] = [];
		for (const [element] of NOT_REPLIES)
			for (const kind of ['PROVIDER_REQUEST', 'TURN_TEXT'] as const) {
				let text = '';
				let threw = '';
				try {
					text = await renderedWith(kind, [REPLY, element]);
				} catch (e) {
					threw = String(e);
				}
				const notice = text.split('\n').find((line) => line.startsWith('[its dropped replies could not be read: ')) ?? '';
				// ~~`seen.push({ threw, notice, shown: … })`~~ — and `placed` (the lead's ruling 2 of §33).
				seen.push({ threw, notice, shown: text.includes('PARTIAL text before the break.'), placed: [bodyOf(text, 'mex_1').some((l) => l.startsWith('[its dropped replies could not be read: ')), bodyOf(text, 'mex_2').some((l) => l.startsWith('[its dropped replies could not be read: '))] });
			}

		expect.soft(seen.map((s) => s.threw), 'a record whose reply is wrong in one of the three fields threw where it is rendered').toEqual(seen.map(() => ''));
		expect
			.soft(
				seen.map((s, i) => s.notice.includes(NOT_REPLIES[Math.floor(i / 2)]![1])),
				'a record whose reply is wrong in one of the three fields is not named in its exchange’s place, with that field'
			)
			.toEqual(seen.map(() => true));
		expect.soft(seen.map((s) => s.shown), 'a reply of a record whose reply is wrong in one of the three fields was shown').toEqual(seen.map(() => false));
		// ⭐ The lead's ruling 2 of §33 — and the notice in mex_1's own place: after its heading, before mex_2's; mex_2's holds none.
		expect
			.soft(seen.map((s) => s.placed), 'a record whose reply is wrong in one of the three fields is not named in its own exchange’s place')
			.toEqual(seen.map(() => [true, false]));
	});

	it('⛔ RED FIRST — a request item whose field the renderer read unchecked — a tool call’s result with no output — renders, nothing thrown: its result line empty, as the safe readers read an absent field (the lead’s ruling 2 of §23, its general form)', () => {
		const conversation: UnitConversation = {
			unitId: 'pwu_src',
			title: 'Source',
			exchanges: [
				{
					exchangeId: 'mex_1',
					step: { ordinal: 1, stepId: 'step_1' },
					try: 1,
					request: { kind: 'PROVIDER_REQUEST', instructions: 'The execution contract.', items: [user('Write the Source.'), call(1), { type: 'function_call_output', call_id: 'call_1' }] },
					answer: { kind: 'RAW_OUTPUT', text: 'The answer after a result with no output.' },
					droppedReplies: []
				}
			]
		};
		let text = '';
		let threw = '';
		try {
			text = renderUnitConversation(conversation).join('\n');
		} catch (e) {
			threw = String(e);
		}
		expect(threw, 'rendering threw on a call’s result with no output').toBe('');
		const lines = text.split('\n');
		const at = lines.indexOf('[tool result]');
		expect([at >= 0, lines[at + 1], text.includes('The answer after a result with no output.')], 'the result with no output is not rendered empty, or the rest is lost').toEqual([true, '', true]);
	});

	it('⛔ RED FIRST — a call id that is not a string is no call’s id: another tool’s result under one is shown, never hidden as the tool’s own (the lead’s ruling 2 of §23, its general form)', () => {
		const conversation: UnitConversation = {
			unitId: 'pwu_src',
			title: 'Source',
			exchanges: [
				{
					exchangeId: 'mex_1',
					step: { ordinal: 1, stepId: 'step_1' },
					try: 1,
					request: {
						kind: 'PROVIDER_REQUEST',
						instructions: 'The execution contract.',
						items: [
							user('Write the Source.'),
							{ type: 'function_call', id: 'fc_5', call_id: 5, name: READ_EARLIER_ATTEMPT_TOOL, arguments: '{}' },
							{ type: 'function_call_output', call_id: 5, output: 'THE RECORD’S PART' },
							{ type: 'function_call', id: 'fc_7', call_id: 7, name: 'write_file', arguments: JSON.stringify({ path: 'docs/7.md' }) },
							{ type: 'function_call_output', call_id: 7, output: 'WROTE docs/7.md UNDER A CALL ID THAT IS NOT A STRING' }
						]
					},
					answer: { kind: 'RAW_OUTPUT', text: 'The answer.' },
					droppedReplies: []
				}
			]
		};
		const text = renderUnitConversation(conversation).join('\n');
		expect(
			[text.includes('WROTE docs/7.md UNDER A CALL ID THAT IS NOT A STRING'), text.includes('[tool result — this tool’s own, not repeated here]')],
			'another tool’s result under a call id that is not a string was hidden as the tool’s own'
		).toEqual([true, false]);
	});

	it('⛔ RED FIRST — a request or an answer whose reference is recorded as STORED but names no storage key or content hash cannot be read, and says so — never that none was stored (the lead’s ruling 2 of §23, its general form; ruling 5’s rule)', async () => {
		const { store, rows } = await unitWithARepair();
		const malformed = withExchange(
			withExchange(rows, 'mex_1', (s) => ({ ...s, materializedInputRef: { status: 'STORED' }, rawOutputBeforeCoercionRef: { status: 'STORED', storageKey: 'k_raw' } })),
			'mex_2',
			(s) => ({ ...s, rawOutputBeforeCoercionRef: { status: 'STORED' }, answerSpanRef: { status: 'STORED', contentHash: `sha256:${'0'.repeat(64)}` } })
		);
		const lines = renderUnitConversation(await unitConversationOf(malformed, store, TENANT, 'pwu_src')).join('\n').split('\n');
		const requestLine = lines.find((l) => l.startsWith('[its request could not be read: ')) ?? '';
		const spanLine = lines.find((l) => l.startsWith('[answer, as recorded: the answer span')) ?? '';
		const answerLine = lines.find((l) => l.startsWith('[its answer could not be read: ') || l.startsWith('[no answer recorded: ')) ?? '';
		expect(
			[
				requestLine.includes('the request is recorded as stored, but its reference names no storage key and no content hash'),
				spanLine.includes('— the raw output could not be read: the raw output is recorded as stored, but its reference names no content hash'),
				answerLine.startsWith('[its answer could not be read: '),
				answerLine.includes('the raw output is recorded as stored, but its reference names no storage key and no content hash'),
				answerLine.includes('the answer span is recorded as stored, but its reference names no storage key')
			],
			'a reference recorded as STORED that names no key or hash was read as none stored, or not said'
		).toEqual([true, true, true, true, true]);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 1 of §33 (the re-check's L17R2-01; the lead's L-2) — ON THE RECORD TOOL'S READ-AND-RENDER
// PATH, NOTHING THROWS ON BYTES WHOSE HASH HOLDS: a line array the bytes size added line by line, never spread into a call (one takes about 125,000
// arguments, §34.1); each request item under its own guard, one that cannot be shown named in its place, and why; a comparison of two requests
// that cannot be made said, never read as a new conversation; and a value `JSON.stringify` cannot write — nested past 5,000, which `JSON.parse`
// reads — said so, the notice and the read's record still naming what they name. Each through the reader and the renderer, on bytes stored whole.
describe('⭐⭐ L17b3 (D89, D92; the lead’s ruling 1 of §33) — nothing on the record’s path throws on bytes whose hash holds', () => {
	/** JSON text of an array nested `depth` deep — written by hand, since `JSON.stringify` cannot write it. */
	const NESTED = (depth: number): string => `${'['.repeat(depth)}${']'.repeat(depth)}`;
	/** A provider request's bytes, its items given as JSON texts, so an item `JSON.stringify` cannot write can stand among them. */
	const requestText = (itemTexts: readonly string[]): string =>
		`{"model":"faux-model","instructions":"The execution contract.","input":[${itemTexts.join(',')}]}`;
	const REPLY_TEXT = JSON.stringify({ text: 'PARTIAL text before the break.', stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: 1, place: 1 });
	/** One unit whose exchanges each hold one of `requests`, stored whole so their hash holds, and a dropped-replies record where given; rendered through the reader. */
	async function renderedRequests(requests: readonly string[], dropped?: { readonly exchangeId: string; readonly bytes: string }) {
		const store = createInMemoryArtifactStore();
		const b = rowsBuilder();
		b.unit('pwu_src', 'Source Construction', 'SATISFIED');
		b.stepStarted('plan_1', 'pwu_src', 'step_1');
		for (const [i, bytes] of requests.entries())
			b.exchange(`mex_${i + 1}`, {
				plane: 'EXECUTION',
				invokerId: 'execution.model-invocation:pwut_src',
				subjectObjectId: 'pwu_src',
				requestedAt: `2026-11-17T10:0${i}:00Z`,
				materializedInputRef: await stored(store, bytes),
				rawOutputBeforeCoercionRef: await stored(store, `THE ANSWER OF mex_${i + 1}`),
				answerSpanRef: PENDING,
				volunteeredReasoningRef: PENDING
			});
		if (dropped !== undefined) {
			const ref = await store.put({ tenantPrefix: TENANT, bytes: dropped.bytes, mediaType: 'application/json', purgeability: 'RETAINED_BY_PARTICIPATION' });
			expect((await store.bindName(droppedRepliesNameOf(TENANT, dropped.exchangeId), ref.storageKey)).bound, 'arrangement: the name bound').toBe(true);
		}
		const parts = renderUnitConversation(await unitConversationOf(b.rows(), store, TENANT, 'pwu_src'));
		return { text: parts.join('\n'), parts };
	}
	/** `render` run, or what it threw. */
	async function attempt(render: () => Promise<{ readonly text: string; readonly parts: readonly string[] }>) {
		try {
			return { threw: '', ...(await render()) };
		} catch (e) {
			return { threw: String(e), text: '', parts: [] as readonly string[] };
		}
	}

	it('⛔ RED FIRST — a request of 70,000 items that are null renders whole: every part within the bound, nothing thrown (the lead’s ruling 1 of §33)', async () => {
		const r = await attempt(() => renderedRequests([requestText(new Array<string>(70_000).fill('null'))]));
		expect(r.threw, 'a request of 70,000 items threw where it is rendered').toBe('');
		expect(
			[r.parts.every((p) => p.length <= EARLIER_ATTEMPT_PART_BOUND), bodyOf(r.text, 'mex_1').filter((l) => l === '[item]').length],
			'a part passed the bound, or not every item was rendered'
		).toEqual([true, 70_000]);
		// ⭐ The lead's ruling 4 of §39 — and the 70,000 `null` lines, each following its `[item]`, a part's own heading between them left out.
		const shown = bodyOf(r.text, 'mex_1').filter((l) => !/^part \d+ of \d+$/.test(l));
		expect(
			shown.filter((l, k) => l === 'null' && shown[k - 1] === '[item]').length,
			'not every item was written as the null it is, after its label'
		).toBe(70_000);
	});

	it('⛔ RED FIRST — one reasoning item whose summary holds 130,000 parts renders whole: every part within the bound, nothing thrown (the lead’s ruling 1 of §33)', async () => {
		const summary = JSON.stringify(new Array(130_000).fill({ type: 'summary_text', text: 'S' }));
		const r = await attempt(() => renderedRequests([requestText([JSON.stringify(user('Write the Source.')), `{"type":"reasoning","id":"rs_1","summary":${summary}}`])]));
		expect(r.threw, 'a reasoning item of 130,000 summary parts threw where it is rendered').toBe('');
		expect(
			[r.parts.every((p) => p.length <= EARLIER_ATTEMPT_PART_BOUND), bodyOf(r.text, 'mex_1').filter((l) => l === 'S').length],
			'a part passed the bound, or not every summary part was rendered'
		).toEqual([true, 130_000]);
	});

	it('⛔ RED FIRST — an item nested 6,000 deep, between two plain ones, is named in its place with why, and the item after it is shown (the lead’s ruling 1 of §33)', async () => {
		const r = await attempt(() =>
			renderedRequests([requestText([JSON.stringify(user('BEFORE the nested item.')), NESTED(6000), JSON.stringify(assistantSaid('AFTER the nested item.'))])])
		);
		expect(r.threw, 'a request holding an item nested 6,000 deep threw where it is rendered').toBe('');
		const body = bodyOf(r.text, 'mex_1');
		const [before, named, after] = [body.indexOf('BEFORE the nested item.'), body.findIndex((l) => l.startsWith('[this item cannot be shown: ')), body.indexOf('AFTER the nested item.')];
		expect(
			[before >= 0 && before < named && named < after, body[named]?.includes('Maximum call stack size exceeded') ?? false],
			'the item that cannot be shown is not named in its place, with why, or the item after it is not shown'
		).toEqual([true, true]);
	});

	it('⛔ RED FIRST — a call’s result whose output is nested 6,000 deep is named in its place with why, and the item after it is shown (the lead’s ruling 1 of §33)', async () => {
		const r = await attempt(() =>
			renderedRequests([
				requestText([
					JSON.stringify(user('Write the Source.')),
					JSON.stringify(call(1)),
					`{"type":"function_call_output","call_id":"call_1","output":${NESTED(6000)}}`,
					JSON.stringify(assistantSaid('AFTER the nested output.'))
				])
			])
		);
		expect(r.threw, 'a request holding a result nested 6,000 deep threw where it is rendered').toBe('');
		const body = bodyOf(r.text, 'mex_1');
		const [called, named, after] = [body.indexOf('[tool call: write_file]'), body.findIndex((l) => l.startsWith('[this item cannot be shown: ')), body.indexOf('AFTER the nested output.')];
		expect(
			[called >= 0 && called < named && named < after, body[named]?.includes('Maximum call stack size exceeded') ?? false],
			'the result that cannot be shown is not named in its place, with why, or the item after it is not shown'
		).toEqual([true, true]);
	});

	// ⭐⭐ RESTATED 2026-11-18 (`JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 1 of §39; the re-check's L17R3-01): ~~'⛔ RED FIRST — a request
	// that begins with the one before it, both holding an item nested 6,000 deep: never read as a new conversation; the comparison that cannot be made
	// is said, and the request shown whole (the lead’s ruling 1 of §33)'~~, over ~~`first`, a user item, the nested item and an answer, and the same
	// with `user('Again, with the findings.')` after it~~ — with no tool call and no instructions held, it could not see the call ids begun again, or
	// the instructions shown, only where the comparison returned false. Now exchange 1 holds a call of this tool under an id, and exchange 2, after
	// the same two items, another tool's call and result under that id. Every old expectation is kept, `'Again, with the findings.'` read as
	// exchange 2's last item now is.
	it('⛔ RED FIRST — a request whose comparison with the one before it cannot be made, both holding an item nested 6,000 deep: never read as a new conversation; the failed comparison said; the request shown whole — its instructions and every item, in order — and the tool’s own call ids begun again, so another tool’s result under the id of its earlier call is shown (the lead’s ruling 1 of §33; ruling 1 of §39)', async () => {
		const [userItem, nestedItem] = [JSON.stringify(user('Write the Source.')), NESTED(6000)];
		const ownCall = JSON.stringify({ type: 'function_call', id: 'fc_x', call_id: 'call_X', name: READ_EARLIER_ATTEMPT_TOOL, arguments: '{}' });
		const otherCall = JSON.stringify({ ...call(7), call_id: 'call_X' });
		const otherResult = JSON.stringify({ type: 'function_call_output', call_id: 'call_X', output: 'WROTE docs/7.md UNDER THE ID OF THIS TOOL’S EARLIER CALL' });
		const r = await attempt(() =>
			renderedRequests([requestText([userItem, nestedItem, ownCall]), requestText([userItem, nestedItem, otherCall, otherResult])])
		);
		expect(r.threw, 'two requests holding an item nested 6,000 deep threw where they are rendered').toBe('');
		const body = bodyOf(r.text, 'mex_2');
		// ~~`expect(`~~ — soft, the test failing as before, so each limb after it still reports: each mutant is then seen at the limb that names its
		// defect (the lead's ruling 5 of §39; §41.4).
		expect.soft(
			[
				body.includes('[this request begins a new conversation]'),
				body.some((l) => l.startsWith('[whether this request continues the one before it could not be told: ') && l.includes('Maximum call stack size exceeded')),
				// ~~`body.includes('Write the Source.') && body.includes('Again, with the findings.')`~~ — exchange 2's last item now another tool's result.
				body.includes('Write the Source.') && body.includes('WROTE docs/7.md UNDER THE ID OF THIS TOOL’S EARLIER CALL')
			],
			'a request whose comparison could not be made was read as a new conversation, the failed comparison not said, or the request not shown whole'
		).toEqual([false, true, true]);
		// ⭐ The lead's ruling 1 of §39 — its instructions, and their text after them.
		expect
			.soft([body.includes('[instructions]'), body[body.indexOf('[instructions]') + 1]], 'the request whose comparison could not be made was shown without its instructions')
			.toEqual([true, 'The execution contract.']);
		// ⭐ — every item of its request, in order, the nested one's notice among them.
		const order = [
			body.indexOf('[instructions]'),
			body.indexOf('Write the Source.'),
			body.findIndex((l) => l.startsWith('[this item cannot be shown: ')),
			body.indexOf('[tool call: write_file]'),
			body.indexOf('[tool result]'),
			body.indexOf('WROTE docs/7.md UNDER THE ID OF THIS TOOL’S EARLIER CALL')
		];
		expect
			.soft([order.every((at) => at >= 0), order.every((at, k) => k === 0 || at > order[k - 1]!)], 'not every item of the request was shown, in order')
			.toEqual([true, true]);
		// ⭐ The lead's ruling 1 of §42 (the re-check's L17R4-01) — and mex_2's whole body as rendered, every line in order, from its first line to the
		// line before its answer, the call's argument line among them; the answer right after them. The order of the lines picked above is kept.
		const answerAt = body.indexOf('[answer, as recorded: the raw output]');
		expect
			.soft(
				[answerAt, body.slice(0, answerAt < 0 ? body.length : answerAt)],
				'the request whose comparison could not be made was not shown whole, every line in order, as rendered'
			)
			.toEqual([
				10,
				[
					'[whether this request continues the one before it could not be told: Maximum call stack size exceeded — it is shown whole]',
					'[instructions]',
					'The execution contract.',
					'[user]',
					'Write the Source.',
					'[this item cannot be shown: Maximum call stack size exceeded]',
					'[tool call: write_file]',
					'{"path":"docs/7.md"}',
					'[tool result]',
					'WROTE docs/7.md UNDER THE ID OF THIS TOOL’S EARLIER CALL'
				]
			]);
		// ⭐ — and another tool's result under the id of this tool's earlier call shown, never as this tool's own: the ids begun again.
		expect
			.soft(
				[body.includes('WROTE docs/7.md UNDER THE ID OF THIS TOOL’S EARLIER CALL'), body.includes('[tool result — this tool’s own, not repeated here]')],
				'another tool’s result under the id of this tool’s earlier call was hidden as its own'
			)
			.toEqual([true, false]);
	});

	it('⛔ RED FIRST — a dropped reply whose text is nested 6,000 deep: the notice names its element and its field, the value said to be one that cannot be written (the lead’s ruling 1 of §33)', async () => {
		const bytes = `{"schema":"${DROPPED_REPLIES_SCHEMA}","exchangeId":"mex_1","replies":[${REPLY_TEXT},{"text":${NESTED(6000)},"stopReason":"error","wentOnBy":"RETRY","place":2}]}`;
		const r = await attempt(() => renderedRequests([requestText([JSON.stringify(user('Write the Source.'))])], { exchangeId: 'mex_1', bytes }));
		const notice = bodyOf(r.text, 'mex_1').find((l) => l.startsWith('[its dropped replies could not be read: ')) ?? '';
		expect(
			[r.threw, notice.includes('its reply 2’s text is a value that cannot be written'), r.text.includes('PARTIAL text before the break.')],
			'a dropped reply nested past what can be written threw, its element and field not named, or a reply of its record shown'
		).toEqual(['', true, false]);
	});

	it('⛔ RED FIRST — a dropped-replies record whose schema is nested 6,000 deep: the notice says its schema is a value that cannot be written (the lead’s ruling 1 of §33)', async () => {
		const bytes = `{"schema":${NESTED(6000)},"exchangeId":"mex_1","replies":[${REPLY_TEXT}]}`;
		const r = await attempt(() => renderedRequests([requestText([JSON.stringify(user('Write the Source.'))])], { exchangeId: 'mex_1', bytes }));
		const notice = bodyOf(r.text, 'mex_1').find((l) => l.startsWith('[its dropped replies could not be read: ')) ?? '';
		expect(
			[r.threw, notice.includes('is of the schema a value that cannot be written'), r.text.includes('PARTIAL text before the break.')],
			'a record whose schema cannot be written threw, the schema not said, or a reply of it shown'
		).toEqual(['', true, false]);
	});

	it('⛔ RED FIRST — a call whose unit is nested 6,000 deep is answered with what may be asked for and recorded with what was asked, the value said to be one that cannot be written (the lead’s ruling 1 of §33)', async () => {
		const reads: EarlierAttemptRead[] = [];
		const port: EarlierAttemptPort = {
			readerUnitId: 'pwu_new',
			attemptKey: 'step_9#1',
			currentTry: () => 1,
			units: [unit({ unitId: 'pwu_a', title: 'Source' })],
			conversationOf: async () => ({ unitId: 'pwu_a', title: 'Source', exchanges: [] }),
			record: async (read) => {
				reads.push(read);
				return { recorded: true as const, storageKey: 'k' };
			}
		};
		let nested: unknown = [];
		for (let i = 0; i < 6000; i += 1) nested = [nested];
		let threw = '';
		let answered = { ok: true, summary: '' };
		try {
			answered = await readEarlierAttempt(port, 1, { unit: nested });
		} catch (e) {
			threw = String(e);
		}
		expect(
			[threw, answered.ok, answered.summary.includes('a value that cannot be written'), reads.map((r) => [r.outcome, (r as { readonly asked?: string }).asked])],
			'a call whose unit cannot be written threw, was served, or was not recorded with what was asked'
		).toEqual(['', false, true, [['OUTSIDE', 'unit a value that cannot be written (Maximum call stack size exceeded), part absent']]]);
	});
});

// ⭐ L17b3 — the lead's ruling 2 of §39 — THE HELPER THAT READS AN EXCHANGE'S BODY, HELD: a rendering it cannot read without doubt is refused.
describe('⭐ L17b3 (the lead’s ruling 2 of §39) — `bodyOf`, the helper that reads an exchange’s body', () => {
	it('⭑ CONTROL — `bodyOf` refuses a rendering whose answer holds a line that begins as a heading does, naming the asked exchange (the lead’s ruling 2 of §39)', () => {
		const text = renderUnitConversation({
			unitId: 'pwu_src',
			title: 'Source',
			exchanges: [
				{
					exchangeId: 'mex_1',
					step: { ordinal: 1, stepId: 'step_1' },
					try: 1,
					request: { kind: 'TURN_TEXT', text: 'Write the Source.' },
					answer: { kind: 'RAW_OUTPUT', text: 'An answer that quotes a heading:\n── Exchange 1 of 1 (mex_1) — step 1 (step_1), try 1\nand goes on.' },
					droppedReplies: []
				}
			]
		}).join('\n');
		expect(text.split('\n').filter((l) => l.startsWith('── Exchange 1 of 1 (mex_1)')).length, 'arrangement: the answer holds a heading-like line').toBe(2);
		expect(() => bodyOf(text, 'mex_1'), 'bodyOf read a rendering whose answer holds a heading-like line').toThrow(
			"bodyOf: the lines that begin '── Exchange ' are not exactly the rendering's 1 heading(s), in order: 2 such line(s)"
		);
	});

	it('⭑ CONTROL — `bodyOf` reads each exchange’s id from its heading’s exchange field alone: where the second exchange’s step id is the first exchange’s id, each body is read right, and an id no heading’s exchange field holds is refused (the lead’s ruling 2 of §42)', () => {
		const text = renderUnitConversation({
			unitId: 'pwu_src',
			title: 'Source',
			exchanges: [
				{
					exchangeId: 'mex_1',
					step: { ordinal: 1, stepId: 'step_1' },
					try: 1,
					request: { kind: 'TURN_TEXT', text: 'THE FIRST request.' },
					answer: { kind: 'RAW_OUTPUT', text: 'THE FIRST answer.' },
					droppedReplies: []
				},
				{
					exchangeId: 'mex_2',
					step: { ordinal: 2, stepId: 'mex_1' },
					try: 1,
					request: { kind: 'TURN_TEXT', text: 'THE SECOND request.' },
					answer: { kind: 'RAW_OUTPUT', text: 'THE SECOND answer.' },
					droppedReplies: []
				}
			]
		}).join('\n');
		const lines = text.split('\n');
		const [first, second] = [lines.indexOf('── Exchange 1 of 2 (mex_1) — step 1 (step_1), try 1'), lines.indexOf('── Exchange 2 of 2 (mex_2) — step 2 (mex_1), try 1')];
		expect(
			[first >= 0 && first < second, lines.filter((l) => l.startsWith('── Exchange ') && l.includes('(mex_1)')).length],
			'arrangement: the second exchange’s step id is the first exchange’s id'
		).toEqual([true, 2]);
		/** `bodyOf`'s body of `id`, or what it threw. */
		const read = (id: string): readonly string[] | string => {
			try {
				return bodyOf(text, id);
			} catch (e) {
				return String(e);
			}
		};
		const [one, two] = [read('mex_1'), read('mex_2')];
		expect.soft([one, two], 'bodyOf did not read each exchange’s body right').toEqual([lines.slice(first + 1, second), lines.slice(second + 1)]);
		expect
			.soft(
				[one.includes('THE FIRST answer.'), one.includes('THE SECOND answer.'), two.includes('THE SECOND answer.'), two.includes('THE FIRST answer.')],
				'a body read is not its own exchange’s'
			)
			.toEqual([true, false, true, false]);
		expect.soft(read('step_1'), 'bodyOf read an id no heading’s exchange field holds').toBe('Error: bodyOf: the heading of step_1 is not exactly one line: 0');
	});
});

/**
 * ⭐ L17b3 (the lead's ruling 2 of §33) — the lines of one exchange's body in a rendering: after its heading (`── Exchange <i> of <n> (<id>)`), up to
 * the next exchange's heading — so a line named "in its exchange's place" is held where it stands.
 */
// ⭐ The lead's ruling 2 of §39 (the re-check's L17R3-02) — ~~any line that begins `── Exchange ` taken as a heading, and an exchange not found read as
// an empty body~~: it refuses a rendering it cannot read without doubt. The lines that begin `── Exchange ` must be exactly the N headings their own
// `of N` says, in order, and the asked exchange's heading exactly one line; else it throws, saying which.
function bodyOf(text: string, exchangeId: string): string[] {
	const lines = text.split('\n');
	const headings = lines.flatMap((l, i) => (l.startsWith('── Exchange ') ? [{ l, i }] : []));
	const n = Number((headings[0]?.l ?? '').slice('── Exchange '.length).split(' ')[2]);
	if (headings.length !== n || !headings.every(({ l }, k) => l.startsWith(`── Exchange ${k + 1} of ${n} (`)))
		throw new Error(`bodyOf: the lines that begin '── Exchange ' are not exactly the rendering's ${n} heading(s), in order: ${headings.length} such line(s)`);
	// ⭐ The lead's ruling 2 of §42 (the re-check's L17R4-02) — ~~`headings.filter(({ l }) => l.includes(`(${exchangeId})`))`~~, which took the asked id
	// anywhere in parentheses, a step's id among them: each heading's exchange id read from the field after `of N (`, up to its `)`, and matched
	// exactly there.
	const exchangeIdOf = (l: string, k: number): string | undefined => {
		const from = `── Exchange ${k + 1} of ${n} (`.length;
		const to = l.indexOf(')', from);
		return to < 0 ? undefined : l.slice(from, to);
	};
	const asked = headings.filter(({ l }, k) => exchangeIdOf(l, k) === exchangeId);
	if (asked.length !== 1) throw new Error(`bodyOf: the heading of ${exchangeId} is not exactly one line: ${asked.length}`);
	const next = headings.find(({ i }) => i > asked[0]!.i);
	return lines.slice(asked[0]!.i + 1, next === undefined ? lines.length : next.i);
}
