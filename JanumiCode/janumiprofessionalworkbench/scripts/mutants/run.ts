// The MUTATION RUNNER — JAN-VERIF V-1. `bun run mutants`
//
// Applies each mutant in `ledger.ts`, runs ONLY the suites that mutant claims it reddens, restores the file, and
// verifies the tree is clean again. Four verdicts, three of which are failures (see the ledger's header).
//
// IT RUNS UNDER SOURCE RESOLUTION, AND THAT IS THE WHOLE REASON V-0 CAME FIRST. Cross-package tests otherwise
// read the built `dist`, so a `rph-domain` mutant validated by an `rph-application` suite is silently
// meaningless — that produced a FALSE GREEN twice in one working session, and the second adversarial review
// flagged it as unaccounted-for in its own method. The root `vitest.config.ts` aliases every `@janumipwb/*`
// specifier to `src`, so no rebuild is needed and the trap cannot recur here BY CONSTRUCTION rather than by
// remembering.
//
// SAFETY. The file is restored in a `finally`, and the run ABORTS if `git status --porcelain` is not clean at
// the end — a mutation harness that leaves a mutant behind is worse than none, and one of the review agents in
// this repo did exactly that mid-run.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DECLARED_MUTANTS, type DeclaredMutant } from './ledger.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Records the mutant currently applied, so a KILLED run can be recovered from. See `recoverAbandonedMutant`. */
const JOURNAL = `${ROOT}scripts/mutants/.in-flight`;

type Verdict =
	| 'KILLED'
	| 'SURVIVED'
	| 'UNANCHORED'
	| 'RETIRED'
	| 'TYPE_PREVENTED'
	| 'NO_COMPILE'
	| 'KILLED_UNNAMED';

interface Result {
	readonly mutant: DeclaredMutant;
	readonly verdict: Verdict;
	readonly detail: string;
}

const sh = (cmd: string, args: readonly string[]) =>
	spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: true });

/** Is the working tree clean? The harness must never leave a mutant behind. */
function treeIsClean(): boolean {
	const r = sh('git', ['status', '--porcelain', '--', 'packages', 'apps', 'verif']);
	return (r.stdout ?? '').trim() === '';
}

function runMutant(m: DeclaredMutant): Result {
	// RETIRED is decided BEFORE anything is applied. A mutant whose target the code legitimately removed is
	// history, not a run: attempting it would report UNANCHORED or NO_COMPILE depending on whether its `find` or
	// its `replace` referenced the removed code, which is an implementation detail of the rot rather than a fact
	// about the guard.
	if (m.supersededBy !== undefined)
		return {
			mutant: m,
			verdict: 'RETIRED',
			detail: `superseded by ${m.supersededBy.split(' —')[0]}`
		};

	const abs = `${ROOT}${m.file}`;
	let original: string;
	try {
		original = readFileSync(abs, 'utf8');
	} catch {
		return { mutant: m, verdict: 'UNANCHORED', detail: `file not found: ${m.file}` };
	}

	// The anchor must be UNIQUE. Zero occurrences means the code moved out from under a declared mutation;
	// several means the mutation is ambiguous and would land somewhere nobody chose. Both are ledger rot, and
	// both are the verdict this codebase most needed — two register mutations had silently become unapplicable.
	const hits = original.split(m.find).length - 1;
	if (hits !== 1)
		return {
			mutant: m,
			verdict: 'UNANCHORED',
			detail: hits === 0 ? 'anchor text is GONE' : `anchor occurs ${hits}x — ambiguous`
		};

	// A mutant with NO NAMED VICTIM is still worth running, against a weaker claim. Most of the mutants inherited
	// from JAN-EXECREM WP-2..WP-15 are in this state: their work packages declared the mutation but never said WHICH
	// test reddens. That is itself a records defect, and it is reported separately in the summary.
	//
	// Running the whole PACKAGE tells us whether the guard is tested AT ALL; it cannot say which test does it, so
	// the verdict is KILLED_UNNAMED rather than KILLED. Weaker evidence, honestly labelled, beats no evidence — and
	// it beats GUESSING a victim, which is precisely how a mutant comes to "pass" for the wrong reason.
	const unnamed = m.expectRed.length === 0;
	const target = unnamed ? [pkgOf(m.file)] : [...m.expectRed];

	writeFileSync(JOURNAL, m.file, 'utf8');
	writeFileSync(abs, original.replace(m.find, m.replace), 'utf8');
	try {
		// Typecheck the mutated tree first. A mutant that does not compile never reached the code, so a RED test
		// run would be measuring the compiler, not the guard — an easy and flattering mistake.
		const types = sh('bunx', ['tsc', '--noEmit', '-p', `${pkgOf(m.file)}/tsconfig.json`]);
		// A mutant may be declared as EXPECTED not to compile (`expectNoCompile`). For those, refusing to typecheck
		// IS the guarantee: the defect is UNEXPRESSIBLE rather than merely caught, which is stronger — a test can be
		// deleted, a type cannot be worked around without a deliberate signature change. A mutant that suddenly
		// COMPILES is then the finding, because the type-level guarantee has been lost.
		if (m.expectNoCompile !== undefined)
			return types.status !== 0
				? { mutant: m, verdict: 'TYPE_PREVENTED', detail: `${m.expectNoCompile.slice(0, 88)}…` }
				: {
						mutant: m,
						verdict: 'SURVIVED',
						detail: 'declared type-prevented, but it COMPILES — the type-level guarantee is gone'
					};
		if (types.status !== 0)
			return {
				mutant: m,
				verdict: 'NO_COMPILE',
				detail: firstLine(types.stdout ?? types.stderr ?? '')
			};

		const run = sh('bunx', ['vitest', 'run', ...target]);
		const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
		if (run.status === 0) return { mutant: m, verdict: 'SURVIVED', detail: summarise(out) };
		return { mutant: m, verdict: unnamed ? 'KILLED_UNNAMED' : 'KILLED', detail: summarise(out) };
	} finally {
		writeFileSync(abs, original, 'utf8');
		rmSync(JOURNAL, { force: true });
	}
}

/** `packages/rph-domain/src/x.ts` -> `packages/rph-domain`. */
const pkgOf = (file: string): string => file.split('/').slice(0, 2).join('/');
const firstLine = (s: string): string =>
	(s.split('\n').find((l) => l.includes('error')) ?? s).trim().slice(0, 160);
const summarise = (s: string): string =>
	(s.split('\n').findLast((l) => l.includes('Tests ')) ?? '')
		.replaceAll(new RegExp(String.raw`\[[0-9;]*m`, 'g'), '')
		.trim();

// ── CRASH RECOVERY, added after this runner LOST a mutant ────────────────────────────────────────────────────
//
// The `finally` restore and the end-of-run cleanliness check are both defeated by EXTERNAL TERMINATION: a
// 10-minute command timeout killed a full 90-mutant run mid-mutant and left `validateStepCompletion`'s
// contradictory-cell guard mutated to `if (false && …)` in the working tree. Every subsequent test run would have
// been GREEN against a disabled guard — the precise failure mode this harness exists to prevent, produced by the
// harness itself.
//
// So the in-flight mutant is journalled to disk BEFORE it is applied and cleared after it is restored. A later
// run finds the journal, restores from git, and refuses to continue until the tree is clean. A `finally` is not a
// guarantee when the process can be killed; a file on disk survives.
function recoverAbandonedMutant(): void {
	if (!existsSync(JOURNAL)) return;
	const file = readFileSync(JOURNAL, 'utf8').trim();
	console.error(
		`RECOVERING: a previous run was killed while ${file} was mutated. Restoring from git.`
	);
	sh('git', ['checkout', '--', file]);
	rmSync(JOURNAL, { force: true });
}

recoverAbandonedMutant();

if (!treeIsClean()) {
	console.error('ABORT: working tree is not clean — refusing to mutate over uncommitted changes.');
	process.exit(2);
}

const only = process.argv[2];
const selected = only ? DECLARED_MUTANTS.filter((m) => m.id.includes(only)) : DECLARED_MUTANTS;
console.log(`Running ${selected.length} declared mutant(s) under SOURCE resolution.\n`);

const results: Result[] = [];
for (const m of selected) {
	const r = runMutant(m);
	results.push(r);
	console.log(`${r.verdict.padEnd(11)} ${m.id.padEnd(34)} ${r.detail}`);
}

if (!treeIsClean()) {
	console.error('\nFAIL: the working tree is DIRTY after the run — a mutant was left behind.');
	process.exit(2);
}

const by = (v: Verdict) => results.filter((r) => r.verdict === v);
console.log('\n=== MUTATION LEDGER SUMMARY ===');
for (const v of [
	'KILLED',
	'TYPE_PREVENTED',
	'RETIRED',
	'SURVIVED',
	'UNANCHORED',
	'NO_COMPILE',
	'KILLED_UNNAMED'
] as const)
	console.log(`${v.padEnd(11)} ${by(v).length}`);

for (const r of [...by('SURVIVED'), ...by('UNANCHORED'), ...by('NO_COMPILE')])
	console.log(
		`\n${r.verdict}: ${r.mutant.id}\n  guard: ${r.mutant.why}\n  from:  ${r.mutant.source}\n  ${r.detail}`
	);

// ADVISORY on this first run, by explicit decision (JAN-VERIF-DR-001 §3): the point of building it was to SIZE
// the rot honestly, and a ledger inherited from eighteen work packages is expected to contain entries the code
// has moved past. Every one gets triaged and recorded, never deleted to make the run green. Set
// MUTANTS_BLOCKING=1 (and the gate does, from V-2 onward) to make SURVIVED and UNANCHORED fail the build.
const blocking = process.env.MUTANTS_BLOCKING === '1';
const unnamedVictims = by('KILLED_UNNAMED').length;
if (unnamedVictims > 0)
	console.log(
		`
${unnamedVictims} mutant(s) had NO NAMED VICTIM and were run package-wide. That is a records defect in ` +
			`the work packages that declared them: "something caught it" is a weaker claim than "this named test ` +
			`caught it", and only the latter survives a refactor of the suite.`
	);

const failures = by('SURVIVED').length + by('UNANCHORED').length + by('NO_COMPILE').length;
if (failures > 0)
	console.log(
		`\n${failures} mutant(s) need attention. ${blocking ? 'BLOCKING.' : 'Advisory on this run — see the note in run.ts.'}`
	);
process.exit(blocking && failures > 0 ? 1 : 0);
