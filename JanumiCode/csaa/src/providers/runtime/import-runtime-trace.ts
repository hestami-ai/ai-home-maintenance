import { canonicalJson, compareText, sha256 } from '../../inventory/canonical.js';
import {
	denseArray,
	exactRecord,
	importProviderJson,
	isSha256,
	providerArtifactPath,
	safeInteger,
	scalarString,
	type ProviderEvidenceResult,
	type ProviderImportContext,
	type ProviderNormalization
} from './provider-evidence.js';

export const DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID = 'jpwb-deterministic-runtime-trace' as const;
export const DETERMINISTIC_RUNTIME_TRACE_PROVIDER_VERSION = '1.0.0' as const;
export const DETERMINISTIC_RUNTIME_TRACE_ADAPTER_ID =
	'jan-csaa-deterministic-runtime-trace-import' as const;
export const DETERMINISTIC_RUNTIME_TRACE_ADAPTER_VERSION = '1.0.0' as const;
export const DETERMINISTIC_RUNTIME_TRACE_INPUT_SCHEMA_VERSION =
	'jan-csaa-deterministic-runtime-trace-input/1.0.0' as const;

export const HYBRID_RUNTIME_FINDING_IDS = Object.freeze([9, 19, 45, 54, 55] as const);
export type HybridRuntimeFindingId = (typeof HYBRID_RUNTIME_FINDING_IDS)[number];

export const EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS = Object.freeze([
	'ATTEMPT_ID',
	'COMMAND_IDENTITY',
	'ENVIRONMENT_IDENTITY',
	'EXIT_OUTCOME',
	'INPUT_PROVENANCE',
	'OUTPUT_VALIDATION',
	'SUBJECT_IDENTITY',
	'TIME_BOUND'
] as const);
export type ExternalToolAttemptField = (typeof EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS)[number];

interface RuntimeEventBase {
	readonly at: string;
	readonly eventId: string;
	readonly sequence: number;
}

export interface AuthenticationDecisionEvent extends RuntimeEventBase {
	readonly data: {
		readonly authenticated: boolean;
		readonly endpointId: string;
		readonly identitySource: 'FABRICATED' | 'NONE' | 'REQUEST';
		readonly outcome: 'ACCEPTED' | 'REJECTED';
		readonly principalKind: 'AGENT' | 'HUMAN' | 'SERVICE' | 'UNKNOWN';
	};
	readonly kind: 'AUTHENTICATION_DECISION';
}

export interface IdempotencyReplayEvent extends RuntimeEventBase {
	readonly data: {
		readonly firstRequestSha256: string;
		readonly idempotencyKeySha256: string;
		readonly outcome: 'CONFLICT_REJECTED' | 'NEW_EXECUTION' | 'PRIOR_RESULT_RETURNED';
		readonly secondRequestSha256: string;
	};
	readonly kind: 'IDEMPOTENCY_REPLAY';
}

export interface AuthoringTransformationEvent extends RuntimeEventBase {
	readonly data: {
		readonly material: boolean;
		readonly outputId: string;
		readonly turnId: string;
	};
	readonly kind: 'AUTHORING_TRANSFORMATION';
}

export interface AssessmentRecordedEvent extends RuntimeEventBase {
	readonly data: {
		readonly outputId: string | null;
		readonly scope: 'OUTPUT' | 'TURN';
		readonly turnId: string;
	};
	readonly kind: 'ASSESSMENT_RECORDED';
}

export interface GovernanceActionEvent extends RuntimeEventBase {
	readonly data: {
		readonly action: 'APPROVED' | 'PROPOSED';
		readonly actorSha256: string;
		readonly resourceId: string;
		readonly resourceKind: 'BASELINE' | 'DECISION' | 'WAIVER';
	};
	readonly kind: 'GOVERNANCE_ACTION';
}

export interface ExternalToolAttemptEvent extends RuntimeEventBase {
	readonly data: {
		readonly attemptId: string;
		readonly fieldsPresent: readonly ExternalToolAttemptField[];
		readonly outcome: 'CRASHED' | 'EXITED' | 'TIMED_OUT';
	};
	readonly kind: 'EXTERNAL_TOOL_ATTEMPT';
}

export type DeterministicRuntimeEvent =
	| AssessmentRecordedEvent
	| AuthenticationDecisionEvent
	| AuthoringTransformationEvent
	| ExternalToolAttemptEvent
	| GovernanceActionEvent
	| IdempotencyReplayEvent;

export interface DeterministicRuntimeTraceObservation {
	readonly artifacts: readonly {
		readonly binding: 'PROVIDER_DECLARED_DIGEST_NOT_REHASHED_BY_IMPORTER';
		readonly kind: 'ATTACHMENT' | 'REPORT' | 'TRACE';
		readonly path: string;
		readonly sha256: string;
	}[];
	readonly coveredFindingIds: readonly HybridRuntimeFindingId[];
	readonly events: readonly DeterministicRuntimeEvent[];
	readonly missingFindingIds: readonly HybridRuntimeFindingId[];
	readonly runBindingSha256: string;
}

const ROOT_KEYS = ['artifacts', 'coverage', 'events', 'runBindingSha256', 'schemaVersion'] as const;
const COVERAGE_KEYS = ['findingIds', 'missingFindingIds'] as const;
const ARTIFACT_KEYS = ['kind', 'path', 'sha256'] as const;
const EVENT_KEYS = ['at', 'data', 'kind', 'sequence'] as const;

function findingIds(value: unknown, label: string): readonly HybridRuntimeFindingId[] {
	const ids = denseArray(value, label, HYBRID_RUNTIME_FINDING_IDS.length).map((entry) => {
		if (
			typeof entry !== 'number' ||
			!Number.isSafeInteger(entry) ||
			!HYBRID_RUNTIME_FINDING_IDS.includes(entry as HybridRuntimeFindingId)
		)
			throw new TypeError(`${label} contains an unsupported finding ID.`);
		return entry as HybridRuntimeFindingId;
	});
	if (new Set(ids).size !== ids.length) throw new TypeError(`${label} contains duplicate IDs.`);
	const order = new Map(HYBRID_RUNTIME_FINDING_IDS.map((id, index) => [id, index] as const));
	for (let index = 1; index < ids.length; index += 1)
		if (order.get(ids[index - 1]!)! >= order.get(ids[index]!)!)
			throw new TypeError(`${label} is not canonically ordered.`);
	return ids;
}

function eventTimestamp(value: unknown, startedAt: number, endedAt: number): string {
	const text = scalarString(value, 'Runtime event timestamp', 64);
	const milliseconds = Date.parse(text);
	if (
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(text) ||
		!Number.isFinite(milliseconds)
	)
		throw new TypeError('Runtime event timestamp must be UTC ISO-8601.');
	const canonical = new Date(milliseconds).toISOString();
	if (text !== canonical && text !== canonical.replace('.000Z', 'Z'))
		throw new TypeError('Runtime event timestamp must be canonical UTC ISO-8601.');
	if (milliseconds < startedAt || milliseconds > endedAt)
		throw new TypeError('Runtime event timestamp falls outside the bound run.');
	return text;
}

function digest(value: unknown, label: string): string {
	if (!isSha256(value)) throw new TypeError(`${label} must be a lowercase SHA-256 digest.`);
	return value;
}

function enumValue<Value extends string>(
	value: unknown,
	values: readonly Value[],
	label: string
): Value {
	if (typeof value !== 'string' || !values.includes(value as Value))
		throw new TypeError(`${label} is unsupported.`);
	return value as Value;
}

function normalizeEventData(kind: string, value: unknown): DeterministicRuntimeEvent['data'] {
	switch (kind) {
		case 'AUTHENTICATION_DECISION': {
			const data = exactRecord(
				value,
				['authenticated', 'endpointId', 'identitySource', 'outcome', 'principalKind'],
				'Authentication event data'
			);
			if (typeof data.authenticated !== 'boolean')
				throw new TypeError('Authentication event authenticated must be boolean.');
			return Object.freeze({
				authenticated: data.authenticated,
				endpointId: scalarString(data.endpointId, 'Authentication endpoint id', 1_024),
				identitySource: enumValue(
					data.identitySource,
					['FABRICATED', 'NONE', 'REQUEST'],
					'Identity source'
				),
				outcome: enumValue(data.outcome, ['ACCEPTED', 'REJECTED'], 'Authentication outcome'),
				principalKind: enumValue(
					data.principalKind,
					['AGENT', 'HUMAN', 'SERVICE', 'UNKNOWN'],
					'Principal kind'
				)
			});
		}
		case 'IDEMPOTENCY_REPLAY': {
			const data = exactRecord(
				value,
				['firstRequestSha256', 'idempotencyKeySha256', 'outcome', 'secondRequestSha256'],
				'Idempotency event data'
			);
			return Object.freeze({
				firstRequestSha256: digest(data.firstRequestSha256, 'First request'),
				idempotencyKeySha256: digest(data.idempotencyKeySha256, 'Idempotency key'),
				outcome: enumValue(
					data.outcome,
					['CONFLICT_REJECTED', 'NEW_EXECUTION', 'PRIOR_RESULT_RETURNED'],
					'Idempotency outcome'
				),
				secondRequestSha256: digest(data.secondRequestSha256, 'Second request')
			});
		}
		case 'AUTHORING_TRANSFORMATION': {
			const data = exactRecord(value, ['material', 'outputId', 'turnId'], 'Authoring event data');
			if (typeof data.material !== 'boolean')
				throw new TypeError('Authoring material marker must be boolean.');
			return Object.freeze({
				material: data.material,
				outputId: scalarString(data.outputId, 'Authoring output id', 1_024),
				turnId: scalarString(data.turnId, 'Authoring turn id', 1_024)
			});
		}
		case 'ASSESSMENT_RECORDED': {
			const data = exactRecord(value, ['outputId', 'scope', 'turnId'], 'Assessment event data');
			return Object.freeze({
				outputId:
					data.outputId === null
						? null
						: scalarString(data.outputId, 'Assessment output id', 1_024),
				scope: enumValue(data.scope, ['OUTPUT', 'TURN'], 'Assessment scope'),
				turnId: scalarString(data.turnId, 'Assessment turn id', 1_024)
			});
		}
		case 'GOVERNANCE_ACTION': {
			const data = exactRecord(
				value,
				['action', 'actorSha256', 'resourceId', 'resourceKind'],
				'Governance event data'
			);
			return Object.freeze({
				action: enumValue(data.action, ['APPROVED', 'PROPOSED'], 'Governance action'),
				actorSha256: digest(data.actorSha256, 'Governance actor'),
				resourceId: scalarString(data.resourceId, 'Governance resource id', 1_024),
				resourceKind: enumValue(
					data.resourceKind,
					['BASELINE', 'DECISION', 'WAIVER'],
					'Governance resource kind'
				)
			});
		}
		case 'EXTERNAL_TOOL_ATTEMPT': {
			const data = exactRecord(
				value,
				['attemptId', 'fieldsPresent', 'outcome'],
				'Tool attempt event data'
			);
			const fields = denseArray(
				data.fieldsPresent,
				'External tool attempt fields',
				EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS.length
			).map((field) =>
				enumValue(field, EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS, 'External tool attempt field')
			);
			if (new Set(fields).size !== fields.length)
				throw new TypeError('External tool attempt fields contain duplicates.');
			return Object.freeze({
				attemptId: scalarString(data.attemptId, 'External tool attempt id', 1_024),
				fieldsPresent: Object.freeze([...fields].sort(compareText)),
				outcome: enumValue(
					data.outcome,
					['CRASHED', 'EXITED', 'TIMED_OUT'],
					'External tool outcome'
				)
			});
		}
		default:
			throw new TypeError('Runtime trace event kind is unsupported.');
	}
}

function normalizeRuntimeTrace(
	value: unknown,
	context: ProviderImportContext
): ProviderNormalization<DeterministicRuntimeTraceObservation> {
	const root = exactRecord(value, ROOT_KEYS, 'Deterministic runtime trace root');
	if (root.schemaVersion !== DETERMINISTIC_RUNTIME_TRACE_INPUT_SCHEMA_VERSION)
		throw new TypeError('Deterministic runtime trace schemaVersion is unsupported.');
	const expectedRunBindingSha256 = sha256(canonicalJson(context.run));
	if (root.runBindingSha256 !== expectedRunBindingSha256)
		throw new TypeError('Runtime trace does not bind the supplied collector run.');
	const coverage = exactRecord(root.coverage, COVERAGE_KEYS, 'Runtime trace coverage');
	const coveredFindingIds = findingIds(coverage.findingIds, 'Runtime covered finding IDs');
	const missingFindingIds = findingIds(coverage.missingFindingIds, 'Runtime missing finding IDs');
	if (
		new Set([...coveredFindingIds, ...missingFindingIds]).size !==
		coveredFindingIds.length + missingFindingIds.length
	)
		throw new TypeError('Runtime covered and missing finding populations overlap.');
	if (coveredFindingIds.length + missingFindingIds.length !== HYBRID_RUNTIME_FINDING_IDS.length)
		throw new TypeError('Runtime trace does not account for all five hybrid finding populations.');
	const artifacts = denseArray(root.artifacts, 'Runtime trace artifacts', 10_000).map(
		(rawArtifact, index) => {
			const artifact = exactRecord(rawArtifact, ARTIFACT_KEYS, `Runtime trace artifact ${index}`);
			return Object.freeze({
				binding: 'PROVIDER_DECLARED_DIGEST_NOT_REHASHED_BY_IMPORTER' as const,
				kind: enumValue(artifact.kind, ['ATTACHMENT', 'REPORT', 'TRACE'], 'Runtime artifact kind'),
				path: providerArtifactPath(artifact.path, context.repositoryRoot),
				sha256: digest(artifact.sha256, 'Runtime artifact')
			});
		}
	);
	const artifactPaths = artifacts.map((artifact) => artifact.path);
	if (new Set(artifactPaths).size !== artifactPaths.length)
		throw new TypeError('Runtime trace artifacts contain duplicate paths.');
	const startedAt = Date.parse(context.run.startedAt);
	const endedAt = Date.parse(context.run.endedAt);
	let previousAt = startedAt;
	const events = denseArray(root.events, 'Runtime trace events', 100_000).map((rawEvent, index) => {
		const event = exactRecord(rawEvent, EVENT_KEYS, `Runtime trace event ${index}`);
		const sequence = safeInteger(event.sequence, `Runtime event ${index} sequence`);
		if (sequence !== index)
			throw new TypeError('Runtime trace sequences must be contiguous from zero.');
		const at = eventTimestamp(event.at, startedAt, endedAt);
		const atMs = Date.parse(at);
		if (atMs < previousAt) throw new TypeError('Runtime trace event timestamps are not ordered.');
		previousAt = atMs;
		const kind = scalarString(event.kind, `Runtime event ${index} kind`, 128);
		const data = normalizeEventData(kind, event.data);
		return Object.freeze({
			at,
			data,
			eventId: sha256(canonicalJson({ at, data, kind, sequence })),
			kind,
			sequence
		}) as DeterministicRuntimeEvent;
	});
	const requiredEventKinds: Readonly<
		Record<HybridRuntimeFindingId, DeterministicRuntimeEvent['kind']>
	> = {
		9: 'AUTHENTICATION_DECISION',
		19: 'IDEMPOTENCY_REPLAY',
		45: 'AUTHORING_TRANSFORMATION',
		54: 'GOVERNANCE_ACTION',
		55: 'EXTERNAL_TOOL_ATTEMPT'
	};
	for (const findingId of coveredFindingIds)
		if (!events.some((event) => event.kind === requiredEventKinds[findingId]))
			throw new TypeError(
				'Runtime trace claims a covered hybrid population without its positive event marker.'
			);
	return {
		completedRegions: coveredFindingIds.map((id) => `HARMONIZATION_FINDING_${id}`),
		missingRegions: missingFindingIds.map((id) => `HARMONIZATION_FINDING_${id}`),
		observations: [
			Object.freeze({
				artifacts: Object.freeze(artifacts),
				coveredFindingIds: Object.freeze(coveredFindingIds),
				events: Object.freeze(events),
				missingFindingIds: Object.freeze(missingFindingIds),
				runBindingSha256: expectedRunBindingSha256
			})
		],
		redactions: ['RUNTIME_EVENT_IDENTITIES_RETAINED_AS_DIGESTS']
	};
}

/** Imports supplied trace bytes only. This adapter never launches or imports subject code. */
export function importDeterministicRuntimeTrace(
	raw: string | Uint8Array | null,
	context: ProviderImportContext
): ProviderEvidenceResult<DeterministicRuntimeTraceObservation> {
	return importProviderJson({
		adapterId: DETERMINISTIC_RUNTIME_TRACE_ADAPTER_ID,
		adapterVersion: DETERMINISTIC_RUNTIME_TRACE_ADAPTER_VERSION,
		context,
		expectedProviderId: DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID,
		normalize: normalizeRuntimeTrace,
		raw,
		supportedProviderVersions: [DETERMINISTIC_RUNTIME_TRACE_PROVIDER_VERSION]
	});
}
