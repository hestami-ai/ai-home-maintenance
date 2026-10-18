// ⭐ `JAN-EXEC` Phase 7, P7-2 D9 (DESIGN-the-live-end-to-end-run.md §6) — THE RUN REPORT'S COMMAND LINE: the archived stores,
// opened READ-ONLY, and the lane's own files, into `lane/report/`.
//
//   bun scripts/phase7/run-report.ts <RUN>
//
// <RUN> is the run folder (`JPWB_LIVE_RUN_DIR`), or its after-teardown copy `<RUN>-final` (`finalize-run.ts`). It reads:
//   · the two stores of `lane/archive/06-final` — or, when the run ended before its sign-offs, of the last archive present
//     — with bun:sqlite opened `readonly`. ⛔ Never through the persistence package: its driver sets WAL and runs DDL on
//     open (`sql-driver.ts`, `sqlite-storage-adapter.ts`), and would write into the archive it was asked to read;
//   · `lane/run.json`, `lane/boot.json`, `lane/posts.jsonl` and `lane/actions/*.json`, and each archive's workspace tree
//     (`workspaceTreeSha256`), capture folders, and what its `checks.json` records of the run's process-output.
// It writes `report.json`, `report.md`, `command-manifest.json` and `command-manifest.excluded.json`, each once.
// `run-report-core.ts` decides everything; this reads and writes.
//
// ⛔ AN ARCHIVED STORE IN WAL MODE IS REFUSED, NEVER OPENED. A read-only open of a WAL-mode file can create its `-shm` and
// `-wal` beside it — a write into the archive. The lane converts each backup to a rollback journal so that a read-only
// open writes nothing (design D6), and the file's own header says which it is: bytes 18 and 19, 1 for a rollback
// journal and 2 for WAL.
// ⛔ THE OUTPUT IS SCANNED BEFORE A BYTE IS WRITTEN (`REG-F-536`): a hit for the account name or an absolute path writes
// nothing, and names each hit's place. ⛔ And with no account name to scan for, nothing is written either (`REG-F-545`):
// a scan for no name finds none, and its "no hit" would read as a pass.
//
// ⚠ RUNS UNDER BUN ONLY: bun:sqlite does not exist under Node, and better-sqlite3 does not load under bun
// (`scripts/tracker/bun-sqlite.d.ts`). Its tests spawn it, as the tracker's do. Exit 0 written; 1 refused by the scan;
// 2 refused before anything was written.
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	readSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { accountNames, noAccountName, scanText, type ScanHit } from './archive-scan.js';
import { workspaceTreeSha256 } from './node-tests.js';
import {
	buildRunReport,
	declaredWorkShown,
	FINAL_ARCHIVE,
	renderMarkdown,
	type ActionRecord,
	type ArchiveFacts,
	type LaneRows,
	type PostLine,
	type StoredContent,
	type StoredEvent,
	type StoredObject,
	type StoreRows
} from './run-report-core.js';

export const RECORD_STORE = 'demo.sqlite';
export const CONTENT_STORE = 'demo.sqlite.content.sqlite';
/** What the report writes into `lane/report/`, each once. */
export const REPORT_FILES = [
	'report.json',
	'report.md',
	'command-manifest.json',
	'command-manifest.excluded.json'
] as const;

const isDirectory = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

/**
 * ⭐ Why `file` may not be opened read-only as an archived store, or undefined: it must be a SQLite database whose header
 * declares a ROLLBACK journal, with no journal and no WAL file beside it.
 */
export function archivedStoreProblem(file: string): string | undefined {
	const header = Buffer.alloc(100);
	const fd = openSync(file, 'r');
	try {
		readSync(fd, header, 0, header.length, 0);
	} finally {
		closeSync(fd);
	}
	if (header.subarray(0, 16).toString('latin1') !== 'SQLite format 3\u0000') return 'is not a SQLite database';
	if (header[18] !== 1 || header[19] !== 1)
		return (
			'is in WAL mode, and a read-only open of it could write its -shm and -wal beside it in the archive: the lane ' +
			'converts each backup to a rollback journal before anything reads it (design D6)'
		);
	for (const suffix of ['-journal', '-wal'])
		if (existsSync(`${file}${suffix}`))
			return `has a ${suffix} file beside it: it was not archived as the lane archives a store, closed and converted`;
	return undefined;
}

interface ObjectRow {
	readonly id: string;
	readonly objectType: string;
	readonly state: string;
	readonly firstSequence: number | null;
}

interface ContentRow {
	readonly storageKey: string;
	readonly contentHash: string;
	readonly byteSize: number;
	readonly purged: number;
	readonly bytes: string | null;
}

/**
 * The rows of both archived stores, each opened read-only and closed. ⛔ Content bytes are hashed here and never kept; ⭐ P5
 * package B's check (finding 2) — and a declared review's prompt is read here for what it showed of its work
 * (`declaredWorkShown`): the host's lines declaring a cut of it and the units its work holds, never the work itself.
 */
export function readStores(archive: string): StoreRows {
	const record = new Database(join(archive, RECORD_STORE), { readonly: true });
	let objects: StoredObject[];
	let events: StoredEvent[];
	try {
		objects = (
			record
				.prepare(
					'SELECT o.id AS id, o.object_type AS objectType, o.state AS state, f.first AS firstSequence ' +
						'FROM professional_work_objects o LEFT JOIN (SELECT aggregate_id, MIN(global_sequence) AS first ' +
						'FROM domain_events GROUP BY aggregate_id) f ON f.aggregate_id = o.id'
				)
				.all() as ObjectRow[]
		).map((r) => ({
			id: r.id,
			objectType: r.objectType,
			state: JSON.parse(r.state) as Record<string, unknown>,
			firstSequence: r.firstSequence ?? Number.MAX_SAFE_INTEGER
		}));
		// ⚠ The column holds the WHOLE envelope; the domain payload is its `payload` (`sqlite-storage-adapter.ts`).
		events = (
			record.prepare('SELECT global_sequence AS sequence, payload FROM domain_events ORDER BY global_sequence').all() as {
				sequence: number;
				payload: string;
			}[]
		).map((r) => {
			const e = JSON.parse(r.payload) as Record<string, unknown>;
			return {
				sequence: r.sequence,
				eventType: String(e.eventType ?? ''),
				aggregateType: String(e.aggregateType ?? ''),
				aggregateId: String(e.aggregateId ?? ''),
				commandId: typeof e.commandId === 'string' ? e.commandId : null,
				// ⭐ P7-6 B7 — a floor run's token, on its assessments' events: the pairing's key (`REG-F-433`).
				correlationId: typeof e.correlationId === 'string' ? e.correlationId : null,
				payload: (e.payload ?? {}) as Record<string, unknown>
			};
		});
	} finally {
		record.close();
	}
	const contentFile = join(archive, CONTENT_STORE);
	let content: StoredContent[] | null = null;
	if (existsSync(contentFile)) {
		const store = new Database(contentFile, { readonly: true });
		try {
			content = (
				store
					.prepare(
						'SELECT storage_key AS storageKey, content_hash AS contentHash, byte_size AS byteSize, purged, bytes ' +
							'FROM artifact_content'
					)
					.all() as ContentRow[]
			).map((r) => ({
				storageKey: r.storageKey,
				contentHash: r.contentHash,
				byteSize: r.byteSize,
				purged: r.purged === 1,
				actualHash: r.bytes === null ? null : `sha256:${createHash('sha256').update(r.bytes, 'utf8').digest('hex')}`,
				actualSize: r.bytes === null ? null : Buffer.byteLength(r.bytes, 'utf8'),
				declaredWork: r.bytes === null ? null : declaredWorkShown(r.bytes)
			}));
		} finally {
			store.close();
		}
	}
	return { objects, events, content };
}

/** A lane file, parsed — or undefined when absent, with a problem pushed when it is present and unreadable. */
function readJson(file: string, name: string, problems: string[]): unknown {
	if (!existsSync(file)) return undefined;
	try {
		return JSON.parse(readFileSync(file, 'utf8')) as unknown;
	} catch (e) {
		problems.push(`${name} is not readable JSON: ${(e as Error).name}`);
		return undefined;
	}
}

/** The lane's own files, and what each archive holds. */
export function readLane(run: string, archiveRead: string): LaneRows {
	const problems: string[] = [];
	const lane = join(run, 'lane');
	let posts: PostLine[] | undefined;
	const postsFile = join(lane, 'posts.jsonl');
	if (existsSync(postsFile)) {
		posts = [];
		let unreadable = 0;
		for (const line of readFileSync(postsFile, 'utf8').split('\n')) {
			if (line.trim() === '') continue;
			try {
				posts.push(JSON.parse(line) as PostLine);
			} catch {
				unreadable += 1;
			}
		}
		if (unreadable > 0) problems.push(`lane/posts.jsonl has ${unreadable} unreadable line(s)`);
	} else problems.push('lane/posts.jsonl is absent: refused POSTs, which leave no event, cannot be counted');
	const actionsDir = join(lane, 'actions');
	const actions: ActionRecord[] = isDirectory(actionsDir)
		? readdirSync(actionsDir)
				.filter((f) => f.endsWith('.json'))
				.sort()
				.map((file) => {
					const a = readJson(join(actionsDir, file), `lane/actions/${file}`, problems) as
						| { action?: unknown; envelopeType?: unknown }
						| undefined;
					return {
						file,
						...(typeof a?.action === 'string' ? { action: a.action } : {}),
						envelopeType: typeof a?.envelopeType === 'string' ? a.envelopeType : null
					};
				})
		: [];
	const archiveDir = join(lane, 'archive');
	const archives: ArchiveFacts[] = (isDirectory(archiveDir) ? readdirSync(archiveDir).sort() : [])
		.filter((name) => isDirectory(join(archiveDir, name)))
		.map((name) => {
			const workspace = join(archiveDir, name, 'workspace');
			const output = join(archiveDir, name, 'process-output');
			const captures = join(output, 'captures');
			// ⭑ What the archiver recorded of the process-output (`run-archive.ts`): absent from the run, or copied. Read loosely —
			// an archive cut short has no checks.json, and its missing folder then stays UNKNOWN, never "none" (K5).
			const checks = readJson(join(archiveDir, name, 'checks.json'), `lane/archive/${name}/checks.json`, problems) as
				| { archived?: { processOutput?: { present?: unknown } }; k5?: { causes?: unknown } }
				| undefined;
			const present = checks?.archived?.processOutput?.present;
			// ⭐ P5 package B (F5) — K5's causes as the archive recorded them, each whether its record left it possible.
			const causes = checks?.k5?.causes;
			return {
				name,
				workspaceTree: isDirectory(workspace) ? workspaceTreeSha256(workspace) : null,
				captures: isDirectory(captures)
					? readdirSync(captures).filter((c) => isDirectory(join(captures, c))).sort()
					: isDirectory(output)
						? []
						: null,
				processOutputRecorded: typeof present === 'boolean' ? present : null,
				k5Causes: Array.isArray(causes)
					? causes.map((c: { cause?: unknown; possible?: unknown }) => ({ cause: String(c?.cause ?? ''), possible: c?.possible === true }))
					: null
			};
		});
	return {
		run: readJson(join(lane, 'run.json'), 'lane/run.json', problems),
		boot: readJson(join(lane, 'boot.json'), 'lane/boot.json', problems),
		posts,
		actions,
		archives,
		archiveRead,
		problems
	};
}

/** The archive the stores are read from: the final one, else the last one that holds a record store. */
export function archiveToRead(run: string): string | undefined {
	const archiveDir = join(run, 'lane', 'archive');
	if (!isDirectory(archiveDir)) return undefined;
	const withStore = readdirSync(archiveDir)
		.filter((name) => existsSync(join(archiveDir, name, RECORD_STORE)))
		.sort();
	return withStore.includes(FINAL_ARCHIVE) ? FINAL_ARCHIVE : withStore.at(-1);
}

/**
 * Returns the exit code: 0 written; 1 the scan refused the output; 2 refused before anything was written. `names` are the
 * account names the output is scanned for (`accountNames`), given so a test can hand it none.
 */
export function main(
	argv: readonly string[],
	write: (s: string) => void,
	names: readonly string[] = accountNames()
): number {
	const say = (s: string) => write(`phase7/run-report — ${s}\n`);
	if (argv.length !== 1 || argv[0]!.startsWith('--')) {
		say('usage: bun scripts/phase7/run-report.ts <RUN>');
		return 2;
	}
	const run = resolve(argv[0]!);
	if (!isDirectory(run)) {
		say('usage: <RUN> names no folder');
		return 2;
	}
	const archive = archiveToRead(run);
	if (archive === undefined) {
		say(`refused: no archive under lane/archive holds a ${RECORD_STORE}, so there is no store to read`);
		return 2;
	}
	const archivePath = join(run, 'lane', 'archive', archive);
	for (const store of [RECORD_STORE, CONTENT_STORE]) {
		const file = join(archivePath, store);
		if (!existsSync(file)) continue;
		const problem = archivedStoreProblem(file);
		if (problem !== undefined) {
			say(`refused, and nothing was opened: lane/archive/${archive}/${store} ${problem}`);
			return 2;
		}
	}
	const out = join(run, 'lane', 'report');
	const existing = REPORT_FILES.filter((f) => existsSync(join(out, f)));
	if (existing.length > 0) {
		say(`refused: lane/report already holds ${existing.join(', ')}, which is left untouched: a report is written once`);
		return 2;
	}
	if (names.length === 0) {
		say(`refused, and nothing was written: ${noAccountName('the output')}`);
		return 2;
	}
	let built: ReturnType<typeof buildRunReport>;
	try {
		built = buildRunReport(readStores(archivePath), readLane(run, archive), { accountNames: names });
	} catch (e) {
		say(`refused, and nothing was written: ${(e as Error).message}`);
		return 2;
	}
	const texts: Record<(typeof REPORT_FILES)[number], string> = {
		'report.json': `${JSON.stringify(built.report, null, '\t')}\n`,
		'report.md': renderMarkdown(built.report),
		'command-manifest.json': `${JSON.stringify(built.manifest, null, '\t')}\n`,
		'command-manifest.excluded.json': `${JSON.stringify(built.excluded, null, '\t')}\n`
	};
	const hits: ScanHit[] = REPORT_FILES.flatMap((f) => scanText(texts[f], f, names));
	if (hits.length > 0) {
		say(
			`refused, and nothing was written: the report's own output names the account or an absolute path (REG-F-536):\n  ` +
				hits.map((h) => `${h.file}:${h.line}:${h.column} ${h.kind}`).join('\n  ')
		);
		return 1;
	}
	mkdirSync(out, { recursive: true });
	for (const f of REPORT_FILES) writeFileSync(join(out, f), texts[f], { flag: 'wx' });
	const r = built.report;
	say(
		`read lane/archive/${archive}; wrote lane/report/: ${r.matrix.length} cells (${r.answer.counts.broke} broke, ` +
			`${r.answer.open} open), ${r.pairing.rows.length} paired review(s), ${r.audit.forbiddenFound} forbidden act(s) ` +
			`found, ${r.manifest.commands} command(s) in the manifest and ${r.manifest.excluded} left out`
	);
	return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2), (s) => process.stdout.write(s));
