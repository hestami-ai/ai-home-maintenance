// MXR-03 / MXR-04 — the two properties REG-D-055 actually rests on, proven rather than asserted.
//
// The ruling licensed a NEW Professional Work Object on two grounds: that the record is DURABLE (PER-9 requires
// "its own durable exchange record"), and that catalogueing it leaks nothing, because PER-12's "never projected"
// names the BYTES and this object holds only references. Both were argued from reading. Neither was driven.
// A ruling resting on an unproven property is the hollow governed layer with a signature on it.
import { createEngine } from './engine.js';
import { listGovernedObjects } from './queries.js';
import { ModelExchangeSchema, ProfessionalWorkObjectTypeSchema, OBJECT_SCHEMAS } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const TS = '2026-09-03T10:00:00Z';
const MEX = 'mex_01ARZ3NDEKTSV4RRFFQ69G0301';
const SUBJECT = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5A80';

/** The four fields the catalog will render as a row's label (queries.ts `governedRow`). */
const LABEL_FIELDS = ['title', 'name', 'displayName', 'selectedOption'] as const;

const pending = (reason: string) => ({ status: 'PENDING_CONTENT_PLANE', reason });

const PAYLOAD = {
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
	resolvedModel: { availability: 'REPORTED', evidence: 'HOST_CONFIGURED', value: 'gemini-2.5-pro' },
	resolvedModelVersion: {
		availability: 'UNREPORTED',
		evidence: 'NONE',
		rationale: 'agy --print reports no model version on stdout.'
	},
	materializedInputRef: {
		status: 'STORED',
		storageProvider: 'jpwb:in-memory',
		storageKey: 'tnt-local/RETAINED_BY_PARTICIPATION/de09be4f',
		contentHash: 'sha256:de09be4f',
		byteSize: 2048,
		purgeability: 'RETAINED_BY_PARTICIPATION',
		contentDurability: 'PROCESS_LOCAL'
	},
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
	respondedAt: '2026-09-03T10:00:04Z'
};

function dispatchInto(store: SqliteStorageAdapter) {
	let seq = 0;
	const engine = createEngine({
		ontology,
		authenticate: testAuthenticator(),
		store,
		now: () => TS,
		newEventId: () => `e${++seq}`
	}).as(TEST_CRED.human);
	return engine.dispatch({
		commandId: 'c-1',
		commandType: 'RecordModelExchange',
		commandSchemaVersion: 1,
		targetAggregateType: 'MODEL_EXCHANGE',
		targetAggregateId: MEX,
		issuedAt: TS,
		correlationId: 'corr',
		idempotencyKey: 'k-1',
		payload: PAYLOAD
	});
}

describe('MXR-03 — the exchange record SURVIVES the process', () => {
	it('is readable byte-identical from a REOPENED store', () => {
		// ⚠ A FILE, NOT `:memory:`, AND THAT IS THE WHOLE TEST. PER-9 requires a DURABLE record; an in-memory
		// store satisfies every other assertion in this suite while satisfying none of that word. The design
		// tier flagged this as measure-do-not-assume, so the store is closed and reopened rather than reused.
		const file = join(mkdtempSync(join(tmpdir(), 'mxr-')), 'store.sqlite');

		const first = new SqliteStorageAdapter({ filename: file, now: () => TS });
		expect(dispatchInto(first).status, 'the command must be ACCEPTED').toBe('ACCEPTED');
		const before = first.readAllEvents().filter((e) => e.eventType === 'ModelExchangeRecorded');
		expect(before, 'exactly one event was written').toHaveLength(1);

		// A SECOND adapter over the SAME file — a restart, as far as the record is concerned.
		const reopened = new SqliteStorageAdapter({ filename: file, now: () => TS });
		const after = reopened.readAllEvents().filter((e) => e.eventType === 'ModelExchangeRecorded');

		// THE MUTANT, DRIVEN: make the FIRST store in-memory and durability becomes a fiction — this test
		// reddens and nothing else in the package does, which is why durability gets its own case rather than a
		// clause inside another.
		expect(after, 'the event survives the process').toHaveLength(1);
		// ⚠ THE FIDELITY LIMB IS NOT INDEPENDENTLY ISOLABLE, AND THAT IS RECORDED RATHER THAN GLOSSED. Presence
		// is already caught by the assertion above, so this one only earns its place against LOSSY persistence —
		// and no single-victim mutant can produce that, because the payload serialization is shared by every
		// event type, so breaking it reddens the whole suite and proves nothing about this test. Kept because
		// the risk is real and the cost is nil; NOT counted as a proven guard.
		expect(after[0]!.payload, 'byte-identical, not merely present').toEqual(before[0]!.payload);
		expect(reopened.loadObject(MEX)?.state, 'and so does the materialized state').toEqual(
			first.loadObject(MEX)?.state
		);
	});
});

describe('MXR-04 — catalogueing the record leaks no model bytes', () => {
	it('the record IS catalogued, and its label is its own id', () => {
		const store = new SqliteStorageAdapter({ now: () => TS });
		expect(dispatchInto(store).status).toBe('ACCEPTED');
		const engine = createEngine({
			ontology,
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => 'e-x'
		});

		const rows = listGovernedObjects(engine, { kind: 'WORKSPACE' });
		const row = rows.find((r) => r.id === MEX);

		// ⭑ IT APPEARS, AND REG-D-055 SAYS THAT IS CORRECT. PER-12's "never projected" governs the BYTES; PER-9
		// requires the record be nameable "so its conclusion can be reproduced and challenged". A record that
		// could not be named would defeat PER-9 to satisfy a rule that was never about it.
		expect(row, 'the exchange record is catalogued').toBeDefined();
		// THE MUTANT: give the object a `title`/`name`/`displayName`. The label would then render model-adjacent
		// text into the Decision Center subject picker, which is the leak REG-D-053 measured.
		expect(row!.label, 'the label is the minted id and nothing else').toBe(MEX);
		expect(row!.revision, 'born terminal').toBe(0);
	});

	it('no label field exists on the object AT ALL — the property is structural, not incidental', () => {
		// The test above would still pass if a label field existed but happened to be empty. This one holds the
		// STRUCTURE: the schema declares none of the four, so no value can ever reach the picker.
		const shape = Object.keys(ModelExchangeSchema.shape);
		for (const f of LABEL_FIELDS)
			expect(shape, `MODEL_EXCHANGE must not declare ${f} — governedRow would render it`).not.toContain(f);
	});

	it('POSITIVE CONTROL — the four label fields are real, and other types DO declare them', () => {
		// Without this, the assertion above passes if `LABEL_FIELDS` were misspelled or if governedRow had
		// stopped reading them: an absence gate whose instrument is broken reports the same clean result as one
		// whose subject is clean. This is the failure mode REG-F-326 shipped.
		const declaring = ProfessionalWorkObjectTypeSchema.options.filter((t) => {
			const entry = (OBJECT_SCHEMAS as Record<string, { schema: { shape: Record<string, unknown> } }>)[t];
			return entry ? LABEL_FIELDS.some((f) => f in entry.schema.shape) : false;
		});
		expect(declaring.length, 'other object types do declare label fields').toBeGreaterThan(0);
		expect(declaring, 'and MODEL_EXCHANGE is not among them').not.toContain('MODEL_EXCHANGE');
	});
});
