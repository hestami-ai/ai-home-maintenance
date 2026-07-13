// PWA Overview + Work Architecture View (PWA Design context). Shows the PWA's PWU Types — reusable definitions,
// with NO concrete execution/assurance state (RPH-DOC-010 §35.1) — a type inspector, and (while the PWA is a DRAFT)
// the full authoring surface: edit the PWA's details, define / edit / remove PWU Types (with the rich fields —
// completionRule, permitted child types), and advance the publication lifecycle
// DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED -> DEPRECATED -> RETIRED. A PUBLISHED PWA version is immutable
// (§11), so every authoring control disappears (and the engine rejects the command) once it is no longer DRAFT.
import { error, fail } from '@sveltejs/kit';
import { getObject, listPwuTypes, listUndertakings, SEED_UNDERTAKING } from '@janumipwb/rph-engine';
import { dispatch, getEngine, mintUiId } from '$lib/server/workbench';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const engine = getEngine();
	const pwa = getObject(engine, params.id);
	if (!pwa) throw error(404, 'PWA not found');
	// Conformance fixtures (§13/§21): Undertakings instantiated from this PWA that serve as reference fixtures.
	const fixtures = listUndertakings(engine)
		.filter((u) => u.state.pwaId === params.id)
		.map((u) => ({
			id: u.id,
			name: String(u.state.name ?? u.id),
			isReferenceFixture: u.id === SEED_UNDERTAKING
		}));
	const types = listPwuTypes(engine, params.id).map((t) => ({
		id: t.id,
		name: String(t.state.name ?? t.id),
		pwuKind: String(t.state.pwuKind ?? ''),
		purpose: String(t.state.purpose ?? ''),
		isRoot: Boolean(t.state.isRoot),
		completionRule: String(t.state.completionRule ?? ''),
		permittedChildTypeIds: Array.isArray(t.state.permittedChildTypeIds)
			? (t.state.permittedChildTypeIds as string[])
			: [],
		requiredAssurancePolicyIds: Array.isArray(t.state.requiredAssurancePolicyIds)
			? (t.state.requiredAssurancePolicyIds as string[])
			: []
	}));
	return {
		pwa: {
			id: params.id,
			name: String(pwa.name ?? params.id),
			description: String(pwa.description ?? ''),
			domain: String(pwa.domain ?? ''),
			version: String(pwa.version ?? ''),
			publicationStatus: String(pwa.publicationStatus ?? 'DRAFT')
		},
		types,
		fixtures
	};
};

interface TypeFields {
	name: string;
	pwuKind: string;
	purpose: string;
	completionRule: string;
	isRoot: boolean;
	permittedChildTypeIds: string[];
}

/** Read the shared PWU-Type authoring fields from a form (used by both defineType and editType). */
function readTypeFields(form: FormData): TypeFields {
	return {
		name: String(form.get('name') ?? '').trim(),
		pwuKind: String(form.get('pwuKind') ?? '')
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '_')
			.replace(/^_+|_+$/g, ''),
		purpose: String(form.get('purpose') ?? '').trim(),
		completionRule: String(form.get('completionRule') ?? '').trim(),
		isRoot: form.has('isRoot'),
		permittedChildTypeIds: form
			.getAll('permittedChildTypeIds')
			.map((v) => String(v))
			.filter(Boolean)
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
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'A PWA name is required.' });
		const r = dispatch('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', params.id, {
			pwaId: params.id,
			name,
			description: String(form.get('description') ?? '').trim(),
			domain: String(form.get('domain') ?? '').trim()
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
			permittedChildTypeIds: f.permittedChildTypeIds
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { definedType: id };
	},

	// Edit an existing PWU Type in place (DRAFT PWA only — the engine enforces this).
	editType: async ({ request }) => {
		const form = await request.formData();
		const pwuTypeId = String(form.get('pwuTypeId') ?? '').trim();
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
			permittedChildTypeIds: f.permittedChildTypeIds
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { editedType: pwuTypeId };
	},

	// Remove a PWU Type (DRAFT only). Referential-integrity guard lives here (the sibling query): a type that is a
	// permitted child of another cannot be removed until that reference is cleared.
	removeType: async ({ request, params }) => {
		const pwuTypeId = String((await request.formData()).get('pwuTypeId') ?? '').trim();
		if (!pwuTypeId) return fail(400, { error: 'Missing PWU Type.' });
		const referenced = listPwuTypes(getEngine(), params.id).some(
			(t) =>
				t.id !== pwuTypeId &&
				Array.isArray(t.state.permittedChildTypeIds) &&
				(t.state.permittedChildTypeIds as string[]).includes(pwuTypeId)
		);
		if (referenced) {
			return fail(400, {
				error: 'This type is a permitted child of another type — clear that reference first.'
			});
		}
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
	retire: ({ params }) => advancePwa('RetirePwa', params.id, {})
};
