import type {
	ModuleDependencyGraphId,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import type { SemanticSnapshotId } from '../contracts/semantic.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import {
	STRUCTURAL_MODULE_GRAPH_ANALYSIS_NONCLAIMS,
	STRUCTURAL_MODULE_GRAPH_ANALYSIS_STATUS,
	analyzeStructuralModuleGraph,
	type StructuralModuleGraphAnalysis,
	type StructuralModuleGraphAnalysisBudgets,
	type StructuralModuleGraphAnalysisDiagnosticCode,
	type StructuralModuleSliceDirection
} from './analyze-structural-module-graph.js';

export const STRUCTURAL_MODULE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-structural-module-graph-report-request/0.1.0' as const;
export const STRUCTURAL_MODULE_GRAPH_REPORT_SCHEMA_VERSION =
	'jan-csaa-structural-module-graph-report/0.1.0' as const;
export const STRUCTURAL_MODULE_GRAPH_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-structural-module-graph-report-result/0.1.0' as const;
export const STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION =
	'jan-csaa-analyze-structural-module-graph/0.1.0' as const;
export const STRUCTURAL_MODULE_GRAPH_REPORT_CANONICAL_PROFILE =
	'jan-csaa-structural-module-graph-report-canonical/0.1.0' as const;
export const STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const STRUCTURAL_MODULE_GRAPH_REPORT_AUTHORITY = 'NONE' as const;
export const STRUCTURAL_MODULE_GRAPH_REPORT_GATE_EFFECT = 'NONE' as const;

export const STRUCTURAL_MODULE_GRAPH_REPORT_NONCLAIMS = Object.freeze([
	...STRUCTURAL_MODULE_GRAPH_ANALYSIS_NONCLAIMS,
	'CURRENTNESS_FOR_WORKING_OR_CROSS_REVISION_SUBJECT',
	'DWP_004_DWP_005_OR_DWP_006_COMPLETION',
	'FULL_SOURCE_GRAPH_VALIDATION_WITHOUT_THE_BOUND_SEMANTIC_SNAPSHOT',
	'G4_G5_G6_OR_ANY_OTHER_GATE_PASS',
	'PERSISTENCE_OR_INCREMENTAL_REUSE',
	'REGISTERED_JAN_CSAA_007_OPERATION',
	'SUBJECT_OR_PROJECT_RESOLUTION'
] as const);

export const STRUCTURAL_MODULE_GRAPH_REPORT_SAFETY_CEILINGS = Object.freeze({
	analysis: Object.freeze({
		maxComponents: 1_000_000,
		maxEdges: 5_000_000,
		maxNodes: 1_000_000,
		maxSliceNodes: 1_000_000,
		maxTraversalSteps: 50_000_000,
		maxWitnessEdges: 50_000_000
	}),
	maxEntrySurfaceFrontierReasons: 100_000,
	maxRequestStringUtf16CodeUnits: 16 * 1024 * 1024,
	maxResultBytes: 64 * 1024 * 1024
});

export interface StructuralModuleGraphReportBudgets {
	readonly analysis: StructuralModuleGraphAnalysisBudgets;
	readonly maxEntrySurfaceFrontierReasons: number;
	readonly maxRequestStringUtf16CodeUnits: number;
	readonly maxResultBytes: number;
}

export interface StructuralModuleGraphReportSourceGraphReference {
	readonly contentDigest: string;
	readonly graphId: ModuleDependencyGraphId;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY';
	readonly graphSchemaVersion: ModuleDependencyGraphSnapshot['schemaVersion'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface StructuralModuleGraphReportRequest {
	readonly budgets: StructuralModuleGraphReportBudgets;
	readonly entryNodeIds: readonly ModuleDependencyGraphNodeId[];
	readonly entrySurfaceClosure: 'CLOSED' | 'OPEN';
	readonly entrySurfaceFrontierReasons: readonly string[];
	readonly operationVersion: typeof STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof STRUCTURAL_MODULE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION;
	readonly slice: {
		readonly direction: StructuralModuleSliceDirection;
		readonly sourceNodeIds: readonly ModuleDependencyGraphNodeId[];
		readonly targetNodeIds: readonly ModuleDependencyGraphNodeId[];
	};
	readonly sourceGraph: StructuralModuleGraphReportSourceGraphReference;
}

export type StructuralModuleGraphReportFailureState =
	'failed' | 'incompatible' | 'resource-refused';

export type StructuralModuleGraphReportDiagnosticCode =
	| StructuralModuleGraphAnalysisDiagnosticCode
	| 'INTERNAL_VALIDATION_FAILED'
	| 'MAX_RESULT_BYTES_EXCEEDED'
	| 'OPERATION_VERSION_UNSUPPORTED'
	| 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING'
	| 'REQUEST_INVALID'
	| 'REQUEST_POPULATION_BUDGET_EXHAUSTED'
	| 'REQUEST_STRING_BUDGET_EXHAUSTED'
	| 'SCHEMA_VERSION_UNSUPPORTED'
	| 'SOURCE_GRAPH_REFERENCE_MISMATCH';

export interface StructuralModuleGraphReportDiagnostic {
	readonly code: StructuralModuleGraphReportDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'ANALYSIS' | 'REPORT' | 'REQUEST' | 'SOURCE_GRAPH' | 'VALIDATION';
}

export interface StructuralModuleGraphReportResult {
	readonly analysis: StructuralModuleGraphAnalysis;
	readonly analysisInputDigest: string;
	readonly analysisOutcome: 'complete' | 'partial';
	readonly authority: typeof STRUCTURAL_MODULE_GRAPH_REPORT_AUTHORITY;
	readonly canonicalProfile: typeof STRUCTURAL_MODULE_GRAPH_REPORT_CANONICAL_PROFILE;
	readonly capabilityStatus: typeof STRUCTURAL_MODULE_GRAPH_ANALYSIS_STATUS;
	readonly contentDigest: string;
	readonly currentness: {
		readonly basis: 'SOURCE_GRAPH_REFERENCE_ONLY';
		readonly state: 'NOT_EVALUATED';
	};
	readonly facadeNonclaims: typeof STRUCTURAL_MODULE_GRAPH_REPORT_NONCLAIMS;
	readonly gateEffect: typeof STRUCTURAL_MODULE_GRAPH_REPORT_GATE_EFFECT;
	readonly id: string;
	readonly registryStatus: typeof STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS;
	readonly requestDigest: string;
	readonly schemaVersion: typeof STRUCTURAL_MODULE_GRAPH_REPORT_RESULT_SCHEMA_VERSION;
	readonly sourceGraph: StructuralModuleGraphReportSourceGraphReference;
	readonly wireShape: 'CLOSED_EXACT';
}

export interface StructuralModuleGraphReportPartialOutcome {
	readonly diagnostics: readonly [];
	readonly operationVersion: typeof STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly registryStatus: typeof STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS;
	readonly result: StructuralModuleGraphReportResult;
	readonly schemaVersion: typeof STRUCTURAL_MODULE_GRAPH_REPORT_SCHEMA_VERSION;
}

export interface StructuralModuleGraphReportUnavailableOutcome {
	readonly diagnostics: readonly [StructuralModuleGraphReportDiagnostic];
	readonly facadeNonclaims: typeof STRUCTURAL_MODULE_GRAPH_REPORT_NONCLAIMS;
	readonly operationVersion: typeof STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly registryStatus: typeof STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS;
	readonly schemaVersion: typeof STRUCTURAL_MODULE_GRAPH_REPORT_SCHEMA_VERSION;
	readonly state: StructuralModuleGraphReportFailureState;
}

export type StructuralModuleGraphReportOutcome =
	StructuralModuleGraphReportPartialOutcome | StructuralModuleGraphReportUnavailableOutcome;

export type StructuralModuleGraphReportValidationIssueCode =
	| 'CONTENT_DIGEST_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'RESULT_BUDGET_EXHAUSTED'
	| 'SHAPE_INVALID';

export interface StructuralModuleGraphReportValidationIssue {
	readonly code: StructuralModuleGraphReportValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type StructuralModuleGraphReportValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly [StructuralModuleGraphReportValidationIssue];
			readonly state: 'INVALID' | 'RESOURCE_REFUSED';
	  };

const REQUEST_KEYS = [
	'budgets',
	'entryNodeIds',
	'entrySurfaceClosure',
	'entrySurfaceFrontierReasons',
	'operationVersion',
	'schemaVersion',
	'slice',
	'sourceGraph'
] as const;
const BUDGET_KEYS = [
	'analysis',
	'maxEntrySurfaceFrontierReasons',
	'maxRequestStringUtf16CodeUnits',
	'maxResultBytes'
] as const;
const ANALYSIS_BUDGET_KEYS = [
	'maxComponents',
	'maxEdges',
	'maxNodes',
	'maxSliceNodes',
	'maxTraversalSteps',
	'maxWitnessEdges'
] as const;
const SLICE_KEYS = ['direction', 'sourceNodeIds', 'targetNodeIds'] as const;
const SOURCE_GRAPH_KEYS = [
	'contentDigest',
	'graphId',
	'graphInputDigest',
	'graphKind',
	'graphSchemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;
const PARTIAL_OUTCOME_KEYS = [
	'diagnostics',
	'operationVersion',
	'outcome',
	'registryStatus',
	'result',
	'schemaVersion'
] as const;
const UNAVAILABLE_OUTCOME_KEYS = [
	'diagnostics',
	'facadeNonclaims',
	'operationVersion',
	'outcome',
	'registryStatus',
	'schemaVersion',
	'state'
] as const;
const RESULT_KEYS = [
	'analysis',
	'analysisInputDigest',
	'analysisOutcome',
	'authority',
	'canonicalProfile',
	'capabilityStatus',
	'contentDigest',
	'currentness',
	'facadeNonclaims',
	'gateEffect',
	'id',
	'registryStatus',
	'requestDigest',
	'schemaVersion',
	'sourceGraph',
	'wireShape'
] as const;

interface ParsedRequest {
	readonly request: StructuralModuleGraphReportRequest;
	readonly state: 'VALID';
}

interface RejectedRequest {
	readonly code: StructuralModuleGraphReportDiagnosticCode;
	readonly message: string;
	readonly path: string;
	readonly state: StructuralModuleGraphReportFailureState;
}

interface StringLedger {
	utf16CodeUnits: number;
}

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxyValue(value) ||
		Object.getPrototypeOf(value) !== Object.prototype
	)
		return false;
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== 'string'))
		return false;
	const expected = new Set(keys);
	return ownKeys.every((key) => {
		if (typeof key !== 'string' || !expected.has(key)) return false;
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor;
	});
}

function safeBudget(value: unknown): value is number {
	return (
		typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
	);
}

function scalarString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && isUnicodeScalarString(value);
}

function deepFreeze<T>(value: T, active = new WeakSet<object>()): T {
	if (value === null || typeof value !== 'object' || active.has(value)) return value;
	active.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, active);
	}
	return Object.freeze(value);
}

function rejection(
	code: StructuralModuleGraphReportDiagnosticCode,
	message: string,
	path: string,
	state: StructuralModuleGraphReportFailureState = 'incompatible'
): RejectedRequest {
	return { code, message, path, state };
}

function materializeStringArray(
	value: unknown,
	path: string,
	maxItems: number,
	maxStringUtf16CodeUnits: number,
	ledger: StringLedger
): readonly string[] | RejectedRequest {
	if (
		!Array.isArray(value) ||
		isProxyValue(value) ||
		Object.getPrototypeOf(value) !== Array.prototype
	)
		return rejection('REQUEST_INVALID', 'The request population must be a plain array.', path);
	const keys = Reflect.ownKeys(value);
	if (keys.length !== value.length + 1)
		return rejection(
			'REQUEST_INVALID',
			'The request population must be dense and unexpanded.',
			path
		);
	if (value.length > maxItems)
		return rejection(
			'REQUEST_POPULATION_BUDGET_EXHAUSTED',
			'The request population exceeds its admitted item budget.',
			path,
			'resource-refused'
		);
	const result: string[] = [];
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return rejection('REQUEST_INVALID', 'The request population must contain data values.', path);
		if (!scalarString(descriptor.value))
			return rejection(
				'REQUEST_INVALID',
				'The request population contains an invalid string.',
				path
			);
		if (descriptor.value.length > maxStringUtf16CodeUnits - ledger.utf16CodeUnits)
			return rejection(
				'REQUEST_STRING_BUDGET_EXHAUSTED',
				'The request exceeds maxRequestStringUtf16CodeUnits.',
				path,
				'resource-refused'
			);
		ledger.utf16CodeUnits += descriptor.value.length;
		result.push(descriptor.value);
	}
	return result;
}

function canonicalUniqueStrings(
	values: readonly string[],
	path: string
): readonly string[] | RejectedRequest {
	const canonical = [...values].sort(compareText);
	if (canonical.some((value, index) => index > 0 && value === canonical[index - 1]))
		return rejection('REQUEST_INVALID', 'The request population contains duplicate values.', path);
	return canonical;
}

function materializeAnalysisBudgets(
	value: unknown
): StructuralModuleGraphAnalysisBudgets | RejectedRequest {
	if (!exactRecord(value, ANALYSIS_BUDGET_KEYS))
		return rejection(
			'REQUEST_INVALID',
			'The analysis budget record must be exact.',
			'$.budgets.analysis'
		);
	const result: Record<string, number> = {};
	for (const key of ANALYSIS_BUDGET_KEYS) {
		const budget = value[key];
		if (!safeBudget(budget))
			return rejection(
				'REQUEST_INVALID',
				'Analysis budgets must be nonnegative safe integers.',
				`$.budgets.analysis.${key}`
			);
		if (budget > STRUCTURAL_MODULE_GRAPH_REPORT_SAFETY_CEILINGS.analysis[key])
			return rejection(
				'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
				'The analysis budget exceeds the operation safety ceiling.',
				`$.budgets.analysis.${key}`,
				'resource-refused'
			);
		result[key] = budget;
	}
	return result as unknown as StructuralModuleGraphAnalysisBudgets;
}

function materializeBudgets(value: unknown): StructuralModuleGraphReportBudgets | RejectedRequest {
	if (!exactRecord(value, BUDGET_KEYS))
		return rejection('REQUEST_INVALID', 'The report budget record must be exact.', '$.budgets');
	const analysis = materializeAnalysisBudgets(value.analysis);
	if ('code' in analysis) return analysis;
	for (const key of [
		'maxEntrySurfaceFrontierReasons',
		'maxRequestStringUtf16CodeUnits',
		'maxResultBytes'
	] as const) {
		if (!safeBudget(value[key]))
			return rejection(
				'REQUEST_INVALID',
				'Report budgets must be nonnegative safe integers.',
				`$.budgets.${key}`
			);
		if (value[key] > STRUCTURAL_MODULE_GRAPH_REPORT_SAFETY_CEILINGS[key])
			return rejection(
				'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
				'The report budget exceeds the operation safety ceiling.',
				`$.budgets.${key}`,
				'resource-refused'
			);
	}
	return {
		analysis: { ...analysis },
		maxEntrySurfaceFrontierReasons: value.maxEntrySurfaceFrontierReasons as number,
		maxRequestStringUtf16CodeUnits: value.maxRequestStringUtf16CodeUnits as number,
		maxResultBytes: value.maxResultBytes as number
	};
}

function chargeString(
	value: unknown,
	path: string,
	maxStringUtf16CodeUnits: number,
	ledger: StringLedger
): string | RejectedRequest {
	if (!scalarString(value))
		return rejection('REQUEST_INVALID', 'The request string is invalid.', path);
	if (value.length > maxStringUtf16CodeUnits - ledger.utf16CodeUnits)
		return rejection(
			'REQUEST_STRING_BUDGET_EXHAUSTED',
			'The request exceeds maxRequestStringUtf16CodeUnits.',
			path,
			'resource-refused'
		);
	ledger.utf16CodeUnits += value.length;
	return value;
}

function materializeSourceGraph(
	value: unknown,
	maxStringUtf16CodeUnits: number,
	ledger: StringLedger
): StructuralModuleGraphReportSourceGraphReference | RejectedRequest {
	if (!exactRecord(value, SOURCE_GRAPH_KEYS))
		return rejection(
			'REQUEST_INVALID',
			'The source-graph reference must be exact.',
			'$.sourceGraph'
		);
	if (value.graphKind !== 'TYPESCRIPT_MODULE_DEPENDENCY')
		return rejection(
			'REQUEST_INVALID',
			'The source-graph kind is unsupported.',
			'$.sourceGraph.graphKind'
		);
	const graphKind = chargeString(
		value.graphKind,
		'$.sourceGraph.graphKind',
		maxStringUtf16CodeUnits,
		ledger
	);
	if (typeof graphKind !== 'string') return graphKind;
	const strings: Record<string, string> = {};
	for (const key of [
		'contentDigest',
		'graphId',
		'graphInputDigest',
		'graphSchemaVersion',
		'semanticSnapshotId',
		'subjectId'
	] as const) {
		const materialized = chargeString(
			value[key],
			`$.sourceGraph.${key}`,
			maxStringUtf16CodeUnits,
			ledger
		);
		if (typeof materialized !== 'string') return materialized;
		strings[key] = materialized;
	}
	return {
		contentDigest: strings.contentDigest!,
		graphId: strings.graphId as ModuleDependencyGraphId,
		graphInputDigest: strings.graphInputDigest!,
		graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY',
		graphSchemaVersion:
			strings.graphSchemaVersion as ModuleDependencyGraphSnapshot['schemaVersion'],
		semanticSnapshotId: strings.semanticSnapshotId as SemanticSnapshotId,
		subjectId: strings.subjectId!
	};
}

function parseRequest(value: unknown): ParsedRequest | RejectedRequest {
	if (!exactRecord(value, REQUEST_KEYS))
		return rejection('REQUEST_INVALID', 'The structural graph report request must be exact.', '$');
	if (value.schemaVersion !== STRUCTURAL_MODULE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION)
		return rejection(
			'SCHEMA_VERSION_UNSUPPORTED',
			'The structural graph report request schema version is unsupported.',
			'$.schemaVersion'
		);
	if (value.operationVersion !== STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION)
		return rejection(
			'OPERATION_VERSION_UNSUPPORTED',
			'The structural graph report operation version is unsupported.',
			'$.operationVersion'
		);
	const budgets = materializeBudgets(value.budgets);
	if ('code' in budgets) return budgets;
	if (!exactRecord(value.slice, SLICE_KEYS))
		return rejection('REQUEST_INVALID', 'The structural slice record must be exact.', '$.slice');
	if (!['CHOP', 'FORWARD', 'REVERSE'].includes(value.slice.direction as string))
		return rejection(
			'REQUEST_INVALID',
			'The structural slice direction is invalid.',
			'$.slice.direction'
		);
	if (value.entrySurfaceClosure !== 'CLOSED' && value.entrySurfaceClosure !== 'OPEN')
		return rejection(
			'REQUEST_INVALID',
			'The entry-surface closure is invalid.',
			'$.entrySurfaceClosure'
		);
	const ledger: StringLedger = { utf16CodeUnits: 0 };
	for (const [fixedValue, path] of [
		[value.operationVersion, '$.operationVersion'],
		[value.schemaVersion, '$.schemaVersion'],
		[value.entrySurfaceClosure, '$.entrySurfaceClosure'],
		[value.slice.direction, '$.slice.direction']
	] as const) {
		const charged = chargeString(fixedValue, path, budgets.maxRequestStringUtf16CodeUnits, ledger);
		if (typeof charged !== 'string') return charged;
	}
	const sourceGraph = materializeSourceGraph(
		value.sourceGraph,
		budgets.maxRequestStringUtf16CodeUnits,
		ledger
	);
	if ('code' in sourceGraph) return sourceGraph;
	const entryNodeIds = materializeStringArray(
		value.entryNodeIds,
		'$.entryNodeIds',
		budgets.analysis.maxNodes,
		budgets.maxRequestStringUtf16CodeUnits,
		ledger
	);
	if ('code' in entryNodeIds) return entryNodeIds;
	const entrySurfaceFrontierReasons = materializeStringArray(
		value.entrySurfaceFrontierReasons,
		'$.entrySurfaceFrontierReasons',
		budgets.maxEntrySurfaceFrontierReasons,
		budgets.maxRequestStringUtf16CodeUnits,
		ledger
	);
	if ('code' in entrySurfaceFrontierReasons) return entrySurfaceFrontierReasons;
	const sourceNodeIds = materializeStringArray(
		value.slice.sourceNodeIds,
		'$.slice.sourceNodeIds',
		budgets.analysis.maxNodes,
		budgets.maxRequestStringUtf16CodeUnits,
		ledger
	);
	if ('code' in sourceNodeIds) return sourceNodeIds;
	const targetNodeIds = materializeStringArray(
		value.slice.targetNodeIds,
		'$.slice.targetNodeIds',
		budgets.analysis.maxNodes,
		budgets.maxRequestStringUtf16CodeUnits,
		ledger
	);
	if ('code' in targetNodeIds) return targetNodeIds;
	const canonicalEntryNodeIds = canonicalUniqueStrings(entryNodeIds, '$.entryNodeIds');
	if ('code' in canonicalEntryNodeIds) return canonicalEntryNodeIds;
	const canonicalFrontierReasons = canonicalUniqueStrings(
		entrySurfaceFrontierReasons,
		'$.entrySurfaceFrontierReasons'
	);
	if ('code' in canonicalFrontierReasons) return canonicalFrontierReasons;
	const canonicalSourceNodeIds = canonicalUniqueStrings(sourceNodeIds, '$.slice.sourceNodeIds');
	if ('code' in canonicalSourceNodeIds) return canonicalSourceNodeIds;
	const canonicalTargetNodeIds = canonicalUniqueStrings(targetNodeIds, '$.slice.targetNodeIds');
	if ('code' in canonicalTargetNodeIds) return canonicalTargetNodeIds;
	const request: StructuralModuleGraphReportRequest = {
		budgets,
		entryNodeIds: canonicalEntryNodeIds as ModuleDependencyGraphNodeId[],
		entrySurfaceClosure: value.entrySurfaceClosure,
		entrySurfaceFrontierReasons: canonicalFrontierReasons,
		operationVersion: STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_MODULE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
		slice: {
			direction: value.slice.direction as StructuralModuleSliceDirection,
			sourceNodeIds: canonicalSourceNodeIds as ModuleDependencyGraphNodeId[],
			targetNodeIds: canonicalTargetNodeIds as ModuleDependencyGraphNodeId[]
		},
		sourceGraph
	};
	return { request: deepFreeze(request), state: 'VALID' };
}

function graphReferenceMatches(
	reference: StructuralModuleGraphReportSourceGraphReference,
	graph: ModuleDependencyGraphSnapshot
): boolean {
	return (
		graph.graphKind === reference.graphKind &&
		graph.id === reference.graphId &&
		graph.contentDigest === reference.contentDigest &&
		graph.graphInputDigest === reference.graphInputDigest &&
		graph.schemaVersion === reference.graphSchemaVersion &&
		graph.semanticSnapshotId === reference.semanticSnapshotId &&
		graph.subjectId === reference.subjectId
	);
}

function failure(
	code: StructuralModuleGraphReportDiagnosticCode,
	message: string,
	path: string | null,
	phase: StructuralModuleGraphReportDiagnostic['phase'],
	state: StructuralModuleGraphReportFailureState
): StructuralModuleGraphReportUnavailableOutcome {
	return deepFreeze({
		diagnostics: [{ code, message, path, phase }],
		facadeNonclaims: STRUCTURAL_MODULE_GRAPH_REPORT_NONCLAIMS,
		operationVersion: STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		registryStatus: STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS,
		schemaVersion: STRUCTURAL_MODULE_GRAPH_REPORT_SCHEMA_VERSION,
		state
	});
}

function rejectedRequestOutcome(
	rejected: RejectedRequest
): StructuralModuleGraphReportUnavailableOutcome {
	return failure(rejected.code, rejected.message, rejected.path, 'REQUEST', rejected.state);
}

function requestDigest(request: StructuralModuleGraphReportRequest): string {
	return canonicalSemanticJsonWitness(request).sha256;
}

function analysisInputDigest(
	requestDigestValue: string,
	graph: ModuleDependencyGraphSnapshot
): string {
	return canonicalSemanticJsonWitness({
		requestDigest: requestDigestValue,
		sourceGraph: {
			contentDigest: graph.contentDigest,
			graphId: graph.id,
			graphInputDigest: graph.graphInputDigest,
			semanticSnapshotId: graph.semanticSnapshotId,
			subjectId: graph.subjectId
		}
	}).sha256;
}

function reportResultId(inputDigest: string): string {
	return `structural-module-graph-report-result:${sha256(
		`JAN-CSAA-STRUCTURAL-MODULE-GRAPH-REPORT\0${STRUCTURAL_MODULE_GRAPH_REPORT_RESULT_SCHEMA_VERSION}\0${inputDigest}`
	)}`;
}

type StructuralModuleGraphReportResultContent = Omit<
	StructuralModuleGraphReportResult,
	'contentDigest'
>;

function reportResultContentDigest(content: StructuralModuleGraphReportResultContent): string {
	return canonicalSemanticJsonWitness(content).sha256;
}

function materializePartialReport(
	request: StructuralModuleGraphReportRequest,
	graph: ModuleDependencyGraphSnapshot,
	analysis: StructuralModuleGraphAnalysis,
	analysisOutcome: 'complete' | 'partial'
): StructuralModuleGraphReportPartialOutcome {
	const requestDigestValue = requestDigest(request);
	const inputDigest = analysisInputDigest(requestDigestValue, graph);
	const content: StructuralModuleGraphReportResultContent = {
		analysis,
		analysisInputDigest: inputDigest,
		analysisOutcome,
		authority: STRUCTURAL_MODULE_GRAPH_REPORT_AUTHORITY,
		canonicalProfile: STRUCTURAL_MODULE_GRAPH_REPORT_CANONICAL_PROFILE,
		capabilityStatus: STRUCTURAL_MODULE_GRAPH_ANALYSIS_STATUS,
		currentness: { basis: 'SOURCE_GRAPH_REFERENCE_ONLY', state: 'NOT_EVALUATED' },
		facadeNonclaims: STRUCTURAL_MODULE_GRAPH_REPORT_NONCLAIMS,
		gateEffect: STRUCTURAL_MODULE_GRAPH_REPORT_GATE_EFFECT,
		id: reportResultId(inputDigest),
		registryStatus: STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS,
		requestDigest: requestDigestValue,
		schemaVersion: STRUCTURAL_MODULE_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
		sourceGraph: { ...request.sourceGraph },
		wireShape: 'CLOSED_EXACT'
	};
	const result: StructuralModuleGraphReportResult = {
		...content,
		contentDigest: reportResultContentDigest(content)
	};
	return deepFreeze({
		diagnostics: [],
		operationVersion: STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		registryStatus: STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS,
		result,
		schemaVersion: STRUCTURAL_MODULE_GRAPH_REPORT_SCHEMA_VERSION
	});
}

function deriveReport(
	request: StructuralModuleGraphReportRequest,
	graph: ModuleDependencyGraphSnapshot
): StructuralModuleGraphReportOutcome {
	if (!graphReferenceMatches(request.sourceGraph, graph))
		return failure(
			'SOURCE_GRAPH_REFERENCE_MISMATCH',
			'The supplied graph does not match the exact source-graph reference.',
			'$inputs.graph',
			'SOURCE_GRAPH',
			'incompatible'
		);
	const analysisOutcome = analyzeStructuralModuleGraph({
		graph,
		request: {
			budgets: request.budgets.analysis,
			entryNodeIds: request.entryNodeIds,
			entrySurfaceClosure: request.entrySurfaceClosure,
			entrySurfaceFrontierReasons: request.entrySurfaceFrontierReasons,
			slice: request.slice
		}
	});
	if (analysisOutcome.outcome === 'unavailable') {
		const diagnostic = analysisOutcome.diagnostics[0];
		return failure(
			diagnostic.code,
			diagnostic.message,
			diagnostic.path,
			'ANALYSIS',
			diagnostic.code === 'BUDGET_EXHAUSTED' ? 'resource-refused' : 'incompatible'
		);
	}
	if (!graphReferenceMatches(request.sourceGraph, graph))
		return failure(
			'SOURCE_GRAPH_REFERENCE_MISMATCH',
			'The source-graph reference changed during structural analysis.',
			'$inputs.graph',
			'SOURCE_GRAPH',
			'incompatible'
		);
	const partial = materializePartialReport(
		request,
		graph,
		analysisOutcome.analysis,
		analysisOutcome.outcome
	);
	if (canonicalSemanticJsonWitness(partial).bytes > request.budgets.maxResultBytes)
		return failure(
			'MAX_RESULT_BYTES_EXCEEDED',
			'The structural graph report exceeds maxResultBytes.',
			'$.budgets.maxResultBytes',
			'REPORT',
			'resource-refused'
		);
	return partial;
}

function validationIssue(
	code: StructuralModuleGraphReportValidationIssueCode,
	message: string,
	path = '$'
): StructuralModuleGraphReportValidationResult {
	return {
		issues: [{ code, message, path }],
		state: code === 'RESULT_BUDGET_EXHAUSTED' ? 'RESOURCE_REFUSED' : 'INVALID'
	};
}

function validateUnavailableAgainstExpected(
	value: unknown,
	candidateCanonical: string,
	expected: StructuralModuleGraphReportUnavailableOutcome
): StructuralModuleGraphReportValidationResult {
	if (!exactRecord(value, UNAVAILABLE_OUTCOME_KEYS))
		return validationIssue('SHAPE_INVALID', 'The unavailable report envelope must be exact.');
	if (
		value.outcome !== 'unavailable' ||
		value.operationVersion !== STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION ||
		value.schemaVersion !== STRUCTURAL_MODULE_GRAPH_REPORT_SCHEMA_VERSION ||
		value.registryStatus !== STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS ||
		!Array.isArray(value.diagnostics) ||
		value.diagnostics.length !== 1
	)
		return validationIssue('SHAPE_INVALID', 'The unavailable report constants are invalid.');
	if (candidateCanonical !== canonicalSemanticJson(expected))
		return validationIssue(
			'POPULATION_MISMATCH',
			'The unavailable report differs from the independently derived refusal.'
		);
	return { issues: [], state: 'VALID' };
}

function canonicalCandidate(
	value: unknown,
	maxResultBytes: number
): { readonly canonical: string } | StructuralModuleGraphReportValidationResult {
	try {
		const witness = canonicalSemanticJsonWitness(value);
		if (witness.bytes > maxResultBytes)
			return validationIssue(
				'RESULT_BUDGET_EXHAUSTED',
				'The candidate report exceeds its validation byte budget.'
			);
		return { canonical: canonicalSemanticJson(value) };
	} catch {
		return validationIssue('SHAPE_INVALID', 'The candidate report is not canonical JSON data.');
	}
}

function validateWithParsedRequest(
	value: unknown,
	request: StructuralModuleGraphReportRequest,
	graph: ModuleDependencyGraphSnapshot
): StructuralModuleGraphReportValidationResult {
	const unavailableShape =
		exactRecord(value, UNAVAILABLE_OUTCOME_KEYS) && value.outcome === 'unavailable';
	const materializedCandidate = canonicalCandidate(
		value,
		unavailableShape
			? STRUCTURAL_MODULE_GRAPH_REPORT_SAFETY_CEILINGS.maxResultBytes
			: request.budgets.maxResultBytes
	);
	if ('state' in materializedCandidate) return materializedCandidate;
	const candidateCanonical = materializedCandidate.canonical;
	const expected = deriveReport(request, graph);
	if (expected.outcome === 'unavailable')
		return validateUnavailableAgainstExpected(value, candidateCanonical, expected);
	if (!exactRecord(value, PARTIAL_OUTCOME_KEYS) || !exactRecord(value.result, RESULT_KEYS))
		return validationIssue('SHAPE_INVALID', 'The candidate report envelope must be exact.');
	if (
		value.outcome !== 'partial' ||
		value.operationVersion !== STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION ||
		value.schemaVersion !== STRUCTURAL_MODULE_GRAPH_REPORT_SCHEMA_VERSION ||
		value.registryStatus !== STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS ||
		!Array.isArray(value.diagnostics) ||
		value.diagnostics.length !== 0
	)
		return validationIssue('SHAPE_INVALID', 'The candidate report envelope constants are invalid.');
	const result = value.result;
	const { contentDigest: candidateContentDigest, ...candidateContent } =
		result as unknown as StructuralModuleGraphReportResult;
	try {
		if (candidateContentDigest !== reportResultContentDigest(candidateContent))
			return validationIssue(
				'CONTENT_DIGEST_MISMATCH',
				'The candidate result content digest is invalid.',
				'$.result.contentDigest'
			);
	} catch {
		return validationIssue('SHAPE_INVALID', 'The candidate result content is invalid.', '$.result');
	}
	if (
		result.id !== expected.result.id ||
		result.requestDigest !== expected.result.requestDigest ||
		result.analysisInputDigest !== expected.result.analysisInputDigest
	)
		return validationIssue(
			'IDENTITY_MISMATCH',
			'The candidate report identity does not match its bound inputs.',
			'$.result.id'
		);
	if (candidateCanonical !== canonicalSemanticJson(expected))
		return validationIssue(
			'POPULATION_MISMATCH',
			'The candidate report differs from the independently derived population.'
		);
	return { issues: [], state: 'VALID' };
}

export function validateStructuralModuleGraphReport(
	value: unknown,
	requestValue: unknown,
	graph: ModuleDependencyGraphSnapshot
): StructuralModuleGraphReportValidationResult {
	try {
		const parsed = parseRequest(requestValue);
		if ('code' in parsed) {
			const materializedCandidate = canonicalCandidate(
				value,
				STRUCTURAL_MODULE_GRAPH_REPORT_SAFETY_CEILINGS.maxResultBytes
			);
			if ('state' in materializedCandidate) return materializedCandidate;
			return validateUnavailableAgainstExpected(
				value,
				materializedCandidate.canonical,
				rejectedRequestOutcome(parsed)
			);
		}
		return validateWithParsedRequest(value, parsed.request, graph);
	} catch {
		return validationIssue('SHAPE_INVALID', 'Report validation failed closed on invalid input.');
	}
}

export function runStructuralModuleGraphReport(
	requestValue: unknown,
	graph: ModuleDependencyGraphSnapshot
): StructuralModuleGraphReportOutcome {
	try {
		const parsed = parseRequest(requestValue);
		if ('code' in parsed) return rejectedRequestOutcome(parsed);
		const outcome = deriveReport(parsed.request, graph);
		if (outcome.outcome === 'unavailable') return outcome;
		const validation = validateWithParsedRequest(outcome, parsed.request, graph);
		if (validation.state !== 'VALID')
			return failure(
				'INTERNAL_VALIDATION_FAILED',
				'The constructed structural graph report failed independent validation.',
				validation.issues[0].path,
				'VALIDATION',
				'failed'
			);
		return outcome;
	} catch {
		return failure(
			'REQUEST_INVALID',
			'The structural graph report failed closed on invalid input.',
			null,
			'REQUEST',
			'incompatible'
		);
	}
}
