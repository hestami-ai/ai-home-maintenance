/**
 * `toolchain:check` — the first `gate:fast` step: the machine and the tree are the ones the matrix records
 * (JAN-TOOLCUR D-9; roadmap T0).
 *
 * WHY FIRST. It fails in seconds, before any step uses the runtime and before any cached step (F-10): a later step
 * would already have measured on a runtime nobody recorded. With turbo hashing the matrix and `.node-version`
 * (`globalDependencies`), the gate never reaches a cached result on a runtime the matrix does not record (I1).
 *
 * THE NINE CONDITIONS (D-9; the ninth, roadmap T6), each reported on its own line, each failure naming what disagrees
 * with what:
 *   1 runtimes      — the Node on PATH (asked, never assumed: Bun's `process.version` reads v24.3.0) against the
 *                     day-to-day Node, or against the floor in floor-lane mode; the running Bun against its exact pin.
 *   2 tree and lock — for each matrix package, every copy `bun.lock` holds (nested ones included) against the matrix,
 *                     and every installed copy against the lock (`gate:fast` runs no install, so the tree can drift).
 *   3 manifests     — declared ranges and pin styles against the matrix; a declared package with no row; a row no
 *                     manifest declares; `engines.node`, `devEngines`' Bun and `.node-version` against the matrix.
 *   4 peers         — each installed package's declared peer range on a matrix package, judged against the copy that
 *                     package resolves as `bun.lock` records it (I5). A peer resolved elsewhere is not judged here.
 *   5 cross-row     — the VS Code floor's Node, and the day-to-day Node, not below the Node floor.
 *   6 browser floor — Vite's `build.target` and the matrix's browser floor agree (both absent until T1c sets them).
 *   7 machine tools — the SonarLint version, found through `machine-paths.json`. Edge's row is recorded only since
 *                     T6: no lane runs it.
 *   8 population    — an unreadable or empty matrix or lock, or a lock holding no matrix package, fails (I6).
 *   9 e2e browser   — (T6) the app's Playwright configs on disk are exactly the e2eBrowser row's, none names a
 *                     `channel` or an `executablePath` (so each runs Playwright's own Chromium), and the row's
 *                     generated facts agree with `browsers.json` and the lock.
 * And the step runtimes: each `gate:fast` step's runtime, derived from its command and the shebang of the bin it
 * starts, against the runtime the matrix records for it (D-9, F-3).
 *
 * FLOOR-LANE MODE is declared by the environment, `JPWB_TOOLCHAIN_FLOOR_LANE=1`, not by a flag: the floor lane runs
 * the unchanged `bun run gate:fast`, whose steps `verif/assurance-surface.test.ts` pins one by one (roadmap T0).
 *
 * AUTHORITY. Like the rest of `gate:fast` this runs on the operator's machine: under DOC-004 §7.6, developer
 * convenience — valuable, and never the guarantee. It is filed as an interim carrier (REG-D-012 (3)) when T0 lands.
 *
 * usage: bun run scripts/toolchain/check.ts [--root=<dir>] [--override=<path>=<file> ...]
 * exit:  0 every condition holds; 1 a condition failed; 2 a usage error.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eBrowserFacts } from './e2e-browser.js';
import { copiesOf, installedDir, parseLockfile, resolveFrom, type LockPackage, type Lockfile } from './lockfile.js';
import { edgeInstalled, nodeOnPath, parseMachinePaths, runningBun, sonarLintInstalled, type MachinePaths } from './machine.js';
import { compareVersions, parseMatrix, versionParts, type Matrix, type PackageRow, type StepRuntime } from './matrix.js';
import { externalDeclarations, makeReader, parseOverrides, readManifest, workspaceDirs, type Manifest, type TreeReader } from './tree.js';

export const FLOOR_LANE_ENV = 'JPWB_TOOLCHAIN_FLOOR_LANE';
export const MATRIX_FILE = 'scripts/toolchain/matrix.json';
export const MACHINE_PATHS_FILE = 'scripts/toolchain/machine-paths.json';
export const VITE_CONFIG = 'apps/rph-demo/vite.config.ts';

interface Inputs {
	readonly reader: TreeReader;
	readonly matrix: Matrix;
	readonly lock: Lockfile;
	readonly manifests: readonly { readonly dir: string; readonly manifest: Manifest }[];
	readonly paths: MachinePaths;
	readonly floorLane: boolean;
}

interface Condition {
	readonly id: string;
	readonly title: string;
	readonly failures: readonly string[];
	readonly judged: string;
}

/**
 * How many items a condition judged. ⚠ A condition that judged NONE fails (I6): a reader that silently found no peer
 * declarations, no copies or no steps would otherwise print "ok" over nothing — the very failure F-7 records for the
 * boundary step. Conditions with a fixed population (1, 5, 6) do not count.
 */
interface Tally {
	judged: number;
}

/** A semver range test. Bun's own (`Bun.semver`), because this check runs under Bun and npm's ranges are its ranges. */
function satisfies(version: string, range: string): boolean {
	const bun = (globalThis as { Bun?: { semver?: { satisfies(v: string, r: string): boolean } } }).Bun;
	if (bun?.semver === undefined) throw new Error('toolchain:check reads peer ranges with Bun.semver, so it must run under Bun');
	return bun.semver.satisfies(version, range);
}

/** True when `version` has the floor's leading parts: floor `22` admits 22.x.y, floor `24.15.0` only 24.15.0. */
function isFloor(version: string, floor: string): boolean {
	const v = versionParts(version);
	return versionParts(floor).every((part, i) => v[i] === part);
}

function manifestPath(dir: string): string {
	return dir === '.' ? 'package.json' : `${dir}/package.json`;
}

// ── 1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function runtimes(x: Inputs, _t: Tally): string[] {
	const f: string[] = [];
	const node = nodeOnPath();
	const { dayToDay, floor } = x.matrix.node;
	if (node.error !== undefined) f.push(`the Node on PATH could not be asked its version: ${node.error}`);
	else if (node.isBun) f.push(`the \`node\` on PATH is Bun (it reports v${node.version}), not Node`);
	else if (x.floorLane) {
		if (!isFloor(node.version, floor)) {
			f.push(`floor-lane mode (${FLOOR_LANE_ENV}): the Node on PATH is ${node.version}; the matrix's recorded floor is ${floor}`);
		}
	} else if (node.version !== dayToDay) {
		f.push(`the Node on PATH is ${node.version}; the matrix's day-to-day Node is ${dayToDay} (.node-version)`);
	}
	const bun = runningBun();
	if (bun === undefined) f.push('this check is not running under Bun, so the running Bun cannot be compared with its pin');
	else if (bun !== x.matrix.bun.version) f.push(`the running Bun is ${bun}; the matrix pins Bun ${x.matrix.bun.version}`);
	return f;
}

// ── 2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function installedVersion(x: Inputs, key: string): string | undefined {
	const text = x.reader.read(`${installedDir(key)}/package.json`);
	if (text === undefined) return undefined;
	const v = (JSON.parse(text) as { version?: unknown }).version;
	return typeof v === 'string' ? v : '';
}

/** The lock's nested copies of one package against the matrix's record of them, both ways. */
function nestedFailures(c: string, recorded: Readonly<Record<string, string>>, held: ReadonlyMap<string, string>): string[] {
	const f: string[] = [];
	for (const [key, v] of Object.entries(recorded)) {
		const inLock = held.get(key);
		if (inLock === undefined) f.push(`${c}: the matrix records a nested copy ${key} ${v}, which bun.lock does not hold`);
		else if (inLock !== v) f.push(`${c}: bun.lock's nested ${key} is ${inLock}; the matrix records ${v}`);
	}
	for (const [key, inLock] of held) {
		if (!(key in recorded)) f.push(`${c}: bun.lock holds a nested copy ${key} ${inLock}, which the matrix does not record`);
	}
	return f;
}

/** One installed copy against the lock. */
function installedFailure(x: Inputs, c: string, copy: LockPackage): string | undefined {
	const installed = installedVersion(x, copy.key);
	if (installed === undefined) return `${c}: ${installedDir(copy.key)} is not installed; bun.lock records ${copy.version}`;
	if (installed !== copy.version) return `${c}: the installed ${installedDir(copy.key)} is ${installed}; bun.lock records ${copy.version}`;
	return undefined;
}

function treeAndLock(x: Inputs, t: Tally): string[] {
	const f: string[] = [];
	for (const row of x.matrix.packages) {
		const c = row.component;
		const copies = copiesOf(x.lock, c);
		const hoisted = copies.find((p) => p.parent === '');
		if (hoisted === undefined) f.push(`${c}: bun.lock holds no hoisted copy; the matrix records ${row.locked}`);
		else if (hoisted.version !== row.locked) f.push(`${c}: bun.lock resolves ${hoisted.version}; the matrix records ${row.locked}`);
		f.push(...nestedFailures(c, row.nested, new Map(copies.filter((p) => p.parent !== '').map((p) => [p.key, p.version]))));
		for (const copy of copies) {
			t.judged++;
			const failure = installedFailure(x, c, copy);
			if (failure !== undefined) f.push(failure);
		}
	}
	return f;
}

// ── 3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const BARE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function pinStyleFailure(name: string, range: string, where: string, pin: string, locked: string): string | undefined {
	if (pin === 'exact' && !BARE_VERSION.test(range)) return `${name} is declared ${range} in ${where}; its pin style is exact`;
	if (pin === 'exact' && range !== locked) return `${name} is declared exactly ${range} in ${where}; the lock resolves ${locked}`;
	if (pin === 'caret' && !range.startsWith('^')) return `${name} is declared ${range} in ${where}; its pin style is caret`;
	return undefined;
}

/** One manifest's declaration of one package, against its matrix row (or the row's absence). */
function declarationFailures(row: PackageRow | undefined, name: string, range: string, dir: string): string[] {
	const where = manifestPath(dir);
	if (row === undefined) return [`${where} declares ${name} ${range}, and the matrix has no row for it`];
	const f: string[] = [];
	const recorded = row.declared[dir];
	if (recorded === undefined) f.push(`${where} declares ${name} ${range}; the matrix records no declaration there`);
	else if (recorded !== range) f.push(`${where} declares ${name} ${range}; the matrix records ${recorded}`);
	const style = pinStyleFailure(name, range, where, row.pin, row.locked);
	if (style !== undefined) f.push(style);
	return f;
}

/** The root manifest's runtime fields and `.node-version`, against the matrix. */
function rootFieldFailures(x: Inputs): string[] {
	const f: string[] = [];
	const root = x.manifests.find((m) => m.dir === '.')?.manifest;
	const floor = x.matrix.node.floor;
	const engines = root?.engines?.node;
	if (engines !== `>=${floor}`) {
		f.push(`package.json's engines.node is ${JSON.stringify(engines)}; the matrix's Node floor makes it ">=${floor}"`);
	}
	const pm = root?.devEngines?.packageManager;
	if (pm?.name !== 'bun' || pm.version !== x.matrix.bun.version) {
		f.push(`package.json's devEngines.packageManager is ${JSON.stringify(pm)}; the matrix pins bun ${x.matrix.bun.version}`);
	}
	const nodeVersion = x.reader.read('.node-version')?.trim();
	if (nodeVersion !== x.matrix.node.dayToDay) {
		f.push(`.node-version reads ${JSON.stringify(nodeVersion)}; the matrix's day-to-day Node is ${x.matrix.node.dayToDay}`);
	}
	return f;
}

function manifests(x: Inputs, t: Tally): string[] {
	const f: string[] = [];
	const rows = new Map(x.matrix.packages.map((r) => [r.component, r]));
	const declared = new Set<string>();
	for (const { dir, manifest } of x.manifests) {
		for (const [name, range] of externalDeclarations(manifest)) {
			t.judged++;
			declared.add(`${name}\u0000${dir}`);
			f.push(...declarationFailures(rows.get(name), name, range, dir));
		}
	}
	for (const row of x.matrix.packages) {
		for (const dir of Object.keys(row.declared)) {
			if (!declared.has(`${row.component}\u0000${dir}`)) {
				f.push(`the matrix records ${row.component} declared in ${manifestPath(dir)}, which declares no ${row.component}`);
			}
		}
	}
	return [...f, ...rootFieldFailures(x)];
}

// ── 4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
interface PeerManifest {
	readonly version?: string;
	readonly peerDependencies?: Readonly<Record<string, string>>;
	readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>;
}

/** One declared peer range on a matrix package, judged against the copy the declaring package resolves. */
function peerFailure(x: Inputs, p: LockPackage, manifest: PeerManifest, peer: string, range: string, t: Tally): string | undefined {
	const copy = resolveFrom(x.lock, p.key, peer);
	if (copy === undefined) {
		if (manifest.peerDependenciesMeta?.[peer]?.optional === true) return undefined;
		return `${p.name} ${p.version} declares peer ${peer} ${range}, and no copy of ${peer} resolves from ${installedDir(p.key)}`;
	}
	t.judged++;
	if (!satisfies(copy.version, range)) {
		return `${p.name} ${p.version} declares peer ${peer} ${range}; it resolves ${peer} ${copy.version} (${installedDir(copy.key)})`;
	}
	return undefined;
}

function peers(x: Inputs, t: Tally): string[] {
	const f: string[] = [];
	const components = new Set(x.matrix.packages.map((r) => r.component));
	for (const p of x.lock.packages.values()) {
		const text = p.version.startsWith('workspace:') ? undefined : x.reader.read(`${installedDir(p.key)}/package.json`);
		if (text === undefined) continue;
		const manifest = JSON.parse(text) as PeerManifest;
		for (const [peer, range] of Object.entries(manifest.peerDependencies ?? {})) {
			const failure = components.has(peer) ? peerFailure(x, p, manifest, peer, range, t) : undefined;
			if (failure !== undefined) f.push(failure);
		}
	}
	return f;
}

// ── 5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function crossRow(x: Inputs, _t: Tally): string[] {
	const f: string[] = [];
	const { floor, dayToDay } = x.matrix.node;
	const v = x.matrix.vscode;
	if (compareVersions(v.floorNode, floor) < 0) {
		f.push(`the VS Code floor ${v.floor} runs Node ${v.floorNode} (Electron ${v.floorElectron}), below the Node floor ${floor}`);
	}
	if (compareVersions(dayToDay, floor) < 0) f.push(`the day-to-day Node ${dayToDay} is below the Node floor ${floor}`);
	return f;
}

// ── 6 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The index just past the string literal whose opening quote is at `start`. */
function stringEnd(source: string, start: number): number {
	const quote = source.charAt(start);
	let i = start + 1;
	while (i < source.length && source.charAt(i) !== quote) i += source.charAt(i) === '\\' ? 2 : 1;
	return Math.min(i + 1, source.length);
}

/** Source text with its comments blanked, strings kept, so a `target:` inside a comment is not read as config. */
export function withoutComments(source: string): string {
	let out = '';
	let i = 0;
	while (i < source.length) {
		const ch = source.charAt(i);
		const pair = source.slice(i, i + 2);
		let next = i + 1;
		if (ch === '"' || ch === "'" || ch === '`') {
			next = stringEnd(source, i);
			out += source.slice(i, next);
		} else if (pair === '//') {
			const end = source.indexOf('\n', i);
			next = end < 0 ? source.length : end;
		} else if (pair === '/*') {
			const end = source.indexOf('*/', i + 2);
			next = end < 0 ? source.length : end + 2;
			out += ' ';
		} else out += ch;
		i = next;
	}
	return out;
}

function browserFloor(x: Inputs, _t: Tally): string[] {
	const config = x.reader.read(VITE_CONFIG);
	if (config === undefined) return [`${VITE_CONFIG} is missing`];
	const code = withoutComments(config);
	const build = /\bbuild\s*:\s*\{([^}]*)\}/.exec(code)?.[1];
	const target = build === undefined ? undefined : /\btarget\s*:\s*(['"`])([^'"`]*)\1/.exec(build)?.[2];
	const floor = x.matrix.browserFloor;
	if (floor === null && target !== undefined) {
		return [`${VITE_CONFIG} sets build.target ${JSON.stringify(target)}, and the matrix declares no browser floor`];
	}
	if (floor !== null && target !== floor) {
		return [`${VITE_CONFIG} sets build.target ${JSON.stringify(target)}; the matrix's browser floor is ${floor}`];
	}
	return [];
}

// ── 7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function edgeFailure(x: Inputs, observed: string): string | undefined {
	const edge = edgeInstalled(x.paths);
	if (edge === undefined) return `Edge: no version folder under ${x.paths.edge.roots.join(', ')}`;
	const major = String(versionParts(edge.version)[0]);
	if (major !== observed) return `Edge: the machine has major ${major} installed (${edge.all.join(', ')}); the matrix records ${observed}`;
	return undefined;
}

function sonarLintFailure(x: Inputs, observed: string): string | undefined {
	const sl = sonarLintInstalled(x.paths);
	if (sl === undefined) return `SonarLint: no extension under ${x.paths.sonarlint.roots.join(', ')}`;
	if (sl.version !== observed) return `SonarLint: the machine has ${sl.version} (under ${sl.where}); the matrix records ${observed}`;
	return undefined;
}

function machineTools(x: Inputs, t: Tally): string[] {
	const f: string[] = [];
	for (const row of x.matrix.machine) {
		if (row.check === 'none') continue;
		t.judged++;
		let failure: string | undefined;
		if (row.component === 'edge' && row.check === 'major') failure = edgeFailure(x, row.observed);
		else if (row.component === 'sonarlint' && row.check === 'version') failure = sonarLintFailure(x, row.observed);
		else failure = `machine ${row.component}: the check "${row.check}" has no probe here, so it cannot be compared`;
		if (failure !== undefined) f.push(failure);
	}
	return f;
}

// ── the step runtimes ────────────────────────────────────────────────────────────────────────────────────────────
interface Derived {
	readonly runtimes: Set<'node' | 'bun'>;
	readonly detail: string[];
}

type BinRuntime = { readonly runtime: 'node' | 'bun' } | { readonly problem: string };

/** The runtime a bin starts, read from the shebang of the file the lock says the bin is. */
function binRuntime(x: Inputs, bin: string): BinRuntime {
	const holders = [...x.lock.packages.values()].filter((p) => p.bin[bin] !== undefined);
	const holder = holders.find((p) => p.parent === '') ?? holders[0];
	if (holder === undefined) return { problem: `no package in bun.lock declares the bin ${bin}` };
	const file = `${installedDir(holder.key)}/${holder.bin[bin] ?? ''}`;
	const first = x.reader.read(file)?.split('\n', 1)[0] ?? '';
	if (/^#!.*\bnode\b/.test(first)) return { runtime: 'node' };
	if (/^#!.*\bbun\b/.test(first)) return { runtime: 'bun' };
	return { problem: `${file} starts ${JSON.stringify(first.slice(0, 40))}, which names no runtime` };
}

function scriptsAt(x: Inputs, cwd: string): Readonly<Record<string, string>> {
	return x.manifests.find((m) => m.dir === cwd)?.manifest.scripts ?? {};
}

/** One `&&` part of a command: the runtime it starts, a script it hands on to, a problem, or nothing (`cd`). */
type Part =
	| { readonly runtime: 'node' | 'bun'; readonly detail: string }
	| { readonly script: string }
	| { readonly problem: string }
	| null;

function classifyPart(x: Inputs, part: string, cwd: string): Part {
	const words = part.split(/\s+/);
	while (words.length > 0 && /^[A-Z_][A-Z0-9_]*=/.test(words[0] ?? '')) words.shift();
	const head = words[0] ?? '';
	if (head === '' || head === 'cd') return null;
	if ((head === 'bun' || head === 'bunx') && words.includes('--bun')) return { runtime: 'bun', detail: `'${part}' forces Bun with --bun` };
	const script = head === 'bun' && words[1] === 'run' ? words[2] : undefined;
	if (script !== undefined && scriptsAt(x, cwd)[script] !== undefined) return { script };
	if (head === 'bun') return { runtime: 'bun', detail: `'${part}' runs a file under Bun` };
	const bin = head === 'bunx' ? (words.slice(1).find((w) => !w.startsWith('-')) ?? '') : head;
	const r = binRuntime(x, bin);
	if ('problem' in r) return { problem: `'${part}': cannot tell which runtime runs it — ${r.problem}` };
	return { runtime: r.runtime, detail: `${bin} starts ${r.runtime}` };
}

function deriveRuntime(x: Inputs, command: string, cwd: string, depth: number, out: Derived, f: string[]): void {
	for (const part of command.split(' && ').map((s) => s.trim())) {
		const kind = classifyPart(x, part, cwd);
		if (kind === null) continue;
		if ('problem' in kind) f.push(kind.problem);
		else if ('script' in kind) {
			if (depth >= 4) f.push(`'${part}' nests scripts more than four deep`);
			else deriveRuntime(x, scriptsAt(x, cwd)[kind.script] ?? '', cwd, depth + 1, out, f);
		} else {
			out.runtimes.add(kind.runtime);
			out.detail.push(kind.detail);
		}
	}
}

function stepRuntimes(x: Inputs, t: Tally): string[] {
	const f: string[] = [];
	const gate = scriptsAt(x, '.')['gate:fast'];
	if (gate === undefined) return ['package.json has no gate:fast script'];
	let cwd = '.';
	const seen = new Set<string>();
	for (const step of gate.split(' && ').map((s) => s.trim())) {
		t.judged++;
		seen.add(step);
		const derived: Derived = { runtimes: new Set(), detail: [] };
		deriveRuntime(x, step, cwd, 0, derived, f);
		if (step.startsWith('cd ')) cwd = posix.normalize(posix.join(cwd, step.slice(3).trim()));
		let runtime: StepRuntime = 'none';
		if (derived.runtimes.size === 2) runtime = 'node+bun';
		else if (derived.runtimes.has('node')) runtime = 'node';
		else if (derived.runtimes.has('bun')) runtime = 'bun';
		const recorded = x.matrix.gateSteps[step];
		if (recorded === undefined) f.push(`gate:fast step '${step}' runs on ${runtime}, and the matrix records no runtime for it`);
		else if (recorded !== runtime) {
			f.push(`gate:fast step '${step}' runs on ${runtime} (${derived.detail.join('; ')}); the matrix records ${recorded}`);
		}
	}
	for (const step of Object.keys(x.matrix.gateSteps)) {
		if (!seen.has(step)) f.push(`the matrix records a gate step '${step}', which gate:fast does not run`);
	}
	return f;
}

// ── 9 (roadmap T6): the e2e browser ───────────────────────────────────────────────────────────────────────────
/** The app whose Playwright configs condition 9 judges, and the names a config file takes. */
const E2E_APP = 'apps/rph-demo';
const PLAYWRIGHT_CONFIG = /^playwright(?:\.[\w-]+)?\.config\.ts$/;

/** The app's Playwright configs on disk, by path from the root. Read from the disk, not the reader: a red that lists
 * one config too few or too many doctors the matrix's list instead. */
function configsOnDisk(x: Inputs): string[] {
	const dir = join(x.reader.root, E2E_APP);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => PLAYWRIGHT_CONFIG.test(name))
		.map((name) => `${E2E_APP}/${name}`)
		.sort((a, b) => a.localeCompare(b));
}

/** Each line of a config that sets a browser channel or an executable; a comment that names either sets nothing. */
function browserSettings(config: string, text: string, shown: string): string[] {
	const f: string[] = [];
	text.split(/\r?\n/).forEach((line, i) => {
		const comment = line.indexOf('//');
		const code = comment < 0 ? line : line.slice(0, comment);
		if (/\bchannel\s*:/.test(code)) {
			f.push(`${config}:${i + 1} sets a browser channel (${line.trim()}); the e2e browser is ${shown}, which no channel selects`);
		}
		if (/\bexecutablePath\b/.test(code)) f.push(`${config}:${i + 1} sets an executablePath (${line.trim()}); the e2e browser is ${shown}`);
	});
	return f;
}

function e2eBrowser(x: Inputs, t: Tally): string[] {
	const row = x.matrix.e2eBrowser;
	const shown = `Playwright's own Chromium ${row.browserVersion} (revision ${row.revision})`;
	const listed = [...row.configs].sort((a, b) => a.localeCompare(b));
	const f: string[] = [];
	if (listed.length === 0) f.push("the matrix's e2e browser row lists no Playwright config, so it would judge none (I6)");
	for (const config of configsOnDisk(x)) {
		if (!listed.includes(config)) f.push(`${config} is a Playwright config the matrix's e2e browser row does not list`);
	}
	for (const config of listed) {
		const text = x.reader.read(config);
		if (text === undefined) {
			f.push(`the matrix's e2e browser row lists ${config}, which is not there`);
			continue;
		}
		t.judged++;
		f.push(...browserSettings(config, text, shown));
	}
	try {
		const facts = e2eBrowserFacts(x.reader, x.lock);
		for (const k of ['playwright', 'revision', 'browserVersion', 'headlessShellRevision'] as const) {
			if (facts[k] !== row[k]) f.push(`the e2e browser's ${k} is ${facts[k]} in the tree; the matrix records ${row[k]} (generate.ts writes it)`);
		}
	} catch (e) {
		f.push(`the e2e browser's facts could not be read: ${(e as Error).message}`);
	}
	return f;
}

// ── 8, and the run ───────────────────────────────────────────────────────────────────────────────────────────────
function loadMatrix(reader: TreeReader, problems: string[]): Matrix | undefined {
	const matrixText = reader.read(MATRIX_FILE);
	if (matrixText === undefined || matrixText.trim() === '') {
		problems.push(`${MATRIX_FILE} is missing or empty`);
		return undefined;
	}
	try {
		return parseMatrix(matrixText);
	} catch (e) {
		problems.push((e as Error).message);
		return undefined;
	}
}

function loadLock(reader: TreeReader, problems: string[]): Lockfile | undefined {
	const lockText = reader.read('bun.lock');
	if (lockText === undefined || lockText.trim() === '') {
		problems.push('bun.lock is missing or empty');
		return undefined;
	}
	try {
		const lock = parseLockfile(lockText);
		if (lock.packages.size === 0) problems.push('bun.lock holds no packages');
		return lock;
	} catch (e) {
		problems.push(`bun.lock is unreadable: ${(e as Error).message}`);
		return undefined;
	}
}

function loadPaths(reader: TreeReader, problems: string[]): MachinePaths | undefined {
	const pathsText = reader.read(MACHINE_PATHS_FILE);
	if (pathsText === undefined) {
		problems.push(`${MACHINE_PATHS_FILE} is missing`);
		return undefined;
	}
	try {
		return parseMachinePaths(pathsText);
	} catch (e) {
		problems.push((e as Error).message);
		return undefined;
	}
}

function loadManifests(reader: TreeReader, problems: string[]): { dir: string; manifest: Manifest }[] {
	try {
		return workspaceDirs(reader).map((dir) => {
			const manifest = readManifest(reader, dir);
			if (manifest === undefined) throw new Error(`${manifestPath(dir)} is missing`);
			return { dir, manifest };
		});
	} catch (e) {
		problems.push((e as Error).message);
		return [];
	}
}

function load(reader: TreeReader, floorLane: boolean): Inputs | string[] {
	const problems: string[] = [];
	const matrix = loadMatrix(reader, problems);
	const lock = loadLock(reader, problems);
	if (matrix !== undefined && lock !== undefined && !matrix.packages.some((r) => copiesOf(lock, r.component).length > 0)) {
		problems.push(`bun.lock holds none of the matrix's ${matrix.packages.length} packages`);
	}
	const paths = loadPaths(reader, problems);
	const manifestList = loadManifests(reader, problems);
	if (problems.length > 0 || matrix === undefined || lock === undefined || paths === undefined) return problems;
	return { reader, matrix, lock, manifests: manifestList, paths, floorLane };
}

/** id, title, the noun its tally counts ('' for a fixed population), and the condition. */
const CONDITIONS: readonly [string, string, string, (x: Inputs, t: Tally) => string[]][] = [
	['1', 'runtimes', '', runtimes],
	['2', 'installed tree and lock', 'installed copies', treeAndLock],
	['3', 'manifests', 'declarations', manifests],
	['4', 'peer ranges', 'peer ranges on matrix packages', peers],
	['5', 'cross-row rules', '', crossRow],
	['6', 'browser floor', '', browserFloor],
	['7', 'machine tools', 'machine tools', machineTools],
	['9', 'e2e browser', 'Playwright configs', e2eBrowser],
	['steps', 'gate step runtimes', 'gate steps', stepRuntimes]
];

function evaluate(inputs: Inputs, [id, title, noun, run]: (typeof CONDITIONS)[number]): Condition {
	const tally: Tally = { judged: 0 };
	let failures: string[];
	try {
		failures = run(inputs, tally);
	} catch (e) {
		return { id, title, failures: [`the condition could not be evaluated: ${(e as Error).message}`], judged: '' };
	}
	if (noun === '') return { id, title, failures, judged: '' };
	if (tally.judged === 0) failures = [...failures, `it judged 0 ${noun}: a check over nothing fails (I6)`];
	return { id, title, failures, judged: ` (${tally.judged} ${noun})` };
}

export function main(argv: readonly string[], out: (s: string) => void, env: NodeJS.ProcessEnv = process.env): number {
	const rootFlag = argv.find((a) => a.startsWith('--root='));
	const unknown = argv.filter((a) => !a.startsWith('--root=') && !a.startsWith('--override='));
	if (unknown.length > 0) {
		out(`toolchain:check — unknown argument(s): ${unknown.join(' ')}\n`);
		return 2;
	}
	let reader: TreeReader;
	try {
		const root = rootFlag === undefined ? fileURLToPath(new URL('../../', import.meta.url)) : rootFlag.slice('--root='.length);
		reader = makeReader(root, parseOverrides(argv));
	} catch (e) {
		out(`toolchain:check — ${(e as Error).message}\n`);
		return 2;
	}
	const floorLane = env[FLOOR_LANE_ENV] === '1';
	const mode = floorLane ? 'FLOOR-LANE mode' : 'normal mode';
	const overridden = reader.overridden.length > 0 ? `; overridden: ${reader.overridden.join(', ')}` : '';
	out(`toolchain:check — ${mode}${overridden}\n`);
	const inputs = load(reader, floorLane);
	if (Array.isArray(inputs)) {
		const lines = inputs.map((p) => `      - ${p}\n`).join('');
		out(`  8 population: FAILED\n${lines}`);
		out('toolchain:check — FAILED: condition 8 (the inputs are empty or unreadable, so nothing else was compared).\n');
		return 1;
	}
	out('  8 population: ok\n');
	const results: Condition[] = CONDITIONS.map((c) => evaluate(inputs, c));
	for (const r of results) {
		out(`  ${r.id} ${r.title}: ${r.failures.length === 0 ? 'ok' : 'FAILED'}${r.judged}\n`);
		for (const failure of r.failures) out(`      - ${failure}\n`);
	}
	const failed = results.filter((r) => r.failures.length > 0);
	if (failed.length > 0) {
		const names = failed.map((r) => `${r.id} (${r.title})`).join(', ');
		out(`toolchain:check — FAILED: ${names}.\n`);
		return 1;
	}
	const m = inputs.matrix;
	const checkedTools = m.machine.filter((t) => t.check !== 'none').length;
	out(
		`toolchain:check — every condition holds: Node ${m.node.dayToDay} (floor ${m.node.floor}), Bun ${m.bun.version}, ` +
			`${m.packages.length} packages, ${checkedTools} machine tool${checkedTools === 1 ? '' : 's'} checked, ` +
			`${Object.keys(m.gateSteps).length} gate steps, e2e browser Chromium ${m.e2eBrowser.browserVersion}.\n`
	);
	return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2), (s) => process.stdout.write(s));
