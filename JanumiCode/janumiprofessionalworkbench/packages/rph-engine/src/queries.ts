// Read-model queries over the live engine — the read surface the UI consumes (all pure reads; projections are
// never authoritative). listByType collects the distinct aggregate ids of an object type from the append-only
// event log and returns their current materialized state; the typed wrappers name the RPH-DOC-010 view sources
// (PWA Library, PWU Types, Undertaking Portfolio, and the Undertaking's execution/assurance/decision/baseline
// working sets). The Professional Work Graph itself is built by professionalWorkGraph() (see that module).
import type { EngineHandle } from './engine.js';

export interface ObjectRow {
	readonly id: string;
	readonly state: Record<string, unknown>;
	/** The aggregate revision this row was read at — the value a caller must later declare as
	 *  `expectedRevision` (PER-4; JPWB-SPEC-001 §11.4.22 item 2). Optional only so that existing rows
	 *  built without it still type-check; every helper in this file supplies it. */
	readonly revision?: number;
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

/**
 * The subject a subject-bindable list query is bound to — REQUIRED, never optional.
 *
 * WHY REQUIRED, AND WHY THAT IS THE WHOLE POINT (JPWB-SPEC-001 `SPEC-001-INV-02`, FORK-9).
 *
 * `listPwus` used to read `(h, undertakingId?)`. The scope was there and it was OPTIONAL — and the four functions
 * written after it (`listAssessments`, `listObservations`, `listDecisions`, `listBaselines`) declared no scope
 * parameter at all. That is not a coincidence; an optional scope is an invitation to omit it, and the omission is
 * invisible at every call site. The Undertaking Workbench duly consumed all four unscoped, so a brand-new
 * Undertaking with zero PWUs rendered the SEEDED Undertaking's 65 assessments, 2 decisions and 2 baselines.
 *
 * The same defect was found and fixed ONCE before, for `listExecutionPlans`, in the loader rather than here — see
 * "the F-6 bug" comment at `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts`. Fixing it at the call
 * site left the signature able to be misused again, and it immediately was, four times over. Fixing it in the
 * SIGNATURE makes the omission a **compile error**: the enforcement is the type checker, not a reviewer.
 *
 * `WORKSPACE` IS EXPLICIT AND IS NEVER A DEFAULT. A caller that genuinely wants every object of a type says so,
 * and that statement is reviewable. Today the same intent is indistinguishable from a forgotten argument — which
 * is exactly the state that produced the leak.
 */
export type QueryScope =
	{ readonly kind: 'UNDERTAKING'; readonly undertakingId: string } | { readonly kind: 'WORKSPACE' };

/**
 * Every object id that belongs to an Undertaking — the set a subject-bindable object must intersect.
 *
 * SCOPING IS MULTI-HOP BY NECESSITY, not by preference. None of the four subject-bindable types carries an
 * `undertakingId`; they reference their subjects instead. The F-6 fix's own comment states the general fact for
 * the execution plane — *"a plan carries no undertakingId (F-1)"* — and it holds identically here.
 *
 * A TWO-HOP CLOSURE (PWUs ONLY) WAS TRIED FIRST AND WAS WRONG, which is worth recording because the error is
 * invisible from the object model alone. Of the reference seed's assessments, only the per-PWU *fitness* ones name
 * a PWU as subject; the three de-minimis FLOOR assessments per PWU name the **Evidence** the step produced
 * (`reference-undertaking.ts:602`, `satisfyFloor(evidenceId)`). Scoping to PWU ids alone therefore emptied the
 * owning Undertaking's own Assurance tab — caught by the CONTROL case in `undertaking-scope.e2e.ts`, which exists
 * precisely because scoping everything to nothing satisfies a leak test. That is FORK-9's NON-EXAMPLE in the
 * flesh: INV-02 forbids presenting objects OUTSIDE the scope, never presenting the subject's own.
 *
 * THE CLOSURE, and why it stops where it does. Seed with the Undertaking's PWU ids; add the EXECUTION_PLANs whose
 * `workUnitId` is one of them; then add every id those plans' own events reference — the Evidence and Artifacts a
 * step produced. It is computed from the append-only log rather than from materialized state because
 * `proposedEvidenceIds` and `outputArtifactIds` travel on the event and are not persisted as step fields.
 *
 * It is deliberately NOT a transitive closure over all links. A general reachability walk would eventually absorb
 * shared objects — policies, intents, the PWA — and re-create the leak in a subtler form. The rule is one hop of
 * PRODUCTION: things this Undertaking's execution made.
 */
function undertakingObjectIds(handle: EngineHandle, undertakingId: string): Set<string> {
	const ids = new Set(
		byField(listByType(handle, 'PROFESSIONAL_WORK_UNIT'), 'undertakingId', undertakingId).map(
			(r) => r.id
		)
	);
	const planIds = new Set(
		listByType(handle, 'EXECUTION_PLAN')
			.filter((p) => ids.has(String((p.state.workUnitId ?? '') as string | number | boolean)))
			.map((p) => p.id)
	);
	for (const id of planIds) ids.add(id);
	for (const e of handle.readAllEvents()) {
		if (!planIds.has(e.aggregateId)) continue;
		const payload = (e as { payload?: Record<string, unknown> }).payload ?? {};
		for (const field of ['proposedEvidenceIds', 'outputArtifactIds']) {
			const v = payload[field];
			if (Array.isArray(v)) for (const x of v) ids.add(String(x));
		}
	}
	return ids;
}

/**
 * Read a row's subject id list. Absent or malformed reads as EMPTY, which fails CLOSED: an object that names no
 * subject is admitted to no Undertaking, never to all of them.
 *
 * TWO SHAPES, because the four subject-bindable types do not agree on one. Assessment, observation and decision
 * carry `subjectObjectIds: string[]`. BASELINE carries `itemObjectVersions: BaselineItemVersion[]` — an array of
 * `{ objectId, semanticVersion, contentHash }` records, NOT a list of ids and NOT a map (`objects.ts:139-144`,
 * `:674`). An earlier revision of this function assumed the latter two in turn; both stringified the records into
 * `"[object Object]"`, which matched nothing and silently emptied the owning Undertaking's Baselines tab. It was
 * caught by the CONTROL case rather than by the leak case, because a scope that admits nothing satisfies a leak
 * test perfectly.
 */
function subjectIdsOf(row: ObjectRow, field: string): string[] {
	const raw = row.state[field];
	if (!Array.isArray(raw)) return [];
	return raw
		.map((entry) => {
			if (typeof entry === 'string') return entry;
			const objectId = (entry as { objectId?: unknown } | null)?.objectId;
			return typeof objectId === 'string' ? objectId : '';
		})
		.filter((id) => id !== '');
}

/**
 * Apply a `QueryScope` to rows of a subject-bindable type.
 *
 * The intersection is on the SUBJECT field named by the caller, because the four types do not agree on one:
 * assessment, observation and decision use `subjectObjectIds`; baseline uses `itemObjectVersions`. Passing the
 * field name keeps that difference visible at each definition instead of hiding it behind a union.
 */
function withinScope(
	handle: EngineHandle,
	rows: ObjectRow[],
	scope: QueryScope,
	subjectField: string
): ObjectRow[] {
	if (scope.kind === 'WORKSPACE') return rows;
	const owned = undertakingObjectIds(handle, scope.undertakingId);
	return rows.filter((r) => subjectIdsOf(r, subjectField).some((id) => owned.has(id)));
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

// ── SUBJECT-BINDABLE QUERIES: the scope is REQUIRED (JPWB-SPEC-001 INV-02, FORK-9) ───────────────────────────
//
// Every one of these four returned the whole workspace until 2026-07-28. See `QueryScope` above for why the repair
// is in the signature rather than at the call sites — the short version is that fixing it at a call site is what
// was tried before, and the signature let it be misused again four times.
export const listAssessments = (h: EngineHandle, scope: QueryScope): ObjectRow[] =>
	withinScope(h, listByType(h, 'ASSURANCE_ASSESSMENT'), scope, 'subjectObjectIds');
export const listObservations = (h: EngineHandle, scope: QueryScope): ObjectRow[] =>
	withinScope(h, listByType(h, 'ASSURANCE_OBSERVATION'), scope, 'subjectObjectIds');
export const listDecisions = (h: EngineHandle, scope: QueryScope): ObjectRow[] =>
	withinScope(h, listByType(h, 'DECISION'), scope, 'subjectObjectIds');
export const listBaselines = (h: EngineHandle, scope: QueryScope): ObjectRow[] =>
	withinScope(h, listByType(h, 'BASELINE'), scope, 'itemObjectVersions');
/** Every ASSURANCE_POLICY definition (any status). The PWA Designer's policy manager lists these; the picker
 *  offers the ACTIVE ones, and the 3 de minimis floor policies are shown locked (§8.4). */
export const listAssurancePolicies = (h: EngineHandle): ObjectRow[] =>
	listByType(h, 'ASSURANCE_POLICY');

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

/**
 * The aggregate revision an object is currently at, or undefined if the store has never held it.
 *
 * ── WHY THIS EXISTS AS A SEPARATE READ (JPWB-SPEC-001 §11.4.22 item 2; JPWB-DOC-003 §9 PER-4) ──────────
 * `StoredObject` carries `revision`, and every read helper in this file threw it away one layer up —
 * `ObjectRow` was `{ id, state }` and `getObject` returns `.state`. So the revision was dropped
 * STRUCTURALLY, below every loader, and no route could have declared one even if it wanted to. The
 * result was that all surface dispatch was last-write-wins while the engine sat ready to enforce
 * otherwise: `loadOrReject` honours `expectedRevision` whenever it is present.
 *
 * ⚠ THE VALUE IS ONLY WORTH ANYTHING IF IT TRAVELS. PER-4 asks for "the revision they BELIEVE current",
 * so this must be read when the page is DERIVED and then round-tripped through the client. A caller
 * that fetches it immediately before dispatching would pass every test and protect nothing — the
 * tautology REG-F-050 records, reproduced one layer out.
 */
export function getObjectRevision(handle: EngineHandle, id: string): number | undefined {
	return handle.loadObject(id)?.revision;
}
