import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

type ChildMode =
	| 'CHILD_ERROR'
	| 'INVALID_FRAME'
	| 'INVALID_JSON'
	| 'INVALID_UTF8'
	| 'NONZERO_EXIT'
	| 'STDERR_SUCCESS';

const childProcessControl = vi.hoisted(() => ({ mode: null as ChildMode | null }));

vi.mock('node:child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:child_process')>();
	return {
		...actual,
		spawn: (...args: Parameters<typeof actual.spawn>) => {
			const mode = childProcessControl.mode;
			if (mode === null) return actual.spawn(...args);
			const child = new EventEmitter() as ReturnType<typeof actual.spawn>;
			const stdout = new EventEmitter();
			const stderr = new EventEmitter();
			Object.assign(child, {
				kill: () => true,
				pid: 12345,
				stderr,
				stdin: {
					destroy: () => undefined,
					end: () => {
						queueMicrotask(() => {
							switch (mode) {
								case 'CHILD_ERROR':
									child.emit('error', new Error('synthetic child failure'));
									break;
								case 'INVALID_FRAME':
									stdout.emit('data', Buffer.from('{}\n\n'));
									child.emit('close', 0);
									break;
								case 'INVALID_JSON':
									stdout.emit('data', Buffer.from('{\n'));
									child.emit('close', 0);
									break;
								case 'INVALID_UTF8':
									stdout.emit('data', Buffer.from([0xff, 0x0a]));
									child.emit('close', 0);
									break;
								case 'NONZERO_EXIT':
									stderr.emit('data', Buffer.from('synthetic failure'));
									child.emit('close', 7);
									break;
								case 'STDERR_SUCCESS':
									stderr.emit('data', Buffer.from('unexpected'));
									child.emit('close', 0);
									break;
							}
						});
					}
				},
				stdout
			});
			return child;
		}
	};
});

import {
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_MAX_EXECUTOR_DURATION_MS,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	type GuardEnforcementLedgerBudgets,
	type GuardEnforcementLedgerArtifactSetId,
	type ObserveGuardEnforcementLedgerRequest
} from '../../contracts/guard-enforcement-ledger.js';
import { SUBJECT_POLICY_VERSION, SUBJECT_REQUEST_SCHEMA_VERSION } from '../../contracts/subject.js';
import { resolveSubject } from '../../subject/resolve-subject.js';
import { buildGuardEnforcementLedgerArtifactSet } from './artifact-set.js';
import {
	classifyGuardEnforcementLedgerObservationOutcome,
	executeGuardEnforcementLedgerWorkerProcess,
	observeGuardEnforcementLedger,
	type GuardEnforcementLedgerProgressEvent
} from './observe-guard-enforcement-ledger.js';

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));

afterEach(() => {
	childProcessControl.mode = null;
});

function request(): ObserveGuardEnforcementLedgerRequest {
	return {
		artifactSetId: 'artifact-set' as GuardEnforcementLedgerArtifactSetId,
		budgets: {
			maxArtifacts: 10,
			maxAuditEntries: 10,
			maxDiagnostics: 10,
			maxExecutorDurationMs: 1_000,
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

const observerBudgets: GuardEnforcementLedgerBudgets = {
	maxArtifacts: 10_000,
	maxAuditEntries: 10_000,
	maxDiagnostics: 100,
	maxExecutorDurationMs: 120_000,
	maxExternalModuleBytes: 128 * 1024 * 1024,
	maxExternalModuleFiles: 10_000,
	maxGuardedArrows: 10_000,
	maxGuardTexts: 10_000,
	maxLedgerRows: 10_000,
	maxMaterializedBytes: 128 * 1024 * 1024,
	maxOutputStringCharacters: 20_000_000,
	maxRawArrayEntries: 100_000,
	maxRawJsonDepth: 20,
	maxStderrBytes: 1024 * 1024,
	maxStdoutBytes: 64 * 1024 * 1024
};

function currentBinding() {
	const resolution = resolveSubject({
		budgets: {
			maxBytes: 2 * 1024 * 1024 * 1024,
			maxConfigDepth: 64,
			maxDiagnostics: 100_000,
			maxDurationMs: 300_000,
			maxFiles: 100_000,
			maxProjects: 200
		},
		expectEmpty: false,
		filters: { exclude: [], include: [] },
		operationVersion: 'jan-csaa-guard-enforcement-ledger-error-fixture/1.0.0',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: ROOT,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'REPOSITORY' },
		subjectKind: 'WORKTREE'
	});
	if (resolution.outcome !== 'resolved') throw new Error(JSON.stringify(resolution));
	const { subject } = resolution;
	const setOutcome = buildGuardEnforcementLedgerArtifactSet(
		{
			budgets: {
				maxArtifacts: observerBudgets.maxArtifacts,
				maxDiagnostics: observerBudgets.maxDiagnostics,
				maxTotalBytes: observerBudgets.maxMaterializedBytes
			},
			operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject }
	);
	if (setOutcome.outcome !== 'complete') throw new Error(JSON.stringify(setOutcome));
	return {
		artifactSet: setOutcome.artifactSet,
		request: {
			artifactSetId: setOutcome.artifactSet.id,
			budgets: observerBudgets,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		subject
	};
}

describe('observeGuardEnforcementLedger', () => {
	it('maps any retained audit hole to available partial evidence without creating a gate', () => {
		const audit = {
			arrowCount: 1,
			counts: [],
			enforcedAnchorBroken: [],
			enforcedWithoutSite: [],
			stale: [],
			textCount: 1,
			unclassified: []
		};
		expect(classifyGuardEnforcementLedgerObservationOutcome(audit)).toBe('complete');
		for (const key of [
			'enforcedAnchorBroken',
			'enforcedWithoutSite',
			'stale',
			'unclassified'
		] as const)
			expect(
				classifyGuardEnforcementLedgerObservationOutcome({ ...audit, [key]: ['finding'] })
			).toBe('partial');
	});

	it('fails closed before execution when the exact FrozenSubject capability is unavailable', async () => {
		const events: GuardEnforcementLedgerProgressEvent[] = [];
		const outcome = await observeGuardEnforcementLedger(
			request(),
			{ artifactSet: undefined, subject: {} } as never,
			{
				onProgress: (event) => events.push(event)
			}
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'SUBJECT_CAPABILITY_UNAVAILABLE', phase: 'BIND' }],
			outcome: 'unavailable'
		});
		expect(events.map((event) => [event.phase, event.state])).toEqual([
			['REQUEST_AND_ARTIFACT_BIND', 'STARTED'],
			['REQUEST_AND_ARTIFACT_BIND', 'FAILED'],
			['CAPSULE_CLEANUP', 'SKIPPED']
		]);
	});

	it('rejects non-exact requests and never invokes the retained process', async () => {
		const malformed = { ...request(), extra: true };
		const baseline = await observeGuardEnforcementLedger(malformed as never, {} as never);
		const withMutatingSink = await observeGuardEnforcementLedger(malformed as never, {} as never, {
			onProgress: () => {
				delete (malformed as { extra?: boolean }).extra;
				(
					malformed as unknown as {
						budgets: { maxStdoutBytes: number };
						subjectId: string;
					}
				).budgets.maxStdoutBytes = Number.MAX_SAFE_INTEGER;
				(malformed as unknown as { subjectId: string }).subjectId = 'mutated';
			}
		});
		const outcome = baseline;
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID', phase: 'REQUEST' }],
			outcome: 'unavailable'
		});
		expect(withMutatingSink).toEqual(baseline);
	});

	it('keeps hostile or throwing progress sinks inert', async () => {
		const throwing = await observeGuardEnforcementLedger(request(), {} as never, {
			onProgress: () => {
				throw new Error('must not affect evidence');
			}
		});
		const hostileOptions = new Proxy(
			{},
			{
				getOwnPropertyDescriptor() {
					throw new Error('hostile');
				}
			}
		);
		const proxied = await observeGuardEnforcementLedger(
			request(),
			{} as never,
			hostileOptions as never
		);
		expect(throwing).toEqual(proxied);
		expect(proxied.outcome).toBe('unavailable');
	});

	it('rejects hostile dependency accessors without invoking them', async () => {
		let getterCalls = 0;
		const dependencies = Object.defineProperty({}, 'subject', {
			enumerable: true,
			get() {
				getterCalls += 1;
				return {};
			}
		});
		const outcome = await observeGuardEnforcementLedger(request(), dependencies as never);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID', path: '$dependencies' }],
			outcome: 'unavailable'
		});
		expect(getterCalls).toBe(0);
	});

	it('rejects executor durations that the runtime timer cannot represent', async () => {
		const malformed = request() as unknown as {
			budgets: { maxExecutorDurationMs: number };
		};
		malformed.budgets.maxExecutorDurationMs = GUARD_ENFORCEMENT_LEDGER_MAX_EXECUTOR_DURATION_MS + 1;
		const outcome = await observeGuardEnforcementLedger(malformed as never, {} as never);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID', path: '$request.budgets.maxExecutorDurationMs' }],
			outcome: 'unavailable'
		});
		for (const malformed of [
			null,
			[],
			{ ...request(), schemaVersion: 'wrong' },
			{ ...request(), operationVersion: 'wrong' },
			{ ...request(), subjectId: '' },
			{ ...request(), artifactSetId: '' },
			{ ...request(), budgets: [] },
			{ ...request(), budgets: { ...request().budgets, maxGuardTexts: 0 } }
		]) {
			const rejected = await observeGuardEnforcementLedger(malformed as never, {} as never);
			expect(rejected).toMatchObject({
				diagnostics: [{ code: 'REQUEST_INVALID', phase: 'REQUEST' }],
				outcome: 'unavailable'
			});
		}
	});

	it('hard-stops duration and output budget breaches', async () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-guard-process-'));
		try {
			const runtime = process.versions.bun === undefined ? 'bun' : process.execPath;
			const ignoring = join(root, 'ignore-sigterm.ts');
			writeFileSync(
				ignoring,
				"process.on('SIGTERM', () => undefined); setInterval(() => undefined, 1_000);\n"
			);
			const durationBudgets = {
				...request().budgets,
				maxExecutorDurationMs: 25
			};
			await expect(
				executeGuardEnforcementLedgerWorkerProcess(
					runtime,
					ignoring,
					new Uint8Array(),
					durationBudgets
				)
			).rejects.toThrow(/duration exceeds/u);

			const flooding = join(root, 'flood-stdout.ts');
			writeFileSync(
				flooding,
				"const chunk = 'x'.repeat(4_096); setInterval(() => process.stdout.write(chunk), 0);\n"
			);
			await expect(
				executeGuardEnforcementLedgerWorkerProcess(runtime, flooding, new Uint8Array(), {
					...request().budgets,
					maxExecutorDurationMs: 5_000,
					maxStdoutBytes: 64
				})
			).rejects.toThrow(/stdout exceeds/u);
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	}, 15_000);

	it('captures successful process output and rejects stderr overflow and spawn errors', async () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-guard-process-more-'));
		const runtime = process.versions.bun === undefined ? 'bun' : process.execPath;
		try {
			const success = join(root, 'success.ts');
			writeFileSync(
				success,
				"process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('ok\\n'));\n"
			);
			const result = await executeGuardEnforcementLedgerWorkerProcess(
				runtime,
				success,
				new TextEncoder().encode('request'),
				{ ...request().budgets, maxExecutorDurationMs: 5_000 }
			);
			expect(new TextDecoder().decode(result.stdout)).toBe('ok\n');
			expect(result.stderr.byteLength).toBe(0);

			const stderr = join(root, 'flood-stderr.ts');
			writeFileSync(
				stderr,
				"const chunk='x'.repeat(4096); setInterval(()=>process.stderr.write(chunk),0);\n"
			);
			await expect(
				executeGuardEnforcementLedgerWorkerProcess(runtime, stderr, new Uint8Array(), {
					...request().budgets,
					maxExecutorDurationMs: 5_000,
					maxStderrBytes: 64
				})
			).rejects.toThrow(/stderr exceeds/u);
			await expect(
				executeGuardEnforcementLedgerWorkerProcess(
					join(root, 'missing-executable'),
					success,
					new Uint8Array(),
					request().budgets
				)
			).rejects.toThrow();
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	}, 15_000);

	it.each([
		['CHILD_ERROR', 'EXECUTOR_FAILED'],
		['NONZERO_EXIT', 'EXECUTOR_FAILED'],
		['STDERR_SUCCESS', 'EXECUTOR_FAILED'],
		['INVALID_UTF8', 'RAW_OUTPUT_INVALID'],
		['INVALID_FRAME', 'RAW_OUTPUT_INVALID'],
		['INVALID_JSON', 'RAW_OUTPUT_INVALID']
	] as const)(
		'fails closed for isolated worker outcome %s',
		async (mode, expectedCode) => {
			const binding = currentBinding();
			childProcessControl.mode = mode;
			const events: GuardEnforcementLedgerProgressEvent[] = [];
			const outcome = await observeGuardEnforcementLedger(
				binding.request,
				{ artifactSet: binding.artifactSet, subject: binding.subject },
				{ onProgress: (event) => events.push(event) }
			);
			expect(outcome).toMatchObject({
				diagnostics: [expect.objectContaining({ code: expectedCode })],
				outcome: 'unavailable'
			});
			expect(events.at(-1)).toMatchObject({ phase: 'CAPSULE_CLEANUP', state: 'COMPLETED' });
		},
		120_000
	);
});
