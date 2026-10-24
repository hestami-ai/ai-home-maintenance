// ── A BUSY STORE MUST NOT LOSE A REVIEWER'S TRY (`JAN-CRITREAD` `DD-1`, PER-9) ───────────────────────────────────
//
// `DD-1` makes every outermost write take the store's lock up front. A canonical exchange write that meets another
// process's long commit therefore waits the busy timeout and fails with `RPH_STORE_BUSY` — nothing written. Before
// this, the drain logged any failure and moved on: a try that was MADE would simply have no record. These tests hold
// the drain to a bounded retry on BUSY, and to nothing more.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { listByType, type AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { StoreBusyError } from '@janumipwb/rph-ports';
import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_CREDENTIAL } from './identity.js';
import { getEngine, resetEngine } from './workbench.js';
import { reasoningReviewCriteria, runPwaFloor, type FloorProducer } from './floor.js';
import { clearingJudgement, withLiveReviewerSeam } from './assurance/clearing-reviewer.testing.js';

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00';
const PRODUCER: FloorProducer = {
	agentId: 'jpwb-authoring-agent',
	modelId: 'pi-authoring',
	providerId: 'janumi'
};
let session: AuthedEngineHandle;

beforeEach(() => {
	resetEngine('empty');
	session = getEngine().as(SESSION_CREDENTIAL);
	const command: DomainCommand = {
		commandId: 'setup-1',
		commandType: 'CreatePwa',
		commandSchemaVersion: 1,
		targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		targetAggregateId: PWA,
		issuedAt: '2026-09-22T09:00:00Z',
		correlationId: 'setup',
		idempotencyKey: 'setup-idem-1',
		payload: {
			pwaId: PWA,
			name: 'Busy PWA',
			description: 'A DRAFT PWA.',
			domain: 'software',
			version: '1.0.0'
		}
	};
	expect(session.dispatch(command).status).toBe('ACCEPTED');
	// ⭐ The review in parts, B3 (`REG-D-125`) — one type, so one part and one reviewer try: the floor reviews each type.
	expect(
		session.dispatch({
			...command,
			commandId: 'setup-2',
			commandType: 'DefinePwuType',
			targetAggregateType: 'PWU_TYPE',
			targetAggregateId: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P10',
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
		}).status
	).toBe('ACCEPTED');
});

/** Runs the floor once with the canonical drain going through `canonical`; one clean try, so one exchange. */
function floorThrough(canonical: AuthedEngineHandle) {
	return withLiveReviewerSeam(() =>
		runPwaFloor(
			PWA,
			{
				prompt: 'Assess the draft.',
				producer: PRODUCER,
				print: async () => clearingJudgement(reasoningReviewCriteria(session)),
				canonical
			},
			session
		)
	);
}
const exchanges = () => listByType(session, 'MODEL_EXCHANGE').length;

describe('the canonical exchange drain on a busy store', () => {
	it('retries a write the store reported busy, and the try is recorded', async () => {
		let attempts = 0;
		const busyOnce: AuthedEngineHandle = {
			...session,
			dispatch: (command) => {
				attempts += 1;
				if (attempts === 1) throw new StoreBusyError();
				return session.dispatch(command);
			}
		};
		await floorThrough(busyOnce);
		expect(attempts, 'one busy refusal, then the retry').toBe(2);
		expect(exchanges(), 'PER-9: the try that was made is recorded').toBe(1);
	});

	it('gives up after a bounded number of attempts on a store that stays busy — never retries forever', async () => {
		let attempts = 0;
		const alwaysBusy: AuthedEngineHandle = {
			...session,
			dispatch: () => {
				attempts += 1;
				throw new StoreBusyError();
			}
		};
		await floorThrough(alwaysBusy);
		expect(attempts).toBe(3);
		expect(exchanges(), 'the shortfall is the disclosed one the drain already reports').toBe(0);
	});

	it('does not retry any other failure', async () => {
		let attempts = 0;
		const broken: AuthedEngineHandle = {
			...session,
			dispatch: () => {
				attempts += 1;
				throw new Error('not a busy store');
			}
		};
		await floorThrough(broken);
		expect(attempts).toBe(1);
	});
});
