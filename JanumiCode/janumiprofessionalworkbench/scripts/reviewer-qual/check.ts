/**
 * ⭐ `JAN-CRITREAD` J2-3 — `bun run reviewer:qual:check`: is today's reviewer covered, does the record reproduce, and is
 * every material failure written up? (DESIGN-what-the-tests-prove.md §5.6; ROADMAP J2-3 + J2-4.)
 *
 *   bun --conditions=source scripts/reviewer-qual/check.ts [--records <dir>] [--register <file>]
 *
 * A static check that runs no model: the limbs are `check-core.ts`'s; this reads the record's top-level `*.ndjson`
 * files that git tracks, exactly as staged (`trackedRecord`), today's case set and oracles, and the register's
 * findings, computes today's reviewer fingerprint with the one function the runner stamps with (`fingerprint.ts`), and
 * re-scores through the runner's own path (`rescore.ts`).
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
 */
import { SOURCE_PROBE, sourceResolutionProblem } from './preflight.js';

/** The register the findings an ESCALATION or SUPERSEDED line cites must exist in. */
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

type TrackedRecord = {
	readonly files: { readonly name: string; readonly text: string }[];
	readonly refused: { readonly name: string; readonly why: string }[];
};

/**
 * ⭐ `JAN-CRITREAD` J2-3 — THE RECORD IS WHAT GIT WOULD COMMIT. Each top-level `*.ndjson` in `dir` is read only when git
 * tracks it and it is exactly what git has staged; one untracked, changed since it was staged, or staged but gone is
 * named as a problem and not read — so a check that is green here is green on the commit that carries these files.
 * A `dir` outside a git work tree is refused (a string): there is no committed record to speak for.
 */
async function trackedRecord(dir: string): Promise<TrackedRecord | string> {
	const [{ spawnSync }, { existsSync, readdirSync, readFileSync }, { join }] = await Promise.all([
		import('node:child_process'),
		import('node:fs'),
		import('node:path')
	]);
	if (!existsSync(dir)) return { files: [], refused: [] };
	const git = (args: readonly string[]) =>
		spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true });
	const listed = git(['ls-files', '-z', '--', '.']);
	if (listed.status !== 0)
		return `the record directory ${dir} is not in a git work tree, and only what git tracks is the record: ${(listed.stderr ?? String(listed.error)).trim()}`;
	const indexed = new Set(listed.stdout.split('\0').filter((f) => f.endsWith('.ndjson') && !f.includes('/')));
	const onDisk = new Set(
		readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isFile() && e.name.endsWith('.ndjson'))
			.map((e) => e.name)
	);
	const out: TrackedRecord = { files: [], refused: [] };
	const byCodeUnit = (a: string, b: string) => (a < b ? -1 : Number(a > b));
	for (const name of [...new Set([...onDisk, ...indexed])].sort(byCodeUnit)) {
		if (!indexed.has(name)) {
			out.refused.push({ name, why: 'git does not track it, so the committed record would not hold it — `git add` it, or remove it' });
			continue;
		}
		if (!onDisk.has(name)) {
			out.refused.push({ name, why: 'git tracks it, but it is gone from the working tree — a record file is struck, never deleted (§5.4)' });
			continue;
		}
		const text = readFileSync(join(dir, name), 'utf8');
		const staged = git(['show', `:./${name}`]);
		if (staged.status !== 0 || staged.stdout !== text)
			out.refused.push({ name, why: 'it differs from what git has staged, and the check reads what a commit would carry — `git add` it' });
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
	const [{ join }, { fileURLToPath }, cases, record, fingerprint, core, rescore] = await Promise.all([
		import('node:path'),
		import('node:url'),
		import('./cases.js'),
		import('./record.js'),
		import('./fingerprint.js'),
		import('./check-core.js'),
		import('./rescore.js')
	]);
	const { readFileSync } = await import('node:fs');
	const root = fileURLToPath(deps.root);
	const dir = args.records ?? join(root, record.RECORD_DIR);
	const read = await trackedRecord(dir);
	if (typeof read === 'string') {
		say(read);
		return 2;
	}
	// ⭐ The CURRENT set and its oracles (`cases.ts`, `JAN-CRITREAD` J2-5): the one pointer the runner reads too.
	const caseSet = fingerprint.committedCaseSet(deps.root);
	const oracles = JSON.parse(readFileSync(join(root, cases.CURRENT_ORACLES_FILE), 'utf8')) as import('./cases.js').OracleSet;
	const today = await fingerprint.reviewerFingerprint(caseSet.cases);
	const { findings, struck } = core.registerFindings(readFileSync(args.register ?? join(root, REGISTER_FILE), 'utf8'));
	const report = await core.checkQualification({
		files: read.files,
		refusedFiles: read.refused,
		current: today,
		cases: caseSet.cases,
		oracles: oracles.oracles,
		findings,
		struck,
		rescore: (run, c, calls, digest) => rescore.rescoreEvaluation(run, c, calls, digest)
	});
	say(
		`today's reviewer fingerprint ${today.reviewer} (scoring ${today.scoring}, case set ${today.caseSet}); ` +
			`${read.files.length} tracked record file(s) in ${dir}` +
			(read.refused.length > 0 ? ` and ${read.refused.length} not read` : '') +
			`; case set v${caseSet.caseSetVersion}, oracles v${oracles.oracleVersion}`
	);
	for (const n of report.notes) say(`note: ${n}`);
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
