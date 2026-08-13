import { isProxy } from 'node:util/types';

import {
	GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
	GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
	type GuardEnforcementDisposition,
	type GuardEnforcementLedgerBudgets,
	type GuardEnforcementLedgerRawEvidence
} from '../../contracts/guard-enforcement-ledger.js';
import { isUnicodeScalarString } from '../../semantic/canonical.js';
import {
	GUARD_ENFORCEMENT_LEDGER_DISPOSITIONS,
	GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION,
	type GuardEnforcementLedgerWorkerResult
} from './worker.js';

type JsonRecord = Record<string, unknown>;

export class GuardEnforcementLedgerRawOutputError extends Error {
	constructor(
		readonly path: string,
		message: string
	) {
		super(message);
	}
}

function fail(path: string, message: string): never {
	throw new GuardEnforcementLedgerRawOutputError(path, message);
}

function plainRecord(value: unknown, path: string, keys: readonly string[]): JsonRecord {
	if (value === null || typeof value !== 'object')
		fail(path, 'Expected a plain, non-Proxy JSON object.');
	if (isProxy(value) || Array.isArray(value))
		fail(path, 'Expected a plain, non-Proxy JSON object.');
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		fail(path, 'Expected a plain JSON object.');
	const own = Reflect.ownKeys(value);
	if (
		own.some((key) => typeof key !== 'string') ||
		own.length !== keys.length ||
		(own as string[]).some((key) => !keys.includes(key))
	)
		fail(path, 'Object field population is not exact.');
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail(`${path}.${key}`, 'Expected an enumerable data property.');
	}
	return value as JsonRecord;
}

function data(record: JsonRecord, key: string): unknown {
	return Reflect.getOwnPropertyDescriptor(record, key)?.value;
}

function arrayHeaderLength(value: unknown, path: string): number {
	if (value === null || typeof value !== 'object' || isProxy(value) || !Array.isArray(value))
		fail(path, 'Expected a dense, non-Proxy array.');
	if (Reflect.getPrototypeOf(value) !== Array.prototype) fail(path, 'Expected a plain JSON array.');
	const descriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		descriptor === undefined ||
		!('value' in descriptor) ||
		descriptor.enumerable ||
		descriptor.configurable ||
		!descriptor.writable ||
		!Number.isSafeInteger(descriptor.value) ||
		(descriptor.value as number) < 0
	)
		fail(path, 'Expected an exact array length data property.');
	return descriptor.value as number;
}

function denseArray(value: unknown, path: string, budget?: ParseBudget): readonly unknown[] {
	const length = arrayHeaderLength(value, path);
	const array = value as readonly unknown[];
	if (budget !== undefined) {
		if (length > budget.limits.maxRawArrayEntries - budget.arrays)
			fail(path, 'Raw array entries exceed the caller budget.');
		budget.arrays += length;
	}
	const own = Reflect.ownKeys(array);
	if (
		own.length !== length + 1 ||
		own.some(
			(key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))
		)
	)
		fail(path, 'Expected a dense array without expando fields.');
	for (let index = 0; index < length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(array, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail(`${path}[${index}]`, 'Expected enumerable data properties only.');
	}
	return array;
}

interface ParseBudget {
	arrays: number;
	characters: number;
	auditFindings: number;
	readonly limits: GuardEnforcementLedgerBudgets;
}

function text(value: unknown, path: string, budget: ParseBudget): string {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value))
		fail(path, 'Expected nonempty Unicode scalar text.');
	budget.characters += value.length;
	if (budget.characters > budget.limits.maxOutputStringCharacters)
		fail(path, 'Output string characters exceed the caller budget.');
	return value;
}

function nullableText(value: unknown, path: string, budget: ParseBudget): string | null {
	return value === null ? null : text(value, path, budget);
}

function integer(value: unknown, path: string): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0)
		fail(path, 'Expected a nonnegative safe integer.');
	return value as number;
}

function countArray(value: unknown, path: string, budget: ParseBudget): readonly unknown[] {
	return denseArray(value, path, budget);
}

function stringArray(
	value: unknown,
	path: string,
	budget: ParseBudget,
	auditFindings = false
): readonly string[] {
	const result = countArray(value, path, budget).map((entry, index) =>
		text(entry, `${path}[${index}]`, budget)
	);
	if (auditFindings) {
		budget.auditFindings += result.length;
		if (budget.auditFindings > budget.limits.maxAuditEntries)
			fail(path, 'Audit findings exceed the caller budget.');
	}
	return result;
}

const dispositions = new Set<string>(GUARD_ENFORCEMENT_LEDGER_DISPOSITIONS);

function disposition(
	value: unknown,
	path: string,
	budget: ParseBudget
): GuardEnforcementDisposition {
	const parsed = text(value, path, budget);
	if (!dispositions.has(parsed)) fail(path, 'Expected a recognized guard disposition.');
	return parsed as GuardEnforcementDisposition;
}

function guardedArrows(value: unknown, path: string, budget: ParseBudget) {
	const values = countArray(value, path, budget);
	if (values.length > budget.limits.maxGuardedArrows)
		fail(path, 'Guarded-arrow occurrences exceed the caller budget.');
	return values.map((entry, index) => {
		const itemPath = `${path}[${index}]`;
		const record = plainRecord(entry, itemPath, ['from', 'guard', 'machine', 'to']);
		return {
			from: text(data(record, 'from'), `${itemPath}.from`, budget),
			guard: text(data(record, 'guard'), `${itemPath}.guard`, budget),
			machine: text(data(record, 'machine'), `${itemPath}.machine`, budget),
			to: text(data(record, 'to'), `${itemPath}.to`, budget)
		};
	});
}

function ledgerRows(value: unknown, path: string, budget: ParseBudget) {
	const values = countArray(value, path, budget);
	if (values.length > budget.limits.maxLedgerRows)
		fail(path, 'Ledger rows exceed the caller budget.');
	return values.map((entry, index) => {
		const itemPath = `${path}[${index}]`;
		const record = plainRecord(entry, itemPath, [
			'disposition',
			'enforcingAnchor',
			'enforcingSite',
			'evidence',
			'guardText'
		]);
		return {
			disposition: disposition(data(record, 'disposition'), `${itemPath}.disposition`, budget),
			enforcingAnchor: nullableText(
				data(record, 'enforcingAnchor'),
				`${itemPath}.enforcingAnchor`,
				budget
			),
			enforcingSite: nullableText(
				data(record, 'enforcingSite'),
				`${itemPath}.enforcingSite`,
				budget
			),
			evidence: text(data(record, 'evidence'), `${itemPath}.evidence`, budget),
			guardText: text(data(record, 'guardText'), `${itemPath}.guardText`, budget)
		};
	});
}

function audit(value: unknown, path: string, budget: ParseBudget) {
	const record = plainRecord(value, path, [
		'arrowCount',
		'counts',
		'enforcedAnchorBroken',
		'enforcedWithoutSite',
		'stale',
		'textCount',
		'unclassified'
	]);
	const counts = countArray(data(record, 'counts'), `${path}.counts`, budget).map(
		(entry, index) => {
			const itemPath = `${path}.counts[${index}]`;
			const count = plainRecord(entry, itemPath, ['count', 'disposition']);
			return {
				count: integer(data(count, 'count'), `${itemPath}.count`),
				disposition: disposition(data(count, 'disposition'), `${itemPath}.disposition`, budget)
			};
		}
	);
	return {
		arrowCount: integer(data(record, 'arrowCount'), `${path}.arrowCount`),
		counts,
		enforcedAnchorBroken: stringArray(
			data(record, 'enforcedAnchorBroken'),
			`${path}.enforcedAnchorBroken`,
			budget,
			true
		),
		enforcedWithoutSite: stringArray(
			data(record, 'enforcedWithoutSite'),
			`${path}.enforcedWithoutSite`,
			budget,
			true
		),
		stale: stringArray(data(record, 'stale'), `${path}.stale`, budget, true),
		textCount: integer(data(record, 'textCount'), `${path}.textCount`),
		unclassified: stringArray(data(record, 'unclassified'), `${path}.unclassified`, budget, true)
	};
}

function checkJsonDepth(value: unknown, maximum: number): void {
	const stack: { readonly depth: number; readonly path: string; readonly value: unknown }[] = [
		{ depth: 1, path: '$worker', value }
	];
	const seen = new Set<object>();
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (current.depth > maximum) fail(current.path, 'Raw JSON depth exceeds the caller budget.');
		if (current.value === null || typeof current.value !== 'object') continue;
		if (isProxy(current.value)) fail(current.path, 'Raw JSON must not contain Proxy values.');
		if (seen.has(current.value)) fail(current.path, 'Raw JSON must be an unaliased acyclic tree.');
		seen.add(current.value);
		if (Array.isArray(current.value)) denseArray(current.value, current.path);
		else {
			const prototype = Reflect.getPrototypeOf(current.value);
			if (prototype !== Object.prototype && prototype !== null)
				fail(current.path, 'Raw JSON objects must be plain records.');
		}
		for (const key of Reflect.ownKeys(current.value)) {
			if (typeof key !== 'string') fail(current.path, 'Raw JSON must contain string keys only.');
			const descriptor = Reflect.getOwnPropertyDescriptor(current.value, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
				if (Array.isArray(current.value) && key === 'length') continue;
				fail(current.path, 'Raw JSON must contain enumerable data properties only.');
			}
			if (key === 'length' && Array.isArray(current.value)) continue;
			stack.push({
				depth: current.depth + 1,
				path: Array.isArray(current.value) ? `${current.path}[${key}]` : `${current.path}.${key}`,
				value: descriptor.value
			});
		}
	}
}

/**
 * Accepts the isolated worker envelope and projects only capsule-relative
 * retained evidence. Temporary capsule and installed-module paths remain
 * private runtime reconciliation material and never enter evidence identity.
 */
export function parseGuardEnforcementLedgerWorkerOutput(
	value: unknown,
	budgets: GuardEnforcementLedgerBudgets
): {
	readonly contractsResolvedPath: string;
	readonly domainResolvedPath: string;
	readonly evidence: GuardEnforcementLedgerRawEvidence;
	readonly runtime: GuardEnforcementLedgerWorkerResult['runtime'];
} {
	const budget: ParseBudget = {
		arrays: 0,
		auditFindings: 0,
		characters: 0,
		limits: budgets
	};
	const root = plainRecord(value, '$worker', [
		'analyzerResolvedPath',
		'audit',
		'contractsResolvedPath',
		'dataResolvedPath',
		'domainResolvedPath',
		'guardTexts',
		'guardedArrows',
		'ledgerRows',
		'runtime',
		'schemaVersion'
	]);
	if (data(root, 'schemaVersion') !== GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION)
		fail('$worker.schemaVersion', 'Unsupported worker result schema version.');
	const analyzerPath = text(
		data(root, 'analyzerResolvedPath'),
		'$worker.analyzerResolvedPath',
		budget
	);
	if (analyzerPath !== GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH)
		fail('$worker.analyzerResolvedPath', 'Worker analyzer-resolution sentinel is inconsistent.');
	const dataPath = text(data(root, 'dataResolvedPath'), '$worker.dataResolvedPath', budget);
	if (dataPath !== GUARD_ENFORCEMENT_LEDGER_DATA_PATH)
		fail('$worker.dataResolvedPath', 'Worker data-resolution sentinel is inconsistent.');
	const contractsResolvedPath = text(
		data(root, 'contractsResolvedPath'),
		'$worker.contractsResolvedPath',
		budget
	);
	if (contractsResolvedPath !== 'node_modules/@janumipwb/rph-contracts/src/index.ts')
		fail('$worker.contractsResolvedPath', 'Worker contracts-resolution sentinel is inconsistent.');
	const domainResolvedPath = text(
		data(root, 'domainResolvedPath'),
		'$worker.domainResolvedPath',
		budget
	);
	if (domainResolvedPath !== 'node_modules/@janumipwb/rph-domain/src/index.ts')
		fail('$worker.domainResolvedPath', 'Worker domain-resolution sentinel is inconsistent.');
	const runtime = plainRecord(data(root, 'runtime'), '$worker.runtime', [
		'bunVersion',
		'typescriptResolvedPath',
		'typescriptVersion',
		'ulidResolvedPath',
		'ulidVersion',
		'zodResolvedPath',
		'zodVersion'
	]);
	const guardTextPopulation = stringArray(data(root, 'guardTexts'), '$worker.guardTexts', budget);
	if (guardTextPopulation.length > budgets.maxGuardTexts)
		fail('$worker.guardTexts', 'Distinct guard texts exceed the caller budget.');
	const auditEvidence = audit(data(root, 'audit'), '$worker.audit', budget);
	const guardedArrowPopulation = guardedArrows(
		data(root, 'guardedArrows'),
		'$worker.guardedArrows',
		budget
	);
	const ledgerRowPopulation = ledgerRows(data(root, 'ledgerRows'), '$worker.ledgerRows', budget);
	const bunVersion = text(data(runtime, 'bunVersion'), '$worker.runtime.bunVersion', budget);
	const runtimeEvidence: GuardEnforcementLedgerWorkerResult['runtime'] = {
		bunVersion,
		typescriptResolvedPath: text(
			data(runtime, 'typescriptResolvedPath'),
			'$worker.runtime.typescriptResolvedPath',
			budget
		),
		typescriptVersion: text(
			data(runtime, 'typescriptVersion'),
			'$worker.runtime.typescriptVersion',
			budget
		),
		ulidResolvedPath: text(
			data(runtime, 'ulidResolvedPath'),
			'$worker.runtime.ulidResolvedPath',
			budget
		),
		ulidVersion: text(data(runtime, 'ulidVersion'), '$worker.runtime.ulidVersion', budget),
		zodResolvedPath: text(
			data(runtime, 'zodResolvedPath'),
			'$worker.runtime.zodResolvedPath',
			budget
		),
		zodVersion: text(data(runtime, 'zodVersion'), '$worker.runtime.zodVersion', budget)
	};
	const evidence: GuardEnforcementLedgerRawEvidence = {
		analyzerPath: GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
		audit: auditEvidence,
		dataPath: GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
		guardTexts: guardTextPopulation,
		guardedArrows: guardedArrowPopulation,
		ledgerRows: ledgerRowPopulation,
		runtime: { bunVersion },
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION
	};
	checkJsonDepth(root, budgets.maxRawJsonDepth);
	return {
		contractsResolvedPath,
		domainResolvedPath,
		evidence,
		runtime: runtimeEvidence
	};
}
