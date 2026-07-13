// Undertaking Portfolio (Undertaking context) — active Undertakings, each showing its PWA-version binding.
import { getObject, listPwus, listUndertakings } from '@janumipwb/rph-engine';
import { getEngine } from '$lib/server/workbench';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const engine = getEngine();
	const undertakings = listUndertakings(engine).map((u) => {
		const pwa = getObject(engine, String(u.state.pwaId));
		return {
			id: u.id,
			name: String(u.state.name ?? u.id),
			objective: String(u.state.objective ?? ''),
			intendedOutputProduct: String(u.state.intendedOutputProduct ?? ''),
			status: String(u.state.status ?? ''),
			pwaId: String(u.state.pwaId ?? ''),
			pwaName: String(pwa?.name ?? u.state.pwaId ?? ''),
			pwaVersion: String(u.state.pwaVersion ?? ''),
			pwuCount: listPwus(engine, u.id).length
		};
	});
	return { undertakings };
};
