import { createHash } from 'node:crypto';

import ts from 'typescript';

import {
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY,
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER,
	CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS,
	CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE,
	CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT,
	CONDITIONAL_EXPORT_RESOLUTION_METHOD,
	CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS,
	CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
	type ConditionalExportBranchId,
	type ConditionalExportBranchRecord,
	type ConditionalExportDecisionId,
	type ConditionalExportDecisionRecord,
	type ConditionalExportFrontierId,
	type ConditionalExportFrontierReason,
	type ConditionalExportFrontierRecord,
	type ConditionalExportManifestSourceSpan,
	type ConditionalExportManifestWitness,
	type ConditionalExportResolutionBuildInputs,
	type ConditionalExportResolutionCanonicalBinding,
	type ConditionalExportResolutionId,
	type ConditionalExportResolutionSnapshot,
	type ConditionalExportResolutionValidationIssue,
	type ConditionalExportResolutionValidationOptions,
	type ConditionalExportResolutionValidationResult
} from '../contracts/conditional-export-resolution.js';
import { PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION } from '../contracts/project-context-graph.js';
import { isProxyValue, isUnicodeScalarString } from '../semantic/canonical.js';
import { isFrozenSubjectCapability, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { validateProjectContextGraph } from '../graph/validate-project-context-graph.js';

interface ClosedOptions {
	readonly maxDepth: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

const DEFAULT_OPTIONS: ClosedOptions = {
	maxDepth: 128,
	maxInputRecords: 10_000_000,
	maxInputStringCharacters: 1_000_000_000,
	maxIssues: 1_000,
	maxRecords: 10_000_000,
	maxStringCharacters: 1_000_000_000
};

const SHA256 = /^[0-9a-f]{64}$/u;
const RESERVED_CONDITIONS = new Set(['default', 'import', 'node', 'require']);

const INPUT_KEYS = ['frozenSubject', 'projectContextGraph', 'request', 'semanticSnapshot'] as const;
const REQUEST_KEYS = [
	'budgets',
	'conditions',
	'consumer',
	'exportSubpath',
	'manifestPath',
	'moduleMode',
	'operationVersion',
	'packageName',
	'platform',
	'projectContextGraph',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'subjectId'
] as const;
const BUDGET_KEYS = [
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
] as const;
const CONSUMER_KEYS = [
	'projectContextProgramId',
	'projectContextSourceId',
	'semanticProgramId',
	'semanticSourceId'
] as const;
const GRAPH_REFERENCE_KEYS = ['contentDigest', 'graphId', 'inputDigest'] as const;
const SELECTION_KEYS = [
	'branchOrder',
	'conditionActivation',
	'conditionKeyNumericPropertyPolicy',
	'conditionPriority',
	'defaultCondition',
	'effectiveConditionOrder',
	'explicitConditions',
	'exportMap',
	'exportSubpath',
	'exportSubpathSyntax',
	'leafKinds',
	'manifestSource',
	'packagePopulation',
	'reservedExplicitConditions',
	'sourceSpanPolicy',
	'targetSyntax',
	'unsupportedTreatment'
] as const;
const SNAPSHOT_KEYS = [
	'authorityTransfer',
	'branches',
	'budgets',
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'closure',
	'consumerEnvironment',
	'contentDigest',
	'coverage',
	'currentness',
	'decision',
	'exactKeyOutcome',
	'freshness',
	'frontiers',
	'fullJanCsaa012Conformance',
	'gateEffect',
	'health',
	'id',
	'inputDigest',
	'manifestWitness',
	'method',
	'nonclaims',
	'operationVersion',
	'projectContextGraph',
	'resolutionAuthority',
	'resultCompleteness',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'subjectId',
	'truncation'
] as const;

function issue(
	code: ConditionalExportResolutionValidationIssue['code'],
	message: string,
	path = '$'
): ConditionalExportResolutionValidationIssue {
	return { code, message, path };
}

function invalid(
	problem: ConditionalExportResolutionValidationIssue
): ConditionalExportResolutionValidationResult {
	return {
		issues: [problem],
		state: problem.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => typeof key === 'string' && expected.includes(key)) &&
		keys.every((key) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key)!;
			return descriptor.enumerable && 'value' in descriptor;
		})
	);
}

function safePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function safeNonnegative(value: unknown): value is number {
	return (
		typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0
	);
}

function closeOptions(
	value: ConditionalExportResolutionValidationOptions | undefined
): ClosedOptions | null {
	if (value === undefined) return DEFAULT_OPTIONS;
	if (!plainRecord(value)) return null;
	const allowed = new Set([
		'maxDepth',
		'maxInputRecords',
		'maxInputStringCharacters',
		'maxIssues',
		'maxRecords',
		'maxStringCharacters'
	]);
	if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.has(key)))
		return null;
	const result: Record<string, number> = { ...DEFAULT_OPTIONS };
	for (const key of allowed) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined) continue;
		if (!descriptor.enumerable || !('value' in descriptor) || !safePositive(descriptor.value))
			return null;
		result[key] = descriptor.value;
	}
	if (result.maxIssues! > 100_000) return null;
	return result as unknown as ClosedOptions;
}

interface PlainTreeVisitFrame {
	readonly depth: number;
	readonly path: string;
	readonly state: 'VISIT';
	readonly value: unknown;
}

type PlainTreeFrame = PlainTreeVisitFrame | { readonly state: 'LEAVE'; readonly value: object };

interface PlainTreeWalk {
	readonly active: WeakSet<object>;
	characters: number;
	readonly limits: Pick<ClosedOptions, 'maxDepth' | 'maxRecords' | 'maxStringCharacters'>;
	readonly malformedCode: ConditionalExportResolutionValidationIssue['code'];
	readonly pending: PlainTreeFrame[];
	records: number;
}

/** JSON-compatible leaves that carry no descriptor population of their own. */
function jsonScalarLeaf(value: unknown): boolean {
	return (
		value === null ||
		typeof value === 'boolean' ||
		(typeof value === 'number' &&
			Number.isFinite(value) &&
			(!Number.isInteger(value) || Number.isSafeInteger(value)) &&
			!Object.is(value, -0))
	);
}

function stringLeafIssue(
	text: string,
	walk: PlainTreeWalk,
	path: string
): ConditionalExportResolutionValidationIssue | null {
	if (!isUnicodeScalarString(text))
		return issue(walk.malformedCode, 'Strings must contain Unicode scalar text.', path);
	walk.characters += text.length;
	if (walk.characters > walk.limits.maxStringCharacters)
		return issue('BUDGET_EXHAUSTED', 'The descriptor string-character budget was exhausted.', path);
	return null;
}

function containerShapeIssue(
	container: object,
	walk: PlainTreeWalk,
	path: string
): ConditionalExportResolutionValidationIssue | null {
	if (isProxyValue(container))
		return issue(walk.malformedCode, 'Proxy values are not accepted.', path);
	if (walk.active.has(container))
		return issue(walk.malformedCode, 'Cyclic data is not accepted.', path);
	const array = Array.isArray(container);
	const prototype = Reflect.getPrototypeOf(container);
	if (
		(array && prototype !== Array.prototype) ||
		(!array && prototype !== Object.prototype && prototype !== null)
	)
		return issue(walk.malformedCode, 'Containers must have ordinary prototypes.', path);
	return null;
}

function propertyKeyIssue(
	stringKeys: readonly string[],
	array: boolean,
	walk: PlainTreeWalk,
	path: string
): ConditionalExportResolutionValidationIssue | null {
	for (const key of stringKeys) {
		if (array && key === 'length') continue;
		walk.characters += key.length;
		if (walk.characters > walk.limits.maxStringCharacters)
			return issue(
				'BUDGET_EXHAUSTED',
				'The descriptor string-character budget was exhausted by a property key.',
				path
			);
		if (!isUnicodeScalarString(key))
			return issue(walk.malformedCode, 'Property keys must contain Unicode scalar text.', path);
	}
	return null;
}

/** A key that is not a canonical in-range array index of a dense ordinary array. */
function denseArrayKeyInvalid(key: string, arrayLength: number): boolean {
	if (key === 'length') return false;
	if (!/^(0|[1-9]\d*)$/u.test(key)) return true;
	const index = Number(key);
	return !Number.isSafeInteger(index) || index >= arrayLength || String(index) !== key;
}

function populationIssue(
	container: object,
	array: boolean,
	stringKeys: readonly string[],
	walk: PlainTreeWalk,
	path: string
): ConditionalExportResolutionValidationIssue | null {
	const remaining = walk.limits.maxRecords - walk.records;
	if (!array)
		return stringKeys.length > remaining
			? issue(
					'BUDGET_EXHAUSTED',
					'The descriptor record budget was exhausted by a property population.',
					path
				)
			: null;
	const arrayLength = Reflect.getOwnPropertyDescriptor(container, 'length')!.value as number;
	if (arrayLength > remaining)
		return issue(
			'BUDGET_EXHAUSTED',
			'The descriptor record budget was exhausted by an array population.',
			path
		);
	if (stringKeys.length !== arrayLength + 1)
		return issue(walk.malformedCode, 'Arrays must be dense ordinary arrays.', path);
	if (stringKeys.some((key) => denseArrayKeyInvalid(key, arrayLength)))
		return issue(walk.malformedCode, 'Arrays must be dense without extra properties.', path);
	return null;
}

function pushChildFrames(
	container: object,
	array: boolean,
	stringKeys: readonly string[],
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame
): ConditionalExportResolutionValidationIssue | null {
	for (let index = stringKeys.length - 1; index >= 0; index -= 1) {
		const key = stringKeys[index]!;
		if (array && key === 'length') continue;
		const descriptor = Reflect.getOwnPropertyDescriptor(container, key)!;
		if (!descriptor.enumerable || !('value' in descriptor))
			return issue(
				walk.malformedCode,
				'Properties must be enumerable data properties.',
				`${frame.path}.${key}`
			);
		walk.pending.push({
			depth: frame.depth + 1,
			path: array ? `${frame.path}[${key}]` : `${frame.path}.${key}`,
			state: 'VISIT',
			value: descriptor.value
		});
	}
	return null;
}

function containerFrameIssue(
	container: object,
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame
): ConditionalExportResolutionValidationIssue | null {
	const shapeIssue = containerShapeIssue(container, walk, frame.path);
	if (shapeIssue !== null) return shapeIssue;
	const keys = Reflect.ownKeys(container);
	if (keys.some((key) => typeof key !== 'string'))
		return issue(walk.malformedCode, 'Symbol keys are not accepted.', frame.path);
	const stringKeys = keys as string[];
	const array = Array.isArray(container);
	const keyIssue = propertyKeyIssue(stringKeys, array, walk, frame.path);
	if (keyIssue !== null) return keyIssue;
	const arrayIssue = populationIssue(container, array, stringKeys, walk, frame.path);
	if (arrayIssue !== null) return arrayIssue;
	walk.active.add(container);
	walk.pending.push({ state: 'LEAVE', value: container });
	return pushChildFrames(container, array, stringKeys, walk, frame);
}

function visitFrameIssue(
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame
): ConditionalExportResolutionValidationIssue | null {
	walk.records += 1;
	if (walk.records > walk.limits.maxRecords)
		return issue('BUDGET_EXHAUSTED', 'The descriptor record budget was exhausted.', frame.path);
	if (frame.depth > walk.limits.maxDepth)
		return issue('BUDGET_EXHAUSTED', 'The descriptor depth budget was exhausted.', frame.path);
	if (typeof frame.value === 'string') return stringLeafIssue(frame.value, walk, frame.path);
	if (jsonScalarLeaf(frame.value)) return null;
	if (typeof frame.value !== 'object')
		return issue(walk.malformedCode, 'Only JSON-compatible data values are accepted.', frame.path);
	return containerFrameIssue(frame.value!, walk, frame);
}

/** Descriptor-only traversal: getters, iterators, callbacks, and toJSON are never invoked. */
function plainTreeIssue(
	value: unknown,
	limits: Pick<ClosedOptions, 'maxDepth' | 'maxRecords' | 'maxStringCharacters'>,
	rootPath: string,
	input = false
): ConditionalExportResolutionValidationIssue | null {
	const walk: PlainTreeWalk = {
		active: new WeakSet<object>(),
		characters: 0,
		limits,
		malformedCode: input ? 'INPUT_INVALID' : 'SHAPE_INVALID',
		pending: [{ depth: 0, path: rootPath, state: 'VISIT', value }],
		records: 0
	};
	while (walk.pending.length > 0) {
		const frame = walk.pending.pop()!;
		if (frame.state === 'LEAVE') {
			walk.active.delete(frame.value);
			continue;
		}
		const frameIssue = visitFrameIssue(walk, frame);
		if (frameIssue !== null) return frameIssue;
	}
	return null;
}

interface CanonicalArrayFrame {
	readonly index: number;
	readonly length: number;
	readonly state: 'ARRAY';
	readonly value: unknown[];
}

interface CanonicalObjectFrame {
	readonly entries: readonly (readonly [string, unknown])[];
	readonly index: number;
	readonly state: 'OBJECT';
}

type CanonicalFrame =
	CanonicalArrayFrame | CanonicalObjectFrame | { readonly state: 'VALUE'; readonly value: unknown };

/** The canonical token for a JSON scalar; null means the value is a container. */
function canonicalScalarToken(input: unknown): string | null {
	if (input === null) return 'null';
	if (typeof input === 'string') return JSON.stringify(input);
	if (typeof input === 'boolean') return input ? 'true' : 'false';
	if (typeof input === 'number') return JSON.stringify(input);
	return null;
}

function* canonicalArrayChunks(
	frame: CanonicalArrayFrame,
	pending: CanonicalFrame[]
): Generator<string, void, undefined> {
	if (frame.index === frame.length) {
		yield ']';
		return;
	}
	if (frame.index !== 0) yield ',';
	pending.push(
		{ ...frame, index: frame.index + 1 },
		{
			state: 'VALUE',
			value: Reflect.getOwnPropertyDescriptor(frame.value, String(frame.index))!.value
		}
	);
}

function* canonicalObjectChunks(
	frame: CanonicalObjectFrame,
	pending: CanonicalFrame[]
): Generator<string, void, undefined> {
	if (frame.index === frame.entries.length) {
		yield '}';
		return;
	}
	if (frame.index !== 0) yield ',';
	const [key, child] = frame.entries[frame.index]!;
	yield JSON.stringify(key);
	yield ':';
	pending.push({ ...frame, index: frame.index + 1 }, { state: 'VALUE', value: child });
}

/** Validator-private canonical token stream over values already accepted by plainTreeIssue. */
function* canonicalChunks(value: unknown): Generator<string, void, undefined> {
	const pending: CanonicalFrame[] = [{ state: 'VALUE', value }];
	while (pending.length > 0) {
		const frame = pending.pop()!;
		if (frame.state === 'ARRAY') {
			yield* canonicalArrayChunks(frame, pending);
			continue;
		}
		if (frame.state === 'OBJECT') {
			yield* canonicalObjectChunks(frame, pending);
			continue;
		}

		const input = frame.value;
		const token = canonicalScalarToken(input);
		if (token !== null) {
			yield token;
			continue;
		}
		const objectInput = input as object;
		if (Array.isArray(objectInput)) {
			const length = Reflect.getOwnPropertyDescriptor(objectInput, 'length')!.value as number;
			yield '[';
			pending.push({ index: 0, length, state: 'ARRAY', value: objectInput });
			continue;
		}
		const entries = (Reflect.ownKeys(objectInput) as string[])
			.sort(compareText)
			.map(
				(key) =>
					[key, Reflect.getOwnPropertyDescriptor(objectInput, key)!.value] as readonly [
						string,
						unknown
					]
			);
		yield '{';
		pending.push({ entries, index: 0, state: 'OBJECT' });
	}
}

function writeCanonical(value: unknown, write: (chunk: string) => void): void {
	for (const chunk of canonicalChunks(value)) write(chunk);
}

function canonicalSha256(value: unknown): string {
	const hash = createHash('sha256');
	let buffered: string[] = [];
	let bufferedBytes = 0;
	const flush = (): void => {
		hash.update(buffered.join(''), 'utf8');
		buffered = [];
		bufferedBytes = 0;
	};
	writeCanonical(value, (chunk) => {
		const bytes = Buffer.byteLength(chunk, 'utf8');
		if (bytes >= 64 * 1024) {
			flush();
			hash.update(chunk, 'utf8');
			return;
		}
		if (bufferedBytes + bytes > 64 * 1024 || buffered.length >= 1_024) flush();
		buffered.push(chunk);
		bufferedBytes += bytes;
	});
	flush();
	return hash.digest('hex');
}

function canonicalEqual(left: unknown, right: unknown): boolean {
	const leftChunks = canonicalChunks(left);
	const rightChunks = canonicalChunks(right);
	while (true) {
		const leftChunk = leftChunks.next();
		const rightChunk = rightChunks.next();
		if (leftChunk.done || rightChunk.done)
			return leftChunk.done === true && rightChunk.done === true;
		if (leftChunk.value !== rightChunk.value) return false;
	}
}

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	const hash = createHash('sha256');
	hash.update(domain, 'utf8');
	hash.update('\0', 'utf8');
	hash.update('1', 'utf8');
	hash.update('\0', 'utf8');
	writeCanonical(preimage, (chunk) => hash.update(chunk, 'utf8'));
	return `${prefix}-${hash.digest('hex')}` as Kind;
}

function independentResolutionId(input: {
	readonly inputDigest: string;
	readonly semanticSnapshotId: string;
	readonly subjectId: string;
}): ConditionalExportResolutionId {
	return identity<ConditionalExportResolutionId>(
		'conditional-export-resolution',
		'JAN-CSAA-CONDITIONAL-EXPORT-RESOLUTION',
		{
			canonicalProfile: CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE,
			inputDigest: input.inputDigest,
			method: CONDITIONAL_EXPORT_RESOLUTION_METHOD,
			operationVersion: CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
			schemaVersion: CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION,
			semanticSnapshotId: input.semanticSnapshotId,
			subjectId: input.subjectId
		}
	);
}

function independentBranchId(
	resolutionId: ConditionalExportResolutionId,
	input: Pick<
		ConditionalExportBranchRecord,
		'conditionPath' | 'declarationOrdinal' | 'keySpan' | 'ordinal' | 'valueKind' | 'valueSpan'
	>
): ConditionalExportBranchId {
	return identity<ConditionalExportBranchId>(
		'conditional-export-branch',
		'JAN-CSAA-CONDITIONAL-EXPORT-BRANCH',
		{ resolutionId, ...input }
	);
}

function independentDecisionId(
	resolutionId: ConditionalExportResolutionId
): ConditionalExportDecisionId {
	return identity<ConditionalExportDecisionId>(
		'conditional-export-decision',
		'JAN-CSAA-CONDITIONAL-EXPORT-DECISION',
		{ kind: 'EXACT_EXPORT_CONDITION_DECISION', resolutionId }
	);
}

function independentFrontierId(
	resolutionId: ConditionalExportResolutionId,
	input: Pick<
		ConditionalExportFrontierRecord,
		'declarationOrdinal' | 'declarationPath' | 'ordinal' | 'reason' | 'sourceSpan'
	>
): ConditionalExportFrontierId {
	return identity<ConditionalExportFrontierId>(
		'conditional-export-frontier',
		'JAN-CSAA-CONDITIONAL-EXPORT-FRONTIER',
		{ resolutionId, ...input }
	);
}

function independentInputDigest(
	inputs: ConditionalExportResolutionBuildInputs,
	binding: ConditionalExportResolutionCanonicalBinding
): string {
	return canonicalSha256({
		consumerEnvironment: binding.consumerEnvironment,
		frozenSubject: {
			fileManifestDigest: inputs.frozenSubject.descriptor.fileManifestDigest,
			policyVersion: inputs.frozenSubject.descriptor.policyVersion,
			schemaVersion: inputs.frozenSubject.descriptor.schemaVersion,
			subjectId: inputs.frozenSubject.descriptor.subjectId
		},
		manifestWitness: binding.manifestWitness,
		projectContextGraph: {
			canonicalProfile: inputs.projectContextGraph.canonicalProfile,
			contentDigest: inputs.projectContextGraph.contentDigest,
			id: inputs.projectContextGraph.id,
			inputDigest: inputs.projectContextGraph.inputDigest,
			method: inputs.projectContextGraph.method,
			operationVersion: inputs.projectContextGraph.operationVersion,
			schemaVersion: inputs.projectContextGraph.schemaVersion,
			semanticSnapshotId: inputs.projectContextGraph.semanticSnapshotId,
			subjectId: inputs.projectContextGraph.subjectId
		},
		request: inputs.request,
		semanticSnapshot: {
			extractionVersion: inputs.semanticSnapshot.extractionVersion,
			id: inputs.semanticSnapshot.id,
			operationVersion: inputs.semanticSnapshot.operationVersion,
			provider: inputs.semanticSnapshot.provider,
			schemaVersion: inputs.semanticSnapshot.schemaVersion,
			subjectId: inputs.semanticSnapshot.subjectId
		}
	});
}

function independentContentDigest(value: ConditionalExportResolutionSnapshot): string {
	const content: Record<string, unknown> = {};
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string' || key === 'contentDigest') continue;
		content[key] = Reflect.getOwnPropertyDescriptor(value, key)!.value;
	}
	return canonicalSha256(content);
}

function inputShellIssue(value: unknown): ConditionalExportResolutionValidationIssue | null {
	if (!plainRecord(value) || !exactKeys(value, INPUT_KEYS))
		return issue(
			'INPUT_INVALID',
			'The conditional-export input wrapper must be exact plain data.',
			'$inputs'
		);
	for (const key of INPUT_KEYS) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key)!;
		if (!plainRecord(descriptor.value))
			return issue('INPUT_INVALID', `${key} must be a plain data record.`, `$inputs.${key}`);
	}
	return null;
}

function safeRelativePackageSyntax(value: string, rootAllowed: boolean): boolean {
	if (rootAllowed && value === '.') return true;
	if (
		!isUnicodeScalarString(value) ||
		!value.startsWith('./') ||
		value.length <= 2 ||
		/[\\%?#*]/u.test(value)
	)
		return false;
	const segments = value.slice(2).split('/');
	return segments.every(
		(segment) =>
			segment.length > 0 &&
			segment !== '.' &&
			segment !== '..' &&
			segment.toLowerCase() !== 'node_modules'
	);
}

function numericConditionKey(value: string): boolean {
	const numeric = Number(value);
	return String(numeric) === value && numeric >= 0 && numeric < 4_294_967_295;
}

function requestIssue(
	inputs: ConditionalExportResolutionBuildInputs
): ConditionalExportResolutionValidationIssue | null {
	const { request } = inputs;
	if (
		!plainRecord(request) ||
		!exactKeys(request, REQUEST_KEYS) ||
		!plainRecord(request.budgets) ||
		!exactKeys(request.budgets, BUDGET_KEYS) ||
		!plainRecord(request.consumer) ||
		!exactKeys(request.consumer, CONSUMER_KEYS) ||
		!plainRecord(request.projectContextGraph) ||
		!exactKeys(request.projectContextGraph, GRAPH_REFERENCE_KEYS) ||
		!plainRecord(request.selection) ||
		!exactKeys(request.selection, SELECTION_KEYS) ||
		!Array.isArray(request.conditions)
	)
		return issue(
			'INPUT_INVALID',
			'The conditional-export request shell is not exact.',
			'$inputs.request'
		);
	if (
		BUDGET_KEYS.some((key) =>
			key === 'maxBranches' || key === 'maxConditionChecks' || key === 'maxFrontiers'
				? !safeNonnegative(request.budgets[key])
				: !safePositive(request.budgets[key])
		) ||
		request.budgets.maxDiagnostics > 100_000 ||
		request.schemaVersion !== CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION ||
		request.operationVersion !== CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION ||
		!canonicalEqual(request.selection, CONDITIONAL_EXPORT_RESOLUTION_SELECTION)
	)
		return issue('INPUT_INVALID', 'Request constants or budgets are invalid.', '$inputs.request');
	if (
		request.conditions.some(
			(condition) =>
				typeof condition !== 'string' ||
				condition.length === 0 ||
				!isUnicodeScalarString(condition) ||
				numericConditionKey(condition) ||
				RESERVED_CONDITIONS.has(condition)
		) ||
		new Set(request.conditions).size !== request.conditions.length
	)
		return issue(
			'INPUT_INVALID',
			'Explicit conditions must be unique nonempty nonnumeric scalar names outside the reserved set.',
			'$inputs.request.conditions'
		);
	if (
		typeof request.exportSubpath !== 'string' ||
		!safeRelativePackageSyntax(request.exportSubpath, true)
	)
		return issue(
			'INPUT_INVALID',
			'The requested exact export subpath is outside the supported syntax.',
			'$inputs.request.exportSubpath'
		);
	if (
		typeof request.packageName !== 'string' ||
		request.packageName.length === 0 ||
		typeof request.manifestPath !== 'string' ||
		request.manifestPath.length === 0 ||
		request.manifestPath.startsWith('/') ||
		request.manifestPath.includes('\\') ||
		request.manifestPath
			.split('/')
			.some((segment) => segment === '' || segment === '.' || segment === '..') ||
		!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(request.packageName) ||
		!['IMPORT', 'REQUIRE'].includes(request.moduleMode) ||
		!['NEUTRAL', 'NODE'].includes(request.platform)
	)
		return issue(
			'INPUT_INVALID',
			'Request package or consumer-mode criteria are invalid.',
			'$inputs.request'
		);
	if (
		CONSUMER_KEYS.some((key) => {
			const value = request.consumer[key];
			return typeof value !== 'string' || value.length === 0;
		}) ||
		typeof request.subjectId !== 'string' ||
		request.subjectId.length === 0 ||
		typeof request.semanticSnapshotId !== 'string' ||
		request.semanticSnapshotId.length === 0 ||
		typeof request.projectContextGraph.graphId !== 'string' ||
		request.projectContextGraph.graphId.length === 0 ||
		typeof request.projectContextGraph.contentDigest !== 'string' ||
		!SHA256.test(request.projectContextGraph.contentDigest) ||
		typeof request.projectContextGraph.inputDigest !== 'string' ||
		!SHA256.test(request.projectContextGraph.inputDigest)
	)
		return issue('INPUT_INVALID', 'Request identities are invalid.', '$inputs.request');
	return null;
}

function inputBindingIssue(
	inputs: ConditionalExportResolutionBuildInputs
): ConditionalExportResolutionValidationIssue | null {
	const { frozenSubject, projectContextGraph, request, semanticSnapshot } = inputs;
	if (!isFrozenSubjectCapability(frozenSubject))
		return issue(
			'INPUT_INVALID',
			'The frozen subject must retain its opaque frozen-byte capability.',
			'$inputs.frozenSubject'
		);
	if (
		request.subjectId !== frozenSubject.descriptor.subjectId ||
		request.subjectId !== semanticSnapshot.subjectId ||
		request.subjectId !== projectContextGraph.subjectId ||
		request.semanticSnapshotId !== semanticSnapshot.id ||
		request.semanticSnapshotId !== projectContextGraph.semanticSnapshotId ||
		request.projectContextGraph.graphId !== projectContextGraph.id ||
		request.projectContextGraph.contentDigest !== projectContextGraph.contentDigest ||
		request.projectContextGraph.inputDigest !== projectContextGraph.inputDigest
	)
		return issue('IDENTITY_MISMATCH', 'Input identities do not bind exactly.', '$inputs.request');
	return null;
}

function projectContextValidationIssue(
	inputs: ConditionalExportResolutionBuildInputs,
	limits: ClosedOptions
): ConditionalExportResolutionValidationIssue | null {
	const graph = inputs.projectContextGraph;
	const validation = validateProjectContextGraph(
		graph,
		{
			frozenSubject: inputs.frozenSubject,
			request: {
				budgets: graph.budgets,
				operationVersion: graph.operationVersion,
				schemaVersion: PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
				selection: graph.selection,
				semanticSnapshotId: graph.semanticSnapshotId,
				subjectId: graph.subjectId
			},
			semanticSnapshot: inputs.semanticSnapshot
		},
		{
			maxDepth: limits.maxDepth,
			maxInputRecords: Math.min(limits.maxInputRecords, inputs.request.budgets.maxInputRecords),
			maxInputStringCharacters: Math.min(
				limits.maxInputStringCharacters,
				inputs.request.budgets.maxInputStringCharacters
			),
			maxIssues: Math.min(limits.maxIssues, inputs.request.budgets.maxDiagnostics),
			maxRecords: Math.min(limits.maxRecords, inputs.request.budgets.maxInputRecords),
			maxStringCharacters: Math.min(
				limits.maxStringCharacters,
				inputs.request.budgets.maxInputStringCharacters
			)
		}
	);
	if (validation.state === 'VALID') return null;
	return issue(
		validation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
		'The project-context graph is not independently valid for the exact predecessors.',
		'$inputs.projectContextGraph'
	);
}

interface BoundConsumerAndManifest {
	readonly consumerEnvironment: ConditionalExportResolutionCanonicalBinding['consumerEnvironment'];
	readonly manifestArtifact: { readonly bytes: number; readonly sha256: string };
	readonly manifestBytes: Uint8Array;
	readonly workspace: ConditionalExportResolutionBuildInputs['frozenSubject']['workspaces'][number];
}

type BindingResult =
	| { readonly binding: BoundConsumerAndManifest; readonly state: 'VALID' }
	| { readonly problem: ConditionalExportResolutionValidationIssue; readonly state: 'INVALID' };

function bindConsumerAndManifest(inputs: ConditionalExportResolutionBuildInputs): BindingResult {
	const { frozenSubject, projectContextGraph, request } = inputs;
	const workspaces = frozenSubject.workspaces.filter(
		(workspace) => workspace.name === request.packageName
	);
	if (
		workspaces.length !== 1 ||
		workspaces[0]!.kind !== 'PACKAGE' ||
		workspaces[0]!.manifestPath !== request.manifestPath
	)
		return {
			problem: issue(
				'INPUT_INVALID',
				'The requested package must identify one exact frozen workspace package and manifest.',
				'$inputs.request.packageName'
			),
			state: 'INVALID'
		};
	const workspace = workspaces[0]!;
	const artifacts = frozenSubject.artifacts.filter(
		(artifact) => artifact.path === request.manifestPath
	);
	const manifestBytes = readFrozenSubjectArtifact(frozenSubject, request.manifestPath);
	if (artifacts.length !== 1 || manifestBytes === undefined)
		return {
			problem: issue(
				'INPUT_INVALID',
				'The exact frozen package manifest bytes are unavailable.',
				'$inputs.request.manifestPath'
			),
			state: 'INVALID'
		};
	const artifact = artifacts[0]!;
	const rawSha256 = createHash('sha256').update(manifestBytes).digest('hex');
	if (
		artifact.bytes !== manifestBytes.byteLength ||
		artifact.sha256 !== rawSha256 ||
		manifestBytes.byteLength > request.budgets.maxManifestBytes
	)
		return {
			problem: issue(
				manifestBytes.byteLength > request.budgets.maxManifestBytes
					? 'BUDGET_EXHAUSTED'
					: 'INPUT_INVALID',
				'The exact manifest byte witness is invalid or exceeds its budget.',
				'$inputs.request.budgets.maxManifestBytes'
			),
			state: 'INVALID'
		};
	const programs = projectContextGraph.programs.filter(
		(program) => program.id === request.consumer.projectContextProgramId
	);
	const sources = projectContextGraph.sources.filter(
		(source) => source.id === request.consumer.projectContextSourceId
	);
	if (
		programs.length !== 1 ||
		sources.length !== 1 ||
		sources[0]!.programId !== programs[0]!.id ||
		programs[0]!.semanticProgramId !== request.consumer.semanticProgramId ||
		sources[0]!.semanticProgramId !== request.consumer.semanticProgramId ||
		sources[0]!.semanticSourceId !== request.consumer.semanticSourceId
	)
		return {
			problem: issue(
				'INPUT_INVALID',
				'The selected consumer does not bind to one exact project-context program and source.',
				'$inputs.request.consumer'
			),
			state: 'INVALID'
		};
	const program = programs[0]!;
	const source = sources[0]!;
	const effectiveConditions = [
		...request.conditions,
		...(request.platform === 'NODE' ? (['node'] as const) : []),
		request.moduleMode === 'IMPORT' ? 'import' : 'require'
	];
	return {
		binding: {
			consumerEnvironment: {
				conditionSemantics: 'MEMBERSHIP_ONLY_PRIORITY_FROM_MANIFEST_DECLARATION_ORDER',
				conditions: [...request.conditions],
				defaultConditionEnabled: true,
				effectiveConditions,
				logicalPath: source.logicalPath,
				moduleMode: request.moduleMode,
				platform: request.platform,
				projectContextProgramId: program.id,
				projectContextProjectId: program.projectId,
				projectContextSourceId: source.id,
				semanticProgramId: program.semanticProgramId,
				semanticProjectId: program.semanticProjectId,
				semanticSourceId: source.semanticSourceId
			},
			manifestArtifact: { bytes: artifact.bytes, sha256: artifact.sha256 },
			manifestBytes,
			workspace
		},
		state: 'VALID'
	};
}

function sourceSpan(node: ts.Node, source: ts.SourceFile): ConditionalExportManifestSourceSpan {
	const start = node.getStart(source);
	return {
		coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
		length: node.end - start,
		start
	};
}

function propertyName(property: ts.PropertyAssignment): string | null {
	return ts.isStringLiteral(property.name) ? property.name.text : null;
}

interface ParsedManifest {
	readonly astNodes: number;
	readonly declarationOrdinals: ReadonlyMap<ts.PropertyAssignment, number>;
	readonly exportsProperty: ts.PropertyAssignment | null;
	readonly importsProperty: ts.PropertyAssignment | null;
	readonly manifestWitness: ConditionalExportManifestWitness;
	readonly root: ts.ObjectLiteralExpression;
	readonly source: ts.JsonSourceFile;
	readonly text: string;
}

type ParseResult =
	| { readonly parsed: ParsedManifest; readonly state: 'VALID' }
	| { readonly problem: ConditionalExportResolutionValidationIssue; readonly state: 'INVALID' };

interface ManifestAstScan {
	readonly astNodes: number;
	readonly declarationOrdinals: ReadonlyMap<ts.PropertyAssignment, number>;
	readonly objectLiterals: readonly ts.ObjectLiteralExpression[];
}

/** Explicit-stack AST sweep; null means the request AST-node budget was exhausted. */
function scanManifestAst(source: ts.JsonSourceFile, maxAstNodes: number): ManifestAstScan | null {
	const declarationOrdinals = new Map<ts.PropertyAssignment, number>();
	const objectLiterals: ts.ObjectLiteralExpression[] = [];
	const pending: ts.Node[] = [source];
	let astNodes = 0;
	let declarationOrdinal = 0;
	while (pending.length > 0) {
		const node = pending.pop()!;
		astNodes += 1;
		if (astNodes > maxAstNodes) return null;
		if (ts.isPropertyAssignment(node)) {
			declarationOrdinals.set(node, declarationOrdinal);
			declarationOrdinal += 1;
		}
		if (ts.isObjectLiteralExpression(node)) objectLiterals.push(node);
		const children: ts.Node[] = [];
		ts.forEachChild(node, (child) => {
			children.push(child);
		});
		for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
	}
	return { astNodes, declarationOrdinals, objectLiterals };
}

function manifestMemberIssue(
	objectLiterals: readonly ts.ObjectLiteralExpression[]
): ConditionalExportResolutionValidationIssue | null {
	for (const object of objectLiterals) {
		const names = new Set<string>();
		for (const property of object.properties) {
			if (!ts.isPropertyAssignment(property))
				return issue(
					'INPUT_INVALID',
					'The manifest contains an unsupported object member.',
					'$manifest'
				);
			const name = propertyName(property);
			if (name === null || !isUnicodeScalarString(name) || names.has(name))
				return issue(
					'INPUT_INVALID',
					'The manifest contains a duplicate or non-string object key.',
					'$manifest'
				);
			names.add(name);
		}
	}
	return null;
}

function manifestRootProperties(root: ts.ObjectLiteralExpression): {
	readonly exportsProperty: ts.PropertyAssignment | null;
	readonly importsProperty: ts.PropertyAssignment | null;
} {
	let exportsProperty: ts.PropertyAssignment | null = null;
	let importsProperty: ts.PropertyAssignment | null = null;
	for (const property of root.properties) {
		const assignment = property as ts.PropertyAssignment;
		const name = propertyName(assignment)!;
		if (name === 'exports') exportsProperty = assignment;
		if (name === 'imports') importsProperty = assignment;
	}
	return { exportsProperty, importsProperty };
}

function manifestNameBinds(root: ts.ObjectLiteralExpression, workspaceName: string): boolean {
	const nameProperty = root.properties.find(
		(property) => propertyName(property as ts.PropertyAssignment) === 'name'
	) as ts.PropertyAssignment | undefined;
	return (
		nameProperty !== undefined &&
		ts.isStringLiteral(nameProperty.initializer) &&
		nameProperty.initializer.text === workspaceName
	);
}

function parseManifest(
	inputs: ConditionalExportResolutionBuildInputs,
	bound: BoundConsumerAndManifest
): ParseResult {
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bound.manifestBytes);
	} catch {
		return {
			problem: issue(
				'INPUT_INVALID',
				'The frozen package manifest is not valid UTF-8.',
				'$manifest'
			),
			state: 'INVALID'
		};
	}
	const source = ts.parseJsonText(inputs.request.manifestPath, text);
	const diagnostics = (
		source as ts.JsonSourceFile & { readonly parseDiagnostics?: readonly ts.Diagnostic[] }
	).parseDiagnostics;
	if (diagnostics !== undefined && diagnostics.length > 0)
		return {
			problem: issue(
				'INPUT_INVALID',
				'The frozen package manifest has JSON parse diagnostics.',
				'$manifest'
			),
			state: 'INVALID'
		};
	const scan = scanManifestAst(source, inputs.request.budgets.maxAstNodes);
	if (scan === null)
		return {
			problem: issue(
				'BUDGET_EXHAUSTED',
				'The manifest AST-node budget was exhausted.',
				'$inputs.request.budgets.maxAstNodes'
			),
			state: 'INVALID'
		};
	if (
		source.statements.length !== 1 ||
		!ts.isExpressionStatement(source.statements[0]!) ||
		!ts.isObjectLiteralExpression(source.statements[0]!.expression)
	)
		return {
			problem: issue(
				'INPUT_INVALID',
				'The package manifest root must be a JSON object.',
				'$manifest'
			),
			state: 'INVALID'
		};
	const root = source.statements[0]!.expression;
	const memberIssue = manifestMemberIssue(scan.objectLiterals);
	if (memberIssue !== null) return { problem: memberIssue, state: 'INVALID' };
	const { exportsProperty, importsProperty } = manifestRootProperties(root);
	if (!manifestNameBinds(root, bound.workspace.name))
		return {
			problem: issue(
				'INPUT_INVALID',
				'The raw manifest name must bind exactly to the selected frozen workspace package.',
				'$manifest.name'
			),
			state: 'INVALID'
		};
	const exportsValueSpan =
		exportsProperty === null ? null : sourceSpan(exportsProperty.initializer, source);
	const exportsValueSha256 =
		exportsValueSpan === null
			? null
			: createHash('sha256')
					.update(
						text.slice(exportsValueSpan.start, exportsValueSpan.start + exportsValueSpan.length),
						'utf8'
					)
					.digest('hex');
	return {
		parsed: {
			astNodes: scan.astNodes,
			declarationOrdinals: scan.declarationOrdinals,
			exportsProperty,
			importsProperty,
			manifestWitness: {
				exportsPropertySpan: exportsProperty === null ? null : sourceSpan(exportsProperty, source),
				exportsValueSha256,
				exportsValueSpan,
				importsPropertySpan: importsProperty === null ? null : sourceSpan(importsProperty, source),
				manifestBytes: bound.manifestArtifact.bytes,
				manifestPath: inputs.request.manifestPath,
				manifestSha256: bound.manifestArtifact.sha256,
				parseMethod: 'TYPESCRIPT_PARSE_JSON_TEXT',
				parserVersion: ts.version,
				rootSpan: sourceSpan(root, source),
				sourceEncoding: 'UTF-8',
				workspaceKind: 'PACKAGE',
				workspaceName: bound.workspace.name,
				workspacePath: bound.workspace.path
			},
			root,
			source,
			text
		},
		state: 'VALID'
	};
}

function declarationOrdinal(parsed: ParsedManifest, property: ts.PropertyAssignment): number {
	return parsed.declarationOrdinals.get(property)!;
}

function nullLiteral(node: ts.Expression): boolean {
	return node.kind === ts.SyntaxKind.NullKeyword;
}

function conditionMatch(
	condition: string,
	inputs: ConditionalExportResolutionBuildInputs
): ConditionalExportBranchRecord['conditionMatch'] {
	if (condition === 'default') return 'DEFAULT';
	if (inputs.request.conditions.includes(condition)) return 'EXPLICIT';
	if (condition === 'node' && inputs.request.platform === 'NODE') return 'PLATFORM';
	if (
		(condition === 'import' && inputs.request.moduleMode === 'IMPORT') ||
		(condition === 'require' && inputs.request.moduleMode === 'REQUIRE')
	)
		return 'MODULE_MODE';
	return 'INACTIVE';
}

interface BranchSeed {
	readonly condition: string;
	readonly conditionMatch: ConditionalExportBranchRecord['conditionMatch'];
	readonly conditionPath: readonly string[];
	readonly declarationOrdinal: number;
	readonly depth: number;
	readonly exclusionReason: ConditionalExportBranchRecord['exclusionReason'];
	readonly keySpan: ConditionalExportManifestSourceSpan;
	readonly parentIndex: number | null;
	readonly target: string | null;
	readonly valueKind: ConditionalExportBranchRecord['valueKind'];
	readonly valueSpan: ConditionalExportManifestSourceSpan;
}

interface FrontierSeed {
	readonly declarationOrdinal: number;
	readonly declarationPath: readonly string[];
	readonly impact: ConditionalExportFrontierRecord['impact'];
	readonly reason: ConditionalExportFrontierReason;
	readonly sourceSpan: ConditionalExportManifestSourceSpan;
}

function compareFrontierSeeds(left: FrontierSeed, right: FrontierSeed): number {
	// A PropertyAssignment has one global declaration ordinal and contributes at
	// most one frontier, so the remaining frozen tuple keys can never tie-break.
	return left.declarationOrdinal - right.declarationOrdinal;
}

function frontierSeed(
	parsed: ParsedManifest,
	property: ts.PropertyAssignment,
	declarationPath: readonly string[],
	impact: ConditionalExportFrontierRecord['impact'],
	reason: ConditionalExportFrontierReason,
	spanNode: ts.Node
): FrontierSeed {
	return {
		declarationOrdinal: declarationOrdinal(parsed, property),
		declarationPath,
		impact,
		reason,
		sourceSpan: sourceSpan(spanNode, parsed.source)
	};
}

interface EvaluatedSurface {
	readonly branchSeeds: readonly BranchSeed[];
	readonly decisionLeafSeedIndex: number | null;
	readonly decisionState: ConditionalExportDecisionRecord['state'];
	readonly decisionTarget: string | null;
	readonly exactKeyOutcome: ConditionalExportResolutionSnapshot['exactKeyOutcome'];
	readonly exactKeyComparisons: number;
	readonly frontierSeeds: readonly FrontierSeed[];
}

interface PendingConditionProperty {
	readonly ancestorsActive: boolean;
	readonly conditionPath: readonly string[];
	readonly parentIndex: number | null;
	readonly property: ts.PropertyAssignment;
}

interface ConditionTreeWalk {
	readonly branchSeeds: BranchSeed[];
	decisionLeafSeedIndex: number | null;
	decisionState: ConditionalExportDecisionRecord['state'] | null;
	decisionTarget: string | null;
	readonly exportSubpath: string;
	readonly frontierSeeds: FrontierSeed[];
	readonly inputs: ConditionalExportResolutionBuildInputs;
	readonly parsed: ParsedManifest;
	readonly pending: PendingConditionProperty[];
	terminated: boolean;
}

function conditionValueKind(
	initializer: ts.Expression
): ConditionalExportBranchRecord['valueKind'] | null {
	if (ts.isObjectLiteralExpression(initializer)) return 'CONDITION_OBJECT';
	if (ts.isStringLiteral(initializer)) return 'STRING';
	if (nullLiteral(initializer)) return 'NULL';
	return null;
}

function branchExclusionReason(
	priorTerminated: boolean,
	ancestorsActive: boolean,
	active: boolean
): ConditionalExportBranchRecord['exclusionReason'] {
	if (priorTerminated) return 'PRIOR_BRANCH_TERMINATED_EVALUATION';
	if (!ancestorsActive) return 'ANCESTOR_CONDITION_INACTIVE';
	if (!active) return 'CONDITION_INACTIVE';
	return null;
}

/** An unsupported export value kind terminates evaluation only on the active path. */
function recordUnsupportedConditionValue(
	walk: ConditionTreeWalk,
	frame: PendingConditionProperty,
	path: readonly string[],
	pathActive: boolean
): void {
	const initializer = frame.property.initializer;
	walk.frontierSeeds.push(
		frontierSeed(
			walk.parsed,
			frame.property,
			['exports', walk.exportSubpath, ...path],
			pathActive ? 'BLOCKS_SELECTED_DECISION' : 'OUTSIDE_SELECTED_DECISION',
			ts.isArrayLiteralExpression(initializer)
				? 'EXPORT_ARRAY_FALLBACK_UNSUPPORTED'
				: 'UNSUPPORTED_EXPORT_VALUE_KIND',
			initializer
		)
	);
	if (pathActive) {
		walk.terminated = true;
		walk.decisionState = 'UNSUPPORTED';
	}
}

function applyConditionStringTarget(
	walk: ConditionTreeWalk,
	frame: PendingConditionProperty,
	path: readonly string[],
	pathActive: boolean,
	seedIndex: number,
	target: string
): void {
	const safe = safeRelativePackageSyntax(target, false);
	if (!safe) {
		walk.frontierSeeds.push(
			frontierSeed(
				walk.parsed,
				frame.property,
				['exports', walk.exportSubpath, ...path],
				pathActive ? 'BLOCKS_SELECTED_DECISION' : 'OUTSIDE_SELECTED_DECISION',
				'UNSUPPORTED_EXPORT_TARGET_SYNTAX',
				frame.property.initializer
			)
		);
	}
	if (pathActive) {
		walk.terminated = true;
		if (safe) {
			walk.decisionLeafSeedIndex = seedIndex;
			walk.decisionState = 'SELECTED_TARGET';
			walk.decisionTarget = target;
		} else walk.decisionState = 'UNSUPPORTED';
	}
}

function visitConditionProperty(walk: ConditionTreeWalk, frame: PendingConditionProperty): void {
	const condition = propertyName(frame.property)!;
	const path = [...frame.conditionPath, condition];
	const match = conditionMatch(condition, walk.inputs);
	const active = match !== 'INACTIVE';
	const priorTerminated = walk.terminated;
	const pathActive = !priorTerminated && frame.ancestorsActive && active;
	const initializer = frame.property.initializer;
	const valueKind = conditionValueKind(initializer);
	if (valueKind === null) {
		recordUnsupportedConditionValue(walk, frame, path, pathActive);
		return;
	}
	const target = ts.isStringLiteral(initializer) ? initializer.text : null;
	const seedIndex = walk.branchSeeds.length;
	walk.branchSeeds.push({
		condition,
		conditionMatch: match,
		conditionPath: path,
		declarationOrdinal: declarationOrdinal(walk.parsed, frame.property),
		depth: path.length - 1,
		exclusionReason: branchExclusionReason(priorTerminated, frame.ancestorsActive, active),
		keySpan: sourceSpan(frame.property.name, walk.parsed.source),
		parentIndex: frame.parentIndex,
		target,
		valueKind,
		valueSpan: sourceSpan(initializer, walk.parsed.source)
	});
	if (valueKind === 'STRING') {
		applyConditionStringTarget(walk, frame, path, pathActive, seedIndex, target!);
		return;
	}
	if (valueKind === 'NULL') {
		if (pathActive) {
			walk.terminated = true;
			walk.decisionLeafSeedIndex = seedIndex;
			walk.decisionState = 'BLOCKED_BY_NULL';
		}
		return;
	}
	if (ts.isObjectLiteralExpression(initializer))
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1)
			walk.pending.push({
				ancestorsActive: pathActive,
				conditionPath: path,
				parentIndex: seedIndex,
				property: initializer.properties[index] as ts.PropertyAssignment
			});
}

function evaluateConditionTree(
	inputs: ConditionalExportResolutionBuildInputs,
	parsed: ParsedManifest,
	root: ts.ObjectLiteralExpression,
	exportSubpath: string,
	frontierSeeds: FrontierSeed[]
): {
	readonly branchSeeds: readonly BranchSeed[];
	readonly decisionLeafSeedIndex: number | null;
	readonly decisionState: ConditionalExportDecisionRecord['state'];
	readonly decisionTarget: string | null;
} {
	const walk: ConditionTreeWalk = {
		branchSeeds: [],
		decisionLeafSeedIndex: null,
		decisionState: null,
		decisionTarget: null,
		exportSubpath,
		frontierSeeds,
		inputs,
		parsed,
		pending: [],
		terminated: false
	};
	for (let index = root.properties.length - 1; index >= 0; index -= 1)
		walk.pending.push({
			ancestorsActive: true,
			conditionPath: [],
			parentIndex: null,
			property: root.properties[index] as ts.PropertyAssignment
		});
	while (walk.pending.length > 0) visitConditionProperty(walk, walk.pending.pop()!);
	if (walk.decisionState === null)
		return {
			branchSeeds: walk.branchSeeds,
			decisionLeafSeedIndex: null,
			decisionState: 'NO_MATCHING_CONDITION',
			decisionTarget: null
		};
	return {
		branchSeeds: walk.branchSeeds,
		decisionLeafSeedIndex: walk.decisionLeafSeedIndex,
		decisionState: walk.decisionState,
		decisionTarget: walk.decisionTarget
	};
}

function exportsRootUnsupportedReason(value: ts.Expression): ConditionalExportFrontierReason {
	if (ts.isArrayLiteralExpression(value)) return 'EXPORT_ARRAY_FALLBACK_UNSUPPORTED';
	if (ts.isObjectLiteralExpression(value)) return 'EXPORTS_ROOT_CONDITION_MAP_UNSUPPORTED';
	return 'UNSUPPORTED_EXPORT_VALUE_KIND';
}

function rootStringDecisionState(
	rootSubpath: boolean,
	safeTarget: boolean
): ConditionalExportDecisionRecord['state'] {
	if (!rootSubpath) return 'NO_EXACT_EXPORT_KEY';
	if (safeTarget) return 'SELECTED_TARGET';
	return 'UNSUPPORTED';
}

/** The raw exports value is not an explicit subpath map, so only a root '.' request can bind it. */
function exportsRootValueSurface(
	inputs: ConditionalExportResolutionBuildInputs,
	parsed: ParsedManifest,
	exportsProperty: ts.PropertyAssignment,
	frontierSeeds: FrontierSeed[],
	rootKeyOutcome: () => ConditionalExportResolutionSnapshot['exactKeyOutcome']
): EvaluatedSurface {
	const exportsValue = exportsProperty.initializer;
	const rootSubpath = inputs.request.exportSubpath === '.';
	const impact = rootSubpath ? 'BLOCKS_SELECTED_DECISION' : 'OUTSIDE_SELECTED_DECISION';
	if (ts.isStringLiteral(exportsValue)) {
		const safe = safeRelativePackageSyntax(exportsValue.text, false);
		if (!safe)
			frontierSeeds.push(
				frontierSeed(
					parsed,
					exportsProperty,
					['exports'],
					impact,
					'UNSUPPORTED_EXPORT_TARGET_SYNTAX',
					exportsValue
				)
			);
		return {
			branchSeeds: [],
			decisionLeafSeedIndex: null,
			decisionState: rootStringDecisionState(rootSubpath, safe),
			decisionTarget: rootSubpath && safe ? exportsValue.text : null,
			exactKeyComparisons: 1,
			exactKeyOutcome: rootKeyOutcome(),
			frontierSeeds
		};
	}
	if (nullLiteral(exportsValue))
		return {
			branchSeeds: [],
			decisionLeafSeedIndex: null,
			decisionState: rootSubpath ? 'BLOCKED_BY_NULL' : 'NO_EXACT_EXPORT_KEY',
			decisionTarget: null,
			exactKeyComparisons: 1,
			exactKeyOutcome: rootKeyOutcome(),
			frontierSeeds
		};
	frontierSeeds.push(
		frontierSeed(
			parsed,
			exportsProperty,
			['exports'],
			impact,
			exportsRootUnsupportedReason(exportsValue),
			exportsValue
		)
	);
	return {
		branchSeeds: [],
		decisionLeafSeedIndex: null,
		decisionState: rootSubpath ? 'UNSUPPORTED' : 'NO_EXACT_EXPORT_KEY',
		decisionTarget: null,
		exactKeyComparisons: 1,
		exactKeyOutcome: rootKeyOutcome(),
		frontierSeeds
	};
}

/** Records a frontier for every pattern key and returns the last exact subpath key, if any. */
function selectExactExportProperty(
	inputs: ConditionalExportResolutionBuildInputs,
	parsed: ParsedManifest,
	assignments: ts.NodeArray<ts.PropertyAssignment>,
	frontierSeeds: FrontierSeed[]
): ts.PropertyAssignment | null {
	let exactProperty: ts.PropertyAssignment | null = null;
	for (const property of assignments) {
		const name = propertyName(property)!;
		if (name.includes('*'))
			frontierSeeds.push(
				frontierSeed(
					parsed,
					property,
					['exports', name],
					'OUTSIDE_SELECTED_DECISION',
					'EXPORT_PATTERN_KEY_UNSUPPORTED',
					property
				)
			);
		else if (name === inputs.request.exportSubpath) exactProperty = property;
	}
	return exactProperty;
}

function absentExactExportKeySurface(
	inputs: ConditionalExportResolutionBuildInputs,
	exactKeyComparisons: number,
	frontierSeeds: readonly FrontierSeed[]
): EvaluatedSurface {
	const adjustedFrontiers = frontierSeeds.map((frontier) =>
		frontier.reason === 'EXPORT_PATTERN_KEY_UNSUPPORTED'
			? { ...frontier, impact: 'BLOCKS_SELECTED_DECISION' as const }
			: frontier
	);
	const blocked = adjustedFrontiers.some(
		(frontier) => frontier.impact === 'BLOCKS_SELECTED_DECISION'
	);
	return {
		branchSeeds: [],
		decisionLeafSeedIndex: null,
		decisionState: blocked ? 'UNSUPPORTED' : 'NO_EXACT_EXPORT_KEY',
		decisionTarget: null,
		exactKeyComparisons,
		exactKeyOutcome: { exportSubpath: inputs.request.exportSubpath, state: 'ABSENT' },
		frontierSeeds: adjustedFrontiers
	};
}

function exactExportValueSurface(
	inputs: ConditionalExportResolutionBuildInputs,
	parsed: ParsedManifest,
	exactProperty: ts.PropertyAssignment,
	exactKeyOutcome: ConditionalExportResolutionSnapshot['exactKeyOutcome'],
	exactKeyComparisons: number,
	frontierSeeds: FrontierSeed[]
): EvaluatedSurface {
	const exactValue = exactProperty.initializer;
	if (ts.isStringLiteral(exactValue)) {
		const safe = safeRelativePackageSyntax(exactValue.text, false);
		if (!safe)
			frontierSeeds.push(
				frontierSeed(
					parsed,
					exactProperty,
					['exports', inputs.request.exportSubpath],
					'BLOCKS_SELECTED_DECISION',
					'UNSUPPORTED_EXPORT_TARGET_SYNTAX',
					exactValue
				)
			);
		return {
			branchSeeds: [],
			decisionLeafSeedIndex: null,
			decisionState: safe ? 'SELECTED_TARGET' : 'UNSUPPORTED',
			decisionTarget: safe ? exactValue.text : null,
			exactKeyComparisons,
			exactKeyOutcome,
			frontierSeeds
		};
	}
	if (nullLiteral(exactValue))
		return {
			branchSeeds: [],
			decisionLeafSeedIndex: null,
			decisionState: 'BLOCKED_BY_NULL',
			decisionTarget: null,
			exactKeyComparisons,
			exactKeyOutcome,
			frontierSeeds
		};
	if (ts.isObjectLiteralExpression(exactValue)) {
		const evaluated = evaluateConditionTree(
			inputs,
			parsed,
			exactValue,
			inputs.request.exportSubpath,
			frontierSeeds
		);
		return {
			...evaluated,
			exactKeyComparisons,
			exactKeyOutcome,
			frontierSeeds
		};
	}
	frontierSeeds.push(
		frontierSeed(
			parsed,
			exactProperty,
			['exports', inputs.request.exportSubpath],
			'BLOCKS_SELECTED_DECISION',
			ts.isArrayLiteralExpression(exactValue)
				? 'EXPORT_ARRAY_FALLBACK_UNSUPPORTED'
				: 'UNSUPPORTED_EXPORT_VALUE_KIND',
			exactValue
		)
	);
	return {
		branchSeeds: [],
		decisionLeafSeedIndex: null,
		decisionState: 'UNSUPPORTED',
		decisionTarget: null,
		exactKeyComparisons,
		exactKeyOutcome,
		frontierSeeds
	};
}

function evaluateSurface(
	inputs: ConditionalExportResolutionBuildInputs,
	parsed: ParsedManifest
): EvaluatedSurface {
	const { exportsProperty, importsProperty, source } = parsed;
	const frontierSeeds: FrontierSeed[] = [];
	if (importsProperty !== null)
		frontierSeeds.push(
			frontierSeed(
				parsed,
				importsProperty,
				['imports'],
				'OUTSIDE_SELECTED_DECISION',
				'PACKAGE_IMPORTS_MAP_UNSUPPORTED',
				importsProperty
			)
		);
	if (exportsProperty === null)
		return {
			branchSeeds: [],
			decisionLeafSeedIndex: null,
			decisionState: 'NO_EXACT_EXPORT_KEY',
			decisionTarget: null,
			exactKeyComparisons: 0,
			exactKeyOutcome: { exportSubpath: inputs.request.exportSubpath, state: 'ABSENT' },
			frontierSeeds
		};
	const exportsValue = exportsProperty.initializer;
	const exportsOrdinal = declarationOrdinal(parsed, exportsProperty);
	const rootKeyOutcome = (): ConditionalExportResolutionSnapshot['exactKeyOutcome'] =>
		inputs.request.exportSubpath === '.'
			? {
					declarationOrdinal: exportsOrdinal,
					exportSubpath: inputs.request.exportSubpath,
					keySpan: sourceSpan(exportsProperty.name, source),
					matchKind: 'ROOT_DOT_SUGAR',
					state: 'MATCHED',
					valueSpan: sourceSpan(exportsValue, source)
				}
			: { exportSubpath: inputs.request.exportSubpath, state: 'ABSENT' };

	const explicitSubpathMap =
		ts.isObjectLiteralExpression(exportsValue) &&
		exportsValue.properties.every((property) =>
			propertyName(property as ts.PropertyAssignment)!.startsWith('.')
		);
	if (!explicitSubpathMap)
		return exportsRootValueSurface(inputs, parsed, exportsProperty, frontierSeeds, rootKeyOutcome);

	const assignments = exportsValue.properties as ts.NodeArray<ts.PropertyAssignment>;
	const exactProperty = selectExactExportProperty(inputs, parsed, assignments, frontierSeeds);
	if (exactProperty === null)
		return absentExactExportKeySurface(inputs, assignments.length, frontierSeeds);
	const exactKeyOutcome: ConditionalExportResolutionSnapshot['exactKeyOutcome'] = {
		declarationOrdinal: declarationOrdinal(parsed, exactProperty),
		exportSubpath: inputs.request.exportSubpath,
		keySpan: sourceSpan(exactProperty.name, source),
		matchKind: 'EXPLICIT_SUBPATH_KEY',
		state: 'MATCHED',
		valueSpan: sourceSpan(exactProperty.initializer, source)
	};
	return exactExportValueSurface(
		inputs,
		parsed,
		exactProperty,
		exactKeyOutcome,
		assignments.length,
		frontierSeeds
	);
}

type Derivation =
	| { readonly graph: ConditionalExportResolutionSnapshot; readonly state: 'VALID' }
	| { readonly problem: ConditionalExportResolutionValidationIssue; readonly state: 'INVALID' };

interface DerivedRecordCounts {
	readonly branchRecords: number;
	readonly chargedTraversalSteps: number;
	readonly frontierRecords: number;
	readonly outputRecords: number;
}

/** Coverage tallies are one-or-zero counts of a single reconciled condition. */
function tally(condition: boolean): 0 | 1 {
	return condition ? 1 : 0;
}

function operationBudgetIssue(
	inputs: ConditionalExportResolutionBuildInputs,
	counts: DerivedRecordCounts
): ConditionalExportResolutionValidationIssue | null {
	const { budgets } = inputs.request;
	for (const [actual, maximum, path] of [
		[counts.branchRecords, budgets.maxBranches, '$inputs.request.budgets.maxBranches'],
		[
			counts.branchRecords,
			budgets.maxConditionChecks,
			'$inputs.request.budgets.maxConditionChecks'
		],
		[counts.frontierRecords, budgets.maxFrontiers, '$inputs.request.budgets.maxFrontiers'],
		[
			counts.chargedTraversalSteps,
			budgets.maxTraversalSteps,
			'$inputs.request.budgets.maxTraversalSteps'
		],
		[counts.outputRecords, budgets.maxOutputRecords, '$inputs.request.budgets.maxOutputRecords']
	] as const) {
		if (actual > maximum)
			return issue('BUDGET_EXHAUSTED', `The operation budget at ${path} was exhausted.`, path);
	}
	return null;
}

/** The selected leaf and every ancestor branch seed on its path back to the tree root. */
function selectedBranchSeedIndexes(evaluated: EvaluatedSurface): Set<number> {
	const selected = new Set<number>();
	let current: number | null = evaluated.decisionLeafSeedIndex;
	while (current !== null) {
		selected.add(current);
		current = evaluated.branchSeeds[current]!.parentIndex;
	}
	return selected;
}

function branchEvaluation(
	seed: BranchSeed,
	ordinal: number,
	selected: ReadonlySet<number>
): ConditionalExportBranchRecord['evaluation'] {
	if (seed.exclusionReason !== null) return 'EXCLUDED';
	if (selected.has(ordinal)) return 'SELECTED';
	return 'CANDIDATE';
}

function derive(
	inputs: ConditionalExportResolutionBuildInputs,
	bound: BoundConsumerAndManifest,
	parsed: ParsedManifest,
	knownInputDigest?: string
): Derivation {
	const binding: ConditionalExportResolutionCanonicalBinding = {
		consumerEnvironment: bound.consumerEnvironment,
		manifestWitness: parsed.manifestWitness
	};
	const inputDigest = independentInputDigest(inputs, binding);
	if (knownInputDigest !== undefined && knownInputDigest !== inputDigest)
		return {
			problem: issue(
				'IDENTITY_MISMATCH',
				'The producer-supplied input digest does not reproduce from the exact inputs.',
				'$validationInput.inputDigest'
			),
			state: 'INVALID'
		};
	const resolutionId = independentResolutionId({
		inputDigest,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.frozenSubject.descriptor.subjectId
	});
	const evaluated = evaluateSurface(inputs, parsed);
	const branchRecords = evaluated.branchSeeds.length;
	const frontierRecords = evaluated.frontierSeeds.length;
	const chargedTraversalSteps =
		parsed.astNodes + evaluated.exactKeyComparisons + branchRecords + frontierRecords;
	const outputRecords = 1 + branchRecords + frontierRecords;
	const budgetIssue = operationBudgetIssue(inputs, {
		branchRecords,
		chargedTraversalSteps,
		frontierRecords,
		outputRecords
	});
	if (budgetIssue !== null) return { problem: budgetIssue, state: 'INVALID' };
	const selectedSeedIndexes = selectedBranchSeedIndexes(evaluated);
	const branches = evaluated.branchSeeds.map((seed, ordinal): ConditionalExportBranchRecord => {
		const identityInput = {
			conditionPath: seed.conditionPath,
			declarationOrdinal: seed.declarationOrdinal,
			keySpan: seed.keySpan,
			ordinal,
			valueKind: seed.valueKind,
			valueSpan: seed.valueSpan
		};
		return {
			condition: seed.condition,
			conditionMatch: seed.conditionMatch,
			conditionPath: seed.conditionPath,
			declarationOrdinal: seed.declarationOrdinal,
			depth: seed.depth,
			evaluation: branchEvaluation(seed, ordinal, selectedSeedIndexes),
			exclusionReason: seed.exclusionReason,
			id: independentBranchId(resolutionId, identityInput),
			keySpan: seed.keySpan,
			ordinal,
			target: seed.target,
			valueKind: seed.valueKind,
			valueSpan: seed.valueSpan
		};
	});
	const orderedFrontiers = [...evaluated.frontierSeeds].sort(compareFrontierSeeds);
	const frontiers = orderedFrontiers.map((seed, ordinal): ConditionalExportFrontierRecord => ({
		declarationOrdinal: seed.declarationOrdinal,
		declarationPath: seed.declarationPath,
		id: independentFrontierId(resolutionId, {
			declarationOrdinal: seed.declarationOrdinal,
			declarationPath: seed.declarationPath,
			ordinal,
			reason: seed.reason,
			sourceSpan: seed.sourceSpan
		}),
		impact: seed.impact,
		ordinal,
		reason: seed.reason,
		sourceSpan: seed.sourceSpan
	}));
	const selectedBranchId =
		evaluated.decisionLeafSeedIndex === null ? null : branches[evaluated.decisionLeafSeedIndex]!.id;
	const decision = {
		basis: 'RAW_MANIFEST_DECLARATION_ORDER_FOR_EXACT_CONSUMER_ENVIRONMENT',
		id: independentDecisionId(resolutionId),
		ordinal: 0,
		selectedBranchId,
		state: evaluated.decisionState,
		target: evaluated.decisionTarget
	} as ConditionalExportDecisionRecord;
	const coverage = {
		astNodes: parsed.astNodes,
		blockedByNullDecisions: tally(decision.state === 'BLOCKED_BY_NULL'),
		branchPopulationReconciles: true as const,
		branchRecords,
		candidateBranches: branches.filter((branch) => branch.evaluation === 'CANDIDATE').length,
		chargedTraversalSteps,
		conditionChecks: branchRecords,
		decisionPopulationReconciles: true as const,
		decisionRecords: 1 as const,
		exactExportKeyComparisons: evaluated.exactKeyComparisons,
		exactExportKeyMatches: tally(evaluated.exactKeyOutcome.state === 'MATCHED'),
		exactExportKeyMisses: tally(evaluated.exactKeyOutcome.state === 'ABSENT'),
		excludedBranches: branches.filter((branch) => branch.evaluation === 'EXCLUDED').length,
		frontierPopulationReconciles: true as const,
		frontierRecords,
		manifestBytes: parsed.manifestWitness.manifestBytes,
		noExactExportKeyDecisions: tally(decision.state === 'NO_EXACT_EXPORT_KEY'),
		noMatchingConditionDecisions: tally(decision.state === 'NO_MATCHING_CONDITION'),
		outputRecords,
		selectedBranches: branches.filter((branch) => branch.evaluation === 'SELECTED').length,
		selectedConsumerPrograms: 1 as const,
		selectedConsumerSources: 1 as const,
		selectedManifests: 1 as const,
		selectedTargetDecisions: tally(decision.state === 'SELECTED_TARGET'),
		selectedWorkspacePackages: 1 as const,
		unsupportedDecisions: tally(decision.state === 'UNSUPPORTED')
	};
	const open = decision.state === 'UNSUPPORTED';
	const content = {
		authorityTransfer: CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER,
		branches,
		budgets: inputs.request.budgets,
		canonicalProfile: CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE,
		capability: CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY,
		capabilityStatus: CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS,
		closure: open
			? ('OPEN_FOR_SELECTED_EXACT_EXPORT_DECISION' as const)
			: ('CLOSED_FOR_SELECTED_EXACT_EXPORT_DECISION' as const),
		consumerEnvironment: bound.consumerEnvironment,
		coverage,
		currentness: CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS,
		decision,
		exactKeyOutcome: evaluated.exactKeyOutcome,
		freshness: CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS,
		frontiers,
		fullJanCsaa012Conformance: CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE,
		gateEffect: CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT,
		health: 'PARTIAL' as const,
		id: resolutionId,
		inputDigest,
		manifestWitness: parsed.manifestWitness,
		method: CONDITIONAL_EXPORT_RESOLUTION_METHOD,
		nonclaims: CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS,
		operationVersion: CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
		projectContextGraph: inputs.request.projectContextGraph,
		resolutionAuthority: CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY,
		resultCompleteness: open
			? ('UNRESOLVED_SELECTED_CRITERION_WITH_EXPLICIT_FRONTIER' as const)
			: ('COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_CRITERION' as const),
		schemaVersion: CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION,
		selection: CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.frozenSubject.descriptor.subjectId,
		truncation: { reason: null, state: 'NOT_TRUNCATED' as const }
	};
	const graph = { ...content, contentDigest: '' } as ConditionalExportResolutionSnapshot;
	return {
		graph: { ...content, contentDigest: independentContentDigest(graph) },
		state: 'VALID'
	};
}

function scalarExportTargetIssue(text: string): ConditionalExportResolutionValidationIssue | null {
	return isUnicodeScalarString(text)
		? null
		: issue(
				'INPUT_INVALID',
				'Decoded export target strings must contain Unicode scalar text.',
				'$manifest.exports'
			);
}

/** Walks the selected exact-key condition subtree for numeric keys and non-scalar targets. */
function conditionSubtreeIssue(
	root: ts.ObjectLiteralExpression
): ConditionalExportResolutionValidationIssue | null {
	const pending: ts.ObjectLiteralExpression[] = [root];
	while (pending.length > 0) {
		const object = pending.pop()!;
		for (const property of object.properties) {
			const assignment = property as ts.PropertyAssignment;
			const name = propertyName(assignment)!;
			if (numericConditionKey(name))
				return issue(
					'INPUT_INVALID',
					'Selected exact-key condition names must not be canonical numeric property names.',
					'$manifest.exports'
				);
			if (
				ts.isStringLiteral(assignment.initializer) &&
				!isUnicodeScalarString(assignment.initializer.text)
			)
				return issue(
					'INPUT_INVALID',
					'Decoded export target strings must contain Unicode scalar text.',
					'$manifest.exports'
				);
			if (ts.isObjectLiteralExpression(assignment.initializer))
				pending.push(assignment.initializer);
		}
	}
	return null;
}

function manifestStructureIssue(
	parsed: ParsedManifest,
	request: ConditionalExportResolutionBuildInputs['request']
): ConditionalExportResolutionValidationIssue | null {
	const value = parsed.exportsProperty?.initializer;
	if (value === undefined) return null;
	if (ts.isStringLiteral(value)) return scalarExportTargetIssue(value.text);
	if (!ts.isObjectLiteralExpression(value)) return null;
	const keys = value.properties.map((property) => propertyName(property as ts.PropertyAssignment)!);
	if (keys.some((key) => key.startsWith('.')) && keys.some((key) => !key.startsWith('.')))
		return issue(
			'INPUT_INVALID',
			'The manifest exports object must not mix subpath and condition keys.',
			'$manifest.exports'
		);
	if (!keys.every((key) => key.startsWith('.'))) return null;
	const exactProperty = value.properties.find(
		(property) => propertyName(property as ts.PropertyAssignment) === request.exportSubpath
	) as ts.PropertyAssignment | undefined;
	if (exactProperty === undefined) return null;
	if (ts.isStringLiteral(exactProperty.initializer))
		return scalarExportTargetIssue(exactProperty.initializer.text);
	if (!ts.isObjectLiteralExpression(exactProperty.initializer)) return null;
	return conditionSubtreeIssue(exactProperty.initializer);
}

/** Ordered admission gate: candidate shell, input shell, closed request, and identity binding. */
function inputAdmissionIssue(
	value: unknown,
	inputsValue: unknown,
	limits: ClosedOptions
): ConditionalExportResolutionValidationIssue | null {
	const candidateTreeIssue = plainTreeIssue(
		value,
		{
			maxDepth: limits.maxDepth,
			maxRecords: limits.maxRecords,
			maxStringCharacters: limits.maxStringCharacters
		},
		'$'
	);
	if (candidateTreeIssue !== null) return candidateTreeIssue;
	if (!plainRecord(value) || !exactKeys(value, SNAPSHOT_KEYS))
		return issue(
			'SHAPE_INVALID',
			'The conditional-export resolution snapshot shell must be exact.'
		);
	const shellIssue = inputShellIssue(inputsValue);
	if (shellIssue !== null) return shellIssue;
	const broadInputIssue = plainTreeIssue(
		inputsValue,
		{
			maxDepth: limits.maxDepth,
			maxRecords: limits.maxInputRecords,
			maxStringCharacters: limits.maxInputStringCharacters
		},
		'$inputs',
		true
	);
	if (broadInputIssue !== null) return broadInputIssue;
	const inputs = inputsValue as ConditionalExportResolutionBuildInputs;
	const closedRequestIssue = requestIssue(inputs);
	if (closedRequestIssue !== null) return closedRequestIssue;
	const requestInputIssue = plainTreeIssue(
		inputsValue,
		{
			maxDepth: limits.maxDepth,
			maxRecords: Math.min(limits.maxInputRecords, inputs.request.budgets.maxInputRecords),
			maxStringCharacters: Math.min(
				limits.maxInputStringCharacters,
				inputs.request.budgets.maxInputStringCharacters
			)
		},
		'$inputs',
		true
	);
	if (requestInputIssue !== null) return requestInputIssue;
	return inputBindingIssue(inputs);
}

function validateInternal(
	value: unknown,
	inputsValue: unknown,
	options: ConditionalExportResolutionValidationOptions | undefined,
	knownInputDigest?: string,
	predecessorValidated = false
): ConditionalExportResolutionValidationResult {
	const limits = closeOptions(options);
	if (limits === null)
		return invalid(issue('SHAPE_INVALID', 'Validation options are invalid.', '$options'));
	const admissionIssue = inputAdmissionIssue(value, inputsValue, limits);
	if (admissionIssue !== null) return invalid(admissionIssue);
	const inputs = inputsValue as ConditionalExportResolutionBuildInputs;
	if (!predecessorValidated) {
		const predecessorIssue = projectContextValidationIssue(inputs, limits);
		if (predecessorIssue !== null) return invalid(predecessorIssue);
	}
	const bound = bindConsumerAndManifest(inputs);
	if (bound.state === 'INVALID') return invalid(bound.problem);
	const parsed = parseManifest(inputs, bound.binding);
	if (parsed.state === 'INVALID') return invalid(parsed.problem);
	const structureIssue = manifestStructureIssue(parsed.parsed, inputs.request);
	if (structureIssue !== null) return invalid(structureIssue);
	const expected = derive(inputs, bound.binding, parsed.parsed, knownInputDigest);
	if (expected.state === 'INVALID') return invalid(expected.problem);
	const candidate = value as unknown as ConditionalExportResolutionSnapshot;
	if (candidate.inputDigest !== expected.graph.inputDigest || candidate.id !== expected.graph.id)
		return invalid(
			issue(
				'IDENTITY_MISMATCH',
				'The candidate resolution identities do not reproduce from the exact inputs.'
			)
		);
	if (candidate.contentDigest !== independentContentDigest(candidate))
		return invalid(
			issue(
				'CONTENT_DIGEST_MISMATCH',
				'The conditional-export content digest is invalid.',
				'$.contentDigest'
			)
		);
	if (!canonicalEqual(candidate, expected.graph))
		return invalid(
			issue(
				'DERIVATION_MISMATCH',
				'The candidate differs from the independently derived conditional-export resolution.'
			)
		);
	return { issues: [], state: 'VALID' };
}

export function validateConditionalExportResolution(
	value: unknown,
	inputs: ConditionalExportResolutionBuildInputs,
	options?: ConditionalExportResolutionValidationOptions
): ConditionalExportResolutionValidationResult {
	if (arguments.length < 2 || arguments.length > 3)
		return invalid(
			issue('SHAPE_INVALID', 'The validator requires exactly two or three arguments.', '$arguments')
		);
	try {
		return validateInternal(value, inputs, options);
	} catch {
		return invalid(
			issue('SHAPE_INVALID', 'Conditional-export resolution validation failed closed.')
		);
	}
}

/**
 * Producer-internal path with a trusted precondition: the exact FrozenSubject,
 * StaticSemanticSnapshot, and ProjectContextGraph object graph must have passed
 * either public CAP-010 validation or the equivalent documented producer chain:
 * public semantic validation under limits no looser than the CAP-010 graph
 * request, followed by constructed CAP-010 validation. That evidence must be
 * established immediately before uninterrupted synchronous construction without
 * intervening mutation. The known digest must reproduce the compact input binding
 * but does not replace that trust precondition; callers without the exact
 * predecessor-validation evidence must use the public validator.
 */
export function validateConstructedConditionalExportResolution(
	value: unknown,
	inputs: ConditionalExportResolutionBuildInputs,
	knownInputDigest: string,
	options?: ConditionalExportResolutionValidationOptions
): ConditionalExportResolutionValidationResult {
	if (arguments.length < 3 || arguments.length > 4)
		return invalid(
			issue(
				'SHAPE_INVALID',
				'The constructed validator requires three or four arguments.',
				'$arguments'
			)
		);
	if (typeof knownInputDigest !== 'string' || !SHA256.test(knownInputDigest))
		return invalid(
			issue(
				'SHAPE_INVALID',
				'The known input digest must be lowercase SHA-256.',
				'$validationInput.inputDigest'
			)
		);
	try {
		return validateInternal(value, inputs, options, knownInputDigest, true);
	} catch {
		return invalid(
			issue('SHAPE_INVALID', 'Constructed conditional-export resolution validation failed closed.')
		);
	}
}
