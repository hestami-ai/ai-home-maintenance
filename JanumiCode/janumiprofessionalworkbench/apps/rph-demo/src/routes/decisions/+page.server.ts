// Decision Center — governance acts across the workbench (approvals, waivers, promotions).
import { listDecisions } from '@janumipwb/rph-engine';
import { getEngine } from '$lib/server/workbench';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const decisions = listDecisions(getEngine()).map((d) => ({
		id: d.id,
		type: String(d.state.decisionType ?? ''),
		status: String(d.state.status ?? ''),
		selectedOption: String(d.state.selectedOption ?? ''),
		rationale: String(d.state.rationale ?? '')
	}));
	return { decisions };
};
