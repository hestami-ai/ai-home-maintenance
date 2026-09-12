/**
 * mutants:changed — CHANGE-SCOPED MUTATION. `bun run scripts/mutants/scope.ts [--run] [--strict] [--range=A..B]`
 *
 * ── THE QUESTION THIS ANSWERS, AND WHY THE WHOLE-LEDGER RUN CANNOT ─────────────────────────────────────────
 * `bun run mutants` is an AUDIT: every declared mutant, ~13 minutes, run when someone remembers. It answers
 * "is the ledger still sound?". It does not answer the question a coding agent actually has, which the sponsor
 * put as: *"what could we base it on that enables feedback to coding agents when something that is changed
 * breaks something else that needs to be flagged loudly as such?"*
 *
 * The basis is the CHANGE, not the file: **for the region a diff actually touches, is there a declared guard
 * over it, and does that guard still discriminate after the change?**
 *
 * ⭑ IT IS A SELECTION PROBLEM, NOT A NEW ENGINE. Every measurable ledger entry resolves to an exact
 * `(file, line-range, named-victim)` triple — 238 of 238 when first measured — so a `git diff` can be
 * intersected with the ledger directly, and `run.ts` already takes ids as argv filters.
 *
 * ── TWO SIGNALS, AND THEY MUST NEVER SHARE AN EXIT CODE OR A MESSAGE ───────────────────────────────────────
 *   exit 1  BROKEN GUARANTEE — a guard over the changed region SURVIVED its mutant. The test that used to
 *           discriminate here no longer does, and the suite is GREEN. This is the "changed X, broke Y" signal.
 *   exit 3  UNGUARDED CHANGE — the changed region has no declared guard at all. Nothing has ever tried to
 *           break this line.
 * ⚠ One says *you broke something*; the other says *nothing was watching*. Collapsing them into one exit code
 * would reproduce the defect this programme exists to remove.
 *
 * ── WHY THE ABSENCE SIGNAL IS ADVISORY BY DEFAULT, STATED RATHER THAN SLIPPED IN ───────────────────────────
 * 75 of 106 production files carry no guard. Making "you touched an unguarded line" BLOCK today would demand
 * ~192 declared guards before anyone could land an edit — introducing a ratchet and demanding the work in one
 * act, which `R3` exists to do gradually and which this roadmap forbids. So it REPORTS and returns 0 unless
 * `--strict`. ⛔ AND THE TRIGGER FOR FLIPPING IT IS NAMED, because "advisory" is how a records defect becomes
 * permanent: when `R3`'s burn-down reaches zero unguarded production-consumed exports, `--strict` becomes the
 * default and this paragraph is deleted.
 *
 * ── ⚠ THE LIMIT, DISCLOSED ON EVERY RUN AND NOT ONLY HERE ──────────────────────────────────────────────────
 * Diff-intersection catches the LOCAL case: change `A`, a guard over `A` goes slack. It does NOT catch
 * *change `A`, and a guard over `B` goes slack* — the diff never selects `B`'s mutant. Catching that needs
 * per-test coverage attribution this repository does not collect. A guarantee described as catching what it
 * cannot catch is worse than an absent one, so the banner prints every time.
 *
 * ── ⛔ IT IS NOT A `gate:fast` STEP, AND THAT IS DELIBERATE ────────────────────────────────────────────────
 * The gate runs on a tree whose changes are already committed, where `git diff HEAD` is empty and this command
 * would have nothing to say. It belongs in the EDIT loop, which is where the feedback is worth having.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DECLARED_MUTANTS, type DeclaredMutant } from './ledger.js';
import {
	anchorRange,
	classifyRunnerTranscript,
	isProductionPath,
	overlaps,
	parseUnifiedDiff,
	type Hunk
} from './scope-core.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const flags = process.argv.slice(2);
const RUN = flags.includes('--run');
const STRICT = flags.includes('--strict');
const rangeFlag = flags.find((f) => f.startsWith('--range='));
const RANGE = rangeFlag?.slice('--range='.length);

/** Entries a verdict can be had about — `supersededBy`/`duplicateOf` are history, not measurements. */
const MEASURABLE = DECLARED_MUTANTS.filter(
	(m) => m.supersededBy === undefined && m.duplicateOf === undefined
);

interface Anchor {
	readonly mutant: DeclaredMutant;
	readonly file: string;
	readonly startLine: number;
	readonly endLine: number;
}

/** Where a mutant's `find` actually sits, in lines. An anchor that is absent or ambiguous is REPORTED, not skipped. */
function locate(m: DeclaredMutant): Anchor | string {
	const path = `${ROOT}${m.file}`;
	if (!existsSync(path)) return `${m.id}: target file ${m.file} is not on disk`;
	const r = anchorRange(readFileSync(path, 'utf8'), m.find);
	if (typeof r === 'string') return `${m.id}: ${r} in ${m.file}`;
	return { mutant: m, file: m.file, startLine: r.startLine, endLine: r.endLine };
}

function changedHunks(): Hunk[] {
	// `--relative` makes git report paths relative to THIS package rather than the monorepo root, so they line
	// up with the ledger's `file` fields without string surgery.
	const args = ['diff', '--unified=0', '--no-color', '--relative'];
	if (RANGE !== undefined) args.push(RANGE);
	else args.push('HEAD'); // worktree AND index against the last commit — what an agent has actually changed
	const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
	if (r.status !== 0 && r.status !== 1) {
		process.stderr.write(`mutants:changed — git diff failed: ${r.stderr ?? ''}\n`);
		process.exit(2);
	}
	return parseUnifiedDiff(r.stdout ?? '');
}

const hits = (a: Anchor, h: Hunk) => overlaps(a.file, a, h);

// ── build the picture ───────────────────────────────────────────────────────────────────────────────────────
const anchors: Anchor[] = [];
const unlocatable: string[] = [];
for (const m of MEASURABLE) {
	const a = locate(m);
	if (typeof a === 'string') unlocatable.push(a);
	else anchors.push(a);
}

const hunks = changedHunks();
const productionHunks = hunks.filter((h) => isProductionPath(h.file));

const selected = anchors.filter((a) => productionHunks.some((h) => hits(a, h)));
const guardedHunks = productionHunks.filter((h) => anchors.some((a) => hits(a, h)));
const unguardedHunks = productionHunks.filter((h) => !anchors.some((a) => hits(a, h)));

process.stdout.write(
	`mutants:changed — ${hunks.length} changed hunk(s), ${productionHunks.length} in production source.\n`
);
if (unlocatable.length > 0) {
	// A ledger that has rotted cannot be used to decide what is guarded, so this is loud and it is NOT the
	// absence signal — it is the instrument reporting that it cannot see.
	process.stderr.write(
		`⛔ LEDGER ROT — ${unlocatable.length} declared mutant(s) no longer anchor, so coverage of the diff cannot be decided:\n` +
			unlocatable.map((u) => `  ${u}\n`).join('')
	);
	process.exit(2);
}

if (productionHunks.length === 0) {
	// ⛔ NOT "all clear". Saying nothing changed when nothing was examined is the reader-blinded failure.
	process.stdout.write(
		'mutants:changed — NO PRODUCTION CHANGES EXAMINED. This is not a pass: there was nothing to decide.\n'
	);
	process.exit(0);
}

process.stdout.write(
	`  guarded regions:   ${guardedHunks.length}\n` +
		`  unguarded regions: ${unguardedHunks.length}\n` +
		`  guards selected:   ${selected.length}\n`
);

for (const a of selected)
	process.stdout.write(`    GUARD  ${a.file}:${a.startLine}-${a.endLine}  ${a.mutant.id}\n`);

let exitCode = 0;

// ── SIGNAL 2 — UNGUARDED CHANGE ─────────────────────────────────────────────────────────────────────────────
if (unguardedHunks.length > 0) {
	const lines = unguardedHunks.map((h) => `    NO DECLARED GUARD  ${h.file}:${h.startLine}-${h.endLine}\n`);
	process.stdout.write(
		`\n⛔ UNGUARDED CHANGE — nothing in this repository has ever tried to break these regions:\n${lines.join('')}`
	);
	if (STRICT) exitCode = 3;
	else
		process.stdout.write(
			'  (advisory: R3 is the programme that reduces this population. Re-run with --strict to fail on it.)\n'
		);
}

// ── SIGNAL 1 — BROKEN GUARANTEE ─────────────────────────────────────────────────────────────────────────────
if (RUN && selected.length > 0) {
	const r = spawnSync('bun', ['run', `${ROOT}scripts/mutants/run.ts`, ...selected.map((a) => a.mutant.id)], {
		cwd: ROOT,
		encoding: 'utf8',
		shell: true
	});
	const transcript = `${r.stdout ?? ''}${r.stderr ?? ''}`;
	process.stdout.write(transcript);

	// ⛔ A NON-ZERO EXIT FROM THE RUNNER MEANS SEVERAL DIFFERENT THINGS, AND EXACTLY ONE OF THEM IS A FINDING.
	//
	// This block first read `r.status !== 0` alone and reported BROKEN GUARANTEE when the runner had ABORTED on
	// a dirty tree — announcing a broken guarantee about a mutation that was never applied. That is the
	// could-not-measure / measured-a-failure conflation this programme exists to remove, committed inside the
	// feature built to remove it, and it was caught only by running the thing rather than reasoning about it.
	//
	// ⭑ SO A VERDICT IS ONLY CLAIMED WHEN THE RUNNER DEMONSTRABLY REACHED ONE: its summary banner must be in the
	// transcript. Anything else is the instrument reporting that it could not work, and exits 2.
	const outcome = classifyRunnerTranscript(transcript, r.status);

	if (outcome === 'INSTRUMENT_DID_NOT_RUN') {
		process.stderr.write(
			'\n⛔ INSTRUMENT DID NOT RUN — no verdict is available, and none is being claimed.\n' +
				(/^ABORT:/m.test(transcript)
					? '   The runner refuses to mutate a tree that does not match a stable staged index baseline,\n' +
						'   because a mutation left behind is worse than none. STAGE your changes and re-run:\n' +
						'     git add -- <the files you changed>   &&   bun run mutants:changed --run\n'
					: '   The runner produced no verdict summary. Its output is above.\n') +
				'   ⚠ THIS IS NOT THE BROKEN-GUARANTEE SIGNAL. Nothing was measured, so nothing is asserted.\n'
		);
		exitCode = 2;
	} else if (outcome === 'BROKEN_GUARANTEE') {
		process.stderr.write(
			'\n⛔ BROKEN GUARANTEE — a guard over a region you changed no longer discriminates.\n' +
				'   The suite is green and the protection is gone. This is NOT the same as the unguarded-change\n' +
				'   signal above: that one says nothing was watching; this one says something WAS and no longer is.\n'
		);
		exitCode = 1;
	}
}

process.stdout.write(
	'\n⚠ LIMIT: this intersects the DIFF with the ledger, so it catches "changed A, broke A\'s guard".\n' +
		'  It does NOT catch "changed A, broke B\'s guard" — that needs per-test coverage attribution this\n' +
		'  repository does not collect. Do not read a clean run as "nothing downstream broke".\n'
);

process.exit(exitCode);
