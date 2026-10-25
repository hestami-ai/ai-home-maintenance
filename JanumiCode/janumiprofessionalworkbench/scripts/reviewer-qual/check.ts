/**
 * ⭐ `JAN-CRITREAD` J2-3 — `bun run reviewer:qual:check`: is today's reviewer covered, does the record reproduce, and is
 * every material failure written up? (DESIGN-what-the-tests-prove.md §5.6; ROADMAP J2-3 + J2-4.)
 *
 *   bun --conditions=source scripts/reviewer-qual/check.ts [--records <dir>] [--register <file>]
 *
 * A static check that runs no model: the limbs are `check-core.ts`'s; this reads the record's top-level `*.ndjson`
 * files that git tracks, exactly as staged (~~`trackedRecord`~~ `trackedFiles`), today's case set and oracles, and the
 * register's findings, computes today's reviewer fingerprint with the one function the runner stamps with (`fingerprint.ts`),
 * and re-scores through the runner's own path (`rescore.ts`). ⭐⭐ D3c (`REG-D-132`) — it reads every committed case set beside
 * today's, from the same directory, ~~as it reads every oracle set~~ ⭐ as it reads the record — a file git tracks, exactly as
 * staged, one it will not read a RECORD problem naming it (package J's check, item 2): an ACKNOWLEDGED line is held to one of them.
 * Exit 0 green, 1 red, 2 refused before checking anything.
 *
 * ⛔ IT READS SOURCE (`REG-D-072` D11), decided here as the runner decided it (`REG-D-074`): under bare `bun` every
 * `@janumipwb/*` package resolves to its built `dist`, stale after any source edit, and a fingerprint computed from a
 * stale build would call a record current that is not. So it runs under `bun --conditions=source`, and refuses to run
 * on anything else — before it loads anything that reaches a package.
 *
 * ⚠ WHAT IT IS AND IS NOT (§5.6): *"never the guarantee"* (`DOC-004:258`) — nothing runs it but a person running the
 * gate. It cannot tell that replies came from the model named, nor that a run happened at all rather than a well-formed
 * record being written. And it never forces a reviewer to be good: once today's reviewer is covered and every failure
 * is written up, it is green whatever the runs found.
 *
 * ⭐ `JAN-CRITREAD` J2-6 — it also PRINTS attribution (`REG-D-080`): per record, the planted criterion named in N of M
 * answered planted evaluations — the planted evaluations of cases outside today's set counted out aloud, by every
 * oracle version on file — each miss, and the criterion-level transitions. That is reported, never escalated: the
 * verdict is the pass bar.
 *
 * ⭐ `JAN-SELREV` SR-4 — its header NAMES THE SELECTION IN FORCE, when the record holds one (`REG-D-086`): the selected
 * candidate, the ruling it rests on — WITHDRAWN or NOT HELD beside it when the register says so — and where the line is.
 * Coverage then holds every current case to a measurement of that candidate under today's fingerprint too
 * (`check-core.ts`). With none, the header says nothing of it.
 */
import { SOURCE_PROBE, sourceResolutionProblem } from './preflight.js';

/** The register the findings an ESCALATION or SUPERSEDED line cites, and the ruling a SELECTION cites, must exist in. */
export const REGISTER_FILE = 'docs/canon/JPWB-REG-005 Decision and Divergence Register.md';

export interface CheckCliDeps {
	/** `import.meta.resolve`. */
	readonly resolve: (specifier: string) => string;
	readonly write: (text: string) => void;
	/** The repository root, as a `file:` URL ending in `/`. */
	readonly root: URL;
}

/** ⛔ CLOSED: a misspelt flag would otherwise be dropped in silence, and the committed record checked in its place. */
const FLAGS: ReadonlySet<string> = new Set(['records', 'register']);

type TrackedFiles = {
	readonly files: { readonly name: string; readonly text: string }[];
	readonly refused: { readonly name: string; readonly why: string }[];
};

/** ⭐ Package J's check, item 2 — what the check says of a committed file it will not read, by why it will not. */
interface NotRead {
	/** `dir` is outside any git work tree: what is refused, before git's own words. */
	readonly outside: (dir: string) => string;
	readonly untracked: string;
	readonly gone: string;
	readonly changed: string;
}
/** `JAN-CRITREAD` J2-3 — the record's top-level `*.ndjson` files. */
const RECORD_FILES: NotRead = {
	outside: (dir) => `the record directory ${dir} is not in a git work tree, and only what git tracks is the record`,
	untracked: 'git does not track it, so the committed record would not hold it — `git add` it, or remove it',
	gone: 'git tracks it, but it is gone from the working tree — a record file is struck, never deleted (§5.4)',
	changed: 'it differs from what git has staged, and the check reads what a commit would carry — `git add` it'
};
/** ⭐⭐ D3c, package J's check item 2 — the committed case sets, each version's `*.json`: an ACKNOWLEDGED line is held to one. */
const CASE_SET_FILES: NotRead = {
	outside: (dir) => `the case directory ${dir} is not in a git work tree, and only a case set git tracks is committed`,
	untracked:
		'git does not track it, so no commit holds this case set, and an ACKNOWLEDGED line is held only to a committed one (design D3c) — `git add` it, or remove it',
	gone: 'git tracks it, but it is gone from the working tree, and the check reads what a commit would carry — restore it, or `git rm` it',
	changed:
		'it differs from what git has staged, and the check holds an ACKNOWLEDGED line only to what a commit would carry (design D3c) — `git add` it'
};

/**
 * ⭐ `JAN-CRITREAD` J2-3 — THE RECORD IS WHAT GIT WOULD COMMIT. Each top-level ~~`*.ndjson`~~ file of `extension` in `dir` is
 * read only when git tracks it and it is exactly what git has staged; one untracked, changed since it was staged, or staged but
 * gone is named as a problem and not read — so a check that is green here is green on the commit that carries these files.
 * A `dir` outside a git work tree is refused (a string): there is no committed record to speak for.
 * ⭐ Package J's check, item 2 (the lead's ruling, 2026-10-25) — AND SO ARE THE COMMITTED CASE SETS (D3c): ~~every `*.json` in the
 * case directory as it stands, untracked files included~~, read by this one reader, each told why it is not read (`NotRead`).
 */
async function trackedFiles(dir: string, extension: string, notRead: NotRead): Promise<TrackedFiles | string> {
	const [{ spawnSync }, { existsSync, readdirSync, readFileSync }, { join }] = await Promise.all([
		import('node:child_process'),
		import('node:fs'),
		import('node:path')
	]);
	if (!existsSync(dir)) return { files: [], refused: [] };
	const git = (args: readonly string[]) =>
		spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true });
	const listed = git(['ls-files', '-z', '--', '.']);
	if (listed.status !== 0) return `${notRead.outside(dir)}: ${(listed.stderr ?? String(listed.error)).trim()}`;
	const indexed = new Set(listed.stdout.split('\0').filter((f) => f.endsWith(extension) && !f.includes('/')));
	const onDisk = new Set(
		readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isFile() && e.name.endsWith(extension))
			.map((e) => e.name)
	);
	const out: TrackedFiles = { files: [], refused: [] };
	const byCodeUnit = (a: string, b: string) => (a < b ? -1 : Number(a > b));
	for (const name of [...new Set([...onDisk, ...indexed])].sort(byCodeUnit)) {
		if (!indexed.has(name)) {
			out.refused.push({ name, why: notRead.untracked });
			continue;
		}
		if (!onDisk.has(name)) {
			out.refused.push({ name, why: notRead.gone });
			continue;
		}
		const text = readFileSync(join(dir, name), 'utf8');
		const staged = git(['show', `:./${name}`]);
		if (staged.status !== 0 || staged.stdout !== text) out.refused.push({ name, why: notRead.changed });
		else out.files.push({ name, text });
	}
	return out;
}

export async function main(argv: readonly string[], deps: CheckCliDeps): Promise<number> {
	const say = (s: string) => deps.write(`reviewer:qual:check — ${s}\n`);
	const d11 = sourceResolutionProblem(deps.resolve(SOURCE_PROBE));
	if (d11) {
		say(d11.replace('scripts/reviewer-qual/run.ts', 'scripts/reviewer-qual/check.ts'));
		return 2;
	}
	const args: Record<string, string> = {};
	for (let i = 0; i < argv.length; i += 2) {
		const flag = argv[i]!;
		const value = argv[i + 1];
		if (!flag.startsWith('--') || value === undefined) {
			say(`usage: expected --flag value pairs, at "${flag}"`);
			return 2;
		}
		if (!FLAGS.has(flag.slice(2))) {
			say(`usage: unknown flag ${flag}`);
			return 2;
		}
		args[flag.slice(2)] = value;
	}
	// ⭐ Only now — past D11 — is anything that reaches a package loaded.
	const [{ dirname, join }, { fileURLToPath }, cases, record, fingerprint, core, rescore] = await Promise.all([
		import('node:path'),
		import('node:url'),
		import('./cases.js'),
		import('./record.js'),
		import('./fingerprint.js'),
		import('./check-core.js'),
		import('./rescore.js')
	]);
	const { readdirSync, readFileSync } = await import('node:fs');
	const root = fileURLToPath(deps.root);
	const dir = args.records ?? join(root, record.RECORD_DIR);
	const read = await trackedFiles(dir, '.ndjson', RECORD_FILES);
	if (typeof read === 'string') {
		say(read);
		return 2;
	}
	// ⭐ The CURRENT set and its oracles (`cases.ts`, `JAN-CRITREAD` J2-5): the one pointer the runner reads too.
	const caseSet = fingerprint.committedCaseSet(deps.root);
	const oracles = JSON.parse(readFileSync(join(root, cases.CURRENT_ORACLES_FILE), 'utf8')) as import('./cases.js').OracleSet;
	// ⭐ `JAN-CRITREAD` J2-6 — EVERY oracle version on file, beside the current one: a run's own version says which of its
	// cases outside today's set it planted, so the attribution report counts them out aloud (`REG-D-080`).
	const oracleDir = join(root, dirname(cases.CURRENT_ORACLES_FILE));
	const oracleSets = readdirSync(oracleDir)
		.filter((name) => name.endsWith('.json'))
		.map((name) => JSON.parse(readFileSync(join(oracleDir, name), 'utf8')) as import('./cases.js').OracleSet);
	// ⭐⭐ D3c (`REG-D-132`; `REG-F-576`) — EVERY case set version on file, beside the current one, read from the committed case
	// directory ~~as the current one is~~: an ACKNOWLEDGED line's ids are held to one of them, today's included.
	// ⭐ Package J's check, item 2 (the lead's ruling, 2026-10-25) — ~~every `*.json` there as it stands, untracked files
	// included~~ READ AS THE RECORD IS: a file git tracks, exactly as staged (`trackedFiles`), so an untracked or edited case-set
	// file holds no line, and each the check will not read is a RECORD problem naming it, as an untracked record file is.
	const caseDir = join(root, dirname(cases.CURRENT_CASE_SET_FILE));
	const committedCaseSets = await trackedFiles(caseDir, '.json', CASE_SET_FILES);
	if (typeof committedCaseSets === 'string') {
		say(committedCaseSets);
		return 2;
	}
	const caseSets = committedCaseSets.files
		.map((file) => JSON.parse(file.text) as import('./cases.js').CaseSet)
		.map((s) => ({ caseSetVersion: s.caseSetVersion, caseIds: s.cases.map((c) => c.id) }));
	const refusedCaseSets = committedCaseSets.refused.map((f) => ({
		name: `${dirname(cases.CURRENT_CASE_SET_FILE)}/${f.name}`,
		why: f.why
	}));
	const today = await fingerprint.reviewerFingerprint(caseSet.cases);
	const register = readFileSync(args.register ?? join(root, REGISTER_FILE), 'utf8');
	const { findings, struck } = core.registerFindings(register);
	const { rulings, struck: struckRulings } = core.registerRulings(register);
	const report = await core.checkQualification({
		files: read.files,
		// ⭐ Package J's check, item 2 — and the committed case-set files it would not read, each by its path in the repository.
		refusedFiles: [...read.refused, ...refusedCaseSets],
		current: today,
		cases: caseSet.cases,
		oracles: oracles.oracles,
		// ⭐ `E12F` F5 — the current oracles' conferral, which the check refuses while it reads PROPOSED (`REG-D-073`).
		conferral: oracles.conferral,
		oracleSets,
		caseSets,
		findings,
		struck,
		rulings,
		struckRulings,
		rescore: (run, c, calls, digest) => rescore.rescoreEvaluation(run, c, calls, digest)
	});
	say(
		`today's reviewer fingerprint ${today.reviewer} (scoring ${today.scoring}, case set ${today.caseSet}); ` +
			`${read.files.length} tracked record file(s) in ${dir}` +
			(read.refused.length > 0 ? ` and ${read.refused.length} not read` : '') +
			`; case set v${caseSet.caseSetVersion}, oracles v${oracles.oracleVersion}`
	);
	// ⭐ `JAN-SELREV` SR-4 — the SELECTION in force, named with the fingerprint it is held to (`REG-D-086`) — and, when
	// its ruling is withdrawn or not held, saying so beside the ruling: it is never named in force unqualified.
	const selection = report.selection;
	if (selection)
		say(
			`the SELECTION in force: ${selection.candidate.transport} / ${selection.candidate.modelLabel}, on ${selection.ruling}${core.rulingCaveat(selection.standing)} (${selection.at}) — every current case is owed its measurement under today’s fingerprint (REG-D-086)`
		);
	for (const n of report.notes) say(`note: ${n}`);
	// ⭐ `JAN-CRITREAD` J2-6 — the pass bar is the right verdict (`REG-D-080`): which criterion each planted case faulted,
	// and the criterion-level transitions, are printed here, whatever the verdict below, and never redden it.
	if (report.attribution.length > 0)
		say(
			'attribution against the oracles’ `faulted` lists, and the criterion-level transitions — reported, never a material failure (REG-D-080):'
		);
	for (const a of report.attribution) deps.write(`  ${a}\n`);
	if (report.problems.length === 0) {
		say('GREEN — today’s reviewer is covered, the record reproduces, and every material failure is escalated');
		return 0;
	}
	say(`RED — ${report.problems.length} problem(s):`);
	for (const p of report.problems) deps.write(`  [${p.limb}] ${p.message}\n`);
	return 1;
}

if (import.meta.main)
	process.exitCode = await main(process.argv.slice(2), {
		resolve: (s) => import.meta.resolve(s),
		write: (s) => process.stdout.write(s),
		root: new URL('../../', import.meta.url)
	});
