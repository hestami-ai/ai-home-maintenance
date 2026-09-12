import { describe, expect, it } from 'vitest';

import {
	ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION,
	type ArrowCommandCensusBudgets
} from '../../contracts/arrow-command-census.js';
import { ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION } from './worker.js';
import {
	ArrowCommandCensusRawOutputError,
	parseArrowCommandCensusWorkerOutput
} from './parse-worker-output.js';

const budgets: ArrowCommandCensusBudgets = {
	maxArtifacts: 100,
	maxBirthStates: 100,
	maxDeclaredArrowOccurrences: 100,
	maxDeclaredSites: 100,
	maxDiagnostics: 10,
	maxExecutorDurationMs: 10_000,
	maxExternalModuleBytes: 100_000_000,
	maxExternalModuleFiles: 10_000,
	maxMachines: 100,
	maxMapStates: 100,
	maxMaterializedBytes: 100_000_000,
	maxOutputStringCharacters: 100_000,
	maxRawArrayEntries: 1_000,
	maxRawJsonDepth: 20,
	maxStderrBytes: 10_000,
	maxStdoutBytes: 1_000_000
};

function workerResult() {
	return {
		analyzerResolvedPath: 'verif/arrow-command-census.ts',
		baseline: {
			dead: ['Machine  B -> C'],
			orphans: ['Orphan.status'],
			total: 2,
			unanalysed: ['Machine'],
			uncovered: ['Machine  A -> B']
		},
		birthStates: [{ machine: 'Machine', states: ['A'] }],
		census: { orphans: ['Orphan.status'], total: 2, uncovered: ['Machine  A -> B'] },
		contractsResolvedPath: 'node_modules/@janumipwb/rph-contracts/src/index.ts',
		deadCovered: { dead: ['Machine  B -> C'], unanalysed: ['Machine'] },
		declaredArrows: [{ from: 'A', machine: 'Machine', site: 'handler.ts:7', to: 'B' }],
		domainResolvedPath: 'node_modules/@janumipwb/rph-domain/src/index.ts',
		occupiable: [{ machine: 'Machine', states: ['A', 'B'] }],
		runtime: {
			bunVersion: '1.3.14',
			typescriptResolvedPath: 'C:/capsule/node_modules/typescript/lib/typescript.js',
			typescriptVersion: '5.9.3',
			ulidResolvedPath: 'C:/capsule/node_modules/ulid/dist/index.js',
			ulidVersion: '2.4.0',
			zodResolvedPath: 'C:/capsule/node_modules/zod/index.js',
			zodVersion: '4.4.3'
		},
		schemaVersion: ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION
	};
}

describe('parseArrowCommandCensusWorkerOutput', () => {
	it('projects canonical retained evidence without temporary executor paths', () => {
		const first = parseArrowCommandCensusWorkerOutput(workerResult(), budgets);
		const second = parseArrowCommandCensusWorkerOutput(workerResult(), budgets);

		expect(second.evidence).toEqual(first.evidence);
		expect(first.evidence.schemaVersion).toBe(ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION);
		expect(first.evidence.census.total).toBe(2);
		expect(() =>
			parseArrowCommandCensusWorkerOutput(
				{ ...workerResult(), analyzerResolvedPath: 'C:/capsule/verif/arrow-command-census.ts' },
				budgets
			)
		).toThrow(/sentinel/u);
	});

	it('enforces population and character acceptance budgets after execution', () => {
		expect(() =>
			parseArrowCommandCensusWorkerOutput(workerResult(), {
				...budgets,
				maxDeclaredArrowOccurrences: 0
			})
		).toThrow(ArrowCommandCensusRawOutputError);
		expect(() =>
			parseArrowCommandCensusWorkerOutput(workerResult(), {
				...budgets,
				maxOutputStringCharacters: 1
			})
		).toThrow(/characters exceed/u);
		for (const field of [
			'maxRawArrayEntries',
			'maxMachines',
			'maxMapStates',
			'maxDeclaredSites',
			'maxBirthStates'
		] as const)
			expect(() =>
				parseArrowCommandCensusWorkerOutput(workerResult(), {
					...budgets,
					[field]: 0
				})
			).toThrow(ArrowCommandCensusRawOutputError);
	});

	it('rejects invalid primitives, schema versions, records, and array elements', () => {
		for (const malformed of [null, [], Object.setPrototypeOf(workerResult(), Date.prototype)])
			expect(() => parseArrowCommandCensusWorkerOutput(malformed, budgets)).toThrow(
				ArrowCommandCensusRawOutputError
			);

		const nonEnumerable = workerResult();
		Object.defineProperty(nonEnumerable, 'baseline', {
			enumerable: false,
			value: nonEnumerable.baseline
		});
		expect(() => parseArrowCommandCensusWorkerOutput(nonEnumerable, budgets)).toThrow(
			/data propert/u
		);

		const accessorElement = workerResult();
		const arrow = accessorElement.declaredArrows[0]!;
		Object.defineProperty(accessorElement.declaredArrows, '0', {
			enumerable: false,
			value: arrow
		});
		expect(() => parseArrowCommandCensusWorkerOutput(accessorElement, budgets)).toThrow(
			/data element/u
		);

		expect(() =>
			parseArrowCommandCensusWorkerOutput(
				{ ...workerResult(), schemaVersion: 'unsupported' },
				budgets
			)
		).toThrow(/schema version/u);
		expect(() =>
			parseArrowCommandCensusWorkerOutput(
				{ ...workerResult(), runtime: { ...workerResult().runtime, bunVersion: '' } },
				budgets
			)
		).toThrow(/nonempty/u);
		expect(() =>
			parseArrowCommandCensusWorkerOutput(
				{ ...workerResult(), census: { ...workerResult().census, total: -1 } },
				budgets
			)
		).toThrow(/nonnegative/u);
	});

	it('rejects unknown fields, sparse arrays, accessors, and Proxies without invoking them', () => {
		expect(() =>
			parseArrowCommandCensusWorkerOutput({ ...workerResult(), extra: true }, budgets)
		).toThrow(/field population/u);

		const sparse = workerResult();
		sparse.declaredArrows = new Array(1) as typeof sparse.declaredArrows;
		expect(() => parseArrowCommandCensusWorkerOutput(sparse, budgets)).toThrow(/dense/u);

		let invoked = false;
		const accessor = workerResult();
		Object.defineProperty(accessor, 'baseline', {
			enumerable: true,
			get() {
				invoked = true;
				return {};
			}
		});
		expect(() => parseArrowCommandCensusWorkerOutput(accessor, budgets)).toThrow(/data propert/u);
		expect(invoked).toBe(false);

		expect(() =>
			parseArrowCommandCensusWorkerOutput(new Proxy(workerResult(), {}), budgets)
		).toThrow(/Proxy/u);
	});
});
