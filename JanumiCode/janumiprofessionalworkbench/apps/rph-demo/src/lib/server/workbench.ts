// The server-side engine host. The RPH engine runs ONLY here (Node; better-sqlite3) — never in the browser. A
// single lazily-seeded in-memory engine backs every request: on first use it seedWorkbench()s one PUBLISHED
// Product Realization PWA + the Field Service Management Undertaking + its live Professional Work Graph. Route
// `load()`s read the current state through the query surface; form actions dispatch real commands into this same
// engine, so authoring (create a PWA, advance a PWU, …) mutates live state.
//
// TEST MODE (RPH_DEMO_MODE=test, set by the Playwright webServer): the engine additionally runs on a deterministic
// clock + id sequence and can be reset between specs (see resetEngine + the /test-api endpoints), so the E2E
// harness gets stable, isolated state. Test mode is NEVER enabled in a normal `bun run dev` / production boot.
import {
	createEngine,
	getConversation,
	getObject,
	listPwuTypes,
	seedPolicyLibrary,
	seedWorkbench,
	type EngineHandle
} from '@janumipwb/rph-engine';
import { ontology, validateOntology } from '@janumipwb/rph-product-realization-pwa';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { PwaAuthoringBroker } from '@janumipwb/rph-authoring';
import { buildPwaGraphExport, type PwaGraphExport } from '@janumipwb/rph-projections';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { monotonicFactory } from 'ulid';
import {
	AGENT_CREDENTIAL,
	SESSION_CREDENTIAL,
	SYSTEM_CREDENTIAL,
	standaloneAuthenticator
} from './identity.js';

const TEST_MODE = process.env.RPH_DEMO_MODE === 'test';
const productionUlid = monotonicFactory();

/**
 * Where the durable store lives, or undefined for the in-memory one.
 *
 * TEST MODE IGNORES IT UNCONDITIONALLY. The E2E harness resets the engine between specs and depends on each spec
 * starting from a known state; a durable store shared across specs would make them order-dependent, which is the
 * failure mode `resetEngine` exists to prevent. So test mode is in-memory by construction, not by configuration.
 */
const DB_PATH = TEST_MODE ? undefined : process.env.JPWB_DEMO_DB;

let handle: EngineHandle | null = null;
let cmdSeq = 0;
let idSeq = 0;

// Bridge: a fresh Undertaking's originating Intent id, remembered until its first PWU exists (after which the
// intent is resolvable from any of the Undertaking's PWUs — they all carry intentId). Cleared on reset.
const undertakingIntent = new Map<string, string>();

/** Remember the originating Intent id for a newly created Undertaking (so its first PWU can bind to it). */
export function registerUndertakingIntent(undertakingId: string, intentId: string): void {
	undertakingIntent.set(undertakingId, intentId);
}

/** The remembered originating Intent id for an Undertaking created this process that has no PWU yet. */
export function getRegisteredIntent(undertakingId: string): string | undefined {
	return undertakingIntent.get(undertakingId);
}

// Deterministic monotonic clock for test mode: stable event timestamps => diffable screenshots + reproducible logs.
const TEST_EPOCH = Date.UTC(2026, 0, 1);
let clockTick = 0;
function testNow(): string {
	clockTick += 1;
	return new Date(TEST_EPOCH + clockTick * 1000).toISOString();
}

/** The host clock as an ISO string: the deterministic monotonic test clock under E2E, wall-clock otherwise. */
export function hostNow(): string {
	return TEST_MODE ? testNow() : new Date().toISOString();
}

/**
 * The engine, with the PWA's OWN ontology validator (OVR) WIRED.
 *
 * `createEngine` has always thrown on any issue `validateOntology` reports — but nothing ever supplied it, so
 * the check was a dead seam. It could not be wired, either: it reported **21** unresolved references, because
 * the ratified conformance profiles and PWU templates name **12** policies and the ontology shipped **6**.
 * HIGH_ASSURANCE — the profile for security-sensitive, regulated, hard-to-reverse work — listed 12 mandatory
 * policies of which half did not exist, so the profile intended for high-consequence work was unsatisfiable.
 * A test pinned that as a known gap ("references to the not-yet-authored core policies").
 *
 * The catalog is now complete (DOC-004 §18/§20/§22/§24/§25/§26 seeded), the OVR reports 0, and the seam is
 * live. That is what makes the completion permanent instead of a snapshot: deleting a policy, or adding a
 * profile/template reference to one that does not exist, now fails engine construction rather than silently
 * producing an unsatisfiable profile.
 */
function newEngine(dbPath?: string): EngineHandle {
	const base = {
		ontology,
		validateOntology,
		// THE TRUST BOUNDARY. Standalone still AUTHENTICATES — the sponsor's own framing — so this is a real
		// local identity table, not a bypass (REG-D-027; `./identity.ts`).
		authenticate: standaloneAuthenticator(),
		...(dbPath ? { store: new SqliteStorageAdapter({ filename: dbPath }) } : {})
	};
	// ⚠ THE HOST RETURNS AN UNAUTHENTICATED HANDLE, DELIBERATELY. Callers open their own session with the
	// credential that matches WHO THEY ARE — SESSION for the surface, AGENT for the broker, SYSTEM for the
	// seed. Binding one here would give every caller the same identity, which is REG-F-054's defect restored
	// one layer up. (A codemod briefly wired the TEST authenticator into this production path; it is removed.)
	return createEngine(TEST_MODE ? { ...base, now: testNow } : base);
}

/**
 * Open the workbench engine, seeding it ONLY if its store is empty (DR-002 W-2).
 *
 * `dbPath` undefined keeps the pre-W-2 behaviour exactly: an in-memory store, seeded on creation. Given a path,
 * the store is a file and everything a professional authors survives a restart — which is what `recordConversation`
 * below has promised in a comment since it was written ("survives reloads and, when the engine is backed by a
 * durable store, restarts").
 *
 * THE SEED GUARD IS THE LOAD-BEARING HALF, and it is easy to omit because omitting it still passes a round-trip
 * test: `getEngine()` seeded unconditionally on first use, so making the store durable without this check would
 * mint a whole second reference workbench on every boot, and the authored object a round-trip looks for would
 * still be there — among the duplicates. A store that doubles its seed each restart is a worse defect than the
 * volatile one it replaces. `workbench-durability.test.ts` names it as a CONTROL for that reason.
 */
export function openWorkbench(dbPath?: string): EngineHandle {
	const engine = newEngine(dbPath);
	// ⚠ SYSTEM, NOT THE USER. Seeding runs at construction before any session exists, and it is ~80% of all
	// dispatches by volume. Handing it the human's credential would put a fiction into `createdBy` on every
	// seeded object and would defeat D-2 at the largest site in the system.
	if (engine.readAllEvents().length === 0) seedWorkbench(engine.as(SYSTEM_CREDENTIAL));
	// A DURABLE HOST SHALL RECOVER ITS PENDING OUTBOX AT STARTUP — `EngineHandle.recoverOutbox`, WP-2-007. The
	// obligation has existed since the engine gained a durable store; until W-2 the demo had none, so it bound
	// nothing and no one noticed. Measured before this line existed: a restart left **300** entries PENDING and
	// never re-drove them. Guarded on `dbPath` because only a durable store carries work across a restart — a
	// fresh in-memory store has nothing to recover, and draining the seed's own enqueue at construction would
	// change the in-memory host's behaviour to no purpose.
	if (dbPath) engine.recoverOutbox();
	return engine;
}

/** The shared, seeded engine (created + seeded once per server process). */
export function getEngine(): EngineHandle {
	handle ??= openWorkbench(DB_PATH);
	return handle;
}

/** Whether the host is running in E2E test mode (RPH_DEMO_MODE=test). Guards the /test-api endpoints. */
export function isTestMode(): boolean {
	return TEST_MODE;
}

/** TEST MODE ONLY — tear down and recreate the engine so each E2E spec starts from a known state.
 *  `reference` re-seeds the FSM reference workbench (published PWA + Undertaking + graph); `empty` leaves a bare
 *  engine (no authored PWAs/Undertakings) so authoring flows can be driven from scratch. Throws outside test mode. */
export function resetEngine(seed: 'reference' | 'empty'): void {
	if (!TEST_MODE) throw new Error('resetEngine is only available when RPH_DEMO_MODE=test');
	handle?.close();
	cmdSeq = 0;
	idSeq = 0;
	clockTick = 0;
	undertakingIntent.clear();
	handle = newEngine();
	// Always seed the policy library (floor + additive) so the policy manager + picker are populated even in the
	// authoring-from-scratch ('empty') flow; 'reference' additionally authors the published Product Realization PWA.
	// SYSTEM, for the same reason as the boot seed: this runs with no user session in scope.
	if (seed === 'reference') seedWorkbench(handle.as(SYSTEM_CREDENTIAL));
	else seedPolicyLibrary(handle.as(SYSTEM_CREDENTIAL));
}

/** The command fields a UI action supplies; this host owns the common command envelope. */
export interface UiCommandInput {
	readonly commandType: string;
	readonly targetAggregateType: string;
	readonly targetAggregateId: string;
	readonly payload: unknown;
	/** The aggregate revision the PAGE WAS RENDERED FROM, round-tripped through the form. Declaring it
	 *  is what makes a surface dispatch optimistic rather than last-write-wins (PER-4; SPEC-001
	 *  §11.4.22 item 2). Omit it only where the caller genuinely never read the subject — never to
	 *  avoid a conflict. */
	readonly expectedRevision?: number;
}

/** Build one UI-authored command with the same envelope policy used by single and atomic dispatch. */
function uiCommand(input: UiCommandInput, correlationId = 'ui'): DomainCommand {
	cmdSeq += 1;
	return {
		commandId: `ui-${cmdSeq}`,
		commandType: input.commandType,
		commandSchemaVersion: 1,
		targetAggregateType: input.targetAggregateType,
		targetAggregateId: input.targetAggregateId,
		issuedAt: TEST_MODE ? testNow() : new Date().toISOString(),
		issuedBy: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' },
		correlationId,
		idempotencyKey: TEST_MODE
			? `ui-idem-${cmdSeq}`
			: `ui-idem-${cmdSeq}-${Math.floor(performance.now())}`,
		// ── THE REVISION THE PAGE WAS RENDERED FROM (SPEC-001 §11.4.22 item 2; DOC-003 §9 PER-4) ────────
		// Set only when the caller supplies one, because a value invented here would be exactly the
		// tautology REG-F-050 records: the engine comparing a number against the read it came from.
		// What makes this meaningful is that the caller's value originated in the EARLIER read that
		// produced the page and travelled back through the form.
		//
		// The ruling's trigger is "a Projection whose `freshness` is not `FRESH`", and the ratified
		// default for `freshness` is `UNKNOWN` (§2.5.2) — which is not `FRESH` — so a surface carrying
		// no ProjectionEnvelope (none exists; §5.9 says so itself) is IN SCOPE by default. Passing it
		// whenever it is known is the literal reading, not a strengthening.
		...(input.expectedRevision === undefined ? {} : { expectedRevision: input.expectedRevision }),
		payload: input.payload
	};
}

/**
 * Dispatch a command into the shared engine with sensible envelope defaults. Returns the CommandResult.
 *
 * ── `expectedRevision` IS THE FIFTH ARGUMENT, AND ITS ABSENCE WAS A HOLLOW ONE LAYER UP ────────────────────
 * `UiCommandInput.expectedRevision` was added and reachable from NOTHING: this function is the funnel for 25
 * of the 28 surface dispatch sites and had four positional parameters with no slot for it, so the field was
 * declared, honoured by the engine, and unreachable from almost every caller. A field only a minority of
 * callers can express is the same defect as a field nobody reads — see REG-F-051 and `ObjectRow.revision`,
 * which was the identical mistake in the same increment.
 *
 * ⚠ OPTIONAL, AND THE OMISSION IS NOT NEUTRAL. Passing nothing means "no expectation", which is
 * last-write-wins — legitimate ONLY for a pure creation (JPWB-DOC-003 §9 PER-4's NON-EXAMPLE: *"Command types
 * explicitly exempted by contract (pure creations) need no expected revision"*) or where the caller genuinely
 * never read the subject. It is NOT a way to avoid a conflict, and a caller that has the value and withholds
 * it has silently opted the professional out of the protection PER-4 requires.
 *
 * ⚠ AND THE VALUE MUST COME FROM THE RENDER, NOT FROM HERE. A revision fetched at dispatch is always current
 * and can never conflict — it satisfies PER-4's letter and none of its purpose. `optimistic-concurrency-
 * surface.test.ts` holds a standing test pinning exactly that distinction, because it is invisible in review.
 */
export function dispatch(
	commandType: string,
	targetAggregateType: string,
	targetAggregateId: string,
	payload: unknown,
	expectedRevision?: number
) {
	return getEngine()
		.as(SESSION_CREDENTIAL)
		.dispatch(
			uiCommand({ commandType, targetAggregateType, targetAggregateId, payload, expectedRevision })
		);
}

/** Dispatch a multi-command UI operation atomically. A rejection rolls the entire operation back. */
export function dispatchBatch(commands: readonly UiCommandInput[]) {
	return getEngine()
		.as(SESSION_CREDENTIAL)
		.dispatchBatch(commands.map((command) => uiCommand(command)));
}

/** A PwaAuthoringBroker scoped to one DRAFT PWA, wired to the shared engine + this host's id/clock policy. Both the
 *  agent tools and (future) UI "scaffold" actions go through it. The sessionId namespaces its command/idempotency
 *  keys so concurrent authoring runs never collide. */
export function makeAuthoringBroker(
	pwaId: string,
	engine: EngineHandle = getEngine(),
	sessionId: string = mintUiId('sess')
): PwaAuthoringBroker {
	return new PwaAuthoringBroker({
		// ⚠ THE AGENT'S OWN SESSION, and this line is why D-1 does not make forgeability live. The broker used
		// to carry `actorType: 'AGENT'` as a DEFAULT FIELD; once the engine stamps from the session, that field
		// falls dead and an agent's commands would silently acquire the human's identity unless the broker
		// holds its own credential. REG-E-027 keeps delegation human-to-deputy; this keeps agents out of it.
		engine: engine.as(AGENT_CREDENTIAL),
		pwaId,
		mintId: mintUiId,
		now: TEST_MODE ? testNow : undefined,
		sessionId
	});
}

/** One durable authoring-conversation transcript entry (event-sourced domain state — see the AUTHORING_CONVERSATION
 *  aggregate). role = USER | AGENT | SYSTEM; kind = message | thinking | tool_call | tool_result | error. */
export interface ConversationEntry {
	readonly role: string;
	readonly kind: string;
	readonly text: string;
	readonly success?: boolean;
}

/** Append entries to a DRAFT PWA's durable authoring conversation (through the engine — critical domain state, a
 *  precursor to the governed stream, NOT a side store). One conversation per PWA: its id is minted once and reused,
 *  so the transcript survives reloads (and, when the engine is backed by a durable store, restarts). */
export function recordConversation(
	pwaId: string,
	entries: ConversationEntry[],
	engine: EngineHandle = getEngine(),
	correlationId = 'ui'
): void {
	if (entries.length === 0) return;
	const existing = getConversation(engine, pwaId);
	const conversationId = existing?.id ?? mintUiId('conv');
	const result = engine.as(SESSION_CREDENTIAL).dispatch(
		uiCommand(
			{
				commandType: 'AppendConversationEntries',
				targetAggregateType: 'AUTHORING_CONVERSATION',
				targetAggregateId: conversationId,
				payload: { conversationId, pwaId, entries }
			},
			correlationId
		)
	);
	if (result.status !== 'ACCEPTED' && result.status !== 'DUPLICATE') {
		throw new Error(result.error?.message ?? `AppendConversationEntries ${result.status}`);
	}
}

/** The DRAFT PWA's persisted authoring conversation entries (empty if none yet). */
export function loadConversation(
	pwaId: string,
	engine: EngineHandle = getEngine()
): ConversationEntry[] {
	const entries = getConversation(engine, pwaId)?.state.entries;
	return Array.isArray(entries) ? (entries as ConversationEntry[]) : [];
}

/** Which authoring agent the SSE route should use. Explicit JPWB_AGENT wins ('pi' forces the live agent even under
 *  the E2E harness, so a live-Pi test keeps reset/introspect/deterministic ids while exercising the real model;
 *  'mock' forces the offline agent). Otherwise: the deterministic mock under E2E (RPH_DEMO_MODE=test), live Pi in
 *  dev/prod. */
export function agentMode(): 'mock' | 'pi' {
	if (process.env.JPWB_AGENT === 'pi') return 'pi';
	if (process.env.JPWB_AGENT === 'mock') return 'mock';
	return TEST_MODE ? 'mock' : 'pi';
}

/** A sortable id for new aggregates the UI creates (matches the RphId `<prefix>_<26-char>` format).
 *  Production uses one process-wide monotonic ULID factory, which remains unique and ordered during same-millisecond
 *  bursts. Test mode retains the padded base32 sequence so authored ids are stable across E2E runs. */
export function mintUiId(prefix: string): string {
	const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
	idSeq += 1;
	if (TEST_MODE) {
		let n = idSeq;
		let s = '';
		while (n > 0) {
			s = alphabet[n % 32] + s;
			n = Math.floor(n / 32);
		}
		return `${prefix}_${s.padStart(26, '0')}`;
	}
	return `${prefix}_${productionUlid()}`;
}

// ── Canonical PWA graph export ──────────────────────────────────────────────────────────────────────────────────
// The DRAFT PWA's PWU-Type graph, serialized as the engine-truth export a de minimis assurance floor Reasoning
// Review reads (exec != assurance — the reviewer is a validator distinct from the authoring executor).

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/** The current PWA's PWU-Type graph as the canonical export a judge reads (engine truth, not the render model).
 *  `pwaVersion` (optional) scopes the node set to ONE version of the PWA: `listPwuTypes` filters by pwaId only, but a
 *  PWU_TYPE binds to a VERSIONED PWA (RPH-CON-009), so a republished PWA has two versions' types under one pwaId —
 *  passing the bound pwaVersion keeps the graph to that version (JAN-EXECPLAN §19 L3-C2). Omitted ⇒ all versions. */
export function buildPwaExport(
	pwaId: string,
	engine: EngineHandle = getEngine(),
	pwaVersion?: string
): PwaGraphExport | undefined {
	const pwa = getObject(engine, pwaId);
	if (!pwa) return undefined;
	const nodes = listPwuTypes(engine, pwaId)
		.filter((t) => pwaVersion === undefined || String((t.state.pwaVersion ?? '') as string) === pwaVersion)
		.map((t) => ({
		id: t.id,
		name: String((t.state.name ?? t.id) as string),
		pwuKind: String((t.state.pwuKind ?? '') as string),
		isRoot: Boolean(t.state.isRoot),
		permittedChildTypeIds: arr(t.state.permittedChildTypeIds),
		requiredInputs: arr(t.state.requiredInputs),
		requiredOutputs: arr(t.state.requiredOutputs),
		executionBoundary:
			t.state.executionBoundary === 'DELEGATED_EXTERNAL'
				? ('DELEGATED_EXTERNAL' as const)
				: ('INTERNAL' as const)
	}));
	return buildPwaGraphExport(
		{
			id: pwaId,
			name: String((pwa.name ?? pwaId) as string),
			domain: String((pwa.domain ?? '') as string),
			version: String((pwa.version ?? '') as string),
			publicationStatus: String((pwa.publicationStatus ?? 'DRAFT') as string)
		},
		nodes
	);
}
