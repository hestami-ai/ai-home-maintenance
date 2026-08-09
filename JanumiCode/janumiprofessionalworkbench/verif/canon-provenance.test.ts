// P-2 — CON-000 B3 made mechanically applicable, and the three traps that inverted its answer.
//
// B3, as amended by REG-D-034: canon governs a principle *"only if the divergence carries a ratifying act naming
// it"*; otherwise the clause is *"DEFECTIVE, not governing"*. This file proves the reader that decides that is
// not itself lying — which matters more here than usual, because every one of the three traps below produced a
// CONFIDENT WRONG ANSWER rather than an obvious failure, and two of them inverted the verdict for exactly the
// clauses the ruling was about.
import { describe, expect, it } from 'vitest';
import { b3Standing, provenanceIndex, ratifyingActsFor } from './canon-provenance.js';

describe('P-2 — canon clause provenance and ratifying acts', () => {
	it('PINNED — the sidecar index and its provenance mix', () => {
		const idx = provenanceIndex();
		expect(idx.size).toBe(69);
		const mix: Record<string, number> = {};
		for (const c of idx.keys()) {
			const p = b3Standing(c).provenance;
			mix[p] = (mix[p] ?? 0) + 1;
		}
		expect(mix).toEqual({ DISTILLED: 68, AUTHORED_AT_CANON: 1 });
	});

	// The ruling's own worked examples. If these three ever disagree with REG-D-034, either the register moved or
	// this reader broke — and both need a human, so they are pinned by name rather than by count.
	it('PINNED — the three clauses REG-D-034 turns on', () => {
		expect(b3Standing('PER-12')).toMatchObject({
			// No sidecar entry, and that is CORRECT: REG-D-015 replaced the clause's content, so the ruling IS its
			// provenance. A reader treating this as a gap would report the one legitimate amendment as unsourced.
			provenance: 'RULING_SOURCED',
			ratifyingActs: ['REG-D-015'],
			divergenceWouldBePermitted: true
		});
		for (const defective of ['ASR-14', 'ASR-16']) {
			expect(b3Standing(defective), `${defective} is distilled with no act`).toMatchObject({
				provenance: 'DISTILLED',
				ratifyingActs: [],
				divergenceWouldBePermitted: false
			});
		}
	});

	it('PINNED — the constitutional clauses REG-D-034 itself amended', () => {
		expect(ratifyingActsFor('B3')).toEqual(['REG-D-034']);
		expect(ratifyingActsFor('B8')).toEqual(['REG-D-034']);
		expect(ratifyingActsFor('B1'), 'B1 was also touched by the founding decisions').toEqual([
			'REG-D-008',
			'REG-D-009',
			'REG-D-034'
		]);
	});

	// ── TRAP 1: A FINDING IS NOT A RATIFYING ACT ─────────────────────────────────────────────────────────────
	// `REG-F-094` is the entry that identified ASR-14 and ASR-16 as defective — it discusses them at length. A
	// reader searching the register for a clause name therefore returns an "act" for precisely the two clauses
	// that have none, and reports defective clauses as governing. Only REG-D-* confers.
	it('CONTROL — a REG-F finding discussing a clause is not a ratifying act', () => {
		const acts = ratifyingActsFor('ASR-14');
		expect(acts.every((a) => a.startsWith('REG-D-')), 'only decisions confer').toBe(true);
		expect(acts).not.toContain('REG-F-094');
		expect(acts).toEqual([]);
	});

	// ── TRAP 2: NOR IS BEING MENTIONED BY A DECISION ─────────────────────────────────────────────────────────
	// Scoping to REG-D-* sections is NOT enough, and this is the subtler half. REG-D-034's own body names ASR-14,
	// ASR-16 and PER-12 while merging into `JPWB-CON-000 B1 / B3 / B8` — it ratifies none of the three it
	// discusses. The discriminator is the **Merge target** line, not the section body.
	it('CONTROL — a decision that MENTIONS a clause has not ratified it; only its merge target counts', () => {
		expect(ratifyingActsFor('ASR-16'), 'discussed by REG-D-034, merged by nothing').toEqual([]);
		// And the positive half, so the filter is not simply rejecting everything: REG-D-015 DOES merge into
		// PER-12, and must still be found.
		expect(ratifyingActsFor('PER-12')).toEqual(['REG-D-015']);
	});

	// ── TRAP 3: THE SIDECARS USE MORE THAN ONE LINE FORMAT ───────────────────────────────────────────────────
	// Requiring `- ID:` indexed 62 and silently dropped the whole `- ID <text>` family — every AX-* axiom. An
	// under-reading reader is the defect this repository has now measured five times; here it would have made a
	// twelve-clause family invisible to the constitutional check that governs them.
	it('CONTROL — both sidecar line formats are read, including the colon-less AX family', () => {
		const idx = provenanceIndex();
		const ax = [...idx.keys()].filter((c) => c.startsWith('AX-'));
		expect(ax.length, 'the `- AX-n text` format has no colon and was dropped by the first reader').toBe(12);
		const families = new Set([...idx.keys()].map((c) => c.split('-')[0]));
		expect(families.size, 'the index must span the canon families, not one artifact').toBeGreaterThan(8);
	});

	// ── CONTROL: THE SYSTEMIC READING, WHICH IS THE POINT OF THE WHOLE EXERCISE ──────────────────────────────
	// Of 69 indexed clauses, NOT ONE carries a clause-level ratifying act. Under B3 that means essentially every
	// canon clause is defective-if-divergent — its source controls unless someone rules otherwise. That is a
	// large claim, so it is asserted rather than left implicit: if a future act ever ratifies a clause, this
	// reddens and the systemic statement must be re-read rather than quietly outliving its truth.
	it('CONTROL — no indexed clause yet carries a clause-level ratifying act', () => {
		const idx = provenanceIndex();
		const withActs = [...idx.keys()].filter((c) => ratifyingActsFor(c).length > 0);
		expect(withActs, 'if this is no longer empty, B3 now permits a divergence somewhere — say where').toEqual(
			[]
		);
		expect(idx.size, 'and the population must be real for that zero to mean anything').toBeGreaterThan(60);
	});
});
