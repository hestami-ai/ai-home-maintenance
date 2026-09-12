import { compareText, sha256 } from '../../inventory/canonical.js';
import {
	denseArray,
	importProviderJson,
	optionalRecord,
	providerArtifactPath,
	safeInteger,
	scalarString,
	type ProviderEvidenceResult,
	type ProviderImportContext,
	type ProviderNormalization
} from '../runtime/provider-evidence.js';

export const VITEST_JSON_PROVIDER_ID = 'vitest' as const;
export const VITEST_JSON_PROVIDER_VERSION = '4.1.10' as const;
export const VITEST_JSON_ADAPTER_ID = 'jan-csaa-vitest-json-import' as const;
export const VITEST_JSON_ADAPTER_VERSION = '1.0.0' as const;

export type VitestAssertionState = 'FAILED' | 'PASSED' | 'SKIPPED' | 'TODO';

export interface VitestAssertionObservation {
	readonly durationMs: number | null;
	readonly failureMessageSha256s: readonly string[];
	readonly fullName: string;
	readonly location: { readonly column: number; readonly line: number } | null;
	readonly state: VitestAssertionState;
	readonly title: string;
}

export interface VitestFileObservation {
	readonly assertions: readonly VitestAssertionObservation[];
	readonly endedAtMs: number;
	readonly path: string;
	readonly startedAtMs: number;
	readonly state: 'FAILED' | 'PASSED';
}

const ROOT_REQUIRED = [
	'numFailedTestSuites',
	'numFailedTests',
	'numPassedTestSuites',
	'numPassedTests',
	'numPendingTestSuites',
	'numPendingTests',
	'numRuntimeErrorTestSuites',
	'numTotalTestSuites',
	'numTotalTests',
	'startTime',
	'success',
	'testResults'
] as const;
const ROOT_OPTIONAL = ['snapshot', 'wasInterrupted'] as const;
const FILE_REQUIRED = [
	'assertionResults',
	'endTime',
	'message',
	'name',
	'startTime',
	'status'
] as const;
const FILE_OPTIONAL = ['coverage', 'perfStats', 'summary'] as const;
const ASSERTION_REQUIRED = [
	'ancestorTitles',
	'duration',
	'failureMessages',
	'fullName',
	'status',
	'title'
] as const;
const ASSERTION_OPTIONAL = ['location', 'meta'] as const;

function redactedText(value: unknown, label: string, max: number): string {
	if (typeof value !== 'string' || value.length > max)
		throw new TypeError(`${label} must be a bounded string.`);
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code === 0 || code === 0x7f || (code < 0x20 && code !== 9 && code !== 10 && code !== 13))
			throw new TypeError(`${label} contains an unsupported control character.`);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff))
				throw new TypeError(`${label} contains an unpaired surrogate.`);
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff)
			throw new TypeError(`${label} contains an unpaired surrogate.`);
	}
	return value;
}

function assertionState(value: unknown): VitestAssertionState {
	if (value === 'passed') return 'PASSED';
	if (value === 'failed') return 'FAILED';
	if (value === 'todo') return 'TODO';
	if (value === 'pending' || value === 'skipped' || value === 'disabled') return 'SKIPPED';
	throw new TypeError('Vitest assertion has an unsupported status.');
}

function normalizeAssertion(value: unknown, index: number): VitestAssertionObservation {
	const record = optionalRecord(
		value,
		ASSERTION_REQUIRED,
		ASSERTION_OPTIONAL,
		`Vitest assertion ${index}`
	);
	for (const [ancestorIndex, ancestor] of denseArray(
		record.ancestorTitles,
		`Vitest assertion ${index} ancestorTitles`,
		128
	).entries())
		scalarString(ancestor, `Vitest assertion ${index} ancestor ${ancestorIndex}`, 4_096);
	const failures = denseArray(
		record.failureMessages,
		`Vitest assertion ${index} failureMessages`,
		1_000
	).map((failure, failureIndex) =>
		sha256(redactedText(failure, `Vitest failure ${failureIndex}`, 256 * 1024))
	);
	let location: { readonly column: number; readonly line: number } | null = null;
	if (record.location !== undefined && record.location !== null) {
		const rawLocation = optionalRecord(
			record.location,
			['column', 'line'],
			[],
			`Vitest assertion ${index} location`
		);
		location = Object.freeze({
			column: safeInteger(rawLocation.column, 'Vitest location column', 1),
			line: safeInteger(rawLocation.line, 'Vitest location line', 1)
		});
	}
	const duration = record.duration;
	if (
		duration !== null &&
		(typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0)
	)
		throw new TypeError('Vitest assertion duration must be null or a nonnegative finite number.');
	return Object.freeze({
		durationMs: duration,
		failureMessageSha256s: Object.freeze(failures),
		fullName: scalarString(record.fullName, `Vitest assertion ${index} fullName`, 16_384),
		location,
		state: assertionState(record.status),
		title: scalarString(record.title, `Vitest assertion ${index} title`, 4_096)
	});
}

function normalizeVitest(
	value: unknown,
	context: ProviderImportContext
): ProviderNormalization<VitestFileObservation> {
	const root = optionalRecord(value, ROOT_REQUIRED, ROOT_OPTIONAL, 'Vitest JSON root');
	const subjectPaths = new Set(context.subject.artifacts.map((artifact) => artifact.path));
	const files: VitestFileObservation[] = [];
	const redactions = new Set<string>(['VITEST_FAILURE_AND_FILE_MESSAGE_TEXT']);
	const seen = new Set<string>();
	for (const [fileIndex, rawFile] of denseArray(root.testResults, 'Vitest testResults').entries()) {
		const file = optionalRecord(rawFile, FILE_REQUIRED, FILE_OPTIONAL, `Vitest file ${fileIndex}`);
		const path = providerArtifactPath(file.name, context.repositoryRoot);
		if (!subjectPaths.has(path))
			throw new TypeError('Vitest output identifies a file outside the selected FrozenSubject.');
		if (seen.has(path)) throw new TypeError('Vitest output contains duplicate file results.');
		seen.add(path);
		const assertions = denseArray(file.assertionResults, `Vitest file ${fileIndex} assertions`).map(
			(assertion, assertionIndex) => normalizeAssertion(assertion, assertionIndex)
		);
		const state = file.status === 'passed' ? 'PASSED' : file.status === 'failed' ? 'FAILED' : null;
		if (state === null) throw new TypeError('Vitest file has an unsupported status.');
		const startedAtMs = safeInteger(file.startTime, `Vitest file ${fileIndex} startTime`);
		const endedAtMs = safeInteger(file.endTime, `Vitest file ${fileIndex} endTime`);
		if (endedAtMs < startedAtMs) throw new TypeError('Vitest file timestamps are not ordered.');
		redactedText(file.message, `Vitest file ${fileIndex} message`, 256 * 1024);
		for (const key of ['coverage', 'perfStats', 'summary'] as const)
			if (file[key] !== undefined) redactions.add(`VITEST_${key.toUpperCase()}_PAYLOAD`);
		files.push(
			Object.freeze({
				assertions: Object.freeze(assertions),
				endedAtMs,
				path,
				startedAtMs,
				state
			})
		);
	}
	files.sort((left, right) => compareText(left.path, right.path));
	const totals = {
		failedSuites: safeInteger(root.numFailedTestSuites, 'Vitest failed suite count'),
		failedTests: safeInteger(root.numFailedTests, 'Vitest failed test count'),
		passedSuites: safeInteger(root.numPassedTestSuites, 'Vitest passed suite count'),
		passedTests: safeInteger(root.numPassedTests, 'Vitest passed test count'),
		pendingSuites: safeInteger(root.numPendingTestSuites, 'Vitest pending suite count'),
		pendingTests: safeInteger(root.numPendingTests, 'Vitest pending test count'),
		runtimeErrors: safeInteger(root.numRuntimeErrorTestSuites, 'Vitest runtime error suite count'),
		totalSuites: safeInteger(root.numTotalTestSuites, 'Vitest total suite count'),
		totalTests: safeInteger(root.numTotalTests, 'Vitest total test count')
	};
	const observed = files.flatMap((file) => file.assertions);
	if (
		totals.totalSuites !== totals.failedSuites + totals.passedSuites + totals.pendingSuites ||
		totals.totalTests !== totals.failedTests + totals.passedTests + totals.pendingTests ||
		totals.failedTests !== observed.filter((assertion) => assertion.state === 'FAILED').length ||
		totals.passedTests !== observed.filter((assertion) => assertion.state === 'PASSED').length ||
		totals.pendingTests !==
			observed.filter((assertion) => assertion.state === 'SKIPPED' || assertion.state === 'TODO')
				.length
	)
		throw new TypeError('Vitest aggregate counters do not reconcile with file results.');
	if (typeof root.success !== 'boolean') throw new TypeError('Vitest success must be boolean.');
	if (root.snapshot !== undefined) redactions.add('VITEST_SNAPSHOT_PAYLOAD');
	const interrupted = root.wasInterrupted === undefined ? false : root.wasInterrupted;
	if (typeof interrupted !== 'boolean')
		throw new TypeError('Vitest wasInterrupted must be boolean.');
	if (root.success !== (totals.failedTests === 0 && totals.runtimeErrors === 0 && !interrupted))
		throw new TypeError('Vitest success does not reconcile with failures and interruption.');
	safeInteger(root.startTime, 'Vitest run startTime');
	return {
		completedRegions: files.map((file) => file.path),
		missingRegions:
			files.length === 0 || totals.totalTests === 0 ? ['VITEST_TEST_POPULATION_UNPROVEN'] : [],
		observations: files,
		redactions: [...redactions]
	};
}

export function importVitestJson(
	raw: string | Uint8Array | null,
	context: ProviderImportContext
): ProviderEvidenceResult<VitestFileObservation> {
	return importProviderJson({
		adapterId: VITEST_JSON_ADAPTER_ID,
		adapterVersion: VITEST_JSON_ADAPTER_VERSION,
		context,
		expectedProviderId: VITEST_JSON_PROVIDER_ID,
		normalize: normalizeVitest,
		raw,
		supportedProviderVersions: [VITEST_JSON_PROVIDER_VERSION]
	});
}
