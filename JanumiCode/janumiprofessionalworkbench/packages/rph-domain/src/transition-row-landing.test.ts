// TRANSITION ROW LANDING — every arrow written in the vocab must survive into the machine.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// REG-F-021 residual R-1 was closed on 2026-08-05 with the account that DOC-004 §30's sixth alternate transition,
// `ANY ACTIVE → CANCELLED`, had been LOST IN TRANSCRIPTION — that a quantifier is not a row, so the row was never
// written. That account is WRONG, and this file is what found it. The row WAS written. It has been in
// `m2-transitions.json` since the workbench arrived in this repository (19a1b20f), spelled `ANY_ACTIVE`, carrying
// a note that states its own intended expansion. It was lost one layer lower: `gen-transitions.ts` recognises the
// quantifier spelled `Any active` — with a SPACE — and `ANY_ACTIVE` matches nothing, falls through to the literal
// branch, fails `stateSet.has('ANY_ACTIVE')`, and is FILTERED OUT WITH NO ERROR AND NO WARNING.
//
// So the corpus said it, the transcription carried it, and the build dropped it in silence. The one place nobody
// looked was between the two artifacts that were each individually correct.
//
// ── WHY THE SILENT DROP WAS, BY ACCIDENT, THE ONLY THING KEEPING THIS MACHINE HONEST ─────────────────────────
// The tempting fix — teach `expandFrom` to accept `ANY_ACTIVE` — is the WRONG fix, and this is the part worth
// keeping. `expandFrom` implements "any active" as `states MINUS terminalStates`. For AssuranceAssessment.state
// those two partitions DIFFER: SATISFIED, CONDITIONALLY_SATISFIED and WAIVED are non-terminal (each can still
// leave, via INVALIDATED or WAIVER_EXPIRED) but they are NOT active — they are verdicts. Had the spelling
// matched, the row would have minted `SATISFIED → CANCELLED`, `CONDITIONALLY_SATISFIED → CANCELLED` and
// `WAIVED → CANCELLED`: cancelling an assessment that has already concluded, which the corpus does not ratify and
// which `assessment-cancellation.test.ts` explicitly forbids. "Active" is a claim about whether work is still
// under way; "non-terminal" is a claim about whether the machine can still leave. They coincide in the machines
// where this quantifier currently lands, and they part company here.
//
// That is why the resolution is four LITERAL rows and the deletion of the quantifier, not a looser matcher.
//
// ── THE INSTRUMENT, AND WHAT IT CANNOT SEE ───────────────────────────────────────────────────────────────────
// This gate reads BOTH artifacts, which is unusual here — the house rule is to derive from the runtime. It has to:
// the defect IS the gap between the vocab and the generated machine, and an instrument holding only one side
// cannot see a gap. What it must NOT do is re-run `expandFrom`, because a checker that recomputes the generator's
// answer agrees with the generator by construction and would have passed on 19a1b20f. So landing is detected by a
// FINGERPRINT the generator copies verbatim onto every edge it emits: the row's `trigger`. A row that landed left
// its trigger in the output; a row that was dropped left nothing.
//
// BLIND SPOT, STATED: five (machine, to, trigger) keys are shared by more than one row, so if one row of such a
// group landed and a sibling dropped, the fingerprint alone would not notice. The slash-compound check below
// closes that for the compound case, and the generator now THROWS on any unaccounted row — a second instrument
// with a different failure mode. Neither is trusted alone.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STATE_MACHINES } from './transitions.data.js';

interface VocabRow {
	readonly from: string;
	readonly to: string;
	readonly trigger: string;
	readonly guard?: string;
	readonly note?: string;
	/** Set ONLY on a row that is not an arrow at all; the value is the ruling that says so. */
	readonly unrepresentable?: string;
}
interface VocabMachine {
	readonly name: string;
	readonly states: string[];
	readonly transitions: VocabRow[];
}

const vocabPath = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'vocab',
	'm2-transitions.json'
);
const vocab = JSON.parse(readFileSync(vocabPath, 'utf8')) as { machines: VocabMachine[] };

const describeRow = (m: string, r: VocabRow) => `${m}: "${r.from}" -> ${r.to}  [${r.trigger}]`;

/** Did any edge the generator emitted carry this row's trigger to this row's target? */
function landed(machineName: string, row: VocabRow): boolean {
	const gen = STATE_MACHINES[machineName];
	if (!gen) return false;
	return gen.transitions.some((t) => t.to === row.to && t.trigger === row.trigger);
}

describe('transition row landing (vocab -> generated machine)', () => {
	it('every declared row lands at least one edge, or says in the row why it is not an arrow', () => {
		const lost: string[] = [];
		for (const m of vocab.machines)
			for (const r of m.transitions ?? [])
				if (!r.unrepresentable && !landed(m.name, r)) lost.push(describeRow(m.name, r));
		expect(
			lost,
			'these arrows are written in the ratified vocab and are absent from the machine the engine runs. A row ' +
				'that vanishes between the two is worse than one never written: it reads as delivered in every review ' +
				'of either artifact alone'
		).toEqual([]);
	});

	it('a slash-compound row lands EVERY component that names a real state', () => {
		// The fingerprint check above is satisfied by ONE surviving edge, so a compound row that lost some of its
		// arms would still pass it. This is the arm-level reading, and it is also the check that would catch a
		// component misspelled against the machine's state set.
		const partial: string[] = [];
		for (const m of vocab.machines) {
			const gen = STATE_MACHINES[m.name];
			if (!gen) continue;
			const states = new Set(m.states);
			for (const r of m.transitions ?? []) {
				if (r.unrepresentable || !r.from.includes('/')) continue;
				for (const arm of r.from.split('/').map((s) => s.trim()))
					if (states.has(arm) && !gen.transitions.some((t) => t.from === arm && t.to === r.to))
						partial.push(`${describeRow(m.name, r)} — arm ${arm} did not land`);
			}
		}
		expect(partial).toEqual([]);
	});

	it('CONTROL: the detector fires on a row that genuinely did not land', () => {
		// Without this, all three greens above are also what a detector that can only say "fine" would produce —
		// and the defect this file was written for survived exactly that kind of instrument for months.
		const machine = 'AssuranceAssessment.state';
		expect(
			landed(machine, { from: 'NOWHERE', to: 'CANCELLED', trigger: 'a trigger no row carries' })
		).toBe(false);
		// ...and says the opposite for a row that did, so the `false` above is a judgement and not a constant.
		// Selected by FROM-state, not by `to`: the first draft of this control took the first CANCELLED row it
		// found, which was the dropped `ANY_ACTIVE` one, and so asserted "landed" about the defect itself.
		const real = vocab.machines
			.find((m) => m.name === machine)
			?.transitions.find((t) => t.from === 'REQUESTED' && t.to === 'CANCELLED');
		expect(
			real,
			'the machine must still carry a cancel row for this control to mean anything'
		).toBeDefined();
		expect(landed(machine, real as VocabRow)).toBe(true);
	});

	it('CONTROL: no row claims to be unrepresentable while an edge of its own is in the machine', () => {
		// The exemption is per-row and in the data, so it cannot grow without someone writing a reason next to the
		// row. This is the other half: an exemption that stops being true must fail rather than quietly persist.
		const stale: string[] = [];
		for (const m of vocab.machines)
			for (const r of m.transitions ?? [])
				if (r.unrepresentable && landed(m.name, r)) stale.push(describeRow(m.name, r));
		expect(
			stale,
			'this row is marked "not an arrow" and the machine has an arrow for it — one of the two is now wrong'
		).toEqual([]);
	});
});
