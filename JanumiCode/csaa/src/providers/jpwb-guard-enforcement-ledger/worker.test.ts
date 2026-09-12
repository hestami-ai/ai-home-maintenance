import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import {
	GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
	GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
	GUARD_ENFORCEMENT_LEDGER_WORKER_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION,
	executeGuardEnforcementLedgerWorker,
	parseGuardEnforcementLedgerWorkerRequest,
	type GuardEnforcementLedgerWorkerRequest,
	type GuardEnforcementLedgerWorkerResult
} from './worker.js';

const WORKER_SOURCE_PATH = new URL('./worker.ts', import.meta.url).pathname.replace(
	/^\/(?:[A-Za-z]:)/u,
	(p) => p.slice(1)
);
const roots: string[] = [];

interface Fixture {
	readonly request: GuardEnforcementLedgerWorkerRequest;
	readonly root: string;
}

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, 'utf8');
}

function writePackage(root: string, name: string, source: string, version: string): void {
	const packageRoot = join(root, 'node_modules', ...name.split('/'));
	write(
		join(packageRoot, 'package.json'),
		JSON.stringify({
			exports: { '.': './index.ts', './package.json': './package.json' },
			name,
			type: 'module',
			version
		})
	);
	write(join(packageRoot, 'index.ts'), source);
}

function fixture(): Fixture {
	const root = mkdtempSync(join(tmpdir(), 'csaa-guard-ledger-worker-'));
	roots.push(root);
	write(
		join(root, 'node_modules', '@janumipwb', 'rph-domain', 'package.json'),
		JSON.stringify({
			name: '@janumipwb/rph-domain',
			exports: { '.': './src/index.ts', './package.json': './package.json' },
			type: 'module',
			version: '0.0.0-fixture'
		})
	);
	write(
		join(root, 'node_modules', '@janumipwb', 'rph-domain', 'src', 'index.ts'),
		`export const STATE_MACHINES = {
			Alpha: { transitions: [
				{ from: 'A', to: 'B', guard: 'z guard' },
				{ from: 'B', to: 'C', guard: 'a guard' },
				{ from: 'C', to: 'D', guard: 'missing guard' }
			] }
		};
		export const isExcludedMachine = () => false;
		`
	);
	writePackage(
		root,
		'@janumipwb/rph-contracts',
		'export const fixtureContract = true;\n',
		'0.0.0-fixture'
	);
	writePackage(root, 'typescript', "export const version = '5.9.3-fixture';\n", '5.9.3-fixture');
	writePackage(root, 'ulid', 'export const fixtureUlid = true;\n', '2.3.0-fixture');
	writePackage(root, 'zod', 'export const fixtureZod = true;\n', '4.4.3-fixture');
	write(
		join(root, ...GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH.split('/')),
		`export function guardedArrows() {
			console.assert(true); console.clear(); console.count(); console.countReset();
			console.debug(); console.dir({}); console.dirxml({}); console.error();
			console.group(); console.groupCollapsed(); console.groupEnd(); console.info();
			console.log(); console.table([]); console.time(); console.timeEnd();
			console.timeLog(); console.trace(); console.warn();
			return [
				{ machine: 'Alpha', from: 'A', to: 'B', guard: 'z guard' },
				{ machine: 'Alpha', from: 'B', to: 'C', guard: 'a guard' },
				{ machine: 'Alpha', from: 'C', to: 'D', guard: 'missing guard' }
			].reverse();
		}
		export const guardTexts = () => [...new Set(guardedArrows().map((arrow) => arrow.guard))].reverse();
		export function auditLedger(ledger) {
			const texts = guardTexts();
			const declared = new Set(texts);
			const counts = {};
			for (const text of texts) {
				const row = ledger[text];
				if (row) counts[row.disposition] = (counts[row.disposition] ?? 0) + 1;
			}
			return {
				unclassified: texts.filter((text) => !ledger[text]),
				stale: Object.keys(ledger).filter((text) => !declared.has(text)),
				enforcedWithoutSite: [],
				enforcedAnchorBroken: [],
				counts,
				arrowCount: guardedArrows().length,
				textCount: texts.length
			};
		}
		`
	);
	write(
		join(root, ...GUARD_ENFORCEMENT_LEDGER_DATA_PATH.split('/')),
		`export const GUARD_LEDGER = {
			'z guard': {
				disposition: 'ENFORCED',
				evidence: 'packages/handler.ts:9 refuses the move',
				enforcingSite: 'packages/handler.ts:9',
				enforcingAnchor: 'refuse move'
			},
			'a guard': { disposition: 'UNENFORCED', evidence: 'no refusal found' },
			'stale guard': { disposition: 'ARROW_UNREACHABLE', evidence: 'old row' }
		};
		`
	);
	return {
		request: {
			analyzerPath: GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
			capsuleRoot: root,
			dataPath: GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_REQUEST_SCHEMA_VERSION
		},
		root
	};
}

function runWorker(subject: Fixture, input: unknown) {
	return spawnSync('bun', ['run', WORKER_SOURCE_PATH], {
		cwd: subject.root,
		encoding: 'utf8',
		input: typeof input === 'string' ? input : JSON.stringify(input),
		windowsHide: true
	});
}

async function withFixtureBun<T>(
	subject: Fixture,
	operation: () => Promise<T>,
	version = '1.3.14-fixture',
	resolveOverride?: (specifier: string) => string
): Promise<T> {
	const priorBun = Reflect.getOwnPropertyDescriptor(globalThis, 'Bun');
	const modulePath = (name: string, packageJson = false): string => {
		if (name === '@janumipwb/rph-domain')
			return join(subject.root, 'node_modules', '@janumipwb', 'rph-domain', 'src', 'index.ts');
		if (name === '@janumipwb/rph-contracts')
			return join(subject.root, 'node_modules', '@janumipwb', 'rph-contracts', 'index.ts');
		return join(
			subject.root,
			'node_modules',
			...name.replace('/package.json', '').split('/'),
			packageJson ? 'package.json' : 'index.ts'
		);
	};
	const resolveSync = (specifier: string): string =>
		resolveOverride?.(specifier) ?? modulePath(specifier, specifier.endsWith('/package.json'));
	let priorResolveSync: ((specifier: string) => string) | undefined;
	if (priorBun === undefined) {
		Object.defineProperty(globalThis, 'Bun', {
			configurable: true,
			value: {
				resolveSync,
				version
			}
		});
	} else {
		const bunRuntime = priorBun.value as { resolveSync: (specifier: string) => string };
		priorResolveSync = bunRuntime.resolveSync;
		bunRuntime.resolveSync = resolveSync;
	}
	try {
		return await operation();
	} finally {
		if (priorBun === undefined) Reflect.deleteProperty(globalThis, 'Bun');
		else
			(priorBun.value as { resolveSync: (specifier: string) => string }).resolveSync =
				priorResolveSync!;
	}
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('guard-enforcement ledger capsule worker', () => {
	it('strictly parses the exact request protocol', () => {
		const request: GuardEnforcementLedgerWorkerRequest = {
			analyzerPath: GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
			capsuleRoot: 'C:\\capsule',
			dataPath: GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_REQUEST_SCHEMA_VERSION
		};
		expect(
			parseGuardEnforcementLedgerWorkerRequest(new TextEncoder().encode(JSON.stringify(request)))
		).toEqual(request);
		expect(() =>
			parseGuardEnforcementLedgerWorkerRequest(
				new TextEncoder().encode(JSON.stringify({ ...request, extra: true }))
			)
		).toThrow(/must contain exactly/u);
		expect(() =>
			parseGuardEnforcementLedgerWorkerRequest(new TextEncoder().encode('{bad-json'))
		).toThrow(/exactly one valid JSON value/u);
		expect(() => parseGuardEnforcementLedgerWorkerRequest(Uint8Array.from([0xff]))).toThrow(
			/not valid UTF-8/u
		);
		expect(() =>
			parseGuardEnforcementLedgerWorkerRequest(
				Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(JSON.stringify(request))])
			)
		).toThrow(/must not contain a UTF-8 BOM/u);
		for (const malformed of [
			[],
			{ ...request, schemaVersion: 'wrong' },
			{ ...request, analyzerPath: '' },
			{ ...request, dataPath: 'bad\0path' }
		])
			expect(() =>
				parseGuardEnforcementLedgerWorkerRequest(
					new TextEncoder().encode(JSON.stringify(malformed))
				)
			).toThrow();
	});

	it('executes both retained exports, sorts every population, and preserves audit findings', async () => {
		const subject = fixture();
		const first = runWorker(subject, subject.request);
		expect(first.status, first.stderr).toBe(0);
		expect(first.stderr).toBe('');
		expect(first.stdout.endsWith('\n')).toBe(true);
		expect(first.stdout.slice(0, -1)).not.toContain('\n');

		const result = JSON.parse(first.stdout) as GuardEnforcementLedgerWorkerResult;
		expect(result).toEqual({
			analyzerResolvedPath: GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
			audit: {
				arrowCount: 3,
				counts: [
					{ count: 1, disposition: 'ENFORCED' },
					{ count: 1, disposition: 'UNENFORCED' }
				],
				enforcedAnchorBroken: [],
				enforcedWithoutSite: [],
				stale: ['stale guard'],
				textCount: 3,
				unclassified: ['missing guard']
			},
			contractsResolvedPath: 'node_modules/@janumipwb/rph-contracts/index.ts',
			dataResolvedPath: GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
			domainResolvedPath: 'node_modules/@janumipwb/rph-domain/src/index.ts',
			guardTexts: ['a guard', 'missing guard', 'z guard'],
			guardedArrows: [
				{ from: 'A', guard: 'z guard', machine: 'Alpha', to: 'B' },
				{ from: 'B', guard: 'a guard', machine: 'Alpha', to: 'C' },
				{ from: 'C', guard: 'missing guard', machine: 'Alpha', to: 'D' }
			],
			ledgerRows: [
				{
					disposition: 'UNENFORCED',
					enforcingAnchor: null,
					enforcingSite: null,
					evidence: 'no refusal found',
					guardText: 'a guard'
				},
				{
					disposition: 'ARROW_UNREACHABLE',
					enforcingAnchor: null,
					enforcingSite: null,
					evidence: 'old row',
					guardText: 'stale guard'
				},
				{
					disposition: 'ENFORCED',
					enforcingAnchor: 'refuse move',
					enforcingSite: 'packages/handler.ts:9',
					evidence: 'packages/handler.ts:9 refuses the move',
					guardText: 'z guard'
				}
			],
			runtime: {
				bunVersion: expect.any(String),
				typescriptResolvedPath: expect.stringContaining(subject.root),
				typescriptVersion: '5.9.3-fixture',
				ulidResolvedPath: expect.stringContaining(subject.root),
				ulidVersion: '2.3.0-fixture',
				zodResolvedPath: expect.stringContaining(subject.root),
				zodVersion: '4.4.3-fixture'
			},
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION
		});

		const second = runWorker(subject, subject.request);
		expect(second.status, second.stderr).toBe(0);
		expect(second.stdout).toBe(first.stdout);

		// Exercise the exported worker operation in-process as well as through its
		// command boundary. Vitest does not merge coverage from the spawned Bun
		// process. Its coverage workers also run under Node, so install only the
		// two Bun runtime capabilities this operation consumes and bind every
		// resolution to the already materialized fixture tree.
		await withFixtureBun(
			subject,
			async () => {
				expect(await executeGuardEnforcementLedgerWorker(subject.request)).toEqual(result);
			},
			result.runtime.bunVersion
		);
	});

	it('rejects locators outside the exact materialized retained paths', () => {
		const subject = fixture();
		for (const malformed of [
			{ ...subject.request, capsuleRoot: 'relative' },
			{ ...subject.request, analyzerPath: '../outside.ts' },
			{ ...subject.request, dataPath: 'verif/other.data.ts' }
		]) {
			const execution = runWorker(subject, malformed);
			expect(execution.status).not.toBe(0);
			expect(execution.stdout).toBe('');
		}
	});

	it('fails closed when the retained data omits GUARD_LEDGER', () => {
		const subject = fixture();
		write(
			join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_DATA_PATH.split('/')),
			'export const DIFFERENT = {};\n'
		);
		const execution = runWorker(subject, subject.request);
		expect(execution.status).not.toBe(0);
		expect(execution.stdout).toBe('');
		expect(execution.stderr).toMatch(/must export GUARD_LEDGER/u);
	});

	// ⚠ CONTROL — a specifier the capsule cannot resolve MUST reach the operator by name. Bun raises a
	// `ResolveMessage`, which is NOT `instanceof Error`, so the catch at the foot of `worker.ts` replaced it
	// with a path-free constant; because the surviving text carried no path, its SHA-256 was byte-identical on
	// every run even though the capsule root is a random `mkdtempSync`, and the parent hashes stderr away
	// entirely. An outage that named its own missing file was reported as `unknown failure`.
	// The specifier here is deliberately NOT a real repository path: a control naming the file it was written
	// for proves only that someone remembered that file. `toBeTruthy()` on stderr would pass today.
	it('names the unresolvable specifier instead of reporting an unknown failure', () => {
		const subject = fixture();
		write(
			join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH.split('/')),
			`import { absent } from './control-absent-dependency.js';
			export const guardedArrows = () => [absent];
			export const guardTexts = () => [];
			export function auditLedger() {
				return { unclassified: [], stale: [], enforcedWithoutSite: [], enforcedAnchorBroken: [],
					counts: {}, arrowCount: 0, textCount: 0 };
			}
			`
		);
		const execution = runWorker(subject, subject.request);
		expect(execution.status).not.toBe(0);
		expect(execution.stdout).toBe('');
		expect(execution.stderr).toMatch(/control-absent-dependency/u);
	});

	it('fails closed in-process across locator, module, export, and retained-value boundaries', async () => {
		const run = async (
			mutate: (subject: Fixture) => GuardEnforcementLedgerWorkerRequest,
			message: RegExp
		): Promise<void> => {
			const subject = fixture();
			await withFixtureBun(subject, async () => {
				await expect(executeGuardEnforcementLedgerWorker(mutate(subject))).rejects.toThrow(message);
			});
		};
		await run((subject) => ({ ...subject.request, capsuleRoot: 'relative' }), /absolute path/u);
		await run(
			(subject) => ({ ...subject.request, analyzerPath: GUARD_ENFORCEMENT_LEDGER_DATA_PATH }),
			/analyzerPath must be exactly/u
		);
		await run(
			(subject) => ({ ...subject.request, dataPath: GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH }),
			/dataPath must be exactly/u
		);
		await run((subject) => {
			write(
				join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH.split('/')),
				'export {};\n'
			);
			return subject.request;
		}, /must export function/u);
		await run((subject) => {
			write(join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_DATA_PATH.split('/')), 'export {};\n');
			return subject.request;
		}, /must export GUARD_LEDGER/u);
		await run((subject) => {
			write(
				join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH.split('/')),
				`export const guardedArrows=()=>null; export const guardTexts=()=>[]; export const auditLedger=()=>({});\n`
			);
			return subject.request;
		}, /guardedArrows\(\) must return an array/u);
		await run((subject) => {
			write(
				join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH.split('/')),
				`export const guardedArrows=()=>[{machine:'M',from:'A',to:'B',guard:'g',extra:true}]; export const guardTexts=()=>['g']; export const auditLedger=()=>({arrowCount:1,textCount:1,counts:[],enforcedAnchorBroken:[],enforcedWithoutSite:[],stale:[],unclassified:[]});\n`
			);
			return subject.request;
		}, /must contain exactly/u);
		await run((subject) => {
			write(
				join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_DATA_PATH.split('/')),
				`export const GUARD_LEDGER={g:{disposition:'WRONG',evidence:'x'}};\n`
			);
			return subject.request;
		}, /recognized guard disposition/u);

		const noRuntime = fixture();
		if (Reflect.getOwnPropertyDescriptor(globalThis, 'Bun') === undefined)
			await expect(executeGuardEnforcementLedgerWorker(noRuntime.request)).rejects.toThrow(
				/must execute under Bun/u
			);
		await run(
			(subject) => ({ ...subject.request, capsuleRoot: join(subject.root, 'missing') }),
			/does not resolve/u
		);
		await run((subject) => {
			const path = join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH.split('/'));
			rmSync(path);
			mkdirSync(path);
			return subject.request;
		}, /regular file/u);

		const unresolved = fixture();
		await withFixtureBun(
			unresolved,
			async () => {
				await expect(executeGuardEnforcementLedgerWorker(unresolved.request)).rejects.toThrow(
					/cannot be resolved/u
				);
			},
			'1.3.14-fixture',
			() => {
				throw new Error('resolution failed');
			}
		);
		const outside = fixture();
		await withFixtureBun(
			outside,
			async () => {
				await expect(executeGuardEnforcementLedgerWorker(outside.request)).rejects.toThrow(
					/inside capsuleRoot/u
				);
			},
			'1.3.14-fixture',
			(specifier) =>
				specifier === '@janumipwb/rph-domain' ? process.execPath : (undefined as never)
		);

		for (const [packageName, content, message] of [
			['typescript', '{bad-json', /valid JSON value/u],
			['typescript', '\ufeff{"version":"5.9.3"}', /UTF-8 BOM/u],
			['ulid', '[]', /must be a JSON object/u],
			['zod', '{}', /version/u]
		] as const) {
			const subject = fixture();
			write(join(subject.root, 'node_modules', packageName, 'package.json'), content);
			await withFixtureBun(subject, async () => {
				await expect(executeGuardEnforcementLedgerWorker(subject.request)).rejects.toThrow(message);
			});
		}

		for (const [analyzerSource, dataSource, message] of [
			[
				`export const guardedArrows=()=>[]; export const guardTexts=()=>null; export const auditLedger=()=>({});\n`,
				null,
				/must be an array/u
			],
			[
				`export const guardedArrows=()=>[null]; export const guardTexts=()=>['g']; export const auditLedger=()=>({});\n`,
				null,
				/must be an object/u
			],
			[
				`export const guardedArrows=()=>[]; export const guardTexts=()=>[]; export const auditLedger=()=>({arrowCount:-1,textCount:0,counts:{},enforcedAnchorBroken:[],enforcedWithoutSite:[],stale:[],unclassified:[]});\n`,
				null,
				/non-negative safe integer/u
			],
			[null, `export const GUARD_LEDGER=null;\n`, /must be an object/u],
			[null, `export const GUARD_LEDGER={g:null};\n`, /must be an object/u],
			[
				null,
				`export const GUARD_LEDGER={g:{disposition:'ENFORCED'}};\n`,
				/must contain disposition and evidence/u
			]
		] as const) {
			const subject = fixture();
			if (analyzerSource !== null)
				write(
					join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH.split('/')),
					analyzerSource
				);
			if (dataSource !== null)
				write(join(subject.root, ...GUARD_ENFORCEMENT_LEDGER_DATA_PATH.split('/')), dataSource);
			await withFixtureBun(subject, async () => {
				await expect(executeGuardEnforcementLedgerWorker(subject.request)).rejects.toThrow(message);
			});
		}

		const duplicate = fixture();
		write(
			join(duplicate.root, ...GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH.split('/')),
			`const arrow={machine:'M',from:'A',to:'B',guard:'g'}; export const guardedArrows=()=>[arrow,arrow]; export const guardTexts=()=>['g']; export const auditLedger=()=>({arrowCount:2,textCount:1,counts:{ENFORCED:1},enforcedAnchorBroken:[],enforcedWithoutSite:[],stale:[],unclassified:[]});\n`
		);
		await withFixtureBun(duplicate, async () => {
			expect(
				(await executeGuardEnforcementLedgerWorker(duplicate.request)).guardedArrows
			).toHaveLength(2);
		});
	});
});
