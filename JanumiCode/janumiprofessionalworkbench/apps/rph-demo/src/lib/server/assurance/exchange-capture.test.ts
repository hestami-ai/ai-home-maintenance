// ICP-02 d2b — one PER-9 exchange record per bounded try, with the content actually retained.
//
// The Reasoning Review runs up to FOUR bounded tries per authoring turn (the floor runs twice — `+server.ts:127`
// and the auto-refine pass at `:153` — and each run can call the model twice, at
// `reasoning-review-validator.ts:176` and `:181`). Today that produces ZERO records. Findings #24, #25, #62.
//
// REG-D-050 settles the retention question the sponsor answered: "the governed stream is fully auditable and
// reconstructable", so a materialized assurance input PARTICIPATES and is RETAINED_BY_PARTICIPATION — purging it
// would make the Assessment's conclusion unreproducible, which is PER-8's stated WHY ("a record with holes cannot
// answer who decided what on what basis").
import { describe, expect, it } from 'vitest';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { captureTry, createExchangeSink } from './exchange-capture.js';

const MODEL = { modelId: 'gemini-2.5-pro', providerId: 'google' };
const TENANT = 'tnt-test';

// The per-try facts PER-9 requires and only the caller can know: where this try sits in its run, and the
// occurrence times bracketing the model call. They are REQUIRED rather than optional because an absent
// ordinal or an absent time is not "unknown" — it is a record that cannot be ordered or reconciled, which is
// the record-plane omission PER-9 forbids. Fixed values here so the gate is not wall-clock dependent.
const CAPTURE_FACTS = {
	attemptOrdinal: 1,
	requestedAt: '2026-09-03T10:00:00Z',
	respondedAt: '2026-09-03T10:00:01Z',
	// E-5's detail. NOT_ATTEMPTED would assert an outcome nobody observed; these fixtures do parse.
	parseOutcome: { outcome: 'PARSED' as const, detail: 'Fixture: coerced without repair.' },
	// ⭐ R11 — the two fields every try now owes. These fixtures are ASSURANCE-shaped calls (a reviewer's, not
	// an executing step's), so the honest derivation is `NO_WORK_PRODUCT_EXPECTED`, and no adapter in this file
	// observes tool calls. ⚠ Named as one constant rather than repeated per call so a future member added to
	// either discriminator has ONE place to be considered, not eleven places to be forgotten in.
	workProductDerivation: {
		relation: 'NO_WORK_PRODUCT_EXPECTED' as const,
		reason: 'Fixture: an assurance try, whose answer is a judgement rather than a deliverable.'
	},
	observedToolCalls: {
		observation: 'NOT_OBSERVABLE' as const,
		reason: 'Fixture: this harness drives no adapter that can observe tool calls.'
	}
};

function harness() {
	return { store: createInMemoryArtifactStore(), sink: createExchangeSink() };
}

describe('ICP-02 d2b · exchange capture — one record per bounded try', () => {
	// ── ⭑ REG-D-057 — THE OMISSION IS DECLARED WITH ENOUGH STRUCTURE TO UNDO IT ────────────────────────────
	//
	// This is the test the whole ruling exists for. `REG-F-345` drove the defect: the split stored
	// `prefix + suffix` as one object and recorded the join nowhere, so `thinking hard here {"r":1}` and
	// `{"r":1}thinking hard here ` produced BYTE-IDENTICAL records. Reason-then-answer and
	// answer-then-rationalisation were the same record — on a policy whose subject is HOW the reviewer
	// reasoned. The sponsor ruled option (a): record where the answer sat.
	it('⭑ a MIXED reply REASSEMBLES to the exact bytes that arrived', async () => {
		const { store, sink } = harness();
		const RAW = 'Let me think. {"verdict":"ok"} On reflection, yes.';

		await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-round-trip',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'assess it',
			rawOutput: RAW,
			disposition: 'accepted'
		});

		const rec = sink.drain()[0]!;
		const cut = rec.omittedRegions.find((r) => r.role === 'MODEL_ANSWER');
		expect(cut, 'a separated reply owes a declared MODEL_ANSWER omission').toBeDefined();

		// Read the two retained objects back and put them together the way the region says to.
		const reasoning = await store.get(rec.volunteeredReasoningRef.storageKey!);
		const answer = await store.get(rec.answerSpanRef.storageKey!);
		const bytes = Buffer.from(reasoning!, 'utf8');
		const rebuilt = Buffer.concat([
			bytes.subarray(0, cut!.byteOffset),
			Buffer.from(answer!, 'utf8'),
			bytes.subarray(cut!.byteOffset)
		]).toString('utf8');

		// THE MUTANT: drop `byteOffset` from the region, or append the answer at the end instead of at the
		// offset. Before this ruling the record simply could not distinguish the two, and this assertion is
		// the only thing in the repository that would notice.
		expect(rebuilt, 'the retained halves must rebuild the reply exactly').toBe(RAW);
		expect(cut!.byteSize).toBe(Buffer.byteLength('{"verdict":"ok"}', 'utf8'));
	});

	// ── ⚠ AND THE UNITS ARE BYTES, WHICH ONLY A NON-ASCII REPLY CAN PROVE ──────────────────────────────────
	//
	// `byteSize` everywhere else in this record is `Buffer.byteLength`; `String.prototype.length` is UTF-16
	// code units. They agree on ASCII and diverge the moment they matter — which is exactly the shape that
	// ships green and corrupts real traffic. THE MUTANT: use `span.prefix.length` in `captureTry`. The test
	// above still passes; this one reddens, and it is the ONLY thing that does.
	it('⭑ and it reassembles a NON-ASCII reply, so the offset is bytes and not code units', async () => {
		const { store, sink } = harness();
		// Accented Latin (2 bytes each), a CJK sentence (3 bytes each) and an emoji (4 bytes, a surrogate
		// pair in UTF-16) — every class where the two measurements disagree, ahead of the answer span.
		const RAW = 'Réflexion préalable — 慎重に検討します 🧭 {"verdict":"ok"} Fin.';

		await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-utf8',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'assess it',
			rawOutput: RAW,
			disposition: 'accepted'
		});

		const rec = sink.drain()[0]!;
		const cut = rec.omittedRegions.find((r) => r.role === 'MODEL_ANSWER')!;

		// The control that makes this test mean something: if these two agreed, the fixture would be ASCII
		// and the mutant would survive. They must differ, or this test is not testing what it claims.
		const prefix = RAW.slice(0, RAW.indexOf('{'));
		expect(
			Buffer.byteLength(prefix, 'utf8'),
			'the fixture must be one where bytes and code units DISAGREE'
		).not.toBe(prefix.length);
		expect(cut.byteOffset, 'the offset is UTF-8 bytes').toBe(Buffer.byteLength(prefix, 'utf8'));

		const reasoning = Buffer.from((await store.get(rec.volunteeredReasoningRef.storageKey!))!, 'utf8');
		const answer = Buffer.from((await store.get(rec.answerSpanRef.storageKey!))!, 'utf8');
		const rebuilt = Buffer.concat([
			reasoning.subarray(0, cut.byteOffset),
			answer,
			reasoning.subarray(cut.byteOffset)
		]).toString('utf8');
		expect(rebuilt).toBe(RAW);
	});

	// ⛔ AND A CLEAN REPLY OWES NO REGION — without this the two tests above could not be told apart from
	// "every exchange declares a MODEL_ANSWER omission", which would be false and would refuse the case
	// REG-D-056 permits: nothing was cut out, so nothing is declared.
	it('CONTROL — a reply with nothing separated declares no omission', async () => {
		const { store, sink } = harness();
		await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-clean',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'assess it',
			rawOutput: '{"verdict":"ok"}',
			disposition: 'accepted'
		});
		expect(sink.drain()[0]!.omittedRegions).toEqual([]);
	});

	it('records the try, and the materialized input is STORED rather than pending', async () => {
		const { store, sink } = harness();

		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'JUDGE THIS GRAPH',
			rawOutput: '{"recommendation":"SATISFIED"}',
			disposition: 'accepted'
		});

		// THE MUTANT: leave the ref PENDING_CONTENT_PLANE. That was correct while no store existed; with one, it
		// would be a record claiming its bytes are unretainable when they are sitting in the store.
		expect(rec.materializedInputRef.status).toBe('STORED');
		expect(sink.drain()).toHaveLength(1);

		// ⭑ E-2 IS NOW RETAINED, SPLIT AT RETENTION (REG-D-056 + Guide §9.7). This fixture's rawOutput is a
		// bare JSON object with no prose around it, so there is nothing to separate: the whole output IS the
		// answer, and a single retention class fits it exactly.
		expect(rec.answerSpanRef.status, 'the answer span is retained').toBe('STORED');
		expect(rec.answerSpanRef.purgeability, 'the answer participated in a judgement — PER-8').toBe(
			'RETAINED_BY_PARTICIPATION'
		);
		expect(rec.rawOutputBeforeCoercionRef.status, 'nothing to separate, so the blob is storable').toBe(
			'STORED'
		);

		// THE MUTANT: store the volunteered-reasoning ref anyway. PER-12's availability is provider-dependent
		// and there is no obligation to procure a trace, so an ABSENCE must be recorded as observed rather
		// than as an unretained presence — the distinction this repository records as its most common defect.
		expect(rec.volunteeredReasoningRef.status).toBe('PENDING_CONTENT_PLANE');
		expect(rec.volunteeredReasoningRef.reason, 'an observed absence, not a block').toMatch(
			/no volunteered reasoning arrived/i
		);
	});

	it('the stored bytes are the EXACT prompt — retrievable, not merely referenced', async () => {
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'JUDGE THIS GRAPH',
			rawOutput: 'raw',
			disposition: 'accepted'
		});

		// THE MUTANT: store a hash or an excerpt. PER-9: "the exact materialized input", and "a fingerprint
		// identifies that record; it never substitutes for it" — REG-F-314's error as an executable refusal.
		expect(await store.get(rec.materializedInputRef.storageKey ?? '')).toBe('JUDGE THIS GRAPH');
	});

	it('content is RETAINED_BY_PARTICIPATION and REFUSES to purge — REG-D-050', async () => {
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'JUDGE THIS GRAPH',
			rawOutput: 'raw',
			disposition: 'accepted'
		});

		// THE MUTANT: mark it PURGEABLE_AT_EXPIRY. It is the basis of a recorded professional judgement; purging
		// it makes the Assessment unreproducible, which is exactly what the sponsor's "fully auditable and
		// reconstructable" forecloses and what PER-8 forbids.
		const outcome = await store.purge(rec.materializedInputRef.storageKey ?? '');
		expect(outcome.purged).toBe(false);
		// ⚠ ASSERT THE REASON, NOT JUST THE REFUSAL. purge() also returns {purged:false} for an UNKNOWN key, so a
		// bare false cannot tell "refused because it participated" from "refused because nothing was stored" —
		// and a mutant that left the ref PENDING passed this test for the second reason while breaking the first.
		expect(outcome.purged === false && outcome.refusedBecause).toMatch(/PER-8|participat/i);
	});

	it('a REPAIR records a SECOND try whose predecessor survives intact — PER-9-a', async () => {
		const { store, sink } = harness();

		const first = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P1',
			rawOutput: 'MALFORMED-FIRST-ANSWER',
			disposition: 'repair-requested'
		});
		const second = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-2',
			role: 'repair',
			predecessor: first,
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P1 + repair suffix',
			rawOutput: '{"ok":true}',
			disposition: 'accepted'
		});

		expect(sink.drain()).toHaveLength(2);
		expect(second.predecessorExchangeId).toBe('exch-1');

		// ⚠ THE FIRST VERSION OF THIS ASSERTION WAS INERT, AND THE MUTANT PROVED IT. It checked only that the
		// FIRST record's bytes survived — which a mutant repointing the SECOND record's ref never touches, so it
		// passed for a reason unrelated to what it claimed. The defect being guarded is that a repair CLOBBERS
		// its predecessor (`raw = await print(...)` at reasoning-review-validator.ts:180, finding #25), and
		// catching that requires asserting the two records hold DIFFERENT, independently readable content.
		// ⚠ THE GUARANTEE NOW RIDES ON E-1, BECAUSE E-2 IS BLOCKED. A repair sends a DIFFERENT prompt (the
		// original plus a repair suffix), so the two tries have distinct, independently readable inputs — which
		// is the same non-clobbering property, asserted on the content that is lawfully retained.
		expect(second.materializedInputRef.storageKey).not.toBe(first.materializedInputRef.storageKey);
		expect(await store.get(first.materializedInputRef.storageKey ?? '')).toBe('P1');
		expect(await store.get(second.materializedInputRef.storageKey ?? '')).toBe('P1 + repair suffix');
		// CSAA-007's rule — "Repair never rewrites predecessor raw output" — is honoured VACUOUSLY for E-2
		// while it is blocked: there is no retained raw output to rewrite. Recorded so a later reader does not
		// mistake the blocked state for a satisfied one.
		expect(first.rawOutputBeforeCoercionRef.status).toBe('PENDING_CONTENT_PLANE');
	});

	it('the parse outcome is recorded on each try — E-5', async () => {
		const { store, sink } = harness();
		await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: 'bad',
			disposition: 'repair-requested'
		});

		// THE MUTANT: drop the disposition. Finding #62 is precisely that the parse outcome is swallowed by a
		// bare catch and recorded nowhere.
		expect(sink.drain()[0].disposition).toBe('repair-requested');
	});

	it('works with NO store and NO sink — capture is optional wiring, not a hard dependency', async () => {
		// THE MUTANT: require them. The validator is constructed fresh on every floor run with an empty opts
		// object (assurance/index.ts:24), so a hard dependency would break the assurance path outright rather
		// than degrade to today's behaviour.
		const rec = await captureTry({
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: 'r',
			disposition: 'accepted'
		});
		expect(rec.materializedInputRef.status).toBe('PENDING_CONTENT_PLANE');
	});
});

describe('captureTry - a store without a sink is a misconfiguration, not a degraded mode', () => {
	it('REFUSES when bytes would be retained with no record to reference them', async () => {
		// H-1, and it arms on ONE added property. `artifacts` and `exchanges` are independently optional on
		// AgyValidatorOptions, and captureTry early-returns only when NO store is supplied. Supply a store
		// without a sink and `put()` runs unconditionally while the record goes to `input.sink?.record(...)`
		// - optional-chained, so it is silently dropped. The result is retained bytes that no record
		// references, which REG-F-336 C-2 forbids in terms: "content on the content plane with no record on
		// the record plane pointing at it. A half-wire is worse than the disclosed absence it replaces."
		//
		// PREDICTED RED BEFORE THE FIX: this test fails, because the current code silently SUCCEEDS.
		const store = createInMemoryArtifactStore();

		await expect(
			captureTry({
				store,
				// no sink - the whole point
				tenantPrefix: 'tnt-local',
				exchangeId: 'exch-1',
				role: 'initial',
				model: { modelId: 'm', providerId: 'p' },
				...CAPTURE_FACTS,
				prompt: 'PROMPT BYTES',
				rawOutput: '{}',
				disposition: 'accepted'
			})
		).rejects.toThrow(/sink|record plane|orphan/i);
	});

	// ⭑ NO NEW CONTROL IS ADDED, AND THAT IS A FINDING RATHER THAN AN OMISSION.
	// Two were drafted — "a store WITH a sink still captures normally" and "NEITHER store nor sink still
	// degrades" — and BOTH were redundant: the first duplicates the five store-using tests above, the second
	// duplicates "works with NO store and NO sink". DRIVEN: the control mutant (refuse whenever a store is
	// present at all) reddens SIX tests, so the discrimination this guard needs is already in the file. A
	// control that cannot get its own single-victim mutant is noise, which this repository keeps recording.
});

describe('the record discloses the DURABILITY of the content it names - H-2', () => {
	it('a STORED ref carries the content store declared durability', async () => {
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'JUDGE THIS GRAPH',
			rawOutput: '{}',
			disposition: 'accepted'
		});

		// H-2, the INVERSE orphan: this record plane can be durable (SqliteStorageAdapter) while the content
		// plane is not. After one restart the reference names bytes that are gone, and the store answer is
		// indistinguishable from a key never written - so the record still LOOKS intact. That is worse than
		// the plain orphan, which at least leaves nothing pointing anywhere.
		//
		// THE MUTANT: hardcode 'DURABLE', or drop the field. Either way a permanent record silently claims
		// content it cannot produce. PER-9: "record-plane omission is not legal."
		expect(rec.materializedInputRef.contentDurability).toBe('PROCESS_LOCAL');
		// Taken FROM THE STORE, not assumed - so a durable adapter changes this without touching captureTry.
		expect(rec.materializedInputRef.contentDurability).toBe(store.durability);
	});

	it('a PENDING ref classifies nothing, because there are no bytes to classify', async () => {
		const rec = await captureTry({
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: '{}',
			disposition: 'accepted'
		});

		// Same reasoning the file already applies to `purgeability`: a durability claim about absent bytes
		// asserts a fact about nothing.
		expect(rec.materializedInputRef.status).toBe('PENDING_CONTENT_PLANE');
		expect(rec.materializedInputRef.contentDurability).toBeUndefined();
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7 P7-6 I2 (`DESIGN-the-reviewer-isolated.md` §2; `REG-F-351`, `REG-D-103` (2)) ──────────────
describe('⭐⭐ P7-6 I2 — a reply no answer span can be located in, KEPT for diagnosis where the caller asks; and a tool’s export of the session, pointed at', () => {
	const PROSE = "I'll verify the files the work product describes first.";

	it('⭐ RETAINED_FOR_DIAGNOSIS — the whole reply stored PURGEABLE_AT_EXPIRY; its spans PENDING, each saying where the reply is', async () => {
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-prose',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: PROSE,
			disposition: 'repair-requested',
			unseparatedRawOutput: 'RETAINED_FOR_DIAGNOSIS'
		});
		expect(rec.rawOutputBeforeCoercionRef.status).toBe('STORED');
		expect(await store.get(rec.rawOutputBeforeCoercionRef.storageKey!)).toBe(PROSE);
		// ⛔ THE MUTANT: RETAINED_BY_PARTICIPATION. No judgement can rest on these bytes — a reply with no locatable object
		// coerces to the same empty judgement whatever it says — and any reasoning in them must stay purgeable (PER-12).
		expect(rec.rawOutputBeforeCoercionRef.purgeability).toBe('PURGEABLE_AT_EXPIRY');
		expect((await store.stat(rec.rawOutputBeforeCoercionRef.storageKey!))?.purgeability).toBe('PURGEABLE_AT_EXPIRY');
		for (const span of [rec.answerSpanRef, rec.volunteeredReasoningRef]) {
			expect(span.status).toBe('PENDING_CONTENT_PLANE');
			expect(span.reason).toMatch(/rawOutputBeforeCoercionRef/);
		}
		expect(rec.omittedRegions, 'nothing was cut out of anything, so nothing is declared').toEqual([]);
	});

	it('⭑ CONTROL — absent, the §9.7 block is UNCHANGED: the execution plane, which never asks, keeps nothing of such a reply', async () => {
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-prose-blocked',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: PROSE,
			disposition: 'accepted'
		});
		for (const ref of [rec.rawOutputBeforeCoercionRef, rec.answerSpanRef, rec.volunteeredReasoningRef]) {
			expect(ref.status).toBe('PENDING_CONTENT_PLANE');
			expect(ref.reason).toMatch(/separated losslessly/);
		}
	});

	it('⭐ a tool’s EXPORT of the session is stored PURGEABLE_AT_EXPIRY, and the tool-call observation’s reason names where', async () => {
		const { store, sink } = harness();
		const EXPORT = '{"schema_version":"ATIF-v1.7","steps":[]}';
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-export',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: '{}',
			disposition: 'accepted',
			toolSessionExport: EXPORT
		});
		const reason = rec.observedToolCalls.reason ?? '';
		// ⭐ The adapter's own words stay first, whole; the pointer follows them.
		expect(reason.startsWith(CAPTURE_FACTS.observedToolCalls.reason)).toBe(true);
		const key = /storage key (\S+?),/.exec(reason)?.[1];
		// ⛔ THE MUTANT: the export stored and the pointer dropped — bytes on the content plane that no record points at,
		// the orphan `REG-F-336` C-2 forbids.
		expect(key, 'the reason names the export’s storage key').toBeDefined();
		expect(await store.get(key!)).toBe(EXPORT);
		expect((await store.stat(key!))?.purgeability).toBe('PURGEABLE_AT_EXPIRY');
		expect(rec.observedToolCalls.observation, 'the observation itself is unchanged').toBe('NOT_OBSERVABLE');
	});

	it('⛔ beside an OBSERVED report the export is NOT stored: that arm may carry no reason, so nothing could point at it', async () => {
		const { store, sink } = harness();
		const puts: string[] = [];
		const counting = { ...store, put: async (i: Parameters<typeof store.put>[0]) => (puts.push(i.bytes), store.put(i)) };
		const rec = await captureTry({
			store: counting,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-observed',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			observedToolCalls: {
				observation: 'OBSERVED',
				calls: [{ ordinal: 1, nameProvenance: 'NOT_MINTED', outcome: 'COMPLETED' }],
				observedCount: 1,
				recordedLimit: 32
			},
			prompt: 'P',
			rawOutput: '{}',
			disposition: 'accepted',
			toolSessionExport: '{"steps":[]}'
		});
		expect(puts, 'the export is never written').not.toContain('{"steps":[]}');
		expect(rec.observedToolCalls.reason, 'and the OBSERVED report gains no reason').toBeUndefined();
	});

	it('⭑ CONTROL — with NO store nothing is retained, and the observation is the adapter’s own, untouched', async () => {
		const rec = await captureTry({
			tenantPrefix: TENANT,
			exchangeId: 'exch-nostore',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: PROSE,
			disposition: 'accepted',
			unseparatedRawOutput: 'RETAINED_FOR_DIAGNOSIS',
			toolSessionExport: '{"steps":[]}'
		});
		expect(rec.rawOutputBeforeCoercionRef.status).toBe('PENDING_CONTENT_PLANE');
		expect(rec.observedToolCalls).toEqual(CAPTURE_FACTS.observedToolCalls);
	});
});

describe('⭐⭐ `JAN-MHX` MH-1 (D20; C28) — a CLI executor’s own record, kept beside a breach and pointed at from the failure message', () => {
	const BREACH = '{"breach":"CLI_OWN_TOOL_RAN","cliRecord":"{}","unexplainedChanges":[]}';
	const FAILED = {
		outcome: 'EMPTY_RESPONSE' as const,
		detail: 'No answer bytes reached this host on this try. CLI_OWN_TOOL_RAN: fixture.'
	};
	const OBSERVED = {
		observation: 'OBSERVED' as const,
		calls: [{ ordinal: 1, nameProvenance: 'NOT_MINTED' as const, outcome: 'UNKNOWN' as const }],
		observedCount: 1,
		recordedLimit: 32
	};

	it('⭐ the record is stored PURGEABLE_AT_EXPIRY, and the parse outcome’s detail names where, beside an OBSERVED report', async () => {
		// ⛔ THE MUTANT: never store it. On a breach the CLI's record is the only account of what the CLI did (D20).
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-breach',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			parseOutcome: FAILED,
			observedToolCalls: OBSERVED,
			prompt: 'P',
			rawOutput: '',
			disposition: 'no-response',
			breachRecord: BREACH
		});
		// ⭐ The failure's own words stay first, whole; the pointer follows them.
		expect(rec.parseOutcome.detail.startsWith(FAILED.detail)).toBe(true);
		const key = /storage key (\S+?),/.exec(rec.parseOutcome.detail)?.[1];
		expect(key, 'the failure message names the record’s storage key').toBeDefined();
		expect(await store.get(key!)).toBe(BREACH);
		expect((await store.stat(key!))?.purgeability).toBe('PURGEABLE_AT_EXPIRY');
		expect(rec.observedToolCalls, 'the OBSERVED report is untouched: it may carry no reason').toEqual(OBSERVED);
	});

	it('⭑ CONTROL — with no breach record, the failure message is the caller’s alone', async () => {
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-nobreach',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			parseOutcome: FAILED,
			observedToolCalls: OBSERVED,
			prompt: 'P',
			rawOutput: '',
			disposition: 'no-response'
		});
		expect(rec.parseOutcome).toEqual(FAILED);
	});
});
