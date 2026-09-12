import { isProxy } from 'node:util/types';

import ts from 'typescript';

import {
	DECLARATION_CONTEXT_ANALYSIS_ARTIFACT_ROLE_ORDER,
	DECLARATION_CONTEXT_ANALYSIS_AUTHORITY,
	DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER,
	DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE,
	DECLARATION_CONTEXT_ANALYSIS_CAPABILITY,
	DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS,
	DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS,
	DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE,
	DECLARATION_CONTEXT_ANALYSIS_FRESHNESS,
	DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
	DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
	DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE,
	DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT,
	DECLARATION_CONTEXT_ANALYSIS_METHOD,
	DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS,
	DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_PROGRESS_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SELECTION,
	type BuildDeclarationContextAnalysisOptions,
	type DeclarationContextAliasHopWitness,
	type DeclarationContextAnalysisBuildInputs,
	type DeclarationContextAnalysisBuildOutcome,
	type DeclarationContextAnalysisDiagnostic,
	type DeclarationContextAnalysisId,
	type DeclarationContextAnalysisProgressEvent,
	type DeclarationContextAnalysisProgressPhase,
	type DeclarationContextAnalysisSnapshot,
	type DeclarationContextArtifactRecord,
	type DeclarationContextArtifactRole,
	type DeclarationContextDeclarationKind,
	type DeclarationContextDeclarationRecord,
	type DeclarationContextMergeRecord,
	type DeclarationContextParseWitnessRecord,
	type DeclarationContextProgramInputAttemptRecord,
	type DeclarationContextProgramSourceIdentity,
	type DeclarationContextRelationRecord,
	type DeclarationContextRelationRecordWithoutId,
	type DeclarationContextSymbolFlagsBinding,
	type DeclarationContextTerminalSymbolId,
	type DeclarationContextTerminalSymbolRecord
} from '../contracts/declaration-context-analysis.js';
import {
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type ProjectContextGraphBuildInputs
} from '../contracts/project-context-graph.js';
import { TYPESCRIPT_PROVIDER_VERSION, type SemanticSourceRecord } from '../contracts/semantic.js';
import { validateConstructedProjectContextGraph } from '../graph/validate-project-context-graph.js';
import { validateConstructedConditionalExportResolution } from '../resolution/validate-conditional-export-resolution.js';
import { validateConstructedModuleResolutionTrace } from '../resolution/validate-module-resolution-trace.js';
import { isFrozenSubjectCapability } from '../subject/frozen-store.js';
import {
	declarationContextAnalysisContentDigest,
	declarationContextAnalysisId,
	declarationContextAnalysisInputDigest,
	declarationContextArtifactId,
	declarationContextDeclarationId,
	declarationContextExportBindingId,
	declarationContextMergeId,
	declarationContextParseWitnessId,
	declarationContextProgramInputAttemptId,
	declarationContextProgramSourcePopulationDigest,
	declarationContextRelationId,
	declarationContextTerminalSymbolId,
	type DeclarationContextAnalysisContent
} from './declaration-context-analysis-canonical.js';
import {
	CompilerProjectProgramCapabilityError,
	createCompilerProjectProgramSession,
	type CompilerProjectParsedSource,
	type CompilerProjectProgramEvidence
} from './compiler-project-program-capability.js';
import { canonicalSemanticJsonWitnessWithProgress, isUnicodeScalarString } from './canonical.js';
import { createMonotonicOperationClock } from './monotonic-operation-clock.js';
import { validateStaticSemanticSnapshot } from './validate-snapshot.js';
import { validateConstructedDeclarationContextAnalysis } from './validate-declaration-context-analysis.js';

/** @internal Mutable only so focused tests can replace exact public TypeScript calls. */
export const declarationContextAnalysisTypeScriptPublicApi = {
	forEachChild: ts.forEachChild,
	getAliasedSymbol(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
		return checker.getAliasedSymbol(symbol);
	},
	getExportsOfModule(checker: ts.TypeChecker, symbol: ts.Symbol): readonly ts.Symbol[] {
		return checker.getExportsOfModule(symbol);
	},
	getName(symbol: ts.Symbol): string {
		return symbol.getName();
	},
	getDeclarations(symbol: ts.Symbol): readonly ts.Declaration[] | undefined {
		return symbol.getDeclarations();
	},
	getSymbolAtLocation(checker: ts.TypeChecker, node: ts.Node): ts.Symbol | undefined {
		return checker.getSymbolAtLocation(node);
	},
	isExternalModule: ts.isExternalModule
};

/** @internal Mutable only so focused tests can replace the exact fresh-Program capability. */
export const declarationContextAnalysisCompilerProgramCapability = {
	createCompilerProjectProgramSession
};

const INPUT_KEYS = [
	'conditionalExportRequest',
	'conditionalExportResolution',
	'frozenSubject',
	'moduleResolutionRequest',
	'moduleResolutionTrace',
	'projectContextGraph',
	'request',
	'semanticSnapshot'
] as const;
const REQUEST_KEYS = [
	'budgets',
	'conditionalExportResolution',
	'exportName',
	'moduleResolutionTrace',
	'operationVersion',
	'projectContextGraph',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxAliasHops',
	'maxArtifacts',
	'maxCompilerInputAttempts',
	'maxDeclarations',
	'maxDiagnostics',
	'maxDurationMs',
	'maxExportSymbols',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxOutputRecords',
	'maxParsedArtifactAstNodes',
	'maxProgramAstNodes',
	'maxProgramReadBytes',
	'maxProgramSourceFiles',
	'maxReadBytes',
	'maxRelations',
	'maxTraversalSteps'
] as const;
const GRAPH_REFERENCE_KEYS = ['contentDigest', 'graphId', 'inputDigest'] as const;
const SNAPSHOT_REFERENCE_KEYS = ['contentDigest', 'id', 'inputDigest'] as const;
const SELECTION_KEYS = Object.freeze(Object.keys(DECLARATION_CONTEXT_ANALYSIS_SELECTION));
const SHA256 = /^[a-f0-9]{64}$/u;
const RESOURCE_CHECKPOINT_CADENCE = 256;

interface PlainDataUsage {
	readonly records: number;
	readonly stringCharacters: number;
}

interface TelemetryRecorder {
	activePhase(): DeclarationContextAnalysisProgressPhase | null;
	complete(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	fail(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	finish<Outcome extends DeclarationContextAnalysisBuildOutcome>(outcome: Outcome): Outcome;
	start(
		phase: DeclarationContextAnalysisProgressPhase,
		counts?: Readonly<Record<string, number>>
	): void;
}

class DeclarationContextAnalysisFailure extends Error {
	constructor(
		readonly code: DeclarationContextAnalysisDiagnostic['code'],
		message: string,
		readonly phase: DeclarationContextAnalysisDiagnostic['phase'],
		readonly path: string | null = null
	) {
		super(message);
		this.name = 'DeclarationContextAnalysisFailure';
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
	readonly maxDurationMs: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
} {
	const inputs = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const request = exactPlainRecord(inputs.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(request.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	for (const key of ['maxDurationMs', 'maxInputRecords', 'maxInputStringCharacters'] as const)
		if (!Number.isSafeInteger(budgets[key]) || (budgets[key] as number) < 1)
			throw new TypeError(`$inputs.request.budgets.${key} must be a positive safe integer.`);
	return {
		maxDurationMs: budgets.maxDurationMs as number,
		maxInputRecords: budgets.maxInputRecords as number,
		maxInputStringCharacters: budgets.maxInputStringCharacters as number
	};
}

type PreflightWork =
	| {
			readonly index: number;
			readonly kind: 'ARRAY';
			readonly length: number;
			readonly value: readonly unknown[];
	  }
	| { readonly kind: 'LEAVE'; readonly value: object }
	| {
			readonly index: number;
			readonly keys: readonly string[];
			readonly kind: 'OBJECT';
			readonly value: object;
	  }
	| { readonly kind: 'VISIT'; readonly value: unknown };

interface PreflightState {
	readonly active: WeakSet<object>;
	readonly addStringCharacters: (amount: number) => void;
	readonly maxInputRecords: number;
	readonly pending: PreflightWork[];
	records: number;
	readonly step: () => void;
}

function createCheckpointStep(onProgress?: () => void): () => void {
	let workSinceProgress = 0;
	return (): void => {
		if (onProgress === undefined) return;
		workSinceProgress += 1;
		if (workSinceProgress < RESOURCE_CHECKPOINT_CADENCE) return;
		workSinceProgress = 0;
		onProgress();
	};
}

function assertUnicodeScalarText(text: string, message: string, step: () => void): void {
	for (let index = 0; index < text.length; index += 1) {
		step();
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = text.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) throw new TypeError(message);
			index += 1;
			step();
		} else if (code >= 0xdc00 && code <= 0xdfff) throw new TypeError(message);
	}
}

function preflightArrayElement(
	work: Extract<PreflightWork, { kind: 'ARRAY' }>,
	pending: PreflightWork[],
	addStringCharacters: (amount: number) => void
): void {
	if (work.index >= work.length) return;
	const key = String(work.index);
	addStringCharacters(key.length);
	const descriptor = Reflect.getOwnPropertyDescriptor(work.value, key);
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
		throw new TypeError('Input arrays must contain enumerable data elements.');
	pending.push(
		{
			index: work.index + 1,
			kind: 'ARRAY',
			length: work.length,
			value: work.value
		},
		{ kind: 'VISIT', value: descriptor.value }
	);
}

function preflightObjectProperty(
	work: Extract<PreflightWork, { kind: 'OBJECT' }>,
	pending: PreflightWork[],
	addStringCharacters: (amount: number) => void,
	step: () => void
): void {
	if (work.index >= work.keys.length) return;
	const key = work.keys[work.index]!;
	addStringCharacters(key.length);
	assertUnicodeScalarText(key, 'Input keys must contain Unicode scalar text.', step);
	const descriptor = Reflect.getOwnPropertyDescriptor(work.value, key);
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
		throw new TypeError('Input records must contain enumerable data properties.');
	pending.push(
		{
			index: work.index + 1,
			keys: work.keys,
			kind: 'OBJECT',
			value: work.value
		},
		{ kind: 'VISIT', value: descriptor.value }
	);
}

function preflightArrayValue(
	value: readonly unknown[],
	pending: PreflightWork[],
	records: number,
	maxInputRecords: number,
	step: () => void
): void {
	if (Reflect.getPrototypeOf(value) !== Array.prototype)
		throw new TypeError('Input arrays must use Array.prototype.');
	const count = value.length;
	if (count > maxInputRecords - records)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'Input array population exhausted the plain-data record budget.',
			'REQUEST_BIND',
			'$.request.budgets.maxInputRecords'
		);
	const ownKeys = Reflect.ownKeys(value);
	let exactArrayKeys = ownKeys.length === count + 1;
	for (const key of ownKeys) {
		step();
		if (typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key)))
			exactArrayKeys = false;
	}
	if (!exactArrayKeys) throw new TypeError('Input arrays must be dense exact data arrays.');
	if (count > 0) pending.push({ index: 0, kind: 'ARRAY', length: count, value });
}

function preflightRecordValue(
	value: object,
	pending: PreflightWork[],
	records: number,
	maxInputRecords: number,
	step: () => void
): void {
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError('Input records must use a plain prototype.');
	const ownKeys = Reflect.ownKeys(value);
	for (const key of ownKeys) {
		step();
		if (typeof key !== 'string') throw new TypeError('Input records may not contain symbol keys.');
	}
	if (records + ownKeys.length > maxInputRecords)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'Input property population exhausted the plain-data record budget.',
			'REQUEST_BIND',
			'$.request.budgets.maxInputRecords'
		);
	if (ownKeys.length > 0)
		pending.push({
			index: 0,
			keys: ownKeys as string[],
			kind: 'OBJECT',
			value
		});
}

function preflightVisitValue(
	work: Extract<PreflightWork, { kind: 'VISIT' }>,
	state: PreflightState
): void {
	state.records += 1;
	if (state.records > state.maxInputRecords)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'Input plain-data record budget was exhausted.',
			'REQUEST_BIND',
			'$.request.budgets.maxInputRecords'
		);
	if (typeof work.value === 'string') {
		state.addStringCharacters(work.value.length);
		assertUnicodeScalarText(
			work.value,
			'Input strings must contain Unicode scalar text.',
			state.step
		);
		return;
	}
	if (
		work.value === null ||
		typeof work.value === 'boolean' ||
		(typeof work.value === 'number' &&
			Number.isSafeInteger(work.value) &&
			!Object.is(work.value, -0))
	)
		return;
	if (typeof work.value !== 'object' || isProxy(work.value))
		throw new TypeError('Inputs must contain only inert JSON-compatible plain data.');
	if (state.active.has(work.value)) throw new TypeError('Input plain data may not contain cycles.');
	state.active.add(work.value);
	state.pending.push({ kind: 'LEAVE', value: work.value });
	if (Array.isArray(work.value)) {
		preflightArrayValue(
			work.value,
			state.pending,
			state.records,
			state.maxInputRecords,
			state.step
		);
		return;
	}
	preflightRecordValue(work.value, state.pending, state.records, state.maxInputRecords, state.step);
}

function preflightPlainData(
	value: unknown,
	limits: { readonly maxInputRecords: number; readonly maxInputStringCharacters: number },
	onProgress?: () => void
): PlainDataUsage {
	const pending: PreflightWork[] = [{ kind: 'VISIT', value }];
	const active = new WeakSet<object>();
	let stringCharacters = 0;
	const step = createCheckpointStep(onProgress);
	const addStringCharacters = (amount: number): void => {
		stringCharacters += amount;
		if (
			!Number.isSafeInteger(stringCharacters) ||
			stringCharacters > limits.maxInputStringCharacters
		)
			throw new DeclarationContextAnalysisFailure(
				'BUDGET_EXCEEDED',
				'Input string-character budget was exhausted.',
				'REQUEST_BIND',
				'$.request.budgets.maxInputStringCharacters'
			);
	};
	const state: PreflightState = {
		active,
		addStringCharacters,
		maxInputRecords: limits.maxInputRecords,
		pending,
		records: 0,
		step
	};
	onProgress?.();
	while (pending.length > 0) {
		step();
		const work = pending.pop()!;
		if (work.kind === 'LEAVE') {
			active.delete(work.value);
			continue;
		}
		if (work.kind === 'ARRAY') {
			preflightArrayElement(work, pending, addStringCharacters);
			continue;
		}
		if (work.kind === 'OBJECT') {
			preflightObjectProperty(work, pending, addStringCharacters, step);
			continue;
		}
		preflightVisitValue(work, state);
	}
	onProgress?.();
	return { records: state.records, stringCharacters };
}

function sameSelectionArray(
	actual: unknown,
	expected: readonly unknown[],
	onProgress: () => void
): boolean {
	if (!Array.isArray(actual) || actual.length !== expected.length) return false;
	for (let index = 0; index < expected.length; index += 1) {
		onProgress();
		const descriptor = Object.getOwnPropertyDescriptor(actual, String(index));
		if (
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor) ||
			!sameSelectionValue(descriptor.value, expected[index], onProgress)
		)
			return false;
	}
	return true;
}

function sameSelectionRecord(
	actual: unknown,
	expectedRecord: Readonly<Record<string, unknown>>,
	onProgress: () => void
): boolean {
	if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
	const expectedKeys = Object.keys(expectedRecord);
	const actualKeys = Reflect.ownKeys(actual);
	onProgress();
	if (actualKeys.length !== expectedKeys.length) return false;
	for (const key of actualKeys) {
		onProgress();
		if (typeof key !== 'string' || !Object.hasOwn(expectedRecord, key)) return false;
	}
	for (const key of expectedKeys) {
		onProgress();
		const descriptor = Object.getOwnPropertyDescriptor(actual, key);
		if (
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor) ||
			!sameSelectionValue(descriptor.value, expectedRecord[key], onProgress)
		)
			return false;
	}
	return true;
}

function sameSelectionValue(actual: unknown, expected: unknown, onProgress: () => void): boolean {
	onProgress();
	if (typeof expected === 'string')
		return typeof actual === 'string' && sameTextWithProgress(actual, expected, onProgress);
	if (expected === null || typeof expected !== 'object') return Object.is(actual, expected);
	if (Array.isArray(expected)) return sameSelectionArray(actual, expected, onProgress);
	return sameSelectionRecord(actual, expected as Readonly<Record<string, unknown>>, onProgress);
}

function sameSelection(
	selection: Readonly<Record<string, unknown>>,
	onProgress: () => void
): boolean {
	for (const key of SELECTION_KEYS) {
		onProgress();
		if (
			!sameSelectionValue(
				selection[key],
				DECLARATION_CONTEXT_ANALYSIS_SELECTION[
					key as keyof typeof DECLARATION_CONTEXT_ANALYSIS_SELECTION
				],
				onProgress
			)
		)
			return false;
	}
	return true;
}

function materializeInputs(
	value: unknown,
	onProgress: () => void
): DeclarationContextAnalysisBuildInputs {
	const inputs = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const request = exactPlainRecord(inputs.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(request.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	const graphReference = exactPlainRecord(
		request.projectContextGraph,
		GRAPH_REFERENCE_KEYS,
		'$inputs.request.projectContextGraph'
	);
	const conditionalReference = exactPlainRecord(
		request.conditionalExportResolution,
		SNAPSHOT_REFERENCE_KEYS,
		'$inputs.request.conditionalExportResolution'
	);
	const moduleTraceReference = exactPlainRecord(
		request.moduleResolutionTrace,
		SNAPSHOT_REFERENCE_KEYS,
		'$inputs.request.moduleResolutionTrace'
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
				(budgets[key] as number) < (key === 'maxAliasHops' ? 0 : 1)
		) ||
		(budgets.maxDiagnostics as number) > 100_000
	)
		throw new DeclarationContextAnalysisFailure(
			'REQUEST_INVALID',
			'Declaration-context budgets must be bounded positive safe integers, except maxAliasHops may be zero.',
			'REQUEST_BIND',
			'$.request.budgets'
		);
	if ((budgets.maxReadBytes as number) < (budgets.maxProgramReadBytes as number))
		throw new DeclarationContextAnalysisFailure(
			'REQUEST_INVALID',
			'maxReadBytes must cover maxProgramReadBytes.',
			'REQUEST_BIND',
			'$.request.budgets.maxReadBytes'
		);
	if (
		request.schemaVersion !== DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION ||
		request.operationVersion !== DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION ||
		!sameSelection(selection, onProgress)
	)
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'The declaration-context request version, operation, or selection is unsupported.',
			'REQUEST_BIND',
			'$.request'
		);
	if (
		typeof request.exportName !== 'string' ||
		request.exportName.length === 0 ||
		!isUnicodeScalarString(request.exportName)
	)
		throw new DeclarationContextAnalysisFailure(
			'REQUEST_INVALID',
			'The selected export name must be nonempty Unicode scalar text.',
			'REQUEST_BIND',
			'$.request.exportName'
		);
	if (
		typeof request.subjectId !== 'string' ||
		!SHA256.test(request.subjectId) ||
		typeof request.semanticSnapshotId !== 'string' ||
		request.semanticSnapshotId.length === 0 ||
		typeof graphReference.graphId !== 'string' ||
		graphReference.graphId.length === 0 ||
		!SHA256.test(graphReference.contentDigest as string) ||
		!SHA256.test(graphReference.inputDigest as string) ||
		typeof conditionalReference.id !== 'string' ||
		conditionalReference.id.length === 0 ||
		!SHA256.test(conditionalReference.contentDigest as string) ||
		!SHA256.test(conditionalReference.inputDigest as string) ||
		typeof moduleTraceReference.id !== 'string' ||
		moduleTraceReference.id.length === 0 ||
		!SHA256.test(moduleTraceReference.contentDigest as string) ||
		!SHA256.test(moduleTraceReference.inputDigest as string)
	)
		throw new DeclarationContextAnalysisFailure(
			'REQUEST_INVALID',
			'Declaration-context request identities are invalid.',
			'REQUEST_BIND',
			'$.request'
		);
	return {
		conditionalExportRequest:
			inputs.conditionalExportRequest as DeclarationContextAnalysisBuildInputs['conditionalExportRequest'],
		conditionalExportResolution:
			inputs.conditionalExportResolution as DeclarationContextAnalysisBuildInputs['conditionalExportResolution'],
		frozenSubject: inputs.frozenSubject as DeclarationContextAnalysisBuildInputs['frozenSubject'],
		moduleResolutionRequest:
			inputs.moduleResolutionRequest as DeclarationContextAnalysisBuildInputs['moduleResolutionRequest'],
		moduleResolutionTrace:
			inputs.moduleResolutionTrace as DeclarationContextAnalysisBuildInputs['moduleResolutionTrace'],
		projectContextGraph:
			inputs.projectContextGraph as DeclarationContextAnalysisBuildInputs['projectContextGraph'],
		request: {
			...(request as unknown as DeclarationContextAnalysisBuildInputs['request']),
			budgets: {
				...(budgets as unknown as DeclarationContextAnalysisBuildInputs['request']['budgets'])
			},
			conditionalExportResolution: {
				...(conditionalReference as unknown as DeclarationContextAnalysisBuildInputs['request']['conditionalExportResolution'])
			},
			moduleResolutionTrace: {
				...(moduleTraceReference as unknown as DeclarationContextAnalysisBuildInputs['request']['moduleResolutionTrace'])
			},
			projectContextGraph: {
				...(graphReference as unknown as DeclarationContextAnalysisBuildInputs['request']['projectContextGraph'])
			},
			selection: DECLARATION_CONTEXT_ANALYSIS_SELECTION
		},
		semanticSnapshot:
			inputs.semanticSnapshot as DeclarationContextAnalysisBuildInputs['semanticSnapshot']
	};
}

function clonePlainData<Value>(
	value: Value,
	seen = new WeakMap<object, unknown>(),
	onProgress?: () => void
): Value {
	onProgress?.();
	if (value === null || typeof value !== 'object') return value;
	const object = value as object;
	const prior = seen.get(object);
	if (prior !== undefined) return prior as Value;
	if (Array.isArray(value)) {
		const result: unknown[] = [];
		seen.set(object, result);
		for (const child of value) result.push(clonePlainData(child, seen, onProgress));
		return result as Value;
	}
	const result: Record<string, unknown> = {};
	seen.set(object, result);
	for (const key of Object.keys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor !== undefined && 'value' in descriptor)
			result[key] = clonePlainData(descriptor.value, seen, onProgress);
	}
	return result as Value;
}

function deepFreezeMember(
	container: object,
	key: string,
	seen: WeakSet<object>,
	onProgress?: () => void
): void {
	onProgress?.();
	const descriptor = Reflect.getOwnPropertyDescriptor(container, key);
	if (descriptor !== undefined && 'value' in descriptor)
		deepFreeze(descriptor.value, seen, onProgress);
}

function deepFreeze<Value>(
	value: Value,
	seen = new WeakSet<object>(),
	onProgress?: () => void
): Value {
	onProgress?.();
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
	const object = value as object;
	if (seen.has(object)) return value;
	seen.add(object);
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index += 1)
			deepFreezeMember(object, String(index), seen, onProgress);
	} else {
		for (const key of Object.keys(object)) deepFreezeMember(object, key, seen, onProgress);
	}
	return Object.freeze(value);
}

function checkedAdd(...values: readonly number[]): number {
	let total = 0;
	for (const value of values) {
		total += value;
		if (!Number.isSafeInteger(total))
			throw new DeclarationContextAnalysisFailure(
				'BUDGET_EXCEEDED',
				'An exact declaration-context population exceeds safe-integer range.',
				'INPUT_BUDGET'
			);
	}
	return total;
}

function saturatedAdd(...values: readonly number[]): number {
	let total = 0;
	for (const value of values) {
		if (value > Number.MAX_SAFE_INTEGER - total) return Number.MAX_SAFE_INTEGER;
		total += value;
	}
	return total;
}

interface ResourceProgressHandle {
	readonly finish: () => void;
	readonly step: () => void;
}

function resourceProgress(onProgress: () => void): {
	readonly finish: () => void;
	readonly step: () => void;
} {
	let workSinceProgress = 0;
	onProgress();
	return {
		finish: onProgress,
		step(): void {
			workSinceProgress += 1;
			if (workSinceProgress < RESOURCE_CHECKPOINT_CADENCE) return;
			workSinceProgress = 0;
			onProgress();
		}
	};
}

function boundedCounts(counts: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
	const result: Record<string, number> = {};
	const orderedKeys = Object.keys(counts).sort((left, right) => compareText(left, right));
	for (const key of orderedKeys.slice(0, 16)) {
		const value = counts[key];
		if (Number.isSafeInteger(value) && value! >= 0) result[key] = value!;
	}
	return Object.freeze(result);
}

function telemetry(options: BuildDeclarationContextAnalysisOptions | undefined): TelemetryRecorder {
	let sink: ((event: DeclarationContextAnalysisProgressEvent) => void) | undefined;
	try {
		if (options !== undefined) {
			const record = exactPlainRecord(options, ['onProgress'], '$options');
			if (typeof record.onProgress === 'function')
				sink = record.onProgress as (event: DeclarationContextAnalysisProgressEvent) => void;
		}
	} catch {
		// Telemetry is out of band and cannot affect semantic evidence.
	}
	const events: DeclarationContextAnalysisProgressEvent[] = [];
	let active: DeclarationContextAnalysisProgressPhase | null = null;
	let sequence = 0;
	const emit = (
		phase: DeclarationContextAnalysisProgressPhase,
		state: DeclarationContextAnalysisProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				counts: boundedCounts(counts),
				detailCode,
				phase,
				schemaVersion: DECLARATION_CONTEXT_ANALYSIS_PROGRESS_SCHEMA_VERSION,
				sequence: sequence++,
				state
			})
		);
	};
	const close = (
		state: DeclarationContextAnalysisProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		if (active === null) return;
		emit(active, state, counts, detailCode);
		active = null;
	};
	return {
		activePhase(): DeclarationContextAnalysisProgressPhase | null {
			return active;
		},
		complete(counts = {}, detailCode = null): void {
			close('COMPLETED', counts, detailCode);
		},
		fail(counts = {}, detailCode = null): void {
			close('FAILED', counts, detailCode);
		},
		finish<Outcome extends DeclarationContextAnalysisBuildOutcome>(outcome: Outcome): Outcome {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			const frozen = (
				outcome.outcome === 'partial'
					? Object.freeze({
							analysis: outcome.analysis,
							diagnostics: Object.freeze([...outcome.diagnostics]),
							outcome: 'partial' as const
						})
					: deepFreeze(outcome)
			) as Outcome;
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

function compilerCapabilityFailure(
	error: CompilerProjectProgramCapabilityError,
	phase: DeclarationContextAnalysisProgressPhase
): DeclarationContextAnalysisFailure {
	let code: DeclarationContextAnalysisDiagnostic['code'];
	if (error.code === 'BUDGET_EXCEEDED') code = 'BUDGET_EXCEEDED';
	else if (error.code === 'CAPTURE_UNAVAILABLE') code = 'CAPTURE_INVALID';
	else code = 'PROGRAM_CONSTRUCTION_UNAVAILABLE';
	return new DeclarationContextAnalysisFailure(
		code,
		'Fresh captured TypeScript Program operation failed closed.',
		phase
	);
}

function unavailable(
	code: DeclarationContextAnalysisDiagnostic['code'],
	message: string,
	phase: DeclarationContextAnalysisDiagnostic['phase'],
	path: string | null = null
): DeclarationContextAnalysisBuildOutcome {
	return { diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' };
}

function cap010Inputs(
	inputs: DeclarationContextAnalysisBuildInputs
): ProjectContextGraphBuildInputs {
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

function assertInputBinding(inputs: DeclarationContextAnalysisBuildInputs): void {
	const {
		conditionalExportRequest,
		conditionalExportResolution,
		frozenSubject,
		moduleResolutionRequest,
		moduleResolutionTrace,
		projectContextGraph,
		request,
		semanticSnapshot
	} = inputs;
	if (!isFrozenSubjectCapability(frozenSubject))
		throw new DeclarationContextAnalysisFailure(
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
		request.subjectId !== moduleResolutionRequest.subjectId ||
		request.subjectId !== moduleResolutionTrace.subjectId ||
		request.semanticSnapshotId !== semanticSnapshot.id ||
		request.semanticSnapshotId !== projectContextGraph.semanticSnapshotId ||
		request.semanticSnapshotId !== conditionalExportRequest.semanticSnapshotId ||
		request.semanticSnapshotId !== conditionalExportResolution.semanticSnapshotId ||
		request.semanticSnapshotId !== moduleResolutionRequest.semanticSnapshotId ||
		request.semanticSnapshotId !== moduleResolutionTrace.semanticSnapshotId ||
		request.projectContextGraph.graphId !== projectContextGraph.id ||
		request.projectContextGraph.contentDigest !== projectContextGraph.contentDigest ||
		request.projectContextGraph.inputDigest !== projectContextGraph.inputDigest ||
		request.conditionalExportResolution.id !== conditionalExportResolution.id ||
		request.conditionalExportResolution.contentDigest !==
			conditionalExportResolution.contentDigest ||
		request.conditionalExportResolution.inputDigest !== conditionalExportResolution.inputDigest ||
		request.moduleResolutionTrace.id !== moduleResolutionTrace.id ||
		request.moduleResolutionTrace.contentDigest !== moduleResolutionTrace.contentDigest ||
		request.moduleResolutionTrace.inputDigest !== moduleResolutionTrace.inputDigest
	)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_IDENTITY_MISMATCH',
			'Request and predecessor identities do not bind exactly.',
			'REQUEST_BIND'
		);
	if (
		conditionalExportRequest.projectContextGraph.graphId !== projectContextGraph.id ||
		conditionalExportRequest.projectContextGraph.contentDigest !==
			projectContextGraph.contentDigest ||
		conditionalExportRequest.projectContextGraph.inputDigest !== projectContextGraph.inputDigest ||
		moduleResolutionRequest.projectContextGraph.graphId !== projectContextGraph.id ||
		moduleResolutionRequest.projectContextGraph.contentDigest !==
			projectContextGraph.contentDigest ||
		moduleResolutionRequest.projectContextGraph.inputDigest !== projectContextGraph.inputDigest ||
		moduleResolutionRequest.conditionalExportResolution.id !== conditionalExportResolution.id ||
		moduleResolutionRequest.conditionalExportResolution.contentDigest !==
			conditionalExportResolution.contentDigest ||
		moduleResolutionRequest.conditionalExportResolution.inputDigest !==
			conditionalExportResolution.inputDigest ||
		moduleResolutionTrace.projectContextGraph.graphId !== projectContextGraph.id ||
		moduleResolutionTrace.projectContextGraph.contentDigest !== projectContextGraph.contentDigest ||
		moduleResolutionTrace.projectContextGraph.inputDigest !== projectContextGraph.inputDigest ||
		moduleResolutionTrace.conditionalExportResolution.id !== conditionalExportResolution.id ||
		moduleResolutionTrace.conditionalExportResolution.contentDigest !==
			conditionalExportResolution.contentDigest ||
		moduleResolutionTrace.conditionalExportResolution.inputDigest !==
			conditionalExportResolution.inputDigest
	)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_IDENTITY_MISMATCH',
			'Predecessor request and result identities do not form one exact chain.',
			'REQUEST_BIND'
		);
	const target = moduleResolutionTrace.targetWitness;
	if (
		conditionalExportRequest.exportSubpath !== '.' ||
		conditionalExportResolution.decision.state !== 'SELECTED_TARGET' ||
		typeof conditionalExportResolution.decision.target !== 'string' ||
		moduleResolutionRequest.specifier !== moduleResolutionRequest.packageName ||
		target.packageName !== moduleResolutionRequest.packageName ||
		target.packageExportTarget !== conditionalExportResolution.decision.target ||
		target.artifactClass !== 'CONTEXT_ONLY' ||
		target.origin !== 'WORKSPACE_BUILD_DECLARATION' ||
		target.declarationFile !== true ||
		!['.d.ts', '.d.mts', '.d.cts'].includes(target.extension)
	)
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'The analysis requires one exact CAP-011 selected declaration package-root target.',
			'REQUEST_BIND',
			'$.moduleResolutionTrace.targetWitness'
		);
}

function validatePredecessors(
	inputs: DeclarationContextAnalysisBuildInputs,
	progress: TelemetryRecorder,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): DeclarationContextAnalysisSnapshot['semanticValidationWitness'] {
	const maxRecords = Math.min(
		inputs.request.budgets.maxInputRecords,
		inputs.moduleResolutionRequest.budgets.maxInputRecords,
		inputs.projectContextGraph.budgets.maxInputRecords
	);
	const maxStrings = Math.min(
		inputs.request.budgets.maxInputStringCharacters,
		inputs.moduleResolutionRequest.budgets.maxInputStringCharacters,
		inputs.projectContextGraph.budgets.maxInputStringCharacters
	);
	const maxIssues = Math.min(
		inputs.request.budgets.maxDiagnostics,
		inputs.moduleResolutionRequest.budgets.maxDiagnostics,
		inputs.projectContextGraph.budgets.maxDiagnostics
	);
	const validationOptions = {
		maxDepth: 4_096,
		maxInputRecords: maxRecords,
		maxInputStringCharacters: maxStrings,
		maxIssues,
		maxRecords,
		maxStringCharacters: maxStrings
	};

	progress.start('SEMANTIC_SNAPSHOT_VALIDATE');
	assertWithinDeadline('SEMANTIC_SNAPSHOT_VALIDATE');
	const semanticValidation = validateStaticSemanticSnapshot(
		inputs.semanticSnapshot,
		{
			maxDepth: validationOptions.maxDepth,
			maxDiagnostics: maxIssues,
			maxIssues,
			maxRecords,
			maxReferenceChecks: maxRecords,
			maxStringCharacters: maxStrings
		},
		{ frozenSubject: inputs.frozenSubject }
	);
	assertWithinDeadline('SEMANTIC_SNAPSHOT_VALIDATE');
	if (semanticValidation.state !== 'VALID')
		throw new DeclarationContextAnalysisFailure(
			semanticValidation.state === 'BUDGET_EXHAUSTED'
				? 'BUDGET_EXCEEDED'
				: 'SEMANTIC_SNAPSHOT_INVALID',
			'The semantic snapshot is not independently valid against the exact FrozenSubject.',
			'SEMANTIC_SNAPSHOT_VALIDATE',
			semanticValidation.issues[0]?.path ?? null
		);
	const frozenSubjectWitness = canonicalSemanticJsonWitnessWithProgress(inputs.frozenSubject, () =>
		assertWithinDeadline('SEMANTIC_SNAPSHOT_VALIDATE')
	);
	const semanticSnapshotWitness = canonicalSemanticJsonWitnessWithProgress(
		inputs.semanticSnapshot,
		() => assertWithinDeadline('SEMANTIC_SNAPSHOT_VALIDATE')
	);
	assertWithinDeadline('SEMANTIC_SNAPSHOT_VALIDATE');
	progress.complete({ validationIssues: 0 });

	progress.start('PROJECT_CONTEXT_GRAPH_VALIDATE');
	assertWithinDeadline('PROJECT_CONTEXT_GRAPH_VALIDATE');
	const graphValidation = validateConstructedProjectContextGraph(
		inputs.projectContextGraph,
		cap010Inputs(inputs),
		inputs.projectContextGraph.inputDigest,
		validationOptions
	);
	assertWithinDeadline('PROJECT_CONTEXT_GRAPH_VALIDATE');
	if (graphValidation.state !== 'VALID')
		throw new DeclarationContextAnalysisFailure(
			graphValidation.state === 'BUDGET_EXHAUSTED'
				? 'BUDGET_EXCEEDED'
				: 'PROJECT_CONTEXT_GRAPH_INVALID',
			'The CAP-010 project-context graph is not independently valid.',
			'PROJECT_CONTEXT_GRAPH_VALIDATE',
			graphValidation.issues[0]?.path ?? null
		);
	assertWithinDeadline('PROJECT_CONTEXT_GRAPH_VALIDATE');
	progress.complete({ validationIssues: 0 });

	progress.start('CONDITIONAL_EXPORT_RESOLUTION_VALIDATE');
	assertWithinDeadline('CONDITIONAL_EXPORT_RESOLUTION_VALIDATE');
	const conditionalValidation = validateConstructedConditionalExportResolution(
		inputs.conditionalExportResolution,
		{
			frozenSubject: inputs.frozenSubject,
			projectContextGraph: inputs.projectContextGraph,
			request: inputs.conditionalExportRequest,
			semanticSnapshot: inputs.semanticSnapshot
		},
		inputs.conditionalExportResolution.inputDigest,
		validationOptions
	);
	assertWithinDeadline('CONDITIONAL_EXPORT_RESOLUTION_VALIDATE');
	if (conditionalValidation.state !== 'VALID')
		throw new DeclarationContextAnalysisFailure(
			conditionalValidation.state === 'BUDGET_EXHAUSTED'
				? 'BUDGET_EXCEEDED'
				: 'CONDITIONAL_EXPORT_RESOLUTION_INVALID',
			'The CAP-012 conditional-export resolution is not independently valid.',
			'CONDITIONAL_EXPORT_RESOLUTION_VALIDATE',
			conditionalValidation.issues[0]?.path ?? null
		);
	assertWithinDeadline('CONDITIONAL_EXPORT_RESOLUTION_VALIDATE');
	progress.complete({ validationIssues: 0 });

	progress.start('MODULE_RESOLUTION_TRACE_VALIDATE');
	assertWithinDeadline('MODULE_RESOLUTION_TRACE_VALIDATE');
	const traceValidation = validateConstructedModuleResolutionTrace(
		inputs.moduleResolutionTrace,
		{
			conditionalExportRequest: inputs.conditionalExportRequest,
			conditionalExportResolution: inputs.conditionalExportResolution,
			frozenSubject: inputs.frozenSubject,
			projectContextGraph: inputs.projectContextGraph,
			request: inputs.moduleResolutionRequest,
			semanticSnapshot: inputs.semanticSnapshot
		},
		inputs.moduleResolutionTrace.inputDigest,
		validationOptions
	);
	assertWithinDeadline('MODULE_RESOLUTION_TRACE_VALIDATE');
	if (traceValidation.state !== 'VALID')
		throw new DeclarationContextAnalysisFailure(
			traceValidation.state === 'BUDGET_EXHAUSTED'
				? 'BUDGET_EXCEEDED'
				: 'MODULE_RESOLUTION_TRACE_INVALID',
			'The CAP-011 module-resolution trace is not independently valid.',
			'MODULE_RESOLUTION_TRACE_VALIDATE',
			traceValidation.issues[0]?.path ?? null
		);
	assertWithinDeadline('MODULE_RESOLUTION_TRACE_VALIDATE');
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

interface BoundProgramContext {
	readonly configPath: string;
	readonly programRecord: DeclarationContextAnalysisBuildInputs['semanticSnapshot']['programs'][number];
	readonly projectContextProgram: DeclarationContextAnalysisBuildInputs['projectContextGraph']['programs'][number];
	readonly projectContextProject: DeclarationContextAnalysisBuildInputs['projectContextGraph']['projects'][number];
	readonly projectRecord: DeclarationContextAnalysisBuildInputs['semanticSnapshot']['projects'][number];
	readonly sourceByLogicalPath: ReadonlyMap<string, SemanticSourceRecord>;
	readonly sourcePopulation: readonly DeclarationContextProgramSourceIdentity[];
	readonly targetSource: SemanticSourceRecord;
}

interface ArtifactDraft {
	readonly logicalPath: string;
	readonly roles: Set<DeclarationContextArtifactRole>;
	readonly source: SemanticSourceRecord;
	readonly sourceFile: ts.SourceFile;
}

interface AliasHopDraft {
	readonly aliasArtifactPaths: readonly string[];
	readonly aliasName: string;
	readonly aliasSymbolFlags: DeclarationContextSymbolFlagsBinding;
	readonly targetName: string;
}

interface DeclarationDraft {
	readonly end: number;
	readonly kind: DeclarationContextDeclarationKind;
	readonly logicalPath: string;
	readonly name: string;
	readonly nameEnd: number;
	readonly nameStart: number;
	readonly nativeKind: DeclarationContextDeclarationRecord['nativeKind'];
	readonly start: number;
}

interface ExportSpecifierCensusRecord {
	readonly end: number;
	readonly logicalPath: string;
	readonly nameEnd: number;
	readonly nameStart: number;
	readonly start: number;
}

interface ParsedArtifactDraft {
	readonly artifact: ArtifactDraft;
	readonly astNodes: number;
	readonly parsed: CompilerProjectParsedSource;
	readonly statements: number;
}

function compareText(left: string, right: string, onProgress?: () => void): number {
	if (onProgress === undefined) {
		if (left < right) return -1;
		if (left > right) return 1;
		return 0;
	}
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		onProgress();
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) return difference < 0 ? -1 : 1;
	}
	if (left.length < right.length) return -1;
	if (left.length > right.length) return 1;
	return 0;
}

function isUnicodeScalarTextWithProgress(text: string, onProgress: () => void): boolean {
	for (let index = 0; index < text.length; index += 1) {
		onProgress();
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = text.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) return false;
			index += 1;
			onProgress();
		} else if (code >= 0xdc00 && code <= 0xdfff) return false;
	}
	return true;
}

function sameTextWithProgress(left: string, right: string, onProgress: () => void): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		onProgress();
		if (left.charCodeAt(index) !== right.charCodeAt(index)) return false;
	}
	return true;
}

function oneExact<Value>(
	values: readonly Value[],
	message: string,
	phase: DeclarationContextAnalysisProgressPhase,
	code: DeclarationContextAnalysisDiagnostic['code'] = 'INPUT_POPULATION_MISMATCH'
): Value {
	if (values.length !== 1) throw new DeclarationContextAnalysisFailure(code, message, phase);
	return values[0]!;
}

function oneExactWhere<Value>(
	values: readonly Value[],
	predicate: (value: Value) => boolean,
	message: string,
	phase: DeclarationContextAnalysisProgressPhase
): Value {
	let match: Value | undefined;
	let matches = 0;
	for (const value of values) {
		if (!predicate(value)) continue;
		matches += 1;
		match = value;
	}
	if (matches !== 1 || match === undefined)
		throw new DeclarationContextAnalysisFailure('INPUT_POPULATION_MISMATCH', message, phase);
	return match;
}

function collectProgramSemanticSources(
	inputs: DeclarationContextAnalysisBuildInputs,
	programRecord: DeclarationContextAnalysisBuildInputs['semanticSnapshot']['programs'][number],
	deadline: ResourceProgressHandle
): {
	readonly sourceById: ReadonlyMap<string, SemanticSourceRecord>;
	readonly sourceByLogicalPath: ReadonlyMap<string, SemanticSourceRecord>;
	readonly sources: readonly SemanticSourceRecord[];
} {
	const sources: SemanticSourceRecord[] = [];
	for (const source of inputs.semanticSnapshot.sources) {
		deadline.step();
		if (source.programId === programRecord.id) sources.push(source);
	}
	const sourceById = new Map<string, SemanticSourceRecord>();
	const sourceByLogicalPath = new Map<string, SemanticSourceRecord>();
	let duplicateSourceId = false;
	for (const source of sources) {
		deadline.step();
		if (sourceById.has(source.id)) duplicateSourceId = true;
		if (sourceByLogicalPath.has(source.logicalPath))
			throw new DeclarationContextAnalysisFailure(
				'INPUT_POPULATION_MISMATCH',
				'The selected semantic Program repeats a logical source path.',
				'PROGRAM_SOURCE_ACCOUNT'
			);
		sourceById.set(source.id, source);
		sourceByLogicalPath.set(source.logicalPath, source);
	}
	let sourceIdsReconcile = !duplicateSourceId && sources.length === programRecord.sourceIds.length;
	for (const id of programRecord.sourceIds) {
		deadline.step();
		if (!sourceById.has(id)) sourceIdsReconcile = false;
	}
	if (!sourceIdsReconcile)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The semantic Program source population does not reproduce its source IDs.',
			'PROGRAM_SOURCE_ACCOUNT'
		);
	return { sourceById, sourceByLogicalPath, sources };
}

function resolveTargetSemanticSource(
	sourceById: ReadonlyMap<string, SemanticSourceRecord>,
	target: DeclarationContextAnalysisBuildInputs['moduleResolutionTrace']['targetWitness']
): SemanticSourceRecord {
	const targetSource = sourceById.get(target.semanticSourceId);
	if (targetSource === undefined)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The CAP-011 declaration target source is not uniquely present in its Program.',
			'PROGRAM_SOURCE_ACCOUNT'
		);
	if (
		targetSource.logicalPath !== target.logicalPath ||
		targetSource.projectId !== target.semanticProjectId ||
		targetSource.bytes !== target.bytes ||
		targetSource.contentSha256 !== target.contentSha256 ||
		targetSource.analysisDisposition !== 'CONTEXT_ONLY' ||
		targetSource.artifactClass !== 'CONTEXT_ONLY' ||
		targetSource.origin !== 'WORKSPACE_BUILD_DECLARATION' ||
		targetSource.declarationFile !== true
	)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The CAP-011 target does not reproduce one exact context-only semantic source.',
			'PROGRAM_SOURCE_ACCOUNT'
		);
	return targetSource;
}

function bindProgramContext(
	inputs: DeclarationContextAnalysisBuildInputs,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): BoundProgramContext {
	const deadline = resourceProgress(() => assertWithinDeadline('PROGRAM_CONSTRUCT'));
	const target = inputs.moduleResolutionTrace.targetWitness;
	const programRecord = oneExactWhere(
		inputs.semanticSnapshot.programs,
		(record) => {
			deadline.step();
			return record.id === target.semanticProgramId;
		},
		'The CAP-011 target semantic Program is not uniquely present.',
		'PROGRAM_CONSTRUCT'
	);
	const projectRecord = oneExactWhere(
		inputs.semanticSnapshot.projects,
		(record) => {
			deadline.step();
			return record.id === target.semanticProjectId;
		},
		'The CAP-011 target semantic project is not uniquely present.',
		'PROGRAM_CONSTRUCT'
	);
	if (programRecord.projectId !== projectRecord.id || projectRecord.programId !== programRecord.id)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The target semantic project and Program do not bind bidirectionally.',
			'PROGRAM_CONSTRUCT'
		);
	if (programRecord.sourceIds.length > inputs.request.budgets.maxProgramSourceFiles)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'The selected semantic Program source population exceeds maxProgramSourceFiles.',
			'PROGRAM_SOURCE_ACCOUNT',
			'$.request.budgets.maxProgramSourceFiles'
		);
	const projectContextProgram = oneExactWhere(
		inputs.projectContextGraph.programs,
		(record) => {
			deadline.step();
			return record.semanticProgramId === programRecord.id;
		},
		'The target project-context Program is not uniquely present.',
		'PROGRAM_CONSTRUCT'
	);
	const projectContextProject = oneExactWhere(
		inputs.projectContextGraph.projects,
		(record) => {
			deadline.step();
			return record.id === projectContextProgram.projectId;
		},
		'The target project-context project is not uniquely present.',
		'PROGRAM_CONSTRUCT'
	);
	const importer = inputs.moduleResolutionTrace.importerWitness;
	if (
		projectContextProgram.id !== importer.projectContextProgramId ||
		projectContextProject.id !== importer.projectContextProjectId ||
		projectContextProgram.semanticProjectId !== projectRecord.id ||
		projectContextProject.semanticProjectId !== projectRecord.id ||
		projectContextProject.programId !== projectContextProgram.id ||
		projectContextProject.configPath !== projectRecord.configPath
	)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_IDENTITY_MISMATCH',
			'The CAP-011 importer and CAP-010 target Program context do not bind exactly.',
			'PROGRAM_CONSTRUCT'
		);
	const { sourceById, sourceByLogicalPath, sources } = collectProgramSemanticSources(
		inputs,
		programRecord,
		deadline
	);
	const targetSource = resolveTargetSemanticSource(sourceById, target);
	const sourcePopulation = sources.map((source) => {
		deadline.step();
		return {
			bytes: source.bytes,
			contentSha256: source.contentSha256,
			declarationFile: source.declarationFile,
			logicalPath: source.logicalPath,
			origin: source.origin,
			semanticSourceId: source.id
		};
	});
	deadline.finish();
	return {
		configPath: projectRecord.configPath,
		programRecord,
		projectContextProgram,
		projectContextProject,
		projectRecord,
		sourceByLogicalPath,
		sourcePopulation,
		targetSource
	};
}

function countAstNodes(
	root: ts.Node,
	current: number,
	limit: number,
	assertWithinDeadline: () => void,
	phase: DeclarationContextAnalysisProgressPhase,
	visit?: (node: ts.Node) => void
): number {
	const pending: ts.Node[] = [root];
	let total = current;
	while (pending.length > 0) {
		assertWithinDeadline();
		const node = pending.pop()!;
		total = checkedAdd(total, 1);
		if (total > limit)
			throw new DeclarationContextAnalysisFailure(
				'BUDGET_EXCEEDED',
				'Public TypeScript AST traversal exhausted its exact node budget.',
				phase
			);
		visit?.(node);
		const children: ts.Node[] = [];
		declarationContextAnalysisTypeScriptPublicApi.forEachChild(node, (child) => {
			assertWithinDeadline();
			if (pending.length + children.length >= limit - total)
				throw new DeclarationContextAnalysisFailure(
					'BUDGET_EXCEEDED',
					'Public TypeScript AST traversal exhausted its exact node budget.',
					phase
				);
			children.push(child);
		});
		assertWithinDeadline();
		for (let index = children.length - 1; index >= 0; index -= 1) {
			assertWithinDeadline();
			pending.push(children[index]!);
		}
	}
	return total;
}

function sourceExtension(logicalPath: string): DeclarationContextArtifactRecord['extension'] {
	if (logicalPath.endsWith('.d.mts')) return '.d.mts';
	if (logicalPath.endsWith('.d.cts')) return '.d.cts';
	if (logicalPath.endsWith('.d.ts')) return '.d.ts';
	throw new DeclarationContextAnalysisFailure(
		'UNSUPPORTED_REQUEST',
		'Consumed declaration artifacts must use a supported declaration extension.',
		'ARTIFACT_BIND'
	);
}

function symbolFlagsBinding(symbol: ts.Symbol): DeclarationContextSymbolFlagsBinding {
	const mask = symbol.flags;
	if (!Number.isSafeInteger(mask) || mask < 0)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'TypeScript returned an invalid public SymbolFlags mask.',
			'ALIAS_RESOLVE'
		);
	if (mask === 0)
		return { compilerVersion: TYPESCRIPT_PROVIDER_VERSION, nativeMask: 0, nativeNames: ['None'] };
	const codes = new Set<number>();
	for (const value of Object.values(ts.SymbolFlags))
		if (
			typeof value === 'number' &&
			value > 0 &&
			(value & (value - 1)) === 0 &&
			(mask & value) !== 0
		)
			codes.add(value);
	const nativeNames = [...codes]
		.sort((left, right) => left - right)
		.map((code) => (ts.SymbolFlags as unknown as Record<number, string>)[code])
		.filter((name): name is string => typeof name === 'string');
	const representedMask = [...codes].reduce((sum, code) => sum + code, 0);
	if (nativeNames.length !== codes.size || representedMask !== mask)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'TypeScript SymbolFlags cannot be represented by the public single-bit profile.',
			'ALIAS_RESOLVE'
		);
	return { compilerVersion: TYPESCRIPT_PROVIDER_VERSION, nativeMask: mask, nativeNames };
}

function isTopLevelDeclarationPlacement(declaration: ts.Declaration): boolean {
	if (ts.isVariableDeclaration(declaration))
		return (
			ts.isVariableDeclarationList(declaration.parent) &&
			ts.isVariableStatement(declaration.parent.parent) &&
			ts.isSourceFile(declaration.parent.parent.parent)
		);
	return ts.isSourceFile(declaration.parent);
}

function terminalDeclarationKindBinding(declaration: ts.Declaration): {
	readonly kind: DeclarationContextDeclarationKind;
	readonly nameNode: ts.Identifier | undefined;
} {
	if (ts.isClassDeclaration(declaration))
		return {
			kind: DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE.ClassDeclaration,
			nameNode: declaration.name
		};
	if (ts.isEnumDeclaration(declaration))
		return {
			kind: DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE.EnumDeclaration,
			nameNode: declaration.name
		};
	if (ts.isFunctionDeclaration(declaration))
		return {
			kind: DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE.FunctionDeclaration,
			nameNode: declaration.name
		};
	if (ts.isInterfaceDeclaration(declaration))
		return {
			kind: DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE.InterfaceDeclaration,
			nameNode: declaration.name
		};
	if (ts.isModuleDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
		if ((declaration.flags & ts.NodeFlags.GlobalAugmentation) !== 0)
			throw new DeclarationContextAnalysisFailure(
				'UNSUPPORTED_REQUEST',
				'Global augmentation is unsupported by the v1 declaration-context slice.',
				'TERMINAL_DECLARATION_BIND'
			);
		return {
			kind: DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE.ModuleDeclarationIdentifierName,
			nameNode: declaration.name
		};
	}
	if (ts.isTypeAliasDeclaration(declaration))
		return {
			kind: DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE.TypeAliasDeclaration,
			nameNode: declaration.name
		};
	if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name))
		return {
			kind: DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE.VariableDeclaration,
			nameNode: declaration.name
		};
	throw new DeclarationContextAnalysisFailure(
		'UNSUPPORTED_REQUEST',
		'The selected terminal symbol has an unsupported declaration kind.',
		'TERMINAL_DECLARATION_BIND'
	);
}

function supportedDeclaration(
	declaration: ts.Declaration,
	logicalPath: string,
	onProgress: () => void,
	assertWithinDeadline: () => void
): DeclarationDraft {
	if (!isTopLevelDeclarationPlacement(declaration))
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'Terminal declarations must have top-level SourceFile placement in the v1 slice.',
			'TERMINAL_DECLARATION_BIND'
		);
	const { kind, nameNode } = terminalDeclarationKindBinding(declaration);
	if (nameNode === undefined || !isUnicodeScalarTextWithProgress(nameNode.text, onProgress))
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'The selected terminal declaration lacks a supported identifier name.',
			'TERMINAL_DECLARATION_BIND'
		);
	const sourceFile = declaration.getSourceFile();
	assertWithinDeadline();
	const nativeName = ts.SyntaxKind[declaration.kind];
	if (typeof nativeName !== 'string')
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'TypeScript returned an unrepresentable public SyntaxKind.',
			'TERMINAL_DECLARATION_BIND'
		);
	const nameStart = nameNode.getStart(sourceFile);
	assertWithinDeadline();
	const start = declaration.getStart(sourceFile);
	assertWithinDeadline();
	return {
		end: declaration.end,
		kind,
		logicalPath,
		name: nameNode.text,
		nameEnd: nameNode.end,
		nameStart,
		nativeKind: {
			compilerVersion: TYPESCRIPT_PROVIDER_VERSION,
			nativeCode: declaration.kind,
			nativeName
		},
		start
	};
}

function compareDeclarationDraft(
	left: DeclarationDraft,
	right: DeclarationDraft,
	onProgress?: () => void
): number {
	return (
		compareText(left.logicalPath, right.logicalPath, onProgress) ||
		left.start - right.start ||
		left.end - right.end ||
		left.nativeKind.nativeCode - right.nativeKind.nativeCode ||
		compareText(left.name, right.name, onProgress)
	);
}

function sameDeclarationDraft(
	left: DeclarationDraft,
	right: DeclarationDraft,
	onProgress?: () => void
): boolean {
	const sameText = (leftText: string, rightText: string): boolean =>
		onProgress === undefined
			? leftText === rightText
			: sameTextWithProgress(leftText, rightText, onProgress);
	return (
		left.end === right.end &&
		left.kind === right.kind &&
		sameText(left.logicalPath, right.logicalPath) &&
		sameText(left.name, right.name) &&
		left.nameEnd === right.nameEnd &&
		left.nameStart === right.nameStart &&
		sameText(left.nativeKind.compilerVersion, right.nativeKind.compilerVersion) &&
		left.nativeKind.nativeCode === right.nativeKind.nativeCode &&
		sameText(left.nativeKind.nativeName, right.nativeKind.nativeName) &&
		left.start === right.start
	);
}

function unsupportedTopLevelBindingName(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	onProgress: () => void
): ts.Identifier | undefined {
	if (ts.isImportEqualsDeclaration(node) && node.parent === sourceFile) return node.name;
	if (ts.isImportClause(node) && node.parent.parent === sourceFile) return node.name;
	if (ts.isNamespaceImport(node) && node.parent.parent.parent === sourceFile) return node.name;
	if (ts.isImportSpecifier(node) && node.parent.parent.parent.parent === sourceFile)
		return node.name;
	if (!ts.isBindingElement(node) || !ts.isIdentifier(node.name)) return undefined;
	const bindingName = node.name;
	let container: ts.Node = node;
	while (
		ts.isBindingElement(container.parent) ||
		ts.isArrayBindingPattern(container.parent) ||
		ts.isObjectBindingPattern(container.parent)
	) {
		onProgress();
		container = container.parent;
	}
	const declaration = container.parent;
	if (
		ts.isVariableDeclaration(declaration) &&
		ts.isVariableDeclarationList(declaration.parent) &&
		ts.isVariableStatement(declaration.parent.parent) &&
		declaration.parent.parent.parent === sourceFile
	)
		return bindingName;
	return undefined;
}

function isTopLevelVariableDeclarationWithIdentifierName(
	node: ts.Node,
	sourceFile: ts.SourceFile
): node is ts.VariableDeclaration & { readonly name: ts.Identifier } {
	return (
		ts.isVariableDeclaration(node) &&
		ts.isIdentifier(node.name) &&
		ts.isVariableDeclarationList(node.parent) &&
		ts.isVariableStatement(node.parent.parent) &&
		node.parent.parent.parent === sourceFile
	);
}

function isSupportedTerminalDeclarationNode(node: ts.Node, variable: boolean): boolean {
	return (
		ts.isClassDeclaration(node) ||
		ts.isEnumDeclaration(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		(ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) ||
		ts.isTypeAliasDeclaration(node) ||
		variable
	);
}

function censusTopLevelTerminalDeclaration(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	logicalPath: string,
	terminalName: string,
	onProgress: () => void,
	assertWithinDeadline: () => void
): DeclarationDraft | null {
	const unsupportedBindingName = unsupportedTopLevelBindingName(node, sourceFile, onProgress);
	if (
		unsupportedBindingName !== undefined &&
		sameTextWithProgress(unsupportedBindingName.text, terminalName, onProgress)
	)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'An independently parsed unsupported top-level binding collides with the terminal symbol name.',
			'ARTIFACT_PARSE_ACCOUNT'
		);
	const variable = isTopLevelVariableDeclarationWithIdentifierName(node, sourceFile);
	const direct = node.parent === sourceFile;
	const namedNode = node as ts.NamedDeclaration;
	let name: ts.Identifier | undefined;
	if (variable) name = node.name;
	else if (direct && namedNode.name !== undefined && ts.isIdentifier(namedNode.name))
		name = namedNode.name;
	if (name === undefined || !sameTextWithProgress(name.text, terminalName, onProgress)) return null;
	if (!isSupportedTerminalDeclarationNode(node, variable))
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'An independently parsed top-level terminal-name binding has an unsupported declaration kind.',
			'ARTIFACT_PARSE_ACCOUNT'
		);
	return supportedDeclaration(
		node as ts.Declaration,
		logicalPath,
		onProgress,
		assertWithinDeadline
	);
}

function exportSpecifierCensusRecord(
	declaration: ts.ExportSpecifier,
	sourceFile: ts.SourceFile,
	logicalPath: string,
	assertWithinDeadline: () => void
): ExportSpecifierCensusRecord {
	const nameStart = declaration.name.getStart(sourceFile);
	assertWithinDeadline();
	const start = declaration.getStart(sourceFile);
	assertWithinDeadline();
	return {
		end: declaration.end,
		logicalPath,
		nameEnd: declaration.name.end,
		nameStart,
		start
	};
}

function compareExportSpecifierCensus(
	left: ExportSpecifierCensusRecord,
	right: ExportSpecifierCensusRecord,
	onProgress?: () => void
): number {
	return (
		compareText(left.logicalPath, right.logicalPath, onProgress) ||
		left.start - right.start ||
		left.end - right.end ||
		left.nameStart - right.nameStart ||
		left.nameEnd - right.nameEnd
	);
}

function refuseAmbientEffectNode(node: ts.Node): void {
	if (
		ts.isNamespaceExportDeclaration(node) ||
		(ts.isModuleDeclaration(node) &&
			(ts.isStringLiteral(node.name) || (node.flags & ts.NodeFlags.GlobalAugmentation) !== 0))
	)
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'Module/global augmentation and export-as-namespace effects are unsupported by the v1 slice.',
			'ARTIFACT_PARSE_ACCOUNT'
		);
}

interface CompilerDerivation {
	readonly aliasHops: readonly AliasHopDraft[];
	readonly artifacts: readonly ArtifactDraft[];
	readonly compilerOptionsDigest: string;
	readonly declarations: readonly DeclarationDraft[];
	readonly evidence: CompilerProjectProgramEvidence;
	readonly exportSymbolsExamined: number;
	readonly languageVersionCode: number;
	readonly languageVersionName: string;
	readonly parsedArtifacts: readonly ParsedArtifactDraft[];
	readonly preMaterializationTraversalSteps: number;
	readonly programAstNodes: number;
	readonly programSourceFiles: number;
	readonly rootExportSymbolFlags: DeclarationContextSymbolFlagsBinding;
	readonly selectedAstNodes: number;
	readonly terminalFlags: DeclarationContextSymbolFlagsBinding;
	readonly terminalName: string;
}

type CompilerProjectProgramSession = ReturnType<typeof createCompilerProjectProgramSession>;

type DeclarationContextBudgets = DeclarationContextAnalysisBuildInputs['request']['budgets'];

interface TraversalLedger {
	readonly charge: (amount: number, phase: DeclarationContextAnalysisProgressPhase) => void;
	readonly total: () => number;
}

interface ProgramSourceBinding {
	readonly logicalPath: string;
	readonly sourceFile: ts.SourceFile;
}

function createTraversalLedger(maxTraversalSteps: number): TraversalLedger {
	let progressiveTraversalSteps = 0;
	return {
		charge(amount: number, phase: DeclarationContextAnalysisProgressPhase): void {
			if (amount > maxTraversalSteps - progressiveTraversalSteps)
				throw new DeclarationContextAnalysisFailure(
					'BUDGET_EXCEEDED',
					'Declaration-context traversal exhausted maxTraversalSteps.',
					phase,
					'$.request.budgets.maxTraversalSteps'
				);
			progressiveTraversalSteps += amount;
		},
		total(): number {
			return progressiveTraversalSteps;
		}
	};
}

function openCompilerProgramSession(
	inputs: DeclarationContextAnalysisBuildInputs,
	bound: BoundProgramContext,
	remainingDurationMs: number,
	traversal: TraversalLedger,
	progress: TelemetryRecorder,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): {
	readonly freshProgramSourceFiles: readonly ts.SourceFile[];
	readonly session: CompilerProjectProgramSession;
} {
	const budgets = inputs.request.budgets;
	const session =
		declarationContextAnalysisCompilerProgramCapability.createCompilerProjectProgramSession(
			inputs.semanticSnapshot,
			bound.configPath,
			{
				maxDurationMs: remainingDurationMs,
				maxProgramInputRecords: budgets.maxCompilerInputAttempts,
				maxProgramReadBytes: budgets.maxProgramReadBytes,
				maxProgramSourceFiles: budgets.maxProgramSourceFiles,
				maxTotalInputRecords: budgets.maxInputRecords,
				maxTotalReadBytes: budgets.maxReadBytes
			},
			{
				onInput(stage) {
					if (stage === 'DECLARATION_ARTIFACT_PARSE') return;
					try {
						traversal.charge(1, progress.activePhase() ?? 'PROGRAM_CONSTRUCT');
					} catch (error) {
						if (error instanceof DeclarationContextAnalysisFailure)
							throw new CompilerProjectProgramCapabilityError('BUDGET_EXCEEDED', error.message);
						throw error;
					}
				}
			}
		);
	assertWithinDeadline('PROGRAM_CONSTRUCT');
	const freshProgramSourceFiles = session.program.getSourceFiles();
	assertWithinDeadline('PROGRAM_CONSTRUCT');
	if (freshProgramSourceFiles.length > budgets.maxProgramSourceFiles)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'The fresh Program source population exceeds maxProgramSourceFiles.',
			'PROGRAM_CONSTRUCT',
			'$.request.budgets.maxProgramSourceFiles'
		);
	return { freshProgramSourceFiles, session };
}

function reconcileFreshProgramSources(
	freshProgramSourceFiles: readonly ts.SourceFile[],
	bound: BoundProgramContext,
	budgets: DeclarationContextBudgets,
	traversal: TraversalLedger,
	session: CompilerProjectProgramSession,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): { readonly programAstNodes: number; readonly programSources: ProgramSourceBinding[] } {
	const programSourceProgress = resourceProgress(() =>
		assertWithinDeadline('PROGRAM_SOURCE_ACCOUNT')
	);
	const programSources = freshProgramSourceFiles.map((sourceFile) => {
		programSourceProgress.step();
		return {
			logicalPath: session.toLogicalPath(sourceFile.fileName),
			sourceFile
		};
	});
	programSources.sort((left, right) => {
		programSourceProgress.step();
		return (
			compareText(left.logicalPath, right.logicalPath, programSourceProgress.step) ||
			compareText(left.sourceFile.fileName, right.sourceFile.fileName, programSourceProgress.step)
		);
	});
	const programLogicalPaths = new Set<string>();
	let repeatedProgramLogicalPath = false;
	for (const source of programSources) {
		programSourceProgress.step();
		if (programLogicalPaths.has(source.logicalPath)) repeatedProgramLogicalPath = true;
		programLogicalPaths.add(source.logicalPath);
	}
	if (
		programSources.length !== bound.sourceByLogicalPath.size ||
		programSources.length > budgets.maxProgramSourceFiles ||
		repeatedProgramLogicalPath
	)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The fresh Program source population does not reconcile with CAP-001.',
			'PROGRAM_SOURCE_ACCOUNT'
		);
	traversal.charge(programSources.length, 'PROGRAM_SOURCE_ACCOUNT');
	let programAstNodes = 0;
	for (const { logicalPath, sourceFile } of programSources) {
		programSourceProgress.step();
		const source = bound.sourceByLogicalPath.get(logicalPath);
		if (
			// S6582 REFUSED — the explicit limb keeps this guard TOTAL. Under the optional chain the
			// missing-record case depends on `sourceFile.text` being non-nullish to still refuse, which
			// swaps a recorded INPUT_POPULATION_MISMATCH for a raw TypeError. Same idiom as the sibling
			// fail-closed guards across this package.
			source === undefined ||
			source.textLength !== sourceFile.text.length ||
			source.declarationFile !== sourceFile.isDeclarationFile
		)
			throw new DeclarationContextAnalysisFailure(
				'INPUT_POPULATION_MISMATCH',
				'One fresh Program source does not reconcile with its semantic source record.',
				'PROGRAM_SOURCE_ACCOUNT'
			);
		programAstNodes = countAstNodes(
			sourceFile,
			programAstNodes,
			budgets.maxProgramAstNodes,
			() => assertWithinDeadline('PROGRAM_SOURCE_ACCOUNT'),
			'PROGRAM_SOURCE_ACCOUNT',
			() => traversal.charge(1, 'PROGRAM_SOURCE_ACCOUNT')
		);
	}
	programSourceProgress.finish();
	return { programAstNodes, programSources };
}

function reconcileContextProgramSources(
	inputs: DeclarationContextAnalysisBuildInputs,
	bound: BoundProgramContext,
	programSourceCount: number,
	budgets: DeclarationContextBudgets,
	contextSourceProgress: ResourceProgressHandle
): void {
	if (bound.projectContextProgram.sourceIds.length > budgets.maxProgramSourceFiles)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'The selected project-context Program source population exceeds maxProgramSourceFiles.',
			'PROGRAM_SOURCE_ACCOUNT',
			'$.request.budgets.maxProgramSourceFiles'
		);
	if (bound.projectContextProgram.sourceIds.length !== programSourceCount)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The fresh Program and selected project-context Program source populations differ.',
			'PROGRAM_SOURCE_ACCOUNT'
		);
	const selectedContextSourceIds = new Set<string>();
	for (const sourceId of bound.projectContextProgram.sourceIds) {
		contextSourceProgress.step();
		selectedContextSourceIds.add(sourceId);
	}
	if (selectedContextSourceIds.size !== bound.projectContextProgram.sourceIds.length)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The selected project-context Program repeats a source identity.',
			'PROGRAM_SOURCE_ACCOUNT'
		);
	const contextSourceById = new Map<
		string,
		(typeof inputs.projectContextGraph.sources)[number] | null
	>();
	for (const source of inputs.projectContextGraph.sources) {
		contextSourceProgress.step();
		if (!selectedContextSourceIds.has(source.id)) continue;
		contextSourceById.set(source.id, contextSourceById.has(source.id) ? null : source);
	}
	const contextSources = bound.projectContextProgram.sourceIds.map((sourceId) => {
		contextSourceProgress.step();
		const source = contextSourceById.get(sourceId);
		if (source === undefined || source === null)
			throw new DeclarationContextAnalysisFailure(
				'INPUT_POPULATION_MISMATCH',
				'The selected project-context Program contains an unavailable source identity.',
				'PROGRAM_SOURCE_ACCOUNT'
			);
		return source;
	});
	if (
		contextSources.some((source) => {
			contextSourceProgress.step();
			return (
				!bound.sourceByLogicalPath.has(source.logicalPath) ||
				source.semanticProgramId !== bound.programRecord.id ||
				source.semanticProjectId !== bound.projectRecord.id ||
				bound.sourceByLogicalPath.get(source.logicalPath)?.id !== source.semanticSourceId
			);
		})
	)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The fresh Program source population does not reconcile exactly with CAP-010.',
			'PROGRAM_SOURCE_ACCOUNT'
		);
}

function resolveRootExternalModuleSource(
	programSources: readonly ProgramSourceBinding[],
	bound: BoundProgramContext,
	contextSourceProgress: ResourceProgressHandle,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): ts.SourceFile {
	const rootProgramSource = programSources.find((source) => {
		contextSourceProgress.step();
		return source.logicalPath === bound.targetSource.logicalPath;
	})?.sourceFile;
	contextSourceProgress.finish();
	let rootIsExternalModule = false;
	if (rootProgramSource !== undefined) {
		rootIsExternalModule =
			declarationContextAnalysisTypeScriptPublicApi.isExternalModule(rootProgramSource);
		assertWithinDeadline('ROOT_EXPORT_ENUMERATE');
	}
	if (rootProgramSource === undefined || !rootIsExternalModule)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'The CAP-011 selected declaration target is not one external-module Program source.',
			'ROOT_EXPORT_ENUMERATE'
		);
	return rootProgramSource;
}

function bindDeclarationArtifact(
	artifactByPath: Map<string, ArtifactDraft>,
	bound: BoundProgramContext,
	maxArtifacts: number,
	session: CompilerProjectProgramSession,
	sourceFile: ts.SourceFile,
	role: DeclarationContextArtifactRole
): ArtifactDraft {
	const logicalPath = session.toLogicalPath(sourceFile.fileName);
	const source = bound.sourceByLogicalPath.get(logicalPath);
	if (
		source?.analysisDisposition !== 'CONTEXT_ONLY' ||
		source.artifactClass !== 'CONTEXT_ONLY' ||
		source.origin !== 'WORKSPACE_BUILD_DECLARATION' ||
		source.declarationFile !== true ||
		source.projectId !== bound.projectRecord.id ||
		source.programId !== bound.programRecord.id ||
		source.textLength !== sourceFile.text.length ||
		sourceFile.isDeclarationFile !== true
	)
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'Every consumed declaration artifact must be one context-only workspace build declaration.',
			'ARTIFACT_BIND'
		);
	sourceExtension(logicalPath);
	const prior = artifactByPath.get(logicalPath);
	if (prior !== undefined) {
		prior.roles.add(role);
		return prior;
	}
	if (artifactByPath.size >= maxArtifacts)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'The consumed declaration-artifact population exceeds maxArtifacts.',
			'ARTIFACT_BIND'
		);
	const artifact: ArtifactDraft = { logicalPath, roles: new Set([role]), source, sourceFile };
	artifactByPath.set(logicalPath, artifact);
	return artifact;
}

function enumerateSelectedRootExport(
	session: CompilerProjectProgramSession,
	rootProgramSource: ts.SourceFile,
	exportName: string,
	maxExportSymbols: number,
	traversal: TraversalLedger,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): {
	readonly exports: readonly ts.Symbol[];
	readonly rootExportSymbolFlags: DeclarationContextSymbolFlagsBinding;
	readonly selectedExport: ts.Symbol;
} {
	const exportProgress = resourceProgress(() => assertWithinDeadline('ROOT_EXPORT_ENUMERATE'));
	const rootModuleSymbol = declarationContextAnalysisTypeScriptPublicApi.getSymbolAtLocation(
		session.checker,
		rootProgramSource
	);
	assertWithinDeadline('ROOT_EXPORT_ENUMERATE');
	if (rootModuleSymbol === undefined)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'The CAP-011 package-root declaration has no public checker module symbol.',
			'ROOT_EXPORT_ENUMERATE'
		);
	const exports = declarationContextAnalysisTypeScriptPublicApi.getExportsOfModule(
		session.checker,
		rootModuleSymbol
	);
	assertWithinDeadline('ROOT_EXPORT_ENUMERATE');
	if (exports.length > maxExportSymbols)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'The package-root export population exceeds maxExportSymbols.',
			'ROOT_EXPORT_ENUMERATE'
		);
	traversal.charge(exports.length, 'ROOT_EXPORT_ENUMERATE');
	const matches: ts.Symbol[] = [];
	for (const symbol of exports) {
		exportProgress.step();
		const name = declarationContextAnalysisTypeScriptPublicApi.getName(symbol);
		assertWithinDeadline('ROOT_EXPORT_ENUMERATE');
		if (!isUnicodeScalarTextWithProgress(name, exportProgress.step))
			throw new DeclarationContextAnalysisFailure(
				'TARGET_UNAVAILABLE',
				'TypeScript returned a non-Unicode-scalar package-root export name.',
				'ROOT_EXPORT_ENUMERATE'
			);
		if (sameTextWithProgress(name, exportName, exportProgress.step)) matches.push(symbol);
	}
	const selectedExport = oneExact(
		matches,
		'The package root must contain exactly one public checker export with the selected exact name.',
		'ROOT_EXPORT_ENUMERATE',
		'TARGET_UNAVAILABLE'
	);
	const rootExportSymbolFlags = symbolFlagsBinding(selectedExport);
	exportProgress.finish();
	return { exports, rootExportSymbolFlags, selectedExport };
}

function assertAliasHopAdmissible(aliasHopCount: number, maxAliasHops: number): void {
	if (aliasHopCount > 0)
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'Multi-hop or cross-binding explicit alias chains are unsupported by the v1 slice.',
			'ALIAS_RESOLVE'
		);
	if (aliasHopCount >= maxAliasHops)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'The selected export alias chain exhausted maxAliasHops.',
			'ALIAS_RESOLVE'
		);
}

function bindRootAliasExportSpecifier(
	declaration: ts.Declaration,
	session: CompilerProjectProgramSession,
	checkerRootExportSpecifiers: ExportSpecifierCensusRecord[],
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): string {
	if (!ts.isExportSpecifier(declaration))
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'The selected root alias must be represented by one exact ExportSpecifier.',
			'ALIAS_RESOLVE'
		);
	const exportDeclaration = declaration.parent.parent;
	if (
		!ts.isNamedExports(declaration.parent) ||
		!ts.isExportDeclaration(exportDeclaration) ||
		exportDeclaration.moduleSpecifier !== undefined
	)
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'The selected root ExportSpecifier must be one local same-artifact export without a module specifier.',
			'ALIAS_RESOLVE'
		);
	if (declaration.propertyName === undefined || !ts.isIdentifier(declaration.propertyName))
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'The selected root alias must name its terminal binding with an identifier propertyName.',
			'ALIAS_RESOLVE'
		);
	const rootAliasPropertyName = declaration.propertyName.text;
	const sourceFile = declaration.getSourceFile();
	assertWithinDeadline('ALIAS_RESOLVE');
	checkerRootExportSpecifiers.push(
		exportSpecifierCensusRecord(
			declaration,
			sourceFile,
			session.toLogicalPath(sourceFile.fileName),
			() => assertWithinDeadline('ALIAS_RESOLVE')
		)
	);
	return rootAliasPropertyName;
}

function resolveAliasChain(
	selectedExport: ts.Symbol,
	session: CompilerProjectProgramSession,
	maxAliasHops: number,
	traversal: TraversalLedger,
	bindArtifact: (sourceFile: ts.SourceFile, role: DeclarationContextArtifactRole) => ArtifactDraft,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): {
	readonly aliasHops: AliasHopDraft[];
	readonly checkerRootExportSpecifiers: ExportSpecifierCensusRecord[];
	readonly rootAliasPropertyName: string | null;
	readonly terminalSymbol: ts.Symbol;
} {
	const aliasProgress = resourceProgress(() => assertWithinDeadline('ALIAS_RESOLVE'));
	const visited = new Set<ts.Symbol>([selectedExport]);
	const aliasHops: AliasHopDraft[] = [];
	const checkerRootExportSpecifiers: ExportSpecifierCensusRecord[] = [];
	let rootAliasPropertyName: string | null = null;
	let terminalSymbol = selectedExport;
	while ((terminalSymbol.flags & ts.SymbolFlags.Alias) !== 0) {
		aliasProgress.step();
		assertAliasHopAdmissible(aliasHops.length, maxAliasHops);
		traversal.charge(1, 'ALIAS_RESOLVE');
		const aliasDeclarations =
			declarationContextAnalysisTypeScriptPublicApi.getDeclarations(terminalSymbol) ?? [];
		assertWithinDeadline('ALIAS_RESOLVE');
		if (aliasDeclarations.length !== 1)
			throw new DeclarationContextAnalysisFailure(
				'TARGET_UNAVAILABLE',
				'Every traversed public alias symbol must have exactly one declaration.',
				'ALIAS_RESOLVE'
			);
		if (terminalSymbol === selectedExport)
			rootAliasPropertyName = bindRootAliasExportSpecifier(
				aliasDeclarations[0]!,
				session,
				checkerRootExportSpecifiers,
				assertWithinDeadline
			);
		const aliasArtifactPaths = new Set<string>();
		for (const declaration of aliasDeclarations) {
			aliasProgress.step();
			const sourceFile = declaration.getSourceFile();
			assertWithinDeadline('ALIAS_RESOLVE');
			const artifact = bindArtifact(sourceFile, 'ALIAS_DECLARATION_CONTAINER');
			aliasArtifactPaths.add(artifact.logicalPath);
		}
		const target = declarationContextAnalysisTypeScriptPublicApi.getAliasedSymbol(
			session.checker,
			terminalSymbol
		);
		assertWithinDeadline('ALIAS_RESOLVE');
		if (visited.has(target))
			throw new DeclarationContextAnalysisFailure(
				'TARGET_UNAVAILABLE',
				'The selected export alias chain contains a reference-identity cycle.',
				'ALIAS_RESOLVE'
			);
		const aliasName = declarationContextAnalysisTypeScriptPublicApi.getName(terminalSymbol);
		assertWithinDeadline('ALIAS_RESOLVE');
		const targetName = declarationContextAnalysisTypeScriptPublicApi.getName(target);
		assertWithinDeadline('ALIAS_RESOLVE');
		if (
			!isUnicodeScalarTextWithProgress(aliasName, aliasProgress.step) ||
			!isUnicodeScalarTextWithProgress(targetName, aliasProgress.step)
		)
			throw new DeclarationContextAnalysisFailure(
				'TARGET_UNAVAILABLE',
				'The selected alias chain contains a non-Unicode-scalar symbol name.',
				'ALIAS_RESOLVE'
			);
		aliasHops.push({
			aliasArtifactPaths: [...aliasArtifactPaths].sort((left, right) => {
				aliasProgress.step();
				return compareText(left, right, aliasProgress.step);
			}),
			aliasName,
			aliasSymbolFlags: symbolFlagsBinding(terminalSymbol),
			targetName
		});
		visited.add(target);
		terminalSymbol = target;
	}
	aliasProgress.finish();
	return { aliasHops, checkerRootExportSpecifiers, rootAliasPropertyName, terminalSymbol };
}

function resolveTerminalSymbolName(
	terminalSymbol: ts.Symbol,
	declarationProgress: ResourceProgressHandle,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): string {
	const terminalName = declarationContextAnalysisTypeScriptPublicApi.getName(terminalSymbol);
	assertWithinDeadline('TERMINAL_DECLARATION_BIND');
	if (
		terminalName.length === 0 ||
		!isUnicodeScalarTextWithProgress(terminalName, declarationProgress.step)
	)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'The terminal checker symbol lacks a supported public name.',
			'TERMINAL_DECLARATION_BIND'
		);
	return terminalName;
}

function assertTerminalDeclarationPopulation(
	terminalDeclarations: readonly ts.Declaration[],
	maxDeclarations: number,
	declarationProgress: ResourceProgressHandle
): void {
	if (terminalDeclarations.length === 0)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'The terminal checker symbol has no public declaration population.',
			'TERMINAL_DECLARATION_BIND'
		);
	if (terminalDeclarations.length > maxDeclarations)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'The terminal declaration population exceeds maxDeclarations.',
			'TERMINAL_DECLARATION_BIND'
		);
	const declarationIdentities = new Set<ts.Declaration>();
	let repeatedDeclarationIdentity = false;
	for (const declaration of terminalDeclarations) {
		declarationProgress.step();
		if (declarationIdentities.has(declaration)) repeatedDeclarationIdentity = true;
		declarationIdentities.add(declaration);
	}
	if (repeatedDeclarationIdentity)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'The terminal checker declaration population repeats a reference identity.',
			'TERMINAL_DECLARATION_BIND'
		);
}

function assertTerminalArtifactBinding(
	terminalPaths: ReadonlySet<string>,
	bound: BoundProgramContext,
	aliasHops: readonly AliasHopDraft[],
	rootAliasPropertyName: string | null,
	terminalName: string,
	declarationProgress: ResourceProgressHandle
): void {
	if (terminalPaths.size !== 1)
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'Cross-file terminal symbol declaration merging is unsupported by the v1 slice.',
			'TERMINAL_DECLARATION_BIND'
		);
	if (!terminalPaths.has(bound.targetSource.logicalPath))
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'The v1 terminal symbol declarations must be carried by the selected CAP-011 root artifact.',
			'TERMINAL_DECLARATION_BIND'
		);
	if (
		aliasHops.length === 1 &&
		(rootAliasPropertyName === null ||
			!sameTextWithProgress(rootAliasPropertyName, terminalName, declarationProgress.step) ||
			!terminalPaths.has(bound.targetSource.logicalPath) ||
			aliasHops[0]?.aliasArtifactPaths.length !== 1 ||
			aliasHops[0]?.aliasArtifactPaths[0] !== bound.targetSource.logicalPath)
	)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'The v1 explicit alias must bind one root ExportSpecifier propertyName directly to a same-root terminal symbol.',
			'TERMINAL_DECLARATION_BIND'
		);
}

interface ParsedArtifactCensus {
	readonly assertWithinDeadline: () => void;
	readonly checkerRootExportSpecifierCount: number;
	readonly declarationCount: number;
	readonly exportName: string;
	readonly independentRootExportSpecifiers: ExportSpecifierCensusRecord[];
	readonly independentTerminalDeclarations: DeclarationDraft[];
	readonly step: () => void;
	readonly targetLogicalPath: string;
	readonly terminalLogicalPath: string;
	readonly terminalName: string;
}

function assertArtifactsHaveNoSyntacticDiagnostics(
	artifacts: readonly ArtifactDraft[],
	session: CompilerProjectProgramSession,
	maxDiagnostics: number,
	parseProgress: ResourceProgressHandle,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): void {
	let artifactDiagnostics = 0;
	for (const artifact of artifacts) {
		parseProgress.step();
		const syntacticDiagnostics = session.program.getSyntacticDiagnostics(artifact.sourceFile);
		assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT');
		if (syntacticDiagnostics.length > maxDiagnostics - artifactDiagnostics)
			throw new DeclarationContextAnalysisFailure(
				'BUDGET_EXCEEDED',
				'Artifact Program diagnostics cumulatively exceed maxDiagnostics.',
				'ARTIFACT_PARSE_ACCOUNT'
			);
		artifactDiagnostics += syntacticDiagnostics.length;
		if (artifactDiagnostics !== 0)
			throw new DeclarationContextAnalysisFailure(
				'TARGET_UNAVAILABLE',
				'Every selected declaration artifact must have no Program syntactic diagnostics.',
				'ARTIFACT_PARSE_ACCOUNT'
			);
	}
}

function assertParsedArtifactReconciles(
	parsed: CompilerProjectParsedSource,
	artifact: ArtifactDraft,
	parseProgress: ResourceProgressHandle
): void {
	if (
		parsed.logicalPath !== artifact.logicalPath ||
		parsed.contentBytes !== artifact.source.bytes ||
		parsed.contentSha256 !== artifact.source.contentSha256 ||
		parsed.textLength !== artifact.source.textLength ||
		!sameTextWithProgress(parsed.sourceFile.text, artifact.sourceFile.text, parseProgress.step) ||
		parsed.sourceFile.isDeclarationFile !== true
	)
		throw new DeclarationContextAnalysisFailure(
			'CAPTURE_INVALID',
			'An independently parsed artifact does not reconcile with Program and CAP-001 evidence.',
			'ARTIFACT_PARSE_ACCOUNT'
		);
	if (
		parsed.sourceFile.referencedFiles.length !== 0 ||
		parsed.sourceFile.typeReferenceDirectives.length !== 0 ||
		parsed.sourceFile.libReferenceDirectives.length !== 0 ||
		parsed.sourceFile.amdDependencies.length !== 0 ||
		parsed.sourceFile.moduleName !== undefined ||
		parsed.sourceFile.hasNoDefaultLib
	)
		throw new DeclarationContextAnalysisFailure(
			'UNSUPPORTED_REQUEST',
			'Triple-slash path, types, lib, no-default-lib, AMD module, and AMD dependency effects are unsupported by the v1 slice.',
			'ARTIFACT_PARSE_ACCOUNT'
		);
}

function censusParsedArtifactNode(
	node: ts.Node,
	artifact: ArtifactDraft,
	parsed: CompilerProjectParsedSource,
	census: ParsedArtifactCensus
): void {
	refuseAmbientEffectNode(node);
	if (artifact.logicalPath === census.terminalLogicalPath) {
		const declaration = censusTopLevelTerminalDeclaration(
			node,
			parsed.sourceFile,
			artifact.logicalPath,
			census.terminalName,
			census.step,
			census.assertWithinDeadline
		);
		if (declaration !== null) {
			if (census.independentTerminalDeclarations.length >= census.declarationCount)
				throw new DeclarationContextAnalysisFailure(
					'TARGET_UNAVAILABLE',
					'The independently parsed terminal declaration census exceeds the checker declaration population.',
					'ARTIFACT_PARSE_ACCOUNT'
				);
			census.independentTerminalDeclarations.push(declaration);
		}
	}
	if (
		artifact.logicalPath === census.targetLogicalPath &&
		ts.isExportSpecifier(node) &&
		sameTextWithProgress(node.name.text, census.exportName, census.step) &&
		ts.isNamedExports(node.parent) &&
		ts.isExportDeclaration(node.parent.parent) &&
		node.parent.parent.parent === parsed.sourceFile
	) {
		if (census.independentRootExportSpecifiers.length >= census.checkerRootExportSpecifierCount)
			throw new DeclarationContextAnalysisFailure(
				'TARGET_UNAVAILABLE',
				'The independently parsed selected-name root ExportSpecifier census exceeds the checker alias declaration population.',
				'ARTIFACT_PARSE_ACCOUNT'
			);
		census.independentRootExportSpecifiers.push(
			exportSpecifierCensusRecord(
				node,
				parsed.sourceFile,
				artifact.logicalPath,
				census.assertWithinDeadline
			)
		);
	}
}

function accountArtifactParses(
	artifacts: readonly ArtifactDraft[],
	session: CompilerProjectProgramSession,
	budgets: DeclarationContextBudgets,
	traversal: TraversalLedger,
	census: ParsedArtifactCensus,
	parseProgress: ResourceProgressHandle,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void
): { readonly parsedArtifacts: ParsedArtifactDraft[]; readonly selectedAstNodes: number } {
	let selectedAstNodes = 0;
	const parsedArtifacts: ParsedArtifactDraft[] = [];
	assertArtifactsHaveNoSyntacticDiagnostics(
		artifacts,
		session,
		budgets.maxDiagnostics,
		parseProgress,
		assertWithinDeadline
	);
	for (const artifact of artifacts) {
		parseProgress.step();
		traversal.charge(1, 'ARTIFACT_PARSE_ACCOUNT');
		const parsed = session.parseCapturedSourceFile(artifact.logicalPath);
		assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT');
		assertParsedArtifactReconciles(parsed, artifact, parseProgress);
		const priorAstNodes = selectedAstNodes;
		selectedAstNodes = countAstNodes(
			parsed.sourceFile,
			selectedAstNodes,
			budgets.maxParsedArtifactAstNodes,
			() => assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT'),
			'ARTIFACT_PARSE_ACCOUNT',
			(node) => {
				traversal.charge(1, 'ARTIFACT_PARSE_ACCOUNT');
				censusParsedArtifactNode(node, artifact, parsed, census);
			}
		);
		const parsedIsExternalModule = declarationContextAnalysisTypeScriptPublicApi.isExternalModule(
			parsed.sourceFile
		);
		assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT');
		if (!parsedIsExternalModule)
			throw new DeclarationContextAnalysisFailure(
				'TARGET_UNAVAILABLE',
				'Every selected declaration artifact must be a syntactically valid external module.',
				'ARTIFACT_PARSE_ACCOUNT'
			);
		parsedArtifacts.push({
			artifact,
			astNodes: selectedAstNodes - priorAstNodes,
			parsed,
			statements: parsed.sourceFile.statements.length
		});
	}
	return { parsedArtifacts, selectedAstNodes };
}

function assertTerminalDeclarationCensus(
	independentTerminalDeclarations: DeclarationDraft[],
	declarations: readonly DeclarationDraft[],
	parseProgress: ResourceProgressHandle
): void {
	independentTerminalDeclarations.sort((left, right) => {
		parseProgress.step();
		return compareDeclarationDraft(left, right, parseProgress.step);
	});
	if (
		independentTerminalDeclarations.length !== declarations.length ||
		independentTerminalDeclarations.some((declaration, index) => {
			parseProgress.step();
			return !sameDeclarationDraft(declaration, declarations[index]!, parseProgress.step);
		})
	)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'The independently parsed terminal declaration census does not reproduce the complete checker declaration multiset.',
			'ARTIFACT_PARSE_ACCOUNT'
		);
}

function assertRootExportSpecifierCensus(
	independentRootExportSpecifiers: ExportSpecifierCensusRecord[],
	checkerRootExportSpecifiers: ExportSpecifierCensusRecord[],
	parseProgress: ResourceProgressHandle
): void {
	checkerRootExportSpecifiers.sort((left, right) => {
		parseProgress.step();
		return compareExportSpecifierCensus(left, right, parseProgress.step);
	});
	independentRootExportSpecifiers.sort((left, right) => {
		parseProgress.step();
		return compareExportSpecifierCensus(left, right, parseProgress.step);
	});
	if (
		independentRootExportSpecifiers.length !== checkerRootExportSpecifiers.length ||
		independentRootExportSpecifiers.some((declaration, index) => {
			parseProgress.step();
			return (
				compareExportSpecifierCensus(
					declaration,
					checkerRootExportSpecifiers[index]!,
					parseProgress.step
				) !== 0
			);
		})
	)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'The independently parsed selected-name root ExportSpecifier census does not reproduce the checker alias declaration.',
			'ARTIFACT_PARSE_ACCOUNT'
		);
}

function assertEvidenceReconciles(
	evidence: CompilerProjectProgramEvidence,
	inputs: DeclarationContextAnalysisBuildInputs,
	bound: BoundProgramContext,
	counts: {
		readonly artifactCount: number;
		readonly maxCompilerInputAttempts: number;
		readonly maxProgramReadBytes: number;
		readonly programSourceCount: number;
	},
	evidenceProgress: ResourceProgressHandle
): void {
	let contextInputIdsReconcile =
		evidence.contextInputIds.length ===
		inputs.moduleResolutionTrace.captureWitness.inputRecordIds.length;
	for (
		let index = 0;
		index < evidence.contextInputIds.length && contextInputIdsReconcile;
		index += 1
	) {
		evidenceProgress.step();
		if (
			evidence.contextInputIds[index] !==
			inputs.moduleResolutionTrace.captureWitness.inputRecordIds[index]
		)
			contextInputIdsReconcile = false;
	}
	if (
		evidence.subjectId !== inputs.request.subjectId ||
		evidence.configPath !== bound.configPath ||
		evidence.semanticProgramId !== bound.programRecord.id ||
		evidence.semanticProjectId !== bound.projectRecord.id ||
		evidence.programContextDigest !== bound.programRecord.contextDigest ||
		inputs.moduleResolutionTrace.captureWitness.contextDigest !==
			inputs.semanticSnapshot.contextDigest ||
		evidence.materializedRecipeDigest !==
			inputs.moduleResolutionTrace.captureWitness.materializedRecipeDigest ||
		evidence.projectResolutionDigest !==
			inputs.moduleResolutionTrace.captureWitness.projectResolutionDigest ||
		!contextInputIdsReconcile ||
		evidence.programSourceFiles !== counts.programSourceCount ||
		evidence.attributedInputRecords > counts.maxCompilerInputAttempts ||
		evidence.attributedReadBytes > counts.maxProgramReadBytes ||
		evidence.artifactParseInputRecords !== counts.artifactCount ||
		evidence.compilerHostCallbacks !==
			checkedAdd(evidence.programCompilerHostCallbacks, evidence.artifactParseInputRecords) ||
		evidence.compilerHostReadBytes !==
			checkedAdd(evidence.programCompilerHostReadBytes, evidence.artifactParseReadBytes)
	)
		throw new DeclarationContextAnalysisFailure(
			'CAPTURE_INVALID',
			'Fresh Program evidence does not reconcile with the exact predecessor capture.',
			'ARTIFACT_PARSE_ACCOUNT'
		);
}

function assertCapturedReadEvidence(
	evidence: CompilerProjectProgramEvidence,
	bound: BoundProgramContext,
	capturedReadProgress: ResourceProgressHandle
): void {
	const capturedReadsByLogicalPath = new Map<string, Set<string>>();
	let artifactSuffixStarted = false;
	for (const record of evidence.inputRecords) {
		capturedReadProgress.step();
		if (record.stage === 'DECLARATION_ARTIFACT_PARSE') artifactSuffixStarted = true;
		else if (artifactSuffixStarted)
			throw new DeclarationContextAnalysisFailure(
				'CAPTURE_INVALID',
				'Program/checker callbacks must form a dense prefix before artifact reads.',
				'ARTIFACT_PARSE_ACCOUNT'
			);
		else if (
			record.query.operation === 'READ_FILE' &&
			record.observation.operation === 'READ_FILE' &&
			record.observation.result === 'PRESENT'
		) {
			const readKey = `${record.observation.contentBytes}\0${record.observation.contentSha256}\0${record.observation.origin}`;
			const reads = capturedReadsByLogicalPath.get(record.query.logicalPath) ?? new Set<string>();
			reads.add(readKey);
			capturedReadsByLogicalPath.set(record.query.logicalPath, reads);
		}
	}
	for (const source of bound.sourcePopulation) {
		capturedReadProgress.step();
		const hasCapturedRead = capturedReadsByLogicalPath
			.get(source.logicalPath)
			?.has(`${source.bytes}\0${source.contentSha256}\0${source.origin}`);
		if (!hasCapturedRead)
			throw new DeclarationContextAnalysisFailure(
				'CAPTURE_INVALID',
				'One fresh Program source lacks captured content evidence.',
				'ARTIFACT_PARSE_ACCOUNT'
			);
	}
}

function deriveCompilerEvidence(
	inputs: DeclarationContextAnalysisBuildInputs,
	bound: BoundProgramContext,
	remainingDurationMs: number,
	assertWithinDeadline: (phase: DeclarationContextAnalysisProgressPhase) => void,
	progress: TelemetryRecorder
): CompilerDerivation {
	const budgets = inputs.request.budgets;
	const traversal = createTraversalLedger(budgets.maxTraversalSteps);
	progress.start('PROGRAM_CONSTRUCT');
	const { freshProgramSourceFiles, session } = openCompilerProgramSession(
		inputs,
		bound,
		remainingDurationMs,
		traversal,
		progress,
		assertWithinDeadline
	);
	progress.complete({ programSourceFiles: freshProgramSourceFiles.length });

	progress.start('PROGRAM_SOURCE_ACCOUNT');
	const { programAstNodes, programSources } = reconcileFreshProgramSources(
		freshProgramSourceFiles,
		bound,
		budgets,
		traversal,
		session,
		assertWithinDeadline
	);
	const contextSourceProgress = resourceProgress(() =>
		assertWithinDeadline('PROGRAM_SOURCE_ACCOUNT')
	);
	reconcileContextProgramSources(
		inputs,
		bound,
		programSources.length,
		budgets,
		contextSourceProgress
	);
	progress.complete({ programAstNodes, programSourceFiles: programSources.length });

	const rootProgramSource = resolveRootExternalModuleSource(
		programSources,
		bound,
		contextSourceProgress,
		assertWithinDeadline
	);

	const artifactByPath = new Map<string, ArtifactDraft>();
	const bindArtifact = (
		sourceFile: ts.SourceFile,
		role: DeclarationContextArtifactRole
	): ArtifactDraft =>
		bindDeclarationArtifact(artifactByPath, bound, budgets.maxArtifacts, session, sourceFile, role);
	bindArtifact(rootProgramSource, 'CAP011_SELECTED_DECLARATION_TARGET');
	bindArtifact(rootProgramSource, 'SELECTED_EXPORT_BINDING_CARRIER');

	progress.start('ROOT_EXPORT_ENUMERATE');
	const { exports, rootExportSymbolFlags, selectedExport } = enumerateSelectedRootExport(
		session,
		rootProgramSource,
		inputs.request.exportName,
		budgets.maxExportSymbols,
		traversal,
		assertWithinDeadline
	);
	progress.complete({ exportSymbolsExamined: exports.length, selectedExports: 1 });

	progress.start('ALIAS_RESOLVE');
	const { aliasHops, checkerRootExportSpecifiers, rootAliasPropertyName, terminalSymbol } =
		resolveAliasChain(
			selectedExport,
			session,
			budgets.maxAliasHops,
			traversal,
			bindArtifact,
			assertWithinDeadline
		);
	progress.complete({ aliasHops: aliasHops.length });

	progress.start('TERMINAL_DECLARATION_BIND');
	const declarationProgress = resourceProgress(() =>
		assertWithinDeadline('TERMINAL_DECLARATION_BIND')
	);
	const terminalName = resolveTerminalSymbolName(
		terminalSymbol,
		declarationProgress,
		assertWithinDeadline
	);
	const terminalDeclarations =
		declarationContextAnalysisTypeScriptPublicApi.getDeclarations(terminalSymbol) ?? [];
	assertWithinDeadline('TERMINAL_DECLARATION_BIND');
	assertTerminalDeclarationPopulation(
		terminalDeclarations,
		budgets.maxDeclarations,
		declarationProgress
	);
	traversal.charge(terminalDeclarations.length, 'TERMINAL_DECLARATION_BIND');
	const terminalPaths = new Set<string>();
	const declarations = terminalDeclarations.map((declaration) => {
		declarationProgress.step();
		const sourceFile = declaration.getSourceFile();
		assertWithinDeadline('TERMINAL_DECLARATION_BIND');
		const artifact = bindArtifact(sourceFile, 'TERMINAL_DECLARATION_CONTAINER');
		terminalPaths.add(artifact.logicalPath);
		return supportedDeclaration(declaration, artifact.logicalPath, declarationProgress.step, () =>
			assertWithinDeadline('TERMINAL_DECLARATION_BIND')
		);
	});
	assertTerminalArtifactBinding(
		terminalPaths,
		bound,
		aliasHops,
		rootAliasPropertyName,
		terminalName,
		declarationProgress
	);
	declarations.sort((left, right) => {
		declarationProgress.step();
		return compareDeclarationDraft(left, right, declarationProgress.step);
	});
	if (
		declarations.some((declaration) => {
			declarationProgress.step();
			return !sameTextWithProgress(declaration.name, terminalName, declarationProgress.step);
		})
	)
		throw new DeclarationContextAnalysisFailure(
			'TARGET_UNAVAILABLE',
			'Terminal declaration names do not reproduce the checker symbol name.',
			'TERMINAL_DECLARATION_BIND'
		);
	declarationProgress.finish();
	progress.complete({ declarations: declarations.length });

	progress.start('ARTIFACT_BIND');
	const artifactProgress = resourceProgress(() => assertWithinDeadline('ARTIFACT_BIND'));
	const artifacts = [...artifactByPath.values()].sort((left, right) => {
		artifactProgress.step();
		return (
			compareText(left.logicalPath, right.logicalPath, artifactProgress.step) ||
			compareText(left.source.id, right.source.id, artifactProgress.step)
		);
	});
	artifactProgress.finish();
	progress.complete({ artifacts: artifacts.length });

	progress.start('ARTIFACT_PARSE_ACCOUNT');
	const parseProgress = resourceProgress(() => assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT'));
	const independentTerminalDeclarations: DeclarationDraft[] = [];
	const independentRootExportSpecifiers: ExportSpecifierCensusRecord[] = [];
	const { parsedArtifacts, selectedAstNodes } = accountArtifactParses(
		artifacts,
		session,
		budgets,
		traversal,
		{
			assertWithinDeadline: () => assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT'),
			checkerRootExportSpecifierCount: checkerRootExportSpecifiers.length,
			declarationCount: declarations.length,
			exportName: inputs.request.exportName,
			independentRootExportSpecifiers,
			independentTerminalDeclarations,
			step: parseProgress.step,
			targetLogicalPath: bound.targetSource.logicalPath,
			terminalLogicalPath: declarations[0]!.logicalPath,
			terminalName
		},
		parseProgress,
		assertWithinDeadline
	);
	assertTerminalDeclarationCensus(independentTerminalDeclarations, declarations, parseProgress);
	assertRootExportSpecifierCensus(
		independentRootExportSpecifiers,
		checkerRootExportSpecifiers,
		parseProgress
	);
	parseProgress.finish();
	progress.complete({ artifacts: artifacts.length, selectedAstNodes });
	const compilerOptions = session.program.getCompilerOptions();
	assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT');
	const compilerOptionsDigest = canonicalSemanticJsonWitnessWithProgress(compilerOptions, () =>
		assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT')
	).sha256;
	if (
		compilerOptionsDigest !== inputs.moduleResolutionTrace.resolverEnvironment.compilerOptionsDigest
	)
		throw new DeclarationContextAnalysisFailure(
			'CAPTURE_INVALID',
			'Fresh Program compiler options do not reproduce the CAP-011 options digest.',
			'ARTIFACT_PARSE_ACCOUNT'
		);
	const languageVersionCode = compilerOptions.target ?? ts.ScriptTarget.Latest;
	const languageVersionName = ts.ScriptTarget[languageVersionCode];
	if (typeof languageVersionName !== 'string')
		throw new DeclarationContextAnalysisFailure(
			'PROGRAM_CONSTRUCTION_UNAVAILABLE',
			'The Program language-version code lacks a public reverse-enum name.',
			'ARTIFACT_PARSE_ACCOUNT'
		);

	const evidence = session.finalize();
	assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT');
	const evidenceProgress = resourceProgress(() => assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT'));
	assertEvidenceReconciles(
		evidence,
		inputs,
		bound,
		{
			artifactCount: artifacts.length,
			maxCompilerInputAttempts: budgets.maxCompilerInputAttempts,
			maxProgramReadBytes: budgets.maxProgramReadBytes,
			programSourceCount: programSources.length
		},
		evidenceProgress
	);
	evidenceProgress.finish();
	const capturedReadProgress = resourceProgress(() =>
		assertWithinDeadline('ARTIFACT_PARSE_ACCOUNT')
	);
	assertCapturedReadEvidence(evidence, bound, capturedReadProgress);
	capturedReadProgress.finish();
	return {
		aliasHops,
		artifacts,
		compilerOptionsDigest,
		declarations,
		evidence,
		exportSymbolsExamined: exports.length,
		languageVersionCode,
		languageVersionName,
		parsedArtifacts,
		preMaterializationTraversalSteps: traversal.total(),
		programAstNodes,
		programSourceFiles: programSources.length,
		rootExportSymbolFlags,
		selectedAstNodes,
		terminalFlags: symbolFlagsBinding(terminalSymbol),
		terminalName
	};
}

function relationSortKey(relation: DeclarationContextRelationRecordWithoutId): readonly string[] {
	if (relation.kind === 'DECLARES') return ['0', relation.artifactId, relation.declarationId];
	if (relation.kind === 'CONTRIBUTES_TO')
		return ['1', relation.declarationId, relation.terminalSymbolId];
	return ['2', relation.declarationId, relation.mergeId, relation.terminalSymbolId];
}

function compareStringTuples(left: readonly string[], right: readonly string[]): number {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const comparison = compareText(left[index] ?? '', right[index] ?? '');
		if (comparison !== 0) return comparison;
	}
	return 0;
}

interface MaterializationPopulationBounds {
	readonly inputRecords: number;
	readonly mergeRecords: number;
	readonly outputRecords: number;
	readonly readBytes: number;
	readonly relationRecords: number;
	readonly traversalSteps: number;
}

function prospectiveMaterializationBounds(
	inputs: DeclarationContextAnalysisBuildInputs,
	derived: CompilerDerivation
): MaterializationPopulationBounds {
	const prospectiveMergeRecords = derived.declarations.length > 1 ? 1 : 0;
	const prospectiveRelationRecords = checkedAdd(
		derived.declarations.length,
		derived.declarations.length,
		prospectiveMergeRecords === 0 ? 0 : derived.declarations.length
	);
	const prospectiveInputRecords = checkedAdd(
		derived.evidence.programCompilerHostCallbacks,
		derived.parsedArtifacts.length
	);
	const prospectiveReadBytes = checkedAdd(
		derived.evidence.programCompilerHostReadBytes,
		derived.evidence.artifactParseReadBytes
	);
	const formulaTraversalSteps = checkedAdd(
		derived.evidence.programCompilerHostCallbacks,
		derived.parsedArtifacts.length,
		derived.programSourceFiles,
		derived.programAstNodes,
		derived.selectedAstNodes,
		derived.exportSymbolsExamined,
		derived.aliasHops.length,
		derived.declarations.length,
		prospectiveRelationRecords
	);
	const prospectiveTraversalSteps = checkedAdd(
		derived.preMaterializationTraversalSteps,
		prospectiveRelationRecords
	);
	if (prospectiveTraversalSteps !== formulaTraversalSteps)
		throw new DeclarationContextAnalysisFailure(
			'CAPTURE_INVALID',
			'The progressive traversal ledger does not reproduce the frozen coverage formula.',
			'MATERIALIZE'
		);
	const prospectiveOutputRecords = checkedAdd(
		1,
		derived.evidence.programCompilerHostCallbacks,
		derived.parsedArtifacts.length,
		derived.artifacts.length,
		1,
		1,
		derived.declarations.length,
		prospectiveMergeRecords,
		prospectiveRelationRecords
	);
	if (
		derived.evidence.programCompilerHostCallbacks >
			inputs.request.budgets.maxCompilerInputAttempts ||
		prospectiveInputRecords > inputs.request.budgets.maxInputRecords ||
		prospectiveReadBytes > inputs.request.budgets.maxReadBytes ||
		prospectiveTraversalSteps > inputs.request.budgets.maxTraversalSteps ||
		prospectiveOutputRecords > inputs.request.budgets.maxOutputRecords ||
		prospectiveRelationRecords > inputs.request.budgets.maxRelations
	)
		throw new DeclarationContextAnalysisFailure(
			'BUDGET_EXCEEDED',
			'Prospective declaration-context populations exceed one requested materialization budget.',
			'MATERIALIZE'
		);
	return {
		inputRecords: prospectiveInputRecords,
		mergeRecords: prospectiveMergeRecords,
		outputRecords: prospectiveOutputRecords,
		readBytes: prospectiveReadBytes,
		relationRecords: prospectiveRelationRecords,
		traversalSteps: prospectiveTraversalSteps
	};
}

function assertMaterializedPopulations(
	actual: MaterializationPopulationBounds,
	prospective: MaterializationPopulationBounds
): void {
	if (
		actual.mergeRecords !== prospective.mergeRecords ||
		actual.relationRecords !== prospective.relationRecords ||
		actual.inputRecords !== prospective.inputRecords ||
		actual.readBytes !== prospective.readBytes ||
		actual.traversalSteps !== prospective.traversalSteps ||
		actual.outputRecords !== prospective.outputRecords
	)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'Materialized declaration-context populations do not reproduce their prospective bounds.',
			'MATERIALIZE'
		);
}

function materializeProgramInputAttempts(
	derived: CompilerDerivation,
	analysisId: DeclarationContextAnalysisId,
	deadline: ResourceProgressHandle,
	onProgress: () => void
): DeclarationContextProgramInputAttemptRecord[] {
	const programInputAttempts: DeclarationContextProgramInputAttemptRecord[] = [];
	for (const inputRecord of derived.evidence.inputRecords) {
		deadline.step();
		if (
			inputRecord.stage === 'DECLARATION_ARTIFACT_PARSE' ||
			inputRecord.stage === 'DECLARATION_EMIT'
		)
			continue;
		const ordinal = programInputAttempts.length;
		if (inputRecord.ordinal !== ordinal)
			throw new DeclarationContextAnalysisFailure(
				'CAPTURE_INVALID',
				'Program input attempts are not a dense global callback prefix.',
				'MATERIALIZE'
			);
		const recordWithoutId: Omit<DeclarationContextProgramInputAttemptRecord, 'id'> = {
			attributedInvocationCount: inputRecord.attributedInvocationCount,
			invocationOrdinal: inputRecord.invocationOrdinal,
			observation: clonePlainData(inputRecord.observation, new WeakMap(), deadline.step),
			ordinal,
			query: clonePlainData(inputRecord.query, new WeakMap(), deadline.step),
			stage: inputRecord.stage
		};
		programInputAttempts.push({
			...recordWithoutId,
			id: declarationContextProgramInputAttemptId(analysisId, recordWithoutId, onProgress)
		});
	}
	if (programInputAttempts.length !== derived.evidence.programCompilerHostCallbacks)
		throw new DeclarationContextAnalysisFailure(
			'CAPTURE_INVALID',
			'Program input-attempt output does not reproduce compiler-host accounting.',
			'MATERIALIZE'
		);
	return programInputAttempts;
}

function materializeParseWitnesses(
	derived: CompilerDerivation,
	analysisId: DeclarationContextAnalysisId,
	deadline: ResourceProgressHandle,
	onProgress: () => void
): {
	readonly parseWitnessByPath: ReadonlyMap<string, DeclarationContextParseWitnessRecord>;
	readonly parseWitnesses: DeclarationContextParseWitnessRecord[];
} {
	const parseWitnesses: DeclarationContextParseWitnessRecord[] = [];
	const parseWitnessByPath = new Map<string, DeclarationContextParseWitnessRecord>();
	for (const parsedArtifact of derived.parsedArtifacts) {
		deadline.step();
		const inputRecord = derived.evidence.inputRecords[parsedArtifact.parsed.inputRecordOrdinal];
		if (
			inputRecord?.stage !== 'DECLARATION_ARTIFACT_PARSE' ||
			inputRecord.query.operation !== 'READ_FILE' ||
			inputRecord.query.logicalPath !== parsedArtifact.artifact.logicalPath ||
			inputRecord.observation.operation !== 'READ_FILE' ||
			inputRecord.observation.result !== 'PRESENT'
		)
			throw new DeclarationContextAnalysisFailure(
				'CAPTURE_INVALID',
				'One selected artifact lacks its exact independent captured-read record.',
				'MATERIALIZE'
			);
		const recordWithoutId: Omit<DeclarationContextParseWitnessRecord, 'id'> = {
			astNodes: parsedArtifact.astNodes,
			bytes: parsedArtifact.parsed.contentBytes,
			compilerVersion: TYPESCRIPT_PROVIDER_VERSION,
			contentSha256: parsedArtifact.parsed.contentSha256,
			decodedUtf16CodeUnits: parsedArtifact.parsed.textLength,
			externalModule: true,
			languageVersion: {
				nativeCode: derived.languageVersionCode,
				nativeName: derived.languageVersionName
			},
			logicalPath: parsedArtifact.artifact.logicalPath,
			parseDiagnostics: [],
			parseHealth: 'VALID',
			parseMethod: 'TYPESCRIPT_PUBLIC_CREATE_SOURCE_FILE_OVER_EXACT_CAPTURED_BYTES',
			programSourceReconciliation: 'EXACT_LOGICAL_PATH_CONTENT_SHA256_AND_SEMANTIC_SOURCE_ID',
			scriptKind: { nativeCode: ts.ScriptKind.TS, nativeName: 'TS' },
			semanticProgramId: parsedArtifact.artifact.source.programId,
			semanticProjectId: parsedArtifact.artifact.source.projectId,
			semanticSourceId: parsedArtifact.artifact.source.id,
			sourceEncoding: parsedArtifact.parsed.encoding,
			sourceRead: {
				attributedInvocationCount: inputRecord.attributedInvocationCount,
				inputRecordOrdinal: inputRecord.ordinal,
				invocationOrdinal: inputRecord.invocationOrdinal,
				observation: clonePlainData(inputRecord.observation, new WeakMap(), deadline.step),
				query: {
					logicalPath: inputRecord.query.logicalPath,
					operation: 'READ_FILE'
				},
				stage: 'DECLARATION_ARTIFACT_PARSE'
			},
			statements: parsedArtifact.statements
		};
		const record = {
			...recordWithoutId,
			id: declarationContextParseWitnessId(analysisId, recordWithoutId, onProgress)
		};
		parseWitnesses.push(record);
		parseWitnessByPath.set(record.logicalPath, record);
	}
	return { parseWitnessByPath, parseWitnesses };
}

function materializeArtifactRecords(
	derived: CompilerDerivation,
	parseWitnessByPath: ReadonlyMap<string, DeclarationContextParseWitnessRecord>,
	analysisId: DeclarationContextAnalysisId,
	deadline: ResourceProgressHandle,
	onProgress: () => void
): DeclarationContextArtifactRecord[] {
	return derived.artifacts.map((artifact, ordinal) => {
		deadline.step();
		const parseWitness = parseWitnessByPath.get(artifact.logicalPath);
		if (parseWitness === undefined)
			throw new DeclarationContextAnalysisFailure(
				'INPUT_POPULATION_MISMATCH',
				'One declaration artifact lacks its parse witness.',
				'MATERIALIZE'
			);
		const roles = DECLARATION_CONTEXT_ANALYSIS_ARTIFACT_ROLE_ORDER.filter((role) =>
			artifact.roles.has(role)
		);
		const recordWithoutId: Omit<DeclarationContextArtifactRecord, 'id'> = {
			artifactClass: 'CONTEXT_ONLY',
			bytes: artifact.source.bytes,
			contentSha256: artifact.source.contentSha256,
			declarationFile: true,
			declarationRole: 'EMITTED_DECLARATION',
			extension: sourceExtension(artifact.logicalPath),
			logicalPath: artifact.logicalPath,
			ordinal,
			origin: 'WORKSPACE_BUILD_DECLARATION',
			parseWitnessId: parseWitness.id,
			roles,
			semanticProgramId: artifact.source.programId,
			semanticProjectId: artifact.source.projectId,
			semanticSourceId: artifact.source.id
		};
		return {
			...recordWithoutId,
			id: declarationContextArtifactId(analysisId, recordWithoutId, onProgress)
		};
	});
}

function materializeDeclarationRecords(
	derived: CompilerDerivation,
	artifactByPath: ReadonlyMap<string, DeclarationContextArtifactRecord>,
	parseWitnessByPath: ReadonlyMap<string, DeclarationContextParseWitnessRecord>,
	analysisId: DeclarationContextAnalysisId,
	deadline: ResourceProgressHandle,
	onProgress: () => void
): DeclarationContextDeclarationRecord[] {
	return derived.declarations.map((declaration, ordinal) => {
		deadline.step();
		const artifact = artifactByPath.get(declaration.logicalPath);
		const parseWitness = parseWitnessByPath.get(declaration.logicalPath);
		if (artifact === undefined || parseWitness === undefined)
			throw new DeclarationContextAnalysisFailure(
				'INPUT_POPULATION_MISMATCH',
				'One terminal declaration lacks artifact and parse identities.',
				'MATERIALIZE'
			);
		const recordWithoutId: Omit<DeclarationContextDeclarationRecord, 'id'> = {
			ambientContext: 'DECLARATION_FILE',
			artifactId: artifact.id,
			end: declaration.end,
			kind: declaration.kind,
			name: declaration.name,
			nameEnd: declaration.nameEnd,
			nameStart: declaration.nameStart,
			nativeKind: clonePlainData(declaration.nativeKind, new WeakMap(), deadline.step),
			ordinal,
			parseWitnessId: parseWitness.id,
			role: 'SELECTED_TERMINAL_SYMBOL_DECLARATION',
			start: declaration.start
		};
		return {
			...recordWithoutId,
			id: declarationContextDeclarationId(analysisId, recordWithoutId, onProgress)
		};
	});
}

function materializeAliasHopWitnesses(
	derived: CompilerDerivation,
	artifactByPath: ReadonlyMap<string, DeclarationContextArtifactRecord>,
	deadline: ResourceProgressHandle
): DeclarationContextAliasHopWitness[] {
	const aliasHops: DeclarationContextAliasHopWitness[] = derived.aliasHops.map((hop, ordinal) => {
		deadline.step();
		const aliasArtifacts = hop.aliasArtifactPaths
			.map((path) => {
				deadline.step();
				return artifactByPath.get(path);
			})
			.filter((artifact): artifact is DeclarationContextArtifactRecord => {
				deadline.step();
				return artifact !== undefined;
			})
			.sort((left, right) => {
				deadline.step();
				return left.ordinal - right.ordinal;
			});
		return {
			aliasDeclarationArtifactIds: aliasArtifacts.map((artifact) => {
				deadline.step();
				return artifact.id;
			}),
			aliasName: hop.aliasName,
			aliasSymbolFlags: clonePlainData(hop.aliasSymbolFlags, new WeakMap(), deadline.step),
			ordinal,
			resolutionApi: 'TYPESCRIPT_PUBLIC_TYPE_CHECKER_GET_ALIASED_SYMBOL',
			targetName: hop.targetName
		};
	});
	if (aliasHops.some((hop) => hop.aliasDeclarationArtifactIds.length === 0))
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'One alias hop lost all declaration-artifact identities.',
			'MATERIALIZE'
		);
	return aliasHops;
}

function buildRelationDrafts(
	declarations: readonly DeclarationContextDeclarationRecord[],
	terminalSymbolId: DeclarationContextTerminalSymbolId,
	merge: DeclarationContextMergeRecord | undefined,
	deadline: ResourceProgressHandle
): DeclarationContextRelationRecordWithoutId[] {
	const relationDrafts: DeclarationContextRelationRecordWithoutId[] = [];
	for (const declaration of declarations) {
		deadline.step();
		relationDrafts.push(
			{
				artifactId: declaration.artifactId,
				declarationId: declaration.id,
				kind: 'DECLARES',
				ordinal: 0
			},
			{
				declarationId: declaration.id,
				kind: 'CONTRIBUTES_TO',
				ordinal: 0,
				terminalSymbolId
			}
		);
		if (merge !== undefined)
			relationDrafts.push({
				declarationId: declaration.id,
				kind: 'MERGES_WITH',
				mergeId: merge.id,
				ordinal: 0,
				terminalSymbolId
			});
	}
	relationDrafts.sort((left, right) => {
		deadline.step();
		return compareStringTuples(relationSortKey(left), relationSortKey(right));
	});
	return relationDrafts;
}

function countProgramPresentReadFileAttempts(
	programInputAttempts: readonly DeclarationContextProgramInputAttemptRecord[],
	deadline: ResourceProgressHandle
): number {
	let programPresentReadFileAttempts = 0;
	for (const attempt of programInputAttempts) {
		deadline.step();
		if (attempt.observation.operation === 'READ_FILE' && attempt.observation.result === 'PRESENT')
			programPresentReadFileAttempts += 1;
	}
	return programPresentReadFileAttempts;
}

function materializeAnalysis(
	inputs: DeclarationContextAnalysisBuildInputs,
	semanticValidationWitness: DeclarationContextAnalysisSnapshot['semanticValidationWitness'],
	bound: BoundProgramContext,
	derived: CompilerDerivation,
	onProgress: () => void
): DeclarationContextAnalysisSnapshot {
	const deadline = resourceProgress(onProgress);
	const prospective = prospectiveMaterializationBounds(inputs, derived);

	const inputDigest = declarationContextAnalysisInputDigest(inputs, onProgress);
	const analysisId = declarationContextAnalysisId(
		{
			conditionalExportResolutionId: inputs.conditionalExportResolution.id,
			inputDigest,
			moduleResolutionTraceId: inputs.moduleResolutionTrace.id,
			semanticSnapshotId: inputs.semanticSnapshot.id,
			subjectId: inputs.request.subjectId
		},
		onProgress
	);

	const programInputAttempts = materializeProgramInputAttempts(
		derived,
		analysisId,
		deadline,
		onProgress
	);
	const { parseWitnessByPath, parseWitnesses } = materializeParseWitnesses(
		derived,
		analysisId,
		deadline,
		onProgress
	);
	const artifacts = materializeArtifactRecords(
		derived,
		parseWitnessByPath,
		analysisId,
		deadline,
		onProgress
	);
	const artifactByPath = new Map(
		artifacts.map((artifact) => {
			deadline.step();
			return [artifact.logicalPath, artifact];
		})
	);
	const declarations = materializeDeclarationRecords(
		derived,
		artifactByPath,
		parseWitnessByPath,
		analysisId,
		deadline,
		onProgress
	);
	const terminalArtifact = artifactByPath.get(derived.declarations[0]!.logicalPath);
	if (terminalArtifact === undefined)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The terminal symbol artifact is unavailable after canonical ordering.',
			'MATERIALIZE'
		);
	const terminalWithoutId: Omit<DeclarationContextTerminalSymbolRecord, 'id'> = {
		declarationArtifactId: terminalArtifact.id,
		declarationIds: declarations.map((declaration) => {
			deadline.step();
			return declaration.id;
		}),
		declarationSetClosure: 'COMPLETE_PUBLIC_CHECKER_DECLARATION_SET_SAME_ARTIFACT',
		flags: clonePlainData(derived.terminalFlags, new WeakMap(), deadline.step),
		mergeState: declarations.length === 1 ? 'SINGLE' : 'MERGED',
		name: derived.terminalName,
		ordinal: 0,
		semanticProgramId: bound.programRecord.id,
		semanticProjectId: bound.projectRecord.id,
		symbolMeaning: 'TERMINAL_CHECKER_SYMBOL_FOR_SELECTED_PACKAGE_ROOT_EXPORT'
	};
	const terminalSymbol: DeclarationContextTerminalSymbolRecord = {
		...terminalWithoutId,
		id: declarationContextTerminalSymbolId(analysisId, terminalWithoutId, onProgress)
	};

	const merges: DeclarationContextMergeRecord[] = [];
	if (declarations.length > 1) {
		const mergeWithoutId: Omit<DeclarationContextMergeRecord, 'id'> = {
			declarationArtifactId: terminalArtifact.id,
			declarationIds: declarations.map((declaration) => {
				deadline.step();
				return declaration.id;
			}),
			kind: 'COMPLETE_SAME_FILE_TERMINAL_SYMBOL_MERGE',
			ordinal: 0,
			terminalSymbolId: terminalSymbol.id
		};
		merges.push({
			...mergeWithoutId,
			id: declarationContextMergeId(analysisId, mergeWithoutId, onProgress)
		});
	}

	const aliasHops = materializeAliasHopWitnesses(derived, artifactByPath, deadline);
	const rootArtifact = artifactByPath.get(inputs.moduleResolutionTrace.targetWitness.logicalPath);
	if (rootArtifact === undefined)
		throw new DeclarationContextAnalysisFailure(
			'INPUT_POPULATION_MISMATCH',
			'The CAP-011 root artifact is unavailable after canonical ordering.',
			'MATERIALIZE'
		);
	const exportBindingWithoutId = {
		aliasHops,
		exportSymbolsExamined: derived.exportSymbolsExamined,
		exportName: inputs.request.exportName,
		ordinal: 0 as const,
		resolutionKind:
			aliasHops.length === 0
				? ('DIRECT_TERMINAL_SYMBOL' as const)
				: ('ALIASED_TO_TERMINAL_SYMBOL' as const),
		rootArtifactId: rootArtifact.id,
		rootExportSymbolFlags: clonePlainData(
			derived.rootExportSymbolFlags,
			new WeakMap(),
			deadline.step
		),
		selectionApi: 'TYPESCRIPT_PUBLIC_TYPE_CHECKER_GET_EXPORTS_OF_MODULE' as const,
		terminalSymbolId: terminalSymbol.id
	};
	const exportBinding = {
		...exportBindingWithoutId,
		id: declarationContextExportBindingId(analysisId, exportBindingWithoutId, onProgress)
	};

	const relationDrafts = buildRelationDrafts(declarations, terminalSymbol.id, merges[0], deadline);
	const relations: DeclarationContextRelationRecord[] = relationDrafts.map((relation, ordinal) => {
		deadline.step();
		const recordWithoutId = { ...relation, ordinal } as DeclarationContextRelationRecordWithoutId;
		return {
			...recordWithoutId,
			id: declarationContextRelationId(analysisId, recordWithoutId, onProgress)
		} as DeclarationContextRelationRecord;
	});

	const programPresentReadFileAttempts = countProgramPresentReadFileAttempts(
		programInputAttempts,
		deadline
	);
	const mergeRecords = merges.length as 0 | 1;
	const relationRecords = relations.length;
	const inputRecords = checkedAdd(programInputAttempts.length, parseWitnesses.length);
	const readBytes = checkedAdd(
		derived.evidence.programCompilerHostReadBytes,
		derived.evidence.artifactParseReadBytes
	);
	const chargedTraversalSteps = checkedAdd(
		programInputAttempts.length,
		parseWitnesses.length,
		derived.programSourceFiles,
		derived.programAstNodes,
		derived.selectedAstNodes,
		derived.exportSymbolsExamined,
		aliasHops.length,
		declarations.length,
		relationRecords
	);
	const outputRecords = checkedAdd(
		1,
		programInputAttempts.length,
		parseWitnesses.length,
		artifacts.length,
		1,
		1,
		declarations.length,
		merges.length,
		relations.length
	);
	assertMaterializedPopulations(
		{
			inputRecords,
			mergeRecords,
			outputRecords,
			readBytes,
			relationRecords,
			traversalSteps: chargedTraversalSteps
		},
		prospective
	);
	const coverage: DeclarationContextAnalysisSnapshot['coverage'] = {
		aliasHops: aliasHops.length,
		ambientEffectRecords: 0,
		artifactPopulationReconciles: true,
		artifactReadBytes: derived.evidence.artifactParseReadBytes,
		artifactReadWitnesses: parseWitnesses.length,
		artifacts: artifacts.length,
		augmentationRecords: 0,
		chargedTraversalSteps,
		contributesToRelations: declarations.length,
		declarationPopulationReconciles: true,
		declarations: declarations.length,
		declaresRelations: declarations.length,
		diagnosticRecords: 0,
		exportBindings: 1,
		exportSymbolsExamined: derived.exportSymbolsExamined,
		inputRecords,
		mergePopulationReconciles: true,
		mergeRecords,
		mergesWithRelations: merges.length === 0 ? 0 : declarations.length,
		outputRecords,
		parseWitnessPopulationReconciles: true,
		parseWitnesses: parseWitnesses.length,
		programCompilerInputAttemptPopulationReconciles: true,
		programCompilerInputAttempts: programInputAttempts.length,
		programParsedAstNodePopulationReconciles: true,
		programParsedAstNodes: derived.programAstNodes,
		programPresentReadFileAttempts,
		programReadBytes: derived.evidence.programCompilerHostReadBytes,
		programSourceFilePopulationReconciles: true,
		programSourceFiles: derived.programSourceFiles,
		readBytes,
		readOperations: checkedAdd(programPresentReadFileAttempts, parseWitnesses.length),
		relationPopulationReconciles: true,
		relationRecords,
		selectedAstNodePopulationReconciles: true,
		selectedAstNodes: derived.selectedAstNodes,
		selectedExportBindings: 1,
		selectedPackageRootTargets: 1,
		terminalSymbols: 1
	};

	const content: DeclarationContextAnalysisContent = {
		ambientEffectRecords: [],
		analysisAuthority: DECLARATION_CONTEXT_ANALYSIS_AUTHORITY,
		artifacts,
		augmentationRecords: [],
		authorityTransfer: DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER,
		budgets: clonePlainData(inputs.request.budgets, new WeakMap(), deadline.step),
		canonicalProfile: DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE,
		capability: DECLARATION_CONTEXT_ANALYSIS_CAPABILITY,
		capabilityStatus: DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS,
		closure: 'CLOSED_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_DECLARATION_BINDING',
		conditionalExportResolution: clonePlainData(
			inputs.request.conditionalExportResolution,
			new WeakMap(),
			deadline.step
		),
		coverage,
		currentness: DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS,
		declarations,
		exportBinding,
		freshness: DECLARATION_CONTEXT_ANALYSIS_FRESHNESS,
		fullJanCsaa007Conformance: DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance: DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
		fullJanCsaa013Conformance: DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE,
		gateEffect: DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT,
		health: 'PARTIAL',
		id: analysisId,
		inputDigest,
		merges,
		method: DECLARATION_CONTEXT_ANALYSIS_METHOD,
		moduleResolutionTrace: clonePlainData(
			inputs.request.moduleResolutionTrace,
			new WeakMap(),
			deadline.step
		),
		nonclaims: clonePlainData(DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS, new WeakMap(), deadline.step),
		operationVersion: DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
		parseWitnesses,
		programInputAttempts,
		programWitness: {
			attributedCompilerInputAttempts: derived.evidence.attributedInputRecords,
			attributedProgramReadBytes: derived.evidence.attributedReadBytes,
			attributedUniqueQueries: derived.evidence.attributedUniqueQueries,
			captureContextDigest: inputs.semanticSnapshot.contextDigest,
			compilerOptionsDigest: derived.compilerOptionsDigest,
			compilerVersion: TYPESCRIPT_PROVIDER_VERSION,
			configPath: bound.configPath,
			materializedRecipeDigest: derived.evidence.materializedRecipeDigest,
			programInputAttemptIds: programInputAttempts.map((attempt) => {
				deadline.step();
				return attempt.id;
			}),
			programParsedAstNodes: derived.programAstNodes,
			programSourceFiles: derived.programSourceFiles,
			programSourcePopulationDigest: declarationContextProgramSourcePopulationDigest(
				bound.sourcePopulation,
				onProgress
			),
			projectContextProgramId: bound.projectContextProgram.id,
			projectContextProjectId: bound.projectContextProject.id,
			projectResolutionDigest: derived.evidence.projectResolutionDigest,
			semanticProgramId: bound.programRecord.id,
			semanticProjectId: bound.projectRecord.id,
			state: 'FRESH_PUBLIC_TYPESCRIPT_PROGRAM_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE'
		},
		projectContextGraph: clonePlainData(
			inputs.request.projectContextGraph,
			new WeakMap(),
			deadline.step
		),
		relations,
		resultCompleteness: 'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_DECLARATION_BINDING',
		schemaVersion: DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION,
		selection: clonePlainData(DECLARATION_CONTEXT_ANALYSIS_SELECTION, new WeakMap(), deadline.step),
		semanticSnapshotId: inputs.semanticSnapshot.id,
		semanticValidationWitness: clonePlainData(
			semanticValidationWitness,
			new WeakMap(),
			deadline.step
		),
		subjectId: inputs.request.subjectId,
		terminalSymbol,
		truncation: { reason: null, state: 'NOT_TRUNCATED' }
	};
	const analysis = deepFreeze(
		{
			...content,
			contentDigest: declarationContextAnalysisContentDigest(content, onProgress)
		},
		new WeakSet(),
		deadline.step
	);
	deadline.finish();
	return analysis;
}

export function buildDeclarationContextAnalysis(
	inputsValue: unknown,
	options?: BuildDeclarationContextAnalysisOptions
): DeclarationContextAnalysisBuildOutcome {
	let operationClock: ReturnType<typeof createMonotonicOperationClock>;
	let progress: TelemetryRecorder;
	try {
		operationClock = createMonotonicOperationClock();
		progress = telemetry(options);
	} catch {
		const fallbackProgress = telemetry(undefined);
		fallbackProgress.start('REQUEST_BIND');
		fallbackProgress.fail({}, 'REQUEST_INVALID');
		return fallbackProgress.finish(
			unavailable(
				'REQUEST_INVALID',
				'Declaration-context operation clock or telemetry inspection failed closed.',
				'REQUEST_BIND'
			)
		);
	}
	try {
		progress.start('REQUEST_BIND');
		const limits = preflightLimits(inputsValue);
		const assertWithinDeadline = (phase: DeclarationContextAnalysisProgressPhase): void => {
			const elapsedMs = operationClock.now() - operationClock.startedAtMs;
			if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > limits.maxDurationMs)
				throw new DeclarationContextAnalysisFailure(
					'BUDGET_EXCEEDED',
					'Declaration-context analysis exceeded maxDurationMs.',
					phase,
					'$.request.budgets.maxDurationMs'
				);
		};
		const remainingDuration = (
			phase: DeclarationContextAnalysisProgressPhase,
			message: string
		): number => {
			const elapsedMs = operationClock.now() - operationClock.startedAtMs;
			const remainingMs = limits.maxDurationMs - elapsedMs;
			if (
				!Number.isSafeInteger(elapsedMs) ||
				elapsedMs < 0 ||
				!Number.isSafeInteger(remainingMs) ||
				remainingMs < 1
			)
				throw new DeclarationContextAnalysisFailure(
					'BUDGET_EXCEEDED',
					message,
					phase,
					'$.request.budgets.maxDurationMs'
				);
			return remainingMs;
		};
		const usage = preflightPlainData(inputsValue, limits, () =>
			assertWithinDeadline('REQUEST_BIND')
		);
		const inputs = materializeInputs(inputsValue, () => assertWithinDeadline('REQUEST_BIND'));
		assertInputBinding(inputs);
		assertWithinDeadline('REQUEST_BIND');
		progress.complete({
			inputRecords: usage.records,
			inputStringCharacters: usage.stringCharacters
		});

		progress.start('INPUT_BUDGET');
		if (inputs.request.budgets.maxInputRecords < 1)
			throw new DeclarationContextAnalysisFailure(
				'REQUEST_INVALID',
				'maxInputRecords must be positive.',
				'INPUT_BUDGET'
			);
		assertWithinDeadline('INPUT_BUDGET');
		progress.complete({
			maxCompilerInputAttempts: inputs.request.budgets.maxCompilerInputAttempts,
			maxInputRecords: inputs.request.budgets.maxInputRecords,
			maxReadBytes: inputs.request.budgets.maxReadBytes
		});

		const semanticValidationWitness = validatePredecessors(inputs, progress, assertWithinDeadline);
		const bound = bindProgramContext(inputs, assertWithinDeadline);
		assertWithinDeadline('PROGRAM_CONSTRUCT');
		const remainingDurationMs = remainingDuration(
			'PROGRAM_CONSTRUCT',
			'Declaration-context analysis exhausted maxDurationMs before Program construction.'
		);
		const derived = deriveCompilerEvidence(
			inputs,
			bound,
			remainingDurationMs,
			assertWithinDeadline,
			progress
		);

		progress.start('MATERIALIZE');
		assertWithinDeadline('MATERIALIZE');
		const analysis = materializeAnalysis(inputs, semanticValidationWitness, bound, derived, () =>
			assertWithinDeadline('MATERIALIZE')
		);
		assertWithinDeadline('MATERIALIZE');
		progress.complete({ outputRecords: analysis.coverage.outputRecords });

		progress.start('SERIALIZE');
		canonicalSemanticJsonWitnessWithProgress(analysis, () => assertWithinDeadline('SERIALIZE'));
		assertWithinDeadline('SERIALIZE');
		progress.complete({ outputRecords: analysis.coverage.outputRecords });

		progress.start('ANALYSIS_VALIDATE');
		const analysisUsage = preflightPlainData(
			analysis,
			{
				maxInputRecords: Number.MAX_SAFE_INTEGER,
				maxInputStringCharacters: Number.MAX_SAFE_INTEGER
			},
			() => assertWithinDeadline('ANALYSIS_VALIDATE')
		);
		const remainingValidationDurationMs = remainingDuration(
			'ANALYSIS_VALIDATE',
			'Declaration-context analysis exhausted maxDurationMs before constructed validation.'
		);
		const validation = validateConstructedDeclarationContextAnalysis(
			analysis,
			inputs,
			analysis.inputDigest,
			{
				maxDepth: 4_096,
				maxDurationMs: remainingValidationDurationMs,
				maxInputRecords: inputs.request.budgets.maxInputRecords,
				maxInputStringCharacters: inputs.request.budgets.maxInputStringCharacters,
				maxIssues: inputs.request.budgets.maxDiagnostics,
				maxRecords: Math.max(
					1_024,
					saturatedAdd(inputs.request.budgets.maxInputRecords, analysisUsage.records)
				),
				maxStringCharacters: Math.max(
					65_536,
					saturatedAdd(
						inputs.request.budgets.maxInputStringCharacters,
						analysisUsage.stringCharacters
					)
				)
			}
		);
		assertWithinDeadline('ANALYSIS_VALIDATE');
		if (validation.state !== 'VALID')
			throw new DeclarationContextAnalysisFailure(
				validation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'VALIDATION_FAILED',
				`The constructed declaration-context analysis failed independent validation: ${validation.issues[0]?.message ?? 'unknown validation issue'}`,
				'ANALYSIS_VALIDATE',
				validation.issues[0]?.path ?? null
			);
		assertWithinDeadline('ANALYSIS_VALIDATE');
		progress.complete({ validationIssues: 0 });
		return progress.finish({ analysis, diagnostics: [], outcome: 'partial' });
	} catch (error) {
		if (error instanceof CompilerProjectProgramCapabilityError) {
			const failure = compilerCapabilityFailure(
				error,
				progress.activePhase() ?? 'PROGRAM_CONSTRUCT'
			);
			progress.fail({}, failure.code);
			return progress.finish(
				unavailable(failure.code, failure.message, failure.phase, failure.path)
			);
		}
		if (error instanceof DeclarationContextAnalysisFailure) {
			progress.fail({}, error.code);
			return progress.finish(unavailable(error.code, error.message, error.phase, error.path));
		}
		progress.fail({}, 'REQUEST_INVALID');
		return progress.finish(
			unavailable(
				'REQUEST_INVALID',
				'Declaration-context input inspection or derivation failed closed.',
				'REQUEST_BIND'
			)
		);
	}
}
