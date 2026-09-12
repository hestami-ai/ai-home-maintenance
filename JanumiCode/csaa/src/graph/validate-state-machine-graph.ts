import { isProxy } from 'node:util/types';

import {
	FULL_JAN_CSAA_008_CONFORMANCE,
	STATE_MACHINE_GRAPH_CANONICAL_PROFILE,
	STATE_MACHINE_GRAPH_CAPABILITY,
	STATE_MACHINE_GRAPH_CAPABILITY_STATUS,
	STATE_MACHINE_GRAPH_METHOD,
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REGISTRY_STATUS,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_SCOPE,
	STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION,
	type BuildStateMachineGraphRequest,
	type StateMachineGraphCoverage,
	type StateMachineGraphEdge,
	type StateMachineGraphIndexEntry,
	type StateMachineGraphLimitation,
	type StateMachineGraphNode,
	type StateMachineGraphRelationCode,
	type StateMachineGraphRelationKind,
	type StateMachineGraphSnapshot,
	type StateMachineTopologyObservation
} from '../contracts/state-machine-graph.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	type SemanticProvenanceId,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../semantic/canonical.js';
import { validateStateMachineTopologyObservation } from '../providers/jpwb-state-machines/validate-state-machine-observation.js';
import {
	stateMachineGraphContentDigest,
	stateMachineTopologyObservationContentDigest
} from './state-machine-graph-content.js';
import {
	stateMachineGraphCrossAxisFrontierNodeId,
	stateMachineGraphEdgeId,
	stateMachineGraphId,
	stateMachineGraphLayerId,
	stateMachineGraphMachineNodeId,
	stateMachineGraphStateNodeId
} from './state-machine-graph-ids.js';
import { stateMachineGraphInputDigest } from './state-machine-graph-input.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const DEFAULT_MAX_ISSUES = 1_000;

const TOP_LEVEL_KEYS = [
	'budgets',
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'closure',
	'contentDigest',
	'coverage',
	'edges',
	'epistemic',
	'forwardIndex',
	'fullJanCsaa007Conformance',
	'fullJanCsaa008Conformance',
	'graphInputDigest',
	'graphKind',
	'health',
	'id',
	'layers',
	'limitations',
	'method',
	'nodes',
	'observationId',
	'operationVersion',
	'producer',
	'registryStatus',
	'reverseIndex',
	'schemaVersion',
	'scope',
	'semanticExtractionVersion',
	'semanticSchemaVersion',
	'semanticSnapshotId',
	'source',
	'subjectId',
	'verifierAuthority'
] as const;
const REQUEST_KEYS = [
	'budgets',
	'observationId',
	'operationVersion',
	'schemaVersion',
	'semanticSnapshotId',
	'source',
	'subjectId'
] as const;
const BUDGET_KEYS = ['maxEdges', 'maxNodes'] as const;
const SOURCE_KEYS = ['logicalPath', 'programId', 'projectId', 'semanticSourceId'] as const;
const PROVIDER_KEYS = ['api', 'id', 'version'] as const;
const EPISTEMIC_KEYS = [
	'capabilityCoverage',
	'conflictState',
	'executionHealth',
	'freshness',
	'inferenceState',
	'supportBasis'
] as const;
const COVERAGE_KEYS = [
	'crossAxisRuleEdges',
	'expectedCrossAxisRules',
	'expectedExplicitlyIllegalTransitions',
	'expectedGuardedTransitions',
	'expectedLegalTransitions',
	'expectedMachines',
	'expectedStates',
	'explicitlyIllegalTransitionEdges',
	'guardedLegalTransitionEdges',
	'legalTransitionEdges',
	'machineNodes',
	'reconciles',
	'stateContainmentEdges',
	'stateNodes'
] as const;
const LIMITATION_KEYS = ['kind', 'reason'] as const;
const LOCATION_KEYS = ['end', 'sourceId', 'start'] as const;
const ENDPOINT_KEYS = ['kind', 'nodeId'] as const;
const INDEX_KEYS = ['edgeIds', 'nodeId'] as const;
const LAYER_KEYS = [
	'capability',
	'capabilityStatus',
	'coverage',
	'edgeIds',
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
	'scope',
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
const MACHINE_NODE_KEYS = [
	...NODE_BASE_KEYS,
	'initialState',
	'name',
	'observationMachineId',
	'sourceSection',
	'terminalStates'
] as const;
const STATE_NODE_KEYS = [
	...NODE_BASE_KEYS,
	'initial',
	'machineNodeId',
	'name',
	'observationStateId',
	'ordinal',
	'terminal'
] as const;
const CROSS_AXIS_NODE_KEYS = [
	...NODE_BASE_KEYS,
	'from',
	'machineName',
	'observationRuleId',
	'reason',
	'to'
] as const;
const EDGE_KEYS = [
	'epistemic',
	'graphId',
	'guard',
	'id',
	'layerId',
	'method',
	'note',
	'observationRecordId',
	'provenanceIds',
	'reason',
	'relationCode',
	'relationKind',
	'semanticSnapshotId',
	'source',
	'sourceLocations',
	'subjectId',
	'target',
	'trigger'
] as const;

const RELATION_CODES: Readonly<
	Record<StateMachineGraphRelationKind, StateMachineGraphRelationCode>
> = {
	CONTAINS_STATE: 'IMPL-JPWB-SM-CONTAINS-STATE-001',
	DECLARES_CROSS_AXIS_RULE: 'IMPL-JPWB-SM-DECLARES-CROSS-AXIS-RULE-001',
	EXPLICITLY_ILLEGAL_TRANSITION: 'IMPL-JPWB-SM-EXPLICITLY-ILLEGAL-TRANSITION-001',
	GUARDED_LEGAL_TRANSITION: 'IMPL-JPWB-SM-GUARDED-LEGAL-TRANSITION-001',
	LEGAL_TRANSITION: 'IMPL-JPWB-SM-LEGAL-TRANSITION-001'
};
const NODE_KINDS = ['CROSS_AXIS_FRONTIER', 'MACHINE', 'STATE'] as const;
const RELATION_KINDS = Object.keys(RELATION_CODES) as StateMachineGraphRelationKind[];
const LIMITATION_KINDS = [
	'COMMAND_PERFORMABILITY_NOT_ANALYZED',
	'CROSS_AXIS_EFFECT_NOT_MODELED',
	'GENERATED_TOPOLOGY_ONLY',
	'GUARD_ENFORCEMENT_NOT_ANALYZED',
	'RELATION_REGISTRY_UNAVAILABLE',
	'SEMANTIC_INPUT_PARTIAL',
	'WHOLE_PROGRAM_REACHABILITY_NOT_ANALYZED'
] as const;
const BASE_LIMITATIONS: readonly StateMachineGraphLimitation[] = [
	{
		kind: 'COMMAND_PERFORMABILITY_NOT_ANALYZED',
		reason: 'Command-handler performability and arrow-command census conclusions remain delegated.'
	},
	{
		kind: 'CROSS_AXIS_EFFECT_NOT_MODELED',
		reason:
			'Cross-axis declarations remain explicit frontiers rather than invented same-axis edges.'
	},
	{
		kind: 'GENERATED_TOPOLOGY_ONLY',
		reason:
			'This projection describes the exact generated transition table, not upstream vocabulary authority.'
	},
	{
		kind: 'GUARD_ENFORCEMENT_NOT_ANALYZED',
		reason: 'Guard text is retained, but runtime guard enforcement is not inferred.'
	},
	{
		kind: 'RELATION_REGISTRY_UNAVAILABLE',
		reason: 'JAN-CSAA-007 has no registered state-machine graph or relation family for these edges.'
	},
	{
		kind: 'WHOLE_PROGRAM_REACHABILITY_NOT_ANALYZED',
		reason: 'This declared topology is not a whole-program behavioral reachability analysis.'
	}
];
const GRAPH_EPISTEMIC = {
	capabilityCoverage: 'PARTIAL',
	conflictState: 'NOT_EVALUATED',
	executionHealth: 'PARTIAL',
	freshness: 'SUBJECT_AND_SNAPSHOT_BOUND',
	inferenceState: 'NONE',
	supportBasis: 'DECLARED_GENERATED_TOPOLOGY'
} as const;

export type StateMachineGraphValidationIssueCode =
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
	| 'OBSERVATION_INVALID'
	| 'POPULATION_BUDGET_EXCEEDED'
	| 'POPULATION_MISMATCH'
	| 'SOURCE_BINDING_MISMATCH'
	| 'UNSUPPORTED_SCHEMA_VERSION'
	| 'VALIDATION_BUDGET_EXHAUSTED';

export interface StateMachineGraphValidationIssue {
	readonly code: StateMachineGraphValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface StateMachineGraphValidationOptions {
	/** Reporting budget only. It never limits the graph population that may be validated. */
	readonly maxIssues?: number;
}

export type StateMachineGraphValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly StateMachineGraphValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

class IssueCollector {
	readonly issues: StateMachineGraphValidationIssue[] = [];
	exhausted = false;
	constructor(readonly maxIssues: number) {}
	add(code: StateMachineGraphValidationIssueCode, path: string, message: string): void {
		if (this.exhausted) return;
		if (this.issues.length >= this.maxIssues) {
			this.exhausted = true;
			return;
		}
		this.issues.push({ code, message, path });
	}
	result(): StateMachineGraphValidationResult {
		if (this.issues.length === 0 && !this.exhausted) return { issues: [], state: 'VALID' };
		return { issues: this.issues, state: this.exhausted ? 'BUDGET_EXHAUSTED' : 'INVALID' };
	}
}

type JsonRecord = Record<string, unknown>;

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	return left > right ? 1 : 0;
}

function same(left: unknown, right: unknown): boolean {
	return canonicalSemanticJson(left) === canonicalSemanticJson(right);
}

function plainRecord(value: unknown): value is JsonRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(
	value: unknown,
	expected: readonly string[],
	path: string,
	issues: IssueCollector
): value is JsonRecord {
	if (!plainRecord(value)) {
		issues.add('INVALID_SHAPE', path, 'Expected a plain, non-Proxy record.');
		return false;
	}
	const own = Reflect.ownKeys(value);
	const actual = own.filter((key): key is string => typeof key === 'string').sort(compareText);
	const wanted = [...expected].sort(compareText);
	let valid = own.length === actual.length && same(actual, wanted);
	for (const key of actual) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			valid = false;
	}
	if (!valid)
		issues.add(
			'INVALID_SHAPE',
			path,
			`Expected exact enumerable data fields ${wanted.join(', ')}.`
		);
	return valid;
}

function wireArray(value: unknown, path: string, issues: IssueCollector): value is unknown[] {
	if (
		!Array.isArray(value) ||
		isProxy(value) ||
		Reflect.getPrototypeOf(value) !== Array.prototype
	) {
		issues.add('INVALID_SHAPE', path, 'Expected a plain, non-Proxy array.');
		return false;
	}
	let valid = true;
	const own = Reflect.ownKeys(value);
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			valid = false;
	}
	if (
		own.length !== value.length + 1 ||
		own.some((key) => typeof key !== 'string' || (key !== 'length' && !/^(0|[1-9]\d*)$/u.test(key)))
	)
		valid = false;
	if (!valid)
		issues.add(
			'INVALID_SHAPE',
			path,
			'Array must be dense and contain no additional or accessor properties.'
		);
	return valid;
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
function oneOf(value: unknown, values: readonly string[]): value is string {
	return typeof value === 'string' && values.includes(value);
}
function stringArray(value: unknown, path: string, issues: IssueCollector): value is string[] {
	if (!wireArray(value, path, issues)) return false;
	const valid = value.every(scalarString);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Array entries must be Unicode scalar strings.');
	return valid;
}

function shapeProvider(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, PROVIDER_KEYS, path, issues)) return false;
	const valid =
		value.api === 'PUBLIC_COMPILER_API' &&
		value.id === 'typescript' &&
		nonemptyString(value.version);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Provider identity is invalid.');
	return valid;
}

function shapeBudgets(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, BUDGET_KEYS, path, issues)) return false;
	const valid = BUDGET_KEYS.every(
		(key) => Number.isSafeInteger(value[key]) && (value[key] as number) >= 1
	);
	if (!valid)
		issues.add(
			'INVALID_SHAPE',
			path,
			'Graph budgets must be caller-supplied positive safe integers.'
		);
	return valid;
}

function shapeEpistemic(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, EPISTEMIC_KEYS, path, issues)) return false;
	const valid =
		value.capabilityCoverage === 'PARTIAL' &&
		value.conflictState === 'NOT_EVALUATED' &&
		oneOf(value.executionHealth, ['SUCCEEDED', 'PARTIAL']) &&
		oneOf(value.freshness, ['SUBJECT_BOUND', 'SUBJECT_AND_SNAPSHOT_BOUND']) &&
		value.inferenceState === 'NONE' &&
		value.supportBasis === 'DECLARED_GENERATED_TOPOLOGY';
	if (!valid) issues.add('INVALID_SHAPE', path, 'State-machine epistemic fields are invalid.');
	return valid;
}

function shapeSource(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, SOURCE_KEYS, path, issues)) return false;
	const valid = SOURCE_KEYS.every((key) => nonemptyString(value[key]));
	if (!valid)
		issues.add(
			'INVALID_SHAPE',
			path,
			'Source selector fields must be nonempty Unicode scalar strings.'
		);
	return valid;
}

function shapeRequest(
	value: unknown,
	issues: IssueCollector
): value is BuildStateMachineGraphRequest {
	if (!exactKeys(value, REQUEST_KEYS, '$request', issues)) return false;
	const valid =
		shapeBudgets(value.budgets, '$request.budgets', issues) &&
		nonemptyString(value.observationId) &&
		nonemptyString(value.operationVersion) &&
		nonemptyString(value.schemaVersion) &&
		nonemptyString(value.semanticSnapshotId) &&
		shapeSource(value.source, '$request.source', issues) &&
		nonemptyString(value.subjectId);
	if (!valid) issues.add('INVALID_SHAPE', '$request', 'Request fields are invalid.');
	if (value.schemaVersion !== STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION)
		issues.add(
			'UNSUPPORTED_SCHEMA_VERSION',
			'$request.schemaVersion',
			'Unsupported state-machine graph request schema version.'
		);
	if (value.operationVersion !== STATE_MACHINE_GRAPH_OPERATION_VERSION)
		issues.add(
			'INVALID_VALUE',
			'$request.operationVersion',
			'Unsupported state-machine graph operation version.'
		);
	return valid;
}

function shapeCoverage(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, COVERAGE_KEYS, path, issues)) return false;
	let valid = typeof value.reconciles === 'boolean';
	for (const key of COVERAGE_KEYS)
		if (key !== 'reconciles') valid = nonnegativeInteger(value[key]) && valid;
	if (!valid) issues.add('INVALID_SHAPE', path, 'Coverage fields have invalid primitive values.');
	return valid;
}

function shapeLimitation(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, LIMITATION_KEYS, path, issues)) return false;
	const valid = oneOf(value.kind, LIMITATION_KINDS) && nonemptyString(value.reason);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Limitation fields are invalid.');
	return valid;
}

function shapeLocation(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, LOCATION_KEYS, path, issues)) return false;
	const valid =
		nonnegativeInteger(value.start) &&
		nonnegativeInteger(value.end) &&
		(value.start as number) <= (value.end as number) &&
		nonemptyString(value.sourceId);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Source location is invalid.');
	return valid;
}

function shapeEndpoint(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, ENDPOINT_KEYS, path, issues)) return false;
	const valid = oneOf(value.kind, NODE_KINDS) && nonemptyString(value.nodeId);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Graph endpoint is invalid.');
	return valid;
}

function shapeIndex(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, INDEX_KEYS, path, issues)) return false;
	const valid =
		nonemptyString(value.nodeId) && stringArray(value.edgeIds, `${path}.edgeIds`, issues);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Index entry is invalid.');
	return valid;
}

/**
 * ⚠ TAKES THE RECORD, NOT `value.kind`, AND READS THE PROPERTY THREE TIMES ON PURPOSE.
 *
 * The ternary chain this replaced read `value.kind` once per arm, and `plainRecord` deliberately
 * ADMITS ACCESSOR PROPERTIES — it rejects only null, arrays, Proxies and foreign prototypes. So a
 * node whose `kind` is a non-idempotent getter is reachable from the public `graph: unknown`
 * parameter, and hoisting the read to a single call changes WHICH key set is selected and therefore
 * which INVALID_SHAPE path and message this validator emits. Reading once is arguably the better
 * design, but it is a DIFFERENT behaviour, and this is a refactor.
 */
function nodeKeysForKind(value: JsonRecord): readonly string[] | null {
	if (value.kind === 'MACHINE') return MACHINE_NODE_KEYS;
	if (value.kind === 'STATE') return STATE_NODE_KEYS;
	if (value.kind === 'CROSS_AXIS_FRONTIER') return CROSS_AXIS_NODE_KEYS;
	return null;
}

function shapeNode(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!plainRecord(value)) {
		issues.add('INVALID_SHAPE', path, 'Expected a graph-node record.');
		return false;
	}
	const keys = nodeKeysForKind(value);
	if (keys === null) {
		issues.add('INVALID_SHAPE', `${path}.kind`, 'Unknown state-machine node kind.');
		return false;
	}
	if (!exactKeys(value, keys, path, issues)) return false;
	let valid =
		shapeEpistemic(value.epistemic, `${path}.epistemic`, issues) &&
		nonemptyString(value.graphId) &&
		nonemptyString(value.id) &&
		nonemptyString(value.layerId) &&
		stringArray(value.provenanceIds, `${path}.provenanceIds`, issues) &&
		nonemptyString(value.semanticSnapshotId) &&
		wireArray(value.sourceLocations, `${path}.sourceLocations`, issues) &&
		value.sourceLocations.every((item, index) =>
			shapeLocation(item, `${path}.sourceLocations[${index}]`, issues)
		) &&
		nonemptyString(value.subjectId);
	if (value.kind === 'MACHINE')
		valid =
			nullableString(value.initialState) &&
			nonemptyString(value.name) &&
			nonemptyString(value.observationMachineId) &&
			nullableString(value.sourceSection) &&
			stringArray(value.terminalStates, `${path}.terminalStates`, issues) &&
			valid;
	else if (value.kind === 'STATE')
		valid =
			typeof value.initial === 'boolean' &&
			nonemptyString(value.machineNodeId) &&
			nonemptyString(value.name) &&
			nonemptyString(value.observationStateId) &&
			nonnegativeInteger(value.ordinal) &&
			typeof value.terminal === 'boolean' &&
			valid;
	else
		valid =
			nonemptyString(value.from) &&
			nonemptyString(value.machineName) &&
			nonemptyString(value.observationRuleId) &&
			nullableString(value.reason) &&
			nonemptyString(value.to) &&
			valid;
	if (!valid) issues.add('INVALID_SHAPE', path, 'Node fields are invalid.');
	return valid;
}

function shapeEdge(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, EDGE_KEYS, path, issues)) return false;
	const valid =
		shapeEpistemic(value.epistemic, `${path}.epistemic`, issues) &&
		nonemptyString(value.graphId) &&
		nullableString(value.guard) &&
		nonemptyString(value.id) &&
		nonemptyString(value.layerId) &&
		value.method === STATE_MACHINE_GRAPH_METHOD &&
		nullableString(value.note) &&
		nonemptyString(value.observationRecordId) &&
		stringArray(value.provenanceIds, `${path}.provenanceIds`, issues) &&
		nullableString(value.reason) &&
		oneOf(value.relationCode, Object.values(RELATION_CODES)) &&
		oneOf(value.relationKind, RELATION_KINDS) &&
		nonemptyString(value.semanticSnapshotId) &&
		shapeEndpoint(value.source, `${path}.source`, issues) &&
		wireArray(value.sourceLocations, `${path}.sourceLocations`, issues) &&
		value.sourceLocations.every((item, index) =>
			shapeLocation(item, `${path}.sourceLocations[${index}]`, issues)
		) &&
		nonemptyString(value.subjectId) &&
		shapeEndpoint(value.target, `${path}.target`, issues) &&
		nullableString(value.trigger);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Edge fields are invalid.');
	return valid;
}

function shapeLayer(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, LAYER_KEYS, path, issues)) return false;
	const valid =
		value.capability === STATE_MACHINE_GRAPH_CAPABILITY &&
		value.capabilityStatus === STATE_MACHINE_GRAPH_CAPABILITY_STATUS &&
		shapeCoverage(value.coverage, `${path}.coverage`, issues) &&
		stringArray(value.edgeIds, `${path}.edgeIds`, issues) &&
		shapeEpistemic(value.epistemic, `${path}.epistemic`, issues) &&
		nonemptyString(value.graphId) &&
		nonemptyString(value.id) &&
		value.kind === 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY' &&
		wireArray(value.limitations, `${path}.limitations`, issues) &&
		value.limitations.every((item, index) =>
			shapeLimitation(item, `${path}.limitations[${index}]`, issues)
		) &&
		value.method === STATE_MACHINE_GRAPH_METHOD &&
		stringArray(value.nodeIds, `${path}.nodeIds`, issues) &&
		value.ordinal === 0 &&
		shapeProvider(value.producer, `${path}.producer`, issues) &&
		stringArray(value.provenanceIds, `${path}.provenanceIds`, issues) &&
		value.scope === STATE_MACHINE_GRAPH_SCOPE &&
		nonemptyString(value.semanticSnapshotId) &&
		nonemptyString(value.subjectId);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Layer fields are invalid.');
	return valid;
}

function shapeGraph(value: unknown, issues: IssueCollector): value is StateMachineGraphSnapshot {
	if (!exactKeys(value, TOP_LEVEL_KEYS, '$', issues)) return false;
	const arrays = [
		['edges', value.edges, shapeEdge],
		['forwardIndex', value.forwardIndex, shapeIndex],
		['layers', value.layers, shapeLayer],
		['limitations', value.limitations, shapeLimitation],
		['nodes', value.nodes, shapeNode],
		['reverseIndex', value.reverseIndex, shapeIndex]
	] as const;
	let valid = true;
	for (const [name, array, shape] of arrays) {
		if (!wireArray(array, `$.${name}`, issues)) valid = false;
		else
			for (const [index, item] of array.entries())
				valid = shape(item, `$.${name}[${index}]`, issues) && valid;
	}
	valid =
		shapeBudgets(value.budgets, '$.budgets', issues) &&
		value.canonicalProfile === STATE_MACHINE_GRAPH_CANONICAL_PROFILE &&
		value.capability === STATE_MACHINE_GRAPH_CAPABILITY &&
		value.capabilityStatus === STATE_MACHINE_GRAPH_CAPABILITY_STATUS &&
		value.closure === 'OPEN' &&
		typeof value.contentDigest === 'string' &&
		SHA256.test(value.contentDigest) &&
		shapeCoverage(value.coverage, '$.coverage', issues) &&
		shapeEpistemic(value.epistemic, '$.epistemic', issues) &&
		value.fullJanCsaa007Conformance === FULL_JAN_CSAA_007_CONFORMANCE &&
		value.fullJanCsaa008Conformance === FULL_JAN_CSAA_008_CONFORMANCE &&
		typeof value.graphInputDigest === 'string' &&
		SHA256.test(value.graphInputDigest) &&
		value.graphKind === 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY' &&
		value.health === 'PARTIAL' &&
		nonemptyString(value.id) &&
		value.method === STATE_MACHINE_GRAPH_METHOD &&
		nonemptyString(value.observationId) &&
		value.operationVersion === STATE_MACHINE_GRAPH_OPERATION_VERSION &&
		shapeProvider(value.producer, '$.producer', issues) &&
		value.registryStatus === STATE_MACHINE_GRAPH_REGISTRY_STATUS &&
		value.schemaVersion === STATE_MACHINE_GRAPH_SCHEMA_VERSION &&
		value.scope === STATE_MACHINE_GRAPH_SCOPE &&
		nonemptyString(value.semanticExtractionVersion) &&
		nonemptyString(value.semanticSchemaVersion) &&
		nonemptyString(value.semanticSnapshotId) &&
		shapeSource(value.source, '$.source', issues) &&
		nonemptyString(value.subjectId) &&
		value.verifierAuthority === STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY &&
		valid;
	if (!valid)
		issues.add(
			'INVALID_SHAPE',
			'$',
			'Graph fields have invalid primitive values or nested shapes.'
		);
	if (value.schemaVersion !== STATE_MACHINE_GRAPH_SCHEMA_VERSION)
		issues.add(
			'UNSUPPORTED_SCHEMA_VERSION',
			'$.schemaVersion',
			'Unsupported state-machine graph schema version.'
		);
	return valid;
}

function sortedUnique(values: readonly string[], path: string, issues: IssueCollector): void {
	for (let index = 1; index < values.length; index += 1) {
		const order = compareText(values[index - 1]!, values[index]!);
		if (order === 0) issues.add('DUPLICATE_ID', `${path}[${index}]`, 'Identity must be unique.');
		else if (order > 0)
			issues.add('NONCANONICAL_ORDER', path, 'Identity array must be sorted lexicographically.');
	}
}

function indexes(
	nodes: readonly StateMachineGraphNode[],
	edges: readonly StateMachineGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): readonly StateMachineGraphIndexEntry[] {
	const byNode = new Map(nodes.map((node) => [node.id, [] as StateMachineGraphEdge['id'][]]));
	for (const edge of edges) {
		const nodeId = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		byNode.get(nodeId)?.push(edge.id);
	}
	const entries: StateMachineGraphIndexEntry[] = [];
	for (const [nodeId, edgeIds] of byNode.entries()) {
		edgeIds.sort(compareText);
		entries.push({ edgeIds, nodeId });
	}
	entries.sort((left, right) => compareText(left.nodeId, right.nodeId));
	return entries;
}

function coverage(observation: StateMachineTopologyObservation): StateMachineGraphCoverage {
	return {
		crossAxisRuleEdges: observation.crossAxisRules.length,
		expectedCrossAxisRules: observation.crossAxisRules.length,
		expectedExplicitlyIllegalTransitions: observation.explicitlyIllegalTransitions.length,
		expectedGuardedTransitions: observation.guardedTransitions.length,
		expectedLegalTransitions:
			observation.legalTransitions.length -
			new Set(observation.guardedTransitions.map((item) => item.legalTransitionId)).size,
		expectedMachines: observation.machines.length,
		expectedStates: observation.states.length,
		explicitlyIllegalTransitionEdges: observation.explicitlyIllegalTransitions.length,
		guardedLegalTransitionEdges: observation.guardedTransitions.length,
		legalTransitionEdges:
			observation.legalTransitions.length -
			new Set(observation.guardedTransitions.map((item) => item.legalTransitionId)).size,
		machineNodes: observation.machines.length,
		reconciles: true,
		stateContainmentEdges: observation.states.length,
		stateNodes: observation.states.length
	};
}

function usableObservation(
	observation: unknown,
	issues: IssueCollector
): observation is StateMachineTopologyObservation {
	if (!plainRecord(observation)) {
		issues.add(
			'OBSERVATION_INVALID',
			'$observation',
			'Observation must be a plain, non-Proxy record.'
		);
		return false;
	}
	const populationNames = [
		'crossAxisRules',
		'explicitlyIllegalTransitions',
		'guardedTransitions',
		'legalTransitions',
		'machines',
		'states'
	] as const;
	let valid = populationNames.every((name) =>
		wireArray(observation[name], `$observation.${name}`, issues)
	);
	valid =
		nonemptyString(observation.id) &&
		nonemptyString(observation.subjectId) &&
		plainRecord(observation.artifact) &&
		valid;
	if (!valid)
		issues.add('OBSERVATION_INVALID', '$observation', 'Observation is not structurally usable.');
	if (valid) {
		const typed = observation as unknown as StateMachineTopologyObservation;
		if (
			typed.schemaVersion !== STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION ||
			typed.operationVersion !== STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION ||
			typed.method !== STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD ||
			typed.scope !== STATE_MACHINE_GRAPH_SCOPE ||
			!same(typed.epistemic, {
				capabilityCoverage: 'PARTIAL',
				conflictState: 'NOT_EVALUATED',
				executionHealth: 'SUCCEEDED',
				freshness: 'SUBJECT_BOUND',
				inferenceState: 'NONE',
				supportBasis: 'DECLARED_GENERATED_TOPOLOGY'
			}) ||
			typed.fullJanCsaa007Conformance !== FULL_JAN_CSAA_007_CONFORMANCE ||
			typed.fullJanCsaa008Conformance !== FULL_JAN_CSAA_008_CONFORMANCE ||
			typed.registryStatus !== STATE_MACHINE_GRAPH_REGISTRY_STATUS ||
			typed.verifierAuthority !== STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY ||
			typed.contentDigest !== stateMachineTopologyObservationContentDigest(typed)
		) {
			issues.add(
				'OBSERVATION_INVALID',
				'$observation',
				'Observation constants or content digest are invalid.'
			);
			valid = false;
		}
	}
	return valid;
}

function expectedProjection(
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation,
	graphInputDigest: string
): Omit<StateMachineGraphSnapshot, 'contentDigest'> {
	const source = snapshot.sources.find((record) => record.id === request.source.semanticSourceId)!;
	const provenanceIds = [source.provenanceId, source.syntaxProvenanceId]
		.filter((id): id is SemanticProvenanceId => id !== null)
		.sort(compareText);
	const id = stateMachineGraphId({
		canonicalProfile: STATE_MACHINE_GRAPH_CANONICAL_PROFILE,
		graphInputDigest,
		graphKind: 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY',
		method: STATE_MACHINE_GRAPH_METHOD,
		observationId: observation.id,
		operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_GRAPH_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	});
	const layerId = stateMachineGraphLayerId(id, 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY', 0);
	const location = (span: { readonly end: number; readonly start: number }) => [
		{ end: span.end, sourceId: source.id, start: span.start }
	];
	const nodes: StateMachineGraphNode[] = observation.machines.map((machine) => ({
		epistemic: GRAPH_EPISTEMIC,
		graphId: id,
		id: stateMachineGraphMachineNodeId(id, machine.id),
		initialState: machine.initialState,
		kind: 'MACHINE',
		layerId,
		name: machine.name,
		observationMachineId: machine.id,
		provenanceIds,
		semanticSnapshotId: snapshot.id,
		sourceLocations: location(machine.span),
		sourceSection: machine.sourceSection,
		subjectId: snapshot.subjectId,
		terminalStates: machine.terminalStates
	}));
	const machineByObservationId = new Map(
		nodes
			.filter(
				(node): node is Extract<StateMachineGraphNode, { kind: 'MACHINE' }> =>
					node.kind === 'MACHINE'
			)
			.map((node) => [node.observationMachineId, node])
	);
	for (const state of observation.states)
		nodes.push({
			epistemic: GRAPH_EPISTEMIC,
			graphId: id,
			id: stateMachineGraphStateNodeId(id, state.id),
			initial: state.initial,
			kind: 'STATE',
			layerId,
			machineNodeId: machineByObservationId.get(state.machineId)!.id,
			name: state.name,
			observationStateId: state.id,
			ordinal: state.ordinal,
			provenanceIds,
			semanticSnapshotId: snapshot.id,
			sourceLocations: location(state.span),
			subjectId: snapshot.subjectId,
			terminal: state.terminal
		});
	for (const rule of observation.crossAxisRules)
		nodes.push({
			epistemic: GRAPH_EPISTEMIC,
			from: rule.from,
			graphId: id,
			id: stateMachineGraphCrossAxisFrontierNodeId(id, rule.id),
			kind: 'CROSS_AXIS_FRONTIER',
			layerId,
			machineName: rule.machineName,
			observationRuleId: rule.id,
			provenanceIds,
			reason: rule.reason,
			semanticSnapshotId: snapshot.id,
			sourceLocations: location(rule.span),
			subjectId: snapshot.subjectId,
			to: rule.to
		});
	nodes.sort((left, right) => compareText(left.id, right.id));
	const stateByObservationId = new Map(
		nodes
			.filter(
				(node): node is Extract<StateMachineGraphNode, { kind: 'STATE' }> => node.kind === 'STATE'
			)
			.map((node) => [node.observationStateId, node])
	);
	const frontierByRuleId = new Map(
		nodes
			.filter(
				(node): node is Extract<StateMachineGraphNode, { kind: 'CROSS_AXIS_FRONTIER' }> =>
					node.kind === 'CROSS_AXIS_FRONTIER'
			)
			.map((node) => [node.observationRuleId, node])
	);
	const edges: StateMachineGraphEdge[] = [];
	const addEdge = (
		relationKind: StateMachineGraphRelationKind,
		observationRecordId: string,
		sourceEndpoint: StateMachineGraphEdge['source'],
		targetEndpoint: StateMachineGraphEdge['target'],
		spans: readonly { readonly end: number; readonly start: number }[],
		fields: Pick<StateMachineGraphEdge, 'guard' | 'note' | 'reason' | 'trigger'>
	): void => {
		const base = {
			...fields,
			epistemic: GRAPH_EPISTEMIC,
			graphId: id,
			layerId,
			method: STATE_MACHINE_GRAPH_METHOD,
			observationRecordId,
			provenanceIds,
			relationCode: RELATION_CODES[relationKind],
			relationKind,
			semanticSnapshotId: snapshot.id,
			source: sourceEndpoint,
			sourceLocations: spans.flatMap(location),
			subjectId: snapshot.subjectId,
			target: targetEndpoint
		};
		edges.push({
			...base,
			id: stateMachineGraphEdgeId({
				graph: id,
				observationRecordId,
				relationKind,
				source: sourceEndpoint,
				target: targetEndpoint
			})
		});
	};
	for (const state of observation.states) {
		const machine = machineByObservationId.get(state.machineId)!;
		const target = stateByObservationId.get(state.id)!;
		addEdge(
			'CONTAINS_STATE',
			state.id,
			{ kind: 'MACHINE', nodeId: machine.id },
			{ kind: 'STATE', nodeId: target.id },
			[state.span],
			{ guard: null, note: null, reason: null, trigger: null }
		);
	}
	const guardedByLegalId = new Map<
		StateMachineTopologyObservation['legalTransitions'][number]['id'],
		StateMachineTopologyObservation['guardedTransitions'][number][]
	>();
	for (const guarded of observation.guardedTransitions) {
		const records = guardedByLegalId.get(guarded.legalTransitionId) ?? [];
		records.push(guarded);
		guardedByLegalId.set(guarded.legalTransitionId, records);
	}
	for (const transition of observation.legalTransitions) {
		const guardedRecords = guardedByLegalId.get(transition.id) ?? [];
		const sourceEndpoint = {
			kind: 'STATE' as const,
			nodeId: stateByObservationId.get(transition.fromStateId)!.id
		};
		const targetEndpoint = {
			kind: 'STATE' as const,
			nodeId: stateByObservationId.get(transition.toStateId)!.id
		};
		if (guardedRecords.length === 0)
			addEdge(
				'LEGAL_TRANSITION',
				transition.id,
				sourceEndpoint,
				targetEndpoint,
				[transition.span],
				{
					guard: transition.guard,
					note: transition.note,
					reason: null,
					trigger: transition.trigger
				}
			);
		else
			for (const guarded of guardedRecords)
				addEdge(
					'GUARDED_LEGAL_TRANSITION',
					guarded.id,
					sourceEndpoint,
					targetEndpoint,
					[transition.span, guarded.span],
					{
						guard: transition.guard,
						note: transition.note,
						reason: guarded.reason,
						trigger: transition.trigger
					}
				);
	}
	for (const transition of observation.explicitlyIllegalTransitions)
		addEdge(
			'EXPLICITLY_ILLEGAL_TRANSITION',
			transition.id,
			{ kind: 'STATE', nodeId: stateByObservationId.get(transition.fromStateId)!.id },
			{ kind: 'STATE', nodeId: stateByObservationId.get(transition.toStateId)!.id },
			[transition.span],
			{ guard: null, note: null, reason: transition.reason, trigger: null }
		);
	for (const rule of observation.crossAxisRules) {
		const machine = machineByObservationId.get(rule.machineId)!;
		const frontier = frontierByRuleId.get(rule.id)!;
		addEdge(
			'DECLARES_CROSS_AXIS_RULE',
			rule.id,
			{ kind: 'MACHINE', nodeId: machine.id },
			{ kind: 'CROSS_AXIS_FRONTIER', nodeId: frontier.id },
			[rule.span],
			{ guard: null, note: null, reason: rule.reason, trigger: null }
		);
	}
	edges.sort((left, right) => compareText(left.id, right.id));
	const limitations =
		snapshot.health === 'PARTIAL'
			? [
					...BASE_LIMITATIONS,
					{
						kind: 'SEMANTIC_INPUT_PARTIAL' as const,
						reason: 'The selected semantic snapshot is partial.'
					}
				]
			: [...BASE_LIMITATIONS];
	const graphCoverage = coverage(observation);
	const layer = {
		capability: STATE_MACHINE_GRAPH_CAPABILITY,
		capabilityStatus: STATE_MACHINE_GRAPH_CAPABILITY_STATUS,
		coverage: graphCoverage,
		edgeIds: edges.map((edge) => edge.id),
		epistemic: GRAPH_EPISTEMIC,
		graphId: id,
		id: layerId,
		kind: 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY' as const,
		limitations,
		method: STATE_MACHINE_GRAPH_METHOD,
		nodeIds: nodes.map((node) => node.id),
		ordinal: 0 as const,
		producer: snapshot.provider,
		provenanceIds,
		scope: STATE_MACHINE_GRAPH_SCOPE,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	};
	return {
		budgets: request.budgets,
		canonicalProfile: STATE_MACHINE_GRAPH_CANONICAL_PROFILE,
		capability: STATE_MACHINE_GRAPH_CAPABILITY,
		capabilityStatus: STATE_MACHINE_GRAPH_CAPABILITY_STATUS,
		coverage: graphCoverage,
		edges,
		closure: 'OPEN',
		epistemic: GRAPH_EPISTEMIC,
		forwardIndex: indexes(nodes, edges, 'FORWARD'),
		fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance: FULL_JAN_CSAA_008_CONFORMANCE,
		graphInputDigest,
		graphKind: 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY',
		health: 'PARTIAL',
		id,
		layers: [layer],
		limitations,
		method: STATE_MACHINE_GRAPH_METHOD,
		nodes,
		observationId: observation.id,
		operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
		producer: snapshot.provider,
		registryStatus: STATE_MACHINE_GRAPH_REGISTRY_STATUS,
		reverseIndex: indexes(nodes, edges, 'REVERSE'),
		schemaVersion: STATE_MACHINE_GRAPH_SCHEMA_VERSION,
		scope: STATE_MACHINE_GRAPH_SCOPE,
		semanticExtractionVersion: snapshot.extractionVersion,
		semanticSchemaVersion: snapshot.schemaVersion,
		semanticSnapshotId: snapshot.id,
		source: request.source,
		subjectId: snapshot.subjectId,
		verifierAuthority: STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY
	};
}

type SemanticSourceRecordOf = StaticSemanticSnapshot['sources'][number];
type SemanticProvenanceRecordOf = StaticSemanticSnapshot['provenances'][number];

function checkIdentityBindings(
	graph: StateMachineGraphSnapshot,
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation,
	issues: IssueCollector
): void {
	if (request.semanticSnapshotId !== snapshot.id || graph.semanticSnapshotId !== snapshot.id)
		issues.add(
			'IDENTITY_MISMATCH',
			'$.semanticSnapshotId',
			'Request, graph, and semantic snapshot identities differ.'
		);
	if (request.observationId !== observation.id || graph.observationId !== observation.id)
		issues.add(
			'IDENTITY_MISMATCH',
			'$.observationId',
			'Request, graph, and observation identities differ.'
		);
	if (
		request.subjectId !== snapshot.subjectId ||
		observation.subjectId !== snapshot.subjectId ||
		graph.subjectId !== snapshot.subjectId
	)
		issues.add(
			'IDENTITY_MISMATCH',
			'$.subjectId',
			'Request, observation, graph, and semantic snapshot subjects differ.'
		);
}

function checkRequestBindings(
	graph: StateMachineGraphSnapshot,
	request: BuildStateMachineGraphRequest,
	issues: IssueCollector
): void {
	if (!same(graph.source, request.source))
		issues.add(
			'SOURCE_BINDING_MISMATCH',
			'$.source',
			'Graph source selector differs from the request.'
		);
	if (!same(graph.budgets, request.budgets))
		issues.add(
			'GRAPH_INPUT_MISMATCH',
			'$.budgets',
			'Graph budgets must exactly retain the caller-supplied operation policy.'
		);
	if (graph.nodes.length > request.budgets.maxNodes)
		issues.add(
			'POPULATION_BUDGET_EXCEEDED',
			'$.nodes',
			'Node population exceeds the caller-supplied operation budget.'
		);
	if (graph.edges.length > request.budgets.maxEdges)
		issues.add(
			'POPULATION_BUDGET_EXCEEDED',
			'$.edges',
			'Edge population exceeds the caller-supplied operation budget.'
		);
	if (
		!same(graph.epistemic, GRAPH_EPISTEMIC) ||
		graph.closure !== 'OPEN' ||
		graph.scope !== STATE_MACHINE_GRAPH_SCOPE
	)
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			'$',
			'Graph must retain exact partial epistemic state, generated-runtime scope, and open closure.'
		);
}

function checkSourceBinding(
	graph: StateMachineGraphSnapshot,
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation,
	source: SemanticSourceRecordOf,
	issues: IssueCollector
): void {
	if (
		source.logicalPath !== request.source.logicalPath ||
		source.programId !== request.source.programId ||
		source.projectId !== request.source.projectId ||
		source.logicalPath !== observation.artifact.path ||
		source.bytes !== observation.artifact.bytes ||
		source.contentSha256 !== observation.artifact.sha256 ||
		source.origin !== 'GENERATED'
	)
		issues.add(
			'SOURCE_BINDING_MISMATCH',
			'$request.source',
			'Request, observation artifact, and generated semantic source do not bind exactly.'
		);
	if (!same(observation.producer, snapshot.provider) || !same(graph.producer, snapshot.provider))
		issues.add(
			'SOURCE_BINDING_MISMATCH',
			'$.producer',
			'Observation and graph producers must equal the semantic provider.'
		);
	for (const capability of ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'] as const) {
		const records = snapshot.capabilities.filter((item) => item.capability === capability);
		if (records.length !== 1 || records[0]?.state === 'UNSUPPORTED')
			issues.add(
				'SOURCE_BINDING_MISMATCH',
				'$semanticSnapshot.capabilities',
				`${capability} must occur exactly once and be available.`
			);
	}
}

function provenanceRecordBinds(
	record: SemanticProvenanceRecordOf | undefined,
	snapshot: StaticSemanticSnapshot,
	source: SemanticSourceRecordOf
): boolean {
	if (record === undefined) return false;
	return (
		record.snapshotId === snapshot.id &&
		record.subjectId === snapshot.subjectId &&
		record.sourceId === source.id &&
		record.projectId === source.projectId &&
		record.extractionVersion === snapshot.extractionVersion &&
		same(record.provider, snapshot.provider)
	);
}

function checkProvenanceBindings(
	provenanceIds: readonly SemanticProvenanceId[],
	snapshot: StaticSemanticSnapshot,
	source: SemanticSourceRecordOf,
	issues: IssueCollector
): void {
	for (const provenanceId of provenanceIds) {
		const records = snapshot.provenances.filter((record) => record.id === provenanceId);
		if (records.length !== 1 || !provenanceRecordBinds(records[0], snapshot, source))
			issues.add(
				'SOURCE_BINDING_MISMATCH',
				'$semanticSnapshot.provenances',
				`Selected provenance ${provenanceId} is absent or not owned by the selected source.`
			);
	}
}

function resolveGraphInputDigest(
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation,
	issues: IssueCollector
): string | undefined {
	try {
		return stateMachineGraphInputDigest(request, snapshot, observation);
	} catch (error) {
		issues.add(
			'GRAPH_INPUT_MISMATCH',
			'$.graphInputDigest',
			error instanceof Error ? error.message : 'Graph-input digest failed closed.'
		);
		return undefined;
	}
}

function resolveExpectedProjection(
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation,
	graphInputDigest: string,
	issues: IssueCollector
): Omit<StateMachineGraphSnapshot, 'contentDigest'> | undefined {
	try {
		return expectedProjection(request, snapshot, observation, graphInputDigest);
	} catch (error) {
		issues.add(
			'OBSERVATION_INVALID',
			'$observation',
			error instanceof Error
				? `Observation cannot project canonically: ${error.message}`
				: 'Observation cannot project canonically.'
		);
		return undefined;
	}
}

function checkProjectionEquality(
	graph: StateMachineGraphSnapshot,
	expected: Omit<StateMachineGraphSnapshot, 'contentDigest'>,
	issues: IssueCollector
): void {
	if (graph.id !== expected.id)
		issues.add(
			'IDENTITY_MISMATCH',
			'$.id',
			'Graph identity does not match its complete input preimage.'
		);
	if (!same(graph.nodes, expected.nodes))
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			'Nodes do not exactly equal the canonical observation-derived machine, state, and cross-axis population.'
		);
	if (!same(graph.edges, expected.edges))
		issues.add(
			'POPULATION_MISMATCH',
			'$.edges',
			'Edges, typed endpoints, identities, or transition metadata do not exactly equal the observation-derived population.'
		);
	if (!same(graph.coverage, expected.coverage))
		issues.add(
			'POPULATION_MISMATCH',
			'$.coverage',
			'Coverage does not reconcile the complete observation-derived population.'
		);
	if (!same(graph.limitations, expected.limitations))
		issues.add(
			'LIMITATION_MISMATCH',
			'$.limitations',
			'Limitations do not exactly state the bounded producer authority.'
		);
	if (!same(graph.layers, expected.layers))
		issues.add(
			'POPULATION_MISMATCH',
			'$.layers',
			'Layer bindings, manifests, provenance, coverage, or limitations differ from the canonical projection.'
		);
	if (!same(graph.forwardIndex, expected.forwardIndex))
		issues.add(
			'POPULATION_MISMATCH',
			'$.forwardIndex',
			'Forward index does not exactly reconcile all nodes and outgoing edges.'
		);
	if (!same(graph.reverseIndex, expected.reverseIndex))
		issues.add(
			'POPULATION_MISMATCH',
			'$.reverseIndex',
			'Reverse index does not exactly reconcile all nodes and incoming edges.'
		);
}

function checkConformanceClaims(graph: StateMachineGraphSnapshot, issues: IssueCollector): void {
	if (
		graph.fullJanCsaa007Conformance !== FULL_JAN_CSAA_007_CONFORMANCE ||
		graph.fullJanCsaa008Conformance !== FULL_JAN_CSAA_008_CONFORMANCE ||
		graph.registryStatus !== STATE_MACHINE_GRAPH_REGISTRY_STATUS ||
		graph.verifierAuthority !== STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY ||
		graph.capabilityStatus !== 'PARTIAL' ||
		graph.health !== 'PARTIAL'
	)
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			'$',
			'Implementation-local state-machine projection must remain PARTIAL, unregistered, delegated, and NOT_CLAIMED for full conformance.'
		);
}

function checkIdentityUniqueness(graph: StateMachineGraphSnapshot, issues: IssueCollector): void {
	const nodeIds = graph.nodes.map((node) => node.id);
	const edgeIds = graph.edges.map((edge) => edge.id);
	sortedUnique(nodeIds, '$.nodes', issues);
	sortedUnique(edgeIds, '$.edges', issues);
	if (new Set(nodeIds).size !== nodeIds.length || new Set(edgeIds).size !== edgeIds.length)
		issues.add('DUPLICATE_ID', '$', 'Graph populations contain duplicate identities.');
}

function checkEdgeBinding(
	edge: StateMachineGraphEdge,
	index: number,
	nodeById: ReadonlyMap<StateMachineGraphNode['id'], StateMachineGraphNode>,
	graphId: StateMachineGraphSnapshot['id'],
	provenanceIds: readonly SemanticProvenanceId[],
	issues: IssueCollector
): void {
	const sourceNode = nodeById.get(edge.source.nodeId);
	const targetNode = nodeById.get(edge.target.nodeId);
	if (sourceNode === undefined || targetNode === undefined)
		issues.add(
			'DANGLING_REFERENCE',
			`$.edges[${index}]`,
			'Edge endpoint references an absent node.'
		);
	else if (sourceNode.kind !== edge.source.kind || targetNode.kind !== edge.target.kind)
		issues.add(
			'DANGLING_REFERENCE',
			`$.edges[${index}]`,
			'Edge endpoint kind differs from its referenced node.'
		);
	if (edge.relationCode !== RELATION_CODES[edge.relationKind])
		issues.add(
			'INVALID_VALUE',
			`$.edges[${index}].relationCode`,
			'Relation code does not match the relation kind.'
		);
	if (
		edge.id !==
		stateMachineGraphEdgeId({
			graph: graphId,
			observationRecordId: edge.observationRecordId,
			relationKind: edge.relationKind,
			source: edge.source,
			target: edge.target
		})
	)
		issues.add('IDENTITY_MISMATCH', `$.edges[${index}].id`, 'Edge identity mismatch.');
	if (!same(edge.provenanceIds, provenanceIds))
		issues.add(
			'SOURCE_BINDING_MISMATCH',
			`$.edges[${index}].provenanceIds`,
			'Edge provenance does not equal selected source provenance.'
		);
}

function checkEdgeBindings(
	graph: StateMachineGraphSnapshot,
	provenanceIds: readonly SemanticProvenanceId[],
	issues: IssueCollector
): void {
	const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
	for (const [index, edge] of graph.edges.entries())
		checkEdgeBinding(edge, index, nodeById, graph.id, provenanceIds, issues);
}

function checkNodeProvenance(
	graph: StateMachineGraphSnapshot,
	provenanceIds: readonly SemanticProvenanceId[],
	issues: IssueCollector
): void {
	for (const [index, node] of graph.nodes.entries()) {
		if (!same(node.provenanceIds, provenanceIds))
			issues.add(
				'SOURCE_BINDING_MISMATCH',
				`$.nodes[${index}].provenanceIds`,
				'Node provenance does not equal selected source provenance.'
			);
	}
}

function checkContentDigest(graph: StateMachineGraphSnapshot, issues: IssueCollector): void {
	try {
		if (graph.contentDigest !== stateMachineGraphContentDigest(graph))
			issues.add(
				'CONTENT_DIGEST_MISMATCH',
				'$.contentDigest',
				'Content digest does not bind the exact finalized state-machine graph.'
			);
	} catch (error) {
		issues.add(
			'CONTENT_DIGEST_MISMATCH',
			'$.contentDigest',
			error instanceof Error ? error.message : 'Graph content digest failed closed.'
		);
	}
}

function validateSemantics(
	graph: StateMachineGraphSnapshot,
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation,
	issues: IssueCollector
): void {
	checkIdentityBindings(graph, request, snapshot, observation, issues);
	checkRequestBindings(graph, request, issues);
	const selected = snapshot.sources.filter(
		(source) => source.id === request.source.semanticSourceId
	);
	if (selected.length !== 1) {
		issues.add(
			'SOURCE_BINDING_MISMATCH',
			'$request.source.semanticSourceId',
			'Selected semantic source must occur exactly once.'
		);
		return;
	}
	const source = selected[0]!;
	checkSourceBinding(graph, request, snapshot, observation, source, issues);
	const provenanceIds = [source.provenanceId, source.syntaxProvenanceId]
		.filter((id): id is SemanticProvenanceId => id !== null)
		.sort(compareText);
	checkProvenanceBindings(provenanceIds, snapshot, source, issues);
	const inputDigest = resolveGraphInputDigest(request, snapshot, observation, issues);
	if (inputDigest === undefined) return;
	if (graph.graphInputDigest !== inputDigest)
		issues.add(
			'GRAPH_INPUT_MISMATCH',
			'$.graphInputDigest',
			'Graph input digest does not bind the request, snapshot, observation, source, and provenance identities.'
		);
	const expected = resolveExpectedProjection(request, snapshot, observation, inputDigest, issues);
	if (expected === undefined) return;
	checkProjectionEquality(graph, expected, issues);
	checkConformanceClaims(graph, issues);
	checkIdentityUniqueness(graph, issues);
	checkEdgeBindings(graph, provenanceIds, issues);
	checkNodeProvenance(graph, provenanceIds, issues);
	checkContentDigest(graph, issues);
}

function validate(
	value: unknown,
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot,
	observationValue: unknown,
	options: StateMachineGraphValidationOptions
): StateMachineGraphValidationResult {
	const maxIssues = options.maxIssues ?? DEFAULT_MAX_ISSUES;
	if (!Number.isSafeInteger(maxIssues) || maxIssues < 1 || maxIssues > 100_000)
		return {
			issues: [
				{
					code: 'INVALID_VALUE',
					message:
						'maxIssues must be a positive safe integer no greater than 100000; it controls report count only.',
					path: '$validationOptions.maxIssues'
				}
			],
			state: 'INVALID'
		};
	const issues = new IssueCollector(maxIssues);
	try {
		const requestValid = shapeRequest(requestValue, issues);
		const observationValidation = validateStateMachineTopologyObservation(observationValue);
		for (const issue of observationValidation.issues)
			issues.add(
				'OBSERVATION_INVALID',
				issue.path === '$' ? '$observation' : `$observation${issue.path.slice(1)}`,
				`Observation validation ${issue.code}: ${issue.message}`
			);
		const observationValid =
			observationValidation.state === 'VALID' && usableObservation(observationValue, issues);
		const graphValid = shapeGraph(value, issues);
		if (requestValid && observationValid && graphValid)
			validateSemantics(value, requestValue, snapshot, observationValue, issues);
	} catch (error) {
		issues.add(
			'INVALID_SHAPE',
			'$',
			error instanceof Error
				? `State-machine graph validation failed closed: ${error.message}`
				: 'State-machine graph validation failed closed.'
		);
	}
	return issues.result();
}

export function validateStateMachineGraph(
	graph: unknown,
	request: unknown,
	snapshot: StaticSemanticSnapshot,
	observation: unknown,
	options: StateMachineGraphValidationOptions = {}
): StateMachineGraphValidationResult {
	return validate(graph, request, snapshot, observation, options);
}

/** Producer-facing entry point; it preserves the same fail-closed public invariants. */
export function validateConstructedStateMachineGraph(
	graph: unknown,
	request: unknown,
	snapshot: StaticSemanticSnapshot,
	observation: unknown,
	options: StateMachineGraphValidationOptions = {}
): StateMachineGraphValidationResult {
	return validate(graph, request, snapshot, observation, options);
}
