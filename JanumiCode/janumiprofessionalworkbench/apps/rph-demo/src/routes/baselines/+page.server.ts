// Baseline Manager — the authoritative, immutable promotions across the workbench.
import { listBaselines } from '@janumipwb/rph-engine';
import { getEngine } from '$lib/server/workbench';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const baselines = listBaselines(getEngine()).map((b) => ({
		id: b.id,
		type: String(b.state.baselineType ?? ''),
		status: String(b.state.status ?? ''),
		purpose: String(b.state.purpose ?? ''),
		items: Array.isArray(b.state.itemObjectVersions) ? b.state.itemObjectVersions.length : 0
	}));
	return { baselines };
};
