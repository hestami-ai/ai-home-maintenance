// ⚠ THE RE-DISPOSITIONED "Refuted (32)" MUST RECONCILE AGAINST THE REGISTER, NOT BE TRUSTED TO MATCH IT.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────────────────────
// `docs/_working/HARMONIZATION-FINDINGS.md` carried 75 confirmed findings in a six-column table, then a heading —
// `## Refuted (32) — recorded so they are not re-raised` — and 32 struck one-line sentences. **NOT ONE OF THE 32
// RECORDED A REASON.** No evidence, no site, no date. A refusal with no reason is not a refutation; it is a
// prohibition on re-checking, and it has the force of a settled question with none of the evidence of one.
//
// All 32 were re-checked at HEAD (2026-08-23): **15 TRUE · 13 FALSE · 4 OUT OF SCOPE**. The dispositions and
// their evidence were appended to that file, keyed by ITEM NUMBER, and the 13 that owed a register entry are now
// filed. **That file therefore now makes CHECKABLE CLAIMS — "✅ FILED as REG-F-263" — and nothing checked them.**
//
// ⚠ AND THE FAILURE MODE IS MEASURED, NOT HYPOTHETICAL. Item #31 was marked "owes a register entry" by the sweep
// and was ALREADY FILED — as `REG-F-246`, committed in `a4a19057`, AFTER the sweep ran in `303ee671`. A drafter
// found it by searching rather than by trusting the assignment. A claim about a filing decays the moment another
// batch lands, which is exactly the class this file refuses to let rot.
//
// ── ⚠ LINES 1-120 OF THAT FILE ARE A CONTRACT ────────────────────────────────────────────────────────────────
// ELEVEN citations point into them — `invariant-verdicts.ndjson` at :92 :104 :110 :119, `docs/_working` at
// :110 :119 :120, and **`JPWB-REG-005` at :108 and :110**. REG-005's own changeProcedure is *"Append-only after
// ratification. Entries are never destructively edited."* so those two could never be repaired: re-flowing that
// region would leave dead pointers in ratified canon. The heading is one line and the 32 originals keep their
// exact lines; every disposition lives AFTER item 32 and is keyed by item number, which survives the next edit.
// This file pins that, because the constraint is invisible to anyone editing the document.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FINDINGS = new URL('../docs/_working/HARMONIZATION-FINDINGS.md', import.meta.url);
const REGISTER = new URL('../docs/canon/JPWB-REG-005 Decision and Divergence Register.md', import.meta.url);

const findings = readFileSync(FINDINGS, 'utf8');
const register = readFileSync(REGISTER, 'utf8');
const lines = findings.split('\n');

/** Every `### Item N — DISPOSITION …` heading, with the register ordinals it claims. */
interface Disposition {
	readonly n: number;
	readonly disposition: string;
	readonly ordinals: readonly string[];
}

function dispositions(text: string): Disposition[] {
	const out: Disposition[] = [];
	for (const m of text.matchAll(/^### Item (\d+) — ([A-Z ]+?)(?: · (.*))?$/gm)) {
		out.push({
			n: Number(m[1]),
			disposition: m[2]!.trim(),
			ordinals: [...(m[3] ?? '').matchAll(/REG-[FQ]-\d{3}/g)].map((x) => x[0])
		});
	}
	return out;
}

describe('the re-dispositioned "Refuted (32)" reconciles against the register', () => {
	const all = dispositions(findings);

	it('all 32 are dispositioned, and the split is the one that was measured', () => {
		expect(all.map((d) => d.n).sort((a, b) => a - b)).toEqual(
			Array.from({ length: 32 }, (_, i) => i + 1)
		);
		const dist: Record<string, number> = {};
		for (const d of all) dist[d.disposition] = (dist[d.disposition] ?? 0) + 1;
		expect(dist).toEqual({ 'TRUE AT HEAD': 15, 'FALSE AT HEAD': 13, 'OUT OF SCOPE': 4 });
	});

	// ⚠ THE ORDINAL MUST EXIST AS A HEADING, not merely be mentioned. "Mentioned somewhere in a 25,000-line
	// register" is exactly what an EM-7 search reports as "filed" when nothing was written.
	it('every ordinal a TRUE item claims is a register entry that exists', () => {
		const claimed = all.flatMap((d) => d.ordinals);
		expect(claimed.length, 'ordinals claimed by the 15 true items').toBe(14);
		const missing = claimed.filter((o) => !register.includes(`### ${o} — `));
		expect(missing, 'an item naming a register entry that was never written').toEqual([]);
	});

	// Two of the fifteen are true but need no entry of their own: REG-D-026 already carries tenant/organization
	// scope as a canon DECISION. They are named rather than counted, so that "13 filed of 15 true" cannot be
	// read as two rows quietly dropped.
	it('every TRUE item is either filed or explicitly already-covered', () => {
		const trues = all.filter((d) => d.disposition === 'TRUE AT HEAD');
		expect(trues.length).toBe(15);
		const unresolved = trues.filter((d) => d.ordinals.length === 0).map((d) => d.n);
		expect(
			unresolved,
			'a TRUE item that names no register entry — it is a live gap sealed behind a bare strike'
		).toEqual([5, 7]);
		for (const n of unresolved) {
			const body = findings.split(`### Item ${n} — `)[1] ?? '';
			expect(body.slice(0, 4000)).toContain('REG-D-026');
		}
	});

	// ⚠ THE LINE CONTRACT. The 32 originals must stay where the citations expect them. This is asserted on the
	// FOUR lines that are actually cited from outside plus both ends of the range, rather than on the whole
	// block, so the message names the citation that would break.
	it('the 32 originals keep the exact lines that eleven citations point at', () => {
		expect(lines[86], 'line 87 — the heading; exactly one line, or everything below shifts')
			.toMatch(/^## ~~Refuted \(32\)/);
		const at = (n: number) => lines[n - 1] ?? '';
		expect(at(89), 'item 1 anchors the block').toMatch(/^1\. ~~/);
		expect(at(92), 'cited by invariant-verdicts.ndjson').toMatch(/^4\. ~~/);
		expect(at(104), 'cited by invariant-verdicts.ndjson (x3)').toMatch(/^16\. ~~/);
		expect(at(108), '⚠ cited by JPWB-REG-005, which is APPEND-ONLY and cannot be repaired')
			.toMatch(/^20\. ~~/);
		expect(at(110), '⚠ cited by JPWB-REG-005, which is APPEND-ONLY and cannot be repaired')
			.toMatch(/^22\. ~~/);
		expect(at(119), 'cited by DESIGN-invariant-enforcement-mapping.md').toMatch(/^31\. ~~/);
		expect(at(120), 'cited by docs/_working').toMatch(/^32\. ~~/);
	});

	// CONTROL — THE PARSER READS A REAL DOCUMENT. Every assertion above is satisfied by a parser that returns
	// nothing: no items, no claimed ordinals, no unresolved. This is the vacuity this repository has recorded
	// six times, and it is why the counts above are exact rather than lower bounds.
	it('CONTROL — the parser reads a real document and discriminates', () => {
		expect(all.length, 'dispositions parsed').toBe(32);
		expect(findings.length, 'the file is the whole thing, not a stub').toBeGreaterThan(100_000);
		const fixture = [
			'### Item 99 — TRUE AT HEAD · ✅ FILED as **REG-F-999**',
			'### Item 98 — FALSE AT HEAD'
		].join('\n');
		const parsed = dispositions(fixture);
		expect(parsed.map((d) => d.n)).toEqual([99, 98]);
		expect(parsed[0]!.ordinals, 'an ordinal is read off the heading').toEqual(['REG-F-999']);
		expect(parsed[1]!.ordinals, 'and absent when none is claimed').toEqual([]);
		expect(parsed[1]!.disposition).toBe('FALSE AT HEAD');
	});
});
