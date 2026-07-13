// PWA Overview + Work Architecture View (PWA Design context). Shows the PWA's PWU Types — reusable definitions,
// with NO concrete execution/assurance state (RPH-DOC-010 §35.1) — and a type inspector.
import { error } from '@sveltejs/kit';
import { getObject, listPwuTypes } from '@janumipwb/rph-engine';
import { getEngine } from '$lib/server/workbench';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const engine = getEngine();
	const pwa = getObject(engine, params.id);
	if (!pwa) throw error(404, 'PWA not found');
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
		types
	};
};
