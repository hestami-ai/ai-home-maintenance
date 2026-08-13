// REG-F-086 — C-0c cannot see two of its thirteen blind machines, because those aggregates are never CREATED
// by the helper the birth census reads. The gap is a missing CODE PATH, not a missing declaration.
//
// ⚠ THIS MATTERS BECAUSE IT INVALIDATES THE REMEDY ALREADY WRITTEN DOWN. REG-F-074's residue, and the roadmap
// after it, say to close C-0c's hole by *"declaring births for the 13"*. For eleven of them that works. For
// `Intent.intentStatus` and `PWU.workLifecycleState` **there is nowhere to put the declaration**: `birthStates()`
// walks the AST for `createObject(...)` calls and reads their `births:` property, and neither `captureIntent` nor
// `proposePwu` calls `createObject` at all — each hand-builds an object literal and hands it to `commitState`.
// Verified in both directions: `grep -c createObject` is **0** in both files.
//
// **AND `PWU.workLifecycleState` IS THE MACHINE REG-F-082 EXPLOITED.** So the one blind machine that has already
// produced a measured false binding row is the one the recorded remedy could never have reached. Doing the
// mechanical eleven and reporting the hole closed would have left the demonstrated defect exactly where it was.
//
// WHAT THIS CONTROL DOES. `revision: 0` is the signature of an aggregate being born. Exactly one should exist in
// the whole handler surface — inside `createObject` in `kit.ts` — because that is the path the census can read.
// Every other occurrence is an aggregate created where no `births:` declaration can be attached.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { birthStates } from './arrow-command-census.js';

const HANDLERS = new URL('../packages/rph-application/src/handlers/', import.meta.url);

/** Every handler-surface site that mints a revision-0 aggregate, as `file:line`. */
function birthSites(): string[] {
	const out: string[] = [];
	for (const file of readdirSync(HANDLERS).sort()) {
		if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
		const lines = readFileSync(new URL(file, HANDLERS), 'utf8').split('\n');
		lines.forEach((line, i) => {
			if (/^\s*revision:\s*0\s*,?\s*$/.test(line)) out.push(`${file}:${i + 1}`);
		});
	}
	return out;
}

describe('REG-F-086 — every aggregate birth must be visible to the birth census', () => {
	// ⚠ A PINNED DEFECT, NOT AN ALLOWLIST. These two are recorded so a THIRD bypass fails on arrival, and so that
	// migrating either onto `createObject` reddens here and forces C-0c's unanalysed pin to be revisited in the
	// same commit. An exemption list that nobody is forced to revisit is how every allowlist in this repository
	// has rotted; this one cannot be added to without the addition being the thing that fails.
	const KNOWN_BYPASSES = ['intent.ts', 'pwu.ts'];

	it('PINNED DEFECT — exactly two handlers create aggregates outside `createObject`', () => {
		const bypasses = birthSites()
			.filter((s) => !s.startsWith('kit.ts:'))
			.map((s) => s.split(':')[0]!);
		expect(
			[...new Set(bypasses)].sort(),
			'a NEW bypass means another machine just became invisible to C-0c; migrate it to `createObject` ' +
				'instead of adding it here. If one was FIXED, shrink this pin and re-derive C-0c`s unanalysed set.'
		).toEqual(KNOWN_BYPASSES);
	});

	// ── CONTROL: THE SANCTIONED PATH IS REAL ─────────────────────────────────────────────────────────────────
	// Without this, a world where `createObject` no longer mints anything passes the test above trivially — the
	// bypass list would still read exactly two while the census had nothing left to read. Same shape as C-0b's
	// population control: an assertion about what is MISSING is worthless unless something asserts what is PRESENT.
	it('CONTROL — `createObject` in kit.ts is still the one sanctioned birth site', () => {
		const inKit = birthSites().filter((s) => s.startsWith('kit.ts:'));
		expect(inKit, 'the census reads births from `createObject`; if kit.ts mints nothing, it reads nothing')
			.toHaveLength(1);
	});

	// ⚠⚠ THIS TEST'S PREMISE EXPIRED, AND IT CAUGHT THAT ITSELF — which is the best thing a pin can do.
	//
	// It asserted that the two machines born outside `createObject` MUST remain in C-0c's unanalysed pin, on the
	// reasoning that a bypassed birth is an INVISIBLE birth. That was true when written and is now false in both
	// halves:
	//
	//   * **REG-F-086/118** taught `commitState` to declare `births` too, so both machines HAVE a declared,
	//     runtime-checked birth. The bypass of `createObject` is still real — the pin above still reads exactly
	//     two — but it no longer implies invisibility. **A bypass and a missing declaration were the same thing
	//     for as long as one primitive could declare.**
	//   * **REG-F-119** then took `PWU.workLifecycleState` to 57/57 arrows, so it left the unanalysed set
	//     entirely. `Intent.intentStatus` remains, for the OTHER cause REG-F-118 added: 6 of 15 arrows declared.
	//
	// So the tie between the two records is inverted rather than deleted: a bypassed birth must be VISIBLE, and
	// whether its machine is analysable is now a separate question about arrow coverage. Asserting the old
	// direction would pin a machine into `unanalysed` and quietly punish the next increment that fixes it.
	it('every bypassed birth is nonetheless VISIBLE to the census, which is what the bypass used to cost', () => {
		const born = birthStates();
		for (const machine of ['Intent.intentStatus', 'PWU.workLifecycleState']) {
			expect(
				born.has(machine),
				`${machine} is born outside \`createObject\`; since REG-F-118 that no longer excuses an undeclared ` +
					`birth, and \`commitState\` must carry one`
			).toBe(true);
		}
	});
});
