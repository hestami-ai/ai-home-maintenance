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
// ⭐ R11 — a SECOND aggregate id, so the two ACCEPTED controls below do not collide with the ACCEPTED
// record the first test in this file writes. A DUPLICATE status is not ACCEPTED, and a control that reported
// DUPLICATE would fail for a reason that has nothing to do with what it claims to prove.
const MEX2 = 'mex_01ARZ3NDEKTSV4RRFFQ69G0302';
const SUBJECT = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5A80';

/** The one region a separated exchange owes — REG-D-057. Sizes are the real ones from REG-F-345's drive. */
const CUT = {
	role: 'MODEL_ANSWER' as const,
	reason: 'The answer span was cut out of the retained reasoning at retention (Guide §9.7).',
	byteSize: 7,
	byteOffset: 19
};

const STORED = {
	status: 'STORED',
	storageProvider: 'jpwb:in-memory',
	storageKey: 'tnt-local/RETAINED_BY_PARTICIPATION/de09be4f',
	contentHash: 'sha256:de09be4f',
	byteSize: 2048,
	purgeability: 'RETAINED_BY_PARTICIPATION',
	contentDurability: 'PROCESS_LOCAL'
};

/** The arrangement the §9.7 split actually produces: both spans stored, the blob NOT, and the cut declared. */
const SEPARATED = {
	answerSpanRef: STORED,
	volunteeredReasoningRef: STORED,
	omittedRegions: [CUT]
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
		// ⭐ R11 — the two fields this record now owes. ⚠ THE WELL-FORMED FIXTURE IS AN ASSURANCE TRY, so the
		// honest derivation is `NO_WORK_PRODUCT_EXPECTED`: a reviewer's answer is a judgement, not a deliverable.
		// Anything else here would make every unrelated test in this file assert against a fabricated execution.
		workProductDerivation: {
			relation: 'NO_WORK_PRODUCT_EXPECTED',
			reason: 'A Reasoning Review try: its answer is a judgement about someone else’s work.'
		},
		observedToolCalls: {
			observation: 'NOT_OBSERVABLE',
			reason: 'agy --print returns an answer string and reports nothing about tool calls.'
		},
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
		// ⚠ THIS FIXTURE GAINED `omittedRegions` AND THAT IS THE POINT OF THE NEXT TEST, not an accommodation:
		// under REG-D-057 a separation is only lawful if it says WHERE it cut, so "both spans stored" is no
		// longer a complete arrangement by itself.
		const r = record(wellFormed({ ...SEPARATED }));
		expect(r.status, 'the separated spans are exactly what REG-D-056 permits').toBe('ACCEPTED');
	});

	it('⛔ REFUSES a separation that does not say WHERE it cut — REG-D-057', () => {
		// The answer was cut out of the retained reasoning. Without the region's byteOffset the two stored
		// objects reassemble in two different orders, and the reply that actually arrived is unrecoverable —
		// REG-F-345 drove exactly that, on a policy whose subject is HOW the reviewer reasoned.
		//
		// THE MUTANT: delete this guard. Nothing else reddens — which is the whole hazard. A record missing
		// its region still satisfies every other rule here and still LOOKS complete; the loss is only visible
		// to someone who tries to rebuild the reply and finds two candidates.
		const r = record(wellFormed({ ...SEPARATED, omittedRegions: [] }));
		expect(r.status, 'a separation with no declared cut must not be accepted').not.toBe('ACCEPTED');
		expect(JSON.stringify(r), 'the refusal must name what is missing').toMatch(
			/MODEL_ANSWER omitted region/
		);
		expect(emitted(), 'and no event may be written for a refused command').toHaveLength(0);
	});

	it('⛔ REFUSES a MODEL_ANSWER region whose byteSize is zero — a fabricated measurement', () => {
		// The shape this replaces: the mapper used to hardcode `byteSize: 0` because the app-local region
		// carried no size (REG-F-345). It was harmless only while nothing produced a region. ⭑ A zero that
		// READS as a measurement is worse than an absent field, because a reader cannot discount it.
		//
		// THE MUTANT: drop the byteSize check and keep the cardinality one. The test above still passes.
		const r = record(
			wellFormed({ ...SEPARATED, omittedRegions: [{ ...CUT, byteSize: 0 }] })
		);
		expect(r.status).not.toBe('ACCEPTED');
		expect(JSON.stringify(r), 'the refusal must quote the value it refused').toMatch(/byteSize 0/);
	});

	it('CONTROL — an UNSEPARATED exchange owes no region, so the rule is about separation', () => {
		// Without this, the two refusals above could not be told apart from "every exchange must declare a
		// MODEL_ANSWER region", which would refuse the clean-reply case REG-D-056 explicitly permits.
		const r = record(wellFormed({ rawOutputBeforeCoercionRef: STORED, answerSpanRef: STORED }));
		expect(r.status, 'nothing was cut out, so nothing is owed').toBe('ACCEPTED');
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

	// ── ⭐⭐ R11 (a) — THE WORK-PRODUCT DERIVATION, AT THE BOUNDARY ─────────────────────────────────────────
	//
	// ⭐ THE POINT OF MAKING IT A TYPED FIELD IS THAT IT CAN BE REFUSED. Until `R11` the relation lived in
	// `parseOutcome.detail`'s free text, where a declaration could be absent, malformed, duplicated or
	// contradicted by the sentence around it and nothing would notice — a typed record's central relationship
	// hidden in a string, which is `PER-9`'s own *"hide core relationships in one generic JSON document"* with a
	// smaller container. These are the refusals the move bought.
	const ADDRESS = {
		storageProvider: 'jpwb:sqlite',
		storageKey: 'tnt-local/RETAINED_BY_PARTICIPATION/aa11',
		contentHash: 'sha256:aa11',
		byteSize: 64
	};

	it('⭑ CONTROL — a RETAINING derivation with its whole address is ACCEPTED', () => {
		// ⭐ THE CONTROL NEEDS ITS OWN MUTANT. Without it, "the handler refuses a bad derivation" is satisfied by
		// a handler that refuses EVERY derivation — `MU-FRESH-18-B`'s recorded shape. THE MUTANT: make the
		// `retains` branch refuse unconditionally; this reddens and every refusal below stays green.
		expect(
			record(
				wellFormed({
					exchangeId: MEX2,
					plane: 'EXECUTION',
					invokerId: 'execution.model-invocation:pwut-1',
					assurancePolicyId: undefined,
					workProductDerivation: { relation: 'ENVELOPE_FIELD', sourceField: 'workProduct', ...ADDRESS }
				})
			).status,
			'an execution step that retained its work product and named the whole address is exactly what R11 admits'
		).toBe('ACCEPTED');
	});

	it('⛔ REFUSES a RETAINING derivation that omits part of the address', () => {
		// A reference that cannot be verified is a reference that cannot be challenged. THE MUTANT: compare
		// `declared.length > 0` instead of `!== DERIVATION_ADDRESS.length` — a key alone would then satisfy it,
		// and a reader could no longer re-hash the bytes and refuse a record that lied about them.
		expect(
			record(
				wellFormed({
					workProductDerivation: {
						relation: 'WHOLE_ANSWER_SPAN',
						storageKey: ADDRESS.storageKey,
						storageProvider: ADDRESS.storageProvider
					}
				})
			).status
		).not.toBe('ACCEPTED');
	});

	it('⛔ REFUSES an ABSENT derivation that says nothing about why, and one that describes bytes it disclaims', () => {
		// The two directions of the same rule. `PER-9` permits a DISCLOSED absence and forbids a silent one.
		expect(
			record(wellFormed({ workProductDerivation: { relation: 'NO_WORK_PRODUCT_EXPECTED' } })).status,
			'an absence with no reason is the silent omission PER-9 calls illegal'
		).not.toBe('ACCEPTED');
		expect(
			record(
				wellFormed({
					workProductDerivation: {
						relation: 'EXPECTED_BUT_UNRETAINED',
						reason: 'the call failed',
						storageKey: ADDRESS.storageKey
					}
				})
			).status,
			'a derivation cannot both disclaim a retained work product and address one'
		).not.toBe('ACCEPTED');
	});

	it('⛔ REFUSES an ENVELOPE_FIELD that names no field, and any other arm that names one', () => {
		// ⭐ `sourceField` IS NARROWER THAN THE ADDRESS, AND CONFLATING THEM WAS THE OLD FRAGMENT'S DEFECT: it
		// wrote `field: 'workProduct'` on BOTH retaining paths, including the one where no envelope was honoured
		// and there IS no field. The typed form makes the false half unrepresentable.
		expect(
			record(wellFormed({ workProductDerivation: { relation: 'ENVELOPE_FIELD', ...ADDRESS } })).status,
			'a derivation giving an address but not what was taken out cannot be re-performed'
		).not.toBe('ACCEPTED');
		expect(
			record(
				wellFormed({
					workProductDerivation: { relation: 'WHOLE_ANSWER_SPAN', sourceField: 'workProduct', ...ADDRESS }
				})
			).status,
			'the envelope was not honoured, so naming a field asserts a structure the answer did not have'
		).not.toBe('ACCEPTED');
	});

	// ── ⭐⭐ R11 (b) — THE OBSERVED TOOL-CALL RECORD, AT THE BOUNDARY ───────────────────────────────────────
	//
	// ⛔ §22.1 MAKES MODEL OUTPUT UNTRUSTED EXTERNAL INPUT. The producer applies the retention ruling
	// (`governedToolCallReport`); this is the boundary refusing a payload that did not — because a rule enforced
	// only at its producer is a rule one new producer away from silence.
	const OBSERVED_CALL = {
		ordinal: 1,
		nameProvenance: 'MINTED_BY_HOST',
		toolName: 'run_command',
		outcome: 'COMPLETED'
	};

	it('⭑ CONTROL — a well-formed OBSERVED report is ACCEPTED', () => {
		// Its own mutant: refuse the OBSERVED arm outright. Every refusal below stays green and this reddens.
		expect(
			record(
				wellFormed({
					exchangeId: MEX2,
					observedToolCalls: {
						observation: 'OBSERVED',
						calls: [OBSERVED_CALL],
						observedCount: 1,
						recordedLimit: 32
					}
				})
			).status
		).toBe('ACCEPTED');
	});

	it('⛔ REFUSES an OBSERVED report that names no calls — that is NONE_OBSERVED wearing the wrong member', () => {
		expect(
			record(
				wellFormed({
					observedToolCalls: { observation: 'OBSERVED', calls: [], observedCount: 0, recordedLimit: 32 }
				})
			).status
		).not.toBe('ACCEPTED');
	});

	it('⛔ REFUSES a NOT_MINTED call that carries a toolName — the R11 retention ruling, at the boundary', () => {
		// ⭐⭐ THE PERMANENT-RECORD LIMB. `R10` confirmed a MODEL_EXCHANGE is PER-8 participating material, so
		// nothing ever deletes it, and `PER-9` makes record-plane omission illegal, so nothing can redact it
		// either. An unminted tool name is an arbitrary MODEL-CHOSEN string — the class this programme twice
		// found carrying a host absolute path and an operating username into a governed refusal.
		//
		// THE MUTANT: delete this conjunct in the handler. `governedToolCallReport` still drops the name, so the
		// whole app-side suite stays green — and a SECOND producer, or a direct dispatch, writes the string
		// straight through. That is precisely why the rule lives at the boundary as well as at the producer.
		//
		// ⛔ THE VECTOR CHANGED FROM `C:\Users\someone\.aws\credentials` TO A SHAPE-LEGAL NAME, AND THAT CHANGE
		// IS THE POINT. Since the R11 review, `toolName` is bound by `RecordPlaneNameSchema`, so a path is
		// refused by the CONTRACT before this handler ever runs — the old arrangement tripped BOTH guards and
		// therefore proved NEITHER, a trap this repository has shipped before. `read_file` passes the schema
		// and can only be refused by the conjunct this test names. ⭑ The path vector is not lost: it is driven,
		// on the arm it actually belongs to, in the `W2` block at the end of this file.
		const refused = record(
			wellFormed({
				observedToolCalls: {
					observation: 'OBSERVED',
					calls: [
						{ ordinal: 1, nameProvenance: 'NOT_MINTED', toolName: 'read_file', outcome: 'REFUSED' }
					],
					observedCount: 1,
					recordedLimit: 32
				}
			})
		);
		expect(
			refused.status,
			'an unminted name is the model’s word, and this record is permanent and unredactable'
		).not.toBe('ACCEPTED');
		// ⭑ THE MESSAGE, NOT THE STATUS, IS WHAT TELLS THE TWO GUARDS APART: `.not.toBe('ACCEPTED')` alone would
		// pass just as well if the schema had refused the value for its shape.
		expect(JSON.stringify(refused), 'and it must be the PROVENANCE refusal').toMatch(
			/is NOT_MINTED and must not carry a toolName/
		);
	});

	it('⛔ REFUSES a truncated OBSERVED report that hides its own truncation', () => {
		// `REG-F-345`'s shape: without a declared bound and a declared total, a truncated record reads exactly
		// like a complete one. Both directions are refused.
		expect(
			record(
				wellFormed({
					observedToolCalls: { observation: 'OBSERVED', calls: [OBSERVED_CALL] }
				})
			).status,
			'an OBSERVED report must declare the bound it applied and the total it saw'
		).not.toBe('ACCEPTED');
		expect(
			record(
				wellFormed({
					observedToolCalls: {
						observation: 'OBSERVED',
						calls: [OBSERVED_CALL],
						observedCount: 0,
						recordedLimit: 32
					}
				})
			).status,
			'the total can only equal or exceed what was kept'
		).not.toBe('ACCEPTED');
	});

	it('⛔ REFUSES a RETAINING derivation that carries a reason — a reason explains an ABSENCE', () => {
		// The mirror of the rule two tests up, and it matters because a reason beside a present address is how a
		// record acquires a narrative that contradicts its own data. Both directions are refused so the
		// discriminator means exactly one thing.
		expect(
			record(
				wellFormed({
					workProductDerivation: {
						relation: 'WHOLE_ANSWER_SPAN',
						reason: 'the call failed',
						...ADDRESS
					}
				})
			).status
		).not.toBe('ACCEPTED');
	});

	it('⛔ REFUSES an OBSERVED report that also carries a reason', () => {
		// Same rule, one field over: `reason` explains why there is nothing to report, and this arm reports
		// something. A record that both names calls and explains their absence says two incompatible things.
		expect(
			record(
				wellFormed({
					observedToolCalls: {
						observation: 'OBSERVED',
						calls: [OBSERVED_CALL],
						observedCount: 1,
						recordedLimit: 32,
						reason: 'none observed'
					}
				})
			).status
		).not.toBe('ACCEPTED');
	});

	it('⛔ REFUSES an OBSERVED report whose declared bound is not the one applied', () => {
		// ⭐ THE DECLARED BOUND MUST DESCRIBE THIS RECORD. A list longer than the limit it claims to have applied
		// is a record describing a different run — and `recordedLimit` is the only thing that tells a reader a
		// truncation happened at all, so a false one is worse than none.
		expect(
			record(
				wellFormed({
					observedToolCalls: {
						observation: 'OBSERVED',
						calls: [OBSERVED_CALL, { ...OBSERVED_CALL, ordinal: 2 }],
						observedCount: 2,
						recordedLimit: 1
					}
				})
			).status
		).not.toBe('ACCEPTED');
	});

	it('⛔ REFUSES calls whose ordinals are not 1-based observation order', () => {
		// Without ordinals a BOUNDED list cannot say which calls it kept: a reader cannot tell a truncated head
		// from a sampled middle, and the two are different accounts of what the model did.
		expect(
			record(
				wellFormed({
					observedToolCalls: {
						observation: 'OBSERVED',
						calls: [{ ...OBSERVED_CALL, ordinal: 4 }],
						observedCount: 1,
						recordedLimit: 32
					}
				})
			).status
		).not.toBe('ACCEPTED');
	});

	it('⛔ REFUSES a MINTED_BY_HOST call that names no tool — the provenance is the warrant for the name', () => {
		// ⭐ THE COMPLEMENT OF THE RETENTION RULING. `MINTED_BY_HOST` is the ONLY reason a name may be recorded
		// at all; a call claiming that provenance and then naming nothing has spent the warrant and produced
		// nothing with it, which makes the provenance field unfalsifiable.
		expect(
			record(
				wellFormed({
					observedToolCalls: {
						observation: 'OBSERVED',
						calls: [{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', outcome: 'COMPLETED' }],
						observedCount: 1,
						recordedLimit: 32
					}
				})
			).status
		).not.toBe('ACCEPTED');
	});

	it('⛔ REFUSES a NOT_OBSERVABLE report that describes calls, and one that says nothing about why', () => {
		// The pair that keeps NONE_OBSERVED and NOT_OBSERVABLE from collapsing into each other.
		expect(
			record(
				wellFormed({
					observedToolCalls: { observation: 'NOT_OBSERVABLE', reason: 'no surface', calls: [OBSERVED_CALL] }
				})
			).status,
			'a report cannot both say it has nothing to name and then describe it'
		).not.toBe('ACCEPTED');
		expect(
			record(wellFormed({ observedToolCalls: { observation: 'NONE_OBSERVED' } })).status,
			'NONE_OBSERVED is a measurement and must say what surface went unused'
		).not.toBe('ACCEPTED');
	});
	// ── ⭐⭐ R11 INDEPENDENT REVIEW — W1, W2, W3: THREE STATED GUARANTEES THAT READ STRONGER THAN WHAT WAS
	//    ENFORCED. Each was DRIVEN FALSE against the landed record, and every vector below is the REVIEWER'S
	//    OWN — a repaired guard re-tested with a gentler input than the one that broke it proves nothing about
	//    the break.
	//
	// ⛔ THESE REFUSALS COME FROM THE CONTRACT, NOT FROM THIS HANDLER, and they are driven THROUGH `dispatch`
	//    on purpose: a unit test of the schema proves the predicate, and only this proves the predicate sits in
	//    the path a caller actually takes. `record-plane-bounds.test.ts` holds the other half.
	const HOST_PATH = 'C:\\Users\\mchen\\AppData\\Local\\Temp\\claude\\secret';
	const USERNAME_PATH = '/home/mchen/.ssh/id_rsa';
	const CREDENTIALS = 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
	const NUL_BEARING = `run${String.fromCharCode(0)}command`;
	const BLOB_200KB = 'x'.repeat(200 * 1024);

	/** One OBSERVED report naming a single MINTED call spelled `name`. */
	const minted = (name: string) => ({
		observation: 'OBSERVED',
		calls: [{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: name, outcome: 'COMPLETED' }],
		observedCount: 1,
		recordedLimit: 32
	});

	it.each([
		['a host absolute path', HOST_PATH],
		['a username-bearing path', USERNAME_PATH],
		['a credentials-shaped string', CREDENTIALS],
		['a NUL byte', NUL_BEARING],
		['a 200KB blob', BLOB_200KB]
	])('⛔ W2 — REFUSES %s as a MINTED_BY_HOST toolName', (_label, value) => {
		// ⭐⭐ THE CLAIM THIS REPLACES, VERBATIM FROM R11'S COMMIT: *"a minted name is drawn from a closed set the
		// HOST authored and cannot carry model-chosen content."* ⛔ ALL FIVE OF THESE WERE ACCEPTED under it,
		// because `nameProvenance` is a DECLARATION and the boundary only checked that the declaration and the
		// field agreed. What is checked now is the name's SHAPE, and a shape is not a caller's honesty.
		//
		// THE MUTANT: drop `"bound": "RECORD_PLANE_NAME"` from `toolName` in `vocab/m1-object-fields.json` and
		// regenerate. ⚠ `gen:check` stays GREEN — vocab and generated file still agree — and so does every other
		// test in this file, because each of these five satisfies every relational rule the handler applies.
		// These five cases are the only thing between that edit and a permanent record holding a host path.
		const r = record(wellFormed({ observedToolCalls: minted(value) }));
		expect(r.status, 'a permanent, unredactable record may not hold this').not.toBe('ACCEPTED');
		// ⭑ THE MESSAGE, SO THE REFUSAL IS ATTRIBUTABLE. Four of these five fit inside 64 characters and the
		// fifth does not, so the two limbs of the bound refuse different members of the same list — asserting
		// only the status would let either limb cover for the other's removal.
		expect(JSON.stringify(r), 'refused for its SHAPE, by the record plane’s name bound').toMatch(
			/recorded on the permanent record plane (must be spelled as a name|is bounded at 64 characters)/
		);
		expect(emitted(), 'and no event may be written for a refused command').toHaveLength(0);
	});

	it('⭑ W2 CONTROL — a name that IS a name is still ACCEPTED, so the bound is on the shape and not on names', () => {
		// ⭐ THE CONTROL NEEDS ITS OWN MUTANT, or the five refusals above are satisfied by a contract that
		// refuses every `toolName` — which would make `MINTED_BY_HOST` unreachable and the whole field dead.
		// THE MUTANT: tighten `RECORD_PLANE_NAME_PATTERN` so no real name matches; this reddens and all five
		// refusals stay green.
		expect(
			record(wellFormed({ exchangeId: MEX2, observedToolCalls: minted('run_command') })).status
		).toBe('ACCEPTED');
	});

	it('⛔ W1 — REFUSES 64 calls that declare their own recordedLimit of 64', () => {
		// ⭐⭐ R11 SAID *"BOUNDED: `calls` is capped at 32"*. IT WAS NOT: the cap lived in `governedToolCallReport`
		// and the boundary compared the list against `recordedLimit` — a number the CALLER writes. So 64 calls
		// declaring 64 were ACCEPTED and only the internally inconsistent case (64 declaring 32) was refused,
		// which means the contract permitted whatever the producer chose to permit itself.
		//
		// ⛔ TWO GUARDS NOW REFUSE THIS ARRANGEMENT, AND A BARE `.not.toBe('ACCEPTED')` WOULD PROVE NEITHER. The
		// CONTRACT caps `calls` at 32, and the handler separately refuses a `recordedLimit` above the enforced
		// bound — either one alone turns this away. The MESSAGE is therefore the assertion: the schema runs
		// first, so a record that reaches this arrangement must be refused by the SHAPE, and if the contract's
		// bound were removed the handler would still refuse it and a status-only test would never notice.
		//
		// THE MUTANT: drop `"bound": "OBSERVED_TOOL_CALL_LIST"` from `calls` in the vocab and regenerate. The
		// whole app-side suite stays green — `governedToolCallReport` still slices at 32 — and this reddens on
		// the message while the status stays refused.
		const calls = Array.from({ length: 64 }, (_unused, i) => ({
			ordinal: i + 1,
			nameProvenance: 'NOT_MINTED',
			outcome: 'COMPLETED'
		}));
		const r = record(
			wellFormed({
				observedToolCalls: { observation: 'OBSERVED', calls, observedCount: 64, recordedLimit: 64 }
			})
		);
		expect(r.status, 'an untrusted party may not size a permanent record').not.toBe('ACCEPTED');
		expect(JSON.stringify(r), 'and the CONTRACT must be what refused it').toMatch(
			/bounded at 32 entries by the CONTRACT/
		);
		expect(emitted()).toHaveLength(0);
	});

	it('⛔ W1 — REFUSES a SHORT list that declares a recordedLimit above the enforced one', () => {
		// ⭑ THE OTHER HALF, AND THE SCHEMA DOES NOT REACH IT. Two calls declaring a limit of 64 satisfies
		// `calls.length <= recordedLimit` and never touches the array bound — yet `recordedLimit` is the one
		// number a reader uses to decide whether the list was truncated, so a value above the enforced cap
		// describes a record this plane cannot hold. THE MUTANT: delete the `> OBSERVED_TOOL_CALL_LIMIT`
		// refusal in the handler; the test above still passes, because the schema catches the long list.
		const r = record(
			wellFormed({
				observedToolCalls: {
					observation: 'OBSERVED',
					calls: [
						{ ordinal: 1, nameProvenance: 'NOT_MINTED', outcome: 'COMPLETED' },
						{ ordinal: 2, nameProvenance: 'NOT_MINTED', outcome: 'FAILED' }
					],
					observedCount: 2,
					recordedLimit: 64
				}
			})
		);
		expect(r.status).not.toBe('ACCEPTED');
		expect(JSON.stringify(r), 'and the refusal must quote the bound it enforces').toMatch(
			/above the 32 this contract enforces/
		);
	});

	it('⭑ W1 CONTROL — exactly 32 calls declaring 32 is ACCEPTED, so the bound is 32 and not "refuse a list"', () => {
		// THE MUTANT: set the bound to 1. Both W1 refusals stay green and this reddens — which is the only way
		// to tell "bounded at 32" apart from "bounded at something".
		const calls = Array.from({ length: 32 }, (_unused, i) => ({
			ordinal: i + 1,
			nameProvenance: 'NOT_MINTED',
			outcome: 'COMPLETED'
		}));
		expect(
			record(
				wellFormed({
					exchangeId: MEX2,
					observedToolCalls: {
						observation: 'OBSERVED',
						calls,
						observedCount: 41,
						recordedLimit: 32
					}
				})
			).status,
			'a producer that truncated at the contract’s bound and said so is exactly what R11 admits'
		).toBe('ACCEPTED');
	});

	it.each([
		['a host absolute path', HOST_PATH],
		['a credentials-shaped string', CREDENTIALS],
		['a NUL byte', NUL_BEARING],
		['a 200KB blob', BLOB_200KB]
	])('⛔ W3 — REFUSES %s as a workProductDerivation sourceField', (_label, value) => {
		// ⭐ `sourceField` NAMES A FIELD OF AN ENVELOPE, and a JSON object's field name IS a name. The vocab used
		// to argue the field was safe because it "is NOT model-chosen" — a claim about the PRODUCER, which is
		// the same error as W2 one helper over. ⚠ A CLOSED SET WAS CONSIDERED: the only value any producer
		// emits is `workProduct`. It was declined because the envelope belongs to the HOST's execution contract,
		// a different host authors a different one, and PER-2 would make one host's wrapper permanent.
		const r = record(
			wellFormed({
				plane: 'EXECUTION',
				invokerId: 'execution.model-invocation:pwut-1',
				assurancePolicyId: undefined,
				workProductDerivation: { relation: 'ENVELOPE_FIELD', sourceField: value, ...ADDRESS }
			})
		);
		expect(r.status).not.toBe('ACCEPTED');
		expect(emitted()).toHaveLength(0);
	});

	it('⭑ W3 CONTROL — `workProduct`, the one sourceField any producer emits, is still ACCEPTED', () => {
		expect(
			record(
				wellFormed({
					exchangeId: MEX2,
					plane: 'EXECUTION',
					invokerId: 'execution.model-invocation:pwut-1',
					assurancePolicyId: undefined,
					workProductDerivation: {
						relation: 'ENVELOPE_FIELD',
						sourceField: 'workProduct',
						...ADDRESS
					}
				})
			).status
		).toBe('ACCEPTED');
	});

	it.each([
		['a NUL byte', NUL_BEARING],
		['a 200KB blob', BLOB_200KB]
	])('⛔ W3 — REFUSES %s in either free-text reason', (_label, value) => {
		// ⭐ THE WHOLE POINT OF HAVING NO `arguments` FIELD was that untrusted content cannot reach a plane with
		// no lawful way to remove it (PER-9: the content plane has redaction, the record plane does not). Three
		// free-text strings re-opened that door, and all four reviewer vectors landed in each of them.
		expect(
			record(wellFormed({ observedToolCalls: { observation: 'NOT_OBSERVABLE', reason: value } }))
				.status,
			'observedToolCalls.reason'
		).not.toBe('ACCEPTED');
		expect(
			record(
				wellFormed({
					workProductDerivation: { relation: 'EXPECTED_BUT_UNRETAINED', reason: value }
				})
			).status,
			'workProductDerivation.reason'
		).not.toBe('ACCEPTED');
	});

	it('⚠ W3 DISCLOSED — a host path IS still accepted in a reason, and that is the bound’s stated limit', () => {
		// ⛔ THIS PINS A WEAKNESS ON PURPOSE, exactly as `P2B-ar` pinned Phase 2b's own `W1`. A `reason` is
		// bounded in LENGTH and refuses CONTROL CHARACTERS; it is NOT checked for paths or secrets, because a
		// predicate deciding whether prose "looks like a path" is a normaliser over an arbitrary string — the
		// shape this programme already refused — and it would reject legitimate prose (`pi-executor`'s live
		// reason quotes `noTools:'builtin'`).
		//
		// ⭑ WHAT WARRANTS THE CONTENT is that its author is the HOST: every producer of a `reason` in this
		// repository writes a string literal authored here and none interpolates model output. That is a
		// PRODUCER property, this boundary does not verify it, and this case exists so that whoever strengthens
		// the bound must come here and retire the disclosure rather than leave it standing and stale.
		expect(
			record(
				wellFormed({ observedToolCalls: { observation: 'NOT_OBSERVABLE', reason: HOST_PATH } })
			).status
		).toBe('ACCEPTED');
	});
});
