// REG-F-017 / REG-F-014 instance 2: a Decision's subject versions are PINNED AT PROPOSAL and never rewritten.
//
// THE DEFECT. `approveDecision`'s `extraMutate` wrote `subjectSemanticVersions: p.subjectSemanticVersions` — the
// caller's number — over the pin `proposeDecision` had read from the store one command earlier. So the version
// binding that RPH-GOV-003 ("an approval of Architecture version 2 does not approve Architecture version 3") and
// canon ASR-15 both rest on was, at the moment of approval, whatever the approver said it was. The engine had
// computed the honest value and discarded it.
//
// THE REMEDY IS *NOT* THE ONE ITS SIBLING GOT, and the asymmetry is the interesting part. REG-F-014's first
// instance — a forged `authority` — is fixed by refusing a claim the engine cannot compute. The obvious symmetric
// move here is to DERIVE the versions from the store at approval. That was implemented, passed 2086 tests, and was
// WITHDRAWN: deriving at approval makes the ENGINE perform the laundering the rule forbids, because an approver
// who reviewed v1 and approves after the subject silently moved to v2 would be RECORDED as approving v2. A
// caller's untrue number would be replaced by an engine's untrue number.
//
// So: `authority` is a fact about the CALLER — derive or refuse it. A subject version is a fact about a MOMENT,
// and the moment that binds is the REVIEW. The pin is therefore immutable, the payload must agree with it, and
// staleness is caught where the rule places it — at promotion, by `decisionAuthorizesVersions`.
//
// WHAT THESE TESTS GUARD, stated because the two production changes are NOT independently observable and saying so
// is cheaper than letting a reader assume they are. Once a disagreeing payload is refused, no accepted command can
// tell "keeps the pin" apart from "writes the payload" — the two agree by construction. The one place they still
// differ is a subject the PIN DOES NOT COVER: `proposeDecision` pins only objects the store could load, so for a
// subject that never existed the old code recorded the caller's claim and the new code records nothing. That is
// the third test, and it is the only discriminating case for the immutability half.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-03T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Eng Lead' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69J7001';
const GHOST = 'pwu_01ARZ3NDEKTSV4RRFFQ69J7009';
const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69J7002';

describe('REG-F-017: a Decision pins its subject versions at PROPOSAL', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	const dispatch = (commandType: string, payload: unknown, id: string, aggType: string) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: HUMAN,
			correlationId: 'reg-f-017',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};

	const ok = (r: { status: string; error?: unknown }, what: string) => {
		expect(r.status, `${what}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
		return r;
	};

	/** An INTENT — one of the only three aggregates whose semanticVersion can ever move. */
	function seedIntent(): void {
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'ship it', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'capture intent'
		);
	}

	const propose = (subjects: string[]) =>
		dispatch(
			'ProposeDecision',
			{
				decisionType: 'APPROVAL',
				subjectObjectIds: subjects,
				selectedOption: 'approve',
				rationale: 'ready',
				authority: HUMAN
			},
			DEC,
			'DECISION'
		);

	const approve = (stated: Record<string, number>) =>
		dispatch(
			'ApproveDecision',
			{
				selectedOption: 'approve',
				rationale: 'ready',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: stated
			},
			DEC,
			'DECISION'
		);

	const pinOf = () =>
		(store.loadObject(DEC)?.state as { subjectSemanticVersions?: Record<string, number> })
			?.subjectSemanticVersions;

	it('an approval STATING a version other than the pin is refused', () => {
		seedIntent();
		ok(propose([INTENT]), 'propose');
		expect(pinOf(), 'the pin is read from the store at proposal').toEqual({ [INTENT]: 1 });

		const r = approve({ [INTENT]: 2 });
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(r.error?.message).toContain('pinned@1');
		expect(pinOf(), 'and the pin is untouched by the attempt').toEqual({ [INTENT]: 1 });
	});

	// CONTROL. Without it the guard could refuse every approval and the test above would still pass.
	it('CONTROL: an approval stating the pinned version is ACCEPTED', () => {
		seedIntent();
		ok(propose([INTENT]), 'propose');
		ok(approve({ [INTENT]: 1 }), 'approve');
		expect(
			(store.loadObject(DEC)?.state as { status?: string }).status,
			'the decision really became effective'
		).toBe('EFFECTIVE');
		expect(pinOf()).toEqual({ [INTENT]: 1 });
	});

	// THE ONLY DISCRIMINATING CASE FOR IMMUTABILITY — see the header. `proposeDecision` pins only what the store
	// can load, so a subject that never existed is absent from the pin; nothing then disagrees with the payload
	// and the approval is accepted. What must NOT happen is the accepted payload writing itself onto the record:
	// a Decision may not carry a semantic version for an object the engine has never seen.
	//
	// PREDICTED RED: restore `subjectSemanticVersions: p.subjectSemanticVersions` in approveDecision's extraMutate
	// and this test fails — the record gains a version for a subject that does not exist. No other test in the
	// repository reddens under that restoration, because every other approval now states exactly the pin.
	it('an accepted approval does not record a version for a subject the engine never saw', () => {
		seedIntent();
		ok(propose([INTENT, GHOST]), 'propose over a real subject and a non-existent one');
		expect(pinOf(), 'the ghost is absent from the pin — nothing to pin it from').toEqual({
			[INTENT]: 1
		});

		ok(approve({ [INTENT]: 1, [GHOST]: 7 }), 'approve, claiming a version for the ghost');
		expect(pinOf(), 'the claim is not adopted: the pin still holds only what the store had').toEqual({
			[INTENT]: 1
		});
	});
});
