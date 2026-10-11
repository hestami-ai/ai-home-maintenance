// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D1, D4; `REG-D-111` (5); `REG-F-530`; `REG-F-536`) — THE
// RECORDER: a paid run's FINAL archive, read read-only with the run report's readers, into a replay recording.
//
//   bun scripts/phase7/record-replay.ts <RUN> <OUT> --commit <sha> --fingerprint <reviewer fingerprint>
//
// <RUN> is the run folder (or its `-final` copy); <OUT> is a folder that does not exist yet, or is empty. It reads:
//   · `lane/archive/06-final`'s two stores — only the FINAL archive: a recording is of the whole run — each refused, and
//     nothing opened, unless it is archived as the lane archives a store (`archivedStoreProblem`, the report's rule);
//   · the final archive's `process-output/captures/*`, each command's captured bytes;
//   · each unit archive's `workspace/`, to hold the replayed writes to (`verifyWrites`);
//   · `lane/run.json` (the units), `lane/boot.json` (`JPWB_DEMO_DB`, so the run's workspace is known to scrub), and
//     `lane/report/report.json` (the matrix the recording expects — the report is final before anything is recorded).
// The commit and the reviewer fingerprint are the operator's to give: the archive does not hold the commit its run ran
// on, and the fingerprint is the one `bun run reviewer:qual:check` printed for that commit.
//
// ⛔ IT WRITES NOTHING UNLESS ALL THREE CHECKS PASS, in this order:
//   1. every part of the run can be read into the recording (`buildRecording`'s problems);
//   2. the extracted `write_file` calls, replayed, rebuild every unit archive's workspace tree (`verifyWrites`) —
//      `REG-F-530` calls the payload's arguments INFERRED, and this is where the inference is checked;
//   3. ⛔ no file of the recording names the account or an absolute path (`REG-F-536`; `archive-scan.ts`), every text
//      having been scrubbed of the run's own directories first. A hit refuses the whole recording, and names each hit's
//      place and kind, never its text. And with no account name to scan for, nothing is written either (`REG-F-545`).
// ⚠ RUNS UNDER BUN ONLY (bun:sqlite). Exit 0 written; 1 refused by a check; 2 refused before anything was read.
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
	recordingFiles,
	type RecordedCell
} from '../../apps/rph-demo/src/lib/server/replay/recording.js';
import { accountNames, noAccountName, scanText, type ScanHit } from './archive-scan.js';
import {
	buildRecording,
	verifyWrites,
	type ArchivedCapture,
	type RecorderUnit
} from './record-replay-core.js';
import { FINAL_ARCHIVE } from './run-report-core.js';
import {
	archivedStoreProblem,
	archiveToRead,
	CONTENT_STORE,
	readStores,
	RECORD_STORE
} from './run-report.js';

const isDirectory = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();
const rec = (v: unknown): Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Every content row's BYTES, by storage key — read-only, the store refused unless archived (`archivedStoreProblem`). */
export function readContentBytes(archive: string): Map<string, string> {
	const out = new Map<string, string>();
	const file = join(archive, CONTENT_STORE);
	if (!existsSync(file)) return out;
	const store = new Database(file, { readonly: true });
	try {
		for (const row of store
			.prepare('SELECT storage_key AS k, bytes AS b FROM artifact_content WHERE purged = 0')
			.all() as {
			k: string;
			b: string | null;
		}[])
			if (row.b !== null) out.set(row.k, row.b);
	} finally {
		store.close();
	}
	return out;
}

/** The final archive's capture folders, by `captures/<id>`. */
function capturesOf(archive: string): Map<string, ArchivedCapture> {
	const out = new Map<string, ArchivedCapture>();
	const dir = join(archive, 'process-output', 'captures');
	if (!isDirectory(dir)) return out;
	for (const id of readdirSync(dir).filter((c) => isDirectory(join(dir, c)))) {
		const read = (name: string): string =>
			existsSync(join(dir, id, name)) ? readFileSync(join(dir, id, name), 'utf8') : '';
		let omissions: unknown = {};
		try {
			omissions = JSON.parse(read('omissions.json'));
		} catch {
			omissions = {};
		}
		out.set(`captures/${id}`, {
			stdout: read('stdout.txt'),
			stderr: read('stderr.txt'),
			omissions
		});
	}
	return out;
}

/** A lane file, parsed, or undefined. */
function laneJson(run: string, ...path: string[]): unknown {
	const file = join(run, 'lane', ...path);
	if (!existsSync(file)) return undefined;
	try {
		return JSON.parse(readFileSync(file, 'utf8')) as unknown;
	} catch {
		return undefined;
	}
}

/** `--name value` pairs, and the positional arguments. */
function parseArgs(
	argv: readonly string[]
): { readonly positional: string[]; readonly flags: Map<string, string> } | string {
	const positional: string[] = [];
	const flags = new Map<string, string>();
	for (let k = 0; k < argv.length; k++) {
		const a = argv[k]!;
		if (!a.startsWith('--')) {
			positional.push(a);
			continue;
		}
		if (a !== '--commit' && a !== '--fingerprint') return `unknown flag ${a}`;
		const value = argv[k + 1];
		if (value === undefined || value.startsWith('--')) return `${a} takes a value`;
		flags.set(a, value);
		k += 1;
	}
	return { positional, flags };
}

const USAGE =
	'usage: bun scripts/phase7/record-replay.ts <RUN> <OUT> --commit <sha> --fingerprint <reviewer fingerprint>';

/**
 * Returns the exit code: 0 written; 1 refused by a check; 2 refused before anything was read. `names` are the account
 * names the recording is scanned for (`accountNames`), and `home` the folder scrubbed as `JPWB_REPLAY_HOME_NATIVE` — given so a test
 * can hand its own.
 */
export function main(
	argv: readonly string[],
	write: (s: string) => void,
	names: readonly string[] = accountNames(),
	home: string = homedir()
): number {
	const say = (s: string) => write(`phase7/record-replay — ${s}\n`);
	const parsed = parseArgs(argv);
	if (typeof parsed === 'string' || parsed.positional.length !== 2) {
		say(typeof parsed === 'string' ? `${parsed}; ${USAGE}` : USAGE);
		return 2;
	}
	const commit = parsed.flags.get('--commit') ?? '';
	const fingerprint = parsed.flags.get('--fingerprint') ?? '';
	if (commit === '' || fingerprint === '') {
		say(
			`the commit and the reviewer fingerprint are required: the archive holds neither; ${USAGE}`
		);
		return 2;
	}
	const run = resolve(parsed.positional[0]!);
	const out = resolve(parsed.positional[1]!);
	if (!isDirectory(run)) {
		say('refused: <RUN> names no folder');
		return 2;
	}
	if (existsSync(out) && (!isDirectory(out) || readdirSync(out).length > 0)) {
		say(
			'refused: <OUT> already holds something, which is left untouched: a recording is written once, into an empty folder'
		);
		return 2;
	}
	if (names.length === 0) {
		say(`refused, and nothing was read: ${noAccountName('the recording')}`);
		return 2;
	}
	if (archiveToRead(run) !== FINAL_ARCHIVE) {
		say(
			`refused: the run has no lane/archive/${FINAL_ARCHIVE} holding a store, and a recording is of the whole run`
		);
		return 2;
	}
	const archive = join(run, 'lane', 'archive', FINAL_ARCHIVE);
	for (const store of [RECORD_STORE, CONTENT_STORE]) {
		const file = join(archive, store);
		const problem = existsSync(file) ? archivedStoreProblem(file) : `is absent`;
		if (problem !== undefined) {
			say(`refused, and nothing was opened: lane/archive/${FINAL_ARCHIVE}/${store} ${problem}`);
			return 2;
		}
	}

	// ── READ ────────────────────────────────────────────────────────────────────────────────────────────────────────────
	const store = readStores(archive);
	const runJson = rec(laneJson(run, 'run.json'));
	const units: RecorderUnit[] = (Array.isArray(runJson.units) ? runJson.units : []).map((u) => {
		const r = rec(u);
		return { slug: str(r.slug), unitId: str(r.unitId), archive: str(r.archive) };
	});
	const demoDb = str(rec(rec(laneJson(run, 'boot.json')).overlay).JPWB_DEMO_DB);
	const undertakings = store.objects.filter((o) => o.objectType === 'UNDERTAKING');
	const matrix = rec(laneJson(run, 'report', 'report.json')).matrix;
	const before: string[] = [];
	if (units.length === 0) before.push('lane/run.json names no unit');
	if (demoDb === '')
		before.push(
			"lane/boot.json names no JPWB_DEMO_DB, so the run's workspace is not known to scrub"
		);
	if (undertakings.length !== 1)
		before.push(`the store holds ${undertakings.length} Undertakings, and a recording is of one`);
	if (!Array.isArray(matrix))
		before.push(
			'lane/report/report.json holds no matrix: the report is final before anything is recorded'
		);
	if (before.length > 0) {
		say(`refused, and nothing was written:\n  ${before.join('\n  ')}`);
		return 1;
	}
	// ⭑ The workspace as `workspace-host.ts` spelled it on the run's host: resolved, under `<JPWB_DEMO_DB>.workspaces`.
	const undertakingId = undertakings[0]!.id;
	const fp = createHash('sha256').update(undertakingId, 'utf8').digest('hex').slice(0, 16);
	const workspace = resolve(join(`${demoDb}.workspaces`, `${undertakingId}-${fp}`));
	const expectedMatrix: RecordedCell[] = (matrix as unknown[]).map((c) => {
		const r = rec(c);
		return {
			stage: str(r.stage),
			row: str(r.row),
			value: typeof r.value === 'string' ? r.value : null
		};
	});
	const built = buildRecording({
		store,
		content: readContentBytes(archive),
		units,
		workspace,
		home,
		captures: capturesOf(archive),
		expectedMatrix,
		commit,
		reviewerFingerprint: fingerprint
	});
	if (built.recording === null) {
		say(
			`refused, and nothing was written — the run cannot be read whole into a recording:\n  ${built.problems.join('\n  ')}`
		);
		return 1;
	}

	// ── CHECK THE WRITES (`REG-F-530`'s inference) ────────────────────────────────────────────────────────────────────
	const scratch = mkdtempSync(join(tmpdir(), 'jpwb-record-replay-'));
	let checks: ReturnType<typeof verifyWrites>;
	try {
		checks = verifyWrites(
			built.recording,
			units,
			(name) =>
				isDirectory(join(run, 'lane', 'archive', name, 'workspace'))
					? join(run, 'lane', 'archive', name, 'workspace')
					: null,
			built.pairs,
			join(scratch, 'workspace')
		);
	} finally {
		rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
	}
	for (const c of checks)
		say(
			`writes replayed through ${c.archive}: ${c.match === null ? 'no archived workspace to hold them to' : c.match ? 'the workspace tree matches' : `the workspace tree DIFFERS (${c.differing.length} file(s): ${c.differing.slice(0, 8).join(', ')})`}`
		);
	if (checks.some((c) => c.match === false)) {
		say(
			'refused, and nothing was written: the recorded write_file calls do not rebuild the archived workspace (REG-F-530)'
		);
		return 1;
	}

	// ── SCAN, THEN WRITE ─────────────────────────────────────────────────────────────────────────────────────────────────
	const files = recordingFiles(built.recording);
	const hits: ScanHit[] = Object.entries(files).flatMap(([file, text]) =>
		scanText(text, file, names)
	);
	if (hits.length > 0) {
		say(
			`refused, and nothing was written: the recording names the account or an absolute path (REG-F-536):\n  ` +
				hits
					.slice(0, 40)
					.map((h) => `${h.file}:${h.line}:${h.column} ${h.kind}`)
					.join('\n  ') +
				(hits.length > 40 ? `\n  … ${hits.length - 40} more` : '')
		);
		return 1;
	}
	mkdirSync(out, { recursive: true });
	for (const [file, text] of Object.entries(files))
		writeFileSync(join(out, file), text, { flag: 'wx' });
	const r = built.recording;
	say(
		`wrote ${Object.keys(files).length} files: ${r.executor.length} executor tries, ${r.commands.length} commands, ` +
			`${r.reviewer.length} reviewer calls, ${r.manifest.expectedMatrix.length} matrix cells`
	);
	return 0;
}

if (import.meta.main)
	process.exitCode = main(process.argv.slice(2), (s) => process.stdout.write(s));
