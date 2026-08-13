import { isProxy } from 'node:util/types';
import ts from 'typescript';

import {
	COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER,
	COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE,
	COMMAND_EVENT_CONTRACT_OVERLAY_CANONICAL_PROFILE,
	COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
	COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_GATE_EFFECT,
	COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY,
	COMMAND_EVENT_CONTRACT_OVERLAY_LIMITATIONS,
	COMMAND_EVENT_CONTRACT_OVERLAY_METHOD,
	COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE,
	COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	type CommandEventContractBoundContribution,
	type CommandEventContractCommandRecord,
	type CommandEventContractDeclaredLink,
	type CommandEventContractEventRecord,
	type CommandEventContractFrontier,
	type CommandEventContractFrontierKind,
	type CommandEventContractHandlerReference,
	type CommandEventContractOverlayBuildInputs,
	type CommandEventContractOverlayCoverage,
	type CommandEventContractOverlayId,
	type CommandEventContractOverlayIndexEntry,
	type CommandEventContractOverlayLayer,
	type CommandEventContractOverlaySnapshot,
	type CommandEventContractOverlayValidationIssueCode,
	type CommandEventContractOverlayValidationOptions,
	type CommandEventContractOverlayValidationResult,
	type CommandEventContractPinnedEmission,
	type CommandEventContractRegistrySelector
} from '../contracts/command-event-contract-overlay.js';
import type {
	CommandHandlerGraphEdge,
	CommandHandlerGraphNode,
	CommandRegistryEntryNode
} from '../contracts/command-handler-graph.js';
import type {
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	SemanticReferenceRecord,
	SemanticSourceRecord,
	SemanticSymbolRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { CapturedArtifactRecord, FrozenSubject } from '../contracts/subject.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { isFrozenSubjectCapability, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import {
	commandEventContractBoundContributionId,
	commandEventContractCommandId,
	commandEventContractDeclaredLinkId,
	commandEventContractDerivationLayerId,
	commandEventContractEventId,
	commandEventContractFrontierId,
	commandEventContractInferenceLayerId,
	commandEventContractOverlayContentDigest,
	commandEventContractOverlayId,
	commandEventContractOverlayInputDigest,
	commandEventContractPinnedEmissionId,
	commandEventContractRetainedCensusArtifactSelector,
	commandEventContractRetainedCensusReference,
	commandEventContractVocabArtifactSelector
} from './command-event-contract-overlay-canonical.js';
import { commandHandlerGraphInputDigest } from './command-handler-graph-canonical.js';
import { validateConstructedCommandHandlerGraph } from './validate-command-handler-graph.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const INPUT_KEYS = [
	'arrowObservation',
	'commandHandlerGraph',
	'commandHandlerRequest',
	'request',
	'semanticSnapshot',
	'subject'
] as const;
const REQUEST_KEYS = [
	'arrowObservationId',
	'budgets',
	'commandHandlerGraphId',
	'commandRegistry',
	'eventRegistry',
	'operationVersion',
	'retainedCensusArtifact',
	'schemaVersion',
	'semanticSnapshotId',
	'subjectId',
	'vocabArtifact'
] as const;
const BUDGET_KEYS = [
	'maxAstNodes',
	'maxBoundContributions',
	'maxCommands',
	'maxDeclaredLinks',
	'maxDiagnostics',
	'maxEventContracts',
	'maxFrontiers',
	'maxPinnedEmissions',
	'maxSourceBytes'
] as const;
const SELECTOR_KEYS = [
	'contentSha256',
	'declarationId',
	'exportName',
	'logicalPath',
	'programId',
	'projectConfigPath',
	'projectId',
	'sourceId'
] as const;
const ARTIFACT_SELECTOR_KEYS = ['artifactBytes', 'artifactContentSha256', 'artifactPath'] as const;
const SNAPSHOT_KEYS = [
	'arrowObservationContentDigest',
	'arrowObservationId',
	'authorityTransfer',
	'baselineChange',
	'boundContributions',
	'budgets',
	'canonicalProfile',
	'capabilities',
	'capabilityStatus',
	'commandHandlerGraphContentDigest',
	'commandHandlerGraphId',
	'commandRegistry',
	'commands',
	'contentDigest',
	'coverage',
	'declaredLinks',
	'eventContracts',
	'eventRegistry',
	'forwardIndex',
	'frontiers',
	'fullJanCsaa007Conformance',
	'fullJanCsaa008Conformance',
	'gateEffect',
	'graphAuthority',
	'health',
	'id',
	'inputDigest',
	'integrationStrategy',
	'layers',
	'limitations',
	'method',
	'operationVersion',
	'oracleChange',
	'pinnedEmissions',
	'producer',
	'registryStatus',
	'replacementEquivalence',
	'retainedCensus',
	'reverseIndex',
	'runtimeEmission',
	'runtimePerformability',
	'schemaVersion',
	'scope',
	'semanticSnapshotId',
	'subjectId',
	'vocabArtifact'
] as const;

interface ValidationLimits {
	readonly maxDepth: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

interface InspectionFailure {
	readonly budget: boolean;
	readonly message: string;
	readonly path: string;
}

function plainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	if (keys.length !== expected.length || keys.some((key) => typeof key !== 'string')) return false;
	const ordered = [...expected].sort(compareText);
	return (keys as string[]).sort(compareText).every((key, index) => key === ordered[index]);
}

function inspectRecordShell(
	value: unknown,
	path: string,
	expectedKeys?: readonly string[]
): InspectionFailure | null {
	if (!plainObject(value))
		return { budget: false, message: 'Expected an exact plain record.', path };
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== 'string'))
		return { budget: false, message: 'Record may not have symbol keys.', path };
	if (expectedKeys !== undefined && !exactKeys(value, expectedKeys))
		return { budget: false, message: 'Record field set is invalid.', path };
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return {
				budget: false,
				message: 'Record fields must be enumerable data properties.',
				path: `${path}.${String(key)}`
			};
	}
	return null;
}

function inspectArrayShell(
	value: unknown,
	path: string,
	remainingRecords: number
): InspectionFailure | null {
	if (!Array.isArray(value) || isProxy(value) || Reflect.getPrototypeOf(value) !== Array.prototype)
		return { budget: false, message: 'Expected an exact ordinary array.', path };
	const length = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		length === undefined ||
		!('value' in length) ||
		!Number.isSafeInteger(length.value) ||
		(length.value as number) < 0
	)
		return { budget: false, message: 'Array length descriptor is invalid.', path };
	if ((length.value as number) > remainingRecords)
		return { budget: true, message: 'Input record budget cannot admit array population.', path };
	const keys = Reflect.ownKeys(value);
	if (keys.length !== (length.value as number) + 1)
		return { budget: false, message: 'Array must be dense and carry no extra properties.', path };
	for (const key of keys) {
		if (key === 'length') continue;
		if (typeof key !== 'string')
			return { budget: false, message: 'Array may not have symbol keys.', path };
		const index = Number(key);
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (
			!Number.isSafeInteger(index) ||
			index < 0 ||
			index >= (length.value as number) ||
			String(index) !== key ||
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor)
		)
			return { budget: false, message: 'Array population is sparse or accessor-backed.', path };
	}
	return null;
}

function materializeOptions(
	options: CommandEventContractOverlayValidationOptions | undefined
): ValidationLimits {
	const defaults: ValidationLimits = {
		maxDepth: 100_000,
		maxInputRecords: 10_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxIssues: 1_000,
		maxRecords: 10_000_000,
		maxStringCharacters: 1_000_000_000
	};
	if (options === undefined) return defaults;
	if (!plainObject(options))
		throw new TypeError('Validation options must be an exact plain record.');
	const allowed = new Set(Object.keys(defaults));
	const keys = Reflect.ownKeys(options);
	if (keys.some((key) => typeof key !== 'string' || !allowed.has(key)))
		throw new TypeError('Validation options contain an unsupported field.');
	const result = { ...defaults };
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError('Validation options must contain enumerable data properties only.');
		if (!Number.isSafeInteger(descriptor.value) || (descriptor.value as number) < 1)
			throw new TypeError(`${String(key)} must be a positive safe integer.`);
		(result as unknown as Record<string, number>)[String(key)] = descriptor.value as number;
	}
	return result;
}

/** Descriptor-only hostile-shape inspection performed before canonicalizers or predecessor validators. */
function inspectPlainData(
	roots: readonly { readonly path: string; readonly value: unknown }[],
	limits: {
		readonly maxDepth: number;
		readonly maxRecords: number;
		readonly maxStringCharacters: number;
	}
): InspectionFailure | null {
	type Frame = {
		readonly depth: number;
		readonly exit: boolean;
		readonly path: string;
		readonly value: unknown;
	};
	const pending: Frame[] = roots
		.map((root) => ({ depth: 0, exit: false, path: root.path, value: root.value }))
		.reverse();
	const active = new WeakSet<object>();
	let records = 0;
	let stringCharacters = 0;
	while (pending.length > 0) {
		const frame = pending.pop()!;
		const current = frame.value;
		if (frame.exit) {
			active.delete(current as object);
			continue;
		}
		if (frame.depth > limits.maxDepth)
			return {
				budget: true,
				message: `Structural depth budget exceeded: ${frame.depth} > ${limits.maxDepth}.`,
				path: frame.path
			};
		records += 1;
		if (records > limits.maxRecords)
			return {
				budget: true,
				message: `Structural record budget exceeded: ${records} > ${limits.maxRecords}.`,
				path: frame.path
			};
		if (typeof current === 'string') {
			stringCharacters += current.length;
			if (stringCharacters > limits.maxStringCharacters)
				return {
					budget: true,
					message: `String-character budget exceeded: ${stringCharacters} > ${limits.maxStringCharacters}.`,
					path: frame.path
				};
			continue;
		}
		if (
			current === null ||
			typeof current === 'boolean' ||
			(typeof current === 'number' && Number.isFinite(current) && !Object.is(current, -0))
		)
			continue;
		if (typeof current !== 'object')
			return {
				budget: false,
				message: 'Value contains a non-canonical JSON member.',
				path: frame.path
			};
		if (isProxy(current))
			return { budget: false, message: 'Value contains a Proxy.', path: frame.path };
		if (active.has(current))
			return { budget: false, message: 'Value contains a cyclic container.', path: frame.path };
		const array = Array.isArray(current);
		const prototype = Reflect.getPrototypeOf(current);
		if (
			(array && prototype !== Array.prototype) ||
			(!array && prototype !== Object.prototype && prototype !== null)
		)
			return { budget: false, message: 'Containers must have plain prototypes.', path: frame.path };
		let arrayLength = 0;
		if (array) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current, 'length');
			if (
				descriptor === undefined ||
				!('value' in descriptor) ||
				!Number.isSafeInteger(descriptor.value) ||
				(descriptor.value as number) < 0
			)
				return { budget: false, message: 'Array length descriptor is invalid.', path: frame.path };
			arrayLength = descriptor.value as number;
			if (arrayLength > limits.maxRecords - records)
				return {
					budget: true,
					message: 'Structural record budget cannot admit the array population.',
					path: frame.path
				};
		}
		const keys = Reflect.ownKeys(current);
		if (keys.length > limits.maxRecords - records)
			return {
				budget: true,
				message: 'Structural record budget cannot admit the container properties.',
				path: frame.path
			};
		if (keys.some((key) => typeof key !== 'string'))
			return { budget: false, message: 'Containers may not have symbol keys.', path: frame.path };
		if (array) {
			const dense = (key: PropertyKey): boolean => {
				if (key === 'length') return true;
				if (typeof key !== 'string') return false;
				const index = Number(key);
				return (
					Number.isSafeInteger(index) && index >= 0 && index < arrayLength && String(index) === key
				);
			};
			if (keys.length !== arrayLength + 1 || keys.some((key) => !dense(key)))
				return {
					budget: false,
					message: 'Arrays must be dense and may not carry extra properties.',
					path: frame.path
				};
		}
		active.add(current);
		pending.push({ ...frame, exit: true });
		for (const key of keys) {
			if (array && key === 'length') continue;
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				return {
					budget: false,
					message: 'Properties must be enumerable data properties.',
					path: `${frame.path}.${String(key)}`
				};
			stringCharacters += String(key).length;
			if (stringCharacters > limits.maxStringCharacters)
				return {
					budget: true,
					message: 'String-character budget exceeded while inspecting keys.',
					path: frame.path
				};
			pending.push({
				depth: frame.depth + 1,
				exit: false,
				path: array ? `${frame.path}[${String(key)}]` : `${frame.path}.${String(key)}`,
				value: descriptor.value
			});
		}
	}
	return null;
}

function invalidResult(
	code: CommandEventContractOverlayValidationIssueCode,
	path: string,
	message: string,
	budget = false
): CommandEventContractOverlayValidationResult {
	return {
		issues: [{ code, message, path }],
		state: budget ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

function same(left: unknown, right: unknown): boolean {
	return canonicalSemanticJson(left) === canonicalSemanticJson(right);
}

function sortedUnique<Id extends string>(values: Iterable<Id>): Id[] {
	return [...new Set(values)].sort(compareText);
}

function exactOne<Value>(values: readonly Value[], description: string): Value {
	if (values.length !== 1)
		throw new Error(`${description} must have exactly one member; found ${values.length}.`);
	return values[0]!;
}

function decodeUtf8(bytes: Uint8Array, description: string): string {
	const body =
		bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
			? bytes.subarray(3)
			: bytes;
	try {
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body);
	} catch {
		throw new Error(`${description} is not fatal-decodable UTF-8.`);
	}
}

interface SemanticModel {
	readonly declarationById: ReadonlyMap<string, SemanticDeclarationRecord>;
	readonly nodesBySpan: ReadonlyMap<string, SemanticAstNodeRecord[]>;
	readonly referenceByNode: ReadonlyMap<string, SemanticReferenceRecord[]>;
	readonly symbolById: ReadonlyMap<string, SemanticSymbolRecord>;
}

function uniqueMap<Value, Key>(
	values: readonly Value[],
	key: (value: Value) => Key,
	description: string
): Map<Key, Value> {
	const result = new Map<Key, Value>();
	for (const value of values) {
		const identity = key(value);
		if (result.has(identity)) throw new Error(`${description} identities are not unique.`);
		result.set(identity, value);
	}
	return result;
}

function addGrouped<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
	const values = map.get(key);
	if (values === undefined) map.set(key, [value]);
	else values.push(value);
}

function semanticModel(
	snapshot: StaticSemanticSnapshot,
	source: SemanticSourceRecord
): SemanticModel {
	const nodes = snapshot.astNodes.filter((node) => node.sourceId === source.id);
	const nodeById = uniqueMap(nodes, (node) => node.id, 'Selected semantic AST node');
	const declarations = snapshot.declarations.filter(
		(declaration) => declaration.sourceId === source.id
	);
	const declarationById = uniqueMap(
		declarations,
		(declaration) => declaration.id,
		'Selected semantic declaration'
	);
	const references = snapshot.references.filter((reference) => reference.sourceId === source.id);
	const symbolIds = new Set<string>();
	for (const declaration of declarations)
		if (declaration.symbolId !== null) symbolIds.add(declaration.symbolId);
	for (const reference of references)
		if (reference.resolvedSymbolId !== null) symbolIds.add(reference.resolvedSymbolId);
	const symbolById = uniqueMap(
		snapshot.symbols.filter((symbol) => symbolIds.has(symbol.id)),
		(symbol) => symbol.id,
		'Selected semantic symbol'
	);
	const nodesBySpan = new Map<string, SemanticAstNodeRecord[]>();
	for (const node of nodes) {
		if (node.parentId !== null && !nodeById.has(node.parentId))
			throw new Error(`Selected semantic node ${node.id} has no selected parent.`);
		addGrouped(nodesBySpan, `${node.kind}\0${node.start}\0${node.end}`, node);
	}
	const referenceByNode = new Map<string, SemanticReferenceRecord[]>();
	for (const reference of references) {
		if (!nodeById.has(reference.nodeId))
			throw new Error(`Selected semantic reference ${reference.id} has no selected node.`);
		if (reference.resolvedSymbolId !== null && !symbolById.has(reference.resolvedSymbolId))
			throw new Error(`Selected semantic reference ${reference.id} has no selected symbol.`);
		addGrouped(referenceByNode, reference.nodeId, reference);
	}
	for (const declaration of declarations) {
		if (declaration.nodeId !== null && !nodeById.has(declaration.nodeId))
			throw new Error(`Selected semantic declaration ${declaration.id} has no selected node.`);
	}
	return { declarationById, nodesBySpan, referenceByNode, symbolById };
}

function parseTypescript(text: string, path: string): ts.SourceFile {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const diagnostics = (
		source as ts.SourceFile & { readonly parseDiagnostics?: readonly ts.Diagnostic[] }
	).parseDiagnostics;
	if (diagnostics !== undefined && diagnostics.length > 0)
		throw new Error(`${path} has TypeScript parse diagnostics.`);
	return source;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
	let current = expression;
	while (
		ts.isAsExpression(current) ||
		ts.isSatisfiesExpression(current) ||
		ts.isTypeAssertionExpression(current) ||
		ts.isParenthesizedExpression(current) ||
		ts.isNonNullExpression(current)
	)
		current = current.expression;
	return current;
}

function staticPropertyName(name: ts.PropertyName): string | null {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))
		return name.text;
	return null;
}

function propertyMap(
	object: ts.ObjectLiteralExpression,
	description: string
): ReadonlyMap<string, ts.PropertyAssignment> {
	const result = new Map<string, ts.PropertyAssignment>();
	for (const member of object.properties) {
		if (!ts.isPropertyAssignment(member))
			throw new Error(`${description} contains an unsupported member form.`);
		const name = staticPropertyName(member.name);
		if (name === null || name.trim().length === 0)
			throw new Error(`${description} contains a computed or blank member name.`);
		if (result.has(name)) throw new Error(`${description} contains duplicate member ${name}.`);
		result.set(name, member);
	}
	return result;
}

function stringLiteral(expression: ts.Expression, description: string): ts.StringLiteralLike {
	const value = unwrapExpression(expression);
	if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value))
		throw new Error(`${description} must be one exact static string literal.`);
	if (value.text.trim().length === 0) throw new Error(`${description} may not be blank.`);
	return value;
}

function semanticNode(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	model: SemanticModel,
	description: string
): SemanticAstNodeRecord {
	const key = `${node.kind}\0${node.getStart(sourceFile, false)}\0${node.getEnd()}`;
	return exactOne(model.nodesBySpan.get(key) ?? [], `${description} semantic node`);
}

function frozenArtifact(
	subject: FrozenSubject,
	path: string
): {
	readonly artifact: CapturedArtifactRecord;
	readonly bytes: Uint8Array;
} {
	const artifact = exactOne(
		subject.artifacts.filter((candidate) => candidate.path === path),
		`Frozen ${path} artifact`
	);
	const bytes = readFrozenSubjectArtifact(subject, path);
	if (
		bytes === undefined ||
		bytes.byteLength !== artifact.bytes ||
		sha256(bytes) !== artifact.sha256
	)
		throw new Error(`Frozen ${path} bytes do not reproduce their exact artifact identity.`);
	return { artifact, bytes };
}

function selectedRegistrySource(inputs: CommandEventContractOverlayBuildInputs): {
	readonly bytes: Uint8Array;
	readonly source: SemanticSourceRecord;
	readonly text: string;
} {
	const { semanticSnapshot: snapshot, subject } = inputs;
	const project = exactOne(
		snapshot.projects.filter(
			(candidate) => candidate.configPath === COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH
		),
		'Generated-registry semantic project'
	);
	const program = exactOne(
		snapshot.programs.filter((candidate) => candidate.id === project.programId),
		'Generated-registry semantic Program'
	);
	if (program.projectId !== project.id)
		throw new Error('Generated-registry semantic project/program ownership is inconsistent.');
	const source = exactOne(
		snapshot.sources.filter(
			(candidate) =>
				candidate.logicalPath === COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH &&
				candidate.projectId === project.id &&
				candidate.programId === program.id &&
				candidate.analysisDisposition === 'DEEP_INDEXED'
		),
		'Generated-registry deep semantic source'
	);
	const { artifact, bytes } = frozenArtifact(subject, COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH);
	if (
		source.id !== inputs.request.commandRegistry.sourceId ||
		source.id !== inputs.request.eventRegistry.sourceId ||
		source.projectId !== inputs.request.commandRegistry.projectId ||
		source.projectId !== inputs.request.eventRegistry.projectId ||
		source.programId !== inputs.request.commandRegistry.programId ||
		source.programId !== inputs.request.eventRegistry.programId ||
		source.contentSha256 !== inputs.request.commandRegistry.contentSha256 ||
		source.contentSha256 !== inputs.request.eventRegistry.contentSha256 ||
		source.contentSha256 !== artifact.sha256 ||
		source.bytes !== bytes.byteLength ||
		artifact.bytes !== bytes.byteLength
	)
		throw new Error('Generated-registry selector, semantic source, and frozen bytes differ.');
	const text = decodeUtf8(bytes, COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH);
	if (text.length !== source.textLength)
		throw new Error('Generated-registry frozen text length differs from semantic identity.');
	return { bytes, source, text };
}

interface RegistryParse {
	readonly commandProperties: readonly ts.PropertyAssignment[];
	readonly eventProperties: readonly ts.PropertyAssignment[];
	readonly sourceFile: ts.SourceFile;
}

function registryDeclaration(
	sourceFile: ts.SourceFile,
	exportName: 'COMMANDS' | 'EVENTS',
	selector: CommandEventContractRegistrySelector,
	inputs: CommandEventContractOverlayBuildInputs,
	model: SemanticModel
): ts.VariableDeclaration {
	const declarations: {
		readonly declaration: ts.VariableDeclaration;
		readonly flags: ts.NodeFlags;
	}[] = [];
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations)
			if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName)
				declarations.push({ declaration, flags: statement.declarationList.flags });
	}
	const selected = exactOne(declarations, `${exportName} top-level declaration`);
	if ((selected.flags & ts.NodeFlags.Const) === 0)
		throw new Error(`${exportName} must be a top-level const declaration.`);
	const semanticDeclarations = [...model.declarationById.values()].filter(
		(declaration) =>
			declaration.sourceId === selector.sourceId &&
			declaration.name === exportName &&
			declaration.kind === ts.SyntaxKind.VariableDeclaration &&
			declaration.nodeId !== null
	);
	const semanticDeclaration = exactOne(semanticDeclarations, `${exportName} semantic declaration`);
	const declarationNode = semanticNode(
		selected.declaration,
		sourceFile,
		model,
		`${exportName} declaration`
	);
	if (
		selector.exportName !== exportName ||
		selector.logicalPath !== COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH ||
		selector.projectConfigPath !== COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH ||
		selector.declarationId !== semanticDeclaration.id ||
		semanticDeclaration.nodeId !== declarationNode.id
	)
		throw new Error(`${exportName} request selector does not bind its exact declaration.`);
	return selected.declaration;
}

function parseRegistries(
	inputs: CommandEventContractOverlayBuildInputs,
	model: SemanticModel,
	selected: ReturnType<typeof selectedRegistrySource>
): RegistryParse {
	const sourceFile = parseTypescript(selected.text, COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH);
	const commands = registryDeclaration(
		sourceFile,
		'COMMANDS',
		inputs.request.commandRegistry,
		inputs,
		model
	);
	const events = registryDeclaration(
		sourceFile,
		'EVENTS',
		inputs.request.eventRegistry,
		inputs,
		model
	);
	if (commands.initializer === undefined || events.initializer === undefined)
		throw new Error('Generated registries must have exact initializers.');
	const commandObject = unwrapExpression(commands.initializer);
	const eventObject = unwrapExpression(events.initializer);
	if (!ts.isObjectLiteralExpression(commandObject) || !ts.isObjectLiteralExpression(eventObject))
		throw new Error('Generated registry initializers must be object literals.');
	return {
		commandProperties: [...propertyMap(commandObject, 'COMMANDS registry').values()],
		eventProperties: [...propertyMap(eventObject, 'EVENTS registry').values()],
		sourceFile
	};
}

interface ParsedEventContract {
	readonly aggregateType: string;
	readonly aggregateTypeNode: SemanticAstNodeRecord;
	readonly eventName: string;
	readonly nameNode: SemanticAstNodeRecord;
	readonly payloadDeclaration: SemanticDeclarationRecord;
	readonly payloadNode: SemanticAstNodeRecord;
	readonly payloadReference: SemanticReferenceRecord;
	readonly payloadSymbol: SemanticSymbolRecord;
	readonly propertyNode: SemanticAstNodeRecord;
}

interface ParsedCommandDeclaration {
	readonly additional: readonly {
		readonly eventName: string;
		readonly node: SemanticAstNodeRecord;
		readonly propertyNode: SemanticAstNodeRecord;
	}[];
	readonly commandName: string;
	readonly nameNode: SemanticAstNodeRecord;
	readonly primary: {
		readonly eventName: string;
		readonly node: SemanticAstNodeRecord;
		readonly propertyNode: SemanticAstNodeRecord;
	};
	readonly propertyNode: SemanticAstNodeRecord;
}

function parseEventContracts(
	properties: readonly ts.PropertyAssignment[],
	sourceFile: ts.SourceFile,
	source: SemanticSourceRecord,
	model: SemanticModel
): ParsedEventContract[] {
	const parsed = properties.map((property): ParsedEventContract => {
		const eventName = staticPropertyName(property.name);
		if (eventName === null || eventName.trim().length === 0)
			throw new Error('EVENTS contains a computed or blank event name.');
		const value = unwrapExpression(property.initializer);
		if (!ts.isObjectLiteralExpression(value))
			throw new Error(`EVENTS.${eventName} is not an exact object literal.`);
		const fields = propertyMap(value, `EVENTS.${eventName}`);
		const payload = fields.get('payload');
		const aggregate = fields.get('aggregateType');
		if (payload === undefined || aggregate === undefined)
			throw new Error(`EVENTS.${eventName} lacks payload or aggregateType.`);
		const aggregateLiteral = stringLiteral(
			aggregate.initializer,
			`EVENTS.${eventName}.aggregateType`
		);
		const payloadExpression = unwrapExpression(payload.initializer);
		if (!ts.isIdentifier(payloadExpression))
			throw new Error(`EVENTS.${eventName}.payload is not one exact schema reference.`);
		const payloadNode = semanticNode(
			payloadExpression,
			sourceFile,
			model,
			`EVENTS.${eventName}.payload`
		);
		const references = (model.referenceByNode.get(payloadNode.id) ?? []).filter(
			(reference) =>
				(reference.role === 'SYMBOL_USE' || reference.role === 'IMPORT_EXPORT_BINDING') &&
				reference.resolvedSymbolId !== null &&
				(reference.resolutionState === 'RESOLVED_DIRECT' ||
					reference.resolutionState === 'RESOLVED_ALIAS')
		);
		const payloadReference = exactOne(references, `EVENTS.${eventName}.payload resolved reference`);
		const payloadSymbol = model.symbolById.get(payloadReference.resolvedSymbolId!);
		if (payloadSymbol === undefined)
			throw new Error(`EVENTS.${eventName}.payload terminal symbol is absent.`);
		const expectedName = `${eventName}PayloadSchema`;
		const payloadDeclarations = payloadSymbol.declarationIds
			.map((id) => model.declarationById.get(id))
			.filter(
				(declaration): declaration is SemanticDeclarationRecord =>
					declaration !== undefined &&
					declaration.sourceId === source.id &&
					declaration.name === expectedName
			);
		const payloadDeclaration = exactOne(
			payloadDeclarations,
			`EVENTS.${eventName} terminal payload declaration`
		);
		return {
			aggregateType: aggregateLiteral.text,
			aggregateTypeNode: semanticNode(
				aggregateLiteral,
				sourceFile,
				model,
				`EVENTS.${eventName}.aggregateType`
			),
			eventName,
			nameNode: semanticNode(property.name, sourceFile, model, `EVENTS.${eventName} name`),
			payloadDeclaration,
			payloadNode,
			payloadReference,
			payloadSymbol,
			propertyNode: semanticNode(property, sourceFile, model, `EVENTS.${eventName}`)
		};
	});
	if (new Set(parsed.map((item) => item.eventName)).size !== parsed.length)
		throw new Error('EVENTS contains duplicate event names.');
	return parsed.sort((left, right) => compareText(left.eventName, right.eventName));
}

function parseCommandDeclarations(
	properties: readonly ts.PropertyAssignment[],
	sourceFile: ts.SourceFile,
	model: SemanticModel
): ParsedCommandDeclaration[] {
	const parsed = properties.map((property): ParsedCommandDeclaration => {
		const commandName = staticPropertyName(property.name);
		if (commandName === null || commandName.trim().length === 0)
			throw new Error('COMMANDS contains a computed or blank command name.');
		const value = unwrapExpression(property.initializer);
		if (!ts.isObjectLiteralExpression(value))
			throw new Error(`COMMANDS.${commandName} is not an exact object literal.`);
		const fields = propertyMap(value, `COMMANDS.${commandName}`);
		const primaryProperty = fields.get('emitsEvent');
		if (primaryProperty === undefined)
			throw new Error(`COMMANDS.${commandName}.emitsEvent is absent.`);
		const primaryLiteral = stringLiteral(
			primaryProperty.initializer,
			`COMMANDS.${commandName}.emitsEvent`
		);
		const additionalProperty = fields.get('alsoEmitsEvents');
		const additional: {
			readonly eventName: string;
			readonly node: SemanticAstNodeRecord;
			readonly propertyNode: SemanticAstNodeRecord;
		}[] = [];
		if (additionalProperty !== undefined) {
			const additionalPropertyNode = semanticNode(
				additionalProperty,
				sourceFile,
				model,
				`COMMANDS.${commandName}.alsoEmitsEvents property`
			);
			const expression = unwrapExpression(additionalProperty.initializer);
			if (!ts.isArrayLiteralExpression(expression))
				throw new Error(`COMMANDS.${commandName}.alsoEmitsEvents is not an exact array literal.`);
			for (const element of expression.elements) {
				if (ts.isSpreadElement(element) || ts.isOmittedExpression(element))
					throw new Error(`COMMANDS.${commandName}.alsoEmitsEvents is open or sparse.`);
				const literal = stringLiteral(element, `COMMANDS.${commandName}.alsoEmitsEvents member`);
				additional.push({
					eventName: literal.text,
					node: semanticNode(
						literal,
						sourceFile,
						model,
						`COMMANDS.${commandName}.alsoEmitsEvents member`
					),
					propertyNode: additionalPropertyNode
				});
			}
			if (new Set(additional.map((item) => item.eventName)).size !== additional.length)
				throw new Error(`COMMANDS.${commandName}.alsoEmitsEvents contains duplicates.`);
		}
		if (additional.some((item) => item.eventName === primaryLiteral.text))
			throw new Error(`COMMANDS.${commandName} repeats its primary event as an additional event.`);
		return {
			additional,
			commandName,
			nameNode: semanticNode(property.name, sourceFile, model, `COMMANDS.${commandName} name`),
			primary: {
				eventName: primaryLiteral.text,
				node: semanticNode(primaryLiteral, sourceFile, model, `COMMANDS.${commandName}.emitsEvent`),
				propertyNode: semanticNode(
					primaryProperty,
					sourceFile,
					model,
					`COMMANDS.${commandName}.emitsEvent property`
				)
			},
			propertyNode: semanticNode(property, sourceFile, model, `COMMANDS.${commandName}`)
		};
	});
	if (new Set(parsed.map((item) => item.commandName)).size !== parsed.length)
		throw new Error('COMMANDS contains duplicate command names.');
	return parsed.sort((left, right) => compareText(left.commandName, right.commandName));
}

function graphNodeMaps(graph: CommandEventContractOverlayBuildInputs['commandHandlerGraph']): {
	readonly commandByName: ReadonlyMap<string, CommandRegistryEntryNode>;
	readonly edgeById: ReadonlyMap<string, CommandHandlerGraphEdge>;
	readonly nodeById: ReadonlyMap<string, CommandHandlerGraphNode>;
} {
	const nodeById = uniqueMap(graph.nodes, (node) => node.id, 'Command-handler graph node');
	const edgeById = uniqueMap(graph.edges, (edge) => edge.id, 'Command-handler graph edge');
	const commandNodes = graph.nodes.filter(
		(node): node is CommandRegistryEntryNode => node.kind === 'COMMAND_REGISTRY_ENTRY'
	);
	const commandByName = uniqueMap(
		commandNodes,
		(node) => node.commandName,
		'Command registry name'
	);
	return { commandByName, edgeById, nodeById };
}

function handlerReferences(
	command: CommandRegistryEntryNode,
	graph: CommandEventContractOverlayBuildInputs['commandHandlerGraph'],
	nodeById: ReadonlyMap<string, CommandHandlerGraphNode>
): CommandEventContractHandlerReference[] {
	const registrationEdges = graph.edges.filter(
		(edge) =>
			edge.relationKind === 'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION' &&
			edge.source.nodeId === command.id
	);
	if (registrationEdges.length === 0) return [];
	const registrationEdge = exactOne(
		registrationEdges,
		`Command ${command.commandName} registration edge`
	);
	const registration = nodeById.get(registrationEdge.target.nodeId);
	if (registration?.kind !== 'HANDLER_REGISTRATION')
		throw new Error(`Command ${command.commandName} registration endpoint is invalid.`);
	const targetEdges = graph.edges.filter(
		(edge) =>
			edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET' &&
			edge.source.nodeId === registration.id
	);
	if (targetEdges.length === 0)
		return [
			{
				registrationNodeId: registration.id,
				supportingEdgeIds: [registrationEdge.id],
				targetNodeId: null,
				upstreamAttribution: 'UNRESOLVED'
			}
		];
	const targetEdge = exactOne(targetEdges, `Command ${command.commandName} handler-target edge`);
	const target = nodeById.get(targetEdge.target.nodeId);
	if (target?.kind !== 'HANDLER_TARGET')
		throw new Error(`Command ${command.commandName} handler-target endpoint is invalid.`);
	return [
		{
			registrationNodeId: registration.id,
			supportingEdgeIds: sortedUnique([registrationEdge.id, targetEdge.id]),
			targetNodeId: target.id,
			upstreamAttribution: targetEdge.attribution
		}
	];
}

interface GeneratedPopulation {
	readonly commands: readonly CommandEventContractCommandRecord[];
	readonly declaredLinks: readonly CommandEventContractDeclaredLink[];
	readonly eventContracts: readonly CommandEventContractEventRecord[];
	readonly missing: readonly {
		readonly commandId: CommandEventContractCommandRecord['id'];
		readonly eventName: string;
	}[];
}

function generatedPopulation(
	overlayId: CommandEventContractOverlayId,
	commands: readonly ParsedCommandDeclaration[],
	events: readonly ParsedEventContract[],
	inputs: CommandEventContractOverlayBuildInputs
): GeneratedPopulation {
	const graph = graphNodeMaps(inputs.commandHandlerGraph);
	const eventByName = new Map(events.map((event) => [event.eventName, event]));
	const eventContracts = events.map((event): CommandEventContractEventRecord => ({
		aggregateType: event.aggregateType,
		aggregateTypeNodeId: event.aggregateTypeNode.id,
		eventName: event.eventName,
		id: commandEventContractEventId(overlayId, event.eventName),
		nameNodeId: event.nameNode.id,
		payloadDeclarationId: event.payloadDeclaration.id,
		payloadNodeId: event.payloadNode.id,
		payloadReferenceId: event.payloadReference.id,
		payloadSymbolId: event.payloadSymbol.id,
		propertyNodeId: event.propertyNode.id,
		sourceId: event.propertyNode.sourceId
	}));
	const eventRecordByName = new Map(eventContracts.map((event) => [event.eventName, event]));
	const mutableCommands: {
		readonly parsed: ParsedCommandDeclaration;
		readonly record: Omit<CommandEventContractCommandRecord, 'declaredLinkIds'>;
		readonly linkIds: CommandEventContractDeclaredLink['id'][];
	}[] = [];
	const declaredLinks: CommandEventContractDeclaredLink[] = [];
	const missing: GeneratedPopulation['missing'][number][] = [];
	for (const parsed of commands) {
		const graphCommand = graph.commandByName.get(parsed.commandName);
		if (graphCommand === undefined)
			throw new Error(
				`Generated command ${parsed.commandName} is absent from the predecessor graph.`
			);
		if (
			graphCommand.nameNodeId !== parsed.nameNode.id ||
			graphCommand.propertyNodeId !== parsed.propertyNode.id ||
			graphCommand.sourceId !== inputs.request.commandRegistry.sourceId
		)
			throw new Error(
				`Generated command ${parsed.commandName} differs from predecessor graph identity.`
			);
		const commandId = commandEventContractCommandId(overlayId, parsed.commandName);
		const linkIds: CommandEventContractDeclaredLink['id'][] = [];
		const declarations = [
			{
				eventName: parsed.primary.eventName,
				node: parsed.primary.node,
				ordinal: 0,
				propertyNode: parsed.primary.propertyNode,
				role: 'PRIMARY'
			},
			...parsed.additional.map((item, index) => ({
				eventName: item.eventName,
				node: item.node,
				ordinal: index + 1,
				propertyNode: item.propertyNode,
				role: 'ADDITIONAL' as const
			}))
		] as const;
		for (const declaration of declarations) {
			const event = eventRecordByName.get(declaration.eventName);
			if (event === undefined || !eventByName.has(declaration.eventName)) {
				missing.push({ commandId, eventName: declaration.eventName });
				continue;
			}
			const id = commandEventContractDeclaredLinkId({
				commandName: parsed.commandName,
				eventName: declaration.eventName,
				ordinal: declaration.ordinal,
				overlayId,
				role: declaration.role
			});
			linkIds.push(id);
			declaredLinks.push({
				attribution: 'EXACT',
				commandId,
				commandName: parsed.commandName,
				eventId: event.id,
				eventName: declaration.eventName,
				eventNameNodeId: declaration.node.id,
				id,
				ordinal: declaration.ordinal,
				role: declaration.role,
				supportingNodeIds: sortedUnique([
					parsed.propertyNode.id,
					declaration.propertyNode.id,
					declaration.node.id
				])
			});
		}
		mutableCommands.push({
			linkIds,
			parsed,
			record: {
				commandHandlerGraphId: inputs.commandHandlerGraph.id,
				commandName: parsed.commandName,
				commandNodeId: graphCommand.id,
				handlerReferences: handlerReferences(
					graphCommand,
					inputs.commandHandlerGraph,
					graph.nodeById
				),
				id: commandId,
				nameNodeId: parsed.nameNode.id,
				propertyNodeId: parsed.propertyNode.id
			}
		});
	}
	if (graph.commandByName.size !== commands.length)
		throw new Error('Generated COMMANDS and predecessor command population sizes differ.');
	declaredLinks.sort(
		(left, right) =>
			compareText(left.commandName, right.commandName) ||
			left.ordinal - right.ordinal ||
			compareText(left.id, right.id)
	);
	const commandsOutput = mutableCommands
		.map((item): CommandEventContractCommandRecord => ({
			...item.record,
			declaredLinkIds: [...item.linkIds].sort(compareText)
		}))
		.sort((left, right) => compareText(left.commandName, right.commandName));
	return { commands: commandsOutput, declaredLinks, eventContracts, missing };
}

interface VocabCommand {
	readonly additionalEvents: readonly string[];
	readonly commandName: string;
	readonly from: string | null;
	readonly machine: string | null;
	readonly ordinal: number;
	readonly primaryEvent: string;
	readonly to: string | null;
}

interface VocabBinding {
	readonly commandName: string;
	readonly eventName: string;
	readonly from: string | null;
	readonly machine: string | null;
	readonly ordinal: number;
	readonly to: string | null;
}

interface VocabPopulation {
	readonly bindings: readonly VocabBinding[];
	readonly commands: readonly VocabCommand[];
	readonly eventNames: ReadonlySet<string>;
}

function optionalString(
	record: Record<string, unknown>,
	key: string,
	description: string
): string | null {
	const value = record[key];
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string')
		throw new Error(`${description}.${key} must be text when present.`);
	return value;
}

function requiredName(record: Record<string, unknown>, key: string, description: string): string {
	const value = record[key];
	if (typeof value !== 'string' || value.trim().length === 0)
		throw new Error(`${description}.${key} must be nonblank text.`);
	return value;
}

function assertJsonNoDuplicateKeys(text: string): void {
	const source = ts.parseJsonText(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH, text);
	const diagnostics = (
		source as ts.JsonSourceFile & { readonly parseDiagnostics?: readonly ts.Diagnostic[] }
	).parseDiagnostics;
	if (diagnostics !== undefined && diagnostics.length > 0)
		throw new Error('Vocab artifact has JSON parse diagnostics.');
	const visit = (node: ts.Node): void => {
		if (ts.isObjectLiteralExpression(node)) {
			const names = new Set<string>();
			for (const property of node.properties) {
				if (!ts.isPropertyAssignment(property))
					throw new Error('Vocab JSON contains an unsupported object member.');
				const name = staticPropertyName(property.name);
				if (name === null || names.has(name))
					throw new Error('Vocab JSON contains a duplicate or computed object key.');
				names.add(name);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
}

function parseVocab(text: string): VocabPopulation {
	assertJsonNoDuplicateKeys(text);
	const value: unknown = JSON.parse(text);
	if (!plainObject(value)) throw new Error('Vocab root must be an object.');
	if (
		!Array.isArray(value.commands) ||
		!Array.isArray(value.events) ||
		!Array.isArray(value.bindings)
	)
		throw new Error('Vocab commands, events, and bindings must be arrays.');
	const commands = value.commands.map((entry, ordinal): VocabCommand => {
		if (!plainObject(entry)) throw new Error(`Vocab command ${ordinal} must be an object.`);
		const additional = entry.alsoEmitsEvents;
		if (additional !== undefined && !Array.isArray(additional))
			throw new Error(`Vocab command ${ordinal}.alsoEmitsEvents must be an array.`);
		const additionalEvents = (additional ?? []).map((item, index) => {
			if (typeof item !== 'string' || item.trim().length === 0)
				throw new Error(`Vocab command ${ordinal}.alsoEmitsEvents[${index}] is invalid.`);
			return item;
		});
		if (new Set(additionalEvents).size !== additionalEvents.length)
			throw new Error(`Vocab command ${ordinal} repeats an additional event.`);
		return {
			additionalEvents,
			commandName: requiredName(entry, 'commandType', `Vocab command ${ordinal}`),
			from: optionalString(entry, 'drivesFrom', `Vocab command ${ordinal}`),
			machine: optionalString(entry, 'drivesMachine', `Vocab command ${ordinal}`),
			ordinal,
			primaryEvent: requiredName(entry, 'emitsEvent', `Vocab command ${ordinal}`),
			to: optionalString(entry, 'drivesTo', `Vocab command ${ordinal}`)
		};
	});
	if (new Set(commands.map((command) => command.commandName)).size !== commands.length)
		throw new Error('Vocab contains duplicate command names.');
	const eventNames = value.events.map((entry, ordinal) => {
		if (!plainObject(entry)) throw new Error(`Vocab event ${ordinal} must be an object.`);
		return requiredName(entry, 'eventType', `Vocab event ${ordinal}`);
	});
	if (new Set(eventNames).size !== eventNames.length)
		throw new Error('Vocab contains duplicate event names.');
	const eventSet = new Set(eventNames);
	const commandByName = new Map(commands.map((command) => [command.commandName, command]));
	for (const command of commands)
		for (const eventName of [command.primaryEvent, ...command.additionalEvents])
			if (!eventSet.has(eventName))
				throw new Error(`Vocab command ${command.commandName} names unknown event ${eventName}.`);
	const bindings = value.bindings.map((entry, ordinal): VocabBinding => {
		if (!plainObject(entry)) throw new Error(`Vocab binding ${ordinal} must be an object.`);
		const commandName = requiredName(entry, 'commandType', `Vocab binding ${ordinal}`);
		const eventName = requiredName(entry, 'eventType', `Vocab binding ${ordinal}`);
		const command = commandByName.get(commandName);
		if (command === undefined) throw new Error(`Vocab binding ${ordinal} names unknown command.`);
		if (!eventSet.has(eventName)) throw new Error(`Vocab binding ${ordinal} names unknown event.`);
		if (![command.primaryEvent, ...command.additionalEvents].includes(eventName))
			throw new Error(`Vocab binding ${ordinal} conflicts with command ${commandName}.`);
		return {
			commandName,
			eventName,
			from: optionalString(entry, 'from', `Vocab binding ${ordinal}`),
			machine: optionalString(entry, 'machine', `Vocab binding ${ordinal}`),
			ordinal,
			to: optionalString(entry, 'to', `Vocab binding ${ordinal}`)
		};
	});
	const bindingKeys = bindings.map(({ ordinal: _ordinal, ...binding }) =>
		canonicalSemanticJson(binding)
	);
	if (new Set(bindingKeys).size !== bindingKeys.length)
		throw new Error('Vocab contains duplicate exact binding rows.');
	return { bindings, commands, eventNames: eventSet };
}

function boundContributions(
	overlayId: CommandEventContractOverlayId,
	vocab: VocabPopulation
): CommandEventContractBoundContribution[] {
	const contributions: CommandEventContractBoundContribution[] = [
		...vocab.commands.map((command): CommandEventContractBoundContribution => ({
			commandName: command.commandName,
			eventName: command.primaryEvent,
			from: command.from,
			id: commandEventContractBoundContributionId({
				commandName: command.commandName,
				eventName: command.primaryEvent,
				ordinal: command.ordinal,
				overlayId,
				sourceKind: 'COMMAND_PRIMARY'
			}),
			machine: command.machine,
			ordinal: command.ordinal,
			sourceKind: 'COMMAND_PRIMARY',
			to: command.to
		})),
		...vocab.bindings.map((binding): CommandEventContractBoundContribution => ({
			commandName: binding.commandName,
			eventName: binding.eventName,
			from: binding.from,
			id: commandEventContractBoundContributionId({
				commandName: binding.commandName,
				eventName: binding.eventName,
				ordinal: binding.ordinal,
				overlayId,
				sourceKind: 'TRANSITION_BINDING'
			}),
			machine: binding.machine,
			ordinal: binding.ordinal,
			sourceKind: 'TRANSITION_BINDING',
			to: binding.to
		}))
	];
	return contributions.sort(
		(left, right) =>
			compareText(left.sourceKind, right.sourceKind) ||
			left.ordinal - right.ordinal ||
			compareText(left.commandName, right.commandName) ||
			compareText(left.eventName, right.eventName)
	);
}

function propertyAccess(
	expression: ts.Expression,
	objectName: string,
	propertyName: string
): boolean {
	const current = unwrapExpression(expression);
	return (
		ts.isPropertyAccessExpression(current) &&
		ts.isIdentifier(current.expression) &&
		current.expression.text === objectName &&
		current.name.text === propertyName
	);
}

function emptyArray(expression: ts.Expression): boolean {
	const current = unwrapExpression(expression);
	return ts.isArrayLiteralExpression(current) && current.elements.length === 0;
}

function retainedBoundSpread(
	element: ts.Expression,
	collectionName: 'bindings' | 'commands',
	valueName: 'emitsEvent' | 'eventType'
): boolean {
	const call = unwrapExpression(element);
	if (
		!ts.isCallExpression(call) ||
		call.typeArguments?.length ||
		call.arguments.length !== 1 ||
		!ts.isPropertyAccessExpression(call.expression) ||
		call.expression.name.text !== 'flatMap'
	)
		return false;
	const fallback = unwrapExpression(call.expression.expression);
	if (
		!ts.isBinaryExpression(fallback) ||
		fallback.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken ||
		!propertyAccess(fallback.left, 'vocab', collectionName) ||
		!emptyArray(fallback.right)
	)
		return false;
	const callback = unwrapExpression(call.arguments[0]!);
	if (
		!ts.isArrowFunction(callback) ||
		callback.modifiers !== undefined ||
		callback.typeParameters !== undefined ||
		callback.parameters.length !== 1 ||
		callback.parameters[0]!.dotDotDotToken !== undefined ||
		callback.parameters[0]!.initializer !== undefined ||
		callback.parameters[0]!.type !== undefined ||
		!ts.isIdentifier(callback.parameters[0]!.name) ||
		ts.isBlock(callback.body)
	)
		return false;
	const parameter = callback.parameters[0]!.name.text;
	const conditional = unwrapExpression(callback.body);
	if (
		!ts.isConditionalExpression(conditional) ||
		!propertyAccess(conditional.condition, parameter, valueName) ||
		!emptyArray(conditional.whenFalse)
	)
		return false;
	const truthy = unwrapExpression(conditional.whenTrue);
	return (
		ts.isArrayLiteralExpression(truthy) &&
		truthy.elements.length === 1 &&
		!ts.isSpreadElement(truthy.elements[0]!) &&
		!ts.isOmittedExpression(truthy.elements[0]!) &&
		propertyAccess(truthy.elements[0]!, parameter, valueName)
	);
}

function assertRetainedBoundFormula(sourceFile: ts.SourceFile): void {
	const declarations: {
		readonly declaration: ts.VariableDeclaration;
		readonly flags: ts.NodeFlags;
	}[] = [];
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations)
			if (ts.isIdentifier(declaration.name) && declaration.name.text === 'BOUND')
				declarations.push({ declaration, flags: statement.declarationList.flags });
	}
	const selected = exactOne(declarations, 'Retained BOUND declaration');
	const initializer = selected.declaration.initializer;
	if (
		(selected.flags & ts.NodeFlags.Const) === 0 ||
		initializer === undefined ||
		!ts.isNewExpression(unwrapExpression(initializer))
	)
		throw new Error('Retained BOUND must be one top-level const Set initializer.');
	const construction = unwrapExpression(initializer) as ts.NewExpression;
	if (
		!ts.isIdentifier(construction.expression) ||
		construction.expression.text !== 'Set' ||
		construction.typeArguments?.length !== 1 ||
		construction.typeArguments[0]!.kind !== ts.SyntaxKind.StringKeyword ||
		construction.arguments?.length !== 1
	)
		throw new Error('Retained BOUND must be one exact Set<string> construction.');
	const array = unwrapExpression(construction.arguments[0]!);
	if (
		!ts.isArrayLiteralExpression(array) ||
		array.elements.length !== 2 ||
		!ts.isSpreadElement(array.elements[0]!) ||
		!ts.isSpreadElement(array.elements[1]!) ||
		!retainedBoundSpread(array.elements[0]!.expression, 'commands', 'emitsEvent') ||
		!retainedBoundSpread(array.elements[1]!.expression, 'bindings', 'eventType')
	)
		throw new Error('Retained BOUND formula no longer has the supported exact set derivation.');
}

function parsePinnedEmissions(
	overlayId: CommandEventContractOverlayId,
	text: string
): CommandEventContractPinnedEmission[] {
	const sourceFile = parseTypescript(text, COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH);
	assertRetainedBoundFormula(sourceFile);
	const declarations: {
		readonly declaration: ts.VariableDeclaration;
		readonly flags: ts.NodeFlags;
	}[] = [];
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations)
			if (ts.isIdentifier(declaration.name) && declaration.name.text === 'EMITTED_2026_08_04')
				declarations.push({ declaration, flags: statement.declarationList.flags });
	}
	const selected = exactOne(declarations, 'Retained EMITTED_2026_08_04 declaration');
	if ((selected.flags & ts.NodeFlags.Const) === 0 || selected.declaration.initializer === undefined)
		throw new Error('Retained EMITTED_2026_08_04 must be one top-level const initializer.');
	const initializer = unwrapExpression(selected.declaration.initializer);
	if (
		!ts.isNewExpression(initializer) ||
		!ts.isIdentifier(initializer.expression) ||
		initializer.expression.text !== 'Set' ||
		(initializer.typeArguments?.length ?? 0) > 0 ||
		initializer.arguments?.length !== 1
	)
		throw new Error('Retained EMITTED_2026_08_04 must be a direct untyped Set construction.');
	const array = unwrapExpression(initializer.arguments[0]!);
	if (!ts.isArrayLiteralExpression(array))
		throw new Error('Retained EMITTED_2026_08_04 Set input must be one array literal.');
	const names = array.elements.map((element, ordinal) => {
		if (ts.isSpreadElement(element) || ts.isOmittedExpression(element))
			throw new Error('Retained EMITTED_2026_08_04 array is open or sparse.');
		return { eventName: stringLiteral(element, `Pinned emission ${ordinal}`).text, ordinal };
	});
	if (new Set(names.map((item) => item.eventName)).size !== names.length)
		throw new Error('Retained EMITTED_2026_08_04 contains duplicate names.');
	return names.map((item): CommandEventContractPinnedEmission => ({
		eventName: item.eventName,
		id: commandEventContractPinnedEmissionId({ ...item, overlayId }),
		ordinal: item.ordinal,
		retainedMeasurement: 'EMITTED_2026_08_04'
	}));
}

function frontierReason(kind: CommandEventContractFrontierKind): string {
	switch (kind) {
		case 'COMMAND_WITHOUT_TRANSITION_BINDING':
			return 'The command has no retained transition-binding row; declaration presence does not prove behavioral absence.';
		case 'DECLARED_NEITHER_BOUND_NOR_PINNED_EMITTED':
			return 'The EVENTS contract is neither retained BOUND nor present in the dated pinned EMITTED set.';
		case 'GENERATED_EVENT_SCHEMA_UNRESOLVED':
			return 'The generated command event declaration has no exact EVENTS payload-contract entry.';
		case 'GENERATED_RETAINED_BOUND_SET_MISMATCH':
			return 'Generated command-declared and retained BOUND event-name sets differ.';
		case 'PINNED_EMITTED_NOT_RETAINED_BOUND':
			return 'The dated retained EMITTED set names an event absent from retained BOUND.';
		case 'RETAINED_BOUND_NOT_PINNED_EMITTED':
			return 'Retained BOUND names an event absent from the dated pinned EMITTED set.';
		case 'UNSUPPORTED_GENERATED_EVENT_DECLARATION':
			return 'A generated event declaration is outside the supported exact compiler-backed grammar.';
		case 'UNSUPPORTED_RETAINED_CENSUS_GRAMMAR':
			return 'The retained event-surface census is outside the supported exact static grammar.';
		case 'UNSUPPORTED_VOCAB_BINDING':
			return 'A vocab binding is outside the supported exact static grammar.';
	}
}

function makeFrontier(
	overlayId: CommandEventContractOverlayId,
	frontierKind: CommandEventContractFrontierKind,
	commandId: CommandEventContractFrontier['commandId'],
	eventId: CommandEventContractFrontier['eventId'],
	eventName: string | null
): CommandEventContractFrontier {
	return {
		commandId,
		eventId,
		eventName,
		frontierKind,
		id: commandEventContractFrontierId({ commandId, eventId, eventName, frontierKind, overlayId }),
		reason: frontierReason(frontierKind)
	};
}

function assertGeneratedVocabParity(
	commands: readonly ParsedCommandDeclaration[],
	events: readonly ParsedEventContract[],
	vocab: VocabPopulation
): void {
	const generatedByName = new Map(commands.map((command) => [command.commandName, command]));
	if (generatedByName.size !== vocab.commands.length)
		throw new Error('Generated COMMANDS and vocab command populations differ.');
	for (const expected of vocab.commands) {
		const actual = generatedByName.get(expected.commandName);
		if (
			actual === undefined ||
			actual.primary.eventName !== expected.primaryEvent ||
			actual.additional.length !== expected.additionalEvents.length ||
			actual.additional.some((item, index) => item.eventName !== expected.additionalEvents[index])
		)
			throw new Error(`Generated COMMANDS.${expected.commandName} differs from vocab.`);
	}
	const generatedEvents = new Set(events.map((event) => event.eventName));
	if (
		generatedEvents.size !== vocab.eventNames.size ||
		[...generatedEvents].some((eventName) => !vocab.eventNames.has(eventName))
	)
		throw new Error('Generated EVENTS and vocab event populations differ.');
}

function indexEntry(
	input: CommandEventContractOverlayIndexEntry
): CommandEventContractOverlayIndexEntry {
	return {
		boundContributionIds: sortedUnique(input.boundContributionIds),
		commandIds: sortedUnique(input.commandIds),
		declaredLinkIds: sortedUnique(input.declaredLinkIds),
		eventIds: sortedUnique(input.eventIds),
		frontierIds: sortedUnique(input.frontierIds),
		key: input.key,
		pinnedEmissionIds: sortedUnique(input.pinnedEmissionIds)
	};
}

function buildExpectedIndexes(input: {
	readonly boundContributions: readonly CommandEventContractBoundContribution[];
	readonly commands: readonly CommandEventContractCommandRecord[];
	readonly declaredLinks: readonly CommandEventContractDeclaredLink[];
	readonly eventContracts: readonly CommandEventContractEventRecord[];
	readonly frontiers: readonly CommandEventContractFrontier[];
	readonly pinnedEmissions: readonly CommandEventContractPinnedEmission[];
}): {
	readonly forwardIndex: readonly CommandEventContractOverlayIndexEntry[];
	readonly reverseIndex: readonly CommandEventContractOverlayIndexEntry[];
} {
	const forwardIndex = input.commands.map((command) => {
		const links = input.declaredLinks.filter((link) => link.commandId === command.id);
		const contributions = input.boundContributions.filter(
			(item) => item.commandName === command.commandName
		);
		const eventNames = new Set([
			...links.map((link) => link.eventName),
			...contributions.map((item) => item.eventName)
		]);
		return indexEntry({
			boundContributionIds: contributions.map((item) => item.id),
			commandIds: [command.id],
			declaredLinkIds: links.map((link) => link.id),
			eventIds: input.eventContracts
				.filter((event) => eventNames.has(event.eventName))
				.map((event) => event.id),
			frontierIds: input.frontiers
				.filter(
					(frontier) =>
						frontier.commandId === command.id ||
						(frontier.eventName !== null && eventNames.has(frontier.eventName))
				)
				.map((frontier) => frontier.id),
			key: command.commandName,
			pinnedEmissionIds: input.pinnedEmissions
				.filter((item) => eventNames.has(item.eventName))
				.map((item) => item.id)
		});
	});
	const eventKeys = sortedUnique([
		...input.eventContracts.map((event) => event.eventName),
		...input.declaredLinks.map((link) => link.eventName),
		...input.boundContributions.map((item) => item.eventName),
		...input.pinnedEmissions.map((item) => item.eventName),
		...input.frontiers.flatMap((frontier) =>
			frontier.eventName === null ? [] : [frontier.eventName]
		)
	]);
	const reverseIndex = eventKeys.map((eventName) => {
		const links = input.declaredLinks.filter((link) => link.eventName === eventName);
		const boundCommandNames = new Set(
			input.boundContributions
				.filter((item) => item.eventName === eventName)
				.map((item) => item.commandName)
		);
		return indexEntry({
			boundContributionIds: input.boundContributions
				.filter((item) => item.eventName === eventName)
				.map((item) => item.id),
			commandIds: [
				...links.map((link) => link.commandId),
				...input.commands
					.filter((command) => boundCommandNames.has(command.commandName))
					.map((command) => command.id)
			],
			declaredLinkIds: links.map((link) => link.id),
			eventIds: input.eventContracts
				.filter((event) => event.eventName === eventName)
				.map((event) => event.id),
			frontierIds: input.frontiers
				.filter((frontier) => frontier.eventName === eventName)
				.map((frontier) => frontier.id),
			key: eventName,
			pinnedEmissionIds: input.pinnedEmissions
				.filter((item) => item.eventName === eventName)
				.map((item) => item.id)
		});
	});
	return { forwardIndex, reverseIndex };
}

function expectedOverlay(inputs: CommandEventContractOverlayBuildInputs): {
	readonly overlay: CommandEventContractOverlaySnapshot;
	readonly sourceBytes: number;
} {
	const selected = selectedRegistrySource(inputs);
	const model = semanticModel(inputs.semanticSnapshot, selected.source);
	const registries = parseRegistries(inputs, model, selected);
	const parsedCommands = parseCommandDeclarations(
		registries.commandProperties,
		registries.sourceFile,
		model
	);
	const parsedEvents = parseEventContracts(
		registries.eventProperties,
		registries.sourceFile,
		selected.source,
		model
	);
	const vocabFrozen = frozenArtifact(inputs.subject, COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH);
	const retainedFrozen = frozenArtifact(
		inputs.subject,
		COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
	);
	if (
		!same(
			inputs.request.vocabArtifact,
			commandEventContractVocabArtifactSelector(inputs.subject)
		) ||
		!same(
			inputs.request.retainedCensusArtifact,
			commandEventContractRetainedCensusArtifactSelector(inputs.subject)
		)
	)
		throw new Error('Retained artifact selectors do not reconcile.');
	const inputDigest = commandEventContractOverlayInputDigest(inputs);
	const overlayId = commandEventContractOverlayId({
		inputDigest,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.request.subjectId
	});
	const vocab = parseVocab(
		decodeUtf8(vocabFrozen.bytes, COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH)
	);
	assertGeneratedVocabParity(parsedCommands, parsedEvents, vocab);
	const contributions = boundContributions(overlayId, vocab);
	const pinnedEmissions = parsePinnedEmissions(
		overlayId,
		decodeUtf8(retainedFrozen.bytes, COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH)
	);
	const generated = generatedPopulation(overlayId, parsedCommands, parsedEvents, inputs);
	const eventByName = new Map(generated.eventContracts.map((event) => [event.eventName, event]));
	const declaredNames = new Set(generated.declaredLinks.map((link) => link.eventName));
	const boundNames = new Set(contributions.map((item) => item.eventName));
	const pinnedNames = new Set(pinnedEmissions.map((item) => item.eventName));
	const transitionCommands = new Set(vocab.bindings.map((binding) => binding.commandName));
	const frontiers: CommandEventContractFrontier[] = [];
	for (const command of generated.commands)
		if (!transitionCommands.has(command.commandName))
			frontiers.push(
				makeFrontier(overlayId, 'COMMAND_WITHOUT_TRANSITION_BINDING', command.id, null, null)
			);
	for (const missing of generated.missing)
		frontiers.push(
			makeFrontier(
				overlayId,
				'GENERATED_EVENT_SCHEMA_UNRESOLVED',
				missing.commandId,
				null,
				missing.eventName
			)
		);
	for (const event of generated.eventContracts)
		if (!boundNames.has(event.eventName) && !pinnedNames.has(event.eventName))
			frontiers.push(
				makeFrontier(
					overlayId,
					'DECLARED_NEITHER_BOUND_NOR_PINNED_EMITTED',
					null,
					event.id,
					event.eventName
				)
			);
	for (const eventName of sortedUnique([...declaredNames, ...boundNames]))
		if (declaredNames.has(eventName) !== boundNames.has(eventName))
			frontiers.push(
				makeFrontier(
					overlayId,
					'GENERATED_RETAINED_BOUND_SET_MISMATCH',
					null,
					eventByName.get(eventName)?.id ?? null,
					eventName
				)
			);
	for (const eventName of sortedUnique(pinnedNames))
		if (!boundNames.has(eventName))
			frontiers.push(
				makeFrontier(
					overlayId,
					'PINNED_EMITTED_NOT_RETAINED_BOUND',
					null,
					eventByName.get(eventName)?.id ?? null,
					eventName
				)
			);
	for (const eventName of sortedUnique(boundNames))
		if (!pinnedNames.has(eventName))
			frontiers.push(
				makeFrontier(
					overlayId,
					'RETAINED_BOUND_NOT_PINNED_EMITTED',
					null,
					eventByName.get(eventName)?.id ?? null,
					eventName
				)
			);
	frontiers.sort((left, right) => compareText(left.id, right.id));
	const coverage: CommandEventContractOverlayCoverage = {
		additionalDeclaredLinks: generated.declaredLinks.filter((link) => link.role === 'ADDITIONAL')
			.length,
		boundContributions: contributions.length,
		boundDistinctEvents: boundNames.size,
		boundRepeatedContributions: contributions.length - boundNames.size,
		commandDeclaredDistinctEvents: declaredNames.size,
		commandDeclaredLinks: generated.declaredLinks.length,
		commands: generated.commands.length,
		commandsWithoutTransitionBinding: frontiers.filter(
			(item) => item.frontierKind === 'COMMAND_WITHOUT_TRANSITION_BINDING'
		).length,
		declaredNeitherBoundNorPinned: frontiers.filter(
			(item) => item.frontierKind === 'DECLARED_NEITHER_BOUND_NOR_PINNED_EMITTED'
		).length,
		eventContracts: generated.eventContracts.length,
		frontiers: frontiers.length,
		generatedBoundSetDifferences: frontiers.filter(
			(item) => item.frontierKind === 'GENERATED_RETAINED_BOUND_SET_MISMATCH'
		).length,
		missingEventContracts: generated.missing.length,
		pinnedEmissions: pinnedEmissions.length,
		pinnedEmittedNotBound: frontiers.filter(
			(item) => item.frontierKind === 'PINNED_EMITTED_NOT_RETAINED_BOUND'
		).length,
		primaryDeclaredLinks: generated.declaredLinks.filter((link) => link.role === 'PRIMARY').length,
		reconciles:
			generated.missing.length === 0 &&
			frontiers.every((item) => item.frontierKind !== 'GENERATED_RETAINED_BOUND_SET_MISMATCH'),
		retainedBoundNotPinnedEmitted: frontiers.filter(
			(item) => item.frontierKind === 'RETAINED_BOUND_NOT_PINNED_EMITTED'
		).length
	};
	const { forwardIndex, reverseIndex } = buildExpectedIndexes({
		boundContributions: contributions,
		commands: generated.commands,
		declaredLinks: generated.declaredLinks,
		eventContracts: generated.eventContracts,
		frontiers,
		pinnedEmissions
	});
	const derivationLayer: CommandEventContractOverlayLayer = {
		boundContributionIds: contributions.map((item) => item.id),
		capability: COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
		capabilityStatus: COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
		commandIds: generated.commands.map((item) => item.id),
		declaredLinkIds: generated.declaredLinks.map((item) => item.id),
		eventIds: generated.eventContracts.map((item) => item.id),
		frontierIds: frontiers.map((item) => item.id),
		id: commandEventContractDerivationLayerId(overlayId),
		kind: 'JPWB_COMMAND_EVENT_CONTRACT_DERIVATION',
		ordinal: 0,
		overlayId,
		pinnedEmissionIds: pinnedEmissions.map((item) => item.id)
	};
	const inferenceLayer: CommandEventContractOverlayLayer = {
		boundContributionIds: [],
		capability: COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY,
		capabilityStatus: COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
		commandIds: [],
		declaredLinkIds: [],
		eventIds: [],
		frontierIds: [],
		id: commandEventContractInferenceLayerId(overlayId),
		kind: 'JPWB_COMMAND_EVENT_CONTRACT_INFERENCE',
		ordinal: 1,
		overlayId,
		pinnedEmissionIds: []
	};
	const content = {
		arrowObservationContentDigest: inputs.arrowObservation.contentDigest,
		arrowObservationId: inputs.arrowObservation.id,
		authorityTransfer: COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER,
		baselineChange: COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE,
		boundContributions: contributions,
		budgets: { ...inputs.request.budgets },
		canonicalProfile: COMMAND_EVENT_CONTRACT_OVERLAY_CANONICAL_PROFILE,
		capabilities: [
			COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
			COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY
		] as const,
		capabilityStatus: COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
		commandHandlerGraphContentDigest: inputs.commandHandlerGraph.contentDigest,
		commandHandlerGraphId: inputs.commandHandlerGraph.id,
		commandRegistry: { ...inputs.request.commandRegistry },
		commands: generated.commands,
		coverage,
		declaredLinks: generated.declaredLinks,
		eventContracts: generated.eventContracts,
		eventRegistry: { ...inputs.request.eventRegistry },
		forwardIndex,
		frontiers,
		fullJanCsaa007Conformance: COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance: COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
		gateEffect: COMMAND_EVENT_CONTRACT_OVERLAY_GATE_EFFECT,
		graphAuthority: COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY,
		health: 'PARTIAL' as const,
		id: overlayId,
		inputDigest,
		integrationStrategy: COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY,
		layers: [derivationLayer, inferenceLayer] as const,
		limitations: COMMAND_EVENT_CONTRACT_OVERLAY_LIMITATIONS.map((item) => ({ ...item })),
		method: COMMAND_EVENT_CONTRACT_OVERLAY_METHOD,
		operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
		oracleChange: COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE,
		pinnedEmissions,
		producer: { ...inputs.semanticSnapshot.provider },
		registryStatus: COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS,
		replacementEquivalence: COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE,
		retainedCensus: commandEventContractRetainedCensusReference(inputs.subject),
		reverseIndex,
		runtimeEmission: COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION,
		runtimePerformability: COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY,
		schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_SCHEMA_VERSION,
		scope: COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.request.subjectId,
		vocabArtifact: { ...inputs.request.vocabArtifact }
	};
	const overlay: CommandEventContractOverlaySnapshot = {
		...content,
		contentDigest: commandEventContractOverlayContentDigest(content)
	};
	return {
		overlay,
		sourceBytes:
			selected.bytes.byteLength + vocabFrozen.bytes.byteLength + retainedFrozen.bytes.byteLength
	};
}

function requestValid(inputs: CommandEventContractOverlayBuildInputs): boolean {
	const request = inputs.request;
	return (
		plainObject(inputs) &&
		exactKeys(inputs, INPUT_KEYS) &&
		plainObject(request) &&
		exactKeys(request, REQUEST_KEYS) &&
		plainObject(request.budgets) &&
		exactKeys(request.budgets, BUDGET_KEYS) &&
		BUDGET_KEYS.every((key) => {
			const value = request.budgets[key];
			return (
				typeof value === 'number' &&
				Number.isSafeInteger(value) &&
				value >= (key === 'maxDiagnostics' ? 1 : 0)
			);
		}) &&
		plainObject(request.commandRegistry) &&
		exactKeys(request.commandRegistry, SELECTOR_KEYS) &&
		plainObject(request.eventRegistry) &&
		exactKeys(request.eventRegistry, SELECTOR_KEYS) &&
		plainObject(request.retainedCensusArtifact) &&
		exactKeys(request.retainedCensusArtifact, ARTIFACT_SELECTOR_KEYS) &&
		plainObject(request.vocabArtifact) &&
		exactKeys(request.vocabArtifact, ARTIFACT_SELECTOR_KEYS) &&
		request.schemaVersion === COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION &&
		request.operationVersion === COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION &&
		request.commandRegistry.exportName === 'COMMANDS' &&
		request.eventRegistry.exportName === 'EVENTS' &&
		request.commandRegistry.logicalPath === COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH &&
		request.eventRegistry.logicalPath === COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH &&
		request.commandRegistry.projectConfigPath ===
			COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH &&
		request.eventRegistry.projectConfigPath ===
			COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH &&
		request.retainedCensusArtifact.artifactPath ===
			COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH &&
		request.vocabArtifact.artifactPath === COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH &&
		SHA256.test(request.commandRegistry.contentSha256) &&
		SHA256.test(request.eventRegistry.contentSha256) &&
		SHA256.test(request.retainedCensusArtifact.artifactContentSha256) &&
		SHA256.test(request.vocabArtifact.artifactContentSha256)
	);
}

function inputIdentityValid(inputs: CommandEventContractOverlayBuildInputs): boolean {
	const subjectId = inputs.subject.descriptor.subjectId;
	return (
		inputs.request.subjectId === subjectId &&
		inputs.semanticSnapshot.subjectId === subjectId &&
		inputs.arrowObservation.subjectId === subjectId &&
		inputs.commandHandlerGraph.subjectId === subjectId &&
		inputs.commandHandlerRequest.subjectId === subjectId &&
		inputs.request.semanticSnapshotId === inputs.semanticSnapshot.id &&
		inputs.request.arrowObservationId === inputs.arrowObservation.id &&
		inputs.request.commandHandlerGraphId === inputs.commandHandlerGraph.id &&
		inputs.commandHandlerRequest.semanticSnapshotId === inputs.semanticSnapshot.id &&
		inputs.commandHandlerRequest.arrowObservationId === inputs.arrowObservation.id &&
		inputs.commandHandlerGraph.semanticSnapshotId === inputs.semanticSnapshot.id &&
		inputs.commandHandlerGraph.arrowObservationId === inputs.arrowObservation.id
	);
}

function predecessorIssue(
	inputs: CommandEventContractOverlayBuildInputs,
	limits: ValidationLimits
): string | null {
	const maxIssues = Math.min(limits.maxIssues, 100_000);
	const arrow = validateArrowCommandCensusObservation(inputs.arrowObservation, inputs.subject, {
		maxIssues
	});
	if (arrow.state !== 'VALID')
		return `Arrow observation is not independently valid (${arrow.state}).`;
	const expectedDigest = commandHandlerGraphInputDigest(
		inputs.commandHandlerRequest,
		inputs.semanticSnapshot,
		inputs.arrowObservation
	);
	if (inputs.commandHandlerGraph.graphInputDigest !== expectedDigest)
		return 'Command-handler graph does not bind the explicit predecessor request.';
	const graph = validateConstructedCommandHandlerGraph(
		inputs.commandHandlerGraph,
		inputs.semanticSnapshot,
		inputs.arrowObservation,
		inputs.subject,
		expectedDigest,
		{
			maxIssues,
			maxRecords: limits.maxInputRecords,
			maxStringCharacters: limits.maxInputStringCharacters
		}
	);
	if (graph.state !== 'VALID')
		return `Command-handler graph is not independently valid (${graph.state}).`;
	return null;
}

function validateOverlay(
	value: unknown,
	inputs: CommandEventContractOverlayBuildInputs,
	options?: CommandEventContractOverlayValidationOptions
): CommandEventContractOverlayValidationResult {
	let limits: ValidationLimits;
	try {
		limits = materializeOptions(options);
	} catch (error) {
		return invalidResult(
			'SHAPE_INVALID',
			'$options',
			error instanceof Error ? error.message : 'Validation options are invalid.'
		);
	}
	const candidateInspection = inspectPlainData([{ path: '$', value }], {
		maxDepth: limits.maxDepth,
		maxRecords: limits.maxRecords,
		maxStringCharacters: limits.maxStringCharacters
	});
	if (candidateInspection !== null)
		return invalidResult(
			candidateInspection.budget ? 'BUDGET_EXHAUSTED' : 'SHAPE_INVALID',
			candidateInspection.path,
			candidateInspection.message,
			candidateInspection.budget
		);
	if (!plainObject(value) || !exactKeys(value, SNAPSHOT_KEYS))
		return invalidResult('SHAPE_INVALID', '$', 'Overlay top-level field population is invalid.');
	const inputShell = inspectRecordShell(inputs, '$inputs', INPUT_KEYS);
	if (inputShell !== null)
		return invalidResult('SHAPE_INVALID', inputShell.path, inputShell.message);
	if (!isFrozenSubjectCapability(inputs.subject))
		return invalidResult(
			'INPUT_INVALID',
			'$inputs.subject',
			'FrozenSubject bytes capability is unavailable.'
		);
	const inputInspection = inspectPlainData(
		[
			{ path: '$inputs.request', value: inputs.request },
			{ path: '$inputs.commandHandlerRequest', value: inputs.commandHandlerRequest },
			{ path: '$inputs.arrowObservation', value: inputs.arrowObservation },
			{ path: '$inputs.commandHandlerGraph', value: inputs.commandHandlerGraph }
		],
		{
			maxDepth: limits.maxDepth,
			maxRecords: limits.maxInputRecords,
			maxStringCharacters: limits.maxInputStringCharacters
		}
	);
	if (inputInspection !== null)
		return invalidResult(
			inputInspection.budget ? 'BUDGET_EXHAUSTED' : 'SHAPE_INVALID',
			inputInspection.path,
			inputInspection.message,
			inputInspection.budget
		);
	const semanticShell = inspectRecordShell(inputs.semanticSnapshot, '$inputs.semanticSnapshot');
	if (semanticShell !== null)
		return invalidResult('SHAPE_INVALID', semanticShell.path, semanticShell.message);
	let remaining = limits.maxInputRecords;
	for (const name of [
		'capabilities',
		'projects',
		'programs',
		'sources',
		'astNodes',
		'references',
		'declarations',
		'symbols'
	] as const) {
		const population = inputs.semanticSnapshot[name];
		const shell = inspectArrayShell(population, `$inputs.semanticSnapshot.${name}`, remaining);
		if (shell !== null)
			return invalidResult(
				shell.budget ? 'BUDGET_EXHAUSTED' : 'SHAPE_INVALID',
				shell.path,
				shell.message,
				shell.budget
			);
		remaining -= population.length;
	}
	try {
		if (!requestValid(inputs))
			return invalidResult(
				'INPUT_INVALID',
				'$inputs.request',
				'Build inputs or request do not have the exact supported shape and constants.'
			);
		if (!inputIdentityValid(inputs))
			return invalidResult(
				'INPUT_INVALID',
				'$inputs',
				'Explicit requests and predecessor products do not share exact identities.'
			);
		if (
			!(['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'] as const).every((required) =>
				inputs.semanticSnapshot.capabilities.some(
					(capability) => capability.capability === required && capability.state !== 'UNSUPPORTED'
				)
			)
		)
			return invalidResult(
				'INPUT_INVALID',
				'$inputs.semanticSnapshot.capabilities',
				'TS_PROJECT, TS_SYNTAX, and TS_SYMBOL are required.'
			);
		if (inputs.semanticSnapshot.astNodes.length > inputs.request.budgets.maxAstNodes)
			return invalidResult(
				'BUDGET_EXHAUSTED',
				'$inputs.request.budgets.maxAstNodes',
				'Caller operation guard maxAstNodes is exceeded.',
				true
			);
		const upstream = predecessorIssue(inputs, limits);
		if (upstream !== null) return invalidResult('INPUT_INVALID', '$inputs', upstream);
		const { overlay: expected, sourceBytes } = expectedOverlay(inputs);
		const populations = [
			[
				'maxBoundContributions',
				expected.boundContributions.length,
				inputs.request.budgets.maxBoundContributions
			],
			['maxCommands', expected.commands.length, inputs.request.budgets.maxCommands],
			['maxDeclaredLinks', expected.declaredLinks.length, inputs.request.budgets.maxDeclaredLinks],
			[
				'maxEventContracts',
				expected.eventContracts.length,
				inputs.request.budgets.maxEventContracts
			],
			['maxFrontiers', expected.frontiers.length, inputs.request.budgets.maxFrontiers],
			[
				'maxPinnedEmissions',
				expected.pinnedEmissions.length,
				inputs.request.budgets.maxPinnedEmissions
			],
			['maxSourceBytes', sourceBytes, inputs.request.budgets.maxSourceBytes]
		] as const;
		const exceeded = populations.find(([, actual, maximum]) => actual > maximum);
		if (exceeded !== undefined)
			return invalidResult(
				'BUDGET_EXHAUSTED',
				`$inputs.request.budgets.${exceeded[0]}`,
				`Caller operation guard exceeded: ${exceeded[1]} > ${exceeded[2]}.`,
				true
			);
		const candidate = value as unknown as CommandEventContractOverlaySnapshot;
		if (candidate.contentDigest !== commandEventContractOverlayContentDigest(candidate))
			return invalidResult(
				'CONTENT_DIGEST_MISMATCH',
				'$.contentDigest',
				'Overlay content digest does not reproduce canonical content.'
			);
		if (!same(candidate, expected))
			return invalidResult(
				'POPULATION_MISMATCH',
				'$',
				'Overlay does not exactly reproduce the independently derived canonical population.'
			);
		return { issues: [], state: 'VALID' };
	} catch (error) {
		return invalidResult(
			'POPULATION_MISMATCH',
			'$',
			error instanceof Error
				? `Independent overlay derivation failed closed: ${error.message}`
				: 'Independent overlay derivation failed closed.'
		);
	}
}

/** Public entry point is defined below the independent materializer. */
export function validateCommandEventContractOverlay(
	value: unknown,
	inputs: CommandEventContractOverlayBuildInputs,
	options?: CommandEventContractOverlayValidationOptions
): CommandEventContractOverlayValidationResult {
	return validateOverlay(value, inputs, options);
}

export const validateConstructedCommandEventContractOverlay = validateCommandEventContractOverlay;
