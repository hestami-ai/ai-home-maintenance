// ── DIRECT BY-ID CONTAINMENT (`JAN-CRITREAD` `DD-6b`, `REG-D-070` §5.5) ─────────────────────────────────────────────
//
// The last of the gates that replace the net the whole-log limb used to be. The rule says a draft depends on every
// aggregate its candidate-shaping code reads BY ID, other than as a member of a scan (§7.2 clause 1a). This drives the
// turn scenarios and asks it of every such read: is that aggregate PINNED, a member of a declared GROUP, or listed
// ADVISORY? A read that is none of those is a dependency nobody declared — the class the old limb caught for free.
//
// ⭑ THE READS ARE RECORDED ON THE FORK, and that is the honest place: every read a candidate makes passes through it
// (the agent's tools, the broker, the floor, and the handlers they dispatch into), which a recorder in the query layer
// alone would miss — handlers load through `ctx.store` directly. What the design warns about is recording at the
// storage layer WITHOUT being able to tell an enumeration's loads from a caller's: that is what `withScanContext`
// settles, so `listByType` and the four handler scans that walk a whole type declare themselves.
//
// ⚠ STATED LIMITS (DESIGN §5.5). This covers the reads a draft makes ON ITS FORK, in the scenarios below. Reads
// outside the fork adapter are not recorded: the canonical witness's own writes, the artifact store, and event
// payloads read without `loadObject`. The REPLAY's reads at commit are a different surface, covered by the §5.1 pins.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dispatch, recordConversation, resetEngine } from './workbench.js';
import {
	beginAuthoringTurn,
	clearAuthoringTurns,
	declaredDependenciesOf,
	markAuthoringTurnValid,
	type AuthoringTurn
} from './authoring-turn.js';
import { runPwaFloor, type FloorProducer } from './floor.js';
import { memberOfGroup } from '@janumipwb/rph-application';

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5M00';
const PRODUCER: FloorProducer = {
	agentId: 'jpwb-authoring-agent',
	modelId: 'pi-authoring',
	providerId: 'janumi'
};

/**
 * Aggregates a draft may read by id WITHOUT depending on them — each with the reason it cannot change what the draft
 * commits. Empty today, and that is the finding: every by-id read the scenarios make is pinned. A read that has to be
 * added here is a claim about the product, not a way to quieten this test.
 */
const ADVISORY: Record<string, string> = {};

function createPwa(): void {
	expect(
		dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
			pwaId: PWA,
			name: 'Contained PWA',
			description: 'Its draft reads only what it declares.',
			domain: 'software',
			version: '1.0.0'
		}).status
	).toBe('ACCEPTED');
}

/** Every by-id read the fork made, classified against what the turn DECLARES. */
function undeclaredReads(turn: AuthoringTurn): string[] {
	const declared = declaredDependenciesOf(turn);
	const pinned = new Set(declared.pins.map((pin) => pin.aggregateId));
	return turn.engine
		.forkBase()!
		.directLoads()
		.filter((id) => {
			if (pinned.has(id) || id in ADVISORY) return false;
			const object = turn.engine.loadObject(id);
			if (!object) return true;
			return !declared.groups.some(
				(group) =>
					group.aggregateType === object.objectType && memberOfGroup(object.state, group.key)
			);
		});
}

beforeEach(() => {
	resetEngine('empty');
	createPwa();
});
afterEach(() => {
	clearAuthoringTurns();
});

describe('every aggregate a draft reads BY ID is one it declared', () => {
	it('⛔⛔ authoring, a transcript and a floor run: every by-id read is pinned, grouped or advisory', async () => {
		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const child = turn.broker.defineType({ name: 'Build', pwuKind: 'BUILD' });
		expect(child.ok).toBe(true);
		expect(turn.broker.editType(child.id!, { purpose: 'Build it safely' }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		recordConversation(
			PWA,
			[{ role: 'USER', kind: 'message', text: 'Author the plan.' }],
			turn.engine,
			turn.id
		);
		await runPwaFloor(
			PWA,
			{ prompt: 'Author the plan.', producer: PRODUCER, candidateSubjectHash: subjectHash },
			turn.engine
		);

		const reads = turn.engine.forkBase()!.directLoads();
		// LIVENESS FIRST: a recorder that saw nothing would satisfy the assertion below by measuring nothing.
		expect(reads.length, 'the fork recorded the reads this scenario made').toBeGreaterThan(5);
		expect(
			undeclaredReads(turn),
			'BY-ID READS NOBODY DECLARED. Each is an aggregate whose change the commit cannot see: pin it (§5.1), ' +
				'cover it with a group (§5.1), or list it ADVISORY above with the reason it cannot change what the ' +
				'draft commits.'
		).toEqual([]);
	});

	it('CONTROL — an enumeration’s loads are NOT counted: the policy library the floor walks is not a by-id read', async () => {
		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		await runPwaFloor(
			PWA,
			{ prompt: 'Author the plan.', producer: PRODUCER, candidateSubjectHash: subjectHash },
			turn.engine
		);

		const reads = new Set(turn.engine.forkBase()!.directLoads());
		const library = turn.broker.listPolicies().map((policy) => policy.id);
		const additive = library.filter((id) => !id.startsWith('floor.'));
		// The arrangement is only meaningful if the library HAS additive policies to be walked past.
		expect(additive.length, 'the seeded library has additive policies').toBeGreaterThan(5);
		expect(
			additive.filter((id) => reads.has(id)),
			'the handler scans walk the whole library; those loads are the scan’s, not the draft’s dependencies'
		).toEqual([]);
		// And the floor policies ARE read by id — the read the scan flag must not hide.
		expect(library.filter((id) => id.startsWith('floor.') && reads.has(id)).length).toBeGreaterThan(
			0
		);
	});
});
