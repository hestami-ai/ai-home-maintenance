import { isAbsolute } from 'node:path';

import {
	DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SELECTION,
	type DeclarationContextAnalysisBudgets,
	type DeclarationContextAnalysisBuildInputs
} from '../contracts/declaration-context-analysis.js';
import {
	DECLARATION_CONTEXT_REPORT_NONCLAIMS,
	DECLARATION_CONTEXT_REPORT_OPERATION_VERSION,
	DECLARATION_CONTEXT_REPORT_PREDECESSOR_NONCLAIMS,
	DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	DECLARATION_CONTEXT_REPORT_RESULT_SCHEMA_VERSION,
	DECLARATION_CONTEXT_REPORT_SAFETY_CEILINGS,
	DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION,
	DECLARATION_CONTEXT_REPORT_SELECTION,
	type DeclarationContextReportDiagnostic,
	type DeclarationContextReportFailureState,
	type DeclarationContextReportOutcome,
	type DeclarationContextReportRequest,
	type DeclarationContextReportStage,
	type DeclarationContextReportStageOutcomes
} from '../contracts/declaration-context-report.js';
import {
	MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
	type ModuleResolutionTraceReportRequest
} from '../contracts/module-resolution-trace-report.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import { buildDeclarationContextAnalysis } from '../semantic/build-declaration-context-analysis.js';
import {
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { assertCanonicalRelativePath, repositoryRelativePath } from '../subject/paths.js';
import {
	admitModuleResolutionTraceReportRequest,
	captureModuleResolutionTraceReportPipeline,
	type ModuleResolutionTraceReportPipelineCapture,
	type ModuleResolutionTraceReportProgressEvent,
	type RunModuleResolutionTraceReportOptions
} from './run-module-resolution-trace-report.js';

const REQUEST_KEYS = [
	'budgets',
	'exportName',
	'importer',
	'operationVersion',
	'packageName',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = [
	'conditionalExport',
	'declarationContext',
	'maxResultBytes',
	'moduleResolutionTrace',
	'projectContext',
	'semantic',
	'subject'
] as const;
const DECLARATION_CONTEXT_BUDGET_KEYS = [
	'maxAliasHops',
	'maxArtifacts',
	'maxCompilerInputAttempts',
	'maxDeclarations',
	'maxDiagnostics',
	'maxDurationMs',
	'maxExportSymbols',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxOutputRecords',
	'maxParsedArtifactAstNodes',
	'maxProgramAstNodes',
	'maxProgramReadBytes',
	'maxProgramSourceFiles',
	'maxReadBytes',
	'maxRelations',
	'maxTraversalSteps'
] as const satisfies readonly (keyof DeclarationContextAnalysisBudgets)[];

interface DeclarationContextAdmission {
	readonly declarationContextBudgets: DeclarationContextAnalysisBudgets;
	readonly exportName: string;
	readonly predecessorRequest: ModuleResolutionTraceReportRequest;
}

export const DECLARATION_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-declaration-context-report-progress/0.1.0' as const;

export const DECLARATION_CONTEXT_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	compilerCaptureCurrentness: 'NOT_ASSESSED',
	dwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: DECLARATION_CONTEXT_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	targetArtifactCurrentness: 'NOT_ASSESSED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type DeclarationContextReportProgressPhase =
	'REQUEST_BIND' | 'PREDECESSOR_PIPELINE' | 'DECLARATION_CONTEXT' | 'CURRENTNESS' | 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	CURRENTNESS: 'CURRENTNESS',
	DECLARATION_CONTEXT: 'DECLARATION_CONTEXT',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT'
} as const satisfies Readonly<
	Record<DeclarationContextReportProgressPhase, DeclarationContextReportStage>
>);

export interface DeclarationContextReportProgressObservation {
	readonly limit: number | null;
	readonly metric: string;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

interface ProgressBase {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly nonclaims: typeof DECLARATION_CONTEXT_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly DeclarationContextReportProgressObservation[];
	readonly operationVersion: typeof DECLARATION_CONTEXT_REPORT_OPERATION_VERSION;
	readonly phase: DeclarationContextReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_CAP_013_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof DECLARATION_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: DeclarationContextReportStage;
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

export type DeclarationContextReportProgressEvent =
	| (ProgressBase & {
			readonly kind: 'REPORT_STAGE';
			readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
	  })
	| (ProgressBase & {
			readonly kind: 'PREDECESSOR_PIPELINE';
			readonly phase: 'PREDECESSOR_PIPELINE';
			readonly predecessorProgress: ModuleResolutionTraceReportProgressEvent;
			readonly state: ModuleResolutionTraceReportProgressEvent['state'];
	  });

type ProgressEmission<
	Event extends DeclarationContextReportProgressEvent = DeclarationContextReportProgressEvent
> = Event extends DeclarationContextReportProgressEvent
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
		observations?: readonly DeclarationContextReportProgressObservation[],
		detailCode?: string | null
	): void;
	enabled(): boolean;
	fail(
		observations?: readonly DeclarationContextReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: DeclarationContextReportOutcome): DeclarationContextReportOutcome;
	forwardPredecessor(event: ModuleResolutionTraceReportProgressEvent): void;
	start(
		phase: DeclarationContextReportProgressPhase,
		observations?: readonly DeclarationContextReportProgressObservation[]
	): void;
}

function observation(
	metric: string,
	value: number,
	limit: number | null,
	unit: DeclarationContextReportProgressObservation['unit']
): DeclarationContextReportProgressObservation {
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

export interface RunDeclarationContextReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: DeclarationContextReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

function createProgressRecorder(options: RunDeclarationContextReportOptions): ProgressRecorder {
	let sink: ((event: DeclarationContextReportProgressEvent) => unknown) | undefined;
	try {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		if (descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'function')
			sink = descriptor.value as (event: DeclarationContextReportProgressEvent) => unknown;
	} catch {
		// Observer inspection is best-effort and outside the evidence-producing path.
	}
	let active: DeclarationContextReportProgressPhase | null = null;
	let sealed = false;
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
		if (sink === undefined || sealed) return;
		try {
			sequence += 1;
			const materialized = Object.freeze({
				...event,
				deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' as const,
				elapsedMs: elapsed(),
				nonclaims: DECLARATION_CONTEXT_REPORT_PROGRESS_NONCLAIMS,
				observations: Object.freeze([...event.observations]),
				operationVersion: DECLARATION_CONTEXT_REPORT_OPERATION_VERSION,
				protocolRole: 'PRELIMINARY_CAP_013_REPORT_TELEMETRY' as const,
				reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
				schemaVersion: DECLARATION_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION,
				sequence,
				wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET' as const
			}) as DeclarationContextReportProgressEvent;
			containRejectedObserverResult(sink(materialized));
		} catch {
			// Telemetry never changes terminal evidence.
		}
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly DeclarationContextReportProgressObservation[],
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
		finish(outcome): DeclarationContextReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			sealed = true;
			return outcome;
		},
		forwardPredecessor(event): void {
			emit({
				detailCode: event.detailCode,
				kind: 'PREDECESSOR_PIPELINE',
				observations: [],
				phase: 'PREDECESSOR_PIPELINE',
				predecessorProgress: event,
				stage: 'PREDECESSOR_PIPELINE',
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
		readonly state: DeclarationContextReportFailureState = 'incompatible'
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

function materializeDeclarationContextBudgets(value: unknown): DeclarationContextAnalysisBudgets {
	const record = exactDataRecord(
		value,
		DECLARATION_CONTEXT_BUDGET_KEYS,
		'$.budgets.declarationContext'
	);
	const budgets = Object.fromEntries(
		DECLARATION_CONTEXT_BUDGET_KEYS.map((key) => [
			key,
			boundedBudget(
				record[key],
				DECLARATION_CONTEXT_REPORT_SAFETY_CEILINGS.declarationContext[key],
				`$.budgets.declarationContext.${key}`,
				key === 'maxAliasHops'
			)
		])
	) as unknown as DeclarationContextAnalysisBudgets;
	if (budgets.maxInputRecords < budgets.maxCompilerInputAttempts)
		throw new ReportRequestError(
			'REQUEST_BUDGET_INVALID',
			'$.budgets.declarationContext.maxInputRecords must cover maxCompilerInputAttempts.',
			'$.budgets.declarationContext.maxInputRecords'
		);
	if (budgets.maxReadBytes < budgets.maxProgramReadBytes)
		throw new ReportRequestError(
			'REQUEST_BUDGET_INVALID',
			'$.budgets.declarationContext.maxReadBytes must cover maxProgramReadBytes.',
			'$.budgets.declarationContext.maxReadBytes'
		);
	return Object.freeze(budgets);
}

function materializeAdmission(value: unknown): DeclarationContextAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== DECLARATION_CONTEXT_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const declarationContextBudgets = materializeDeclarationContextBudgets(
		budgets.declarationContext
	);
	if (
		typeof record.exportName !== 'string' ||
		!isUnicodeScalarString(record.exportName) ||
		record.exportName.length === 0
	)
		throw new ReportRequestError(
			'REQUEST_EXPORT_NAME_INVALID',
			'$.exportName must be nonempty Unicode-scalar text.',
			'$.exportName'
		);
	if (
		record.exportName.length > 10_000 ||
		record.exportName.length > declarationContextBudgets.maxInputStringCharacters
	)
		throw new ReportRequestError(
			'REQUEST_EXPORT_NAME_BUDGET_EXCEEDED',
			'$.exportName exceeds the admitted string-character budget.',
			'$.exportName',
			'resource-refused'
		);
	const predecessorAdmission = admitModuleResolutionTraceReportRequest({
		budgets: {
			conditionalExport: budgets.conditionalExport,
			maxResultBytes: budgets.maxResultBytes,
			moduleResolutionTrace: budgets.moduleResolutionTrace,
			projectContext: budgets.projectContext,
			semantic: budgets.semantic,
			subject: budgets.subject
		},
		importer: record.importer,
		operationVersion: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
		packageName: record.packageName,
		schemaVersion: MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: record.subjectProjectConfigPaths
	});
	if (predecessorAdmission.outcome === 'rejected')
		throw new ReportRequestError(
			predecessorAdmission.code,
			predecessorAdmission.message,
			predecessorAdmission.path,
			predecessorAdmission.state
		);
	return Object.freeze({
		declarationContextBudgets,
		exportName: record.exportName,
		predecessorRequest: predecessorAdmission.request
	});
}

function materializedRequest(
	admission: DeclarationContextAdmission,
	predecessor: ModuleResolutionTraceReportRequest
): DeclarationContextReportRequest {
	return Object.freeze({
		budgets: Object.freeze({
			...predecessor.budgets,
			declarationContext: admission.declarationContextBudgets
		}),
		exportName: admission.exportName,
		importer: predecessor.importer,
		operationVersion: DECLARATION_CONTEXT_REPORT_OPERATION_VERSION,
		packageName: predecessor.packageName,
		schemaVersion: DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: predecessor.subjectProjectConfigPaths
	});
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	source: DeclarationContextReportDiagnostic['source'] = 'REPORT',
	severity: DeclarationContextReportDiagnostic['severity'] = null,
	predecessorSource: DeclarationContextReportDiagnostic['predecessorSource'] = null
): DeclarationContextReportDiagnostic {
	return { code, message, path, phase, predecessorSource, severity, source };
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

function predecessorDiagnostics(
	capture: ModuleResolutionTraceReportPipelineCapture,
	repositoryRoot: string
): DeclarationContextReportDiagnostic[] {
	return capture.diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(diagnostic.path, repositoryRoot),
			diagnostic.phase,
			'PREDECESSOR_PIPELINE',
			diagnostic.severity,
			diagnostic.source
		)
	);
}

function failure(
	code: string,
	stage: DeclarationContextReportStage,
	state: DeclarationContextReportFailureState,
	diagnostics: readonly DeclarationContextReportDiagnostic[],
	request?: DeclarationContextReportRequest,
	subject?: ModuleResolutionTraceReportPipelineCapture['frozenSubject']['descriptor']
): DeclarationContextReportOutcome {
	return {
		code,
		diagnostics,
		facadeNonclaims: DECLARATION_CONTEXT_REPORT_NONCLAIMS,
		operationVersion: DECLARATION_CONTEXT_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: DECLARATION_CONTEXT_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

function declarationFailureState(
	diagnostics: readonly { readonly code: string }[]
): DeclarationContextReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXCEEDED'))
		return 'resource-refused';
	if (
		diagnostics.some(
			(diagnostic) =>
				diagnostic.code === 'TARGET_UNAVAILABLE' || diagnostic.code === 'UNSUPPORTED_REQUEST'
		)
	)
		return 'incompatible';
	return 'failed';
}

function runInternal(
	requestValue: unknown,
	options: RunDeclarationContextReportOptions,
	progress: ProgressRecorder
): DeclarationContextReportOutcome {
	progress.start('REQUEST_BIND');
	let admission: DeclarationContextAdmission;
	try {
		admission = materializeAdmission(requestValue);
	} catch (error) {
		if (error instanceof ReportRequestError)
			return failure(error.code, 'REQUEST', error.state, [
				reportDiagnostic(error.code, error.message, error.path, 'REQUEST')
			]);
		return failure('REQUEST_INVALID', 'REQUEST', 'incompatible', [
			reportDiagnostic('REQUEST_INVALID', 'The report request could not be inspected safely.', '$')
		]);
	}
	progress.complete([], 'REQUEST_ADMITTED');

	progress.start('PREDECESSOR_PIPELINE');
	const predecessorOptions: RunModuleResolutionTraceReportOptions = {
		repositoryRoot: options.repositoryRoot,
		...(progress.enabled() ? { onProgress: (event) => progress.forwardPredecessor(event) } : {})
	};
	const predecessor = captureModuleResolutionTraceReportPipeline(
		admission.predecessorRequest,
		predecessorOptions
	);
	if (predecessor.outcome !== 'captured') {
		progress.fail([], predecessor.code);
		const request =
			predecessor.request === undefined
				? undefined
				: materializedRequest(admission, predecessor.request);
		return failure(
			predecessor.code,
			'PREDECESSOR_PIPELINE',
			predecessor.state,
			predecessor.diagnostics.map((diagnostic) =>
				reportDiagnostic(
					diagnostic.code,
					diagnostic.message,
					diagnostic.path,
					diagnostic.phase,
					'PREDECESSOR_PIPELINE',
					diagnostic.severity,
					diagnostic.source
				)
			),
			request,
			predecessor.subject
		);
	}
	const request = materializedRequest(admission, predecessor.request);
	progress.complete(
		[
			observation(
				'PREDECESSOR_TRACE_ATTEMPTS',
				predecessor.moduleResolutionTrace.attempts.length,
				request.budgets.moduleResolutionTrace.maxAttempts,
				'COUNT'
			)
		],
		'CAP_010_012_011_CAPTURED'
	);

	const repositoryRoot = predecessor.repositoryRoot;
	const inheritedDiagnostics = predecessorDiagnostics(predecessor, repositoryRoot);

	progress.start('DECLARATION_CONTEXT');
	const declarationInputs: DeclarationContextAnalysisBuildInputs = {
		conditionalExportRequest: predecessor.conditionalExportRequest,
		conditionalExportResolution: predecessor.conditionalExportResolution,
		frozenSubject: predecessor.frozenSubject,
		moduleResolutionRequest: predecessor.moduleResolutionRequest,
		moduleResolutionTrace: predecessor.moduleResolutionTrace,
		projectContextGraph: predecessor.projectContextGraph,
		request: {
			budgets: request.budgets.declarationContext,
			conditionalExportResolution: {
				contentDigest: predecessor.conditionalExportResolution.contentDigest,
				id: predecessor.conditionalExportResolution.id,
				inputDigest: predecessor.conditionalExportResolution.inputDigest
			},
			exportName: request.exportName,
			moduleResolutionTrace: {
				contentDigest: predecessor.moduleResolutionTrace.contentDigest,
				id: predecessor.moduleResolutionTrace.id,
				inputDigest: predecessor.moduleResolutionTrace.inputDigest
			},
			operationVersion: DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
			projectContextGraph: {
				contentDigest: predecessor.projectContextGraph.contentDigest,
				graphId: predecessor.projectContextGraph.id,
				inputDigest: predecessor.projectContextGraph.inputDigest
			},
			schemaVersion: DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION,
			selection: DECLARATION_CONTEXT_ANALYSIS_SELECTION,
			semanticSnapshotId: predecessor.semanticSnapshot.id,
			subjectId: predecessor.frozenSubject.descriptor.subjectId
		},
		semanticSnapshot: predecessor.semanticSnapshot
	};
	// CAP-013 deliberately delivers its observer telemetry after returning. The facade emits
	// its own synchronous stage boundaries so RESULT remains the terminal progress stage.
	const declarationOutcome = buildDeclarationContextAnalysis(declarationInputs);
	const declarationDiagnostics = declarationOutcome.diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(diagnostic.path, repositoryRoot),
			diagnostic.phase,
			'DECLARATION_CONTEXT'
		)
	);
	if (declarationOutcome.outcome !== 'partial') {
		progress.fail([], declarationOutcome.diagnostics[0]?.code ?? 'DECLARATION_CONTEXT_UNAVAILABLE');
		return failure(
			'DECLARATION_CONTEXT_UNAVAILABLE',
			'DECLARATION_CONTEXT',
			declarationFailureState(declarationOutcome.diagnostics),
			[...inheritedDiagnostics, ...declarationDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const analysis = declarationOutcome.analysis;
	progress.complete(
		[
			observation(
				'DECLARATION_CONTEXT_DECLARATIONS',
				analysis.declarations.length,
				request.budgets.declarationContext.maxDeclarations,
				'COUNT'
			),
			observation(
				'DECLARATION_CONTEXT_RELATIONS',
				analysis.relations.length,
				request.budgets.declarationContext.maxRelations,
				'COUNT'
			)
		],
		'PARTIAL'
	);

	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		freshness = verifyFrozenSubject(predecessor.frozenSubject, { rootLocator: repositoryRoot });
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
	const currentnessDiagnostics = freshness.diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(diagnostic.path, repositoryRoot),
			diagnostic.phase,
			'CURRENTNESS',
			diagnostic.severity
		)
	);
	progress.complete(
		[observation('CURRENTNESS_CHANGED_PATHS', freshness.changedPaths.length, null, 'COUNT')],
		currentnessState
	);

	progress.start('RESULT');
	const artifact = analysis.artifacts.find(
		(candidate) => candidate.id === analysis.exportBinding.rootArtifactId
	);
	if (
		artifact === undefined ||
		analysis.exportBinding.exportName !== request.exportName ||
		analysis.conditionalExportResolution.id !== predecessor.conditionalExportResolution.id ||
		analysis.moduleResolutionTrace.id !== predecessor.moduleResolutionTrace.id ||
		analysis.projectContextGraph.graphId !== predecessor.projectContextGraph.id ||
		analysis.semanticSnapshotId !== predecessor.semanticSnapshot.id ||
		analysis.subjectId !== predecessor.frozenSubject.descriptor.subjectId
	) {
		progress.fail([], 'EVIDENCE_IDENTITY_MISMATCH');
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				...inheritedDiagnostics,
				...declarationDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The declaration result does not reconcile with its exact predecessor evidence.'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const stageOutcomes: DeclarationContextReportStageOutcomes = {
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		declarationContext: {
			diagnosticCodes: declarationOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial'
		},
		predecessorPipeline: predecessor.predecessorStageOutcomes
	};
	const report: DeclarationContextReportOutcome = {
		diagnostics: [...inheritedDiagnostics, ...declarationDiagnostics, ...currentnessDiagnostics],
		operationVersion: DECLARATION_CONTEXT_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			binding: {
				aliasHops: analysis.exportBinding.aliasHops.length,
				declarationArtifact: {
					bytes: artifact.bytes,
					contentSha256: artifact.contentSha256,
					extension: artifact.extension,
					logicalPath: artifact.logicalPath,
					origin: artifact.origin
				},
				declarationCount: analysis.declarations.length,
				declarationKinds: analysis.declarations.map((declaration) => declaration.kind),
				exportBindingId: analysis.exportBinding.id,
				exportName: analysis.exportBinding.exportName,
				mergeState: analysis.terminalSymbol.mergeState,
				resolutionKind: analysis.exportBinding.resolutionKind,
				terminalName: analysis.terminalSymbol.name,
				terminalSymbolId: analysis.terminalSymbol.id
			},
			capability: {
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				id: 'JAN-CSAA-CAP-013',
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
				conditionalExportResolution: predecessor.conditionalExportResolution,
				declarationContextAnalysis: analysis,
				encoding:
					'FULL_VALIDATED_PROJECT_CONTEXT_CONDITIONAL_EXPORT_MODULE_RESOLUTION_AND_DECLARATION_CONTEXT',
				moduleResolutionTrace: predecessor.moduleResolutionTrace,
				projectContextGraph: predecessor.projectContextGraph
			},
			facadeNonclaims: DECLARATION_CONTEXT_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_PACKAGE_ROOT_EXPORT_DECLARATION_CONTEXT',
			predecessorNonclaims: DECLARATION_CONTEXT_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: DECLARATION_CONTEXT_REPORT_RESULT_SCHEMA_VERSION,
			selection: DECLARATION_CONTEXT_REPORT_SELECTION,
			semanticSnapshotSummary: {
				id: predecessor.semanticSnapshot.id,
				programs: predecessor.semanticSnapshot.programs.length,
				projects: predecessor.semanticSnapshot.projects.length,
				sources: predecessor.semanticSnapshot.sources.length
			}
		},
		schemaVersion: DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION,
		stageOutcomes,
		state: 'partial',
		subject: predecessor.frozenSubject.descriptor
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
						'The admitted declaration-context report exceeds maxResultBytes.'
					)
				],
				request,
				predecessor.frozenSubject.descriptor
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
			predecessor.frozenSubject.descriptor
		);
	}
}

export function runDeclarationContextReport(
	requestValue: unknown,
	options: RunDeclarationContextReportOptions
): DeclarationContextReportOutcome {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(runInternal(requestValue, options, progress));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The declaration-context report failed closed.')
			])
		);
	}
}

export function declarationContextReportExitCode(
	outcome: DeclarationContextReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
