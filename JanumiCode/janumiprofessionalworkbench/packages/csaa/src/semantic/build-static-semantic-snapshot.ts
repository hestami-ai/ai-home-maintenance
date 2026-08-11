import { isAbsolute } from 'node:path';
import { isProxy } from 'node:util/types';
import ts from 'typescript';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type CompilerInputObservation,
	type SemanticAssignabilityRequest,
	type SemanticBuildDiagnostic,
	type SemanticBuildDiagnosticCode,
	type SemanticBudgets,
	type SemanticCapability,
	type SemanticTypeQueryMode,
	type StaticSemanticSnapshot,
	type StaticSemanticSnapshotOutcome
} from '../contracts/semantic.js';
import type { FrozenSubject, ProjectSubjectRecord } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import {
	CompilerInputCaptureError,
	issueFrozenCompilerCaptureOperationBudgetWitness,
	normalizeSemanticBudgets,
	recheckCompilerInputJournal,
	type CompilerProjectAttribution,
	type VerifiedCompilerCapture
} from '../providers/typescript/compiler-input-journal.js';
import {
	createCapturingCompilerEnvironment,
	createReplayCompilerEnvironment,
	type CapturingCompilerEnvironment,
	type ExtendedCompilerHost,
	type ReplayCompilerEnvironment
} from '../providers/typescript/frozen-compiler-host.js';
import {
	createStaticRawExtractionBudgetLedger,
	extractStaticRaw,
	finalizeStaticRawExtractionBudgetLedger,
	StaticRawExtractionError,
	type StaticRawDiagnosticFamilyInput,
	type StaticRawExtractionBudgetEvidence
} from '../providers/typescript/extract-static-raw.js';
import {
	MATERIALIZED_ARRAY_PATH_OPTIONS,
	MATERIALIZED_SCALAR_PATH_OPTIONS,
	materializeProgramRecipe,
	ProgramRecipeMaterializationError,
	type MaterializedProgramRecipe
} from '../providers/typescript/materialize-program-recipe.js';
import { assertCanonicalRelativePath, canonicalPathKey } from '../subject/paths.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { isFrozenSubjectCapability } from '../subject/frozen-store.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	isUnicodeScalarString
} from './canonical.js';
import { compilerInputClosureDigest } from './ids.js';
import {
	normalizeStaticSemanticSnapshot,
	SemanticNormalizationError
} from './normalize-semantic-snapshot.js';
import { SemanticOperationBudgetError } from './operation-budget-ledger.js';
import type {
	RawCompilerSourceBinding,
	RawStaticSemanticProjectExtraction
} from './raw-semantic-model.js';
import {
	createStaticSemanticOperationBudgetSession,
	StaticSemanticOperationBudgetSessionError,
	type StaticSemanticOperationBudgetProviderBinding,
	type StaticSemanticOperationBudgetSession
} from './static-semantic-operation-budget-session.js';
import {
	validateStaticSemanticSnapshotWithBudgetEvidence,
	type SemanticValidationOptions
} from './validate-snapshot.js';

const REQUEST_KEYS = [
	'assignabilityRequests',
	'budgets',
	'capabilities',
	'expectEmpty',
	'operationVersion',
	'rootLocator',
	'schemaVersion',
	'subjectId'
] as const;
const BASE_CAPABILITIES = ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const;
const CAPABILITIES = [
	...BASE_CAPABILITIES,
	'TS_TYPE'
] as const satisfies readonly SemanticCapability[];
const TYPE_QUERY_MODES = [
	'TYPE_AT_LOCATION',
	'TYPE_FROM_TYPE_NODE',
	'DECLARED_SYMBOL_TYPE',
	'VALUE_SYMBOL_TYPE_AT_LOCATION'
] as const satisfies readonly SemanticTypeQueryMode[];
const SHA256 = /^[a-f0-9]{64}$/u;

class StaticSemanticBuildFailure extends Error {
	constructor(
		readonly outcome: 'incompatible' | 'unavailable',
		readonly diagnostics: readonly SemanticBuildDiagnostic[]
	) {
		super(diagnostics[0]?.message ?? 'Static semantic snapshot construction failed.');
		this.name = 'StaticSemanticBuildFailure';
	}
}

class StaticSemanticRequestError extends Error {
	constructor(
		readonly code: 'CAPABILITY_UNSUPPORTED' | 'INVALID_REQUEST' | 'UNSUPPORTED_VERSION',
		message: string
	) {
		super(message);
		this.name = 'StaticSemanticRequestError';
	}
}

interface MaterializedProject {
	readonly materialized: MaterializedProgramRecipe;
	readonly project: ProjectSubjectRecord;
}

interface ConstructedProject extends MaterializedProject {
	readonly checker: ts.TypeChecker;
	readonly diagnosticFamilies: readonly StaticRawDiagnosticFamilyInput[];
	readonly host: ExtendedCompilerHost;
	readonly program: ts.Program;
}

interface CompilerEnvironment {
	createProjectHost(
		project: ProjectSubjectRecord['programRecipe'],
		materialized: MaterializedProgramRecipe
	): ExtendedCompilerHost;
}

function diagnostic(
	code: SemanticBuildDiagnosticCode,
	message: string,
	phase: SemanticBuildDiagnostic['phase'],
	path: string | null = null,
	severity: SemanticBuildDiagnostic['severity'] = 'ERROR'
): SemanticBuildDiagnostic {
	return { code, message, path, phase, severity };
}

function compare(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalDiagnostics(
	values: readonly SemanticBuildDiagnostic[]
): SemanticBuildDiagnostic[] {
	return [...values].sort((left, right) =>
		compare(
			`${left.phase}\0${left.path ?? ''}\0${left.code}\0${left.message}`,
			`${right.phase}\0${right.path ?? ''}\0${right.code}\0${right.message}`
		)
	);
}

function safeMessage(error: unknown, rootLocator?: string): string {
	let message =
		error instanceof Error ? error.message : 'Static semantic snapshot construction failed.';
	if (rootLocator !== undefined && rootLocator.length > 0) {
		message = message
			.replaceAll(rootLocator, '<root>')
			.replaceAll(rootLocator.replaceAll('\\', '/'), '<root>');
	}
	return message.replaceAll('\\', '/');
}

function inertRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
	try {
		if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
			throw new StaticSemanticRequestError(
				'INVALID_REQUEST',
				`${label} must be an inert data object.`
			);
		const prototype = Reflect.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null)
			throw new StaticSemanticRequestError(
				'INVALID_REQUEST',
				`${label} must be a plain data object.`
			);
		const result = Object.create(null) as Record<string, unknown>;
		for (const key of Reflect.ownKeys(value)) {
			if (typeof key !== 'string')
				throw new StaticSemanticRequestError(
					'INVALID_REQUEST',
					`${label} must not contain symbol properties.`
				);
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				throw new StaticSemanticRequestError(
					'INVALID_REQUEST',
					`${label}.${key} must be an enumerable data property.`
				);
			result[key] = descriptor.value;
		}
		return result;
	} catch (error) {
		if (error instanceof StaticSemanticRequestError) throw error;
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			`${label} could not be inspected as inert data.`
		);
	}
}

function exactKeys(
	record: Readonly<Record<string, unknown>>,
	expected: readonly string[],
	label: string
): void {
	const actual = Object.keys(record).sort(compare);
	const canonical = [...expected].sort(compare);
	if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index]))
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			`${label} has unknown or missing fields.`
		);
}

function inertArray(value: unknown, label: string, maximumLength: number): readonly unknown[] {
	try {
		if (
			value === null ||
			typeof value !== 'object' ||
			!Array.isArray(value) ||
			isProxy(value) ||
			Reflect.getPrototypeOf(value) !== Array.prototype
		)
			throw new StaticSemanticRequestError(
				'INVALID_REQUEST',
				`${label} must be an inert dense array.`
			);
		const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
		const length =
			lengthDescriptor !== undefined && 'value' in lengthDescriptor
				? lengthDescriptor.value
				: undefined;
		if (
			typeof length !== 'number' ||
			!Number.isSafeInteger(length) ||
			length < 0 ||
			length > maximumLength
		)
			throw new StaticSemanticRequestError(
				'INVALID_REQUEST',
				`${label} exceeds its closed request bound.`
			);
		const keys = Reflect.ownKeys(value);
		if (
			keys.length !== length + 1 ||
			keys.some(
				(key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))
			)
		)
			throw new StaticSemanticRequestError(
				'INVALID_REQUEST',
				`${label} must be dense and contain no expandos.`
			);
		const result: unknown[] = [];
		for (let index = 0; index < length; index += 1) {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				throw new StaticSemanticRequestError(
					'INVALID_REQUEST',
					`${label}[${String(index)}] must be an enumerable data property.`
				);
			result.push(descriptor.value);
		}
		return result;
	} catch (error) {
		if (error instanceof StaticSemanticRequestError) throw error;
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			`${label} could not be inspected as inert data.`
		);
	}
}

function inertCapabilities(value: unknown): readonly SemanticCapability[] {
	try {
		const values = inertArray(value, 'Semantic capabilities', CAPABILITIES.length);
		const capabilities: string[] = [];
		for (let index = 0; index < values.length; index += 1) {
			const capability = values[index];
			if (typeof capability !== 'string')
				throw new StaticSemanticRequestError(
					'INVALID_REQUEST',
					`Semantic capability ${index} is not an inert string.`
				);
			capabilities.push(capability);
		}
		if (
			capabilities.some(
				(capability) => !CAPABILITIES.includes(capability as (typeof CAPABILITIES)[number])
			)
		)
			throw new StaticSemanticRequestError(
				'CAPABILITY_UNSUPPORTED',
				'The semantic request contains an unknown or unavailable capability.'
			);
		const normalized = [...new Set(capabilities)].sort(compare);
		if (BASE_CAPABILITIES.some((capability) => !normalized.includes(capability)))
			throw new StaticSemanticRequestError(
				'CAPABILITY_UNSUPPORTED',
				'The DWP-003 semantic provider requires TS_PROJECT, TS_SYMBOL, and TS_SYNTAX together; TS_TYPE is optional.'
			);
		return normalized as readonly SemanticCapability[];
	} catch (error) {
		if (error instanceof StaticSemanticRequestError) throw error;
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			'Semantic capabilities could not be inspected as inert data.'
		);
	}
}

function materializeTypeSelector(
	value: unknown,
	label: string,
	maxPathCharacters: number
): SemanticAssignabilityRequest['source'] {
	const record = inertRecord(value, label);
	exactKeys(record, ['end', 'logicalPath', 'queryMode', 'start', 'syntaxKind'], label);
	if (typeof record.logicalPath !== 'string' || record.logicalPath.length > maxPathCharacters)
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			`${label}.logicalPath must be a bounded canonical repository-relative path.`
		);
	try {
		assertCanonicalRelativePath(record.logicalPath);
	} catch {
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			`${label}.logicalPath must be a canonical repository-relative path.`
		);
	}
	if (
		typeof record.start !== 'number' ||
		!Number.isSafeInteger(record.start) ||
		record.start < 0 ||
		typeof record.end !== 'number' ||
		!Number.isSafeInteger(record.end) ||
		record.end < record.start ||
		typeof record.syntaxKind !== 'number' ||
		!Number.isSafeInteger(record.syntaxKind) ||
		record.syntaxKind < 0
	)
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			`${label} must contain a valid UTF-16 span and syntax kind.`
		);
	if (
		typeof record.queryMode !== 'string' ||
		!TYPE_QUERY_MODES.includes(record.queryMode as SemanticTypeQueryMode)
	)
		throw new StaticSemanticRequestError('INVALID_REQUEST', `${label}.queryMode is not supported.`);
	return Object.freeze({
		end: record.end,
		logicalPath: record.logicalPath,
		queryMode: record.queryMode as SemanticTypeQueryMode,
		start: record.start,
		syntaxKind: record.syntaxKind
	});
}

function materializeAssignabilityRequests(
	value: unknown,
	budgets: SemanticBudgets
): readonly SemanticAssignabilityRequest[] {
	const values = inertArray(value, 'Semantic assignabilityRequests', budgets.maxCompilerFacts);
	const requests = values.map((entry, index): SemanticAssignabilityRequest => {
		const label = `Semantic assignabilityRequests[${String(index)}]`;
		const record = inertRecord(entry, label);
		exactKeys(record, ['requestId', 'requesterRef', 'source', 'target'], label);
		for (const field of ['requestId', 'requesterRef'] as const)
			if (
				typeof record[field] !== 'string' ||
				record[field].length === 0 ||
				record[field].length > budgets.maxPathCharacters ||
				!isUnicodeScalarString(record[field])
			)
				throw new StaticSemanticRequestError(
					'INVALID_REQUEST',
					`${label}.${field} must be a bounded non-empty Unicode scalar string.`
				);
		return Object.freeze({
			requestId: record.requestId as string,
			requesterRef: record.requesterRef as string,
			source: materializeTypeSelector(record.source, `${label}.source`, budgets.maxPathCharacters),
			target: materializeTypeSelector(record.target, `${label}.target`, budgets.maxPathCharacters)
		});
	});
	requests.sort((left, right) =>
		compare(
			`${left.requestId}\0${canonicalSemanticJson(left)}`,
			`${right.requestId}\0${canonicalSemanticJson(right)}`
		)
	);
	if (new Set(requests.map((request) => request.requestId)).size !== requests.length)
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			'Semantic assignability request IDs must be unique.'
		);
	return Object.freeze(requests);
}

function materializeRequest(value: unknown): BuildStaticSemanticSnapshotRequest {
	const record = inertRecord(value, 'BuildStaticSemanticSnapshotRequest');
	exactKeys(record, REQUEST_KEYS, 'BuildStaticSemanticSnapshotRequest');
	if (
		record.schemaVersion !== SEMANTIC_REQUEST_SCHEMA_VERSION ||
		record.operationVersion !== SEMANTIC_OPERATION_VERSION
	)
		throw new StaticSemanticRequestError(
			'UNSUPPORTED_VERSION',
			'Unsupported semantic request schema or operation version.'
		);
	if (typeof record.expectEmpty !== 'boolean')
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			'Semantic expectEmpty must be boolean.'
		);
	if (
		typeof record.rootLocator !== 'string' ||
		record.rootLocator.length === 0 ||
		!isAbsolute(record.rootLocator)
	)
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			'Semantic rootLocator must be an absolute runtime path.'
		);
	if (typeof record.subjectId !== 'string' || !SHA256.test(record.subjectId))
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			'Semantic subjectId must be a lowercase SHA-256 value.'
		);
	let budgets: SemanticBudgets;
	try {
		budgets = normalizeSemanticBudgets(record.budgets);
	} catch (error) {
		throw new StaticSemanticRequestError('INVALID_REQUEST', safeMessage(error));
	}
	const capabilities = inertCapabilities(record.capabilities);
	const assignabilityRequests = materializeAssignabilityRequests(
		record.assignabilityRequests,
		budgets
	);
	if (assignabilityRequests.length > 0 && !capabilities.includes('TS_TYPE'))
		throw new StaticSemanticRequestError(
			'CAPABILITY_UNSUPPORTED',
			'Assignability requests require the TS_TYPE capability.'
		);
	return Object.freeze({
		assignabilityRequests,
		budgets,
		capabilities,
		expectEmpty: record.expectEmpty,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: record.rootLocator,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: record.subjectId
	});
}

function materializeSubjectOption(value: unknown): FrozenSubject {
	const record = inertRecord(value, 'BuildStaticSemanticSnapshotOptions');
	exactKeys(record, ['subject'], 'BuildStaticSemanticSnapshotOptions');
	if (!isFrozenSubjectCapability(record.subject))
		throw new StaticSemanticRequestError(
			'INVALID_REQUEST',
			'Build options require the exact FrozenSubject capability returned by subject resolution.'
		);
	return record.subject;
}

function assertDeadline(deadlineMs: number): void {
	if (!Number.isSafeInteger(deadlineMs) || Date.now() > deadlineMs)
		throw new StaticSemanticBuildFailure('unavailable', [
			diagnostic(
				'SEMANTIC_BUDGET_EXCEEDED',
				'Static semantic snapshot construction exceeded maxDurationMs.',
				'VALIDATE'
			)
		]);
}

function assertCurrent(
	subject: FrozenSubject,
	request: BuildStaticSemanticSnapshotRequest,
	deadlineMs: number
): void {
	assertDeadline(deadlineMs);
	const freshness = verifyFrozenSubject(subject, { rootLocator: request.rootLocator });
	assertDeadline(deadlineMs);
	if (freshness.state === 'CURRENT') return;
	const mapped = freshness.diagnostics.map((entry): SemanticBuildDiagnostic => ({
		code: entry.code,
		message: entry.message,
		path: entry.path,
		phase: 'FRESHNESS',
		severity: entry.severity
	}));
	if (mapped.length === 0)
		mapped.push(
			diagnostic(
				freshness.state === 'STALE' ? 'COMPILER_CONTEXT_CHANGED' : 'COMPILER_CONTEXT_UNAVAILABLE',
				freshness.state === 'STALE'
					? 'Frozen subject is stale.'
					: 'Frozen subject freshness could not be established.',
				'FRESHNESS'
			)
		);
	throw new StaticSemanticBuildFailure('unavailable', canonicalDiagnostics(mapped));
}

function wireCompilerValue(value: unknown, label: string, ancestors = new Set<object>()): unknown {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
			throw new Error(`${label} contains a non-canonical number.`);
		return value;
	}
	if (value === undefined) return undefined;
	if (typeof value !== 'object' || isProxy(value))
		throw new Error(`${label} contains a non-data compiler value.`);
	if (ancestors.has(value)) throw new Error(`${label} contains a cycle.`);
	ancestors.add(value);
	try {
		if (Array.isArray(value))
			return value.map((entry, index) => wireCompilerValue(entry, `${label}[${index}]`, ancestors));
		const prototype = Reflect.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null)
			throw new Error(`${label} contains a non-plain compiler value.`);
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, entry]) => entry !== undefined)
				.map(([key, entry]) => [key, wireCompilerValue(entry, `${label}.${key}`, ancestors)])
		);
	} finally {
		ancestors.delete(value);
	}
}

function logicalCompilerOptions(
	value: unknown,
	host: ExtendedCompilerHost,
	label: string
): Readonly<Record<string, unknown>> {
	const wired = wireCompilerValue(value, label) as Readonly<Record<string, unknown>>;
	return Object.fromEntries(
		Object.entries(wired).map(([key, entry]) => {
			if (MATERIALIZED_SCALAR_PATH_OPTIONS.has(key) && typeof entry === 'string')
				return [key, host.toLogicalPath(entry)];
			if (MATERIALIZED_ARRAY_PATH_OPTIONS.has(key) && Array.isArray(entry))
				return [
					key,
					entry.map((path) => (typeof path === 'string' ? host.toLogicalPath(path) : path))
				];
			return [key, entry];
		})
	);
}

function assertParsedRecipe(
	parsed: ts.ParsedCommandLine,
	host: ExtendedCompilerHost,
	project: ProjectSubjectRecord
): void {
	const parsedRoots = [...new Set(parsed.fileNames.map((path) => host.toLogicalPath(path)))].sort(
		compare
	);
	const parsedReferences = [
		...new Set(
			(parsed.projectReferences ?? []).map((reference) =>
				host.toLogicalPath(ts.resolveProjectReferencePath(reference))
			)
		)
	].sort(compare);
	if (
		canonicalSemanticJson(parsedRoots) !== canonicalSemanticJson(project.programRecipe.rootNames)
	) {
		throw new ProgramRecipeMaterializationError(
			'INVALID_RECIPE',
			`Parsed configuration roots do not reproduce ProgramRecipe ${project.configPath}.`
		);
	}
	if (
		canonicalSemanticJson(parsedReferences) !==
		canonicalSemanticJson(project.programRecipe.projectReferences)
	) {
		throw new ProgramRecipeMaterializationError(
			'INVALID_RECIPE',
			`Parsed configuration references do not reproduce ProgramRecipe ${project.configPath}.`
		);
	}
	const parsedOptions = logicalCompilerOptions(parsed.options, host, 'Parsed compiler options');
	const recipeOptions = project.programRecipe.compilerOptions;
	if (canonicalSemanticJson(parsedOptions) !== canonicalSemanticJson(recipeOptions)) {
		const mismatches = [...new Set([...Object.keys(parsedOptions), ...Object.keys(recipeOptions)])]
			.sort(compare)
			.filter(
				(key) =>
					canonicalSemanticJson(parsedOptions[key] ?? null) !==
					canonicalSemanticJson(recipeOptions[key] ?? null)
			);
		throw new ProgramRecipeMaterializationError(
			'INVALID_RECIPE',
			`Parsed configuration options do not reproduce ProgramRecipe ${project.configPath}; mismatched keys: ${mismatches.join(', ')}.`
		);
	}
}

function parseConfiguration(
	host: ExtendedCompilerHost,
	project: ProjectSubjectRecord,
	materialized: MaterializedProgramRecipe
): readonly ts.Diagnostic[] {
	const unrecoverable: ts.Diagnostic[] = [];
	const parseHost: ts.ParseConfigFileHost = {
		fileExists: (path) => host.fileExists(path),
		getCurrentDirectory: () => host.getCurrentDirectory(),
		onUnRecoverableConfigFileDiagnostic: (value) => {
			unrecoverable.push(value);
		},
		readDirectory: (rootDir, extensions, excludes, includes, depth) =>
			host.readDirectory(rootDir, extensions, excludes, includes, depth),
		readFile: (path) => host.readFile(path),
		useCaseSensitiveFileNames: host.useCaseSensitiveFileNames()
	};
	const parsed = ts.getParsedCommandLineOfConfigFile(materialized.configFilePath, {}, parseHost);
	if (parsed === undefined)
		throw new ProgramRecipeMaterializationError(
			'INVALID_RECIPE',
			`TypeScript could not reproduce parsed configuration ${project.configPath}.`
		);
	assertParsedRecipe(parsed, host, project);
	return [...unrecoverable, ...parsed.errors];
}

function diagnosticFamily(
	family: StaticRawDiagnosticFamilyInput['family'],
	values: readonly ts.Diagnostic[]
): StaticRawDiagnosticFamilyInput {
	return {
		diagnostics: values,
		family,
		reason:
			values.length === 0
				? 'Family ran and returned zero diagnostics.'
				: `Family ran and returned ${values.length} diagnostic occurrence(s).`,
		state: 'RUN'
	};
}

export function collectStaticDiagnosticFamily(
	family: StaticRawDiagnosticFamilyInput['family'],
	execute: () => readonly ts.Diagnostic[],
	assertWithinDeadline: () => void
): StaticRawDiagnosticFamilyInput {
	assertWithinDeadline();
	try {
		const values = execute();
		assertWithinDeadline();
		return diagnosticFamily(family, values);
	} catch (error) {
		if (
			error instanceof StaticSemanticBuildFailure ||
			error instanceof CompilerInputCaptureError ||
			error instanceof ProgramRecipeMaterializationError
		)
			throw error;
		assertWithinDeadline();
		return {
			diagnostics: [],
			family,
			reason: `${family} diagnostic execution failed without usable results.`,
			state: 'FAILED'
		};
	}
}

function constructProject(
	environment: CompilerEnvironment,
	entry: MaterializedProject,
	assertWithinDeadline: () => void
): ConstructedProject {
	assertWithinDeadline();
	const host = environment.createProjectHost(entry.project.programRecipe, entry.materialized);
	const configurationDiagnostics = parseConfiguration(host, entry.project, entry.materialized);
	assertWithinDeadline();
	const program = ts.createProgram({
		configFileParsingDiagnostics: configurationDiagnostics,
		host,
		options: entry.materialized.compilerOptions,
		projectReferences: entry.materialized.projectReferences,
		rootNames: entry.materialized.rootNames
	});
	const checker = program.getTypeChecker();
	const diagnosticFamilies: readonly StaticRawDiagnosticFamilyInput[] = [
		collectStaticDiagnosticFamily(
			'CONFIGURATION',
			() => program.getConfigFileParsingDiagnostics(),
			assertWithinDeadline
		),
		collectStaticDiagnosticFamily(
			'OPTIONS',
			() => program.getOptionsDiagnostics(),
			assertWithinDeadline
		),
		collectStaticDiagnosticFamily(
			'GLOBAL',
			() => program.getGlobalDiagnostics(),
			assertWithinDeadline
		),
		collectStaticDiagnosticFamily(
			'SYNTACTIC',
			() => program.getSyntacticDiagnostics(),
			assertWithinDeadline
		),
		collectStaticDiagnosticFamily(
			'SEMANTIC',
			() => program.getSemanticDiagnostics(),
			assertWithinDeadline
		),
		collectStaticDiagnosticFamily(
			'DECLARATION',
			() => program.getDeclarationDiagnostics(),
			assertWithinDeadline
		)
	];
	assertWithinDeadline();
	return { ...entry, checker, diagnosticFamilies, host, program };
}

function aliasMappedArtifactPath(
	subject: FrozenSubject,
	logicalPath: string,
	caseSensitive: boolean
): string {
	const pathKey = canonicalPathKey(logicalPath, caseSensitive);
	const aliases = subject.workspaces
		.map((workspace) => ({ alias: `node_modules/${workspace.name}`, target: workspace.path }))
		.sort(
			(left, right) => right.alias.length - left.alias.length || compare(left.alias, right.alias)
		);
	for (const entry of aliases) {
		const aliasKey = canonicalPathKey(entry.alias, caseSensitive);
		if (pathKey === aliasKey) return entry.target;
		if (pathKey.startsWith(`${aliasKey}/`))
			return `${entry.target}/${logicalPath.slice(entry.alias.length + 1)}`;
	}
	return logicalPath;
}

function compilerSourceResolver(
	subject: FrozenSubject,
	capture: Pick<VerifiedCompilerCapture, 'observations'>,
	attribution: CompilerProjectAttribution,
	verificationState: RawCompilerSourceBinding['verificationState']
): (logicalPath: string) => RawCompilerSourceBinding | undefined {
	const ids = new Set(attribution.contextInputIds);
	const reads = capture.observations.filter(
		(
			observation
		): observation is Extract<
			CompilerInputObservation,
			{ operation: 'READ_FILE'; result: 'PRESENT' }
		> =>
			ids.has(observation.id) &&
			observation.operation === 'READ_FILE' &&
			observation.result === 'PRESENT'
	);
	const caseObservation = capture.observations.find(
		(observation) => observation.operation === 'USE_CASE_SENSITIVE_FILE_NAMES'
	);
	const caseSensitive = caseObservation?.result !== 'CASE_INSENSITIVE';
	return (logicalPath): RawCompilerSourceBinding | undefined => {
		const matches = reads.filter((observation) => observation.logicalPath === logicalPath);
		if (matches.length !== 1) return undefined;
		const observation = matches[0]!;
		if (observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT') {
			return {
				artifact: null,
				byteBudgetClass: observation.byteBudgetClass,
				bytes: observation.contentBytes,
				contentSha256: observation.contentSha256,
				logicalPath,
				mapping: {
					reason:
						'Compiler context is represented directly; source-coordinate mapping is not applicable.',
					state: 'NOT_APPLICABLE'
				},
				origin: observation.origin,
				verificationState
			};
		}
		const artifactPath = aliasMappedArtifactPath(subject, logicalPath, caseSensitive);
		const key = canonicalPathKey(artifactPath, caseSensitive);
		const artifacts = subject.artifacts.filter(
			(artifact) =>
				artifact.canonicalPathKey === key && (!caseSensitive || artifact.path === artifactPath)
		);
		if (artifacts.length !== 1) return undefined;
		const artifact = artifacts[0]!;
		return {
			artifact: {
				disposition: artifact.disposition,
				primaryClass: artifact.primaryClass,
				roles: [...artifact.roles]
			},
			byteBudgetClass: observation.byteBudgetClass,
			bytes: observation.contentBytes,
			contentSha256: observation.contentSha256,
			logicalPath,
			mapping: { reason: 'Exact frozen-subject artifact match.', state: 'EXACT' },
			origin: observation.origin,
			verificationState
		};
	};
}

interface RawProjectionDigest {
	readonly assignabilityContexts: readonly string[];
	readonly components: Readonly<Record<string, string>>;
	readonly projectKey: string;
	readonly sha256: string;
	readonly symbolNames: readonly string[];
}

interface ProjectSourceEvidence {
	readonly assertConsumed?: () => void;
	readonly attribution: CompilerProjectAttribution;
	readonly observations: readonly CompilerInputObservation[];
	readonly verificationState: RawCompilerSourceBinding['verificationState'];
}

function bindFinalCheckerContext(
	raw: RawStaticSemanticProjectExtraction,
	checkerContextDigest: string
): RawStaticSemanticProjectExtraction {
	if (!raw.typeRelations.some((relation) => relation.kind === 'ASSIGNABILITY')) return raw;
	return {
		...raw,
		typeRelations: raw.typeRelations.map((relation) =>
			relation.kind === 'ASSIGNABILITY' ? { ...relation, checkerContextDigest } : relation
		)
	};
}

function rawProjectionDigest(raw: RawStaticSemanticProjectExtraction): RawProjectionDigest {
	const { evidenceState: _evidenceState, ...projection } = raw;
	const components: Record<string, string> = Object.fromEntries(
		Object.entries(projection).map(([key, value]) => [
			key,
			sha256(`JAN-CSAA-RAW-REPLAY-COMPONENT\0${key}\0${canonicalSemanticJson(value)}`)
		])
	);
	const symbolFields = {
		declarationOrdinals: raw.symbols.map((record) => record.declarationOrdinals),
		fallbackReferenceNodes: raw.symbols.map((record) => record.fallbackReferenceNodes),
		flagNames: raw.symbols.map((record) => record.flagNames),
		flags: raw.symbols.map((record) => record.flags),
		name: raw.symbols.map((record) => record.name),
		valueDeclarationOrdinal: raw.symbols.map((record) => record.valueDeclarationOrdinal)
	};
	for (const [key, value] of Object.entries(symbolFields)) {
		components[`symbols.${key}`] = sha256(
			`JAN-CSAA-RAW-REPLAY-COMPONENT\0symbols.${key}\0${canonicalSemanticJson(value)}`
		);
	}
	return {
		assignabilityContexts: raw.typeRelations
			.filter((relation) => relation.kind === 'ASSIGNABILITY')
			.map((relation) =>
				canonicalSemanticJson({
					checkerContextDigest: relation.checkerContextDigest,
					requestIdSha256: sha256(relation.requestId),
					result: relation.result,
					sourceTypeOrdinal: relation.sourceTypeOrdinal,
					state: relation.state,
					targetTypeOrdinal: relation.targetTypeOrdinal
				})
			)
			.sort(compare),
		components,
		projectKey: raw.project.configPath,
		sha256: sha256(`JAN-CSAA-RAW-REPLAY\0${canonicalSemanticJson(projection)}`),
		symbolNames: raw.symbols.map((record) => record.name)
	};
}

function rawProjectionMismatchSummary(
	capture: readonly RawProjectionDigest[],
	replay: readonly RawProjectionDigest[]
): string {
	const replayByProject = new Map(replay.map((entry) => [entry.projectKey, entry] as const));
	const mismatches: string[] = [];
	for (const captured of capture) {
		const reproduced = replayByProject.get(captured.projectKey);
		if (reproduced === undefined) {
			mismatches.push(`${captured.projectKey} [missing-project]`);
			continue;
		}
		if (captured.sha256 === reproduced.sha256) continue;
		const componentNames = [
			...new Set([...Object.keys(captured.components), ...Object.keys(reproduced.components)])
		].sort(compare);
		const changed = componentNames.filter(
			(component) => captured.components[component] !== reproduced.components[component]
		);
		const nameSamples = changed.includes('symbols.name')
			? captured.symbolNames
					.flatMap((name, index) =>
						name === reproduced.symbolNames[index]
							? []
							: [
									`${String(index)}:${JSON.stringify(name.slice(0, 80))}->${JSON.stringify((reproduced.symbolNames[index] ?? '<missing>').slice(0, 80))}`
								]
					)
					.slice(0, 3)
			: [];
		const assignabilitySamples = changed.includes('typeRelations')
			? captured.assignabilityContexts
					.flatMap((value, index) =>
						value === reproduced.assignabilityContexts[index]
							? []
							: [
									`${String(index)}:${value}->${reproduced.assignabilityContexts[index] ?? '<missing>'}`
								]
					)
					.slice(0, 3)
			: [];
		mismatches.push(
			`${captured.projectKey} [${changed.join(', ') || 'unknown-component'}]${nameSamples.length === 0 ? '' : ` {${nameSamples.join(', ')}}`}${assignabilitySamples.length === 0 ? '' : ` {assignability:${assignabilitySamples.join(', ')}}`}`
		);
	}
	const captureProjects = new Set(capture.map((entry) => entry.projectKey));
	for (const reproduced of replay) {
		if (!captureProjects.has(reproduced.projectKey))
			mismatches.push(`${reproduced.projectKey} [unexpected-project]`);
	}
	return mismatches.slice(0, 5).join('; ');
}

function extractProjectResult<T>(
	environment: CompilerEnvironment,
	entry: MaterializedProject,
	subject: FrozenSubject,
	budgets: SemanticBudgets,
	assignabilityRequests: readonly SemanticAssignabilityRequest[],
	includeTypes: boolean,
	budgetLedger: ReturnType<typeof createStaticRawExtractionBudgetLedger>,
	deadlineMs: number,
	assertWithinDeadline: () => void,
	evidenceForProject: (projectKey: string) => ProjectSourceEvidence,
	projectResult: (raw: RawStaticSemanticProjectExtraction) => T
): T {
	const constructed = constructProject(environment, entry, assertWithinDeadline);
	const evidence = evidenceForProject(entry.project.configPath);
	if (evidence.attribution.projectKey !== entry.project.configPath)
		throw new CompilerInputCaptureError(
			'INVALID_CAPTURE',
			`Compiler evidence lacks project attribution ${entry.project.configPath}.`
		);
	const result = extractStaticRaw({
		assignabilityRequests,
		assertWithinDeadline,
		budgetLedger,
		budgets,
		checker: constructed.checker,
		deadlineMs,
		diagnosticFamilies: constructed.diagnosticFamilies,
		evidenceState: evidence.verificationState,
		includeTypes,
		program: constructed.program,
		programRecipe: constructed.project.programRecipe,
		project: constructed.project,
		projectKey: constructed.project.configPath,
		resolveCheckerContextDigest: () =>
			compilerInputClosureDigest(evidenceForProject(entry.project.configPath).observations),
		resolveCompilerSource: compilerSourceResolver(
			subject,
			evidence,
			evidence.attribution,
			evidence.verificationState
		),
		toLogicalPath: (path) => constructed.host.toLogicalPath(path)
	});
	evidence.assertConsumed?.();
	assertWithinDeadline();
	return projectResult(result);
}

interface StaticRawExtractionPass<T> {
	readonly budgetEvidence: StaticRawExtractionBudgetEvidence;
	readonly results: T[];
}

function extractPass<T>(
	environment: CompilerEnvironment,
	projects: readonly MaterializedProject[],
	subject: FrozenSubject,
	budgets: SemanticBudgets,
	assignabilityRequests: readonly SemanticAssignabilityRequest[],
	includeTypes: boolean,
	budgetPhase: 'CAPTURE' | 'EXTRACT',
	providerBinding: StaticSemanticOperationBudgetProviderBinding,
	deadlineMs: number,
	assertWithinDeadline: () => void,
	evidenceForProject: (projectKey: string) => ProjectSourceEvidence,
	projectResult: (raw: RawStaticSemanticProjectExtraction) => T
): StaticRawExtractionPass<T> {
	const budgetLedger = createStaticRawExtractionBudgetLedger(budgets, budgetPhase, providerBinding);
	const results: T[] = [];
	for (const entry of projects) {
		assertWithinDeadline();
		results.push(
			extractProjectResult(
				environment,
				entry,
				subject,
				budgets,
				assignabilityRequests,
				includeTypes,
				budgetLedger,
				deadlineMs,
				assertWithinDeadline,
				evidenceForProject,
				projectResult
			)
		);
		assertWithinDeadline();
	}
	return {
		budgetEvidence: finalizeStaticRawExtractionBudgetLedger(budgetLedger),
		results
	};
}

function validationOptions(budgets: SemanticBudgets): SemanticValidationOptions {
	const bounded = (value: number): number =>
		Number.isSafeInteger(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
	const recordLimit = bounded(
		budgets.maxAstNodes +
			budgets.maxScopes +
			budgets.maxSources +
			budgets.maxDiagnostics +
			budgets.maxProjects * 4 +
			budgets.maxCompilerQueries +
			budgets.maxCompilerFacts +
			17
	);
	return {
		maxDepth: Math.max(256, Math.min(4_096, budgets.maxAstDepth + 128)),
		maxDiagnostics: budgets.maxDiagnostics,
		maxIssues: Math.max(1_000, Math.min(100_000, budgets.maxDiagnostics)),
		maxRecords: Math.max(recordLimit, budgets.maxSnapshotBytes),
		maxReferenceChecks: Math.max(recordLimit, budgets.maxSnapshotBytes),
		maxStringCharacters: budgets.maxSnapshotBytes
	};
}

function deepFreeze<T>(value: T): T {
	const pending: unknown[] = [value];
	while (pending.length > 0) {
		const current = pending.pop();
		if (current === null || typeof current !== 'object' || Object.isFrozen(current)) continue;
		Object.freeze(current);
		if (Array.isArray(current)) {
			for (let index = 0; index < current.length; index += 1) pending.push(current[index]);
		} else {
			for (const key of Reflect.ownKeys(current)) {
				const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
				if (descriptor !== undefined && 'value' in descriptor) pending.push(descriptor.value);
			}
		}
	}
	return value;
}

function partialDiagnostics(snapshot: StaticSemanticSnapshot): SemanticBuildDiagnostic[] {
	return canonicalDiagnostics(
		snapshot.projects.flatMap((project) =>
			project.partialityReasons.map((reason) =>
				diagnostic(
					reason.code === 'CONTEXT_FRESHNESS_UNKNOWN'
						? 'COMPILER_CONTEXT_UNAVAILABLE'
						: reason.code === 'FRAMEWORK_CANDIDATES_UNSUPPORTED'
							? 'CAPABILITY_UNSUPPORTED'
							: reason.code,
					reason.message,
					'EXTRACT',
					reason.path,
					'WARNING'
				)
			)
		)
	);
}

function mapFailure(
	error: unknown,
	phase: SemanticBuildDiagnostic['phase'],
	rootLocator?: string
): StaticSemanticBuildFailure {
	if (error instanceof StaticSemanticBuildFailure) return error;
	const message = safeMessage(error, rootLocator);
	if (error instanceof StaticSemanticRequestError) {
		const code: SemanticBuildDiagnosticCode =
			error.code === 'CAPABILITY_UNSUPPORTED'
				? 'CAPABILITY_UNSUPPORTED'
				: error.code === 'UNSUPPORTED_VERSION'
					? 'COMPILER_VERSION_MISMATCH'
					: 'SEMANTIC_VALIDATION_FAILED';
		return new StaticSemanticBuildFailure('incompatible', [diagnostic(code, message, 'REQUEST')]);
	}
	if (error instanceof ProgramRecipeMaterializationError) {
		const code: SemanticBuildDiagnosticCode =
			error.code === 'VERSION_MISMATCH'
				? 'COMPILER_VERSION_MISMATCH'
				: error.code === 'PATH_ESCAPE'
					? 'COMPILER_CONTEXT_FORBIDDEN'
					: 'PROGRAM_RECIPE_MISMATCH';
		return new StaticSemanticBuildFailure(
			error.code === 'VERSION_MISMATCH' || error.code === 'INVALID_RECIPE'
				? 'incompatible'
				: 'unavailable',
			[diagnostic(code, message, phase)]
		);
	}
	if (error instanceof CompilerInputCaptureError) {
		const code: SemanticBuildDiagnosticCode =
			error.code === 'BUDGET_EXCEEDED'
				? 'SEMANTIC_BUDGET_EXCEEDED'
				: error.code === 'CONTEXT_CHANGED' ||
					  error.code === 'UNCONSUMED_QUERY' ||
					  error.code === 'UNRECORDED_QUERY'
					? 'COMPILER_CONTEXT_CHANGED'
					: error.code === 'CONTEXT_UNAVAILABLE'
						? 'COMPILER_CONTEXT_UNAVAILABLE'
						: error.code === 'FROZEN_BYTES_UNAVAILABLE'
							? 'FROZEN_BYTES_UNAVAILABLE'
							: error.code === 'INVALID_QUERY'
								? 'PROGRAM_RECIPE_MISMATCH'
								: 'SEMANTIC_VALIDATION_FAILED';
		return new StaticSemanticBuildFailure(
			error.code === 'INVALID_QUERY' ? 'incompatible' : 'unavailable',
			[diagnostic(code, message, phase)]
		);
	}
	if (
		error instanceof StaticSemanticOperationBudgetSessionError ||
		error instanceof SemanticOperationBudgetError
	) {
		return new StaticSemanticBuildFailure('unavailable', [
			diagnostic(
				error.code === 'BUDGET_EXCEEDED' ||
					(error instanceof SemanticOperationBudgetError && error.limitKey !== null)
					? 'SEMANTIC_BUDGET_EXCEEDED'
					: 'SEMANTIC_VALIDATION_FAILED',
				message,
				error.phase ?? phase
			)
		]);
	}
	if (error instanceof StaticRawExtractionError) {
		const code: SemanticBuildDiagnosticCode =
			error.code === 'BUDGET_EXCEEDED' || error.code === 'DEADLINE_EXCEEDED'
				? 'SEMANTIC_BUDGET_EXCEEDED'
				: error.code === 'IDENTITY_MISMATCH'
					? 'PROGRAM_RECIPE_MISMATCH'
					: error.code === 'SOURCE_EVIDENCE_MISSING'
						? 'FROZEN_BYTES_UNAVAILABLE'
						: error.code === 'PATH_MAPPING_FAILED' || error.code === 'SOURCE_POLICY_MISMATCH'
							? 'COMPILER_CONTEXT_FORBIDDEN'
							: 'SEMANTIC_VALIDATION_FAILED';
		return new StaticSemanticBuildFailure(
			error.code === 'IDENTITY_MISMATCH' || error.code === 'INVALID_INPUT'
				? 'incompatible'
				: 'unavailable',
			[diagnostic(code, message, 'EXTRACT', error.path)]
		);
	}
	if (error instanceof SemanticNormalizationError) {
		return new StaticSemanticBuildFailure('unavailable', [
			diagnostic(
				error.code === 'BUDGET_EXCEEDED'
					? 'SEMANTIC_BUDGET_EXCEEDED'
					: 'SEMANTIC_VALIDATION_FAILED',
				message,
				'VALIDATE'
			)
		]);
	}
	return new StaticSemanticBuildFailure('unavailable', [
		diagnostic(
			phase === 'PROGRAM' ? 'PROGRAM_CREATION_FAILED' : 'SEMANTIC_VALIDATION_FAILED',
			message,
			phase
		)
	]);
}

export function buildStaticSemanticSnapshot(
	requestValue: unknown,
	optionsValue: { readonly subject: FrozenSubject }
): StaticSemanticSnapshotOutcome {
	const startedAtMs = Date.now();
	let request: BuildStaticSemanticSnapshotRequest | undefined;
	let phase: SemanticBuildDiagnostic['phase'] = 'REQUEST';
	try {
		request = materializeRequest(requestValue);
		const subject = materializeSubjectOption(optionsValue);
		const operationBudgetSession: StaticSemanticOperationBudgetSession =
			createStaticSemanticOperationBudgetSession(request.budgets, startedAtMs);
		const operationBudgetProviderBinding = operationBudgetSession.providerBinding();
		const deadlineMs = startedAtMs + request.budgets.maxDurationMs;
		if (!Number.isSafeInteger(startedAtMs) || !Number.isSafeInteger(deadlineMs))
			throw new StaticSemanticBuildFailure('unavailable', [
				diagnostic(
					'SEMANTIC_BUDGET_EXCEEDED',
					'Semantic operation deadline is not a safe integer.',
					'REQUEST'
				)
			]);
		const assertWithinDeadline = (): void => {
			operationBudgetSession.checkpoint(phase);
			assertDeadline(deadlineMs);
		};
		assertWithinDeadline();
		if (ts.version !== TYPESCRIPT_PROVIDER_VERSION)
			throw new StaticSemanticBuildFailure('incompatible', [
				diagnostic(
					'COMPILER_VERSION_MISMATCH',
					`The DWP-003 semantic snapshot requires TypeScript ${TYPESCRIPT_PROVIDER_VERSION}; runtime is ${ts.version}.`,
					'MATERIALIZE'
				)
			]);
		if (subject.descriptor.subjectId !== request.subjectId)
			throw new StaticSemanticBuildFailure('incompatible', [
				diagnostic(
					'SUBJECT_ID_MISMATCH',
					'Semantic request does not bind the supplied FrozenSubject.',
					'REQUEST'
				)
			]);

		phase = 'FRESHNESS';
		assertCurrent(subject, request, deadlineMs);
		phase = 'MATERIALIZE';
		if (subject.projects.length > request.budgets.maxProjects)
			throw new StaticSemanticBuildFailure('unavailable', [
				diagnostic(
					'SEMANTIC_BUDGET_EXCEEDED',
					'Frozen project population exceeds maxProjects.',
					phase
				)
			]);
		const materializedProjects: MaterializedProject[] = [];
		for (const project of [...subject.projects].sort((left, right) =>
			compare(left.configPath, right.configPath)
		)) {
			assertWithinDeadline();
			materializedProjects.push({
				materialized: materializeProgramRecipe(project.programRecipe, request.rootLocator),
				project
			});
		}
		assertWithinDeadline();
		operationBudgetSession.acceptMaterializedSubject(subject);

		phase = 'CAPTURE';
		const captureEnvironment: CapturingCompilerEnvironment = createCapturingCompilerEnvironment(
			subject,
			request.rootLocator,
			request.budgets,
			startedAtMs
		);
		phase = 'PROGRAM';
		const capturePass = extractPass(
			captureEnvironment,
			materializedProjects,
			subject,
			request.budgets,
			request.assignabilityRequests,
			request.capabilities.includes('TS_TYPE'),
			'CAPTURE',
			operationBudgetProviderBinding,
			deadlineMs,
			assertWithinDeadline,
			(projectKey) => ({
				...captureEnvironment.currentProjectEvidence(projectKey),
				verificationState: 'CAPTURED_COMPILER_INPUT'
			}),
			(raw) => raw
		);
		const captureProjectionDigests = capturePass.results.map((raw) => {
			const finalProjectEvidence = captureEnvironment.currentProjectEvidence(
				raw.project.configPath
			);
			return rawProjectionDigest(
				bindFinalCheckerContext(raw, compilerInputClosureDigest(finalProjectEvidence.observations))
			);
		});
		phase = 'CAPTURE';
		const frozenCapture = captureEnvironment.finalizeCapture();
		operationBudgetSession.acceptCompilerInputWitness(
			'CAPTURE',
			issueFrozenCompilerCaptureOperationBudgetWitness(
				operationBudgetProviderBinding,
				frozenCapture
			)
		);
		operationBudgetSession.acceptRawExtractionEvidence('CAPTURE', capturePass.budgetEvidence);
		assertWithinDeadline();
		phase = 'RECHECK';
		const verifiedCapture = recheckCompilerInputJournal(frozenCapture);
		assertWithinDeadline();
		phase = 'FRESHNESS';
		assertCurrent(subject, request, deadlineMs);

		phase = 'RECHECK';
		const replayEnvironment: ReplayCompilerEnvironment = createReplayCompilerEnvironment(
			subject,
			verifiedCapture
		);
		phase = 'PROGRAM';
		const replayPass = extractPass(
			replayEnvironment,
			materializedProjects,
			subject,
			request.budgets,
			request.assignabilityRequests,
			request.capabilities.includes('TS_TYPE'),
			'EXTRACT',
			operationBudgetProviderBinding,
			deadlineMs,
			assertWithinDeadline,
			(projectKey) => {
				const attribution = verifiedCapture.projectAttributions.find(
					(candidate) => candidate.projectKey === projectKey
				);
				if (attribution === undefined)
					throw new CompilerInputCaptureError(
						'INVALID_CAPTURE',
						`Verified capture lacks project attribution ${projectKey}.`
					);
				const contextInputIds = new Set(attribution.contextInputIds);
				return {
					assertConsumed: () => replayEnvironment.assertProjectConsumed(projectKey),
					attribution,
					observations: verifiedCapture.observations.filter((observation) =>
						contextInputIds.has(observation.id)
					),
					verificationState: 'VERIFIED_COMPILER_INPUT'
				};
			},
			(raw) => raw
		);
		const replayRaw = replayPass.results;
		phase = 'RECHECK';
		replayEnvironment.assertFullyConsumed();
		operationBudgetSession.acceptCompilerInputWitness(
			'RECHECK',
			replayEnvironment.issueRecheckOperationBudgetWitness(operationBudgetProviderBinding)
		);
		operationBudgetSession.acceptRawExtractionEvidence('EXTRACT', replayPass.budgetEvidence);
		assertWithinDeadline();
		phase = 'FRESHNESS';
		assertCurrent(subject, request, deadlineMs);
		phase = 'VALIDATE';
		const replayProjectionDigests = replayRaw.map(rawProjectionDigest);
		if (
			canonicalSemanticJson(captureProjectionDigests) !==
			canonicalSemanticJson(replayProjectionDigests)
		)
			throw new StaticSemanticBuildFailure('unavailable', [
				diagnostic(
					'COMPILER_CONTEXT_CHANGED',
					`Capture and replay produced different canonical identity-free semantic projection digests: ${rawProjectionMismatchSummary(captureProjectionDigests, replayProjectionDigests)}.`,
					'RECHECK'
				)
			]);
		assertWithinDeadline();

		const snapshot = normalizeStaticSemanticSnapshot({
			capture: verifiedCapture,
			projects: replayRaw,
			request,
			subject
		});
		replayRaw.length = 0;
		assertWithinDeadline();
		const finalSnapshot = deepFreeze(snapshot);
		const canonicalWitness = canonicalSemanticJsonWitness(finalSnapshot);
		if (canonicalWitness.bytes > request.budgets.maxSnapshotBytes)
			throw new StaticSemanticBuildFailure('unavailable', [
				diagnostic(
					'SEMANTIC_BUDGET_EXCEEDED',
					'Canonical semantic snapshot exceeds maxSnapshotBytes.',
					'VALIDATE'
				)
			]);
		assertWithinDeadline();
		const validatorOptions = validationOptions(request.budgets);
		const validationEvidence = validateStaticSemanticSnapshotWithBudgetEvidence(
			finalSnapshot,
			operationBudgetProviderBinding,
			validatorOptions,
			{ frozenSubject: subject }
		);
		const validation = validationEvidence.validation;
		if (validation.state !== 'VALID') {
			const sample = validation.issues
				.slice(0, 3)
				.map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`)
				.join('; ');
			throw new StaticSemanticBuildFailure('unavailable', [
				diagnostic(
					'SEMANTIC_VALIDATION_FAILED',
					`Semantic snapshot failed exact closed-wire validation with ${validation.issues.length} issue(s): ${sample}`,
					'VALIDATE'
				)
			]);
		}
		if (validationEvidence.evidence === null)
			throw new StaticSemanticBuildFailure('unavailable', [
				diagnostic(
					'SEMANTIC_VALIDATION_FAILED',
					'Valid semantic snapshot did not produce validator-owned budget evidence.',
					'VALIDATE'
				)
			]);
		operationBudgetSession.acceptValidationEvidence(finalSnapshot, validationEvidence.evidence);
		assertWithinDeadline();
		phase = 'FRESHNESS';
		assertCurrent(subject, request, deadlineMs);
		assertWithinDeadline();
		const diagnostics = finalSnapshot.health === 'PARTIAL' ? partialDiagnostics(finalSnapshot) : [];
		assertWithinDeadline();
		operationBudgetSession.finalize();
		return finalSnapshot.health === 'PARTIAL'
			? { diagnostics, outcome: 'partial', snapshot: finalSnapshot }
			: { diagnostics, outcome: 'complete', snapshot: finalSnapshot };
	} catch (error) {
		const failure = mapFailure(error, phase, request?.rootLocator);
		return { diagnostics: canonicalDiagnostics(failure.diagnostics), outcome: failure.outcome };
	}
}
