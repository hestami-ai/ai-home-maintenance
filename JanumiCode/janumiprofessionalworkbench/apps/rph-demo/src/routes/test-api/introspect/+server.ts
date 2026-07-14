// TEST-MODE ONLY endpoint — the E2E harness reads the engine's ground truth here (the append-only event log and
// every object's current materialized state) to assert the UI reflects REAL engine state, not just rendered markup
// (e.g. that a node the graph paints "green" truly has assuranceState SATISFIED — INV-5, no green without
// assurance). 404s unless RPH_DEMO_MODE=test, so it does not exist in a normal / production boot.
import { error, json } from '@sveltejs/kit';
import {
	listPwas,
	listPwuTypes,
	listUndertakings,
	listPwus,
	listExecutionPlans,
	listAssessments,
	listObservations,
	listDecisions,
	listBaselines,
	listConversations,
	listAuthoringAssessments
} from '@janumipwb/rph-engine';
import { getEngine, isTestMode } from '$lib/server/workbench';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	if (!isTestMode()) throw error(404, 'Not found');
	const e = getEngine();
	return json({
		events: e.readAllEvents(),
		pwas: listPwas(e),
		pwuTypes: listPwuTypes(e),
		undertakings: listUndertakings(e),
		pwus: listPwus(e),
		executionPlans: listExecutionPlans(e),
		assessments: listAssessments(e),
		observations: listObservations(e),
		decisions: listDecisions(e),
		baselines: listBaselines(e),
		conversations: listConversations(e),
		authoringAssessments: listAuthoringAssessments(e)
	});
};
