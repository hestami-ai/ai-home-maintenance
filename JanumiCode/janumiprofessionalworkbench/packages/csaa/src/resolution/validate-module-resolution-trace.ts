import { createHash } from 'node:crypto';
import { posix } from 'node:path';

import ts from 'typescript';

import {
	MODULE_RESOLUTION_TRACE_AUTHORITY,
	MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER,
	MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE,
	MODULE_RESOLUTION_TRACE_CAPABILITY,
	MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS,
	MODULE_RESOLUTION_TRACE_CURRENTNESS,
	MODULE_RESOLUTION_TRACE_FRESHNESS,
	MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE,
	MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE,
	MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE,
	MODULE_RESOLUTION_TRACE_GATE_EFFECT,
	MODULE_RESOLUTION_TRACE_METHOD,
	MODULE_RESOLUTION_TRACE_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_SELECTION,
	type ModuleResolutionAttemptId,
	type ModuleResolutionAttemptPurpose,
	type ModuleResolutionAttemptRecord,
	type ModuleResolutionAttemptStage,
	type ModuleResolutionCandidateId,
	type ModuleResolutionCandidateRecord,
	type ModuleResolutionPresentReadFileObservation,
	type ModuleResolutionRelationId,
	type ModuleResolutionTargetWitness,
	type ModuleResolutionTraceBuildInputs,
	type ModuleResolutionTraceId,
	type ModuleResolutionTraceImporterWitness,
	type ModuleResolutionTraceSnapshot,
	type ModuleResolutionTraceValidationIssue,
	type ModuleResolutionTraceValidationOptions,
	type ModuleResolutionTraceValidationResult
} from '../contracts/module-resolution-trace.js';
import type { CompilerInputObservation } from '../contracts/semantic.js';
import {
	type CompilerInputQuery,
	type VerifiedCompilerProjectInputEntry,
	type VerifiedCompilerProjectInputLookup
} from '../providers/typescript/compiler-input-journal.js';
import {
	MATERIALIZED_ARRAY_PATH_OPTIONS,
	MATERIALIZED_SCALAR_PATH_OPTIONS,
	validateProgramRecipePolicy
} from '../semantic/program-recipe-policy.js';
import { isProxyValue, isUnicodeScalarString } from '../semantic/canonical.js';
import { getStaticSemanticSnapshotCompilerProjectInputLookup } from '../semantic/compiler-capture-capability.js';
import { validateConditionalExportResolution } from './validate-conditional-export-resolution.js';

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
const INPUT_KEYS = [
	'conditionalExportRequest',
	'conditionalExportResolution',
	'frozenSubject',
	'projectContextGraph',
	'request',
	'semanticSnapshot'
] as const;
const REQUEST_KEYS = [
	'budgets',
	'conditionalExportResolution',
	'importer',
	'operationVersion',
	'packageName',
	'projectContextGraph',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'specifier',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxAstNodes',
	'maxAttempts',
	'maxCandidates',
	'maxDiagnostics',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxOutputRecords',
	'maxReadBytes',
	'maxTraversalSteps'
] as const;
const IMPORTER_KEYS = [
	'projectContextProgramId',
	'projectContextSourceId',
	'semanticModuleResolutionId',
	'semanticProgramId',
	'semanticSourceId',
	'specifierNodeId'
] as const;
const GRAPH_REFERENCE_KEYS = ['contentDigest', 'graphId', 'inputDigest'] as const;
const CONDITIONAL_REFERENCE_KEYS = ['contentDigest', 'id', 'inputDigest'] as const;
const SELECTION_KEYS = [
	'acceptedOutcome',
	'candidateDerivation',
	'compilerApi',
	'conditionalExportExplicitConditions',
	'conditionalExportModuleMode',
	'conditionalExportPlatform',
	'conditionOrderAuthority',
	'importerPopulation',
	'impliedNodeFormatApi',
	'moduleModeApi',
	'packagePopulation',
	'resolutionHost',
	'specifierSyntax',
	'targetEvidence',
	'unsupportedTreatment'
] as const;
const SNAPSHOT_KEYS = [
	'attempts',
	'authorityTransfer',
	'budgets',
	'candidates',
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'captureWitness',
	'closure',
	'conditionalExportResolution',
	'contentDigest',
	'coverage',
	'currentness',
	'freshness',
	'fullJanCsaa007Conformance',
	'fullJanCsaa008Conformance',
	'fullJanCsaa011Conformance',
	'gateEffect',
	'health',
	'id',
	'importerWitness',
	'inputDigest',
	'method',
	'nonclaims',
	'operationVersion',
	'projectContextGraph',
	'relation',
	'resolutionAuthority',
	'resolverEnvironment',
	'resultCompleteness',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'semanticValidationWitness',
	'subjectId',
	'targetWitness',
	'truncation'
] as const;

function issue(
	code: ModuleResolutionTraceValidationIssue['code'],
	message: string,
	path = '$'
): ModuleResolutionTraceValidationIssue {
	return { code, message, path };
}

function invalid(
	problem: ModuleResolutionTraceValidationIssue
): ModuleResolutionTraceValidationResult {
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

function closeOptions(
	value: ModuleResolutionTraceValidationOptions | undefined
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
	readonly limits: Pick<ClosedOptions, 'maxDepth' | 'maxRecords' | 'maxStringCharacters'>;
	readonly malformedCode: ModuleResolutionTraceValidationIssue['code'];
	readonly pending: PlainTreeFrame[];
	characters: number;
	records: number;
}

function plainDataNumber(value: unknown): boolean {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		(!Number.isInteger(value) || Number.isSafeInteger(value)) &&
		!Object.is(value, -0)
	);
}

function invalidDenseArrayKey(key: string, arrayLength: number): boolean {
	if (key === 'length') return false;
	if (!/^(0|[1-9]\d*)$/u.test(key)) return true;
	const index = Number(key);
	return !Number.isSafeInteger(index) || index >= arrayLength || String(index) !== key;
}

function plainTreeStringIssue(
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame,
	text: string
): ModuleResolutionTraceValidationIssue | null {
	if (!isUnicodeScalarString(text))
		return issue(walk.malformedCode, 'Strings must contain Unicode scalar text.', frame.path);
	walk.characters += text.length;
	if (walk.characters > walk.limits.maxStringCharacters)
		return issue(
			'BUDGET_EXHAUSTED',
			'The descriptor string-character budget was exhausted.',
			frame.path
		);
	return null;
}

function plainTreePrototypeIssue(
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame,
	container: object,
	array: boolean
): ModuleResolutionTraceValidationIssue | null {
	const prototype = Reflect.getPrototypeOf(container);
	if (
		(array && prototype !== Array.prototype) ||
		(!array && prototype !== Object.prototype && prototype !== null)
	)
		return issue(walk.malformedCode, 'Containers must have ordinary prototypes.', frame.path);
	return null;
}

function plainTreeKeyCharacterIssue(
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame,
	stringKeys: readonly string[],
	array: boolean
): ModuleResolutionTraceValidationIssue | null {
	for (const key of stringKeys) {
		if (array && key === 'length') continue;
		walk.characters += key.length;
		if (walk.characters > walk.limits.maxStringCharacters)
			return issue(
				'BUDGET_EXHAUSTED',
				'The descriptor string-character budget was exhausted by a property key.',
				frame.path
			);
		if (!isUnicodeScalarString(key))
			return issue(
				walk.malformedCode,
				'Property keys must contain Unicode scalar text.',
				frame.path
			);
	}
	return null;
}

function plainTreeArrayShapeIssue(
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame,
	container: object,
	keyCount: number,
	stringKeys: readonly string[]
): ModuleResolutionTraceValidationIssue | null {
	const arrayLength = Reflect.getOwnPropertyDescriptor(container, 'length')!.value as number;
	if (arrayLength > walk.limits.maxRecords - walk.records)
		return issue(
			'BUDGET_EXHAUSTED',
			'The descriptor record budget was exhausted by an array population.',
			frame.path
		);
	if (keyCount !== arrayLength + 1)
		return issue(walk.malformedCode, 'Arrays must be dense ordinary arrays.', frame.path);
	if (stringKeys.some((key) => invalidDenseArrayKey(key, arrayLength)))
		return issue(walk.malformedCode, 'Arrays must be dense without extra properties.', frame.path);
	return null;
}

function plainTreePropertyPopulationIssue(
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame,
	keyCount: number
): ModuleResolutionTraceValidationIssue | null {
	if (keyCount > walk.limits.maxRecords - walk.records)
		return issue(
			'BUDGET_EXHAUSTED',
			'The descriptor record budget was exhausted by a property population.',
			frame.path
		);
	return null;
}

function plainTreeChildIssue(
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame,
	container: object,
	stringKeys: readonly string[],
	array: boolean
): ModuleResolutionTraceValidationIssue | null {
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

function plainTreeContainerIssue(
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame,
	container: object
): ModuleResolutionTraceValidationIssue | null {
	const array = Array.isArray(container);
	const prototypeProblem = plainTreePrototypeIssue(walk, frame, container, array);
	if (prototypeProblem !== null) return prototypeProblem;
	const keys = Reflect.ownKeys(container);
	if (keys.some((key) => typeof key !== 'string'))
		return issue(walk.malformedCode, 'Symbol keys are not accepted.', frame.path);
	const stringKeys = keys as string[];
	const keyProblem = plainTreeKeyCharacterIssue(walk, frame, stringKeys, array);
	if (keyProblem !== null) return keyProblem;
	const populationProblem = array
		? plainTreeArrayShapeIssue(walk, frame, container, keys.length, stringKeys)
		: plainTreePropertyPopulationIssue(walk, frame, keys.length);
	if (populationProblem !== null) return populationProblem;
	walk.active.add(container);
	walk.pending.push({ state: 'LEAVE', value: container });
	return plainTreeChildIssue(walk, frame, container, stringKeys, array);
}

function plainTreeVisitIssue(
	walk: PlainTreeWalk,
	frame: PlainTreeVisitFrame
): ModuleResolutionTraceValidationIssue | null {
	walk.records += 1;
	if (walk.records > walk.limits.maxRecords)
		return issue('BUDGET_EXHAUSTED', 'The descriptor record budget was exhausted.', frame.path);
	if (frame.depth > walk.limits.maxDepth)
		return issue('BUDGET_EXHAUSTED', 'The descriptor depth budget was exhausted.', frame.path);
	if (typeof frame.value === 'string') return plainTreeStringIssue(walk, frame, frame.value);
	if (frame.value === null || typeof frame.value === 'boolean' || plainDataNumber(frame.value))
		return null;
	if (typeof frame.value !== 'object')
		return issue(walk.malformedCode, 'Only JSON-compatible data values are accepted.', frame.path);
	if (isProxyValue(frame.value))
		return issue(walk.malformedCode, 'Proxy values are not accepted.', frame.path);
	if (walk.active.has(frame.value))
		return issue(walk.malformedCode, 'Cyclic data is not accepted.', frame.path);
	return plainTreeContainerIssue(walk, frame, frame.value);
}

/** Descriptor-only traversal: accessors, iterators, callbacks, and toJSON are never invoked. */
function plainTreeIssue(
	value: unknown,
	limits: Pick<ClosedOptions, 'maxDepth' | 'maxRecords' | 'maxStringCharacters'>,
	rootPath: string,
	input = false
): ModuleResolutionTraceValidationIssue | null {
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
		const problem = plainTreeVisitIssue(walk, frame);
		if (problem !== null) return problem;
	}
	return null;
}

type CanonicalFrame =
	| {
			readonly index: number;
			readonly length: number;
			readonly state: 'ARRAY';
			readonly value: unknown[];
	  }
	| {
			readonly entries: readonly (readonly [string, unknown])[];
			readonly index: number;
			readonly state: 'OBJECT';
	  }
	| { readonly state: 'VALUE'; readonly value: unknown };

function canonicalClosingToken(frame: CanonicalFrame): ']' | '}' | null {
	if (frame.state === 'ARRAY') return frame.index === frame.length ? ']' : null;
	if (frame.state === 'OBJECT') return frame.index === frame.entries.length ? '}' : null;
	return null;
}

function canonicalSeparatorNeeded(frame: CanonicalFrame): boolean {
	return frame.state !== 'VALUE' && frame.index !== 0;
}

function canonicalScalarToken(value: unknown): string | null {
	if (value === null) return 'null';
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	if (typeof value === 'number') return JSON.stringify(value);
	return null;
}

/** Validator-private canonical token stream over values already accepted by plainTreeIssue. */
function* canonicalChunks(value: unknown): Generator<string, void, undefined> {
	const pending: CanonicalFrame[] = [{ state: 'VALUE', value }];
	while (pending.length > 0) {
		const frame = pending.pop()!;
		const closing = canonicalClosingToken(frame);
		if (closing !== null) {
			yield closing;
			continue;
		}
		if (canonicalSeparatorNeeded(frame)) yield ',';
		if (frame.state === 'ARRAY') {
			pending.push(
				{ ...frame, index: frame.index + 1 },
				{
					state: 'VALUE',
					value: Reflect.getOwnPropertyDescriptor(frame.value, String(frame.index))!.value
				}
			);
			continue;
		}
		if (frame.state === 'OBJECT') {
			const [key, child] = frame.entries[frame.index]!;
			yield JSON.stringify(key);
			yield ':';
			pending.push({ ...frame, index: frame.index + 1 }, { state: 'VALUE', value: child });
			continue;
		}
		const input = frame.value;
		const scalar = canonicalScalarToken(input);
		if (scalar !== null) {
			yield scalar;
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

function canonicalText(value: unknown): string {
	return [...canonicalChunks(value)].join('');
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

function domainDigest(domain: string, preimage: unknown): string {
	const hash = createHash('sha256');
	hash.update(domain, 'utf8');
	hash.update('\0', 'utf8');
	hash.update('1', 'utf8');
	hash.update('\0', 'utf8');
	writeCanonical(preimage, (chunk) => hash.update(chunk, 'utf8'));
	return hash.digest('hex');
}

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${domainDigest(domain, preimage)}` as Kind;
}

function inputShellIssue(value: unknown): ModuleResolutionTraceValidationIssue | null {
	if (!plainRecord(value) || !exactKeys(value, INPUT_KEYS))
		return issue(
			'INPUT_INVALID',
			'The module-resolution trace input wrapper must be exact plain data.',
			'$inputs'
		);
	for (const key of INPUT_KEYS) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key)!;
		if (!plainRecord(descriptor.value))
			return issue('INPUT_INVALID', `${key} must be a plain data record.`, `$inputs.${key}`);
	}
	return null;
}

function barePackageName(value: string): boolean {
	return /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(value);
}

function requestIssue(
	inputs: ModuleResolutionTraceBuildInputs
): ModuleResolutionTraceValidationIssue | null {
	const { request } = inputs;
	if (
		!plainRecord(request) ||
		!exactKeys(request, REQUEST_KEYS) ||
		!plainRecord(request.budgets) ||
		!exactKeys(request.budgets, BUDGET_KEYS) ||
		!plainRecord(request.importer) ||
		!exactKeys(request.importer, IMPORTER_KEYS) ||
		!plainRecord(request.projectContextGraph) ||
		!exactKeys(request.projectContextGraph, GRAPH_REFERENCE_KEYS) ||
		!plainRecord(request.conditionalExportResolution) ||
		!exactKeys(request.conditionalExportResolution, CONDITIONAL_REFERENCE_KEYS) ||
		!plainRecord(request.selection) ||
		!exactKeys(request.selection, SELECTION_KEYS)
	)
		return issue(
			'INPUT_INVALID',
			'The module-resolution trace request shell is not exact.',
			'$inputs.request'
		);
	if (
		BUDGET_KEYS.some((key) => !safePositive(request.budgets[key])) ||
		request.budgets.maxDiagnostics > 100_000 ||
		request.schemaVersion !== MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION ||
		request.operationVersion !== MODULE_RESOLUTION_TRACE_OPERATION_VERSION ||
		!canonicalEqual(request.selection, MODULE_RESOLUTION_TRACE_SELECTION)
	)
		return issue('INPUT_INVALID', 'Request constants or budgets are invalid.', '$inputs.request');
	if (
		typeof request.packageName !== 'string' ||
		!barePackageName(request.packageName) ||
		typeof request.specifier !== 'string' ||
		request.specifier !== request.packageName ||
		!barePackageName(request.specifier)
	)
		return issue(
			'INPUT_INVALID',
			'The request must select one bare workspace-package root specifier.',
			'$inputs.request.specifier'
		);
	if (
		IMPORTER_KEYS.some((key) => {
			const value = request.importer[key];
			return typeof value !== 'string' || value.length === 0;
		}) ||
		typeof request.subjectId !== 'string' ||
		!SHA256.test(request.subjectId) ||
		typeof request.semanticSnapshotId !== 'string' ||
		request.semanticSnapshotId.length === 0 ||
		typeof request.projectContextGraph.graphId !== 'string' ||
		request.projectContextGraph.graphId.length === 0 ||
		typeof request.conditionalExportResolution.id !== 'string' ||
		request.conditionalExportResolution.id.length === 0 ||
		!SHA256.test(request.projectContextGraph.contentDigest) ||
		!SHA256.test(request.projectContextGraph.inputDigest) ||
		!SHA256.test(request.conditionalExportResolution.contentDigest) ||
		!SHA256.test(request.conditionalExportResolution.inputDigest)
	)
		return issue('INPUT_INVALID', 'Request identities are invalid.', '$inputs.request');
	return null;
}

function inputBindingIssue(
	inputs: ModuleResolutionTraceBuildInputs
): ModuleResolutionTraceValidationIssue | null {
	const {
		conditionalExportRequest,
		conditionalExportResolution,
		frozenSubject,
		projectContextGraph,
		request,
		semanticSnapshot
	} = inputs;
	if (
		request.subjectId !== frozenSubject.descriptor.subjectId ||
		request.subjectId !== semanticSnapshot.subjectId ||
		request.subjectId !== projectContextGraph.subjectId ||
		request.subjectId !== conditionalExportRequest.subjectId ||
		request.subjectId !== conditionalExportResolution.subjectId ||
		request.semanticSnapshotId !== semanticSnapshot.id ||
		request.semanticSnapshotId !== projectContextGraph.semanticSnapshotId ||
		request.semanticSnapshotId !== conditionalExportRequest.semanticSnapshotId ||
		request.semanticSnapshotId !== conditionalExportResolution.semanticSnapshotId ||
		request.projectContextGraph.graphId !== projectContextGraph.id ||
		request.projectContextGraph.contentDigest !== projectContextGraph.contentDigest ||
		request.projectContextGraph.inputDigest !== projectContextGraph.inputDigest ||
		request.conditionalExportResolution.id !== conditionalExportResolution.id ||
		request.conditionalExportResolution.contentDigest !==
			conditionalExportResolution.contentDigest ||
		request.conditionalExportResolution.inputDigest !== conditionalExportResolution.inputDigest ||
		conditionalExportRequest.projectContextGraph.graphId !== projectContextGraph.id ||
		conditionalExportRequest.projectContextGraph.contentDigest !==
			projectContextGraph.contentDigest ||
		conditionalExportRequest.projectContextGraph.inputDigest !== projectContextGraph.inputDigest
	)
		return issue('IDENTITY_MISMATCH', 'Input identities do not bind exactly.', '$inputs.request');
	if (
		conditionalExportRequest.packageName !== request.packageName ||
		conditionalExportRequest.exportSubpath !== '.' ||
		conditionalExportRequest.moduleMode !== 'IMPORT' ||
		conditionalExportRequest.platform !== 'NODE' ||
		conditionalExportRequest.conditions.length !== 1 ||
		conditionalExportRequest.conditions[0] !== 'types' ||
		conditionalExportRequest.consumer.projectContextProgramId !==
			request.importer.projectContextProgramId ||
		conditionalExportRequest.consumer.projectContextSourceId !==
			request.importer.projectContextSourceId ||
		conditionalExportRequest.consumer.semanticProgramId !== request.importer.semanticProgramId ||
		conditionalExportRequest.consumer.semanticSourceId !== request.importer.semanticSourceId ||
		conditionalExportResolution.decision.state !== 'SELECTED_TARGET' ||
		typeof conditionalExportResolution.decision.target !== 'string'
	)
		return issue(
			'INPUT_INVALID',
			'The trace requires the exact supported CAP-012 types/NODE/IMPORT root decision.',
			'$inputs.conditionalExportRequest'
		);
	return null;
}

function predecessorIssue(
	inputs: ModuleResolutionTraceBuildInputs,
	limits: ClosedOptions
): ModuleResolutionTraceValidationIssue | null {
	const validation = validateConditionalExportResolution(
		inputs.conditionalExportResolution,
		{
			frozenSubject: inputs.frozenSubject,
			projectContextGraph: inputs.projectContextGraph,
			request: inputs.conditionalExportRequest,
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
		'The conditional-export predecessor is not independently valid for the exact request.',
		'$inputs.conditionalExportResolution'
	);
}

class DerivationFailure extends Error {
	constructor(readonly problem: ModuleResolutionTraceValidationIssue) {
		super(problem.message);
		this.name = 'DerivationFailure';
	}
}

function failDerivation(
	code: ModuleResolutionTraceValidationIssue['code'],
	message: string,
	path = '$inputs'
): never {
	throw new DerivationFailure(issue(code, message, path));
}

function rawSha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function decodeCompilerText(bytes: Uint8Array): string {
	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
		const body = bytes.subarray(2);
		if (body.byteLength % 2 !== 0)
			failDerivation('INPUT_INVALID', 'UTF-16LE compiler input contains an incomplete code unit.');
		return new TextDecoder('utf-16le', { fatal: true }).decode(body);
	}
	if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
		const body = bytes.subarray(2);
		if (body.byteLength % 2 !== 0)
			failDerivation('INPUT_INVALID', 'UTF-16BE compiler input contains an incomplete code unit.');
		const swapped = body.slice();
		for (let index = 0; index < swapped.length; index += 2)
			[swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!];
		return new TextDecoder('utf-16le', { fatal: true }).decode(swapped);
	}
	const start =
		bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start));
}

function cloneWire<T>(value: T): T {
	return structuredClone(value);
}

interface MaterializedRecipe {
	readonly compilerOptions: ts.CompilerOptions;
	readonly configFilePath: string;
	readonly projectReferences: readonly ts.ProjectReference[];
	readonly rootNames: readonly string[];
}

function materializeRecordedRecipe(
	recipeValue: ModuleResolutionTraceBuildInputs['semanticSnapshot']['projects'][number]['programRecipe'],
	lookup: VerifiedCompilerProjectInputLookup,
	maxPathCharacters: number
): MaterializedRecipe {
	const recipe = validateProgramRecipePolicy(recipeValue, maxPathCharacters);
	const compilerOptions: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(recipe.compilerOptions)) {
		if (MATERIALIZED_SCALAR_PATH_OPTIONS.has(key)) {
			compilerOptions[key] = lookup.toRecordedAbsolute(value as string);
			continue;
		}
		if (MATERIALIZED_ARRAY_PATH_OPTIONS.has(key)) {
			compilerOptions[key] = (value as readonly string[]).map((entry) =>
				lookup.toRecordedAbsolute(entry)
			);
			continue;
		}
		compilerOptions[key] = cloneWire(value);
	}
	if (
		recipe.compilerOptions.paths !== undefined &&
		recipe.compilerOptions.baseUrl === undefined &&
		recipe.compilerOptions.pathsBasePath === undefined
	) {
		compilerOptions.pathsBasePath = lookup.toRecordedAbsolute(posix.dirname(recipe.configPath));
	}
	return {
		compilerOptions: compilerOptions as ts.CompilerOptions,
		configFilePath: lookup.toRecordedAbsolute(recipe.configPath),
		projectReferences: recipe.projectReferences.map((path) => ({
			path: lookup.toRecordedAbsolute(path)
		})),
		rootNames: recipe.rootNames.map((path) => lookup.toRecordedAbsolute(path))
	};
}

type PresentReadEntry = VerifiedCompilerProjectInputEntry & {
	readonly bytes: Uint8Array;
	readonly observation: ModuleResolutionPresentReadFileObservation;
	readonly query: Extract<CompilerInputQuery, { readonly operation: 'READ_FILE' }>;
};

function presentRead(
	entry: VerifiedCompilerProjectInputEntry | undefined,
	logicalPath: string,
	path: string
): PresentReadEntry {
	if (
		entry?.query.operation !== 'READ_FILE' ||
		entry.query.logicalPath !== logicalPath ||
		entry.observation.operation !== 'READ_FILE' ||
		entry.observation.result !== 'PRESENT' ||
		// S6582 REFUSED: the explicit `=== undefined` limb is what keeps rawSha256 off a missing buffer.
		entry.bytes === undefined ||
		entry.bytes.byteLength !== entry.observation.contentBytes ||
		rawSha256(entry.bytes) !== entry.observation.contentSha256
	)
		failDerivation(
			'INPUT_INVALID',
			'The exact project-attributed compiler input bytes are unavailable or inconsistent.',
			path
		);
	return entry as PresentReadEntry;
}

interface StaticBinding {
	readonly captureWitness: ModuleResolutionTraceSnapshot['captureWitness'];
	readonly configPath: string;
	readonly importerAbsolutePath: string;
	readonly importerBytes: Uint8Array;
	readonly importerNodeRecord: ModuleResolutionTraceBuildInputs['semanticSnapshot']['astNodes'][number];
	readonly importerScriptKind: number;
	readonly importerText: string;
	readonly importerWitnessBase: Omit<
		ModuleResolutionTraceImporterWitness,
		'end' | 'literalValueSha256' | 'start'
	>;
	readonly literalRecord: ModuleResolutionTraceBuildInputs['semanticSnapshot']['literals'][number];
	readonly lookup: VerifiedCompilerProjectInputLookup;
	readonly materialized: MaterializedRecipe;
	readonly semanticModuleResolution: ModuleResolutionTraceBuildInputs['semanticSnapshot']['moduleResolutions'][number];
	readonly targetSource: ModuleResolutionTraceBuildInputs['semanticSnapshot']['sources'][number];
	readonly workspace: ModuleResolutionTraceBuildInputs['frozenSubject']['workspaces'][number];
}

function bindStaticInputs(inputs: ModuleResolutionTraceBuildInputs): StaticBinding {
	const {
		conditionalExportResolution,
		frozenSubject,
		projectContextGraph,
		request,
		semanticSnapshot
	} = inputs;
	const semanticModuleResolutions = semanticSnapshot.moduleResolutions.filter(
		(record) => record.id === request.importer.semanticModuleResolutionId
	);
	const semanticSources = semanticSnapshot.sources.filter(
		(record) => record.id === request.importer.semanticSourceId
	);
	const semanticPrograms = semanticSnapshot.programs.filter(
		(record) => record.id === request.importer.semanticProgramId
	);
	const importerNodes = semanticSnapshot.astNodes.filter(
		(record) => record.id === request.importer.specifierNodeId
	);
	if (
		semanticModuleResolutions.length !== 1 ||
		semanticSources.length !== 1 ||
		semanticPrograms.length !== 1 ||
		importerNodes.length !== 1
	)
		failDerivation(
			'INPUT_INVALID',
			'The importer criterion must bind one exact semantic resolution, source, Program, and node.',
			'$inputs.request.importer'
		);
	const semanticModuleResolution = semanticModuleResolutions[0]!;
	const importerSource = semanticSources[0]!;
	const semanticProgram = semanticPrograms[0]!;
	const importerNode = importerNodes[0]!;
	const semanticProject = semanticSnapshot.projects.filter(
		(record) => record.id === importerSource.projectId
	)[0]!;
	const contextSource = projectContextGraph.sources.filter(
		(record) => record.id === request.importer.projectContextSourceId
	)[0]!;
	const contextProgram = projectContextGraph.programs.filter(
		(record) => record.id === request.importer.projectContextProgramId
	)[0]!;
	const contextProject = projectContextGraph.projects.filter(
		(record) => record.id === contextSource.projectId
	)[0]!;
	if (
		semanticModuleResolution.nodeId !== request.importer.specifierNodeId ||
		semanticModuleResolution.sourceId !== importerSource.id ||
		semanticModuleResolution.occurrenceKind !== 'IMPORT' ||
		semanticModuleResolution.specifierState !== 'LITERAL' ||
		semanticModuleResolution.specifier !== request.specifier ||
		semanticModuleResolution.typeOnly !== false ||
		semanticModuleResolution.resolutionState !== 'RESOLVED_SOURCE' ||
		semanticModuleResolution.targetSourceId === null ||
		importerNode.sourceId !== importerSource.id ||
		importerNode.kind !== ts.SyntaxKind.StringLiteral ||
		importerSource.programId !== semanticProgram.id ||
		semanticProgram.projectId !== semanticProject.id ||
		semanticProject.programId !== semanticProgram.id ||
		contextSource.semanticSourceId !== importerSource.id ||
		contextSource.semanticProgramId !== semanticProgram.id ||
		contextSource.programId !== contextProgram.id ||
		contextProgram.semanticProgramId !== semanticProgram.id ||
		contextProgram.projectId !== contextProject.id ||
		contextProject.semanticProjectId !== semanticProject.id ||
		contextProject.semanticProgramId !== semanticProgram.id ||
		contextProject.programId !== contextProgram.id ||
		contextProject.configPath !== semanticProject.configPath ||
		contextSource.logicalPath !== importerSource.logicalPath ||
		contextSource.declarationFile !== importerSource.declarationFile ||
		contextSource.origin !== importerSource.origin
	)
		failDerivation(
			'INPUT_INVALID',
			'The selected importer semantic and project-context identities do not reconcile.',
			'$inputs.request.importer'
		);
	const literalRecord = semanticSnapshot.literals.filter(
		(record) => record.nodeId === importerNode.id && record.sourceId === importerSource.id
	)[0]!;
	const sameOccurrences = semanticSnapshot.moduleResolutions.filter(
		(record) =>
			record.sourceId === importerSource.id &&
			record.occurrenceKind === 'IMPORT' &&
			record.specifierState === 'LITERAL' &&
			record.specifier === request.specifier &&
			record.typeOnly === false
	);
	if (sameOccurrences.length !== 1)
		failDerivation(
			'INPUT_INVALID',
			'The selected importer must contain one exact supported import occurrence.',
			'$inputs.semanticSnapshot.moduleResolutions'
		);
	const targetSource = semanticSnapshot.sources.filter(
		(record) => record.id === semanticModuleResolution.targetSourceId
	)[0]!;
	if (
		targetSource.artifactClass !== 'CONTEXT_ONLY' ||
		targetSource.origin !== 'WORKSPACE_BUILD_DECLARATION' ||
		!targetSource.declarationFile ||
		!(
			targetSource.logicalPath.endsWith('.d.ts') ||
			targetSource.logicalPath.endsWith('.d.mts') ||
			targetSource.logicalPath.endsWith('.d.cts')
		)
	)
		failDerivation(
			'INPUT_INVALID',
			'The semantic target must be one workspace build declaration.',
			'$inputs.semanticSnapshot.sources'
		);
	const workspace = frozenSubject.workspaces.filter(
		(candidate) => candidate.name === request.packageName
	)[0]!;
	const packageExportTarget = conditionalExportResolution.decision.target as string;
	const expectedTargetPath =
		workspace.path === '.'
			? packageExportTarget.slice(2)
			: `${workspace.path}/${packageExportTarget.slice(2)}`;
	if (expectedTargetPath !== targetSource.logicalPath)
		failDerivation(
			'INPUT_INVALID',
			'The CAP-012 selected export target does not bind the resolved semantic build output.',
			'$inputs.conditionalExportResolution.decision.target'
		);
	const lookup = getStaticSemanticSnapshotCompilerProjectInputLookup(
		semanticSnapshot,
		semanticProject.configPath
	);
	if (lookup?.subjectId !== request.subjectId)
		failDerivation(
			'INPUT_INVALID',
			'The exact semantic snapshot does not retain its verified project-scoped compiler capture.',
			'$inputs.semanticSnapshot'
		);
	const materialized = materializeRecordedRecipe(
		semanticProject.programRecipe,
		lookup,
		request.budgets.maxInputStringCharacters
	);
	if (
		canonicalSha256(materialized) !== lookup.attribution.materializedRecipeDigest ||
		lookup.attribution.projectResolutionDigest !==
			semanticProject.programRecipe.projectResolutionDigest ||
		!canonicalEqual(semanticProject.programRecipe, contextProject.programRecipe)
	)
		failDerivation(
			'INPUT_INVALID',
			'The materialized Program recipe does not reproduce the verified capture attribution.',
			'$inputs.semanticSnapshot.projects'
		);
	const importerRead = presentRead(
		lookup.lookupAttributedQuery({
			logicalPath: importerSource.logicalPath,
			operation: 'READ_FILE'
		}),
		importerSource.logicalPath,
		'$inputs.semanticSnapshot.sources'
	);
	if (
		importerRead.observation.contentBytes !== importerSource.bytes ||
		importerRead.observation.contentSha256 !== importerSource.contentSha256 ||
		importerRead.observation.origin !== importerSource.origin
	)
		failDerivation(
			'INPUT_INVALID',
			'The captured importer bytes do not reproduce the selected semantic source.',
			'$inputs.semanticSnapshot.sources'
		);
	const importerText = decodeCompilerText(importerRead.bytes);
	if (importerText.length !== importerSource.textLength)
		failDerivation(
			'INPUT_INVALID',
			'The decoded importer text length does not reproduce the semantic source.',
			'$inputs.semanticSnapshot.sources'
		);
	return {
		captureWitness: {
			contextDigest: semanticSnapshot.contextDigest,
			inputRecordIds: cloneWire(lookup.attribution.contextInputIds),
			materializedRecipeDigest: lookup.attribution.materializedRecipeDigest,
			projectResolutionDigest: lookup.attribution.projectResolutionDigest,
			state: 'VERIFIED_PROJECT_SCOPED_CAPTURE'
		},
		configPath: semanticProject.configPath,
		importerAbsolutePath: lookup.toRecordedAbsolute(importerSource.logicalPath),
		importerBytes: importerRead.bytes.slice(),
		importerNodeRecord: importerNode,
		importerScriptKind: importerSource.scriptKind,
		importerText,
		importerWitnessBase: {
			artifactClass: importerSource.artifactClass,
			bytes: importerSource.bytes,
			contentSha256: importerSource.contentSha256,
			declarationFile: importerSource.declarationFile,
			logicalPath: importerSource.logicalPath,
			occurrenceKind: 'IMPORT',
			origin: importerSource.origin,
			projectContextProgramId: contextProgram.id,
			projectContextProjectId: contextProject.id,
			projectContextSourceId: contextSource.id,
			semanticModuleResolutionId: semanticModuleResolution.id,
			semanticProgramId: semanticProgram.id,
			semanticProjectId: semanticProject.id,
			semanticSourceId: importerSource.id,
			specifier: request.specifier,
			specifierNodeId: importerNode.id,
			typeOnly: false
		},
		literalRecord,
		lookup,
		materialized,
		semanticModuleResolution,
		targetSource,
		workspace
	};
}

type AttemptSeed = Omit<ModuleResolutionAttemptRecord, 'id'>;

function attemptPurpose(query: CompilerInputQuery): ModuleResolutionAttemptPurpose {
	if (query.operation === 'CURRENT_DIRECTORY') return 'CURRENT_DIRECTORY';
	if (query.operation === 'USE_CASE_SENSITIVE_FILE_NAMES') return 'CASE_SENSITIVITY';
	if (
		query.operation === 'DIRECTORY_EXISTS' ||
		query.operation === 'GET_DIRECTORIES' ||
		query.operation === 'READ_DIRECTORY'
	)
		return 'DIRECTORY_PROBE';
	if (query.operation === 'REALPATH') return 'REALPATH';
	if (
		(query.operation === 'READ_FILE' || query.operation === 'FILE_EXISTS') &&
		posix.basename(query.logicalPath) === 'package.json'
	)
		return 'PACKAGE_METADATA';
	if (query.operation === 'FILE_EXISTS') return 'MODULE_TARGET_CANDIDATE';
	return 'RESOLVER_INPUT';
}

function cloneObservation(observation: CompilerInputObservation): CompilerInputObservation {
	return cloneWire(observation);
}

function packageJsonType(text: string, logicalPath: string): 'module' | null {
	const source = ts.parseJsonText(logicalPath, text);
	if (source.statements.length !== 1) return null;
	const statement = source.statements[0];
	if (statement === undefined || !ts.isExpressionStatement(statement)) return null;
	const root = statement.expression;
	if (!ts.isObjectLiteralExpression(root)) return null;
	let found = false;
	for (const property of root.properties) {
		if (!ts.isPropertyAssignment(property)) continue;
		const name = property.name;
		const decoded =
			ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isIdentifier(name)
				? name.text
				: null;
		if (decoded !== 'type') continue;
		if (
			found ||
			!ts.isStringLiteral(property.initializer) ||
			property.initializer.text !== 'module'
		)
			return null;
		found = true;
	}
	return found ? 'module' : null;
}

interface ReplayState {
	readonly attempts: AttemptSeed[];
	readonly caseSensitivityValues: boolean[];
	readonly impliedPackageTypes: ('module' | null)[];
	readonly lookup: VerifiedCompilerProjectInputLookup;
	readonly occurrenceCounts: Map<string, number>;
	astNodes: number;
	candidates: number;
	readBytes: number;
	stage: ModuleResolutionAttemptStage;
}

function createCaptureOnlyResolutionHost(
	inputs: ModuleResolutionTraceBuildInputs,
	binding: StaticBinding,
	state: ReplayState
): ts.ModuleResolutionHost {
	const contextIds = new Set(binding.lookup.attribution.contextInputIds);
	const record = (query: CompilerInputQuery): VerifiedCompilerProjectInputEntry => {
		const { budgets } = inputs.request;
		if (state.attempts.length >= budgets.maxAttempts)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'The module-resolution attempt budget was exhausted.',
				'$inputs.request.budgets.maxAttempts'
			);
		const candidateIncrement =
			state.stage === 'MODULE_RESOLUTION' && query.operation === 'FILE_EXISTS' ? 1 : 0;
		const nextCandidates = state.candidates + candidateIncrement;
		const nextAttempts = state.attempts.length + 1;
		if (
			!Number.isSafeInteger(nextCandidates) ||
			!Number.isSafeInteger(nextAttempts) ||
			nextCandidates > budgets.maxCandidates ||
			1 + nextAttempts + nextCandidates > budgets.maxOutputRecords ||
			nextAttempts + nextCandidates + state.astNodes > budgets.maxTraversalSteps ||
			nextAttempts + 1 > budgets.maxInputRecords
		)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'A module-resolution record or traversal budget was exhausted before a host callback.',
				'$inputs.request.budgets'
			);
		const entry = binding.lookup.lookupAttributedQuery(query);
		if (
			entry === undefined ||
			!canonicalEqual(entry.query, query) ||
			entry.observation.operation !== query.operation ||
			entry.observation.logicalPath !== query.logicalPath ||
			!contextIds.has(entry.observation.id) ||
			!safePositive(entry.attributedInvocationCount)
		)
			failDerivation(
				'INPUT_INVALID',
				'TypeScript requested a compiler input absent from the verified project-scoped capture.',
				'$inputs.semanticSnapshot.compilerInputs'
			);
		const queryKey = canonicalText(query);
		const invocationOrdinal = state.occurrenceCounts.get(queryKey) ?? 0;
		state.occurrenceCounts.set(queryKey, invocationOrdinal + 1);
		state.attempts.push({
			invocationOrdinal,
			observation: cloneObservation(entry.observation),
			ordinal: state.attempts.length,
			projectContextInputId: entry.observation.id,
			purpose: attemptPurpose(query),
			query: cloneWire(query),
			stage: state.stage
		});
		state.candidates = nextCandidates;
		if (entry.observation.operation === 'READ_FILE' && entry.observation.result === 'PRESENT') {
			if (
				// S6582 REFUSED — see above: rawSha256 must never be reached with a missing buffer.
				entry.bytes === undefined ||
				entry.bytes.byteLength !== entry.observation.contentBytes ||
				rawSha256(entry.bytes) !== entry.observation.contentSha256
			)
				failDerivation(
					'INPUT_INVALID',
					'A recorded compiler READ_FILE result does not reproduce its captured bytes.',
					'$inputs.semanticSnapshot.compilerInputs'
				);
			state.readBytes += entry.observation.contentBytes;
			if (
				!Number.isSafeInteger(state.readBytes) ||
				state.readBytes > inputs.request.budgets.maxReadBytes
			)
				failDerivation(
					'BUDGET_EXHAUSTED',
					'The module-resolution read-byte budget was exhausted.',
					'$inputs.request.budgets.maxReadBytes'
				);
		}
		return entry;
	};
	const logicalPath = (path: string): string => binding.lookup.toRecordedLogical(path);
	const readFile = (fileName: string): string | undefined => {
		const logical = logicalPath(fileName);
		const entry = record({ logicalPath: logical, operation: 'READ_FILE' });
		if (
			entry.observation.operation !== 'READ_FILE' ||
			entry.observation.result !== 'PRESENT' ||
			entry.bytes === undefined
		)
			return undefined;
		const text = decodeCompilerText(entry.bytes);
		if (state.stage === 'IMPLIED_NODE_FORMAT' && posix.basename(logical) === 'package.json')
			state.impliedPackageTypes.push(packageJsonType(text, logical));
		return text;
	};
	return {
		directoryExists(directoryName) {
			const entry = record({
				logicalPath: logicalPath(directoryName),
				operation: 'DIRECTORY_EXISTS'
			});
			return (
				entry.observation.operation === 'DIRECTORY_EXISTS' &&
				entry.observation.result === 'DIRECTORY'
			);
		},
		fileExists(fileName) {
			const entry = record({ logicalPath: logicalPath(fileName), operation: 'FILE_EXISTS' });
			return (
				entry.observation.operation === 'FILE_EXISTS' && entry.observation.result === 'PRESENT'
			);
		},
		getCurrentDirectory() {
			const entry = record({ logicalPath: '.', operation: 'CURRENT_DIRECTORY' });
			if (
				entry.observation.operation !== 'CURRENT_DIRECTORY' ||
				entry.observation.result !== 'RESOLVED' ||
				entry.observation.resolvedLogicalPath !== '.'
			)
				failDerivation('INPUT_INVALID', 'The captured current directory is inconsistent.');
			return binding.lookup.toRecordedAbsolute('.');
		},
		getDirectories(directoryName) {
			const entry = record({
				logicalPath: logicalPath(directoryName),
				operation: 'GET_DIRECTORIES'
			});
			return entry.observation.operation === 'GET_DIRECTORIES'
				? entry.observation.resultEntries.map((path) => binding.lookup.toRecordedAbsolute(path))
				: [];
		},
		readFile,
		realpath(path) {
			const entry = record({ logicalPath: logicalPath(path), operation: 'REALPATH' });
			return entry.observation.operation === 'REALPATH' && entry.observation.result === 'RESOLVED'
				? binding.lookup.toRecordedAbsolute(entry.observation.resolvedLogicalPath)
				: path;
		},
		useCaseSensitiveFileNames() {
			const entry = record({ logicalPath: '.', operation: 'USE_CASE_SENSITIVE_FILE_NAMES' });
			if (entry.observation.operation !== 'USE_CASE_SENSITIVE_FILE_NAMES')
				failDerivation(
					'INPUT_INVALID',
					'The captured case-sensitivity observation is inconsistent.'
				);
			const result = entry.observation.result === 'CASE_SENSITIVE';
			state.caseSensitivityValues.push(result);
			return result;
		}
	};
}

interface ReplayResult {
	readonly astNodes: number;
	readonly attempts: readonly AttemptSeed[];
	readonly impliedNodeFormat: ts.ResolutionMode;
	readonly importerNode: ts.StringLiteral;
	readonly readBytesBeforeTarget: number;
	readonly resolution: ts.ResolvedModuleFull;
	readonly resolutionMode: ts.ResolutionMode;
	readonly sourceFile: ts.SourceFile;
	readonly useCaseSensitiveFileNames: boolean;
}

function unsupportedResolverProgram(
	inputs: ModuleResolutionTraceBuildInputs,
	options: ts.CompilerOptions
): boolean {
	return (
		ts.version !== inputs.semanticSnapshot.provider.version ||
		options.module !== ts.ModuleKind.NodeNext ||
		options.moduleResolution !== ts.ModuleResolutionKind.NodeNext ||
		(options.customConditions !== undefined &&
			(!Array.isArray(options.customConditions) || options.customConditions.length !== 0))
	);
}

function isSelectedImporterLiteral(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	binding: StaticBinding,
	specifier: string
): node is ts.StringLiteral {
	return (
		ts.isStringLiteral(node) &&
		node.getStart(sourceFile, false) === binding.importerNodeRecord.start &&
		node.getEnd() === binding.importerNodeRecord.end &&
		node.text === specifier &&
		ts.isImportDeclaration(node.parent) &&
		node.parent.moduleSpecifier === node &&
		node.parent.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword
	);
}

function collectImporterLiteralMatches(
	inputs: ModuleResolutionTraceBuildInputs,
	binding: StaticBinding,
	sourceFile: ts.SourceFile,
	state: ReplayState
): ts.StringLiteral[] {
	const matched: ts.StringLiteral[] = [];
	const pending: ts.Node[] = [sourceFile];
	while (pending.length > 0) {
		const node = pending.pop()!;
		state.astNodes += 1;
		if (
			state.astNodes > inputs.request.budgets.maxAstNodes ||
			state.astNodes + state.attempts.length + state.candidates >
				inputs.request.budgets.maxTraversalSteps
		)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'The selected importer AST-node budget was exhausted.',
				'$inputs.request.budgets.maxAstNodes'
			);
		if (isSelectedImporterLiteral(node, sourceFile, binding, inputs.request.specifier))
			matched.push(node);
		ts.forEachChild(node, (child) => {
			pending.push(child);
		});
	}
	return matched;
}

function unstableCaseSensitivity(values: readonly boolean[]): boolean {
	return values.length === 0 || values.some((value) => value !== values[0]);
}

function replayResolution(
	inputs: ModuleResolutionTraceBuildInputs,
	binding: StaticBinding
): ReplayResult {
	if (binding.importerBytes.byteLength > inputs.request.budgets.maxReadBytes)
		failDerivation(
			'BUDGET_EXHAUSTED',
			'The captured importer exceeds the read-byte budget.',
			'$inputs.request.budgets.maxReadBytes'
		);
	const options = binding.materialized.compilerOptions;
	if (options.paths !== undefined || options.baseUrl !== undefined)
		failDerivation(
			'INPUT_INVALID',
			'The selected Program uses path-alias compiler options outside the supported trace.',
			'$inputs.semanticSnapshot.projects'
		);
	const state: ReplayState = {
		attempts: [],
		astNodes: 0,
		candidates: 0,
		caseSensitivityValues: [],
		impliedPackageTypes: [],
		lookup: binding.lookup,
		occurrenceCounts: new Map(),
		readBytes: binding.importerBytes.byteLength,
		stage: 'IMPLIED_NODE_FORMAT'
	};
	const host = createCaptureOnlyResolutionHost(inputs, binding, state);
	if (unsupportedResolverProgram(inputs, options))
		failDerivation(
			'INPUT_INVALID',
			'The selected Program must use NodeNext without custom compiler conditions.',
			'$inputs.semanticSnapshot.projects'
		);
	const impliedNodeFormat = ts.getImpliedNodeFormatForFile(
		binding.importerAbsolutePath,
		undefined,
		host,
		options
	);
	if (impliedNodeFormat !== ts.ModuleKind.ESNext || !state.impliedPackageTypes.includes('module'))
		failDerivation(
			'INPUT_INVALID',
			'The public implied-node-format replay does not establish an ESM package context.',
			'$inputs.semanticSnapshot.projects'
		);
	const sourceFile = ts.createSourceFile(
		binding.importerAbsolutePath,
		binding.importerText,
		{
			impliedNodeFormat,
			languageVersion: options.target ?? ts.ScriptTarget.Latest
		},
		true,
		binding.importerScriptKind === ts.ScriptKind.Unknown
			? undefined
			: (binding.importerScriptKind as ts.ScriptKind)
	);
	const matchedImporterNodes = collectImporterLiteralMatches(inputs, binding, sourceFile, state);
	if (
		matchedImporterNodes.length !== 1 ||
		sourceFile.isDeclarationFile !== binding.importerWitnessBase.declarationFile
	)
		failDerivation(
			'INPUT_INVALID',
			'The selected importer span does not reproduce one exact non-type-only import literal.',
			'$inputs.request.importer.specifierNodeId'
		);
	const importerNode = matchedImporterNodes[0]!;
	const resolutionMode = ts.getModeForUsageLocation(sourceFile, importerNode, options);
	if (resolutionMode !== ts.ModuleKind.ESNext)
		failDerivation(
			'INPUT_INVALID',
			'The public usage-location mode is not the supported import mode.',
			'$inputs.request.importer.specifierNodeId'
		);
	state.stage = 'MODULE_RESOLUTION';
	const resolved = ts.resolveModuleName(
		inputs.request.specifier,
		binding.importerAbsolutePath,
		options,
		host,
		undefined,
		undefined,
		resolutionMode
	).resolvedModule;
	if (resolved === undefined)
		failDerivation(
			'INPUT_INVALID',
			'The public TypeScript resolver did not produce a supported resolved module.',
			'$inputs.request.specifier'
		);
	if (unstableCaseSensitivity(state.caseSensitivityValues))
		failDerivation(
			'INPUT_INVALID',
			'The replayed case-sensitivity callbacks do not establish one stable environment.',
			'$inputs.semanticSnapshot.compilerInputs'
		);
	return {
		astNodes: state.astNodes,
		attempts: state.attempts,
		impliedNodeFormat,
		importerNode,
		readBytesBeforeTarget: state.readBytes,
		resolution: resolved,
		resolutionMode,
		sourceFile,
		useCaseSensitiveFileNames: state.caseSensitivityValues[0]!
	};
}

type TargetInputBinding = Omit<
	ModuleResolutionTargetWitness,
	'candidateId' | 'selectedFileExistsAttemptId'
>;

function independentInputDigest(
	inputs: ModuleResolutionTraceBuildInputs,
	binding: {
		readonly captureWitness: ModuleResolutionTraceSnapshot['captureWitness'];
		readonly importerWitness: ModuleResolutionTraceSnapshot['importerWitness'];
		readonly resolverEnvironment: ModuleResolutionTraceSnapshot['resolverEnvironment'];
		readonly targetWitness: TargetInputBinding;
	}
): string {
	return domainDigest('JAN-CSAA-MODULE-RESOLUTION-TRACE-INPUT', {
		conditionalExportRequest: inputs.conditionalExportRequest,
		conditionalExportResolution: {
			contentDigest: inputs.conditionalExportResolution.contentDigest,
			decision: inputs.conditionalExportResolution.decision,
			id: inputs.conditionalExportResolution.id,
			inputDigest: inputs.conditionalExportResolution.inputDigest,
			manifestWitness: inputs.conditionalExportResolution.manifestWitness,
			requestReference: inputs.request.conditionalExportResolution
		},
		frozenSubject: {
			fileManifestDigest: inputs.frozenSubject.descriptor.fileManifestDigest,
			policyVersion: inputs.frozenSubject.descriptor.policyVersion,
			schemaVersion: inputs.frozenSubject.descriptor.schemaVersion,
			subjectId: inputs.frozenSubject.descriptor.subjectId
		},
		projectContextGraph: {
			canonicalProfile: inputs.projectContextGraph.canonicalProfile,
			contentDigest: inputs.projectContextGraph.contentDigest,
			id: inputs.projectContextGraph.id,
			inputDigest: inputs.projectContextGraph.inputDigest,
			method: inputs.projectContextGraph.method,
			operationVersion: inputs.projectContextGraph.operationVersion,
			requestReference: inputs.request.projectContextGraph,
			schemaVersion: inputs.projectContextGraph.schemaVersion,
			semanticSnapshotId: inputs.projectContextGraph.semanticSnapshotId,
			subjectId: inputs.projectContextGraph.subjectId
		},
		request: inputs.request,
		selectedWitnesses: binding,
		semanticSnapshot: {
			contextDigest: inputs.semanticSnapshot.contextDigest,
			extractionVersion: inputs.semanticSnapshot.extractionVersion,
			id: inputs.semanticSnapshot.id,
			operationVersion: inputs.semanticSnapshot.operationVersion,
			provider: inputs.semanticSnapshot.provider,
			schemaVersion: inputs.semanticSnapshot.schemaVersion,
			subjectId: inputs.semanticSnapshot.subjectId
		}
	});
}

function independentTraceId(
	inputs: ModuleResolutionTraceBuildInputs,
	inputDigest: string
): ModuleResolutionTraceId {
	return identity<ModuleResolutionTraceId>(
		'module-resolution-trace',
		'JAN-CSAA-MODULE-RESOLUTION-TRACE',
		{
			canonicalProfile: MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE,
			conditionalExportResolutionId: inputs.conditionalExportResolution.id,
			inputDigest,
			method: MODULE_RESOLUTION_TRACE_METHOD,
			operationVersion: MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
			schemaVersion: MODULE_RESOLUTION_TRACE_SCHEMA_VERSION,
			semanticSnapshotId: inputs.request.semanticSnapshotId,
			subjectId: inputs.request.subjectId
		}
	);
}

function independentAttemptId(
	traceId: ModuleResolutionTraceId,
	record: Omit<ModuleResolutionAttemptRecord, 'id'>
): ModuleResolutionAttemptId {
	return identity<ModuleResolutionAttemptId>(
		'module-resolution-attempt',
		'JAN-CSAA-MODULE-RESOLUTION-ATTEMPT',
		{ traceId, ...record }
	);
}

function independentCandidateId(
	traceId: ModuleResolutionTraceId,
	record: Omit<ModuleResolutionCandidateRecord, 'id'>
): ModuleResolutionCandidateId {
	return identity<ModuleResolutionCandidateId>(
		'module-resolution-candidate',
		'JAN-CSAA-MODULE-RESOLUTION-CANDIDATE',
		{ traceId, ...record }
	);
}

function independentRelationId(input: {
	readonly importerSourceId: string;
	readonly semanticModuleResolutionId: string;
	readonly specifierNodeId: string;
	readonly targetSourceId: string;
	readonly traceId: ModuleResolutionTraceId;
}): ModuleResolutionRelationId {
	return identity<ModuleResolutionRelationId>(
		'module-resolution-relation',
		'JAN-CSAA-MODULE-RESOLUTION-RELATION',
		{
			kind: 'EXACT_LITERAL_IMPORT_RESOLVES_TO_DECLARATION_BUILD_OUTPUT',
			...input
		}
	);
}

function independentContentDigest(value: ModuleResolutionTraceSnapshot): string {
	const content: Record<string, unknown> = {};
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string' || key === 'contentDigest') continue;
		content[key] = Reflect.getOwnPropertyDescriptor(value, key)!.value;
	}
	return domainDigest('JAN-CSAA-MODULE-RESOLUTION-TRACE-CONTENT', content);
}

function targetExtension(logicalPath: string): '.d.ts' | '.d.mts' | '.d.cts' {
	if (logicalPath.endsWith('.d.mts')) return '.d.mts';
	if (logicalPath.endsWith('.d.cts')) return '.d.cts';
	return '.d.ts';
}

function candidateExclusionReason(
	selected: boolean,
	purpose: ModuleResolutionCandidateRecord['purpose'],
	observationResult: ModuleResolutionCandidateRecord['observationResult']
): ModuleResolutionCandidateRecord['exclusionReason'] {
	if (selected) return null;
	if (purpose === 'PACKAGE_METADATA') return 'PACKAGE_METADATA_NOT_A_MODULE_TARGET';
	if (observationResult === 'ABSENT') return 'FILE_ABSENT';
	return 'PRESENT_NOT_SELECTED';
}

type DeriveResult =
	| { readonly graph: ModuleResolutionTraceSnapshot; readonly state: 'VALID' }
	| { readonly problem: ModuleResolutionTraceValidationIssue; readonly state: 'INVALID' };

function derive(inputs: ModuleResolutionTraceBuildInputs, knownInputDigest?: string): DeriveResult {
	try {
		const binding = bindStaticInputs(inputs);
		const replay = replayResolution(inputs, binding);
		const finalLogicalPath = binding.lookup.toRecordedLogical(replay.resolution.resolvedFileName);
		if (
			finalLogicalPath !== binding.targetSource.logicalPath ||
			replay.resolution.extension !== targetExtension(finalLogicalPath)
		)
			failDerivation(
				'INPUT_INVALID',
				'The public resolver result does not reproduce the exact semantic declaration target.',
				'$inputs.semanticSnapshot.moduleResolutions'
			);
		const moduleFileExistsAttempts = replay.attempts.filter(
			(attempt) =>
				attempt.stage === 'MODULE_RESOLUTION' && attempt.query.operation === 'FILE_EXISTS'
		);
		const realpathQueriesResolvingToFinal = new Set<string>();
		for (const attempt of replay.attempts)
			if (
				attempt.stage === 'MODULE_RESOLUTION' &&
				attempt.query.operation === 'REALPATH' &&
				attempt.observation.operation === 'REALPATH' &&
				attempt.observation.result === 'RESOLVED' &&
				attempt.observation.resolvedLogicalPath === finalLogicalPath
			)
				realpathQueriesResolvingToFinal.add(attempt.query.logicalPath);
		const selectedAttemptSeeds = moduleFileExistsAttempts.filter(
			(attempt) =>
				attempt.purpose === 'MODULE_TARGET_CANDIDATE' &&
				attempt.observation.operation === 'FILE_EXISTS' &&
				attempt.observation.result === 'PRESENT' &&
				(attempt.query.logicalPath === finalLogicalPath ||
					realpathQueriesResolvingToFinal.has(attempt.query.logicalPath))
		);
		if (selectedAttemptSeeds.length !== 1)
			failDerivation(
				'INPUT_INVALID',
				'The public callback evidence does not identify one exact selected FILE_EXISTS candidate.',
				'$inputs.semanticSnapshot.compilerInputs'
			);
		const selectedAttemptSeed = selectedAttemptSeeds[0]!;
		const originalResolvedLogicalPath = selectedAttemptSeed.query.logicalPath;
		const targetReadEntry = presentRead(
			binding.lookup.lookupAttributedQuery({
				logicalPath: finalLogicalPath,
				operation: 'READ_FILE'
			}),
			finalLogicalPath,
			'$inputs.semanticSnapshot.sources'
		);
		if (
			targetReadEntry.observation.contentBytes !== binding.targetSource.bytes ||
			targetReadEntry.observation.contentSha256 !== binding.targetSource.contentSha256 ||
			targetReadEntry.observation.origin !== 'WORKSPACE_BUILD_DECLARATION'
		)
			failDerivation(
				'INPUT_INVALID',
				'The selected target READ_FILE witness does not reproduce the semantic build declaration.',
				'$inputs.semanticSnapshot.sources'
			);
		const targetProgram = inputs.semanticSnapshot.programs.filter(
			(program) => program.id === binding.targetSource.programId
		)[0]!;
		const targetProject = inputs.semanticSnapshot.projects.filter(
			(project) => project.id === binding.targetSource.projectId
		)[0]!;
		const readBytes = replay.readBytesBeforeTarget + targetReadEntry.observation.contentBytes;
		if (!Number.isSafeInteger(readBytes) || readBytes > inputs.request.budgets.maxReadBytes)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'The selected target exhausted the read-byte budget.',
				'$inputs.request.budgets.maxReadBytes'
			);
		const importerWitness: ModuleResolutionTraceSnapshot['importerWitness'] = {
			...binding.importerWitnessBase,
			end: replay.importerNode.getEnd(),
			literalValueSha256: binding.literalRecord.valueSha256,
			start: replay.importerNode.getStart(replay.sourceFile, false)
		};
		const resolverEnvironment: ModuleResolutionTraceSnapshot['resolverEnvironment'] = {
			compilerOptionsDigest: canonicalSha256(binding.materialized.compilerOptions),
			compilerVersion: ts.version,
			configPath: binding.configPath,
			customConditions: [],
			impliedNodeFormat: replay.impliedNodeFormat!,
			impliedNodeFormatName: 'ESNext',
			module: ts.ModuleKind.NodeNext,
			moduleName: 'NodeNext',
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
			moduleResolutionName: 'NodeNext',
			packageJsonType: 'module',
			publicConditionMembership: { import: true, node: true, types: true },
			publicConditionOrder: 'NOT_CLAIMED',
			resolutionMode: replay.resolutionMode!,
			resolutionModeName: 'ESNext',
			useCaseSensitiveFileNames: replay.useCaseSensitiveFileNames
		};
		const targetInputBinding: TargetInputBinding = {
			artifactClass: 'CONTEXT_ONLY',
			bytes: binding.targetSource.bytes,
			contentSha256: binding.targetSource.contentSha256,
			declarationFile: true,
			extension: targetExtension(finalLogicalPath),
			logicalPath: finalLogicalPath,
			originalResolvedLogicalPath,
			origin: 'WORKSPACE_BUILD_DECLARATION',
			packageExportTarget: inputs.conditionalExportResolution.decision.target as string,
			packageName: inputs.request.packageName,
			packageWorkspacePath: binding.workspace.path,
			semanticProgramId: targetProgram.id,
			semanticProjectId: targetProject.id,
			semanticSourceId: binding.targetSource.id,
			targetRead: {
				observation: cloneObservation(
					targetReadEntry.observation
				) as ModuleResolutionTargetWitness['targetRead']['observation'],
				query: cloneWire(
					targetReadEntry.query
				) as ModuleResolutionTargetWitness['targetRead']['query']
			}
		};
		const inputDigest = independentInputDigest(inputs, {
			captureWitness: binding.captureWitness,
			importerWitness,
			resolverEnvironment,
			targetWitness: targetInputBinding
		});
		if (knownInputDigest !== undefined && knownInputDigest !== inputDigest)
			failDerivation(
				'IDENTITY_MISMATCH',
				'The trusted producer input digest does not reproduce independently.',
				'$validationInput.inputDigest'
			);
		const traceId = independentTraceId(inputs, inputDigest);
		const attempts: ModuleResolutionAttemptRecord[] = replay.attempts.map((seed) => ({
			id: independentAttemptId(traceId, seed),
			...seed
		}));
		const selectedAttempt = attempts.find(
			(attempt) => attempt.ordinal === selectedAttemptSeed.ordinal
		)!;
		const candidateSeeds = attempts
			.filter(
				(attempt) =>
					attempt.stage === 'MODULE_RESOLUTION' && attempt.query.operation === 'FILE_EXISTS'
			)
			.map((attempt, ordinal): Omit<ModuleResolutionCandidateRecord, 'id'> => {
				const purpose = attempt.purpose as 'MODULE_TARGET_CANDIDATE' | 'PACKAGE_METADATA';
				const observation = attempt.observation as Extract<
					CompilerInputObservation,
					{ readonly operation: 'FILE_EXISTS' }
				>;
				const selected = attempt.id === selectedAttempt.id;
				return {
					attemptId: attempt.id,
					disposition: selected ? 'SELECTED' : 'EXCLUDED',
					exclusionReason: candidateExclusionReason(selected, purpose, observation.result),
					logicalPath: attempt.query.logicalPath,
					observationResult: observation.result,
					ordinal,
					purpose
				};
			});
		const candidates: ModuleResolutionCandidateRecord[] = candidateSeeds.map((seed) => ({
			id: independentCandidateId(traceId, seed),
			...seed
		}));
		const selectedCandidate = candidates.find(
			(candidate) => candidate.attemptId === selectedAttempt.id
		)!;
		const targetWitness: ModuleResolutionTargetWitness = {
			...targetInputBinding,
			candidateId: selectedCandidate.id,
			selectedFileExistsAttemptId: selectedAttempt.id
		};
		const relation: ModuleResolutionTraceSnapshot['relation'] = {
			id: independentRelationId({
				importerSourceId: importerWitness.semanticSourceId,
				semanticModuleResolutionId: importerWitness.semanticModuleResolutionId,
				specifierNodeId: importerWitness.specifierNodeId,
				targetSourceId: targetWitness.semanticSourceId,
				traceId
			}),
			importerSourceId: importerWitness.semanticSourceId,
			kind: 'EXACT_LITERAL_IMPORT_RESOLVES_TO_DECLARATION_BUILD_OUTPUT',
			ordinal: 0,
			semanticModuleResolutionId: importerWitness.semanticModuleResolutionId,
			specifierNodeId: importerWitness.specifierNodeId,
			targetSourceId: targetWitness.semanticSourceId
		};
		const chargedTraversalSteps = replay.astNodes + attempts.length + candidates.length;
		const inputRecords = attempts.length + 1;
		const outputRecords = 1 + attempts.length + candidates.length;
		const content: Omit<ModuleResolutionTraceSnapshot, 'contentDigest'> = {
			attempts,
			authorityTransfer: MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER,
			budgets: cloneWire(inputs.request.budgets),
			candidates,
			canonicalProfile: MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE,
			capability: MODULE_RESOLUTION_TRACE_CAPABILITY,
			capabilityStatus: MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS,
			captureWitness: binding.captureWitness,
			closure: 'CLOSED_FOR_SELECTED_SUPPORTED_EXACT_RESOLVED_REQUEST',
			conditionalExportResolution: cloneWire(inputs.request.conditionalExportResolution),
			coverage: {
				astNodes: replay.astNodes,
				attemptPopulationReconciles: true,
				attemptRecords: attempts.length,
				candidatePopulationReconciles: true,
				candidateRecords: candidates.length,
				chargedTraversalSteps,
				excludedCandidates: candidates.length - 1,
				impliedNodeFormatAttempts: attempts.filter(
					(attempt) => attempt.stage === 'IMPLIED_NODE_FORMAT'
				).length,
				inputRecords,
				moduleResolutionAttempts: attempts.filter(
					(attempt) => attempt.stage === 'MODULE_RESOLUTION'
				).length,
				moduleResolutionFileExistsAttempts: candidates.length,
				outputRecords,
				readBytes,
				relationPopulationReconciles: true,
				relationRecords: 1,
				selectedCandidates: 1,
				selectedImporterPrograms: 1,
				selectedImporterSources: 1,
				selectedTargets: 1,
				selectedWorkspacePackages: 1
			},
			currentness: MODULE_RESOLUTION_TRACE_CURRENTNESS,
			freshness: MODULE_RESOLUTION_TRACE_FRESHNESS,
			fullJanCsaa007Conformance: MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE,
			fullJanCsaa011Conformance: MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE,
			gateEffect: MODULE_RESOLUTION_TRACE_GATE_EFFECT,
			health: 'PARTIAL',
			id: traceId,
			importerWitness,
			inputDigest,
			method: MODULE_RESOLUTION_TRACE_METHOD,
			nonclaims: MODULE_RESOLUTION_TRACE_NONCLAIMS,
			operationVersion: MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
			projectContextGraph: cloneWire(inputs.request.projectContextGraph),
			relation,
			resolutionAuthority: MODULE_RESOLUTION_TRACE_AUTHORITY,
			resolverEnvironment,
			resultCompleteness: 'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_RESOLVED_REQUEST',
			schemaVersion: MODULE_RESOLUTION_TRACE_SCHEMA_VERSION,
			selection: MODULE_RESOLUTION_TRACE_SELECTION,
			semanticSnapshotId: inputs.request.semanticSnapshotId,
			semanticValidationWitness: {
				context: 'FROZEN_SUBJECT',
				frozenSubjectSha256: canonicalSha256(inputs.frozenSubject),
				method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT',
				semanticSnapshotId: inputs.semanticSnapshot.id,
				semanticSnapshotSha256: canonicalSha256(inputs.semanticSnapshot),
				state: 'VALID',
				subjectId: inputs.request.subjectId
			},
			subjectId: inputs.request.subjectId,
			targetWitness,
			truncation: { reason: null, state: 'NOT_TRUNCATED' }
		};
		const graph = {
			...content,
			contentDigest: domainDigest('JAN-CSAA-MODULE-RESOLUTION-TRACE-CONTENT', content)
		} as ModuleResolutionTraceSnapshot;
		return { graph, state: 'VALID' };
	} catch (error) {
		if (error instanceof DerivationFailure) return { problem: error.problem, state: 'INVALID' };
		return {
			problem: issue(
				'INPUT_INVALID',
				'Module-resolution trace inputs could not be independently replayed.',
				'$inputs'
			),
			state: 'INVALID'
		};
	}
}

function validateInternal(
	value: unknown,
	inputsValue: unknown,
	options: ModuleResolutionTraceValidationOptions | undefined,
	knownInputDigest?: string,
	predecessorValidated = false
): ModuleResolutionTraceValidationResult {
	const limits = closeOptions(options);
	if (limits === null)
		return invalid(issue('SHAPE_INVALID', 'Validation options are invalid.', '$options'));
	const candidateTreeIssue = plainTreeIssue(
		value,
		{
			maxDepth: limits.maxDepth,
			maxRecords: limits.maxRecords,
			maxStringCharacters: limits.maxStringCharacters
		},
		'$'
	);
	if (candidateTreeIssue !== null) return invalid(candidateTreeIssue);
	if (!plainRecord(value) || !exactKeys(value, SNAPSHOT_KEYS))
		return invalid(
			issue('SHAPE_INVALID', 'The module-resolution trace snapshot shell must be exact.')
		);
	const shellIssue = inputShellIssue(inputsValue);
	if (shellIssue !== null) return invalid(shellIssue);
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
	if (broadInputIssue !== null) return invalid(broadInputIssue);
	const inputs = inputsValue as ModuleResolutionTraceBuildInputs;
	const closedRequestIssue = requestIssue(inputs);
	if (closedRequestIssue !== null) return invalid(closedRequestIssue);
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
	if (requestInputIssue !== null) return invalid(requestInputIssue);
	if (!predecessorValidated) {
		const problem = predecessorIssue(inputs, limits);
		if (problem !== null) return invalid(problem);
	}
	const bindingProblem = inputBindingIssue(inputs);
	if (bindingProblem !== null) return invalid(bindingProblem);
	const expected = derive(inputs, knownInputDigest);
	if (expected.state === 'INVALID') return invalid(expected.problem);
	const candidate = value as unknown as ModuleResolutionTraceSnapshot;
	if (candidate.inputDigest !== expected.graph.inputDigest || candidate.id !== expected.graph.id)
		return invalid(
			issue(
				'IDENTITY_MISMATCH',
				'The candidate trace identities do not reproduce from the exact inputs.'
			)
		);
	if (candidate.contentDigest !== independentContentDigest(candidate))
		return invalid(
			issue(
				'CONTENT_DIGEST_MISMATCH',
				'The module-resolution trace content digest is invalid.',
				'$.contentDigest'
			)
		);
	if (!canonicalEqual(candidate, expected.graph))
		return invalid(
			issue(
				'DERIVATION_MISMATCH',
				'The candidate differs from the independently replayed module-resolution trace.'
			)
		);
	return { issues: [], state: 'VALID' };
}

export function validateModuleResolutionTrace(
	value: unknown,
	inputs: ModuleResolutionTraceBuildInputs,
	options?: ModuleResolutionTraceValidationOptions
): ModuleResolutionTraceValidationResult {
	if (arguments.length < 2 || arguments.length > 3)
		return invalid(
			issue('SHAPE_INVALID', 'The validator requires exactly two or three arguments.', '$arguments')
		);
	try {
		return validateInternal(value, inputs, options);
	} catch {
		return invalid(issue('SHAPE_INVALID', 'Module-resolution trace validation failed closed.'));
	}
}

/**
 * Producer-internal path with a trusted precondition: the exact FrozenSubject,
 * StaticSemanticSnapshot, ProjectContextGraph, ConditionalExportResolutionRequest,
 * and ConditionalExportResolution object graph must have passed either public
 * CAP-012 validation or the equivalent documented producer chain: public semantic
 * validation under the componentwise minimum of the CAP-011 request and CAP-010
 * graph budgets, followed by constructed CAP-010 and CAP-012 validation. That
 * evidence must be established before uninterrupted synchronous trace construction
 * without intervening mutation. The known digest must reproduce the compact input
 * binding but does not replace that trust precondition; all other capture replay,
 * witness, identity, content, and derivation checks are repeated independently.
 * Callers without that exact predecessor-validation evidence must use the public
 * validator.
 */
export function validateConstructedModuleResolutionTrace(
	value: unknown,
	inputs: ModuleResolutionTraceBuildInputs,
	knownInputDigest: string,
	options?: ModuleResolutionTraceValidationOptions
): ModuleResolutionTraceValidationResult {
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
			issue('SHAPE_INVALID', 'Constructed module-resolution trace validation failed closed.')
		);
	}
}
