// PWA Overview + Work Architecture View (PWA Design context). Shows the PWA's PWU Types — reusable definitions,
// with NO concrete execution/assurance state (RPH-DOC-010 §35.1) — a type inspector, and (while the PWA is a DRAFT)
// the authoring surface: define PWU Types and advance the publication lifecycle
// DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED. Published PWAs are immutable (§11), so the authoring controls
// disappear once published and DefinePwuType is rejected by the engine.
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

/** Advance the PWA publication FSM and surface any engine rejection to the form. */
function advancePwa(commandType: string, pwaId: string, payload: Record<string, unknown>) {
	const r = dispatch(commandType, 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, payload);
	if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
	return { advanced: commandType };
}

export const actions: Actions = {
	// Define a reusable PWU Type on this (DRAFT) PWA — the authoring control the Work Architecture view was missing.
	defineType: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const pwuKind = String(form.get('pwuKind') ?? '')
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
		const purpose = String(form.get('purpose') ?? '').trim();
		const isRoot = form.has('isRoot');
		if (!name || !pwuKind) return fail(400, { error: 'A PWU Type name and kind are required.' });
		const id = mintUiId('pwut');
		const r = dispatch('DefinePwuType', 'PWU_TYPE', id, {
			pwuTypeId: id,
			pwaId: params.id,
			pwuKind,
			name,
			purpose: purpose || name,
			isRoot
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { definedType: id };
	},
	submitForReview: ({ params }) => advancePwa('SubmitPwaForReview', params.id, {}),
	validate: ({ params }) => advancePwa('ValidatePwa', params.id, {}),
	// Publish requires a declared root PWU Type (which must have been defined while DRAFT); resolve it server-side.
	publish: ({ params }) => {
		const root = listPwuTypes(getEngine(), params.id).find((t) => t.state.isRoot === true);
		if (!root) return fail(400, { error: 'Define a root PWU Type before publishing.' });
		return advancePwa('PublishPwa', params.id, { rootPwuTypeId: root.id });
	}
};
