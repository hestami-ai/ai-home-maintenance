import { resolve } from 'node:path';
import {
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
	type StaticModuleImpactCandidateReportOutcome,
	type StaticModuleImpactCandidateReportRequest
} from '../contracts/static-module-impact-candidate-report.js';
import type { CapturedArtifactRecord, FrozenSubject } from '../contracts/subject.js';
import {
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY_STATUS,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_FULL_CAP_031,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_METHOD,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_NEXT_EVIDENCE,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_PREDECESSOR_RESULT_BUDGET_DIVISOR,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS,
	type WorkingSourceEditImpactCandidateReportBudgets,
	type WorkingSourceEditImpactCandidateReportDiagnostic,
	type WorkingSourceEditImpactCandidateReportFailureState,
	type WorkingSourceEditImpactCandidateReportOutcome,
	type WorkingSourceEditImpactCandidateReportPartialOutcome,
	type WorkingSourceEditImpactCandidateReportRequest,
	type WorkingSourceEditImpactCandidateReportResult,
	type WorkingSourceEditImpactCandidateReportStage,
	type WorkingSourceEditObservation
} from '../contracts/working-source-edit-impact-candidate-report.js';
import {
	bindWorkingSourceEditObservation,
	isWorkingSourceEditObservationError,
	observeWorkingSourceEdit,
	sameWorkingSourceEditCapture,
	verifyWorkingSourceEditObservation,
	type WorkingSourceEditCapture
} from '../impact/observe-working-source-edit.js';
import {
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { assertCanonicalRelativePath, canonicalPathKey } from '../subject/paths.js';
import {
	runStaticModuleImpactCandidateReportWithCapturedSubject,
	type RunStaticModuleImpactCandidateReportOptions
} from './run-static-module-impact-candidate-report.js';

const REQUEST_KEYS = [
	'budgets',
	'immutableBaseCommitOid',
	'operationVersion',
	'schemaVersion',
	'seed',
	'subjectProjectConfigPaths'
] as const;
const SEED_KEYS = [
	'id',
	'logicalPath',
	'operation',
	'projectConfigPath',
	'schemaVersion',
	'scope'
] as const;
const FULL_GIT_OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const MAX_CALLER_ID_CHARACTERS = 4_096;

interface AdmittedOptions {
	readonly additionalArtifacts?: RunStaticModuleImpactCandidateReportOptions['additionalArtifacts'];
	readonly onPredecessorProgress?: RunStaticModuleImpactCandidateReportOptions['onPredecessorProgress'];
	readonly repositoryRoot: string;
	readonly subjectFilters?: RunStaticModuleImpactCandidateReportOptions['subjectFilters'];
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: WorkingSourceEditImpactCandidateReportFailureState = 'incompatible'
	) {
		super(message);
	}
}

class CompositionError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly stage: WorkingSourceEditImpactCandidateReportStage,
		readonly state: WorkingSourceEditImpactCandidateReportFailureState = 'failed',
		readonly path: string | null = null
	) {
		super(message);
	}
}

function exactDataRecord(
	value: unknown,
	expectedKeys: readonly string[],
	path: string
): Readonly<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', `${path} must be an exact object.`, path);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', `${path} must be a data object.`, path);
	const keys = Reflect.ownKeys(value);
	if (
		keys.some((key) => typeof key !== 'string') ||
		keys.length !== expectedKeys.length ||
		expectedKeys.some((key) => !keys.includes(key))
	)
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', `${path} has unexpected keys.`, path);
	const materialized: Record<string, unknown> = {};
	for (const key of expectedKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			throw new ReportRequestError(
				'REQUEST_SHAPE_INVALID',
				`${path}.${key} must be an enumerable data property.`,
				`${path}.${key}`
			);
		materialized[key] = descriptor.value;
	}
	return materialized;
}

function positiveBudget(value: unknown, ceiling: number, path: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
		throw new ReportRequestError(
			'REQUEST_BUDGET_INVALID',
			`${path} must be a positive safe integer.`,
			path
		);
	if (value > ceiling)
		throw new ReportRequestError(
			'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			`${path} exceeds the operation safety ceiling.`,
			path,
			'resource-refused'
		);
	return value;
}

interface BudgetCeilingTree {
	readonly [key: string]: number | BudgetCeilingTree;
}

function materializeBudgetTree(
	value: unknown,
	ceilings: BudgetCeilingTree,
	path: string
): Readonly<Record<string, unknown>> {
	const keys = Object.keys(ceilings);
	const record = exactDataRecord(value, keys, path);
	const materialized: Record<string, unknown> = {};
	for (const key of keys) {
		const ceiling = ceilings[key]!;
		materialized[key] =
			typeof ceiling === 'number'
				? positiveBudget(record[key], ceiling, `${path}.${key}`)
				: materializeBudgetTree(record[key], ceiling, `${path}.${key}`);
	}
	return Object.freeze(materialized);
}

function materializePath(value: unknown, maxPathCharacters: number, path: string): string {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value))
		throw new ReportRequestError('REQUEST_PATH_INVALID', `${path} must be nonempty text.`, path);
	if (value.length > maxPathCharacters)
		throw new ReportRequestError(
			'REQUEST_PATH_BUDGET_EXCEEDED',
			`${path} exceeds the caller path-character budget.`,
			path,
			'resource-refused'
		);
	if (value.includes('\0'))
		throw new ReportRequestError('REQUEST_PATH_INVALID', `${path} contains a NUL character.`, path);
	try {
		return assertCanonicalRelativePath(value);
	} catch {
		throw new ReportRequestError(
			'REQUEST_PATH_INVALID',
			`${path} must be one canonical repository-relative path.`,
			path
		);
	}
}

function materializeProjectPaths(
	value: unknown,
	maxPathCharacters: number,
	maxProjects: number
): readonly string[] {
	if (
		!Array.isArray(value) ||
		isProxyValue(value) ||
		Reflect.getPrototypeOf(value) !== Array.prototype
	)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be a nonempty exact data array.',
			'$.subjectProjectConfigPaths'
		);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value <= 0
	)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be a nonempty exact data array.',
			'$.subjectProjectConfigPaths'
		);
	const length = lengthDescriptor.value;
	if (length > maxProjects)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_BUDGET_EXCEEDED',
			'$.subjectProjectConfigPaths exceeds the caller project budget.',
			'$.subjectProjectConfigPaths',
			'resource-refused'
		);
	const keys = Reflect.ownKeys(value);
	if (
		keys.some((key) => typeof key !== 'string') ||
		keys.length !== length + 1 ||
		!keys.includes('length') ||
		Array.from({ length }, (_, index) => String(index)).some((key) => !keys.includes(key))
	)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be dense and have no extra properties.',
			'$.subjectProjectConfigPaths'
		);
	const paths: string[] = [];
	for (let index = 0; index < length; index += 1) {
		const itemPath = `$.subjectProjectConfigPaths[${index}]`;
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			throw new ReportRequestError(
				'REQUEST_PROJECTS_INVALID',
				`${itemPath} must be an enumerable data property.`,
				itemPath
			);
		paths.push(materializePath(descriptor.value, maxPathCharacters, itemPath));
	}
	const canonicalKeys = paths.map((path) => canonicalPathKey(path));
	if (new Set(canonicalKeys).size !== canonicalKeys.length)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths contains duplicate canonical paths.',
			'$.subjectProjectConfigPaths'
		);
	return Object.freeze(paths);
}

function callerId(value: unknown, path: string): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_CALLER_ID_CHARACTERS ||
		!isUnicodeScalarString(value)
	)
		throw new ReportRequestError(
			'REQUEST_SEED_INVALID',
			`${path} must be a nonempty bounded Unicode scalar string.`,
			path
		);
	return value;
}

function materializeRequest(value: unknown): WorkingSourceEditImpactCandidateReportRequest {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.schemaVersion !== WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	if (record.operationVersion !== WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (
		typeof record.immutableBaseCommitOid !== 'string' ||
		!FULL_GIT_OBJECT_ID_PATTERN.test(record.immutableBaseCommitOid)
	)
		throw new ReportRequestError(
			'REQUEST_BASE_COMMIT_OID_INVALID',
			'$.immutableBaseCommitOid must be one full lowercase Git object ID.',
			'$.immutableBaseCommitOid'
		);
	const budgets = materializeBudgetTree(
		record.budgets,
		WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
		'$.budgets'
	) as unknown as WorkingSourceEditImpactCandidateReportBudgets;
	if (
		budgets.staticImpact.maxResultBytes >
		Math.floor(
			budgets.maxResultBytes /
				WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_PREDECESSOR_RESULT_BUDGET_DIVISOR
		)
	)
		throw new ReportRequestError(
			'REQUEST_PREDECESSOR_RESULT_BUDGET_TOO_LARGE',
			'$.budgets.staticImpact.maxResultBytes must not exceed one half of the outer maxResultBytes.',
			'$.budgets.staticImpact.maxResultBytes',
			'resource-refused'
		);
	if (
		budgets.staticImpact.maxResultBytes >
		budgets.maxResultBytes - WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION
	)
		throw new ReportRequestError(
			'REQUEST_OUTER_RESULT_RESERVATION_UNAVAILABLE',
			'$.budgets.maxResultBytes does not leave the required outer-envelope byte reservation.',
			'$.budgets.maxResultBytes',
			'resource-refused'
		);
	const seed = exactDataRecord(record.seed, SEED_KEYS, '$.seed');
	if (seed.schemaVersion !== WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SEED_SCHEMA_INCOMPATIBLE',
			'$.seed.schemaVersion is unsupported.',
			'$.seed.schemaVersion'
		);
	if (seed.operation !== 'EDIT' || seed.scope !== 'WHOLE_SOURCE')
		throw new ReportRequestError(
			'REQUEST_SEED_INVALID',
			'Only one existing whole-source EDIT seed is supported.',
			'$.seed'
		);
	const maxPathCharacters = Math.min(
		budgets.observation.maxPathCharacters,
		budgets.staticImpact.semantic.maxPathCharacters
	);
	const projectConfigPath = materializePath(
		seed.projectConfigPath,
		maxPathCharacters,
		'$.seed.projectConfigPath'
	);
	const subjectProjectConfigPaths = materializeProjectPaths(
		record.subjectProjectConfigPaths,
		maxPathCharacters,
		Math.min(budgets.staticImpact.subject.maxProjects, budgets.staticImpact.semantic.maxProjects)
	);
	if (
		!subjectProjectConfigPaths
			.map((path) => canonicalPathKey(path))
			.includes(canonicalPathKey(projectConfigPath))
	)
		throw new ReportRequestError(
			'REQUEST_SEED_PROJECT_OUTSIDE_SUBJECT',
			'$.seed.projectConfigPath must occur in $.subjectProjectConfigPaths.',
			'$.seed.projectConfigPath'
		);
	return Object.freeze({
		budgets,
		immutableBaseCommitOid: record.immutableBaseCommitOid,
		operationVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
		seed: Object.freeze({
			id: callerId(seed.id, '$.seed.id'),
			logicalPath: materializePath(seed.logicalPath, maxPathCharacters, '$.seed.logicalPath'),
			operation: 'EDIT',
			projectConfigPath,
			schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: 'WHOLE_SOURCE'
		}),
		subjectProjectConfigPaths
	});
}

function materializeOptions(value: unknown): AdmittedOptions {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		throw new ReportRequestError(
			'OPTIONS_SHAPE_INVALID',
			'$options must be a non-proxy data object.',
			'$options',
			'failed'
		);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new ReportRequestError(
			'OPTIONS_SHAPE_INVALID',
			'$options must be a data object.',
			'$options',
			'failed'
		);
	const keys = Reflect.ownKeys(value);
	if (
		keys.some(
			(key) =>
				typeof key !== 'string' ||
				(key !== 'additionalArtifacts' &&
					key !== 'onPredecessorProgress' &&
					key !== 'repositoryRoot' &&
					key !== 'subjectFilters')
		) ||
		!keys.includes('repositoryRoot')
	)
		throw new ReportRequestError(
			'OPTIONS_SHAPE_INVALID',
			'$options has unexpected or missing keys.',
			'$options',
			'failed'
		);
	const rootDescriptor = Reflect.getOwnPropertyDescriptor(value, 'repositoryRoot');
	if (
		rootDescriptor === undefined ||
		!('value' in rootDescriptor) ||
		!rootDescriptor.enumerable ||
		typeof rootDescriptor.value !== 'string' ||
		rootDescriptor.value.length === 0 ||
		!isUnicodeScalarString(rootDescriptor.value)
	)
		throw new ReportRequestError(
			'OPTIONS_ROOT_INVALID',
			'$options.repositoryRoot must be an enumerable nonempty string data property.',
			'$options.repositoryRoot',
			'failed'
		);
	const additionalArtifactsDescriptor = Reflect.getOwnPropertyDescriptor(
		value,
		'additionalArtifacts'
	);
	if (
		additionalArtifactsDescriptor !== undefined &&
		(!('value' in additionalArtifactsDescriptor) || !additionalArtifactsDescriptor.enumerable)
	)
		throw new ReportRequestError(
			'OPTIONS_ADDITIONAL_ARTIFACTS_INVALID',
			'$options.additionalArtifacts must be an enumerable data property.',
			'$options.additionalArtifacts',
			'failed'
		);
	const callbackDescriptor = Reflect.getOwnPropertyDescriptor(value, 'onPredecessorProgress');
	if (
		callbackDescriptor !== undefined &&
		(!('value' in callbackDescriptor) ||
			!callbackDescriptor.enumerable ||
			(callbackDescriptor.value !== undefined &&
				(typeof callbackDescriptor.value !== 'function' || isProxyValue(callbackDescriptor.value))))
	)
		throw new ReportRequestError(
			'OPTIONS_PROGRESS_INVALID',
			'$options.onPredecessorProgress must be an enumerable non-proxy function data property.',
			'$options.onPredecessorProgress',
			'failed'
		);
	const subjectFiltersDescriptor = Reflect.getOwnPropertyDescriptor(value, 'subjectFilters');
	if (
		subjectFiltersDescriptor !== undefined &&
		(!('value' in subjectFiltersDescriptor) || !subjectFiltersDescriptor.enumerable)
	)
		throw new ReportRequestError(
			'OPTIONS_SUBJECT_FILTERS_INVALID',
			'$options.subjectFilters must be an enumerable data property.',
			'$options.subjectFilters',
			'failed'
		);
	return {
		...(additionalArtifactsDescriptor === undefined ||
		additionalArtifactsDescriptor.value === undefined
			? {}
			: {
					additionalArtifacts:
						additionalArtifactsDescriptor.value as RunStaticModuleImpactCandidateReportOptions['additionalArtifacts']
				}),
		...(callbackDescriptor === undefined || callbackDescriptor.value === undefined
			? {}
			: {
					onPredecessorProgress:
						callbackDescriptor.value as RunStaticModuleImpactCandidateReportOptions['onPredecessorProgress']
				}),
		repositoryRoot: rootDescriptor.value,
		...(subjectFiltersDescriptor === undefined || subjectFiltersDescriptor.value === undefined
			? {}
			: {
					subjectFilters:
						subjectFiltersDescriptor.value as RunStaticModuleImpactCandidateReportOptions['subjectFilters']
				})
	};
}

function diagnostic(
	code: string,
	message: string,
	path: string | null = null,
	source: WorkingSourceEditImpactCandidateReportDiagnostic['source'] = 'REPORT',
	predecessorCode: string | null = null,
	predecessorStage: string | null = null,
	severity: WorkingSourceEditImpactCandidateReportDiagnostic['severity'] = null
): WorkingSourceEditImpactCandidateReportDiagnostic {
	return { code, message, path, predecessorCode, predecessorStage, severity, source };
}

function predecessorDiagnostics(
	predecessor: StaticModuleImpactCandidateReportOutcome
): readonly WorkingSourceEditImpactCandidateReportDiagnostic[] {
	const stage = predecessor.outcome === 'unavailable' ? predecessor.stage : null;
	return predecessor.diagnostics.map((entry) =>
		diagnostic(
			entry.code,
			entry.message,
			entry.path,
			'PREDECESSOR_REPORT',
			entry.code,
			stage,
			entry.severity
		)
	);
}

function failure(
	code: string,
	stage: WorkingSourceEditImpactCandidateReportStage,
	state: WorkingSourceEditImpactCandidateReportFailureState,
	diagnostics: readonly WorkingSourceEditImpactCandidateReportDiagnostic[],
	request?: WorkingSourceEditImpactCandidateReportRequest,
	observation?: WorkingSourceEditObservation,
	subject?: WorkingSourceEditImpactCandidateReportPartialOutcome['subject']
): WorkingSourceEditImpactCandidateReportOutcome {
	const outcome: WorkingSourceEditImpactCandidateReportOutcome = {
		analysisAuthority: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
		authorityTransfer: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
		gateEffect: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT,
		...(observation === undefined ? {} : { observation }),
		operationVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		...(request === undefined ? {} : { request }),
		schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
	if (request === undefined) return outcome;
	try {
		if (canonicalSemanticJsonWitness(outcome).bytes + 1 <= request.budgets.maxResultBytes)
			return outcome;
	} catch {
		// The compact terminal refusal below excludes every variable-size evidence population.
	}
	return {
		analysisAuthority: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
		authorityTransfer: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
		code: 'TERMINAL_RESULT_BUDGET_EXCEEDED',
		diagnostics: [
			diagnostic(
				'TERMINAL_RESULT_BUDGET_EXCEEDED',
				'The unavailable terminal envelope exceeded maxResultBytes; variable-size request and evidence details were omitted.'
			)
		],
		facadeNonclaims: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
		gateEffect: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT,
		operationVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
		stage: 'RESULT',
		state: 'resource-refused'
	};
}

function observationFailure(
	error: unknown,
	request?: WorkingSourceEditImpactCandidateReportRequest,
	observation?: WorkingSourceEditObservation,
	subject?: WorkingSourceEditImpactCandidateReportPartialOutcome['subject']
): WorkingSourceEditImpactCandidateReportOutcome {
	if (isWorkingSourceEditObservationError(error))
		return failure(
			error.code,
			error.stage,
			error.state,
			[diagnostic(error.code, error.message, error.path, 'WORKING_EDIT_OBSERVATION')],
			request,
			observation,
			subject
		);
	return failure(
		'WORKING_SOURCE_EDIT_OBSERVATION_FAILED',
		'GIT_PROVIDER',
		'failed',
		[
			diagnostic(
				'WORKING_SOURCE_EDIT_OBSERVATION_FAILED',
				'The selected working-source edit could not be observed safely.',
				null,
				'WORKING_EDIT_OBSERVATION'
			)
		],
		request,
		observation,
		subject
	);
}

function staticImpactRequest(
	request: WorkingSourceEditImpactCandidateReportRequest,
	capture: WorkingSourceEditCapture
): StaticModuleImpactCandidateReportRequest {
	return {
		budgets: request.budgets.staticImpact,
		operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
		seed: {
			basis: 'CALLER_DECLARED_WORKING_CHANGE_SET',
			expectedArtifactSha256: capture.observation.source.after.sha256,
			id: request.seed.id,
			logicalPath: request.seed.logicalPath,
			operation: 'EDIT',
			projectConfigPath: request.seed.projectConfigPath,
			schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: 'WHOLE_SOURCE',
			workingChangeSetId: capture.observation.evidenceSha256
		},
		subjectProjectConfigPaths: request.subjectProjectConfigPaths
	};
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	if (left.byteLength !== right.byteLength) return false;
	for (let index = 0; index < left.byteLength; index += 1)
		if (left[index] !== right[index]) return false;
	return true;
}

function physicalPathKey(path: string): string {
	const normalized = resolve(path).replace(/[\\/]+$/u, '');
	return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function canonicalIdentity(value: unknown): { readonly bytes: number; readonly sha256: string } {
	try {
		return canonicalSemanticJsonWitness(value);
	} catch {
		throw new CompositionError(
			'HANDOFF_IDENTITY_SERIALIZATION_FAILED',
			'The predecessor handoff identity could not be serialized safely.',
			'PREDECESSOR_REPORT'
		);
	}
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
	const leftIdentity = canonicalIdentity(left);
	const rightIdentity = canonicalIdentity(right);
	return leftIdentity.bytes === rightIdentity.bytes && leftIdentity.sha256 === rightIdentity.sha256;
}

interface ReconciledHandoff {
	readonly artifact: CapturedArtifactRecord;
	readonly observation: WorkingSourceEditObservation;
	readonly subject: FrozenSubject;
}

function reconcileHandoff(
	request: WorkingSourceEditImpactCandidateReportRequest,
	staticRequest: StaticModuleImpactCandidateReportRequest,
	capture: WorkingSourceEditCapture,
	execution: ReturnType<typeof runStaticModuleImpactCandidateReportWithCapturedSubject>
): ReconciledHandoff {
	const predecessor = execution.outcome;
	if (predecessor.outcome !== 'partial')
		throw new CompositionError(
			'PREDECESSOR_OUTCOME_INCOMPATIBLE',
			'The working-edit composition requires one partial static-impact predecessor report.',
			'PREDECESSOR_REPORT'
		);
	if (
		execution.subject === null ||
		execution.repositoryRoot === null ||
		execution.resultBytes === null ||
		execution.subject.descriptor.subjectId !== predecessor.subject.subjectId ||
		physicalPathKey(execution.repositoryRoot) !== physicalPathKey(capture.repositoryRoot)
	)
		throw new CompositionError(
			'PREDECESSOR_EXACT_HANDOFF_UNAVAILABLE',
			'The exact captured predecessor subject, repository root, or serialized-result size is unavailable.',
			'PREDECESSOR_REPORT'
		);
	const predecessorIdentity = canonicalIdentity(predecessor);
	if (predecessorIdentity.bytes + 1 !== execution.resultBytes)
		throw new CompositionError(
			'PREDECESSOR_RESULT_SIZE_HANDOFF_MISMATCH',
			'The predecessor serialized-result size does not reconcile with its exact report.',
			'PREDECESSOR_REPORT'
		);
	if (
		!sameCanonicalValue(predecessor.request, staticRequest) ||
		!sameCanonicalValue(predecessor.subject, execution.subject.descriptor)
	)
		throw new CompositionError(
			'PREDECESSOR_REQUEST_OR_SUBJECT_HANDOFF_MISMATCH',
			'The predecessor request or subject does not reconcile with the exact facade handoff.',
			'PREDECESSOR_REPORT'
		);
	const seed = predecessor.result.seed;
	const artifact = seed.artifact;
	const descriptorArtifact = execution.subject.artifacts.find(
		(entry) => entry.path === request.seed.logicalPath
	);
	if (
		seed.seedId !== request.seed.id ||
		seed.logicalPath !== request.seed.logicalPath ||
		seed.projectConfigPath !== request.seed.projectConfigPath ||
		seed.operation !== request.seed.operation ||
		seed.scope !== request.seed.scope ||
		seed.subjectId !== predecessor.subject.subjectId ||
		seed.workingChangeSet.id !== capture.observation.evidenceSha256 ||
		predecessor.result.invalidationDependencies.workingChangeSetId !==
			capture.observation.evidenceSha256 ||
		artifact.path !== request.seed.logicalPath ||
		artifact.sha256 !== capture.observation.source.after.sha256 ||
		descriptorArtifact === undefined ||
		!sameCanonicalValue(artifact, descriptorArtifact)
	)
		throw new CompositionError(
			'SEED_SUBJECT_IDENTITY_MISMATCH',
			'The observed edit, predecessor seed, and captured subject identities do not reconcile.',
			'SUBJECT'
		);
	const frozenBytes = readFrozenSubjectArtifact(execution.subject, request.seed.logicalPath);
	if (frozenBytes === undefined)
		throw new CompositionError(
			'FROZEN_SUBJECT_ARTIFACT_BYTES_UNAVAILABLE',
			'The exact captured bytes for the selected source are unavailable.',
			'SUBJECT'
		);
	if (!sameBytes(frozenBytes, capture.currentBytes))
		throw new CompositionError(
			'OBSERVED_SOURCE_AND_FROZEN_SUBJECT_BYTES_DIFFER',
			'The observed current raw source bytes differ from the exact FrozenSubject artifact bytes.',
			'SUBJECT',
			'stale',
			request.seed.logicalPath
		);
	let observation: WorkingSourceEditObservation;
	try {
		observation = bindWorkingSourceEditObservation(capture, artifact);
	} catch (error) {
		if (isWorkingSourceEditObservationError(error))
			throw new CompositionError(error.code, error.message, 'SUBJECT', error.state, error.path);
		throw new CompositionError(
			'FROZEN_SUBJECT_BINDING_FAILED',
			'The observed edit could not be bound to the exact FrozenSubject artifact.',
			'SUBJECT'
		);
	}
	if (observation.evidenceSha256 !== capture.observation.evidenceSha256)
		throw new CompositionError(
			'OBSERVATION_DIGEST_CHANGED_DURING_SUBJECT_BINDING',
			'The raw working-edit evidence digest changed during FrozenSubject binding.',
			'SUBJECT'
		);
	return { artifact, observation, subject: execution.subject };
}

function resultFor(
	request: WorkingSourceEditImpactCandidateReportRequest,
	observation: WorkingSourceEditObservation,
	predecessor: Extract<StaticModuleImpactCandidateReportOutcome, { readonly outcome: 'partial' }>
): WorkingSourceEditImpactCandidateReportResult {
	const predecessorAnalysis = predecessor.result.evidence.predecessorReport.result.analysis;
	return {
		capability: {
			fullJanCsaaCap031: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_FULL_CAP_031,
			id: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY,
			predecessorCapability: 'IMPLEMENTATION_LOCAL_STATIC_MODULE_IMPACT_CANDIDATES',
			predecessorStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
			status: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY_STATUS
		},
		conclusion:
			predecessor.result.candidates.length === 0
				? 'VALIDATED_WORKING_SOURCE_EDIT_WITH_NO_STATIC_MODULE_IMPORTER_CANDIDATES_WITHIN_SELECTED_GRAPH'
				: 'VALIDATED_WORKING_SOURCE_EDIT_WITH_STATIC_MODULE_IMPORTER_CANDIDATES',
		currentness: {
			finalFacadeVerification: 'RECHECKED_AFTER_COMPOSITION_AND_RESULT_SIZE_ACCOUNTING',
			frozenSubject: 'CURRENT_FOR_CAPTURED_SUBJECT',
			gitHead: 'EXACT_REQUESTED_IMMUTABLE_BASE_REOBSERVED',
			index: 'EXACT_STAGE_ZERO_HEAD_TREE_MATCH_REOBSERVED',
			rawCurrentSource: 'EXACT_OBSERVED_BYTES_REOBSERVED',
			scope: 'SELECTED_SOURCE_HEAD_INDEX_RAW_BYTES_AND_CAPTURED_SUBJECT_ONLY',
			state: 'CURRENT_FOR_VALIDATED_SELECTED_WORKING_SOURCE_EDIT'
		},
		evidence: {
			composition: 'FULL_WORKING_EDIT_OBSERVATION_PLUS_UNMODIFIED_PREDECESSOR_REPORT',
			staticModuleImpactCandidateReport: predecessor,
			workingSourceEdit: observation
		},
		exclusions: {
			editObservation: WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS,
			subjectExcludedClasses: predecessor.subject.excludedClasses,
			subjectExclusionPolicyIds: predecessor.subject.exclusionPolicyIds,
			subjectPerimeter: predecessor.subject.perimeter
		},
		facadeNonclaims: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
		globalImpactClosure: 'OPEN',
		invalidationDependencies: {
			currentArtifactSha256: observation.source.after.artifact.sha256,
			immutableBaseCommitOid: request.immutableBaseCommitOid,
			indexBlobOid: observation.git.indexBlobOid,
			predecessorAnalysisContentDigest: predecessorAnalysis.contentDigest,
			predecessorAnalysisId: predecessorAnalysis.id,
			predecessorSourceGraphContentDigest: predecessorAnalysis.sourceGraph.contentDigest,
			predecessorSourceGraphId: predecessorAnalysis.sourceGraph.graphId,
			subjectId: predecessor.subject.subjectId,
			treeBlobOid: observation.git.treeBlobOid,
			workingSourceEditEvidenceSha256: observation.evidenceSha256
		},
		method: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_METHOD,
		nextEvidenceNeeded: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_NEXT_EVIDENCE,
		schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION,
		seed: {
			basis: 'VALIDATED_RAW_IMMUTABLE_HEAD_BLOB_TO_CURRENT_FROZEN_SUBJECT_ARTIFACT',
			currentArtifact: observation.source.after.artifact,
			evidenceSha256: observation.evidenceSha256,
			id: request.seed.id,
			logicalPath: request.seed.logicalPath,
			operation: request.seed.operation,
			projectConfigPath: request.seed.projectConfigPath,
			schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: request.seed.scope,
			staticImpactWorkingChangeSetBinding: {
				id: observation.evidenceSha256,
				interpretation: 'OBSERVED_EDIT_EVIDENCE_SHA256_NOT_A_WORKING_CHANGE_SET_RECORD'
			}
		},
		uncertainty: {
			changeInterpretation: 'TEXTUAL_SINGLE_ENVELOPE_ONLY',
			repositoryWorkingChangeClosure: 'NOT_ASSESSED',
			staticImpactCandidates: 'POSSIBLE_ONLY',
			staticImpactGlobalClosure: 'OPEN'
		}
	};
}

function runInternal(
	requestValue: unknown,
	optionsValue: RunWorkingSourceEditImpactCandidateReportOptions
): WorkingSourceEditImpactCandidateReportOutcome {
	let request: WorkingSourceEditImpactCandidateReportRequest;
	try {
		request = materializeRequest(requestValue);
	} catch (error) {
		if (error instanceof ReportRequestError)
			return failure(error.code, 'REQUEST', error.state, [
				diagnostic(error.code, error.message, error.path)
			]);
		return failure('REQUEST_INVALID', 'REQUEST', 'incompatible', [
			diagnostic('REQUEST_INVALID', 'The report request could not be inspected safely.', '$')
		]);
	}
	let options: AdmittedOptions;
	try {
		options = materializeOptions(optionsValue);
	} catch (error) {
		if (error instanceof ReportRequestError)
			return failure(error.code, 'REQUEST', error.state, [
				diagnostic(error.code, error.message, error.path)
			]);
		return failure('OPTIONS_INVALID', 'REQUEST', 'failed', [
			diagnostic('OPTIONS_INVALID', 'The runner options could not be inspected safely.', '$options')
		]);
	}
	let initialCapture: WorkingSourceEditCapture;
	try {
		initialCapture = observeWorkingSourceEdit({
			budgets: request.budgets.observation,
			expectedHeadOid: request.immutableBaseCommitOid,
			logicalPath: request.seed.logicalPath,
			rootLocator: options.repositoryRoot
		});
	} catch (error) {
		return observationFailure(error, request);
	}
	const predecessorRequest = staticImpactRequest(request, initialCapture);
	const predecessorExecution = runStaticModuleImpactCandidateReportWithCapturedSubject(
		predecessorRequest,
		{
			...(options.additionalArtifacts === undefined
				? {}
				: { additionalArtifacts: options.additionalArtifacts }),
			...(options.onPredecessorProgress === undefined
				? {}
				: { onPredecessorProgress: options.onPredecessorProgress }),
			repositoryRoot: initialCapture.repositoryRoot,
			...(options.subjectFilters === undefined ? {} : { subjectFilters: options.subjectFilters })
		}
	);
	const predecessor = predecessorExecution.outcome;
	const inheritedDiagnostics = predecessorDiagnostics(predecessor);
	if (predecessor.outcome !== 'partial')
		return failure(
			predecessor.code,
			'PREDECESSOR_REPORT',
			predecessor.state,
			inheritedDiagnostics.length === 0
				? [
						diagnostic(
							predecessor.code,
							'The static module impact-candidate predecessor was unavailable.',
							null,
							'PREDECESSOR_REPORT',
							predecessor.code,
							predecessor.stage
						)
					]
				: inheritedDiagnostics,
			request,
			undefined,
			predecessor.subject
		);
	let handoff: ReconciledHandoff;
	try {
		handoff = reconcileHandoff(request, predecessorRequest, initialCapture, predecessorExecution);
	} catch (error) {
		if (error instanceof CompositionError)
			return failure(
				error.code,
				error.stage,
				error.state,
				[...inheritedDiagnostics, diagnostic(error.code, error.message, error.path)],
				request,
				undefined,
				predecessor.subject
			);
		return failure(
			'PREDECESSOR_HANDOFF_RECONCILIATION_FAILED',
			'PREDECESSOR_REPORT',
			'failed',
			[
				...inheritedDiagnostics,
				diagnostic(
					'PREDECESSOR_HANDOFF_RECONCILIATION_FAILED',
					'The exact predecessor handoff could not be reconciled safely.'
				)
			],
			request,
			undefined,
			predecessor.subject
		);
	}
	const report: WorkingSourceEditImpactCandidateReportPartialOutcome = {
		analysisAuthority: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY,
		authorityTransfer: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER,
		diagnostics: inheritedDiagnostics,
		gateEffect: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT,
		operationVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: resultFor(request, handoff.observation, predecessor),
		schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION,
		state: 'partial',
		subject: predecessor.subject
	};
	let resultBytes: number;
	try {
		resultBytes = canonicalSemanticJsonWitness(report).bytes + 1;
	} catch {
		return failure(
			'RESULT_SERIALIZATION_FAILED',
			'RESULT',
			'failed',
			[
				diagnostic(
					'RESULT_SERIALIZATION_FAILED',
					'The working-source-edit impact-candidate report could not be serialized safely.'
				)
			],
			request,
			handoff.observation,
			predecessor.subject
		);
	}
	if (resultBytes > request.budgets.maxResultBytes)
		return failure(
			'RESULT_BUDGET_EXCEEDED',
			'RESULT',
			'resource-refused',
			[
				diagnostic(
					'RESULT_BUDGET_EXCEEDED',
					'The admitted working-source-edit impact-candidate report exceeds maxResultBytes.'
				)
			],
			request,
			handoff.observation,
			predecessor.subject
		);
	let firstFinalCapture: WorkingSourceEditCapture;
	try {
		firstFinalCapture = verifyWorkingSourceEditObservation(initialCapture);
		if (!sameWorkingSourceEditCapture(initialCapture, firstFinalCapture))
			throw new CompositionError(
				'WORKING_SOURCE_EDIT_OBSERVATION_STALE',
				'The selected working-source edit changed before final currentness verification.',
				'CURRENTNESS',
				'stale',
				request.seed.logicalPath
			);
	} catch (error) {
		if (error instanceof CompositionError)
			return failure(
				error.code,
				error.stage,
				error.state,
				[diagnostic(error.code, error.message, error.path, 'CURRENTNESS')],
				request,
				handoff.observation,
				predecessor.subject
			);
		return observationFailure(error, request, handoff.observation, predecessor.subject);
	}
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		freshness = verifyFrozenSubject(handoff.subject, {
			rootLocator: predecessorExecution.repositoryRoot!
		});
	} catch {
		freshness = { changedPaths: [], diagnostics: [], state: 'UNAVAILABLE' };
	}
	if (freshness.state !== 'CURRENT') {
		const stale = freshness.state === 'STALE';
		const code = stale ? 'FROZEN_SUBJECT_STALE' : 'FROZEN_SUBJECT_CURRENTNESS_UNAVAILABLE';
		return failure(
			code,
			'CURRENTNESS',
			stale ? 'stale' : 'failed',
			[
				diagnostic(
					code,
					stale
						? 'The exact captured predecessor subject changed after report composition and result-size accounting.'
						: 'Final currentness for the exact captured predecessor subject is unavailable.',
					null,
					'CURRENTNESS'
				)
			],
			request,
			handoff.observation,
			predecessor.subject
		);
	}
	try {
		const secondFinalCapture = verifyWorkingSourceEditObservation(initialCapture);
		if (
			!sameWorkingSourceEditCapture(initialCapture, secondFinalCapture) ||
			!sameWorkingSourceEditCapture(firstFinalCapture, secondFinalCapture)
		)
			throw new CompositionError(
				'WORKING_SOURCE_EDIT_OBSERVATION_STALE',
				'The selected working-source edit changed during the final currentness sandwich.',
				'CURRENTNESS',
				'stale',
				request.seed.logicalPath
			);
	} catch (error) {
		if (error instanceof CompositionError)
			return failure(
				error.code,
				error.stage,
				error.state,
				[diagnostic(error.code, error.message, error.path, 'CURRENTNESS')],
				request,
				handoff.observation,
				predecessor.subject
			);
		return observationFailure(error, request, handoff.observation, predecessor.subject);
	}
	return report;
}

export interface RunWorkingSourceEditImpactCandidateReportOptions {
	/** Trusted artifacts retained in the exact predecessor frozen subject identity. */
	readonly additionalArtifacts?: RunStaticModuleImpactCandidateReportOptions['additionalArtifacts'];
	/** Exact predecessor progress stream; excluded from this terminal report identity. */
	readonly onPredecessorProgress?: RunStaticModuleImpactCandidateReportOptions['onPredecessorProgress'];
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
	/** Trusted exact filter policy retained in the predecessor frozen subject identity. */
	readonly subjectFilters?: RunStaticModuleImpactCandidateReportOptions['subjectFilters'];
}

export function runWorkingSourceEditImpactCandidateReport(
	requestValue: unknown,
	options: RunWorkingSourceEditImpactCandidateReportOptions
): WorkingSourceEditImpactCandidateReportOutcome {
	try {
		return runInternal(requestValue, options);
	} catch {
		return failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
			diagnostic(
				'INTERNAL_FAILURE',
				'The working-source-edit impact-candidate report failed closed.'
			)
		]);
	}
}

export function workingSourceEditImpactCandidateReportExitCode(
	outcome: WorkingSourceEditImpactCandidateReportOutcome
): 2 | 3 | 4 {
	if (
		outcome.outcome === 'partial' ||
		outcome.state === 'resource-refused' ||
		outcome.state === 'stale'
	)
		return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
