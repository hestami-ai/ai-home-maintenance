// ── ONE CHOKE POINT: A PWA WITH AN OPEN AUTHORING DRAFT TAKES NO MANUAL WRITE (`JAN-CRITREAD` `DD-4`, `REG-D-070` §5.6) ──
//
// While a draft is open the page renders the draft's FORK, so a manual edit to canonical is invisible there — and
// refuses the draft at acceptance, destroying the work. The workbench's dispatch helpers refuse such a write, naming
// the draft; a write that is not the PWA's structure, or is to another PWA, is not refused. Each case isolates one
// term; the two CONTROLS are what tell the refusal apart from a helper that refuses everything.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { listPwuTypes } from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AGENT_CREDENTIAL, ASSURANCE_REVIEWER_CREDENTIAL } from './identity.js';
import {
	dispatch,
	dispatchBatch,
	dispatchMultiPartyBatch,
	getEngine,
	mintUiId,
	resetEngine
} from './workbench.js';
import {
	beginAuthoringTurn,
	clearAuthoringTurns,
	commitAuthoringTurn,
	discardAuthoringTurn,
	markAuthoringTurnAssured,
	markAuthoringTurnValid,
	type AuthoringTurn
} from './authoring-turn.js';
import { holdForDraft, openDraftOn, releaseDraft } from './open-drafts.js';
import { actions } from '../../routes/pwa/[id]/+page.server.js';
import { POST as testApiDispatch } from '../../routes/test-api/dispatch/+server.js';

const P = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5D40';
const OTHER = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5D41';

function createPwa(pwaId: string): void {
	expect(
		dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
			pwaId,
			name: `PWA ${pwaId.slice(-2)}`,
			description: 'A draft PWA.',
			domain: 'software',
			version: '1.0.0'
		}).status
	).toBe('ACCEPTED');
}
function defineType(pwaId: string, policies: readonly string[] = []): string {
	const typeId = mintUiId('pwut');
	expect(
		dispatch('DefinePwuType', 'PWU_TYPE', typeId, {
			pwuTypeId: typeId,
			pwaId,
			pwuKind: 'PLAN',
			name: 'Plan',
			purpose: 'Plan the work',
			isRoot: true,
			permittedChildTypeIds: [],
			requiredInputs: [],
			requiredOutputs: [],
			requiredAssurancePolicyIds: [...policies]
		}).status,
		`arrangement: a type for ${pwaId}`
	).toBe('ACCEPTED');
	return typeId;
}
const editPwa = (pwaId: string, name: string) => ({
	commandType: 'EditPwa',
	targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	targetAggregateId: pwaId,
	payload: { pwaId, name }
});
const refusalFor = (turn: AuthoringTurn) =>
	`PWA ${P} has an open authoring draft (${turn.id}). A change made here now would not be in the draft, and ` +
	'would refuse it at acceptance. Accept or discard the draft first.';
const nameOf = (pwaId: string) =>
	(getEngine().loadObject(pwaId)?.state as { name?: string } | undefined)?.name;
/** An ACTIVE, non-floor policy from the seeded library. */
const seededPolicy = () => getEngine().ontology.seedPolicies[0]!.policyId;

beforeEach(() => {
	resetEngine('empty');
	createPwa(P);
	createPwa(OTHER);
});
afterEach(() => {
	clearAuthoringTurns();
});

describe('a PWA with an open authoring draft takes no manual write', () => {
	it('O-1 — a manual type birth for the PWA is refused, naming the draft; nothing reaches canonical', () => {
		const turn = beginAuthoringTurn(P);
		const typeId = mintUiId('pwut');
		const result = dispatch('DefinePwuType', 'PWU_TYPE', typeId, {
			pwuTypeId: typeId,
			pwaId: P,
			pwuKind: 'PLAN',
			name: 'Manual',
			purpose: 'Written beside the draft',
			isRoot: true,
			permittedChildTypeIds: [],
			requiredInputs: [],
			requiredOutputs: [],
			requiredAssurancePolicyIds: []
		});
		expect(result.status).toBe('REJECTED');
		expect(result.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(result.error?.message).toBe(refusalFor(turn));
		expect(listPwuTypes(getEngine(), P)).toEqual([]);
	});

	it('O-2 — an existing type is the PWA’s by its CANONICAL state, which the payload of a removal does not name', () => {
		const typeId = defineType(P);
		const turn = beginAuthoringTurn(P);
		const result = dispatch('RemovePwuType', 'PWU_TYPE', typeId, { pwuTypeId: typeId });
		expect(result.error?.message).toBe(refusalFor(turn));
		expect(listPwuTypes(getEngine(), P).map((type) => type.id)).toEqual([typeId]);
	});

	it('O-3 — the PWA itself, and a batch with one such write in it: the whole batch refused, nothing applied', () => {
		const turn = beginAuthoringTurn(P);
		expect(
			dispatch('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', P, { pwaId: P, name: 'x' }).error
				?.message
		).toBe(refusalFor(turn));
		const batch = dispatchBatch([editPwa(OTHER, 'Renamed'), editPwa(P, 'Renamed')]);
		expect(batch.ok).toBe(false);
		expect(batch.results[batch.failedIndex!]?.error?.message).toBe(refusalFor(turn));
		expect(nameOf(OTHER), 'the other PWA’s half did not apply either').toBe('PWA 41');
	});

	it('O-4 — a multi-party batch with such a write in it is refused whole', () => {
		const turn = beginAuthoringTurn(P);
		const batch = dispatchMultiPartyBatch([
			{ command: editPwa(OTHER, 'Renamed') },
			{ command: editPwa(P, 'Renamed'), as: ASSURANCE_REVIEWER_CREDENTIAL }
		]);
		expect(batch.ok).toBe(false);
		expect(batch.results[batch.failedIndex!]?.error?.message).toBe(refusalFor(turn));
		expect(nameOf(OTHER)).toBe('PWA 41');
	});

	it('O-5 — the harness’s test-api dispatch reaches the same refusal', async () => {
		const turn = beginAuthoringTurn(P);
		const response = await testApiDispatch({
			request: new Request('http://localhost/test-api/dispatch', {
				method: 'POST',
				body: JSON.stringify({
					steps: [['EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', P, { pwaId: P, name: 'x' }]]
				})
			})
		} as unknown as Parameters<typeof testApiDispatch>[0]);
		expect(await response.json()).toEqual({
			ok: false,
			results: [
				{
					commandType: 'EditPwa',
					status: 'REJECTED',
					code: 'RPH_INVARIANT_VIOLATION',
					message: refusalFor(turn)
				}
			]
		});
	});

	it('O-6 — CONTROL: a write to ANOTHER PWA while this one’s draft is open is accepted', () => {
		beginAuthoringTurn(P);
		expect(
			dispatch('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', OTHER, {
				pwaId: OTHER,
				name: 'Renamed'
			}).status
		).toBe('ACCEPTED');
		expect(nameOf(OTHER)).toBe('Renamed');
	});

	it('O-7 — CONTROL: a write that is not the PWA’s structure — a policy — is not refused (it is disclosed at acceptance)', () => {
		beginAuthoringTurn(P);
		const policy = seededPolicy();
		expect(
			dispatch('SuspendAssurancePolicy', 'ASSURANCE_POLICY', policy, { policyId: policy }).status
		).toBe('ACCEPTED');
	});
});

describe('the draft holds its PWA from start until it is committed or discarded', () => {
	it('R-1 — a discard releases the PWA', () => {
		const turn = beginAuthoringTurn(P);
		expect(openDraftOn(P)).toBe(turn.id);
		expect(discardAuthoringTurn(P)).toBe(true);
		expect(openDraftOn(P)).toBeUndefined();
		expect(
			dispatch('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', P, { pwaId: P, name: 'After' }).status
		).toBe('ACCEPTED');
	});

	it('R-2 — a commit releases the PWA', () => {
		const turn = beginAuthoringTurn(P, getEngine().as(AGENT_CREDENTIAL));
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		expect(
			commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, markAuthoringTurnValid(turn)))
		).toMatchObject({ ok: true });
		expect(openDraftOn(P)).toBeUndefined();
		expect(
			dispatch('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', P, { pwaId: P, name: 'After' }).status
		).toBe('ACCEPTED');
	});
	// ⚠ A RELEASE NAMES ITS OWN TURN. A discarded turn's late release must not free the hold its SUCCESSOR now has —
	// the successor would then take manual writes beside itself.
	it('R-3 — a stale release does not free a successor’s hold', () => {
		holdForDraft(P, 'sess_first');
		holdForDraft(P, 'sess_second');
		releaseDraft(P, 'sess_first');
		expect(openDraftOn(P), 'the first turn’s release must not free the second’s hold').toBe(
			'sess_second'
		);
		releaseDraft(P, 'sess_second');
		expect(openDraftOn(P)).toBeUndefined();
	});
});

describe('the page’s own acts that touch a held PWA', () => {
	const event = (action: string, form: FormData, id = P) =>
		({
			request: new Request(`http://localhost/pwa/${id}?/${action}`, { method: 'POST', body: form }),
			params: { id }
		}) as unknown as Parameters<typeof actions.newPolicyVersion>[0];

	// ⭑ `REG-D-070` Q4: SKIPPED, NOT REFUSED. Refusing the whole action would let one professional's draft block
	// another's act on a different PWA — the interference `REG-D-069` removes.
	it('N-1 — a new policy version skips the PWA with an open draft, says so, and migrates every other draft PWA', async () => {
		const policy = seededPolicy();
		const heldType = defineType(P, [policy]);
		const freeType = defineType(OTHER, [policy]);
		beginAuthoringTurn(P);
		const form = new FormData();
		form.set('policyId', policy);
		form.set('expectedRevision', String(getEngine().loadObject(policy)?.revision));

		const result = (await actions.newPolicyVersion(event('newPolicyVersion', form))) as {
			newVersion?: string;
			migratedReferences?: number;
			skippedForOpenDrafts?: string[];
		};

		expect(result.skippedForOpenDrafts).toEqual([P]);
		expect(result.migratedReferences).toBe(1);
		const refs = (typeId: string) =>
			(getEngine().loadObject(typeId)?.state as { requiredAssurancePolicyIds?: string[] })
				.requiredAssurancePolicyIds;
		expect(refs(freeType), 'the other PWA’s draft type moved to the successor').toEqual([
			result.newVersion
		]);
		expect(refs(heldType), 'the held PWA’s type kept the predecessor').toEqual([policy]);
	});

	// ⛔ The page renders the DRAFT's floor, but a waiver acts on the CANONICAL floor.
	it('W-1 — a waiver is refused while the PWA’s draft is open', async () => {
		const turn = beginAuthoringTurn(P);
		const form = new FormData();
		form.set('rationale', 'Accepting the risk.');
		const result = (await actions.recordWaiver(event('recordWaiver', form))) as {
			status?: number;
			data?: { error?: string };
		};
		expect(result.status).toBe(409);
		expect(result.data?.error).toBe(
			`PWA ${P} has an open authoring draft (${turn.id}); the floor on screen is the draft's, not the one a ` +
				'waiver would act on. Accept or discard the draft first.'
		);
	});
});
