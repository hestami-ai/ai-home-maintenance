/**
 * The Sonar runner's committed checks (JAN-SONARCM D-1; roadmap S1): the scope census (V-3(a)), no machine path in
 * the tooling (V-2), and every decision the runner makes before and while it drives the engine — the pinned engine
 * (V-1's four limbs), the rule set and the server's echo of it (V-4's mechanism), the census's files and tsconfigs,
 * and the output folder (V-20, J4). Each predicted red is a fixture that fails alone, with its own message, while the
 * real inputs pass. The runs of the real engine are one-off proofs saved with the server's echo, not tests here.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { trackedFiles } from '../scripts/sonar/census.js';
import { CENSUS_FILE, censusDrift, censusOf, PROPERTIES_FILE, sonarPattern, type Census } from '../scripts/sonar/scope.js';

type Core = typeof import('../scripts/sonar/runner-core.cjs');
type RunnerCli = typeof import('../scripts/sonar/batch-runner.cjs');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = createRequire(import.meta.url);
const core = load('../scripts/sonar/runner-core.cjs') as Core;
const cli = load('../scripts/sonar/batch-runner.cjs') as RunnerCli;

const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const committedCensus = JSON.parse(read(CENSUS_FILE)) as Census;
const properties = read(PROPERTIES_FILE);
const matrix = JSON.parse(read('scripts/toolchain/matrix.json')) as unknown;
const machinePaths = JSON.parse(read('scripts/toolchain/machine-paths.json')) as { sonarlint: Record<string, unknown> };
const pins = core.pinsFromMatrix(matrix);

const scratch: string[] = [];
function tempDir(label: string): string {
	const d = mkdtempSync(join(tmpdir(), `jpwb-sonar-${label}-`));
	scratch.push(d);
	return d;
}
afterAll(() => {
	for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

/** The refusal message a call throws; fails the test when it throws nothing or something else. */
function refusalOf(fn: () => unknown): string {
	try {
		fn();
	} catch (e) {
		expect(e).toBeInstanceOf(core.Refusal);
		return (e as Error).message;
	}
	throw new Error('expected a refusal, and the call returned');
}

describe('the scope census (V-3(a))', () => {
	const tracked = trackedFiles(ROOT);
	const fresh = censusOf(properties, tracked);

	it('is exactly what sonar-project.properties selects from the tracked files', () => {
		expect(censusDrift(committedCensus, fresh)).toEqual([]);
	});

	it('PREDICTED RED: a new scripts/*.ts not in the census is named, with the command that fixes it', () => {
		const grown = censusOf(properties, [...tracked, 'scripts/sonar-census-red.ts']);
		expect(censusDrift(committedCensus, grown)).toEqual([
			`${CENSUS_FILE}: 1 file(s) in scope but not in the census: scripts/sonar-census-red.ts. Run \`bun run sonar:census\` and commit the result.`
		]);
	});

	it('PREDICTED RED: a census file that left the scope is named', () => {
		const gone = committedCensus.files[0] ?? '';
		const shrunk = censusOf(
			properties,
			tracked.filter((p) => p !== gone)
		);
		expect(censusDrift(committedCensus, shrunk)).toEqual([
			`${CENSUS_FILE}: 1 file(s) in the census but no longer in scope: ${gone}. Run \`bun run sonar:census\` and commit the result.`
		]);
	});

	it('leaves out the tests, the .svelte files and the excluded folders, and keeps the analysable suffixes', () => {
		const leftOut = censusOf(properties, ['apps/a/b.test.ts', 'apps/a/c.svelte', 'apps/a/dist/d.js', 'apps/a/__tests__/e.ts', 'apps/a/f.md', 'apps/a/g.cjs', 'docs/h.ts']);
		expect(leftOut.files).toEqual(['apps/a/g.cjs']);
		expect(leftOut.counts.leftOut).toEqual({
			'.svelte (no analyzer)': 1,
			'excluded by **/*.test.ts': 1,
			'excluded by **/__tests__/**': 1,
			'excluded by **/dist/**': 1
		});
	});

	it("records the tsconfigs the properties' globs match, which the runner holds the server's list to", () => {
		expect(committedCensus.tsconfigs).toContain('tsconfig.json');
		expect(committedCensus.tsconfigs).toContain('scripts/tsconfig.json');
		expect(committedCensus.tsconfigs.filter((t) => t.includes('.svelte-kit') || t.startsWith('docs/'))).toEqual([]);
	});

	it("follows Sonar's wildcards: * within a segment, ** across segments", () => {
		expect(sonarPattern('**/dist/**').test('apps/x/dist/a.js')).toBe(true);
		expect(sonarPattern('**/dist/**').test('apps/distx/a.js')).toBe(false);
		expect(sonarPattern('**/*.test.ts').test('b.test.ts')).toBe(true);
		expect(sonarPattern('**/*.test.ts').test('a/b.test.ts')).toBe(true);
		expect(sonarPattern('**/*.test.ts').test('a/b.test.tsx')).toBe(false);
		expect(sonarPattern('packages/*/tsconfig.json').test('packages/a/tsconfig.json')).toBe(true);
		expect(sonarPattern('packages/*/tsconfig.json').test('packages/a/b/tsconfig.json')).toBe(false);
		expect(sonarPattern('tsconfig.json').test('apps/tsconfig.json')).toBe(false);
		expect(() => sonarPattern('a[b]')).toThrow('is not supported here');
	});
});

/** Every line of `text` holding an absolute machine path: a drive letter, or a POSIX home. */
function machinePathLines(text: string): number[] {
	return text
		.split('\n')
		.map((line, i) => ({ line, n: i + 1 }))
		.filter(({ line }) => /\b[A-Za-z]:[\\/]/.test(line) || /(^|[\s'"`(])\/(Users|home)\/\w/.test(line))
		.map(({ n }) => n);
}

describe('no machine path in the committed Sonar tooling (V-2, J5)', () => {
	const files = trackedFiles(ROOT).filter((p) => p.startsWith('scripts/sonar/'));

	it('holds for every tracked file under scripts/sonar/', () => {
		expect(files.length).toBeGreaterThanOrEqual(6);
		const hits = files.map((f) => ({ f, lines: machinePathLines(read(f)) })).filter((x) => x.lines.length > 0);
		expect(hits).toEqual([]);
	});

	it('PREDICTED RED: a copy of the runner holding an absolute drive path is caught, at its line', () => {
		const runner = read('scripts/sonar/batch-runner.cjs').split('\n');
		runner.splice(3, 0, "const EXT_BASE = 'C:/Users/someone/.devin/extensions';");
		expect(machinePathLines(runner.join('\n'))).toEqual([4]);
		expect(machinePathLines("const p = '/home/someone/x';")).toEqual([1]);
	});
});

/** A disposable SonarLint extension folder, as the committed layout describes one, with each fact overridable. */
function extensionFixture(over: { version?: string; languageServer?: string; sonarjs?: string; jre?: string; folderVersion?: string } = {}): string {
	const root = tempDir('ext');
	const dir = join(root, `sonarsource.sonarlint-vscode-${over.folderVersion ?? '6.3.0'}-win32-x64`);
	const jre = join(dir, 'jre', '21.0.12.1-win32-x86_64.tar');
	for (const d of [join(jre, 'bin'), join(dir, 'server'), join(dir, 'eslint-bridge'), join(dir, 'analyzers')]) mkdirSync(d, { recursive: true });
	writeFileSync(
		join(dir, 'package.json'),
		JSON.stringify({
			name: 'sonarlint-vscode',
			version: over.version ?? pins.extension,
			jarDependencies: [
				{ artifactId: 'sonarlint-language-server', version: over.languageServer ?? pins.languageServer },
				{ artifactId: 'sonar-javascript-plugin', version: over.sonarjs ?? pins.sonarjs }
			]
		})
	);
	writeFileSync(join(jre, 'release'), `JAVA_VERSION="${over.jre ?? pins.jre}"\nMODULES="java.base"\n`);
	for (const f of [join(jre, 'bin', 'java.exe'), join(dir, 'server', 'sonarlint-ls.jar'), join(dir, 'analyzers', 'sonarjs.jar')]) writeFileSync(f, '');
	return root;
}

/** The committed machine paths, with the roots pointed at a fixture through an environment variable. */
function fixturePaths(): ReturnType<Core['sonarLintPaths']> {
	return core.sonarLintPaths({ sonarlint: { ...machinePaths.sonarlint, roots: ['%JPWB_SONAR_FIXTURE%'] } });
}
const at = (root: string) => ({ env: { JPWB_SONAR_FIXTURE: root }, home: root, platform: 'win32' });

describe('the pinned engine (V-1)', () => {
	it('reads its pins from the matrix rows the runner checks', () => {
		expect(pins).toEqual({ extension: '6.3.0', languageServer: '6.3.0.79979', sonarjs: '14.4.0.46458', jre: '21.0.12.1', node: expect.any(String) });
	});

	it("finds the pinned extension in the committed layout, with the files it starts the server from", () => {
		const engine = core.findEngine(fixturePaths(), pins, at(extensionFixture()));
		expect(engine.versions).toEqual({ extension: pins.extension, languageServer: pins.languageServer, sonarjs: pins.sonarjs, jre: pins.jre });
		expect(engine.java.replaceAll('\\', '/')).toMatch(/\/jre\/21\.0\.12\.1-win32-x86_64\.tar\/bin\/java\.exe$/);
		expect(engine.analyzers.map((a) => a.replaceAll('\\', '/').split('/').pop())).toEqual(['sonarjs.jar']);
	});

	it('takes the pinned extension, never the highest installed', () => {
		const root = extensionFixture();
		const higher = extensionFixture({ version: '6.4.0', folderVersion: '6.4.0' });
		const both = core.sonarLintPaths({ sonarlint: { ...machinePaths.sonarlint, roots: ['%A%', '%B%'] } });
		const engine = core.findEngine(both, pins, { env: { A: higher, B: root }, home: root, platform: 'win32' });
		expect(engine.versions.extension).toBe('6.3.0');
	});

	it("PREDICTED RED (limb 1): an extension whose package.json names another version is refused, both versions named", () => {
		expect(refusalOf(() => core.findEngine(fixturePaths(), pins, at(extensionFixture({ version: '9.9.9' }))))).toMatch(
			/^SonarLint 6\.3\.0, the matrix's pin, is not installed under %JPWB_SONAR_FIXTURE%: found 9\.9\.9 \(sonarsource\.sonarlint-vscode-6\.3\.0-win32-x64\)$/
		);
	});

	it('PREDICTED RED (limb 2): another language server is refused, both versions named', () => {
		expect(refusalOf(() => core.findEngine(fixturePaths(), pins, at(extensionFixture({ languageServer: '6.3.0.1' }))))).toMatch(
			/bundles language server 6\.3\.0\.1; the matrix pins 6\.3\.0\.79979$/
		);
	});

	it('PREDICTED RED (limb 3): another SonarJS is refused, both versions named', () => {
		expect(refusalOf(() => core.findEngine(fixturePaths(), pins, at(extensionFixture({ sonarjs: '14.5.0.1' }))))).toMatch(
			/bundles SonarJS 14\.5\.0\.1; the matrix pins 14\.4\.0\.46458$/
		);
	});

	it('PREDICTED RED (limb 4): another bundled JRE is refused, both versions named', () => {
		expect(refusalOf(() => core.findEngine(fixturePaths(), pins, at(extensionFixture({ jre: '21.0.13' }))))).toMatch(
			/bundles JRE 21\.0\.13; the matrix pins 21\.0\.12\.1$/
		);
	});

	it('refuses the runner under Bun, or on a Node other than the matrix records', () => {
		expect(core.nodeProblem(pins, { ...process.versions, node: pins.node, bun: '1.3.14' })).toBe(`the runner runs under Bun 1.3.14; run it with node ${pins.node}`);
		const other = { ...process.versions, node: '24.15.0' };
		delete (other as { bun?: string }).bun;
		expect(core.nodeProblem(pins, other)).toBe(`the runner runs on Node 24.15.0; the matrix's day-to-day Node is ${pins.node}`);
		const same = { ...process.versions, node: pins.node };
		delete (same as { bun?: string }).bun;
		expect(core.nodeProblem(pins, same)).toBeUndefined();
	});
});

const CATALOGUE = {
	TypeScript: [
		{ key: 'typescript:S1', activeByDefault: true },
		{ key: 'typescript:S2', activeByDefault: false },
		{ key: 'typescript:S3', activeByDefault: true }
	],
	JavaScript: [{ key: 'javascript:S1', activeByDefault: true }],
	Java: [{ key: 'java:S1', activeByDefault: true }]
};

function ruleSet(rules: string[], parameters: Record<string, Record<string, string>> = {}) {
	return { schema: core.RULE_SET_SCHEMA, repositories: ['javascript', 'typescript'], rules, parameters };
}

describe('the rule set and what the server is sent (V-4, offline)', () => {
	it('the committed rule set is usable, and its counts are its own', () => {
		const text = read('scripts/sonar/rules.json');
		const rs = core.parseRuleSet(text);
		expect((JSON.parse(text) as { counts: unknown }).counts).toEqual(core.expectedActiveCounts(rs));
	});

	it('refuses a rule set that cannot be used, naming each reason', () => {
		expect(core.ruleSetProblems(ruleSet(['typescript:S1', 'typescript:S1', 'java:S1']))).toEqual([
			'rule typescript:S1 is listed twice',
			'rule "java:S1" is not in a listed repository'
		]);
		expect(core.ruleSetProblems(ruleSet([]))).toEqual(['rules is empty: a rule set with no rules analyses nothing (J4)']);
		expect(core.ruleSetProblems(ruleSet(['typescript:S1'], { 'typescript:S9': { max: '3' } }))).toEqual([
			'parameters name typescript:S9, which the rule set does not list'
		]);
	});

	it("reads the governed repositories from the server's catalogue, nothing else", () => {
		const c = core.catalogueOf(CATALOGUE, ['javascript', 'typescript']);
		expect([...c.all].sort()).toEqual(['javascript:S1', 'typescript:S1', 'typescript:S2', 'typescript:S3']);
		expect([...c.defaults].sort()).toEqual(['javascript:S1', 'typescript:S1', 'typescript:S3']);
	});

	it('sends the differences D-1 names: listed but off by default, on; defaults not listed, off', () => {
		const c = core.catalogueOf(CATALOGUE, ['javascript', 'typescript']);
		const diff = core.rulesDiff(ruleSet(['javascript:S1', 'typescript:S1', 'typescript:S2'], { 'typescript:S1': { max: '3' } }), c);
		expect(diff).toEqual({ included: ['typescript:S2'], excluded: ['typescript:S3'], parameters: { 'typescript:S1': { max: '3' } } });
		expect(core.rulesConfiguration(diff)).toEqual({
			'typescript:S2': { level: 'on' },
			'typescript:S3': { level: 'off' },
			'typescript:S1': { level: 'on', parameters: { max: '3' } }
		});
	});

	it('sends nothing when the rule set equals the defaults', () => {
		const c = core.catalogueOf(CATALOGUE, ['javascript', 'typescript']);
		expect(core.rulesDiff(ruleSet(['javascript:S1', 'typescript:S1', 'typescript:S3']), c)).toEqual({ included: [], excluded: [], parameters: {} });
	});

	it('PREDICTED RED: a listed rule the engine does not have is refused by name', () => {
		const c = core.catalogueOf(CATALOGUE, ['javascript', 'typescript']);
		expect(refusalOf(() => core.rulesDiff(ruleSet(['typescript:S1', 'typescript:S9999']), c))).toBe(
			'the rule set names rules this engine does not have: typescript:S9999'
		);
	});
});

/** The server's settings line as it logs it (measured 2026-11-17; the Node path replaced). */
const ECHO =
	'[Debug - 14:00:17.378] Global settings updated: WorkspaceSettings[analysisExcludes=,automaticAnalysis=true,connections={},disableTelemetry=true,excludedRules=[typescript:S3776],focusOnNewCode=false,ideLabsEnabled=false,includedRules=[],pathToNodeExecutable=<node>,ruleParameters={},showVerboseLogs=false]';

describe("the server's echoes (V-4, V-3(b), J2)", () => {
	const sent = { included: [] as string[], excluded: ['typescript:S3776'], parameters: {} };

	it('reads the rule settings the server applied', () => {
		expect(core.parseSettingsEcho(ECHO)).toEqual({ includedRules: [], excludedRules: ['typescript:S3776'], ruleParameters: '{}' });
		expect(core.parseSettingsEcho('Global settings updated: something else')).toBeUndefined();
	});

	it('accepts an echo equal to what was sent', () => {
		expect(core.echoProblems(sent, core.parseSettingsEcho(ECHO)!)).toEqual([]);
	});

	it('PREDICTED RED: an echo whose excluded rules differ', () => {
		expect(core.echoProblems({ ...sent, excluded: ['typescript:S3776', 'typescript:S107'] }, core.parseSettingsEcho(ECHO)!)).toEqual([
			'excluded rules: sent ["typescript:S107","typescript:S3776"], echoed ["typescript:S3776"]'
		]);
	});

	it('PREDICTED RED: an echo whose included rules differ', () => {
		expect(core.echoProblems({ ...sent, included: ['typescript:S2'] }, core.parseSettingsEcho(ECHO)!)).toEqual([
			'included rules: sent ["typescript:S2"], echoed []'
		]);
	});

	it('PREDICTED RED: parameters the echo does not hold, and parameters echoed when none were sent', () => {
		const withParams = { ...sent, parameters: { 'typescript:S107': { max: '3' } } };
		const echoed = core.parseSettingsEcho(ECHO.replace('includedRules=[]', 'includedRules=[typescript:S107]'))!;
		expect(core.echoProblems(withParams, echoed)).toEqual(['rule parameters of typescript:S107: typescript:S107, max=3 not echoed in {}']);
		const nested = core.parseSettingsEcho(ECHO.replace('ruleParameters={}', 'ruleParameters={typescript:S107={max=3}}'))!;
		expect(nested.ruleParameters).toBe('{typescript:S107={max=3}}');
		expect(core.echoProblems(sent, nested)).toEqual(['rule parameters: sent none, echoed {typescript:S107={max=3}}']);
	});

	it('reads the scope settings the server applied, and holds them to what was sent', () => {
		const line =
			"[Debug] Workspace folder 'WorkspaceFolder[name=jpwb,uri=file:///Q:/w/jpwb]' configuration updated: WorkspaceFolderSettings[analyzerProperties={sonar.typescript.tsconfigPaths=tsconfig.json,packages/*/tsconfig.json},connectionId=<null>,pathToCompileCommands=<null>,projectKey=<null>,testFilePattern={**/*.test.ts,**/__tests__/**}]";
		const echo = core.parseFolderEcho(line)!;
		expect(echo).toEqual({ analyzerProperties: '{sonar.typescript.tsconfigPaths=tsconfig.json,packages/*/tsconfig.json}', testFilePattern: '{**/*.test.ts,**/__tests__/**}' });
		const sent = { analyzerProperties: { 'sonar.typescript.tsconfigPaths': 'tsconfig.json,packages/*/tsconfig.json' }, testFilePattern: '{**/*.test.ts,**/__tests__/**}' };
		expect(core.folderEchoProblems(sent, echo)).toEqual([]);
	});

	it('PREDICTED RED: a folder echo whose test pattern or analyzer property differs', () => {
		const echo = { analyzerProperties: '{}', testFilePattern: '<null>' };
		const sent = { analyzerProperties: { 'sonar.typescript.tsconfigPaths': 'tsconfig.json' }, testFilePattern: '**/*.test.ts' };
		expect(core.folderEchoProblems(sent, echo)).toEqual([
			'analyzer properties: sent {sonar.typescript.tsconfigPaths=tsconfig.json}, echoed {}',
			'test pattern: sent **/*.test.ts, echoed <null>'
		]);
	});

	it('reads the tsconfigs the server found, relative to the root, and its SonarJS version', () => {
		const line = '[Info] Found 2 tsconfig.json file(s): [Q:/w/jpwb/scripts/tsconfig.json, Q:/w/jpwb/tsconfig.json]';
		expect(core.parseFoundTsconfigs(line, 'Q:\\w\\jpwb')).toEqual(['scripts/tsconfig.json', 'tsconfig.json']);
		expect(core.parsePluginVersion('[Info] Plugin version: [14.4.0.46458]')).toBe('14.4.0.46458');
	});

	it("checks each analysis's active-rule counts in the governed repositories", () => {
		const counts = core.parseActiveRules('  activeRules: [23 kubernetes, 30 secrets, 425 javascript, 439 typescript, 26 cloudformation]')!;
		expect(counts).toMatchObject({ secrets: 30, javascript: 425, typescript: 439 });
		expect(core.activeRuleProblems({ javascript: 425, secrets: 30, typescript: 440 }, counts)).toEqual([
			'typescript: the rule set has 440 rules, the analysis ran 439'
		]);
		expect(core.activeRuleProblems({ javascript: 425, secrets: 30, typescript: 439 }, counts)).toEqual([]);
	});
});

describe('the files and the scope settings', () => {
	const census = core.parseCensus(read(CENSUS_FILE));

	it('analyses census files, and names any file outside the census', () => {
		const inside = census.files[0] ?? '';
		expect(core.selectFiles(census, ROOT, [inside, join(ROOT, inside), 'docs/x.ts'])).toEqual({ files: [inside], outside: ['docs/x.ts'] });
		expect(core.selectFiles(census, ROOT, undefined).files).toEqual(census.files);
	});

	it("gives the server the properties' tsconfig globs and test pattern", () => {
		expect(core.scopeSettings(census)).toEqual({
			analyzerProperties: { 'sonar.typescript.tsconfigPaths': 'tsconfig.json,packages/*/tsconfig.json,apps/*/tsconfig.json,verif/tsconfig.json,scripts/tsconfig.json' },
			testFilePattern: '{**/*.test.ts,**/__tests__/**}'
		});
	});

	it('refuses a census that lists nothing (J4)', () => {
		expect(refusalOf(() => core.parseCensus(JSON.stringify({ ...census, files: [] })))).toBe('the scope census is not usable: it lists no file (J4)');
	});
});

describe('the output folder (V-20, J4)', () => {
	it('takes a new or empty folder, and refuses a used one without --resume', () => {
		const d = tempDir('out');
		expect(core.outputFolderProblem(join(d, 'new'), false)).toBeUndefined();
		expect(core.outputFolderProblem(d, false)).toBeUndefined();
		writeFileSync(join(d, 'run.json'), '{}');
		expect(core.outputFolderProblem(d, false)).toBe(`the output folder ${d} is not empty: a run writes into a new, empty folder (or pass --resume)`);
		expect(core.outputFolderProblem(d, true)).toBe(`--resume: ${d} holds no earlier run (no results.json)`);
		writeFileSync(join(d, 'results.json'), '{}');
		expect(core.outputFolderProblem(d, true)).toBeUndefined();
	});

	it('PREDICTED RED: a resumed file whose bytes changed gets no earlier result', () => {
		const earlier = { 'a.ts': { status: 'ok', sha256: core.sha256('old'), findings: [{ rule: 'typescript:S1' }] }, 'b.ts': { status: 'timeout', sha256: core.sha256('b') } };
		expect(core.reusableResult(earlier, 'a.ts', core.sha256('old'))).toBe(earlier['a.ts']);
		expect(core.reusableResult(earlier, 'a.ts', core.sha256('new'))).toBeUndefined();
		expect(core.reusableResult(earlier, 'b.ts', core.sha256('b'))).toBeUndefined();
	});

	it('refuses to resume under another engine, rule set or census', () => {
		const now = { engine: { sonarjs: '14.4.0.46458' }, ruleSet: { sha256: 'r' }, census: { sha256: 'c' } };
		expect(core.resumeProblems({ engine: { sonarjs: '14.4.0.46458' }, ruleSet: { sha256: 'r' }, census: { sha256: 'c' } }, now)).toEqual([]);
		expect(core.resumeProblems({ engine: { sonarjs: '14.5.0' }, ruleSet: { sha256: 'x' }, census: { sha256: 'y' } }, now)).toEqual([
			'engine sonarjs: earlier 14.5.0, now 14.4.0.46458',
			'the rule set changed',
			'the scope census changed'
		]);
	});

	it('exits 3 for nothing, 4 for a listed file not analysed, 0 for all (J4)', () => {
		expect([core.exitCodeFor(0, 0), core.exitCodeFor(3, 2), core.exitCodeFor(3, 3)]).toEqual([3, 4, 0]);
	});
});

describe("the runner's arguments", () => {
	it('needs an output folder and exactly one of --all and --files', () => {
		expect(refusalOf(() => cli.parseArgs(['--all']))).toBe('usage: --out <new folder> is required');
		expect(refusalOf(() => cli.parseArgs(['--out', 'x']))).toBe('usage: give exactly one of --all and --files <list>');
		expect(refusalOf(() => cli.parseArgs(['--out', 'x', '--all', '--files', 'y']))).toBe('usage: give exactly one of --all and --files <list>');
		expect(refusalOf(() => cli.parseArgs(['--out', 'x', '--all', '--frobnicate']))).toBe('usage: unknown argument --frobnicate');
		const a = cli.parseArgs(['--out', 'x', '--all']);
		expect(a.rules.replaceAll('\\', '/')).toMatch(/scripts\/sonar\/rules\.json$/);
		expect([a.all, a.resume, a.maxWaitMs]).toEqual([true, false, 120_000]);
	});
});
