// W-3b V-0 — THE INVARIANT ENFORCEMENT CENSUS, AND THE GATE THAT MAKES ITS HOLE NON-SILENT.
//
// ── THE HOLE THIS EXISTS TO COUNT ────────────────────────────────────────────────────────────────────────────
// The tracker holds 192 `cap:invariant:*` items and, until this file, ZERO verdicts over any of them — while
// every other capability sub-kind is 100% verdicted (cap:rule 125/125, cap:command 105/105, cap:event 96/96,
// cap:machine 27/27, cap:query 14/14, cap:policy 12/12, cap:surface 8/8). The gap is DECLARED, not accidental;
// `scripts/tracker/measure.ts` says so at its own site: *"⚠ What this deliberately does NOT measure: the 192
// invariants (prose→code mapping is judgment work — a lane-and-refuter program, not a grep) … Absence of a
// verdict here is the honest state."*
//
// **And nothing gated it.** `grep -rn 'cap:invariant' verif/` returned ZERO before this file (positive control
// on the same directory: the word "invariant" appears in verif/ four times, so the zero was verif/'s and not
// the grep's). A declared hole with no counter is how a hole outlives the reason for it.
//
// ── ⚠ WHY THE GATE LANDS BEFORE THE AUDIT, WHICH IS NOT THE OBVIOUS ORDER ────────────────────────────────────
// The natural order is "map the invariants, then build something to hold the mapping". It is backwards here and
// the reason is measured. The audit is 65-80 hours; REG-F-043 is the record of this repository shipping exactly
// such a table one instrument over — 152 guard rows, rendered under an honest "not evaluated" label — and then
// having three passes of its own programme READ IT AS ENFORCEMENT anyway. Its sentence is the one to keep:
// *"A declaration and its enforcement that no artifact connects are two facts, not one guarantee."* A table that
// lands as prose can rot from the day it lands. So the counter exists first, and every wave is a data commit
// against a running gate.
//
// ── ⚠ AND THE TWO HALVES ARE AUTHORED SEPARATELY, SO THIS GATE CAN ACTUALLY FAIL ─────────────────────────────
// `DESIGN-declare-the-spine.md` records the trap by name: deriving a population from its own complement makes
// the gate UNFALSIFIABLE — *"a control that cannot fail — authored, again, inside a fix"*. The obvious design
// here is one instrument that derives the 62 ids AND the enforcement sites and joins them; its coverage claim
// would then be true BY CONSTRUCTION.
// So: the ROSTER is mechanically derived and committed (`w2-doc-capabilities.ndjson`, W-2, authored by a
// different programme); the LIMB SPLIT is mechanically derived by a stated rule (`w3b-limbs.ndjson`); the
// VERDICTS are authored BY HAND with evidence (`w3b-invariant-verdicts.ndjson`). This file compares three
// independently-produced artifacts. **The join can be empty, and on the day it landed it very nearly was.**
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CENSUS = new URL('../docs/tracking/census/', import.meta.url);
const W3B = new URL('../docs/tracking/w3b/', import.meta.url);

function readNdjson(name: string, base: URL = CENSUS): Record<string, unknown>[] {
	return readFileSync(new URL(name, base), 'utf8')
		.split('\n')
		.filter((l) => l.trim().length > 0)
		.map((l) => JSON.parse(l) as Record<string, unknown>);
}

const roster = readNdjson('w2-doc-capabilities.ndjson').filter((r) =>
	String(r.id ?? '').startsWith('cap:invariant:')
);
const canon = roster.filter((r) => String(r.id).startsWith('cap:invariant:inv-canon-'));
const limbs = readNdjson('limbs.ndjson', W3B);
const verdicts = readNdjson('invariant-verdicts.ndjson', W3B);

/**
 * The nine arms, and the vocabulary is CLOSED so a lane cannot invent a softer word for an uncomfortable row.
 *
 * ⚠ THE THREE-WAY REGISTER ARM WAS TRIED FIRST AND IS INSUFFICIENT, which is why this list is longer rather than
 * borrowed. `ENFORCED / UNENFORCED_DISCLOSED / NOT_A_COMMAND_REFUSAL` was built for 112 ratified CONFORMANCE
 * RULES already shaped as command refusals. The canon 62 are semantic law, and the trial run hit three things
 * none of those three arms can say:
 *   · ASR-15's subject limb is refused at a route action and NOWHERE on the write path — driven:
 *     `ProposeDecision` with `subjectObjectIds: []` was ACCEPTED. ENFORCED is false, UNENFORCED_DISCLOSED is
 *     false, NOT_A_COMMAND_REFUSAL is false. Hence `ENFORCED_AT_SURFACE_ONLY`, which is a FINDING every time it
 *     is used and never a resting state.
 *   · PER-3 and AGG-1 hold because the illegal act is INEXPRESSIBLE — there is no refusal and there could not
 *     be one. Filing them beside "states an outcome that does not exist" would be a different fact with a
 *     different remedy. Hence `ENFORCED_BY_CONSTRUCTION`, which must record whether its census is GATED,
 *     because "true but unguarded" is not the same claim as "enforced".
 *   · AGG-1 has a shipped violation recorded only in a working design document. Hence `DIVERGENT_UNFILED`,
 *     whose population must be ZERO at programme close.
 */
const ARMS = [
	'ENFORCED_DRIVEN',
	'ENFORCED_BY_CONSTRUCTION',
	'ENFORCED_MULTI_SITE',
	'ENFORCED_AT_SURFACE_ONLY',
	'PARTIAL_DIVERGENT_FILED',
	'DIVERGENT_UNFILED',
	'UNENFORCED_OBSERVED_ADMISSION',
	'UNENFORCED_DEAD_PREDICATE',
	'UNENFORCED_NO_SHAPE'
] as const;

/** Arms whose evidence is a REFUSAL OBSERVED THROUGH `Engine.dispatch`, not a reading. */
const DRIVEN_ARMS = new Set(['ENFORCED_DRIVEN', 'UNENFORCED_OBSERVED_ADMISSION']);

const REPO = new URL('../', import.meta.url);

describe('W-3b — the invariant enforcement census', () => {
	// ── THE POPULATION, PINNED FROM THE COMMITTED ROSTER ─────────────────────────────────────────────────────
	it('the roster holds 192 invariants, 62 of them canon', () => {
		expect(roster.length, 'cap:invariant items in the W-2 census').toBe(192);
		expect(canon.length, 'the canon JPWB-DOC-003 slice').toBe(62);
	});

	it('every canon invariant is anchored to JPWB-DOC-003 and nothing else is', () => {
		const docs = new Set(canon.map((r) => String(r.anchor_doc)));
		expect([...docs]).toEqual(['docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md']);
	});

	// ── THE LIMB SPLIT ──────────────────────────────────────────────────────────────────────────────────────
	// 307 is what THIS rule produces. A different reasonable rule produces a different number — the trial run's
	// gave 316 — and REG-F-113 records why neither is wrong: *"prose about a status is not a status"*, two
	// regexes over one file at one moment returning 22 and 50. The rule is the artifact; the count is pinned so
	// that changing the rule is a visible act rather than a silent re-partition under standing verdicts.
	it('the limb split is 307 limbs over the 62, by rule w3b-limb-split/1.0.0', () => {
		expect(limbs.length, 'limbs derived').toBe(307);
		expect(new Set(limbs.map((l) => String(l.invariant))).size, 'invariants covered').toBe(62);
		expect(new Set(limbs.map((l) => String(l.rule)))).toEqual(new Set(['w3b-limb-split/1.0.0']));
	});

	it('every limb hangs off a roster id that exists — the two artifacts JOIN', () => {
		const ids = new Set(roster.map((r) => String(r.id)));
		const orphans = limbs.map((l) => String(l.item_id)).filter((id) => !ids.has(id));
		expect([...new Set(orphans)], 'limbs naming an invariant the roster does not hold').toEqual([]);
	});

	// ── THE HOLE, COUNTED ───────────────────────────────────────────────────────────────────────────────────
	// ⚠ THIS ASSERTION IS THE POINT OF THE FILE AND IT IS DELIBERATELY NOT `toBe(307)`. The honest state today is
	// that most limbs are unverdicted, and a gate that demanded totality on day one would have to be either
	// skipped or satisfied by guesses. It pins the CURRENT verdicted count, so the number moves only when
	// someone lands evidence — and it can never move DOWN without this reddening.
	it('the verdicted count is pinned, so the hole cannot quietly change size', () => {
		const verdicted = new Set(verdicts.map((v) => String(v.limb_id)));
		expect(verdicted.size, 'limbs carrying a verdict').toBe(23);
		expect(
			307 - verdicted.size,
			'limbs still unverdicted — this is the OPEN half of W-3b and it is meant to be large'
		).toBe(284);
	});

	it('every verdict names a limb that exists, exactly once', () => {
		const known = new Set(limbs.map((l) => String(l.id)));
		expect(verdicts.map((v) => String(v.limb_id)).filter((id) => !known.has(id))).toEqual([]);
		const seen = new Map<string, number>();
		for (const v of verdicts) {
			const id = String(v.limb_id);
			seen.set(id, (seen.get(id) ?? 0) + 1);
		}
		expect([...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
	});

	it('every verdict uses one of the nine declared arms', () => {
		const bad = verdicts
			.map((v) => String(v.verdict))
			.filter((v) => !(ARMS as readonly string[]).includes(v));
		expect([...new Set(bad)], 'a verdict outside the closed vocabulary').toEqual([]);
	});

	// ── THE DISTRIBUTION — the pin a flipped verdict has to move ─────────────────────────────────────────────
	it('the per-arm distribution is pinned', () => {
		const dist: Record<string, number> = {};
		for (const v of verdicts) dist[String(v.verdict)] = (dist[String(v.verdict)] ?? 0) + 1;
		expect(dist).toEqual({
			ENFORCED_DRIVEN: 3,
			ENFORCED_BY_CONSTRUCTION: 5,
			ENFORCED_MULTI_SITE: 3,
			PARTIAL_DIVERGENT_FILED: 5,
			DIVERGENT_UNFILED: 4,
			UNENFORCED_OBSERVED_ADMISSION: 1,
			UNENFORCED_NO_SHAPE: 2
		});
	});

	// ── THE EVIDENCE DISCIPLINE ─────────────────────────────────────────────────────────────────────────────
	// The founding defect of this whole family, kept in the gate rather than in a comment: RPH-PWU-010's ratified
	// statement is "a BASELINED PWU cannot resume execution", and it was certified COVERED by a call to a pure
	// function that had, repo-wide, exactly TWO references — its own definition and that test. Ratified,
	// certified, enforced nowhere. So a driven arm needs a driven citation.
	it('every driven-arm verdict cites an executed dispatch, not a reading', () => {
		const bad = verdicts
			.filter((v) => DRIVEN_ARMS.has(String(v.verdict)))
			.filter((v) => String(v.confidence) !== 'DROVE_THE_ENGINE')
			.map((v) => `${String(v.limb_id)} (${String(v.verdict)}, ${String(v.confidence)})`);
		expect(
			bad,
			'ENFORCED_DRIVEN and UNENFORCED_OBSERVED_ADMISSION are admissible ONLY from an executed dispatch'
		).toEqual([]);
	});

	it('every driven-arm verdict records the observed result', () => {
		const bad = verdicts
			.filter((v) => DRIVEN_ARMS.has(String(v.verdict)))
			.filter((v) => String(v.observed ?? '').length < 20)
			.map((v) => String(v.limb_id));
		expect(bad, 'a driven verdict must record WHAT the engine did').toEqual([]);
	});

	// ⚠ THE ANCHOR CHECK — the C-0b mechanism, and it is here because REG-F-081 added it to that ledger after SIX
	// enforcing sites had rotted into doc comments in two days. An anchor that resolves twice is ambiguous; one
	// that resolves zero times is a citation to code that has moved. Both are silent without this.
	// ⚠ A ROW WHOSE CITATION A REFUTER BROKE HAS ITS SITE REMOVED, NOT REPLACED WITH A GUESS, and it carries
	// `recitation_owed: true`. That debt is COUNTED below rather than hidden: an ENFORCED_DRIVEN verdict with no
	// verified site is a standing hole, and the one way to make it worse is to let it look like a citation.
	it('the ENFORCED_DRIVEN rows owing a re-citation are counted, not hidden', () => {
		const owing = verdicts
			.filter((v) => String(v.verdict) === 'ENFORCED_DRIVEN' && !v.enforcing_anchor)
			.map((v) => String(v.limb_id));
		expect(owing).toEqual(['limb:DEC-6:6']);
	});

	it('every ENFORCED_DRIVEN anchor that EXISTS resolves EXACTLY ONCE in the file it cites', () => {
		const broken: string[] = [];
		for (const v of verdicts) {
			if (String(v.verdict) !== 'ENFORCED_DRIVEN') continue;
			const site = String(v.enforcing_site ?? '');
			const anchor = String(v.enforcing_anchor ?? '');
			if (site.length === 0 && anchor.length === 0) continue; // counted by the test above
			const path = site.split(':')[0] ?? '';
			if (path.length === 0 || anchor.length === 0) {
				broken.push(`${String(v.limb_id)} [missing site or anchor]`);
				continue;
			}
			let body: string;
			try {
				body = readFileSync(new URL(path, REPO), 'utf8');
			} catch {
				broken.push(`${String(v.limb_id)} [cannot read ${path}]`);
				continue;
			}
			const n = body.split(anchor).length - 1;
			if (n !== 1) broken.push(`${String(v.limb_id)} [anchor occurs ${n}x in ${path}]`);
		}
		expect(broken).toEqual([]);
	});

	// ── THE ARMS THAT ARE FINDINGS, NOT RESTING STATES ──────────────────────────────────────────────────────
	it('DIVERGENT_UNFILED rows name the register entry owed — the arm must reach zero at close', () => {
		const rows = verdicts.filter((v) => String(v.verdict) === 'DIVERGENT_UNFILED');
		for (const r of rows) {
			expect(String(r.owed ?? ''), `${String(r.limb_id)} must say what filing it owes`).not.toBe('');
		}
		expect(rows.length, 'live violations with no filed finding — a standing debt, not a status').toBe(4);
	});

	it('ENFORCED_BY_CONSTRUCTION rows say whether their census is GATED', () => {
		const bad = verdicts
			.filter((v) => String(v.verdict) === 'ENFORCED_BY_CONSTRUCTION')
			.filter((v) => typeof v.census_gated !== 'boolean')
			.map((v) => String(v.limb_id));
		expect(bad, '"true but unguarded" is a different claim from "enforced"').toEqual([]);
	});

	it('ENFORCED_AT_SURFACE_ONLY rows carry the driven proof that the ENGINE admits it', () => {
		const rows = verdicts.filter((v) => String(v.verdict) === 'ENFORCED_AT_SURFACE_ONLY');
		for (const r of rows) {
			expect(String(r.confidence), `${String(r.limb_id)}`).toBe('DROVE_THE_ENGINE');
			expect(
				String(r.observed ?? ''),
				`${String(r.limb_id)}: a surface-only claim is only meaningful if the engine was shown to accept`
			).toContain('ACCEPTED');
		}
		// ⚠ ZERO TODAY, AND THE ZERO IS A RESULT RATHER THAN AN ABSENCE. The trial filed ASR-15:9 under this arm;
		// a refuter overturned it, because the cited route action gates ProposeDecision — which mints a PROPOSED
		// decision — while limb 9 speaks of an APPROVAL, which in this engine requires status EFFECTIVE. The arm
		// stays declared because the SHAPE is real and was measured; nothing currently occupies it.
		expect(rows.length).toBe(0);
	});

	// ── ⚠ THE REFUTATION LEDGER, BECAUSE REG-F-202 IS THREE WEEKS OLD ───────────────────────────────────────
	// REG-F-202 is the recorded case of THIS EXACT lanes-plus-refuters workflow's refuter half silently failing
	// to launch, with the synthesis then producing a confident, well-cited sweep under ZERO adversarial
	// pressure. Over 62 invariants that would be 62 unrefuted hypotheses shipped as findings. A refutation
	// stage that cannot prove it ran did not run — so every row states its status, and the unrefuted ones are
	// labelled hypotheses IN THE DATA rather than in a paragraph someone may not read.
	it('every verdict declares whether it was adversarially refuted', () => {
		const bad = verdicts
			.filter((v) => !['HELD', 'OVERTURNED', 'UNREFUTED'].includes(String(v.refutation ?? '')))
			.map((v) => String(v.limb_id));
		expect(bad, 'each row is HELD, OVERTURNED, or explicitly UNREFUTED (a hypothesis)').toEqual([]);
	});

	// ⚠⚠ 11 OF 14 OVERTURNED — 79%, AGAINST REG-F-197's 36%, AND THIS IS THE HEADLINE MEASUREMENT OF V-0.
	// Every refuter launched (14) returned (14), which is itself asserted because REG-F-202 is the recorded case
	// of this exact stage silently not running. Nearly every overturn had ONE shape: **the cited site refuses a
	// SIBLING LIMB of the same sentence** — the mechanism the design predicted and sized the method around. The
	// overturns are not demolition: several corrected an ENFORCED row to a DIFFERENT enforced arm, and one
	// corrected an UNENFORCED row to DIVERGENT_UNFILED because the limb IS enforced on a plane the trial never
	// tested. **This number is the argument for the whole method.** A single-pass audit over 62 invariants
	// without this stage would have shipped ~4 in 5 rows wrong.
	it('the refutation tally is pinned, so an unrun refuter stage cannot read as a run one', () => {
		const tally: Record<string, number> = {};
		for (const v of verdicts) tally[String(v.refutation)] = (tally[String(v.refutation)] ?? 0) + 1;
		expect(tally).toEqual({ HELD: 3, OVERTURNED: 11, UNREFUTED: 9 });
	});

	it('every OVERTURNED row records what the refuter found', () => {
		const bad = verdicts
			.filter((v) => String(v.refutation) === 'OVERTURNED')
			.filter((v) => String(v.refuter_correction ?? '').length < 40)
			.map((v) => String(v.limb_id));
		expect(bad, 'an overturn without its reason is a verdict change with no evidence').toEqual([]);
	});

	// ── CONTROL — the population is REAL ────────────────────────────────────────────────────────────────────
	// Every assertion above is satisfied by empty files: no roster, no limbs, no verdicts, green. That is the
	// vacuity this repository has recorded repeatedly, so it is refused explicitly here.
	it('CONTROL — the three artifacts are non-empty and were authored separately', () => {
		expect(roster.length).toBeGreaterThan(100);
		expect(limbs.length).toBeGreaterThan(100);
		expect(verdicts.length).toBeGreaterThan(0);
		// The roster is W-2's, the limbs are derived by rule, the verdicts are hand-authored: three origins.
		expect(new Set(roster.map((r) => String(r.origin)))).toEqual(new Set(['census:w2-doc-extraction']));
		expect(new Set(limbs.map((l) => String(l.rule)))).toEqual(new Set(['w3b-limb-split/1.0.0']));
		expect(new Set(verdicts.map((v) => String(v.method)))).toEqual(new Set(['w3b-lane:v0-trial']));
	});
});
