// Baseline Manager — the authoritative, immutable promotions across the workbench. The load reads the current
// Baselines through the query surface; the actions dispatch real BASELINE commands, advancing the authoring
// lifecycle CANDIDATE -> UNDER_REVIEW -> APPROVED live. Promotion to AUTHORITATIVE (PromoteBaseline) is a
// documented follow-up: canPromoteBaseline needs an effective promotion Decision + satisfied assessments, which is
// out of scope for this authoring surface.
import { fail } from '@sveltejs/kit';
import { listBaselines } from '@janumipwb/rph-engine';
import { dispatch, getEngine, mintUiId } from '$lib/server/workbench';
import type { Actions, PageServerLoad } from './$types';

// BaselineObject.baselineType — RPH-DOC-007 §23 / DOC-002 §24.1 (6 values).
const BASELINE_TYPES = [
	'INTENT',
	'REQUIREMENTS',
	'ARCHITECTURE',
	'IMPLEMENTATION',
	'RELEASE',
	'EVIDENCE_PACKAGE'
] as const;

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

export const actions: Actions = {
	// Create a Baseline candidate (CANDIDATE) of the chosen type. Items + assessments are pinned later; a bare
	// candidate is valid and the starting point of the authoring lifecycle.
	create: async ({ request }) => {
		const form = await request.formData();
		const baselineType = String(form.get('baselineType') ?? '');
		if (!(BASELINE_TYPES as readonly string[]).includes(baselineType)) {
			return fail(400, { error: 'Choose a baseline type.' });
		}
		const id = mintUiId('base');
		const r = dispatch('CreateBaseline', 'BASELINE', id, {
			baselineType,
			itemObjectIds: [],
			assuranceAssessmentIds: []
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { created: id };
	},

	// CANDIDATE -> UNDER_REVIEW.
	submit: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'A baseline id is required.' });
		const r = dispatch('SubmitBaselineForReview', 'BASELINE', id, {});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { submitted: id };
	},

	// UNDER_REVIEW -> APPROVED.
	approve: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'A baseline id is required.' });
		const r = dispatch('ApproveBaseline', 'BASELINE', id, {});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { approved: id };
	}
};
