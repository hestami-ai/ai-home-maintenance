import { isProxy } from 'node:util/types';

import ts from 'typescript';

import {
	GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE,
	GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
	GUARD_ENFORCEMENT_LEDGER_METHOD,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	GUARD_ENFORCEMENT_LEDGER_TEST_PATH,
	type BuildGuardEnforcementLedgerArtifactSetOutcome,
	type BuildGuardEnforcementLedgerArtifactSetRequest,
	type GuardEnforcementLedgerArtifactBinding,
	type GuardEnforcementLedgerArtifactSetCoverage,
	type GuardEnforcementLedgerArtifactSetDiagnostic,
	type GuardEnforcementLedgerArtifactUse,
	type GuardEnforcementLedgerValidationIssue,
	type GuardEnforcementLedgerValidationOptions,
	type GuardEnforcementLedgerValidationResult
} from '../../contracts/guard-enforcement-ledger.js';
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
import { resolveFrozenModuleClosure } from '../../subject/analyzer-closure.js';
import { assertCanonicalRelativePath, canonicalPathKey } from '../../subject/paths.js';
import { canonicalSemanticJsonWitness } from '../../semantic/canonical.js';
import {
	guardEnforcementLedgerArtifactSetContentDigest,
	guardEnforcementLedgerArtifactSetId
} from './guard-enforcement-ledger-content.js';

const DOMAIN_MANIFEST_PATH = 'packages/rph-domain/package.json';
const CONTRACTS_MANIFEST_PATH = 'packages/rph-contracts/package.json';
const DOMAIN_SOURCE_PREFIX = 'packages/rph-domain/src/';
const CONTRACTS_SOURCE_PREFIX = 'packages/rph-contracts/src/';
const STATE_MACHINE_PATHS = new Set([
	'packages/rph-domain/src/machine-exclusions.ts',
	'packages/rph-domain/src/transitions.data.ts'
]);
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
	...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	DOMAIN_MANIFEST_PATH,
	CONTRACTS_MANIFEST_PATH,
	'packages/rph-domain/src/index.ts',
	'packages/rph-domain/src/machine-exclusions.ts',
	'packages/rph-domain/src/transitions.data.ts',
	'packages/rph-contracts/src/index.ts'
] as const;

// ⚠ This Set is a HAND-DUPLICATED MIRROR of the `GuardEnforcementLedgerArtifactUse` union and TypeScript does not
// force the two to agree — `new Set<T>([...])` accepts any subset, so omitting a member here is type-legal and
// would silently reject that member at validation instead of failing to compile. Edit both in lockstep.
const ARTIFACT_USES = new Set<GuardEnforcementLedgerArtifactUse>([
	'ANALYZER_DEPENDENCY_SOURCE',
	'ANALYZER_SOURCE',
	'AUTHORITY_TEST',
	'ENVIRONMENT_IDENTITY',
	'ENFORCEMENT_SITE_SOURCE',
	'LEDGER_DATA',
	'PACKAGE_MANIFEST',
	'PACKAGE_SOURCE',
	'STATE_MACHINE_DECLARATIONS'
]);
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

export interface GuardEnforcementLedgerArtifactSetDependencies {
	readonly subject: FrozenSubject;
}

type PlainRecord = Record<string, unknown>;

function diagnostic(
	code: GuardEnforcementLedgerArtifactSetDiagnostic['code'],
	message: string,
	path: string | null,
	phase: GuardEnforcementLedgerArtifactSetDiagnostic['phase']
): GuardEnforcementLedgerArtifactSetDiagnostic {
	return { code, message, path, phase };
}

function exactPlainRecord(value: unknown, keys: readonly string[]): value is PlainRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return false;
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return false;
	}
	let enumerableCount = 0;
	for (const key in value) {
		if (!Object.hasOwn(value, key)) continue;
		enumerableCount += 1;
		if (enumerableCount > keys.length || !keys.includes(key)) return false;
	}
	if (enumerableCount !== keys.length) return false;
	const own = Reflect.ownKeys(value);
	if (
		own.length !== keys.length ||
		own.some((key) => typeof key !== 'string' || !keys.includes(key))
	)
		return false;
	return true;
}

function data(value: PlainRecord, key: string): unknown {
	return Reflect.getOwnPropertyDescriptor(value, key)?.value;
}

function validationOptionsRecord(value: unknown): value is PlainRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return false;
	const allowed = new Set(['maxIssues', 'maxRecords', 'maxStringCharacters']);
	return Reflect.ownKeys(value).every((key) => {
		if (typeof key !== 'string' || !allowed.has(key)) return false;
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor;
	});
}

function positiveSafeInteger(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) > 0;
}

function validateRequest(value: unknown): {
	readonly diagnostics: readonly GuardEnforcementLedgerArtifactSetDiagnostic[];
	readonly request: BuildGuardEnforcementLedgerArtifactSetRequest | null;
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
	const typed = value as unknown as BuildGuardEnforcementLedgerArtifactSetRequest;
	const diagnostics: GuardEnforcementLedgerArtifactSetDiagnostic[] = [];
	if (typed.schemaVersion !== GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION)
		diagnostics.push(
			diagnostic('REQUEST_INVALID', 'Unsupported request schema version.', null, 'REQUEST')
		);
	if (typed.operationVersion !== GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION)
		diagnostics.push(
			diagnostic('REQUEST_INVALID', 'Unsupported operation version.', null, 'REQUEST')
		);
	if (typeof typed.subjectId !== 'string' || typed.subjectId.length === 0)
		diagnostics.push(
			diagnostic('REQUEST_INVALID', 'subjectId must be nonempty text.', null, 'REQUEST')
		);
	for (const key of ['maxArtifacts', 'maxDiagnostics', 'maxTotalBytes'] as const)
		if (!positiveSafeInteger(typed.budgets[key]))
			diagnostics.push(
				diagnostic('REQUEST_INVALID', `${key} must be a positive safe integer.`, null, 'REQUEST')
			);
	return { diagnostics, request: diagnostics.length === 0 ? typed : null };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isProductionTypeScriptPath(path: string, prefix: string): boolean {
	if (!path.startsWith(prefix) || !path.endsWith('.ts')) return false;
	const relative = path.slice(prefix.length);
	return (
		relative.length > 0 &&
		!relative.split('/').includes('gen') &&
		!/(?:^|\/)[^/]+\.(?:test|spec)\.ts$/u.test(relative)
	);
}

const LEDGER_ROW_FIELDS = new Set(['disposition', 'enforcingAnchor', 'enforcingSite', 'evidence']);

function directPropertyName(name: ts.PropertyName): string | null {
	if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
	return null;
}

function directGuardText(name: ts.PropertyName): string | null {
	if (ts.isComputedPropertyName(name))
		return ts.isStringLiteralLike(name.expression) ? name.expression.text : null;
	return directPropertyName(name);
}

function exportedConstLedgerDeclaration(file: ts.SourceFile): ts.VariableDeclaration | null {
	const matches: { declaration: ts.VariableDeclaration; statement: ts.VariableStatement }[] = [];
	for (const statement of file.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations)
			if (ts.isIdentifier(declaration.name) && declaration.name.text === 'GUARD_LEDGER')
				matches.push({ declaration, statement });
	}
	if (matches.length !== 1) return null;
	const match = matches[0]!;
	if (
		match.statement.declarationList.declarations.length !== 1 ||
		(match.statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
		!match.statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
	)
		return null;
	return match.declaration;
}

function hasNonDeclarationLedgerReference(
	file: ts.SourceFile,
	declaration: ts.VariableDeclaration
): boolean {
	let found = false;
	const visit = (node: ts.Node): void => {
		if (found) return;
		if (node !== declaration.name && ts.isIdentifier(node) && node.text === 'GUARD_LEDGER') {
			found = true;
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return found;
}

function enforcementSitePathsFromLedger(file: ts.SourceFile): ReadonlySet<string> | null {
	const declaration = exportedConstLedgerDeclaration(file);
	if (
		declaration === null ||
		hasNonDeclarationLedgerReference(file, declaration) ||
		declaration.initializer === undefined ||
		!ts.isObjectLiteralExpression(declaration.initializer)
	)
		return null;
	if (declaration.initializer.properties.length === 0) return null;

	const guardTexts = new Set<string>();
	const paths = new Set<string>();
	for (const ledgerProperty of declaration.initializer.properties) {
		if (!ts.isPropertyAssignment(ledgerProperty)) return null;
		const guardText = directGuardText(ledgerProperty.name);
		if (guardText === null || guardText.length === 0 || guardTexts.has(guardText)) return null;
		guardTexts.add(guardText);
		if (!ts.isObjectLiteralExpression(ledgerProperty.initializer)) return null;

		const row = new Map<string, ts.Expression>();
		for (const rowProperty of ledgerProperty.initializer.properties) {
			if (!ts.isPropertyAssignment(rowProperty)) return null;
			const field = directPropertyName(rowProperty.name);
			if (field === null || !LEDGER_ROW_FIELDS.has(field) || row.has(field)) return null;
			if (!ts.isStringLiteralLike(rowProperty.initializer)) return null;
			row.set(field, rowProperty.initializer);
		}
		if (!row.has('disposition') || !row.has('evidence')) return null;

		const site = row.get('enforcingSite');
		if (site === undefined) continue;
		const match = /^(packages\/rph-application\/src\/handlers\/[^/:]+\.ts):[1-9][0-9]*$/u.exec(
			(site as ts.StringLiteralLike).text
		);
		if (match === null) return null;
		paths.add(assertCanonicalRelativePath(match[1]!));
	}
	return paths;
}

function extractEnforcementSitePaths(subject: FrozenSubject): {
	readonly paths: ReadonlySet<string>;
	readonly diagnostics: readonly GuardEnforcementLedgerArtifactSetDiagnostic[];
} {
	const rows = subject.artifacts.filter(
		(artifact) => artifact.path === GUARD_ENFORCEMENT_LEDGER_DATA_PATH
	);
	if (rows.length !== 1) return { diagnostics: [], paths: new Set() };
	const bytes = readFrozenSubjectArtifact(subject, GUARD_ENFORCEMENT_LEDGER_DATA_PATH);
	if (bytes === undefined)
		return {
			diagnostics: [
				diagnostic(
					'POPULATION_RECONCILIATION_FAILED',
					'Frozen ledger-data bytes are unavailable for enforcement-site selection.',
					GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
					'RECONCILE'
				)
			],
			paths: new Set()
		};
	try {
		const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		const file = ts.createSourceFile(
			GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
			source,
			ts.ScriptTarget.Latest,
			false,
			ts.ScriptKind.TS
		);
		const parseDiagnostics = (file as unknown as { readonly parseDiagnostics?: readonly unknown[] })
			.parseDiagnostics;
		if (parseDiagnostics !== undefined && parseDiagnostics.length > 0)
			throw new Error('ledger data contains syntax diagnostics');
		const paths = enforcementSitePathsFromLedger(file);
		if (paths === null)
			return {
				diagnostics: [
					diagnostic(
						'POPULATION_RECONCILIATION_FAILED',
						'GUARD_LEDGER must use the supported direct object-literal grammar and direct handler path-and-line literals.',
						GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
						'RECONCILE'
					)
				],
				paths: new Set()
			};
		return { diagnostics: [], paths };
	} catch {
		return {
			diagnostics: [
				diagnostic(
					'POPULATION_RECONCILIATION_FAILED',
					'Ledger data cannot be decoded and parsed for exact enforcement-site selection.',
					GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
					'RECONCILE'
				)
			],
			paths: new Set()
		};
	}
}

/**
 * The capsule must contain everything the retained analyzer IMPORTS, and that population is DERIVED from the
 * analyzer's own frozen source rather than listed here.
 *
 * ⚠⚠ ROOTED AT THE WORKER'S ACTUAL IMPORT ROOTS, NOT AT `GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS`. The
 * worker dynamically imports exactly two modules — the analyzer and the ledger data. The third retained path is
 * the authority TEST, which is materialised but never executed. Rooting at the convenient list would drag in the
 * test's specifiers, including `vitest`, which the capsule cannot satisfy: `linkModule` junctions only
 * typescript, ulid and zod. Fixing this defect by rooting at the obvious list would have created a new one.
 */
function analyzerClosure(subject: FrozenSubject): {
	readonly diagnostics: readonly GuardEnforcementLedgerArtifactSetDiagnostic[];
	readonly paths: ReadonlySet<string>;
} {
	const closure = resolveFrozenModuleClosure({
		entryPaths: [GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH, GUARD_ENFORCEMENT_LEDGER_DATA_PATH],
		maxClosureNodes: MAX_CLOSURE_NODES,
		subject
	});
	return {
		// A specifier the closure cannot resolve was SILENT before this existed, and that silence was the defect.
		diagnostics: closure.findings.map((f) =>
			diagnostic(
				'POPULATION_RECONCILIATION_FAILED',
				`Retained analyzer import closure is undecidable: ${f.code}${f.specifier === null ? '' : ` for '${f.specifier}'`}${f.importerPath === null ? '' : ` in ${f.importerPath}`}${f.resolvedCandidate === null ? '' : ` (resolved to ${f.resolvedCandidate})`}.`,
				f.path,
				'RECONCILE'
			)
		),
		paths: new Set(closure.dependencies)
	};
}

function usesForPath(
	path: string,
	enforcementSitePaths: ReadonlySet<string>,
	analyzerDependencyPaths: ReadonlySet<string>
): readonly GuardEnforcementLedgerArtifactUse[] {
	const uses = new Set<GuardEnforcementLedgerArtifactUse>();
	if (path === GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH) uses.add('ANALYZER_SOURCE');
	if (analyzerDependencyPaths.has(path)) uses.add('ANALYZER_DEPENDENCY_SOURCE');
	if (path === GUARD_ENFORCEMENT_LEDGER_DATA_PATH) uses.add('LEDGER_DATA');
	if (path === GUARD_ENFORCEMENT_LEDGER_TEST_PATH) uses.add('AUTHORITY_TEST');
	if (path === DOMAIN_MANIFEST_PATH || path === CONTRACTS_MANIFEST_PATH)
		uses.add('PACKAGE_MANIFEST');
	if (OPTIONAL_ENVIRONMENT_PATHS.has(path)) uses.add('ENVIRONMENT_IDENTITY');
	if (enforcementSitePaths.has(path)) uses.add('ENFORCEMENT_SITE_SOURCE');
	if (
		isProductionTypeScriptPath(path, DOMAIN_SOURCE_PREFIX) ||
		isProductionTypeScriptPath(path, CONTRACTS_SOURCE_PREFIX)
	)
		uses.add('PACKAGE_SOURCE');
	if (STATE_MACHINE_PATHS.has(path)) uses.add('STATE_MACHINE_DECLARATIONS');
	return [...uses].sort(compareText);
}

function bindArtifact(
	subject: FrozenSubject,
	artifact: CapturedArtifactRecord,
	uses: readonly GuardEnforcementLedgerArtifactUse[]
):
	| { readonly binding: GuardEnforcementLedgerArtifactBinding; readonly diagnostic?: never }
	| { readonly binding?: never; readonly diagnostic: GuardEnforcementLedgerArtifactSetDiagnostic } {
	try {
		assertCanonicalRelativePath(artifact.path);
		const bytes = readFrozenSubjectArtifact(subject, artifact.path);
		if (bytes === undefined) throw new Error('bytes unavailable');
		const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		const expected = classifyArtifact(artifact.path, source);
		if (
			artifact.canonicalPathKey !== canonicalPathKey(artifact.path) ||
			!Number.isSafeInteger(artifact.bytes) ||
			artifact.bytes < 0 ||
			artifact.bytes !== bytes.byteLength ||
			!SHA256.test(artifact.sha256) ||
			artifact.sha256 !== sha256(bytes) ||
			artifact.disposition !== expected.disposition ||
			artifact.primaryClass !== expected.primaryClass ||
			artifact.reason !== expected.reason ||
			!sameStrings(artifact.roles, expected.roles)
		)
			throw new Error('identity mismatch');
		return {
			binding: {
				bytes: artifact.bytes,
				canonicalPathKey: artifact.canonicalPathKey,
				path: artifact.path,
				primaryClass: artifact.primaryClass,
				semanticRoles: [...artifact.roles],
				sha256: artifact.sha256,
				uses: [...uses]
			}
		};
	} catch {
		return {
			diagnostic: diagnostic(
				'ARTIFACT_CLASSIFICATION_MISMATCH',
				'Selected artifact metadata does not exactly reproduce its frozen bytes and classification.',
				typeof artifact?.path === 'string' ? artifact.path : null,
				'CLASSIFY'
			)
		};
	}
}

interface DerivedPopulation {
	readonly artifacts: readonly GuardEnforcementLedgerArtifactBinding[];
	readonly diagnostics: readonly GuardEnforcementLedgerArtifactSetDiagnostic[];
}

function derivePopulation(subject: FrozenSubject): DerivedPopulation {
	const siteSelection = extractEnforcementSitePaths(subject);
	const closureSelection = analyzerClosure(subject);
	const diagnostics = [...siteSelection.diagnostics, ...closureSelection.diagnostics];
	const rowsByPath = new Map<string, CapturedArtifactRecord[]>();
	for (const artifact of subject.artifacts) {
		const uses = usesForPath(artifact.path, siteSelection.paths, closureSelection.paths);
		if (uses.length === 0) continue;
		const rows = rowsByPath.get(artifact.path) ?? [];
		rows.push(artifact);
		rowsByPath.set(artifact.path, rows);
	}
	for (const excluded of subject.excludedArtifacts) {
		const uses = usesForPath(excluded.path, siteSelection.paths, closureSelection.paths);
		if (uses.length === 0 || OPTIONAL_ENVIRONMENT_PATHS.has(excluded.path)) continue;
		diagnostics.push(
			diagnostic(
				'POPULATION_RECONCILIATION_FAILED',
				'A required eligible artifact is excluded from the frozen subject.',
				excluded.path,
				'RECONCILE'
			)
		);
	}
	// A derived closure member absent from the subject is exactly as fatal as a missing REQUIRED_PATH: the capsule
	// would be written without it and the analyzer's dynamic import would fail inside the worker.
	for (const path of [...REQUIRED_PATHS, ...siteSelection.paths, ...closureSelection.paths])
		if ((rowsByPath.get(path)?.length ?? 0) === 0)
			diagnostics.push(
				diagnostic(
					'REQUIRED_ARTIFACT_MISSING',
					'Required retained-verifier artifact is absent from the frozen subject.',
					path,
					'BIND'
				)
			);
	for (const [path, rows] of rowsByPath)
		if (rows.length !== 1)
			diagnostics.push(
				diagnostic(
					'POPULATION_RECONCILIATION_FAILED',
					`Eligible artifact has ${rows.length} manifest rows; exactly one is required.`,
					path,
					'RECONCILE'
				)
			);
	const pathsByKey = new Map<string, string[]>();
	for (const path of rowsByPath.keys()) {
		const key = canonicalPathKey(path);
		const paths = pathsByKey.get(key) ?? [];
		paths.push(path);
		pathsByKey.set(key, paths);
	}
	for (const paths of pathsByKey.values())
		if (paths.length > 1)
			diagnostics.push(
				diagnostic(
					'POPULATION_RECONCILIATION_FAILED',
					`Eligible paths collide under canonical comparison: ${paths.sort(compareText).join(', ')}.`,
					paths[0] ?? null,
					'RECONCILE'
				)
			);
	const artifacts: GuardEnforcementLedgerArtifactBinding[] = [];
	for (const [path, rows] of [...rowsByPath].sort(([left], [right]) => compareText(left, right))) {
		if (rows.length !== 1) continue;
		const result = bindArtifact(
			subject,
			rows[0]!,
			usesForPath(path, siteSelection.paths, closureSelection.paths)
		);
		if (result.diagnostic !== undefined) diagnostics.push(result.diagnostic);
		else artifacts.push(result.binding);
	}
	return { artifacts, diagnostics };
}

function coverageFor(
	artifacts: readonly GuardEnforcementLedgerArtifactBinding[]
): GuardEnforcementLedgerArtifactSetCoverage {
	const count = (use: GuardEnforcementLedgerArtifactUse) =>
		artifacts.filter((artifact) => artifact.uses.includes(use)).length;
	const totalBytes = artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0);
	return {
		analyzerArtifacts: count('ANALYZER_SOURCE'),
		analyzerDependencyArtifacts: count('ANALYZER_DEPENDENCY_SOURCE'),
		artifacts: artifacts.length,
		authorityTestArtifacts: count('AUTHORITY_TEST'),
		enforcementSiteArtifacts: count('ENFORCEMENT_SITE_SOURCE'),
		ledgerDataArtifacts: count('LEDGER_DATA'),
		packageSourceArtifacts: count('PACKAGE_SOURCE'),
		reconciles:
			Number.isSafeInteger(totalBytes) &&
			new Set(artifacts.map((artifact) => artifact.path)).size === artifacts.length,
		stateMachineDeclarationArtifacts: count('STATE_MACHINE_DECLARATIONS'),
		totalBytes
	};
}

function limitDiagnostics(
	diagnostics: readonly GuardEnforcementLedgerArtifactSetDiagnostic[],
	maximum: number
): readonly GuardEnforcementLedgerArtifactSetDiagnostic[] {
	if (diagnostics.length <= maximum) return diagnostics;
	const exhausted = diagnostic(
		'BUDGET_EXHAUSTED',
		`Diagnostic population ${diagnostics.length} exceeds reporting budget ${maximum}.`,
		null,
		'RECONCILE'
	);
	return maximum === 1 ? [exhausted] : [...diagnostics.slice(0, maximum - 1), exhausted];
}

export function buildGuardEnforcementLedgerArtifactSet(
	requestValue: BuildGuardEnforcementLedgerArtifactSetRequest,
	dependencies: GuardEnforcementLedgerArtifactSetDependencies
): BuildGuardEnforcementLedgerArtifactSetOutcome {
	const validated = validateRequest(requestValue);
	if (validated.request === null)
		return { diagnostics: validated.diagnostics, outcome: 'unavailable' };
	const request = validated.request;
	try {
		const subject = exactPlainRecord(dependencies, ['subject'])
			? data(dependencies, 'subject')
			: undefined;
		if (!isFrozenSubjectCapability(subject) || isProxy(subject))
			return {
				diagnostics: [
					diagnostic(
						'SUBJECT_CAPABILITY_UNAVAILABLE',
						'An exact FrozenSubject byte capability is required.',
						null,
						'BIND'
					)
				],
				outcome: 'unavailable'
			};
		if (subject.descriptor.subjectId !== request.subjectId)
			return {
				diagnostics: [
					diagnostic('SUBJECT_ID_MISMATCH', 'Request identifies a different subject.', null, 'BIND')
				],
				outcome: 'unavailable'
			};
		const derived = derivePopulation(subject);
		const diagnostics = [...derived.diagnostics];
		if (derived.artifacts.length > request.budgets.maxArtifacts)
			diagnostics.push(
				diagnostic(
					'BUDGET_EXHAUSTED',
					`Selected population ${derived.artifacts.length} exceeds maxArtifacts ${request.budgets.maxArtifacts}.`,
					null,
					'BIND'
				)
			);
		const coverage = coverageFor(derived.artifacts);
		if (!coverage.reconciles || coverage.totalBytes > request.budgets.maxTotalBytes)
			diagnostics.push(
				diagnostic(
					'BUDGET_EXHAUSTED',
					`Selected bytes ${coverage.totalBytes} do not fit maxTotalBytes ${request.budgets.maxTotalBytes}.`,
					null,
					'BIND'
				)
			);
		if (diagnostics.length > 0)
			return {
				diagnostics: limitDiagnostics(diagnostics, request.budgets.maxDiagnostics),
				outcome: 'unavailable'
			};
		const artifactContentDigest = canonicalSemanticJsonWitness(derived.artifacts).sha256;
		const content = {
			artifacts: derived.artifacts,
			canonicalProfile: GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE,
			coverage,
			id: guardEnforcementLedgerArtifactSetId({
				artifactContentDigest,
				method: GUARD_ENFORCEMENT_LEDGER_METHOD,
				operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
				schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION,
				subjectId: request.subjectId
			}),
			method: GUARD_ENFORCEMENT_LEDGER_METHOD,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION,
			subjectId: request.subjectId
		};
		const artifactSet = {
			...content,
			contentDigest: guardEnforcementLedgerArtifactSetContentDigest(content)
		};
		const result = validateGuardEnforcementLedgerArtifactSet(artifactSet, subject, {
			maxIssues: request.budgets.maxDiagnostics
		});
		if (result.state !== 'VALID')
			return {
				diagnostics: [
					diagnostic(
						'POPULATION_RECONCILIATION_FAILED',
						result.issues[0]?.message ?? 'Artifact-set validation failed.',
						result.issues[0]?.path ?? null,
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
					'POPULATION_RECONCILIATION_FAILED',
					'Artifact selection encountered hostile or malformed subject state.',
					null,
					'RECONCILE'
				)
			],
			outcome: 'unavailable'
		};
	}
}

export const selectGuardEnforcementLedgerArtifactSet = buildGuardEnforcementLedgerArtifactSet;

function arrayHeaderLength(value: unknown): number | null {
	if (!Array.isArray(value) || isProxy(value) || Reflect.getPrototypeOf(value) !== Array.prototype)
		return null;
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		(lengthDescriptor.value as number) < 0
	)
		return null;
	return lengthDescriptor.value as number;
}

function denseArray(value: unknown, knownLength?: number): value is readonly unknown[] {
	const length = knownLength ?? arrayHeaderLength(value);
	if (length === null) return false;
	const keys = Reflect.ownKeys(value as object);
	if (keys.length !== length + 1) return false;
	for (const key of keys) {
		if (key === 'length') continue;
		if (typeof key !== 'string' || !/^(?:0|[1-9][0-9]*)$/u.test(key)) return false;
		const index = Number(key);
		if (index >= length) return false;
		const descriptor = Reflect.getOwnPropertyDescriptor(value as object, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return false;
	}
	return true;
}

function arrayLength(value: readonly unknown[]): number {
	return Reflect.getOwnPropertyDescriptor(value, 'length')?.value as number;
}

function arrayValue(value: readonly unknown[], index: number): unknown {
	return Reflect.getOwnPropertyDescriptor(value, String(index))?.value;
}

function shapeIssue(
	value: unknown,
	maxRecords: number,
	maxStringCharacters: number
): GuardEnforcementLedgerValidationIssue | null {
	if (
		!exactPlainRecord(value, [
			'artifacts',
			'canonicalProfile',
			'contentDigest',
			'coverage',
			'id',
			'method',
			'operationVersion',
			'schemaVersion',
			'subjectId'
		])
	)
		return { code: 'SHAPE_INVALID', message: 'Expected the exact artifact-set record.', path: '$' };
	const artifacts = data(value, 'artifacts');
	const artifactCount = arrayHeaderLength(artifacts);
	if (artifactCount === null)
		return {
			code: 'SHAPE_INVALID',
			message: 'artifacts must be a dense array.',
			path: '$.artifacts'
		};
	if (artifactCount > maxRecords)
		return {
			code: 'BUDGET_EXHAUSTED',
			message: 'Artifact population exceeds maxRecords.',
			path: '$.artifacts'
		};
	if (artifactCount === 0)
		return {
			code: 'SHAPE_INVALID',
			message: 'Artifact population must be nonempty.',
			path: '$.artifacts'
		};
	let stringCharacters = 0;
	for (const key of [
		'canonicalProfile',
		'contentDigest',
		'id',
		'method',
		'operationVersion',
		'schemaVersion',
		'subjectId'
	] as const) {
		const field = data(value, key);
		if (typeof field !== 'string')
			return {
				code: 'SHAPE_INVALID',
				message: `${key} must be text.`,
				path: `$.${key}`
			};
		stringCharacters += field.length;
	}
	if (stringCharacters > maxStringCharacters)
		return {
			code: 'BUDGET_EXHAUSTED',
			message: 'Artifact-set strings exceed maxStringCharacters.',
			path: '$'
		};
	if (!denseArray(artifacts, artifactCount))
		return {
			code: 'SHAPE_INVALID',
			message: 'artifacts must be a dense array.',
			path: '$.artifacts'
		};
	for (let index = 0; index < artifactCount; index += 1) {
		const item = arrayValue(artifacts, index);
		const itemKeys = [
			'bytes',
			'canonicalPathKey',
			'path',
			'primaryClass',
			'semanticRoles',
			'sha256',
			'uses'
		] as const;
		if (!exactPlainRecord(item, itemKeys))
			return {
				code: 'SHAPE_INVALID',
				message: 'Artifact binding shape is not exact.',
				path: `$.artifacts[${index}]`
			};
		const semanticRoles = data(item, 'semanticRoles');
		const uses = data(item, 'uses');
		const semanticRoleCount = arrayHeaderLength(semanticRoles);
		const useCount = arrayHeaderLength(uses);
		if (semanticRoleCount === null || useCount === null)
			return {
				code: 'SHAPE_INVALID',
				message: 'Artifact binding shape is not exact.',
				path: `$.artifacts[${index}]`
			};
		if (semanticRoleCount > maxRecords || useCount > maxRecords)
			return {
				code: 'BUDGET_EXHAUSTED',
				message: 'Nested artifact population exceeds maxRecords.',
				path: `$.artifacts[${index}]`
			};
		if (semanticRoleCount > SEMANTIC_ROLES.size || useCount > ARTIFACT_USES.size)
			return {
				code: 'SHAPE_INVALID',
				message: 'Nested artifact population exceeds its closed vocabulary.',
				path: `$.artifacts[${index}]`
			};
		if (!denseArray(semanticRoles, semanticRoleCount) || !denseArray(uses, useCount))
			return {
				code: 'SHAPE_INVALID',
				message: 'Artifact binding shape is not exact.',
				path: `$.artifacts[${index}]`
			};
		const bytes = data(item, 'bytes');
		if (!Number.isSafeInteger(bytes) || (bytes as number) < 0)
			return {
				code: 'SHAPE_INVALID',
				message: 'Artifact bytes must be a nonnegative safe integer.',
				path: `$.artifacts[${index}].bytes`
			};
		for (const key of ['canonicalPathKey', 'path', 'primaryClass', 'sha256'] as const) {
			const field = data(item, key);
			if (typeof field !== 'string')
				return {
					code: 'SHAPE_INVALID',
					message: `${key} must be text.`,
					path: `$.artifacts[${index}].${key}`
				};
			stringCharacters += field.length;
		}
		for (const [key, population] of [
			['semanticRoles', semanticRoles],
			['uses', uses]
		] as const) {
			for (let childIndex = 0; childIndex < arrayLength(population); childIndex += 1) {
				const field = arrayValue(population, childIndex);
				if (typeof field !== 'string')
					return {
						code: 'SHAPE_INVALID',
						message: `${key} members must be text.`,
						path: `$.artifacts[${index}].${key}[${childIndex}]`
					};
				stringCharacters += field.length;
			}
		}
		if (stringCharacters > maxStringCharacters)
			return {
				code: 'BUDGET_EXHAUSTED',
				message: 'Artifact-set strings exceed maxStringCharacters.',
				path: '$'
			};
	}
	const coverage = data(value, 'coverage');
	if (
		!exactPlainRecord(coverage, [
			'analyzerArtifacts',
			'analyzerDependencyArtifacts',
			'artifacts',
			'authorityTestArtifacts',
			'enforcementSiteArtifacts',
			'ledgerDataArtifacts',
			'packageSourceArtifacts',
			'reconciles',
			'stateMachineDeclarationArtifacts',
			'totalBytes'
		])
	)
		return { code: 'SHAPE_INVALID', message: 'Coverage shape is not exact.', path: '$.coverage' };
	for (const key of [
		'analyzerArtifacts',
		'analyzerDependencyArtifacts',
		'artifacts',
		'authorityTestArtifacts',
		'enforcementSiteArtifacts',
		'ledgerDataArtifacts',
		'packageSourceArtifacts',
		'stateMachineDeclarationArtifacts',
		'totalBytes'
	] as const) {
		const field = data(coverage, key);
		if (!Number.isSafeInteger(field) || (field as number) < 0)
			return {
				code: 'SHAPE_INVALID',
				message: `${key} must be a nonnegative safe integer.`,
				path: `$.coverage.${key}`
			};
	}
	if (typeof data(coverage, 'reconciles') !== 'boolean')
		return {
			code: 'SHAPE_INVALID',
			message: 'reconciles must be boolean.',
			path: '$.coverage.reconciles'
		};
	return null;
}

export function validateGuardEnforcementLedgerArtifactSet(
	value: unknown,
	subject?: FrozenSubject,
	options?: GuardEnforcementLedgerValidationOptions
): GuardEnforcementLedgerValidationResult {
	try {
		let maxIssues = 100;
		let maxRecords = Number.MAX_SAFE_INTEGER;
		let maxStringCharacters = Number.MAX_SAFE_INTEGER;
		if (options !== undefined) {
			if (!validationOptionsRecord(options))
				return {
					issues: [
						{
							code: 'INVALID_VALUE',
							message: 'Validation options shape is invalid.',
							path: '$options'
						}
					],
					state: 'INVALID'
				};
			if (options.maxIssues !== undefined) {
				if (!positiveSafeInteger(options.maxIssues))
					return {
						issues: [
							{
								code: 'INVALID_VALUE',
								message: 'maxIssues must be positive.',
								path: '$options.maxIssues'
							}
						],
						state: 'INVALID'
					};
				maxIssues = options.maxIssues;
			}
			for (const key of ['maxRecords', 'maxStringCharacters'] as const)
				if (options[key] !== undefined && !positiveSafeInteger(options[key]))
					return {
						issues: [
							{
								code: 'INVALID_VALUE',
								message: `${key} must be positive.`,
								path: `$options.${key}`
							}
						],
						state: 'INVALID'
					};
				else if (options[key] !== undefined) {
					if (key === 'maxRecords') maxRecords = options[key];
					else maxStringCharacters = options[key];
				}
		}
		const malformed = shapeIssue(value, maxRecords, maxStringCharacters);
		if (malformed !== null)
			return {
				issues: [malformed],
				state: malformed.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
			};
		if (subject !== undefined && (!isFrozenSubjectCapability(subject) || isProxy(subject)))
			return {
				issues: [
					{
						code: 'SUBJECT_MISMATCH',
						message: 'An exact FrozenSubject is required.',
						path: '$subject'
					}
				],
				state: 'INVALID'
			};
		const artifactSet =
			value as import('../../contracts/guard-enforcement-ledger.js').GuardEnforcementLedgerArtifactSetBinding;
		const issues: GuardEnforcementLedgerValidationIssue[] = [];
		let issueLimitExceeded = false;
		const add = (
			code: GuardEnforcementLedgerValidationIssue['code'],
			path: string,
			message: string
		) => {
			if (issues.length < maxIssues) issues.push({ code, message, path });
			else issueLimitExceeded = true;
		};
		if (artifactSet.schemaVersion !== GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION)
			add('IDENTITY_MISMATCH', '$.schemaVersion', 'Unsupported artifact-set schema version.');
		if (artifactSet.operationVersion !== GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION)
			add('IDENTITY_MISMATCH', '$.operationVersion', 'Unsupported artifact-set operation version.');
		if (artifactSet.method !== GUARD_ENFORCEMENT_LEDGER_METHOD)
			add('IDENTITY_MISMATCH', '$.method', 'Artifact-set method is unsupported.');
		if (artifactSet.canonicalProfile !== GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE)
			add('IDENTITY_MISMATCH', '$.canonicalProfile', 'Canonical profile is unsupported.');
		if (typeof artifactSet.subjectId !== 'string' || artifactSet.subjectId.length === 0)
			add('INVALID_VALUE', '$.subjectId', 'subjectId must be nonempty text.');
		if (subject !== undefined && artifactSet.subjectId !== subject.descriptor.subjectId)
			add('SUBJECT_MISMATCH', '$.subjectId', 'Artifact set identifies a different FrozenSubject.');
		for (let index = 0; index < artifactSet.artifacts.length; index += 1) {
			const current = artifactSet.artifacts[index]!;
			if (index > 0 && compareText(artifactSet.artifacts[index - 1]!.path, current.path) >= 0)
				add(
					'INVALID_VALUE',
					`$.artifacts[${index}].path`,
					'Artifact paths must be strictly ordered.'
				);
			if (!Number.isSafeInteger(current.bytes) || current.bytes < 0)
				add(
					'INVALID_VALUE',
					`$.artifacts[${index}].bytes`,
					'bytes must be a nonnegative safe integer.'
				);
			if (typeof current.path !== 'string' || typeof current.canonicalPathKey !== 'string')
				add('INVALID_VALUE', `$.artifacts[${index}].path`, 'Artifact path identity must be text.');
			else {
				try {
					if (canonicalPathKey(current.path) !== current.canonicalPathKey)
						add(
							'IDENTITY_MISMATCH',
							`$.artifacts[${index}].canonicalPathKey`,
							'Canonical path key does not reproduce.'
						);
				} catch {
					add('INVALID_VALUE', `$.artifacts[${index}].path`, 'Artifact path is noncanonical.');
				}
			}
			if (!PRIMARY_CLASSES.has(current.primaryClass))
				add('INVALID_VALUE', `$.artifacts[${index}].primaryClass`, 'Primary class is unsupported.');
			if (!SHA256.test(current.sha256))
				add('INVALID_VALUE', `$.artifacts[${index}].sha256`, 'Artifact digest is invalid.');
			if (
				new Set(current.uses).size !== current.uses.length ||
				!sameStrings([...current.uses].sort(compareText), current.uses) ||
				current.uses.some((use) => !ARTIFACT_USES.has(use))
			)
				add(
					'INVALID_VALUE',
					`$.artifacts[${index}].uses`,
					'Artifact uses are invalid or noncanonical.'
				);
			if (
				current.semanticRoles.some((role) => !SEMANTIC_ROLES.has(role)) ||
				new Set(current.semanticRoles).size !== current.semanticRoles.length ||
				!sameStrings([...current.semanticRoles].sort(compareText), current.semanticRoles)
			)
				add(
					'INVALID_VALUE',
					`$.artifacts[${index}].semanticRoles`,
					'Semantic roles are invalid or noncanonical.'
				);
			if (issueLimitExceeded) return { issues, state: 'BUDGET_EXHAUSTED' };
		}
		const derived =
			subject === undefined
				? { artifacts: artifactSet.artifacts, diagnostics: [] }
				: derivePopulation(subject);
		for (const cause of derived.diagnostics) {
			add('POPULATION_MISMATCH', '$subject', cause.message);
			if (issueLimitExceeded) return { issues, state: 'BUDGET_EXHAUSTED' };
		}
		if (canonicalJson(artifactSet.artifacts) !== canonicalJson(derived.artifacts))
			add(
				'POPULATION_MISMATCH',
				'$.artifacts',
				'Artifact population differs from the exact FrozenSubject selection.'
			);
		const expectedCoverage = coverageFor(derived.artifacts);
		if (canonicalJson(artifactSet.coverage) !== canonicalJson(expectedCoverage))
			add(
				'POPULATION_MISMATCH',
				'$.coverage',
				'Coverage does not reproduce the selected population.'
			);
		const expectedId = guardEnforcementLedgerArtifactSetId({
			artifactContentDigest: canonicalSemanticJsonWitness(artifactSet.artifacts).sha256,
			method: artifactSet.method,
			operationVersion: artifactSet.operationVersion,
			schemaVersion: artifactSet.schemaVersion,
			subjectId: artifactSet.subjectId
		});
		if (artifactSet.id !== expectedId)
			add('IDENTITY_MISMATCH', '$.id', 'Artifact-set identity does not reproduce.');
		if (artifactSet.contentDigest !== guardEnforcementLedgerArtifactSetContentDigest(artifactSet))
			add(
				'CONTENT_DIGEST_MISMATCH',
				'$.contentDigest',
				'Artifact-set content digest does not reproduce.'
			);
		if (issues.length === 0) return { issues: [], state: 'VALID' };
		return {
			issues: issues.slice(0, maxIssues),
			state:
				issueLimitExceeded || issues.some((issue) => issue.code === 'BUDGET_EXHAUSTED')
					? 'BUDGET_EXHAUSTED'
					: 'INVALID'
		};
	} catch {
		return {
			issues: [
				{
					code: 'SHAPE_INVALID',
					message: 'Artifact-set validation encountered hostile input.',
					path: '$'
				}
			],
			state: 'INVALID'
		};
	}
}
