// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`; the lead's rulings r1 on `d84/d84-facts.md` §3) — THE MEASUREMENT FOLDER
// AND THE CASE'S COPY: where D84 may keep its records, and the copy of the ninth run's final records it measures on, made from the source the operator
// names and checked file by file by sha256.
//
// ⭑ THE FOLDER (§3.3 (c); the lead's departure 6, accepted): the live lane's own run-folder rules, whole (`runFolderProblems`) — absolute, existing, a
// folder, outside every git working tree and the temporary folder, holding no store, no file Pi reads on its path — and D84's own: empty when it is
// begun; neither it nor any folder above it a run folder (holding `demo.sqlite*` or a `lane` folder); and neither the source nor inside or above it.
// D84's own asked of each path where it is written and where its links resolve (the lead's rulings r2, `D84R-A04`): the host's `realpath`, as the run
// folder's own rules resolve it, so a junction cannot carry the folder into the source, the source into it, or it into a run folder.
// ⭑ THE COPY (§3.3 (b); departure 5, accepted): from the run's final archive (`<RUN>-final/lane/archive/06-final`), in the server's own layout, so
// the stage's deps resolve as the server's do — the record store and the content store, each copied by its bytes and its sha256 held to the source's
// and to the archive's own record of it (`checks.json`); the Undertaking's workspace and its process output, each copied as the archive copies a
// folder (`copyTreeExact`, links kept as links) and held file by file, the workspace's tree to the archive's `hashes.treeSha256`; each purge record
// beside its folder; and the sessions folder where the archive holds one. Made as `copy.partial` and renamed `copy` only when every check holds.
// ⭑ THE OPEN (departure 4, accepted): the copy's events, its schema version and its outbox still pending counted by a read-only open first, and again
// after the server's open; any that moved is refused, naming it. ⚠ The open writes the store's header as the server's does, to its write-ahead journal
// (`packages/rph-persistence/src/sql-driver.ts`, `journal_mode = WAL`): that is how the server opens its store, and no record moves with it.
// ⛔ NO AGENT OPENS A RUN FOLDER: the operator names the source, and the tests copy archives they build.
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { nodeRunFolderHost, runFolderProblems, type RunFolderHost } from '../../../../e2e-live-exec/run-folder.js';
import {
	archivedCopyProblem,
	copyTreeExact,
	processOutputDirectoryOf,
	sessionsFolderOf,
	workspaceDirectoryOf
} from '../../../../../../scripts/phase7/run-archive.js';
import { workspaceTreeSha256 } from '../../../../../../scripts/phase7/node-tests.js';
import { D84_LAYOUT, copyStoreOf, readJson, sha256Of, treeEntries, writeOnce, type ManifestEntry } from './d84-files.js';

const RECORD_STORE = 'demo.sqlite';
const CONTENT_STORE = 'demo.sqlite.content.sqlite';

/** What the measurement folder's rules read of the host: the run folder's host, and how to list a folder's names. */
export type MeasurementHost = RunFolderHost;

/** The host as it is (`nodeRunFolderHost`). */
export const nodeMeasurementHost = (): MeasurementHost => nodeRunFolderHost();

/** Does `child` lie inside `parent`, or name it? Folded on Windows, as the run folder's own rule folds. */
function within(child: string, parent: string, platform: NodeJS.Platform): boolean {
	const fold = (p: string) => (platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));
	const inner = fold(child);
	const outer = fold(parent);
	return inner === outer || inner.startsWith(outer.endsWith(sep) ? outer : `${outer}${sep}`);
}

/** The folders from `start` up to its root, `start` first. */
function upFrom(start: string): string[] {
	const out: string[] = [];
	for (let at = resolve(start); ; at = dirname(at)) {
		out.push(at);
		if (dirname(at) === at) return out;
	}
}

/** Do two paths name one folder? Folded on Windows, as `within` folds. */
const same = (a: string, b: string, platform: NodeJS.Platform): boolean => within(a, b, platform) && within(b, a, platform);

/**
 * ⭐ r2 (`D84R-A04`) — A PATH AS D84'S RULES ASK IT: where it is written, and where its links resolve (the host's `realpath`, which gives the path itself,
 * resolved, where it cannot resolve it), each once — the written path first.
 */
function pathsOf(path: string, host: MeasurementHost): string[] {
	const written = resolve(path);
	const physical = host.realpath(path);
	return same(written, physical, host.platform) ? [written] : [written, physical];
}

/**
 * ⭐⭐ D84 — EVERY REASON `folder` CANNOT BE D84'S MEASUREMENT FOLDER FOR `source`, one line each; none where it can. The run folder's rules first, then
 * D84's own. `begun` false asks it of a folder about to be begun, which must be empty.
 */
export function measurementFolderProblems(folder: string, source: string, host: MeasurementHost, begun: boolean): string[] {
	const problems = runFolderProblems(folder, host);
	if (folder.trim() === '' || problems.some((p) => p.startsWith('it is not absolute'))) return problems;
	// ⭑ The begin step's own lock (r2, `D84R-A01` (b)), taken before its record is written, is no name of the folder's.
	const names = (host.list(folder) ?? []).filter((n) => n !== D84_LAYOUT.lock);
	if (!begun && names.length > 0) problems.push(`it is not empty (${names.length} name(s) in it): a measurement folder is begun empty, and written once`);
	// ⭐ r2 (`D84R-A04`) — each folder at or above it, where it is written and where its links resolve, asked once.
	const folders = pathsOf(folder, host);
	const asked = new Set<string>();
	for (const at of folders.flatMap(upFrom)) {
		const key = host.platform === 'win32' ? at.toLowerCase() : at;
		if (asked.has(key)) continue;
		asked.add(key);
		const here = host.list(at) ?? [];
		const marks = here.filter((n) => n.toLowerCase().startsWith(RECORD_STORE) || n.toLowerCase() === 'lane');
		if (marks.length > 0)
			problems.push(
				`${folders.some((f) => same(f, at, host.platform)) ? 'it' : `${at}, a folder above it,`} holds ${marks.join(', ')}: a run folder's marks, and no measurement is kept in a run folder`
			);
	}
	if (source.trim() !== '') {
		// ⭐ r2 (`D84R-A04`) — the source's containment both ways, each of its paths against each of the folder's.
		const sources = pathsOf(source, host);
		if (folders.some((f) => sources.some((from) => within(f, from, host.platform))))
			problems.push('it lies inside the source it is to copy, or is it: the source is read and never written');
		if (sources.some((from) => folders.some((f) => within(from, f, host.platform))))
			problems.push('the source lies inside it: the copy would be made from a folder it is written in');
	}
	return problems;
}

/**
 * ⭐ D84 — the measurement folder's own record (`d84.json`): when it was begun, from which checkout, the source as named, the unit, and the earlier
 * measurement folders of this case whose calls are already spent (the lead's rulings r1, Q10: a fresh copy starts again from the writer, and the
 * report names the calls already spent).
 */
export interface MeasurementState {
	readonly begunAt: string;
	readonly checkoutHead: string;
	readonly source: string;
	readonly unitId: string;
	readonly earlierFolders: readonly string[];
}

/**
 * ⭐ D84 — WHY THE MEASUREMENT FOLDER CANNOT BE BEGUN FOR `state`: any rule refuses it, or a folder named as an earlier one is this one or is not a
 * measurement folder begun (it holds no `d84.json`). `undefined` where it can. ⭑ It writes nothing: the begin step asks it before it takes the folder's
 * lock (r2, `D84R-A01` (b)), so nothing is written in a folder refused.
 */
export function beginRefusal(folder: string, state: MeasurementState, host: MeasurementHost = nodeMeasurementHost()): string | undefined {
	const problems = measurementFolderProblems(folder, state.source, host, false);
	for (const earlier of state.earlierFolders) {
		if (within(earlier, folder, host.platform) && within(folder, earlier, host.platform)) problems.push(`the earlier measurement folder named, ${earlier}, is this one`);
		else if (readJson<MeasurementState>(join(earlier, D84_LAYOUT.state)) === undefined)
			problems.push(`the earlier measurement folder named, ${earlier}, holds no ${D84_LAYOUT.state}: it is not a measurement folder begun`);
	}
	return problems.length > 0 ? `the measurement folder is refused:\n${problems.map((p) => `  · ${p}`).join('\n')}` : undefined;
}

/**
 * ⭐ D84 — BEGIN THE MEASUREMENT FOLDER: refused where it cannot be begun (`beginRefusal`); else its record written, once.
 */
export function beginMeasurementFolder(
	folder: string,
	state: MeasurementState,
	host: MeasurementHost = nodeMeasurementHost()
): { readonly begun: true } | { readonly refusedBecause: string } {
	const refusal = beginRefusal(folder, state, host);
	if (refusal !== undefined) return { refusedBecause: refusal };
	writeOnce(join(folder, D84_LAYOUT.state), state);
	return { begun: true };
}

/** One file of the copy, as its manifest names it: where it came from in the source, where it is in the folder, and its bytes. */
export interface CopiedFile extends ManifestEntry {
	readonly from: string;
}

/** ⭐ D84 — the copy's manifest (`copy-manifest.json`). */
export interface CopyManifest {
	readonly source: string;
	readonly unitId: string;
	readonly undertakingId: string;
	readonly files: readonly CopiedFile[];
	readonly checks: readonly string[];
}

/** The archive's own record of what it holds (`checks.json`), the parts D84 reads. */
interface ArchiveChecks {
	readonly hashes?: { readonly treeSha256?: string | null };
	readonly archived?: {
		readonly stores?: readonly { readonly name?: string; readonly present?: boolean; readonly sha256?: string; readonly bytes?: number }[];
		readonly workspace?: { readonly present?: boolean };
		readonly processOutput?: { readonly present?: boolean };
		readonly tombstones?: readonly string[];
		readonly sessions?: { readonly present?: boolean };
	};
}

/** The unit's row in a store, read with a read-only open: its object type and its state; `undefined` where the store holds no such object. */
function unitRowOf(store: string, unitId: string): { readonly objectType: string; readonly state: Record<string, unknown> } | undefined {
	const db = new DatabaseSync(store, { readOnly: true });
	try {
		const row = db.prepare('SELECT object_type, state FROM professional_work_objects WHERE id = ?').get(unitId) as
			| { object_type?: unknown; state?: unknown }
			| undefined;
		if (row === undefined) return undefined;
		return { objectType: String(row.object_type ?? ''), state: JSON.parse(String(row.state ?? '{}')) as Record<string, unknown> };
	} finally {
		db.close();
	}
}

/** Each entry of a copied tree, held to the source's: the differences named; none where every file and link is the same. */
function treeDifferences(from: string, to: string): string[] {
	const a = new Map(treeEntries(from).map((e) => [e.path, e] as const));
	const b = new Map(treeEntries(to).map((e) => [e.path, e] as const));
	const out: string[] = [];
	for (const path of [...new Set([...a.keys(), ...b.keys()])].sort()) {
		const x = a.get(path);
		const y = b.get(path);
		if (x === undefined) out.push(`${path} is in the copy and not in the source`);
		else if (y === undefined) out.push(`${path} is in the source and not in the copy`);
		else if (x.sha256 !== y.sha256 || x.kind !== y.kind) out.push(`${path}: its sha256 in the copy (${y.sha256}) is not the source's (${x.sha256})`);
	}
	return out;
}

/**
 * ⭐⭐ D84 — COPY THE CASE FROM THE ARCHIVE THE OPERATOR NAMES, AND CHECK IT FILE BY FILE (see the header). ⛔ Refused, naming why, before anything is
 * written where the folder already holds a copy or a partial one, where the source is not an archive D84 can read, where the unit is not in it, and,
 * after the copy, where any file's sha256 differs from its source's or from the archive's own record. A refused copy is left as `copy.partial` for a
 * person, never renamed `copy`.
 */
export function copyFromArchive(
	folder: string,
	source: string,
	unitId: string
): { readonly copied: CopyManifest } | { readonly refusedBecause: string } {
	const target = join(folder, D84_LAYOUT.copy);
	const partial = `${target}.partial`;
	if (existsSync(target)) return { refusedBecause: `${D84_LAYOUT.copy} exists already: the case is copied once` };
	if (existsSync(partial)) return { refusedBecause: `${basename(partial)} exists: an earlier copy failed part-way, and is left for a person to read and remove` };
	const checks = readJson<ArchiveChecks>(join(source, 'checks.json'));
	if (checks === undefined) return { refusedBecause: 'the source holds no checks.json: it is not one of the run archive’s folders' };
	const stores = checks.archived?.stores ?? [];
	const recorded = (name: string) => stores.find((s) => s.name === name && s.present === true);
	for (const name of [RECORD_STORE, CONTENT_STORE])
		if (recorded(name) === undefined || !existsSync(join(source, name)))
			return { refusedBecause: `the source holds no ${name} its checks.json records as present: the case needs both stores` };
	const files: CopiedFile[] = [];
	const done: string[] = [];
	const fromSource = (path: string): string => relative(source, path).split(sep).join('/');
	const inFolder = (path: string): string => relative(folder, path).split(sep).join('/').replace(/^copy\.partial\//, `${D84_LAYOUT.copy}/`);
	mkdirSync(partial, { recursive: false });

	// ── The two stores, by their bytes, each held to its source and to the archive's record.
	for (const name of [RECORD_STORE, CONTENT_STORE]) {
		const from = join(source, name);
		const to = join(partial, name);
		copyFileSync(from, to, constants.COPYFILE_EXCL);
		const before = sha256Of(readFileSync(from));
		const after = sha256Of(readFileSync(to));
		const archived = recorded(name)?.sha256;
		if (before !== archived)
			return { refusedBecause: `the source's ${name} has sha256 ${before}, and the archive's checks.json records ${String(archived)}: the source is not what was archived` };
		if (after !== before) return { refusedBecause: `the copy of ${name} has sha256 ${after}, and its source ${before}` };
		const problem = archivedCopyProblem(to);
		if (problem !== undefined) return { refusedBecause: `the copy of ${name} is not a store a read-only open leaves alone: ${problem}` };
		files.push({ from: fromSource(from), path: inFolder(to), kind: 'file', bytes: statSync(to).size, sha256: after });
	}
	done.push('each store’s sha256 equals its source’s and the archive’s checks.json');

	// ── The unit, read from the copied record store with a read-only open: its Undertaking names the workspace's folder.
	const unit = unitRowOf(join(partial, RECORD_STORE), unitId);
	if (unit === undefined || unit.objectType !== 'PROFESSIONAL_WORK_UNIT')
		return { refusedBecause: `the copied record store holds no work unit ${JSON.stringify(unitId)}${unit === undefined ? '' : ` (it holds a ${unit.objectType})`}` };
	const undertakingId = typeof unit.state.undertakingId === 'string' ? unit.state.undertakingId : '';
	if (undertakingId === '') return { refusedBecause: `the work unit ${unitId} names no Undertaking` };

	// ── The workspace and its process output, as the archive copies a folder, each held file by file; the workspace's tree to the archive's digest.
	const store = join(partial, RECORD_STORE);
	const workspace = workspaceDirectoryOf(store, undertakingId);
	const folders: readonly { readonly from: string; readonly to: string; readonly present: boolean; readonly what: string }[] = [
		{ from: join(source, 'workspace'), to: workspace, present: checks.archived?.workspace?.present === true, what: 'the workspace' },
		{
			from: join(source, 'process-output'),
			to: processOutputDirectoryOf(workspace),
			present: checks.archived?.processOutput?.present === true,
			what: 'the process output'
		},
		{ from: join(source, 'sessions'), to: sessionsFolderOf(store), present: checks.archived?.sessions?.present === true, what: 'the sessions folder' }
	];
	for (const f of folders) {
		if (!f.present) continue;
		if (!existsSync(f.from)) return { refusedBecause: `the archive records ${f.what} as present, and the source holds no ${basename(f.from)}/` };
		mkdirSync(dirname(f.to), { recursive: true });
		const copy = copyTreeExact(f.from, f.to);
		if (copy.skipped.length > 0) return { refusedBecause: `${f.what} holds what is neither a file, a folder nor a link, not copied: ${copy.skipped.join(', ')}` };
		const unmade = copy.links.filter((l) => !l.recreated || l.problem !== undefined);
		if (unmade.length > 0) return { refusedBecause: `${f.what}'s links could not be copied as they are: ${unmade.map((l) => `${l.path} (${l.problem ?? 'not made'})`).join('; ')}` };
		const differ = treeDifferences(f.from, f.to);
		if (differ.length > 0) return { refusedBecause: `${f.what}'s copy differs from its source: ${differ.join('; ')}` };
		for (const e of treeEntries(f.to)) files.push({ ...e, from: `${fromSource(f.from)}/${e.path}`, path: `${inFolder(f.to)}/${e.path}` });
	}
	const archivedTree = checks.hashes?.treeSha256;
	if (checks.archived?.workspace?.present === true && typeof archivedTree === 'string') {
		const tree = workspaceTreeSha256(workspace);
		if (tree !== archivedTree) return { refusedBecause: `the workspace's copy has tree sha256 ${tree}, and the archive records ${archivedTree}` };
		done.push('the workspace’s tree sha256 equals the archive’s hashes.treeSha256');
	}
	done.push('each file of the workspace, the process output and the sessions folder equals its source’s');

	// ── Each purge record, beside the folder it records.
	for (const name of checks.archived?.tombstones ?? []) {
		const from = join(source, name);
		const to = join(dirname(workspace), name);
		if (!existsSync(from)) return { refusedBecause: `the archive records the purge record ${name}, and the source does not hold it` };
		copyFileSync(from, to, constants.COPYFILE_EXCL);
		const before = sha256Of(readFileSync(from));
		const after = sha256Of(readFileSync(to));
		if (before !== after) return { refusedBecause: `the copy of the purge record ${name} has sha256 ${after}, and its source ${before}` };
		files.push({ from: fromSource(from), path: inFolder(to), kind: 'file', bytes: statSync(to).size, sha256: after });
	}

	renameSync(partial, target);
	const manifest: CopyManifest = { source, unitId, undertakingId, files, checks: done };
	writeOnce(join(folder, D84_LAYOUT.copyManifest), manifest);
	return { copied: manifest };
}

/** ⭐ D84 — what a read-only open of the copy's record store reads before the server's open (departure 4). */
export interface StoreReading {
	readonly userVersion: number;
	readonly events: number;
	readonly pendingOutbox: number;
}

/** ⭐ D84 — the copy's record store read with a read-only open: its schema version, its events, and its outbox still pending. */
export function storeReading(store: string): StoreReading {
	const db = new DatabaseSync(store, { readOnly: true });
	try {
		const n = (sql: string): number => Number((db.prepare(sql).get() as { n?: unknown } | undefined)?.n ?? 0);
		return {
			userVersion: Number((db.prepare('PRAGMA user_version').get() as { user_version?: unknown } | undefined)?.user_version ?? 0),
			events: n('SELECT COUNT(*) AS n FROM domain_events'),
			pendingOutbox: n(`SELECT COUNT(*) AS n FROM outbox_messages WHERE status = 'PENDING'`)
		};
	} finally {
		db.close();
	}
}

/**
 * ⭐ D84 (departure 4) — WHY THE OPEN IS REFUSED, read again after it with a read-only open: its events, its schema version, or its outbox still pending
 * moved. ⚠ AN OUTBOX STILL PENDING IS THE STORE'S STANDING STATE, NOT A WRITE TO COME: with no subscriber registered — none is, in production — the
 * open's recovery delivers nothing and marks nothing (`drainOutbox`, `packages/rph-application/src/command-bus.ts`), so every row stays PENDING; a
 * count that moved means something was delivered and marked, which is a write.
 */
export function afterOpenRefusal(before: StoreReading, after: StoreReading): string | undefined {
	const moved: string[] = [];
	if (after.events !== before.events) moved.push(`its events from ${before.events} to ${after.events}`);
	if (after.userVersion !== before.userVersion) moved.push(`its schema version from ${before.userVersion} to ${after.userVersion}`);
	if (after.pendingOutbox !== before.pendingOutbox) moved.push(`its outbox still pending from ${before.pendingOutbox} to ${after.pendingOutbox}`);
	return moved.length === 0
		? undefined
		: `the server's open of the copy moved ${moved.join(' and ')}: an open that writes is refused, and the copy is spoiled (D84; the lead's departure 4)`;
}

/** ⭐ D84 — where the server keeps the copy, as the measurement's own process must be launched: its record store, `<folder>/copy/demo.sqlite`. */
export function serverStoreRefusal(folder: string, env: Readonly<Record<string, string | undefined>>): string | undefined {
	const want = resolve(copyStoreOf(folder));
	if (env.RPH_DEMO_MODE !== 'server') return 'the driver opens the copy as the server opens its store, and RPH_DEMO_MODE is not "server"';
	const named = env.JPWB_DEMO_DB;
	if (named === undefined || resolve(named) !== want) return `JPWB_DEMO_DB names ${JSON.stringify(named ?? '')}, and the copy's record store is ${want}`;
	return undefined;
}
