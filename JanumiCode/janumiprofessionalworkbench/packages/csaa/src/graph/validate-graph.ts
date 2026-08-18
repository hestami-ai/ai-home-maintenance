import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	type SemanticModuleOccurrenceKind,
	type SemanticModuleResolutionRecord,
	type SemanticProvenanceId,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	MODULE_DEPENDENCY_GRAPH_CANONICAL_PROFILE,
	MODULE_DEPENDENCY_GRAPH_METHOD,
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION,
	type ModuleDependencyGraphCoverage,
	type ModuleDependencyGraphEdge,
	type ModuleDependencyGraphEpistemicState,
	type ModuleDependencyGraphIndexEntry,
	type ModuleDependencyGraphLimitation,
	type ModuleDependencyGraphNode,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import {
	canonicalSemanticJson,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { assertCanonicalRelativePath } from '../subject/paths.js';
import {
	moduleDependencyGraphEdgeId,
	moduleDependencyGraphId,
	moduleDependencyGraphLayerId,
	moduleDependencyGraphResolutionTargetNodeId,
	moduleDependencyGraphSourceNodeId
} from './ids.js';
import { moduleDependencyGraphContentDigest } from './module-dependency-content.js';
import { moduleDependencyGraphInputDigest } from './module-dependency-input.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const DEFAULT_MAX_ISSUES = 1_000;

const RELATION_KIND_BY_OCCURRENCE = {
	DYNAMIC_IMPORT: 'DYNAMIC_IMPORT_OCCURRENCE',
	EXPORT: 'EXPORT_OCCURRENCE',
	IMPORT: 'IMPORT_OCCURRENCE',
	IMPORT_EQUALS: 'IMPORT_EQUALS_OCCURRENCE',
	IMPORT_TYPE: 'IMPORT_TYPE_OCCURRENCE'
} as const satisfies Readonly<Record<SemanticModuleOccurrenceKind, string>>;

const TOP_LEVEL_KEYS = [
	'canonicalProfile',
	'contentDigest',
	'coverage',
	'edges',
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
	'reverseIndex',
	'schemaVersion',
	'semanticExtractionVersion',
	'semanticSchemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;

const COVERAGE_KEYS = [
	'closure',
	'expectedModuleResolutions',
	'expectedSources',
	'graphNativeTargets',
	'reconciles',
	'representedModuleResolutions',
	'representedSources',
	'resolvedAmbientTargets',
	'resolvedExternalTargets',
	'resolvedSourceTargets',
	'unresolvedTargets',
	'unsupportedTargets'
] as const;

const LIMITATION_KEYS = [
	'closureEffect',
	'kind',
	'moduleResolutionId',
	'reason',
	'sourceId'
] as const;

const LAYER_KEYS = [
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
	'provenanceIds',
	'producer',
	'semanticSnapshotId',
	'subjectId'
] as const;

const SOURCE_NODE_KEYS = [
	'analysisDisposition',
	'epistemic',
	'graphId',
	'id',
	'kind',
	'layerId',
	'logicalPath',
	'programId',
	'projectId',
	'provenanceIds',
	'semanticSnapshotId',
	'semanticSourceId',
	'sourceLocations',
	'subjectId'
] as const;

const RESOLUTION_TARGET_NODE_KEYS = [
	'epistemic',
	'graphId',
	'id',
	'kind',
	'layerId',
	'moduleResolutionId',
	'moduleSymbolId',
	'provenanceIds',
	'resolutionState',
	'semanticSnapshotId',
	'sourceLocations',
	'specifier',
	'specifierState',
	'subjectId'
] as const;

const EDGE_KEYS = [
	'epistemic',
	'graphId',
	'id',
	'layerId',
	'method',
	'moduleResolutionId',
	'occurrenceKind',
	'occurrenceNodeId',
	'provenanceIds',
	'relationKind',
	'resolutionState',
	'semanticSnapshotId',
	'source',
	'sourceLocations',
	'specifier',
	'specifierState',
	'subjectId',
	'target',
	'typeOnly'
] as const;

const INDEX_ENTRY_KEYS = ['edgeIds', 'nodeId'] as const;
const ENDPOINT_KEYS = ['kind', 'nodeId'] as const;
const PROVIDER_KEYS = ['api', 'id', 'version'] as const;
const SOURCE_LOCATION_KEYS = ['end', 'sourceId', 'start'] as const;

export type ModuleDependencyGraphValidationIssueCode =
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
	| 'POPULATION_MISMATCH'
	| 'UNSUPPORTED_SCHEMA_VERSION'
	| 'VALIDATION_BUDGET_EXHAUSTED';

export interface ModuleDependencyGraphValidationIssue {
	readonly code: ModuleDependencyGraphValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface ModuleDependencyGraphValidationOptions {
	readonly maxIssues: number;
}

export type ModuleDependencyGraphValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly ModuleDependencyGraphValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

class IssueCollector {
	readonly issues: ModuleDependencyGraphValidationIssue[] = [];
	exhausted = false;

	constructor(readonly maxIssues: number) {}

	add(code: ModuleDependencyGraphValidationIssueCode, path: string, message: string): void {
		if (this.exhausted) return;
		if (this.issues.length >= this.maxIssues) {
			this.exhausted = true;
			return;
		}
		this.issues.push({ code, message, path });
	}

	result(): ModuleDependencyGraphValidationResult {
		if (this.issues.length === 0 && !this.exhausted) return { issues: [], state: 'VALID' };
		return {
			issues: this.issues,
			state: this.exhausted ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};
	}
}

type JsonRecord = Record<string, unknown>;

function plainRecord(value: unknown): value is JsonRecord {
	if (value === null || typeof value !== 'object' || isProxyValue(value) || Array.isArray(value))
		return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function plainArray(value: unknown): value is readonly unknown[] {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxyValue(value) ||
		!Array.isArray(value) ||
		Object.getPrototypeOf(value) !== Array.prototype
	)
		return false;
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (lengthDescriptor === undefined || !('value' in lengthDescriptor)) return false;
	const lengthValue = lengthDescriptor.value;
	if (!Number.isSafeInteger(lengthValue) || (lengthValue as number) < 0) return false;
	const length = lengthValue as number;
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.length !== length + 1 || ownKeys.some((key) => typeof key === 'symbol')) return false;
	for (let index = 0; index < length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return false;
	}
	return true;
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
	const ownKeys = Reflect.ownKeys(value);
	const actual: string[] = [];
	for (const key of ownKeys) {
		if (typeof key !== 'string') {
			issues.add('INVALID_SHAPE', path, 'Symbol properties are not permitted.');
			return false;
		}
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
			issues.add('INVALID_SHAPE', `${path}.${key}`, 'Expected an enumerable data property.');
			return false;
		}
		actual.push(key);
	}
	actual.sort(compareText);
	const wanted = [...expected].sort(compareText);
	if (canonicalSemanticJson(actual) !== canonicalSemanticJson(wanted)) {
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

function nullableString(value: unknown): value is string | null {
	return value === null || scalarString(value);
}

function nonnegativeInteger(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) >= 0;
}

function stringArray(value: unknown): value is readonly string[] {
	return plainArray(value) && value.every(scalarString);
}

function shapeSemanticProvenanceLookup(
	value: unknown,
	issues: IssueCollector
): value is StaticSemanticSnapshot {
	if (!plainRecord(value)) {
		issues.add('INVALID_SHAPE', '$semanticSnapshot', 'Expected a plain semantic snapshot object.');
		return false;
	}
	const populationDescriptor = Reflect.getOwnPropertyDescriptor(value, 'provenances');
	if (
		populationDescriptor === undefined ||
		!populationDescriptor.enumerable ||
		!('value' in populationDescriptor) ||
		!plainArray(populationDescriptor.value)
	) {
		issues.add(
			'INVALID_SHAPE',
			'$semanticSnapshot.provenances',
			'Expected a dense provenance data-property array.'
		);
		return false;
	}
	for (const [index, record] of populationDescriptor.value.entries()) {
		const path = `$semanticSnapshot.provenances[${index}]`;
		if (!plainRecord(record)) {
			issues.add('INVALID_SHAPE', path, 'Expected a plain semantic provenance object.');
			return false;
		}
		for (const key of ['id', 'snapshotId', 'subjectId'] as const) {
			const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
				issues.add('INVALID_SHAPE', `${path}.${key}`, 'Expected an enumerable data property.');
				return false;
			}
		}
	}
	return true;
}

function shapeCoverage(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, COVERAGE_KEYS, path, issues)) return false;
	let valid = true;
	for (const key of COVERAGE_KEYS) {
		const field = value[key];
		if (key === 'closure') valid = (field === 'CLOSED' || field === 'OPEN') && valid;
		else if (key === 'reconciles') valid = typeof field === 'boolean' && valid;
		else valid = nonnegativeInteger(field) && valid;
	}
	if (!valid) issues.add('INVALID_SHAPE', path, 'Coverage fields have invalid primitive values.');
	return valid;
}

function shapeLimitation(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, LIMITATION_KEYS, path, issues)) return false;
	const valid =
		(value.closureEffect === 'NONE' || value.closureEffect === 'DEGRADES_CLOSURE') &&
		[
			'DEPCRUISE_NOT_RUN',
			'NON_SOURCE_MODULE_TARGET',
			'SEMANTIC_INPUT_PARTIAL',
			'UNRESOLVED_MODULE',
			'UNSUPPORTED_MODULE_RESOLUTION'
		].includes(value.kind as never) &&
		nullableString(value.moduleResolutionId) &&
		scalarString(value.reason) &&
		value.reason.length > 0 &&
		nullableString(value.sourceId);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Limitation fields have invalid primitive values.');
	return valid;
}

function shapeLocation(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, SOURCE_LOCATION_KEYS, path, issues)) return false;
	const valid =
		nonnegativeInteger(value.start) &&
		nonnegativeInteger(value.end) &&
		(value.start as number) <= (value.end as number) &&
		scalarString(value.sourceId);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Source location fields are invalid.');
	return valid;
}

function shapeEndpoint(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, ENDPOINT_KEYS, path, issues)) return false;
	const valid =
		(value.kind === 'SOURCE' || value.kind === 'RESOLUTION_TARGET') && scalarString(value.nodeId);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Endpoint fields are invalid.');
	return valid;
}

function shapeIndexEntry(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, INDEX_ENTRY_KEYS, path, issues)) return false;
	const valid = scalarString(value.nodeId) && stringArray(value.edgeIds);
	if (!valid) issues.add('INVALID_SHAPE', path, 'Index entry fields are invalid.');
	return valid;
}

function shapeProvider(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, PROVIDER_KEYS, path, issues)) return false;
	const valid =
		value.api === 'PUBLIC_COMPILER_API' &&
		value.id === 'typescript' &&
		scalarString(value.version) &&
		value.version.length > 0;
	if (!valid) issues.add('INVALID_SHAPE', path, 'Provider identity fields are invalid.');
	return valid;
}

function shapeNode(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!plainRecord(value)) {
		issues.add('INVALID_SHAPE', path, 'Expected a graph node object.');
		return false;
	}
	const kindDescriptor = Reflect.getOwnPropertyDescriptor(value, 'kind');
	if (kindDescriptor === undefined || !kindDescriptor.enumerable || !('value' in kindDescriptor)) {
		issues.add('INVALID_SHAPE', `${path}.kind`, 'Expected an enumerable data property.');
		return false;
	}
	const expected =
		kindDescriptor.value === 'SOURCE' ? SOURCE_NODE_KEYS : RESOLUTION_TARGET_NODE_KEYS;
	if (!exactKeys(value, expected, path, issues)) return false;
	let valid =
		(value.epistemic === 'SUPPORTED' ||
			value.epistemic === 'UNKNOWN' ||
			value.epistemic === 'UNSUPPORTED' ||
			value.epistemic === 'CONFLICTING') &&
		scalarString(value.graphId) &&
		scalarString(value.id) &&
		scalarString(value.layerId) &&
		stringArray(value.provenanceIds) &&
		scalarString(value.semanticSnapshotId) &&
		plainArray(value.sourceLocations) &&
		scalarString(value.subjectId);
	if (plainArray(value.sourceLocations))
		for (const [index, location] of value.sourceLocations.entries())
			valid = shapeLocation(location, `${path}.sourceLocations[${index}]`, issues) && valid;
	if (value.kind === 'SOURCE') {
		valid =
			(value.analysisDisposition === 'DEEP_INDEXED' ||
				value.analysisDisposition === 'CONTEXT_ONLY') &&
			scalarString(value.logicalPath) &&
			scalarString(value.programId) &&
			scalarString(value.projectId) &&
			scalarString(value.semanticSourceId) &&
			valid;
	} else {
		valid =
			value.kind === 'RESOLUTION_TARGET' &&
			scalarString(value.moduleResolutionId) &&
			nullableString(value.moduleSymbolId) &&
			['RESOLVED_AMBIENT', 'RESOLVED_EXTERNAL', 'UNRESOLVED', 'UNSUPPORTED'].includes(
				value.resolutionState as never
			) &&
			nullableString(value.specifier) &&
			(value.specifierState === 'LITERAL' || value.specifierState === 'NON_LITERAL') &&
			valid;
	}
	if (!valid) issues.add('INVALID_SHAPE', path, 'Graph node fields have invalid primitive values.');
	return valid;
}

function shapeEdge(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, EDGE_KEYS, path, issues)) return false;
	let valid =
		(value.epistemic === 'SUPPORTED' ||
			value.epistemic === 'UNKNOWN' ||
			value.epistemic === 'UNSUPPORTED' ||
			value.epistemic === 'CONFLICTING') &&
		scalarString(value.graphId) &&
		scalarString(value.id) &&
		scalarString(value.layerId) &&
		value.method === MODULE_DEPENDENCY_GRAPH_METHOD &&
		scalarString(value.moduleResolutionId) &&
		['IMPORT', 'EXPORT', 'IMPORT_EQUALS', 'IMPORT_TYPE', 'DYNAMIC_IMPORT'].includes(
			value.occurrenceKind as never
		) &&
		scalarString(value.occurrenceNodeId) &&
		stringArray(value.provenanceIds) &&
		Object.values(RELATION_KIND_BY_OCCURRENCE).includes(value.relationKind as never) &&
		[
			'RESOLVED_SOURCE',
			'RESOLVED_AMBIENT',
			'RESOLVED_EXTERNAL',
			'UNRESOLVED',
			'UNSUPPORTED'
		].includes(value.resolutionState as never) &&
		scalarString(value.semanticSnapshotId) &&
		plainArray(value.sourceLocations) &&
		nullableString(value.specifier) &&
		(value.specifierState === 'LITERAL' || value.specifierState === 'NON_LITERAL') &&
		scalarString(value.subjectId) &&
		typeof value.typeOnly === 'boolean';
	valid = shapeEndpoint(value.source, `${path}.source`, issues) && valid;
	valid = shapeEndpoint(value.target, `${path}.target`, issues) && valid;
	if (plainArray(value.sourceLocations))
		for (const [index, location] of value.sourceLocations.entries())
			valid = shapeLocation(location, `${path}.sourceLocations[${index}]`, issues) && valid;
	if (!valid) issues.add('INVALID_SHAPE', path, 'Graph edge fields have invalid primitive values.');
	return valid;
}

// Shapes every element of a candidate array, exactly reproducing the original
// `if (plainArray(x)) for (...) valid = shape(...) && valid;` accumulation — a non-array
// leaves the caller's verdict untouched because the enclosing scalar chain already rejected it.
function shapeArrayElements(
	values: unknown,
	shape: (element: unknown, path: string, issues: IssueCollector) => boolean,
	path: string,
	issues: IssueCollector
): boolean {
	if (!plainArray(values)) return true;
	let valid = true;
	for (const [index, element] of values.entries())
		valid = shape(element, `${path}[${index}]`, issues) && valid;
	return valid;
}

function shapeGraphScalars(value: JsonRecord): boolean {
	return (
		scalarString(value.canonicalProfile) &&
		scalarString(value.contentDigest) &&
		plainArray(value.edges) &&
		(value.epistemic === 'SUPPORTED' ||
			value.epistemic === 'UNKNOWN' ||
			value.epistemic === 'UNSUPPORTED' ||
			value.epistemic === 'CONFLICTING') &&
		plainArray(value.forwardIndex) &&
		scalarString(value.fullJanCsaa007Conformance) &&
		scalarString(value.graphInputDigest) &&
		value.graphKind === 'TYPESCRIPT_MODULE_DEPENDENCY' &&
		(value.health === 'COMPLETE' || value.health === 'PARTIAL') &&
		scalarString(value.id) &&
		plainArray(value.layers) &&
		plainArray(value.limitations) &&
		scalarString(value.method) &&
		plainArray(value.nodes) &&
		scalarString(value.operationVersion) &&
		plainRecord(value.producer) &&
		plainArray(value.reverseIndex) &&
		scalarString(value.schemaVersion) &&
		scalarString(value.semanticExtractionVersion) &&
		scalarString(value.semanticSchemaVersion) &&
		scalarString(value.semanticSnapshotId) &&
		scalarString(value.subjectId)
	);
}

function shapeLayer(value: unknown, path: string, issues: IssueCollector): boolean {
	if (!exactKeys(value, LAYER_KEYS, path, issues)) return false;
	let layerValid =
		stringArray(value.edgeIds) &&
		(value.epistemic === 'SUPPORTED' ||
			value.epistemic === 'UNKNOWN' ||
			value.epistemic === 'UNSUPPORTED' ||
			value.epistemic === 'CONFLICTING') &&
		scalarString(value.graphId) &&
		scalarString(value.id) &&
		value.kind === 'TYPESCRIPT_MODULE_RESOLUTION' &&
		plainArray(value.limitations) &&
		value.method === MODULE_DEPENDENCY_GRAPH_METHOD &&
		stringArray(value.nodeIds) &&
		value.ordinal === 0 &&
		stringArray(value.provenanceIds) &&
		plainRecord(value.producer) &&
		scalarString(value.semanticSnapshotId) &&
		scalarString(value.subjectId);
	layerValid = shapeCoverage(value.coverage, `${path}.coverage`, issues) && layerValid;
	layerValid = shapeProvider(value.producer, `${path}.producer`, issues) && layerValid;
	layerValid =
		shapeArrayElements(value.limitations, shapeLimitation, `${path}.limitations`, issues) &&
		layerValid;
	if (!layerValid)
		issues.add('INVALID_SHAPE', path, 'Graph layer fields have invalid primitive values.');
	return layerValid;
}

function shapeGraph(
	value: unknown,
	issues: IssueCollector
): value is ModuleDependencyGraphSnapshot {
	if (!exactKeys(value, TOP_LEVEL_KEYS, '$', issues)) return false;
	let valid = shapeGraphScalars(value);
	valid = shapeCoverage(value.coverage, '$.coverage', issues) && valid;
	valid = shapeProvider(value.producer, '$.producer', issues) && valid;
	valid = shapeArrayElements(value.limitations, shapeLimitation, '$.limitations', issues) && valid;
	valid = shapeArrayElements(value.layers, shapeLayer, '$.layers', issues) && valid;
	valid = shapeArrayElements(value.nodes, shapeNode, '$.nodes', issues) && valid;
	valid = shapeArrayElements(value.edges, shapeEdge, '$.edges', issues) && valid;
	valid =
		shapeArrayElements(value.forwardIndex, shapeIndexEntry, '$.forwardIndex', issues) && valid;
	valid =
		shapeArrayElements(value.reverseIndex, shapeIndexEntry, '$.reverseIndex', issues) && valid;
	if (!valid) issues.add('INVALID_SHAPE', '$', 'Graph fields have invalid primitive values.');
	return valid;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
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
		if (comparison === 0) issues.add('DUPLICATE_ID', path, `Duplicate identity ${values[index]}.`);
		if (issues.exhausted) return;
	}
}

function canonicalObjectArray(
	values: readonly unknown[],
	path: string,
	issues: IssueCollector
): void {
	const keys = values.map((value) => canonicalSemanticJson(value));
	sortedUniqueStrings(keys, path, issues);
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

function same(left: unknown, right: unknown): boolean {
	return canonicalSemanticJson(left) === canonicalSemanticJson(right);
}

function exactLocation(sourceId: string, start: number, end: number) {
	return [{ end, sourceId, start }];
}

function expectedEpistemic(
	state: SemanticModuleResolutionRecord['resolutionState']
): ModuleDependencyGraphEpistemicState {
	if (state === 'UNSUPPORTED') return 'UNSUPPORTED';
	if (state === 'UNRESOLVED') return 'UNKNOWN';
	return 'SUPPORTED';
}

function aggregateEpistemic(
	resolutions: readonly SemanticModuleResolutionRecord[]
): ModuleDependencyGraphEpistemicState {
	if (resolutions.some((record) => record.resolutionState === 'UNSUPPORTED')) return 'UNSUPPORTED';
	if (resolutions.some((record) => record.resolutionState === 'UNRESOLVED')) return 'UNKNOWN';
	return 'SUPPORTED';
}

function expectedCoverage(snapshot: StaticSemanticSnapshot): ModuleDependencyGraphCoverage {
	const count = (state: SemanticModuleResolutionRecord['resolutionState']): number =>
		snapshot.moduleResolutions.filter((record) => record.resolutionState === state).length;
	const graphNativeTargets = snapshot.moduleResolutions.filter(
		(record) => record.targetSourceId === null
	).length;
	return {
		closure:
			snapshot.health === 'PARTIAL' ||
			graphNativeTargets > 0 ||
			snapshot.moduleResolutions.some((record) => record.resolutionState !== 'RESOLVED_SOURCE')
				? 'OPEN'
				: 'CLOSED',
		expectedModuleResolutions: snapshot.moduleResolutions.length,
		expectedSources: snapshot.sources.length,
		graphNativeTargets,
		reconciles: true,
		representedModuleResolutions: snapshot.moduleResolutions.length,
		representedSources: snapshot.sources.length,
		resolvedAmbientTargets: count('RESOLVED_AMBIENT'),
		resolvedExternalTargets: count('RESOLVED_EXTERNAL'),
		resolvedSourceTargets: count('RESOLVED_SOURCE'),
		unresolvedTargets: count('UNRESOLVED'),
		unsupportedTargets: count('UNSUPPORTED')
	};
}

function limitationOrderKey(limitation: ModuleDependencyGraphLimitation): string {
	return `${limitation.kind}\0${limitation.moduleResolutionId ?? ''}\0${limitation.sourceId ?? ''}`;
}

function expectedLimitations(snapshot: StaticSemanticSnapshot): ModuleDependencyGraphLimitation[] {
	const limitations: ModuleDependencyGraphLimitation[] = [
		{
			closureEffect: 'NONE',
			kind: 'DEPCRUISE_NOT_RUN',
			moduleResolutionId: null,
			reason:
				'Dependency-cruiser corroboration was not run by this compiler-native graph increment.',
			sourceId: null
		}
	];
	if (snapshot.health === 'PARTIAL')
		limitations.push({
			closureEffect: 'DEGRADES_CLOSURE',
			kind: 'SEMANTIC_INPUT_PARTIAL',
			moduleResolutionId: null,
			reason: 'The bound static semantic snapshot is partial.',
			sourceId: null
		});
	for (const resolution of snapshot.moduleResolutions) {
		if (
			resolution.resolutionState === 'RESOLVED_AMBIENT' ||
			resolution.resolutionState === 'RESOLVED_EXTERNAL'
		)
			limitations.push({
				closureEffect: 'DEGRADES_CLOSURE',
				kind: 'NON_SOURCE_MODULE_TARGET',
				moduleResolutionId: resolution.id,
				reason: `The ${resolution.resolutionState} module target is represented as an explicit graph-native endpoint outside the source-node population.`,
				sourceId: resolution.sourceId
			});
		else if (resolution.resolutionState === 'UNRESOLVED')
			limitations.push({
				closureEffect: 'DEGRADES_CLOSURE',
				kind: 'UNRESOLVED_MODULE',
				moduleResolutionId: resolution.id,
				reason: 'The compiler did not resolve this module occurrence.',
				sourceId: resolution.sourceId
			});
		else if (resolution.resolutionState === 'UNSUPPORTED')
			limitations.push({
				closureEffect: 'DEGRADES_CLOSURE',
				kind: 'UNSUPPORTED_MODULE_RESOLUTION',
				moduleResolutionId: resolution.id,
				reason: 'This module occurrence is outside the supported compiler resolution surface.',
				sourceId: resolution.sourceId
			});
	}
	return limitations.sort((left, right) =>
		compareText(limitationOrderKey(left), limitationOrderKey(right))
	);
}

function validateLimitations(
	limitations: readonly ModuleDependencyGraphLimitation[],
	snapshot: StaticSemanticSnapshot,
	path: string,
	issues: IssueCollector
): void {
	const orderKeys = limitations.map(limitationOrderKey);
	sortedUniqueStrings(orderKeys, path, issues);
	if (!same(limitations, expectedLimitations(snapshot)))
		issues.add(
			'LIMITATION_MISMATCH',
			path,
			'Limitations do not exactly disclose dependency-cruiser status, non-source targets, semantic partiality, and unresolved or unsupported resolutions.'
		);
}

function validateProvenanceIds(
	ids: readonly SemanticProvenanceId[],
	snapshot: StaticSemanticSnapshot,
	provenanceById: ReadonlyMap<string, StaticSemanticSnapshot['provenances'][number]>,
	path: string,
	issues: IssueCollector
): void {
	sortedUniqueStrings(ids, path, issues);
	for (const [index, id] of ids.entries()) {
		const record = provenanceById.get(id);
		if (record === undefined)
			issues.add('DANGLING_REFERENCE', `${path}[${index}]`, `Absent semantic provenance ${id}.`);
		else if (record.snapshotId !== snapshot.id || record.subjectId !== snapshot.subjectId)
			issues.add(
				'DANGLING_REFERENCE',
				`${path}[${index}]`,
				'Provenance does not belong to the bound semantic snapshot and subject.'
			);
		if (issues.exhausted) return;
	}
}

function expectedIndex(
	nodes: readonly ModuleDependencyGraphNode[],
	edges: readonly ModuleDependencyGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): ModuleDependencyGraphIndexEntry[] {
	const edgeIdsByNode = new Map(
		nodes.map((node) => [node.id, [] as ModuleDependencyGraphEdge['id'][]])
	);
	for (const edge of edges) {
		const nodeId = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		edgeIdsByNode.get(nodeId)?.push(edge.id);
	}
	return nodes
		.map((node) => ({
			edgeIds: edgeIdsByNode.get(node.id)!.sort(compareText),
			nodeId: node.id
		}))
		.sort((left, right) => compareText(left.nodeId, right.nodeId));
}

function graphWideReference(
	record: {
		readonly graphId: string;
		readonly layerId?: string;
		readonly semanticSnapshotId: string;
		readonly subjectId: string;
	},
	graph: ModuleDependencyGraphSnapshot,
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

function validateGraphVersions(graph: ModuleDependencyGraphSnapshot, issues: IssueCollector): void {
	if (graph.schemaVersion !== MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION)
		issues.add('UNSUPPORTED_SCHEMA_VERSION', '$.schemaVersion', graph.schemaVersion);
	if (graph.operationVersion !== MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION)
		issues.add('INVALID_VALUE', '$.operationVersion', 'Unsupported graph operation version.');
	if (graph.canonicalProfile !== MODULE_DEPENDENCY_GRAPH_CANONICAL_PROFILE)
		issues.add('INVALID_VALUE', '$.canonicalProfile', 'Unsupported graph canonical profile.');
	if (graph.method !== MODULE_DEPENDENCY_GRAPH_METHOD)
		issues.add('INVALID_VALUE', '$.method', 'Unsupported graph construction method.');
	if (graph.fullJanCsaa007Conformance !== FULL_JAN_CSAA_007_CONFORMANCE)
		issues.add(
			'CONFORMANCE_OVERCLAIM',
			'$.fullJanCsaa007Conformance',
			'This bounded graph kernel must retain the explicit NOT_CLAIMED conformance state.'
		);
}

function validateGraphBinding(
	graph: ModuleDependencyGraphSnapshot,
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
			'Graph does not disclose the bound semantic extraction version.'
		);
	if (graph.semanticSchemaVersion !== snapshot.schemaVersion)
		issues.add(
			'INVALID_VALUE',
			'$.semanticSchemaVersion',
			'Graph does not disclose the bound semantic schema version.'
		);
	if (!same(graph.producer, snapshot.provider))
		issues.add(
			'INVALID_VALUE',
			'$.producer',
			'Graph producer does not match the semantic provider.'
		);
	if (!SHA256.test(graph.graphInputDigest))
		issues.add(
			'INVALID_VALUE',
			'$.graphInputDigest',
			'Graph input digest must be lowercase SHA-256.'
		);
	if (!SHA256.test(graph.contentDigest))
		issues.add('INVALID_VALUE', '$.contentDigest', 'Content digest must be lowercase SHA-256.');
}

function validateGraphInputDigest(
	graph: ModuleDependencyGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector
): void {
	try {
		const expectedInputDigest = moduleDependencyGraphInputDigest(snapshot);
		if (graph.graphInputDigest !== expectedInputDigest)
			issues.add(
				'GRAPH_INPUT_MISMATCH',
				'$.graphInputDigest',
				'Graph input digest does not reproduce the exact consumed semantic projection.'
			);
	} catch (error) {
		issues.add(
			'GRAPH_INPUT_MISMATCH',
			'$.graphInputDigest',
			error instanceof Error ? error.message : 'Graph input projection failed closed.'
		);
	}
}

function validateGraphIdentity(graph: ModuleDependencyGraphSnapshot, issues: IssueCollector): void {
	const expectedGraphId = moduleDependencyGraphId({
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
		issues.add(
			'IDENTITY_MISMATCH',
			'$.id',
			'Graph identity does not match its request-bound preimage.'
		);
}

function validateGraphLayerIdentity(
	graph: ModuleDependencyGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector
): void {
	const layer = graph.layers[0];
	const expectedLayerId = moduleDependencyGraphLayerId(graph.id, layer.kind, layer.ordinal);
	if (layer.id !== expectedLayerId)
		issues.add('IDENTITY_MISMATCH', '$.layers[0].id', 'Graph layer identity mismatch.');
	graphWideReference(layer, graph, layer.id, '$.layers[0]', issues);
	if (!same(layer.producer, snapshot.provider))
		issues.add(
			'INVALID_VALUE',
			'$.layers[0].producer',
			'Layer producer does not match the semantic provider.'
		);
}

function createGraphSemanticsState(
	graph: ModuleDependencyGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector
) {
	const nodeById = validateIdPopulation(graph.nodes, '$.nodes', issues);
	const edgeById = validateIdPopulation(graph.edges, '$.edges', issues);
	const sourceById = new Map(snapshot.sources.map((record) => [record.id, record]));
	const resolutionById = new Map(snapshot.moduleResolutions.map((record) => [record.id, record]));
	const occurrenceById = new Map(snapshot.astNodes.map((record) => [record.id, record]));
	const provenanceById = new Map(snapshot.provenances.map((record) => [record.id, record]));

	const sourceNodes = graph.nodes.filter(
		(node): node is Extract<ModuleDependencyGraphNode, { readonly kind: 'SOURCE' }> =>
			node.kind === 'SOURCE'
	);
	const targetNodes = graph.nodes.filter(
		(node): node is Extract<ModuleDependencyGraphNode, { readonly kind: 'RESOLUTION_TARGET' }> =>
			node.kind === 'RESOLUTION_TARGET'
	);
	const sourceNodeBySemanticId = new Map<string, (typeof sourceNodes)[number]>();
	const targetNodeByResolutionId = new Map<string, (typeof targetNodes)[number]>();
	const targetNodeCountByResolutionId = new Map<string, number>();
	return {
		edgeById,
		edgesByResolution: new Map<string, ModuleDependencyGraphEdge[]>(),
		graph,
		issues,
		layer: graph.layers[0],
		nodeById,
		occurrenceById,
		provenanceById,
		resolutionById,
		snapshot,
		sourceById,
		sourceNodeBySemanticId,
		sourceNodes,
		targetNodeByResolutionId,
		targetNodeCountByResolutionId,
		targetNodes
	};
}

// The working state of one graph-semantics validation, threaded by reference so that every
// extracted phase writes into the same populations the original single function accumulated.
type GraphSemanticsState = ReturnType<typeof createGraphSemanticsState>;

function validateNodeSourceLocations(
	state: GraphSemanticsState,
	node: ModuleDependencyGraphNode,
	path: string
): void {
	const { issues, sourceById } = state;
	for (const [locationIndex, location] of node.sourceLocations.entries()) {
		const source = sourceById.get(location.sourceId);
		if (source === undefined)
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.sourceLocations[${locationIndex}].sourceId`,
				'Location references an absent source.'
			);
		else if (location.end > source.textLength)
			issues.add(
				'INVALID_VALUE',
				`${path}.sourceLocations[${locationIndex}].end`,
				'Location exceeds its semantic source.'
			);
	}
}

// Returns true when the remaining per-node checks are skipped, exactly as the original
// `continue` did — including its skip of the end-of-iteration budget check.
function validateSourceGraphNode(
	state: GraphSemanticsState,
	node: Extract<ModuleDependencyGraphNode, { readonly kind: 'SOURCE' }>,
	path: string
): boolean {
	const { graph, issues, sourceById, sourceNodeBySemanticId } = state;
	if (sourceNodeBySemanticId.has(node.semanticSourceId))
		issues.add(
			'DUPLICATE_ID',
			`${path}.semanticSourceId`,
			'A semantic source is represented by more than one graph node.'
		);
	else sourceNodeBySemanticId.set(node.semanticSourceId, node);
	const source = sourceById.get(node.semanticSourceId);
	if (source === undefined) {
		issues.add('DANGLING_REFERENCE', `${path}.semanticSourceId`, 'Absent semantic source.');
		return true;
	}
	if (
		node.analysisDisposition !== source.analysisDisposition ||
		node.logicalPath !== source.logicalPath ||
		node.programId !== source.programId ||
		node.projectId !== source.projectId
	)
		issues.add('INVALID_VALUE', path, 'Source node does not reproduce its semantic source fields.');
	try {
		assertCanonicalRelativePath(node.logicalPath);
	} catch {
		issues.add(
			'ABSOLUTE_PATH',
			`${path}.logicalPath`,
			'Graph source paths must be canonical repository-relative paths.'
		);
	}
	if (node.id !== moduleDependencyGraphSourceNodeId(graph.id, source.id))
		issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Source-node identity mismatch.');
	if (!same(node.provenanceIds, [source.provenanceId]))
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.provenanceIds`,
			'Source-node provenance must be exactly the semantic source provenance.'
		);
	if (!same(node.sourceLocations, exactLocation(source.id, 0, source.textLength)))
		issues.add(
			'INVALID_VALUE',
			`${path}.sourceLocations`,
			'Source-node location must cover its exact semantic source.'
		);
	if (node.epistemic !== 'SUPPORTED')
		issues.add('INVALID_VALUE', `${path}.epistemic`, 'Semantic source nodes are supported facts.');
	return false;
}

// Returns true when the remaining per-node checks are skipped, exactly as the original
// `continue` did — including its skip of the end-of-iteration budget check.
function validateResolutionTargetGraphNode(
	state: GraphSemanticsState,
	node: Extract<ModuleDependencyGraphNode, { readonly kind: 'RESOLUTION_TARGET' }>,
	path: string
): boolean {
	const {
		graph,
		issues,
		occurrenceById,
		resolutionById,
		targetNodeByResolutionId,
		targetNodeCountByResolutionId
	} = state;
	targetNodeCountByResolutionId.set(
		node.moduleResolutionId,
		(targetNodeCountByResolutionId.get(node.moduleResolutionId) ?? 0) + 1
	);
	if (targetNodeByResolutionId.has(node.moduleResolutionId))
		issues.add(
			'DUPLICATE_ID',
			`${path}.moduleResolutionId`,
			'A module resolution has more than one graph-native endpoint.'
		);
	else targetNodeByResolutionId.set(node.moduleResolutionId, node);
	const resolution = resolutionById.get(node.moduleResolutionId);
	if (resolution === undefined) {
		issues.add('DANGLING_REFERENCE', `${path}.moduleResolutionId`, 'Absent module resolution.');
		return true;
	}
	if (resolution.resolutionState === 'RESOLVED_SOURCE')
		issues.add(
			'INVALID_VALUE',
			`${path}.resolutionState`,
			'Resolved-source facts must target a SOURCE node, not a graph-native endpoint.'
		);
	if (
		node.moduleSymbolId !== resolution.moduleSymbolId ||
		node.resolutionState !== resolution.resolutionState ||
		node.specifier !== resolution.specifier ||
		node.specifierState !== resolution.specifierState
	)
		issues.add(
			'INVALID_VALUE',
			path,
			'Graph-native target does not reproduce its module-resolution fact.'
		);
	if (node.id !== moduleDependencyGraphResolutionTargetNodeId(graph.id, resolution.id))
		issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Resolution-target identity mismatch.');
	if (!same(node.provenanceIds, [resolution.provenanceId]))
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.provenanceIds`,
			'Resolution-target provenance must be exactly the semantic resolution provenance.'
		);
	const occurrence = occurrenceById.get(resolution.nodeId);
	if (
		occurrence !== undefined &&
		!same(
			node.sourceLocations,
			exactLocation(occurrence.sourceId, occurrence.start, occurrence.end)
		)
	)
		issues.add(
			'INVALID_VALUE',
			`${path}.sourceLocations`,
			'Resolution target must cite the exact module occurrence.'
		);
	if (node.epistemic !== expectedEpistemic(resolution.resolutionState))
		issues.add('INVALID_VALUE', `${path}.epistemic`, 'Resolution-target epistemic state mismatch.');
	return false;
}

function validateGraphNode(
	state: GraphSemanticsState,
	node: ModuleDependencyGraphNode,
	path: string
): boolean {
	const { graph, issues, layer, provenanceById, snapshot } = state;
	graphWideReference(node, graph, layer.id, path, issues);
	validateProvenanceIds(
		node.provenanceIds,
		snapshot,
		provenanceById,
		`${path}.provenanceIds`,
		issues
	);
	canonicalObjectArray(node.sourceLocations, `${path}.sourceLocations`, issues);
	validateNodeSourceLocations(state, node, path);
	if (node.kind === 'SOURCE') return validateSourceGraphNode(state, node, path);
	return validateResolutionTargetGraphNode(state, node, path);
}

// Returns true when the issue budget was exhausted and validation must stop.
function validateGraphNodes(state: GraphSemanticsState): boolean {
	for (const [index, node] of state.graph.nodes.entries()) {
		if (validateGraphNode(state, node, `$.nodes[${index}]`)) continue;
		if (state.issues.exhausted) return true;
	}
	return false;
}

// Returns true when the remaining per-edge checks are skipped, exactly as the original
// `continue` did — including its skip of the end-of-iteration budget check.
function validateEdgeOccurrence(
	state: GraphSemanticsState,
	edge: ModuleDependencyGraphEdge,
	resolution: SemanticModuleResolutionRecord,
	path: string
): boolean {
	const { issues, occurrenceById } = state;
	const occurrence = occurrenceById.get(resolution.nodeId);
	if (occurrence === undefined) {
		issues.add('DANGLING_REFERENCE', `${path}.occurrenceNodeId`, 'Absent occurrence AST node.');
		return true;
	}
	if (occurrence.sourceId !== resolution.sourceId)
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.occurrenceNodeId`,
			'Module-resolution occurrence and importer source differ.'
		);
	if (
		edge.occurrenceKind !== resolution.occurrenceKind ||
		edge.occurrenceNodeId !== resolution.nodeId ||
		edge.relationKind !== RELATION_KIND_BY_OCCURRENCE[resolution.occurrenceKind] ||
		edge.resolutionState !== resolution.resolutionState ||
		edge.specifier !== resolution.specifier ||
		edge.specifierState !== resolution.specifierState ||
		edge.typeOnly !== resolution.typeOnly
	)
		issues.add(
			'INVALID_VALUE',
			path,
			'Graph edge collapses or changes its supporting module-resolution occurrence.'
		);
	if (edge.method !== MODULE_DEPENDENCY_GRAPH_METHOD)
		issues.add('INVALID_VALUE', `${path}.method`, 'Edge method mismatch.');
	if (!same(edge.provenanceIds, [resolution.provenanceId]))
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.provenanceIds`,
			'Edge provenance must be exactly its module-resolution provenance.'
		);
	if (
		!same(
			edge.sourceLocations,
			exactLocation(occurrence.sourceId, occurrence.start, occurrence.end)
		)
	)
		issues.add(
			'INVALID_VALUE',
			`${path}.sourceLocations`,
			'Edge must cite the exact module occurrence location.'
		);
	return false;
}

function validateEdgeEndpoints(
	state: GraphSemanticsState,
	edge: ModuleDependencyGraphEdge,
	resolution: SemanticModuleResolutionRecord,
	path: string
): void {
	const { issues, nodeById, sourceNodeBySemanticId, targetNodeByResolutionId } = state;
	const sourceNode = nodeById.get(edge.source.nodeId);
	if (
		edge.source.kind !== 'SOURCE' ||
		sourceNode?.kind !== 'SOURCE' ||
		sourceNode.semanticSourceId !== resolution.sourceId
	)
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.source`,
			'Edge source must be the exact importer SOURCE node.'
		);
	let expectedTarget: ModuleDependencyGraphNode | undefined;
	if (resolution.targetSourceId !== null) {
		expectedTarget = sourceNodeBySemanticId.get(resolution.targetSourceId);
		if (edge.target.kind !== 'SOURCE' || expectedTarget?.kind !== 'SOURCE')
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.target`,
				'A module resolution with a source target must use its semantic SOURCE node.'
			);
	} else {
		expectedTarget = targetNodeByResolutionId.get(resolution.id);
		if (edge.target.kind !== 'RESOLUTION_TARGET' || expectedTarget?.kind !== 'RESOLUTION_TARGET')
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.target`,
				'A module resolution without a source target must retain its explicit graph-native endpoint.'
			);
	}
	if (edge.target.nodeId !== expectedTarget?.id)
		issues.add('DANGLING_REFERENCE', `${path}.target.nodeId`, 'Edge target identity mismatch.');
}

function validateEdgeIdentity(
	state: GraphSemanticsState,
	edge: ModuleDependencyGraphEdge,
	resolution: SemanticModuleResolutionRecord,
	path: string
): void {
	const { graph, issues } = state;
	const expectedEdgeId = moduleDependencyGraphEdgeId({
		graph: graph.id,
		moduleResolutionId: resolution.id,
		relationKind: edge.relationKind,
		source: edge.source,
		target: edge.target
	});
	if (edge.id !== expectedEdgeId)
		issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Module-dependency edge identity mismatch.');
	if (edge.epistemic !== expectedEpistemic(resolution.resolutionState))
		issues.add('INVALID_VALUE', `${path}.epistemic`, 'Edge epistemic state mismatch.');
}

// Returns true when the remaining per-edge checks are skipped, exactly as the original
// `continue` did — including its skip of the end-of-iteration budget check.
function validateGraphEdge(
	state: GraphSemanticsState,
	edge: ModuleDependencyGraphEdge,
	path: string
): boolean {
	const { edgesByResolution, graph, issues, layer, provenanceById, resolutionById, snapshot } =
		state;
	graphWideReference(edge, graph, layer.id, path, issues);
	validateProvenanceIds(
		edge.provenanceIds,
		snapshot,
		provenanceById,
		`${path}.provenanceIds`,
		issues
	);
	canonicalObjectArray(edge.sourceLocations, `${path}.sourceLocations`, issues);
	const grouped = edgesByResolution.get(edge.moduleResolutionId) ?? [];
	grouped.push(edge);
	edgesByResolution.set(edge.moduleResolutionId, grouped);
	const resolution = resolutionById.get(edge.moduleResolutionId);
	if (resolution === undefined) {
		issues.add('DANGLING_REFERENCE', `${path}.moduleResolutionId`, 'Absent module resolution.');
		return true;
	}
	if (validateEdgeOccurrence(state, edge, resolution, path)) return true;
	validateEdgeEndpoints(state, edge, resolution, path);
	validateEdgeIdentity(state, edge, resolution, path);
	return false;
}

// Returns true when the issue budget was exhausted and validation must stop.
function validateGraphEdges(state: GraphSemanticsState): boolean {
	for (const [index, edge] of state.graph.edges.entries()) {
		if (validateGraphEdge(state, edge, `$.edges[${index}]`)) continue;
		if (state.issues.exhausted) return true;
	}
	return false;
}

function invalidGraphNativeEndpointPopulation(
	resolution: SemanticModuleResolutionRecord,
	targetCount: number
): boolean {
	return (
		(resolution.targetSourceId !== null && targetCount !== 0) ||
		(resolution.targetSourceId === null && targetCount !== 1)
	);
}

// Returns true when the issue budget was exhausted and validation must stop.
function validateResolutionPopulations(state: GraphSemanticsState): boolean {
	const { edgesByResolution, issues, snapshot, targetNodeCountByResolutionId } = state;
	for (const resolution of snapshot.moduleResolutions) {
		const count = edgesByResolution.get(resolution.id)?.length ?? 0;
		if (count !== 1)
			issues.add(
				'POPULATION_MISMATCH',
				'$.edges',
				`Module resolution ${resolution.id} must support exactly one distinct edge; received ${count}.`
			);
		const targetCount = targetNodeCountByResolutionId.get(resolution.id) ?? 0;
		if (invalidGraphNativeEndpointPopulation(resolution, targetCount))
			issues.add(
				'POPULATION_MISMATCH',
				'$.nodes',
				`Module resolution ${resolution.id} has an invalid graph-native endpoint population.`
			);
		if (issues.exhausted) return true;
	}
	return false;
}

function validateNodePopulations(state: GraphSemanticsState): void {
	const { issues, snapshot, sourceById, sourceNodeBySemanticId, sourceNodes, targetNodes } = state;
	if (
		sourceNodes.length !== snapshot.sources.length ||
		sourceNodeBySemanticId.size !== sourceById.size
	)
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			'Every semantic source must have exactly one SOURCE node.'
		);
	if (targetNodes.length !== expectedCoverage(snapshot).graphNativeTargets)
		issues.add(
			'POPULATION_MISMATCH',
			'$.nodes',
			'Graph-native target population does not match resolutions without source targets.'
		);
}

function validateLayerManifests(state: GraphSemanticsState): void {
	const { graph, issues, layer } = state;
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
	state: GraphSemanticsState,
	entry: ModuleDependencyGraphIndexEntry,
	path: string
): void {
	const { edgeById, issues, nodeById } = state;
	if (!nodeById.has(entry.nodeId))
		issues.add(
			'DANGLING_REFERENCE',
			`${path}.nodeId`,
			'Index entry references an absent graph node.'
		);
	sortedUniqueStrings(entry.edgeIds, `${path}.edgeIds`, issues);
	for (const [edgeIndex, edgeId] of entry.edgeIds.entries())
		if (!edgeById.has(edgeId))
			issues.add(
				'DANGLING_REFERENCE',
				`${path}.edgeIds[${edgeIndex}]`,
				'Index entry references an absent graph edge.'
			);
}

function validateGraphIndexes(state: GraphSemanticsState): void {
	const { graph, issues } = state;
	for (const [name, index, expected] of [
		['forwardIndex', graph.forwardIndex, expectedIndex(graph.nodes, graph.edges, 'FORWARD')],
		['reverseIndex', graph.reverseIndex, expectedIndex(graph.nodes, graph.edges, 'REVERSE')]
	] as const) {
		sortedUniqueStrings(
			index.map((entry) => entry.nodeId),
			`$.${name}`,
			issues
		);
		for (const [entryIndex, entry] of index.entries())
			validateIndexEntry(state, entry, `$.${name}[${entryIndex}]`);
		if (!same(index, expected))
			issues.add(
				'POPULATION_MISMATCH',
				`$.${name}`,
				`${name} does not exactly reconcile graph endpoint navigation.`
			);
	}
}

function validateGraphDisclosure(state: GraphSemanticsState): void {
	const { graph, issues, layer, snapshot } = state;
	const coverage = expectedCoverage(snapshot);
	if (!same(graph.coverage, coverage))
		issues.add('POPULATION_MISMATCH', '$.coverage', 'Graph coverage does not reconcile inputs.');
	if (!same(layer.coverage, coverage))
		issues.add('POPULATION_MISMATCH', '$.layers[0].coverage', 'Layer coverage mismatch.');
	validateLimitations(graph.limitations, snapshot, '$.limitations', issues);
	validateLimitations(layer.limitations, snapshot, '$.layers[0].limitations', issues);
	if (!same(layer.limitations, graph.limitations))
		issues.add('LIMITATION_MISMATCH', '$.layers[0].limitations', 'Layer limitations differ.');
	const epistemic = aggregateEpistemic(snapshot.moduleResolutions);
	if (graph.epistemic !== epistemic)
		issues.add('INVALID_VALUE', '$.epistemic', 'Aggregate graph epistemic state is dishonest.');
	if (layer.epistemic !== epistemic)
		issues.add('INVALID_VALUE', '$.layers[0].epistemic', 'Layer epistemic state mismatch.');
	const expectedHealth = coverage.closure === 'CLOSED' ? 'COMPLETE' : 'PARTIAL';
	if (graph.health !== expectedHealth)
		issues.add('INVALID_VALUE', '$.health', 'Graph health must reflect its exact closure state.');
}

function validateLayerProvenance(state: GraphSemanticsState): void {
	const { graph, issues, layer, provenanceById, snapshot } = state;
	const expectedLayerProvenance = [
		...new Set(
			graph.nodes
				.flatMap((node) => [...node.provenanceIds])
				.concat(graph.edges.flatMap((edge) => [...edge.provenanceIds]))
		)
	].sort(compareText);
	validateProvenanceIds(
		layer.provenanceIds,
		snapshot,
		provenanceById,
		'$.layers[0].provenanceIds',
		issues
	);
	if (!same(layer.provenanceIds, expectedLayerProvenance))
		issues.add(
			'POPULATION_MISMATCH',
			'$.layers[0].provenanceIds',
			'Layer provenance manifest does not reconcile node and edge support.'
		);
}

function validateContentDigest(graph: ModuleDependencyGraphSnapshot, issues: IssueCollector): void {
	try {
		if (graph.contentDigest !== moduleDependencyGraphContentDigest(graph))
			issues.add(
				'CONTENT_DIGEST_MISMATCH',
				'$.contentDigest',
				'Graph content digest does not bind the exact finalized graph content.'
			);
	} catch (error) {
		issues.add(
			'CONTENT_DIGEST_MISMATCH',
			'$.contentDigest',
			error instanceof Error ? error.message : 'Graph content digest failed closed.'
		);
	}
}

function validateGraphSemantics(
	graph: ModuleDependencyGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	issues: IssueCollector
): void {
	validateGraphVersions(graph, issues);
	validateGraphBinding(graph, snapshot, issues);
	validateGraphInputDigest(graph, snapshot, issues);
	validateGraphIdentity(graph, issues);
	if (graph.layers.length !== 1) {
		issues.add(
			'POPULATION_MISMATCH',
			'$.layers',
			'Exactly one module-resolution layer is required.'
		);
		return;
	}
	validateGraphLayerIdentity(graph, snapshot, issues);
	const state = createGraphSemanticsState(graph, snapshot, issues);
	if (validateGraphNodes(state)) return;
	if (validateGraphEdges(state)) return;
	if (validateResolutionPopulations(state)) return;
	validateNodePopulations(state);
	validateLayerManifests(state);
	validateGraphIndexes(state);
	validateGraphDisclosure(state);
	validateLayerProvenance(state);
	validateContentDigest(graph, issues);
	// Keep these maps live through validation: an extra unknown ID may otherwise
	// be hidden by a correct-looking manifest or index.
	if (state.nodeById.size !== graph.nodes.length || state.edgeById.size !== graph.edges.length)
		issues.add('DUPLICATE_ID', '$', 'Graph populations contain duplicate identities.');
}

export function validateModuleDependencyGraph(
	value: unknown,
	semanticSnapshot: StaticSemanticSnapshot,
	overrides: Partial<ModuleDependencyGraphValidationOptions> = {}
): ModuleDependencyGraphValidationResult {
	const maxIssues = overrides.maxIssues ?? DEFAULT_MAX_ISSUES;
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
		if (!shapeGraph(value, issues)) return issues.result();
		if (!shapeSemanticProvenanceLookup(semanticSnapshot, issues)) return issues.result();
		validateGraphSemantics(value, semanticSnapshot, issues);
		return issues.result();
	} catch (error) {
		issues.add(
			'INVALID_SHAPE',
			'$',
			error instanceof Error
				? `Graph validation failed closed: ${error.message}`
				: 'Graph validation failed closed.'
		);
		return issues.result();
	}
}
