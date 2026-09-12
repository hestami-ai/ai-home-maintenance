import { TextDecoder } from 'node:util';
import {
	GENERATED_CONTEXT_EVIDENCE_SCHEMA_VERSION,
	GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION,
	GENERATED_CONTEXT_INPUT_SELECTION_METHOD,
	GENERATED_CONTEXT_OUTPUT_SELECTION_METHOD,
	GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID,
	type CapturedArtifactRecord,
	type ExcludedArtifactRecord,
	type ArtifactPrimaryClass,
	type FrozenSubject,
	type GeneratedContextEvidenceRecord,
	type GeneratedContextExecutionManifest,
	type GeneratedContextGeneratorIdentity,
	type GeneratedContextInputRecord,
	type GeneratedContextOutputRecord,
	type GeneratedContextRecord,
	type ProjectSubjectRecord,
	type ResolveSubjectRequest,
	type SubjectDiagnostic
} from '../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';
import { isUnicodeScalarString } from '../semantic/canonical.js';
import type { SubjectCapture } from './capture-model.js';
import { assertCanonicalRelativePath, canonicalPathKey } from './paths.js';
import { generatedContextExecutionManifestDigest } from './svelte-kit-execution-closure.js';

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const MAX_IDENTITY_CHARACTERS = 1_024;
const ARTIFACT_PRIMARY_CLASSES = new Set<ArtifactPrimaryClass>([
	'MANIFEST',
	'LOCKFILE',
	'TOOL_CONFIGURATION',
	'PROJECT_CONFIGURATION',
	'GENERATED_CONFIGURATION',
	'PRODUCTION_SOURCE',
	'TEST_SOURCE',
	'GENERATOR_SOURCE',
	'GENERATED_SOURCE',
	'SCRIPT',
	'VERIFICATION',
	'BUILD_OUTPUT',
	'CACHE',
	'EXTERNAL_DEPENDENCY',
	'VENDOR',
	'OTHER'
]);

export interface GeneratedContextFreshnessEvidence {
	readonly actualInputManifestDigest: string;
	readonly actualOutputManifestDigest: string;
	readonly record: GeneratedContextEvidenceRecord;
	readonly source: string;
}

export interface GeneratedContextResolution {
	readonly capture: SubjectCapture;
	readonly contexts: readonly GeneratedContextRecord[];
	readonly diagnostics: readonly SubjectDiagnostic[];
}

interface ParsedEvidence {
	readonly record?: GeneratedContextEvidenceRecord;
	readonly problem?: string;
}

function workspaceRootForGeneratedContext(path: string): string | null {
	const marker = '/.svelte-kit/';
	const index = path.indexOf(marker);
	return index <= 0 ? null : path.slice(0, index);
}

function isRootGeneratorContext(artifact: CapturedArtifactRecord): boolean {
	return (
		!artifact.path.includes('/') &&
		(artifact.primaryClass === 'MANIFEST' ||
			artifact.primaryClass === 'LOCKFILE' ||
			artifact.roles.includes('CONFIGURATION'))
	);
}

function selectedGeneratorInput(
	artifact: CapturedArtifactRecord,
	workspaceRoot: string,
	generatedContextPath: string,
	evidenceSource: string
): boolean {
	if (
		canonicalPathKey(artifact.path) === canonicalPathKey(generatedContextPath) ||
		canonicalPathKey(artifact.path) === canonicalPathKey(evidenceSource)
	)
		return false;
	if (isRootGeneratorContext(artifact)) return true;
	if (!artifact.path.startsWith(`${workspaceRoot}/`)) return false;
	if (artifact.path.includes('/.svelte-kit/')) return false;
	return artifact.primaryClass !== 'BUILD_OUTPUT' && artifact.primaryClass !== 'CACHE';
}

export function generatedContextInputManifest(
	artifacts: readonly CapturedArtifactRecord[],
	generatedContextPath: string,
	evidenceSource: string
): readonly GeneratedContextInputRecord[] {
	const workspaceRoot = workspaceRootForGeneratedContext(generatedContextPath);
	if (workspaceRoot === null)
		throw new Error('Generated context path is not beneath a workspace .svelte-kit directory.');
	return artifacts
		.filter((artifact) =>
			selectedGeneratorInput(artifact, workspaceRoot, generatedContextPath, evidenceSource)
		)
		.map(({ bytes, path, primaryClass, sha256: contentSha256 }) => ({
			artifactClass: primaryClass,
			bytes,
			path,
			sha256: contentSha256
		}))
		.sort((left, right) => compareText(left.path, right.path));
}

export function generatedContextInputManifestDigest(
	inputManifest: readonly GeneratedContextInputRecord[]
): string {
	return sha256(canonicalJson(inputManifest));
}

export function generatedContextOutputManifest(
	artifacts: readonly CapturedArtifactRecord[],
	generatedContextPath: string
): readonly GeneratedContextOutputRecord[] {
	const workspaceRoot = workspaceRootForGeneratedContext(generatedContextPath);
	if (workspaceRoot === null)
		throw new Error('Generated context path is not beneath a workspace .svelte-kit directory.');
	const generatedRoot = `${workspaceRoot}/.svelte-kit/`;
	const manifest = artifacts
		.filter(
			(artifact) =>
				artifact.path.startsWith(generatedRoot) &&
				(artifact.primaryClass === 'GENERATED_CONFIGURATION' ||
					artifact.primaryClass === 'GENERATED_SOURCE')
		)
		.map(({ bytes, path, primaryClass, sha256: contentSha256 }) => ({
			artifactClass: primaryClass,
			bytes,
			path,
			sha256: contentSha256
		}))
		.sort((left, right) => compareText(left.path, right.path));
	if (
		!manifest.some(
			(output) => canonicalPathKey(output.path) === canonicalPathKey(generatedContextPath)
		)
	)
		throw new Error('Generated output manifest does not contain its generated-context anchor.');
	return manifest;
}

export function generatedContextOutputManifestDigest(
	outputManifest: readonly GeneratedContextOutputRecord[]
): string {
	return sha256(canonicalJson(outputManifest));
}

function executionEvidenceCoherenceProblem(
	executionManifest: GeneratedContextExecutionManifest,
	generator: GeneratedContextGeneratorIdentity,
	inputManifest: readonly GeneratedContextInputRecord[],
	generatedContextPath: string
): string | null {
	if (generator.id !== GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID)
		return 'Generation record names a generator incompatible with its fixed invocation.';
	const kitPackages = executionManifest.packages.filter(
		(record) => record.name === '@sveltejs/kit'
	);
	if (kitPackages.length !== 1 || kitPackages[0]!.version !== generator.version)
		return 'Generation record generator version does not reconcile with its SvelteKit package.';
	if (
		executionManifest.generatedOutputRoot.path !==
		generatedContextPath.slice(0, generatedContextPath.lastIndexOf('/'))
	)
		return 'Generation record empty generated-output root does not reconcile with its anchor.';
	const inputsByPath = new Map(inputManifest.map((record) => [record.path, record]));
	const packageLocators = new Set(executionManifest.packages.map((record) => record.locator));
	const packageNames = new Set(executionManifest.packages.map((record) => record.name));
	for (const requiredPackage of ['@sveltejs/kit', 'typescript', 'vite'])
		if (!packageNames.has(requiredPackage))
			return 'Generation record execution package closure omits a fixed synchronization seed.';
	const fileReadGrants = new Set(
		executionManifest.repositoryReadGrants
			.filter((grant) => grant.kind === 'FILE')
			.map((grant) => grant.path)
	);
	const directoryReadGrants = new Set(
		executionManifest.repositoryReadGrants
			.filter((grant) => grant.kind === 'DIRECTORY')
			.map((grant) => grant.path)
	);
	for (const grant of executionManifest.repositoryReadGrants) {
		if (grant.kind === 'FILE' && !inputsByPath.has(grant.path))
			return 'Generation record file-read grant is absent from its input manifest.';
		if (grant.kind === 'ABSENT_PATH' && inputsByPath.has(grant.path))
			return 'Generation record absent-path grant conflicts with its input manifest.';
		if (
			grant.kind === 'DIRECTORY' &&
			!packageLocators.has(grant.path) &&
			!inputManifest.some((record) => record.path.startsWith(`${grant.path}/`))
		)
			return 'Generation record directory-read grant has no bound input population.';
	}
	for (const configuration of executionManifest.configurationEntrypoints) {
		if (!fileReadGrants.has(configuration.path))
			return 'Generation record execution configuration does not have an exact file-read grant.';
		const input = inputsByPath.get(configuration.path);
		if (input === undefined || input.sha256 !== configuration.sha256)
			return 'Generation record execution configuration does not reconcile with its input manifest.';
		for (const specifier of configuration.imports) {
			const packageName = packageNameFromConfigurationImport(specifier);
			if (packageName === undefined)
				return 'Generation record execution configuration contains an unsupported package import.';
			if (packageName !== null && !packageNames.has(packageName))
				return 'Generation record execution configuration import is absent from its package closure.';
		}
	}
	for (const packageRecord of executionManifest.packages)
		if (packageRecord.lockKey !== packageRecord.name)
			return 'Generation record execution package does not use its exact bun.lock key.';
	for (const packageLocator of packageLocators)
		if (!directoryReadGrants.has(packageLocator))
			return 'Generation record execution package does not have an exact directory-read grant.';
	for (const configuration of executionManifest.configurationEntrypoints) {
		const separator = configuration.path.lastIndexOf('/');
		const sourceDirectory = `${configuration.path.slice(0, separator)}/src`;
		if (
			inputManifest.some((input) => input.path.startsWith(`${sourceDirectory}/`)) &&
			!directoryReadGrants.has(sourceDirectory)
		)
			return 'Generation record execution source population does not have an exact directory-read grant.';
	}
	const lockInput = inputsByPath.get(executionManifest.lockfile.path);
	if (!fileReadGrants.has(executionManifest.lockfile.path))
		return 'Generation record execution lockfile does not have an exact file-read grant.';
	if (
		lockInput === undefined ||
		lockInput.artifactClass !== 'LOCKFILE' ||
		lockInput.sha256 !== executionManifest.lockfile.sha256
	)
		return 'Generation record execution lockfile does not reconcile with its input manifest.';
	const projectRoot = executionManifest.generatedOutputRoot.path.endsWith('/.svelte-kit')
		? executionManifest.generatedOutputRoot.path.slice(0, -'/.svelte-kit'.length)
		: null;
	if (projectRoot === null || projectRoot.length === 0)
		return 'Generation record generated-output root is incompatible with its read-grant profile.';
	const configurationPaths = new Set(
		executionManifest.configurationEntrypoints.map((entry) => entry.path)
	);
	const candidateConfigurations = [
		`${projectRoot}/svelte.config.js`,
		`${projectRoot}/svelte.config.ts`,
		...['cjs', 'cts', 'js', 'mjs', 'mts', 'ts'].map(
			(extension) => `${projectRoot}/vite.config.${extension}`
		)
	];
	if (
		configurationPaths.size === 0 ||
		[...configurationPaths].some((path) => !candidateConfigurations.includes(path))
	)
		return 'Generation record configuration entrypoints are incompatible with its read-grant profile.';
	const expectedGrants: GeneratedContextExecutionManifest['repositoryReadGrants'] = [
		...[
			`${projectRoot}/.env`,
			`${projectRoot}/.env.local`,
			`${projectRoot}/.env.production`,
			`${projectRoot}/.env.production.local`,
			...candidateConfigurations.filter((path) => !configurationPaths.has(path))
		].map((path) => ({ kind: 'ABSENT_PATH' as const, path })),
		...[
			`${projectRoot}/package.json`,
			`${projectRoot}/tsconfig.json`,
			...configurationPaths,
			executionManifest.lockfile.path,
			'package.json'
		].map((path) => ({ kind: 'FILE' as const, path })),
		{ kind: 'DIRECTORY' as const, path: `${projectRoot}/src` },
		...(inputManifest.some((input) => input.path.startsWith(`${projectRoot}/static/`))
			? [{ kind: 'DIRECTORY' as const, path: `${projectRoot}/static` }]
			: [{ kind: 'ABSENT_PATH' as const, path: `${projectRoot}/static` }]),
		...executionManifest.packages.map((record) => ({
			kind: 'DIRECTORY' as const,
			path: record.locator
		}))
	].sort((left, right) => compareText(left.path, right.path));
	if (canonicalJson(executionManifest.repositoryReadGrants) !== canonicalJson(expectedGrants))
		return 'Generation record repository read grants do not match its exact synchronization profile.';
	return null;
}

export function createGeneratedContextEvidenceRecord(options: {
	readonly evidenceSource: string;
	readonly executionManifest: GeneratedContextExecutionManifest;
	readonly generatedContextPath: string;
	readonly generator: GeneratedContextGeneratorIdentity;
	readonly subject: FrozenSubject;
}): GeneratedContextEvidenceRecord {
	assertCanonicalRelativePath(options.evidenceSource);
	assertCanonicalRelativePath(options.generatedContextPath);
	if (
		options.generator.id.length === 0 ||
		options.generator.version.length === 0 ||
		options.generator.id.length > MAX_IDENTITY_CHARACTERS ||
		options.generator.version.length > MAX_IDENTITY_CHARACTERS ||
		!isUnicodeScalarString(options.generator.id) ||
		!isUnicodeScalarString(options.generator.version) ||
		!validSha256(options.generator.implementationDigest)
	)
		throw new Error('Generated-context generator identity is invalid.');
	const executionManifestDigest = generatedContextExecutionManifestDigest(
		options.executionManifest
	);
	if (executionManifestDigest !== options.generator.implementationDigest)
		throw new Error('Generated-context execution manifest does not bind its generator identity.');
	const generatedContext = options.subject.artifacts.find(
		(artifact) => canonicalPathKey(artifact.path) === canonicalPathKey(options.generatedContextPath)
	);
	if (generatedContext === undefined)
		throw new Error('Generated-context artifact is absent from the frozen subject.');
	const inputManifest = generatedContextInputManifest(
		options.subject.artifacts,
		generatedContext.path,
		options.evidenceSource
	);
	const generatedOutputManifest = generatedContextOutputManifest(
		options.subject.artifacts,
		generatedContext.path
	);
	const coherenceProblem = executionEvidenceCoherenceProblem(
		options.executionManifest,
		options.generator,
		inputManifest,
		options.generatedContextPath
	);
	if (coherenceProblem !== null) throw new Error(coherenceProblem);
	return Object.freeze({
		executionManifest: deepFreeze(
			JSON.parse(canonicalJson(options.executionManifest)) as GeneratedContextExecutionManifest
		),
		executionManifestDigest,
		generatedContext: Object.freeze({
			path: generatedContext.path,
			sha256: generatedContext.sha256
		}),
		generator: Object.freeze({ ...options.generator }),
		generatedOutputManifest: Object.freeze(
			generatedOutputManifest.map((entry) => Object.freeze({ ...entry }))
		),
		generatedOutputManifestDigest: generatedContextOutputManifestDigest(generatedOutputManifest),
		inputManifest: Object.freeze(inputManifest.map((entry) => Object.freeze({ ...entry }))),
		inputManifestDigest: generatedContextInputManifestDigest(inputManifest),
		inputSelectionMethod: GENERATED_CONTEXT_INPUT_SELECTION_METHOD,
		outputSelectionMethod: GENERATED_CONTEXT_OUTPUT_SELECTION_METHOD,
		schemaVersion: GENERATED_CONTEXT_EVIDENCE_SCHEMA_VERSION
	});
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || typeof value !== 'object' || seen.has(value as object)) return value;
	seen.add(value as object);
	for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
	return Object.freeze(value);
}

export function assessGeneratedContextFreshness(
	evidence?: GeneratedContextFreshnessEvidence
): Pick<GeneratedContextRecord, 'freshness' | 'freshnessBasis' | 'freshnessEvidence'> {
	if (evidence === undefined)
		return {
			freshness: 'UNKNOWN',
			freshnessBasis: 'No content-bound governed generation record was captured.',
			freshnessEvidence: []
		};
	const current =
		evidence.actualInputManifestDigest === evidence.record.inputManifestDigest &&
		evidence.actualOutputManifestDigest === evidence.record.generatedOutputManifestDigest;
	return current
		? {
				freshness: 'CURRENT',
				freshnessBasis:
					'Captured generator inputs and every consumed generated output match the canonical governed generation record.',
				freshnessEvidence: [
					evidence.source,
					evidence.record.generator.id,
					evidence.record.generator.implementationDigest,
					evidence.record.generator.version,
					evidence.record.inputManifestDigest,
					evidence.record.generatedOutputManifestDigest
				]
			}
		: {
				freshness: 'STALE',
				freshnessBasis:
					'Captured generator inputs or consumed generated outputs differ from the canonical governed generation record.',
				freshnessEvidence: [
					evidence.source,
					evidence.actualInputManifestDigest,
					evidence.record.inputManifestDigest,
					evidence.actualOutputManifestDigest,
					evidence.record.generatedOutputManifestDigest
				]
			};
}

function plainRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	const actual = Object.keys(value).sort(compareText);
	const expected = [...keys].sort(compareText);
	return canonicalJson(actual) === canonicalJson(expected);
}

function validIdentity(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		value.length <= MAX_IDENTITY_CHARACTERS &&
		isUnicodeScalarString(value)
	);
}

function validSha256(value: unknown): value is string {
	return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function validArtifactPrimaryClass(value: unknown): value is ArtifactPrimaryClass {
	return typeof value === 'string' && ARTIFACT_PRIMARY_CLASSES.has(value as ArtifactPrimaryClass);
}

function validSafeCount(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) >= 0;
}

function canonicalUniqueStrings(value: unknown, max = 10_000): value is readonly string[] {
	if (!Array.isArray(value) || value.length > max || value.some((entry) => !validIdentity(entry)))
		return false;
	for (let index = 1; index < value.length; index += 1)
		if (compareText(value[index - 1] as string, value[index] as string) >= 0) return false;
	return true;
}

function canonicalPath(value: unknown): value is string {
	if (!validIdentity(value)) return false;
	try {
		assertCanonicalRelativePath(value);
		return true;
	} catch {
		return false;
	}
}

function packageNameFromConfigurationImport(value: string): string | null | undefined {
	if (value === 'node:module') return null;
	if (
		value.startsWith('node:') ||
		value.startsWith('.') ||
		value.startsWith('/') ||
		value.includes('\\')
	)
		return undefined;
	const segments = value.split('/');
	if (segments.some((segment) => segment === '' || segment === '.' || segment === '..'))
		return undefined;
	const name = value.startsWith('@')
		? segments.length >= 2
			? `${segments[0]}/${segments[1]}`
			: undefined
		: segments[0];
	return name !== undefined && PACKAGE_NAME_PATTERN.test(name) ? name : undefined;
}

function parseExecutionManifest(value: unknown): GeneratedContextExecutionManifest | null {
	if (
		!plainRecord(value) ||
		!exactKeys(value, [
			'containmentPolicy',
			'configurationEntrypoints',
			'environment',
			'environmentPolicy',
			'executionLimitations',
			'generatedOutputRoot',
			'invocation',
			'lockfile',
			'missingOptionalPackages',
			'packages',
			'readGrantProfile',
			'repositoryReadGrants',
			'runtime',
			'scratchRoots',
			'schemaVersion'
		]) ||
		value.containmentPolicy !==
			'node-permission-declared-input-absence-and-bound-package-read-empty-generated-and-scratch-read-write-bound-addons-and-child-process/2.0.0' ||
		value.schemaVersion !== GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION ||
		value.environmentPolicy !== 'closed-svelte-kit-sync-environment/1.0.0' ||
		value.readGrantProfile !== 'svelte-kit-sync-project-defaults/1.0.0' ||
		canonicalJson(value.executionLimitations) !==
			canonicalJson([
				'CHILD_PROCESS_EXECUTABLE_IDENTITY_AND_EFFECTS_NOT_BOUND_OR_OS_SANDBOXED',
				'NATIVE_ADDON_EFFECTS_NOT_FILESYSTEM_NETWORK_MEMORY_OR_OS_SANDBOXED',
				'NETWORK_DENIAL_NOT_ENFORCED_BY_NODE_PERMISSION_MODEL'
			]) ||
		canonicalJson(value.invocation) !==
			canonicalJson(['svelte-kit.js', 'sync', '--mode', 'production']) ||
		!plainRecord(value.generatedOutputRoot) ||
		!exactKeys(value.generatedOutputRoot, ['access', 'baseline', 'path', 'replay']) ||
		value.generatedOutputRoot.access !== 'READ_WRITE' ||
		value.generatedOutputRoot.baseline !== 'EMPTY_PHYSICAL_DIRECTORY' ||
		!canonicalPath(value.generatedOutputRoot.path) ||
		value.generatedOutputRoot.replay !== 'RESET_TO_EMPTY_BEFORE_EACH_SYNCHRONIZATION' ||
		!Array.isArray(value.scratchRoots) ||
		value.scratchRoots.length !== 1 ||
		!plainRecord(value.scratchRoots[0]) ||
		!exactKeys(value.scratchRoots[0], ['access', 'baseline', 'lifecycle', 'path']) ||
		value.scratchRoots[0].access !== 'READ_WRITE' ||
		value.scratchRoots[0].baseline !== 'EMPTY_PHYSICAL_DIRECTORY' ||
		value.scratchRoots[0].lifecycle !==
			'RESET_BEFORE_EACH_SYNCHRONIZATION_AND_RESTORE_AFTER_OPERATION' ||
		value.scratchRoots[0].path !== 'node_modules/.vite-temp' ||
		!Array.isArray(value.configurationEntrypoints) ||
		value.configurationEntrypoints.length === 0 ||
		value.configurationEntrypoints.length > 100 ||
		!Array.isArray(value.environment) ||
		!Array.isArray(value.packages) ||
		value.packages.length === 0 ||
		value.packages.length > 1_000 ||
		!Array.isArray(value.repositoryReadGrants) ||
		value.repositoryReadGrants.length === 0 ||
		value.repositoryReadGrants.length > 2_000 ||
		!Array.isArray(value.missingOptionalPackages) ||
		value.missingOptionalPackages.length > 10_000 ||
		!plainRecord(value.lockfile) ||
		!exactKeys(value.lockfile, ['path', 'sha256']) ||
		value.lockfile.path !== 'bun.lock' ||
		!validSha256(value.lockfile.sha256) ||
		!plainRecord(value.runtime) ||
		!exactKeys(value.runtime, [
			'architecture',
			'engine',
			'executableBytes',
			'executableSha256',
			'platform',
			'version',
			'versionsDigest'
		]) ||
		value.runtime.engine !== 'node' ||
		!validIdentity(value.runtime.architecture) ||
		!/^(?:arm|arm64|ia32|loong64|ppc64|riscv64|s390x|x64)$/u.test(value.runtime.architecture) ||
		!validSafeCount(value.runtime.executableBytes) ||
		(value.runtime.executableBytes as number) === 0 ||
		!validSha256(value.runtime.executableSha256) ||
		!validIdentity(value.runtime.platform) ||
		!/^(?:aix|android|darwin|freebsd|linux|openbsd|sunos|win32)$/u.test(value.runtime.platform) ||
		!validIdentity(value.runtime.version) ||
		!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(value.runtime.version) ||
		!validSha256(value.runtime.versionsDigest)
	)
		return null;
	const configurationEntrypoints: Array<
		GeneratedContextExecutionManifest['configurationEntrypoints'][number]
	> = [];
	for (const entry of value.configurationEntrypoints) {
		if (
			!plainRecord(entry) ||
			!exactKeys(entry, ['imports', 'path', 'sha256']) ||
			!canonicalUniqueStrings(entry.imports) ||
			entry.imports.some(
				(specifier) => packageNameFromConfigurationImport(specifier as string) === undefined
			) ||
			!canonicalPath(entry.path) ||
			!validSha256(entry.sha256)
		)
			return null;
		configurationEntrypoints.push({
			imports: entry.imports,
			path: entry.path,
			sha256: entry.sha256
		});
	}
	for (let index = 1; index < configurationEntrypoints.length; index += 1)
		if (
			compareText(
				configurationEntrypoints[index - 1]!.path,
				configurationEntrypoints[index]!.path
			) >= 0
		)
			return null;
	const allowedEnvironment = new Set([
		'CI',
		'FORCE_COLOR',
		'MODE',
		'NODE_ENV',
		'NODE_NO_WARNINGS',
		'NO_COLOR',
		'SystemRoot',
		'TZ',
		'WINDIR'
	]);
	const environment: Array<GeneratedContextExecutionManifest['environment'][number]> = [];
	for (const entry of value.environment) {
		if (
			!plainRecord(entry) ||
			!exactKeys(entry, ['name', 'value']) ||
			!validIdentity(entry.name) ||
			!allowedEnvironment.has(entry.name) ||
			typeof entry.value !== 'string' ||
			entry.value.length > 4_096 ||
			!isUnicodeScalarString(entry.value)
		)
			return null;
		environment.push({ name: entry.name, value: entry.value });
	}
	for (let index = 1; index < environment.length; index += 1)
		if (compareText(environment[index - 1]!.name, environment[index]!.name) >= 0) return null;
	const environmentNames = environment.map((entry) => entry.name);
	const requiredEnvironment = [
		'CI',
		'FORCE_COLOR',
		'MODE',
		'NODE_ENV',
		'NODE_NO_WARNINGS',
		'NO_COLOR',
		'TZ',
		...(value.runtime.platform === 'win32' ? ['SystemRoot', 'WINDIR'] : [])
	].sort(compareText);
	if (canonicalJson(environmentNames) !== canonicalJson(requiredEnvironment)) return null;
	const environmentByName = new Map(environment.map((entry) => [entry.name, entry.value]));
	for (const [name, expected] of [
		['CI', '1'],
		['FORCE_COLOR', '0'],
		['MODE', 'production'],
		['NODE_ENV', 'production'],
		['NODE_NO_WARNINGS', '1'],
		['NO_COLOR', '1'],
		['TZ', 'UTC']
	] as const)
		if (environmentByName.get(name) !== expected) return null;
	if (
		value.runtime.platform === 'win32' &&
		(environmentByName.get('SystemRoot')!.toLowerCase() !==
			environmentByName.get('WINDIR')!.toLowerCase() ||
			!/^[A-Za-z]:[\\/]/u.test(environmentByName.get('SystemRoot')!))
	)
		return null;
	const packages: Array<GeneratedContextExecutionManifest['packages'][number]> = [];
	for (const entry of value.packages) {
		if (
			!plainRecord(entry) ||
			!exactKeys(entry, [
				'bytes',
				'fileCount',
				'integrity',
				'locator',
				'lockKey',
				'manifestSha256',
				'name',
				'treeSha256',
				'version'
			]) ||
			!validSafeCount(entry.bytes) ||
			(entry.bytes as number) === 0 ||
			!validSafeCount(entry.fileCount) ||
			(entry.fileCount as number) === 0 ||
			!validIdentity(entry.integrity) ||
			!INTEGRITY_PATTERN.test(entry.integrity) ||
			!canonicalPath(entry.locator) ||
			!validIdentity(entry.name) ||
			!PACKAGE_NAME_PATTERN.test(entry.name) ||
			entry.name.length > 214 ||
			entry.locator !== `node_modules/${entry.name}` ||
			!validIdentity(entry.lockKey) ||
			entry.lockKey !== entry.name ||
			!validSha256(entry.manifestSha256) ||
			!validSha256(entry.treeSha256) ||
			!validIdentity(entry.version)
		)
			return null;
		packages.push({
			bytes: entry.bytes,
			fileCount: entry.fileCount,
			integrity: entry.integrity,
			locator: entry.locator,
			lockKey: entry.lockKey,
			manifestSha256: entry.manifestSha256,
			name: entry.name,
			treeSha256: entry.treeSha256,
			version: entry.version
		});
	}
	for (let index = 1; index < packages.length; index += 1)
		if (compareText(packages[index - 1]!.locator, packages[index]!.locator) >= 0) return null;
	const repositoryReadGrants: Array<
		GeneratedContextExecutionManifest['repositoryReadGrants'][number]
	> = [];
	for (const entry of value.repositoryReadGrants) {
		if (
			!plainRecord(entry) ||
			!exactKeys(entry, ['kind', 'path']) ||
			(entry.kind !== 'ABSENT_PATH' && entry.kind !== 'DIRECTORY' && entry.kind !== 'FILE') ||
			!canonicalPath(entry.path)
		)
			return null;
		repositoryReadGrants.push({ kind: entry.kind, path: entry.path });
	}
	for (let index = 1; index < repositoryReadGrants.length; index += 1)
		if (compareText(repositoryReadGrants[index - 1]!.path, repositoryReadGrants[index]!.path) >= 0)
			return null;
	const missingOptionalPackages: Array<
		GeneratedContextExecutionManifest['missingOptionalPackages'][number]
	> = [];
	for (const entry of value.missingOptionalPackages) {
		if (
			!plainRecord(entry) ||
			!exactKeys(entry, ['issuer', 'name']) ||
			!canonicalPath(entry.issuer) ||
			!validIdentity(entry.name)
		)
			return null;
		missingOptionalPackages.push({ issuer: entry.issuer, name: entry.name });
	}
	for (let index = 1; index < missingOptionalPackages.length; index += 1)
		if (
			compareText(
				`${missingOptionalPackages[index - 1]!.issuer}\0${missingOptionalPackages[index - 1]!.name}`,
				`${missingOptionalPackages[index]!.issuer}\0${missingOptionalPackages[index]!.name}`
			) >= 0
		)
			return null;
	return {
		containmentPolicy:
			'node-permission-declared-input-absence-and-bound-package-read-empty-generated-and-scratch-read-write-bound-addons-and-child-process/2.0.0',
		configurationEntrypoints,
		environment,
		environmentPolicy: 'closed-svelte-kit-sync-environment/1.0.0',
		executionLimitations: [
			'CHILD_PROCESS_EXECUTABLE_IDENTITY_AND_EFFECTS_NOT_BOUND_OR_OS_SANDBOXED',
			'NATIVE_ADDON_EFFECTS_NOT_FILESYSTEM_NETWORK_MEMORY_OR_OS_SANDBOXED',
			'NETWORK_DENIAL_NOT_ENFORCED_BY_NODE_PERMISSION_MODEL'
		],
		generatedOutputRoot: {
			access: 'READ_WRITE',
			baseline: 'EMPTY_PHYSICAL_DIRECTORY',
			path: value.generatedOutputRoot.path,
			replay: 'RESET_TO_EMPTY_BEFORE_EACH_SYNCHRONIZATION'
		},
		invocation: ['svelte-kit.js', 'sync', '--mode', 'production'],
		lockfile: { path: 'bun.lock', sha256: value.lockfile.sha256 },
		missingOptionalPackages,
		packages,
		readGrantProfile: 'svelte-kit-sync-project-defaults/1.0.0',
		repositoryReadGrants,
		runtime: {
			architecture: value.runtime.architecture,
			engine: 'node',
			executableBytes: value.runtime.executableBytes,
			executableSha256: value.runtime.executableSha256,
			platform: value.runtime.platform,
			version: value.runtime.version,
			versionsDigest: value.runtime.versionsDigest
		},
		scratchRoots: [
			{
				access: 'READ_WRITE',
				baseline: 'EMPTY_PHYSICAL_DIRECTORY',
				lifecycle: 'RESET_BEFORE_EACH_SYNCHRONIZATION_AND_RESTORE_AFTER_OPERATION',
				path: 'node_modules/.vite-temp'
			}
		],
		schemaVersion: GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION
	};
}

function parseInputRecord(value: unknown): GeneratedContextInputRecord | null {
	if (
		!plainRecord(value) ||
		!exactKeys(value, ['artifactClass', 'bytes', 'path', 'sha256']) ||
		!validArtifactPrimaryClass(value.artifactClass) ||
		!Number.isSafeInteger(value.bytes) ||
		(value.bytes as number) < 0 ||
		!validIdentity(value.path) ||
		!validSha256(value.sha256)
	)
		return null;
	try {
		assertCanonicalRelativePath(value.path);
	} catch {
		return null;
	}
	return {
		artifactClass: value.artifactClass,
		bytes: value.bytes as number,
		path: value.path,
		sha256: value.sha256
	};
}

function parseOutputRecord(value: unknown): GeneratedContextOutputRecord | null {
	const parsed = parseInputRecord(value);
	if (
		parsed === null ||
		(parsed.artifactClass !== 'GENERATED_CONFIGURATION' &&
			parsed.artifactClass !== 'GENERATED_SOURCE')
	)
		return null;
	return parsed;
}

function parseEvidenceBytes(bytes: Uint8Array): ParsedEvidence {
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
	} catch {
		return { problem: 'Generation record is not valid UTF-8.' };
	}
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return { problem: 'Generation record is not valid JSON.' };
	}
	if (canonicalJson(value) !== text) return { problem: 'Generation record is not canonical JSON.' };
	if (
		!plainRecord(value) ||
		!exactKeys(value, [
			'executionManifest',
			'executionManifestDigest',
			'generatedContext',
			'generator',
			'generatedOutputManifest',
			'generatedOutputManifestDigest',
			'inputManifest',
			'inputManifestDigest',
			'inputSelectionMethod',
			'outputSelectionMethod',
			'schemaVersion'
		]) ||
		value.schemaVersion !== GENERATED_CONTEXT_EVIDENCE_SCHEMA_VERSION ||
		value.inputSelectionMethod !== GENERATED_CONTEXT_INPUT_SELECTION_METHOD ||
		value.outputSelectionMethod !== GENERATED_CONTEXT_OUTPUT_SELECTION_METHOD ||
		!validSha256(value.executionManifestDigest) ||
		!validSha256(value.inputManifestDigest) ||
		!validSha256(value.generatedOutputManifestDigest) ||
		!plainRecord(value.generatedContext) ||
		!exactKeys(value.generatedContext, ['path', 'sha256']) ||
		!validIdentity(value.generatedContext.path) ||
		!validSha256(value.generatedContext.sha256) ||
		!plainRecord(value.generator) ||
		!exactKeys(value.generator, ['id', 'implementationDigest', 'version']) ||
		!validIdentity(value.generator.id) ||
		!validSha256(value.generator.implementationDigest) ||
		!validIdentity(value.generator.version) ||
		!Array.isArray(value.inputManifest) ||
		!Array.isArray(value.generatedOutputManifest)
	)
		return { problem: 'Generation record has an invalid closed shape.' };
	const executionManifest = parseExecutionManifest(value.executionManifest);
	if (
		executionManifest === null ||
		generatedContextExecutionManifestDigest(executionManifest) !== value.executionManifestDigest ||
		value.executionManifestDigest !== value.generator.implementationDigest
	)
		return { problem: 'Generation record has an invalid execution manifest.' };
	const generatedContext = value.generatedContext as {
		readonly path: string;
		readonly sha256: string;
	};
	try {
		assertCanonicalRelativePath(generatedContext.path);
	} catch {
		return { problem: 'Generation record has an invalid generated-context path.' };
	}
	const inputManifest: GeneratedContextInputRecord[] = [];
	for (const entry of value.inputManifest) {
		const parsed = parseInputRecord(entry);
		if (parsed === null) return { problem: 'Generation record has an invalid input entry.' };
		inputManifest.push(parsed);
	}
	for (let index = 1; index < inputManifest.length; index += 1)
		if (compareText(inputManifest[index - 1]!.path, inputManifest[index]!.path) >= 0)
			return { problem: 'Generation record input paths are not unique and canonical.' };
	if (generatedContextInputManifestDigest(inputManifest) !== value.inputManifestDigest)
		return { problem: 'Generation record input-manifest digest is invalid.' };
	const generatedOutputManifest: GeneratedContextOutputRecord[] = [];
	for (const entry of value.generatedOutputManifest) {
		const parsed = parseOutputRecord(entry);
		if (parsed === null) return { problem: 'Generation record has an invalid output entry.' };
		generatedOutputManifest.push(parsed);
	}
	for (let index = 1; index < generatedOutputManifest.length; index += 1)
		if (
			compareText(generatedOutputManifest[index - 1]!.path, generatedOutputManifest[index]!.path) >=
			0
		)
			return { problem: 'Generation record output paths are not unique and canonical.' };
	if (
		generatedContextOutputManifestDigest(generatedOutputManifest) !==
		value.generatedOutputManifestDigest
	)
		return { problem: 'Generation record output-manifest digest is invalid.' };
	const coherenceProblem = executionEvidenceCoherenceProblem(
		executionManifest,
		{
			id: value.generator.id,
			implementationDigest: value.generator.implementationDigest,
			version: value.generator.version
		},
		inputManifest,
		generatedContext.path
	);
	if (coherenceProblem !== null) return { problem: coherenceProblem };
	const anchor = generatedOutputManifest.find(
		(output) => canonicalPathKey(output.path) === canonicalPathKey(generatedContext.path)
	);
	if (anchor === undefined || anchor.sha256 !== generatedContext.sha256)
		return { problem: 'Generation record anchor does not reconcile with its output manifest.' };
	return {
		record: {
			executionManifest,
			executionManifestDigest: value.executionManifestDigest,
			generatedContext: {
				path: generatedContext.path,
				sha256: generatedContext.sha256
			},
			generator: {
				id: value.generator.id,
				implementationDigest: value.generator.implementationDigest,
				version: value.generator.version
			},
			generatedOutputManifest,
			generatedOutputManifestDigest: value.generatedOutputManifestDigest,
			inputManifest,
			inputManifestDigest: value.inputManifestDigest,
			inputSelectionMethod: GENERATED_CONTEXT_INPUT_SELECTION_METHOD,
			outputSelectionMethod: GENERATED_CONTEXT_OUTPUT_SELECTION_METHOD,
			schemaVersion: GENERATED_CONTEXT_EVIDENCE_SCHEMA_VERSION
		}
	};
}

/**
 * Parses one governed generation record without observing the current execution environment.
 * The execution manifest is historical evidence for the write/replay that produced the record;
 * callers assessing currentness compare its bound inputs and outputs separately.
 */
export function parseGeneratedContextEvidenceRecord(
	bytes: Uint8Array
): GeneratedContextEvidenceRecord {
	const parsed = parseEvidenceBytes(bytes);
	if (parsed.record === undefined)
		throw new Error(parsed.problem ?? 'Generation record is invalid.');
	return deepFreeze(parsed.record);
}

function evidenceFreshness(
	capture: SubjectCapture,
	generatedConfig: ProjectSubjectRecord['configClosure'][number],
	evidence: NonNullable<ResolveSubjectRequest['generatedContextEvidence']>[number] | undefined,
	outputManifest: readonly GeneratedContextOutputRecord[]
): {
	readonly diagnostic?: SubjectDiagnostic;
	readonly freshness: Pick<
		GeneratedContextRecord,
		'freshness' | 'freshnessBasis' | 'freshnessEvidence'
	>;
	readonly generator: GeneratedContextEvidenceRecord['generator'] | null;
} {
	if (evidence === undefined)
		return { freshness: assessGeneratedContextFreshness(), generator: null };
	const sourceArtifact = capture.artifacts.find(
		(artifact) => artifact.canonicalPathKey === canonicalPathKey(evidence.source)
	);
	const sourceBytes = sourceArtifact && capture.bytesByPath.get(sourceArtifact.path);
	if (sourceArtifact === undefined || sourceBytes === undefined)
		return {
			diagnostic: {
				code: 'GENERATED_CONTEXT_EVIDENCE_INVALID',
				message: 'Generated-context evidence source is absent or excluded from the frozen input.',
				path: evidence.source,
				phase: 'FRESHNESS',
				severity: 'ERROR'
			},
			freshness: assessGeneratedContextFreshness(),
			generator: null
		};
	const parsed = parseEvidenceBytes(sourceBytes);
	if (parsed.record === undefined)
		return {
			diagnostic: {
				code: 'GENERATED_CONTEXT_EVIDENCE_INVALID',
				message: parsed.problem ?? 'Generated-context evidence record is invalid.',
				path: sourceArtifact.path,
				phase: 'FRESHNESS',
				severity: 'ERROR'
			},
			freshness: assessGeneratedContextFreshness(),
			generator: null
		};
	if (
		canonicalPathKey(parsed.record.generatedContext.path) !== canonicalPathKey(generatedConfig.path)
	)
		return {
			diagnostic: {
				code: 'GENERATED_CONTEXT_EVIDENCE_INVALID',
				message: 'Generated-context evidence record names a different generated context.',
				path: sourceArtifact.path,
				phase: 'FRESHNESS',
				severity: 'ERROR'
			},
			freshness: assessGeneratedContextFreshness(),
			generator: null
		};
	if (
		parsed.record.generator.id !== evidence.generator.id ||
		parsed.record.generator.implementationDigest !== evidence.generator.implementationDigest ||
		parsed.record.generator.version !== evidence.generator.version
	)
		return {
			diagnostic: {
				code: 'GENERATED_CONTEXT_EVIDENCE_INVALID',
				message: 'Generated-context evidence record names a different generator identity.',
				path: sourceArtifact.path,
				phase: 'FRESHNESS',
				severity: 'ERROR'
			},
			freshness: assessGeneratedContextFreshness(),
			generator: null
		};
	const actualInputManifest = generatedContextInputManifest(
		capture.artifacts,
		generatedConfig.path,
		sourceArtifact.path
	);
	return {
		freshness: assessGeneratedContextFreshness({
			actualInputManifestDigest: generatedContextInputManifestDigest(actualInputManifest),
			actualOutputManifestDigest: generatedContextOutputManifestDigest(outputManifest),
			record: parsed.record,
			source: sourceArtifact.path
		}),
		generator: parsed.record.generator
	};
}

export function reconcileGeneratedContext(
	capture: SubjectCapture,
	projects: readonly ProjectSubjectRecord[],
	request: ResolveSubjectRequest
): GeneratedContextResolution {
	const consumed = new Set(
		projects.flatMap((project) =>
			project.fileNames.filter((path) => path.includes('/.svelte-kit/'))
		)
	);
	const retainedArtifacts = capture.artifacts.filter(
		(artifact) =>
			artifact.primaryClass !== 'GENERATED_SOURCE' ||
			!artifact.path.includes('/.svelte-kit/') ||
			consumed.has(artifact.path)
	);
	const removed = capture.artifacts.filter(
		(artifact) =>
			artifact.primaryClass === 'GENERATED_SOURCE' &&
			artifact.path.includes('/.svelte-kit/') &&
			!consumed.has(artifact.path)
	);
	const extraExclusions: ExcludedArtifactRecord[] = removed.map((artifact) => ({
		canonicalPathKey: artifact.canonicalPathKey,
		disposition: 'EXCLUDED',
		path: artifact.path,
		physicalFileCount: 1,
		policyId: 'jan-csaa-exclude-build/1',
		primaryClass: 'BUILD_OUTPUT',
		reason: 'Generated framework declaration is not a compiler root of the captured project.',
		roles: ['GENERATED']
	}));
	const retainedPaths = new Set(retainedArtifacts.map((artifact) => artifact.path));
	const bytesByPath = new Map([...capture.bytesByPath].filter(([path]) => retainedPaths.has(path)));
	const fingerprints = new Map(
		[...capture.fingerprints].filter(([path]) => retainedPaths.has(path))
	);
	const contexts: GeneratedContextRecord[] = [];
	const diagnostics: SubjectDiagnostic[] = [];
	for (const project of projects) {
		const generatedConfig = project.configClosure.find((record) =>
			record.path.includes('/.svelte-kit/tsconfig.json')
		);
		if (generatedConfig !== undefined) {
			const generatedConfigKey = canonicalPathKey(generatedConfig.path);
			const evidence = request.generatedContextEvidence?.find(
				(item) => canonicalPathKey(item.path) === generatedConfigKey
			);
			const outputManifest = generatedContextOutputManifest(
				retainedArtifacts,
				generatedConfig.path
			);
			const resolvedEvidence = evidenceFreshness(
				capture,
				generatedConfig,
				evidence,
				outputManifest
			);
			const freshness = resolvedEvidence.freshness;
			contexts.push({
				consumerProject: project.configPath,
				...freshness,
				generator: resolvedEvidence.generator,
				outputManifestDigest: generatedContextOutputManifestDigest(outputManifest),
				outputPaths: outputManifest.map((output) => output.path),
				path: generatedConfig.path,
				selectedInput: true,
				sha256: generatedConfig.sha256
			});
			if (resolvedEvidence.diagnostic !== undefined) diagnostics.push(resolvedEvidence.diagnostic);
			if (freshness.freshness === 'UNKNOWN')
				diagnostics.push({
					code: 'GENERATED_CONTEXT_FRESHNESS_UNKNOWN',
					message: `Generated context freshness is unknown for ${project.configPath}.`,
					path: generatedConfig.path,
					phase: 'FRESHNESS',
					severity: 'WARNING'
				});
			if (freshness.freshness === 'STALE')
				diagnostics.push({
					code: 'TYPESCRIPT_PROJECT_PARTIAL',
					message: `Generated context is stale for ${project.configPath}.`,
					path: generatedConfig.path,
					phase: 'FRESHNESS',
					severity: 'WARNING'
				});
		} else if (project.frameworkCandidates.length > 0) {
			diagnostics.push({
				code: 'GENERATED_CONTEXT_ABSENT',
				message: `Framework candidates have no captured generated TypeScript context in ${project.configPath}.`,
				path: project.configPath,
				phase: 'RESOLVE',
				severity: 'WARNING'
			});
		}
	}
	contexts.sort((left, right) => compareText(left.consumerProject, right.consumerProject));
	return {
		capture: {
			...capture,
			artifacts: retainedArtifacts,
			bytesByPath,
			excludedArtifacts: [...capture.excludedArtifacts, ...extraExclusions].sort((left, right) =>
				compareText(left.path, right.path)
			),
			fingerprints
		},
		contexts,
		diagnostics
	};
}
