import { posix } from 'node:path';

import {
	DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
	DEPENDENCY_CRUISER_CANONICAL_PROFILE,
	DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_NORMALIZATION_OPERATION_VERSION,
	DEPENDENCY_CRUISER_OBSERVATION_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_PROVIDER_ID,
	DEPENDENCY_CRUISER_PROVIDER_VERSION,
	DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
	type DependencyCruiserDependencyId,
	type DependencyCruiserDependencyObservation,
	type DependencyCruiserDependencyType,
	type DependencyCruiserInvocationBinding,
	type DependencyCruiserLocalModuleObservation,
	type DependencyCruiserModuleId,
	type DependencyCruiserNativeRule,
	type DependencyCruiserNonLocalModuleObservation,
	type DependencyCruiserNormalizationDiagnostic,
	type DependencyCruiserNormalizationDiagnosticCode,
	type DependencyCruiserNormalizationOutcome,
	type DependencyCruiserObservation,
	type DependencyCruiserObservationId,
	type DependencyCruiserObservationLimitation,
	type DependencyCruiserObservationValidationIssue,
	type DependencyCruiserObservationValidationIssueCode,
	type DependencyCruiserObservationValidationOptions,
	type DependencyCruiserObservationValidationResult,
	type DependencyCruiserReverseLink,
	type DependencyCruiserRuleSeverity,
	type DependencyCruiserTarget,
	type DependencyCruiserTriState
} from '../../contracts/dependency-cruiser.js';
import { FULL_JAN_CSAA_007_CONFORMANCE } from '../../contracts/semantic.js';
import { compareText, sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../../semantic/canonical.js';
import { assertCanonicalRelativePath } from '../../subject/paths.js';
import { validateDependencyCruiserRawWireSchema } from './validate-raw-wire-schema.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const OFFSET_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const DEFAULT_VALIDATION_MAX_ISSUES = 1_000;

const DEPENDENCY_TYPES = [
	'aliased-subpath-import',
	'aliased-tsconfig-base-url',
	'aliased-tsconfig-paths',
	'aliased-tsconfig',
	'aliased-webpack',
	'aliased-workspace',
	'aliased',
	'amd-define',
	'amd-exotic-require',
	'amd-require',
	'core',
	'deprecated',
	'dynamic-import',
	'exotic-require',
	'export',
	'import-equals',
	'import',
	'jsdoc-bracket-import',
	'jsdoc-import-tag',
	'jsdoc',
	'local',
	'localmodule',
	'npm-bundled',
	'npm-dev',
	'npm-no-pkg',
	'npm-optional',
	'npm-peer',
	'npm-unknown',
	'npm',
	'pre-compilation-only',
	'require',
	'triple-slash-amd-dependency',
	'triple-slash-directive',
	'triple-slash-file-reference',
	'triple-slash-type-reference',
	'type-import',
	'type-only',
	'undetermined',
	'unknown'
] as const satisfies readonly DependencyCruiserDependencyType[];
const DEPENDENCY_TYPE_SET = new Set<string>(DEPENDENCY_TYPES);
const MODULE_SYSTEMS = new Set(['amd', 'cjs', 'es6', 'tsd']);
const PROTOCOLS = new Set(['data:', 'file:', 'node:']);
const SEVERITIES = new Set<DependencyCruiserRuleSeverity>(['error', 'ignore', 'info', 'warn']);
const EXTERNAL_DEPENDENCY_TYPES = new Set<DependencyCruiserDependencyType>([
	'npm',
	'npm-bundled',
	'npm-dev',
	'npm-no-pkg',
	'npm-optional',
	'npm-peer',
	'npm-unknown'
]);

const ROOT_KEYS = new Set(['folders', 'modules', 'revisionData', 'summary']);
const MODULE_KEYS = new Set([
	'checksum',
	'consolidated',
	'coreModule',
	'couldNotResolve',
	'dependencies',
	'dependencyTypes',
	'dependents',
	'experimentalStats',
	'followable',
	'instability',
	'license',
	'matchesDoNotFollow',
	'matchesFocus',
	'matchesHighlight',
	'matchesReaches',
	'orphan',
	'reachable',
	'reaches',
	'rules',
	'source',
	'valid'
]);
const DEPENDENCY_KEYS = new Set([
	'circular',
	'coreModule',
	'couldNotResolve',
	'cycle',
	'dependencyTypes',
	'dynamic',
	'exoticRequire',
	'exoticallyRequired',
	'followable',
	'instability',
	'license',
	'matchesDoNotFollow',
	'mimeType',
	'module',
	'moduleSystem',
	'preCompilationOnly',
	'protocol',
	'resolved',
	'rules',
	'typeOnly',
	'valid'
]);
const SUMMARY_KEYS = new Set([
	'error',
	'ignore',
	'info',
	'optionsUsed',
	'ruleSetUsed',
	'totalCruised',
	'totalDependenciesCruised',
	'violations',
	'warn'
]);
const MODULE_IGNORED_KEYS = new Set([
	'checksum',
	'consolidated',
	'experimentalStats',
	'instability',
	'license',
	'matchesFocus',
	'matchesHighlight',
	'matchesReaches',
	'orphan',
	'reachable',
	'reaches'
]);
const DEPENDENCY_IGNORED_KEYS = new Set(['cycle', 'license']);

type JsonRecord = Record<string, unknown>;

interface RawModule {
	readonly record: JsonRecord;
	readonly source: string;
	readonly target: DependencyCruiserTarget;
	readonly targetKey: string;
}

class NormalizationFailure extends Error {
	constructor(
		readonly diagnostic: DependencyCruiserNormalizationDiagnostic,
		options?: ErrorOptions
	) {
		super(diagnostic.message, options);
	}
}

function fail(
	code: DependencyCruiserNormalizationDiagnosticCode,
	path: string,
	message: string
): never {
	throw new NormalizationFailure({ code, message, path });
}

function plainRecord(value: unknown): value is JsonRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function scalarString(value: unknown): value is string {
	return typeof value === 'string' && isUnicodeScalarString(value);
}

function containsControlText(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const code = value.codePointAt(index)!;
		if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
	}
	return false;
}

function nonnegativeInteger(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) >= 0;
}

function finiteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function triState(value: unknown): DependencyCruiserTriState {
	return typeof value === 'boolean' ? value : 'UNSPECIFIED';
}

function assertKnownKeys(value: JsonRecord, known: ReadonlySet<string>, path: string): void {
	for (const key of Object.keys(value)) {
		if (!known.has(key)) fail('RAW_SHAPE_INVALID', `${path}.${key}`, 'Unknown wire field.');
	}
}

function required(value: JsonRecord, keys: readonly string[], path: string): void {
	for (const key of keys) {
		if (!Object.hasOwn(value, key))
			fail('RAW_SHAPE_INVALID', `${path}.${key}`, 'Required wire field is absent.');
	}
}

function assertOptionalBoolean(value: JsonRecord, key: string, path: string): void {
	if (Object.hasOwn(value, key) && typeof value[key] !== 'boolean')
		fail('RAW_SHAPE_INVALID', `${path}.${key}`, 'Expected a boolean.');
}

function assertOptionalString(value: JsonRecord, key: string, path: string): void {
	if (Object.hasOwn(value, key) && !scalarString(value[key]))
		fail('RAW_SHAPE_INVALID', `${path}.${key}`, 'Expected a Unicode scalar string.');
}

function assertOptionalFiniteNumber(value: JsonRecord, key: string, path: string): void {
	if (Object.hasOwn(value, key) && !finiteNumber(value[key]))
		fail('RAW_SHAPE_INVALID', `${path}.${key}`, 'Expected a finite number.');
}

function canonicalPath(value: string, path: string, maxPathLength: number): string {
	if (value.length > maxPathLength)
		fail('BUDGET_EXCEEDED', path, 'Path exceeds the caller path-length budget.');
	if (!isUnicodeScalarString(value) || containsControlText(value))
		fail('UNSAFE_PATH', path, 'Path contains non-scalar or control text.');
	if (/^[A-Za-z]:/u.test(value))
		fail('UNSAFE_PATH', path, 'Windows drive-qualified paths are not admissible.');
	try {
		return assertCanonicalRelativePath(value);
	} catch {
		fail('UNSAFE_PATH', path, 'Expected a canonical repository-relative path.');
	}
}

function localPath(
	providerPath: string,
	baseDir: string,
	path: string,
	maxPathLength: number
): string {
	const relative = canonicalPath(providerPath, path, maxPathLength);
	return canonicalPath(
		baseDir === '.' ? relative : posix.join(baseDir, relative),
		path,
		maxPathLength
	);
}

function safeProviderReference(value: string, path: string, maxPathLength: number): string {
	if (
		value.length === 0 ||
		value.length > maxPathLength ||
		value.includes('\\') ||
		value.includes('\0') ||
		containsControlText(value) ||
		value.startsWith('/') ||
		/^[A-Za-z]:/u.test(value)
	)
		fail('UNSAFE_PATH', path, 'Provider reference is empty, absolute, or non-canonical.');
	return value;
}

function targetKey(target: DependencyCruiserTarget): string {
	switch (target.kind) {
		case 'CORE_MODULE':
			return `CORE_MODULE\0${target.name}`;
		case 'EXTERNAL_MODULE':
			return `EXTERNAL_MODULE\0${target.name}`;
		case 'RESOLVED_LOCAL_PATH':
			return `RESOLVED_LOCAL_PATH\0${target.path}`;
		case 'UNRESOLVED':
			return `UNRESOLVED\0${target.specifier}`;
	}
}

function isExternal(types: readonly DependencyCruiserDependencyType[]): boolean {
	return types.some((value) => EXTERNAL_DEPENDENCY_TYPES.has(value));
}

function normalizeDependencyTypes(
	value: unknown,
	path: string
): readonly DependencyCruiserDependencyType[] {
	if (!Array.isArray(value)) fail('RAW_SHAPE_INVALID', path, 'Expected dependencyTypes array.');
	const result: DependencyCruiserDependencyType[] = [];
	const seen = new Set<string>();
	for (const [index, item] of value.entries()) {
		if (!scalarString(item) || !DEPENDENCY_TYPE_SET.has(item))
			fail('RAW_SHAPE_INVALID', `${path}[${index}]`, 'Unknown dependency type.');
		if (seen.has(item))
			fail('RAW_SHAPE_INVALID', `${path}[${index}]`, 'Duplicate dependency type.');
		seen.add(item);
		result.push(item as DependencyCruiserDependencyType);
	}
	return result.sort(compareText);
}

function normalizeRules(
	value: unknown,
	path: string,
	budgetState: { count: number },
	maxRules: number
): readonly DependencyCruiserNativeRule[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) fail('RAW_SHAPE_INVALID', path, 'Expected rules array.');
	budgetState.count += value.length;
	if (budgetState.count > maxRules)
		fail('BUDGET_EXCEEDED', path, 'Rule population exceeds the caller budget.');
	const rules = value.map((item, index): DependencyCruiserNativeRule => {
		const itemPath = `${path}[${index}]`;
		if (!plainRecord(item)) fail('RAW_SHAPE_INVALID', itemPath, 'Expected a rule object.');
		assertKnownKeys(item, new Set(['name', 'severity']), itemPath);
		required(item, ['name', 'severity'], itemPath);
		if (!scalarString(item.name) || item.name.length === 0)
			fail('RAW_SHAPE_INVALID', `${itemPath}.name`, 'Rule name must be non-empty.');
		if (!scalarString(item.severity) || !SEVERITIES.has(item.severity as never))
			fail('RAW_SHAPE_INVALID', `${itemPath}.severity`, 'Unknown rule severity.');
		return { ruleId: item.name, severity: item.severity as DependencyCruiserRuleSeverity };
	});
	rules.sort((left, right) =>
		compareText(`${left.ruleId}\0${left.severity}`, `${right.ruleId}\0${right.severity}`)
	);
	for (let index = 1; index < rules.length; index += 1) {
		if (canonicalSemanticJson(rules[index - 1]) === canonicalSemanticJson(rules[index]))
			fail('RAW_SHAPE_INVALID', path, 'Duplicate native rule summary.');
	}
	return rules;
}

function validateValidity(valid: unknown, rules: readonly unknown[], path: string): boolean {
	if (typeof valid !== 'boolean') fail('RAW_SHAPE_INVALID', path, 'Expected valid boolean.');
	if (valid === rules.length > 0)
		fail('RAW_SHAPE_INVALID', path, 'Validity and native rule summaries disagree.');
	return valid;
}

function observationId(
	subjectId: string,
	invocationDigest: string
): DependencyCruiserObservationId {
	return `depcruise-observation-${sha256(
		`dependency-cruiser-observation\0${DEPENDENCY_CRUISER_OBSERVATION_SCHEMA_VERSION}\0${subjectId}\0${invocationDigest}`
	)}` as DependencyCruiserObservationId;
}

function moduleId(subjectId: string, target: DependencyCruiserTarget): DependencyCruiserModuleId {
	return `depcruise-module-${sha256(
		`dependency-cruiser-module\0${DEPENDENCY_CRUISER_OBSERVATION_SCHEMA_VERSION}\0${subjectId}\0${targetKey(target)}`
	)}` as DependencyCruiserModuleId;
}

function dependencyId(
	subjectId: string,
	sourcePath: string,
	moduleSpecifier: string,
	moduleSystem: string,
	typeOnlyPartition: DependencyCruiserDependencyObservation['typeOnlyPartition']
): DependencyCruiserDependencyId {
	return `depcruise-dependency-${sha256(
		`dependency-cruiser-dependency\0${DEPENDENCY_CRUISER_OBSERVATION_SCHEMA_VERSION}\0${subjectId}\0${sourcePath}\0${moduleSpecifier}\0${moduleSystem}\0${typeOnlyPartition}`
	)}` as DependencyCruiserDependencyId;
}

function contentWithoutDigest(
	observation: DependencyCruiserObservation
): Omit<DependencyCruiserObservation, 'contentDigest'> {
	const { contentDigest: _contentDigest, ...content } = observation;
	return content;
}

export function dependencyCruiserObservationContentDigest(
	observation: DependencyCruiserObservation
): string {
	return sha256(canonicalSemanticJson(contentWithoutDigest(observation)));
}

function validTimestamp(value: unknown): value is string {
	return scalarString(value) && OFFSET_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

function hasExactEnumerableKeys(value: JsonRecord, keys: readonly string[]): boolean {
	const expected = new Set(keys);
	let count = 0;
	for (const key in value) {
		if (!Object.hasOwn(value, key)) continue;
		count += 1;
		if (count > keys.length || !expected.has(key)) return false;
	}
	return count === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function exactInvocationKeys(value: JsonRecord, keys: readonly string[], path: string): void {
	const wanted = [...keys].sort(compareText);
	if (!hasExactEnumerableKeys(value, keys))
		fail('INVOCATION_INVALID', path, `Expected exact binding fields: ${wanted.join(', ')}.`);
}

type InvocationCandidate = DependencyCruiserInvocationBinding & JsonRecord;

interface InvocationInputPaths {
	readonly characters: number;
	readonly paths: readonly string[];
}

function validateInvocationIdentity(binding: InvocationCandidate): void {
	exactInvocationKeys(
		binding,
		[
			'argvGrammarVersion',
			'baseDir',
			'budgets',
			'command',
			'config',
			'inputPaths',
			'provider',
			'providerReportedBaseDir',
			'raw',
			'rawSchemaId',
			'schemaVersion',
			'subjectRoot',
			'subjectId'
		],
		'$binding'
	);
	if (
		binding.argvGrammarVersion !== DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION ||
		binding.schemaVersion !== DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION ||
		binding.rawSchemaId !== DEPENDENCY_CRUISER_RAW_SCHEMA_ID ||
		!plainRecord(binding.provider) ||
		binding.provider.id !== DEPENDENCY_CRUISER_PROVIDER_ID ||
		binding.provider.version !== DEPENDENCY_CRUISER_PROVIDER_VERSION ||
		!SHA256.test(binding.subjectId)
	)
		fail('INVOCATION_INVALID', '$binding', 'Binding identity is unsupported or malformed.');
	exactInvocationKeys(binding.provider, ['id', 'version'], '$binding.provider');
}

function validateProviderReportedBaseDirBinding(binding: InvocationCandidate): void {
	if (!plainRecord(binding.providerReportedBaseDir))
		fail(
			'INVOCATION_INVALID',
			'$binding.providerReportedBaseDir',
			'Expected provider-reported base-directory binding.'
		);
	if (binding.providerReportedBaseDir.state === 'ABSENT') {
		exactInvocationKeys(
			binding.providerReportedBaseDir,
			['state'],
			'$binding.providerReportedBaseDir'
		);
	} else if (
		binding.providerReportedBaseDir.state === 'PRESENT' &&
		nonnegativeInteger(binding.providerReportedBaseDir.bytes) &&
		(binding.providerReportedBaseDir.representation === 'ABSOLUTE' ||
			binding.providerReportedBaseDir.representation === 'CANONICAL_RELATIVE') &&
		SHA256.test(binding.providerReportedBaseDir.sha256)
	) {
		exactInvocationKeys(
			binding.providerReportedBaseDir,
			['bytes', 'representation', 'sha256', 'state'],
			'$binding.providerReportedBaseDir'
		);
	} else {
		fail(
			'INVOCATION_INVALID',
			'$binding.providerReportedBaseDir',
			'Provider-reported base-directory binding is malformed.'
		);
	}
}

function validateSubjectRootBinding(binding: InvocationCandidate): void {
	if (
		!plainRecord(binding.subjectRoot) ||
		!nonnegativeInteger(binding.subjectRoot.bytes) ||
		!SHA256.test(binding.subjectRoot.sha256)
	)
		fail('INVOCATION_INVALID', '$binding.subjectRoot', 'Subject-root identity is malformed.');
	exactInvocationKeys(binding.subjectRoot, ['bytes', 'sha256'], '$binding.subjectRoot');
}

function validateBudgetsBinding(binding: InvocationCandidate): void {
	if (!plainRecord(binding.budgets))
		fail('INVOCATION_INVALID', '$binding.budgets', 'Expected caller budgets.');
	const budgetKeys = [
		'maxCommandArgs',
		'maxDependencies',
		'maxDependents',
		'maxIssues',
		'maxJsonDepth',
		'maxInputPaths',
		'maxModules',
		'maxPathLength',
		'maxRawBytes',
		'maxRules',
		'maxStringLength',
		'maxSummaryViolations',
		'maxTotalStringCharacters'
	] as const;
	exactInvocationKeys(binding.budgets, budgetKeys, '$binding.budgets');
	if (
		budgetKeys.some(
			(key) => !Number.isSafeInteger(binding.budgets[key]) || binding.budgets[key] < 1
		)
	)
		fail('INVOCATION_INVALID', '$binding.budgets', 'Budgets must be exact positive safe integers.');
	if (binding.budgets.maxIssues > 100_000)
		fail('INVOCATION_INVALID', '$binding.budgets.maxIssues', 'maxIssues exceeds validator bound.');
}

function validateBaseDirBinding(binding: InvocationCandidate): void {
	if (!scalarString(binding.baseDir))
		fail('INVOCATION_INVALID', '$binding.baseDir', 'Expected a canonical base directory.');
	if (binding.baseDir !== '.')
		canonicalPath(binding.baseDir, '$binding.baseDir', binding.budgets.maxPathLength);
}

function validateInputPathsBinding(binding: InvocationCandidate): InvocationInputPaths {
	if (!Array.isArray(binding.inputPaths) || binding.inputPaths.length === 0)
		fail('INVOCATION_INVALID', '$binding.inputPaths', 'At least one input path is required.');
	if (binding.inputPaths.length > binding.budgets.maxInputPaths)
		fail(
			'BUDGET_EXCEEDED',
			'$binding.inputPaths',
			'Input-path population exceeds the caller budget.'
		);
	const inputPaths = binding.inputPaths.map((value, index) => {
		if (!scalarString(value))
			fail('INVOCATION_INVALID', `$binding.inputPaths[${index}]`, 'Expected a string path.');
		if (value.length > binding.budgets.maxStringLength)
			fail(
				'BUDGET_EXCEEDED',
				`$binding.inputPaths[${index}]`,
				'Input path exceeds the string budget.'
			);
		return canonicalPath(value, `$binding.inputPaths[${index}]`, binding.budgets.maxPathLength);
	});
	const inputPathCharacters = inputPaths.reduce((total, value) => total + value.length, 0);
	if (inputPathCharacters > binding.budgets.maxTotalStringCharacters)
		fail(
			'BUDGET_EXCEEDED',
			'$binding.inputPaths',
			'Input-path characters exceed the caller budget.'
		);
	if (
		canonicalSemanticJson(inputPaths) !==
		canonicalSemanticJson([...new Set(inputPaths)].sort(compareText))
	)
		fail('INVOCATION_INVALID', '$binding.inputPaths', 'Input paths must be sorted and unique.');
	return { characters: inputPathCharacters, paths: inputPaths };
}

function validateConfigBinding(binding: InvocationCandidate): void {
	if (
		!plainRecord(binding.config) ||
		!scalarString(binding.config.path) ||
		!SHA256.test(binding.config.sha256)
	)
		fail('INVOCATION_INVALID', '$binding.config', 'Configuration binding is malformed.');
	exactInvocationKeys(binding.config, ['path', 'sha256'], '$binding.config');
	canonicalPath(binding.config.path, '$binding.config.path', binding.budgets.maxPathLength);
}

function validateCommandArgument(
	binding: InvocationCandidate,
	argument: string,
	index: number
): number {
	const path = `$binding.command.args[${index}]`;
	if (!scalarString(argument) || containsControlText(argument))
		fail('INVOCATION_INVALID', path, 'Command argument must be scalar text without controls.');
	if (argument.length > binding.budgets.maxStringLength)
		fail('BUDGET_EXCEEDED', path, 'Command argument exceeds the string budget.');
	if (
		argument.startsWith('/') ||
		argument.startsWith('\\\\') ||
		argument.startsWith('//') ||
		/^[A-Za-z]:/u.test(argument)
	)
		fail('INVOCATION_INVALID', path, 'Absolute or UNC command arguments are not admissible.');
	return argument.length;
}

function validateCommandBinding(
	binding: InvocationCandidate,
	inputPaths: InvocationInputPaths
): void {
	if (
		!plainRecord(binding.command) ||
		!Array.isArray(binding.command.args) ||
		!nonnegativeInteger(binding.command.exitStatus) ||
		!validTimestamp(binding.command.startedAt) ||
		!validTimestamp(binding.command.finishedAt) ||
		Date.parse(binding.command.finishedAt) < Date.parse(binding.command.startedAt)
	)
		fail('INVOCATION_INVALID', '$binding.command', 'Command binding is malformed.');
	exactInvocationKeys(
		binding.command,
		['args', 'exitStatus', 'finishedAt', 'startedAt'],
		'$binding.command'
	);
	if (binding.command.args.length > binding.budgets.maxCommandArgs)
		fail(
			'BUDGET_EXCEEDED',
			'$binding.command.args',
			'Command-argument population exceeds the caller budget.'
		);
	if (binding.command.args.length === 0)
		fail('INVOCATION_INVALID', '$binding.command.args', 'Closed argv grammar forbids empty argv.');
	let commandCharacters = 0;
	for (const [index, argument] of binding.command.args.entries())
		commandCharacters += validateCommandArgument(binding, argument, index);
	if (
		commandCharacters > binding.budgets.maxTotalStringCharacters ||
		commandCharacters + inputPaths.characters > binding.budgets.maxTotalStringCharacters
	)
		fail(
			'BUDGET_EXCEEDED',
			'$binding.command.args',
			'Invocation strings exceed the caller budget.'
		);
	const expectedArgs = [
		...inputPaths.paths,
		'--config',
		binding.config.path,
		'--output-type',
		'json'
	];
	if (!safeCanonicalEqual(binding.command.args, expectedArgs))
		fail(
			'INVOCATION_INVALID',
			'$binding.command.args',
			'Command arguments do not match the closed dependency-cruiser argv grammar.'
		);
}

function validateRawBinding(binding: InvocationCandidate): void {
	if (
		!plainRecord(binding.raw) ||
		!nonnegativeInteger(binding.raw.bytes) ||
		!SHA256.test(binding.raw.sha256)
	)
		fail('INVOCATION_INVALID', '$binding.raw', 'Raw identity binding is malformed.');
	exactInvocationKeys(binding.raw, ['bytes', 'sha256'], '$binding.raw');
}

function validateInvocation(binding: DependencyCruiserInvocationBinding): void {
	if (!plainRecord(binding))
		fail('INVOCATION_INVALID', '$binding', 'Expected plain binding object.');
	validateInvocationIdentity(binding);
	validateProviderReportedBaseDirBinding(binding);
	validateSubjectRootBinding(binding);
	validateBudgetsBinding(binding);
	validateBaseDirBinding(binding);
	const inputPaths = validateInputPathsBinding(binding);
	validateConfigBinding(binding);
	validateCommandBinding(binding, inputPaths);
	validateRawBinding(binding);
}

interface JsonArrayFrame {
	readonly depth: number;
	readonly index: number;
	readonly keys: IterableIterator<string>;
	readonly kind: 'ARRAY';
	readonly path: string;
	readonly value: readonly unknown[];
}

interface JsonExitFrame {
	readonly kind: 'EXIT';
	readonly value: object;
}

interface JsonObjectFrame {
	readonly depth: number;
	readonly keys: IterableIterator<string>;
	readonly kind: 'OBJECT';
	readonly path: string;
	readonly value: JsonRecord;
}

interface JsonValueFrame {
	readonly depth: number;
	readonly kind: 'VALUE';
	readonly path: string;
	readonly value: unknown;
}

type JsonWorkFrame = JsonArrayFrame | JsonExitFrame | JsonObjectFrame | JsonValueFrame;

interface JsonBudgetState {
	readonly active: WeakSet<object>;
	readonly binding: DependencyCruiserInvocationBinding;
	characters: number;
	readonly maxArrayEntries: number;
	readonly stack: JsonWorkFrame[];
}

function* enumerableOwnKeys(value: object): IterableIterator<string> {
	for (const key in value) if (Object.hasOwn(value, key)) yield key;
}

function pushArrayEntryFrames(state: JsonBudgetState, current: JsonArrayFrame, key: string): void {
	const descriptor = Object.getOwnPropertyDescriptor(current.value, key);
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
		fail('RAW_SHAPE_INVALID', current.path, 'Array entries must be enumerable data properties.');
	state.stack.push(
		{ ...current, index: current.index + 1 },
		{
			depth: current.depth + 1,
			kind: 'VALUE',
			path: `${current.path}[${current.index}]`,
			value: descriptor.value
		}
	);
}

function stepArrayFrame(state: JsonBudgetState, current: JsonArrayFrame): void {
	const next = current.keys.next();
	if (next.done) {
		if (current.index !== current.value.length)
			fail('RAW_SHAPE_INVALID', current.path, 'Sparse arrays are not admissible JSON evidence.');
		return;
	}
	if (next.value !== String(current.index))
		fail(
			'RAW_SHAPE_INVALID',
			current.path,
			'Array expando properties or noncanonical indexes are not admissible JSON evidence.'
		);
	pushArrayEntryFrames(state, current, next.value);
}

function accountObjectKey(state: JsonBudgetState, path: string, key: string): void {
	state.characters += key.length;
	if (!scalarString(key)) fail('RAW_SHAPE_INVALID', path, 'Object key is not Unicode scalar text.');
	if (key.length > state.binding.budgets.maxStringLength)
		fail('BUDGET_EXCEEDED', path, 'Object key exceeds the caller budget.');
	if (state.characters > state.binding.budgets.maxTotalStringCharacters)
		fail('BUDGET_EXCEEDED', path, 'Total string population exceeds the caller budget.');
}

function stepObjectFrame(state: JsonBudgetState, current: JsonObjectFrame): void {
	const next = current.keys.next();
	if (next.done) return;
	accountObjectKey(state, current.path, next.value);
	const descriptor = Object.getOwnPropertyDescriptor(current.value, next.value);
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
		fail('RAW_SHAPE_INVALID', current.path, 'Object fields must be enumerable data properties.');
	state.stack.push(current, {
		depth: current.depth + 1,
		kind: 'VALUE',
		path: `${current.path}.${next.value}`,
		value: descriptor.value
	});
}

function accountJsonString(state: JsonBudgetState, path: string, value: string): void {
	if (!isUnicodeScalarString(value))
		fail('RAW_SHAPE_INVALID', path, 'String is not Unicode scalar text.');
	if (value.length > state.binding.budgets.maxStringLength)
		fail('BUDGET_EXCEEDED', path, 'String exceeds the caller budget.');
	state.characters += value.length;
	if (state.characters > state.binding.budgets.maxTotalStringCharacters)
		fail('BUDGET_EXCEEDED', path, 'Total string population exceeds the caller budget.');
}

function pushArrayValueFrames(
	state: JsonBudgetState,
	current: JsonValueFrame,
	value: readonly unknown[]
): void {
	if (state.active.has(value))
		fail('RAW_SHAPE_INVALID', current.path, 'Cyclic values are not admissible JSON evidence.');
	if (value.length > state.maxArrayEntries)
		fail('BUDGET_EXCEEDED', current.path, 'Array population exceeds the caller budgets.');
	state.active.add(value);
	state.stack.push(
		{ kind: 'EXIT', value },
		{
			depth: current.depth,
			index: 0,
			keys: enumerableOwnKeys(value),
			kind: 'ARRAY',
			path: current.path,
			value
		}
	);
}

function pushObjectValueFrames(
	state: JsonBudgetState,
	current: JsonValueFrame,
	value: object
): void {
	if (!plainRecord(value)) fail('RAW_SHAPE_INVALID', current.path, 'Expected plain JSON object.');
	if (state.active.has(value))
		fail('RAW_SHAPE_INVALID', current.path, 'Cyclic values are not admissible JSON evidence.');
	state.active.add(value);
	state.stack.push(
		{ kind: 'EXIT', value },
		{
			depth: current.depth,
			keys: enumerableOwnKeys(value),
			kind: 'OBJECT',
			path: current.path,
			value
		}
	);
}

function stepValueFrame(state: JsonBudgetState, current: JsonValueFrame): void {
	if (current.depth > state.binding.budgets.maxJsonDepth)
		fail('BUDGET_EXCEEDED', current.path, 'JSON depth exceeds the caller budget.');
	if (typeof current.value === 'string') accountJsonString(state, current.path, current.value);
	else if (Array.isArray(current.value)) pushArrayValueFrames(state, current, current.value);
	else if (current.value !== null && typeof current.value === 'object')
		pushObjectValueFrames(state, current, current.value);
	else if (
		current.value !== null &&
		typeof current.value !== 'boolean' &&
		!finiteNumber(current.value)
	)
		fail('RAW_SHAPE_INVALID', current.path, 'Unsupported JSON scalar.');
}

function validateJsonBudget(
	root: unknown,
	binding: DependencyCruiserInvocationBinding,
	rootPath = '$raw'
): void {
	const state: JsonBudgetState = {
		active: new WeakSet<object>(),
		binding,
		characters: 0,
		maxArrayEntries: Math.max(
			DEPENDENCY_TYPES.length,
			64,
			binding.budgets.maxCommandArgs,
			binding.budgets.maxDependencies,
			binding.budgets.maxDependents,
			binding.budgets.maxInputPaths,
			binding.budgets.maxModules,
			binding.budgets.maxRules,
			binding.budgets.maxSummaryViolations
		),
		stack: [{ depth: 0, kind: 'VALUE', path: rootPath, value: root }]
	};
	while (state.stack.length > 0) {
		const current = state.stack.pop()!;
		if (current.kind === 'EXIT') state.active.delete(current.value);
		else if (current.kind === 'ARRAY') stepArrayFrame(state, current);
		else if (current.kind === 'OBJECT') stepObjectFrame(state, current);
		else stepValueFrame(state, current);
	}
}

function classifyModule(
	record: JsonRecord,
	source: string,
	types: readonly DependencyCruiserDependencyType[],
	binding: DependencyCruiserInvocationBinding,
	path: string
): DependencyCruiserTarget {
	const reference = safeProviderReference(source, `${path}.source`, binding.budgets.maxPathLength);
	if (record.couldNotResolve === true) return { kind: 'UNRESOLVED', specifier: reference };
	if (record.coreModule === true || types.includes('core'))
		return { kind: 'CORE_MODULE', name: reference };
	if (isExternal(types) || reference.split('/').includes('node_modules'))
		return { kind: 'EXTERNAL_MODULE', name: reference };
	return {
		kind: 'RESOLVED_LOCAL_PATH',
		path: localPath(reference, binding.baseDir, `${path}.source`, binding.budgets.maxPathLength)
	};
}

function classifyDependency(
	record: JsonRecord,
	types: readonly DependencyCruiserDependencyType[],
	binding: DependencyCruiserInvocationBinding,
	path: string
): DependencyCruiserTarget {
	const moduleSpecifier = safeProviderReference(
		record.module as string,
		`${path}.module`,
		binding.budgets.maxPathLength
	);
	const resolved = safeProviderReference(
		record.resolved as string,
		`${path}.resolved`,
		binding.budgets.maxPathLength
	);
	if (record.couldNotResolve === true) return { kind: 'UNRESOLVED', specifier: moduleSpecifier };
	if (record.coreModule === true || types.includes('core') || record.protocol === 'node:')
		return { kind: 'CORE_MODULE', name: resolved };
	if (
		isExternal(types) ||
		record.protocol === 'data:' ||
		resolved.split('/').includes('node_modules')
	)
		return { kind: 'EXTERNAL_MODULE', name: resolved };
	return {
		kind: 'RESOLVED_LOCAL_PATH',
		path: localPath(resolved, binding.baseDir, `${path}.resolved`, binding.budgets.maxPathLength)
	};
}

function validateMiniDependencies(value: unknown, path: string): void {
	if (!Array.isArray(value)) fail('RAW_SHAPE_INVALID', path, 'Expected mini-dependency array.');
	for (const [index, item] of value.entries()) {
		const itemPath = `${path}[${index}]`;
		if (!plainRecord(item)) fail('RAW_SHAPE_INVALID', itemPath, 'Expected mini-dependency object.');
		assertKnownKeys(item, new Set(['dependencyTypes', 'name']), itemPath);
		required(item, ['dependencyTypes', 'name'], itemPath);
		if (!scalarString(item.name))
			fail('RAW_SHAPE_INVALID', `${itemPath}.name`, 'Expected string mini-dependency name.');
		normalizeDependencyTypes(item.dependencyTypes, `${itemPath}.dependencyTypes`);
	}
}

function validateViolationRule(item: JsonRecord, path: string): void {
	if (!plainRecord(item.rule)) fail('RAW_SHAPE_INVALID', `${path}.rule`, 'Expected rule object.');
	assertKnownKeys(item.rule, new Set(['name', 'severity']), `${path}.rule`);
	required(item.rule, ['name', 'severity'], `${path}.rule`);
	if (
		!scalarString(item.rule.name) ||
		!scalarString(item.rule.severity) ||
		!SEVERITIES.has(item.rule.severity as never)
	)
		fail('RAW_SHAPE_INVALID', `${path}.rule`, 'Violation rule is malformed.');
}

function validateViolationMetrics(metrics: unknown, path: string): void {
	if (!plainRecord(metrics))
		fail('RAW_SHAPE_INVALID', `${path}.metrics`, 'Expected metrics object.');
	assertKnownKeys(metrics, new Set(['from', 'to']), `${path}.metrics`);
	for (const endpoint of ['from', 'to'] as const) {
		const metric = metrics[endpoint];
		if (
			!plainRecord(metric) ||
			Object.keys(metric).length !== 1 ||
			!finiteNumber(metric.instability)
		)
			fail('RAW_SHAPE_INVALID', `${path}.metrics.${endpoint}`, 'Expected instability metric.');
	}
}

function validateSummaryViolation(item: unknown, path: string): void {
	if (!plainRecord(item)) fail('RAW_SHAPE_INVALID', path, 'Expected violation object.');
	assertKnownKeys(
		item,
		new Set(['comment', 'cycle', 'from', 'metrics', 'rule', 'to', 'type', 'via']),
		path
	);
	required(item, ['from', 'rule', 'to'], path);
	if (!scalarString(item.from) || !scalarString(item.to))
		fail('RAW_SHAPE_INVALID', path, 'Violation endpoints must be strings.');
	if (
		item.type !== undefined &&
		(!scalarString(item.type) ||
			!['cycle', 'dependency', 'folder', 'instability', 'module', 'reachability'].includes(
				item.type
			))
	)
		fail('RAW_SHAPE_INVALID', `${path}.type`, 'Unknown violation type.');
	validateViolationRule(item, path);
	if (item.cycle !== undefined) validateMiniDependencies(item.cycle, `${path}.cycle`);
	if (item.via !== undefined) validateMiniDependencies(item.via, `${path}.via`);
	if (item.comment !== undefined && !scalarString(item.comment))
		fail('RAW_SHAPE_INVALID', `${path}.comment`, 'Expected string comment.');
	if (item.metrics !== undefined) validateViolationMetrics(item.metrics, path);
}

function validateSummaryViolations(
	value: unknown,
	binding: DependencyCruiserInvocationBinding
): void {
	if (!Array.isArray(value))
		fail('RAW_SHAPE_INVALID', '$raw.summary.violations', 'Expected array.');
	if (value.length > binding.budgets.maxSummaryViolations)
		fail('BUDGET_EXCEEDED', '$raw.summary.violations', 'Violation population exceeds budget.');
	for (const [index, item] of value.entries())
		validateSummaryViolation(item, `$raw.summary.violations[${index}]`);
}

function makeReverseLinks(
	dependencies: readonly DependencyCruiserDependencyObservation[]
): readonly DependencyCruiserReverseLink[] {
	const groups = new Map<
		string,
		{
			dependencyIds: DependencyCruiserDependencyId[];
			sourcePaths: Set<string>;
			target: DependencyCruiserTarget;
		}
	>();
	for (const dependency of dependencies) {
		const key = targetKey(dependency.target);
		const group = groups.get(key) ?? {
			dependencyIds: [],
			sourcePaths: new Set<string>(),
			target: dependency.target
		};
		group.dependencyIds.push(dependency.id);
		group.sourcePaths.add(dependency.sourcePath);
		groups.set(key, group);
	}
	return [...groups.entries()]
		.map(([key, value]): DependencyCruiserReverseLink => {
			const dependencyIds = [...value.dependencyIds].sort(compareText);
			return {
				dependencyIds,
				sourcePaths: [...value.sourcePaths].sort(compareText),
				target: value.target,
				targetKey: key
			};
		})
		.sort((left, right) => compareText(left.targetKey, right.targetKey));
}

function limitation(
	code: DependencyCruiserObservationLimitation['code'],
	fields: Iterable<string>,
	reason: string
): DependencyCruiserObservationLimitation {
	return { code, fields: [...new Set(fields)].sort(compareText), reason };
}

function isAbsoluteProviderBase(value: string): boolean {
	return (
		value.startsWith('/') ||
		value.startsWith('\\\\') ||
		value.startsWith('//') ||
		/^[A-Za-z]:[\\/]/u.test(value)
	);
}

function reconcileProviderBaseDir(
	optionsUsed: JsonRecord,
	binding: DependencyCruiserInvocationBinding
): boolean {
	const reported = optionsUsed.baseDir;
	if (reported === undefined) {
		if (binding.providerReportedBaseDir.state !== 'ABSENT')
			fail(
				'PROVIDER_BASE_DIR_MISMATCH',
				'$raw.summary.optionsUsed.baseDir',
				'Provider base-directory absence disagrees with its invocation binding.'
			);
		return false;
	}
	if (!scalarString(reported))
		fail(
			'RAW_SHAPE_INVALID',
			'$raw.summary.optionsUsed.baseDir',
			'Provider base directory must be a Unicode scalar string.'
		);
	if (containsControlText(reported))
		fail(
			'RAW_SHAPE_INVALID',
			'$raw.summary.optionsUsed.baseDir',
			'Provider base directory contains control text.'
		);
	if (
		binding.providerReportedBaseDir.state !== 'PRESENT' ||
		binding.providerReportedBaseDir.bytes !== Buffer.byteLength(reported, 'utf8') ||
		binding.providerReportedBaseDir.sha256 !== sha256(reported)
	)
		fail(
			'PROVIDER_BASE_DIR_MISMATCH',
			'$raw.summary.optionsUsed.baseDir',
			'Provider base directory does not match its non-disclosing invocation binding.'
		);
	const absolute = isAbsoluteProviderBase(reported);
	if (
		(absolute && binding.providerReportedBaseDir.representation !== 'ABSOLUTE') ||
		(!absolute && binding.providerReportedBaseDir.representation !== 'CANONICAL_RELATIVE')
	)
		fail(
			'PROVIDER_BASE_DIR_MISMATCH',
			'$raw.summary.optionsUsed.baseDir',
			'Provider base-directory representation disagrees with its invocation binding.'
		);
	if (absolute)
		return (
			binding.baseDir === '.' &&
			binding.providerReportedBaseDir.bytes === binding.subjectRoot.bytes &&
			binding.providerReportedBaseDir.sha256 === binding.subjectRoot.sha256
		);
	if (reported !== binding.baseDir) return false;
	if (reported === '.') return true;
	try {
		return assertCanonicalRelativePath(reported) === binding.baseDir;
	} catch {
		return false;
	}
}

interface NormalizationState {
	readonly binding: DependencyCruiserInvocationBinding;
	readonly dependencies: DependencyCruiserDependencyObservation[];
	readonly dependencyIgnoredFields: Set<string>;
	readonly dependencyKeys: Set<string>;
	dependentsCount: number;
	readonly localModules: DependencyCruiserLocalModuleObservation[];
	readonly moduleIgnoredFields: Set<string>;
	readonly nonLocalModules: DependencyCruiserNonLocalModuleObservation[];
	readonly rawModuleBySource: Map<string, RawModule>;
	readonly rawModuleByTarget: Map<string, RawModule>;
	readonly rawModules: RawModule[];
	readonly ruleBudget: { count: number };
}

interface RawRootShape {
	readonly modules: readonly unknown[];
	readonly summary: JsonRecord;
}

interface DependencyWireFields {
	readonly moduleSpecifier: string;
	readonly moduleSystem: string;
}

function assertRawRootShape(
	root: JsonRecord,
	binding: DependencyCruiserInvocationBinding
): RawRootShape {
	assertKnownKeys(root, ROOT_KEYS, '$raw');
	required(root, ['modules', 'summary'], '$raw');
	if (!Array.isArray(root.modules))
		fail('RAW_SHAPE_INVALID', '$raw.modules', 'Expected modules array.');
	if (root.modules.length > binding.budgets.maxModules)
		fail('BUDGET_EXCEEDED', '$raw.modules', 'Module population exceeds the caller budget.');
	if (!plainRecord(root.summary))
		fail('RAW_SHAPE_INVALID', '$raw.summary', 'Expected summary object.');
	const summary = root.summary;
	assertKnownKeys(summary, SUMMARY_KEYS, '$raw.summary');
	required(
		summary,
		['error', 'info', 'optionsUsed', 'totalCruised', 'violations', 'warn'],
		'$raw.summary'
	);
	if (!plainRecord(summary.optionsUsed))
		fail('RAW_SHAPE_INVALID', '$raw.summary.optionsUsed', 'Expected options object.');
	if (!reconcileProviderBaseDir(summary.optionsUsed, binding))
		fail(
			'PROVIDER_BASE_DIR_MAPPING_UNPROVEN',
			'$raw.summary.optionsUsed.baseDir',
			'No proof maps provider local paths to the bound repository subject root.'
		);
	return { modules: root.modules, summary };
}

function collectIgnoredFields(
	item: JsonRecord,
	ignored: ReadonlySet<string>,
	sink: Set<string>
): void {
	for (const key of ignored) if (Object.hasOwn(item, key)) sink.add(key);
}

function assertModuleOptionalFields(item: JsonRecord, path: string): void {
	for (const key of [
		'consolidated',
		'coreModule',
		'couldNotResolve',
		'followable',
		'matchesDoNotFollow',
		'matchesFocus',
		'matchesHighlight',
		'matchesReaches',
		'orphan'
	])
		assertOptionalBoolean(item, key, path);
	for (const key of ['checksum', 'license']) assertOptionalString(item, key, path);
	assertOptionalFiniteNumber(item, 'instability', path);
}

function normalizeRawModule(item: unknown, path: string, state: NormalizationState): void {
	if (!plainRecord(item)) fail('RAW_SHAPE_INVALID', path, 'Expected module object.');
	assertKnownKeys(item, MODULE_KEYS, path);
	required(item, ['dependencies', 'source', 'valid'], path);
	if (!scalarString(item.source))
		fail('RAW_SHAPE_INVALID', `${path}.source`, 'Expected source string.');
	if (!Array.isArray(item.dependencies))
		fail('RAW_SHAPE_INVALID', `${path}.dependencies`, 'Expected dependencies array.');
	collectIgnoredFields(item, MODULE_IGNORED_KEYS, state.moduleIgnoredFields);
	assertModuleOptionalFields(item, path);
	const types =
		item.dependencyTypes === undefined
			? []
			: normalizeDependencyTypes(item.dependencyTypes, `${path}.dependencyTypes`);
	if (item.couldNotResolve === true && item.coreModule === true)
		fail('RAW_SHAPE_INVALID', path, 'A module cannot be both core and unresolved.');
	const target = classifyModule(item, item.source, types, state.binding, path);
	const rawModule = { record: item, source: item.source, target, targetKey: targetKey(target) };
	if (state.rawModuleBySource.has(item.source) || state.rawModuleByTarget.has(rawModule.targetKey))
		fail('DUPLICATE_MODULE', path, 'Duplicate raw or normalized provider module.');
	state.rawModules.push(rawModule);
	state.rawModuleBySource.set(item.source, rawModule);
	state.rawModuleByTarget.set(rawModule.targetKey, rawModule);
}

function assertDependencyPopulation(state: NormalizationState): void {
	let dependencyCount = 0;
	for (const rawModule of state.rawModules) {
		dependencyCount += (rawModule.record.dependencies as unknown[]).length;
		if (dependencyCount > state.binding.budgets.maxDependencies)
			fail(
				'BUDGET_EXCEEDED',
				'$raw.modules[*].dependencies',
				'Dependency population exceeds budget.'
			);
		if (
			rawModule.target.kind !== 'RESOLVED_LOCAL_PATH' &&
			(rawModule.record.dependencies as unknown[]).length > 0
		)
			fail(
				'NONLOCAL_SOURCE_HAS_DEPENDENCIES',
				'$raw.modules',
				'Bounded comparison adapter does not admit dependencies sourced by non-local modules.'
			);
	}
}

function assertDependencyShape(item: JsonRecord, path: string): DependencyWireFields {
	assertKnownKeys(item, DEPENDENCY_KEYS, path);
	required(
		item,
		[
			'circular',
			'coreModule',
			'couldNotResolve',
			'dependencyTypes',
			'dynamic',
			'exoticallyRequired',
			'followable',
			'module',
			'moduleSystem',
			'resolved',
			'valid'
		],
		path
	);
	for (const key of [
		'circular',
		'coreModule',
		'couldNotResolve',
		'dynamic',
		'exoticallyRequired',
		'followable',
		'matchesDoNotFollow',
		'preCompilationOnly',
		'typeOnly'
	])
		assertOptionalBoolean(item, key, path);
	for (const key of ['exoticRequire', 'license', 'mimeType']) assertOptionalString(item, key, path);
	assertOptionalFiniteNumber(item, 'instability', path);
	if (!scalarString(item.module) || !scalarString(item.resolved))
		fail('RAW_SHAPE_INVALID', path, 'Dependency module and resolved fields must be strings.');
	if (!scalarString(item.moduleSystem) || !MODULE_SYSTEMS.has(item.moduleSystem))
		fail('RAW_SHAPE_INVALID', `${path}.moduleSystem`, 'Unknown module system.');
	if (
		item.protocol !== undefined &&
		(!scalarString(item.protocol) || !PROTOCOLS.has(item.protocol))
	)
		fail('RAW_SHAPE_INVALID', `${path}.protocol`, 'Unknown protocol.');
	if (item.cycle !== undefined) validateMiniDependencies(item.cycle, `${path}.cycle`);
	return { moduleSpecifier: item.module, moduleSystem: item.moduleSystem };
}

function normalizeDependencyItem(
	item: unknown,
	path: string,
	sourcePath: string,
	rawModule: RawModule,
	state: NormalizationState
): void {
	if (!plainRecord(item)) fail('RAW_SHAPE_INVALID', path, 'Expected dependency object.');
	const wire = assertDependencyShape(item, path);
	collectIgnoredFields(item, DEPENDENCY_IGNORED_KEYS, state.dependencyIgnoredFields);
	const types = normalizeDependencyTypes(item.dependencyTypes, `${path}.dependencyTypes`);
	if (item.couldNotResolve === true && (item.coreModule === true || types.includes('core')))
		fail('RAW_SHAPE_INVALID', path, 'A dependency cannot be both core and unresolved.');
	const target = classifyDependency(item, types, state.binding, path);
	const typeOnlyPartition = types.includes('type-only') ? 'TYPE_ONLY' : 'VALUE_OR_MIXED';
	const key = `${sourcePath}\0${wire.moduleSpecifier}\0${wire.moduleSystem}\0${typeOnlyPartition}`;
	if (state.dependencyKeys.has(key))
		fail('DUPLICATE_DEPENDENCY', path, 'Duplicate normalized provider dependency key.');
	state.dependencyKeys.add(key);
	const rules = normalizeRules(
		item.rules,
		`${path}.rules`,
		state.ruleBudget,
		state.binding.budgets.maxRules
	);
	state.dependencies.push({
		circular: item.circular as boolean,
		coreModule: item.coreModule as boolean,
		couldNotResolve: item.couldNotResolve as boolean,
		dependencyTypes: types,
		dynamic: item.dynamic as boolean,
		exoticRequire: scalarString(item.exoticRequire) ? item.exoticRequire : null,
		exoticallyRequired: item.exoticallyRequired as boolean,
		followable: item.followable as boolean,
		id: dependencyId(
			state.binding.subjectId,
			sourcePath,
			wire.moduleSpecifier,
			wire.moduleSystem,
			typeOnlyPartition
		),
		instability: finiteNumber(item.instability) ? item.instability : null,
		matchesDoNotFollow: triState(item.matchesDoNotFollow),
		mimeType: scalarString(item.mimeType) ? item.mimeType : null,
		moduleSpecifier: wire.moduleSpecifier,
		moduleSystem: wire.moduleSystem as DependencyCruiserDependencyObservation['moduleSystem'],
		preCompilationOnly: triState(item.preCompilationOnly),
		protocol: scalarString(item.protocol)
			? (item.protocol as DependencyCruiserDependencyObservation['protocol'])
			: null,
		rules,
		sourceModuleId: moduleId(state.binding.subjectId, rawModule.target),
		sourcePath,
		target,
		typeOnlyPartition,
		typeOnly: triState(item.typeOnly),
		valid: validateValidity(item.valid, rules, `${path}.valid`)
	});
}

function normalizeDependencies(state: NormalizationState): void {
	for (const [moduleIndex, rawModule] of state.rawModules.entries()) {
		if (rawModule.target.kind !== 'RESOLVED_LOCAL_PATH') continue;
		const sourcePath = rawModule.target.path;
		for (const [dependencyIndex, item] of (rawModule.record.dependencies as unknown[]).entries())
			normalizeDependencyItem(
				item,
				`$raw.modules[${moduleIndex}].dependencies[${dependencyIndex}]`,
				sourcePath,
				rawModule,
				state
			);
	}
	state.dependencies.sort((left, right) => compareText(left.id, right.id));
}

function reconcileDependentsWitness(
	record: JsonRecord,
	path: string,
	derivedDependents: readonly string[],
	state: NormalizationState
): 'ABSENT' | 'PRESENT_RECONCILED' {
	if (record.dependents === undefined) return 'ABSENT';
	if (!Array.isArray(record.dependents) || !record.dependents.every(scalarString))
		fail('RAW_SHAPE_INVALID', `${path}.dependents`, 'Expected string dependents array.');
	state.dependentsCount += record.dependents.length;
	if (state.dependentsCount > state.binding.budgets.maxDependents)
		fail('BUDGET_EXCEEDED', `${path}.dependents`, 'Dependent population exceeds budget.');
	const normalizedWitness = record.dependents.map((source, index) => {
		const dependent = state.rawModuleBySource.get(source);
		if (dependent?.target.kind !== 'RESOLVED_LOCAL_PATH')
			fail(
				'DEPENDENTS_MISMATCH',
				`${path}.dependents[${index}]`,
				'Dependent witness does not name an admitted local module.'
			);
		return dependent.target.path;
	});
	const canonicalWitness = [...new Set(normalizedWitness)].sort(compareText);
	if (
		canonicalWitness.length !== normalizedWitness.length ||
		canonicalSemanticJson(canonicalWitness) !== canonicalSemanticJson(derivedDependents)
	)
		fail(
			'DEPENDENTS_MISMATCH',
			`${path}.dependents`,
			'Dependent witness disagrees with derived reverse links.'
		);
	return 'PRESENT_RECONCILED';
}

function normalizeModuleObservation(
	rawModule: RawModule,
	path: string,
	derivedDependents: readonly string[],
	state: NormalizationState
): void {
	const record = rawModule.record;
	const types =
		record.dependencyTypes === undefined
			? []
			: normalizeDependencyTypes(record.dependencyTypes, `${path}.dependencyTypes`);
	const rules = normalizeRules(
		record.rules,
		`${path}.rules`,
		state.ruleBudget,
		state.binding.budgets.maxRules
	);
	const witness = reconcileDependentsWitness(record, path, derivedDependents, state);
	const common = {
		couldNotResolve: triState(record.couldNotResolve),
		dependencyTypes: types,
		dependentSourcePaths: derivedDependents,
		dependentsWitness: witness,
		followable: triState(record.followable),
		id: moduleId(state.binding.subjectId, rawModule.target),
		matchesDoNotFollow: triState(record.matchesDoNotFollow),
		rules,
		valid: validateValidity(record.valid, rules, `${path}.valid`)
	} as const;
	if (rawModule.target.kind === 'RESOLVED_LOCAL_PATH') {
		const sourcePath = rawModule.target.path;
		state.localModules.push({
			...common,
			dependencyIds: state.dependencies
				.filter((dependency) => dependency.sourcePath === sourcePath)
				.map((dependency) => dependency.id)
				.sort(compareText),
			sourcePath
		});
	} else {
		state.nonLocalModules.push({
			...common,
			providerSource: rawModule.source,
			target: rawModule.target
		});
	}
}

function normalizeModules(state: NormalizationState): readonly DependencyCruiserReverseLink[] {
	const reverseLinks = makeReverseLinks(state.dependencies);
	const reverseByTarget = new Map(reverseLinks.map((link) => [link.targetKey, link]));
	for (const [moduleIndex, rawModule] of state.rawModules.entries())
		normalizeModuleObservation(
			rawModule,
			`$raw.modules[${moduleIndex}]`,
			reverseByTarget.get(rawModule.targetKey)?.sourcePaths ?? [],
			state
		);
	state.localModules.sort((left, right) => compareText(left.sourcePath, right.sourcePath));
	state.nonLocalModules.sort((left, right) =>
		compareText(targetKey(left.target), targetKey(right.target))
	);
	return reverseLinks;
}

function reconcileViolationCounts(summary: JsonRecord): void {
	const violationCounts = { error: 0, ignore: 0, info: 0, warn: 0 };
	for (const item of summary.violations as JsonRecord[]) {
		const severity = (item.rule as JsonRecord).severity as keyof typeof violationCounts;
		violationCounts[severity] += 1;
	}
	for (const severity of ['error', 'info', 'warn'] as const)
		if (summary[severity] !== violationCounts[severity])
			fail(
				'RAW_SHAPE_INVALID',
				`$raw.summary.${severity}`,
				'Summary severity count does not reconcile.'
			);
	if (summary.ignore !== undefined && summary.ignore !== violationCounts.ignore)
		fail('RAW_SHAPE_INVALID', '$raw.summary.ignore', 'Summary severity count does not reconcile.');
}

function reconcileSummary(summary: JsonRecord, state: NormalizationState): void {
	for (const key of ['error', 'info', 'totalCruised', 'warn'] as const)
		if (!nonnegativeInteger(summary[key]))
			fail('RAW_SHAPE_INVALID', `$raw.summary.${key}`, 'Expected nonnegative safe integer.');
	if (summary.ignore !== undefined && !nonnegativeInteger(summary.ignore))
		fail('RAW_SHAPE_INVALID', '$raw.summary.ignore', 'Expected optional nonnegative safe integer.');
	if (
		summary.totalDependenciesCruised !== undefined &&
		!nonnegativeInteger(summary.totalDependenciesCruised)
	)
		fail(
			'RAW_SHAPE_INVALID',
			'$raw.summary.totalDependenciesCruised',
			'Expected nonnegative safe integer.'
		);
	if (summary.ruleSetUsed !== undefined && !plainRecord(summary.ruleSetUsed))
		fail('RAW_SHAPE_INVALID', '$raw.summary.ruleSetUsed', 'Expected rule-set object.');
	validateSummaryViolations(summary.violations, state.binding);
	if (summary.totalCruised !== state.rawModules.length)
		fail(
			'RAW_SHAPE_INVALID',
			'$raw.summary.totalCruised',
			'Summary module count does not reconcile.'
		);
	if (
		summary.totalDependenciesCruised !== undefined &&
		summary.totalDependenciesCruised !== state.dependencies.length
	)
		fail(
			'RAW_SHAPE_INVALID',
			'$raw.summary.totalDependenciesCruised',
			'Summary dependency count does not reconcile.'
		);
	reconcileViolationCounts(summary);
}

function collectLimitations(
	root: JsonRecord,
	summary: JsonRecord,
	state: NormalizationState
): DependencyCruiserObservationLimitation[] {
	const limitations: DependencyCruiserObservationLimitation[] = [];
	limitations.push(
		limitation(
			'PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY',
			['summary.optionsUsed'],
			'Provider resolution options are digest-bound evidence but are not yet semantically interpreted or reconciled.'
		)
	);
	if (root.folders !== undefined)
		limitations.push(
			limitation(
				'FOLDERS_NOT_INTERPRETED',
				['folders'],
				'Provider folder metrics remain bound by the raw digest but are not interpreted.'
			)
		);
	if (root.revisionData !== undefined)
		limitations.push(
			limitation(
				'REVISION_DATA_NOT_INTERPRETED',
				['revisionData'],
				'Provider cache revision data remains bound by the raw digest but is not interpreted.'
			)
		);
	if (state.moduleIgnoredFields.size > 0)
		limitations.push(
			limitation(
				'MODULE_OPTIONAL_FIELDS_NOT_INTERPRETED',
				state.moduleIgnoredFields,
				'Known optional provider module fields remain bound by the raw digest but are not interpreted.'
			)
		);
	if (state.dependencyIgnoredFields.size > 0)
		limitations.push(
			limitation(
				'DEPENDENCY_OPTIONAL_FIELDS_NOT_INTERPRETED',
				state.dependencyIgnoredFields,
				'Known optional provider dependency fields remain bound by the raw digest but are not interpreted.'
			)
		);
	if ((summary.violations as unknown[]).length > 0)
		limitations.push(
			limitation(
				'SUMMARY_VIOLATIONS_DIGEST_ONLY',
				['summary.violations'],
				'Summary violation detail remains bound by a digest; native module and dependency rules are retained directly.'
			)
		);
	limitations.sort((left, right) => compareText(left.code, right.code));
	return limitations;
}

function buildObservation(
	summary: JsonRecord,
	state: NormalizationState,
	limitations: readonly DependencyCruiserObservationLimitation[],
	reverseLinks: readonly DependencyCruiserReverseLink[]
): DependencyCruiserObservation {
	const binding = state.binding;
	const invocationDigest = sha256(canonicalSemanticJson(binding));
	const withoutDigest: Omit<DependencyCruiserObservation, 'contentDigest'> = {
		canonicalProfile: DEPENDENCY_CRUISER_CANONICAL_PROFILE,
		dependencies: state.dependencies,
		fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
		health: limitations.length === 0 ? 'COMPLETE' : 'PARTIAL',
		id: observationId(binding.subjectId, invocationDigest),
		invocation: binding,
		invocationDigest,
		limitations,
		modules: state.localModules,
		nonLocalModules: state.nonLocalModules,
		operationVersion: DEPENDENCY_CRUISER_NORMALIZATION_OPERATION_VERSION,
		reverseLinks,
		schemaVersion: DEPENDENCY_CRUISER_OBSERVATION_SCHEMA_VERSION,
		subjectId: binding.subjectId,
		summary: {
			dependencyCount: state.dependencies.length,
			error: summary.error as number,
			ignore: summary.ignore === undefined ? null : (summary.ignore as number),
			info: summary.info as number,
			localModuleCount: state.localModules.length,
			nonLocalModuleCount: state.nonLocalModules.length,
			optionsDigest: sha256(canonicalSemanticJson(summary.optionsUsed)),
			providerTotalCruised: summary.totalCruised as number,
			providerTotalDependenciesCruised:
				summary.totalDependenciesCruised === undefined
					? null
					: (summary.totalDependenciesCruised as number),
			rawModuleCount: state.rawModules.length,
			rulesDigest:
				summary.ruleSetUsed === undefined
					? null
					: sha256(canonicalSemanticJson(summary.ruleSetUsed)),
			violationsCount: (summary.violations as unknown[]).length,
			violationsDigest: sha256(canonicalSemanticJson(summary.violations)),
			warn: summary.warn as number
		}
	};
	return {
		...withoutDigest,
		contentDigest: sha256(canonicalSemanticJson(withoutDigest))
	};
}

function normalize(
	root: JsonRecord,
	binding: DependencyCruiserInvocationBinding
): DependencyCruiserObservation {
	const { modules, summary } = assertRawRootShape(root, binding);
	const state: NormalizationState = {
		binding,
		dependencies: [],
		dependencyIgnoredFields: new Set(),
		dependencyKeys: new Set(),
		dependentsCount: 0,
		localModules: [],
		moduleIgnoredFields: new Set(),
		nonLocalModules: [],
		rawModuleBySource: new Map(),
		rawModuleByTarget: new Map(),
		rawModules: [],
		ruleBudget: { count: 0 }
	};
	for (const [index, item] of modules.entries())
		normalizeRawModule(item, `$raw.modules[${index}]`, state);
	assertDependencyPopulation(state);
	normalizeDependencies(state);
	const reverseLinks = normalizeModules(state);
	reconcileSummary(summary, state);
	const limitations = collectLimitations(root, summary, state);
	return buildObservation(summary, state, limitations, reverseLinks);
}

export function normalizeDependencyCruiserOutput(
	rawJsonText: string,
	binding: DependencyCruiserInvocationBinding
): DependencyCruiserNormalizationOutcome {
	try {
		validateInvocation(binding);
		if (!scalarString(rawJsonText))
			fail('RAW_SHAPE_INVALID', '$rawText', 'Raw provider output must be Unicode scalar text.');
		const rawBytes = Buffer.byteLength(rawJsonText, 'utf8');
		if (rawBytes > binding.budgets.maxRawBytes)
			fail('BUDGET_EXCEEDED', '$rawText', 'Raw bytes exceed the caller budget.');
		if (rawBytes !== binding.raw.bytes || sha256(rawJsonText) !== binding.raw.sha256)
			fail(
				'IDENTITY_MISMATCH',
				'$binding.raw',
				'Raw byte count or SHA-256 does not match binding.'
			);
		let parsed: unknown;
		try {
			parsed = JSON.parse(rawJsonText) as unknown;
		} catch {
			fail('JSON_PARSE_FAILED', '$rawText', 'Raw provider output is not valid JSON.');
		}
		validateJsonBudget(parsed, binding);
		if (!plainRecord(parsed)) fail('RAW_SHAPE_INVALID', '$raw', 'Expected root object.');
		const rawWireValidation = validateDependencyCruiserRawWireSchema(parsed);
		if (rawWireValidation.state === 'INVALID')
			fail(
				rawWireValidation.diagnostic.code,
				rawWireValidation.diagnostic.path ?? '$raw',
				rawWireValidation.diagnostic.message
			);
		const observation = normalize(parsed, binding);
		const validation = validateDependencyCruiserObservation(observation, {
			maxIssues: binding.budgets.maxIssues
		});
		if (validation.state !== 'VALID')
			fail(
				'VALIDATION_FAILED',
				validation.issues[0]?.path ?? '$observation',
				validation.issues[0]?.message ?? 'Observation self-validation failed.'
			);
		return { diagnostics: [], observation, outcome: 'complete' };
	} catch (cause) {
		if (cause instanceof NormalizationFailure)
			return { diagnostics: [cause.diagnostic], outcome: 'unavailable' };
		return {
			diagnostics: [
				{
					code: 'RAW_SHAPE_INVALID',
					message: 'Dependency-cruiser normalization failed closed.',
					path: '$raw'
				}
			],
			outcome: 'unavailable'
		};
	}
}

class ValidationIssues {
	readonly issues: DependencyCruiserObservationValidationIssue[] = [];
	exhausted = false;

	constructor(readonly maxIssues: number) {}

	add(code: DependencyCruiserObservationValidationIssueCode, path: string, message: string): void {
		if (this.exhausted) return;
		if (this.issues.length >= this.maxIssues) {
			this.exhausted = true;
			return;
		}
		this.issues.push({ code, message, path });
	}

	result(): DependencyCruiserObservationValidationResult {
		if (this.issues.length === 0 && !this.exhausted) return { issues: [], state: 'VALID' };
		return {
			issues: this.issues,
			state: this.exhausted ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};
	}
}

function exactValidationKeys<T>(
	value: T,
	expected: readonly string[],
	path: string,
	issues: ValidationIssues
): value is T & JsonRecord {
	if (!plainRecord(value)) {
		issues.add('INVALID_SHAPE', path, 'Expected a plain object.');
		return false;
	}
	const wanted = [...expected].sort(compareText);
	if (!hasExactEnumerableKeys(value, expected)) {
		issues.add('INVALID_SHAPE', path, `Expected exact fields: ${wanted.join(', ')}.`);
		return false;
	}
	return true;
}

function safeCanonicalEqual(left: unknown, right: unknown): boolean {
	try {
		return canonicalSemanticJson(left) === canonicalSemanticJson(right);
	} catch {
		return false;
	}
}

function validationPath(value: unknown): value is string {
	if (!scalarString(value)) return false;
	try {
		assertCanonicalRelativePath(value);
		return true;
	} catch {
		return false;
	}
}

function validationProviderReference(value: unknown): value is string {
	return (
		scalarString(value) &&
		value.length > 0 &&
		!containsControlText(value) &&
		!value.includes('\\') &&
		!value.includes('\0') &&
		!value.startsWith('/') &&
		!/^[A-Za-z]:/u.test(value)
	);
}

function validationCanonicalStrings(value: unknown): value is readonly string[] {
	return (
		Array.isArray(value) &&
		value.every(scalarString) &&
		safeCanonicalEqual(value, [...new Set(value)].sort(compareText))
	);
}

function validateTargetShape(
	value: unknown,
	path: string,
	issues: ValidationIssues
): value is DependencyCruiserTarget {
	if (!plainRecord(value) || !scalarString(value.kind)) {
		issues.add('INVALID_SHAPE', path, 'Expected a discriminated target object.');
		return false;
	}
	if (value.kind === 'RESOLVED_LOCAL_PATH') {
		const valid =
			exactValidationKeys(value, ['kind', 'path'], path, issues) && validationPath(value.path);
		if (!valid) issues.add('INVALID_VALUE', path, 'Resolved local target path is invalid.');
		return valid;
	}
	if (value.kind === 'CORE_MODULE' || value.kind === 'EXTERNAL_MODULE') {
		const valid =
			exactValidationKeys(value, ['kind', 'name'], path, issues) &&
			validationProviderReference(value.name);
		if (!valid) issues.add('INVALID_VALUE', path, 'Non-local target name is invalid.');
		return valid;
	}
	if (value.kind === 'UNRESOLVED') {
		const valid =
			exactValidationKeys(value, ['kind', 'specifier'], path, issues) &&
			validationProviderReference(value.specifier);
		if (!valid) issues.add('INVALID_VALUE', path, 'Unresolved target specifier is invalid.');
		return valid;
	}
	issues.add('INVALID_VALUE', `${path}.kind`, 'Unknown target kind.');
	return false;
}

function validateRuleArray(value: unknown, path: string, issues: ValidationIssues): boolean {
	if (!Array.isArray(value)) {
		issues.add('INVALID_SHAPE', path, 'Expected native rule array.');
		return false;
	}
	let valid = true;
	for (const [index, rule] of value.entries()) {
		const rulePath = `${path}[${index}]`;
		if (!exactValidationKeys(rule, ['ruleId', 'severity'], rulePath, issues)) {
			valid = false;
			continue;
		}
		if (
			!scalarString(rule.ruleId) ||
			rule.ruleId.length === 0 ||
			!scalarString(rule.severity) ||
			!SEVERITIES.has(rule.severity as never)
		) {
			issues.add('INVALID_VALUE', rulePath, 'Native rule fields are invalid.');
			valid = false;
		}
	}
	if (
		!safeCanonicalEqual(
			value,
			[...value].sort((left, right) =>
				compareText(
					plainRecord(left) ? `${String(left.ruleId)}\0${String(left.severity)}` : '',
					plainRecord(right) ? `${String(right.ruleId)}\0${String(right.severity)}` : ''
				)
			)
		)
	) {
		issues.add('NONCANONICAL_ORDER', path, 'Native rules are not in canonical order.');
		valid = false;
	}
	return valid;
}

function validateDependencyTypesArray(
	value: unknown,
	path: string,
	issues: ValidationIssues
): boolean {
	if (
		!Array.isArray(value) ||
		!value.every((item) => scalarString(item) && DEPENDENCY_TYPE_SET.has(item))
	) {
		issues.add('INVALID_VALUE', path, 'Dependency types contain an unknown value.');
		return false;
	}
	if (!safeCanonicalEqual(value, [...new Set(value)].sort(compareText))) {
		issues.add('NONCANONICAL_ORDER', path, 'Dependency types must be sorted and unique.');
		return false;
	}
	return true;
}

function validTriState(value: unknown): value is DependencyCruiserTriState {
	return typeof value === 'boolean' || value === 'UNSPECIFIED';
}

function validateObservationInvocation(
	value: unknown,
	path: string,
	issues: ValidationIssues
): value is DependencyCruiserInvocationBinding {
	if (
		!exactValidationKeys(
			value,
			[
				'argvGrammarVersion',
				'baseDir',
				'budgets',
				'command',
				'config',
				'inputPaths',
				'provider',
				'providerReportedBaseDir',
				'raw',
				'rawSchemaId',
				'schemaVersion',
				'subjectRoot',
				'subjectId'
			],
			path,
			issues
		)
	)
		return false;
	try {
		validateInvocation(value as unknown as DependencyCruiserInvocationBinding);
		return true;
	} catch {
		issues.add('INVALID_VALUE', path, 'Invocation binding is invalid.');
		return false;
	}
}

const LOCAL_MODULE_FIELDS = [
	'couldNotResolve',
	'dependencyIds',
	'dependencyTypes',
	'dependentSourcePaths',
	'dependentsWitness',
	'followable',
	'id',
	'matchesDoNotFollow',
	'rules',
	'sourcePath',
	'valid'
] as const;
const NONLOCAL_MODULE_FIELDS = [
	'couldNotResolve',
	'dependencyTypes',
	'dependentSourcePaths',
	'dependentsWitness',
	'followable',
	'id',
	'matchesDoNotFollow',
	'providerSource',
	'rules',
	'target',
	'valid'
] as const;
const DEPENDENCY_FIELDS = [
	'circular',
	'coreModule',
	'couldNotResolve',
	'dependencyTypes',
	'dynamic',
	'exoticRequire',
	'exoticallyRequired',
	'followable',
	'id',
	'instability',
	'matchesDoNotFollow',
	'mimeType',
	'moduleSpecifier',
	'moduleSystem',
	'preCompilationOnly',
	'protocol',
	'rules',
	'sourceModuleId',
	'sourcePath',
	'target',
	'typeOnlyPartition',
	'typeOnly',
	'valid'
] as const;

interface PreflightWork {
	readonly dependencies: readonly unknown[];
	readonly limitations: readonly unknown[];
	readonly modules: readonly unknown[];
	readonly nonLocalModules: readonly unknown[];
	readonly reverseLinks: readonly unknown[];
}

interface PreflightState {
	readonly binding: DependencyCruiserInvocationBinding;
	dependencyManifestEntries: number;
	dependentEntries: number;
	readonly issues: ValidationIssues;
	reverseDependencyEntries: number;
	reverseSourceEntries: number;
	ruleEntries: number;
}

function failPreflight(state: PreflightState, path: string, message: string): false {
	state.issues.add('POPULATION_MISMATCH', path, message);
	return false;
}

function preflightPopulationBounds(state: PreflightState, work: PreflightWork): boolean {
	if (work.modules.length + work.nonLocalModules.length > state.binding.budgets.maxModules)
		return failPreflight(
			state,
			'$.modules',
			'Observation module population exceeds its embedded budget.'
		);
	if (work.dependencies.length > state.binding.budgets.maxDependencies)
		return failPreflight(
			state,
			'$.dependencies',
			'Observation dependency population exceeds its embedded budget.'
		);
	if (work.reverseLinks.length > state.binding.budgets.maxDependencies)
		return failPreflight(
			state,
			'$.reverseLinks',
			'Observation reverse-link population exceeds its embedded dependency budget.'
		);
	if (work.limitations.length > 6)
		return failPreflight(
			state,
			'$.limitations',
			'Observation limitation population exceeds its closed schema.'
		);
	return true;
}

function preflightModuleEntry(state: PreflightState, module: unknown): boolean {
	if (!plainRecord(module)) return true;
	if (
		Array.isArray(module.dependencyTypes) &&
		module.dependencyTypes.length > DEPENDENCY_TYPES.length
	)
		return failPreflight(
			state,
			'$.modules[*].dependencyTypes',
			'Module dependency-type population exceeds the provider enum.'
		);
	if (Array.isArray(module.dependencyIds)) {
		state.dependencyManifestEntries += module.dependencyIds.length;
		if (state.dependencyManifestEntries > state.binding.budgets.maxDependencies)
			return failPreflight(
				state,
				'$.modules[*].dependencyIds',
				'Module dependency manifests exceed the embedded dependency budget.'
			);
	}
	if (Array.isArray(module.dependentSourcePaths)) {
		state.dependentEntries += module.dependentSourcePaths.length;
		if (state.dependentEntries > state.binding.budgets.maxDependents)
			return failPreflight(
				state,
				'$.modules[*].dependentSourcePaths',
				'Module dependent manifests exceed the embedded dependent budget.'
			);
	}
	if (Array.isArray(module.rules)) {
		state.ruleEntries += module.rules.length;
		if (state.ruleEntries > state.binding.budgets.maxRules)
			return failPreflight(
				state,
				'$.modules[*].rules',
				'Native rule population exceeds the embedded rule budget.'
			);
	}
	return true;
}

function preflightDependencyEntry(state: PreflightState, dependency: unknown): boolean {
	if (!plainRecord(dependency)) return true;
	if (
		Array.isArray(dependency.dependencyTypes) &&
		dependency.dependencyTypes.length > DEPENDENCY_TYPES.length
	)
		return failPreflight(
			state,
			'$.dependencies[*].dependencyTypes',
			'Dependency-type population exceeds the provider enum.'
		);
	if (Array.isArray(dependency.rules)) {
		state.ruleEntries += dependency.rules.length;
		if (state.ruleEntries > state.binding.budgets.maxRules)
			return failPreflight(
				state,
				'$.dependencies[*].rules',
				'Native rule population exceeds the embedded rule budget.'
			);
	}
	return true;
}

function preflightReverseLinkEntry(state: PreflightState, reverseLink: unknown): boolean {
	if (!plainRecord(reverseLink)) return true;
	if (Array.isArray(reverseLink.dependencyIds)) {
		state.reverseDependencyEntries += reverseLink.dependencyIds.length;
		if (state.reverseDependencyEntries > state.binding.budgets.maxDependencies)
			return failPreflight(
				state,
				'$.reverseLinks[*].dependencyIds',
				'Reverse dependency manifests exceed the embedded dependency budget.'
			);
	}
	if (Array.isArray(reverseLink.sourcePaths)) {
		state.reverseSourceEntries += reverseLink.sourcePaths.length;
		if (state.reverseSourceEntries > state.binding.budgets.maxDependents)
			return failPreflight(
				state,
				'$.reverseLinks[*].sourcePaths',
				'Reverse source manifests exceed the embedded dependent budget.'
			);
	}
	return true;
}

function preflightManifestBudgets(state: PreflightState, work: PreflightWork): boolean {
	for (const population of [work.modules, work.nonLocalModules])
		for (const module of population) if (!preflightModuleEntry(state, module)) return false;
	for (const dependency of work.dependencies)
		if (!preflightDependencyEntry(state, dependency)) return false;
	for (const reverseLink of work.reverseLinks)
		if (!preflightReverseLinkEntry(state, reverseLink)) return false;
	return true;
}

function preflightLimitationFields(
	state: PreflightState,
	limitations: readonly unknown[]
): boolean {
	for (const entry of limitations)
		if (plainRecord(entry) && Array.isArray(entry.fields) && entry.fields.length > 64)
			return failPreflight(
				state,
				'$.limitations[*].fields',
				'Limitation field population exceeds the closed schema.'
			);
	return true;
}

function preflightJsonBudget(
	state: PreflightState,
	observation: DependencyCruiserObservation
): boolean {
	try {
		validateJsonBudget(observation, state.binding, '$');
	} catch (cause) {
		if (cause instanceof NormalizationFailure) {
			state.issues.add(
				cause.diagnostic.code === 'BUDGET_EXCEEDED' ? 'POPULATION_MISMATCH' : 'INVALID_SHAPE',
				cause.diagnostic.path,
				cause.diagnostic.message
			);
			return false;
		}
		state.issues.add('INVALID_SHAPE', '$', 'Observation work preflight failed closed.');
		return false;
	}
	return true;
}

function preflightObservationWork(
	observation: DependencyCruiserObservation,
	binding: DependencyCruiserInvocationBinding,
	issues: ValidationIssues
): boolean {
	const modules = Array.isArray(observation.modules) ? observation.modules : [];
	const nonLocalModules = Array.isArray(observation.nonLocalModules)
		? observation.nonLocalModules
		: [];
	const dependencies = Array.isArray(observation.dependencies) ? observation.dependencies : [];
	const reverseLinks = Array.isArray(observation.reverseLinks) ? observation.reverseLinks : [];
	const limitations = Array.isArray(observation.limitations) ? observation.limitations : [];
	const work: PreflightWork = { dependencies, limitations, modules, nonLocalModules, reverseLinks };
	const state: PreflightState = {
		binding,
		dependencyManifestEntries: 0,
		dependentEntries: 0,
		issues,
		reverseDependencyEntries: 0,
		reverseSourceEntries: 0,
		ruleEntries: 0
	};
	if (!preflightPopulationBounds(state, work)) return false;
	if (!preflightManifestBudgets(state, work)) return false;
	if (!preflightLimitationFields(state, limitations)) return false;
	return preflightJsonBudget(state, observation);
}

const LIMITATION_CODES = new Set<string>([
	'DEPENDENCY_OPTIONAL_FIELDS_NOT_INTERPRETED',
	'FOLDERS_NOT_INTERPRETED',
	'MODULE_OPTIONAL_FIELDS_NOT_INTERPRETED',
	'PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY',
	'REVISION_DATA_NOT_INTERPRETED',
	'SUMMARY_VIOLATIONS_DIGEST_ONLY'
]);

type LocalModuleCandidate = DependencyCruiserLocalModuleObservation & JsonRecord;
type DependencyCandidate = DependencyCruiserDependencyObservation & JsonRecord;

interface ObservationValidationState {
	readonly admittedLimitations: DependencyCruiserObservationLimitation[];
	readonly admittedNonLocalModules: DependencyCruiserNonLocalModuleObservation[];
	readonly dependencyById: Map<string, DependencyCruiserDependencyObservation>;
	readonly dependencyKeys: Set<string>;
	invocationValid: boolean;
	readonly issues: ValidationIssues;
	readonly limitationCodes: Set<string>;
	readonly moduleById: Map<string, DependencyCruiserLocalModuleObservation>;
	readonly moduleByPath: Map<string, DependencyCruiserLocalModuleObservation>;
	readonly nonLocalKeys: Set<string>;
	readonly observation: DependencyCruiserObservation;
}

interface DependencyFieldChecks {
	readonly moduleSpecifierValid: boolean;
	readonly moduleSystemValid: boolean;
	readonly partitionValid: boolean;
	readonly rulesValid: boolean;
	readonly sourcePathValid: boolean;
	readonly targetValid: boolean;
	readonly typesValid: boolean;
}

function validateObservationVersions(state: ObservationValidationState): void {
	const observation = state.observation;
	if (
		observation.schemaVersion !== DEPENDENCY_CRUISER_OBSERVATION_SCHEMA_VERSION ||
		observation.operationVersion !== DEPENDENCY_CRUISER_NORMALIZATION_OPERATION_VERSION ||
		observation.canonicalProfile !== DEPENDENCY_CRUISER_CANONICAL_PROFILE
	)
		state.issues.add(
			'UNSUPPORTED_SCHEMA_VERSION',
			'$',
			'Observation version or canonical profile is unsupported.'
		);
	if (observation.fullJanCsaa007Conformance !== FULL_JAN_CSAA_007_CONFORMANCE)
		state.issues.add(
			'INVALID_VALUE',
			'$.fullJanCsaa007Conformance',
			'Full JAN-CSAA-007 conformance is not claimed.'
		);
}

function validateObservationIdentity(state: ObservationValidationState): void {
	const observation = state.observation;
	if (!scalarString(observation.subjectId) || !SHA256.test(observation.subjectId))
		state.issues.add('INVALID_VALUE', '$.subjectId', 'Subject identity must be lowercase SHA-256.');
	if (state.invocationValid && observation.subjectId !== observation.invocation.subjectId)
		state.issues.add(
			'IDENTITY_MISMATCH',
			'$.subjectId',
			'Subject and invocation identities disagree.'
		);
	if (!scalarString(observation.invocationDigest) || !SHA256.test(observation.invocationDigest))
		state.issues.add('INVALID_VALUE', '$.invocationDigest', 'Invocation digest is invalid.');
	else if (
		state.invocationValid &&
		observation.invocationDigest !== sha256(canonicalSemanticJson(observation.invocation))
	)
		state.issues.add('IDENTITY_MISMATCH', '$.invocationDigest', 'Invocation digest mismatch.');
	if (
		!scalarString(observation.id) ||
		observation.id !== observationId(observation.subjectId, observation.invocationDigest)
	)
		state.issues.add('IDENTITY_MISMATCH', '$.id', 'Observation identity mismatch.');
}

function localModuleFlagsValid(module: LocalModuleCandidate): boolean {
	let valid = true;
	if (
		!validTriState(module.couldNotResolve) ||
		!validTriState(module.followable) ||
		!validTriState(module.matchesDoNotFollow)
	)
		valid = false;
	if (!['ABSENT', 'PRESENT_RECONCILED'].includes(module.dependentsWitness)) valid = false;
	if (
		typeof module.valid !== 'boolean' ||
		!Array.isArray(module.rules) ||
		module.valid === module.rules.length > 0
	)
		valid = false;
	return valid;
}

function validateLocalModuleEntry(
	state: ObservationValidationState,
	module: DependencyCruiserLocalModuleObservation,
	path: string
): boolean {
	if (!exactValidationKeys(module, LOCAL_MODULE_FIELDS, path, state.issues)) return false;
	const sourcePathValid = validationPath(module.sourcePath);
	const dependencyIdsValid = validationCanonicalStrings(module.dependencyIds);
	const dependentPathsValid =
		validationCanonicalStrings(module.dependentSourcePaths) &&
		module.dependentSourcePaths.every(validationPath);
	const typesValid = validateDependencyTypesArray(
		module.dependencyTypes,
		`${path}.dependencyTypes`,
		state.issues
	);
	const rulesValid = validateRuleArray(module.rules, `${path}.rules`, state.issues);
	let valid =
		sourcePathValid && dependencyIdsValid && dependentPathsValid && typesValid && rulesValid;
	if (!localModuleFlagsValid(module)) valid = false;
	const identityValid =
		sourcePathValid &&
		scalarString(state.observation.subjectId) &&
		scalarString(module.id) &&
		module.id ===
			moduleId(state.observation.subjectId, {
				kind: 'RESOLVED_LOCAL_PATH',
				path: module.sourcePath
			});
	if (!identityValid) {
		state.issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Module identity mismatch.');
		valid = false;
	}
	if (
		scalarString(module.id) &&
		sourcePathValid &&
		(state.moduleById.has(module.id) || state.moduleByPath.has(module.sourcePath))
	) {
		state.issues.add('POPULATION_MISMATCH', path, 'Duplicate local module identity or path.');
		valid = false;
	}
	if (!valid) {
		state.issues.add('INVALID_VALUE', path, 'Local module fields are invalid.');
		return false;
	}
	state.moduleById.set(module.id, module as unknown as DependencyCruiserLocalModuleObservation);
	state.moduleByPath.set(
		module.sourcePath,
		module as unknown as DependencyCruiserLocalModuleObservation
	);
	return true;
}

function validateLocalModules(state: ObservationValidationState): void {
	const observation = state.observation;
	if (!Array.isArray(observation.modules)) {
		state.issues.add('INVALID_SHAPE', '$.modules', 'Expected local module array.');
		return;
	}
	let populationValid = true;
	for (const [index, module] of observation.modules.entries())
		if (!validateLocalModuleEntry(state, module, `$.modules[${index}]`)) populationValid = false;
	const sorted = populationValid
		? [...state.moduleByPath.values()].sort((left, right) =>
				compareText(left.sourcePath, right.sourcePath)
			)
		: null;
	if (sorted !== null && !safeCanonicalEqual(observation.modules, sorted))
		state.issues.add(
			'NONCANONICAL_ORDER',
			'$.modules',
			'Local modules are not canonically ordered.'
		);
}

function validateNonLocalModuleEntry(
	state: ObservationValidationState,
	module: DependencyCruiserNonLocalModuleObservation,
	path: string
): boolean {
	if (!exactValidationKeys(module, NONLOCAL_MODULE_FIELDS, path, state.issues)) return false;
	const targetValid = validateTargetShape(module.target, `${path}.target`, state.issues);
	const dependentPathsValid =
		validationCanonicalStrings(module.dependentSourcePaths) &&
		module.dependentSourcePaths.every(validationPath);
	const typesValid = validateDependencyTypesArray(
		module.dependencyTypes,
		`${path}.dependencyTypes`,
		state.issues
	);
	const rulesValid = validateRuleArray(module.rules, `${path}.rules`, state.issues);
	// ⚠ THE PARAMETER TYPE IS A CLAIM UNDER TEST, NOT A FACT, so this comparison is NOT dead.
	// `state.observation.nonLocalModules` is `readonly unknown[]` — this function is what proves each
	// element matches its declared shape. The declared union excludes RESOLVED_LOCAL_PATH, so the
	// type-checker calls the check unreachable, but a caller-supplied observation can carry exactly
	// that kind and admitting it is the defect this guard refuses. Before extraction the loop variable
	// was `any` (narrowed from `unknown[]` by Array.isArray) and the check compiled; giving the helper
	// a concrete parameter type is what made TS prove it away. Read through a widened local so the
	// RUNTIME guard survives the type system rather than being deleted by it.
	let valid =
		targetValid &&
		// ⚠ THE CAST MUST STAY AT THE USE SITE, BEHIND `targetValid &&`. Hoisting this read into a
		// `const` (which I did, to silence TS2367) makes it EAGER, and a non-local module with
		// `target: null` then throws a TypeError instead of being recorded as an invalid entry —
		// `validateTargetShape` has already added the INVALID_SHAPE issue and returned false, and the
		// short-circuit is what stops the dereference.
		// The cast itself is needed because the parameter type is a CLAIM UNDER TEST, not a fact:
		// `state.observation.nonLocalModules` is `readonly unknown[]`, so the declared union (which
		// excludes RESOLVED_LOCAL_PATH) lets TS prove this comparison dead when it is not.
		(module.target as { readonly kind: string }).kind !== 'RESOLVED_LOCAL_PATH' &&
		validationProviderReference(module.providerSource) &&
		validTriState(module.couldNotResolve) &&
		validTriState(module.followable) &&
		validTriState(module.matchesDoNotFollow) &&
		dependentPathsValid &&
		typesValid &&
		rulesValid &&
		['ABSENT', 'PRESENT_RECONCILED'].includes(module.dependentsWitness) &&
		typeof module.valid === 'boolean';
	if (!Array.isArray(module.rules) || module.valid === module.rules.length > 0) valid = false;
	if (targetValid) {
		const key = targetKey(module.target);
		if (state.nonLocalKeys.has(key)) {
			state.issues.add('POPULATION_MISMATCH', path, 'Duplicate non-local module target.');
			valid = false;
		}
		if (
			!scalarString(module.id) ||
			!scalarString(state.observation.subjectId) ||
			module.id !== moduleId(state.observation.subjectId, module.target)
		) {
			state.issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Module identity mismatch.');
			valid = false;
		}
		if (valid) state.nonLocalKeys.add(key);
	}
	if (!valid) {
		state.issues.add('INVALID_VALUE', path, 'Non-local module fields are invalid.');
		return false;
	}
	state.admittedNonLocalModules.push(
		module as unknown as DependencyCruiserNonLocalModuleObservation
	);
	return true;
}

function validateNonLocalModules(state: ObservationValidationState): void {
	const observation = state.observation;
	if (!Array.isArray(observation.nonLocalModules)) {
		state.issues.add('INVALID_SHAPE', '$.nonLocalModules', 'Expected non-local module array.');
		return;
	}
	let populationValid = true;
	for (const [index, module] of observation.nonLocalModules.entries())
		if (!validateNonLocalModuleEntry(state, module, `$.nonLocalModules[${index}]`))
			populationValid = false;
	const sorted = populationValid
		? [...state.admittedNonLocalModules].sort((left, right) =>
				compareText(targetKey(left.target), targetKey(right.target))
			)
		: null;
	if (sorted !== null && !safeCanonicalEqual(observation.nonLocalModules, sorted))
		state.issues.add(
			'NONCANONICAL_ORDER',
			'$.nonLocalModules',
			'Non-local modules are not canonically ordered.'
		);
}

function dependencyShapeValid(
	dependency: DependencyCandidate,
	checks: DependencyFieldChecks
): boolean {
	const valid =
		checks.targetValid &&
		checks.typesValid &&
		checks.rulesValid &&
		typeof dependency.circular === 'boolean' &&
		typeof dependency.coreModule === 'boolean' &&
		typeof dependency.couldNotResolve === 'boolean' &&
		typeof dependency.dynamic === 'boolean' &&
		typeof dependency.exoticallyRequired === 'boolean' &&
		typeof dependency.followable === 'boolean' &&
		(dependency.exoticRequire === null || scalarString(dependency.exoticRequire)) &&
		(dependency.instability === null || finiteNumber(dependency.instability)) &&
		validTriState(dependency.matchesDoNotFollow) &&
		(dependency.mimeType === null || scalarString(dependency.mimeType)) &&
		checks.moduleSpecifierValid &&
		checks.moduleSystemValid &&
		validTriState(dependency.preCompilationOnly) &&
		(dependency.protocol === null || PROTOCOLS.has(dependency.protocol)) &&
		checks.sourcePathValid &&
		checks.partitionValid &&
		validTriState(dependency.typeOnly) &&
		typeof dependency.valid === 'boolean';
	if (!Array.isArray(dependency.rules) || dependency.valid === dependency.rules.length > 0)
		return false;
	return valid;
}

function validateDependencyIdentity(
	state: ObservationValidationState,
	dependency: DependencyCandidate,
	path: string
): boolean {
	let valid = true;
	const expectedPartition = (dependency.dependencyTypes as readonly unknown[]).includes('type-only')
		? 'TYPE_ONLY'
		: 'VALUE_OR_MIXED';
	if (dependency.typeOnlyPartition !== expectedPartition) {
		state.issues.add(
			'RECONCILIATION_MISMATCH',
			`${path}.typeOnlyPartition`,
			'Type-only identity partition disagrees with provider dependency types.'
		);
		valid = false;
	}
	const key = `${dependency.sourcePath}\0${dependency.moduleSpecifier}\0${dependency.moduleSystem}\0${dependency.typeOnlyPartition}`;
	if (state.dependencyKeys.has(key)) {
		state.issues.add('POPULATION_MISMATCH', path, 'Duplicate normalized dependency key.');
		valid = false;
	}
	state.dependencyKeys.add(key);
	if (
		!scalarString(dependency.id) ||
		!scalarString(state.observation.subjectId) ||
		dependency.id !==
			dependencyId(
				state.observation.subjectId,
				dependency.sourcePath,
				dependency.moduleSpecifier,
				dependency.moduleSystem,
				dependency.typeOnlyPartition
			)
	) {
		state.issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Dependency identity mismatch.');
		valid = false;
	}
	return valid;
}

function dependencyEntryValid(
	state: ObservationValidationState,
	dependency: DependencyCandidate,
	path: string
): boolean {
	const targetValid = validateTargetShape(dependency.target, `${path}.target`, state.issues);
	const typesValid = validateDependencyTypesArray(
		dependency.dependencyTypes,
		`${path}.dependencyTypes`,
		state.issues
	);
	const rulesValid = validateRuleArray(dependency.rules, `${path}.rules`, state.issues);
	const sourcePathValid = validationPath(dependency.sourcePath);
	const moduleSpecifierValid = validationProviderReference(dependency.moduleSpecifier);
	const moduleSystemValid =
		scalarString(dependency.moduleSystem) && MODULE_SYSTEMS.has(dependency.moduleSystem);
	const partitionValid =
		dependency.typeOnlyPartition === 'TYPE_ONLY' ||
		dependency.typeOnlyPartition === 'VALUE_OR_MIXED';
	let valid = dependencyShapeValid(dependency, {
		moduleSpecifierValid,
		moduleSystemValid,
		partitionValid,
		rulesValid,
		sourcePathValid,
		targetValid,
		typesValid
	});
	const sourceModule = sourcePathValid ? state.moduleByPath.get(dependency.sourcePath) : undefined;
	// S6582 REFUSED: `dependency.sourceModuleId !== sourceModule?.id` stops refusing when BOTH are
	// undefined, and `dependency` is caller-supplied — a dependency with no sourceModuleId would
	// silently reconcile against a module that was never found. Same family as the other guards
	// this campaign restored across all four bands.
	if (sourceModule === undefined || dependency.sourceModuleId !== sourceModule.id) {
		state.issues.add(
			'RECONCILIATION_MISMATCH',
			`${path}.sourceModuleId`,
			'Dependency source module is absent or mismatched.'
		);
		valid = false;
	}
	const identityCheckable =
		targetValid &&
		typesValid &&
		sourcePathValid &&
		moduleSpecifierValid &&
		moduleSystemValid &&
		partitionValid;
	if (identityCheckable && !validateDependencyIdentity(state, dependency, path)) valid = false;
	return valid;
}

function validateDependencyEntry(
	state: ObservationValidationState,
	dependency: DependencyCruiserDependencyObservation,
	path: string
): boolean {
	if (!exactValidationKeys(dependency, DEPENDENCY_FIELDS, path, state.issues)) return false;
	let valid = dependencyEntryValid(state, dependency, path);
	if (scalarString(dependency.id) && state.dependencyById.has(dependency.id)) {
		state.issues.add('POPULATION_MISMATCH', `${path}.id`, 'Duplicate dependency identity.');
		valid = false;
	}
	if (!valid || !scalarString(dependency.id)) {
		state.issues.add('INVALID_VALUE', path, 'Dependency fields are invalid.');
		return false;
	}
	state.dependencyById.set(
		dependency.id,
		dependency as unknown as DependencyCruiserDependencyObservation
	);
	return true;
}

function validateObservationDependencies(state: ObservationValidationState): void {
	const observation = state.observation;
	if (!Array.isArray(observation.dependencies)) {
		state.issues.add('INVALID_SHAPE', '$.dependencies', 'Expected dependency array.');
		return;
	}
	let populationValid = true;
	for (const [index, dependency] of observation.dependencies.entries())
		if (!validateDependencyEntry(state, dependency, `$.dependencies[${index}]`))
			populationValid = false;
	const sorted = populationValid
		? [...state.dependencyById.values()].sort((left, right) => compareText(left.id, right.id))
		: null;
	if (sorted !== null && !safeCanonicalEqual(observation.dependencies, sorted))
		state.issues.add(
			'NONCANONICAL_ORDER',
			'$.dependencies',
			'Dependencies are not canonically ordered.'
		);
}

function reconcileObservationLinks(state: ObservationValidationState): void {
	for (const [path, module] of state.moduleByPath) {
		const expectedDependencies = [...state.dependencyById.values()]
			.filter((dependency) => dependency.sourcePath === path)
			.map((dependency) => dependency.id)
			.sort(compareText);
		if (!safeCanonicalEqual(module.dependencyIds, expectedDependencies))
			state.issues.add(
				'RECONCILIATION_MISMATCH',
				'$.modules',
				'Module dependency manifest mismatch.'
			);
	}
	const expectedReverseLinks = makeReverseLinks([...state.dependencyById.values()]);
	if (!safeCanonicalEqual(state.observation.reverseLinks, expectedReverseLinks))
		state.issues.add(
			'RECONCILIATION_MISMATCH',
			'$.reverseLinks',
			'Reverse links do not reconcile.'
		);
	const expectedDependents = new Map(
		expectedReverseLinks.map((link) => [link.targetKey, link.sourcePaths])
	);
	for (const module of state.moduleByPath.values()) {
		const expected =
			expectedDependents.get(targetKey({ kind: 'RESOLVED_LOCAL_PATH', path: module.sourcePath })) ??
			[];
		if (!safeCanonicalEqual(module.dependentSourcePaths, expected))
			state.issues.add(
				'RECONCILIATION_MISMATCH',
				'$.modules',
				'Local module dependents do not reconcile.'
			);
	}
	for (const module of state.admittedNonLocalModules) {
		const expected = expectedDependents.get(targetKey(module.target)) ?? [];
		if (!safeCanonicalEqual(module.dependentSourcePaths, expected))
			state.issues.add(
				'RECONCILIATION_MISMATCH',
				'$.nonLocalModules',
				'Non-local module dependents do not reconcile.'
			);
	}
}

function validateSummaryCounts(state: ObservationValidationState): void {
	for (const key of [
		'dependencyCount',
		'error',
		'info',
		'localModuleCount',
		'nonLocalModuleCount',
		'providerTotalCruised',
		'rawModuleCount',
		'violationsCount',
		'warn'
	] as const)
		if (!nonnegativeInteger(state.observation.summary[key]))
			state.issues.add('INVALID_VALUE', `$.summary.${key}`, 'Expected nonnegative safe integer.');
	if (
		state.observation.summary.ignore !== null &&
		!nonnegativeInteger(state.observation.summary.ignore)
	)
		state.issues.add(
			'INVALID_VALUE',
			'$.summary.ignore',
			'Expected nullable nonnegative safe integer.'
		);
	if (
		state.observation.summary.providerTotalDependenciesCruised !== null &&
		!nonnegativeInteger(state.observation.summary.providerTotalDependenciesCruised)
	)
		state.issues.add(
			'INVALID_VALUE',
			'$.summary.providerTotalDependenciesCruised',
			'Expected nullable count.'
		);
}

function validateSummaryDigests(state: ObservationValidationState): void {
	for (const key of ['optionsDigest', 'violationsDigest'] as const)
		if (
			!scalarString(state.observation.summary[key]) ||
			!SHA256.test(state.observation.summary[key])
		)
			state.issues.add('INVALID_VALUE', `$.summary.${key}`, 'Expected lowercase SHA-256.');
	if (
		state.observation.summary.rulesDigest !== null &&
		(!scalarString(state.observation.summary.rulesDigest) ||
			!SHA256.test(state.observation.summary.rulesDigest))
	)
		state.issues.add(
			'INVALID_VALUE',
			'$.summary.rulesDigest',
			'Expected nullable lowercase SHA-256.'
		);
}

function summaryPopulationMismatched(state: ObservationValidationState): boolean {
	const observation = state.observation;
	return (
		observation.summary.dependencyCount !== state.dependencyById.size ||
		observation.summary.localModuleCount !== state.moduleByPath.size ||
		observation.summary.nonLocalModuleCount !== state.nonLocalKeys.size ||
		observation.summary.rawModuleCount !== state.moduleByPath.size + state.nonLocalKeys.size ||
		observation.summary.providerTotalCruised !== observation.summary.rawModuleCount ||
		(observation.summary.providerTotalDependenciesCruised !== null &&
			observation.summary.providerTotalDependenciesCruised !== state.dependencyById.size)
	);
}

function validateObservationSummary(state: ObservationValidationState): void {
	// A shape issue is recorded by the exactness check itself; nothing further is reconcilable.
	if (
		!exactValidationKeys(
			state.observation.summary,
			[
				'dependencyCount',
				'error',
				'ignore',
				'info',
				'localModuleCount',
				'nonLocalModuleCount',
				'optionsDigest',
				'providerTotalCruised',
				'providerTotalDependenciesCruised',
				'rawModuleCount',
				'rulesDigest',
				'violationsCount',
				'violationsDigest',
				'warn'
			],
			'$.summary',
			state.issues
		)
	)
		return;
	validateSummaryCounts(state);
	validateSummaryDigests(state);
	if (summaryPopulationMismatched(state))
		state.issues.add(
			'POPULATION_MISMATCH',
			'$.summary',
			'Observation population summary does not reconcile.'
		);
}

function validateLimitationEntry(
	state: ObservationValidationState,
	entry: DependencyCruiserObservationLimitation,
	path: string
): boolean {
	if (!exactValidationKeys(entry, ['code', 'fields', 'reason'], path, state.issues)) return false;
	let valid =
		scalarString(entry.code) &&
		LIMITATION_CODES.has(entry.code) &&
		validationCanonicalStrings(entry.fields) &&
		entry.fields.length > 0 &&
		scalarString(entry.reason) &&
		entry.reason.length > 0;
	if (!valid) state.issues.add('INVALID_VALUE', path, 'Limitation is invalid.');
	if (scalarString(entry.code) && state.limitationCodes.has(entry.code)) {
		state.issues.add('POPULATION_MISMATCH', `${path}.code`, 'Duplicate limitation code.');
		valid = false;
	}
	if (!valid || !scalarString(entry.code)) return false;
	state.limitationCodes.add(entry.code);
	state.admittedLimitations.push(entry as unknown as DependencyCruiserObservationLimitation);
	return true;
}

function validateObservationBaseDirMapping(state: ObservationValidationState): void {
	const observation = state.observation;
	const reported = observation.invocation.providerReportedBaseDir;
	const mappingVerified =
		reported.state === 'PRESENT' &&
		((reported.representation === 'CANONICAL_RELATIVE' &&
			reported.bytes === Buffer.byteLength(observation.invocation.baseDir, 'utf8') &&
			reported.sha256 === sha256(observation.invocation.baseDir)) ||
			(reported.representation === 'ABSOLUTE' &&
				observation.invocation.baseDir === '.' &&
				reported.bytes === observation.invocation.subjectRoot.bytes &&
				reported.sha256 === observation.invocation.subjectRoot.sha256));
	if (!mappingVerified)
		state.issues.add(
			'RECONCILIATION_MISMATCH',
			'$.invocation',
			'Invocation does not prove the provider base-directory mapping required by repository-qualified paths.'
		);
}

function validateObservationLimitations(state: ObservationValidationState): void {
	const observation = state.observation;
	if (!Array.isArray(observation.limitations)) {
		state.issues.add('INVALID_SHAPE', '$.limitations', 'Expected limitations array.');
		return;
	}
	let populationValid = true;
	for (const [index, entry] of observation.limitations.entries())
		if (!validateLimitationEntry(state, entry, `$.limitations[${index}]`)) populationValid = false;
	const sorted = populationValid
		? [...state.admittedLimitations].sort((left, right) => compareText(left.code, right.code))
		: null;
	if (sorted !== null && !safeCanonicalEqual(observation.limitations, sorted))
		state.issues.add(
			'NONCANONICAL_ORDER',
			'$.limitations',
			'Limitations are not canonically ordered.'
		);
	if (!state.limitationCodes.has('PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY'))
		state.issues.add(
			'RECONCILIATION_MISMATCH',
			'$.limitations',
			'Uninterpreted provider resolution options require an explicit limitation.'
		);
	if (state.invocationValid) validateObservationBaseDirMapping(state);
	const expectedHealth = observation.limitations.length === 0 ? 'COMPLETE' : 'PARTIAL';
	if (observation.health !== expectedHealth)
		state.issues.add(
			'RECONCILIATION_MISMATCH',
			'$.health',
			'Health does not match declared limitations.'
		);
}

function validateObservationContentDigest(state: ObservationValidationState): void {
	const observation = state.observation;
	if (!scalarString(observation.contentDigest) || !SHA256.test(observation.contentDigest)) {
		state.issues.add(
			'INVALID_VALUE',
			'$.contentDigest',
			'Content digest must be lowercase SHA-256.'
		);
		return;
	}
	try {
		if (observation.contentDigest !== dependencyCruiserObservationContentDigest(observation))
			state.issues.add(
				'CONTENT_DIGEST_MISMATCH',
				'$.contentDigest',
				'Observation content digest mismatch.'
			);
	} catch {
		state.issues.add(
			'CONTENT_DIGEST_MISMATCH',
			'$.contentDigest',
			'Observation is not canonically serializable.'
		);
	}
}

function validateDependencyCruiserObservationInternal(
	value: unknown,
	options: DependencyCruiserObservationValidationOptions = {}
): DependencyCruiserObservationValidationResult {
	const maxIssues = options.maxIssues ?? DEFAULT_VALIDATION_MAX_ISSUES;
	if (!Number.isSafeInteger(maxIssues) || maxIssues < 1 || maxIssues > 100_000) {
		return {
			issues: [
				{
					code: 'INVALID_VALUE',
					message: 'maxIssues must be a positive safe integer no greater than 100000.',
					path: '$validationOptions.maxIssues'
				}
			],
			state: 'INVALID'
		};
	}
	const issues = new ValidationIssues(maxIssues);
	if (
		!exactValidationKeys(
			value,
			[
				'canonicalProfile',
				'contentDigest',
				'dependencies',
				'fullJanCsaa007Conformance',
				'health',
				'id',
				'invocation',
				'invocationDigest',
				'limitations',
				'modules',
				'nonLocalModules',
				'operationVersion',
				'reverseLinks',
				'schemaVersion',
				'subjectId',
				'summary'
			],
			'$',
			issues
		)
	)
		return issues.result();
	const state: ObservationValidationState = {
		admittedLimitations: [],
		admittedNonLocalModules: [],
		dependencyById: new Map(),
		dependencyKeys: new Set(),
		invocationValid: false,
		issues,
		limitationCodes: new Set(),
		moduleById: new Map(),
		moduleByPath: new Map(),
		nonLocalKeys: new Set(),
		observation: value as unknown as DependencyCruiserObservation
	};
	validateObservationVersions(state);
	state.invocationValid = validateObservationInvocation(
		state.observation.invocation,
		'$.invocation',
		issues
	);
	if (!state.invocationValid) return issues.result();
	if (!preflightObservationWork(state.observation, state.observation.invocation, issues))
		return issues.result();
	validateObservationIdentity(state);
	validateLocalModules(state);
	validateNonLocalModules(state);
	validateObservationDependencies(state);
	reconcileObservationLinks(state);
	validateObservationSummary(state);
	validateObservationLimitations(state);
	validateObservationContentDigest(state);
	return issues.result();
}

export function validateDependencyCruiserObservation(
	value: unknown,
	options: DependencyCruiserObservationValidationOptions = {}
): DependencyCruiserObservationValidationResult {
	try {
		return validateDependencyCruiserObservationInternal(value, options);
	} catch {
		return {
			issues: [
				{
					code: 'INVALID_SHAPE',
					message: 'Observation validation failed closed on a hostile value.',
					path: '$'
				}
			],
			state: 'INVALID'
		};
	}
}
