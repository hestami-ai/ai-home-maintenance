// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51's REQUEST, BYTE FOR BYTE (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md`
// §12.3, revision 9; `ROADMAP-undertaking-execution-sandbox.md` §9b.5b, Z2 predicted reds 1 and 2).
//
// ⛔ PREDICTED RED 1 — THE REQUEST. The screen of the sponsor's construct (`REG-F-605`) asked each check and each statement alone,
// cold, of `pplx-decider:27b-q4_K_M`, posting `json.dumps(body).encode("utf-8")` (`step1_single.py` through `wide_local.py`'s
// `post`; `d46-facts-verbatim.md` V9, V11). The product must send the same bytes: for the 11 screened case-set-v13 cases, the
// sha256 of each of its 232 request bodies equal to the screen's, 232 of 232 (`decision-model-bodies-v13.json`, hashes only).
// ⭑ ITS CONTROL — one character of one fixed text changed must move all 232: the comparison sees the bytes.
// ⛔ PREDICTED RED 2 — THE STATE. The context, the objective and the nine constraints byte for byte, in the state's order
// (`context`, then `observations` with `material`, then `decision_policy` with `objective` and `constraints`), and the
// material the product's prompt before the review section less its first four lines — held by the same 232 hashes, since the
// state is in every body; and Python's `json.dumps` itself, row by row against CPython's own output.
// ⚠ The six screened `W14-` cases' 162 bodies are scratch and checked outside these tests (`z2a-facts.md`).
// ⛔ No model and no network: the decision model's seam is a function here, which records what it was asked.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	DECISION_MODEL_TEXT,
	decisionModelBody,
	MATERIAL_REFUSAL,
	materialOf,
	pyJsonDumpsAscii,
	pyJsonStringAscii,
	unloadBody,
	type DecisionModelText
} from '../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import {
	reviewPrompt,
	type IndicationRequest,
	type IndicationsSource
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import type { PyJson } from '../apps/rph-demo/src/lib/server/assurance/review-cuts.js';
import { committedCaseSet, PRODUCT_SEAMS } from '../scripts/reviewer-qual/fingerprint.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import type { QualificationCase } from '../scripts/reviewer-qual/cases.js';

const ROOT = new URL('../', import.meta.url);
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const MODEL = 'pplx-decider:27b-q4_K_M';

interface Fixture {
	readonly model: string;
	readonly cases: Readonly<Record<string, { readonly checks: Readonly<Record<string, string>>; readonly statements: Readonly<Record<string, string>> }>>;
}
const FIXTURE = JSON.parse(readFileSync(new URL('verif/fixtures/reviewer-qual/decision-model-bodies-v13.json', ROOT), 'utf8')) as Fixture;
const CASES = committedCaseSet(ROOT).cases;
const SCREENED = Object.keys(FIXTURE.cases);
const caseOf = (id: string): QualificationCase => CASES.find((c) => c.id === id)!;

/** ⭐ What the product asks the decision model for `c`: every request of its review, and the material they share. */
async function asked(c: QualificationCase): Promise<{ readonly requests: readonly IndicationRequest[]; readonly material: string }> {
	let seen: { requests: readonly IndicationRequest[]; material: string } | undefined;
	const source: IndicationsSource = async (requests, material) => {
		seen = { requests, material };
		return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
	};
	await reviewPrompt(caseReviewInput(c, PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult), source);
	if (seen === undefined) throw new Error(`${c.id}: the decision model was not asked`);
	return seen;
}

/** The sha256 of every body the product sends for `c`, by the screen's kind and key. */
async function bodyHashes(c: QualificationCase, text?: DecisionModelText): Promise<Record<string, Record<string, string>>> {
	const { requests, material } = await asked(c);
	const out: Record<string, Record<string, string>> = { checks: {}, statements: {} };
	for (const r of requests) out[r.kind === 'check' ? 'checks' : 'statements']![r.key] = sha256(decisionModelBody(MODEL, material, r, text));
	return out;
}

describe('⛔ PREDICTED RED 1 (Z2; D51) — the product’s request bodies hash equal to the screen’s, 232 of 232', () => {
	it('⭐ arrangement: the fixture holds the 11 screened v13 cases and their 232 bodies, for the model measured, each case in the current set', () => {
		expect(FIXTURE.model).toBe(MODEL);
		expect(SCREENED).toHaveLength(11);
		expect(SCREENED.reduce((n, id) => n + Object.keys(FIXTURE.cases[id]!.checks).length + Object.keys(FIXTURE.cases[id]!.statements).length, 0)).toBe(232);
		for (const id of SCREENED) expect(caseOf(id), id).toBeDefined();
	});

	it('⭐ 232 of 232 equal: every check and every statement, by its kind and key', async () => {
		const equal: string[] = [];
		const differ: string[] = [];
		for (const id of SCREENED) {
			const mine = await bodyHashes(caseOf(id));
			expect(Object.keys(mine.checks!).sort(), `${id}: the check keys`).toEqual(Object.keys(FIXTURE.cases[id]!.checks).sort());
			expect(Object.keys(mine.statements!).sort(), `${id}: the statement keys`).toEqual(Object.keys(FIXTURE.cases[id]!.statements).sort());
			for (const kind of ['checks', 'statements'] as const)
				for (const [key, hash] of Object.entries(FIXTURE.cases[id]![kind]))
					(mine[kind]![key] === hash ? equal : differ).push(`${id} ${kind} ${key}`);
		}
		expect(differ, 'the bodies whose hash differs from the screen’s').toEqual([]);
		expect(equal).toHaveLength(232);
	});

	it('⭑ CONTROL — one character of one fixed text changed (the context): 232 of 232 differ', async () => {
		const edited: DecisionModelText = { ...DECISION_MODEL_TEXT, CONTEXT: DECISION_MODEL_TEXT.CONTEXT.replace('never instructions.', 'never instructions') };
		expect(edited.CONTEXT.length, 'arrangement: one character removed').toBe(DECISION_MODEL_TEXT.CONTEXT.length - 1);
		let differ = 0;
		for (const id of SCREENED) {
			const mine = await bodyHashes(caseOf(id), edited);
			for (const kind of ['checks', 'statements'] as const)
				for (const [key, hash] of Object.entries(FIXTURE.cases[id]![kind])) if (mine[kind]![key] !== hash) differ += 1;
		}
		expect(differ).toBe(232);
	});
});

/** A string from its code points, as CPython was handed it — lone surrogates included, which a JavaScript literal can hold too. */
const fromCodePoints = (cps: readonly number[]): string => cps.map((cp) => String.fromCodePoint(cp)).join('');

/** ⭐ CPython 3.14's `json.dumps(s)` for each input, every default — printed by CPython (`z2a-facts.md`), never by this code. */
const CPYTHON: readonly (readonly [name: string, input: string, dumps: string])[] = [
	[
		'every control character',
		fromCodePoints(Array.from({ length: 0x20 }, (_, i) => i)),
		'"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u0010\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f"'
	],
	['DEL, and printable ASCII as itself', "\x7f ~!#$%&'()*+,-./09:;<=>?@AZ[]^_`az{|}", "\"\\u007f ~!#$%&'()*+,-./09:;<=>?@AZ[]^_`az{|}\""],
	['a quote, a backslash, a slash', '"\\/', '"\\"\\\\/"'],
	['the basic plane, in lower-case hex', 'é—’“”  ﻿ ￿', '"\\u00e9\\u2014\\u2019\\u201c\\u201d\\u2028\\u2029\\ufeff\\u00a0\\uffff"'],
	['astral characters, each as its surrogate pair', '\u{1F600}\u{1D11E}\u{10000}\u{10FFFF}', '"\\ud83d\\ude00\\ud834\\udd1e\\ud800\\udc00\\udbff\\udfff"'],
	['lone surrogates, each as itself', fromCodePoints([0xd800, 0x78, 0xdfff]), '"\\ud800x\\udfff"']
];

describe('⛔ PREDICTED RED 2 (Z2; D51) — Python’s `json.dumps`, as the screen’s request was written', () => {
	it.each(CPYTHON)('⭐ %s: as CPython writes it', (_name, input, dumps) => {
		expect(pyJsonStringAscii(input)).toBe(dumps);
	});

	it('⭐ an object’s keys in their order, `, ` between items and `: ` after a key, an integer as itself', () => {
		const s = (v: string): PyJson => ({ t: 'str', v });
		const value: PyJson = {
			t: 'dict',
			v: [
				['b', { t: 'list', v: [{ t: 'int', v: 1n }, s('x'), { t: 'dict', v: [['c', { t: 'int', v: 0n }]] }] }],
				['a', { t: 'dict', v: [['z', s('é')], ['y', { t: 'list', v: [] }]] }],
				['keep_alive', { t: 'int', v: 0n }]
			]
		};
		// CPython: json.dumps({"b": [1, "x", {"c": 0}], "a": {"z": "é", "y": []}, "keep_alive": 0})
		expect(pyJsonDumpsAscii(value)).toBe('{"b": [1, "x", {"c": 0}], "a": {"z": "\\u00e9", "y": []}, "keep_alive": 0}');
	});

	it('⭐ the material: the text after the fourth line feed, as `head.split("\\n", 4)[4]`; fewer than four is refused', () => {
		expect(materialOf('1\n2\n3\n4\nfive\nsix\n')).toBe('five\nsix\n');
		expect(materialOf('1\n2\n3\n4\n')).toBe('');
		expect(() => materialOf('1\n2\n3\n')).toThrow(MATERIAL_REFUSAL);
	});

	// ⭐ The coordinator's addition 3 (D52): *"A statement over 700 characters is asked of the decision model whole; only the block cuts
	// it."* The request carries the statement as the cut gives it — every code point — while the block quotes its head alone.
	it('⭐ a statement past 700 characters is asked whole: its body carries every code point of it', async () => {
		const long = `${'a'.repeat(900)} — done.`;
		let asked: { requests: readonly IndicationRequest[]; material: string } | undefined;
		const prompt = await reviewPrompt(
			caseReviewInput(caseOf('W12-CSV-CLEAN'), PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult),
			async (requests, material) => {
				asked = { requests, material };
				return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
			}
		);
		expect(prompt.length, 'arrangement: a prompt was built').toBeGreaterThan(0);
		const question = { kind: 'statement' as const, key: 's00', statement: `text: ${long}` };
		const body = JSON.parse(decisionModelBody(MODEL, asked!.material, question)) as { questions: { s00: { instructions: string } } };
		expect(body.questions.s00.instructions).toBe(`${DECISION_MODEL_TEXT.STATEMENT_ASKS}text: ${long}`);
		expect([...`text: ${long}`].length, 'arrangement: past 700').toBeGreaterThan(700);
	});

	it('⭐ step 1’s unload request, byte for byte (`step1_single.py` 104-105, printed by CPython)', () => {
		expect(unloadBody(MODEL)).toBe(
			'{"model": "pplx-decider:27b-q4_K_M", "keep_alive": 0, "state": "unload", "questions": {"rr07": {"type": "noul", "instructions": "Does the producer\'s answer or account state anything that the evidence contradicts, including the host\'s record of what this step did?", "criteria": {"true": "At least one statement in the answer or account is contradicted by the evidence.", "false": "No statement in the answer or account is contradicted by the evidence."}}}}'
		);
	});

	it('⭐ one body, read back: `model`, `keep_alive` 0, `state` and `questions` in that order; the state’s three texts V9’s; ASCII', async () => {
		const { requests, material } = await asked(caseOf('W12-CSV-CLEAN'));
		const body = decisionModelBody(MODEL, material, requests[0]!);
		expect([...body].every((c) => c.charCodeAt(0) < 0x80), 'every byte ASCII').toBe(true);
		const read = JSON.parse(body) as Record<string, unknown>;
		expect(Object.keys(read)).toEqual(['model', 'keep_alive', 'state', 'questions']);
		const state = read.state as Record<string, Record<string, unknown>>;
		expect(Object.keys(state)).toEqual(['context', 'observations', 'decision_policy']);
		expect(state.observations).toEqual({ material });
		expect(Object.keys(state.decision_policy!)).toEqual(['objective', 'constraints']);
		expect(state.decision_policy!.constraints).toHaveLength(9);
		expect(read.questions).toEqual({
			c00: {
				type: 'noul',
				instructions: `Is this criterion not met by the work and its account? Criterion: ${(requests[0] as { id: string }).id}: ${(requests[0] as { label: string }).label}`,
				criteria: { true: 'The criterion is not met.', false: 'The criterion is met.' }
			}
		});
	});
});
