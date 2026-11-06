// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 (`REG-D-146`; design §12.2) — THE CUT AND THE BLOCK'S NUMBERS, AS PYTHON MAKES THEM.
//
// The screen's cut (`wide_common.py`, `d46-facts-verbatim.md` V10) and its block (`build_checkptr2.py`, V8) are Python: its
// `str.strip()`, its `re` (`\s` and `\d`), its `json.loads` and `json.dumps(…, ensure_ascii=False)`, its `format(x, '.2f')`
// and its stable `sorted`. Each row below was MEASURED by running `wide_common.py`'s own functions under CPython 3.14 over
// the input (`z1-facts.md`), and the port must give the same output: a row JavaScript's own semantics would get wrong is
// among them — Python's whitespace, an integer kept apart from a float, a key order JavaScript would reorder, a repeated
// key, `NaN`, a float in exponent form, a strict control character, the four exact ties of the two-decimal rule.
import { describe, expect, it } from 'vitest';
import {
	answerItems,
	checksOf,
	PY_JSON_MAX_DEPTH,
	PY_WHITESPACE,
	pyFloatRepr,
	pyJsonDumps,
	pyJsonLoads,
	PyJsonError,
	PyJsonTooDeep,
	pyStrip,
	regions,
	sentences,
	statementsOf
} from './review-cuts.js';
import { pyFormat2, ranked } from './review-section.js';

/** ⭐ Measured with CPython 3.14 (`wide_common.py`'s `sentences`, `answer_items` and `checks`): [function, input, output]. */
const CPYTHON: readonly (readonly [string, string, unknown])[] = [
	["sentences", "A b. C d.\u001cE f. “G h. `I. \"J.  k", ["A b.", "C d.", "E f.", "“G h.", "`I.", "\"J.  k"]],
	["sentences", "﻿A. B﻿", ["﻿A.", "B﻿"]],
	["sentences", "  One.  Two.\n\nThree. four. Five?  Six. ", ["One.", "Two.", "Three. four.", "Five?  Six."]],
	["sentences", "No break.Here. 3 starts. A. B. C. D.", ["No break.Here. 3 starts.", "A.", "B.", "C.", "D."]],
	["sentences", "", []],
	["sentences", " \u0085 ", []],
	["answerItems", "{\"total\":\"The file holds 12 words. Each word is counted once.\",\"words\":[\"a\",\"b\"],\"lines\":3,\"ratio\":0.25,\"ok\":true}", [["answer.total", "total: The file holds 12 words."], ["answer.total", "total: Each word is counted once."], ["answer.words", "words: [\"a\", \"b\"]"], ["answer.lines", "lines: 3"], ["answer.ratio", "ratio: 0.25"], ["answer.ok", "ok: true"]]],
	["answerItems", "{\"a\":\"x\u0000y. Z.\"}", [["answer", "{\"a\":\"x\u0000y."], ["answer", "Z.\"}"]]],
	["answerItems", "{\"10\":1,\"2\":\"Two. Three.\",\"a\":{\"x\":[1]},\"a\":\"Last wins.\"}", [["answer.10", "10: 1"], ["answer.2", "2: Two."], ["answer.2", "2: Three."], ["answer.a", "a: Last wins."]]],
	["answerItems", "{\"a\":{\"x\":[1,2.0,null,false,\"é\\u2028 \\u0000\\\"\\\\\u007f\"],\"y\":{}}}", [["answer.a", "a: {\"x\": [1, 2.0, null, false, \"é  \\u0000\\\"\\\\\u007f\"], \"y\": {}}"]]],
	["answerItems", "{\"big\":123456789012345678901234567890,\"f\":[1e16,1e-5,1.5e-7,0.0001,1e22,1234567890123456.0,12345678901234567.0,-0.0,5e-324,100.0,1e15],\"n\":[NaN,Infinity,-Infinity,1e400,-0]}", [["answer.big", "big: 123456789012345678901234567890"], ["answer.f", "f: [1e+16, 1e-05, 1.5e-07, 0.0001, 1e+22, 1234567890123456.0, 1.2345678901234568e+16, -0.0, 5e-324, 100.0, 1000000000000000.0]"], ["answer.n", "n: [NaN, Infinity, -Infinity, Infinity, 0]"]]],
	["answerItems", "[1, 2]", [["answer", "[1, 2]"]]],
	["answerItems", "\"just a string. Two.\"", [["answer", "\"just a string. Two.\""]]],
	["answerItems", "{\"a\": 1,}", [["answer", "{\"a\": 1,}"]]],
	["answerItems", "{\"x\": \"esc \\u003c\\u003c\\u003cUNTRUSTED-00\\u003e\\u003e\\u003e here.\"}", [["answer.x", "x: esc <<<UNTRUSTED-00>>> here."]]],
	["answerItems", "Plain prose. With two sentences.", [["answer", "Plain prose."], ["answer", "With two sentences."]]],
	["answerItems", "\f{\"a\":\"b.\"}\u001c", [["answer.a", "a: b."]]],
	["answerItems", "{\"a\":01}", [["answer", "{\"a\":01}"]]],
	["answerItems", "{\"e\":[1E2,2e+3,3.5E-2]}", [["answer.e", "e: [100.0, 2000.0, 0.035]"]]],
	["answerItems", "{\"s\":\"\\ud83d\\ude00 and \\ud800 lone. Next.\"}", [["answer.s", "s: 😀 and \ud800 lone."], ["answer.s", "s: Next."]]],
	["answerItems", "{\"a\" : [ 1 ,\t2 ]\r\n}", [["answer.a", "a: [1, 2]"]]],
	["answerItems", "{\"a\":[1]\f}", [["answer", "{\"a\":[1]\f}"]]],
	["checksOf", "Evaluate EACH derivational-integrity failure class below. For each, decide whether the FAILURE is PRESENT\n- RR-01-no-problem-substitution: The result genuinely discharges its delegated obligation. [if unmet: BLOCKING]\n- TA-02-x: Ends with a bracket of its own [if unmet: X] [if unmet: ADVISORY]\n- RR-٠٣-arabic: Unicode digits are digits to Python. [if unmet: MATERIAL]\n- rr-04-lower: not a check\n- RR-5-short: not a check\n- AB-12: no label bracket\n  Test: not a check", [["RR-01-no-problem-substitution", "The result genuinely discharges its delegated obligation."], ["TA-02-x", "Ends with a bracket of its own [if unmet: X]"], ["RR-٠٣-arabic", "Unicode digits are digits to Python."], ["AB-12", "no label bracket"]]]
];

/** ⭐ Measured with CPython 3.14: `format(x, '.2f')`. */
const FORMAT_2: readonly (readonly [number, string])[] = [
	[0.125, '0.12'],
	[0.375, '0.38'],
	[0.625, '0.62'],
	[0.875, '0.88'],
	[0.005, '0.01'],
	[0.015, '0.01'],
	[0.025, '0.03'],
	[0.035, '0.04'],
	[0.045, '0.04'],
	[0.995, '0.99'],
	[1.0, '1.00'],
	[0.0, '0.00'],
	[-0.0, '-0.00'],
	[0.3349999999999999, '0.33'],
	[0.335, '0.34'],
	[0.6250000000000001, '0.63'],
	[0.12499999999999999, '0.12'],
	[0.04067103588634973, '0.04'],
	[0.9999999999999999, '1.00'],
	[0.00499999999999999, '0.00'],
	[5e-324, '0.00']
];

describe('⭐ Z1 (D50) — the screen’s cut, ported: each function gives what CPython gave', () => {
	it.each(CPYTHON.map((row, i) => [i, ...row] as const))('#%i %s', (_i, fn, input, output) => {
		if (fn === 'sentences') expect(sentences(input)).toEqual(output);
		else if (fn === 'answerItems') expect(answerItems(input).map((s) => [s.from, s.text])).toEqual(output);
		else expect(checksOf(input).map((c) => [c.id, c.label])).toEqual(output);
	});

	it('⭐ Python’s whitespace, as str.isspace() holds it: the separators U+001C to U+001F and U+0085 strip, U+FEFF does not', () => {
		expect([...PY_WHITESPACE].map((c) => c.codePointAt(0)!.toString(16))).toEqual(
			['9', 'a', 'b', 'c', 'd', '1c', '1d', '1e', '1f', '20', '85', 'a0', '1680', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '200a', '2028', '2029', '202f', '205f', '3000']
		);
		expect(pyStrip('\u001c\u0085 x \u001f')).toBe('x');
		expect(pyStrip('﻿x﻿')).toBe('﻿x﻿');
		expect(pyStrip(' - x-  ', ' -'), "strip(' -') strips a space and a hyphen alone").toBe(' x');
	});

	it('⭐ json.loads: integers apart from floats, keys in their order, a repeated key’s last value in its first place, Python’s constants', () => {
		expect(pyJsonLoads('{"10":1,"2":2.0,"a":3,"10":true}')).toEqual({
			t: 'dict',
			v: [
				['10', { t: 'bool', v: true }],
				['2', { t: 'float', v: 2 }],
				['a', { t: 'int', v: 3n }]
			]
		});
		expect(pyJsonDumps(pyJsonLoads('[NaN, -Infinity, 1e400, -0, -0.0, 123456789012345678901234567890]'))).toBe(
			'[NaN, -Infinity, Infinity, 0, -0.0, 123456789012345678901234567890]'
		);
		for (const bad of ['[1,]', '{"a":1,}', ' \f[1]', '"a\u0001"', '[01]', '[1.]', '[.5]', '[-]', '[+1]', '{a:1}', '[1] x', '"\\x"', '"\\u12"'])
			expect(() => pyJsonLoads(bad), JSON.stringify(bad)).toThrow(PyJsonError);
	});

	it('⭐ a float as Python’s repr writes it', () => {
		expect([1e16, 1e-5, 1.5e-7, 0.0001, 1e22, 1234567890123456.0, 12345678901234568.0, -0.0, 5e-324, 100.0, 1e15, 0.1 + 0.2, -2.5, 1e21, 123.456].map(pyFloatRepr)).toEqual([
			'1e+16',
			'1e-05',
			'1.5e-07',
			'0.0001',
			'1e+22',
			'1234567890123456.0',
			'1.2345678901234568e+16',
			'-0.0',
			'5e-324',
			'100.0',
			'1000000000000000.0',
			'0.30000000000000004',
			'-2.5',
			'1e+21',
			'123.456'
		]);
	});

	it('⛔ an answer nested deeper than the cut reads refuses, rather than cutting otherwise than the screen could', () => {
		const deep = `{"a":${'['.repeat(PY_JSON_MAX_DEPTH)}${']'.repeat(PY_JSON_MAX_DEPTH)}}`;
		expect(() => answerItems(deep)).toThrow(PyJsonTooDeep);
		const fits = `{"a":${'['.repeat(PY_JSON_MAX_DEPTH - 1)}${']'.repeat(PY_JSON_MAX_DEPTH - 1)}}`;
		expect(answerItems(fits)).toHaveLength(1);
	});

	it('⭐ regions and statements: each region by the host line before it; the answer’s items, the account’s sentences, then each list’s items in order', () => {
		const F = '<<<UNTRUSTED-07>>>';
		const head = [
			'The WORK PRODUCT below was produced by a DIFFERENT AI agent, which was given exactly this instruction:',
			F,
			'Count. Then report.',
			F,
			'The WORK PRODUCT to review — the output:',
			F,
			'{"n":"Two. Three.","m":[1]}',
			F,
			'',
			"The producing agent's PROFESSIONAL RATIONALE SUMMARY — its account:",
			F,
			'It is done. It ran once.',
			F,
			'Assumptions relied on:',
			F,
			'  - First.',
			'  - Second -',
			F,
			'Limitations the producer declares: (none declared)',
			'Residual uncertainty:',
			'[CUT FOR THIS REVIEW: the account’s residual uncertainty — the first 3 of its 9 code points are shown; the last 6 are removed.]',
			F,
			'  -',
			F,
			''
		].join('\n');
		expect(regions(head, F).map(([label]) => label.slice(0, 20))).toEqual([
			'The WORK PRODUCT bel',
			'The WORK PRODUCT to ',
			"The producing agent'",
			'Assumptions relied o',
			'[CUT FOR THIS REVIEW'
		]);
		expect(statementsOf(head, F)).toEqual([
			{ from: 'answer.n', text: 'n: Two.' },
			{ from: 'answer.n', text: 'n: Three.' },
			{ from: 'answer.m', text: 'm: [1]' },
			{ from: 'account', text: 'It is done.' },
			{ from: 'account', text: 'It ran once.' },
			{ from: 'assumption', text: 'First.' },
			{ from: 'assumption', text: 'Second' }
		]);
		expect(() => regions(`${head}${F}\nopen`, F), 'an unbalanced region refuses').toThrow(/unbalanced quoted region/);
	});
});

describe('⭐ Z1 (D50) — the block’s numbers and order, as Python makes them', () => {
	it.each(FORMAT_2)('format(%s, ".2f") is %s', (x, s) => {
		expect(pyFormat2(x)).toBe(s);
	});

	it('⛔ toFixed(2) is NOT that rule: at the exact ties 0.125 and 0.625 it writes 0.13 and 0.63', () => {
		expect([0.125, 0.375, 0.625, 0.875].map((x) => x.toFixed(2))).toEqual(['0.13', '0.38', '0.63', '0.88']);
		expect([0.125, 0.375, 0.625, 0.875].map(pyFormat2)).toEqual(['0.12', '0.38', '0.62', '0.88']);
	});

	it('⭐ ranked: by the full score, highest first, a tie in the list’s own order — Python’s stable sort by (-score, index)', () => {
		expect(ranked([0.2, 0.9, 0.2, 0.125, 0.9, 0.1249])).toEqual([1, 4, 0, 2, 3, 5]);
		expect(ranked([]), 'an empty list').toEqual([]);
	});
});
