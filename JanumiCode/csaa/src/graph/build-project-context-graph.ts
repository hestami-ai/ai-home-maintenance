import { isProxy } from 'node:util/types';

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
	PROJECT_CONTEXT_GRAPH_PROGRESS_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type BuildProjectContextGraphOptions,
	type ProjectContextGraphBuildInputs,
	type ProjectContextGraphBuildOutcome,
	type ProjectContextGraphCoverage,
	type ProjectContextGraphDiagnostic,
	type ProjectContextGraphProgressEvent,
	type ProjectContextGraphProgressPhase,
	type ProjectContextGraphRequest,
	type ProjectContextGraphSnapshot,
	type ProjectContextMembership,
	type ProjectContextProgramRecord,
	type ProjectContextProjectRecord,
	type ProjectContextSourceRecord
} from '../contracts/project-context-graph.js';
import { compareText } from '../inventory/canonical.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { validateStaticSemanticSnapshot } from '../semantic/validate-snapshot.js';
import { isFrozenSubjectCapability } from '../subject/frozen-store.js';
import {
	projectContextGraphContentDigest,
	projectContextGraphId,
	projectContextGraphInputDigest,
	projectContextMembershipId,
	projectContextProgramId,
	projectContextProjectId,
	projectContextReferenceId,
	projectContextSourceId,
	type ProjectContextGraphContent
} from './project-context-graph-canonical.js';
import { validateConstructedProjectContextGraph } from './validate-project-context-graph.js';

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

const ZERO_CAPACITY_BUDGET_KEYS = new Set<(typeof BUDGET_KEYS)[number]>([
	'maxProjectReferences',
	'maxSources'
]);
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

interface PlainDataUsage {
	readonly records: number;
	readonly stringCharacters: number;
}

interface TelemetryRecorder {
	complete(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	fail(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	finish<Outcome extends ProjectContextGraphBuildOutcome>(outcome: Outcome): Outcome;
	start(phase: ProjectContextGraphProgressPhase, counts?: Readonly<Record<string, number>>): void;
}

class ProjectContextFailure extends Error {
	constructor(
		readonly code: ProjectContextGraphDiagnostic['code'],
		message: string,
		readonly phase: ProjectContextGraphDiagnostic['phase'],
		readonly path: string | null = null
	) {
		super(message);
	}
}

function exactPlainRecord(
	value: unknown,
	keys: readonly string[],
	path: string
): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError(`${path} must be an exact plain data record.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${path} must have a plain prototype.`);
	const ownKeys = Reflect.ownKeys(value);
	if (
		ownKeys.length !== keys.length ||
		ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
	)
		throw new TypeError(`${path} field population is not exact.`);
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`${path}.${key} must be an enumerable data property.`);
	}
	return value as Record<string, unknown>;
}

function shallowPlainRecord(value: unknown, path: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError(`${path} must be a plain data record.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${path} must have a plain prototype.`);
	return value as Record<string, unknown>;
}

function assertOrdinaryArray(value: unknown, path: string): asserts value is unknown[] {
	if (!Array.isArray(value) || isProxy(value) || Reflect.getPrototypeOf(value) !== Array.prototype)
		throw new TypeError(`${path} must be an exact ordinary array.`);
}

function preflightLimits(value: unknown): {
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
} {
	const inputs = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const request = exactPlainRecord(inputs.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(request.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	for (const key of ['maxInputRecords', 'maxInputStringCharacters'] as const)
		if (!Number.isSafeInteger(budgets[key]) || (budgets[key] as number) < 1)
			throw new TypeError(`$inputs.request.budgets.${key} must be a positive safe integer.`);
	return {
		maxInputRecords: budgets.maxInputRecords as number,
		maxInputStringCharacters: budgets.maxInputStringCharacters as number
	};
}

type PlainDataWork =
	| { readonly kind: 'LEAVE'; readonly value: object }
	| { readonly kind: 'VISIT'; readonly value: unknown };

interface PlainDataLimits {
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
}

interface PlainDataCounters {
	records: number;
	stringCharacters: number;
}

function chargeInputRecord(counters: PlainDataCounters, limits: PlainDataLimits): void {
	counters.records += 1;
	if (counters.records > limits.maxInputRecords)
		throw new ProjectContextFailure(
			'BUDGET_EXCEEDED',
			`Input plain-data record budget exceeded: ${counters.records} > ${limits.maxInputRecords}.`,
			'REQUEST',
			'$.request.budgets.maxInputRecords'
		);
}

function requireInputRecordCapacity(
	projected: number,
	limits: PlainDataLimits,
	message: string
): void {
	if (projected > limits.maxInputRecords)
		throw new ProjectContextFailure(
			'BUDGET_EXCEEDED',
			message,
			'REQUEST',
			'$.request.budgets.maxInputRecords'
		);
}

function chargeInputStringCharacters(
	counters: PlainDataCounters,
	length: number,
	limits: PlainDataLimits
): void {
	counters.stringCharacters += length;
	if (counters.stringCharacters > limits.maxInputStringCharacters)
		throw new ProjectContextFailure(
			'BUDGET_EXCEEDED',
			`Input string-character budget exceeded: ${counters.stringCharacters} > ${limits.maxInputStringCharacters}.`,
			'REQUEST',
			'$.request.budgets.maxInputStringCharacters'
		);
}

function chargeInputString(
	text: string,
	counters: PlainDataCounters,
	limits: PlainDataLimits
): void {
	if (!isUnicodeScalarString(text))
		throw new TypeError('Input strings must contain Unicode scalar text.');
	chargeInputStringCharacters(counters, text.length, limits);
}

function isInertPlainDataScalar(value: unknown): boolean {
	return (
		value === null ||
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0))
	);
}

function chargeInputArrayIndexKeys(
	ownKeys: readonly string[],
	counters: PlainDataCounters,
	limits: PlainDataLimits
): void {
	for (const key of ownKeys) {
		if (key === 'length') continue;
		chargeInputStringCharacters(counters, key.length, limits);
		if (!isUnicodeScalarString(key))
			throw new TypeError('Input array keys must contain Unicode scalar text.');
	}
}

function requireDenseInputArrayKeys(ownKeys: readonly string[], count: number): void {
	if (
		ownKeys.length !== count + 1 ||
		ownKeys.some((key) => key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key))
	)
		throw new TypeError('Input arrays must be dense exact data arrays.');
}

function expandInputArray(
	value: readonly unknown[],
	pending: PlainDataWork[],
	counters: PlainDataCounters,
	limits: PlainDataLimits
): void {
	if (Reflect.getPrototypeOf(value) !== Array.prototype)
		throw new TypeError('Input arrays must use Array.prototype.');
	const count = value.length;
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.some((key) => typeof key !== 'string'))
		throw new TypeError('Input arrays may not contain symbol keys.');
	chargeInputArrayIndexKeys(ownKeys as string[], counters, limits);
	requireDenseInputArrayKeys(ownKeys as string[], count);
	requireInputRecordCapacity(
		counters.records + count,
		limits,
		'Input array population exceeds the plain-data record budget.'
	);
	for (let index = count - 1; index >= 0; index -= 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError('Input arrays must contain enumerable data elements.');
		pending.push({ kind: 'VISIT', value: descriptor.value });
	}
}

function expandInputRecord(
	value: object,
	pending: PlainDataWork[],
	counters: PlainDataCounters,
	limits: PlainDataLimits
): void {
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError('Input records must use a plain prototype.');
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.some((key) => typeof key !== 'string'))
		throw new TypeError('Input records may not contain symbol keys.');
	requireInputRecordCapacity(
		counters.records + ownKeys.length,
		limits,
		'Input property population exceeds the plain-data record budget.'
	);
	for (const key of [...(ownKeys as string[])].reverse()) {
		chargeInputStringCharacters(counters, key.length, limits);
		if (!isUnicodeScalarString(key))
			throw new TypeError('Input record keys must contain Unicode scalar text.');
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError('Input records must contain enumerable data properties.');
		pending.push({ kind: 'VISIT', value: descriptor.value });
	}
}

function visitPlainDataValue(
	value: unknown,
	pending: PlainDataWork[],
	active: WeakSet<object>,
	counters: PlainDataCounters,
	limits: PlainDataLimits
): void {
	if (typeof value === 'string') {
		chargeInputString(value, counters, limits);
		return;
	}
	if (isInertPlainDataScalar(value)) return;
	if (typeof value !== 'object' || value === null || isProxy(value))
		throw new TypeError('Input must contain only inert JSON-compatible plain data.');
	if (active.has(value)) throw new TypeError('Input plain data may not contain cycles.');
	active.add(value);
	pending.push({ kind: 'LEAVE', value });
	if (Array.isArray(value)) expandInputArray(value, pending, counters, limits);
	else expandInputRecord(value, pending, counters, limits);
}

function preflightPlainData(
	value: unknown,
	limits: { readonly maxInputRecords: number; readonly maxInputStringCharacters: number }
): PlainDataUsage {
	const pending: PlainDataWork[] = [{ kind: 'VISIT', value }];
	const active = new WeakSet<object>();
	const counters: PlainDataCounters = { records: 0, stringCharacters: 0 };
	while (pending.length > 0) {
		const work = pending.pop()!;
		if (work.kind === 'LEAVE') {
			active.delete(work.value);
			continue;
		}
		chargeInputRecord(counters, limits);
		visitPlainDataValue(work.value, pending, active, counters, limits);
	}
	return { records: counters.records, stringCharacters: counters.stringCharacters };
}

function exactJson(value: unknown, expected: unknown, path: string): void {
	if (canonicalSemanticJson(value) !== canonicalSemanticJson(expected))
		throw new TypeError(`${path} does not match the exact supported value.`);
}

function requireExactBudgetPopulation(budgets: Record<string, unknown>): void {
	for (const key of BUDGET_KEYS) {
		const budget = budgets[key];
		const minimum = ZERO_CAPACITY_BUDGET_KEYS.has(key) ? 0 : 1;
		if (!Number.isSafeInteger(budget) || Object.is(budget, -0) || (budget as number) < minimum)
			throw new TypeError(
				`$inputs.request.budgets.${key} must be a ${minimum === 0 ? 'nonnegative' : 'positive'} safe integer.`
			);
	}
	if ((budgets.maxDiagnostics as number) < 1 || (budgets.maxDiagnostics as number) > 100_000)
		throw new TypeError(
			'$inputs.request.budgets.maxDiagnostics must be positive and no greater than 100000.'
		);
}

function requireSupportedRequestIdentity(request: Record<string, unknown>): void {
	for (const key of [
		'operationVersion',
		'schemaVersion',
		'semanticSnapshotId',
		'subjectId'
	] as const)
		if (typeof request[key] !== 'string' || request[key] === '')
			throw new TypeError(`$inputs.request.${key} must be nonempty text.`);
	if (request.schemaVersion !== PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported project-context graph request schema version.');
	if (request.operationVersion !== PROJECT_CONTEXT_GRAPH_OPERATION_VERSION)
		throw new TypeError('Unsupported project-context graph operation version.');
}

function requireOrdinaryPopulationArrays(
	subject: Record<string, unknown>,
	snapshot: Record<string, unknown>
): void {
	for (const [path, record, keys] of [
		['$inputs.frozenSubject', subject, ['artifacts', 'projects', 'workspaces']],
		['$inputs.semanticSnapshot', snapshot, ['programs', 'projects', 'sources']]
	] as const)
		for (const key of keys) assertOrdinaryArray(record[key], `${path}.${key}`);
}

function materializeInputs(value: unknown): ProjectContextGraphBuildInputs {
	const inputs = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const request = exactPlainRecord(inputs.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(request.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	requireExactBudgetPopulation(budgets);
	requireSupportedRequestIdentity(request);
	const selection = exactPlainRecord(
		request.selection,
		SELECTION_KEYS,
		'$inputs.request.selection'
	);
	assertOrdinaryArray(
		selection.membershipRelations,
		'$inputs.request.selection.membershipRelations'
	);
	exactJson(selection, PROJECT_CONTEXT_GRAPH_SELECTION, '$inputs.request.selection');
	const subject = shallowPlainRecord(inputs.frozenSubject, '$inputs.frozenSubject');
	const snapshot = shallowPlainRecord(inputs.semanticSnapshot, '$inputs.semanticSnapshot');
	requireOrdinaryPopulationArrays(subject, snapshot);
	return {
		frozenSubject: inputs.frozenSubject as ProjectContextGraphBuildInputs['frozenSubject'],
		request: {
			...(request as unknown as ProjectContextGraphRequest),
			budgets: { ...(budgets as unknown as ProjectContextGraphRequest['budgets']) },
			selection: PROJECT_CONTEXT_GRAPH_SELECTION
		},
		semanticSnapshot: inputs.semanticSnapshot as ProjectContextGraphBuildInputs['semanticSnapshot']
	};
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
	const object = value as object;
	if (seen.has(object)) return value;
	seen.add(object);
	for (const key of Reflect.ownKeys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function clonePlainData<Value>(value: Value, seen = new WeakMap<object, unknown>()): Value {
	if (value === null || typeof value !== 'object') return value;
	const object = value as object;
	const previous = seen.get(object);
	if (previous !== undefined) return previous as Value;
	if (Array.isArray(value)) {
		const result: unknown[] = [];
		seen.set(object, result);
		for (const item of value) result.push(clonePlainData(item, seen));
		return result as Value;
	}
	const result: Record<string, unknown> = {};
	seen.set(object, result);
	for (const key of Object.keys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor === undefined || !('value' in descriptor)) continue;
		Object.defineProperty(result, key, {
			configurable: true,
			enumerable: true,
			value: clonePlainData(descriptor.value, seen),
			writable: true
		});
	}
	return result as Value;
}

function boundedCounts(counts: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
	const result: Record<string, number> = {};
	for (const key of Object.keys(counts).sort(compareText).slice(0, 16)) {
		const value = counts[key];
		if (Number.isSafeInteger(value) && value! >= 0) result[key] = value!;
	}
	return Object.freeze(result);
}

function telemetry(options: BuildProjectContextGraphOptions | undefined): TelemetryRecorder {
	let sink: ((event: ProjectContextGraphProgressEvent) => void) | undefined;
	try {
		if (options !== undefined) {
			const record = exactPlainRecord(options, ['onProgress'], '$options');
			if (typeof record.onProgress === 'function')
				sink = record.onProgress as (event: ProjectContextGraphProgressEvent) => void;
		}
	} catch {
		// Telemetry is out of band and never changes evidence or outcome.
	}
	const events: ProjectContextGraphProgressEvent[] = [];
	let active: ProjectContextGraphProgressPhase | null = null;
	let sequence = 0;
	const emit = (
		phase: ProjectContextGraphProgressPhase,
		state: ProjectContextGraphProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				counts: boundedCounts(counts),
				detailCode,
				phase,
				schemaVersion: PROJECT_CONTEXT_GRAPH_PROGRESS_SCHEMA_VERSION,
				sequence: sequence++,
				state
			})
		);
	};
	const close = (
		state: ProjectContextGraphProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		if (active === null) return;
		emit(active, state, counts, detailCode);
		active = null;
	};
	return {
		complete(counts = {}, detailCode = null): void {
			close('COMPLETED', counts, detailCode);
		},
		fail(counts = {}, detailCode = null): void {
			close('FAILED', counts, detailCode);
		},
		finish<Outcome extends ProjectContextGraphBuildOutcome>(outcome: Outcome): Outcome {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			const frozen = deepFreeze(outcome);
			if (sink !== undefined) {
				const frozenEvents = Object.freeze([...events]);
				queueMicrotask(() => {
					for (const event of frozenEvents)
						try {
							sink!(event);
						} catch {
							// Deferred observer failures are isolated.
						}
				});
			}
			return frozen;
		},
		start(phase, counts = {}): void {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			active = phase;
			emit(phase, 'STARTED', counts, null);
		}
	};
}

function unavailable(
	code: ProjectContextGraphDiagnostic['code'],
	message: string,
	phase: ProjectContextGraphDiagnostic['phase'],
	path: string | null = null
): ProjectContextGraphBuildOutcome {
	return { diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' };
}

function checkedAdd(...values: readonly number[]): number {
	let total = 0;
	for (const value of values) {
		total += value;
		if (!Number.isSafeInteger(total))
			throw new ProjectContextFailure(
				'BUDGET_EXCEEDED',
				'An operation population exceeds the safe-integer range.',
				'REQUEST'
			);
	}
	return total;
}

function saturatedMultiply(left: number, right: number): number {
	if (left === 0 || right === 0) return 0;
	return left > Math.floor(Number.MAX_SAFE_INTEGER / right)
		? Number.MAX_SAFE_INTEGER
		: left * right;
}

function saturatedAdd(left: number, right: number): number {
	return left > Number.MAX_SAFE_INTEGER - right ? Number.MAX_SAFE_INTEGER : left + right;
}

function compareTuple(left: readonly string[], right: readonly string[]): number {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const order = compareText(left[index] ?? '', right[index] ?? '');
		if (order !== 0) return order;
	}
	return 0;
}

function populationCounts(inputs: ProjectContextGraphBuildInputs): {
	readonly configurationClosureRecords: number;
	readonly memberships: number;
	readonly outputRecords: number;
	readonly programs: number;
	readonly projectReferences: number;
	readonly projects: number;
	readonly sources: number;
	readonly traversalSteps: number;
} {
	const projects = inputs.semanticSnapshot.projects.length;
	const programs = inputs.semanticSnapshot.programs.length;
	const sources = inputs.semanticSnapshot.sources.length;
	const projectReferences = inputs.semanticSnapshot.projects.reduce(
		(total, project) => checkedAdd(total, project.projectReferences.length),
		0
	);
	const configurationClosureRecords = inputs.frozenSubject.projects.reduce(
		(total, project) => checkedAdd(total, project.configClosure.length),
		0
	);
	const memberships = checkedAdd(programs, sources);
	return {
		configurationClosureRecords,
		memberships,
		outputRecords: checkedAdd(1, projects, programs, sources, memberships, projectReferences),
		programs,
		projectReferences,
		projects,
		sources,
		traversalSteps: checkedAdd(
			projects,
			programs,
			sources,
			projectReferences,
			configurationClosureRecords
		)
	};
}

function enforcePopulationBudgets(
	request: ProjectContextGraphRequest,
	counts: ReturnType<typeof populationCounts>
): void {
	const checks = [
		['maxConfigurationClosureRecords', counts.configurationClosureRecords],
		['maxMemberships', counts.memberships],
		['maxOutputRecords', counts.outputRecords],
		['maxPrograms', counts.programs],
		['maxProjectReferences', counts.projectReferences],
		['maxProjects', counts.projects],
		['maxSources', counts.sources],
		['maxTraversalSteps', counts.traversalSteps]
	] as const;
	for (const [budget, actual] of checks)
		if (actual > request.budgets[budget])
			throw new ProjectContextFailure(
				'BUDGET_EXCEEDED',
				`${budget} is ${request.budgets[budget]}, but the exact required population is ${actual}.`,
				'REQUEST',
				`$.request.budgets.${budget}`
			);
}

function projectRecords(
	inputs: ProjectContextGraphBuildInputs,
	graphId: ProjectContextGraphSnapshot['id']
): {
	readonly programs: ProjectContextProgramRecord[];
	readonly projectIdBySemanticId: ReadonlyMap<string, ProjectContextProjectRecord['id']>;
	readonly projects: ProjectContextProjectRecord[];
	readonly sourceIdBySemanticId: ReadonlyMap<string, ProjectContextSourceRecord['id']>;
	readonly sources: ProjectContextSourceRecord[];
} {
	const snapshot = inputs.semanticSnapshot;
	const frozenProjectByConfigPath = new Map(
		inputs.frozenSubject.projects.map((project) => [project.configPath, project])
	);
	const projectIdBySemanticId = new Map(
		snapshot.projects.map((project) => [project.id, projectContextProjectId(graphId, project.id)])
	);
	const programIdBySemanticId = new Map(
		snapshot.programs.map((program) => [program.id, projectContextProgramId(graphId, program.id)])
	);
	const sourceIdBySemanticId = new Map(
		snapshot.sources.map((source) => [source.id, projectContextSourceId(graphId, source.id)])
	);
	const requireProjectId = (
		semanticId: ProjectContextProjectRecord['semanticProjectId']
	): ProjectContextProjectRecord['id'] => projectIdBySemanticId.get(semanticId)!;
	const requireProgramId = (
		semanticId: ProjectContextProgramRecord['semanticProgramId']
	): ProjectContextProgramRecord['id'] => programIdBySemanticId.get(semanticId)!;
	const requireSourceId = (
		semanticId: ProjectContextSourceRecord['semanticSourceId']
	): ProjectContextSourceRecord['id'] => sourceIdBySemanticId.get(semanticId)!;
	const sortedProjects = [...snapshot.projects].sort((left, right) =>
		compareText(left.configPath, right.configPath)
	);
	const projects = sortedProjects.map((project, ordinal): ProjectContextProjectRecord => {
		const frozenProject = frozenProjectByConfigPath.get(project.configPath)!;
		return {
			configurationClosure: clonePlainData(frozenProject.configClosure),
			configPath: project.configPath,
			health: project.health,
			id: requireProjectId(project.id),
			kind: project.kind,
			ordinal,
			partialityReasons: clonePlainData(project.partialityReasons),
			programId: requireProgramId(project.programId),
			programRecipe: clonePlainData(project.programRecipe),
			rootDisposition: project.rootDisposition,
			rootNames: [...project.rootNames],
			semanticProgramId: project.programId,
			semanticProjectId: project.id,
			sourceIds: project.sourceIds.map(requireSourceId)
		};
	});
	const sortedPrograms = [...snapshot.programs].sort((left, right) =>
		compareText(left.id, right.id)
	);
	const programs = sortedPrograms.map((program, ordinal): ProjectContextProgramRecord => ({
		checkerState: program.checkerState,
		contextDigest: program.contextDigest,
		id: requireProgramId(program.id),
		ordinal,
		projectId: requireProjectId(program.projectId),
		rootSourceIds: program.rootSourceIds.map(requireSourceId),
		semanticProgramId: program.id,
		semanticProjectId: program.projectId,
		sourceIds: program.sourceIds.map(requireSourceId)
	}));
	const sortedSources = [...snapshot.sources].sort((left, right) =>
		compareTuple(
			[left.programId, left.logicalPath, left.id],
			[right.programId, right.logicalPath, right.id]
		)
	);
	const sources = sortedSources.map((source, ordinal): ProjectContextSourceRecord => ({
		analysisDisposition: source.analysisDisposition,
		declarationFile: source.declarationFile,
		id: requireSourceId(source.id),
		logicalPath: source.logicalPath,
		ordinal,
		origin: clonePlainData(source.origin),
		programId: requireProgramId(source.programId),
		projectId: requireProjectId(source.projectId),
		rootFile: source.rootFile,
		semanticProgramId: source.programId,
		semanticProjectId: source.projectId,
		semanticSourceId: source.id
	}));
	return { programs, projectIdBySemanticId, projects, sourceIdBySemanticId, sources };
}

function membershipEndpoints(membership: ProjectContextMembership): readonly string[] {
	return membership.kind === 'PROJECT_HAS_PROGRAM'
		? [membership.projectId, membership.programId]
		: [membership.programId, membership.sourceId];
}

function requireValidSemanticSnapshot(
	validation: ReturnType<typeof validateStaticSemanticSnapshot>
): void {
	if (validation.state === 'VALID') return;
	throw new ProjectContextFailure(
		validation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'SEMANTIC_SNAPSHOT_INVALID',
		validation.state === 'BUDGET_EXHAUSTED'
			? 'Independent semantic snapshot validation exhausted a request budget.'
			: 'The semantic snapshot is not valid against the exact FrozenSubject.',
		'VALIDATE',
		validation.issues[0]?.path ?? null
	);
}

function requireValidConstructedGraph(
	validation: ReturnType<typeof validateConstructedProjectContextGraph>
): void {
	if (validation.state === 'VALID') return;
	throw new ProjectContextFailure(
		validation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'GRAPH_VALIDATION_FAILED',
		validation.state === 'BUDGET_EXHAUSTED'
			? 'Independent project-context graph validation exhausted a construction budget.'
			: 'The constructed project-context graph failed independent validation.',
		'VALIDATE',
		validation.issues[0]?.path ?? null
	);
}

export function buildProjectContextGraph(
	inputsValue: unknown,
	options?: BuildProjectContextGraphOptions
): ProjectContextGraphBuildOutcome {
	const progress = telemetry(options);
	try {
		progress.start('REQUEST_BIND');
		const limits = preflightLimits(inputsValue);
		const usage = preflightPlainData(inputsValue, limits);
		const inputs = materializeInputs(inputsValue);
		if (!isFrozenSubjectCapability(inputs.frozenSubject))
			throw new ProjectContextFailure(
				'REQUEST_INVALID',
				'An attached FrozenSubject capability is required.',
				'BIND',
				'$.frozenSubject'
			);
		if (
			inputs.request.subjectId !== inputs.frozenSubject.descriptor.subjectId ||
			inputs.request.subjectId !== inputs.semanticSnapshot.subjectId ||
			inputs.request.semanticSnapshotId !== inputs.semanticSnapshot.id
		)
			throw new ProjectContextFailure(
				'INPUT_IDENTITY_MISMATCH',
				'Request, FrozenSubject, and semantic snapshot identities do not agree.',
				'BIND'
			);
		progress.complete({
			inputRecords: usage.records,
			inputStringCharacters: usage.stringCharacters
		});

		progress.start('INPUT_BUDGET');
		const counts = populationCounts(inputs);
		enforcePopulationBudgets(inputs.request, counts);
		progress.complete({
			configurationClosureRecords: counts.configurationClosureRecords,
			inputPrograms: counts.programs,
			inputProjects: counts.projects,
			inputSources: counts.sources,
			projectReferences: counts.projectReferences,
			traversalSteps: counts.traversalSteps
		});

		progress.start('SEMANTIC_SNAPSHOT_VALIDATE');
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
			{ frozenSubject: inputs.frozenSubject }
		);
		requireValidSemanticSnapshot(semanticValidation);
		const frozenSubjectWitness = canonicalSemanticJsonWitness(inputs.frozenSubject);
		const semanticSnapshotWitness = canonicalSemanticJsonWitness(inputs.semanticSnapshot);
		progress.complete({ validationIssues: 0 });

		const inputDigest = projectContextGraphInputDigest(inputs);
		const graphId = projectContextGraphId(inputDigest);
		progress.start('PROJECT_CONTEXT_PROJECT');
		const projected = projectRecords(inputs, graphId);
		progress.complete({
			programs: projected.programs.length,
			projects: projected.projects.length,
			sources: projected.sources.length
		});

		progress.start('REFERENCE_RESOLUTION');
		const projectByConfigPath = new Map(
			projected.projects.map((project) => [project.configPath, project])
		);
		const references = inputs.semanticSnapshot.projects
			.flatMap((project) =>
				project.projectReferences.map((declaredTargetConfigPath) => {
					const fromProjectId = projected.projectIdBySemanticId.get(project.id)!;
					const target = projectByConfigPath.get(declaredTargetConfigPath)!;
					return {
						declaredTargetConfigPath,
						fromConfigPath: project.configPath,
						fromProjectId,
						id: projectContextReferenceId(graphId, fromProjectId, declaredTargetConfigPath),
						ordinal: -1,
						resolution: 'RESOLVED_SELECTED_PROJECT' as const,
						targetProjectId: target.id
					};
				})
			)
			.sort((left, right) =>
				compareTuple(
					[left.fromConfigPath, left.declaredTargetConfigPath],
					[right.fromConfigPath, right.declaredTargetConfigPath]
				)
			)
			.map((reference, ordinal) => ({ ...reference, ordinal }));
		progress.complete({ resolvedProjectReferences: references.length });

		progress.start('MEMBERSHIP_PROJECT');
		const memberships: ProjectContextMembership[] = [
			...projected.programs.map((program) => ({
				id: projectContextMembershipId(
					graphId,
					'PROJECT_HAS_PROGRAM',
					program.projectId,
					program.id
				),
				kind: 'PROJECT_HAS_PROGRAM' as const,
				ordinal: -1,
				programId: program.id,
				projectId: program.projectId
			})),
			...projected.sources.map((source) => ({
				id: projectContextMembershipId(graphId, 'PROGRAM_HAS_SOURCE', source.programId, source.id),
				kind: 'PROGRAM_HAS_SOURCE' as const,
				ordinal: -1,
				programId: source.programId,
				sourceId: source.id
			}))
		].sort((left, right) =>
			compareTuple(
				[left.kind, ...membershipEndpoints(left)],
				[right.kind, ...membershipEndpoints(right)]
			)
		);
		const orderedMemberships = memberships.map((membership, ordinal) => ({
			...membership,
			ordinal
		})) as ProjectContextMembership[];
		progress.complete({ memberships: orderedMemberships.length });

		progress.start('POPULATION_RECONCILE');
		const coverage: ProjectContextGraphCoverage = {
			chargedInputTraversalSteps: counts.traversalSteps,
			configurationClosureRecords: counts.configurationClosureRecords,
			declaredProjectReferences: counts.projectReferences,
			inputPrograms: counts.programs,
			inputProjects: counts.projects,
			inputSources: counts.sources,
			memberships: counts.memberships,
			outsideSelectedProjectReferences: 0,
			programPopulationReconciles: true,
			programSourceMemberships: counts.sources,
			projectPopulationReconciles: true,
			projectedPrograms: counts.programs,
			projectedProjects: counts.projects,
			projectedSources: counts.sources,
			projectProgramMemberships: counts.programs,
			referencePopulationReconciles: true,
			resolvedProjectReferences: counts.projectReferences,
			sourcePopulationReconciles: true,
			unresolvedProjectReferences: 0
		};
		progress.complete({ outputRecords: counts.outputRecords });

		progress.start('MATERIALIZE');
		const content: ProjectContextGraphContent = {
			authorityTransfer: PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER,
			budgets: { ...inputs.request.budgets },
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
			memberships: orderedMemberships,
			method: PROJECT_CONTEXT_GRAPH_METHOD,
			nonclaims: [...PROJECT_CONTEXT_GRAPH_NONCLAIMS],
			operationVersion: PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
			outsideSelectedProjectReferences: [] as const,
			programs: projected.programs,
			projectReferences: references,
			projects: projected.projects,
			resultCompleteness: 'COMPLETE_FOR_VALIDATED_SELECTED_PROJECT_CONTEXT_POPULATIONS' as const,
			schemaVersion: PROJECT_CONTEXT_GRAPH_SCHEMA_VERSION,
			selection: clonePlainData(PROJECT_CONTEXT_GRAPH_SELECTION),
			semanticSnapshotId: inputs.semanticSnapshot.id,
			semanticValidationWitness: {
				context: 'FROZEN_SUBJECT' as const,
				frozenSubjectSha256: frozenSubjectWitness.sha256,
				method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT' as const,
				semanticSnapshotId: inputs.semanticSnapshot.id,
				semanticSnapshotSha256: semanticSnapshotWitness.sha256,
				state: 'VALID' as const,
				subjectId: inputs.request.subjectId
			},
			sources: projected.sources,
			subjectId: inputs.request.subjectId,
			truncation: { reason: null, state: 'NOT_TRUNCATED' as const },
			unresolvedProjectReferences: [] as const
		};
		progress.complete({ memberships: orderedMemberships.length, references: references.length });

		progress.start('SERIALIZE');
		const graph: ProjectContextGraphSnapshot = {
			...content,
			contentDigest: projectContextGraphContentDigest(content)
		};
		progress.complete({ outputRecords: counts.outputRecords });

		progress.start('GRAPH_VALIDATE');
		const validationRecords = Math.max(
			512,
			saturatedAdd(
				inputs.request.budgets.maxInputRecords,
				saturatedAdd(
					saturatedMultiply(counts.outputRecords, 64),
					saturatedMultiply(counts.configurationClosureRecords, 32)
				)
			)
		);
		const validationStrings = Math.max(
			16_384,
			saturatedAdd(
				inputs.request.budgets.maxInputStringCharacters,
				saturatedMultiply(counts.outputRecords, 4_096)
			)
		);
		const validation = validateConstructedProjectContextGraph(graph, inputs, inputDigest, {
			maxDepth: 4_096,
			maxInputRecords: inputs.request.budgets.maxInputRecords,
			maxInputStringCharacters: inputs.request.budgets.maxInputStringCharacters,
			maxIssues: inputs.request.budgets.maxDiagnostics,
			maxRecords: validationRecords,
			maxStringCharacters: validationStrings
		});
		requireValidConstructedGraph(validation);
		progress.complete({ validationIssues: 0 });
		return progress.finish({ diagnostics: [], graph, outcome: 'partial' });
	} catch (error) {
		if (error instanceof ProjectContextFailure) {
			progress.fail({}, error.code);
			return progress.finish(unavailable(error.code, error.message, error.phase, error.path));
		}
		progress.fail({}, 'REQUEST_INVALID');
		return progress.finish(
			unavailable(
				'REQUEST_INVALID',
				error instanceof Error
					? `Project-context input inspection failed closed: ${error.message}`
					: 'Project-context input inspection failed closed.',
				'REQUEST'
			)
		);
	}
}
