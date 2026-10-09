/**
 * ⭐⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`; `REG-D-013`, guarantee strength over economy; design D2 under the sponsor's answer
 * (a) of 2026-10-03) — THE FENCE SKELETON'S STATED SUPPLEMENT: WHAT UNICODE DOES NOT LIST, BUT A READER CONFUSES WITH
 * THE FENCE.
 *
 * ── WHAT IT IS ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * The fifth input of the generator (`core.ts`), beside the four extracts of Unicode 18.0.0's own files: a list, written
 * for this repository and NOT by Unicode, of code points the skeleton reads as fence characters although TR39's
 * `confusables.txt` does not hold them confusable with any fence character, and of code points that render blank
 * although they are in none of the classes the skeleton deletes. Each line names its code point, what it reads as, its
 * family and its Unicode name (the lines are ASCII: the name says what the character is).
 *
 * ── ⛔ WHY ────────────────────────────────────────────────────────────────────────────────────────────────────────
 * The skeleton reads what Unicode says a reader confuses, and TR39 is about identifiers, not fence lines: it holds the
 * CJK angle bracket confusable with an ornament, the Armenian hyphen with nothing, the small capital N with a Coptic
 * letter — never with `<`, `-` or `N`. So a fence line written with U+3008 and U+3009 for its angles, with an Armenian
 * hyphen for its hyphen, or in small capitals, read as no candidate, and a forged host block spelled with one stood
 * outside every fence (`REG-F-481`). Over-reading costs one candidate and never a fence; under-reading costs the
 * fence. Where the two conflict the sponsor's ruling is guarantee strength over economy (`REG-D-013`), so what a
 * reader confuses with the fence is read, listed here and stated, whether Unicode lists it or not.
 *
 * ── ⭐ HOW IT IS READ: BY THE SAME RULES AS TR39'S OWN MAPPINGS (`core.ts`) ─────────────────────────────────────────
 *   · a line READS AS fence characters: those characters are a prototype of its code point BESIDE TR39's (the table
 *     keeps every reading); then the deletion rule, the either-case rule and the compatibility decompositions apply to
 *     it as to any prototype (U+FE3F, whose decomposition is U+3008, reads as `<` because U+3008 does here);
 *   · a line READS AS NOTHING (`reads: ''`): its code point is DELETED, like the classes `core.ts` deletes.
 * ⛔ The generator refuses a line that is not one of those two, a code point listed twice, a line terminator, a fence
 * character, a code point with a canonical decomposition (the skeleton reads its parts, never it), or one Unicode's
 * classes delete already (`verif/fence-skeleton-table.test.ts` drives each refusal, and holds every line to reading as
 * it says where Unicode's own inputs alone do not).
 * ⭐ CLOSED UNDER TR39'S CLASSES, BOTH WAYS (`unreadClassMembers`): a line reads its OWN code point, so a code point
 * TR39 maps to a prototype listed here (U+304F HIRAGANA KU, which TR39 maps to U+276C) is listed too — unless a rule
 * reads it already (the Cyrillic small te, which TR39 maps to the small capital T, reads as `T` through its capital);
 * AND every other member of a listed code point's own TR39 class must read as its line says, so a code point whose
 * class holds a character a reader takes for something else is NOT listed (U+1400 CANADIAN SYLLABICS HYPHEN, U+2E40
 * DOUBLE HYPHEN and U+30A0 KATAKANA-HIRAGANA DOUBLE HYPHEN, which TR39 holds confusable with `=`, and U+301C WAVE DASH,
 * which it holds confusable with `~`: each read as `-` while `=` and `~` read as themselves, so a reader could not tell
 * `=` planted for the hyphen from a hyphen; `REG-F-481`). `generate` (`core.ts`) checks both over every mapping of
 * `confusables.txt`, which the committed extract keeps whole, and writes no table while a member is unread.
 *
 * ── THE FAMILIES ───────────────────────────────────────────────────────────────────────────────────────────────────
 *   · ANGLE BRACKETS — an angle drawn as a bracket, an ornament or an order relation, alone, doubled or tripled, with
 *     no other stroke: read as `<`, `>`, `<<`, `>>`, `<<<` or `>>>`. (One with a dot inside, or a bar, is not.) And the
 *     rest of TR39's class of U+276C.
 *   · GUILLEMETS — the double angle quotation marks, read as `<<` and `>>`.
 *   · DASHES — every dash punctuation character Unicode's own data does not already read as `-`, and whose TR39 class
 *     holds nothing a reader takes for another character: read as `-`. (U+2E1A HYPHEN WITH DIAERESIS is not here: TR39
 *     writes it as `-` and a mark, which the skeleton reads as `-`. Nor are the em dash, the horizontal bar and the
 *     horizontal strokes TR39 holds confusable with the katakana prolonged sound mark: TR39 puts the fullwidth
 *     hyphen-minus, whose compatibility decomposition is `-`, in that class, and the table reads the class as `-`
 *     (`core.ts` rule 4). Nor U+1400, U+2E40, U+30A0 or U+301C, above.) And U+1196, which TR39 writes as that sound
 *     mark twice: `--`.
 *   · SMALL CAPITALS — the small capitals of the fence's letters that neither TR39 nor the either-case rule reads (the
 *     small capitals U, R and S are read already, and U+1DF35, the small capital R with a palatal hook, which TR39
 *     writes as the small capital R and a mark, reads as R through that capital's own capital; a turned or reversed
 *     one is drawn mirrored, and is not here). And the rest of TR39's class of the small capital E.
 *   · BLANKS — code points outside every deleted class that render as an empty space: DELETED.
 */

/** The families of the supplement — one pinned row each through the real validator. */
export type SupplementFamily = 'angle brackets' | 'guillemets' | 'dashes' | 'small capitals' | 'blanks';

/** One line of the supplement. */
export interface SupplementLine {
	readonly cp: number;
	/** The fence characters it reads as; `''` is DELETED. */
	readonly reads: string;
	readonly family: SupplementFamily;
	/** Its Unicode name. */
	readonly name: string;
}

/** ⭐ THE SUPPLEMENT, by family. ⛔ An INPUT, hand-written and stated: never derived, never changed without regenerating. */
export const FENCE_SUPPLEMENT: readonly SupplementLine[] = [
	{ cp: 0x3008, reads: '<', family: 'angle brackets', name: 'LEFT ANGLE BRACKET' },
	{ cp: 0x3009, reads: '>', family: 'angle brackets', name: 'RIGHT ANGLE BRACKET' },
	{ cp: 0x27e8, reads: '<', family: 'angle brackets', name: 'MATHEMATICAL LEFT ANGLE BRACKET' },
	{ cp: 0x27e9, reads: '>', family: 'angle brackets', name: 'MATHEMATICAL RIGHT ANGLE BRACKET' },
	{ cp: 0x276c, reads: '<', family: 'angle brackets', name: 'MEDIUM LEFT-POINTING ANGLE BRACKET ORNAMENT' },
	{ cp: 0x276d, reads: '>', family: 'angle brackets', name: 'MEDIUM RIGHT-POINTING ANGLE BRACKET ORNAMENT' },
	{ cp: 0x2770, reads: '<', family: 'angle brackets', name: 'HEAVY LEFT-POINTING ANGLE BRACKET ORNAMENT' },
	{ cp: 0x2771, reads: '>', family: 'angle brackets', name: 'HEAVY RIGHT-POINTING ANGLE BRACKET ORNAMENT' },
	{ cp: 0x29fc, reads: '<', family: 'angle brackets', name: 'LEFT-POINTING CURVED ANGLE BRACKET' },
	{ cp: 0x29fd, reads: '>', family: 'angle brackets', name: 'RIGHT-POINTING CURVED ANGLE BRACKET' },
	{ cp: 0x227a, reads: '<', family: 'angle brackets', name: 'PRECEDES' },
	{ cp: 0x227b, reads: '>', family: 'angle brackets', name: 'SUCCEEDS' },
	{ cp: 0x300a, reads: '<<', family: 'angle brackets', name: 'LEFT DOUBLE ANGLE BRACKET' },
	{ cp: 0x300b, reads: '>>', family: 'angle brackets', name: 'RIGHT DOUBLE ANGLE BRACKET' },
	{ cp: 0x27ea, reads: '<<', family: 'angle brackets', name: 'MATHEMATICAL LEFT DOUBLE ANGLE BRACKET' },
	{ cp: 0x27eb, reads: '>>', family: 'angle brackets', name: 'MATHEMATICAL RIGHT DOUBLE ANGLE BRACKET' },
	{ cp: 0x2aa1, reads: '<<', family: 'angle brackets', name: 'DOUBLE NESTED LESS-THAN' },
	{ cp: 0x2aa2, reads: '>>', family: 'angle brackets', name: 'DOUBLE NESTED GREATER-THAN' },
	{ cp: 0x2abb, reads: '<<', family: 'angle brackets', name: 'DOUBLE PRECEDES' },
	{ cp: 0x2abc, reads: '>>', family: 'angle brackets', name: 'DOUBLE SUCCEEDS' },
	{ cp: 0x2af7, reads: '<<<', family: 'angle brackets', name: 'TRIPLE NESTED LESS-THAN' },
	{ cp: 0x2af8, reads: '>>>', family: 'angle brackets', name: 'TRIPLE NESTED GREATER-THAN' },
	// TR39 maps each of these to U+276C, read above as `<`.
	{ cp: 0x304f, reads: '<', family: 'angle brackets', name: 'HIRAGANA LETTER KU' },
	{ cp: 0x3111, reads: '<', family: 'angle brackets', name: 'BOPOMOFO LETTER Q' },
	{ cp: 0x31db, reads: '<', family: 'angle brackets', name: 'CJK STROKE PD' },
	{ cp: 0x21fe8, reads: '<', family: 'angle brackets', name: 'CJK UNIFIED IDEOGRAPH-21FE8' },

	{ cp: 0x00ab, reads: '<<', family: 'guillemets', name: 'LEFT-POINTING DOUBLE ANGLE QUOTATION MARK' },
	{ cp: 0x00bb, reads: '>>', family: 'guillemets', name: 'RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK' },

	{ cp: 0x058a, reads: '-', family: 'dashes', name: 'ARMENIAN HYPHEN' },
	{ cp: 0x05be, reads: '-', family: 'dashes', name: 'HEBREW PUNCTUATION MAQAF' },
	{ cp: 0x1806, reads: '-', family: 'dashes', name: 'MONGOLIAN TODO SOFT HYPHEN' },
	{ cp: 0x2e17, reads: '-', family: 'dashes', name: 'DOUBLE OBLIQUE HYPHEN' },
	{ cp: 0x2e3a, reads: '-', family: 'dashes', name: 'TWO-EM DASH' },
	{ cp: 0x2e3b, reads: '-', family: 'dashes', name: 'THREE-EM DASH' },
	{ cp: 0x2e5d, reads: '-', family: 'dashes', name: 'OBLIQUE HYPHEN' },
	{ cp: 0x3030, reads: '-', family: 'dashes', name: 'WAVY DASH' },
	{ cp: 0x10d6e, reads: '-', family: 'dashes', name: 'GARAY HYPHEN' },
	{ cp: 0x10ead, reads: '-', family: 'dashes', name: 'YEZIDI HYPHENATION MARK' },
	// TR39 maps U+1196, the vowel EU twice, to U+30FC twice — a sound mark the table reads as `-` through its class.
	{ cp: 0x1196, reads: '--', family: 'dashes', name: 'HANGUL JUNGSEONG EU-EU' },

	{ cp: 0x0274, reads: 'N', family: 'small capitals', name: 'LATIN LETTER SMALL CAPITAL N' },
	{ cp: 0x1d1b, reads: 'T', family: 'small capitals', name: 'LATIN LETTER SMALL CAPITAL T' },
	{ cp: 0x1d07, reads: 'E', family: 'small capitals', name: 'LATIN LETTER SMALL CAPITAL E' },
	{ cp: 0x1d05, reads: 'D', family: 'small capitals', name: 'LATIN LETTER SMALL CAPITAL D' },
	{ cp: 0x1d06, reads: 'D', family: 'small capitals', name: 'LATIN LETTER SMALL CAPITAL ETH' },
	{ cp: 0xab46, reads: 'R', family: 'small capitals', name: 'LATIN LETTER SMALL CAPITAL R WITH RIGHT LEG' },
	// TR39 maps U+1DF43 to the small capital E and a stroke, and U+0276 to `o` and the small capital E.
	{ cp: 0x1df43, reads: 'E', family: 'small capitals', name: 'LATIN LETTER SMALL CAPITAL BARRED E' },
	{ cp: 0x0276, reads: '0E', family: 'small capitals', name: 'LATIN LETTER SMALL CAPITAL OE' },

	// TR39 maps U+2800 to SPACE, which the skeleton deletes — yet as a symbol (So) it is in no deleted class. The two
	// Egyptian blanks are letters (Lo) that stand for an empty quadrat, or half of one, of hieroglyphic text.
	{ cp: 0x2800, reads: '', family: 'blanks', name: 'BRAILLE PATTERN BLANK' },
	{ cp: 0x13441, reads: '', family: 'blanks', name: 'EGYPTIAN HIEROGLYPH FULL BLANK' },
	{ cp: 0x13442, reads: '', family: 'blanks', name: 'EGYPTIAN HIEROGLYPH HALF BLANK' }
];
