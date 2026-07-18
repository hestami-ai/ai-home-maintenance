// The in-product de minimis assurance floor (guide §8.4) for the PWA authoring plane. After an authoring turn the
// server runs the ordered floor over the DRAFT PWA graph — schema/invariant + identity/provenance (deterministic) +
// an INDEPENDENT Reasoning Review (agy/Gemini in dev/prod, the structural mock under E2E; a different vendor than the
// Pi authoring executor — exec != assurance, INV-5) — and persists the outcome as canonical ASSURANCE_ASSESSMENT +
// ASSURANCE_OBSERVATION objects via the shared recorder. Nothing here self-dispositions; composeAssuranceOutcome does
// the strictest-unresolved composition, and the PublishPwa gate (rph-application) enforces it.
import { analyzePwaGraph } from '@janumipwb/rph-projections';
import {
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	type AssuranceSubject,
	type IdentityProvenanceFacts,
	type ProfessionalRationaleSummary,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import {
	getObject,
	listAssessments,
	listDecisions,
	listObservations,
	recordAssuranceRecordingPlan,
	type EngineHandle
} from '@janumipwb/rph-engine';
import type { ActorReference, AssessmentCriterion } from '@janumipwb/rph-contracts';
import { createFloorRegistry } from './assurance/index.js';
import { buildPwaExport, getEngine, hostNow, isTestMode, mintUiId } from './workbench.js';

/**
 * Read the ACTIVE `floor.reasoning-review` policy's criteria FROM THE STORE — the store→runtime content path.
 *
 * THIS FUNCTION IS THE INCREMENT. Until now the rubric and the scored criterion set both keyed off the
 * `REASONING_REVIEW_CRITERIA` constant in `rph-assurance`, so the seeded ASSURANCE_POLICY object was a
 * PROJECTION of the code: written once at seed time and never read again. Editing it would have changed the UI
 * card and nothing in the evaluation — "a policy that lies about what it checks". The constant is now only the
 * SEED; the policy object is the source.
 *
 * This lives in the composition root, not in `rph-assurance`, on purpose: that package may not import the
 * engine (the package DAG forbids it, and `boundary` enforces it), so the app reads the store and passes plain
 * data in. That is what keeps the Validator subsystem store-free while still letting the policy govern it.
 *
 * FAIL-CLOSED, and §13.3 L2227 names this case literally — "Fail closed on missing identity, tenant, POLICY,
 * schema, or authority context". A missing or empty policy must NOT silently fall back to the constant: that
 * would restore the projection at the exact moment the policy stopped being readable, which is the worst
 * possible moment. §8.4 L854 agrees — a required review that is unavailable "cannot satisfy assurance or permit
 * its protected transition".
 */
function reasoningReviewCriteria(engine: EngineHandle): readonly AssessmentCriterion[] {
	const policy = getObject(engine, FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!policy) {
		throw new Error(
			`Fail-closed (§13.3): the ${FLOOR_POLICY_IDS.REASONING_REVIEW} ASSURANCE_POLICY is not in the store, so its criteria cannot govern the review. Seed the floor policies before running the floor.`
		);
	}
	const criteria = policy.criteria;
	if (!Array.isArray(criteria) || criteria.length === 0) {
		throw new Error(
			`Fail-closed (§13.3): the ${FLOOR_POLICY_IDS.REASONING_REVIEW} policy records no criteria, so a Reasoning Review over it would assert a rubric no policy declares.`
		);
	}
	return criteria as AssessmentCriterion[];
}

const FLOOR_ACTOR: ActorReference = {
	actorId: 'assurance-svc',
	actorType: 'SERVICE',
	displayName: 'Assurance Service'
};
/** The ACTUAL producer of the graph under review. §8.12 checks independence against real model/provider identity —
 *  "not a role label such as 'Verifier'" — so this is resolved per run and never a compile-time constant. It was
 *  previously the literal `authoring-executor`, which made `checkIndependence(DIFFERENT_MODEL, …)` a comparison of
 *  two constants: it could never fail, and certified independence on every run. */
export interface FloorProducer {
	readonly agentId: string;
	readonly modelId: string;
	readonly providerId: string;
}

export interface FloorObservationView {
	readonly code: string;
	readonly severity: string;
	readonly statement: string;
}

export interface FloorPolicyView {
	readonly policyId: string;
	readonly disposition: string;
	readonly independenceOk: boolean;
	readonly observations: FloorObservationView[];
}
export interface FloorView {
	readonly subjectId: string;
	readonly aggregate: string;
	readonly satisfied: boolean;
	/** True iff an EFFECTIVE governance WAIVER covers the subject — publication is permitted despite the floor. */
	readonly waived: boolean;
	readonly policies: FloorPolicyView[];
	/** Open Reasoning-Review observation statements for display. Remediation decisions MUST use the structured
	 *  policy/observation fields above: this list also contains operational findings when review execution fails. */
	readonly reasoningGaps: string[];
}

/** The authoring-plane response to an unsatisfied floor. Only a valid Reasoning Review finding about the reviewed
 *  subject may be sent back to the producing agent. Validator availability, execution, output-boundary, and
 *  independence failures are assurance-control failures; asking the producer to edit the graph in response would
 *  hide the failed control behind unrelated semantic mutation. */
export type FloorRemediationAction =
	| 'NONE'
	| 'REFINE_SUBJECT'
	| 'RETRY_OR_CONFIGURE_REVIEWER'
	| 'CHANGE_REVIEWER'
	| 'ESCALATE_REVIEW'
	| 'RESOLVE_OTHER_FLOOR_FINDINGS';

export interface FloorRemediation {
	readonly action: FloorRemediationAction;
	readonly autoRefine: boolean;
	/** Structured, valid subject findings that may be given to the authoring agent. Never operational failures. */
	readonly findings: readonly FloorObservationView[];
	/** Human/operator guidance. The route emits this verbatim after the fail-closed floor result. */
	readonly guidance: string;
}

const OPERATIONAL_REVIEW_CODES = new Set(['VALIDATOR_EXECUTION_FAILED', 'INDEPENDENCE_VIOLATION']);

/** Classify remediation from policy identity, disposition, independence, and observation CODES — never prose.
 *
 * `VALIDATOR_EXECUTION_FAILED` covers missing host configuration and external process/provider failures alike. The
 * exact operational diagnosis remains in the recorded observation, but all such cases have the same safe authoring
 * response: preserve the subject, repair/retry/change the independent Validator, and keep publication blocked.
 */
export function classifyFloorRemediation(floor: FloorView): FloorRemediation {
	if (floor.satisfied) {
		return { action: 'NONE', autoRefine: false, findings: [], guidance: '' };
	}

	const review = floor.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!review) {
		return {
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review did not produce a policy result. Configure or register a permitted independent reviewer, then rerun assurance. Do not revise the PWA or record a waiver in response to the missing review.'
		};
	}

	const executionFailure = review.observations.some((o) => o.code === 'VALIDATOR_EXECUTION_FAILED');
	if (executionFailure) {
		return {
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review did not execute. Configure or retry the reviewer; if it remains unavailable, change to a permitted independent validator and rerun assurance. Do not revise the PWA or record a waiver in response to this execution failure.'
		};
	}

	if (
		!review.independenceOk ||
		review.observations.some((o) => o.code === 'INDEPENDENCE_VIOLATION')
	) {
		return {
			action: 'CHANGE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review was not independent of the producer. Select a permitted reviewer/model/provider that satisfies the policy independence rule, then rerun assurance. Do not revise the PWA or record a waiver in response to this independence failure.'
		};
	}

	if (review.disposition === 'ESCALATED') {
		return {
			action: 'ESCALATE_REVIEW',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review was escalated. Route the recorded review to the governed human or alternate independent-review path, then rerun assurance; an automatic subject edit cannot substitute for the escalation.'
		};
	}

	const subjectFindings = review.observations.filter((o) => !OPERATIONAL_REVIEW_CODES.has(o.code));
	if (review.disposition !== 'SATISFIED' && subjectFindings.length > 0) {
		return {
			action: 'REFINE_SUBJECT',
			autoRefine: true,
			findings: subjectFindings,
			guidance:
				'PublishPwa remains blocked while valid Reasoning Review findings are open. Revise the reviewed PWA graph and/or its recorded professional rationale as the coded findings require, then rerun assurance.'
		};
	}

	// An unsatisfied/rejected/inconclusive review with no valid subject observations is not an instruction to mutate
	// the subject. It can arise from a missing or boundary-rejected Validator result whose prose is deliberately not
	// interpreted here. Treat it as an assurance-control problem and keep the gate closed.
	if (review.disposition !== 'SATISFIED') {
		return {
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review is incomplete but produced no valid subject finding. Inspect the recorded policy result, configure or change the reviewer as needed, and rerun assurance. Do not revise the PWA or record a waiver merely to clear an incomplete review.'
		};
	}

	return {
		action: 'RESOLVE_OTHER_FLOOR_FINDINGS',
		autoRefine: false,
		findings: [],
		guidance:
			'PublishPwa remains blocked by non-review assurance findings. Resolve the coded schema, invariant, identity, or provenance findings and rerun the assurance floor.'
	};
}

/**
 * The identity/provenance/trace facts (§8.4 step 2) DERIVED from the real PWA object under review, not asserted.
 * These were five literal `true`s — a floor step that certifies itself and can never fail (findings 18/67; the
 * vacuity audit). Four are now computed: a PWA missing a stable id, a semantic version, a provenance record, or
 * an identified producer now fails IP-01/02/03/04 and blocks, as §8.4 step 2's checks require. "The engine
 * always adds provenance" is exactly the complacency the floor exists to counter — it re-checks rather than trusts.
 *
 * `traceComplete` (IP-05) stays asserted and is DISCLOSED as withheld: §8.4 step 2 names a "trace completeness"
 * check, but no ratified definition of trace-completeness exists as a computable predicate (the causal chain §5.6
 * describes is not contracted as one condition), and §0.3 forbids an agent inventing one. It becomes real the
 * moment that definition lands — the same posture as the readiness guard's withheld limbs and the waiver.
 */
export function identityProvenanceFactsOf(
	pwa: Record<string, unknown>,
	producer: FloorProducer
): IdentityProvenanceFacts {
	const id = pwa.id;
	const prov = pwa.provenance as { originType?: unknown } | undefined;
	return {
		hasStableId: typeof id === 'string' && id.length > 0,
		hasSemanticVersion: Number(pwa.semanticVersion) >= 1,
		hasProvenance: !!prov && typeof prov.originType === 'string' && prov.originType.length > 0,
		hasProducer:
			producer.agentId.length > 0 &&
			(producer.modelId.length > 0 || producer.providerId.length > 0),
		traceComplete: true // WITHHELD — no ratified trace-completeness definition; see the doc comment.
	};
}

const isFloorPolicy = (id: unknown): boolean =>
	id === FLOOR_POLICY_IDS.SCHEMA_INVARIANT ||
	id === FLOOR_POLICY_IDS.IDENTITY_PROVENANCE ||
	id === FLOOR_POLICY_IDS.REASONING_REVIEW;

/** True iff an EFFECTIVE governance WAIVER Decision covers `subjectId` (the auditable override of a blocking floor). */
function hasEffectiveWaiver(engine: EngineHandle, subjectId: string): boolean {
	return listDecisions(engine).some(
		(d) =>
			d.state.decisionType === 'WAIVER' &&
			d.state.status === 'EFFECTIVE' &&
			(d.state.subjectObjectIds as string[] | undefined)?.includes(subjectId)
	);
}

/** Run the de minimis floor over the current DRAFT PWA graph and RECORD it as canonical assessments/observations.
 *  Returns the composed view (or undefined if the PWA/graph is unavailable). `priorGaps` are surfaced to the
 *  Reasoning Review so a re-run judges whether the previous findings are genuinely resolved. */
export async function runPwaFloor(
	pwaId: string,
	opts: {
		prompt: string;
		/** REQUIRED: the actual resolved producer. An unresolved producer means §8.12 independence cannot be
		 *  established, so there is no honest default — callers must supply it or not run the floor. */
		producer: FloorProducer;
		/** The §9.7 contracted account the producer RETURNED. Undefined = it declared none; the Validator records
		 *  that shortfall rather than inferring anything from the silence. */
		rationale?: ProfessionalRationaleSummary;
		/** Exact app-local semantic hash of the PWA/PWU-Type candidate reviewed in this run. */
		candidateSubjectHash?: string;
		/** The producer's observable narration — §8.4 admits "other observable trace data". Never its interior. */
		narration?: string;
		priorGaps?: string[];
	},
	engine: EngineHandle = getEngine()
): Promise<FloorView | undefined> {
	const pwa = getObject(engine, pwaId);
	const graphExport = buildPwaExport(pwaId, engine);
	if (!pwa || !graphExport) return undefined;
	const report = analyzePwaGraph(graphExport);
	const subject: AssuranceSubject = {
		subjectId: pwaId,
		objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		semanticVersion: Number(pwa.semanticVersion ?? 1),
		isAiProduced: true,
		producer: { actorType: 'AGENT' as const, ...opts.producer }
	};
	const ctx: ValidatorContext = {
		schemaInvariant: {
			schemaValid: true, // the PWA + PWU Types are engine-validated on creation
			invariantViolations: report.valid ? [] : ['PWA_GRAPH_NOT_WELL_FORMED']
		},
		identityProvenance: identityProvenanceFactsOf(pwa, opts.producer),
		reasoningReview: {
			// The POLICY's criteria, read from the store — not a constant. See reasoningReviewCriteria().
			criteria: reasoningReviewCriteria(engine),
			prompt: opts.prompt,
			content: JSON.stringify({
				...graphExport,
				...(opts.candidateSubjectHash ? { candidateSubjectHash: opts.candidateSubjectHash } : {})
			}),
			// §8.4 orders what Reasoning Review reviews: the contracted rationale summary FIRST, then outputs and
			// tool records, then other observable trace data. Both are passed through unconditionally — §9.7
			// forbids treating presence or absence as a signal, and a constant-shape input is also what makes the
			// §14.3 ablation a real test rather than a null one.
			...(opts.rationale ? { rationale: opts.rationale } : {}),
			narration: opts.narration ?? '',
			...(opts.priorGaps?.length ? { prior: { gaps: opts.priorGaps } } : {})
		}
	};
	const plan = await runFloorAndPlanRecording(
		subject,
		ctx,
		createFloorRegistry({ testMode: isTestMode() })
	);
	recordAssuranceRecordingPlan(engine, plan, {
		actor: FLOOR_ACTOR,
		issuedAt: hostNow(),
		correlationId: opts.candidateSubjectHash
			? `authoring-floor:${opts.candidateSubjectHash}`
			: 'authoring-floor',
		idPrefix: mintUiId('floorrun'),
		newId: (prefix) => mintUiId(prefix)
	});
	const rr = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	return {
		subjectId: pwaId,
		aggregate: plan.aggregate,
		satisfied: plan.gatePermitsTransition,
		waived: hasEffectiveWaiver(engine, pwaId),
		policies: plan.assessments.map((a) => ({
			policyId: a.policyId,
			disposition: a.disposition,
			independenceOk: a.independenceOk,
			observations: a.observations.map((o) => ({
				code: o.code,
				severity: o.severity,
				statement: o.statement
			}))
		})),
		reasoningGaps: rr ? rr.observations.map((o) => o.statement) : []
	};
}

const includesSubject = (state: Record<string, unknown>, pwaId: string): boolean => {
	const s = state.subjectObjectIds;
	return Array.isArray(s) && (s as string[]).includes(pwaId);
};

interface LatestAssessment {
	readonly id: string;
	readonly state: Record<string, unknown>;
	readonly at: string;
}

/** Latest recorded floor assessment per policy for the subject (by updatedAt; ties → last seen). */
function latestFloorAssessments(
	engine: EngineHandle,
	pwaId: string
): Map<string, LatestAssessment> {
	const latest = new Map<string, LatestAssessment>();
	for (const a of listAssessments(engine)) {
		if (!includesSubject(a.state, pwaId) || !isFloorPolicy(a.state.assurancePolicyId)) continue;
		const policyId = String(a.state.assurancePolicyId as string);
		const at = String((a.state.updatedAt ?? '') as string);
		const prev = latest.get(policyId);
		if (!prev || at >= prev.at) latest.set(policyId, { id: a.id, state: a.state, at });
	}
	return latest;
}

/** Floor observations for the subject, grouped by their assessment id. */
function observationsByAssessment(
	engine: EngineHandle,
	pwaId: string
): Map<string, { code: string; severity: string; statement: string }[]> {
	const byId = new Map<string, { code: string; severity: string; statement: string }[]>();
	for (const o of listObservations(engine)) {
		if (!includesSubject(o.state, pwaId)) continue;
		const aid = String((o.state.assessmentId ?? '') as string);
		const list = byId.get(aid) ?? [];
		list.push({
			code: String((o.state.findingCode ?? o.state.observationType ?? '') as string),
			severity: String((o.state.severity ?? '') as string),
			statement: String((o.state.statement ?? '') as string)
		});
		byId.set(aid, list);
	}
	return byId;
}

/** The panel's display aggregate from the per-policy dispositions. */
function floorAggregate(satisfied: boolean, policies: FloorPolicyView[]): string {
	if (satisfied) return 'SATISFIED';
	if (policies.some((p) => p.disposition === 'REJECTED')) return 'REJECTED';
	return 'UNASSESSED';
}

/** The latest recorded floor outcome for a PWA, read back from the canonical ASSURANCE_ASSESSMENT/OBSERVATION
 *  objects (the read surface the UI renders). Undefined if no floor has been recorded for the subject yet. */
export function loadPwaFloor(
	pwaId: string,
	engine: EngineHandle = getEngine()
): FloorView | undefined {
	const latest = latestFloorAssessments(engine, pwaId);
	if (latest.size === 0) return undefined;
	const obsByAssessment = observationsByAssessment(engine, pwaId);
	const order = [
		FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
		FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
		FLOOR_POLICY_IDS.REASONING_REVIEW
	];
	const policies: FloorPolicyView[] = [];
	for (const policyId of order) {
		const a = latest.get(policyId);
		if (!a) continue;
		const obs = obsByAssessment.get(a.id) ?? [];
		policies.push({
			policyId,
			disposition: String((a.state.assessmentState ?? 'INCONCLUSIVE') as string),
			// Derived from the RECORDED violation, never asserted. This read-back path hardcoded `true`, so every
			// reader — the UI, any caller of loadPwaFloor — saw independence certified regardless of what actually
			// happened, while the run-path (runPwaFloor) carried the real value and dropped it at persistence. The
			// composer now persists an INDEPENDENCE_VIOLATION observation (§8.12), so its absence is a real signal.
			independenceOk: !obs.some((o) => o.code === 'INDEPENDENCE_VIOLATION'),
			observations: obs
		});
	}
	const satisfied = order.every((p) => latest.get(p)?.state.assessmentState === 'SATISFIED');
	const rr = latest.get(FLOOR_POLICY_IDS.REASONING_REVIEW);
	return {
		subjectId: pwaId,
		aggregate: floorAggregate(satisfied, policies),
		satisfied,
		waived: hasEffectiveWaiver(engine, pwaId),
		policies,
		reasoningGaps: rr ? (obsByAssessment.get(rr.id) ?? []).map((o) => o.statement) : []
	};
}
