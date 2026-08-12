import { isProxy } from 'node:util/types';

import {
	ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION,
	type ArrowCommandCensusBudgets,
	type ArrowCommandCensusRawOutput
} from '../../contracts/arrow-command-census.js';
import { isUnicodeScalarString } from '../../semantic/canonical.js';
import {
	ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION,
	type ArrowCommandCensusWorkerResult
} from './worker.js';

type JsonRecord = Record<string, unknown>;

export class ArrowCommandCensusRawOutputError extends Error {
	constructor(
		readonly path: string,
		message: string
	) {
		super(message);
	}
}

function fail(path: string, message: string): never {
	throw new ArrowCommandCensusRawOutputError(path, message);
}

function plainRecord(value: unknown, path: string, keys: readonly string[]): JsonRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
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

function denseArray(value: unknown, path: string): readonly unknown[] {
	if (!Array.isArray(value) || isProxy(value)) fail(path, 'Expected a dense, non-Proxy array.');
	if (Reflect.getPrototypeOf(value) !== Array.prototype) fail(path, 'Expected a plain JSON array.');
	const own = Reflect.ownKeys(value);
	if (
		own.length !== value.length + 1 ||
		own.some(
			(key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))
		)
	)
		fail(path, 'Expected a dense array without expando fields.');
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail(`${path}[${index}]`, 'Expected an enumerable data element.');
	}
	return value;
}

function text(value: unknown, path: string, budget: ParseBudget): string {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value))
		fail(path, 'Expected nonempty Unicode scalar text.');
	budget.characters += value.length;
	if (budget.characters > budget.limits.maxOutputStringCharacters)
		fail(path, 'Output string characters exceed the caller budget.');
	return value;
}

function integer(value: unknown, path: string): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0)
		fail(path, 'Expected a nonnegative safe integer.');
	return value as number;
}

interface ParseBudget {
	arrays: number;
	characters: number;
	readonly limits: ArrowCommandCensusBudgets;
}

function countArray(value: unknown, path: string, budget: ParseBudget): readonly unknown[] {
	const result = denseArray(value, path);
	budget.arrays += result.length;
	if (budget.arrays > budget.limits.maxRawArrayEntries)
		fail(path, 'Raw array entries exceed the caller budget.');
	return result;
}

function stringArray(value: unknown, path: string, budget: ParseBudget): readonly string[] {
	return countArray(value, path, budget).map((entry, index) =>
		text(entry, `${path}[${index}]`, budget)
	);
}

function findingTriple(value: unknown, path: string, budget: ParseBudget) {
	const record = plainRecord(value, path, ['orphans', 'total', 'uncovered']);
	return {
		orphans: stringArray(data(record, 'orphans'), `${path}.orphans`, budget),
		total: integer(data(record, 'total'), `${path}.total`),
		uncovered: stringArray(data(record, 'uncovered'), `${path}.uncovered`, budget)
	};
}

function deadCovered(value: unknown, path: string, budget: ParseBudget) {
	const record = plainRecord(value, path, ['dead', 'unanalysed']);
	return {
		dead: stringArray(data(record, 'dead'), `${path}.dead`, budget),
		unanalysed: stringArray(data(record, 'unanalysed'), `${path}.unanalysed`, budget)
	};
}

function findingSet(value: unknown, path: string, budget: ParseBudget) {
	const record = plainRecord(value, path, ['dead', 'orphans', 'total', 'unanalysed', 'uncovered']);
	return {
		...findingTriple(
			{
				orphans: data(record, 'orphans'),
				total: data(record, 'total'),
				uncovered: data(record, 'uncovered')
			},
			path,
			budget
		),
		...deadCovered(
			{ dead: data(record, 'dead'), unanalysed: data(record, 'unanalysed') },
			path,
			budget
		)
	};
}

function stateMap(value: unknown, path: string, budget: ParseBudget) {
	const values = countArray(value, path, budget);
	if (values.length > budget.limits.maxMachines)
		fail(path, 'Machine count exceeds the caller budget.');
	let stateCount = 0;
	return values.map((entry, index) => {
		const itemPath = `${path}[${index}]`;
		const record = plainRecord(entry, itemPath, ['machine', 'states']);
		const states = stringArray(data(record, 'states'), `${itemPath}.states`, budget);
		stateCount += states.length;
		if (stateCount > budget.limits.maxMapStates)
			fail(`${itemPath}.states`, 'State-map entries exceed the caller budget.');
		return { machine: text(data(record, 'machine'), `${itemPath}.machine`, budget), states };
	});
}

function declaredArrows(value: unknown, path: string, budget: ParseBudget) {
	const values = countArray(value, path, budget);
	if (values.length > budget.limits.maxDeclaredArrowOccurrences)
		fail(path, 'Declared-arrow occurrences exceed the caller budget.');
	const sites = new Set<string>();
	const arrows = values.map((entry, index) => {
		const itemPath = `${path}[${index}]`;
		const record = plainRecord(entry, itemPath, ['from', 'machine', 'site', 'to']);
		const site = text(data(record, 'site'), `${itemPath}.site`, budget);
		sites.add(site);
		if (sites.size > budget.limits.maxDeclaredSites)
			fail(`${itemPath}.site`, 'Declared sites exceed the caller budget.');
		return {
			from: text(data(record, 'from'), `${itemPath}.from`, budget),
			machine: text(data(record, 'machine'), `${itemPath}.machine`, budget),
			site,
			to: text(data(record, 'to'), `${itemPath}.to`, budget)
		};
	});
	return arrows;
}

function checkJsonDepth(value: unknown, maximum: number): void {
	const stack: { readonly depth: number; readonly value: unknown }[] = [{ depth: 1, value }];
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (current.depth > maximum) fail('$worker', 'Raw JSON depth exceeds the caller budget.');
		if (current.value === null || typeof current.value !== 'object') continue;
		if (isProxy(current.value)) fail('$worker', 'Raw JSON must not contain Proxy values.');
		for (const key of Reflect.ownKeys(current.value)) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current.value, key);
			if (descriptor === undefined || !('value' in descriptor))
				fail('$worker', 'Raw JSON must contain data properties only.');
			stack.push({ depth: current.depth + 1, value: descriptor.value });
		}
	}
}

/**
 * Parses the isolated-worker envelope and projects only canonical retained
 * evidence. Temporary capsule paths and external runtime paths never enter
 * raw-evidence identity.
 */
export function parseArrowCommandCensusWorkerOutput(
	value: unknown,
	budgets: ArrowCommandCensusBudgets
): {
	readonly evidence: ArrowCommandCensusRawOutput;
	readonly runtime: ArrowCommandCensusWorkerResult['runtime'];
} {
	checkJsonDepth(value, budgets.maxRawJsonDepth);
	const budget: ParseBudget = { arrays: 0, characters: 0, limits: budgets };
	const root = plainRecord(value, '$worker', [
		'analyzerResolvedPath',
		'baseline',
		'birthStates',
		'census',
		'contractsResolvedPath',
		'deadCovered',
		'declaredArrows',
		'domainResolvedPath',
		'occupiable',
		'runtime',
		'schemaVersion'
	]);
	if (data(root, 'schemaVersion') !== ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION)
		fail('$worker.schemaVersion', 'Unsupported worker result schema version.');
	const expectedSubjectPaths = {
		analyzerResolvedPath: 'verif/arrow-command-census.ts',
		contractsResolvedPath: 'node_modules/@janumipwb/rph-contracts/src/index.ts',
		domainResolvedPath: 'node_modules/@janumipwb/rph-domain/src/index.ts'
	} as const;
	for (const [key, expected] of Object.entries(expectedSubjectPaths))
		if (text(data(root, key), `$worker.${key}`, budget) !== expected)
			fail(`$worker.${key}`, 'Worker subject-resolution sentinel is inconsistent.');
	const runtime = plainRecord(data(root, 'runtime'), '$worker.runtime', [
		'bunVersion',
		'typescriptResolvedPath',
		'typescriptVersion',
		'ulidResolvedPath',
		'ulidVersion',
		'zodResolvedPath',
		'zodVersion'
	]);
	const evidence: ArrowCommandCensusRawOutput = {
		baseline: findingSet(data(root, 'baseline'), '$worker.baseline', budget),
		births: stateMap(data(root, 'birthStates'), '$worker.birthStates', budget),
		census: findingTriple(data(root, 'census'), '$worker.census', budget),
		deadCovered: deadCovered(data(root, 'deadCovered'), '$worker.deadCovered', budget),
		declaredArrows: declaredArrows(data(root, 'declaredArrows'), '$worker.declaredArrows', budget),
		occupiable: stateMap(data(root, 'occupiable'), '$worker.occupiable', budget),
		schemaVersion: ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION
	};
	if (evidence.births.reduce((sum, item) => sum + item.states.length, 0) > budgets.maxBirthStates)
		fail('$worker.birthStates', 'Birth states exceed the caller budget.');
	return {
		evidence,
		runtime: {
			bunVersion: text(data(runtime, 'bunVersion'), '$worker.runtime.bunVersion', budget),
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
		}
	};
}
