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
import {
	buildApplicablePolicies,
	buildAssuranceView,
	conditionEvaluatorFor,
	type ExecutionAttemptView,
	executionAttempts,
	type ExecutionPlanInput,
	plansForPwus,
	prunableStepIds,
	rebuildProjection,
	type SequenceInstance,
	sequenceView,
	startableStepIds,
	traceabilityProjector
} from '@janumipwb/rph-projections';
import {
	buildPwaExport,
	dispatch,
	getEngine,
	getRegisteredIntent,
	mintUiId
} from '$lib/server/workbench';
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
	// W4-INC-1 (WP-4-007): the intent-to-baseline TRACEABILITY surface. The `traceabilityProjector` (rph-projections,
	// built in W2-INC-3) folds the event log into a typed link graph but had no UI consumer — the clearest
	// "backend built, UI absent" gap. Rebuild it and scope to this Undertaking: every typed link touching one of
	// its PWUs (TRACES_TO_INTENT / DECOMPOSES / CHILD_OF / ASSESSES / ABOUT / OBLIGATION_OF / BASELINES). Read-only,
	// derived, no authority (master invariant 9).
	const pwuIdSet = new Set(pwus.map((p) => p.id));
	const traceView = rebuildProjection(traceabilityProjector, engine.readAllEvents());
	const traceLinks = traceView.links
		.filter((l) => pwuIdSet.has(l.from) || pwuIdSet.has(l.to))
		.map((l) => ({ from: l.from, to: l.to, type: l.type }));
	const traceCounts: Record<string, number> = {};
	for (const l of traceLinks) traceCounts[l.type] = (traceCounts[l.type] ?? 0) + 1;

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
			// The rest of §38, now sourced (Increments E/F + missingEvidence follow-up). `missingEvidence` is the
			// policy's required-evidence set not yet received (empty = the policy requires none — a real sourced none).
			claimsEvaluated: v?.claimsEvaluated ?? [],
			evidenceConsidered: v?.evidenceConsideredIds ?? [],
			controlActions: v?.controlActions ?? [],
			missingEvidence: v?.missingEvidence ?? [],
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
	// Execution plane (JAN-EXECPLAN DWP-01/02): shape the EXECUTION_PLAN aggregates into per-PWU views and SCOPE them
	// to THIS Undertaking's PWUs — fixing the F-6 bug (listExecutionPlans is engine-GLOBAL, unlike graph/pwuList/trace).
	// pwuIdSet is the two-hop scope: listPwus(engine, params.id) → the PWU ids → plan.workUnitId ∈ that set (a plan
	// carries no undertakingId — F-1). The pure view (rph-projections) derives each step's tone + command-backed
	// affordances; this load() only reads.
	const asRec = (v: unknown): Record<string, unknown> =>
		v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
	const planRows: ExecutionPlanInput[] = listExecutionPlans(engine).map((pl) => ({
		id: pl.id,
		workUnitId: String((pl.state.workUnitId ?? '') as string),
		status: String((pl.state.status ?? '') as string),
		...(typeof pl.state.planVersion === 'number' ? { planVersion: pl.state.planVersion } : {}),
		steps: (Array.isArray(pl.state.steps) ? pl.state.steps : []).map((raw) => {
			const s = asRec(raw);
			return {
				id: String((s.id ?? '') as string),
				stepType: String((s.stepType ?? '') as string),
				purpose: String((s.purpose ?? '') as string),
				stepState: String((s.stepState ?? '') as string),
				...(s.runtimeBindingId ? { runtimeBindingId: String(s.runtimeBindingId as string) } : {})
			};
		}),
		// DR-004 DWP-01 — the transition graph (empty ⇒ linear). Fed to the flow gate + a future graph view.
		transitions: (Array.isArray(pl.state.transitions) ? pl.state.transitions : []).map((raw) => {
			const t = asRec(raw);
			return {
				...(t.id ? { id: String(t.id as string) } : {}),
				...(t.sourceStepId ? { sourceStepId: String(t.sourceStepId as string) } : {}),
				...(t.targetStepId ? { targetStepId: String(t.targetStepId as string) } : {}),
				...(t.transitionType ? { transitionType: String(t.transitionType as string) } : {}),
				...(t.conditionExpression !== undefined ? { conditionExpression: t.conditionExpression } : {})
			};
		})
	}));
	const plans = plansForPwus(planRows, pwuIdSet);

	// JAN-EXECPLAN-DR-004 DWP-01 — the transition-graph flow gate affordance (set-frontier). For each plan, derive the
	// SET of steps the engine would currently let start (the graph in-edge barrier; a linear plan yields a singleton).
	// The UI offers Start ONLY on a step in this set (the engine's startExecutionStep gate is the backstop — the UI does
	// not tempt a start it would reject). A plan with no startable step maps to an empty/absent list.
	// The CONDITIONAL-edge guard evaluator (DWP-02/03) is folded per plan from its committed state + the event log, so
	// the read-model's BRANCH first-match matches the engine authority exactly (§19-M2). prunableStepByPlan surfaces a
	// resolved BRANCH's not-taken arm (+ transitive downstream) for a Prune action (DWP-03/06).
	const engineEvents = engine.readAllEvents();
	const startableStepByPlan: Record<string, string[]> = {};
	const prunableStepByPlan: Record<string, string[]> = {};
	for (const pl of plans) {
		const evalGuard = conditionEvaluatorFor(pl, engineEvents);
		const sids = startableStepIds(pl, evalGuard);
		if (sids.length) startableStepByPlan[pl.id] = sids;
		const prunable = prunableStepIds(pl, evalGuard);
		if (prunable.length) prunableStepByPlan[pl.id] = prunable;
	}

	// Execution Attempt history (JAN-EXECPLAN Tier-3 DWP-03/05): fold the Execution* event stream into §10.4 attempt
	// records, scoped to THIS undertaking's plans, keyed by step for the per-step history render. stepTypeById (from
	// the shaped plans — the events don't carry stepType) drives the AI-no-binding coherence advisory.
	const stepTypeById: Record<string, string> = {};
	for (const pl of plans) for (const s of pl.steps) stepTypeById[s.id] = s.stepType;
	const scopedPlanIds = new Set(plans.map((pl) => pl.id));
	const attemptsByStepId: Record<string, ExecutionAttemptView[]> = {};
	for (const a of executionAttempts(engine.readAllEvents(), stepTypeById)) {
		if (scopedPlanIds.has(a.executionPlanId)) (attemptsByStepId[a.stepId] ??= []).push(a);
	}

	// Tier-2 execution SEQUENCE (JAN-EXECPLAN DWP-04, fork C): arrange the Undertaking's PWU INSTANCES by their TYPES'
	// hand-off dependency (reuse buildPwaExport — version-scoped to the bound (pwaId, pwaVersion) — then layerHandoff),
	// plus a SINGLE-AXIS coherence advisory (consumer began before any producer instance SUCCEEDED). The type→instance
	// join is done HERE in load() where the raw pwuTypeId lives (the serialized pwuList drops it). ADVISORY ONLY — the
	// value is display-only and never flows into a command dispatch (fork C; it gates nothing).
	const boundVersion = u.pwaVersion ? String(u.pwaVersion as string) : undefined;
	const boundTypeGraph = buildPwaExport(String(u.pwaId as string), engine, boundVersion);
	const seqInstances: SequenceInstance[] = pwus.map((p) => {
		const typeId = p.state.pwuTypeId ? String(p.state.pwuTypeId as string) : '';
		return {
			id: p.id,
			title: String((p.state.title ?? p.id) as string),
			executionState: String((p.state.executionState ?? '') as string),
			...(typeId ? { pwuTypeId: typeId } : {})
		};
	});
	const sequence = boundTypeGraph
		? sequenceView(boundTypeGraph, seqInstances)
		: {
				layers: [],
				unplaced: seqInstances.map((i) => ({ ...i, reason: 'off-graph' as const })),
				advisories: []
			};

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
		startableStepByPlan,
		prunableStepByPlan,
		attemptsByStepId,
		sequence,
		assessments,
		applicablePolicies,
		observations,
		decisions,
		baselines,
		pwuTypeOptions,
		trace: { links: traceLinks, counts: traceCounts }
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

// A lightweight NONE-independence "operator sign-off" policy the interactive demo assesses under. The reference
// SEED (reference-undertaking.ts) uses a DIFFERENT_AGENT fitness policy and a distinct evaluator; the demo keeps
// it minimal — independence NONE, so completeAssuranceAssessment skips the independence check (assurance.ts) and a
// SATISFIED disposition backs the PWU's assuranceState=SATISFIED hop without a separate reviewer identity. Created
// + activated once, lazily (below), then reused.
const DEMO_POLICY_ID = 'pol_01ARZ3NDEKTSV4RRFFQ69GDEM0';

/** A ChangePwuState step (the controller lever) that moves the four PWU axes together. `supportingObjectIds` cites
 *  the objects that BACK the transition (DOC-007 §11.5) — the EXECUTION_PLAN whose step succeeded for
 *  executionState=SUCCEEDED, and the SATISFIED ASSURANCE_ASSESSMENT for assuranceState=SATISFIED — which the
 *  RPH-PWU-006 Given guards (pwu.ts) now require. */
function chg(
	pwuId: string,
	previousState: string,
	newState: string,
	executionState: string,
	assuranceState: string,
	shapeIntegrityState: string,
	supportingObjectIds: readonly string[] = []
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
			supportingObjectIds
		}
	];
}

/** Run a command sequence, returning the first rejection (naming the command that failed; DUPLICATE is fine) or
 *  null on success. Prefixing the command type turns an opaque "Schema validation failed" into a locatable one. */
function runSteps(steps: Step[]): string | null {
	for (const [ct, agg, id, pl] of steps) {
		const r = dispatch(ct, agg, id, pl);
		if (r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE')
			return `${ct}: ${r.error?.message ?? r.status}`;
	}
	return null;
}

async function pwuIdFrom(request: Request): Promise<string> {
	return String(((await request.formData()).get('pwuId') ?? '') as string);
}

const str = (f: FormData, k: string): string => String((f.get(k) ?? '') as string).trim();

/** Dispatch ONE existing domain command and map the engine result to a form-action result. On rejection the RPH_*
 *  code + message surface VERBATIM (JAN-EXECPLAN DWP-03): the UI shows the engine's reason and never fabricates a
 *  success. The engine guards (plan-ACTIVE, the §8.4 floor gate on complete, one-active-plan) stay authoritative. */
function dispatchResult(commandType: string, aggId: string, payload: unknown) {
	const r = dispatch(commandType, 'EXECUTION_PLAN', aggId, payload);
	if (r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE')
		return fail(400, {
			error: `${commandType} rejected — ${r.error?.code ?? r.status}: ${r.error?.message ?? ''}`
		});
	return { advanced: commandType };
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

	// Drive a PWU through shaping + a REAL execution step to executionState=SUCCEEDED — still UNASSESSED, so amber
	// (not green). The controller may NOT declare SUCCEEDED: RPH-PWU-006 / §8.1 require an EXECUTION_PLAN whose step
	// actually succeeded. A TRANSFORMATION step completed by the operator is not AI-produced, so the §8.4 floor gate
	// admits the completion without a Reasoning Review (the reference seed demonstrates the AI-floor path).
	beginExecute: async ({ request }) => {
		const pwuId = await pwuIdFrom(request);
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		const planId = mintUiId('plan');
		const stepId = mintUiId('step');
		const attemptId = mintUiId('attempt');
		const err = runSteps([
			['BeginPwuShaping', PWU, pwuId, {}],
			[
				'MarkPwuReady',
				PWU,
				pwuId,
				{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 }
			],
			[
				'ProposeExecutionPlan',
				'EXECUTION_PLAN',
				planId,
				{
					executionPlanId: planId,
					workUnitId: pwuId,
					steps: [
						{
							id: stepId,
							executionPlanId: planId,
							stepType: 'TRANSFORMATION',
							purpose: 'Produce the PWU output',
							inputBindings: [],
							outputBindings: [],
							preconditions: [],
							postconditions: [],
							stepState: 'QUEUED'
						}
					],
					transitions: [],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				}
			],
			['ApproveExecutionPlan', 'EXECUTION_PLAN', planId, {}],
			['ActivateExecutionPlan', 'EXECUTION_PLAN', planId, { authorizedRuntimeBindingIds: [] }],
			chg(pwuId, 'READY', 'PLANNED', 'PLANNED', 'UNASSESSED', 'PRESERVED', [planId]),
			chg(pwuId, 'PLANNED', 'EXECUTING', 'QUEUED', 'UNASSESSED', 'PRESERVED', [planId]),
			['StartExecutionStep', 'EXECUTION_PLAN', planId, { stepId }],
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', 'UNASSESSED', 'PRESERVED', [planId]),
			// Explicit no-output completion (RPH-EXE-006 permits it) — the demo shows the lifecycle, not artifact
			// authoring. Non-AI (TRANSFORMATION + HUMAN operator), so the floor gate admits it. executionProvenance is
			// required (§16.1); recording the human operator keeps the step non-AI.
			[
				'CompleteExecutionStep',
				'EXECUTION_PLAN',
				planId,
				{
					executionStepId: stepId,
					executionAttemptId: attemptId,
					resultStatus: 'SUCCEEDED',
					outputArtifactIds: [],
					proposedEvidenceIds: [],
					detectedAssumptionIds: [],
					structuredResult: {},
					executionProvenance: {
						executedBy: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' }
					}
				}
			],
			// Earned, and cited: the plan whose step actually succeeded now backs executionState=SUCCEEDED.
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', 'UNASSESSED', 'PRESERVED', [planId])
		]);
		if (err) return fail(400, { error: `Execution failed: ${err}` });
		return { advanced: 'executed' };
	},

	// JAN-EXECPLAN DWP-03 — handler-backed step actions. Each dispatches ONE existing command from the EXPLICIT
	// allowlist (Start/Complete/Fail/Retry step + Cancel plan). The UI derives WHICH button to show from the
	// read-model's advanceCommands (the four command-backed transitions ONLY — never the wider stepState machine
	// topology, F-11); these actions only DISPATCH. None sets executionState — that is still the gated ChangePwuState
	// (INV-5); these move stepState / plan status, and the floor gate on complete stays authoritative.
	startStep: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('StartExecutionStep', str(f, 'planId'), { stepId: str(f, 'stepId') });
	},
	failStep: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('FailExecutionStep', str(f, 'planId'), {
			stepId: str(f, 'stepId'),
			failureReason: str(f, 'reason') || 'Operator marked the step failed.'
		});
	},
	retryStep: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('RetryExecutionStep', str(f, 'planId'), {
			stepId: str(f, 'stepId'),
			retryReason: str(f, 'reason') || 'Operator retry.'
		});
	},
	// JAN-EXECPLAN-DR-003 DWP-02/03 — the terminal step-lifecycle actions. Skip asserts mandatory:false (an OPTIONAL
	// skip): the fail-closed mandatory/waiver path is DOMAIN-tested, not a demo button, so the UI never silently skips
	// a mandatory step. A SKIPPED step is terminal-success, so the start-gate advances to the next step. Cancel is
	// CLEANUP (permitted even post-supersession). Both dispatch one allowlisted command; a rejection surfaces verbatim.
	skipStep: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('SkipExecutionStep', str(f, 'planId'), {
			stepId: str(f, 'stepId'),
			mandatory: false
		});
	},
	cancelStep: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('CancelExecutionStep', str(f, 'planId'), {
			stepId: str(f, 'stepId'),
			reason: str(f, 'reason') || 'Operator cancelled the step.'
		});
	},
	// DR-004 DWP-03 — prune a not-taken BRANCH arm (or transitively-unreachable step) to SKIPPED. Surfaced only for
	// steps in prunableStepByPlan (system prune ≠ user waiver; dispatch surfaces a rejection verbatim).
	pruneStep: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('PruneExecutionStep', str(f, 'planId'), { stepId: str(f, 'stepId') });
	},
	cancelPlan: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('CancelExecutionPlan', str(f, 'planId'), {
			reason: str(f, 'reason') || 'Operator cancelled the plan.'
		});
	},
	// JAN-EXECPLAN Tier-3 DWP-05 — the plan-terminal actions (DWP-01). CompleteExecutionPlan's engine guard is the
	// SUCCESS allow-list (every step SUCCEEDED-or-SKIPPED, non-empty); a rejection surfaces verbatim. Exec ≠ assurance:
	// a COMPLETED plan is an EXECUTION-axis fact, never assurance/green (INV-5 — the UI renders it as a plain status).
	// (SupersedeExecutionPlan needs a successor plan id and is domain-tested; it is not surfaced as a demo button.)
	completePlan: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('CompleteExecutionPlan', str(f, 'planId'), {});
	},
	failPlan: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('FailExecutionPlan', str(f, 'planId'), {
			failureReason: str(f, 'reason') || 'Operator failed the plan.'
		});
	},
	// Complete a RUNNING step. Default: a HUMAN, no-output completion (RPH-EXE-006) the floor gate admits (no
	// AI-produced result to assess), mirroring beginExecute. Optional `outputArtifactId` + `aiProduced` let a caller
	// name a produced output and its provenance — an AGENT/MODEL producer makes the result AI-produced, so its de
	// minimis floor MUST be SATISFIED before the step may SUCCEED (§8.4 floor gate; floor-gate.ts signal-0). An
	// AI-produced output whose floor is unsatisfied is REJECTED (RPH_INVARIANT_VIOLATION); a nonexistent output id is
	// REJECTED (RPH_VALIDATION_SEMANTIC_FAILED) — both surfaced verbatim (the gate is demonstrated, not assumed).
	completeStep: async ({ request }) => {
		const f = await request.formData();
		const outputArtifactId = str(f, 'outputArtifactId');
		const executionProvenance =
			str(f, 'aiProduced') === 'true'
				? {
						originType: 'MODEL_GENERATION',
						executedBy: { actorId: 'agent-x', actorType: 'AGENT', displayName: 'Authoring Agent' }
					}
				: { executedBy: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' } };
		return dispatchResult('CompleteExecutionStep', str(f, 'planId'), {
			executionStepId: str(f, 'stepId'),
			executionAttemptId: mintUiId('attempt'),
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: outputArtifactId ? [outputArtifactId] : [],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: {},
			executionProvenance
		});
	},

	// Earn assuranceState=SATISFIED with a REAL assessment. The controller may NOT declare a disposition: RPH-PWU-006
	// / §37 require the SATISFIED hop to cite a SATISFIED ASSURANCE_ASSESSMENT covering the PWU. So we request +
	// complete an assessment under a lightweight NONE-independence demo policy (created + activated once), then cite
	// it. The PWU is NOT yet green: workLifecycle stays UNDER_ASSURANCE until Mark Satisfied — exec != assurance
	// (INV-5). This mirrors the reference seed's earnAssurance, minus the evidence/claim/independence apparatus.
	recordAssurance: async ({ request }) => {
		const engine = getEngine();
		const pwuId = await pwuIdFrom(request);
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		const assessmentId = mintUiId('asm');
		const evaluator = { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' };
		// Create + activate the demo policy only once; CreateAssurancePolicy on an existing object CONFLICTS.
		const policySteps: Step[] = getObject(engine, DEMO_POLICY_ID)
			? []
			: [
					[
						'CreateAssurancePolicy',
						'ASSURANCE_POLICY',
						DEMO_POLICY_ID,
						{
							policyId: DEMO_POLICY_ID,
							version: '1.0.0',
							name: 'Workbench Demo Sign-off',
							purpose: 'Operator sign-off that the demo PWU produced its expected output.',
							rationale:
								'The interactive demo drives the assurance axis; this assessment backs a SATISFIED disposition. Independence NONE — the operator is the reviewer.',
							applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
							evaluatedClaimTypes: ['FITNESS'],
							criteria: [
								{
									id: 'DEMO-01',
									name: 'Expected output present',
									description: 'The PWU has produced its declared expected output.',
									criterionType: 'QUALITATIVE',
									evaluationMethod: 'HUMAN_JUDGMENT',
									requiredEvidenceIds: [],
									severityIfNotMet: 'MATERIAL',
									mayBeNotApplicable: false
								}
							],
							evaluatorRole: 'REVIEWER',
							independenceRequirement: 'NONE',
							findingDefinitions: [
								{
									code: 'DEMO_UNFIT',
									name: 'Output not fit for the approved need',
									description: 'The declared expected output is absent or does not serve the need.',
									defaultSeverity: 'MATERIAL',
									affectedClaimTypes: ['FITNESS'],
									defaultControlActions: ['GATHER_CONTEXT']
								}
							],
							permittedControlActions: ['CONTINUE', 'GATHER_CONTEXT']
						}
					],
					['ActivateAssurancePolicy', 'ASSURANCE_POLICY', DEMO_POLICY_ID, { policyId: DEMO_POLICY_ID }]
				];
		const err = runSteps([
			...policySteps,
			[
				'RequestAssuranceAssessment',
				'ASSURANCE_ASSESSMENT',
				assessmentId,
				{
					assessmentId,
					assurancePolicyId: DEMO_POLICY_ID,
					policyVersion: '1.0.0',
					subjectObjectIds: [pwuId],
					subjectSemanticVersions: { [pwuId]: 1 },
					claimIds: []
				}
			],
			[
				'CompleteAssuranceAssessment',
				'ASSURANCE_ASSESSMENT',
				assessmentId,
				{
					validatorResult: {
						validatorId: 'workbench.demo-signoff',
						validatorVersion: '1',
						policyId: DEMO_POLICY_ID,
						policyVersion: '1.0.0',
						assessmentId,
						subjectObjectIds: [pwuId],
						subjectSemanticVersions: { [pwuId]: 1 },
						claimResults: [],
						evidenceConsideredIds: [],
						evidenceRejected: [],
						observations: [],
						dispositionRecommendation: 'SATISFIED',
						recommendedControlActions: [],
						residualUncertainty: [],
						limitations: [],
						executionProvenance: { evaluator }
					},
					producer: evaluator
				}
			],
			chg(pwuId, 'EXECUTING', 'EVIDENCE_PENDING', 'SUCCEEDED', 'EVIDENCE_REQUIRED', 'PRESERVED'),
			chg(
				pwuId,
				'EVIDENCE_PENDING',
				'UNDER_ASSURANCE',
				'SUCCEEDED',
				'READY_FOR_ASSESSMENT',
				'PRESERVED'
			),
			chg(pwuId, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SUCCEEDED', 'ASSESSING', 'PRESERVED', [
				assessmentId
			]),
			// The only guarded hop: assuranceState=SATISFIED must cite the SATISFIED assessment covering this PWU.
			chg(pwuId, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SUCCEEDED', 'SATISFIED', 'PRESERVED', [
				assessmentId
			])
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
