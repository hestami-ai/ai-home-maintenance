// Decision Center — governance acts across the workbench (approvals, waivers, promotions). The list is a read
// View of every Decision; the actions author governance: propose a Decision (PROPOSED) then approve it (EFFECTIVE).
// A decision is authority exercised — a PROPOSED recommendation is not approval (INV / RPH-GOV-001/002).
import { fail } from '@sveltejs/kit';
import { listDecisions } from '@janumipwb/rph-engine';
import { dispatch, getEngine, mintUiId } from '$lib/server/workbench';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const decisions = listDecisions(getEngine()).map((d) => ({
		id: d.id,
		type: String((d.state.decisionType ?? '') as string),
		status: String((d.state.status ?? '') as string),
		selectedOption: String((d.state.selectedOption ?? '') as string),
		rationale: String((d.state.rationale ?? '') as string)
	}));
	return { decisions };
};

export const actions: Actions = {
	// Propose a governance Decision — creates it in PROPOSED with a HUMAN authority so it can later be approved.
	propose: async ({ request }) => {
		const form = await request.formData();
		const decisionType = String((form.get('decisionType') ?? '') as string).trim();
		const selectedOption = String((form.get('selectedOption') ?? '') as string).trim();
		const rationale = String((form.get('rationale') ?? '') as string).trim();
		if (!decisionType) return fail(400, { error: 'A decision type is required.' });
		if (!selectedOption) return fail(400, { error: 'A selected option is required.' });
		const id = mintUiId('dec');
		const r = dispatch('ProposeDecision', 'DECISION', id, {
			decisionType,
			subjectObjectIds: [],
			selectedOption,
			rationale,
			authority: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' },
			consideredEvidenceIds: [],
			consideredObservationIds: []
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { proposed: id };
	},

	// Approve a PROPOSED Decision — PROPOSED -> EFFECTIVE (gated by the decision's HUMAN authority).
	approve: async ({ request }) => {
		const form = await request.formData();
		const id = String((form.get('id') ?? '') as string).trim();
		if (!id) return fail(400, { error: 'A decision id is required to approve.' });
		const selectedOption = String((form.get('selectedOption') ?? '') as string).trim();
		const rationale = String((form.get('rationale') ?? '') as string).trim();
		const r = dispatch('ApproveDecision', 'DECISION', id, {
			selectedOption,
			rationale,
			consideredEvidenceIds: [],
			consideredObservationIds: [],
			subjectSemanticVersions: {}
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { approved: id };
	}
};
