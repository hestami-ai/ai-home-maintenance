// ⭐ `JAN-EXEC` Phase 7, P7-2 D6 (DESIGN-the-live-end-to-end-run.md §6) — THE COPY OF THE WHOLE RUN FOLDER, TAKEN AFTER
// PLAYWRIGHT HAS EXITED.
//
//   bun scripts/phase7/finalize-run.ts <RUN>
//
// The per-unit archives hold each store through SQLite's backup; this is the other half of D6: once the server has
// stopped, `<RUN>` is copied WHOLE to its sibling `<RUN>-final` — the live stores with their `-wal` and `-shm` beside
// them, the workspaces, the lane's own files — and the run's Playwright results, `apps/rph-demo/e2e-results/
// results-live-exec.json`, which the next run of the lane would overwrite, are copied into it.
//
// ⛔ A STORE'S `.sqlite` ALONE CAN MISS COMMITTED RECORDS (`REG-F-526`): a WAL-mode store keeps them in its `-wal` until a
// checkpoint, and a force-killed server leaves one behind (`REG-F-527`). So everything is copied, `-wal` and `-shm`
// included, and nothing here opens a store — an open could checkpoint the very file it was copying.
// ⛔ A COPY IS TAKEN ONCE, AND WHOLE OR NOT AT ALL: it is made as `<RUN>-final.partial` and renamed `<RUN>-final` only
// once everything is in it. A copy that fails part-way is refused, names where, and leaves its `.partial` for a person —
// never deleted here, and never a `<RUN>-final` that would refuse the next attempt as "taken".
// ⛔ A LINK IS COPIED AS A LINK, its target's text kept and never followed — `run-archive.ts`'s rule, restated because
// that module needs `node:sqlite`, which bun does not load. A link a model made in the workspace, and the archive's copy
// of it, would otherwise make the copy fail part-way (this host refuses a symbolic link to a folder; a junction serves)
// or walk out of the run. One this host cannot make is named, and the copy goes on.
// ⛔ THE PLAYWRIGHT RESULTS ARE COPIED ONLY WHEN THEY ARE THIS RUN'S: every run of the lane, from any folder, writes the
// same file, so its own config must name `<RUN>/demo.sqlite` as its server's store (`config.webServer.env.JPWB_DEMO_DB`).
// ⚠ RUN IT AFTER PLAYWRIGHT HAS EXITED: the server holds the stores open while it runs, and a copy taken under it can
// catch a write half made. The sizes of what was copied are checked against the source afterwards, and a difference
// is reported, never smoothed.
//
// Exit 0 copied, this run's results included; 1 copied, with no results of this run's to copy, a size that differs, or a
// link this host could not make; 2 refused, with no `<RUN>-final` made.
import {
	cpSync,
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	renameSync,
	statSync,
	symlinkSync
} from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where the live-exec config's JSON reporter writes the run's results (`playwright.live-exec.config.ts`). */
export const PLAYWRIGHT_RESULTS = fileURLToPath(
	new URL('../../apps/rph-demo/e2e-results/results-live-exec.json', import.meta.url)
);
export const RESULTS_NAME = 'results-live-exec.json';
/** The store the lane's server keeps in the run folder (`e2e-live-exec/run-folder.ts` `STORE_FILE`). */
export const STORE_FILE = 'demo.sqlite';
/** The copy is made under this suffix, and renamed only when whole. */
export const PARTIAL_SUFFIX = '.partial';

const rec = (v: unknown): Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Strings in code-unit order: the same on every host and locale. */
const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);

/** Each FILE under `dir`, by its `/`-separated path, with its size. A link is neither followed nor listed. */
export function sizesUnder(dir: string): Map<string, number> {
	const out = new Map<string, number>();
	const walk = (path: string, rel: string): void => {
		for (const entry of readdirSync(path).sort(byCodeUnit)) {
			const full = join(path, entry);
			const name = rel === '' ? entry : `${rel}/${entry}`;
			const stat = lstatSync(full);
			if (stat.isDirectory()) walk(full, name);
			else if (stat.isFile()) out.set(name, stat.size);
		}
	};
	walk(dir, '');
	return out;
}

/**
 * ⭐ Why the Playwright results file `file` is not this run's, or undefined when it is: its config must name `<RUN>`'s own
 * store as its server's. ⛔ The reason never quotes the store it names — that path holds the account (`REG-F-536`).
 */
export function resultsRunProblem(file: string, run: string): string | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(file, 'utf8'));
	} catch {
		return 'is not readable JSON';
	}
	const webServer = rec(rec(parsed).config).webServer;
	const stores = (Array.isArray(webServer) ? webServer : [webServer])
		.map((s) => rec(rec(s).env).JPWB_DEMO_DB)
		.filter((d): d is string => typeof d === 'string');
	if (stores.length === 0)
		return "names no server store (config.webServer.env.JPWB_DEMO_DB), so it cannot be shown to be this run's";
	// Windows reads a path without case, as it compares one.
	const key = (p: string) => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));
	return stores.some((s) => key(s) === key(join(run, STORE_FILE)))
		? undefined
		: "is another run's: its server kept its store outside this run folder";
}

/** A link at `to` with `target`'s text, as `from` was: on Windows a folder's link needs its type, and a junction serves. */
function recreateLink(from: string, target: string, to: string): void {
	const folder = statSync(from, { throwIfNoEntry: false })?.isDirectory() === true;
	try {
		symlinkSync(target, to, folder ? 'dir' : 'file');
	} catch (e) {
		if (!folder || process.platform !== 'win32') throw e;
		symlinkSync(target, to, 'junction');
	}
}

/** `path`, `/`-separated, relative to whichever of `roots` holds it — or nothing, when none does: never an absolute path. */
const placeIn = (path: unknown, roots: readonly string[]): string => {
	if (typeof path !== 'string') return '';
	const root = roots.find((r) => resolve(path).startsWith(`${r}${sep}`));
	return root === undefined ? '' : ` at ${relative(root, resolve(path)).split(sep).join('/')}`;
};

/** ⭐ `run` copied whole into `partial`, each link made as a link: how many links, and those this host could not make. */
function copyWhole(run: string, partial: string, copy: typeof cpSync): { readonly links: number; readonly unmade: string[] } {
	const links: string[] = [];
	copy(run, partial, {
		recursive: true,
		errorOnExist: true,
		force: false,
		preserveTimestamps: true,
		// ⛔ A LINK IS NEVER HANDED TO `cpSync`, which would make it a symbolic link — refused here for a folder — or
		// re-point a relative one into the copy. Each is made below, as itself.
		filter: (from) => {
			if (!lstatSync(from).isSymbolicLink()) return true;
			links.push(from);
			return false;
		}
	});
	const unmade: string[] = [];
	for (const from of links)
		try {
			recreateLink(from, readlinkSync(from), join(partial, relative(run, from)));
		} catch (e) {
			const code = (e as NodeJS.ErrnoException).code ?? (e as Error).name;
			unmade.push(`${relative(run, from).split(sep).join('/')} (${code})`);
		}
	return { links: links.length, unmade };
}

/** Why `<RUN>-final` may not be made now, or undefined. */
function refusal(target: string, partial: string): string | undefined {
	if (existsSync(target))
		return `${basename(target)} already exists, and is left untouched: the copy is taken once`;
	if (existsSync(partial))
		return (
			`${basename(partial)} exists — an earlier copy failed part-way — and is left untouched for a person to read ` +
			'and remove'
		);
	return undefined;
}

/**
 * Returns the exit code. `results` is the Playwright results file to copy in: the lane's, unless a test names another.
 * `copy` is `cpSync` unless a test stands in a copy that fails part-way; `afterCopy` runs between the copy and the size
 * check — a test's stand-in for a server still writing.
 */
export function main(
	argv: readonly string[],
	write: (s: string) => void,
	o: { readonly results?: string; readonly copy?: typeof cpSync; readonly afterCopy?: () => void } = {}
): number {
	const say = (s: string) => write(`phase7/finalize-run — ${s}\n`);
	if (argv.length !== 1 || argv[0]!.startsWith('--')) {
		say('usage: bun scripts/phase7/finalize-run.ts <RUN>');
		return 2;
	}
	const run = resolve(argv[0]!);
	if (!existsSync(run) || !statSync(run).isDirectory()) {
		say(`usage: no run folder named ${basename(run)}`);
		return 2;
	}
	const target = `${run}-final`;
	const partial = `${target}${PARTIAL_SUFFIX}`;
	const refused = refusal(target, partial);
	if (refused !== undefined) {
		say(`refused, and nothing was copied: ${refused}`);
		return 2;
	}
	let copied: ReturnType<typeof copyWhole>;
	try {
		copied = copyWhole(run, partial, o.copy ?? cpSync);
	} catch (e) {
		const err = e as NodeJS.ErrnoException & { dest?: unknown };
		const where = placeIn(err.path ?? err.dest, [partial, run]);
		say(
			`refused: the copy failed part-way (${err.code ?? err.name}${where}), so no ${basename(target)} was made; ` +
				`${basename(partial)} holds what was copied, and is left for a person`
		);
		return 2;
	}
	o.afterCopy?.();
	const before = sizesUnder(run);
	const after = sizesUnder(partial);
	const differ = [...before].filter(([file, size]) => after.get(file) !== size).map(([file]) => file);
	const results = o.results ?? PLAYWRIGHT_RESULTS;
	const resultsProblem = existsSync(results) ? resultsRunProblem(results, run) : 'was not found';
	if (resultsProblem === undefined) cpSync(results, join(partial, RESULTS_NAME), { errorOnExist: true, force: false });
	renameSync(partial, target);
	const withResults =
		resultsProblem === undefined ? `, with ${RESULTS_NAME}` : `; ${RESULTS_NAME} ${resultsProblem}, so it was not copied into it`;
	say(`copied ${before.size} file(s) of ${basename(run)} to ${basename(target)}${withResults}`);
	if (copied.links > 0) {
		const unmade = copied.unmade.length > 0 ? `; ${copied.unmade.length} could not be made here: ${copied.unmade.join(', ')}` : '';
		say(`${copied.links} link(s) copied as links, never followed${unmade}`);
	}
	if (differ.length > 0)
		say(`${differ.length} file(s) changed size while they were copied — was the server still running? ${differ.join(', ')}`);
	return resultsProblem === undefined && differ.length === 0 && copied.unmade.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2), (s) => process.stdout.write(s));
