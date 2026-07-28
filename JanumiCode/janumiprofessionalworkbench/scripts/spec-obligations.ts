// THE OBLIGATION COUNTER — JPWB-SPEC-001-DR-001 S-2. `bun run spec:obligations`
//
// Answers one question about a normative specification: **how many of its obligations name a way to check them?**
// The genre contract this repository commissions specs under (`docs/canon/_test/deep-spec-commission-prompt.md`)
// is explicit — *"Every SHALL/SHALL NOT names how conformance is established … An unverifiable SHALL is a defect."*
// §12 of SPEC-001 reports that as a count, and a count nobody can re-derive is exactly the kind of claim this
// programme keeps finding to be wrong. So the count lives here, as a script, and anyone can run it.
//
// ── WHY THIS FILE EXISTS IN THE FORM IT DOES: THE FIRST VERSION WAS WRONG, AND WRONGLY TRUSTED ───────────────
//
// A first counter was written in a scratchpad on 2026-07-28, reported **509 unbound**, and that number was quoted
// to the sponsor as fact and written into a work-package brief. It was wrong three ways, and the review that
// caught it had to re-derive the whole measurement to find out:
//
//   1. ITS FIXTURE PATTERN REQUIRED DIGITS. `SPEC-001-(PF|NF|…)-\d+` matches `SPEC-001-NF-22` and matches NONE of
//      the four other namespaces §0.3 of the spec declares — `FX-O4-05` (183 uses), `SPEC-001-FX-DISC-01` (213),
//      `SPEC-001-FIX-O-2-07N` (150), `SPEC-001-CHK-ABSENCE` (51). **597 citations invisible**, so 238 obligations
//      that DID name a check were scored unbound.
//   2. IT DROPPED EVERY TABLE ROW. Lines starting `|` were filtered out to avoid parsing markdown tables — and
//      166 SHALL obligations live in exactly those rows, including all ten field-contract tables. The cluster the
//      work package was aimed at could not move the number in either direction.
//   3. IT COUNTED SETTLED RECORDS AS DEBT. §11.4's fork rulings quote option text — *"Options: (a) SHALL — every
//      Surface addressable…"* — which is a decision record, not an obligation. 154 of the residual were that.
//
// The lesson is the one this repository writes down everywhere else and I still had to relearn: **a measurement is
// a claim, and an instrument nobody has tried to break is not evidence.** The selftest at the bottom exists for
// that reason — it feeds the matcher literal strings and requires it to report both hit and miss.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SPEC = `${ROOT}docs/canon/JPWB-SPEC-001 Professional Projection and Workbench Surface.md`;

/**
 * Every way this specification is permitted to name a check.
 *
 * DERIVED FROM §0.3's declared namespaces plus the two prose forms the document actually uses, NOT invented here.
 * A namespace the spec mints and this pattern does not know is the defect described in the header — so when a new
 * one appears, it is added here in the same change.
 */
const NAMES_A_CHECK =
	/(SPEC-001-(PF|NF|SC|MU|CHK|FIX|PB|REV|FX)-[A-Z0-9][A-Z0-9-]*|\bFX-O\d-\d+|[a-z0-9-]+\.(test|e2e)\.ts|(conformance|negative|positive) fixture|verifying check|verification of|conformance is established|verified by|asserted by)/i;

/** Sections whose SHALLs are NOT obligations of this specification, with the reason each is excluded. */
const NOT_OBLIGATIONS: readonly (readonly [string, string])[] = [
	[
		'# 11. Forks',
		'fork records quote OPTION text ("Options: (a) SHALL …") — a decision record, not a rule'
	],
	[
		'# 12. Self-review',
		'the review record reports counts and findings; it states no obligation of its own'
	]
];

interface Row {
	readonly line: number;
	readonly section: string;
	readonly inScope: boolean;
	readonly bound: boolean;
	readonly text: string;
}

/** Split into sentences WITHOUT discarding table rows — the first counter's second defect. */
function sentencesOf(text: string): { line: number; section: string; text: string }[] {
	const out: { line: number; section: string; text: string }[] = [];
	let section = '(front matter)';
	text.split('\n').forEach((raw, i) => {
		const heading = /^#{1,4}\s+(.*)$/.exec(raw);
		if (heading) {
			section = heading[1]!.trim();
			return;
		}
		if (raw.trim() === '') return;
		// A table row is one obligation per cell-group, not one per line; treating the whole row as a unit is
		// correct here because the binding that governs it is cited at the table head or in the row itself.
		const parts = raw.startsWith('|') ? [raw] : raw.split(/(?<=[.!?])\s+(?=[A-Z*`])/);
		for (const p of parts) out.push({ line: i + 1, section, text: p });
	});
	return out;
}

function measure(text: string): Row[] {
	const sentences = sentencesOf(text);
	// Exclusion LATCHES: §11 and §12 are the last two top-level sections, so once the walk enters one it never
	// re-enters in-scope ground. Latching rather than re-testing each sentence is what makes the sub-sections
	// (§11.4's twenty-seven ruling records, §12.5's tables) inherit their parent's exclusion without listing them.
	let excludedBy: string | undefined;
	const rows: Row[] = [];
	for (let i = 0; i < sentences.length; i++) {
		const s = sentences[i]!;
		const hit = NOT_OBLIGATIONS.find(([h]) => s.section.startsWith(h.replace(/^#+\s*/, '')));
		if (hit) excludedBy = hit[0];
		// Strip code spans before looking for the modality, so `SHALL` inside a quoted identifier is not an
		// obligation of this document.
		const bare = s.text.replace(/`[^`]*`/g, '');
		if (!/\bSHALL\b/.test(bare)) continue;
		const window = [sentences[i - 1]?.text ?? '', s.text, sentences[i + 1]?.text ?? ''].join(' ');
		rows.push({
			line: s.line,
			section: s.section,
			inScope: !excludedBy,
			bound: NAMES_A_CHECK.test(window),
			text: s.text.replace(/\s+/g, ' ').trim().slice(0, 140)
		});
	}
	return rows;
}

// ── SELFTEST: the matcher must report both a HIT and a MISS on literal input ─────────────────────────────────
//
// The header explains why. A matcher that returned true for everything would report perfect binding and would be
// indistinguishable, in the summary, from a specification that had actually been bound.
const MUST_MATCH = [
	'SPEC-001-NF-22',
	'SPEC-001-PF-49',
	'FX-O4-05',
	'SPEC-001-FX-DISC-01',
	'SPEC-001-FIX-O-2-07N',
	'SPEC-001-CHK-ABSENCE',
	'undertaking-scope.e2e.ts',
	'query-scope.test.ts'
];
const MUST_NOT_MATCH = ['no check is named here', 'SHALL be explicit', 'see the section above', ''];
const selftestFailures = [
	...MUST_MATCH.filter((s) => !NAMES_A_CHECK.test(s)).map((s) => `should MATCH but did not: ${s}`),
	...MUST_NOT_MATCH.filter((s) => NAMES_A_CHECK.test(s)).map(
		(s) => `should NOT match but did: ${s}`
	)
];
if (selftestFailures.length > 0) {
	console.error('SELFTEST FAILED — the counter cannot be trusted:');
	for (const f of selftestFailures) console.error(`  ${f}`);
	process.exit(2);
}

// An explicit path lets the same instrument be pointed at an OLDER revision (`git show HEAD:… > /tmp/x.md`), which
// is the only way a before/after claim about this document can be re-derived rather than remembered.
const target = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : SPEC;
const rows = measure(readFileSync(target, 'utf8'));
const inScope = rows.filter((r) => r.inScope);
const bound = inScope.filter((r) => r.bound).length;
const excluded = rows.length - inScope.length;

console.log(`SELFTEST: ok (${MUST_MATCH.length} hits, ${MUST_NOT_MATCH.length} misses)\n`);
console.log(`normative SHALL/SHALL NOT sentences: ${rows.length}`);
console.log(`  EXCLUDED as settled records (§11 forks, §12 review): ${excluded}`);
console.log(`  IN SCOPE: ${inScope.length}`);
console.log(
	`    BOUND (a check named within +/-1 sentence): ${bound} (${((bound / inScope.length) * 100).toFixed(1)}%)`
);
console.log(`    UNBOUND: ${inScope.length - bound}`);

if (process.argv.includes('--list')) {
	const n = Number(process.argv[process.argv.indexOf('--list') + 1] ?? 30);
	console.log('\nUNBOUND, in document order:');
	for (const r of inScope.filter((r) => !r.bound).slice(0, n))
		console.log(`  :${String(r.line).padStart(5)}  [${r.section.slice(0, 28)}]  ${r.text}`);
}
