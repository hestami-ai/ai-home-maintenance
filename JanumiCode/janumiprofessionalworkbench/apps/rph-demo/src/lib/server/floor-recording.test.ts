// ── THE TEST THAT SHOULD HAVE EXISTED BEFORE D-1, AND THE REASON IT DIDN'T IS THE FINDING ───────────────────
//
// `floor.test.ts` sits next to this file and covers `floor.ts` thoroughly — every branch of
// `classifyFloorRemediation`, every derived fact in `identityProvenanceFactsOf`. It never once calls
// `runPwaFloor`. Both functions it tests are PURE: no engine, no store, no dispatch. So the module's ONLY
// engine-facing surface — the one that actually records the floor as canonical objects — had no unit test at
// all, and a 2504-test suite stayed green while `runPwaFloor` could not complete a single run.
//
// What it could not complete: the recorder DECLARED `issuedBy: { actorId: 'assurance-svc' }` while the session
// was the authoring agent, a declared-issuer disagreement is REFUSED (REG-D-027(b)), and the recorder throws on
// any non-ACCEPTED result. The throw was caught upstream and reported as `BLOCKED_EXTERNAL — the reviewer call
// failed (external/operational)`, which is a lie of the most expensive kind: it names a healthy external
// dependency as the fault. Nine e2e specs went red and the message pointed away from the cause every time.
//
// This suite therefore exercises the SEAM, not the arithmetic: a real engine, a real PWA, the real recorder.
// PREDICTED RED — restore `issuedBy: opts.actor` in `record-assurance.ts` and every case here throws.
import { vi } from 'vitest';

// Before ANY import: `workbench.ts` reads `RPH_DEMO_MODE` into a module-level const at load, and it decides
// whether the floor's Reasoning Review is the structural mock or a spawned external assessor. `vi.hoisted` is
// what runs early enough to matter — a plain assignment below the imports would be read after the const froze.
vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { createEngine, listByType, seedFloorPolicies } from '@janumipwb/rph-engine';
import type { AuthedEngineHandle, EngineHandle } from '@janumipwb/rph-engine';
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AGENT_CREDENTIAL, SESSION_CREDENTIAL, standaloneAuthenticator } from './identity.js';
import { runPwaFloor, type FloorProducer } from './floor.js';

const TS = '2026-08-05T09:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00';
const PRODUCER: FloorProducer = {
	agentId: 'jpwb-authoring-agent',
	modelId: 'pi-authoring',
	providerId: 'janumi'
};

describe('runPwaFloor records the floor through the AUTHENTICATED session (REG-F-062)', () => {
	let host: EngineHandle;
	let session: AuthedEngineHandle;
	let sequence: number;

	function dispatch(commandType: string, targetAggregateId: string, payload: unknown) {
		sequence += 1;
		const command: DomainCommand = {
			commandId: `setup-${sequence}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			targetAggregateId,
			issuedAt: TS,
			correlationId: 'setup',
			idempotencyKey: `setup-idem-${sequence}`,
			payload
		};
		return session.dispatch(command);
	}

	beforeEach(() => {
		sequence = 0;
		host = createEngine({
			authenticate: standaloneAuthenticator(),
			ontology,
			now: () => TS,
			newEventId: () => `evt_${++sequence}`
		});
		session = host.as(SESSION_CREDENTIAL);
		// The recorder cites floor.* policies, and `reasoningReviewCriteria` reads the ACTIVE reasoning-review
		// policy's criteria out of the store — both fail closed if the policies are absent.
		seedFloorPolicies(session);
		expect(
			dispatch('CreatePwa', PWA, {
				pwaId: PWA,
				name: 'Floor recording fixture',
				description: 'A DRAFT PWA that exists only to be assessed.',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
	});

	afterEach(() => {
		session.close();
	});

	it('completes and persists canonical assessments when run by the HUMAN session', async () => {
		const floor = await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER }, session);

		// The claim is that the run COMPLETED and left canonical records. Whether the floor is satisfied depends
		// on the mock reviewer's judgement of this deliberately-thin graph, and asserting satisfaction here would
		// couple this test to that judgement — the defect was that NOTHING was recorded, not that the verdict
		// was wrong.
		expect(floor, 'runPwaFloor returned undefined — the PWA or its graph did not load').toBeDefined();
		const assessments = listByType(session, 'ASSURANCE_ASSESSMENT');
		expect(assessments.length, 'the floor recorded no assessments at all').toBeGreaterThan(0);
		expect(assessments.map((a) => a.state.assurancePolicyId).sort()).toEqual([
			'floor.identity-provenance',
			'floor.reasoning-review',
			'floor.schema-invariant'
		]);
		for (const a of assessments) {
			expect((a.state.createdBy as ActorReference).actorId).toBe('local-professional');
		}
	});

	// THE CASE THAT WAS ACTUALLY BROKEN IN PRODUCTION. Every authoring turn runs the floor inside the AGENT's
	// staged fork, so the recording session is the agent — a different principal from both the human and the
	// `assurance-svc` literal the recorder used to declare. A test that only ever ran as the human would have
	// stayed green through the entire outage if the declared issuer had happened to be `local-professional`.
	it('completes just the same when run by the AGENT session — the issuer follows the session', async () => {
		const agent = host.as(AGENT_CREDENTIAL);
		const floor = await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER }, agent);

		expect(floor).toBeDefined();
		const assessments = listByType(agent, 'ASSURANCE_ASSESSMENT');
		expect(assessments.length).toBeGreaterThan(0);
		for (const a of assessments) {
			expect(
				(a.state.createdBy as ActorReference).actorId,
				'the recorded issuer must be the session that ran the floor, not a constant'
			).toBe('jpwb-authoring-agent');
		}
	});

	// THE CONTROL, and it has its OWN failure mode rather than being the mirror of the two above. The cases
	// above pass if the recorder ignores identity entirely — e.g. if it swallowed refusals instead of throwing,
	// or if the engine stopped gating dispatch. This one fails in exactly that world: an unresolvable credential
	// must yield a session that records NOTHING.
	it('an unknown credential records nothing — the recorder does not run unauthenticated', async () => {
		const stranger = host.as('jpwb.session.not-issued' as never);
		await expect(
			runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER }, stranger)
		).rejects.toThrow(/RPH_AUTHENTICATION_REQUIRED|acting principal/);
		expect(listByType(session, 'ASSURANCE_ASSESSMENT')).toHaveLength(0);
	});
});
