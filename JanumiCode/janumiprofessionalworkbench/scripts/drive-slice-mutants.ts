// JAN-SLICE-SWP-03 — drive every declared Slice mutant and report which clauses it actually reddens.
//
// ── WHY THIS IS A SCRIPT AND NOT A GATE ──────────────────────────────────────────────────────────────────────
// It MUTATES PRODUCTION SOURCE, one file at a time, and reverts. That is unsafe to run concurrently with anything
// (including itself), so it must never be part of `gate:fast`, which runs alongside the rest of the suite. It is
// an instrument the author runs deliberately, and its OUTPUT is what gets recorded.
//
// ── WHY THE MUTANT SET IS DERIVED AND NEVER TYPED OUT ────────────────────────────────────────────────────────
// Every mutant is read from the Slice declarations themselves, through the SAME parser the ledger uses
// (`parseSliceSource`). Hand-listing the mutants here would be the defect one level up: the list would be a claim
// about the Slices that nothing checks, and it would rot the first time a Slice gained a mutant. This repository
// has recorded that failure by name — a hand-written list said 2 where the derivation says 8.
//
// ── WHAT A PASS MEANS, AND WHAT IT DOES NOT ──────────────────────────────────────────────────────────────────
// For each mutant: apply it, run ONLY its own Slice, collect the set of test names that fail, revert. The mutant
// is SOUND when that set is non-empty AND every failing test corresponds to a clause the mutant NAMED in
// `expectRed`, and no other.
//
//   - An EMPTY red set means the mutant proves NOTHING. Two causes seen in this programme, and the report
//     distinguishes neither — the author must: the guard is not what the clause depends on, or the mutant is
//     inert by its own shape (a replacement that is a SUPERSTRING of its anchor cannot redden a `toContain`).
//   - A red set WIDER than `expectRed` means the mutant proves NONE of the clauses individually (`SL-3a`).
//   - ⚠ A mutant that fails to COMPILE also produces reds, and they are meaningless. Compilation failure surfaces
//     here as every test in the file failing at import — which is exactly the "wider than expectRed" signal, so
//     read a full-file red as "suspect the mutant does not build" before believing it proved anything.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSliceSource } from '../verif/slice-ledger.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPORT = '.slice-mutant-run.json';

interface Mutant {
	readonly id: string;
	readonly file: string;
	readonly find: string;
	readonly replace: string;
	readonly expectRed: readonly string[];
}

function sliceFiles(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) sliceFiles(p, acc);
		else if (name.endsWith('.slice.test.ts')) acc.push(p);
	}
	return acc;
}

/**
 * ⚠ THIS DRIVER COVERS THE **ENGINE** PLANE ONLY, AND IT NOW SAYS SO OUT LOUD INSTEAD OF SKIPPING IN SILENCE.
 *
 * Two independent narrowings put SURFACE Slices outside it: the walk starts at `packages/` (SURFACE Slices live
 * under `apps/<app>/e2e/`), and the filename test is `.slice.test.ts` (theirs is `.slice.e2e.ts`, a distinction
 * `REG-F-293` made load-bearing on purpose). Underneath both, `runSlice` shells **vitest**, which cannot run a
 * Playwright spec at all.
 *
 * Before `JAN-SLICE-SWP-06` that was harmless because no SURFACE Slice existed. The moment one did, this driver
 * would have walked its population, found every ENGINE mutant SOUND, and reported success — having driven ZERO
 * of the SURFACE mutants while looking exactly like a full sweep. **That is the shape this repository has
 * recorded most often: a predicate narrowed by a vocabulary split, still green on the half it can still see.**
 *
 * So the omission is made LOUD rather than repaired here: repairing it means teaching this script to shell
 * Playwright, which is a second runner with its own report shape and its own server lifecycle — a real change
 * that belongs to whoever needs SURFACE mutants in `gate:fast`, not to a silent `else if`. Until then, this
 * refuses to finish while a recognised SURFACE Slice declares mutants it did not drive.
 */
function undrivenSurfaceSlices(): { file: string; sliceId: string; mutants: number }[] {
	const surfaceDir = join(ROOT, 'apps', 'rph-demo', 'e2e', 'slices');
	let names: string[];
	try {
		names = readdirSync(surfaceDir);
	} catch {
		return; // no SURFACE Slices yet — nothing this driver is failing to cover
	}
	return names
		.filter((n) => n.endsWith('.slice.e2e.ts'))
		.map((n) => {
			const parsed = parseSliceSource(readFileSync(join(surfaceDir, n), 'utf8'), n);
			return {
				file: `apps/rph-demo/e2e/slices/${n}`,
				sliceId: String(parsed.declaration['id']),
				mutants: ((parsed.declaration['mutants'] ?? []) as Mutant[]).length
			};
		})
		.filter((s) => s.mutants > 0);
}


/**
 * Run one Slice and return the test names that FAILED.
 *
 * ⚠⚠ THE STALE-REPORT CONTROL IS THE MOST IMPORTANT THING IN THIS FUNCTION, AND IT IS HERE BECAUSE THIS
 * INSTRUMENT ALREADY FAILED THIS EXACT WAY. A first version shelled out through `execFileSync` to
 * `node_modules\.bin\vitest.cmd` on Windows, which ran NOTHING and wrote NO report. With no report on disk the
 * script crashed loudly — survivable. But once ANY report existed from an earlier run, every subsequent
 * invocation silently re-read THAT FILE, found zero failures, and reported the mutant INERT. All 41 mutants came
 * back INERT in one run: a uniform answer that reads as a finding and is actually the instrument reading one
 * stale file 41 times.
 *
 * So: the report is DELETED before every run, and its absence afterwards is a hard ABORT rather than a zero. An
 * instrument that cannot tell "no test failed" from "no test ran" returns the same wrong answer for every
 * subject, and agreement between subjects is exactly what it would look like.
 */
function runSlice(rel: string): { failed: string[]; total: number } {
	rmSync(join(ROOT, REPORT), { force: true });
	try {
		// ⚠ THE PACKAGE'S OWN JS ENTRY, NOT THE `.bin` SHIM. `node_modules/.bin` holds only `vitest.exe` and
		// `vitest.bunx` on this platform, and neither is reachable the way a POSIX shell would reach a shim — the
		// first two attempts here ran NOTHING while looking like they had run. Invoking `vitest.mjs` through node
		// has no shim, no shell and no platform branch to get wrong.
		execSync(`node node_modules/vitest/vitest.mjs run ${rel} --reporter=json --outputFile=${REPORT}`, {
			cwd: ROOT,
			stdio: 'ignore'
		});
	} catch {
		// A non-zero exit is the NORMAL case here — the mutant is supposed to make tests fail.
	}
	if (!existsSync(join(ROOT, REPORT))) {
		throw new Error(`drive-slice-mutants: vitest wrote no report for ${rel} — the runner did not run, so no mutant verdict from this session is trustworthy`);
	}
	const report = JSON.parse(readFileSync(join(ROOT, REPORT), 'utf8')) as {
		testResults?: { assertionResults?: { title?: string; status?: string }[] }[];
	};
	const all = (report.testResults ?? []).flatMap((f) => f.assertionResults ?? []);
	if (all.length === 0) {
		throw new Error(`drive-slice-mutants: ${rel} reported ZERO tests — a mutant that stops the file being collected proves nothing, and must not be recorded as INERT`);
	}
	return {
		failed: all.filter((a) => a.status === 'failed').map((a) => a.title ?? '?'),
		total: all.length
	};
}

const results: Record<string, unknown>[] = [];

// ⚠ THE ENGINE SWEEP STILL RUNS; THE GAP IS A ROW, NOT A WALL. A first version threw before the loop, which made
// one SURFACE Slice block every ENGINE verdict — an instrument that reports nothing is not more honest than one
// that reports what it covered, only less useful. These rows carry `NOT_DRIVEN_HERE` and count as not-SOUND, so
// the omission is loud and itemised and the sweep still does its job.
const notDrivenHere = undrivenSurfaceSlices();

for (const abs of sliceFiles(join(ROOT, 'packages'))) {
	const rel = abs.slice(ROOT.length).replace(/\\/g, '/');
	const parsed = parseSliceSource(readFileSync(abs, 'utf8'), rel);
	const sliceId = String(parsed.declaration['id']);
	const mutants = (parsed.declaration['mutants'] ?? []) as Mutant[];

	for (const m of mutants) {
		const target = join(ROOT, m.file);
		const original = readFileSync(target, 'utf8');
		const occurrences = original.split(m.find).length - 1;
		if (occurrences !== 1) {
			// ⚠ AN UNANCHORED MUTANT IS NOT RUN, AND NOT SILENTLY SKIPPED EITHER. Zero occurrences means it was
			// never applied and any green is meaningless; more than one means it changed more than it claimed.
			results.push({ sliceId, mutant: m.id, verdict: 'UNANCHORED', occurrences, expectRed: m.expectRed });
			continue;
		}
		// ⚠ THE SUPERSTRING CHECK, BEFORE ANYTHING IS RUN. A replacement containing its own anchor cannot redden a
		// substring assertion, and the failure mode is a GREEN that looks like a passing control.
		const superstring = m.replace.includes(m.find);
		writeFileSync(target, original.replace(m.find, m.replace), 'utf8');
		let red: { failed: string[]; total: number };
		try {
			red = runSlice(rel);
		} finally {
			writeFileSync(target, original, 'utf8');
		}
		const named = new Set(m.expectRed);
		const unexpected = red.failed.filter((t) => ![...named].some((c) => t.startsWith(c)));
		const missing = [...named].filter((c) => !red.failed.some((t) => t.startsWith(c)));
		results.push({
			sliceId,
			mutant: m.id,
			verdict:
				red.failed.length === 0
					? superstring
						? 'INERT_SUPERSTRING'
						: 'INERT'
					: unexpected.length > 0
						? 'TOO_WIDE'
						: missing.length > 0
							? 'PARTIAL'
							: 'SOUND',
			redCount: red.failed.length,
			totalTests: red.total,
			expectRed: m.expectRed,
			failed: red.failed,
			unexpected,
			missing
		});
	}
}

for (const s of notDrivenHere)
	results.push({
		sliceId: s.sliceId,
		mutant: `(${String(s.mutants)} declared)`,
		file: s.file,
		verdict: 'NOT_DRIVEN_HERE',
		note: 'a .slice.e2e.ts is a Playwright spec and this driver shells vitest — drive it with the SURFACE driver and record the verdicts'
	});

process.stdout.write(`${JSON.stringify(results, null, 1)}\n`);
const bad = results.filter((r) => r['verdict'] !== 'SOUND');
process.stdout.write(`\n${results.length - bad.length}/${results.length} SOUND\n`);
for (const b of bad) process.stdout.write(`  ${b['sliceId']} ${b['mutant']}: ${b['verdict']}\n`);
