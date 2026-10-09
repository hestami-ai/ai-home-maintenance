/**
 * ⭐⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`; design D2 under the sponsor's answer (a) of 2026-10-03) — THE PURE HALF OF THE FENCE
 * SKELETON'S GENERATOR: the committed Unicode inputs and the stated supplement in, the table `review-fence.ts` reads by
 * eye out.
 *
 * ── ⛔ WHY A GENERATED TABLE, AND NOT THE RUNTIME'S OWN UNICODE ──────────────────────────────────────────────────────
 * The skeleton was `normalize('NFKC')`, a hand-written table of 134 lookalikes, `toLowerCase()` and a `\p{…}` deletion —
 * three of the four read from the RUNTIME's Unicode tables. Measured over every code point (`REG-F-481`): bun 1.3.14
 * (Unicode 15.0) and node v24 (Unicode 16.0) disagreed on 102 code points, so one slice could get one fence under the
 * qualification scripts (bun) and another in production (node); and the hand table missed 78 of TR39's 287 lookalikes
 * of the fence's letters and 138 of its 302 lookalikes of the digits (measured through the chooser; fifteen of them
 * driven end to end into a forged host block a reader saw outside every fence). Now the skeleton is ONE lookup per code
 * point in a module this file writes from ONE pinned Unicode version and a stated supplement, so it reads alike in
 * every runtime (`verif/fence-skeleton-determinism.test.ts`), and its lookalikes are Unicode's own and the supplement's
 * (`verif/fence-skeleton-table.test.ts` regenerates the module and compares it byte for byte: a derived artifact is
 * never edited by hand).
 *
 * ── ⭐ WHAT THE TABLE SAYS OF EACH CODE POINT: EVERY READING A READER MAY GIVE IT ─────────────────────────────────────
 * A code point reads as NOTHING (deleted), as FENCE CHARACTERS, or as itself — and a reader that may take it more than
 * one way takes it every way: the table holds the SET of its readings — every reading EACH rule below gives it, none
 * withheld because another rule gave one already — and the chooser counts a candidate that any choice of them spells
 * (`review-fence.ts`). ⛔ IT KEPT ONE READING (`REG-F-481`; `REG-D-013`, guarantee strength first):
 * U+1C84 CYRILLIC SMALL LETTER TALL TE, which TR39 reads as 7 and whose capital reads as T, read as 7 alone, and U+01BD
 * LATIN SMALL LETTER TONE FIVE as S alone though its capital reads as 5 — and a forged host block spelled with the
 * reading dropped stood outside every fence in every framing (driven). Each rule adds its readings:
 *   1. NOTHING — a character a reader does not see as one: `Default_Ignorable_Code_Point`, and the general categories
 *      `Cf`, `Mn`, `Zs`, and every `Cc` but the five line terminators (LF, CR, VT, FF, U+0085). ⛔ NEVER A LINE
 *      TERMINATOR IN THE TABLE: U+2028 and U+2029 are in none of those classes, and the five `Cc` are excepted by name.
 *      Whether a reader breaks a line at one is the chooser's question, not the table's (`review-fence.ts` reads every
 *      terminator but LF as a break AND as nothing).
 *   2. TR39 — each skeleton of the code point (UTS #39: NFD, `confusables.txt`, NFD; and with the supplement's prototype
 *      beside TR39's mapping), WITH THE CODE POINTS RULE 1 DELETES REMOVED FROM IT, when each of its characters reads as
 *      a fence character: as the skeleton of one, ASCII case aside (U+22D8 reads as `<<<`, U+A74E as `00`), or, failing
 *      that, through the TR39 skeleton of that CHARACTER's own simple uppercase or lowercase mapping — U+10F3 GEORGIAN
 *      LETTER WE, which TR39 writes as U+021D LATIN SMALL LETTER YOGH, reads as 3 because the capital yogh does. Taken
 *      of the code point itself AND of its simple uppercase and lowercase mappings ("either case": the Cyrillic small te
 *      U+0442 reads as `T` because its capital U+0422 does). The fence characters are `< > - U N T R S E D 0-9`.
 *      ⛔ THE DELETION APPLIES TO THE PROTOTYPE TOO (`REG-F-481`): TR39 writes U+00D8 (O WITH STROKE) as O + U+0338,
 *      U+0110 (D WITH STROKE) as D + U+0335 and the Latin eng as n + U+0329 — a fence character and a mark. Read
 *      without the deletion, each read as itself while the same glyph TYPED as the letter and the mark read as the
 *      letter (the mark is deleted), and a forged host block planted with one stood outside every fence in every
 *      framing.
 *      ⛔ AND IN EITHER CASE FOR THE PROTOTYPE'S OWN CHARACTERS (`REG-F-481`): the rule was taken of the code point
 *      only, so the Latin yogh, the Latin reversed open e and the Latin tone two read as 3, 3 and 2 through their
 *      capitals, while U+10F3, U+1D08 and U+1D24, which TR39 writes as those very letters, read as themselves; so did
 *      U+2229 INTERSECTION and U+144E CANADIAN SYLLABICS TI, which TR39 writes as the Armenian capital vo, though that
 *      reads as N (driven: a forged host block planted with each stood outside every fence).
 *   3. ITS COMPATIBILITY DECOMPOSITION — its NFKD, each part read by 1, 2 and 4, every reading of each (or as itself,
 *      when they give it none), every combination that holds a fence character (the fullwidth U+FF10 reads as `0`,
 *      U+1E0C as `D`: its combining dot below is deleted, whatever it composes with).
 *   4. ITS TR39 CLASS — EVERY code point outside ASCII takes, beside whatever 1 to 3 give it, every reading its TR39
 *      class (the code points whose TR39 skeleton, deleted code points removed, is its own) has through a member's
 *      compatibility decomposition of ANY TAG BUT `<compat>`, read part by part by TR39 alone: U+2460 CIRCLED DIGIT ONE
 *      is `<circle>` 1, so U+2780, its own TR39 prototype, reads as 1; U+00BA MASCULINE ORDINAL INDICATOR is `<super>` o,
 *      so U+00B0 DEGREE SIGN (its prototype), and the ring operator and white circles beside it, read as 0.
 *      ⛔ THE COMPATIBILITY READING WAS NOT CARRIED TO ITS CLASS (`REG-F-481`): U+2460 read as 1 and U+2780 as itself,
 *      though TR39 says they are one glyph — U+2780 for the 1 of 01, after an exact 00, closed the real 01 (driven).
 *      ⛔ AND IT WAS CARRIED ONLY TO A MEMBER 1 TO 3 LEFT READING AS ITSELF (`REG-F-481`; `REG-D-013`): TR39 maps
 *      U+0675 ARABIC LETTER HIGH HAMZA ALEF, U+0672, U+FE83 and U+FE84 to one prototype, and U+FE83 is `<isolated>`
 *      alef with hamza above, its hamza a mark rule 1 deletes, so the class reads as 1 — but U+0675 read as 1 then
 *      U+0674 ARABIC LETTER HIGH HAMZA by its own `<compat>` decomposition (rule 3), so its class's 1 was withheld, and
 *      U+0675 for the 1 of 01, after an exact 00, closed the real 01 in every framing (driven). Now every member outside
 *      ASCII carries every reading of its class, and so does every part rule 3 reads (`verif/fence-skeleton-table.test.ts`
 *      holds the first over the whole of TR39: THE CENSUS).
 *      ⚠ `<compat>` is excluded: it joins glyphs that differ (U+03F9 GREEK CAPITAL LUNATE SIGMA SYMBOL is `<compat>`
 *      sigma, and its class is C's), so a class read through it would read every C as 0. And NO ASCII code point is
 *      given a class reading.
 *   Every reading of every rule is kept (`fenceSkeletonTable`).
 * ⚠ OVER-READING IS THE SAFE DIRECTION: a character read as a fence character that a reader would in fact tell apart
 * costs one candidate, never a fence (`m` reads as `RN`, as TR39 says it can).
 *
 * ── ⭐ THE STATED SUPPLEMENT (`supplement.ts`; `REG-F-481`, `REG-D-013`) ─────────────────────────────────────────────
 * TR39 is about identifiers, not fence lines, so it holds the CJK angle brackets, the guillemets, the dashes of several
 * scripts and the small capitals N, T, E and D confusable with none of the fence's characters — though a reader sees a
 * fence line written with them (the hand-written table this module replaced read 29 of them). The supplement lists
 * them, and the blanks outside every deleted class (U+2800 BRAILLE PATTERN BLANK), as a fifth input read by the same
 * rules: a line's reading is a prototype of its code point BESIDE TR39's; a blank is deleted. ⭐ AND IT IS CLOSED UNDER
 * TR39'S CLASSES BOTH WAYS (`unreadClassMembers`): a code point TR39 maps to a prototype holding one the supplement reads
 * (U+304F HIRAGANA KU, which TR39 maps to an angle bracket ornament) is read too, by a rule or by a line of its own; and
 * every other member of a supplemented code point's OWN TR39 class reads as its line says — so no line may read a
 * class whose members a reader takes for something else (U+1400 CANADIAN SYLLABICS HYPHEN, which TR39 holds confusable
 * with `=`, cannot read as `-` while `=` reads as itself). The generator refuses to write a table that is not closed
 * (`generate`, over EVERY mapping of `confusables.txt`, which the extract keeps whole). It is stated and hand-written,
 * never derived; the freshness test regenerates the table from it too.
 *
 * ── ⚠ WHAT IT DOES NOT READ ────────────────────────────────────────────────────────────────────────────────────────
 * A lookalike that neither Unicode nor the supplement lists; one Unicode lists only through a prototype whose characters
 * the table reads only by THEIR compatibility decompositions — U+23E8 DECIMAL EXPONENT SYMBOL, which TR39 writes as a
 * subscript 1 and a subscript 0, and which reads as itself: in Unicode 18.0.0 the one such code point (measured); and a
 * class that only a `<compat>` decomposition reads as fence characters, which rule 4 leaves out on purpose. A line
 * spelled with any of them is only as safe as a reader's eye. That limit is stated, not closed — a lookalike found later
 * is a line added to the supplement. ⭐ Every other member of a class rule 4 reads carries EVERY reading of its class,
 * whatever else it reads as (rule 4; the census).
 *
 * ⛔ PURE: no filesystem, no clock, no runtime Unicode data — every property is read from the inputs handed in.
 */
import { createHash } from 'node:crypto';
import { FENCE_SUPPLEMENT, type SupplementLine } from './supplement.js';

/** ⭐ ONE Unicode version for every input. */
export const UNICODE_VERSION = '18.0.0';

/** Where the committed inputs live, and the module this generates — repo-relative. */
export const INPUT_DIR = `scripts/fence-skeleton/unicode-${UNICODE_VERSION}`;
export const TABLE_MODULE = 'apps/rph-demo/src/lib/server/assurance/fence-skeleton-table.ts';

export type InputKey = 'confusables' | 'unicodeData' | 'derivedCoreProperties' | 'derivedGeneralCategory';

/** One pinned Unicode source file, and what of it the committed extract keeps. */
export interface UnicodeSource {
	readonly key: InputKey;
	/** The source file's own name. */
	readonly file: string;
	readonly url: string;
	/** sha256 of the WHOLE source file, as published. */
	readonly sha256: string;
	/** The committed extract's file name, in `INPUT_DIR`. */
	readonly extract: string;
	/** The rule the extract keeps lines by — stated in its header. */
	readonly kept: string;
}

/**
 * ⭐ THE FOUR INPUTS, EACH PINNED BY THE SHA-256 OF THE WHOLE FILE AS UNICODE PUBLISHES IT. The extracts carry the same
 * three facts in their headers, and the generator refuses an extract whose header names another file, version or hash.
 *
 * ⭐ `confusables.txt` IS KEPT WHOLE, ITS COMMENTS ASIDE (`REG-F-481`; `REG-D-013`): rules 2 and 4 read a prototype's
 * characters in either case and a TR39 class whole, so a mapping whose target is not ASCII (U+10F3 to the yogh, U+2460
 * to U+2780) can decide a reading — and the supplement's closure is a question about every class. With every mapping
 * committed, both are answered on every gate (`generate`), not only when the extract is cut.
 */
export const SOURCES: readonly UnicodeSource[] = [
	{
		key: 'confusables',
		file: 'confusables.txt',
		url: `https://www.unicode.org/Public/${UNICODE_VERSION}/security/confusables.txt`,
		sha256: '6ed3ee967c9dfdf6677d563c9985182fbc50a2efb7d6059cd57b2e2ce18f5b92',
		extract: 'confusables.extract.txt',
		kept:
			'the data fields (the text before "#") of every mapping - the generator reads a prototype\'s characters in ' +
			'either case and each TR39 class whole, and checks the supplement closed over every class'
	},
	{
		key: 'unicodeData',
		file: 'UnicodeData.txt',
		url: `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/UnicodeData.txt`,
		sha256: '0736451de439ae7baf1425136617da495e09ee5afbe6e394374db7009ea08950',
		extract: 'UnicodeData.extract.txt',
		kept:
			'fields 0, 5, 12 and 13 (the code point, its decomposition, its simple uppercase and its simple lowercase), ' +
			'joined by ";", of every line whose field 5, 12 or 13 is not empty'
	},
	{
		key: 'derivedCoreProperties',
		file: 'DerivedCoreProperties.txt',
		url: `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/DerivedCoreProperties.txt`,
		sha256: '09c928886a178fcafd93c29e4bd59073a058e5a100b716d425cb563ab50f68c9',
		extract: 'DerivedCoreProperties.extract.txt',
		kept: 'the data fields (the text before "#") of every line of the property Default_Ignorable_Code_Point'
	},
	{
		key: 'derivedGeneralCategory',
		file: 'DerivedGeneralCategory.txt',
		url: `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/extracted/DerivedGeneralCategory.txt`,
		sha256: 'd6b151d2d40ee9b1876d26f417980f45ffae47b6055ccf7203cb31f07a030f94',
		extract: 'DerivedGeneralCategory.extract.txt',
		kept: 'the data fields (the text before "#") of every line of the general categories Cc, Cf, Mn and Zs'
	}
];

/** The fence's own alphabet, each character as the skeleton writes it (`<<<UNTRUSTED-nn>>>`). */
export const FENCE_ALPHABET = '<>-UNTRSED0123456789';

/** ⛔ The five line terminators that are controls — never deleted, never read as anything but themselves. */
export const LINE_TERMINATOR_CONTROLS: readonly number[] = [0x0a, 0x0b, 0x0c, 0x0d, 0x85];
/** And the two that are not controls, held to the same rule. */
export const LINE_SEPARATORS: readonly number[] = [0x2028, 0x2029];

/** The general categories the skeleton deletes (`Cc` less the line terminators). */
export const DELETED_CATEGORIES: readonly string[] = ['Cc', 'Cf', 'Mn', 'Zs'];
/** The property the skeleton deletes. */
export const DELETED_PROPERTY = 'Default_Ignorable_Code_Point';

/** The header lines every extract opens with — the source's name, version, address, hash and the rule it keeps. */
export function extractHeader(source: UnicodeSource): string[] {
	return [
		`# EXTRACT of ${source.file} (Unicode ${UNICODE_VERSION}) - not the whole file.`,
		`# Source: ${source.url}`,
		`# sha256 of the whole source file: ${source.sha256}`,
		`# Kept: ${source.kept}`,
		'# Written by scripts/fence-skeleton/extract.ts; read by scripts/fence-skeleton/core.ts.'
	];
}

/**
 * ⛔ A WHOLE SOURCE FILE, REFUSED UNLESS ITS SHA-256 IS THE ONE `SOURCES` PINS — so an extract can only be cut from the
 * Unicode 18.0.0 file itself, never from a file that merely has its name. Its text, when it is the pinned file.
 */
export function checkedWhole(source: UnicodeSource, bytes: Uint8Array): string {
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	if (sha256 !== source.sha256)
		throw new Error(`${source.file} has sha256 ${sha256}, not the pinned ${source.sha256} (${source.url})`);
	return Buffer.from(bytes).toString('utf8');
}

/** The data part of a UCD line (before `#`), trailing blanks removed — `''` for a comment or blank line. */
function dataOf(line: string): string {
	const hash = line.indexOf('#');
	return (hash < 0 ? line : line.slice(0, hash)).replace(/\s+$/, '');
}

/** Every data line of a whole UCD file, in order — what an extract's rule is applied to. */
export function dataLinesOf(whole: string): string[] {
	const body = whole.codePointAt(0) === 0xfeff ? whole.slice(1) : whole;
	return body
		.split(/\r?\n/)
		.map(dataOf)
		.filter((data) => data !== '');
}

/** The hex code points of a space-separated field. */
function codePointsOf(field: string): number[] {
	return field
		.trim()
		.split(/\s+/)
		.filter((h) => h !== '')
		.map((h) => Number.parseInt(h, 16));
}

/** The `i`th `;`-separated field of a data line, trimmed. */
function fieldOf(data: string, i: number): string {
	return (data.split(';')[i] ?? '').trim();
}

/** ⭐ EACH SOURCE'S RULE (`UnicodeSource.kept`): the line its extract keeps for one data line, or `undefined`. */
const KEEP: Readonly<Record<InputKey, (data: string) => string | undefined>> = {
	confusables: (data) => data,
	unicodeData: (data) => {
		const f = data.split(';');
		return f[5] || f[12] || f[13] ? [f[0], f[5], f[12], f[13]].join(';') : undefined;
	},
	derivedCoreProperties: (data) => (fieldOf(data, 1) === DELETED_PROPERTY ? data : undefined),
	derivedGeneralCategory: (data) => (DELETED_CATEGORIES.includes(fieldOf(data, 1)) ? data : undefined)
};

/**
 * ⭐ THE FOUR EXTRACTS, CUT FROM THE FOUR WHOLE FILES — each its header, then the lines its rule keeps, in the source's
 * order. `wholes` are the source files' texts, each already checked against its pinned hash (`checkedWhole`).
 */
export function extractsOf(wholes: Record<InputKey, string>): Record<InputKey, string> {
	const extracts = {} as Record<InputKey, string>;
	for (const source of SOURCES) {
		const kept = dataLinesOf(wholes[source.key]).flatMap((data) => KEEP[source.key](data) ?? []);
		extracts[source.key] = `${[...extractHeader(source), ...kept].join('\n')}\n`;
	}
	return extracts;
}

/** An extract's data lines, after its header is checked against `source` — ⛔ a mismatched header is refused. */
export function readExtract(source: UnicodeSource, text: string): string[] {
	const lines = text.split('\n');
	const header = extractHeader(source);
	header.forEach((expected, i) => {
		if (lines[i] !== expected)
			throw new Error(
				`${source.extract}: header line ${i + 1} is ${JSON.stringify(lines[i])}, not ${JSON.stringify(expected)} - ` +
					'an extract must name its source file, Unicode version, hash and rule exactly as SOURCES pins them'
			);
	});
	if (text.at(-1) !== '\n') throw new Error(`${source.extract}: no final newline`);
	return lines.slice(header.length, -1);
}

/** Every extract's data lines, each header checked. */
export function extractLines(extracts: Record<InputKey, string>): Record<InputKey, string[]> {
	return Object.fromEntries(SOURCES.map((s) => [s.key, readExtract(s, extracts[s.key])])) as Record<InputKey, string[]>;
}

/** What the generator reads, parsed. */
export interface UnicodeData {
	/** Source code point → its prototype, as TR39 maps it. */
	readonly confusables: ReadonlyMap<number, string>;
	/** Code point → the prototype the stated supplement gives it (`supplement.ts`), read beside TR39's. */
	readonly supplement: ReadonlyMap<number, string>;
	/** Code point → its decomposition mapping, whether that mapping is a compatibility one, and its tag (`<font>` …). */
	readonly decompositions: ReadonlyMap<
		number,
		{ readonly compat: boolean; readonly tag: string; readonly parts: readonly number[] }
	>;
	readonly upper: ReadonlyMap<number, number>;
	readonly lower: ReadonlyMap<number, number>;
	/** Every code point the skeleton deletes. */
	readonly deleted: ReadonlySet<number>;
}

/** The code points of a UCD range field — `0000..001F` or `00AD`. */
function rangeOf(field: string): [number, number] {
	const [lo, hi] = field.trim().split('..');
	const first = Number.parseInt(lo!, 16);
	return [first, hi === undefined ? first : Number.parseInt(hi, 16)];
}

/**
 * Parse the four inputs' data lines, and read the supplement into them. `lines.confusables` may be the extract's or —
 * for `checkedCut`'s check that the extract loses nothing — every mapping of the whole file.
 */
export function parseUnicode(
	lines: Record<InputKey, readonly string[]>,
	supplement: readonly SupplementLine[] = FENCE_SUPPLEMENT
): UnicodeData {
	const tr39 = new Map<number, string>();
	for (const line of lines.confusables) {
		const [src, tgt] = line.split(';');
		const from = codePointsOf(src ?? '');
		if (from.length !== 1) throw new Error(`confusables: a source of ${from.length} code points: ${line}`);
		tr39.set(from[0]!, String.fromCodePoint(...codePointsOf(tgt ?? '')));
	}
	const decompositions = new Map<number, { compat: boolean; tag: string; parts: number[] }>();
	const upper = new Map<number, number>();
	const lower = new Map<number, number>();
	for (const line of lines.unicodeData) {
		const [cp, decomposition, up, low] = line.split(';');
		const code = Number.parseInt(cp!, 16);
		if (decomposition) {
			const compat = decomposition.startsWith('<');
			decompositions.set(code, {
				compat,
				tag: compat ? decomposition.slice(0, decomposition.indexOf('>') + 1) : '',
				parts: codePointsOf(compat ? decomposition.slice(decomposition.indexOf('>') + 1) : decomposition)
			});
		}
		if (up) upper.set(code, Number.parseInt(up, 16));
		if (low) lower.set(code, Number.parseInt(low, 16));
	}
	const deleted = new Set<number>();
	const addRange = (field: string) => {
		const [first, last] = rangeOf(field);
		for (let cp = first; cp <= last; cp += 1) deleted.add(cp);
	};
	for (const line of lines.derivedCoreProperties) {
		const [range, property] = line.split(';').map((f) => f.trim());
		if (property !== DELETED_PROPERTY) throw new Error(`DerivedCoreProperties: an unexpected line: ${line}`);
		addRange(range!);
	}
	for (const line of lines.derivedGeneralCategory) {
		const [range, category] = line.split(';').map((f) => f.trim());
		if (!DELETED_CATEGORIES.includes(category!)) throw new Error(`DerivedGeneralCategory: an unexpected line: ${line}`);
		addRange(range!);
	}
	// ⛔ NEVER A LINE TERMINATOR: the five controls are excepted by name, and the two separators are in no deleted class.
	for (const cp of LINE_TERMINATOR_CONTROLS) deleted.delete(cp);
	for (const cp of LINE_SEPARATORS)
		if (deleted.has(cp)) throw new Error(`U+${hex(cp)} is in a deleted class: a skeleton would join two lines`);
	// ⭐ THE SUPPLEMENT, READ AS TR39'S OWN LINES ARE: a line's reading is a prototype of its code point, BESIDE TR39's
	// for it, and then every rule reads it as it reads TR39's; a blank is deleted. ⚠ A line reads ITS OWN code point: the
	// rest of a TR39 class it reads is read by a line of its own, or by a rule that reads it already
	// (`unreadClassMembers`) — so the Cyrillic small te, which TR39 maps to the small capital T, is still read by the
	// either-case rule alone, and dropping that rule un-reads it.
	const supplemented = supplementReadings(supplement, tr39, decompositions, deleted);
	for (const line of supplement) if (line.reads === '') deleted.add(line.cp);
	return { confusables: tr39, supplement: supplemented, decompositions, upper, lower, deleted };
}

/**
 * ⭐ THE SUPPLEMENT IS CLOSED UNDER TR39'S CLASSES, BOTH WAYS — the code points the table leaves unread or reads
 * otherwise, in order of the two questions; `[]` when closed:
 *   · INTO THE SUPPLEMENT: a code point TR39 maps to a prototype made, once its deleted code points are removed, of
 *     fence characters and code points the supplement reads (U+304F HIRAGANA KU, which TR39 maps to U+276C, an angle
 *     bracket the supplement reads as `<`), and which the table does not read;
 *   · OUT OF IT: a member of a supplemented code point's OWN TR39 class (the code points whose TR39 skeleton, deleted
 *     code points removed, is its own) that the table does not read as the line says. ⛔ IT WAS ONE WAY (`REG-F-481`):
 *     the supplement read U+1400, U+2E40, U+30A0 and U+301C as `-`, though TR39 holds the first three confusable with
 *     `=` and the last with `~` — and `=` and `~` read as themselves, so a reader who takes U+1400 for a hyphen, as the
 *     line said, could not tell it from `=`, and `=` planted for the hyphen stood outside every fence (driven).
 *
 * ⛔ `lines.confusables` MUST BE EVERY MAPPING OF THE WHOLE `confusables.txt` — which the committed extract is — so
 * `generate` asks this on every gate, and `checkedCut` of the whole file before an extract is written.
 */
export function unreadClassMembers(
	lines: Record<InputKey, readonly string[]>,
	table: FenceSkeletonTable,
	supplement: readonly SupplementLine[] = FENCE_SUPPLEMENT
): number[] {
	const data = parseUnicode(lines, supplement);
	const tr39 = data.confusables;
	// Each code point as the table reads it, every reading: a deleted one reads as nothing, so a prototype's marks fall
	// away here.
	const read = readingsOf(table);
	const supplemented = new Map(supplement.flatMap((line) => (line.reads === '' ? [] : [[line.cp, line.reads] as const])));
	const readsAsFence = (c: string): boolean =>
		FENCE_ALPHABET.includes(c) ||
		(read.get(c.codePointAt(0)!) ?? []).some((r) => [...r].every((f) => FENCE_ALPHABET.includes(f)));
	const unread: number[] = [];
	for (const [cp, prototype] of tr39) {
		const parts = [...prototype];
		const member = parts.some((c) => supplemented.has(c.codePointAt(0)!)) && parts.every(readsAsFence);
		if (member && !read.has(cp)) unread.push(cp);
	}
	// OUT OF IT: each supplemented code point's own class, every code point asked.
	const lineOfClass = new Map<string, string[]>();
	for (const [cp, reads] of supplemented) {
		const key = classOf(data, cp);
		if (key !== '') lineOfClass.set(key, [...(lineOfClass.get(key) ?? []), reads]);
	}
	for (let cp = 0; cp <= 0x10ffff; cp += 1) {
		if (cp >= 0xd800 && cp <= 0xdfff) continue;
		const owed = lineOfClass.get(classOf(data, cp));
		if (owed && !owed.every((reads) => read.get(cp)?.includes(reads)) && !unread.includes(cp)) unread.push(cp);
	}
	return unread;
}

/** Every reading of each code point the table does not leave reading as itself (`''`, deleted, first). */
function readingsOf(table: FenceSkeletonTable): Map<number, string[]> {
	const read = new Map<number, string[]>();
	for (const [first, last] of table.deleted) for (let cp = first; cp <= last; cp += 1) read.set(cp, ['']);
	for (const [cp, reads] of table.mapped) read.set(cp, [...(read.get(cp) ?? []), reads]);
	return read;
}

/**
 * ⛔ THE TABLE IS CLOSED, OR IT IS NOT WRITTEN (`unreadClassMembers`): throws naming each code point the supplement
 * leaves unread, or reads otherwise than its class.
 */
export function assertClosed(
	lines: Record<InputKey, readonly string[]>,
	table: FenceSkeletonTable,
	supplement: readonly SupplementLine[] = FENCE_SUPPLEMENT
): void {
	const unread = unreadClassMembers(lines, table, supplement);
	if (unread.length > 0)
		throw new Error(
			`supplement.ts is not closed under TR39's classes: ${unread.map((cp) => `U+${hex(cp)}`).join(' ')} ` +
				'belong to a class it reads and are not read so - give each a line of its own, or drop the line'
		);
}

/**
 * ⛔ THE EXTRACTOR'S GATE (`extract.ts`): throws unless the extracts cut from the whole files lose nothing the table
 * reads — the table from the extracts is the table from the whole `confusables.txt` beside the other three — and the
 * supplement is closed over the whole file (`assertClosed`). Pure, so the gate is driven by a test with planted inputs,
 * not only when the extract is cut.
 */
export function checkedCut(
	wholes: Record<InputKey, string>,
	extracts: Record<InputKey, string>,
	supplement: readonly SupplementLine[] = FENCE_SUPPLEMENT
): void {
	const cut = extractLines(extracts);
	const whole = { ...cut, confusables: dataLinesOf(wholes.confusables) };
	const table = fenceSkeletonTable(parseUnicode(cut, supplement));
	if (fenceSkeletonModule(table) !== fenceSkeletonModule(fenceSkeletonTable(parseUnicode(whole, supplement))))
		throw new Error('the table from the extracts differs from the table from the whole confusables.txt: the cut loses a mapping');
	assertClosed(whole, table, supplement);
}

/**
 * The supplement's mapped lines, code point → prototype (each fence character written as TR39's prototype of it, as a
 * `confusables.txt` target is).
 *
 * ⛔ IT REFUSES A LINE THE SKELETON WOULD NEVER READ AS IT SAYS: a code point listed twice; a reading that is not fence
 * characters (or `''`, deleted); a line terminator or a fence character, which must read as themselves; a code point
 * with a canonical decomposition, whose parts the skeleton reads, never it; and one already deleted by Unicode's
 * classes, which deletion reads first — that line would state what Unicode already says.
 */
function supplementReadings(
	supplement: readonly SupplementLine[],
	tr39: ReadonlyMap<number, string>,
	decompositions: ReadonlyMap<number, { readonly compat: boolean }>,
	deleted: ReadonlySet<number>
): Map<number, string> {
	const reads = new Map<number, string>();
	const listed = new Set<number>();
	for (const line of supplement) {
		const at = `supplement: U+${hex(line.cp)} ${line.name}`;
		if (listed.has(line.cp)) throw new Error(`${at} is listed twice`);
		listed.add(line.cp);
		if ([...line.reads].some((c) => !FENCE_ALPHABET.includes(c)))
			throw new Error(`${at} reads as ${JSON.stringify(line.reads)}, which is not fence characters`);
		const terminator = [...LINE_TERMINATOR_CONTROLS, ...LINE_SEPARATORS].includes(line.cp);
		if (terminator || FENCE_ALPHABET.includes(String.fromCodePoint(line.cp)))
			throw new Error(`${at} is a line terminator or a fence character, which reads as itself`);
		if (decompositions.get(line.cp)?.compat === false)
			throw new Error(`${at} has a canonical decomposition: the skeleton reads its parts, never it`);
		if (deleted.has(line.cp)) throw new Error(`${at} is deleted by Unicode's own classes already`);
		if (line.reads !== '')
			reads.set(line.cp, [...line.reads].map((c) => tr39.get(c.codePointAt(0)!) ?? c).join(''));
	}
	return reads;
}

/** `cp` as four or more upper-case hex digits. */
function hex(cp: number): string {
	return cp.toString(16).toUpperCase().padStart(4, '0');
}

/** The Hangul syllable decomposition (The Unicode Standard §3.12) — algorithmic, so in no data file. */
const S_BASE = 0xac00;
const L_BASE = 0x1100;
const V_BASE = 0x1161;
const T_BASE = 0x11a7;
const T_COUNT = 28;
const N_COUNT = 588;
const S_COUNT = 11_172;

/** The full decomposition of `cp` — canonical only, or compatibility too (`compat`) — as code points. */
function decompose(data: UnicodeData, cp: number, compat: boolean): number[] {
	const s = cp - S_BASE;
	if (s >= 0 && s < S_COUNT) {
		const t = T_BASE + (s % T_COUNT);
		return [L_BASE + Math.floor(s / N_COUNT), V_BASE + Math.floor((s % N_COUNT) / T_COUNT), ...(t === T_BASE ? [] : [t])];
	}
	const d = data.decompositions.get(cp);
	if (d === undefined || (d.compat && !compat)) return [cp];
	return d.parts.flatMap((part) => decompose(data, part, compat));
}

/** The NFD of a string, code point by code point. */
function nfd(data: UnicodeData, text: string): string {
	return [...text].flatMap((c) => decompose(data, c.codePointAt(0)!, false)).map((p) => String.fromCodePoint(p)).join('');
}

/**
 * The TR39 skeleton of one code point (UTS #39 §4), by TR39's own mappings alone: its NFD, each part mapped to its
 * prototype, NFD again. ⚠ The canonical reordering NFD also does is left out: it moves combining marks among
 * themselves, and a skeleton holding a mark is never a fence character's, so no answer here depends on their order.
 */
function tr39Skeleton(data: UnicodeData, cp: number): string {
	return nfd(
		data,
		decompose(data, cp, false)
			.map((part) => data.confusables.get(part) ?? String.fromCodePoint(part))
			.join('')
	);
}

/** Every skeleton of one code point: TR39's, and each with the supplement's prototype of a part beside TR39's mapping. */
function skeletonsOf(data: UnicodeData, cp: number): string[] {
	let out = [''];
	for (const part of decompose(data, cp, false)) {
		const own = data.confusables.get(part) ?? String.fromCodePoint(part);
		const stated = data.supplement.get(part);
		const options = stated === undefined || stated === own ? [own] : [own, stated];
		out = out.flatMap((head) => options.map((o) => head + o));
	}
	return unique(out.map((mapped) => nfd(data, mapped)));
}

/** Whether `cp` has no TR39 mapping and no canonical decomposition — its TR39 skeleton is itself. */
function ownSkeleton(data: UnicodeData, cp: number): boolean {
	return !data.confusables.has(cp) && (cp < S_BASE || cp >= S_BASE + S_COUNT) && data.decompositions.get(cp)?.compat !== false;
}

/** A code point's TR39 class: its TR39 skeleton with the deleted code points removed (`''` for one wholly deleted). */
function classOf(data: UnicodeData, cp: number): string {
	if (ownSkeleton(data, cp)) return data.deleted.has(cp) ? '' : String.fromCodePoint(cp);
	return [...tr39Skeleton(data, cp)].filter((c) => !data.deleted.has(c.codePointAt(0)!)).join('');
}

/** `xs` once each, in first-seen order. */
function unique(xs: readonly string[]): string[] {
	return [...new Set(xs)];
}

/** Every string that is one of `heads` followed by one of `tails`. */
function product(heads: readonly string[], tails: readonly string[]): string[] {
	return heads.flatMap((head) => tails.map((tail) => head + tail));
}

/**
 * ASCII case folding only — how a prototype's character is matched to a fence character's skeleton. ⚠ Rule 2 reads a
 * prototype's characters in either case besides, ASCII letters included, so the table is the same without this fold
 * (measured): dropping the fold alone reads no lookalike less; dropping it with the case mappings does.
 */
function asciiFold(c: string): string {
	return c >= 'A' && c <= 'Z' ? c.toLowerCase() : c;
}

/**
 * The table a skeleton reads: every reading of each code point it does not leave reading as itself. A code point in
 * `deleted` reads as nothing; one in `mapped` reads as each string an entry gives it (and as nothing too, when it is
 * also deleted); any other reads as itself alone.
 */
export interface FenceSkeletonTable {
	/** Inclusive ranges of the code points that read as nothing, ascending and disjoint. */
	readonly deleted: readonly (readonly [number, number])[];
	/** Code point → one reading (never itself, never empty), ascending by code point and then by reading: a code point
	 *  a reader may take more than one way has an entry for each. */
	readonly mapped: readonly (readonly [number, string])[];
}

/**
 * ⭐ THE TABLE, over every code point but the surrogates: every reading each rule gives each code point (the header,
 * rules 1 to 4).
 *
 * ⛔ IT REFUSES TO EXIST WHEN ITS OWN PREMISES FAIL: a fence character whose skeleton is not one ASCII character, two
 * fence characters a reader could not tell apart, a fence character not read as itself alone, a line terminator
 * deleted or read as anything, or a reading that holds one. Each would make the chooser's "occurs" mean something
 * other than what `review-fence.ts` says it means.
 *
 * ⭐ `fold` — how a prototype's character is matched to a fence character's skeleton, ASCII case aside: `asciiFold`,
 * always, for the table this module writes. It is an INPUT so that it can be dropped as each of the table's other
 * families can (`JAN-PRQUAL` `PQ-1`; `REG-F-481`); ⚠ since rule 2 reads a prototype's characters in either case, it
 * reads nothing the case mappings do not (`asciiFold`).
 */
export function fenceSkeletonTable(data: UnicodeData, fold: (c: string) => string = asciiFold): FenceSkeletonTable {
	// What each fence character's skeleton is, ASCII case aside — the one character a reading must be made of.
	const fenceOf = new Map<string, string>();
	for (const f of FENCE_ALPHABET)
		for (const variant of new Set([f, f.toLowerCase()])) {
			const k = tr39Skeleton(data, variant.codePointAt(0)!);
			if ([...k].length !== 1 || k.codePointAt(0)! >= 0x80)
				throw new Error(`the skeleton of ${JSON.stringify(variant)} is ${JSON.stringify(k)}, not one ASCII character`);
			const seen = fenceOf.get(fold(k));
			if (seen !== undefined && seen !== f)
				throw new Error(`${JSON.stringify(seen)} and ${JSON.stringify(f)} share the skeleton ${JSON.stringify(k)}`);
			fenceOf.set(fold(k), f);
		}
	/** A prototype's characters with the code points rule 1 deletes removed (`REG-F-481`: U+00D8 is O + U+0338). */
	const kept = (k: string): string[] => [...k].filter((c) => !data.deleted.has(c.codePointAt(0)!));
	/** What a prototype reads as when each of its kept characters is a fence character's skeleton, or `undefined`. */
	const plain = (k: string): string | undefined => {
		const fs = kept(k).map((c) => fenceOf.get(fold(c)));
		return fs.length > 0 && fs.every((f) => f !== undefined) ? fs.join('') : undefined;
	};
	/** Rule 2 for one CHARACTER of a prototype that is no fence character's skeleton: its either case's skeletons. */
	const inEitherCase = (c: string): string[] => {
		const x = c.codePointAt(0)!;
		return unique(
			[data.upper.get(x), data.lower.get(x)].flatMap((y) =>
				y === undefined ? [] : skeletonsOf(data, y).flatMap((k) => plain(k) ?? [])
			)
		);
	};
	/** Every reading of a prototype: each kept character a fence character, or read in either case. */
	const prototypeReadings = (k: string): string[] => {
		const chars = kept(k);
		if (chars.length === 0) return [];
		let out = [''];
		for (const c of chars) {
			const f = fenceOf.get(fold(c));
			const options = f === undefined ? inEitherCase(c) : [f];
			if (options.length === 0) return [];
			out = product(out, options);
		}
		return out;
	};
	const readsAs = (cp: number): string[] => skeletonsOf(data, cp).flatMap(prototypeReadings);
	/** Rules 1 and 2 for one code point: nothing, if deleted, and every reading of it and of its either case. */
	const direct = (cp: number): string[] =>
		unique([
			...(data.deleted.has(cp) ? [''] : []),
			...readsAs(cp),
			...[data.upper.get(cp), data.lower.get(cp)].flatMap((y) => (y === undefined ? [] : readsAs(y)))
		]);
	// Rule 4: each TR39 class read through a member's compatibility decomposition (any tag but `<compat>`), its parts
	// read by TR39 alone — deleted, or a fence character's skeleton.
	const byTr39Alone = (p: number): string | undefined => (data.deleted.has(p) ? '' : plain(tr39Skeleton(data, p)));
	const classReadings = new Map<string, string[]>();
	for (const [cp, d] of data.decompositions) {
		if (!d.compat || d.tag === '<compat>') continue;
		const parts = decompose(data, cp, true).map(byTr39Alone);
		if (parts.some((p) => p === undefined)) continue;
		const reading = parts.join('');
		const key = classOf(data, cp);
		if (reading === '' || key === '') continue;
		classReadings.set(key, unique([...(classReadings.get(key) ?? []), reading]));
	}
	// ⛔ No ASCII code point is given a class reading.
	const byClass = (cp: number): string[] => (cp < 0x80 ? [] : (classReadings.get(classOf(data, cp)) ?? []));
	// A part of a compatibility decomposition, read by rules 1, 2 and 4 (a part is decomposed already).
	const partReadings = new Map<number, string[]>();
	const readPart = (p: number): string[] => {
		let hit = partReadings.get(p);
		if (hit === undefined) {
			const d = direct(p);
			hit = unique([...d, ...byClass(p)]);
			partReadings.set(p, hit);
		}
		return hit;
	};
	/** A code point no input names — no mapping, decomposition, case or deletion: it reads as the skeleton it is, alone. */
	const unnamed = (cp: number): boolean =>
		ownSkeleton(data, cp) &&
		!data.decompositions.has(cp) &&
		!data.supplement.has(cp) &&
		!data.upper.has(cp) &&
		!data.lower.has(cp) &&
		!data.deleted.has(cp);
	const deleted: number[] = [];
	const mapped: [number, string][] = [];
	for (let cp = 0; cp <= 0x10ffff; cp += 1) {
		if (cp >= 0xd800 && cp <= 0xdfff) continue;
		const self = String.fromCodePoint(cp);
		if (unnamed(cp)) {
			// ⚠ The general path below, taken short for the million code points no input names: rule 2 of its own
			// skeleton, then rule 4 — the same answers (measured equal over every code point when this was written).
			const own = fenceOf.get(fold(self));
			const reads = own !== undefined && own !== self ? [own] : cp < 0x80 ? [] : [...(classReadings.get(self) ?? [])].sort();
			for (const r of reads) mapped.push([cp, r]);
			continue;
		}
		const readings = new Set(direct(cp));
		// Rule 3: the compatibility decomposition, each part read by rules 1, 2 and 4, or as itself.
		const parts = decompose(data, cp, true);
		if (parts.length !== 1 || parts[0] !== cp) {
			let through = [''];
			for (const p of parts) {
				const r = readPart(p);
				through = product(through, r.length > 0 ? r : [String.fromCodePoint(p)]);
			}
			for (const t of through) if ([...t].some((c) => FENCE_ALPHABET.includes(c))) readings.add(t);
		}
		readings.delete(self);
		// Rule 4, to EVERY code point outside ASCII — never only to one the rules above left reading as itself.
		for (const r of byClass(cp)) readings.add(r);
		if (readings.has('')) deleted.push(cp);
		for (const r of [...readings].sort()) if (r !== '') mapped.push([cp, r]);
	}
	// ⛔ The premises the chooser rests on, checked on the table itself.
	const terminators = [...LINE_TERMINATOR_CONTROLS, ...LINE_SEPARATORS];
	for (const cp of [...terminators, ...[...FENCE_ALPHABET].map((c) => c.codePointAt(0)!)])
		if (deleted.includes(cp) || mapped.some(([m]) => m === cp))
			throw new Error(`U+${hex(cp)} must read as itself, and the table changes it`);
	for (const [cp, reads] of mapped)
		if ([...reads].some((c) => terminators.includes(c.codePointAt(0)!)))
			throw new Error(`U+${hex(cp)} reads as a line terminator`);
	return { deleted: rangesOf(deleted), mapped };
}

/** Ascending code points as inclusive ranges. */
function rangesOf(cps: readonly number[]): [number, number][] {
	const out: [number, number][] = [];
	for (const cp of cps) {
		const last = out.at(-1);
		if (last && last[1] === cp - 1) last[1] = cp;
		else out.push([cp, cp]);
	}
	return out;
}

/** A JS string literal of `s`, in single quotes, every character outside printable ASCII written as `\u` escapes. */
function literal(s: string): string {
	let out = "'";
	for (let i = 0; i < s.length; i += 1) {
		const unit = s.charCodeAt(i);
		const c = s[i]!;
		out +=
			unit >= 0x20 && unit < 0x7f && c !== "'" && c !== '\\'
				? c
				: `${'\\'}u${unit.toString(16).padStart(4, '0')}`;
	}
	return `${out}'`;
}

/** `0x` and at least four lower-case hex digits. */
function hexLiteral(cp: number): string {
	return `0x${cp.toString(16).padStart(4, '0')}`;
}

/**
 * ⭐ THE GENERATED MODULE'S TEXT — ASCII only, one entry a line. ⛔ Never edited by hand: the freshness test regenerates
 * it from the committed inputs and compares it byte for byte.
 */
export function fenceSkeletonModule(table: FenceSkeletonTable): string {
	return [
		`// GENERATED by scripts/fence-skeleton/generate.ts from the Unicode ${UNICODE_VERSION} inputs in ${INPUT_DIR}/ and`,
		'// the stated supplement scripts/fence-skeleton/supplement.ts - NEVER EDITED BY HAND: verif/fence-skeleton-table.test.ts',
		'// regenerates it and compares it byte for byte. What each entry means, and why the table is generated rather than',
		"// read from the runtime's Unicode, is in scripts/fence-skeleton/core.ts (JAN-PRQUAL PQ-1; REG-F-481; REG-D-013;",
		"// design D2 under the sponsor's answer (a)).",
		'',
		`/** The one Unicode version every input of this table is pinned to. */`,
		`export const FENCE_SKELETON_UNICODE_VERSION = '${UNICODE_VERSION}';`,
		'',
		'/** Inclusive ranges of the code points the fence skeleton reads as NOTHING - never a line terminator. */',
		'export const DELETED: readonly (readonly [number, number])[] = [',
		...table.deleted.map(([first, last]) => `\t[${hexLiteral(first)}, ${hexLiteral(last)}],`),
		'];',
		'',
		'/** Each reading of each code point the fence skeleton reads as something else - one entry for each reading. */',
		'export const MAPPED: readonly (readonly [number, string])[] = [',
		...table.mapped.map(([cp, reads]) => `\t[${hexLiteral(cp)}, ${literal(reads)}],`),
		'];',
		''
	].join('\n');
}

/**
 * The committed extracts' texts and the supplement → the generated module's text: the one path from the inputs to the
 * table. ⛔ It refuses a supplement not closed under TR39's classes (`assertClosed`) — over every mapping, so on every
 * gate.
 */
export function generate(
	extracts: Record<InputKey, string>,
	supplement: readonly SupplementLine[] = FENCE_SUPPLEMENT
): string {
	const lines = extractLines(extracts);
	const table = fenceSkeletonTable(parseUnicode(lines, supplement));
	assertClosed(lines, table, supplement);
	return fenceSkeletonModule(table);
}
