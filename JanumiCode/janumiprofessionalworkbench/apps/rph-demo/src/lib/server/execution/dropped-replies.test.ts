// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D92 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.46; `REG-F-651`) — A REPLY PI DROPPED TO
// GO ON IS RECORDED BESIDE THE EXCHANGE, NEVER IN ITS ANSWER: one content-plane object per exchange that dropped any reply (`jpwb.dropped-replies/1`),
// bound to `<tenant>/dropped-replies/<exchange id>`, `RETAINED_BY_PARTICIPATION` as the materialized input it belongs beside is, and a sentence in
// the exchange's `parseOutcome.detail` naming its key, hash and size (the lead's ruling 4). ⭐ Each dropped reply carries its place among the try's
// replies (`place`: its ordinal among the try's assistant replies, dropped and kept counted alike, in the order they arrived — §7.4 (3)).
// ⭑ THE STEP IS RUN WHOLE (`runModelInvocationStep`), its session a scripted one whose turn answers as Pi's adapter now does: the answer the retry's
// text alone, the dropped reply beside it (`droppedReplies`). Every text is this file's own.
// ⭐ STRENGTHENED 2026-11-18 (the review's L17-16 and L17-17, §7.4 (1)): the schema pinned as its literal, never the production constant; the detail's
// size the stored record's own byte size, measured here; and the no-drop CONTROL held against today's record — the same step answered as the adapter
// answered before this package (no `gatheredFrom`, no `droppedReplies`), its exchange payload and its stored bytes byte for byte.
import { createHash } from 'node:crypto';
import type { PromptTemplate, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from '@janumipwb/rph-application';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { describe, expect, it } from 'vitest';
import { droppedRepliesNameOf } from './dropped-replies.js';
import { runModelInvocationStep } from './run-model-step.js';

const TENANT = 'tnt-test';
const ACTIVE: PromptTemplate = { templateText: 'Assess {subject}.', templateVersion: 1, declaredPlaceholders: ['subject'], status: 'ACTIVE' };
const ENVELOPE = JSON.stringify({ workProduct: { document: 'The work.' }, rationale: { rationale: 'An account.', assumptions: [], limitations: [], residualUncertainty: [] } });
const DROPPED = [{ text: 'PARTIAL text before the break.', stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: 1, place: 1 }] as const;
/**
 * ⭐ L17-17 — the CONTROL's record (its exchange payload and the bytes it names) as one sha256, measured at the base, `44b8482e`, before any of the
 * package's code: this fixture answered as before this package, two steps, each giving this (a probe run alone and removed, `l17b3-facts.md` §8.4).
 */
const NO_DROP_RECORD_TODAY = '57575bfcb9c25fe36c459b4deb84e2178ae22283283f709f59c6a6d5190ead37';

/** How the scripted adapter answers: as Pi's adapter does now (its stops given, and any dropped reply beside), or as it answered before this package. */
type Answering =
	| { readonly kind: 'NOW'; readonly dropped?: readonly (typeof DROPPED)[number][] }
	| { readonly kind: 'BEFORE_THIS_PACKAGE' }
	// ⭐ The lead's ruling 3 (§16; the review's L17C-03) — arrangement: a try whose answer did not arrive, the replies Pi dropped beside it, as its
	// adapter answers one: a reply that streamed text and ended in a retryable error, then a final reply, empty, that ended in an error.
	| { readonly kind: 'NO_ANSWER'; readonly dropped: readonly (typeof DROPPED)[number][] };

/** One step whose session answers as `answering` says: what it dispatched, its aggregate ids, its store, and the bytes its payload names. */
async function stepWith(answering: Answering) {
	let n = 0;
	const store = createInMemoryArtifactStore();
	const dispatched: { payload: RecordModelExchangePayload; aggregateId: string }[] = [];
	const session = {
		retainsHistory: true,
		mintedToolNames: [],
		lastTurnObservation: () => ({ canObserve: true as const, mintedToolNames: [], calls: [] }),
		processRuns: () => ({ runs: [], observedCount: 0, recordedLimit: 32, writes: [] }),
		dispose: () => undefined,
		turn: async () => ({
			...(answering.kind === 'NO_ANSWER'
				? {
						answer: { arrived: false as const, cause: 'CALL_FAILED' as const, reportedBy: 'PROVIDER' as const, message: '500 Internal Server Error' },
						rawOutput: '',
						droppedReplies: answering.dropped
					}
				: { answer: { arrived: true as const, text: ENVELOPE }, rawOutput: ENVELOPE }),
			producer: { agentId: 'execution.model-invocation', modelId: 'faux-model', providerId: 'faux' },
			identityEvidence: 'PROVIDER_REPORTED' as const,
			observedToolCalls: { canObserve: true as const, mintedToolNames: [], calls: [] },
			materializedInput: JSON.stringify({ model: 'faux-model', input: [{ role: 'user', content: [{ type: 'input_text', text: 'Assess Route.' }] }] }),
			...(answering.kind === 'NOW'
				? { gatheredFrom: [{ stopReason: 'stop' }], ...(answering.dropped === undefined ? {} : { droppedReplies: answering.dropped }) }
				: {})
		})
	};
	const out = await runModelInvocationStep({
		subject: { id: 'pwu_1', title: 'Route', description: 'Assess the route.' },
		subjectSemanticVersion: 1,
		pwuTypeId: 'pwut_1',
		template: ACTIVE,
		session,
		store,
		tenantPrefix: TENANT,
		dispatchExchange: (payload: RecordModelExchangePayload, aggregateId: string) => {
			dispatched.push({ payload, aggregateId });
			return { status: 'ACCEPTED' };
		},
		newId: (prefix: string) => `${prefix}_${++n}`,
		now: () => '2026-11-17T10:00:00Z',
		modelId: 'faux-model',
		providerId: 'faux',
		contextPolicy: DEFAULT_CONTEXT_ASSEMBLY_POLICY,
		undertaking: undefined,
		acceptedWork: [],
		reviewCriteria: [],
		binding: { kind: 'NONE' },
		sessionHolds: { kind: 'NOTHING' }
	} as never);
	/** The bytes of every storage key the exchange's payload names, in the order it names them. */
	const bytesNamed = async (payload: RecordModelExchangePayload): Promise<(string | undefined)[]> => {
		const keys = [...JSON.stringify(payload).matchAll(/"storageKey":"([^"]+)"/g)].map((m) => m[1]!);
		return Promise.all(keys.map((k) => store.get(k)));
	};
	return { out, dispatched, store, bytesNamed };
}

describe('⭐⭐ L17b3 (D92; the lead’s ruling 4) — a reply Pi dropped is recorded beside its exchange', () => {
	it('⛔ RED FIRST — a try whose adapter reports a reply Pi dropped records it beside the exchange: bound to its name, its text, its error and its place kept, and the exchange’s detail naming where, its hash and its size (D92)', async () => {
		const { out, dispatched, store } = await stepWith({ kind: 'NOW', dropped: DROPPED });
		expect(out.ran, out.ran ? '' : out.refusedBecause).toBe(true);
		expect(dispatched.length, 'arrangement: one exchange').toBe(1);
		const { payload, aggregateId } = dispatched[0]!;
		const ref = await store.resolveName(droppedRepliesNameOf(TENANT, aggregateId));
		expect(ref, 'no record of the dropped reply is bound to the exchange’s name').toBeDefined();
		const bytes = (await store.get(ref!.storageKey)) ?? '';
		expect(JSON.parse(bytes || '{}'), 'the record does not hold the dropped reply, its error and its place, under its schema').toEqual({
			schema: 'jpwb.dropped-replies/1',
			exchangeId: aggregateId,
			replies: DROPPED
		});
		expect((await store.stat(ref!.storageKey))?.purgeability, 'the record is purgeable').toBe('RETAINED_BY_PARTICIPATION');
		const detail = String((payload as { parseOutcome?: { detail?: unknown } }).parseOutcome?.detail ?? '');
		const size = String(new TextEncoder().encode(bytes).byteLength);
		expect(
			[detail.includes(ref!.storageKey), detail.includes(ref!.contentHash), detail.includes(size)],
			'the exchange’s detail does not name where the dropped reply is kept, its hash and its size'
		).toEqual([true, true, true]);
		expect(droppedRepliesNameOf(TENANT, aggregateId)).toBe(`${TENANT}/dropped-replies/${aggregateId}`);
	});

	// ⭐ STRENGTHENED (L17-17): ~~`.not.toContain('dropped')`~~ alone — the no-drop record is held to today's whole: the same step answered as the adapter
	// answered before this package records, byte for byte, the exchange payload and the bytes it names.
	it('⭑ CONTROL — a try with no dropped reply records byte for byte what it records today: its exchange payload and the bytes it names, as the adapter’s answer before this package left them; no name bound', async () => {
		const now = await stepWith({ kind: 'NOW' });
		const before = await stepWith({ kind: 'BEFORE_THIS_PACKAGE' });
		expect([now.out.ran, before.out.ran], 'arrangement: both steps ran').toEqual([true, true]);
		const [n, b] = [now.dispatched[0]!, before.dispatched[0]!];
		expect(JSON.stringify(n.payload), 'the exchange of a try with no dropped reply moved from today’s').toBe(JSON.stringify(b.payload));
		expect(await now.bytesNamed(n.payload), 'the bytes the exchange names moved from today’s').toEqual(await before.bytesNamed(b.payload));
		expect(await now.store.resolveName(droppedRepliesNameOf(TENANT, n.aggregateId)), 'a record was bound for a try that dropped nothing').toBeUndefined();
		expect(String((n.payload as { parseOutcome?: { detail?: unknown } }).parseOutcome?.detail ?? ''), 'the detail speaks of a dropped reply').not.toContain('dropped');
		// ⭐ And both held against TODAY'S record itself, measured at the base (`44b8482e`) before any of the package's code (`l17b3-facts.md` §8): the
		// exchange payload and the bytes it names, as one sha256 — so a change made to every try's record, the two alike, is seen too.
		const digest = createHash('sha256')
			.update(JSON.stringify({ payload: b.payload, bytes: await before.bytesNamed(b.payload) }), 'utf8')
			.digest('hex');
		expect(digest, 'the record of a try with no dropped reply is not byte for byte the base’s').toBe(NO_DROP_RECORD_TODAY);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 3 (§16; the independent review's L17C-03) — THE REPLIES PI DROPPED ARE RECORDED BESIDE
	// AN EXCHANGE WHOSE ANSWER DID NOT ARRIVE TOO, under the exchange's id, its no-answer detail joined by the same sentence.
	it('⛔ RED FIRST — a try whose answer did not arrive records the replies Pi dropped beside its exchange: bound to its name, and its no-answer detail naming where they are kept (the lead’s ruling 3)', async () => {
		const { out, dispatched, store } = await stepWith({ kind: 'NO_ANSWER', dropped: DROPPED });
		expect(out.ran, 'arrangement: the try’s answer did not arrive, so the step did not run').toBe(false);
		expect(dispatched.length, 'arrangement: one exchange').toBe(1);
		const { payload, aggregateId } = dispatched[0]!;
		const ref = await store.resolveName(droppedRepliesNameOf(TENANT, aggregateId));
		const detail = String((payload as { parseOutcome?: { detail?: unknown } }).parseOutcome?.detail ?? '');
		expect(
			[ref !== undefined, ref !== undefined && detail.includes(ref.storageKey), detail.includes('No answer bytes reached this host')],
			'the dropped reply of a try whose answer did not arrive is not recorded beside its exchange, or its detail does not name where'
		).toEqual([true, true, true]);
		const bytes = ref === undefined ? '{}' : ((await store.get(ref.storageKey)) ?? '{}');
		expect(JSON.parse(bytes), 'the record does not hold the dropped reply under its schema').toEqual({ schema: 'jpwb.dropped-replies/1', exchangeId: aggregateId, replies: DROPPED });
	});
});
