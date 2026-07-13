// Read-model queries over the live engine — the read surface the UI consumes (all pure reads; projections are
// never authoritative). listByType collects the distinct aggregate ids of an object type from the append-only
// event log and returns their current materialized state; the typed wrappers name the RPH-DOC-010 view sources
// (PWA Library, PWU Types, Undertaking Portfolio, and the Undertaking's execution/assurance/decision/baseline
// working sets). The Professional Work Graph itself is built by professionalWorkGraph() (see that module).
import type { EngineHandle } from './engine.js';

export interface ObjectRow {
	readonly id: string;
	readonly state: Record<string, unknown>;
}

/** Every object of `objectType` (by aggregateType on the event log) with its current materialized state. */
export function listByType(handle: EngineHandle, objectType: string): ObjectRow[] {
	const ids = new Set<string>();
	for (const e of handle.readAllEvents())
		if (e.aggregateType === objectType) ids.add(e.aggregateId);
	const rows: ObjectRow[] = [];
	for (const id of ids) {
		const state = handle.loadObject(id)?.state;
		if (state) rows.push({ id, state: state as Record<string, unknown> });
	}
	return rows;
}

function byField(rows: ObjectRow[], field: string, value: string): ObjectRow[] {
	return rows.filter((r) => r.state[field] === value);
}

export const listPwas = (h: EngineHandle): ObjectRow[] =>
	// A DeletePwa tombstones the PWA as publicationStatus DISCARDED; the Library treats it as gone.
	listByType(h, 'PROFESSIONAL_WORK_ARCHITECTURE').filter(
		(r) => r.state.publicationStatus !== 'DISCARDED'
	);
export const listPwuTypes = (h: EngineHandle, pwaId?: string): ObjectRow[] => {
	// A RemovePwuType tombstones the type as status REMOVED; the authoring/read surfaces treat it as gone.
	const live = listByType(h, 'PWU_TYPE').filter((r) => r.state.status !== 'REMOVED');
	return pwaId ? byField(live, 'pwaId', pwaId) : live;
};
export const listUndertakings = (h: EngineHandle): ObjectRow[] => listByType(h, 'UNDERTAKING');
export const listPwus = (h: EngineHandle, undertakingId?: string): ObjectRow[] =>
	undertakingId
		? byField(listByType(h, 'PROFESSIONAL_WORK_UNIT'), 'undertakingId', undertakingId)
		: listByType(h, 'PROFESSIONAL_WORK_UNIT');
export const listExecutionPlans = (h: EngineHandle): ObjectRow[] => listByType(h, 'EXECUTION_PLAN');
export const listAssessments = (h: EngineHandle): ObjectRow[] =>
	listByType(h, 'ASSURANCE_ASSESSMENT');
export const listObservations = (h: EngineHandle): ObjectRow[] =>
	listByType(h, 'ASSURANCE_OBSERVATION');
export const listDecisions = (h: EngineHandle): ObjectRow[] => listByType(h, 'DECISION');
export const listBaselines = (h: EngineHandle): ObjectRow[] => listByType(h, 'BASELINE');

export const listConversations = (h: EngineHandle): ObjectRow[] =>
	listByType(h, 'AUTHORING_CONVERSATION');

/** The durable authoring conversation for a PWA (by pwaId), or undefined. One per PWA. */
export function getConversation(h: EngineHandle, pwaId: string): ObjectRow | undefined {
	return byField(listByType(h, 'AUTHORING_CONVERSATION'), 'pwaId', pwaId)[0];
}

/** A single object's current state by id, or undefined. */
export function getObject(handle: EngineHandle, id: string): Record<string, unknown> | undefined {
	return handle.loadObject(id)?.state as Record<string, unknown> | undefined;
}
