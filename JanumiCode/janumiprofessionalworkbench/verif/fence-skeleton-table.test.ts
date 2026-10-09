// ⭐⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`; design D2 under the sponsor's answer (a) of 2026-10-03) — THE FENCE SKELETON'S TABLE
// IS DERIVED, AND THIS IS WHAT KEEPS IT DERIVED.
//
// `apps/rph-demo/src/lib/server/assurance/fence-skeleton-table.ts` is what `review-fence.ts` reads every slice by eye
// through: which code points a reader does not see, and every way a code point reads as fence characters. It is
// GENERATED (`scripts/fence-skeleton/generate.ts`) from four committed extracts of Unicode 18.0.0's own files, each
// pinned by the sha-256 of the whole file Unicode publishes, and from the stated supplement
// (`scripts/fence-skeleton/supplement.ts`: what TR39 does not list but a reader confuses with the fence; `REG-D-013`).
// ⛔ A derived artifact edited by hand, or an input changed without regenerating, is a table that no longer says what its
// inputs say — and nothing reading the skeleton could tell. So this file regenerates the table from the committed inputs,
// through the generator's own pure function, and compares it with the committed module BYTE FOR BYTE (`Buffer.equals`: a
// text comparison answers alike for a subject and its control when only a line ending moved). ⭐ And the generator's own
// refusals — the premises the table rests on — are each driven here, each beside a control that the same input, without
// the fault, is accepted; and so is the extractor's gate (`checkedCut`), pure in `core.ts`, over planted inputs.
//
// ⚠ WHAT IT DOES NOT CHECK: that the extracts are true extracts of the whole files — that needs the whole files, which
// are not committed. `scripts/fence-skeleton/extract.ts` refuses a whole file whose hash is not the pinned one (its
// refusal, `checkedWhole`, is driven here with one forged byte and with its last hex digit flipped) and runs
// `checkedCut` before it writes. ⭐ The confusables extract keeps EVERY mapping, so the supplement's closure under TR39's
// classes, and the census of the classes the table reads through a compatibility decomposition, are asked here of the
// whole of TR39 on every gate.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	checkedCut,
	checkedWhole,
	extractLines,
	extractsOf,
	FENCE_ALPHABET,
	fenceSkeletonTable,
	generate,
	INPUT_DIR,
	type InputKey,
	LINE_SEPARATORS,
	LINE_TERMINATOR_CONTROLS,
	parseUnicode,
	readExtract,
	SOURCES,
	TABLE_MODULE,
	UNICODE_VERSION,
	unreadClassMembers
} from '../scripts/fence-skeleton/core.js';
import { committedExtracts } from '../scripts/fence-skeleton/generate.js';
import { FENCE_SUPPLEMENT, type SupplementLine } from '../scripts/fence-skeleton/supplement.js';
import { DELETED, MAPPED } from '../apps/rph-demo/src/lib/server/assurance/fence-skeleton-table.js';
import { fenceReadings } from '../apps/rph-demo/src/lib/server/assurance/review-fence.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXTRACTS = committedExtracts(ROOT);
const COMMITTED = readFileSync(join(ROOT, TABLE_MODULE));
/** The committed inputs' data lines, each extract's header checked. */
const LINES = extractLines(EXTRACTS);
const sourceOf = (key: InputKey) => SOURCES.find((s) => s.key === key)!;
const at = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
/** The committed inputs with mappings added to the confusables. */
const planted = (...extra: string[]) => ({ ...LINES, confusables: [...LINES.confusables, ...extra] });

describe('⭐⭐ JAN-PRQUAL PQ-1 (REG-F-481) — the fence skeleton’s table is what its committed Unicode inputs generate', () => {
	it('⛔ FRESH — the generator over the committed inputs writes the committed module, byte for byte', () => {
		expect(Buffer.from(generate(EXTRACTS), 'utf8').equals(COMMITTED), `${TABLE_MODULE} is not what ${INPUT_DIR} generates — regenerate it (bun scripts/fence-skeleton/generate.ts); never edit it by hand`).toBe(true);
	}, 60_000);

	it('⭐ ONE Unicode version for every input, each extract naming its file, version, address and the whole file’s hash', () => {
		expect(UNICODE_VERSION).toBe('18.0.0');
		for (const s of SOURCES) {
			expect(s.url, s.file).toContain(`/Public/${UNICODE_VERSION}/`);
			expect(s.url.endsWith(`/${s.file}`), s.file).toBe(true);
			expect(s.sha256, s.file).toMatch(/^[0-9a-f]{64}$/);
			const head = EXTRACTS[s.key].split('\n').slice(0, 3);
			expect(head, s.extract).toEqual([
				`# EXTRACT of ${s.file} (Unicode ${UNICODE_VERSION}) - not the whole file.`,
				`# Source: ${s.url}`,
				`# sha256 of the whole source file: ${s.sha256}`
			]);
		}
		expect(new Set(SOURCES.map((s) => s.file)).size, 'four distinct sources').toBe(4);
	});

	it('⭐ the table’s premises hold on the committed module: every fence character reads as itself alone, and no line terminator is in the table', () => {
		for (const c of FENCE_ALPHABET) expect(fenceReadings(c.codePointAt(0)!), `fence character ${JSON.stringify(c)}`).toEqual([c]);
		const inTable = (cp: number) => DELETED.some(([first, last]) => cp >= first && cp <= last) || MAPPED.some(([m]) => m === cp);
		for (const cp of [...LINE_TERMINATOR_CONTROLS, ...LINE_SEPARATORS]) expect(inTable(cp), at(cp)).toBe(false);
		// ⭐ Whether a reader breaks a line at one is the CHOOSER's rule, not the table's (`review-fence.ts`
		// `UNBROKEN_TERMINATORS`): LF reads as itself alone, every other terminator as itself AND as nothing.
		expect(fenceReadings(0x0a), 'LF').toEqual(['\n']);
		for (const cp of [0x0b, 0x0c, 0x0d, 0x85, 0x2028, 0x2029])
			expect(fenceReadings(cp), at(cp)).toEqual([String.fromCodePoint(cp), '']);
	});

	it('⭑ CONTROL — the comparison discriminates: one input mapping dropped, or one entry of the module edited, is unequal', () => {
		// The Armenian TIWN read as S — one TR39 mapping, and the one route by which the table reads it. (⚠ Not the Cyrillic
		// ZE: since a prototype's characters are read in either case, its small letter reads it as 3 too, so its own mapping
		// dropped moves no entry.)
		const tiwn = '054F ;\t0053 ;\tMA';
		expect(EXTRACTS.confusables.split('\n'), 'arrangement: the extract holds the mapping').toContain(tiwn);
		const dropped = { ...EXTRACTS, confusables: EXTRACTS.confusables.replace(`${tiwn}\n`, '') };
		expect(Buffer.from(generate(dropped), 'utf8').equals(COMMITTED), 'an input without the mapping').toBe(false);
		const edited = COMMITTED.toString('utf8').replace("\t[0x054f, 'S'],\n", "\t[0x054f, '8'],\n");
		expect(edited, 'arrangement: the module holds the entry').not.toBe(COMMITTED.toString('utf8'));
		expect(Buffer.from(edited, 'utf8').equals(Buffer.from(generate(EXTRACTS), 'utf8')), 'a hand edit').toBe(false);
	}, 60_000);

	it('⛔ an extract whose header names another hash is refused, not read', () => {
		const forged = EXTRACTS.unicodeData.replace(SOURCES.find((s) => s.key === 'unicodeData')!.sha256, '0'.repeat(64));
		expect(() => generate({ ...EXTRACTS, unicodeData: forged })).toThrow(/header line 3/);
	});

	it.each([
		[4, 'Kept', (s: (typeof SOURCES)[number]) => `# Kept: ${s.kept.replace('every mapping', 'every mapping whose target is ASCII')}`],
		[5, 'Written', () => '# Written by hand; read by scripts/fence-skeleton/core.ts.']
	] as const)('⛔ an extract whose header line %i (%s) is not the one SOURCES pins is refused — the rule it was cut by, and who cut it', (n, _what, line) => {
		const s = sourceOf('confusables');
		const lines = EXTRACTS.confusables.split('\n');
		expect(lines[n - 1], 'arrangement: the line forged is the committed one').not.toBe(line(s));
		lines[n - 1] = line(s);
		expect(() => readExtract(s, lines.join('\n')), `header line ${n} forged`).toThrow(`header line ${n} is `);
		// ⭑ CONTROL — the committed header is read.
		expect(readExtract(s, EXTRACTS.confusables)).toHaveLength(LINES.confusables.length);
	});
});

describe('⭐⭐ JAN-PRQUAL PQ-1 (REG-F-481) — the generator and the extractor REFUSE what their premises forbid, each beside a control', () => {
	it('⛔ a table in which a reading HOLDS A LINE TERMINATOR is refused — a code point read as LF then 0', () => {
		// ⛔ Such a reading would let the chooser find a candidate across two lines a reader sees apart. Unicode 18.0.0 has
		// none, so the fault is planted: a compatibility decomposition to LF and the digit 0.
		const withDecomposition = (parts: string) => ({ ...LINES, unicodeData: [...LINES.unicodeData, `E000;<compat> ${parts};;`] });
		expect(() => fenceSkeletonTable(parseUnicode(withDecomposition('000A 0030')))).toThrow('U+E000 reads as a line terminator');
		// ⭑ CONTROL — the same decomposition to a letter and the digit 0 is read, and the table is written.
		expect(fenceSkeletonTable(parseUnicode(withDecomposition('0041 0030'))).mapped).toContainEqual([0xe000, 'A0']);
	}, 60_000);

	// ⭐ EACH OTHER PREMISE `fenceSkeletonTable` STATES IT REFUSES ON (`core.ts`: "a fence character whose skeleton is not one
	// ASCII character, two fence characters a reader could not tell apart, a fence character not read as itself alone, a
	// line terminator deleted or read as anything"), planted, beside a control the generator reads. ⛔ Only the reading
	// that holds a line terminator was planted, so a generator that dropped the fence characters from its reads-as-itself
	// check wrote a table in which D read as 0 — and every test stayed green (driven). Unicode 18.0.0 breaks none of them,
	// so each fault is planted.
	it('⛔ a table in which a FENCE CHARACTER reads otherwise is refused — D given a <font> decomposition to 0', () => {
		const withLine = (line: string) => ({ ...LINES, unicodeData: [...LINES.unicodeData, line] });
		expect(() => fenceSkeletonTable(parseUnicode(withLine('0044;<font> 0030;;0064')))).toThrow('U+0044 must read as itself, and the table changes it');
		// ⭑ CONTROL — the same decomposition on a code point that is no fence character is read, as 0.
		expect(fenceSkeletonTable(parseUnicode(withLine('E001;<font> 0030;;'))).mapped).toContainEqual([0xe001, '0']);
	}, 60_000);

	it('⛔ a table in which a LINE TERMINATOR reads as anything is refused — U+000B given a <compat> decomposition to 0', () => {
		const withLine = (line: string) => ({ ...LINES, unicodeData: [...LINES.unicodeData, line] });
		expect(() => fenceSkeletonTable(parseUnicode(withLine('000B;<compat> 0030;;')))).toThrow('U+000B must read as itself, and the table changes it');
		// ⭑ CONTROL — the same decomposition on a code point that is no terminator is read, as 0.
		expect(fenceSkeletonTable(parseUnicode(withLine('E002;<compat> 0030;;'))).mapped).toContainEqual([0xe002, '0']);
	}, 60_000);

	it('⛔ a FENCE CHARACTER whose skeleton is not one ASCII character is refused — U mapped by TR39 to a Cyrillic U', () => {
		expect(() => fenceSkeletonTable(parseUnicode(planted('0055 ;\t0423 ;\tMA')))).toThrow('the skeleton of "U" is "\u0423", not one ASCII character');
		// ⭑ CONTROL — the same mapping from a code point that is no fence character is read.
		expect(() => fenceSkeletonTable(parseUnicode(planted('E003 ;\t0423 ;\tMA')))).not.toThrow();
	}, 60_000);

	it('⛔ two FENCE CHARACTERS a reader could not tell apart are refused — N mapped by TR39 to U', () => {
		expect(() => fenceSkeletonTable(parseUnicode(planted('004E ;\t0055 ;\tMA')))).toThrow('"U" and "N" share the skeleton "U"');
		// ⭑ CONTROL — the same mapping from a code point that is no fence character is read, as U.
		expect(fenceSkeletonTable(parseUnicode(planted('E004 ;\t0055 ;\tMA'))).mapped).toContainEqual([0xe004, 'U']);
	}, 60_000);

	it('⛔ an extract with NO FINAL NEWLINE is refused, never read short of its last line', () => {
		for (const s of SOURCES) {
			const lines = EXTRACTS[s.key].split('\n');
			expect(readExtract(s, EXTRACTS[s.key]).at(-1), `${s.extract}: CONTROL — its last line is read`).toBe(lines.at(-2));
			expect(() => readExtract(s, EXTRACTS[s.key].slice(0, -1)), s.extract).toThrow(`${s.extract}: no final newline`);
		}
	});

	it('⭐ the confusables rule keeps EVERY mapping: the committed extract is its own cut, and a planted mapping of any target is kept', () => {
		// ⭐ `PQ-1` (`REG-F-481`; `REG-D-013`): the generator reads a prototype's characters in either case and each TR39 class
		// whole, so a target outside ASCII can decide a reading — U+10F3, which TR39 maps to the yogh, reads as 3 through the
		// yogh's capital. The rule kept only targets ASCII once their deleted code points were removed; it keeps every one
		// now, so the planted lines — a Latin-1 target (a bullet to a middle dot), one outside ASCII with a mark, one the
		// deletion empties — are kept, each in its place.
		const kept = (line: string) => EXTRACTS.confusables.split('\n').includes(line);
		expect([kept('00D8 ;\t004F 0338 ;\tMA'), kept('10F3 ;\t021D ;\tMA'), kept('2028 ;\t0020 ;\tMA')], 'arrangement: a mark-bearing target, one outside ASCII, one the deletion empties').toEqual([
			true,
			true,
			true
		]);
		expect(extractsOf(EXTRACTS).confusables === EXTRACTS.confusables, 'the committed extract is its own cut').toBe(true);
		const plantedLines = ['2022 ;\t00B7 ;\tMA', '0436 ;\t0436 0301 ;\tMA', '0301 ;\t0300 ;\tMA'];
		const recut = extractsOf({ ...EXTRACTS, confusables: `${EXTRACTS.confusables}${plantedLines.join('\n')}\n` });
		expect(recut.confusables, 'every planted line is kept').toBe(`${EXTRACTS.confusables}${plantedLines.join('\n')}\n`);
	});

	it('⛔ a whole file is read only when its sha-256 is the one SOURCES pins: ONE forged byte, or one hex digit of the pin, is refused', () => {
		const source = sourceOf('unicodeData');
		const bytes = Buffer.from(EXTRACTS.unicodeData, 'utf8');
		// ⭑ CONTROL — a pin made for these bytes reads them; the whole files themselves are not committed.
		const sha = createHash('sha256').update(bytes).digest('hex');
		const pinned = { ...source, sha256: sha };
		expect(checkedWhole(pinned, bytes)).toBe(EXTRACTS.unicodeData);
		const forged = Buffer.from(bytes);
		forged[forged.length - 2] = forged[forged.length - 2]! ^ 0x01;
		expect(() => checkedWhole(pinned, forged), 'one byte changed').toThrow(`${source.file} has sha256 `);
		// ⭐ The pin's LAST hex digit flipped: a check that compared a prefix of the hash would read the bytes.
		const flip = sha.slice(0, -1) + (sha.at(-1) === '0' ? '1' : '0');
		expect(() => checkedWhole({ ...source, sha256: flip }, bytes), 'the pin one hex digit off').toThrow(`not the pinned ${flip}`);
		expect(() => checkedWhole(source, bytes), 'an extract is not the whole file Unicode publishes').toThrow(
			`not the pinned ${source.sha256}`
		);
	});

	it('⛔ THE EXTRACTOR’S GATE (`checkedCut`) refuses a cut that loses a mapping the table reads, and a supplement left unclosed by the whole file — each beside a control', () => {
		// The committed extracts stand in for the whole files: the confusables extract keeps every mapping, and the cut's
		// own rule is its own cut. ⭑ CONTROL — so the gate passes them.
		expect(() => checkedCut(EXTRACTS, EXTRACTS)).not.toThrow();
		// ⛔ A cut that dropped the Armenian TIWN's mapping reads one lookalike less than the whole file.
		const lost = { ...EXTRACTS, confusables: EXTRACTS.confusables.replace('054F ;\t0053 ;\tMA\n', '') };
		expect(() => checkedCut(EXTRACTS, lost)).toThrow('the cut loses a mapping');
		// ⛔ A whole file holding a member of an angle bracket's class that no rule reads: the extractor writes nothing. (Its
		// confusables cut is the whole file's every mapping; the other three stand as committed.)
		const whole = { ...EXTRACTS, confusables: `${EXTRACTS.confusables}E001 ;\t276C ;\tMA\n` };
		expect(extractsOf(whole).confusables, 'arrangement: the cut keeps the planted mapping').toBe(whole.confusables);
		expect(() => checkedCut(whole, { ...EXTRACTS, confusables: whole.confusables })).toThrow(
			/not closed under TR39's classes: U\+E001 belong/
		);
	}, 120_000);
});

describe('⭐⭐ JAN-PRQUAL PQ-1 (REG-F-481, REG-D-013) — the stated supplement: read as it says, saying what Unicode does not, refused when it could not be', () => {
	it('⭐ every line of the supplement reads as it says — and, the supplement aside, Unicode’s own inputs do not read it so', () => {
		const without = fenceSkeletonTable(parseUnicode(LINES, []));
		const deleted = new Set(without.deleted.flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, i) => first + i)));
		for (const line of FENCE_SUPPLEMENT) {
			expect(fenceReadings(line.cp), `${at(line.cp)} ${line.name}`).toContain(line.reads);
			const unicodeAlone = [...(deleted.has(line.cp) ? [''] : []), ...without.mapped.filter(([cp]) => cp === line.cp).map(([, r]) => r)];
			expect(unicodeAlone, `${at(line.cp)} ${line.name}: Unicode's own inputs read it so already`).not.toContain(line.reads);
		}
		expect([...new Set(FENCE_SUPPLEMENT.map((l) => l.family))].sort(), 'every family has its lines').toEqual(
			['angle brackets', 'blanks', 'dashes', 'guillemets', 'small capitals']
		);
	}, 60_000);

	it('⛔ the supplement is CLOSED under TR39’s classes INTO it: a code point TR39 maps to a prototype it reads, and nothing reads, is named', () => {
		// A line reads its own code point, so a code point TR39 maps to a prototype made of what the supplement reads needs
		// a line of its own unless a rule reads it already. The mappings are planted: U+E001 to U+276C twice (an angle
		// bracket the supplement reads as <), U+E002 to the same with a mark between, and U+F0001 — beyond the Basic
		// Multilingual Plane — to it twice too. ⚠ Each prototype is TWO brackets, so no supplemented code point's own class
		// holds the planted member and the check OUT of the supplement (below) cannot name it: this direction alone does.
		const table = fenceSkeletonTable(parseUnicode(LINES));
		expect(unreadClassMembers(LINES, table), 'the committed inputs').toEqual([]);
		expect(
			unreadClassMembers(planted('E001 ;\t276C 276C ;\tMA', 'E002 ;\t276C 0301 276C ;\tMA', 'F0001 ;\t276C 276C ;\tMA'), table)
		).toEqual([0xe001, 0xe002, 0xf0001]);
		// ⭑ CONTROL — a member with a line of its own, a prototype the supplement does not read, and one it reads beside a
		// character no rule reads as a fence character (a Cyrillic zhe), are not named.
		expect(unreadClassMembers(planted('304F ;\t276C ;\tMA', 'E003 ;\t2C9C ;\tMA', 'E004 ;\t276C 0436 ;\tMA'), table)).toEqual([]);
	}, 60_000);

	it('⛔ the supplement is CLOSED under TR39’s classes OUT of it: a member of a supplemented code point’s own class not read as its line says is named', () => {
		// ⭐ `PQ-1` (`REG-F-481`): the check was one way. U+1196 (HANGUL JUNGSEONG EU-EU) reads `--` by its line, and TR39
		// writes it as the katakana prolonged sound mark twice — so U+E005, planted into that class, is the same glyph to a
		// reader and must read `--` too. The supplement reads nothing in its prototype, so the check INTO it cannot see it.
		// ⭐ And U+F0004, beyond the Basic Multilingual Plane, planted into the same class: the check asks EVERY code point,
		// and supplemented classes hold astral members (U+1D6D5 and four more in U+1D1B's), so an astral plant is named too.
		const table = fenceSkeletonTable(parseUnicode(LINES));
		expect(
			unreadClassMembers(planted('E005 ;\t30FC 30FC ;\tMA', 'F0004 ;\t30FC 30FC ;\tMA'), table),
			'a member planted into the class, in the Basic Multilingual Plane and beyond it'
		).toEqual([0xe005, 0xf0004]);
		// ⭐ And the lines it refused: U+1400 CANADIAN SYLLABICS HYPHEN, read as `-`, while TR39 holds it confusable with `=`,
		// which reads as itself. Planted back, its class is named — `=` first.
		const hyphen: SupplementLine = { cp: 0x1400, reads: '-', family: 'dashes', name: 'CANADIAN SYLLABICS HYPHEN' };
		const supplement = [...FENCE_SUPPLEMENT, hyphen];
		const named = unreadClassMembers(LINES, fenceSkeletonTable(parseUnicode(LINES, supplement)), supplement);
		expect(named, 'the class of a line that reads it as a hyphen').toContain(0x3d);
		expect(named.every((cp) => cp !== 0x1400), 'the line’s own code point reads as it says').toBe(true);
	}, 120_000);

	const line = (cp: number, reads: string): SupplementLine => ({ cp, reads, family: 'dashes', name: 'A PLANTED LINE' });
	it.each([
		['a code point listed twice', [...FENCE_SUPPLEMENT, FENCE_SUPPLEMENT[0]!], /is listed twice/],
		['a reading that is not fence characters', [line(0x2e16, '>x')], /which is not fence characters/],
		['a fence character', [line(0x4e, 'N')], /a line terminator or a fence character/],
		['a line terminator', [line(0x2028, '')], /a line terminator or a fence character/],
		['a code point with a canonical decomposition (U+2329, whose part U+3008 is read)', [line(0x2329, '<')], /canonical decomposition/],
		['a code point Unicode’s own classes delete (a zero-width space)', [line(0x200b, '')], /deleted by Unicode's own classes already/]
	] as const)('⛔ a supplement line the skeleton would not read as it says is refused — %s', (_what, supplement, message) => {
		expect(() => parseUnicode(LINES, supplement)).toThrow(message);
	});

	it('⭑ CONTROL — the refusals are of the planted line alone: one line of each kind accepted', () => {
		expect(() => parseUnicode(LINES, [line(0x2e16, '>'), line(0x1d159, '')])).not.toThrow();
	});
});

/**
 * ⭐ TR39's OWN CLASSES, READ HERE APART FROM THE GENERATOR — a parse of the committed extracts written in this file, so a
 * generator that stopped reading a class cannot stop this census with it. A class is every code point `confusables.txt`
 * maps to one prototype (its target, with the code points the skeleton deletes removed), and the prototype itself when
 * it is one code point. A code point's compatibility decomposition (any tag but `<compat>`) is read part by part by TR39
 * alone: deleted, a fence character, or mapped to a fence character's prototype (O for 0, l for 1, a letter or its lower
 * case for itself).
 */
const TR39_CLASSES = (() => {
	const deleted = new Set<number>();
	for (const l of [...LINES.derivedCoreProperties, ...LINES.derivedGeneralCategory]) {
		const [first, last = first] = l.split(';')[0]!.trim().split('..').map((h) => Number.parseInt(h, 16));
		for (let cp = first!; cp <= last!; cp += 1) deleted.add(cp);
	}
	for (const terminator of [...LINE_TERMINATOR_CONTROLS, ...LINE_SEPARATORS]) deleted.delete(terminator);
	const hexes = (field: string): number[] => field.trim().split(/\s+/).filter(Boolean).map((h) => Number.parseInt(h, 16));
	const target = new Map<number, string>();
	for (const l of LINES.confusables) {
		const [from, to] = l.split(';');
		target.set(hexes(from!)[0]!, String.fromCodePoint(...hexes(to!).filter((cp) => !deleted.has(cp))));
	}
	const decomposition = new Map<number, { tag: string; parts: number[] }>();
	for (const l of LINES.unicodeData) {
		const [cp, d] = l.split(';');
		if (d) decomposition.set(Number.parseInt(cp!, 16), { tag: d.startsWith('<') ? d.slice(0, d.indexOf('>') + 1) : '', parts: hexes(d.replace(/^<[^>]*>/, '')) });
	}
	const nfkd = (cp: number): number[] => {
		const d = decomposition.get(cp);
		return d ? d.parts.flatMap(nfkd) : [cp];
	};
	const prototypeOf = new Map<string, string>([...FENCE_ALPHABET].map((f) => [f === '0' ? 'o' : f === '1' ? 'l' : f.toLowerCase(), f]));
	const byTr39Alone = (cp: number): string | undefined => {
		if (deleted.has(cp)) return '';
		const c = String.fromCodePoint(cp);
		if (FENCE_ALPHABET.includes(c)) return c;
		return prototypeOf.get((target.get(cp) ?? c).toLowerCase());
	};
	const keyOf = (cp: number): string => target.get(cp) ?? String.fromCodePoint(cp);
	const members = new Map<string, number[]>();
	for (const cp of target.keys()) members.set(keyOf(cp), [...(members.get(keyOf(cp)) ?? []), cp]);
	for (const [key, cps] of members) if ([...key].length === 1 && !target.has(key.codePointAt(0)!)) cps.push(key.codePointAt(0)!);
	/** Each class a member's decomposition reads, with that member, its reading, and the class's members. */
	const read: { readonly through: number; readonly reading: string; readonly members: readonly number[] }[] = [];
	for (const [cp, d] of decomposition) {
		if (d.tag === '' || d.tag === '<compat>') continue;
		const parts = nfkd(cp).map(byTr39Alone);
		if (parts.some((p) => p === undefined) || parts.join('') === '') continue;
		const cls = members.get(keyOf(cp));
		if (cls) read.push({ through: cp, reading: parts.join(''), members: cls });
	}
	return read;
})();

describe('⭐⭐ JAN-PRQUAL PQ-1 (REG-F-481) — the table is CLOSED under TR39’s classes: every member outside ASCII of a class read through a compatibility decomposition carries every reading its class is read as', () => {
	it('⭐ THE CENSUS — every class some member’s decomposition (any tag but <compat>) reads as fence characters: no member outside ASCII reads as itself, and every one carries every reading its class is read as', () => {
		// ⛔ IT WAS NOT (`REG-F-481`): U+2460 CIRCLED DIGIT ONE read as 1 through its decomposition, and U+2780, which TR39
		// says is the same glyph — its prototype — read as itself, so U+2780 for the 1 of 01, after an exact 00, closed the
		// real 01 (driven); so did the degree sign beside the masculine ordinal, and 40 more (measured over the whole file).
		expect(TR39_CLASSES.length, 'arrangement: TR39 has classes read so').toBeGreaterThan(20);
		expect(TR39_CLASSES.some((c) => c.through === 0x2460 && c.members.includes(0x2780)), 'arrangement: U+2780 is U+2460’s class').toBe(true);
		const itself = TR39_CLASSES.flatMap(({ through, reading, members }) =>
			members
				.filter((m) => m >= 0x80)
				.filter((m) => {
					const r = fenceReadings(m);
					return r.length === 1 && r[0] === String.fromCodePoint(m);
				})
				.map((m) => `${at(m)} reads as itself, in the class ${at(through)} reads as ${JSON.stringify(reading)}`)
		);
		expect(itself).toEqual([]);
		// ⛔ AND A MEMBER THE OTHER RULES READ OTHERWISE WAS GIVEN NOTHING OF ITS CLASS (`REG-F-481`; `REG-D-013`): TR39 puts
		// U+0675 ARABIC LETTER HIGH HAMZA ALEF in the class of U+FE83, whose `<isolated>` decomposition reads as 1, and U+0675
		// read only as 1 then U+0674 by its own `<compat>` decomposition — so "reads as itself" passed it, while U+0675 for
		// the 1 of 01, after an exact 00, closed the real 01 in every framing (driven). The census asks the general form.
		expect(
			TR39_CLASSES.some((c) => c.reading === '1' && c.members.includes(0x0675)),
			'arrangement: U+0675 is in a class read as 1'
		).toBe(true);
		const lacking = TR39_CLASSES.flatMap(({ through, reading, members }) =>
			members
				.filter((m) => m >= 0x80 && !fenceReadings(m).includes(reading))
				.map((m) => `${at(m)} reads ${JSON.stringify(fenceReadings(m))}, not ${JSON.stringify(reading)}, in the class ${at(through)} reads so`)
		);
		expect(lacking).toEqual([]);
	});
});
