import { describe, expect, it } from 'vitest';

import type { GuardEnforcementLedgerBudgets } from '../../contracts/guard-enforcement-ledger.js';
import {
	GuardEnforcementLedgerRawOutputError,
	parseGuardEnforcementLedgerWorkerOutput
} from './parse-worker-output.js';
import { GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION } from './worker.js';

const budgets: GuardEnforcementLedgerBudgets = {
	maxArtifacts: 100,
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
	maxRawArrayEntries: 100,
	maxRawJsonDepth: 20,
	maxStderrBytes: 10_000,
	maxStdoutBytes: 1_000_000
};

function workerResult() {
	return {
		analyzerResolvedPath: 'verif/guard-enforcement-ledger.ts',
		audit: {
			arrowCount: 0,
			counts: [],
			enforcedAnchorBroken: [],
			enforcedWithoutSite: [],
			stale: [],
			textCount: 0,
			unclassified: []
		},
		contractsResolvedPath: 'node_modules/@janumipwb/rph-contracts/src/index.ts',
		dataResolvedPath: 'verif/guard-enforcement-ledger.data.ts',
		domainResolvedPath: 'node_modules/@janumipwb/rph-domain/src/index.ts',
		guardTexts: [],
		guardedArrows: [],
		ledgerRows: [],
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

describe('guard-ledger worker-output hostile budget preflight', () => {
	it('rejects a million-entry unknown-root array before recursively traversing it', () => {
		let getterCalls = 0;
		const unknown = new Array(1_000_000);
		Object.defineProperty(unknown, '0', {
			enumerable: true,
			get() {
				getterCalls += 1;
				return 'must not run';
			}
		});
		const malformed = { ...workerResult(), unknown };
		expect(() => parseGuardEnforcementLedgerWorkerOutput(malformed, budgets)).toThrow(
			/Object field population is not exact/u
		);
		expect(getterCalls).toBe(0);
	});

	it('charges a million-entry known array from its length before own-key or element traversal', () => {
		let getterCalls = 0;
		const guardTexts = new Array(1_000_000);
		Object.defineProperty(guardTexts, '0', {
			enumerable: true,
			get() {
				getterCalls += 1;
				return 'must not run';
			}
		});
		const malformed = { ...workerResult(), guardTexts };
		expect(() => parseGuardEnforcementLedgerWorkerOutput(malformed, budgets)).toThrowError(
			new GuardEnforcementLedgerRawOutputError(
				'$worker.guardTexts',
				'Raw array entries exceed the caller budget.'
			)
		);
		expect(getterCalls).toBe(0);
	});

	it('rejects a million-property object in a scalar slot before generic tree traversal', () => {
		const target = Object.create(null) as Record<string, number>;
		for (let index = 0; index < 1_000_000; index += 1) target[`key${index}`] = index;
		let ownKeyCalls = 0;
		const scalarObject = new Proxy(target, {
			ownKeys() {
				ownKeyCalls += 1;
				return Reflect.ownKeys(target);
			}
		});
		const malformed = { ...workerResult(), analyzerResolvedPath: scalarObject };
		expect(() => parseGuardEnforcementLedgerWorkerOutput(malformed, budgets)).toThrowError(
			new GuardEnforcementLedgerRawOutputError(
				'$worker.analyzerResolvedPath',
				'Expected nonempty Unicode scalar text.'
			)
		);
		expect(ownKeyCalls).toBe(0);
	});

	it('preserves the exact accepted worker-output projection', () => {
		const parsed = parseGuardEnforcementLedgerWorkerOutput(workerResult(), budgets);
		expect(parsed.evidence).toEqual({
			analyzerPath: 'verif/guard-enforcement-ledger.ts',
			audit: {
				arrowCount: 0,
				counts: [],
				enforcedAnchorBroken: [],
				enforcedWithoutSite: [],
				stale: [],
				textCount: 0,
				unclassified: []
			},
			dataPath: 'verif/guard-enforcement-ledger.data.ts',
			guardTexts: [],
			guardedArrows: [],
			ledgerRows: [],
			runtime: { bunVersion: '1.3.14' },
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION
		});
	});
});
