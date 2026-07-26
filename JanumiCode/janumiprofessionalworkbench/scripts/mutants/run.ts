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
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DECLARED_MUTANTS, type DeclaredMutant } from './ledger.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

type Verdict =
	'KILLED' | 'SURVIVED' | 'UNANCHORED' | 'RETIRED' | 'TYPE_PREVENTED' | 'NO_COMPILE' | 'NO_TARGET';

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

	if (m.expectRed.length === 0)
		return {
			mutant: m,
			verdict: 'NO_TARGET',
			detail: 'declared with no suite it claims to redden'
		};

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

		const run = sh('bunx', ['vitest', 'run', ...m.expectRed]);
		const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
		return run.status !== 0
			? { mutant: m, verdict: 'KILLED', detail: summarise(out) }
			: { mutant: m, verdict: 'SURVIVED', detail: summarise(out) };
	} finally {
		writeFileSync(abs, original, 'utf8');
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
	'NO_TARGET'
] as const)
	console.log(`${v.padEnd(11)} ${by(v).length}`);

for (const r of [...by('SURVIVED'), ...by('UNANCHORED'), ...by('NO_TARGET'), ...by('NO_COMPILE')])
	console.log(
		`\n${r.verdict}: ${r.mutant.id}\n  guard: ${r.mutant.why}\n  from:  ${r.mutant.source}\n  ${r.detail}`
	);

// ADVISORY on this first run, by explicit decision (JAN-VERIF-DR-001 §3): the point of building it was to SIZE
// the rot honestly, and a ledger inherited from eighteen work packages is expected to contain entries the code
// has moved past. Every one gets triaged and recorded, never deleted to make the run green. Set
// MUTANTS_BLOCKING=1 (and the gate does, from V-2 onward) to make SURVIVED and UNANCHORED fail the build.
const blocking = process.env.MUTANTS_BLOCKING === '1';
const failures =
	by('SURVIVED').length +
	by('UNANCHORED').length +
	by('NO_TARGET').length +
	by('NO_COMPILE').length;
if (failures > 0)
	console.log(
		`\n${failures} mutant(s) need attention. ${blocking ? 'BLOCKING.' : 'Advisory on this run — see the note in run.ts.'}`
	);
process.exit(blocking && failures > 0 ? 1 : 0);
