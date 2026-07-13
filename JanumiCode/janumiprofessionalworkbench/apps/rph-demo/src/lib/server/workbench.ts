// The server-side engine host. The RPH engine runs ONLY here (Node; better-sqlite3) — never in the browser. A
// single lazily-seeded in-memory engine backs every request: on first use it seedWorkbench()s one PUBLISHED
// Product Realization PWA + the Field Service Management Undertaking + its live Professional Work Graph. Route
// `load()`s read the current state through the query surface; form actions dispatch real commands into this same
// engine, so authoring (create a PWA, advance a PWU, …) mutates live state.
import { createEngine, seedWorkbench, type EngineHandle } from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { DomainCommand } from '@janumipwb/rph-contracts';

let handle: EngineHandle | null = null;
let cmdSeq = 0;

/** The shared, seeded engine (created + seeded once per server process). */
export function getEngine(): EngineHandle {
	if (!handle) {
		handle = createEngine({ ontology });
		seedWorkbench(handle);
	}
	return handle;
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
		issuedAt: new Date().toISOString(),
		issuedBy: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' },
		correlationId: 'ui',
		idempotencyKey: `ui-idem-${cmdSeq}-${Math.floor(performance.now())}`,
		payload
	};
	return getEngine().dispatch(command);
}

/** A short, sortable id for new aggregates the UI creates (matches the RphId `<prefix>_<26-char>` format). */
export function mintUiId(prefix: string): string {
	const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
	let s = '';
	const t = Date.now();
	for (let i = 0; i < 26; i += 1) s += alphabet[(t + cmdSeq * 7 + i * 13) % 32];
	return `${prefix}_${s}`;
}
