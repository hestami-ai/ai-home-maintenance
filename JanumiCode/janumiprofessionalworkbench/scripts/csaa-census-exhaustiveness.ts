// JAN-CSAADEC CD-05 — the BEHAVIOURAL answer to "is `CSAA_CENSUS` complete?", on demand.
//
// WHY THIS EXISTS. `CD-03` moved three CSAA test files out of the default gate on the grounds that they, and
// only they, assert over the LIVE WORKBENCH TREE. `CD-04` gates the LIST — that its entries exist, that the two
// lanes partition, that the census stays out of both gate configs. Nothing there gates the JUDGEMENT that
// produced the list, and `CD-04` records why the obvious static check is unbuildable: SIX csaa-lane files
// transitively reach a live-tree module and pass perfectly well, so "reaches" is not "asserts over", and pinning
// the reachable set would fire on every CSAA change inside the gate that runs on everything — reintroducing the
// coupling `CD-03` removed, one file over.
//
// ⭑⭑ SO THE QUESTION IS ANSWERED THE ONLY WAY IT WAS EVER ANSWERED HONESTLY: PERTURB THE TREE AND SEE WHO
// CHANGES VERDICT. Two static instruments were tried first and BOTH were wrong. A regex for "the test names a
// repo path" said 46 of 188 and over-counted fifteenfold — naming a path in a string fixture is not reading the
// tree — and it carried a control that WORKED, which is the part worth remembering: a control proves an
// instrument DISCRIMINATES, not that it measures the thing you named it after. Reverse-reachability from
// `collect-inventory.ts` said 9 and was wrong in both directions at once.
//
// ⛔ DELIBERATELY NOT A GATE. It mutates the working tree and costs four vitest runs (~15 minutes). Wiring it
// into the gate would put tree mutation on every commit, which is a worse defect than the one it detects.
//
//   bun run scripts/csaa-census-exhaustiveness.ts
//
// ⚠ WHAT IT CAN AND CANNOT ESTABLISH, STATED SO THE VERDICT IS NOT READ AS MORE THAN IT IS.
//   CAN: find a repo-coupled test hiding in the GATED lane — the direction that costs us, because such a test
//        reddens the gate on unrelated product work, which is how this programme began.
//   CANNOT: prove a census file is still coupled and could not return to the gate. That needs a pristine tree at
//        the pinned populations, which does not exist once the tree has moved past them.
//   CANNOT: find coupling on a dimension it does not perturb. The dimensions are enumerated in `PERTURBATIONS`
//        and are the ones observed to matter; a reader who suspects another should add it there.
//   REFUSES: to report anything at all if the gated lane is ALREADY red at baseline. A pre-existing failure
//        makes "did this file redden?" unanswerable, and a diff that silently skips it would report a clean
//        bill of health over exactly the case it exists to find.
//
// ⚠ `--only <substring>` NARROWS THE GATED LANE, AND EXISTS SOLELY SO THIS INSTRUMENT CAN BE FALSIFIED CHEAPLY.
// A full run costs ~20 minutes, which is too long to drive a predicted red against. In that mode the script
// REFUSES to issue a clean verdict and says so on every line of output — because filtering a gate to the tests
// you expect to be affected assumes the answer you are testing for, and that mistake has already been made once
// in this repository this week.
//
import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSAA_CENSUS } from '../vitest.projects.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The tree movements an ordinary product commit makes.
 *
 * ⭑ THE FIRST ENTRY IS NOT HYPOTHETICAL: `f35cb69d` added a fifth `playwright.*.config.ts` at the app root and
 * reddened 28 CSAA tests. Reproducing that shape is what makes this instrument credible rather than plausible.
 */
const PERTURBATIONS: ReadonlyArray<readonly [string, string]> = [
	['apps/rph-demo/playwright.cd05probe.config.ts', 'export default {};\n'],
	['apps/rph-demo/src/lib/_cd05probe.ts', 'export const CD05 = true;\n'],
	['verif/_cd05-probe.ts', 'export const CD05_PROBE = true;\n'],
	['packages/rph-domain/src/_cd05probe.ts', 'export const CD05 = true;\n'],
	['packages/rph-contracts/src/_cd05probe.ts', 'export const CD05 = true;\n'],
	['packages/rph-engine/src/_cd05probe.ts', 'export const CD05 = true;\n']
];

interface Run {
	readonly failed: ReadonlySet<string>;
	readonly assertions: ReadonlySet<string>;
}

function vitest(args: readonly string[]): string {
	try {
		return execFileSync('node', ['node_modules/vitest/vitest.mjs', 'run', ...args], {
			cwd: ROOT,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			maxBuffer: 64 * 1024 * 1024
		});
	} catch (error) {
		// A non-zero exit is the ordinary case here — the census lane is red by design. The OUTPUT is the datum,
		// so it is read from the failure rather than thrown away.
		const e = error as { stdout?: string; stderr?: string };
		return `${e.stdout ?? ''}${e.stderr ?? ''}`;
	}
}

function parse(out: string): Run {
	const failed = new Set<string>();
	for (const m of out.matchAll(/FAIL\s+\|csaa(?:-census)?\|\s+(\S+\.test\.ts)/g)) failed.add(m[1] ?? '');
	// The literal numeric pins, used ONLY as this script's own positive control — see `main`.
	const assertions = new Set(out.match(/expected \d+ to be \d+/g) ?? []);
	return { failed, assertions };
}

const ONLY = process.argv.includes('--only')
	? (process.argv[process.argv.indexOf('--only') + 1] ?? '')
	: '';

const gatedLane = () => parse(vitest(ONLY ? ['--project', 'csaa', ONLY] : ['--project', 'csaa']));
const censusLane = () => parse(vitest(['--config', 'vitest.census.config.ts']));

function main(): void {
	for (const [rel] of PERTURBATIONS)
		if (existsSync(join(ROOT, rel))) throw new Error(`REFUSING to overwrite an existing file: ${rel}`);

	console.log('CD-05 — baseline (unperturbed)…');
	const gatedBefore = gatedLane();
	const censusBefore = censusLane();

	const created: string[] = [];
	const unrestored: string[] = [];
	let gatedAfter: Run;
	let censusAfter: Run;
	try {
		for (const [rel, body] of PERTURBATIONS) {
			writeFileSync(join(ROOT, rel), body);
			created.push(rel);
		}
		console.log(`CD-05 — perturbed (${created.length} files added)…`);
		gatedAfter = gatedLane();
		censusAfter = censusLane();
	} finally {
		// ⛔ NOTHING IN THIS BLOCK MAY THROW, AND `no-unsafe-finally` CAUGHT ME WRITING ONE THAT DID. A throw
		// inside `finally` REPLACES any exception already in flight — so a failure to tidy up would erase the
		// failure that caused it, and the run would report "FAILED TO RESTORE" while silently discarding the
		// vitest error that left the tree dirty. ⭑ The tidy-up must always run; the COMPLAINT waits until after.
		for (const rel of created) {
			try {
				unlinkSync(join(ROOT, rel));
			} catch {
				unrestored.push(rel);
			}
		}
		for (const [rel] of PERTURBATIONS) if (existsSync(join(ROOT, rel))) unrestored.push(rel);
	}
	if (unrestored.length > 0)
		throw new Error(`FAILED TO RESTORE the working tree: ${[...new Set(unrestored)].join(', ')}`);

	// ⭑⭑ THIS SCRIPT'S OWN POSITIVE CONTROL, AND IT IS THE PART THAT MAKES THE VERDICT MEAN ANYTHING. If the
	// perturbation silently failed to register, every gated-lane file would be unchanged and the run would report
	// a clean "nothing new is coupled" — proving nothing while reading as proof. So the census lane must be
	// SEEN to move.
	//
	// ⛔ AND THE CONTROL IS "ITS OUTPUT CHANGED", NOT "IT IS RED". The census lane is red whenever the tree has
	// drifted past its pins, which is most of the time — asserting redness here would be a control that cannot
	// fail. A pin moving from `expected 72 to be 69` to `expected 73 to be 69` is the observation that the
	// perturbation reached CSAA at all.
	const moved = [...censusAfter.assertions].filter((a) => !censusBefore.assertions.has(a));
	if (moved.length === 0) {
		console.error('\n⛔ CONTROL FAILED — the census lane reported the same assertions before and after.');
		console.error('   The perturbation did not reach CSAA, so the result below is UNINTERPRETABLE.');
		console.error(`   before: ${[...censusBefore.assertions].join(' | ') || '(none)'}`);
		console.error(`   after:  ${[...censusAfter.assertions].join(' | ') || '(none)'}`);
		process.exit(2);
	}
	console.log(`\n✓ control: the census lane moved — ${moved.join(' | ')}`);

	// ⛔ A RED BASELINE MAKES THE WHOLE COMPARISON UNSOUND, so it is refused rather than annotated. "Did this
	// file redden when the tree moved?" has no answer for a file that was already red, and the diff below would
	// silently drop it — reporting a clean bill of health over precisely the case worth finding.
	if (gatedBefore.failed.size > 0) {
		console.error('\n⛔ THE GATED LANE IS ALREADY RED BEFORE ANY PERTURBATION.');
		console.error('   This comparison cannot distinguish pre-existing failures from ones the tree movement');
		console.error('   caused, so no verdict is issued. Fix these first:');
		for (const f of [...gatedBefore.failed].sort()) console.error(`     ${f}`);
		process.exit(2);
	}

	const fresh = [...gatedAfter.failed].filter((f) => !gatedBefore.failed.has(f)).sort();
	if (fresh.length > 0) {
		console.error('\n⛔ REPO-COUPLED TESTS ARE HIDING IN THE GATED LANE.');
		console.error('   These reddened when the workbench moved, so an ordinary product commit will redden the');
		console.error('   gate on work that has nothing to do with them. They belong in CSAA_CENSUS:');
		for (const f of fresh) console.error(`     ${f}`);
		process.exit(1);
	}

	if (ONLY) {
		console.log(`\n⚠ PARTIAL — self-test mode (--only ${ONLY}). NO clean verdict is issued: this run measured`);
		console.log('  a filtered subset of the gated lane, which assumes the answer a real run must establish.');
		process.exit(0);
	}
	console.log(`\n✓ ${CSAA_CENSUS.length} census file(s); no gated-lane test changed verdict under perturbation.`);
}

main();
