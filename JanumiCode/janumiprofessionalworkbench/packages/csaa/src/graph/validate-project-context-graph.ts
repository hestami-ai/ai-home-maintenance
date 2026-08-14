import { createHash } from 'node:crypto';

import {
	PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER,
	PROJECT_CONTEXT_GRAPH_CANONICAL_PROFILE,
	PROJECT_CONTEXT_GRAPH_CAPABILITY,
	PROJECT_CONTEXT_GRAPH_CAPABILITY_STATUS,
	PROJECT_CONTEXT_GRAPH_CURRENTNESS,
	PROJECT_CONTEXT_GRAPH_FRESHNESS,
	PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE,
	PROJECT_CONTEXT_GRAPH_GATE_EFFECT,
	PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY,
	PROJECT_CONTEXT_GRAPH_METHOD,
	PROJECT_CONTEXT_GRAPH_NONCLAIMS,
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type ProjectContextGraphBuildInputs,
	type ProjectContextGraphId,
	type ProjectContextGraphSnapshot,
	type ProjectContextGraphValidationIssue,
	type ProjectContextGraphValidationOptions,
	type ProjectContextGraphValidationResult,
	type ProjectContextMembership,
	type ProjectContextMembershipId,
	type ProjectContextProgramId,
	type ProjectContextProgramRecord,
	type ProjectContextProjectId,
	type ProjectContextProjectRecord,
	type ProjectContextReferenceId,
	type ProjectContextSourceId,
	type ProjectContextSourceRecord
} from '../contracts/project-context-graph.js';
import { compareText } from '../inventory/canonical.js';
import { isProxyValue, isUnicodeScalarString } from '../semantic/canonical.js';
import { validateStaticSemanticSnapshot } from '../semantic/validate-snapshot.js';
import { isFrozenSubjectCapability } from '../subject/frozen-store.js';

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

const INPUT_KEYS = ['frozenSubject', 'request', 'semanticSnapshot'] as const;
const REQUEST_KEYS = [
	'budgets',
	'operationVersion',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxConfigurationClosureRecords',
	'maxDiagnostics',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxMemberships',
	'maxOutputRecords',
	'maxPrograms',
	'maxProjectReferences',
	'maxProjects',
	'maxSources',
	'maxTraversalSteps'
] as const;
const SELECTION_KEYS = [
	'effectiveConfigurationPolicy',
	'membershipRelations',
	'programPopulation',
	'projectPopulation',
	'projectReferencePopulation',
	'referenceResolutionBasis',
	'sourcePopulation',
	'variantPolicy'
] as const;
const SNAPSHOT_KEYS = [
	'authorityTransfer',
	'budgets',
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'closure',
	'contentDigest',
	'coverage',
	'currentness',
	'freshness',
	'fullJanCsaa010Conformance',
	'gateEffect',
	'graphAuthority',
	'health',
	'id',
	'inputDigest',
	'memberships',
	'method',
	'nonclaims',
	'operationVersion',
	'outsideSelectedProjectReferences',
	'programs',
	'projectReferences',
	'projects',
	'resultCompleteness',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'semanticValidationWitness',
	'sources',
	'subjectId',
	'truncation',
	'unresolvedProjectReferences'
] as const;

function issue(
	code: ProjectContextGraphValidationIssue['code'],
	message: string,
	path = '$'
): ProjectContextGraphValidationIssue {
	return { code, message, path };
}

function invalid(problem: ProjectContextGraphValidationIssue): ProjectContextGraphValidationResult {
	return {
		issues: [problem],
		state: problem.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
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
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor;
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
	value: ProjectContextGraphValidationOptions | undefined
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
): ProjectContextGraphValidationIssue | null {
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
		let arrayLength: number | null = null;
		if (array) {
			const lengthDescriptor = Reflect.getOwnPropertyDescriptor(frame.value, 'length');
			arrayLength =
				lengthDescriptor !== undefined && 'value' in lengthDescriptor
					? (lengthDescriptor.value as number)
					: null;
			if (!Number.isSafeInteger(arrayLength) || arrayLength! < 0)
				return issue(malformedCode, 'Arrays must have a valid length.', frame.path);
			if (arrayLength! > limits.maxRecords - records)
				return issue(
					'BUDGET_EXHAUSTED',
					'The descriptor record budget was exhausted by an array population.',
					frame.path
				);
			if (keys.length !== arrayLength! + 1)
				return issue(malformedCode, 'Arrays must be dense ordinary arrays.', frame.path);
			if (
				keys.some((key) => {
					if (typeof key !== 'string') return true;
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
		for (const key of keys) {
			if (typeof key !== 'string' || (array && key === 'length')) continue;
			if (!isUnicodeScalarString(key))
				return issue(malformedCode, 'Property keys must contain Unicode scalar text.', frame.path);
			characters += key.length;
			if (characters > limits.maxStringCharacters)
				return issue(
					'BUDGET_EXHAUSTED',
					'The descriptor string-character budget was exhausted by a property key.',
					frame.path
				);
		}
		active.add(frame.value);
		pending.push({ state: 'LEAVE', value: frame.value });
		for (let index = keys.length - 1; index >= 0; index -= 1) {
			const key = keys[index] as string;
			if (array && key === 'length') continue;
			const descriptor = Reflect.getOwnPropertyDescriptor(frame.value, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
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

type IndependentCanonicalFrame =
	| {
			readonly state: 'ARRAY';
			readonly index: number;
			readonly length: number;
			readonly value: unknown[];
	  }
	| {
			readonly state: 'OBJECT';
			readonly entries: readonly (readonly [string, unknown])[];
			readonly index: number;
			readonly value: object;
	  }
	| { readonly state: 'VALUE'; readonly value: unknown };

/** Separate iterative canonical token stream used only by this validator. */
function* independentCanonicalChunks(value: unknown): Generator<string, void, undefined> {
	const active = new WeakSet<object>();
	const pending: IndependentCanonicalFrame[] = [{ state: 'VALUE', value }];
	while (pending.length > 0) {
		const frame = pending.pop()!;
		if (frame.state === 'ARRAY') {
			if (frame.index === frame.length) {
				yield ']';
				active.delete(frame.value);
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
				active.delete(frame.value);
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
		if (typeof input !== 'object') throw new TypeError('Canonical input must be JSON data.');
		if (isProxyValue(input) || active.has(input))
			throw new TypeError('Canonical input must be plain and acyclic.');
		active.add(input);
		if (Array.isArray(input)) {
			const length = Reflect.getOwnPropertyDescriptor(input, 'length')!.value as number;
			yield '[';
			pending.push({ index: 0, length, state: 'ARRAY', value: input });
			continue;
		}
		const entries = (Reflect.ownKeys(input) as string[])
			.sort(compareText)
			.map(
				(key) =>
					[key, Reflect.getOwnPropertyDescriptor(input, key)!.value] as readonly [string, unknown]
			);
		yield '{';
		pending.push({ entries, index: 0, state: 'OBJECT', value: input });
	}
}

type IndependentCanonicalWriter = (chunk: string) => void;

function independentWriteCanonicalJson(value: unknown, write: IndependentCanonicalWriter): void {
	for (const chunk of independentCanonicalChunks(value)) write(chunk);
}

function independentCanonicalSha256(value: unknown): string {
	const hash = createHash('sha256');
	let buffered: string[] = [];
	let bufferedBytes = 0;
	const flush = (): void => {
		if (buffered.length === 0) return;
		hash.update(buffered.join(''), 'utf8');
		buffered = [];
		bufferedBytes = 0;
	};
	independentWriteCanonicalJson(value, (chunk) => {
		const chunkBytes = Buffer.byteLength(chunk, 'utf8');
		if (chunkBytes >= 64 * 1024) {
			flush();
			hash.update(chunk, 'utf8');
			return;
		}
		if (bufferedBytes + chunkBytes > 64 * 1024 || buffered.length >= 1_024) flush();
		buffered.push(chunk);
		bufferedBytes += chunkBytes;
	});
	flush();
	return hash.digest('hex');
}

function independentCanonicalEqual(left: unknown, right: unknown): boolean {
	const leftChunks = independentCanonicalChunks(left);
	const rightChunks = independentCanonicalChunks(right);
	while (true) {
		const leftChunk = leftChunks.next();
		const rightChunk = rightChunks.next();
		if (leftChunk.done || rightChunk.done)
			return leftChunk.done === true && rightChunk.done === true;
		if (leftChunk.value !== rightChunk.value) return false;
	}
}

function independentId<Kind extends string>(prefix: string, preimage: unknown): Kind {
	return `${prefix}-${independentCanonicalSha256(preimage)}` as Kind;
}

function independentInputDigest(inputs: ProjectContextGraphBuildInputs): string {
	return independentCanonicalSha256([
		'project-context-graph-input',
		PROJECT_CONTEXT_GRAPH_SCHEMA_VERSION,
		PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
		PROJECT_CONTEXT_GRAPH_CANONICAL_PROFILE,
		PROJECT_CONTEXT_GRAPH_METHOD,
		inputs.request,
		inputs.frozenSubject,
		inputs.semanticSnapshot
	]);
}

function independentGraphId(inputDigest: string): ProjectContextGraphId {
	return independentId<ProjectContextGraphId>('project-context-graph', [
		'project-context-graph',
		inputDigest
	]);
}

function independentProjectId(
	graphId: ProjectContextGraphId,
	semanticProjectId: string
): ProjectContextProjectId {
	return independentId<ProjectContextProjectId>('project-context-project', [
		graphId,
		semanticProjectId
	]);
}

function independentProgramId(
	graphId: ProjectContextGraphId,
	semanticProgramId: string
): ProjectContextProgramId {
	return independentId<ProjectContextProgramId>('project-context-program', [
		graphId,
		semanticProgramId
	]);
}

function independentSourceId(
	graphId: ProjectContextGraphId,
	semanticSourceId: string
): ProjectContextSourceId {
	return independentId<ProjectContextSourceId>('project-context-source', [
		graphId,
		semanticSourceId
	]);
}

function independentMembershipId(
	graphId: ProjectContextGraphId,
	kind: 'PROGRAM_HAS_SOURCE' | 'PROJECT_HAS_PROGRAM',
	fromId: string,
	toId: string
): ProjectContextMembershipId {
	return independentId<ProjectContextMembershipId>('project-context-membership', [
		graphId,
		kind,
		fromId,
		toId
	]);
}

function independentReferenceId(
	graphId: ProjectContextGraphId,
	fromProjectId: ProjectContextProjectId,
	declaredTargetConfigPath: string
): ProjectContextReferenceId {
	return independentId<ProjectContextReferenceId>('project-context-reference', [
		graphId,
		fromProjectId,
		declaredTargetConfigPath
	]);
}

function independentContentDigest(value: ProjectContextGraphSnapshot): string {
	const content: Record<string, unknown> = {};
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string' || key === 'contentDigest') continue;
		content[key] = Reflect.getOwnPropertyDescriptor(value, key)!.value;
	}
	return independentCanonicalSha256(content);
}

function inputShellIssue(value: unknown): ProjectContextGraphValidationIssue | null {
	if (!plainRecord(value) || !exactKeys(value, INPUT_KEYS))
		return issue(
			'INPUT_INVALID',
			'The project-context input wrapper must be exact plain data.',
			'$inputs'
		);
	for (const key of INPUT_KEYS) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key)!;
		if (!plainRecord(descriptor.value))
			return issue('INPUT_INVALID', `${key} must be a plain data record.`, `$inputs.${key}`);
	}
	return null;
}

function requestIssue(
	inputs: ProjectContextGraphBuildInputs
): ProjectContextGraphValidationIssue | null {
	const { request } = inputs;
	if (
		!plainRecord(request) ||
		!exactKeys(request, REQUEST_KEYS) ||
		!plainRecord(request.budgets) ||
		!exactKeys(request.budgets, BUDGET_KEYS) ||
		!plainRecord(request.selection) ||
		!exactKeys(request.selection, SELECTION_KEYS) ||
		!Array.isArray(request.selection.membershipRelations)
	)
		return issue(
			'INPUT_INVALID',
			'The project-context request shell is not exact.',
			'$inputs.request'
		);
	if (
		BUDGET_KEYS.some((key) =>
			key === 'maxProjectReferences' || key === 'maxSources'
				? !safeNonnegative(request.budgets[key])
				: !safePositive(request.budgets[key])
		) ||
		request.budgets.maxDiagnostics > 100_000 ||
		request.schemaVersion !== PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION ||
		request.operationVersion !== PROJECT_CONTEXT_GRAPH_OPERATION_VERSION ||
		!independentCanonicalEqual(request.selection, PROJECT_CONTEXT_GRAPH_SELECTION)
	)
		return issue('INPUT_INVALID', 'Request constants or budgets are invalid.', '$inputs.request');
	if (
		typeof request.subjectId !== 'string' ||
		request.subjectId.length === 0 ||
		typeof request.semanticSnapshotId !== 'string' ||
		request.semanticSnapshotId.length === 0
	)
		return issue('INPUT_INVALID', 'Request identities are invalid.', '$inputs.request');
	return null;
}

function operationBudgetIssue(
	inputs: ProjectContextGraphBuildInputs
): ProjectContextGraphValidationIssue | null {
	const { frozenSubject, request, semanticSnapshot } = inputs;
	if (
		!Array.isArray(frozenSubject.projects) ||
		!Array.isArray(semanticSnapshot.projects) ||
		!Array.isArray(semanticSnapshot.programs) ||
		!Array.isArray(semanticSnapshot.sources)
	)
		return issue('INPUT_INVALID', 'Input populations must be arrays.', '$inputs');
	let configurationClosureRecords = 0;
	for (let index = 0; index < frozenSubject.projects.length; index += 1) {
		const project = frozenSubject.projects[index];
		if (!plainRecord(project) || !Array.isArray(project.configClosure))
			return issue(
				'INPUT_INVALID',
				'A frozen project configuration closure is invalid.',
				`$inputs.frozenSubject.projects[${index}].configClosure`
			);
		configurationClosureRecords += project.configClosure.length;
		if (!Number.isSafeInteger(configurationClosureRecords))
			return issue('BUDGET_EXHAUSTED', 'Configuration-closure counting overflowed.', '$inputs');
	}
	let references = 0;
	for (let index = 0; index < semanticSnapshot.projects.length; index += 1) {
		const project = semanticSnapshot.projects[index];
		if (!plainRecord(project) || !Array.isArray(project.projectReferences))
			return issue(
				'INPUT_INVALID',
				'A semantic project reference population is invalid.',
				`$inputs.semanticSnapshot.projects[${index}].projectReferences`
			);
		references += project.projectReferences.length;
		if (!Number.isSafeInteger(references))
			return issue('BUDGET_EXHAUSTED', 'Project-reference counting overflowed.', '$inputs');
	}
	const projects = semanticSnapshot.projects.length;
	const programs = semanticSnapshot.programs.length;
	const sources = semanticSnapshot.sources.length;
	const memberships = programs + sources;
	const chargedTraversal = projects + programs + sources + references + configurationClosureRecords;
	const outputRecords = 1 + projects + programs + sources + memberships + references;
	if (![memberships, chargedTraversal, outputRecords].every(Number.isSafeInteger))
		return issue('BUDGET_EXHAUSTED', 'Project-context population counting overflowed.', '$inputs');
	for (const [actual, maximum, path] of [
		[
			configurationClosureRecords,
			request.budgets.maxConfigurationClosureRecords,
			'$inputs.request.budgets.maxConfigurationClosureRecords'
		],
		[memberships, request.budgets.maxMemberships, '$inputs.request.budgets.maxMemberships'],
		[outputRecords, request.budgets.maxOutputRecords, '$inputs.request.budgets.maxOutputRecords'],
		[programs, request.budgets.maxPrograms, '$inputs.request.budgets.maxPrograms'],
		[
			references,
			request.budgets.maxProjectReferences,
			'$inputs.request.budgets.maxProjectReferences'
		],
		[projects, request.budgets.maxProjects, '$inputs.request.budgets.maxProjects'],
		[sources, request.budgets.maxSources, '$inputs.request.budgets.maxSources'],
		[
			chargedTraversal,
			request.budgets.maxTraversalSteps,
			'$inputs.request.budgets.maxTraversalSteps'
		]
	] as const) {
		if (actual > maximum)
			return issue('BUDGET_EXHAUSTED', `The operation budget at ${path} was exhausted.`, path);
	}
	return null;
}

function inputBindingIssue(
	inputs: ProjectContextGraphBuildInputs
): ProjectContextGraphValidationIssue | null {
	const { frozenSubject, request, semanticSnapshot } = inputs;
	if (!isFrozenSubjectCapability(frozenSubject))
		return issue(
			'INPUT_INVALID',
			'The frozen subject must retain its opaque frozen-byte capability.',
			'$inputs.frozenSubject'
		);
	if (
		!plainRecord(frozenSubject.descriptor) ||
		typeof frozenSubject.descriptor.subjectId !== 'string' ||
		typeof semanticSnapshot.subjectId !== 'string' ||
		typeof semanticSnapshot.id !== 'string'
	)
		return issue('INPUT_INVALID', 'Input identity records are malformed.', '$inputs');
	if (
		request.subjectId !== frozenSubject.descriptor.subjectId ||
		request.subjectId !== semanticSnapshot.subjectId ||
		request.semanticSnapshotId !== semanticSnapshot.id
	)
		return issue('INPUT_INVALID', 'Input identities do not bind exactly.', '$inputs.request');
	return null;
}

type Derivation =
	| { readonly graph: ProjectContextGraphSnapshot; readonly state: 'VALID' }
	| { readonly message: string; readonly path: string; readonly state: 'INVALID' };

function derive(inputs: ProjectContextGraphBuildInputs, knownInputDigest?: string): Derivation {
	const { frozenSubject, request, semanticSnapshot } = inputs;
	const inputDigest = independentInputDigest(inputs);
	if (knownInputDigest !== undefined && knownInputDigest !== inputDigest)
		return {
			message: 'The producer-supplied input digest does not reproduce from the exact inputs.',
			path: '$validationInput.inputDigest',
			state: 'INVALID'
		};
	const graphId = independentGraphId(inputDigest);
	const frozenByConfigPath = new Map(
		frozenSubject.projects.map((project) => [project.configPath, project])
	);
	const semanticProjectByConfigPath = new Map(
		semanticSnapshot.projects.map((project) => [project.configPath, project])
	);
	const projectIds = new Map(
		semanticSnapshot.projects.map((project) => [
			project.id,
			independentProjectId(graphId, project.id)
		])
	);
	const programIds = new Map(
		semanticSnapshot.programs.map((program) => [
			program.id,
			independentProgramId(graphId, program.id)
		])
	);
	const sourceIds = new Map(
		semanticSnapshot.sources.map((source) => [source.id, independentSourceId(graphId, source.id)])
	);
	const requireProjectId = (semanticId: string): ProjectContextProjectId | undefined =>
		projectIds.get(semanticId as never);
	const requireProgramId = (semanticId: string): ProjectContextProgramId | undefined =>
		programIds.get(semanticId as never);
	const requireSourceId = (semanticId: string): ProjectContextSourceId | undefined =>
		sourceIds.get(semanticId as never);

	const orderedSemanticProjects = [...semanticSnapshot.projects].sort((left, right) =>
		compareText(left.configPath, right.configPath)
	);
	const projects: ProjectContextProjectRecord[] = [];
	for (let ordinal = 0; ordinal < orderedSemanticProjects.length; ordinal += 1) {
		const project = orderedSemanticProjects[ordinal]!;
		const frozenProject = frozenByConfigPath.get(project.configPath);
		const id = requireProjectId(project.id);
		const programId = requireProgramId(project.programId);
		const mappedSourceIds = project.sourceIds.map((sourceId) => requireSourceId(sourceId));
		if (
			frozenProject === undefined ||
			id === undefined ||
			programId === undefined ||
			mappedSourceIds.some((sourceId) => sourceId === undefined)
		)
			return {
				message:
					'The project population does not reconcile to frozen project, program, and source identities.',
				path: '$inputs.semanticSnapshot.projects',
				state: 'INVALID'
			};
		projects.push({
			configurationClosure: frozenProject.configClosure,
			configPath: project.configPath,
			health: project.health,
			id,
			kind: project.kind,
			ordinal,
			partialityReasons: project.partialityReasons,
			programId,
			programRecipe: frozenProject.programRecipe,
			rootDisposition: project.rootDisposition,
			rootNames: project.rootNames,
			semanticProgramId: project.programId,
			semanticProjectId: project.id,
			sourceIds: mappedSourceIds as ProjectContextSourceId[]
		});
	}

	const orderedSemanticPrograms = [...semanticSnapshot.programs].sort((left, right) =>
		compareText(left.id, right.id)
	);
	const programs: ProjectContextProgramRecord[] = [];
	for (let ordinal = 0; ordinal < orderedSemanticPrograms.length; ordinal += 1) {
		const program = orderedSemanticPrograms[ordinal]!;
		const id = requireProgramId(program.id);
		const projectId = requireProjectId(program.projectId);
		const mappedSources = program.sourceIds.map((sourceId) => requireSourceId(sourceId));
		const mappedRoots = program.rootSourceIds.map((sourceId) => requireSourceId(sourceId));
		if (
			id === undefined ||
			projectId === undefined ||
			mappedSources.some((sourceId) => sourceId === undefined) ||
			mappedRoots.some((sourceId) => sourceId === undefined)
		)
			return {
				message: 'The program population does not reconcile to project and source identities.',
				path: '$inputs.semanticSnapshot.programs',
				state: 'INVALID'
			};
		programs.push({
			checkerState: program.checkerState,
			contextDigest: program.contextDigest,
			id,
			ordinal,
			projectId,
			rootSourceIds: mappedRoots as ProjectContextSourceId[],
			semanticProgramId: program.id,
			semanticProjectId: program.projectId,
			sourceIds: mappedSources as ProjectContextSourceId[]
		});
	}

	const orderedSemanticSources = [...semanticSnapshot.sources].sort((left, right) => {
		const programOrder = compareText(left.programId, right.programId);
		if (programOrder !== 0) return programOrder;
		const pathOrder = compareText(left.logicalPath, right.logicalPath);
		return pathOrder !== 0 ? pathOrder : compareText(left.id, right.id);
	});
	const sources: ProjectContextSourceRecord[] = [];
	for (let ordinal = 0; ordinal < orderedSemanticSources.length; ordinal += 1) {
		const source = orderedSemanticSources[ordinal]!;
		const id = requireSourceId(source.id);
		const programId = requireProgramId(source.programId);
		const projectId = requireProjectId(source.projectId);
		if (id === undefined || programId === undefined || projectId === undefined)
			return {
				message: 'The source population does not reconcile to project and program identities.',
				path: '$inputs.semanticSnapshot.sources',
				state: 'INVALID'
			};
		sources.push({
			analysisDisposition: source.analysisDisposition,
			declarationFile: source.declarationFile,
			id,
			logicalPath: source.logicalPath,
			ordinal,
			origin: source.origin,
			programId,
			projectId,
			rootFile: source.rootFile,
			semanticProgramId: source.programId,
			semanticProjectId: source.projectId,
			semanticSourceId: source.id
		});
	}

	type WithoutOrdinal<T> = T extends unknown ? Omit<T, 'ordinal'> : never;
	type MembershipSeed = {
		readonly fromId: string;
		readonly membership: WithoutOrdinal<ProjectContextMembership>;
		readonly toId: string;
	};
	const membershipSeeds: MembershipSeed[] = [];
	for (const program of programs)
		membershipSeeds.push({
			fromId: program.projectId,
			membership: {
				id: independentMembershipId(graphId, 'PROJECT_HAS_PROGRAM', program.projectId, program.id),
				kind: 'PROJECT_HAS_PROGRAM',
				programId: program.id,
				projectId: program.projectId
			},
			toId: program.id
		});
	for (const source of sources)
		membershipSeeds.push({
			fromId: source.programId,
			membership: {
				id: independentMembershipId(graphId, 'PROGRAM_HAS_SOURCE', source.programId, source.id),
				kind: 'PROGRAM_HAS_SOURCE',
				programId: source.programId,
				sourceId: source.id
			},
			toId: source.id
		});
	membershipSeeds.sort((left, right) => {
		const kindOrder = compareText(left.membership.kind, right.membership.kind);
		if (kindOrder !== 0) return kindOrder;
		const fromOrder = compareText(left.fromId, right.fromId);
		return fromOrder !== 0 ? fromOrder : compareText(left.toId, right.toId);
	});
	const memberships = membershipSeeds.map((seed, ordinal) => ({
		...seed.membership,
		ordinal
	})) as ProjectContextMembership[];

	type ReferenceSeed = Omit<ProjectContextGraphSnapshot['projectReferences'][number], 'ordinal'>;
	const referenceSeeds: (ReferenceSeed & { readonly fromConfigPath: string })[] = [];
	for (const project of orderedSemanticProjects) {
		const fromProjectId = requireProjectId(project.id)!;
		for (const declaredTargetConfigPath of project.projectReferences) {
			const targetProject = semanticProjectByConfigPath.get(declaredTargetConfigPath);
			const targetProjectId =
				targetProject === undefined ? undefined : requireProjectId(targetProject.id);
			if (targetProjectId === undefined)
				return {
					message:
						'Every declared project reference must resolve inside the validated selected project population.',
					path: '$inputs.semanticSnapshot.projects',
					state: 'INVALID'
				};
			referenceSeeds.push({
				declaredTargetConfigPath,
				fromConfigPath: project.configPath,
				fromProjectId,
				id: independentReferenceId(graphId, fromProjectId, declaredTargetConfigPath),
				resolution: 'RESOLVED_SELECTED_PROJECT',
				targetProjectId
			});
		}
	}
	referenceSeeds.sort((left, right) => {
		const fromOrder = compareText(left.fromConfigPath, right.fromConfigPath);
		return fromOrder !== 0
			? fromOrder
			: compareText(left.declaredTargetConfigPath, right.declaredTargetConfigPath);
	});
	const projectReferences = referenceSeeds.map((reference, ordinal) => ({ ...reference, ordinal }));
	const configurationClosureRecords = frozenSubject.projects.reduce(
		(count, project) => count + project.configClosure.length,
		0
	);
	const chargedInputTraversalSteps =
		projects.length +
		programs.length +
		sources.length +
		projectReferences.length +
		configurationClosureRecords;
	const coverage = {
		chargedInputTraversalSteps,
		configurationClosureRecords,
		declaredProjectReferences: projectReferences.length,
		inputPrograms: semanticSnapshot.programs.length,
		inputProjects: semanticSnapshot.projects.length,
		inputSources: semanticSnapshot.sources.length,
		memberships: memberships.length,
		outsideSelectedProjectReferences: 0 as const,
		programPopulationReconciles: true as const,
		programSourceMemberships: sources.length,
		projectPopulationReconciles: true as const,
		projectedPrograms: programs.length,
		projectedProjects: projects.length,
		projectedSources: sources.length,
		projectProgramMemberships: programs.length,
		referencePopulationReconciles: true as const,
		resolvedProjectReferences: projectReferences.length,
		sourcePopulationReconciles: true as const,
		unresolvedProjectReferences: 0 as const
	};
	const content = {
		authorityTransfer: PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER,
		budgets: request.budgets,
		canonicalProfile: PROJECT_CONTEXT_GRAPH_CANONICAL_PROFILE,
		capability: PROJECT_CONTEXT_GRAPH_CAPABILITY,
		capabilityStatus: PROJECT_CONTEXT_GRAPH_CAPABILITY_STATUS,
		closure: 'CLOSED_FOR_ALL_DECLARED_PROJECT_REFERENCES' as const,
		coverage,
		currentness: PROJECT_CONTEXT_GRAPH_CURRENTNESS,
		freshness: PROJECT_CONTEXT_GRAPH_FRESHNESS,
		fullJanCsaa010Conformance: PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE,
		gateEffect: PROJECT_CONTEXT_GRAPH_GATE_EFFECT,
		graphAuthority: PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY,
		health: 'PARTIAL' as const,
		id: graphId,
		inputDigest,
		memberships,
		method: PROJECT_CONTEXT_GRAPH_METHOD,
		nonclaims: PROJECT_CONTEXT_GRAPH_NONCLAIMS,
		operationVersion: PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
		outsideSelectedProjectReferences: [] as const,
		programs,
		projectReferences,
		projects,
		resultCompleteness: 'COMPLETE_FOR_VALIDATED_SELECTED_PROJECT_CONTEXT_POPULATIONS' as const,
		schemaVersion: PROJECT_CONTEXT_GRAPH_SCHEMA_VERSION,
		selection: PROJECT_CONTEXT_GRAPH_SELECTION,
		semanticSnapshotId: semanticSnapshot.id,
		semanticValidationWitness: {
			context: 'FROZEN_SUBJECT' as const,
			frozenSubjectSha256: independentCanonicalSha256(frozenSubject),
			method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT' as const,
			semanticSnapshotId: semanticSnapshot.id,
			semanticSnapshotSha256: independentCanonicalSha256(semanticSnapshot),
			state: 'VALID' as const,
			subjectId: frozenSubject.descriptor.subjectId
		},
		sources,
		subjectId: request.subjectId,
		truncation: { reason: null, state: 'NOT_TRUNCATED' as const },
		unresolvedProjectReferences: [] as const
	};
	const graph = { ...content, contentDigest: '' } as ProjectContextGraphSnapshot;
	return {
		graph: { ...content, contentDigest: independentContentDigest(graph) },
		state: 'VALID'
	};
}

function validateInternal(
	value: unknown,
	inputsValue: unknown,
	options: ProjectContextGraphValidationOptions | undefined,
	knownInputDigest?: string,
	predecessorValidated = false
): ProjectContextGraphValidationResult {
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
			issue('SHAPE_INVALID', 'The project-context graph snapshot shell must be exact.')
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
	const inputs = inputsValue as ProjectContextGraphBuildInputs;
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
	const budgetIssue = operationBudgetIssue(inputs);
	if (budgetIssue !== null) return invalid(budgetIssue);
	if (!predecessorValidated) {
		const semanticValidation = validateStaticSemanticSnapshot(
			inputs.semanticSnapshot,
			{
				maxDepth: 4_096,
				maxDiagnostics: inputs.request.budgets.maxDiagnostics,
				maxIssues: inputs.request.budgets.maxDiagnostics,
				maxRecords: inputs.request.budgets.maxInputRecords,
				maxReferenceChecks: inputs.request.budgets.maxInputRecords,
				maxStringCharacters: inputs.request.budgets.maxInputStringCharacters
			},
			{
				frozenSubject: inputs.frozenSubject
			}
		);
		if (semanticValidation.state !== 'VALID')
			return invalid(
				issue(
					semanticValidation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
					'The static semantic snapshot is not independently valid for the exact frozen subject.',
					'$inputs.semanticSnapshot'
				)
			);
	}
	const expected = derive(inputs, knownInputDigest);
	if (expected.state === 'INVALID')
		return invalid(issue('INPUT_INVALID', expected.message, expected.path));
	const candidate = value as unknown as ProjectContextGraphSnapshot;
	if (candidate.contentDigest !== independentContentDigest(candidate))
		return invalid(
			issue(
				'CONTENT_DIGEST_MISMATCH',
				'The project-context content digest is invalid.',
				'$.contentDigest'
			)
		);
	if (!independentCanonicalEqual(candidate, expected.graph))
		return invalid(
			issue(
				'POPULATION_MISMATCH',
				'The candidate differs from the independently derived project-context graph.'
			)
		);
	return { issues: [], state: 'VALID' };
}

export function validateProjectContextGraph(
	value: unknown,
	inputs: ProjectContextGraphBuildInputs,
	options?: ProjectContextGraphValidationOptions
): ProjectContextGraphValidationResult {
	if (arguments.length < 2 || arguments.length > 3)
		return invalid(
			issue('SHAPE_INVALID', 'The validator requires exactly two or three arguments.', '$arguments')
		);
	try {
		return validateInternal(value, inputs, options);
	} catch {
		return invalid(
			issue('SHAPE_INVALID', 'Project-context graph validation failed closed on hostile input.')
		);
	}
}

/**
 * Producer-internal path with a trusted precondition: the exact frozen subject and semantic
 * snapshot object graph must have validated successfully immediately before uninterrupted
 * synchronous construction. The known digest proves mutation/binding parity, not semantic
 * validity; callers without that predecessor-validation evidence must use the public validator.
 */
export function validateConstructedProjectContextGraph(
	value: unknown,
	inputs: ProjectContextGraphBuildInputs,
	knownInputDigest: string,
	options?: ProjectContextGraphValidationOptions
): ProjectContextGraphValidationResult {
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
			issue('SHAPE_INVALID', 'Constructed project-context graph validation failed closed.')
		);
	}
}
