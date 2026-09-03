// RecordModelExchange — PER-9's durable exchange record becomes an act (JAN-MXR, REG-D-055).
//
// ⚠ WHY THIS FILE IS REQUIRED AND NOT OPTIONAL. `verif/command-dispatch-census.test.ts` refuses a ratified,
// routable command whose handler has never run: *"its preconditions, its emitted payload and its event-gate
// conformance are claims nothing checks."* It reddened the moment `RecordModelExchange` was registered. The
// emission is also PINNED by hand in `verif/event-surface-census.test.ts` — no single vitest worker sees the
// whole suite's emissions — so that pin is only honest if something here actually DRIVES the event.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Engine } from '../index.js';

const TS = '2026-09-03T10:00:00Z';
const LATER = '2026-09-03T10:00:04Z';
const MEX = 'mex_01ARZ3NDEKTSV4RRFFQ69G0301';
const PRIOR = 'mex_01ARZ3NDEKTSV4RRFFQ69G0300';
const SUBJECT = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5A80';

const STORED = {
	status: 'STORED',
	storageProvider: 'jpwb:in-memory',
	storageKey: 'tnt-local/RETAINED_BY_PARTICIPATION/de09be4f',
	contentHash: 'sha256:de09be4f',
	byteSize: 2048,
	purgeability: 'RETAINED_BY_PARTICIPATION',
	contentDurability: 'PROCESS_LOCAL'
};

/** The disclosed absence PER-9 permits — as distinct from the silent one it forbids. */
const pending = (reason: string) => ({ status: 'PENDING_CONTENT_PLANE', reason });

const REPORTED = { availability: 'REPORTED', evidence: 'HOST_CONFIGURED', value: 'gemini-2.5-pro' };
const UNREPORTED = {
	availability: 'UNREPORTED',
	evidence: 'NONE',
	rationale: 'agy --print reports no model version on stdout.'
};

describe('RecordModelExchange — one bounded model try becomes a durable record', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const wellFormed = (over: Record<string, unknown> = {}) => ({
		exchangeId: MEX,
		exchangeRole: 'INITIAL',
		attemptOrdinal: 1,
		runToken: 'floorrun_01ARZ3ND',
		plane: 'ASSURANCE',
		invokerId: 'agy.reasoning-review',
		assurancePolicyId: 'pol_reasoning_review',
		subjectObjectId: SUBJECT,
		subjectObjectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		subjectSemanticVersion: 1,
		resolvedProvider: { availability: 'REPORTED', evidence: 'HOST_CONFIGURED', value: 'google' },
		resolvedModel: REPORTED,
		resolvedModelVersion: UNREPORTED,
		materializedInputRef: STORED,
		rawOutputBeforeCoercionRef: pending('REG-Q-066 is OPEN and sponsor-reserved.'),
		answerSpanRef: pending('REG-Q-066 is OPEN and sponsor-reserved.'),
		volunteeredReasoningRef: pending('REG-Q-066 is OPEN and sponsor-reserved.'),
		inputRedactionManifestRef: pending('No redaction is implemented in this codebase (finding #60).'),
		redactionState: 'NOT_IMPLEMENTED',
		inputTruncation: 'NONE_DECLARED',
		outputTruncation: 'NONE_DECLARED',
		omittedRegions: [],
		disposition: 'ACCEPTED',
		parseOutcome: { outcome: 'PARSED', detail: 'Coerced against the judgement schema without repair.' },
		requestedAt: TS,
		respondedAt: LATER,
		...over
	});

	function record(payload: unknown) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType: 'RecordModelExchange',
			commandSchemaVersion: 1,
			targetAggregateType: 'MODEL_EXCHANGE',
			targetAggregateId: (payload as { exchangeId: string }).exchangeId,
			issuedAt: TS,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const emitted = () => store.readAllEvents().filter((e) => e.eventType === 'ModelExchangeRecorded');

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
	});

	it('mints a MODEL_EXCHANGE, BORN TERMINAL, and emits ModelExchangeRecorded', () => {
		expect(record(wellFormed()).status, 'the command must be ACCEPTED').toBe('ACCEPTED');
		expect(emitted(), 'exactly one ModelExchangeRecorded').toHaveLength(1);

		const state = store.loadObject(MEX)?.state as Record<string, unknown>;
		// Born terminal is not economy: there is no second command, so PER-8 immutability is structural and
		// CSAA-007's "repair never rewrites predecessor raw output" is unbreakable rather than merely observed.
		expect(state.lifecycleStatus, 'born terminal').toBe('RECORDED');
		expect(store.loadObject(MEX)?.revision, 'revision 0, once, forever').toBe(0);
	});

	it('the EVENT payload carries the full field set — PER-2, not a partial', () => {
		record(wellFormed());
		const payload = emitted()[0]!.payload as Record<string, unknown>;

		// THE MUTANT: emit a subset. PER-2: "authoritative history remains reconstructable" and "materialized
		// current state is a cache of this history, not a second authority." A partial event payload inverts
		// that — it makes the state row the authority. Derived from the well-formed input rather than
		// hand-listed, so a field added later is covered without anyone remembering to add it here.
		for (const k of Object.keys(wellFormed())) expect(payload, `event payload must carry ${k}`).toHaveProperty(k);
	});

	it('⛔ REFUSES a whole blob stored ALONGSIDE a separated reasoning span', () => {
		// REG-D-056 (sponsor): "Yes, save raw answer." The spans are now retainable. What the ruling does NOT
		// lift is the mixed whole-blob write: if a reasoning span was separated out, the blob demonstrably
		// CONTAINS reasoning, and storing it whole classifies that reasoning as participating — permanent under
		// PER-8, when PER-12 requires it purgeable. That is the `rawOutput` field item 23 drafted, defended as
		// "retained whole", and withdrew.
		//
		// THE MUTANT: delete this guard along with the old blanket one. The ruling would then be read as
		// permitting the very formulation it was careful not to permit.
		const r = record(
			wellFormed({ rawOutputBeforeCoercionRef: STORED, volunteeredReasoningRef: STORED })
		);
		expect(r.status, 'a mixed whole-blob write must not be accepted').not.toBe('ACCEPTED');
		expect(emitted(), 'and no event may be written for a refused command').toHaveLength(0);
	});

	it('CONTROL — the two SPANS may both be STORED, so the refusal is about mixing, not storing', () => {
		// Without this the guard could not be told apart from "refuse every stored E-2 ref", which would
		// silently keep REG-Q-066's block in force after the sponsor lifted it.
		const r = record(wellFormed({ answerSpanRef: STORED, volunteeredReasoningRef: STORED }));
		expect(r.status, 'the separated spans are exactly what REG-D-056 permits').toBe('ACCEPTED');
	});

	it('CONTROL — a whole blob with NO reasoning separated out is accepted', () => {
		// When nothing was separated, the whole output IS the answer and one class fits it exactly. Refusing
		// here would block the case §9.7 explicitly contemplates.
		const r = record(wellFormed({ rawOutputBeforeCoercionRef: STORED, answerSpanRef: STORED }));
		expect(r.status).toBe('ACCEPTED');
	});

	it('CONTROL — E-1 MAY be STORED, so the refusal above is about E-2 and not about storing', () => {
		// Without this the guard could not be told apart from "refuse every stored ref". REG-D-050 classified
		// the materialized input RETAINED_BY_PARTICIPATION outright; only E-2 is reserved.
		expect(record(wellFormed()).status).toBe('ACCEPTED');
		const p = emitted()[0]!.payload as { materializedInputRef: { status: string } };
		expect(p.materializedInputRef.status).toBe('STORED');
	});

	// ⚠ SPLIT INTO TWO, BECAUSE ONE TEST COULD NOT TELL ITS TWO GUARDS APART. As a single case, disabling
	// EITHER direction reddened it, so neither was independently proven — the trips-two-conjuncts trap. Each
	// direction now has its own single-victim mutant.
	it('REFUSES a follow-on try that names no predecessor', () => {
		// A hole in the chain defeats PER-9's "each retry, reformat, and repair request included".
		expect(record(wellFormed({ exchangeRole: 'REPAIR', attemptOrdinal: 2 })).status).not.toBe('ACCEPTED');
		expect(emitted()).toHaveLength(0);
	});

	it('REFUSES an INITIAL try that names a predecessor', () => {
		expect(
			record(wellFormed({ predecessorExchangeId: PRIOR })).status,
			'an INITIAL try has nothing before it, so a predecessor asserts a record that does not exist'
		).not.toBe('ACCEPTED');
		expect(emitted()).toHaveLength(0);
	});

	it('CONTROL — a REPAIR that DOES name its predecessor is accepted and chains', () => {
		const r = record(wellFormed({ exchangeRole: 'REPAIR', attemptOrdinal: 2, predecessorExchangeId: PRIOR }));
		expect(r.status).toBe('ACCEPTED');
		const p = emitted()[0]!.payload as { predecessorExchangeId: string };
		expect(p.predecessorExchangeId, 'the chain is what makes four tries one turn').toBe(PRIOR);
	});

	it('REFUSES a content ref whose optionals disagree with its own status', () => {
		// The discriminator determines every optional, and both disagreements are refused — otherwise a reader
		// cannot tell "not stored" from "nobody recorded where".
		expect(
			record(wellFormed({ materializedInputRef: { ...STORED, storageKey: undefined } })).status,
			'STORED without a storageKey is a reference to nothing'
		).not.toBe('ACCEPTED');
		expect(
			record(wellFormed({ materializedInputRef: { ...pending('why'), byteSize: 12 } })).status,
			'PENDING cannot both disclaim its bytes and describe them'
		).not.toBe('ACCEPTED');
	});

	it('REFUSES an identity fact that reports nothing but carries a value, or vice versa', () => {
		// E-3 is per-fact so "the provider said nothing" stays distinguishable from "nobody looked".
		expect(
			record(wellFormed({ resolvedModel: { availability: 'REPORTED', evidence: 'NONE', value: 'x' } })).status,
			'a REPORTED value came from somewhere'
		).not.toBe('ACCEPTED');
		expect(
			record(wellFormed({ resolvedModelVersion: { ...UNREPORTED, value: 'v1' } })).status,
			'an UNREPORTED fact must not carry a value'
		).not.toBe('ACCEPTED');
	});

	// Split for the same reason as the chain pair above.
	it('REFUSES an assurance try that names no policy', () => {
		expect(record(wellFormed({ assurancePolicyId: undefined })).status).not.toBe('ACCEPTED');
	});

	it('REFUSES a non-assurance try that names a policy', () => {
		expect(
			record(wellFormed({ plane: 'AUTHORING', invokerId: 'authoring-agent' })).status,
			'assurancePolicyId is meaningful only on the assurance plane'
		).not.toBe('ACCEPTED');
	});
});
