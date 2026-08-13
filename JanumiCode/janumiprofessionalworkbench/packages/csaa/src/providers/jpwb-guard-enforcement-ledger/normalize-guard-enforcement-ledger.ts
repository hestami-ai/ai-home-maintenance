import { isProxy } from 'node:util/types';

import {
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
	GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER,
	GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE,
	GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE,
	GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
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
	type GuardEnforcementDisposition,
	type GuardEnforcementLedgerArrowId,
	type GuardEnforcementLedgerArtifactSetBinding,
	type GuardEnforcementLedgerExecutorIdentity,
	type GuardEnforcementLedgerObservation,
	type GuardEnforcementLedgerRawEvidence,
	type GuardEnforcementLedgerRawOutputIdentity,
	type ObserveGuardEnforcementLedgerRequest
} from '../../contracts/guard-enforcement-ledger.js';
import { compareText } from '../../inventory/canonical.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	isUnicodeScalarString
} from '../../semantic/canonical.js';
import {
	guardEnforcementLedgerArrowId,
	guardEnforcementLedgerGuardId,
	guardEnforcementLedgerObservationContentDigest,
	guardEnforcementLedgerObservationId,
	guardEnforcementLedgerRawOutputId
} from './guard-enforcement-ledger-content.js';
import { GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION } from './worker.js';

export class GuardEnforcementLedgerNormalizationError extends Error {
	constructor(
		readonly path: string,
		message: string
	) {
		super(message);
		this.name = 'GuardEnforcementLedgerNormalizationError';
	}
}

function fail(path: string, message: string): never {
	throw new GuardEnforcementLedgerNormalizationError(path, message);
}

type PlainRecord = Record<string, unknown>;

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

function exactRecord(value: unknown, path: string, keys: readonly string[]): PlainRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		fail(path, 'Expected an exact plain record.');
	let prototype: object | null;
	let own: readonly PropertyKey[];
	try {
		prototype = Reflect.getPrototypeOf(value);
		own = Reflect.ownKeys(value);
	} catch {
		return fail(path, 'Expected an inspectable plain record.');
	}
	if (
		(prototype !== Object.prototype && prototype !== null) ||
		own.length !== keys.length ||
		own.some((key) => typeof key !== 'string' || !keys.includes(key))
	)
		fail(path, 'Record field population is not exact.');
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail(`${path}.${key}`, 'Expected an enumerable data property.');
	}
	return value as PlainRecord;
}

function recordData(record: PlainRecord, key: string): unknown {
	return Reflect.getOwnPropertyDescriptor(record, key)?.value;
}

function text(value: unknown, path: string, allowEmpty = false): asserts value is string {
	if (
		typeof value !== 'string' ||
		(!allowEmpty && value.length === 0) ||
		!isUnicodeScalarString(value)
	)
		fail(
			path,
			allowEmpty ? 'Expected Unicode scalar text.' : 'Expected nonempty Unicode scalar text.'
		);
}

function positiveInteger(value: unknown, path: string): asserts value is number {
	if (!Number.isSafeInteger(value) || (value as number) < 1)
		fail(path, 'Expected a positive safe integer.');
}

function nonnegativeInteger(value: unknown, path: string): asserts value is number {
	if (!Number.isSafeInteger(value) || (value as number) < 0)
		fail(path, 'Expected a nonnegative safe integer.');
}

function digest(value: unknown, path: string): asserts value is string {
	if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value))
		fail(path, 'Expected a lowercase SHA-256 digest.');
}

const DISPOSITIONS = [
	'ARROW_UNREACHABLE',
	'ENFORCED',
	'NOT_MECHANICALLY_CHECKABLE',
	'REDUNDANT_WITH_MACHINE',
	'UNENFORCED'
] as const;
const DISPOSITION_SET = new Set<string>(DISPOSITIONS);

function disposition(value: unknown, path: string): asserts value is GuardEnforcementDisposition {
	if (typeof value !== 'string' || !DISPOSITION_SET.has(value))
		fail(path, 'Expected a recognized guard disposition.');
}

function assertRequest(value: unknown): asserts value is ObserveGuardEnforcementLedgerRequest {
	const request = exactRecord(value, '$input.request', [
		'artifactSetId',
		'budgets',
		'operationVersion',
		'schemaVersion',
		'subjectId'
	]);
	if (recordData(request, 'schemaVersion') !== GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION)
		fail('$input.request.schemaVersion', 'Unsupported request schema version.');
	if (recordData(request, 'operationVersion') !== GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION)
		fail('$input.request.operationVersion', 'Unsupported operation version.');
	for (const key of ['artifactSetId', 'subjectId'] as const)
		text(recordData(request, key), `$input.request.${key}`);
	const budgets = exactRecord(
		recordData(request, 'budgets'),
		'$input.request.budgets',
		BUDGET_KEYS
	);
	for (const key of BUDGET_KEYS)
		positiveInteger(recordData(budgets, key), `$input.request.budgets.${key}`);
	if (
		(recordData(budgets, 'maxExecutorDurationMs') as number) >
		GUARD_ENFORCEMENT_LEDGER_MAX_EXECUTOR_DURATION_MS
	)
		fail(
			'$input.request.budgets.maxExecutorDurationMs',
			'Executor duration exceeds the runtime timer representation limit.'
		);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function retainedEvidenceAcceptancePopulation(value: unknown): {
	readonly arrayEntries: number;
	readonly maximumDepth: number;
	readonly stringCharacters: number;
} {
	const stack: { readonly depth: number; readonly value: unknown }[] = [{ depth: 1, value }];
	let arrayEntries = 0;
	let maximumDepth = 1;
	let stringCharacters = 0;
	while (stack.length > 0) {
		const current = stack.pop()!;
		maximumDepth = Math.max(maximumDepth, current.depth);
		if (typeof current.value === 'string') {
			stringCharacters += current.value.length;
			continue;
		}
		if (current.value === null || typeof current.value !== 'object') continue;
		if (Array.isArray(current.value)) arrayEntries += current.value.length;
		for (const key of Reflect.ownKeys(current.value)) {
			if (key === 'length') continue;
			const descriptor = Reflect.getOwnPropertyDescriptor(current.value, key);
			if (descriptor !== undefined && 'value' in descriptor)
				stack.push({ depth: current.depth + 1, value: descriptor.value });
		}
	}
	return { arrayEntries, maximumDepth, stringCharacters };
}

function stringArray(value: unknown, path: string): readonly string[] {
	if (!Array.isArray(value)) fail(path, 'Expected an array.');
	for (const [index, item] of value.entries()) text(item, `${path}[${index}]`);
	for (let index = 1; index < value.length; index += 1)
		if (compareText(value[index - 1] as string, value[index] as string) >= 0)
			fail(path, 'Set-valued text population must be unique and canonically ordered.');
	return value as string[];
}

function compareTuple(left: readonly string[], right: readonly string[]): number {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const compared = compareText(left[index] ?? '', right[index] ?? '');
		if (compared !== 0) return compared;
	}
	return 0;
}

function assertExecutor(value: unknown): asserts value is GuardEnforcementLedgerExecutorIdentity {
	const path = '$input.executor';
	const executor = exactRecord(value, path, [
		'adapterId',
		'adapterVersion',
		'executableBytes',
		'executableSha256',
		'externalModules',
		'retainedAnalyzerCanonicalPathKey',
		'retainedAnalyzerSha256',
		'retainedDataCanonicalPathKey',
		'retainedDataSha256',
		'runtime',
		'runtimeVersion',
		'worker'
	]);
	if (recordData(executor, 'adapterId') !== GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID)
		fail(`${path}.adapterId`, 'Executor adapter identity is unsupported.');
	if (recordData(executor, 'adapterVersion') !== GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION)
		fail(`${path}.adapterVersion`, 'Executor adapter version is unsupported.');
	positiveInteger(recordData(executor, 'executableBytes'), `${path}.executableBytes`);
	digest(recordData(executor, 'executableSha256'), `${path}.executableSha256`);
	text(
		recordData(executor, 'retainedAnalyzerCanonicalPathKey'),
		`${path}.retainedAnalyzerCanonicalPathKey`
	);
	digest(recordData(executor, 'retainedAnalyzerSha256'), `${path}.retainedAnalyzerSha256`);
	text(
		recordData(executor, 'retainedDataCanonicalPathKey'),
		`${path}.retainedDataCanonicalPathKey`
	);
	digest(recordData(executor, 'retainedDataSha256'), `${path}.retainedDataSha256`);
	if (recordData(executor, 'runtime') !== 'bun')
		fail(`${path}.runtime`, 'Executor runtime must be Bun.');
	text(recordData(executor, 'runtimeVersion'), `${path}.runtimeVersion`);
	const worker = exactRecord(recordData(executor, 'worker'), `${path}.worker`, ['bytes', 'sha256']);
	positiveInteger(recordData(worker, 'bytes'), `${path}.worker.bytes`);
	digest(recordData(worker, 'sha256'), `${path}.worker.sha256`);
	const modules = recordData(executor, 'externalModules');
	if (!Array.isArray(modules) || modules.length !== 3)
		fail(`${path}.externalModules`, 'Expected exactly TypeScript, ULID, and Zod identities.');
	for (const [index, name] of ['typescript', 'ulid', 'zod'].entries()) {
		const modulePath = `${path}.externalModules[${index}]`;
		const module = exactRecord(modules[index], modulePath, [
			'bytes',
			'contentDigest',
			'files',
			'name',
			'version'
		]);
		if (recordData(module, 'name') !== name)
			fail(`${modulePath}.name`, 'External module population is incomplete or noncanonical.');
		positiveInteger(recordData(module, 'bytes'), `${modulePath}.bytes`);
		positiveInteger(recordData(module, 'files'), `${modulePath}.files`);
		digest(recordData(module, 'contentDigest'), `${modulePath}.contentDigest`);
		text(recordData(module, 'version'), `${modulePath}.version`);
	}
}

function assertRawEvidence(value: unknown): asserts value is GuardEnforcementLedgerRawEvidence {
	const root = exactRecord(value, '$input.evidence', [
		'analyzerPath',
		'audit',
		'dataPath',
		'guardTexts',
		'guardedArrows',
		'ledgerRows',
		'runtime',
		'schemaVersion'
	]);
	if (recordData(root, 'analyzerPath') !== GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH)
		fail('$input.evidence.analyzerPath', 'Raw evidence must use the retained analyzer path.');
	if (recordData(root, 'dataPath') !== GUARD_ENFORCEMENT_LEDGER_DATA_PATH)
		fail('$input.evidence.dataPath', 'Raw evidence must use the retained data path.');
	if (recordData(root, 'schemaVersion') !== GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION)
		fail('$input.evidence.schemaVersion', 'Unsupported worker evidence schema.');
	const runtime = exactRecord(recordData(root, 'runtime'), '$input.evidence.runtime', [
		'bunVersion'
	]);
	text(recordData(runtime, 'bunVersion'), '$input.evidence.runtime.bunVersion');

	const guardTexts = stringArray(recordData(root, 'guardTexts'), '$input.evidence.guardTexts');
	if (guardTexts.length === 0)
		fail('$input.evidence.guardTexts', 'Retained evidence must contain at least one guard text.');
	const guardTextSet = new Set(guardTexts);
	const arrows = recordData(root, 'guardedArrows');
	if (!Array.isArray(arrows)) fail('$input.evidence.guardedArrows', 'Expected an array.');
	if (arrows.length === 0)
		fail(
			'$input.evidence.guardedArrows',
			'Retained evidence must contain at least one guarded arrow.'
		);
	for (const [index, value] of arrows.entries()) {
		const path = `$input.evidence.guardedArrows[${index}]`;
		const arrow = exactRecord(value, path, ['from', 'guard', 'machine', 'to']);
		for (const key of ['from', 'guard', 'machine', 'to'])
			text(recordData(arrow, key), `${path}.${key}`);
		if (!guardTextSet.has(recordData(arrow, 'guard') as string))
			fail(`${path}.guard`, 'Arrow guard is absent from the distinct guard-text population.');
		if (index > 0) {
			const previous = arrows[
				index - 1
			] as GuardEnforcementLedgerRawEvidence['guardedArrows'][number];
			const current = value as GuardEnforcementLedgerRawEvidence['guardedArrows'][number];
			if (
				compareTuple(
					[previous.machine, previous.from, previous.to, previous.guard],
					[current.machine, current.from, current.to, current.guard]
				) > 0
			)
				fail('$input.evidence.guardedArrows', 'Arrow occurrences are not canonically ordered.');
		}
	}
	const arrowGuardTexts = [
		...new Set(
			(arrows as GuardEnforcementLedgerRawEvidence['guardedArrows']).map((arrow) => arrow.guard)
		)
	].sort(compareText);
	if (!sameStrings(guardTexts, arrowGuardTexts))
		fail(
			'$input.evidence.guardTexts',
			'Distinct guard texts must exactly equal the sorted unique guarded-arrow text population.'
		);

	const rows = recordData(root, 'ledgerRows');
	if (!Array.isArray(rows)) fail('$input.evidence.ledgerRows', 'Expected an array.');
	if (rows.length === 0)
		fail('$input.evidence.ledgerRows', 'Retained evidence must contain at least one ledger row.');
	for (const [index, value] of rows.entries()) {
		const path = `$input.evidence.ledgerRows[${index}]`;
		const row = exactRecord(value, path, [
			'disposition',
			'enforcingAnchor',
			'enforcingSite',
			'evidence',
			'guardText'
		]);
		disposition(recordData(row, 'disposition'), `${path}.disposition`);
		for (const key of ['enforcingAnchor', 'enforcingSite']) {
			const optional = recordData(row, key);
			if (optional !== null) text(optional, `${path}.${key}`);
		}
		text(recordData(row, 'evidence'), `${path}.evidence`);
		text(recordData(row, 'guardText'), `${path}.guardText`);
		if (
			index > 0 &&
			compareText(
				(rows[index - 1] as GuardEnforcementLedgerRawEvidence['ledgerRows'][number]).guardText,
				recordData(row, 'guardText') as string
			) >= 0
		)
			fail('$input.evidence.ledgerRows', 'Ledger rows must be unique and canonically ordered.');
	}

	const audit = exactRecord(recordData(root, 'audit'), '$input.evidence.audit', [
		'arrowCount',
		'counts',
		'enforcedAnchorBroken',
		'enforcedWithoutSite',
		'stale',
		'textCount',
		'unclassified'
	]);
	nonnegativeInteger(recordData(audit, 'arrowCount'), '$input.evidence.audit.arrowCount');
	nonnegativeInteger(recordData(audit, 'textCount'), '$input.evidence.audit.textCount');
	for (const key of ['enforcedAnchorBroken', 'enforcedWithoutSite', 'stale', 'unclassified'])
		stringArray(recordData(audit, key), `$input.evidence.audit.${key}`);
	const counts = recordData(audit, 'counts');
	if (!Array.isArray(counts)) fail('$input.evidence.audit.counts', 'Expected an array.');
	for (const [index, value] of counts.entries()) {
		const path = `$input.evidence.audit.counts[${index}]`;
		const count = exactRecord(value, path, ['count', 'disposition']);
		nonnegativeInteger(recordData(count, 'count'), `${path}.count`);
		disposition(recordData(count, 'disposition'), `${path}.disposition`);
		if (
			index > 0 &&
			compareText(
				(counts[index - 1] as { disposition: string }).disposition,
				recordData(count, 'disposition') as string
			) >= 0
		)
			fail('$input.evidence.audit.counts', 'Disposition counts are not canonically ordered.');
	}
}

export interface NormalizeGuardEnforcementLedgerInput {
	readonly artifactSet: GuardEnforcementLedgerArtifactSetBinding;
	readonly evidence: GuardEnforcementLedgerRawEvidence;
	readonly executor: GuardEnforcementLedgerExecutorIdentity;
	/** Exact successful worker stdout used only to enforce transport acceptance before projection. */
	readonly transportOutputBytes?: Uint8Array;
	/** Structural replay witness used only by public validation; never accepted with transport bytes. */
	readonly rawOutputIdentity?: GuardEnforcementLedgerRawOutputIdentity;
	readonly request: ObserveGuardEnforcementLedgerRequest;
}

function frozenLimitations(): typeof GUARD_ENFORCEMENT_LEDGER_LIMITATIONS {
	return Object.freeze(
		GUARD_ENFORCEMENT_LEDGER_LIMITATIONS.map((limitation) => Object.freeze({ ...limitation }))
	) as unknown as typeof GUARD_ENFORCEMENT_LEDGER_LIMITATIONS;
}

/** Pure, strict projection of retained worker evidence into the public CSAA contract. */
export function normalizeGuardEnforcementLedgerObservation(
	input: NormalizeGuardEnforcementLedgerInput
): GuardEnforcementLedgerObservation {
	const { artifactSet, evidence, executor, request } = input;
	assertRequest(request);
	assertExecutor(executor);
	assertRawEvidence(evidence);
	if (request.subjectId !== artifactSet.subjectId)
		fail('$input.request.subjectId', 'Request and artifact-set subjects differ.');
	if (request.artifactSetId !== artifactSet.id)
		fail('$input.request.artifactSetId', 'Request and artifact-set identities differ.');
	if (evidence.runtime.bunVersion !== executor.runtimeVersion)
		fail('$input.evidence.runtime.bunVersion', 'Raw evidence and executor Bun versions differ.');
	const analyzerBindings = artifactSet.artifacts.filter(
		(artifact) =>
			artifact.path === GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH &&
			artifact.uses.includes('ANALYZER_SOURCE')
	);
	const dataBindings = artifactSet.artifacts.filter(
		(artifact) =>
			artifact.path === GUARD_ENFORCEMENT_LEDGER_DATA_PATH && artifact.uses.includes('LEDGER_DATA')
	);
	if (analyzerBindings.length !== 1)
		fail('$input.artifactSet.artifacts', 'Expected exactly one retained analyzer binding.');
	if (dataBindings.length !== 1)
		fail('$input.artifactSet.artifacts', 'Expected exactly one retained ledger-data binding.');
	if (
		executor.retainedAnalyzerCanonicalPathKey !== analyzerBindings[0]!.canonicalPathKey ||
		executor.retainedAnalyzerSha256 !== analyzerBindings[0]!.sha256
	)
		fail(
			'$input.executor.retainedAnalyzerSha256',
			'Executor retained-analyzer identity does not bind the artifact set.'
		);
	if (
		executor.retainedDataCanonicalPathKey !== dataBindings[0]!.canonicalPathKey ||
		executor.retainedDataSha256 !== dataBindings[0]!.sha256
	)
		fail(
			'$input.executor.retainedDataSha256',
			'Executor retained-data identity does not bind the artifact set.'
		);

	const auditFindingCount =
		evidence.audit.enforcedAnchorBroken.length +
		evidence.audit.enforcedWithoutSite.length +
		evidence.audit.stale.length +
		evidence.audit.unclassified.length;
	for (const [value, maximum, path] of [
		[evidence.guardedArrows.length, request.budgets.maxGuardedArrows, 'maxGuardedArrows'],
		[evidence.guardTexts.length, request.budgets.maxGuardTexts, 'maxGuardTexts'],
		[evidence.ledgerRows.length, request.budgets.maxLedgerRows, 'maxLedgerRows'],
		[auditFindingCount, request.budgets.maxAuditEntries, 'maxAuditEntries']
	] as const)
		if (value > maximum)
			fail(
				`$input.request.budgets.${path}`,
				'Completed retained output exceeds the caller acceptance budget.'
			);
	if (artifactSet.artifacts.length > request.budgets.maxArtifacts)
		fail(
			'$input.request.budgets.maxArtifacts',
			'Bound artifact population exceeds the caller acceptance budget.'
		);
	const materializedBytes = artifactSet.coverage.totalBytes + executor.worker.bytes;
	if (
		!Number.isSafeInteger(materializedBytes) ||
		materializedBytes > request.budgets.maxMaterializedBytes
	)
		fail(
			'$input.request.budgets.maxMaterializedBytes',
			'Bound capsule bytes exceed the caller materialization budget.'
		);
	const externalModuleBytes = executor.externalModules.reduce(
		(sum, module) => sum + module.bytes,
		0
	);
	const externalModuleFiles = executor.externalModules.reduce(
		(sum, module) => sum + module.files,
		0
	);
	if (
		!Number.isSafeInteger(externalModuleBytes) ||
		externalModuleBytes > request.budgets.maxExternalModuleBytes
	)
		fail(
			'$input.request.budgets.maxExternalModuleBytes',
			'Bound external-module bytes exceed the caller environment-capture budget.'
		);
	if (
		!Number.isSafeInteger(externalModuleFiles) ||
		externalModuleFiles > request.budgets.maxExternalModuleFiles
	)
		fail(
			'$input.request.budgets.maxExternalModuleFiles',
			'Bound external-module files exceed the caller environment-capture budget.'
		);
	const acceptancePopulation = retainedEvidenceAcceptancePopulation(evidence);
	if (acceptancePopulation.arrayEntries > request.budgets.maxRawArrayEntries)
		fail(
			'$input.request.budgets.maxRawArrayEntries',
			'Sanitized evidence array entries exceed the caller post-execution acceptance budget.'
		);
	if (acceptancePopulation.maximumDepth > request.budgets.maxRawJsonDepth)
		fail(
			'$input.request.budgets.maxRawJsonDepth',
			'Sanitized evidence depth exceeds the caller post-execution acceptance budget.'
		);
	if (acceptancePopulation.stringCharacters > request.budgets.maxOutputStringCharacters)
		fail(
			'$input.request.budgets.maxOutputStringCharacters',
			'Sanitized evidence characters exceed the caller post-execution acceptance budget.'
		);

	const declared = new Set(evidence.guardTexts);
	const rowByText = new Map(evidence.ledgerRows.map((row) => [row.guardText, row]));
	const expectedUnclassified = evidence.guardTexts.filter((guardText) => !rowByText.has(guardText));
	const expectedStale = evidence.ledgerRows
		.filter((row) => !declared.has(row.guardText))
		.map((row) => row.guardText);
	const expectedWithoutSite = evidence.guardTexts.filter(
		(guardText) =>
			rowByText.get(guardText)?.disposition === 'ENFORCED' &&
			rowByText.get(guardText)?.enforcingSite === null
	);
	if (evidence.audit.arrowCount !== evidence.guardedArrows.length)
		fail('$input.evidence.audit.arrowCount', 'Audit arrow count does not reconcile.');
	if (evidence.audit.textCount !== evidence.guardTexts.length)
		fail('$input.evidence.audit.textCount', 'Audit text count does not reconcile.');
	if (!sameStrings(evidence.audit.unclassified, expectedUnclassified))
		fail('$input.evidence.audit.unclassified', 'Unclassified population does not reconcile.');
	if (!sameStrings(evidence.audit.stale, expectedStale))
		fail('$input.evidence.audit.stale', 'Stale-row population does not reconcile.');
	if (!sameStrings(evidence.audit.enforcedWithoutSite, expectedWithoutSite))
		fail(
			'$input.evidence.audit.enforcedWithoutSite',
			'Missing-site population does not reconcile.'
		);
	const expectedCounts = new Map<GuardEnforcementDisposition, number>();
	for (const guardText of evidence.guardTexts) {
		const row = rowByText.get(guardText);
		if (row !== undefined)
			expectedCounts.set(row.disposition, (expectedCounts.get(row.disposition) ?? 0) + 1);
	}
	const expectedCountRecords = [...expectedCounts]
		.sort(([left], [right]) => compareText(left, right))
		.map(([dispositionValue, count]) => ({ count, disposition: dispositionValue }));
	if (canonicalSemanticJson(evidence.audit.counts) !== canonicalSemanticJson(expectedCountRecords))
		fail(
			'$input.evidence.audit.counts',
			'Disposition counts do not reconcile with declared classifications.'
		);

	if ((input.transportOutputBytes === undefined) === (input.rawOutputIdentity === undefined))
		fail(
			'$input.transportOutputBytes',
			'Provide exactly one transport-byte or structural raw-output witness.'
		);
	let rawOutput: GuardEnforcementLedgerRawOutputIdentity;
	const evidenceWitness = canonicalSemanticJsonWitness(evidence);
	const evidenceContentDigest = evidenceWitness.sha256;
	const rawOutputBase = {
		bytes: evidenceWitness.bytes,
		evidenceContentDigest,
		schemaVersion: evidence.schemaVersion,
		sha256: evidenceWitness.sha256
	};
	if (input.transportOutputBytes !== undefined) {
		if (!(input.transportOutputBytes instanceof Uint8Array) || isProxy(input.transportOutputBytes))
			fail(
				'$input.transportOutputBytes',
				'Worker transport output must be a non-Proxy Uint8Array.'
			);
		if (input.transportOutputBytes.byteLength === 0)
			fail('$input.transportOutputBytes', 'Successful worker transport output must be nonempty.');
		if (input.transportOutputBytes.byteLength > request.budgets.maxStdoutBytes)
			fail(
				'$input.request.budgets.maxStdoutBytes',
				'Exact successful worker transport output exceeds the caller transport budget.'
			);
		rawOutput = { ...rawOutputBase, id: guardEnforcementLedgerRawOutputId(rawOutputBase) };
	} else {
		const witness = input.rawOutputIdentity!;
		positiveInteger(witness.bytes, '$input.rawOutputIdentity.bytes');
		digest(witness.evidenceContentDigest, '$input.rawOutputIdentity.evidenceContentDigest');
		digest(witness.sha256, '$input.rawOutputIdentity.sha256');
		if (witness.evidenceContentDigest !== evidenceContentDigest)
			fail(
				'$input.rawOutputIdentity.evidenceContentDigest',
				'Raw-output evidence projection digest does not reproduce.'
			);
		if (witness.schemaVersion !== evidence.schemaVersion)
			fail('$input.rawOutputIdentity.schemaVersion', 'Raw-output and evidence schemas differ.');
		if (witness.bytes !== rawOutputBase.bytes || witness.sha256 !== rawOutputBase.sha256)
			fail(
				'$input.rawOutputIdentity.sha256',
				'Canonical raw-evidence output identity does not reproduce.'
			);
		if (
			witness.id !==
			guardEnforcementLedgerRawOutputId({
				bytes: witness.bytes,
				evidenceContentDigest: witness.evidenceContentDigest,
				schemaVersion: witness.schemaVersion,
				sha256: witness.sha256
			})
		)
			fail('$input.rawOutputIdentity.id', 'Raw-output identity does not reproduce.');
		rawOutput = witness;
	}
	if (rawOutput.bytes > request.budgets.maxStdoutBytes)
		fail(
			'$input.request.budgets.maxStdoutBytes',
			'Canonical raw evidence exceeds the stdout budget and could not derive from accepted transport output.'
		);
	const observationId = guardEnforcementLedgerObservationId({
		artifactSetId: artifactSet.id,
		canonicalProfile: GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE,
		executor,
		method: GUARD_ENFORCEMENT_LEDGER_METHOD,
		operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		rawOutputId: rawOutput.id,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_SCHEMA_VERSION,
		subjectId: request.subjectId
	});

	const allGuardTexts = [
		...new Set([...evidence.guardTexts, ...evidence.ledgerRows.map((row) => row.guardText)])
	].sort(compareText);
	const guardIdByText = new Map(
		allGuardTexts.map((guardText) => [
			guardText,
			guardEnforcementLedgerGuardId(observationId, guardText)
		])
	);
	const guardedArrows = evidence.guardedArrows.map((arrow, ordinal) => {
		const guardId = guardIdByText.get(arrow.guard)!;
		return {
			from: arrow.from,
			guardId,
			guardText: arrow.guard,
			id: guardEnforcementLedgerArrowId(observationId, ordinal, arrow),
			machine: arrow.machine,
			ordinal,
			to: arrow.to
		};
	});
	const arrowIdsByGuard = new Map<string, GuardEnforcementLedgerArrowId[]>();
	for (const arrow of guardedArrows) {
		const ids = arrowIdsByGuard.get(arrow.guardText) ?? [];
		ids.push(arrow.id);
		arrowIdsByGuard.set(arrow.guardText, ids);
	}
	const guards = allGuardTexts.map((guardText) => {
		const row = rowByText.get(guardText);
		const isDeclared = declared.has(guardText);
		return {
			arrowIds: arrowIdsByGuard.get(guardText) ?? [],
			disposition: row?.disposition ?? null,
			enforcingAnchor: row?.enforcingAnchor ?? null,
			enforcingSite: row?.enforcingSite ?? null,
			evidence: row?.evidence ?? null,
			guardText,
			id: guardIdByText.get(guardText)!,
			ledgerState: isDeclared
				? row === undefined
					? ('UNCLASSIFIED' as const)
					: ('CLASSIFIED' as const)
				: ('STALE' as const)
		};
	});

	const content = {
		artifactSet,
		authorityTransfer: GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER,
		baselineChange: GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE,
		budgets: request.budgets,
		canonicalProfile: GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE,
		coverage: {
			arrowOccurrences: guardedArrows.length,
			classifiedGuardTexts: evidence.guardTexts.length - expectedUnclassified.length,
			distinctGuardTexts: evidence.guardTexts.length,
			enforcedAnchorBroken: evidence.audit.enforcedAnchorBroken.length,
			enforcedWithoutSite: evidence.audit.enforcedWithoutSite.length,
			ledgerRows: evidence.ledgerRows.length,
			reconciles: true,
			staleLedgerRows: expectedStale.length,
			unclassifiedGuardTexts: expectedUnclassified.length
		},
		executor,
		gateEffect: GUARD_ENFORCEMENT_LEDGER_GATE_EFFECT,
		guardedArrows,
		guards,
		health: 'PARTIAL' as const,
		id: observationId,
		integrationStrategy: GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
		limitations: frozenLimitations(),
		method: GUARD_ENFORCEMENT_LEDGER_METHOD,
		operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		oracleChange: GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE,
		rawEvidence: evidence,
		rawOutput,
		replacementEquivalence: GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE,
		retainedTestExecution: GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION,
		runtimeEnforcement: GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_SCHEMA_VERSION,
		subjectId: request.subjectId,
		verifierAuthority: GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY
	};
	return {
		...content,
		contentDigest: guardEnforcementLedgerObservationContentDigest(content)
	};
}
