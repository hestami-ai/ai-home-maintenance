// REG-F-045's REMEDY, discharged 2026-08-09 — three days after it was recorded, and only because a DUPLICATE
// finding (REG-F-091) sent me back to read the register.
//
// THE DEFECT, as REG-F-045 stated it: *"Half the transition vocabulary says 'RECONSTRUCTED' and the generator has
// no field to carry it, so 120 authored arrows ship wearing the same face as ratified ones."* The generator's
// `transitionLit` emitted `from`/`to`/`trigger`/`guard` and dropped `note`; `TransitionSpec` had no field for it.
// The entry was precise about why that is worse than a missing annotation: **the rows are annotated UPSTREAM and
// the annotation is destroyed** — *"somebody did the honest thing 120 times and the build step threw it away"* —
// while the generated header calls the file *"grounded"* and *"reconciled"*.
//
// ⚠ AND IT BECAME LOAD-BEARING AFTER IT WAS FILED. CON-000 B3, as amended by REG-D-034, makes canon govern a
// principle *only where a divergence carries a ratifying act*. Whether a trigger is corpus text or an author's
// inference decides what a divergence even means — so an annotation the build destroys is now a constitutional
// question, not a provenance nicety.
//
// THE REMEDY, verbatim from the entry: *"add `note` / `sourceSection` to `TransitionSpec`, emit them, and add a
// census asserting that every row whose vocab note says RECONSTRUCTED…"*. This is that census.
import { STATE_MACHINES } from '@janumipwb/rph-domain';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const VOCAB = new URL('../packages/rph-domain/vocab/m2-transitions.json', import.meta.url);

type Row = { from?: string; to?: string; note?: string };
type Machine = { name: string; sourceSection?: string; transitions?: Row[] };
type Generated = { transitions: readonly Row[]; states?: readonly string[]; sourceSection?: string };

const generated = STATE_MACHINES as unknown as Record<string, Generated>;
const vocab = () =>
	(JSON.parse(readFileSync(VOCAB, 'utf8')) as { machines: Machine[] }).machines;

describe('REG-F-045 — the vocab\'s provenance survives generation', () => {
	// ⚠ THE COUNTS DIFFER BETWEEN VOCAB AND GENERATED, AND THAT IS CORRECT, NOT DRIFT. Multi-source rows use `/`
	// (`PRESERVED/AT_RISK -> VIOLATED`) and the generator EXPANDS them, so 211 vocab rows become 304 arrows and a
	// single annotated row becomes several annotated arrows. Both numbers are pinned so a change in either is
	// visible; equality between them would be the wrong assertion.
	it('PINNED — annotation counts on both sides of the generator', () => {
		const vrows = vocab().flatMap((m) => m.transitions ?? []);
		expect(
			{
				vocabRows: vrows.length,
				vocabNoted: vrows.filter((t) => t.note).length,
				vocabReconstructed: vrows.filter((t) => /RECONSTRUCT/i.test(t.note ?? '')).length
			},
			'REG-F-045 recorded 180 noted / 120 RECONSTRUCTED; unchanged since 2026-08-06'
		).toEqual({ vocabRows: 215, vocabNoted: 184, vocabReconstructed: 120 });

		const grows = Object.values(generated).flatMap((m) => m.transitions);
		expect({
			generatedArrows: grows.length,
			generatedNoted: grows.filter((t) => t.note).length,
			generatedReconstructed: grows.filter((t) => /RECONSTRUCT/i.test(t.note ?? '')).length
		}).toEqual({ generatedArrows: 308, generatedNoted: 277, generatedReconstructed: 180 });
	});

	// The remedy's own words: every row the vocab marks RECONSTRUCTED must still say so downstream.
	it('every RECONSTRUCTED vocab row is still marked RECONSTRUCTED after generation', () => {
		const lost: string[] = [];
		let markerRows = 0;
		for (const m of vocab()) {
			const gen = generated[m.name];
			if (!gen) {
				lost.push(`${m.name}: machine absent from the generated output`);
				continue;
			}
			for (const row of m.transitions ?? []) {
				if (!/RECONSTRUCT/i.test(row.note ?? '')) continue;
				// TWO EXPANSION SHAPES, and the census found the second by failing on it. A `/`-separated source is
				// one arrow per literal state. But a row may also carry a MARKER — `PWU.executionState` has
				// `"Any active"->SUPERSEDED`, which the generator expands against the machine's non-terminal states.
				// Re-implementing that expansion here would duplicate the generator and drift from it, so a marker row
				// is checked by its TARGET instead: every generated arrow into that `to` must carry the annotation.
				const tokens = (row.from ?? '').split('/');
				const literal = tokens.filter((t) => (gen.states ?? []).includes(t));
				if (literal.length === tokens.length) {
					for (const from of tokens) {
						const arrow = gen.transitions.find((t) => t.from === from && t.to === row.to);
						if (!arrow) lost.push(`${m.name} ${from}->${row.to}: expanded arrow missing`);
						else if (!/RECONSTRUCT/i.test(arrow.note ?? ''))
							lost.push(`${m.name} ${from}->${row.to}: annotation DESTROYED by the generator`);
					}
				} else {
					markerRows += 1;
					const into = gen.transitions.filter((t) => t.to === row.to);
					if (into.length === 0) lost.push(`${m.name} ${row.from}->${row.to}: marker expanded to nothing`);
					for (const a of into.filter((t) => !/RECONSTRUCT/i.test(t.note ?? '')))
						lost.push(`${m.name} ${a.from}->${row.to}: marker expansion lost the annotation`);
				}
			}
		}
		expect(lost, lost.join('\n')).toEqual([]);
		// Pinned so the weaker target-based path cannot silently become the whole census — or vanish from it.
		expect(markerRows, 'RECONSTRUCTED rows checked by target rather than by literal source').toBe(7); // measured, not guessed — I first wrote 1 and the assertion corrected me
	});

	it('every machine carries its vocab sourceSection downstream', () => {
		const missing = vocab()
			.filter((m) => m.sourceSection && !generated[m.name]?.sourceSection)
			.map((m) => m.name);
		expect(missing, 'the machine-level disclaimer is what says the STATES are verbatim while the ARROWS are not')
			.toEqual([]);
	});

	// ── CONTROL: THE CENSUS IS NOT COMPARING TWO EMPTY SETS ──────────────────────────────────────────────────
	// Every assertion above passes if either side yields nothing — the vocab reader returning `[]` would make the
	// loop body unreachable and the test vacuously green. That is the exact shape this repository has measured
	// five times, so the population is asserted on BOTH sides rather than assumed.
	it('CONTROL — both sides of the comparison are populated', () => {
		expect(vocab().length, 'vocab machines').toBe(27);
		expect(Object.keys(generated).length, 'generated machines').toBe(27);
		const anyNoted = Object.values(generated).some((m) => m.transitions.some((t) => t.note));
		expect(anyNoted, 'if NO generated arrow carries a note, the census above proves nothing').toBe(true);
	});
});
