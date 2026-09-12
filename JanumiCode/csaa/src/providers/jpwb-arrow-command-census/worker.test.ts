import { spawnSync } from 'node:child_process';
import {
	copyFileSync,
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION,
	executeArrowCommandCensusWorker,
	parseArrowCommandCensusWorkerRequest,
	type ArrowCommandCensusWorkerResult
} from './worker.js';

const WORKER_SOURCE_PATH = fileURLToPath(new URL('./worker.ts', import.meta.url));
const roots: string[] = [];

interface CapsuleFixture {
	readonly analyzerMarkerPath: string;
	readonly request: {
		readonly analyzerPath: 'verif/arrow-command-census.ts';
		readonly capsuleRoot: string;
		readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION;
	};
	readonly root: string;
	readonly workerPath: string;
}

type AnalyzerExportName =
	'birthStates' | 'census' | 'deadCovered' | 'declaredArrows' | 'occupiable';

const VALID_ANALYZER_BODIES: Readonly<Record<AnalyzerExportName, string>> = {
	birthStates: "return new Map([['Beta', new Set(['B1', 'B0'])], ['Alpha', new Set(['A0'])]]);",
	census: "return { uncovered: ['Alpha  A1 -> A2'], orphans: ['Delta'], total: 3 };",
	deadCovered: "return { dead: ['Beta  B0 -> B1'], unanalysed: ['Gamma'] };",
	declaredArrows: `return [
    { machine: 'Beta', from: 'B0', to: 'B1', site: 'b.ts:9' },
    { machine: 'Alpha', from: 'A0', to: 'A1', site: 'a.ts:2' }
  ];`,
	occupiable: "return new Map([['Beta', new Set(['B1', 'B0'])], ['Alpha', new Set(['A1', 'A0'])]]);"
};

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
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

function fixture(): CapsuleFixture {
	const root = mkdtempSync(join(tmpdir(), 'jan-csaa-arrow-worker-'));
	roots.push(root);
	const workerPath = join(root, 'worker.ts');
	copyFileSync(WORKER_SOURCE_PATH, workerPath);

	writePackage(
		root,
		'@janumipwb/rph-domain',
		"export const DOMAIN_SENTINEL = 'domain';\n",
		'0.0.0'
	);
	writePackage(
		root,
		'@janumipwb/rph-contracts',
		"export const CONTRACT_SENTINEL = 'contracts';\n",
		'0.0.0'
	);
	writePackage(root, 'typescript', "export const version = '5.9.3-fixture';\n", '5.9.3-fixture');
	writePackage(root, 'zod', 'export const fixture = true;\n', '4.4.3-fixture');
	writePackage(root, 'ulid', 'export const fixture = true;\n', '2.3.0-fixture');

	const analyzerMarkerPath = join(root, 'analyzer-imported.txt');
	write(
		join(root, 'verif', 'arrow-command-census.ts'),
		`import { writeFileSync } from 'node:fs';
import { DOMAIN_SENTINEL } from '@janumipwb/rph-domain';
import { CONTRACT_SENTINEL } from '@janumipwb/rph-contracts';
writeFileSync(${JSON.stringify(analyzerMarkerPath)}, DOMAIN_SENTINEL + ':' + CONTRACT_SENTINEL);
console.log('subject import noise');
export function declaredArrows() {
  console.warn('subject invocation noise');
  return [
    { machine: 'Beta', from: 'B0', to: 'B1', site: 'b.ts:9' },
    { machine: 'Alpha', from: 'A0', to: 'A1', site: 'a.ts:2' }
  ];
}
export function birthStates() {
  return new Map([['Beta', new Set(['B1', 'B0'])], ['Alpha', new Set(['A0'])]]);
}
export function occupiable() {
  return new Map([['Beta', new Set(['B1', 'B0'])], ['Alpha', new Set(['A1', 'A0'])]]);
}
export function deadCovered() { return { dead: ['Beta  B0 -> B1'], unanalysed: ['Gamma'] }; }
export function census() { return { uncovered: ['Alpha  A1 -> A2'], orphans: ['Delta'], total: 3 }; }
`
	);
	write(
		join(root, 'verif', 'arrow-command-census.baseline.json'),
		JSON.stringify({
			uncovered: ['Alpha  A1 -> A2'],
			orphans: ['Delta'],
			total: 3,
			dead: ['Beta  B0 -> B1'],
			unanalysed: ['Gamma']
		})
	);

	return {
		analyzerMarkerPath,
		request: {
			analyzerPath: 'verif/arrow-command-census.ts',
			capsuleRoot: root,
			schemaVersion: ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION
		},
		root,
		workerPath
	};
}

function writeDirectAnalyzer(
	subject: CapsuleFixture,
	overrides: Partial<Record<AnalyzerExportName, string>> = {},
	omit?: AnalyzerExportName
): void {
	const bodies = { ...VALID_ANALYZER_BODIES, ...overrides };
	const exports = (Object.keys(bodies) as AnalyzerExportName[])
		.filter((name) => name !== omit)
		.map((name) => `export function ${name}() { ${bodies[name]} }`)
		.join('\n');
	write(
		join(subject.root, 'verif', 'arrow-command-census.ts'),
		`import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(subject.analyzerMarkerPath)}, 'direct');
console.assert(false);
console.clear();
console.count();
console.countReset();
console.debug();
console.dir(null);
console.dirxml();
console.error();
console.group();
console.groupCollapsed();
console.groupEnd();
console.info();
console.log('subject import noise');
console.table([]);
console.time();
console.timeEnd();
console.timeLog();
console.trace();
console.warn();
${exports}
`
	);
}

function installBunResolver(
	subject: CapsuleFixture,
	overrides: Readonly<Record<string, string>> = {},
	rejectedSpecifier?: string
): void {
	const resolutions: Readonly<Record<string, string>> = {
		'@janumipwb/rph-contracts': join(
			subject.root,
			'node_modules',
			'@janumipwb',
			'rph-contracts',
			'index.ts'
		),
		'@janumipwb/rph-domain': join(
			subject.root,
			'node_modules',
			'@janumipwb',
			'rph-domain',
			'index.ts'
		),
		typescript: pathToFileURL(join(subject.root, 'node_modules', 'typescript', 'index.ts')).href,
		'typescript/package.json': join(subject.root, 'node_modules', 'typescript', 'package.json'),
		ulid: join(subject.root, 'node_modules', 'ulid', 'index.ts'),
		'ulid/package.json': join(subject.root, 'node_modules', 'ulid', 'package.json'),
		zod: join(subject.root, 'node_modules', 'zod', 'index.ts'),
		'zod/package.json': join(subject.root, 'node_modules', 'zod', 'package.json'),
		...overrides
	};
	vi.stubGlobal('Bun', {
		resolveSync(specifier: string): string {
			if (specifier === rejectedSpecifier)
				throw new Error(`rejected fixture specifier: ${specifier}`);
			const resolution = resolutions[specifier];
			if (resolution === undefined) throw new Error(`unexpected fixture specifier: ${specifier}`);
			return resolution;
		},
		version: '1.3.14-test'
	});
}

function cleanEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
	const environment = { ...process.env };
	delete environment.PIN_ARROW_BASELINE;
	return { ...environment, ...extra };
}

function runWorker(
	subject: CapsuleFixture,
	input: unknown,
	extraEnvironment: NodeJS.ProcessEnv = {}
) {
	return spawnSync('bun', ['run', subject.workerPath], {
		cwd: subject.root,
		encoding: 'utf8',
		env: cleanEnvironment(extraEnvironment),
		input: typeof input === 'string' ? input : JSON.stringify(input),
		windowsHide: true
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('arrow-command census capsule worker', () => {
	it('strictly parses the exact request protocol', () => {
		const request = {
			analyzerPath: 'verif/arrow-command-census.ts',
			capsuleRoot: 'C:\\capsule',
			schemaVersion: ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION
		};
		expect(
			parseArrowCommandCensusWorkerRequest(new TextEncoder().encode(JSON.stringify(request)))
		).toEqual(request);
		expect(() =>
			parseArrowCommandCensusWorkerRequest(
				new TextEncoder().encode(JSON.stringify({ ...request, unexpected: true }))
			)
		).toThrow(/must contain exactly/);
		expect(() =>
			parseArrowCommandCensusWorkerRequest(
				new TextEncoder().encode(JSON.stringify({ ...request, schemaVersion: 'wrong' }))
			)
		).toThrow(/unsupported request schemaVersion/);
		expect(() => parseArrowCommandCensusWorkerRequest(Uint8Array.from([0xff]))).toThrow(
			/not valid UTF-8/
		);
		expect(() =>
			parseArrowCommandCensusWorkerRequest(
				Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(JSON.stringify(request))])
			)
		).toThrow(/must not contain a UTF-8 BOM/u);
		expect(() =>
			parseArrowCommandCensusWorkerRequest(new TextEncoder().encode('{not-json'))
		).toThrow(/must be exactly one valid JSON value/);
		expect(() => parseArrowCommandCensusWorkerRequest(new TextEncoder().encode('[]'))).toThrow(
			/request must be a JSON object/
		);
	});

	it('executes the retained exports unchanged and emits one deterministic JSON value', () => {
		const subject = fixture();
		const first = runWorker(subject, subject.request);
		expect(first.status, first.stderr).toBe(0);
		expect(first.stderr).toBe('');
		expect(first.stdout.endsWith('\n')).toBe(true);
		expect(first.stdout.slice(0, -1)).not.toContain('\n');

		const result = JSON.parse(first.stdout) as ArrowCommandCensusWorkerResult;
		expect(result).toMatchObject({
			analyzerResolvedPath: 'verif/arrow-command-census.ts',
			baseline: {
				dead: ['Beta  B0 -> B1'],
				orphans: ['Delta'],
				total: 3,
				unanalysed: ['Gamma'],
				uncovered: ['Alpha  A1 -> A2']
			},
			birthStates: [
				{ machine: 'Alpha', states: ['A0'] },
				{ machine: 'Beta', states: ['B0', 'B1'] }
			],
			contractsResolvedPath: 'node_modules/@janumipwb/rph-contracts/index.ts',
			declaredArrows: [
				{ from: 'B0', machine: 'Beta', site: 'b.ts:9', to: 'B1' },
				{ from: 'A0', machine: 'Alpha', site: 'a.ts:2', to: 'A1' }
			],
			domainResolvedPath: 'node_modules/@janumipwb/rph-domain/index.ts',
			runtime: {
				bunVersion: expect.any(String),
				typescriptVersion: '5.9.3-fixture',
				ulidVersion: '2.3.0-fixture',
				zodVersion: '4.4.3-fixture'
			},
			schemaVersion: ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION
		});
		expect(result.runtime.typescriptResolvedPath).toContain(subject.root);
		expect(result.runtime.ulidResolvedPath).toContain(subject.root);
		expect(result.runtime.zodResolvedPath).toContain(subject.root);
		expect(readFileSync(subject.analyzerMarkerPath, 'utf8')).toBe('domain:contracts');

		const second = runWorker(subject, subject.request);
		expect(second.status, second.stderr).toBe(0);
		expect(second.stdout).toBe(first.stdout);
	});

	it('executes the retained analyzer directly and restores the process console', async () => {
		const subject = fixture();
		writeDirectAnalyzer(subject);
		installBunResolver(subject);
		const originalConsole = globalThis.console;

		const result = await executeArrowCommandCensusWorker(subject.request);

		expect(globalThis.console).toBe(originalConsole);
		expect(result).toMatchObject({
			analyzerResolvedPath: 'verif/arrow-command-census.ts',
			baseline: {
				dead: ['Beta  B0 -> B1'],
				orphans: ['Delta'],
				total: 3,
				unanalysed: ['Gamma'],
				uncovered: ['Alpha  A1 -> A2']
			},
			birthStates: [
				{ machine: 'Alpha', states: ['A0'] },
				{ machine: 'Beta', states: ['B0', 'B1'] }
			],
			census: {
				orphans: ['Delta'],
				total: 3,
				uncovered: ['Alpha  A1 -> A2']
			},
			deadCovered: {
				dead: ['Beta  B0 -> B1'],
				unanalysed: ['Gamma']
			},
			occupiable: [
				{ machine: 'Alpha', states: ['A0', 'A1'] },
				{ machine: 'Beta', states: ['B0', 'B1'] }
			],
			runtime: {
				bunVersion: '1.3.14-test',
				typescriptVersion: '5.9.3-fixture',
				ulidVersion: '2.3.0-fixture',
				zodVersion: '4.4.3-fixture'
			},
			schemaVersion: ARROW_COMMAND_CENSUS_WORKER_RESULT_SCHEMA_VERSION
		});
		expect(readFileSync(subject.analyzerMarkerPath, 'utf8')).toBe('direct');
	});

	it('rejects direct execution without the required Bun runtime identity', async () => {
		const subject = fixture();
		vi.stubGlobal('Bun', undefined);

		await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(
			/must execute under Bun with Bun\.resolveSync available/
		);
	});

	it('rejects direct request locators before reading subject files', async () => {
		const subject = fixture();
		installBunResolver(subject);

		await expect(
			executeArrowCommandCensusWorker({ ...subject.request, capsuleRoot: 'relative-capsule' })
		).rejects.toThrow(/request\.capsuleRoot must be an absolute path/);
		await expect(
			executeArrowCommandCensusWorker({ ...subject.request, analyzerPath: subject.workerPath })
		).rejects.toThrow(/request\.analyzerPath must be capsule-relative/);
		await expect(
			executeArrowCommandCensusWorker({ ...subject.request, analyzerPath: 'verif/other.ts' })
		).rejects.toThrow(/request\.analyzerPath must be exactly/);
	});

	it('fails closed for invalid capsule topology and subject resolution', async () => {
		let subject = fixture();
		installBunResolver(subject);
		rmSync(subject.root, { force: true, recursive: true });
		await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(
			/capsuleRoot does not resolve to an existing path/
		);

		subject = fixture();
		installBunResolver(subject);
		await expect(
			executeArrowCommandCensusWorker({ ...subject.request, capsuleRoot: subject.workerPath })
		).rejects.toThrow(/capsuleRoot must resolve to a directory/);

		subject = fixture();
		installBunResolver(subject);
		const analyzerPath = join(subject.root, 'verif', 'arrow-command-census.ts');
		rmSync(analyzerPath);
		mkdirSync(analyzerPath);
		await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(
			/analyzerPath must resolve to a regular file/
		);

		subject = fixture();
		installBunResolver(subject, { '@janumipwb/rph-domain': WORKER_SOURCE_PATH });
		await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(
			/@janumipwb\/rph-domain must resolve to a file inside capsuleRoot/
		);

		subject = fixture();
		installBunResolver(subject, {}, '@janumipwb/rph-domain');
		await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(
			/@janumipwb\/rph-domain cannot be resolved from the retained analyzer/
		);
	});

	it.each([
		['invalid JSON', '{not-json', /package\.json must contain exactly one valid JSON value/],
		['a non-object value', '[]', /package\.json must be a JSON object/],
		['an empty version', '{"version":""}', /package\.json version must be a non-empty string/]
	] as const)(
		'fails closed when a runtime package manifest contains %s',
		async (_, value, error) => {
			const subject = fixture();
			installBunResolver(subject);
			write(join(subject.root, 'node_modules', 'typescript', 'package.json'), value);

			await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(error);
			expect(existsSync(subject.analyzerMarkerPath)).toBe(false);
		}
	);

	it('rejects baseline-pinning influence during direct execution', async () => {
		const subject = fixture();
		const previousPin = process.env.PIN_ARROW_BASELINE;
		process.env.PIN_ARROW_BASELINE = '1';

		try {
			await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(
				/PIN_ARROW_BASELINE is forbidden/
			);
		} finally {
			if (previousPin === undefined) delete process.env.PIN_ARROW_BASELINE;
			else process.env.PIN_ARROW_BASELINE = previousPin;
		}
		expect(existsSync(subject.analyzerMarkerPath)).toBe(false);
	});

	it.each([
		['invalid JSON', '{not-json', /baseline must contain exactly one valid JSON value/],
		['a non-object value', '[]', /baseline must be a JSON object/],
		[
			'a missing field',
			JSON.stringify({ dead: [], orphans: [], total: 0, uncovered: [] }),
			/baseline must contain exactly/
		],
		[
			'a negative total',
			JSON.stringify({
				dead: [],
				orphans: [],
				total: -1,
				unanalysed: [],
				uncovered: []
			}),
			/baseline census\.total must be a non-negative safe integer/
		],
		[
			'a malformed finding',
			JSON.stringify({
				dead: [''],
				orphans: [],
				total: 0,
				unanalysed: [],
				uncovered: []
			}),
			/baseline deadCovered\.dead\[0\] must be a non-empty string/
		],
		[
			'a non-array finding set',
			JSON.stringify({
				dead: null,
				orphans: [],
				total: 0,
				unanalysed: [],
				uncovered: []
			}),
			/baseline deadCovered\.dead must be an array/
		]
	] as const)(
		'fails closed before analyzer import when the baseline contains %s',
		async (_, value, error) => {
			const subject = fixture();
			writeDirectAnalyzer(subject);
			installBunResolver(subject);
			write(join(subject.root, 'verif', 'arrow-command-census.baseline.json'), value);

			await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(error);
			expect(existsSync(subject.analyzerMarkerPath)).toBe(false);
		}
	);

	it.each([
		['declaredArrows', 'return null;', /declaredArrows\(\) must return an array/],
		['declaredArrows', 'return [null];', /declaredArrows\(\)\[0\] must be an object/],
		[
			'declaredArrows',
			"return [{ machine: 'Alpha', from: 'A0', to: 'A1', site: '' }];",
			/declaredArrows\(\)\[0\]\.site must be a non-empty string/
		],
		['birthStates', 'return {};', /birthStates\(\) must return a Map/],
		[
			'birthStates',
			"return new Map([['Alpha', []]]);",
			/birthStates\(\)\.get\("Alpha"\) must be a Set/
		],
		[
			'occupiable',
			"return new Map([['Alpha', new Set([''])]]);",
			/occupiable\(\)\.get\("Alpha"\)\[0\] must be a non-empty string/
		],
		['deadCovered', 'return [];', /deadCovered\(\) must be an object/],
		[
			'deadCovered',
			'return { dead: [], unanalysed: [], extra: [] };',
			/deadCovered\(\) must contain exactly/
		],
		['census', 'return null;', /census\(\) must be an object/],
		[
			'census',
			'return { uncovered: [], orphans: [], total: -1 };',
			/census\(\)\.total must be a non-negative safe integer/
		]
	] as const)('fails closed when %s returns a malformed value', async (exportName, body, error) => {
		const subject = fixture();
		writeDirectAnalyzer(subject, { [exportName]: body });
		installBunResolver(subject);
		const originalConsole = globalThis.console;

		await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(error);
		expect(globalThis.console).toBe(originalConsole);
	});

	it('fails closed when the retained analyzer omits a required export', async () => {
		const subject = fixture();
		writeDirectAnalyzer(subject, {}, 'deadCovered');
		installBunResolver(subject);
		const originalConsole = globalThis.console;

		await expect(executeArrowCommandCensusWorker(subject.request)).rejects.toThrow(
			/retained analyzer must export function deadCovered\(\)/
		);
		expect(globalThis.console).toBe(originalConsole);
	});

	it('refuses baseline-pinning influence before importing the analyzer', () => {
		const subject = fixture();
		const execution = runWorker(subject, subject.request, { PIN_ARROW_BASELINE: '1' });
		expect(execution.status).not.toBe(0);
		expect(execution.stdout).toBe('');
		expect(execution.stderr).toMatch(/PIN_ARROW_BASELINE is forbidden/);
		expect(existsSync(subject.analyzerMarkerPath)).toBe(false);
	});

	it('fails before analyzer import when a subject package is not capsule-resolved', () => {
		const subject = fixture();
		rmSync(join(subject.root, 'node_modules', '@janumipwb', 'rph-domain'), {
			force: true,
			recursive: true
		});
		const execution = runWorker(subject, subject.request);
		expect(execution.status).not.toBe(0);
		expect(execution.stdout).toBe('');
		expect(execution.stderr).toMatch(/@janumipwb\/rph-domain cannot be resolved/);
		expect(existsSync(subject.analyzerMarkerPath)).toBe(false);
	});

	it('rejects any analyzer locator other than the exact capsule-relative retained path', () => {
		const subject = fixture();
		const execution = runWorker(subject, { ...subject.request, analyzerPath: '../outside.ts' });
		expect(execution.status).not.toBe(0);
		expect(execution.stdout).toBe('');
		expect(execution.stderr).toMatch(/analyzerPath must be exactly/);
		expect(existsSync(subject.analyzerMarkerPath)).toBe(false);
	});
});
