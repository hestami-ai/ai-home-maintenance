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
	listByType,
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
		// WORKSPACE, and it MUST stay so (SPEC-001 INV-02 / FORK-9). This endpoint is the E2E harness's
		// GROUND-TRUTH read: specs assert against what the engine holds, precisely so a scoped UI view can be
		// checked against an unscoped source. Scoping it would blind every spec that uses it — including the two
		// that prove the scoping fix itself.
		assessments: listAssessments(e, { kind: 'WORKSPACE' }),
		assurancePolicies: listAssurancePolicies(e),
		observations: listObservations(e, { kind: 'WORKSPACE' }),
		// JAN-SLICE-SWP-06 — the evidence stage's ground truth. A SURFACE Slice that asserted the browser's own
		// rendering would prove only that the page says what the page says; the roadmap forbids exactly that
		// ("MUST NOT assert a SURFACE journey by inspecting server-rendered HTML alone"). The Slice drives the
		// real UI and then reads the ENGINE here, so what it proves is that the operator's acts reached the store.
		evidence: listByType(e, 'EVIDENCE'),
		decisions: listDecisions(e, { kind: 'WORKSPACE' }),
		baselines: listBaselines(e, { kind: 'WORKSPACE' }),
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
							// WORKSPACE over the CANDIDATE engine — a preview turn's isolated engine holds only that
							// turn's objects, so its workspace is already the scope.
							assessments: listAssessments(turn.engine, { kind: 'WORKSPACE' }),
							conversations: listConversations(turn.engine)
						}
					]
				: [];
		})
	});
};
