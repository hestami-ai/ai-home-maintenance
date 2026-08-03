// REG-F-014, THE FIRST HALF: a Decision may not record an authority its issuer does not hold.
//
// THE OBSERVED BYPASS. `proposeDecision` set `authority: p.authority` — straight from the caller's payload, with
// no reference to `command.issuedBy` and no check of any kind. So this sequence, with NO human actor at any point:
//
//   ProposeDecision  issued by an AGENT, payload `authority` naming a HUMAN   -> ACCEPTED
//   ApproveDecision  on that decision, issued by the SAME AGENT               -> ACCEPTED
//   final state: status EFFECTIVE, authority { actorType: 'HUMAN' }
//
// The governed record then asserts that a human decided. None did. The authority check is not vacuous — it is
// INVERTED: `makeDecisionEffective` computes `authorityHeld` from the DECISION's recorded authority, so it fires
// exactly when the caller DECLARES an insufficient authority (the honest case) and cannot fire when the caller
// declares a sufficient one. It stops the agent that says what it is, and not the agent that does not.
//
// THE FIX IS THE SIBLING HANDLER, TWENTY LINES AWAY. `requestWaiver` sets `authority: command.issuedBy` and is
// therefore not forgeable this way. Two governance handlers, one field, two provenance models. This refuses the
// disagreement rather than silently overwriting the payload, so the ratified field keeps its meaning: the caller
// must state the authority, and what it states must be true.
//
// SURVEYED BEFORE CHANGING BEHAVIOUR, because this refuses commands the engine accepted. Instrumented across the
// whole suite: of 139 `ProposeDecision` dispatches, 137 already declared an authority equal to their issuer. The
// two that did not were both THIS test's own scenario written benignly — an AGENT authority declared on a
// HUMAN-issued command in order to exercise the approval guard — and both now issue as the agent they name, which
// is a more honest arrangement than the one they replace. No production caller declares a foreign authority.
//
// WHAT THIS DOES NOT BUY, stated because the limit is real. This engine has no authentication layer, so
// `command.issuedBy` is caller-supplied too. Binding the two does not make authority VERIFIABLE — it makes it
// CONSISTENT, and removes the ability to name one actor while acting as another. Full verifiability needs the
// platform tier the Charter allocates elsewhere. That is a reason to state the limit, not a reason to leave two
// fields unrelated when one handler already relates them.
//
// DELEGATION IS THE ABSENT MECHANISM, and it is deliberately not invented here. Canon says authority may be
// DELEGATED (DOC-003 §8 ASR-15), and this repository has no object for a delegation record. Until one is ratified,
// declaring an authority you are not is refused rather than admitted on trust.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-03T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Eng Lead' };
const AGENT: ActorReference = { actorId: 'agent-1', actorType: 'AGENT', displayName: 'Author' };
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69J6001';
const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69J6002';

describe('REG-F-014: a Decision records the authority of its ISSUER, not one it names', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	const dispatch = (
		issuedBy: ActorReference,
		commandType: string,
		payload: unknown,
		id = DEC,
		aggType = 'DECISION'
	) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy,
			correlationId: 'reg-f-014',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};

	const propose = (issuedBy: ActorReference, authority: ActorReference) =>
		dispatch(issuedBy, 'ProposeDecision', {
			decisionType: 'APPROVAL',
			subjectObjectIds: [SUBJECT],
			selectedOption: 'approve',
			rationale: 'ready to ship',
			authority
		});

	// THE BYPASS ITSELF. An agent naming a human. Before the fix this was ACCEPTED, and the decision it created
	// carried `authority: { actorType: 'HUMAN' }` — a governed record asserting a human decided.
	it('an AGENT may not propose a Decision whose recorded authority is a HUMAN', () => {
		const r = propose(AGENT, HUMAN);
		expect(r.status, JSON.stringify(r.error)).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_AUTHORITY_INSUFFICIENT');
		expect(store.loadObject(DEC), 'no Decision may exist at all').toBeUndefined();
	});

	// The mirror: a human may not launder a decision through an agent's name either. Same rule, no privileged
	// direction — the check is IDENTITY, not a ranking of actor types, because this repository has no such ranking
	// and inventing one here would be the convenient interpretation encoded as architecture (§0.3).
	it('a HUMAN may not propose a Decision whose recorded authority is an AGENT', () => {
		const r = propose(HUMAN, AGENT);
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_AUTHORITY_INSUFFICIENT');
	});

	// CONTROL 1 — the honest human. Without this the guard could be `return reject(...)` unconditionally and both
	// tests above would still pass.
	it('CONTROL: a HUMAN proposing on its OWN authority is ACCEPTED and records that authority', () => {
		const r = propose(HUMAN, HUMAN);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const state = store.loadObject(DEC)?.state as { authority?: ActorReference; status?: string };
		expect(state?.authority?.actorId).toBe(HUMAN.actorId);
		expect(state?.status).toBe('PROPOSED');
	});

	// CONTROL 2 — the honest agent. An agent MAY propose; canon says so ("An agent may recommend a decision but
	// cannot exercise authority unless delegated"). What it may not do is claim to be someone else.
	it('CONTROL: an AGENT proposing on its OWN authority is ACCEPTED — recommending is permitted', () => {
		const r = propose(AGENT, AGENT);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const state = store.loadObject(DEC)?.state as { authority?: ActorReference };
		expect(state?.authority?.actorType).toBe('AGENT');
	});

	// THE CONTRACT, END TO END, and the assertion is deliberately about the OUTCOME rather than about any message:
	// an agent cannot cause a decision to become EFFECTIVE on an authority it does not hold. Both routes are
	// closed — declaring a human's authority is refused at proposal, and declaring its own is refused at approval.
	it('an AGENT cannot reach an EFFECTIVE decision by either route', () => {
		expect(propose(AGENT, HUMAN).status, 'route 1: name a human').not.toBe('ACCEPTED');

		expect(propose(AGENT, AGENT).status, 'route 2: propose honestly').toBe('ACCEPTED');
		const approved = dispatch(AGENT, 'ApproveDecision', {
			selectedOption: 'approve',
			rationale: 'ready to ship',
			consideredEvidenceIds: [],
			consideredObservationIds: [],
			subjectSemanticVersions: {}
		});
		expect(approved.status, 'route 2 is closed at approval by RPH-GOV-001').toBe('UNAUTHORIZED');

		const state = store.loadObject(DEC)?.state as { status?: string };
		expect(state?.status, 'no EFFECTIVE decision exists on any route').not.toBe('EFFECTIVE');
	});
});
