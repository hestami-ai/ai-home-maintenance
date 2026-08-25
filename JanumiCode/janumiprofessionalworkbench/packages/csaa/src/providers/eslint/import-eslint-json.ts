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

export const ESLINT_JSON_PROVIDER_ID = 'eslint' as const;
export const ESLINT_JSON_PROVIDER_VERSION = '9.39.5' as const;
export const ESLINT_JSON_ADAPTER_ID = 'jan-csaa-eslint-json-import' as const;
export const ESLINT_JSON_ADAPTER_VERSION = '1.0.0' as const;

export interface EslintMessageObservation {
	readonly column: number;
	readonly endColumn: number | null;
	readonly endLine: number | null;
	readonly fatal: boolean;
	readonly line: number;
	readonly messageId: string | null;
	readonly messageSha256: string;
	readonly nodeType: string | null;
	readonly path: string;
	readonly ruleId: string | null;
	readonly severity: 1 | 2;
}

export interface EslintFileObservation {
	readonly errorCount: number;
	readonly fatalErrorCount: number;
	readonly fixableErrorCount: number;
	readonly fixableWarningCount: number;
	readonly messages: readonly EslintMessageObservation[];
	readonly path: string;
	readonly warningCount: number;
}

const FILE_REQUIRED_KEYS = [
	'errorCount',
	'fatalErrorCount',
	'filePath',
	'fixableErrorCount',
	'fixableWarningCount',
	'messages',
	'warningCount'
] as const;
const FILE_OPTIONAL_KEYS = ['source', 'suppressedMessages', 'usedDeprecatedRules'] as const;
const MESSAGE_REQUIRED_KEYS = ['column', 'line', 'message', 'ruleId', 'severity'] as const;
const MESSAGE_OPTIONAL_KEYS = [
	'endColumn',
	'endLine',
	'fatal',
	'fix',
	'messageId',
	'nodeType',
	'suggestions'
] as const;

function nullableString(value: unknown, label: string): string | null {
	return value === null ? null : scalarString(value, label, 1_024);
}

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

function optionalPositiveInteger(value: unknown, label: string): number | null {
	return value === undefined ? null : safeInteger(value, label, 1);
}

function normalizeMessage(
	value: unknown,
	path: string,
	index: number
): { readonly observation: EslintMessageObservation; readonly redacted: boolean } {
	const record = optionalRecord(
		value,
		MESSAGE_REQUIRED_KEYS,
		MESSAGE_OPTIONAL_KEYS,
		`ESLint message ${index}`
	);
	const severity = safeInteger(record.severity, `ESLint message ${index} severity`, 1);
	if (severity !== 1 && severity !== 2)
		throw new TypeError('ESLint message severity must be 1 or 2.');
	const message = redactedText(record.message, `ESLint message ${index} text`, 64 * 1024);
	const fatal = record.fatal === undefined ? false : record.fatal;
	if (typeof fatal !== 'boolean') throw new TypeError('ESLint fatal marker must be boolean.');
	const line = safeInteger(record.line, `ESLint message ${index} line`, 1);
	const column = safeInteger(record.column, `ESLint message ${index} column`, 1);
	const endLine = optionalPositiveInteger(record.endLine, `ESLint message ${index} endLine`);
	const endColumn = optionalPositiveInteger(record.endColumn, `ESLint message ${index} endColumn`);
	if (
		endLine !== null &&
		(endLine < line || (endLine === line && endColumn !== null && endColumn < column))
	)
		throw new TypeError('ESLint message end location precedes its start location.');
	return {
		observation: Object.freeze({
			column,
			endColumn,
			endLine,
			fatal,
			line,
			messageId:
				record.messageId === undefined
					? null
					: nullableString(record.messageId, `ESLint message ${index} messageId`),
			messageSha256: sha256(message),
			nodeType:
				record.nodeType === undefined
					? null
					: nullableString(record.nodeType, `ESLint message ${index} nodeType`),
			path,
			ruleId: nullableString(record.ruleId, `ESLint message ${index} ruleId`),
			severity
		}),
		redacted: record.fix !== undefined || record.suggestions !== undefined || message.length > 0
	};
}

function normalizeEslint(
	value: unknown,
	context: ProviderImportContext
): ProviderNormalization<EslintFileObservation> {
	const subjectPaths = new Set(context.subject.artifacts.map((artifact) => artifact.path));
	const reports = denseArray(value, 'ESLint JSON root');
	const observations: EslintFileObservation[] = [];
	const redactions = new Set<string>();
	const seen = new Set<string>();
	for (let fileIndex = 0; fileIndex < reports.length; fileIndex += 1) {
		const record = optionalRecord(
			reports[fileIndex],
			FILE_REQUIRED_KEYS,
			FILE_OPTIONAL_KEYS,
			`ESLint result ${fileIndex}`
		);
		const path = providerArtifactPath(record.filePath, context.repositoryRoot);
		if (!subjectPaths.has(path))
			throw new TypeError('ESLint output identifies a file outside the selected FrozenSubject.');
		if (seen.has(path)) throw new TypeError('ESLint output contains duplicate file results.');
		seen.add(path);
		const messages = denseArray(
			record.messages,
			`ESLint result ${fileIndex} messages`,
			100_000
		).map((message, messageIndex) => normalizeMessage(message, path, messageIndex));
		if (messages.some((message) => message.redacted))
			redactions.add('ESLINT_MESSAGE_TEXT_AND_FIX_PAYLOAD');
		if (record.source !== undefined) {
			redactedText(record.source, `ESLint result ${fileIndex} source`, 8 * 1024 * 1024);
			redactions.add('ESLINT_SOURCE_TEXT');
		}
		if (record.suppressedMessages !== undefined) {
			denseArray(record.suppressedMessages, `ESLint result ${fileIndex} suppressedMessages`);
			redactions.add('ESLINT_SUPPRESSED_MESSAGE_PAYLOAD');
		}
		if (record.usedDeprecatedRules !== undefined)
			denseArray(record.usedDeprecatedRules, `ESLint result ${fileIndex} usedDeprecatedRules`);
		const errorCount = safeInteger(record.errorCount, `ESLint result ${fileIndex} errorCount`);
		const warningCount = safeInteger(
			record.warningCount,
			`ESLint result ${fileIndex} warningCount`
		);
		const fatalErrorCount = safeInteger(
			record.fatalErrorCount,
			`ESLint result ${fileIndex} fatalErrorCount`
		);
		const observedErrors = messages.filter((message) => message.observation.severity === 2).length;
		const observedWarnings = messages.filter(
			(message) => message.observation.severity === 1
		).length;
		const observedFatal = messages.filter((message) => message.observation.fatal).length;
		if (
			errorCount !== observedErrors ||
			warningCount !== observedWarnings ||
			fatalErrorCount !== observedFatal
		)
			throw new TypeError('ESLint result counters do not reconcile with messages.');
		const fixableErrorCount = safeInteger(
			record.fixableErrorCount,
			`ESLint result ${fileIndex} fixableErrorCount`
		);
		const fixableWarningCount = safeInteger(
			record.fixableWarningCount,
			`ESLint result ${fileIndex} fixableWarningCount`
		);
		if (fixableErrorCount > errorCount || fixableWarningCount > warningCount)
			throw new TypeError('ESLint fixable counters exceed their severity totals.');
		observations.push(
			Object.freeze({
				errorCount,
				fatalErrorCount,
				fixableErrorCount,
				fixableWarningCount,
				messages: Object.freeze(messages.map((message) => message.observation)),
				path,
				warningCount
			})
		);
	}
	observations.sort((left, right) => compareText(left.path, right.path));
	return {
		completedRegions: observations.map((observation) => observation.path),
		missingRegions: observations.length === 0 ? ['ESLINT_SELECTED_FILE_POPULATION_UNPROVEN'] : [],
		observations,
		redactions: [...redactions]
	};
}

export function importEslintJson(
	raw: string | Uint8Array | null,
	context: ProviderImportContext
): ProviderEvidenceResult<EslintFileObservation> {
	return importProviderJson({
		adapterId: ESLINT_JSON_ADAPTER_ID,
		adapterVersion: ESLINT_JSON_ADAPTER_VERSION,
		context,
		expectedProviderId: ESLINT_JSON_PROVIDER_ID,
		normalize: normalizeEslint,
		raw,
		supportedProviderVersions: [ESLINT_JSON_PROVIDER_VERSION]
	});
}
