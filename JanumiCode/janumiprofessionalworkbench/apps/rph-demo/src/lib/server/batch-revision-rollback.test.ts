// ONE EXPECTATION ON THE LAST ELEMENT PROTECTS THE WHOLE BATCH — asserted here because the route claims it.
//
// `newPolicyVersion` (routes/pwa/[id]/+page.server.ts) dispatches a batch: mint a successor policy, activate
// it, migrate every DRAFT PWU-Type reference, then supersede the predecessor. Only the LAST element touches an
// aggregate the page rendered, so only it can carry a page-derived `expectedRevision` — element 0 mints an id
// that did not exist at render, and the migrations target types the policy manager never displayed. Computing
// expectations for those server-side would be the re-fetched tautology REG-F-050 records.
//
// THE ROUTE'S COMMENT MAKES A CLAIM ABOUT THAT ARRANGEMENT: because `dispatchBatch` runs one store transaction,
// a conflict on the last element rolls element 0 back too, so the single expectation transitively guards the
// successor's ENTIRE content copy — name, purpose, rationale, criteria, all six rule arrays — which is read
// from the predecessor AFTER the page was rendered. Without that, a successor could be minted from a version
// the professional never saw.
//
// ⚠ A CLAIM IN A COMMENT IS NOT A GUARANTEE. This file exists because I wrote that sentence and then had to
// establish it: nothing else in the suite drives a REJECTED batch whose rejection comes from a revision rather
// than from a state machine, and no e2e can — a single-actor test never produces a conflict, so the wiring is
// invisible to every test that merely exercises the happy path.

import { describe, expect, it } from 'vitest';
import { dispatch, dispatchBatch, getEngine, mintUiId } from './workbench';
import { actions } from '../../routes/pwa/[id]/+page.server.js';

const ACTIVE_FLOOR_FREE_POLICY = () => mintUiId('pol');

/** A minimal ACTIVE policy to act as the predecessor. */
function seedPolicy(id: string): number {
	expect(
		dispatch('CreateAssurancePolicy', 'ASSURANCE_POLICY', id, {
			policyId: id,
			version: '1.0.0',
			name: 'Predecessor',
			purpose: 'p',
			rationale: 'r',
			applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
			evaluatedClaimTypes: ['CORRECTNESS'],
			criteria: [],
			evaluatorRole: 'reviewer',
			independenceRequirement: 'DIFFERENT_AGENT',
			findingDefinitions: [],
			permittedControlActions: ['ESCALATE']
		}).status
	).toBe('ACCEPTED');
	expect(
		dispatch('ActivateAssurancePolicy', 'ASSURANCE_POLICY', id, { policyId: id }).status
	).toBe('ACCEPTED');
	const revision = getEngine().loadObject(id)?.revision;
	expect(revision, 'the predecessor must expose a revision to declare').toBeTypeOf('number');
	return revision as number;
}

describe('newPolicyVersion batch — a stale expectation on the last element rolls back the first', () => {
	it('refuses with CONFLICT and mints no successor', () => {
		const policyId = ACTIVE_FLOOR_FREE_POLICY();
		const renderedAt = seedPolicy(policyId);

		// SOMEBODY ELSE WRITES between render and submit. Suspend is a legal act on an ACTIVE policy, so the
		// batch below can only be refused by the revision — not by a state machine doing its job.
		expect(
			dispatch('SuspendAssurancePolicy', 'ASSURANCE_POLICY', policyId, { policyId }).status
		).toBe('ACCEPTED');

		const successorId = mintUiId('pol');
		const batch = dispatchBatch([
			{
				commandType: 'CreateAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: successorId,
				payload: {
					policyId: successorId,
					version: '2.0.0',
					name: 'Successor',
					purpose: 'p',
					rationale: 'r',
					applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
					evaluatedClaimTypes: ['CORRECTNESS'],
					criteria: [],
					evaluatorRole: 'reviewer',
					independenceRequirement: 'DIFFERENT_AGENT',
					findingDefinitions: [],
					permittedControlActions: ['ESCALATE']
				}
				// NO expectedRevision, and that is CORRECT: this aggregate did not exist when the page rendered.
			},
			{
				commandType: 'SupersedeAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: policyId,
				payload: { policyId, supersededByPolicyId: successorId },
				expectedRevision: renderedAt
			}
		]);

		expect(batch.ok, 'a stale expectation must refuse the batch').toBe(false);
		const rejected =
			batch.failedIndex === undefined ? undefined : batch.results[batch.failedIndex];
		expect(rejected?.status, 'and it must refuse as a CONFLICT, not as a state refusal').toBe(
			'CONFLICT'
		);
		expect(rejected?.error?.code).toBe('RPH_REVISION_CONFLICT');

		// ── THE POINT. Element 0 was ACCEPTABLE on its own and is rolled back anyway. ────────────────────────
		expect(
			getEngine().loadObject(successorId),
			'the successor must not survive a rollback — this is what makes ONE expectation cover the whole copy'
		).toBeUndefined();
	});

	it('CONTROL — the same batch with a CURRENT expectation commits, successor and all', () => {
		// Without this, a `dispatchBatch` that refused every batch carrying any expectedRevision would satisfy
		// the assertions above while protecting nothing. REG-F-015's anatomy: a true assertion about an
		// arrangement that never happened.
		const policyId = ACTIVE_FLOOR_FREE_POLICY();
		seedPolicy(policyId);
		const current = getEngine().loadObject(policyId)?.revision;

		const successorId = mintUiId('pol');
		const batch = dispatchBatch([
			{
				commandType: 'CreateAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: successorId,
				payload: {
					policyId: successorId,
					version: '2.0.0',
					name: 'Successor',
					purpose: 'p',
					rationale: 'r',
					applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
					evaluatedClaimTypes: ['CORRECTNESS'],
					criteria: [],
					evaluatorRole: 'reviewer',
					independenceRequirement: 'DIFFERENT_AGENT',
					findingDefinitions: [],
					permittedControlActions: ['ESCALATE']
				}
			},
			{
				commandType: 'SupersedeAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: policyId,
				payload: { policyId, supersededByPolicyId: successorId },
				expectedRevision: current
			}
		]);

		expect(batch.ok, 'declaring the CURRENT revision must still commit').toBe(true);
		expect(getEngine().loadObject(successorId), 'and the successor must exist').toBeDefined();
	});
});

// ── AND THE ROUTE MUST ACTUALLY PASS IT ─────────────────────────────────────────────────────────────────────
// The two cases above prove the ENGINE honours a per-element expectation and rolls the batch back. They say
// nothing about whether `newPolicyVersion` SUPPLIES one — removing `expectedRevision` from the route's batch
// element would leave both of them green, and no e2e can see it either, because a single-actor happy path
// never produces a conflict. So the action is driven directly.
describe('newPolicyVersion the ACTION — the route supplies the expectation, not just the engine', () => {
	/** The SvelteKit event shape this action actually reads: `request` and nothing else. */
	function event(form: FormData) {
		return {
			request: new Request('http://localhost/pwa/x?/newPolicyVersion', { method: 'POST', body: form })
		} as unknown as Parameters<typeof actions.newPolicyVersion>[0];
	}

	it('refuses with 409 when the page declared a stale revision', async () => {
		const policyId = ACTIVE_FLOOR_FREE_POLICY();
		const renderedAt = seedPolicy(policyId);
		// Somebody else writes between render and submit.
		expect(
			dispatch('SuspendAssurancePolicy', 'ASSURANCE_POLICY', policyId, { policyId }).status
		).toBe('ACCEPTED');

		const form = new FormData();
		form.set('policyId', policyId);
		form.set('expectedRevision', String(renderedAt));
		const result = (await actions.newPolicyVersion(event(form))) as {
			status?: number;
			data?: { code?: string };
		};
		// MUTANT: drop `expectedRevision` from the SupersedeAssurancePolicy element in the route's batch and
		// this reddens while every e2e and both engine-level cases above stay green.
		expect(result?.status, 'a stale page must be refused as a CONFLICT').toBe(409);
		expect(result?.data?.code).toBe('RPH_REVISION_CONFLICT');
	});

	it('CONTROL — the same action succeeds when the page declared the current revision', async () => {
		// Without this, an action that refused every versioning attempt would satisfy the assertion above.
		const policyId = ACTIVE_FLOOR_FREE_POLICY();
		seedPolicy(policyId);
		const form = new FormData();
		form.set('policyId', policyId);
		form.set('expectedRevision', String(getEngine().loadObject(policyId)?.revision));
		const result = (await actions.newPolicyVersion(event(form))) as { newVersion?: string };
		expect(result?.newVersion, 'a current expectation must still version the policy').toBeTruthy();
	});
});
