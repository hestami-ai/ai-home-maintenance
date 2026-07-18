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
import { PwaAuthoringBroker } from '@janumipwb/rph-authoring';
import { buildPwaGraphExport, type PwaGraphExport } from '@janumipwb/rph-projections';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { monotonicFactory } from 'ulid';

const TEST_MODE = process.env.RPH_DEMO_MODE === 'test';
const productionUlid = monotonicFactory();

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
function newEngine(): EngineHandle {
	const base = { ontology, validateOntology };
	return createEngine(TEST_MODE ? { ...base, now: testNow } : base);
}

/** The shared, seeded engine (created + seeded once per server process). */
export function getEngine(): EngineHandle {
	if (!handle) {
		handle = newEngine();
		seedWorkbench(handle);
	}
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
	if (seed === 'reference') seedWorkbench(handle);
	else seedPolicyLibrary(handle);
}

/** The command fields a UI action supplies; this host owns the common command envelope. */
export interface UiCommandInput {
	readonly commandType: string;
	readonly targetAggregateType: string;
	readonly targetAggregateId: string;
	readonly payload: unknown;
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
		payload: input.payload
	};
}

/** Dispatch a command into the shared engine with sensible envelope defaults. Returns the CommandResult. */
export function dispatch(
	commandType: string,
	targetAggregateType: string,
	targetAggregateId: string,
	payload: unknown
) {
	return getEngine().dispatch(
		uiCommand({ commandType, targetAggregateType, targetAggregateId, payload })
	);
}

/** Dispatch a multi-command UI operation atomically. A rejection rolls the entire operation back. */
export function dispatchBatch(commands: readonly UiCommandInput[]) {
	return getEngine().dispatchBatch(commands.map((command) => uiCommand(command)));
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
		engine,
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
	const result = engine.dispatch(
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

/** The current PWA's PWU-Type graph as the canonical export a judge reads (engine truth, not the render model). */
export function buildPwaExport(
	pwaId: string,
	engine: EngineHandle = getEngine()
): PwaGraphExport | undefined {
	const pwa = getObject(engine, pwaId);
	if (!pwa) return undefined;
	const nodes = listPwuTypes(engine, pwaId).map((t) => ({
		id: t.id,
		name: String((t.state.name ?? t.id) as string),
		pwuKind: String((t.state.pwuKind ?? '') as string),
		isRoot: Boolean(t.state.isRoot),
		permittedChildTypeIds: arr(t.state.permittedChildTypeIds),
		requiredInputs: arr(t.state.requiredInputs),
		requiredOutputs: arr(t.state.requiredOutputs)
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
