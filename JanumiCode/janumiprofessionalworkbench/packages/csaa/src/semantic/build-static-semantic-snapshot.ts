import { isAbsolute } from 'node:path';
import { isProxy } from 'node:util/types';
import ts from 'typescript';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type CompilerInputObservation,
	type SemanticBuildDiagnostic,
	type SemanticBuildDiagnosticCode,
	type SemanticBudgets,
	type StaticSemanticSnapshot,
	type StaticSemanticSnapshotOutcome
} from '../contracts/semantic.js';
import type { FrozenSubject, ProjectSubjectRecord } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import {
	CompilerInputCaptureError,
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
	StaticRawExtractionError,
	type StaticRawDiagnosticFamilyInput
} from '../providers/typescript/extract-static-raw.js';
import {
	MATERIALIZED_ARRAY_PATH_OPTIONS,
	MATERIALIZED_SCALAR_PATH_OPTIONS,
	materializeProgramRecipe,
	ProgramRecipeMaterializationError,
	type MaterializedProgramRecipe
} from '../providers/typescript/materialize-program-recipe.js';
import { canonicalPathKey } from '../subject/paths.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { isFrozenSubjectCapability } from '../subject/frozen-store.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from './canonical.js';
import { normalizeStaticSemanticSnapshot, SemanticNormalizationError } from './normalize-semantic-snapshot.js';
import type { RawCompilerSourceBinding, RawStaticSemanticProjectExtraction } from './raw-semantic-model.js';
import { validateStaticSemanticSnapshot, type SemanticValidationOptions } from './validate-snapshot.js';

const REQUEST_KEYS = ['budgets', 'capabilities', 'expectEmpty', 'operationVersion', 'rootLocator', 'schemaVersion', 'subjectId'] as const;
const CAPABILITIES = ['TS_PROJECT', 'TS_SYNTAX'] as const;
const SHA256 = /^[a-f0-9]{64}$/u;

class StaticSemanticBuildFailure extends Error {
	constructor(readonly outcome: 'incompatible' | 'unavailable', readonly diagnostics: readonly SemanticBuildDiagnostic[]) {
		super(diagnostics[0]?.message ?? 'Static semantic snapshot construction failed.');
		this.name = 'StaticSemanticBuildFailure';
	}
}

class StaticSemanticRequestError extends Error {
	constructor(readonly code: 'CAPABILITY_UNSUPPORTED' | 'INVALID_REQUEST' | 'UNSUPPORTED_VERSION', message: string) {
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
	createProjectHost(project: ProjectSubjectRecord['programRecipe'], materialized: MaterializedProgramRecipe): ExtendedCompilerHost;
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

function canonicalDiagnostics(values: readonly SemanticBuildDiagnostic[]): SemanticBuildDiagnostic[] {
	return [...values].sort((left, right) => compare(`${left.phase}\0${left.path ?? ''}\0${left.code}\0${left.message}`, `${right.phase}\0${right.path ?? ''}\0${right.code}\0${right.message}`));
}

function safeMessage(error: unknown, rootLocator?: string): string {
	let message = error instanceof Error ? error.message : 'Static semantic snapshot construction failed.';
	if (rootLocator !== undefined && rootLocator.length > 0) {
		message = message.replaceAll(rootLocator, '<root>').replaceAll(rootLocator.replaceAll('\\', '/'), '<root>');
	}
	return message.replaceAll('\\', '/');
}

function inertRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
	try {
		if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value)) throw new StaticSemanticRequestError('INVALID_REQUEST', `${label} must be an inert data object.`);
		const prototype = Reflect.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) throw new StaticSemanticRequestError('INVALID_REQUEST', `${label} must be a plain data object.`);
		const result = Object.create(null) as Record<string, unknown>;
		for (const key of Reflect.ownKeys(value)) {
			if (typeof key !== 'string') throw new StaticSemanticRequestError('INVALID_REQUEST', `${label} must not contain symbol properties.`);
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) throw new StaticSemanticRequestError('INVALID_REQUEST', `${label}.${key} must be an enumerable data property.`);
			result[key] = descriptor.value;
		}
		return result;
	} catch (error) {
		if (error instanceof StaticSemanticRequestError) throw error;
		throw new StaticSemanticRequestError('INVALID_REQUEST', `${label} could not be inspected as inert data.`);
	}
}

function exactKeys(record: Readonly<Record<string, unknown>>, expected: readonly string[], label: string): void {
	const actual = Object.keys(record).sort(compare);
	const canonical = [...expected].sort(compare);
	if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) throw new StaticSemanticRequestError('INVALID_REQUEST', `${label} has unknown or missing fields.`);
}

function inertCapabilities(value: unknown): readonly ('TS_PROJECT' | 'TS_SYNTAX')[] {
	try {
		if (value === null || typeof value !== 'object' || !Array.isArray(value) || isProxy(value) || Reflect.getPrototypeOf(value) !== Array.prototype) throw new StaticSemanticRequestError('INVALID_REQUEST', 'Semantic capabilities must be an inert dense array.');
		const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
		const length = lengthDescriptor !== undefined && 'value' in lengthDescriptor ? lengthDescriptor.value : undefined;
		if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 4) throw new StaticSemanticRequestError('INVALID_REQUEST', 'Semantic capabilities exceed the closed capability bound.');
		const keys = Reflect.ownKeys(value);
		if (keys.length !== length + 1 || keys.some((key) => typeof key !== 'string' || key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))) throw new StaticSemanticRequestError('INVALID_REQUEST', 'Semantic capabilities must be dense and contain no expandos.');
		const capabilities: string[] = [];
		for (let index = 0; index < length; index += 1) {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'string') throw new StaticSemanticRequestError('INVALID_REQUEST', `Semantic capability ${index} is not an inert string.`);
			capabilities.push(descriptor.value);
		}
		if (capabilities.some((capability) => capability === 'TS_SYMBOL' || capability === 'TS_TYPE')) throw new StaticSemanticRequestError('CAPABILITY_UNSUPPORTED', 'Slice 3A implements only the coupled TS_PROJECT and TS_SYNTAX capabilities.');
		if (capabilities.some((capability) => !CAPABILITIES.includes(capability as typeof CAPABILITIES[number]))) throw new StaticSemanticRequestError('CAPABILITY_UNSUPPORTED', 'The semantic request contains an unknown or unavailable capability.');
		const normalized = [...new Set(capabilities)].sort(compare);
		if (normalized.length !== CAPABILITIES.length || normalized.some((capability, index) => capability !== CAPABILITIES[index])) throw new StaticSemanticRequestError('CAPABILITY_UNSUPPORTED', 'Slice 3A requires TS_PROJECT and TS_SYNTAX together.');
		return normalized as readonly ('TS_PROJECT' | 'TS_SYNTAX')[];
	} catch (error) {
		if (error instanceof StaticSemanticRequestError) throw error;
		throw new StaticSemanticRequestError('INVALID_REQUEST', 'Semantic capabilities could not be inspected as inert data.');
	}
}

function materializeRequest(value: unknown): BuildStaticSemanticSnapshotRequest {
	const record = inertRecord(value, 'BuildStaticSemanticSnapshotRequest');
	exactKeys(record, REQUEST_KEYS, 'BuildStaticSemanticSnapshotRequest');
	if (record.schemaVersion !== SEMANTIC_REQUEST_SCHEMA_VERSION || record.operationVersion !== SEMANTIC_OPERATION_VERSION) throw new StaticSemanticRequestError('UNSUPPORTED_VERSION', 'Unsupported semantic request schema or operation version.');
	if (typeof record.expectEmpty !== 'boolean') throw new StaticSemanticRequestError('INVALID_REQUEST', 'Semantic expectEmpty must be boolean.');
	if (typeof record.rootLocator !== 'string' || record.rootLocator.length === 0 || !isAbsolute(record.rootLocator)) throw new StaticSemanticRequestError('INVALID_REQUEST', 'Semantic rootLocator must be an absolute runtime path.');
	if (typeof record.subjectId !== 'string' || !SHA256.test(record.subjectId)) throw new StaticSemanticRequestError('INVALID_REQUEST', 'Semantic subjectId must be a lowercase SHA-256 value.');
	let budgets: SemanticBudgets;
	try {
		budgets = normalizeSemanticBudgets(record.budgets);
	} catch (error) {
		throw new StaticSemanticRequestError('INVALID_REQUEST', safeMessage(error));
	}
	return Object.freeze({
		budgets,
		capabilities: inertCapabilities(record.capabilities),
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
	if (!isFrozenSubjectCapability(record.subject)) throw new StaticSemanticRequestError('INVALID_REQUEST', 'Build options require the exact FrozenSubject capability returned by subject resolution.');
	return record.subject;
}

function assertDeadline(deadlineMs: number): void {
	if (!Number.isSafeInteger(deadlineMs) || Date.now() > deadlineMs) throw new StaticSemanticBuildFailure('unavailable', [diagnostic('SEMANTIC_BUDGET_EXCEEDED', 'Static semantic snapshot construction exceeded maxDurationMs.', 'VALIDATE')]);
}

function assertCurrent(subject: FrozenSubject, request: BuildStaticSemanticSnapshotRequest, deadlineMs: number): void {
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
	if (mapped.length === 0) mapped.push(diagnostic(freshness.state === 'STALE' ? 'COMPILER_CONTEXT_CHANGED' : 'COMPILER_CONTEXT_UNAVAILABLE', freshness.state === 'STALE' ? 'Frozen subject is stale.' : 'Frozen subject freshness could not be established.', 'FRESHNESS'));
	throw new StaticSemanticBuildFailure('unavailable', canonicalDiagnostics(mapped));
}

function wireCompilerValue(value: unknown, label: string, ancestors = new Set<object>()): unknown {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error(`${label} contains a non-canonical number.`);
		return value;
	}
	if (value === undefined) return undefined;
	if (typeof value !== 'object' || isProxy(value)) throw new Error(`${label} contains a non-data compiler value.`);
	if (ancestors.has(value)) throw new Error(`${label} contains a cycle.`);
	ancestors.add(value);
	try {
		if (Array.isArray(value)) return value.map((entry, index) => wireCompilerValue(entry, `${label}[${index}]`, ancestors));
		const prototype = Reflect.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} contains a non-plain compiler value.`);
		return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, wireCompilerValue(entry, `${label}.${key}`, ancestors)]));
	} finally {
		ancestors.delete(value);
	}
}

function logicalCompilerOptions(value: unknown, host: ExtendedCompilerHost, label: string): Readonly<Record<string, unknown>> {
	const wired = wireCompilerValue(value, label) as Readonly<Record<string, unknown>>;
	return Object.fromEntries(Object.entries(wired).map(([key, entry]) => {
		if (MATERIALIZED_SCALAR_PATH_OPTIONS.has(key) && typeof entry === 'string') return [key, host.toLogicalPath(entry)];
		if (MATERIALIZED_ARRAY_PATH_OPTIONS.has(key) && Array.isArray(entry)) return [key, entry.map((path) => typeof path === 'string' ? host.toLogicalPath(path) : path)];
		return [key, entry];
	}));
}

function assertParsedRecipe(
	parsed: ts.ParsedCommandLine,
	host: ExtendedCompilerHost,
	project: ProjectSubjectRecord
): void {
	const parsedRoots = [...new Set(parsed.fileNames.map((path) => host.toLogicalPath(path)))].sort(compare);
	const parsedReferences = [...new Set((parsed.projectReferences ?? []).map((reference) => host.toLogicalPath(ts.resolveProjectReferencePath(reference))))].sort(compare);
	if (canonicalSemanticJson(parsedRoots) !== canonicalSemanticJson(project.programRecipe.rootNames)) {
		throw new ProgramRecipeMaterializationError('INVALID_RECIPE', `Parsed configuration roots do not reproduce ProgramRecipe ${project.configPath}.`);
	}
	if (canonicalSemanticJson(parsedReferences) !== canonicalSemanticJson(project.programRecipe.projectReferences)) {
		throw new ProgramRecipeMaterializationError('INVALID_RECIPE', `Parsed configuration references do not reproduce ProgramRecipe ${project.configPath}.`);
	}
	const parsedOptions = logicalCompilerOptions(parsed.options, host, 'Parsed compiler options');
	const recipeOptions = project.programRecipe.compilerOptions;
	if (canonicalSemanticJson(parsedOptions) !== canonicalSemanticJson(recipeOptions)) {
		const mismatches = [...new Set([...Object.keys(parsedOptions), ...Object.keys(recipeOptions)])]
			.sort(compare)
			.filter((key) => canonicalSemanticJson(parsedOptions[key] ?? null) !== canonicalSemanticJson(recipeOptions[key] ?? null));
		throw new ProgramRecipeMaterializationError('INVALID_RECIPE', `Parsed configuration options do not reproduce ProgramRecipe ${project.configPath}; mismatched keys: ${mismatches.join(', ')}.`);
	}
}

function parseConfiguration(host: ExtendedCompilerHost, project: ProjectSubjectRecord, materialized: MaterializedProgramRecipe): readonly ts.Diagnostic[] {
	const unrecoverable: ts.Diagnostic[] = [];
	const parseHost: ts.ParseConfigFileHost = {
		fileExists: (path) => host.fileExists(path),
		getCurrentDirectory: () => host.getCurrentDirectory(),
		onUnRecoverableConfigFileDiagnostic: (value) => {
			unrecoverable.push(value);
		},
		readDirectory: (rootDir, extensions, excludes, includes, depth) => host.readDirectory(rootDir, extensions, excludes, includes, depth),
		readFile: (path) => host.readFile(path),
		useCaseSensitiveFileNames: host.useCaseSensitiveFileNames()
	};
	const parsed = ts.getParsedCommandLineOfConfigFile(materialized.configFilePath, {}, parseHost);
	if (parsed === undefined) throw new ProgramRecipeMaterializationError('INVALID_RECIPE', `TypeScript could not reproduce parsed configuration ${project.configPath}.`);
	assertParsedRecipe(parsed, host, project);
	return [...unrecoverable, ...parsed.errors];
}

function diagnosticFamily(family: StaticRawDiagnosticFamilyInput['family'], values: readonly ts.Diagnostic[]): StaticRawDiagnosticFamilyInput {
	return {
		diagnostics: values,
		family,
		reason: values.length === 0 ? 'Family ran and returned zero diagnostics.' : `Family ran and returned ${values.length} diagnostic occurrence(s).`,
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
		if (error instanceof StaticSemanticBuildFailure || error instanceof CompilerInputCaptureError || error instanceof ProgramRecipeMaterializationError) throw error;
		assertWithinDeadline();
		return { diagnostics: [], family, reason: `${family} diagnostic execution failed without usable results.`, state: 'FAILED' };
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
		collectStaticDiagnosticFamily('CONFIGURATION', () => program.getConfigFileParsingDiagnostics(), assertWithinDeadline),
		collectStaticDiagnosticFamily('OPTIONS', () => program.getOptionsDiagnostics(), assertWithinDeadline),
		collectStaticDiagnosticFamily('GLOBAL', () => program.getGlobalDiagnostics(), assertWithinDeadline),
		collectStaticDiagnosticFamily('SYNTACTIC', () => program.getSyntacticDiagnostics(), assertWithinDeadline),
		collectStaticDiagnosticFamily('SEMANTIC', () => program.getSemanticDiagnostics(), assertWithinDeadline),
		collectStaticDiagnosticFamily('DECLARATION', () => program.getDeclarationDiagnostics(), assertWithinDeadline)
	];
	assertWithinDeadline();
	return { ...entry, checker, diagnosticFamilies, host, program };
}

function aliasMappedArtifactPath(subject: FrozenSubject, logicalPath: string, caseSensitive: boolean): string {
	const pathKey = canonicalPathKey(logicalPath, caseSensitive);
	const aliases = subject.workspaces.map((workspace) => ({ alias: `node_modules/${workspace.name}`, target: workspace.path }))
		.sort((left, right) => right.alias.length - left.alias.length || compare(left.alias, right.alias));
	for (const entry of aliases) {
		const aliasKey = canonicalPathKey(entry.alias, caseSensitive);
		if (pathKey === aliasKey) return entry.target;
		if (pathKey.startsWith(`${aliasKey}/`)) return `${entry.target}/${logicalPath.slice(entry.alias.length + 1)}`;
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
	const reads = capture.observations.filter((observation): observation is Extract<CompilerInputObservation, { operation: 'READ_FILE'; result: 'PRESENT' }> => ids.has(observation.id) && observation.operation === 'READ_FILE' && observation.result === 'PRESENT');
	const caseObservation = capture.observations.find((observation) => observation.operation === 'USE_CASE_SENSITIVE_FILE_NAMES');
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
				mapping: { reason: 'Compiler context is represented directly; source-coordinate mapping is not applicable.', state: 'NOT_APPLICABLE' },
				origin: observation.origin,
				verificationState
			};
		}
		const artifactPath = aliasMappedArtifactPath(subject, logicalPath, caseSensitive);
		const key = canonicalPathKey(artifactPath, caseSensitive);
		const artifacts = subject.artifacts.filter((artifact) => artifact.canonicalPathKey === key && (!caseSensitive || artifact.path === artifactPath));
		if (artifacts.length !== 1) return undefined;
		const artifact = artifacts[0]!;
		return {
			artifact: { disposition: artifact.disposition, primaryClass: artifact.primaryClass, roles: [...artifact.roles] },
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
	readonly projectKey: string;
	readonly sha256: string;
}

interface ProjectSourceEvidence {
	readonly assertConsumed?: () => void;
	readonly attribution: CompilerProjectAttribution;
	readonly observations: readonly CompilerInputObservation[];
	readonly verificationState: RawCompilerSourceBinding['verificationState'];
}

function rawProjectionDigest(raw: RawStaticSemanticProjectExtraction): RawProjectionDigest {
	const { evidenceState: _evidenceState, ...projection } = raw;
	return {
		projectKey: raw.project.configPath,
		sha256: sha256(`JAN-CSAA-RAW-REPLAY\0${canonicalSemanticJson(projection)}`)
	};
}

function extractProjectResult<T>(
	environment: CompilerEnvironment,
	entry: MaterializedProject,
	subject: FrozenSubject,
	budgets: SemanticBudgets,
	budgetLedger: ReturnType<typeof createStaticRawExtractionBudgetLedger>,
	deadlineMs: number,
	assertWithinDeadline: () => void,
	evidenceForProject: (projectKey: string) => ProjectSourceEvidence,
	projectResult: (raw: RawStaticSemanticProjectExtraction) => T
): T {
	const constructed = constructProject(environment, entry, assertWithinDeadline);
	const evidence = evidenceForProject(entry.project.configPath);
	if (evidence.attribution.projectKey !== entry.project.configPath) throw new CompilerInputCaptureError('INVALID_CAPTURE', `Compiler evidence lacks project attribution ${entry.project.configPath}.`);
	const result = extractStaticRaw({
		assertWithinDeadline,
		budgetLedger,
		budgets,
		checker: constructed.checker,
		deadlineMs,
		diagnosticFamilies: constructed.diagnosticFamilies,
		evidenceState: evidence.verificationState,
		program: constructed.program,
		programRecipe: constructed.project.programRecipe,
		project: constructed.project,
		projectKey: constructed.project.configPath,
		resolveCompilerSource: compilerSourceResolver(subject, evidence, evidence.attribution, evidence.verificationState),
		toLogicalPath: (path) => constructed.host.toLogicalPath(path)
	});
	evidence.assertConsumed?.();
	assertWithinDeadline();
	return projectResult(result);
}

function extractPass<T>(
	environment: CompilerEnvironment,
	projects: readonly MaterializedProject[],
	subject: FrozenSubject,
	budgets: SemanticBudgets,
	deadlineMs: number,
	assertWithinDeadline: () => void,
	evidenceForProject: (projectKey: string) => ProjectSourceEvidence,
	projectResult: (raw: RawStaticSemanticProjectExtraction) => T
): T[] {
	const budgetLedger = createStaticRawExtractionBudgetLedger(budgets);
	const results: T[] = [];
	for (const entry of projects) {
		assertWithinDeadline();
		results.push(extractProjectResult(environment, entry, subject, budgets, budgetLedger, deadlineMs, assertWithinDeadline, evidenceForProject, projectResult));
		assertWithinDeadline();
	}
	return results;
}

function validationOptions(budgets: SemanticBudgets): SemanticValidationOptions {
	const bounded = (value: number): number => Number.isSafeInteger(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
	const recordLimit = bounded(budgets.maxAstNodes + budgets.maxSources + budgets.maxDiagnostics + budgets.maxProjects * 4 + budgets.maxCompilerQueries + 11);
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
	return canonicalDiagnostics(snapshot.projects.flatMap((project) => project.partialityReasons.map((reason) => diagnostic(
		reason.code === 'CONTEXT_FRESHNESS_UNKNOWN' ? 'COMPILER_CONTEXT_UNAVAILABLE'
			: reason.code === 'FRAMEWORK_CANDIDATES_UNSUPPORTED' ? 'CAPABILITY_UNSUPPORTED' : reason.code,
		reason.message,
		'EXTRACT',
		reason.path,
		'WARNING'
	))));
}

function mapFailure(error: unknown, phase: SemanticBuildDiagnostic['phase'], rootLocator?: string): StaticSemanticBuildFailure {
	if (error instanceof StaticSemanticBuildFailure) return error;
	const message = safeMessage(error, rootLocator);
	if (error instanceof StaticSemanticRequestError) {
		const code: SemanticBuildDiagnosticCode = error.code === 'CAPABILITY_UNSUPPORTED' ? 'CAPABILITY_UNSUPPORTED' : error.code === 'UNSUPPORTED_VERSION' ? 'COMPILER_VERSION_MISMATCH' : 'SEMANTIC_VALIDATION_FAILED';
		return new StaticSemanticBuildFailure('incompatible', [diagnostic(code, message, 'REQUEST')]);
	}
	if (error instanceof ProgramRecipeMaterializationError) {
		const code: SemanticBuildDiagnosticCode = error.code === 'VERSION_MISMATCH' ? 'COMPILER_VERSION_MISMATCH' : error.code === 'PATH_ESCAPE' ? 'COMPILER_CONTEXT_FORBIDDEN' : 'PROGRAM_RECIPE_MISMATCH';
		return new StaticSemanticBuildFailure(error.code === 'VERSION_MISMATCH' || error.code === 'INVALID_RECIPE' ? 'incompatible' : 'unavailable', [diagnostic(code, message, phase)]);
	}
	if (error instanceof CompilerInputCaptureError) {
		const code: SemanticBuildDiagnosticCode = error.code === 'BUDGET_EXCEEDED' ? 'SEMANTIC_BUDGET_EXCEEDED'
			: error.code === 'CONTEXT_CHANGED' || error.code === 'UNCONSUMED_QUERY' || error.code === 'UNRECORDED_QUERY' ? 'COMPILER_CONTEXT_CHANGED'
				: error.code === 'CONTEXT_UNAVAILABLE' ? 'COMPILER_CONTEXT_UNAVAILABLE'
					: error.code === 'FROZEN_BYTES_UNAVAILABLE' ? 'FROZEN_BYTES_UNAVAILABLE'
						: error.code === 'INVALID_QUERY' ? 'PROGRAM_RECIPE_MISMATCH' : 'SEMANTIC_VALIDATION_FAILED';
		return new StaticSemanticBuildFailure(error.code === 'INVALID_QUERY' ? 'incompatible' : 'unavailable', [diagnostic(code, message, phase)]);
	}
	if (error instanceof StaticRawExtractionError) {
		const code: SemanticBuildDiagnosticCode = error.code === 'BUDGET_EXCEEDED' || error.code === 'DEADLINE_EXCEEDED' ? 'SEMANTIC_BUDGET_EXCEEDED'
			: error.code === 'IDENTITY_MISMATCH' ? 'PROGRAM_RECIPE_MISMATCH'
				: error.code === 'SOURCE_EVIDENCE_MISSING' ? 'FROZEN_BYTES_UNAVAILABLE'
					: error.code === 'PATH_MAPPING_FAILED' || error.code === 'SOURCE_POLICY_MISMATCH' ? 'COMPILER_CONTEXT_FORBIDDEN' : 'SEMANTIC_VALIDATION_FAILED';
		return new StaticSemanticBuildFailure(error.code === 'IDENTITY_MISMATCH' || error.code === 'INVALID_INPUT' ? 'incompatible' : 'unavailable', [diagnostic(code, message, 'EXTRACT', error.path)]);
	}
	if (error instanceof SemanticNormalizationError) {
		return new StaticSemanticBuildFailure('unavailable', [diagnostic(error.code === 'BUDGET_EXCEEDED' ? 'SEMANTIC_BUDGET_EXCEEDED' : 'SEMANTIC_VALIDATION_FAILED', message, 'VALIDATE')]);
	}
	return new StaticSemanticBuildFailure('unavailable', [diagnostic(phase === 'PROGRAM' ? 'PROGRAM_CREATION_FAILED' : 'SEMANTIC_VALIDATION_FAILED', message, phase)]);
}

export function buildStaticSemanticSnapshot(requestValue: unknown, optionsValue: { readonly subject: FrozenSubject }): StaticSemanticSnapshotOutcome {
	const startedAtMs = Date.now();
	let request: BuildStaticSemanticSnapshotRequest | undefined;
	let phase: SemanticBuildDiagnostic['phase'] = 'REQUEST';
	try {
		request = materializeRequest(requestValue);
		const subject = materializeSubjectOption(optionsValue);
		const deadlineMs = startedAtMs + request.budgets.maxDurationMs;
		if (!Number.isSafeInteger(startedAtMs) || !Number.isSafeInteger(deadlineMs)) throw new StaticSemanticBuildFailure('unavailable', [diagnostic('SEMANTIC_BUDGET_EXCEEDED', 'Semantic operation deadline is not a safe integer.', 'REQUEST')]);
		const assertWithinDeadline = (): void => assertDeadline(deadlineMs);
		assertWithinDeadline();
		if (ts.version !== TYPESCRIPT_PROVIDER_VERSION) throw new StaticSemanticBuildFailure('incompatible', [diagnostic('COMPILER_VERSION_MISMATCH', `Slice 3A requires TypeScript ${TYPESCRIPT_PROVIDER_VERSION}; runtime is ${ts.version}.`, 'MATERIALIZE')]);
		if (subject.descriptor.subjectId !== request.subjectId) throw new StaticSemanticBuildFailure('incompatible', [diagnostic('SUBJECT_ID_MISMATCH', 'Semantic request does not bind the supplied FrozenSubject.', 'REQUEST')]);

		phase = 'FRESHNESS';
		assertCurrent(subject, request, deadlineMs);
		phase = 'MATERIALIZE';
		if (subject.projects.length > request.budgets.maxProjects) throw new StaticSemanticBuildFailure('unavailable', [diagnostic('SEMANTIC_BUDGET_EXCEEDED', 'Frozen project population exceeds maxProjects.', phase)]);
		const materializedProjects: MaterializedProject[] = [];
		for (const project of [...subject.projects].sort((left, right) => compare(left.configPath, right.configPath))) {
			assertWithinDeadline();
			materializedProjects.push({ materialized: materializeProgramRecipe(project.programRecipe, request.rootLocator), project });
		}
		assertWithinDeadline();

		phase = 'CAPTURE';
		const captureEnvironment: CapturingCompilerEnvironment = createCapturingCompilerEnvironment(subject, request.rootLocator, request.budgets, startedAtMs);
		phase = 'PROGRAM';
		const captureProjectionDigests = extractPass(
			captureEnvironment,
			materializedProjects,
			subject,
			request.budgets,
			deadlineMs,
			assertWithinDeadline,
			(projectKey) => ({ ...captureEnvironment.currentProjectEvidence(projectKey), verificationState: 'CAPTURED_COMPILER_INPUT' }),
			rawProjectionDigest
		);
		phase = 'CAPTURE';
		const frozenCapture = captureEnvironment.finalizeCapture();
		assertWithinDeadline();
		phase = 'RECHECK';
		const verifiedCapture = recheckCompilerInputJournal(frozenCapture);
		assertWithinDeadline();
		phase = 'FRESHNESS';
		assertCurrent(subject, request, deadlineMs);

		phase = 'RECHECK';
		const replayEnvironment: ReplayCompilerEnvironment = createReplayCompilerEnvironment(subject, verifiedCapture);
		phase = 'PROGRAM';
		const replayRaw = extractPass(
			replayEnvironment,
			materializedProjects,
			subject,
			request.budgets,
			deadlineMs,
			assertWithinDeadline,
			(projectKey) => {
				replayEnvironment.assertProjectConsumed(projectKey);
				const attribution = verifiedCapture.projectAttributions.find((candidate) => candidate.projectKey === projectKey);
				if (attribution === undefined) throw new CompilerInputCaptureError('INVALID_CAPTURE', `Verified capture lacks project attribution ${projectKey}.`);
				return {
					assertConsumed: () => replayEnvironment.assertProjectConsumed(projectKey),
					attribution,
					observations: verifiedCapture.observations,
					verificationState: 'VERIFIED_COMPILER_INPUT'
				};
			},
			(raw) => raw
		);
		phase = 'RECHECK';
		replayEnvironment.assertFullyConsumed();
		assertWithinDeadline();
		phase = 'FRESHNESS';
		assertCurrent(subject, request, deadlineMs);
		phase = 'VALIDATE';
		const replayProjectionDigests = replayRaw.map(rawProjectionDigest);
		if (canonicalSemanticJson(captureProjectionDigests) !== canonicalSemanticJson(replayProjectionDigests)) throw new StaticSemanticBuildFailure('unavailable', [diagnostic('COMPILER_CONTEXT_CHANGED', 'Capture and replay produced different canonical identity-free semantic projection digests.', 'RECHECK')]);
		assertWithinDeadline();

		const snapshot = normalizeStaticSemanticSnapshot({ capture: verifiedCapture, projects: replayRaw, request, subject });
		replayRaw.length = 0;
		assertWithinDeadline();
		const finalSnapshot = deepFreeze(snapshot);
		const canonicalWitness = canonicalSemanticJsonWitness(finalSnapshot);
		if (canonicalWitness.bytes > request.budgets.maxSnapshotBytes) throw new StaticSemanticBuildFailure('unavailable', [diagnostic('SEMANTIC_BUDGET_EXCEEDED', 'Canonical semantic snapshot exceeds maxSnapshotBytes.', 'VALIDATE')]);
		assertWithinDeadline();
		const validatorOptions = validationOptions(request.budgets);
		const validation = validateStaticSemanticSnapshot(finalSnapshot, validatorOptions, { frozenSubject: subject });
		if (validation.state !== 'VALID') {
			const sample = validation.issues.slice(0, 3).map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`).join('; ');
			throw new StaticSemanticBuildFailure('unavailable', [diagnostic('SEMANTIC_VALIDATION_FAILED', `Semantic snapshot failed exact closed-wire validation with ${validation.issues.length} issue(s): ${sample}`, 'VALIDATE')]);
		}
		assertWithinDeadline();
		phase = 'FRESHNESS';
		assertCurrent(subject, request, deadlineMs);
		assertWithinDeadline();
		const diagnostics = finalSnapshot.health === 'PARTIAL' ? partialDiagnostics(finalSnapshot) : [];
		assertWithinDeadline();
		return finalSnapshot.health === 'PARTIAL'
			? { diagnostics, outcome: 'partial', snapshot: finalSnapshot }
			: { diagnostics, outcome: 'complete', snapshot: finalSnapshot };
	} catch (error) {
		const failure = mapFailure(error, phase, request?.rootLocator);
		return { diagnostics: canonicalDiagnostics(failure.diagnostics), outcome: failure.outcome };
	}
}
