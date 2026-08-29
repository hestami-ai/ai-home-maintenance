// P-5 — AN ENTRY'S STATUS MUST BE DERIVABLE, because "what is still owed" is the register's whole job.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────────────────────
// Asked "how many entries are open?", I wrote a reasonable regex and got **22**. I wrote a second, equally
// reasonable one minutes later and got **50**. Same file, same moment, both defensible readings — because the
// status of an entry lives in prose and there is no rule saying where. **A register whose open set depends on the
// reader's regex cannot be audited**, and the register IS the audit record (REG-D-025: *"who did what, when, why,
// where, how"*).
//
// It is not hypothetical. REG-F-100's Status line said **"12 owed"** for a day while three ✅ lines in its own
// body recorded the twelve as dispositioned and the gate as green. Governance reading the header would have been
// handed twelve discharged items.
//
// ── THE RULE, AND WHY IT IS THIS ONE ──────────────────────────────────────────────────────────────────────────
// Every entry must carry EXACTLY ONE live (unstruck) `**Status:**`. Not "a status somewhere" — exactly one, so
// that the answer to "what does this entry currently say" is a lookup rather than an interpretation. The
// repository's retire-by-striking convention makes this expressible without deleting history: a superseded status
// is wrapped in `~~…~~` and the replacement is a new line.
//
// ⚠ AND IT RATCHETS RATHER THAN MIGRATES, which is the same shape REG-D-042 ruled for tiers and the same shape
// `absence-claims.test.ts` already uses next door. ~~63~~ **60** of ~~209~~ ~~240~~ **408** entries do not conform
// today — 56 with every status struck and no replacement, ~~7~~ **4** with two live statuses.
// ⚠ POPULATION RE-DERIVED 2026-08-14 (REG-F-149) by running THIS FILE'S OWN `entries()` over the register:
// ~~**240**~~ — **403 as at 2026-08-28**, re-derived at the point of writing by running this file's own
// heading pattern, per `JPWB-DOC-004 §10 item 9` (merged the same day). The 240 was correct on 2026-08-14
// and the register has since grown by 68%; it is struck rather than overwritten because the earlier reading
// is the record that the figure was CHECKED then, not merely asserted. The ~~63~~ **60** is NOT stale — it is the length of the by-name GRANDFATHERED list below, which the gate
// keeps honest. ⚠ ~~THE 56/7 SPLIT WAS NOT RE-DERIVED and is left as written rather than silently reprinted
// as though it had been: correcting a figure beside an underived one is how REG-F-148's four defects were
// made, and marking the boundary is cheaper than implying a check that did not happen.~~ **THE SPLIT IS NOW
// DERIVED, 2026-08-29, by running this file's own `entries()`: the full distribution is `{0: 56, 1: 348, 2: 4}`,
// so 56 / 4 — and the standing marker above is discharged.** ⚠ **THE 56 BEING UNCHANGED IS A COINCIDENCE, NOT A
// CONFIRMATION.** It was never checked between 2026-08-14 and today; it is right NOW, which is a different claim
// from having been right throughout, and the two are easy to conflate when a re-derived figure happens to match.
// The 7 → 4 moved for two distinct reasons that must not be merged: repairs closed some, and the mid-line strike
// fix below revealed that `REG-F-047` and `REG-F-070` were never offenders at all. Rewriting ~~63~~ **60** canon entries in one sweep would be a large
// unreviewed edit to the audit record itself. So they are GRANDFATHERED by id, new entries must conform, and the
// list may only SHRINK.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const REGISTER = new URL(
	'../docs/canon/JPWB-REG-005 Decision and Divergence Register.md',
	import.meta.url
);

interface Entry {
	readonly id: string;
	readonly liveStatusLines: number;
}

/**
 * Every `### REG-x-NNN` entry, with its count of LIVE status lines.
 *
 * A line is live when it is not struck. The repository strikes a retired line by opening it `- ~~`, which is the
 * form every retirement in this register uses; a status struck mid-line would defeat this and is why the count is
 * asserted rather than the text.
 */
export function entries(text: string): Entry[] {
	const out: Entry[] = [];
	for (const block of text.split(/^### /m).slice(1)) {
		const heading = block.split('\n', 1)[0] ?? '';
		const m = /^(~~)?(REG-[A-Z]-\d+)/.exec(heading);
		if (!m) continue;
		const live = block
			.split('\n')
			// ⚠ INLINE CODE IS STRIPPED FIRST, and the gate found this out by rejecting the very entry that
			// announced it. REG-F-113 describes the convention, so it QUOTES `**Status:**` inside backticks twice
			// — and a parser that counts raw occurrences read those as three live statuses. **Prose about a status
			// is not a status.** Stripping code spans is the narrowest rule that separates them, and it is
			// narrower than "ignore lines containing backticks": a real status line may cite `RPH-EXE-002`.
			.map((l) => l.replace(/`[^`]*`/g, ''))
			// ⚠ A LINE-OPENING STRIKE IS NOT THE ONLY STRIKE, and this file's own docblock said so as a
			// hypothetical — *"a status struck mid-line would defeat this"* — for as long as the file has existed.
			// The zero-shift repair form made it real: `- **WHAT STILL STANDS:** … ~~**Status:** OPEN.~~ **✅ CLOSED
			// …**` retires a status WITHOUT opening the line `- ~~`, and the prefix test above counts the retired
			// one as live. Both filters are kept rather than one: dropping struck SPANS handles the mid-line form,
			// and the prefix test still handles a strike that OPENS on this line and closes on a later one, which
			// the span regex cannot see. That residual is zero in the register today and the guard is what keeps
			// it from being reintroduced silently.
			.filter((l) => !l.trimStart().startsWith('- ~~'))
			.map((l) => l.replace(/~~[^~]*~~/g, ' '))
			.filter((l) => l.includes('**Status:**')).length;
		out.push({ id: m[2]!, liveStatusLines: live });
	}
	return out;
}

/**
 * Entries that predate this rule. **SHRINK-ONLY.** Removing one means it was repaired; adding one means a new
 * entry was written without a derivable status, which is the thing this file exists to stop.
 */
const GRANDFATHERED: ReadonlySet<string> = new Set([
	'REG-D-001', 'REG-D-002', 'REG-D-003', 'REG-D-004', 'REG-D-005', 'REG-D-006',
	'REG-D-007', 'REG-Q-001', 'REG-Q-002', 'REG-Q-003', 'REG-Q-004', 'REG-Q-005',
	'REG-Q-006', 'REG-Q-007', 'REG-Q-008', 'REG-Q-009', 'REG-Q-010', 'REG-Q-011',
	'REG-Q-012', 'REG-Q-013', 'REG-Q-014', 'REG-Q-015', 'REG-Q-016', 'REG-Q-017',
	'REG-Q-018', 'REG-Q-019', 'REG-Q-020', 'REG-Q-021', 'REG-Q-022', 'REG-Q-023',
	'REG-Q-024', 'REG-Q-026', 'REG-Q-027', 'REG-Q-028', 'REG-Q-029', 'REG-Q-030',
	'REG-Q-031', 'REG-Q-032', 'REG-Q-033', 'REG-Q-034', 'REG-Q-035', 'REG-Q-036',
	'REG-Q-037', 'REG-Q-038', 'REG-Q-039', 'REG-Q-040', 'REG-Q-041', 'REG-Q-042',
	'REG-Q-043', 'REG-Q-044', 'REG-Q-045', 'REG-Q-046', 'REG-Q-047', 'REG-Q-048',
	'REG-Q-049', 'REG-Q-050', 'REG-F-043', 'REG-F-054', 'REG-F-067',
	// ⚠ 'REG-F-085' REMOVED 2026-08-21: REG-D-044 answered it and its status was repaired to a single live line.
	// This list is SHRINK-ONLY and this gate caught the repair itself — "a repair happened, so remove them from
	// the list deliberately" — which is the whole point of grandfathering by ID rather than by count.
	// ⚠⚠ 'REG-F-047' AND 'REG-F-070' REMOVED 2026-08-29, AND THEY WERE NEVER OFFENDERS. Neither entry was
	// repaired; the PARSER was. Each carries one live status and one struck MID-LINE, and the old prefix-only
	// strike test counted the retired one as live — so both were grandfathered against a defect in the
	// instrument rather than a defect in the register. Fixing `entries()` made them conform and this assertion
	// fired, naming both, which is the first time this leg has been observed red. Grandfathering by ID is what
	// made the correction visible: a COUNT would have absorbed it silently.
	'REG-F-084'
]);

describe('P-5 — every register entry states its status exactly once', () => {
	const all = entries(readFileSync(REGISTER, 'utf8'));

	it('no NEW entry carries zero or multiple live **Status:** lines', () => {
		const offenders = all.filter((e) => e.liveStatusLines !== 1).map((e) => e.id);
		expect(
			offenders.filter((id) => !GRANDFATHERED.has(id)),
			'entry/entries whose CURRENT status cannot be read off a single line. Strike the superseded status ' +
				'(`- ~~… **Status:** …~~`) and add the replacement as a new line — do not edit history in place, and ' +
				'do not leave two live statuses for a reader to choose between.'
		).toEqual([]);
		expect(
			[...GRANDFATHERED].filter((id) => !offenders.includes(id)),
			'GRANDFATHERED id(s) that now conform — a repair happened, so remove them from the list deliberately. ' +
				'The list is SHRINK-ONLY; leaving a repaired id in it lets the next regression hide behind it.'
		).toEqual([]);
	});

	// CONTROL 1 — THE POPULATION IS REAL. Every assertion above is satisfied by a parser that returns nothing:
	// no entries, no offenders, and both lists empty. This is the vacuity this repository has recorded six times.
	it('CONTROL — the parser reads a real register', () => {
		expect(all.length, 'entries parsed from the register').toBeGreaterThan(150);
		expect(
			all.filter((e) => e.liveStatusLines === 1).length,
			'and most of them already conform, or the rule is not the one the register follows'
		).toBeGreaterThan(100);
	});

	// CONTROL 2 — IT DISCRIMINATES IN BOTH DIRECTIONS. Without this, a parser that counted every line containing
	// the word "Status" (struck or not) would pass CONTROL 1 and silently grandfather the whole file.
	it('CONTROL — a struck status does not count, and a live one does', () => {
		const fixture = [
			'### REG-F-999 — a fixture',
			'- ~~**Status:** OPEN — the retired one.~~',
			'- **Status:** ✅ CLOSED — the live one.',
			'',
			'### REG-F-998 — a fixture with only a struck status',
			'- ~~**Status:** OPEN.~~',
			''
		].join('\n');
		const parsed = entries(fixture);
		expect(parsed.map((e) => e.id)).toEqual(['REG-F-999', 'REG-F-998']);
		expect(parsed[0]!.liveStatusLines, 'the struck line must not count').toBe(1);
		expect(parsed[1]!.liveStatusLines, 'a struck-only entry has no readable status').toBe(0);
	});

	// CONTROL 3 — A STRIKE THAT OPENS MID-LINE RETIRES JUST AS MUCH, AND A LIVE STATUS MID-LINE STILL COUNTS.
	//
	// ⚠ CONTROL 2 CANNOT CATCH THE DEFECT THIS ONE EXISTS FOR. Every strike in its fixture opens at the START of a
	// line, which is precisely the form the old prefix-only test handled correctly — so it passed for the whole
	// life of the defect and would have gone on passing. A control that only exercises the easy shape is not a
	// control. This fixture is the shape the zero-shift repair form actually writes into the register, and it
	// discriminates in BOTH directions in one fixture: the retired status is mid-line and must NOT count, the live
	// status is ALSO mid-line and must count, so a span-removal that ran greedily to end-of-line would return 0
	// and redden here rather than passing quietly.
	it('CONTROL — a status struck MID-LINE does not count, and a LIVE one mid-line does', () => {
		const fixture = [
			'### REG-F-997 — a fixture whose retired status sits mid-line',
			'- **WHAT STILL STANDS:** the limb below. ~~**Status:** OPEN — retired here.~~ **✅ CLOSED 2026-08-29.**',
			'- **Merge target:** Repository — landed. **Status:** ✅ CLOSED — the live one, also mid-line.',
			''
		].join('\n');
		const parsed = entries(fixture);
		expect(parsed.map((e) => e.id)).toEqual(['REG-F-997']);
		expect(
			parsed[0]!.liveStatusLines,
			'exactly one: the mid-line strike is retired, the mid-line live status is not'
		).toBe(1);
	});
});
