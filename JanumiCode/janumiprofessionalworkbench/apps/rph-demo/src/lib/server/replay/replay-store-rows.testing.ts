// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D3; `REG-F-530`) — A REPLAY'S STORES, AS THE RUN REPORT READS
// AN ARCHIVE'S: the in-memory engine and content store of a test-mode process, in the row shapes `run-report.ts` reads off
// a final archive's SQLite (`StoreRows`), so the report's own rules give the replay's matrix (`replay-regression.ts`).
//
// ⭑ WHY IN MEMORY: in test mode the stores stay in memory (D3; `workbench.ts`, *"test mode is in-memory by construction"*),
// so there is no archive to read — and a second reader with its own rules would be a second definition of the matrix.
// This reads the SAME facts the SQLite reader does: each object with the global sequence of its aggregate's first event
// (`listByType`'s order), each event's envelope fields and its domain payload, and for each content key a record names,
// the claimed hash and size beside a hash RECOMPUTED from the bytes the store returns (`readStores`), never the bytes.
// ⚠ A `.testing.ts` module: test infrastructure, read by the regression's drivers.
import { createHash } from 'node:crypto';
import { withScanContext } from '@janumipwb/rph-ports';
import type {
	StoredContent,
	StoredEvent,
	StoredObject,
	StoreRows
} from '../../../../../../scripts/phase7/run-report-core.js';
import { getArtifactStore, getEngine } from '../workbench.js';

/** Every `storageKey` a record names, anywhere in its state. */
function storageKeysIn(value: unknown, into: Set<string>): void {
	if (Array.isArray(value)) for (const v of value) storageKeysIn(v, into);
	else if (typeof value === 'object' && value !== null)
		for (const [k, v] of Object.entries(value)) {
			if (k === 'storageKey' && typeof v === 'string') into.add(v);
			else storageKeysIn(v, into);
		}
}

/** ⭐ The in-memory stores of this process, as `StoreRows`. */
export async function inMemoryStoreRows(): Promise<StoreRows> {
	const engine = getEngine();
	const all = engine.readAllEvents();
	const events: StoredEvent[] = all.map((e, i) => ({
		sequence: i + 1,
		eventType: e.eventType,
		aggregateType: e.aggregateType,
		aggregateId: e.aggregateId,
		commandId: e.commandId ?? null,
		correlationId: e.correlationId,
		payload: (e.payload ?? {}) as Record<string, unknown>
	}));
	const first = new Map<string, { readonly sequence: number; readonly objectType: string }>();
	for (const e of events)
		if (!first.has(e.aggregateId))
			first.set(e.aggregateId, { sequence: e.sequence, objectType: e.aggregateType });
	const objects: StoredObject[] = [];
	// ⭑ A SCAN'S LOADS, as `listByType`'s are — never a caller's by-id reads (`REG-D-070` §5.5).
	withScanContext(() => {
		for (const [id, at] of first) {
			const state = engine.loadObject(id)?.state as Record<string, unknown> | undefined;
			if (state !== undefined)
				objects.push({ id, objectType: at.objectType, state, firstSequence: at.sequence });
		}
	});
	const keys = new Set<string>();
	for (const o of objects) storageKeysIn(o.state, keys);
	const store = getArtifactStore();
	const content: StoredContent[] = [];
	for (const storageKey of keys) {
		const meta = await store.stat(storageKey);
		if (meta === undefined) continue;
		const bytes = await store.get(storageKey);
		content.push({
			storageKey,
			contentHash: meta.contentHash,
			byteSize: meta.byteSize,
			purged: meta.purged,
			actualHash:
				bytes === undefined
					? null
					: `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`,
			actualSize: bytes === undefined ? null : Buffer.byteLength(bytes, 'utf8')
		});
	}
	return { objects, events, content };
}
