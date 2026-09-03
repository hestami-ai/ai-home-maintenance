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

	// ── MXR-05: A FLOOR RUN PRODUCES DURABLE EXCHANGE RECORDS ────────────────────────────────────────────────
	//
	// ⭑ THIS IS THE TEST THAT MAKES THE WHOLE PACKAGE NON-HOLLOW. Contracts, a handler, durability and
	// projection proofs all existed while NO MODEL CALL PRODUCED A RECORD — the hollow governed layer this
	// programme keeps recording against itself. Everything above this line was true of that state too.
	//
	// It forces the REAL reviewer (`JPWB_ASSESSOR=agy`) rather than the deterministic mock, because the mock
	// never captures anything: an end-to-end assertion against it would observe zero records and prove nothing.
	// The model call itself is injected, so the gate never spawns a subprocess.
	describe('MXR-05 — the floor run writes one MODEL_EXCHANGE per bounded try', () => {
		const JUDGEMENT = JSON.stringify({ findings: [], recommendation: 'SATISFIED', residualUncertainty: [] });

		beforeEach(() => {
			process.env.JPWB_ASSESSOR = 'agy';
			process.env.JPWB_JUDGE_MODEL = 'test-judge-model';
		});
		afterEach(() => {
			delete process.env.JPWB_ASSESSOR;
			delete process.env.JPWB_JUDGE_MODEL;
		});

		it('records the try, with E-1 STORED and its content durability disclosed', async () => {
			const floor = await runPwaFloor(
				PWA,
				{ prompt: 'assess it', producer: PRODUCER, print: async () => JUDGEMENT, canonical: session },
				session
			);
			expect(floor, 'the floor run did not complete').toBeDefined();

			// THE MUTANT: unwire either `artifacts` or `exchanges` at the composition root. The floor still
			// completes, every assertion above this describe still passes, and this one goes to zero — which is
			// exactly how the layer stayed hollow for so long.
			const records = listByType(session, 'MODEL_EXCHANGE');
			expect(records.length, 'a model call produced no durable record').toBeGreaterThan(0);

			const state = records[0]!.state as Record<string, unknown>;
			expect(state.plane).toBe('ASSURANCE');
			expect(state.invokerId).toBe('agy.reasoning-review');
			expect(state.subjectObjectId, 'the record names what was being judged').toBe(PWA);

			// E-1 is retained (REG-D-050 classified it RETAINED_BY_PARTICIPATION), and the record DISCLOSES that
			// its bytes are process-local — the inverse orphan REG-F-342 made visible instead of silent.
			const input = state.materializedInputRef as Record<string, unknown>;
			expect(input.status, 'the materialized input is actually retained').toBe('STORED');
			expect(input.contentDurability, 'and the record says so on its face').toBe('PROCESS_LOCAL');
			expect(input.contentHash, 'with an address that can later be verified').toMatch(/^sha256:/);
		});

		it('⭑ E-2 is RETAINED end to end, split at retention — REG-D-056', async () => {
			await runPwaFloor(
				PWA,
				{ prompt: 'assess it', producer: PRODUCER, print: async () => JUDGEMENT, canonical: session },
				session
			);
			const state = listByType(session, 'MODEL_EXCHANGE')[0]!.state as Record<string, unknown>;

			// The reviewer's answer is now kept — which is the whole point of ASR-11 limb 3, and was the one
			// thing this chain was waiting on.
			const answer = state.answerSpanRef as Record<string, unknown>;
			expect(answer.status, 'the reviewer answer was not retained').toBe('STORED');
			expect(answer.purgeability).toBe('RETAINED_BY_PARTICIPATION');
			expect(answer.contentHash, 'with an address that can later be verified').toMatch(/^sha256:/);

			// This fixture returns clean JSON, so no reasoning arrived — recorded as an OBSERVED ABSENCE
			// (PER-12: no obligation to solicit or procure a trace), never as a silent gap.
			const reasoning = state.volunteeredReasoningRef as Record<string, unknown>;
			expect(reasoning.status).toBe('PENDING_CONTENT_PLANE');
			expect(reasoning.reason).toMatch(/no volunteered reasoning arrived/i);
		});

		it('⭑ a MIXED reply is SPLIT — answer retained, reasoning retained PURGEABLY, blob not stored whole', async () => {
			// ⚠ THIS IS THE CASE THE RULING TURNS ON, AND IT WAS MISSING. Every other fixture returns clean JSON,
			// so nothing was ever separated — and a mutant that stored the blob whole even when mixed reddened
			// NOTHING. The one behaviour REG-D-056 was careful not to authorise had no test at all.
			const NL = String.fromCharCode(10);
			const MIXED = [
				'Let me reason about this first. The graph has a single root and no orphans.',
				JUDGEMENT,
				'That is my assessment.'
			].join(NL);

			await runPwaFloor(
				PWA,
				{ prompt: 'assess it', producer: PRODUCER, print: async () => MIXED, canonical: session },
				session
			);
			const state = listByType(session, 'MODEL_EXCHANGE')[0]!.state as Record<string, unknown>;

			const answer = state.answerSpanRef as Record<string, unknown>;
			const reasoning = state.volunteeredReasoningRef as Record<string, unknown>;
			const whole = state.rawOutputBeforeCoercionRef as Record<string, unknown>;

			// The two halves are retained under OPPOSITE classes — which is the entire reason they cannot share
			// one stored object, and why §9.7 says separate at retention.
			expect(answer.status).toBe('STORED');
			expect(answer.purgeability, 'the answer participated — PER-8').toBe('RETAINED_BY_PARTICIPATION');
			expect(reasoning.status, 'volunteered reasoning was dropped rather than retained').toBe('STORED');
			expect(reasoning.purgeability, 'reasoning participates in nothing — PER-12').toBe(
				'PURGEABLE_AT_EXPIRY'
			);

			// ⛔ AND THE BLOB IS NOT STORED WHOLE. Storing it would classify the reasoning inside it as
			// participating — permanent under PER-8 — which is the "retained whole" formulation item 23 withdrew.
			expect(whole.status, 'a mixed blob must not be stored whole').toBe('PENDING_CONTENT_PLANE');
			expect(whole.reason).toMatch(/separated at retention/i);

			// They are DIFFERENT objects, not one blob referenced twice: content-addressed keys differ, and the
			// reasoning half must be independently purgeable without touching the answer.
			expect(reasoning.storageKey).not.toBe(answer.storageKey);
		});

		it('⛔ and a NON-SEPARABLE answer is still BLOCKED — §9.7, which the ruling did not lift', async () => {
			// Prose with no locatable JSON object: the answer and any reasoning cannot be separated losslessly,
			// so §9.7's own instruction is to block. The sponsor authorised retention; it did not authorise
			// retaining a blob whose halves cannot be told apart, which is wrong in one direction or the other.
			//
			// Both tries fail here, so the run itself throws — the record is what this asserts, not the verdict.
			await runPwaFloor(
				PWA,
				{
					prompt: 'assess it',
					producer: PRODUCER,
					print: async () => 'I had a look and it seems broadly fine to me.',
					canonical: session
				},
				session
			).catch(() => undefined);

			const records = listByType(session, 'MODEL_EXCHANGE');
			expect(records.length, 'the failed tries were not recorded at all').toBeGreaterThan(0);
			const state = records[0]!.state as Record<string, unknown>;
			for (const f of ['rawOutputBeforeCoercionRef', 'answerSpanRef', 'volunteeredReasoningRef']) {
				const ref = state[f] as Record<string, unknown>;
				expect(ref.status, `${f} must stay blocked when the spans cannot be separated`).toBe(
					'PENDING_CONTENT_PLANE'
				);
				expect(ref.reason, `${f} must cite the rule that blocks it`).toMatch(/separated losslessly|§9.7/i);
			}
		});

		it('a REPAIR produces a SECOND record chained to the first by a DURABLE id', async () => {
			// The first answer is unparseable, so the validator repairs — two bounded tries, two records.
			let call = 0;
			const print = async () => (++call === 1 ? 'I think the graph is fine, honestly.' : JUDGEMENT);

			await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER, print, canonical: session }, session);

			const records = listByType(session, 'MODEL_EXCHANGE');
			expect(records.length, 'a retry is its own record — PER-9').toBeGreaterThanOrEqual(2);

			const repair = records.find((r) => (r.state as Record<string, unknown>).exchangeRole === 'REPAIR');
			expect(repair, 'the repair try was not recorded').toBeDefined();
			const predecessor = (repair!.state as Record<string, unknown>).predecessorExchangeId as string;

			// ⭑ THE CHAIN POINTS AT A REAL AGGREGATE, NOT A RUN-LOCAL LABEL. `tryCounter` restarts per validator
			// instance and the floor runs twice per turn, so `exch-1` collided across runs (REG-D-055). The
			// predecessor link must resolve to a minted id that actually exists.
			expect(predecessor, 'the repair names no predecessor').toBeDefined();
			expect(predecessor.startsWith('mex_'), 'the link must be a minted aggregate id').toBe(true);
			expect(
				records.some((r) => r.id === predecessor),
				'the predecessor link points at a record that does not exist'
			).toBe(true);

			// And the parse outcome says WHY the first try failed, not merely that it did.
			const first = records.find((r) => (r.state as Record<string, unknown>).exchangeRole === 'INITIAL');
			const outcome = (first!.state as Record<string, unknown>).parseOutcome as Record<string, unknown>;
			expect(outcome.outcome, 'prose is an extraction failure, not a schema failure').toBe(
				'JSON_EXTRACTION_FAILED'
			);
		});
	});

});
