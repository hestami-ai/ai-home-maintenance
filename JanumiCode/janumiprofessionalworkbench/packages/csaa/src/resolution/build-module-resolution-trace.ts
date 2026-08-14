import { posix } from 'node:path';
import { isProxy } from 'node:util/types';

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
	MODULE_RESOLUTION_TRACE_PROGRESS_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_SELECTION,
	type BuildModuleResolutionTraceOptions,
	type ModuleResolutionAttemptPurpose,
	type ModuleResolutionAttemptRecord,
	type ModuleResolutionAttemptStage,
	type ModuleResolutionCandidateRecord,
	type ModuleResolutionPresentReadFileObservation,
	type ModuleResolutionTargetWitness,
	type ModuleResolutionTraceBuildInputs,
	type ModuleResolutionTraceBuildOutcome,
	type ModuleResolutionTraceDiagnostic,
	type ModuleResolutionTraceImporterWitness,
	type ModuleResolutionTraceProgressEvent,
	type ModuleResolutionTraceProgressPhase,
	type ModuleResolutionTraceSnapshot
} from '../contracts/module-resolution-trace.js';
import {
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type ProjectContextGraphBuildInputs
} from '../contracts/project-context-graph.js';
import { TYPESCRIPT_PROVIDER_VERSION, type StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { ProgramRecipe } from '../contracts/subject.js';
import { validateConstructedProjectContextGraph } from '../graph/validate-project-context-graph.js';
import { sha256 } from '../inventory/canonical.js';
import {
	type CompilerInputQuery,
	type VerifiedCompilerProjectInputEntry,
	type VerifiedCompilerProjectInputLookup
} from '../providers/typescript/compiler-input-journal.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { getStaticSemanticSnapshotCompilerProjectInputLookup } from '../semantic/compiler-capture-capability.js';
import {
	MATERIALIZED_ARRAY_PATH_OPTIONS,
	MATERIALIZED_SCALAR_PATH_OPTIONS,
	validateProgramRecipePolicy
} from '../semantic/program-recipe-policy.js';
import { validateStaticSemanticSnapshot } from '../semantic/validate-snapshot.js';
import { isFrozenSubjectCapability } from '../subject/frozen-store.js';
import {
	moduleResolutionAttemptId,
	moduleResolutionCandidateId,
	moduleResolutionRelationId,
	moduleResolutionTraceContentDigest,
	moduleResolutionTraceId,
	moduleResolutionTraceInputDigest,
	type ModuleResolutionTraceContent
} from './module-resolution-trace-canonical.js';
import { validateConstructedConditionalExportResolution } from './validate-conditional-export-resolution.js';
import { validateConstructedModuleResolutionTrace } from './validate-module-resolution-trace.js';

/** @internal Mutable only so focused tests can replace the exact public compiler calls. */
export const moduleResolutionTraceTypeScriptPublicApi = {
	createSourceFile: ts.createSourceFile,
	getImpliedNodeFormatForFile: ts.getImpliedNodeFormatForFile,
	getModeForUsageLocation: ts.getModeForUsageLocation,
	resolveModuleName: ts.resolveModuleName
};

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
const SHA256 = /^[a-f0-9]{64}$/u;

interface PlainDataUsage {
	readonly records: number;
	readonly stringCharacters: number;
}

interface TelemetryRecorder {
	complete(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	fail(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	finish<Outcome extends ModuleResolutionTraceBuildOutcome>(outcome: Outcome): Outcome;
	start(phase: ModuleResolutionTraceProgressPhase, counts?: Readonly<Record<string, number>>): void;
}

class ModuleResolutionTraceFailure extends Error {
	constructor(
		readonly code: ModuleResolutionTraceDiagnostic['code'],
		message: string,
		readonly phase: ModuleResolutionTraceDiagnostic['phase'],
		readonly path: string | null = null
	) {
		super(message);
		this.name = 'ModuleResolutionTraceFailure';
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

function preflightPlainData(
	value: unknown,
	limits: { readonly maxInputRecords: number; readonly maxInputStringCharacters: number }
): PlainDataUsage {
	type Work =
		| { readonly kind: 'LEAVE'; readonly value: object }
		| { readonly kind: 'VISIT'; readonly value: unknown };
	const pending: Work[] = [{ kind: 'VISIT', value }];
	const active = new WeakSet<object>();
	let records = 0;
	let stringCharacters = 0;
	const addStringCharacters = (amount: number): void => {
		stringCharacters += amount;
		if (
			!Number.isSafeInteger(stringCharacters) ||
			stringCharacters > limits.maxInputStringCharacters
		)
			throw new ModuleResolutionTraceFailure(
				'BUDGET_EXCEEDED',
				'Input string-character budget was exhausted.',
				'REQUEST_BIND',
				'$.request.budgets.maxInputStringCharacters'
			);
	};
	while (pending.length > 0) {
		const work = pending.pop()!;
		if (work.kind === 'LEAVE') {
			active.delete(work.value);
			continue;
		}
		records += 1;
		if (records > limits.maxInputRecords)
			throw new ModuleResolutionTraceFailure(
				'BUDGET_EXCEEDED',
				'Input plain-data record budget was exhausted.',
				'REQUEST_BIND',
				'$.request.budgets.maxInputRecords'
			);
		if (typeof work.value === 'string') {
			if (!isUnicodeScalarString(work.value))
				throw new TypeError('Input strings must contain Unicode scalar text.');
			addStringCharacters(work.value.length);
			continue;
		}
		if (
			work.value === null ||
			typeof work.value === 'boolean' ||
			(typeof work.value === 'number' &&
				Number.isSafeInteger(work.value) &&
				!Object.is(work.value, -0))
		)
			continue;
		if (typeof work.value !== 'object' || isProxy(work.value))
			throw new TypeError('Inputs must contain only inert JSON-compatible plain data.');
		if (active.has(work.value)) throw new TypeError('Input plain data may not contain cycles.');
		active.add(work.value);
		pending.push({ kind: 'LEAVE', value: work.value });
		if (Array.isArray(work.value)) {
			if (Reflect.getPrototypeOf(work.value) !== Array.prototype)
				throw new TypeError('Input arrays must use Array.prototype.');
			const count = work.value.length;
			const ownKeys = Reflect.ownKeys(work.value);
			if (
				ownKeys.length !== count + 1 ||
				ownKeys.some(
					(key) =>
						typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))
				)
			)
				throw new TypeError('Input arrays must be dense exact data arrays.');
			if (records + count > limits.maxInputRecords)
				throw new ModuleResolutionTraceFailure(
					'BUDGET_EXCEEDED',
					'Input array population exhausted the plain-data record budget.',
					'REQUEST_BIND',
					'$.request.budgets.maxInputRecords'
				);
			for (let index = count - 1; index >= 0; index -= 1) {
				const key = String(index);
				addStringCharacters(key.length);
				const descriptor = Reflect.getOwnPropertyDescriptor(work.value, key);
				if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
					throw new TypeError('Input arrays must contain enumerable data elements.');
				pending.push({ kind: 'VISIT', value: descriptor.value });
			}
			continue;
		}
		const prototype = Reflect.getPrototypeOf(work.value);
		if (prototype !== Object.prototype && prototype !== null)
			throw new TypeError('Input records must use a plain prototype.');
		const ownKeys = Reflect.ownKeys(work.value);
		if (ownKeys.some((key) => typeof key !== 'string'))
			throw new TypeError('Input records may not contain symbol keys.');
		if (records + ownKeys.length > limits.maxInputRecords)
			throw new ModuleResolutionTraceFailure(
				'BUDGET_EXCEEDED',
				'Input property population exhausted the plain-data record budget.',
				'REQUEST_BIND',
				'$.request.budgets.maxInputRecords'
			);
		for (let index = ownKeys.length - 1; index >= 0; index -= 1) {
			const key = ownKeys[index] as string;
			if (!isUnicodeScalarString(key))
				throw new TypeError('Input keys must contain Unicode scalar text.');
			addStringCharacters(key.length);
			const descriptor = Reflect.getOwnPropertyDescriptor(work.value, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				throw new TypeError('Input records must contain enumerable data properties.');
			pending.push({ kind: 'VISIT', value: descriptor.value });
		}
	}
	return { records, stringCharacters };
}

function barePackageName(value: string): boolean {
	return /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(value);
}

function materializeInputs(value: unknown): ModuleResolutionTraceBuildInputs {
	const inputs = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const request = exactPlainRecord(inputs.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(request.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	const importer = exactPlainRecord(request.importer, IMPORTER_KEYS, '$inputs.request.importer');
	const graphReference = exactPlainRecord(
		request.projectContextGraph,
		GRAPH_REFERENCE_KEYS,
		'$inputs.request.projectContextGraph'
	);
	const conditionalReference = exactPlainRecord(
		request.conditionalExportResolution,
		CONDITIONAL_REFERENCE_KEYS,
		'$inputs.request.conditionalExportResolution'
	);
	const selection = exactPlainRecord(
		request.selection,
		SELECTION_KEYS,
		'$inputs.request.selection'
	);
	if (
		BUDGET_KEYS.some(
			(key) =>
				typeof budgets[key] !== 'number' ||
				!Number.isSafeInteger(budgets[key]) ||
				(budgets[key] as number) < 1
		) ||
		(budgets.maxDiagnostics as number) > 100_000
	)
		throw new ModuleResolutionTraceFailure(
			'REQUEST_INVALID',
			'Module-resolution trace budgets must be bounded positive safe integers.',
			'REQUEST_BIND',
			'$.request.budgets'
		);
	if (
		request.schemaVersion !== MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION ||
		request.operationVersion !== MODULE_RESOLUTION_TRACE_OPERATION_VERSION ||
		canonicalSemanticJson(selection) !== canonicalSemanticJson(MODULE_RESOLUTION_TRACE_SELECTION)
	)
		throw new ModuleResolutionTraceFailure(
			'UNSUPPORTED_REQUEST',
			'The request version, operation, or selection profile is unsupported.',
			'REQUEST_BIND',
			'$.request'
		);
	if (
		typeof request.packageName !== 'string' ||
		!isUnicodeScalarString(request.packageName) ||
		!barePackageName(request.packageName) ||
		typeof request.specifier !== 'string' ||
		request.specifier !== request.packageName ||
		!barePackageName(request.specifier)
	)
		throw new ModuleResolutionTraceFailure(
			'UNSUPPORTED_REQUEST',
			'The request must select one bare workspace-package root specifier.',
			'REQUEST_BIND',
			'$.request.specifier'
		);
	if (
		IMPORTER_KEYS.some((key) => typeof importer[key] !== 'string' || importer[key] === '') ||
		typeof request.subjectId !== 'string' ||
		!SHA256.test(request.subjectId as string) ||
		typeof request.semanticSnapshotId !== 'string' ||
		request.semanticSnapshotId === '' ||
		typeof graphReference.graphId !== 'string' ||
		graphReference.graphId === '' ||
		!SHA256.test(graphReference.contentDigest as string) ||
		!SHA256.test(graphReference.inputDigest as string) ||
		typeof conditionalReference.id !== 'string' ||
		conditionalReference.id === '' ||
		!SHA256.test(conditionalReference.contentDigest as string) ||
		!SHA256.test(conditionalReference.inputDigest as string)
	)
		throw new ModuleResolutionTraceFailure(
			'REQUEST_INVALID',
			'Module-resolution trace request identities are invalid.',
			'REQUEST_BIND',
			'$.request'
		);
	return {
		conditionalExportRequest:
			inputs.conditionalExportRequest as ModuleResolutionTraceBuildInputs['conditionalExportRequest'],
		conditionalExportResolution:
			inputs.conditionalExportResolution as ModuleResolutionTraceBuildInputs['conditionalExportResolution'],
		frozenSubject: inputs.frozenSubject as ModuleResolutionTraceBuildInputs['frozenSubject'],
		projectContextGraph:
			inputs.projectContextGraph as ModuleResolutionTraceBuildInputs['projectContextGraph'],
		request: {
			...(request as unknown as ModuleResolutionTraceBuildInputs['request']),
			budgets: {
				...(budgets as unknown as ModuleResolutionTraceBuildInputs['request']['budgets'])
			},
			conditionalExportResolution: {
				...(conditionalReference as unknown as ModuleResolutionTraceBuildInputs['request']['conditionalExportResolution'])
			},
			importer: {
				...(importer as unknown as ModuleResolutionTraceBuildInputs['request']['importer'])
			},
			projectContextGraph: {
				...(graphReference as unknown as ModuleResolutionTraceBuildInputs['request']['projectContextGraph'])
			},
			selection: MODULE_RESOLUTION_TRACE_SELECTION
		},
		semanticSnapshot:
			inputs.semanticSnapshot as ModuleResolutionTraceBuildInputs['semanticSnapshot']
	};
}

function clonePlainData<Value>(value: Value, seen = new WeakMap<object, unknown>()): Value {
	if (value === null || typeof value !== 'object') return value;
	const object = value as object;
	const prior = seen.get(object);
	if (prior !== undefined) return prior as Value;
	if (Array.isArray(value)) {
		const result: unknown[] = [];
		seen.set(object, result);
		for (const child of value) result.push(clonePlainData(child, seen));
		return result as Value;
	}
	const result: Record<string, unknown> = {};
	seen.set(object, result);
	for (const key of Object.keys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor !== undefined && 'value' in descriptor)
			result[key] = clonePlainData(descriptor.value, seen);
	}
	return result as Value;
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

function boundedCounts(counts: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
	const result: Record<string, number> = {};
	for (const key of Object.keys(counts).sort().slice(0, 16)) {
		const value = counts[key];
		if (Number.isSafeInteger(value) && value! >= 0) result[key] = value!;
	}
	return Object.freeze(result);
}

function telemetry(options: BuildModuleResolutionTraceOptions | undefined): TelemetryRecorder {
	let sink: ((event: ModuleResolutionTraceProgressEvent) => void) | undefined;
	try {
		if (options !== undefined) {
			const record = exactPlainRecord(options, ['onProgress'], '$options');
			if (typeof record.onProgress === 'function')
				sink = record.onProgress as (event: ModuleResolutionTraceProgressEvent) => void;
		}
	} catch {
		// Telemetry is out of band and cannot affect semantic evidence.
	}
	const events: ModuleResolutionTraceProgressEvent[] = [];
	let active: ModuleResolutionTraceProgressPhase | null = null;
	let sequence = 0;
	const emit = (
		phase: ModuleResolutionTraceProgressPhase,
		state: ModuleResolutionTraceProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				counts: boundedCounts(counts),
				detailCode,
				phase,
				schemaVersion: MODULE_RESOLUTION_TRACE_PROGRESS_SCHEMA_VERSION,
				sequence: sequence++,
				state
			})
		);
	};
	const close = (
		state: ModuleResolutionTraceProgressEvent['state'],
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
		finish<Outcome extends ModuleResolutionTraceBuildOutcome>(outcome: Outcome): Outcome {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			const frozen = deepFreeze(outcome);
			if (sink !== undefined) {
				const retained = Object.freeze([...events]);
				queueMicrotask(() => {
					for (const event of retained)
						try {
							sink!(event);
						} catch {
							// Observer failures remain isolated.
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
	code: ModuleResolutionTraceDiagnostic['code'],
	message: string,
	phase: ModuleResolutionTraceDiagnostic['phase'],
	path: string | null = null
): ModuleResolutionTraceBuildOutcome {
	return { diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' };
}

function checkedAdd(...values: readonly number[]): number {
	let total = 0;
	for (const value of values) {
		total += value;
		if (!Number.isSafeInteger(total))
			throw new ModuleResolutionTraceFailure(
				'BUDGET_EXCEEDED',
				'An exact operation population exceeds the safe-integer range.',
				'INPUT_BUDGET'
			);
	}
	return total;
}

function cap010Inputs(inputs: ModuleResolutionTraceBuildInputs): ProjectContextGraphBuildInputs {
	return {
		frozenSubject: inputs.frozenSubject,
		request: {
			budgets: clonePlainData(inputs.projectContextGraph.budgets),
			operationVersion: PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
			schemaVersion: PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
			selection: PROJECT_CONTEXT_GRAPH_SELECTION,
			semanticSnapshotId: inputs.semanticSnapshot.id,
			subjectId: inputs.frozenSubject.descriptor.subjectId
		},
		semanticSnapshot: inputs.semanticSnapshot
	};
}

function validatePredecessors(
	inputs: ModuleResolutionTraceBuildInputs,
	progress: TelemetryRecorder
): ModuleResolutionTraceSnapshot['semanticValidationWitness'] {
	const limits = {
		maxDepth: 4_096,
		maxInputRecords: inputs.request.budgets.maxInputRecords,
		maxInputStringCharacters: inputs.request.budgets.maxInputStringCharacters,
		maxIssues: inputs.request.budgets.maxDiagnostics,
		maxRecords: inputs.request.budgets.maxInputRecords,
		maxStringCharacters: inputs.request.budgets.maxInputStringCharacters
	};
	const semanticLimits = {
		maxDiagnostics: Math.min(limits.maxIssues, inputs.projectContextGraph.budgets.maxDiagnostics),
		maxRecords: Math.min(
			limits.maxInputRecords,
			inputs.projectContextGraph.budgets.maxInputRecords
		),
		maxStringCharacters: Math.min(
			limits.maxInputStringCharacters,
			inputs.projectContextGraph.budgets.maxInputStringCharacters
		)
	};
	progress.start('SEMANTIC_SNAPSHOT_VALIDATE');
	const semanticValidation = validateStaticSemanticSnapshot(
		inputs.semanticSnapshot,
		{
			maxDepth: limits.maxDepth,
			maxDiagnostics: semanticLimits.maxDiagnostics,
			maxIssues: semanticLimits.maxDiagnostics,
			maxRecords: semanticLimits.maxRecords,
			maxReferenceChecks: semanticLimits.maxRecords,
			maxStringCharacters: semanticLimits.maxStringCharacters
		},
		{ frozenSubject: inputs.frozenSubject }
	);
	if (semanticValidation.state !== 'VALID')
		throw new ModuleResolutionTraceFailure(
			semanticValidation.state === 'BUDGET_EXHAUSTED'
				? 'BUDGET_EXCEEDED'
				: 'SEMANTIC_SNAPSHOT_INVALID',
			'The semantic snapshot is not independently valid against the exact FrozenSubject.',
			'SEMANTIC_SNAPSHOT_VALIDATE',
			semanticValidation.issues[0]?.path ?? null
		);
	const frozenSubjectWitness = canonicalSemanticJsonWitness(inputs.frozenSubject);
	const semanticSnapshotWitness = canonicalSemanticJsonWitness(inputs.semanticSnapshot);
	progress.complete({ validationIssues: 0 });

	progress.start('PROJECT_CONTEXT_GRAPH_VALIDATE');
	const graphValidation = validateConstructedProjectContextGraph(
		inputs.projectContextGraph,
		cap010Inputs(inputs),
		inputs.projectContextGraph.inputDigest,
		limits
	);
	if (graphValidation.state !== 'VALID')
		throw new ModuleResolutionTraceFailure(
			graphValidation.state === 'BUDGET_EXHAUSTED'
				? 'BUDGET_EXCEEDED'
				: 'PROJECT_CONTEXT_GRAPH_INVALID',
			'The CAP-010 project-context graph is not independently valid.',
			'PROJECT_CONTEXT_GRAPH_VALIDATE',
			graphValidation.issues[0]?.path ?? null
		);
	progress.complete({ validationIssues: 0 });

	progress.start('CONDITIONAL_EXPORT_RESOLUTION_VALIDATE');
	const conditionalValidation = validateConstructedConditionalExportResolution(
		inputs.conditionalExportResolution,
		{
			frozenSubject: inputs.frozenSubject,
			projectContextGraph: inputs.projectContextGraph,
			request: inputs.conditionalExportRequest,
			semanticSnapshot: inputs.semanticSnapshot
		},
		inputs.conditionalExportResolution.inputDigest,
		limits
	);
	if (conditionalValidation.state !== 'VALID')
		throw new ModuleResolutionTraceFailure(
			conditionalValidation.state === 'BUDGET_EXHAUSTED'
				? 'BUDGET_EXCEEDED'
				: 'CONDITIONAL_EXPORT_RESOLUTION_INVALID',
			'The CAP-012 conditional-export resolution is not independently valid.',
			'CONDITIONAL_EXPORT_RESOLUTION_VALIDATE',
			conditionalValidation.issues[0]?.path ?? null
		);
	progress.complete({ validationIssues: 0 });
	return {
		context: 'FROZEN_SUBJECT',
		frozenSubjectSha256: frozenSubjectWitness.sha256,
		method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT',
		semanticSnapshotId: inputs.semanticSnapshot.id,
		semanticSnapshotSha256: semanticSnapshotWitness.sha256,
		state: 'VALID',
		subjectId: inputs.request.subjectId
	};
}

function assertInputBinding(inputs: ModuleResolutionTraceBuildInputs): void {
	const {
		conditionalExportRequest,
		conditionalExportResolution,
		frozenSubject,
		projectContextGraph,
		request,
		semanticSnapshot
	} = inputs;
	if (!isFrozenSubjectCapability(frozenSubject))
		throw new ModuleResolutionTraceFailure(
			'REQUEST_INVALID',
			'An exact FrozenSubject capability is required.',
			'REQUEST_BIND',
			'$.frozenSubject'
		);
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
		throw new ModuleResolutionTraceFailure(
			'INPUT_IDENTITY_MISMATCH',
			'Request and predecessor identities do not bind exactly.',
			'REQUEST_BIND'
		);
	if (
		conditionalExportRequest.packageName !== request.packageName ||
		conditionalExportRequest.exportSubpath !== '.' ||
		conditionalExportRequest.moduleMode !== 'IMPORT' ||
		conditionalExportRequest.platform !== 'NODE' ||
		canonicalSemanticJson(conditionalExportRequest.conditions) !==
			canonicalSemanticJson(['types']) ||
		conditionalExportRequest.consumer.projectContextProgramId !==
			request.importer.projectContextProgramId ||
		conditionalExportRequest.consumer.projectContextSourceId !==
			request.importer.projectContextSourceId ||
		conditionalExportRequest.consumer.semanticProgramId !== request.importer.semanticProgramId ||
		conditionalExportRequest.consumer.semanticSourceId !== request.importer.semanticSourceId ||
		conditionalExportResolution.decision.state !== 'SELECTED_TARGET' ||
		typeof conditionalExportResolution.decision.target !== 'string'
	)
		throw new ModuleResolutionTraceFailure(
			'UNSUPPORTED_REQUEST',
			'The trace requires the exact supported CAP-012 types/NODE/IMPORT root decision.',
			'REQUEST_BIND',
			'$.conditionalExportRequest'
		);
}

function decodeCompilerText(bytes: Uint8Array): string {
	try {
		if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
			const body = bytes.subarray(2);
			if (body.byteLength % 2 !== 0) throw new TypeError('Incomplete UTF-16LE code unit.');
			return new TextDecoder('utf-16le', { fatal: true }).decode(body);
		}
		if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
			const body = bytes.subarray(2);
			if (body.byteLength % 2 !== 0) throw new TypeError('Incomplete UTF-16BE code unit.');
			const swapped = body.slice();
			for (let index = 0; index < swapped.length; index += 2)
				[swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!];
			return new TextDecoder('utf-16le', { fatal: true }).decode(swapped);
		}
		const start =
			bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start));
	} catch {
		throw new ModuleResolutionTraceFailure(
			'CAPTURE_INVALID',
			'Captured compiler input bytes do not use a supported text encoding.',
			'IMPORTER_BIND'
		);
	}
}

interface MaterializedRecipe {
	readonly compilerOptions: ts.CompilerOptions;
	readonly configFilePath: string;
	readonly projectReferences: readonly ts.ProjectReference[];
	readonly rootNames: readonly string[];
}

function materializeRecordedRecipe(
	recipeValue: ProgramRecipe,
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
		compilerOptions[key] = clonePlainData(value);
	}
	if (
		recipe.compilerOptions.paths !== undefined &&
		recipe.compilerOptions.baseUrl === undefined &&
		recipe.compilerOptions.pathsBasePath === undefined
	)
		compilerOptions.pathsBasePath = lookup.toRecordedAbsolute(posix.dirname(recipe.configPath));
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
	phase: ModuleResolutionTraceProgressPhase
): PresentReadEntry {
	if (
		entry === undefined ||
		entry.query.operation !== 'READ_FILE' ||
		entry.query.logicalPath !== logicalPath ||
		entry.observation.operation !== 'READ_FILE' ||
		entry.observation.result !== 'PRESENT' ||
		entry.bytes === undefined ||
		entry.bytes.byteLength !== entry.observation.contentBytes ||
		sha256(entry.bytes) !== entry.observation.contentSha256
	)
		throw new ModuleResolutionTraceFailure(
			'CAPTURE_INVALID',
			'The exact project-attributed compiler input bytes are unavailable or inconsistent.',
			phase,
			'$.semanticSnapshot.compilerInputs'
		);
	return entry as PresentReadEntry;
}

interface StaticBinding {
	readonly captureWitness: ModuleResolutionTraceSnapshot['captureWitness'];
	readonly importerAbsolutePath: string;
	readonly importerBytes: Uint8Array;
	readonly importerNodeRecord: StaticSemanticSnapshot['astNodes'][number];
	readonly importerText: string;
	readonly importerWitnessBase: Omit<
		ModuleResolutionTraceImporterWitness,
		'end' | 'literalValueSha256' | 'start'
	>;
	readonly literalValueSha256: string;
	readonly lookup: VerifiedCompilerProjectInputLookup;
	readonly materialized: MaterializedRecipe;
	readonly semanticModuleResolution: StaticSemanticSnapshot['moduleResolutions'][number];
	readonly targetSource: StaticSemanticSnapshot['sources'][number];
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
	const resolutions = semanticSnapshot.moduleResolutions.filter(
		(record) => record.id === request.importer.semanticModuleResolutionId
	);
	const sources = semanticSnapshot.sources.filter(
		(record) => record.id === request.importer.semanticSourceId
	);
	const programs = semanticSnapshot.programs.filter(
		(record) => record.id === request.importer.semanticProgramId
	);
	const nodes = semanticSnapshot.astNodes.filter(
		(record) => record.id === request.importer.specifierNodeId
	);
	if (
		resolutions.length !== 1 ||
		sources.length !== 1 ||
		programs.length !== 1 ||
		nodes.length !== 1
	)
		throw new ModuleResolutionTraceFailure(
			'INPUT_POPULATION_MISMATCH',
			'The importer criterion must bind one exact resolution, source, Program, and node.',
			'IMPORTER_BIND',
			'$.request.importer'
		);
	const resolution = resolutions[0]!;
	const importerSource = sources[0]!;
	const semanticProgram = programs[0]!;
	const importerNode = nodes[0]!;
	const semanticProject = semanticSnapshot.projects.find(
		(record) => record.id === importerSource.projectId
	);
	const contextSource = projectContextGraph.sources.find(
		(record) => record.id === request.importer.projectContextSourceId
	);
	const contextProgram = projectContextGraph.programs.find(
		(record) => record.id === request.importer.projectContextProgramId
	);
	const contextProject =
		contextSource === undefined
			? undefined
			: projectContextGraph.projects.find((record) => record.id === contextSource.projectId);
	if (
		semanticProject === undefined ||
		contextSource === undefined ||
		contextProgram === undefined ||
		contextProject === undefined ||
		resolution.nodeId !== importerNode.id ||
		resolution.sourceId !== importerSource.id ||
		resolution.occurrenceKind !== 'IMPORT' ||
		resolution.specifierState !== 'LITERAL' ||
		resolution.specifier !== request.specifier ||
		resolution.typeOnly ||
		resolution.resolutionState !== 'RESOLVED_SOURCE' ||
		resolution.targetSourceId === null ||
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
		contextProject.configPath !== semanticProject.configPath ||
		contextSource.logicalPath !== importerSource.logicalPath
	)
		throw new ModuleResolutionTraceFailure(
			'INPUT_IDENTITY_MISMATCH',
			'The selected importer semantic and project-context identities do not reconcile.',
			'IMPORTER_BIND',
			'$.request.importer'
		);
	const sameOccurrence = semanticSnapshot.moduleResolutions.filter(
		(record) =>
			record.sourceId === importerSource.id &&
			record.occurrenceKind === 'IMPORT' &&
			record.specifierState === 'LITERAL' &&
			record.specifier === request.specifier &&
			record.typeOnly === false
	);
	if (sameOccurrence.length !== 1)
		throw new ModuleResolutionTraceFailure(
			'INPUT_POPULATION_MISMATCH',
			'The selected importer must contain one exact supported import occurrence.',
			'IMPORTER_BIND',
			'$.semanticSnapshot.moduleResolutions'
		);
	const literals = semanticSnapshot.literals.filter(
		(record) => record.nodeId === importerNode.id && record.sourceId === importerSource.id
	);
	if (
		literals.length !== 1 ||
		literals[0]!.valueType !== 'STRING' ||
		literals[0]!.valueEncoding !== 'JSON_SCALAR' ||
		literals[0]!.valueState !== 'EXACT' ||
		literals[0]!.value !== request.specifier
	)
		throw new ModuleResolutionTraceFailure(
			'INPUT_IDENTITY_MISMATCH',
			'The exact semantic literal witness is absent or inconsistent.',
			'IMPORTER_BIND',
			'$.semanticSnapshot.literals'
		);
	const targetSource = semanticSnapshot.sources.find(
		(record) => record.id === resolution.targetSourceId
	);
	if (
		targetSource === undefined ||
		targetSource.artifactClass !== 'CONTEXT_ONLY' ||
		targetSource.origin !== 'WORKSPACE_BUILD_DECLARATION' ||
		!targetSource.declarationFile
	)
		throw new ModuleResolutionTraceFailure(
			'TARGET_UNAVAILABLE',
			'The semantic target must be one workspace build declaration.',
			'TARGET_BIND',
			'$.semanticSnapshot.sources'
		);
	const workspaces = frozenSubject.workspaces.filter(
		(workspace) => workspace.name === request.packageName
	);
	if (workspaces.length !== 1 || workspaces[0]!.kind !== 'PACKAGE')
		throw new ModuleResolutionTraceFailure(
			'INPUT_POPULATION_MISMATCH',
			'The requested package must bind one exact frozen workspace package.',
			'IMPORTER_BIND',
			'$.request.packageName'
		);
	const workspace = workspaces[0]!;
	const selectedExportTarget = conditionalExportResolution.decision.target;
	if (typeof selectedExportTarget !== 'string' || !selectedExportTarget.startsWith('./'))
		throw new ModuleResolutionTraceFailure(
			'UNSUPPORTED_REQUEST',
			'The selected package export target is unsupported.',
			'IMPORTER_BIND',
			'$.conditionalExportResolution.decision.target'
		);
	const expectedTarget =
		workspace.path === '.'
			? selectedExportTarget.slice(2)
			: `${workspace.path}/${selectedExportTarget.slice(2)}`;
	if (
		expectedTarget !== targetSource.logicalPath ||
		conditionalExportResolution.manifestWitness.workspaceName !== workspace.name ||
		conditionalExportResolution.manifestWitness.workspacePath !== workspace.path
	)
		throw new ModuleResolutionTraceFailure(
			'INPUT_IDENTITY_MISMATCH',
			'The CAP-012 decision does not bind the semantic workspace target.',
			'TARGET_BIND',
			'$.conditionalExportResolution.decision.target'
		);
	const lookup = getStaticSemanticSnapshotCompilerProjectInputLookup(
		semanticSnapshot,
		semanticProject.configPath
	);
	if (lookup === undefined || lookup.subjectId !== request.subjectId)
		throw new ModuleResolutionTraceFailure(
			'CAPTURE_INVALID',
			'The exact semantic snapshot lacks its verified project-scoped compiler capture.',
			'IMPORTER_BIND',
			'$.semanticSnapshot'
		);
	let materialized: MaterializedRecipe;
	try {
		materialized = materializeRecordedRecipe(
			semanticProject.programRecipe,
			lookup,
			request.budgets.maxInputStringCharacters
		);
	} catch {
		throw new ModuleResolutionTraceFailure(
			'CAPTURE_INVALID',
			'The Program recipe cannot be reconstructed through captured path authority.',
			'IMPORTER_BIND',
			'$.semanticSnapshot.projects'
		);
	}
	if (
		sha256(canonicalSemanticJson(materialized)) !== lookup.attribution.materializedRecipeDigest ||
		lookup.attribution.projectResolutionDigest !==
			semanticProject.programRecipe.projectResolutionDigest ||
		canonicalSemanticJson(semanticProject.programRecipe) !==
			canonicalSemanticJson(contextProject.programRecipe)
	)
		throw new ModuleResolutionTraceFailure(
			'CAPTURE_INVALID',
			'The materialized Program recipe does not reproduce capture attribution.',
			'IMPORTER_BIND',
			'$.semanticSnapshot.projects'
		);
	const importerRead = presentRead(
		lookup.lookupAttributedQuery({
			logicalPath: importerSource.logicalPath,
			operation: 'READ_FILE'
		}),
		importerSource.logicalPath,
		'IMPORTER_BIND'
	);
	if (
		importerRead.observation.contentBytes !== importerSource.bytes ||
		importerRead.observation.contentSha256 !== importerSource.contentSha256 ||
		importerRead.observation.origin !== importerSource.origin
	)
		throw new ModuleResolutionTraceFailure(
			'CAPTURE_INVALID',
			'Captured importer bytes do not reproduce the semantic source.',
			'IMPORTER_BIND',
			'$.semanticSnapshot.sources'
		);
	const importerText = decodeCompilerText(importerRead.bytes!);
	if (importerText.length !== importerSource.textLength)
		throw new ModuleResolutionTraceFailure(
			'CAPTURE_INVALID',
			'Captured importer text does not reproduce the semantic source length.',
			'IMPORTER_BIND',
			'$.semanticSnapshot.sources'
		);
	return {
		captureWitness: {
			contextDigest: semanticSnapshot.contextDigest,
			inputRecordIds: clonePlainData(lookup.attribution.contextInputIds),
			materializedRecipeDigest: lookup.attribution.materializedRecipeDigest,
			projectResolutionDigest: lookup.attribution.projectResolutionDigest,
			state: 'VERIFIED_PROJECT_SCOPED_CAPTURE'
		},
		importerAbsolutePath: lookup.toRecordedAbsolute(importerSource.logicalPath),
		importerBytes: importerRead.bytes!.slice(),
		importerNodeRecord: importerNode,
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
			semanticModuleResolutionId: resolution.id,
			semanticProgramId: semanticProgram.id,
			semanticProjectId: semanticProject.id,
			semanticSourceId: importerSource.id,
			specifier: request.specifier,
			specifierNodeId: importerNode.id,
			typeOnly: false
		},
		literalValueSha256: literals[0]!.valueSha256,
		lookup,
		materialized,
		semanticModuleResolution: resolution,
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
	readonly occurrenceCounts: Map<string, number>;
	readonly binding: StaticBinding;
	readonly contextInputIds: ReadonlySet<string>;
	readonly inputs: ModuleResolutionTraceBuildInputs;
	astNodes: number;
	candidates: number;
	readBytes: number;
	stage: ModuleResolutionAttemptStage;
}

function recordCapturedQuery(
	state: ReplayState,
	query: CompilerInputQuery
): VerifiedCompilerProjectInputEntry {
	const { budgets } = state.inputs.request;
	if (state.attempts.length >= budgets.maxAttempts)
		throw new ModuleResolutionTraceFailure(
			'BUDGET_EXCEEDED',
			'The module-resolution attempt budget was exhausted.',
			state.stage === 'IMPLIED_NODE_FORMAT' ? 'IMPLIED_NODE_FORMAT_RESOLVE' : 'MODULE_RESOLVE',
			'$.request.budgets.maxAttempts'
		);
	const candidateIncrement =
		state.stage === 'MODULE_RESOLUTION' && query.operation === 'FILE_EXISTS' ? 1 : 0;
	const nextCandidates = checkedAdd(state.candidates, candidateIncrement);
	const nextAttempts = checkedAdd(state.attempts.length, 1);
	if (
		nextCandidates > budgets.maxCandidates ||
		checkedAdd(1, nextAttempts, nextCandidates) > budgets.maxOutputRecords ||
		checkedAdd(nextAttempts, nextCandidates, state.astNodes) > budgets.maxTraversalSteps ||
		checkedAdd(nextAttempts, 1) > budgets.maxInputRecords
	)
		throw new ModuleResolutionTraceFailure(
			'BUDGET_EXCEEDED',
			'A module-resolution record or traversal budget was exhausted before a host callback.',
			state.stage === 'IMPLIED_NODE_FORMAT' ? 'IMPLIED_NODE_FORMAT_RESOLVE' : 'MODULE_RESOLVE'
		);
	const entry = state.binding.lookup.lookupAttributedQuery(query);
	if (
		entry === undefined ||
		canonicalSemanticJson(entry.query) !== canonicalSemanticJson(query) ||
		entry.observation.operation !== query.operation ||
		entry.observation.logicalPath !== query.logicalPath ||
		!state.contextInputIds.has(entry.observation.id) ||
		!Number.isSafeInteger(entry.attributedInvocationCount) ||
		entry.attributedInvocationCount < 1
	)
		throw new ModuleResolutionTraceFailure(
			'RESOLUTION_UNAVAILABLE',
			'TypeScript requested an input absent from the verified project-scoped capture.',
			state.stage === 'IMPLIED_NODE_FORMAT' ? 'IMPLIED_NODE_FORMAT_RESOLVE' : 'MODULE_RESOLVE',
			'$.semanticSnapshot.compilerInputs'
		);
	const key = canonicalSemanticJson(query);
	const invocationOrdinal = state.occurrenceCounts.get(key) ?? 0;
	state.occurrenceCounts.set(key, invocationOrdinal + 1);
	state.attempts.push({
		invocationOrdinal,
		observation: clonePlainData(entry.observation),
		ordinal: state.attempts.length,
		projectContextInputId: entry.observation.id,
		purpose: attemptPurpose(query),
		query: clonePlainData(query),
		stage: state.stage
	});
	state.candidates = nextCandidates;
	if (entry.observation.operation === 'READ_FILE' && entry.observation.result === 'PRESENT') {
		if (
			entry.bytes === undefined ||
			entry.bytes.byteLength !== entry.observation.contentBytes ||
			sha256(entry.bytes) !== entry.observation.contentSha256
		)
			throw new ModuleResolutionTraceFailure(
				'CAPTURE_INVALID',
				'A captured resolver input does not reproduce its recorded bytes.',
				state.stage === 'IMPLIED_NODE_FORMAT' ? 'IMPLIED_NODE_FORMAT_RESOLVE' : 'MODULE_RESOLVE'
			);
		state.readBytes = checkedAdd(state.readBytes, entry.observation.contentBytes);
		if (state.readBytes > budgets.maxReadBytes)
			throw new ModuleResolutionTraceFailure(
				'BUDGET_EXCEEDED',
				'The module-resolution read-byte budget was exhausted.',
				state.stage === 'IMPLIED_NODE_FORMAT' ? 'IMPLIED_NODE_FORMAT_RESOLVE' : 'MODULE_RESOLVE',
				'$.request.budgets.maxReadBytes'
			);
	}
	return entry;
}

function createCaptureOnlyResolutionHost(state: ReplayState): ts.ModuleResolutionHost {
	const logicalPath = (path: string): string => {
		try {
			return state.binding.lookup.toRecordedLogical(path);
		} catch {
			throw new ModuleResolutionTraceFailure(
				'RESOLUTION_UNAVAILABLE',
				'TypeScript requested a path outside captured path authority.',
				state.stage === 'IMPLIED_NODE_FORMAT' ? 'IMPLIED_NODE_FORMAT_RESOLVE' : 'MODULE_RESOLVE'
			);
		}
	};
	const readFile = (fileName: string): string | undefined => {
		const logical = logicalPath(fileName);
		const entry = recordCapturedQuery(state, { logicalPath: logical, operation: 'READ_FILE' });
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
	return Object.freeze({
		directoryExists(directoryName: string) {
			const entry = recordCapturedQuery(state, {
				logicalPath: logicalPath(directoryName),
				operation: 'DIRECTORY_EXISTS'
			});
			return (
				entry.observation.operation === 'DIRECTORY_EXISTS' &&
				entry.observation.result === 'DIRECTORY'
			);
		},
		fileExists(fileName: string) {
			const entry = recordCapturedQuery(state, {
				logicalPath: logicalPath(fileName),
				operation: 'FILE_EXISTS'
			});
			return (
				entry.observation.operation === 'FILE_EXISTS' && entry.observation.result === 'PRESENT'
			);
		},
		getCurrentDirectory() {
			const entry = recordCapturedQuery(state, {
				logicalPath: '.',
				operation: 'CURRENT_DIRECTORY'
			});
			if (
				entry.observation.operation !== 'CURRENT_DIRECTORY' ||
				entry.observation.result !== 'RESOLVED' ||
				entry.observation.resolvedLogicalPath !== '.'
			)
				throw new ModuleResolutionTraceFailure(
					'CAPTURE_INVALID',
					'The captured current-directory observation is inconsistent.',
					state.stage === 'IMPLIED_NODE_FORMAT' ? 'IMPLIED_NODE_FORMAT_RESOLVE' : 'MODULE_RESOLVE'
				);
			return state.binding.lookup.toRecordedAbsolute('.');
		},
		getDirectories(directoryName: string) {
			const entry = recordCapturedQuery(state, {
				logicalPath: logicalPath(directoryName),
				operation: 'GET_DIRECTORIES'
			});
			return entry.observation.operation === 'GET_DIRECTORIES'
				? entry.observation.resultEntries.map((path) =>
						state.binding.lookup.toRecordedAbsolute(path)
					)
				: [];
		},
		readFile,
		realpath(path: string) {
			const entry = recordCapturedQuery(state, {
				logicalPath: logicalPath(path),
				operation: 'REALPATH'
			});
			return entry.observation.operation === 'REALPATH' && entry.observation.result === 'RESOLVED'
				? state.binding.lookup.toRecordedAbsolute(entry.observation.resolvedLogicalPath)
				: path;
		},
		useCaseSensitiveFileNames() {
			const entry = recordCapturedQuery(state, {
				logicalPath: '.',
				operation: 'USE_CASE_SENSITIVE_FILE_NAMES'
			});
			if (entry.observation.operation !== 'USE_CASE_SENSITIVE_FILE_NAMES')
				throw new ModuleResolutionTraceFailure(
					'CAPTURE_INVALID',
					'The captured case-sensitivity observation is inconsistent.',
					state.stage === 'IMPLIED_NODE_FORMAT' ? 'IMPLIED_NODE_FORMAT_RESOLVE' : 'MODULE_RESOLVE'
				);
			const value = entry.observation.result === 'CASE_SENSITIVE';
			state.caseSensitivityValues.push(value);
			return value;
		}
	});
}

interface ReplayResult {
	readonly astNodes: number;
	readonly attempts: readonly AttemptSeed[];
	readonly impliedNodeFormat: ts.ResolutionMode;
	readonly importerNode: ts.StringLiteral;
	readonly readBytesBeforeTarget: number;
	readonly resolution: ts.ResolvedModuleFull;
	readonly resolutionMode: ts.ResolutionMode;
	readonly useCaseSensitiveFileNames: boolean;
}

function replayResolution(
	inputs: ModuleResolutionTraceBuildInputs,
	binding: StaticBinding,
	progress: TelemetryRecorder
): ReplayResult {
	if (binding.importerBytes.byteLength > inputs.request.budgets.maxReadBytes)
		throw new ModuleResolutionTraceFailure(
			'BUDGET_EXCEEDED',
			'The captured importer exceeds the read-byte budget.',
			'IMPORTER_BIND',
			'$.request.budgets.maxReadBytes'
		);
	const state: ReplayState = {
		astNodes: 0,
		attempts: [],
		binding,
		candidates: 0,
		caseSensitivityValues: [],
		contextInputIds: new Set(binding.lookup.attribution.contextInputIds),
		impliedPackageTypes: [],
		inputs,
		occurrenceCounts: new Map(),
		readBytes: binding.importerBytes.byteLength,
		stage: 'IMPLIED_NODE_FORMAT'
	};
	const options = binding.materialized.compilerOptions;
	if (
		ts.version !== TYPESCRIPT_PROVIDER_VERSION ||
		options.module !== ts.ModuleKind.NodeNext ||
		options.moduleResolution !== ts.ModuleResolutionKind.NodeNext ||
		options.baseUrl !== undefined ||
		options.paths !== undefined ||
		(options.customConditions !== undefined &&
			(!Array.isArray(options.customConditions) || options.customConditions.length !== 0))
	)
		throw new ModuleResolutionTraceFailure(
			'UNSUPPORTED_REQUEST',
			'The supported trace requires pinned TypeScript NodeNext without path aliases or custom conditions.',
			'IMPORTER_BIND',
			'$.semanticSnapshot.projects'
		);
	const host = createCaptureOnlyResolutionHost(state);
	progress.start('IMPLIED_NODE_FORMAT_RESOLVE');
	const impliedNodeFormat = moduleResolutionTraceTypeScriptPublicApi.getImpliedNodeFormatForFile(
		binding.importerAbsolutePath,
		undefined,
		host,
		options
	);
	if (impliedNodeFormat !== ts.ModuleKind.ESNext || !state.impliedPackageTypes.includes('module'))
		throw new ModuleResolutionTraceFailure(
			'UNSUPPORTED_REQUEST',
			'The public implied-node-format stage did not establish an ESM package context.',
			'IMPLIED_NODE_FORMAT_RESOLVE'
		);
	progress.complete({ attempts: state.attempts.length });

	const importerSource = inputs.semanticSnapshot.sources.find(
		(source) => source.id === inputs.request.importer.semanticSourceId
	)!;
	const sourceFile = moduleResolutionTraceTypeScriptPublicApi.createSourceFile(
		binding.importerAbsolutePath,
		binding.importerText,
		{
			impliedNodeFormat,
			languageVersion: options.target ?? ts.ScriptTarget.Latest
		},
		true,
		importerSource.scriptKind === ts.ScriptKind.Unknown
			? undefined
			: (importerSource.scriptKind as ts.ScriptKind)
	);
	const matches: ts.StringLiteral[] = [];
	const pending: ts.Node[] = [sourceFile];
	while (pending.length > 0) {
		const node = pending.pop()!;
		state.astNodes += 1;
		if (
			state.astNodes > inputs.request.budgets.maxAstNodes ||
			checkedAdd(state.astNodes, state.attempts.length, state.candidates) >
				inputs.request.budgets.maxTraversalSteps
		)
			throw new ModuleResolutionTraceFailure(
				'BUDGET_EXCEEDED',
				'The selected importer AST or traversal budget was exhausted.',
				'IMPLIED_NODE_FORMAT_RESOLVE',
				'$.request.budgets.maxAstNodes'
			);
		if (
			ts.isStringLiteral(node) &&
			node.getStart(sourceFile, false) === binding.importerNodeRecord.start &&
			node.getEnd() === binding.importerNodeRecord.end &&
			node.text === inputs.request.specifier &&
			ts.isImportDeclaration(node.parent) &&
			node.parent.moduleSpecifier === node &&
			node.parent.importClause?.isTypeOnly !== true
		)
			matches.push(node);
		ts.forEachChild(node, (child) => {
			pending.push(child);
		});
	}
	if (matches.length !== 1 || sourceFile.isDeclarationFile !== importerSource.declarationFile)
		throw new ModuleResolutionTraceFailure(
			'INPUT_IDENTITY_MISMATCH',
			'The importer bytes do not reproduce one exact non-type-only import literal span.',
			'IMPORTER_BIND',
			'$.request.importer.specifierNodeId'
		);
	const importerNode = matches[0]!;
	const resolutionMode = moduleResolutionTraceTypeScriptPublicApi.getModeForUsageLocation(
		sourceFile,
		importerNode,
		options
	);
	if (resolutionMode !== ts.ModuleKind.ESNext)
		throw new ModuleResolutionTraceFailure(
			'UNSUPPORTED_REQUEST',
			'The public usage-location mode is not the supported ESM import mode.',
			'IMPORTER_BIND'
		);
	state.stage = 'MODULE_RESOLUTION';
	progress.start('MODULE_RESOLVE');
	const resolved = moduleResolutionTraceTypeScriptPublicApi.resolveModuleName(
		inputs.request.specifier,
		binding.importerAbsolutePath,
		options,
		host,
		undefined,
		undefined,
		resolutionMode
	).resolvedModule;
	if (resolved === undefined)
		throw new ModuleResolutionTraceFailure(
			'RESOLUTION_UNAVAILABLE',
			'The public TypeScript resolver did not produce a supported resolved module.',
			'MODULE_RESOLVE',
			'$.request.specifier'
		);
	if (
		state.caseSensitivityValues.length === 0 ||
		state.caseSensitivityValues.some((value) => value !== state.caseSensitivityValues[0])
	)
		throw new ModuleResolutionTraceFailure(
			'CAPTURE_INVALID',
			'Captured case-sensitivity callbacks do not establish one stable environment.',
			'MODULE_RESOLVE'
		);
	progress.complete({ attempts: state.attempts.length, candidates: state.candidates });
	return {
		astNodes: state.astNodes,
		attempts: state.attempts,
		impliedNodeFormat,
		importerNode,
		readBytesBeforeTarget: state.readBytes,
		resolution: resolved,
		resolutionMode,
		useCaseSensitiveFileNames: state.caseSensitivityValues[0]!
	};
}

interface TargetBinding {
	readonly originalResolvedLogicalPath: string;
	readonly selectedAttemptOrdinal: number;
	readonly targetInput: Omit<
		ModuleResolutionTargetWitness,
		'candidateId' | 'selectedFileExistsAttemptId'
	>;
	readonly totalReadBytes: number;
}

function bindTarget(
	inputs: ModuleResolutionTraceBuildInputs,
	binding: StaticBinding,
	replay: ReplayResult
): TargetBinding {
	let resolvedLogicalPath: string;
	try {
		resolvedLogicalPath = binding.lookup.toRecordedLogical(replay.resolution.resolvedFileName);
	} catch {
		throw new ModuleResolutionTraceFailure(
			'TARGET_UNAVAILABLE',
			'The resolved module path is outside captured path authority.',
			'TARGET_BIND'
		);
	}
	if (resolvedLogicalPath !== binding.targetSource.logicalPath)
		throw new ModuleResolutionTraceFailure(
			'TARGET_UNAVAILABLE',
			'The public resolver target does not equal the semantic target source.',
			'TARGET_BIND',
			'$.semanticSnapshot.moduleResolutions'
		);
	const extension = replay.resolution.extension;
	if (extension !== '.d.ts' && extension !== '.d.mts' && extension !== '.d.cts')
		throw new ModuleResolutionTraceFailure(
			'UNSUPPORTED_REQUEST',
			'The selected resolver target is not a declaration build output.',
			'TARGET_BIND'
		);
	const realpathedToFinal = new Set(
		replay.attempts
			.filter(
				(attempt) =>
					attempt.stage === 'MODULE_RESOLUTION' &&
					attempt.query.operation === 'REALPATH' &&
					attempt.observation.operation === 'REALPATH' &&
					attempt.observation.result === 'RESOLVED' &&
					attempt.observation.resolvedLogicalPath === resolvedLogicalPath
			)
			.map((attempt) => attempt.query.logicalPath)
	);
	const selectedAttempts = replay.attempts.filter((attempt) => {
		if (
			attempt.stage !== 'MODULE_RESOLUTION' ||
			attempt.query.operation !== 'FILE_EXISTS' ||
			attempt.purpose !== 'MODULE_TARGET_CANDIDATE' ||
			attempt.observation.operation !== 'FILE_EXISTS' ||
			attempt.observation.result !== 'PRESENT'
		)
			return false;
		if (attempt.query.logicalPath === resolvedLogicalPath) return true;
		return realpathedToFinal.has(attempt.query.logicalPath);
	});
	if (selectedAttempts.length !== 1)
		throw new ModuleResolutionTraceFailure(
			'TARGET_UNAVAILABLE',
			'The resolved module does not bind one exact recorded FILE_EXISTS candidate.',
			'TARGET_BIND'
		);
	const selectedAttempt = selectedAttempts[0]!;
	const targetRead = presentRead(
		binding.lookup.lookupAttributedQuery({
			logicalPath: binding.targetSource.logicalPath,
			operation: 'READ_FILE'
		}),
		binding.targetSource.logicalPath,
		'TARGET_BIND'
	);
	if (
		targetRead.observation.contentBytes !== binding.targetSource.bytes ||
		targetRead.observation.contentSha256 !== binding.targetSource.contentSha256 ||
		targetRead.observation.origin !== 'WORKSPACE_BUILD_DECLARATION'
	)
		throw new ModuleResolutionTraceFailure(
			'TARGET_UNAVAILABLE',
			'The captured target bytes do not reproduce the semantic build declaration.',
			'TARGET_BIND'
		);
	const totalReadBytes = checkedAdd(
		replay.readBytesBeforeTarget,
		targetRead.observation.contentBytes
	);
	if (
		totalReadBytes > inputs.request.budgets.maxReadBytes ||
		checkedAdd(replay.attempts.length, 1) > inputs.request.budgets.maxInputRecords
	)
		throw new ModuleResolutionTraceFailure(
			'BUDGET_EXCEEDED',
			'The independent target witness exhausted an input or read-byte budget.',
			'TARGET_BIND'
		);
	return {
		originalResolvedLogicalPath: selectedAttempt.query.logicalPath,
		selectedAttemptOrdinal: selectedAttempt.ordinal,
		targetInput: {
			artifactClass: 'CONTEXT_ONLY',
			bytes: binding.targetSource.bytes,
			contentSha256: binding.targetSource.contentSha256,
			declarationFile: true,
			extension,
			logicalPath: binding.targetSource.logicalPath,
			originalResolvedLogicalPath: selectedAttempt.query.logicalPath,
			origin: 'WORKSPACE_BUILD_DECLARATION',
			packageExportTarget: inputs.conditionalExportResolution.decision.target as string,
			packageName: inputs.request.packageName,
			packageWorkspacePath: binding.workspace.path,
			semanticProgramId: binding.targetSource.programId,
			semanticProjectId: binding.targetSource.projectId,
			semanticSourceId: binding.targetSource.id,
			targetRead: {
				observation: clonePlainData(targetRead.observation),
				query: clonePlainData(targetRead.query)
			}
		},
		totalReadBytes
	};
}

function materializeTrace(
	inputs: ModuleResolutionTraceBuildInputs,
	semanticValidationWitness: ModuleResolutionTraceSnapshot['semanticValidationWitness'],
	binding: StaticBinding,
	replay: ReplayResult,
	target: TargetBinding
): ModuleResolutionTraceSnapshot {
	const importerWitness: ModuleResolutionTraceImporterWitness = {
		...binding.importerWitnessBase,
		end: replay.importerNode.getEnd(),
		literalValueSha256: binding.literalValueSha256,
		start: replay.importerNode.getStart(undefined, false)
	};
	const resolverEnvironment: ModuleResolutionTraceSnapshot['resolverEnvironment'] = {
		compilerOptionsDigest: sha256(canonicalSemanticJson(binding.materialized.compilerOptions)),
		compilerVersion: ts.version,
		configPath: binding.lookup.attribution.projectKey,
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
	const inputDigest = moduleResolutionTraceInputDigest(inputs, {
		captureWitness: binding.captureWitness,
		importerWitness,
		resolverEnvironment,
		targetWitness: target.targetInput
	});
	const traceId = moduleResolutionTraceId({
		conditionalExportResolutionId: inputs.conditionalExportResolution.id,
		inputDigest,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.request.subjectId
	});
	const attempts = replay.attempts.map((attempt) => ({
		...clonePlainData(attempt),
		id: moduleResolutionAttemptId(traceId, attempt)
	}));
	const selectedAttempt = attempts[target.selectedAttemptOrdinal]!;
	const candidates: ModuleResolutionCandidateRecord[] = [];
	for (const attempt of attempts) {
		if (attempt.stage !== 'MODULE_RESOLUTION' || attempt.query.operation !== 'FILE_EXISTS')
			continue;
		if (
			attempt.observation.operation !== 'FILE_EXISTS' ||
			(attempt.observation.result !== 'PRESENT' && attempt.observation.result !== 'ABSENT')
		)
			throw new ModuleResolutionTraceFailure(
				'CAPTURE_INVALID',
				'A FILE_EXISTS attempt has inconsistent observation evidence.',
				'MATERIALIZE'
			);
		const selected = attempt.id === selectedAttempt.id;
		const record = {
			attemptId: attempt.id,
			disposition: selected ? ('SELECTED' as const) : ('EXCLUDED' as const),
			exclusionReason: selected
				? null
				: attempt.purpose === 'PACKAGE_METADATA'
					? ('PACKAGE_METADATA_NOT_A_MODULE_TARGET' as const)
					: attempt.observation.result === 'ABSENT'
						? ('FILE_ABSENT' as const)
						: ('PRESENT_NOT_SELECTED' as const),
			logicalPath: attempt.query.logicalPath,
			observationResult: attempt.observation.result,
			ordinal: candidates.length,
			purpose: attempt.purpose as 'MODULE_TARGET_CANDIDATE' | 'PACKAGE_METADATA'
		};
		candidates.push({ ...record, id: moduleResolutionCandidateId(traceId, record) });
	}
	const selectedCandidate = candidates.find((candidate) => candidate.disposition === 'SELECTED');
	if (selectedCandidate === undefined)
		throw new ModuleResolutionTraceFailure(
			'TARGET_UNAVAILABLE',
			'The selected resolver candidate is absent after canonical materialization.',
			'MATERIALIZE'
		);
	const targetWitness: ModuleResolutionTargetWitness = {
		...target.targetInput,
		candidateId: selectedCandidate.id,
		selectedFileExistsAttemptId: selectedAttempt.id
	};
	const relation = {
		id: moduleResolutionRelationId({
			importerSourceId: binding.importerWitnessBase.semanticSourceId,
			semanticModuleResolutionId: binding.semanticModuleResolution.id,
			specifierNodeId: binding.importerNodeRecord.id,
			targetSourceId: binding.targetSource.id,
			traceId
		}),
		importerSourceId: binding.importerWitnessBase.semanticSourceId,
		kind: 'EXACT_LITERAL_IMPORT_RESOLVES_TO_DECLARATION_BUILD_OUTPUT' as const,
		ordinal: 0 as const,
		semanticModuleResolutionId: binding.semanticModuleResolution.id,
		specifierNodeId: binding.importerNodeRecord.id,
		targetSourceId: binding.targetSource.id
	};
	const impliedNodeFormatAttempts = attempts.filter(
		(attempt) => attempt.stage === 'IMPLIED_NODE_FORMAT'
	).length;
	const moduleResolutionAttempts = attempts.length - impliedNodeFormatAttempts;
	const excludedCandidates = candidates.filter(
		(candidate) => candidate.disposition === 'EXCLUDED'
	).length;
	const coverage: ModuleResolutionTraceSnapshot['coverage'] = {
		astNodes: replay.astNodes,
		attemptPopulationReconciles: true,
		attemptRecords: attempts.length,
		candidatePopulationReconciles: true,
		candidateRecords: candidates.length,
		chargedTraversalSteps: checkedAdd(replay.astNodes, attempts.length, candidates.length),
		excludedCandidates,
		impliedNodeFormatAttempts,
		inputRecords: checkedAdd(attempts.length, 1),
		moduleResolutionAttempts,
		moduleResolutionFileExistsAttempts: candidates.length,
		outputRecords: checkedAdd(1, attempts.length, candidates.length),
		readBytes: target.totalReadBytes,
		relationPopulationReconciles: true,
		relationRecords: 1,
		selectedCandidates: 1,
		selectedImporterPrograms: 1,
		selectedImporterSources: 1,
		selectedTargets: 1,
		selectedWorkspacePackages: 1
	};
	const content: ModuleResolutionTraceContent = {
		attempts,
		authorityTransfer: MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER,
		budgets: clonePlainData(inputs.request.budgets),
		candidates,
		canonicalProfile: MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE,
		capability: MODULE_RESOLUTION_TRACE_CAPABILITY,
		capabilityStatus: MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS,
		captureWitness: clonePlainData(binding.captureWitness),
		closure: 'CLOSED_FOR_SELECTED_SUPPORTED_EXACT_RESOLVED_REQUEST',
		conditionalExportResolution: clonePlainData(inputs.request.conditionalExportResolution),
		coverage,
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
		nonclaims: clonePlainData(MODULE_RESOLUTION_TRACE_NONCLAIMS),
		operationVersion: MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
		projectContextGraph: clonePlainData(inputs.request.projectContextGraph),
		relation,
		resolutionAuthority: MODULE_RESOLUTION_TRACE_AUTHORITY,
		resolverEnvironment,
		resultCompleteness: 'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_RESOLVED_REQUEST',
		schemaVersion: MODULE_RESOLUTION_TRACE_SCHEMA_VERSION,
		selection: clonePlainData(MODULE_RESOLUTION_TRACE_SELECTION),
		semanticSnapshotId: inputs.semanticSnapshot.id,
		semanticValidationWitness,
		subjectId: inputs.request.subjectId,
		targetWitness,
		truncation: { reason: null, state: 'NOT_TRUNCATED' }
	};
	return { ...content, contentDigest: moduleResolutionTraceContentDigest(content) };
}

export function buildModuleResolutionTrace(
	inputsValue: unknown,
	options?: BuildModuleResolutionTraceOptions
): ModuleResolutionTraceBuildOutcome {
	const progress = telemetry(options);
	try {
		progress.start('REQUEST_BIND');
		const limits = preflightLimits(inputsValue);
		const usage = preflightPlainData(inputsValue, limits);
		const inputs = materializeInputs(inputsValue);
		assertInputBinding(inputs);
		progress.complete({
			inputRecords: usage.records,
			inputStringCharacters: usage.stringCharacters
		});

		progress.start('INPUT_BUDGET');
		progress.complete({
			maxInputRecords: inputs.request.budgets.maxInputRecords,
			maxInputStringCharacters: inputs.request.budgets.maxInputStringCharacters
		});

		const semanticValidationWitness = validatePredecessors(inputs, progress);
		progress.start('IMPORTER_BIND');
		const binding = bindStaticInputs(inputs);
		progress.complete({ importerPrograms: 1, importerSources: 1, workspacePackages: 1 });
		const replay = replayResolution(inputs, binding, progress);
		progress.start('TARGET_BIND');
		const target = bindTarget(inputs, binding, replay);
		progress.complete({ selectedTargets: 1 });

		progress.start('MATERIALIZE');
		const trace = materializeTrace(inputs, semanticValidationWitness, binding, replay, target);
		progress.complete({ outputRecords: trace.coverage.outputRecords });
		progress.start('SERIALIZE');
		canonicalSemanticJson(trace);
		progress.complete({ outputRecords: trace.coverage.outputRecords });
		progress.start('TRACE_VALIDATE');
		const validation = validateConstructedModuleResolutionTrace(trace, inputs, trace.inputDigest, {
			maxDepth: 4_096,
			maxInputRecords: inputs.request.budgets.maxInputRecords,
			maxInputStringCharacters: inputs.request.budgets.maxInputStringCharacters,
			maxIssues: inputs.request.budgets.maxDiagnostics,
			maxRecords: Math.max(
				1_024,
				checkedAdd(inputs.request.budgets.maxInputRecords, trace.coverage.outputRecords * 64)
			),
			maxStringCharacters: Math.max(
				65_536,
				checkedAdd(
					inputs.request.budgets.maxInputStringCharacters,
					trace.coverage.outputRecords * 4_096
				)
			)
		});
		if (validation.state !== 'VALID')
			throw new ModuleResolutionTraceFailure(
				validation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'TRACE_VALIDATION_FAILED',
				'The constructed module-resolution trace failed independent validation.',
				'TRACE_VALIDATE',
				validation.issues[0]?.path ?? null
			);
		progress.complete({ validationIssues: 0 });
		return progress.finish({ diagnostics: [], outcome: 'partial', trace });
	} catch (error) {
		if (error instanceof ModuleResolutionTraceFailure) {
			progress.fail({}, error.code);
			return progress.finish(unavailable(error.code, error.message, error.phase, error.path));
		}
		progress.fail({}, 'REQUEST_INVALID');
		return progress.finish(
			unavailable(
				'REQUEST_INVALID',
				'Module-resolution trace input inspection or derivation failed closed.',
				'REQUEST_BIND'
			)
		);
	}
}
