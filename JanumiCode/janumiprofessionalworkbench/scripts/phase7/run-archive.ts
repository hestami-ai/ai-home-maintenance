// ⭐ `JAN-EXEC` Phase 7, P7-2 D6 and D7 (DESIGN-the-live-end-to-end-run.md §6) — WHAT THE RUN'S LANE KEEPS AFTER EACH
// UNIT, AND WHAT IT CHECKS THERE.
//
// The live spec (`apps/rph-demo/e2e-live-exec/phase7.live.ts`) calls `archiveUnit` after each unit's Begin & Execute,
// and once more after the sign-offs, into `<RUN>/lane/archive/<NN>-<slug>/`:
//   · `demo.sqlite` and `demo.sqlite.content.sqlite` — each live store through SQLite's BACKUP, each copy converted to
//     a rollback journal (D6); the content store absent while it does not exist yet;
//   · `workspace/` and `process-output/` — the Undertaking's two folders, copied byte for byte, links kept as links;
//     absent before the first model unit, which is the first to make them;
//   · `introspect.json` — the server's own dump, as it answered;
//   · `checks.json` — D7's checks: K4, K5, K9, the hashes and the reviewer calls.
// Each archive is written ONCE: one that exists is refused, never added to.
//
// ⛔ A STORE IS BACKED UP, NEVER COPIED. Both stores are WAL (`packages/rph-persistence/src/sql-driver.ts`), so a record
// can be committed to the `-wal` alone, and a copy of the `.sqlite` misses it (`REG-F-526`). ⭑ DRIVEN, 2026-10-09, on
// this host (Node 24.11.1, whose `node:sqlite` is SQLite 3.50.4; the server's better-sqlite3 is 3.53.2): a second
// process held a store open as the server's driver opens it, with 2,000 rows committed to its `-wal` alone. A copy of
// the `.sqlite` held no table at all; `node:sqlite`'s `backup()`, from a read-only connection in this process, held all
// 2,000, and under writes every 2 ms its one-step backup held a consistent snapshot. better-sqlite3's `db.backup()` did
// the same, and is not chosen: it resolves here only by hoisting, declared by no package the spec belongs to, where
// `node:sqlite` is built in. ⚠ `node:sqlite` prints an ExperimentalWarning once per process, and nothing else.
// ⛔ AND EACH COPY IS CONVERTED, BECAUSE A BACKUP KEEPS ITS SOURCE'S WAL HEADER (bytes 18 and 19 read 2): a read-only
// open of such a copy wrote a `-shm` and a `-wal` beside it — driven, the same day. Converted (`journal_mode = DELETE`,
// header 1 and 1), the same open left its folder byte-identical. The run report refuses an archived store in WAL mode
// (`run-report.ts`, `archivedStoreProblem`), and `backupStore` proves each copy before the archive keeps it.
//
// ⚠ THE CHECKS SAY WHAT THE RECORD AND THE DISK SHOW, and name what they cannot tell apart (D7):
//   · K4 (`REG-F-512`) as Pi loads its context: its agent folder — its context files, its appended prompt and its
//     extensions — every folder above the workspace, the workspace root, its `.pi/`, and `.agents/skills` up to the git
//     root — beside a search of each try's recorded executor input for the blocks Pi writes when it loaded a file;
//   · K5 (`REG-F-517`) — the capture folders a unit added, against its evidence, and every cause of a folder with none;
//   · K9 (`REG-F-519`) — each try's parse outcome, its shortfall named by the product's own text;
//   · the hashes — per file and per folder for `src/`, `test/` and `docs/`, and the whole tree as the manifest takes it;
//   · the reviewer calls — the ASSURANCE exchanges recorded, a LOWER bound.
import { createHash } from 'node:crypto';
import {
	closeSync,
	constants,
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	readSync,
	statSync,
	symlinkSync,
	writeFileSync,
	type Dirent
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { workspaceTreeSha256 } from './node-tests.js';
import {
	PHASE7_DESIGN,
	PHASE7_E2E,
	PHASE7_IMPLEMENTATION,
	PHASE7_REQUIREMENTS,
	PHASE7_ROOT
} from './pwa-content.js';

// ── THE UNITS AND THEIR ARCHIVES ─────────────────────────────────────────────────────────────────────────────────────

export interface ArchiveUnit {
	readonly order: number;
	readonly slug: string;
	/** The unit's title, which instantiation copies from its type's name. */
	readonly title: string;
}

/** The five units, in the order the run starts them: the root, then §3.2's four phases (design §6 P7-2 D5). */
export const PHASE7_ARCHIVE_UNITS: readonly ArchiveUnit[] = [
	{ order: 1, slug: 'root', title: PHASE7_ROOT.name },
	{ order: 2, slug: 'requirements', title: PHASE7_REQUIREMENTS.name },
	{ order: 3, slug: 'design', title: PHASE7_DESIGN.name },
	{ order: 4, slug: 'implementation', title: PHASE7_IMPLEMENTATION.name },
	{ order: 5, slug: 'end-to-end', title: PHASE7_E2E.name }
];

/** A unit's archive folder, `<NN>-<slug>`. */
export const archiveName = (order: number, slug: string): string =>
	`${String(order).padStart(2, '0')}-${slug}`;

/** The archive taken after the sign-offs. */
export const FINAL_ARCHIVE = '06-final';

/** The record store, as the server names it (`JPWB_DEMO_DB`) and as the archive keeps it. */
export const RECORD_STORE = 'demo.sqlite';
/** The content store, the record store's name and this suffix (`src/lib/server/workbench.ts`, `getArtifactStore`). */
export const CONTENT_STORE_SUFFIX = '.content.sqlite';
export const CONTENT_STORE = `${RECORD_STORE}${CONTENT_STORE_SUFFIX}`;

/**
 * The Undertaking's workspace, as the server derives it (`src/lib/server/execution/workspace-host.ts`,
 * `resolveUndertakingSandbox`): `<store>.workspaces/<undertakingId>-<the first 16 hex of the id's SHA-256>`.
 * ⚠ RESTATED, because that function makes both folders as it names them; `verif/phase7-run-archive.test.ts` asks it.
 */
export function workspaceDirectoryOf(storePath: string, undertakingId: string): string {
	const fingerprint = createHash('sha256').update(undertakingId, 'utf8').digest('hex').slice(0, 16);
	return resolve(join(`${storePath}.workspaces`, `${undertakingId}-${fingerprint}`));
}

/** The workspace's sibling that holds each command's captured output — one per Undertaking, shared by every unit. */
export const processOutputDirectoryOf = (workspace: string): string =>
	`${workspace}.process-output`;

/** What the server writes beside each folder when it purges something in it (`filesystem-workspace.ts`). */
const TOMBSTONE_SUFFIX = '.jpwb-workspace-tombstones.json';

/** Strings in code-unit order, as `workspaceTreeSha256` orders paths: the same on every host and locale. */
const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);

// ── THE STORES ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A SQLite file's header bytes 18 and 19: 1 and 1 for a rollback journal, 2 and 2 for WAL. */
export function journalHeaderOf(file: string): readonly [number, number] {
	const header = Buffer.alloc(100);
	const fd = openSync(file, 'r');
	try {
		readSync(fd, header, 0, header.length, 0);
	} finally {
		closeSync(fd);
	}
	return [header[18] ?? 0, header[19] ?? 0];
}

/** The files a journal leaves beside a store. */
const BESIDE_A_STORE = ['-wal', '-shm', '-journal'] as const;

/** Why an archived store copy is not one a read-only open leaves alone, or undefined when it is. */
export function archivedCopyProblem(file: string): string | undefined {
	const [a, b] = journalHeaderOf(file);
	if (a !== 1 || b !== 1)
		return `its header declares journal ${a}/${b}, not a rollback journal (1/1), so a read-only open could write beside it`;
	const beside = BESIDE_A_STORE.filter((suffix) => existsSync(file + suffix)).map(
		(suffix) => basename(file) + suffix
	);
	return beside.length > 0 ? `${beside.join(', ')} lie beside it` : undefined;
}

/** What a folder holds, file by file: each name with its size and SHA-256. Not recursive: a journal lands beside its store. */
function folderPrint(folder: string): string {
	return readdirSync(folder)
		.sort(byCodeUnit)
		.map((name) => {
			const path = join(folder, name);
			const stat = statSync(path);
			return stat.isFile()
				? `${name} ${stat.size} ${createHash('sha256').update(readFileSync(path)).digest('hex')}`
				: `${name}/`;
		})
		.join('\n');
}

/**
 * ⭐ Does a read-only open of `file` — a query, then a close — leave its folder byte-identical? D6's condition for an
 * archived store, which the run report opens read-only.
 */
export function readOnlyOpenWritesNothing(file: string): boolean {
	const before = folderPrint(dirname(file));
	const db = new DatabaseSync(file, { readOnly: true });
	try {
		db.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get();
	} finally {
		db.close();
	}
	return folderPrint(dirname(file)) === before;
}

export interface StoreBackup {
	readonly pages: number;
	readonly bytes: number;
	readonly sha256: string;
	/** What `PRAGMA journal_mode = DELETE` answered on the copy. */
	readonly journalMode: string;
	readonly readOnlyOpenWritesNothing: boolean;
}

/**
 * ⭐ D6 — back `source` up to `destination` through SQLite's backup, convert the copy to a rollback journal, and prove
 * it: its header, nothing beside it, and a read-only open that writes nothing. Throws, naming why, when any fails.
 *
 * ⭑ The source is opened READ-ONLY, so the backup cannot write to the server's store, and copied in ONE step (`rate`
 * -1): one read transaction, so the copy is one consistent snapshot, and the server's writes, which a WAL reader does
 * not block, cannot restart it. ⛔ A `destination` that exists is refused: `backup()` would overwrite it.
 */
export async function backupStore(source: string, destination: string): Promise<StoreBackup> {
	if (existsSync(destination))
		throw new Error(
			`refused: ${basename(destination)} already exists, and an archived store is written once`
		);
	const from = new DatabaseSync(source, { readOnly: true, timeout: 5_000 });
	let pages: number;
	try {
		pages = await backup(from, destination, { rate: -1 });
	} finally {
		from.close();
	}
	const copy = new DatabaseSync(destination);
	let journalMode: string;
	try {
		const answered = copy.prepare('PRAGMA journal_mode = DELETE').get()?.journal_mode;
		journalMode = typeof answered === 'string' ? answered : 'no answer';
	} finally {
		copy.close();
	}
	const problem = archivedCopyProblem(destination);
	if (problem !== undefined)
		throw new Error(
			`the backup of ${basename(source)} was not converted to a rollback journal (journal_mode answered ` +
				`'${journalMode}'): ${problem}`
		);
	const untouched = readOnlyOpenWritesNothing(destination);
	if (!untouched)
		throw new Error(
			`a read-only open of the backup of ${basename(source)} wrote into its folder, so the archive cannot be read ` +
				'without changing it (design §6 P7-2 D6)'
		);
	const bytes = readFileSync(destination);
	return {
		pages,
		bytes: bytes.length,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		journalMode,
		readOnlyOpenWritesNothing: untouched
	};
}

// ── THE FOLDERS ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TreeCopy {
	readonly files: number;
	readonly folders: number;
	readonly bytes: number;
	/** Each link, by its `/`-separated path, with its target's text — recreated as a link, or why not. */
	readonly links: readonly {
		readonly path: string;
		readonly target: string;
		readonly recreated: boolean;
		readonly problem?: string;
	}[];
	/** Anything neither a file, a folder nor a link — a socket, a device — which is named, never copied. */
	readonly skipped: readonly string[];
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

/**
 * ⭐ D6 — copy the folder `source` to `destination`, byte for byte: each file's bytes as they are (no line ending is
 * touched, no encoding read), each folder, and each link AS A LINK, its target's text kept and never followed — so the
 * copy's `workspaceTreeSha256` is the original's (`node-tests.ts` hashes a link as its target's text). A link that
 * cannot be made here is named with its target, and the copy goes on. ⛔ A `destination` that exists is refused.
 */
export function copyTreeExact(source: string, destination: string): TreeCopy {
	if (existsSync(destination))
		throw new Error(
			`refused: ${basename(destination)} already exists, and an archive is written once`
		);
	const out = {
		files: 0,
		folders: 0,
		bytes: 0,
		links: [] as { path: string; target: string; recreated: boolean; problem?: string }[],
		skipped: [] as string[]
	};
	const walk = (from: string, to: string, rel: string): void => {
		mkdirSync(to);
		for (const name of readdirSync(from).sort(byCodeUnit)) {
			const path = join(from, name);
			const target = join(to, name);
			const relPath = rel === '' ? name : `${rel}/${name}`;
			const stat = lstatSync(path);
			if (stat.isSymbolicLink()) {
				const linked = readlinkSync(path);
				try {
					recreateLink(path, linked, target);
					// ⚠ A junction's target is made absolute, so the copy's text can differ from the original's: said so.
					const made = readlinkSync(target);
					out.links.push({
						path: relPath,
						target: linked,
						recreated: true,
						...(made === linked ? {} : { problem: `recreated with the target text ${made}` })
					});
				} catch (e) {
					out.links.push({
						path: relPath,
						target: linked,
						recreated: false,
						problem: e instanceof Error ? e.message : String(e)
					});
				}
			} else if (stat.isDirectory()) {
				out.folders += 1;
				walk(path, target, relPath);
			} else if (stat.isFile()) {
				copyFileSync(path, target, constants.COPYFILE_EXCL);
				out.files += 1;
				out.bytes += stat.size;
			} else out.skipped.push(relPath);
		}
	};
	walk(source, destination, '');
	return out;
}

/** Something the archive would hold, recorded as absent: a store not made yet, a folder no model unit has made. */
export interface Absent {
	readonly present: false;
}

/** A folder as the archive holds it: its copy, or its absence. */
export type ArchivedFolder = ({ readonly present: true } & TreeCopy) | Absent;

/** `copyTreeExact` when `source` exists; its absence, recorded, when it does not. */
function copyIfPresent(source: string, destination: string): ArchivedFolder {
	return existsSync(source)
		? { present: true, ...copyTreeExact(source, destination) }
		: { present: false };
}

// ── THE RECORD, AS THE CHECKS READ IT ────────────────────────────────────────────────────────────────────────────────

/** A row of the server's dump (`/test-api/introspect`): an object's id and state. */
export interface SnapshotRow {
	readonly id: string;
	readonly state: Readonly<Record<string, unknown>>;
}

/** The part of the dump the checks read. `EngineSnapshot` (`e2e/support/harness.ts`) is one. */
export interface ArchiveSnapshot {
	readonly modelExchanges: readonly SnapshotRow[];
	readonly evidence: readonly SnapshotRow[];
	readonly artifacts: readonly SnapshotRow[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const rec = (v: unknown): Readonly<Record<string, unknown>> =>
	v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * The scope the route gives every evidence object of a unit — its ONLY link to the unit (`EVIDENCE` has no unit field):
 * this and the unit's id (`undertakings/[id]/+page.server.ts`, `beginExecute`). ⛔ Matched EQUAL, never as a prefix or a
 * substring: one unit's id can begin another's.
 */
export const EVIDENCE_SCOPE_PREFIX = 'commands run by the executing model for work unit ';
export const evidenceScopeOf = (unitId: string): string => `${EVIDENCE_SCOPE_PREFIX}${unitId}`;

/** The unit's evidence; every unit's, when `unitId` is null (the final archive). */
function evidenceOf(snap: ArchiveSnapshot, unitId: string | null): SnapshotRow[] {
	return snap.evidence.filter((e) =>
		unitId === null
			? str(e.state.scope).startsWith(EVIDENCE_SCOPE_PREFIX)
			: str(e.state.scope) === evidenceScopeOf(unitId)
	);
}

/** The unit's tries — its EXECUTION exchanges, in the order they were recorded; every unit's, when `unitId` is null. */
function triesOf(snap: ArchiveSnapshot, unitId: string | null): SnapshotRow[] {
	return snap.modelExchanges.filter(
		(x) =>
			str(x.state.plane) === 'EXECUTION' &&
			(unitId === null || str(x.state.subjectObjectId) === unitId)
	);
}

// ── K9: EACH TRY'S PARSE OUTCOME (`REG-F-519`) ───────────────────────────────────────────────────────────────────────

/**
 * ⭐ The five shortfalls the execution contract records, each by the text the product quotes into the try's
 * `parseOutcome.detail` (`src/lib/server/execution/execution-contract.ts`, `splitExecutionEnvelope`): all five read
 * `SCHEMA_COERCION_FAILED`, so the outcome alone cannot tell them apart. ⚠ Each matched as its WHOLE text: the first
 * and second begin alike. `verif/phase7-run-archive.test.ts` asks the product for each.
 */
export const EXECUTION_SHORTFALLS = {
	'not-json':
		'The answer is not a JSON object, so the execution contract’s envelope could not be read.',
	'not-an-object': 'The answer is not a JSON object.',
	'no-work-product':
		'The answer carries no `workProduct` field, so the execution contract’s envelope was not used.',
	'no-rationale': 'The envelope declared no `rationale`, which the execution contract requires.',
	'empty-account': 'A `rationale` object was returned with no account in it.'
} as const;
export type ExecutionShortfall = keyof typeof EXECUTION_SHORTFALLS;

/** The shortfall a try's detail quotes, or null. */
export function shortfallOf(detail: string): ExecutionShortfall | null {
	for (const [kind, text] of Object.entries(EXECUTION_SHORTFALLS) as [ExecutionShortfall, string][])
		if (detail.includes(text)) return kind;
	return null;
}

export interface K9Try {
	readonly exchangeId: string;
	readonly requestedAt: string | null;
	readonly disposition: string | null;
	readonly outcome: string | null;
	readonly shortfall: ExecutionShortfall | null;
	/**
	 * ⭐ `REG-F-519`'s case: the answer did not parse as JSON WHOLE — what narration around the final JSON produces, and
	 * also what an answer holding no JSON at all produces; the record does not tell the two apart.
	 */
	readonly narrationCase: boolean;
	readonly detail: string | null;
}

/** ⭐ K9 — each try's parse outcome and detail, its shortfall named. */
export function k9Check(snap: ArchiveSnapshot, unitId: string | null): K9Try[] {
	return triesOf(snap, unitId).map((x) => {
		const parse = rec(x.state.parseOutcome);
		const detail = typeof parse.detail === 'string' ? parse.detail : null;
		const shortfall = detail === null ? null : shortfallOf(detail);
		return {
			exchangeId: x.id,
			requestedAt: str(x.state.requestedAt) || null,
			disposition: str(x.state.disposition) || null,
			outcome: str(parse.outcome) || null,
			shortfall,
			narrationCase: shortfall === 'not-json',
			detail
		};
	});
}

// ── THE REVIEWER CALLS (D8) ──────────────────────────────────────────────────────────────────────────────────────────

export interface CallCount {
	/** ASSURANCE exchanges: one per reviewer call, thrown calls included since P7-2b. */
	readonly calls: number;
	/** Calls that threw: disposition `NO_RESPONSE`. */
	readonly noResponse: number;
	/** Calls run once more after a throw: role `RETRY` — a ROLE, not a disposition (`ModelExchange`). */
	readonly retry: number;
}

export interface ReviewerCalls {
	/** Every reviewer call this run's store records. */
	readonly recorded: CallCount;
	/** Those reviewing this unit's work product or its commands; null for the final archive. */
	readonly unit: CallCount | null;
	readonly lowerBound: string;
}

const countOf = (rows: readonly SnapshotRow[]): CallCount => ({
	calls: rows.length,
	noResponse: rows.filter((x) => str(x.state.disposition) === 'NO_RESPONSE').length,
	retry: rows.filter((x) => str(x.state.exchangeRole) === 'RETRY').length
});

/** The unit a review's subject belongs to: a work product's producing unit, or the unit an evidence object's scope names. */
function unitOfReviewSubject(snap: ArchiveSnapshot, exchange: SnapshotRow): string | null {
	const subject = str(exchange.state.subjectObjectId);
	const artifact = snap.artifacts.find((a) => a.id === subject);
	if (artifact !== undefined) return str(artifact.state.producingPwuId) || null;
	const evidence = snap.evidence.find((e) => e.id === subject);
	const scope = str(evidence?.state.scope);
	return scope.startsWith(EVIDENCE_SCOPE_PREFIX) ? scope.slice(EVIDENCE_SCOPE_PREFIX.length) : null;
}

/** ⭐ D8 — the reviewer calls the store records, every one and this unit's. */
export function reviewerCalls(snap: ArchiveSnapshot, unitId: string | null): ReviewerCalls {
	const assurance = snap.modelExchanges.filter((x) => str(x.state.plane) === 'ASSURANCE');
	return {
		recorded: countOf(assurance),
		unit:
			unitId === null
				? null
				: countOf(assurance.filter((x) => unitOfReviewSubject(snap, x) === unitId)),
		lowerBound:
			'A lower bound: a call whose capture faulted, a record the engine refused, or a floor run cut off ' +
			'before its records were drained leaves no exchange, and the negative control’s calls are in no store.'
	};
}

// ── K5: CAPTURE FOLDERS AGAINST EVIDENCE (`REG-F-517`) ───────────────────────────────────────────────────────────────

/** One folder under `process-output/captures/`, with the names in it. */
export interface CaptureFolder {
	readonly name: string;
	readonly files: readonly string[];
}

/** The capture folders under `captures`, sorted; none when it does not exist. */
export function listCaptures(captures: string): CaptureFolder[] {
	if (!existsSync(captures)) return [];
	return readdirSync(captures)
		.filter((name) => statSync(join(captures, name)).isDirectory())
		.sort(byCodeUnit)
		.map((name) => ({ name, files: readdirSync(join(captures, name)).sort(byCodeUnit) }));
}

/** What the runner writes in every capture folder it keeps (`child-process-runner.ts`, `retain`). */
const RUNNER_CAPTURE_FILES = ['omissions.json', 'stderr.txt', 'stdout.txt'] as const;

export interface K5Input {
	/** The capture folders the previous archive held; none before the first. */
	readonly before: readonly string[];
	readonly after: readonly CaptureFolder[];
	readonly snapshot: ArchiveSnapshot;
	/** null for the final archive: every unit's evidence. */
	readonly unitId: string | null;
	/** The unit's Begin & Execute refusal, when it was refused. */
	readonly refusal: string | null;
	/** How many runs the product keeps as evidence (`OBSERVED_PROCESS_RUN_LIMIT`, through the lane's restatement). */
	readonly reviewedRunLimit: number;
}

export interface K5Check {
	readonly capturesBefore: number;
	readonly capturesAfter: number;
	readonly added: readonly string[];
	/** Folders the previous archive held and this one does not: nothing in the product removes one. */
	readonly removed: readonly string[];
	readonly evidence: number;
	/** Evidence naming a folder of the pool: the folders this unit added, or every folder for the final archive. */
	readonly paired: number;
	readonly foldersWithoutEvidence: readonly {
		readonly folder: string;
		readonly files: readonly string[];
		/** Holds exactly the three files the runner writes. */
		readonly runnerShaped: boolean;
	}[];
	/** Evidence whose output was not retained: no folder, by construction (`evidence-join.ts`). */
	readonly evidenceNotRetained: readonly { readonly evidenceId: string; readonly why: string }[];
	/** Evidence naming no folder of the pool, or naming none this can read. */
	readonly evidenceWithoutFolder: readonly {
		readonly evidenceId: string;
		readonly folder: string | null;
	}[];
	/** ⭐ Every cause of a folder with no evidence, and whether the record leaves it possible: named only when there is one. */
	readonly causes: readonly {
		readonly cause: string;
		readonly possible: boolean;
		readonly why: string;
	}[];
	/** The tries' own count of the model's tool calls: a witness of how many commands it ran, never of their outputs. */
	readonly toolCalls: {
		readonly tries: number;
		/** Every call the tries observed, `write_file` and `run_command` together. */
		readonly observed: number;
		/** `run_command` calls among the ones each try listed (its first 32). */
		readonly listedRunCommands: number;
		/** Calls past what each try listed, of a tool the record does not name. */
		readonly unlisted: number;
	};
}

/** The folder an evidence object's capture names (`captures/<uuid>/stdout.txt`), or null. */
function folderNamedBy(evidence: SnapshotRow): string | null {
	const capture = rec(rec(evidence.state.contentReference).capture);
	const named = /^captures\/([^/]+)\/stdout\.txt$/.exec(str(capture.stdoutPath));
	return named?.[1] ?? null;
}

/**
 * Each cause of a capture folder with no evidence (the design's K5, D7), and whether a unit's record leaves it possible.
 * For the final archive, which reads every unit at once, each is left possible: each unit's own archive says which.
 */
function causesOf(
	input: K5Input,
	evidence: number,
	without: readonly { readonly runnerShaped: boolean }[]
): K5Check['causes'] {
	const final = input.unitId === null;
	const joinRefused = (input.refusal ?? '').includes('could not be recorded as evidence');
	const perUnit = 'the final archive reads every unit at once; each unit’s own archive says';
	return [
		{
			cause: `a run after the first ${input.reviewedRunLimit}, which the product keeps as no evidence (REG-F-517)`,
			possible: final || evidence >= input.reviewedRunLimit,
			why: final
				? perUnit
				: `the product keeps a unit’s first ${input.reviewedRunLimit} runs to complete, and this unit has ${evidence} evidence object(s)`
		},
		{
			cause:
				'the step stopped before its evidence join: a try that did not run, a work product that could not be recorded, or a sandbox or executor that refused to open',
			possible: final || evidence === 0,
			why: final
				? perUnit
				: 'such a stop returns before any run becomes evidence, so it leaves the unit none'
		},
		{
			cause:
				'the evidence join refused part-way, and the runs after the one it could not record got none',
			possible: final || joinRefused,
			why: final
				? perUnit
				: `the unit’s refusal ${joinRefused ? 'says' : 'does not say'} a run could not be recorded as evidence`
		},
		{
			cause:
				'a folder a command wrote itself: a command runs as the server’s user, unconfined (REG-F-521), and can reach this folder',
			possible: true,
			why: without.some((f) => !f.runnerShaped)
				? 'a folder here does not hold exactly the three files the runner writes'
				: 'the record cannot rule it out, though each folder here holds the three files the runner writes'
		}
	];
}

/**
 * ⭐ K5 — the capture folders a unit added, against its evidence matched by EQUAL scope, and every cause of a folder with
 * none. ⚠ The folders name no unit: a unit's are the ones its run added, so each archive is diffed with the one before.
 */
export function k5Check(input: K5Input): K5Check {
	const before = new Set(input.before);
	const afterNames = input.after.map((f) => f.name);
	const added = input.after.filter((f) => !before.has(f.name));
	const pool = input.unitId === null ? input.after : added;
	const poolNames = new Set(pool.map((f) => f.name));
	const evidence = evidenceOf(input.snapshot, input.unitId);
	const named = new Set<string>();
	const notRetained: { evidenceId: string; why: string }[] = [];
	const unmatched: { evidenceId: string; folder: string | null }[] = [];
	for (const e of evidence) {
		const capture = rec(rec(e.state.contentReference).capture);
		if (capture.retained === false) {
			notRetained.push({ evidenceId: e.id, why: str(capture.notRetainedBecause) });
			continue;
		}
		const folder = folderNamedBy(e);
		if (folder !== null && poolNames.has(folder)) named.add(folder);
		else unmatched.push({ evidenceId: e.id, folder });
	}
	const without = pool
		.filter((f) => !named.has(f.name))
		.map((f) => ({
			folder: f.name,
			files: f.files,
			runnerShaped: f.files.join('\n') === RUNNER_CAPTURE_FILES.join('\n')
		}));
	const tries = triesOf(input.snapshot, input.unitId).map((x) => rec(x.state.observedToolCalls));
	const listed = tries.flatMap((t) => (Array.isArray(t.calls) ? (t.calls as unknown[]) : []));
	const observed = tries.reduce(
		(n, t) => n + (typeof t.observedCount === 'number' ? t.observedCount : 0),
		0
	);
	return {
		capturesBefore: before.size,
		capturesAfter: afterNames.length,
		added: added.map((f) => f.name),
		removed: input.before.filter((name) => !afterNames.includes(name)),
		evidence: evidence.length,
		paired: named.size,
		foldersWithoutEvidence: without,
		evidenceNotRetained: notRetained,
		evidenceWithoutFolder: unmatched,
		causes: without.length === 0 ? [] : causesOf(input, evidence.length, without),
		toolCalls: {
			tries: tries.length,
			observed,
			listedRunCommands: listed.filter((c) => str(rec(c).toolName) === 'run_command').length,
			unlisted: Math.max(0, observed - listed.length)
		}
	};
}

// ── K4: WHAT PI LOADS FROM AROUND THE WORKSPACE (`REG-F-512`) ────────────────────────────────────────────────────────

/**
 * The context files Pi folds into the executor's system prompt from each folder it reads: `AGENTS.md`, `AGENTS.MD`,
 * `CLAUDE.md` or `CLAUDE.MD` (`@earendil-works/pi-coding-agent` `dist/core/resource-loader.js`,
 * `loadContextFileFromDir`). ⚠ Matched in ANY case: Pi asks for each by name with `existsSync`, which on Windows finds
 * `Agents.md` too.
 */
const CONTEXT_FILE_NAMES = ['agents.md', 'claude.md'] as const;

/**
 * ⭑ What Pi takes from its AGENT FOLDER beside the context files — round 2's verification found K4 read the folder for
 * context files alone: `APPEND_SYSTEM.md`, appended to every executor prompt EVEN UNDER the executor's override, with no
 * block to mark it (`dist/core/resource-loader.js`, `discoverAppendSystemPromptFile`; `system-prompt.js`,
 * `buildSystemPrompt`), and `extensions/`, code Pi loads into the SERVER's process for every executor session
 * (`dist/core/package-manager.js`, the user resources). The executor's loader turns off neither (`pi-executor.ts`).
 * ⚠ Matched in any case, as `existsSync` finds them on Windows. `SYSTEM.md` is not here: the override replaces it.
 */
const AGENT_APPEND_PROMPT = 'APPEND_SYSTEM.md';
const AGENT_EXTENSIONS = 'extensions';

/**
 * The blocks Pi writes into the system prompt when it loaded a context file, even under the executor's override
 * (`dist/core/system-prompt.js`, `buildSystemPrompt`). ⚠ WITHOUT the attribute's quote: the recorded input is the
 * provider payload as JSON (`pi-executor.ts`), where that quote is escaped.
 */
export const PI_CONTEXT_MARKERS = ['<project_context>', '<project_instructions path='] as const;

/**
 * Pi's agent folder: `PI_CODING_AGENT_DIR` — a leading `~` expanded, a `file://` URL read as its path — else
 * `~/.pi/agent`, resolved as Pi resolves it before it reads (`dist/config.js`, `getAgentDir`; `dist/utils/paths.js`).
 */
export function piAgentDirOf(
	env: Readonly<Record<string, string | undefined>>,
	home: string = homedir()
): string {
	const configured = env.PI_CODING_AGENT_DIR;
	if (!configured) return join(home, '.pi', 'agent');
	if (configured === '~') return home;
	if (configured.startsWith('~/') || (process.platform === 'win32' && configured.startsWith('~\\')))
		return join(home, configured.slice(2));
	return resolve(configured.startsWith('file://') ? fileURLToPath(configured) : configured);
}

/** The names in `folder`, or undefined when it does not exist or cannot be listed. */
function namesIn(folder: string): string[] | undefined {
	try {
		return readdirSync(folder);
	} catch {
		return undefined;
	}
}

/** The entry of `folder` named `name` in any case, or undefined. */
function entryIn(folder: string, name: string): string | undefined {
	return namesIn(folder)?.find((n) => n.toLowerCase() === name.toLowerCase());
}

/** The context files in `folder`, as they are spelled there. */
function contextFilesIn(folder: string): string[] {
	return (namesIn(folder) ?? []).filter((n) =>
		(CONTEXT_FILE_NAMES as readonly string[]).includes(n.toLowerCase())
	);
}

/**
 * Everything under `folder`, `/`-separated and sorted, a folder with a trailing `/`. ⛔ A folder it cannot list — a
 * `.pi` a command wrote as a FILE, say — is named with why, never thrown on: one unit's odd file must not end the run
 * (round 2's verification drove `.pi` as a file to ENOTDIR, which ended the run as a lane error).
 */
function listingOf(folder: string): string[] {
	const out: string[] = [];
	const walk = (dir: string, rel: string): void => {
		let entries: Dirent[];
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch (e) {
			const code = (e as { code?: unknown }).code;
			out.push(`${rel === '' ? '.' : `${rel}/`} (not listed: ${String(code ?? e)})`);
			return;
		}
		for (const entry of entries.sort((a, b) => byCodeUnit(a.name, b.name))) {
			const relPath = rel === '' ? entry.name : `${rel}/${entry.name}`;
			if (entry.isDirectory()) {
				out.push(`${relPath}/`);
				walk(join(dir, entry.name), relPath);
			} else out.push(relPath);
		}
	};
	walk(folder, '');
	return out;
}

/** The folders from `start` up to the drive root, `start` first. */
function upFrom(start: string): string[] {
	const out: string[] = [];
	for (let folder = resolve(start); ; folder = dirname(folder)) {
		out.push(folder);
		if (dirname(folder) === folder) return out;
	}
}

export interface K4Input {
	/** The Undertaking's workspace — Pi's working folder — whether or not it exists yet. */
	readonly workspace: string;
	readonly env: Readonly<Record<string, string | undefined>>;
	readonly home: string;
	/** The tries whose recorded executor input is searched. */
	readonly tries: readonly SnapshotRow[];
	/** The bytes the content store holds under a key: the archived copy, read-only. */
	readonly contentOf: (storageKey: string) => string | null | undefined;
}

export interface K4Check {
	readonly agentDir: {
		readonly path: string;
		readonly contextFiles: readonly string[];
		/** `APPEND_SYSTEM.md` as it is spelled there, or null. */
		readonly appendPrompt: string | null;
		/** `extensions/`, listed whole; none when it is absent. */
		readonly extensions: readonly string[];
	};
	/** Every folder above the workspace, to the drive root: how many, and those holding a context file. */
	readonly ancestors: {
		readonly checked: number;
		readonly withContextFiles: readonly {
			readonly path: string;
			readonly contextFiles: readonly string[];
		}[];
	};
	readonly workspaceRoot: { readonly exists: boolean; readonly contextFiles: readonly string[] };
	/** The workspace's `.pi/`, which Pi reads settings, extensions and prompt files from — listed whole. */
	readonly pi: { readonly exists: boolean; readonly listing: readonly string[] };
	/**
	 * `.agents/skills` in each folder from the workspace up to its git root, else to the drive root
	 * (`dist/core/package-manager.js`, `collectAncestorAgentsSkillDirs`), and the user's own `~/.agents/skills`.
	 */
	readonly agentsSkills: {
		readonly searchedUpTo: string;
		readonly found: readonly { readonly path: string; readonly listing: readonly string[] }[];
		readonly user: { readonly path: string; readonly exists: boolean };
	};
	/** Each try's recorded executor input, searched for the blocks Pi writes when it loaded a context file. */
	readonly inputs: readonly {
		readonly exchangeId: string;
		readonly read: 'searched' | 'not-stored' | 'absent' | 'purged';
		readonly markers: Readonly<Record<string, number>>;
		/** The file names the blocks name, by their last segment only: the paths name the operator's account (`REG-F-536`). */
		readonly files: readonly string[];
	}[];
	/** What Pi would load or did load from around the workspace, one line each; none when nothing. */
	readonly findings: readonly string[];
}

/** The last segments of the paths `<project_instructions path=…>` names in `text`, its quotes escaped or not. */
function instructionFiles(text: string): string[] {
	const out: string[] = [];
	for (
		let at = text.indexOf(PI_CONTEXT_MARKERS[1]);
		at !== -1;
		at = text.indexOf(PI_CONTEXT_MARKERS[1], at + 1)
	) {
		const tail = text.slice(
			at + PI_CONTEXT_MARKERS[1].length,
			at + PI_CONTEXT_MARKERS[1].length + 4096
		);
		const end = tail.indexOf('>');
		const path = (end === -1 ? tail : tail.slice(0, end)).replaceAll('\\"', '').replaceAll('"', '');
		out.push(
			path
				.split(/[\\/]+/)
				.filter((s) => s !== '')
				.pop() ?? ''
		);
	}
	return out;
}

const occurrences = (text: string, needle: string): number => text.split(needle).length - 1;

/** ⭐ K4 — as Pi loads: its agent folder, every folder above the workspace, the workspace root, `.pi/` and `.agents/skills`. */
export function k4Check(input: K4Input): K4Check {
	const findings: string[] = [];
	const agentDir = piAgentDirOf(input.env, input.home);
	const agentFiles = contextFilesIn(agentDir);
	for (const f of agentFiles)
		findings.push(
			`${join(agentDir, f)}: Pi's agent folder holds a context file it folds into every prompt`
		);
	const appendPrompt = entryIn(agentDir, AGENT_APPEND_PROMPT) ?? null;
	if (appendPrompt !== null)
		findings.push(
			`${join(agentDir, appendPrompt)}: Pi appends it to every executor prompt, under the override, unmarked`
		);
	const extensionsEntry = entryIn(agentDir, AGENT_EXTENSIONS);
	const extensions =
		extensionsEntry === undefined ? [] : listingOf(join(agentDir, extensionsEntry));
	if (extensionsEntry !== undefined && extensions.length > 0)
		findings.push(
			`${join(agentDir, extensionsEntry)}: Pi loads the extensions there into the server for every executor session`
		);
	const above = upFrom(input.workspace).slice(1);
	const withContext = above
		.map((path) => ({ path, contextFiles: contextFilesIn(path) }))
		.filter((a) => a.contextFiles.length > 0);
	for (const a of withContext)
		for (const f of a.contextFiles)
			findings.push(
				`${join(a.path, f)}: above the workspace, on the path Pi reads its context from`
			);
	const rootExists = existsSync(input.workspace);
	const rootFiles = contextFilesIn(input.workspace);
	for (const f of rootFiles)
		findings.push(`${f}: at the workspace root, folded into the next unit's prompt`);
	const piEntry = entryIn(input.workspace, '.pi');
	const pi =
		piEntry === undefined
			? { exists: false, listing: [] }
			: { exists: true, listing: listingOf(join(input.workspace, piEntry)) };
	// ⚠ Said of the place, not of what is there: a `.pi` that is a FILE is named too, its listing saying it is no folder.
	if (pi.exists)
		findings.push(
			`${piEntry}: at the workspace root, where Pi reads settings, extensions and prompt files`
		);
	const chain = upFrom(input.workspace);
	const gitAt = chain.findIndex((folder) => existsSync(join(folder, '.git')));
	const searched = gitAt === -1 ? chain : chain.slice(0, gitAt + 1);
	const userSkills = join(input.env.HOME || input.home, '.agents', 'skills');
	const found = searched.flatMap((folder) => {
		const agents = entryIn(folder, '.agents');
		const skills = agents === undefined ? undefined : entryIn(join(folder, agents), 'skills');
		if (agents === undefined || skills === undefined) return [];
		const path = join(folder, agents, skills);
		return resolve(path) === resolve(userSkills) ? [] : [{ path, listing: listingOf(path) }];
	});
	for (const f of found) findings.push(`${f.path}: skills Pi collects for the workspace`);
	const inputs = input.tries.map((x) => {
		const ref = rec(x.state.materializedInputRef);
		const key = str(ref.storageKey);
		const none = { markers: {}, files: [] };
		if (str(ref.status) !== 'STORED' || key === '')
			return { exchangeId: x.id, read: 'not-stored' as const, ...none };
		const text = input.contentOf(key);
		if (text === undefined) return { exchangeId: x.id, read: 'absent' as const, ...none };
		if (text === null) return { exchangeId: x.id, read: 'purged' as const, ...none };
		const markers = Object.fromEntries(PI_CONTEXT_MARKERS.map((m) => [m, occurrences(text, m)]));
		return { exchangeId: x.id, read: 'searched' as const, markers, files: instructionFiles(text) };
	});
	for (const i of inputs)
		if (Object.values(i.markers).some((n) => n > 0))
			findings.push(
				`${i.exchangeId}: its recorded executor input holds Pi's context block` +
					(i.files.length > 0 ? `, naming ${i.files.join(', ')}` : '')
			);
	return {
		agentDir: { path: agentDir, contextFiles: agentFiles, appendPrompt, extensions },
		ancestors: { checked: above.length, withContextFiles: withContext },
		workspaceRoot: { exists: rootExists, contextFiles: rootFiles },
		pi,
		agentsSkills: {
			searchedUpTo: searched.at(-1) ?? input.workspace,
			found,
			user: { path: userSkills, exists: existsSync(userSkills) }
		},
		inputs,
		findings
	};
}

/** The bytes under each key of an archived content store, opened read-only once; `null` for a purged row. */
function contentReaderOf(store: string | null): {
	readonly contentOf: (storageKey: string) => string | null | undefined;
	readonly close: () => void;
} {
	if (store === null) return { contentOf: () => undefined, close: () => undefined };
	const db = new DatabaseSync(store, { readOnly: true });
	const select = db.prepare('SELECT bytes, purged FROM artifact_content WHERE storage_key = ?');
	return {
		contentOf: (storageKey) => {
			const row = select.get(storageKey) as { bytes?: unknown; purged?: unknown } | undefined;
			if (row === undefined) return undefined;
			return row.purged === 1 || typeof row.bytes !== 'string' ? null : row.bytes;
		},
		close: () => db.close()
	};
}

// ── THE HASHES ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The folders design §6 hashes. ⚠ The manifest's tree digest is wider — every file but `.git` (`node-tests.ts`). */
export const HASHED_FOLDERS = ['src', 'test', 'docs'] as const;

export type FolderHash =
	| { readonly present: false }
	| {
			readonly present: true;
			/** `workspaceTreeSha256` of the folder. */
			readonly treeSha256: string;
			/** Each file, by its path from the workspace root, `/`-separated; a link hashed as its target's text. */
			readonly files: readonly { readonly path: string; readonly sha256: string }[];
	  };

export interface HashCheck {
	/** The whole workspace's `workspaceTreeSha256`, as the command manifest records it; null when there is none. */
	readonly treeSha256: string | null;
	readonly folders: Readonly<Record<(typeof HASHED_FOLDERS)[number], FolderHash>>;
}

/** Each file under `folder`, as `workspaceTreeSha256` reads it: `.git` skipped, a link hashed as its target's text. */
function fileHashes(folder: string, rel: string): { path: string; sha256: string }[] {
	const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
	const out: { path: string; sha256: string }[] = [];
	const walk = (dir: string, at: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === '.git') continue;
			const full = join(dir, entry.name);
			const path = `${at}/${entry.name}`;
			if (entry.isSymbolicLink()) out.push({ path, sha256: sha(readlinkSync(full)) });
			else if (entry.isDirectory()) walk(full, path);
			else if (entry.isFile()) out.push({ path, sha256: sha(readFileSync(full)) });
		}
	};
	walk(folder, rel);
	return out.sort((a, b) => byCodeUnit(a.path, b.path));
}

/** ⭐ D7 — the hashes of an archived workspace: per file and per folder for `src/`, `test/`, `docs/`, and the whole tree. */
export function hashesOf(workspace: string | null): HashCheck {
	const isFolder = (path: string) =>
		statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
	const present = workspace !== null && isFolder(workspace);
	const folders = Object.fromEntries(
		HASHED_FOLDERS.map((name): [string, FolderHash] => {
			const path = present ? join(workspace, name) : null;
			return [
				name,
				path !== null && isFolder(path)
					? { present: true, treeSha256: workspaceTreeSha256(path), files: fileHashes(path, name) }
					: { present: false }
			];
		})
	) as Record<(typeof HASHED_FOLDERS)[number], FolderHash>;
	return { treeSha256: present ? workspaceTreeSha256(workspace) : null, folders };
}

// ── ONE ARCHIVE ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ArchiveRequest {
	/** `<RUN>/lane/archive/<NN>-<slug>`. */
	readonly archiveDir: string;
	/** The server's record store, `JPWB_DEMO_DB`. */
	readonly storePath: string;
	readonly undertakingId: string;
	/** The unit just run; null for the final archive, whose checks read every unit's records. */
	readonly unitId: string | null;
	/** The server's dump, as it answered and as parsed. */
	readonly introspect: { readonly text: string; readonly snapshot: ArchiveSnapshot };
	/** The capture folders the previous archive held. */
	readonly capturesBefore: readonly string[];
	readonly refusal: string | null;
	readonly reviewedRunLimit: number;
	readonly env: Readonly<Record<string, string | undefined>>;
}

/** A store as the archive holds it: its backup, proved, or its absence. */
export type ArchivedStore = { readonly name: string } & (
	({ readonly present: true } & StoreBackup) | Absent
);

export interface UnitChecks {
	readonly k4: K4Check;
	readonly k5: K5Check;
	readonly k9: readonly K9Try[];
	readonly hashes: HashCheck;
	readonly reviewerCalls: ReviewerCalls;
	/** What this archive holds: each store's backup, each folder's copy, and any purge record beside them. */
	readonly archived: {
		readonly stores: readonly ArchivedStore[];
		readonly workspace: ArchivedFolder;
		readonly processOutput: ArchivedFolder;
		readonly tombstones: readonly string[];
	};
}

export interface ArchiveOutcome {
	/** The capture folders this archive holds, for the next archive's K5. */
	readonly captures: readonly string[];
	readonly checks: UnitChecks;
}

/** The store at `source`, backed up into `archiveDir` under `name`, or its absence. */
async function archiveStore(
	name: string,
	source: string,
	archiveDir: string
): Promise<ArchivedStore> {
	return existsSync(source)
		? { name, present: true, ...(await backupStore(source, join(archiveDir, name))) }
		: { name, present: false };
}

/**
 * ⭐ D6 and D7 — archive the run as the unit left it, and check it. ⛔ Written once: an `archiveDir` that exists is
 * refused. ⚠ Taken with the server idle, between units — save the archive of a unit that outlasted its allowance,
 * which holds what that unit had committed by then.
 */
export async function archiveUnit(r: ArchiveRequest): Promise<ArchiveOutcome> {
	if (existsSync(r.archiveDir))
		throw new Error(
			`refused: the archive ${basename(r.archiveDir)} already exists, and an archive is written once`
		);
	mkdirSync(r.archiveDir, { recursive: true });
	writeFileSync(join(r.archiveDir, 'introspect.json'), r.introspect.text, { flag: 'wx' });
	const record = await archiveStore(RECORD_STORE, r.storePath, r.archiveDir);
	const content = await archiveStore(
		CONTENT_STORE,
		r.storePath + CONTENT_STORE_SUFFIX,
		r.archiveDir
	);
	const workspace = workspaceDirectoryOf(r.storePath, r.undertakingId);
	const output = processOutputDirectoryOf(workspace);
	const archived: UnitChecks['archived'] = {
		stores: [record, content],
		workspace: copyIfPresent(workspace, join(r.archiveDir, 'workspace')),
		processOutput: copyIfPresent(output, join(r.archiveDir, 'process-output')),
		tombstones: [workspace, output]
			.map((folder) => folder + TOMBSTONE_SUFFIX)
			.filter((kept) => existsSync(kept))
			.map((kept) => {
				copyFileSync(kept, join(r.archiveDir, basename(kept)), constants.COPYFILE_EXCL);
				return basename(kept);
			})
	};
	const captures = listCaptures(join(r.archiveDir, 'process-output', 'captures'));
	const reader = contentReaderOf(content.present ? join(r.archiveDir, CONTENT_STORE) : null);
	let k4: K4Check;
	try {
		k4 = k4Check({
			workspace,
			env: r.env,
			home: homedir(),
			tries: triesOf(r.introspect.snapshot, r.unitId),
			contentOf: reader.contentOf
		});
	} finally {
		reader.close();
	}
	const checks: UnitChecks = {
		k4,
		k5: k5Check({
			before: r.capturesBefore,
			after: captures,
			snapshot: r.introspect.snapshot,
			unitId: r.unitId,
			refusal: r.refusal,
			reviewedRunLimit: r.reviewedRunLimit
		}),
		k9: k9Check(r.introspect.snapshot, r.unitId),
		hashes: hashesOf(archived.workspace.present ? join(r.archiveDir, 'workspace') : null),
		reviewerCalls: reviewerCalls(r.introspect.snapshot, r.unitId),
		archived
	};
	writeFileSync(join(r.archiveDir, 'checks.json'), `${JSON.stringify(checks, null, '\t')}\n`, {
		flag: 'wx'
	});
	return { captures: captures.map((c) => c.name), checks };
}

// ── ⭐⭐ `JAN-EXEC` Phase 7 completion programme, E3's review — THE AUTHORING HALF'S ARCHIVE (`REG-D-112`) ────────────────

/**
 * ⭐ The archive half B takes when its authoring ends — at EVERY end: the authoring stopped, its allowance outlasted, the
 * dry rehearsal's stop, the limit before Send, a throw — and once its units are read, before the root's `01-root`.
 * ⛔ WITHOUT IT A RUN THAT STOPPED DURING AUTHORING COULD NEVER BE REPORTED: no unit had been archived, so the run report
 * found no store to read and refused (`run-report.ts`, *"no archive under lane/archive holds a demo.sqlite"*) — and the
 * authoring half's own result, a candidate the floor did not assure or a refused act, had no report (E3's review,
 * finding 1). ⭑ `00`, so it sorts before every unit's archive, and the report reads it only when nothing later exists.
 */
export const AUTHORING_ARCHIVE = '00-authoring';

/** What `archiveAuthoring` is asked for: the folder, the server's store, and its dump. */
export interface AuthoringArchiveRequest {
	/** `<RUN>/lane/archive/00-authoring`. */
	readonly archiveDir: string;
	/** The server's record store, `JPWB_DEMO_DB`. */
	readonly storePath: string;
	/** The server's dump, as it answered and as parsed. */
	readonly introspect: { readonly text: string; readonly snapshot: ArchiveSnapshot };
}

/**
 * ⭐ The authoring archive's `checks.json`: the stores as archived, and the reviewer calls the store records — the
 * authoring floor's, a LOWER bound (D8). ⚠ NO UNIT'S CHECKS: before the Undertaking there is no workspace and no process
 * output — each recorded ABSENT, so the report reads K5's folder as known-empty, never as unknown — and no try for K4 or
 * K9 to read.
 */
export interface AuthoringChecks {
	readonly reviewerCalls: ReviewerCalls;
	readonly archived: {
		readonly stores: readonly ArchivedStore[];
		readonly workspace: Absent;
		readonly processOutput: Absent;
		readonly tombstones: readonly string[];
	};
}

/**
 * ⭐ ARCHIVE THE STORES AS THE AUTHORING LEFT THEM (`AUTHORING_ARCHIVE`): the dump, both stores BACKED UP and converted to
 * a rollback journal (D6, as every archive's), and their checks. ⛔ Written once: a folder that exists is refused.
 */
export async function archiveAuthoring(r: AuthoringArchiveRequest): Promise<AuthoringChecks> {
	const { archiveDir } = r;
	if (existsSync(archiveDir))
		throw new Error(`refused: the archive ${basename(archiveDir)} already exists, and an archive is written once`);
	mkdirSync(archiveDir, { recursive: true });
	writeFileSync(join(archiveDir, 'introspect.json'), r.introspect.text, { flag: 'wx' });
	const stores = [
		await archiveStore(RECORD_STORE, r.storePath, archiveDir),
		await archiveStore(CONTENT_STORE, `${r.storePath}${CONTENT_STORE_SUFFIX}`, archiveDir)
	];
	const checks: AuthoringChecks = {
		reviewerCalls: reviewerCalls(r.introspect.snapshot, null),
		archived: { stores, workspace: { present: false }, processOutput: { present: false }, tombstones: [] }
	};
	writeFileSync(join(archiveDir, 'checks.json'), `${JSON.stringify(checks, null, '\t')}\n`, { flag: 'wx' });
	return checks;
}
