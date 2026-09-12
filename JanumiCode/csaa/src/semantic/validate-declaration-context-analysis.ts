import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

import ts from 'typescript';

import {
	DECLARATION_CONTEXT_ANALYSIS_AUTHORITY,
	DECLARATION_CONTEXT_ANALYSIS_ARTIFACT_ROLE_ORDER,
	DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER,
	DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE,
	DECLARATION_CONTEXT_ANALYSIS_CAPABILITY,
	DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS,
	DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS,
	DECLARATION_CONTEXT_ANALYSIS_FRESHNESS,
	DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
	DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
	DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE,
	DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT,
	DECLARATION_CONTEXT_ANALYSIS_METHOD,
	DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS,
	DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SELECTION,
	type DeclarationContextAliasHopWitness,
	type DeclarationContextAnalysisBuildInputs,
	type DeclarationContextAnalysisId,
	type DeclarationContextAnalysisSnapshot,
	type DeclarationContextAnalysisValidationIssue,
	type DeclarationContextAnalysisValidationOptions,
	type DeclarationContextAnalysisValidationResult,
	type DeclarationContextArtifactId,
	type DeclarationContextArtifactRecord,
	type DeclarationContextArtifactRole,
	type DeclarationContextDeclarationId,
	type DeclarationContextDeclarationKind,
	type DeclarationContextDeclarationRecord,
	type DeclarationContextExportBindingId,
	type DeclarationContextExportBindingRecord,
	type DeclarationContextMergeId,
	type DeclarationContextMergeRecord,
	type DeclarationContextParseWitnessId,
	type DeclarationContextParseWitnessRecord,
	type DeclarationContextProgramInputAttemptId,
	type DeclarationContextProgramInputAttemptRecord,
	type DeclarationContextProgramSourceIdentity,
	type DeclarationContextRelationId,
	type DeclarationContextRelationRecord,
	type DeclarationContextRelationRecordWithoutId,
	type DeclarationContextSourceEncoding,
	type DeclarationContextSymbolFlagsBinding,
	type DeclarationContextTerminalSymbolId,
	type DeclarationContextTerminalSymbolRecord
} from '../contracts/declaration-context-analysis.js';
import {
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type ProjectContextGraphRequest
} from '../contracts/project-context-graph.js';
import { TYPESCRIPT_PROVIDER_VERSION } from '../contracts/semantic.js';
import { validateConstructedProjectContextGraph } from '../graph/validate-project-context-graph.js';
import { validateConstructedConditionalExportResolution } from '../resolution/validate-conditional-export-resolution.js';
import { validateConstructedModuleResolutionTrace } from '../resolution/validate-module-resolution-trace.js';
import {
	CompilerProjectProgramCapabilityError,
	createCompilerProjectProgramSession
} from './compiler-project-program-capability.js';
import { validateStaticSemanticSnapshot } from './validate-snapshot.js';

type CompilerProjectProgramSession = ReturnType<typeof createCompilerProjectProgramSession>;

interface DeclarationContextAnalysisValidationProvider {
	readonly compilerOptions: (session: CompilerProjectProgramSession) => ts.CompilerOptions;
	readonly createSession: typeof createCompilerProjectProgramSession;
	readonly finalizeSession: (
		session: CompilerProjectProgramSession
	) => ReturnType<CompilerProjectProgramSession['finalize']>;
	readonly getAliasedSymbol: (
		session: CompilerProjectProgramSession,
		symbol: ts.Symbol
	) => ts.Symbol;
	readonly getDeclarations: (symbol: ts.Symbol) => readonly ts.Declaration[] | undefined;
	readonly getExportsOfModule: (
		session: CompilerProjectProgramSession,
		symbol: ts.Symbol
	) => readonly ts.Symbol[];
	readonly getSymbolAtLocation: (
		session: CompilerProjectProgramSession,
		node: ts.Node
	) => ts.Symbol | undefined;
	readonly isAliasSymbol: (symbol: ts.Symbol) => boolean;
	readonly isExternalModule: (sourceFile: ts.SourceFile) => boolean;
	readonly monotonicNow: () => number;
	readonly parseCapturedSourceFile: (
		session: CompilerProjectProgramSession,
		logicalPath: string
	) => ReturnType<CompilerProjectProgramSession['parseCapturedSourceFile']>;
	readonly programSourceFiles: (session: CompilerProjectProgramSession) => readonly ts.SourceFile[];
	readonly sessionIdentity: (session: CompilerProjectProgramSession) => {
		readonly configPath: string;
		readonly semanticProgramId: string;
		readonly semanticProjectId: string;
	};
	readonly symbolFlags: (symbol: ts.Symbol) => number;
	readonly symbolName: (symbol: ts.Symbol) => string;
	readonly syntacticDiagnostics: (
		session: CompilerProjectProgramSession,
		sourceFile: ts.SourceFile
	) => readonly ts.Diagnostic[];
}

/** @internal Defensive fault-injection surface; not exported from the package root. */
export type DeclarationContextAnalysisValidationProviderOverrides =
	Partial<DeclarationContextAnalysisValidationProvider>;

const DIRECT_VALIDATION_PROVIDER: Readonly<DeclarationContextAnalysisValidationProvider> =
	Object.freeze<DeclarationContextAnalysisValidationProvider>({
		compilerOptions: (session) => session.program.getCompilerOptions(),
		createSession: createCompilerProjectProgramSession,
		finalizeSession: (session) => session.finalize(),
		getAliasedSymbol: (session, symbol) => session.checker.getAliasedSymbol(symbol),
		getDeclarations: (symbol) => symbol.getDeclarations(),
		getExportsOfModule: (session, symbol) => session.checker.getExportsOfModule(symbol),
		getSymbolAtLocation: (session, node) => session.checker.getSymbolAtLocation(node),
		isAliasSymbol: (symbol) => (symbol.flags & ts.SymbolFlags.Alias) !== 0,
		isExternalModule: (sourceFile) => ts.isExternalModule(sourceFile),
		monotonicNow: () => performance.now(),
		parseCapturedSourceFile: (session, logicalPath) => session.parseCapturedSourceFile(logicalPath),
		programSourceFiles: (session) => session.program.getSourceFiles(),
		sessionIdentity: (session) => ({
			configPath: session.configPath,
			semanticProgramId: session.semanticProgramId,
			semanticProjectId: session.semanticProjectId
		}),
		symbolFlags: (symbol) => symbol.flags,
		symbolName: (symbol) => symbol.getName(),
		syntacticDiagnostics: (session, sourceFile) =>
			session.program.getSyntacticDiagnostics(sourceFile)
	});

interface ClosedOptions {
	readonly maxDepth: number;
	readonly maxDurationMs: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

const DEFAULT_OPTIONS: ClosedOptions = {
	maxDepth: 128,
	maxDurationMs: Number.MAX_SAFE_INTEGER,
	maxInputRecords: 10_000_000,
	maxInputStringCharacters: 1_000_000_000,
	maxIssues: 1_000,
	maxRecords: 10_000_000,
	maxStringCharacters: 1_000_000_000
};

const SHA256 = /^[0-9a-f]{64}$/u;

function isProxyValue(value: unknown): boolean {
	return (
		value !== null && (typeof value === 'object' || typeof value === 'function') && isProxy(value)
	);
}

function isUnicodeScalarString(text: string, checkpoint: DeadlineCheckpoint): boolean {
	for (let index = 0; index < text.length; index += 1) {
		checkpoint();
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = text.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) return false;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			return false;
		}
	}
	return true;
}

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
const SELECTION_KEYS = [
	'aliasDeclarationClosure',
	'aliasResolution',
	'ambientEffectRefusal',
	'ambientEffectPopulation',
	'artifactOrdering',
	'artifactRoleOrder',
	'astNodeCounting',
	'attemptOrdering',
	'augmentationPopulation',
	'augmentationRefusal',
	'cap001Carrier',
	'cap002Consumption',
	'checkerApis',
	'criterion',
	'declarationKindProfile',
	'declarationOrdering',
	'diagnosticPolicy',
	'deliveryWorkPackage',
	'declarationArtifactPopulation',
	'exportSelection',
	'exportSymbolCounting',
	'languageVersionName',
	'mergeSemantics',
	'nativeDeclarationKindName',
	'programAstPopulation',
	'programConstruction',
	'programInputAccounting',
	'programInputStages',
	'relationOrdering',
	'selectedArtifactParseAccounting',
	'selectedArtifactAstPopulation',
	'sourceDecoding',
	'sourceEncodingNames',
	'symbolFlagNameProfile',
	'terminalAliasCycle',
	'terminalAliasHopCounting',
	'terminalDeclarationCensusReconciliation',
	'terminalDeclarationClosure',
	'terminalDeclarationPlacement',
	'unsupportedTreatment'
] as const;
const SNAPSHOT_KEYS = [
	'ambientEffectRecords',
	'analysisAuthority',
	'artifacts',
	'augmentationRecords',
	'authorityTransfer',
	'budgets',
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'closure',
	'conditionalExportResolution',
	'contentDigest',
	'coverage',
	'currentness',
	'declarations',
	'exportBinding',
	'freshness',
	'fullJanCsaa007Conformance',
	'fullJanCsaa008Conformance',
	'fullJanCsaa013Conformance',
	'gateEffect',
	'health',
	'id',
	'inputDigest',
	'merges',
	'method',
	'moduleResolutionTrace',
	'nonclaims',
	'operationVersion',
	'parseWitnesses',
	'programInputAttempts',
	'programWitness',
	'projectContextGraph',
	'relations',
	'resultCompleteness',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'semanticValidationWitness',
	'subjectId',
	'terminalSymbol',
	'truncation'
] as const;

function issue(
	code: DeclarationContextAnalysisValidationIssue['code'],
	message: string,
	path = '$'
): DeclarationContextAnalysisValidationIssue {
	return { code, message, path };
}

function invalid(
	problem: DeclarationContextAnalysisValidationIssue
): DeclarationContextAnalysisValidationResult {
	return {
		issues: [problem],
		state: problem.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

function compareText(left: string, right: string, checkpoint: DeadlineCheckpoint): number {
	const sharedLength = Math.min(left.length, right.length);
	for (let index = 0; index < sharedLength; index += 1) {
		checkpoint();
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) return difference < 0 ? -1 : 1;
	}
	checkpoint();
	if (left.length < right.length) return -1;
	return left.length > right.length ? 1 : 0;
}

function sameText(left: string, right: string, checkpoint: DeadlineCheckpoint): boolean {
	return compareText(left, right, checkpoint) === 0;
}

function checkedFilter<T>(
	values: readonly T[],
	predicate: (value: T, index: number) => boolean,
	checkpoint: DeadlineCheckpoint
): T[] {
	const filtered: T[] = [];
	for (let index = 0; index < values.length; index += 1) {
		checkpoint();
		const value = values[index]!;
		if (predicate(value, index)) filtered.push(value);
	}
	return filtered;
}

function checkedMap<T, U>(
	values: readonly T[],
	mapper: (value: T, index: number) => U,
	checkpoint: DeadlineCheckpoint
): U[] {
	const mapped: U[] = [];
	for (let index = 0; index < values.length; index += 1) {
		checkpoint();
		mapped.push(mapper(values[index]!, index));
	}
	return mapped;
}

function checkedSort<T>(
	values: readonly T[],
	compare: (left: T, right: T) => number,
	checkpoint: DeadlineCheckpoint
): T[] {
	const sorted = checkedMap(values, (value) => value, checkpoint);
	sorted.sort((left, right) => {
		checkpoint();
		return compare(left, right);
	});
	return sorted;
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
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function closeOptions(
	value: DeclarationContextAnalysisValidationOptions | undefined
): ClosedOptions | null {
	if (value === undefined) return DEFAULT_OPTIONS;
	if (!plainRecord(value)) return null;
	const allowed = new Set([
		'maxDepth',
		'maxDurationMs',
		'maxInputRecords',
		'maxInputStringCharacters',
		'maxIssues',
		'maxRecords',
		'maxStringCharacters'
	]);
	const optionKeys = Reflect.ownKeys(value);
	if (optionKeys.length > allowed.size) return null;
	for (const key of optionKeys) if (typeof key !== 'string' || !allowed.has(key)) return null;
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

function earlyRequestDuration(value: unknown): number | null {
	const ownDataValue = (container: unknown, key: string): unknown => {
		if (!plainRecord(container)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(container, key);
		return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor
			? descriptor.value
			: undefined;
	};
	const request = ownDataValue(value, 'request');
	const budgets = ownDataValue(request, 'budgets');
	const maxDurationMs = ownDataValue(budgets, 'maxDurationMs');
	return safePositive(maxDurationMs) ? maxDurationMs : null;
}

type DescriptorPath =
	| { readonly root: string; readonly state: 'ROOT' }
	| {
			readonly arrayIndex: boolean;
			readonly key: string;
			readonly parent: DescriptorPath;
			readonly state: 'CHILD';
	  };

type DescriptorFrame =
	| {
			readonly depth: number;
			readonly path: DescriptorPath;
			readonly state: 'VISIT';
			readonly value: unknown;
	  }
	| {
			readonly array: boolean;
			readonly depth: number;
			readonly index: number;
			readonly keys: readonly string[];
			readonly path: DescriptorPath;
			readonly state: 'CHILDREN';
			readonly value: object;
	  }
	| { readonly state: 'LEAVE'; readonly value: object };

interface DescriptorWalkState {
	readonly active: WeakSet<object>;
	characters: number;
	checkpoint: DeadlineCheckpoint;
	readonly durationIssue: (() => DeclarationContextAnalysisValidationIssue | null) | undefined;
	readonly limits: Pick<ClosedOptions, 'maxDepth' | 'maxRecords' | 'maxStringCharacters'>;
	readonly malformedCode: DeclarationContextAnalysisValidationIssue['code'];
	readonly pending: DescriptorFrame[];
	records: number;
}

interface DescriptorContainerScope {
	readonly array: boolean;
	readonly arrayLength: number | null;
	readonly container: object;
	readonly path: DescriptorPath;
	readonly stringKeys: readonly string[];
}

function descriptorDurationProblem(
	state: DescriptorWalkState
): DeclarationContextAnalysisValidationIssue | null {
	const problem = state.durationIssue?.();
	return problem ?? null;
}

function assertDescriptorDuration(state: DescriptorWalkState): void {
	const problem = descriptorDurationProblem(state);
	if (problem !== null) throw new ValidationAbort(problem);
}

function renderDescriptorPath(state: DescriptorWalkState, path: DescriptorPath): string {
	const children: Array<Extract<DescriptorPath, { readonly state: 'CHILD' }>> = [];
	let current = path;
	while (current.state === 'CHILD') {
		assertDescriptorDuration(state);
		children.push(current);
		current = current.parent;
	}
	const pieces = [current.root];
	for (let index = children.length - 1; index >= 0; index -= 1) {
		assertDescriptorDuration(state);
		const child = children[index]!;
		if (child.arrayIndex) pieces.push('[', child.key, ']');
		else pieces.push('.', child.key);
	}
	assertDescriptorDuration(state);
	return pieces.join('');
}

function descriptorIssue(
	state: DescriptorWalkState,
	code: DeclarationContextAnalysisValidationIssue['code'],
	message: string,
	path: DescriptorPath
): DeclarationContextAnalysisValidationIssue {
	return issue(code, message, renderDescriptorPath(state, path));
}

function descriptorChildrenStep(
	state: DescriptorWalkState,
	frame: Extract<DescriptorFrame, { readonly state: 'CHILDREN' }>
): DeclarationContextAnalysisValidationIssue | null {
	const timingProblem = descriptorDurationProblem(state);
	if (timingProblem !== null) return timingProblem;
	if (frame.index === frame.keys.length) return null;
	const key = frame.keys[frame.index]!;
	state.pending.push({
		array: frame.array,
		depth: frame.depth,
		index: frame.index + 1,
		keys: frame.keys,
		path: frame.path,
		state: 'CHILDREN',
		value: frame.value
	});
	if (frame.array && key === 'length') return null;
	const childPath: DescriptorPath = {
		arrayIndex: frame.array,
		key,
		parent: frame.path,
		state: 'CHILD'
	};
	state.pending.push({
		depth: frame.depth + 1,
		path: childPath,
		state: 'VISIT',
		value: Reflect.getOwnPropertyDescriptor(frame.value, key)!.value
	});
	return null;
}

function descriptorStringIssue(
	state: DescriptorWalkState,
	text: string,
	path: DescriptorPath
): DeclarationContextAnalysisValidationIssue | null {
	if (!isUnicodeScalarString(text, state.checkpoint))
		return descriptorIssue(
			state,
			state.malformedCode,
			'Strings must contain Unicode scalar text.',
			path
		);
	if (text.length > state.limits.maxStringCharacters - state.characters)
		return descriptorIssue(
			state,
			'BUDGET_EXHAUSTED',
			'The descriptor string-character budget was exhausted.',
			path
		);
	state.characters += text.length;
	return null;
}

function isAcceptedDescriptorPrimitive(value: unknown): boolean {
	return (
		value === null ||
		typeof value === 'boolean' ||
		(typeof value === 'number' &&
			Number.isFinite(value) &&
			(!Number.isInteger(value) || Number.isSafeInteger(value)) &&
			!Object.is(value, -0))
	);
}

function descriptorContainerShapeIssue(
	state: DescriptorWalkState,
	container: object,
	path: DescriptorPath
): DeclarationContextAnalysisValidationIssue | null {
	if (isProxyValue(container))
		return descriptorIssue(state, state.malformedCode, 'Proxy values are not accepted.', path);
	if (state.active.has(container))
		return descriptorIssue(state, state.malformedCode, 'Cyclic data is not accepted.', path);
	const array = Array.isArray(container);
	const prototype = Reflect.getPrototypeOf(container);
	if (
		(array && prototype !== Array.prototype) ||
		(!array && prototype !== Object.prototype && prototype !== null)
	)
		return descriptorIssue(
			state,
			state.malformedCode,
			'Containers must have ordinary prototypes.',
			path
		);
	return null;
}

function descriptorSymbolKeyIssue(
	state: DescriptorWalkState,
	keys: readonly (string | symbol)[],
	path: DescriptorPath
): DeclarationContextAnalysisValidationIssue | null {
	for (const key of keys) {
		const keyTimingProblem = descriptorDurationProblem(state);
		if (keyTimingProblem !== null) return keyTimingProblem;
		if (typeof key !== 'string')
			return descriptorIssue(state, state.malformedCode, 'Symbol keys are not accepted.', path);
	}
	return null;
}

function descriptorKeyCharacterIssue(
	state: DescriptorWalkState,
	scope: DescriptorContainerScope
): DeclarationContextAnalysisValidationIssue | null {
	for (const key of scope.stringKeys) {
		const keyTimingProblem = descriptorDurationProblem(state);
		if (keyTimingProblem !== null) return keyTimingProblem;
		if (scope.array && key === 'length') continue;
		if (key.length > state.limits.maxStringCharacters - state.characters)
			return descriptorIssue(
				state,
				'BUDGET_EXHAUSTED',
				'The descriptor string-character budget was exhausted by a property key.',
				scope.path
			);
		state.characters += key.length;
		if (!isUnicodeScalarString(key, state.checkpoint))
			return descriptorIssue(
				state,
				state.malformedCode,
				'Property keys must contain Unicode scalar text.',
				scope.path
			);
	}
	return null;
}

interface DescriptorArrayIndexReading {
	readonly index: number;
	readonly timingProblem: DeclarationContextAnalysisValidationIssue | null;
}

function readDescriptorArrayIndex(
	state: DescriptorWalkState,
	key: string
): DescriptorArrayIndexReading {
	let arrayIndex = 0;
	for (let characterIndex = 0; characterIndex < key.length; characterIndex += 1) {
		const characterTimingProblem = descriptorDurationProblem(state);
		if (characterTimingProblem !== null)
			return { index: arrayIndex, timingProblem: characterTimingProblem };
		const code = key.codePointAt(characterIndex)!;
		if (code < 0x30 || code > 0x39) {
			arrayIndex = Number.MAX_SAFE_INTEGER;
			break;
		}
		const digit = code - 0x30;
		if (arrayIndex > Math.floor((Number.MAX_SAFE_INTEGER - digit) / 10)) {
			arrayIndex = Number.MAX_SAFE_INTEGER;
			break;
		}
		arrayIndex = arrayIndex * 10 + digit;
	}
	return { index: arrayIndex, timingProblem: null };
}

function descriptorDenseArrayKeyIssue(
	state: DescriptorWalkState,
	scope: DescriptorContainerScope,
	key: string
): DeclarationContextAnalysisValidationIssue | null {
	if (key.length === 0 || (key.length > 1 && key.codePointAt(0) === 0x30))
		return descriptorIssue(
			state,
			state.malformedCode,
			'Arrays must be dense without extra properties.',
			scope.path
		);
	const reading = readDescriptorArrayIndex(state, key);
	if (reading.timingProblem !== null) return reading.timingProblem;
	if (reading.index >= scope.arrayLength! || String(reading.index) !== key)
		return descriptorIssue(
			state,
			state.malformedCode,
			'Arrays must be dense without extra properties.',
			scope.path
		);
	return null;
}

function descriptorDenseArrayIssue(
	state: DescriptorWalkState,
	scope: DescriptorContainerScope
): DeclarationContextAnalysisValidationIssue | null {
	if (scope.stringKeys.length !== scope.arrayLength! + 1)
		return descriptorIssue(
			state,
			state.malformedCode,
			'Arrays must be dense ordinary arrays.',
			scope.path
		);
	for (const key of scope.stringKeys) {
		const keyTimingProblem = descriptorDurationProblem(state);
		if (keyTimingProblem !== null) return keyTimingProblem;
		if (key === 'length') continue;
		const keyProblem = descriptorDenseArrayKeyIssue(state, scope, key);
		if (keyProblem !== null) return keyProblem;
	}
	return null;
}

function descriptorPropertyDataIssue(
	state: DescriptorWalkState,
	scope: DescriptorContainerScope
): DeclarationContextAnalysisValidationIssue | null {
	for (let index = scope.stringKeys.length - 1; index >= 0; index -= 1) {
		const keyTimingProblem = descriptorDurationProblem(state);
		if (keyTimingProblem !== null) return keyTimingProblem;
		const key = scope.stringKeys[index]!;
		if (scope.array && key === 'length') continue;
		const descriptor = Reflect.getOwnPropertyDescriptor(scope.container, key)!;
		if (!descriptor.enumerable || !('value' in descriptor))
			return descriptorIssue(
				state,
				state.malformedCode,
				'Properties must be enumerable data properties.',
				{ arrayIndex: scope.array, key, parent: scope.path, state: 'CHILD' }
			);
	}
	return null;
}

function descriptorContainerKeyIssue(
	state: DescriptorWalkState,
	scope: DescriptorContainerScope
): DeclarationContextAnalysisValidationIssue | null {
	const characterProblem = descriptorKeyCharacterIssue(state, scope);
	if (characterProblem !== null) return characterProblem;
	if (scope.array) {
		const denseProblem = descriptorDenseArrayIssue(state, scope);
		if (denseProblem !== null) return denseProblem;
	}
	return descriptorPropertyDataIssue(state, scope);
}

function descriptorContainerIssue(
	state: DescriptorWalkState,
	frame: Extract<DescriptorFrame, { readonly state: 'VISIT' }>
): DeclarationContextAnalysisValidationIssue | null {
	if (typeof frame.value !== 'object')
		return descriptorIssue(
			state,
			state.malformedCode,
			'Only JSON-compatible data values are accepted.',
			frame.path
		);
	const container = frame.value as object;
	const shapeProblem = descriptorContainerShapeIssue(state, container, frame.path);
	if (shapeProblem !== null) return shapeProblem;
	const array = Array.isArray(container);
	let arrayLength: number | null = null;
	if (array) {
		arrayLength = Reflect.getOwnPropertyDescriptor(container, 'length')!.value as number;
		if (arrayLength > state.limits.maxRecords - state.records)
			return descriptorIssue(
				state,
				'BUDGET_EXHAUSTED',
				'The descriptor record budget was exhausted by an array population.',
				frame.path
			);
	}
	const keys = Reflect.ownKeys(container);
	const symbolKeyProblem = descriptorSymbolKeyIssue(state, keys, frame.path);
	if (symbolKeyProblem !== null) return symbolKeyProblem;
	const stringKeys = keys as string[];
	if (!array && keys.length > state.limits.maxRecords - state.records) {
		return descriptorIssue(
			state,
			'BUDGET_EXHAUSTED',
			'The descriptor record budget was exhausted by a property population.',
			frame.path
		);
	}
	const keyProblem = descriptorContainerKeyIssue(state, {
		array,
		arrayLength,
		container,
		path: frame.path,
		stringKeys
	});
	if (keyProblem !== null) return keyProblem;
	state.active.add(container);
	state.pending.push(
		{ state: 'LEAVE', value: container },
		{
			array,
			depth: frame.depth,
			index: 0,
			keys: stringKeys,
			path: frame.path,
			state: 'CHILDREN',
			value: container
		}
	);
	return null;
}

function descriptorVisitStep(
	state: DescriptorWalkState,
	frame: Extract<DescriptorFrame, { readonly state: 'VISIT' }>
): DeclarationContextAnalysisValidationIssue | null {
	const timingProblem = descriptorDurationProblem(state);
	if (timingProblem !== null) return timingProblem;
	state.records += 1;
	if (state.records > state.limits.maxRecords)
		return descriptorIssue(
			state,
			'BUDGET_EXHAUSTED',
			'The descriptor record budget was exhausted.',
			frame.path
		);
	if (frame.depth > state.limits.maxDepth)
		return descriptorIssue(
			state,
			'BUDGET_EXHAUSTED',
			'The descriptor depth budget was exhausted.',
			frame.path
		);
	if (typeof frame.value === 'string') return descriptorStringIssue(state, frame.value, frame.path);
	if (isAcceptedDescriptorPrimitive(frame.value)) return null;
	return descriptorContainerIssue(state, frame);
}

/** Descriptor-only traversal: accessors, iterators, callbacks, and toJSON are never invoked. */
function plainTreeIssue(
	value: unknown,
	limits: Pick<ClosedOptions, 'maxDepth' | 'maxRecords' | 'maxStringCharacters'>,
	rootPath: string,
	input = false,
	durationIssue?: () => DeclarationContextAnalysisValidationIssue | null
): DeclarationContextAnalysisValidationIssue | null {
	const state: DescriptorWalkState = {
		active: new WeakSet<object>(),
		characters: 0,
		checkpoint: (): void => undefined,
		durationIssue,
		limits,
		malformedCode: input ? 'INPUT_INVALID' : 'SHAPE_INVALID',
		pending: [{ depth: 0, path: { root: rootPath, state: 'ROOT' }, state: 'VISIT', value }],
		records: 0
	};
	state.checkpoint = (): void => {
		assertDescriptorDuration(state);
	};
	while (state.pending.length > 0) {
		const frame = state.pending.pop()!;
		if (frame.state === 'LEAVE') {
			state.active.delete(frame.value);
			continue;
		}
		const problem =
			frame.state === 'CHILDREN'
				? descriptorChildrenStep(state, frame)
				: descriptorVisitStep(state, frame);
		if (problem !== null) return problem;
	}
	return null;
}

type DeadlineCheckpoint = () => void;

type CanonicalFrame =
	| {
			readonly index: number;
			readonly length: number;
			readonly state: 'ARRAY';
			readonly value: unknown[];
	  }
	| {
			readonly index: number;
			readonly keys: readonly string[];
			readonly object: object;
			readonly state: 'OBJECT';
	  }
	| { readonly state: 'VALUE'; readonly value: unknown };

function jsonEscapedCodeUnit(value: string, index: number, code: number): string {
	switch (code) {
		case 0x08:
			return String.raw`\b`;
		case 0x09:
			return String.raw`\t`;
		case 0x0a:
			return String.raw`\n`;
		case 0x0c:
			return String.raw`\f`;
		case 0x0d:
			return String.raw`\r`;
		case 0x22:
			return String.raw`\"`;
		case 0x5c:
			return '\\\\';
		default:
			return code < 0x20 ? String.raw`\u${code.toString(16).padStart(4, '0')}` : value[index]!;
	}
}

interface JsonStringUnit {
	encoded: string;
	width: number;
}

/** Reads one canonical JSON string unit at `index`, striding by UTF-16 code unit. */
function readJsonStringUnit(unit: JsonStringUnit, value: string, index: number): void {
	const code = value.charCodeAt(index);
	if (code >= 0xd800 && code <= 0xdbff) {
		const next = value.charCodeAt(index + 1);
		if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff)
			throw new TypeError('Canonical JSON rejects lone UTF-16 surrogates.');
		unit.encoded = value.slice(index, index + 2);
		unit.width = 2;
		return;
	}
	if (code >= 0xdc00 && code <= 0xdfff)
		throw new TypeError('Canonical JSON rejects lone UTF-16 surrogates.');
	unit.encoded = jsonEscapedCodeUnit(value, index, code);
	unit.width = 1;
}

function* jsonStringChunks(
	value: string,
	checkpoint: DeadlineCheckpoint
): Generator<string, void, undefined> {
	yield '"';
	let buffered = '';
	const flush = function* (): Generator<string, void, undefined> {
		if (buffered.length === 0) return;
		yield buffered;
		buffered = '';
	};
	const unit: JsonStringUnit = { encoded: '', width: 1 };
	for (let index = 0; index < value.length; index += 1) {
		checkpoint();
		readJsonStringUnit(unit, value, index);
		index += unit.width - 1;
		if (buffered.length + unit.encoded.length > 1_024) yield* flush();
		buffered += unit.encoded;
	}
	yield* flush();
	yield '"';
}

function* canonicalArrayChunks(
	frame: Extract<CanonicalFrame, { readonly state: 'ARRAY' }>,
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
	frame: Extract<CanonicalFrame, { readonly state: 'OBJECT' }>,
	pending: CanonicalFrame[],
	checkpoint: DeadlineCheckpoint
): Generator<string, void, undefined> {
	if (frame.index === frame.keys.length) {
		yield '}';
		return;
	}
	if (frame.index !== 0) yield ',';
	const key = frame.keys[frame.index]!;
	yield* jsonStringChunks(key, checkpoint);
	yield ':';
	pending.push(
		{ ...frame, index: frame.index + 1 },
		{ state: 'VALUE', value: Reflect.getOwnPropertyDescriptor(frame.object, key)!.value }
	);
}

function* canonicalValueChunks(
	input: unknown,
	pending: CanonicalFrame[],
	checkpoint: DeadlineCheckpoint
): Generator<string, void, undefined> {
	if (input === null) {
		yield 'null';
		return;
	}
	if (typeof input === 'string') {
		yield* jsonStringChunks(input, checkpoint);
		return;
	}
	if (typeof input === 'boolean') {
		yield input ? 'true' : 'false';
		return;
	}
	if (typeof input === 'number') {
		if (!Number.isFinite(input) || (Number.isInteger(input) && !Number.isSafeInteger(input)))
			throw new TypeError('Canonical JSON requires finite safe integer numbers.');
		yield JSON.stringify(input);
		return;
	}
	const objectInput = input as object;
	if (Array.isArray(objectInput)) {
		const length = Reflect.getOwnPropertyDescriptor(objectInput, 'length')!.value as number;
		yield '[';
		pending.push({ index: 0, length, state: 'ARRAY', value: objectInput });
		return;
	}
	const keys = Reflect.ownKeys(objectInput) as string[];
	keys.sort((left, right) => {
		checkpoint();
		return compareText(left, right, checkpoint);
	});
	yield '{';
	pending.push({ index: 0, keys, object: objectInput, state: 'OBJECT' });
}

/** Validator-private canonical token stream over values already accepted by plainTreeIssue. */
function* canonicalChunks(
	value: unknown,
	checkpoint: DeadlineCheckpoint
): Generator<string, void, undefined> {
	const pending: CanonicalFrame[] = [{ state: 'VALUE', value }];
	while (pending.length > 0) {
		checkpoint();
		const frame = pending.pop()!;
		if (frame.state === 'ARRAY') {
			yield* canonicalArrayChunks(frame, pending);
			continue;
		}
		if (frame.state === 'OBJECT') {
			yield* canonicalObjectChunks(frame, pending, checkpoint);
			continue;
		}
		yield* canonicalValueChunks(frame.value, pending, checkpoint);
	}
}

function writeCanonical(
	value: unknown,
	write: (chunk: string) => void,
	checkpoint: DeadlineCheckpoint
): void {
	for (const chunk of canonicalChunks(value, checkpoint)) {
		checkpoint();
		write(chunk);
	}
}

function canonicalSha256(value: unknown, checkpoint: DeadlineCheckpoint): string {
	checkpoint();
	const hash = createHash('sha256');
	writeCanonical(value, (chunk) => hash.update(chunk, 'utf8'), checkpoint);
	checkpoint();
	return hash.digest('hex');
}

interface CanonicalCodeUnitCursor {
	chunk: string;
	done: boolean;
	index: number;
	readonly iterator: Generator<string, void, undefined>;
}

function canonicalCursor(value: unknown, checkpoint: DeadlineCheckpoint): CanonicalCodeUnitCursor {
	return {
		chunk: '',
		done: false,
		index: 0,
		iterator: canonicalChunks(value, checkpoint)
	};
}

function nextCanonicalCodeUnit(
	cursor: CanonicalCodeUnitCursor,
	checkpoint: DeadlineCheckpoint
): number | null {
	while (true) {
		checkpoint();
		if (cursor.index < cursor.chunk.length) {
			const codeUnit = cursor.chunk.charCodeAt(cursor.index);
			cursor.index += 1;
			return codeUnit;
		}
		if (cursor.done) return null;
		const next = cursor.iterator.next();
		cursor.done = next.done === true;
		cursor.chunk = next.done === true ? '' : next.value;
		cursor.index = 0;
	}
}

function canonicalEqual(left: unknown, right: unknown, checkpoint: DeadlineCheckpoint): boolean {
	const leftCursor = canonicalCursor(left, checkpoint);
	const rightCursor = canonicalCursor(right, checkpoint);
	while (true) {
		checkpoint();
		const leftCodeUnit = nextCanonicalCodeUnit(leftCursor, checkpoint);
		const rightCodeUnit = nextCanonicalCodeUnit(rightCursor, checkpoint);
		if (leftCodeUnit === null || rightCodeUnit === null)
			return leftCodeUnit === null && rightCodeUnit === null;
		if (leftCodeUnit !== rightCodeUnit) return false;
	}
}

function canonicalCompare(left: unknown, right: unknown, checkpoint: DeadlineCheckpoint): number {
	const leftCursor = canonicalCursor(left, checkpoint);
	const rightCursor = canonicalCursor(right, checkpoint);
	while (true) {
		checkpoint();
		const leftCodeUnit = nextCanonicalCodeUnit(leftCursor, checkpoint);
		const rightCodeUnit = nextCanonicalCodeUnit(rightCursor, checkpoint);
		if (leftCodeUnit === null || rightCodeUnit === null) {
			if (leftCodeUnit === rightCodeUnit) return 0;
			return leftCodeUnit === null ? -1 : 1;
		}
		if (leftCodeUnit !== rightCodeUnit) return leftCodeUnit < rightCodeUnit ? -1 : 1;
	}
}

/** @internal Exact test-only probe; intentionally absent from the package root. */
export function compareDeclarationContextAnalysisCanonicalValuesForTesting(
	left: unknown,
	right: unknown
): number {
	return canonicalCompare(left, right, () => undefined);
}

function domainDigest(domain: string, preimage: unknown, checkpoint: DeadlineCheckpoint): string {
	checkpoint();
	const hash = createHash('sha256');
	hash.update(domain, 'utf8');
	hash.update('\0', 'utf8');
	hash.update('1', 'utf8');
	hash.update('\0', 'utf8');
	writeCanonical(preimage, (chunk) => hash.update(chunk, 'utf8'), checkpoint);
	checkpoint();
	return hash.digest('hex');
}

function identity<Kind extends string>(
	prefix: string,
	domain: string,
	preimage: unknown,
	checkpoint: DeadlineCheckpoint
): Kind {
	return `${prefix}-${domainDigest(domain, preimage, checkpoint)}` as Kind;
}

function safeAdd(left: number, right: number, label: string): number {
	const result = left + right;
	if (!Number.isSafeInteger(result))
		failDerivation('BUDGET_EXHAUSTED', `${label} exceeds safe-integer range.`);
	return result;
}

function cloneWire<T>(value: T, checkpoint: DeadlineCheckpoint): T {
	interface CloneFrame {
		readonly source: Record<string, unknown> | unknown[];
		readonly target: Record<string, unknown> | unknown[];
	}
	const pending: CloneFrame[] = [];
	const cloneValue = (input: unknown): unknown => {
		checkpoint();
		if (input === null || typeof input !== 'object') return input;
		const source = input as Record<string, unknown> | unknown[];
		let target: Record<string, unknown> | unknown[];
		if (Array.isArray(source)) target = new Array<unknown>(source.length);
		else {
			const prototype = Reflect.getPrototypeOf(source) === null ? null : Object.prototype;
			target = Object.create(prototype) as Record<string, unknown>;
		}
		pending.push({ source, target });
		return target;
	};
	const cloned = cloneValue(value);
	while (pending.length > 0) {
		checkpoint();
		const frame = pending.pop()!;
		if (Array.isArray(frame.source)) {
			for (let index = 0; index < frame.source.length; index += 1) {
				checkpoint();
				const key = String(index);
				const descriptor = Reflect.getOwnPropertyDescriptor(frame.source, key)!;
				Reflect.defineProperty(frame.target, key, {
					configurable: true,
					enumerable: true,
					value: cloneValue(descriptor.value),
					writable: true
				});
			}
			continue;
		}
		for (const key of Reflect.ownKeys(frame.source)) {
			checkpoint();
			const descriptor = Reflect.getOwnPropertyDescriptor(frame.source, key)!;
			Reflect.defineProperty(frame.target, key, {
				configurable: true,
				enumerable: true,
				value: cloneValue(descriptor.value),
				writable: true
			});
		}
	}
	return cloned as T;
}

class DerivationFailure extends Error {
	constructor(readonly problem: DeclarationContextAnalysisValidationIssue) {
		super(problem.message);
		this.name = 'DerivationFailure';
	}
}

class ValidationAbort extends Error {
	constructor(readonly problem: DeclarationContextAnalysisValidationIssue) {
		super(problem.message);
		this.name = 'ValidationAbort';
	}
}

function failDerivation(
	code: DeclarationContextAnalysisValidationIssue['code'],
	message: string,
	path = '$inputs'
): never {
	throw new DerivationFailure(issue(code, message, path));
}

function inputShellIssue(value: unknown): DeclarationContextAnalysisValidationIssue | null {
	if (!plainRecord(value) || !exactKeys(value, INPUT_KEYS))
		return issue(
			'INPUT_INVALID',
			'The declaration-context analysis input wrapper must be exact plain data.',
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
	inputs: DeclarationContextAnalysisBuildInputs,
	checkpoint: DeadlineCheckpoint
): DeclarationContextAnalysisValidationIssue | null {
	const { request } = inputs;
	if (
		!plainRecord(request) ||
		!exactKeys(request, REQUEST_KEYS) ||
		!plainRecord(request.budgets) ||
		!exactKeys(request.budgets, BUDGET_KEYS) ||
		!plainRecord(request.projectContextGraph) ||
		!exactKeys(request.projectContextGraph, GRAPH_REFERENCE_KEYS) ||
		!plainRecord(request.conditionalExportResolution) ||
		!exactKeys(request.conditionalExportResolution, SNAPSHOT_REFERENCE_KEYS) ||
		!plainRecord(request.moduleResolutionTrace) ||
		!exactKeys(request.moduleResolutionTrace, SNAPSHOT_REFERENCE_KEYS) ||
		!plainRecord(request.selection) ||
		!exactKeys(request.selection, SELECTION_KEYS)
	)
		return issue(
			'INPUT_INVALID',
			'The declaration-context analysis request shell is not exact.',
			'$inputs.request'
		);
	if (
		BUDGET_KEYS.some((key) =>
			key === 'maxAliasHops'
				? !safeNonnegative(request.budgets[key])
				: !safePositive(request.budgets[key])
		) ||
		request.budgets.maxDiagnostics > 100_000 ||
		request.budgets.maxReadBytes < request.budgets.maxProgramReadBytes ||
		request.schemaVersion !== DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION ||
		request.operationVersion !== DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION ||
		!canonicalEqual(request.selection, DECLARATION_CONTEXT_ANALYSIS_SELECTION, checkpoint)
	)
		return issue('INPUT_INVALID', 'Request constants or budgets are invalid.', '$inputs.request');
	if (
		typeof request.exportName !== 'string' ||
		request.exportName.length === 0 ||
		!isUnicodeScalarString(request.exportName, checkpoint)
	)
		return issue(
			'INPUT_INVALID',
			'The request export name must be nonempty Unicode scalar text.',
			'$inputs.request.exportName'
		);
	if (
		typeof request.subjectId !== 'string' ||
		!SHA256.test(request.subjectId) ||
		typeof request.semanticSnapshotId !== 'string' ||
		request.semanticSnapshotId.length === 0 ||
		typeof request.projectContextGraph.graphId !== 'string' ||
		request.projectContextGraph.graphId.length === 0 ||
		typeof request.conditionalExportResolution.id !== 'string' ||
		request.conditionalExportResolution.id.length === 0 ||
		typeof request.moduleResolutionTrace.id !== 'string' ||
		request.moduleResolutionTrace.id.length === 0 ||
		!SHA256.test(request.projectContextGraph.contentDigest) ||
		!SHA256.test(request.projectContextGraph.inputDigest) ||
		!SHA256.test(request.conditionalExportResolution.contentDigest) ||
		!SHA256.test(request.conditionalExportResolution.inputDigest) ||
		!SHA256.test(request.moduleResolutionTrace.contentDigest) ||
		!SHA256.test(request.moduleResolutionTrace.inputDigest)
	)
		return issue('INPUT_INVALID', 'Request identities are invalid.', '$inputs.request');
	return null;
}

function inputBindingIssue(
	inputs: DeclarationContextAnalysisBuildInputs,
	checkpoint: DeadlineCheckpoint
): DeclarationContextAnalysisValidationIssue | null {
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
	const same = (left: string, right: string): boolean => sameText(left, right, checkpoint);
	if (
		!same(request.subjectId, frozenSubject.descriptor.subjectId) ||
		!same(request.subjectId, semanticSnapshot.subjectId) ||
		!same(request.subjectId, projectContextGraph.subjectId) ||
		!same(request.subjectId, conditionalExportRequest.subjectId) ||
		!same(request.subjectId, conditionalExportResolution.subjectId) ||
		!same(request.subjectId, moduleResolutionRequest.subjectId) ||
		!same(request.subjectId, moduleResolutionTrace.subjectId) ||
		!same(request.semanticSnapshotId, semanticSnapshot.id) ||
		!same(request.semanticSnapshotId, projectContextGraph.semanticSnapshotId) ||
		!same(request.semanticSnapshotId, conditionalExportRequest.semanticSnapshotId) ||
		!same(request.semanticSnapshotId, conditionalExportResolution.semanticSnapshotId) ||
		!same(request.semanticSnapshotId, moduleResolutionRequest.semanticSnapshotId) ||
		!same(request.semanticSnapshotId, moduleResolutionTrace.semanticSnapshotId) ||
		!same(request.projectContextGraph.graphId, projectContextGraph.id) ||
		!same(request.projectContextGraph.contentDigest, projectContextGraph.contentDigest) ||
		!same(request.projectContextGraph.inputDigest, projectContextGraph.inputDigest) ||
		!same(request.conditionalExportResolution.id, conditionalExportResolution.id) ||
		!same(
			request.conditionalExportResolution.contentDigest,
			conditionalExportResolution.contentDigest
		) ||
		!same(
			request.conditionalExportResolution.inputDigest,
			conditionalExportResolution.inputDigest
		) ||
		!same(request.moduleResolutionTrace.id, moduleResolutionTrace.id) ||
		!same(request.moduleResolutionTrace.contentDigest, moduleResolutionTrace.contentDigest) ||
		!same(request.moduleResolutionTrace.inputDigest, moduleResolutionTrace.inputDigest)
	)
		return issue('IDENTITY_MISMATCH', 'Input identities do not bind exactly.', '$inputs.request');
	if (
		!same(conditionalExportRequest.projectContextGraph.graphId, projectContextGraph.id) ||
		!same(
			conditionalExportRequest.projectContextGraph.contentDigest,
			projectContextGraph.contentDigest
		) ||
		!same(
			conditionalExportRequest.projectContextGraph.inputDigest,
			projectContextGraph.inputDigest
		) ||
		!same(moduleResolutionRequest.projectContextGraph.graphId, projectContextGraph.id) ||
		!same(
			moduleResolutionRequest.projectContextGraph.contentDigest,
			projectContextGraph.contentDigest
		) ||
		!same(
			moduleResolutionRequest.projectContextGraph.inputDigest,
			projectContextGraph.inputDigest
		) ||
		!same(moduleResolutionRequest.conditionalExportResolution.id, conditionalExportResolution.id) ||
		!same(
			moduleResolutionRequest.conditionalExportResolution.contentDigest,
			conditionalExportResolution.contentDigest
		) ||
		!same(
			moduleResolutionRequest.conditionalExportResolution.inputDigest,
			conditionalExportResolution.inputDigest
		) ||
		!same(moduleResolutionTrace.projectContextGraph.graphId, projectContextGraph.id) ||
		!same(
			moduleResolutionTrace.projectContextGraph.contentDigest,
			projectContextGraph.contentDigest
		) ||
		!same(moduleResolutionTrace.projectContextGraph.inputDigest, projectContextGraph.inputDigest) ||
		!same(moduleResolutionTrace.conditionalExportResolution.id, conditionalExportResolution.id) ||
		!same(
			moduleResolutionTrace.conditionalExportResolution.contentDigest,
			conditionalExportResolution.contentDigest
		) ||
		!same(
			moduleResolutionTrace.conditionalExportResolution.inputDigest,
			conditionalExportResolution.inputDigest
		)
	)
		return issue(
			'IDENTITY_MISMATCH',
			'Predecessor request and result identities do not form one exact chain.',
			'$inputs'
		);
	const target = moduleResolutionTrace.targetWitness;
	if (
		!same(conditionalExportRequest.exportSubpath, '.') ||
		conditionalExportResolution.decision.state !== 'SELECTED_TARGET' ||
		typeof conditionalExportResolution.decision.target !== 'string' ||
		!same(moduleResolutionRequest.specifier, moduleResolutionRequest.packageName) ||
		!same(target.packageName, moduleResolutionRequest.packageName) ||
		!same(target.packageExportTarget, conditionalExportResolution.decision.target) ||
		target.artifactClass !== 'CONTEXT_ONLY' ||
		target.origin !== 'WORKSPACE_BUILD_DECLARATION' ||
		target.declarationFile !== true ||
		!['.d.ts', '.d.mts', '.d.cts'].includes(target.extension)
	)
		return issue(
			'INPUT_INVALID',
			'The analysis requires one exact CAP-011 selected declaration package-root target.',
			'$inputs.moduleResolutionTrace.targetWitness'
		);
	return null;
}

function predecessorIssue(
	inputs: DeclarationContextAnalysisBuildInputs,
	limits: ClosedOptions,
	checkpoint: DeadlineCheckpoint
): DeclarationContextAnalysisValidationIssue | null {
	checkpoint();
	const validationRecords = Math.min(
		limits.maxInputRecords,
		limits.maxRecords,
		inputs.request.budgets.maxInputRecords
	);
	const validationStrings = Math.min(
		limits.maxInputStringCharacters,
		limits.maxStringCharacters,
		inputs.request.budgets.maxInputStringCharacters
	);
	const validationIssues = Math.min(limits.maxIssues, inputs.request.budgets.maxDiagnostics);
	const semanticRecords = Math.min(
		validationRecords,
		inputs.moduleResolutionRequest.budgets.maxInputRecords,
		inputs.projectContextGraph.budgets.maxInputRecords
	);
	const semanticStrings = Math.min(
		validationStrings,
		inputs.moduleResolutionRequest.budgets.maxInputStringCharacters,
		inputs.projectContextGraph.budgets.maxInputStringCharacters
	);
	const semanticIssues = Math.min(
		validationIssues,
		inputs.moduleResolutionRequest.budgets.maxDiagnostics,
		inputs.projectContextGraph.budgets.maxDiagnostics
	);
	const semantic = validateStaticSemanticSnapshot(
		inputs.semanticSnapshot,
		{
			maxDepth: limits.maxDepth,
			maxDiagnostics: semanticIssues,
			maxIssues: semanticIssues,
			maxRecords: semanticRecords,
			maxReferenceChecks: semanticRecords,
			maxStringCharacters: semanticStrings
		},
		{ frozenSubject: inputs.frozenSubject }
	);
	checkpoint();
	if (semantic.state !== 'VALID')
		return issue(
			semantic.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
			'The static semantic predecessor is not valid for the exact FrozenSubject.',
			'$inputs.semanticSnapshot'
		);
	const graphRequest: ProjectContextGraphRequest = {
		budgets: inputs.projectContextGraph.budgets,
		operationVersion: PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
		schemaVersion: PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
		selection: PROJECT_CONTEXT_GRAPH_SELECTION,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.frozenSubject.descriptor.subjectId
	};
	const validationOptions = {
		maxDepth: limits.maxDepth,
		maxInputRecords: validationRecords,
		maxInputStringCharacters: validationStrings,
		maxIssues: validationIssues,
		maxRecords: Math.min(limits.maxRecords, validationRecords),
		maxStringCharacters: Math.min(limits.maxStringCharacters, validationStrings)
	};
	const graph = validateConstructedProjectContextGraph(
		inputs.projectContextGraph,
		{
			frozenSubject: inputs.frozenSubject,
			request: graphRequest,
			semanticSnapshot: inputs.semanticSnapshot
		},
		inputs.projectContextGraph.inputDigest,
		validationOptions
	);
	checkpoint();
	if (graph.state !== 'VALID')
		return issue(
			graph.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
			'The project-context predecessor is not independently valid.',
			'$inputs.projectContextGraph'
		);
	const conditional = validateConstructedConditionalExportResolution(
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
	checkpoint();
	if (conditional.state !== 'VALID')
		return issue(
			conditional.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
			'The conditional-export predecessor is not independently valid.',
			'$inputs.conditionalExportResolution'
		);
	const moduleTrace = validateConstructedModuleResolutionTrace(
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
	checkpoint();
	if (moduleTrace.state !== 'VALID')
		return issue(
			moduleTrace.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
			'The module-resolution predecessor is not independently valid.',
			'$inputs.moduleResolutionTrace'
		);
	return null;
}

function independentInputDigest(
	inputs: DeclarationContextAnalysisBuildInputs,
	checkpoint: DeadlineCheckpoint
): string {
	return domainDigest(
		'JAN-CSAA-DECLARATION-CONTEXT-ANALYSIS-INPUT',
		{
			conditionalExportRequest: inputs.conditionalExportRequest,
			conditionalExportResolution: {
				canonicalProfile: inputs.conditionalExportResolution.canonicalProfile,
				contentDigest: inputs.conditionalExportResolution.contentDigest,
				decision: inputs.conditionalExportResolution.decision,
				id: inputs.conditionalExportResolution.id,
				inputDigest: inputs.conditionalExportResolution.inputDigest,
				manifestWitness: inputs.conditionalExportResolution.manifestWitness,
				method: inputs.conditionalExportResolution.method,
				operationVersion: inputs.conditionalExportResolution.operationVersion,
				requestReference: inputs.request.conditionalExportResolution,
				schemaVersion: inputs.conditionalExportResolution.schemaVersion,
				semanticSnapshotId: inputs.conditionalExportResolution.semanticSnapshotId,
				subjectId: inputs.conditionalExportResolution.subjectId
			},
			frozenSubject: {
				fileManifestDigest: inputs.frozenSubject.descriptor.fileManifestDigest,
				operationVersion: inputs.frozenSubject.descriptor.operationVersion,
				policyVersion: inputs.frozenSubject.descriptor.policyVersion,
				schemaVersion: inputs.frozenSubject.descriptor.schemaVersion,
				subjectId: inputs.frozenSubject.descriptor.subjectId,
				subjectKind: inputs.frozenSubject.descriptor.subjectKind
			},
			moduleResolutionRequest: inputs.moduleResolutionRequest,
			moduleResolutionTrace: {
				canonicalProfile: inputs.moduleResolutionTrace.canonicalProfile,
				captureWitness: inputs.moduleResolutionTrace.captureWitness,
				contentDigest: inputs.moduleResolutionTrace.contentDigest,
				id: inputs.moduleResolutionTrace.id,
				importerWitness: inputs.moduleResolutionTrace.importerWitness,
				inputDigest: inputs.moduleResolutionTrace.inputDigest,
				method: inputs.moduleResolutionTrace.method,
				operationVersion: inputs.moduleResolutionTrace.operationVersion,
				requestReference: inputs.request.moduleResolutionTrace,
				resolverEnvironment: inputs.moduleResolutionTrace.resolverEnvironment,
				schemaVersion: inputs.moduleResolutionTrace.schemaVersion,
				semanticSnapshotId: inputs.moduleResolutionTrace.semanticSnapshotId,
				subjectId: inputs.moduleResolutionTrace.subjectId,
				targetWitness: inputs.moduleResolutionTrace.targetWitness
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
			semanticSnapshot: {
				canonicalProfile: inputs.semanticSnapshot.canonicalProfile,
				contextDigest: inputs.semanticSnapshot.contextDigest,
				extractionVersion: inputs.semanticSnapshot.extractionVersion,
				id: inputs.semanticSnapshot.id,
				operationVersion: inputs.semanticSnapshot.operationVersion,
				provider: inputs.semanticSnapshot.provider,
				schemaVersion: inputs.semanticSnapshot.schemaVersion,
				subjectId: inputs.semanticSnapshot.subjectId
			}
		},
		checkpoint
	);
}

function independentAnalysisId(
	inputs: DeclarationContextAnalysisBuildInputs,
	inputDigest: string,
	checkpoint: DeadlineCheckpoint
): DeclarationContextAnalysisId {
	return identity<DeclarationContextAnalysisId>(
		'declaration-context-analysis',
		'JAN-CSAA-DECLARATION-CONTEXT-ANALYSIS',
		{
			canonicalProfile: DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE,
			conditionalExportResolutionId: inputs.conditionalExportResolution.id,
			inputDigest,
			method: DECLARATION_CONTEXT_ANALYSIS_METHOD,
			moduleResolutionTraceId: inputs.moduleResolutionTrace.id,
			operationVersion: DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
			schemaVersion: DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION,
			semanticSnapshotId: inputs.semanticSnapshot.id,
			subjectId: inputs.frozenSubject.descriptor.subjectId
		},
		checkpoint
	);
}

function independentRecordId<Kind extends string>(
	prefix: string,
	domain: string,
	analysisId: DeclarationContextAnalysisId,
	record: unknown,
	checkpoint: DeadlineCheckpoint
): Kind {
	return identity<Kind>(
		prefix,
		domain,
		{ analysisId, ...(record as Record<string, unknown>) },
		checkpoint
	);
}

function independentProgramSourcePopulationDigest(
	sources: readonly DeclarationContextProgramSourceIdentity[],
	checkpoint: DeadlineCheckpoint
): string {
	const sorted = checkedSort(
		sources,
		(left, right) => canonicalCompare(left, right, checkpoint),
		checkpoint
	);
	return domainDigest('JAN-CSAA-DECLARATION-CONTEXT-PROGRAM-SOURCE-POPULATION', sorted, checkpoint);
}

function independentContentDigest(
	value: DeclarationContextAnalysisSnapshot,
	checkpoint: DeadlineCheckpoint
): string {
	const { contentDigest: _contentDigest, ...content } = value;
	return domainDigest('JAN-CSAA-DECLARATION-CONTEXT-ANALYSIS-CONTENT', content, checkpoint);
}

interface BoundContext {
	readonly configPath: string;
	readonly contextProgram: DeclarationContextAnalysisBuildInputs['projectContextGraph']['programs'][number];
	readonly contextProject: DeclarationContextAnalysisBuildInputs['projectContextGraph']['projects'][number];
	readonly semanticProgram: DeclarationContextAnalysisBuildInputs['semanticSnapshot']['programs'][number];
	readonly semanticProject: DeclarationContextAnalysisBuildInputs['semanticSnapshot']['projects'][number];
	readonly targetSource: DeclarationContextAnalysisBuildInputs['semanticSnapshot']['sources'][number];
}

function bindContext(
	inputs: DeclarationContextAnalysisBuildInputs,
	checkpoint: DeadlineCheckpoint
): BoundContext {
	const target = inputs.moduleResolutionTrace.targetWitness;
	const semanticPrograms = checkedFilter(
		inputs.semanticSnapshot.programs,
		(record) => sameText(record.id, target.semanticProgramId, checkpoint),
		checkpoint
	);
	const semanticProjects = checkedFilter(
		inputs.semanticSnapshot.projects,
		(record) => sameText(record.id, target.semanticProjectId, checkpoint),
		checkpoint
	);
	const targetSources = checkedFilter(
		inputs.semanticSnapshot.sources,
		(record) => sameText(record.id, target.semanticSourceId, checkpoint),
		checkpoint
	);
	if (semanticPrograms.length !== 1 || semanticProjects.length !== 1 || targetSources.length !== 1)
		failDerivation(
			'INPUT_INVALID',
			'The CAP-011 target must bind one exact semantic Program, project, and source.',
			'$inputs.moduleResolutionTrace.targetWitness'
		);
	const semanticProgram = semanticPrograms[0]!;
	const semanticProject = semanticProjects[0]!;
	const targetSource = targetSources[0]!;
	const contextPrograms = checkedFilter(
		inputs.projectContextGraph.programs,
		(record) => sameText(record.semanticProgramId, semanticProgram.id, checkpoint),
		checkpoint
	);
	const contextProjects = checkedFilter(
		inputs.projectContextGraph.projects,
		(record) => sameText(record.semanticProjectId, semanticProject.id, checkpoint),
		checkpoint
	);
	if (contextPrograms.length !== 1 || contextProjects.length !== 1)
		failDerivation(
			'INPUT_INVALID',
			'The selected semantic Program and project must bind one exact project context.',
			'$inputs.projectContextGraph'
		);
	const contextProgram = contextPrograms[0]!;
	const contextProject = contextProjects[0]!;
	const importer = inputs.moduleResolutionTrace.importerWitness;
	if (
		!sameText(semanticProgram.projectId, semanticProject.id, checkpoint) ||
		!sameText(semanticProject.programId, semanticProgram.id, checkpoint) ||
		!sameText(targetSource.programId, semanticProgram.id, checkpoint) ||
		!sameText(targetSource.projectId, semanticProject.id, checkpoint) ||
		!sameText(contextProgram.projectId, contextProject.id, checkpoint) ||
		!sameText(contextProject.programId, contextProgram.id, checkpoint) ||
		!sameText(contextProgram.semanticProjectId, semanticProject.id, checkpoint) ||
		!sameText(contextProject.semanticProgramId, semanticProgram.id, checkpoint) ||
		!sameText(contextProgram.id, importer.projectContextProgramId, checkpoint) ||
		!sameText(contextProject.id, importer.projectContextProjectId, checkpoint) ||
		!sameText(contextProject.configPath, semanticProject.configPath, checkpoint) ||
		!sameText(targetSource.logicalPath, target.logicalPath, checkpoint) ||
		targetSource.bytes !== target.bytes ||
		!sameText(targetSource.contentSha256, target.contentSha256, checkpoint) ||
		targetSource.analysisDisposition !== 'CONTEXT_ONLY' ||
		targetSource.artifactClass !== 'CONTEXT_ONLY' ||
		targetSource.origin !== 'WORKSPACE_BUILD_DECLARATION' ||
		!targetSource.declarationFile
	)
		failDerivation(
			'INPUT_INVALID',
			'The selected declaration target does not reconcile across CAP-001, CAP-010, and CAP-011.',
			'$inputs.moduleResolutionTrace.targetWitness'
		);
	return {
		configPath: semanticProject.configPath,
		contextProgram,
		contextProject,
		semanticProgram,
		semanticProject,
		targetSource
	};
}

function countAstNodes(
	root: ts.Node,
	maximum: number,
	label: string,
	visit: ((node: ts.Node) => void) | undefined,
	assertWithinDeadline: () => void
): number {
	const pending: ts.Node[] = [root];
	let count = 0;
	while (pending.length > 0) {
		assertWithinDeadline();
		const node = pending.pop()!;
		count += 1;
		if (count > maximum)
			failDerivation('BUDGET_EXHAUSTED', `${label} exceeded its AST node budget.`);
		visit?.(node);
		const children: ts.Node[] = [];
		ts.forEachChild(node, (child) => {
			assertWithinDeadline();
			if (pending.length + children.length >= maximum - count)
				failDerivation('BUDGET_EXHAUSTED', `${label} exceeded its AST node budget.`);
			children.push(child);
		});
		assertWithinDeadline();
		for (let index = children.length - 1; index >= 0; index -= 1) {
			assertWithinDeadline();
			pending.push(children[index]!);
		}
	}
	return count;
}

function sourceExtension(logicalPath: string): '.d.cts' | '.d.mts' | '.d.ts' {
	if (logicalPath.endsWith('.d.cts')) return '.d.cts';
	if (logicalPath.endsWith('.d.mts')) return '.d.mts';
	if (logicalPath.endsWith('.d.ts')) return '.d.ts';
	failDerivation(
		'INPUT_INVALID',
		'Every selected declaration artifact must use a supported declaration extension.'
	);
}

function symbolFlags(
	mask: number,
	checkpoint: DeadlineCheckpoint
): DeclarationContextSymbolFlagsBinding {
	if (!Number.isSafeInteger(mask) || mask < 0)
		failDerivation('INPUT_INVALID', 'TypeScript returned an invalid public SymbolFlags mask.');
	if (mask === 0) return { compilerVersion: ts.version, nativeMask: mask, nativeNames: ['None'] };
	const codes = new Set<number>();
	for (const value of Object.values(ts.SymbolFlags)) {
		checkpoint();
		if (
			typeof value === 'number' &&
			value > 0 &&
			(value & (value - 1)) === 0 &&
			(mask & value) === value
		)
			codes.add(value);
	}
	const codeValues: number[] = [];
	for (const code of codes) {
		checkpoint();
		codeValues.push(code);
	}
	const sortedCodes = checkedSort(codeValues, (left, right) => left - right, checkpoint);
	const nativeNames: string[] = [];
	let representedMask = 0;
	for (const code of sortedCodes) {
		checkpoint();
		representedMask += code;
		const name = ts.SymbolFlags[code];
		if (typeof name === 'string') nativeNames.push(name);
	}
	if (nativeNames.length !== codes.size || representedMask !== mask)
		failDerivation(
			'INPUT_INVALID',
			'TypeScript SymbolFlags cannot be represented by public single-bit names.'
		);
	return { compilerVersion: ts.version, nativeMask: mask, nativeNames };
}

function semanticSourceForFile(
	sourceByLogicalPath: ReadonlyMap<
		string,
		DeclarationContextAnalysisBuildInputs['semanticSnapshot']['sources'][number]
	>,
	logicalPath: string
): DeclarationContextAnalysisBuildInputs['semanticSnapshot']['sources'][number] {
	const source = sourceByLogicalPath.get(logicalPath);
	if (source === undefined)
		failDerivation(
			'INPUT_INVALID',
			'Fresh Program source must bind one exact CAP-001 semantic source.',
			'$inputs.semanticSnapshot.sources'
		);
	return source;
}

function acceptedArtifactSource(
	sourceByLogicalPath: ReadonlyMap<
		string,
		DeclarationContextAnalysisBuildInputs['semanticSnapshot']['sources'][number]
	>,
	logicalPath: string
): DeclarationContextAnalysisBuildInputs['semanticSnapshot']['sources'][number] {
	const source = semanticSourceForFile(sourceByLogicalPath, logicalPath);
	if (
		source.analysisDisposition !== 'CONTEXT_ONLY' ||
		source.artifactClass !== 'CONTEXT_ONLY' ||
		source.origin !== 'WORKSPACE_BUILD_DECLARATION' ||
		!source.declarationFile ||
		!['.d.ts', '.d.mts', '.d.cts'].some((extension) => source.logicalPath.endsWith(extension))
	)
		failDerivation(
			'INPUT_INVALID',
			'Every consumed declaration must belong to one context-only workspace build declaration.',
			'$inputs.semanticSnapshot.sources'
		);
	return source;
}

interface SupportedDeclarationShape {
	readonly kind: DeclarationContextDeclarationKind;
	readonly nameNode: ts.Identifier;
	readonly nativeName: string;
}

interface DeclarationCensusEntry {
	readonly end: number;
	readonly kind: DeclarationContextDeclarationKind;
	readonly logicalPath: string;
	readonly name: string;
	readonly nameEnd: number;
	readonly nameStart: number;
	readonly nativeKind: DeclarationContextDeclarationRecord['nativeKind'];
	readonly start: number;
}

interface RootExportSpecifierCensusEntry {
	readonly end: number;
	readonly exportedName: string;
	readonly exportedNameEnd: number;
	readonly exportedNameStart: number;
	readonly isTypeOnly: boolean;
	readonly localName: string;
	readonly logicalPath: string;
	readonly start: number;
}

function supportedDeclarationPlacement(
	declaration: ts.Declaration,
	sourceFile: ts.SourceFile
): boolean {
	if (ts.isVariableDeclaration(declaration))
		return (
			ts.isVariableDeclarationList(declaration.parent) &&
			ts.isVariableStatement(declaration.parent.parent) &&
			declaration.parent.parent.parent === sourceFile
		);
	return declaration.parent === sourceFile;
}

interface SupportedDeclarationKindBinding {
	readonly kind: DeclarationContextDeclarationKind;
	readonly nameNode: ts.Identifier | undefined;
}

function supportedDeclarationKind(declaration: ts.Declaration): SupportedDeclarationKindBinding {
	if (ts.isVariableDeclaration(declaration))
		return {
			kind: 'VARIABLE',
			nameNode: ts.isIdentifier(declaration.name) ? declaration.name : undefined
		};
	if (ts.isFunctionDeclaration(declaration))
		return { kind: 'FUNCTION', nameNode: declaration.name };
	if (ts.isClassDeclaration(declaration)) return { kind: 'CLASS', nameNode: declaration.name };
	if (ts.isInterfaceDeclaration(declaration))
		return { kind: 'INTERFACE', nameNode: declaration.name };
	if (ts.isTypeAliasDeclaration(declaration))
		return { kind: 'TYPE_ALIAS', nameNode: declaration.name };
	if (ts.isEnumDeclaration(declaration)) return { kind: 'ENUM', nameNode: declaration.name };
	if (ts.isModuleDeclaration(declaration)) {
		if (
			!ts.isIdentifier(declaration.name) ||
			(declaration.flags & ts.NodeFlags.GlobalAugmentation) !== 0
		)
			failDerivation(
				'INPUT_INVALID',
				'String-literal modules and global augmentation are unsupported in the selected declaration surface.'
			);
		return { kind: 'NAMESPACE', nameNode: declaration.name };
	}
	failDerivation(
		'INPUT_INVALID',
		'The terminal symbol contains a declaration kind outside the supported v1 profile.'
	);
}

function supportedDeclarationShape(
	declaration: ts.Declaration,
	sourceFile: ts.SourceFile,
	checkpoint: DeadlineCheckpoint
): SupportedDeclarationShape {
	if (!supportedDeclarationPlacement(declaration, sourceFile))
		failDerivation(
			'INPUT_INVALID',
			'Terminal declarations must use the supported top-level SourceFile placement.'
		);
	const { kind, nameNode } = supportedDeclarationKind(declaration);
	if (
		nameNode === undefined ||
		!isUnicodeScalarString(nameNode.text, checkpoint) ||
		nameNode.text.length === 0
	)
		failDerivation('INPUT_INVALID', 'Selected terminal declarations require identifier names.');
	const nativeName = ts.SyntaxKind[declaration.kind];
	if (typeof nativeName !== 'string')
		failDerivation(
			'INPUT_INVALID',
			'TypeScript declaration SyntaxKind lacks a public reverse name.'
		);
	return { kind, nameNode, nativeName };
}

function declarationCensusEntry(
	declaration: ts.Declaration,
	sourceFile: ts.SourceFile,
	logicalPath: string,
	checkpoint: DeadlineCheckpoint
): DeclarationCensusEntry {
	const { kind, nameNode, nativeName } = supportedDeclarationShape(
		declaration,
		sourceFile,
		checkpoint
	);
	const nameStart = nameNode.getStart(sourceFile);
	checkpoint();
	const start = declaration.getStart(sourceFile);
	checkpoint();
	return {
		end: declaration.end,
		kind,
		logicalPath,
		name: nameNode.text,
		nameEnd: nameNode.end,
		nameStart,
		nativeKind: {
			compilerVersion: ts.version,
			nativeCode: declaration.kind,
			nativeName
		},
		start
	};
}

function censusTopLevelTerminalDeclaration(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	logicalPath: string,
	terminalName: string,
	checkpoint: DeadlineCheckpoint
): DeclarationCensusEntry | null {
	const variable =
		ts.isVariableDeclaration(node) &&
		ts.isIdentifier(node.name) &&
		ts.isVariableDeclarationList(node.parent) &&
		ts.isVariableStatement(node.parent.parent) &&
		node.parent.parent.parent === sourceFile;
	const direct = node.parent === sourceFile;
	const directName = direct && 'name' in node ? (node as ts.NamedDeclaration).name : undefined;
	let nameNode: ts.Identifier | undefined;
	if (variable) nameNode = node.name;
	else if (directName !== undefined && ts.isIdentifier(directName)) nameNode = directName;
	if (nameNode === undefined || !sameText(nameNode.text, terminalName, checkpoint)) return null;
	const supported =
		ts.isClassDeclaration(node) ||
		ts.isEnumDeclaration(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		(ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) ||
		ts.isTypeAliasDeclaration(node) ||
		variable;
	if (!supported)
		failDerivation(
			'INPUT_INVALID',
			'An independently parsed top-level terminal-name binding has an unsupported declaration kind.'
		);
	return declarationCensusEntry(node as ts.Declaration, sourceFile, logicalPath, checkpoint);
}

function compareDeclarationCensus(
	left: DeclarationCensusEntry,
	right: DeclarationCensusEntry,
	checkpoint: DeadlineCheckpoint
): number {
	return (
		compareText(left.logicalPath, right.logicalPath, checkpoint) ||
		left.start - right.start ||
		left.end - right.end ||
		left.nativeKind.nativeCode - right.nativeKind.nativeCode ||
		compareText(left.name, right.name, checkpoint)
	);
}

function equalStringPopulation(
	left: readonly string[],
	right: readonly string[],
	checkpoint: DeadlineCheckpoint
): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		checkpoint();
		if (!sameText(left[index]!, right[index]!, checkpoint)) return false;
	}
	return true;
}

function equalDeclarationCensus(
	left: readonly DeclarationCensusEntry[],
	right: readonly DeclarationCensusEntry[],
	checkpoint: DeadlineCheckpoint
): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		checkpoint();
		const leftEntry = left[index]!;
		const rightEntry = right[index]!;
		if (
			leftEntry.end !== rightEntry.end ||
			leftEntry.kind !== rightEntry.kind ||
			!sameText(leftEntry.logicalPath, rightEntry.logicalPath, checkpoint) ||
			!sameText(leftEntry.name, rightEntry.name, checkpoint) ||
			leftEntry.nameEnd !== rightEntry.nameEnd ||
			leftEntry.nameStart !== rightEntry.nameStart ||
			!sameText(
				leftEntry.nativeKind.compilerVersion,
				rightEntry.nativeKind.compilerVersion,
				checkpoint
			) ||
			leftEntry.nativeKind.nativeCode !== rightEntry.nativeKind.nativeCode ||
			!sameText(leftEntry.nativeKind.nativeName, rightEntry.nativeKind.nativeName, checkpoint) ||
			leftEntry.start !== rightEntry.start
		)
			return false;
	}
	return true;
}

function rootExportSpecifierCensusEntry(
	declaration: ts.ExportSpecifier,
	sourceFile: ts.SourceFile,
	logicalPath: string,
	exportName: string,
	checkpoint: DeadlineCheckpoint
): RootExportSpecifierCensusEntry {
	if (
		!sameText(declaration.name.text, exportName, checkpoint) ||
		!ts.isNamedExports(declaration.parent) ||
		!ts.isExportDeclaration(declaration.parent.parent) ||
		declaration.parent.parent.moduleSpecifier !== undefined ||
		declaration.parent.parent.parent !== sourceFile
	)
		failDerivation(
			'INPUT_INVALID',
			'The selected root alias must be represented by one top-level ExportSpecifier.'
		);
	const localName = declaration.propertyName?.text ?? declaration.name.text;
	if (!isUnicodeScalarString(localName, checkpoint))
		failDerivation('INPUT_INVALID', 'The selected root alias has a non-scalar local name.');
	const exportedNameStart = declaration.name.getStart(sourceFile);
	checkpoint();
	const start = declaration.getStart(sourceFile);
	checkpoint();
	return {
		end: declaration.end,
		exportedName: declaration.name.text,
		exportedNameEnd: declaration.name.end,
		exportedNameStart,
		isTypeOnly: declaration.isTypeOnly,
		localName,
		logicalPath,
		start
	};
}

function compareRootExportSpecifierCensus(
	left: RootExportSpecifierCensusEntry,
	right: RootExportSpecifierCensusEntry,
	checkpoint: DeadlineCheckpoint
): number {
	return (
		compareText(left.logicalPath, right.logicalPath, checkpoint) ||
		left.start - right.start ||
		left.end - right.end ||
		compareText(left.localName, right.localName, checkpoint)
	);
}

function equalRootExportSpecifierCensus(
	left: readonly RootExportSpecifierCensusEntry[],
	right: readonly RootExportSpecifierCensusEntry[],
	checkpoint: DeadlineCheckpoint
): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		checkpoint();
		const leftEntry = left[index]!;
		const rightEntry = right[index]!;
		if (
			leftEntry.end !== rightEntry.end ||
			!sameText(leftEntry.exportedName, rightEntry.exportedName, checkpoint) ||
			leftEntry.exportedNameEnd !== rightEntry.exportedNameEnd ||
			leftEntry.exportedNameStart !== rightEntry.exportedNameStart ||
			leftEntry.isTypeOnly !== rightEntry.isTypeOnly ||
			!sameText(leftEntry.localName, rightEntry.localName, checkpoint) ||
			!sameText(leftEntry.logicalPath, rightEntry.logicalPath, checkpoint) ||
			leftEntry.start !== rightEntry.start
		)
			return false;
	}
	return true;
}

function refuseCollapsedTerminalNameBinding(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	terminalName: string,
	checkpoint: DeadlineCheckpoint
): void {
	let conflicts = false;
	if (ts.isImportSpecifier(node)) {
		conflicts =
			sameText(node.name.text, terminalName, checkpoint) &&
			ts.isNamedImports(node.parent) &&
			ts.isImportClause(node.parent.parent) &&
			ts.isImportDeclaration(node.parent.parent.parent) &&
			node.parent.parent.parent.parent === sourceFile;
	} else if (ts.isImportClause(node)) {
		conflicts =
			node.name !== undefined &&
			sameText(node.name.text, terminalName, checkpoint) &&
			ts.isImportDeclaration(node.parent) &&
			node.parent.parent === sourceFile;
	} else if (ts.isNamespaceImport(node)) {
		conflicts =
			sameText(node.name.text, terminalName, checkpoint) &&
			ts.isImportClause(node.parent) &&
			ts.isImportDeclaration(node.parent.parent) &&
			node.parent.parent.parent === sourceFile;
	} else if (ts.isImportEqualsDeclaration(node)) {
		conflicts = sameText(node.name.text, terminalName, checkpoint) && node.parent === sourceFile;
	} else if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
		let ancestor: ts.Node | undefined = node.parent;
		while (
			ancestor !== undefined &&
			ancestor !== sourceFile &&
			!ts.isVariableDeclaration(ancestor)
		) {
			checkpoint();
			ancestor = ancestor.parent;
		}
		conflicts =
			sameText(node.name.text, terminalName, checkpoint) &&
			ancestor !== undefined &&
			ts.isVariableDeclaration(ancestor) &&
			ts.isVariableDeclarationList(ancestor.parent) &&
			ts.isVariableStatement(ancestor.parent.parent) &&
			ancestor.parent.parent.parent === sourceFile;
	}
	if (conflicts)
		failDerivation(
			'INPUT_INVALID',
			'An independently parsed top-level binding collides with the terminal symbol name.'
		);
}

function supportedDeclaration(
	declaration: ts.Declaration,
	sourceFile: ts.SourceFile,
	artifactId: DeclarationContextArtifactId,
	parseWitnessId: DeclarationContextParseWitnessId,
	ordinal: number,
	checkpoint: DeadlineCheckpoint
): Omit<DeclarationContextDeclarationRecord, 'id'> {
	const { kind, nameNode, nativeName } = supportedDeclarationShape(
		declaration,
		sourceFile,
		checkpoint
	);
	const nameStart = nameNode.getStart(sourceFile);
	checkpoint();
	const start = declaration.getStart(sourceFile);
	checkpoint();
	return {
		ambientContext: 'DECLARATION_FILE',
		artifactId,
		end: declaration.end,
		kind,
		name: nameNode.text,
		nameEnd: nameNode.end,
		nameStart,
		nativeKind: {
			compilerVersion: ts.version,
			nativeCode: declaration.kind,
			nativeName
		},
		ordinal,
		parseWitnessId,
		role: 'SELECTED_TERMINAL_SYMBOL_DECLARATION',
		start
	};
}

interface ArtifactSeed {
	readonly roles: Set<DeclarationContextArtifactRole>;
	readonly source: DeclarationContextAnalysisBuildInputs['semanticSnapshot']['sources'][number];
	readonly sourceFile: ts.SourceFile;
}

interface AliasHopSeed {
	readonly aliasName: string;
	readonly aliasSourceIds: readonly string[];
	readonly aliasSymbolFlags: DeclarationContextSymbolFlagsBinding;
	readonly ordinal: number;
	readonly targetName: string;
}

interface DeriveValid {
	readonly graph: DeclarationContextAnalysisSnapshot;
	readonly state: 'VALID';
}

interface DeriveInvalid {
	readonly problem: DeclarationContextAnalysisValidationIssue;
	readonly state: 'INVALID';
}

type DeriveResult = DeriveValid | DeriveInvalid;

type DeriveSemanticSource =
	DeclarationContextAnalysisBuildInputs['semanticSnapshot']['sources'][number];

type DeriveProjectContextSource =
	DeclarationContextAnalysisBuildInputs['projectContextGraph']['sources'][number];

type CaptureEvidence = ReturnType<CompilerProjectProgramSession['finalize']>;

type CaptureInputRecord = CaptureEvidence['inputRecords'][number];

type ProgramEvidenceRecord = CaptureInputRecord & {
	readonly stage: 'CALLER_ANALYSIS' | 'PROGRAM_CONSTRUCTION' | 'TYPE_CHECKER_CREATE';
};

type ParsedCapturedSource = ReturnType<CompilerProjectProgramSession['parseCapturedSourceFile']>;

interface DeriveDeadline {
	readonly assertWithinDeadline: DeadlineCheckpoint;
	readonly durationLimit: number;
	readonly operationElapsed: () => number;
}

interface DeriveTraversalCharge {
	readonly charge: (amount: number) => void;
	readonly total: () => number;
}

interface DeriveContext {
	readonly analysisId: DeclarationContextAnalysisId;
	readonly assertWithinDeadline: DeadlineCheckpoint;
	readonly bound: BoundContext;
	readonly chargeTraversal: (amount: number) => void;
	readonly inputs: DeclarationContextAnalysisBuildInputs;
	readonly provider: Readonly<DeclarationContextAnalysisValidationProvider>;
	readonly session: CompilerProjectProgramSession;
	readonly traversalTotal: () => number;
}

function deriveFailureResult(error: unknown): DeriveResult {
	if (error instanceof DerivationFailure) return { problem: error.problem, state: 'INVALID' };
	if (error instanceof CompilerProjectProgramCapabilityError)
		return {
			problem: issue(
				error.code === 'BUDGET_EXCEEDED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
				'Fresh captured TypeScript Program reconstruction failed closed.',
				'$inputs.semanticSnapshot'
			),
			state: 'INVALID'
		};
	return {
		problem: issue(
			'INPUT_INVALID',
			'Declaration-context inputs could not be independently replayed.',
			'$inputs'
		),
		state: 'INVALID'
	};
}

function createDeriveDeadline(
	inputs: DeclarationContextAnalysisBuildInputs,
	maxDurationMs: number,
	provider: Readonly<DeclarationContextAnalysisValidationProvider>
): DeriveDeadline {
	const monotonicStartedAt = provider.monotonicNow();
	if (!Number.isFinite(monotonicStartedAt) || monotonicStartedAt < 0)
		failDerivation('INPUT_INVALID', 'The validation operation clock is unavailable.');
	const durationLimit = Math.min(inputs.request.budgets.maxDurationMs, maxDurationMs);
	let lastMonotonic = monotonicStartedAt;
	const operationElapsed = (): number => {
		const observed = provider.monotonicNow();
		if (!Number.isFinite(observed) || observed < lastMonotonic || observed < monotonicStartedAt)
			failDerivation('INPUT_INVALID', 'The validation monotonic clock failed closed.');
		lastMonotonic = observed;
		const elapsed = Math.floor(observed - monotonicStartedAt);
		if (!safeNonnegative(elapsed))
			failDerivation('INPUT_INVALID', 'The validation monotonic elapsed time is invalid.');
		return elapsed;
	};
	const assertWithinDeadline = (): void => {
		if (operationElapsed() > durationLimit)
			failDerivation('BUDGET_EXHAUSTED', 'Declaration-context wall-clock budget was exhausted.');
	};
	return { assertWithinDeadline, durationLimit, operationElapsed };
}

function createDeriveTraversalCharge(
	inputs: DeclarationContextAnalysisBuildInputs
): DeriveTraversalCharge {
	let progressiveTraversalSteps = 0;
	return {
		charge: (amount: number): void => {
			if (amount > inputs.request.budgets.maxTraversalSteps - progressiveTraversalSteps)
				failDerivation('BUDGET_EXHAUSTED', 'Declaration-context traversal budget was exhausted.');
			progressiveTraversalSteps += amount;
		},
		total: (): number => progressiveTraversalSteps
	};
}

function assertKnownInputDigestReproduces(
	inputDigest: string,
	knownInputDigest: string | undefined,
	checkpoint: DeadlineCheckpoint
): void {
	if (knownInputDigest !== undefined && !sameText(inputDigest, knownInputDigest, checkpoint))
		failDerivation(
			'IDENTITY_MISMATCH',
			'The trusted producer input digest does not reproduce independently.',
			'$knownInputDigest'
		);
}

function assertProviderRuntimeVersion(inputs: DeclarationContextAnalysisBuildInputs): void {
	if (
		ts.version !== TYPESCRIPT_PROVIDER_VERSION ||
		inputs.semanticSnapshot.provider.version !== ts.version
	)
		failDerivation(
			'INPUT_INVALID',
			'The TypeScript runtime does not match the validated CAP-001 provider version.'
		);
}

function openDeriveSession(
	inputs: DeclarationContextAnalysisBuildInputs,
	provider: Readonly<DeclarationContextAnalysisValidationProvider>,
	bound: BoundContext,
	deadline: DeriveDeadline,
	chargeTraversal: (amount: number) => void
): CompilerProjectProgramSession {
	const remainingDurationMs = deadline.durationLimit - deadline.operationElapsed();
	if (remainingDurationMs <= 0)
		failDerivation('BUDGET_EXHAUSTED', 'Declaration-context wall-clock budget was exhausted.');
	return provider.createSession(
		inputs.semanticSnapshot,
		bound.configPath,
		{
			maxDurationMs: remainingDurationMs,
			maxProgramInputRecords: inputs.request.budgets.maxCompilerInputAttempts,
			maxProgramReadBytes: inputs.request.budgets.maxProgramReadBytes,
			maxProgramSourceFiles: inputs.request.budgets.maxProgramSourceFiles,
			maxTotalInputRecords: inputs.request.budgets.maxInputRecords,
			maxTotalReadBytes: inputs.request.budgets.maxReadBytes
		},
		{
			onInput() {
				try {
					chargeTraversal(1);
				} catch (error) {
					if (error instanceof DerivationFailure && error.problem.code === 'BUDGET_EXHAUSTED')
						throw new CompilerProjectProgramCapabilityError(
							'BUDGET_EXCEEDED',
							error.problem.message
						);
					throw error;
				}
			}
		}
	);
}

function assertSessionSemanticBinding(context: DeriveContext): void {
	const { assertWithinDeadline, bound, inputs, provider, session } = context;
	const sessionIdentity = provider.sessionIdentity(session);
	assertWithinDeadline();
	if (
		!sameText(sessionIdentity.semanticProgramId, bound.semanticProgram.id, assertWithinDeadline) ||
		!sameText(sessionIdentity.semanticProjectId, bound.semanticProject.id, assertWithinDeadline) ||
		!sameText(sessionIdentity.configPath, bound.configPath, assertWithinDeadline)
	)
		failDerivation(
			'INPUT_INVALID',
			'The fresh captured Program does not bind the selected semantic context.'
		);
	if (bound.semanticProgram.sourceIds.length > inputs.request.budgets.maxProgramSourceFiles)
		failDerivation(
			'BUDGET_EXHAUSTED',
			'The selected semantic Program source population exceeds its budget.'
		);
}

function buildSemanticSourcePopulation(
	context: DeriveContext
): ReadonlyMap<string, DeriveSemanticSource> {
	const { assertWithinDeadline, bound, inputs } = context;
	const selectedSemanticSources = checkedFilter(
		inputs.semanticSnapshot.sources,
		(source) => sameText(source.programId, bound.semanticProgram.id, assertWithinDeadline),
		assertWithinDeadline
	);
	const semanticSourceByLogicalPath = new Map<string, DeriveSemanticSource>();
	const semanticSourceIdPopulation = new Set<string>();
	for (const sourceId of bound.semanticProgram.sourceIds) {
		assertWithinDeadline();
		semanticSourceIdPopulation.add(sourceId);
	}
	for (const source of selectedSemanticSources) {
		assertWithinDeadline();
		if (
			semanticSourceByLogicalPath.has(source.logicalPath) ||
			!semanticSourceIdPopulation.has(source.id) ||
			!sameText(source.projectId, bound.semanticProject.id, assertWithinDeadline)
		)
			failDerivation(
				'INPUT_INVALID',
				'The selected semantic Program source population is not exact.'
			);
		semanticSourceByLogicalPath.set(source.logicalPath, source);
	}
	if (
		selectedSemanticSources.length !== bound.semanticProgram.sourceIds.length ||
		semanticSourceIdPopulation.size !== selectedSemanticSources.length
	)
		failDerivation(
			'INPUT_INVALID',
			'The selected semantic Program source population is not closed.'
		);
	return semanticSourceByLogicalPath;
}

interface FreshProgramFile {
	readonly logicalPath: string;
	readonly sourceFile: ts.SourceFile;
}

interface FreshProgramScan {
	readonly programFiles: readonly FreshProgramFile[];
	readonly programParsedAstNodes: number;
	readonly programSourceIdentities: readonly DeclarationContextProgramSourceIdentity[];
	readonly programSourcesByLogicalPath: ReadonlyMap<string, ts.SourceFile>;
	readonly semanticSourceIds: ReadonlySet<string>;
}

function scanFreshProgramSources(
	context: DeriveContext,
	semanticSourceByLogicalPath: ReadonlyMap<string, DeriveSemanticSource>
): FreshProgramScan {
	const { assertWithinDeadline, chargeTraversal, inputs, provider, session } = context;
	const programSourceFiles = provider.programSourceFiles(session);
	assertWithinDeadline();
	if (programSourceFiles.length > inputs.request.budgets.maxProgramSourceFiles)
		failDerivation('BUDGET_EXHAUSTED', 'Fresh Program source population exceeds its budget.');
	const programFiles = checkedSort(
		checkedMap(
			programSourceFiles,
			(sourceFile) => ({
				logicalPath: session.toLogicalPath(sourceFile.fileName),
				sourceFile
			}),
			assertWithinDeadline
		),
		(left, right) =>
			compareText(left.logicalPath, right.logicalPath, assertWithinDeadline) ||
			compareText(left.sourceFile.fileName, right.sourceFile.fileName, assertWithinDeadline),
		assertWithinDeadline
	);
	assertWithinDeadline();
	chargeTraversal(programFiles.length);
	let programParsedAstNodes = 0;
	const programSourceIdentities: DeclarationContextProgramSourceIdentity[] = [];
	const programSourcesByLogicalPath = new Map<string, ts.SourceFile>();
	const semanticSourceIds = new Set<string>();
	for (const entry of programFiles) {
		assertWithinDeadline();
		if (programSourcesByLogicalPath.has(entry.logicalPath))
			failDerivation('INPUT_INVALID', 'Fresh Program repeats a canonical logical source path.');
		programSourcesByLogicalPath.set(entry.logicalPath, entry.sourceFile);
		programParsedAstNodes = safeAdd(
			programParsedAstNodes,
			countAstNodes(
				entry.sourceFile,
				inputs.request.budgets.maxProgramAstNodes - programParsedAstNodes,
				'Fresh Program',
				() => chargeTraversal(1),
				assertWithinDeadline
			),
			'Fresh Program AST node population'
		);
		const semanticSource = semanticSourceForFile(semanticSourceByLogicalPath, entry.logicalPath);
		if (
			semanticSourceIds.has(semanticSource.id) ||
			entry.sourceFile.text.length !== semanticSource.textLength ||
			entry.sourceFile.isDeclarationFile !== semanticSource.declarationFile
		)
			failDerivation(
				'INPUT_INVALID',
				'Fresh Program source text or declaration classification differs from CAP-001.'
			);
		semanticSourceIds.add(semanticSource.id);
		programSourceIdentities.push({
			bytes: semanticSource.bytes,
			contentSha256: semanticSource.contentSha256,
			declarationFile: semanticSource.declarationFile,
			logicalPath: semanticSource.logicalPath,
			origin: semanticSource.origin,
			semanticSourceId: semanticSource.id
		});
	}
	return {
		programFiles,
		programParsedAstNodes,
		programSourceIdentities,
		programSourcesByLogicalPath,
		semanticSourceIds
	};
}

function bindProjectContextSources(context: DeriveContext): DeriveProjectContextSource[] {
	const { assertWithinDeadline, bound, inputs } = context;
	const selectedContextSources = checkedFilter(
		inputs.projectContextGraph.sources,
		(source) => sameText(source.programId, bound.contextProgram.id, assertWithinDeadline),
		assertWithinDeadline
	);
	const contextSourceById = new Map<string, DeriveProjectContextSource>();
	for (const source of selectedContextSources) {
		assertWithinDeadline();
		contextSourceById.set(source.id, source);
	}
	if (bound.contextProgram.sourceIds.length > inputs.request.budgets.maxProgramSourceFiles)
		failDerivation(
			'BUDGET_EXHAUSTED',
			'The selected project-context Program source population exceeds its budget.'
		);
	const contextProgramSourceIds = new Set<string>();
	for (const sourceId of bound.contextProgram.sourceIds) {
		assertWithinDeadline();
		contextProgramSourceIds.add(sourceId);
	}
	if (
		selectedContextSources.length !== bound.contextProgram.sourceIds.length ||
		contextSourceById.size !== selectedContextSources.length ||
		contextProgramSourceIds.size !== selectedContextSources.length
	)
		failDerivation(
			'INPUT_INVALID',
			'The selected project-context Program has an invalid source population.'
		);
	const contextSources: DeriveProjectContextSource[] = [];
	for (const sourceId of bound.contextProgram.sourceIds) {
		assertWithinDeadline();
		const source = contextSourceById.get(sourceId);
		if (source === undefined)
			failDerivation(
				'INPUT_INVALID',
				'The selected project-context Program has an invalid source population.'
			);
		contextSources.push(source);
	}
	return contextSources;
}

function assertContextSourceReconciliation(
	context: DeriveContext,
	contextSources: readonly DeriveProjectContextSource[],
	programScan: FreshProgramScan
): void {
	const { assertWithinDeadline, bound } = context;
	const { programFiles, programSourcesByLogicalPath, semanticSourceIds } = programScan;
	let contextPopulationMismatch = contextSources.length !== programFiles.length;
	for (const source of contextSources) {
		assertWithinDeadline();
		if (
			!semanticSourceIds.has(source.semanticSourceId) ||
			programSourcesByLogicalPath.get(source.logicalPath) === undefined ||
			!sameText(source.semanticProgramId, bound.semanticProgram.id, assertWithinDeadline) ||
			!sameText(source.semanticProjectId, bound.semanticProject.id, assertWithinDeadline)
		)
			contextPopulationMismatch = true;
	}
	if (contextPopulationMismatch)
		failDerivation(
			'INPUT_INVALID',
			'Fresh Program sources do not exactly reconcile with the CAP-010 Program population.'
		);
}

interface SelectedRootExportBinding {
	readonly exportSymbols: readonly ts.Symbol[];
	readonly rootExportSymbol: ts.Symbol;
	readonly rootSourceFile: ts.SourceFile;
}

function bindSelectedRootExport(
	context: DeriveContext,
	programScan: FreshProgramScan
): SelectedRootExportBinding {
	const { assertWithinDeadline, bound, chargeTraversal, inputs, provider, session } = context;
	const { programSourcesByLogicalPath } = programScan;
	const rootSourceFile = programSourcesByLogicalPath.get(bound.targetSource.logicalPath);
	const rootExternalModule =
		rootSourceFile === undefined ? false : provider.isExternalModule(rootSourceFile);
	assertWithinDeadline();
	if (rootSourceFile === undefined || !rootSourceFile.isDeclarationFile || !rootExternalModule)
		failDerivation(
			'INPUT_INVALID',
			'The CAP-011 selected target must be an external declaration module in the fresh Program.'
		);
	const moduleSymbol = provider.getSymbolAtLocation(session, rootSourceFile);
	assertWithinDeadline();
	if (moduleSymbol === undefined)
		failDerivation(
			'INPUT_INVALID',
			'The selected declaration root has no public checker module symbol.'
		);
	const exportSymbols = provider.getExportsOfModule(session, moduleSymbol);
	assertWithinDeadline();
	if (exportSymbols.length > inputs.request.budgets.maxExportSymbols)
		failDerivation('BUDGET_EXHAUSTED', 'Package-root export symbol budget was exhausted.');
	chargeTraversal(exportSymbols.length);
	const matchingExports: ts.Symbol[] = [];
	for (const symbol of exportSymbols) {
		assertWithinDeadline();
		const name = provider.symbolName(symbol);
		assertWithinDeadline();
		if (!isUnicodeScalarString(name, assertWithinDeadline))
			failDerivation('INPUT_INVALID', 'TypeScript returned a non-scalar public export name.');
		if (sameText(name, inputs.request.exportName, assertWithinDeadline))
			matchingExports.push(symbol);
	}
	if (matchingExports.length !== 1)
		failDerivation(
			'INPUT_INVALID',
			'The exact requested package-root export must occur exactly once.',
			'$inputs.request.exportName'
		);
	return { exportSymbols, rootExportSymbol: matchingExports[0]!, rootSourceFile };
}

interface ArtifactSeedCollector {
	readonly add: (sourceFile: ts.SourceFile, role: DeclarationContextArtifactRole) => ArtifactSeed;
	readonly seeds: ReadonlyMap<string, ArtifactSeed>;
}

function createArtifactSeedCollector(
	context: DeriveContext,
	semanticSourceByLogicalPath: ReadonlyMap<string, DeriveSemanticSource>
): ArtifactSeedCollector {
	const { assertWithinDeadline, inputs, session } = context;
	const artifactSeeds = new Map<string, ArtifactSeed>();
	const add = (sourceFile: ts.SourceFile, role: DeclarationContextArtifactRole): ArtifactSeed => {
		const logicalPath = session.toLogicalPath(sourceFile.fileName);
		const source = acceptedArtifactSource(semanticSourceByLogicalPath, logicalPath);
		let seed = artifactSeeds.get(source.id);
		if (seed === undefined) {
			if (artifactSeeds.size >= inputs.request.budgets.maxArtifacts)
				failDerivation('BUDGET_EXHAUSTED', 'Declaration artifact budget was exhausted.');
			seed = { roles: new Set<DeclarationContextArtifactRole>(), source, sourceFile };
			artifactSeeds.set(source.id, seed);
		} else if (
			seed.sourceFile !== sourceFile ||
			!sameText(seed.source.logicalPath, logicalPath, assertWithinDeadline)
		) {
			failDerivation(
				'INPUT_INVALID',
				'One semantic artifact maps to inconsistent Program sources.'
			);
		}
		seed.roles.add(role);
		return seed;
	};
	return { add, seeds: artifactSeeds };
}

function assertAliasHopAdmissible(context: DeriveContext, hopCount: number): void {
	if (hopCount !== 0)
		failDerivation(
			'INPUT_INVALID',
			'Multi-hop selected export aliases are outside the supported v1 boundary.'
		);
	if (hopCount >= context.inputs.request.budgets.maxAliasHops)
		failDerivation('BUDGET_EXHAUSTED', 'Alias-hop budget was exhausted before resolution.');
}

function aliasHopDeclarations(
	context: DeriveContext,
	aliasSymbol: ts.Symbol
): readonly ts.Declaration[] {
	const aliasDeclarations = context.provider.getDeclarations(aliasSymbol);
	context.assertWithinDeadline();
	if (aliasDeclarations?.length !== 1)
		failDerivation(
			'INPUT_INVALID',
			'Every traversed alias symbol must have exactly one public declaration.'
		);
	return aliasDeclarations;
}

function selectedRootAliasDeclaration(
	aliasDeclarations: readonly ts.Declaration[]
): ts.ExportSpecifier {
	const rootAliasDeclaration = aliasDeclarations[0]!;
	if (!ts.isExportSpecifier(rootAliasDeclaration))
		failDerivation(
			'INPUT_INVALID',
			'The selected root alias must be represented by one top-level ExportSpecifier.'
		);
	return rootAliasDeclaration;
}

function aliasHopArtifactSourceIds(
	context: DeriveContext,
	aliasDeclarations: readonly ts.Declaration[],
	addArtifact: ArtifactSeedCollector['add']
): ReadonlySet<string> {
	const aliasSourceIds = new Set<string>();
	for (const declaration of aliasDeclarations) {
		context.assertWithinDeadline();
		const declarationSourceFile = declaration.getSourceFile();
		context.assertWithinDeadline();
		const seed = addArtifact(declarationSourceFile, 'ALIAS_DECLARATION_CONTAINER');
		aliasSourceIds.add(seed.source.id);
	}
	return aliasSourceIds;
}

function aliasHopTargetSymbol(
	context: DeriveContext,
	aliasSymbol: ts.Symbol,
	visitedSymbols: Set<ts.Symbol>
): ts.Symbol {
	const targetSymbol = context.provider.getAliasedSymbol(context.session, aliasSymbol);
	context.assertWithinDeadline();
	if (visitedSymbols.has(targetSymbol))
		failDerivation('INPUT_INVALID', 'Selected checker alias traversal is cyclic.');
	visitedSymbols.add(targetSymbol);
	return targetSymbol;
}

interface AliasHopNames {
	readonly aliasName: string;
	readonly targetName: string;
}

function aliasHopNames(
	context: DeriveContext,
	aliasSymbol: ts.Symbol,
	targetSymbol: ts.Symbol
): AliasHopNames {
	const { assertWithinDeadline, provider } = context;
	const aliasName = provider.symbolName(aliasSymbol);
	assertWithinDeadline();
	const targetName = provider.symbolName(targetSymbol);
	assertWithinDeadline();
	if (
		!isUnicodeScalarString(aliasName, assertWithinDeadline) ||
		!isUnicodeScalarString(targetName, assertWithinDeadline)
	)
		failDerivation('INPUT_INVALID', 'Alias traversal produced non-scalar symbol names.');
	return { aliasName, targetName };
}

function orderedAliasSourceIds(
	context: DeriveContext,
	aliasSourceIds: ReadonlySet<string>
): string[] {
	const aliasDeclarationSourceIds: string[] = [];
	for (const sourceId of aliasSourceIds) {
		context.assertWithinDeadline();
		aliasDeclarationSourceIds.push(sourceId);
	}
	return aliasDeclarationSourceIds;
}

interface AliasTraversal {
	readonly aliasHopSeeds: readonly AliasHopSeed[];
	readonly checkerRootAliasDeclaration: ts.ExportSpecifier | null;
	readonly checkerRootExportSpecifierCensus: readonly RootExportSpecifierCensusEntry[];
	readonly terminalSymbol: ts.Symbol;
}

function traverseSelectedExportAliases(
	context: DeriveContext,
	rootExportSymbol: ts.Symbol,
	rootSourceFile: ts.SourceFile,
	addArtifact: ArtifactSeedCollector['add']
): AliasTraversal {
	const { assertWithinDeadline, bound, chargeTraversal, inputs, provider } = context;
	const aliasHopSeeds: AliasHopSeed[] = [];
	const checkerRootExportSpecifierCensus: RootExportSpecifierCensusEntry[] = [];
	let checkerRootAliasDeclaration: ts.ExportSpecifier | null = null;
	const visitedSymbols = new Set<ts.Symbol>([rootExportSymbol]);
	let terminalSymbol = rootExportSymbol;
	while (true) {
		const aliasSymbol = provider.isAliasSymbol(terminalSymbol);
		assertWithinDeadline();
		if (!aliasSymbol) break;
		assertAliasHopAdmissible(context, aliasHopSeeds.length);
		chargeTraversal(1);
		const aliasDeclarations = aliasHopDeclarations(context, terminalSymbol);
		if (terminalSymbol === rootExportSymbol) {
			const rootAliasDeclaration = selectedRootAliasDeclaration(aliasDeclarations);
			checkerRootAliasDeclaration = rootAliasDeclaration;
			checkerRootExportSpecifierCensus.push(
				rootExportSpecifierCensusEntry(
					rootAliasDeclaration,
					rootSourceFile,
					bound.targetSource.logicalPath,
					inputs.request.exportName,
					assertWithinDeadline
				)
			);
		}
		const aliasSourceIds = aliasHopArtifactSourceIds(context, aliasDeclarations, addArtifact);
		const targetSymbol = aliasHopTargetSymbol(context, terminalSymbol, visitedSymbols);
		const { aliasName, targetName } = aliasHopNames(context, terminalSymbol, targetSymbol);
		const aliasDeclarationSourceIds = orderedAliasSourceIds(context, aliasSourceIds);
		const aliasSymbolFlagsMask = provider.symbolFlags(terminalSymbol);
		assertWithinDeadline();
		aliasHopSeeds.push({
			aliasName,
			aliasSourceIds: aliasDeclarationSourceIds,
			aliasSymbolFlags: symbolFlags(aliasSymbolFlagsMask, assertWithinDeadline),
			ordinal: aliasHopSeeds.length,
			targetName
		});
		terminalSymbol = targetSymbol;
	}
	return {
		aliasHopSeeds,
		checkerRootAliasDeclaration,
		checkerRootExportSpecifierCensus,
		terminalSymbol
	};
}

function resolveTerminalSymbolName(
	context: DeriveContext,
	terminalSymbol: ts.Symbol,
	checkerRootAliasDeclaration: ts.ExportSpecifier | null
): string {
	const { assertWithinDeadline, provider } = context;
	const terminalName = provider.symbolName(terminalSymbol);
	assertWithinDeadline();
	if (terminalName.length === 0 || !isUnicodeScalarString(terminalName, assertWithinDeadline))
		failDerivation('INPUT_INVALID', 'The terminal checker symbol lacks a supported public name.');
	if (
		checkerRootAliasDeclaration !== null &&
		(checkerRootAliasDeclaration.propertyName === undefined ||
			!sameText(checkerRootAliasDeclaration.propertyName.text, terminalName, assertWithinDeadline))
	)
		failDerivation(
			'INPUT_INVALID',
			'The selected root ExportSpecifier must name the terminal symbol directly without local indirection.'
		);
	return terminalName;
}

function resolveTerminalDeclarations(
	context: DeriveContext,
	terminalSymbol: ts.Symbol
): readonly ts.Declaration[] {
	const { assertWithinDeadline, chargeTraversal, inputs, provider } = context;
	const terminalDeclarations = provider.getDeclarations(terminalSymbol);
	assertWithinDeadline();
	if (terminalDeclarations === undefined || terminalDeclarations.length === 0)
		failDerivation('INPUT_INVALID', 'Terminal checker symbol lacks public declarations.');
	if (terminalDeclarations.length > inputs.request.budgets.maxDeclarations)
		failDerivation('BUDGET_EXHAUSTED', 'Terminal declaration budget was exhausted.');
	const terminalDeclarationReferences = new Set<ts.Declaration>();
	for (const declaration of terminalDeclarations) {
		assertWithinDeadline();
		if (terminalDeclarationReferences.has(declaration))
			failDerivation('INPUT_INVALID', 'Terminal checker declarations repeat a reference identity.');
		terminalDeclarationReferences.add(declaration);
	}
	chargeTraversal(terminalDeclarations.length);
	return terminalDeclarations;
}

function bindTerminalArtifactSource(
	context: DeriveContext,
	terminalDeclarations: readonly ts.Declaration[],
	addArtifact: ArtifactSeedCollector['add']
): string | null {
	const { assertWithinDeadline, bound } = context;
	let terminalArtifactSourceId: string | null = null;
	for (const declaration of terminalDeclarations) {
		assertWithinDeadline();
		const declarationSourceFile = declaration.getSourceFile();
		assertWithinDeadline();
		const seed = addArtifact(declarationSourceFile, 'TERMINAL_DECLARATION_CONTAINER');
		if (terminalArtifactSourceId === null) terminalArtifactSourceId = seed.source.id;
		else if (!sameText(terminalArtifactSourceId, seed.source.id, assertWithinDeadline))
			failDerivation(
				'INPUT_INVALID',
				'Cross-file terminal declaration merging is outside the supported v1 boundary.'
			);
	}
	if (
		terminalArtifactSourceId === null ||
		!sameText(terminalArtifactSourceId, bound.targetSource.id, assertWithinDeadline)
	)
		failDerivation(
			'INPUT_INVALID',
			'The supported terminal symbol must be declared in the CAP-011 root declaration artifact.'
		);
	return terminalArtifactSourceId;
}

function buildCheckerTerminalCensus(
	context: DeriveContext,
	terminalDeclarations: readonly ts.Declaration[],
	terminalName: string
): DeclarationCensusEntry[] {
	const { assertWithinDeadline, session } = context;
	const checkerTerminalCensus = checkedSort(
		checkedMap(
			terminalDeclarations,
			(declaration) => {
				const declarationSourceFile = declaration.getSourceFile();
				assertWithinDeadline();
				return declarationCensusEntry(
					declaration,
					declarationSourceFile,
					session.toLogicalPath(declarationSourceFile.fileName),
					assertWithinDeadline
				);
			},
			assertWithinDeadline
		),
		(left, right) => compareDeclarationCensus(left, right, assertWithinDeadline),
		assertWithinDeadline
	);
	let checkerTerminalNameMismatch = false;
	for (const declaration of checkerTerminalCensus) {
		assertWithinDeadline();
		if (!sameText(declaration.name, terminalName, assertWithinDeadline))
			checkerTerminalNameMismatch = true;
	}
	if (checkerTerminalNameMismatch)
		failDerivation(
			'INPUT_INVALID',
			'Terminal declaration names do not reproduce the checker symbol name.'
		);
	return checkerTerminalCensus;
}

function orderArtifactSeeds(
	context: DeriveContext,
	artifactSeeds: ReadonlyMap<string, ArtifactSeed>
): ArtifactSeed[] {
	const { assertWithinDeadline } = context;
	const unorderedArtifactSeeds: ArtifactSeed[] = [];
	for (const seed of artifactSeeds.values()) {
		assertWithinDeadline();
		unorderedArtifactSeeds.push(seed);
	}
	return checkedSort(
		unorderedArtifactSeeds,
		(left, right) =>
			compareText(left.source.logicalPath, right.source.logicalPath, assertWithinDeadline) ||
			compareText(left.source.id, right.source.id, assertWithinDeadline),
		assertWithinDeadline
	);
}

interface FreshProgramLanguage {
	readonly compilerOptionsDigest: string;
	readonly languageVersionCode: ts.ScriptTarget;
	readonly languageVersionName: string;
}

function assertFreshProgramCompilerOptions(context: DeriveContext): FreshProgramLanguage {
	const { assertWithinDeadline, inputs, provider, session } = context;
	const compilerOptions = provider.compilerOptions(session);
	const compilerOptionsDigest = canonicalSha256(compilerOptions, assertWithinDeadline);
	if (
		!sameText(
			compilerOptionsDigest,
			inputs.moduleResolutionTrace.resolverEnvironment.compilerOptionsDigest,
			assertWithinDeadline
		)
	)
		failDerivation(
			'INPUT_INVALID',
			'Fresh Program compiler options do not reproduce the CAP-011 compiler-options digest.'
		);
	const languageVersionCode = compilerOptions.target ?? ts.ScriptTarget.Latest;
	const languageVersionName = ts.ScriptTarget[languageVersionCode];
	if (typeof languageVersionName !== 'string')
		failDerivation('INPUT_INVALID', 'Program ScriptTarget lacks a public reverse enum name.');
	return { compilerOptionsDigest, languageVersionCode, languageVersionName };
}

function assertSelectedArtifactDiagnostics(
	context: DeriveContext,
	orderedArtifactSeeds: readonly ArtifactSeed[]
): void {
	const { assertWithinDeadline, inputs, provider, session } = context;
	let diagnosticCount = 0;
	for (const artifact of orderedArtifactSeeds) {
		assertWithinDeadline();
		const syntacticDiagnostics = provider.syntacticDiagnostics(session, artifact.sourceFile);
		assertWithinDeadline();
		diagnosticCount = safeAdd(
			diagnosticCount,
			syntacticDiagnostics.length,
			'Selected declaration artifact diagnostic population'
		);
		if (diagnosticCount > inputs.request.budgets.maxDiagnostics)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Selected declaration artifact diagnostics exhausted the diagnostic budget.'
			);
		if (diagnosticCount !== 0)
			failDerivation(
				'INPUT_INVALID',
				'Selected declaration artifacts must have no public Program syntactic diagnostics.'
			);
	}
}

interface ParsedArtifactSeed {
	readonly artifact: ArtifactSeed;
	readonly astNodes: number;
	readonly inputRecordOrdinal: number;
	readonly parsedSource: ParsedCapturedSource;
}

function assertIndependentArtifactParse(
	context: DeriveContext,
	artifact: ArtifactSeed,
	parsedSource: ParsedCapturedSource,
	languageVersionCode: ts.ScriptTarget
): void {
	const { assertWithinDeadline, provider } = context;
	const parsedExternalModule = provider.isExternalModule(parsedSource.sourceFile);
	assertWithinDeadline();
	if (
		parsedSource.contentBytes !== artifact.source.bytes ||
		!sameText(parsedSource.contentSha256, artifact.source.contentSha256, assertWithinDeadline) ||
		parsedSource.textLength !== artifact.source.textLength ||
		!sameText(parsedSource.sourceFile.text, artifact.sourceFile.text, assertWithinDeadline) ||
		parsedSource.sourceFile.languageVersion !== languageVersionCode ||
		!parsedSource.sourceFile.isDeclarationFile ||
		!parsedExternalModule
	)
		failDerivation(
			'INPUT_INVALID',
			'Independent declaration parse does not reproduce its Program and CAP-001 source.'
		);
	if (
		parsedSource.sourceFile.referencedFiles.length !== 0 ||
		parsedSource.sourceFile.typeReferenceDirectives.length !== 0 ||
		parsedSource.sourceFile.libReferenceDirectives.length !== 0 ||
		parsedSource.sourceFile.amdDependencies.length !== 0 ||
		parsedSource.sourceFile.moduleName !== undefined ||
		parsedSource.sourceFile.hasNoDefaultLib
	)
		failDerivation(
			'INPUT_INVALID',
			'Selected declaration artifacts contain unsupported triple-slash dependency, AMD metadata, or default-library directives.'
		);
}

interface SelectedArtifactAstScope {
	readonly independentRootExportSpecifierCensus: RootExportSpecifierCensusEntry[];
	readonly independentTerminalCensus: DeclarationCensusEntry[];
	readonly logicalPath: string;
	readonly parsedSourceFile: ts.SourceFile;
	readonly rootArtifactSelected: boolean;
	readonly rootExportSpecifierLimit: number;
	readonly terminalArtifactSelected: boolean;
	readonly terminalDeclarationLimit: number;
	readonly terminalName: string;
}

function assertSupportedSelectedDeclarationSyntax(node: ts.Node): void {
	if (ts.isNamespaceExportDeclaration(node))
		failDerivation(
			'INPUT_INVALID',
			'Selected declaration artifacts contain unsupported ambient namespace-export syntax.'
		);
	if (
		ts.isModuleDeclaration(node) &&
		(ts.isStringLiteral(node.name) || (node.flags & ts.NodeFlags.GlobalAugmentation) !== 0)
	)
		failDerivation(
			'INPUT_INVALID',
			'Selected declaration artifacts contain unsupported augmentation or ambient-effect syntax.'
		);
}

function censusIndependentTerminalDeclaration(
	context: DeriveContext,
	scope: SelectedArtifactAstScope,
	node: ts.Node
): void {
	const { assertWithinDeadline } = context;
	refuseCollapsedTerminalNameBinding(
		node,
		scope.parsedSourceFile,
		scope.terminalName,
		assertWithinDeadline
	);
	const declaration = censusTopLevelTerminalDeclaration(
		node,
		scope.parsedSourceFile,
		scope.logicalPath,
		scope.terminalName,
		assertWithinDeadline
	);
	if (declaration === null) return;
	if (scope.independentTerminalCensus.length >= scope.terminalDeclarationLimit)
		failDerivation(
			'INPUT_INVALID',
			'The independently parsed terminal declaration census does not reproduce the complete checker declaration multiset.'
		);
	scope.independentTerminalCensus.push(declaration);
}

function censusSelectedRootExportSpecifier(
	context: DeriveContext,
	scope: SelectedArtifactAstScope,
	node: ts.Node
): void {
	const { assertWithinDeadline, inputs } = context;
	if (
		!ts.isExportSpecifier(node) ||
		!sameText(node.name.text, inputs.request.exportName, assertWithinDeadline)
	)
		return;
	if (scope.independentRootExportSpecifierCensus.length >= scope.rootExportSpecifierLimit)
		failDerivation(
			'INPUT_INVALID',
			'The independently parsed selected root ExportSpecifier census does not reproduce the checker alias binding.'
		);
	scope.independentRootExportSpecifierCensus.push(
		rootExportSpecifierCensusEntry(
			node,
			scope.parsedSourceFile,
			scope.logicalPath,
			inputs.request.exportName,
			assertWithinDeadline
		)
	);
}

function selectedArtifactAstVisitor(
	context: DeriveContext,
	scope: SelectedArtifactAstScope
): (node: ts.Node) => void {
	return (node) => {
		context.chargeTraversal(1);
		assertSupportedSelectedDeclarationSyntax(node);
		if (scope.terminalArtifactSelected) censusIndependentTerminalDeclaration(context, scope, node);
		if (scope.rootArtifactSelected) censusSelectedRootExportSpecifier(context, scope, node);
	};
}

interface SelectedArtifactParsePlan {
	readonly languageVersionCode: ts.ScriptTarget;
	readonly rootExportSpecifierLimit: number;
	readonly terminalArtifactSourceId: string | null;
	readonly terminalDeclarationLimit: number;
	readonly terminalName: string;
}

interface SelectedArtifactParse {
	readonly independentRootExportSpecifierCensus: readonly RootExportSpecifierCensusEntry[];
	readonly independentTerminalCensus: readonly DeclarationCensusEntry[];
	readonly parsedArtifactSeeds: readonly ParsedArtifactSeed[];
	readonly selectedAstNodes: number;
}

function parseSelectedArtifacts(
	context: DeriveContext,
	orderedArtifactSeeds: readonly ArtifactSeed[],
	plan: SelectedArtifactParsePlan
): SelectedArtifactParse {
	const { assertWithinDeadline, bound, inputs, provider, session } = context;
	const parsedArtifactSeeds: ParsedArtifactSeed[] = [];
	const independentRootExportSpecifierCensus: RootExportSpecifierCensusEntry[] = [];
	const independentTerminalCensus: DeclarationCensusEntry[] = [];
	let selectedAstNodes = 0;
	for (const artifact of orderedArtifactSeeds) {
		assertWithinDeadline();
		const parsedSource = provider.parseCapturedSourceFile(session, artifact.source.logicalPath);
		assertWithinDeadline();
		assertIndependentArtifactParse(context, artifact, parsedSource, plan.languageVersionCode);
		const terminalArtifactSelected =
			plan.terminalArtifactSourceId !== null &&
			sameText(artifact.source.id, plan.terminalArtifactSourceId, assertWithinDeadline);
		const rootArtifactSelected = sameText(
			artifact.source.id,
			bound.targetSource.id,
			assertWithinDeadline
		);
		const scope: SelectedArtifactAstScope = {
			independentRootExportSpecifierCensus,
			independentTerminalCensus,
			logicalPath: artifact.source.logicalPath,
			parsedSourceFile: parsedSource.sourceFile,
			rootArtifactSelected,
			rootExportSpecifierLimit: plan.rootExportSpecifierLimit,
			terminalArtifactSelected,
			terminalDeclarationLimit: plan.terminalDeclarationLimit,
			terminalName: plan.terminalName
		};
		const astNodes = countAstNodes(
			parsedSource.sourceFile,
			inputs.request.budgets.maxParsedArtifactAstNodes - selectedAstNodes,
			'Selected declaration artifact',
			selectedArtifactAstVisitor(context, scope),
			assertWithinDeadline
		);
		selectedAstNodes = safeAdd(
			selectedAstNodes,
			astNodes,
			'Selected declaration AST node population'
		);
		parsedArtifactSeeds.push({
			artifact,
			astNodes,
			inputRecordOrdinal: parsedSource.inputRecordOrdinal,
			parsedSource
		});
	}
	return {
		independentRootExportSpecifierCensus,
		independentTerminalCensus,
		parsedArtifactSeeds,
		selectedAstNodes
	};
}

function assertIndependentCensusReproduction(
	context: DeriveContext,
	parse: SelectedArtifactParse,
	checkerRootExportSpecifierCensus: readonly RootExportSpecifierCensusEntry[],
	checkerTerminalCensus: readonly DeclarationCensusEntry[]
): void {
	const { assertWithinDeadline } = context;
	const orderedIndependentRootExportSpecifierCensus = checkedSort(
		parse.independentRootExportSpecifierCensus,
		(left, right) => compareRootExportSpecifierCensus(left, right, assertWithinDeadline),
		assertWithinDeadline
	);
	const orderedCheckerRootExportSpecifierCensus = checkedSort(
		checkerRootExportSpecifierCensus,
		(left, right) => compareRootExportSpecifierCensus(left, right, assertWithinDeadline),
		assertWithinDeadline
	);
	if (
		!equalRootExportSpecifierCensus(
			orderedIndependentRootExportSpecifierCensus,
			orderedCheckerRootExportSpecifierCensus,
			assertWithinDeadline
		)
	)
		failDerivation(
			'INPUT_INVALID',
			'The independently parsed selected root ExportSpecifier census does not reproduce the checker alias binding.'
		);
	const orderedIndependentTerminalCensus = checkedSort(
		parse.independentTerminalCensus,
		(left, right) => compareDeclarationCensus(left, right, assertWithinDeadline),
		assertWithinDeadline
	);
	if (
		!equalDeclarationCensus(
			orderedIndependentTerminalCensus,
			checkerTerminalCensus,
			assertWithinDeadline
		)
	)
		failDerivation(
			'INPUT_INVALID',
			'The independently parsed terminal declaration census does not reproduce the complete checker declaration multiset.'
		);
}

function finalizeCaptureEvidence(
	context: DeriveContext,
	programSourceFileCount: number,
	artifactCount: number
): CaptureEvidence {
	const { assertWithinDeadline, bound, inputs, provider, session } = context;
	assertWithinDeadline();
	const evidence = provider.finalizeSession(session);
	assertWithinDeadline();
	const contextInputIdsReconcile = equalStringPopulation(
		evidence.contextInputIds,
		inputs.moduleResolutionTrace.captureWitness.inputRecordIds,
		assertWithinDeadline
	);
	if (
		!sameText(evidence.subjectId, inputs.request.subjectId, assertWithinDeadline) ||
		!sameText(evidence.semanticProgramId, bound.semanticProgram.id, assertWithinDeadline) ||
		!sameText(evidence.semanticProjectId, bound.semanticProject.id, assertWithinDeadline) ||
		!sameText(evidence.configPath, bound.configPath, assertWithinDeadline) ||
		!sameText(
			evidence.programContextDigest,
			bound.semanticProgram.contextDigest,
			assertWithinDeadline
		) ||
		!sameText(
			inputs.moduleResolutionTrace.captureWitness.contextDigest,
			inputs.semanticSnapshot.contextDigest,
			assertWithinDeadline
		) ||
		!sameText(
			evidence.materializedRecipeDigest,
			inputs.moduleResolutionTrace.captureWitness.materializedRecipeDigest,
			assertWithinDeadline
		) ||
		!sameText(
			evidence.projectResolutionDigest,
			inputs.moduleResolutionTrace.captureWitness.projectResolutionDigest,
			assertWithinDeadline
		) ||
		!contextInputIdsReconcile ||
		evidence.programSourceFiles !== programSourceFileCount ||
		evidence.programCallbacksWithinAttributedInvocationBounds !== true ||
		!safeNonnegative(evidence.attributedInputRecords) ||
		!safeNonnegative(evidence.attributedReadBytes) ||
		!safeNonnegative(evidence.attributedUniqueQueries) ||
		evidence.attributedUniqueQueries > evidence.attributedInputRecords ||
		evidence.artifactParseInputRecords !== artifactCount ||
		evidence.compilerHostCallbacks !==
			safeAdd(
				evidence.programCompilerHostCallbacks,
				evidence.artifactParseInputRecords,
				'Total compiler input population'
			) ||
		evidence.compilerHostReadBytes !==
			safeAdd(
				evidence.programCompilerHostReadBytes,
				evidence.artifactParseReadBytes,
				'Total compiler read-byte population'
			)
	)
		failDerivation('INPUT_INVALID', 'Fresh Program evidence does not reconcile with derivation.');
	if (
		evidence.attributedInputRecords > inputs.request.budgets.maxCompilerInputAttempts ||
		evidence.attributedReadBytes > inputs.request.budgets.maxProgramReadBytes
	)
		failDerivation(
			'BUDGET_EXHAUSTED',
			'Capture-attributed compiler input upper bounds exhausted the Program budgets.'
		);
	return evidence;
}

interface CapturedProgramSourceRead {
	readonly bytes: number;
	readonly contentSha256: string;
	readonly origin: string;
}

interface ProgramEvidenceScan {
	artifactReadBytes: number;
	artifactSuffixStarted: boolean;
	readonly capturedProgramSourceReads: Map<string, CapturedProgramSourceRead[]>;
	readonly programEvidenceRecords: ProgramEvidenceRecord[];
	programReadBytes: number;
}

function accumulateProgramEvidenceStage(
	scan: ProgramEvidenceScan,
	record: CaptureInputRecord
): void {
	if (record.stage === 'DECLARATION_ARTIFACT_PARSE') {
		scan.artifactSuffixStarted = true;
		return;
	}
	if (scan.artifactSuffixStarted)
		failDerivation(
			'INPUT_INVALID',
			'Program/checker callbacks must form a dense prefix before artifact reads.'
		);
	scan.programEvidenceRecords.push(record as ProgramEvidenceRecord);
}

function accumulateProgramEvidenceRead(
	scan: ProgramEvidenceScan,
	record: CaptureInputRecord
): void {
	if (record.observation.operation !== 'READ_FILE' || record.observation.result !== 'PRESENT')
		return;
	if (record.stage === 'DECLARATION_ARTIFACT_PARSE') {
		scan.artifactReadBytes = safeAdd(
			scan.artifactReadBytes,
			record.observation.contentBytes,
			'Artifact read-byte population'
		);
		return;
	}
	scan.programReadBytes = safeAdd(
		scan.programReadBytes,
		record.observation.contentBytes,
		'Program read-byte population'
	);
	let reads = scan.capturedProgramSourceReads.get(record.query.logicalPath);
	if (reads === undefined) {
		reads = [];
		scan.capturedProgramSourceReads.set(record.query.logicalPath, reads);
	}
	reads.push({
		bytes: record.observation.contentBytes,
		contentSha256: record.observation.contentSha256,
		origin: record.observation.origin
	});
}

function scanProgramEvidenceRecords(
	context: DeriveContext,
	evidence: CaptureEvidence
): ProgramEvidenceScan {
	const { assertWithinDeadline, inputs } = context;
	const scan: ProgramEvidenceScan = {
		artifactReadBytes: 0,
		artifactSuffixStarted: false,
		capturedProgramSourceReads: new Map<string, CapturedProgramSourceRead[]>(),
		programEvidenceRecords: [],
		programReadBytes: 0
	};
	if (evidence.inputRecords.length > inputs.request.budgets.maxInputRecords)
		failDerivation('BUDGET_EXHAUSTED', 'Compiler input record population exceeds its budget.');
	for (let ordinal = 0; ordinal < evidence.inputRecords.length; ordinal += 1) {
		assertWithinDeadline();
		const record = evidence.inputRecords[ordinal]!;
		if (record.ordinal !== ordinal)
			failDerivation('INPUT_INVALID', 'Compiler input records are not globally dense.');
		accumulateProgramEvidenceStage(scan, record);
		accumulateProgramEvidenceRead(scan, record);
	}
	if (
		scan.programEvidenceRecords.length !== evidence.programCompilerHostCallbacks ||
		evidence.inputRecords.length !== evidence.compilerHostCallbacks ||
		scan.programReadBytes !== evidence.programCompilerHostReadBytes ||
		scan.artifactReadBytes !== evidence.artifactParseReadBytes
	)
		failDerivation('INPUT_INVALID', 'Fresh Program callback population or ordering is invalid.');
	return scan;
}

function hasMatchingCapturedProgramRead(
	context: DeriveContext,
	source: DeclarationContextProgramSourceIdentity,
	reads: readonly CapturedProgramSourceRead[] | undefined
): boolean {
	const { assertWithinDeadline } = context;
	let matchingRead = false;
	if (reads !== undefined)
		for (const read of reads) {
			assertWithinDeadline();
			if (
				read.bytes === source.bytes &&
				sameText(read.contentSha256, source.contentSha256, assertWithinDeadline) &&
				sameText(read.origin, source.origin, assertWithinDeadline)
			)
				matchingRead = true;
		}
	return matchingRead;
}

function assertCapturedProgramSourceWitnesses(
	context: DeriveContext,
	programSourceIdentities: readonly DeclarationContextProgramSourceIdentity[],
	capturedProgramSourceReads: ReadonlyMap<string, CapturedProgramSourceRead[]>
): void {
	const { assertWithinDeadline } = context;
	for (const source of programSourceIdentities) {
		assertWithinDeadline();
		const reads = capturedProgramSourceReads.get(source.logicalPath);
		if (!hasMatchingCapturedProgramRead(context, source, reads))
			failDerivation(
				'INPUT_INVALID',
				'Fresh Program source lacks a matching captured content witness.'
			);
	}
}

function sumPopulations(initial: number, populations: readonly number[], label: string): number {
	let total = initial;
	for (const population of populations) total = safeAdd(total, population, label);
	return total;
}

interface DerivedPopulations {
	readonly aliasHops: number;
	readonly artifactReadBytes: number;
	readonly artifacts: number;
	readonly declarations: number;
	readonly exportSymbols: number;
	readonly programEvidenceRecords: number;
	readonly programFiles: number;
	readonly programParsedAstNodes: number;
	readonly programReadBytes: number;
	readonly selectedAstNodes: number;
}

interface ProspectiveAccounting {
	readonly inputRecords: number;
	readonly mergeRecords: number;
	readonly outputRecords: number;
	readonly readBytes: number;
	readonly relationRecords: number;
	readonly traversalSteps: number;
}

function computeProspectiveAccounting(
	context: DeriveContext,
	populations: DerivedPopulations
): ProspectiveAccounting {
	const { chargeTraversal, inputs, traversalTotal } = context;
	const mergeRecords = populations.declarations > 1 ? 1 : 0;
	let relationRecords = safeAdd(
		populations.declarations,
		populations.declarations,
		'Declaration relation population'
	);
	if (mergeRecords === 1)
		relationRecords = safeAdd(
			relationRecords,
			populations.declarations,
			'Declaration merge relation population'
		);
	if (relationRecords > inputs.request.budgets.maxRelations)
		failDerivation('BUDGET_EXHAUSTED', 'Declaration relation budget was exhausted.');
	chargeTraversal(relationRecords);
	const inputRecords = safeAdd(
		populations.programEvidenceRecords,
		populations.artifacts,
		'Declaration-context input population'
	);
	const readBytes = safeAdd(
		populations.programReadBytes,
		populations.artifactReadBytes,
		'Declaration-context read-byte population'
	);
	const traversalSteps = sumPopulations(
		0,
		[
			populations.programEvidenceRecords,
			populations.artifacts,
			populations.programFiles,
			populations.programParsedAstNodes,
			populations.selectedAstNodes,
			populations.exportSymbols,
			populations.aliasHops,
			populations.declarations,
			relationRecords
		],
		'Declaration-context traversal population'
	);
	if (traversalTotal() !== traversalSteps)
		failDerivation(
			'INPUT_INVALID',
			'Progressive declaration-context traversal accounting did not reconcile.'
		);
	const outputRecords = sumPopulations(
		3,
		[
			populations.programEvidenceRecords,
			populations.artifacts,
			populations.artifacts,
			populations.declarations,
			mergeRecords,
			relationRecords
		],
		'Declaration-context output population'
	);
	if (
		populations.programEvidenceRecords > inputs.request.budgets.maxCompilerInputAttempts ||
		inputRecords > inputs.request.budgets.maxInputRecords ||
		populations.programReadBytes > inputs.request.budgets.maxProgramReadBytes ||
		readBytes > inputs.request.budgets.maxReadBytes ||
		relationRecords > inputs.request.budgets.maxRelations ||
		traversalSteps > inputs.request.budgets.maxTraversalSteps ||
		outputRecords > inputs.request.budgets.maxOutputRecords
	)
		failDerivation(
			'BUDGET_EXHAUSTED',
			'Declaration-context materialization budget was exhausted before output allocation.'
		);
	return { inputRecords, mergeRecords, outputRecords, readBytes, relationRecords, traversalSteps };
}

function buildProgramInputAttempts(
	context: DeriveContext,
	programEvidenceRecords: readonly ProgramEvidenceRecord[]
): DeclarationContextProgramInputAttemptRecord[] {
	const { analysisId, assertWithinDeadline } = context;
	return checkedMap(
		programEvidenceRecords,
		(record) => {
			const withoutId: Omit<DeclarationContextProgramInputAttemptRecord, 'id'> = {
				attributedInvocationCount: record.attributedInvocationCount,
				invocationOrdinal: record.invocationOrdinal,
				observation: cloneWire(record.observation, assertWithinDeadline),
				ordinal: record.ordinal,
				query: cloneWire(record.query, assertWithinDeadline),
				stage: record.stage
			};
			return {
				...withoutId,
				id: independentRecordId<DeclarationContextProgramInputAttemptId>(
					'declaration-context-program-input-attempt',
					'JAN-CSAA-DECLARATION-CONTEXT-PROGRAM-INPUT-ATTEMPT',
					analysisId,
					withoutId,
					assertWithinDeadline
				)
			};
		},
		assertWithinDeadline
	);
}

interface ParseWitnessBinding {
	readonly parseWitnessBySourceId: ReadonlyMap<string, DeclarationContextParseWitnessRecord>;
	readonly parseWitnesses: DeclarationContextParseWitnessRecord[];
}

function buildParseWitnesses(
	context: DeriveContext,
	parsedArtifactSeeds: readonly ParsedArtifactSeed[],
	evidence: CaptureEvidence,
	language: FreshProgramLanguage
): ParseWitnessBinding {
	const { analysisId, assertWithinDeadline, bound } = context;
	const parseWitnesses: DeclarationContextParseWitnessRecord[] = [];
	const parseWitnessBySourceId = new Map<string, DeclarationContextParseWitnessRecord>();
	for (const parsed of parsedArtifactSeeds) {
		assertWithinDeadline();
		const inputRecord = evidence.inputRecords[parsed.inputRecordOrdinal];
		if (
			inputRecord?.stage !== 'DECLARATION_ARTIFACT_PARSE' ||
			inputRecord.query.operation !== 'READ_FILE' ||
			!sameText(
				inputRecord.query.logicalPath,
				parsed.artifact.source.logicalPath,
				assertWithinDeadline
			) ||
			inputRecord.observation.operation !== 'READ_FILE' ||
			inputRecord.observation.result !== 'PRESENT'
		)
			failDerivation('INPUT_INVALID', 'Independent declaration parse read witness is invalid.');
		const withoutId: Omit<DeclarationContextParseWitnessRecord, 'id'> = {
			astNodes: parsed.astNodes,
			bytes: parsed.artifact.source.bytes,
			compilerVersion: ts.version,
			contentSha256: parsed.artifact.source.contentSha256,
			decodedUtf16CodeUnits: parsed.parsedSource.textLength,
			externalModule: true,
			languageVersion: {
				nativeCode: language.languageVersionCode,
				nativeName: language.languageVersionName
			},
			logicalPath: parsed.artifact.source.logicalPath,
			parseDiagnostics: [],
			parseHealth: 'VALID',
			parseMethod: 'TYPESCRIPT_PUBLIC_CREATE_SOURCE_FILE_OVER_EXACT_CAPTURED_BYTES',
			programSourceReconciliation: 'EXACT_LOGICAL_PATH_CONTENT_SHA256_AND_SEMANTIC_SOURCE_ID',
			scriptKind: { nativeCode: ts.ScriptKind.TS, nativeName: 'TS' },
			semanticProgramId: bound.semanticProgram.id,
			semanticProjectId: bound.semanticProject.id,
			semanticSourceId: parsed.artifact.source.id,
			sourceEncoding: parsed.parsedSource.encoding as DeclarationContextSourceEncoding,
			sourceRead: {
				attributedInvocationCount: inputRecord.attributedInvocationCount,
				inputRecordOrdinal: inputRecord.ordinal,
				invocationOrdinal: inputRecord.invocationOrdinal,
				observation: cloneWire(inputRecord.observation, assertWithinDeadline),
				query: {
					logicalPath: inputRecord.query.logicalPath,
					operation: 'READ_FILE'
				},
				stage: 'DECLARATION_ARTIFACT_PARSE'
			},
			statements: parsed.parsedSource.sourceFile.statements.length
		};
		const record: DeclarationContextParseWitnessRecord = {
			...withoutId,
			id: independentRecordId<DeclarationContextParseWitnessId>(
				'declaration-context-parse-witness',
				'JAN-CSAA-DECLARATION-CONTEXT-PARSE-WITNESS',
				analysisId,
				withoutId,
				assertWithinDeadline
			)
		};
		parseWitnesses.push(record);
		parseWitnessBySourceId.set(parsed.artifact.source.id, record);
	}
	return { parseWitnessBySourceId, parseWitnesses };
}

function buildArtifactRecords(
	context: DeriveContext,
	orderedArtifactSeeds: readonly ArtifactSeed[],
	parseWitnessBySourceId: ReadonlyMap<string, DeclarationContextParseWitnessRecord>
): DeclarationContextArtifactRecord[] {
	const { analysisId, assertWithinDeadline, bound } = context;
	return checkedMap(
		orderedArtifactSeeds,
		(seed, ordinal) => {
			const parseWitness = parseWitnessBySourceId.get(seed.source.id)!;
			const roles: DeclarationContextArtifactRole[] = [];
			for (const role of DECLARATION_CONTEXT_ANALYSIS_ARTIFACT_ROLE_ORDER) {
				assertWithinDeadline();
				if (seed.roles.has(role)) roles.push(role);
			}
			const withoutId: Omit<DeclarationContextArtifactRecord, 'id'> = {
				artifactClass: 'CONTEXT_ONLY',
				bytes: seed.source.bytes,
				contentSha256: seed.source.contentSha256,
				declarationFile: true,
				declarationRole: 'EMITTED_DECLARATION',
				extension: sourceExtension(seed.source.logicalPath),
				logicalPath: seed.source.logicalPath,
				ordinal,
				origin: 'WORKSPACE_BUILD_DECLARATION',
				parseWitnessId: parseWitness.id,
				roles,
				semanticProgramId: bound.semanticProgram.id,
				semanticProjectId: bound.semanticProject.id,
				semanticSourceId: seed.source.id
			};
			return {
				...withoutId,
				id: independentRecordId<DeclarationContextArtifactId>(
					'declaration-context-artifact',
					'JAN-CSAA-DECLARATION-CONTEXT-ARTIFACT',
					analysisId,
					withoutId,
					assertWithinDeadline
				)
			};
		},
		assertWithinDeadline
	);
}

interface ArtifactRecordIndex {
	readonly artifactBySourceId: ReadonlyMap<string, DeclarationContextArtifactRecord>;
	readonly rootArtifact: DeclarationContextArtifactRecord;
	readonly terminalArtifact: DeclarationContextArtifactRecord;
}

function indexArtifactRecords(
	context: DeriveContext,
	artifacts: readonly DeclarationContextArtifactRecord[],
	terminalArtifactSourceId: string | null
): ArtifactRecordIndex {
	const { assertWithinDeadline, bound } = context;
	const artifactBySourceId = new Map<string, DeclarationContextArtifactRecord>();
	for (const artifact of artifacts) {
		assertWithinDeadline();
		artifactBySourceId.set(artifact.semanticSourceId, artifact);
	}
	return {
		artifactBySourceId,
		rootArtifact: artifactBySourceId.get(bound.targetSource.id)!,
		terminalArtifact: artifactBySourceId.get(terminalArtifactSourceId!)!
	};
}

function buildAliasHopWitnesses(
	context: DeriveContext,
	aliasHopSeeds: readonly AliasHopSeed[],
	artifactBySourceId: ReadonlyMap<string, DeclarationContextArtifactRecord>
): DeclarationContextAliasHopWitness[] {
	const { assertWithinDeadline } = context;
	const aliasHops: DeclarationContextAliasHopWitness[] = [];
	for (const seed of aliasHopSeeds) {
		assertWithinDeadline();
		const hopArtifacts: DeclarationContextArtifactRecord[] = [];
		for (const sourceId of seed.aliasSourceIds) {
			assertWithinDeadline();
			const artifact = artifactBySourceId.get(sourceId);
			if (artifact !== undefined) hopArtifacts.push(artifact);
		}
		const orderedHopArtifacts = checkedSort(
			hopArtifacts,
			(left, right) => left.ordinal - right.ordinal,
			assertWithinDeadline
		);
		const aliasDeclarationArtifactIds = checkedMap(
			orderedHopArtifacts,
			(artifact) => artifact.id,
			assertWithinDeadline
		);
		aliasHops.push({
			aliasDeclarationArtifactIds,
			aliasName: seed.aliasName,
			aliasSymbolFlags: seed.aliasSymbolFlags,
			ordinal: seed.ordinal,
			resolutionApi: 'TYPESCRIPT_PUBLIC_TYPE_CHECKER_GET_ALIASED_SYMBOL',
			targetName: seed.targetName
		});
	}
	let lostAliasArtifact = false;
	for (const hop of aliasHops) {
		assertWithinDeadline();
		if (hop.aliasDeclarationArtifactIds.length === 0) lostAliasArtifact = true;
	}
	if (lostAliasArtifact)
		failDerivation('INPUT_INVALID', 'One alias hop lost its declaration-artifact identities.');
	return aliasHops;
}

function buildDeclarationRecords(
	context: DeriveContext,
	terminalDeclarations: readonly ts.Declaration[],
	terminalArtifact: DeclarationContextArtifactRecord,
	terminalParseWitness: DeclarationContextParseWitnessRecord
): DeclarationContextDeclarationRecord[] {
	const { analysisId, assertWithinDeadline } = context;
	const declarationWithoutIds = checkedSort(
		checkedMap(
			terminalDeclarations,
			(declaration) => {
				const declarationSourceFile = declaration.getSourceFile();
				assertWithinDeadline();
				return supportedDeclaration(
					declaration,
					declarationSourceFile,
					terminalArtifact.id,
					terminalParseWitness.id,
					0,
					assertWithinDeadline
				);
			},
			assertWithinDeadline
		),
		(left, right) =>
			left.start - right.start ||
			left.end - right.end ||
			left.nativeKind.nativeCode - right.nativeKind.nativeCode ||
			compareText(left.name, right.name, assertWithinDeadline),
		assertWithinDeadline
	);
	return checkedMap(
		declarationWithoutIds,
		(seed, ordinal) => {
			const withoutId = { ...seed, ordinal };
			return {
				...withoutId,
				id: independentRecordId<DeclarationContextDeclarationId>(
					'declaration-context-declaration',
					'JAN-CSAA-DECLARATION-CONTEXT-DECLARATION',
					analysisId,
					withoutId,
					assertWithinDeadline
				)
			};
		},
		assertWithinDeadline
	);
}

function buildTerminalSymbolRecord(
	context: DeriveContext,
	terminalSymbol: ts.Symbol,
	terminalName: string,
	terminalArtifact: DeclarationContextArtifactRecord,
	declarations: readonly DeclarationContextDeclarationRecord[],
	declarationIds: DeclarationContextDeclarationId[]
): DeclarationContextTerminalSymbolRecord {
	const { analysisId, assertWithinDeadline, bound, provider } = context;
	const terminalSymbolFlagsMask = provider.symbolFlags(terminalSymbol);
	assertWithinDeadline();
	const terminalSymbolWithoutId: Omit<DeclarationContextTerminalSymbolRecord, 'id'> = {
		declarationArtifactId: terminalArtifact.id,
		declarationIds,
		declarationSetClosure: 'COMPLETE_PUBLIC_CHECKER_DECLARATION_SET_SAME_ARTIFACT',
		flags: symbolFlags(terminalSymbolFlagsMask, assertWithinDeadline),
		mergeState: declarations.length === 1 ? 'SINGLE' : 'MERGED',
		name: terminalName,
		ordinal: 0,
		semanticProgramId: bound.semanticProgram.id,
		semanticProjectId: bound.semanticProject.id,
		symbolMeaning: 'TERMINAL_CHECKER_SYMBOL_FOR_SELECTED_PACKAGE_ROOT_EXPORT'
	};
	return {
		...terminalSymbolWithoutId,
		id: independentRecordId<DeclarationContextTerminalSymbolId>(
			'declaration-context-terminal-symbol',
			'JAN-CSAA-DECLARATION-CONTEXT-TERMINAL-SYMBOL',
			analysisId,
			terminalSymbolWithoutId,
			assertWithinDeadline
		)
	};
}

function buildExportBindingRecord(
	context: DeriveContext,
	rootExportSymbol: ts.Symbol,
	aliasHops: DeclarationContextAliasHopWitness[],
	exportSymbolsExamined: number,
	rootArtifact: DeclarationContextArtifactRecord,
	terminalSymbolRecord: DeclarationContextTerminalSymbolRecord
): DeclarationContextExportBindingRecord {
	const { analysisId, assertWithinDeadline, inputs, provider } = context;
	const rootExportSymbolFlagsMask = provider.symbolFlags(rootExportSymbol);
	assertWithinDeadline();
	const exportBindingWithoutId: Omit<DeclarationContextExportBindingRecord, 'id'> = {
		aliasHops,
		exportName: inputs.request.exportName,
		exportSymbolsExamined,
		ordinal: 0,
		resolutionKind:
			aliasHops.length === 0 ? 'DIRECT_TERMINAL_SYMBOL' : 'ALIASED_TO_TERMINAL_SYMBOL',
		rootArtifactId: rootArtifact.id,
		rootExportSymbolFlags: symbolFlags(rootExportSymbolFlagsMask, assertWithinDeadline),
		selectionApi: 'TYPESCRIPT_PUBLIC_TYPE_CHECKER_GET_EXPORTS_OF_MODULE',
		terminalSymbolId: terminalSymbolRecord.id
	};
	return {
		...exportBindingWithoutId,
		id: independentRecordId<DeclarationContextExportBindingId>(
			'declaration-context-export-binding',
			'JAN-CSAA-DECLARATION-CONTEXT-EXPORT-BINDING',
			analysisId,
			exportBindingWithoutId,
			assertWithinDeadline
		)
	};
}

function buildMergeRecords(
	context: DeriveContext,
	declarations: readonly DeclarationContextDeclarationRecord[],
	declarationIds: DeclarationContextDeclarationId[],
	terminalArtifact: DeclarationContextArtifactRecord,
	terminalSymbolRecord: DeclarationContextTerminalSymbolRecord
): DeclarationContextMergeRecord[] {
	const { analysisId, assertWithinDeadline } = context;
	const merges: DeclarationContextMergeRecord[] = [];
	if (declarations.length > 1) {
		const withoutId: Omit<DeclarationContextMergeRecord, 'id'> = {
			declarationArtifactId: terminalArtifact.id,
			declarationIds,
			kind: 'COMPLETE_SAME_FILE_TERMINAL_SYMBOL_MERGE',
			ordinal: 0,
			terminalSymbolId: terminalSymbolRecord.id
		};
		merges.push({
			...withoutId,
			id: independentRecordId<DeclarationContextMergeId>(
				'declaration-context-merge',
				'JAN-CSAA-DECLARATION-CONTEXT-MERGE',
				analysisId,
				withoutId,
				assertWithinDeadline
			)
		});
	}
	return merges;
}

function buildRelationRecords(
	context: DeriveContext,
	declarations: readonly DeclarationContextDeclarationRecord[],
	merges: readonly DeclarationContextMergeRecord[],
	terminalSymbolRecord: DeclarationContextTerminalSymbolRecord
): DeclarationContextRelationRecord[] {
	const { analysisId, assertWithinDeadline } = context;
	const relationSeeds: DeclarationContextRelationRecordWithoutId[] = [];
	for (const declaration of declarations) {
		assertWithinDeadline();
		relationSeeds.push(
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
				terminalSymbolId: terminalSymbolRecord.id
			}
		);
		if (merges[0] !== undefined)
			relationSeeds.push({
				declarationId: declaration.id,
				kind: 'MERGES_WITH',
				mergeId: merges[0].id,
				ordinal: 0,
				terminalSymbolId: terminalSymbolRecord.id
			});
	}
	const relationRank: Record<DeclarationContextRelationRecordWithoutId['kind'], number> = {
		CONTRIBUTES_TO: 1,
		DECLARES: 0,
		MERGES_WITH: 2
	};
	const relationEndpoints = (record: DeclarationContextRelationRecordWithoutId): string => {
		if (record.kind === 'DECLARES') return `${record.artifactId}\0${record.declarationId}`;
		if (record.kind === 'CONTRIBUTES_TO')
			return `${record.declarationId}\0${record.terminalSymbolId}`;
		return `${record.declarationId}\0${record.mergeId}\0${record.terminalSymbolId}`;
	};
	const orderedRelationSeeds = checkedSort(
		relationSeeds,
		(left, right) =>
			relationRank[left.kind] - relationRank[right.kind] ||
			compareText(relationEndpoints(left), relationEndpoints(right), assertWithinDeadline),
		assertWithinDeadline
	);
	return checkedMap(
		orderedRelationSeeds,
		(seed, ordinal): DeclarationContextRelationRecord => {
			const withoutId = { ...seed, ordinal } as DeclarationContextRelationRecordWithoutId;
			return {
				...withoutId,
				id: independentRecordId<DeclarationContextRelationId>(
					'declaration-context-relation',
					'JAN-CSAA-DECLARATION-CONTEXT-RELATION',
					analysisId,
					withoutId,
					assertWithinDeadline
				)
			} as DeclarationContextRelationRecord;
		},
		assertWithinDeadline
	);
}

function countProgramPresentReadFileAttempts(
	context: DeriveContext,
	programEvidenceRecords: readonly ProgramEvidenceRecord[]
): number {
	const { assertWithinDeadline } = context;
	let programPresentReadFileAttempts = 0;
	for (const record of programEvidenceRecords) {
		assertWithinDeadline();
		if (record.observation.operation === 'READ_FILE' && record.observation.result === 'PRESENT')
			programPresentReadFileAttempts += 1;
	}
	return programPresentReadFileAttempts;
}

interface MaterializedPopulations {
	readonly aliasHops: number;
	readonly artifactReadBytes: number;
	readonly artifacts: number;
	readonly declarations: number;
	readonly exportSymbols: number;
	readonly merges: number;
	readonly parseWitnesses: number;
	readonly programFiles: number;
	readonly programInputAttempts: number;
	readonly programParsedAstNodes: number;
	readonly programReadBytes: number;
	readonly relations: number;
	readonly selectedAstNodes: number;
}

interface MaterializedAccounting {
	readonly chargedTraversalSteps: number;
	readonly inputRecords: number;
	readonly outputRecords: number;
	readonly readBytes: number;
}

function assertMaterializedAccounting(
	populations: MaterializedPopulations,
	prospective: ProspectiveAccounting
): MaterializedAccounting {
	const inputRecords = safeAdd(
		populations.programInputAttempts,
		populations.parseWitnesses,
		'Declaration-context input population'
	);
	const readBytes = safeAdd(
		populations.programReadBytes,
		populations.artifactReadBytes,
		'Declaration-context read-byte population'
	);
	if (inputRecords !== prospective.inputRecords || readBytes !== prospective.readBytes)
		failDerivation(
			'INPUT_INVALID',
			'Declaration-context compiler input accounting did not reconcile.'
		);
	const chargedTraversalSteps = sumPopulations(
		0,
		[
			populations.programInputAttempts,
			populations.artifacts,
			populations.programFiles,
			populations.programParsedAstNodes,
			populations.selectedAstNodes,
			populations.exportSymbols,
			populations.aliasHops,
			populations.declarations,
			populations.relations
		],
		'Declaration-context traversal population'
	);
	if (chargedTraversalSteps !== prospective.traversalSteps)
		failDerivation('INPUT_INVALID', 'Declaration-context traversal accounting did not reconcile.');
	const outputRecords = sumPopulations(
		3,
		[
			populations.programInputAttempts,
			populations.parseWitnesses,
			populations.artifacts,
			populations.declarations,
			populations.merges,
			populations.relations
		],
		'Declaration-context output population'
	);
	if (
		outputRecords !== prospective.outputRecords ||
		populations.relations !== prospective.relationRecords ||
		populations.merges !== prospective.mergeRecords
	)
		failDerivation('INPUT_INVALID', 'Declaration-context output accounting did not reconcile.');
	return { chargedTraversalSteps, inputRecords, outputRecords, readBytes };
}

function derive(
	inputs: DeclarationContextAnalysisBuildInputs,
	maxDurationMs: number,
	provider: Readonly<DeclarationContextAnalysisValidationProvider>,
	knownInputDigest?: string
): DeriveResult {
	try {
		const deadline = createDeriveDeadline(inputs, maxDurationMs, provider);
		const { assertWithinDeadline } = deadline;
		const traversal = createDeriveTraversalCharge(inputs);
		const inputDigest = independentInputDigest(inputs, assertWithinDeadline);
		assertWithinDeadline();
		assertKnownInputDigestReproduces(inputDigest, knownInputDigest, assertWithinDeadline);
		const analysisId = independentAnalysisId(inputs, inputDigest, assertWithinDeadline);
		const bound = bindContext(inputs, assertWithinDeadline);
		assertProviderRuntimeVersion(inputs);
		const session = openDeriveSession(inputs, provider, bound, deadline, traversal.charge);
		assertWithinDeadline();
		const context: DeriveContext = {
			analysisId,
			assertWithinDeadline,
			bound,
			chargeTraversal: traversal.charge,
			inputs,
			provider,
			session,
			traversalTotal: traversal.total
		};
		assertSessionSemanticBinding(context);
		const semanticSourceByLogicalPath = buildSemanticSourcePopulation(context);

		const programScan = scanFreshProgramSources(context, semanticSourceByLogicalPath);
		const contextSources = bindProjectContextSources(context);
		assertContextSourceReconciliation(context, contextSources, programScan);

		const rootBinding = bindSelectedRootExport(context, programScan);
		const { exportSymbols, rootExportSymbol, rootSourceFile } = rootBinding;

		const collector = createArtifactSeedCollector(context, semanticSourceByLogicalPath);
		collector.add(rootSourceFile, 'CAP011_SELECTED_DECLARATION_TARGET');
		collector.add(rootSourceFile, 'SELECTED_EXPORT_BINDING_CARRIER');

		const {
			aliasHopSeeds,
			checkerRootAliasDeclaration,
			checkerRootExportSpecifierCensus,
			terminalSymbol
		} = traverseSelectedExportAliases(context, rootExportSymbol, rootSourceFile, collector.add);

		const terminalName = resolveTerminalSymbolName(
			context,
			terminalSymbol,
			checkerRootAliasDeclaration
		);
		const terminalDeclarations = resolveTerminalDeclarations(context, terminalSymbol);
		const terminalArtifactSourceId = bindTerminalArtifactSource(
			context,
			terminalDeclarations,
			collector.add
		);
		const checkerTerminalCensus = buildCheckerTerminalCensus(
			context,
			terminalDeclarations,
			terminalName
		);
		const orderedArtifactSeeds = orderArtifactSeeds(context, collector.seeds);

		const language = assertFreshProgramCompilerOptions(context);
		const { compilerOptionsDigest } = language;
		assertSelectedArtifactDiagnostics(context, orderedArtifactSeeds);
		const parse = parseSelectedArtifacts(context, orderedArtifactSeeds, {
			languageVersionCode: language.languageVersionCode,
			rootExportSpecifierLimit: checkerRootExportSpecifierCensus.length,
			terminalArtifactSourceId,
			terminalDeclarationLimit: terminalDeclarations.length,
			terminalName
		});
		assertIndependentCensusReproduction(
			context,
			parse,
			checkerRootExportSpecifierCensus,
			checkerTerminalCensus
		);

		const { programFiles, programParsedAstNodes, programSourceIdentities } = programScan;
		const { selectedAstNodes } = parse;
		const evidence = finalizeCaptureEvidence(
			context,
			programFiles.length,
			orderedArtifactSeeds.length
		);
		const evidenceScan = scanProgramEvidenceRecords(context, evidence);
		const { programEvidenceRecords } = evidenceScan;
		assertCapturedProgramSourceWitnesses(
			context,
			programSourceIdentities,
			evidenceScan.capturedProgramSourceReads
		);
		const prospective = computeProspectiveAccounting(context, {
			aliasHops: aliasHopSeeds.length,
			artifactReadBytes: evidence.artifactParseReadBytes,
			artifacts: orderedArtifactSeeds.length,
			declarations: terminalDeclarations.length,
			exportSymbols: exportSymbols.length,
			programEvidenceRecords: programEvidenceRecords.length,
			programFiles: programFiles.length,
			programParsedAstNodes,
			programReadBytes: evidence.programCompilerHostReadBytes,
			selectedAstNodes
		});

		const programInputAttempts = buildProgramInputAttempts(context, programEvidenceRecords);
		const { parseWitnessBySourceId, parseWitnesses } = buildParseWitnesses(
			context,
			parse.parsedArtifactSeeds,
			evidence,
			language
		);

		const artifacts = buildArtifactRecords(context, orderedArtifactSeeds, parseWitnessBySourceId);
		const artifactIndex = indexArtifactRecords(context, artifacts, terminalArtifactSourceId);
		const { artifactBySourceId, rootArtifact, terminalArtifact } = artifactIndex;
		const aliasHops = buildAliasHopWitnesses(context, aliasHopSeeds, artifactBySourceId);

		const terminalParseWitness = parseWitnessBySourceId.get(terminalArtifact.semanticSourceId)!;
		const declarations = buildDeclarationRecords(
			context,
			terminalDeclarations,
			terminalArtifact,
			terminalParseWitness
		);
		const declarationIds = checkedMap(
			declarations,
			(declaration) => declaration.id,
			assertWithinDeadline
		);

		const terminalSymbolRecord = buildTerminalSymbolRecord(
			context,
			terminalSymbol,
			terminalName,
			terminalArtifact,
			declarations,
			declarationIds
		);
		const exportBinding = buildExportBindingRecord(
			context,
			rootExportSymbol,
			aliasHops,
			exportSymbols.length,
			rootArtifact,
			terminalSymbolRecord
		);

		const merges = buildMergeRecords(
			context,
			declarations,
			declarationIds,
			terminalArtifact,
			terminalSymbolRecord
		);

		const relations = buildRelationRecords(context, declarations, merges, terminalSymbolRecord);

		const programPresentReadFileAttempts = countProgramPresentReadFileAttempts(
			context,
			programEvidenceRecords
		);
		const accounting = assertMaterializedAccounting(
			{
				aliasHops: aliasHops.length,
				artifactReadBytes: evidence.artifactParseReadBytes,
				artifacts: artifacts.length,
				declarations: declarations.length,
				exportSymbols: exportSymbols.length,
				merges: merges.length,
				parseWitnesses: parseWitnesses.length,
				programFiles: programFiles.length,
				programInputAttempts: programInputAttempts.length,
				programParsedAstNodes,
				programReadBytes: evidence.programCompilerHostReadBytes,
				relations: relations.length,
				selectedAstNodes
			},
			prospective
		);
		const { chargedTraversalSteps, inputRecords, outputRecords, readBytes } = accounting;
		const programInputAttemptIds = checkedMap(
			programInputAttempts,
			(attempt) => attempt.id,
			assertWithinDeadline
		);

		const graphWithoutDigest: Omit<DeclarationContextAnalysisSnapshot, 'contentDigest'> = {
			ambientEffectRecords: [],
			analysisAuthority: DECLARATION_CONTEXT_ANALYSIS_AUTHORITY,
			artifacts,
			augmentationRecords: [],
			authorityTransfer: DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER,
			budgets: cloneWire(inputs.request.budgets, assertWithinDeadline),
			canonicalProfile: DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE,
			capability: DECLARATION_CONTEXT_ANALYSIS_CAPABILITY,
			capabilityStatus: DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS,
			closure: 'CLOSED_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_DECLARATION_BINDING',
			conditionalExportResolution: cloneWire(
				inputs.request.conditionalExportResolution,
				assertWithinDeadline
			),
			coverage: {
				aliasHops: aliasHops.length,
				ambientEffectRecords: 0,
				artifactPopulationReconciles: true,
				artifactReadBytes: evidence.artifactParseReadBytes,
				artifactReadWitnesses: artifacts.length,
				artifacts: artifacts.length,
				augmentationRecords: 0,
				chargedTraversalSteps,
				contributesToRelations: declarations.length,
				declarationPopulationReconciles: true,
				declarations: declarations.length,
				declaresRelations: declarations.length,
				diagnosticRecords: 0,
				exportBindings: 1,
				exportSymbolsExamined: exportSymbols.length,
				inputRecords,
				mergePopulationReconciles: true,
				mergeRecords: merges.length as 0 | 1,
				mergesWithRelations: merges.length === 0 ? 0 : declarations.length,
				outputRecords,
				parseWitnessPopulationReconciles: true,
				parseWitnesses: parseWitnesses.length,
				programCompilerInputAttemptPopulationReconciles: true,
				programCompilerInputAttempts: programInputAttempts.length,
				programParsedAstNodePopulationReconciles: true,
				programParsedAstNodes,
				programPresentReadFileAttempts,
				programReadBytes: evidence.programCompilerHostReadBytes,
				programSourceFilePopulationReconciles: true,
				programSourceFiles: programFiles.length,
				readBytes,
				readOperations: programPresentReadFileAttempts + artifacts.length,
				relationPopulationReconciles: true,
				relationRecords: relations.length,
				selectedAstNodePopulationReconciles: true,
				selectedAstNodes,
				selectedExportBindings: 1,
				selectedPackageRootTargets: 1,
				terminalSymbols: 1
			},
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
			moduleResolutionTrace: cloneWire(inputs.request.moduleResolutionTrace, assertWithinDeadline),
			nonclaims: DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS,
			operationVersion: DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
			parseWitnesses,
			programInputAttempts,
			programWitness: {
				attributedCompilerInputAttempts: evidence.attributedInputRecords,
				attributedProgramReadBytes: evidence.attributedReadBytes,
				attributedUniqueQueries: evidence.attributedUniqueQueries,
				captureContextDigest: inputs.semanticSnapshot.contextDigest,
				compilerOptionsDigest,
				compilerVersion: ts.version,
				configPath: bound.configPath,
				materializedRecipeDigest: evidence.materializedRecipeDigest,
				programInputAttemptIds,
				programParsedAstNodes,
				programSourceFiles: programFiles.length,
				programSourcePopulationDigest: independentProgramSourcePopulationDigest(
					programSourceIdentities,
					assertWithinDeadline
				),
				projectContextProgramId: bound.contextProgram.id,
				projectContextProjectId: bound.contextProject.id,
				projectResolutionDigest: evidence.projectResolutionDigest,
				semanticProgramId: bound.semanticProgram.id,
				semanticProjectId: bound.semanticProject.id,
				state: 'FRESH_PUBLIC_TYPESCRIPT_PROGRAM_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE'
			},
			projectContextGraph: cloneWire(inputs.request.projectContextGraph, assertWithinDeadline),
			relations,
			resultCompleteness: 'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_DECLARATION_BINDING',
			schemaVersion: DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION,
			selection: DECLARATION_CONTEXT_ANALYSIS_SELECTION,
			semanticSnapshotId: inputs.semanticSnapshot.id,
			semanticValidationWitness: {
				context: 'FROZEN_SUBJECT',
				frozenSubjectSha256: canonicalSha256(inputs.frozenSubject, assertWithinDeadline),
				method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT',
				semanticSnapshotId: inputs.semanticSnapshot.id,
				semanticSnapshotSha256: canonicalSha256(inputs.semanticSnapshot, assertWithinDeadline),
				state: 'VALID',
				subjectId: inputs.frozenSubject.descriptor.subjectId
			},
			subjectId: inputs.frozenSubject.descriptor.subjectId,
			terminalSymbol: terminalSymbolRecord,
			truncation: { reason: null, state: 'NOT_TRUNCATED' }
		};
		const graph = {
			...graphWithoutDigest,
			contentDigest: domainDigest(
				'JAN-CSAA-DECLARATION-CONTEXT-ANALYSIS-CONTENT',
				graphWithoutDigest,
				assertWithinDeadline
			)
		} as DeclarationContextAnalysisSnapshot;
		assertWithinDeadline();
		return { graph, state: 'VALID' };
	} catch (error) {
		return deriveFailureResult(error);
	}
}

interface ValidationDeadlineState {
	activeDurationMs: number;
	lastObservedAt: number;
	readonly startedAt: number;
}

interface ValidationRun extends ValidationDeadlineState {
	duration: number;
	readonly inputsValue: unknown;
	readonly knownInputDigest: string | undefined;
	readonly limits: ClosedOptions;
	operationDurationMs: number;
	readonly predecessorValidated: boolean;
	readonly provider: Readonly<DeclarationContextAnalysisValidationProvider>;
	readonly value: unknown;
}

function validationRemainingDuration(
	state: ValidationDeadlineState,
	maximum: number
): DeclarationContextAnalysisValidationIssue | number {
	let observed: number;
	try {
		observed = performance.now();
	} catch {
		return issue('INPUT_INVALID', 'The validation monotonic clock failed closed.');
	}
	if (!Number.isFinite(observed) || observed < state.lastObservedAt || observed < state.startedAt)
		return issue('INPUT_INVALID', 'The validation monotonic clock failed closed.');
	state.lastObservedAt = observed;
	const elapsed = Math.floor(observed - state.startedAt);
	if (!safeNonnegative(elapsed))
		return issue('INPUT_INVALID', 'The validation monotonic elapsed time is invalid.');
	const remaining = maximum - elapsed;
	return safePositive(remaining)
		? remaining
		: issue('BUDGET_EXHAUSTED', 'The validation duration budget was exhausted.');
}

function validationDurationIssue(
	state: ValidationDeadlineState,
	maximum: number
): DeclarationContextAnalysisValidationIssue | null {
	const observation = validationRemainingDuration(state, maximum);
	return typeof observation === 'number' ? null : observation;
}

function assertValidationDeadline(state: ValidationDeadlineState): void {
	const problem = validationDurationIssue(state, state.activeDurationMs);
	if (problem !== null) throw new ValidationAbort(problem);
}

function validateCandidateShell(
	run: ValidationRun
): DeclarationContextAnalysisValidationResult | null {
	const candidateTreeIssue = plainTreeIssue(
		run.value,
		{
			maxDepth: run.limits.maxDepth,
			maxRecords: run.limits.maxRecords,
			maxStringCharacters: run.limits.maxStringCharacters
		},
		'$',
		false,
		() => validationDurationIssue(run, run.activeDurationMs)
	);
	if (candidateTreeIssue !== null) return invalid(candidateTreeIssue);
	const duration = validationRemainingDuration(run, run.activeDurationMs);
	if (typeof duration !== 'number') return invalid(duration);
	if (!plainRecord(run.value) || !exactKeys(run.value, SNAPSHOT_KEYS))
		return invalid(
			issue('SHAPE_INVALID', 'The declaration-context analysis snapshot shell must be exact.')
		);
	return null;
}

function validateInputShell(run: ValidationRun): DeclarationContextAnalysisValidationResult | null {
	const broadInputIssue = plainTreeIssue(
		run.inputsValue,
		{
			maxDepth: run.limits.maxDepth,
			maxRecords: run.limits.maxInputRecords,
			maxStringCharacters: run.limits.maxInputStringCharacters
		},
		'$inputs',
		true,
		() => validationDurationIssue(run, run.activeDurationMs)
	);
	if (broadInputIssue !== null) return invalid(broadInputIssue);
	const shellIssue = inputShellIssue(run.inputsValue);
	if (shellIssue !== null) return invalid(shellIssue);
	const shellDuration = validationRemainingDuration(run, run.activeDurationMs);
	if (typeof shellDuration !== 'number') return invalid(shellDuration);
	const inputs = run.inputsValue as DeclarationContextAnalysisBuildInputs;
	const closedRequestIssue = requestIssue(inputs, () => {
		assertValidationDeadline(run);
	});
	if (closedRequestIssue !== null) return invalid(closedRequestIssue);
	run.operationDurationMs = Math.min(
		run.limits.maxDurationMs,
		inputs.request.budgets.maxDurationMs
	);
	run.activeDurationMs = run.operationDurationMs;
	const operationDuration = validationRemainingDuration(run, run.operationDurationMs);
	if (typeof operationDuration !== 'number') return invalid(operationDuration);
	return null;
}

function validateRequestBoundInputs(
	run: ValidationRun
): DeclarationContextAnalysisValidationResult | null {
	const inputs = run.inputsValue as DeclarationContextAnalysisBuildInputs;
	const deadline = (): void => {
		assertValidationDeadline(run);
	};
	const requestInputIssue = plainTreeIssue(
		run.inputsValue,
		{
			maxDepth: run.limits.maxDepth,
			maxRecords: Math.min(run.limits.maxInputRecords, inputs.request.budgets.maxInputRecords),
			maxStringCharacters: Math.min(
				run.limits.maxInputStringCharacters,
				inputs.request.budgets.maxInputStringCharacters
			)
		},
		'$inputs',
		true,
		() => validationDurationIssue(run, run.operationDurationMs)
	);
	if (requestInputIssue !== null) return invalid(requestInputIssue);
	const parsedDuration = validationRemainingDuration(run, run.operationDurationMs);
	if (typeof parsedDuration !== 'number') return invalid(parsedDuration);
	if (!run.predecessorValidated) {
		const problem = predecessorIssue(inputs, run.limits, deadline);
		if (problem !== null) return invalid(problem);
	}
	const predecessorDuration = validationRemainingDuration(run, run.operationDurationMs);
	if (typeof predecessorDuration !== 'number') return invalid(predecessorDuration);
	const bindingProblem = inputBindingIssue(inputs, deadline);
	if (bindingProblem !== null) return invalid(bindingProblem);
	const bindingDuration = validationRemainingDuration(run, run.operationDurationMs);
	if (typeof bindingDuration !== 'number') return invalid(bindingDuration);
	run.duration = bindingDuration;
	return null;
}

function validateAgainstDerivation(
	run: ValidationRun
): DeclarationContextAnalysisValidationResult | null {
	const inputs = run.inputsValue as DeclarationContextAnalysisBuildInputs;
	const deadline = (): void => {
		assertValidationDeadline(run);
	};
	const expected = derive(inputs, run.duration, run.provider, run.knownInputDigest);
	if (expected.state === 'INVALID') return invalid(expected.problem);
	const derivedDuration = validationRemainingDuration(run, run.operationDurationMs);
	if (typeof derivedDuration !== 'number') return invalid(derivedDuration);
	const candidate = run.value as DeclarationContextAnalysisSnapshot;
	if (
		!sameText(candidate.inputDigest, expected.graph.inputDigest, deadline) ||
		!sameText(candidate.id, expected.graph.id, deadline)
	)
		return invalid(
			issue(
				'IDENTITY_MISMATCH',
				'The candidate analysis identities do not reproduce from the exact inputs.'
			)
		);
	const reproducedContentDigest = independentContentDigest(candidate, deadline);
	if (!sameText(candidate.contentDigest, reproducedContentDigest, deadline))
		return invalid(
			issue(
				'CONTENT_DIGEST_MISMATCH',
				'The declaration-context analysis content digest is invalid.',
				'$.contentDigest'
			)
		);
	if (!canonicalEqual(candidate, expected.graph, deadline))
		return invalid(
			issue(
				'DERIVATION_MISMATCH',
				'The candidate differs from the independently replayed declaration-context analysis.'
			)
		);
	const finalDuration = validationRemainingDuration(run, run.operationDurationMs);
	if (typeof finalDuration !== 'number') return invalid(finalDuration);
	return null;
}

function validateInternal(
	value: unknown,
	inputsValue: unknown,
	options: DeclarationContextAnalysisValidationOptions | undefined,
	provider: Readonly<DeclarationContextAnalysisValidationProvider>,
	knownInputDigest?: string,
	predecessorValidated = false
): DeclarationContextAnalysisValidationResult {
	let validationStartedAt: number;
	try {
		validationStartedAt = performance.now();
	} catch {
		return invalid(issue('INPUT_INVALID', 'The validation operation clock is unavailable.'));
	}
	if (!Number.isFinite(validationStartedAt) || validationStartedAt < 0)
		return invalid(issue('INPUT_INVALID', 'The validation operation clock is unavailable.'));
	const limits = closeOptions(options);
	if (limits === null)
		return invalid(issue('SHAPE_INVALID', 'Validation options are invalid.', '$options'));
	const requestDurationMs = earlyRequestDuration(inputsValue);
	const run: ValidationRun = {
		activeDurationMs: Math.min(limits.maxDurationMs, requestDurationMs ?? limits.maxDurationMs),
		duration: 0,
		inputsValue,
		knownInputDigest,
		lastObservedAt: validationStartedAt,
		limits,
		operationDurationMs: limits.maxDurationMs,
		predecessorValidated,
		provider,
		startedAt: validationStartedAt,
		value
	};
	const candidateResult = validateCandidateShell(run);
	if (candidateResult !== null) return candidateResult;
	const inputResult = validateInputShell(run);
	if (inputResult !== null) return inputResult;
	const boundResult = validateRequestBoundInputs(run);
	if (boundResult !== null) return boundResult;
	const derivationResult = validateAgainstDerivation(run);
	if (derivationResult !== null) return derivationResult;
	return { issues: [], state: 'VALID' };
}

export function validateDeclarationContextAnalysis(
	value: unknown,
	inputs: DeclarationContextAnalysisBuildInputs,
	options?: DeclarationContextAnalysisValidationOptions
): DeclarationContextAnalysisValidationResult {
	if (arguments.length < 2 || arguments.length > 3)
		return invalid(
			issue('SHAPE_INVALID', 'The validator requires exactly two or three arguments.', '$arguments')
		);
	try {
		return validateInternal(value, inputs, options, DIRECT_VALIDATION_PROVIDER);
	} catch (error) {
		if (error instanceof ValidationAbort) return invalid(error.problem);
		return invalid(
			issue('SHAPE_INVALID', 'Declaration-context analysis validation failed closed.')
		);
	}
}

/**
 * @internal Immutable per-call defensive provider-fault validation. This entry is
 * intentionally absent from the package root and always executes the complete
 * public predecessor chain. Production entry points never consume its overrides.
 */
export function validateDeclarationContextAnalysisWithProviderForTesting(
	value: unknown,
	inputs: DeclarationContextAnalysisBuildInputs,
	providerOverrides: DeclarationContextAnalysisValidationProviderOverrides,
	options?: DeclarationContextAnalysisValidationOptions
): DeclarationContextAnalysisValidationResult {
	const provider = Object.freeze({
		...DIRECT_VALIDATION_PROVIDER,
		...providerOverrides
	});
	try {
		return validateInternal(value, inputs, options, provider);
	} catch (error) {
		if (error instanceof ValidationAbort) return invalid(error.problem);
		throw error;
	}
}

/**
 * Producer-internal path with a trusted precondition: the exact FrozenSubject,
 * StaticSemanticSnapshot, ProjectContextGraph, ConditionalExportResolution, and
 * ModuleResolutionTrace object graph must have passed the documented CAP-013
 * predecessor chain immediately beforehand: one public semantic validation under
 * the componentwise minimum of the caller, CAP-013, CAP-011, and CAP-010 semantic
 * budgets, followed synchronously by constructed CAP-010, CAP-012, and CAP-011
 * validation over these same unchanged objects. The known digest proves the compact
 * CAP-013 input binding but does not replace that trust precondition. Every CAP-013
 * capture replay, Program/checker derivation, identity, content, and equality check
 * is still repeated independently. Callers without that evidence must use the
 * public validator.
 */
export function validateConstructedDeclarationContextAnalysis(
	value: unknown,
	inputs: DeclarationContextAnalysisBuildInputs,
	knownInputDigest: string,
	options?: DeclarationContextAnalysisValidationOptions
): DeclarationContextAnalysisValidationResult {
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
		return validateInternal(
			value,
			inputs,
			options,
			DIRECT_VALIDATION_PROVIDER,
			knownInputDigest,
			true
		);
	} catch (error) {
		if (error instanceof ValidationAbort) return invalid(error.problem);
		return invalid(
			issue('SHAPE_INVALID', 'Constructed declaration-context analysis validation failed closed.')
		);
	}
}
