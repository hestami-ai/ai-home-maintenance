import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import {
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type ProjectContextGraphBudgets,
	type ProjectContextGraphSnapshot
} from '../contracts/project-context-graph.js';
import {
	PROJECT_CONTEXT_REPORT_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_RESULT_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	PROJECT_CONTEXT_REPORT_SCHEMA_VERSION,
	type ProjectContextReportDiagnostic,
	type ProjectContextReportFailureState,
	type ProjectContextReportOutcome,
	type ProjectContextReportRequest,
	type ProjectContextReportStage,
	type ProjectContextReportStageOutcomes
} from '../contracts/project-context-report.js';
import {
	SEMANTIC_BUDGET_KEYS,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type SemanticBudgets,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type SubjectBudgets,
	type SubjectCompleteness,
	type SubjectDiagnostic,
	type SubjectResolutionOutcome
} from '../contracts/subject.js';
import { buildProjectContextGraph } from '../graph/build-project-context-graph.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import type {
	StaticSemanticSnapshotProgressEvent,
	StaticSemanticSnapshotProgressPhase
} from '../semantic/build-static-semantic-snapshot.js';
import {
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import {
	assertCanonicalRelativePath,
	canonicalPathKey,
	repositoryRelativePath,
	resolveExistingRepositoryPath,
	resolveRepositoryRoot
} from '../subject/paths.js';
import { resolveSubject } from '../subject/resolve-subject.js';

const REQUEST_KEYS = [
	'budgets',
	'operationVersion',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = ['maxResultBytes', 'projectContext', 'semantic', 'subject'] as const;
const SUBJECT_BUDGET_KEYS = [
	'maxBytes',
	'maxConfigDepth',
	'maxDiagnostics',
	'maxDurationMs',
	'maxFiles',
	'maxProjects'
] as const satisfies readonly (keyof SubjectBudgets)[];
const PROJECT_CONTEXT_BUDGET_KEYS = [
	'maxConfigurationClosureRecords',
	'maxDiagnostics',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxMemberships',
	'maxOutputRecords',
	'maxPrograms',
	'maxProjectReferences',
	'maxProjects',
	'maxSources',
	'maxTraversalSteps'
] as const satisfies readonly (keyof ProjectContextGraphBudgets)[];
const ZERO_CAPACITY_PROJECT_CONTEXT_BUDGET_KEYS = new Set<keyof ProjectContextGraphBudgets>([
	'maxProjectReferences',
	'maxSources'
]);
const FORBIDDEN_PATH_PATTERN_CHARACTERS = new Set(['*', '?', '[', ']', '{', '}']);

interface DiagnosticLike {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase?: string;
	readonly severity?: 'INFO' | 'WARNING' | 'ERROR';
}

export const PROJECT_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-project-context-report-progress/0.1.0' as const;

export const PROJECT_CONTEXT_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: PROJECT_CONTEXT_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type ProjectContextReportProgressObservationBasis = 'EXACT' | 'LOWER_BOUND';

export type ProjectContextReportProgressObservationMetric =
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'PROJECT_CONTEXT_CONFIGURATION_CLOSURE_RECORDS'
	| 'PROJECT_CONTEXT_MEMBERSHIPS'
	| 'PROJECT_CONTEXT_OUTPUT_RECORDS'
	| 'PROJECT_CONTEXT_PROGRAMS'
	| 'PROJECT_CONTEXT_PROJECT_REFERENCES'
	| 'PROJECT_CONTEXT_PROJECTS'
	| 'PROJECT_CONTEXT_SOURCES'
	| 'PROJECT_CONTEXT_TRAVERSAL_STEPS'
	| 'RESULT_BYTES'
	| 'SEMANTIC_AST_NODES'
	| 'SEMANTIC_CANONICAL_BYTES'
	| 'SEMANTIC_PROGRESS_ELAPSED_MILLISECONDS'
	| 'SEMANTIC_HEAP_USED_BYTES'
	| 'SEMANTIC_PROJECTS'
	| 'SEMANTIC_RSS_BYTES'
	| 'SEMANTIC_SOURCES'
	| 'SEMANTIC_SYMBOLS'
	| 'SUBJECT_ARTIFACTS'
	| 'SUBJECT_DISCOVERED_FILES'
	| 'SUBJECT_EXCLUDED_RECORDS'
	| 'SUBJECT_FILE_BUDGET_RECORDS'
	| 'SUBJECT_PROJECTS'
	| 'SUBJECT_RETAINED_BYTES';

export type ProjectContextReportProgressPhase =
	| 'CURRENTNESS'
	| 'PROJECT_CONTEXT'
	| 'REQUEST_BIND'
	| 'RESULT'
	| 'SEMANTIC_SNAPSHOT'
	| 'SUBJECT_CAPTURE'
	| 'SUBJECT_PROJECT_PATH_BIND';

const PROJECT_CONTEXT_REPORT_PROGRESS_PHASE_STAGE = Object.freeze({
	CURRENTNESS: 'CURRENTNESS',
	PROJECT_CONTEXT: 'PROJECT_CONTEXT',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT',
	SEMANTIC_SNAPSHOT: 'SEMANTIC_SNAPSHOT',
	SUBJECT_CAPTURE: 'SUBJECT',
	SUBJECT_PROJECT_PATH_BIND: 'SUBJECT'
} as const satisfies Readonly<
	Record<ProjectContextReportProgressPhase, ProjectContextReportStage>
>);

export interface ProjectContextReportProgressObservation {
	readonly basis: ProjectContextReportProgressObservationBasis;
	readonly limit: number | null;
	readonly metric: ProjectContextReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

interface ProjectContextReportProgressEventBase {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly nonclaims: typeof PROJECT_CONTEXT_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly ProjectContextReportProgressObservation[];
	readonly operationVersion: typeof PROJECT_CONTEXT_REPORT_OPERATION_VERSION;
	readonly phase: ProjectContextReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_CAP_010_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof PROJECT_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: ProjectContextReportStage;
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

/** Best-effort operational telemetry excluded from terminal report identity and evidence. */
export type ProjectContextReportProgressEvent =
	| (ProjectContextReportProgressEventBase & {
			readonly kind: 'REPORT_STAGE';
			readonly semanticProgress?: never;
			readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
	  })
	| (ProjectContextReportProgressEventBase & {
			readonly kind: 'SEMANTIC_SNAPSHOT';
			readonly phase: 'SEMANTIC_SNAPSHOT';
			readonly semanticProgress: StaticSemanticSnapshotProgressEvent;
			readonly stage: 'SEMANTIC_SNAPSHOT';
			readonly state: StaticSemanticSnapshotProgressEvent['state'];
	  });

interface ReportProgressRecorder {
	complete(
		observations?: readonly ProjectContextReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly ProjectContextReportProgressObservation[],
		detailCode?: string | null
	): void;
	enabled(): boolean;
	finish(outcome: ProjectContextReportOutcome): ProjectContextReportOutcome;
	forwardSemantic(event: StaticSemanticSnapshotProgressEvent, budgets: SemanticBudgets): void;
	start(
		phase: ProjectContextReportProgressPhase,
		observations?: readonly ProjectContextReportProgressObservation[]
	): void;
}

function progressObservation(
	metric: ProjectContextReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: ProjectContextReportProgressObservation['unit'],
	basis: ProjectContextReportProgressObservationBasis = 'EXACT'
): ProjectContextReportProgressObservation {
	const boundedValue =
		Number.isFinite(value) && value >= 0 ? Math.min(value, Number.MAX_SAFE_INTEGER) : 0;
	return Object.freeze({ basis, limit, metric, unit, value: boundedValue });
}

function semanticProgressObservations(
	event: StaticSemanticSnapshotProgressEvent,
	budgets: SemanticBudgets
): readonly ProjectContextReportProgressObservation[] {
	const normalizedPhases = new Set<StaticSemanticSnapshotProgressPhase>([
		'FREEZE',
		'SERIALIZE',
		'VALIDATE',
		'FINAL_FRESHNESS',
		'FINALIZE'
	]);
	const normalized =
		normalizedPhases.has(event.phase) ||
		(event.phase === 'NORMALIZE' && event.state === 'COMPLETED');
	const populationBasis = normalized ? 'EXACT' : 'LOWER_BOUND';
	const canonicalBytesExact =
		event.counts.canonicalBytes > 0 &&
		(normalizedPhases.has(event.phase) ||
			(event.phase === 'SERIALIZE' && event.state !== 'STARTED'));
	return Object.freeze([
		progressObservation(
			'SEMANTIC_PROGRESS_ELAPSED_MILLISECONDS',
			event.elapsedMs,
			null,
			'MILLISECONDS'
		),
		progressObservation('SEMANTIC_RSS_BYTES', event.memoryUsage.rss, null, 'BYTES'),
		progressObservation('SEMANTIC_HEAP_USED_BYTES', event.memoryUsage.heapUsed, null, 'BYTES'),
		progressObservation(
			'SEMANTIC_AST_NODES',
			event.counts.astNodes,
			budgets.maxAstNodes,
			'COUNT',
			populationBasis
		),
		progressObservation(
			'SEMANTIC_CANONICAL_BYTES',
			event.counts.canonicalBytes,
			budgets.maxSnapshotBytes,
			'BYTES',
			canonicalBytesExact ? 'EXACT' : 'LOWER_BOUND'
		),
		progressObservation(
			'SEMANTIC_PROJECTS',
			event.counts.semanticProjects,
			budgets.maxProjects,
			'COUNT',
			populationBasis
		),
		progressObservation(
			'SEMANTIC_SOURCES',
			event.counts.sources,
			budgets.maxSources,
			'COUNT',
			populationBasis
		),
		progressObservation('SEMANTIC_SYMBOLS', event.counts.symbols, null, 'COUNT', populationBasis)
	]);
}

function containRejectedObserverResult(result: unknown): void {
	if (result === undefined) return;
	void Promise.resolve(result).catch(() => {
		// Rejected thenables are contained like synchronous observer exceptions.
	});
}

export interface RunProjectContextReportOptions {
	/** Trusted-host telemetry callback; it is excluded from terminal evidence and identity. */
	readonly onProgress?: (event: ProjectContextReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

/** Trusted same-process options for a capture that deliberately emits no report telemetry. */
export interface CaptureProjectContextReportPipelineOptions {
	/** Successor-only semantic enrichment; the public CAP-010 report remains syntax/symbol scoped. */
	readonly includeTypeCapability?: true;
	/** Absolute fixed worktree root supplied by the successor facade. */
	readonly repositoryRoot: string;
}

/** Trusted same-process evidence handoff for bounded successor report facades. */
export interface ProjectContextReportPipelineCapture {
	readonly diagnostics: readonly ProjectContextReportDiagnostic[];
	readonly frozenSubject: FrozenSubject;
	readonly outcome: 'captured';
	readonly predecessorStageOutcomes: {
		readonly projectContext: {
			readonly diagnosticCodes: readonly string[];
			readonly outcome: 'partial';
		};
		readonly semanticSnapshot: {
			readonly diagnosticCodes: readonly string[];
			readonly outcome: 'complete' | 'partial';
		};
		readonly subject: {
			readonly completeness: SubjectCompleteness;
			readonly diagnosticCodes: readonly string[];
			readonly outcome: 'resolved';
		};
	};
	readonly projectContextGraph: ProjectContextGraphSnapshot;
	/** Canonical absolute root retained only for the trusted same-process successor. */
	readonly repositoryRoot: string;
	readonly request: ProjectContextReportRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export type ProjectContextReportPipelineOutcome =
	| ProjectContextReportPipelineCapture
	| Extract<ProjectContextReportOutcome, { readonly outcome: 'unavailable' }>;

function createReportProgressRecorder(
	options: RunProjectContextReportOptions
): ReportProgressRecorder {
	let sink: ((event: ProjectContextReportProgressEvent) => unknown) | undefined;
	try {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		if (descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'function')
			sink = descriptor.value as (event: ProjectContextReportProgressEvent) => unknown;
	} catch {
		// Observer inspection is best-effort and outside the evidence-producing path.
	}
	let active: ProjectContextReportProgressPhase | null = null;
	let sequence = 0;
	let lastElapsedMs = 0;
	let origin: bigint | null = null;
	if (sink !== undefined)
		try {
			origin = process.hrtime.bigint();
		} catch {
			origin = null;
		}

	const elapsed = (): number => {
		if (origin === null) return lastElapsedMs;
		try {
			const measured = Number(process.hrtime.bigint() - origin) / 1_000_000;
			if (Number.isFinite(measured)) lastElapsedMs = Math.max(lastElapsedMs, measured);
		} catch {
			// Retain the last monotonic observation.
		}
		return lastElapsedMs;
	};
	const emit = (
		event:
			| Omit<
					Extract<ProjectContextReportProgressEvent, { readonly kind: 'REPORT_STAGE' }>,
					| 'deliverySemantics'
					| 'elapsedMs'
					| 'nonclaims'
					| 'operationVersion'
					| 'protocolRole'
					| 'reportIdentityEffect'
					| 'schemaVersion'
					| 'sequence'
					| 'wallClockBudgetEffect'
			  >
			| Omit<
					Extract<ProjectContextReportProgressEvent, { readonly kind: 'SEMANTIC_SNAPSHOT' }>,
					| 'deliverySemantics'
					| 'elapsedMs'
					| 'nonclaims'
					| 'operationVersion'
					| 'protocolRole'
					| 'reportIdentityEffect'
					| 'schemaVersion'
					| 'sequence'
					| 'wallClockBudgetEffect'
			  >
	): void => {
		if (sink === undefined) return;
		try {
			sequence += 1;
			const materialized = Object.freeze({
				...event,
				deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' as const,
				elapsedMs: elapsed(),
				nonclaims: PROJECT_CONTEXT_REPORT_PROGRESS_NONCLAIMS,
				observations: Object.freeze([...event.observations]),
				operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
				protocolRole: 'PRELIMINARY_CAP_010_REPORT_TELEMETRY' as const,
				reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
				schemaVersion: PROJECT_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION,
				sequence,
				wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET' as const
			}) as ProjectContextReportProgressEvent;
			containRejectedObserverResult(sink(materialized));
		} catch {
			// Sink and materialization failures do not alter the terminal report.
		}
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly ProjectContextReportProgressObservation[],
		detailCode: string | null
	): void => {
		if (active === null) return;
		const phase = active;
		active = null;
		emit({
			detailCode,
			kind: 'REPORT_STAGE',
			observations,
			phase,
			stage: PROJECT_CONTEXT_REPORT_PROGRESS_PHASE_STAGE[phase],
			state
		});
	};

	return {
		complete(observations = [], detailCode = null): void {
			close('COMPLETED', observations, detailCode);
		},
		enabled(): boolean {
			return sink !== undefined;
		},
		fail(observations = [], detailCode = null): void {
			close('FAILED', observations, detailCode);
		},
		finish(outcome): ProjectContextReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			return outcome;
		},
		forwardSemantic(event, budgets): void {
			emit({
				detailCode: event.detailCode,
				kind: 'SEMANTIC_SNAPSHOT',
				observations: semanticProgressObservations(event, budgets),
				phase: 'SEMANTIC_SNAPSHOT',
				semanticProgress: event,
				stage: 'SEMANTIC_SNAPSHOT',
				state: event.state
			});
		},
		start(phase, observations = []): void {
			if (active !== null) close('FAILED', [], 'STAGE_INTERRUPTED');
			active = phase;
			emit({
				detailCode: null,
				kind: 'REPORT_STAGE',
				observations,
				phase,
				stage: PROJECT_CONTEXT_REPORT_PROGRESS_PHASE_STAGE[phase],
				state: 'STARTED'
			});
		}
	};
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: ProjectContextReportFailureState = 'incompatible'
	) {
		super(message);
	}
}

function exactDataRecord(
	value: unknown,
	expectedKeys: readonly string[],
	path: string
): Readonly<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', `${path} must be an exact object.`, path);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', `${path} must be a data object.`, path);
	const keys = Reflect.ownKeys(value);
	if (
		keys.some((key) => typeof key !== 'string') ||
		keys.length !== expectedKeys.length ||
		expectedKeys.some((key) => !keys.includes(key))
	)
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', `${path} has unexpected keys.`, path);
	const materialized: Record<string, unknown> = {};
	for (const key of expectedKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			throw new ReportRequestError(
				'REQUEST_SHAPE_INVALID',
				`${path}.${key} must be an enumerable data property.`,
				`${path}.${key}`
			);
		materialized[key] = descriptor.value;
	}
	return materialized;
}

function boundedBudget(value: unknown, ceiling: number, path: string, allowZero = false): number {
	const minimum = allowZero ? 0 : 1;
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		Object.is(value, -0) ||
		value < minimum
	)
		throw new ReportRequestError(
			'REQUEST_BUDGET_INVALID',
			`${path} must be a ${allowZero ? 'nonnegative' : 'positive'} safe integer.`,
			path
		);
	if (value > ceiling)
		throw new ReportRequestError(
			'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			`${path} exceeds the operation safety ceiling.`,
			path,
			'resource-refused'
		);
	return value;
}

function materializeBudgetRecord<Keys extends readonly string[]>(
	value: unknown,
	keys: Keys,
	ceilings: Readonly<Record<Keys[number], number>>,
	path: string,
	zeroCapacityKeys: ReadonlySet<string> = new Set()
): Readonly<Record<Keys[number], number>> {
	const record = exactDataRecord(value, keys, path);
	return Object.freeze(
		Object.fromEntries(
			keys.map((key) => [
				key,
				boundedBudget(
					record[key],
					ceilings[key as Keys[number]],
					`${path}.${key}`,
					zeroCapacityKeys.has(key)
				)
			])
		) as Record<Keys[number], number>
	);
}

function materializePath(value: unknown, maxPathCharacters: number, path: string): string {
	if (typeof value !== 'string' || !isUnicodeScalarString(value) || value.length === 0)
		throw new ReportRequestError('REQUEST_PATH_INVALID', `${path} must be nonempty text.`, path);
	if (value.length > maxPathCharacters)
		throw new ReportRequestError(
			'REQUEST_PATH_BUDGET_EXCEEDED',
			`${path} exceeds the caller path-character budget.`,
			path,
			'resource-refused'
		);
	if (
		[...value].some((character) => {
			const codePoint = character.codePointAt(0)!;
			return (
				codePoint <= 0x1f || codePoint === 0x7f || FORBIDDEN_PATH_PATTERN_CHARACTERS.has(character)
			);
		})
	)
		throw new ReportRequestError(
			'REQUEST_PATH_INVALID',
			`${path} contains a control or pattern character.`,
			path
		);
	try {
		return assertCanonicalRelativePath(value);
	} catch {
		throw new ReportRequestError(
			'REQUEST_PATH_INVALID',
			`${path} must be one canonical repository-relative path.`,
			path
		);
	}
}

function materializeProjectPaths(
	value: unknown,
	maxPathCharacters: number,
	maxProjects: number
): readonly string[] {
	if (
		!Array.isArray(value) ||
		isProxyValue(value) ||
		Reflect.getPrototypeOf(value) !== Array.prototype
	)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be a nonempty exact data array.',
			'$.subjectProjectConfigPaths'
		);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value <= 0
	)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be a nonempty exact array.',
			'$.subjectProjectConfigPaths'
		);
	const length = lengthDescriptor.value;
	if (length > maxProjects)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_BUDGET_EXCEEDED',
			'$.subjectProjectConfigPaths exceeds the caller project budget.',
			'$.subjectProjectConfigPaths',
			'resource-refused'
		);
	const ownKeys = Reflect.ownKeys(value);
	if (
		ownKeys.some((key) => typeof key !== 'string') ||
		ownKeys.length !== length + 1 ||
		!ownKeys.includes('length') ||
		Array.from({ length }, (_, index) => String(index)).some((key) => !ownKeys.includes(key))
	)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be dense and have no extra properties.',
			'$.subjectProjectConfigPaths'
		);
	const paths: string[] = [];
	for (let index = 0; index < length; index += 1) {
		const path = `$.subjectProjectConfigPaths[${index}]`;
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			throw new ReportRequestError(
				'REQUEST_PROJECTS_INVALID',
				`${path} must be an enumerable data property.`,
				path
			);
		paths.push(materializePath(descriptor.value, maxPathCharacters, path));
	}
	const keys = paths.map((path) => canonicalPathKey(path));
	if (new Set(keys).size !== keys.length)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths contains duplicate canonical paths.',
			'$.subjectProjectConfigPaths'
		);
	return Object.freeze(paths);
}

function materializeRequest(value: unknown): ProjectContextReportRequest {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.schemaVersion !== PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
			'The project-context report request schema version is unsupported.',
			'$.schemaVersion'
		);
	if (record.operationVersion !== PROJECT_CONTEXT_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_VERSION_UNSUPPORTED',
			'The project-context report operation version is unsupported.',
			'$.operationVersion'
		);

	const budgetsRecord = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const subject = materializeBudgetRecord(
		budgetsRecord.subject,
		SUBJECT_BUDGET_KEYS,
		PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.subject,
		'$.budgets.subject'
	) as unknown as SubjectBudgets;
	const semantic = materializeBudgetRecord(
		budgetsRecord.semantic,
		SEMANTIC_BUDGET_KEYS,
		PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.semantic,
		'$.budgets.semantic'
	) as unknown as SemanticBudgets;
	const projectContext = materializeBudgetRecord(
		budgetsRecord.projectContext,
		PROJECT_CONTEXT_BUDGET_KEYS,
		PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.projectContext,
		'$.budgets.projectContext',
		ZERO_CAPACITY_PROJECT_CONTEXT_BUDGET_KEYS
	) as unknown as ProjectContextGraphBudgets;
	const maxResultBytes = boundedBudget(
		budgetsRecord.maxResultBytes,
		PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.maxResultBytes,
		'$.budgets.maxResultBytes'
	);
	const subjectProjectConfigPaths = materializeProjectPaths(
		record.subjectProjectConfigPaths,
		semantic.maxPathCharacters,
		Math.min(subject.maxProjects, semantic.maxProjects, projectContext.maxProjects)
	);

	return Object.freeze({
		budgets: Object.freeze({ maxResultBytes, projectContext, semantic, subject }),
		operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
		schemaVersion: PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths
	});
}

export type ProjectContextReportRequestAdmission =
	| {
			readonly outcome: 'admitted';
			readonly request: ProjectContextReportRequest;
	  }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: ProjectContextReportFailureState;
	  };

/** @internal Exact hostile-safe admission shared only with same-process successor facades. */
export function admitProjectContextReportRequest(
	requestValue: unknown
): ProjectContextReportRequestAdmission {
	try {
		return Object.freeze({
			outcome: 'admitted' as const,
			request: materializeRequest(requestValue)
		});
	} catch (error) {
		if (error instanceof ReportRequestError)
			return Object.freeze({
				code: error.code,
				message: error.message,
				outcome: 'rejected' as const,
				path: error.path,
				state: error.state
			});
		return Object.freeze({
			code: 'REQUEST_INVALID',
			message: 'The report request could not be inspected safely.',
			outcome: 'rejected' as const,
			path: '$',
			state: 'incompatible' as const
		});
	}
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	severity: 'INFO' | 'WARNING' | 'ERROR' | null = 'ERROR'
): ProjectContextReportDiagnostic {
	return { code, message, path, phase, severity, source: 'REPORT' };
}

function escapedRegularExpression(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function redactRoot(message: string, repositoryRoot: string): string {
	let redacted = message;
	for (const candidate of new Set([repositoryRoot, repositoryRoot.replaceAll('\\', '/')])) {
		if (candidate.length > 0)
			redacted = redacted.replace(
				new RegExp(escapedRegularExpression(candidate), 'giu'),
				'<repository-root>'
			);
	}
	return redacted;
}

function safeDiagnosticPath(path: string | null, repositoryRoot: string): string | null {
	if (path === null) return null;
	try {
		if (isAbsolute(path)) return repositoryRelativePath(repositoryRoot, path);
		return assertCanonicalRelativePath(path);
	} catch {
		return null;
	}
}

function projectDiagnostics(
	diagnostics: readonly DiagnosticLike[],
	source: Exclude<ProjectContextReportDiagnostic['source'], 'REPORT'>,
	repositoryRoot: string
): ProjectContextReportDiagnostic[] {
	return diagnostics.map((diagnostic) => ({
		code: diagnostic.code,
		message: redactRoot(diagnostic.message, repositoryRoot),
		path: safeDiagnosticPath(diagnostic.path, repositoryRoot),
		phase: diagnostic.phase ?? null,
		severity: diagnostic.severity ?? null,
		source
	}));
}

function failure(
	code: string,
	stage: ProjectContextReportStage,
	state: ProjectContextReportFailureState,
	diagnostics: readonly ProjectContextReportDiagnostic[],
	request?: ProjectContextReportRequest,
	subject?: FrozenSubject
): ProjectContextReportOutcome {
	return {
		code,
		diagnostics,
		facadeNonclaims: PROJECT_CONTEXT_REPORT_NONCLAIMS,
		operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		...(request === undefined ? {} : { request }),
		schemaVersion: PROJECT_CONTEXT_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject: subject.descriptor })
	};
}

function hasBudgetDiagnostic(diagnostics: readonly DiagnosticLike[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.code.includes('BUDGET'));
}

function subjectFailureIdentity(
	outcome: Exclude<SubjectResolutionOutcome, { readonly outcome: 'resolved' }>
): { readonly code: string; readonly state: ProjectContextReportFailureState } {
	if (hasBudgetDiagnostic(outcome.diagnostics))
		return { code: 'SUBJECT_RESOURCE_REFUSED', state: 'resource-refused' };
	switch (outcome.outcome) {
		case 'not-found':
			return { code: 'SUBJECT_NOT_FOUND', state: 'incompatible' };
		case 'ambiguous':
			return { code: 'SUBJECT_AMBIGUOUS', state: 'incompatible' };
		case 'forbidden':
			return { code: 'SUBJECT_FORBIDDEN', state: 'incompatible' };
		case 'incompatible':
			return { code: 'SUBJECT_INCOMPATIBLE', state: 'incompatible' };
		case 'unavailable':
			return { code: 'SUBJECT_UNAVAILABLE', state: 'failed' };
	}
}

function existingFile(
	repositoryRoot: string,
	path: string,
	request: ProjectContextReportRequest
): ReturnType<typeof resolveExistingRepositoryPath> | ProjectContextReportOutcome {
	try {
		const resolved = resolveExistingRepositoryPath(repositoryRoot, path);
		if (!statSync(resolved.realPath).isFile())
			return failure(
				'PROJECT_PATH_INVALID',
				'SUBJECT',
				'incompatible',
				[
					reportDiagnostic(
						'PROJECT_PATH_INVALID',
						'The requested repository path is not a file.',
						path
					)
				],
				request
			);
		return resolved;
	} catch {
		return failure(
			'PROJECT_PATH_INVALID',
			'SUBJECT',
			'incompatible',
			[
				reportDiagnostic(
					'PROJECT_PATH_INVALID',
					'The requested repository path is absent or escapes the repository.',
					path
				)
			],
			request
		);
	}
}

function evidenceReconciles(graph: ProjectContextGraphSnapshot): boolean {
	const projects = new Map(graph.projects.map((project) => [project.id, project]));
	const programs = new Map(graph.programs.map((program) => [program.id, program]));
	const sources = new Map(graph.sources.map((source) => [source.id, source]));
	if (
		projects.size !== graph.projects.length ||
		programs.size !== graph.programs.length ||
		sources.size !== graph.sources.length ||
		new Set(graph.memberships.map((membership) => membership.id)).size !==
			graph.memberships.length ||
		new Set(graph.projectReferences.map((reference) => reference.id)).size !==
			graph.projectReferences.length
	)
		return false;
	for (const project of graph.projects) {
		const program = programs.get(project.programId);
		if (program === undefined || program.projectId !== project.id) return false;
		if (project.sourceIds.some((sourceId) => sources.get(sourceId)?.projectId !== project.id))
			return false;
	}
	for (const program of graph.programs) {
		if (!projects.has(program.projectId)) return false;
		if (program.sourceIds.some((sourceId) => sources.get(sourceId)?.programId !== program.id))
			return false;
	}
	for (const source of graph.sources)
		if (!projects.has(source.projectId) || !programs.has(source.programId)) return false;

	const projectProgramMemberships = new Set<string>();
	const programSourceMemberships = new Set<string>();
	for (const membership of graph.memberships) {
		if (membership.kind === 'PROJECT_HAS_PROGRAM') {
			if (programs.get(membership.programId)?.projectId !== membership.projectId) return false;
			projectProgramMemberships.add(`${membership.projectId}\0${membership.programId}`);
		} else {
			if (sources.get(membership.sourceId)?.programId !== membership.programId) return false;
			programSourceMemberships.add(`${membership.programId}\0${membership.sourceId}`);
		}
	}
	const expectedProjectProgramMemberships = new Set(
		graph.programs.map((program) => `${program.projectId}\0${program.id}`)
	);
	const expectedProgramSourceMemberships = new Set(
		graph.sources.map((source) => `${source.programId}\0${source.id}`)
	);
	if (
		projectProgramMemberships.size !== expectedProjectProgramMemberships.size ||
		programSourceMemberships.size !== expectedProgramSourceMemberships.size ||
		[...expectedProjectProgramMemberships].some((key) => !projectProgramMemberships.has(key)) ||
		[...expectedProgramSourceMemberships].some((key) => !programSourceMemberships.has(key))
	)
		return false;
	for (const reference of graph.projectReferences) {
		const from = projects.get(reference.fromProjectId);
		const target = projects.get(reference.targetProjectId);
		if (
			from?.configPath !== reference.fromConfigPath ||
			target?.configPath !== reference.declaredTargetConfigPath
		)
			return false;
	}
	return (
		graph.coverage.projectedProjects === graph.projects.length &&
		graph.coverage.projectedPrograms === graph.programs.length &&
		graph.coverage.projectedSources === graph.sources.length &&
		graph.coverage.memberships === graph.memberships.length &&
		graph.coverage.resolvedProjectReferences === graph.projectReferences.length &&
		graph.coverage.projectProgramMemberships === projectProgramMemberships.size &&
		graph.coverage.programSourceMemberships === programSourceMemberships.size &&
		graph.coverage.projectPopulationReconciles &&
		graph.coverage.programPopulationReconciles &&
		graph.coverage.sourcePopulationReconciles &&
		graph.coverage.referencePopulationReconciles
	);
}

function runProjectContextReportInternal(
	requestValue: unknown,
	options: RunProjectContextReportOptions,
	progress: ReportProgressRecorder,
	capturePipeline = false,
	includeTypeCapability = false
): ProjectContextReportOutcome | ProjectContextReportPipelineCapture {
	progress.start('REQUEST_BIND');
	const admission = admitProjectContextReportRequest(requestValue);
	if (admission.outcome === 'rejected')
		return failure(admission.code, 'REQUEST', admission.state, [
			reportDiagnostic(admission.code, admission.message, admission.path, 'REQUEST')
		]);
	const request = admission.request;

	let repositoryRoot: string;
	try {
		repositoryRoot = resolveRepositoryRoot(options.repositoryRoot);
	} catch {
		return failure(
			'REPOSITORY_ROOT_UNAVAILABLE',
			'REQUEST',
			'failed',
			[
				reportDiagnostic('REPOSITORY_ROOT_UNAVAILABLE', 'The fixed repository root is unavailable.')
			],
			request
		);
	}
	progress.complete([], 'REQUEST_ADMITTED');

	progress.start('SUBJECT_PROJECT_PATH_BIND');
	const resolvedSubjectProjects = [];
	for (const projectPath of request.subjectProjectConfigPaths) {
		const resolved = existingFile(repositoryRoot, projectPath, request);
		if ('outcome' in resolved) return resolved;
		resolvedSubjectProjects.push(resolved);
	}
	progress.complete([], 'SUBJECT_PROJECT_PATHS_BOUND');

	progress.start('SUBJECT_CAPTURE');
	const subjectOutcome = resolveSubject({
		budgets: request.budgets.subject,
		expectEmpty: false,
		filters: { exclude: [], include: [] },
		operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: repositoryRoot,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: {
			kind: 'EXPLICIT_PROJECTS',
			projects: resolvedSubjectProjects.map((project) => project.path)
		},
		subjectKind: 'WORKTREE'
	});
	const subjectDiagnostics = projectDiagnostics(
		subjectOutcome.diagnostics,
		'SUBJECT',
		repositoryRoot
	);
	if (subjectOutcome.outcome !== 'resolved') {
		const identity = subjectFailureIdentity(subjectOutcome);
		return failure(identity.code, 'SUBJECT', identity.state, subjectDiagnostics, request);
	}
	const subject = subjectOutcome.subject;
	progress.complete(
		[
			progressObservation('SUBJECT_ARTIFACTS', subject.artifacts.length, null, 'COUNT'),
			progressObservation(
				'SUBJECT_FILE_BUDGET_RECORDS',
				subject.artifacts.length + subject.excludedArtifacts.length,
				request.budgets.subject.maxFiles,
				'COUNT'
			),
			progressObservation('SUBJECT_DISCOVERED_FILES', subject.population.discovered, null, 'COUNT'),
			progressObservation(
				'SUBJECT_RETAINED_BYTES',
				subject.artifacts.reduce((total, artifact) => total + artifact.bytes, 0),
				null,
				'BYTES'
			),
			progressObservation(
				'SUBJECT_PROJECTS',
				subject.projects.length,
				request.budgets.subject.maxProjects,
				'COUNT'
			),
			progressObservation(
				'SUBJECT_EXCLUDED_RECORDS',
				subject.excludedArtifacts.length,
				null,
				'COUNT'
			)
		],
		subjectOutcome.completeness
	);

	progress.start('SEMANTIC_SNAPSHOT');
	const semanticOutcome = buildStaticSemanticSnapshot(
		{
			assignabilityRequests: [],
			budgets: request.budgets.semantic,
			capabilities: [
				'TS_PROJECT',
				'TS_SYMBOL',
				'TS_SYNTAX',
				...(includeTypeCapability ? (['TS_TYPE'] as const) : [])
			],
			expectEmpty: false,
			operationVersion: SEMANTIC_OPERATION_VERSION,
			rootLocator: repositoryRoot,
			schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject },
		progress.enabled()
			? { onProgress: (event) => progress.forwardSemantic(event, request.budgets.semantic) }
			: undefined
	);
	const semanticDiagnostics = projectDiagnostics(
		semanticOutcome.diagnostics,
		'SEMANTIC_SNAPSHOT',
		repositoryRoot
	);
	if (semanticOutcome.outcome === 'unavailable' || semanticOutcome.outcome === 'incompatible')
		return failure(
			'SEMANTIC_SNAPSHOT_UNAVAILABLE',
			'SEMANTIC_SNAPSHOT',
			hasBudgetDiagnostic(semanticOutcome.diagnostics)
				? 'resource-refused'
				: semanticOutcome.outcome === 'incompatible'
					? 'incompatible'
					: 'failed',
			semanticDiagnostics,
			request,
			subject
		);
	const snapshot = semanticOutcome.snapshot;
	progress.complete([], semanticOutcome.outcome.toUpperCase());

	progress.start('PROJECT_CONTEXT');
	const projectContextOutcome = buildProjectContextGraph({
		frozenSubject: subject,
		request: {
			budgets: request.budgets.projectContext,
			operationVersion: PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
			schemaVersion: PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
			selection: PROJECT_CONTEXT_GRAPH_SELECTION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		},
		semanticSnapshot: snapshot
	});
	const projectContextDiagnostics = projectDiagnostics(
		projectContextOutcome.diagnostics,
		'PROJECT_CONTEXT',
		repositoryRoot
	);
	if (projectContextOutcome.outcome !== 'partial') {
		progress.fail([], projectContextOutcome.diagnostics[0]?.code ?? 'PROJECT_CONTEXT_UNAVAILABLE');
		return failure(
			'PROJECT_CONTEXT_UNAVAILABLE',
			'PROJECT_CONTEXT',
			hasBudgetDiagnostic(projectContextOutcome.diagnostics) ? 'resource-refused' : 'failed',
			projectContextDiagnostics,
			request,
			subject
		);
	}
	const graph = projectContextOutcome.graph;
	progress.complete(
		[
			progressObservation(
				'PROJECT_CONTEXT_CONFIGURATION_CLOSURE_RECORDS',
				graph.coverage.configurationClosureRecords,
				request.budgets.projectContext.maxConfigurationClosureRecords,
				'COUNT'
			),
			progressObservation(
				'PROJECT_CONTEXT_MEMBERSHIPS',
				graph.memberships.length,
				request.budgets.projectContext.maxMemberships,
				'COUNT'
			),
			progressObservation(
				'PROJECT_CONTEXT_OUTPUT_RECORDS',
				1 +
					graph.projects.length +
					graph.programs.length +
					graph.sources.length +
					graph.memberships.length +
					graph.projectReferences.length,
				request.budgets.projectContext.maxOutputRecords,
				'COUNT'
			),
			progressObservation(
				'PROJECT_CONTEXT_PROGRAMS',
				graph.programs.length,
				request.budgets.projectContext.maxPrograms,
				'COUNT'
			),
			progressObservation(
				'PROJECT_CONTEXT_PROJECT_REFERENCES',
				graph.projectReferences.length,
				request.budgets.projectContext.maxProjectReferences,
				'COUNT'
			),
			progressObservation(
				'PROJECT_CONTEXT_PROJECTS',
				graph.projects.length,
				request.budgets.projectContext.maxProjects,
				'COUNT'
			),
			progressObservation(
				'PROJECT_CONTEXT_SOURCES',
				graph.sources.length,
				request.budgets.projectContext.maxSources,
				'COUNT'
			),
			progressObservation(
				'PROJECT_CONTEXT_TRAVERSAL_STEPS',
				graph.coverage.chargedInputTraversalSteps,
				request.budgets.projectContext.maxTraversalSteps,
				'COUNT'
			)
		],
		'PARTIAL'
	);
	const predecessorStageOutcomes: ProjectContextReportPipelineCapture['predecessorStageOutcomes'] =
		{
			projectContext: {
				diagnosticCodes: projectContextOutcome.diagnostics.map((diagnostic) => diagnostic.code),
				outcome: 'partial'
			},
			semanticSnapshot: {
				diagnosticCodes: semanticOutcome.diagnostics.map((diagnostic) => diagnostic.code),
				outcome: semanticOutcome.outcome
			},
			subject: {
				completeness: subjectOutcome.completeness,
				diagnosticCodes: subjectOutcome.diagnostics.map((diagnostic) => diagnostic.code),
				outcome: 'resolved'
			}
		};
	if (capturePipeline)
		return Object.freeze({
			diagnostics: Object.freeze([
				...subjectDiagnostics,
				...semanticDiagnostics,
				...projectContextDiagnostics
			]),
			frozenSubject: subject,
			outcome: 'captured' as const,
			predecessorStageOutcomes: Object.freeze(predecessorStageOutcomes),
			projectContextGraph: graph,
			repositoryRoot,
			request,
			semanticSnapshot: snapshot
		});

	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		freshness = verifyFrozenSubject(subject, { rootLocator: repositoryRoot });
	} catch {
		freshness = {
			changedPaths: [],
			diagnostics: [
				{
					code: 'SUBJECT_CHANGED_DURING_RESOLUTION',
					message: 'Final captured-subject currentness could not be established.',
					path: null,
					phase: 'FRESHNESS',
					severity: 'WARNING'
				} satisfies SubjectDiagnostic
			],
			state: 'UNAVAILABLE'
		};
	}
	const currentnessState =
		freshness.state === 'CURRENT' ? 'CURRENT_FOR_CAPTURED_SUBJECT' : freshness.state;
	const currentnessDiagnostics = projectDiagnostics(
		freshness.diagnostics,
		'CURRENTNESS',
		repositoryRoot
	);
	progress.complete(
		[
			progressObservation('CURRENTNESS_CHANGED_PATHS', freshness.changedPaths.length, null, 'COUNT')
		],
		currentnessState
	);

	progress.start('RESULT');
	if (!evidenceReconciles(graph))
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The project-context project, program, source, membership, or reference evidence does not reconcile.'
				)
			],
			request,
			subject
		);

	const stageOutcomes: ProjectContextReportStageOutcomes = {
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		...predecessorStageOutcomes
	};
	const report: ProjectContextReportOutcome = {
		diagnostics: [
			...subjectDiagnostics,
			...semanticDiagnostics,
			...projectContextDiagnostics,
			...currentnessDiagnostics
		],
		operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				id: 'JAN-CSAA-CAP-010',
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				status: 'PARTIAL'
			},
			currentness: {
				changedPaths: freshness.changedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: {
				encoding: 'ALL_VALIDATED_PROJECTS_PROGRAMS_SOURCES_MEMBERSHIPS_AND_PROJECT_REFERENCES',
				projectContextGraph: graph
			},
			facadeNonclaims: PROJECT_CONTEXT_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_FROZEN_PROJECT_CONTEXT',
			schemaVersion: PROJECT_CONTEXT_REPORT_RESULT_SCHEMA_VERSION,
			semanticSnapshotSummary: {
				id: snapshot.id,
				programs: snapshot.programs.length,
				projects: snapshot.projects.length,
				sources: snapshot.sources.length
			}
		},
		schemaVersion: PROJECT_CONTEXT_REPORT_SCHEMA_VERSION,
		stageOutcomes,
		state: 'partial',
		subject: subject.descriptor
	};
	try {
		const resultBytes = canonicalSemanticJsonWitness(report).bytes + 1;
		if (resultBytes > request.budgets.maxResultBytes) {
			progress.fail(
				[progressObservation('RESULT_BYTES', resultBytes, request.budgets.maxResultBytes, 'BYTES')],
				'RESULT_BUDGET_EXCEEDED'
			);
			return failure(
				'RESULT_BUDGET_EXCEEDED',
				'RESULT',
				'resource-refused',
				[
					reportDiagnostic(
						'RESULT_BUDGET_EXCEEDED',
						'The admitted project-context report exceeds maxResultBytes.'
					)
				],
				request,
				subject
			);
		}
		progress.complete(
			[progressObservation('RESULT_BYTES', resultBytes, request.budgets.maxResultBytes, 'BYTES')],
			'PARTIAL'
		);
		return report;
	} catch {
		progress.fail([], 'RESULT_SERIALIZATION_FAILED');
		return failure(
			'RESULT_SERIALIZATION_FAILED',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'RESULT_SERIALIZATION_FAILED',
					'The report could not be serialized safely.'
				)
			],
			request,
			subject
		);
	}
}

export function runProjectContextReport(
	requestValue: unknown,
	options: RunProjectContextReportOptions
): ProjectContextReportOutcome {
	const progress = createReportProgressRecorder(options);
	try {
		const outcome = runProjectContextReportInternal(requestValue, options, progress);
		if (outcome.outcome === 'captured')
			throw new Error('The public CAP-010 report path returned an internal pipeline capture.');
		return progress.finish(outcome);
	} catch (error) {
		progress.fail([], 'INTERNAL_FAILURE');
		throw error;
	}
}

/** @internal Same-process successor seam; never export from the package root or serialize. */
export function captureProjectContextReportPipeline(
	requestValue: unknown,
	options: CaptureProjectContextReportPipelineOptions
): ProjectContextReportPipelineOutcome {
	const captureOptions: RunProjectContextReportOptions = { repositoryRoot: options.repositoryRoot };
	const progress = createReportProgressRecorder(captureOptions);
	try {
		const outcome = runProjectContextReportInternal(
			requestValue,
			captureOptions,
			progress,
			true,
			options.includeTypeCapability === true
		);
		if (outcome.outcome === 'captured') return outcome;
		const terminal = progress.finish(outcome);
		if (terminal.outcome !== 'unavailable')
			throw new Error('The internal CAP-010 pipeline returned a terminal partial report.');
		return terminal;
	} catch (error) {
		progress.fail([], 'INTERNAL_FAILURE');
		throw error;
	}
}

export function projectContextReportExitCode(outcome: ProjectContextReportOutcome): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
