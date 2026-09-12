import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type ModuleDependencyGraphNode
} from '../contracts/graph.js';
import {
	SEMANTIC_BUDGET_KEYS,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type SemanticBudgets
} from '../contracts/semantic.js';
import {
	STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_SCC_ANALYSIS_SELECTION,
	type StructuralSccAnalysisBudgets
} from '../contracts/structural-scc-analysis.js';
import {
	STRUCTURAL_SCC_REPORT_NONCLAIMS,
	STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
	STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_SCC_REPORT_RESULT_SCHEMA_VERSION,
	STRUCTURAL_SCC_REPORT_SAFETY_CEILINGS,
	STRUCTURAL_SCC_REPORT_SCHEMA_VERSION,
	type StructuralSccReportDiagnostic,
	type StructuralSccReportFailureState,
	type StructuralSccReportOutcome,
	type StructuralSccReportRequest,
	type StructuralSccReportStage,
	type StructuralSccReportStageOutcomes
} from '../contracts/structural-scc-report.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type SubjectBudgets,
	type SubjectDiagnostic,
	type SubjectResolutionOutcome
} from '../contracts/subject.js';
import { buildModuleDependencyGraph } from '../graph/build-module-dependency-graph.js';
import { buildStructuralSccAnalysis } from '../graph/build-structural-scc-analysis.js';
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
const BUDGET_KEYS = ['maxResultBytes', 'scc', 'semantic', 'subject'] as const;
const SUBJECT_BUDGET_KEYS = [
	'maxBytes',
	'maxConfigDepth',
	'maxDiagnostics',
	'maxDurationMs',
	'maxFiles',
	'maxProjects'
] as const satisfies readonly (keyof SubjectBudgets)[];
const SCC_BUDGET_KEYS = [
	'maxComponents',
	'maxDiagnostics',
	'maxEdges',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxNodes',
	'maxTraversalSteps'
] as const satisfies readonly (keyof StructuralSccAnalysisBudgets)[];
const FORBIDDEN_PATH_PATTERN_CHARACTERS = new Set(['*', '?', '[', ']', '{', '}']);

interface DiagnosticLike {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase?: string;
	readonly severity?: 'INFO' | 'WARNING' | 'ERROR';
}

export const STRUCTURAL_SCC_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-structural-scc-report-progress/0.1.0' as const;

export const STRUCTURAL_SCC_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: STRUCTURAL_SCC_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type StructuralSccReportProgressObservationBasis = 'EXACT' | 'LOWER_BOUND';

export type StructuralSccReportProgressObservationMetric =
	| 'ANALYSIS_CHARGED_TRAVERSAL_STEPS'
	| 'ANALYSIS_COMPONENTS'
	| 'ANALYSIS_CROSS_COMPONENT_EDGES'
	| 'ANALYSIS_CYCLIC_COMPONENTS'
	| 'ANALYSIS_INPUT_EDGES'
	| 'ANALYSIS_INPUT_NODES'
	| 'ANALYSIS_INTERNAL_EDGES'
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'GRAPH_EDGES'
	| 'GRAPH_LIMITATIONS'
	| 'GRAPH_NODES'
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

export type StructuralSccReportProgressPhase =
	| 'ANALYSIS'
	| 'CURRENTNESS'
	| 'MODULE_GRAPH'
	| 'REQUEST_BIND'
	| 'RESULT'
	| 'SEMANTIC_SNAPSHOT'
	| 'SUBJECT_CAPTURE'
	| 'SUBJECT_PROJECT_PATH_BIND';

const STRUCTURAL_SCC_REPORT_PROGRESS_PHASE_STAGE = Object.freeze({
	ANALYSIS: 'ANALYSIS',
	CURRENTNESS: 'CURRENTNESS',
	MODULE_GRAPH: 'MODULE_GRAPH',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT',
	SEMANTIC_SNAPSHOT: 'SEMANTIC_SNAPSHOT',
	SUBJECT_CAPTURE: 'SUBJECT',
	SUBJECT_PROJECT_PATH_BIND: 'SUBJECT'
} as const satisfies Readonly<Record<StructuralSccReportProgressPhase, StructuralSccReportStage>>);

export interface StructuralSccReportProgressObservation {
	/** Exactness applies only to this local measurement, never to capability or closure. */
	readonly basis: StructuralSccReportProgressObservationBasis;
	readonly limit: number | null;
	readonly metric: StructuralSccReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

interface StructuralSccReportProgressEventBase {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly nonclaims: typeof STRUCTURAL_SCC_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly StructuralSccReportProgressObservation[];
	readonly operationVersion: typeof STRUCTURAL_SCC_REPORT_OPERATION_VERSION;
	readonly phase: StructuralSccReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_CAP_027_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof STRUCTURAL_SCC_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: StructuralSccReportStage;
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

/** Best-effort operational telemetry excluded from terminal report identity and evidence. */
export type StructuralSccReportProgressEvent =
	| (StructuralSccReportProgressEventBase & {
			readonly kind: 'REPORT_STAGE';
			readonly semanticProgress?: never;
			readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
	  })
	| (StructuralSccReportProgressEventBase & {
			readonly kind: 'SEMANTIC_SNAPSHOT';
			readonly phase: 'SEMANTIC_SNAPSHOT';
			readonly semanticProgress: StaticSemanticSnapshotProgressEvent;
			readonly stage: 'SEMANTIC_SNAPSHOT';
			readonly state: StaticSemanticSnapshotProgressEvent['state'];
	  });

interface ReportProgressRecorder {
	complete(
		observations?: readonly StructuralSccReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly StructuralSccReportProgressObservation[],
		detailCode?: string | null
	): void;
	enabled(): boolean;
	finish(outcome: StructuralSccReportOutcome): StructuralSccReportOutcome;
	forwardSemantic(event: StaticSemanticSnapshotProgressEvent, budgets: SemanticBudgets): void;
	start(
		phase: StructuralSccReportProgressPhase,
		observations?: readonly StructuralSccReportProgressObservation[]
	): void;
}

function progressObservation(
	metric: StructuralSccReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: StructuralSccReportProgressObservation['unit'],
	basis: StructuralSccReportProgressObservationBasis = 'EXACT'
): StructuralSccReportProgressObservation {
	const boundedValue =
		Number.isFinite(value) && value >= 0 ? Math.min(value, Number.MAX_SAFE_INTEGER) : 0;
	return Object.freeze({ basis, limit, metric, unit, value: boundedValue });
}

function semanticProgressObservations(
	event: StaticSemanticSnapshotProgressEvent,
	budgets: SemanticBudgets
): readonly StructuralSccReportProgressObservation[] {
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

export interface RunStructuralSccReportOptions {
	/**
	 * Trusted-host telemetry callback. Exceptions/rejections are suppressed and events are excluded
	 * from report identity/evidence. The callback runs synchronously, can mutate trusted host state,
	 * and can consume an active duration budget; runtime-outcome invariance is not claimed.
	 */
	readonly onProgress?: (event: StructuralSccReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

function createReportProgressRecorder(
	options: RunStructuralSccReportOptions
): ReportProgressRecorder {
	let sink: ((event: StructuralSccReportProgressEvent) => unknown) | undefined;
	try {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		if (descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'function')
			sink = descriptor.value as (event: StructuralSccReportProgressEvent) => unknown;
	} catch {
		// Observer inspection is best-effort and outside the evidence-producing path.
	}
	let active: StructuralSccReportProgressPhase | null = null;
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
					Extract<StructuralSccReportProgressEvent, { readonly kind: 'REPORT_STAGE' }>,
					| 'elapsedMs'
					| 'deliverySemantics'
					| 'nonclaims'
					| 'operationVersion'
					| 'protocolRole'
					| 'reportIdentityEffect'
					| 'schemaVersion'
					| 'sequence'
					| 'wallClockBudgetEffect'
			  >
			| Omit<
					Extract<StructuralSccReportProgressEvent, { readonly kind: 'SEMANTIC_SNAPSHOT' }>,
					| 'elapsedMs'
					| 'deliverySemantics'
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
				nonclaims: STRUCTURAL_SCC_REPORT_PROGRESS_NONCLAIMS,
				observations: Object.freeze([...event.observations]),
				operationVersion: STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
				protocolRole: 'PRELIMINARY_CAP_027_REPORT_TELEMETRY' as const,
				reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
				schemaVersion: STRUCTURAL_SCC_REPORT_PROGRESS_SCHEMA_VERSION,
				sequence,
				wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET' as const
			}) as StructuralSccReportProgressEvent;
			containRejectedObserverResult(sink(materialized));
		} catch {
			// Sink and materialization failures do not alter the terminal report.
		}
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly StructuralSccReportProgressObservation[],
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
			stage: STRUCTURAL_SCC_REPORT_PROGRESS_PHASE_STAGE[phase],
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
		finish(outcome): StructuralSccReportOutcome {
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
				stage: STRUCTURAL_SCC_REPORT_PROGRESS_PHASE_STAGE[phase],
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
		readonly state: StructuralSccReportFailureState = 'incompatible'
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

function positiveBudget(value: unknown, ceiling: number, path: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
		throw new ReportRequestError(
			'REQUEST_BUDGET_INVALID',
			`${path} must be a positive safe integer.`,
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
	path: string
): Readonly<Record<Keys[number], number>> {
	const record = exactDataRecord(value, keys, path);
	return Object.freeze(
		Object.fromEntries(
			keys.map((key) => [
				key,
				positiveBudget(record[key], ceilings[key as Keys[number]], `${path}.${key}`)
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

function materializeRequest(value: unknown): StructuralSccReportRequest {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.schemaVersion !== STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
			'The structural SCC report request schema version is unsupported.',
			'$.schemaVersion'
		);
	if (record.operationVersion !== STRUCTURAL_SCC_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_VERSION_UNSUPPORTED',
			'The structural SCC report operation version is unsupported.',
			'$.operationVersion'
		);

	const budgetsRecord = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const subject = materializeBudgetRecord(
		budgetsRecord.subject,
		SUBJECT_BUDGET_KEYS,
		STRUCTURAL_SCC_REPORT_SAFETY_CEILINGS.subject,
		'$.budgets.subject'
	) as unknown as SubjectBudgets;
	const semantic = materializeBudgetRecord(
		budgetsRecord.semantic,
		SEMANTIC_BUDGET_KEYS,
		STRUCTURAL_SCC_REPORT_SAFETY_CEILINGS.semantic,
		'$.budgets.semantic'
	) as unknown as SemanticBudgets;
	const scc = materializeBudgetRecord(
		budgetsRecord.scc,
		SCC_BUDGET_KEYS,
		STRUCTURAL_SCC_REPORT_SAFETY_CEILINGS.scc,
		'$.budgets.scc'
	) as unknown as StructuralSccAnalysisBudgets;
	const maxResultBytes = positiveBudget(
		budgetsRecord.maxResultBytes,
		STRUCTURAL_SCC_REPORT_SAFETY_CEILINGS.maxResultBytes,
		'$.budgets.maxResultBytes'
	);
	const subjectProjectConfigPaths = materializeProjectPaths(
		record.subjectProjectConfigPaths,
		semantic.maxPathCharacters,
		Math.min(subject.maxProjects, semantic.maxProjects)
	);

	return Object.freeze({
		budgets: Object.freeze({ maxResultBytes, scc, semantic, subject }),
		operationVersion: STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths
	});
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	severity: 'INFO' | 'WARNING' | 'ERROR' | null = 'ERROR'
): StructuralSccReportDiagnostic {
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
	source: Exclude<StructuralSccReportDiagnostic['source'], 'REPORT'>,
	repositoryRoot: string
): StructuralSccReportDiagnostic[] {
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
	stage: StructuralSccReportStage,
	state: StructuralSccReportFailureState,
	diagnostics: readonly StructuralSccReportDiagnostic[],
	request?: StructuralSccReportRequest,
	subject?: FrozenSubject
): StructuralSccReportOutcome {
	return {
		code,
		diagnostics,
		facadeNonclaims: STRUCTURAL_SCC_REPORT_NONCLAIMS,
		operationVersion: STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		...(request === undefined ? {} : { request }),
		schemaVersion: STRUCTURAL_SCC_REPORT_SCHEMA_VERSION,
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
): { readonly code: string; readonly state: StructuralSccReportFailureState } {
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
	request: StructuralSccReportRequest
): ReturnType<typeof resolveExistingRepositoryPath> | StructuralSccReportOutcome {
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

function runStructuralSccReportInternal(
	requestValue: unknown,
	options: RunStructuralSccReportOptions,
	progress: ReportProgressRecorder
): StructuralSccReportOutcome {
	progress.start('REQUEST_BIND');
	let request: StructuralSccReportRequest;
	try {
		request = materializeRequest(requestValue);
	} catch (error) {
		if (error instanceof ReportRequestError)
			return failure(error.code, 'REQUEST', error.state, [
				reportDiagnostic(error.code, error.message, error.path, 'REQUEST')
			]);
		return failure('REQUEST_INVALID', 'REQUEST', 'incompatible', [
			reportDiagnostic('REQUEST_INVALID', 'The report request could not be inspected safely.', '$')
		]);
	}

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
		operationVersion: STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
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
			capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
			expectEmpty: false,
			operationVersion: SEMANTIC_OPERATION_VERSION,
			rootLocator: repositoryRoot,
			schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject },
		progress.enabled()
			? {
					onProgress: (event) => progress.forwardSemantic(event, request.budgets.semantic)
				}
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

	progress.start('MODULE_GRAPH');
	const graphOutcome = buildModuleDependencyGraph(
		{
			operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
			schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		},
		snapshot
	);
	const graphDiagnostics = projectDiagnostics(
		graphOutcome.diagnostics,
		'MODULE_GRAPH',
		repositoryRoot
	);
	if (graphOutcome.outcome === 'unavailable')
		return failure(
			'MODULE_GRAPH_UNAVAILABLE',
			'MODULE_GRAPH',
			hasBudgetDiagnostic(graphOutcome.diagnostics) ? 'resource-refused' : 'failed',
			graphDiagnostics,
			request,
			subject
		);
	const graph = graphOutcome.graph;
	progress.complete(
		[
			progressObservation('GRAPH_NODES', graph.nodes.length, request.budgets.scc.maxNodes, 'COUNT'),
			progressObservation('GRAPH_EDGES', graph.edges.length, request.budgets.scc.maxEdges, 'COUNT'),
			progressObservation('GRAPH_LIMITATIONS', graph.limitations.length, null, 'COUNT')
		],
		graphOutcome.outcome.toUpperCase()
	);

	progress.start('ANALYSIS');
	const analysisOutcome = buildStructuralSccAnalysis({
		graph,
		request: {
			budgets: request.budgets.scc,
			operationVersion: STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
			schemaVersion: STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
			selection: STRUCTURAL_SCC_ANALYSIS_SELECTION,
			semanticSnapshotId: snapshot.id,
			sourceGraph: {
				contentDigest: graph.contentDigest,
				graphId: graph.id,
				graphInputDigest: graph.graphInputDigest,
				graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY'
			},
			subjectId: snapshot.subjectId
		},
		semanticSnapshot: snapshot
	});
	const analysisDiagnostics = projectDiagnostics(
		analysisOutcome.diagnostics,
		'ANALYSIS',
		repositoryRoot
	);
	if (analysisOutcome.outcome !== 'partial') {
		progress.fail([], analysisOutcome.diagnostics[0]?.code ?? 'STRUCTURAL_SCC_UNAVAILABLE');
		return failure(
			'STRUCTURAL_SCC_UNAVAILABLE',
			'ANALYSIS',
			hasBudgetDiagnostic(analysisOutcome.diagnostics) ? 'resource-refused' : 'failed',
			analysisDiagnostics,
			request,
			subject
		);
	}
	const analysis = analysisOutcome.analysis;
	progress.complete(
		[
			progressObservation(
				'ANALYSIS_INPUT_NODES',
				analysis.coverage.inputNodes,
				request.budgets.scc.maxNodes,
				'COUNT'
			),
			progressObservation(
				'ANALYSIS_INPUT_EDGES',
				analysis.coverage.inputEdges,
				request.budgets.scc.maxEdges,
				'COUNT'
			),
			progressObservation(
				'ANALYSIS_COMPONENTS',
				analysis.coverage.components,
				request.budgets.scc.maxComponents,
				'COUNT'
			),
			progressObservation(
				'ANALYSIS_CYCLIC_COMPONENTS',
				analysis.coverage.cyclicComponents,
				null,
				'COUNT'
			),
			progressObservation(
				'ANALYSIS_INTERNAL_EDGES',
				analysis.coverage.internalEdges,
				null,
				'COUNT'
			),
			progressObservation(
				'ANALYSIS_CROSS_COMPONENT_EDGES',
				analysis.coverage.crossComponentEdges,
				null,
				'COUNT'
			),
			progressObservation(
				'ANALYSIS_CHARGED_TRAVERSAL_STEPS',
				analysis.coverage.chargedTraversalSteps,
				request.budgets.scc.maxTraversalSteps,
				'COUNT'
			)
		],
		'PARTIAL'
	);

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
	const componentNodeIds = new Set(analysis.components.flatMap((component) => component.nodeIds));
	const nodes: readonly ModuleDependencyGraphNode[] = graph.nodes.filter((node) =>
		componentNodeIds.has(node.id)
	);
	if (nodes.length !== componentNodeIds.size || nodes.length !== graph.nodes.length)
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The SCC component membership does not exactly partition its source graph nodes.'
				)
			],
			request,
			subject
		);
	const internalEdgeIds = new Set(
		analysis.components.flatMap((component) => component.internalEdgeIds)
	);
	const internalEdges = graph.edges.filter((edge) => internalEdgeIds.has(edge.id));
	if (internalEdges.length !== internalEdgeIds.size)
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'An internal SCC edge is absent from its source graph.'
				)
			],
			request,
			subject
		);

	const sourceIds = new Set([
		...nodes.flatMap((node) => node.sourceLocations.map((location) => location.sourceId)),
		...nodes.flatMap((node) => (node.kind === 'SOURCE' ? [node.semanticSourceId] : [])),
		...internalEdges.flatMap((edge) => edge.sourceLocations.map((location) => location.sourceId)),
		...graph.limitations.flatMap((limitation) =>
			limitation.sourceId === null ? [] : [limitation.sourceId]
		)
	]);
	const evidenceSources = snapshot.sources
		.filter((source) => sourceIds.has(source.id))
		.map((source) => ({
			analysisDisposition: source.analysisDisposition,
			id: source.id,
			logicalPath: source.logicalPath,
			programId: source.programId,
			projectId: source.projectId
		}));
	if (evidenceSources.length !== sourceIds.size)
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'An SCC evidence source is absent from its semantic snapshot.'
				)
			],
			request,
			subject
		);
	const projectIds = new Set(evidenceSources.map((source) => source.projectId));
	const evidenceProjects = snapshot.projects
		.filter((project) => projectIds.has(project.id))
		.map((project) => ({
			configPath: project.configPath,
			id: project.id,
			programId: project.programId
		}));
	if (evidenceProjects.length !== projectIds.size)
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'An SCC evidence project is absent from its semantic snapshot.'
				)
			],
			request,
			subject
		);

	const stageOutcomes: StructuralSccReportStageOutcomes = {
		analysis: {
			diagnosticCodes: analysisOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial'
		},
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		moduleGraph: {
			diagnosticCodes: graphOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: graphOutcome.outcome
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
	const report: StructuralSccReportOutcome = {
		diagnostics: [
			...subjectDiagnostics,
			...semanticDiagnostics,
			...graphDiagnostics,
			...analysisDiagnostics,
			...currentnessDiagnostics
		],
		operationVersion: STRUCTURAL_SCC_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			analysis,
			capability: {
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				id: 'JAN-CSAA-CAP-027',
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
				componentEvidenceEncoding:
					'ALL_SELECTED_VALIDATED_GRAPH_COMPONENT_MEMBERS_WITH_INTERNAL_EDGE_EVIDENCE',
				coordinateSystem: 'UTF16_CODE_UNIT_OFFSET',
				internalEdges,
				nodes,
				projects: evidenceProjects,
				sources: evidenceSources
			},
			facadeNonclaims: STRUCTURAL_SCC_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_MODULE_DEPENDENCY_GRAPH_STRONGLY_CONNECTED_COMPONENTS',
			schemaVersion: STRUCTURAL_SCC_REPORT_RESULT_SCHEMA_VERSION,
			sourceGraphSummary: {
				contentDigest: graph.contentDigest,
				coverage: graph.coverage,
				epistemic: graph.epistemic,
				graphInputDigest: graph.graphInputDigest,
				health: graph.health,
				id: graph.id,
				limitations: graph.limitations,
				semanticSnapshotId: graph.semanticSnapshotId
			}
		},
		schemaVersion: STRUCTURAL_SCC_REPORT_SCHEMA_VERSION,
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
						'The admitted structural SCC report exceeds maxResultBytes.'
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

export function runStructuralSccReport(
	requestValue: unknown,
	options: RunStructuralSccReportOptions
): StructuralSccReportOutcome {
	const progress = createReportProgressRecorder(options);
	try {
		return progress.finish(runStructuralSccReportInternal(requestValue, options, progress));
	} catch (error) {
		progress.fail([], 'INTERNAL_FAILURE');
		throw error;
	}
}

export function structuralSccReportExitCode(outcome: StructuralSccReportOutcome): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
