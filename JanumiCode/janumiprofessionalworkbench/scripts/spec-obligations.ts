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

// ── THE SECOND DEFECT, FOUND 2026-07-29: THE WINDOW WAS WRONG, AND THE SELFTEST COULD NOT SEE IT ─────────────
//
// The header above describes a first counter that was wrong and wrongly trusted, and the selftest at the bottom
// was the answer to it. That selftest exercises the MATCHER — it feeds `NAMES_A_CHECK` literal strings and
// demands both a hit and a miss. It says NOTHING about the WINDOW, which is the other half of the measurement,
// and the window was too narrow by roughly a factor of two.
//
// This document's authoring convention is one obligation per PARAGRAPH, with its check named in a
// `*Verification:*` clause at the END of that paragraph — commonly four or five sentences after the SHALL:
//
//     **O-8-R1 (SHALL).** A Surface presenting a PWU SHALL disclose that PWU's material uncertainty. Restating
//     the master in full … Cf. JCUX SCREEN-INV-006 … *Verification:* `SPEC-001-FX-08-01` seeds a PWU with …
//
// A +/-1 SENTENCE window cannot reach it. Measured: 48.4% bound at +/-1 sentence, 80.8% at paragraph scope. So
// the "397 unbound" this script reported — quoted to the sponsor, written into a work-package brief, and used to
// scope a roadmap — was substantially an artefact of the window, exactly as its predecessor's 509 was an artefact
// of the matcher.
//
// THE WINDOW IS THEREFORE THE PARAGRAPH, and the selftest below now exercises it. Paragraph scope is not a
// neutral choice and it errs the other way: a paragraph holding TWO obligations and ONE check binds both. That
// over-count is declared rather than hidden — see `--strict`, which reports the +/-1 figure alongside, so the two
// bracket the truth instead of one of them pretending to be it.
function paragraphIndex(lines: readonly string[]): number[] {
	const idx: number[] = [];
	let n = 0;
	let blank = true;
	for (const line of lines) {
		if (line.trim() === '') {
			blank = true;
			idx.push(-1);
			continue;
		}
		if (blank) n += 1;
		blank = false;
		idx.push(n);
	}
	return idx;
}

/** Split into sentences WITHOUT discarding table rows — the first counter's second defect. */
function sentencesOf(text: string): { line: number; section: string; text: string; para: number }[] {
	const out: { line: number; section: string; text: string; para: number }[] = [];
	let section = '(front matter)';
	const lines = text.split('\n');
	const paras = paragraphIndex(lines);
	lines.forEach((raw, i) => {
		// `(?!\s)` pins `\s+` to the MAXIMAL whitespace run. It changes no answer: `.` cannot cross a line
		// terminator, so `(.*)$` succeeds from a position only if the rest of the line holds none — and if that
		// holds anywhere inside the run it holds at its end, so the shorter runs greedy `\s+` would have
		// backtracked into can never rescue a failure. Same accepted language, same capture; what goes away is
		// the quadratic `\s+`/`.*` handoff those doomed retries cost on a line like `#   x\ry`.
		const heading = /^#{1,4}\s+(?!\s)(.*)$/.exec(raw);
		if (heading) {
			section = heading[1]!.trim();
			return;
		}
		if (raw.trim() === '') return;
		// ── TWO MORE THINGS THAT ARE NOT OBLIGATIONS OF THIS DOCUMENT (found 2026-07-29 by reading all 38) ──────
		//
		// (a) QUOTED MASTER TEXT. §3's invariants are built by quoting the governing rule from JCUX / RIWS / CPM
		//     — `*"UI components SHALL issue semantic Commands."*` — and then stating THIS document's obligation
		//     beneath it. The quotation is grounding, not a SHALL this specification owes a check for; the check
		//     belongs to the invariant that cites it. Counting both double-counts the same rule and reports the
		//     quotation as unbound forever, because a quotation can never carry a `*Verification:*`.
		// (b) FORK OPTION TEXT outside §11. `NOT_OBLIGATIONS` already excludes §11's fork records for exactly this
		//     reason — "Options: (a) SHALL …" is a decision record. FORK-18 lives in §2.9.5, so the section-based
		//     exclusion misses it while the identical reasoning applies.
		//
		// Both are STRIPPED rather than skipped, so a line carrying a quotation AND this document's own obligation
		// keeps the obligation. Neither is a heuristic for "looks unbound": a quotation is identifiable by its own
		// markup, and an option line by the `*Options:*` marker the document uses for nothing else.
		const line = raw
			.replace(/\*"[^"]*"\*/g, ' ')
			.replace(/\*Options:\*.*$/, ' ')
			.replace(/^\s*\*\*FORK-\d+\b.*$/, ' ');
		if (line.trim() === '') return;
		// A table row is one obligation per cell-group, not one per line; treating the whole row as a unit is
		// correct here because the binding that governs it is cited at the table head or in the row itself.
		const parts = line.startsWith('|') ? [line] : line.split(/(?<=[.!?])\s+(?=[A-Z*`])/);
		for (const p of parts) out.push({ line: i + 1, section, text: p, para: paras[i] ?? -1 });
	});
	return out;
}

function measure(text: string, strict = false): Row[] {
	const sentences = sentencesOf(text);
	// The paragraph each sentence belongs to, joined once. This is the WINDOW — see the note above `paragraphIndex`
	// for why +/-1 sentence was wrong and by how much.
	const paragraphText = new Map<number, string>();
	for (const s of sentences)
		if (s.para >= 0) paragraphText.set(s.para, `${paragraphText.get(s.para) ?? ''} ${s.text}`);
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
		// `--strict` keeps the OLD +/-1 sentence window, deliberately retained rather than deleted: paragraph scope
		// over-binds where one paragraph carries two obligations and one check, and +/-1 under-binds wherever the
		// `*Verification:*` clause trails. Reporting both BRACKETS the truth; reporting either alone is what put a
		// wrong number into a roadmap twice.
		const window = strict
			? [sentences[i - 1]?.text ?? '', s.text, sentences[i + 1]?.text ?? ''].join(' ')
			: (paragraphText.get(s.para) ?? s.text);
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
// ── AND THE WINDOW, WHICH THE MATCHER SELFTEST ABOVE NEVER TOUCHED ───────────────────────────────────────────
//
// The matcher selftest was written as the answer to a counter that was wrong. It proved one half of the
// measurement and left the other half — HOW FAR the counter looks for the check — completely unexercised. That
// half was wrong by roughly a factor of two, and nothing here could have told anyone. A selftest that validates
// the component you were already thinking about is the easiest kind to write and the least useful.
//
// This exercises the window on a fixture with the document's real shape: a SHALL whose `*Verification:*` clause
// trails four sentences later, in the same paragraph.
const WINDOW_FIXTURE = [
	'### 2.9.9 Fixture section',
	'',
	'**O-9-R1 (SHALL).** A Surface SHALL do the thing. Restating the master in full — CON-000 AX-3.',
	'Cf. some other document. And another clause entirely. *Verification:* `SPEC-001-FX-09-01` seeds a fixture.',
	'',
	'**O-9-R2 (SHALL).** A Surface SHALL do a second thing, and nothing anywhere names a check for it.',
	''
].join('\n');

// ── AND THE TWO STRIPS, WHICH ARE THE EASIEST THING HERE TO TURN INTO GAMING ─────────────────────────────────
//
// Quoted-master and fork-option stripping REMOVE obligations from the denominator. That is the one kind of edit
// that improves the headline without improving anything, so each strip is pinned to a fixture proving it removes
// the thing it names AND leaves a real obligation on the same line standing. Without the second half, "strip
// quotations" degrades into "strip lines containing quotation marks" and the count falls for free.
const STRIP_FIXTURE = [
	'### 4.4.4 Strip fixture',
	'',
	'**Master — RIWS §2** (`x:1-2`): *"A Surface SHALL do the quoted thing."* And this document SHALL do its own',
	'thing. *Verification:* `SPEC-001-FX-99-01`.',
	'',
	'**FORK-99 — is it a SHALL or a SHOULD?** *Options:* (a) SHALL — everything; (b) SHOULD — less.',
	''
].join('\n');
const stripped = measure(STRIP_FIXTURE);
const stripFailures = [
	// The quoted SHALL is gone; the document's own SHALL on the SAME LINE survives and is bound by its trailing
	// *Verification:*. One row, bound.
	stripped.length !== 1
		? `strip: expected exactly 1 surviving obligation, got ${stripped.length} [${stripped.map((r) => r.text.slice(0, 30)).join(' | ')}]`
		: '',
	stripped.length === 1 && !stripped[0]!.bound ? 'strip: the surviving obligation must stay BOUND' : '',
	stripped.length === 1 && /quoted thing/.test(stripped[0]!.text)
		? 'strip: the QUOTED obligation survived — the quotation strip is not working'
		: ''
].filter((m) => m !== '');

const windowed = measure(WINDOW_FIXTURE);
const strictly = measure(WINDOW_FIXTURE, true);
const boundIds = (rows: Row[]): string[] =>
	rows.filter((r) => r.bound).map((r) => /O-9-R\d/.exec(r.text)?.[0] ?? r.text.slice(0, 20));

// THE FIXTURE PROVED MORE THAN IT WAS BUILT TO. It was written expecting strict to bind NOTHING — the trailing
// `*Verification:*` being out of reach. Strict binds ONE, and it is the WRONG ONE: O-9-R2, whose +/-1 window
// reaches BACKWARDS across the blank line into O-9-R1's check. So the old window was defective in both
// directions at once — blind to a check four sentences ahead, and crediting an obligation with the *previous*
// obligation's fixture. Those two errors partially cancel in aggregate, which is precisely why 48.4% looked like
// a measurement rather than an artefact.
const windowFailures = [
	boundIds(windowed).join(',') !== 'O-9-R1'
		? `paragraph window: expected only O-9-R1 bound, got [${boundIds(windowed).join(',')}]`
		: '',
	windowed.length !== 2 ? `paragraph window: expected 2 obligations, got ${windowed.length}` : '',
	boundIds(strictly).join(',') !== 'O-9-R2'
		? `strict window: expected it to MISS O-9-R1 and wrongly bind O-9-R2, got [${boundIds(strictly).join(',')}]`
		: ''
].filter((m) => m !== '');

if (selftestFailures.length + windowFailures.length + stripFailures.length > 0) {
	console.error('SELFTEST FAILED — the counter cannot be trusted:');
	for (const f of [...selftestFailures, ...windowFailures, ...stripFailures]) console.error(`  ${f}`);
	process.exit(2);
}

// An explicit path lets the same instrument be pointed at an OLDER revision (`git show HEAD:… > /tmp/x.md`), which
// is the only way a before/after claim about this document can be re-derived rather than remembered.
const target = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : SPEC;
const STRICT = process.argv.includes('--strict');
const rows = measure(readFileSync(target, 'utf8'), STRICT);
const inScope = rows.filter((r) => r.inScope);
const bound = inScope.filter((r) => r.bound).length;
const excluded = rows.length - inScope.length;

console.log(`SELFTEST: ok (${MUST_MATCH.length} hits, ${MUST_NOT_MATCH.length} misses)\n`);
console.log(`normative SHALL/SHALL NOT sentences: ${rows.length}`);
console.log(`  EXCLUDED as settled records (§11 forks, §12 review): ${excluded}`);
console.log(`  IN SCOPE: ${inScope.length}`);
console.log(
	`    BOUND (a check named ${STRICT ? 'within +/-1 sentence — THE DEFECTIVE WINDOW, see the note on paragraphIndex' : 'in the same paragraph'}): ${bound} (${((bound / inScope.length) * 100).toFixed(1)}%)`
);
console.log(`    UNBOUND: ${inScope.length - bound}`);

if (process.argv.includes('--list')) {
	const n = Number(process.argv[process.argv.indexOf('--list') + 1] ?? 30);
	console.log('\nUNBOUND, in document order:');
	for (const r of inScope.filter((r) => !r.bound).slice(0, n))
		console.log(`  :${String(r.line).padStart(5)}  [${r.section.slice(0, 28)}]  ${r.text}`);
}
