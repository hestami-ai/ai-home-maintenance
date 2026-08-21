import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type ModuleDependencyGraphNode,
	type ModuleDependencyGraphSourceNode
} from '../contracts/graph.js';
import {
	SEMANTIC_BUDGET_KEYS,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type SemanticBudgets,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_RESULT_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_SAFETY_CEILINGS,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_SCHEMA_VERSION,
	type StructuralModuleReachabilityReportDiagnostic,
	type StructuralModuleReachabilityReportFailureState,
	type StructuralModuleReachabilityReportOutcome,
	type StructuralModuleReachabilityReportRequest,
	type StructuralModuleReachabilityReportStage,
	type StructuralModuleReachabilityReportStageOutcomes
} from '../contracts/structural-module-reachability-report.js';
import {
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION,
	type StructuralModuleReachabilityAnalysisBudgets
} from '../contracts/structural-module-reachability-analysis.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type SubjectResolutionOutcome,
	type SubjectBudgets,
	type SubjectDiagnostic
} from '../contracts/subject.js';
import { buildModuleDependencyGraph } from '../graph/build-module-dependency-graph.js';
import { buildStructuralModuleReachabilityAnalysis } from '../graph/build-structural-module-reachability-analysis.js';
import {
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
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
	'criterionLogicalPath',
	'direction',
	'operationVersion',
	'projectConfigPath',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = ['maxResultBytes', 'reachability', 'semantic', 'subject'] as const;
const SUBJECT_BUDGET_KEYS = [
	'maxBytes',
	'maxConfigDepth',
	'maxDiagnostics',
	'maxDurationMs',
	'maxFiles',
	'maxProjects'
] as const satisfies readonly (keyof SubjectBudgets)[];
const REACHABILITY_BUDGET_KEYS = [
	'maxDiagnostics',
	'maxEdges',
	'maxFrontierRecords',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxNodes',
	'maxReachableNodes',
	'maxTraversalSteps',
	'maxWitnessEdges'
] as const satisfies readonly (keyof StructuralModuleReachabilityAnalysisBudgets)[];
const FORBIDDEN_PATH_PATTERN_CHARACTERS = new Set(['*', '?', '[', ']', '{', '}']);

interface DiagnosticLike {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase?: string;
	readonly severity?: 'INFO' | 'WARNING' | 'ERROR';
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: StructuralModuleReachabilityReportFailureState = 'incompatible'
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
	if (!Array.isArray(value) || isProxyValue(value))
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be a nonempty exact array.',
			'$.subjectProjectConfigPaths'
		);
	if (Reflect.getPrototypeOf(value) !== Array.prototype)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be a data array.',
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
			'$.subjectProjectConfigPaths must be a dense array without extra properties.',
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

function materializeRequest(value: unknown): StructuralModuleReachabilityReportRequest {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.schemaVersion !== STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
			'The structural module reachability report request schema version is unsupported.',
			'$.schemaVersion'
		);
	if (record.operationVersion !== STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_VERSION_UNSUPPORTED',
			'The structural module reachability report operation version is unsupported.',
			'$.operationVersion'
		);
	if (record.direction !== 'FORWARD' && record.direction !== 'REVERSE')
		throw new ReportRequestError(
			'REQUEST_DIRECTION_INVALID',
			'$.direction must be FORWARD or REVERSE.',
			'$.direction'
		);

	const budgetsRecord = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const subject = materializeBudgetRecord(
		budgetsRecord.subject,
		SUBJECT_BUDGET_KEYS,
		STRUCTURAL_MODULE_REACHABILITY_REPORT_SAFETY_CEILINGS.subject,
		'$.budgets.subject'
	) as unknown as SubjectBudgets;
	const semantic = materializeBudgetRecord(
		budgetsRecord.semantic,
		SEMANTIC_BUDGET_KEYS,
		STRUCTURAL_MODULE_REACHABILITY_REPORT_SAFETY_CEILINGS.semantic,
		'$.budgets.semantic'
	) as unknown as SemanticBudgets;
	const reachability = materializeBudgetRecord(
		budgetsRecord.reachability,
		REACHABILITY_BUDGET_KEYS,
		STRUCTURAL_MODULE_REACHABILITY_REPORT_SAFETY_CEILINGS.reachability,
		'$.budgets.reachability'
	) as unknown as StructuralModuleReachabilityAnalysisBudgets;
	const maxResultBytes = positiveBudget(
		budgetsRecord.maxResultBytes,
		STRUCTURAL_MODULE_REACHABILITY_REPORT_SAFETY_CEILINGS.maxResultBytes,
		'$.budgets.maxResultBytes'
	);
	const maxPathCharacters = semantic.maxPathCharacters;
	const projectConfigPath = materializePath(
		record.projectConfigPath,
		maxPathCharacters,
		'$.projectConfigPath'
	);
	const subjectProjectConfigPaths = materializeProjectPaths(
		record.subjectProjectConfigPaths,
		maxPathCharacters,
		Math.min(subject.maxProjects, semantic.maxProjects)
	);
	if (
		!subjectProjectConfigPaths
			.map((path) => canonicalPathKey(path))
			.includes(canonicalPathKey(projectConfigPath))
	)
		throw new ReportRequestError(
			'REQUEST_CRITERION_PROJECT_OUTSIDE_SUBJECT',
			'$.projectConfigPath must also occur in $.subjectProjectConfigPaths.',
			'$.projectConfigPath'
		);

	return Object.freeze({
		budgets: Object.freeze({ maxResultBytes, reachability, semantic, subject }),
		criterionLogicalPath: materializePath(
			record.criterionLogicalPath,
			maxPathCharacters,
			'$.criterionLogicalPath'
		),
		direction: record.direction,
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
		projectConfigPath,
		schemaVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths
	});
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	severity: 'INFO' | 'WARNING' | 'ERROR' | null = 'ERROR'
): StructuralModuleReachabilityReportDiagnostic {
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
	source: Exclude<StructuralModuleReachabilityReportDiagnostic['source'], 'REPORT'>,
	repositoryRoot: string
): StructuralModuleReachabilityReportDiagnostic[] {
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
	stage: StructuralModuleReachabilityReportStage,
	state: StructuralModuleReachabilityReportFailureState,
	diagnostics: readonly StructuralModuleReachabilityReportDiagnostic[],
	request?: StructuralModuleReachabilityReportRequest,
	subject?: FrozenSubject
): StructuralModuleReachabilityReportOutcome {
	return {
		code,
		diagnostics,
		facadeNonclaims: STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS,
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		...(request === undefined ? {} : { request }),
		schemaVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_SCHEMA_VERSION,
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
): {
	readonly code: string;
	readonly state: StructuralModuleReachabilityReportFailureState;
} {
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
	code: string,
	stage: StructuralModuleReachabilityReportStage,
	request: StructuralModuleReachabilityReportRequest
): ReturnType<typeof resolveExistingRepositoryPath> | StructuralModuleReachabilityReportOutcome {
	try {
		const resolved = resolveExistingRepositoryPath(repositoryRoot, path);
		if (!statSync(resolved.realPath).isFile())
			return failure(
				code,
				stage,
				'incompatible',
				[reportDiagnostic(code, 'The requested repository path is not a file.', path)],
				request
			);
		return resolved;
	} catch {
		return failure(
			code,
			stage,
			'incompatible',
			[
				reportDiagnostic(
					code,
					'The requested repository path is absent or escapes the repository.',
					path
				)
			],
			request
		);
	}
}

function selectProject(
	snapshot: StaticSemanticSnapshot,
	canonicalProjectPath: string
): StaticSemanticSnapshot['projects'][number] | 'ABSENT' | 'AMBIGUOUS' {
	const candidates = snapshot.projects.filter(
		(project) => canonicalPathKey(project.configPath) === canonicalProjectPath
	);
	if (candidates.length === 0) return 'ABSENT';
	if (candidates.length !== 1) return 'AMBIGUOUS';
	return candidates[0]!;
}

function selectCriterion(
	nodes: readonly ModuleDependencyGraphNode[],
	canonicalLogicalPath: string,
	projectId: StaticSemanticSnapshot['projects'][number]['id']
):
	| { readonly node: ModuleDependencyGraphSourceNode; readonly state: 'SELECTED' }
	| { readonly state: 'ABSENT' | 'AMBIGUOUS' | 'OUTSIDE_PROJECT' } {
	const pathCandidates = nodes.filter(
		(node): node is ModuleDependencyGraphSourceNode =>
			node.kind === 'SOURCE' && canonicalPathKey(node.logicalPath) === canonicalLogicalPath
	);
	const projectCandidates = pathCandidates.filter((node) => node.projectId === projectId);
	if (projectCandidates.length === 1) return { node: projectCandidates[0]!, state: 'SELECTED' };
	if (projectCandidates.length > 1) return { state: 'AMBIGUOUS' };
	return { state: pathCandidates.length > 0 ? 'OUTSIDE_PROJECT' : 'ABSENT' };
}

export interface RunStructuralModuleReachabilityReportOptions {
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

export function runStructuralModuleReachabilityReport(
	requestValue: unknown,
	options: RunStructuralModuleReachabilityReportOptions
): StructuralModuleReachabilityReportOutcome {
	let request: StructuralModuleReachabilityReportRequest;
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

	const resolvedProject = existingFile(
		repositoryRoot,
		request.projectConfigPath,
		'PROJECT_PATH_INVALID',
		'SUBJECT',
		request
	);
	if ('outcome' in resolvedProject) return resolvedProject;
	const resolvedSubjectProjects = [];
	for (const projectPath of request.subjectProjectConfigPaths) {
		const resolved = existingFile(
			repositoryRoot,
			projectPath,
			'PROJECT_PATH_INVALID',
			'SUBJECT',
			request
		);
		if ('outcome' in resolved) return resolved;
		resolvedSubjectProjects.push(resolved);
	}
	const resolvedCriterion = existingFile(
		repositoryRoot,
		request.criterionLogicalPath,
		'CRITERION_PATH_INVALID',
		'CRITERION',
		request
	);
	if ('outcome' in resolvedCriterion) return resolvedCriterion;

	const subjectOutcome = resolveSubject({
		budgets: request.budgets.subject,
		expectEmpty: false,
		filters: { exclude: [], include: [] },
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
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
	const criterionArtifact = subject.artifacts.find(
		(artifact) => artifact.canonicalPathKey === resolvedCriterion.canonicalPathKey
	);
	if (criterionArtifact === undefined) {
		const excluded = subject.excludedArtifacts.some((artifact) => {
			const excludedKey = canonicalPathKey(artifact.path);
			return (
				resolvedCriterion.canonicalPathKey === excludedKey ||
				resolvedCriterion.canonicalPathKey.startsWith(`${excludedKey}/`)
			);
		});
		const code = excluded ? 'CRITERION_EXCLUDED' : 'CRITERION_OUTSIDE_SUBJECT';
		return failure(
			code,
			'CRITERION',
			'incompatible',
			[
				reportDiagnostic(
					code,
					excluded
						? 'The requested source is excluded from the captured subject.'
						: 'The requested source is outside the captured subject.'
				)
			],
			request,
			subject
		);
	}

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
		{ subject }
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

	const project = selectProject(snapshot, resolvedProject.canonicalPathKey);
	if (project === 'ABSENT' || project === 'AMBIGUOUS') {
		const code = project === 'ABSENT' ? 'PROJECT_NOT_ANALYZED' : 'PROJECT_AMBIGUOUS';
		return failure(
			code,
			'CRITERION',
			'incompatible',
			[
				reportDiagnostic(
					code,
					'The requested project does not select exactly one semantic project.'
				)
			],
			request,
			subject
		);
	}
	const criterion = selectCriterion(graph.nodes, resolvedCriterion.canonicalPathKey, project.id);
	if (criterion.state !== 'SELECTED') {
		const code = `CRITERION_${criterion.state}`;
		return failure(
			code,
			'CRITERION',
			'incompatible',
			[
				reportDiagnostic(
					code,
					'The requested logical path does not select exactly one source in the requested project.'
				)
			],
			request,
			subject
		);
	}
	if (criterion.node.analysisDisposition !== 'DEEP_INDEXED')
		return failure(
			'CRITERION_CONTEXT_ONLY',
			'CRITERION',
			'incompatible',
			[
				reportDiagnostic(
					'CRITERION_CONTEXT_ONLY',
					'The requested source is context-only and is not an admitted analysis criterion.'
				)
			],
			request,
			subject
		);

	const analysisInputs = {
		graph,
		request: {
			budgets: request.budgets.reachability,
			criterion: { nodeId: criterion.node.id },
			direction: request.direction,
			operationVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
			schemaVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
			selection: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION,
			semanticSnapshotId: snapshot.id,
			sourceGraph: {
				contentDigest: graph.contentDigest,
				graphId: graph.id,
				graphInputDigest: graph.graphInputDigest,
				graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY' as const
			},
			subjectId: snapshot.subjectId
		},
		semanticSnapshot: snapshot
	};
	const analysisOutcome = buildStructuralModuleReachabilityAnalysis(analysisInputs);
	const analysisDiagnostics = projectDiagnostics(
		analysisOutcome.diagnostics,
		'ANALYSIS',
		repositoryRoot
	);
	if (analysisOutcome.outcome !== 'partial')
		return failure(
			'STRUCTURAL_MODULE_REACHABILITY_UNAVAILABLE',
			'ANALYSIS',
			hasBudgetDiagnostic(analysisOutcome.diagnostics) ? 'resource-refused' : 'failed',
			analysisDiagnostics,
			request,
			subject
		);
	const analysis = analysisOutcome.analysis;

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

	const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
	const evidenceNodes = analysis.members.map((member) => nodeById.get(member.nodeId));
	if (evidenceNodes.some((node) => node === undefined))
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[reportDiagnostic('EVIDENCE_IDENTITY_MISMATCH', 'A reached node is absent from its graph.')],
			request,
			subject
		);
	const nodes = evidenceNodes as ModuleDependencyGraphNode[];
	const witnessEdgeIds = new Set(
		[
			...analysis.members.map((member) => member.witnessEdgeId),
			...analysis.encounteredFrontiers.map((frontier) => frontier.witnessEdgeId)
		].filter((id): id is NonNullable<typeof id> => id !== null)
	);
	const witnessEdges = graph.edges.filter((edge) => witnessEdgeIds.has(edge.id));
	if (witnessEdges.length !== witnessEdgeIds.size)
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[reportDiagnostic('EVIDENCE_IDENTITY_MISMATCH', 'A witness edge is absent from its graph.')],
			request,
			subject
		);

	const sourceIds = new Set([
		...nodes.flatMap((node) => node.sourceLocations.map((location) => location.sourceId)),
		...nodes.flatMap((node) => (node.kind === 'SOURCE' ? [node.semanticSourceId] : [])),
		...witnessEdges.flatMap((edge) => edge.sourceLocations.map((location) => location.sourceId)),
		...graph.limitations.flatMap((limitation) =>
			limitation.sourceId === null ? [] : [limitation.sourceId]
		),
		...analysis.upstreamLimitations.flatMap((limitation) =>
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
					'A witness source is absent from its snapshot.'
				)
			],
			request,
			subject
		);
	const projectIds = new Set(evidenceSources.map((source) => source.projectId));
	projectIds.add(project.id);
	const evidenceProjects = snapshot.projects
		.filter((candidate) => projectIds.has(candidate.id))
		.map((candidate) => ({
			configPath: candidate.configPath,
			id: candidate.id,
			programId: candidate.programId
		}));
	if (evidenceProjects.length !== projectIds.size)
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'A witness project is absent from its snapshot.'
				)
			],
			request,
			subject
		);

	const stageOutcomes: StructuralModuleReachabilityReportStageOutcomes = {
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
	const report: StructuralModuleReachabilityReportOutcome = {
		diagnostics: [
			...subjectDiagnostics,
			...semanticDiagnostics,
			...graphDiagnostics,
			...analysisDiagnostics,
			...currentnessDiagnostics
		],
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			analysis,
			capability: {
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				id: 'JAN-CSAA-CAP-027',
				semanticQuery: 'NOT_CLAIMED',
				status: 'PARTIAL'
			},
			criterionSelector: {
				logicalPath: criterion.node.logicalPath,
				projectConfigPath: project.configPath,
				selectedNodeId: criterion.node.id
			},
			currentness: {
				changedPaths: freshness.changedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: {
				coordinateSystem: 'UTF16_CODE_UNIT_OFFSET',
				nodes,
				projects: evidenceProjects,
				sources: evidenceSources,
				witnessEdges,
				witnessEncoding: 'PREDECESSOR_FOREST'
			},
			facadeNonclaims: STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS,
			interpretation:
				request.direction === 'REVERSE'
					? 'STRUCTURAL_IMPORTER_CANDIDATES'
					: 'STRUCTURAL_DEPENDENCY_CANDIDATES',
			schemaVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_RESULT_SCHEMA_VERSION,
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
		schemaVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_SCHEMA_VERSION,
		stageOutcomes,
		state: 'partial',
		subject: subject.descriptor
	};
	try {
		if (canonicalSemanticJsonWitness(report).bytes + 1 > request.budgets.maxResultBytes)
			return failure(
				'RESULT_BUDGET_EXCEEDED',
				'RESULT',
				'resource-refused',
				[
					reportDiagnostic(
						'RESULT_BUDGET_EXCEEDED',
						'The admitted structural reachability report exceeds maxResultBytes.'
					)
				],
				request,
				subject
			);
		return report;
	} catch {
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

export function structuralModuleReachabilityReportExitCode(
	outcome: StructuralModuleReachabilityReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
