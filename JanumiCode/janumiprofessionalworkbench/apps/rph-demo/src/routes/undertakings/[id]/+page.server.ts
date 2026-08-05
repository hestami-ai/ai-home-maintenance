// Undertaking Workbench — operates one Undertaking's Professional Work Graph. It shows the LIVE graph (scoped to
// this Undertaking's PWUs), a lifecycle rollup, and the assurance / decision / baseline working sets — all read
// from the live engine. The PWA-version binding is always visible (RPH-DOC-010 §25 header).
import { error, fail } from '@sveltejs/kit';
import { parseRiskProfile } from '$lib/authoring/riskProfile';
import {
	getObject,
	listAssessments,
	listBaselines,
	listByType,
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
	uncertaintyDisclosures,
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
	traceabilityProjector,
	transitionRows
} from '@janumipwb/rph-projections';
// JAN-RETRYCAP (N-12): the kernel's own attempt counter, so this loader supplies the number the ENGINE would
// compute rather than one that merely agrees with it today.
import { attemptsMadeFrom, capabilityIdentities } from '@janumipwb/rph-domain';
import {
	buildPwaExport,
	dispatch,
	dispatchBatch,
	getEngine,
	getRegisteredIntent,
	mintUiId
} from '$lib/server/workbench';
import type { Actions, PageServerLoad } from './$types';

type PwuRecord = ReturnType<typeof listPwus>[number];
type ShapedPlans = ReturnType<typeof plansForPwus>;
type EngineEvents = ReturnType<ReturnType<typeof getEngine>['readAllEvents']>;

/** Lifecycle rollup: count PWUs by their workLifecycleState (defaulting to PROPOSED). */
function buildLifecycleRollup(pwus: ReturnType<typeof listPwus>): Record<string, number> {
	const rollup: Record<string, number> = {};
	for (const p of pwus) {
		const s = String((p.state.workLifecycleState ?? 'PROPOSED') as string);
		rollup[s] = (rollup[s] ?? 0) + 1;
	}
	return rollup;
}

/** One pwuList row: resolve the Instance -> Type name/PWA (§14 / §28). */
function mapPwuRow(engine: ReturnType<typeof getEngine>, p: PwuRecord) {
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
}

/** §38 "applicable policies" per PWU — the required-but-unassessed join, kept only where non-empty. */
function buildApplicablePoliciesView(
	engine: ReturnType<typeof getEngine>,
	pwus: ReturnType<typeof listPwus>,
	view: ReturnType<typeof buildAssuranceView>
) {
	return pwus
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
}

/**
 * Shape one EXECUTION_PLAN aggregate into the pure-view ExecutionPlanInput (steps + transition graph).
 *
 * `events` is threaded for the FOURTH authority limb (JAN-RETRYCAP / N-12): RPH-EXE-008's cap is decided by a
 * COUNT of `ExecutionStepStarted`, not by anything on the aggregate, so the plan's own state cannot answer it and
 * the projection had no way to know a step was exhausted.
 *
 * `attemptsMadeFrom` is called PER STEP rather than folded into a map here, deliberately: the counting rule
 * (Started counts, Retried does not, a wait/resume continues the same attempt) is the engine's, and a map built
 * locally would be a second copy of it — which is exactly the defect this work package removed one layer down.
 * The scan is O(steps x events); at demo scale that is cheaper than a divergence.
 */
function shapeExecutionPlanInput(
	pl: ReturnType<typeof listExecutionPlans>[number],
	events: EngineEvents,
	objectExists: (id: string) => boolean
): ExecutionPlanInput {
	const asRec = (v: unknown): Record<string, unknown> =>
		v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
	return {
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
				...(s.runtimeBindingId ? { runtimeBindingId: String(s.runtimeBindingId as string) } : {}),
				// DWP-09: a resolved BRANCH's recorded decision. Without it the UI would re-derive first-match and could
				// show a different arm than the engine already committed to.
				...(s.selectedTransitionId
					? { selectedTransitionId: String(s.selectedTransitionId as string) }
					: {}),
				// N-12: the count the retry cap is decided against, from the SAME kernel function the engine uses.
				attemptsMade: attemptsMadeFrom(events, pl.id, String((s.id ?? '') as string)),
				// N-21: RPH-EXE-005's fact — which REQUIRED input artifacts do not resolve. Resolved HERE because only
				// this layer has a store; the RULE is the engine's and is applied identically (`required` defaults
				// TRUE, an absent artifactId is out of scope, presence is a store read).
				unresolvedRequiredInputs: (Array.isArray(s.inputBindings) ? s.inputBindings : [])
					.map((b) => asRec(b))
					.filter((b) => (typeof b.required === 'boolean' ? b.required : true))
					.map((b) => (typeof b.artifactId === 'string' ? b.artifactId : ''))
					.filter((id) => id !== '' && !objectExists(id))
			};
		}),
		// N-12: the RetryPolicy bag verbatim — `retryCapFrom` in the kernel applies the cap convention, so this
		// loader never decides what "no valid maxAttempts" means.
		...(pl.state.retryPolicy === undefined ? {} : { retryPolicy: pl.state.retryPolicy }),
		// DR-004 DWP-01 — the transition graph (empty ⇒ linear). Fed to the flow gate + a future graph view.
		transitions: (Array.isArray(pl.state.transitions) ? pl.state.transitions : []).map((raw) => {
			const t = asRec(raw);
			return {
				...(t.id ? { id: String(t.id as string) } : {}),
				...(t.sourceStepId ? { sourceStepId: String(t.sourceStepId as string) } : {}),
				...(t.targetStepId ? { targetStepId: String(t.targetStepId as string) } : {}),
				...(t.transitionType ? { transitionType: String(t.transitionType as string) } : {}),
				...(t.conditionExpression !== undefined
					? { conditionExpression: t.conditionExpression }
					: {})
			};
		})
	};
}

/** Per-plan flow read-models (startable frontier, prunable arms, transition rows) via one evaluator per plan. */
function buildExecutionReadModels(plans: ShapedPlans, engineEvents: EngineEvents) {
	const startableStepByPlan: Record<string, string[]> = {};
	const prunableStepByPlan: Record<string, string[]> = {};
	const transitionRowsByPlan: Record<string, ReturnType<typeof transitionRows>> = {};
	for (const pl of plans) {
		const evalGuard = conditionEvaluatorFor(pl, engineEvents);
		const sids = startableStepIds(pl, evalGuard);
		if (sids.length) startableStepByPlan[pl.id] = sids;
		const prunable = prunableStepIds(pl, evalGuard);
		if (prunable.length) prunableStepByPlan[pl.id] = prunable;
		const rows = transitionRows(pl, evalGuard);
		if (rows.length) transitionRowsByPlan[pl.id] = rows;
	}
	return { startableStepByPlan, prunableStepByPlan, transitionRowsByPlan };
}

/** Fold the Execution* event stream into §10.4 attempt records, scoped to these plans and keyed by step. */
function buildAttemptsByStepId(
	plans: ShapedPlans,
	events: EngineEvents
): Record<string, ExecutionAttemptView[]> {
	const stepTypeById: Record<string, string> = {};
	for (const pl of plans) for (const s of pl.steps) stepTypeById[s.id] = s.stepType;
	const scopedPlanIds = new Set(plans.map((pl) => pl.id));
	const attemptsByStepId: Record<string, ExecutionAttemptView[]> = {};
	for (const a of executionAttempts(events, stepTypeById)) {
		if (scopedPlanIds.has(a.executionPlanId)) {
			attemptsByStepId[a.stepId] ??= [];
			attemptsByStepId[a.stepId].push(a);
		}
	}
	return attemptsByStepId;
}

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
	const rollup = buildLifecycleRollup(pwus);
	// Instance -> Type navigation (§14 / §28): each PWU Instance links to its PWU Type definition (in its PWA).
	const pwuList = pwus.map((p) => mapPwuRow(engine, p));

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

	// ── THE F-6 LEAK, CLOSED (SPEC-001 INV-02 / FORK-9, 2026-07-28) ─────────────────────────────────────────
	//
	// These four reads were engine-GLOBAL, so a brand-new Undertaking rendered the SEEDED Undertaking's 65
	// assessments, 2 decisions and 2 baselines. The execution plane below was fixed for exactly this bug (see
	// "the F-6 fix" comment) and its four siblings here were left — which is what made the leak survive: on the
	// seeded Undertaking it is invisible, because that Undertaking owns every object in the workspace.
	//
	// The scope is now REQUIRED by the signature rather than remembered at the call site; `queries.ts`'s
	// `QueryScope` records why that difference is the whole repair.
	const undertakingScope = { kind: 'UNDERTAKING', undertakingId: params.id } as const;
	const view = buildAssuranceView(engine.readAllEvents());
	// DR-002 W-5 — the uncertainty disclosure, derived from the EVENT LOG and deliberately not from the assessment
	// object. `AssuranceAssessment.residualUncertainty` exists and is always `[]`: the assurance handler records
	// that "the object's [] is SILENCE, not a finding of 'none'", and reconciling it is the §32 increment. Reading
	// the object here would render silence as a professional's finding of none — O-8-R7, committed by the very
	// component built to satisfy it. Measured on the reference seed: 0 statements on objects, 1 across 32
	// completion events.
	const disclosures = uncertaintyDisclosures(
		engine.readAllEvents(),
		pwus.map((p) => p.id)
	);
	const assessments = listAssessments(engine, undertakingScope).map((a) => {
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
	const applicablePolicies = buildApplicablePoliciesView(engine, pwus, view);
	const observations = listObservations(engine, undertakingScope).map((o) => ({
		id: o.id,
		severity: String((o.state.severity ?? '') as string),
		statement: String((o.state.statement ?? '') as string),
		disposition: String((o.state.disposition ?? '') as string)
	}));
	const decisions = listDecisions(engine, undertakingScope).map((dc) => ({
		id: dc.id,
		type: String((dc.state.decisionType ?? '') as string),
		status: String((dc.state.status ?? '') as string),
		rationale: String((dc.state.rationale ?? '') as string)
	}));
	const baselines = listBaselines(engine, undertakingScope).map((b) => ({
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
	const planShapingEvents = engine.readAllEvents();
	// N-21: the artifact-presence resolver. Passed as a predicate rather than handing the shaper the engine, so the
	// only store access it has is the one RPH-EXE-005 needs.
	const objectExists = (id: string) => getObject(engine, id) !== undefined;
	const planRows: ExecutionPlanInput[] = listExecutionPlans(engine).map((pl) =>
		shapeExecutionPlanInput(pl, planShapingEvents, objectExists)
	);
	// JAN-EXECREM WP-15: supply each PWU's workLifecycleState so the affordance projection can apply RPH-PWU-010
	// too. WP-12b gave the engine a second authority limb — a closed PWU opens no new execution — and a plan on a
	// closed PWU keeps status ACTIVE, so without this the UI would offer Start on a plan the engine now refuses:
	// F-29's own invariant re-broken in a new place by its remedy.
	const pwuLifecycleById = Object.fromEntries(pwuList.map((p) => [p.id, p.workLifecycleState]));
	// JAN-REVREM RW-6 / MAJOR #5: supply what each RUNTIME_BINDING says, so the affordance projection can apply the
	// THIRD authority limb (RPH-EXE-003) too. RW-0 gave the engine a `bindingAuthority` column and this read-model
	// consulted only two columns, so the UI offered Start on a step whose binding is REQUESTED, DENIED, REVOKED — or
	// authorized for a DIFFERENT step — and the engine refused the click. Third time this exact mechanism has bitten,
	// after RPH-PWU-010 above and Prune in RW-0.
	//
	// `listByType` rather than a per-step `getObject`: `resolves` must mean "this id IS a RUNTIME_BINDING", and
	// `getObject` returns a state bag for ANY object type, so it cannot answer that question. Enumerating the type is
	// what makes the negative fact derivable instead of assumed. A step naming an id absent from this map therefore
	// gets NO entry, which is UNGATED — the engine still refuses, so the cost is a rejected click.
	const bindingFactsById = Object.fromEntries(
		listByType(engine, 'RUNTIME_BINDING').map((b) => [
			b.id,
			{
				resolves: true,
				boundStepId: String((b.state.executionStepId ?? '') as string),
				authorizationStatus: String((b.state.authorizationStatus ?? '') as string),
				// N-18 (ruling, option C): what the binding CONFERS, via the kernel's own projection — so the UI and
				// the engine agree on what counts as a capability, and the UI stops offering Start on a binding that
				// was reviewed and granted nothing.
				grantedCapabilities: capabilityIdentities(b.state.grantedCapabilities)
			}
		])
	);
	const plans = plansForPwus(planRows, pwuIdSet, pwuLifecycleById, bindingFactsById);

	// JAN-EXECPLAN-DR-004 DWP-01 — the transition-graph flow gate affordance (set-frontier). For each plan, derive the
	// SET of steps the engine would currently let start (the graph in-edge barrier; a linear plan yields a singleton).
	// The UI offers Start ONLY on a step in this set (the engine's startExecutionStep gate is the backstop — the UI does
	// not tempt a start it would reject). A plan with no startable step maps to an empty/absent list.
	// The CONDITIONAL-edge guard evaluator (DWP-02/03) is folded per plan from its committed state + the event log, so
	// the read-model's BRANCH first-match matches the engine authority exactly (§19-M2). prunableStepByPlan surfaces a
	// resolved BRANCH's not-taken arm (+ transitive downstream) for a Prune action (DWP-03/06).
	// DWP-06 adds transitionRowsByPlan — the READ-ONLY edge plane the tab renders (source→target, role, guard summary,
	// and the interpreter's own in-edge disposition). It drives NO affordance (F-11); it explains the ones already
	// derived above. All three read-models share the ONE evaluator closure per plan so the condition subject is folded
	// once, not three times over the whole event log.
	const engineEvents = engine.readAllEvents();
	const { startableStepByPlan, prunableStepByPlan, transitionRowsByPlan } =
		buildExecutionReadModels(plans, engineEvents);

	// Execution Attempt history (JAN-EXECPLAN Tier-3 DWP-03/05): fold the Execution* event stream into §10.4 attempt
	// records, scoped to THIS undertaking's plans, keyed by step for the per-step history render. stepTypeById (from
	// the shaped plans — the events don't carry stepType) drives the AI-no-binding coherence advisory.
	const attemptsByStepId = buildAttemptsByStepId(plans, engine.readAllEvents());

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
		transitionRowsByPlan,
		attemptsByStepId,
		sequence,
		assessments,
		disclosures,
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

/**
 * Run a command sequence ATOMICALLY, returning the rejection that stopped it (naming the command that failed;
 * DUPLICATE is fine) or null on success. Prefixing the command type turns an opaque "Schema validation failed"
 * into a locatable one.
 *
 * ATOMIC SINCE 2026-07-28, AND IT WAS A REAL DEFECT UNTIL THEN (JPWB-SPEC-001 `SPEC-001-INV-14`, FORK-23 (b)).
 * This function used to loop `dispatch` one command at a time and `return` on the first refusal — so every command
 * BEFORE the refused one stayed committed. The seeded reference Undertaking makes that visible in one click:
 * its root PWU sits at EXECUTING/QUEUED, the overview row offers Record Assurance because it branches on
 * `workLifecycleState` alone, and the sequence ends in a `QUEUED -> SUCCEEDED` hop that is not an arrow
 * (`transitions.data.ts:505-509`). The engine refused, correctly — and two ASSURANCE_ASSESSMENT objects were
 * already on disk, appearing thereafter in the Assurance tab as orphans. Every click minted two more.
 *
 * WHAT MAKES THE FIX SMALL IS THAT NOTHING NEW WAS NEEDED. `dispatchBatch` wraps the identical loop — same
 * ACCEPTED/DUPLICATE accept criteria — in `store.transaction()` and unwinds every commit on the first refusal
 * (`command-bus.ts:169-188`). This same application already dispatched atomically in two other places: the PWA
 * Designer (`pwa/[id]/+page.server.ts:632`) and the authoring turn (`authoring-turn.ts:452`). Only this surface
 * did not, and the specification that ruled it (FORK-8/FORK-23) was itself drafted on the false premise that the
 * engine had no multi-command envelope — a claim struck at SPEC-001 §11.1.8.
 *
 * The error CONTRACT is unchanged: callers still receive `"<CommandType>: <message>"` or null, so no call site
 * moves. `failedIndex` names the offending command; it is always present on a failed batch, and the fallbacks
 * exist so a future batch that fails without one degrades to a locatable message rather than to `undefined`.
 *
 * RED-PROOF: `e2e/undertaking-atomicity.e2e.ts`. Against the pre-fix implementation its first spec fails on the
 * assessment-count assertion — NOT on the refusal assertion, which passed throughout. A test that only checked
 * the error was surfaced would have been green against this defect for as long as it existed.
 */
function runSteps(steps: Step[]): string | null {
	const batch = dispatchBatch(
		steps.map(([commandType, targetAggregateType, targetAggregateId, payload]) => ({
			commandType,
			targetAggregateType,
			targetAggregateId,
			payload
		}))
	);
	if (batch.ok) return null;
	const at = batch.failedIndex ?? batch.results.length - 1;
	const commandType = steps[at]?.[0] ?? '(unknown command)';
	const failed = batch.results[at];
	return `${commandType}: ${failed?.error?.message ?? failed?.status ?? 'REJECTED'}`;
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
		const risk = parseRiskProfile((field) => form.get(field) as string | null);
		if (!risk.ok) return fail(400, { error: risk.error });
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
			// DR-002 W-4 — the professional's declared judgement. This line held the five constants that made
			// finding F-D: MEDIUM/MEDIUM/MEDIUM/MEDIUM/LOW, written into canonical state where nothing downstream
			// could tell them from a judgement, and failing every disjunct of HIGH_ASSURANCE's risk gate.
			riskProfile: risk.profile
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
			//
			// JAN-EXECREM WP-11: the no-output result is now ASSERTED rather than inferred from the empty id arrays.
			// The engine used to infer it, which made RPH-EXE-006 a tautology; this demo path silently depended on
			// that. Saying it out loud is the honest demo — a step that produced nothing must say so, and say why.
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
					noOutputResult: {
						reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT',
						detail:
							'Demo lifecycle step: it demonstrates the execution axis and authors no artifact.'
					},
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
	// DR-004 DWP-04 — the WAIT pair. Enter-wait SUSPENDS a RUNNING step (permitted even post-supersession, like cancel);
	// resolve RESUMES it (needs an ACTIVE plan, like start/retry) and emits the MINTED ExecutionStepWaitResolved so the
	// resume is replayable. A resume is NOT a new attempt, so the retry cap is untouched.
	enterWaitStep: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('EnterExecutionStepWait', str(f, 'planId'), {
			stepId: str(f, 'stepId'),
			waitReason: str(f, 'reason') || 'Operator suspended the step pending an external condition.'
		});
	},
	resolveWaitStep: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('ResolveExecutionStepWait', str(f, 'planId'), {
			stepId: str(f, 'stepId'),
			resolution: str(f, 'reason') || 'Operator resolved the wait.'
		});
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
			// WP-11 / RPH-EXE-006: the no-output case must now be ASSERTED, and asserting it alongside a named output
			// is itself a refusal (the two cannot both be true), so this is conditional on there being no output.
			// The AI path stays ACCEPTED here only because `structuredResult` is genuinely empty — an AI step that
			// shipped inline content while naming nothing would be refused by the zero-subject floor.
			...(outputArtifactId
				? {}
				: {
						noOutputResult: {
							reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT',
							detail: 'Operator completed the step without naming a produced output.'
						}
					}),
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
					[
						'ActivateAssurancePolicy',
						'ASSURANCE_POLICY',
						DEMO_POLICY_ID,
						{ policyId: DEMO_POLICY_ID }
					]
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
			// THE READY -> ASSESSING ARROW (REG-F-021 increment 3). requestAssuranceAssessment now crosses
			// REQUESTED -> EVIDENCE_PENDING and lands in READY (this policy declares no required evidence, so
			// "all required evidence present" is vacuously true). Begin it before completing it.
			['BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {}],
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
