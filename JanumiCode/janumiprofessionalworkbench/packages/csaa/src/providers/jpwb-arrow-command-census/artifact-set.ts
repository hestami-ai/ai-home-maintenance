import { isProxy } from 'node:util/types';

import {
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_METHOD,
	type ArrowCommandCensusArtifactBinding,
	type ArrowCommandCensusArtifactSetBinding,
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
import { resolveFrozenModuleClosure } from '../../subject/analyzer-closure.js';
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
// Its OWN budget, deliberately not the artifact budget: sharing one number would couple two unrelated failure
// modes, so a large subject could silently truncate the closure.
const MAX_CLOSURE_NODES = 64;

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

// ⚠ THIS LIST IS A HAND-DUPLICATED MIRROR of the `ArrowCommandCensusArtifactUse` union, and `satisfies` does NOT
// force the two to agree: it checks that every element is assignable to the union, never that every member of the
// union is present. Omitting a member here is therefore TYPE-LEGAL and fails silently at validation — the binding
// carrying it is rejected as INVALID_VALUE — instead of failing to compile. Edit both in lockstep. (The sibling
// provider writes this as `new Set<T>([...])`, which has the identical subset hole in different syntax.)
const ARTIFACT_USES = [
	'BASELINE',
	'COMMAND_DECLARATIONS',
	'CONTRACT_SCHEMA_SOURCE',
	'ENVIRONMENT_IDENTITY',
	'EXECUTOR_DEPENDENCY_SOURCE',
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

/**
 * Each optional clause is built as its own top-level literal rather than inside the sentence, so the message
 * text is assembled from flat pieces and reads the same as it always did.
 */
function undecidableClosureMessage(
	code: string,
	specifier: string | null,
	importerPath: string | null,
	resolvedCandidate: string | null
): string {
	const forSpecifier = specifier === null ? '' : ` for '${specifier}'`;
	const inImporter = importerPath === null ? '' : ` in ${importerPath}`;
	const withResolved = resolvedCandidate === null ? '' : ` (resolved to ${resolvedCandidate})`;
	return `Retained executor import closure is undecidable: ${code}${forSpecifier}${inImporter}${withResolved}.`;
}

/**
 * The capsule must contain everything the retained executor IMPORTS, and that population is DERIVED from the
 * executor's own frozen source rather than listed above.
 *
 * ⚠⚠ ROOTED AT THE ANALYZER ALONE, AND THE OMISSIONS ARE THE DESIGN. `ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS`
 * holds four entries and only ONE of them is ever loaded as a module: `worker.ts:431` does
 * `await import(analyzerResolvedPath)`, while the BASELINE is `readFileSync`-ed and JSON-parsed at `worker.ts:234`
 * and the two AUTHORITY TESTS are materialised into the capsule but never executed. Rooting at the convenient
 * four-entry list would drag the tests' specifiers in, `vitest` among them — a bare specifier the capsule cannot
 * satisfy, since `linkModule` junctions only typescript, ulid and zod. Fixing this defect by rooting at the
 * obvious list would have created a new one.
 *
 * The executor's four current imports — `node:fs`, `typescript`, `@janumipwb/rph-domain`,
 * `@janumipwb/rph-contracts` — are all BARE, and `resolveFrozenModuleClosure` collects bare specifiers into
 * `bareSpecifiers` rather than reporting them as findings. So this derivation returns an EMPTY closure today and
 * the provider is unaffected. That is a fact about the executor as it stands, not a property of the wiring.
 */
function executorClosure(subject: FrozenSubject): {
	readonly diagnostics: readonly ArrowCommandCensusArtifactSetDiagnostic[];
	readonly paths: ReadonlySet<string>;
} {
	const closure = resolveFrozenModuleClosure({
		entryPaths: [ANALYZER_PATH],
		maxClosureNodes: MAX_CLOSURE_NODES,
		subject
	});
	return {
		// A specifier the closure cannot resolve was SILENT before this existed, and that silence was the defect.
		diagnostics: closure.findings.map((f) =>
			diagnostic(
				'POPULATION_RECONCILIATION_FAILED',
				undecidableClosureMessage(f.code, f.specifier, f.importerPath, f.resolvedCandidate),
				f.path,
				'RECONCILE'
			)
		),
		// `dependencies` EXCLUDES the entry paths, which is why `EXECUTOR_SOURCE` stays exactly one binding and the
		// executor never labels itself its own dependency.
		paths: new Set(closure.dependencies)
	};
}

function usesForPath(
	path: string,
	executorDependencyPaths: ReadonlySet<string>
): readonly ArrowCommandCensusArtifactUse[] {
	const uses = new Set<ArrowCommandCensusArtifactUse>();
	if (path === ANALYZER_PATH) uses.add('EXECUTOR_SOURCE');
	if (executorDependencyPaths.has(path)) uses.add('EXECUTOR_DEPENDENCY_SOURCE');
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

function isEligiblePath(path: string, executorDependencyPaths: ReadonlySet<string>): boolean {
	return usesForPath(path, executorDependencyPaths).length > 0;
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

function eligibleRowsByPath(
	subject: FrozenSubject,
	closurePaths: ReadonlySet<string>
): Map<string, CapturedArtifactRecord[]> {
	const rowsByPath = new Map<string, CapturedArtifactRecord[]>();
	for (const artifact of subject.artifacts) {
		if (!isEligiblePath(artifact.path, closurePaths)) continue;
		const rows = rowsByPath.get(artifact.path) ?? [];
		rows.push(artifact);
		rowsByPath.set(artifact.path, rows);
	}
	return rowsByPath;
}

function collectExcludedArtifactDiagnostics(
	subject: FrozenSubject,
	closurePaths: ReadonlySet<string>,
	diagnostics: ArrowCommandCensusArtifactSetDiagnostic[]
): void {
	for (const excluded of subject.excludedArtifacts) {
		if (!isEligiblePath(excluded.path, closurePaths)) continue;
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
}

// A derived closure member absent from the subject is exactly as fatal as a missing REQUIRED_PATH: the capsule
// would be written without it and the executor's dynamic import would fail inside the worker.
function collectMissingRequiredDiagnostics(
	rowsByPath: ReadonlyMap<string, readonly CapturedArtifactRecord[]>,
	closurePaths: ReadonlySet<string>,
	diagnostics: ArrowCommandCensusArtifactSetDiagnostic[]
): void {
	for (const path of [...REQUIRED_PATHS, ...closurePaths]) {
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
}

function collectAmbiguousRowDiagnostics(
	rowsByPath: ReadonlyMap<string, readonly CapturedArtifactRecord[]>,
	diagnostics: ArrowCommandCensusArtifactSetDiagnostic[]
): void {
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
}

function collectCanonicalKeyCollisionDiagnostics(
	rowsByPath: ReadonlyMap<string, readonly CapturedArtifactRecord[]>,
	diagnostics: ArrowCommandCensusArtifactSetDiagnostic[]
): void {
	const pathsByCanonicalKey = new Map<string, string[]>();
	for (const [path] of rowsByPath) {
		const key = canonicalPathKey(path);
		const paths = pathsByCanonicalKey.get(key) ?? [];
		paths.push(path);
		pathsByCanonicalKey.set(key, paths);
	}
	for (const paths of pathsByCanonicalKey.values())
		if (paths.length > 1) {
			// Ordered in place because the list was accumulated locally just above and is shared with nobody;
			// the reported path is still read AFTER the ordering, exactly as it was.
			paths.sort(compareText);
			diagnostics.push(
				diagnostic(
					'AMBIGUOUS_REQUIRED_ARTIFACT',
					`Eligible paths collide under canonical comparison: ${paths.join(', ')}.`,
					paths[0] ?? null,
					'SELECT'
				)
			);
		}
}

function collectUnsupportedLayoutDiagnostics(
	eligiblePaths: readonly string[],
	diagnostics: ArrowCommandCensusArtifactSetDiagnostic[]
): void {
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
}

function derivePopulation(subject: FrozenSubject): DerivedPopulation {
	const closureSelection = executorClosure(subject);
	const diagnostics: ArrowCommandCensusArtifactSetDiagnostic[] = [...closureSelection.diagnostics];
	const rowsByPath = eligibleRowsByPath(subject, closureSelection.paths);
	collectExcludedArtifactDiagnostics(subject, closureSelection.paths, diagnostics);
	collectMissingRequiredDiagnostics(rowsByPath, closureSelection.paths, diagnostics);
	collectAmbiguousRowDiagnostics(rowsByPath, diagnostics);
	collectCanonicalKeyCollisionDiagnostics(rowsByPath, diagnostics);
	collectUnsupportedLayoutDiagnostics([...rowsByPath.keys()], diagnostics);
	const artifacts: ArrowCommandCensusArtifactBinding[] = [];
	for (const [path, rows] of [...rowsByPath].sort(([left], [right]) => compareText(left, right))) {
		if (rows.length !== 1) continue;
		// ⚠ THE BINDING SITE, not a selection site, and the ONLY one of the three whose failure is silent.
		// Omitting the argument entirely is a compile error here, because the parameter is required — but passing
		// the WRONG set is not: selection still admits the dependency, this call drops its `uses`, and the result
		// is a valid-looking artifact set whose dependency counter reads 0 with no diagnostic and no refusal.
		// Measured, not assumed: the two selection sites fail LOUDLY (`outcome: 'unavailable'`), this one only
		// changes a number. Held by `F195-the-binding-site-forgets-what-selection-decided`.
		const result = bindArtifact(subject, rows[0]!, usesForPath(path, closureSelection.paths));
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
		executorDependencyArtifacts: count('EXECUTOR_DEPENDENCY_SOURCE'),
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
			(key) => typeof key === 'string' && (key === 'length' || /^(?:0|[1-9]\d*)$/u.test(key))
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

function artifactBindingIssue(
	artifact: unknown,
	path: string
): ArrowCommandCensusValidationIssue | null {
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
	return null;
}

function artifactBindingsIssue(
	artifacts: readonly unknown[]
): ArrowCommandCensusValidationIssue | null {
	for (let index = 0; index < artifacts.length; index += 1) {
		const issue = artifactBindingIssue(artifacts[index], `$.artifacts[${index}]`);
		if (issue !== null) return issue;
	}
	return null;
}

function coverageValueIsValid(coverage: PlainRecord, key: string): boolean {
	const entry = data(coverage, key);
	if (key === 'reconciles') return typeof entry === 'boolean';
	return Number.isSafeInteger(entry) && (entry as number) >= 0;
}

function coverageRecordIssue(coverage: unknown): ArrowCommandCensusValidationIssue | null {
	const coverageKeys = [
		'artifacts',
		'baselineArtifacts',
		'commandDeclarationArtifacts',
		'contractSchemaArtifacts',
		'environmentIdentityArtifacts',
		'executorDependencyArtifacts',
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
		if (!coverageValueIsValid(coverage, key))
			return {
				code: 'INVALID_VALUE',
				message: 'Coverage contains an invalid value.',
				path: `$.coverage.${key}`
			};
	return null;
}

function digestAndIdentityIssue(value: PlainRecord): ArrowCommandCensusValidationIssue | null {
	for (const key of ['artifactSetDigest', 'contentDigest'] as const)
		if (typeof data(value, key) !== 'string' || !SHA256.test(data(value, key) as string))
			return { code: 'INVALID_VALUE', message: 'Expected a SHA-256 digest.', path: `$.${key}` };
	for (const key of ['id', 'method', 'schemaVersion', 'subjectId'] as const)
		if (typeof data(value, key) !== 'string' || (data(value, key) as string).length === 0)
			return { code: 'INVALID_VALUE', message: 'Expected non-empty text.', path: `$.${key}` };
	return null;
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
	const bindingIssue = artifactBindingsIssue(artifacts);
	if (bindingIssue !== null) return bindingIssue;
	const coverageIssue = coverageRecordIssue(data(value, 'coverage'));
	if (coverageIssue !== null) return coverageIssue;
	return digestAndIdentityIssue(value);
}

type IssueSink = (
	code: ArrowCommandCensusValidationIssue['code'],
	path: string,
	message: string
) => void;

function validationOptionsIssue(
	options: ArrowCommandCensusValidationOptions
): ArrowCommandCensusValidationIssue | null {
	if (!exactPlainRecord(options, options.maxIssues === undefined ? [] : ['maxIssues']))
		return {
			code: 'INVALID_SHAPE',
			message: 'Expected exact validation options.',
			path: '$options'
		};
	if (options.maxIssues !== undefined && !isPositiveSafeInteger(options.maxIssues))
		return {
			code: 'INVALID_VALUE',
			message: 'maxIssues must be a positive safe integer.',
			path: '$options.maxIssues'
		};
	return null;
}

function addIdentityIssues(
	artifactSet: ArrowCommandCensusArtifactSetBinding,
	subject: FrozenSubject | undefined,
	add: IssueSink
): void {
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
}

function addArtifactOrderIssues(
	artifacts: readonly ArrowCommandCensusArtifactBinding[],
	add: IssueSink
): void {
	for (let index = 0; index < artifacts.length; index += 1) {
		const current = artifacts[index]!;
		if (index > 0 && compareText(artifacts[index - 1]!.path, current.path) >= 0)
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
}

function addPopulationIssues(
	derivedArtifacts: readonly ArrowCommandCensusArtifactBinding[],
	actualArtifacts: readonly ArrowCommandCensusArtifactBinding[],
	add: IssueSink
): void {
	if (derivedArtifacts.length !== actualArtifacts.length)
		add(
			'POPULATION_MISMATCH',
			'$.artifacts',
			'Artifact population length does not match the FrozenSubject.'
		);
	const maximum = Math.max(derivedArtifacts.length, actualArtifacts.length);
	for (let index = 0; index < maximum; index += 1) {
		const expected = derivedArtifacts[index];
		const actual = actualArtifacts[index];
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
}

function addReproductionIssues(
	artifactSet: ArrowCommandCensusArtifactSetBinding,
	derivedArtifacts: readonly ArrowCommandCensusArtifactBinding[],
	add: IssueSink
): void {
	const expectedCoverage = coverageFor(derivedArtifacts);
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
}

export function validateArrowCommandCensusArtifactSet(
	value: unknown,
	subject?: FrozenSubject,
	options: ArrowCommandCensusValidationOptions = {}
): ArrowCommandCensusValidationResult {
	try {
		const optionIssue = validationOptionsIssue(options);
		if (optionIssue !== null) return { issues: [optionIssue], state: 'INVALID' };
		const maxIssues = options.maxIssues ?? Number.POSITIVE_INFINITY;
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
		const artifactSet = value as ArrowCommandCensusArtifactSetBinding;
		const allIssues: ArrowCommandCensusValidationIssue[] = [];
		const add = (code: ArrowCommandCensusValidationIssue['code'], path: string, message: string) =>
			allIssues.push({ code, message, path });
		addIdentityIssues(artifactSet, subject, add);
		addArtifactOrderIssues(artifactSet.artifacts, add);
		const derived =
			subject === undefined
				? { artifacts: artifactSet.artifacts, diagnostics: [] }
				: derivePopulation(subject);
		for (const cause of derived.diagnostics)
			add('RECONCILIATION_MISMATCH', '$subject', cause.message);
		addPopulationIssues(derived.artifacts, artifactSet.artifacts, add);
		addReproductionIssues(artifactSet, derived.artifacts, add);
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
