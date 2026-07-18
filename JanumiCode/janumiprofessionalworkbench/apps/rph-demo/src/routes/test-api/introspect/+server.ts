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
	listAssurancePolicies,
	listObservations,
	listDecisions,
	listBaselines,
	listConversations
} from '@janumipwb/rph-engine';
import { getEngine, isTestMode } from '$lib/server/workbench';
import { getPendingAuthoringTurn, summarizeAuthoringTurn } from '$lib/server/authoring-turn';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	if (!isTestMode()) throw error(404, 'Not found');
	const e = getEngine();
	const pwas = listPwas(e);
	return json({
		events: e.readAllEvents(),
		pwas,
		pwuTypes: listPwuTypes(e),
		undertakings: listUndertakings(e),
		pwus: listPwus(e),
		executionPlans: listExecutionPlans(e),
		assessments: listAssessments(e),
		assurancePolicies: listAssurancePolicies(e),
		observations: listObservations(e),
		decisions: listDecisions(e),
		baselines: listBaselines(e),
		conversations: listConversations(e),
		// Explicitly separate process-local PREVIEW truth from canonical truth so E2E cannot accidentally conflate
		// them. This endpoint remains test-mode-only.
		authoringCandidates: pwas.flatMap((pwa) => {
			const turn = getPendingAuthoringTurn(pwa.id);
			return turn
				? [
						{
							pwaId: pwa.id,
							summary: summarizeAuthoringTurn(turn),
							pwuTypes: listPwuTypes(turn.engine, pwa.id),
							assessments: listAssessments(turn.engine),
							conversations: listConversations(turn.engine)
						}
					]
				: [];
		})
	});
};
