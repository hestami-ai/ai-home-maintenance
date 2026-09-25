// TEST-MODE ONLY endpoint — the E2E harness reads the engine's ground truth here (the append-only event log and
// every object's current materialized state) to assert the UI reflects REAL engine state, not just rendered markup
// (e.g. that a node the graph paints "green" truly has assuranceState SATISFIED — INV-5, no green without
// assurance). 404s unless the process DECLARES the harness (RPH_DEMO_MODE=test or JPWB_HARNESS=1) -- JAN-EXEC R24.
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
import { getEngine, harnessExposed } from '$lib/server/workbench';
import { getPendingAuthoringTurn, summarizeAuthoringTurn } from '$lib/server/authoring-turn';
import { registeredStipulations } from '$lib/server/stipulations';
import { laneControlReport } from '$lib/server/lane-control';
import type { DomainEvent } from '@janumipwb/rph-contracts';
import type { RequestHandler } from './$types';

/** A staged candidate's OWN events of one type: its log is canonical's at the fork plus its own, so only events
 *  canonical does not hold are the candidate's. */
function candidateOwn(
	candidate: { readAllEvents(): readonly DomainEvent[] },
	canonicalIds: ReadonlySet<string>,
	eventType: string
) {
	return candidate
		.readAllEvents()
		.filter((e) => e.eventType === eventType && !canonicalIds.has(e.eventId));
}

export const GET: RequestHandler = () => {
	if (!harnessExposed()) throw error(404, 'Not found');
	const e = getEngine();
	const pwas = listPwas(e);
	const events = e.readAllEvents();
	const canonicalIds = new Set(events.map((ev) => ev.eventId));
	return json({
		events,
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
		// JAN-EXECRUN — the ground truth for "a work unit actually ran". A spec that asserted the PAGE said
		// so would prove only that the page says what the page says; these two are what the engine holds.
		modelExchanges: listByType(e, 'MODEL_EXCHANGE'),
		artifacts: listByType(e, 'ARTIFACT'),
		// ⭑ JAN-EXECGOV EG-02 — the ground truth for `STA-8`, *"Execution requires an approved plan and
		// AUTHORIZED Runtime Bindings"*. Until this slice the production count was ZERO, so a spec asserting it
		// had nothing to read. Exposed here rather than asserted from the page, for the reason the two comments
		// above give: a page saying so proves only that the page says so.
		runtimeBindings: listByType(e, 'RUNTIME_BINDING'),
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
							conversations: listConversations(turn.engine),
							// ⭐ `JAN-CRITREAD` J1-3 (§4.8): what a staged review RESTS ON — its criterion rows and its
							// completion — which the object state alone does not say. The candidate's own events only.
							criterionEvents: candidateOwn(turn.engine, canonicalIds, 'AssuranceCriterionEvaluated'),
							completionEvents: candidateOwn(turn.engine, canonicalIds, 'AssuranceAssessmentCompleted')
						}
					]
				: [];
		}),
		// ⭐ `JAN-CRITREAD` J1-3 — the stipulation registry as the server holds it (a reset discards it), and the lane
		// control's marks and kept violations (§4.8; `REG-D-072` D8). Read-only here: the checks run at every reset,
		// after each test, and at the final call.
		stipulations: registeredStipulations(),
		lane: laneControlReport()
	});
};
