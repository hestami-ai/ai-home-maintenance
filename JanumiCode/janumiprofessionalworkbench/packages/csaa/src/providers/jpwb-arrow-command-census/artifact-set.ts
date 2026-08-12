import { isProxy } from 'node:util/types';

import {
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_METHOD,
	type ArrowCommandCensusArtifactBinding,
	type ArrowCommandCensusArtifactSetCoverage,
	type ArrowCommandCensusArtifactSetDiagnostic,
	type ArrowCommandCensusArtifactUse,
	type ArrowCommandCensusValidationIssue,
	type ArrowCommandCensusValidationOptions,
	type ArrowCommandCensusValidationResult,
	type BuildArrowCommandCensusArtifactSetOutcome,
	type BuildArrowCommandCensusArtifactSetRequest
} from '../../contracts/arrow-command-census.js';
import type {
	ArtifactPrimaryClass,
	ArtifactSemanticRole,
	CapturedArtifactRecord,
	FrozenSubject
} from '../../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../../inventory/canonical.js';
import { classifyArtifact } from '../../subject/artifacts.js';
import {
	isFrozenSubjectCapability,
	readFrozenSubjectArtifact
} from '../../subject/frozen-store.js';
import { assertCanonicalRelativePath, canonicalPathKey } from '../../subject/paths.js';
import {
	arrowCommandCensusArtifactSetContentDigest,
	arrowCommandCensusArtifactSetDigest,
	arrowCommandCensusArtifactSetId
} from './arrow-command-census-content.js';

const ANALYZER_PATH = 'verif/arrow-command-census.ts';
const BASELINE_PATH = 'verif/arrow-command-census.baseline.json';
const AUTHORITY_TEST_PATHS = [
	'verif/arrow-census-coverage.test.ts',
	'verif/arrow-command-census.test.ts'
] as const;
export const ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS = [
	ANALYZER_PATH,
	BASELINE_PATH,
	...AUTHORITY_TEST_PATHS
] as const;
const DOMAIN_MANIFEST_PATH = 'packages/rph-domain/package.json';
const CONTRACTS_MANIFEST_PATH = 'packages/rph-contracts/package.json';
const DOMAIN_SOURCE_PREFIX = 'packages/rph-domain/src/';
const CONTRACTS_SOURCE_PREFIX = 'packages/rph-contracts/src/';
const HANDLER_SOURCE_PREFIX = 'packages/rph-application/src/handlers/';
const OPTIONAL_ENVIRONMENT_PATHS = new Set([
	'package.json',
	'bun.lock',
	'package-lock.json',
	'pnpm-lock.yaml',
	'yarn.lock'
]);

const REQUIRED_PATHS = [
	...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
	DOMAIN_MANIFEST_PATH,
	CONTRACTS_MANIFEST_PATH,
	'packages/rph-domain/src/index.ts',
	'packages/rph-domain/src/machine-exclusions.ts',
	'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
	'packages/rph-domain/src/step-command-spec.ts',
	'packages/rph-domain/src/transitions.data.ts',
	'packages/rph-contracts/src/index.ts'
] as const;

const ARTIFACT_USES = [
	'BASELINE',
	'COMMAND_DECLARATIONS',
	'CONTRACT_SCHEMA_SOURCE',
	'ENVIRONMENT_IDENTITY',
	'EXECUTOR_SOURCE',
	'EXECUTOR_TEST',
	'HANDLER_SOURCE',
	'PACKAGE_MANIFEST',
	'PACKAGE_SOURCE',
	'STATE_MACHINE_DECLARATIONS'
] as const satisfies readonly ArrowCommandCensusArtifactUse[];
const ARTIFACT_USE_SET = new Set<string>(ARTIFACT_USES);
const PRIMARY_CLASSES = new Set<ArtifactPrimaryClass>([
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
const SEMANTIC_ROLES = new Set<ArtifactSemanticRole>([
	'ANALYSIS_INPUT',
	'COMPILER_CANDIDATE',
	'CONFIGURATION',
	'EXPORT_DECLARATION',
	'FRAMEWORK_CANDIDATE',
	'GENERATED',
	'GENERATOR',
	'MANIFEST',
	'PRODUCTION',
	'SCRIPT',
	'TEST',
	'VERIFICATION'
]);
const SHA256 = /^[a-f0-9]{64}$/u;

export interface ArrowCommandCensusArtifactSetDependencies {
	readonly subject: FrozenSubject;
}

type PlainRecord = Record<string, unknown>;

function isProductionTypeScriptPath(path: string, prefix: string): boolean {
	if (!path.startsWith(prefix) || !path.endsWith('.ts')) return false;
	const relative = path.slice(prefix.length);
	return (
		relative.length > 0 &&
		!relative.split('/').includes('gen') &&
		!/(?:^|\/)[^/]+\.(?:test|spec)\.ts$/u.test(relative)
	);
}

function isHandlerSourcePath(path: string): boolean {
	if (!path.startsWith(HANDLER_SOURCE_PREFIX)) return false;
	const relative = path.slice(HANDLER_SOURCE_PREFIX.length);
	return (
		relative.length > 0 &&
		!relative.includes('/') &&
		relative.endsWith('.ts') &&
		relative !== 'kit.ts' &&
		!/^.+\.(?:test|spec)\.ts$/u.test(relative)
	);
}

function usesForPath(path: string): readonly ArrowCommandCensusArtifactUse[] {
	const uses = new Set<ArrowCommandCensusArtifactUse>();
	if (path === ANALYZER_PATH) uses.add('EXECUTOR_SOURCE');
	if (path === BASELINE_PATH) uses.add('BASELINE');
	if ((AUTHORITY_TEST_PATHS as readonly string[]).includes(path)) uses.add('EXECUTOR_TEST');
	if (path === DOMAIN_MANIFEST_PATH || path === CONTRACTS_MANIFEST_PATH)
		uses.add('PACKAGE_MANIFEST');
	if (OPTIONAL_ENVIRONMENT_PATHS.has(path)) uses.add('ENVIRONMENT_IDENTITY');
	if (isHandlerSourcePath(path)) uses.add('HANDLER_SOURCE');
	if (isProductionTypeScriptPath(path, DOMAIN_SOURCE_PREFIX)) uses.add('PACKAGE_SOURCE');
	if (isProductionTypeScriptPath(path, CONTRACTS_SOURCE_PREFIX)) {
		uses.add('CONTRACT_SCHEMA_SOURCE');
		uses.add('PACKAGE_SOURCE');
	}
	if (
		path === 'packages/rph-domain/src/step-command-spec.ts' ||
		path === 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts'
	)
		uses.add('COMMAND_DECLARATIONS');
	if (
		path === 'packages/rph-domain/src/transitions.data.ts' ||
		path === 'packages/rph-domain/src/machine-exclusions.ts'
	)
		uses.add('STATE_MACHINE_DECLARATIONS');
	return [...uses].sort(compareText);
}

function isEligiblePath(path: string): boolean {
	return usesForPath(path).length > 0;
}

function diagnostic(
	code: ArrowCommandCensusArtifactSetDiagnostic['code'],
	message: string,
	path: string | null,
	phase: ArrowCommandCensusArtifactSetDiagnostic['phase']
): ArrowCommandCensusArtifactSetDiagnostic {
	return { code, message, path, phase };
}

function limitDiagnostics(
	diagnostics: readonly ArrowCommandCensusArtifactSetDiagnostic[],
	maximum: number
): readonly ArrowCommandCensusArtifactSetDiagnostic[] {
	if (diagnostics.length <= maximum) return diagnostics;
	const exhausted = diagnostic(
		'BUDGET_EXHAUSTED',
		`Diagnostic population ${diagnostics.length} exceeds the caller reporting budget ${maximum}.`,
		null,
		'RECONCILE'
	);
	return maximum === 1 ? [exhausted] : [...diagnostics.slice(0, maximum - 1), exhausted];
}

function exactPlainRecord(value: unknown, keys: readonly string[]): value is PlainRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return false;
	const own = Reflect.ownKeys(value);
	if (
		own.length !== keys.length ||
		own.some((key) => typeof key !== 'string' || !keys.includes(key))
	)
		return false;
	return keys.every((key) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor;
	});
}

function data(value: PlainRecord, key: string): unknown {
	return Reflect.getOwnPropertyDescriptor(value, key)?.value;
}

function isPositiveSafeInteger(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) > 0;
}

function validateRequest(value: unknown): {
	readonly diagnostics: readonly ArrowCommandCensusArtifactSetDiagnostic[];
	readonly request: BuildArrowCommandCensusArtifactSetRequest | null;
} {
	if (!exactPlainRecord(value, ['budgets', 'operationVersion', 'schemaVersion', 'subjectId']))
		return {
			diagnostics: [
				diagnostic('REQUEST_INVALID', 'Expected the exact request record.', null, 'REQUEST')
			],
			request: null
		};
	const budgets = data(value, 'budgets');
	if (!exactPlainRecord(budgets, ['maxArtifacts', 'maxDiagnostics', 'maxTotalBytes']))
		return {
			diagnostics: [
				diagnostic(
					'REQUEST_INVALID',
					'Expected the exact artifact-set budget record.',
					null,
					'REQUEST'
				)
			],
			request: null
		};
	const typed = value as unknown as BuildArrowCommandCensusArtifactSetRequest;
	const diagnostics: ArrowCommandCensusArtifactSetDiagnostic[] = [];
	if (data(value, 'schemaVersion') !== ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION)
		diagnostics.push(
			diagnostic(
				'REQUEST_INVALID',
				'Unsupported artifact-set request schema version.',
				null,
				'REQUEST'
			)
		);
	if (data(value, 'operationVersion') !== ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION)
		diagnostics.push(
			diagnostic('REQUEST_INVALID', 'Unsupported artifact-set operation version.', null, 'REQUEST')
		);
	if (typeof data(value, 'subjectId') !== 'string' || typed.subjectId.length === 0)
		diagnostics.push(
			diagnostic('REQUEST_INVALID', 'subjectId must be non-empty text.', null, 'REQUEST')
		);
	for (const key of ['maxArtifacts', 'maxDiagnostics', 'maxTotalBytes'] as const)
		if (!isPositiveSafeInteger(data(budgets, key)))
			diagnostics.push(
				diagnostic('REQUEST_INVALID', `${key} must be a positive safe integer.`, null, 'REQUEST')
			);
	return { diagnostics, request: diagnostics.length === 0 ? typed : null };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function bindArtifact(
	subject: FrozenSubject,
	artifact: CapturedArtifactRecord,
	uses: readonly ArrowCommandCensusArtifactUse[]
):
	| { readonly binding: ArrowCommandCensusArtifactBinding; readonly diagnostic?: never }
	| { readonly binding?: never; readonly diagnostic: ArrowCommandCensusArtifactSetDiagnostic } {
	try {
		assertCanonicalRelativePath(artifact.path);
		const bytes = readFrozenSubjectArtifact(subject, artifact.path);
		if (bytes === undefined)
			return {
				diagnostic: diagnostic(
					'ARTIFACT_IDENTITY_INVALID',
					'Frozen bytes are unavailable for the selected manifest row.',
					artifact.path,
					'SELECT'
				)
			};
		const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		const expectedClass = classifyArtifact(artifact.path, source);
		if (
			artifact.canonicalPathKey !== canonicalPathKey(artifact.path) ||
			!Number.isSafeInteger(artifact.bytes) ||
			artifact.bytes < 0 ||
			artifact.bytes !== bytes.byteLength ||
			!SHA256.test(artifact.sha256) ||
			artifact.sha256 !== sha256(bytes) ||
			!['ANALYZED', 'INVENTORY_ONLY'].includes(artifact.disposition) ||
			artifact.disposition !== expectedClass.disposition ||
			artifact.primaryClass !== expectedClass.primaryClass ||
			artifact.reason !== expectedClass.reason ||
			!sameStrings(artifact.roles, expectedClass.roles)
		)
			return {
				diagnostic: diagnostic(
					'ARTIFACT_IDENTITY_INVALID',
					'Selected artifact metadata does not exactly reproduce its frozen bytes and classification.',
					artifact.path,
					'SELECT'
				)
			};
		const disposition = artifact.disposition as 'ANALYZED' | 'INVENTORY_ONLY';
		return {
			binding: {
				bytes: artifact.bytes,
				canonicalPathKey: artifact.canonicalPathKey,
				disposition,
				path: artifact.path,
				primaryClass: artifact.primaryClass,
				reason: artifact.reason,
				roles: [...artifact.roles],
				sha256: artifact.sha256,
				uses: [...uses]
			}
		};
	} catch {
		return {
			diagnostic: diagnostic(
				'ARTIFACT_IDENTITY_INVALID',
				'Selected artifact path, bytes, encoding, or manifest identity is invalid.',
				typeof artifact?.path === 'string' ? artifact.path : null,
				'SELECT'
			)
		};
	}
}

interface DerivedPopulation {
	readonly artifacts: readonly ArrowCommandCensusArtifactBinding[];
	readonly diagnostics: readonly ArrowCommandCensusArtifactSetDiagnostic[];
}

function derivePopulation(subject: FrozenSubject): DerivedPopulation {
	const diagnostics: ArrowCommandCensusArtifactSetDiagnostic[] = [];
	const rowsByPath = new Map<string, CapturedArtifactRecord[]>();
	for (const artifact of subject.artifacts) {
		if (!isEligiblePath(artifact.path)) continue;
		const rows = rowsByPath.get(artifact.path) ?? [];
		rows.push(artifact);
		rowsByPath.set(artifact.path, rows);
	}
	for (const excluded of subject.excludedArtifacts) {
		if (!isEligiblePath(excluded.path)) continue;
		if (OPTIONAL_ENVIRONMENT_PATHS.has(excluded.path)) continue;
		diagnostics.push(
			diagnostic(
				'POPULATION_RECONCILIATION_FAILED',
				'An artifact required by an eligible census population is excluded from the frozen subject.',
				excluded.path,
				'RECONCILE'
			)
		);
	}
	for (const path of REQUIRED_PATHS) {
		const count = rowsByPath.get(path)?.length ?? 0;
		if (count === 0)
			diagnostics.push(
				diagnostic(
					'REQUIRED_ARTIFACT_MISSING',
					'Required retained-verifier artifact is absent from the frozen subject.',
					path,
					'SELECT'
				)
			);
	}
	for (const [path, rows] of rowsByPath)
		if (rows.length !== 1)
			diagnostics.push(
				diagnostic(
					'AMBIGUOUS_REQUIRED_ARTIFACT',
					`Eligible artifact has ${rows.length} manifest rows; exactly one is required.`,
					path,
					'SELECT'
				)
			);
	const pathsByCanonicalKey = new Map<string, string[]>();
	for (const [path] of rowsByPath) {
		const key = canonicalPathKey(path);
		const paths = pathsByCanonicalKey.get(key) ?? [];
		paths.push(path);
		pathsByCanonicalKey.set(key, paths);
	}
	for (const paths of pathsByCanonicalKey.values())
		if (paths.length > 1)
			diagnostics.push(
				diagnostic(
					'AMBIGUOUS_REQUIRED_ARTIFACT',
					`Eligible paths collide under canonical comparison: ${paths.sort(compareText).join(', ')}.`,
					paths[0] ?? null,
					'SELECT'
				)
			);
	const eligiblePaths = [...rowsByPath.keys()];
	for (const [label, predicate] of [
		['direct handler', isHandlerSourcePath],
		[
			'rph-domain package source',
			(path: string) => isProductionTypeScriptPath(path, DOMAIN_SOURCE_PREFIX)
		],
		[
			'rph-contracts package source',
			(path: string) => isProductionTypeScriptPath(path, CONTRACTS_SOURCE_PREFIX)
		]
	] as const)
		if (!eligiblePaths.some(predicate))
			diagnostics.push(
				diagnostic(
					'UNSUPPORTED_REPOSITORY_LAYOUT',
					`The frozen subject contains no eligible ${label} population.`,
					null,
					'RECONCILE'
				)
			);
	const artifacts: ArrowCommandCensusArtifactBinding[] = [];
	for (const [path, rows] of [...rowsByPath].sort(([left], [right]) => compareText(left, right))) {
		if (rows.length !== 1) continue;
		const result = bindArtifact(subject, rows[0]!, usesForPath(path));
		if (result.diagnostic) diagnostics.push(result.diagnostic);
		else artifacts.push(result.binding);
	}
	return { artifacts, diagnostics };
}

function coverageFor(
	artifacts: readonly ArrowCommandCensusArtifactBinding[]
): ArrowCommandCensusArtifactSetCoverage {
	const count = (use: ArrowCommandCensusArtifactUse) =>
		artifacts.filter((artifact) => artifact.uses.includes(use)).length;
	return {
		artifacts: artifacts.length,
		baselineArtifacts: count('BASELINE'),
		commandDeclarationArtifacts: count('COMMAND_DECLARATIONS'),
		contractSchemaArtifacts: count('CONTRACT_SCHEMA_SOURCE'),
		environmentIdentityArtifacts: count('ENVIRONMENT_IDENTITY'),
		executorSourceArtifacts: count('EXECUTOR_SOURCE'),
		executorTestArtifacts: count('EXECUTOR_TEST'),
		handlerSourceArtifacts: count('HANDLER_SOURCE'),
		packageManifestArtifacts: count('PACKAGE_MANIFEST'),
		packageSourceArtifacts: count('PACKAGE_SOURCE'),
		reconciles: new Set(artifacts.map((artifact) => artifact.path)).size === artifacts.length,
		stateMachineDeclarationArtifacts: count('STATE_MACHINE_DECLARATIONS')
	};
}

export function buildArrowCommandCensusArtifactSet(
	requestValue: BuildArrowCommandCensusArtifactSetRequest,
	dependencies: ArrowCommandCensusArtifactSetDependencies
): BuildArrowCommandCensusArtifactSetOutcome {
	const validated = validateRequest(requestValue);
	if (validated.request === null)
		return { diagnostics: validated.diagnostics, outcome: 'unavailable' };
	const request = validated.request;
	try {
		const subject = dependencies?.subject;
		if (!isFrozenSubjectCapability(subject) || isProxy(subject))
			return {
				diagnostics: [
					diagnostic(
						'SUBJECT_CAPABILITY_UNAVAILABLE',
						'An exact FrozenSubject byte capability is required.',
						null,
						'SELECT'
					)
				],
				outcome: 'unavailable'
			};
		if (subject.descriptor.subjectId !== request.subjectId)
			return {
				diagnostics: [
					diagnostic(
						'SUBJECT_ID_MISMATCH',
						'Request subjectId does not identify the supplied FrozenSubject.',
						null,
						'SELECT'
					)
				],
				outcome: 'unavailable'
			};
		const derived = derivePopulation(subject);
		const diagnostics = [...derived.diagnostics];
		if (derived.artifacts.length > request.budgets.maxArtifacts)
			diagnostics.push(
				diagnostic(
					'BUDGET_EXHAUSTED',
					`Selected artifact population ${derived.artifacts.length} exceeds maxArtifacts ${request.budgets.maxArtifacts}.`,
					null,
					'SELECT'
				)
			);
		const totalBytes = derived.artifacts.reduce((total, artifact) => total + artifact.bytes, 0);
		if (!Number.isSafeInteger(totalBytes) || totalBytes > request.budgets.maxTotalBytes)
			diagnostics.push(
				diagnostic(
					'BUDGET_EXHAUSTED',
					`Selected byte population ${totalBytes} exceeds maxTotalBytes ${request.budgets.maxTotalBytes}.`,
					null,
					'SELECT'
				)
			);
		if (diagnostics.length > 0)
			return {
				diagnostics: limitDiagnostics(diagnostics, request.budgets.maxDiagnostics),
				outcome: 'unavailable'
			};
		const artifacts = derived.artifacts;
		const artifactSetDigest = arrowCommandCensusArtifactSetDigest(artifacts);
		const id = arrowCommandCensusArtifactSetId({
			artifactSetDigest,
			method: ARROW_COMMAND_CENSUS_METHOD,
			schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION,
			subjectId: request.subjectId
		});
		const content = {
			artifactSetDigest,
			artifacts,
			coverage: coverageFor(artifacts),
			id,
			method: ARROW_COMMAND_CENSUS_METHOD,
			schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION,
			subjectId: request.subjectId
		};
		const artifactSet = {
			...content,
			contentDigest: arrowCommandCensusArtifactSetContentDigest(content)
		};
		const validation = validateArrowCommandCensusArtifactSet(artifactSet, subject, {
			maxIssues: request.budgets.maxDiagnostics
		});
		if (validation.state !== 'VALID')
			return {
				diagnostics: [
					diagnostic(
						'POPULATION_RECONCILIATION_FAILED',
						validation.issues[0]?.message ?? 'Artifact-set validation failed.',
						validation.issues[0]?.path ?? null,
						'RECONCILE'
					)
				],
				outcome: 'unavailable'
			};
		return { artifactSet, diagnostics: [], outcome: 'complete' };
	} catch {
		return {
			diagnostics: [
				diagnostic(
					'ARTIFACT_IDENTITY_INVALID',
					'Artifact-set selection encountered hostile or malformed subject state.',
					null,
					'SELECT'
				)
			],
			outcome: 'unavailable'
		};
	}
}

export const selectArrowCommandCensusArtifactSet = buildArrowCommandCensusArtifactSet;

function denseArray(value: unknown): value is readonly unknown[] {
	if (!Array.isArray(value) || isProxy(value)) return false;
	const keys = Reflect.ownKeys(value);
	return (
		keys.length === value.length + 1 &&
		keys.every(
			(key) => typeof key === 'string' && (key === 'length' || /^(?:0|[1-9][0-9]*)$/u.test(key))
		)
	);
}

function validStringArray(
	value: unknown,
	allowed?: ReadonlySet<string>
): value is readonly string[] {
	return (
		denseArray(value) &&
		value.every(
			(entry) => typeof entry === 'string' && (allowed === undefined || allowed.has(entry))
		)
	);
}

function shapeIssue(value: unknown): ArrowCommandCensusValidationIssue | null {
	if (
		!exactPlainRecord(value, [
			'artifactSetDigest',
			'artifacts',
			'contentDigest',
			'coverage',
			'id',
			'method',
			'schemaVersion',
			'subjectId'
		])
	)
		return { code: 'INVALID_SHAPE', message: 'Expected exact artifact-set record.', path: '$' };
	const artifacts = data(value, 'artifacts');
	if (!denseArray(artifacts))
		return {
			code: 'INVALID_SHAPE',
			message: 'Expected a dense artifact array.',
			path: '$.artifacts'
		};
	for (let index = 0; index < artifacts.length; index += 1) {
		const artifact = artifacts[index];
		const path = `$.artifacts[${index}]`;
		if (
			!exactPlainRecord(artifact, [
				'bytes',
				'canonicalPathKey',
				'disposition',
				'path',
				'primaryClass',
				'reason',
				'roles',
				'sha256',
				'uses'
			])
		)
			return { code: 'INVALID_SHAPE', message: 'Expected exact artifact binding.', path };
		const roles = data(artifact, 'roles');
		const uses = data(artifact, 'uses');
		if (
			!Number.isSafeInteger(data(artifact, 'bytes')) ||
			(data(artifact, 'bytes') as number) < 0 ||
			typeof data(artifact, 'canonicalPathKey') !== 'string' ||
			!['ANALYZED', 'INVENTORY_ONLY'].includes(data(artifact, 'disposition') as string) ||
			typeof data(artifact, 'path') !== 'string' ||
			!PRIMARY_CLASSES.has(data(artifact, 'primaryClass') as ArtifactPrimaryClass) ||
			typeof data(artifact, 'reason') !== 'string' ||
			!validStringArray(roles, SEMANTIC_ROLES) ||
			typeof data(artifact, 'sha256') !== 'string' ||
			!SHA256.test(data(artifact, 'sha256') as string) ||
			!validStringArray(uses, ARTIFACT_USE_SET)
		)
			return {
				code: 'INVALID_VALUE',
				message: 'Artifact binding contains an invalid value.',
				path
			};
	}
	const coverage = data(value, 'coverage');
	const coverageKeys = [
		'artifacts',
		'baselineArtifacts',
		'commandDeclarationArtifacts',
		'contractSchemaArtifacts',
		'environmentIdentityArtifacts',
		'executorSourceArtifacts',
		'executorTestArtifacts',
		'handlerSourceArtifacts',
		'packageManifestArtifacts',
		'packageSourceArtifacts',
		'reconciles',
		'stateMachineDeclarationArtifacts'
	] as const;
	if (!exactPlainRecord(coverage, coverageKeys))
		return {
			code: 'INVALID_SHAPE',
			message: 'Expected exact coverage record.',
			path: '$.coverage'
		};
	for (const key of coverageKeys)
		if (
			(key === 'reconciles' && typeof data(coverage, key) !== 'boolean') ||
			(key !== 'reconciles' &&
				(!Number.isSafeInteger(data(coverage, key)) || (data(coverage, key) as number) < 0))
		)
			return {
				code: 'INVALID_VALUE',
				message: 'Coverage contains an invalid value.',
				path: `$.coverage.${key}`
			};
	for (const key of ['artifactSetDigest', 'contentDigest'] as const)
		if (typeof data(value, key) !== 'string' || !SHA256.test(data(value, key) as string))
			return { code: 'INVALID_VALUE', message: 'Expected a SHA-256 digest.', path: `$.${key}` };
	for (const key of ['id', 'method', 'schemaVersion', 'subjectId'] as const)
		if (typeof data(value, key) !== 'string' || (data(value, key) as string).length === 0)
			return { code: 'INVALID_VALUE', message: 'Expected non-empty text.', path: `$.${key}` };
	return null;
}

export function validateArrowCommandCensusArtifactSet(
	value: unknown,
	subject?: FrozenSubject,
	options: ArrowCommandCensusValidationOptions = {}
): ArrowCommandCensusValidationResult {
	try {
		let maxIssues = Number.POSITIVE_INFINITY;
		if (!exactPlainRecord(options, options.maxIssues === undefined ? [] : ['maxIssues']))
			return {
				issues: [
					{ code: 'INVALID_SHAPE', message: 'Expected exact validation options.', path: '$options' }
				],
				state: 'INVALID'
			};
		if (options.maxIssues !== undefined) {
			if (!isPositiveSafeInteger(options.maxIssues))
				return {
					issues: [
						{
							code: 'INVALID_VALUE',
							message: 'maxIssues must be a positive safe integer.',
							path: '$options.maxIssues'
						}
					],
					state: 'INVALID'
				};
			maxIssues = options.maxIssues;
		}
		const malformed = shapeIssue(value);
		if (malformed !== null) return { issues: [malformed], state: 'INVALID' };
		if (subject !== undefined && (!isFrozenSubjectCapability(subject) || isProxy(subject)))
			return {
				issues: [
					{
						code: 'IDENTITY_MISMATCH',
						message: 'An exact FrozenSubject byte capability is required.',
						path: '$subject'
					}
				],
				state: 'INVALID'
			};
		const artifactSet =
			value as import('../../contracts/arrow-command-census.js').ArrowCommandCensusArtifactSetBinding;
		const allIssues: ArrowCommandCensusValidationIssue[] = [];
		const add = (code: ArrowCommandCensusValidationIssue['code'], path: string, message: string) =>
			allIssues.push({ code, message, path });
		if (artifactSet.schemaVersion !== ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION)
			add(
				'UNSUPPORTED_SCHEMA_VERSION',
				'$.schemaVersion',
				'Unsupported artifact-set schema version.'
			);
		if (artifactSet.method !== ARROW_COMMAND_CENSUS_METHOD)
			add(
				'IDENTITY_MISMATCH',
				'$.method',
				'Artifact-set method is not the registered adapter method.'
			);
		if (subject !== undefined && artifactSet.subjectId !== subject.descriptor.subjectId)
			add('IDENTITY_MISMATCH', '$.subjectId', 'Artifact set identifies a different FrozenSubject.');
		for (let index = 0; index < artifactSet.artifacts.length; index += 1) {
			const current = artifactSet.artifacts[index]!;
			if (index > 0 && compareText(artifactSet.artifacts[index - 1]!.path, current.path) >= 0)
				add(
					'NONCANONICAL_ORDER',
					`$.artifacts[${index}].path`,
					'Artifact paths must be strictly ordered.'
				);
			if (
				new Set(current.uses).size !== current.uses.length ||
				!sameStrings([...current.uses].sort(compareText), current.uses)
			)
				add(
					'NONCANONICAL_ORDER',
					`$.artifacts[${index}].uses`,
					'Artifact uses must be unique and ordered.'
				);
		}
		const derived =
			subject === undefined
				? { artifacts: artifactSet.artifacts, diagnostics: [] }
				: derivePopulation(subject);
		for (const cause of derived.diagnostics)
			add('RECONCILIATION_MISMATCH', '$subject', cause.message);
		if (derived.artifacts.length !== artifactSet.artifacts.length)
			add(
				'POPULATION_MISMATCH',
				'$.artifacts',
				'Artifact population length does not match the FrozenSubject.'
			);
		const maximum = Math.max(derived.artifacts.length, artifactSet.artifacts.length);
		for (let index = 0; index < maximum; index += 1) {
			const expected = derived.artifacts[index];
			const actual = artifactSet.artifacts[index];
			if (
				expected === undefined ||
				actual === undefined ||
				canonicalJson(expected) !== canonicalJson(actual)
			)
				add(
					'POPULATION_MISMATCH',
					`$.artifacts[${index}]`,
					'Artifact binding differs from the exact selected manifest row.'
				);
		}
		const expectedCoverage = coverageFor(derived.artifacts);
		if (canonicalJson(artifactSet.coverage) !== canonicalJson(expectedCoverage))
			add(
				'RECONCILIATION_MISMATCH',
				'$.coverage',
				'Coverage does not reproduce the selected population.'
			);
		const expectedArtifactSetDigest = arrowCommandCensusArtifactSetDigest(artifactSet.artifacts);
		if (artifactSet.artifactSetDigest !== expectedArtifactSetDigest)
			add(
				'CONTENT_DIGEST_MISMATCH',
				'$.artifactSetDigest',
				'Artifact population digest does not reproduce.'
			);
		const expectedId = arrowCommandCensusArtifactSetId({
			artifactSetDigest: artifactSet.artifactSetDigest,
			method: artifactSet.method,
			schemaVersion: artifactSet.schemaVersion,
			subjectId: artifactSet.subjectId
		});
		if (artifactSet.id !== expectedId)
			add('IDENTITY_MISMATCH', '$.id', 'Artifact-set identity does not reproduce.');
		if (artifactSet.contentDigest !== arrowCommandCensusArtifactSetContentDigest(artifactSet))
			add(
				'CONTENT_DIGEST_MISMATCH',
				'$.contentDigest',
				'Artifact-set content digest does not reproduce.'
			);
		if (allIssues.length === 0) return { issues: [], state: 'VALID' };
		return {
			issues: allIssues.slice(0, maxIssues),
			state: allIssues.length > maxIssues ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};
	} catch {
		return {
			issues: [
				{
					code: 'INVALID_SHAPE',
					message: 'Artifact-set validation encountered hostile input.',
					path: '$'
				}
			],
			state: 'INVALID'
		};
	}
}
