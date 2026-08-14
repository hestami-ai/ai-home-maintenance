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
	return left < right ? -1 : left > right ? 1 : 0;
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

/** Descriptor-only traversal: getters, iterators, callbacks, and toJSON are never invoked. */
function plainTreeIssue(
	value: unknown,
	limits: Pick<ClosedOptions, 'maxDepth' | 'maxRecords' | 'maxStringCharacters'>,
	rootPath: string,
	input = false
): ConditionalExportResolutionValidationIssue | null {
	type Frame =
		| {
				readonly depth: number;
				readonly path: string;
				readonly state: 'VISIT';
				readonly value: unknown;
		  }
		| { readonly state: 'LEAVE'; readonly value: object };
	const pending: Frame[] = [{ depth: 0, path: rootPath, state: 'VISIT', value }];
	const active = new WeakSet<object>();
	let records = 0;
	let characters = 0;
	const malformedCode = input ? 'INPUT_INVALID' : 'SHAPE_INVALID';
	while (pending.length > 0) {
		const frame = pending.pop()!;
		if (frame.state === 'LEAVE') {
			active.delete(frame.value);
			continue;
		}
		records += 1;
		if (records > limits.maxRecords)
			return issue('BUDGET_EXHAUSTED', 'The descriptor record budget was exhausted.', frame.path);
		if (frame.depth > limits.maxDepth)
			return issue('BUDGET_EXHAUSTED', 'The descriptor depth budget was exhausted.', frame.path);
		if (typeof frame.value === 'string') {
			if (!isUnicodeScalarString(frame.value))
				return issue(malformedCode, 'Strings must contain Unicode scalar text.', frame.path);
			characters += frame.value.length;
			if (characters > limits.maxStringCharacters)
				return issue(
					'BUDGET_EXHAUSTED',
					'The descriptor string-character budget was exhausted.',
					frame.path
				);
			continue;
		}
		if (
			frame.value === null ||
			typeof frame.value === 'boolean' ||
			(typeof frame.value === 'number' &&
				Number.isFinite(frame.value) &&
				(!Number.isInteger(frame.value) || Number.isSafeInteger(frame.value)) &&
				!Object.is(frame.value, -0))
		)
			continue;
		if (typeof frame.value !== 'object')
			return issue(malformedCode, 'Only JSON-compatible data values are accepted.', frame.path);
		if (isProxyValue(frame.value))
			return issue(malformedCode, 'Proxy values are not accepted.', frame.path);
		if (active.has(frame.value))
			return issue(malformedCode, 'Cyclic data is not accepted.', frame.path);
		const array = Array.isArray(frame.value);
		const prototype = Reflect.getPrototypeOf(frame.value);
		if (
			(array && prototype !== Array.prototype) ||
			(!array && prototype !== Object.prototype && prototype !== null)
		)
			return issue(malformedCode, 'Containers must have ordinary prototypes.', frame.path);
		const keys = Reflect.ownKeys(frame.value);
		if (keys.some((key) => typeof key !== 'string'))
			return issue(malformedCode, 'Symbol keys are not accepted.', frame.path);
		const stringKeys = keys as string[];
		for (const key of stringKeys) {
			if (array && key === 'length') continue;
			characters += key.length;
			if (characters > limits.maxStringCharacters)
				return issue(
					'BUDGET_EXHAUSTED',
					'The descriptor string-character budget was exhausted by a property key.',
					frame.path
				);
			if (!isUnicodeScalarString(key))
				return issue(malformedCode, 'Property keys must contain Unicode scalar text.', frame.path);
		}
		let arrayLength: number | null = null;
		if (array) {
			arrayLength = Reflect.getOwnPropertyDescriptor(frame.value, 'length')!.value as number;
			if (arrayLength! > limits.maxRecords - records)
				return issue(
					'BUDGET_EXHAUSTED',
					'The descriptor record budget was exhausted by an array population.',
					frame.path
				);
			if (keys.length !== arrayLength! + 1)
				return issue(malformedCode, 'Arrays must be dense ordinary arrays.', frame.path);
			if (
				stringKeys.some((key) => {
					if (key === 'length') return false;
					if (!/^(0|[1-9][0-9]*)$/u.test(key)) return true;
					const index = Number(key);
					return !Number.isSafeInteger(index) || index >= arrayLength! || String(index) !== key;
				})
			)
				return issue(malformedCode, 'Arrays must be dense without extra properties.', frame.path);
		} else if (keys.length > limits.maxRecords - records) {
			return issue(
				'BUDGET_EXHAUSTED',
				'The descriptor record budget was exhausted by a property population.',
				frame.path
			);
		}
		active.add(frame.value);
		pending.push({ state: 'LEAVE', value: frame.value });
		for (let index = stringKeys.length - 1; index >= 0; index -= 1) {
			const key = stringKeys[index]!;
			if (array && key === 'length') continue;
			const descriptor = Reflect.getOwnPropertyDescriptor(frame.value, key)!;
			if (!descriptor.enumerable || !('value' in descriptor))
				return issue(
					malformedCode,
					'Properties must be enumerable data properties.',
					`${frame.path}.${key}`
				);
			pending.push({
				depth: frame.depth + 1,
				path: array ? `${frame.path}[${key}]` : `${frame.path}.${key}`,
				state: 'VISIT',
				value: descriptor.value
			});
		}
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

/** Validator-private canonical token stream over values already accepted by plainTreeIssue. */
function* canonicalChunks(value: unknown): Generator<string, void, undefined> {
	const pending: CanonicalFrame[] = [{ state: 'VALUE', value }];
	while (pending.length > 0) {
		const frame = pending.pop()!;
		if (frame.state === 'ARRAY') {
			if (frame.index === frame.length) {
				yield ']';
				continue;
			}
			if (frame.index !== 0) yield ',';
			pending.push({ ...frame, index: frame.index + 1 });
			pending.push({
				state: 'VALUE',
				value: Reflect.getOwnPropertyDescriptor(frame.value, String(frame.index))!.value
			});
			continue;
		}
		if (frame.state === 'OBJECT') {
			if (frame.index === frame.entries.length) {
				yield '}';
				continue;
			}
			if (frame.index !== 0) yield ',';
			const [key, child] = frame.entries[frame.index]!;
			yield JSON.stringify(key);
			yield ':';
			pending.push({ ...frame, index: frame.index + 1 });
			pending.push({ state: 'VALUE', value: child });
			continue;
		}

		const input = frame.value;
		if (input === null) {
			yield 'null';
			continue;
		}
		if (typeof input === 'string') {
			yield JSON.stringify(input);
			continue;
		}
		if (typeof input === 'boolean') {
			yield input ? 'true' : 'false';
			continue;
		}
		if (typeof input === 'number') {
			yield JSON.stringify(input);
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
	const declarationOrdinals = new Map<ts.PropertyAssignment, number>();
	const objectLiterals: ts.ObjectLiteralExpression[] = [];
	const pending: ts.Node[] = [source];
	let astNodes = 0;
	let declarationOrdinal = 0;
	while (pending.length > 0) {
		const node = pending.pop()!;
		astNodes += 1;
		if (astNodes > inputs.request.budgets.maxAstNodes)
			return {
				problem: issue(
					'BUDGET_EXHAUSTED',
					'The manifest AST-node budget was exhausted.',
					'$inputs.request.budgets.maxAstNodes'
				),
				state: 'INVALID'
			};
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
	for (const object of objectLiterals) {
		const names = new Set<string>();
		for (const property of object.properties) {
			if (!ts.isPropertyAssignment(property))
				return {
					problem: issue(
						'INPUT_INVALID',
						'The manifest contains an unsupported object member.',
						'$manifest'
					),
					state: 'INVALID'
				};
			const name = propertyName(property);
			if (name === null || !isUnicodeScalarString(name) || names.has(name))
				return {
					problem: issue(
						'INPUT_INVALID',
						'The manifest contains a duplicate or non-string object key.',
						'$manifest'
					),
					state: 'INVALID'
				};
			names.add(name);
		}
	}
	let exportsProperty: ts.PropertyAssignment | null = null;
	let importsProperty: ts.PropertyAssignment | null = null;
	for (const property of root.properties) {
		const assignment = property as ts.PropertyAssignment;
		const name = propertyName(assignment)!;
		if (name === 'exports') exportsProperty = assignment;
		if (name === 'imports') importsProperty = assignment;
	}
	const nameProperty = root.properties.find(
		(property) => propertyName(property as ts.PropertyAssignment) === 'name'
	) as ts.PropertyAssignment | undefined;
	if (
		nameProperty === undefined ||
		!ts.isStringLiteral(nameProperty.initializer) ||
		nameProperty.initializer.text !== bound.workspace.name
	)
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
			astNodes,
			declarationOrdinals,
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
	interface PendingProperty {
		readonly ancestorsActive: boolean;
		readonly conditionPath: readonly string[];
		readonly parentIndex: number | null;
		readonly property: ts.PropertyAssignment;
	}
	const pending: PendingProperty[] = [];
	for (let index = root.properties.length - 1; index >= 0; index -= 1)
		pending.push({
			ancestorsActive: true,
			conditionPath: [],
			parentIndex: null,
			property: root.properties[index] as ts.PropertyAssignment
		});
	const branchSeeds: BranchSeed[] = [];
	let decisionLeafSeedIndex: number | null = null;
	let decisionState: ConditionalExportDecisionRecord['state'] | null = null;
	let decisionTarget: string | null = null;
	let terminated = false;
	while (pending.length > 0) {
		const frame = pending.pop()!;
		const condition = propertyName(frame.property)!;
		const path = [...frame.conditionPath, condition];
		const match = conditionMatch(condition, inputs);
		const active = match !== 'INACTIVE';
		const priorTerminated = terminated;
		const pathActive = !priorTerminated && frame.ancestorsActive && active;
		const initializer = frame.property.initializer;
		let valueKind: ConditionalExportBranchRecord['valueKind'] | null = null;
		let target: string | null = null;
		if (ts.isObjectLiteralExpression(initializer)) valueKind = 'CONDITION_OBJECT';
		else if (ts.isStringLiteral(initializer)) {
			valueKind = 'STRING';
			target = initializer.text;
		} else if (nullLiteral(initializer)) valueKind = 'NULL';
		else {
			frontierSeeds.push(
				frontierSeed(
					parsed,
					frame.property,
					['exports', exportSubpath, ...path],
					pathActive ? 'BLOCKS_SELECTED_DECISION' : 'OUTSIDE_SELECTED_DECISION',
					ts.isArrayLiteralExpression(initializer)
						? 'EXPORT_ARRAY_FALLBACK_UNSUPPORTED'
						: 'UNSUPPORTED_EXPORT_VALUE_KIND',
					initializer
				)
			);
			if (pathActive) {
				terminated = true;
				decisionState = 'UNSUPPORTED';
			}
			continue;
		}
		const seedIndex = branchSeeds.length;
		branchSeeds.push({
			condition,
			conditionMatch: match,
			conditionPath: path,
			declarationOrdinal: declarationOrdinal(parsed, frame.property),
			depth: path.length - 1,
			exclusionReason: priorTerminated
				? 'PRIOR_BRANCH_TERMINATED_EVALUATION'
				: !frame.ancestorsActive
					? 'ANCESTOR_CONDITION_INACTIVE'
					: !active
						? 'CONDITION_INACTIVE'
						: null,
			keySpan: sourceSpan(frame.property.name, parsed.source),
			parentIndex: frame.parentIndex,
			target,
			valueKind,
			valueSpan: sourceSpan(initializer, parsed.source)
		});
		if (valueKind === 'STRING') {
			const safe = safeRelativePackageSyntax(target!, false);
			if (!safe) {
				frontierSeeds.push(
					frontierSeed(
						parsed,
						frame.property,
						['exports', exportSubpath, ...path],
						pathActive ? 'BLOCKS_SELECTED_DECISION' : 'OUTSIDE_SELECTED_DECISION',
						'UNSUPPORTED_EXPORT_TARGET_SYNTAX',
						initializer
					)
				);
			}
			if (pathActive) {
				terminated = true;
				if (safe) {
					decisionLeafSeedIndex = seedIndex;
					decisionState = 'SELECTED_TARGET';
					decisionTarget = target;
				} else decisionState = 'UNSUPPORTED';
			}
		} else if (valueKind === 'NULL') {
			if (pathActive) {
				terminated = true;
				decisionLeafSeedIndex = seedIndex;
				decisionState = 'BLOCKED_BY_NULL';
			}
		} else if (ts.isObjectLiteralExpression(initializer)) {
			for (let index = initializer.properties.length - 1; index >= 0; index -= 1)
				pending.push({
					ancestorsActive: pathActive,
					conditionPath: path,
					parentIndex: seedIndex,
					property: initializer.properties[index] as ts.PropertyAssignment
				});
		}
	}
	if (decisionState === null)
		return {
			branchSeeds,
			decisionLeafSeedIndex: null,
			decisionState: 'NO_MATCHING_CONDITION',
			decisionTarget: null
		};
	return {
		branchSeeds,
		decisionLeafSeedIndex,
		decisionState,
		decisionTarget
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
	if (!explicitSubpathMap) {
		const impact =
			inputs.request.exportSubpath === '.'
				? 'BLOCKS_SELECTED_DECISION'
				: 'OUTSIDE_SELECTED_DECISION';
		if (ts.isStringLiteral(exportsValue)) {
			if (!safeRelativePackageSyntax(exportsValue.text, false))
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
				decisionState:
					inputs.request.exportSubpath !== '.'
						? 'NO_EXACT_EXPORT_KEY'
						: safeRelativePackageSyntax(exportsValue.text, false)
							? 'SELECTED_TARGET'
							: 'UNSUPPORTED',
				decisionTarget:
					inputs.request.exportSubpath === '.' &&
					safeRelativePackageSyntax(exportsValue.text, false)
						? exportsValue.text
						: null,
				exactKeyComparisons: 1,
				exactKeyOutcome: rootKeyOutcome(),
				frontierSeeds
			};
		}
		if (nullLiteral(exportsValue))
			return {
				branchSeeds: [],
				decisionLeafSeedIndex: null,
				decisionState:
					inputs.request.exportSubpath === '.' ? 'BLOCKED_BY_NULL' : 'NO_EXACT_EXPORT_KEY',
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
				ts.isArrayLiteralExpression(exportsValue)
					? 'EXPORT_ARRAY_FALLBACK_UNSUPPORTED'
					: ts.isObjectLiteralExpression(exportsValue)
						? 'EXPORTS_ROOT_CONDITION_MAP_UNSUPPORTED'
						: 'UNSUPPORTED_EXPORT_VALUE_KIND',
				exportsValue
			)
		);
		return {
			branchSeeds: [],
			decisionLeafSeedIndex: null,
			decisionState: inputs.request.exportSubpath === '.' ? 'UNSUPPORTED' : 'NO_EXACT_EXPORT_KEY',
			decisionTarget: null,
			exactKeyComparisons: 1,
			exactKeyOutcome: rootKeyOutcome(),
			frontierSeeds
		};
	}

	const assignments = exportsValue.properties as ts.NodeArray<ts.PropertyAssignment>;
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
	if (exactProperty === null) {
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
			exactKeyComparisons: assignments.length,
			exactKeyOutcome: { exportSubpath: inputs.request.exportSubpath, state: 'ABSENT' },
			frontierSeeds: adjustedFrontiers
		};
	}
	const exactKeyOutcome: ConditionalExportResolutionSnapshot['exactKeyOutcome'] = {
		declarationOrdinal: declarationOrdinal(parsed, exactProperty),
		exportSubpath: inputs.request.exportSubpath,
		keySpan: sourceSpan(exactProperty.name, source),
		matchKind: 'EXPLICIT_SUBPATH_KEY',
		state: 'MATCHED',
		valueSpan: sourceSpan(exactProperty.initializer, source)
	};
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
			exactKeyComparisons: assignments.length,
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
			exactKeyComparisons: assignments.length,
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
			exactKeyComparisons: assignments.length,
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
		exactKeyComparisons: assignments.length,
		exactKeyOutcome,
		frontierSeeds
	};
}

type Derivation =
	| { readonly graph: ConditionalExportResolutionSnapshot; readonly state: 'VALID' }
	| { readonly problem: ConditionalExportResolutionValidationIssue; readonly state: 'INVALID' };

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
	for (const [actual, maximum, path] of [
		[branchRecords, inputs.request.budgets.maxBranches, '$inputs.request.budgets.maxBranches'],
		[
			branchRecords,
			inputs.request.budgets.maxConditionChecks,
			'$inputs.request.budgets.maxConditionChecks'
		],
		[frontierRecords, inputs.request.budgets.maxFrontiers, '$inputs.request.budgets.maxFrontiers'],
		[
			chargedTraversalSteps,
			inputs.request.budgets.maxTraversalSteps,
			'$inputs.request.budgets.maxTraversalSteps'
		],
		[
			outputRecords,
			inputs.request.budgets.maxOutputRecords,
			'$inputs.request.budgets.maxOutputRecords'
		]
	] as const) {
		if (actual > maximum)
			return {
				problem: issue('BUDGET_EXHAUSTED', `The operation budget at ${path} was exhausted.`, path),
				state: 'INVALID'
			};
	}
	const selectedSeedIndexes = new Set<number>();
	if (evaluated.decisionLeafSeedIndex !== null) {
		let current: number | null = evaluated.decisionLeafSeedIndex;
		while (current !== null) {
			selectedSeedIndexes.add(current);
			current = evaluated.branchSeeds[current]!.parentIndex;
		}
	}
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
			evaluation:
				seed.exclusionReason !== null
					? 'EXCLUDED'
					: selectedSeedIndexes.has(ordinal)
						? 'SELECTED'
						: 'CANDIDATE',
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
		blockedByNullDecisions: decision.state === 'BLOCKED_BY_NULL' ? (1 as const) : (0 as const),
		branchPopulationReconciles: true as const,
		branchRecords,
		candidateBranches: branches.filter((branch) => branch.evaluation === 'CANDIDATE').length,
		chargedTraversalSteps,
		conditionChecks: branchRecords,
		decisionPopulationReconciles: true as const,
		decisionRecords: 1 as const,
		exactExportKeyComparisons: evaluated.exactKeyComparisons,
		exactExportKeyMatches:
			evaluated.exactKeyOutcome.state === 'MATCHED' ? (1 as const) : (0 as const),
		exactExportKeyMisses:
			evaluated.exactKeyOutcome.state === 'ABSENT' ? (1 as const) : (0 as const),
		excludedBranches: branches.filter((branch) => branch.evaluation === 'EXCLUDED').length,
		frontierPopulationReconciles: true as const,
		frontierRecords,
		manifestBytes: parsed.manifestWitness.manifestBytes,
		noExactExportKeyDecisions:
			decision.state === 'NO_EXACT_EXPORT_KEY' ? (1 as const) : (0 as const),
		noMatchingConditionDecisions:
			decision.state === 'NO_MATCHING_CONDITION' ? (1 as const) : (0 as const),
		outputRecords,
		selectedBranches: branches.filter((branch) => branch.evaluation === 'SELECTED').length,
		selectedConsumerPrograms: 1 as const,
		selectedConsumerSources: 1 as const,
		selectedManifests: 1 as const,
		selectedTargetDecisions: decision.state === 'SELECTED_TARGET' ? (1 as const) : (0 as const),
		selectedWorkspacePackages: 1 as const,
		unsupportedDecisions: decision.state === 'UNSUPPORTED' ? (1 as const) : (0 as const)
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

function manifestStructureIssue(
	parsed: ParsedManifest,
	request: ConditionalExportResolutionBuildInputs['request']
): ConditionalExportResolutionValidationIssue | null {
	const value = parsed.exportsProperty?.initializer;
	if (value === undefined) return null;
	if (ts.isStringLiteral(value))
		return isUnicodeScalarString(value.text)
			? null
			: issue(
					'INPUT_INVALID',
					'Decoded export target strings must contain Unicode scalar text.',
					'$manifest.exports'
				);
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
		return isUnicodeScalarString(exactProperty.initializer.text)
			? null
			: issue(
					'INPUT_INVALID',
					'Decoded export target strings must contain Unicode scalar text.',
					'$manifest.exports'
				);
	if (!ts.isObjectLiteralExpression(exactProperty.initializer)) return null;
	const pending: ts.ObjectLiteralExpression[] = [exactProperty.initializer];
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
			issue('SHAPE_INVALID', 'The conditional-export resolution snapshot shell must be exact.')
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
	const inputs = inputsValue as ConditionalExportResolutionBuildInputs;
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
	const bindingIssue = inputBindingIssue(inputs);
	if (bindingIssue !== null) return invalid(bindingIssue);
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
