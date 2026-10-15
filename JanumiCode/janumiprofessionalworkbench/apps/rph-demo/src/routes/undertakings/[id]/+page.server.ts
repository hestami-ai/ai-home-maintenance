// Undertaking Workbench — operates one Undertaking's Professional Work Graph. It shows the LIVE graph (scoped to
// this Undertaking's PWUs), a lifecycle rollup, and the assurance / decision / baseline working sets — all read
// from the live engine. The PWA-version binding is always visible (RPH-DOC-010 §25 header).
import { error, fail } from '@sveltejs/kit';
import { parseRiskProfile } from '$lib/authoring/riskProfile';
import {
	getObject,
	getObjectOfType,
	listAssessments,
	listBaselines,
	listByType,
	listDecisions,
	driveAssessmentToAssessing,
	listExecutionPlans,
	listObservations,
	listPwus,
	listPwuTypes,
	professionalWorkGraph,
	REFERENCE_OPEN_RESIDUALS,
	SEED_UNDERTAKING,
	selectGoverningPolicies
} from '@janumipwb/rph-engine';
import {
	aggregateDispositionFor,
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
import {
	attemptsMadeFrom,
	capabilityIdentities,
	lastFailureClassFrom
} from '@janumipwb/rph-domain';
import {
	buildPwaExport,
	dispatch,
	dispatchBatch,
	getArtifactStore,
	getEngine,
	dispatchMultiPartyBatch,
	getRegisteredIntent,
	hostNow,
	isTestMode,
	mintUiId,
	uiSession
} from '$lib/server/workbench';
import {
	declaredRerunOffer,
	evidenceRefusals,
	foldAfterRerun,
	governingDeclaredPolicies,
	NEVER_ASSESSED,
	planDeclaredSignoff,
	RERUN_DECLARED_REVIEWS,
	unsatisfyingReviews,
	type DeclaredSignoff,
	type GoverningDeclaredPolicy
} from '$lib/server/assurance/declared-policy-signoff';
// ⭐ `JAN-EXEC` Phase 7 completion E2 — the declared policies' reviews: the seam, its input, and the capture of its calls.
import { createDeclaredPolicyReviewer } from '$lib/server/assurance/index';
import type { DeclaredPolicyAnswer } from '$lib/server/assurance/declared-policy-review';
import {
	declaredPolicyReviewInput,
	type DeclaredReviewCommand
} from '$lib/server/assurance/review-input';
import { createExchangeSink } from '$lib/server/assurance/exchange-capture';
import { recordExchanges } from '$lib/server/assurance/exchange-recorder';
import { anyStipulationRegistered, stipulationFor, workUnitPwaOf } from '$lib/server/stipulations';
import type {
	AssuranceSubject,
	DeclaredInstruction,
	Identity,
	ProfessionalRationaleSummary
} from '@janumipwb/rph-assurance';
import { assurancePreflight } from '$lib/server/assurance/preflight';
import { ASSURANCE_REVIEWER_CREDENTIAL, actingActor } from '$lib/server/identity';
import { runModelInvocationStep } from '$lib/server/execution/run-model-step';
import { runWorkProductFloor } from '$lib/server/execution/work-product-floor';
import { escalatedReviewNote } from '$lib/server/execution/floor-over-subject';
import {
	describeRefusedEvidence,
	joinProcessEvidence,
	noFindingNote
} from '$lib/server/execution/evidence-join';
import { governedToolCallReport } from '$lib/server/tools/observed-tool-calls';
import {
	classifyTrend,
	mayRetry,
	reviewSeesPriorFindings
} from '$lib/server/execution/loop-detection';
import { reasoningReviewCriteria, tallyCriteria } from '$lib/server/floor';
import { getExecutionSession } from '$lib/server/execution/model';
import {
	executorRecordIdentity,
	executorRefusalMessage,
	selectExecutor,
	type RunnableExecutorSelection
} from '$lib/server/execution/executor-selection';
import { resolveContextPolicy } from '$lib/server/execution/context-policy';
import { stepBindingFor } from '$lib/server/execution/step-binding';
import { resolveUndertakingSandbox } from '$lib/server/execution/workspace-host';
// ⭐ `JAN-EXEC` P7-6R R-1 — the stopped unit, read from the record: its wait, the person's three choices, and RD7's rebuild.
import {
	attemptKeyOf,
	RATIONALE_REQUIRED,
	rebuildProcessRun,
	rebuildProducingTurn,
	recoveryViewOf,
	RERUN_REVIEW,
	RERUN_WORK,
	rerunReviewRefusal,
	rerunWorkAfterOf,
	rerunWorkRefusal,
	stepActOnAwaitedChoice,
	stopAtRefusal,
	stoppedUnitOf,
	waitingStepOf,
	waitReasonFor,
	type RebuiltProducingTurn,
	type RecoveryView,
	type StoppedUnit
} from '$lib/server/execution/stopped-unit-recovery';
// ⭐ `P76F-A` A3 (RD4) — what authorises each of the person's choices, cited after their own words in its Decision.
import {
	ABANDON_FROM_WAITING_CITATION,
	decisionRationale,
	RERUN_REVIEW_CITATION,
	rerunWorkCitation,
	RERUN_DECLARED_REVIEWS_CITATION,
	DECLARED_RERUN_RATIONALE_REQUIRED
} from '$lib/server/execution/recovery-authority';
import { runProcessResultFloor } from '$lib/server/execution/process-result-floor';
import type { ObservedProcessRun } from '$lib/server/tools/process-run-observer';
// ⭐ `JAN-NOANS`: the `resolveJudgeModel` import is GONE from this route, and its absence is the check. It was
// the last live reference to the REVIEWER's model on the EXECUTION path — `REG-F-356`'s defect, whose final
// residue survived in the host-configured fallback identity below. Lint is what reports a relapse.
// ⭐ `JAN-SELRES` RS-1 (D4): and `resolveExecutorModel`/`resolveExecutorToolId` are gone too — the fallback identity
// comes from the executor SELECTION, the one read that also opened the executor.
import { resolveInvocationSubject, resolvePwuTypeFacts } from '@janumipwb/rph-application';
// ⭐ `PromptTemplate` IS NO LONGER IMPORTED HERE, and its absence is the check. Its only use in this route was
// the assertion `pwuType?.promptTemplate as PromptTemplate | undefined`; `resolvePwuTypeFacts` PARSES that
// object now, so the route has no reason to name the type at all. Lint reports a relapse.
import type { ActorReference, ContextSpecification } from '@janumipwb/rph-contracts';

/** ⚠ ONE TENANT, DECLARED RATHER THAN INLINE. §31.2 requires an opaque tenant-scoped key prefix, and this demo
 *  is single-tenant; naming the constant keeps the day it becomes multi-tenant a one-line change instead of a
 *  search for string literals. */
const EXECUTION_TENANT_PREFIX = 'tnt-local';
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
			// THE SAME DETERMINATION THE ENGINE ENFORCES (REG-F-029 review finding (a)). `buildApplicablePolicies`
			// is pure over id arrays and cannot run §5.1 itself, so without this the view reported every DECLARED
			// policy as governing — and said so about pairs the engine refuses, e.g. the root PWU's
			// `pol_baseline_promotion`. Supplying the outcome does not hide those rows (§8.4: inapplicable coverage
			// is EXPLAINABLE, never silent); it labels them.
			const determination = selectGoverningPolicies(engine, p.id);
			const outcomeByPolicy: Record<string, string> = {};
			for (const id of determination.selected) outcomeByPolicy[id] = 'REQUIRED';
			for (const e of determination.excluded) outcomeByPolicy[e.policyId] = e.reason;
			const rows = buildApplicablePolicies({
				pwuId: p.id,
				directPolicyIds: asStrings(p.state.assurancePolicyIds),
				typeRequiredPolicyIds: asStrings(type?.requiredAssurancePolicyIds),
				view,
				outcomeByPolicy
			});
			return {
				pwuId: p.id,
				pwuTitle: String((p.state.title ?? p.id) as string),
				rows,
				// DOC-004 §28.2, folded by the kernel (REG-E-024(b)). The table above lists N verdicts; §28.1 says
				// the aggregate "must preserve the strictest unresolved disposition" and "must not be reduced to a
				// numerical average" — rules about a value the reader was previously left to compute by eye.
				aggregate: aggregateDispositionFor(rows)
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
				// REG-E-025: the §36 fact, from the SAME kernel fold the engine's retry refusal uses. Without it
				// the tab offers `retry` on a step whose last failure class forbids it and the engine rejects the
				// click — F-29's invariant, sixth instance.
				...(() => {
					const c = lastFailureClassFrom(events, pl.id, String((s.id ?? '') as string));
					return c === undefined ? {} : { lastFailureClass: c };
				})(),
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
	// TYPED, not merely existent: `params.id` arrives from the URL, and a type-blind read rendered a
	// PWA's own name as this Undertaking's without throwing (REG-F-199 residue 1). One throw still
	// covers both cases — the seam returns undefined for wrong-type AND for absent.
	const u = getObjectOfType(engine, 'UNDERTAKING', params.id);
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
			// ⭐ §4.4 — what the verdict rests on: criteria a reviewer evaluated, and criteria a TEST stipulated.
			criteria: tallyCriteria(Object.values(v?.criterionResults ?? {})),
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
		disposition: String((o.state.disposition ?? '') as string),
		// WHAT THE FINDING IS ABOUT (S-1b / B-3). Dropped until now, so the surface could list findings and could
		// not say which work they faulted — and the reject affordance must be offered ONLY where a blocking
		// finding actually stands. This is the same field `hasBlockingObservationFor` reads in the engine, so the
		// affordance and the gate now ask the same question of the same data instead of two different ones.
		subjectObjectIds: Array.isArray(o.state.subjectObjectIds)
			? (o.state.subjectObjectIds as unknown[]).map(String)
			: []
	}));
	// ── THE EVIDENCE WORKING SET (JAN-SLICE-SWP-06) ─────────────────────────────────────────────────────────
	//
	// ⚠ THE SURFACE COULD ASSURE AND COULD NOT EVIDENCE, AND THAT IS THE GAP F-4 NAMED. `ProposeEvidence`,
	// `AdmitEvidence` and `SubmitEvidenceForAssessment` appeared ZERO times anywhere under `apps/rph-demo`
	// (positive control at the time of writing: `CreatePwa` 5 files, `PromoteBaseline` 2, `AbandonPwu` 2), so a
	// human could sign work off through this workbench having produced no evidence at all — while the ENGINE
	// Slice `E2E-001` asserts on the other plane that an assessment must name "BOTH what it assessed AND the
	// evidence it considered".
	//
	// `status` is the ratified `Evidence.status` (PROPOSED -> ADMISSIBLE), so the surface can offer admission
	// exactly where it is legal and nowhere else — the affordance and the engine's own precondition
	// (`fromStates('PROPOSED')`) ask the same question of the same field.
	// ⚠⚠ THIS LIST IS WORKSPACE-WIDE, WHICH IS A DEPARTURE FROM THIS PAGE'S SCOPING DISCIPLINE, AND IT IS STATED
	// RATHER THAN QUIETLY SHIPPED. `listAssessments` / `listObservations` / `listDecisions` / `listBaselines` all
	// take a REQUIRED `QueryScope` because they are subject-bindable. EVIDENCE IS NOT ONE OF THEM: an Evidence
	// object names no subject — it carries `supportsClaimIds`, and a claim names the subject — so binding it to an
	// Undertaking is a TWO-HOP resolve, and evidence supporting no claim yet has no hop at all. The engine
	// therefore ships no `listEvidence(h, scope)`, and inventing one here would put a second, weaker answer beside
	// the four that already exist.
	//
	// The visible consequence is disclosed in the panel's own heading rather than hidden: an operator sees every
	// Evidence object in the workspace, including the reference drive's sixteen. What is NOT workspace-wide is the
	// ACT — `evidenceSubjectPwuId` above is scoped, and the admit/submit affordances render only when this
	// Undertaking has an assessment open to evidence.
	const evidence = listByType(engine, 'EVIDENCE').map((e) => ({
		id: e.id,
		status: String((e.state.status ?? '') as string),
		evidenceType: String((e.state.evidenceType ?? '') as string),
		scope: String((e.state.scope ?? '') as string),
		supportsClaimIds: Array.isArray(e.state.supportsClaimIds)
			? (e.state.supportsClaimIds as unknown[]).map(String)
			: []
	}));
	// The PWU whose assessment is currently open to evidence, if one is — the subject the admit/submit
	// affordances act on.
	//
	// ⚠ DERIVED FROM THE ENGINE'S OWN OPEN SET, AND ITS REMAINING LIMITATION IS DISCLOSED RATHER THAN HIDDEN.
	// Evidence in RPH attaches to CLAIMS, not to PWUs (`ProposeEvidence` carries `supportsClaimIds` and names no
	// subject), and the evidence THIS SURFACE mints supports no claim — `recordAssurance` drives with
	// `claimIds: []` — so a freshly proposed object cannot say which work it is about.
	//
	// ⚠ AN EARLIER VERSION OF THIS COMMENT SAID "this demo asserts no claims". THAT WAS FALSE: the reference
	// drive asserts nine, and every one of the sixteen seeded Evidence objects carries a non-empty
	// `supportsClaimIds`. The true statement is narrower and is the one that matters here — the OPERATOR's own
	// evidence is unclaimed, so within this Undertaking the binding is the open assessment and nothing else.
	// With one open assessment that is exact. With several, this takes the first, and the operator could admit to
	// a different PWU than they meant — bounded to this Undertaking since the read is scoped, and a real
	// limitation of a surface that mints no claims rather than a defect papered over with a plausible guess.
	const evidenceSubjectPwuId = (() => {
		// ⚠ SCOPED, AND AN ADVERSARIAL PASS IS WHY. This read was `listByType(engine, 'ASSURANCE_ASSESSMENT')`
		// — the whole WORKSPACE — so the first open assessment ANYWHERE became the hidden `pwuId` of the admit
		// and submit forms. An operator on Undertaking A could admit evidence to Undertaking B's assessment, and
		// the SATISFIED sign-off on B would then cite evidence about A while A's own assessment recorded
		// considering nothing. The four sibling reads on this page all pass `undertakingScope`; this one did not,
		// which is the exact defect `QueryScope`'s header records being repaired four times.
		for (const a of listAssessments(engine, undertakingScope)) {
			if (
				!['EVIDENCE_PENDING', 'READY', 'ASSESSING'].includes(
					String((a.state.assessmentState ?? '') as string)
				)
			)
				continue;
			const subjects = Array.isArray(a.state.subjectObjectIds)
				? (a.state.subjectObjectIds as unknown[]).map(String)
				: [];
			if (subjects[0]) return subjects[0];
		}
		return '';
	})();
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

	// ⭐ `JAN-EXEC` P7-6R R-1d (RD2, RD3, RD9) — each unit WAITING for a person after a refused review: what refused it, the
	// choices RD3 offers for that refusal, and how many re-runs it has had. Read from the record (`recoveryViewOf`), so the
	// page offers what the server will accept — the server refuses a re-review after a concluded refusal too.
	// ⭑ And the waiting steps, whose own controls the execution tab withholds: Resume and Cancel run nothing, and the
	// person's choice is made on the unit's row (`REG-F-466`).
	const recoveryByPwu: Record<string, RecoveryView> = {};
	for (const p of pwus) {
		const view = recoveryViewOf(uiSession(), p.id);
		if (view) recoveryByPwu[p.id] = view;
	}
	const awaitingChoiceStepIds = Object.values(recoveryByPwu).map((v) => v.stepId);
	// ⭐⭐ `E12F` F3 (`REG-D-112` (a)) — each unit left UNDER ASSURANCE by a declared review that did not conclude: the declared
	// reviews the person may re-run, ONLY those whose latest verdict is INCONCLUSIVE. Read from the record
	// (`declaredRerunOffer`), so the page offers exactly what `rerunDeclaredReviews` accepts.
	const declaredRerunByPwu: Record<string, { readonly policies: readonly string[] }> = {};
	for (const p of pwus) {
		const offer = declaredRerunOffer(engine, p.id);
		if (!('refusedBecause' in offer)) declaredRerunByPwu[p.id] = { policies: offer.policies.map((x) => x.policyId) };
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
		transitionRowsByPlan,
		attemptsByStepId,
		recoveryByPwu,
		awaitingChoiceStepIds,
		declaredRerunByPwu,
		sequence,
		assessments,
		disclosures,
		applicablePolicies,
		observations,
		evidence,
		evidenceSubjectPwuId,
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
// The demo sign-off policy lives in ONE module now (S-1b): a second assurance act needs the same policy, and
// copying a governed object's definition is how four restatements of AssessmentCriterion came to disagree.
import {
	DEMO_EVIDENCE_REQUIREMENT_ID,
	DEMO_FINDING_CODE,
	DEMO_POLICY_ID,
	DEMO_POLICY_PAYLOAD,
	DEMO_POLICY_VERSION
} from '$lib/server/assurance/demo-policy';

/** A ChangePwuState step (the controller lever) that moves the four PWU axes together. `supportingObjectIds` cites
 *  the objects that BACK the transition (DOC-007 §11.5) — the EXECUTION_PLAN whose step succeeded for
 *  executionState=SUCCEEDED, and the SATISFIED ASSURANCE_ASSESSMENT for assuranceState=SATISFIED — which the
 *  RPH-PWU-006 Given guards (pwu.ts) now require. */
/**
 * The steps every assurance act on this surface shares: the demo policy (created once) and the ratified §30 drive
 * to ASSESSING. Extracted for S-1b, because the SECOND assurance act needed exactly the same prelude and copying
 * it would have produced two definitions of one governed lifecycle — the shape that let four restatements of
 * `AssessmentCriterion` disagree with each other and with the ratified contract.
 *
 * Dispatch-agnostic by construction: `driveAssessmentToAssessing`'s `send` COLLECTS into this array rather than
 * dispatching, so the caller's batch keeps its all-or-nothing error handling and the §30 sequence stays written
 * in exactly one place (REG-F-021 increment 4).
 */
function assurancePrelude(pwuId: string, assessmentId: string): Step[] {
	// CreateAssurancePolicy on an existing object CONFLICTS, so the policy is authored once per workbench.
	const steps: Step[] = getObject(getEngine(), DEMO_POLICY_ID)
		? []
		: [
				['CreateAssurancePolicy', 'ASSURANCE_POLICY', DEMO_POLICY_ID, DEMO_POLICY_PAYLOAD],
				[
					'ActivateAssurancePolicy',
					'ASSURANCE_POLICY',
					DEMO_POLICY_ID,
					{ policyId: DEMO_POLICY_ID }
				]
			];
	driveAssessmentToAssessing(
		(commandType, targetAggregateType, targetAggregateId, payload) =>
			steps.push([commandType, targetAggregateType, targetAggregateId, payload]),
		{
			assessmentId,
			assurancePolicyId: DEMO_POLICY_ID,
			policyVersion: DEMO_POLICY_VERSION,
			subjectObjectIds: [pwuId],
			subjectSemanticVersions: { [pwuId]: 1 },
			claimIds: []
		}
	);
	return steps;
}

/** The DOC-007 §20 ValidatorResult for a demo assessment — sixteen fields, one shape, both dispositions. */
function demoValidatorResult(
	assessmentId: string,
	pwuId: string,
	dispositionRecommendation: string,
	evaluator: ActorReference,
	// ⚠ DEFAULTED EMPTY SO EVERY EXISTING CALLER IS UNCHANGED. The adverse arm (`recordBlockingFinding`) passes
	// nothing and its result is byte-identical to before. Only `recordAssurance` supplies a set, and only when
	// the operator actually submitted evidence — so this parameter cannot silently make a sign-off look
	// evidenced (JAN-SLICE-SWP-06).
	evidenceConsideredIds: readonly string[] = []
) {
	return {
		validatorId: 'workbench.demo-signoff',
		validatorVersion: '1',
		policyId: DEMO_POLICY_ID,
		policyVersion: DEMO_POLICY_VERSION,
		assessmentId,
		subjectObjectIds: [pwuId],
		subjectSemanticVersions: { [pwuId]: 1 },
		claimResults: [],
		// ⚠ THIS WAS UNCONDITIONALLY `[]`, AND THAT IS WHAT THE EVIDENCE SURFACE EXISTS TO END. The workbench
		// could reach a SATISFIED disposition whose own §20 ValidatorResult recorded that it had considered
		// nothing — while the ENGINE Slice `E2E-001` asserts on the other plane that an assessment must name
		// "BOTH what it assessed AND the evidence it considered". The two planes disagreed, and only one of them
		// was checked.
		evidenceConsideredIds: [...evidenceConsideredIds],
		evidenceRejected: [],
		observations: [],
		dispositionRecommendation,
		recommendedControlActions: [],
		residualUncertainty: [],
		limitations: [],
		executionProvenance: { evaluator }
	};
}

/**
 * The pending assessment covering this PWU, if the operator has already opened one (JAN-SLICE-SWP-06).
 *
 * ⚠ THE OPEN SET IS THE ENGINE'S, COPIED FROM THE GUARD THAT ENFORCES IT rather than chosen here.
 * `submitEvidenceForAssessment` admits evidence only while the assessment is in
 * `['EVIDENCE_PENDING', 'READY', 'ASSESSING']` and refuses `REQUESTED` explicitly, because at REQUESTED the
 * required set has not been evaluated and `satisfiesRequirementId` could not be checked. Offering the affordance
 * on a wider set than the engine accepts would produce a button whose only outcome is a refusal.
 *
 * With this policy's only requirement carrying `cardinality: 'ZERO_OR_MORE'`, `requestAssuranceAssessment`'s
 * required set is empty and the assessment lands directly in READY — so the window is open from the first act.
 */
function pendingAssessmentFor(pwuId: string): string | null {
	const OPEN_FOR_EVIDENCE = ['EVIDENCE_PENDING', 'READY', 'ASSESSING'];
	for (const a of listByType(getEngine(), 'ASSURANCE_ASSESSMENT')) {
		const subjects = Array.isArray(a.state.subjectObjectIds)
			? (a.state.subjectObjectIds as unknown[]).map(String)
			: [];
		if (!subjects.includes(pwuId)) continue;
		if (OPEN_FOR_EVIDENCE.includes(String((a.state.assessmentState ?? '') as string))) return a.id;
	}
	return null;
}

/**
 * Open an assessment for this PWU WITHOUT beginning it — the policy setup plus `RequestAssuranceAssessment`.
 *
 * ⚠ THIS IS `assurancePrelude` STOPPED ONE ACT EARLIER, AND THE STOP IS THE POINT. That helper drives all the way
 * to ASSESSING through `driveAssessmentToAssessing`, which selects an evaluator and BEGINS. Evidence must be
 * submitted before the verdict is reached, so the evidence journey needs the assessment OPEN and not yet begun.
 */
function openAssessmentFor(pwuId: string, assessmentId: string): Step[] {
	const steps: Step[] = getObject(getEngine(), DEMO_POLICY_ID)
		? []
		: [
				['CreateAssurancePolicy', 'ASSURANCE_POLICY', DEMO_POLICY_ID, DEMO_POLICY_PAYLOAD],
				[
					'ActivateAssurancePolicy',
					'ASSURANCE_POLICY',
					DEMO_POLICY_ID,
					{ policyId: DEMO_POLICY_ID }
				]
			];
	steps.push([
		'RequestAssuranceAssessment',
		'ASSURANCE_ASSESSMENT',
		assessmentId,
		{
			assessmentId,
			assurancePolicyId: DEMO_POLICY_ID,
			policyVersion: DEMO_POLICY_VERSION,
			subjectObjectIds: [pwuId],
			subjectSemanticVersions: { [pwuId]: 1 },
			claimIds: []
		}
	]);
	return steps;
}

/** The evidence ALREADY SUBMITTED to an assessment, folded from its own event log. */
function evidenceSubmittedTo(assessmentId: string): string[] {
	// `EngineHandle` exposes `readAllEvents` and no per-aggregate reader, so the aggregate filter is explicit.
	return getEngine()
		.readAllEvents()
		.filter((e) => e.eventType === 'AssuranceEvidenceReceived' && e.aggregateId === assessmentId)
		.map((e) => String(((e.payload as { evidenceId?: unknown }).evidenceId ?? '') as string))
		.filter((id) => id.length > 0);
}

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
/**
 * ⭐ THE ONE PLACE A REFUSED BATCH BECOMES A MESSAGE — for the single-party runner and the multi-party one alike.
 *
 * ⛔ IT IS ONE FUNCTION BECAUSE THE LEDGER'S OWN GATE SAID SO. `R23` briefly gave these five lines two homes,
 * and `S3-runSteps-loses-atomicity` — whose anchor is the `batch.ok` line — immediately reported UNANCHORED:
 * *"a claim someone cited as evidence can no longer be performed."* The repair is not a cleverer anchor. Two
 * copies of the rule *"a Surface must not report success for a sequence the engine refused"* is exactly the
 * drift that lets one copy be fixed and the other not.
 */
function batchError(
	batch: ReturnType<typeof dispatchBatch>,
	commandTypeAt: (index: number) => string
): string | null {
	if (batch.ok) return null;
	const at = batch.failedIndex ?? batch.results.length - 1;
	const failed = batch.results[at];
	return `${commandTypeAt(at)}: ${failed?.error?.message ?? failed?.status ?? 'REJECTED'}`;
}

function runSteps(steps: readonly Step[]): string | null {
	return batchError(
		dispatchBatch(
			steps.map(([commandType, targetAggregateType, targetAggregateId, payload]) => ({
				commandType,
				targetAggregateType,
				targetAggregateId,
				payload
			}))
		),
		(index) => steps[index]?.[0] ?? '(unknown command)'
	);
}

/**
 * ⭐⭐ ONE TRANSACTION, TWO ACTING PARTIES (`JAN-EXEC` `R23`, design §4.16).
 *
 * ⛔ THE TWO-BATCH VERSION OF THIS WAS A REAL REGRESSION AND `undertaking-atomicity.e2e.ts` CAUGHT IT: 39
 * assessments before a refused affordance, 42 after. Three orphans, which is verbatim the defect
 * `SPEC-001-INV-14` pins — *"a partially-applied sequence SHALL NOT leave committed state behind"*.
 *
 * ⚠ AND THE OBVIOUS FIX WAS THE WRONG ONE. Reordering the batches so the refusal happens first would have made
 * that spec green while leaving the window open in the other direction, and collapsing back to one session would
 * have restored the self-review (`REG-F-400`). The envelope itself had to admit two parties, because the corpus
 * requires BOTH atomicity and independence and the engine could previously express only one at a time.
 *
 * Each entry names the credential it is issued under; the reviewer's assessments and the controller's state hops
 * commit together or not at all, and every command is stamped from its OWN resolved principal.
 */
function runMultiParty(
	reviewerSteps: readonly Step[],
	operatorSteps: readonly Step[]
): string | null {
	const entries = [
		...reviewerSteps.map((step) => ({ step, as: ASSURANCE_REVIEWER_CREDENTIAL })),
		...operatorSteps.map((step) => ({ step, as: undefined }))
	];
	return batchError(
		dispatchMultiPartyBatch(
			entries.map(({ step: [commandType, targetAggregateType, targetAggregateId, payload], as }) => ({
				command: { commandType, targetAggregateType, targetAggregateId, payload },
				...(as === undefined ? {} : { as })
			}))
		),
		(index) => entries[index]?.step[0] ?? '(unknown command)'
	);
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

/**
 * ── ⭐⭐ `JAN-EXEC` P7-6R R-1b (RD2; `REG-D-104` (1); `REG-F-511`; `REG-F-513`) — THE WAIT, RECORDED WHERE THE REFUSAL HAPPENS
 *
 * ⛔ UNTIL R-1 THE REFUSAL WROTE NO EVENT: the step stayed RUNNING, the unit EXECUTING and RUNNING, and the reason lived only
 * in the response's `form.error` (`REG-F-513`). Now the step WAITS, with a reason naming each refusing subject, policy and
 * disposition (`waitReasonFor`), and the unit's execution axis says WAITING — so the unit reads as waiting for a person,
 * durably, and the page offers the person's choices (RD3) instead of acts that run nothing (`REG-F-466`).
 * ⭑ ITS OWN BATCH, AFTER THE REFUSED ONE ROLLED BACK: the refused completion stays refused whole (`SPEC-001-INV-14`,
 * `REG-F-513`'s atomicity), and the wait is a separate fact about what follows it.
 * ⚠ ONLY A STEP STILL RUNNING WAITS. A step something else already moved — failed by hand mid-review, say — is not waiting on
 * this refusal, and `EnterExecutionStepWait` would refuse it; the refusal is then reported alone, as before R-1.
 * Returns why the wait could not be recorded, or null.
 */
function waitForAPerson(
	pwuId: string,
	planId: string,
	stepId: string,
	refusals: Parameters<typeof waitReasonFor>[0],
	engineRefusal: string
): string | null {
	const steps =
		(getObject(getEngine(), planId)?.steps as { id?: string; stepState?: string }[] | undefined) ?? [];
	if (!steps.some((s) => s.id === stepId && s.stepState === 'RUNNING')) return null;
	// ⭐⭐ `P76F-C` C3 — THE REASON NAMES ONLY THE CHOICES THIS STOP OFFERS: read from the floors just recorded over the refused
	// subjects (`stopAtRefusal`), by the rule the page and the server read the stop back by (`offersOf`). ⛔ It named all
	// three for every refusal, on the permanent record.
	const stop = stopAtRefusal(
		uiSession(),
		refusals.map((r) => r.subjectId)
	);
	return runSteps([
		[
			'EnterExecutionStepWait',
			'EXECUTION_PLAN',
			planId,
			{ stepId, waitReason: waitReasonFor(refusals, engineRefusal, stop) }
		],
		chg(pwuId, 'EXECUTING', 'EXECUTING', 'WAITING', 'UNASSESSED', 'PRESERVED', [planId])
	]);
}

/**
 * ⭐ P7-6R RD4 — THE PERSON'S CHOICE, AS A DECISION, proposed and approved in the batch it authorises: `authority` the
 * session's own HUMAN actor (`proposeDecision` refuses any other, `REG-F-014`); the rationale the caller composes — the
 * person's typed text, verbatim, then the act's citation (`decisionRationale`); the subjects the refused unit, plan, work
 * product and evidence; the observations considered, the refusing assessments'. ⭑ That is canon's control-action record
 * (RPH-DOC-002:2242-2249), each field a field.
 * ⚠ No policy object authorises a person's re-run, and none is invented: the authority is the sponsor's ruling.
 * ⛔ `P76F-A` A3: the first build said here that the ruling was "cited … in the selected option's reading" — and the
 * Decision cited nothing: its rationale was the typed text alone. RD4 puts the ruling in the rationale's template, and
 * the record says no policy object exists; each call below now passes its act's citation (`recovery-authority.ts`).
 */
function personsDecision(
	decisionId: string,
	decisionType: 'REPLAN' | 'ABANDON',
	selectedOption: string,
	subjectObjectIds: readonly string[],
	consideredObservationIds: readonly string[],
	rationale: string
): Step[] {
	return [
		[
			'ProposeDecision',
			'DECISION',
			decisionId,
			{
				decisionType,
				subjectObjectIds: [...subjectObjectIds],
				selectedOption,
				rationale,
				authority: actingActor(uiSession()),
				consideredObservationIds: [...consideredObservationIds]
			}
		],
		[
			'ApproveDecision',
			'DECISION',
			decisionId,
			{
				selectedOption,
				rationale,
				consideredEvidenceIds: [],
				consideredObservationIds: [...consideredObservationIds],
				subjectSemanticVersions: { [subjectObjectIds[0]!]: 1 }
			}
		]
	];
}

/** The refused unit's subjects, in RD4's order: the unit, the refused plan, its work product, then its evidence. */
const decisionSubjects = (s: StoppedUnit): string[] => [
	s.pwuId,
	s.planId,
	s.workProductId,
	...s.evidenceIds
];

/** The work unit, its type, and the type's parsed facts — read as Begin & Execute reads them (`R30`, `REG-F-411`). */
function unitTypeOf(pwuId: string) {
	const pwu = getObjectOfType(getEngine(), 'PROFESSIONAL_WORK_UNIT', pwuId);
	const pwuTypeId = String((pwu?.pwuTypeId ?? '') as string);
	const pwuType = pwuTypeId ? getObjectOfType(getEngine(), 'PWU_TYPE', pwuTypeId) : undefined;
	const typeFacts = resolvePwuTypeFacts(
		(id) => getObjectOfType(getEngine(), 'PWU_TYPE', id),
		pwuTypeId || undefined
	);
	return { pwu, pwuType, pwuTypeId, typeFacts };
}

/**
 * ⭐ P7-6R RD7 — EVERYTHING A RE-REVIEW'S FLOORS NEED, REBUILT FROM THE RECORD: the producing turn (prompt, rationale,
 * producer, exchange — `rebuildProducingTurn`) and the run of each refused command (`rebuildProcessRun`). ⛔ The first
 * part that cannot be rebuilt refuses the whole, so nothing is dispatched and the unit keeps waiting.
 */
async function rebuildForReview(
	s: StoppedUnit
): Promise<
	| {
			readonly ok: true;
			readonly turn: RebuiltProducingTurn;
			readonly runs: ReadonlyMap<string, ObservedProcessRun>;
	  }
	| { readonly ok: false; readonly refusedBecause: string }
> {
	const { pwuType, pwuTypeId, typeFacts } = unitTypeOf(s.pwuId);
	const turn = await rebuildProducingTurn(uiSession(), getArtifactStore(), {
		pwuId: s.pwuId,
		workProductId: s.workProductId,
		attemptKey: s.attemptKey,
		pwuTypeId,
		template: typeFacts.promptTemplate,
		...(typeFacts.purpose ? { purpose: typeFacts.purpose } : {}),
		...(pwuType?.contextSpecification
			? { contextSpecification: pwuType.contextSpecification as ContextSpecification }
			: {})
	});
	if (!turn.ok) return turn;
	const runs = new Map<string, ObservedProcessRun>();
	for (const [i, evidenceId] of s.evidenceIds.entries()) {
		if (!s.refusals.some((r) => r.subjectId === evidenceId)) continue;
		const run = await rebuildProcessRun(
			getObject(getEngine(), evidenceId) ?? {},
			getArtifactStore(),
			i + 1
		);
		if (!run.ok) return run;
		runs.set(evidenceId, run.value);
	}
	return { ok: true, turn: turn.value, runs };
}

// ── ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — THE DECLARED POLICIES' REVIEWS, FROM THE RECORD (`REG-F-523`; `REG-D-110` (3);
// `REG-D-111` (2); `DESIGN-phase-7-completion.md` B1, B6) ────────────────────────────────────────────────────────────────

/** ⭐ E2 — one unit's work, read from the record, as its declared reviews judge it (`R18`). */
interface UnitWork {
	readonly title: string;
	/** The instruction the work answered: the producing prompt, re-rendered (RD7); for a unit no model ran, its purpose. */
	readonly instruction: string;
	/** ⭐ `E12F` F4 — what `instruction` is: the producing prompt, or the unit's own purpose (`DeclaredInstruction`). */
	readonly instructionIs: DeclaredInstruction;
	/** ⭐ `E12F` F4 — the unit's own purpose: the standard a unit composed of others is judged against. */
	readonly purpose: string;
	/** The work product's bytes, verified against the ARTIFACT's own hash — absent when the unit recorded none. */
	readonly answer?: string;
	readonly rationale?: ProfessionalRationaleSummary;
	readonly commands: readonly DeclaredReviewCommand[];
	/** ⭐ `REG-F-514` — WHO DID THIS UNIT'S OWN WORK, as its completion records it, its attempt as its invocation. */
	readonly executedBy?: ActorReference;
}

/** The unit's LAST step completion, in log order, with the plan it completed — or nothing, if no step of it succeeded. */
function lastCompletionOf(
	pwuId: string
): { readonly planId: string; readonly payload: Record<string, unknown> } | undefined {
	const engine = getEngine();
	const plans = new Set(
		listExecutionPlans(engine)
			.filter((p) => String(p.state.workUnitId ?? '') === pwuId)
			.map((p) => p.id)
	);
	const done = engine
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionStepSucceeded' && plans.has(e.aggregateId));
	const last = done.at(-1);
	return last ? { planId: last.aggregateId, payload: (last.payload ?? {}) as Record<string, unknown> } : undefined;
}

/** ⭐ E2 — each command a completion's evidence records: the command, its exit, whether it timed out. Pointers, no bytes. */
function commandsOf(title: string, evidenceIds: readonly string[]): DeclaredReviewCommand[] {
	return evidenceIds.flatMap((id) => {
		const ref = getObject(getEngine(), id)?.contentReference as
			| { command?: unknown; exitCode?: unknown; timedOut?: unknown }
			| undefined;
		if (!ref || !Array.isArray(ref.command)) return [];
		return [
			{
				unit: title,
				argv: ref.command.map(String),
				exitCode: typeof ref.exitCode === 'number' ? ref.exitCode : null,
				timedOut: ref.timedOut === true
			}
		];
	});
}

/**
 * ⭐⭐ E2 — ONE UNIT'S WORK, AS THE RECORD HOLDS IT: its last completion's work product — REBUILT as a re-review rebuilds it
 * (RD7, `rebuildProducingTurn`): its bytes re-hashed, its instruction re-rendered and checked against the exchange that
 * produced it, its account split from that exchange — the commands its evidence records, and its executor.
 * ⛔ A WORK PRODUCT THE RECORD CANNOT REBUILD REFUSES THE WHOLE (RD7's rule): no review of a partial reconstruction is asked
 * for, and nothing is dispatched. ⚠ A unit with no completion, or one that named no output, is judged as it is: its
 * purpose the instruction, no work product, its commands if any.
 */
async function unitWorkOf(
	pwuId: string
): Promise<{ readonly ok: true; readonly work: UnitWork } | { readonly ok: false; readonly refusedBecause: string }> {
	const { pwu, pwuType, pwuTypeId, typeFacts } = unitTypeOf(pwuId);
	const title = String((pwu?.title ?? pwuId) as string);
	const purpose = typeFacts.purpose ?? String((pwu?.description ?? '') as string);
	const completion = lastCompletionOf(pwuId);
	if (!completion)
		return { ok: true, work: { title, instruction: purpose, instructionIs: 'UNIT_PURPOSE', purpose, commands: [] } };
	const p = completion.payload;
	const provenance = p.executionProvenance as
		| { executedBy?: ActorReference; producingExecutionAttemptId?: unknown }
		| undefined;
	const reused = typeof provenance?.producingExecutionAttemptId === 'string' ? provenance.producingExecutionAttemptId : undefined;
	const attemptId = reused ?? String((p.executionAttemptId ?? '') as string);
	// ⭐ `REG-F-514` remedy 1 — the executor's own invocation is its attempt, so a `DIFFERENT_INVOCATION` demand is decided.
	const executedBy = provenance?.executedBy
		? {
				...provenance.executedBy,
				...(provenance.executedBy.executionInstanceId || !attemptId ? {} : { executionInstanceId: attemptId })
			}
		: undefined;
	const commands = commandsOf(title, Array.isArray(p.proposedEvidenceIds) ? p.proposedEvidenceIds.map(String) : []);
	const outputs = Array.isArray(p.outputArtifactIds) ? p.outputArtifactIds.map(String) : [];
	if (outputs.length === 0)
		return {
			ok: true,
			work: { title, instruction: purpose, instructionIs: 'UNIT_PURPOSE', purpose, commands, ...(executedBy ? { executedBy } : {}) }
		};
	const stepId = String((p.executionStepId ?? '') as string);
	const turn = await rebuildProducingTurn(uiSession(), getArtifactStore(), {
		pwuId,
		workProductId: outputs[0]!,
		// ⭐ The PRODUCING attempt: a re-review's completion names the attempt that made the work it passed (RD6).
		attemptKey: reused ?? attemptKeyOf(getEngine(), completion.planId, stepId),
		pwuTypeId,
		template: typeFacts.promptTemplate,
		...(typeFacts.purpose ? { purpose: typeFacts.purpose } : {}),
		...(pwuType?.contextSpecification
			? { contextSpecification: pwuType.contextSpecification as ContextSpecification }
			: {})
	});
	if (!turn.ok)
		return { ok: false, refusedBecause: `the work of ${title} cannot be rebuilt from the record: ${turn.refusedBecause}` };
	return {
		ok: true,
		work: {
			title,
			instruction: turn.value.producingPrompt,
			// ⭐ `E12F` F4 — re-rendered and checked against the exchange that produced the work (RD7): the prompt its producer was given.
			instructionIs: 'PRODUCING_PROMPT',
			purpose,
			answer: turn.value.answer,
			...(turn.value.rationale ? { rationale: turn.value.rationale } : {}),
			commands,
			...(executedBy ? { executedBy } : {})
		}
	};
}

/** ⭐ E2 — what a unit's declared reviews judge: its own work, or — for a unit composed of others — its children's. */
interface DeclaredReviewWork {
	readonly instruction: string;
	/** ⭐ `E12F` F4 — what `instruction` is, which the reviewer is told (`DeclaredInstruction`). */
	readonly instructionIs: DeclaredInstruction;
	readonly workProducts: readonly { readonly unit: string; readonly answer: string }[];
	readonly commands: readonly DeclaredReviewCommand[];
	readonly rationale?: ProfessionalRationaleSummary;
	/**
	 * ⭐ `REG-F-514` — the producer the verdicts check independence against: the unit's OWN executor, else the operator.
	 * ⛔ `E12F` F9 — WHO DID THE JUDGED WORK FOR A PHASE ONLY: a unit composed of others is judged over its children's work,
	 * and its producer is still its own — the operator who ran its TRANSFORMATION — so its verdicts check independence
	 * against the operator, never against the agents whose work they judged.
	 */
	readonly producer: ActorReference;
}

/**
 * ⭐⭐ E2 — THE WORK A UNIT'S DECLARED POLICIES ARE JUDGED OVER (`R18`; design B1, B6). A unit with children is judged over
 * ITS CHILDREN's work products and commands, the end-to-end phase's evidence among them (`REG-D-111` (2), DEC-6): its own
 * TRANSFORMATION produces nothing. ⚠ A child with no work product contributes its commands only; the root's instruction is
 * its own purpose, and no single account is shown for many children's work. ⛔ `E12F` F9 — AND ITS PRODUCER IS ITS OWN
 * executor (the operator, for the root), not its children's: independence is checked against who did the judged work for
 * a phase only.
 */
async function declaredReviewWorkOf(
	pwuId: string,
	operator: ActorReference
): Promise<{ readonly ok: true; readonly work: DeclaredReviewWork } | { readonly ok: false; readonly refusedBecause: string }> {
	const own = await unitWorkOf(pwuId);
	if (!own.ok) return own;
	const producer = own.work.executedBy ?? operator;
	const children = listPwus(getEngine()).filter((u) => String(u.state.parentWorkUnitId ?? '') === pwuId);
	if (children.length === 0)
		return {
			ok: true,
			work: {
				instruction: own.work.instruction,
				instructionIs: own.work.instructionIs,
				workProducts: own.work.answer === undefined ? [] : [{ unit: own.work.title, answer: own.work.answer }],
				commands: own.work.commands,
				...(own.work.rationale ? { rationale: own.work.rationale } : {}),
				producer
			}
		};
	const workProducts: { unit: string; answer: string }[] = [];
	const commands: DeclaredReviewCommand[] = [];
	for (const child of children) {
		const w = await unitWorkOf(child.id);
		if (!w.ok) return w;
		if (w.work.answer !== undefined) workProducts.push({ unit: w.work.title, answer: w.work.answer });
		commands.push(...w.work.commands);
	}
	// ⛔ `E12F` F4 — ITS OWN PURPOSE, never a prompt of its own, and the reviewer is told so: the work judged is its children's,
	// each made under its own child's instruction (~~`own.work.instruction`~~, which for a unit that ran a prompt of its own
	// would have been shown as the instruction its children were given).
	return {
		ok: true,
		work: { instruction: own.work.purpose, instructionIs: 'UNIT_PURPOSE', workProducts, commands, producer }
	};
}

/** ⭐ E2 — the declared stand-in's lookup: a `DECLARED_POLICY` registration for the unit's PWA, read from the registry. */
function declaredStipulationFor(pwuId: string): 'CLEAN' | undefined {
	if (!anyStipulationRegistered()) return undefined;
	const pwaId = workUnitPwaOf(getEngine(), pwuId);
	return pwaId === undefined ? undefined : stipulationFor(pwaId, 'DECLARED_POLICY');
}

/** The record's actor as the assurance island's identity — what the review's subject names as its producer. */
function identityOf(actor: ActorReference): Identity {
	return {
		actorType: actor.actorType,
		agentId: actor.actorId,
		...(actor.modelId ? { modelId: actor.modelId } : {}),
		...(actor.providerId ? { providerId: actor.providerId } : {}),
		...(actor.executionInstanceId ? { invocationId: actor.executionInstanceId } : {})
	};
}

/** ⭐ E2 — the invoker a declared review's calls are recorded under: never the floor's `reasoning-review`. */
const DECLARED_REVIEW_INVOKER_ID = 'declared-policy-review';

/**
 * ⭐⭐ E2 — ONE REVIEW PER GOVERNING DECLARED POLICY (`REG-D-110` (3)), each through the selected reviewer (the floor's own,
 * `createDeclaredPolicyReviewer`), each its own invocation: a token its calls are recorded under, which the verdict's
 * evaluator carries as its invocation. ⭑ Every call is recorded (PER-9), on the ASSURANCE plane under the declared policy,
 * BEFORE the sign-off is dispatched — a paid call is an act that happened, whatever the batch then does.
 */
async function reviewDeclaredPolicies(
	pwuId: string,
	policies: readonly GoverningDeclaredPolicy[],
	work: DeclaredReviewWork,
	semanticVersion: number
): Promise<{
	readonly answers: ReadonlyMap<string, DeclaredPolicyAnswer>;
	readonly invocations: ReadonlyMap<string, string>;
}> {
	const answers = new Map<string, DeclaredPolicyAnswer>();
	const invocations = new Map<string, string>();
	const subject: AssuranceSubject = {
		subjectId: pwuId,
		objectType: 'PROFESSIONAL_WORK_UNIT',
		semanticVersion,
		isAiProduced: true,
		producer: identityOf(work.producer)
	};
	for (const policy of policies) {
		const token = `declared-review:${pwuId}:${policy.policyId}:${mintUiId('rvw')}`;
		const exchanges = createExchangeSink();
		const reviewer = createDeclaredPolicyReviewer({
			testMode: isTestMode(),
			artifacts: getArtifactStore(),
			exchanges,
			stipulations: (s) => declaredStipulationFor(s.subjectId)
		});
		const answer = await reviewer.review(
			subject,
			declaredPolicyReviewInput({
				policy: { policyId: policy.policyId, name: policy.name, purpose: policy.purpose },
				criteria: policy.criteria,
				instruction: work.instruction,
				instructionIs: work.instructionIs,
				workProducts: work.workProducts,
				commands: work.commands,
				...(work.rationale ? { rationale: work.rationale } : {})
			})
		);
		answers.set(policy.policyId, answer);
		invocations.set(policy.policyId, token);
		const drained = exchanges.drain();
		if (drained.length === 0) continue;
		const outcome = recordExchanges(
			(payload, aggregateId) =>
				uiSession().dispatch({
					commandId: mintUiId('cmd'),
					commandType: 'RecordModelExchange',
					commandSchemaVersion: 1,
					targetAggregateType: 'MODEL_EXCHANGE',
					targetAggregateId: aggregateId,
					issuedAt: hostNow(),
					correlationId: token,
					idempotencyKey: `mex:${aggregateId}`,
					payload
				}),
			drained,
			{
				runToken: token,
				plane: 'ASSURANCE',
				invokerId: DECLARED_REVIEW_INVOKER_ID,
				assurancePolicyId: policy.policyId,
				subjectObjectId: pwuId,
				subjectObjectType: 'PROFESSIONAL_WORK_UNIT',
				subjectSemanticVersion: semanticVersion,
				newId: mintUiId
			}
		);
		// A retention fault must not fail a review that reached its conclusion — but it must not vanish either.
		if (outcome.failures.length > 0)
			console.warn(
				`[MXR] ${outcome.recorded}/${drained.length} declared-review exchange records written; ` +
					`${outcome.failures.length} failed: ${outcome.failures.join('; ')}`
			);
	}
	return { answers, invocations };
}

/**
 * ⭐ E2 — THE UNIT'S LAST ASSURANCE HOP, BY THE FOLD OF ITS DECLARED VERDICTS (design B3; `REG-D-111` (1)): a positive fold
 * (or none, when nothing governs) asserts it citing every assessment; REJECTED asserts it citing the REJECTED verdicts and
 * their blocking findings; INCONCLUSIVE asserts nothing — it is no value of the unit's assurance axis (`pwu.ts`).
 */
function declaredHop(
	pwuId: string,
	folded: DeclaredSignoff['foldedAssuranceState'],
	positiveCites: readonly string[],
	review: DeclaredSignoff
): Step[] {
	if (folded === 'INCONCLUSIVE') return [];
	if (folded === 'REJECTED')
		return [
			chg(pwuId, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED', 'PRESERVED', [
				...review.assessmentIds.filter((_, i) => review.dispositions[i] === 'REJECTED'),
				...review.blockingObservationIds
			])
		];
	return [
		chg(
			pwuId,
			'UNDER_ASSURANCE',
			'UNDER_ASSURANCE',
			'SUCCEEDED',
			folded ?? 'SATISFIED',
			'PRESERVED',
			positiveCites
		)
	];
}

/**
 * ⭐ P7-6R RD5 — A RE-RUN IS A PLAN REVISION, IN ONE BATCH: plan B proposed with its one step; A superseded citing B; A's
 * waiting step cancelled, its reason citing the Decision; B's binding requested and authorized, when its step has one; B
 * approved and activated; the unit's execution axis WAITING→RUNNING; B's step started — the new attempt on the record.
 * ⭑ DRIVEN IN THE ENGINE FIRST (`plan-revision-chain.store.test.ts`, R-1a): admitted, as predicted, in this order.
 * ⚠ CARRIED, NOT FIXED (RD10, `REG-F-232`): no `ReviseExecutionPlan` act exists and `planVersion` stays 1; the chain is read
 * from `ExecutionPlanSuperseded.supersedingExecutionPlanId`, and A's step is closed explicitly because supersession does not
 * touch it.
 */
function planRevision(
	s: StoppedUnit,
	decisionId: string,
	planB: string,
	step: {
		readonly id: string;
		readonly stepType: 'ASSURANCE_INVOCATION' | 'MODEL_INVOCATION';
		readonly purpose: string;
		readonly inputBindings: readonly { artifactId: string; required: boolean }[];
		readonly binding?: NonNullable<ReturnType<typeof stepBindingFor>>;
	}
): Step[] {
	const bindingId = step.binding?.request.runtimeBindingId;
	// ⭑ Each act named, so the batch below reads as RD5's list, in RD5's order.
	const supersedeA: Step = [
		'SupersedeExecutionPlan',
		'EXECUTION_PLAN',
		s.planId,
		{ supersedingExecutionPlanId: planB }
	];
	// ⛔ SUPERSESSION DOES NOT TOUCH A's STEPS (`REG-F-232`), so the waiting step is closed here, citing the Decision.
	const cancelA: Step = [
		'CancelExecutionStep',
		'EXECUTION_PLAN',
		s.planId,
		{
			stepId: s.stepId,
			reason: `Superseded by plan ${planB} under the person’s Decision ${decisionId} (REG-D-104 (1)).`
		}
	];
	const bindB: Step[] =
		step.binding && bindingId
			? [
					['RequestRuntimeBinding', 'RUNTIME_BINDING', bindingId, step.binding.request],
					[
						'AuthorizeRuntimeBinding',
						'RUNTIME_BINDING',
						bindingId,
						{ grantedCapabilities: [...step.binding.request.requestedCapabilities] }
					]
				]
			: [];
	const proposeB: Step = [
		'ProposeExecutionPlan',
		'EXECUTION_PLAN',
		planB,
		{
			executionPlanId: planB,
			workUnitId: s.pwuId,
			steps: [
				{
					id: step.id,
					executionPlanId: planB,
					stepType: step.stepType,
					...(bindingId ? { runtimeBindingId: bindingId } : {}),
					purpose: step.purpose,
					inputBindings: [...step.inputBindings],
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
	];
	const activateB: Step[] = [
		['ApproveExecutionPlan', 'EXECUTION_PLAN', planB, {}],
		[
			'ActivateExecutionPlan',
			'EXECUTION_PLAN',
			planB,
			{ authorizedRuntimeBindingIds: bindingId ? [bindingId] : [] }
		]
	];
	const resumeUnit = chg(s.pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', 'UNASSESSED', 'PRESERVED', [
		planB
	]);
	const startB: Step = ['StartExecutionStep', 'EXECUTION_PLAN', planB, { stepId: step.id }];
	return [proposeB, supersedeA, cancelA, ...bindB, ...activateB, resumeUnit, startB];
}

/**
 * ⛔ THE MODEL IS THE EXECUTOR of a model step's result — Begin & Execute's completion, a re-run's, and a re-review's,
 * which names the work product the model made in the refused attempt. ⭑ ONE LITERAL, because the run report reads a
 * completion's shape by it (`scripts/phase7/run-report-core.ts`, `MODEL_EXECUTOR_NAME`), and its control holds the page
 * to saying it exactly once.
 */
function modelExecutedBy(modelId: string) {
	return { actorId: `model:${modelId}`, actorType: 'AGENT' as const, displayName: 'Execution model' };
}

/** What one model unit's run needs: the started plan and step, its binding, its executor, and its type's facts. */
interface ModelUnitRun {
	readonly pwuId: string;
	readonly planId: string;
	readonly stepId: string;
	/** The id the step's completion records as `executionAttemptId`. */
	readonly attemptId: string;
	readonly binding: ReturnType<typeof stepBindingFor>;
	readonly bindingId: string;
	readonly executor: RunnableExecutorSelection;
	readonly pwu: Record<string, unknown> | undefined;
	readonly pwuType: Record<string, unknown> | undefined;
	readonly pwuTypeId: string;
	readonly typeFacts: ReturnType<typeof resolvePwuTypeFacts>;
	/**
	 * ⭐ P7-6R RD8 — a refused attempt's SUBJECT findings, carried by a person's re-run of the work into this run's FRESH
	 * session, on its first turn only. Absent for Begin & Execute.
	 */
	readonly carriedFindings?: readonly { readonly code: string; readonly statement: string }[];
}

/**
 * ⭐⭐ `JAN-EXEC` P7-6R — A MODEL UNIT'S RUN, AFTER ITS PLAN'S STEP HAS STARTED: the producer loop, the work-product floor,
 * the evidence join, the completion — and, when the floor refuses the completion, the WAIT (RD2). Extracted from
 * Begin & Execute, unchanged but for RD6's attempt key, RD8's carried findings and RD2's wait, because a person's re-run
 * of the work (`rerunWork`, RD5) runs exactly this on its plan B: a second copy of the loop is how two descriptions of one
 * run come to disagree (`REG-F-353`).
 */
async function runModelUnit(u: ModelUnitRun) {
	const { pwuId, planId, stepId, attemptId, binding, bindingId, executor } = u;
	const { pwu, pwuType, pwuTypeId, typeFacts } = u;
	const template = typeFacts.promptTemplate;
	// ⭐ P7-6R RD6 — THE ATTEMPT THIS RUN IS, `<stepId>#<n>`: the step has just started, so its count of Starts names it.
	// Every work product and every command evidence this run records carries it, so a re-review knows which attempt made
	// what it re-reviews — the reference a DBOS step output would carry (the design's §6).
	const attemptKey = attemptKeyOf(getEngine(), planId, stepId);
	// ── ⭑ THE MODEL CALL HAPPENS HERE, OUTSIDE THE BATCH, AND THAT IS NOT A COMPROMISE ─────────────────
	//
	// `runSteps` dispatches atomically. An external call cannot join that batch, and it should not: a step
	// whose model call failed has genuinely STARTED and genuinely FAILED, and `FailExecutionStep` is the
	// command that says so. Rolling the start back would erase a try that happened, cost money, and is
	// exactly what `PER-9` keeps records for.
	// ── ⭑⭑ JAN-EXECLOOP — THE LOOP `REG-D-059` LICENSED AND LEFT OPEN ─────────────────────────────
	//
	// The sponsor: *"the automated reviews / policies … are fed back into the executing agent of the PWU
	// so that it may attempt to address the identified findings. However, that could go in loops so
	// there is expected to be a loop detection capability … At some point — say two loops or three —
	// there would be an escalation."* `REG-D-059` measured the ground and named the gap exactly: three
	// of the four parts existed; **what was missing is the LOOP** — a bound greater than one, and the
	// classification that decides when to stop.
	//
	// ⚠ EVERY TRY IS ITS OWN ARTIFACT AND ITS OWN EXCHANGE RECORD. `PER-9` requires *"each retry,
	// reformat, and repair request"* be recorded, and CSAA-007 that *"repair never rewrites predecessor
	// raw output"* — so a superseded try is SUPERSEDED, never overwritten. Reusing one artifact id
	// across tries would destroy the evidence the loop exists to produce.
	let outcome!: Extract<Awaited<ReturnType<typeof runModelInvocationStep>>, { ran: true }>;
	let review!: Awaited<ReturnType<typeof runWorkProductFloor>>;
	let artifactId = '';
	let priorFindings: readonly { code: string; statement: string }[] = [];
	const openPerTry: number[] = [];
	let loopEnded = '';

	// ⭑⭑ ONE SESSION FOR THE WHOLE WORK UNIT (`JAN-EXECSESS`). The sponsor's v2 mechanism: *"the CLI
	// session wasn't closed or released until the phase or sub-phase completed … This approach allowed
	// the assurance policies feedback to be fed back to the implementing agent before that phase or
	// sub-phase was determined complete."* Opened before the loop and released in `finally`, so a
	// repair turn reaches a producer that remembers what it produced.
	// ── ⭑⭑ CP-04d — THE POLICY IS RESOLVED FROM THE STORE, BEFORE A SINGLE TURN IS SENT ────────────
	//
	// `ICP-04`'s exit test is *"point a binding at a policy that does not exist. This MUST refuse"*, and
	// until this line it stood only in a unit test with a hand-built finder. ⚠ The refusal FAILS THE
	// STEP rather than throwing past it: the step has already STARTED (the batch above ran
	// `StartExecutionStep`), so a try that cannot proceed is a failure with a reason, not an absence.
	let governing: ReturnType<typeof resolveContextPolicy>;
	try {
		governing = resolveContextPolicy(getEngine(), stepId);
	} catch (e) {
		const why = e instanceof Error ? e.message : String(e);
		runSteps([['FailExecutionStep', 'EXECUTION_PLAN', planId, { stepId, failureReason: why }]]);
		return fail(400, { error: `The model invocation did not run: ${why}` });
	}

	/**
	 * What the binding CURRENTLY says, from the store — never the request. Both halves, together.
	 *
	 * ⛔⛔ `W-1` — THE PROJECTION IS THE KERNEL'S, NOT A FOURTH SPELLING OF IT. This used to be
	 * `.map((c) => String(c.capability ?? ''))`, which is a FOURTH projection of `grantedCapabilities`
	 * and the only one that does not use `capabilityIdentities` — whose own docblock says *"ONE COPY,
	 * because there are now three readers, and a projection duplicated per reader is how two of them come
	 * to disagree."* ⚠ AND THEY DID DISAGREE: the kernel's DROPS a non-string element (fail-closed, an
	 * unreadable grant grants nothing), while `String(c.capability ?? '')` COERCED one into the empty
	 * string and kept it — an entry no authorizer wrote, in the list a tool surface is minted from.
	 *
	 * ⛔⛔ `B-1` — AND THE STATUS COMES BACK WITH IT, because a capability list is NOT an authorization.
	 * `RevokeRuntimeCapability` advances `authorizationStatus` to REVOKED and DELIBERATELY leaves
	 * `grantedCapabilities` intact (its handler says so: the revocation event is derived from the set the
	 * binding held). So every reader that took only the list saw the same answer before and after a
	 * revocation, and §22.1's *"Revoked bindings cannot be used for new attempts"* — RATIFIED — was
	 * enforced on the START arrow and nowhere per try. Returning the pair from ONE read is what stops a
	 * caller holding a grant without the fact that says whether it still stands.
	 */
	const currentBinding = (id: string): { status: string; capabilities: string[] } => {
		const state = listByType(getEngine(), 'RUNTIME_BINDING')
			.map((b) => b.state as Record<string, unknown>)
			.find((b) => b.id === id);
		return {
			status: typeof state?.authorizationStatus === 'string' ? state.authorizationStatus : '',
			capabilities: capabilityIdentities(state?.grantedCapabilities)
		};
	};

	// ── ⭐⭐ JAN-EXEC PHASE 2 — THE PRODUCER IS OPENED IN THE UNDERTAKING'S WORKSPACE ────────
	//
	// ⛔ UNTIL THIS LINE IT WAS OPENED IN THE SERVER'S. `openPiExecutionSession` hardcoded `process.cwd()`
	// twice because the opener was zero-argument and had nowhere else to get a directory — so an executing
	// model's notion of "here" was the SvelteKit server's own source tree, i.e. this repository.
	//
	// ⭑ THE OWNER IS THE **UNDERTAKING**, READ OFF THE PWU (`R8`). This action takes no `params`, and it
	// does not need to: `undertakingId` is on the flattened PWU, which is also the field `listPwus` keys on —
	// so the workspace belongs to the same object the work unit does, and a second step in a new session lands
	// in the same directory as the first.
	//
	// ── ⭐⭐ JAN-EXEC PHASE 3 — AND THE STEP'S GRANT DECIDES WHAT THE MODEL CAN DO IN IT ──────────────
	//
	// `grantedCapabilities` is read from the STORE, not from the request, exactly as the per-try refusal
	// below reads it: the tools minted for this session are the ones the RUNTIME_BINDING currently
	// grants, and an ungranted tool is never minted, so the model is never told it exists.
	//
	// ── ⛔⛔ `B-1c` — THE DISCLOSURE THAT USED TO STAND HERE NAMED A REFUSAL THAT DID NOT EXIST ────────
	//
	// It read: *"a capability revoked between tries refuses the next try when the step REQUIRES it
	// (`stepCapabilityRefusal`, below) — but a revoked capability the step merely USES leaves its tool
	// minted for the rest of this held session."* **DRIVEN: IT DID NOT, FOR `REQUIRES` OR FOR `USES`.**
	// And the sentence was wrong in a second way that is worse than the first: ⛔ **"a capability revoked
	// between tries" IS NOT AN EXPRESSIBLE ACT.** `RevokeRuntimeCapability` takes NO capability list — it
	// revokes the whole BINDING — and `grantIsMonotone` refuses an authorization that omits a capability
	// already granted. There is no command in this engine that removes one capability from a live
	// binding, so the disclosure described a mechanism, a refusal and a residual that all had no subject.
	//
	// ⭐ **WHAT IS TRUE NOW, AND IT IS THE `B-1` FIX RATHER THAN A REWORDING.** Revocation acts on the
	// BINDING, and both readers now take its STATUS:
	//   · BEFORE the session opens — `mintExecutionTools` mints NOTHING for a binding that cannot back a
	//     new attempt, so a revoked binding gets a model with no hands at all;
	//   · BETWEEN tries — `stepCapabilityRefusal` refuses the NEXT TRY outright, for `REQUIRES` and
	//     `USES` alike, because the refusal is on the binding and not on one capability.
	//
	// ⚠ **AND THE BOUND THAT GENUINELY REMAINS, STATED WITHOUT THE PART THAT WAS FALSE.** The surface is
	// minted ONCE, when the session opens, while the status and grant are re-read on EVERY try — so a
	// binding revoked mid-unit leaves its already-minted tools ON THE HELD SESSION. What that costs is
	// bounded by the refusal above: no further TURN is taken, so the model is never asked anything again
	// and never gets to call them. The session is held on sponsor authority (`JAN-EXECSESS`), so "a
	// session per try" is not available. ⭑ Pi exposes `AgentSession.setActiveToolsByName`, which can only
	// NARROW a registry this host already built — that is the seam a later increment would use, and
	// naming it keeps this a disclosed bound rather than an unknown one.
	let producer: Awaited<ReturnType<ReturnType<typeof getExecutionSession>>>;
	try {
		const current = binding ? currentBinding(bindingId) : undefined;
		producer = await getExecutionSession(executor)({
			...resolveUndertakingSandbox(String((pwu?.undertakingId ?? '') as string)),
			grantedCapabilities: current?.capabilities ?? [],
			// ⚠ `''` FOR A STEP THAT NAMES NO BINDING, AND WHAT MAKES THAT SAFE IS THE **LIST**, NOT THIS
			// FIELD — said because the plausible reading is the other way round. `canReuseBindingForNewAttempt`
			// refuses REVOKED and DENIED and nothing else, so an empty status passes it; what mints nothing
			// is the empty capability set beside it. ⛔ The same holds for a binding id that no longer
			// resolves: both halves come back empty from ONE read, so the two cannot disagree about which
			// case this is.
			bindingAuthorizationStatus: current?.status ?? ''
		});
	} catch (e) {
		// ⚠ A REFUSED SANDBOX FAILS THE STEP RATHER THAN ESCAPING AS A 500, mirroring the context-policy
		// refusal directly above: the step has already STARTED, so a producer that cannot lawfully be opened
		// is a failure with a reason, not an absence.
		const why = e instanceof Error ? e.message : String(e);
		runSteps([['FailExecutionStep', 'EXECUTION_PLAN', planId, { stepId, failureReason: why }]]);
		return fail(400, { error: `The model invocation did not run: ${why}` });
	}
	// ⭐ `JAN-SELRES` RS-1 (D4) — the record's fallback identity, from the selection that just opened the producer.
	const fallbackIdentity = executorRecordIdentity(executor);
	try {
		for (let attempt = 1; ; attempt++) {
			// ⛔ ONE READ PER TRY, HELD IN ONE VALUE. Reading the status and the grant through two calls
			// would reinstate, at the call site, the very split `currentBinding` exists to close.
			const onThisTry = binding ? currentBinding(bindingId) : undefined;
			const tryOutcome = await runModelInvocationStep({
				// ⭐⭐ `JAN-ASSERTED` `R30` — ONE PARSE REPLACES FIVE HAND-WRITTEN ASSERTIONS.
				//
				// ⛔ THIS LITERAL USED TO READ `String((pwu?.title ?? '') as string)` and four more like
				// it. Every field was ASSERTED into the shape this call wanted, so `check-types` had
				// nothing to check and two of them contradicted the contract outright.
				//
				// ⭑ `resolveInvocationSubject` refuses on ABSENCE **and on SHAPE**, the way
				// `resolveContextAssemblyPolicy` already does one object over. It closes the boundary by
				// CONSTRUCTION rather than by enumeration: a twelfth field added later is checked for
				// free, and a field the schema has never heard of becomes an error instead of `undefined`.
				//
				// ⚠ `purpose` COMES FROM THE **TYPE**, not the work unit, so it is supplied from the
				// parsed type facts rather than folded into the subject resolver — two objects, two
				// parses, neither one speaking for the other.
				subject: {
					...resolveInvocationSubject(
						(id) => getObjectOfType(getEngine(), 'PROFESSIONAL_WORK_UNIT', id),
						pwuId
					),
					...(typeFacts.purpose ? { purpose: typeFacts.purpose } : {})
					// ⭐⭐ `JAN-ASSERTED` — TWO CASTS USED TO SIT HERE, AND THEY ARE `REG-F-411` IN FULL:
					//
					//     expectedOutputs:   (pwu?.expectedOutputs   as string[] | undefined) ?? [],
					//     inputRequirements: (pwu?.inputRequirements as string[] | undefined) ?? []
					//
					// ⛔ THE CONTRACT SAYS OBJECTS. `objects.ts:556`/`:555` declare both as
					// `z.array(z.record(z.string(), z.unknown()))`, so `.join(', ')` downstream rendered
					// `[object Object]` into every executing model's instruction — and into every
					// reviewer's, which judges `RR-07-no-contradiction` against it. `check-types` could
					// not see it because **the cast existed precisely to stop it**.
					//
					// ⭑ AND `?? []` WAS THE SECOND DEFECT, QUIETER THAN THE FIRST. It turned ABSENT into
					// PRESENT-BUT-EMPTY, which defeated `JAN-PROMPT`'s ratified default #2 (2026-09-04,
					// `REG-D-058`) — *"A missing declared placeholder at render time is a REFUSAL, not a
					// disclosed gap."* The guard is live in `prompt-render.ts` and pinned green by
					// `execution-invocation.test.ts`; four characters here made it unreachable at the only
					// production call site.
					//
					// ⭐ NOTHING REPLACES THEM, BY RULING (`R29`). No form anywhere lets a professional
					// author `expectedOutputs`; every production site mints `{outputId: 'out_<ulid>',
					// kind: 'DOCUMENT'}`, so the best possible rendering is an internal id and a constant
					// the surface invented. The professional's own statement of the required output
					// already reaches the instruction through `PromptTemplate.outputContract`.
				},
				subjectSemanticVersion: Number((pwu?.semanticVersion ?? 1) as number),
				pwuTypeId,
				template,
				store: getArtifactStore(),
				tenantPrefix: EXECUTION_TENANT_PREFIX,
				dispatchExchange: (payload, aggregateId) =>
					dispatch('RecordModelExchange', 'MODEL_EXCHANGE', aggregateId, payload),
				newId: mintUiId,
				now: hostNow,
				// ⭐⭐ `JAN-NOANS` — THE EXECUTOR'S OWN CONFIGURATION, AND THIS LINE READ THE REVIEWER'S.
				//
				// ⛔ IT SAID `resolveJudgeModel() ?? 'unresolved'` WITH `providerId: 'agy'` — the ASSURANCE
				// model and the ASSURANCE tool, handed to an EXECUTION step. That is `REG-F-356`'s defect,
				// which `TS-04`/`LE-01` fixed on the paths two comments below (*"This read
				// `resolveJudgeModel()` — it labelled the PRODUCING model with the REVIEWING model's id"*)
				// — and this arm was left behind.
				//
				// ⚠ IT SURVIVED BECAUSE NOTHING REACHED IT. These values are the HOST_CONFIGURED FALLBACK,
				// used only when the tool reports no identity of its own~~: the success path always overrides
				// them with `produced.producer`. So the only readers were the `catch` arm and — now —
				// `JAN-NOANS`'s no-answer arm~~ — ⭐ `JAN-SELRES` D4, CORRECTED: which for the agy executor, whose
				// answer is a bare string, is EVERY call, the successful ones included; only Pi's success path
				// overrides them with `produced.producer`. The defect became visible on the first live run that
				// took the fallback: an EXECUTION exchange whose `resolvedModel` read `gemini-3.1-pro-high`.
				//
				// ⭑ MEASURED, NOT REASONED. `checkIndependence('DIFFERENT_MODEL', …)` reads this field, so a
				// failed execution call was recorded as having been produced by the reviewer.
				//
				// ⭐ `JAN-SELRES` RS-1 (D4) — AND THEY COME FROM THE SELECTION THAT OPENED THE EXECUTOR, no longer
				// from a second read of the environment per try (`resolveExecutorModel()`,
				// `resolveExecutorToolId()`). With the agy executor running the JUDGE model, that read named a
				// model that never ran (`REG-F-458`); now the model agy is asked to run IS the model recorded, and
				// the stand-in records no configured model, because none produced its answer.
				modelId: fallbackIdentity.modelId,
				// ⭑ THE TOOL, GRADED HOST_CONFIGURED, WHICH IS WHAT IT HONESTLY IS. The provider proper is
				// embedded in the model label (`openai-codex/gpt-6-astra`) and only the tool can resolve it —
				// so when the tool told us nothing, the tool id is the strongest true thing available.
				providerId: fallbackIdentity.providerId,
				session: producer,
				priorFindings,
				// ⭐ P7-6R RD8 — a person's re-run of the work carries the refused review's subject findings on its FIRST turn,
				// after the instruction, into this fresh session; later tries are repairs on the now-held session.
				...(attempt === 1 && u.carriedFindings?.length ? { carriedFindings: u.carriedFindings } : {}),
				// ⭑ THE RESOLVED POLICY, not an id — obeying it is the STEP's job because that is where the
				// assembly happens; resolving it is the caller's because that is what needs the store.
				contextPolicy: governing.policy,
				// ⭑ `PWU_TYPE.contextSpecification` — ratified, and read by NOTHING until CP-04b.
				...(pwuType?.contextSpecification
					? { contextSpecification: pwuType.contextSpecification as ContextSpecification }
					: {}),
				// ⭑ EG-03 — the binding's CURRENT status AND grant, read from the store on EVERY try.
				// ⛔ `B-1`: BOTH, from ONE read. Revocation between tries changes the STATUS and leaves the
				// GRANT untouched — `RevokeRuntimeCapability` does not clear it — so a caller passing the
				// grant alone passed a value that could not change and called it a check.
				binding:
					binding && onThisTry
						? {
								kind: 'BOUND',
								binding,
								granted: onThisTry.capabilities,
								authorizationStatus: onThisTry.status
							}
						: { kind: 'NONE' }
			});

			if (!tryOutcome.ran) {
				// ⛔ THE STEP FAILS, AND SAYS WHY. The work unit does not advance as though the work were done —
				// which is the whole difference between a demo and a record.
				runSteps([
					[
						'FailExecutionStep',
						'EXECUTION_PLAN',
						planId,
						{ stepId, failureReason: tryOutcome.refusedBecause }
					]
				]);
				return fail(400, {
					error: `The model invocation did not run: ${tryOutcome.refusedBecause}`
				});
			}
			outcome = tryOutcome;

			// ⭑⭑ THE ARTIFACT IS RECORDED ON ITS OWN, AND THE EVIDENCE TAUGHT ME THAT. My first version put
			// `RecordArtifact` and `CompleteExecutionStep` in ONE atomic batch. The floor refused the completion —
			// correctly — and took the artifact down with it, so a model call that DID happen and DID produce a
			// work product left no work product behind. ⚠ The model's output is a FACT about the world; whether
			// the step may COMPLETE is a judgement about that fact. Rolling the fact back because the judgement
			// went against it is the erasure `PER-9` exists to prevent.
			artifactId = mintUiId('art');
			const recorded = runSteps([
				[
					'RecordArtifact',
					'ARTIFACT',
					artifactId,
					{
						artifactId,
						artifactType: 'work-product',
						mediaType: 'text/plain',
						storageProvider: 'jpwb:content-plane',
						storageKey: tryOutcome.storageKey,
						contentHash: tryOutcome.contentHash,
						byteSize: tryOutcome.byteSize,
						producingPwuId: pwuId,
						// ⭐ P7-6R RD6 — the attempt that made it. `messages.ts` has carried the field since it was generated;
						// nothing set it until a re-review needed to know which attempt produced what it re-reviews.
						producingExecutionAttemptId: attemptKey,
						// ⚠ NOT NARROWED. These four columns have no ratified vocabulary (`REG-Q-056`, OPEN) and
						// `handlers/artifact.test.ts:123-136` is a green test that exists to catch anyone inventing
						// one. Free strings here are the honest shape, not laziness.
						securityClassification: 'unclassified',
						retentionClass: 'retained-by-participation',
						status: 'recorded'
					}
				]
			]);
			if (recorded)
				return fail(400, { error: `Recording the work product failed: ${recorded}` });

			// ── ⭑⭑ THE FLOOR RUNS OVER THE WORK PRODUCT, SO IT CAN BE SATISFIED AND NOT ONLY REFUSE ────────
			//
			// `REG-F-352` left this step able to run, produce a work product, and never complete: the floor
			// refused it correctly and nothing could satisfy it. This is the run that can.
			//
			// ⭑ THE SUBJECT IS THE ARTIFACT, because that is what `floorGateBlock` looks for. And the criteria
			// come from the SAME policy object the authoring review reads — restating the rubric here is how
			// four descriptions of one criterion came to disagree.
			review = await runWorkProductFloor(
				{
					artifactId,
					artifact: (getObject(getEngine(), artifactId) ?? {}) as Record<string, unknown>,
					// The exchange the call just recorded — resolved by the id the outcome now carries, rather
					// than searched for. `verifyExchangeContent` re-hashes its refs to decide `traceComplete`.
					exchange: (getObject(getEngine(), tryOutcome.exchangeId) ?? {}) as never,
					answer: tryOutcome.answer,
					producingPrompt: tryOutcome.prompt,
					// ⭑⭑ THE PRODUCER IS THE MODEL THAT ANSWERED, NOT THE JUDGE. This read
					// `resolveJudgeModel()` — it labelled the PRODUCING model with the REVIEWING model's id, so
					// `checkIndependence('DIFFERENT_MODEL', …)` compared a string with itself and could only
					// refuse. The outcome now carries who actually produced the work product.
					producerModelId: tryOutcome.producer.modelId,
					producerProviderId: tryOutcome.producer.providerId,
					// ⭑ THE PRODUCER'S OWN ACCOUNT, forwarded to the reviewer. Undefined when the model did not
					// declare one — a recorded shortfall, never a synthesized summary.
					...(tryOutcome.rationale ? { rationale: tryOutcome.rationale } : {}),
					// ⛔ OFF BY DEFAULT. The sponsor's model puts the loop's state on the PRODUCER — *"the
					// component responsible for tracking or remembering how it responded to the various
					// feedback"* — and the paper's deployed pipeline does the same: the judge's reason is
					// appended to the GENERATOR's prompt and the judge re-scores each draft cold. Supplied
					// here only when a deployment has explicitly chosen otherwise.
					...(reviewSeesPriorFindings() && priorFindings.length
						? { priorGaps: priorFindings.map((f) => `${f.code}: ${f.statement}`) }
						: {})
				},
				uiSession(),
				{
					artifacts: getArtifactStore(),
					now: hostNow,
					newId: mintUiId,
					criteria: reasoningReviewCriteria(uiSession())
				}
			);
			if (review.satisfied) break;

			// ⭑ THE OPEN-FINDING COUNT IS THE REMEDIATION'S OWN, not a severity cut I invented here. That set
			// is already filtered to valid SUBJECT findings, never operational failures.
			openPerTry.push(review.remediation.findings.length);
			const trend = classifyTrend(openPerTry);
			const gate = mayRetry(attempt, trend);

			// ⛔ `autoRefine` IS THE GUARD THAT DECIDES WHETHER THERE IS ANYTHING TO SEND BACK AT ALL. An
			// INCONCLUSIVE review — *the reviewer could not tell* — sets it false, because feeding that back
			// as though it were a critique would MANUFACTURE WORK FROM SILENCE (`REG-D-059`, `ASR-11` limb 1).
			if (!review.remediation.autoRefine || !gate.retry) {
				loopEnded = review.remediation.autoRefine
					? `${gate.reason} Trend after ${attempt} ${attempt === 1 ? 'try' : 'tries'}: ${trend}.`
					: `The review did not produce findings that may be sent back to the producer (${review.remediation.action}).`;
				break;
			}
			priorFindings = review.remediation.findings.map((f) => ({
				code: f.code,
				statement: f.statement
			}));
		}
	} finally {
		// ⚠ RELEASED WHEN THE UNIT STOPS BEING WORKED ON — satisfied, escalated, or out of tries — and in
		// a `finally` so a refusal mid-loop cannot strand a live session.
		producer.dispose();
	}

	// ── ⭐⭐ JAN-EXEC PHASE 5 — THE EVIDENCE JOIN: every command the host ran becomes a governed object ──
	//
	// ⛔ UNTIL THIS BLOCK, `proposedEvidenceIds` WAS THE LITERAL `[]` ON EVERY PATH IN THIS FILE, and the
	// exit code of a model-run test suite existed NOWHERE after the turn ended — `ProcessRunOutcome.
	// retention` had no production consumer and the tool-call observer drops everything but a name and an
	// outcome. So a step could run a test suite and complete with no governed trace that it had.
	//
	// ⭐ `R18`: EVERY COMPLETED RUN, TYPED `OBSERVATION`. This host cannot tell `npm test` from `ls` —
	// `run_command` is one tool name for every command and the argv was chosen by an untrusted party — so
	// it records what it CAN say. ⛔ Including runs `R17` will BLOCK: minting only the ones that would
	// pass would let a step complete as though a killed command never happened.
	//
	// ⚠ THE JOIN RUNS EVEN WHEN THE WORK-PRODUCT FLOOR REFUSED, and that is deliberate. A command that
	// ran is a FACT about the world; whether the step may COMPLETE is a judgement about that fact. It is
	// the same argument `PER-9` makes for not rolling the artifact back when the floor refuses it.
	const observedRuns = producer.processRuns();
	const join = await joinProcessEvidence(
		{
			runs: observedRuns.runs,
			// ⭑ THE PRODUCING MODEL'S EXCHANGE (`R15`). A child process has no exchange; what
			// `traceComplete` verifies is the record of the turn in which the model DECIDED to run this.
			exchange: (getObject(getEngine(), outcome.exchangeId) ?? {}) as never,
			producingPrompt: outcome.prompt,
			producerModelId: outcome.producer.modelId,
			producerProviderId: outcome.producer.providerId,
			// ⭐ `R15`'s INDEPENDENT HALF — the adapter's own observation, not the model's word (§22.1).
			observedToolCalls: governedToolCallReport(producer.lastTurnObservation()),
			...(outcome.rationale ? { rationale: outcome.rationale } : {}),
			scope: `commands run by the executing model for work unit ${pwuId}`,
			tenantPrefix: EXECUTION_TENANT_PREFIX,
			// ⭐ P7-6R RD6 — and each command's evidence names the same attempt, in its content reference.
			producingExecutionAttemptId: attemptKey
		},
		uiSession(),
		{
			artifacts: getArtifactStore(),
			now: hostNow,
			newId: mintUiId,
			criteria: reasoningReviewCriteria(uiSession()),
			// ⚠ ONE COMMAND PER CALL, THROUGH THE SAME `runSteps` THE REST OF THIS ACTION USES, so a
			// refusal anywhere rolls the whole action back (`SPEC-001-INV-14`). A module reaching for the
			// engine directly would commit evidence this path's own failure arm could not undo.
			propose: (evidenceId, payload) =>
				runSteps([['ProposeEvidence', 'EVIDENCE', evidenceId, payload]]),
			getObject: (id) => getObject(getEngine(), id) as Record<string, unknown> | undefined
		}
	);
	if (join.refusedBecause)
		return fail(400, {
			error: `The model ran ${observedRuns.observedCount} command(s) and one could not be recorded as evidence: ${join.refusedBecause}`
		});

	// ── ⛔ AND NOW THE FLOOR DECIDES, WHICH IS THE WHOLE POINT ─────────────────────────────────────
	//
	// `floor-gate.ts:30` — `AI_STEP_TYPES = new Set(['MODEL_INVOCATION'])` — makes this step AI-produced
	// BY CONSTRUCTION, and the recorded provenance names an AGENT, so signal 0 fires too. Completing it
	// therefore requires the three floor policies SATISFIED against the produced artifact.
	//
	// ⭑ THIS GATE HAS NEVER FIRED IN THIS DEMO, because nothing was ever AI-executed: the existing
	// lifecycle step is a TRANSFORMATION a human drove, and its own comment says so. The first genuine
	// model-executed work unit is the first thing to meet it.
	//
	// ⛔ NOTHING HERE WEAKENS IT. A refusal is reported with its reason and the step stays RUNNING; the
	// exchange and the work product are already recorded, so what happened is on the record and what is
	// owed is legible. Making the demo pass by relaxing the gate would defeat the system's central claim.
	const completed = runSteps([
		[
			'CompleteExecutionStep',
			'EXECUTION_PLAN',
			planId,
			{
				executionStepId: stepId,
				executionAttemptId: attemptId,
				resultStatus: 'SUCCEEDED',
				// ⭑ AN ACTUAL OUTPUT, WHERE THE DEMO HAS ONLY EVER RECORDED `noOutputResult`.
				outputArtifactIds: [artifactId],
				// ⭐⭐ PHASE 5 — AND NOW EVERY COMMAND THE MODEL RAN, EACH WITH ITS OWN FLOOR ALREADY
				// RECORDED. `completeExecutionStep` unions this with `outputArtifactIds` and loops the floor
				// gate over EVERY member at its own store-derived version — so naming an id whose floor is
				// missing does not weaken the gate, it REFUSES the completion. That is why the join runs first.
				proposedEvidenceIds: join.joined.map((j) => j.evidenceId),
				detectedAssumptionIds: [],
				structuredResult: {},
				// ⛔ THE MODEL IS THE EXECUTOR. The TRANSFORMATION path below records the human who
				// clicked, correctly — a human drove it. Recording a human here would be a fiction, and
				// the assurance floor is entitled to know which it was.
				executionProvenance: {
					// ⭑ THE MODEL THAT ACTUALLY ANSWERED. This read `resolveJudgeModel()` — the REVIEWER's
					// model — so the execution provenance credited the judge with doing the work. The same
					// fiction `JAN-TOOLSUITE` removed from the floor, surviving one layer over because
					// nothing read this field back.
					executedBy: modelExecutedBy(outcome.producer.modelId)
				}
			}
		],
		chg(pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', 'UNASSESSED', 'PRESERVED', [planId])
	]);
	if (completed) {
		// ⭐ P7-6R R-1b (RD2) — the refused completion leaves the step and the unit WAITING for a person (`waitForAPerson`).
		const waited = waitForAPerson(
			pwuId,
			planId,
			stepId,
			[
				...(review.satisfied
					? []
					: [
							{
								subjectId: artifactId,
								unsatisfied: review.dispositions.filter((d) => d.disposition !== 'SATISFIED')
							}
						]),
				...join.joined
					.filter((j) => !j.satisfied)
					.map((j) => ({ subjectId: j.evidenceId, unsatisfied: j.unsatisfiedPolicies }))
			],
			completed
		);
		return fail(400, {
			error: (review.satisfied
				? // ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — AND WHEN THE WORK PRODUCT PASSED BUT A COMMAND'S RESULT DID NOT, THE COMMAND
					// EVIDENCE'S OWN REFUSAL (`describeRefusedEvidence`), BEFORE THE ENGINE'S TEXT. The two reviews are independent
					// calls, so the work product can pass while a command's result is escalated or rejected; this arm printed only
					// the engine's text, whose fallback is `policyId=disposition` (design G5) — no observation, and beside an
					// escalation no sentence saying what it asks (the ER-1 app verifier's MAJOR 1, its probe `ER1-VP1`). ⭑ The
					// same hand-over as the arm below, so one reader splits both; with nothing refused this message is unchanged.
					`The model ran, its work product is recorded, and the assurance floor is satisfied — but the step still did not complete${describeRefusedEvidence(join.joined) ? ` — and the command evidence did not pass its own floor: ${describeRefusedEvidence(join.joined)}` : '.'} ${completed}`
				: // ⭑ THE REVIEW RAN AND DID NOT PASS. That is a JUDGEMENT about the work, not a missing
					// check, and the two must not read the same. The findings are surfaced; feeding them back
					// to the producing model is REG-D-059's ruling and needs the loop bound, which is the
					// next increment — so this one stops at surfacing and says so.
					// ⭑ AND IT SAYS WHY THE LOOP STOPPED, not merely that it did. `REG-D-059` bounds the
					// repair loop and escalates at the bound; an operator reading this needs to know
					// whether the producer ran out of tries, stalled, or made things worse.
					// ⭐ `JAN-SELRES` RS-3 (`REG-F-469`) — THE TRIES THAT RAN, NO MORE. On this arm every try was unsatisfied,
					// and each pushed its count onto `openPerTry` before the loop decided to stop, so its length IS the
					// number of tries. This read `openPerTry.length + 1`: a single review said "2 tries", and a try is a
					// billed call. `begin-execute-try-count.test.ts` holds it against the EXECUTION exchanges recorded.
					// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — AND BESIDE AN ESCALATED REVIEW'S OBSERVATIONS, WHAT THE ESCALATION ASKS
					// (`escalatedReviewNote`): routed to a human reviewer, whose review this workbench cannot record yet
					// (`REG-F-474`). Keyed on the classifier's ACTION, never on prose; the command evidence's refusal carries
					// its own (`describeRefusedEvidence`), on this arm and on the satisfied arm above.
					// `begin-execute-escalated-review.test.ts` holds both arms, and the satisfied work product beside an
					// escalated command result.
					// ⭐ `JAN-ESCREC` D3 — AND OBSERVATIONS THAT HOLD NO FINDING SAY SO, NAMING WHAT REFUSED (`noFindingNote`, keyed
					// on the codes): the recommendation alone was all this arm printed of a review left INCONCLUSIVE by an
					// unanswered criterion, and INCONCLUSIVE was named nowhere (the second fix round's re-verifier's finding [0]).
					// ⛔ Never an ESCALATED review's: the sentence after it explains that one, so the note is keyed on the action too.
					`The model ran, its work product was reviewed over ${openPerTry.length} ${openPerTry.length === 1 ? 'try' : 'tries'}, and the assurance floor is NOT satisfied: ${review.observations.map((o) => `${o.code}: ${o.statement}`).join(' | ') || completed}${noFindingNote(review.observations, review.dispositions, review.remediation.action)}${escalatedReviewNote(review.remediation.action)}${loopEnded ? ` — ${loopEnded}` : ''}${describeRefusedEvidence(join.joined) ? ` — and the command evidence did not pass its own floor: ${describeRefusedEvidence(join.joined)}` : ''}`) +
				// ⚠ A WAIT THAT COULD NOT BE RECORDED IS SAID, never swallowed: the unit is then left as K1 left it.
				(waited ? ` — and the wait for a person’s choice could not be recorded: ${waited}` : '')
		});
	}
	return { advanced: 'executed' };
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

		// ── ⭑ JAN-EXECRUN XR-03 — DOES THIS WORK UNIT'S TYPE SAY HOW ITS WORK IS ATTEMPTED? ─────────────────
		//
		// A type carrying an ACTIVE prompt template declares agent behaviour, and the step that discharges it is
		// a MODEL_INVOCATION — which is what `StepTypeSchema`'s first member has meant since it was generated,
		// and what Guide §:1137 defines a step to BE.
		//
		// ⛔ NO TEMPLATE MEANS NO SUBSTITUTION. A type without one declares no agent behaviour — true of every
		// type authored before `REG-D-058` — and the demo keeps its existing TRANSFORMATION lifecycle for those,
		// unchanged. Inventing a prompt so every work unit LOOKS executable is the defect `REG-F-351` refuses.
		// ⭐⭐ `JAN-ASSERTED` `R30` — `getObjectOfType`, NOT `getObject`, AND THE REPOSITORY SAID SO IN TERMS.
		// `queries.ts` warns on `getObject`: *"⚠ TYPE-BLIND — see `getObjectOfType` above before using this with
		// an id that arrives from outside the system."* `pwuId` arrives from the request. `getObjectOfType` was
		// already imported in this file and already used for the undertaking seven hundred lines up.
		const pwu = getObjectOfType(getEngine(), 'PROFESSIONAL_WORK_UNIT', pwuId);
		const pwuTypeId = String((pwu?.pwuTypeId ?? '') as string);
		const pwuType = pwuTypeId ? getObjectOfType(getEngine(), 'PWU_TYPE', pwuTypeId) : undefined;
		// ⭐ PARSED, NOT ASSERTED (`REG-F-411`). This read `pwuType?.promptTemplate as PromptTemplate | undefined`
		// — a whole strict structured object, asserted — and `prompt-render.ts` then does
		// `new Set(template.declaredPlaceholders)`. ⛔ A wrong shape there is a **TypeError, not a refusal**: the
		// surface 500s and the record says nothing about why. `resolvePwuTypeFacts` makes it a stated refusal
		// that names the type.
		const typeFacts = resolvePwuTypeFacts(
			(id) => getObjectOfType(getEngine(), 'PWU_TYPE', id),
			pwuTypeId || undefined
		);
		// ⭐ P7-6R — the template is read where it is used, in `runModelUnit`, which a re-run of the work runs too.
		// ⭑ JAN-DISCHARGE — DECLARED, NOT SNIFFED. This read `template?.status === 'ACTIVE'`, which inferred a
		// decision from an artefact: a type became model-executed because someone happened to arm a prompt. The
		// type now SAYS who does its work, and `checkDischargeCoherence` keeps the two from disagreeing — an
		// ACTIVE template on a non-MODEL type is refused at the handler, so this single read is sufficient.
		const isModelStep = pwuType?.workDischarge === 'MODEL';

		// ── ⭐ `JAN-SELREV` SR-1 (D5) — A MODEL STEP IS REFUSED BEFORE PAID WORK WHEN ITS REVIEWER CANNOT RUN ────────
		//
		// ⛔ THE WORK PRODUCT OF A MODEL STEP IS JUDGED BY THE MANDATORY REASONING REVIEW, and until this line a
		// misconfigured reviewer was discovered only when that review ran — after the batch below had started the step
		// and the executor had been opened and paid for. When the fault was devin's missing model it was worse: the
		// floor registry THREW at build, out of the loop's try/finally, leaving the step RUNNING (`REG-F-457` G3, G5).
		// ⭑ So the selector the floor registry reads is asked HERE, before anything is dispatched: a refusal returns
		// its guidance and the work unit stays as it was. The authoring route asks the same preflight (`REG-F-443`).
		// ⚠ A TRANSFORMATION STEP runs no reviewer — the operator completes it — so it is never refused here.
		// ⚠ WHAT THIS CANNOT SEE: a devin configured but unusable — not on the server's PATH, not signed in (inferred,
		// untested), or run from an untrusted directory — is found at the first review and RECORDED there, after the
		// paid work.
		if (isModelStep) {
			const reviewer = assurancePreflight({ testMode: isTestMode() });
			if (!reviewer.ready) return fail(400, { error: reviewer.guidance });
		}

		// ── ⭐ `JAN-SELRES` RS-1 (D4) — AND ITS EXECUTOR IS SELECTED HERE, ONCE, BEFORE ANYTHING IS DISPATCHED ──────────
		//
		// ⛔ THE EXECUTOR'S CONFIGURATION USED TO BE READ IN THREE PLACES, NONE OF THEM BEFORE DISPATCH: `model.ts` chose
		// the fixture on its own load-time test-mode constant, `agyPrint` read the JUDGE model at call time, and Pi's
		// opener read `JPWB_EXECUTOR_MODEL` — so an unset or unknown tool, devin (declared, unwired) and an unset model
		// were all found when the executor OPENED, after the batch below had started the step, and recorded as a
		// started-then-failed step (design §2 G3). ⭑ Now the selector is asked HERE, after the reviewer, in the mode the
		// host runs in: a refusal returns its reason and guidance and the work unit stays as it was.
		// ⭑ THE ONE SELECTION then opens the executor and names the record's fallback identity (below), so the model
		// configured, the model run and the model recorded are one read.
		// ⚠ A TRANSFORMATION STEP asks neither selector — the operator completes it.
		// ⚠ DEFINITE, NOT OPTIONAL — `outcome`'s idiom below: assigned for exactly the steps the model branch runs.
		let executor!: RunnableExecutorSelection;
		if (isModelStep) {
			const selected = selectExecutor({ testMode: isTestMode() });
			if (selected.kind === 'REFUSED') return fail(400, { error: executorRefusalMessage(selected) });
			executor = selected;
		}

		// ── ⭑⭑ JAN-EXECGOV EG-02 — `STA-8` STOPS BEING UNMET ────────────────────────────────────────────────
		//
		// *"Execution requires an approved plan and AUTHORIZED RUNTIME BINDINGS."* `REG-F-365` measured zero
		// production dispatches of `RequestRuntimeBinding`, so every step took `OUT_OF_SCOPE` and the binding
		// checks — live and tested — were unreachable on real work. This is the first production binding.
		//
		// ⚠ ONLY FOR A MODEL STEP. A TRANSFORMATION needs no network and gets no binding, which keeps
		// `OUT_OF_SCOPE` reachable — the kernel records that collapsing it makes every plan in the reference
		// seed permanently unstartable.
		const bindingId = mintUiId('bind');
		const binding = stepBindingFor(
			isModelStep ? 'MODEL_INVOCATION' : 'TRANSFORMATION',
			pwuType?.workDischarge as string | undefined,
			bindingId,
			stepId
		);

		const err = runSteps([
			['BeginPwuShaping', PWU, pwuId, {}],
			// ⭑ BEFORE THE PLAN. `ProposeExecutionPlan` REFUSES a step naming a binding that was requested for a
			// different step (`execution.ts:246`), so the binding must exist first — and it must be AUTHORIZED,
			// because `STA-8` says authorized, not merely requested.
			...(binding
				? ([
						// ⭑ `binding.request` AND NOT `binding`. JAN-EXEC Phase 3 gave the binding a second field — the
						// REQUIRES/USES needs the request was derived FROM — and `RequestRuntimeBindingPayloadSchema` is a
						// `z.strictObject`, so dispatching the whole object is REFUSED by the command bus. The request half
						// IS the payload, proved at compile time in `step-binding.ts`, so there is no projection to write.
						['RequestRuntimeBinding', 'RUNTIME_BINDING', bindingId, binding.request],
						[
							'AuthorizeRuntimeBinding',
							'RUNTIME_BINDING',
							bindingId,
							// ⚠ THE DEMO GRANTS EVERYTHING THE STEP ASKED FOR, AND THAT IS A DEMO POSTURE RATHER THAN A RULE.
							// `grantedWithinRequest` forbids granting MORE; nothing obliges granting ALL, and the precision
							// control this phase turns on — `file-system` granted, `process-execution` withheld — is exactly a
							// narrower grant. This surface has no authorizer UI to express one, so it authorizes the full
							// request and the narrowing is driven at the seam instead.
							{ grantedCapabilities: [...binding.request.requestedCapabilities] }
						]
					] satisfies Step[])
				: []),
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
							stepType: isModelStep ? 'MODEL_INVOCATION' : 'TRANSFORMATION',
							// ⭑ THE STEP NAMES ITS BINDING, which is what makes `bindingAuthorityVerdict` resolve
							// something other than OUT_OF_SCOPE for the first time in production.
							...(binding ? { runtimeBindingId: bindingId } : {}),
							purpose: isModelStep
								? `Attempt the work described by ${pwuTypeId}'s prompt template`
								: 'Produce the PWU output',
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
			[
				'ActivateExecutionPlan',
				'EXECUTION_PLAN',
				planId,
				// ⚠ NOW A TRUE STATEMENT RATHER THAN AN EMPTY ONE. ⛔ The REFUSAL keyed on this list stays
				// WITHDRAWN — `REG-005` records it as *"an UNRECOVERABLE WEDGE whose refusal message prescribed a
				// remedy the engine categorically forbids"*, because a plan cannot be re-activated to repair
				// itself. Populating the field makes the plan's own declaration accurate; it does not revive the
				// refusal, and a step with no binding still activates with an empty list exactly as before.
				{ authorizedRuntimeBindingIds: binding ? [bindingId] : [] }
			],
			chg(pwuId, 'READY', 'PLANNED', 'PLANNED', 'UNASSESSED', 'PRESERVED', [planId]),
			chg(pwuId, 'PLANNED', 'EXECUTING', 'QUEUED', 'UNASSESSED', 'PRESERVED', [planId]),
			['StartExecutionStep', 'EXECUTION_PLAN', planId, { stepId }],
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', 'UNASSESSED', 'PRESERVED', [planId])
		]);
		if (err) return fail(400, { error: `Execution failed: ${err}` });

		// ⭐ `JAN-EXEC` P7-6R — THE MODEL'S PART RUNS IN `runModelUnit`, which a person's re-run of the work runs too (RD5,
		// RD8): one loop, one floor, one join and one refusal-to-wait path for both, never a second copy of any of them.
		if (isModelStep)
			return runModelUnit({
				pwuId,
				planId,
				stepId,
				attemptId,
				binding,
				bindingId,
				executor,
				pwu,
				pwuType,
				pwuTypeId,
				typeFacts
			});

		const legacy = runSteps([
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
					// The operator who drove the demo lifecycle really did execute this step — so the record names
					// the authenticated session, not the `ui-user` literal that used to stand in for it.
					executionProvenance: { executedBy: actingActor(uiSession()) }
				}
			],
			// Earned, and cited: the plan whose step actually succeeded now backs executionState=SUCCEEDED.
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', 'UNASSESSED', 'PRESERVED', [planId])
		]);
		if (legacy) return fail(400, { error: `Execution failed: ${legacy}` });
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
	// JAN-EXECPLAN-DR-003 DWP-02/03 — the terminal step-lifecycle actions.
	//
	// ⚠ THIS ACTION USED TO SEND `mandatory: false` ON EVERY SKIP (REG-F-105, ruled REG-D-041). The comment it
	// carried claimed "the UI never silently skips a mandatory step" — and the line beneath it declared every step
	// the UI skipped to be optional, which is the only way the claim could be false. The surface was exempting its
	// own output, one layer above the handler that was doing the same thing.
	//
	// It now sends the stepId alone. Whether the step may be skipped is `ExecutionStep.strength`, declared by the
	// plan author and read by the engine from the approved plan; a MANDATORY or CONDITIONAL step is REFUSED, and the
	// refusal names the declared strength and the two lawful routes (an authorized waiver/revision, or a plan
	// revision declaring the step ADVISORY — itself a governed act). A SKIPPED step is terminal-success, so the
	// start-gate advances. Cancel is CLEANUP (permitted even post-supersession). Both dispatch one allowlisted
	// command; a rejection surfaces verbatim, and for the first time that rejection is informative.
	skipStep: async ({ request }) => {
		const f = await request.formData();
		return dispatchResult('SkipExecutionStep', str(f, 'planId'), { stepId: str(f, 'stepId') });
	},
	cancelStep: async ({ request }) => {
		const f = await request.formData();
		// ⛔ `P76F-A` A5 — NOT on a step awaiting a person's choice (`stepActOnAwaitedChoice`): cancelled, it would leave the unit
		// WAITING with no step to choose on. Abandoning the unit cancels it, in the person's Decision's batch.
		const awaited = stepActOnAwaitedChoice(uiSession(), str(f, 'planId'), str(f, 'stepId'), 'cancel');
		if (awaited) return fail(400, { error: awaited });
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
		// ⛔ `P76F-A` A5 — NOT on a step awaiting a person's choice (`stepActOnAwaitedChoice`): resumed, it would run with nothing
		// to run it, the unit still WAITING. A re-run is the way on, and it is the person's Decision.
		const awaited = stepActOnAwaitedChoice(uiSession(), str(f, 'planId'), str(f, 'stepId'), 'resume');
		if (awaited) return fail(400, { error: awaited });
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
				: // The HUMAN arm is the session itself. The AGENT arm above stays a DECLARED third party on purpose:
					// it is the demo's way of saying "a model produced this output", and that actor is genuinely
					// not the operator pressing the button. Only the arm that claims to be the operator is derived.
					{ executedBy: actingActor(uiSession()) };
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
	// ── THE EVIDENCE STAGE, THROUGH THE BROWSER (JAN-SLICE-SWP-06) ────────────────────────────────────────────
	//
	// ⚠ WHAT WAS ACTUALLY MISSING, MEASURED RATHER THAN ASSUMED. F-4 recorded that the three evidence commands
	// appear ZERO times under `apps/rph-demo` — true, and re-driven before this was written (positive control:
	// `CreatePwa` 5 files, `PromoteBaseline` 2, `AbandonPwu` 2). But the MECHANISM is narrower and worth naming:
	// `driveAssessmentToAssessing`, which this workbench already calls, ALREADY dispatches
	// `SubmitEvidenceForAssessment` — for every member of an OPTIONAL `evidence` argument that
	// `assurancePrelude` never passed. So the loop ran zero times, and the surface signed work off with
	// `claimIds: []` and `evidenceConsideredIds: []`. **The absent thing was one defaulted argument, not a
	// missing pathway** — which is why this change is three actions and a reuse, not a new subsystem.
	//
	// ⚠ AND THE ORDER IS THE ENGINE'S, NOT A PREFERENCE. `AdmitEvidence` carries an `admissibilityAssessmentId`
	// — the reference undertaking passes the assessment that will consider the evidence — so the assessment
	// must EXIST before evidence can be admitted to it. The ratified sequence is therefore
	// Request -> Propose -> Admit -> Submit -> Begin, and `proposeEvidence` opens the assessment for exactly
	// that reason rather than because opening it there is tidy.
	proposeEvidence: async ({ request }) => {
		const form = await request.formData();
		const pwuId = String((form.get('pwuId') ?? '') as string).trim();
		const evidenceType = String((form.get('evidenceType') ?? '') as string).trim();
		const scope = String((form.get('scope') ?? '') as string).trim();
		const contentUri = String((form.get('contentUri') ?? '') as string).trim();
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		if (!evidenceType) return fail(400, { error: 'Choose the kind of evidence.' });

		// ⚠ NOT VALIDATED HERE: an empty `scope` or a blank content reference is passed STRAIGHT TO THE ENGINE,
		// deliberately. `evidenceAdmissibility` refuses admission on `SCOPE_STATED`, `CONTENT_AVAILABLE` and
		// `PROVENANCE_PRESENT`, and duplicating those checks in the surface would make the operator's experience
		// depend on a second copy of the rule that could drift from the first. The surface's job is to let the
		// professional act; the ratified predicate's job is to refuse. `S-01`'s clause S-b drives that refusal
		// through the browser and asserts the ENGINE's own message.
		// (An earlier draft of this line cited a "U-4 clause" that has never existed in any Slice.)
		const steps: Step[] = [];
		let assessmentId = pendingAssessmentFor(pwuId);
		if (!assessmentId) {
			assessmentId = mintUiId('asm');
			steps.push(...openAssessmentFor(pwuId, assessmentId));
		}
		const evidenceId = mintUiId('evd');
		steps.push([
			'ProposeEvidence',
			'EVIDENCE',
			evidenceId,
			{
				evidenceId,
				evidenceType,
				contentReference: contentUri ? { uri: contentUri } : {},
				// The REAL session actor, not a literal. `evidenceAdmissibility`'s PROVENANCE_PRESENT limb reads
				// this field through `namesAnActor` (REG-F-008), so a placeholder here would be refused at
				// admission — correctly, and confusingly.
				producedBy: actingActor(uiSession()),
				supportsClaimIds: [],
				contradictsClaimIds: [],
				scope,
				limitations: [],
				capturedAt: hostNow()
			}
		]);
		const err = runSteps(steps);
		if (err) return fail(400, { error: `Proposing evidence failed: ${err}` });
		return { advanced: 'evidence-proposed' };
	},

	admitEvidence: async ({ request }) => {
		const form = await request.formData();
		const evidenceId = String((form.get('evidenceId') ?? '') as string).trim();
		const pwuId = String((form.get('pwuId') ?? '') as string).trim();
		if (!evidenceId || !pwuId) return fail(400, { error: 'Missing evidence or PWU.' });
		const assessmentId = pendingAssessmentFor(pwuId);
		if (!assessmentId)
			return fail(400, {
				error: 'No open assessment to admit this evidence to. Propose evidence first.'
			});
		const ev = getObject(getEngine(), evidenceId);
		const err = runSteps([
			[
				'AdmitEvidence',
				'EVIDENCE',
				evidenceId,
				{
					// The assessment that judged admissibility — the same shape the reference undertaking uses.
					admissibilityAssessmentId: assessmentId,
					// The scope ADMITTED is the scope CLAIMED, and they are the same field on purpose: RPH-EVD-004
					// is about evidence used beyond its scope, so narrowing it here without the operator saying so
					// would silently rewrite what they attested to.
					admittedScope: String((ev?.scope ?? '') as string),
					admittedClaimIds: []
				}
			]
		]);
		if (err) return fail(400, { error: `Admission refused: ${err}` });
		return { advanced: 'evidence-admitted' };
	},

	submitEvidence: async ({ request }) => {
		const form = await request.formData();
		const evidenceId = String((form.get('evidenceId') ?? '') as string).trim();
		const pwuId = String((form.get('pwuId') ?? '') as string).trim();
		if (!evidenceId || !pwuId) return fail(400, { error: 'Missing evidence or PWU.' });
		const assessmentId = pendingAssessmentFor(pwuId);
		if (!assessmentId)
			return fail(400, { error: 'No open assessment to submit this evidence to.' });
		const err = runSteps([
			[
				'SubmitEvidenceForAssessment',
				'ASSURANCE_ASSESSMENT',
				assessmentId,
				{
					evidenceId,
					// ⚠ THE REQUIREMENT ID, NOT THE CRITERION ID — DIFFERENT NAMESPACES, AND THE HANDLER SAYS SO:
					// *"The required set is EvidenceRequirement ids while evidenceId is an Evidence OBJECT id —
					// different namespaces, so the binding is explicit, never inferred from proximity."* A first
					// draft of this action passed `criteria[0].id` (`DEMO-01`), which would have been refused by
					// the fail-closed declared-requirement check on every submission.
					satisfiesRequirementId: DEMO_EVIDENCE_REQUIREMENT_ID
				}
			]
		]);
		if (err) return fail(400, { error: `Submission failed: ${err}` });
		return { advanced: 'evidence-submitted' };
	},

	recordAssurance: async ({ request }) => {
		// The engine handle is no longer read here: `assurancePrelude` owns the policy/§30 setup both assurance
		// arms share, and reaches for it itself.
		const pwuId = await pwuIdFrom(request);
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		// ── REUSE THE ASSESSMENT THE EVIDENCE WAS SUBMITTED TO (JAN-SLICE-SWP-06) ─────────────────────────────
		//
		// ⚠ WITHOUT THIS THE EVIDENCE SURFACE WOULD BE DECORATIVE, AND THAT IS THE FAILURE MODE WORTH NAMING.
		// The operator submits evidence to an open assessment; this action used to mint a SECOND, FRESH
		// assessment and complete THAT — so the sign-off would have been reached by an assessment that never saw
		// the evidence, while the evidence sat against one that was never completed. Both objects would exist,
		// both acts would have happened, and the surface would look evidenced while being exactly as unevidenced
		// as before.
		//
		// ⚠ AND THE ELSE-BRANCH IS BYTE-IDENTICAL TO THE OLD BEHAVIOUR. With no open assessment — which is every
		// existing path, since nothing else opens one — this mints an id and calls `assurancePrelude` exactly as
		// it always did, with an empty considered-set. So no existing spec changes meaning.
		const pending = pendingAssessmentFor(pwuId);
		const assessmentId = pending ?? mintUiId('asm');
		const considered = pending ? evidenceSubmittedTo(pending) : [];
		// The OPERATOR's own sign-off under the demo policy: independence NONE, the operator is the reviewer, and
		// the policy says so. That act is unchanged — it is a real judgement by a real party about work they did.
		const evaluator = actingActor(uiSession());

		// ── ⭐⭐ THE INDEPENDENT REVIEW OF WHAT THIS PWU ACTUALLY DECLARES (`R22`, design §4.15) ─────────────
		//
		// ⛔ WITHOUT THIS THE SURFACE ASSESSED ONE POLICY THE PWU DOES NOT DECLARE AND CLAIMED SATISFACTION OF THE
		// FOUR IT DOES. `RPH-PWU-007`'s §28.2 fold now refuses that, correctly — the refusal naming each silent
		// policy is what opened this phase.
		//
		// ⚠ AND IT IS ISSUED BY THE REVIEWER, NOT NAMED BY THE OPERATOR: the reviewer's commands go out under the reviewer's
		// own credential (`runMultiParty`). ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; `REG-D-110` (3); `REG-D-111`;
		// `DESIGN-phase-7-completion.md` B1–B3, B6, B7) — AND NOW IT JUDGES: ~~`actingActor(reviewerSession())` reads the
		// identity off the SAME authenticated session… `producer` is the operator~~ each governing declared policy is
		// REVIEWED, one review per policy, by the reviewer the floor's own selector selects, over the unit's work product and
		// commands (its children's, for a unit composed of others); each criterion is recorded, and the verdict is computed
		// from the answers. The evaluator recorded is WHO JUDGED; the producer is ~~WHO DID THE WORK~~ the unit's OWN executor
		// (`REG-F-514`) — ⛔ `E12F` F9: who did the judged work for a phase only; for the root it is the operator, while the
		// work judged is its children's (`declaredReviewWorkOf`).
		const engine = getEngine();
		// READ, not assumed. `REG-F-109` says a PWU's semanticVersion cannot move, which makes the literal `1`
		// this surface uses elsewhere correct today — but the guard that reads it (`declaredPolicyVerdicts`)
		// compares against the STORE, and an assessment pinned to the wrong version is silently STALE rather
		// than loudly wrong. One read costs nothing and cannot rot.
		const subjectSemanticVersion = engine.loadObject(pwuId)?.semanticVersion ?? 1;
		const governing = governingDeclaredPolicies(engine, pwuId);
		{
			// ⛔ REFUSED BEFORE ANYTHING IS DISPATCHED — ⭐ E2: AND BEFORE ANY REVIEW IS ASKED FOR — which is what
			// `SPEC-001-INV-14` deserves rather than a rollback after the fact. A policy whose §6.1 evidence gates EVERY
			// positive disposition cannot be concluded in this PWU's favour at all, and that is knowable from the policy
			// object alone: a review of it would be a paid call whose verdict could never be recorded.
			//
			// ⚠ THE OPERATOR GETS THE REASON, NOT THE SYMPTOM. Left to the kernel, the refusal would arrive as
			// `RPH-PWU-007`'s §28.2 fold — *"a policy this PWU itself declares has not been satisfied"* — which
			// is true and names the silence rather than the evidence that is missing.
			const unsatisfying = evidenceRefusals(governing.policies);
			if (unsatisfying.length > 0)
				return fail(400, {
					error:
						`The independent review cannot conclude in favour of this PWU: ` +
						unsatisfying.map((u) => `${u.policyId} reaches ${u.disposition}`).join('; ') +
						`. A positive disposition cannot stand with unmet mandatory evidence (DOC-004 §10.3), so ` +
						`this PWU cannot be recorded SATISFIED until that evidence is supplied.`
				});
		}
		// ⭐ E2 — THE REVIEWS, ASKED BEFORE ANYTHING IS DISPATCHED, as Begin & Execute asks its reviewer (`JAN-SELREV` SR-1, D5):
		// a reviewer that cannot run refuses here, in its own words, with nothing recorded; and a unit whose work the record
		// cannot rebuild refuses here too (RD7's rule: no review of a partial reconstruction).
		let producer: ActorReference = evaluator;
		let answers: ReadonlyMap<string, DeclaredPolicyAnswer> = new Map();
		let invocations: ReadonlyMap<string, string> = new Map();
		if (governing.policies.length > 0) {
			const declaredReviewReady = assurancePreflight({ testMode: isTestMode() });
			if (!declaredReviewReady.ready) return fail(400, { error: declaredReviewReady.guidance });
			const work = await declaredReviewWorkOf(pwuId, evaluator);
			if (!work.ok)
				return fail(400, { error: `The declared policies cannot be reviewed: ${work.refusedBecause}` });
			producer = work.work.producer;
			({ answers, invocations } = await reviewDeclaredPolicies(
				pwuId,
				governing.policies,
				work.work,
				subjectSemanticVersion
			));
		}
		const review = planDeclaredSignoff({
			engine,
			pwuId,
			subjectSemanticVersion,
			operator: evaluator,
			producer,
			answers,
			invocations,
			// ⭐ `REG-D-071` Q5 — the engine this records into decides whether a stipulated answer counts, as its Gate E does.
			admitStipulatedAnswers: engine.admitStipulatedAnswers,
			evidenceConsideredIds: considered,
			mintId: mintUiId
		});
		const folded = review.foldedAssuranceState;

		const err = runMultiParty(review.steps, [
			// A pending assessment has already been REQUESTED, so re-running the prelude would attempt a second
			// `RequestAssuranceAssessment` on a live aggregate and CONFLICT. It needs only the two acts that
			// remain before a verdict: who is assessing, and the start of the assessment itself.
			...(pending
				? ([
						['SelectAssuranceEvaluator', 'ASSURANCE_ASSESSMENT', pending, { evaluator }],
						['BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', pending, {}]
					] as Step[])
				: assurancePrelude(pwuId, assessmentId)),
			[
				'CompleteAssuranceAssessment',
				'ASSURANCE_ASSESSMENT',
				assessmentId,
				{
					validatorResult: demoValidatorResult(
						assessmentId,
						pwuId,
						'SATISFIED',
						evaluator,
						considered
					),
					producer: evaluator
				}
			],
			// ⭐ E2 (`REG-D-111` (3)) — a policy demanding a HUMAN evaluator: the OPERATOR's decision, issued by the operator.
			...(review.humanSteps as Step[]),
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
			// The only guarded hop: assuranceState=SATISFIED must cite the SATISFIED assessments covering this PWU.
			//
			// ⭐ ALL OF THEM, NOT THE FIRST. `earnAssurance` records why it returns every assessment it created:
			// *"a caller that goes on to promote a baseline must cite the assessments that permitted the
			// satisfaction — ALL of them"*, because naming 1 of 4 leaves the promotion gate verifying a single
			// policy's verdict while the others go unnamed at the one moment the corpus asks for them (§24).
			//
			// ⛔ AND THE AXIS IS THE FOLD, NOT THE CONSTANT `SATISFIED` THIS LINE USED TO CARRY. Four of the
			// ontology's fifteen PWU kinds declare policies with §6.1 required evidence this workbench does not
			// have (13 requirements for `INTENT_AND_PRODUCT_DEFINITION` alone), so their honest verdict is
			// CONDITIONALLY_SATISFIED and the PWU's axis must say so. Asserting SATISFIED over a conditional
			// verdict is refused by `RPH-PWU-007` — correctly — and would have left the operator unable to
			// record the state their assurance genuinely reached.
			// ⭐ E2 — THE FOLD CAN NOW BE AGAINST THE WORK, and each arm says what it is:
			//   · REJECTED (`REG-D-111` (1)) — ~~canon's route~~ ⛔ `E12F` F8: THE FIRST HALF OF CANON'S ROUTE, AND A DEPARTURE FROM
			//     ITS SECOND. The blocking findings are recorded above, and the unit's ASSURANCE axis is REJECTED, citing the
			//     REJECTED verdicts and those findings; canon's route goes on `UNDER_ASSURANCE → REJECTED` on the work LIFECYCLE,
			//     and this does not: the unit's lifecycle STAYS `UNDER_ASSURANCE`. Kept on purpose, because that hop is a
			//     governance act (an EFFECTIVE REJECTION Decision, `resolveRejectAuthorization`) a reviewer's verdict does not
			//     make, and its recovery — *"Replacement PWU created → SUPERSEDED"* — is NOT BUILT (reported: in the paid run a
			//     declared refusal is reported, not recovered). The person may still reject the unit, citing the blocking
			//     finding (the row's Reject). ⚠ The departure is the lead's to record in the register.
			//   · INCONCLUSIVE — no hop: it is not a value of the unit's assurance axis (`pwu.ts`), so the unit stays ASSESSING
			//     with the verdicts recorded; nothing here recovers it (reported).
			...declaredHop(pwuId, folded, [assessmentId, ...review.assessmentIds], review)
		]);
		if (err) return fail(400, { error: `Assurance failed: ${err}` });
		// ⭐⭐ E2 (design B3) — A VERDICT AGAINST THE WORK IS RECORDED, THEN REPORTED: the batch committed it (a paid review's
		// record is owed, PER-9), and the operator is told what the reviews concluded — never told the unit is assured.
		const against = unsatisfyingReviews(review);
		if (against.length > 0)
			return fail(400, {
				error:
					`Assurance recorded, and the declared review did not conclude in this PWU's favour: ` +
					against.map((u) => `${u.policyId} reached ${u.disposition}`).join('; ') +
					`. The verdicts are computed from the reviewer's criterion answers (REG-D-110 (3)); ` +
					(folded === 'REJECTED'
						? `a REJECTED verdict is recorded with its blocking findings, and this PWU's assurance is REJECTED (REG-D-111 (1)); its work lifecycle stays under assurance.`
						: `a verdict that did not conclude leaves this PWU under assessment.`)
			});
		return { advanced: 'assured' };
	},

	// ── ⭐⭐ `E12F` F3 — RE-RUN THE DECLARED REVIEWS THAT DID NOT CONCLUDE (`REG-D-112` (a); `REG-D-104` (1); `REG-D-105` (3)) ────────
	//
	// ⛔ ONE INCONCLUSIVE DECLARED VERDICT STRANDED ITS UNIT: the fold is no value of the assurance axis, so the unit stayed
	// UNDER_ASSURANCE and ASSESSING — Record Assurance is offered only while EXECUTING, and P7-6R's re-run reaches a unit
	// WAITING after a refused step, never one under assurance. The person's choice, as P7-6R records one:
	//   · ONLY THE DECLARED REVIEWS WHOSE LATEST VERDICT IS INCONCLUSIVE are re-run (`declaredRerunOffer`): one that concluded
	//     keeps its verdict, and a declared REJECTED is never re-reviewed (`REG-D-105` (3)) — it goes canon's route.
	//   · EACH A NEW ASSESSMENT, the old one kept (`planDeclaredSignoff`'s `onlyPolicyIds`), its reviewer asked BEFORE anything
	//     is dispatched, as Record Assurance asks it, and its calls recorded whatever the batch then does (PER-9).
	//   · THE PERSON'S DECISION, in the same batch: their rationale VERBATIM, then the decision cited (`REG-D-112` (a)); its
	//     subjects the unit and the INCONCLUSIVE assessments re-run, its observations theirs. ⚠ `REPLAN` is P7-6R's type for a
	//     re-run of a review; nothing here revises a plan, and the decision types name no re-assessment (the lead's to rule).
	//   · THE UNIT FOLDED AFTER IT over every governing policy's latest verdict (`foldAfterRerun`) — ⭐ E12's re-review F3: a
	//     policy never assessed among them, folding as one that did not conclude: a positive fold its assurance hop, citing
	//     those verdicts; a REJECTED canon's first half, as Record Assurance takes it; INCONCLUSIVE no hop — the unit stays
	//     under assessment, and the person is told which policy holds it there.
	rerunDeclaredReviews: async ({ request }) => {
		const f = await request.formData();
		const pwuId = str(f, 'pwuId');
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		const rationale = str(f, 'rationale');
		if (!rationale) return fail(400, { error: DECLARED_RERUN_RATIONALE_REQUIRED });
		const engine = getEngine();
		const offer = declaredRerunOffer(engine, pwuId);
		if ('refusedBecause' in offer)
			return fail(400, { error: `Re-running the declared reviews refused: ${offer.refusedBecause}` });
		const ready = assurancePreflight({ testMode: isTestMode() });
		if (!ready.ready) return fail(400, { error: ready.guidance });
		const operator = actingActor(uiSession());
		const work = await declaredReviewWorkOf(pwuId, operator);
		if (!work.ok) return fail(400, { error: `The declared policies cannot be reviewed: ${work.refusedBecause}` });
		const subjectSemanticVersion = engine.loadObject(pwuId)?.semanticVersion ?? 1;
		const { answers, invocations } = await reviewDeclaredPolicies(pwuId, offer.policies, work.work, subjectSemanticVersion);
		const rerun = planDeclaredSignoff({
			engine,
			pwuId,
			subjectSemanticVersion,
			operator,
			producer: work.work.producer,
			answers,
			invocations,
			admitStipulatedAnswers: engine.admitStipulatedAnswers,
			mintId: mintUiId,
			onlyPolicyIds: new Set(offer.policies.map((p) => p.policyId))
		});
		const folded = foldAfterRerun(rerun, offer.others);
		const rerunIds = new Set(offer.inconclusive.map((v) => v.assessmentId));
		const considered = listByType(engine, 'ASSURANCE_OBSERVATION')
			.filter((o) => rerunIds.has(String((o.state.assessmentId ?? '') as string)))
			.map((o) => o.id);
		const refused = runMultiParty(rerun.steps, [
			...personsDecision(
				mintUiId('dec'),
				'REPLAN',
				RERUN_DECLARED_REVIEWS,
				[pwuId, ...offer.inconclusive.map((v) => v.assessmentId)],
				considered,
				decisionRationale(rationale, RERUN_DECLARED_REVIEWS_CITATION)
			),
			...(rerun.humanSteps as Step[]),
			...declaredHop(pwuId, folded, [...rerun.assessmentIds, ...offer.others.flatMap((v) => v.assessmentId ?? [])], rerun)
		]);
		if (refused) return fail(400, { error: `Re-running the declared reviews failed: ${refused}` });
		const against = unsatisfyingReviews(rerun);
		if (against.length > 0)
			return fail(400, {
				error:
					`The declared reviews were re-run, and did not conclude in this PWU's favour: ` +
					against.map((u) => `${u.policyId} reached ${u.disposition}`).join('; ') +
					`. Each is a new assessment, the old one kept (REG-D-112 (a)); ` +
					(folded === 'REJECTED'
						? `a REJECTED verdict is recorded with its blocking findings, and this PWU's assurance is REJECTED (REG-D-111 (1)); its work lifecycle stays under assurance.`
						: `a verdict that did not conclude leaves this PWU under assessment, and its re-run is offered again.`)
			});
		// ⛔ E12's re-review F3 — A FOLD THE RE-RUN'S OWN VERDICTS DO NOT EXPLAIN: each concluded in the PWU's favour, and the
		// unit did not hop, because a governing policy NOT re-run has no verdict that concluded — never assessed, or still in
		// progress. The re-run is recorded, and the person is told which policy holds the unit under assessment, never that the
		// unit advanced.
		if (folded !== 'SATISFIED' && folded !== 'CONDITIONALLY_SATISFIED')
			return fail(400, {
				error:
					`The declared reviews were re-run, and each concluded in this PWU's favour; but ` +
					offer.others
						.filter((v) => v.state !== 'SATISFIED' && v.state !== 'CONDITIONALLY_SATISFIED')
						.map((v) =>
							v.state === NEVER_ASSESSED
								? `${v.policyId} was never assessed`
								: `${v.policyId}'s latest verdict did not conclude (${v.state})`
						)
						.join('; ') +
					`: this PWU's assurance folds every governing policy's latest verdict, so it stays under assessment (REG-D-112 (a)).`
			});
		return { advanced: 'declared-reviews-rerun' };
	},

	// ── THE ADVERSE ARM: RECORD A BLOCKING FINDING (S-1b / B-2) ────────────────────────────────────────────────
	//
	// ⚠ WHY THIS EXISTS AT ALL. `RejectPwu` requires a real ASSURANCE_OBSERVATION of BLOCKING or CRITICAL severity
	// naming the PWU — and `RecordAssuranceObservation` was dispatched ZERO times anywhere in this app. **The
	// workbench could sign work off and could not fault it.** Rejection was therefore unreachable, and the
	// tempting fix — letting `rejectPwu` mint its own observation in the same batch — is MANUFACTURING THE
	// GUARD'S OWN INPUT (REG-F-022's Gate A: "the logic is right and its population is supplied by the party it
	// judges"). It would have been green, reachable, and worth nothing.
	//
	// So the finding is recorded HERE, as an ASSURANCE act, at the assurance surface, in its own transaction —
	// and rejection later FINDS it. Two acts, minuted separately: INV-5 (exec ≠ assurance) applied to the surface,
	// and the same shape as REG-F-106's ruling that an authorization is minted beside its object and found by the
	// gate that needs it.
	//
	// ⚠ AND THE OPERATOR DOES NOT CHOOSE THE DISPOSITION. They supply a STATEMENT — a professional judgement about
	// the work. `REJECTED` is not this action's opinion: with a BLOCKING observation open, DOC-004 §10.3's Gate C
	// REFUSES every other disposition (see `demo-policy.ts`'s `forbiddenOpenSeverities`, and
	// `blocking-finding-forecloses-signoff.test.ts` which drives that refusal). The professional judges; the
	// ratified ladder disposes.
	recordBlockingFinding: async ({ request }) => {
		const form = await request.formData();
		const pwuId = String((form.get('pwuId') ?? '') as string).trim();
		const statement = String((form.get('statement') ?? '') as string).trim();
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		// A finding with no statement is not a judgement, it is a refusal to say why — and `statement` is the only
		// part of this act a later reader can use. Refused here rather than stored empty (OBJ-1).
		if (!statement)
			return fail(400, {
				error: 'A blocking finding must say what is wrong — the statement is the finding.'
			});
		const assessmentId = mintUiId('asm');
		const observationId = mintUiId('obs');
		// Independence NONE on this policy, and it is disclosed there: the operator IS the reviewer, so the
		// evaluator must be the real session or the assessment records a judgement by nobody.
		const evaluator = actingActor(uiSession());
		const err = runSteps([
			...assurancePrelude(pwuId, assessmentId),
			// The observation is its OWN aggregate carrying `assessmentId` as a reference — not a write to the
			// assessment. Severity BLOCKING is what `hasBlockingObservationFor` will later read off the STORED
			// object; `RejectPwu` never takes severity from its own payload.
			[
				'RecordAssuranceObservation',
				'ASSURANCE_OBSERVATION',
				observationId,
				{
					assessmentId,
					observationType: 'FINDING',
					findingCode: DEMO_FINDING_CODE,
					severity: 'BLOCKING',
					statement
				}
			],
			[
				'CompleteAssuranceAssessment',
				'ASSURANCE_ASSESSMENT',
				assessmentId,
				{
					validatorResult: demoValidatorResult(assessmentId, pwuId, 'REJECTED', evaluator),
					producer: evaluator
				}
			],
			// The PWU reaches UNDER_ASSURANCE and STOPS THERE, carrying assuranceState REJECTED. It does not move to
			// workLifecycleState REJECTED: §8.2's "UNDER_ASSURANCE --Blocking finding--> REJECTED" is a GOVERNANCE
			// act needing an EFFECTIVE REJECTION Decision (resolveRejectAuthorization), which is a different act by
			// a possibly different party. Doing it here would collapse the assurance judgement and the governance
			// decision into one click — the collapse this whole increment exists to avoid.
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
			chg(pwuId, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED', 'PRESERVED', [
				assessmentId,
				observationId
			])
		]);
		if (err) return fail(400, { error: `Recording the finding failed: ${err}` });
		return { advanced: 'faulted' };
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
	},

	// ── ⭐⭐ `JAN-EXEC` P7-6R R-1c — RE-RUN THE REVIEW (`DESIGN-the-stopped-unit-recovery.md` RD3, RD4, RD5, RD7; `REG-D-104` (1);
	// `REG-D-105` (3)) ───────────────────────────────────────────────────────────────────────────────────────────────────
	//
	// A person's choice on a unit waiting after a review that DID NOT CONCLUDE: the floors run again over the refused
	// attempt's recorded work product and evidence, and NO PRODUCER RUNS. The new attempt is plan B's one step, an
	// `ASSURANCE_INVOCATION`, whose input is that work product; B completes NAMING it, and the FLOOR GATE judges the new
	// assessments: it reads the latest per policy by `updatedAt` (`latestAssessmentByPolicy`), and they are recorded
	// later than the refused ones.
	// ⚠ `P76F-A` A6 — THAT HOLDS FOR THE GATE ALONE. ~~"later in time … and so the ones it reads (RD10,
	// `REG-F-433`)"~~: RD10 struck its line that a re-review "is later in time, so it does not tie". ~~`REG-F-433`'s reader
	// (`loadReviewerAnswer`) sorts by `attemptOrdinal` alone, a re-review's first try is ordinal 1 like the original's,
	// so the two TIE and the OLDER answer is returned; and the run report pairs a review with its answers by subject.~~
	// Both were B7's, `REG-F-433`'s join key — ⭐ landed (P7-6 B7, merged with `P76F-C`): the run report pairs each review
	// with the calls of its own floor run, by the token its assessment carries; the reader reads the run whose token the
	// review it is shown beside carries (C2).
	// ⛔ REFUSED AFTER A REVIEW THAT CONCLUDED — against the work, or escalated — BY THE SERVER, not only by the page
	// (`REG-D-105` (3); `rerunReviewRefusal`): the latest assessment wins, so a re-review run until one said SATISFIED would
	// clear a reasoned refusal.
	// ⛔ `P76F-A` A4 — AND AFTER A REFUSAL ONLY A DIFFERENT OR RE-QUALIFIED REVIEWER CAN FIX (a substituted model, a reviewer
	// not independent of the producer): the same reviewer would be billed again, and refused the same way.
	// ⛔ AND REFUSED, WITH NOTHING DISPATCHED AND THE UNIT STILL WAITING, WHEN ANY PART THE FLOOR NEEDS CANNOT BE REBUILT FROM
	// THE RECORD (RD7): the producing prompt, the rationale, the producer's identity, each command's run. It never reviews a
	// partial reconstruction.
	// ⚠ B's STEP REQUESTS NO RUNTIME BINDING, departing from RD5 item 5 on purpose: a binding grants an EXECUTOR's
	// capabilities, minted as the producer's tools, and a review step opens no executor — a grant there would be a record
	// nobody exercises. A step naming no binding is `OUT_OF_SCOPE` to the binding limb, as a TRANSFORMATION step is.
	// ⚠ ONLY THE REFUSED REVIEWS RUN AGAIN. A subject whose floor was SATISFIED keeps it: re-running it can only spend a call.
	rerunReview: async ({ request }) => {
		const f = await request.formData();
		const pwuId = str(f, 'pwuId');
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		const rationale = str(f, 'rationale');
		if (!rationale) return fail(400, { error: RATIONALE_REQUIRED });
		const stopped = stoppedUnitOf(uiSession(), pwuId);
		if (!stopped.ok)
			return fail(400, { error: `Re-running the review refused: ${stopped.refusedBecause}` });
		const s = stopped.unit;
		const notOffered = rerunReviewRefusal(s);
		if (notOffered) return fail(400, { error: `Re-running the review refused: ${notOffered}` });
		// ⭐ THE REVIEWER IS ASKED BEFORE ANYTHING IS DISPATCHED, as Begin & Execute asks it (`JAN-SELREV` SR-1, D5): a re-review
		// IS the reviewer's run, so one that cannot run refuses here, in its own words, and the unit keeps waiting.
		const reviewReady = assurancePreflight({ testMode: isTestMode() });
		if (!reviewReady.ready) return fail(400, { error: reviewReady.guidance });

		// ── RD7 — EVERYTHING THE FLOOR NEEDS, REBUILT AND CHECKED BEFORE ANYTHING IS DISPATCHED ──────────────────────
		const rebuilt = await rebuildForReview(s);
		if (!rebuilt.ok)
			return fail(400, {
				error: `The review cannot be re-run, and the unit keeps waiting: ${rebuilt.refusedBecause}`
			});
		const { turn, runs } = rebuilt;

		// ── RD4 + RD5 — THE PERSON'S DECISION AND THE PLAN REVISION, ONE BATCH ────────────────────────────────────────
		const decisionId = mintUiId('dec');
		const planB = mintUiId('plan');
		const stepB = mintUiId('step');
		const revised = runSteps([
			...personsDecision(
				decisionId,
				'REPLAN',
				RERUN_REVIEW,
				decisionSubjects(s),
				s.consideredObservationIds,
				// ⭐ `P76F-A` A3 (RD4) — the person's words, then the ruling that authorises a re-run of the review.
				decisionRationale(rationale, RERUN_REVIEW_CITATION)
			),
			...planRevision(s, decisionId, planB, {
				id: stepB,
				stepType: 'ASSURANCE_INVOCATION',
				purpose: `Re-run the review of work product ${s.workProductId}, which attempt ${s.attemptKey} produced; no producer runs`,
				inputBindings: [{ artifactId: s.workProductId, required: true }]
			})
		]);
		if (revised) return fail(400, { error: `Re-running the review refused: ${revised}` });

		// ── THE FLOORS, AGAIN, OVER WHAT WAS REFUSED — each through the run Begin & Execute uses for its kind ─────────
		const opts = {
			artifacts: getArtifactStore(),
			now: hostNow,
			newId: mintUiId,
			criteria: reasoningReviewCriteria(uiSession())
		};
		const outcomes: {
			readonly subjectId: string;
			readonly floor: Awaited<ReturnType<typeof runWorkProductFloor>>;
		}[] = [];
		for (const r of s.refusals) {
			const producing = {
				exchange: turn.exchange,
				producingPrompt: turn.producingPrompt,
				producerModelId: turn.producerModelId,
				producerProviderId: turn.producerProviderId,
				...(turn.rationale ? { rationale: turn.rationale } : {})
			};
			const floor =
				r.objectType === 'ARTIFACT'
					? await runWorkProductFloor(
							{ artifactId: r.subjectId, artifact: turn.artifact, answer: turn.answer, ...producing },
							uiSession(),
							opts
						)
					: await runProcessResultFloor(
							{
								evidenceId: r.subjectId,
								evidence: getObject(getEngine(), r.subjectId) ?? {},
								run: runs.get(r.subjectId)!,
								...(turn.observedToolCalls ? { observedToolCalls: turn.observedToolCalls } : {}),
								...producing
							},
							uiSession(),
							opts
						);
			outcomes.push({ subjectId: r.subjectId, floor });
		}

		// ── B COMPLETES NAMING A's WORK PRODUCT AND EVIDENCE, AND THE UNIT SUCCEEDS CITING B ───────────────────────────
		// ⭑ The output was made by the model in attempt A (RD6), so the provenance says so: MODEL_GENERATION, the model, and
		// the attempt — the reuse a DBOS fork would record (the design's §6).
		const completed = runSteps([
			[
				'CompleteExecutionStep',
				'EXECUTION_PLAN',
				planB,
				{
					executionStepId: stepB,
					executionAttemptId: mintUiId('attempt'),
					resultStatus: 'SUCCEEDED',
					outputArtifactIds: [s.workProductId],
					proposedEvidenceIds: [...s.evidenceIds],
					detectedAssumptionIds: [],
					structuredResult: {},
					executionProvenance: {
						originType: 'MODEL_GENERATION',
						producingExecutionAttemptId: s.attemptKey,
						executedBy: modelExecutedBy(turn.producerModelId)
					}
				}
			],
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', 'UNASSESSED', 'PRESERVED', [planB])
		]);
		if (completed) {
			// ⭐ REFUSED AGAIN: B's step waits as A's did (RD5), and the person chooses again.
			const refused = outcomes.filter((o) => !o.floor.satisfied);
			const waited = waitForAPerson(
				pwuId,
				planB,
				stepB,
				refused.map((o) => ({
					subjectId: o.subjectId,
					unsatisfied: o.floor.dispositions.filter((d) => d.disposition !== 'SATISFIED')
				})),
				completed
			);
			return fail(400, {
				error:
					`The review was re-run, and the assurance floor is NOT satisfied: ` +
					(refused
						.map(
							(o) =>
								`${o.subjectId}: ${o.floor.observations.map((ob) => `${ob.code}: ${ob.statement}`).join(' | ') || 'no observation recorded'}` +
								noFindingNote(o.floor.observations, o.floor.dispositions, o.floor.remediation.action) +
								escalatedReviewNote(o.floor.remediation.action)
						)
						.join(' — ') || completed) +
					(waited ? ` — and the wait for a person’s choice could not be recorded: ${waited}` : '')
			});
		}
		return { advanced: 'review-rerun' };
	},

	// ── ⭐⭐ `JAN-EXEC` P7-6R R-1c — RE-RUN THE WORK WITH THE FINDINGS (RD4, RD5, RD8; `REG-D-104` (1)) ──────────────────────
	//
	// A person's choice on any waiting unit: plan B's one step is a producer step, as Begin & Execute builds one, its binding
	// requested and authorized, and it runs `runModelUnit` — the producer loop, the floor, the join, the completion and the
	// wait — in a FRESH session whose first turn carries the instruction AND the refused review's SUBJECT findings (RD8).
	// ⛔ Nothing from a review that did not conclude, and never the escalation itself (`REG-D-059`, `REG-D-090`): the
	// findings are the floor classifier's, which lists neither.
	// ⭑ The reviewer and the executor are asked BEFORE anything is dispatched, as Begin & Execute asks them (`JAN-SELREV`
	// SR-1, `JAN-SELRES` RS-1): a refusal leaves the unit waiting, with nothing recorded.
	rerunWork: async ({ request }) => {
		const f = await request.formData();
		const pwuId = str(f, 'pwuId');
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		const rationale = str(f, 'rationale');
		if (!rationale) return fail(400, { error: RATIONALE_REQUIRED });
		const stopped = stoppedUnitOf(uiSession(), pwuId);
		if (!stopped.ok) return fail(400, { error: `Re-running the work refused: ${stopped.refusedBecause}` });
		const s = stopped.unit;
		// ⛔ `P76F-A` A4 — REFUSED BY THE SERVER, not only withheld by the page, after a refusal only a different or re-qualified
		// reviewer can fix (`rerunWorkRefusal`): the new work would be reviewed by the reviewer just refused — another billed
		// call, refused the same way. Nothing is dispatched, and the unit keeps waiting.
		const workNotOffered = rerunWorkRefusal(s);
		if (workNotOffered) return fail(400, { error: `Re-running the work refused: ${workNotOffered}` });
		const { pwu, pwuType, pwuTypeId, typeFacts } = unitTypeOf(pwuId);
		if (pwuType?.workDischarge !== 'MODEL')
			return fail(400, {
				error: `Re-running the work refused: work unit ${pwuId}’s type does not say a model does its work.`
			});
		const reviewerReady = assurancePreflight({ testMode: isTestMode() });
		if (!reviewerReady.ready) return fail(400, { error: reviewerReady.guidance });
		const chosen = selectExecutor({ testMode: isTestMode() });
		if (chosen.kind === 'REFUSED') return fail(400, { error: executorRefusalMessage(chosen) });

		const decisionId = mintUiId('dec');
		const planB = mintUiId('plan');
		const stepB = mintUiId('step');
		const bindB = mintUiId('bind');
		const binding = stepBindingFor(
			'MODEL_INVOCATION',
			pwuType.workDischarge as string,
			bindB,
			stepB
		);
		const revised = runSteps([
			...personsDecision(
				decisionId,
				'REPLAN',
				RERUN_WORK,
				decisionSubjects(s),
				s.consideredObservationIds,
				// ⭐ `P76F-A` A3 (RD4) — the person's words, then the ruling that authorises a re-run of the work. ⭐ `P76F-C` C5 —
				// the clause that APPLIES: after a review that concluded (against the work, or escalated) `REG-D-105` (3)'s; after
				// one that did not, `REG-D-104` (1) alone. ⛔ It cited (3)'s clause for a concluded review on every re-run.
				// ⭐⭐ `P76F-D` D1 — and after a floor policy other than the review refused the work, `REG-D-104` (1) alone: the
				// review passed that work. ⛔ The boolean (`s.kind === 'CONCLUDED' || …`) filed it as a review that concluded, so
				// its Decision cited (3)'s clause *"after a review that concluded against the work"* (`rerunWorkAfterOf`).
				decisionRationale(rationale, rerunWorkCitation(rerunWorkAfterOf(s.kind)))
			),
			...planRevision(s, decisionId, planB, {
				id: stepB,
				stepType: 'MODEL_INVOCATION',
				purpose: `Re-attempt the work in a fresh session, after attempt ${s.attemptKey} was refused`,
				inputBindings: [],
				...(binding ? { binding } : {})
			})
		]);
		if (revised) return fail(400, { error: `Re-running the work refused: ${revised}` });
		const ran = await runModelUnit({
			pwuId,
			planId: planB,
			stepId: stepB,
			attemptId: mintUiId('attempt'),
			binding,
			bindingId: bindB,
			executor: chosen,
			pwu,
			pwuType,
			pwuTypeId,
			typeFacts,
			carriedFindings: s.findings
		});
		return 'advanced' in ran ? { advanced: 'work-rerun' } : ran;
	},

	// ── ABANDON — S-1 of ROADMAP-decision-subject-scope (REG-F-077) ──────────────────────────────────────────
	//
	// Abandonment is one of the three acts JPWB-DOC-001 §5.2 reserves to Governance BY NAME, and W-1 gave it a
	// guard (`resolveAbandonAuthorization`) that demands an EFFECTIVE `ABANDON` Decision NAMING this PWU at its
	// current semantic version. Measured before this action existed: `AbandonPwu` was dispatched NOWHERE in
	// `apps/rph-demo`, so that guard had no caller from the surface and the workbench could not perform an act
	// canon reserves — while REG-F-070's residue said the reachability limb was still open.
	//
	// THE SUBJECT IS DERIVED FROM THE ROW, never picked: `subjectObjectIds: [pwuId]`. That is the design's whole
	// answer to REG-F-077 — the authorization is sited next to the object it is about, so it cannot name an
	// object the professional is not looking at.
	//
	// ⚠ ATOMIC BY CONSTRUCTION, and `runSteps` is why that is not a slogan. Propose, approve and abandon go
	// through ONE `dispatchBatch`: a partial application would leave an EFFECTIVE abandonment authority attached
	// to a PWU that was never abandoned — a standing permission nobody asked for. SPEC-001-INV-14 already
	// requires multi-command actions here to be atomic; this is that rule applied to a governance act.
	//
	// ⚠ AND NO STALENESS CASE IS OFFERED OR TESTED, deliberately (DESIGN §4). `resolveAbandonAuthorization`
	// checks the pinned version against the PWU's current one, but `bumpSemanticVersion: true` exists at exactly
	// two sites — `decomposition.ts` and `intent.ts` — and NEITHER is in `pwu.ts`, so a PWU's semanticVersion is
	// 1 at creation and never moves. That conjunct is therefore INERT on this path and no test here may pretend
	// otherwise; only the promotion path (S-0) has subjects that can version.
	abandonPwu: async ({ request }) => {
		const form = await request.formData();
		const pwuId = str(form, 'pwuId');
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		// ── ⭐ `JAN-EXEC` P7-6R R-1c — ABANDON FROM WAITING: the same path, the person's own rationale, and the waiting
		// step CANCELLED in the same batch, so the abandoned unit leaves no step waiting for a choice nobody will make.
		// ⭑ The Decision names what was refused and considers its observations (RD4), as a re-run's does. ⚠ Only for a unit
		// waiting after a refusal (its execution WAITING); any other unit abandons exactly as before.
		const waiting =
			getObject(getEngine(), pwuId)?.executionState === 'WAITING'
				? waitingStepOf(uiSession(), pwuId)
				: undefined;
		const typed = str(form, 'reason');
		if (waiting && !typed) return fail(400, { error: `Abandonment refused: ${RATIONALE_REQUIRED}` });
		// ⭐ `P76F-A` A3 (RD4) — abandoning a WAITING unit is the person's recovery choice: their words, verbatim, then the ruling
		// that authorises it. ⭑ Any other unit abandons as before (S-1): its rationale is what was given, or the default.
		const reason = waiting
			? decisionRationale(typed, ABANDON_FROM_WAITING_CITATION)
			: typed || 'The work is no longer required.';
		const stopped = waiting ? stoppedUnitOf(uiSession(), pwuId) : undefined;
		const subjects = stopped?.ok
			? decisionSubjects(stopped.unit)
			: [pwuId, ...(waiting ? [waiting.planId] : [])];
		const considered = stopped?.ok ? stopped.unit.consideredObservationIds : [];
		const decisionId = mintUiId('dec');
		const err = runSteps([
			[
				'ProposeDecision',
				'DECISION',
				decisionId,
				{
					decisionType: 'ABANDON',
					subjectObjectIds: subjects,
					selectedOption: 'Abandon this work unit',
					rationale: reason,
					// The session's own identity — `proposeDecision` refuses a declared authority that is not the
					// stamped issuer (REG-F-014), so this is the only value that can be correct.
					authority: actingActor(uiSession()),
					consideredObservationIds: [...considered]
				}
			],
			[
				'ApproveDecision',
				'DECISION',
				decisionId,
				{
					selectedOption: 'Abandon this work unit',
					rationale: reason,
					consideredEvidenceIds: [],
					consideredObservationIds: [...considered],
					// STATED, NOT OMITTED. `{}` passes the pin-agreement predicate vacuously (it filters on
					// `pinned[id] !== undefined`); the true value makes it live. Fail-closed either way, because
					// this is CHECKED against the engine's own pin and can only cause a refusal — see S-0.
					subjectSemanticVersions: { [pwuId]: 1 }
				}
			],
			...(waiting
				? ([
						[
							'CancelExecutionStep',
							'EXECUTION_PLAN',
							waiting.planId,
							{
								stepId: waiting.stepId,
								reason: `Abandoned under the person’s Decision ${decisionId} (REG-D-104 (1)).`
							}
						]
					] satisfies Step[])
				: []),
			[
				'AbandonPwu',
				PWU,
				pwuId,
				{ abandonmentDecisionId: decisionId, reasonCode: 'NO_LONGER_REQUIRED' }
			]
		]);
		if (err) return fail(400, { error: `Abandonment refused: ${err}` });
		return { advanced: 'abandoned' };
	},

	// ── REJECTION, WHICH CITES A FINDING IT DID NOT MAKE (S-1b / B-3) ──────────────────────────────────────────
	//
	// §8.2: "UNDER_ASSURANCE --Blocking finding--> REJECTED". `RejectPwu` demands BOTH an EFFECTIVE REJECTION
	// Decision naming this PWU **and** a stored ASSURANCE_OBSERVATION of BLOCKING/CRITICAL severity whose
	// subjectObjectIds include it — and the engine reads severity off the STORED OBSERVATION, never off this
	// payload.
	//
	// ⚠ WHAT THIS ACTION DELIBERATELY DOES NOT DO IS MINT THAT OBSERVATION. It could: three commands in one batch
	// would satisfy the gate and go green. That is manufacturing the guard's own input (REG-F-022 Gate A), and it
	// is the reason S-1b was deferred twice rather than shortcut. The finding is recorded EARLIER, by
	// `recordBlockingFinding`, as an assurance act in its own transaction — and this action FINDS it.
	//
	// The Decision IS minted here, atomically with the rejection, for S-1a's reason: an EFFECTIVE rejection
	// authority left standing is a permission to close someone's work later, and nothing in this surface would
	// show it. The FINDING outlives the rejection (it is the record of WHY); the AUTHORITY does not outlive its
	// use. That asymmetry is the design, not an inconsistency.
	rejectPwu: async ({ request }) => {
		const form = await request.formData();
		const pwuId = str(form, 'pwuId');
		if (!pwuId) return fail(400, { error: 'Missing PWU.' });
		const observationId = str(form, 'observationId');
		// FAIL-CLOSED ON THE SURFACE TOO. The engine would refuse an empty list, but a form that posts one is a
		// form offering an act it knows cannot be performed — REG-F-106's defect in miniature.
		if (!observationId)
			return fail(400, {
				error:
					'Rejection must cite the blocking finding it rests on — record the finding first (§8.2 "Blocking finding").'
			});
		const reason = str(form, 'reason') || 'A blocking finding stands against this work.';
		const decisionId = mintUiId('dec');
		const err = runSteps([
			[
				'ProposeDecision',
				'DECISION',
				decisionId,
				{
					decisionType: 'REJECTION',
					subjectObjectIds: [pwuId],
					selectedOption: 'Reject this work unit',
					rationale: reason,
					authority: actingActor(uiSession()),
					// The decision CITES the finding it rests on. `consideredObservationIds` is what makes the
					// governance act traceable to the assurance judgement that prompted it, rather than an
					// assertion that happens to coincide with one.
					consideredObservationIds: [observationId]
				}
			],
			[
				'ApproveDecision',
				'DECISION',
				decisionId,
				{
					selectedOption: 'Reject this work unit',
					rationale: reason,
					consideredEvidenceIds: [],
					consideredObservationIds: [observationId],
					subjectSemanticVersions: { [pwuId]: 1 }
				}
			],
			[
				'RejectPwu',
				PWU,
				pwuId,
				{
					rejectionDecisionId: decisionId,
					blockingObservationIds: [observationId],
					reasonCode: 'BLOCKING_FINDING'
				}
			]
		]);
		if (err) return fail(400, { error: `Rejection refused: ${err}` });
		return { advanced: 'rejected' };
	}
};
