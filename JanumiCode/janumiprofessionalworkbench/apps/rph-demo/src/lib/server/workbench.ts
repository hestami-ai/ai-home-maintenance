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
	seedWorkbench,
	type EngineHandle
} from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { PwaAuthoringBroker } from '@janumipwb/rph-authoring';
import type { DomainCommand } from '@janumipwb/rph-contracts';

const TEST_MODE = process.env.RPH_DEMO_MODE === 'test';

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

function newEngine(): EngineHandle {
	return createEngine(TEST_MODE ? { ontology, now: testNow } : { ontology });
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
	if (seed === 'reference') seedWorkbench(handle);
}

/** Dispatch a command into the shared engine with sensible envelope defaults. Returns the CommandResult. */
export function dispatch(
	commandType: string,
	targetAggregateType: string,
	targetAggregateId: string,
	payload: unknown
) {
	cmdSeq += 1;
	const command: DomainCommand = {
		commandId: `ui-${cmdSeq}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType,
		targetAggregateId,
		issuedAt: TEST_MODE ? testNow() : new Date().toISOString(),
		issuedBy: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' },
		correlationId: 'ui',
		idempotencyKey: TEST_MODE
			? `ui-idem-${cmdSeq}`
			: `ui-idem-${cmdSeq}-${Math.floor(performance.now())}`,
		payload
	};
	return getEngine().dispatch(command);
}

/** A PwaAuthoringBroker scoped to one DRAFT PWA, wired to the shared engine + this host's id/clock policy. Both the
 *  agent tools and (future) UI "scaffold" actions go through it. The sessionId namespaces its command/idempotency
 *  keys so concurrent authoring runs never collide. */
export function makeAuthoringBroker(pwaId: string): PwaAuthoringBroker {
	return new PwaAuthoringBroker({
		engine: getEngine(),
		pwaId,
		mintId: mintUiId,
		now: TEST_MODE ? testNow : undefined,
		sessionId: mintUiId('sess')
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
export function recordConversation(pwaId: string, entries: ConversationEntry[]): void {
	if (entries.length === 0) return;
	const existing = getConversation(getEngine(), pwaId);
	const conversationId = existing?.id ?? mintUiId('conv');
	dispatch('AppendConversationEntries', 'AUTHORING_CONVERSATION', conversationId, {
		conversationId,
		pwaId,
		entries
	});
}

/** The DRAFT PWA's persisted authoring conversation entries (empty if none yet). */
export function loadConversation(pwaId: string): ConversationEntry[] {
	const entries = getConversation(getEngine(), pwaId)?.state.entries;
	return Array.isArray(entries) ? (entries as ConversationEntry[]) : [];
}

/** Which authoring agent the SSE route should use: the deterministic mock under E2E (RPH_DEMO_MODE=test), the live
 *  Pi agent otherwise — unless JPWB_AGENT explicitly overrides ('mock' to force the offline agent in dev). */
export function agentMode(): 'mock' | 'pi' {
	if (TEST_MODE) return 'mock';
	return process.env.JPWB_AGENT === 'mock' ? 'mock' : 'pi';
}

/** A short, sortable id for new aggregates the UI creates (matches the RphId `<prefix>_<26-char>` format).
 *  Deterministic in test mode (a padded base32 sequence) so authored ids are stable across E2E runs. */
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
	let s = '';
	const t = Date.now() + idSeq;
	for (let i = 0; i < 26; i += 1) s += alphabet[(t + idSeq * 7 + i * 13) % 32];
	return `${prefix}_${s}`;
}
