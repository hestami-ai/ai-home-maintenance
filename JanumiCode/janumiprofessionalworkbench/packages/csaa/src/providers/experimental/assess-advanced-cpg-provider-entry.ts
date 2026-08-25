import { canonicalJson, sha256 } from '../../inventory/canonical.js';
import { isUnicodeScalarString } from '../../semantic/canonical.js';

export const ADVANCED_CPG_PROVIDER_ENTRY_REQUEST_SCHEMA_VERSION =
	'jan-csaa-advanced-cpg-provider-entry-request/0.1.0' as const;
export const ADVANCED_CPG_PROVIDER_DISPOSITION_SCHEMA_VERSION =
	'jan-csaa-advanced-cpg-provider-disposition/0.1.0' as const;
export const ADVANCED_CPG_PROVIDER_ENTRY_OPERATION_VERSION =
	'jan-csaa-assess-advanced-cpg-provider-entry/0.1.0' as const;

export const ADVANCED_CPG_PROVIDER_DISCOVERY_COMMANDS = Object.freeze({
	CODEQL:
		'Get-Command -Name codeql -CommandType Application,ExternalScript -ErrorAction SilentlyContinue',
	JOERN:
		'Get-Command -Name joern -CommandType Application,ExternalScript -ErrorAction SilentlyContinue'
} as const);

export const ADVANCED_CPG_PROVIDER_NONCLAIMS = Object.freeze([
	'CODEQL_OR_JOERN_INSTALLATION_AUTHORITY',
	'EXTERNAL_PROVIDER_LICENSE_APPROVAL',
	'NATIVE_CSAA_DEPENDENCY_ON_EXPERIMENTAL_PROVIDER',
	'NETWORK_OR_UPLOAD_AUTHORITY',
	'PROVIDER_AVAILABILITY_OUTSIDE_RECORDED_ENVIRONMENT',
	'PROVIDER_QUALIFICATION_WHEN_DISPOSITION_IS_NOT_ADOPT_BOUNDED_ADAPTER',
	'SYSTEM_CONFIGURATION_AUTHORITY'
] as const);

export type AdvancedCpgProvider = 'CODEQL' | 'JOERN';
export type AdvancedCpgProviderDisposition =
	'ADOPT_BOUNDED_ADAPTER' | 'DEFER' | 'REJECT_FOR_CURRENT_NEED';

export interface AdvancedCpgProviderEntryBudgets {
	readonly maxFactCount: number;
	readonly maxInputBytes: number;
	readonly maxOutputBytes: number;
	readonly maxStringCharacters: number;
}

export interface AdvancedCpgProviderCommandCheck {
	readonly availability: 'AVAILABLE' | 'UNAVAILABLE';
	readonly commandName: 'codeql' | 'joern';
	readonly exactCommand: string;
	readonly provider: AdvancedCpgProvider;
	readonly resolutionKind: 'APPLICATION' | 'EXTERNAL_SCRIPT' | null;
	readonly resolvedExecutablePath: string | null;
}

export interface AdvancedCpgProviderQualificationEvidence {
	readonly comparison: {
		readonly corroboratedFactCount: number;
		readonly falseNegativeCount: number;
		readonly falsePositiveCount: number;
		readonly handCheckedNegativeExpectedCount: number;
		readonly handCheckedNegativeReportedCount: number;
		readonly handCheckedPositiveDetectedCount: number;
		readonly handCheckedPositiveExpectedCount: number;
		readonly incrementalBehavior: 'MATCHES_CLEAN' | 'DIFFERS_FROM_CLEAN' | 'NOT_MEASURED';
		readonly nativeFactCount: number;
		readonly operationsFit: 'BOUNDED_LOCAL' | 'UNACCEPTABLE' | 'UNKNOWN';
		readonly provenance: 'EXACT_SOURCE_LOCATION_AND_QUERY_ID' | 'LOSSY' | 'UNKNOWN';
		readonly providerFactCount: number;
		readonly providerUniqueTruePositiveCount: number;
		readonly reproducibility: 'IDENTICAL_BOUNDED_RERUN' | 'DRIFT' | 'NOT_MEASURED';
		readonly unknownCount: number;
	};
	readonly provider: AdvancedCpgProvider;
	readonly providerVersion: string;
	readonly query: {
		readonly language: string;
		readonly queryId: string;
		readonly querySha256: string;
		readonly queryText: string;
	};
	readonly result: {
		readonly durationMilliseconds: number;
		readonly exitCode: number;
		readonly resultSha256: string;
		readonly state: 'COMPLETED' | 'FAILED';
	};
	readonly setup: {
		readonly installationPerformed: boolean;
		readonly networkUsed: boolean;
		readonly setupDescription: string;
		readonly systemConfigurationChanged: boolean;
		readonly uploadPerformed: boolean;
	};
	readonly subject: {
		readonly artifactCount: number;
		readonly root: 'packages/rph-domain';
		readonly subjectId: string;
		readonly subjectSha256: string;
	};
	readonly translation: {
		readonly notes: string;
		readonly state: 'HAND_CHECKED' | 'UNREVIEWED';
		readonly translationSha256: string;
	};
}

export interface AdvancedCpgProviderEntryRequest {
	readonly budgets: AdvancedCpgProviderEntryBudgets;
	readonly checkedAt: string;
	readonly commandChecks: readonly [
		AdvancedCpgProviderCommandCheck,
		AdvancedCpgProviderCommandCheck
	];
	readonly environment: {
		readonly environmentId: string;
		readonly platform: 'win32';
	};
	readonly nativeNeed: {
		readonly capabilityId: string;
		readonly rationale: string;
		readonly state:
			'HIGH_VALUE_NATIVE_GAP' | 'INDEPENDENT_CORROBORATION_NEEDED' | 'NO_CURRENT_NEED' | 'UNKNOWN';
	};
	readonly operationVersion: typeof ADVANCED_CPG_PROVIDER_ENTRY_OPERATION_VERSION;
	readonly providerPreference: readonly [AdvancedCpgProvider, AdvancedCpgProvider];
	readonly qualification: AdvancedCpgProviderQualificationEvidence | null;
	readonly schemaVersion: typeof ADVANCED_CPG_PROVIDER_ENTRY_REQUEST_SCHEMA_VERSION;
}

export type AdvancedCpgProviderDispositionReason =
	| 'FALSE_RESULT_OBSERVED'
	| 'FORBIDDEN_OPERATION_OBSERVED'
	| 'HAND_CHECK_FAILED'
	| 'INCREMENTAL_EQUIVALENCE_UNPROVEN'
	| 'NO_DISCRIMINATING_ADVANTAGE'
	| 'NO_PROVEN_ENTRY_NEED'
	| 'NO_PROVIDER_AVAILABLE'
	| 'PROVENANCE_INSUFFICIENT'
	| 'QUALIFICATION_NOT_PERFORMED'
	| 'QUALIFICATION_PASSED'
	| 'QUALIFICATION_RUN_FAILED'
	| 'REPRODUCIBILITY_INSUFFICIENT';

export interface AdvancedCpgProviderDispositionResult {
	readonly analysisAuthority: 'NONE';
	readonly checkedAt: string;
	readonly commandChecks: readonly AdvancedCpgProviderCommandCheck[];
	readonly contentDigest: string;
	readonly disposition: AdvancedCpgProviderDisposition;
	readonly entryPredicate: {
		readonly needState: AdvancedCpgProviderEntryRequest['nativeNeed']['state'];
		readonly providerAvailability: 'AVAILABLE' | 'UNAVAILABLE';
		readonly qualificationState: 'NOT_PERFORMED' | 'PASSED' | 'FAILED';
		readonly state: 'PASSED' | 'DEFERRED' | 'FAILED';
	};
	readonly environment: AdvancedCpgProviderEntryRequest['environment'];
	readonly gateEffect: 'NONE';
	readonly nativeCsaaDependency: 'INDEPENDENT';
	readonly nonclaims: typeof ADVANCED_CPG_PROVIDER_NONCLAIMS;
	readonly qualification: AdvancedCpgProviderQualificationEvidence | null;
	readonly reasons: readonly AdvancedCpgProviderDispositionReason[];
	readonly schemaVersion: typeof ADVANCED_CPG_PROVIDER_DISPOSITION_SCHEMA_VERSION;
	readonly selectedProvider: AdvancedCpgProvider | null;
	readonly wireShape: 'CLOSED_EXACT';
}

const ABSOLUTE_MAX_INPUT_BYTES = 1_000_000;
const ABSOLUTE_MAX_OUTPUT_BYTES = 1_000_000;
const ABSOLUTE_MAX_STRING_CHARACTERS = 100_000;
const ABSOLUTE_MAX_FACT_COUNT = 10_000_000;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/u;
const REQUEST_KEYS = [
	'budgets',
	'checkedAt',
	'commandChecks',
	'environment',
	'nativeNeed',
	'operationVersion',
	'providerPreference',
	'qualification',
	'schemaVersion'
] as const;
const BUDGET_KEYS = [
	'maxFactCount',
	'maxInputBytes',
	'maxOutputBytes',
	'maxStringCharacters'
] as const;
const COMMAND_CHECK_KEYS = [
	'availability',
	'commandName',
	'exactCommand',
	'provider',
	'resolutionKind',
	'resolvedExecutablePath'
] as const;
const ENVIRONMENT_KEYS = ['environmentId', 'platform'] as const;
const NATIVE_NEED_KEYS = ['capabilityId', 'rationale', 'state'] as const;
const QUALIFICATION_KEYS = [
	'comparison',
	'provider',
	'providerVersion',
	'query',
	'result',
	'setup',
	'subject',
	'translation'
] as const;
const COMPARISON_KEYS = [
	'corroboratedFactCount',
	'falseNegativeCount',
	'falsePositiveCount',
	'handCheckedNegativeExpectedCount',
	'handCheckedNegativeReportedCount',
	'handCheckedPositiveDetectedCount',
	'handCheckedPositiveExpectedCount',
	'incrementalBehavior',
	'nativeFactCount',
	'operationsFit',
	'provenance',
	'providerFactCount',
	'providerUniqueTruePositiveCount',
	'reproducibility',
	'unknownCount'
] as const;
const QUERY_KEYS = ['language', 'queryId', 'querySha256', 'queryText'] as const;
const RESULT_KEYS = ['durationMilliseconds', 'exitCode', 'resultSha256', 'state'] as const;
const SETUP_KEYS = [
	'installationPerformed',
	'networkUsed',
	'setupDescription',
	'systemConfigurationChanged',
	'uploadPerformed'
] as const;
const SUBJECT_KEYS = ['artifactCount', 'root', 'subjectId', 'subjectSha256'] as const;
const TRANSLATION_KEYS = ['notes', 'state', 'translationSha256'] as const;

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
	if (value === null || typeof value !== 'object' || seen.has(value)) return value;
	seen.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function assertPlainWireValue(value: unknown, seen = new WeakSet<object>(), depth = 0): void {
	if (value === null || typeof value !== 'object') {
		if (
			typeof value === 'undefined' ||
			typeof value === 'bigint' ||
			typeof value === 'function' ||
			typeof value === 'symbol' ||
			(typeof value === 'number' && !Number.isFinite(value))
		)
			throw new TypeError('Advanced CPG provider entry request is not closed JSON data.');
		return;
	}
	if (depth > 32 || seen.has(value))
		throw new TypeError('Advanced CPG provider entry request exceeds wire-shape limits.');
	seen.add(value);
	const prototype = Object.getPrototypeOf(value);
	if (Array.isArray(value)) {
		if (prototype !== Array.prototype)
			throw new TypeError('Advanced CPG provider entry request contains a non-plain array.');
		const keys = Reflect.ownKeys(value);
		if (
			keys.some(
				(key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key))
			)
		)
			throw new TypeError('Advanced CPG provider entry request contains array properties.');
		for (let index = 0; index < value.length; index += 1) {
			if (!Object.prototype.hasOwnProperty.call(value, index))
				throw new TypeError('Advanced CPG provider entry request contains a sparse array.');
			assertPlainWireValue(value[index], seen, depth + 1);
		}
		seen.delete(value);
		return;
	}
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError('Advanced CPG provider entry request contains a non-plain object.');
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string')
			throw new TypeError('Advanced CPG provider entry request contains a symbol key.');
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor) ||
			typeof descriptor.get === 'function' ||
			typeof descriptor.set === 'function'
		)
			throw new TypeError('Advanced CPG provider entry request contains an accessor.');
		assertPlainWireValue(descriptor.value, seen, depth + 1);
	}
	seen.delete(value);
}

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const ownKeys = Reflect.ownKeys(value);
	return (
		ownKeys.length === keys.length &&
		ownKeys.every(
			(key) =>
				typeof key === 'string' &&
				keys.includes(key) &&
				Object.prototype.propertyIsEnumerable.call(value, key)
		)
	);
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
	if (
		typeof value !== 'string' ||
		(!allowEmpty && value.length === 0) ||
		value.length > maximum ||
		!isUnicodeScalarString(value)
	)
		return false;
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if ((code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f)
			return false;
	}
	return true;
}

function boundedInteger(value: unknown, maximum: number, minimum = 0): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value >= minimum &&
		value <= maximum &&
		!Object.is(value, -0)
	);
}

function positiveInteger(value: unknown, maximum: number): value is number {
	return boundedInteger(value, maximum, 1);
}

function isProvider(value: unknown): value is AdvancedCpgProvider {
	return value === 'CODEQL' || value === 'JOERN';
}

function parseBudgets(value: unknown): AdvancedCpgProviderEntryBudgets | null {
	if (!exactRecord(value, BUDGET_KEYS)) return null;
	if (
		!positiveInteger(value.maxFactCount, ABSOLUTE_MAX_FACT_COUNT) ||
		!positiveInteger(value.maxInputBytes, ABSOLUTE_MAX_INPUT_BYTES) ||
		!positiveInteger(value.maxOutputBytes, ABSOLUTE_MAX_OUTPUT_BYTES) ||
		!positiveInteger(value.maxStringCharacters, ABSOLUTE_MAX_STRING_CHARACTERS)
	)
		return null;
	return value as unknown as AdvancedCpgProviderEntryBudgets;
}

function parseCommandCheck(
	value: unknown,
	provider: AdvancedCpgProvider,
	maximumStringCharacters: number
): AdvancedCpgProviderCommandCheck | null {
	if (!exactRecord(value, COMMAND_CHECK_KEYS)) return null;
	const commandName = provider === 'CODEQL' ? 'codeql' : 'joern';
	if (
		value.provider !== provider ||
		value.commandName !== commandName ||
		value.exactCommand !== ADVANCED_CPG_PROVIDER_DISCOVERY_COMMANDS[provider] ||
		(value.availability !== 'AVAILABLE' && value.availability !== 'UNAVAILABLE')
	)
		return null;
	if (value.availability === 'UNAVAILABLE') {
		if (value.resolutionKind !== null || value.resolvedExecutablePath !== null) return null;
	} else if (
		(value.resolutionKind !== 'APPLICATION' && value.resolutionKind !== 'EXTERNAL_SCRIPT') ||
		!boundedString(value.resolvedExecutablePath, maximumStringCharacters)
	)
		return null;
	return value as unknown as AdvancedCpgProviderCommandCheck;
}

function parseQualification(
	value: unknown,
	budgets: AdvancedCpgProviderEntryBudgets
): AdvancedCpgProviderQualificationEvidence | null {
	if (!exactRecord(value, QUALIFICATION_KEYS)) return null;
	if (
		!exactRecord(value.comparison, COMPARISON_KEYS) ||
		!exactRecord(value.query, QUERY_KEYS) ||
		!exactRecord(value.result, RESULT_KEYS) ||
		!exactRecord(value.setup, SETUP_KEYS) ||
		!exactRecord(value.subject, SUBJECT_KEYS) ||
		!exactRecord(value.translation, TRANSLATION_KEYS) ||
		!isProvider(value.provider) ||
		!boundedString(value.providerVersion, budgets.maxStringCharacters) ||
		!boundedString(value.query.language, budgets.maxStringCharacters) ||
		!boundedString(value.query.queryId, budgets.maxStringCharacters) ||
		!boundedString(value.query.queryText, budgets.maxStringCharacters) ||
		!SHA256.test(String(value.query.querySha256)) ||
		sha256(value.query.queryText as string) !== value.query.querySha256 ||
		!boundedString(value.translation.notes, budgets.maxStringCharacters) ||
		(value.translation.state !== 'HAND_CHECKED' && value.translation.state !== 'UNREVIEWED') ||
		!SHA256.test(String(value.translation.translationSha256)) ||
		sha256(value.translation.notes as string) !== value.translation.translationSha256 ||
		value.subject.root !== 'packages/rph-domain' ||
		!boundedString(value.subject.subjectId, budgets.maxStringCharacters) ||
		!SAFE_ID.test(value.subject.subjectId as string) ||
		!positiveInteger(value.subject.artifactCount, budgets.maxFactCount) ||
		!SHA256.test(String(value.subject.subjectSha256)) ||
		(value.result.state !== 'COMPLETED' && value.result.state !== 'FAILED') ||
		!boundedInteger(value.result.exitCode, 255) ||
		!boundedInteger(value.result.durationMilliseconds, 86_400_000) ||
		!SHA256.test(String(value.result.resultSha256))
	)
		return null;
	for (const key of SETUP_KEYS) {
		if (key !== 'setupDescription' && typeof value.setup[key] !== 'boolean') return null;
	}
	if (!boundedString(value.setup.setupDescription, budgets.maxStringCharacters)) return null;
	const comparison = value.comparison;
	for (const key of [
		'corroboratedFactCount',
		'falseNegativeCount',
		'falsePositiveCount',
		'handCheckedNegativeExpectedCount',
		'handCheckedNegativeReportedCount',
		'handCheckedPositiveDetectedCount',
		'handCheckedPositiveExpectedCount',
		'nativeFactCount',
		'providerFactCount',
		'providerUniqueTruePositiveCount',
		'unknownCount'
	] as const) {
		if (!boundedInteger(comparison[key], budgets.maxFactCount)) return null;
	}
	if (
		!['MATCHES_CLEAN', 'DIFFERS_FROM_CLEAN', 'NOT_MEASURED'].includes(
			comparison.incrementalBehavior as string
		) ||
		!['BOUNDED_LOCAL', 'UNACCEPTABLE', 'UNKNOWN'].includes(comparison.operationsFit as string) ||
		!['EXACT_SOURCE_LOCATION_AND_QUERY_ID', 'LOSSY', 'UNKNOWN'].includes(
			comparison.provenance as string
		) ||
		!['IDENTICAL_BOUNDED_RERUN', 'DRIFT', 'NOT_MEASURED'].includes(
			comparison.reproducibility as string
		)
	)
		return null;
	return value as unknown as AdvancedCpgProviderQualificationEvidence;
}

function parseRequest(value: unknown): AdvancedCpgProviderEntryRequest {
	try {
		assertPlainWireValue(value);
		if (!exactRecord(value, REQUEST_KEYS)) throw new TypeError();
		const budgets = parseBudgets(value.budgets);
		if (budgets === null) throw new TypeError();
		const initialBytes = new TextEncoder().encode(canonicalJson(value)).byteLength;
		if (initialBytes > budgets.maxInputBytes) throw new RangeError('input bytes');
		if (
			value.schemaVersion !== ADVANCED_CPG_PROVIDER_ENTRY_REQUEST_SCHEMA_VERSION ||
			value.operationVersion !== ADVANCED_CPG_PROVIDER_ENTRY_OPERATION_VERSION ||
			typeof value.checkedAt !== 'string' ||
			!UTC_TIMESTAMP.test(value.checkedAt) ||
			!exactRecord(value.environment, ENVIRONMENT_KEYS) ||
			!boundedString(value.environment.environmentId, budgets.maxStringCharacters) ||
			!SAFE_ID.test(value.environment.environmentId as string) ||
			value.environment.platform !== 'win32' ||
			!exactRecord(value.nativeNeed, NATIVE_NEED_KEYS) ||
			!boundedString(value.nativeNeed.capabilityId, budgets.maxStringCharacters) ||
			!SAFE_ID.test(value.nativeNeed.capabilityId as string) ||
			!boundedString(value.nativeNeed.rationale, budgets.maxStringCharacters) ||
			![
				'HIGH_VALUE_NATIVE_GAP',
				'INDEPENDENT_CORROBORATION_NEEDED',
				'NO_CURRENT_NEED',
				'UNKNOWN'
			].includes(value.nativeNeed.state as string) ||
			!Array.isArray(value.commandChecks) ||
			value.commandChecks.length !== 2 ||
			!Array.isArray(value.providerPreference) ||
			value.providerPreference.length !== 2 ||
			!isProvider(value.providerPreference[0]) ||
			!isProvider(value.providerPreference[1]) ||
			value.providerPreference[0] === value.providerPreference[1]
		)
			throw new TypeError();
		const codeql = parseCommandCheck(value.commandChecks[0], 'CODEQL', budgets.maxStringCharacters);
		const joern = parseCommandCheck(value.commandChecks[1], 'JOERN', budgets.maxStringCharacters);
		if (codeql === null || joern === null) throw new TypeError();
		let qualification: AdvancedCpgProviderQualificationEvidence | null = null;
		if (value.qualification !== null) {
			qualification = parseQualification(value.qualification, budgets);
			if (qualification === null) throw new TypeError();
		}
		return {
			budgets,
			checkedAt: value.checkedAt,
			commandChecks: [codeql, joern],
			environment: value.environment as unknown as AdvancedCpgProviderEntryRequest['environment'],
			nativeNeed: value.nativeNeed as unknown as AdvancedCpgProviderEntryRequest['nativeNeed'],
			operationVersion: ADVANCED_CPG_PROVIDER_ENTRY_OPERATION_VERSION,
			providerPreference: value.providerPreference as unknown as readonly [
				AdvancedCpgProvider,
				AdvancedCpgProvider
			],
			qualification,
			schemaVersion: ADVANCED_CPG_PROVIDER_ENTRY_REQUEST_SCHEMA_VERSION
		};
	} catch (error) {
		if (error instanceof RangeError)
			throw new RangeError('Advanced CPG provider entry request exceeds its byte budget.');
		throw new TypeError('Advanced CPG provider entry request is invalid.');
	}
}

function qualificationFailureReasons(
	evidence: AdvancedCpgProviderQualificationEvidence
): AdvancedCpgProviderDispositionReason[] {
	const reasons: AdvancedCpgProviderDispositionReason[] = [];
	if (evidence.result.state !== 'COMPLETED' || evidence.result.exitCode !== 0)
		reasons.push('QUALIFICATION_RUN_FAILED');
	if (
		evidence.setup.installationPerformed ||
		evidence.setup.networkUsed ||
		evidence.setup.systemConfigurationChanged ||
		evidence.setup.uploadPerformed ||
		evidence.comparison.operationsFit !== 'BOUNDED_LOCAL'
	)
		reasons.push('FORBIDDEN_OPERATION_OBSERVED');
	if (
		evidence.translation.state !== 'HAND_CHECKED' ||
		evidence.comparison.handCheckedPositiveExpectedCount === 0 ||
		evidence.comparison.handCheckedNegativeExpectedCount === 0 ||
		evidence.comparison.handCheckedPositiveDetectedCount !==
			evidence.comparison.handCheckedPositiveExpectedCount ||
		evidence.comparison.handCheckedNegativeReportedCount !== 0
	)
		reasons.push('HAND_CHECK_FAILED');
	if (
		evidence.comparison.falsePositiveCount !== 0 ||
		evidence.comparison.falseNegativeCount !== 0 ||
		evidence.comparison.unknownCount !== 0
	)
		reasons.push('FALSE_RESULT_OBSERVED');
	if (evidence.comparison.providerUniqueTruePositiveCount === 0)
		reasons.push('NO_DISCRIMINATING_ADVANTAGE');
	if (evidence.comparison.provenance !== 'EXACT_SOURCE_LOCATION_AND_QUERY_ID')
		reasons.push('PROVENANCE_INSUFFICIENT');
	if (evidence.comparison.reproducibility !== 'IDENTICAL_BOUNDED_RERUN')
		reasons.push('REPRODUCIBILITY_INSUFFICIENT');
	if (evidence.comparison.incrementalBehavior !== 'MATCHES_CLEAN')
		reasons.push('INCREMENTAL_EQUIVALENCE_UNPROVEN');
	return reasons;
}

function cloneCommandCheck(
	check: AdvancedCpgProviderCommandCheck
): AdvancedCpgProviderCommandCheck {
	return { ...check };
}

function cloneQualification(
	qualification: AdvancedCpgProviderQualificationEvidence | null
): AdvancedCpgProviderQualificationEvidence | null {
	if (qualification === null) return null;
	return {
		comparison: { ...qualification.comparison },
		provider: qualification.provider,
		providerVersion: qualification.providerVersion,
		query: { ...qualification.query },
		result: { ...qualification.result },
		setup: { ...qualification.setup },
		subject: { ...qualification.subject },
		translation: { ...qualification.translation }
	};
}

function resultWithoutDigest(
	request: AdvancedCpgProviderEntryRequest,
	disposition: AdvancedCpgProviderDisposition,
	reasons: readonly AdvancedCpgProviderDispositionReason[],
	selectedProvider: AdvancedCpgProvider | null,
	qualificationState: AdvancedCpgProviderDispositionResult['entryPredicate']['qualificationState']
): Omit<AdvancedCpgProviderDispositionResult, 'contentDigest'> {
	return {
		analysisAuthority: 'NONE',
		checkedAt: request.checkedAt,
		commandChecks: request.commandChecks.map(cloneCommandCheck),
		disposition,
		entryPredicate: {
			needState: request.nativeNeed.state,
			providerAvailability: selectedProvider === null ? 'UNAVAILABLE' : 'AVAILABLE',
			qualificationState,
			state:
				disposition === 'ADOPT_BOUNDED_ADAPTER'
					? 'PASSED'
					: disposition === 'DEFER'
						? 'DEFERRED'
						: 'FAILED'
		},
		environment: { ...request.environment },
		gateEffect: 'NONE',
		nativeCsaaDependency: 'INDEPENDENT',
		nonclaims: ADVANCED_CPG_PROVIDER_NONCLAIMS,
		qualification: cloneQualification(request.qualification),
		reasons: [...reasons],
		schemaVersion: ADVANCED_CPG_PROVIDER_DISPOSITION_SCHEMA_VERSION,
		selectedProvider,
		wireShape: 'CLOSED_EXACT'
	};
}

export function assessAdvancedCpgProviderEntry(
	value: unknown
): AdvancedCpgProviderDispositionResult {
	const request = parseRequest(value);
	const selectedProvider =
		request.providerPreference.find(
			(provider) =>
				request.commandChecks.find((check) => check.provider === provider)?.availability ===
				'AVAILABLE'
		) ?? null;
	let disposition: AdvancedCpgProviderDisposition;
	let reasons: readonly AdvancedCpgProviderDispositionReason[];
	let qualificationState: AdvancedCpgProviderDispositionResult['entryPredicate']['qualificationState'];

	if (request.nativeNeed.state === 'NO_CURRENT_NEED') {
		disposition = 'REJECT_FOR_CURRENT_NEED';
		reasons = ['NO_PROVEN_ENTRY_NEED'];
		qualificationState = 'NOT_PERFORMED';
	} else if (selectedProvider === null) {
		disposition = 'DEFER';
		reasons = ['NO_PROVIDER_AVAILABLE'];
		qualificationState = 'NOT_PERFORMED';
	} else if (request.nativeNeed.state === 'UNKNOWN') {
		disposition = 'REJECT_FOR_CURRENT_NEED';
		reasons = ['NO_PROVEN_ENTRY_NEED'];
		qualificationState = 'NOT_PERFORMED';
	} else if (request.qualification === null) {
		disposition = 'DEFER';
		reasons = ['QUALIFICATION_NOT_PERFORMED'];
		qualificationState = 'NOT_PERFORMED';
	} else {
		if (request.qualification.provider !== selectedProvider)
			throw new TypeError(
				'Advanced CPG provider qualification does not match the selected available provider.'
			);
		const failures = qualificationFailureReasons(request.qualification);
		if (failures.includes('QUALIFICATION_RUN_FAILED')) {
			disposition = 'DEFER';
			reasons = failures;
			qualificationState = 'FAILED';
		} else if (failures.length > 0) {
			disposition = 'REJECT_FOR_CURRENT_NEED';
			reasons = failures;
			qualificationState = 'FAILED';
		} else {
			disposition = 'ADOPT_BOUNDED_ADAPTER';
			reasons = ['QUALIFICATION_PASSED'];
			qualificationState = 'PASSED';
		}
	}

	const withoutDigest = resultWithoutDigest(
		request,
		disposition,
		reasons,
		selectedProvider,
		qualificationState
	);
	const result: AdvancedCpgProviderDispositionResult = {
		...withoutDigest,
		contentDigest: sha256(canonicalJson(withoutDigest))
	};
	if (new TextEncoder().encode(canonicalJson(result)).byteLength > request.budgets.maxOutputBytes)
		throw new RangeError('Advanced CPG provider disposition exceeds its output byte budget.');
	return deepFreeze(result);
}

export function validateAdvancedCpgProviderDisposition(
	request: unknown,
	result: unknown
): result is AdvancedCpgProviderDispositionResult {
	try {
		assertPlainWireValue(result);
		return canonicalJson(assessAdvancedCpgProviderEntry(request)) === canonicalJson(result);
	} catch {
		return false;
	}
}
