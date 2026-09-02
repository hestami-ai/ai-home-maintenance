// REG-Q-066's ONE BOUND, answered — and gated, because the answer is contingent on the code NOT doing something.
//
// ── THE QUESTION, VERBATIM ──────────────────────────────────────────────────────────────────────────────────
// REG-Q-066 closes with: "ONE BOUND, stated so this is not read wider than it is: out-of-band logging
// (console/stderr from `agy-cli`) was not tested. It is outside canonical state and outside this census's
// definition of retention, but it is an unexamined escape hatch and an answer should say whether it counts."
//
// ── THE ANSWER: IT DOES NOT COUNT, AND FOR A STRONGER REASON THAN "OUTSIDE CANONICAL STATE" ──────────────────
// The hatch is not merely unexamined — it is CLOSED BY NON-USE. `agyPrint` destructures `const { stdout } =
// await execFileAsync(...)`; `stderr` is never bound anywhere in the demo application. There is no surface for
// retention to occur ON, so PER-9 and PER-12 have nothing to govern here.
//
// ── ⚠ WHICH IS WHY THIS IS A GATE AND NOT A NOTE ────────────────────────────────────────────────────────────
// An answer contingent on an absence rots the moment someone ends the absence. Binding `stderr` would CREATE
// the retention surface the question asks about — a model CLI's stderr can echo prompt content — so it must be
// accompanied by a retention disposition rather than arriving as a debugging convenience. This test reddens on
// that day and sends the author back to REG-Q-066.
//
// ⚠ AND IT CARRIES ITS OWN POSITIVE CONTROL. A source-absence gate whose file glob silently matched nothing
// would pass forever while asserting nothing — the failure mode this repository records most often. So the
// same instrument is asked for `stdout`, which MUST be found.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DEMO_SRC = `${ROOT}apps/rph-demo/src`;

/** Every .ts file under the demo's server-side source, derived from the filesystem. */
function demoSources(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = `${dir}/${name}`;
		if (statSync(p).isDirectory()) demoSources(p, acc);
		else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) acc.push(p);
	}
	return acc;
}

function occurrences(token: string): { file: string; line: number; text: string }[] {
	const hits: { file: string; line: number; text: string }[] = [];
	for (const file of demoSources(DEMO_SRC)) {
		const lines = readFileSync(file, 'utf8').split('\n');
		lines.forEach((text, i) => {
			if (text.includes(token)) hits.push({ file: file.slice(ROOT.length), line: i + 1, text: text.trim() });
		});
	}
	return hits;
}

describe('REG-Q-066 — the agy stderr escape hatch stays CLOSED BY NON-USE', () => {
	it('POSITIVE CONTROL — the instrument finds `stdout`, which the demo does bind', () => {
		// Without this, a glob that matched nothing would make the assertion below pass while asserting nothing.
		const stdout = occurrences('stdout');
		expect(stdout.length).toBeGreaterThan(0);
	});

	it('`stderr` is bound NOWHERE in the demo application', () => {
		const stderr = occurrences('stderr');
		expect(
			stderr,
			'Binding `stderr` CREATES the retention surface REG-Q-066 asks about — a model CLI\'s stderr can echo ' +
				'prompt content, which PER-9 governs and no redaction in this codebase covers (finding #60). If this ' +
				'is deliberate, it needs a retention disposition and REG-Q-066 needs re-answering; it must not arrive ' +
				'as a debugging convenience.'
		).toEqual([]);
	});
});
