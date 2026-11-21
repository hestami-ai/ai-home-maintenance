// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`; the lead's rulings r1 on `d84/d84-facts.md` §3, departures 4, 5 and 6) — THE
// MEASUREMENT FOLDER, THE CASE'S COPY AND ITS OPEN: where D84 may keep its records (T4), the copy of a run's final archive checked file by file (T3), and
// the open as the server opens its store, refused where it writes (departure 4) — each through the launcher's own steps as well.
// ⭑ THE ARCHIVE IS THIS FILE'S OWN: a store the product makes (`openWorkbench`, seeded) and backed up by the run archive's own `backupStore`, beside a
// workspace, a process output, a sessions folder and a purge record, and the archive's `checks.json` in its form. ⛔ No run folder is read.
// ⭑ THE HOST: the run folder's (`RunFolderHost`), over a sandbox of this file's — a repository and a temporary folder of its own, and nothing above it
// seen — so each rule is asked of real folders, and none of this machine's own folders is read.
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { listByType } from '@janumipwb/rph-engine';
import { afterAll, describe, expect, it } from 'vitest';
import { backupStore, CONTENT_STORE, RECORD_STORE, workspaceDirectoryOf } from '../../../../../../scripts/phase7/run-archive.js';
import { workspaceTreeSha256 } from '../../../../../../scripts/phase7/node-tests.js';
import type { AssuranceStageDeps } from '../assurance/assurance-stage.js';
import { openWorkbench } from '../workbench.js';
import { copyStoreOf, D84_LAYOUT, readJson, sha256Of } from './d84-files.js';
import {
	afterOpenRefusal,
	beginMeasurementFolder,
	copyFromArchive,
	measurementFolderProblems,
	serverStoreRefusal,
	storeReading,
	type CopyManifest,
	type MeasurementHost
} from './d84-folder.js';
import { runD84Step, type StepHost } from './d84-steps.js';

const TMP = mkdtempSync(join(tmpdir(), 'jpwb-d84-folder-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
const fresh = (name: string): string => mkdtempSync(join(TMP, `${name}-`));

/** Does `child` lie inside `parent`, or name it? */
const inside = (child: string, parent: string): boolean => {
	const rel = relative(resolve(parent), resolve(child));
	return rel === '' || (!rel.startsWith('..') && !rel.includes(`..${sep}`) && !/^[A-Za-z]:/.test(rel));
};

/**
 * ⭑ A SANDBOX HOST: the run folder's host over `root` alone — `root/repo` a repository (its config there, `.git` beside it), `root/tmp` the temporary
 * folder — and nothing outside `root` seen (each folder above it holds nothing), so no rule reads this machine's own folders.
 */
function sandboxHost(root: string): MeasurementHost {
	mkdirSync(join(root, 'repo', '.git'), { recursive: true });
	mkdirSync(join(root, 'tmp'), { recursive: true });
	const seen = (p: string) => inside(p, root);
	return {
		platform: process.platform,
		configFile: join(root, 'repo', 'playwright.live-exec.config.ts'),
		tmpdir: () => join(root, 'tmp'),
		exists: (p) => seen(p) && existsSync(p),
		isDirectory: (p) => seen(p) && statSync(p, { throwIfNoEntry: false })?.isDirectory() === true,
		realpath: (p) => resolve(p),
		list: (p) => (seen(p) && existsSync(p) ? readdirSync(p) : []),
		mkdtemp: (prefix) => mkdtempSync(prefix)
	};
}

/** Every file and link under `root`, by its `/`-separated path: a file's bytes as hex, a link's target's text — this test's own reading. */
function treeOf(root: string): Record<string, string> {
	const out: Record<string, string> = {};
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir)) {
			const at = join(dir, name);
			const rel = relative(root, at).split(sep).join('/');
			const stat = lstatSync(at);
			if (stat.isSymbolicLink()) out[rel] = `link -> ${readlinkSync(at)}`;
			else if (stat.isDirectory()) walk(at);
			else out[rel] = readFileSync(at).toString('hex');
		}
	};
	walk(root);
	return out;
}

/** The product's store, made once (`openWorkbench`, seeded) and closed: each archive's lane store is a copy of its bytes. */
let template: { readonly store: string; readonly unitId: string; readonly undertakingId: string } | undefined;
function templateStore(): NonNullable<typeof template> {
	if (template === undefined) {
		const store = join(fresh('template'), 'demo.sqlite');
		const engine = openWorkbench(store);
		const unit = listByType(engine, 'PROFESSIONAL_WORK_UNIT')[0]!;
		engine.close();
		template = { store, unitId: unit.id, undertakingId: String(unit.state.undertakingId) };
	}
	return template;
}

/** ⭐ A RUN'S FINAL ARCHIVE, as the lane writes one (`archiveUnit`'s layout and `checks.json` form), of a store the product made. */
async function anArchive(o: { readonly walStore?: boolean } = {}): Promise<{ readonly source: string; readonly unitId: string; readonly undertakingId: string }> {
	const root = fresh('run');
	const live = join(root, 'lane', 'demo.sqlite');
	mkdirSync(dirname(live), { recursive: true });
	const { store, unitId, undertakingId } = templateStore();
	// ⭑ The template is closed, its write-ahead log checkpointed into it: its one file is the whole store.
	copyFileSync(store, live);
	const content = new DatabaseSync(`${live}.content.sqlite`);
	content.exec("CREATE TABLE artifacts (k TEXT PRIMARY KEY, v BLOB); INSERT INTO artifacts VALUES ('a', 'the bytes')");
	content.close();
	const source = join(root, 'lane', 'archive', '06-final');
	mkdirSync(source, { recursive: true });
	const record = await backupStore(live, join(source, RECORD_STORE));
	const stores = [{ name: RECORD_STORE, present: true, ...record }];
	if (o.walStore === true) {
		const db = new DatabaseSync(join(source, RECORD_STORE));
		db.exec('PRAGMA journal_mode = WAL');
		db.close();
		stores[0] = { ...stores[0]!, sha256: sha256Of(readFileSync(join(source, RECORD_STORE))) };
	}
	stores.push({ name: CONTENT_STORE, present: true, ...(await backupStore(`${live}.content.sqlite`, join(source, CONTENT_STORE))) });
	const workspace = join(source, 'workspace');
	mkdirSync(join(workspace, 'src'), { recursive: true });
	mkdirSync(join(workspace, 'linked'));
	writeFileSync(join(workspace, 'src', 'reader.ts'), 'export const read = () => "";\r\n');
	writeFileSync(join(workspace, 'linked', 'inside.txt'), 'inside');
	// ⚠ A junction: Windows makes one with no privilege (the run archive's own test does the same).
	symlinkSync(join(workspace, 'linked'), join(workspace, 'link'), 'junction');
	mkdirSync(join(source, 'process-output', 'captures', 'step-1'), { recursive: true });
	writeFileSync(join(source, 'process-output', 'captures', 'step-1', 'stdout.txt'), 'ran\n');
	mkdirSync(join(source, 'sessions', 'assurance-stage.hypothesizer'), { recursive: true });
	writeFileSync(join(source, 'sessions', 'assurance-stage.hypothesizer', 'session.jsonl'), '{"turn":1}\n');
	const tombstone = `${basename(workspaceDirectoryOf(live, undertakingId))}.jpwb-workspace-tombstones.json`;
	writeFileSync(join(source, tombstone), '[]\n');
	writeFileSync(
		join(source, 'checks.json'),
		`${JSON.stringify(
			{
				hashes: { treeSha256: workspaceTreeSha256(workspace) },
				archived: { stores, workspace: { present: true }, processOutput: { present: true }, tombstones: [tombstone], sessions: { present: true } }
			},
			null,
			'\t'
		)}\n`
	);
	return { source, unitId, undertakingId };
}

/** The archive's `checks.json`, rewritten by `change`. */
function checksRewritten(source: string, change: (checks: Record<string, unknown>) => void): void {
	const checks = JSON.parse(readFileSync(join(source, 'checks.json'), 'utf8')) as Record<string, unknown>;
	change(checks);
	writeFileSync(join(source, 'checks.json'), JSON.stringify(checks));
}

/** A measurement folder, begun empty for `source` and `unitId` (its rules asked of the sandbox host). */
function begun(source: string, unitId: string, root: string = fresh('measure')): string {
	const folder = join(root, 'm');
	mkdirSync(folder);
	const done = beginMeasurementFolder(folder, { begunAt: 'now', checkoutHead: 'fixture', source, unitId, earlierFolders: [] }, sandboxHost(root));
	expect(done, 'arrangement: the measurement folder is begun').toEqual({ begun: true });
	return folder;
}

describe('⭐⭐ D84 (T4; departure 6) — the measurement folder: the run folder’s rules, whole, and D84’s own', () => {
	it('⛔ RED FIRST — refused, by its words: inside a git tree, inside the temporary folder, not empty, a run folder’s marks at or above it, the source itself or around it, and a name Pi reads on its path; ⭑ CONTROL: an empty folder beside them admitted', () => {
		const root = fresh('rules');
		const host = sandboxHost(root);
		const made = (...parts: string[]): string => {
			const at = join(root, ...parts);
			mkdirSync(at, { recursive: true });
			return at;
		};
		const source = made('archive', '06-final');
		const problemsOf = (folder: string, from: string = source) => measurementFolderProblems(folder, from, host, false);
		const some = (problems: readonly string[], start: string): boolean => problems.some((p) => p.startsWith(start));

		expect(some(problemsOf(made('repo', 'm')), 'it lies inside a git working tree'), 'a folder inside a git tree was admitted').toBe(true);
		expect(some(problemsOf(made('tmp', 'm')), 'it lies inside the temporary folder'), 'a folder inside the temporary folder was admitted').toBe(true);
		const full = made('full');
		writeFileSync(join(full, 'x.txt'), 'x');
		expect(problemsOf(full), 'a folder not empty was admitted').toContain('it is not empty (1 name(s) in it): a measurement folder is begun empty, and written once');
		const run = made('runs', 'R');
		writeFileSync(join(run, 'demo.sqlite'), '');
		expect(problemsOf(made('runs', 'R', 'm')), 'a folder in a run folder was admitted').toContain(
			`${run}, a folder above it, holds demo.sqlite: a run folder's marks, and no measurement is kept in a run folder`
		);
		made('lanes', 'lane');
		expect(problemsOf(made('lanes', 'm')).some((p) => p.endsWith("holds lane: a run folder's marks, and no measurement is kept in a run folder")), 'a folder beside a lane was admitted').toBe(true);
		expect(problemsOf(made('archive', '06-final', 'm')), 'a folder inside its source was admitted').toContain('it lies inside the source it is to copy, or is it: the source is read and never written');
		expect(problemsOf(source), 'the source itself was admitted').toContain('it lies inside the source it is to copy, or is it: the source is read and never written');
		const around = made('around');
		expect(problemsOf(around, made('around', 'src')), 'a folder around its source was admitted').toContain('the source lies inside it: the copy would be made from a folder it is written in');
		const pi = made('pi');
		writeFileSync(join(pi, 'AGENTS.md'), '# read by Pi\n');
		expect(some(problemsOf(made('pi', 'm')), `${join(pi, 'AGENTS.md')} is on the path Pi reads its context from`), 'a folder below a file Pi reads was admitted').toBe(true);
		expect(measurementFolderProblems('relative/m', source, host, false).length, 'a relative folder was admitted').toBeGreaterThan(0);

		expect(problemsOf(made('good')), '⭑ CONTROL: an empty folder outside every tree, run folder and source is refused').toEqual([]);
	});

	it('⛔ RED FIRST — begun once, its record written; a folder named as an earlier one admitted only where it is a measurement folder begun, and never this one', () => {
		const root = fresh('begin');
		const host = sandboxHost(root);
		const earlier = join(root, 'earlier');
		mkdirSync(earlier);
		expect(beginMeasurementFolder(earlier, { begunAt: 'then', checkoutHead: 'x', source: join(root, 'src'), unitId: 'u', earlierFolders: [] }, host)).toEqual({ begun: true });
		const folder = join(root, 'm');
		mkdirSync(folder);
		const notBegun = join(root, 'not-begun');
		mkdirSync(notBegun);
		const state = (earlierFolders: readonly string[]) => ({ begunAt: 'now', checkoutHead: 'x', source: join(root, 'src'), unitId: 'u', earlierFolders });
		const refused = beginMeasurementFolder(folder, state([notBegun, folder]), host);
		expect('refusedBecause' in refused ? refused.refusedBecause : '', 'a folder that is no measurement folder, or this one, was named as an earlier one').toBe(
			`the measurement folder is refused:\n  · the earlier measurement folder named, ${notBegun}, holds no d84.json: it is not a measurement folder begun\n  · the earlier measurement folder named, ${folder}, is this one`
		);
		expect(existsSync(join(folder, D84_LAYOUT.state)), 'a refused folder was begun').toBe(false);
		expect(beginMeasurementFolder(folder, state([earlier]), host), '⭑ CONTROL: a folder naming a begun one as earlier was refused').toEqual({ begun: true });
		expect(readJson(join(folder, D84_LAYOUT.state))).toEqual(state([earlier]));
		const again = beginMeasurementFolder(folder, state([]), host);
		expect('refusedBecause' in again ? again.refusedBecause : 'it was not refused', 'a folder was begun twice').toContain('it is not empty (1 name(s) in it)');
	});
});

describe('⭐⭐ D84 (T3; departure 5) — the case copied from a run’s final archive, in the server’s layout, every file held to its source and to the archive’s record', () => {
	it('⛔ RED FIRST — an archive copies whole: the two stores by their bytes, the workspace (a link kept a link), the process output, the sessions and the purge record, each where the server keeps it, the manifest naming every file with its sha256', async () => {
		const a = await anArchive();
		const folder = begun(a.source, a.unitId);

		const copied = copyFromArchive(folder, a.source, a.unitId);

		if ('refusedBecause' in copied) throw new Error(`the archive was not copied: ${copied.refusedBecause}`);
		const store = copyStoreOf(folder);
		const workspace = workspaceDirectoryOf(store, a.undertakingId);
		expect(readFileSync(store).equals(readFileSync(join(a.source, RECORD_STORE))), 'the record store is not copied by its bytes').toBe(true);
		expect(readFileSync(`${store}.content.sqlite`).equals(readFileSync(join(a.source, CONTENT_STORE))), 'the content store is not copied by its bytes').toBe(true);
		expect(treeOf(workspace), 'the workspace is not copied, byte for byte and link for link, where the server keeps it').toEqual(treeOf(join(a.source, 'workspace')));
		expect(lstatSync(join(workspace, 'link')).isSymbolicLink(), 'the link was followed, not kept').toBe(true);
		expect(treeOf(`${workspace}.process-output`), 'the process output is not copied beside the workspace').toEqual(treeOf(join(a.source, 'process-output')));
		expect(treeOf(`${store}.sessions`), 'the sessions are not copied where the server keeps them').toEqual(treeOf(join(a.source, 'sessions')));
		const tombstone = readdirSync(a.source).find((n) => n.endsWith('.jpwb-workspace-tombstones.json'))!;
		expect(readFileSync(join(dirname(workspace), tombstone), 'utf8'), 'the purge record is not copied beside its folder').toBe('[]\n');
		expect(existsSync(join(folder, 'copy.partial')), 'the partial copy was left').toBe(false);
		const manifest = readJson<CopyManifest>(join(folder, D84_LAYOUT.copyManifest));
		expect(manifest, 'the copy’s manifest is not what the copy returned').toEqual(copied.copied);
		const listed = new Map((manifest?.files ?? []).map((f) => [f.path, f] as const));
		const fileCount = Object.keys(treeOf(join(folder, D84_LAYOUT.copy))).length;
		expect(listed.size, 'the manifest does not name every file and link of the copy').toBe(fileCount);
		for (const [path, f] of listed)
			if (f.kind === 'file') expect.soft(f.sha256, `${path}: the manifest’s sha256 is not the copy’s`).toBe(sha256Of(readFileSync(join(folder, ...path.split('/')))));
		expect(copied.copied.checks, 'the copy does not say what it checked').toEqual([
			'each store’s sha256 equals its source’s and the archive’s checks.json',
			'the workspace’s tree sha256 equals the archive’s hashes.treeSha256',
			'each file of the workspace, the process output and the sessions folder equals its source’s'
		]);
		expect(copyFromArchive(folder, a.source, a.unitId), 'a case was copied twice').toEqual({ refusedBecause: 'copy exists already: the case is copied once' });
	});

	it('⛔ RED FIRST — refused, naming why, and never renamed a copy: a store whose bytes are not what the archive recorded, either side; a workspace whose tree is not the archived one; a store copy whose header is not a rollback journal’s; no checks.json; a unit the store does not hold', async () => {
		const flipped = await anArchive();
		const bytes = readFileSync(join(flipped.source, CONTENT_STORE));
		bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 0xff;
		writeFileSync(join(flipped.source, CONTENT_STORE), bytes);
		const one = begun(flipped.source, flipped.unitId);
		const refusedFlipped = copyFromArchive(one, flipped.source, flipped.unitId);
		expect('refusedBecause' in refusedFlipped ? refusedFlipped.refusedBecause : 'it was not refused', 'a store whose bytes moved after its archive was copied').toMatch(
			/^the source's demo\.sqlite\.content\.sqlite has sha256 [0-9a-f]{64}, and the archive's checks\.json records [0-9a-f]{64}: the source is not what was archived$/
		);
		expect([existsSync(join(one, 'copy')), existsSync(join(one, 'copy.partial'))], 'a refused copy was renamed, or not left for a person').toEqual([false, true]);
		expect(copyFromArchive(one, flipped.source, flipped.unitId), 'a copy was made over a partial one').toEqual({
			refusedBecause: 'copy.partial exists: an earlier copy failed part-way, and is left for a person to read and remove'
		});

		const recorded = await anArchive();
		checksRewritten(recorded.source, (checks) => {
			const stores = (checks.archived as { stores: { sha256: string }[] }).stores;
			stores[0]!.sha256 = '0'.repeat(64);
		});
		const two = copyFromArchive(begun(recorded.source, recorded.unitId), recorded.source, recorded.unitId);
		expect('refusedBecause' in two ? two.refusedBecause : 'it was not refused', 'a store whose archived sha256 is another was copied').toMatch(
			new RegExp(`^the source's demo\\.sqlite has sha256 [0-9a-f]{64}, and the archive's checks\\.json records ${'0'.repeat(64)}`)
		);

		const tree = await anArchive();
		writeFileSync(join(tree.source, 'workspace', 'src', 'reader.ts'), 'export const read = () => "moved";\r\n');
		const three = copyFromArchive(begun(tree.source, tree.unitId), tree.source, tree.unitId);
		expect('refusedBecause' in three ? three.refusedBecause : 'it was not refused', 'a workspace whose tree moved after its archive was copied').toMatch(
			/^the workspace's copy has tree sha256 [0-9a-f]{64}, and the archive records [0-9a-f]{64}$/
		);

		const wal = await anArchive({ walStore: true });
		const four = copyFromArchive(begun(wal.source, wal.unitId), wal.source, wal.unitId);
		expect('refusedBecause' in four ? four.refusedBecause : 'it was not refused', 'a store copy a read-only open would write beside was copied').toMatch(
			/^the copy of demo\.sqlite is not a store a read-only open leaves alone: its header declares journal 2\/2, not a rollback journal \(1\/1\)/
		);

		const none = fresh('no-archive');
		expect(copyFromArchive(begun(none, 'pwu_x'), none, 'pwu_x'), 'a folder with no checks.json was copied').toEqual({
			refusedBecause: 'the source holds no checks.json: it is not one of the run archive’s folders'
		});
		const other = await anArchive();
		expect(copyFromArchive(begun(other.source, 'pwu_00000000000000000000000000'), other.source, 'pwu_00000000000000000000000000'), 'a unit the store does not hold was copied').toEqual({
			refusedBecause: 'the copied record store holds no work unit "pwu_00000000000000000000000000"'
		});
	});
});

describe('⭐⭐ D84 (departure 4) — the copy opened as the server opens its store: its events counted by a read-only open before and after, an open that writes refused', () => {
	it('⛔ RED FIRST — the read-only reading: the schema version, the events and the outbox still pending, each as the product’s own open leaves them; the product’s open, again, moves none (its outbox stays pending: no subscriber is registered); an open that moved any is refused, naming each', () => {
		const root = fresh('reading');
		const store = join(root, 'demo.sqlite');
		copyFileSync(templateStore().store, store);
		const engine = openWorkbench(store);
		const events = engine.readAllEvents().length;
		engine.close();
		const db = new DatabaseSync(store, { readOnly: true });
		const pending = Number((db.prepare("SELECT COUNT(*) AS n FROM outbox_messages WHERE status = 'PENDING'").get() as { n: number }).n);
		db.close();
		const reading = storeReading(store);
		expect([reading.events, reading.pendingOutbox], 'the read-only reading does not count the events, and the outbox still pending').toEqual([events, pending]);
		expect(reading.userVersion, 'the schema version is not read').toBeGreaterThan(0);
		expect(pending, 'arrangement: the product’s open left its outbox pending, as it does with no subscriber').toBeGreaterThan(0);
		const reopened = openWorkbench(store);
		reopened.close();
		expect(afterOpenRefusal(reading, storeReading(store)), '⭑ CONTROL: the product’s own open of the store moved what the reading counts').toBeUndefined();
		expect(
			afterOpenRefusal({ userVersion: 2, events: 5, pendingOutbox: 9 }, { userVersion: 3, events: 6, pendingOutbox: 0 }),
			'an open that moved the events, the schema version and the outbox was not refused, naming each'
		).toBe(
			"the server's open of the copy moved its events from 5 to 6 and its schema version from 2 to 3 and its outbox still pending from 9 to 0: an open that writes is refused, and the copy is spoiled (D84; the lead's departure 4)"
		);
		for (const moved of [{ events: 6 }, { userVersion: 3 }, { pendingOutbox: 8 }])
			expect(afterOpenRefusal({ userVersion: 2, events: 5, pendingOutbox: 9 }, { userVersion: 2, events: 5, pendingOutbox: 9, ...moved }), `an open that moved ${Object.keys(moved)[0]} alone was not refused`).toMatch(
				/^the server's open of the copy moved its /
			);
	});

	it('⛔ RED FIRST — the server’s store named exactly: refused where the process is not serving, or JPWB_DEMO_DB names another store', () => {
		const folder = fresh('server');
		expect(serverStoreRefusal(folder, { JPWB_DEMO_DB: copyStoreOf(folder) }), 'a process not serving the copy was taken for its server').toBe(
			'the driver opens the copy as the server opens its store, and RPH_DEMO_MODE is not "server"'
		);
		expect(serverStoreRefusal(folder, { RPH_DEMO_MODE: 'test', JPWB_DEMO_DB: copyStoreOf(folder) }), 'a process in test mode was taken for the copy’s server').toBe(
			'the driver opens the copy as the server opens its store, and RPH_DEMO_MODE is not "server"'
		);
		expect(serverStoreRefusal(folder, { RPH_DEMO_MODE: 'server', JPWB_DEMO_DB: join(folder, 'demo.sqlite') }), 'another store was taken for the copy’s').toBe(
			`JPWB_DEMO_DB names ${JSON.stringify(join(folder, 'demo.sqlite'))}, and the copy's record store is ${resolve(copyStoreOf(folder))}`
		);
		expect(serverStoreRefusal(folder, { RPH_DEMO_MODE: 'server', JPWB_DEMO_DB: copyStoreOf(folder) }), '⭑ CONTROL: the copy’s own store refused').toBeUndefined();
	});
});

describe('⭐⭐ D84 — the launcher’s steps over a real copy: begun, copied, then opened as the server opens it', () => {
	/** A step host whose deps are `deps`, counting each time they are asked for. */
	function hostWith(root: string, deps: () => AssuranceStageDeps): StepHost & { readonly asked: () => number } {
		let asked = 0;
		return {
			deps: () => {
				asked += 1;
				return deps();
			},
			transports: {
				devinExec: async () => {
					throw new Error('arrangement: no program here');
				},
				openPi: async () => {
					throw new Error('arrangement: no program here');
				},
				devinVersion: async () => 'devin 3000.11.234'
			},
			probeExec: async () => {
				throw new Error('arrangement: no program here');
			},
			childrenOf: async () => [],
			folderHost: sandboxHost(root),
			now: () => '2026-11-21T12:00:00.000Z',
			checkoutHead: () => 'fixture',
			asked: () => asked
		};
	}

	it('⛔ RED FIRST — begin, then copy; the case step refused before the open where the copy is not made or not served as the server serves it; after it where the open delivered the outbox or wrote an event; ⭑ CONTROL: a real open of the copy, as the server opens its store, moves nothing, and the unit is said before its case is checked', async () => {
		const a = await anArchive();
		const root = fresh('steps');
		mkdirSync(join(root, 'm'));
		const folder = join(root, 'm');
		const engines: { close(): void }[] = [];
		const open = () => {
			const engine = openWorkbench(copyStoreOf(folder));
			engines.push(engine);
			return { engine } as unknown as AssuranceStageDeps;
		};
		const host = hostWith(root, open);
		const env = (step: string, more: Readonly<Record<string, string>> = {}) => ({ JPWB_D84_FOLDER: folder, JPWB_D84_STEP: step, ...more });
		// ⭑ A step settled before it is expected: one that throws is an outcome saying so, so each check is reached and names what it found.
		const step = (e: Readonly<Record<string, string>>, h: StepHost) =>
			runD84Step(e, h).catch((thrown: unknown) => ({ ok: false, said: [`the step threw: ${thrown instanceof Error ? thrown.message : String(thrown)}`] }));
		const server = { RPH_DEMO_MODE: 'server', JPWB_DEMO_DB: copyStoreOf(folder) };
		try {
			expect(await step(env('copy'), host), 'a folder not begun was copied into').toEqual({
				ok: false,
				said: ['the measurement folder is not begun (d84.json): run the begin step first']
			});
			expect((await step(env('begin', { JPWB_D84_SOURCE: a.source, JPWB_D84_UNIT: a.unitId }), host)).ok, 'the folder is not begun').toBe(true);
			expect(await step(env('case', server), host), 'the case was opened before its copy').toEqual({
				ok: false,
				said: ['the case is not copied (copy-manifest.json): run the copy step first']
			});
			const copied = await step(env('copy'), host);
			expect(copied.ok, `the case is not copied: ${copied.said.join('\n')}`).toBe(true);
			expect(await step(env('case'), host), 'the copy was opened by a process not serving it').toEqual({
				ok: false,
				said: ['the driver opens the copy as the server opens its store, and RPH_DEMO_MODE is not "server"']
			});
			expect(host.asked(), 'the deps were asked for before the open was checked').toBe(0);

			// ⭑ Deps whose open delivers the outbox and marks it, as an open with a subscriber would: refused after it, naming what moved.
			const delivering = hostWith(root, () => {
				const db = new DatabaseSync(copyStoreOf(folder));
				db.exec("UPDATE outbox_messages SET status = 'PUBLISHED' WHERE rowid = (SELECT MIN(rowid) FROM outbox_messages WHERE status = 'PENDING')");
				db.close();
				return { engine: { readAllEvents: () => [] } } as unknown as AssuranceStageDeps;
			});
			const pending = storeReading(copyStoreOf(folder)).pendingOutbox;
			const delivered = await step(env('case', server), delivering);
			expect([delivered.ok, delivered.said[0]], 'an open that marked the outbox was not refused').toEqual([
				false,
				`the server's open of the copy moved its outbox still pending from ${pending} to ${pending - 1}: an open that writes is refused, and the copy is spoiled (D84; the lead's departure 4)`
			]);
			const undo = new DatabaseSync(copyStoreOf(folder));
			undo.exec("UPDATE outbox_messages SET status = 'PENDING' WHERE status = 'PUBLISHED'");
			undo.close();
			expect(pending, 'arrangement: the copy’s outbox is pending, as the archived store left it').toBeGreaterThan(0);

			// ⭑ Deps whose open writes an event: refused after it, naming what moved.
			const writing = hostWith(root, () => {
				const db = new DatabaseSync(copyStoreOf(folder));
				db.exec(
					"INSERT INTO domain_events (event_id, event_type, aggregate_type, aggregate_id, aggregate_revision, correlation_id, occurred_at, recorded_at, payload) VALUES ('evt_d84', 'Written', 'X', 'x', 1, 'c', 'now', 'now', '{}')"
				);
				db.close();
				return { engine: { readAllEvents: () => [] } } as unknown as AssuranceStageDeps;
			});
			const before = storeReading(copyStoreOf(folder)).events;
			const moved = await step(env('case', server), writing);
			expect([moved.ok, moved.said[0]], 'an open that wrote was not refused').toEqual([
				false,
				`the server's open of the copy moved its events from ${before} to ${before + 1}: an open that writes is refused, and the copy is spoiled (D84; the lead's departure 4)`
			]);
			const db = new DatabaseSync(copyStoreOf(folder));
			db.exec("DELETE FROM domain_events WHERE event_id = 'evt_d84'");
			db.close();
			expect(existsSync(join(folder, D84_LAYOUT.case)), 'a refused open wrote the case').toBe(false);

			// ⭑ CONTROL — the product's own open of the copy, as the server opens its store: nothing written; the unit said, then its case checked.
			const checked = await step(env('case', server), host);
			expect(host.asked(), '⭑ CONTROL: the copy was not opened').toBe(1);
			expect(checked.said[0], '⭑ CONTROL: the unit is not said, by its id, before its case is checked').toMatch(new RegExp(`^the unit named: ${a.unitId}, ".*", of kind `));
			expect(checked.ok, '⭑ CONTROL: a reference unit, never rejected, is admitted as the ninth run’s case').toBe(false);
			expect(storeReading(copyStoreOf(folder)).events, '⭑ CONTROL: the server’s open of the copy wrote an event').toBe(before);
			expect(readJson<{ found?: unknown }>(join(folder, D84_LAYOUT.case))?.found, '⭑ CONTROL: the case’s findings are not written').toBeDefined();
			expect(await step(env('case', server), host), 'the case was checked twice').toEqual({ ok: false, said: ['the case is checked already (case.json): it is checked once'] });
		} finally {
			for (const e of engines) e.close();
		}
	});
});
