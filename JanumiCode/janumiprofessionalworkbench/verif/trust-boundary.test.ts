// THE TRUST BOUNDARY, AND THE PROOF THAT IT CAN REFUSE.
//
// JPWB-DOC-003 §9 PER-3 requires canonical state be mutated "only through authenticated, authorized,
// semantically named commands", and its SCOPE clause makes **"the existence and completeness of the gate"** the
// semantic requirement. JPWB-DOC-004 §5: "derive tenant and principal context from authenticated context,
// never from a payload's claim about itself." REG-D-027 / REG-D-028 settle the shape.
//
// ⚠ WHY THIS FILE IS NOT OPTIONAL. Every other test in this repository presents a VALID credential and gets on
// with its subject, so the whole suite could stay green over a gate that never refuses anything. That is the
// exact anatomy of the three controls this repository has already shipped green. The assertions below are the
// only ones that drive the refusal paths, and each names the mutant it exists to kill.
import { describe, expect, it } from 'vitest';
import { createEngine } from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import {
	TEST_CRED,
	UNKNOWN_CRED,
	testAuthenticator,
	testDirectory,
	testPrincipal
} from '@janumipwb/rph-ports/testing';

const TS = '2026-08-07T00:00:00.000Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69TB001';

function engine() {
	let n = 0;
	return createEngine({
		authenticate: testAuthenticator(),
		ontology,
		now: () => TS,
		newEventId: () => `e${++n}`
	});
}

/** A CaptureIntent that declares no issuer — the shape a caller should use now. */
function captureIntent(overrides: Partial<DomainCommand> = {}): DomainCommand {
	return {
		commandId: 'tb-1',
		commandType: 'CaptureIntent',
		commandSchemaVersion: 1,
		targetAggregateType: 'INTENT',
		targetAggregateId: INTENT,
		issuedAt: TS,
		correlationId: 'tb',
		idempotencyKey: 'tb-idem-1',
		payload: {
			intentId: INTENT,
			originatingExpression: 'ship the thing',
			ontologyId: 'product-realization-pwa',
			ontologyVersion: '1.3.0'
		},
		...overrides
	} as DomainCommand;
}

describe('the trust boundary refuses, and the refusals are reachable', () => {
	it('A1 — an unresolvable credential is refused, and NOTHING is written', () => {
		// MUTANT: make the engine proceed when the port returns no principal, or give the test directory a
		// `?? SOME_PRINCIPAL` default. Either reddens here and nowhere else, because this is the only place
		// that presents a credential the directory does not hold.
		const e = engine();
		const r = e.as(UNKNOWN_CRED).dispatch(captureIntent());

		expect(r.status, 'an unknown credential must not act').toBe('UNAUTHORIZED');
		expect(r.error?.code).toBe('RPH_AUTHENTICATION_REQUIRED');
		expect(e.loadObject(INTENT), 'a refused command must leave no object').toBeUndefined();
		expect(e.readAllEvents(), 'and no event').toHaveLength(0);
	});

	it('A2 — CONTROL: a resolvable credential is accepted, so A1 is not "refuses everything"', () => {
		// Without this, an engine that refused every command would satisfy A1 perfectly. REG-F-015's anatomy:
		// a true assertion about an arrangement that never happened.
		const e = engine();
		expect(e.as(TEST_CRED.human).dispatch(captureIntent()).status).toBe('ACCEPTED');
	});

	it('A3 — the ENGINE stamps the acting identity; the caller does not supply it', () => {
		const e = engine();
		expect(e.as(TEST_CRED.agent).dispatch(captureIntent()).status).toBe('ACCEPTED');

		const stored = e.loadObject(INTENT)?.state as { createdBy?: { actorId?: string } } | undefined;
		const expected = testPrincipal(TEST_CRED.agent);
		// MUTANT: stop overwriting `issuedBy` in `stampOrRefuse`. The command above declares NO issuer, so a
		// non-stamping engine would write undefined here rather than the agent.
		expect(stored?.createdBy?.actorId, 'the record must name the AUTHENTICATED actor').toBe(
			expected.actorId
		);
	});

	it('A4 — a declared issuer that DISAGREES is refused, not silently corrected', () => {
		// This is the clause REG-D-027 turns on. Correcting quietly would leave the record truthful and the
		// ATTEMPT invisible; refusing makes the attempt a governed fact.
		const e = engine();
		const forged = captureIntent({
			issuedBy: { actorId: 'somebody-else', actorType: 'HUMAN', displayName: 'Not Me' }
		} as Partial<DomainCommand>);

		const r = e.as(TEST_CRED.human).dispatch(forged);
		expect(r.status).toBe('UNAUTHORIZED');
		expect(r.error?.code).toBe('RPH_AUTHENTICATION_REQUIRED');
		expect(r.error?.message, 'the refusal must name both identities so it can be audited').toContain(
			'somebody-else'
		);
		expect(e.readAllEvents(), 'a forged issuer writes nothing').toHaveLength(0);
	});

	it('A5 — CONTROL: a declared issuer that AGREES is accepted', () => {
		// Without this, an engine that refused EVERY command carrying an `issuedBy` would satisfy A4 while
		// protecting nothing — and would also make the field unusable rather than checked.
		const e = engine();
		const p = testPrincipal(TEST_CRED.human);
		const honest = captureIntent({
			issuedBy: { actorId: p.actorId, actorType: p.actorType, displayName: p.displayName }
		} as Partial<DomainCommand>);
		expect(e.as(TEST_CRED.human).dispatch(honest).status).toBe('ACCEPTED');
	});

	it('A6 — a fork inherits its session, so a turn cannot be re-attributed', () => {
		// REG-D-028's second hazard: if a fork came back unauthenticated the authoring turn could not dispatch,
		// and if it came back bound to someone else the recorded commands would carry the wrong actor into the
		// replay. MUTANT: drop the `fork` override in `createEngine`'s `as`.
		const e = engine().as(TEST_CRED.agent);
		const forked = e.fork();
		expect(forked.dispatch(captureIntent()).status).toBe('ACCEPTED');

		const stored = forked.loadObject(INTENT)?.state as { createdBy?: { actorId?: string } } | undefined;
		expect(stored?.createdBy?.actorId, 'the fork acts as the session that made it').toBe(
			testPrincipal(TEST_CRED.agent).actorId
		);
	});
});

describe('CONTROL — the fixtures cannot launder a caller-chosen identity', () => {
	it('testDirectory refuses an actor it was never given', () => {
		// (b) in `testing.ts`: a directory a caller can extend at dispatch time is the permissive authenticator
		// wearing a hat. Registration must happen up front, in the fixture.
		const dir = testDirectory([
			{
				actorId: 'registered',
				actorType: 'HUMAN',
				displayName: 'R',
				tenantId: 't',
				organizationId: 'o'
			}
		]);
		expect(() => dir.credentialFor('never-registered')).toThrow(/No principal registered/);
		expect(dir.credentialFor('registered')).toBeTruthy();
	});

	it('the shared directory resolves ONLY its four credentials', () => {
		const auth = testAuthenticator();
		for (const c of Object.values(TEST_CRED)) expect(auth.authenticate(c).ok).toBe(true);
		expect(auth.authenticate(UNKNOWN_CRED).ok, 'closed means closed').toBe(false);
	});
});
