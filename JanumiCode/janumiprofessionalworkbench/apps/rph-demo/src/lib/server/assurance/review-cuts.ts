// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.2, revision 9) —
// THE CHECKS AND THE STATEMENTS THE REVIEW'S INDICATIONS BLOCK LISTS, CUT FROM THE PROMPT AS THE SCREEN CUT THEM.
//
// The screen of the sponsor's construct (`REG-F-605`) asked the decision model about each check of the policy's list and
// each statement of the producer's answer and account, one question at a time, and its new arm listed every one of them
// with its score. Its cut was a Python module, `wide_common.py` (`d46-facts-verbatim.md` V10), read over the rendered
// product prompt. This is that cut, ported: the functions below keep its names and order, and its Python semantics where
// JavaScript's differ —
//   · `str.strip()` and `re`'s `\s` strip and match Python's whitespace (`str.isspace()`, `PY_WHITESPACE`): the separators
//     U+001C to U+001F and U+0085 are whitespace to Python and not to JavaScript, and U+FEFF is whitespace to JavaScript
//     and not to Python;
//   · `re`'s `\d` matches any Unicode decimal digit (general category Nd), and `.` any character but a line feed;
//   · `json.loads` keeps a JSON object's keys in the order they first occur, a repeated key's LAST value in its FIRST
//     place, reads `12` as an integer and `12.0` as a float, an integer exactly however long, and reads `NaN`, `Infinity`
//     and `-Infinity`; and `json.dumps(value, ensure_ascii=False)` writes `, ` and `: ` between items, a float as Python's
//     `repr` writes it (`1e-05`, `12.0`, `1e+16`), and a string's characters raw but for `"`, `\` and the control
//     characters (`pyJsonDumps`).
//
// ⛔ WHERE THIS IS NOT THE SCREEN'S, AND WHY: the screen found the review's start by searching the whole prompt for its first
// line (`split_head`, `text.index(REVIEW_STARTS)`). Here the validator hands the HEAD and TODAY'S REVIEW SECTION apart, as
// its assembler built them (`reasoning-review-validator.ts`), so an untrusted slice that carries that line cannot move the
// split: a producer's answer quoting it would otherwise end the head inside the answer and have the rest read as the host's
// rubric. Where the line first occurs at the review's start — every prompt the screen measured — the two are the same.
//
// ⚠ PURE, AND IMPORTING NOTHING: it is inside the review-input closure (`verif/review-input-imports.test.ts`), which the
// qualification check loads outside SvelteKit and outside the demo host.

/** The first words of today's review section — `wide_common.py`'s `REVIEW_STARTS`, D8's first line opening with them. */
export const REVIEW_STARTS = 'Evaluate EACH derivational-integrity failure class below.';

/**
 * Python's whitespace (CPython 3.14, Unicode 16.0.0): the characters `str.isspace()` holds true of, which `str.strip()`
 * strips and `re`'s `\s` matches — measured, every code point, with `chr(c).isspace()` (z1-facts.md).
 */
export const PY_WHITESPACE =
	'\t\n\u000b\u000c\r\u001c\u001d\u001e\u001f \u0085             \u2028\u2029  　';
const IS_PY_SPACE = new Set(PY_WHITESPACE);

/** `s.strip(chars)`: `chars` removed from both ends — Python's whitespace when `chars` is not given. */
export function pyStrip(s: string, chars?: string): string {
	const strip = chars === undefined ? IS_PY_SPACE : new Set(chars);
	let start = 0;
	let end = s.length;
	while (start < end && strip.has(s[start]!)) start += 1;
	while (end > start && strip.has(s[end - 1]!)) end -= 1;
	return s.slice(start, end);
}

/** The class `\s` reads under Python's `re`, as a JavaScript class body. */
const PY_SPACE_CLASS = String.raw`\t\n\u000b\u000c\r\u001c-\u001f \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000`;

/** `re.split(r"(?<=[.])\s+(?=[A-Z“\"`])", …)`: a full stop, Python's whitespace, then a capital, an opening quote or a backtick. */
const SENTENCE_BREAK = new RegExp(`(?<=[.])[${PY_SPACE_CLASS}]+(?=[A-Z\\u201c"\`])`, 'u');

/** `wide_common.py` `sentences`: the text, stripped, split after each full stop that ends a sentence, each part stripped. */
export function sentences(text: string): string[] {
	return pyStrip(text)
		.split(SENTENCE_BREAK)
		.map((p) => pyStrip(p))
		.filter((p) => p !== '');
}

// ── `json.loads` and `json.dumps(…, ensure_ascii=False)`, as Python reads and writes a value ────────────────────────────

/** A value as Python's `json.loads` returns it: its integers apart from its floats, its objects' keys in their order. */
export type PyJson =
	| { readonly t: 'str'; readonly v: string }
	| { readonly t: 'int'; readonly v: bigint }
	| { readonly t: 'float'; readonly v: number }
	| { readonly t: 'bool'; readonly v: boolean }
	| { readonly t: 'null' }
	| { readonly t: 'list'; readonly v: readonly PyJson[] }
	| { readonly t: 'dict'; readonly v: readonly (readonly [string, PyJson])[] };

/** What `json.loads` raises on text that is not one JSON value: a `ValueError`, which `answer_items` catches. */
export class PyJsonError extends Error {}

/**
 * ⛔ HOW DEEP AN ANSWER IS READ. Python's reader goes deeper than this (about 10,000 levels, measured) and then raises an
 * error that is no `ValueError`, which ends the screen's script; there is no cut to match past that. An answer nested
 * deeper than this refuses the review (`PyJsonTooDeep`), the safe direction: no prompt is sent that the reference could
 * not have built.
 */
export const PY_JSON_MAX_DEPTH = 1_000;
export class PyJsonTooDeep extends Error {}

/** Python's JSON whitespace between tokens: space, tab, line feed and carriage return, and nothing else. */
const isJsonSpace = (c: string | undefined): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';
const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const HEX = /^[0-9a-fA-F]{4}$/;

/** `json.loads(text)`, as CPython's C scanner reads it (`Modules/_json.c`, strict). */
export function pyJsonLoads(text: string): PyJson {
	let i = 0;
	const fail = (what: string): never => {
		throw new PyJsonError(`${what} at ${i}`);
	};
	const ws = (): void => {
		while (isJsonSpace(text[i])) i += 1;
	};
	/** The escape at `i`, its backslash and letter read, as the string it stands for. */
	const escaped = (): string => {
		const e = text[i + 1];
		i += 2;
		if (e === '"' || e === '\\' || e === '/') return e;
		if (e === 'b') return '\b';
		if (e === 'f') return '\f';
		if (e === 'n') return '\n';
		if (e === 'r') return '\r';
		if (e === 't') return '\t';
		if (e !== 'u') return fail(String.raw`Invalid \escape`);
		const hex = text.slice(i, i + 4);
		if (!HEX.test(hex)) return fail(String.raw`Invalid \uXXXX escape`);
		// ⭑ A high surrogate escaped beside a low one is ONE code point to Python, and the same two UTF-16 units here;
		// a lone one is kept, as Python keeps it.
		const unit = String.fromCodePoint(Number.parseInt(hex, 16));
		i += 4;
		return unit;
	};
	const string = (): string => {
		i += 1; // the opening quote
		let out = '';
		for (;;) {
			const c = text[i];
			if (c === undefined) return fail('Unterminated string');
			if (c === '"') {
				i += 1;
				return out;
			}
			if (c < ' ') return fail('Invalid control character');
			if (c !== '\\') {
				out += c;
				i += 1;
				continue;
			}
			out += escaped();
		}
	};
	/** An exponent at `i`, read when it holds a digit: true then, else false with `i` where it was. */
	const exponentRead = (): boolean => {
		if (text[i] !== 'e' && text[i] !== 'E') return false;
		const at = i;
		i += 1;
		if (text[i] === '-' || text[i] === '+') i += 1;
		while (isDigit(text[i])) i += 1;
		if (isDigit(text[i - 1])) return true;
		i = at;
		return false;
	};
	const number = (): PyJson => {
		const start = i;
		if (text[i] === '-') i += 1;
		if (text[i] !== undefined && text[i]! >= '1' && text[i]! <= '9') {
			i += 1;
			while (isDigit(text[i])) i += 1;
		} else if (text[i] === '0') i += 1;
		else {
			i = start;
			return fail('Expecting value');
		}
		let isFloat = false;
		if (text[i] === '.' && isDigit(text[i + 1])) {
			isFloat = true;
			i += 2;
			while (isDigit(text[i])) i += 1;
		}
		if (exponentRead()) isFloat = true;
		const literal = text.slice(start, i);
		return isFloat ? { t: 'float', v: Number(literal) } : { t: 'int', v: BigInt(literal) };
	};
	/** After an item of a list or an object: true past `close`, false past a comma and the whitespace after it. */
	const closesItem = (close: string): boolean => {
		ws();
		if (text[i] === close) {
			i += 1;
			return true;
		}
		if (text[i] !== ',') return fail("Expecting ',' delimiter");
		i += 1;
		ws();
		return false;
	};
	/** One member of an object at `i`: its key, the colon and its value, read one level below `depth`. */
	const member = (depth: number): [string, PyJson] => {
		if (text[i] !== '"') return fail('Expecting property name enclosed in double quotes');
		const key = string();
		ws();
		if (text[i] !== ':') return fail("Expecting ':' delimiter");
		i += 1;
		ws();
		return [key, value(depth + 1)];
	};
	const list = (depth: number): PyJson => {
		i += 1;
		ws();
		const items: PyJson[] = [];
		if (text[i] === ']') {
			i += 1;
			return { t: 'list', v: items };
		}
		for (;;) {
			items.push(value(depth + 1));
			if (closesItem(']')) return { t: 'list', v: items };
		}
	};
	/** `null`, `true`, `false`, `NaN`, `Infinity` or `-Infinity` at `i`, or else a number. */
	const bareValue = (): PyJson => {
		if (text.startsWith('null', i)) {
			i += 4;
			return { t: 'null' };
		}
		if (text.startsWith('true', i)) {
			i += 4;
			return { t: 'bool', v: true };
		}
		if (text.startsWith('false', i)) {
			i += 5;
			return { t: 'bool', v: false };
		}
		if (text.startsWith('NaN', i)) {
			i += 3;
			return { t: 'float', v: Number.NaN };
		}
		if (text.startsWith('Infinity', i)) {
			i += 8;
			return { t: 'float', v: Number.POSITIVE_INFINITY };
		}
		if (text.startsWith('-Infinity', i)) {
			i += 9;
			return { t: 'float', v: Number.NEGATIVE_INFINITY };
		}
		return number();
	};
	const value = (depth: number): PyJson => {
		if (depth > PY_JSON_MAX_DEPTH) throw new PyJsonTooDeep(`an answer nested deeper than ${PY_JSON_MAX_DEPTH} levels`);
		const c = text[i];
		if (c === '"') return { t: 'str', v: string() };
		if (c === '{') {
			i += 1;
			ws();
			const keys = new Map<string, number>();
			const pairs: [string, PyJson][] = [];
			if (text[i] === '}') {
				i += 1;
				return { t: 'dict', v: pairs };
			}
			for (;;) {
				const [key, v] = member(depth);
				// ⭑ Python's dict: a repeated key keeps its FIRST place and takes the LAST value.
				const at = keys.get(key);
				if (at === undefined) {
					keys.set(key, pairs.length);
					pairs.push([key, v]);
				} else pairs[at] = [key, v];
				if (closesItem('}')) return { t: 'dict', v: pairs };
			}
		}
		if (c === '[') return list(depth);
		return bareValue();
	};
	ws();
	const v = value(1);
	ws();
	if (i !== text.length) fail('Extra data');
	return v;
}

/** A Python string's JSON with `ensure_ascii=False`: `"` and `\` escaped, the control characters escaped, all else raw. */
function pyJsonString(s: string): string {
	let out = '"';
	for (const c of s) {
		if (c === '"') out += String.raw`\"`;
		else if (c === '\\') out += '\\\\';
		else if (c === '\n') out += String.raw`\n`;
		else if (c === '\r') out += String.raw`\r`;
		else if (c === '\t') out += String.raw`\t`;
		else if (c === '\b') out += String.raw`\b`;
		else if (c === '\f') out += String.raw`\f`;
		else if (c < ' ') out += `\\u${c.codePointAt(0)!.toString(16).padStart(4, '0')}`;
		else out += c;
	}
	return `${out}"`;
}

/** `s` without its trailing zeros, as `s.replace(/0+$/, '')` gives it, read back from its end in one pass. */
function withoutTrailingZeros(s: string): string {
	let end = s.length;
	while (end > 0 && s[end - 1] === '0') end -= 1;
	return s.slice(0, end);
}

/** A positive finite float as JavaScript's `String` writes it, read as its significant digits and the power of ten of the first. */
function digitsAndExponent(s: string): [digits: string, exponent: number] {
	if (s.includes('e')) {
		const [m, e] = s.split('e') as [string, string];
		return [m.replace('.', ''), Number(e)];
	}
	if (s.includes('.')) {
		const [whole, fraction] = s.split('.') as [string, string];
		if (whole === '0') {
			const zeros = fraction.length - fraction.replace(/^0+/, '').length;
			return [fraction.slice(zeros), -(zeros + 1)];
		}
		return [whole + fraction, whole.length - 1];
	}
	return [withoutTrailingZeros(s), s.length - 1];
}

/**
 * A float as Python's `repr` writes it — the shortest digits that read back as the same double, which JavaScript's
 * `String` gives too, placed as Python places them: in exponent form when the decimal point would sit four or more places
 * before the first digit or more than sixteen after it (`1e-05`, `1e+16`), else in fixed form with at least one digit
 * after the point (`0.0001`, `12.0`). ⭑ `json.dumps` writes the three non-finite floats as `NaN`, `Infinity` and
 * `-Infinity`.
 */
export function pyFloatRepr(x: number): string {
	if (Number.isNaN(x)) return 'NaN';
	if (x === Number.POSITIVE_INFINITY) return 'Infinity';
	if (x === Number.NEGATIVE_INFINITY) return '-Infinity';
	if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
	const sign = x < 0 ? '-' : '';
	const s = String(Math.abs(x));
	const [digits, exponent] = digitsAndExponent(s); // the exponent: the power of ten of the first digit
	const point = exponent + 1; // Python's `decpt`: the value is 0.d1d2… × 10^point
	if (point <= -4 || point > 16) {
		const mantissa = digits.length === 1 ? digits : `${digits[0]}.${digits.slice(1)}`;
		return `${sign}${mantissa}e${exponent < 0 ? '-' : '+'}${String(Math.abs(exponent)).padStart(2, '0')}`;
	}
	if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
	if (point >= digits.length) return `${sign}${digits}${'0'.repeat(point - digits.length)}.0`;
	return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** `json.dumps(value, ensure_ascii=False)` with Python's other defaults: `, ` and `: ` between items, keys in their order. */
export function pyJsonDumps(value: PyJson): string {
	switch (value.t) {
		case 'str':
			return pyJsonString(value.v);
		case 'int':
			return value.v.toString();
		case 'float':
			return pyFloatRepr(value.v);
		case 'bool':
			return value.v ? 'true' : 'false';
		case 'null':
			return 'null';
		case 'list':
			return `[${value.v.map(pyJsonDumps).join(', ')}]`;
		case 'dict': {
			const items = value.v.map(([k, v]) => `${pyJsonString(k)}: ${pyJsonDumps(v)}`).join(', ');
			return `{${items}}`;
		}
	}
}

// ── `wide_common.py`: the regions, the statements and the checks ─────────────────────────────────────────────────────

/** One statement of the producer's, with the part of its answer or account it was cut from (`wide_common.py`'s first). */
export interface CutStatement {
	readonly from: string;
	readonly text: string;
}

/** `answer_items`: an answer that is one JSON object, item by item; any other answer by its sentences, or whole. */
export function answerItems(text: string): CutStatement[] {
	const stripped = pyStrip(text);
	let parsed: PyJson;
	try {
		parsed = pyJsonLoads(stripped);
	} catch (e) {
		if (e instanceof PyJsonError) return sentences(stripped).map((s) => ({ from: 'answer', text: s }));
		throw e;
	}
	if (parsed.t !== 'dict') return [{ from: 'answer', text: stripped }];
	return parsed.v.flatMap(([key, value]): CutStatement[] =>
		value.t === 'str'
			? sentences(value.v).map((s) => ({ from: `answer.${key}`, text: `${key}: ${s}` }))
			: [{ from: `answer.${key}`, text: `${key}: ${pyJsonDumps(value)}` }]
	);
}

/** `regions`: each region between two `fence` lines of `head`, with the last host line before it that is not blank. */
export function regions(head: string, fence: string): (readonly [label: string, body: string])[] {
	const out: [string, string][] = [];
	let inside = false;
	let buf: string[] = [];
	let label = '';
	for (const line of head.split('\n')) {
		if (line === fence) {
			if (inside) {
				out.push([label, buf.join('\n')]);
				buf = [];
			}
			inside = !inside;
		} else if (inside) buf.push(line);
		else if (pyStrip(line) !== '') label = line;
	}
	// ⛔ The assembler writes every region's two fence lines itself: an open region here is the host's own defect.
	if (inside) throw new Error('This review was not sent: its head holds an unbalanced quoted region, so its statements cannot be cut. No model was called.');
	return out;
}

/** A list's items, one a line, each stripped of the spaces and hyphens around it (`x.strip(" -")`), blank lines dropped. */
const listItems = (from: string, body: string): CutStatement[] =>
	body
		.split('\n')
		.filter((x) => pyStrip(x) !== '')
		.map((x) => ({ from, text: pyStrip(x, ' -') }));

/**
 * `statements`: the producer's statements, in order — the answer's items, the account's sentences, then its assumptions,
 * limitations and residual uncertainty — each region read by the host label before it. `head` is the prompt before today's
 * review section, its last line feed included, and `fence` the prompt's own.
 */
export function statementsOf(head: string, fence: string): CutStatement[] {
	const out: CutStatement[] = [];
	for (const [label, body] of regions(head, fence)) {
		if (label.startsWith('The WORK PRODUCT to review')) out.push(...answerItems(body));
		else if (label.startsWith("The producing agent's PROFESSIONAL RATIONALE SUMMARY"))
			out.push(...sentences(body).map((s) => ({ from: 'account', text: s })));
		else if (label.startsWith('Assumptions relied on')) out.push(...listItems('assumption', body));
		else if (label.startsWith('Limitations the producer declares')) out.push(...listItems('limitation', body));
		else if (label.startsWith('Residual uncertainty')) out.push(...listItems('residual', body));
	}
	return out;
}

/** One check of the policy's list, as the rubric line shows it, its bracket removed. */
export interface CutCheck {
	readonly id: string;
	readonly label: string;
}

/** `re.match(r"- ([A-Z]{2}-\d\d[A-Za-z0-9-]*): (.*?)(?: \[if unmet: [A-Z]+\])?$", line)`, with Python's `\d` and `.`. */
const CHECK_LINE = /^- ([A-Z]{2}-\p{Nd}\p{Nd}[A-Za-z0-9-]*): ([^\n]*?)(?: \[if unmet: [A-Z]+\])?$/u;

/** `checks`: the prompt's own list of criteria, read off today's review section's lines, the policy's bracket removed. */
export function checksOf(todaySection: string): CutCheck[] {
	return todaySection.split('\n').flatMap((line) => {
		const m = CHECK_LINE.exec(line);
		return m ? [{ id: m[1]!, label: m[2]! }] : [];
	});
}
