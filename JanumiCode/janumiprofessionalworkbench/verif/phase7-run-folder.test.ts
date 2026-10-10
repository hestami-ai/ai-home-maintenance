// ⭐ `JAN-EXEC` Phase 7 `P7-2` (D1, D2) — THE LIVE EXECUTION LANE'S RUN FOLDER, AND THE ONE SPEC A RUN COLLECTS
// (`docs/_working/DESIGN-the-live-end-to-end-run.md` §6 P7-2; `apps/rph-demo/e2e-live-exec/run-folder.ts`).
//
// The lane is paid and never runs in the gate, so nothing ever ran what its config decides before the server starts.
// This holds it here:
//   · D1 — `phase7.live.ts` alone when `JPWB_LIVE_RUN_DIR` is set, `execution.live.ts` alone when not, and the config
//     wired to that rule, read from its AST;
//   · D2 — each rule the run folder must meet, each refusal asserted by its words, in ONE error from the runner's load;
//     the worker's load checks nothing, because the server has made the store by then; and unset, one folder minted per
//     run, in the runner's load, which the worker's load names rather than minting its own.
//
// ⭑ NO REAL FOLDER IN A REFUSED PLACE IS NEEDED TO ADMIT ONE. Each rule is driven through `RunFolderHost` over a filesystem
// held in memory — folders, files, links and folders that cannot be listed, compared as the declared platform compares
// them — so a folder that meets every rule needs no folder outside the repository and the temporary folder on this host.
// ⭑ AND LINKED WORKTREES: a worktree's `.git` is a FILE, and from a worktree the main checkout is the repository too.
// ⚠ AND THE REAL HOST IS DRIVEN TOO, where only a refusal is asked of it: a real folder inside the repository, one under the
// temporary folder, and one holding a store — each refused by the same words — and the host's own reads, under the
// temporary folder: a link resolved, a file that is no folder, and a file or a missing path that cannot be listed.
// ⚠ ON A COPY OF THE TREE, plant a `.git` at its root: the repository is read from it, so without one the real-host
// repository test is red by its arrangement, and says so.
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { LIVE_RUN_DIR_VARIABLE } from '../apps/rph-demo/e2e-live-exec/lane-config.js';
import {
	MINTED_STORE_VARIABLE,
	ONE_UNIT_SPEC,
	PHASE7_SPEC,
	liveExecStore,
	liveExecTestMatch,
	nodeRunFolderHost,
	repositoryOf,
	runFolderProblems,
	type RunFolderHost
} from '../apps/rph-demo/e2e-live-exec/run-folder.js';

/** The root of this drive, or `/`: every path below is built on it, so the fixtures read as this platform's paths. */
const ROOT = parse(resolve('/')).root;
const at = (...segments: string[]) => join(ROOT, ...segments);
const REPO = at('work', 'repo');
const FAKE_CONFIG = join(REPO, 'apps', 'rph-demo', 'playwright.live-exec.config.ts');
const TMP = at('scratch', 'tmp');
/** A folder that meets every rule, in the default fixture. */
const GOOD = at('runs', 'phase7-paid');

interface Fixture {
	readonly platform?: NodeJS.Platform;
	readonly folders?: readonly string[];
	readonly files?: readonly string[];
	/** A path whose links resolve to another. */
	readonly links?: Readonly<Record<string, string>>;
	readonly unlistable?: readonly string[];
	/** Another config: then no `.git` is made for it. By default the config sits in `REPO`, which holds `.git`. */
	readonly configFile?: string;
	/** What `tmpdir()` answers, a folder made too. By default `TMP`. */
	readonly tmpdir?: string;
}

/**
 * A filesystem in memory: each folder and file by its full path, every folder above it made too, listed under its
 * parent and compared as the declared platform compares paths — in any case on win32. `mkdtemp` records what it made.
 */
function fakeHost(fixture: Fixture = {}): RunFolderHost & { readonly minted: string[] } {
	const platform = fixture.platform ?? process.platform;
	const key = (p: string) => (platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));
	const entries = new Map<string, { readonly path: string; readonly folder: boolean }>();
	const add = (path: string, folder: boolean): void => {
		const full = resolve(path);
		if (!entries.has(key(full))) entries.set(key(full), { path: full, folder });
		for (let up = full; dirname(up) !== up;) {
			up = dirname(up);
			if (!entries.has(key(up))) entries.set(key(up), { path: up, folder: true });
		}
	};
	const configFile = fixture.configFile ?? FAKE_CONFIG;
	const temporary = fixture.tmpdir ?? TMP;
	for (const f of [...(fixture.folders ?? []), temporary]) add(f, true);
	if (fixture.configFile === undefined) add(join(REPO, '.git'), true);
	for (const f of [...(fixture.files ?? []), configFile]) add(f, false);
	const minted: string[] = [];
	return {
		platform,
		configFile,
		minted,
		tmpdir: () => temporary,
		exists: (p) => entries.has(key(p)),
		isDirectory: (p) => entries.get(key(p))?.folder ?? false,
		realpath: (p) => resolve(fixture.links?.[resolve(p)] ?? p),
		list: (p) =>
			fixture.unlistable?.some((u) => key(u) === key(p))
				? undefined
				: [...entries.values()]
						.filter((e) => key(dirname(e.path)) === key(p) && key(e.path) !== key(p))
						.map((e) => basename(e.path)),
		mkdtemp: (prefix) => {
			const made = `${prefix}T3st`;
			add(made, true);
			minted.push(made);
			return made;
		}
	};
}

/** The problems with `folder`, as one text, so each refusal is asserted by its words. */
const problemsOf = (folder: string, host: RunFolderHost) =>
	runFolderProblems(folder, host).join('\n');

/** What the runner's load throws for `env`, or `''` when it throws nothing. */
function thrownBy(env: Record<string, string | undefined>, host: RunFolderHost): string {
	try {
		liveExecStore(env, host);
		return '';
	} catch (e) {
		return (e as Error).message;
	}
}

const CONFIG_FILE = fileURLToPath(
	new URL('../apps/rph-demo/playwright.live-exec.config.ts', import.meta.url)
);
const configSource = () =>
	ts.createSourceFile(CONFIG_FILE, readFileSync(CONFIG_FILE, 'utf8'), ts.ScriptTarget.Latest, true);

/** The initializer of every `name:` property in the config, as source text. */
function configProperty(name: string): string[] {
	const sf = configSource();
	const out: string[] = [];
	const visit = (n: ts.Node): void => {
		if (ts.isPropertyAssignment(n) && n.name.getText(sf) === name)
			out.push(n.initializer.getText(sf));
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/** The names the config imports from `specifier`. */
function configImports(specifier: string): string[] {
	return configSource().statements.flatMap((st) =>
		ts.isImportDeclaration(st) &&
		ts.isStringLiteral(st.moduleSpecifier) &&
		st.moduleSpecifier.text === specifier &&
		st.importClause?.namedBindings &&
		ts.isNamedImports(st.importClause.namedBindings)
			? st.importClause.namedBindings.elements.map((e) => (e.propertyName ?? e.name).text)
			: []
	);
}

describe('⭐ P7-2 D1 — one spec per run, chosen by the run folder', () => {
	it('unset: the one-unit spec alone; set, even empty: the Phase 7 spec alone — never both', () => {
		expect(liveExecTestMatch({})).toBe('**/execution.live.ts');
		expect(liveExecTestMatch({ [LIVE_RUN_DIR_VARIABLE]: GOOD })).toBe('**/phase7.live.ts');
		// ⚠ An empty value is refused by the runner's load (below), not read as unset — that would run the one-unit lane.
		expect(liveExecTestMatch({ [LIVE_RUN_DIR_VARIABLE]: '' })).toBe('**/phase7.live.ts');
		// ⭑ Each names ONE file: no wildcard past the `**/` Playwright prefixes, and the one-unit spec is the file on disk.
		for (const spec of [ONE_UNIT_SPEC, PHASE7_SPEC])
			expect(spec.slice(3), spec).not.toMatch(/[*?[{]/);
		expect(existsSync(join(dirname(CONFIG_FILE), 'e2e-live-exec', ONE_UNIT_SPEC.slice(3)))).toBe(
			true
		);
	});

	it('⛔ the config collects by that rule, asked of the whole environment', () => {
		expect(configProperty('testMatch')).toEqual(['liveExecTestMatch(process.env)']);
		expect(configImports('./e2e-live-exec/run-folder').sort()).toEqual([
			'liveExecStore',
			'liveExecTestMatch'
		]);
	});

	it('⛔ the config hands its server the store that rule names, asked of the whole environment', () => {
		expect(configProperty('JPWB_DEMO_DB')).toEqual(['liveExecStore(process.env)']);
	});
});

describe('⭐ P7-2 D2 — the run folder, checked in the runner’s load, every problem named', () => {
	it('⭐ a folder that meets every rule is the run folder: its store is <dir>/demo.sqlite, and no folder is minted', () => {
		const host = fakeHost({
			// ⚠ NEAR MISSES, each admitted: none is a name Pi reads, and none is the store.
			folders: [GOOD, at('runs', '.agentsrc'), at('.pi-old')],
			files: [
				join(GOOD, 'notes.txt'),
				join(GOOD, 'old-demo.sqlite'),
				join(GOOD, 'demo.sqlit'),
				at('runs', 'AGENTS.md.bak'),
				at('runs', 'CLAUDE.md.txt'),
				at('runs', 'my.agents')
			]
		});
		expect(runFolderProblems(GOOD, host)).toEqual([]);
		expect(liveExecStore({ [LIVE_RUN_DIR_VARIABLE]: GOOD }, host)).toBe(join(GOOD, 'demo.sqlite'));
		// Trimmed, as the lane reads every variable.
		expect(liveExecStore({ [LIVE_RUN_DIR_VARIABLE]: `  ${GOOD} ` }, host)).toBe(
			join(GOOD, 'demo.sqlite')
		);
		expect(host.minted).toEqual([]);
	});

	it('⛔ a folder that is not absolute is refused — relative, drive-relative or drive-less — and so is an empty one', () => {
		for (const folder of ['runs', join('runs', 'p7'), '.', 'C:runs', '\\runs'])
			expect(problemsOf(folder, fakeHost()), folder).toContain(
				'it is not absolute, so it resolves against the working folder of whichever process reads it'
			);
		expect(runFolderProblems('', fakeHost())).toEqual(['it is empty.']);
	});

	it('⛔ a folder that does not exist is refused: the server could not make its store', () => {
		expect(problemsOf(at('runs', 'never-made'), fakeHost())).toContain(
			"it does not exist: better-sqlite3 will not make the store's folder, so the server could not boot."
		);
	});

	it('⛔ a file is refused as the run folder', () => {
		const file = at('runs', 'a-file');
		expect(runFolderProblems(file, fakeHost({ files: [file] }))).toContain('it is not a folder.');
	});

	it('⛔ the repository is refused — itself, any folder in it, and a link that resolves into it', () => {
		const link = at('links', 'into-repo');
		for (const [folder, links] of [
			[REPO, {}],
			[join(REPO, 'runs', 'p7'), {}],
			[link, { [link]: join(REPO, 'runs') }]
		] as const) {
			const host = fakeHost({ folders: [folder, join(REPO, 'runs')], links });
			expect(problemsOf(folder, host), folder).toContain(
				`it lies inside a git working tree (${REPO} holds .git): the run's record would sit in the tree`
			);
		}
	});

	it('⛔ a folder WRITTEN inside the repository is refused though its link resolves outside it — the tree lists it by that path', () => {
		const folder = join(REPO, 'runs-link');
		const host = fakeHost({ folders: [folder, GOOD], links: { [folder]: GOOD } });
		expect(problemsOf(folder, host)).toContain(
			`it lies inside a git working tree (${REPO} holds .git)`
		);
		// ⚠ The control: where it resolves, nothing is refused.
		expect(runFolderProblems(GOOD, host)).toEqual([]);
	});

	// ⭐ P7-3 RUNS FROM A LINKED WORKTREE (design §6 P7-3, "a clean worktree at a named commit"), whose `.git` is a FILE
	// naming the main checkout's (`gitdir: …`). The tree the lane runs from is then the worktree, and the main checkout,
	// which the register means by "the repository", lies outside it.
	it('⛔ EVERY git working tree is refused, not only the lane’s own: from a worktree, the main checkout; from the main checkout, a worktree, found by its .git FILE; and another repository', () => {
		const MAIN = at('work', 'main');
		const WORKTREE = at('wt', 'p7');
		const OTHER = at('other', 'repo');
		const configIn = (tree: string) =>
			join(tree, 'apps', 'rph-demo', 'playwright.live-exec.config.ts');
		const fixture = {
			folders: [
				join(MAIN, '.git'),
				join(MAIN, 'runs', 'p7'),
				join(WORKTREE, 'runs'),
				join(OTHER, '.git'),
				join(OTHER, 'runs')
			],
			files: [join(WORKTREE, '.git')]
		};
		const fromWorktree = fakeHost({ ...fixture, configFile: configIn(WORKTREE) });
		expect(repositoryOf(fromWorktree), 'a worktree’s .git is a file').toBe(WORKTREE);
		const fromMain = fakeHost({ ...fixture, configFile: configIn(MAIN) });
		expect(repositoryOf(fromMain)).toBe(MAIN);
		for (const [host, folder, tree] of [
			[fromWorktree, join(MAIN, 'runs', 'p7'), MAIN],
			[fromWorktree, join(WORKTREE, 'runs'), WORKTREE],
			[fromMain, join(WORKTREE, 'runs'), WORKTREE],
			[fromMain, join(OTHER, 'runs'), OTHER]
		] as const)
			expect(problemsOf(folder, host), `${folder}, the lane in ${repositoryOf(host)}`).toContain(
				`it lies inside a git working tree (${tree} holds .git): the run's record would sit in the tree, where only its summaries belong (design §10).`
			);
	});

	it('⛔ with no .git above the config, the repository cannot be found, and the folder is refused, not assumed outside it', () => {
		const host = fakeHost({
			configFile: at('exported', 'apps', 'rph-demo', 'playwright.live-exec.config.ts'),
			folders: [GOOD]
		});
		expect(repositoryOf(host)).toBeUndefined();
		expect(problemsOf(GOOD, host)).toContain(
			'holds .git, so the repository the run folder must lie outside cannot be found.'
		);
	});

	it('⛔ the temporary folder is refused — itself, and any folder in it (REG-F-526)', () => {
		for (const folder of [TMP, join(TMP, 'jpwb-run')])
			expect(problemsOf(folder, fakeHost({ folders: [folder] })), folder).toContain(
				`it lies inside the temporary folder (${TMP}), where every file of the lane's earlier runs is already gone (REG-F-526).`
			);
	});

	it('⛔ the temporary folder is compared with its links resolved: a folder in it, where the name tmpdir() gives is a link to it, is refused', () => {
		const named = at('scratch', 'tmp-link');
		const folder = join(TMP, 'jpwb-run');
		const host = fakeHost({ tmpdir: named, folders: [TMP, folder], links: { [named]: TMP } });
		expect(problemsOf(folder, host)).toContain(`it lies inside the temporary folder (${named})`);
	});

	it('⛔ on Windows the temporary folder is compared in any case, as its filesystem compares it — elsewhere, not', () => {
		const fixture = { tmpdir: at('Scratch', 'Tmp'), folders: [at('scratch', 'tmp', 'run')] };
		const folder = at('scratch', 'tmp', 'run');
		expect(problemsOf(folder, fakeHost({ ...fixture, platform: 'win32' }))).toContain(
			`it lies inside the temporary folder (${at('Scratch', 'Tmp')})`
		);
		expect(problemsOf(folder, fakeHost({ ...fixture, platform: 'linux' }))).not.toContain(
			'it lies inside the temporary folder'
		);
	});

	it('⭐ a folder BESIDE the temporary folder or the repository, its name beginning as theirs does, lies outside it, and is the run folder', () => {
		const besideTmp = at('scratch', 'tmp-runs');
		const besideRepo = at('work', 'repo-runs');
		const host = fakeHost({ folders: [besideTmp, besideRepo] });
		expect(runFolderProblems(besideTmp, host), besideTmp).toEqual([]);
		expect(runFolderProblems(besideRepo, host), besideRepo).toEqual([]);
	});

	it('⛔ a folder already holding a store — any demo.sqlite*, in any case — is refused, the store named', () => {
		for (const name of [
			'demo.sqlite',
			'demo.sqlite-wal',
			'demo.sqlite-shm',
			'demo.sqlite.content.sqlite',
			'demo.sqlite.workspaces',
			'DEMO.SQLITE'
		])
			expect(
				problemsOf(GOOD, fakeHost({ folders: [GOOD], files: [join(GOOD, name)] })),
				name
			).toContain(`it already holds ${name}: a store is seeded only when it is empty`);
	});

	it('⛔ Pi’s context in the folder or ANY folder above it, up to the root, is refused by its path — and a folder there that cannot be listed', () => {
		for (const where of [GOOD, at('runs'), ROOT]) {
			const file = join(where, 'AGENTS.md');
			expect(problemsOf(GOOD, fakeHost({ folders: [GOOD], files: [file] })), where).toContain(
				`${file} is on the path Pi reads its context from (REG-F-512).`
			);
		}
		expect(problemsOf(GOOD, fakeHost({ folders: [GOOD], unlistable: [at('runs')] }))).toContain(
			`${at('runs')} cannot be listed`
		);
	});

	it('⛔ in any case — agents.md, Claude.MD, .PI, .Agents — on a filesystem that keeps case too', () => {
		for (const name of ['agents.md', 'Claude.MD', '.PI', '.Agents']) {
			const file = at('runs', name);
			expect(
				problemsOf(GOOD, fakeHost({ platform: 'linux', folders: [GOOD], files: [file] })),
				name
			).toContain(`${file} is on the path Pi reads its context from`);
		}
	});

	it('⛔ each name Pi reads is refused — AGENTS.md, CLAUDE.md, .pi and .agents', () => {
		for (const name of ['AGENTS.md', 'CLAUDE.md', '.pi', '.agents']) {
			const found = at('runs', name);
			expect(problemsOf(GOOD, fakeHost({ folders: [GOOD], files: [found] })), name).toContain(
				`${found} is on the path Pi reads its context from`
			);
		}
	});

	it('⛔ Pi’s path is the folder AS WRITTEN, which Pi walks with no link resolved — so a run folder that is a link is refused for what lies above its name', () => {
		// Pi walks `resolvePath(cwd)` (`pi-coding-agent` `dist/core/resource-loader.js`), and the server makes each phase's
		// working folder under the run folder as written (`workspace-host.ts`).
		const folder = at('links', 'run');
		const target = at('real', 'run');
		const host = fakeHost({
			folders: [folder, target],
			files: [at('links', 'AGENTS.md')],
			links: { [folder]: target }
		});
		expect(problemsOf(folder, host)).toContain(
			`${at('links', 'AGENTS.md')} is on the path Pi reads its context from (REG-F-512).`
		);
	});

	it('⛔ the runner’s load throws ONE error: the variable, its value, and every problem', () => {
		const folder = join(TMP, 'run');
		const host = fakeHost({
			folders: [folder],
			files: [join(folder, 'demo.sqlite'), at('scratch', 'CLAUDE.md')]
		});
		const thrown = thrownBy({ [LIVE_RUN_DIR_VARIABLE]: folder }, host);
		expect(thrown).toContain(
			`The live execution lane cannot keep its run in JPWB_LIVE_RUN_DIR=${JSON.stringify(folder)}:`
		);
		expect(thrown).toContain(`it lies inside the temporary folder (${TMP})`);
		expect(thrown).toContain('it already holds demo.sqlite:');
		expect(thrown).toContain(
			`${at('scratch', 'CLAUDE.md')} is on the path Pi reads its context from`
		);
		expect(thrown).toContain('(design §6 P7-2 D2)');
	});

	it('⭐ the worker’s load checks nothing — the server has made the store by then — where the runner’s, on the same folder, refuses', () => {
		const host = fakeHost({
			folders: [GOOD],
			files: [join(GOOD, 'demo.sqlite'), join(GOOD, 'demo.sqlite-wal')]
		});
		expect(liveExecStore({ [LIVE_RUN_DIR_VARIABLE]: GOOD, TEST_WORKER_INDEX: '0' }, host)).toBe(
			join(GOOD, 'demo.sqlite')
		);
		for (const runner of [{}, { TEST_WORKER_INDEX: '' }])
			expect(
				thrownBy({ [LIVE_RUN_DIR_VARIABLE]: GOOD, ...runner }, host),
				`the runner's load, ${JSON.stringify(runner)}`
			).toContain('it already holds demo.sqlite, demo.sqlite-wal:');
		expect(host.minted).toEqual([]);
	});

	it('⛔ an EMPTY run folder is refused by the runner’s load — never read as unset, which would boot the Phase 7 spec’s server on a store minted under the temporary folder', () => {
		for (const value of ['', '   ']) {
			const host = fakeHost();
			expect(thrownBy({ [LIVE_RUN_DIR_VARIABLE]: value }, host), JSON.stringify(value)).toContain(
				`The live execution lane cannot keep its run in JPWB_LIVE_RUN_DIR=${JSON.stringify(value)}:\n  · it is empty.`
			);
			expect(host.minted, JSON.stringify(value)).toEqual([]);
		}
	});

	it('⛔ the runner’s load mints its own folder though its environment already names one — only a worker’s load takes the hand-off', () => {
		// A runner whose shell kept a store from another run: that store is used, not empty, so the seed would never run.
		const stale = at('stale', 'jpwb-live-exec-old', 'demo.sqlite');
		for (const runner of [{}, { TEST_WORKER_INDEX: '' }]) {
			const host = fakeHost();
			const env: Record<string, string | undefined> = { ...runner, [MINTED_STORE_VARIABLE]: stale };
			const store = liveExecStore(env, host);
			expect(store, JSON.stringify(runner)).toBe(join(TMP, 'jpwb-live-exec-T3st', 'demo.sqlite'));
			expect(env[MINTED_STORE_VARIABLE]).toBe(store);
			expect(host.minted).toHaveLength(1);
		}
	});

	it('⭐ unset: the runner mints ONE folder under the temporary folder and hands it on; the worker’s load names it, minting none', () => {
		const host = fakeHost();
		const env: Record<string, string | undefined> = {};
		const store = liveExecStore(env, host);
		expect(host.minted).toEqual([join(TMP, 'jpwb-live-exec-T3st')]);
		expect(store).toBe(join(TMP, 'jpwb-live-exec-T3st', 'demo.sqlite'));
		expect(env[MINTED_STORE_VARIABLE]).toBe(store);
		// The worker forks with the runner's environment, then loads the config again.
		expect(liveExecStore({ ...env, TEST_WORKER_INDEX: '0' }, host)).toBe(store);
		expect(host.minted, 'the worker minted a folder of its own').toHaveLength(1);
	});
});

describe('⭐ P7-2 D2 — the host as it is: this filesystem, refusing a real folder in each refused place', () => {
	const made: string[] = [];
	const linked: string[] = [];
	afterAll(() => {
		// ⚠ EACH LINK FIRST, AS A LINK — never a recursive delete through one — though each points at a folder made here.
		for (const link of linked) unlinkSync(link);
		for (const folder of made) rmSync(folder, { recursive: true, force: true });
	});
	const madeUnderTmp = () => {
		const folder = mkdtempSync(join(tmpdir(), 'jpwb-run-folder-'));
		made.push(folder);
		return folder;
	};

	it('⛔ a folder inside the repository — found by its .git, above the lane’s own config', () => {
		const host = nodeRunFolderHost();
		expect(existsSync(host.configFile), host.configFile).toBe(true);
		const repository = repositoryOf(host);
		expect(
			repository,
			`no folder above ${host.configFile} holds .git — on a copy of the tree, plant a .git at its root`
		).toBeDefined();
		expect(problemsOf(fileURLToPath(new URL('.', import.meta.url)), host)).toContain(
			`it lies inside a git working tree (${host.realpath(repository!)} holds .git)`
		);
	});

	it('⭑ the host’s own reads, which the rules rest on: a link resolved to its target; a file no folder; a file or a missing path never listed', () => {
		const host = nodeRunFolderHost();
		const folder = madeUnderTmp();
		const inner = join(folder, 'inner');
		mkdirSync(inner);
		const file = join(folder, 'a-file.txt');
		writeFileSync(file, '');
		const link = join(folder, 'link');
		symlinkSync(inner, link, 'junction');
		linked.push(link);
		const missing = join(folder, 'never-made');
		expect(host.realpath(link), 'the link, resolved').toBe(realpathSync.native(inner));
		expect(host.realpath(missing), 'what cannot be resolved, as written').toBe(missing);
		expect([inner, file, missing].map((p) => host.isDirectory(p))).toEqual([true, false, false]);
		expect(host.list(folder)?.slice().sort()).toEqual(['a-file.txt', 'inner', 'link']);
		expect(host.list(file), 'a file cannot be listed').toBeUndefined();
		expect(host.list(missing), 'a missing path cannot be listed').toBeUndefined();
	});

	it('⛔ a folder under the temporary folder', () => {
		expect(problemsOf(madeUnderTmp(), nodeRunFolderHost())).toContain(
			`it lies inside the temporary folder (${tmpdir()})`
		);
	});

	it('⛔ a folder holding a store', () => {
		const folder = madeUnderTmp();
		writeFileSync(join(folder, 'demo.sqlite-wal'), '');
		expect(problemsOf(folder, nodeRunFolderHost())).toContain('it already holds demo.sqlite-wal:');
	});
});
