// ⭐ `JAN-SELREV` SR-1 (D4) — A REFUSED REVIEWER IS RECORDED ON BOTH FLOORS, THROUGH THE ENGINE, NEVER THROWN.
//
// ⛔ WHY THIS FILE AND NOT ONLY `floor-registry.test.ts`. That file stops at `runFloorAndPlanRecording`: it proves the
// registry answers a refusal, and it builds the registry with nothing else supplied. The two floors the product runs —
// `runPwaFloor` for an authoring turn (`floor.ts`) and `runWorkProductFloor` for a model step's work product
// (`execution/floor-over-subject.ts`) — build it WITH a content store and an exchange sink, and then RECORD the plan
// into an engine. The design says "the mechanism works on both floors", and until this file nothing held either floor
// to it: a composition that took the real-reviewer branch whenever retention was wired would pass every registry test.
//
// ⭑ WHAT MUST HOLD, on each floor, with devin NAMED and no model: the run resolves without throwing; the reasoning
// review records `VALIDATOR_EXECUTION_FAILED` carrying the refusal and `REG-D-119`'s guidance; the floor fails closed;
// and the event log names the refusing validator, `reasoning-review.unconfigured`, and never `agy.reasoning-review`.
//
// ⛔ HERMETIC. PATH finds no program and `JPWB_JUDGE_MODEL` is unset, so even a composition that selected agy would
// refuse for its model before any program was looked for.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import { createEngine, seedFloorPolicies } from '@janumipwb/rph-engine';
import type { AuthedEngineHandle, EngineHandle } from '@janumipwb/rph-engine';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UNCONFIGURED_REVIEWER_ID } from './assurance/index.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { runWorkProductFloor } from './execution/work-product-floor.js';
import { reasoningReviewCriteria, runPwaFloor } from './floor.js';
import { SESSION_CREDENTIAL, standaloneAuthenticator } from './identity.js';

const TS = '2026-09-26T09:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5R00';
const REFUSAL = "The reviewing tool 'devin' has no model: JPWB_ASSURANCE_MODEL is not set";
const ANSWER = '{"workProduct":"Assessment complete.","basis":"the northern route"}';

/** A real engine with the floor policies seeded — what both floors record into. */
function harness(): { host: EngineHandle; session: AuthedEngineHandle } {
	let n = 0;
	const host = createEngine({
		authenticate: standaloneAuthenticator(),
		store: new SqliteStorageAdapter({ now: () => TS }),
		ontology,
		now: () => TS,
		newEventId: () => `evt_${++n}`
	});
	const session = host.as(SESSION_CREDENTIAL);
	seedFloorPolicies(session);
	return { host, session };
}

/** What the event log says about the reviewer: the refusing validator named, the real one never. */
function expectTheRefusalRecorded(host: EngineHandle): void {
	const log = JSON.stringify(host.readAllEvents());
	expect(log, 'the event log does not name the refusing validator').toContain(
		UNCONFIGURED_REVIEWER_ID
	);
	expect(log, 'the refusal was recorded as agy’s work').not.toContain('agy.reasoning-review');
	expect(log).toContain(REFUSAL);
	expect(log).toContain('REG-D-119');
}

/** The refusal's statement, as the floor's own observations carry it. */
function expectTheRefusalObserved(
	observations: readonly { code: string; statement: string }[]
): void {
	const failed = observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED');
	expect(
		failed.length,
		`no VALIDATOR_EXECUTION_FAILED: ${JSON.stringify(observations)}`
	).toBeGreaterThan(0);
	const statements = failed.map((o) => o.statement).join('\n');
	expect(statements).toContain(REFUSAL);
	expect(statements).toContain('REG-D-119');
}

let opened: EngineHandle | undefined;

beforeEach(() => {
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL'])
		vi.stubEnv(v, undefined);
	// ⭑ THE REFUSED CONFIGURATION: the selected tool named, its model not (`REG-F-457` G3).
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
});
afterEach(() => {
	opened?.close();
	opened = undefined;
	vi.unstubAllEnvs();
});

describe('⭐ D4 — devin named with no model is RECORDED on both floors, never thrown and never as agy’s work', () => {
	it('the authoring floor (`runPwaFloor`)', async () => {
		const { host, session } = harness();
		opened = host;
		const created = session.dispatch({
			commandId: 'setup-1',
			commandType: 'CreatePwa',
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			targetAggregateId: PWA,
			issuedAt: TS,
			correlationId: 'setup',
			idempotencyKey: 'setup-idem-1',
			payload: {
				pwaId: PWA,
				name: 'Refused reviewer fixture',
				description: 'A DRAFT PWA the authoring floor is run over.',
				domain: 'software',
				version: '1.0.0'
			}
		});
		expect(created.status, 'arrangement: CreatePwa').toBe('ACCEPTED');
		// ⭐ The review in parts, B3 (`REG-D-125`) — one type, so one part for the refused reviewer to be asked about.
		const typed = session.dispatch({
			commandId: 'setup-2',
			commandType: 'DefinePwuType',
			commandSchemaVersion: 1,
			targetAggregateType: 'PWU_TYPE',
			targetAggregateId: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P10',
			issuedAt: TS,
			correlationId: 'setup',
			idempotencyKey: 'setup-idem-2',
			payload: {
				pwuTypeId: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P10',
				pwaId: PWA,
				pwuKind: 'PLAN',
				name: 'Plan',
				purpose: 'Plan the work',
				isRoot: true,
				permittedChildTypeIds: [],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: []
			}
		});
		expect(typed.status, 'arrangement: DefinePwuType').toBe('ACCEPTED');

		const floor = await runPwaFloor(
			PWA,
			{
				prompt: 'Author a product realization PWA',
				producer: {
					agentId: 'jpwb-authoring-agent',
					modelId: 'pi-authoring',
					providerId: 'janumi'
				},
				canonical: session,
				artifacts: createInMemoryArtifactStore()
			},
			session
		);

		expect(floor, 'the floor did not run').toBeDefined();
		expect(floor!.satisfied, 'a refused reviewer satisfied the floor').toBe(false);
		const review = floor!.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
		expect(review, 'no reasoning-review policy was recorded').toBeDefined();
		expectTheRefusalObserved(review!.observations);
		expectTheRefusalRecorded(host);
	});

	it('the work-product floor (`runWorkProductFloor`)', async () => {
		const { host, session } = harness();
		opened = host;
		let n = 0;
		const newId = (p: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5${String(++n).padStart(3, '0')}`;
		const artifacts = createInMemoryArtifactStore();
		const ref = await artifacts.put({
			tenantPrefix: 'tnt-t',
			bytes: ANSWER,
			mediaType: 'text/plain',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		const stored = {
			status: 'STORED' as const,
			storageKey: ref.storageKey,
			contentHash: ref.contentHash,
			byteSize: ref.byteSize,
			purgeability: 'RETAINED_BY_PARTICIPATION' as const,
			contentDurability: artifacts.durability
		};

		const out = await runWorkProductFloor(
			{
				artifactId: 'art_01ARZ3NDEKTSV4RRFFQ69G5R01',
				artifact: { semanticVersion: 1, provenance: {}, producingPwuId: 'pwu_1' },
				exchange: {
					exchangeId: 'mex_1',
					materializedInputRef: stored,
					rawOutputBeforeCoercionRef: stored,
					answerSpanRef: stored,
					volunteeredReasoningRef: { status: 'PENDING_CONTENT_PLANE', reason: 'none' }
				} as never,
				answer: ANSWER,
				producingPrompt: 'Assess the northern delivery route.',
				producerProviderId: 'test-provider',
				producerModelId: 'test-model'
			},
			session,
			{ artifacts, now: () => TS, newId, criteria: reasoningReviewCriteria(session) }
		);

		expect(out.satisfied, 'a refused reviewer satisfied the floor').toBe(false);
		expectTheRefusalObserved(out.observations);
		expectTheRefusalRecorded(host);
	});
});
