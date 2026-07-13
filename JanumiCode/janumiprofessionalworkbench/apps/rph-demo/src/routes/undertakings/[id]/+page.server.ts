// Undertaking Workbench — operates one Undertaking's Professional Work Graph. It shows the LIVE graph (scoped to
// this Undertaking's PWUs), a lifecycle rollup, and the assurance / decision / baseline working sets — all read
// from the live engine. The PWA-version binding is always visible (RPH-DOC-010 §25 header).
import { error, fail } from '@sveltejs/kit';
import {
	getObject,
	listAssessments,
	listBaselines,
	listDecisions,
	listExecutionPlans,
	listObservations,
	listPwus,
	listPwuTypes,
	professionalWorkGraph,
	REFERENCE_OPEN_RESIDUALS,
	SEED_UNDERTAKING
} from '@janumipwb/rph-engine';
import { dispatch, getEngine, getRegisteredIntent, mintUiId } from '$lib/server/workbench';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const engine = getEngine();
	const u = getObject(engine, params.id);
	if (!u) throw error(404, 'Undertaking not found');
	const pwa = getObject(engine, String(u.pwaId));
	// The bound PWA's PWU Types are the instantiable options (§14 / §28: an instance realizes a type).
	const pwuTypeOptions = listPwuTypes(engine, String(u.pwaId)).map((t) => ({
		id: t.id,
		name: String(t.state.name ?? t.id),
		pwuKind: String(t.state.pwuKind ?? '')
	}));

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
	// Instance -> Type navigation (§14 / §28): each PWU Instance links to its PWU Type definition (in its PWA).
	const pwuList = pwus.map((p) => {
		const typeId = p.state.pwuTypeId ? String(p.state.pwuTypeId) : '';
		const type = typeId ? getObject(engine, typeId) : undefined;
		return {
			id: p.id,
			title: String(p.state.title ?? p.id),
			workLifecycleState: String(p.state.workLifecycleState ?? ''),
			assuranceState: String(p.state.assuranceState ?? ''),
			typeName: type
				? String(type.name ?? typeId)
				: p.state.isLocalExtension
					? 'Undertaking-local extension'
					: '—',
			typePwaId: type ? String(type.pwaId ?? '') : ''
		};
	});

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
	const plans = listExecutionPlans(engine).map((pl) => ({
		id: pl.id,
		workUnitId: String(pl.state.workUnitId ?? ''),
		status: String(pl.state.status ?? ''),
		steps: Array.isArray(pl.state.steps) ? pl.state.steps.length : 0
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
		pwuList,
		plans,
		assessments,
		observations,
		decisions,
		baselines,
		pwuTypeOptions
	};
};

/** Resolve the Undertaking's originating Intent: from any existing PWU (they carry intentId), else the id
 *  remembered at creation for a still-empty Undertaking. */
function resolveIntentId(
	engine: ReturnType<typeof getEngine>,
	undertakingId: string
): string | undefined {
	const pwus = listPwus(engine, undertakingId);
	if (pwus.length) return String(pwus[0].state.intentId);
	return getRegisteredIntent(undertakingId);
}

export const actions: Actions = {
	// Instantiate a PWU Instance in this Undertaking, realizing a selected PWU Type (CON-009 ownership binding).
	proposePwu: async ({ request, params }) => {
		const engine = getEngine();
		const form = await request.formData();
		const pwuTypeId = String(form.get('pwuTypeId') ?? '').trim();
		const title = String(form.get('title') ?? '').trim();
		if (!pwuTypeId) return fail(400, { error: 'Select a PWU Type to instantiate.' });
		const type = getObject(engine, pwuTypeId);
		if (!type) return fail(400, { error: 'Unknown PWU Type.' });
		const intentId = resolveIntentId(engine, params.id);
		if (!intentId)
			return fail(400, { error: 'This Undertaking has no originating intent to bind the PWU to.' });
		const pwuId = mintUiId('pwu');
		const r = dispatch('ProposePwu', 'PROFESSIONAL_WORK_UNIT', pwuId, {
			pwuId,
			pwuKind: String(type.pwuKind ?? 'PWU'),
			title: title || String(type.name ?? 'PWU'),
			description: title || String(type.name ?? ''),
			intentId,
			undertakingId: params.id,
			isLocalExtension: false,
			pwuTypeId,
			boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [],
			assurancePolicyIds: [],
			riskProfile: {
				consequence: 'MEDIUM',
				uncertainty: 'MEDIUM',
				irreversibility: 'MEDIUM',
				securitySensitivity: 'MEDIUM',
				regulatoryExposure: 'LOW'
			}
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { proposed: pwuId };
	}
};
