// EVERY SOURCE FILE MUST BE REVIEWABLE TEXT — JAN-VERIF V-2c.
//
// A single NUL byte anywhere in a file makes git classify the WHOLE FILE as binary. `git diff` then prints
// "Binary files … differ" and nothing else: no hunks, no line numbers, no review. The file still compiles, still
// passes every test, and still shows up in the commit — so nothing announces that it has silently left the review
// process. It is the cheapest possible way to hide a change in plain sight.
//
// FOUND, NOT HYPOTHESISED. `apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts` carried a literal
// NUL as a prompt-measuring sentinel (`const SENTINEL = '\u0000'`, written as the raw byte). It had been there since
// the file was authored, which means **no diff of the Reasoning-Review validator has ever been renderable** — through
// two adversarial reviews that read that package. Nothing was wrong with the code. The point is that nobody could
// have seen if there had been.
//
// The fix in both cases was to write the escape (`'\u0000'`) instead of the byte, which is behaviourally identical
// and leaves the file text. This test is here so the next one is caught by the gate rather than by accident: I found
// the second instance only because I had just made the first.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Where hand-authored source lives. Deliberately not a whole-repo walk: `node_modules`, `dist` and coverage output
 *  are neither authored nor reviewed, and bundled artifacts legitimately contain arbitrary bytes. */
const ROOTS = ['packages', 'apps', 'scripts', 'verif'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.svelte-kit', 'coverage', 'e2e-results', '.turbo']);
const AUTHORED = /\.(ts|tsx|js|mjs|cjs|svelte|json|md)$/;

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (AUTHORED.test(entry)) out.push(full);
	}
	return out;
}

describe('authored source is reviewable text', () => {
	const files = ROOTS.flatMap((r) => walk(join(ROOT, r)));

	it('finds source to check at all, so a broken walk cannot pass vacuously', () => {
		// Without this the suite is a tautology: an empty file list satisfies "no file contains a NUL" perfectly. The
		// same vacuous-negative shape this programme has removed from the product a dozen times over.
		expect(files.length).toBeGreaterThan(200);
	});

	// ⚠ AN EXPLICIT BUDGET, AND THE DISTINCTION FROM V-4a IS THE WHOLE POINT OF THIS COMMENT (REG-F-116).
	//
	// V-4a REFUSED to raise a timeout, correctly: that test was doing 168 MB of REDUNDANT I/O — re-reading the same
	// six files once per rule — and a bigger budget would have left the waste in place and the gate one slow machine
	// from a false verdict. Four more instances of that same defect were found and fixed in this sweep.
	//
	// THIS ONE IS NOT THAT. It reads every authored file EXACTLY ONCE, which is the work; there is nothing to
	// remove. Measured 1137ms in isolation and 15698ms with a second vitest running — the amplification is I/O
	// contention between workers, not waste, and it grew when `packages/csaa` added ~680 files to the tree it walks.
	// A test whose cost is inherent should DECLARE a budget that fits it rather than run against a 5000ms default
	// that describes a different kind of test. Tipping it under load is what turns a mutation CONTROL's whole-suite
	// run into a verdict about an unrelated mutation.
	//
	// The budget is not a licence: if this ever needs raising AGAIN, the question to ask first is whether the walk
	// has started reading something it does not review.
	it(
		'contains no NUL byte, which would make git treat the file as binary and stop diffing it',
		() => {
			const offenders = files
				.filter((f) => readFileSync(f).includes(0))
				.map((f) => f.slice(ROOT.length).replaceAll('\\', '/'));
			expect(offenders).toEqual([]);
		},
		30_000
	);
});
