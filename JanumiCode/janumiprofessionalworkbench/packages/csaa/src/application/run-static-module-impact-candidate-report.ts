import type {
	ModuleDependencyGraphEdge,
	ModuleDependencyGraphNode,
	ModuleDependencyGraphSourceNode
} from '../contracts/graph.js';
import type { FrozenSubject } from '../contracts/subject.js';
import {
	STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
	STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
	STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY,
	STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY_STATUS,
	STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031,
	STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT,
	STATIC_MODULE_IMPACT_CANDIDATE_NEXT_EVIDENCE,
	STATIC_MODULE_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION,
	STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_UNASSESSED_PROPAGATION_FAMILIES,
	STATIC_MODULE_IMPACT_CANDIDATE_WITNESS_HOP_RESULT_BYTE_RESERVATION,
	type StaticModuleImpactCandidateRecord,
	type StaticModuleImpactCandidateReportDiagnostic,
	type StaticModuleImpactCandidateReportFailureState,
	type StaticModuleImpactCandidateReportOutcome,
	type StaticModuleImpactCandidateReportPartialOutcome,
	type StaticModuleImpactCandidateReportRequest,
	type StaticModuleImpactCandidateReportResult,
	type StaticModuleImpactCandidateReportStage,
	type StaticModuleImpactCandidateSeedRequest,
	type StaticModuleImpactCandidateWitness,
	type StaticModuleImpactCandidateWitnessStep
} from '../contracts/static-module-impact-candidate-report.js';
import {
	STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION,
	type StructuralModuleReachabilityReportOutcome,
	type StructuralModuleReachabilityReportPartialOutcome,
	type StructuralModuleReachabilityReportRequest
} from '../contracts/structural-module-reachability-report.js';
import type { StructuralModuleReachabilityMember } from '../contracts/structural-module-reachability-analysis.js';
import {
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import {
	runStructuralModuleReachabilityReportWithCapturedSubject,
	type StructuralModuleReachabilityReportProgressEvent
} from './run-structural-module-reachability-report.js';
import { verifyFrozenSubject } from '../subject/freshness.js';

const REQUEST_KEYS = [
	'budgets',
	'operationVersion',
	'schemaVersion',
	'seed',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = [
	'maxCandidateWitnessHops',
	'maxResultBytes',
	'reachability',
	'semantic',
	'subject'
] as const;
const SEED_KEYS = [
	'basis',
	'expectedArtifactSha256',
	'id',
	'logicalPath',
	'operation',
	'projectConfigPath',
	'schemaVersion',
	'scope',
	'workingChangeSetId'
] as const;
const MAX_CALLER_ID_CHARACTERS = 4_096;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

interface AdmittedRequestShell {
	readonly maxCandidateWitnessHops: number;
	readonly predecessorBudgets: unknown;
	readonly seed: StaticModuleImpactCandidateSeedRequest;
	readonly subjectProjectConfigPaths: unknown;
}

interface AdmittedOptions {
	readonly onPredecessorProgress?: (
		event: StructuralModuleReachabilityReportProgressEvent
	) => unknown;
	readonly repositoryRoot: string;
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: StaticModuleImpactCandidateReportFailureState = 'incompatible'
	) {
		super(message);
	}
}

class ProjectionError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly state: StaticModuleImpactCandidateReportFailureState = 'failed'
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

function materializeOptions(value: unknown): AdmittedOptions {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		throw new ReportRequestError(
			'OPTIONS_SHAPE_INVALID',
			'$options must be a non-proxy data object.',
			'$options',
			'failed'
		);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new ReportRequestError(
			'OPTIONS_SHAPE_INVALID',
			'$options must be a data object.',
			'$options',
			'failed'
		);
	const keys = Reflect.ownKeys(value);
	if (
		keys.some(
			(key) =>
				typeof key !== 'string' || (key !== 'onPredecessorProgress' && key !== 'repositoryRoot')
		) ||
		!keys.includes('repositoryRoot')
	)
		throw new ReportRequestError(
			'OPTIONS_SHAPE_INVALID',
			'$options has unexpected or missing keys.',
			'$options',
			'failed'
		);
	const rootDescriptor = Reflect.getOwnPropertyDescriptor(value, 'repositoryRoot');
	if (
		rootDescriptor === undefined ||
		!('value' in rootDescriptor) ||
		!rootDescriptor.enumerable ||
		typeof rootDescriptor.value !== 'string'
	)
		throw new ReportRequestError(
			'OPTIONS_ROOT_INVALID',
			'$options.repositoryRoot must be an enumerable string data property.',
			'$options.repositoryRoot',
			'failed'
		);
	const callbackDescriptor = Reflect.getOwnPropertyDescriptor(value, 'onPredecessorProgress');
	if (callbackDescriptor === undefined) return { repositoryRoot: rootDescriptor.value };
	if (
		!('value' in callbackDescriptor) ||
		!callbackDescriptor.enumerable ||
		(callbackDescriptor.value !== undefined &&
			(typeof callbackDescriptor.value !== 'function' || isProxyValue(callbackDescriptor.value)))
	)
		throw new ReportRequestError(
			'OPTIONS_PROGRESS_INVALID',
			'$options.onPredecessorProgress must be an enumerable non-proxy function data property.',
			'$options.onPredecessorProgress',
			'failed'
		);
	return callbackDescriptor.value === undefined
		? { repositoryRoot: rootDescriptor.value }
		: {
				onPredecessorProgress: callbackDescriptor.value as (
					event: StructuralModuleReachabilityReportProgressEvent
				) => unknown,
				repositoryRoot: rootDescriptor.value
			};
}

function callerId(value: unknown, path: string): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_CALLER_ID_CHARACTERS ||
		!isUnicodeScalarString(value)
	)
		throw new ReportRequestError(
			'REQUEST_SEED_INVALID',
			`${path} must be a nonempty bounded Unicode scalar string.`,
			path
		);
	return value;
}

function materializeRequestShell(value: unknown): AdmittedRequestShell {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const maxCandidateWitnessHops = positiveBudget(
		budgets.maxCandidateWitnessHops,
		STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS.maxCandidateWitnessHops,
		'$.budgets.maxCandidateWitnessHops'
	);
	const seed = exactDataRecord(record.seed, SEED_KEYS, '$.seed');
	if (seed.schemaVersion !== STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SEED_SCHEMA_INCOMPATIBLE',
			'$.seed.schemaVersion is unsupported.',
			'$.seed.schemaVersion'
		);
	if (
		seed.basis !== 'CALLER_DECLARED_WORKING_CHANGE_SET' ||
		seed.operation !== 'EDIT' ||
		seed.scope !== 'WHOLE_SOURCE'
	)
		throw new ReportRequestError(
			'REQUEST_SEED_INVALID',
			'Only one caller-declared existing whole-source EDIT seed is supported.',
			'$.seed'
		);
	if (
		typeof seed.expectedArtifactSha256 !== 'string' ||
		!SHA256_PATTERN.test(seed.expectedArtifactSha256)
	)
		throw new ReportRequestError(
			'REQUEST_SEED_DIGEST_INVALID',
			'$.seed.expectedArtifactSha256 must be one lowercase SHA-256 digest.',
			'$.seed.expectedArtifactSha256'
		);
	return Object.freeze({
		maxCandidateWitnessHops,
		predecessorBudgets: Object.freeze({
			maxResultBytes: budgets.maxResultBytes,
			reachability: budgets.reachability,
			semantic: budgets.semantic,
			subject: budgets.subject
		}),
		seed: Object.freeze({
			basis: 'CALLER_DECLARED_WORKING_CHANGE_SET',
			expectedArtifactSha256: seed.expectedArtifactSha256,
			id: callerId(seed.id, '$.seed.id'),
			logicalPath: callerId(seed.logicalPath, '$.seed.logicalPath'),
			operation: 'EDIT',
			projectConfigPath: callerId(seed.projectConfigPath, '$.seed.projectConfigPath'),
			schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: 'WHOLE_SOURCE',
			workingChangeSetId: callerId(seed.workingChangeSetId, '$.seed.workingChangeSetId')
		}),
		subjectProjectConfigPaths: record.subjectProjectConfigPaths
	});
}

function predecessorRequest(shell: AdmittedRequestShell): unknown {
	return {
		budgets: shell.predecessorBudgets,
		criterionLogicalPath: shell.seed.logicalPath,
		direction: 'REVERSE',
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
		projectConfigPath: shell.seed.projectConfigPath,
		schemaVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: shell.subjectProjectConfigPaths
	};
}

function materializedRequest(
	shell: AdmittedRequestShell,
	predecessor: StructuralModuleReachabilityReportRequest
): StaticModuleImpactCandidateReportRequest {
	return {
		budgets: {
			...predecessor.budgets,
			maxCandidateWitnessHops: shell.maxCandidateWitnessHops
		},
		operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
		seed: shell.seed,
		subjectProjectConfigPaths: predecessor.subjectProjectConfigPaths
	};
}

function diagnostic(
	code: string,
	message: string,
	path: string | null = null
): StaticModuleImpactCandidateReportDiagnostic {
	return {
		code,
		message,
		path,
		predecessorPhase: null,
		predecessorSource: null,
		severity: null,
		source: 'REPORT'
	};
}

function predecessorDiagnostics(
	predecessor: StructuralModuleReachabilityReportOutcome
): readonly StaticModuleImpactCandidateReportDiagnostic[] {
	return predecessor.diagnostics.map((entry) => ({
		code: entry.code,
		message: entry.message,
		path: entry.path,
		predecessorPhase: entry.phase,
		predecessorSource: entry.source,
		severity: entry.severity,
		source: 'PREDECESSOR_REPORT' as const
	}));
}

function failure(
	code: string,
	stage: StaticModuleImpactCandidateReportStage,
	state: StaticModuleImpactCandidateReportFailureState,
	diagnostics: readonly StaticModuleImpactCandidateReportDiagnostic[],
	request?: StaticModuleImpactCandidateReportRequest,
	subject?: StructuralModuleReachabilityReportPartialOutcome['subject']
): StaticModuleImpactCandidateReportOutcome {
	return {
		analysisAuthority: STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
		authorityTransfer: STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
		gateEffect: STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT,
		operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		...(request === undefined ? {} : { request }),
		schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

function predecessorFailureState(
	state: Exclude<
		StructuralModuleReachabilityReportOutcome,
		StructuralModuleReachabilityReportPartialOutcome
	>['state']
): StaticModuleImpactCandidateReportFailureState {
	return state === 'resource-refused' ? 'resource-refused' : state;
}

interface ProjectionIndexes {
	readonly edgeById: ReadonlyMap<ModuleDependencyGraphEdge['id'], ModuleDependencyGraphEdge>;
	readonly memberByNodeId: ReadonlyMap<
		StructuralModuleReachabilityMember['nodeId'],
		StructuralModuleReachabilityMember
	>;
	readonly nodeById: ReadonlyMap<ModuleDependencyGraphNode['id'], ModuleDependencyGraphNode>;
}

function witnessFor(
	candidate: StructuralModuleReachabilityMember,
	criterionNodeId: StructuralModuleReachabilityMember['nodeId'],
	indexes: ProjectionIndexes
): StaticModuleImpactCandidateWitness {
	const reverseNodes: ModuleDependencyGraphNode['id'][] = [candidate.nodeId];
	const reverseSteps: StaticModuleImpactCandidateWitnessStep[] = [];
	let current = candidate;
	for (let hops = 0; current.nodeId !== criterionNodeId; hops += 1) {
		if (hops >= indexes.memberByNodeId.size)
			throw new ProjectionError('WITNESS_CYCLE', 'A predecessor witness cycle was encountered.');
		if (current.predecessorNodeId === null || current.witnessEdgeId === null)
			throw new ProjectionError(
				'WITNESS_INCOMPLETE',
				'A non-seed candidate lacks its predecessor witness.'
			);
		const predecessor = indexes.memberByNodeId.get(current.predecessorNodeId);
		const edge = indexes.edgeById.get(current.witnessEdgeId);
		if (predecessor === undefined || edge === undefined)
			throw new ProjectionError(
				'WITNESS_IDENTITY_MISMATCH',
				'A predecessor member or witness edge is absent from evidence.'
			);
		if (
			predecessor.distance !== current.distance - 1 ||
			edge.source.nodeId !== current.nodeId ||
			edge.target.nodeId !== predecessor.nodeId
		)
			throw new ProjectionError(
				'WITNESS_ORIENTATION_MISMATCH',
				'A reverse traversal witness does not preserve its importer-to-imported edge.'
			);
		reverseNodes.push(predecessor.nodeId);
		reverseSteps.push({
			edgeId: edge.id,
			edgeEpistemic: edge.epistemic,
			fromSeedTowardCandidateNodeId: predecessor.nodeId,
			nativeImportedNodeId: edge.target.nodeId,
			nativeImporterNodeId: edge.source.nodeId,
			occurrenceKind: edge.occurrenceKind,
			ordinal: 0,
			relationKind: edge.relationKind,
			sourceLocations: edge.sourceLocations.map((location) => ({ ...location })),
			specifier: edge.specifier,
			toCandidateNodeId: current.nodeId,
			typeOnly: edge.typeOnly
		});
		current = predecessor;
	}
	const steps = reverseSteps.reverse().map((step, ordinal) => ({ ...step, ordinal }));
	const seedToCandidateNodeIds = reverseNodes.reverse();
	if (
		steps.length !== candidate.distance ||
		seedToCandidateNodeIds.length !== candidate.distance + 1 ||
		seedToCandidateNodeIds[0] !== criterionNodeId ||
		seedToCandidateNodeIds.at(-1) !== candidate.nodeId
	)
		throw new ProjectionError(
			'WITNESS_DISTANCE_MISMATCH',
			'A candidate witness does not reconcile with its structural distance.'
		);
	return {
		edgeIdsInTraversalOrder: steps.map((step) => step.edgeId),
		hopCount: steps.length,
		nativeEdgeOrientation: 'IMPORTER_TO_IMPORTED',
		seedToCandidateNodeIds,
		steps,
		traversalDirection: 'REVERSE'
	};
}

function preflightCandidateWitnessHops(
	predecessor: StructuralModuleReachabilityReportPartialOutcome,
	maxCandidateWitnessHops: number,
	maxResultBytes: number,
	predecessorResultBytes: number
): number {
	const nonWitnessBytes = Math.min(
		maxResultBytes,
		predecessorResultBytes + STATIC_MODULE_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION
	);
	const resultByteDerivedHopLimit = Math.floor(
		(maxResultBytes - nonWitnessBytes) /
			STATIC_MODULE_IMPACT_CANDIDATE_WITNESS_HOP_RESULT_BYTE_RESERVATION
	);
	let candidateWitnessHops = 0;
	for (const member of predecessor.result.analysis.members) {
		if (!Number.isSafeInteger(member.distance) || member.distance < 0)
			throw new ProjectionError(
				'PREDECESSOR_DISTANCE_INVALID',
				'A predecessor member has an invalid structural distance.'
			);
		if (member.distance === 0) continue;
		if (member.distance > maxCandidateWitnessHops - candidateWitnessHops)
			throw new ProjectionError(
				'CANDIDATE_WITNESS_HOP_BUDGET_EXCEEDED',
				'The cumulative seed-to-candidate witness-hop population exceeds maxCandidateWitnessHops.',
				'resource-refused'
			);
		if (member.distance > resultByteDerivedHopLimit - candidateWitnessHops)
			throw new ProjectionError(
				'CANDIDATE_WITNESS_RESULT_BYTE_RESERVATION_EXCEEDED',
				'The cumulative seed-to-candidate witness-hop population exceeds the maxResultBytes-derived pre-allocation resource reservation.',
				'resource-refused'
			);
		candidateWitnessHops += member.distance;
	}
	return candidateWitnessHops;
}

function projectCandidates(
	predecessor: StructuralModuleReachabilityReportPartialOutcome
): readonly StaticModuleImpactCandidateRecord[] {
	const analysis = predecessor.result.analysis;
	if (analysis.direction !== 'REVERSE' || analysis.truncation.state !== 'NOT_TRUNCATED')
		throw new ProjectionError(
			'PREDECESSOR_ANALYSIS_INCOMPATIBLE',
			'The candidate projection requires one non-truncated reverse reachability analysis.'
		);
	const indexes: ProjectionIndexes = {
		edgeById: new Map(predecessor.result.evidence.witnessEdges.map((edge) => [edge.id, edge])),
		memberByNodeId: new Map(analysis.members.map((member) => [member.nodeId, member])),
		nodeById: new Map(predecessor.result.evidence.nodes.map((node) => [node.id, node]))
	};
	const criterion = indexes.memberByNodeId.get(analysis.criterion.nodeId);
	if (
		criterion === undefined ||
		!criterion.criterion ||
		criterion.distance !== 0 ||
		criterion.predecessorNodeId !== null ||
		criterion.witnessEdgeId !== null
	)
		throw new ProjectionError(
			'PREDECESSOR_CRITERION_MISMATCH',
			'The predecessor criterion member is unavailable or inconsistent.'
		);
	const sourceIdentityById = new Map(
		predecessor.result.evidence.sources.map((source) => [source.id, source])
	);
	const candidates: StaticModuleImpactCandidateRecord[] = [];
	for (const member of analysis.members) {
		if (member.distance === 0) continue;
		const node = indexes.nodeById.get(member.nodeId);
		if (node?.kind !== 'SOURCE' || member.nodeKind !== 'SOURCE')
			throw new ProjectionError(
				'PREDECESSOR_MEMBER_INCOMPATIBLE',
				'Reverse source impact candidates must bind only reached source nodes.'
			);
		const source = sourceIdentityById.get(node.semanticSourceId);
		if (
			source === undefined ||
			source.logicalPath !== node.logicalPath ||
			source.programId !== node.programId ||
			source.projectId !== node.projectId
		)
			throw new ProjectionError(
				'PREDECESSOR_SOURCE_IDENTITY_MISMATCH',
				'A candidate source does not reconcile with predecessor evidence.'
			);
		candidates.push({
			analysisDisposition: node.analysisDisposition,
			candidateKind: 'STATIC_MODULE_IMPORTER_SOURCE',
			distance: member.distance,
			impactEpistemicState: 'POSSIBLE',
			logicalPath: node.logicalPath,
			nextEvidenceNeeded: STATIC_MODULE_IMPACT_CANDIDATE_NEXT_EVIDENCE,
			nodeId: node.id,
			ordinal: candidates.length,
			programId: node.programId,
			projectId: node.projectId,
			semanticSourceId: node.semanticSourceId,
			structuralRelationship:
				member.distance === 1
					? 'DIRECT_STATIC_MODULE_IMPORTER'
					: 'TRANSITIVE_STATIC_MODULE_IMPORTER',
			structuralEvidenceState: node.epistemic,
			witness: witnessFor(member, criterion.nodeId, indexes)
		});
	}
	return candidates;
}

function selectSeedNode(
	predecessor: StructuralModuleReachabilityReportPartialOutcome
): ModuleDependencyGraphSourceNode {
	const selected = predecessor.result.evidence.nodes.find(
		(node) => node.id === predecessor.result.criterionSelector.selectedNodeId
	);
	if (selected?.kind !== 'SOURCE')
		throw new ProjectionError(
			'SEED_NODE_IDENTITY_MISMATCH',
			'The selected seed node is absent from predecessor evidence.'
		);
	return selected;
}

function runInternal(
	requestValue: unknown,
	options: RunStaticModuleImpactCandidateReportOptions,
	captureSuccessfulExecution?: (
		subject: FrozenSubject,
		repositoryRoot: string,
		resultBytes: number
	) => void
): StaticModuleImpactCandidateReportOutcome {
	let shell: AdmittedRequestShell;
	try {
		shell = materializeRequestShell(requestValue);
	} catch (error) {
		if (error instanceof ReportRequestError)
			return failure(error.code, 'REQUEST', error.state, [
				diagnostic(error.code, error.message, error.path)
			]);
		return failure('REQUEST_INVALID', 'REQUEST', 'incompatible', [
			diagnostic('REQUEST_INVALID', 'The report request could not be inspected safely.', '$')
		]);
	}
	let admittedOptions: AdmittedOptions;
	try {
		admittedOptions = materializeOptions(options);
	} catch (error) {
		if (error instanceof ReportRequestError)
			return failure(error.code, 'REQUEST', error.state, [
				diagnostic(error.code, error.message, error.path)
			]);
		return failure('OPTIONS_INVALID', 'REQUEST', 'failed', [
			diagnostic('OPTIONS_INVALID', 'The runner options could not be inspected safely.', '$options')
		]);
	}
	const predecessorExecution = runStructuralModuleReachabilityReportWithCapturedSubject(
		predecessorRequest(shell),
		{
			...(admittedOptions.onPredecessorProgress === undefined
				? {}
				: { onProgress: admittedOptions.onPredecessorProgress }),
			repositoryRoot: admittedOptions.repositoryRoot
		}
	);
	const predecessor = predecessorExecution.outcome;
	const inheritedDiagnostics = predecessorDiagnostics(predecessor);
	if (predecessor.outcome !== 'partial') {
		const request =
			predecessor.request === undefined
				? undefined
				: materializedRequest(shell, predecessor.request);
		return failure(
			predecessor.code,
			'PREDECESSOR_REPORT',
			predecessorFailureState(predecessor.state),
			inheritedDiagnostics,
			request,
			predecessor.subject
		);
	}
	const request = materializedRequest(shell, predecessor.request);
	if (predecessor.result.currentness.state !== 'CURRENT_FOR_CAPTURED_SUBJECT')
		return failure(
			predecessor.result.currentness.state === 'STALE'
				? 'SEED_CAPTURE_STALE'
				: 'SEED_CURRENTNESS_UNAVAILABLE',
			'CURRENTNESS',
			predecessor.result.currentness.state === 'STALE' ? 'stale' : 'failed',
			[
				...inheritedDiagnostics,
				diagnostic(
					predecessor.result.currentness.state === 'STALE'
						? 'SEED_CAPTURE_STALE'
						: 'SEED_CURRENTNESS_UNAVAILABLE',
					'The source-edit seed requires a current captured predecessor subject.'
				)
			],
			request,
			predecessor.subject
		);
	if (
		predecessorExecution.subject === null ||
		predecessorExecution.repositoryRoot === null ||
		predecessorExecution.resultBytes === null ||
		predecessorExecution.subject.descriptor.subjectId !== predecessor.subject.subjectId
	)
		return failure(
			'PREDECESSOR_SUBJECT_HANDOFF_UNAVAILABLE',
			'CURRENTNESS',
			'failed',
			[
				...inheritedDiagnostics,
				diagnostic(
					'PREDECESSOR_SUBJECT_HANDOFF_UNAVAILABLE',
					'The exact captured predecessor subject or serialized-result size is unavailable for facade resource admission and final currentness.'
				)
			],
			request,
			predecessor.subject
		);
	const artifact = predecessor.result.criterionSelector.artifact;
	if (artifact.sha256 !== request.seed.expectedArtifactSha256)
		return failure(
			'SEED_BASELINE_DIGEST_MISMATCH',
			'SEED_BIND',
			'stale',
			[
				...inheritedDiagnostics,
				diagnostic(
					'SEED_BASELINE_DIGEST_MISMATCH',
					'The captured seed artifact does not match the caller-declared baseline digest.',
					'$.seed.expectedArtifactSha256'
				)
			],
			request,
			predecessor.subject
		);
	let seedNode: ModuleDependencyGraphSourceNode;
	let candidates: readonly StaticModuleImpactCandidateRecord[];
	let candidateWitnessHops: number;
	try {
		seedNode = selectSeedNode(predecessor);
		candidateWitnessHops = preflightCandidateWitnessHops(
			predecessor,
			request.budgets.maxCandidateWitnessHops,
			request.budgets.maxResultBytes,
			predecessorExecution.resultBytes
		);
		candidates = projectCandidates(predecessor);
	} catch (error) {
		const code = error instanceof ProjectionError ? error.code : 'PROJECTION_FAILED';
		const message =
			error instanceof ProjectionError
				? error.message
				: 'The static module impact-candidate projection failed closed.';
		return failure(
			code,
			'PROJECTION',
			error instanceof ProjectionError ? error.state : 'failed',
			[...inheritedDiagnostics, diagnostic(code, message)],
			request,
			predecessor.subject
		);
	}
	const selectedSource = predecessor.result.evidence.sources.find(
		(source) => source.id === seedNode.semanticSourceId
	);
	const selectedProject = predecessor.result.evidence.projects.find(
		(project) => project.id === seedNode.projectId
	);
	if (
		selectedSource === undefined ||
		selectedProject === undefined ||
		selectedSource.logicalPath !== request.seed.logicalPath ||
		selectedProject.configPath !== request.seed.projectConfigPath ||
		artifact.path !== request.seed.logicalPath
	)
		return failure(
			'SEED_IDENTITY_MISMATCH',
			'SEED_BIND',
			'failed',
			[
				...inheritedDiagnostics,
				diagnostic(
					'SEED_IDENTITY_MISMATCH',
					'The caller-declared seed does not reconcile with captured source evidence.'
				)
			],
			request,
			predecessor.subject
		);
	const analysis = predecessor.result.analysis;
	const result: StaticModuleImpactCandidateReportResult = {
		capability: {
			fullJanCsaaCap031: STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031,
			id: STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY,
			predecessorCapability: 'JAN-CSAA-CAP-027',
			predecessorStatus: 'PARTIAL',
			status: STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY_STATUS
		},
		candidates,
		conclusion:
			candidates.length === 0
				? 'NO_STATIC_MODULE_IMPORTER_CANDIDATES_OBSERVED_WITHIN_SELECTED_GRAPH'
				: 'STATIC_MODULE_IMPORTER_CANDIDATES_OBSERVED',
		coverage: {
			candidateWitnessHops,
			candidates: candidates.length,
			directCandidates: candidates.filter((candidate) => candidate.distance === 1).length,
			transitiveCandidates: candidates.filter((candidate) => candidate.distance > 1).length,
			unvisitedGraphNodes: analysis.coverage.unvisitedNodes
		},
		currentness: {
			...predecessor.result.currentness,
			finalFacadeVerification: 'RECHECKED_AFTER_PROJECTION_AND_RESULT_SIZE_ACCOUNTING'
		},
		evidence: {
			encoding: 'FULL_PREDECESSOR_REPORT_PLUS_SEED_TO_CANDIDATE_WITNESS_PATHS',
			predecessorReport: predecessor
		},
		exclusions: {
			callerQueryExclusions: 'NONE_SUPPORTED',
			subjectExcludedClasses: predecessor.subject.excludedClasses,
			subjectExclusionPolicyIds: predecessor.subject.exclusionPolicyIds,
			subjectPerimeter: predecessor.subject.perimeter
		},
		facadeNonclaims: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
		globalImpactClosure: 'OPEN',
		invalidationDependencies: {
			artifactSha256: artifact.sha256,
			predecessorAnalysisContentDigest: analysis.contentDigest,
			predecessorAnalysisId: analysis.id,
			semanticSnapshotId: analysis.semanticSnapshotId,
			sourceGraphContentDigest: analysis.sourceGraph.contentDigest,
			sourceGraphId: analysis.sourceGraph.graphId,
			sourceGraphInputDigest: analysis.sourceGraph.graphInputDigest,
			subjectId: analysis.subjectId,
			workingChangeSetId: request.seed.workingChangeSetId
		},
		propagation: STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION,
		schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION,
		seed: {
			analysisDisposition: 'DEEP_INDEXED',
			artifact,
			bindingState: 'BOUND_TO_CURRENT_CAPTURED_SOURCE',
			graphId: analysis.sourceGraph.graphId,
			graphNodeId: seedNode.id,
			logicalPath: seedNode.logicalPath,
			operation: 'EDIT',
			programId: seedNode.programId,
			projectConfigPath: selectedProject.configPath,
			projectId: seedNode.projectId,
			schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: 'WHOLE_SOURCE',
			seedId: request.seed.id,
			semanticSnapshotId: analysis.semanticSnapshotId,
			semanticSourceId: seedNode.semanticSourceId,
			subjectId: analysis.subjectId,
			structuralEvidenceState: seedNode.epistemic,
			workingChangeSet: {
				basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_VALIDATED',
				id: request.seed.workingChangeSetId
			}
		},
		uncertainty: {
			encounteredFrontiers: analysis.encounteredFrontiers,
			entryMechanisms: 'NOT_ASSESSED',
			graphEpistemic: predecessor.result.sourceGraphSummary.epistemic,
			graphHealth: predecessor.result.sourceGraphSummary.health,
			nextEvidenceNeeded: STATIC_MODULE_IMPACT_CANDIDATE_NEXT_EVIDENCE,
			runtimeBehavior: 'NOT_ASSESSED',
			structuralClosure: analysis.structuralClosure,
			unassessedPropagationFamilies: STATIC_MODULE_IMPACT_CANDIDATE_UNASSESSED_PROPAGATION_FAMILIES,
			unvisitedNodeInterpretation: 'NO_IMPACT_OR_IRRELEVANCE_STATE_ASSIGNED',
			upstreamClosure: analysis.upstreamClosure,
			upstreamLimitations: analysis.upstreamLimitations
		}
	};
	const report: StaticModuleImpactCandidateReportPartialOutcome = {
		analysisAuthority: STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
		authorityTransfer: STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
		diagnostics: inheritedDiagnostics,
		gateEffect: STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT,
		operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result,
		schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
		state: 'partial',
		subject: predecessor.subject
	};
	let resultBytes: number;
	try {
		resultBytes = canonicalSemanticJsonWitness(report).bytes + 1;
	} catch {
		return failure(
			'RESULT_SERIALIZATION_FAILED',
			'RESULT',
			'failed',
			[
				diagnostic(
					'RESULT_SERIALIZATION_FAILED',
					'The static module impact-candidate report could not be serialized safely.'
				)
			],
			request,
			predecessor.subject
		);
	}
	if (resultBytes > request.budgets.maxResultBytes)
		return failure(
			'RESULT_BUDGET_EXCEEDED',
			'RESULT',
			'resource-refused',
			[
				diagnostic(
					'RESULT_BUDGET_EXCEEDED',
					'The admitted static module impact-candidate report exceeds maxResultBytes.'
				)
			],
			request,
			predecessor.subject
		);
	let finalFreshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		finalFreshness = verifyFrozenSubject(predecessorExecution.subject, {
			rootLocator: predecessorExecution.repositoryRoot
		});
	} catch {
		finalFreshness = { changedPaths: [], diagnostics: [], state: 'UNAVAILABLE' };
	}
	if (finalFreshness.state !== 'CURRENT') {
		const stale = finalFreshness.state === 'STALE';
		const code = stale ? 'SEED_CAPTURE_STALE' : 'SEED_CURRENTNESS_UNAVAILABLE';
		return failure(
			code,
			'CURRENTNESS',
			stale ? 'stale' : 'failed',
			[
				...inheritedDiagnostics,
				diagnostic(
					code,
					stale
						? 'The captured subject changed after predecessor evidence and facade projection were constructed.'
						: 'Final facade currentness for the exact captured predecessor subject is unavailable.'
				)
			],
			request,
			predecessor.subject
		);
	}
	captureSuccessfulExecution?.(
		predecessorExecution.subject,
		predecessorExecution.repositoryRoot,
		resultBytes
	);
	return report;
}

export interface RunStaticModuleImpactCandidateReportOptions {
	/** Exact predecessor CAP-027 progress stream; excluded from this terminal report identity. */
	readonly onPredecessorProgress?: (
		event: StructuralModuleReachabilityReportProgressEvent
	) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

/** @internal Same-process handoff used by trusted facades that must recheck final currentness. */
export function runStaticModuleImpactCandidateReportWithCapturedSubject(
	requestValue: unknown,
	options: RunStaticModuleImpactCandidateReportOptions
): {
	readonly outcome: StaticModuleImpactCandidateReportOutcome;
	readonly repositoryRoot: string | null;
	readonly resultBytes: number | null;
	readonly subject: FrozenSubject | null;
} {
	let repositoryRoot: string | null = null;
	let resultBytes: number | null = null;
	let subject: FrozenSubject | null = null;
	try {
		const outcome = runInternal(
			requestValue,
			options,
			(capturedSubject, capturedRepositoryRoot, capturedResultBytes) => {
				repositoryRoot = capturedRepositoryRoot;
				resultBytes = capturedResultBytes;
				subject = capturedSubject;
			}
		);
		return { outcome, repositoryRoot, resultBytes, subject };
	} catch {
		return {
			outcome: failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				diagnostic('INTERNAL_FAILURE', 'The static module impact-candidate report failed closed.')
			]),
			repositoryRoot: null,
			resultBytes: null,
			subject: null
		};
	}
}

export function runStaticModuleImpactCandidateReport(
	requestValue: unknown,
	options: RunStaticModuleImpactCandidateReportOptions
): StaticModuleImpactCandidateReportOutcome {
	return runStaticModuleImpactCandidateReportWithCapturedSubject(requestValue, options).outcome;
}

export function staticModuleImpactCandidateReportExitCode(
	outcome: StaticModuleImpactCandidateReportOutcome
): 2 | 3 | 4 {
	if (
		outcome.outcome === 'partial' ||
		outcome.state === 'resource-refused' ||
		outcome.state === 'stale'
	)
		return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
