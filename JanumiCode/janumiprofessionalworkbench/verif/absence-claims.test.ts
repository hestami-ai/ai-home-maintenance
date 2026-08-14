// P-3 — an absence claim must state the search that found the absence.
//
// CON-000 B3, as amended by REG-D-034: *"Canon's SILENCE on a detail is never evidence of the corpus's silence."*
// REG-F-093 states the operational form: before a *"not defined / unspecified / canon is silent"* claim may block
// an increment or reach the sponsor, it must state which source corpora were searched **and a positive control**
// — a term known to be present, with its hit count.
//
// ⚠ WHY THE POSITIVE CONTROL IS NOT CEREMONY. Four instrument failures in one day each produced a false zero
// indistinguishable from a real one: a probe that ran a string method on objects and returned 0 for EVERY machine
// including healthy ones; a mutant that never applied because `\n` met a CRLF file; a provenance reader that read
// an array as a map and returned OTHER for all 27; and two searches against a 311-line stub that is not the
// document the code cites. In each case the *answer* looked exactly like a finding.
//
// ⚠ AND THE COST IS MEASURED, NOT HYPOTHETICAL. Four of six questions escalated to the sponsor as *"canon does
// not define this"* were answered in the source corpora (REG-F-093). One of the entries this control grandfathers
// — `REG-F-083` — was independently found MIS-FRAMED by that sweep: its headline rested on `terminalStates`, a
// repository shape, while the ratified domain model contains the word "terminal" zero times. **The rule had teeth
// before it was enforced.**
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const REGISTER = new URL(
	'../docs/canon/JPWB-REG-005 Decision and Divergence Register.md',
	import.meta.url
);

/** Phrasings that assert something is absent from the corpus. */
const ABSENCE =
	/NONE FOUND|not defined|canon does not|no such|unspecified|is silent|nothing in|does not define|no canon|zero hits/i;

/** Evidence that the absence was SEARCHED FOR rather than assumed. */
const SEARCH_STATED = /positive control|control:|searched|grep|hit count|=\s*0 hits|control of|instrumented/i;

interface Entry {
	readonly id: string;
	readonly body: string;
}

function entries(): Entry[] {
	const parts = readFileSync(REGISTER, 'utf8').split(/^(### REG-[A-Z]-\d+.*)$/m);
	const out: Entry[] = [];
	for (let i = 1; i < parts.length; i += 2) {
		const id = /### (REG-[A-Z]-\d+)/.exec(parts[i]!)?.[1];
		if (id) out.push({ id, body: parts[i + 1] ?? '' });
	}
	return out;
}

/** Entries asserting an absence WITHOUT stating the search that established it. */
function unevidencedAbsenceClaims(): string[] {
	return entries()
		.filter((e) => ABSENCE.test(e.body) && !SEARCH_STATED.test(e.body))
		.map((e) => e.id);
}

// ⚠ GRANDFATHERED, NOT FORGIVEN. These predate the rule, and are pinned BY NAME rather than by count so the list
// can only shrink deliberately. A rule applied retroactively to ~~184~~ **237** entries would be a red wall
// nobody clears (population re-derived 2026-08-14, REG-F-149, by running this file's own `entries()`),
// which is how a control becomes wallpaper; enforced from today forward, it binds.
//
// **13 at P-3; 12 since REG-F-049 was amended under P-5.** The list shrank because an entry was REPAIRED — its
// premise (the RPH docs are historical material) was reversed by REG-D-034, and the amendment states its search.
// This test reddened the moment that happened, making the removal a decision rather than a side effect. **That is
// the mechanism working, not maintenance.**
const GRANDFATHERED = [
	'REG-Q-028',
	'REG-Q-030',
	'REG-Q-034',
	'REG-F-006',
	'REG-F-032',
	'REG-F-037',
	'REG-F-038',
	'REG-F-040',
	'REG-D-021',
	'REG-F-074',
	'REG-F-078',
	'REG-F-083'
];

describe('P-3 — an absence claim must state its search', () => {
	it('no NEW register entry asserts an absence without stating the search', () => {
		expect(
			unevidencedAbsenceClaims(),
			'A new id here means an absence was recorded without a stated search — under CON-000 B3 that is not a ' +
				'finding yet. State which source corpora were searched and a positive control, or drop the claim. ' +
				'A MISSING id means a grandfathered entry was repaired: remove it from GRANDFATHERED deliberately.'
		).toEqual(GRANDFATHERED);
	});

	// ── CONTROL 1: THE DETECTOR FINDS WHAT IT IS LOOKING FOR ─────────────────────────────────────────────────
	// Every assertion here passes if `entries()` returns nothing or the phrase lists match nothing — the empty
	// world is clean by construction. This fails in exactly that world.
	it('CONTROL — the register parses and both phrase lists actually match', () => {
		const all = entries();
		expect(all.length, 'the register must parse into entries').toBeGreaterThan(150);
		const withAbsence = all.filter((e) => ABSENCE.test(e.body));
		expect(withAbsence.length, 'the ABSENCE phrases must match real entries').toBeGreaterThan(20);
		const withSearch = withAbsence.filter((e) => SEARCH_STATED.test(e.body));
		expect(
			withSearch.length,
			'and SEARCH_STATED must match too — if it never matches, every entry looks unevidenced and the pin ' +
				'above is measuring the detector rather than the register'
		).toBeGreaterThan(10);
	});

	// ── CONTROL 2: A FABRICATED ABSENCE CLAIM IS CAUGHT ──────────────────────────────────────────────────────
	// The control's own mutant, run in-process rather than by editing the register: synthesise the entry a future
	// author would write and prove the detector flags it. Without this, CONTROL 1 could pass on a detector that
	// happens to match today's text and would miss tomorrow's.
	it('CONTROL — a synthesised unevidenced absence claim is detected, and an evidenced one is not', () => {
		const bare = '- **Statement:** canon does not define the escalation predicate, so the increment is blocked.';
		const evidenced =
			bare +
			'\n- Searched the RPH set and Constitution Discussion; positive control `ControlAction` = 23 hits.';
		expect(ABSENCE.test(bare) && !SEARCH_STATED.test(bare), 'the bare claim must be flagged').toBe(true);
		expect(
			ABSENCE.test(evidenced) && !SEARCH_STATED.test(evidenced),
			'the same claim WITH a stated search and positive control must pass'
		).toBe(false);
	});
});
