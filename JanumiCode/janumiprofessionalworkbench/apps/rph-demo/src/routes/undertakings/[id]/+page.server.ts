// Undertaking Workbench — operates one Undertaking's Professional Work Graph. It shows the LIVE graph (scoped to
// this Undertaking's PWUs), a lifecycle rollup, and the assurance / decision / baseline working sets — all read
// from the live engine. The PWA-version binding is always visible (RPH-DOC-010 §25 header).
import { error } from '@sveltejs/kit';
import {
	getObject,
	listAssessments,
	listBaselines,
	listDecisions,
	listObservations,
	listPwus,
	professionalWorkGraph,
	REFERENCE_OPEN_RESIDUALS,
	SEED_UNDERTAKING
} from '@janumipwb/rph-engine';
import { getEngine } from '$lib/server/workbench';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const engine = getEngine();
	const u = getObject(engine, params.id);
	if (!u) throw error(404, 'Undertaking not found');
	const pwa = getObject(engine, String(u.pwaId));

	const graph = professionalWorkGraph(engine, {
		undertakingId: params.id,
		openResiduals: params.id === SEED_UNDERTAKING ? REFERENCE_OPEN_RESIDUALS : []
	});

	const pwus = listPwus(engine, params.id);
	const rollup: Record<string, number> = {};
	for (const p of pwus) {
		const s = String(p.state.workLifecycleState ?? 'PROPOSED');
		rollup[s] = (rollup[s] ?? 0) + 1;
	}

	const assessments = listAssessments(engine).map((a) => ({
		id: a.id,
		policy: String(a.state.assurancePolicyId ?? ''),
		state: String(a.state.assessmentState ?? '')
	}));
	const observations = listObservations(engine).map((o) => ({
		id: o.id,
		severity: String(o.state.severity ?? ''),
		statement: String(o.state.statement ?? ''),
		disposition: String(o.state.disposition ?? '')
	}));
	const decisions = listDecisions(engine).map((dc) => ({
		id: dc.id,
		type: String(dc.state.decisionType ?? ''),
		status: String(dc.state.status ?? ''),
		rationale: String(dc.state.rationale ?? '')
	}));
	const baselines = listBaselines(engine).map((b) => ({
		id: b.id,
		type: String(b.state.baselineType ?? ''),
		status: String(b.state.status ?? ''),
		items: Array.isArray(b.state.itemObjectVersions) ? b.state.itemObjectVersions.length : 0
	}));

	return {
		undertaking: {
			id: params.id,
			name: String(u.name ?? params.id),
			objective: String(u.objective ?? ''),
			intendedOutputProduct: String(u.intendedOutputProduct ?? ''),
			status: String(u.status ?? ''),
			pwaName: String(pwa?.name ?? u.pwaId ?? ''),
			pwaVersion: String(u.pwaVersion ?? '')
		},
		graph,
		rollup,
		assessments,
		observations,
		decisions,
		baselines
	};
};
