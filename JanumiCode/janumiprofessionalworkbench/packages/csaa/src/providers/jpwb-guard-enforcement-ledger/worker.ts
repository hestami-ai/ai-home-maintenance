import { realpathSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { GuardEnforcementDisposition } from '../../contracts/guard-enforcement-ledger.js';

export const GUARD_ENFORCEMENT_LEDGER_WORKER_REQUEST_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-worker-request/1.0.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-worker-result/1.0.0' as const;

export const GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH = 'verif/guard-enforcement-ledger.ts' as const;
export const GUARD_ENFORCEMENT_LEDGER_DATA_PATH = 'verif/guard-enforcement-ledger.data.ts' as const;

export const GUARD_ENFORCEMENT_LEDGER_DISPOSITIONS = [
	'ARROW_UNREACHABLE',
	'ENFORCED',
	'NOT_MECHANICALLY_CHECKABLE',
	'REDUNDANT_WITH_MACHINE',
	'UNENFORCED'
] as const;

export type GuardEnforcementLedgerDisposition = GuardEnforcementDisposition;

export interface GuardEnforcementLedgerWorkerRequest {
	readonly analyzerPath: string;
	readonly capsuleRoot: string;
	readonly dataPath: string;
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_WORKER_REQUEST_SCHEMA_VERSION;
}

export interface GuardEnforcementLedgerWorkerArrow {
	readonly from: string;
	readonly guard: string;
	readonly machine: string;
	readonly to: string;
}

export interface GuardEnforcementLedgerWorkerRow {
	readonly disposition: GuardEnforcementLedgerDisposition;
	readonly enforcingAnchor: string | null;
	readonly enforcingSite: string | null;
	readonly evidence: string;
	readonly guardText: string;
}

export interface GuardEnforcementLedgerWorkerCount {
	readonly count: number;
	readonly disposition: GuardEnforcementLedgerDisposition;
}

export interface GuardEnforcementLedgerWorkerAudit {
	readonly arrowCount: number;
	readonly counts: readonly GuardEnforcementLedgerWorkerCount[];
	readonly enforcedAnchorBroken: readonly string[];
	readonly enforcedWithoutSite: readonly string[];
	readonly stale: readonly string[];
	readonly textCount: number;
	readonly unclassified: readonly string[];
}

export interface GuardEnforcementLedgerWorkerResult {
	readonly analyzerResolvedPath: string;
	readonly audit: GuardEnforcementLedgerWorkerAudit;
	readonly contractsResolvedPath: string;
	readonly dataResolvedPath: string;
	readonly domainResolvedPath: string;
	readonly guardTexts: readonly string[];
	readonly guardedArrows: readonly GuardEnforcementLedgerWorkerArrow[];
	readonly ledgerRows: readonly GuardEnforcementLedgerWorkerRow[];
	readonly runtime: {
		readonly bunVersion: string;
		readonly typescriptResolvedPath: string;
		readonly typescriptVersion: string;
		readonly ulidResolvedPath: string;
		readonly ulidVersion: string;
		readonly zodResolvedPath: string;
		readonly zodVersion: string;
	};
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION;
}

interface BunRuntime {
	readonly version: string;
	resolveSync(specifier: string, from: string): string;
}

interface RetainedAnalyzerModule {
	auditLedger(ledger: unknown): unknown;
	guardTexts(): unknown;
	guardedArrows(): unknown;
}

interface RetainedDataModule {
	readonly GUARD_LEDGER: unknown;
}

type JsonRecord = Record<string, unknown>;

const DISPOSITIONS = new Set<string>(GUARD_ENFORCEMENT_LEDGER_DISPOSITIONS);

function fail(message: string): never {
	throw new Error(`guard-enforcement-ledger worker: ${message}`);
}

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

function compareTuple(left: readonly string[], right: readonly string[]): number {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const comparison = compareText(left[index] ?? '', right[index] ?? '');
		if (comparison !== 0) return comparison;
	}
	return 0;
}

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

function requireExactKeys(value: JsonRecord, expected: readonly string[], label: string): void {
	const actual = Object.keys(value).sort(compareText);
	const canonicalExpected = [...expected].sort(compareText);
	if (
		actual.length !== canonicalExpected.length ||
		actual.some((key, index) => key !== canonicalExpected[index])
	)
		fail(`${label} must contain exactly: ${canonicalExpected.join(', ')}`);
}

function requireString(value: unknown, label: string, nonempty = true): string {
	if (typeof value !== 'string' || (nonempty && value.length === 0) || value.includes('\0'))
		fail(`${label} must be ${nonempty ? 'a non-empty ' : ''}string without NUL characters`);
	return value;
}

function requireInteger(value: unknown, label: string): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0)
		fail(`${label} must be a non-negative safe integer`);
	return value as number;
}

function decodeUtf8(bytes: Uint8Array, label: string): string {
	try {
		const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
		if (text.charCodeAt(0) === 0xfeff) fail(`${label} must not contain a UTF-8 BOM`);
		return text;
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('guard-enforcement-ledger worker:'))
			throw error;
		return fail(`${label} is not valid UTF-8`);
	}
}

export function parseGuardEnforcementLedgerWorkerRequest(
	inputBytes: Uint8Array
): GuardEnforcementLedgerWorkerRequest {
	let parsed: unknown;
	try {
		parsed = JSON.parse(decodeUtf8(inputBytes, 'request'));
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('guard-enforcement-ledger worker:'))
			throw error;
		return fail('request must be exactly one valid JSON value');
	}
	if (!isRecord(parsed)) fail('request must be a JSON object');
	requireExactKeys(parsed, ['analyzerPath', 'capsuleRoot', 'dataPath', 'schemaVersion'], 'request');
	if (parsed.schemaVersion !== GUARD_ENFORCEMENT_LEDGER_WORKER_REQUEST_SCHEMA_VERSION)
		fail(`unsupported request schemaVersion: ${String(parsed.schemaVersion)}`);
	return {
		analyzerPath: requireString(parsed.analyzerPath, 'request.analyzerPath'),
		capsuleRoot: requireString(parsed.capsuleRoot, 'request.capsuleRoot'),
		dataPath: requireString(parsed.dataPath, 'request.dataPath'),
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_REQUEST_SCHEMA_VERSION
	};
}

function canonicalExistingPath(path: string, label: string): string {
	try {
		return realpathSync.native(path);
	} catch {
		return fail(`${label} does not resolve to an existing path`);
	}
}

function requireDirectory(path: string, label: string): void {
	if (!statSync(path).isDirectory()) fail(`${label} must resolve to a directory`);
}

function requireFile(path: string, label: string): void {
	if (!statSync(path).isFile()) fail(`${label} must resolve to a regular file`);
}

function requireContained(capsuleRoot: string, candidate: string, label: string): void {
	const pathFromRoot = relative(capsuleRoot, candidate);
	if (
		pathFromRoot === '' ||
		pathFromRoot === '..' ||
		pathFromRoot.startsWith(`..${sep}`) ||
		isAbsolute(pathFromRoot)
	)
		fail(`${label} must resolve to a file inside capsuleRoot`);
}

function capsuleRelativePath(capsuleRoot: string, candidate: string, label: string): string {
	requireContained(capsuleRoot, candidate, label);
	return relative(capsuleRoot, candidate).replaceAll('\\', '/');
}

function requireBunRuntime(): BunRuntime {
	const candidate = (globalThis as { Bun?: unknown }).Bun;
	if (
		!isRecord(candidate) ||
		typeof candidate.version !== 'string' ||
		typeof candidate.resolveSync !== 'function'
	)
		fail('this worker must execute under Bun with Bun.resolveSync available');
	return candidate as unknown as BunRuntime;
}

function canonicalResolvedModulePath(
	bun: BunRuntime,
	specifier: string,
	from: string,
	label: string
): string {
	let resolvedPath: string;
	try {
		const resolution = bun.resolveSync(specifier, from);
		resolvedPath = resolution.startsWith('file:') ? fileURLToPath(resolution) : resolution;
	} catch {
		return fail(`${label} cannot be resolved from the retained analyzer`);
	}
	const canonicalPath = canonicalExistingPath(resolvedPath, label);
	requireFile(canonicalPath, label);
	return canonicalPath;
}

function packageVersion(bun: BunRuntime, packageName: string, from: string): string {
	const packageJsonPath = canonicalResolvedModulePath(
		bun,
		`${packageName}/package.json`,
		from,
		`${packageName}/package.json`
	);
	let value: unknown;
	try {
		value = JSON.parse(decodeUtf8(readFileSync(packageJsonPath), `${packageName}/package.json`));
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('guard-enforcement-ledger worker:'))
			throw error;
		return fail(`${packageName}/package.json must contain exactly one valid JSON value`);
	}
	if (!isRecord(value)) fail(`${packageName}/package.json must be a JSON object`);
	return requireString(value.version, `${packageName}/package.json version`);
}

function requireAnalyzer(value: unknown): RetainedAnalyzerModule {
	if (!isRecord(value)) fail('retained analyzer module namespace must be an object');
	for (const name of ['auditLedger', 'guardTexts', 'guardedArrows'] as const)
		if (typeof value[name] !== 'function') fail(`retained analyzer must export function ${name}()`);
	return value as unknown as RetainedAnalyzerModule;
}

function requireData(value: unknown): RetainedDataModule {
	if (!isRecord(value)) fail('retained data module namespace must be an object');
	if (!Object.prototype.hasOwnProperty.call(value, 'GUARD_LEDGER'))
		fail('retained data must export GUARD_LEDGER');
	return value as unknown as RetainedDataModule;
}

function parseDisposition(value: unknown, label: string): GuardEnforcementLedgerDisposition {
	if (typeof value !== 'string' || !DISPOSITIONS.has(value))
		fail(`${label} must be a recognized guard disposition`);
	return value as GuardEnforcementLedgerDisposition;
}

function parseStringArray(value: unknown, label: string): string[] {
	if (!Array.isArray(value)) fail(`${label} must be an array`);
	const result = value.map((entry, index) => requireString(entry, `${label}[${index}]`, false));
	result.sort(compareText);
	return result;
}

function parseGuardedArrows(value: unknown): GuardEnforcementLedgerWorkerArrow[] {
	if (!Array.isArray(value)) fail('guardedArrows() must return an array');
	const result = value.map((entry, index) => {
		const label = `guardedArrows()[${index}]`;
		if (!isRecord(entry)) fail(`${label} must be an object`);
		requireExactKeys(entry, ['from', 'guard', 'machine', 'to'], label);
		return {
			from: requireString(entry.from, `${label}.from`),
			guard: requireString(entry.guard, `${label}.guard`),
			machine: requireString(entry.machine, `${label}.machine`),
			to: requireString(entry.to, `${label}.to`)
		};
	});
	result.sort((left, right) =>
		compareTuple(
			[left.machine, left.from, left.to, left.guard],
			[right.machine, right.from, right.to, right.guard]
		)
	);
	return result;
}

function parseLedgerRows(value: unknown): GuardEnforcementLedgerWorkerRow[] {
	if (!isRecord(value)) fail('GUARD_LEDGER must be an object');
	const rows: GuardEnforcementLedgerWorkerRow[] = [];
	for (const guardText of Object.keys(value).sort(compareText)) {
		const label = `GUARD_LEDGER[${JSON.stringify(guardText)}]`;
		const entry = value[guardText];
		if (!isRecord(entry)) fail(`${label} must be an object`);
		const allowedKeys = ['disposition', 'enforcingAnchor', 'enforcingSite', 'evidence'];
		const actualKeys = Object.keys(entry);
		if (
			actualKeys.some((key) => !allowedKeys.includes(key)) ||
			!actualKeys.includes('disposition') ||
			!actualKeys.includes('evidence')
		)
			fail(`${label} must contain disposition and evidence plus only optional enforcing fields`);
		const enforcingAnchor =
			entry.enforcingAnchor === undefined
				? null
				: requireString(entry.enforcingAnchor, `${label}.enforcingAnchor`, false);
		const enforcingSite =
			entry.enforcingSite === undefined
				? null
				: requireString(entry.enforcingSite, `${label}.enforcingSite`, false);
		rows.push({
			disposition: parseDisposition(entry.disposition, `${label}.disposition`),
			enforcingAnchor,
			enforcingSite,
			evidence: requireString(entry.evidence, `${label}.evidence`, false),
			guardText: requireString(guardText, `${label} key`)
		});
	}
	return rows;
}

function parseAudit(value: unknown): GuardEnforcementLedgerWorkerAudit {
	if (!isRecord(value)) fail('auditLedger() must return an object');
	requireExactKeys(
		value,
		[
			'arrowCount',
			'counts',
			'enforcedAnchorBroken',
			'enforcedWithoutSite',
			'stale',
			'textCount',
			'unclassified'
		],
		'auditLedger()'
	);
	if (!isRecord(value.counts)) fail('auditLedger().counts must be an object');
	const counts = Object.keys(value.counts)
		.sort(compareText)
		.map((disposition) => ({
			count: requireInteger(
				(value.counts as JsonRecord)[disposition],
				`auditLedger().counts.${disposition}`
			),
			disposition: parseDisposition(disposition, `auditLedger().counts key ${disposition}`)
		}));
	return {
		arrowCount: requireInteger(value.arrowCount, 'auditLedger().arrowCount'),
		counts,
		enforcedAnchorBroken: parseStringArray(
			value.enforcedAnchorBroken,
			'auditLedger().enforcedAnchorBroken'
		),
		enforcedWithoutSite: parseStringArray(
			value.enforcedWithoutSite,
			'auditLedger().enforcedWithoutSite'
		),
		stale: parseStringArray(value.stale, 'auditLedger().stale'),
		textCount: requireInteger(value.textCount, 'auditLedger().textCount'),
		unclassified: parseStringArray(value.unclassified, 'auditLedger().unclassified')
	};
}

export async function executeGuardEnforcementLedgerWorker(
	request: GuardEnforcementLedgerWorkerRequest
): Promise<GuardEnforcementLedgerWorkerResult> {
	const bun = requireBunRuntime();
	if (!isAbsolute(request.capsuleRoot)) fail('request.capsuleRoot must be an absolute path');
	if (isAbsolute(request.analyzerPath)) fail('request.analyzerPath must be capsule-relative');
	if (isAbsolute(request.dataPath)) fail('request.dataPath must be capsule-relative');
	if (request.analyzerPath !== GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH)
		fail(`request.analyzerPath must be exactly ${GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH}`);
	if (request.dataPath !== GUARD_ENFORCEMENT_LEDGER_DATA_PATH)
		fail(`request.dataPath must be exactly ${GUARD_ENFORCEMENT_LEDGER_DATA_PATH}`);

	const capsuleRoot = canonicalExistingPath(resolve(request.capsuleRoot), 'capsuleRoot');
	requireDirectory(capsuleRoot, 'capsuleRoot');
	const analyzerResolvedPath = canonicalExistingPath(
		resolve(capsuleRoot, request.analyzerPath),
		'analyzerPath'
	);
	requireContained(capsuleRoot, analyzerResolvedPath, 'analyzerPath');
	requireFile(analyzerResolvedPath, 'analyzerPath');
	const dataResolvedPath = canonicalExistingPath(
		resolve(capsuleRoot, request.dataPath),
		'dataPath'
	);
	requireContained(capsuleRoot, dataResolvedPath, 'dataPath');
	requireFile(dataResolvedPath, 'dataPath');

	const domainResolvedPath = canonicalResolvedModulePath(
		bun,
		'@janumipwb/rph-domain',
		analyzerResolvedPath,
		'@janumipwb/rph-domain'
	);
	requireContained(capsuleRoot, domainResolvedPath, '@janumipwb/rph-domain');
	const contractsResolvedPath = canonicalResolvedModulePath(
		bun,
		'@janumipwb/rph-contracts',
		analyzerResolvedPath,
		'@janumipwb/rph-contracts'
	);
	requireContained(capsuleRoot, contractsResolvedPath, '@janumipwb/rph-contracts');
	const typescriptResolvedPath = canonicalResolvedModulePath(
		bun,
		'typescript',
		analyzerResolvedPath,
		'typescript'
	);
	const typescriptVersion = packageVersion(bun, 'typescript', analyzerResolvedPath);
	const ulidResolvedPath = canonicalResolvedModulePath(bun, 'ulid', analyzerResolvedPath, 'ulid');
	const ulidVersion = packageVersion(bun, 'ulid', analyzerResolvedPath);
	const zodResolvedPath = canonicalResolvedModulePath(bun, 'zod', analyzerResolvedPath, 'zod');
	const zodVersion = packageVersion(bun, 'zod', analyzerResolvedPath);

	const originalConsole = globalThis.console;
	const suppressedConsole: Console = Object.freeze({
		...originalConsole,
		assert: () => undefined,
		clear: () => undefined,
		count: () => undefined,
		countReset: () => undefined,
		debug: () => undefined,
		dir: () => undefined,
		dirxml: () => undefined,
		error: () => undefined,
		group: () => undefined,
		groupCollapsed: () => undefined,
		groupEnd: () => undefined,
		info: () => undefined,
		log: () => undefined,
		table: () => undefined,
		time: () => undefined,
		timeEnd: () => undefined,
		timeLog: () => undefined,
		trace: () => undefined,
		warn: () => undefined
	});
	globalThis.console = suppressedConsole;
	let guardedArrows: GuardEnforcementLedgerWorkerArrow[];
	let guardTexts: string[];
	let ledgerRows: GuardEnforcementLedgerWorkerRow[];
	let audit: GuardEnforcementLedgerWorkerAudit;
	try {
		const analyzer = requireAnalyzer(await import(pathToFileURL(analyzerResolvedPath).href));
		const data = requireData(await import(pathToFileURL(dataResolvedPath).href));
		guardedArrows = parseGuardedArrows(analyzer.guardedArrows());
		guardTexts = parseStringArray(analyzer.guardTexts(), 'guardTexts()');
		ledgerRows = parseLedgerRows(data.GUARD_LEDGER);
		audit = parseAudit(analyzer.auditLedger(data.GUARD_LEDGER));
	} finally {
		globalThis.console = originalConsole;
	}

	return {
		analyzerResolvedPath: capsuleRelativePath(capsuleRoot, analyzerResolvedPath, 'analyzerPath'),
		audit,
		contractsResolvedPath: capsuleRelativePath(
			capsuleRoot,
			contractsResolvedPath,
			'@janumipwb/rph-contracts'
		),
		dataResolvedPath: capsuleRelativePath(capsuleRoot, dataResolvedPath, 'dataPath'),
		domainResolvedPath: capsuleRelativePath(
			capsuleRoot,
			domainResolvedPath,
			'@janumipwb/rph-domain'
		),
		guardTexts,
		guardedArrows,
		ledgerRows,
		runtime: {
			bunVersion: requireString(bun.version, 'Bun.version'),
			typescriptResolvedPath,
			typescriptVersion,
			ulidResolvedPath,
			ulidVersion,
			zodResolvedPath,
			zodVersion
		},
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION
	};
}

async function main(): Promise<void> {
	try {
		const request = parseGuardEnforcementLedgerWorkerRequest(readFileSync(0));
		const result = await executeGuardEnforcementLedgerWorker(request);
		process.stdout.write(`${JSON.stringify(result)}\n`);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'guard-enforcement-ledger worker: unknown failure';
		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	}
}

if ((import.meta as ImportMeta & { readonly main?: boolean }).main === true) await main();
