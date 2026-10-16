// ⭐ `JAN-EXEC` Phase 7, P7-2 D6 and D7 (DESIGN-the-live-end-to-end-run.md §6) — THE RUN'S ARCHIVE AND ITS CHECKS,
// EACH DRIVEN TO ITS RED (`scripts/phase7/run-archive.ts`).
//
// The live spec archives the run after each unit and checks it there (`apps/rph-demo/e2e-live-exec/phase7.live.ts`).
// The spec is paid and never runs in the gate, so this file is where each rule of the archive is driven — on real
// SQLite stores in WAL mode, real folders and links, and dumps built here — and where each restatement of the product is
// held to the product: the workspace's folder to `resolveUndertakingSandbox`, the five parse shortfalls to
// `splitExecutionEnvelope`, the evidence scope to the route's source, and the archive's names to the report that reads
// them (`scripts/phase7/run-report-core.ts`).
// ⛔ NOTHING HERE STARTS A SERVER, A MODEL OR A REVIEWER: every store is made here, in a temporary folder of its own.
import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
	describeWorkProductDerivation,
	splitExecutionEnvelope
} from '../apps/rph-demo/src/lib/server/execution/execution-contract.js';
import { resolveUndertakingSandbox } from '../apps/rph-demo/src/lib/server/execution/workspace-host.js';
import { workspaceTreeSha256 } from '../scripts/phase7/node-tests.js';
import { PHASE7_PHASES, PHASE7_ROOT } from '../scripts/phase7/pwa-content.js';
import {
	archiveName,
	archiveUnit,
	archivedCopyProblem,
	backupStore,
	CONTENT_STORE,
	copyTreeExact,
	EVIDENCE_SCOPE_PREFIX,
	EXECUTION_SHORTFALLS,
	evidenceScopeOf,
	FINAL_ARCHIVE,
	hashesOf,
	journalHeaderOf,
	k4Check,
	k5Check,
	k9Check,
	PHASE7_ARCHIVE_UNITS,
	piAgentDirOf,
	processOutputDirectoryOf,
	readOnlyOpenWritesNothing,
	RECORD_STORE,
	reviewerCalls,
	workspaceDirectoryOf,
	type ArchiveSnapshot,
	type SnapshotRow
} from '../scripts/phase7/run-archive.js';
import {
	EVIDENCE_SCOPE_PREFIX as REPORT_SCOPE_PREFIX,
	FINAL_ARCHIVE as REPORT_FINAL_ARCHIVE,
	PHASE7_UNITS as REPORT_UNITS
} from '../scripts/phase7/run-report-core.js';

const ROOT = mkdtempSync(join(tmpdir(), 'jpwb-p7-archive-'));
const open: DatabaseSync[] = [];
afterAll(() => {
	for (const db of open) if (db.isOpen) db.close();
	rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

/** Every folder above `dir`, to its drive root: what Pi walks (`resource-loader.js`, `loadProjectContextFiles`). */
const foldersAbove = (dir: string): string[] => {
	const out: string[] = [];
	for (let at = dirname(resolve(dir)); ; at = dirname(at)) {
		out.push(at);
		if (dirname(at) === at) return out;
	}
};

let seq = 0;
/** A fresh folder of this file's own. */
const folder = (label: string): string => {
	const dir = join(ROOT, `${label}-${++seq}`);
	mkdirSync(dir, { recursive: true });
	return dir;
};

/**
 * A store as the server's driver keeps it — WAL — with `rows` rows committed to its `-wal` ALONE: automatic checkpoints
 * off, and the connection left OPEN, as the server holds its stores open between units.
 */
function walStore(file: string, rows: number): DatabaseSync {
	const db = new DatabaseSync(file);
	open.push(db);
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA wal_autocheckpoint = 0');
	db.exec('CREATE TABLE t (n INTEGER PRIMARY KEY, body TEXT NOT NULL)');
	const insert = db.prepare('INSERT INTO t (body) VALUES (?)');
	db.exec('BEGIN');
	for (let i = 0; i < rows; i++) insert.run(`row ${i} ${'x'.repeat(200)}`);
	db.exec('COMMIT');
	return db;
}

/** Rows of `t`, read-only — or the error a store without the table gives. */
function rowsIn(file: string): number | string {
	const db = new DatabaseSync(file, { readOnly: true });
	try {
		return (db.prepare('SELECT COUNT(*) AS c FROM t').get() as { c: number }).c;
	} catch (e) {
		return (e as Error).message;
	} finally {
		db.close();
	}
}

/** Each name in `dir` with the SHA-256 of its bytes: what the folder holds, byte for byte. */
const print = (dir: string): Record<string, string> =>
	Object.fromEntries(
		readdirSync(dir)
			.sort()
			.map((name) => [
				name,
				createHash('sha256')
					.update(readFileSync(join(dir, name)))
					.digest('hex')
			])
	);

describe('⭐ D6 — each store is BACKED UP, converted to a rollback journal, and read without a write', () => {
	it('⛔ a store whose rows are in its -wal alone is backed up WHOLE — the copy of its .sqlite holds none of them (REG-F-526)', async () => {
		const dir = folder('wal');
		const source = join(dir, 'demo.sqlite');
		walStore(source, 400);
		// ⭐ THE ARRANGEMENT'S OWN CONTROL: the rows really are in the -wal alone, so a copy of the file misses them.
		const naive = folder('naive');
		copyFileSync(source, join(naive, 'demo.sqlite'));
		expect(rowsIn(join(naive, 'demo.sqlite')), 'arrangement: the rows reached the .sqlite').toBe(
			'no such table: t'
		);
		const out = folder('backup');
		const made = await backupStore(source, join(out, 'demo.sqlite'));
		expect(rowsIn(join(out, 'demo.sqlite')), 'the backup misses rows committed to the -wal').toBe(
			400
		);
		expect(made.pages).toBeGreaterThan(0);
		expect(made.sha256).toBe(
			createHash('sha256')
				.update(readFileSync(join(out, 'demo.sqlite')))
				.digest('hex')
		);
	});

	it('⛔ the copy is converted to a rollback journal — header 1/1, nothing beside it — and a read-only open leaves its folder byte-identical', async () => {
		const dir = folder('convert');
		walStore(join(dir, 'demo.sqlite'), 50);
		const out = folder('converted');
		const made = await backupStore(join(dir, 'demo.sqlite'), join(out, 'demo.sqlite'));
		expect(made.journalMode).toBe('delete');
		// ⭑ READ BY THIS TEST, from the bytes and the folder — never only from what `backupStore` says of itself.
		expect(journalHeaderOf(join(out, 'demo.sqlite'))).toEqual([1, 1]);
		expect(readdirSync(out), 'a journal lies beside the converted copy').toEqual(['demo.sqlite']);
		const before = print(out);
		expect(rowsIn(join(out, 'demo.sqlite'))).toBe(50);
		expect(print(out), 'a read-only open of the archived copy wrote into its folder').toEqual(
			before
		);
	});

	it('⛔ CONTROL — an UNconverted copy keeps the WAL header, and a read-only open of it writes a -shm and a -wal beside it', async () => {
		const dir = folder('unconverted');
		const db = walStore(join(dir, 'demo.sqlite'), 20);
		const out = folder('raw-backup');
		// The backup itself, without the conversion: node's own, as `backupStore` calls it.
		await backup(db, join(out, 'demo.sqlite'), { rate: -1 });
		expect(journalHeaderOf(join(out, 'demo.sqlite'))).toEqual([2, 2]);
		expect(archivedCopyProblem(join(out, 'demo.sqlite'))).toBe(
			'its header declares journal 2/2, not a rollback journal (1/1), so a read-only open could write beside it'
		);
		expect(readOnlyOpenWritesNothing(join(out, 'demo.sqlite')), 'the control could not fail').toBe(
			false
		);
		expect(readdirSync(out).sort()).toEqual(['demo.sqlite', 'demo.sqlite-shm', 'demo.sqlite-wal']);
		// ⭑ And a converted copy with a journal left beside it is refused, naming it.
		const converted = folder('beside');
		await backupStore(join(dir, 'demo.sqlite'), join(converted, 'demo.sqlite'));
		writeFileSync(join(converted, 'demo.sqlite-journal'), '');
		expect(archivedCopyProblem(join(converted, 'demo.sqlite'))).toBe(
			'demo.sqlite-journal lie beside it'
		);
	});

	it('⛔ an archived store is written once: a destination that exists is refused, and left as it was', async () => {
		const dir = folder('once');
		walStore(join(dir, 'demo.sqlite'), 5);
		const out = folder('taken');
		writeFileSync(join(out, 'demo.sqlite'), 'an earlier archive');
		await expect(backupStore(join(dir, 'demo.sqlite'), join(out, 'demo.sqlite'))).rejects.toThrow(
			'refused: demo.sqlite already exists, and an archived store is written once'
		);
		expect(readFileSync(join(out, 'demo.sqlite'), 'utf8')).toBe('an earlier archive');
	});
});

describe('⭐ D6 — the workspace and its process output are copied BYTE FOR BYTE, links kept as links', () => {
	it('⛔ each byte as it is — CRLF, a byte no UTF-8 reads, an empty file — each folder, and a link with its target’s text, so the copy’s tree digest is the original’s', () => {
		const src = folder('tree');
		mkdirSync(join(src, 'sub', 'deeper'), { recursive: true });
		mkdirSync(join(src, 'linked'));
		writeFileSync(join(src, 'a.txt'), Buffer.from([0x66, 0x0d, 0x0a, 0xff, 0xfe, 0x00, 0x0a]));
		writeFileSync(join(src, 'sub', 'deeper', 'b.js'), 'export const b = 1;\r\n');
		writeFileSync(join(src, 'empty.txt'), '');
		writeFileSync(join(src, 'linked', 'inside.txt'), 'inside');
		// ⚠ A junction: Windows makes one with no privilege; elsewhere `symlinkSync` ignores the type.
		symlinkSync(join(src, 'linked'), join(src, 'link'), 'junction');
		const dest = join(folder('tree-copy'), 'workspace');
		const made = copyTreeExact(src, dest);
		expect(readFileSync(join(dest, 'a.txt'))).toEqual(readFileSync(join(src, 'a.txt')));
		expect(readFileSync(join(dest, 'sub', 'deeper', 'b.js'))).toEqual(
			readFileSync(join(src, 'sub', 'deeper', 'b.js'))
		);
		expect(readFileSync(join(dest, 'empty.txt')).length).toBe(0);
		expect(lstatSync(join(dest, 'link')).isSymbolicLink(), 'the link was followed, not kept').toBe(
			true
		);
		expect(readlinkSync(join(dest, 'link'))).toBe(readlinkSync(join(src, 'link')));
		expect(made.links).toEqual([
			{ path: 'link', target: readlinkSync(join(src, 'link')), recreated: true }
		]);
		expect(workspaceTreeSha256(dest)).toBe(workspaceTreeSha256(src));
		expect([made.files, made.folders, made.skipped]).toEqual([4, 3, []]);
	});

	it('⛔ an archive’s folder is written once: a destination that exists is refused', () => {
		const src = folder('once-tree');
		writeFileSync(join(src, 'x.txt'), 'x');
		const dest = folder('once-taken');
		expect(() => copyTreeExact(src, dest)).toThrow(
			`refused: ${basename(dest)} already exists, and an archive is written once`
		);
	});

	it('⭐ the workspace and its process output are where the PRODUCT makes them (`resolveUndertakingSandbox`)', () => {
		const run = folder('run');
		const store = join(run, 'demo.sqlite');
		const id = 'und_01JPHASE7ARCHIVE';
		const sandbox = resolveUndertakingSandbox(id, `${store}.workspaces`);
		const made = (w: unknown) => (w as { directoryPath?: string }).directoryPath;
		expect(workspaceDirectoryOf(store, id)).toBe(made(sandbox.workspace));
		expect(processOutputDirectoryOf(workspaceDirectoryOf(store, id))).toBe(
			made(sandbox.outputWorkspace)
		);
	});
});

// ── THE RECORD, AS A DUMP BUILT HERE ────────────────────────────────────────────────────────────────────────────────

const row = (id: string, state: Record<string, unknown>): SnapshotRow => ({ id, state });
const snapshotOf = (s: Partial<ArchiveSnapshot>): ArchiveSnapshot => ({
	modelExchanges: s.modelExchanges ?? [],
	evidence: s.evidence ?? [],
	artifacts: s.artifacts ?? []
});
/** Evidence of `unit`, its output kept in `folder` — or not kept, when `folder` is null. */
const evidenceRow = (id: string, unit: string, folder: string | null): SnapshotRow =>
	row(id, {
		scope: evidenceScopeOf(unit),
		contentReference: {
			capture:
				folder === null
					? { retained: false, notRetainedBecause: 'the workspace refused the write' }
					: { retained: true, stdoutPath: `captures/${folder}/stdout.txt` }
		}
	});
const capture = (name: string, files = ['omissions.json', 'stderr.txt', 'stdout.txt']) => ({
	name,
	files
});

describe('⭐ D7, K5 — the capture folders a unit added, against its evidence (REG-F-517)', () => {
	it('⛔ evidence is the unit’s by EQUAL scope: a unit whose id begins another’s takes none of the other’s', () => {
		const snap = snapshotOf({
			evidence: [evidenceRow('evd_a', 'pwu_1', 'f1'), evidenceRow('evd_b', 'pwu_10', 'f10')]
		});
		const k5 = k5Check({
			before: [],
			after: [capture('f1')],
			snapshot: snap,
			unitId: 'pwu_1',
			refusal: null,
			reviewedRunLimit: 32
		});
		expect([k5.evidence, k5.paired, k5.foldersWithoutEvidence, k5.evidenceWithoutFolder]).toEqual([
			1,
			1,
			[],
			[]
		]);
	});

	it('⛔ a folder past the 32nd run names every cause, and the record leaves possible only those it allows', () => {
		const folders = Array.from({ length: 33 }, (_, i) => `run-${String(i).padStart(2, '0')}`);
		const k5 = k5Check({
			before: ['earlier'],
			after: [capture('earlier'), ...folders.map((f) => capture(f))],
			snapshot: snapshotOf({
				evidence: folders.slice(0, 32).map((f, i) => evidenceRow(`evd_${i}`, 'pwu_7', f))
			}),
			unitId: 'pwu_7',
			refusal: null,
			reviewedRunLimit: 32
		});
		expect(k5.added).toHaveLength(33);
		expect(k5.foldersWithoutEvidence.map((f) => f.folder)).toEqual(['run-32']);
		expect(k5.causes.map((c) => [c.cause, c.possible])).toEqual([
			['a run after the first 32, which the product keeps as no evidence (REG-F-517)', true],
			[
				'the step stopped before its evidence join: a try that did not run, a work product that could not be recorded, or a sandbox or executor that refused to open',
				false
			],
			[
				'the evidence join refused part-way, and the runs after the one it could not record got none',
				false
			],
			[
				'a folder a command wrote itself: a command runs as the server’s user, unconfined (REG-F-521), and can reach this folder',
				true
			]
		]);
	});

	it('⛔ a unit with folders and no evidence leaves only a stop before the join possible — and a join refused part-way says so', () => {
		const stopped = k5Check({
			before: [],
			after: [capture('a'), capture('b')],
			snapshot: snapshotOf({}),
			unitId: 'pwu_2',
			refusal: 'The model invocation did not run: the model call failed',
			reviewedRunLimit: 32
		});
		expect(stopped.causes.map((c) => c.possible)).toEqual([false, true, false, true]);
		const partWay = k5Check({
			before: [],
			after: [capture('a'), capture('b')],
			snapshot: snapshotOf({ evidence: [evidenceRow('evd_1', 'pwu_3', 'a')] }),
			unitId: 'pwu_3',
			refusal:
				'The model ran 2 command(s) and one could not be recorded as evidence: the content plane refused',
			reviewedRunLimit: 32
		});
		expect(partWay.causes.map((c) => c.possible)).toEqual([false, false, true, true]);
		expect(partWay.causes[2]!.why).toBe(
			'the unit’s refusal says a run could not be recorded as evidence'
		);
	});

	it('⭐ evidence whose output was not retained is listed, never paired; a folder the runner did not shape is flagged; none removed', () => {
		const k5 = k5Check({
			before: ['old'],
			after: [capture('old'), capture('odd', ['notes.md', 'stdout.txt'])],
			snapshot: snapshotOf({ evidence: [evidenceRow('evd_n', 'pwu_4', null)] }),
			unitId: 'pwu_4',
			refusal: null,
			reviewedRunLimit: 32
		});
		expect(k5.evidenceNotRetained).toEqual([
			{ evidenceId: 'evd_n', why: 'the workspace refused the write' }
		]);
		expect(k5.foldersWithoutEvidence).toEqual([
			{ folder: 'odd', files: ['notes.md', 'stdout.txt'], runnerShaped: false }
		]);
		expect(k5.removed).toEqual([]);
		expect(k5.causes[3]!.why).toBe(
			'a folder here does not hold exactly the three files the runner writes'
		);
	});

	it('⭐ the final archive pairs EVERY unit’s evidence against every folder it holds', () => {
		const k5 = k5Check({
			before: ['f1', 'f2'],
			after: [capture('f1'), capture('f2')],
			snapshot: snapshotOf({
				evidence: [evidenceRow('evd_1', 'pwu_1', 'f1'), evidenceRow('evd_2', 'pwu_2', 'f2')]
			}),
			unitId: null,
			refusal: null,
			reviewedRunLimit: 32
		});
		expect([k5.added, k5.evidence, k5.paired, k5.foldersWithoutEvidence]).toEqual([[], 2, 2, []]);
	});

	it('⭐ the scope matched is the one the route gives every evidence object, and the one the report matches', () => {
		const route = readFileSync(
			new URL('../apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts', import.meta.url),
			'utf8'
		);
		expect(route).toContain(`scope: \`${EVIDENCE_SCOPE_PREFIX}\${pwuId}\``);
		expect(EVIDENCE_SCOPE_PREFIX).toBe(REPORT_SCOPE_PREFIX);
	});
});

/** An EXECUTION try of `unit` whose answer was `answer`, recorded as the product records its parse. */
const tryRow = (id: string, unit: string, answer: string): SnapshotRow =>
	row(id, {
		plane: 'EXECUTION',
		subjectObjectId: unit,
		disposition: 'ACCEPTED',
		parseOutcome: describeWorkProductDerivation(splitExecutionEnvelope(answer))
	});

describe('⭐ D7, K9 — each try’s parse outcome, its shortfall named by the product’s own text (REG-F-519)', () => {
	it('⛔ each of the five shortfalls the product records reads as its own kind, and only narration around the JSON as REG-F-519’s case', () => {
		const answers: [string, string][] = [
			['x1', 'Here is the result.\n{"workProduct":{"a":1},"rationale":{"rationale":"done"}}'],
			['x2', '[1, 2]'],
			['x3', '{"a":1}'],
			['x4', '{"workProduct":"w"}'],
			['x5', '{"workProduct":"w","rationale":{"rationale":"   "}}'],
			['x6', '{"workProduct":"w","rationale":{"rationale":"done"}}']
		];
		const k9 = k9Check(
			snapshotOf({ modelExchanges: answers.map(([id, a]) => tryRow(id, 'pwu_9', a)) }),
			'pwu_9'
		);
		expect(k9.map((t) => [t.exchangeId, t.outcome, t.shortfall, t.narrationCase])).toEqual([
			['x1', 'SCHEMA_COERCION_FAILED', 'not-json', true],
			['x2', 'SCHEMA_COERCION_FAILED', 'not-an-object', false],
			['x3', 'SCHEMA_COERCION_FAILED', 'no-work-product', false],
			['x4', 'SCHEMA_COERCION_FAILED', 'no-rationale', false],
			['x5', 'SCHEMA_COERCION_FAILED', 'empty-account', false],
			['x6', 'PARSED', null, false]
		]);
		// ⭑ Each text is the PRODUCT's, quoted whole into the detail.
		for (const [kind, text] of Object.entries(EXECUTION_SHORTFALLS))
			expect(k9.find((t) => t.shortfall === kind)?.detail, kind).toContain(text);
	});

	it('⭐ only the unit’s own tries are read, and a review’s exchanges are never a try', () => {
		const k9 = k9Check(
			snapshotOf({
				modelExchanges: [
					tryRow('mine', 'pwu_1', '{}'),
					tryRow('theirs', 'pwu_2', '{}'),
					row('review', { plane: 'ASSURANCE', subjectObjectId: 'pwu_1' })
				]
			}),
			'pwu_1'
		);
		expect(k9.map((t) => t.exchangeId)).toEqual(['mine']);
	});
});

describe('⭐ D7, D8 — the reviewer calls the store records: every one, a LOWER bound', () => {
	const snap = snapshotOf({
		artifacts: [
			row('art_1', { producingPwuId: 'pwu_1' }),
			row('art_2', { producingPwuId: 'pwu_2' })
		],
		evidence: [evidenceRow('evd_1', 'pwu_1', 'f')],
		modelExchanges: [
			row('t1', { plane: 'EXECUTION', subjectObjectId: 'pwu_1' }),
			row('a1', {
				plane: 'ASSURANCE',
				subjectObjectId: 'art_1',
				exchangeRole: 'INITIAL',
				disposition: 'NO_RESPONSE'
			}),
			row('a2', {
				plane: 'ASSURANCE',
				subjectObjectId: 'art_1',
				exchangeRole: 'RETRY',
				disposition: 'ACCEPTED'
			}),
			row('a3', {
				plane: 'ASSURANCE',
				subjectObjectId: 'evd_1',
				exchangeRole: 'INITIAL',
				disposition: 'ACCEPTED'
			}),
			row('a4', {
				plane: 'ASSURANCE',
				subjectObjectId: 'art_2',
				exchangeRole: 'INITIAL',
				disposition: 'REJECTED'
			})
		]
	});

	it('⛔ every ASSURANCE exchange counts — a thrown call by its disposition, its retry by its ROLE — and no try does', () => {
		expect(reviewerCalls(snap, null).recorded).toEqual({ calls: 4, noResponse: 1, retry: 1 });
		expect(reviewerCalls(snap, null).unit).toBeNull();
	});

	it('⭐ a unit’s calls are those reviewing its work product or its commands', () => {
		expect(reviewerCalls(snap, 'pwu_1').unit).toEqual({ calls: 3, noResponse: 1, retry: 1 });
		expect(reviewerCalls(snap, 'pwu_2').unit).toEqual({ calls: 1, noResponse: 0, retry: 0 });
	});
});

describe('⭐ D7 — the hashes: per file and per folder for src/, test/, docs/, and the tree as the manifest takes it', () => {
	it('⛔ a folder the unit has not made is recorded absent, never thrown on; the others hashed as `workspaceTreeSha256` hashes', () => {
		const ws = folder('hashed');
		mkdirSync(join(ws, 'src', 'lib'), { recursive: true });
		mkdirSync(join(ws, 'docs'));
		writeFileSync(join(ws, 'src', 'index.js'), 'export {};\n');
		writeFileSync(join(ws, 'src', 'lib', 'count.js'), 'export const n = 1;\n');
		writeFileSync(join(ws, 'docs', 'design.md'), '# design\n');
		writeFileSync(join(ws, 'package.json'), '{}\n');
		const h = hashesOf(ws);
		expect(h.treeSha256).toBe(workspaceTreeSha256(ws));
		expect(h.folders.test).toEqual({ present: false });
		expect(h.folders.src).toEqual({
			present: true,
			treeSha256: workspaceTreeSha256(join(ws, 'src')),
			files: [
				{ path: 'src/index.js', sha256: createHash('sha256').update('export {};\n').digest('hex') },
				{
					path: 'src/lib/count.js',
					sha256: createHash('sha256').update('export const n = 1;\n').digest('hex')
				}
			]
		});
		expect(h.folders.docs.present).toBe(true);
	});

	it('⭐ no workspace yet — the root’s archive — is no tree and three absent folders', () => {
		expect(hashesOf(null)).toEqual({
			treeSha256: null,
			folders: { src: { present: false }, test: { present: false }, docs: { present: false } }
		});
	});
});

describe('⭐ D7, K4 — what Pi loads from around the workspace (REG-F-512), as Pi loads it', () => {
	/** A workspace three folders down a tree of this file's own, and Pi's agent folder beside it. */
	function arrangement() {
		const base = folder('k4');
		const workspace = join(base, 'run', 'demo.sqlite.workspaces', 'und_1-0123456789abcdef');
		mkdirSync(join(workspace, 'docs'), { recursive: true });
		const agent = join(base, 'agent');
		mkdirSync(agent);
		return {
			base,
			workspace,
			agent,
			env: { PI_CODING_AGENT_DIR: agent, HOME: join(base, 'home') }
		};
	}

	it('⛔ a context file in ANY case — in Pi’s agent folder, in the folder above the workspace, at its root — is found; one in a subfolder Pi never reads is not', () => {
		const a = arrangement();
		writeFileSync(join(a.agent, 'agents.md'), 'agent-wide');
		// ⭐ `REG-F-512`'s own case: a command writes `<run>/demo.sqlite.workspaces/AGENTS.md`, which every later unit loads.
		writeFileSync(join(dirname(a.workspace), 'Agents.md'), 'above');
		writeFileSync(join(a.workspace, 'CLAUDE.MD'), 'at the root');
		writeFileSync(join(a.workspace, 'docs', 'AGENTS.md'), 'below: never read');
		const k4 = k4Check({
			workspace: a.workspace,
			env: a.env,
			home: a.base,
			tries: [],
			contentOf: () => undefined
		});
		expect(k4.agentDir).toEqual({
			path: a.agent,
			contextFiles: ['agents.md'],
			appendPrompt: null,
			extensions: []
		});
		// ⚠ Only this arrangement's own folders: what lies above the temporary folder is the host's, not this test's.
		const ours = (path: string) => path.startsWith(a.base);
		expect(k4.ancestors.withContextFiles.filter((f) => ours(f.path))).toEqual([
			{ path: dirname(a.workspace), contextFiles: ['Agents.md'] }
		]);
		expect(k4.workspaceRoot).toEqual({ exists: true, contextFiles: ['CLAUDE.MD'] });
		const findings = k4.findings.filter((f) => ours(f) || !/^[A-Za-z]:|^[\\/]/.test(f));
		expect(findings).toHaveLength(3);
		expect(findings.join('\n')).not.toContain('docs');
	});

	it('⛔ Pi’s agent folder is read for what Pi takes from it besides its context files: its appended prompt, in any case, and its extensions, listed whole', () => {
		// ⭑ Round 2's verification: an agent folder holding both read as holding nothing (`contextFiles: []`, no finding).
		const a = arrangement();
		writeFileSync(join(a.agent, 'Append_System.md'), 'appended, unmarked');
		mkdirSync(join(a.agent, 'extensions', 'tools'), { recursive: true });
		writeFileSync(join(a.agent, 'extensions', 'hook.ts'), 'export default () => {};');
		writeFileSync(join(a.agent, 'extensions', 'tools', 'index.ts'), 'export {};');
		const k4 = k4Check({
			workspace: a.workspace,
			env: a.env,
			home: a.base,
			tries: [],
			contentOf: () => undefined
		});
		expect(k4.agentDir).toEqual({
			path: a.agent,
			contextFiles: [],
			appendPrompt: 'Append_System.md',
			extensions: ['hook.ts', 'tools/', 'tools/index.ts']
		});
		const ours = k4.findings.filter((f) => f.startsWith(a.agent));
		expect(ours).toEqual([
			`${join(a.agent, 'Append_System.md')}: Pi appends it to every prompt by default, under an override, unmarked; the executor's loader is told to leave this out (pi-executor-resources.ts)`,
			`${join(a.agent, 'extensions')}: Pi loads the extensions there into the server for every session by default; the executor's loader is told to leave this out (pi-executor-resources.ts)`
		]);
	});

	it('⛔ a `.pi` a command wrote as a FILE is recorded, never thrown on — one unit’s odd file must not end the run', () => {
		// ⭑ Round 2's verification drove this arrangement to ENOTDIR, which ended the whole paid run as a lane error.
		const a = arrangement();
		writeFileSync(join(a.workspace, '.pi'), 'not a folder');
		const k4 = k4Check({
			workspace: a.workspace,
			env: a.env,
			home: a.base,
			tries: [],
			contentOf: () => undefined
		});
		expect(k4.pi).toEqual({ exists: true, listing: ['. (not listed: ENOTDIR)'] });
		expect(k4.findings).toContain(
			".pi: at the workspace root, where Pi by default reads settings — resolving the packages they list, and installing a missing one — and loads extensions and prompt files; the executor's Pi takes none of these: its settings trust no project, and its loader is told to leave the rest out (pi-executor.ts, pi-executor-resources.ts)"
		);
	});

	it('⛔ every folder above the workspace is read, to the drive root', () => {
		const a = arrangement();
		const k4 = k4Check({
			workspace: a.workspace,
			env: a.env,
			home: a.base,
			tries: [],
			contentOf: () => undefined
		});
		expect(k4.ancestors.checked).toBe(foldersAbove(a.workspace).length);
	});

	it('⭐ `.pi/` at the workspace root is listed whole; `.agents/skills` is found up to the git root, and not above it', () => {
		const a = arrangement();
		mkdirSync(join(a.workspace, '.pi', 'extensions'), { recursive: true });
		writeFileSync(join(a.workspace, '.pi', 'settings.json'), '{}');
		writeFileSync(join(a.workspace, '.pi', 'extensions', 'hook.ts'), 'export {};');
		// The git root is `run`: skills there are collected; skills above it are not.
		mkdirSync(join(a.base, 'run', '.git'));
		mkdirSync(join(a.base, 'run', '.agents', 'skills', 'one'), { recursive: true });
		writeFileSync(join(a.base, 'run', '.agents', 'skills', 'one', 'SKILL.md'), 'skill');
		mkdirSync(join(a.base, '.agents', 'skills', 'outside'), { recursive: true });
		const k4 = k4Check({
			workspace: a.workspace,
			env: a.env,
			home: a.base,
			tries: [],
			contentOf: () => undefined
		});
		expect(k4.pi).toEqual({
			exists: true,
			listing: ['extensions/', 'extensions/hook.ts', 'settings.json']
		});
		expect(k4.agentsSkills.found).toEqual([
			{ path: join(a.base, 'run', '.agents', 'skills'), listing: ['one/', 'one/SKILL.md'] }
		]);
		expect(k4.agentsSkills.searchedUpTo).toBe(join(a.base, 'run'));
	});

	it('⛔ each try’s recorded input is searched for Pi’s context blocks, its quotes JSON-escaped, and names each file by its last segment only (REG-F-536)', () => {
		const a = arrangement();
		const composite = JSON.stringify({
			instructions:
				'You execute.\n\n<project_context>\n\nProject-specific instructions and guidelines:\n\n' +
				'<project_instructions path="C:\\Users\\someone\\run\\AGENTS.md">\nobey\n</project_instructions>\n\n' +
				'</project_context>\n'
		});
		const stored = (id: string, key: string) =>
			row(id, { plane: 'EXECUTION', materializedInputRef: { status: 'STORED', storageKey: key } });
		const content: Record<string, string | null> = { k1: composite, k3: null };
		const k4 = k4Check({
			workspace: a.workspace,
			env: a.env,
			home: a.base,
			tries: [
				stored('x1', 'k1'),
				stored('x2', 'k2'),
				stored('x3', 'k3'),
				row('x4', { materializedInputRef: { status: 'PENDING' } })
			],
			contentOf: (key) => content[key]
		});
		expect(k4.inputs.map((i) => [i.exchangeId, i.read])).toEqual([
			['x1', 'searched'],
			['x2', 'absent'],
			['x3', 'purged'],
			['x4', 'not-stored']
		]);
		expect(k4.inputs[0]).toEqual({
			exchangeId: 'x1',
			read: 'searched',
			markers: { '<project_context>': 1, '<project_instructions path=': 1 },
			files: ['AGENTS.md']
		});
		expect(k4.findings.join('\n')).toContain('naming AGENTS.md');
		expect(k4.findings.join('\n'), 'a finding quotes the account’s path').not.toContain('someone');
	});

	it('⭐ Pi’s agent folder is PI_CODING_AGENT_DIR — a leading ~ expanded, a file URL read as its path — else ~/.pi/agent', () => {
		const home = resolve('/home-of-the-test');
		expect(piAgentDirOf({}, home)).toBe(join(home, '.pi', 'agent'));
		expect(piAgentDirOf({ PI_CODING_AGENT_DIR: '~/pi-here' }, home)).toBe(join(home, 'pi-here'));
		expect(piAgentDirOf({ PI_CODING_AGENT_DIR: '~' }, home)).toBe(home);
		const absolute = resolve('/elsewhere/agent');
		expect(piAgentDirOf({ PI_CODING_AGENT_DIR: absolute }, home)).toBe(absolute);
		expect(piAgentDirOf({ PI_CODING_AGENT_DIR: pathToFileURL(absolute).href }, home)).toBe(
			absolute
		);
	});
});

describe('⭐ D6, D7 — one archive: the dump, both stores, both folders and the checks, written once', () => {
	it('⛔ the archive holds what the unit left, proved, and its checks read it; a second archive of the same name is refused', async () => {
		const run = folder('archived-run');
		const store = join(run, 'demo.sqlite');
		walStore(store, 10);
		const content = new DatabaseSync(`${store}.content.sqlite`);
		open.push(content);
		content.exec('PRAGMA journal_mode = WAL');
		content.exec(
			'CREATE TABLE artifact_content (storage_key TEXT PRIMARY KEY, bytes TEXT, purged INTEGER NOT NULL DEFAULT 0)'
		);
		content
			.prepare('INSERT INTO artifact_content (storage_key, bytes) VALUES (?, ?)')
			.run('key-1', JSON.stringify({ system: 'no context here' }));
		const unit = 'pwu_01JARCHIVE';
		const workspace = workspaceDirectoryOf(store, 'und_1');
		mkdirSync(join(workspace, 'src'), { recursive: true });
		writeFileSync(join(workspace, 'src', 'index.js'), 'export {};\n');
		const output = processOutputDirectoryOf(workspace);
		mkdirSync(join(output, 'captures', 'c1'), { recursive: true });
		for (const f of ['omissions.json', 'stderr.txt', 'stdout.txt'])
			writeFileSync(join(output, 'captures', 'c1', f), '');
		const snapshot = snapshotOf({
			modelExchanges: [
				row('x1', {
					plane: 'EXECUTION',
					subjectObjectId: unit,
					materializedInputRef: { status: 'STORED', storageKey: 'key-1' },
					parseOutcome: { outcome: 'PARSED', detail: 'read' }
				})
			],
			evidence: [evidenceRow('evd_1', unit, 'c1')]
		});
		const text = `${JSON.stringify(snapshot)}\n`;
		const request = {
			archiveDir: join(run, 'lane', 'archive', '02-requirements'),
			storePath: store,
			undertakingId: 'und_1',
			unitId: unit,
			introspect: { text, snapshot },
			capturesBefore: [],
			refusal: null,
			reviewedRunLimit: 32,
			env: { PI_CODING_AGENT_DIR: join(run, 'no-agent') }
		};
		const made = await archiveUnit(request);
		const dir = request.archiveDir;
		expect(readdirSync(dir).sort()).toEqual([
			'checks.json',
			RECORD_STORE,
			CONTENT_STORE,
			'introspect.json',
			'process-output',
			'workspace'
		]);
		expect(readFileSync(join(dir, 'introspect.json'), 'utf8')).toBe(text);
		expect(rowsIn(join(dir, RECORD_STORE))).toBe(10);
		for (const s of [RECORD_STORE, CONTENT_STORE])
			expect(journalHeaderOf(join(dir, s)), s).toEqual([1, 1]);
		expect(readFileSync(join(dir, 'workspace', 'src', 'index.js'), 'utf8')).toBe('export {};\n');
		expect(made.captures).toEqual(['c1']);
		const checks = JSON.parse(readFileSync(join(dir, 'checks.json'), 'utf8')) as Record<
			string,
			unknown
		>;
		expect(Object.keys(checks)).toEqual(['k4', 'k5', 'k9', 'hashes', 'reviewerCalls', 'archived']);
		expect(made.checks.archived.stores.map((s) => [s.name, s.present])).toEqual([
			[RECORD_STORE, true],
			[CONTENT_STORE, true]
		]);
		expect(made.checks.k4.inputs).toEqual([
			{
				exchangeId: 'x1',
				read: 'searched',
				markers: { '<project_context>': 0, '<project_instructions path=': 0 },
				files: []
			}
		]);
		expect([
			made.checks.k5.paired,
			made.checks.k9.length,
			made.checks.hashes.folders.src.present
		]).toEqual([1, 1, true]);
		await expect(archiveUnit(request)).rejects.toThrow(
			'refused: the archive 02-requirements already exists, and an archive is written once'
		);
	});

	it('⭐ before the first model unit — no content store, no workspace — each is recorded absent', async () => {
		const run = folder('root-run');
		const store = join(run, 'demo.sqlite');
		walStore(store, 1);
		const made = await archiveUnit({
			archiveDir: join(run, 'lane', 'archive', '01-root'),
			storePath: store,
			undertakingId: 'und_2',
			unitId: 'pwu_root',
			introspect: { text: '{}', snapshot: snapshotOf({}) },
			capturesBefore: [],
			refusal: null,
			reviewedRunLimit: 32,
			env: {}
		});
		expect(made.checks.archived.stores.map((s) => [s.name, s.present])).toEqual([
			[RECORD_STORE, true],
			[CONTENT_STORE, false]
		]);
		expect([made.checks.archived.workspace, made.checks.archived.processOutput]).toEqual([
			{ present: false },
			{ present: false }
		]);
		expect(existsSync(join(run, 'lane', 'archive', '01-root', 'workspace'))).toBe(false);
	});

	it('⛔ each archive is diffed with the one before: a capture folder the previous archive held is not this unit’s (K5)', async () => {
		// ⭑ Round 2's verification: the archives were only ever driven with no folder before them.
		const run = folder('diffed-run');
		const store = join(run, 'demo.sqlite');
		walStore(store, 1);
		const captures = join(
			processOutputDirectoryOf(workspaceDirectoryOf(store, 'und_3')),
			'captures'
		);
		const capture = (name: string) => {
			mkdirSync(join(captures, name), { recursive: true });
			for (const f of ['omissions.json', 'stderr.txt', 'stdout.txt'])
				writeFileSync(join(captures, name, f), '');
		};
		const archived = (name: string, unitId: string, capturesBefore: readonly string[]) =>
			archiveUnit({
				archiveDir: join(run, 'lane', 'archive', name),
				storePath: store,
				undertakingId: 'und_3',
				unitId,
				introspect: { text: '{}', snapshot: snapshotOf({}) },
				capturesBefore,
				refusal: null,
				reviewedRunLimit: 32,
				env: {}
			});
		capture('first');
		const requirements = await archived('02-requirements', 'pwu_2', []);
		capture('second');
		const design = await archived('03-design', 'pwu_3', requirements.captures);
		expect(design.captures).toEqual(['first', 'second']);
		expect([design.checks.k5.capturesBefore, design.checks.k5.added]).toEqual([1, ['second']]);
	});
});

describe('⭐ the archive’s names are the run’s units, as the report reads them', () => {
	it('⛔ five units — the root, then §3.2’s phases in order — each archived as `<NN>-<slug>`, the final one `06-final`', () => {
		expect(PHASE7_ARCHIVE_UNITS.map((u) => u.title)).toEqual(
			[PHASE7_ROOT, ...PHASE7_PHASES].map((t) => t.name)
		);
		expect(PHASE7_ARCHIVE_UNITS.map((u) => archiveName(u.order, u.slug))).toEqual([
			'01-root',
			'02-requirements',
			'03-design',
			'04-implementation',
			'05-end-to-end'
		]);
		expect(PHASE7_ARCHIVE_UNITS.map((u) => [u.order, u.slug, u.title])).toEqual(
			REPORT_UNITS.map((u) => [u.order, u.slug, u.type.name])
		);
		expect(FINAL_ARCHIVE).toBe(REPORT_FINAL_ARCHIVE);
	});
});
