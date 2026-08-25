import ts from 'typescript';
import {
	CALL_GRAPH_CANONICAL_PROFILE,
	CALL_GRAPH_CAPABILITY,
	CALL_GRAPH_CAPABILITY_STATUS,
	CALL_GRAPH_METHOD,
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_SCHEMA_VERSION,
	type CallGraphCoverage,
	type CallGraphEdge,
	type CallGraphEntryMechanism,
	type CallGraphEpistemicState,
	type CallGraphId,
	type CallGraphIndexEntry,
	type CallGraphNode,
	type CallGraphRelationLane,
	type CallGraphResolutionClass,
	type CallGraphSnapshot
} from '../contracts/call-graph.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	type SemanticProvenanceId,
	type SemanticSymbolId,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../semantic/canonical.js';
import { assertCanonicalRelativePath } from '../subject/paths.js';
import {
	callGraphCallSiteNodeId,
	callGraphCallableTargetNodeId,
	callGraphEdgeId,
	callGraphFrontierNodeId,
	callGraphId,
	callGraphLayerId,
	callGraphSourceRegionNodeId
} from './call-graph-ids.js';
import { callGraphContentDigest } from './call-graph-content.js';
import { callGraphInputDigest } from './call-graph-input.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const DEFAULT_MAX_ISSUES = 1_000;

const TOP_LEVEL_KEYS = [
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'contentDigest',
	'coverage',
	'edges',
	'entryMechanismCoverage',
	'epistemic',
	'forwardIndex',
	'fullJanCsaa007Conformance',
	'graphInputDigest',
	'graphKind',
	'health',
	'id',
	'layers',
	'limitations',
	'method',
	'nodes',
	'operationVersion',
	'producer',
	'relationLaneCoverage',
	'reverseIndex',
	'schemaVersion',
	'semanticExtractionVersion',
	'semanticSchemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;

const COVERAGE_KEYS = [
	'candidateSetCallSites',
	'candidateTargetEdges',
	'closure',
	'exactCallSites',
	'expectedCallSites',
	'externalDispatchCallSites',
	'frontierNodes',
	'ownershipEdges',
	'reconciles',
	'representedCallSites',
	'targetEdges',
	'unresolvedCallSites',
	'unsupportedCallSites',
	'wholeProgramReachability'
] as const;

const EPISTEMIC_KEYS = [
	'capabilityCoverage',
	'conflictState',
	'executionHealth',
	'freshness',
	'inferenceState',
	'supportBasis'
] as const;
const LOCATION_KEYS = ['end', 'sourceId', 'start'] as const;
const ENDPOINT_KEYS = ['kind', 'nodeId'] as const;
const PROVIDER_KEYS = ['api', 'id', 'version'] as const;
const INDEX_KEYS = ['edgeIds', 'nodeId'] as const;
const LIMITATION_KEYS = ['closureEffect', 'invocationId', 'kind', 'reason', 'sourceId'] as const;
const ENTRY_COVERAGE_KEYS = ['mechanism', 'reason', 'state'] as const;
const LANE_COVERAGE_KEYS = ['lane', 'reason', 'state'] as const;
const INFERENCE_BASIS_KEYS = ['inputIds', 'limitationKinds', 'method', 'rationale'] as const;

const LAYER_KEYS = [
	'capability',
	'capabilityStatus',
	'coverage',
	'edgeIds',
	'entryMechanismCoverage',
	'epistemic',
	'graphId',
	'id',
	'kind',
	'limitations',
	'method',
	'nodeIds',
	'ordinal',
	'producer',
	'provenanceIds',
	'relationLaneCoverage',
	'semanticSnapshotId',
	'subjectId'
] as const;

const NODE_BASE_KEYS = [
	'epistemic',
	'graphId',
	'id',
	'kind',
	'layerId',
	'provenanceIds',
	'semanticSnapshotId',
	'sourceLocations',
	'subjectId'
] as const;
const SOURCE_REGION_NODE_KEYS = [
	...NODE_BASE_KEYS,
	'analysisDisposition',
	'logicalPath',
	'programId',
	'projectId',
	'semanticSourceId'
] as const;
const CALLABLE_TARGET_NODE_KEYS = [
	...NODE_BASE_KEYS,
	'bodyState',
	'callableKind',
	'declarationIds',
	'programId',
	'projectId',
	'semanticNodeId',
	'sourceId',
	'symbolIds'
] as const;
const CALL_SITE_NODE_KEYS = [
	...NODE_BASE_KEYS,
	'calleeNodeId',
	'dispatchClass',
	'invocationId',
	'invocationKind',
	'invocationNodeId',
	'optional',
	'ownerNodeId',
	'programId',
	'projectId',
	'reasonCode',
	'referenceIds',
	'resolutionClass',
	'resolvedSymbolIds',
	'sourceId',
	'targetNodeIds'
] as const;
const FRONTIER_NODE_KEYS = [
	...NODE_BASE_KEYS,
	'frontierKind',
	'invocationId',
	'reasonCode',
	'semanticSymbolIds',
	'sourceId'
] as const;

const EDGE_BASE_KEYS = [
	'candidateRank',
	'epistemic',
	'evidenceClass',
	'graphId',
	'id',
	'invocationId',
	'layerId',
	'method',
	'provenanceIds',
	'relationCode',
	'relationKind',
	'resolutionClass',
	'semanticSnapshotId',
	'source',
	'sourceLocations',
	'subjectId',
	'target',
	'targetState'
] as const;
const CANDIDATE_EDGE_KEYS = [...EDGE_BASE_KEYS, 'inferenceBasis'] as const;

const ENTRY_MECHANISMS = [
	'CONFIG_MANIFEST_SCRIPT_PLUGIN_OR_EXTENSION',
	'DECORATOR_OR_METADATA_DISCOVERY',
	'DEPENDENCY_INJECTION_OR_SERVICE_REGISTRY',
	'DYNAMIC_IMPORT_OR_CONDITIONAL_LOAD',
	'EVENT_MESSAGE_COMMAND_CALLBACK_TIMER_OR_SUBSCRIPTION',
	'EXTERNAL_API_JOB_PROTOCOL_OR_NATIVE_ENTRY',
	'FRAMEWORK_ENTRY',
	'GENERATED_OR_VIRTUAL_SOURCE_ENTRY',
	'PACKAGE_OR_EXECUTABLE_ENTRY',
	'REFLECTION_OR_NAME_LOOKUP',
	'RUNTIME_OBSERVED_ENTRY',
	'TEST_DISCOVERY_ENTRY'
] as const satisfies readonly CallGraphEntryMechanism[];
const RELATION_LANES = [
	'CANDIDATE',
	'CONFIRMED',
	'INFERRED',
	'OBSERVED',
	'UNRESOLVED'
] as const satisfies readonly CallGraphRelationLane[];
const EXPECTED_ENTRY_MECHANISM_COVERAGE = ENTRY_MECHANISMS.map((mechanism) => ({
	mechanism,
	reason: 'This initial static call projection does not model entry mechanisms.',
	state: 'NOT_ANALYZED' as const
}));
const EXPECTED_RELATION_LANE_COVERAGE = [
	{
		lane: 'CANDIDATE' as const,
		reason:
			'Compiler-bound symbols and retained callable declarations support open static candidates.',
		state: 'PARTIAL' as const
	},
	{
		lane: 'CONFIRMED' as const,
		reason:
			'Compiler-resolved signatures plus a retained inline implementation support exact inline targets; other dispatch remains open.',
		state: 'PARTIAL' as const
	},
	{
		lane: 'INFERRED' as const,
		reason: 'No separately qualified call-target inference provider is applied.',
		state: 'NOT_SUPPORTED' as const
	},
	{
		lane: 'OBSERVED' as const,
		reason: 'No runtime execution evidence is consumed by this static projection.',
		state: 'NOT_RUN' as const
	},
	{
		lane: 'UNRESOLVED' as const,
		reason: 'Every unbounded, unresolved, external, or unsupported target remains explicit.',
		state: 'SUPPORTED' as const
	}
];
const TRANSPARENT_CALLEE_KINDS = new Set<number>([
	ts.SyntaxKind.ParenthesizedExpression,
	ts.SyntaxKind.NonNullExpression,
	ts.SyntaxKind.AsExpression,
	ts.SyntaxKind.TypeAssertionExpression,
	ts.SyntaxKind.SatisfiesExpression
]);
const LIMITATION_KINDS = [
	'CALLABLE_VALUE_FLOW_NOT_MODELED',
	'CALLER_CONTEXT_COARSENED',
	'CANDIDATE_SET_OPEN',
	'DYNAMIC_DISPATCH_NOT_CLOSED',
	'ENTRY_MECHANISM_NOT_ANALYZED',
	'EXTERNAL_DISPATCH_FRONTIER',
	'INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED',
	'SEMANTIC_INPUT_PARTIAL',
	'UNRESOLVED_TARGET_FRONTIER',
	'UNSUPPORTED_TARGET_FRONTIER'
] as const;
const DISPATCH_CLASSES = [
	'DIRECT_REFERENCE',
	'DYNAMIC_EXPRESSION',
	'INLINE_CALLABLE',
	'LITERAL_ELEMENT_REFERENCE',
	'MEMBER_REFERENCE',
	'UNSUPPORTED_EXPRESSION'
] as const;
const REASON_CODES = [
	'CALLEE_REFERENCE_NOT_RECONCILED',
	'CALLABLE_VALUE_FLOW_NOT_MODELED',
	'COMPUTED_ELEMENT_DISPATCH',
	'DYNAMIC_CALLEE_EXPRESSION',
	'DYNAMIC_IMPORT_CALL',
	'INLINE_CALLABLE_EXACT_SYNTAX_TARGET',
	'INLINE_CALLABLE_WITHOUT_RESOLVED_SIGNATURE',
	'INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED',
	'MULTIPLE_CALLEE_REFERENCE_CANDIDATES',
	'REFERENCE_UNRESOLVED',
	'REFERENCE_UNSUPPORTED',
	'RESOLVED_EXTERNAL_OR_CONTEXT_ONLY_SYMBOL',
	'RESOLVED_LOCAL_CALLABLE_CANDIDATES',
	'RESOLVED_SYMBOL_WITHOUT_EXECUTABLE_TARGET',
	'THIS_OR_SUPER_DISPATCH'
] as const;
const CALLABLE_KINDS = [
	'ARROW_FUNCTION',
	'CLASS_DECLARATION',
	'CLASS_EXPRESSION',
	'CLASS_STATIC_BLOCK',
	'CONSTRUCTOR',
	'FUNCTION_DECLARATION',
	'FUNCTION_EXPRESSION',
	'GET_ACCESSOR',
	'METHOD_DECLARATION',
	'SET_ACCESSOR'
] as const;

export type CallGraphValidationIssueCode =
	| 'ABSOLUTE_PATH'
	| 'CONFORMANCE_OVERCLAIM'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'DANGLING_REFERENCE'
	| 'DUPLICATE_ID'
	| 'GRAPH_INPUT_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INVALID_SHAPE'
	| 'INVALID_VALUE'
	| 'LIMITATION_MISMATCH'
	| 'NONCANONICAL_ORDER'
	| 'POPULATION_BUDGET_EXCEEDED'
	| 'POPULATION_MISMATCH'
	| 'UNSUPPORTED_SCHEMA_VERSION'
	| 'VALIDATION_BUDGET_EXHAUSTED';

export interface CallGraphValidationIssue {
	readonly code: CallGraphValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface CallGraphValidationOptions {
	readonly maxIssues?: number;
}

export type CallGraphValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly CallGraphValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

class IssueCollector {
	readonly issues: CallGraphValidationIssue[] = [];
	exhausted = false;

	constructor(readonly maxIssues: number) {}

	add(code: CallGraphValidationIssueCode, path: string, message: string): void {
		if (this.exhausted) return;
		if (this.issues.length >= this.maxIssues) {
			this.exhausted = true;
			return;
		}
		this.issues.push({ code, message, path });
	}

	result(): CallGraphValidationResult {
		if (this.issues.length === 0 && !this.exhausted) return { issues: [], state: 'VALID' };
		return {
			issues: this.issues,
			state: this.exhausted ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};
	}
}

type JsonRecord = Record<string, unknown>;

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function plainRecord(value: unknown): value is JsonRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(
	value: unknown,
	expected: readonly string[],
	path: string,
	issues: IssueCollector
): value is JsonRecord {
	if (!plainRecord(value)) {
		issues.add('INVALID_SHAPE', path, 'Expected a plain object.');
		return false;
	}
	const actual = Object.keys(value).sort(compareText);
	const wanted = [...expected].sort(compareText);
	if (!same(actual, wanted)) {
		issues.add(
			'INVALID_SHAPE',
			path,
			`Expected exact fields ${wanted.join(', ')}; received ${actual.join(', ')}.`
		);
		return false;
	}
	return true;
}

function scalarString(value: unknown): value is string {
	return typeof value === 'string' && isUnicodeScalarString(value);
}

function nonemptyString(value: unknown): value is string {
	return scalarString(value) && value.length > 0;
}

function nullableString(value: unknown): value is string | null {
	return value === null || scalarString(value);
}

function nonnegativeInteger(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) >= 0;
}

function stringArray(value: unknown): value is readonly string[] {
	return Array.isArray(value) && value.every(scalarString);
}

function oneOf(value: unknown, values: readonly string[]): value is string {
	return typeof value === 'string' && values.includes(value);
}

function same(left: unknown, right: unknown): boolean {
	return canonicalSemanticJson(left) === canonicalSemanticJson(right);
}

function shapeEpistemic(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, EPISTEMIC_KEYS, path, issues)) return false;
	const valid =
		oneOf(value.capabilityCoverage, ['SUPPORTED', 'PARTIAL', 'UNSUPPORTED']) &&
		oneOf(value.conflictState, ['NOT_EVALUATED', 'NONE_OBSERVED', 'CONFLICTING']) &&
		oneOf(value.executionHealth, ['SUCCEEDED', 'PARTIAL', 'FAILED']) &&
		oneOf(value.freshness, ['SNAPSHOT_BOUND', 'STALE', 'UNKNOWN']) &&
		oneOf(value.inferenceState, ['NONE', 'CANDIDATE', 'UNRESOLVED', 'MIXED']) &&
		oneOf(value.supportBasis, [
			'COMPILER_CONFIRMED',
			'COMPILER_BOUND_STATIC_CANDIDATE',
			'NO_TARGET_EVIDENCE',
			'UNSUPPORTED'
		]);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Epistemic dimensions contain invalid values.');
	return valid;
}

function shapeLocation(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, LOCATION_KEYS, path, issues)) return false;
	const valid =
		nonnegativeInteger(value.start) &&
		nonnegativeInteger(value.end) &&
		(value.start as number) <= (value.end as number) &&
		scalarString(value.sourceId);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Source location fields are invalid.');
	return valid;
}

function shapeProvider(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, PROVIDER_KEYS, path, issues)) return false;
	const valid =
		value.api === 'PUBLIC_COMPILER_API' &&
		value.id === 'typescript' &&
		nonemptyString(value.version);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Provider identity fields are invalid.');
	return valid;
}

function shapeEndpoint(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, ENDPOINT_KEYS, path, issues)) return false;
	const valid =
		oneOf(value.kind, ['SOURCE_REGION', 'CALLABLE_TARGET', 'CALL_SITE', 'FRONTIER']) &&
		scalarString(value.nodeId);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Graph endpoint fields are invalid.');
	return valid;
}

function shapeCoverage(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, COVERAGE_KEYS, path, issues)) return false;
	let valid = true;
	for (const key of COVERAGE_KEYS) {
		const field = value[key];
		if (key === 'closure') valid = oneOf(field, ['CLOSED_WITHIN_DECLARED_METHOD', 'OPEN']) && valid;
		else if (key === 'reconciles') valid = typeof field === 'boolean' && valid;
		else if (key === 'wholeProgramReachability') valid = field === 'NOT_CLAIMED' && valid;
		else valid = nonnegativeInteger(field) && valid;
	}
	if (!valid) issues.add('INVALID_SHAPE', path, 'Coverage fields have invalid primitive values.');
	return valid;
}

function shapeLimitation(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, LIMITATION_KEYS, path, issues)) return false;
	const valid =
		oneOf(value.closureEffect, ['NONE', 'DEGRADES_CLOSURE']) &&
		nullableString(value.invocationId) &&
		oneOf(value.kind, LIMITATION_KINDS) &&
		nonemptyString(value.reason) &&
		nullableString(value.sourceId);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Limitation fields have invalid values.');
	return valid;
}

function shapeEntryCoverage(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, ENTRY_COVERAGE_KEYS, path, issues)) return false;
	const valid =
		oneOf(value.mechanism, ENTRY_MECHANISMS) &&
		nonemptyString(value.reason) &&
		oneOf(value.state, ['COVERED', 'PARTIAL', 'NOT_ANALYZED', 'NOT_APPLICABLE']);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Entry-mechanism coverage fields are invalid.');
	return valid;
}

function shapeLaneCoverage(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, LANE_COVERAGE_KEYS, path, issues)) return false;
	const valid =
		oneOf(value.lane, RELATION_LANES) &&
		nonemptyString(value.reason) &&
		oneOf(value.state, ['SUPPORTED', 'PARTIAL', 'NOT_SUPPORTED', 'NOT_RUN']);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Relation-lane coverage fields are invalid.');
	return valid;
}

function shapeIndex(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, INDEX_KEYS, path, issues)) return false;
	const valid = scalarString(value.nodeId) && stringArray(value.edgeIds);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Index-entry fields are invalid.');
	return valid;
}

function nodeKeysForKind(kind: unknown): readonly string[] | null {
	if (kind === 'SOURCE_REGION') return SOURCE_REGION_NODE_KEYS;
	if (kind === 'CALLABLE_TARGET') return CALLABLE_TARGET_NODE_KEYS;
	if (kind === 'CALL_SITE') return CALL_SITE_NODE_KEYS;
	if (kind === 'FRONTIER') return FRONTIER_NODE_KEYS;
	return null;
}

function shapeNodeBaseFields(value: JsonRecord, path: string, issues: IssueCollector): boolean {
	let valid =
		shapeEpistemic(value.epistemic, `${path}.epistemic`, issues) &&
		scalarString(value.graphId) &&
		scalarString(value.id) &&
		scalarString(value.layerId) &&
		stringArray(value.provenanceIds) &&
		scalarString(value.semanticSnapshotId) &&
		Array.isArray(value.sourceLocations) &&
		scalarString(value.subjectId);
	if (Array.isArray(value.sourceLocations))
		for (const [index, location] of value.sourceLocations.entries()) {
			valid = shapeLocation(location, `${path}.sourceLocations[${index}]`, issues) && valid;
			if (issues.exhausted) break;
		}
	return valid;
}

function shapeSourceRegionNodeFields(value: JsonRecord): boolean {
	return (
		oneOf(value.analysisDisposition, ['DEEP_INDEXED', 'CONTEXT_ONLY']) &&
		scalarString(value.logicalPath) &&
		scalarString(value.programId) &&
		scalarString(value.projectId) &&
		scalarString(value.semanticSourceId)
	);
}

function shapeCallableTargetNodeFields(value: JsonRecord): boolean {
	return (
		oneOf(value.bodyState, ['BLOCK_BODY', 'EXPRESSION_BODY', 'IMPLICIT', 'STATIC_BLOCK']) &&
		oneOf(value.callableKind, CALLABLE_KINDS) &&
		stringArray(value.declarationIds) &&
		scalarString(value.programId) &&
		scalarString(value.projectId) &&
		scalarString(value.semanticNodeId) &&
		scalarString(value.sourceId) &&
		stringArray(value.symbolIds)
	);
}

function shapeCallSiteNodeFields(value: JsonRecord): boolean {
	return (
		scalarString(value.calleeNodeId) &&
		oneOf(value.dispatchClass, DISPATCH_CLASSES) &&
		scalarString(value.invocationId) &&
		oneOf(value.invocationKind, ['CALL', 'NEW', 'TAGGED_TEMPLATE']) &&
		scalarString(value.invocationNodeId) &&
		typeof value.optional === 'boolean' &&
		scalarString(value.ownerNodeId) &&
		scalarString(value.programId) &&
		scalarString(value.projectId) &&
		oneOf(value.reasonCode, REASON_CODES) &&
		stringArray(value.referenceIds) &&
		oneOf(value.resolutionClass, [
			'EXACT',
			'CANDIDATE_SET',
			'EXTERNAL_DISPATCH',
			'UNRESOLVED',
			'UNSUPPORTED'
		]) &&
		stringArray(value.resolvedSymbolIds) &&
		scalarString(value.sourceId) &&
		stringArray(value.targetNodeIds)
	);
}

function shapeFrontierNodeFields(value: JsonRecord): boolean {
	return (
		oneOf(value.frontierKind, ['EXTERNAL_DISPATCH', 'UNRESOLVED', 'UNSUPPORTED']) &&
		scalarString(value.invocationId) &&
		oneOf(value.reasonCode, REASON_CODES) &&
		stringArray(value.semanticSymbolIds) &&
		scalarString(value.sourceId)
	);
}

function shapeNodeKindFields(value: JsonRecord): boolean {
	if (value.kind === 'SOURCE_REGION') return shapeSourceRegionNodeFields(value);
	if (value.kind === 'CALLABLE_TARGET') return shapeCallableTargetNodeFields(value);
	if (value.kind === 'CALL_SITE') return shapeCallSiteNodeFields(value);
	return shapeFrontierNodeFields(value);
}

function shapeNode(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!plainRecord(value)) {
		issues.add('INVALID_SHAPE', path, 'Expected a graph-node object.');
		return false;
	}
	const expected = nodeKeysForKind(value.kind);
	if (expected === null) {
		issues.add('INVALID_SHAPE', `${path}.kind`, 'Unknown call-graph node kind.');
		return false;
	}
	if (!exactKeys(value, expected, path, issues)) return false;
	let valid = shapeNodeBaseFields(value, path, issues);
	valid = shapeNodeKindFields(value) && valid;
	if (!valid) issues.add('INVALID_SHAPE', path, 'Graph-node fields have invalid primitive values.');
	return valid;
}

function shapeEdgePrimitiveFields(
	value: JsonRecord,
	path: string,
	issues: IssueCollector
): boolean {
	let valid = nonnegativeInteger(value.candidateRank) || value.candidateRank === null;
	valid =
		shapeEpistemic(value.epistemic, `${path}.epistemic`, issues) &&
		oneOf(value.evidenceClass, ['R-SEM', 'R-INF']) &&
		scalarString(value.graphId) &&
		scalarString(value.id) &&
		scalarString(value.invocationId) &&
		scalarString(value.layerId) &&
		value.method === CALL_GRAPH_METHOD &&
		stringArray(value.provenanceIds) &&
		oneOf(value.relationCode, ['STRUCTURAL', 'REL-067', 'REL-068', 'REL-071']) &&
		oneOf(value.relationKind, [
			'CALL_SITE_OWNERSHIP',
			'CONFIRMED_CALL_TARGET',
			'CANDIDATE_CALL_TARGET',
			'UNRESOLVED_CALL_TARGET'
		]) &&
		(value.resolutionClass === null ||
			oneOf(value.resolutionClass, [
				'EXACT',
				'CANDIDATE_SET',
				'EXTERNAL_DISPATCH',
				'UNRESOLVED',
				'UNSUPPORTED'
			])) &&
		scalarString(value.semanticSnapshotId) &&
		Array.isArray(value.sourceLocations) &&
		scalarString(value.subjectId) &&
		oneOf(value.targetState, ['STRUCTURAL', 'CONFIRMED', 'CANDIDATE', 'UNRESOLVED_DYNAMIC']) &&
		valid;
	return valid;
}

function shapeEdgeEndpoints(value: JsonRecord, path: string, issues: IssueCollector): boolean {
	let valid = shapeEndpoint(value.source, `${path}.source`, issues);
	valid = shapeEndpoint(value.target, `${path}.target`, issues) && valid;
	if (Array.isArray(value.sourceLocations))
		for (const [index, location] of value.sourceLocations.entries()) {
			valid = shapeLocation(location, `${path}.sourceLocations[${index}]`, issues) && valid;
			if (issues.exhausted) break;
		}
	return valid;
}

function shapeEdgeInferenceBasis(value: JsonRecord, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value.inferenceBasis, INFERENCE_BASIS_KEYS, `${path}.inferenceBasis`, issues))
		return false;
	return (
		stringArray(value.inferenceBasis.inputIds) &&
		stringArray(value.inferenceBasis.limitationKinds) &&
		value.inferenceBasis.limitationKinds.every((kind) => oneOf(kind, LIMITATION_KINDS)) &&
		value.inferenceBasis.method === CALL_GRAPH_METHOD &&
		nonemptyString(value.inferenceBasis.rationale)
	);
}

function shapeEdge(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!plainRecord(value)) {
		issues.add('INVALID_SHAPE', path, 'Expected a graph-edge object.');
		return false;
	}
	const expected =
		value.relationKind === 'CANDIDATE_CALL_TARGET' ? CANDIDATE_EDGE_KEYS : EDGE_BASE_KEYS;
	if (!exactKeys(value, expected, path, issues)) return false;
	let valid = shapeEdgePrimitiveFields(value, path, issues);
	valid = shapeEdgeEndpoints(value, path, issues) && valid;
	if (value.relationKind === 'CANDIDATE_CALL_TARGET')
		valid = shapeEdgeInferenceBasis(value, path, issues) && valid;
	if (!valid) issues.add('INVALID_SHAPE', path, 'Graph-edge fields have invalid primitive values.');
	return valid;
}

interface NestedPopulationMaximums {
	readonly declarationIds: number;
	readonly edgeIds: number;
	readonly inputIds: number;
	readonly limitationKinds: number;
	readonly nodeIds: number;
	readonly provenanceIds: number;
	readonly referenceIds: number;
	readonly resolvedSymbolIds: number;
	readonly semanticSymbolIds: number;
	readonly sourceLocations: number;
	readonly symbolIds: number;
	readonly targetNodeIds: number;
}

function topLevelPopulationBudget(
	value: JsonRecord,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector
): boolean {
	const invocations = snapshot.invocations.length;
	const astNodes = snapshot.astNodes.length;
	const sources = snapshot.sources.length;
	const derivedNodeMaximum = sources + astNodes + invocations * 2;
	const derivedEdgeMaximum = Math.min(
		Number.MAX_SAFE_INTEGER,
		invocations * (Math.max(1, astNodes) + 1)
	);
	const limits: readonly [string, unknown, number][] = [
		['nodes', value.nodes, derivedNodeMaximum],
		['edges', value.edges, derivedEdgeMaximum],
		['limitations', value.limitations, snapshot.limitations.length + invocations * 4 + 16],
		['forwardIndex', value.forwardIndex, derivedNodeMaximum],
		['reverseIndex', value.reverseIndex, derivedNodeMaximum],
		['entryMechanismCoverage', value.entryMechanismCoverage, ENTRY_MECHANISMS.length],
		['relationLaneCoverage', value.relationLaneCoverage, RELATION_LANES.length],
		['layers', value.layers, 1]
	];
	for (const [field, population, maximum] of limits) {
		if (!Array.isArray(population)) continue;
		if (population.length > maximum) {
			issues.add(
				'POPULATION_BUDGET_EXCEEDED',
				`$.${field}`,
				`${field} exceeds the maximum population derivable for this bounded producer.`
			);
			return false;
		}
	}
	return true;
}

function nestedPopulationMaximums(
	value: JsonRecord,
	snapshot: StaticSemanticSnapshot
): NestedPopulationMaximums {
	return {
		declarationIds: snapshot.declarations.length,
		edgeIds: Array.isArray(value.edges) ? value.edges.length : 0,
		inputIds:
			snapshot.astNodes.length +
			snapshot.declarations.length +
			snapshot.invocations.length +
			snapshot.overloadSets.length +
			snapshot.provenances.length +
			snapshot.references.length +
			snapshot.signatures.length +
			snapshot.sources.length +
			snapshot.symbols.length +
			snapshot.typeRelations.length,
		limitationKinds: LIMITATION_KINDS.length,
		nodeIds: Array.isArray(value.nodes) ? value.nodes.length : 0,
		provenanceIds: snapshot.provenances.length,
		referenceIds: snapshot.references.length,
		resolvedSymbolIds: snapshot.symbols.length,
		semanticSymbolIds: snapshot.symbols.length,
		sourceLocations: 4,
		symbolIds: snapshot.symbols.length,
		targetNodeIds: snapshot.astNodes.length + snapshot.invocations.length
	};
}

function withinNestedMaximum(
	population: unknown,
	field: keyof NestedPopulationMaximums,
	maximums: NestedPopulationMaximums,
	path: string,
	issues: IssueCollector
): boolean {
	if (!Array.isArray(population)) return true;
	if (population.length <= maximums[field]) return true;
	issues.add(
		'POPULATION_BUDGET_EXCEEDED',
		path,
		`${field} exceeds the population bound derived from the semantic snapshot.`
	);
	return false;
}

function nodePopulationBudget(
	nodes: readonly unknown[],
	maximums: NestedPopulationMaximums,
	issues: IssueCollector
): boolean {
	for (const [index, node] of nodes.entries()) {
		if (!plainRecord(node)) continue;
		for (const field of [
			'declarationIds',
			'provenanceIds',
			'referenceIds',
			'resolvedSymbolIds',
			'semanticSymbolIds',
			'sourceLocations',
			'symbolIds',
			'targetNodeIds'
		] as const)
			if (!withinNestedMaximum(node[field], field, maximums, `$.nodes[${index}].${field}`, issues))
				return false;
	}
	return true;
}

function edgeRecordWithinBudget(
	edge: JsonRecord,
	path: string,
	maximums: NestedPopulationMaximums,
	issues: IssueCollector
): boolean {
	if (
		!withinNestedMaximum(
			edge.provenanceIds,
			'provenanceIds',
			maximums,
			`${path}.provenanceIds`,
			issues
		)
	)
		return false;
	if (
		!withinNestedMaximum(
			edge.sourceLocations,
			'sourceLocations',
			maximums,
			`${path}.sourceLocations`,
			issues
		)
	)
		return false;
	if (!plainRecord(edge.inferenceBasis)) return true;
	if (
		!withinNestedMaximum(
			edge.inferenceBasis.inputIds,
			'inputIds',
			maximums,
			`${path}.inferenceBasis.inputIds`,
			issues
		)
	)
		return false;
	return withinNestedMaximum(
		edge.inferenceBasis.limitationKinds,
		'limitationKinds',
		maximums,
		`${path}.inferenceBasis.limitationKinds`,
		issues
	);
}

function edgePopulationBudget(
	edges: readonly unknown[],
	maximums: NestedPopulationMaximums,
	issues: IssueCollector
): boolean {
	for (const [index, edge] of edges.entries())
		if (plainRecord(edge) && !edgeRecordWithinBudget(edge, `$.edges[${index}]`, maximums, issues))
			return false;
	return true;
}

function layerRecordWithinBudget(
	layer: JsonRecord,
	path: string,
	maximums: NestedPopulationMaximums,
	limitationMaximum: number,
	issues: IssueCollector
): boolean {
	if (!withinNestedMaximum(layer.edgeIds, 'edgeIds', maximums, `${path}.edgeIds`, issues))
		return false;
	if (!withinNestedMaximum(layer.nodeIds, 'nodeIds', maximums, `${path}.nodeIds`, issues))
		return false;
	if (
		!withinNestedMaximum(
			layer.provenanceIds,
			'provenanceIds',
			maximums,
			`${path}.provenanceIds`,
			issues
		)
	)
		return false;
	for (const [field, maximum] of [
		['entryMechanismCoverage', ENTRY_MECHANISMS.length],
		['limitations', limitationMaximum],
		['relationLaneCoverage', RELATION_LANES.length]
	] as const) {
		const population = layer[field];
		if (Array.isArray(population) && population.length > maximum) {
			issues.add(
				'POPULATION_BUDGET_EXCEEDED',
				`${path}.${field}`,
				`${field} exceeds the bounded layer population.`
			);
			return false;
		}
	}
	return true;
}

function layerPopulationBudget(
	layers: readonly unknown[],
	maximums: NestedPopulationMaximums,
	limitationMaximum: number,
	issues: IssueCollector
): boolean {
	for (const [index, layer] of layers.entries())
		if (
			plainRecord(layer) &&
			!layerRecordWithinBudget(layer, `$.layers[${index}]`, maximums, limitationMaximum, issues)
		)
			return false;
	return true;
}

function indexPopulationBudget(
	value: JsonRecord,
	maximums: NestedPopulationMaximums,
	issues: IssueCollector
): boolean {
	for (const field of ['forwardIndex', 'reverseIndex'] as const) {
		const index = value[field];
		if (!Array.isArray(index)) continue;
		for (const [entryIndex, entry] of index.entries())
			if (
				plainRecord(entry) &&
				!withinNestedMaximum(
					entry.edgeIds,
					'edgeIds',
					maximums,
					`$.${field}[${entryIndex}].edgeIds`,
					issues
				)
			)
				return false;
	}
	return true;
}

function populationBudget(
	value: JsonRecord,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector
): boolean {
	if (!topLevelPopulationBudget(value, snapshot, issues)) return false;
	const maximums = nestedPopulationMaximums(value, snapshot);
	const layerLimitationMaximum = snapshot.limitations.length + snapshot.invocations.length * 4 + 16;
	if (Array.isArray(value.nodes) && !nodePopulationBudget(value.nodes, maximums, issues))
		return false;
	if (Array.isArray(value.edges) && !edgePopulationBudget(value.edges, maximums, issues))
		return false;
	if (
		Array.isArray(value.layers) &&
		!layerPopulationBudget(value.layers, maximums, layerLimitationMaximum, issues)
	)
		return false;
	return indexPopulationBudget(value, maximums, issues);
}

type ShapeRecord = (value: unknown, path: string, issues: IssueCollector) => boolean;

function shapeRecordArray(
	records: unknown,
	shape: ShapeRecord,
	pathPrefix: string,
	issues: IssueCollector
): boolean {
	if (!Array.isArray(records)) return true;
	let valid = true;
	for (const [index, record] of records.entries()) {
		valid = shape(record, `${pathPrefix}[${index}]`, issues) && valid;
		if (issues.exhausted) break;
	}
	return valid;
}

function shapeLayerRecordArray(
	records: unknown,
	shape: ShapeRecord,
	pathPrefix: string,
	issues: IssueCollector
): boolean {
	if (!Array.isArray(records)) return true;
	let valid = true;
	for (const [index, record] of records.entries())
		valid = shape(record, `${pathPrefix}[${index}]`, issues) && valid;
	return valid;
}

function shapeGraphTopFields(value: JsonRecord, issues: IssueCollector): boolean {
	let valid =
		scalarString(value.canonicalProfile) &&
		scalarString(value.capability) &&
		scalarString(value.capabilityStatus) &&
		scalarString(value.contentDigest) &&
		Array.isArray(value.edges) &&
		Array.isArray(value.entryMechanismCoverage) &&
		shapeEpistemic(value.epistemic, '$.epistemic', issues) &&
		Array.isArray(value.forwardIndex) &&
		scalarString(value.fullJanCsaa007Conformance) &&
		scalarString(value.graphInputDigest) &&
		value.graphKind === 'TYPESCRIPT_CALL' &&
		oneOf(value.health, ['COMPLETE', 'PARTIAL']) &&
		scalarString(value.id) &&
		Array.isArray(value.layers) &&
		Array.isArray(value.limitations) &&
		scalarString(value.method) &&
		Array.isArray(value.nodes) &&
		scalarString(value.operationVersion) &&
		shapeProvider(value.producer, '$.producer', issues) &&
		Array.isArray(value.relationLaneCoverage) &&
		Array.isArray(value.reverseIndex) &&
		scalarString(value.schemaVersion) &&
		scalarString(value.semanticExtractionVersion) &&
		scalarString(value.semanticSchemaVersion) &&
		scalarString(value.semanticSnapshotId) &&
		scalarString(value.subjectId);
	valid = shapeCoverage(value.coverage, '$.coverage', issues) && valid;
	return valid;
}

function shapeGraphRecordArrays(value: JsonRecord, issues: IssueCollector): boolean {
	let valid = true;
	for (const [field, records, shape] of [
		['limitations', value.limitations, shapeLimitation],
		['entryMechanismCoverage', value.entryMechanismCoverage, shapeEntryCoverage],
		['relationLaneCoverage', value.relationLaneCoverage, shapeLaneCoverage],
		['forwardIndex', value.forwardIndex, shapeIndex],
		['reverseIndex', value.reverseIndex, shapeIndex]
	] as const)
		valid = shapeRecordArray(records, shape, `$.${field}`, issues) && valid;
	return valid;
}

function shapeLayerFields(layer: JsonRecord, path: string, issues: IssueCollector): boolean {
	let layerValid =
		layer.capability === CALL_GRAPH_CAPABILITY &&
		layer.capabilityStatus === CALL_GRAPH_CAPABILITY_STATUS &&
		stringArray(layer.edgeIds) &&
		Array.isArray(layer.entryMechanismCoverage) &&
		shapeEpistemic(layer.epistemic, `${path}.epistemic`, issues) &&
		scalarString(layer.graphId) &&
		scalarString(layer.id) &&
		layer.kind === 'TYPESCRIPT_STATIC_CALL' &&
		Array.isArray(layer.limitations) &&
		layer.method === CALL_GRAPH_METHOD &&
		stringArray(layer.nodeIds) &&
		layer.ordinal === 0 &&
		shapeProvider(layer.producer, `${path}.producer`, issues) &&
		stringArray(layer.provenanceIds) &&
		Array.isArray(layer.relationLaneCoverage) &&
		scalarString(layer.semanticSnapshotId) &&
		scalarString(layer.subjectId);
	layerValid = shapeCoverage(layer.coverage, `${path}.coverage`, issues) && layerValid;
	return layerValid;
}

function shapeLayer(layer: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(layer, LAYER_KEYS, path, issues)) return false;
	let layerValid = shapeLayerFields(layer, path, issues);
	for (const [field, records, shape] of [
		['limitations', layer.limitations, shapeLimitation],
		['entryMechanismCoverage', layer.entryMechanismCoverage, shapeEntryCoverage],
		['relationLaneCoverage', layer.relationLaneCoverage, shapeLaneCoverage]
	] as const)
		layerValid = shapeLayerRecordArray(records, shape, `${path}.${field}`, issues) && layerValid;
	if (!layerValid)
		issues.add('INVALID_SHAPE', path, 'Graph-layer fields have invalid primitive values.');
	return layerValid;
}

function shapeGraphLayers(layers: unknown, issues: IssueCollector): boolean {
	if (!Array.isArray(layers)) return true;
	let valid = true;
	for (const [index, layer] of layers.entries())
		valid = shapeLayer(layer, `$.layers[${index}]`, issues) && valid;
	return valid;
}

function shapeGraph(
	value: unknown,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector
): value is CallGraphSnapshot {
	if (!exactKeys(value, TOP_LEVEL_KEYS, '$', issues)) return false;
	if (!populationBudget(value, snapshot, issues)) return false;
	let valid = shapeGraphTopFields(value, issues);
	valid = shapeRecordArray(value.nodes, shapeNode, '$.nodes', issues) && valid;
	valid = shapeRecordArray(value.edges, shapeEdge, '$.edges', issues) && valid;
	valid = shapeGraphRecordArrays(value, issues) && valid;
	valid = shapeGraphLayers(value.layers, issues) && valid;
	if (!valid) issues.add('INVALID_SHAPE', '$', 'Call-graph fields have invalid primitive values.');
	return valid;
}

function sortedUniqueStrings(
	values: readonly string[],
	path: string,
	issues: IssueCollector
): void {
	for (let index = 1; index < values.length; index += 1) {
		const comparison = compareText(values[index - 1]!, values[index]!);
		if (comparison > 0)
			issues.add('NONCANONICAL_ORDER', path, 'String identities must be in canonical order.');
		else if (comparison === 0)
			issues.add('DUPLICATE_ID', path, `Duplicate identity ${values[index]}.`);
		if (issues.exhausted) return;
	}
}

function canonicalObjectArray(
	values: readonly unknown[],
	path: string,
	issues: IssueCollector
): void {
	sortedUniqueStrings(
		values.map((value) => canonicalSemanticJson(value)),
		path,
		issues
	);
}

function validateIdPopulation<T extends { readonly id: string }>(
	values: readonly T[],
	path: string,
	issues: IssueCollector
): Map<string, T> {
	const result = new Map<string, T>();
	for (const [index, value] of values.entries()) {
		if (result.has(value.id)) issues.add('DUPLICATE_ID', `${path}[${index}].id`, value.id);
		else result.set(value.id, value);
		if (index > 0 && compareText(values[index - 1]!.id, value.id) > 0)
			issues.add('NONCANONICAL_ORDER', path, 'Records must be ordered by canonical identity.');
		if (issues.exhausted) break;
	}
	return result;
}

function exactLocation(sourceId: string, start: number, end: number) {
	return [{ end, sourceId, start }];
}

function expectedStructuralEpistemic(snapshot: StaticSemanticSnapshot): CallGraphEpistemicState {
	return {
		capabilityCoverage: 'PARTIAL',
		conflictState: 'NOT_EVALUATED',
		executionHealth: snapshot.health === 'COMPLETE' ? 'SUCCEEDED' : 'PARTIAL',
		freshness: 'SNAPSHOT_BOUND',
		inferenceState: 'NONE',
		supportBasis: 'COMPILER_CONFIRMED'
	};
}

function expectedResolutionEpistemic(
	resolutionClass: CallGraphResolutionClass,
	snapshot: StaticSemanticSnapshot
): CallGraphEpistemicState {
	if (resolutionClass === 'CANDIDATE_SET')
		return {
			capabilityCoverage: 'PARTIAL',
			conflictState: 'NOT_EVALUATED',
			executionHealth: snapshot.health === 'COMPLETE' ? 'SUCCEEDED' : 'PARTIAL',
			freshness: 'SNAPSHOT_BOUND',
			inferenceState: 'CANDIDATE',
			supportBasis: 'COMPILER_BOUND_STATIC_CANDIDATE'
		};
	if (resolutionClass === 'UNSUPPORTED')
		return {
			capabilityCoverage: 'UNSUPPORTED',
			conflictState: 'NOT_EVALUATED',
			executionHealth: 'PARTIAL',
			freshness: 'SNAPSHOT_BOUND',
			inferenceState: 'UNRESOLVED',
			supportBasis: 'UNSUPPORTED'
		};
	return {
		capabilityCoverage: 'PARTIAL',
		conflictState: 'NOT_EVALUATED',
		executionHealth: 'PARTIAL',
		freshness: 'SNAPSHOT_BOUND',
		inferenceState: resolutionClass === 'EXACT' ? 'NONE' : 'UNRESOLVED',
		supportBasis: resolutionClass === 'EXACT' ? 'COMPILER_CONFIRMED' : 'NO_TARGET_EVIDENCE'
	};
}

function callableKindForSyntaxKind(
	kind: number
): Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>['callableKind'] | null {
	switch (kind) {
		case ts.SyntaxKind.FunctionDeclaration:
			return 'FUNCTION_DECLARATION';
		case ts.SyntaxKind.MethodDeclaration:
			return 'METHOD_DECLARATION';
		case ts.SyntaxKind.Constructor:
			return 'CONSTRUCTOR';
		case ts.SyntaxKind.GetAccessor:
			return 'GET_ACCESSOR';
		case ts.SyntaxKind.SetAccessor:
			return 'SET_ACCESSOR';
		case ts.SyntaxKind.FunctionExpression:
			return 'FUNCTION_EXPRESSION';
		case ts.SyntaxKind.ArrowFunction:
			return 'ARROW_FUNCTION';
		case ts.SyntaxKind.ClassExpression:
			return 'CLASS_EXPRESSION';
		case ts.SyntaxKind.ClassDeclaration:
			return 'CLASS_DECLARATION';
		case ts.SyntaxKind.ClassStaticBlockDeclaration:
			return 'CLASS_STATIC_BLOCK';
		default:
			return null;
	}
}

interface ExpectedCallable {
	readonly assignmentInputIdsBySymbol: Map<string, Set<string>>;
	readonly bodyState: Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>['bodyState'];
	readonly callableKind: Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>['callableKind'];
	readonly declarationIds: Set<string>;
	readonly node: StaticSemanticSnapshot['astNodes'][number];
	readonly source: StaticSemanticSnapshot['sources'][number];
	readonly symbolIds: Set<string>;
}

interface ExpectedCallModel {
	readonly callablesByNode: Map<string, ExpectedCallable>;
	readonly childrenByParent: Map<string, StaticSemanticSnapshot['astNodes'][number][]>;
	readonly referencesByNode: Map<string, StaticSemanticSnapshot['references'][number][]>;
	readonly specsBySymbol: Map<string, ExpectedCallable[]>;
}

interface ExpectedCallClassification {
	readonly dispatchClass: Extract<CallGraphNode, { kind: 'CALL_SITE' }>['dispatchClass'];
	readonly invocation: StaticSemanticSnapshot['invocations'][number];
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly reasonCode: Extract<CallGraphNode, { kind: 'CALL_SITE' }>['reasonCode'];
	readonly referenceIds: readonly string[];
	readonly resolutionClass: CallGraphResolutionClass;
	readonly resolvedSymbolIds: readonly string[];
	readonly source: StaticSemanticSnapshot['sources'][number];
	readonly targetCallableNodeIds: readonly string[];
	readonly targetSpecsByNode: ReadonlyMap<string, ExpectedCallable>;
}

function expectedCallableProvenance(
	spec: ExpectedCallable,
	declarationById: ReadonlyMap<string, StaticSemanticSnapshot['declarations'][number]>
): SemanticProvenanceId[] {
	return [
		...new Set([
			spec.source.provenanceId,
			...(spec.source.syntaxProvenanceId === null ? [] : [spec.source.syntaxProvenanceId]),
			...[...spec.declarationIds].flatMap((id) => {
				const declaration = declarationById.get(id);
				return declaration === undefined
					? []
					: [declaration.bindingProvenanceId, declaration.structuralProvenanceId];
			})
		])
	].sort(compareText);
}

function groupChildrenByParent(
	snapshot: StaticSemanticSnapshot
): Map<string, StaticSemanticSnapshot['astNodes'][number][]> {
	const childrenByParent = new Map<string, StaticSemanticSnapshot['astNodes'][number][]>();
	for (const node of snapshot.astNodes) {
		if (node.parentId === null) continue;
		const children = childrenByParent.get(node.parentId) ?? [];
		children.push(node);
		childrenByParent.set(node.parentId, children);
	}
	return childrenByParent;
}

function groupDeclarationsByNode(
	snapshot: StaticSemanticSnapshot
): Map<string, StaticSemanticSnapshot['declarations'][number][]> {
	const declarationsByNode = new Map<string, StaticSemanticSnapshot['declarations'][number][]>();
	for (const declaration of snapshot.declarations) {
		if (declaration.nodeId === null) continue;
		const declarations = declarationsByNode.get(declaration.nodeId) ?? [];
		declarations.push(declaration);
		declarationsByNode.set(declaration.nodeId, declarations);
	}
	return declarationsByNode;
}

function groupReferencesByNode(
	snapshot: StaticSemanticSnapshot
): Map<string, StaticSemanticSnapshot['references'][number][]> {
	const referencesByNode = new Map<string, StaticSemanticSnapshot['references'][number][]>();
	for (const reference of snapshot.references) {
		const references = referencesByNode.get(reference.nodeId) ?? [];
		references.push(reference);
		referencesByNode.set(reference.nodeId, references);
	}
	for (const references of referencesByNode.values())
		references.sort((left, right) => compareText(left.id, right.id));
	return referencesByNode;
}

function expectedBodyState(
	node: StaticSemanticSnapshot['astNodes'][number],
	children: readonly StaticSemanticSnapshot['astNodes'][number][]
): ExpectedCallable['bodyState'] | null {
	if (node.kind === ts.SyntaxKind.ClassStaticBlockDeclaration) return 'STATIC_BLOCK';
	if (node.kind === ts.SyntaxKind.ArrowFunction)
		return children.some((child) => child.kind === ts.SyntaxKind.Block)
			? 'BLOCK_BODY'
			: 'EXPRESSION_BODY';
	if (node.kind === ts.SyntaxKind.ClassDeclaration || node.kind === ts.SyntaxKind.ClassExpression)
		return children.some((child) => child.kind === ts.SyntaxKind.Constructor) ? null : 'IMPLICIT';
	return children.some((child) => child.kind === ts.SyntaxKind.Block) ? 'BLOCK_BODY' : null;
}

function collectExpectedCallables(
	snapshot: StaticSemanticSnapshot,
	childrenByParent: ReadonlyMap<string, StaticSemanticSnapshot['astNodes'][number][]>,
	declarationsByNode: ReadonlyMap<string, StaticSemanticSnapshot['declarations'][number][]>
): Map<string, ExpectedCallable> {
	const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
	const callablesByNode = new Map<string, ExpectedCallable>();
	for (const node of snapshot.astNodes) {
		const source = sourceById.get(node.sourceId);
		if (source?.analysisDisposition !== 'DEEP_INDEXED') continue;
		const callableKind = callableKindForSyntaxKind(node.kind);
		if (callableKind === null) continue;
		const bodyState = expectedBodyState(node, childrenByParent.get(node.id) ?? []);
		if (bodyState === null) continue;
		const declarations = declarationsByNode.get(node.id) ?? [];
		callablesByNode.set(node.id, {
			assignmentInputIdsBySymbol: new Map(),
			bodyState,
			callableKind,
			declarationIds: new Set(declarations.map((declaration) => declaration.id)),
			node,
			source,
			symbolIds: new Set(
				declarations.flatMap((declaration) =>
					declaration.symbolId === null ? [] : [declaration.symbolId]
				)
			)
		});
	}
	return callablesByNode;
}

function mergeClassDeclarationAssociations(
	spec: ExpectedCallable,
	declarations: readonly StaticSemanticSnapshot['declarations'][number][]
): void {
	for (const declaration of declarations) {
		spec.declarationIds.add(declaration.id);
		if (declaration.symbolId !== null) spec.symbolIds.add(declaration.symbolId);
	}
}

function mergeClassCallableAssociations(
	snapshot: StaticSemanticSnapshot,
	childrenByParent: ReadonlyMap<string, StaticSemanticSnapshot['astNodes'][number][]>,
	declarationsByNode: ReadonlyMap<string, StaticSemanticSnapshot['declarations'][number][]>,
	callablesByNode: ReadonlyMap<string, ExpectedCallable>
): void {
	for (const node of snapshot.astNodes) {
		if (node.kind !== ts.SyntaxKind.ClassDeclaration && node.kind !== ts.SyntaxKind.ClassExpression)
			continue;
		const constructor = (childrenByParent.get(node.id) ?? []).find(
			(child) => child.kind === ts.SyntaxKind.Constructor
		);
		const spec = callablesByNode.get(constructor?.id ?? node.id);
		if (spec === undefined) continue;
		mergeClassDeclarationAssociations(spec, declarationsByNode.get(node.id) ?? []);
	}
}

function applyAssignmentReference(
	spec: ExpectedCallable,
	assignment: StaticSemanticSnapshot['assignments'][number],
	valueNodeId: NonNullable<StaticSemanticSnapshot['assignments'][number]['valueNodeId']>,
	reference: StaticSemanticSnapshot['references'][number],
	symbolById: ReadonlyMap<string, StaticSemanticSnapshot['symbols'][number]>
): void {
	if (reference.resolvedSymbolId === null) return;
	const symbolId = reference.resolvedSymbolId;
	spec.symbolIds.add(symbolId);
	const associationInputs = spec.assignmentInputIdsBySymbol.get(symbolId) ?? new Set<string>();
	associationInputs.add(assignment.nodeId);
	associationInputs.add(assignment.targetNodeId);
	associationInputs.add(valueNodeId);
	spec.assignmentInputIdsBySymbol.set(symbolId, associationInputs);
	const symbol = symbolById.get(symbolId);
	if (symbol !== undefined)
		for (const declarationId of symbol.declarationIds) spec.declarationIds.add(declarationId);
}

function applyAssignmentAssociations(
	snapshot: StaticSemanticSnapshot,
	referencesByNode: ReadonlyMap<string, StaticSemanticSnapshot['references'][number][]>,
	callablesByNode: ReadonlyMap<string, ExpectedCallable>
): void {
	const symbolById = new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol]));
	for (const assignment of snapshot.assignments) {
		if (assignment.valueNodeId === null) continue;
		const spec = callablesByNode.get(assignment.valueNodeId);
		if (spec === undefined) continue;
		for (const reference of referencesByNode.get(assignment.targetNodeId) ?? [])
			applyAssignmentReference(spec, assignment, assignment.valueNodeId, reference, symbolById);
	}
}

function groupSpecsBySymbol(
	callablesByNode: ReadonlyMap<string, ExpectedCallable>
): Map<string, ExpectedCallable[]> {
	const specsBySymbol = new Map<string, ExpectedCallable[]>();
	for (const spec of callablesByNode.values())
		for (const symbolId of spec.symbolIds) {
			const specs = specsBySymbol.get(symbolId) ?? [];
			specs.push(spec);
			specsBySymbol.set(symbolId, specs);
		}
	for (const specs of specsBySymbol.values())
		specs.sort((left, right) => compareText(left.node.id, right.node.id));
	return specsBySymbol;
}

function expectedCallModel(snapshot: StaticSemanticSnapshot): ExpectedCallModel {
	const childrenByParent = groupChildrenByParent(snapshot);
	const declarationsByNode = groupDeclarationsByNode(snapshot);
	const referencesByNode = groupReferencesByNode(snapshot);
	const callablesByNode = collectExpectedCallables(snapshot, childrenByParent, declarationsByNode);
	mergeClassCallableAssociations(snapshot, childrenByParent, declarationsByNode, callablesByNode);
	applyAssignmentAssociations(snapshot, referencesByNode, callablesByNode);
	return {
		callablesByNode,
		childrenByParent,
		referencesByNode,
		specsBySymbol: groupSpecsBySymbol(callablesByNode)
	};
}

function compatibleExpectedCallable(
	invocationKind: StaticSemanticSnapshot['invocations'][number]['invocationKind'],
	spec: ExpectedCallable
): boolean {
	if (invocationKind === 'NEW')
		return (
			spec.callableKind === 'CONSTRUCTOR' ||
			spec.callableKind === 'CLASS_DECLARATION' ||
			spec.callableKind === 'CLASS_EXPRESSION'
		);
	return (
		spec.callableKind === 'FUNCTION_DECLARATION' ||
		spec.callableKind === 'METHOD_DECLARATION' ||
		spec.callableKind === 'FUNCTION_EXPRESSION' ||
		spec.callableKind === 'ARROW_FUNCTION'
	);
}

function expectedDispatchClass(
	callee: StaticSemanticSnapshot['astNodes'][number],
	memberReferenceCount: number,
	inlineCount: number
): ExpectedCallClassification['dispatchClass'] {
	if (inlineCount > 0) return 'INLINE_CALLABLE';
	if (callee.kind === ts.SyntaxKind.Identifier || callee.kind === ts.SyntaxKind.PrivateIdentifier)
		return 'DIRECT_REFERENCE';
	if (callee.kind === ts.SyntaxKind.PropertyAccessExpression) return 'MEMBER_REFERENCE';
	if (callee.kind === ts.SyntaxKind.ElementAccessExpression)
		return memberReferenceCount === 1 ? 'LITERAL_ELEMENT_REFERENCE' : 'DYNAMIC_EXPRESSION';
	if (TRANSPARENT_CALLEE_KINDS.has(callee.kind))
		return memberReferenceCount === 1 ? 'MEMBER_REFERENCE' : 'DIRECT_REFERENCE';
	return 'UNSUPPORTED_EXPRESSION';
}

interface InvocationClassificationState {
	readonly callee: StaticSemanticSnapshot['astNodes'][number];
	dispatchClass: ExpectedCallClassification['dispatchClass'];
	readonly invocation: StaticSemanticSnapshot['invocations'][number];
	readonly source: StaticSemanticSnapshot['sources'][number];
}

interface ClassificationInput {
	readonly includeReferenceProvenance?: boolean;
	readonly reasonCode: ExpectedCallClassification['reasonCode'];
	readonly referenceIds: readonly string[];
	readonly resolutionClass: CallGraphResolutionClass;
	readonly resolvedSymbolIds: readonly string[];
	readonly targetSpecs?: readonly ExpectedCallable[];
}

function createCallClassificationContext(
	snapshot: StaticSemanticSnapshot,
	graphId: CallGraphId,
	model: ExpectedCallModel
) {
	return {
		declarationById: new Map(
			snapshot.declarations.map((declaration) => [declaration.id, declaration])
		),
		graphId,
		invocationNodeIds: new Set(snapshot.invocations.map((invocation) => invocation.nodeId)),
		model,
		nodeById: new Map(snapshot.astNodes.map((node) => [node.id, node])),
		referenceById: new Map<string, StaticSemanticSnapshot['references'][number]>(
			snapshot.references.map((reference) => [reference.id, reference])
		),
		sourceById: new Map(snapshot.sources.map((source) => [source.id, source])),
		symbolById: new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol]))
	};
}

type CallClassificationContext = ReturnType<typeof createCallClassificationContext>;

function calleeSubtreeIds(
	model: ExpectedCallModel,
	root: StaticSemanticSnapshot['astNodes'][number]
): Set<StaticSemanticSnapshot['astNodes'][number]['id']> {
	const result = new Set<StaticSemanticSnapshot['astNodes'][number]['id']>();
	const pending = [root];
	while (pending.length > 0) {
		const current = pending.pop()!;
		if (result.has(current.id)) continue;
		result.add(current.id);
		pending.push(...(model.childrenByParent.get(current.id) ?? []));
	}
	return result;
}

function inlineExpectedSpecs(
	model: ExpectedCallModel,
	root: StaticSemanticSnapshot['astNodes'][number],
	invocationKind: StaticSemanticSnapshot['invocations'][number]['invocationKind']
): ExpectedCallable[] {
	const direct = model.callablesByNode.get(root.id);
	if (direct !== undefined && compatibleExpectedCallable(invocationKind, direct)) return [direct];
	if (root.kind === ts.SyntaxKind.ClassExpression) {
		const constructor = (model.childrenByParent.get(root.id) ?? [])
			.map((child) => model.callablesByNode.get(child.id))
			.find(
				(spec): spec is ExpectedCallable =>
					spec?.callableKind === 'CONSTRUCTOR' && compatibleExpectedCallable(invocationKind, spec)
			);
		return constructor === undefined ? [] : [constructor];
	}
	if (!TRANSPARENT_CALLEE_KINDS.has(root.kind)) return [];
	return (model.childrenByParent.get(root.id) ?? []).flatMap((child) =>
		inlineExpectedSpecs(model, child, invocationKind)
	);
}

function buildExpectedClassification(
	context: CallClassificationContext,
	state: InvocationClassificationState,
	input: ClassificationInput
): ExpectedCallClassification {
	const { graphId, referenceById } = context;
	const { includeReferenceProvenance = true, referenceIds, targetSpecs = [] } = input;
	const sortedSpecs = [...targetSpecs].sort((left, right) =>
		compareText(
			callGraphCallableTargetNodeId(graphId, left.node.id),
			callGraphCallableTargetNodeId(graphId, right.node.id)
		)
	);
	return {
		dispatchClass: state.dispatchClass,
		invocation: state.invocation,
		provenanceIds: [
			...new Set([
				state.source.provenanceId,
				...(state.source.syntaxProvenanceId === null ? [] : [state.source.syntaxProvenanceId]),
				...(state.invocation.resolutionProvenanceId === null
					? []
					: [state.invocation.resolutionProvenanceId]),
				...(includeReferenceProvenance
					? referenceIds.flatMap((id) => {
							const reference = referenceById.get(id);
							return reference === undefined
								? []
								: [reference.resolutionProvenanceId, reference.structuralProvenanceId];
						})
					: [])
			])
		].sort(compareText),
		reasonCode: input.reasonCode,
		referenceIds: [...referenceIds].sort(compareText),
		resolutionClass: input.resolutionClass,
		resolvedSymbolIds: [...new Set(input.resolvedSymbolIds)].sort(compareText),
		source: state.source,
		targetCallableNodeIds: sortedSpecs.map((spec) =>
			callGraphCallableTargetNodeId(graphId, spec.node.id)
		),
		targetSpecsByNode: new Map(sortedSpecs.map((spec) => [spec.node.id, spec]))
	};
}

function classifyDirectCallee(
	context: CallClassificationContext,
	state: InvocationClassificationState,
	inline: readonly ExpectedCallable[]
): ExpectedCallClassification | null {
	const { callee } = state;
	if (
		callee.kind === ts.SyntaxKind.ImportKeyword ||
		(callee.kind === ts.SyntaxKind.Identifier && callee.syntacticIdentifierText === 'eval')
	)
		return buildExpectedClassification(context, state, {
			reasonCode:
				callee.kind === ts.SyntaxKind.ImportKeyword
					? 'DYNAMIC_IMPORT_CALL'
					: 'DYNAMIC_CALLEE_EXPRESSION',
			referenceIds: [],
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: []
		});
	if (inline.length === 1) {
		const target = inline[0]!;
		const exact =
			state.invocation.targetState === 'IMPLEMENTATION_IDENTIFIED' &&
			state.invocation.resolvedSignatureId !== null &&
			state.invocation.resolutionProvenanceId !== null &&
			state.invocation.implementationNodeId === target.node.id;
		return buildExpectedClassification(context, state, {
			reasonCode: exact
				? 'INLINE_CALLABLE_EXACT_SYNTAX_TARGET'
				: 'INLINE_CALLABLE_WITHOUT_RESOLVED_SIGNATURE',
			referenceIds: [],
			resolutionClass: exact ? 'EXACT' : 'CANDIDATE_SET',
			resolvedSymbolIds: [...target.symbolIds],
			targetSpecs: inline
		});
	}
	if (inline.length > 1)
		return buildExpectedClassification(context, state, {
			reasonCode: 'MULTIPLE_CALLEE_REFERENCE_CANDIDATES',
			referenceIds: [],
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: []
		});
	return null;
}

function classifyMemberDispatch(
	context: CallClassificationContext,
	state: InvocationClassificationState,
	subtreeReferences: readonly StaticSemanticSnapshot['references'][number][],
	memberReferences: readonly StaticSemanticSnapshot['references'][number][]
): ExpectedCallClassification | null {
	const { callee } = state;
	if (callee.kind === ts.SyntaxKind.ThisKeyword || callee.kind === ts.SyntaxKind.SuperKeyword)
		return buildExpectedClassification(context, state, {
			reasonCode: 'THIS_OR_SUPER_DISPATCH',
			referenceIds: [],
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: []
		});
	if (callee.kind === ts.SyntaxKind.ElementAccessExpression && memberReferences.length === 0)
		return buildExpectedClassification(context, state, {
			includeReferenceProvenance: false,
			reasonCode: 'COMPUTED_ELEMENT_DISPATCH',
			referenceIds: subtreeReferences.map((reference) => reference.id),
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: [],
			targetSpecs: []
		});
	return null;
}

function selectedCalleeReferences(
	model: ExpectedCallModel,
	callee: StaticSemanticSnapshot['astNodes'][number],
	subtreeReferences: readonly StaticSemanticSnapshot['references'][number][],
	memberReferences: readonly StaticSemanticSnapshot['references'][number][]
): readonly StaticSemanticSnapshot['references'][number][] {
	if (
		callee.kind === ts.SyntaxKind.PropertyAccessExpression ||
		callee.kind === ts.SyntaxKind.ElementAccessExpression ||
		memberReferences.length > 0
	)
		return memberReferences;
	if (callee.kind === ts.SyntaxKind.Identifier || callee.kind === ts.SyntaxKind.PrivateIdentifier)
		return model.referencesByNode.get(callee.id) ?? [];
	if (TRANSPARENT_CALLEE_KINDS.has(callee.kind))
		return subtreeReferences.filter(
			(reference) => reference.role === 'SYMBOL_USE' || reference.role === 'MEMBER_NAME'
		);
	return [];
}

function classifyAmbiguousReferences(
	context: CallClassificationContext,
	state: InvocationClassificationState,
	selectedReferences: readonly StaticSemanticSnapshot['references'][number][]
): ExpectedCallClassification | null {
	if (selectedReferences.length === 0)
		return buildExpectedClassification(context, state, {
			reasonCode:
				state.dispatchClass === 'UNSUPPORTED_EXPRESSION'
					? 'DYNAMIC_CALLEE_EXPRESSION'
					: 'CALLEE_REFERENCE_NOT_RECONCILED',
			referenceIds: [],
			resolutionClass:
				state.dispatchClass === 'UNSUPPORTED_EXPRESSION' ? 'UNSUPPORTED' : 'UNRESOLVED',
			resolvedSymbolIds: []
		});
	if (selectedReferences.length > 1)
		return buildExpectedClassification(context, state, {
			reasonCode: 'MULTIPLE_CALLEE_REFERENCE_CANDIDATES',
			referenceIds: selectedReferences.map((reference) => reference.id),
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: selectedReferences.flatMap((reference) =>
				reference.resolvedSymbolId === null ? [] : [reference.resolvedSymbolId]
			)
		});
	return null;
}

function resolvedSymbolReasonCode(
	context: CallClassificationContext,
	// Branded, not `string`: `symbolById` is keyed by SemanticSymbolId, and widening the parameter
	// drops the brand at the call site. Third time this campaign has widened a branded id in an
	// extracted helper signature.
	symbolId: SemanticSymbolId
): ExpectedCallClassification['reasonCode'] {
	const { declarationById, sourceById, symbolById } = context;
	const symbol = symbolById.get(symbolId);
	const declarations =
		symbol?.declarationIds
			.map((id) => declarationById.get(id))
			.filter(
				(declaration): declaration is NonNullable<typeof declaration> => declaration !== undefined
			) ?? [];
	const externalOnly =
		declarations.length > 0 &&
		declarations.every((declaration) => {
			const declarationSource = sourceById.get(declaration.sourceId);
			return (
				declaration.ambient ||
				declarationSource?.analysisDisposition === 'CONTEXT_ONLY' ||
				declarationSource?.origin === 'EXTERNAL_DECLARATION' ||
				declarationSource?.origin === 'TOOLCHAIN_LIBRARY' ||
				declarationSource?.artifactClass === 'EXTERNAL_DEPENDENCY' ||
				declarationSource?.artifactClass === 'VENDOR'
			);
		});
	return externalOnly
		? 'RESOLVED_EXTERNAL_OR_CONTEXT_ONLY_SYMBOL'
		: 'CALLABLE_VALUE_FLOW_NOT_MODELED';
}

function classifySelectedReferences(
	context: CallClassificationContext,
	state: InvocationClassificationState,
	selectedReferences: readonly StaticSemanticSnapshot['references'][number][]
): ExpectedCallClassification {
	const ambiguous = classifyAmbiguousReferences(context, state, selectedReferences);
	if (ambiguous !== null) return ambiguous;
	const reference = selectedReferences[0]!;
	if (reference.resolutionState === 'UNSUPPORTED')
		return buildExpectedClassification(context, state, {
			reasonCode: 'REFERENCE_UNSUPPORTED',
			referenceIds: [reference.id],
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: []
		});
	if (reference.resolutionState === 'UNRESOLVED' || reference.resolvedSymbolId === null)
		return buildExpectedClassification(context, state, {
			reasonCode: 'REFERENCE_UNRESOLVED',
			referenceIds: [reference.id],
			resolutionClass: 'UNRESOLVED',
			resolvedSymbolIds: []
		});
	const symbolId = reference.resolvedSymbolId;
	const candidates = (context.model.specsBySymbol.get(symbolId) ?? []).filter((spec) =>
		compatibleExpectedCallable(state.invocation.invocationKind, spec)
	);
	if (candidates.length > 0)
		return buildExpectedClassification(context, state, {
			reasonCode: 'RESOLVED_LOCAL_CALLABLE_CANDIDATES',
			referenceIds: [reference.id],
			resolutionClass: 'CANDIDATE_SET',
			resolvedSymbolIds: [symbolId],
			targetSpecs: candidates
		});
	return buildExpectedClassification(context, state, {
		reasonCode: resolvedSymbolReasonCode(context, symbolId),
		referenceIds: [reference.id],
		resolutionClass: 'EXTERNAL_DISPATCH',
		resolvedSymbolIds: [symbolId]
	});
}

function classifyInvocation(
	context: CallClassificationContext,
	invocation: StaticSemanticSnapshot['invocations'][number]
): ExpectedCallClassification | null {
	const { invocationNodeIds, model, nodeById, sourceById } = context;
	const callee = nodeById.get(invocation.calleeNodeId);
	const source = sourceById.get(invocation.sourceId);
	if (callee === undefined || source === undefined) return null;
	const inline = inlineExpectedSpecs(model, callee, invocation.invocationKind).sort((left, right) =>
		compareText(left.node.id, right.node.id)
	);
	const state: InvocationClassificationState = {
		callee,
		dispatchClass: expectedDispatchClass(callee, 0, inline.length),
		invocation,
		source
	};
	const direct = classifyDirectCallee(context, state, inline);
	if (direct !== null) return direct;

	const calleeSubtree = calleeSubtreeIds(model, callee);
	if ([...calleeSubtree].some((nodeId) => invocationNodeIds.has(nodeId))) {
		state.dispatchClass = 'UNSUPPORTED_EXPRESSION';
		return buildExpectedClassification(context, state, {
			reasonCode: 'DYNAMIC_CALLEE_EXPRESSION',
			referenceIds: [],
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: []
		});
	}
	const subtreeReferences = [...calleeSubtree]
		.flatMap((nodeId) => model.referencesByNode.get(nodeId) ?? [])
		.sort((left, right) => compareText(left.id, right.id));
	const memberReferences = subtreeReferences.filter(
		(reference) => reference.role === 'MEMBER_NAME'
	);
	state.dispatchClass = expectedDispatchClass(callee, memberReferences.length, inline.length);
	const member = classifyMemberDispatch(context, state, subtreeReferences, memberReferences);
	if (member !== null) return member;
	return classifySelectedReferences(
		context,
		state,
		selectedCalleeReferences(model, callee, subtreeReferences, memberReferences)
	);
}

function expectedCallClassifications(
	snapshot: StaticSemanticSnapshot,
	graphId: CallGraphId,
	model: ExpectedCallModel
): Map<string, ExpectedCallClassification> {
	const context = createCallClassificationContext(snapshot, graphId, model);
	const result = new Map<string, ExpectedCallClassification>();
	for (const invocation of snapshot.invocations) {
		const classification = classifyInvocation(context, invocation);
		if (classification !== null) result.set(invocation.id, classification);
	}
	return result;
}

function expectedInferenceState(
	candidateCount: number,
	exactCount: number,
	orderedCount: number
): CallGraphEpistemicState['inferenceState'] {
	if (exactCount === orderedCount) return 'NONE';
	if (candidateCount === 0 && exactCount === 0) return 'UNRESOLVED';
	if (candidateCount === orderedCount) return 'CANDIDATE';
	return 'MIXED';
}

function expectedSupportBasis(
	candidateCount: number,
	exactCount: number,
	allUnsupported: boolean
): CallGraphEpistemicState['supportBasis'] {
	if (candidateCount > 0) return 'COMPILER_BOUND_STATIC_CANDIDATE';
	if (exactCount > 0) return 'COMPILER_CONFIRMED';
	if (allUnsupported) return 'UNSUPPORTED';
	return 'NO_TARGET_EVIDENCE';
}

function expectedGlobalEpistemic(
	snapshot: StaticSemanticSnapshot,
	classifications: ReadonlyMap<string, ExpectedCallClassification>
): CallGraphEpistemicState {
	if (snapshot.invocations.length === 0) return expectedStructuralEpistemic(snapshot);
	const ordered = snapshot.invocations
		.map((invocation) => classifications.get(invocation.id))
		.filter((value): value is ExpectedCallClassification => value !== undefined);
	if (ordered.length !== snapshot.invocations.length) return expectedStructuralEpistemic(snapshot);
	const candidateCount = ordered.filter(
		(classification) => classification.resolutionClass === 'CANDIDATE_SET'
	).length;
	const exactCount = ordered.filter(
		(classification) => classification.resolutionClass === 'EXACT'
	).length;
	const allUnsupported = ordered.every(
		(classification) => classification.resolutionClass === 'UNSUPPORTED'
	);
	return {
		capabilityCoverage: 'PARTIAL',
		conflictState: 'NOT_EVALUATED',
		executionHealth: 'PARTIAL',
		freshness: 'SNAPSHOT_BOUND',
		inferenceState: expectedInferenceState(candidateCount, exactCount, ordered.length),
		supportBasis: expectedSupportBasis(candidateCount, exactCount, allUnsupported)
	};
}

function validateProvenanceIds(
	ids: readonly SemanticProvenanceId[],
	provenanceById: ReadonlyMap<string, StaticSemanticSnapshot['provenances'][number]>,
	snapshotId: string,
	subjectId: string,
	path: string,
	issues: IssueCollector
): void {
	sortedUniqueStrings(ids, path, issues);
	for (const [index, id] of ids.entries()) {
		const record = provenanceById.get(id);
		if (record === undefined)
			issues.add('DANGLING_REFERENCE', `${path}[${index}]`, 'Absent semantic provenance.');
		else if (record.snapshotId !== snapshotId || record.subjectId !== subjectId)
			issues.add(
				'DANGLING_REFERENCE',
				`${path}[${index}]`,
				'Provenance does not belong to the bound semantic snapshot and subject.'
			);
		if (issues.exhausted) return;
	}
}

function graphWideReference(
	record: {
		readonly graphId: string;
		readonly layerId?: string;
		readonly semanticSnapshotId: string;
		readonly subjectId: string;
	},
	graph: CallGraphSnapshot,
	layerId: string,
	path: string,
	issues: IssueCollector
): void {
	if (record.graphId !== graph.id)
		issues.add('DANGLING_REFERENCE', `${path}.graphId`, 'Record references another graph.');
	if (record.layerId !== undefined && record.layerId !== layerId)
		issues.add('DANGLING_REFERENCE', `${path}.layerId`, 'Record references another graph layer.');
	if (record.semanticSnapshotId !== graph.semanticSnapshotId)
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.semanticSnapshotId`,
			'Record references another semantic snapshot.'
		);
	if (record.subjectId !== graph.subjectId)
		issues.add('DANGLING_REFERENCE', `${path}.subjectId`, 'Record references another subject.');
}

function expectedIndexes(
	nodes: readonly CallGraphNode[],
	edges: readonly CallGraphEdge[]
): { readonly forward: CallGraphIndexEntry[]; readonly reverse: CallGraphIndexEntry[] } {
	const forwardByNode = new Map<CallGraphNode['id'], CallGraphEdge['id'][]>();
	const reverseByNode = new Map<CallGraphNode['id'], CallGraphEdge['id'][]>();
	for (const node of nodes) {
		forwardByNode.set(node.id, []);
		reverseByNode.set(node.id, []);
	}
	for (const edge of edges) {
		forwardByNode.get(edge.source.nodeId)?.push(edge.id);
		reverseByNode.get(edge.target.nodeId)?.push(edge.id);
	}
	const entries = (
		byNode: ReadonlyMap<CallGraphNode['id'], CallGraphEdge['id'][]>
	): CallGraphIndexEntry[] =>
		[...byNode.entries()]
			.map(([nodeId, edgeIds]) => {
				edgeIds.sort(compareText);
				return { edgeIds, nodeId };
			})
			.sort((left, right) => compareText(left.nodeId, right.nodeId));
	return { forward: entries(forwardByNode), reverse: entries(reverseByNode) };
}

function expectedCoverage(
	snapshot: StaticSemanticSnapshot,
	classifications: ReadonlyMap<string, ExpectedCallClassification>
): CallGraphCoverage {
	const ordered = snapshot.invocations
		.map((invocation) => classifications.get(invocation.id))
		.filter((value): value is ExpectedCallClassification => value !== undefined);
	const count = (resolutionClass: CallGraphResolutionClass): number =>
		ordered.filter((classification) => classification.resolutionClass === resolutionClass).length;
	const candidateTargetEdges = ordered
		.filter((classification) => classification.resolutionClass === 'CANDIDATE_SET')
		.reduce((total, classification) => total + classification.targetCallableNodeIds.length, 0);
	const exactTargetEdges = count('EXACT');
	const frontierCount = ordered.filter(
		(classification) =>
			classification.resolutionClass !== 'CANDIDATE_SET' &&
			classification.resolutionClass !== 'EXACT'
	).length;
	return {
		candidateSetCallSites: count('CANDIDATE_SET'),
		candidateTargetEdges,
		closure: 'OPEN',
		exactCallSites: count('EXACT'),
		expectedCallSites: snapshot.invocations.length,
		externalDispatchCallSites: count('EXTERNAL_DISPATCH'),
		frontierNodes: frontierCount,
		ownershipEdges: snapshot.invocations.length,
		reconciles: ordered.length === snapshot.invocations.length,
		representedCallSites: snapshot.invocations.length,
		targetEdges: candidateTargetEdges + exactTargetEdges + frontierCount,
		unresolvedCallSites: count('UNRESOLVED'),
		unsupportedCallSites: count('UNSUPPORTED'),
		wholeProgramReachability: 'NOT_CLAIMED'
	};
}

function limitationOrderKey(value: CallGraphSnapshot['limitations'][number]): string {
	return `${value.kind}\0${value.invocationId ?? ''}\0${value.sourceId ?? ''}`;
}

function validateCoverageArrays(
	graph: CallGraphSnapshot,
	pathPrefix: '$' | '$.layers[0]',
	issues: IssueCollector
): void {
	const entries =
		pathPrefix === '$' ? graph.entryMechanismCoverage : graph.layers[0]!.entryMechanismCoverage;
	const lanes =
		pathPrefix === '$' ? graph.relationLaneCoverage : graph.layers[0]!.relationLaneCoverage;
	sortedUniqueStrings(
		entries.map((record) => record.mechanism),
		`${pathPrefix}.entryMechanismCoverage`,
		issues
	);
	sortedUniqueStrings(
		lanes.map((record) => record.lane),
		`${pathPrefix}.relationLaneCoverage`,
		issues
	);
	if (
		!same(
			entries.map((record) => record.mechanism),
			ENTRY_MECHANISMS
		)
	)
		issues.add(
			'POPULATION_MISMATCH',
			`${pathPrefix}.entryMechanismCoverage`,
			'Entry-mechanism coverage must contain every declared mechanism exactly once.'
		);
	if (
		!same(
			lanes.map((record) => record.lane),
			RELATION_LANES
		)
	)
		issues.add(
			'POPULATION_MISMATCH',
			`${pathPrefix}.relationLaneCoverage`,
			'Relation-lane coverage must contain every declared lane exactly once.'
		);
	if (!same(entries, EXPECTED_ENTRY_MECHANISM_COVERAGE))
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			`${pathPrefix}.entryMechanismCoverage`,
			'This producer must retain the exact NOT_ANALYZED entry-mechanism states and reasons.'
		);
	if (!same(lanes, EXPECTED_RELATION_LANE_COVERAGE))
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			`${pathPrefix}.relationLaneCoverage`,
			'This producer must retain the exact bounded relation-lane states and reasons.'
		);
}

type SemanticValidationContext = ReturnType<typeof createSemanticValidationContext>;

function validateGraphVersionValues(graph: CallGraphSnapshot, issues: IssueCollector): void {
	if (graph.schemaVersion !== CALL_GRAPH_SCHEMA_VERSION)
		issues.add('UNSUPPORTED_SCHEMA_VERSION', '$.schemaVersion', graph.schemaVersion);
	if (graph.operationVersion !== CALL_GRAPH_OPERATION_VERSION)
		issues.add('INVALID_VALUE', '$.operationVersion', 'Unsupported call-graph operation version.');
	if (graph.canonicalProfile !== CALL_GRAPH_CANONICAL_PROFILE)
		issues.add('INVALID_VALUE', '$.canonicalProfile', 'Unsupported call-graph canonical profile.');
	if (graph.method !== CALL_GRAPH_METHOD)
		issues.add('INVALID_VALUE', '$.method', 'Unsupported call-graph construction method.');
}

function validateGraphConformanceClaims(graph: CallGraphSnapshot, issues: IssueCollector): void {
	if (
		graph.capability !== CALL_GRAPH_CAPABILITY ||
		graph.capabilityStatus !== CALL_GRAPH_CAPABILITY_STATUS
	)
		issues.add(
			'INVALID_VALUE',
			'$.capability',
			'Call-graph capability identity or status mismatch.'
		);
	if (graph.fullJanCsaa007Conformance !== FULL_JAN_CSAA_007_CONFORMANCE)
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			'$.fullJanCsaa007Conformance',
			'This bounded call projection must retain the explicit NOT_CLAIMED conformance state.'
		);
	if (graph.health !== 'PARTIAL')
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			'$.health',
			'The 0.1.0 producer must remain PARTIAL while entry mechanisms and resolved signatures are open.'
		);
	if (
		graph.coverage.closure !== 'OPEN' ||
		graph.coverage.wholeProgramReachability !== 'NOT_CLAIMED'
	)
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			'$.coverage',
			'This producer cannot claim call-graph closure or whole-program reachability.'
		);
}

function validateGraphSemanticBinding(
	graph: CallGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector
): void {
	if (graph.semanticSnapshotId !== snapshot.id)
		issues.add(
			'DANGLING_REFERENCE',
			'$.semanticSnapshotId',
			'Graph does not bind the supplied semantic snapshot.'
		);
	if (graph.subjectId !== snapshot.subjectId)
		issues.add('DANGLING_REFERENCE', '$.subjectId', 'Graph does not bind the supplied subject.');
	if (graph.semanticExtractionVersion !== snapshot.extractionVersion)
		issues.add(
			'INVALID_VALUE',
			'$.semanticExtractionVersion',
			'Semantic extraction version mismatch.'
		);
	if (graph.semanticSchemaVersion !== snapshot.schemaVersion)
		issues.add('INVALID_VALUE', '$.semanticSchemaVersion', 'Semantic schema version mismatch.');
	if (!same(graph.producer, snapshot.provider))
		issues.add(
			'INVALID_VALUE',
			'$.producer',
			'Graph producer does not match the semantic provider.'
		);
}

function validateGraphDigests(
	graph: CallGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector,
	knownGraphInputDigest?: string
): void {
	if (!SHA256.test(graph.graphInputDigest))
		issues.add(
			'INVALID_VALUE',
			'$.graphInputDigest',
			'Graph input digest must be lowercase SHA-256.'
		);
	if (!SHA256.test(graph.contentDigest))
		issues.add('INVALID_VALUE', '$.contentDigest', 'Content digest must be lowercase SHA-256.');
	try {
		if (graph.graphInputDigest !== (knownGraphInputDigest ?? callGraphInputDigest(snapshot)))
			issues.add(
				'GRAPH_INPUT_MISMATCH',
				'$.graphInputDigest',
				'Graph input digest does not reproduce the exact consumed semantic projection.'
			);
	} catch (error) {
		issues.add(
			'GRAPH_INPUT_MISMATCH',
			'$.graphInputDigest',
			error instanceof Error ? error.message : 'Call-graph input projection failed closed.'
		);
	}
}

function validateGraphIdentityPreimage(graph: CallGraphSnapshot, issues: IssueCollector): void {
	const expectedGraphId = callGraphId({
		canonicalProfile: graph.canonicalProfile,
		graphInputDigest: graph.graphInputDigest,
		graphKind: graph.graphKind,
		method: graph.method,
		operationVersion: graph.operationVersion,
		schemaVersion: graph.schemaVersion,
		semanticSnapshotId: graph.semanticSnapshotId,
		subjectId: graph.subjectId
	});
	if (graph.id !== expectedGraphId)
		issues.add('IDENTITY_MISMATCH', '$.id', 'Call-graph identity preimage mismatch.');
}

function validateLayerIdentity(
	graph: CallGraphSnapshot,
	layer: CallGraphSnapshot['layers'][number],
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector
): void {
	if (layer.id !== callGraphLayerId(graph.id, layer.kind, layer.ordinal))
		issues.add('IDENTITY_MISMATCH', '$.layers[0].id', 'Call-graph layer identity mismatch.');
	graphWideReference(layer, graph, layer.id, '$.layers[0]', issues);
	if (!same(layer.producer, snapshot.provider))
		issues.add('INVALID_VALUE', '$.layers[0].producer', 'Layer producer mismatch.');
}

function buildExpectedNodeProvenance(
	graph: CallGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	expectedCallables: ReadonlyMap<string, ExpectedCallable>,
	expectedClassifications: ReadonlyMap<string, ExpectedCallClassification>,
	declarationById: ReadonlyMap<string, StaticSemanticSnapshot['declarations'][number]>
): Map<string, readonly SemanticProvenanceId[]> {
	const expectedNodeProvenance = new Map<string, readonly SemanticProvenanceId[]>();
	for (const source of snapshot.sources)
		expectedNodeProvenance.set(callGraphSourceRegionNodeId(graph.id, source.id), [
			source.provenanceId
		]);
	for (const spec of expectedCallables.values())
		expectedNodeProvenance.set(
			callGraphCallableTargetNodeId(graph.id, spec.node.id),
			expectedCallableProvenance(spec, declarationById)
		);
	for (const classification of expectedClassifications.values()) {
		expectedNodeProvenance.set(
			callGraphCallSiteNodeId(graph.id, classification.invocation.id),
			classification.provenanceIds
		);
		if (
			classification.resolutionClass !== 'CANDIDATE_SET' &&
			classification.resolutionClass !== 'EXACT'
		)
			expectedNodeProvenance.set(
				callGraphFrontierNodeId(
					graph.id,
					classification.invocation.id,
					classification.resolutionClass
				),
				classification.provenanceIds
			);
	}
	return expectedNodeProvenance;
}

function collectSemanticIds(snapshot: StaticSemanticSnapshot): Set<string> {
	const allSemanticIds = new Set<string>();
	for (const population of [
		snapshot.astNodes,
		snapshot.declarations,
		snapshot.invocations,
		snapshot.overloadSets,
		snapshot.references,
		snapshot.signatures,
		snapshot.symbols,
		snapshot.typeRelations,
		snapshot.provenances,
		snapshot.sources
	])
		for (const record of population) allSemanticIds.add(record.id);
	return allSemanticIds;
}

function createSemanticValidationContext(
	graph: CallGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	layer: CallGraphSnapshot['layers'][number],
	issues: IssueCollector
) {
	const nodeById = validateIdPopulation(graph.nodes, '$.nodes', issues);
	const edgeById = validateIdPopulation(graph.edges, '$.edges', issues);
	const declarationById = new Map(snapshot.declarations.map((record) => [record.id, record]));
	const allSemanticIds = collectSemanticIds(snapshot);
	const callModel = expectedCallModel(snapshot);
	const expectedCallables = callModel.callablesByNode;
	const expectedClassifications = expectedCallClassifications(snapshot, graph.id, callModel);
	return {
		allSemanticIds,
		callSitesByInvocation: new Map<string, Extract<CallGraphNode, { kind: 'CALL_SITE' }>[]>(),
		callableBySemanticNode: new Map<string, Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>>(),
		declarationById,
		edgeById,
		expectedCallables,
		expectedClassifications,
		expectedNodeProvenance: buildExpectedNodeProvenance(
			graph,
			snapshot,
			expectedCallables,
			expectedClassifications,
			declarationById
		),
		frontiersByInvocation: new Map<string, Extract<CallGraphNode, { kind: 'FRONTIER' }>[]>(),
		graph,
		invocationById: new Map<string, (typeof snapshot.invocations)[number]>(
			snapshot.invocations.map((record) => [record.id, record])
		),
		issues,
		layer,
		nodeById,
		nodeBySemanticId: new Map(snapshot.astNodes.map((record) => [record.id, record])),
		ownershipByInvocation: new Map<string, CallGraphEdge[]>(),
		programById: new Map(snapshot.programs.map((record) => [record.id, record])),
		projectById: new Map(snapshot.projects.map((record) => [record.id, record])),
		provenanceById: new Map(snapshot.provenances.map((record) => [record.id, record])),
		referenceById: new Map(snapshot.references.map((record) => [record.id, record])),
		snapshot,
		sourceById: new Map(snapshot.sources.map((record) => [record.id, record])),
		sourceRegionBySource: new Map<string, Extract<CallGraphNode, { kind: 'SOURCE_REGION' }>>(),
		symbolById: new Map(snapshot.symbols.map((record) => [record.id, record])),
		targetsByInvocation: new Map<string, CallGraphEdge[]>()
	};
}

function validateSemanticProvenanceRecords(context: SemanticValidationContext): boolean {
	const { issues, projectById, snapshot, sourceById } = context;
	for (const [index, provenance] of snapshot.provenances.entries()) {
		const path = `$semanticSnapshot.provenances[${index}]`;
		if (!projectById.has(provenance.projectId))
			issues.add('DANGLING_REFERENCE', `${path}.projectId`, 'Provenance project is absent.');
		if (provenance.sourceId !== null) {
			const source = sourceById.get(provenance.sourceId);
			if (source === undefined)
				issues.add('DANGLING_REFERENCE', `${path}.sourceId`, 'Provenance source is absent.');
			else if (source.projectId !== provenance.projectId)
				issues.add(
					'DANGLING_REFERENCE',
					path,
					'Provenance source and project identities are inconsistent.'
				);
		}
		if (issues.exhausted) return false;
	}
	return true;
}

function expectedOwnerNodeId(
	context: SemanticValidationContext,
	invocationNode: StaticSemanticSnapshot['astNodes'][number]
): string | null {
	const { expectedCallables, graph, nodeBySemanticId } = context;
	let parentId = invocationNode.parentId;
	const visited = new Set<string>();
	while (parentId !== null) {
		if (visited.has(parentId)) return null;
		visited.add(parentId);
		if (expectedCallables.has(parentId)) return callGraphCallableTargetNodeId(graph.id, parentId);
		const parent = nodeBySemanticId.get(parentId);
		// S6582 REFUSED: the right operand is a PROPERTY READ, not a literal, so `undefined !==
		// undefined` is false and the guard stops refusing exactly when both are missing. Safe only
		// against a literal or enum — this comparand is neither.
		if (parent === undefined || parent.sourceId !== invocationNode.sourceId) return null;
		parentId = parent.parentId;
	}
	return callGraphSourceRegionNodeId(graph.id, invocationNode.sourceId);
}

function validateCallGraphSemantics(
	graph: CallGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector,
	knownGraphInputDigest?: string
): void {
	validateGraphVersionValues(graph, issues);
	validateGraphConformanceClaims(graph, issues);
	validateGraphSemanticBinding(graph, snapshot, issues);
	validateGraphDigests(graph, snapshot, issues, knownGraphInputDigest);
	validateGraphIdentityPreimage(graph, issues);
	if (graph.layers.length !== 1) {
		issues.add('POPULATION_MISMATCH', '$.layers', 'Exactly one static-call layer is required.');
		return;
	}
	const layer = graph.layers[0];
	validateLayerIdentity(graph, layer, snapshot, issues);
	const context = createSemanticValidationContext(graph, snapshot, layer, issues);
	if (!validateSemanticProvenanceRecords(context)) return;
	if (!validateGraphNodes(context)) return;
	validateNodePopulations(context);
	if (!validateGraphEdges(context)) return;
	if (!validateInvocationReconciliation(context)) return;
	validateCallSiteInvocationKeys(context);
	validateLayerManifests(context);
	validateGraphIndexes(context);
	validateCoverageTotals(context);
	validateLimitations(context);
	validateLayerParity(context);
	validateLayerProvenance(context);
	validateContentDigest(context);
	validateDuplicateIdentities(context);
}

function validateSourceRegionBinding(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'SOURCE_REGION' }>,
	source: StaticSemanticSnapshot['sources'][number],
	path: string
): void {
	const { graph, issues } = context;
	if (
		node.analysisDisposition !== source.analysisDisposition ||
		node.logicalPath !== source.logicalPath ||
		node.programId !== source.programId ||
		node.projectId !== source.projectId
	)
		issues.add('INVALID_VALUE', path, 'Source-region fields differ from the semantic source.');
	if (node.id !== callGraphSourceRegionNodeId(graph.id, source.id))
		issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Source-region identity mismatch.');
	if (!same(node.provenanceIds, [source.provenanceId]))
		issues.add('DANGLING_REFERENCE', `${path}.provenanceIds`, 'Source-region provenance mismatch.');
	if (!same(node.sourceLocations, exactLocation(source.id, 0, source.textLength)))
		issues.add('INVALID_VALUE', `${path}.sourceLocations`, 'Source-region extent mismatch.');
	try {
		assertCanonicalRelativePath(node.logicalPath);
	} catch {
		issues.add(
			'ABSOLUTE_PATH',
			`${path}.logicalPath`,
			'Source-region path is not canonical relative.'
		);
	}
}

function validateSourceRegionNode(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'SOURCE_REGION' }>,
	path: string
): void {
	const { issues, snapshot, sourceById, sourceRegionBySource } = context;
	if (!same(node.epistemic, expectedStructuralEpistemic(snapshot)))
		issues.add(
			'INVALID_VALUE',
			`${path}.epistemic`,
			'Source-region epistemic dimensions do not match structural compiler evidence.'
		);
	if (sourceRegionBySource.has(node.semanticSourceId))
		issues.add('DUPLICATE_ID', `${path}.semanticSourceId`, 'Duplicate source-region projection.');
	else sourceRegionBySource.set(node.semanticSourceId, node);
	const source = sourceById.get(node.semanticSourceId);
	if (source === undefined)
		issues.add('DANGLING_REFERENCE', `${path}.semanticSourceId`, 'Absent semantic source.');
	else validateSourceRegionBinding(context, node, source, path);
}

function validateCallableTargetExpectation(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>,
	path: string
): void {
	const { expectedCallables, issues } = context;
	const expectedCallable = expectedCallables.get(node.semanticNodeId);
	if (expectedCallable === undefined)
		issues.add(
			'POPULATION_MISMATCH',
			`${path}.semanticNodeId`,
			'Callable target is outside the derivable deep-indexed runtime callable population.'
		);
	else if (
		node.bodyState !== expectedCallable.bodyState ||
		node.callableKind !== expectedCallable.callableKind ||
		node.sourceId !== expectedCallable.source.id ||
		node.programId !== expectedCallable.source.programId ||
		node.projectId !== expectedCallable.source.projectId
	)
		issues.add(
			'INVALID_VALUE',
			path,
			'Callable kind, body state, source, program, or project differs from semantic AST topology.'
		);
}

function validateCallableTargetSemantics(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>,
	path: string
): void {
	const { graph, issues, nodeBySemanticId, sourceById } = context;
	const semanticNode = nodeBySemanticId.get(node.semanticNodeId);
	const source = sourceById.get(node.sourceId);
	if (semanticNode === undefined)
		issues.add('DANGLING_REFERENCE', `${path}.semanticNodeId`, 'Absent callable AST node.');
	if (source === undefined)
		issues.add('DANGLING_REFERENCE', `${path}.sourceId`, 'Absent callable source.');
	else if (node.programId !== source.programId || node.projectId !== source.projectId)
		issues.add('DANGLING_REFERENCE', path, 'Callable source/program/project binding mismatch.');
	if (semanticNode !== undefined) {
		if (semanticNode.sourceId !== node.sourceId)
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.sourceId`,
				'Callable AST node belongs to another source.'
			);
		if (
			!same(
				node.sourceLocations,
				exactLocation(node.sourceId, semanticNode.start, semanticNode.end)
			)
		)
			issues.add('INVALID_VALUE', `${path}.sourceLocations`, 'Callable location mismatch.');
	}
	if (node.id !== callGraphCallableTargetNodeId(graph.id, node.semanticNodeId))
		issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Callable-target identity mismatch.');
}

function validateCallableTargetAssociations(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>,
	path: string
): void {
	const { declarationById, expectedCallables, issues } = context;
	const expectedCallable = expectedCallables.get(node.semanticNodeId);
	sortedUniqueStrings(node.declarationIds, `${path}.declarationIds`, issues);
	sortedUniqueStrings(node.symbolIds, `${path}.symbolIds`, issues);
	if (
		expectedCallable !== undefined &&
		(!same(node.declarationIds, [...expectedCallable.declarationIds].sort(compareText)) ||
			!same(node.symbolIds, [...expectedCallable.symbolIds].sort(compareText)) ||
			!same(node.provenanceIds, expectedCallableProvenance(expectedCallable, declarationById)))
	)
		issues.add(
			'POPULATION_MISMATCH',
			path,
			'Callable declaration, symbol, or provenance associations do not exactly match the semantic snapshot.'
		);
}

function validateCallableTargetMembers(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>,
	path: string
): void {
	const { declarationById, issues, symbolById } = context;
	const nodeSymbolIds = new Set(node.symbolIds);
	for (const [declarationIndex, declarationId] of node.declarationIds.entries()) {
		const declaration = declarationById.get(declarationId);
		if (declaration === undefined)
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.declarationIds[${declarationIndex}]`,
				'Absent declaration.'
			);
		else if (declaration.symbolId !== null && !nodeSymbolIds.has(declaration.symbolId))
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.declarationIds[${declarationIndex}]`,
				'Declaration symbol is absent from this callable target.'
			);
	}
	const nodeDeclarationIds = new Set(node.declarationIds);
	for (const [symbolIndex, symbolId] of node.symbolIds.entries()) {
		const symbol = symbolById.get(symbolId);
		if (symbol === undefined)
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.symbolIds[${symbolIndex}]`,
				'Absent callable symbol.'
			);
		else if (!symbol.declarationIds.some((id) => nodeDeclarationIds.has(id)))
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.symbolIds[${symbolIndex}]`,
				'Symbol has no declaration on this callable node.'
			);
	}
}

function validateCallableTargetNode(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>,
	path: string
): void {
	const { callableBySemanticNode, issues, snapshot } = context;
	if (!same(node.epistemic, expectedStructuralEpistemic(snapshot)))
		issues.add(
			'INVALID_VALUE',
			`${path}.epistemic`,
			'Callable-target epistemic dimensions do not match structural compiler evidence.'
		);
	if (callableBySemanticNode.has(node.semanticNodeId))
		issues.add('DUPLICATE_ID', `${path}.semanticNodeId`, 'Duplicate callable-target projection.');
	else callableBySemanticNode.set(node.semanticNodeId, node);
	validateCallableTargetExpectation(context, node, path);
	validateCallableTargetSemantics(context, node, path);
	validateCallableTargetAssociations(context, node, path);
	validateCallableTargetMembers(context, node, path);
}

function validateCallSiteLocation(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALL_SITE' }>,
	invocationNode: StaticSemanticSnapshot['astNodes'][number],
	path: string
): void {
	const { issues } = context;
	if (
		!same(
			node.sourceLocations,
			exactLocation(node.sourceId, invocationNode.start, invocationNode.end)
		)
	)
		issues.add('INVALID_VALUE', `${path}.sourceLocations`, 'Call-site location mismatch.');
	const expectedOwner = expectedOwnerNodeId(context, invocationNode);
	if (expectedOwner === null || node.ownerNodeId !== expectedOwner)
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.ownerNodeId`,
			'Call-site owner is not its nearest runtime callable or source region.'
		);
}

function validateCallSiteInvocationBinding(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALL_SITE' }>,
	path: string
): void {
	const { graph, invocationById, issues, nodeBySemanticId, sourceById } = context;
	const invocation = invocationById.get(node.invocationId);
	const source = sourceById.get(node.sourceId);
	if (invocation === undefined)
		issues.add('DANGLING_REFERENCE', `${path}.invocationId`, 'Absent semantic invocation.');
	else if (
		node.calleeNodeId !== invocation.calleeNodeId ||
		node.invocationKind !== invocation.invocationKind ||
		node.invocationNodeId !== invocation.nodeId ||
		node.optional !== invocation.optional ||
		node.sourceId !== invocation.sourceId
	)
		issues.add('INVALID_VALUE', path, 'Call-site fields differ from the semantic invocation.');
	if (source === undefined)
		issues.add('DANGLING_REFERENCE', `${path}.sourceId`, 'Absent call-site source.');
	else if (node.programId !== source.programId || node.projectId !== source.projectId)
		issues.add('DANGLING_REFERENCE', path, 'Call-site source/program/project binding mismatch.');
	const invocationNode = nodeBySemanticId.get(node.invocationNodeId);
	if (invocationNode === undefined)
		issues.add('DANGLING_REFERENCE', `${path}.invocationNodeId`, 'Absent invocation AST node.');
	else validateCallSiteLocation(context, node, invocationNode, path);
	if (!nodeBySemanticId.has(node.calleeNodeId))
		issues.add('DANGLING_REFERENCE', `${path}.calleeNodeId`, 'Absent callee AST node.');
	if (node.id !== callGraphCallSiteNodeId(graph.id, node.invocationId))
		issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Call-site identity mismatch.');
}

function validateCallSiteExpectation(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALL_SITE' }>,
	path: string
): void {
	const { expectedClassifications, graph, issues } = context;
	sortedUniqueStrings(node.referenceIds, `${path}.referenceIds`, issues);
	sortedUniqueStrings(node.resolvedSymbolIds, `${path}.resolvedSymbolIds`, issues);
	sortedUniqueStrings(node.targetNodeIds, `${path}.targetNodeIds`, issues);
	const expectedClassification = expectedClassifications.get(node.invocationId);
	if (expectedClassification === undefined) {
		issues.add(
			'POPULATION_MISMATCH',
			`${path}.invocationId`,
			'Call-site invocation has no independently derivable classification.'
		);
		return;
	}
	if (
		node.resolutionClass === 'EXACT' &&
		expectedClassification.resolutionClass !== 'EXACT'
	)
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			`${path}.resolutionClass`,
			'Exact resolution is not supported by the bound invocation signature and identical retained inline implementation.'
		);
	const expectedTargetNodeIds =
		expectedClassification.resolutionClass === 'CANDIDATE_SET' ||
		expectedClassification.resolutionClass === 'EXACT'
			? expectedClassification.targetCallableNodeIds
			: [
					callGraphFrontierNodeId(
						graph.id,
						node.invocationId,
						expectedClassification.resolutionClass
					)
				];
	if (
		node.dispatchClass !== expectedClassification.dispatchClass ||
		node.reasonCode !== expectedClassification.reasonCode ||
		node.resolutionClass !== expectedClassification.resolutionClass ||
		!same(node.referenceIds, expectedClassification.referenceIds) ||
		!same(node.resolvedSymbolIds, expectedClassification.resolvedSymbolIds) ||
		!same(node.targetNodeIds, expectedTargetNodeIds) ||
		!same(node.provenanceIds, expectedClassification.provenanceIds)
	)
		issues.add(
			'INVALID_VALUE',
			path,
			'Call-site dispatch, reason, references, symbols, resolution, complete target set, or provenance differs from the semantic snapshot.'
		);
}

function validateCallSiteReferences(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALL_SITE' }>,
	path: string
): void {
	const { issues, referenceById, symbolById } = context;
	for (const [referenceIndex, referenceId] of node.referenceIds.entries()) {
		const reference = referenceById.get(referenceId);
		if (reference === undefined)
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.referenceIds[${referenceIndex}]`,
				'Absent callee reference.'
			);
		else if (reference.sourceId !== node.sourceId)
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.referenceIds[${referenceIndex}]`,
				'Callee reference belongs to another source.'
			);
	}
	for (const [symbolIndex, symbolId] of node.resolvedSymbolIds.entries())
		if (!symbolById.has(symbolId))
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.resolvedSymbolIds[${symbolIndex}]`,
				'Absent resolved symbol.'
			);
}

function validateCallSiteNode(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'CALL_SITE' }>,
	path: string
): void {
	const { callSitesByInvocation, expectedClassifications, issues, snapshot } = context;
	const expectedClassification = expectedClassifications.get(node.invocationId);
	if (
		expectedClassification !== undefined &&
		!same(
			node.epistemic,
			expectedResolutionEpistemic(expectedClassification.resolutionClass, snapshot)
		)
	)
		issues.add(
			'INVALID_VALUE',
			`${path}.epistemic`,
			'Call-site epistemic dimensions do not match the independently derived resolution class.'
		);
	const grouped = callSitesByInvocation.get(node.invocationId) ?? [];
	grouped.push(node);
	callSitesByInvocation.set(node.invocationId, grouped);
	validateCallSiteInvocationBinding(context, node, path);
	validateCallSiteExpectation(context, node, path);
	validateCallSiteReferences(context, node, path);
}

function validateFrontierNode(
	context: SemanticValidationContext,
	node: Extract<CallGraphNode, { kind: 'FRONTIER' }>,
	path: string
): void {
	const {
		expectedClassifications,
		frontiersByInvocation,
		graph,
		invocationById,
		issues,
		nodeBySemanticId,
		snapshot,
		symbolById
	} = context;
	const expectedClassification = expectedClassifications.get(node.invocationId);
	if (
		expectedClassification !== undefined &&
		!same(
			node.epistemic,
			expectedResolutionEpistemic(expectedClassification.resolutionClass, snapshot)
		)
	)
		issues.add(
			'INVALID_VALUE',
			`${path}.epistemic`,
			'Frontier epistemic dimensions do not match the independently derived resolution class.'
		);
	const grouped = frontiersByInvocation.get(node.invocationId) ?? [];
	grouped.push(node);
	frontiersByInvocation.set(node.invocationId, grouped);
	const invocation = invocationById.get(node.invocationId);
	if (invocation === undefined)
		issues.add('DANGLING_REFERENCE', `${path}.invocationId`, 'Absent frontier invocation.');
	else if (invocation.sourceId !== node.sourceId)
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.sourceId`,
			'Frontier source differs from its invocation.'
		);
	const invocationNode =
		invocation === undefined ? undefined : nodeBySemanticId.get(invocation.nodeId);
	if (
		invocationNode !== undefined &&
		!same(
			node.sourceLocations,
			exactLocation(node.sourceId, invocationNode.start, invocationNode.end)
		)
	)
		issues.add('INVALID_VALUE', `${path}.sourceLocations`, 'Frontier location mismatch.');
	if (node.id !== callGraphFrontierNodeId(graph.id, node.invocationId, node.frontierKind))
		issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Frontier-node identity mismatch.');
	sortedUniqueStrings(node.semanticSymbolIds, `${path}.semanticSymbolIds`, issues);
	if (
		expectedClassification === undefined ||
		expectedClassification.resolutionClass === 'CANDIDATE_SET' ||
		expectedClassification.resolutionClass === 'EXACT' ||
		node.frontierKind !== expectedClassification.resolutionClass ||
		node.reasonCode !== expectedClassification.reasonCode ||
		!same(node.semanticSymbolIds, expectedClassification.resolvedSymbolIds) ||
		!same(node.provenanceIds, expectedClassification.provenanceIds)
	)
		issues.add(
			'INVALID_VALUE',
			path,
			'Frontier class, reason, semantic symbols, or provenance differ from the independently derived call-site frontier.'
		);
	for (const [symbolIndex, symbolId] of node.semanticSymbolIds.entries())
		if (!symbolById.has(symbolId))
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.semanticSymbolIds[${symbolIndex}]`,
				'Absent frontier symbol.'
			);
}

function validateGraphNode(
	context: SemanticValidationContext,
	node: CallGraphNode,
	path: string
): void {
	const { graph, issues, layer, provenanceById, snapshot, sourceById } = context;
	graphWideReference(node, graph, layer.id, path, issues);
	validateProvenanceIds(
		node.provenanceIds,
		provenanceById,
		snapshot.id,
		snapshot.subjectId,
		`${path}.provenanceIds`,
		issues
	);
	canonicalObjectArray(node.sourceLocations, `${path}.sourceLocations`, issues);
	for (const [locationIndex, location] of node.sourceLocations.entries()) {
		const source = sourceById.get(location.sourceId);
		if (source === undefined)
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.sourceLocations[${locationIndex}]`,
				'Absent source.'
			);
		else if (location.end > source.textLength)
			issues.add(
				'INVALID_VALUE',
				`${path}.sourceLocations[${locationIndex}].end`,
				'Location exceeds its source.'
			);
	}
	if (node.kind === 'SOURCE_REGION') validateSourceRegionNode(context, node, path);
	else if (node.kind === 'CALLABLE_TARGET') validateCallableTargetNode(context, node, path);
	else if (node.kind === 'CALL_SITE') validateCallSiteNode(context, node, path);
	else validateFrontierNode(context, node, path);
}

function validateGraphNodes(context: SemanticValidationContext): boolean {
	const { graph, issues } = context;
	for (const [index, node] of graph.nodes.entries()) {
		validateGraphNode(context, node, `$.nodes[${index}]`);
		if (issues.exhausted) return false;
	}
	return true;
}

function validateNodePopulations(context: SemanticValidationContext): void {
	const {
		callableBySemanticNode,
		expectedCallables,
		graph,
		issues,
		programById,
		projectById,
		snapshot,
		sourceRegionBySource
	} = context;
	if (
		sourceRegionBySource.size !== snapshot.sources.length ||
		graph.nodes.filter((node) => node.kind === 'SOURCE_REGION').length !== snapshot.sources.length
	)
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			'Every semantic source must have exactly one SOURCE_REGION node.'
		);
	if (
		callableBySemanticNode.size !== expectedCallables.size ||
		[...expectedCallables.keys()].some((nodeId) => !callableBySemanticNode.has(nodeId))
	)
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			'Every derivable deep-indexed runtime callable AST node must have exactly one CALLABLE_TARGET node.'
		);
	for (const source of snapshot.sources) {
		if (!projectById.has(source.projectId) || !programById.has(source.programId))
			issues.add(
				'DANGLING_REFERENCE',
				'$semanticSnapshot.sources',
				'Semantic source has an absent project or program.'
			);
		const program = programById.get(source.programId);
		if (program !== undefined && program.projectId !== source.projectId)
			issues.add(
				'DANGLING_REFERENCE',
				'$semanticSnapshot.sources',
				'Semantic source program/project pair is inconsistent.'
			);
	}
}

function validateEdgeInvocationLocation(
	context: SemanticValidationContext,
	edge: CallGraphEdge,
	invocation: StaticSemanticSnapshot['invocations'][number],
	path: string
): void {
	const { issues, nodeBySemanticId } = context;
	const invocationNode = nodeBySemanticId.get(invocation.nodeId);
	if (invocationNode === undefined)
		issues.add('DANGLING_REFERENCE', `${path}.invocationId`, 'Invocation AST node is absent.');
	else if (
		!same(
			edge.sourceLocations,
			exactLocation(invocation.sourceId, invocationNode.start, invocationNode.end)
		)
	)
		issues.add(
			'INVALID_VALUE',
			`${path}.sourceLocations`,
			'Edge location does not cite its exact invocation.'
		);
}

function validateEdgeEndpointBindings(
	context: SemanticValidationContext,
	edge: CallGraphEdge,
	path: string
): void {
	const { expectedNodeProvenance, issues, nodeById } = context;
	const sourceNode = nodeById.get(edge.source.nodeId);
	const targetNode = nodeById.get(edge.target.nodeId);
	// S6582 REFUSED — right operand is a property read; see the `parent` guard above.
	if (sourceNode === undefined || sourceNode.kind !== edge.source.kind)
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.source`,
			'Edge source endpoint is absent or has another kind.'
		);
	// S6582 REFUSED — right operand is a property read; see the `parent` guard above.
	if (targetNode === undefined || targetNode.kind !== edge.target.kind)
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.target`,
			'Edge target endpoint is absent or has another kind.'
		);
	const expectedSourceProvenance = expectedNodeProvenance.get(edge.source.nodeId);
	const expectedTargetProvenance = expectedNodeProvenance.get(edge.target.nodeId);
	if (
		expectedSourceProvenance === undefined ||
		expectedTargetProvenance === undefined ||
		!same(
			edge.provenanceIds,
			[...new Set([...expectedSourceProvenance, ...expectedTargetProvenance])].sort(compareText)
		)
	)
		issues.add(
			'INVALID_VALUE',
			`${path}.provenanceIds`,
			'Edge provenance must exactly equal the independently derived union of endpoint evidence.'
		);
}

function validateOwnershipEdge(
	context: SemanticValidationContext,
	edge: CallGraphEdge,
	path: string
): void {
	const { callSitesByInvocation, issues, nodeById, ownershipByInvocation, snapshot } = context;
	if (!same(edge.epistemic, expectedStructuralEpistemic(snapshot)))
		issues.add(
			'INVALID_VALUE',
			`${path}.epistemic`,
			'Ownership-edge epistemic dimensions must remain structural.'
		);
	const grouped = ownershipByInvocation.get(edge.invocationId) ?? [];
	grouped.push(edge);
	ownershipByInvocation.set(edge.invocationId, grouped);
	const callSite = callSitesByInvocation.get(edge.invocationId)?.[0];
	const sourceNode = nodeById.get(edge.source.nodeId);
	const targetNode = nodeById.get(edge.target.nodeId);
	if (
		edge.candidateRank !== null ||
		edge.evidenceClass !== 'R-SEM' ||
		edge.relationCode !== 'STRUCTURAL' ||
		edge.resolutionClass !== null ||
		edge.targetState !== 'STRUCTURAL' ||
		targetNode?.kind !== 'CALL_SITE' ||
		targetNode.id !== callSite?.id ||
		sourceNode?.id !== callSite?.ownerNodeId ||
		(sourceNode?.kind !== 'SOURCE_REGION' && sourceNode?.kind !== 'CALLABLE_TARGET')
	)
		issues.add(
			'INVALID_VALUE',
			path,
			'Ownership edge lane, state, rank, or endpoints are incompatible.'
		);
}

function validateCandidateInferenceBasis(
	context: SemanticValidationContext,
	edge: Extract<CallGraphEdge, { relationKind: 'CANDIDATE_CALL_TARGET' }>,
	invocation: StaticSemanticSnapshot['invocations'][number],
	targetNode: Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }>,
	expectedClassification: ExpectedCallClassification,
	path: string
): void {
	const { issues } = context;
	const targetSpec = expectedClassification.targetSpecsByNode.get(targetNode.semanticNodeId);
	const assignmentInputIds =
		targetSpec === undefined
			? []
			: expectedClassification.resolvedSymbolIds.flatMap((symbolId) => [
					...(targetSpec.assignmentInputIdsBySymbol.get(symbolId) ?? [])
				]);
	const expectedInferenceBasis = {
		inputIds: [
			...new Set([
				invocation.id,
				...expectedClassification.referenceIds,
				...expectedClassification.resolvedSymbolIds,
				...assignmentInputIds,
				targetNode.semanticNodeId,
				...(targetSpec === undefined ? [] : [...targetSpec.declarationIds])
			])
		].sort(compareText),
		limitationKinds: [
			...new Set([
				'CANDIDATE_SET_OPEN',
				...(invocation.resolvedSignatureId === null
					? ['INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED']
					: []),
				...(expectedClassification.dispatchClass === 'MEMBER_REFERENCE' ||
				expectedClassification.dispatchClass === 'LITERAL_ELEMENT_REFERENCE'
					? ['DYNAMIC_DISPATCH_NOT_CLOSED']
					: [])
			])
		].sort(compareText),
		method: CALL_GRAPH_METHOD,
		rationale:
			'The compiler-bound symbol and retained callable declaration establish a possible target; no exclusivity or dispatch closure is claimed.'
	};
	if (targetSpec === undefined || !same(edge.inferenceBasis, expectedInferenceBasis))
		issues.add(
			'INVALID_VALUE',
			`${path}.inferenceBasis`,
			'Candidate inference basis does not exactly match independently derived invocation, reference, symbol, assignment, declaration, limitation, method, and rationale evidence.'
		);
}

function validateCandidateEdge(
	context: SemanticValidationContext,
	edge: Extract<CallGraphEdge, { relationKind: 'CANDIDATE_CALL_TARGET' }>,
	invocation: StaticSemanticSnapshot['invocations'][number],
	path: string
): void {
	const { allSemanticIds, expectedClassifications, issues, nodeById, snapshot } = context;
	const expectedClassification = expectedClassifications.get(edge.invocationId);
	const targetNode = nodeById.get(edge.target.nodeId);
	if (
		expectedClassification?.resolutionClass !== 'CANDIDATE_SET' ||
		!same(
			edge.epistemic,
			expectedResolutionEpistemic(expectedClassification.resolutionClass, snapshot)
		)
	)
		issues.add(
			'INVALID_VALUE',
			`${path}.epistemic`,
			'Candidate-edge epistemic dimensions do not match independently derived candidate evidence.'
		);
	const expectedRank =
		expectedClassification?.resolutionClass === 'CANDIDATE_SET'
			? expectedClassification.targetCallableNodeIds.indexOf(edge.target.nodeId) + 1
			: 0;
	if (
		edge.evidenceClass !== 'R-INF' ||
		edge.relationCode !== 'REL-068' ||
		edge.resolutionClass !== 'CANDIDATE_SET' ||
		edge.targetState !== 'CANDIDATE' ||
		edge.candidateRank !== expectedRank ||
		expectedRank < 1 ||
		targetNode?.kind !== 'CALLABLE_TARGET'
	)
		issues.add(
			'INVALID_VALUE',
			path,
			'Candidate edge lane, state, rank, or target is incompatible.'
		);
	sortedUniqueStrings(edge.inferenceBasis.inputIds, `${path}.inferenceBasis.inputIds`, issues);
	sortedUniqueStrings(
		edge.inferenceBasis.limitationKinds,
		`${path}.inferenceBasis.limitationKinds`,
		issues
	);
	for (const [inputIndex, inputId] of edge.inferenceBasis.inputIds.entries())
		if (!allSemanticIds.has(inputId))
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.inferenceBasis.inputIds[${inputIndex}]`,
				'Absent semantic inference input.'
			);
	if (
		expectedClassification?.resolutionClass === 'CANDIDATE_SET' &&
		targetNode?.kind === 'CALLABLE_TARGET'
	)
		validateCandidateInferenceBasis(
			context,
			edge,
			invocation,
			targetNode,
			expectedClassification,
			path
		);
}

function validateConfirmedEdge(
	context: SemanticValidationContext,
	edge: Extract<CallGraphEdge, { relationKind: 'CONFIRMED_CALL_TARGET' }>,
	invocation: StaticSemanticSnapshot['invocations'][number],
	path: string
): void {
	const { expectedClassifications, issues, nodeById, snapshot } = context;
	const expectedClassification = expectedClassifications.get(edge.invocationId);
	const targetNode = nodeById.get(edge.target.nodeId);
	if (
		expectedClassification?.resolutionClass !== 'EXACT' ||
		!same(edge.epistemic, expectedResolutionEpistemic('EXACT', snapshot))
	)
		issues.add(
			'INVALID_VALUE',
			`${path}.epistemic`,
			'Confirmed-edge epistemic dimensions require independently derived exact evidence.'
		);
	const expectedTargetId = expectedClassification?.targetCallableNodeIds[0];
	if (
		edge.evidenceClass !== 'R-SEM' ||
		edge.relationCode !== 'REL-067' ||
		edge.resolutionClass !== 'EXACT' ||
		edge.targetState !== 'CONFIRMED' ||
		edge.candidateRank !== null ||
		targetNode?.kind !== 'CALLABLE_TARGET' ||
		expectedClassification?.targetCallableNodeIds.length !== 1 ||
		edge.target.nodeId !== expectedTargetId ||
		targetNode.semanticNodeId !== invocation.implementationNodeId
	)
		issues.add(
			'INVALID_VALUE',
			path,
			'Confirmed edge lane, state, target, or independently derived implementation identity is incompatible.'
		);
	if (
		invocation.targetState !== 'IMPLEMENTATION_IDENTIFIED' ||
		invocation.resolvedSignatureId === null ||
		invocation.resolutionProvenanceId === null ||
		!edge.provenanceIds.includes(invocation.resolutionProvenanceId)
	)
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			path,
			'Confirmed edge lacks a retained resolved signature, unique implementation, or compiler-resolution provenance.'
		);
}

function validateFrontierEdge(
	context: SemanticValidationContext,
	edge: CallGraphEdge,
	path: string
): void {
	const { expectedClassifications, graph, issues, nodeById, snapshot } = context;
	const expectedClassification = expectedClassifications.get(edge.invocationId);
	const targetNode = nodeById.get(edge.target.nodeId);
	const expectedFrontierKind =
		expectedClassification !== undefined &&
		expectedClassification.resolutionClass !== 'CANDIDATE_SET' &&
		expectedClassification.resolutionClass !== 'EXACT'
			? expectedClassification.resolutionClass
			: null;
	if (
		expectedClassification === undefined ||
		expectedClassification.resolutionClass === 'CANDIDATE_SET' ||
		!same(
			edge.epistemic,
			expectedResolutionEpistemic(expectedClassification.resolutionClass, snapshot)
		)
	)
		issues.add(
			'INVALID_VALUE',
			`${path}.epistemic`,
			'Frontier-edge epistemic dimensions do not match its resolution class.'
		);
	if (
		edge.evidenceClass !== 'R-INF' ||
		edge.relationCode !== 'REL-071' ||
		!oneOf(edge.resolutionClass, ['EXTERNAL_DISPATCH', 'UNRESOLVED', 'UNSUPPORTED']) ||
		edge.targetState !== 'UNRESOLVED_DYNAMIC' ||
		edge.candidateRank !== null ||
		targetNode?.kind !== 'FRONTIER' ||
		targetNode.frontierKind !== edge.resolutionClass ||
		expectedFrontierKind === null ||
		edge.resolutionClass !== expectedFrontierKind ||
		targetNode.id !==
			callGraphFrontierNodeId(graph.id, edge.invocationId, expectedFrontierKind ?? 'UNSUPPORTED')
	)
		issues.add(
			'INVALID_VALUE',
			path,
			'Unresolved edge lane, state, rank, or frontier is incompatible.'
		);
}

function validateTargetEdge(
	context: SemanticValidationContext,
	edge: CallGraphEdge,
	invocation: StaticSemanticSnapshot['invocations'][number],
	path: string
): void {
	const { callSitesByInvocation, issues, nodeById, targetsByInvocation } = context;
	const grouped = targetsByInvocation.get(edge.invocationId) ?? [];
	grouped.push(edge);
	targetsByInvocation.set(edge.invocationId, grouped);
	const callSite = callSitesByInvocation.get(edge.invocationId)?.[0];
	const sourceNode = nodeById.get(edge.source.nodeId);
	if (sourceNode?.kind !== 'CALL_SITE' || sourceNode.id !== callSite?.id)
		issues.add(
			'INVALID_VALUE',
			`${path}.source`,
			'Target edge must originate at its call-site node.'
		);
	if (edge.relationKind === 'CONFIRMED_CALL_TARGET')
		validateConfirmedEdge(context, edge, invocation, path);
	else if (edge.relationKind === 'CANDIDATE_CALL_TARGET')
		validateCandidateEdge(context, edge, invocation, path);
	else validateFrontierEdge(context, edge, path);
}

function validateGraphEdge(
	context: SemanticValidationContext,
	edge: CallGraphEdge,
	path: string
): boolean {
	const { graph, invocationById, issues, layer, provenanceById, snapshot } = context;
	graphWideReference(edge, graph, layer.id, path, issues);
	validateProvenanceIds(
		edge.provenanceIds,
		provenanceById,
		snapshot.id,
		snapshot.subjectId,
		`${path}.provenanceIds`,
		issues
	);
	canonicalObjectArray(edge.sourceLocations, `${path}.sourceLocations`, issues);
	const invocation = invocationById.get(edge.invocationId);
	if (invocation === undefined) {
		issues.add('DANGLING_REFERENCE', `${path}.invocationId`, 'Absent semantic invocation.');
		return false;
	}
	validateEdgeInvocationLocation(context, edge, invocation, path);
	validateEdgeEndpointBindings(context, edge, path);
	if (edge.relationKind === 'CALL_SITE_OWNERSHIP') validateOwnershipEdge(context, edge, path);
	else validateTargetEdge(context, edge, invocation, path);
	if (
		edge.id !==
		callGraphEdgeId({
			candidateRank: edge.candidateRank,
			graph: graph.id,
			invocationId: edge.invocationId,
			relationKind: edge.relationKind,
			source: edge.source,
			target: edge.target
		})
	)
		issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Call-graph edge identity mismatch.');
	return true;
}

function validateGraphEdges(context: SemanticValidationContext): boolean {
	const { graph, issues } = context;
	for (const [index, edge] of graph.edges.entries()) {
		if (!validateGraphEdge(context, edge, `$.edges[${index}]`)) continue;
		if (issues.exhausted) return false;
	}
	return true;
}

function validateInvocationExpectation(
	context: SemanticValidationContext,
	invocation: StaticSemanticSnapshot['invocations'][number],
	expectedClassification: ExpectedCallClassification,
	targetIds: readonly string[],
	frontiers: readonly Extract<CallGraphNode, { kind: 'FRONTIER' }>[],
	targets: readonly CallGraphEdge[]
): void {
	const { graph, issues } = context;
	const expectedTargetIds =
		expectedClassification.resolutionClass === 'CANDIDATE_SET' ||
		expectedClassification.resolutionClass === 'EXACT'
			? [...expectedClassification.targetCallableNodeIds]
			: [
					callGraphFrontierNodeId(
						graph.id,
						invocation.id,
						expectedClassification.resolutionClass
					)
				];
	if (!same(targetIds, expectedTargetIds))
		issues.add(
			'POPULATION_MISMATCH',
			'$.edges',
			`Invocation ${invocation.id} target edges do not equal the complete independently derived target set.`
		);
	if (expectedClassification.resolutionClass === 'CANDIDATE_SET') {
		if (
			frontiers.length !== 0 ||
			targets.length !== expectedTargetIds.length ||
			targets.some((edge) => edge.relationKind !== 'CANDIDATE_CALL_TARGET')
		)
			issues.add(
				'POPULATION_MISMATCH',
				'$.edges',
				`Invocation ${invocation.id} candidate-edge population differs from independent semantic derivation.`
			);
	} else if (expectedClassification.resolutionClass === 'EXACT') {
		if (
			frontiers.length !== 0 ||
			targets.length !== 1 ||
			targets[0]?.relationKind !== 'CONFIRMED_CALL_TARGET'
		)
			issues.add(
				'POPULATION_MISMATCH',
				'$.edges',
				`Invocation ${invocation.id} confirmed-edge population differs from independent semantic derivation.`
			);
	} else if (
		(frontiers.length !== 1 ||
			targets.length !== 1 ||
			targets[0]?.relationKind !== 'UNRESOLVED_CALL_TARGET')
	)
		issues.add(
			'POPULATION_MISMATCH',
			'$.edges',
			`Invocation ${invocation.id} frontier population differs from independent semantic derivation.`
		);
}

function validateExactInvocationPopulation(
	context: SemanticValidationContext,
	invocation: StaticSemanticSnapshot['invocations'][number],
	frontiers: readonly Extract<CallGraphNode, { kind: 'FRONTIER' }>[],
	targets: readonly CallGraphEdge[]
): void {
	const { issues, nodeById } = context;
	if (frontiers.length !== 0)
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			`Exact invocation ${invocation.id} must not have a frontier node.`
		);
	const target = targets[0];
	const targetNode = target === undefined ? undefined : nodeById.get(target.target.nodeId);
	if (
		targets.length !== 1 ||
		target?.relationKind !== 'CONFIRMED_CALL_TARGET' ||
		targetNode?.kind !== 'CALLABLE_TARGET' ||
		targetNode.semanticNodeId !== invocation.implementationNodeId
	)
		issues.add(
			'POPULATION_MISMATCH',
			'$.edges',
			`Exact invocation ${invocation.id} must have one confirmed edge to its retained implementation.`
		);
}

function validateCandidateInvocationPopulation(
	context: SemanticValidationContext,
	invocation: StaticSemanticSnapshot['invocations'][number],
	frontiers: readonly Extract<CallGraphNode, { kind: 'FRONTIER' }>[],
	targets: readonly CallGraphEdge[]
): void {
	const { issues } = context;
	if (frontiers.length !== 0)
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			`Candidate invocation ${invocation.id} must not have a frontier node.`
		);
	if (targets.some((edge) => edge.relationKind !== 'CANDIDATE_CALL_TARGET'))
		issues.add(
			'INVALID_VALUE',
			'$.edges',
			`Invocation ${invocation.id} mixes candidate and non-candidate targets.`
		);
	const ranks = targets
		.map((edge) => edge.candidateRank)
		.sort((left, right) => (left ?? -1) - (right ?? -1));
	const expectedRanks = targets.map((_edge, index) => index + 1);
	if (!same(ranks, expectedRanks))
		issues.add(
			'POPULATION_MISMATCH',
			'$.edges',
			`Invocation ${invocation.id} candidate ranks must be contiguous from one.`
		);
}

function validateFrontierInvocationPopulation(
	context: SemanticValidationContext,
	invocation: StaticSemanticSnapshot['invocations'][number],
	site: Extract<CallGraphNode, { kind: 'CALL_SITE' }>,
	frontiers: readonly Extract<CallGraphNode, { kind: 'FRONTIER' }>[],
	targets: readonly CallGraphEdge[]
): void {
	const { issues, nodeById } = context;
	if (frontiers.length !== 1 || frontiers[0]?.frontierKind !== site.resolutionClass)
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			`Invocation ${invocation.id} must have exactly one matching frontier node.`
		);
	if (targets.length !== 1 || targets[0]?.relationKind !== 'UNRESOLVED_CALL_TARGET')
		issues.add(
			'INVALID_VALUE',
			'$.edges',
			`Invocation ${invocation.id} must have one explicit frontier target.`
		);
	const frontier = targets[0] === undefined ? undefined : nodeById.get(targets[0].target.nodeId);
	if (frontier?.kind !== 'FRONTIER' || frontier.frontierKind !== site.resolutionClass)
		issues.add('INVALID_VALUE', '$.nodes', `Invocation ${invocation.id} frontier class mismatch.`);
}

function validateInvocationSite(
	context: SemanticValidationContext,
	invocation: StaticSemanticSnapshot['invocations'][number],
	site: Extract<CallGraphNode, { kind: 'CALL_SITE' }>,
	frontiers: readonly Extract<CallGraphNode, { kind: 'FRONTIER' }>[],
	targets: readonly CallGraphEdge[]
): void {
	const { expectedClassifications, issues, nodeById } = context;
	const targetIds = targets.map((edge) => edge.target.nodeId).sort(compareText);
	if (!same(site.targetNodeIds, targetIds))
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			`Invocation ${invocation.id} target manifest mismatch.`
		);
	if (!nodeById.has(site.ownerNodeId))
		issues.add('DANGLING_REFERENCE', '$.nodes', `Invocation ${invocation.id} owner is absent.`);
	const expectedClassification = expectedClassifications.get(invocation.id);
	if (expectedClassification === undefined)
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			`Invocation ${invocation.id} has no independently derivable call classification.`
		);
	else
		validateInvocationExpectation(
			context,
			invocation,
			expectedClassification,
			targetIds,
			frontiers,
			targets
		);
	if (site.resolutionClass === 'CANDIDATE_SET')
		validateCandidateInvocationPopulation(context, invocation, frontiers, targets);
	else if (site.resolutionClass === 'EXACT')
		validateExactInvocationPopulation(context, invocation, frontiers, targets);
	else
		validateFrontierInvocationPopulation(context, invocation, site, frontiers, targets);
}

function validateInvocationPopulations(
	context: SemanticValidationContext,
	invocation: StaticSemanticSnapshot['invocations'][number]
): void {
	const {
		callSitesByInvocation,
		frontiersByInvocation,
		issues,
		ownershipByInvocation,
		targetsByInvocation
	} = context;
	const sites = callSitesByInvocation.get(invocation.id) ?? [];
	const frontiers = frontiersByInvocation.get(invocation.id) ?? [];
	const ownership = ownershipByInvocation.get(invocation.id) ?? [];
	const targets = targetsByInvocation.get(invocation.id) ?? [];
	if (sites.length !== 1)
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			`Invocation ${invocation.id} must have exactly one CALL_SITE node.`
		);
	if (ownership.length !== 1)
		issues.add(
			'POPULATION_MISMATCH',
			'$.edges',
			`Invocation ${invocation.id} must have exactly one ownership edge.`
		);
	if (targets.length < 1)
		issues.add(
			'POPULATION_MISMATCH',
			'$.edges',
			`Invocation ${invocation.id} must have at least one target edge.`
		);
	const site = sites[0];
	if (site !== undefined) validateInvocationSite(context, invocation, site, frontiers, targets);
}

function validateInvocationReconciliation(context: SemanticValidationContext): boolean {
	const { issues, snapshot } = context;
	for (const invocation of snapshot.invocations) {
		validateInvocationPopulations(context, invocation);
		if (issues.exhausted) return false;
	}
	return true;
}

function validateCallSiteInvocationKeys(context: SemanticValidationContext): void {
	const { callSitesByInvocation, invocationById, issues } = context;
	for (const invocationId of callSitesByInvocation.keys())
		if (!invocationById.has(invocationId))
			issues.add(
				'DANGLING_REFERENCE',
				'$.nodes',
				'Call-site population contains an unknown invocation.'
			);
}

function validateLayerManifests(context: SemanticValidationContext): void {
	const { graph, issues, layer } = context;
	const nodeIds = graph.nodes.map((node) => node.id).sort(compareText);
	const edgeIds = graph.edges.map((edge) => edge.id).sort(compareText);
	if (!same(layer.nodeIds, nodeIds))
		issues.add('POPULATION_MISMATCH', '$.layers[0].nodeIds', 'Layer node manifest mismatch.');
	if (!same(layer.edgeIds, edgeIds))
		issues.add('POPULATION_MISMATCH', '$.layers[0].edgeIds', 'Layer edge manifest mismatch.');
	sortedUniqueStrings(layer.nodeIds, '$.layers[0].nodeIds', issues);
	sortedUniqueStrings(layer.edgeIds, '$.layers[0].edgeIds', issues);
}

function validateIndexEntry(
	context: SemanticValidationContext,
	entry: CallGraphIndexEntry,
	path: string
): void {
	const { edgeById, issues, nodeById } = context;
	if (!nodeById.has(entry.nodeId))
		issues.add('DANGLING_REFERENCE', `${path}.nodeId`, 'Index references an absent node.');
	sortedUniqueStrings(entry.edgeIds, `${path}.edgeIds`, issues);
	for (const [edgeIndex, edgeId] of entry.edgeIds.entries())
		if (!edgeById.has(edgeId))
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.edgeIds[${edgeIndex}]`,
				'Index references an absent edge.'
			);
}

function validateGraphIndexes(context: SemanticValidationContext): void {
	const { graph, issues } = context;
	const expectedGraphIndexes = expectedIndexes(graph.nodes, graph.edges);
	for (const [name, index, expected] of [
		['forwardIndex', graph.forwardIndex, expectedGraphIndexes.forward],
		['reverseIndex', graph.reverseIndex, expectedGraphIndexes.reverse]
	] as const) {
		sortedUniqueStrings(
			index.map((entry) => entry.nodeId),
			`$.${name}`,
			issues
		);
		for (const [entryIndex, entry] of index.entries())
			validateIndexEntry(context, entry, `$.${name}[${entryIndex}]`);
		if (!same(index, expected))
			issues.add(
				'POPULATION_MISMATCH',
				`$.${name}`,
				`${name} does not exactly reconcile graph navigation.`
			);
	}
}

function validateCoverageTotals(context: SemanticValidationContext): void {
	const { expectedClassifications, graph, issues, layer, snapshot } = context;
	const coverage = expectedCoverage(snapshot, expectedClassifications);
	if (!same(graph.coverage, coverage))
		issues.add(
			'POPULATION_MISMATCH',
			'$.coverage',
			'Coverage totals do not reconcile graph populations.'
		);
	if (!same(layer.coverage, graph.coverage))
		issues.add(
			'POPULATION_MISMATCH',
			'$.layers[0].coverage',
			'Layer coverage differs from top-level coverage.'
		);
}

function globalLimitationKey(kind: string): string {
	return `${kind}\0\0`;
}

function invocationLimitationKey(kind: string, invocationId: string, sourceId: string): string {
	return `${kind}\0${invocationId}\0${sourceId}`;
}

function invocationLimitationKeys(
	invocation: StaticSemanticSnapshot['invocations'][number],
	classification: ExpectedCallClassification
): string[] {
	const { id, sourceId } = invocation;
	const signatureKeys =
		invocation.resolvedSignatureId === null
			? [invocationLimitationKey('INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED', id, sourceId)]
			: [];
	if (classification.resolutionClass === 'CANDIDATE_SET')
		return [
			...signatureKeys,
			invocationLimitationKey('CANDIDATE_SET_OPEN', id, sourceId),
			...(classification.dispatchClass === 'MEMBER_REFERENCE' ||
			classification.dispatchClass === 'LITERAL_ELEMENT_REFERENCE'
				? [invocationLimitationKey('DYNAMIC_DISPATCH_NOT_CLOSED', id, sourceId)]
				: [])
		];
	if (classification.resolutionClass === 'EXTERNAL_DISPATCH')
		return [
			...signatureKeys,
			invocationLimitationKey('EXTERNAL_DISPATCH_FRONTIER', id, sourceId),
			...(classification.reasonCode === 'CALLABLE_VALUE_FLOW_NOT_MODELED'
				? [invocationLimitationKey('CALLABLE_VALUE_FLOW_NOT_MODELED', id, sourceId)]
				: [])
		];
	if (classification.resolutionClass === 'UNRESOLVED')
		return [...signatureKeys, invocationLimitationKey('UNRESOLVED_TARGET_FRONTIER', id, sourceId)];
	if (classification.resolutionClass === 'UNSUPPORTED')
		return [...signatureKeys, invocationLimitationKey('UNSUPPORTED_TARGET_FRONTIER', id, sourceId)];
	return [];
}

function expectedLimitationKeySet(context: SemanticValidationContext): string[] {
	const { expectedClassifications, snapshot } = context;
	const expectedLimitationKeys = [
		globalLimitationKey('CALLER_CONTEXT_COARSENED'),
		globalLimitationKey('ENTRY_MECHANISM_NOT_ANALYZED'),
		...(snapshot.health === 'PARTIAL' ? [globalLimitationKey('SEMANTIC_INPUT_PARTIAL')] : [])
	];
	for (const invocation of snapshot.invocations) {
		const classification = expectedClassifications.get(invocation.id);
		if (classification !== undefined)
			expectedLimitationKeys.push(...invocationLimitationKeys(invocation, classification));
	}
	expectedLimitationKeys.sort(compareText);
	return expectedLimitationKeys;
}

function validateLimitationRecord(
	context: SemanticValidationContext,
	limitation: CallGraphSnapshot['limitations'][number],
	index: number
): void {
	const { invocationById, issues, sourceById } = context;
	if (limitation.closureEffect !== 'DEGRADES_CLOSURE')
		issues.add(
			'LIMITATION_MISMATCH',
			`$.limitations[${index}].closureEffect`,
			'Every limitation emitted by producer 0.1.0 degrades closure.'
		);
	if (limitation.invocationId !== null && !invocationById.has(limitation.invocationId))
		issues.add(
			'DANGLING_REFERENCE',
			`$.limitations[${index}].invocationId`,
			'Absent limitation invocation.'
		);
	if (limitation.sourceId !== null && !sourceById.has(limitation.sourceId))
		issues.add(
			'DANGLING_REFERENCE',
			`$.limitations[${index}].sourceId`,
			'Absent limitation source.'
		);
	if (limitation.invocationId !== null && limitation.sourceId !== null) {
		const invocation = invocationById.get(limitation.invocationId);
		if (invocation !== undefined && invocation.sourceId !== limitation.sourceId)
			issues.add(
				'DANGLING_REFERENCE',
				`$.limitations[${index}]`,
				'Limitation invocation and source differ.'
			);
	}
}

function validateLimitations(context: SemanticValidationContext): void {
	const { graph, issues } = context;
	sortedUniqueStrings(graph.limitations.map(limitationOrderKey), '$.limitations', issues);
	for (const [index, limitation] of graph.limitations.entries())
		validateLimitationRecord(context, limitation, index);
	if (!same(graph.limitations.map(limitationOrderKey), expectedLimitationKeySet(context)))
		issues.add(
			'LIMITATION_MISMATCH',
			'$.limitations',
			'Limitation categories do not exactly reconcile semantic health and every call-site class.'
		);
}

function validateLayerParity(context: SemanticValidationContext): void {
	const { expectedClassifications, graph, issues, layer, snapshot } = context;
	if (!same(layer.limitations, graph.limitations))
		issues.add('LIMITATION_MISMATCH', '$.layers[0].limitations', 'Layer limitations differ.');
	if (!same(layer.entryMechanismCoverage, graph.entryMechanismCoverage))
		issues.add(
			'POPULATION_MISMATCH',
			'$.layers[0].entryMechanismCoverage',
			'Layer entry coverage differs.'
		);
	if (!same(layer.relationLaneCoverage, graph.relationLaneCoverage))
		issues.add(
			'POPULATION_MISMATCH',
			'$.layers[0].relationLaneCoverage',
			'Layer relation-lane coverage differs.'
		);
	if (!same(layer.epistemic, graph.epistemic))
		issues.add('INVALID_VALUE', '$.layers[0].epistemic', 'Layer epistemic dimensions differ.');
	validateCoverageArrays(graph, '$', issues);
	validateCoverageArrays(graph, '$.layers[0]', issues);

	if (!same(graph.epistemic, expectedGlobalEpistemic(snapshot, expectedClassifications)))
		issues.add(
			'INVALID_VALUE',
			'$.epistemic',
			'Aggregate epistemic dimensions do not match this partial mixed-evidence producer.'
		);
}

function validateLayerProvenance(context: SemanticValidationContext): void {
	const { graph, issues, layer, provenanceById, snapshot } = context;
	const expectedLayerProvenance = [
		...new Set(
			graph.nodes
				.flatMap((node) => [...node.provenanceIds])
				.concat(graph.edges.flatMap((edge) => [...edge.provenanceIds]))
		)
	].sort(compareText);
	validateProvenanceIds(
		layer.provenanceIds,
		provenanceById,
		snapshot.id,
		snapshot.subjectId,
		'$.layers[0].provenanceIds',
		issues
	);
	if (!same(layer.provenanceIds, expectedLayerProvenance))
		issues.add(
			'POPULATION_MISMATCH',
			'$.layers[0].provenanceIds',
			'Layer provenance manifest mismatch.'
		);
}

function validateContentDigest(context: SemanticValidationContext): void {
	const { graph, issues } = context;
	try {
		if (graph.contentDigest !== callGraphContentDigest(graph))
			issues.add(
				'CONTENT_DIGEST_MISMATCH',
				'$.contentDigest',
				'Content digest does not bind the exact finalized call graph.'
			);
	} catch (error) {
		issues.add(
			'CONTENT_DIGEST_MISMATCH',
			'$.contentDigest',
			error instanceof Error ? error.message : 'Call-graph content digest failed closed.'
		);
	}
}

function validateDuplicateIdentities(context: SemanticValidationContext): void {
	const { edgeById, graph, issues, nodeById } = context;
	if (nodeById.size !== graph.nodes.length || edgeById.size !== graph.edges.length)
		issues.add('DUPLICATE_ID', '$', 'Call-graph populations contain duplicate identities.');
}

function validateCallGraphUsingInputDigest(
	value: unknown,
	semanticSnapshot: StaticSemanticSnapshot,
	options: CallGraphValidationOptions,
	knownGraphInputDigest?: string
): CallGraphValidationResult {
	const maxIssues = options.maxIssues ?? DEFAULT_MAX_ISSUES;
	if (!Number.isSafeInteger(maxIssues) || maxIssues < 1 || maxIssues > 100_000)
		return {
			issues: [
				{
					code: 'INVALID_VALUE',
					message: 'maxIssues must be a positive safe integer no greater than 100000.',
					path: '$validationOptions.maxIssues'
				}
			],
			state: 'INVALID'
		};
	const issues = new IssueCollector(maxIssues);
	try {
		if (!shapeGraph(value, semanticSnapshot, issues)) return issues.result();
		validateCallGraphSemantics(value, semanticSnapshot, issues, knownGraphInputDigest);
		return issues.result();
	} catch (error) {
		issues.add(
			'INVALID_SHAPE',
			'$',
			error instanceof Error
				? `Call-graph validation failed closed: ${error.message}`
				: 'Call-graph validation failed closed.'
		);
		return issues.result();
	}
}

export function validateCallGraph(
	value: unknown,
	semanticSnapshot: StaticSemanticSnapshot,
	options: CallGraphValidationOptions = {}
): CallGraphValidationResult {
	return validateCallGraphUsingInputDigest(value, semanticSnapshot, options);
}

/**
 * Producer-internal fast path. The known digest must have been computed from the
 * same immutable-in-practice snapshot immediately before synchronous graph
 * construction. Public validation always recomputes the projection digest.
 */
export function validateConstructedCallGraph(
	value: unknown,
	semanticSnapshot: StaticSemanticSnapshot,
	knownGraphInputDigest: string,
	options: CallGraphValidationOptions = {}
): CallGraphValidationResult {
	if (!SHA256.test(knownGraphInputDigest))
		return {
			issues: [
				{
					code: 'INVALID_VALUE',
					message: 'Known graph-input digest must be lowercase SHA-256.',
					path: '$validationInput.graphInputDigest'
				}
			],
			state: 'INVALID'
		};
	return validateCallGraphUsingInputDigest(value, semanticSnapshot, options, knownGraphInputDigest);
}
