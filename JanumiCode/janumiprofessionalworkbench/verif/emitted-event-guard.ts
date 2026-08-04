// THE EMITTED-EVENT LEDGER — every event this system writes, checked against its own declared shape, across the
// WHOLE SUITE rather than one drive (REG-F-020).
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// `packages/rph-engine/src/emitted-event-conformance.test.ts` already does this — over the events the Reference
// Undertaking happens to emit. Its register comment read "THE REGISTER IS NOW CLEARED — every event this system
// emits conforms to its own declared shape", down from twelve, each fixed deliberately. That sentence is true as
// written and reads as far more than it is: the drive emits 34 of the catalog's 132 declared types, so the
// register was cleared over a quarter of the population and silent about the rest.
//
// IT TOOK ONE NEW DISPATCH TO EXPOSE THAT. Closing RPH-FIX-005 made the drive record its first ever artifact, and
// the register immediately grew an entry (`ArtifactRecorded` carried an `artifactId` its strict shape rejects).
// Nothing about the handler had changed — only the population had. So the question this file answers is what else
// is in there.
//
// MEASURED, by instrumenting the commit path and running the full suite: 19,581 event commits, 89 DISTINCT event
// types, and TWENTY-ONE types emitting a payload their own declared shape rejects. The drive-scoped register saw
// one of them.
//
// TWENTY OF THE TWENTY-ONE ARE REAL, and the twenty-first is not — a correction made by DUMPING the payloads
// rather than reading the handlers. `PwuMarkedReady` looked like the same defect and is not: `markPwuReady`
// already supplies a conforming `eventPayload`, and the nonconforming commit comes from `event-gate.test.ts`
// emitting `{total: 'garbage'}` ON PURPOSE. It is filed below in a SEPARATE list, because a defect ledger that
// contains a non-defect sends someone to fix a handler that is correct.
//
// TWENTY OF THE TWENTY ARE NOW FIXED BUT ONE. `WaiverRequested` is the exception and its refusal is deliberate:
// emitting its declared shape drops `waivedPolicyId`, which `foldWaiverRequested` in
// `packages/rph-projections/src/assurance-view.ts` reads as its ATTACHMENT PREDICATE — and that projection is a
// pure fold with no store handle, so the Decision object where the datum lives is unreachable to it. Conforming
// would make every waiver attach to every assessment whose subjects it intersects, under any policy, AND STAY
// GREEN, because that projection tests itself on hand-built events. Closing it means widening the ratified shape
// or teaching the projection to read the Decision object — a two-package change for one commit.
//
// ── WHAT THIS IS AND IS NOT ──────────────────────────────────────────────────────────────────────────────────
// A DEFECT LEDGER, not a specification. Every entry below is a defect with its MEASURED violation as its reason —
// not a hand-written rationale, because a rationale for twenty-one entries authored in one sitting is exactly the
// bulk fabrication this programme exists to prevent. The list must only ever SHRINK: fixing a handler deletes its
// entry, and a NEW nonconforming event type fails the run immediately.
//
// EACH ENTRY IS ONE OF TWO SHAPES, and the split is the useful part:
//   * the event emits the RAW COMMAND PAYLOAD while its declared shape describes the RESULTING STATE — so the
//     event recording "this became REVOKED" does not contain the word REVOKED. These are the `status` /
//     `authorizationStatus` / `workLifecycleState` entries, and they are the ones a projection must read to know
//     what happened.
//   * the event carries KEYS the strict shape rejects outright (`Unrecognized key`) — the `ArtifactRecorded`
//     shape, five more times.
// Both were named by the drive-scoped register when it stood at twelve. Neither class was ever closed; it was
// closed for the events one drive emits.
//
// ── SCOPE, stated so this is not read as more than it is (the mistake it exists to correct) ──────────────────
//
//  1. It observes what the SUITE emits. A declared event type no test ever produces is still unmeasured — 43 of
//     the 132 remain in that state, and no gate can reach them without a dispatch that emits them. This file
//     shrinks that blind spot from 98 to 43; it does not abolish it.
//  2. IT CANNOT DETECT A STALE LEDGER ROW. Vitest runs each project in its own worker, so `violations` is
//     per-worker and no worker sees the whole catalog — an entry here for a type nothing emits any more would sit
//     unnoticed. Every one of the twenty-one WAS observed when measured; a future one might not be. Closing that
//     needs cross-worker aggregation, which is more machinery than this is worth today and is named rather than
//     pretended away. ("More names = weaker" is the discipline: each row makes this gate accept more.)
//  3. It says nothing about events with NO declared shape — `continue`, deliberately, because conflating "no
//     contract" with "contradicts its contract" would hide both.
import { EVENTS } from '@janumipwb/rph-contracts';
import type { DomainEvent } from '@janumipwb/rph-contracts';
import type { CommitInput, CommitResult } from '@janumipwb/rph-ports';
import { SnapshotOverlayStorageAdapter, SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { afterAll } from 'vitest';

/**
 * Event types KNOWN to emit a payload their own declared shape rejects, each with the violation as measured on
 * 2026-08-04. RATCHET: this list may only shrink. Fix the handler (see \`kit.ts\`'s `eventPayload` seam, which
 * exists for exactly this) and delete the row.
 */
const KNOWN_NONCONFORMING: Readonly<Record<string, string>> = {
	WaiverRequested:
		'decisionType: Invalid option: expected one of "APPROVAL"|"REJECTION"|"WAIVER"|"ESCALATION"|"RESHAPE"|"REPLAN"|"PROMOTE_BASELINE"|"ABANDON"|"REVOKE"'
};

/**
 * NOT DEFECTS — types that appear nonconforming only because a test emits a bad payload ON PURPOSE.
 *
 * A SEPARATE LIST BECAUSE IT MEANS SOMETHING ELSE. `event-gate.test.ts` exists to prove the (d2) event gate's
 * SCOPE: a RATIFIED event with a bad payload is refused, and an UNRATIFIED-AUTHORED one is ALLOWED — "we do not
 * enforce shapes we authored ourselves as though the corpus had ratified them". Its negative arrangement commits
 * `PwuMarkedReady` with `{"total":"garbage","not":"a real payload"}`, through a real command, so it carries a
 * `commandId` and is indistinguishable from handler output at the commit path.
 *
 * MEASURED, NOT ASSUMED: the payload was dumped before this row was written. `markPwuReady` itself already
 * supplies a conforming `eventPayload` (workLifecycleState from the committed next state), which is why the
 * obvious reading — "another handler emitting its command payload" — was wrong. Filing it as a defect would have
 * put a non-defect in a defect ledger and sent someone to fix a handler that is correct.
 */
const DELIBERATE_TEST_FIXTURES: Readonly<Record<string, string>> = {
	PwuMarkedReady:
		"event-gate.test.ts's negative arm commits `{total: 'garbage'}` to prove an UNRATIFIED event is not refused"
};

type PayloadSchema = { safeParse: (v: unknown) => { success: boolean } };
const SCHEMAS = EVENTS as unknown as Record<string, { payload?: PayloadSchema } | undefined>;

/** Event types seen violating their shape in THIS worker. Module-scoped: one report per worker at the end. */
const violations = new Set<string>();

/**
 * Handler-produced events this worker actually inspected, and the types among them.
 *
 * A LIVENESS COUNTER, because this guard is a prototype patch in a setup file and those fail SILENTLY in the one
 * way that matters: if it stops being reached, every run is green and the ledger below certifies nothing. That is
 * not hypothetical — while this file was being built, a probe edit left a literal newline inside a string
 * literal, the module stopped parsing, and three consecutive runs reported "no violations" that were really "no
 * guard". `emitted-event-guard.test.ts` asserts these move.
 */
export const liveness = { inspected: 0, types: new Set<string>() };

/** The ledger, exported so its own test can assert it holds only types this suite still emits. */
export const LEDGER: Readonly<Record<string, string>> = KNOWN_NONCONFORMING;

function checkEvents(events: readonly DomainEvent[]): void {
	for (const event of events) {
		// ONLY EVENTS A HANDLER PRODUCED. `rph-persistence`'s own tests commit SYNTHETIC events straight to the
		// adapter to exercise the store — `{ eventType: 'IntentCaptured', payload: { note: 'int_A' } }` is testing
		// atomicity, not the intent contract, and nothing ever claimed that payload conforms. Counting it would
		// put two non-defects in a defect ledger.
		//
		// `commandId` IS THE DISCRIMINATOR, and it is sound rather than convenient: `kit.ts`'s `makeEvent` sets it
		// from the command on every path, and `Engine.dispatch` REFUSES a command without one (REG-F-011's
		// identity guard). So a handler-produced event cannot lack it, and a hand-built fixture event has no
		// reason to carry it. The guard rests on a property another finding made true.
		if (typeof event.commandId !== 'string' || event.commandId.length === 0) continue;
		liveness.inspected += 1;
		liveness.types.add(event.eventType);
		const schema = SCHEMAS[event.eventType]?.payload;
		// No declared shape is not a violation — it is a different gap, and one this file must not conflate with
		// a shape the event actively contradicts.
		if (!schema) continue;
		if (!schema.safeParse(event.payload).success) violations.add(event.eventType);
	}
}

/**
 * Wrap `commit` on every StorageAdapter the repository ships. THE COMMIT PATH, not the dispatch path: an event
 * exists as a durable fact only once it is committed, and wrapping `Engine.dispatch` would miss events written
 * through a handler's own transaction (the `#pwa-version` derived commit is exactly that shape).
 */
function instrument(proto: { commit: (input: CommitInput) => CommitResult }): void {
	const original = proto.commit;
	proto.commit = function patchedCommit(this: unknown, input: CommitInput): CommitResult {
		checkEvents(input.events);
		return original.call(this, input) as CommitResult;
	};
}

instrument(SqliteStorageAdapter.prototype);
instrument(SnapshotOverlayStorageAdapter.prototype);

afterAll(() => {
	const unexpected = [...violations]
		.filter((t) => KNOWN_NONCONFORMING[t] === undefined && DELIBERATE_TEST_FIXTURES[t] === undefined)
		.sort((a, b) => a.localeCompare(b));
	if (unexpected.length > 0) {
		throw new Error(
			`Emitted-event ledger: ${unexpected.length} event type(s) emitted a payload their own declared ` +
				`shape REJECTS, and are not in the ledger:\n  ${unexpected.join('\n  ')}\n\n` +
				`Either the handler emits the wrong thing (fix it — \`kit.ts\` takes an explicit \`eventPayload\` for ` +
				`exactly this) or the declared shape describes something the event was never for. Both are ours. ` +
				`Adding a row to KNOWN_NONCONFORMING is a LAST resort and makes the ledger grow, which it may not do.`
		);
	}
});
