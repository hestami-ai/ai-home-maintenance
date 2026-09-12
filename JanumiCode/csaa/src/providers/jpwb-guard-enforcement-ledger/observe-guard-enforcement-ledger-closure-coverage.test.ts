import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

type ChildMode = 'CLOSE_THEN_LATE_ERROR' | 'PIDLESS_HANG' | 'THROWING_KILL_HANG';

const childControl = vi.hoisted(() => ({ mode: null as ChildMode | null }));

vi.mock('node:child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:child_process')>();
	return {
		...actual,
		spawn: (...args: Parameters<typeof actual.spawn>) => {
			if (childControl.mode === null) return actual.spawn(...args);
			const mode = childControl.mode;
			const child = new EventEmitter() as ReturnType<typeof actual.spawn>;
			const stdout = new EventEmitter() as NonNullable<ReturnType<typeof actual.spawn>['stdout']>;
			const stderr = new EventEmitter() as NonNullable<ReturnType<typeof actual.spawn>['stderr']>;
			Object.assign(stdout, { destroy: vi.fn() });
			Object.assign(stderr, { destroy: vi.fn() });
			Object.assign(child, {
				kill: () => {
					if (mode === 'THROWING_KILL_HANG') throw new Error('synthetic kill failure');
					return true;
				},
				...(mode === 'PIDLESS_HANG' ? {} : { pid: 43_210 }),
				stderr,
				stdin: {
					destroy: vi.fn(),
					end: () => {
						if (mode === 'CLOSE_THEN_LATE_ERROR')
							queueMicrotask(() => {
								child.emit('close', 0);
								child.emit('error', new Error('late transport error'));
							});
					}
				},
				stdout
			});
			return child;
		},
		spawnSync: (...args: Parameters<typeof actual.spawnSync>) => {
			if (childControl.mode === 'THROWING_KILL_HANG')
				throw new Error('synthetic tree-signal failure');
			return actual.spawnSync(...args);
		}
	};
});

import {
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	type GuardEnforcementLedgerArtifactSetId,
	type ObserveGuardEnforcementLedgerRequest
} from '../../contracts/guard-enforcement-ledger.js';
import {
	executeGuardEnforcementLedgerWorkerProcess,
	observeGuardEnforcementLedger
} from './observe-guard-enforcement-ledger.js';

function request(): ObserveGuardEnforcementLedgerRequest {
	return {
		artifactSetId: 'artifact-set' as GuardEnforcementLedgerArtifactSetId,
		budgets: {
			maxArtifacts: 10,
			maxAuditEntries: 10,
			maxDiagnostics: 10,
			maxExecutorDurationMs: 10,
			maxExternalModuleBytes: 1_000,
			maxExternalModuleFiles: 10,
			maxGuardedArrows: 10,
			maxGuardTexts: 10,
			maxLedgerRows: 10,
			maxMaterializedBytes: 1_000,
			maxOutputStringCharacters: 1_000,
			maxRawArrayEntries: 100,
			maxRawJsonDepth: 10,
			maxStderrBytes: 1_000,
			maxStdoutBytes: 1_000
		},
		operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
		subjectId: 'subject'
	};
}

afterEach(() => {
	childControl.mode = null;
	vi.useRealTimers();
});

describe('guard-enforcement observer closure coverage', () => {
	it.each(['PIDLESS_HANG', 'THROWING_KILL_HANG'] as const)(
		'force-settles cancellation when transport mode %s never closes',
		async (mode) => {
			vi.useFakeTimers();
			childControl.mode = mode;
			const pending = executeGuardEnforcementLedgerWorkerProcess(
				'bun',
				'worker.ts',
				new Uint8Array(),
				request().budgets
			);
			const rejected = expect(pending).rejects.toThrow(/duration exceeds/u);
			await vi.advanceTimersByTimeAsync(2_011);
			await rejected;
		}
	);

	it('ignores a late child error after a successful close settles transport', async () => {
		childControl.mode = 'CLOSE_THEN_LATE_ERROR';
		await expect(
			executeGuardEnforcementLedgerWorkerProcess(
				'bun',
				'worker.ts',
				new Uint8Array(),
				request().budgets
			)
		).resolves.toMatchObject({ exitCode: 0 });
	});

	it('rejects a non-enumerable request field without reading dependencies', async () => {
		const malformed = { ...request() } as ObserveGuardEnforcementLedgerRequest;
		Object.defineProperty(malformed, 'schemaVersion', {
			enumerable: false,
			value: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION
		});
		const outcome = await observeGuardEnforcementLedger(malformed, {} as never, {
			onProgress: 42 as never
		});
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID', path: '$request.schemaVersion' }],
			outcome: 'unavailable'
		});
	});
});
