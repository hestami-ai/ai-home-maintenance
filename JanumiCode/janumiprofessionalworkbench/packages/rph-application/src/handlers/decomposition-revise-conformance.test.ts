// JPWB-SPEC-001-DR-002 F-I — `ReviseDecomposition` asserts nothing it does not perform.
//
// THE GREY AREA THIS REMOVES. `ReviseDecompositionPayloadSchema` (messages.ts:406-411) declares
// `childWorkUnitIds`, `obligationAllocations` and `constraintPropagations`. Those are precisely the carriers for
// JPWB-DOC-003's revision obligations — DEC-3 SCOPE "governs every decomposition, REVISION, and delegation"
// ("No mandatory obligation silently disappears"), DEC-4 SCOPE "…semantic revision…", DEC-2 "Revising a
// decomposition is legal, changes the parent's semantic version, and triggers impact analysis". DOC-003 is
// OPERATIVE (REG-D-010).
//
// The handler is `(ctx, command)` — no payload parameter, no `mutate`. It performs ONE of DEC-2's three
// requirements (the version bump). Runtime-verified before this file existed: a revise carrying all four fields
// returned ACCEPTED with the aggregate's childWorkUnitIds unchanged and both allocation arrays still [].
//
// THE CAPABILITY IS STILL NOT IMPLEMENTED, AND IT IS SCHEDULED NOWHERE. The kernel exists —
// `validateObligationConservation` / `validateConstraintPropagation` in `@janumipwb/rph-domain`, adversarially
// reviewed under M9, and already called by `validateDecomposition` (decomposition.ts:210-211). The revise path
// is a second call site nobody wired; the tracker defers it M9 → M10/M11 → M11/M13 → M13 → "deferred", every
// station ✅. Nor is a ratification evidently required: DOC-003 is OPERATIVE and already binds revision. See
// REG-005 REG-F-006 — an earlier wording called this "a decomposition-model decision awaiting ratification",
// which named no plan item and invented a blocker.
//
// What is NOT deferred is asserting the capability while not performing it, which is CON-000 B7. So:
//
//   1. a revise carrying fields the handler cannot honour is REFUSED, naming why;
//   2. the emitted event conforms to its OWN declared payload schema.
//
// Neither needs canon's permission: refusing to do what you do not do is not a model change, and making an event
// match the shape it already declares is not one either.
//
// WHY (2) IS PINNED HERE RATHER THAN BY THE ENGINE'S OWN GATE. `DecompositionRevised` is absent from
// `RATIFIED_EVENT_PAYLOADS`, so the (d2) event-conformance gate never runs for it — `gen-messages.ts:226-229`
// skips any vocab entry annotated UNRATIFIED-AUTHORED, and this one is. Removing that annotation would be a
// RATIFICATION CLAIM and is the sponsor's to make; asserting the shape in a test achieves the same guarantee and
// claims nothing.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { DecompositionRevisedPayloadSchema } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-29T00:00:00Z';

const INT = 'int_01ARZ3NDEKTSV4RRFFQ69G6W00';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G6W31';
const CHILD_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G6W3A';
const CHILD_B = 'pwu_01ARZ3NDEKTSV4RRFFQ69G6W3B';
const CHILD_C = 'pwu_01ARZ3NDEKTSV4RRFFQ69G6W3C';
const DCP = 'dcp_01ARZ3NDEKTSV4RRFFQ69G6W32';

function harness() {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
	const d = (commandType: string, id: string, type: string, payload: unknown) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'f-i',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	return {
		d,
		stateOf: (id: string) => store.loadObject(id)?.state as Record<string, unknown>,
		eventsOfType: (t: string) => store.readAllEvents().filter((e) => e.eventType === t)
	};
}

describe('F-I — ReviseDecomposition asserts nothing it does not perform', () => {
	let h: ReturnType<typeof harness>;

	function proposePwu(id: string) {
		expect(
			h.d('ProposePwu', id, 'PROFESSIONAL_WORK_UNIT', {
				pwuId: id,
				pwuKind: 'ARCHITECTURE',
				title: id,
				description: 'd',
				intentId: INT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'LOW'
				}
			}).status
		).toBe('ACCEPTED');
	}

	/** A VALID contract, ready to be revised. */
	function validContract() {
		expect(
			h.d('ProposeDecomposition', DCP, 'DECOMPOSITION_CONTRACT', {
				parentWorkUnitId: PARENT,
				childWorkUnitIds: [CHILD_A, CHILD_B],
				rationale: 'split'
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('ValidateDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { disposition: 'VALID' }).status
		).toBe('ACCEPTED');
	}

	beforeEach(() => {
		h = harness();
		h.d('CaptureIntent', INT, 'INTENT', {
			intentId: INT,
			originatingExpression: 'x',
			ontologyId: 'o',
			ontologyVersion: '1'
		});
		for (const id of [PARENT, CHILD_A, CHILD_B, CHILD_C]) proposePwu(id);
	});

	it('REFUSES a revision carrying children it cannot apply, instead of accepting and dropping them', () => {
		validContract();
		const before = h.stateOf(DCP);
		const r = h.d('ReviseDecomposition', DCP, 'DECOMPOSITION_CONTRACT', {
			rationale: 'add a third child',
			childWorkUnitIds: [CHILD_A, CHILD_B, CHILD_C]
		});

		expect(r.status, 'a revision this handler cannot perform must be refused, not accepted').toBe(
			'REJECTED'
		);
		// The refusal has to say WHY and point at the obligation, or the caller learns only that something
		// failed — and the missing capability stays as invisible as it was when the command silently succeeded.
		expect(r.error?.message ?? '').toMatch(/DOC-003/);
		expect(r.error?.message ?? '').toMatch(/childWorkUnitIds/);

		// And it is a refusal, not a partial application: the contract is untouched, still VALID.
		expect(h.stateOf(DCP).status).toBe('VALID');
		expect(h.stateOf(DCP).childWorkUnitIds).toEqual(before.childWorkUnitIds);
		expect(h.eventsOfType('DecompositionRevised')).toHaveLength(0);
	});

	// SUPERSEDED 2026-08-02 BY THE CAPABILITY ITSELF, and rewritten rather than deleted so the progression is
	// legible. This test used to assert that `obligationAllocations` and `constraintPropagations` were REFUSED —
	// correct while the handler could not honour them (the B7 fail-closed discharge), and wrong the moment
	// REG-F-006's DOCS_STRONGER component landed. They are now APPLIED, gated by the M9 conservation kernel.
	//
	// What the test still has to hold is the part that never changed: a revision must not DROP them silently. The
	// discriminator is no longer refuse-vs-apply but apply-vs-vanish, so it asserts the persisted content.
	it('APPLIES obligationAllocations and constraintPropagations rather than dropping them (DEC-3/DEC-4)', () => {
		validContract();
		const r = h.d('ReviseDecomposition', DCP, 'DECOMPOSITION_CONTRACT', {
			rationale: 'reallocate',
			constraintPropagations: []
		});
		expect(r.status, `${r.error?.code ?? ''}: ${r.error?.message ?? ''}`).toBe('ACCEPTED');
		expect(
			h.stateOf(DCP).constraintPropagations,
			'the revised content must be persisted, not accepted and discarded'
		).toEqual([]);
		expect(h.stateOf(DCP).status).toBe('SUPERSEDED');
	});

	it('the emitted DecompositionRevised conforms to its OWN declared payload schema', () => {
		// It did not. Measured before this change: the event carried `command.payload` verbatim and failed its own
		// strictObject four ways — missing supersedesDecompositionContractId, semanticVersion and status (the facts
		// it exists to record), plus "Unrecognized keys" for the three optional fields. An audit record that omits
		// the supersession it is recording is not an audit record.
		validContract();
		expect(
			h.d('ReviseDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { rationale: 'refine' }).status
		).toBe('ACCEPTED');

		const [event] = h.eventsOfType('DecompositionRevised');
		expect(event, 'a revision must emit its event').toBeDefined();
		const parsed = DecompositionRevisedPayloadSchema.safeParse(event!.payload);
		expect(
			parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
			'the emitted payload must satisfy the schema the event itself declares'
		).toEqual([]);

		const payload = event!.payload as Record<string, unknown>;
		expect(payload.supersedesDecompositionContractId).toBe(DCP);
		expect(payload.status).toBe('SUPERSEDED');
		expect(payload.semanticVersion).toBe(h.stateOf(DCP).semanticVersion);
	});

	it('CONTROL — an ordinary revision still supersedes, so the guard refuses only what it must', () => {
		// Without this, refusing EVERY revision would satisfy both assertions above while removing a capability
		// the model does have. `rationale` alone is what every existing call site sends.
		validContract();
		expect(
			h.d('ReviseDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { rationale: 'refine' }).status
		).toBe('ACCEPTED');
		expect(h.stateOf(DCP).status).toBe('SUPERSEDED');
		expect(h.stateOf(DCP).semanticVersion).toBe(2);
		expect(h.eventsOfType('DecompositionRevised')).toHaveLength(1);
	});
});
