// THE COMMAND DISPATCH CENSUS — every ratified command is driven by something.
//
// WHAT IT ASSERTS: each of the 84 command types in `COMMANDS` is named, as a string literal in real code rather
// than in a comment, by at least one test file. A command nobody dispatches has an unobserved handler: its
// preconditions, its emitted payload and its event-gate conformance are all claims nothing checks.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// Measured 2026-08-03 while surveying REG-F-014's fourth instance: THREE commands — `ChallengePwu`,
// `InvalidatePwu`, `ReshapePwu` — appeared nowhere outside `rph-contracts`. No test, no production caller. Each
// had a live handler and a routable command type, and none had ever been driven.
//
// That is also what disposed the finding that found them. `triggeringObjectId` is caller-supplied and never
// resolved — REG-F-014's shape — but it rides on two of those three, so there was nothing live to bypass. The
// honest move was to drive the commands first, which surfaced something better: `InvalidatePwu`'s handler
// resolves a command/event contract disagreement with `?? ''`, and its own comment says defaulting to '' "would
// fabricate a reference to nothing". The branch had never executed. It does now, and `pwu.test.ts` pins the
// fabricated empty reference as an admission.
//
// ── WHY A LITERAL-IN-TEST-CODE PROXY, AND WHAT IT COSTS ──────────────────────────────────────────────────────
// The exact question is "was this command dispatched", which only a runtime census answers. That needs a sink
// shared across vitest projects, which run in separate workers — real work, and more machinery than the fact
// justifies. So this is STATIC, and it is honest about the gap: comments are stripped before searching, because
// this repository has already been bitten by counting mentions as uses (`classifyRefusal` is named in production
// prose and called by nothing; REG-F-016 is the same mistake inside a register row). What survives is a command
// named in executable test code, which is a strong proxy and not a proof.
//
// It CANNOT tell a dispatched command from one merely named in a fixture's type annotation, and it does not
// check that the dispatch was ACCEPTED. Those are the limits; the guard is a floor, not a coverage claim.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMANDS } from '@janumipwb/rph-contracts';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

/**
 * Commands deliberately not driven, each with a reason. EMPTY, and that is the point — the three this census
 * found were fixed by writing their tests rather than by being listed here. An entry is a claim that a ratified
 * command should stay unobserved, which needs an argument stronger than "nobody got to it".
 */
const UNDRIVEN: Readonly<Record<string, string>> = {};

/** Every `*.test.ts` under packages/ and apps/. */
function testFiles(): string[] {
	const out: string[] = [];
	const walk = (abs: string, rel: string): void => {
		for (const entry of readdirSync(abs)) {
			const childAbs = `${abs}/${entry}`;
			const childRel = `${rel}/${entry}`;
			if (statSync(childAbs).isDirectory()) {
				if (entry === 'node_modules' || entry === 'dist' || entry === '.svelte-kit') continue;
				walk(childAbs, childRel);
			} else if (entry.endsWith('.test.ts')) out.push(childRel);
		}
	};
	for (const group of ['packages', 'apps']) {
		let names: string[];
		try {
			names = readdirSync(`${REPO_ROOT}${group}`);
		} catch {
			continue;
		}
		for (const pkg of names) {
			const src = `${REPO_ROOT}${group}/${pkg}/src`;
			try {
				if (!statSync(src).isDirectory()) continue;
			} catch {
				continue;
			}
			walk(src, `${group}/${pkg}/src`);
		}
	}
	return out;
}

/** Blank out `//` and block comments so a command NAMED in prose does not count as one DRIVEN. */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.split('\n')
		.map((line) => {
			const i = line.indexOf('//');
			return i >= 0 ? line.slice(0, i) : line;
		})
		.join('\n');
}

describe('every ratified command is driven by something', () => {
	const executableTestCode = testFiles()
		.map((rel) => stripComments(readFileSync(`${REPO_ROOT}${rel}`, 'utf8')))
		.join('\n');

	it('no command type is left undispatched', () => {
		const undriven = Object.keys(COMMANDS)
			.filter((name) => !(name in UNDRIVEN))
			.filter(
				(name) =>
					!executableTestCode.includes(`'${name}'`) &&
					!executableTestCode.includes(`"${name}"`) &&
					!executableTestCode.includes(`\`${name}\``)
			)
			.sort((a, b) => a.localeCompare(b));
		expect(
			undriven,
			'COMMAND(S) NO TEST DRIVES. A ratified, routable command whose handler has never run: its ' +
				'preconditions, its emitted payload and its event-gate conformance are claims nothing checks. Write ' +
				'the test, or add a row to UNDRIVEN with an argument for why it should stay unobserved.'
		).toEqual([]);
	});

	it('every UNDRIVEN entry carries a reason, and names a real command', () => {
		for (const [name, why] of Object.entries(UNDRIVEN)) {
			expect(COMMANDS[name as keyof typeof COMMANDS], `${name} is not a ratified command`).toBeDefined();
			expect(why.length, `${name} needs a reason`).toBeGreaterThan(30);
		}
	});

	// THE CONTROL. Both assertions above are satisfied by a search that matches EVERYTHING — and a broken
	// comment-stripper or a stray `.includes('')` would do exactly that. So the derivation is asked a question
	// whose answer is known: a name that is not a command, and appears nowhere, must be reported missing.
	it('CONTROL: the search discriminates — an absent name is not found', () => {
		expect(Object.keys(COMMANDS).length).toBeGreaterThan(50);
		expect(executableTestCode).not.toContain("'NoSuchCommandExistsAnywhere'");
		// and comment-stripping really removes text: this file names one in a comment above, in prose only.
		expect(stripComments('const x = 1; // ReshapePwu')).not.toContain('ReshapePwu');
	});
});
