import { isProxy } from 'node:util/types';

import {
	GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER,
	GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE,
	GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE,
	GUARD_ENFORCEMENT_LEDGER_GATE_EFFECT,
	GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
	GUARD_ENFORCEMENT_LEDGER_LIMITATIONS,
	GUARD_ENFORCEMENT_LEDGER_MAX_EXECUTOR_DURATION_MS,
	GUARD_ENFORCEMENT_LEDGER_METHOD,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE,
	GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION,
	GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT,
	GUARD_ENFORCEMENT_LEDGER_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY,
	type GuardEnforcementLedgerObservation,
	type GuardEnforcementLedgerValidationIssue,
	type GuardEnforcementLedgerValidationIssueCode,
	type GuardEnforcementLedgerValidationOptions,
	type GuardEnforcementLedgerValidationResult
} from '../../contracts/guard-enforcement-ledger.js';
import type { FrozenSubject } from '../../contracts/subject.js';
import { compareText } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import { validateGuardEnforcementLedgerArtifactSet } from './artifact-set.js';
import {
	GuardEnforcementLedgerNormalizationError,
	normalizeGuardEnforcementLedgerObservation
} from './normalize-guard-enforcement-ledger.js';

class InvalidObservation extends Error {
	constructor(readonly issue: GuardEnforcementLedgerValidationIssue) {
		super(issue.message);
	}
}

function invalid(
	code: GuardEnforcementLedgerValidationIssueCode,
	path: string,
	message: string
): never {
	throw new InvalidObservation({ code, message, path });
}

interface ValidatedOptions {
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

const OBSERVATION_KEYS = [
	'artifactSet',
	'authorityTransfer',
	'baselineChange',
	'budgets',
	'canonicalProfile',
	'contentDigest',
	'coverage',
	'executor',
	'gateEffect',
	'guardedArrows',
	'guards',
	'health',
	'id',
	'integrationStrategy',
	'limitations',
	'method',
	'operationVersion',
	'oracleChange',
	'rawEvidence',
	'rawOutput',
	'replacementEquivalence',
	'retainedTestExecution',
	'runtimeEnforcement',
	'schemaVersion',
	'subjectId',
	'verifierAuthority'
] as const;

const BUDGET_KEYS = [
	'maxArtifacts',
	'maxAuditEntries',
	'maxDiagnostics',
	'maxExecutorDurationMs',
	'maxExternalModuleBytes',
	'maxExternalModuleFiles',
	'maxGuardedArrows',
	'maxGuardTexts',
	'maxLedgerRows',
	'maxMaterializedBytes',
	'maxOutputStringCharacters',
	'maxRawArrayEntries',
	'maxRawJsonDepth',
	'maxStderrBytes',
	'maxStdoutBytes'
] as const;

const COVERAGE_KEYS = [
	'arrowOccurrences',
	'classifiedGuardTexts',
	'distinctGuardTexts',
	'enforcedAnchorBroken',
	'enforcedWithoutSite',
	'ledgerRows',
	'reconciles',
	'staleLedgerRows',
	'unclassifiedGuardTexts'
] as const;

const SCALAR_DATA_KEYS = new Set([
	...BUDGET_KEYS,
	'adapterId',
	'adapterVersion',
	'analyzerArtifacts',
	'analyzerPath',
	'arrowCount',
	'authorityTestArtifacts',
	'authorityTransfer',
	'baselineChange',
	'bunVersion',
	'bytes',
	'canonicalPathKey',
	'canonicalProfile',
	'classifiedGuardTexts',
	'code',
	'contentDigest',
	'count',
	'dataPath',
	'disposition',
	'distinctGuardTexts',
	'enforcementSiteArtifacts',
	'enforcingAnchor',
	'enforcingSite',
	'evidence',
	'evidenceContentDigest',
	'executableBytes',
	'executableSha256',
	'files',
	'from',
	'gateEffect',
	'guard',
	'guardId',
	'guardText',
	'health',
	'id',
	'integrationStrategy',
	'ledgerDataArtifacts',
	'ledgerState',
	'machine',
	'method',
	'name',
	'operationVersion',
	'ordinal',
	'oracleChange',
	'packageSourceArtifacts',
	'path',
	'primaryClass',
	'reason',
	'reconciles',
	'replacementEquivalence',
	'retainedAnalyzerCanonicalPathKey',
	'retainedAnalyzerSha256',
	'retainedDataCanonicalPathKey',
	'retainedDataSha256',
	'retainedTestExecution',
	'runtimeEnforcement',
	'runtimeVersion',
	'schemaVersion',
	'sha256',
	'stateMachineDeclarationArtifacts',
	'subjectId',
	'textCount',
	'to',
	'totalBytes',
	'verifierAuthority',
	'version'
]);

const SCALAR_ARRAY_PATH =
	/\.(?:arrowIds|enforcedAnchorBroken|enforcedWithoutSite|guardTexts|semanticRoles|stale|unclassified|uses)$/u;

type RequiredValueKind = 'array' | 'boolean' | 'integer' | 'record' | 'text';

function requiredRecordFields(
	value: unknown,
	path: string,
	requirements: Readonly<Record<string, RequiredValueKind>>,
	options: ValidatedOptions
): Record<string, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxy(value) ||
		(Reflect.getPrototypeOf(value) !== Object.prototype && Reflect.getPrototypeOf(value) !== null)
	)
		invalid('SHAPE_INVALID', path, 'Expected a plain, non-Proxy record.');
	const result: Record<string, unknown> = {};
	const allowed = new Set(Object.keys(requirements));
	for (const [key, kind] of Object.entries(requirements)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			invalid('SHAPE_INVALID', `${path}.${key}`, 'Expected an enumerable data property.');
		const field = descriptor.value;
		if (kind === 'text' && typeof field !== 'string')
			invalid('SHAPE_INVALID', `${path}.${key}`, 'Expected text.');
		if (kind === 'boolean' && typeof field !== 'boolean')
			invalid('SHAPE_INVALID', `${path}.${key}`, 'Expected boolean.');
		if (kind === 'integer' && !Number.isSafeInteger(field))
			invalid('SHAPE_INVALID', `${path}.${key}`, 'Expected a safe integer.');
		if (kind === 'record' && (field === null || typeof field !== 'object' || Array.isArray(field)))
			invalid('SHAPE_INVALID', `${path}.${key}`, 'Expected a record.');
		if (kind === 'array') {
			if (
				!Array.isArray(field) ||
				isProxy(field) ||
				Reflect.getPrototypeOf(field) !== Array.prototype
			)
				invalid('SHAPE_INVALID', `${path}.${key}`, 'Expected a plain array.');
			const lengthDescriptor = Reflect.getOwnPropertyDescriptor(field, 'length');
			if (
				lengthDescriptor === undefined ||
				!('value' in lengthDescriptor) ||
				!Number.isSafeInteger(lengthDescriptor.value) ||
				(lengthDescriptor.value as number) < 0
			)
				invalid('SHAPE_INVALID', `${path}.${key}`, 'Array length is malformed.');
			if ((lengthDescriptor.value as number) > options.maxRecords)
				invalid(
					'BUDGET_EXHAUSTED',
					`${path}.${key}`,
					'Array population exceeds the validation budget.'
				);
		}
		result[key] = field;
	}
	let enumerableCount = 0;
	for (const key in value) {
		if (!Object.hasOwn(value, key)) continue;
		enumerableCount += 1;
		if (enumerableCount > allowed.size || !allowed.has(key))
			invalid('SHAPE_INVALID', path, 'Record field population is not exact.');
	}
	if (enumerableCount !== allowed.size)
		invalid('SHAPE_INVALID', path, 'Record field population is not exact.');
	return result;
}

function preflightObservationStructure(value: unknown, options: ValidatedOptions): void {
	const root = requiredRecordFields(
		value,
		'$',
		{
			artifactSet: 'record',
			authorityTransfer: 'text',
			baselineChange: 'text',
			budgets: 'record',
			canonicalProfile: 'text',
			contentDigest: 'text',
			coverage: 'record',
			executor: 'record',
			gateEffect: 'text',
			guardedArrows: 'array',
			guards: 'array',
			health: 'text',
			id: 'text',
			integrationStrategy: 'text',
			limitations: 'array',
			method: 'text',
			operationVersion: 'text',
			oracleChange: 'text',
			rawEvidence: 'record',
			rawOutput: 'record',
			replacementEquivalence: 'text',
			retainedTestExecution: 'text',
			runtimeEnforcement: 'text',
			schemaVersion: 'text',
			subjectId: 'text',
			verifierAuthority: 'text'
		},
		options
	);
	const artifactSet = requiredRecordFields(
		root.artifactSet,
		'$.artifactSet',
		{
			artifacts: 'array',
			canonicalProfile: 'text',
			contentDigest: 'text',
			coverage: 'record',
			id: 'text',
			method: 'text',
			operationVersion: 'text',
			schemaVersion: 'text',
			subjectId: 'text'
		},
		options
	);
	void artifactSet;
	requiredRecordFields(
		root.rawEvidence,
		'$.rawEvidence',
		{
			analyzerPath: 'text',
			audit: 'record',
			dataPath: 'text',
			guardTexts: 'array',
			guardedArrows: 'array',
			ledgerRows: 'array',
			runtime: 'record',
			schemaVersion: 'text'
		},
		options
	);
	requiredRecordFields(
		(root.rawEvidence as Record<string, unknown>).audit,
		'$.rawEvidence.audit',
		{
			arrowCount: 'integer',
			counts: 'array',
			enforcedAnchorBroken: 'array',
			enforcedWithoutSite: 'array',
			stale: 'array',
			textCount: 'integer',
			unclassified: 'array'
		},
		options
	);
	requiredRecordFields(
		root.executor,
		'$.executor',
		{
			adapterId: 'text',
			adapterVersion: 'text',
			executableBytes: 'integer',
			executableSha256: 'text',
			externalModules: 'array',
			retainedAnalyzerCanonicalPathKey: 'text',
			retainedAnalyzerSha256: 'text',
			retainedDataCanonicalPathKey: 'text',
			retainedDataSha256: 'text',
			runtime: 'text',
			runtimeVersion: 'text',
			worker: 'record'
		},
		options
	);
}

function exactKeys(value: unknown, path: string, expected: readonly string[]): void {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		invalid('SHAPE_INVALID', path, 'Expected an exact plain record.');
	const keys = Reflect.ownKeys(value);
	if (
		keys.length !== expected.length ||
		keys.some((key) => typeof key !== 'string' || !expected.includes(key))
	)
		invalid('SHAPE_INVALID', path, 'Record field population is not exact.');
}

function positiveInteger(value: unknown, path: string): void {
	if (!Number.isSafeInteger(value) || (value as number) < 1)
		invalid('INVALID_VALUE', path, 'Expected a positive safe integer.');
}

function nonnegativeInteger(value: unknown, path: string): void {
	if (!Number.isSafeInteger(value) || (value as number) < 0)
		invalid('INVALID_VALUE', path, 'Expected a nonnegative safe integer.');
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function independentlyValidateSurface(observation: GuardEnforcementLedgerObservation): void {
	exactKeys(observation, '$', OBSERVATION_KEYS);
	for (const [path, actual, expected] of [
		[
			'$.authorityTransfer',
			observation.authorityTransfer,
			GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER
		],
		['$.baselineChange', observation.baselineChange, GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE],
		[
			'$.canonicalProfile',
			observation.canonicalProfile,
			GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE
		],
		['$.gateEffect', observation.gateEffect, GUARD_ENFORCEMENT_LEDGER_GATE_EFFECT],
		['$.health', observation.health, 'PARTIAL'],
		[
			'$.integrationStrategy',
			observation.integrationStrategy,
			GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY
		],
		['$.method', observation.method, GUARD_ENFORCEMENT_LEDGER_METHOD],
		[
			'$.operationVersion',
			observation.operationVersion,
			GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION
		],
		['$.oracleChange', observation.oracleChange, GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE],
		[
			'$.replacementEquivalence',
			observation.replacementEquivalence,
			GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE
		],
		[
			'$.retainedTestExecution',
			observation.retainedTestExecution,
			GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION
		],
		[
			'$.runtimeEnforcement',
			observation.runtimeEnforcement,
			GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT
		],
		['$.schemaVersion', observation.schemaVersion, GUARD_ENFORCEMENT_LEDGER_SCHEMA_VERSION],
		[
			'$.verifierAuthority',
			observation.verifierAuthority,
			GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY
		]
	] as const)
		if (actual !== expected) invalid('INVALID_VALUE', path, 'Observation constant is unsupported.');
	if (typeof observation.subjectId !== 'string' || observation.subjectId.length === 0)
		invalid('INVALID_VALUE', '$.subjectId', 'subjectId must be nonempty text.');
	if (typeof observation.id !== 'string' || observation.id.length === 0)
		invalid('INVALID_VALUE', '$.id', 'Observation identity must be nonempty text.');
	if (
		typeof observation.contentDigest !== 'string' ||
		!/^[0-9a-f]{64}$/u.test(observation.contentDigest)
	)
		invalid('INVALID_VALUE', '$.contentDigest', 'Content digest must be lowercase SHA-256.');
	if (
		canonicalSemanticJson(observation.limitations) !==
		canonicalSemanticJson(GUARD_ENFORCEMENT_LEDGER_LIMITATIONS)
	)
		invalid('POPULATION_MISMATCH', '$.limitations', 'Limitation population is not canonical.');

	exactKeys(observation.budgets, '$.budgets', BUDGET_KEYS);
	for (const key of BUDGET_KEYS) positiveInteger(observation.budgets[key], `$.budgets.${key}`);
	if (observation.budgets.maxExecutorDurationMs > GUARD_ENFORCEMENT_LEDGER_MAX_EXECUTOR_DURATION_MS)
		invalid(
			'INVALID_VALUE',
			'$.budgets.maxExecutorDurationMs',
			'Executor duration exceeds the runtime timer representation limit.'
		);
	exactKeys(observation.coverage, '$.coverage', COVERAGE_KEYS);
	for (const key of COVERAGE_KEYS.filter((key) => key !== 'reconciles'))
		nonnegativeInteger(observation.coverage[key], `$.coverage.${key}`);
	if (observation.coverage.reconciles !== true)
		invalid('POPULATION_MISMATCH', '$.coverage.reconciles', 'Coverage must reconcile.');

	const { rawEvidence } = observation;
	if (!Array.isArray(rawEvidence.guardedArrows) || rawEvidence.guardedArrows.length === 0)
		invalid(
			'POPULATION_MISMATCH',
			'$.rawEvidence.guardedArrows',
			'Guarded-arrow population must be nonempty.'
		);
	if (!Array.isArray(rawEvidence.guardTexts) || rawEvidence.guardTexts.length === 0)
		invalid(
			'POPULATION_MISMATCH',
			'$.rawEvidence.guardTexts',
			'Guard-text population must be nonempty.'
		);
	if (!Array.isArray(rawEvidence.ledgerRows) || rawEvidence.ledgerRows.length === 0)
		invalid(
			'POPULATION_MISMATCH',
			'$.rawEvidence.ledgerRows',
			'Ledger-row population must be nonempty.'
		);
	const arrowGuardTexts = [...new Set(rawEvidence.guardedArrows.map((arrow) => arrow.guard))].sort(
		compareText
	);
	if (!sameStrings(rawEvidence.guardTexts, arrowGuardTexts))
		invalid(
			'POPULATION_MISMATCH',
			'$.rawEvidence.guardTexts',
			'Guard texts must exactly equal the unique guarded-arrow text population.'
		);
	for (const [index, row] of rawEvidence.ledgerRows.entries())
		if (typeof row.evidence !== 'string' || row.evidence.length === 0)
			invalid(
				'INVALID_VALUE',
				`$.rawEvidence.ledgerRows[${index}].evidence`,
				'Ledger evidence must be nonempty.'
			);
	if (rawEvidence.audit.arrowCount !== rawEvidence.guardedArrows.length)
		invalid(
			'POPULATION_MISMATCH',
			'$.rawEvidence.audit.arrowCount',
			'Audit arrow count does not reconcile.'
		);
	if (rawEvidence.audit.textCount !== rawEvidence.guardTexts.length)
		invalid(
			'POPULATION_MISMATCH',
			'$.rawEvidence.audit.textCount',
			'Audit text count does not reconcile.'
		);
	const auditFindingCount =
		rawEvidence.audit.enforcedAnchorBroken.length +
		rawEvidence.audit.enforcedWithoutSite.length +
		rawEvidence.audit.stale.length +
		rawEvidence.audit.unclassified.length;
	if (rawEvidence.guardedArrows.length > observation.budgets.maxGuardedArrows)
		invalid(
			'BUDGET_EXHAUSTED',
			'$.budgets.maxGuardedArrows',
			'Guarded arrows exceed the recorded budget.'
		);
	if (rawEvidence.guardTexts.length > observation.budgets.maxGuardTexts)
		invalid(
			'BUDGET_EXHAUSTED',
			'$.budgets.maxGuardTexts',
			'Guard texts exceed the recorded budget.'
		);
	if (rawEvidence.ledgerRows.length > observation.budgets.maxLedgerRows)
		invalid(
			'BUDGET_EXHAUSTED',
			'$.budgets.maxLedgerRows',
			'Ledger rows exceed the recorded budget.'
		);
	if (auditFindingCount > observation.budgets.maxAuditEntries)
		invalid(
			'BUDGET_EXHAUSTED',
			'$.budgets.maxAuditEntries',
			'Audit findings exceed the recorded budget.'
		);
	if (observation.artifactSet.artifacts.length > observation.budgets.maxArtifacts)
		invalid('BUDGET_EXHAUSTED', '$.budgets.maxArtifacts', 'Artifacts exceed the recorded budget.');
	if (observation.rawOutput.bytes > observation.budgets.maxStdoutBytes)
		invalid(
			'BUDGET_EXHAUSTED',
			'$.budgets.maxStdoutBytes',
			'Raw output exceeds the recorded budget.'
		);
	if (observation.guardedArrows.length !== rawEvidence.guardedArrows.length)
		invalid(
			'POPULATION_MISMATCH',
			'$.guardedArrows',
			'Projected arrows do not reconcile with raw evidence.'
		);
	const expectedGuards = new Set([
		...rawEvidence.guardTexts,
		...rawEvidence.ledgerRows.map((row) => row.guardText)
	]);
	if (observation.guards.length !== expectedGuards.size)
		invalid(
			'POPULATION_MISMATCH',
			'$.guards',
			'Projected guard records do not reconcile with raw evidence.'
		);
	for (const [index, arrow] of observation.guardedArrows.entries())
		if (arrow.ordinal !== index)
			invalid(
				'POPULATION_MISMATCH',
				`$.guardedArrows[${index}].ordinal`,
				'Arrow ordinals must be contiguous.'
			);
	const expectedCoverage = {
		arrowOccurrences: rawEvidence.guardedArrows.length,
		classifiedGuardTexts: rawEvidence.guardTexts.length - rawEvidence.audit.unclassified.length,
		distinctGuardTexts: rawEvidence.guardTexts.length,
		enforcedAnchorBroken: rawEvidence.audit.enforcedAnchorBroken.length,
		enforcedWithoutSite: rawEvidence.audit.enforcedWithoutSite.length,
		ledgerRows: rawEvidence.ledgerRows.length,
		reconciles: true,
		staleLedgerRows: rawEvidence.audit.stale.length,
		unclassifiedGuardTexts: rawEvidence.audit.unclassified.length
	};
	if (canonicalSemanticJson(observation.coverage) !== canonicalSemanticJson(expectedCoverage))
		invalid('POPULATION_MISMATCH', '$.coverage', 'Coverage does not reproduce raw evidence.');
}

function validateOptions(
	options: GuardEnforcementLedgerValidationOptions | undefined
): ValidatedOptions {
	const defaults = {
		maxIssues: Number.MAX_SAFE_INTEGER,
		maxRecords: Number.MAX_SAFE_INTEGER,
		maxStringCharacters: Number.MAX_SAFE_INTEGER
	};
	if (options === undefined) return defaults;
	try {
		if (
			options === null ||
			typeof options !== 'object' ||
			Array.isArray(options) ||
			isProxy(options) ||
			Reflect.getPrototypeOf(options) !== Object.prototype ||
			Reflect.ownKeys(options).some(
				(key) =>
					typeof key !== 'string' ||
					!['maxIssues', 'maxRecords', 'maxStringCharacters'].includes(key)
			)
		)
			invalid('SHAPE_INVALID', '$options', 'Validation options must be an exact plain record.');
		const result = { ...defaults };
		for (const key of ['maxIssues', 'maxRecords', 'maxStringCharacters'] as const) {
			const descriptor = Reflect.getOwnPropertyDescriptor(options, key);
			if (descriptor === undefined) continue;
			if (
				!descriptor.enumerable ||
				!('value' in descriptor) ||
				!Number.isSafeInteger(descriptor.value) ||
				(descriptor.value as number) < 1
			)
				invalid('INVALID_VALUE', `$options.${key}`, `${key} must be a positive safe integer.`);
			result[key] = descriptor.value as number;
		}
		return result;
	} catch (error) {
		if (error instanceof InvalidObservation) throw error;
		invalid('SHAPE_INVALID', '$options', 'Validation options are hostile or malformed.');
	}
}

function assertPlainTree(value: unknown, options: ValidatedOptions): string {
	const stack: { readonly path: string; readonly value: unknown }[] = [{ path: '$', value }];
	const seen = new Set<object>();
	let records = 0;
	let stringCharacters = 0;
	while (stack.length > 0) {
		const { path: currentPath, value: current } = stack.pop()!;
		if (typeof current === 'string') {
			stringCharacters += current.length;
			if (stringCharacters > options.maxStringCharacters)
				invalid(
					'BUDGET_EXHAUSTED',
					'$',
					'Observation string population exceeds the validation budget.'
				);
			continue;
		}
		if (current === null || typeof current !== 'object') continue;
		if (seen.has(current)) invalid('SHAPE_INVALID', '$', 'Observation contains a cycle.');
		seen.add(current);
		records += 1;
		if (records > options.maxRecords)
			invalid(
				'BUDGET_EXHAUSTED',
				'$',
				'Observation container population exceeds the validation budget.'
			);
		if (isProxy(current)) invalid('SHAPE_INVALID', '$', 'Observation contains a Proxy value.');
		const array = Array.isArray(current);
		const prototype = Reflect.getPrototypeOf(current);
		if (
			(array && prototype !== Array.prototype) ||
			(!array && prototype !== Object.prototype && prototype !== null)
		)
			invalid('SHAPE_INVALID', '$', 'Observation containers must be plain JSON containers.');
		let arrayLength: number | null = null;
		if (array) {
			const lengthDescriptor = Reflect.getOwnPropertyDescriptor(current, 'length');
			if (
				lengthDescriptor === undefined ||
				!('value' in lengthDescriptor) ||
				!Number.isSafeInteger(lengthDescriptor.value) ||
				(lengthDescriptor.value as number) < 0
			)
				invalid('SHAPE_INVALID', '$', 'Observation array length is malformed.');
			arrayLength = lengthDescriptor.value as number;
			if (arrayLength > options.maxRecords - records)
				invalid(
					'BUDGET_EXHAUSTED',
					'$',
					'Observation array population exceeds the validation budget.'
				);
			records += arrayLength;
		}
		const keys = Reflect.ownKeys(current);
		if (
			array &&
			(keys.length !== (arrayLength as number) + 1 ||
				keys.some(
					(key) =>
						typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))
				))
		)
			invalid('SHAPE_INVALID', '$', 'Observation arrays must be dense and have no expando fields.');
		for (const key of keys) {
			if (key === 'length') continue;
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				invalid('SHAPE_INVALID', '$', 'Observation must contain enumerable data properties only.');
			const childPath = array ? `${currentPath}[${String(key)}]` : `${currentPath}.${String(key)}`;
			if (
				descriptor.value !== null &&
				(typeof descriptor.value === 'object' || typeof descriptor.value === 'function') &&
				((!array &&
					(SCALAR_DATA_KEYS.has(String(key)) ||
						(currentPath === '$.coverage' && COVERAGE_KEYS.includes(String(key) as never)))) ||
					(array && SCALAR_ARRAY_PATH.test(currentPath)))
			)
				invalid('SHAPE_INVALID', childPath, 'Expected a scalar data value.');
			stack.push({ path: childPath, value: descriptor.value });
		}
	}
	try {
		return canonicalSemanticJson(value);
	} catch {
		return invalid('SHAPE_INVALID', '$', 'Observation is not a canonicalizable semantic value.');
	}
}

function validateInternal(
	value: unknown,
	subject: FrozenSubject | undefined,
	options: ValidatedOptions
): void {
	preflightObservationStructure(value, options);
	const actualCanonical = assertPlainTree(value, options);
	const observation = value as GuardEnforcementLedgerObservation;
	independentlyValidateSurface(observation);
	const artifactValidation = validateGuardEnforcementLedgerArtifactSet(
		observation.artifactSet,
		subject,
		{ maxIssues: 1 }
	);
	if (artifactValidation.state !== 'VALID')
		invalid(
			artifactValidation.issues[0]?.code === 'CONTENT_DIGEST_MISMATCH'
				? 'CONTENT_DIGEST_MISMATCH'
				: subject === undefined
					? 'ARTIFACT_SET_INVALID'
					: 'SUBJECT_MISMATCH',
			'$.artifactSet',
			artifactValidation.issues[0]?.message ?? 'Artifact-set validation failed.'
		);
	let rebuilt: GuardEnforcementLedgerObservation;
	try {
		rebuilt = normalizeGuardEnforcementLedgerObservation({
			artifactSet: observation.artifactSet,
			evidence: observation.rawEvidence,
			executor: observation.executor,
			rawOutputIdentity: observation.rawOutput,
			request: {
				artifactSetId: observation.artifactSet.id,
				budgets: observation.budgets,
				operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
				schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
				subjectId: observation.subjectId
			}
		});
	} catch (error) {
		if (error instanceof GuardEnforcementLedgerNormalizationError)
			invalid('POPULATION_MISMATCH', error.path, error.message);
		invalid('SHAPE_INVALID', '$', 'Observation reconstruction failed closed.');
	}
	const rebuiltCanonical = canonicalSemanticJson(rebuilt);
	if (actualCanonical !== rebuiltCanonical) {
		if (observation.id !== rebuilt.id)
			invalid('IDENTITY_MISMATCH', '$.id', 'Observation identity does not reproduce.');
		if (observation.contentDigest !== rebuilt.contentDigest)
			invalid('CONTENT_DIGEST_MISMATCH', '$.contentDigest', 'Content digest does not reproduce.');
		invalid(
			'POPULATION_MISMATCH',
			'$',
			'Observation differs from its canonical evidence projection.'
		);
	}
}

/**
 * Structural and optional FrozenSubject-bound validation. It deliberately does
 * not rerun retained code or independently recapture the external executor.
 * Callers admitting untrusted serialized data must enforce a byte ceiling
 * before materialization: exact plain-record validation necessarily enumerates
 * an already-materialized object's own-key table.
 */
export function validateGuardEnforcementLedgerObservation(
	observation: unknown,
	subject?: FrozenSubject,
	options?: GuardEnforcementLedgerValidationOptions
): GuardEnforcementLedgerValidationResult {
	let maximum = 1;
	try {
		const validatedOptions = validateOptions(options);
		maximum = validatedOptions.maxIssues;
		validateInternal(observation, subject, validatedOptions);
		return { issues: [], state: 'VALID' };
	} catch (error) {
		const issue: GuardEnforcementLedgerValidationIssue =
			error instanceof InvalidObservation
				? error.issue
				: {
						code: 'SHAPE_INVALID',
						message: 'Observation validation failed closed on a hostile value.',
						path: '$'
					};
		return {
			issues: [issue].slice(0, maximum),
			state: issue.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};
	}
}
