import { describe, expect, it } from 'vitest';

import type { GuardEnforcementLedgerBudgets } from '../../contracts/guard-enforcement-ledger.js';
import { GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION } from './worker.js';
import {
	GuardEnforcementLedgerRawOutputError,
	parseGuardEnforcementLedgerWorkerOutput
} from './parse-worker-output.js';

const budgets: GuardEnforcementLedgerBudgets = {
	maxArtifacts: 1_000,
	maxAuditEntries: 100,
	maxDiagnostics: 10,
	maxExecutorDurationMs: 10_000,
	maxExternalModuleBytes: 100_000_000,
	maxExternalModuleFiles: 10_000,
	maxGuardedArrows: 100,
	maxGuardTexts: 100,
	maxLedgerRows: 100,
	maxMaterializedBytes: 100_000_000,
	maxOutputStringCharacters: 100_000,
	maxRawArrayEntries: 1_000,
	maxRawJsonDepth: 20,
	maxStderrBytes: 10_000,
	maxStdoutBytes: 1_000_000
};

function workerResult() {
	return {
		analyzerResolvedPath: 'verif/guard-enforcement-ledger.ts',
		audit: {
			arrowCount: 2,
			counts: [
				{ count: 1, disposition: 'ENFORCED' },
				{ count: 1, disposition: 'UNENFORCED' }
			],
			enforcedAnchorBroken: ['broken anchor'],
			enforcedWithoutSite: [],
			stale: ['stale guard'],
			textCount: 2,
			unclassified: []
		},
		contractsResolvedPath: 'node_modules/@janumipwb/rph-contracts/src/index.ts',
		dataResolvedPath: 'verif/guard-enforcement-ledger.data.ts',
		domainResolvedPath: 'node_modules/@janumipwb/rph-domain/src/index.ts',
		guardTexts: ['guard a', 'guard b'],
		guardedArrows: [
			{ from: 'A', guard: 'guard a', machine: 'Machine', to: 'B' },
			{ from: 'B', guard: 'guard b', machine: 'Machine', to: 'C' }
		],
		ledgerRows: [
			{
				disposition: 'ENFORCED',
				enforcingAnchor: 'refusal anchor',
				enforcingSite: 'packages/handler.ts:7',
				evidence: 'handler refuses',
				guardText: 'guard a'
			},
			{
				disposition: 'UNENFORCED',
				enforcingAnchor: null,
				enforcingSite: null,
				evidence: 'no refusal',
				guardText: 'guard b'
			}
		],
		runtime: {
			bunVersion: '1.3.14',
			typescriptResolvedPath: 'C:/executor/typescript/lib/typescript.js',
			typescriptVersion: '5.9.3',
			ulidResolvedPath: 'C:/executor/ulid/dist/index.js',
			ulidVersion: '2.4.0',
			zodResolvedPath: 'C:/executor/zod/index.js',
			zodVersion: '4.4.3'
		},
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION
	};
}

describe('parseGuardEnforcementLedgerWorkerOutput', () => {
	it('projects canonical evidence without temporary executor paths', () => {
		const parsed = parseGuardEnforcementLedgerWorkerOutput(workerResult(), budgets);
		expect(parsed.evidence).toMatchObject({
			analyzerPath: 'verif/guard-enforcement-ledger.ts',
			dataPath: 'verif/guard-enforcement-ledger.data.ts',
			guardTexts: ['guard a', 'guard b'],
			runtime: { bunVersion: '1.3.14' }
		});
		expect(JSON.stringify(parsed.evidence)).not.toContain('C:/executor');
		expect(parsed.runtime.typescriptResolvedPath).toBe('C:/executor/typescript/lib/typescript.js');
	});

	it('enforces the exact capsule-relative subject-resolution sentinels', () => {
		for (const malformed of [
			{ ...workerResult(), analyzerResolvedPath: 'C:/capsule/verif/guard-enforcement-ledger.ts' },
			{ ...workerResult(), dataResolvedPath: '../guard-enforcement-ledger.data.ts' },
			{
				...workerResult(),
				domainResolvedPath: 'C:/capsule/node_modules/@janumipwb/rph-domain/src/index.ts'
			},
			{ ...workerResult(), contractsResolvedPath: 'node_modules/rph-contracts/src/index.ts' }
		])
			expect(() => parseGuardEnforcementLedgerWorkerOutput(malformed, budgets)).toThrow(
				/sentinel/u
			);
	});

	it('enforces every acceptance population and character budget', () => {
		for (const [field, maximum] of [
			['maxGuardedArrows', 1],
			['maxGuardTexts', 1],
			['maxLedgerRows', 1],
			['maxAuditEntries', 1],
			['maxRawArrayEntries', 1],
			['maxOutputStringCharacters', 1]
		] as const)
			expect(() =>
				parseGuardEnforcementLedgerWorkerOutput(workerResult(), {
					...budgets,
					[field]: maximum
				})
			).toThrow(GuardEnforcementLedgerRawOutputError);
	});

	it('rejects malformed primitives, unknown fields, and dispositions', () => {
		for (const malformed of [null, [], { ...workerResult(), extra: true }])
			expect(() => parseGuardEnforcementLedgerWorkerOutput(malformed, budgets)).toThrow(
				GuardEnforcementLedgerRawOutputError
			);
		expect(() =>
			parseGuardEnforcementLedgerWorkerOutput(
				{
					...workerResult(),
					ledgerRows: [{ ...workerResult().ledgerRows[0], disposition: 'PROBABLY_ENFORCED' }]
				},
				budgets
			)
		).toThrow(/recognized guard disposition/u);
		expect(() =>
			parseGuardEnforcementLedgerWorkerOutput(
				{ ...workerResult(), audit: { ...workerResult().audit, arrowCount: -1 } },
				budgets
			)
		).toThrow(/nonnegative/u);
	});

	it('rejects sparse arrays, accessors, and Proxies without invoking them', () => {
		const sparse = workerResult();
		sparse.guardTexts = new Array(2) as typeof sparse.guardTexts;
		expect(() => parseGuardEnforcementLedgerWorkerOutput(sparse, budgets)).toThrow(/dense/u);

		let invoked = false;
		const accessor = workerResult();
		Object.defineProperty(accessor, 'audit', {
			enumerable: true,
			get() {
				invoked = true;
				return {};
			}
		});
		expect(() => parseGuardEnforcementLedgerWorkerOutput(accessor, budgets)).toThrow(
			/data propert/u
		);
		expect(invoked).toBe(false);
		expect(() =>
			parseGuardEnforcementLedgerWorkerOutput(new Proxy(workerResult(), {}), budgets)
		).toThrow(/Proxy/u);
	});

	it('rejects nonplain containers, invalid text, depth, and schema', () => {
		const nonplain = workerResult();
		Object.setPrototypeOf(nonplain, { inherited: true });
		expect(() => parseGuardEnforcementLedgerWorkerOutput(nonplain, budgets)).toThrow(/plain JSON/u);
		const nonplainArray = workerResult();
		Object.setPrototypeOf(nonplainArray.guardTexts, null);
		expect(() => parseGuardEnforcementLedgerWorkerOutput(nonplainArray, budgets)).toThrow(
			/plain JSON array/u
		);
		for (const malformed of [null, {}, new Proxy([], {})]) {
			const nonArray = workerResult();
			nonArray.guardTexts = malformed as never;
			expect(() => parseGuardEnforcementLedgerWorkerOutput(nonArray, budgets)).toThrow(
				/dense, non-Proxy array/u
			);
		}
		const accessorArray = workerResult();
		Object.defineProperty(accessorArray.guardTexts, '0', {
			enumerable: true,
			get: () => 'guard a'
		});
		expect(() => parseGuardEnforcementLedgerWorkerOutput(accessorArray, budgets)).toThrow(
			/data properties only/u
		);
		const malformedLength = workerResult();
		Object.defineProperty(malformedLength.guardTexts, 'length', { value: 2, writable: false });
		expect(() => parseGuardEnforcementLedgerWorkerOutput(malformedLength, budgets)).toThrow(
			/exact array length/u
		);
		for (const malformed of [
			{ ...workerResult(), schemaVersion: 'wrong' },
			{ ...workerResult(), analyzerResolvedPath: '' },
			{ ...workerResult(), guardTexts: ['\ud800'] }
		])
			expect(() => parseGuardEnforcementLedgerWorkerOutput(malformed, budgets)).toThrow();
		expect(() =>
			parseGuardEnforcementLedgerWorkerOutput(workerResult(), { ...budgets, maxRawJsonDepth: 1 })
		).toThrow(/depth exceeds/u);
		const functionValue = workerResult() as unknown as Record<string, unknown>;
		functionValue.analyzerResolvedPath = () => undefined;
		expect(() => parseGuardEnforcementLedgerWorkerOutput(functionValue, budgets)).toThrow();
		const symbolKey = workerResult();
		Object.defineProperty(symbolKey, Symbol('hidden'), { enumerable: true, value: true });
		expect(() => parseGuardEnforcementLedgerWorkerOutput(symbolKey, budgets)).toThrow();
	});
});
