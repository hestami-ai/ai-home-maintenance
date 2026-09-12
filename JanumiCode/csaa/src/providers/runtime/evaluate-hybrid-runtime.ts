import { canonicalJson, compareText, sha256 } from '../../inventory/canonical.js';
import {
	EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS,
	HYBRID_RUNTIME_FINDING_IDS,
	type AssessmentRecordedEvent,
	type AuthoringTransformationEvent,
	type DeterministicRuntimeEvent,
	type DeterministicRuntimeTraceObservation,
	type HybridRuntimeFindingId
} from './import-runtime-trace.js';
import type { ProviderEvidenceResult } from './provider-evidence.js';

export const HYBRID_RUNTIME_EVALUATION_SCHEMA_VERSION =
	'jan-csaa-hybrid-runtime-evaluation/1.0.0' as const;
export const HYBRID_RUNTIME_EVALUATOR_ID = 'jan-csaa-harmonization-hybrid-runtime' as const;
export const HYBRID_RUNTIME_EVALUATOR_VERSION = '1.0.0' as const;

export type HybridStaticCapability = 'DFG' | 'TAINT';
export type HybridStaticPrerequisiteState =
	'CONFLICTING' | 'NOT_SATISFIED' | 'SATISFIED' | 'UNSUPPORTED';
export type HybridRuntimeEvaluationStatus = 'DETECTED' | 'NOT_DETECTED' | 'NOT_RUN' | 'UNSUPPORTED';

export interface HybridStaticPrerequisite {
	readonly capability: HybridStaticCapability;
	readonly evidenceIds: readonly string[];
	readonly findingId: HybridRuntimeFindingId;
	readonly freshness: 'CURRENT' | 'STALE';
	readonly observedAt: string;
	readonly providerId: string;
	readonly state: HybridStaticPrerequisiteState;
	readonly subjectId: string;
}

export interface HybridRuntimeRowEvaluation {
	readonly datedEvidence: {
		readonly assessedAt: string;
		readonly runtimeEndedAt: string | null;
		readonly staticObservedAt: string;
	};
	readonly evidenceIds: readonly string[];
	readonly findingId: HybridRuntimeFindingId;
	readonly gateEffect: 'NONE';
	readonly rationale: string;
	readonly runtimeState: {
		readonly conflict: boolean;
		readonly conflictCodes: readonly string[];
		readonly coverage: ProviderEvidenceResult<unknown>['coverage']['state'];
		readonly freshness: ProviderEvidenceResult<unknown>['freshness']['state'];
		readonly health: ProviderEvidenceResult<unknown>['health'];
	};
	readonly staticPrerequisite: HybridStaticPrerequisite;
	readonly status: HybridRuntimeEvaluationStatus;
}

export interface HybridRuntimeEvaluationResult {
	readonly analysisAuthority: 'NONE';
	readonly evaluator: { readonly id: string; readonly version: string };
	readonly gateEffect: 'NONE';
	readonly rows: readonly HybridRuntimeRowEvaluation[];
	readonly schemaVersion: typeof HYBRID_RUNTIME_EVALUATION_SCHEMA_VERSION;
	readonly subjectId: string;
}

const STATIC_CAPABILITY: Readonly<Record<HybridRuntimeFindingId, HybridStaticCapability>> =
	Object.freeze({ 9: 'TAINT', 19: 'DFG', 45: 'DFG', 54: 'TAINT', 55: 'TAINT' });
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const TOKEN = /^[A-Za-z0-9][-A-Za-z0-9._:@/+]{0,255}$/u;

function utcTimestamp(value: string, label: string): number {
	if (!UTC_TIMESTAMP.test(value)) throw new TypeError(`${label} must be UTC ISO-8601.`);
	const milliseconds = Date.parse(value);
	if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} is invalid.`);
	const canonical = new Date(milliseconds).toISOString();
	if (value !== canonical && value !== canonical.replace('.000Z', 'Z'))
		throw new TypeError(`${label} must be canonical UTC ISO-8601.`);
	return milliseconds;
}

function validateStaticPrerequisites(
	prerequisites: readonly HybridStaticPrerequisite[],
	subjectId: string,
	assessedAtMs: number
): ReadonlyMap<HybridRuntimeFindingId, HybridStaticPrerequisite> {
	if (prerequisites.length !== HYBRID_RUNTIME_FINDING_IDS.length)
		throw new TypeError('Hybrid evaluation requires exactly five static prerequisite records.');
	const byFinding = new Map<HybridRuntimeFindingId, HybridStaticPrerequisite>();
	for (const prerequisite of prerequisites) {
		if (!HYBRID_RUNTIME_FINDING_IDS.includes(prerequisite.findingId))
			throw new TypeError('Static prerequisite finding ID is unsupported.');
		if (byFinding.has(prerequisite.findingId))
			throw new TypeError('Static prerequisite finding IDs must be unique.');
		if (prerequisite.capability !== STATIC_CAPABILITY[prerequisite.findingId])
			throw new TypeError(
				'Static prerequisite capability does not match the benchmark allocation.'
			);
		if (
			!['CONFLICTING', 'NOT_SATISFIED', 'SATISFIED', 'UNSUPPORTED'].includes(prerequisite.state) ||
			!['CURRENT', 'STALE'].includes(prerequisite.freshness)
		)
			throw new TypeError('Static prerequisite state or freshness is unsupported.');
		if (prerequisite.subjectId !== subjectId)
			throw new TypeError('Static prerequisite is bound to a different subject.');
		if (!TOKEN.test(prerequisite.providerId))
			throw new TypeError('Static prerequisite provider ID is invalid.');
		if (utcTimestamp(prerequisite.observedAt, 'Static prerequisite observedAt') > assessedAtMs)
			throw new TypeError('Static prerequisite observedAt is invalid or lies in the future.');
		if (
			prerequisite.evidenceIds.length > 1_000 ||
			new Set(prerequisite.evidenceIds).size !== prerequisite.evidenceIds.length
		)
			throw new TypeError('Static prerequisite evidence IDs are invalid.');
		for (const evidenceId of prerequisite.evidenceIds)
			if (!TOKEN.test(evidenceId) && !/^[a-f0-9]{64}$/u.test(evidenceId))
				throw new TypeError('Static prerequisite evidence ID is invalid.');
		if (
			(prerequisite.state === 'SATISFIED' || prerequisite.state === 'NOT_SATISFIED') &&
			prerequisite.evidenceIds.length === 0
		)
			throw new TypeError('Conclusive static prerequisite requires evidence.');
		byFinding.set(
			prerequisite.findingId,
			Object.freeze({
				...prerequisite,
				evidenceIds: Object.freeze([...prerequisite.evidenceIds])
			})
		);
	}
	return byFinding;
}

function defectEvidence(
	findingId: HybridRuntimeFindingId,
	events: readonly DeterministicRuntimeEvent[]
): readonly string[] {
	switch (findingId) {
		case 9:
			return events
				.filter(
					(event) =>
						event.kind === 'AUTHENTICATION_DECISION' &&
						!event.data.authenticated &&
						event.data.outcome === 'ACCEPTED' &&
						event.data.principalKind === 'HUMAN' &&
						event.data.identitySource !== 'REQUEST'
				)
				.map((event) => event.eventId);
		case 19:
			return events
				.filter(
					(event) =>
						event.kind === 'IDEMPOTENCY_REPLAY' &&
						event.data.firstRequestSha256 !== event.data.secondRequestSha256 &&
						event.data.outcome === 'PRIOR_RESULT_RETURNED'
				)
				.map((event) => event.eventId);
		case 45: {
			const transformations = events.filter(
				(event): event is AuthoringTransformationEvent =>
					event.kind === 'AUTHORING_TRANSFORMATION' && event.data.material
			);
			const assessments = events.filter(
				(event): event is AssessmentRecordedEvent => event.kind === 'ASSESSMENT_RECORDED'
			);
			const offending = new Set<string>();
			const turns = new Set(transformations.map((event) => event.data.turnId));
			for (const turnId of turns) {
				const outputs = transformations.filter((event) => event.data.turnId === turnId);
				for (const output of outputs) {
					const assessed = assessments.some(
						(event) =>
							event.data.turnId === turnId &&
							event.data.scope === 'OUTPUT' &&
							event.data.outputId === output.data.outputId
					);
					if (!assessed) offending.add(output.eventId);
				}
			}
			return [...offending].sort(compareText);
		}
		case 54: {
			const actions = events.filter((event) => event.kind === 'GOVERNANCE_ACTION');
			const evidence = new Set<string>();
			for (const proposed of actions.filter((event) => event.data.action === 'PROPOSED'))
				for (const approved of actions.filter((event) => event.data.action === 'APPROVED'))
					if (
						proposed.data.resourceId === approved.data.resourceId &&
						proposed.data.resourceKind === approved.data.resourceKind &&
						proposed.data.actorSha256 === approved.data.actorSha256
					) {
						evidence.add(proposed.eventId);
						evidence.add(approved.eventId);
					}
			return [...evidence].sort(compareText);
		}
		case 55:
			return events
				.filter(
					(event) =>
						event.kind === 'EXTERNAL_TOOL_ATTEMPT' &&
						EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS.some(
							(field) => !event.data.fieldsPresent.includes(field)
						)
				)
				.map((event) => event.eventId);
	}
}

function rowEvaluation(
	findingId: HybridRuntimeFindingId,
	prerequisite: HybridStaticPrerequisite,
	trace: ProviderEvidenceResult<DeterministicRuntimeTraceObservation>,
	assessedAt: string
): HybridRuntimeRowEvaluation {
	const runtimeState = Object.freeze({
		conflict: trace.conflicts.length > 0,
		conflictCodes: Object.freeze(
			trace.conflicts.map((conflict) => conflict.code).sort(compareText)
		),
		coverage: trace.coverage.state,
		freshness: trace.freshness.state,
		health: trace.health
	});
	const datedEvidence = Object.freeze({
		assessedAt,
		runtimeEndedAt: trace.availability === 'PRESENT' ? trace.run.endedAt : null,
		staticObservedAt: prerequisite.observedAt
	});
	const base = {
		datedEvidence,
		findingId,
		gateEffect: 'NONE' as const,
		runtimeState,
		staticPrerequisite: prerequisite
	};
	if (prerequisite.state === 'UNSUPPORTED')
		return Object.freeze({
			...base,
			evidenceIds: Object.freeze([]),
			rationale: 'The required static prerequisite capability is unsupported.',
			status: 'UNSUPPORTED'
		});
	if (prerequisite.state === 'CONFLICTING')
		return Object.freeze({
			...base,
			evidenceIds: Object.freeze([...prerequisite.evidenceIds]),
			rationale: 'Conflicting static prerequisite evidence prevents a hybrid conclusion.',
			status: 'NOT_RUN'
		});
	if (prerequisite.freshness !== 'CURRENT')
		return Object.freeze({
			...base,
			evidenceIds: Object.freeze([...prerequisite.evidenceIds]),
			rationale: 'The static prerequisite evidence is stale.',
			status: 'NOT_RUN'
		});
	if (
		trace.availability !== 'PRESENT' ||
		(trace.health !== 'HEALTHY' && trace.health !== 'PARTIAL') ||
		trace.freshness.state !== 'CURRENT' ||
		trace.conflicts.length > 0 ||
		trace.observations.length !== 1 ||
		trace.observations[0]!.missingFindingIds.includes(findingId) ||
		!trace.observations[0]!.coveredFindingIds.includes(findingId)
	)
		return Object.freeze({
			...base,
			evidenceIds: Object.freeze([...prerequisite.evidenceIds]),
			rationale: 'Current, healthy, complete runtime evidence for this row is unavailable.',
			status: 'NOT_RUN'
		});
	if (prerequisite.state === 'NOT_SATISFIED')
		return Object.freeze({
			...base,
			evidenceIds: Object.freeze([...prerequisite.evidenceIds]),
			rationale:
				'Current static evidence establishes that the required risk prerequisite is absent.',
			status: 'NOT_DETECTED'
		});
	const eventEvidence = defectEvidence(findingId, trace.observations[0]!.events);
	const evidenceIds = [...prerequisite.evidenceIds, ...eventEvidence].sort(compareText);
	return Object.freeze({
		...base,
		evidenceIds: Object.freeze(evidenceIds),
		rationale:
			eventEvidence.length > 0
				? 'Static prerequisite and current bounded runtime events jointly match the row predicate.'
				: 'Static prerequisite is present, but the complete bounded runtime population did not match the row predicate.',
		status: eventEvidence.length > 0 ? 'DETECTED' : 'NOT_DETECTED'
	});
}

export function evaluateHybridRuntimeRows(options: {
	readonly assessedAt: string;
	readonly staticPrerequisites: readonly HybridStaticPrerequisite[];
	readonly trace: ProviderEvidenceResult<DeterministicRuntimeTraceObservation>;
}): HybridRuntimeEvaluationResult {
	const assessedAtMs = utcTimestamp(options.assessedAt, 'Hybrid assessment timestamp');
	if (Date.parse(options.trace.run.endedAt) > assessedAtMs)
		throw new TypeError('Hybrid assessment predates its runtime evidence.');
	const subjectId = options.trace.subject.id;
	const prerequisites = validateStaticPrerequisites(
		options.staticPrerequisites,
		subjectId,
		assessedAtMs
	);
	const rows = HYBRID_RUNTIME_FINDING_IDS.map((findingId) =>
		rowEvaluation(findingId, prerequisites.get(findingId)!, options.trace, options.assessedAt)
	);
	return Object.freeze({
		analysisAuthority: 'NONE',
		evaluator: Object.freeze({
			id: HYBRID_RUNTIME_EVALUATOR_ID,
			version: HYBRID_RUNTIME_EVALUATOR_VERSION
		}),
		gateEffect: 'NONE',
		rows: Object.freeze(rows),
		schemaVersion: HYBRID_RUNTIME_EVALUATION_SCHEMA_VERSION,
		subjectId
	});
}

export function hybridRuntimeEvaluationDigest(result: HybridRuntimeEvaluationResult): string {
	return sha256(canonicalJson(result));
}
