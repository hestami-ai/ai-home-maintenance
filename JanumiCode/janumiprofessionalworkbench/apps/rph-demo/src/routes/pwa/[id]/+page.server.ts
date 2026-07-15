// PWA Overview + Work Architecture View (PWA Design context). Shows the PWA's PWU Types — reusable definitions,
// with NO concrete execution/assurance state (RPH-DOC-010 §35.1) — a type inspector, and (while the PWA is a DRAFT)
// the full authoring surface: edit the PWA's details, define / edit / remove PWU Types (with the rich fields —
// completionRule, permitted child types), and advance the publication lifecycle
// DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED -> DEPRECATED -> RETIRED. A PUBLISHED PWA version is immutable
// (§11), so every authoring control disappears (and the engine rejects the command) once it is no longer DRAFT.
import { error, fail } from '@sveltejs/kit';
import { getObject, listPwuTypes, listUndertakings, SEED_UNDERTAKING } from '@janumipwb/rph-engine';
import {
	dispatch,
	getEngine,
	hostNow,
	loadConversation,
	mintUiId,
	type ConversationEntry
} from '$lib/server/workbench';
import { loadPwaFloor } from '$lib/server/floor';
import type { Actions, PageServerLoad } from './$types';

/** The durable authoring transcript, mapped to the agent-log render shape the page consumes. */
type LogEntry = {
	kind: 'status' | 'text' | 'thinking' | 'tool' | 'toolend' | 'error';
	text: string;
	ok?: boolean;
};
function toLogEntry(e: ConversationEntry): LogEntry {
	switch (e.kind) {
		case 'message':
			return { kind: 'text', text: e.role === 'USER' ? `You: ${e.text}` : e.text };
		case 'thinking':
			return { kind: 'thinking', text: e.text };
		case 'tool_call':
			return { kind: 'tool', text: e.text };
		case 'tool_result':
			return { kind: 'toolend', text: e.text, ok: e.success };
		default:
			return { kind: 'error', text: e.text };
	}
}

export const load: PageServerLoad = ({ params }) => {
	const engine = getEngine();
	const pwa = getObject(engine, params.id);
	if (!pwa) throw error(404, 'PWA not found');
	// Conformance fixtures (§13/§21): Undertakings instantiated from this PWA that serve as reference fixtures.
	const fixtures = listUndertakings(engine)
		.filter((u) => u.state.pwaId === params.id)
		.map((u) => ({
			id: u.id,
			name: String((u.state.name ?? u.id) as string),
			isReferenceFixture: u.id === SEED_UNDERTAKING
		}));
	const types = listPwuTypes(engine, params.id).map((t) => ({
		id: t.id,
		name: String((t.state.name ?? t.id) as string),
		pwuKind: String((t.state.pwuKind ?? '') as string),
		purpose: String((t.state.purpose ?? '') as string),
		isRoot: Boolean(t.state.isRoot),
		completionRule: String((t.state.completionRule ?? '') as string),
		permittedChildTypeIds: Array.isArray(t.state.permittedChildTypeIds)
			? (t.state.permittedChildTypeIds as string[])
			: [],
		requiredInputs: Array.isArray(t.state.requiredInputs)
			? (t.state.requiredInputs as string[])
			: [],
		requiredOutputs: Array.isArray(t.state.requiredOutputs)
			? (t.state.requiredOutputs as string[])
			: [],
		requiredAssurancePolicyIds: Array.isArray(t.state.requiredAssurancePolicyIds)
			? (t.state.requiredAssurancePolicyIds as string[])
			: []
	}));
	return {
		pwa: {
			id: params.id,
			name: String((pwa.name ?? params.id) as string),
			description: String((pwa.description ?? '') as string),
			domain: String((pwa.domain ?? '') as string),
			version: String((pwa.version ?? '') as string),
			publicationStatus: String((pwa.publicationStatus ?? 'DRAFT') as string)
		},
		types,
		fixtures,
		conversation: loadConversation(params.id).map(toLogEntry),
		// The latest recorded de minimis assurance floor for this PWA (canonical ASSURANCE_ASSESSMENT/OBSERVATION).
		floor: loadPwaFloor(params.id)
	};
};

interface TypeFields {
	name: string;
	pwuKind: string;
	purpose: string;
	completionRule: string;
	isRoot: boolean;
	permittedChildTypeIds: string[];
	requiredInputs: string[];
	requiredOutputs: string[];
}

/** Split a comma/newline-separated artifact list from a form field into a clean string[]. */
function csv(v: FormDataEntryValue | null): string[] {
	return String((v ?? '') as string)
		.split(/[\n,;]/)
		.map((x) => x.trim())
		.filter(Boolean);
}

/** Read the shared PWU-Type authoring fields from a form (used by both defineType and editType). */
function readTypeFields(form: FormData): TypeFields {
	return {
		name: String((form.get('name') ?? '') as string).trim(),
		pwuKind: String((form.get('pwuKind') ?? '') as string)
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '_')
			.replace(/^_|_$/g, ''),
		purpose: String((form.get('purpose') ?? '') as string).trim(),
		completionRule: String((form.get('completionRule') ?? '') as string).trim(),
		isRoot: form.has('isRoot'),
		permittedChildTypeIds: (form.getAll('permittedChildTypeIds') as string[])
			.map(String)
			.filter(Boolean),
		requiredInputs: csv(form.get('requiredInputs')),
		requiredOutputs: csv(form.get('requiredOutputs'))
	};
}

/** Advance the PWA publication FSM and surface any engine rejection to the form. */
function advancePwa(commandType: string, pwaId: string, payload: Record<string, unknown>) {
	const r = dispatch(commandType, 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, payload);
	if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
	return { advanced: commandType };
}

export const actions: Actions = {
	// Edit the DRAFT PWA's own details (name/description/domain).
	editDetails: async ({ request, params }) => {
		const form = await request.formData();
		const name = String((form.get('name') ?? '') as string).trim();
		if (!name) return fail(400, { error: 'A PWA name is required.' });
		const r = dispatch('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', params.id, {
			pwaId: params.id,
			name,
			description: String((form.get('description') ?? '') as string).trim(),
			domain: String((form.get('domain') ?? '') as string).trim()
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { editedPwa: params.id };
	},

	// Define a reusable PWU Type on this (DRAFT) PWA — with the full field set (kind/purpose/root/completion/children).
	defineType: async ({ request, params }) => {
		const f = readTypeFields(await request.formData());
		if (!f.name || !f.pwuKind)
			return fail(400, { error: 'A PWU Type name and kind are required.' });
		const id = mintUiId('pwut');
		const r = dispatch('DefinePwuType', 'PWU_TYPE', id, {
			pwuTypeId: id,
			pwaId: params.id,
			pwuKind: f.pwuKind,
			name: f.name,
			purpose: f.purpose || f.name,
			isRoot: f.isRoot,
			...(f.completionRule ? { completionRule: f.completionRule } : {}),
			permittedChildTypeIds: f.permittedChildTypeIds,
			requiredInputs: f.requiredInputs,
			requiredOutputs: f.requiredOutputs
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { definedType: id };
	},

	// Edit an existing PWU Type in place (DRAFT PWA only — the engine enforces this).
	editType: async ({ request }) => {
		const form = await request.formData();
		const pwuTypeId = String((form.get('pwuTypeId') ?? '') as string).trim();
		if (!pwuTypeId) return fail(400, { error: 'Missing PWU Type.' });
		const f = readTypeFields(form);
		if (!f.name || !f.pwuKind)
			return fail(400, { error: 'A PWU Type name and kind are required.' });
		const r = dispatch('EditPwuType', 'PWU_TYPE', pwuTypeId, {
			pwuTypeId,
			name: f.name,
			pwuKind: f.pwuKind,
			purpose: f.purpose || f.name,
			isRoot: f.isRoot,
			...(f.completionRule ? { completionRule: f.completionRule } : {}),
			permittedChildTypeIds: f.permittedChildTypeIds,
			requiredInputs: f.requiredInputs,
			requiredOutputs: f.requiredOutputs
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { editedType: pwuTypeId };
	},

	// Remove a PWU Type (DRAFT only). Referential integrity + the DRAFT guard are enforced by the engine
	// (RemovePwuType) — this just surfaces any rejection.
	removeType: async ({ request }) => {
		const pwuTypeId = String(((await request.formData()).get('pwuTypeId') ?? '') as string).trim();
		if (!pwuTypeId) return fail(400, { error: 'Missing PWU Type.' });
		const r = dispatch('RemovePwuType', 'PWU_TYPE', pwuTypeId, { pwuTypeId });
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { removedType: pwuTypeId };
	},

	submitForReview: ({ params }) => advancePwa('SubmitPwaForReview', params.id, {}),
	validate: ({ params }) => advancePwa('ValidatePwa', params.id, {}),
	// Publish requires a declared root PWU Type (which must have been defined while DRAFT); resolve it server-side.
	publish: ({ params }) => {
		const root = listPwuTypes(getEngine(), params.id).find((t) => t.state.isRoot === true);
		if (!root) return fail(400, { error: 'Define a root PWU Type before publishing.' });
		return advancePwa('PublishPwa', params.id, { rootPwuTypeId: root.id });
	},
	// Continue the publication FSM past PUBLISHED: PUBLISHED -> DEPRECATED -> RETIRED.
	deprecate: ({ params }) => advancePwa('DeprecatePwa', params.id, {}),
	retire: ({ params }) => advancePwa('RetirePwa', params.id, {}),

	// Human-in-the-loop resolution: record + grant an auditable governance WAIVER over the de minimis assurance
	// floor so a non-SATISFIED PWA can PUBLISH — the alternative to revising the graph and re-running the floor.
	recordWaiver: async ({ request, params }) => {
		const rationale = String(((await request.formData()).get('rationale') ?? '') as string).trim();
		if (!rationale) return fail(400, { error: 'A waiver rationale is required.' });
		const waiverId = mintUiId('dec');
		const req = dispatch('RequestWaiver', 'DECISION', waiverId, {
			subjectObjectIds: [params.id],
			scope: 'de minimis assurance floor',
			rationale,
			duration: 'until superseded',
			affectedObjectIds: [params.id]
		});
		if (req.status !== 'ACCEPTED') return fail(400, { error: req.error?.message ?? req.status });
		const grant = dispatch('GrantWaiver', 'DECISION', waiverId, {
			waiverDecisionId: waiverId,
			effectiveAt: hostNow(),
			duration: 'until superseded'
		});
		if (grant.status !== 'ACCEPTED')
			return fail(400, { error: grant.error?.message ?? grant.status });
		return { waived: waiverId };
	}
};
