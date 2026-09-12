import {
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import {
	HARMONIZATION_BENCHMARK_BASELINE_SCHEMA_VERSION,
	HARMONIZATION_BENCHMARK_MAP_WITNESS,
	HARMONIZATION_BENCHMARK_ROWS,
	HARMONIZATION_CAPABILITY_CODES,
	HARMONIZATION_EXPECTED_CLASSIFICATION_TOTALS,
	HARMONIZATION_FINDING_CLASSIFICATIONS,
	HARMONIZATION_FINDINGS_SOURCE_WITNESS,
	HARMONIZATION_FIRST_INCREMENT_FINDING_IDS,
	type HarmonizationBenchmarkRow,
	type HarmonizationCapabilityCode,
	type HarmonizationFindingClassification
} from './harmonization-benchmark-baseline.js';

export const HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION =
	'jan-csaa-harmonization-benchmark-accounting-request/0.1.0' as const;
export const HARMONIZATION_BENCHMARK_ACCOUNTING_RESULT_SCHEMA_VERSION =
	'jan-csaa-harmonization-benchmark-accounting-result/0.1.0' as const;
export const HARMONIZATION_BENCHMARK_ACCOUNTING_OUTCOME_SCHEMA_VERSION =
	'jan-csaa-harmonization-benchmark-accounting-outcome/0.1.0' as const;
export const HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION =
	'jan-csaa-account-harmonization-benchmark/0.1.0' as const;
export const HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY =
	'IMPLEMENTATION_LOCAL_HARMONIZATION_BENCHMARK_ACCOUNTING' as const;
export const HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const HARMONIZATION_BENCHMARK_ACCOUNTING_ANALYSIS_AUTHORITY = 'NONE' as const;
export const HARMONIZATION_BENCHMARK_ACCOUNTING_AUTHORITY_TRANSFER = 'NONE' as const;
export const HARMONIZATION_BENCHMARK_ACCOUNTING_GATE_EFFECT = 'NONE' as const;
export const HARMONIZATION_BENCHMARK_ACCOUNTING_MIN_RESULT_BYTES = 32 * 1024;

export const HARMONIZATION_BENCHMARK_STATUSES = Object.freeze([
	'DETECTED',
	'NOT_DETECTED',
	'UNSUPPORTED',
	'NOT_APPLICABLE',
	'NOT_RUN'
] as const);
export type HarmonizationBenchmarkStatus = (typeof HARMONIZATION_BENCHMARK_STATUSES)[number];

export const HARMONIZATION_BENCHMARK_ACCOUNTING_NONCLAIMS = Object.freeze([
	'DETECTOR_IMPLEMENTATION_OR_EXECUTION',
	'FIRST_INCREMENT_23_EXEMPLAR_DISCRIMINATION_OR_PASSAGE',
	'G5_DWP_005_DWP_006_OR_CAP_031_COMPLETION_OR_PASSAGE',
	'FULL_JAN_CSAA_004_006_OR_008_CONFORMANCE',
	'ANALYSIS_RULE_PROFILE_RULE_APPLICATION_RESULT_FINDING_OR_CONFORMANCE_ASSERTION',
	'REGISTERED_OPERATION_PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL',
	'CALLER_STATUS_RATIONALE_EVIDENCE_OR_PROVENANCE_TRUTH_AUTHENTICITY_OR_CORRECTNESS',
	'SUBJECT_VIOLATION_DESIGN_AUTHORITY_REMEDIATION_DISPOSITION_OR_APPROVAL',
	'GATE_ACTIVATION_GATE_PASSAGE_OR_GATE_EFFECT',
	'AUTOMATED_NORMATIVE_HUMAN_VERDICT',
	'CURRENT_WORKTREE_OR_SOURCE_RECHECK',
	'CURRENTNESS_BEYOND_CALLER_DECLARED_FROZEN_SUBJECT_AND_SOURCE_DIGEST_BINDING',
	'FINDING_PROSE_SEVERITY_VERDICT_OR_CODE_CITATION_REPRODUCTION',
	'HARMONIZATION_BASELINE_FILE_GENERATION_OR_GOVERNED_PATH_RESOLUTION',
	'PLANNING_PHASE_LABELS_AS_GOVERNED_WIRE_VOCABULARY',
	'BENCHMARK_PERCENTAGE_SCORE_OR_ATTEMPTED_SUBSET_DENOMINATOR'
] as const);

export interface HarmonizationBenchmarkAccountingBudgets {
	readonly maxEvidenceRecords: number;
	readonly maxInvalidationDependencyIds: number;
	readonly maxProvenanceRecords: number;
	readonly maxRetainedUtf8Bytes: number;
	readonly maxResultBytes: number;
	readonly maxStringCharacters: number;
}

export const HARMONIZATION_BENCHMARK_ACCOUNTING_SAFETY_CEILINGS = Object.freeze({
	maxEvidenceRecords: 2_400,
	maxInvalidationDependencyIds: 4_800,
	maxProvenanceRecords: 2_400,
	maxRetainedUtf8Bytes: 8 * 1024 * 1024,
	maxResultBytes: 16 * 1024 * 1024,
	maxStringCharacters: 4_096
} satisfies HarmonizationBenchmarkAccountingBudgets);

export const HARMONIZATION_BENCHMARK_ACCOUNTING_DEFAULT_BUDGETS = Object.freeze({
	maxEvidenceRecords: 750,
	maxInvalidationDependencyIds: 1_500,
	maxProvenanceRecords: 750,
	maxRetainedUtf8Bytes: 1024 * 1024,
	maxResultBytes: 8 * 1024 * 1024,
	maxStringCharacters: 2_048
} satisfies HarmonizationBenchmarkAccountingBudgets);

export type HarmonizationRuleImplementation = 'IMPLEMENTED' | 'UNIMPLEMENTED';
export type HarmonizationRuleMethod = 'AUTOMATED' | 'HUMAN_REVIEW' | 'NONE';
export type HarmonizationEvidenceKind =
	| 'PLANTED_POSITIVE_DETECTION'
	| 'PLANTED_POSITIVE_MISS'
	| 'NEARBY_NEGATIVE_CONTROL'
	| 'APPLICABILITY_CLOSURE'
	| 'EXECUTION';
export type HarmonizationProvenanceKind =
	'RUN' | 'INVOCATION' | 'PROVIDER' | 'ADAPTER' | 'CONFIGURATION' | 'RULE_SET';
export type HarmonizationCurrentnessState =
	'CALLER_DECLARED_CURRENT' | 'CALLER_DECLARED_STALE' | 'NOT_ASSESSED';

export interface HarmonizationRuleBinding {
	readonly implementation: HarmonizationRuleImplementation;
	readonly method: HarmonizationRuleMethod;
	readonly registration: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS;
	readonly ruleContentSha256: string | null;
	readonly ruleId: string | null;
	readonly ruleVersion: string | null;
}

export interface HarmonizationEvidenceRecord {
	readonly evidenceId: string;
	readonly kind: HarmonizationEvidenceKind;
	readonly sha256: string;
	readonly sourceReference: string;
}

export interface HarmonizationEvidenceBinding {
	readonly disposition: 'ABSENT' | 'PRESENT';
	readonly records: readonly HarmonizationEvidenceRecord[];
}

export interface HarmonizationProvenanceRecord {
	readonly kind: HarmonizationProvenanceKind;
	readonly provenanceId: string;
	readonly sha256: string;
	readonly version: string;
}

export interface HarmonizationProvenanceBinding {
	readonly disposition: 'ANALYSIS_BOUND' | 'BASELINE_ONLY';
	readonly records: readonly HarmonizationProvenanceRecord[];
}

export interface HarmonizationCurrentnessBinding {
	readonly basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED';
	readonly frozenSubjectId: string | null;
	readonly invalidationDependencyIds: readonly string[];
	readonly sourceSha256: string | null;
	readonly state: HarmonizationCurrentnessState;
}

export interface HarmonizationBenchmarkAssessment {
	readonly currentness: HarmonizationCurrentnessBinding;
	readonly evidence: HarmonizationEvidenceBinding;
	readonly findingId: number;
	readonly provenance: HarmonizationProvenanceBinding;
	readonly rule: HarmonizationRuleBinding;
	readonly status: HarmonizationBenchmarkStatus;
	readonly statusRationale: string;
	readonly unsupportedCapabilities: readonly HarmonizationCapabilityCode[];
}

export interface HarmonizationBenchmarkAccountingRequest {
	readonly assessments: readonly HarmonizationBenchmarkAssessment[];
	readonly budgets: HarmonizationBenchmarkAccountingBudgets;
	readonly executionId: string;
	readonly operationVersion: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION;
	readonly schemaVersion: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION;
}

export interface HarmonizationStatusTotals {
	readonly DETECTED: number;
	readonly NOT_APPLICABLE: number;
	readonly NOT_DETECTED: number;
	readonly NOT_RUN: number;
	readonly UNSUPPORTED: number;
}

export interface HarmonizationClassificationAccounting {
	readonly statusTotals: HarmonizationStatusTotals;
	readonly total: number;
}

export interface HarmonizationAccountedRow extends HarmonizationBenchmarkRow {
	readonly currentness: HarmonizationCurrentnessBinding;
	readonly evidence: HarmonizationEvidenceBinding;
	readonly provenance: HarmonizationProvenanceBinding;
	readonly rule: HarmonizationRuleBinding;
	readonly status: HarmonizationBenchmarkStatus;
	readonly statusRationale: string;
	readonly unsupportedCapabilities: readonly HarmonizationCapabilityCode[];
}

export interface HarmonizationBenchmarkAccountingResult {
	readonly accounting: {
		readonly allFindingIdsAccountedExactlyOnce: true;
		readonly byClassification: Readonly<
			Record<HarmonizationFindingClassification, HarmonizationClassificationAccounting>
		>;
		readonly classificationTotals: Readonly<Record<HarmonizationFindingClassification, number>>;
		readonly denominator: 75;
		readonly denominatorPolicy: 'ALL_75_FINDINGS_WITH_NO_ATTEMPTED_SUBSET';
		readonly firstIncrement: {
			readonly findingIds: typeof HARMONIZATION_FIRST_INCREMENT_FINDING_IDS;
			readonly statusTotals: HarmonizationStatusTotals;
			readonly total: 23;
		};
		readonly implementationTotals: {
			readonly automated: number;
			readonly humanReview: number;
			readonly implemented: number;
			readonly unimplemented: number;
		};
		readonly statusTotals: HarmonizationStatusTotals;
		readonly statusBasis: 'CALLER_SUPPLIED_STRUCTURALLY_VALIDATED_NOT_INDEPENDENTLY_ADJUDICATED';
		readonly statusTotalsReconcileToDenominator: true;
	};
	readonly baseline: {
		readonly mapSha256: string;
		readonly mapBytes: number;
		readonly schemaVersion: typeof HARMONIZATION_BENCHMARK_BASELINE_SCHEMA_VERSION;
		readonly source: typeof HARMONIZATION_FINDINGS_SOURCE_WITNESS;
	};
	readonly capability: {
		readonly analysisAuthority: 'NONE';
		readonly detectorExecution: 'NOT_PERFORMED_BY_ACCOUNTING_FOUNDATION';
		readonly dwp005Dwp006OrG5Completion: 'NOT_CLAIMED';
		readonly exemplarDiscrimination: 'NOT_ASSESSED';
		readonly id: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY;
		readonly phaseVocabulary: 'IMPLEMENTATION_LOCAL_GOVERNING_ALLOCATION_PROJECTION';
		readonly registeredOperation: 'NOT_CLAIMED';
		readonly gateEffect: 'NONE';
		readonly status: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS;
	};
	readonly executionId: string;
	readonly facadeNonclaims: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_NONCLAIMS;
	readonly rows: readonly HarmonizationAccountedRow[];
	readonly schemaVersion: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_RESULT_SCHEMA_VERSION;
	readonly subjectBinding:
		| {
				readonly frozenSubjectId: string;
				readonly sourceSha256: string;
				readonly state: 'CALLER_DECLARED_COMMON_FROZEN_SUBJECT';
		  }
		| {
				readonly frozenSubjectId: null;
				readonly sourceSha256: null;
				readonly state: 'NO_ANALYSIS_BOUND_ROWS';
		  };
}

export interface HarmonizationBenchmarkAccountingDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly stage: 'REQUEST' | 'ACCOUNTING' | 'RESULT';
}

interface HarmonizationOutcomeCommon {
	readonly analysisAuthority: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_ANALYSIS_AUTHORITY;
	readonly authorityTransfer: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_AUTHORITY_TRANSFER;
	readonly capabilityStatus: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS;
	readonly gateEffect: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_GATE_EFFECT;
	readonly operationVersion: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION;
	readonly schemaVersion: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_OUTCOME_SCHEMA_VERSION;
}

export interface HarmonizationBenchmarkAccountedOutcome extends HarmonizationOutcomeCommon {
	readonly diagnostics: readonly [];
	readonly outcome: 'accounted';
	readonly request: {
		readonly budgets: HarmonizationBenchmarkAccountingBudgets;
		readonly executionId: string;
		readonly schemaVersion: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION;
	};
	readonly result: HarmonizationBenchmarkAccountingResult;
	readonly state: 'accounted';
}

export interface HarmonizationBenchmarkUnavailableOutcome extends HarmonizationOutcomeCommon {
	readonly diagnostics: readonly [HarmonizationBenchmarkAccountingDiagnostic];
	readonly outcome: 'unavailable';
	readonly request: {
		readonly budgets: HarmonizationBenchmarkAccountingBudgets;
		readonly executionId: string;
		readonly schemaVersion: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION;
	} | null;
	readonly result: null;
	readonly state: 'failed' | 'incompatible' | 'resource-refused';
}

export type HarmonizationBenchmarkAccountingOutcome =
	HarmonizationBenchmarkAccountedOutcome | HarmonizationBenchmarkUnavailableOutcome;

interface InspectedRecord {
	readonly values: ReadonlyMap<string, unknown>;
}

class AccountingRefusal extends Error {
	constructor(
		readonly code: string,
		readonly stage: 'REQUEST' | 'ACCOUNTING' | 'RESULT',
		readonly failureState: 'failed' | 'incompatible' | 'resource-refused',
		message: string,
		readonly path: string | null = null
	) {
		super(message);
	}
}

const REQUEST_KEYS = ['assessments', 'budgets', 'executionId', 'operationVersion', 'schemaVersion'];
const BUDGET_KEYS = [
	'maxEvidenceRecords',
	'maxInvalidationDependencyIds',
	'maxProvenanceRecords',
	'maxRetainedUtf8Bytes',
	'maxResultBytes',
	'maxStringCharacters'
];
const ASSESSMENT_KEYS = [
	'currentness',
	'evidence',
	'findingId',
	'provenance',
	'rule',
	'status',
	'statusRationale',
	'unsupportedCapabilities'
];
const RULE_KEYS = [
	'implementation',
	'method',
	'registration',
	'ruleContentSha256',
	'ruleId',
	'ruleVersion'
];
const EVIDENCE_KEYS = ['disposition', 'records'];
const EVIDENCE_RECORD_KEYS = ['evidenceId', 'kind', 'sha256', 'sourceReference'];
const PROVENANCE_KEYS = ['disposition', 'records'];
const PROVENANCE_RECORD_KEYS = ['kind', 'provenanceId', 'sha256', 'version'];
const CURRENTNESS_KEYS = [
	'basis',
	'frozenSubjectId',
	'invalidationDependencyIds',
	'sourceSha256',
	'state'
];

function deepFreezeConstructed<Value>(value: Value): Value {
	if (value === null || typeof value !== 'object') return value;
	const seen = new WeakSet<object>();
	const stack: object[] = [value];
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (seen.has(current)) continue;
		seen.add(current);
		for (const key of Reflect.ownKeys(current)) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor === undefined || !('value' in descriptor)) continue;
			const child = descriptor.value;
			if (child !== null && typeof child === 'object') stack.push(child);
		}
		Object.freeze(current);
	}
	return value;
}

function inspectExactRecord(
	value: unknown,
	expectedKeys: readonly string[],
	path: string,
	message: string
): InspectedRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		throw new AccountingRefusal('REQUEST_SHAPE_INVALID', 'REQUEST', 'incompatible', message, path);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new AccountingRefusal('REQUEST_SHAPE_INVALID', 'REQUEST', 'incompatible', message, path);
	const ownKeys = Reflect.ownKeys(value);
	if (
		ownKeys.some((key) => typeof key !== 'string') ||
		ownKeys.length !== expectedKeys.length ||
		expectedKeys.some((key) => !ownKeys.includes(key))
	)
		throw new AccountingRefusal('REQUEST_SHAPE_INVALID', 'REQUEST', 'incompatible', message, path);
	const values = new Map<string, unknown>();
	for (const key of expectedKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new AccountingRefusal(
				'REQUEST_SHAPE_INVALID',
				'REQUEST',
				'incompatible',
				message,
				path
			);
		values.set(key, descriptor.value);
	}
	return { values };
}

function inspectDenseArray(
	value: unknown,
	maximum: number,
	path: string,
	exactLength?: number
): readonly unknown[] {
	if (!Array.isArray(value) || isProxyValue(value))
		throw new AccountingRefusal(
			'REQUEST_ARRAY_INVALID',
			'REQUEST',
			'incompatible',
			`${path} must be one dense plain-data array.`,
			path
		);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (lengthDescriptor === undefined || !('value' in lengthDescriptor))
		throw new AccountingRefusal(
			'REQUEST_ARRAY_INVALID',
			'REQUEST',
			'incompatible',
			`${path} must expose its ordinary data length.`,
			path
		);
	const lengthValue: unknown = lengthDescriptor.value;
	if (!Number.isSafeInteger(lengthValue) || (lengthValue as number) < 0)
		throw new AccountingRefusal(
			'REQUEST_ARRAY_INVALID',
			'REQUEST',
			'incompatible',
			`${path} has an invalid length.`,
			path
		);
	const length = lengthValue as number;
	if (length > maximum)
		throw new AccountingRefusal(
			'REQUEST_ARRAY_BUDGET_EXCEEDED',
			'REQUEST',
			'resource-refused',
			`${path} exceeds its bounded record ceiling.`,
			path
		);
	if (exactLength !== undefined && length !== exactLength)
		throw new AccountingRefusal(
			'REQUEST_ARRAY_CARDINALITY_INVALID',
			'REQUEST',
			'incompatible',
			`${path} must contain exactly ${exactLength} records.`,
			path
		);
	const keys = Reflect.ownKeys(value);
	if (
		keys.length !== length + 1 ||
		keys.some(
			(key) =>
				typeof key !== 'string' ||
				(key !== 'length' && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= length))
		)
	)
		throw new AccountingRefusal(
			'REQUEST_ARRAY_INVALID',
			'REQUEST',
			'incompatible',
			`${path} must be dense and must not contain symbols or expandos.`,
			path
		);
	const values: unknown[] = [];
	for (let index = 0; index < length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new AccountingRefusal(
				'REQUEST_ARRAY_INVALID',
				'REQUEST',
				'incompatible',
				`${path} must contain only enumerable data elements.`,
				`${path}[${index}]`
			);
		values.push(descriptor.value);
	}
	return values;
}

function enumValue<Value extends string>(
	value: unknown,
	allowed: readonly Value[],
	path: string
): Value {
	if (typeof value !== 'string' || !allowed.includes(value as Value))
		throw new AccountingRefusal(
			'REQUEST_ENUM_INVALID',
			'REQUEST',
			'incompatible',
			`${path} is not a supported closed-vocabulary value.`,
			path
		);
	return value as Value;
}

function boundedText(value: unknown, path: string, maximum: number): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > maximum ||
		!isUnicodeScalarString(value)
	)
		throw new AccountingRefusal(
			'REQUEST_TEXT_INVALID',
			'REQUEST',
			value !== null && typeof value === 'string' && value.length > maximum
				? 'resource-refused'
				: 'incompatible',
			`${path} must be a nonempty bounded Unicode scalar string.`,
			path
		);
	return value;
}

function sha256(value: unknown, path: string): string {
	if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value))
		throw new AccountingRefusal(
			'REQUEST_DIGEST_INVALID',
			'REQUEST',
			'incompatible',
			`${path} must be one lowercase SHA-256 digest.`,
			path
		);
	return value;
}

function positiveBudget(value: unknown, ceiling: number, path: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > ceiling)
		throw new AccountingRefusal(
			'REQUEST_BUDGET_INVALID',
			'REQUEST',
			value !== null && typeof value === 'number' && value > ceiling
				? 'resource-refused'
				: 'incompatible',
			'Every accounting budget must be a positive safe integer within its safety ceiling.',
			path
		);
	return value;
}

function materializeBudgets(value: unknown): HarmonizationBenchmarkAccountingBudgets {
	const record = inspectExactRecord(
		value,
		BUDGET_KEYS,
		'$.budgets',
		'$.budgets must be one exact plain-data accounting-budget object.'
	);
	const budgets = {
		maxEvidenceRecords: positiveBudget(
			record.values.get('maxEvidenceRecords'),
			HARMONIZATION_BENCHMARK_ACCOUNTING_SAFETY_CEILINGS.maxEvidenceRecords,
			'$.budgets.maxEvidenceRecords'
		),
		maxInvalidationDependencyIds: positiveBudget(
			record.values.get('maxInvalidationDependencyIds'),
			HARMONIZATION_BENCHMARK_ACCOUNTING_SAFETY_CEILINGS.maxInvalidationDependencyIds,
			'$.budgets.maxInvalidationDependencyIds'
		),
		maxProvenanceRecords: positiveBudget(
			record.values.get('maxProvenanceRecords'),
			HARMONIZATION_BENCHMARK_ACCOUNTING_SAFETY_CEILINGS.maxProvenanceRecords,
			'$.budgets.maxProvenanceRecords'
		),
		maxRetainedUtf8Bytes: positiveBudget(
			record.values.get('maxRetainedUtf8Bytes'),
			HARMONIZATION_BENCHMARK_ACCOUNTING_SAFETY_CEILINGS.maxRetainedUtf8Bytes,
			'$.budgets.maxRetainedUtf8Bytes'
		),
		maxResultBytes: positiveBudget(
			record.values.get('maxResultBytes'),
			HARMONIZATION_BENCHMARK_ACCOUNTING_SAFETY_CEILINGS.maxResultBytes,
			'$.budgets.maxResultBytes'
		),
		maxStringCharacters: positiveBudget(
			record.values.get('maxStringCharacters'),
			HARMONIZATION_BENCHMARK_ACCOUNTING_SAFETY_CEILINGS.maxStringCharacters,
			'$.budgets.maxStringCharacters'
		)
	};
	if (budgets.maxResultBytes < HARMONIZATION_BENCHMARK_ACCOUNTING_MIN_RESULT_BYTES)
		throw new AccountingRefusal(
			'REQUEST_RESULT_BUDGET_TOO_SMALL',
			'REQUEST',
			'resource-refused',
			'$.budgets.maxResultBytes is below the minimum terminal-outcome envelope.',
			'$.budgets.maxResultBytes'
		);
	return Object.freeze(budgets);
}

interface MaterializationLedger {
	evidenceRecords: number;
	evidenceIdentityBindings: Map<string, string>;
	invalidationDependencyIds: number;
	provenanceRecords: number;
	provenanceIdentityBindings: Map<string, string>;
	retainedUtf8Bytes: number;
	ruleIdentityBindings: Map<string, string>;
	subjectBinding: { readonly frozenSubjectId: string; readonly sourceSha256: string } | null;
}

function chargeRetainedText(
	text: string,
	path: string,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): string {
	const bytes = Buffer.byteLength(text, 'utf8');
	const dynamicMaximum = Math.min(
		budgets.maxRetainedUtf8Bytes,
		budgets.maxResultBytes - HARMONIZATION_BENCHMARK_ACCOUNTING_MIN_RESULT_BYTES
	);
	if (ledger.retainedUtf8Bytes + bytes > dynamicMaximum)
		throw new AccountingRefusal(
			'REQUEST_RETAINED_TEXT_BUDGET_EXCEEDED',
			'REQUEST',
			'resource-refused',
			'Aggregate retained UTF-8 text exceeds its caller budget or the terminal-result reserve.',
			path
		);
	ledger.retainedUtf8Bytes += bytes;
	return text;
}

function retainedText(
	value: unknown,
	path: string,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): string {
	return chargeRetainedText(
		boundedText(value, path, budgets.maxStringCharacters),
		path,
		budgets,
		ledger
	);
}

function nullableRetainedText(
	value: unknown,
	path: string,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): string | null {
	return value === null ? null : retainedText(value, path, budgets, ledger);
}

function retainedSha256(
	value: unknown,
	path: string,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): string {
	return chargeRetainedText(sha256(value, path), path, budgets, ledger);
}

function nullableRetainedSha256(
	value: unknown,
	path: string,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): string | null {
	return value === null ? null : retainedSha256(value, path, budgets, ledger);
}

function reconcileGlobalIdentity(
	bindings: Map<string, string>,
	id: string,
	record: HarmonizationEvidenceRecord | HarmonizationProvenanceRecord | HarmonizationRuleBinding,
	code: string,
	path: string
): void {
	const identity = canonicalSemanticJsonWitness(record).sha256;
	const prior = bindings.get(id);
	if (prior !== undefined && prior !== identity)
		throw new AccountingRefusal(
			code,
			'REQUEST',
			'incompatible',
			'One report cannot bind the same record identity to conflicting content.',
			path
		);
	bindings.set(id, identity);
}

function materializeRule(
	value: unknown,
	path: string,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): HarmonizationRuleBinding {
	const record = inspectExactRecord(
		value,
		RULE_KEYS,
		path,
		`${path} must be one exact plain-data rule binding.`
	);
	const registration = enumValue(
		record.values.get('registration'),
		[HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS],
		`${path}.registration`
	);
	const rule: HarmonizationRuleBinding = {
		implementation: enumValue(
			record.values.get('implementation'),
			['IMPLEMENTED', 'UNIMPLEMENTED'],
			`${path}.implementation`
		),
		method: enumValue(
			record.values.get('method'),
			['AUTOMATED', 'HUMAN_REVIEW', 'NONE'],
			`${path}.method`
		),
		registration,
		ruleContentSha256: nullableRetainedSha256(
			record.values.get('ruleContentSha256'),
			`${path}.ruleContentSha256`,
			budgets,
			ledger
		),
		ruleId: nullableRetainedText(record.values.get('ruleId'), `${path}.ruleId`, budgets, ledger),
		ruleVersion: nullableRetainedText(
			record.values.get('ruleVersion'),
			`${path}.ruleVersion`,
			budgets,
			ledger
		)
	};
	if (rule.ruleId !== null)
		reconcileGlobalIdentity(
			ledger.ruleIdentityBindings,
			rule.ruleId,
			rule,
			'REQUEST_RULE_IDENTITY_CONFLICT',
			path
		);
	return rule;
}

function materializeEvidence(
	value: unknown,
	path: string,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): HarmonizationEvidenceBinding {
	const record = inspectExactRecord(
		value,
		EVIDENCE_KEYS,
		path,
		`${path} must be one exact plain-data evidence binding.`
	);
	const disposition = enumValue(
		record.values.get('disposition'),
		['ABSENT', 'PRESENT'],
		`${path}.disposition`
	);
	const rawRecords = inspectDenseArray(
		record.values.get('records'),
		budgets.maxEvidenceRecords,
		`${path}.records`
	);
	if (ledger.evidenceRecords + rawRecords.length > budgets.maxEvidenceRecords)
		throw new AccountingRefusal(
			'REQUEST_EVIDENCE_BUDGET_EXCEEDED',
			'REQUEST',
			'resource-refused',
			'Aggregate evidence records exceed $.budgets.maxEvidenceRecords.',
			`${path}.records`
		);
	ledger.evidenceRecords += rawRecords.length;
	const records = rawRecords.map((rawRecord, index): HarmonizationEvidenceRecord => {
		const recordPath = `${path}.records[${index}]`;
		const inspected = inspectExactRecord(
			rawRecord,
			EVIDENCE_RECORD_KEYS,
			recordPath,
			`${recordPath} must be one exact plain-data evidence record.`
		);
		return {
			evidenceId: retainedText(
				inspected.values.get('evidenceId'),
				`${recordPath}.evidenceId`,
				budgets,
				ledger
			),
			kind: enumValue(
				inspected.values.get('kind'),
				[
					'PLANTED_POSITIVE_DETECTION',
					'PLANTED_POSITIVE_MISS',
					'NEARBY_NEGATIVE_CONTROL',
					'APPLICABILITY_CLOSURE',
					'EXECUTION'
				],
				`${recordPath}.kind`
			),
			sha256: retainedSha256(
				inspected.values.get('sha256'),
				`${recordPath}.sha256`,
				budgets,
				ledger
			),
			sourceReference: retainedText(
				inspected.values.get('sourceReference'),
				`${recordPath}.sourceReference`,
				budgets,
				ledger
			)
		};
	});
	if (new Set(records.map((evidenceRecord) => evidenceRecord.evidenceId)).size !== records.length)
		throw new AccountingRefusal(
			'REQUEST_EVIDENCE_ID_DUPLICATE',
			'REQUEST',
			'incompatible',
			'Evidence IDs must be unique within each finding assessment.',
			`${path}.records`
		);
	records.sort((left, right) =>
		left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0
	);
	for (const evidenceRecord of records)
		reconcileGlobalIdentity(
			ledger.evidenceIdentityBindings,
			evidenceRecord.evidenceId,
			evidenceRecord,
			'REQUEST_EVIDENCE_IDENTITY_CONFLICT',
			`${path}.records`
		);
	if ((disposition === 'ABSENT') !== (records.length === 0))
		throw new AccountingRefusal(
			'REQUEST_EVIDENCE_DISPOSITION_INCOHERENT',
			'REQUEST',
			'incompatible',
			'Evidence disposition must exactly distinguish empty from populated evidence records.',
			path
		);
	return { disposition, records };
}

function materializeProvenance(
	value: unknown,
	path: string,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): HarmonizationProvenanceBinding {
	const record = inspectExactRecord(
		value,
		PROVENANCE_KEYS,
		path,
		`${path} must be one exact plain-data provenance binding.`
	);
	const disposition = enumValue(
		record.values.get('disposition'),
		['ANALYSIS_BOUND', 'BASELINE_ONLY'],
		`${path}.disposition`
	);
	const rawRecords = inspectDenseArray(
		record.values.get('records'),
		budgets.maxProvenanceRecords,
		`${path}.records`
	);
	if (ledger.provenanceRecords + rawRecords.length > budgets.maxProvenanceRecords)
		throw new AccountingRefusal(
			'REQUEST_PROVENANCE_BUDGET_EXCEEDED',
			'REQUEST',
			'resource-refused',
			'Aggregate provenance records exceed $.budgets.maxProvenanceRecords.',
			`${path}.records`
		);
	ledger.provenanceRecords += rawRecords.length;
	const records = rawRecords.map((rawRecord, index): HarmonizationProvenanceRecord => {
		const recordPath = `${path}.records[${index}]`;
		const inspected = inspectExactRecord(
			rawRecord,
			PROVENANCE_RECORD_KEYS,
			recordPath,
			`${recordPath} must be one exact plain-data provenance record.`
		);
		return {
			kind: enumValue(
				inspected.values.get('kind'),
				['RUN', 'INVOCATION', 'PROVIDER', 'ADAPTER', 'CONFIGURATION', 'RULE_SET'],
				`${recordPath}.kind`
			),
			provenanceId: retainedText(
				inspected.values.get('provenanceId'),
				`${recordPath}.provenanceId`,
				budgets,
				ledger
			),
			sha256: retainedSha256(
				inspected.values.get('sha256'),
				`${recordPath}.sha256`,
				budgets,
				ledger
			),
			version: retainedText(
				inspected.values.get('version'),
				`${recordPath}.version`,
				budgets,
				ledger
			)
		};
	});
	if (
		new Set(records.map((provenanceRecord) => provenanceRecord.provenanceId)).size !==
		records.length
	)
		throw new AccountingRefusal(
			'REQUEST_PROVENANCE_ID_DUPLICATE',
			'REQUEST',
			'incompatible',
			'Provenance IDs must be unique within each finding assessment.',
			`${path}.records`
		);
	records.sort((left, right) =>
		left.provenanceId < right.provenanceId ? -1 : left.provenanceId > right.provenanceId ? 1 : 0
	);
	for (const provenanceRecord of records)
		reconcileGlobalIdentity(
			ledger.provenanceIdentityBindings,
			provenanceRecord.provenanceId,
			provenanceRecord,
			'REQUEST_PROVENANCE_IDENTITY_CONFLICT',
			`${path}.records`
		);
	if ((disposition === 'BASELINE_ONLY') !== (records.length === 0))
		throw new AccountingRefusal(
			'REQUEST_PROVENANCE_DISPOSITION_INCOHERENT',
			'REQUEST',
			'incompatible',
			'Provenance disposition must exactly distinguish baseline-only from populated records.',
			path
		);
	return { disposition, records };
}

function materializeCurrentness(
	value: unknown,
	path: string,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): HarmonizationCurrentnessBinding {
	const record = inspectExactRecord(
		value,
		CURRENTNESS_KEYS,
		path,
		`${path} must be one exact plain-data currentness binding.`
	);
	const basis = enumValue(
		record.values.get('basis'),
		['CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED'],
		`${path}.basis`
	);
	const state = enumValue(
		record.values.get('state'),
		['CALLER_DECLARED_CURRENT', 'CALLER_DECLARED_STALE', 'NOT_ASSESSED'],
		`${path}.state`
	);
	const rawDependencies = inspectDenseArray(
		record.values.get('invalidationDependencyIds'),
		budgets.maxInvalidationDependencyIds,
		`${path}.invalidationDependencyIds`
	);
	if (
		ledger.invalidationDependencyIds + rawDependencies.length >
		budgets.maxInvalidationDependencyIds
	)
		throw new AccountingRefusal(
			'REQUEST_CURRENTNESS_BUDGET_EXCEEDED',
			'REQUEST',
			'resource-refused',
			'Aggregate invalidation dependency IDs exceed their caller budget.',
			`${path}.invalidationDependencyIds`
		);
	ledger.invalidationDependencyIds += rawDependencies.length;
	const invalidationDependencyIds = rawDependencies.map((dependencyId, index) =>
		retainedText(dependencyId, `${path}.invalidationDependencyIds[${index}]`, budgets, ledger)
	);
	if (new Set(invalidationDependencyIds).size !== invalidationDependencyIds.length)
		throw new AccountingRefusal(
			'REQUEST_CURRENTNESS_DEPENDENCY_DUPLICATE',
			'REQUEST',
			'incompatible',
			'Invalidation dependency IDs must be unique within each finding.',
			`${path}.invalidationDependencyIds`
		);
	for (let index = 1; index < invalidationDependencyIds.length; index += 1) {
		if (invalidationDependencyIds[index - 1]! >= invalidationDependencyIds[index]!)
			throw new AccountingRefusal(
				'REQUEST_CURRENTNESS_DEPENDENCY_ORDER_INVALID',
				'REQUEST',
				'incompatible',
				'Invalidation dependency IDs must use canonical UTF-16 code-unit order.',
				`${path}.invalidationDependencyIds`
			);
	}
	const currentness: HarmonizationCurrentnessBinding = {
		basis,
		frozenSubjectId: nullableRetainedText(
			record.values.get('frozenSubjectId'),
			`${path}.frozenSubjectId`,
			budgets,
			ledger
		),
		invalidationDependencyIds,
		sourceSha256: nullableRetainedSha256(
			record.values.get('sourceSha256'),
			`${path}.sourceSha256`,
			budgets,
			ledger
		),
		state
	};
	const subjectBound = currentness.frozenSubjectId !== null && currentness.sourceSha256 !== null;
	const subjectUnbound = currentness.frozenSubjectId === null && currentness.sourceSha256 === null;
	if (
		(state === 'CALLER_DECLARED_CURRENT' || state === 'CALLER_DECLARED_STALE') !== subjectBound ||
		(state === 'NOT_ASSESSED' && !subjectUnbound) ||
		(state === 'NOT_ASSESSED' && currentness.invalidationDependencyIds.length !== 0) ||
		(state === 'CALLER_DECLARED_STALE' && currentness.invalidationDependencyIds.length === 0)
	)
		throw new AccountingRefusal(
			'REQUEST_CURRENTNESS_INCOHERENT',
			'REQUEST',
			'incompatible',
			'Current/stale states require an exact FrozenSubject and source digest; stale additionally requires an invalidation dependency.',
			path
		);
	if (subjectBound) {
		const observed = {
			frozenSubjectId: currentness.frozenSubjectId!,
			sourceSha256: currentness.sourceSha256!
		};
		if (
			ledger.subjectBinding !== null &&
			(ledger.subjectBinding.frozenSubjectId !== observed.frozenSubjectId ||
				ledger.subjectBinding.sourceSha256 !== observed.sourceSha256)
		)
			throw new AccountingRefusal(
				'REQUEST_MIXED_FROZEN_SUBJECTS',
				'REQUEST',
				'incompatible',
				'All current or stale benchmark rows in one aggregate must bind the same FrozenSubject and source digest.',
				path
			);
		ledger.subjectBinding = observed;
	}
	return currentness;
}

function materializeUnsupportedCapabilities(
	value: unknown,
	path: string,
	row: HarmonizationBenchmarkRow
): readonly HarmonizationCapabilityCode[] {
	const rawCapabilities = inspectDenseArray(value, HARMONIZATION_CAPABILITY_CODES.length, path);
	const capabilities = rawCapabilities.map((rawCapability, index) =>
		enumValue(rawCapability, HARMONIZATION_CAPABILITY_CODES, `${path}[${index}]`)
	);
	if (new Set(capabilities).size !== capabilities.length)
		throw new AccountingRefusal(
			'REQUEST_CAPABILITY_DUPLICATE',
			'REQUEST',
			'incompatible',
			`${path} must not contain duplicate capabilities.`,
			path
		);
	const capabilityOrder = new Map(
		HARMONIZATION_CAPABILITY_CODES.map((capability, index) => [capability, index] as const)
	);
	for (let index = 1; index < capabilities.length; index += 1) {
		if (
			capabilityOrder.get(capabilities[index - 1]!)! >= capabilityOrder.get(capabilities[index]!)!
		)
			throw new AccountingRefusal(
				'REQUEST_CAPABILITY_ORDER_INVALID',
				'REQUEST',
				'incompatible',
				`${path} must use canonical capability-code order.`,
				path
			);
	}
	if (capabilities.some((capability) => !row.minimumCapabilities.includes(capability)))
		throw new AccountingRefusal(
			'REQUEST_CAPABILITY_NOT_REQUIRED',
			'REQUEST',
			'incompatible',
			`${path} may name only minimum capabilities assigned to finding ${row.findingId}.`,
			path
		);
	return capabilities;
}

function requireAssessmentCoherence(
	assessment: HarmonizationBenchmarkAssessment,
	row: HarmonizationBenchmarkRow,
	path: string
): void {
	const implemented = assessment.rule.implementation === 'IMPLEMENTED';
	const implementedBindingComplete =
		assessment.rule.method !== 'NONE' &&
		assessment.rule.ruleContentSha256 !== null &&
		assessment.rule.ruleId !== null &&
		assessment.rule.ruleVersion !== null;
	const unimplementedBindingEmpty =
		assessment.rule.method === 'NONE' &&
		assessment.rule.ruleContentSha256 === null &&
		assessment.rule.ruleId === null &&
		assessment.rule.ruleVersion === null;
	if ((implemented && !implementedBindingComplete) || (!implemented && !unimplementedBindingEmpty))
		throw new AccountingRefusal(
			'REQUEST_RULE_BINDING_INCOHERENT',
			'REQUEST',
			'incompatible',
			'Implemented rules require a non-NONE method and exact ID/version; unimplemented rules require NONE and null identities.',
			`${path}.rule`
		);
	if (!implemented && assessment.status !== 'UNSUPPORTED')
		throw new AccountingRefusal(
			'REQUEST_UNIMPLEMENTED_STATUS_INVALID',
			'REQUEST',
			'incompatible',
			'An unimplemented benchmark row must remain explicitly UNSUPPORTED.',
			`${path}.status`
		);
	if (row.classification === 'NORMATIVE_HUMAN' && assessment.rule.method === 'AUTOMATED')
		throw new AccountingRefusal(
			'REQUEST_AUTOMATED_NORMATIVE_VERDICT_FORBIDDEN',
			'REQUEST',
			'incompatible',
			'NORMATIVE_HUMAN rows cannot be bound to an automated benchmark rule.',
			`${path}.rule.method`
		);
	const unsupported = assessment.unsupportedCapabilities.length > 0;
	const evidencePresent = assessment.evidence.disposition === 'PRESENT';
	const provenanceBound = assessment.provenance.disposition === 'ANALYSIS_BOUND';
	if (assessment.status === 'DETECTED' || assessment.status === 'NOT_DETECTED') {
		if (
			!implemented ||
			unsupported ||
			!evidencePresent ||
			!provenanceBound ||
			assessment.currentness.state !== 'CALLER_DECLARED_CURRENT'
		)
			throw new AccountingRefusal(
				'REQUEST_CONCLUSIVE_STATUS_UNSUPPORTED',
				'REQUEST',
				'incompatible',
				'DETECTED and NOT_DETECTED require implemented rule, evidence, provenance, current subject binding, and no unsupported capability.',
				path
			);
		const requiredPositiveEvidence =
			assessment.status === 'DETECTED'
				? ('PLANTED_POSITIVE_DETECTION' as const)
				: ('PLANTED_POSITIVE_MISS' as const);
		if (!assessment.evidence.records.some((record) => record.kind === requiredPositiveEvidence))
			throw new AccountingRefusal(
				'REQUEST_CONCLUSIVE_EVIDENCE_KIND_MISSING',
				'REQUEST',
				'incompatible',
				`${assessment.status} requires an explicit ${requiredPositiveEvidence} evidence record.`,
				`${path}.evidence.records`
			);
		if (!assessment.provenance.records.some((record) => record.kind === 'RUN'))
			throw new AccountingRefusal(
				'REQUEST_CONCLUSIVE_RUN_PROVENANCE_MISSING',
				'REQUEST',
				'incompatible',
				'DETECTED and NOT_DETECTED require explicit RUN provenance.',
				`${path}.provenance.records`
			);
	} else if (assessment.status === 'NOT_APPLICABLE') {
		if (
			!implemented ||
			unsupported ||
			!evidencePresent ||
			!provenanceBound ||
			assessment.currentness.state !== 'CALLER_DECLARED_CURRENT' ||
			!assessment.evidence.records.some((record) => record.kind === 'APPLICABILITY_CLOSURE') ||
			!assessment.provenance.records.some((record) => record.kind === 'RUN')
		)
			throw new AccountingRefusal(
				'REQUEST_NOT_APPLICABLE_UNSUPPORTED',
				'REQUEST',
				'incompatible',
				'NOT_APPLICABLE requires an implemented rule, exact current FrozenSubject, applicability-closure evidence, and RUN provenance.',
				path
			);
	} else if (assessment.status === 'UNSUPPORTED') {
		if (
			!unsupported ||
			evidencePresent ||
			provenanceBound ||
			assessment.currentness.state !== 'NOT_ASSESSED'
		)
			throw new AccountingRefusal(
				'REQUEST_UNSUPPORTED_STATUS_INCOHERENT',
				'REQUEST',
				'incompatible',
				'UNSUPPORTED requires named missing minimum capabilities, no analysis evidence/provenance, and no currentness assessment.',
				path
			);
	} else {
		const neverRun =
			assessment.currentness.state === 'NOT_ASSESSED' && !evidencePresent && !provenanceBound;
		const staleRun =
			assessment.currentness.state === 'CALLER_DECLARED_STALE' &&
			evidencePresent &&
			provenanceBound &&
			assessment.provenance.records.some((record) => record.kind === 'RUN');
		if (!implemented || unsupported || (!neverRun && !staleRun))
			throw new AccountingRefusal(
				'REQUEST_NOT_RUN_STATUS_INCOHERENT',
				'REQUEST',
				'incompatible',
				'NOT_RUN requires an implemented rule and either no execution binding or an explicitly stale prior execution.',
				path
			);
	}
}

function materializeAssessment(
	value: unknown,
	row: HarmonizationBenchmarkRow,
	index: number,
	budgets: HarmonizationBenchmarkAccountingBudgets,
	ledger: MaterializationLedger
): HarmonizationBenchmarkAssessment {
	const path = `$.assessments[${index}]`;
	const record = inspectExactRecord(
		value,
		ASSESSMENT_KEYS,
		path,
		`${path} must be one exact plain-data benchmark assessment.`
	);
	const findingId = record.values.get('findingId');
	if (findingId !== row.findingId)
		throw new AccountingRefusal(
			'REQUEST_FINDING_ID_SEQUENCE_INVALID',
			'REQUEST',
			'incompatible',
			'Assessment finding IDs must be exactly ordered 1 through 75 with no gaps or duplicates.',
			`${path}.findingId`
		);
	const assessment: HarmonizationBenchmarkAssessment = {
		currentness: materializeCurrentness(
			record.values.get('currentness'),
			`${path}.currentness`,
			budgets,
			ledger
		),
		evidence: materializeEvidence(
			record.values.get('evidence'),
			`${path}.evidence`,
			budgets,
			ledger
		),
		findingId: row.findingId,
		provenance: materializeProvenance(
			record.values.get('provenance'),
			`${path}.provenance`,
			budgets,
			ledger
		),
		rule: materializeRule(record.values.get('rule'), `${path}.rule`, budgets, ledger),
		status: enumValue(
			record.values.get('status'),
			HARMONIZATION_BENCHMARK_STATUSES,
			`${path}.status`
		),
		statusRationale: retainedText(
			record.values.get('statusRationale'),
			`${path}.statusRationale`,
			budgets,
			ledger
		),
		unsupportedCapabilities: materializeUnsupportedCapabilities(
			record.values.get('unsupportedCapabilities'),
			`${path}.unsupportedCapabilities`,
			row
		)
	};
	requireAssessmentCoherence(assessment, row, path);
	return assessment;
}

function materializeRequest(value: unknown): HarmonizationBenchmarkAccountingRequest {
	const record = inspectExactRecord(
		value,
		REQUEST_KEYS,
		'$',
		'The accounting request must be one exact plain-data object.'
	);
	const budgets = materializeBudgets(record.values.get('budgets'));
	if (
		record.values.get('schemaVersion') !== HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION
	)
		throw new AccountingRefusal(
			'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
			'REQUEST',
			'incompatible',
			'Accounting request schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	if (
		record.values.get('operationVersion') !== HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION
	)
		throw new AccountingRefusal(
			'REQUEST_OPERATION_VERSION_UNSUPPORTED',
			'REQUEST',
			'incompatible',
			'Accounting request operationVersion is unsupported.',
			'$.operationVersion'
		);
	const ledger: MaterializationLedger = {
		evidenceIdentityBindings: new Map(),
		evidenceRecords: 0,
		invalidationDependencyIds: 0,
		provenanceIdentityBindings: new Map(),
		provenanceRecords: 0,
		retainedUtf8Bytes: 0,
		ruleIdentityBindings: new Map(),
		subjectBinding: null
	};
	const executionId = retainedText(
		record.values.get('executionId'),
		'$.executionId',
		budgets,
		ledger
	);
	const rawAssessments = inspectDenseArray(
		record.values.get('assessments'),
		HARMONIZATION_BENCHMARK_ROWS.length,
		'$.assessments',
		HARMONIZATION_BENCHMARK_ROWS.length
	);
	const assessments = rawAssessments.map((assessment, index) =>
		materializeAssessment(assessment, HARMONIZATION_BENCHMARK_ROWS[index]!, index, budgets, ledger)
	);
	return deepFreezeConstructed({
		assessments,
		budgets,
		executionId,
		operationVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION,
		schemaVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION
	});
}

function emptyStatusTotals(): Record<HarmonizationBenchmarkStatus, number> {
	return {
		DETECTED: 0,
		NOT_APPLICABLE: 0,
		NOT_DETECTED: 0,
		NOT_RUN: 0,
		UNSUPPORTED: 0
	};
}

function requestSummary(request: HarmonizationBenchmarkAccountingRequest): {
	readonly budgets: HarmonizationBenchmarkAccountingBudgets;
	readonly executionId: string;
	readonly schemaVersion: typeof HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION;
} {
	return {
		budgets: { ...request.budgets },
		executionId: request.executionId,
		schemaVersion: request.schemaVersion
	};
}

function buildAccountingResult(
	request: HarmonizationBenchmarkAccountingRequest
): HarmonizationBenchmarkAccountingResult {
	const rows = HARMONIZATION_BENCHMARK_ROWS.map((row, index): HarmonizationAccountedRow => ({
		...row,
		...request.assessments[index]!
	}));
	const statusTotals = emptyStatusTotals();
	const firstIncrementStatusTotals = emptyStatusTotals();
	const byClassification = Object.fromEntries(
		HARMONIZATION_FINDING_CLASSIFICATIONS.map((classification) => [
			classification,
			{ statusTotals: emptyStatusTotals(), total: 0 }
		])
	) as Record<
		HarmonizationFindingClassification,
		{ statusTotals: Record<HarmonizationBenchmarkStatus, number>; total: number }
	>;
	const implementationTotals = {
		automated: 0,
		humanReview: 0,
		implemented: 0,
		unimplemented: 0
	};
	for (const row of rows) {
		statusTotals[row.status] += 1;
		byClassification[row.classification].statusTotals[row.status] += 1;
		byClassification[row.classification].total += 1;
		if (row.firstIncrement) firstIncrementStatusTotals[row.status] += 1;
		if (row.rule.implementation === 'IMPLEMENTED') implementationTotals.implemented += 1;
		else implementationTotals.unimplemented += 1;
		if (row.rule.method === 'AUTOMATED') implementationTotals.automated += 1;
		else if (row.rule.method === 'HUMAN_REVIEW') implementationTotals.humanReview += 1;
	}
	const statusTotal = HARMONIZATION_BENCHMARK_STATUSES.reduce(
		(total, status) => total + statusTotals[status],
		0
	);
	if (statusTotal !== 75)
		throw new AccountingRefusal(
			'ACCOUNTING_TOTAL_INVARIANT_FAILED',
			'ACCOUNTING',
			'failed',
			'Internal benchmark status totals did not reconcile to all 75 findings.'
		);
	const subjectBoundRow = rows.find(
		(row) => row.currentness.frozenSubjectId !== null && row.currentness.sourceSha256 !== null
	);
	const subjectBinding: HarmonizationBenchmarkAccountingResult['subjectBinding'] =
		subjectBoundRow === undefined
			? {
					frozenSubjectId: null,
					sourceSha256: null,
					state: 'NO_ANALYSIS_BOUND_ROWS'
				}
			: {
					frozenSubjectId: subjectBoundRow.currentness.frozenSubjectId!,
					sourceSha256: subjectBoundRow.currentness.sourceSha256!,
					state: 'CALLER_DECLARED_COMMON_FROZEN_SUBJECT'
				};
	return {
		accounting: {
			allFindingIdsAccountedExactlyOnce: true,
			byClassification,
			classificationTotals: { ...HARMONIZATION_EXPECTED_CLASSIFICATION_TOTALS },
			denominator: 75,
			denominatorPolicy: 'ALL_75_FINDINGS_WITH_NO_ATTEMPTED_SUBSET',
			firstIncrement: {
				findingIds: HARMONIZATION_FIRST_INCREMENT_FINDING_IDS,
				statusTotals: firstIncrementStatusTotals,
				total: 23
			},
			implementationTotals,
			statusBasis: 'CALLER_SUPPLIED_STRUCTURALLY_VALIDATED_NOT_INDEPENDENTLY_ADJUDICATED',
			statusTotals,
			statusTotalsReconcileToDenominator: true
		},
		baseline: {
			mapBytes: HARMONIZATION_BENCHMARK_MAP_WITNESS.bytes,
			mapSha256: HARMONIZATION_BENCHMARK_MAP_WITNESS.sha256,
			schemaVersion: HARMONIZATION_BENCHMARK_BASELINE_SCHEMA_VERSION,
			source: HARMONIZATION_FINDINGS_SOURCE_WITNESS
		},
		capability: {
			analysisAuthority: 'NONE',
			detectorExecution: 'NOT_PERFORMED_BY_ACCOUNTING_FOUNDATION',
			dwp005Dwp006OrG5Completion: 'NOT_CLAIMED',
			exemplarDiscrimination: 'NOT_ASSESSED',
			id: HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY,
			phaseVocabulary: 'IMPLEMENTATION_LOCAL_GOVERNING_ALLOCATION_PROJECTION',
			registeredOperation: 'NOT_CLAIMED',
			gateEffect: 'NONE',
			status: HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS
		},
		executionId: request.executionId,
		facadeNonclaims: HARMONIZATION_BENCHMARK_ACCOUNTING_NONCLAIMS,
		rows,
		schemaVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_RESULT_SCHEMA_VERSION,
		subjectBinding
	};
}

function diagnostic(error: AccountingRefusal): HarmonizationBenchmarkAccountingDiagnostic {
	return {
		code: error.code,
		message: error.message,
		path: error.path,
		stage: error.stage
	};
}

function unavailable(
	error: AccountingRefusal,
	request: HarmonizationBenchmarkAccountingRequest | null
): HarmonizationBenchmarkUnavailableOutcome {
	return deepFreezeConstructed({
		analysisAuthority: HARMONIZATION_BENCHMARK_ACCOUNTING_ANALYSIS_AUTHORITY,
		authorityTransfer: HARMONIZATION_BENCHMARK_ACCOUNTING_AUTHORITY_TRANSFER,
		capabilityStatus: HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS,
		diagnostics: [diagnostic(error)] as const,
		gateEffect: HARMONIZATION_BENCHMARK_ACCOUNTING_GATE_EFFECT,
		operationVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION,
		outcome: 'unavailable' as const,
		request: request === null ? null : requestSummary(request),
		result: null,
		schemaVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_OUTCOME_SCHEMA_VERSION,
		state: error.failureState
	});
}

/**
 * Accounts caller-supplied benchmark statuses over the fixed 75-row denominator. This local,
 * unregistered operation does not execute detectors or independently validate evidence/currentness.
 */
export function runHarmonizationBenchmarkAccounting(
	candidate: unknown
): HarmonizationBenchmarkAccountingOutcome {
	let admittedRequest: HarmonizationBenchmarkAccountingRequest | null = null;
	try {
		admittedRequest = materializeRequest(candidate);
		const result = buildAccountingResult(admittedRequest);
		const outcome: HarmonizationBenchmarkAccountedOutcome = {
			analysisAuthority: HARMONIZATION_BENCHMARK_ACCOUNTING_ANALYSIS_AUTHORITY,
			authorityTransfer: HARMONIZATION_BENCHMARK_ACCOUNTING_AUTHORITY_TRANSFER,
			capabilityStatus: HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS,
			diagnostics: [],
			gateEffect: HARMONIZATION_BENCHMARK_ACCOUNTING_GATE_EFFECT,
			operationVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION,
			outcome: 'accounted',
			request: requestSummary(admittedRequest),
			result,
			schemaVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_OUTCOME_SCHEMA_VERSION,
			state: 'accounted'
		};
		const resultBytes = canonicalSemanticJsonWitness(outcome).bytes + 1;
		if (resultBytes > admittedRequest.budgets.maxResultBytes)
			throw new AccountingRefusal(
				'RESULT_BUDGET_EXCEEDED',
				'RESULT',
				'resource-refused',
				'Canonical terminal accounting outcome exceeds $.budgets.maxResultBytes.',
				'$.budgets.maxResultBytes'
			);
		return deepFreezeConstructed(outcome);
	} catch (error) {
		if (error instanceof AccountingRefusal) return unavailable(error, admittedRequest);
		return unavailable(
			new AccountingRefusal(
				'INTERNAL_ACCOUNTING_FAILED',
				'ACCOUNTING',
				'failed',
				'Benchmark accounting failed without a supported diagnostic.'
			),
			admittedRequest
		);
	}
}

/** Honest zero-detector seed: all 75 rows are explicit local/unregistered UNSUPPORTED records. */
export function createUnimplementedHarmonizationBenchmarkAccountingRequest(
	executionId: string
): HarmonizationBenchmarkAccountingRequest {
	if (
		typeof executionId !== 'string' ||
		executionId.length === 0 ||
		executionId.length > HARMONIZATION_BENCHMARK_ACCOUNTING_DEFAULT_BUDGETS.maxStringCharacters ||
		!isUnicodeScalarString(executionId)
	)
		throw new TypeError('executionId must be a nonempty bounded Unicode scalar string.');
	const assessments = HARMONIZATION_BENCHMARK_ROWS.map((row): HarmonizationBenchmarkAssessment => ({
		currentness: {
			basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED',
			frozenSubjectId: null,
			invalidationDependencyIds: [],
			sourceSha256: null,
			state: 'NOT_ASSESSED'
		},
		evidence: { disposition: 'ABSENT', records: [] },
		findingId: row.findingId,
		provenance: { disposition: 'BASELINE_ONLY', records: [] },
		rule: {
			implementation: 'UNIMPLEMENTED',
			method: 'NONE',
			registration: HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS,
			ruleContentSha256: null,
			ruleId: null,
			ruleVersion: null
		},
		status: 'UNSUPPORTED',
		statusRationale: 'NO_BENCHMARK_RULE_IMPLEMENTED_IN_THIS_FOUNDATION',
		unsupportedCapabilities: [...row.minimumCapabilities]
	}));
	return deepFreezeConstructed({
		assessments,
		budgets: { ...HARMONIZATION_BENCHMARK_ACCOUNTING_DEFAULT_BUDGETS },
		executionId,
		operationVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION,
		schemaVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION
	});
}
