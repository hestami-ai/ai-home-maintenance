// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.43; `REG-D-173` (3), (4), (5)) — A
// REPLACEMENT'S RECORD OF THE UNITS IT REPLACES, FROM THE GOVERNED STREAM'S RECORD, NEVER A HARNESS'S FILE.
//
// ⭑ WHAT IS HERE, each the one of its kind (the brief's names):
//   · the line of units a replacement replaces, nearest first (`replacedLineOf`), and the sentence its first turn says of them
//     (`replacedLineSentence`, the lead's draft words; `NO_RECORD_SENTENCE` where no unit in the line left a record);
//   · THE RECORD'S READER, `unitConversationOf` — a unit's own executor exchanges, each one's bytes checked against their hash (`verifiedBytes`):
//     its request as recorded (the provider request Pi sent last, or the turn's text alone), its answer (the raw output where it verifies, else the
//     answer span, said why — the lead's ruling §10.1 (1)), and the replies Pi dropped, recorded beside it (D92);
//   · THE RENDERER, `renderUnitConversation` — the one renderer the tool, the roles' files and L17b2's Historian folder read — in parts of at most
//     `EARLIER_ATTEMPT_PART_BOUND` characters, each headed `part <n> of <N>`, the first listing the exchanges and the part each begins in;
//   · what the record holds, for a replacement's declarations (`recordHoldings`, D89: an answer; findings or the loop's feedback a predecessor was
//     given);
//   · THE READ RECORD'S WRITER, `recordEarlierAttemptRead` — each read on the content plane, bound to the step's attempt, before it is served;
//   · the tool's port (`EarlierAttemptPort`), which the tool's handler reads (`execution-tool-surface.ts`'s `read_earlier_attempt`), and the roles'
//     file (`recordFilePath`).
import { createHash } from 'node:crypto';
import { acceptedWorkFile } from '@janumipwb/rph-application';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { isAssuranceStageExchange } from '../assurance/assurance-stage-roles.js';
import { describedThrow } from '../described-throw.js';
import type { DroppedReply } from '../tools/backing-tool.js';
import { droppedRepliesNameOf, DROPPED_REPLIES_SCHEMA } from './dropped-replies.js';
import { CARRIED_FINDINGS_LINE, FEEDBACK_HEADING } from './executor-session.js';
import { storedButUnnamed, verifiedBytes } from './verified-bytes.js';

/** The record's read-only tool, minted for a replacement's steps alone (D89). */
export const READ_EARLIER_ATTEMPT_TOOL = 'read_earlier_attempt';
/** The capability the tool is minted under, which a replacement's step USES (`step-binding.ts`). */
export const EARLIER_ATTEMPT_CAPABILITY = 'earlier-attempt-record';
/** A part's bound, in characters, its heading included (D89). */
export const EARLIER_ATTEMPT_PART_BOUND = 20_000;
/** What a first turn says where no unit in its line left a record, in place of the sentence — and it is given no tool (D89). */
export const NO_RECORD_SENTENCE = 'The unit this one replaces left no recorded conversation.';
/** The schema of a read's record (the lead's ruling 1 on Stage 0). */
export const EARLIER_ATTEMPT_READ_SCHEMA = 'jpwb.earlier-attempt-read/1';
/** The repair turn's opening (`run-model-step.ts`), by which a request carrying findings is known. */
const REPAIR_OPENING = 'An independent assurance review of the work product you just produced found the following:';

const sha256 = (text: string): string => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** One unit of a replacement's line, as the record holds it: its state when it was replaced, and whether it left an executor exchange. */
export interface ReplacedUnit {
	readonly unitId: string;
	readonly title: string;
	readonly state: 'ACCEPTED' | 'REJECTED' | 'NEITHER';
	readonly hasRecord: boolean;
}

/** The record's rows the reader reads: its objects by id, and its events in their order. */
export interface RecordRows {
	readonly objects: Map<string, { readonly type: string; readonly state: Record<string, unknown> }>;
	readonly events: readonly { readonly seq: number; readonly type: string; readonly aggregateId: string; readonly payload: Record<string, unknown> }[];
}

/** The engine's record as rows: every object its events name, and the events in order. */
export function recordRowsOf(engine: {
	readAllEvents(): readonly { readonly eventType: string; readonly aggregateId: string; readonly payload?: unknown }[];
	loadObject(id: string): { readonly state?: unknown } | undefined;
}): RecordRows {
	const events = engine.readAllEvents().map((e, i) => ({
		seq: i + 1,
		type: e.eventType,
		aggregateId: e.aggregateId,
		payload: (e.payload ?? {}) as Record<string, unknown>
	}));
	const objects = new Map<string, { type: string; state: Record<string, unknown> }>();
	for (const e of events) {
		if (objects.has(e.aggregateId)) continue;
		const state = (engine.loadObject(e.aggregateId)?.state ?? undefined) as Record<string, unknown> | undefined;
		if (state !== undefined) objects.set(e.aggregateId, { type: str(state.objectType), state });
	}
	return { objects, events };
}

/** Whether `state` is one of `unitId`'s own executor exchanges: the EXECUTION plane's, its subject the unit, the assurance stage's left out. */
function isExecutorExchangeOf(state: Record<string, unknown>, unitId: string): boolean {
	return state.plane === 'EXECUTION' && state.subjectObjectId === unitId && !isAssuranceStageExchange(state);
}

/** A unit's state when it was replaced, as the sentence states it: `SATISFIED` accepted, `REJECTED` rejected by its reviews, any other neither. */
function stateOf(assuranceState: unknown): ReplacedUnit['state'] {
	if (assuranceState === 'SATISFIED') return 'ACCEPTED';
	if (assuranceState === 'REJECTED') return 'REJECTED';
	return 'NEITHER';
}

/**
 * The units `unitId` replaces, nearest first, read from the record's links (`supersedingWorkUnitId`): the unit it replaced, then the unit that
 * one replaced, and so on — each with its state and whether it left an executor exchange of its own. `[]` for a unit that replaces none.
 */
export function replacedLineOf(rows: RecordRows, unitId: string): ReplacedUnit[] {
	const line: ReplacedUnit[] = [];
	const seen = new Set<string>([unitId]);
	let successor = unitId;
	for (;;) {
		const replaced = [...rows.objects.entries()].find(
			([, o]) => o.state.supersedingWorkUnitId === successor && (o.type === '' || o.type === 'PROFESSIONAL_WORK_UNIT')
		);
		if (replaced === undefined || seen.has(replaced[0])) return line;
		const [id, o] = replaced;
		seen.add(id);
		line.push({
			unitId: id,
			title: str(o.state.title) || id,
			state: stateOf(o.state.assuranceState),
			hasRecord: [...rows.objects.values()].some((x) => x.type !== 'PROFESSIONAL_WORK_UNIT' && isExecutorExchangeOf(x.state, id))
		});
		successor = id;
	}
}

const recorded = (u: ReplacedUnit) => `The unit this one replaces, "${u.title}" (${u.unitId}), was worked on before, and its conversation is on the record.`;
const FAULTY_TAIL =
	'The feedback above says what that work got wrong; read the record only if you need more detail than the feedback gives — it shows what was tried and failed, so that you do not try it again, unless something material has changed that would let it succeed now.';
const OTHER_TAIL =
	'It is redone because work it used was replaced; read the record only if you need more detail than the feedback gives — it shows how that work was done on what it used then, which has since changed.';
const STATE_ALONE: Readonly<Record<ReplacedUnit['state'], string>> = {
	ACCEPTED: 'Its work was accepted.',
	REJECTED: 'Its work was rejected by its reviews.',
	NEITHER: 'Its work had been neither accepted nor rejected when it was replaced.'
};
const STATE_OF_A_LINE: Readonly<Record<ReplacedUnit['state'], string>> = {
	ACCEPTED: 'was accepted.',
	REJECTED: 'was rejected by its reviews.',
	NEITHER: 'had been neither accepted nor rejected when it was replaced.'
};

/**
 * The sentence a replacement's first turn says of its line (D89; the lead's draft words, and the builder's for a longer line, §4.2): each unit,
 * nearest first, with what the record holds of it; then how the tool reads them; then the faulty successor's clause, or the other successor's with
 * the nearest unit's state. Where no unit in the line left a record, `NO_RECORD_SENTENCE` in its place.
 */
export function replacedLineSentence(line: readonly ReplacedUnit[], kind: 'FAULTY' | 'OTHER'): string {
	const withRecord = line.filter((u) => u.hasRecord);
	if (withRecord.length === 0) return NO_RECORD_SENTENCE;
	const named = line.map((u) => (u.hasRecord ? recorded(u) : `"${u.title}" (${u.unitId}) left no recorded conversation.`));
	const reads =
		withRecord.length === 1 ? 'You can read it with the read_earlier_attempt tool.' : 'You can read each with the read_earlier_attempt tool, the nearest by default.';
	const nearest = line[0]!;
	const tail =
		kind === 'FAULTY'
			? FAULTY_TAIL
			: `${line.length === 1 ? STATE_ALONE[nearest.state] : `The work of "${nearest.title}" (${nearest.unitId}) ${STATE_OF_A_LINE[nearest.state]}`} ${OTHER_TAIL}`;
	return [...named, reads, tail].join(' ');
}

/** A recorded request: the provider request Pi sent last, the turn's text alone, or why it could not be read. */
export type RecordedRequest =
	| { readonly kind: 'PROVIDER_REQUEST'; readonly instructions?: string; readonly items: readonly unknown[] }
	| { readonly kind: 'TURN_TEXT'; readonly text: string }
	| { readonly kind: 'UNREADABLE'; readonly why: string };

/** A recorded answer: the raw output, the answer span (and, where it fell back, why the raw output could not be read), none, or unreadable. */
export type RecordedAnswer =
	| { readonly kind: 'RAW_OUTPUT'; readonly text: string }
	| { readonly kind: 'ANSWER_SPAN'; readonly text: string; readonly rawOutputUnreadable?: string }
	| { readonly kind: 'NONE'; readonly why: string }
	| { readonly kind: 'UNREADABLE'; readonly why: string };

/** One exchange of a unit's conversation, as the record holds it. */
export interface RecordedExchange {
	readonly exchangeId: string;
	readonly step: { readonly ordinal: number; readonly stepId: string };
	readonly try: number;
	readonly request: RecordedRequest;
	readonly answer: RecordedAnswer;
	readonly droppedReplies: readonly DroppedReply[];
	/**
	 * ⭐ The lead's ruling 6 (§16; the independent review's L17C-06) — where a record of the exchange's dropped replies resolves but cannot be read,
	 * why; its replies then none. Absent where none was recorded, or it read whole: absent is not unreadable.
	 */
	readonly droppedRepliesUnreadable?: string;
}

/** A unit's recorded conversation: its executor exchanges in recorded order. */
export interface UnitConversation {
	readonly unitId: string;
	readonly title: string;
	readonly exchanges: readonly RecordedExchange[];
}

/** A stored ref, as an exchange names its bytes. */
interface StoredRef {
	readonly status?: unknown;
	readonly storageKey?: unknown;
	readonly contentHash?: unknown;
	readonly reason?: unknown;
}

/** The bytes a ref names, verified — `{ absent }` where nothing was stored, `{ unreadable }` where the bytes are missing or do not match. */
async function readRef(
	store: ArtifactStore,
	ref: unknown,
	what: string
): Promise<{ readonly bytes: string } | { readonly absent: string } | { readonly unreadable: string }> {
	const r = (ref ?? {}) as StoredRef;
	// ⭐ The lead's ruling 2 of §23, its general form (ruling 5's rule; the lead's O-2) — ~~a reference not STORED, or STORED without a key or a hash,
	// read as none stored~~: only one not STORED is none; a STORED one that names no storage key or content hash cannot be read, and says so.
	if (r.status !== 'STORED') return { absent: str(r.reason) || `no ${what} was stored` };
	if (typeof r.storageKey !== 'string' || typeof r.contentHash !== 'string') return { unreadable: storedButUnnamed(what, r) };
	try {
		const v = await verifiedBytes(store, r.storageKey, r.contentHash, `the ${what}'s bytes`);
		return v.ok ? { bytes: v.value } : { unreadable: v.refusedBecause };
	} catch (e) {
		return { unreadable: describedThrow(e) };
	}
}

/** A request's bytes, read as the provider request it records, or as the turn's text alone. */
function requestOf(bytes: string): RecordedRequest {
	try {
		const parsed: unknown = JSON.parse(bytes);
		if (parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as { input?: unknown }).input)) {
			const p = parsed as { readonly input: readonly unknown[]; readonly instructions?: unknown };
			return { kind: 'PROVIDER_REQUEST', ...(typeof p.instructions === 'string' ? { instructions: p.instructions } : {}), items: p.input };
		}
	} catch {
		// ⭑ Not JSON: the turn's own text, which is all the record holds of a try that threw or of an executor with no session.
	}
	return { kind: 'TURN_TEXT', text: bytes };
}

/** An exchange's answer, from its refs: the raw output where it verifies; else the span where IT verifies, said why; else none, or unreadable. */
async function answerOf(store: ArtifactStore, state: Record<string, unknown>): Promise<RecordedAnswer> {
	const raw = await readRef(store, state.rawOutputBeforeCoercionRef, 'raw output');
	if ('bytes' in raw) return { kind: 'RAW_OUTPUT', text: raw.bytes };
	const span = await readRef(store, state.answerSpanRef, 'answer span');
	if ('bytes' in span) return { kind: 'ANSWER_SPAN', text: span.bytes, ...('unreadable' in raw ? { rawOutputUnreadable: raw.unreadable } : {}) };
	if ('unreadable' in raw) return { kind: 'UNREADABLE', why: 'unreadable' in span ? `${raw.unreadable}; ${span.unreadable}` : raw.unreadable };
	if ('unreadable' in span) return { kind: 'UNREADABLE', why: span.unreadable };
	return { kind: 'NONE', why: span.absent };
}

/**
 * ⭐ The lead's ruling 1 of §33 (the lead's L-2) — A VALUE READ FROM THE RECORD'S BYTES, OR FROM A CALL'S ARGUMENTS, WRITTEN AS JSON — or said to be
 * one that cannot be written, and why: `JSON.parse` reads values nested far past what `JSON.stringify` can write (§34.1), so a write of such a value
 * throws where it was to be named. ⛔ It does not throw.
 */
function writtenValue(v: unknown): string {
	try {
		return JSON.stringify(v) ?? String(v);
	} catch (e) {
		return `a value that cannot be written (${describedThrow(e)})`;
	}
}

/** A value a field of a dropped reply holds, quoted for the reason it is not one: JSON where it can be, `absent` where it is not there. */
// ⭐ The lead's ruling 1 of §33 — ~~`JSON.stringify(v) ?? String(v)`~~, which threw on a value nested past what it writes, so the notice named neither
// the element nor the field: the one writer, which says such a value.
const heldValue = (v: unknown): string => (v === undefined ? 'absent' : writtenValue(v));

/**
 * ⭐ The lead's ruling 2 of §23 (the re-check's L17R-02) — WHY AN ELEMENT OF A DROPPED-REPLIES RECORD IS NOT A REPLY (`DroppedReply`,
 * `backing-tool.ts`): not an object; or a field not of its shape — `text` a string; `stopReason` 'error' or 'aborted'; `wentOnBy` 'RETRY',
 * 'COMPACTION' or 'NOT_SEEN'; `place` a positive integer; `errorMessage` absent or a string; `attempt` absent or a number — the first such, in
 * words that follow "its reply <n>"; `undefined` for a reply.
 */
function notADroppedReply(element: unknown): string | undefined {
	if (element === null || typeof element !== 'object') return ' is not an object';
	const r = element as Record<string, unknown>;
	const fields: readonly (readonly [string, boolean, string])[] = [
		['text', typeof r.text === 'string', 'a string'],
		['stopReason', r.stopReason === 'error' || r.stopReason === 'aborted', "'error' or 'aborted'"],
		['wentOnBy', r.wentOnBy === 'RETRY' || r.wentOnBy === 'COMPACTION' || r.wentOnBy === 'NOT_SEEN', "'RETRY', 'COMPACTION' or 'NOT_SEEN'"],
		['place', typeof r.place === 'number' && Number.isInteger(r.place) && r.place > 0, 'a positive integer'],
		['errorMessage', r.errorMessage === undefined || typeof r.errorMessage === 'string', 'absent or a string'],
		['attempt', r.attempt === undefined || typeof r.attempt === 'number', 'absent or a number']
	];
	const wrong = fields.find(([, ok]) => !ok);
	return wrong === undefined ? undefined : `’s ${wrong[0]} is ${heldValue(r[wrong[0]])}, not ${wrong[2]}`;
}

/**
 * The replies Pi dropped in the exchange's try, read from the record beside it (D92), its bytes verified; `[]` where none was recorded. ⭐ The lead's
 * ruling 6 (§16; L17C-06) — ABSENT IS NOT UNREADABLE: where the name resolves but its bytes are missing, fail their hash, are not JSON, are of another
 * schema, or the store throws, why — said in the exchange's place, never read as none.
 */
async function droppedRepliesOf(
	store: ArtifactStore,
	tenantPrefix: string,
	exchangeId: string
): Promise<{ readonly replies: readonly DroppedReply[] } | { readonly unreadable: string }> {
	try {
		const ref = await store.resolveName(droppedRepliesNameOf(tenantPrefix, exchangeId));
		if (ref === undefined) return { replies: [] };
		const v = await verifiedBytes(store, ref.storageKey, ref.contentHash, 'the dropped replies');
		if (!v.ok) return { unreadable: v.refusedBecause };
		let parsed: { readonly schema?: unknown; readonly replies?: unknown };
		try {
			parsed = JSON.parse(v.value) as { readonly schema?: unknown; readonly replies?: unknown };
		} catch (e) {
			return { unreadable: `the dropped replies at '${ref.storageKey}' are not JSON: ${describedThrow(e)}` };
		}
		if (parsed?.schema !== DROPPED_REPLIES_SCHEMA || !Array.isArray(parsed.replies))
			// ⭐ The lead's ruling 1 of §33 — ~~`JSON.stringify(parsed?.schema ?? null)`~~: the one writer, which says a schema it cannot write.
			return { unreadable: `the record at '${ref.storageKey}' is of the schema ${writtenValue(parsed?.schema ?? null)}, not ${DROPPED_REPLIES_SCHEMA} with its replies` };
		// ⭐ The lead's ruling 2 of §23 (the re-check's L17R-02) — ~~each element taken as a reply, unchecked, where it is placed and rendered~~: each
		// read by its shape (`notADroppedReply`); a record holding one that is not a reply is unreadable as a whole — which element and which field
		// said, none of its replies shown.
		for (const [i, element] of parsed.replies.entries()) {
			const problem = notADroppedReply(element);
			if (problem !== undefined)
				return { unreadable: `the record at '${ref.storageKey}' holds an element that is not a reply: its reply ${i + 1}${problem}` };
		}
		return { replies: parsed.replies as DroppedReply[] };
	} catch (e) {
		return { unreadable: describedThrow(e) };
	}
}

/**
 * ⭐⭐ THE RECORD'S READER — `unitId`'s recorded conversation: its own executor exchanges, in the order the record holds them, each named by its step
 * (the unit's step starts, counted) and its try (its exchanges since that start, counted); every exchange's bytes checked against their hash, and
 * one that cannot be read named in its place, never left out.
 */
export async function unitConversationOf(rows: RecordRows, store: ArtifactStore, tenantPrefix: string, unitId: string): Promise<UnitConversation> {
	const unit = rows.objects.get(unitId);
	const plansOfUnit = new Set([...rows.objects.entries()].filter(([, o]) => o.state.workUnitId === unitId).map(([id]) => id));
	const exchanges: RecordedExchange[] = [];
	let step = { ordinal: 0, stepId: '' };
	let tryOfStep = 0;
	for (const e of rows.events) {
		if (e.type === 'ExecutionStepStarted' && plansOfUnit.has(e.aggregateId)) {
			step = { ordinal: step.ordinal + 1, stepId: str(e.payload.stepId) };
			tryOfStep = 0;
			continue;
		}
		if (e.type !== 'ModelExchangeRecorded') continue;
		const state = rows.objects.get(e.aggregateId)?.state;
		if (state === undefined || !isExecutorExchangeOf(state, unitId)) continue;
		tryOfStep += 1;
		const input = await readRef(store, state.materializedInputRef, 'request');
		const dropped = await droppedRepliesOf(store, tenantPrefix, e.aggregateId);
		exchanges.push({
			exchangeId: e.aggregateId,
			step,
			try: tryOfStep,
			request: 'bytes' in input ? requestOf(input.bytes) : { kind: 'UNREADABLE', why: 'absent' in input ? input.absent : input.unreadable },
			answer: await answerOf(store, state),
			droppedReplies: 'replies' in dropped ? dropped.replies : [],
			...('unreadable' in dropped ? { droppedRepliesUnreadable: dropped.unreadable } : {})
		});
	}
	return { unitId, title: str(unit?.state.title) || unitId, exchanges };
}

/** Whether a request holds findings or the loop's feedback: the repair turn's opening, a re-run's carried findings, or D77's feedback. */
function requestHoldsFindings(request: RecordedRequest): boolean {
	const texts =
		request.kind === 'TURN_TEXT'
			? [request.text]
			: request.kind === 'PROVIDER_REQUEST'
				? request.items.flatMap((item) => (roleOf(item) === 'user' ? [textOf(item)] : []))
				: [];
	return texts.some((t) => t.includes(REPAIR_OPENING) || t.includes(CARRIED_FINDINGS_LINE) || t.includes(FEEDBACK_HEADING));
}

/**
 * What the record of `conversations` holds, for a replacement's declarations (D89): an answer of a predecessor's, and findings or the loop's
 * feedback a predecessor was given.
 */
export function recordHoldings(conversations: readonly UnitConversation[]): { readonly answer: boolean; readonly findings: boolean } {
	const all = conversations.flatMap((c) => c.exchanges);
	return {
		answer: all.some((x) => x.answer.kind === 'RAW_OUTPUT' || x.answer.kind === 'ANSWER_SPAN'),
		findings: all.some((x) => requestHoldsFindings(x.request))
	};
}

// ── THE RENDERER ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Item = Record<string, unknown>;
const asItem = (v: unknown): Item => (v !== null && typeof v === 'object' ? (v as Item) : {});
function roleOf(item: unknown): string {
	return str(asItem(item).role);
}
/** The text an item carries: its content parts' text, joined. */
function textOf(item: unknown): string {
	const content = asItem(item).content;
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content.map((part) => str(asItem(part).text)).join('');
}
/** Whether an item is the assistant's: its message, a reasoning item, or a call it made. */
function isAssistantSide(item: unknown): boolean {
	const i = asItem(item);
	return i.role === 'assistant' || i.type === 'reasoning' || i.type === 'function_call';
}

/**
 * Where each dropped reply goes among the items of its try's request (the lead's ruling §10.1 (3)): after every reply that came before it, kept or
 * dropped — after the k-th kept reply counted from the request's last user entry, k = (place − 1) − (the dropped replies of a place below it), the
 * kept reply's call results with it; before the first kept reply where k is 0; after the request where k passes its kept replies.
 */
function droppedAt(items: readonly unknown[], dropped: readonly DroppedReply[]): Map<number, DroppedReply[]> {
	const lastUser = items.reduce<number>((at, item, i) => (roleOf(item) === 'user' ? i : at), -1);
	// ⭑ The starts of the kept replies after it: each a run of the assistant's items, broken by a user entry or a call's result.
	const starts: number[] = [];
	for (let i = lastUser + 1; i < items.length; i += 1) if (isAssistantSide(items[i]) && (i === lastUser + 1 || !isAssistantSide(items[i - 1]))) starts.push(i);
	const at = new Map<number, DroppedReply[]>();
	const sorted = [...dropped].sort((a, b) => a.place - b.place);
	for (const d of sorted) {
		const k = d.place - 1 - sorted.filter((o) => o.place < d.place).length;
		const index = k <= 0 ? lastUser + 1 : k < starts.length ? starts[k]! : items.length;
		at.set(index, [...(at.get(index) ?? []), d]);
	}
	return at;
}

/** The lines of one dropped reply. */
const droppedLines = (d: DroppedReply): string[] => [
	`[a reply Pi dropped to go on — the conversation does not hold it; its error: ${d.errorMessage ?? 'none given'}]`,
	d.text
];

/** The lines of one item of a request; `ownCalls` the call ids of this tool's own calls, whose results are named and not repeated. */
function itemLines(item: unknown, answersShown: ReadonlySet<string>, ownCalls: Set<string>): string[] {
	const i = asItem(item);
	if (i.type === 'reasoning')
		return typeof i.encrypted_content === 'string'
			? ['[reasoning — held encrypted on the record, so it is not shown]']
			: ['[reasoning]', ...(Array.isArray(i.summary) ? i.summary.map((s) => str(asItem(s).text)) : [])];
	if (i.type === 'function_call') {
		// ⭐ The lead's ruling 2 of §23, its general form — ~~`ownCalls.add(str(i.call_id))`~~, which made every id that is not a string one id, the
		// empty one, so another tool's result under such an id was hidden as the tool's own: only a string is a call's id.
		if (i.name === READ_EARLIER_ATTEMPT_TOOL && typeof i.call_id === 'string') ownCalls.add(i.call_id);
		return [`[tool call: ${str(i.name)}]`, str(i.arguments)];
	}
	if (i.type === 'function_call_output') {
		// ⭐ The lead's ruling 2 of §23, its general form — ~~`JSON.stringify(i.output)` alone~~, which gives no text for a result with no output, so the
		// rendering threw: an absent output is empty, as the safe readers read an absent field.
		return typeof i.call_id === 'string' && ownCalls.has(i.call_id)
			? ['[tool result — this tool’s own, not repeated here]']
			: ['[tool result]', typeof i.output === 'string' ? i.output : (JSON.stringify(i.output) ?? '')];
	}
	if (i.role === 'user') return ['[user]', textOf(item)];
	if (i.role === 'assistant') {
		const text = textOf(item);
		return answersShown.has(text) ? ['[assistant — the answer shown above, replayed]'] : ['[assistant]', text];
	}
	return [`[${str(i.type) || str(i.role) || 'item'}]`, JSON.stringify(item)];
}

/**
 * ⭐ The lead's ruling 1 of §33 (the re-check's L17R2-01; the lead's L-2) — ONE REQUEST ITEM'S LINES, UNDER ITS OWN GUARD: an item that cannot be
 * shown — a value nested past what `JSON.stringify` writes — is named in its place, and why, and the items after it are still rendered; on the path
 * that shows the item and on the one that only walks it (the tool's own call ids).
 */
function guardedItemLines(item: unknown, answersShown: ReadonlySet<string>, ownCalls: Set<string>): string[] {
	try {
		return itemLines(item, answersShown, ownCalls);
	} catch (e) {
		return [`[this item cannot be shown: ${describedThrow(e)}]`];
	}
}

/** Whether `request` begins with `before`: the same instructions, and `before`'s items its first ones. */
function beginsWith(request: RecordedRequest, before: RecordedRequest | undefined): boolean {
	if (request.kind !== 'PROVIDER_REQUEST' || before?.kind !== 'PROVIDER_REQUEST') return false;
	if (request.instructions !== before.instructions || request.items.length < before.items.length) return false;
	return before.items.every((item, i) => JSON.stringify(item) === JSON.stringify(request.items[i]));
}

/**
 * ⭐ The lead's ruling 1 of §33 — `beginsWith`, UNDER ITS OWN GUARD: whether `request` continues `before`, or — where the comparison cannot be made, an
 * item nested past what `JSON.stringify` writes — why. A comparison that cannot be made is never read as a new conversation.
 */
function continuesFrom(request: RecordedRequest, before: RecordedRequest | undefined): boolean | string {
	try {
		return beginsWith(request, before);
	} catch (e) {
		return describedThrow(e);
	}
}

/** The body lines of one exchange: its heading, the messages of its request not already shown, its dropped replies in their places, its answer. */
function exchangeLines(x: RecordedExchange, i: number, n: number, before: RecordedExchange | undefined, answersShown: Set<string>, ownCalls: Set<string>): string[] {
	const lines = [`── Exchange ${i} of ${n} (${x.exchangeId}) — step ${x.step.ordinal} (${x.step.stepId}), try ${x.try}`];
	const r = x.request;
	if (r.kind === 'UNREADABLE') lines.push(`[its request could not be read: ${r.why}]`);
	else if (r.kind === 'TURN_TEXT')
		lines.push('[this try’s turn, as the record holds it — not the provider request: the call threw, or its executor keeps no session]', r.text);
	if (r.kind === 'PROVIDER_REQUEST') {
		// ⭐ The lead's ruling 1 of §33 — ~~`const continues = beginsWith(r, before?.request);`~~, which threw where an item could not be written: a
		// comparison that cannot be made is said, never read as a new conversation; the request is then shown whole and the tool's own call ids begun
		// again, as for a new conversation (showing is the fail-safe).
		const compared = continuesFrom(r, before?.request);
		const continues = compared === true;
		const from = continues && before?.request.kind === 'PROVIDER_REQUEST' ? before.request.items.length : 0;
		// ⭐ The lead's ruling 10 (§16; the review's question 2) — a call's id is its conversation's: the tool's own call ids begun again with each request
		// that begins a new conversation, so another tool's result under a reused id is shown.
		if (!continues) ownCalls.clear();
		if (typeof compared === 'string')
			lines.push(`[whether this request continues the one before it could not be told: ${compared} — it is shown whole]`);
		else if (!continues && before !== undefined) lines.push('[this request begins a new conversation]');
		if (!continues && r.instructions !== undefined) lines.push('[instructions]', r.instructions);
		const dropped = droppedAt(r.items, x.droppedReplies);
		for (let k = 0; k <= r.items.length; k += 1) {
			if (k >= from) for (const d of dropped.get(k) ?? []) lines.push(...droppedLines(d));
			// ⭐ The lead's ruling 1 of §33 — ~~`lines.push(...itemLines(…))`~~, which handed a call one argument per line, so a reasoning item of about
			// 125,000 summary parts threw: each item under its own guard, its lines added one by one.
			if (k < r.items.length && k >= from) for (const line of guardedItemLines(r.items[k], answersShown, ownCalls)) lines.push(line);
			else if (k < r.items.length) guardedItemLines(r.items[k], answersShown, ownCalls);
		}
		// ⭑ A dropped reply whose place fell inside the part already shown is said after the new messages, never lost.
		for (const [k, ds] of dropped) if (k < from) for (const d of ds) lines.push(...droppedLines(d));
	} else for (const d of x.droppedReplies) lines.push(...droppedLines(d));
	// ⭐ The lead's ruling 6 (§16; L17C-06) — a record of its dropped replies that could not be read, said in their place, and why.
	if (x.droppedRepliesUnreadable !== undefined) lines.push(`[its dropped replies could not be read: ${x.droppedRepliesUnreadable}]`);
	const a = x.answer;
	if (a.kind === 'RAW_OUTPUT') lines.push('[answer, as recorded: the raw output]', a.text);
	else if (a.kind === 'ANSWER_SPAN')
		lines.push(
			a.rawOutputUnreadable === undefined
				? '[answer, as recorded: the answer span]'
				: `[answer, as recorded: the answer span — the raw output could not be read: ${a.rawOutputUnreadable}]`,
			a.text
		);
	else if (a.kind === 'NONE') lines.push(`[no answer recorded: ${a.why}]`);
	else lines.push(`[its answer could not be read: ${a.why}]`);
	if (a.kind === 'RAW_OUTPUT' || a.kind === 'ANSWER_SPAN') answersShown.add(a.text);
	return lines;
}

/** `lines` cut into parts of at most the bound, each headed `part <n> of <total>`; a line longer than a part's room cut across parts. */
function partsOf(lines: readonly string[], total: number): { readonly parts: string[]; readonly startOf: number[] } {
	const parts: string[] = [];
	const startOf: number[] = [];
	let cur: string[] = [];
	let used = 0;
	const room = () => EARLIER_ATTEMPT_PART_BOUND - `part ${parts.length + 1} of ${total}`.length - 1;
	const flush = () => {
		parts.push(`part ${parts.length + 1} of ${total}\n${cur.join('\n')}`);
		cur = [];
		used = 0;
	};
	for (const line of lines) {
		let rest = line;
		let placed = false;
		for (;;) {
			const sep = cur.length > 0 ? 1 : 0;
			const space = room() - used - sep;
			if (rest.length <= space) {
				if (!placed) startOf.push(parts.length + 1);
				cur.push(rest);
				used += sep + rest.length;
				break;
			}
			// ⭑ A line that fits in a part of its own starts the next one whole; a longer one fills this part and goes on in the next.
			if (!placed && rest.length <= room() && cur.length > 0) {
				flush();
				continue;
			}
			if (space <= 0) {
				flush();
				continue;
			}
			if (!placed) startOf.push(parts.length + 1);
			placed = true;
			cur.push(rest.slice(0, space));
			used += sep + space;
			rest = rest.slice(space);
			flush();
			if (rest === '') break;
		}
	}
	if (cur.length > 0 || parts.length === 0) flush();
	return { parts, startOf };
}

/**
 * ⭐⭐ THE RENDERER — a unit's recorded conversation as text, in parts of at most `EARLIER_ATTEMPT_PART_BOUND` characters, each headed `part <n> of
 * <N>`; the first opens with the unit and the list of its exchanges, each with the part it begins in (the lead's ruling 3 on Stage 0). Of each
 * exchange: the messages of its request not already shown — where it begins with the request shown before it, those after it; otherwise the whole,
 * said to begin a new conversation — the replies Pi dropped in their places, then its answer, always.
 */
export function renderUnitConversation(conversation: UnitConversation): string[] {
	const n = conversation.exchanges.length;
	const answersShown = new Set<string>();
	const ownCalls = new Set<string>();
	const body: string[] = [];
	const headingAt: number[] = [];
	conversation.exchanges.forEach((x, i) => {
		body.push('');
		headingAt.push(body.length);
		// ⭐ The lead's ruling 1 of §33 — ~~`body.push(...exchangeLines(…))`~~, which handed a call one argument per line, so a request of about 70,000
		// items threw before the parts were cut: the lines added one by one.
		for (const line of exchangeLines(x, i + 1, n, conversation.exchanges[i - 1], answersShown, ownCalls)) body.push(line);
	});
	const header = (partOfExchange: readonly number[]) => [
		`The recorded conversation of "${conversation.title}" (${conversation.unitId}), as the Governed Stream recorded it: ${n} exchange(s).`,
		'Its exchanges, each with the part it begins in:',
		...conversation.exchanges.map((x, i) => `- ${x.exchangeId} — step ${x.step.ordinal}, try ${x.try}: part ${partOfExchange[i] ?? 1}`)
	];
	// ⭑ The list names the part each exchange begins in, and its own length moves them: laid out until the parts stand still.
	let partOfExchange = conversation.exchanges.map(() => 1);
	let total = 1;
	for (let round = 0; round < 8; round += 1) {
		const head = header(partOfExchange);
		const { parts, startOf } = partsOf([...head, ...body], total);
		const next = headingAt.map((at) => startOf[head.length + at]!);
		if (parts.length === total && next.every((p, i) => p === partOfExchange[i])) return parts;
		partOfExchange = next;
		total = parts.length;
	}
	return partsOf([...header(partOfExchange), ...body], total).parts;
}

// ── EACH READ, RECORDED ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** One read of the tool: the step's attempt, its ordinal there and the try, the reading unit, the unit and part asked for, and what was returned. */
export interface EarlierAttemptRead {
	readonly attemptKey: string;
	readonly ordinal: number;
	readonly try: number;
	readonly readerUnitId: string;
	readonly unitId: string;
	readonly part: number;
	readonly parts: number;
	readonly outcome: 'SERVED' | 'OUTSIDE';
	readonly sha256: string;
	readonly chars: number;
	/**
	 * ⭐ The lead's ruling 1 (§16; L17C-01) — where a selector was not one as the tool received it, what was asked, each spelled as received (a string
	 * quoted, a number as written, `absent` where none came): *"unit <…>, part <…>"*. Absent on every other read.
	 */
	readonly asked?: string;
}

/** A read's record, made — or why not. */
export type EarlierAttemptReadRecorded = { readonly recorded: true; readonly storageKey: string } | { readonly recorded: false; readonly refusedBecause: string };

/** The name a read's record is bound to: `<tenant>/earlier-attempt-read/<attempt key>/<ordinal>`. */
export function earlierAttemptReadNameOf(tenantPrefix: string, attemptKey: string, ordinal: number): string {
	return `${tenantPrefix}/earlier-attempt-read/${attemptKey}/${ordinal}`;
}

/**
 * ⭐⭐ THE READ RECORD'S WRITER (the lead's ruling 1 on Stage 0; `REG-D-173` (4)) — one read on the content plane, `RETAINED_BY_PARTICIPATION`,
 * bound to the step's attempt. ⛔ It does not throw (§10.1 (3)): a `put` the store fails, a name it refuses to bind, a store that throws — each is
 * answered as a read not recorded, its reason said, and the tool then serves nothing.
 */
export async function recordEarlierAttemptRead(store: ArtifactStore, tenantPrefix: string, read: EarlierAttemptRead): Promise<EarlierAttemptReadRecorded> {
	try {
		const ref = await store.put({
			tenantPrefix,
			bytes: JSON.stringify({ schema: EARLIER_ATTEMPT_READ_SCHEMA, ...read }),
			mediaType: 'application/json',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		const bound = await store.bindName(earlierAttemptReadNameOf(tenantPrefix, read.attemptKey, read.ordinal), ref.storageKey);
		if (!bound.bound) return { recorded: false, refusedBecause: bound.refusedBecause };
		return { recorded: true, storageKey: ref.storageKey };
	} catch (e) {
		return { recorded: false, refusedBecause: describedThrow(e) };
	}
}

/**
 * The record a replacement's tool reads: the reading unit and its step's attempt, the try (as it is when a read is made), the line of units it
 * replaces, each unit's conversation, and the writer of each read's record.
 */
export interface EarlierAttemptPort {
	readonly readerUnitId: string;
	readonly attemptKey: string;
	readonly currentTry: () => number;
	readonly units: readonly ReplacedUnit[];
	readonly conversationOf: (unitId: string) => Promise<UnitConversation>;
	readonly record: (read: EarlierAttemptRead) => Promise<EarlierAttemptReadRecorded>;
}

/** The tool's answer to one call over `port`: the part asked for, served once its read is recorded — or what may be asked for (`OUTSIDE`). */
export async function readEarlierAttempt(
	port: EarlierAttemptPort,
	ordinal: number,
	args: Record<string, unknown>
): Promise<{ readonly ok: boolean; readonly summary: string }> {
	const readable = port.units.filter((u) => u.hasRecord);
	// ⭐ The lead's ruling 1 (§16; the independent review's L17C-01) — ONLY AN ABSENT SELECTOR TAKES THE DEFAULT: an empty `unit`, or one that is not a
	// string, is a unit outside the record; an absent `part` is 1, and one that is not a number that is an integer, as the tool receives it, is outside
	// the record — each answered with what may be asked for, and recorded with what was asked. ~~`Number(args.part)`~~: the handler converts none
	// itself. ⚠ Through Pi, its own validation converts a call's arguments to the tool's schema before the tool runs (`validateToolArguments`), so a
	// `part` of 1.5 arrives here as 1: the harness's boundary for every Pi tool, not undone here; the model's own arguments stay on the record.
	const unitGiven = args.unit === undefined || (typeof args.unit === 'string' && args.unit !== '');
	const partGiven = args.part === undefined || (typeof args.part === 'number' && Number.isInteger(args.part));
	const unitId = typeof args.unit === 'string' ? args.unit : args.unit === undefined ? (readable[0]?.unitId ?? '') : '';
	const part = typeof args.part === 'number' && Number.isFinite(args.part) ? args.part : args.part === undefined ? 1 : 0;
	const base = {
		attemptKey: port.attemptKey,
		ordinal,
		try: port.currentTry(),
		readerUnitId: port.readerUnitId,
		unitId,
		part,
		...(unitGiven && partGiven ? {} : { asked: `unit ${spelledSelector(args.unit)}, part ${spelledSelector(args.part)}` })
	};
	const answerOutside = async (summary: string, parts: number) => {
		const done = await port.record({ ...base, parts, outcome: 'OUTSIDE', sha256: sha256(summary), chars: summary.length });
		return done.recorded ? { ok: false, summary } : { ok: false, summary: notRecorded(done.refusedBecause) };
	};
	if (!unitGiven || !readable.some((u) => u.unitId === unitId))
		return answerOutside(
			`There is no recorded conversation of ${typeof args.unit === 'string' ? `'${args.unit}'` : spelledSelector(args.unit)} to read. The units you may ask for: ${readable.map((u) => `${u.unitId} "${u.title}"`).join('; ')}.`,
			0
		);
	const parts = renderUnitConversation(await port.conversationOf(unitId));
	if (!partGiven || part < 1 || part > parts.length)
		return answerOutside(`The record of ${unitId} has parts 1 to ${parts.length}; part ${spelledSelector(args.part)} is not one of them.`, parts.length);
	const text = parts[part - 1]!;
	const done = await port.record({ ...base, parts: parts.length, outcome: 'SERVED', sha256: sha256(text), chars: text.length });
	return done.recorded ? { ok: true, summary: text } : { ok: false, summary: notRecorded(done.refusedBecause) };
}

const notRecorded = (why: string) => `This read could not be recorded, so it is not served: ${why}`;

/** ⭐ The lead's ruling 1 — a selector as the tool received it, spelled for its read's record: a string quoted, a number as written, `absent` where none came. */
function spelledSelector(value: unknown): string {
	if (value === undefined) return 'absent';
	if (typeof value === 'number') return String(value);
	// ⭐ The lead's ruling 1 of §33 — ~~`try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }`~~, whose fallback threw
	// too on an array nested past what `String` joins, so the call threw and its read was never recorded: the one writer, which says such a value.
	return writtenValue(value);
}

/** Where a role's copy of the shared workspace holds a unit's recorded conversation: `.jpwb/record/<slug>--<unit id>.md`, the slug `acceptedWorkFile`'s. */
export function recordFilePath(title: string, unitId: string): string {
	return acceptedWorkFile(title, unitId).replace(/^\.jpwb\/accepted\//, '.jpwb/record/').replace(/\.txt$/, '.md');
}
