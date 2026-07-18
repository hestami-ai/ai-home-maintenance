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
import { buildApplicablePolicies, buildAssuranceView } from '@janumipwb/rph-projections';
import { dispatch, getEngine, getRegisteredIntent, mintUiId } from '$lib/server/workbench';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const engine = getEngine();
	const u = getObject(engine, params.id);
	if (!u) throw error(404, 'Undertaking not found');
	const pwa = getObject(engine, String(u.pwaId as string));
	// The bound PWA's PWU Types are the instantiable options (§14 / §28: an instance realizes a type).
	const pwuTypeOptions = listPwuTypes(engine, String(u.pwaId as string)).map((t) => ({
		id: t.id,
		name: String((t.state.name ?? t.id) as string),
		pwuKind: String((t.state.pwuKind ?? '') as string)
	}));

	const graph = professionalWorkGraph(engine, {
		undertakingId: params.id,
		openResiduals: params.id === SEED_UNDERTAKING ? REFERENCE_OPEN_RESIDUALS : []
	});

	const pwus = listPwus(engine, params.id);
	const rollup: Record<string, number> = {};
	for (const p of pwus) {
		const s = String((p.state.workLifecycleState ?? 'PROPOSED') as string);
		rollup[s] = (rollup[s] ?? 0) + 1;
	}
	// Instance -> Type navigation (§14 / §28): each PWU Instance links to its PWU Type definition (in its PWA).
	const pwuList = pwus.map((p) => {
		const typeId = p.state.pwuTypeId ? String(p.state.pwuTypeId as string) : '';
		const type = typeId ? getObject(engine, typeId) : undefined;
		let typeName: string;
		if (type) {
			typeName = String((type.name ?? typeId) as string);
		} else if (p.state.isLocalExtension) {
			typeName = 'Undertaking-local extension';
		} else {
			typeName = '—';
		}
		return {
			id: p.id,
			title: String((p.state.title ?? p.id) as string),
			workLifecycleState: String((p.state.workLifecycleState ?? '') as string),
			executionState: String((p.state.executionState ?? '') as string),
			assuranceState: String((p.state.assuranceState ?? '') as string),
			typeName,
			typePwaId: type ? String((type.pwaId ?? '') as string) : ''
		};
	});

	// The §38 Assurance View (DOC-004 §38 "Assurance Workbench Requirements") — a fold over the assurance events,
	// NOT the raw object store. This surfaces what the object store cannot: the validator implementation identity
	// (Increment 37), the INDEPENDENCE STATUS (Increments I2/I4 — 'VERIFIED' when the §39-inv-8 check ran and
	// passed, 'VIOLATED' on an AssuranceIndependenceViolated, undefined = unknown, never a fabricated pass), the
	// disposition, and the open conditions a CONDITIONALLY_SATISFIED verdict leaves. Joined by assessment id onto
	// the working set. This is the read model's FIRST live consumer; before, §38 was folded but never rendered.
	const view = buildAssuranceView(engine.readAllEvents());
	const assessments = listAssessments(engine).map((a) => {
		const v = view.assessments[a.id];
		return {
			id: a.id,
			policy: String((a.state.assurancePolicyId ?? '') as string),
			state: String((a.state.assessmentState ?? '') as string),
			// §38 fields — undefined renders as 'unknown', never as a false 'none' (the load-bearing distinction).
			disposition: v?.disposition ?? '',
			independenceStatus: v?.independenceStatus ?? '',
			validatorIdentity: v?.validatorImplementationIdentity ?? '',
			validatorVersion: v?.validatorImplementationVersion ?? '',
			openConditions: v?.openConditions ?? [],
			// The rest of §38, now sourced (Increments E/F). `missingEvidence` is the one field with no source yet,
			// so it is NOT here — the UI shows it as 'unknown', never a fabricated empty.
			claimsEvaluated: v?.claimsEvaluated ?? [],
			evidenceConsidered: v?.evidenceConsideredIds ?? [],
			controlActions: v?.controlActions ?? [],
			findings: (v?.observations ?? []).map((o) => ({
				code: o.findingCode,
				severity: o.severity,
				statement: o.statement,
				disposition: o.disposition
			})),
			waivers: (v?.waivers ?? []).map((w) => ({
				id: w.waiverDecisionId,
				status: w.status,
				findings: w.waivedFindingIds
			})),
			invalidations: (v?.invalidations ?? []).map((i) => ({
				status: i.status,
				objectId: i.invalidatedObjectId,
				reason: i.reason ?? ''
			}))
		};
	});

	// §38 "applicable policies" per PWU — the required-but-unassessed join. A PWU's applicable set is its own
	// assurancePolicyIds plus its PwuType's requiredAssurancePolicyIds (object state, not events); buildApplicablePolicies
	// marks each assessed or not. Only PWUs that actually have applicable policies are surfaced.
	const applicablePolicies = pwus
		.map((p) => {
			const typeId = p.state.pwuTypeId ? String(p.state.pwuTypeId as string) : '';
			const type = typeId ? getObject(engine, typeId) : undefined;
			const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
			const rows = buildApplicablePolicies({
				pwuId: p.id,
				directPolicyIds: asStrings(p.state.assurancePolicyIds),
				typeRequiredPolicyIds: asStrings(type?.requiredAssurancePolicyIds),
				view
			});
			return {
				pwuId: p.id,
				pwuTitle: String((p.state.title ?? p.id) as string),
				rows
			};
		})
		.filter((x) => x.rows.length > 0);
	const observations = listObservations(engine).map((o) => ({
		id: o.id,
		severity: String((o.state.severity ?? '') as string),
		statement: String((o.state.statement ?? '') as string),
		disposition: String((o.state.disposition ?? '') as string)
	}));
	const decisions = listDecisions(engine).map((dc) => ({
		id: dc.id,
		type: String((dc.state.decisionType ?? '') as string),
		status: String((dc.state.status ?? '') as string),
		rationale: String((dc.state.rationale ?? '') as string)
	}));
	const baselines = listBaselines(engine).map((b) => ({
		id: b.id,
		type: String((b.state.baselineType ?? '') as string),
		status: String((b.state.status ?? '') as string),
		items: Array.isArray(b.state.itemObjectVersions) ? b.state.itemObjectVersions.length : 0
	}));
	const plans = listExecutionPlans(engine).map((pl) => ({
		id: pl.id,
		workUnitId: String((pl.state.workUnitId ?? '') as string),
		status: String((pl.state.status ?? '') as string),
		steps: Array.isArray(pl.state.steps) ? pl.state.steps.length : 0
	}));

	return {
		undertaking: {
			id: params.id,
			name: String((u.name ?? params.id) as string),
			objective: String((u.objective ?? '') as string),
			intendedOutputProduct: String((u.intendedOutputProduct ?? '') as string),
			status: String((u.status ?? '') as string),
			pwaName: String((pwa?.name ?? u.pwaId ?? '') as string),
			pwaVersion: String((u.pwaVersion ?? '') as string)
		},
		graph,
		rollup,
		pwuList,
		plans,
		assessments,
		applicablePolicies,
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
	if (pwus.length) return String(pwus[0].state.intentId as string);
	return getRegisteredIntent(undertakingId);
}

const PWU = 'PROFESSIONAL_WORK_UNIT';
type Step = [command: string, aggType: string, aggId: string, payload: unknown];

/** A ChangePwuState step (the controller lever) that moves the four PWU axes together. */
function chg(
	pwuId: string,
	previousState: string,
	newState: string,
	executionState: string,
	assuranceState: string,
	shapeIntegrityState: string
): Step {
	return [
		'ChangePwuState',
		PWU,
		pwuId,
		{
			previousState,
			newState,
			executionState,
			assuranceState,
			shapeIntegrityState,
			reasonCode: 'CONTROLLER',
			supportingObjectIds: []
		}
	];
}

/** Run a command sequence, returning the first rejection message (DUPLICATE is fine) or null on success. */
function runSteps(steps: Step[]): string | null {
	for (const [ct, agg, id, pl] of steps) {
		const r = dispatch(ct, agg, id, pl);
		if (r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE') return r.error?.message ?? r.status;
	}
	return null;
}

async function pwuIdFrom(request: Request): Promise<string> {
	return String(((await request.formData()).get('pwuId') ?? '') as string);
}

export const actions: Actions = {
	// Instantiate a PWU Instance in this Undertaking, realizing a selected PWU Type (CON-009 ownership binding).
	proposePwu: async ({ request, params }) => {
		const engine = getEngine();
		const form = await request.formData();
		const pwuTypeId = String((form.get('pwuTypeId') ?? '') as string).trim();
		const title = String((form.get('title') ?? '') as string).trim();
		if (!pwuTypeId) return fail(400, { error: 'Select a PWU Type to instantiate.' });
		const type = getObject(engine, pwuTypeId);
		if (!type) return fail(400, { error: 'Unknown PWU Type.' });
		const intentId = resolveIntentId(engine, params.id);
		if (!intentId)
			return fail(400, { error: 'This Undertaking has no originating intent to bind the PWU to.' });
		const pwuId = mintUiId('pwu');
		const r = dispatch('ProposePwu', 'PROFESSIONAL_WORK_UNIT', pwuId, {
			pwuId,
			pwuKind: String((type.pwuKind ?? 'PWU') as string),
			title: title || String((type.name ?? 'PWU') as string),
			description: title || String((type.name ?? '') as string),
			intentId,
			undertakingId: params.id,
			isLocalExtension: false,
			pwuTypeId,
			// Shape the PWU at instantiation: DOC-002 §9.1 requires an in-scope statement, an out-of-scope status,
			// and an expected output before it can be marked READY (enforced by the readiness guard in beginExecute
			// below). Left empty, MarkPwuReady rightly rejects. `outOfScope` uses §9.1's permitted "not yet known".
			boundaries: {
				inScope: [`${title || String((type.name ?? 'PWU') as string)} for this Undertaking`],
				outOfScope: ['not yet known'],
				permittedChanges: [],
				prohibitedChanges: []
			},
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [{ outputId: `out_${pwuId}`, kind: 'DOCUMENT' }],
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
	},

	// Drive a PWU through shaping + execution to EXECUTED/SUCCEEDED — still UNASSESSED, so amber (not green).
	beginExecute: async ({ request }) => {
		const pwuId = await pwuIdFrom(request);
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		const err = runSteps([
			['BeginPwuShaping', PWU, pwuId, {}],
			[
				'MarkPwuReady',
				PWU,
				pwuId,
				{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 }
			],
			chg(pwuId, 'READY', 'PLANNED', 'PLANNED', 'UNASSESSED', 'PRESERVED'),
			chg(pwuId, 'PLANNED', 'EXECUTING', 'QUEUED', 'UNASSESSED', 'PRESERVED'),
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', 'UNASSESSED', 'PRESERVED'),
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', 'UNASSESSED', 'PRESERVED')
		]);
		if (err) return fail(400, { error: `Execution failed: ${err}` });
		return { advanced: 'executed' };
	},

	// Move the PWU into assurance and set assuranceState -> SATISFIED via the controller lever (exactly as the
	// reference undertaking does). The PWU is NOT yet green: workLifecycle stays UNDER_ASSURANCE until Mark
	// Satisfied — execution success and assurance stay separate (INV-5). NOTE: authoring first-class assurance
	// ASSESSMENT / OBSERVATION / EVIDENCE / CLAIM artifacts (with the full ValidatorResult) is a distinct flow and
	// a documented follow-up; here we drive the assurance AXIS, which is what gates the green state.
	recordAssurance: async ({ request }) => {
		const pwuId = await pwuIdFrom(request);
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		const err = runSteps([
			chg(pwuId, 'EXECUTING', 'EVIDENCE_PENDING', 'SUCCEEDED', 'EVIDENCE_REQUIRED', 'PRESERVED'),
			chg(
				pwuId,
				'EVIDENCE_PENDING',
				'UNDER_ASSURANCE',
				'SUCCEEDED',
				'READY_FOR_ASSESSMENT',
				'PRESERVED'
			),
			chg(pwuId, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SUCCEEDED', 'ASSESSING', 'PRESERVED'),
			chg(pwuId, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SUCCEEDED', 'SATISFIED', 'PRESERVED')
		]);
		if (err) return fail(400, { error: `Assurance failed: ${err}` });
		return { advanced: 'assured' };
	},

	// Promote to SATISFIED (green). Allowed ONLY because assuranceState is SATISFIED — "no green without assurance"
	// (INV-5 / property P1). Invoked before assurance, the engine rejects and the error surfaces in the UI.
	markSatisfied: async ({ request }) => {
		const pwuId = await pwuIdFrom(request);
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		const err = runSteps([
			chg(pwuId, 'UNDER_ASSURANCE', 'SATISFIED', 'SUCCEEDED', 'SATISFIED', 'PRESERVED')
		]);
		if (err) return fail(400, { error: `No green without assurance: ${err}` });
		return { advanced: 'satisfied' };
	}
};
