// W2-INC-3 (WP-2-006) — the Traceability and Compatibility projections are rebuildable from the reference
// undertaking's real event log (the exit criterion "Work, ..., Traceability, and compatibility projections can
// be rebuilt"). Drives the fixture live, then folds its events through both projectors and proves the derived
// content + rebuild==incremental equivalence (RPH-PER-007 for the two views W2 adds).
import {
	compatibilityProjector,
	IncrementalProjection,
	rebuildProjection,
	traceabilityProjector
} from '@janumipwb/rph-projections';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { Principal } from '@janumipwb/rph-ports';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import {
	createEngine,
	driveReferenceUndertaking,
	REFERENCE_CONSTRAINT_CHAIN as C,
	REFERENCE_UNDERTAKING as R
} from './index.js';

// ── THE DRIVE RUNS AS THE UNDERTAKING OWNER (D-1) ────────────────────────────────────────────────────────────
// `driveReferenceUndertaking` proposes each promotion Decision with `authority: { actorId: 'owner-1',
// actorType: 'HUMAN' }`, and REG-F-014 refuses a Decision whose declared authority is not its issuer. The drive
// used to assert that identity in the envelope (`issuedBy: ACTOR`); the SESSION carries it now, so only a
// session that IS `owner-1` can drive it. As `u1` the first `ProposeDecision` refuses
// RPH_AUTHORITY_INSUFFICIENT and the fail-loud drive throws before `build()` can return an event log.
const OWNER: Principal = {
	actorId: 'owner-1',
	actorType: 'HUMAN',
	displayName: 'Undertaking Owner',
	tenantId: 'tenant-test',
	organizationId: 'org-test',
	executionInstanceId: 'exec-production'
};
const DIR = testDirectory([OWNER]);
const OWNER_CRED = DIR.credentialFor(OWNER.actorId);

function build() {
	let s = 0;
	const engine = createEngine({
		authenticate: DIR.authenticate,
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: () => `evt_${++s}`
	}).as(OWNER_CRED);
	driveReferenceUndertaking(engine);
	return engine.readAllEvents();
}

describe('W2-INC-3 Traceability + Compatibility projections rebuildable from the reference undertaking', () => {
	it('Traceability folds the 12 decomposition edges + intent traces from events', () => {
		const events = build();
		const view = rebuildProjection(traceabilityProjector, events);
		const decomposes = view.links.filter((l) => l.type === 'DECOMPOSES');
		expect(decomposes).toHaveLength(12); // root -> 7 areas, architecture -> 5 concerns
		// architecture decomposes into each concern
		for (const concern of [R.systemContext, R.multiTenancy, R.dataArch, R.integrations, R.mobileOffline]) {
			expect(decomposes.some((l) => l.from === R.architecture && l.to === concern)).toBe(true);
		}
		// every PWU traces to the intent
		expect(view.links.some((l) => l.from === R.architecture && l.to === R.intentId && l.type === 'TRACES_TO_INTENT')).toBe(true);
	});

	it('Compatibility derives a milestone for every PWU (architecture=ARCHITECTURE, promotion=COMMIT)', () => {
		const events = build();
		const view = rebuildProjection(compatibilityProjector, events);
		expect(Object.keys(view.milestoneByPwu)).toHaveLength(13);
		expect(view.milestoneByPwu[R.architecture]).toBe('ARCHITECTURE');
		expect(view.milestoneByPwu[R.promotion]).toBe('COMMIT');
		expect(view.milestoneByPwu[R.mobileOffline]).toBe('ARCHITECTURE'); // ARCHITECTURE_CONCERN kind
	});

	it('both projections rebuild identically via incremental fold (RPH-PER-007)', () => {
		const events = build();
		const traceInc = new IncrementalProjection(traceabilityProjector);
		traceInc.rebuild(events);
		expect(traceInc.current()).toEqual(rebuildProjection(traceabilityProjector, events));
		const compatInc = new IncrementalProjection(compatibilityProjector);
		compatInc.rebuild(events);
		expect(compatInc.current()).toEqual(rebuildProjection(compatibilityProjector, events));
	});
});

// ── JAN-PFA S3.3 · `assertClaim`: the ABOUT edge's IDENTITY ───────────────────────────────────────────────────
// CLOSES the inventoried gap `claimId: id` → `claimId: p.subjectObjectIds[0] ?? id`
// (`packages/rph-application/src/handlers/assurance.ts`, `assertClaim`).
//
// THE PROMISE. §13.1's ClaimAsserted carries a `claimId` precisely BECAUSE AssertClaim's payload does not:
// `AssertClaimPayloadSchema` has statement / claimType / subjectObjectIds only, so the claim id arrives in the
// envelope as `command.targetAggregateId` and the handler copies it across — its own comment says so. Nothing in
// the repo asserted that copy. The mutant writes the claim's FIRST SUBJECT into the field instead, and every
// existing signal agrees with it: `subjectObjectIds` is non-empty on every real AssertClaim, the §13.1
// strictObject still validates, the event type sequence replay-conformance compares is untouched, and even the
// ABOUT-link COUNT is unchanged. What changes is only WHO the nine edges run from: `traceabilityProjector`
// (`traceability-view.ts:54`, `claimId -> each subjectObjectId`) turns all nine into self-loops, and any audit
// reader joining a claim's events by payload id joins on the wrong aggregate.
//
// WHY THIS FILE. It is the only suite that folds the traceability projector over a LIVE engine log, so the
// `claimId` under test is the one `assertClaim` produced. `traceability-compatibility.test.ts:47` does assert an
// ABOUT link, but over HAND-WRITTEN events whose `claimId` the test supplies itself — no mutation of the handler
// can reach it. Until now this file asserted DECOMPOSES and TRACES_TO_INTENT and nothing about ABOUT.
describe('JAN-PFA ClaimAsserted identifies the CLAIM it records, not the claim\'s first subject', () => {
	it('every ABOUT edge is sourced at the asserting CLAIM aggregate', () => {
		const events = build();
		const view = rebuildProjection(traceabilityProjector, events);
		const about = view.links.filter((l) => l.type === 'ABOUT');

		// ⭐ THE EXPECTATION IS DERIVED FROM THE ENVELOPE (`aggregateId`), NEVER FROM `payload.claimId`. A
		// derivation that read the payload field would move with the mutation and both sides would agree on the
		// same wrong answer — an instrument that fails the way its subject does reads as agreement.
		const expected = events
			.filter((e) => e.eventType === 'ClaimAsserted')
			.flatMap((e) => {
				const subjects = (e.payload as { subjectObjectIds?: readonly string[] }).subjectObjectIds ?? [];
				return subjects.map((subject) => `${e.aggregateId}->${subject}`);
			});
		expect(expected.length).toBeGreaterThan(0); // the drive really does assert claims — not a vacuous pass
		expect(about.map((l) => `${l.from}->${l.to}`).sort()).toEqual([...expected].sort());

		// The same identity stated structurally, so the promise is pinned and not just this fixture's id strings:
		// an ABOUT edge runs CLAIM -> subject. Under the mutant `from` is the subject itself, which is a
		// PROFESSIONAL_WORK_UNIT (eight edges) or an ARTIFACT (the §25 chain's), and every edge is a self-loop.
		const claimAggregateIds = new Set(
			events.filter((e) => e.aggregateType === 'CLAIM').map((e) => e.aggregateId)
		);
		for (const l of about) {
			expect(claimAggregateIds.has(l.from)).toBe(true);
			expect(claimAggregateIds.has(l.to)).toBe(false);
			expect(l.from).not.toBe(l.to);
		}
	});

	// ⛔ THE CONTROL. Half the assertion above is a NEGATIVE shape — "no ABOUT edge is sourced at a subject" — and
	// a projector that emitted no ABOUT edges at all would satisfy it perfectly. That is the exact defect this
	// whole inventory catalogues: a refusal proven to HAPPEN and never proven to be PRECISE. So this pins that the
	// legitimate edge is still ADMITTED, by the two ratified ids the corpus itself names, and then pins the fact
	// that makes the test above capable of discriminating at all — in this fixture a claim is never its own
	// subject, so "sourced at the claim" and "sourced at the subject" are genuinely different answers.
	// ITS OWN MUTANT, and I checked which one actually separates the two rather than assuming. Deleting
	// `linksFor`'s `ClaimAsserted` arm does NOT separate them: the set-equality above reddens as well, because
	// its derived side stays at nine. What separates them is re-pointing the §25 chain's SUBJECT — assert the
	// Tenant Isolation claim ABOUT the multi-tenancy PWU instead of the Model artifact and the test above stays
	// GREEN (both of its sides derive from the same log, so it blesses whatever pair the drive happened to make)
	// while this control fails alone. Measured, not assumed: 1 failed / 4 passed, the failure being this test.
	it('control: the legitimate ABOUT edge is admitted, and no claim is its own subject', () => {
		const events = build();
		const view = rebuildProjection(traceabilityProjector, events);
		const about = view.links.filter((l) => l.type === 'ABOUT');

		// §25's constraint chain: the Tenant Isolation claim is asserted ABOUT the Tenant Isolation Model
		// artifact, under the two deterministic ids `REFERENCE_CONSTRAINT_CHAIN` declares rather than ones the
		// drive mints — a check that discovers its own subject can be satisfied by the wrong one.
		expect(about.some((l) => l.from === C.tenantIsolationClaim && l.to === C.tenantIsolationArtifact)).toBe(true);
		expect(about).toHaveLength(9); // nine claims, one subject each: nothing dropped, nothing invented

		const claimIds = new Set(events.filter((e) => e.aggregateType === 'CLAIM').map((e) => e.aggregateId));
		const subjectIds = new Set(
			events
				.filter((e) => e.eventType === 'ClaimAsserted')
				.flatMap((e) => (e.payload as { subjectObjectIds?: readonly string[] }).subjectObjectIds ?? [])
		);
		expect(subjectIds.size).toBeGreaterThan(0);
		for (const subject of subjectIds) expect(claimIds.has(subject)).toBe(false);
	});
});
