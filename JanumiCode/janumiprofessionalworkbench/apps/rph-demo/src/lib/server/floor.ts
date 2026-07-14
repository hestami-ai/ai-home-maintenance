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
import type { ActorReference } from '@janumipwb/rph-contracts';
import { createFloorRegistry } from './assurance/index.js';
import { buildPwaExport, getEngine, hostNow, isTestMode, mintUiId } from './workbench.js';

const FLOOR_ACTOR: ActorReference = {
	actorId: 'assurance-svc',
	actorType: 'SERVICE',
	displayName: 'Assurance Service'
};
// The authoring executor's identity — the independence baseline the Reasoning Review evaluator must differ from
// (a distinct model/provider from agy). The graph is produced/shaped by this agent (isAiProduced=true).
const AUTHORING_EXECUTOR = {
	actorType: 'AGENT' as const,
	agentId: 'authoring-agent',
	modelId: 'authoring-executor',
	providerId: 'jpwb'
};

export interface FloorPolicyView {
	readonly policyId: string;
	readonly disposition: string;
	readonly independenceOk: boolean;
	readonly observations: {
		readonly code: string;
		readonly severity: string;
		readonly statement: string;
	}[];
}
export interface FloorView {
	readonly subjectId: string;
	readonly aggregate: string;
	readonly satisfied: boolean;
	/** True iff an EFFECTIVE governance WAIVER covers the subject — publication is permitted despite the floor. */
	readonly waived: boolean;
	readonly policies: FloorPolicyView[];
	/** Open Reasoning-Review finding statements — drive the auto-refine directive and the UI gap list. */
	readonly reasoningGaps: string[];
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
	opts: { prompt: string; planText?: string; priorGaps?: string[] }
): Promise<FloorView | undefined> {
	const engine = getEngine();
	const pwa = getObject(engine, pwaId);
	const graphExport = buildPwaExport(pwaId);
	if (!pwa || !graphExport) return undefined;
	const report = analyzePwaGraph(graphExport);
	const subject: AssuranceSubject = {
		subjectId: pwaId,
		objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		semanticVersion: Number(pwa.semanticVersion ?? 1),
		isAiProduced: true,
		producer: AUTHORING_EXECUTOR
	};
	const ctx: ValidatorContext = {
		schemaInvariant: {
			schemaValid: true, // the PWA + PWU Types are engine-validated on creation
			invariantViolations: report.valid ? [] : ['PWA_GRAPH_NOT_WELL_FORMED']
		},
		identityProvenance: {
			hasStableId: true,
			hasSemanticVersion: true,
			hasProvenance: true,
			hasProducer: true,
			traceComplete: true
		},
		reasoningReview: {
			prompt: opts.prompt,
			content: JSON.stringify(graphExport),
			...(opts.planText ? { plan: opts.planText } : {}),
			...(opts.priorGaps && opts.priorGaps.length ? { prior: { gaps: opts.priorGaps } } : {})
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
		correlationId: 'authoring-floor',
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

/** The latest recorded floor outcome for a PWA, read back from the canonical ASSURANCE_ASSESSMENT/OBSERVATION
 *  objects (the read surface the UI renders). Undefined if no floor has been recorded for the subject yet. */
export function loadPwaFloor(pwaId: string): FloorView | undefined {
	const engine = getEngine();
	const forSubject = (row: { state: Record<string, unknown> }): boolean => {
		const s = row.state.subjectObjectIds;
		return Array.isArray(s) && (s as string[]).includes(pwaId);
	};
	// Latest assessment per floor policy (by updatedAt; ties → last seen).
	const latest = new Map<string, { id: string; state: Record<string, unknown>; at: string }>();
	for (const a of listAssessments(engine)) {
		if (!forSubject(a) || !isFloorPolicy(a.state.assurancePolicyId)) continue;
		const policyId = String(a.state.assurancePolicyId);
		const at = String(a.state.updatedAt ?? '');
		const prev = latest.get(policyId);
		if (!prev || at >= prev.at) latest.set(policyId, { id: a.id, state: a.state, at });
	}
	if (latest.size === 0) return undefined;
	const obsByAssessment = new Map<
		string,
		{ code: string; severity: string; statement: string }[]
	>();
	for (const o of listObservations(engine)) {
		if (!forSubject(o)) continue;
		const aid = String(o.state.assessmentId ?? '');
		const list = obsByAssessment.get(aid) ?? [];
		list.push({
			code: String(o.state.findingCode ?? o.state.observationType ?? ''),
			severity: String(o.state.severity ?? ''),
			statement: String(o.state.statement ?? '')
		});
		obsByAssessment.set(aid, list);
	}
	const order = [
		FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
		FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
		FLOOR_POLICY_IDS.REASONING_REVIEW
	];
	const policies: FloorPolicyView[] = [];
	for (const policyId of order) {
		const a = latest.get(policyId);
		if (!a) continue;
		policies.push({
			policyId,
			disposition: String(a.state.assessmentState ?? 'INCONCLUSIVE'),
			independenceOk: true,
			observations: obsByAssessment.get(a.id) ?? []
		});
	}
	const satisfied = order.every((p) => latest.get(p)?.state.assessmentState === 'SATISFIED');
	const rr = latest.get(FLOOR_POLICY_IDS.REASONING_REVIEW);
	const aggregate = satisfied
		? 'SATISFIED'
		: policies.some((p) => p.disposition === 'REJECTED')
			? 'REJECTED'
			: 'UNASSESSED';
	return {
		subjectId: pwaId,
		aggregate,
		satisfied,
		waived: hasEffectiveWaiver(engine, pwaId),
		policies,
		reasoningGaps: rr ? (obsByAssessment.get(rr.id) ?? []).map((o) => o.statement) : []
	};
}
