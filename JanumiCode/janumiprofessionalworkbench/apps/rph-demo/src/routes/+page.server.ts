// PWA Library (PWA Design context) — lists the Professional Work Architectures and creates a new DRAFT PWA live.
import { fail } from '@sveltejs/kit';
import { listPwas, listPwuTypes } from '@janumipwb/rph-engine';
import { dispatch, getEngine, mintUiId } from '$lib/server/workbench';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const engine = getEngine();
	const pwas = listPwas(engine).map((p) => ({
		id: p.id,
		name: String(p.state.name ?? p.id),
		description: String(p.state.description ?? ''),
		domain: String(p.state.domain ?? ''),
		version: String(p.state.version ?? ''),
		publicationStatus: String(p.state.publicationStatus ?? 'DRAFT'),
		typeCount: listPwuTypes(engine, p.id).length,
		policyCount: Array.isArray(p.state.assurancePolicyIds) ? p.state.assurancePolicyIds.length : 0
	}));
	return { pwas };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const domain = String(form.get('domain') ?? '').trim();
		if (!name) return fail(400, { error: 'A PWA name is required.' });
		const id = mintUiId('pwa');
		const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', id, {
			pwaId: id,
			name,
			description: `${name} — authored in the PWA Designer.`,
			domain: domain || 'general',
			version: '0.1.0'
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { created: id };
	},

	// Delete (discard) a PWA. The engine rejects deletion of a PWA that is in use (has Undertakings) — that
	// rejection is surfaced to the card. A published-but-unused PWA can still be deleted (the UI warns first).
	delete: async ({ request }) => {
		const pwaId = String((await request.formData()).get('pwaId') ?? '').trim();
		if (!pwaId) return fail(400, { error: 'Missing PWA.' });
		const r = dispatch('DeletePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { pwaId });
		if (r.status !== 'ACCEPTED')
			return fail(400, { error: r.error?.message ?? r.status, deleteFailedId: pwaId });
		return { deleted: pwaId };
	}
};
