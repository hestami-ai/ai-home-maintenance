import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import {
	CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
	type ConditionalExportResolutionBuildInputs,
	type ConditionalExportResolutionBudgets,
	type ConditionalExportResolutionProgressEvent,
	type ConditionalExportResolutionSnapshot
} from '../contracts/conditional-export-resolution.js';
import {
	MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_SELECTION,
	type ModuleResolutionTraceBudgets,
	type ModuleResolutionTraceBuildInputs,
	type ModuleResolutionTraceProgressEvent,
	type ModuleResolutionTraceSnapshot
} from '../contracts/module-resolution-trace.js';
import {
	MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_RESULT_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS,
	MODULE_RESOLUTION_TRACE_REPORT_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_SELECTION,
	type ModuleResolutionTraceReportDiagnostic,
	type ModuleResolutionTraceReportFailureState,
	type ModuleResolutionTraceReportOutcome,
	type ModuleResolutionTraceReportRequest,
	type ModuleResolutionTraceReportStage,
	type ModuleResolutionTraceReportStageOutcomes
} from '../contracts/module-resolution-trace-report.js';
import {
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type ProjectContextGraphBudgets,
	type ProjectContextGraphSnapshot
} from '../contracts/project-context-graph.js';
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
import type { StaticSemanticSnapshotProgressEvent } from '../semantic/build-static-semantic-snapshot.js';
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
import { buildConditionalExportResolution } from '../resolution/build-conditional-export-resolution.js';
import { buildModuleResolutionTrace } from '../resolution/build-module-resolution-trace.js';

const REQUEST_KEYS = [
	'budgets',
	'importer',
	'operationVersion',
	'packageName',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const IMPORTER_KEYS = ['logicalPath', 'projectConfigPath', 'specifierNodeStart'] as const;
const BUDGET_KEYS = [
	'conditionalExport',
	'maxResultBytes',
	'moduleResolutionTrace',
	'projectContext',
	'semantic',
	'subject'
] as const;
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
const CONDITIONAL_EXPORT_BUDGET_KEYS = [
	'maxAstNodes',
	'maxBranches',
	'maxConditionChecks',
	'maxDiagnostics',
	'maxFrontiers',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxManifestBytes',
	'maxOutputRecords',
	'maxTraversalSteps'
] as const satisfies readonly (keyof ConditionalExportResolutionBudgets)[];
const MODULE_RESOLUTION_TRACE_BUDGET_KEYS = [
	'maxAstNodes',
	'maxAttempts',
	'maxCandidates',
	'maxDiagnostics',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxOutputRecords',
	'maxReadBytes',
	'maxTraversalSteps'
] as const satisfies readonly (keyof ModuleResolutionTraceBudgets)[];
const ZERO_CAPACITY_PROJECT_CONTEXT_BUDGET_KEYS = new Set<keyof ProjectContextGraphBudgets>([
	'maxProjectReferences',
	'maxSources'
]);
const ZERO_CAPACITY_CONDITIONAL_EXPORT_BUDGET_KEYS = new Set<
	keyof ConditionalExportResolutionBudgets
>(['maxBranches', 'maxConditionChecks', 'maxFrontiers']);
const FORBIDDEN_PATH_PATTERN_CHARACTERS = new Set(['*', '?', '[', ']', '{', '}']);
const INCOMPATIBLE_TRACE_DIAGNOSTIC_CODES = new Set([
	'RESOLUTION_UNAVAILABLE',
	'TARGET_UNAVAILABLE',
	'UNSUPPORTED_REQUEST'
]);

interface DiagnosticLike {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase?: string;
	readonly severity?: 'INFO' | 'WARNING' | 'ERROR';
}

export const MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-module-resolution-trace-report-progress/0.1.0' as const;

export const MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	compilerCaptureCurrentness: 'NOT_ASSESSED',
	dwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	targetArtifactCurrentness: 'NOT_ASSESSED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type ModuleResolutionTraceReportProgressPhase =
	| 'REQUEST_BIND'
	| 'SUBJECT_PROJECT_PATH_BIND'
	| 'SUBJECT_CAPTURE'
	| 'SEMANTIC_SNAPSHOT'
	| 'PROJECT_CONTEXT'
	| 'IMPORTER_SELECTOR'
	| 'CONDITIONAL_EXPORT'
	| 'MODULE_RESOLUTION_TRACE'
	| 'CURRENTNESS'
	| 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	CONDITIONAL_EXPORT: 'CONDITIONAL_EXPORT',
	CURRENTNESS: 'CURRENTNESS',
	IMPORTER_SELECTOR: 'MODULE_RESOLUTION_TRACE',
	MODULE_RESOLUTION_TRACE: 'MODULE_RESOLUTION_TRACE',
	PROJECT_CONTEXT: 'PROJECT_CONTEXT',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT',
	SEMANTIC_SNAPSHOT: 'SEMANTIC_SNAPSHOT',
	SUBJECT_CAPTURE: 'SUBJECT',
	SUBJECT_PROJECT_PATH_BIND: 'SUBJECT'
} as const satisfies Readonly<
	Record<ModuleResolutionTraceReportProgressPhase, ModuleResolutionTraceReportStage>
>);

export interface ModuleResolutionTraceReportProgressObservation {
	readonly limit: number | null;
	readonly metric: string;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

interface ProgressBase {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly nonclaims: typeof MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly ModuleResolutionTraceReportProgressObservation[];
	readonly operationVersion: typeof MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION;
	readonly phase: ModuleResolutionTraceReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_CAP_011_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: ModuleResolutionTraceReportStage;
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

export type ModuleResolutionTraceReportProgressEvent =
	| (ProgressBase & {
			readonly kind: 'REPORT_STAGE';
			readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
	  })
	| (ProgressBase & {
			readonly kind: 'SEMANTIC_SNAPSHOT';
			readonly phase: 'SEMANTIC_SNAPSHOT';
			readonly semanticProgress: StaticSemanticSnapshotProgressEvent;
			readonly state: StaticSemanticSnapshotProgressEvent['state'];
	  })
	| (ProgressBase & {
			readonly conditionalExportProgress: ConditionalExportResolutionProgressEvent;
			readonly kind: 'CONDITIONAL_EXPORT';
			readonly phase: 'CONDITIONAL_EXPORT';
			readonly state: ConditionalExportResolutionProgressEvent['state'];
	  })
	| (ProgressBase & {
			readonly kind: 'MODULE_RESOLUTION_TRACE';
			readonly moduleResolutionTraceProgress: ModuleResolutionTraceProgressEvent;
			readonly phase: 'MODULE_RESOLUTION_TRACE';
			readonly state: ModuleResolutionTraceProgressEvent['state'];
	  });

type ProgressEmission<
	Event extends ModuleResolutionTraceReportProgressEvent = ModuleResolutionTraceReportProgressEvent
> = Event extends ModuleResolutionTraceReportProgressEvent
	? Omit<
			Event,
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
	: never;

interface ProgressRecorder {
	complete(
		observations?: readonly ModuleResolutionTraceReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly ModuleResolutionTraceReportProgressObservation[],
		detailCode?: string | null
	): void;
	enabled(): boolean;
	finish(outcome: ModuleResolutionTraceReportOutcome): ModuleResolutionTraceReportOutcome;
	forwardConditional(event: ConditionalExportResolutionProgressEvent): void;
	forwardModuleResolution(event: ModuleResolutionTraceProgressEvent): void;
	forwardSemantic(event: StaticSemanticSnapshotProgressEvent): void;
	start(
		phase: ModuleResolutionTraceReportProgressPhase,
		observations?: readonly ModuleResolutionTraceReportProgressObservation[]
	): void;
}

function observation(
	metric: string,
	value: number,
	limit: number | null,
	unit: ModuleResolutionTraceReportProgressObservation['unit']
): ModuleResolutionTraceReportProgressObservation {
	return Object.freeze({
		limit,
		metric,
		unit,
		value: Number.isFinite(value) && value >= 0 ? Math.min(value, Number.MAX_SAFE_INTEGER) : 0
	});
}

function containRejectedObserverResult(result: unknown): void {
	if (result === undefined) return;
	void Promise.resolve(result).catch(() => {
		// Rejected thenables are contained like synchronous observer exceptions.
	});
}

export interface RunModuleResolutionTraceReportOptions {
	/** Trusted-host telemetry callback; it is excluded from terminal evidence and identity. */
	readonly onProgress?: (event: ModuleResolutionTraceReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

/**
 * Trusted application-only handoff for a same-process successor capability. It is deliberately not
 * exported from the package root and is never serialized as report evidence.
 */
export interface ModuleResolutionTraceReportPipelineCapture {
	readonly conditionalExportRequest: ConditionalExportResolutionBuildInputs['request'];
	readonly conditionalExportResolution: ConditionalExportResolutionSnapshot;
	readonly diagnostics: readonly ModuleResolutionTraceReportDiagnostic[];
	readonly frozenSubject: FrozenSubject;
	readonly moduleResolutionRequest: ModuleResolutionTraceBuildInputs['request'];
	readonly moduleResolutionTrace: ModuleResolutionTraceSnapshot;
	readonly outcome: 'captured';
	readonly predecessorStageOutcomes: {
		readonly conditionalExport: {
			readonly diagnosticCodes: readonly string[];
			readonly outcome: 'partial';
		};
		readonly moduleResolutionTrace: {
			readonly diagnosticCodes: readonly string[];
			readonly outcome: 'partial';
		};
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
	/** Canonical absolute root retained only for the same-process trusted successor. */
	readonly repositoryRoot: string;
	readonly request: ModuleResolutionTraceReportRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export type ModuleResolutionTraceReportPipelineOutcome =
	| ModuleResolutionTraceReportPipelineCapture
	| Extract<ModuleResolutionTraceReportOutcome, { readonly outcome: 'unavailable' }>;

function createProgressRecorder(options: RunModuleResolutionTraceReportOptions): ProgressRecorder {
	let sink: ((event: ModuleResolutionTraceReportProgressEvent) => unknown) | undefined;
	try {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		if (descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'function')
			sink = descriptor.value as (event: ModuleResolutionTraceReportProgressEvent) => unknown;
	} catch {
		// Observer inspection is best-effort and outside the evidence-producing path.
	}
	let active: ModuleResolutionTraceReportProgressPhase | null = null;
	let sequence = 0;
	let origin: bigint | null = null;
	let lastElapsedMs = 0;
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
	const emit = (event: ProgressEmission): void => {
		if (sink === undefined) return;
		try {
			sequence += 1;
			const materialized = Object.freeze({
				...event,
				deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' as const,
				elapsedMs: elapsed(),
				nonclaims: MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_NONCLAIMS,
				observations: Object.freeze([...event.observations]),
				operationVersion: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
				protocolRole: 'PRELIMINARY_CAP_011_REPORT_TELEMETRY' as const,
				reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
				schemaVersion: MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_SCHEMA_VERSION,
				sequence,
				wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET' as const
			}) as ModuleResolutionTraceReportProgressEvent;
			containRejectedObserverResult(sink(materialized));
		} catch {
			// Telemetry never changes terminal evidence.
		}
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly ModuleResolutionTraceReportProgressObservation[],
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
			stage: PROGRESS_PHASE_STAGE[phase],
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
		finish(outcome): ModuleResolutionTraceReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			return outcome;
		},
		forwardConditional(event): void {
			emit({
				conditionalExportProgress: event,
				detailCode: event.detailCode,
				kind: 'CONDITIONAL_EXPORT',
				observations: [],
				phase: 'CONDITIONAL_EXPORT',
				stage: 'CONDITIONAL_EXPORT',
				state: event.state
			});
		},
		forwardModuleResolution(event): void {
			emit({
				detailCode: event.detailCode,
				kind: 'MODULE_RESOLUTION_TRACE',
				moduleResolutionTraceProgress: event,
				observations: [],
				phase: 'MODULE_RESOLUTION_TRACE',
				stage: 'MODULE_RESOLUTION_TRACE',
				state: event.state
			});
		},
		forwardSemantic(event): void {
			emit({
				detailCode: event.detailCode,
				kind: 'SEMANTIC_SNAPSHOT',
				observations: [],
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
				stage: PROGRESS_PHASE_STAGE[phase],
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
		readonly state: ModuleResolutionTraceReportFailureState = 'incompatible'
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

function materializeRequest(value: unknown): ModuleResolutionTraceReportRequest {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.schemaVersion !== MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
			'The module-resolution-trace report request schema version is unsupported.',
			'$.schemaVersion'
		);
	if (record.operationVersion !== MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_VERSION_UNSUPPORTED',
			'The module-resolution-trace report operation version is unsupported.',
			'$.operationVersion'
		);

	const budgetsRecord = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const subject = materializeBudgetRecord(
		budgetsRecord.subject,
		SUBJECT_BUDGET_KEYS,
		MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS.subject,
		'$.budgets.subject'
	) as unknown as SubjectBudgets;
	const semantic = materializeBudgetRecord(
		budgetsRecord.semantic,
		SEMANTIC_BUDGET_KEYS,
		MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS.semantic,
		'$.budgets.semantic'
	) as unknown as SemanticBudgets;
	const projectContext = materializeBudgetRecord(
		budgetsRecord.projectContext,
		PROJECT_CONTEXT_BUDGET_KEYS,
		MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS.projectContext,
		'$.budgets.projectContext',
		ZERO_CAPACITY_PROJECT_CONTEXT_BUDGET_KEYS
	) as unknown as ProjectContextGraphBudgets;
	const conditionalExport = materializeBudgetRecord(
		budgetsRecord.conditionalExport,
		CONDITIONAL_EXPORT_BUDGET_KEYS,
		MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS.conditionalExport,
		'$.budgets.conditionalExport',
		ZERO_CAPACITY_CONDITIONAL_EXPORT_BUDGET_KEYS
	) as unknown as ConditionalExportResolutionBudgets;
	const moduleResolutionTrace = materializeBudgetRecord(
		budgetsRecord.moduleResolutionTrace,
		MODULE_RESOLUTION_TRACE_BUDGET_KEYS,
		MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS.moduleResolutionTrace,
		'$.budgets.moduleResolutionTrace'
	) as unknown as ModuleResolutionTraceBudgets;
	const maxResultBytes = boundedBudget(
		budgetsRecord.maxResultBytes,
		MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS.maxResultBytes,
		'$.budgets.maxResultBytes'
	);
	const importerRecord = exactDataRecord(record.importer, IMPORTER_KEYS, '$.importer');
	const logicalPath = materializePath(
		importerRecord.logicalPath,
		semantic.maxPathCharacters,
		'$.importer.logicalPath'
	);
	const projectConfigPath = materializePath(
		importerRecord.projectConfigPath,
		semantic.maxPathCharacters,
		'$.importer.projectConfigPath'
	);
	const specifierNodeStart = importerRecord.specifierNodeStart;
	if (
		typeof specifierNodeStart !== 'number' ||
		!Number.isSafeInteger(specifierNodeStart) ||
		Object.is(specifierNodeStart, -0) ||
		specifierNodeStart < 0
	)
		throw new ReportRequestError(
			'REQUEST_IMPORTER_INVALID',
			'$.importer.specifierNodeStart must be a nonnegative safe-integer UTF-16 coordinate.',
			'$.importer.specifierNodeStart'
		);
	if (typeof record.packageName !== 'string' || record.packageName.length === 0)
		throw new ReportRequestError(
			'REQUEST_PACKAGE_INVALID',
			'$.packageName must be one bounded bare workspace-package name.',
			'$.packageName'
		);
	if (record.packageName.length > semantic.maxLiteralCharacters)
		throw new ReportRequestError(
			'REQUEST_PACKAGE_BUDGET_EXCEEDED',
			'$.packageName exceeds the caller literal-character budget.',
			'$.packageName',
			'resource-refused'
		);
	if (
		!isUnicodeScalarString(record.packageName) ||
		!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(record.packageName)
	)
		throw new ReportRequestError(
			'REQUEST_PACKAGE_INVALID',
			'$.packageName must be one bounded bare workspace-package name.',
			'$.packageName'
		);
	const subjectProjectConfigPaths = materializeProjectPaths(
		record.subjectProjectConfigPaths,
		semantic.maxPathCharacters,
		Math.min(subject.maxProjects, semantic.maxProjects, projectContext.maxProjects)
	);

	return Object.freeze({
		budgets: Object.freeze({
			conditionalExport,
			maxResultBytes,
			moduleResolutionTrace,
			projectContext,
			semantic,
			subject
		}),
		importer: Object.freeze({ logicalPath, projectConfigPath, specifierNodeStart }),
		operationVersion: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
		packageName: record.packageName,
		schemaVersion: MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths
	});
}

export type ModuleResolutionTraceReportRequestAdmission =
	| {
			readonly outcome: 'admitted';
			readonly request: ModuleResolutionTraceReportRequest;
	  }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: ModuleResolutionTraceReportFailureState;
	  };

/** @internal Exact hostile-safe request admission shared only with same-process successor facades. */
export function admitModuleResolutionTraceReportRequest(
	requestValue: unknown
): ModuleResolutionTraceReportRequestAdmission {
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
): ModuleResolutionTraceReportDiagnostic {
	return { code, message, path, phase, severity, source: 'REPORT' };
}

function escapedRegularExpression(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function redactRoot(message: string, repositoryRoot: string): string {
	let redacted = message;
	for (const candidate of new Set([repositoryRoot, repositoryRoot.replaceAll('\\', '/')]))
		if (candidate.length > 0)
			redacted = redacted.replace(
				new RegExp(escapedRegularExpression(candidate), 'giu'),
				'<repository-root>'
			);
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

function projectedDiagnostics(
	diagnostics: readonly DiagnosticLike[],
	source: Exclude<ModuleResolutionTraceReportDiagnostic['source'], 'REPORT'>,
	repositoryRoot: string
): ModuleResolutionTraceReportDiagnostic[] {
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
	stage: ModuleResolutionTraceReportStage,
	state: ModuleResolutionTraceReportFailureState,
	diagnostics: readonly ModuleResolutionTraceReportDiagnostic[],
	request?: ModuleResolutionTraceReportRequest,
	subject?: FrozenSubject
): ModuleResolutionTraceReportOutcome {
	return {
		code,
		diagnostics,
		facadeNonclaims: MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS,
		operationVersion: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: MODULE_RESOLUTION_TRACE_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject: subject.descriptor })
	};
}

function hasBudgetDiagnostic(diagnostics: readonly DiagnosticLike[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.code.includes('BUDGET'));
}

function traceFailureState(
	diagnostics: readonly DiagnosticLike[]
): ModuleResolutionTraceReportFailureState {
	if (hasBudgetDiagnostic(diagnostics)) return 'resource-refused';
	return diagnostics.length > 0 &&
		diagnostics.every((diagnostic) => INCOMPATIBLE_TRACE_DIAGNOSTIC_CODES.has(diagnostic.code))
		? 'incompatible'
		: 'failed';
}

function subjectFailureIdentity(
	outcome: Exclude<SubjectResolutionOutcome, { readonly outcome: 'resolved' }>
): { readonly code: string; readonly state: ModuleResolutionTraceReportFailureState } {
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
	request: ModuleResolutionTraceReportRequest
): ReturnType<typeof resolveExistingRepositoryPath> | ModuleResolutionTraceReportOutcome {
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

function runInternal(
	requestValue: unknown,
	options: RunModuleResolutionTraceReportOptions,
	progress: ProgressRecorder,
	capturePipeline = false
): ModuleResolutionTraceReportOutcome | ModuleResolutionTraceReportPipelineCapture {
	progress.start('REQUEST_BIND');
	const admission = admitModuleResolutionTraceReportRequest(requestValue);
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
		operationVersion: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
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
	const subjectDiagnostics = projectedDiagnostics(
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
			observation(
				'SUBJECT_ARTIFACTS',
				subject.artifacts.length,
				request.budgets.subject.maxFiles,
				'COUNT'
			),
			observation(
				'SUBJECT_RETAINED_BYTES',
				subject.artifacts.reduce((total, artifact) => total + artifact.bytes, 0),
				request.budgets.subject.maxBytes,
				'BYTES'
			)
		],
		subjectOutcome.completeness
	);

	progress.start('SEMANTIC_SNAPSHOT');
	const semanticOutcome = buildStaticSemanticSnapshot(
		{
			assignabilityRequests: [],
			budgets: request.budgets.semantic,
			capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
			expectEmpty: false,
			operationVersion: SEMANTIC_OPERATION_VERSION,
			rootLocator: repositoryRoot,
			schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject },
		progress.enabled() ? { onProgress: (event) => progress.forwardSemantic(event) } : undefined
	);
	const semanticDiagnostics = projectedDiagnostics(
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
	progress.complete(
		[
			observation(
				'SEMANTIC_PROJECTS',
				snapshot.projects.length,
				request.budgets.semantic.maxProjects,
				'COUNT'
			),
			observation(
				'SEMANTIC_SOURCES',
				snapshot.sources.length,
				request.budgets.semantic.maxSources,
				'COUNT'
			)
		],
		semanticOutcome.outcome.toUpperCase()
	);

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
	const projectContextDiagnostics = projectedDiagnostics(
		projectContextOutcome.diagnostics,
		'PROJECT_CONTEXT',
		repositoryRoot
	);
	if (projectContextOutcome.outcome !== 'partial')
		return failure(
			'PROJECT_CONTEXT_UNAVAILABLE',
			'PROJECT_CONTEXT',
			hasBudgetDiagnostic(projectContextOutcome.diagnostics) ? 'resource-refused' : 'failed',
			projectContextDiagnostics,
			request,
			subject
		);
	const graph = projectContextOutcome.graph;
	progress.complete(
		[
			observation(
				'PROJECT_CONTEXT_PROGRAMS',
				graph.programs.length,
				request.budgets.projectContext.maxPrograms,
				'COUNT'
			),
			observation(
				'PROJECT_CONTEXT_SOURCES',
				graph.sources.length,
				request.budgets.projectContext.maxSources,
				'COUNT'
			)
		],
		'PARTIAL'
	);

	progress.start('IMPORTER_SELECTOR');
	const selectedProjects = snapshot.projects.filter(
		(project) => project.configPath === request.importer.projectConfigPath
	);
	if (selectedProjects.length !== 1)
		return failure(
			'IMPORTER_PROJECT_NOT_EXACT',
			'MODULE_RESOLUTION_TRACE',
			'incompatible',
			[
				reportDiagnostic(
					'IMPORTER_PROJECT_NOT_EXACT',
					'The importer project selector must bind exactly one semantic project.',
					request.importer.projectConfigPath
				)
			],
			request,
			subject
		);
	const selectedProject = selectedProjects[0]!;
	const importerSources = snapshot.sources.filter(
		(source) =>
			source.projectId === selectedProject.id &&
			source.programId === selectedProject.programId &&
			source.logicalPath === request.importer.logicalPath &&
			source.analysisDisposition === 'DEEP_INDEXED'
	);
	if (importerSources.length !== 1)
		return failure(
			'IMPORTER_SOURCE_NOT_EXACT',
			'MODULE_RESOLUTION_TRACE',
			'incompatible',
			[
				reportDiagnostic(
					'IMPORTER_SOURCE_NOT_EXACT',
					'The importer path must bind exactly one deep-indexed source in the selected Program.',
					request.importer.logicalPath
				)
			],
			request,
			subject
		);
	const importerSource = importerSources[0]!;
	const selectorTraversalSteps = snapshot.astNodes.length + snapshot.moduleResolutions.length;
	if (selectorTraversalSteps > request.budgets.moduleResolutionTrace.maxTraversalSteps)
		return failure(
			'IMPORTER_SELECTOR_BUDGET_EXCEEDED',
			'MODULE_RESOLUTION_TRACE',
			'resource-refused',
			[
				reportDiagnostic(
					'IMPORTER_SELECTOR_BUDGET_EXCEEDED',
					'The exact importer selector exceeds the caller module-resolution traversal budget.',
					request.importer.logicalPath,
					'IMPORTER_SELECTOR'
				)
			],
			request,
			subject
		);
	const selectedStartNodeIds = new Set(
		snapshot.astNodes
			.filter(
				(node) =>
					node.sourceId === importerSource.id && node.start === request.importer.specifierNodeStart
			)
			.map((node) => node.id)
	);
	let importerResolution: (typeof snapshot.moduleResolutions)[number] | null = null;
	let importerResolutionCount = 0;
	for (const resolution of snapshot.moduleResolutions) {
		if (
			resolution.sourceId !== importerSource.id ||
			resolution.occurrenceKind !== MODULE_RESOLUTION_TRACE_REPORT_SELECTION.occurrenceKind ||
			resolution.specifierState !== 'LITERAL' ||
			resolution.specifier !== request.packageName ||
			resolution.typeOnly !== MODULE_RESOLUTION_TRACE_REPORT_SELECTION.typeOnly ||
			resolution.resolutionState !== 'RESOLVED_SOURCE' ||
			!selectedStartNodeIds.has(resolution.nodeId)
		)
			continue;
		importerResolutionCount += 1;
		if (importerResolutionCount === 1) importerResolution = resolution;
	}
	if (importerResolutionCount !== 1 || importerResolution === null)
		return failure(
			'IMPORT_OCCURRENCE_NOT_EXACT',
			'MODULE_RESOLUTION_TRACE',
			'incompatible',
			[
				reportDiagnostic(
					'IMPORT_OCCURRENCE_NOT_EXACT',
					'The importer selector must bind exactly one supported literal bare import occurrence.',
					request.importer.logicalPath
				)
			],
			request,
			subject
		);
	const contextSources = graph.sources.filter(
		(source) => source.semanticSourceId === importerSource.id
	);
	const contextPrograms = graph.programs.filter(
		(program) => program.semanticProgramId === importerSource.programId
	);
	const selectedWorkspaces = subject.workspaces.filter(
		(workspace) => workspace.kind === 'PACKAGE' && workspace.name === request.packageName
	);
	if (
		contextSources.length !== 1 ||
		contextPrograms.length !== 1 ||
		selectedWorkspaces.length !== 1
	)
		return failure(
			'IMPORT_PREDECESSOR_BINDING_NOT_EXACT',
			'MODULE_RESOLUTION_TRACE',
			'incompatible',
			[
				reportDiagnostic(
					'IMPORT_PREDECESSOR_BINDING_NOT_EXACT',
					'The selected importer and package must bind one exact project-context source, Program, and frozen workspace.',
					null
				)
			],
			request,
			subject
		);
	const contextSource = contextSources[0]!;
	const contextProgram = contextPrograms[0]!;
	const selectedWorkspace = selectedWorkspaces[0]!;
	progress.complete(
		[
			observation(
				'IMPORTER_SELECTOR_TRAVERSAL_STEPS',
				selectorTraversalSteps,
				request.budgets.moduleResolutionTrace.maxTraversalSteps,
				'COUNT'
			)
		],
		'EXACT_IMPORTER_AND_WORKSPACE_BOUND'
	);

	progress.start('CONDITIONAL_EXPORT');
	const conditionalInputs: ConditionalExportResolutionBuildInputs = {
		frozenSubject: subject,
		projectContextGraph: graph,
		request: {
			budgets: request.budgets.conditionalExport,
			conditions: MODULE_RESOLUTION_TRACE_REPORT_SELECTION.conditions,
			consumer: {
				projectContextProgramId: contextProgram.id,
				projectContextSourceId: contextSource.id,
				semanticProgramId: contextProgram.semanticProgramId,
				semanticSourceId: contextSource.semanticSourceId
			},
			exportSubpath: MODULE_RESOLUTION_TRACE_REPORT_SELECTION.exportSubpath,
			manifestPath: selectedWorkspace.manifestPath,
			moduleMode: MODULE_RESOLUTION_TRACE_REPORT_SELECTION.moduleMode,
			operationVersion: CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
			packageName: request.packageName,
			platform: MODULE_RESOLUTION_TRACE_REPORT_SELECTION.platform,
			projectContextGraph: {
				contentDigest: graph.contentDigest,
				graphId: graph.id,
				inputDigest: graph.inputDigest
			},
			schemaVersion: CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
			selection: CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
			semanticSnapshotId: snapshot.id,
			subjectId: subject.descriptor.subjectId
		},
		semanticSnapshot: snapshot
	};
	const conditionalOutcome = buildConditionalExportResolution(
		conditionalInputs,
		progress.enabled() ? { onProgress: (event) => progress.forwardConditional(event) } : undefined
	);
	const conditionalDiagnostics = projectedDiagnostics(
		conditionalOutcome.diagnostics,
		'CONDITIONAL_EXPORT',
		repositoryRoot
	);
	if (conditionalOutcome.outcome !== 'partial')
		return failure(
			'CONDITIONAL_EXPORT_UNAVAILABLE',
			'CONDITIONAL_EXPORT',
			hasBudgetDiagnostic(conditionalOutcome.diagnostics) ? 'resource-refused' : 'failed',
			conditionalDiagnostics,
			request,
			subject
		);
	const conditionalResolution = conditionalOutcome.resolution;
	if (conditionalResolution.decision.state !== 'SELECTED_TARGET')
		return failure(
			'CONDITIONAL_EXPORT_TARGET_UNAVAILABLE',
			'CONDITIONAL_EXPORT',
			'incompatible',
			[
				...conditionalDiagnostics,
				reportDiagnostic(
					'CONDITIONAL_EXPORT_TARGET_UNAVAILABLE',
					'The fixed types/import/node package-root slice did not select one supported target.',
					selectedWorkspace.manifestPath
				)
			],
			request,
			subject
		);
	progress.complete(
		[
			observation(
				'CONDITIONAL_EXPORT_BRANCHES',
				conditionalResolution.branches.length,
				request.budgets.conditionalExport.maxBranches,
				'COUNT'
			),
			observation(
				'CONDITIONAL_EXPORT_FRONTIERS',
				conditionalResolution.frontiers.length,
				request.budgets.conditionalExport.maxFrontiers,
				'COUNT'
			)
		],
		conditionalResolution.decision.state
	);

	progress.start('MODULE_RESOLUTION_TRACE');
	const traceInputs: ModuleResolutionTraceBuildInputs = {
		conditionalExportRequest: conditionalInputs.request,
		conditionalExportResolution: conditionalResolution,
		frozenSubject: subject,
		projectContextGraph: graph,
		request: {
			budgets: request.budgets.moduleResolutionTrace,
			conditionalExportResolution: {
				contentDigest: conditionalResolution.contentDigest,
				id: conditionalResolution.id,
				inputDigest: conditionalResolution.inputDigest
			},
			importer: {
				projectContextProgramId: contextProgram.id,
				projectContextSourceId: contextSource.id,
				semanticModuleResolutionId: importerResolution.id,
				semanticProgramId: importerSource.programId,
				semanticSourceId: importerSource.id,
				specifierNodeId: importerResolution.nodeId
			},
			operationVersion: MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
			packageName: request.packageName,
			projectContextGraph: {
				contentDigest: graph.contentDigest,
				graphId: graph.id,
				inputDigest: graph.inputDigest
			},
			schemaVersion: MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION,
			selection: MODULE_RESOLUTION_TRACE_SELECTION,
			semanticSnapshotId: snapshot.id,
			specifier: request.packageName,
			subjectId: subject.descriptor.subjectId
		},
		semanticSnapshot: snapshot
	};
	const traceOutcome = buildModuleResolutionTrace(
		traceInputs,
		progress.enabled()
			? { onProgress: (event) => progress.forwardModuleResolution(event) }
			: undefined
	);
	const traceDiagnostics = projectedDiagnostics(
		traceOutcome.diagnostics,
		'MODULE_RESOLUTION_TRACE',
		repositoryRoot
	);
	if (traceOutcome.outcome !== 'partial')
		return failure(
			'MODULE_RESOLUTION_TRACE_UNAVAILABLE',
			'MODULE_RESOLUTION_TRACE',
			traceFailureState(traceOutcome.diagnostics),
			traceDiagnostics,
			request,
			subject
		);
	const trace = traceOutcome.trace;
	progress.complete(
		[
			observation(
				'MODULE_RESOLUTION_ATTEMPTS',
				trace.attempts.length,
				request.budgets.moduleResolutionTrace.maxAttempts,
				'COUNT'
			),
			observation(
				'MODULE_RESOLUTION_CANDIDATES',
				trace.candidates.length,
				request.budgets.moduleResolutionTrace.maxCandidates,
				'COUNT'
			)
		],
		'PARTIAL'
	);
	const predecessorStageOutcomes: ModuleResolutionTraceReportPipelineCapture['predecessorStageOutcomes'] =
		{
			conditionalExport: {
				diagnosticCodes: conditionalOutcome.diagnostics.map((diagnostic) => diagnostic.code),
				outcome: 'partial'
			},
			moduleResolutionTrace: {
				diagnosticCodes: traceOutcome.diagnostics.map((diagnostic) => diagnostic.code),
				outcome: 'partial'
			},
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
			conditionalExportRequest: conditionalInputs.request,
			conditionalExportResolution: conditionalResolution,
			diagnostics: Object.freeze([
				...subjectDiagnostics,
				...semanticDiagnostics,
				...projectContextDiagnostics,
				...conditionalDiagnostics,
				...traceDiagnostics
			]),
			frozenSubject: subject,
			moduleResolutionRequest: traceInputs.request,
			moduleResolutionTrace: trace,
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
	const currentnessDiagnostics = projectedDiagnostics(
		freshness.diagnostics,
		'CURRENTNESS',
		repositoryRoot
	);
	progress.complete(
		[observation('CURRENTNESS_CHANGED_PATHS', freshness.changedPaths.length, null, 'COUNT')],
		currentnessState
	);

	progress.start('RESULT');
	if (
		trace.conditionalExportResolution.id !== conditionalResolution.id ||
		trace.projectContextGraph.graphId !== graph.id ||
		trace.importerWitness.semanticModuleResolutionId !== importerResolution.id ||
		trace.importerWitness.start !== request.importer.specifierNodeStart ||
		trace.importerWitness.logicalPath !== request.importer.logicalPath ||
		trace.targetWitness.packageName !== request.packageName ||
		trace.targetWitness.packageExportTarget !== conditionalResolution.decision.target
	)
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The project-context, conditional-export, importer, or target evidence does not reconcile.'
				)
			],
			request,
			subject
		);
	const stageOutcomes: ModuleResolutionTraceReportStageOutcomes = {
		...predecessorStageOutcomes,
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		}
	};
	const report: ModuleResolutionTraceReportOutcome = {
		diagnostics: [
			...subjectDiagnostics,
			...semanticDiagnostics,
			...projectContextDiagnostics,
			...conditionalDiagnostics,
			...traceDiagnostics,
			...currentnessDiagnostics
		],
		operationVersion: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				id: 'JAN-CSAA-CAP-011',
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				status: 'PARTIAL'
			},
			currentness: {
				changedPaths: freshness.changedPaths,
				compilerCapture: 'NOT_ASSESSED',
				contextOnlyTarget: 'NOT_ASSESSED',
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: {
				conditionalExportResolution: conditionalResolution,
				encoding:
					'FULL_VALIDATED_PROJECT_CONTEXT_CONDITIONAL_EXPORT_DECISION_AND_MODULE_RESOLUTION_TRACE',
				moduleResolutionTrace: trace,
				projectContextGraph: graph
			},
			facadeNonclaims: MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS,
			importer: {
				logicalPath: request.importer.logicalPath,
				projectConfigPath: request.importer.projectConfigPath,
				semanticModuleResolutionId: importerResolution.id,
				specifier: request.packageName,
				specifierNodeStart: request.importer.specifierNodeStart
			},
			interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_MODULE_RESOLUTION_TRACE',
			predecessorNonclaims: MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS,
			resolvedTarget: {
				contentSha256: trace.targetWitness.contentSha256,
				extension: trace.targetWitness.extension,
				logicalPath: trace.targetWitness.logicalPath,
				originalResolvedLogicalPath: trace.targetWitness.originalResolvedLogicalPath,
				packageExportTarget: trace.targetWitness.packageExportTarget
			},
			resolverEnvironment: trace.resolverEnvironment,
			schemaVersion: MODULE_RESOLUTION_TRACE_REPORT_RESULT_SCHEMA_VERSION,
			selection: MODULE_RESOLUTION_TRACE_REPORT_SELECTION,
			semanticSnapshotSummary: {
				id: snapshot.id,
				programs: snapshot.programs.length,
				projects: snapshot.projects.length,
				sources: snapshot.sources.length
			}
		},
		schemaVersion: MODULE_RESOLUTION_TRACE_REPORT_SCHEMA_VERSION,
		stageOutcomes,
		state: 'partial',
		subject: subject.descriptor
	};
	try {
		const resultBytes = canonicalSemanticJsonWitness(report).bytes + 1;
		if (resultBytes > request.budgets.maxResultBytes) {
			progress.fail(
				[observation('RESULT_BYTES', resultBytes, request.budgets.maxResultBytes, 'BYTES')],
				'RESULT_BUDGET_EXCEEDED'
			);
			return failure(
				'RESULT_BUDGET_EXCEEDED',
				'RESULT',
				'resource-refused',
				[
					reportDiagnostic(
						'RESULT_BUDGET_EXCEEDED',
						'The admitted module-resolution-trace report exceeds maxResultBytes.'
					)
				],
				request,
				subject
			);
		}
		progress.complete(
			[observation('RESULT_BYTES', resultBytes, request.budgets.maxResultBytes, 'BYTES')],
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

export function runModuleResolutionTraceReport(
	requestValue: unknown,
	options: RunModuleResolutionTraceReportOptions
): ModuleResolutionTraceReportOutcome {
	const progress = createProgressRecorder(options);
	try {
		const outcome = runInternal(requestValue, options, progress);
		if (outcome.outcome === 'captured')
			throw new Error('The public CAP-011 report path returned an internal pipeline capture.');
		return progress.finish(outcome);
	} catch (error) {
		progress.fail([], 'INTERNAL_FAILURE');
		throw error;
	}
}

/** @internal Same-process successor seam; never export from the package root or serialize. */
export function captureModuleResolutionTraceReportPipeline(
	requestValue: unknown,
	options: RunModuleResolutionTraceReportOptions
): ModuleResolutionTraceReportPipelineOutcome {
	const progress = createProgressRecorder(options);
	try {
		const outcome = runInternal(requestValue, options, progress, true);
		if (outcome.outcome === 'captured') return outcome;
		const terminal = progress.finish(outcome);
		if (terminal.outcome !== 'unavailable')
			throw new Error('The internal CAP-011 pipeline returned a terminal partial report.');
		return terminal;
	} catch (error) {
		progress.fail([], 'INTERNAL_FAILURE');
		throw error;
	}
}

export function moduleResolutionTraceReportExitCode(
	outcome: ModuleResolutionTraceReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
