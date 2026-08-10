// JPWB-SPEC-001-DR-002 W-2 — the demo host's engine survives a restart.
//
// THE DEFECT THIS PINS. `createSqliteDriver(filename = ':memory:')` and `CreateEngineDeps.store` document the
// default plainly: "Defaults to an in-memory SqliteStorageAdapter." The demo host passed `ontology`,
// `validateOntology` and a test clock, and NEVER a store — so every Undertaking, Decision and Baseline a
// professional authored existed only until the server process ended. `workbench.ts:182` already conceded it in a
// comment: the transcript "survives reloads (and, when the engine is backed by a durable store, restarts)".
//
// WHAT WAS AND WAS NOT MISSING, because the roadmap's finding F-F overstated it. Durability at the STORE boundary
// was already proven — `packages/rph-persistence/src/durability.test.ts` persists to a file, closes, reopens, and
// reads back byte-identical canonical state. Nothing here re-proves that. The gap was one layer up and one line
// wide: the HOST never asked for a file. These tests pin the host.
//
// THE TWO CLAIMS ARE SEPARATE, AND ONLY ONE OF THEM IS ABOUT THE PATH.
//   1. Authored state written before a restart is readable after it.
//   2. Reopening a populated store does NOT seed it again.
// (2) is not a nicety. `getEngine()` seeded unconditionally on first use, so making the store durable WITHOUT a
// guard would mint a fresh reference workbench on every boot — and the round-trip in (1) would still pass, because
// the object it looks for is there among the duplicates. A durable store that doubles its seed each restart is a
// worse defect than the volatile one it replaced, and it would have shipped behind a green (1).
import { existsSync, rmSync } from 'node:fs';
import { SESSION_CREDENTIAL } from './identity.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openWorkbench } from './workbench.js';

let fileSeq = 0;
const created: string[] = [];

function tempDbPath(): string {
	const path = join(tmpdir(), `rph-demo-w2-${process.pid}-${++fileSeq}.db`);
	created.push(path);
	return path;
}

afterEach(() => {
	for (const path of created.splice(0)) {
		for (const suffix of ['', '-wal', '-shm']) {
			const p = `${path}${suffix}`;
			// Best-effort: a test that fails BEFORE its `close()` leaves the handle open, and Windows refuses to
			// unlink an open file. Letting EPERM through would replace the real assertion failure in the report
			// with a cleanup error, which is how a diagnosis gets lost.
			try {
				if (existsSync(p)) rmSync(p);
			} catch {
				/* the OS still holds it; the temp dir is the backstop */
			}
		}
	}
});

/**
 * A well-formed RphId — `<prefix>_<26 Crockford base32 chars>` — checked against the engine's own pattern here
 * rather than counted by eye. A malformed id is refused by schema validation, which reports "Schema validation
 * failed" and reads exactly like a store problem; this keeps a rejection meaning what it says.
 */
function rphId(prefix: string, suffix: string): string {
	const id = `${prefix}_${suffix.padStart(26, '0')}`;
	expect(id, 'the probe id must be well-formed, or a rejection says nothing about durability').toMatch(
		/^([a-z]+)_([0-9A-HJKMNP-TV-Z]{26})$/
	);
	return id;
}

/** Author one distinctive Intent — something the SEED does not contain, so its survival is about the store. */
function captureIntent(
	engine: ReturnType<ReturnType<typeof openWorkbench>['as']>,
	intentId: string
): void {
	const result = engine.dispatch({
		commandId: `w2-${intentId}`,
		commandType: 'CaptureIntent',
		commandSchemaVersion: 1,
		targetAggregateType: 'INTENT',
		targetAggregateId: intentId,
		issuedAt: '2026-07-28T00:00:00.000Z',
		correlationId: 'w2',
		idempotencyKey: `w2-idem-${intentId}`,
		payload: {
			intentId,
			originatingExpression: 'survive a restart',
			// `PRBE`, not `PROBE`: Crockford base32 excludes I, L, O and U to keep ids unambiguous when read aloud.
			ontologyId: rphId('pwa', 'PRBE'),
			ontologyVersion: '1.0.0'
		}
	});
	// The rejection DETAIL, not just its message: `RPH_VALIDATION_SCHEMA_FAILED` carries per-field issues, and a
	// bare "Schema validation failed" sends the reader guessing at which field — which it did, once, here.
	expect(
		result.status,
		`CaptureIntent should be ACCEPTED — ${result.error?.message ?? ''} ${JSON.stringify(result.error?.details ?? {})}`
	).toBe('ACCEPTED');
}

describe('W-2 — the demo workbench is durable across a restart', () => {
	it('authored state written before a restart is readable after it', () => {
		const path = tempDbPath();
		const intentId = rphId('int', 'W2SRVR');

		const first = openWorkbench(path).as(SESSION_CREDENTIAL);
		captureIntent(first, intentId);
		first.close();

		// A brand-new host over the SAME file. Nothing in memory carries over.
		const restarted = openWorkbench(path).as(SESSION_CREDENTIAL);
		try {
			const found = restarted.readAllEvents().filter((e) => e.aggregateId === intentId);
			expect(found.length, 'the Intent authored before the restart must survive it').toBeGreaterThan(0);
		} finally {
			restarted.close();
		}
	});

	// WHAT THIS TEST DOES AND DOES NOT PROVE, measured rather than assumed.
	//
	// It was written as the CONTROL over `openWorkbench`'s seed guard, on the reasoning that a durable store
	// without the guard would re-seed on every boot. THE MUTATION SAYS OTHERWISE: replacing the guard with an
	// unconditional `seedWorkbench(engine)` leaves all three tests GREEN, because the seed dispatches fixed
	// aggregate ids through the engine's idempotency, and a re-seed of a populated store adds no events.
	//
	// So the guard is defence in depth, not the mechanism — and no mutation of it reddens anything, which is why
	// the ledger records no mutant for it. (V-3d: a victim that never reddens must not be recorded. Three were,
	// once, and finding them cost a full probe of every entry.) It is kept because it is correct and because it
	// keeps holding if a future seed step mints a non-deterministic id, at which point idempotency stops covering
	// this — but that is a claim about the future, and this comment is not evidence for it.
	//
	// The test still earns its place: it pins the user-visible PROPERTY that a restart does not duplicate the
	// workbench, by whatever mechanism currently delivers it.
	it('reopening a populated store does not seed it a second time', () => {
		const path = tempDbPath();

		const first = openWorkbench(path).as(SESSION_CREDENTIAL);
		const seededEvents = first.readAllEvents().length;
		first.close();

		// THE ARRANGEMENT, ASSERTED RATHER THAN ASSUMED. If the first open seeded nothing there would be nothing to
		// duplicate, and a host that re-seeds on every boot would be indistinguishable from one that does not.
		expect(seededEvents, 'the first open must seed the reference workbench').toBeGreaterThan(0);

		const restarted = openWorkbench(path).as(SESSION_CREDENTIAL);
		try {
			expect(
				restarted.readAllEvents().length,
				'reopening must not re-seed — a store that doubles its seed each restart is worse than a volatile one'
			).toBe(seededEvents);
		} finally {
			restarted.close();
		}
	});

	// ⚠ THIS TEST WAS A CONTROL THAT COULD NOT FAIL, AND THE MUTATION LEDGER IS WHAT SAID SO (REG-F-099).
	//
	// AS WRITTEN it asserted `restarted.recoverOutbox() === 0`, reasoning: "if startup already recovered them, a
	// second call finds nothing left." `W2-b-the-durable-host-never-recovers-its-outbox` deletes the startup call
	// — and SURVIVED, all four tests green.
	//
	// WHY, measured rather than reasoned: `drainOutbox` returns 0 AND LEAVES EVERY ROW PENDING when no subscriber
	// is registered (command-bus.ts — "nothing is marked when there is nobody to deliver to … a growing outbox
	// becomes the visible form of 'no consumer exists' instead of a silent discard"). `openWorkbench` registers
	// none. So **0 is the pass value for both worlds**: recovered-everything and delivered-nothing return the same
	// number, and the assertion could never tell them apart.
	//
	// AND THE REMEDY IT GUARDS IS ITSELF INERT TODAY. Probed on a real restart: the startup call returns **0** and
	// delivers **0**; register a subscriber and the very same call recovers **446** messages that had been sitting
	// PENDING the whole time. `workbench.ts`'s own comment — "Measured before this line existed: a restart left 300
	// entries PENDING and never re-drove them" — is still true AFTER the line exists. The enabling fact was already
	// in the register (`enforcement-register.ts`: *"nothing in production ever registers an event SUBSCRIBER"*);
	// W-2 shipped a recovery call that depends on one, and a control that reads its absence as success.
	//
	// SO THE ASSERTION IS NOW RELATIONAL, AND IT IS THE THING THAT CANNOT BE TRUE OF BOTH WORLDS: with a subscriber
	// attached, a restarted host must find work still PENDING **iff** startup did not deliver it. Today it does,
	// which is the admission this test now carries in place of a false reassurance. The day a subscriber is wired
	// at startup, this reddens and becomes the refusal — and `W2-b` becomes killable, which is why that entry is
	// declared `expectSurvive` with this invariant named rather than left reporting a bare SURVIVED.
	it('ADMISSION — startup recovery delivers nothing, because the host registers no subscriber', () => {
		const path = tempDbPath();
		const first = openWorkbench(path).as(SESSION_CREDENTIAL);
		captureIntent(first, rphId('int', 'W2XBX'));
		first.close();

		const restarted = openWorkbench(path).as(SESSION_CREDENTIAL);
		try {
			// What startup's own call reports, and what it is worth.
			expect(
				restarted.recoverOutbox(),
				'with no subscriber, drainOutbox reports 0 whether or not anything was delivered'
			).toBe(0);
			// THE DISCRIMINATOR. Give the host somewhere to deliver and ask again: anything returned here is work
			// startup left stranded. A count is asserted rather than a threshold on both sides, because ">0" would
			// also pass if the store re-seeded (which the test above forbids) — the pairing is what makes it mean
			// "stranded" rather than merely "non-empty".
			let delivered = 0;
			restarted.subscribe(() => {
				delivered += 1;
			});
			const stranded = restarted.recoverOutbox();
			expect(
				{ stranded: stranded > 0, delivered: delivered === stranded },
				'if `stranded` is 0 a subscriber has been wired at startup — delete this admission and restore the ' +
					'CONTROL, and make `W2-b` a KILLED mutant again'
			).toEqual({ stranded: true, delivered: true });
		} finally {
			restarted.close();
		}
	});

	it('an in-memory host is still seeded, so omitting a path keeps today’s behaviour', () => {
		// The default path must not become "empty workbench": the demo with no `JPWB_DEMO_DB` set is the seeded
		// reference workbench, exactly as before W-2.
		const engine = openWorkbench(undefined).as(SESSION_CREDENTIAL);
		try {
			expect(engine.readAllEvents().length).toBeGreaterThan(0);
		} finally {
			engine.close();
		}
	});
});
