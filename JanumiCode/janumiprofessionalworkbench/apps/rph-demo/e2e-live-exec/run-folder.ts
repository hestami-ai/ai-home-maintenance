// ⭐ `JAN-EXEC` Phase 7 `P7-2` (D1, D2) — THE LIVE EXECUTION LANE'S RUN FOLDER, AND THE ONE SPEC A RUN COLLECTS
// (`docs/_working/DESIGN-the-live-end-to-end-run.md` §6 P7-2).
//
// `playwright.live-exec.config.ts` takes its `testMatch` from `liveExecTestMatch` and its server's `JPWB_DEMO_DB` from
// `liveExecStore`, so it keeps the shape `verif/live-exec-lane-config.test.ts` pins. With `JPWB_LIVE_RUN_DIR` set, the
// server keeps the run in that folder — `<dir>/demo.sqlite`, its content store, and the Undertaking's workspace and
// `.process-output` beside them (`src/lib/server/workbench.ts`, `src/lib/server/execution/workspace-host.ts`) — and the
// config collects `phase7.live.ts` alone. Unset, the lane is the one-unit lane it was: a store in a folder minted under
// the temporary folder, and `execution.live.ts` alone. So the two specs never share a server or a store (D1): the config
// collected `**/*.live.ts`, which is both, and each counts the PWA picker's options.
//
// ⛔ THE FOLDER IS CHECKED IN THE RUNNER'S LOAD ONLY. Playwright loads the config in its runner, BEFORE it starts the
// server, and again in each worker, AFTER the server has made the store (`node_modules/playwright/lib/worker/
// workerProcessEntry.js`, `_loadIfNeeded`). The worker sets `TEST_WORKER_INDEX` before its load and the runner never
// does, so that tells the two apart — and run in a worker, the rule that the folder holds no store would refuse every run.
//
// ⭑ EACH RULE, AND WHY (D2):
//   · ABSOLUTE — rooted whatever it is resolved against, as the server requires of its workspace root. The server refuses
//     any other, but only at the first model phase, after that phase's step has started (`resolveUndertakingSandbox`).
//   · EXISTING, AND A FOLDER — better-sqlite3 will not make the store's folder, so the server could not boot.
//   · OUTSIDE THE REPOSITORY AND THE TEMPORARY FOLDER — the run's record must outlive the run and stay out of the tree:
//     every file of the lane's earlier runs under the temporary folder is gone (`REG-F-526`), and only summaries of a run
//     are committed (design §10). ~~The repository is the nearest folder above the config holding `.git`.~~ ⭑ OUTSIDE
//     EVERY GIT WORKING TREE: the repository's main checkout holds a `.git` folder and each of its worktrees a `.git`
//     file, and P7-3 runs from a worktree, so the tree the lane runs from is not the whole repository. A folder is
//     refused when it, or any folder above it, holds `.git` — as its links resolve and as it is written. The tree the
//     lane runs from must hold one too, or the rule could not see it. The temporary folder is compared with links
//     resolved, and on Windows in any case, as its filesystem compares it.
//   · HOLDING NO STORE, no `demo.sqlite*` — a store is seeded only when empty, and command ids restart at every boot, so
//     a dry run and the paid run never share a folder.
//   · NO `AGENTS.md`, `CLAUDE.md`, `.pi` OR `.agents` IN IT OR ABOVE IT, in any case — by default Pi folds `AGENTS.md` and
//     `CLAUDE.md` from its working folder and every folder above into the system prompt, and reads `.agents` skills from
//     each of them and `.pi` settings and extensions from its working folder (`@earendil-works/pi-coding-agent`
//     `dist/core/resource-loader.js`, `dist/core/package-manager.js`). The server makes every phase's working folder
//     inside this one, so under those defaults a file on this path would steer every phase unseen (`REG-F-512`). ⭐ Since
//     the E4 polish round the executor's loader is told to take none of them but `.pi`'s settings, and the packages
//     those list (`pi-executor-resources.ts`; the lead's delegated decision of 2026-10-15, to be registered), and this
//     rule stands as the guard behind that.
//
// ⚠ NOTHING OF THE SERVER'S IS IMPORTED, for `lane-config.ts`'s reason: the runner loads this. What it reads of the host
// comes through `RunFolderHost`, so `verif/phase7-run-folder.test.ts` drives every rule with no real folder in a refused
// place. ⚠ It names `./lane-config.js` WITH the extension: `verif/` imports this module, and its program resolves NodeNext.
import { existsSync, mkdtempSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIVE_RUN_DIR_VARIABLE } from './lane-config.js';

/** The spec a run collects, as the config's `testMatch` (D1). */
export const PHASE7_SPEC = '**/phase7.live.ts';
export const ONE_UNIT_SPEC = '**/execution.live.ts';

/** The record store the server opens in the run folder. Every file it keeps beside it begins with this name. */
export const STORE_FILE = 'demo.sqlite';

/**
 * Where the runner's load leaves the store it minted for the worker's load, which inherits the runner's environment
 * (`node_modules/playwright/lib/runner/index.js`, the worker's `env`). So the worker names the server's store and mints
 * no folder of its own: each load used to mint one, and the worker's was never used (`REG-F-526`'s folders in pairs).
 */
export const MINTED_STORE_VARIABLE = 'JPWB_LIVE_EXEC_MINTED_DB';

/** What Pi reads on the path (the header), as Pi spells them; a name on disk matches in any case. */
export const PI_CONTEXT_NAMES = ['AGENTS.md', 'CLAUDE.md', '.pi', '.agents'] as const;

/** What the run-folder rules read of the host. */
export interface RunFolderHost {
	/** `process.platform`: on win32 two paths name one folder in any case, as the filesystem has it. */
	readonly platform: NodeJS.Platform;
	/** The lane's config: the repository is the nearest folder above it holding `.git`. */
	readonly configFile: string;
	tmpdir(): string;
	exists(path: string): boolean;
	isDirectory(path: string): boolean;
	/** The path with every link resolved, or the path itself, resolved, when it cannot be. */
	realpath(path: string): string;
	/** The names in a folder, or `undefined` when it cannot be listed. */
	list(path: string): readonly string[] | undefined;
	/** A new folder whose name begins with `prefix`, as `mkdtempSync` makes one. */
	mkdtemp(prefix: string): string;
}

/** The host as it is: this filesystem, `os.tmpdir()`, and the lane's config, one folder above this module. */
export function nodeRunFolderHost(
	configFile: string = fileURLToPath(new URL('../playwright.live-exec.config.ts', import.meta.url))
): RunFolderHost {
	return {
		platform: process.platform,
		configFile,
		tmpdir: () => tmpdir(),
		exists: (path) => existsSync(path),
		isDirectory: (path) => statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false,
		realpath: (path) => {
			try {
				return realpathSync.native(path);
			} catch {
				return resolve(path);
			}
		},
		list: (path) => {
			try {
				return readdirSync(path);
			} catch {
				return undefined;
			}
		},
		mkdtemp: (prefix) => mkdtempSync(prefix)
	};
}

type Env = Record<string, string | undefined>;

/** A worker's load of the config: the worker sets `TEST_WORKER_INDEX` before it loads the config; the runner never does. */
export function isWorkerLoad(env: Readonly<Env>): boolean {
	return (env.TEST_WORKER_INDEX ?? '') !== '';
}

/**
 * ⭐ D1 — the one spec a run collects: `phase7.live.ts` when `JPWB_LIVE_RUN_DIR` is set, `execution.live.ts` when it is
 * not. ⚠ SET EVEN EMPTY: the runner's load then refuses the empty folder, rather than an empty value quietly running the
 * one-unit lane, which is paid too.
 */
export function liveExecTestMatch(env: Readonly<Env>): string {
	return env[LIVE_RUN_DIR_VARIABLE] === undefined ? ONE_UNIT_SPEC : PHASE7_SPEC;
}

/**
 * ⭐ D2 — the store the config hands its server as `JPWB_DEMO_DB`.
 *   · `JPWB_LIVE_RUN_DIR` set: `<dir>/demo.sqlite`, the folder checked first in the runner's load, which throws ONE
 *     error naming every problem (`runFolderProblems`). The worker's load checks nothing: the server has made the store.
 *   · unset: a store in a folder minted under the temporary folder, as the one-unit lane always had — minted once, in
 *     the runner's load, and handed to the worker's (`MINTED_STORE_VARIABLE`).
 */
export function liveExecStore(env: Env, host: RunFolderHost = nodeRunFolderHost()): string {
	const configured = env[LIVE_RUN_DIR_VARIABLE];
	if (configured !== undefined) {
		const folder = configured.trim();
		if (!isWorkerLoad(env)) {
			const problems = runFolderProblems(folder, host);
			if (problems.length > 0) throw new Error(runFolderRefusal(configured, problems));
		}
		return join(folder, STORE_FILE);
	}
	const handedOn = env[MINTED_STORE_VARIABLE];
	if (isWorkerLoad(env) && handedOn) return handedOn;
	const minted = join(host.mkdtemp(join(host.tmpdir(), 'jpwb-live-exec-')), STORE_FILE);
	env[MINTED_STORE_VARIABLE] = minted;
	return minted;
}

/** The one error the runner's load throws: the variable, every problem, and what to name instead. */
function runFolderRefusal(configured: string, problems: readonly string[]): string {
	return [
		`The live execution lane cannot keep its run in ${LIVE_RUN_DIR_VARIABLE}=${JSON.stringify(configured)}:`,
		...problems.map((p) => `  · ${p}`),
		`Name, by its absolute path, an existing folder outside every git working tree (the repository's main checkout ` +
			`and each of its worktrees among them) and the temporary folder that holds no store, with none of ` +
			`${PI_CONTEXT_NAMES.join(', ')} in it or above it, and set it before Playwright starts (design §6 ` +
			`P7-2 D2). By default Pi folds AGENTS.md and CLAUDE.md from its working folder and each folder above it into the ` +
			`system prompt, reads .agents skills from each, and .pi from its working folder, which the server makes inside ` +
			`the run folder; the executor's loader is told to leave them out but .pi's settings, and this rule is the guard ` +
			`behind it. Pi keeps its own settings in a .pi folder in the home folder by default, so wherever that ` +
			`folder exists, the run folder cannot be below the home folder. Unset ${LIVE_RUN_DIR_VARIABLE} to run the ` +
			`one-unit lane instead.`
	].join('\n');
}

/** ⭐ D2 — every reason `folder` cannot be the run folder, one line each; none when it can. */
export function runFolderProblems(folder: string, host: RunFolderHost): string[] {
	if (folder === '') return ['it is empty.'];
	if (!rootedIndependentlyOfTheProcess(folder))
		return [
			'it is not absolute, so it resolves against the working folder of whichever process reads it; the server ' +
				'refuses such a workspace root only at the first model phase, after its step has started.'
		];
	const problems: string[] = [];
	const exists = host.exists(folder);
	const isFolder = exists && host.isDirectory(folder);
	if (!exists)
		problems.push(
			"it does not exist: better-sqlite3 will not make the store's folder, so the server could not boot."
		);
	else if (!isFolder) problems.push('it is not a folder.');
	const located = host.realpath(folder);
	const repository = repositoryOf(host);
	if (repository === undefined)
		problems.push(
			`no folder above the config (${host.configFile}) holds .git, so the repository the run folder must lie ` +
				'outside cannot be found.'
		);
	// ⭑ ANY TREE, NOT ONLY THE LANE'S OWN: from a worktree, the main checkout beside it is the repository too. Sought where
	// the folder's links resolve — the record's bytes sit there — and where it is written, the path a tree lists it by.
	const tree = gitTreeAt(located, host) ?? gitTreeAt(resolve(folder), host);
	if (tree !== undefined)
		problems.push(
			`it lies inside a git working tree (${tree} holds .git): the run's record would sit in the tree, where only ` +
				"its summaries belong (design §10). The repository's main checkout and each of its worktrees are such a tree."
		);
	const temporary = host.tmpdir();
	if (within(located, host.realpath(temporary), host.platform))
		problems.push(
			`it lies inside the temporary folder (${temporary}), where every file of the lane's earlier runs is already ` +
				'gone (REG-F-526).'
		);
	const names = isFolder ? host.list(folder) : undefined;
	const stores = (names ?? []).filter((n) => n.toLowerCase().startsWith(STORE_FILE));
	if (stores.length > 0)
		problems.push(
			`it already holds ${stores.join(', ')}: a store is seeded only when it is empty, and command ids restart at ` +
				'every boot, so a run never shares its folder with another.'
		);
	problems.push(...piContextOnThePath(resolve(folder), host));
	return problems;
}

/** The tree the lane runs from: the nearest folder above the host's config that holds `.git`, if any. */
export function repositoryOf(host: RunFolderHost): string | undefined {
	return gitTreeAt(dirname(resolve(host.configFile)), host);
}

/**
 * The nearest folder at or above `start` that holds `.git`, if any. ⚠ A folder in the main checkout, a FILE in each linked
 * worktree (`gitdir: …`), so asked whether it exists, never whether it is a folder.
 */
function gitTreeAt(start: string, host: RunFolderHost): string | undefined {
	let folder = start;
	for (;;) {
		if (host.exists(join(folder, '.git'))) return folder;
		const parent = dirname(folder);
		if (parent === folder) return undefined;
		folder = parent;
	}
}

/**
 * One line for each of Pi's names in `start` or a folder above it, nearest first — and one for a folder on that path
 * that cannot be listed, since what it holds cannot then be told: refused, not assumed empty.
 */
function piContextOnThePath(start: string, host: RunFolderHost): string[] {
	const found: string[] = [];
	let folder = start;
	for (;;) {
		const names = host.exists(folder) ? host.list(folder) : [];
		if (names === undefined)
			found.push(
				`${folder} cannot be listed, so whether it holds ${PI_CONTEXT_NAMES.join(', ')}, which Pi would read, ` +
					'cannot be told.'
			);
		for (const name of names ?? [])
			if (PI_CONTEXT_NAMES.some((pi) => pi.toLowerCase() === name.toLowerCase()))
				found.push(
					`${join(folder, name)} is on the path Pi reads its context from by default (REG-F-512).`
				);
		const parent = dirname(folder);
		if (parent === folder) return found;
		folder = parent;
	}
}

/**
 * Does `child` lie inside `parent`, or name it? ⚠ Compared by string, folded on Windows: `path.relative` folds case on
 * win32 by itself, so it would hide whether this rule does.
 */
function within(child: string, parent: string, platform: NodeJS.Platform): boolean {
	const fold = (p: string) => (platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));
	const inner = fold(child);
	const outer = fold(parent);
	return inner === outer || inner.startsWith(outer.endsWith(sep) ? outer : `${outer}${sep}`);
}

/**
 * Does this folder name the same place whatever it is resolved against? The server's own test of a workspace root
 * (`rootedIndependentlyOfTheProcess`, `src/lib/server/execution/workspace-host.ts`), restated: a plain relative path, a
 * drive-relative `C:runs` and a drive-less `\runs` each resolve differently against two bases on different drives.
 */
function rootedIndependentlyOfTheProcess(folder: string): boolean {
	return resolve('C:/jpwb-probe-a', folder) === resolve('D:/jpwb-probe-b', folder);
}
