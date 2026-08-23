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
	'ENFORCED_AT_PRESENTATION',
	'PARTIAL',
	'DIVERGENT',
	'UNENFORCED_OBSERVED_ADMISSION',
	'UNENFORCED_DEAD_PREDICATE',
	'UNENFORCED_NO_SHAPE'
] as const;

/**
 * ⚠ THE SECOND AXIS, SPLIT OUT OF THE FIRST BY THE V-4 MIGRATION (DESIGN §10).
 *
 * The ladder used to fuse two independent facts into one word: `PARTIAL_DIVERGENT_FILED` asserted that
 * enforcement is partial AND that the divergence is recorded, and `DIVERGENT_UNFILED` asserted the opposite of
 * the second half. Every other arm could say nothing about filing at all — so an unfiled divergence sitting on
 * an UNENFORCED arm was invisible to the one counter that was supposed to reach zero.
 *
 * The leak was not hypothetical. On the day the axes were split, the retired `DIVERGENT_UNFILED` arm counted
 * ZERO outstanding filings (all 49 of its rows had just been filed as REG-F-203..233 / REG-Q-053..057) while
 * **48 rows on other arms** had a filing status nobody had ever looked for.
 *
 * ⚠ AND `UNFILED` IS NOT THE DEFAULT, DELIBERATELY. `UNFILED` asserts that no filing exists, which is a claim
 * about a SEARCH — and this programme has now recorded, twice, what happens when such a claim is made without
 * one (EM-7: the search tool withholds the register's longest lines; six findings were "not filed" until
 * somebody looked again). Those 48 rows are `NOT_ESTABLISHED`: divergent enough to owe a filing, never
 * searched. It is the same refusal that kept STA-4:5 and DEC-6:3 between arms until the promotion path was
 * actually driven.
 */
const FILINGS = ['FILED', 'UNFILED', 'NEAR_MISS', 'NOT_APPLICABLE', 'NOT_ESTABLISHED'] as const;

/**
 * The two filing outcomes that mean **a search was run and nothing covering the limb was found**.
 *
 * ⚠ `NEAR_MISS` BELONGS HERE AND THAT IS NOT OBVIOUS FROM ITS NAME, which is why three assertions in this file
 * were keyed on `verdict === 'DIVERGENT'` instead and silently narrowed when the ladder split. It means *"a
 * filing exists and does NOT cover this limb"* — a statement that the limb is unfiled, with a decoy attached.
 * Whether the search turned up a decoy is a fact about the corpus, not about the debt.
 */
const OWES_A_FILING: ReadonlySet<string> = new Set(['UNFILED', 'NEAR_MISS']);

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

	// ── THE HOLE, CLOSED ────────────────────────────────────────────────────────────────────────────────────
	// ⚠ THIS ASSERTION SPENT NINE SLICES SAYING IT WAS *DELIBERATELY NOT* `toBe(307)`, and the reason was good:
	// a gate demanding totality on day one has to be either skipped or satisfied by guesses, and this repository
	// has REG-F-043 as the record of what a table satisfied by guesses does downstream. So it pinned the CURRENT
	// count and let the number move only when someone landed evidence.
	//
	// It is 307 now, and the count reached totality by being raised 10 times against committed evidence rather
	// than by being asserted once. That history is the claim; the number is only its residue.
	//
	// ⚠ AND TOTALITY HERE MEANS EXACTLY ONE THING: EVERY LIMB CARRIES A VERDICT. It does NOT mean every verdict
	// is right — 113 of these rows were OVERTURNED by a refuter, and 30 remain UNREFUTED and are labelled as
	// hypotheses in the data. It does NOT mean canon is enforced — 50 rows are live divergences with no filing
	// and 62 are admissions the engine was DRIVEN into accepting. A complete census of a partly-unenforced
	// system is a complete census, not a clean bill. Every one of those distinctions is pinned below, so no
	// later reader can collapse "307/307" into "done".
	it('every limb carries a verdict — the census is total', () => {
		const verdicted = new Set(verdicts.map((v) => String(v.limb_id)));
		expect(verdicted.size, 'limbs carrying a verdict').toBe(307);
		expect(
			limbs.map((l) => String(l.id)).filter((id) => !verdicted.has(id)),
			'a limb with no verdict — totality is now the standing condition, and losing it must redden'
		).toEqual([]);
	});

	// ── ⚠ THE HOLE INSIDE THE HOLE, AND IT WAS DUG BY THIS PROGRAMME'S OWN TOOLING ──────────────────────────
	// The count above is honest and still hides something. 21 invariants have never been touched and hold 114
	// limbs — but 137 limbs are unverdicted. The missing 23 belong to SEVEN invariants that are scored IN PART:
	// V-0's trial took the limbs it found interesting and left the rest, and every per-invariant view since has
	// reported those seven as done.
	//
	// ⚠ INCLUDING THE DRIVE QUEUE THAT SELECTED EVERY V-1 SLICE. Its "already verdicted" set was built as
	// `limb_id.split(':')[1]` — the INVARIANT segment of `limb:DEC-6:6` — so a single scored limb retired all of
	// its siblings from the queue. **The unit of this audit is a LIMB, and the instrument that chose its work was
	// keyed by INVARIANT.** That is §2's founding finding — the reason the row is a limb at all — reappearing one
	// level up, inside the tooling written to honour it. STA-4 is the exact invariant §2 uses to argue the limb
	// unit (limb 8 ENFORCED, limb 1 UNENFORCED), and STA-4 is on this list with FIVE limbs unscored.
	//
	// Pinned as a LIST rather than a count so the debt is nameable and shrinks visibly.
	it('invariants scored only IN PART are named, not averaged away', () => {
		const scored = new Set(verdicts.map((v) => String(v.limb_id)));
		const byInvariant = new Map<string, string[]>();
		for (const l of limbs) {
			const inv = String(l.invariant);
			byInvariant.set(inv, [...(byInvariant.get(inv) ?? []), String(l.id)]);
		}
		const partial: string[] = [];
		let orphanedLimbs = 0;
		for (const [inv, ids] of byInvariant) {
			const hit = ids.filter((id) => scored.has(id)).length;
			if (hit > 0 && hit < ids.length) {
				partial.push(inv);
				orphanedLimbs += ids.length - hit;
			}
		}
		// ⚠ PAID IN FULL, ONE COMMIT AFTER IT WAS FOUND — and the test STAYS, inverted, because the defect that
		// created it was structural rather than a one-off oversight. Any future slice that scores part of an
		// invariant and moves on reddens this immediately, instead of waiting for someone to notice that
		// "unverdicted" and "unqueued" had drifted apart again.
		// The 23 were scored with their already-verdicted siblings supplied as EVIDENCE, which made EM-1 — the
		// sibling error, normally a hypothesis a lane has to test — directly checkable against committed data.
		expect(partial.sort(), 'invariants with some limbs scored and some not').toEqual([]);
		expect(orphanedLimbs, 'limbs a per-invariant view reports as done').toBe(0);
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
			ENFORCED_DRIVEN: 29,
			ENFORCED_BY_CONSTRUCTION: 43,
			ENFORCED_MULTI_SITE: 20,
			ENFORCED_AT_SURFACE_ONLY: 2,
			ENFORCED_AT_PRESENTATION: 1,
			PARTIAL: 61,
			DIVERGENT: 49,
			UNENFORCED_OBSERVED_ADMISSION: 64,
			UNENFORCED_DEAD_PREDICATE: 12,
			UNENFORCED_NO_SHAPE: 26
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
		// ⚠ STA-6:3 IS PAID AND DEC-6:6 IS NOT, AND THE DIFFERENCE IS THE POINT. STA-6:3 owed its citation for a
		// MECHANICAL reason — nobody disputed the site; the row simply named it in prose and never in a field that
		// resolves. A debt pass re-drove the refusal AND its control, and the control settled more than the debt
		// asked: it ran under a RAW intent and was ACCEPTED, proving the guard is a SUPERSEDED-only equality test
		// and not the INTENT_AT_LEAST_PROVISIONAL readiness set. The anchor installed is byte-identical to
		// enforcement-register.ts:1568's `refusalMarker`, which is load-bearing at runtime (:3951 returns MASKED
		// when the observed message stops containing it), so a reword reddens a gate instead of orphaning this row.
		// DEC-6:6's debt was SUBSTANTIVE and is now also paid. Its cited site (pwu.ts:609) branches on
		// `contract.status !== 'SATISFIED'` and enforces JPWB-DOC-002 §8.1's PWU-lifecycle guard — a real guard for
		// a DIFFERENT sentence. The two gates COMPOSE, which is exactly why the wrong one looked right: pwu.ts will
		// not move the parent until the contract reads SATISFIED, and only `acceptRecomposition` can set that. The
		// correct site is decomposition.ts:783, and the state machine agrees rather than the debt pass merely
		// asserting it — transitions.data.ts declares the COMPOSABLE→SATISFIED arrow under the guard text
		// "a recomposed result requires an explicit assessment (§14.1)", and `acceptRecomposition` is the only
		// handler that performs that arrow.
		// ⚠ AND IT REFILLED ON THE VERY NEXT SLICE, WHICH IS THE ONLY PROOF THIS PIN IS ALIVE. It went to empty
		// when both original debts were paid, then `limb:PER-10:3` arrived owing one: its refuter reproduced the
		// drive exactly — the same five commands run twice in one store, changing ONLY the credential, with
		// AGENT PublishPwa REJECTED where HUMAN reached PUBLISHED — and still challenged the citation. A debt
		// list that only ever shrinks is a list nobody is feeding.
		// ⚠ PAID, AND BY RESTORING THE ORIGINAL CITATION RATHER THAN FINDING A NEW ONE. The refuter was RIGHT to
		// challenge (the arm was re-driven a third time and held: HUMAN PublishPwa ACCEPTED → PUBLISHED against
		// AGENT REJECTED) and WRONG about the replacement — command-bus `stampOrRefuse` is actor-type-blind by its
		// own control, and carries PER-3, not this limb. The correct site was pwa-authoring.ts:963 all along.
		// ⚠ AND A RECORDS DEFECT MADE THIS DEBT MORE EXPENSIVE THAN IT NEEDED TO BE: the row's
		// `refuter_correction` is TRUNCATED MID-SENTENCE, ending "This command declar", so the refuter's proposed
		// replacement site was never legible to the merge step that dropped the citation. A citation was dropped on
		// an argument nobody could finish reading — the same truncation shape that left OBJ-3:2 and OBJ-3:3
		// unrefuted for four slices.
		expect(owing).toEqual([]);
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
		const rows = verdicts.filter((v) => String(v.verdict) === 'DIVERGENT');
		for (const r of rows) {
			expect(String(r.owed ?? ''), `${String(r.limb_id)} must say what filing it owes`).not.toBe('');
		}
		// ⚠⚠ THE DEBT IS DISCHARGED, AND THE ARM'S NAME IS NOW WRONG — WHICH IS THE POINT.
		// All 49 are filed: REG-F-203..233 carry 41 of them and REG-Q-053..057 carry the other 8, whose remedy is
		// a canon adjudication rather than code. So the population that "must be zero at programme close" is zero
		// IN THE SENSE THAT MATTERS — no divergence goes unrecorded — while the ROW COUNT is unchanged, because
		// the enforcement fact did not change when the filing appeared.
		//
		// That is DESIGN §10's axis defect, no longer argued but demonstrated: `DIVERGENT_UNFILED` fuses an
		// ENFORCEMENT verdict with a FILING status, so a row that is divergent AND filed has nowhere to sit. The
		// ladder cannot say what is now true of these 49. The gate therefore counts the thing the arm was really
		// for — a divergence NOBODY HAS RECORDED — and that number is 0.
		// V-4's migration splits `verdict` from `filing`; this assertion is what it will replace.
		expect(rows.length, 'divergences found by the census').toBe(49);
		const unrecorded = rows.filter((v) => !v.filed_entry).map((v) => String(v.limb_id));
		expect(unrecorded, 'a divergence nothing records — THIS is the population that must be zero').toEqual([]);
	});

	// ── ⚠ THE ARM ASSERTS A FILING; THE ROW HAS TO NAME IT ──────────────────────────────────────────────────
	// PARTIAL_DIVERGENT_FILED makes TWO claims at once — enforcement is partial, AND the divergence is already
	// recorded somewhere. The second half is the one that lets a row REST: a filed divergence is somebody's
	// tracked debt, an unfiled one is this programme's. So a row on this arm naming no filing is the same defect
	// as an ENFORCED_DRIVEN row with no anchor — and unlike that one, it was unguarded until a records pass went
	// looking. Three rows assert a filing exists without naming it. All three were moved ONTO this arm by a V-0
	// refuter whose correction argued PARTIALITY and never mentioned a filing at all: the arm's two halves came
	// apart and only one of them was ever established.
	// ⚠ THEY ARE PINNED, NOT RECLASSIFIED. Moving them to DIVERGENT_UNFILED would assert that no filing exists —
	// a claim about a search nobody ran. The honest state is "not yet checked for a filing", which is what this
	// list says. It shrinks when someone looks, in either direction.
	//
	// ⚠⚠ AND THE VERY NEXT SLICE ADDED TWO MORE, WHICH RELOCATES THE DEFECT. When the list held three, all three
	// were V-0 refuter moves and this read as a one-off. The ASR slice added `limb:ASR-13:1` and `limb:ASR-17:3`
	// — BOTH MOVED ONTO THIS ARM BY REFUTERS, and both contradict the arm in their own text: ASR-13:1's `owed`
	// opens "A REG-F FINDING IS OWED IN TWO PARTS, NEITHER RECORDED ANYWHERE TODAY", and ASR-17:3's says "Nothing
	// owed against this limb" while its evidence argues both conjuncts hold by construction. Five of 33 rows now.
	// Lanes and refuters, independently prompted, both read `PARTIAL_DIVERGENT_FILED` as "partially enforced" and
	// drop the "and it is filed" half. That is not carelessness at either end — it is the ARM'S NAME carrying two
	// claims and only advertising one. The ladder needs the distinction split, which is a design act and is
	// recorded here rather than performed under a slice commit.
	it('PARTIAL_DIVERGENT_FILED rows name the filing they rest on, and the five that do not are counted', () => {
		const unnamed = verdicts
			.filter((v) => String(v.verdict) === 'PARTIAL')
			.filter((v) => String(v.filed_as ?? '') === '')
			.map((v) => String(v.limb_id));
		// ⚠ ELEVEN BECAME TWO, AND THE SEARCH SETTLED IT IN BOTH DIRECTIONS — which is what the list was pinned
		// FOR. Six were FILED all along and only the naming was missing (ASR-14:2 -> RPH-GOV-004, whose canonAnchor
		// is a byte-exact prefix of the limb; ASR-17:3 -> RPH-BAS-002, whose `guard.arrangement` IS the refuter's
		// own drive, so the refuter re-derived a filing that already existed; ASR-4:8, ASR-5:1, PER-9:5, AGG-1:2).
		// One is PARTLY filed (ASR-13:1). Three left the arm entirely: PER-11:1 to DIVERGENT_UNFILED, and both
		// AUT-1 rows back to the ENFORCED family, because their own `owed` fields open "NOT A DIVERGENCE" and the
		// search found nothing filed — so that arm was false on BOTH of its claims at once.
		// ⚠ THE TWO THAT REMAIN ARE A SHARPER STATE THAN THE LIST ORIGINALLY MEANT. It used to mean "not yet
		// checked for a filing". For these it now means: CHECKED, no filing exists (REG-F-042 quotes both limbs
		// verbatim but measures, fixes and closes only the recomposition half) — AND `DIVERGENT_UNFILED` is not
		// available either, because that arm asserts a LIVE violation and nobody has driven the promotion path
		// with a conditionally-satisfied subject. A DRIVE IS OWED BEFORE AN ARM CAN BE CHOSEN. Choosing either one
		// now would assert something nobody has measured.
		// ⚠ EMPTY, AND THE LAST TWO LEFT ON A DRIVE RATHER THAN A DECISION. STA-4:5 and DEC-6:3 were stuck between
		// arms because no filing covered the PROMOTION consequent and nobody had ever driven it. It has now been
		// driven: promotion IS gated, by PROMOTABLE_DISPOSITIONS at governance.ts:261, so DIVERGENT_UNFILED — which
		// asserts a live violation — would have been WRONG. Both rest on RPH-BAS-004, which records the mechanism;
		// what they still owe is the INSTANCE, and that is in `owed` rather than hidden by an empty field.
		expect(unnamed, 'an arm asserting a filing, on a row that names none').toEqual([]);
	});

	// ── ⚠ A REFUTER OVERTURNS A SCALAR; THE ROW IS A NARRATIVE ──────────────────────────────────────────────
	// The merge step replaces `verdict` and appends `refuter_correction`. EVERY OTHER FIELD — evidence, observed,
	// census, owed, filed_as — was authored by the LANE to support the arm the refuter just removed, and it stays
	// behind unmarked, still arguing the superseded case.
	// `limb:DEC-4:6` is the instance that forced this test, and it is the worst possible one: the arm now says the
	// engine ACCEPTS softening a MANDATORY security constraint to ADVISORY with no authority, while the row's own
	// `owed` field opens "FOUR THINGS, none of them a live hole in the prohibition" — written when the arm was
	// ENFORCED_BY_CONSTRUCTION. Its `observed` transcript likewise shows only the refusals the LANE provoked. A
	// reader who reads the row rather than the correction gets the opposite conclusion from the one the data holds.
	// ⚠ AND NO KEYWORD CHECK FINDS THIS. The obvious probe — does an admission transcript contain "ACCEPTED"? —
	// returns zero offenders here, because every transcript contains both words: the controls are in there too.
	// That probe is a control that cannot fail. The only thing that separates a live narrative from an orphaned
	// one is whether the arm MOVED, so that is what the row records.
	it('a row whose arm the refuter changed records the arm its narrative was written for', () => {
		// ⚠ THIS TEST ONCE ASSERTED "only an overturn moves an arm", AND THAT WAS WRONG — it was true when written
		// and falsified by the V-4c filing search. An arm moves for TWO reasons, and they are different kinds:
		// a REFUTER overturns the verdict on evidence the lane had, or a LATER PASS establishes a fact the refuter
		// did not have. `limb:PER-12:1` and `limb:REL-1:6` were both HELD by their refuters — correctly, on what
		// was visible — and then moved off DIVERGENT_UNFILED when an EM-7 re-search found them already filed in
		// `docs/_working/`, a corpus the original searches never opened. Requiring OVERTURNED would have forced a
		// false refutation label onto a row whose refuter was right.
		// So the invariant is the one that actually matters: a moved arm must carry a RECORDED REASON.
		const changed = verdicts.filter((v) => v.superseded_verdict !== undefined);
		for (const v of changed) {
			const overturned = String(v.refutation) === 'OVERTURNED';
			const explained = String(v.merge_note ?? '').length > 40 || String(v.filed_as ?? '').length > 40;
			expect(
				overturned || explained,
				`${String(v.limb_id)}: an arm moved with neither an overturn nor a recorded reason`
			).toBe(true);
			expect(String(v.superseded_verdict), `${String(v.limb_id)}`).not.toBe(String(v.verdict));
			expect(
				(ARMS as readonly string[]).includes(String(v.superseded_verdict)),
				`${String(v.limb_id)}: the superseded arm must itself be one of the nine`
			).toBe(true);
		}
		expect(changed.length, 'rows whose lane-authored narrative outlived the arm it argued').toBe(80);
	});

	// ── ⚠ GATE THE PROVENANCE, BECAUSE THE PROSE CANNOT BE GATED ───────────────────────────────────────────
	// `superseded_verdict` makes staleness VISIBLE. It does not make it RECONCILED — and `owed` is the field a
	// filing pass actually drafts from. A survey of all 55 DIVERGENT_UNFILED rows found FOURTEEN whose `owed`
	// describes a remedy for an arm the row no longer holds. A regex over denial-phrasings found seven of them.
	//
	// ⚠ AND NO CONTENT CHECK CAN FIND THE REST — that was established, not assumed. The decisive pair:
	// `limb:REL-1:11`'s owed says the divergence "is filed once, there" (DEFECTIVE — it is not) against
	// `limb:LYR-2:1`'s "THAT FILING IS ALREADY OWED BY limb:PER-6:3" (CORRECT). Identical shape, one word apart,
	// opposite verdicts — and the polarity is decidable only by reading a DIFFERENT ROW. Any denial-scan must
	// also swallow "nothing anywhere records it", which is the arm's own assertion in five CORRECT rows. Four of
	// the fourteen are grammatically indistinguishable from a correct `owed`; `REL-1:12`'s names a REG-F entry,
	// the canon document, the invariant, the limb, the conjunct and two file:line sites, and is defective only
	// because the site it names is not the site the refuter drove.
	//
	// So this gate never reads the prose. It records the arm each `owed` was authored FOR and asks whether anyone
	// re-authored the field after the arm moved. That is complete BY CONSTRUCTION rather than by pattern.
	it('every row records the arm its `owed` was authored for', () => {
		const missing = verdicts.filter((v) => !v.owed_for_verdict).map((v) => String(v.limb_id));
		expect(missing, 'fail closed: a row with no provenance is unreconciled, not exempt').toEqual([]);
		const bad = verdicts
			.filter((v) => !(ARMS as readonly string[]).includes(String(v.owed_for_verdict)))
			.map((v) => String(v.limb_id));
		expect(bad).toEqual([]);
	});

	// ⚠ THIS NUMBER IS A DEBT AND IT MUST REACH ZERO, alongside `DIVERGENT_UNFILED`. It is pinned rather than
	// asserted-away because 66 rows genuinely have not been re-read since their arm moved, and a gate that
	// demanded zero today would be satisfied by stamping the field rather than by doing the work — the exact
	// failure REG-F-043 records. It can only move DOWN without this reddening.
	it('the unreconciled-owed debt is counted, not hidden', () => {
		const stale = verdicts.filter((v) => String(v.owed_for_verdict) !== String(v.verdict));
		expect(stale.length, 'rows whose `owed` was written for an arm they no longer hold').toBe(37);
		// ⚠ THE SUBSET THAT BLOCKS THE CLOSE IS ZERO, AND THE FILTER THAT FINDS IT WAS WRONG FOR SIX COMMITS.
		// It read `verdict === 'DIVERGENT'`, which meant "every row that can owe a filing" before the ladder
		// split — filing was a suffix on two arms and unsayable everywhere else. After the split, `filing` is the
		// axis that says who owes a filing, and `DIVERGENT` names 49 of 229. Six NEAR_MISS rows sat in the gap:
		// stale, still owing a filing, and invisible to the assertion built to catch exactly that. They were
		// re-authored from a blind adjudication (2026-08-23) and the debt fell 43 -> 37.
		// The 37 that remain are all FILED or NOT_APPLICABLE: a stale `owed` there misleads a reader but cannot
		// misdirect a filing, because there is no filing left to misdirect.
		expect(
			stale.filter((v) => OWES_A_FILING.has(String(v.filing))).length,
			'the subset that blocks the close: these rows owe a filing and describe the wrong one'
		).toBe(0);
	});

	// The one part of the class that IS mechanically decidable, and it is decidable from the LADDER rather than
	// from wording: an `owed` written to accompany an ENFORCED_* verdict cannot state the filing owed by a live
	// divergence, because the two arms are mutually exclusive. Named individually so the list shrinks visibly.
	it('a live divergence whose owed was written for an ENFORCED arm is named', () => {
		const ENFORCED = new Set([
			'ENFORCED_BY_CONSTRUCTION',
			'ENFORCED_DRIVEN',
			'ENFORCED_MULTI_SITE',
			'ENFORCED_AT_SURFACE_ONLY',
			'ENFORCED_AT_PRESENTATION'
		]);
		// ⚠ RE-KEYED 2026-08-23 FROM `verdict === 'DIVERGENT'` TO THE FILING AXIS, and the re-keying is the
		// finding. As written this assertion reported 0 while SIX rows satisfied it in substance — `PER-3:2`,
		// `OBJ-3:2`, `DEC-4:2`, `DEC-4:6`, `ASR-19:3`, `ASR-9:5`, every one authored for an ENFORCED_* arm and
		// every one now holding an UNENFORCED_* arm. This is the SECOND predicate that picks that set out; the
		// first is the stale-owed filter above, keyed on different fields entirely, and they agree exactly.
		const bad = verdicts
			.filter((v) => OWES_A_FILING.has(String(v.filing)))
			.filter((v) => ENFORCED.has(String(v.owed_for_verdict)))
			.map((v) => String(v.limb_id));
		// Empty as of V-4b for the DIVERGENT population, and three of the four left by being RE-ARMED rather than
		// re-worded: ASR-10:5 was never a divergence (a CLOSED, test-pinned adjudication), while ASR-8:5 and
		// STA-2:3 were already filed. Empty for the GENERAL population as of the V-6 re-authoring.
		expect(bad.sort()).toEqual([]);
	});

	// ── ⚠ A FIELD THAT ASSERTED THE OPPOSITE OF ITS OWN ARM ─────────────────────────────────────────────────
	// DIVERGENT_UNFILED means NOTHING RECORDS THIS. Seven rows on that arm carried `filed_as` anyway — and the
	// content was good every time: each named a filing that EXISTS and does NOT cover this limb. That near miss is
	// worth more than silence, because the next reader who greps the register WILL find that filing, and without
	// this note they will close the row on it. The content stays; the name stops contradicting the arm.
	// ⚠ THIS TEST'S PREMISE WAS FALSIFIED BY THE PROGRAMME'S OWN PROGRESS, for the second time in this file.
	// It once read: a DIVERGENT_UNFILED row may carry NO `filed_as`, because the arm asserts nothing records the
	// divergence and the field would assert the opposite. That was right for eleven commits, and the filing pass
	// made it wrong — these rows now carry a REAL filing, in an entry written for them.
	// The INTENT survives and is what the assertion now checks: a NEAR MISS must not masquerade as a filing.
	// So `filed_as` is admissible here only when `filed_entry` names the register ordinal that carries this limb;
	// an adjacent filing that does not cover it still belongs in `near_miss_filing` and nowhere else.
	it('a DIVERGENT_UNFILED row cites a filing only when one was actually written for it', () => {
		const bad = verdicts
			.filter((v) => String(v.verdict) === 'DIVERGENT')
			.filter((v) => v.filed_as !== undefined && !v.filed_entry)
			.map((v) => String(v.limb_id));
		expect(bad, 'a near miss dressed as a filing — the field asserts what the arm denies').toEqual([]);
		expect(
			verdicts.filter((v) => v.near_miss_filing !== undefined).length,
			'filings that exist and do NOT cover their limb'
		).toBe(44);
	});

	// ── ⚠ THE ARM NOW CARRIES ITS OWN REMEDY, RE-SEARCHED UNDER EM-7 ───────────────────────────────────────
	// Every remaining live divergence has a DRAFTED FILING STATEMENT — what canon requires, what the code does
	// with a file:line, the driven arrangement, and the remedy — written so it can be pasted into REG-005 with an
	// ordinal on the front. The arm can only reach zero by those statements becoming entries, and a row that
	// loses its statement has lost the work, not just a field.
	//
	// ⚠ AND EVERY ONE OF THESE ABSENCES WAS RE-ESTABLISHED UNDER EM-7 (DESIGN §14) rather than inherited. The
	// original searches used a tool that reports `[Omitted long matching line]` on the longest register entries —
	// which are the most thoroughly reasoned ones. Re-searching by SITE as well as by id, with Bash grep and
	// `sed -n` on every long hit, moved THREE more rows off this arm: they had been filed all along. Two of the
	// three were in `docs/_working/`, the corpus an earlier search skipped entirely — which is now the source of
	// three of this programme's six already-filed discoveries.
	// ── ⚠ THE FILING IS RECONCILED AGAINST THE REGISTER, NOT TRUSTED TO MATCH IT ───────────────────────────
	// Each entry names the limb ids it closes, and each row names the entry it landed in, so the two artifacts
	// can be checked against each other by a reader who trusts neither. 41 rows filed as FINDINGS; 8 as
	// QUESTIONS, because their remedy is an adjudication and writing a guard for the reading the engine already
	// implements would ratify the narrower one by accident.
	//
	// ⚠ AND 45 OF THE 49 ROWS RECORD WHAT A TRUNCATION HAD HIDDEN FROM THEIR FIRST DRAFT. The entries were
	// written twice: once from a census whose evidence was silently cut at character caps, and once from the
	// restored text. 32 of 36 entries required amendment. The severed tails held second admissions at the same
	// site, halves of two-part remedies, an explicit "CITE, DO NOT RE-FILE" instruction, a ratified row carrying
	// the limb's own consequent, and — in one case — a correction that REVERSED a claim the draft made. That is
	// kept per row rather than summarised, because it is the measurement of what the cut cost.
	it('every filed divergence names its register entry, and every entry is accounted for', () => {
		const rows = verdicts.filter((v) => String(v.verdict) === 'DIVERGENT');
		const entries = new Set(rows.map((v) => String(v.filed_entry)));
		expect(entries.size, 'register entries carrying the W-3b filing').toBe(36);
		const findings = rows.filter((v) => String(v.filed_entry_kind) === 'FINDING').length;
		const questions = rows.filter((v) => String(v.filed_entry_kind) === 'QUESTION').length;
		expect({ findings, questions }).toEqual({ findings: 41, questions: 8 });
		const bad = rows
			.filter((v) => !/^REG-[FQ]-\d{3}$/.test(String(v.filed_entry)))
			.map((v) => String(v.limb_id));
		expect(bad, 'a filing that does not name a register ordinal').toEqual([]);
		expect(
			rows.filter((v) => v.filing_cut_hid).length,
			'rows whose entry was amended once the severed evidence was restored'
		).toBe(45);
	});

	it('every live divergence carries a drafted filing statement and its EM-7 search', () => {
		const rows = verdicts.filter((v) => String(v.verdict) === 'DIVERGENT');
		const noStatement = rows.filter((v) => String(v.filing_statement ?? '').length < 80).map((v) => String(v.limb_id));
		expect(noStatement, 'an unfiled divergence with no drafted remedy is a debt with no plan').toEqual([]);
		const noSearch = rows.filter((v) => String(v.em7_search ?? '').length < 40).map((v) => String(v.limb_id));
		expect(noSearch, 'the absence must be established by a recorded search, not asserted').toEqual([]);
	});

	// ── ⚠ THE FILING PARTITION, AND WHY ITS COUNT WAS SETTLED TWICE ────────────────────────────────────────
	// The 49 live divergences must become filed register findings, and filing 49 entries would be a defect if
	// they are fewer defects seen from more angles. Three GLOBAL readers clustered them under three lenses —
	// by MECHANISM (what is broken in the code), by REMEDY (what one commit closes), by SITE (what function it
	// lives at) — returning 28, 36 and 35. A synthesis reconciled them into 36.
	//
	// ⚠ AND THE FIRST SYNTHESIS RAN ON A TRUNCATED INPUT THAT I CAUSED. The three lens outputs were embedded
	// inline and capped at 60,000 characters; they total 141,583. Mechanism arrived whole, remedy was cut
	// mid-cluster, and THE SITE LENS NEVER ARRIVED — while the brief told that agent it was reconciling three.
	// It NOTICED, refused to "average two lenses and call it three", and rebuilt a substitute site signal from
	// file:line references in the rows themselves. Re-run against the full input from disk, the count came back
	// 36 again — but a DIFFERENT PARTITION: 27 clusters identical, six groupings changed, four ratification
	// flags flipped.
	//
	// ⚠⚠ THE PART WORTH KEEPING IS WHY THE SUBSTITUTE MISLED. Its three dissolved clusters were all labelled
	// ALL_THREE_AGREE — and all three are cases where the DERIVED site map co-located rows the REAL site lens
	// separates. A signal reconstructed from the evidence you already have CANNOT DISSENT FROM IT: it agrees by
	// construction, and it agrees in the same vocabulary, so it reads as corroboration. The disclosure was
	// honest and the instrument was still systematically optimistic.
	it('every live divergence belongs to exactly one filing cluster', () => {
		const rows = verdicts.filter((v) => String(v.verdict) === 'DIVERGENT');
		const unclustered = rows.filter((v) => !v.cluster_id).map((v) => String(v.limb_id));
		expect(unclustered, 'a divergence with no cluster would be filed alone or not at all').toEqual([]);
		const ids = new Set(rows.map((v) => String(v.cluster_id)));
		expect(ids.size, 'distinct filing clusters, settled against the COMPLETE three-lens input').toBe(36);
		// Cluster sizes must reconcile with membership — a row claiming a size its cluster does not have is a
		// partition that was edited in one place and not the other.
		const bySize: Record<string, number> = {};
		for (const v of rows) bySize[String(v.cluster_id)] = (bySize[String(v.cluster_id)] ?? 0) + 1;
		const wrong = rows
			.filter((v) => bySize[String(v.cluster_id)] !== Number(v.cluster_size))
			.map((v) => String(v.limb_id));
		expect(wrong, 'declared cluster size disagrees with actual membership').toEqual([]);
	});

	// The confidence split is pinned because it is the honest shape of the disagreement, and because the FIRST
	// synthesis used these same three words for a weaker instrument. 14 clusters had all three lenses produce
	// the exact set; 14 had two and a resolved dissent; 8 are CONTESTED — no two lenses agreed, or a dissent
	// carrying DRIVEN evidence was overridden. Eight rows sit in five RATIFICATION-FIRST clusters, where the
	// remedy is a canon question and writing code would ratify the narrower reading by accident.
	it('the filing clusters declare how much the lenses actually agreed', () => {
		const rows = verdicts.filter((v) => String(v.verdict) === 'DIVERGENT');
		const seen = new Map<string, string>();
		for (const v of rows) seen.set(String(v.cluster_id), String(v.cluster_confidence));
		const dist: Record<string, number> = {};
		for (const c of seen.values()) dist[c] = (dist[c] ?? 0) + 1;
		expect(dist).toEqual({ ALL_THREE_AGREE: 14, TWO_OF_THREE: 14, CONTESTED: 8 });
		expect(
			rows.filter((v) => v.cluster_ratification_first === true).length,
			'rows whose remedy is an adjudication, not code'
		).toBe(8);
	});

	// ── ⚠ NO EVIDENCE FIELD MAY BE A SLICE ─────────────────────────────────────────────────────────────────
	// Half this census was severed and nobody noticed for eleven commits. Every merge script written for this
	// programme passed agent output through a character cap — `[:3000]`, `[:2400]`, `[:1600]` — and committed
	// the result. The measurement when it was finally taken: 296 field values ending on a round number, 211 of
	// them mid-token, across 151 of 307 rows. `refuter_correction` — the field recording WHY a verdict was
	// overturned — was cut at exactly 2400 on 129 rows. `filing_statement`, the field V-4 drafts register
	// entries from, was cut at exactly 3000 on all 49. 679,997 characters were recovered from the journals,
	// where the agents' output had been intact all along: the loss happened on the way IN.
	//
	// ⚠ IT WAS FOUND BY THE AGENTS READING IT, NOT BY ANY GATE. Twenty-four of thirty-six drafters reported it
	// unprompted, several naming exactly what the cut removed — one row's `filing_statement` ended
	// "REMEDY: (i) …" with items (ii) onward severed; another was cut inside its own CONTROL transcript with the
	// verdict gone, so a reader could not tell what the control showed.
	//
	// THE SIGNATURE IS MECHANICAL AND THAT IS THE WHOLE POINT: a slice ends at a length several rows SHARE, and
	// it ends mid-token. A sentence ends on punctuation, and its length is its own. Both conditions together,
	// because either alone has false positives — three rows here legitimately share a length and all three end
	// on a full stop.
	it('no evidence field is a slice — shared exact length AND a mid-token ending', () => {
		const FIELDS = [
			'filing_statement', 'em7_search', 'observed', 'owed', 'evidence', 'census',
			'refuter_correction', 'owed_verified', 'owed_registry_search', 'filed_as', 'near_miss_filing'
		];
		const offenders: string[] = [];
		for (const f of FIELDS) {
			const byLen = new Map<number, string[]>();
			for (const v of verdicts) {
				const s = String(v[f] ?? '');
				if (s.length < 300) continue;
				byLen.set(s.length, [...(byLen.get(s.length) ?? []), String(v.limb_id)]);
			}
			for (const [len, ids] of byLen) {
				if (ids.length < 3) continue;
				const midToken = verdicts
					.filter((v) => ids.includes(String(v.limb_id)) && String(v[f] ?? '').length === len)
					.filter((v) => /[A-Za-z0-9]$/.test(String(v[f] ?? '')));
				if (midToken.length >= 3) offenders.push(`${f}@${len}: ${midToken.length} rows`);
			}
		}
		expect(offenders, 'a truncated evidence field is evidence that has been silently edited').toEqual([]);
	});

	// ── THE FILING AXIS ─────────────────────────────────────────────────────────────────────────────────────
	it('every row declares a filing status from the closed vocabulary', () => {
		const bad = verdicts
			.filter((v) => !(FILINGS as readonly string[]).includes(String(v.filing)))
			.map((v) => `${String(v.limb_id)} (${String(v.filing)})`);
		expect(bad, 'fail closed: a row with no filing status is unclassified, not exempt').toEqual([]);
	});

	// ⚠ `NOT_APPLICABLE` MEANS "NOTHING DIVERGENT TO FILE", so it is reachable ONLY from an ENFORCED arm. A
	// PARTIAL, DIVERGENT or UNENFORCED row has something to record BY DEFINITION; letting it claim
	// NOT_APPLICABLE would rebuild the exact hiding place the migration just removed.
	// ⚠ AND THE TWO EXCEPTIONS ARE THE SAME DEFECT AS §10, ONE ARM OVER. `UNENFORCED_NO_SHAPE` is doing double
	// duty and the V-5 pass said so in its own words: on most rows it means "canon requires X and the model has
	// no field for it" — a divergence, which owes a filing. On `limb:PER-11:2` and `limb:PER-12:2` it means "the
	// clause has no subject matter for a guard AT ALL" — a sentence stating a fact about the world rather than
	// forbidding an arrangement. Those two readings of one arm are what made this look like a 48-row divergence
	// population when two of the rows are not divergences.
	// They are PINNED BY NAME with a stated reason rather than waved through, and the arm needs splitting the
	// way PARTIAL_DIVERGENT_FILED did — recorded in DESIGN §16 rather than performed here, because re-cutting a
	// second arm one commit after the first would re-open rows nobody has re-read.
	it('NOT_APPLICABLE is reachable only from an ENFORCED arm, or the two named non-divergent clauses', () => {
		const EXCEPT = new Set(['limb:PER-11:2', 'limb:PER-12:2']);
		const bad = verdicts
			.filter((v) => String(v.filing) === 'NOT_APPLICABLE')
			.filter((v) => !String(v.verdict).startsWith('ENFORCED') && !EXCEPT.has(String(v.limb_id)))
			.map((v) => `${String(v.limb_id)} (${String(v.verdict)})`);
		expect(bad, 'a divergence cannot have nothing to file').toEqual([]);
		// An exception has to SAY why, or it is just a hole with a name on it.
		for (const id of EXCEPT) {
			const row = verdicts.find((v) => String(v.limb_id) === id);
			expect(String(row?.filing)).toBe('NOT_APPLICABLE');
			expect(String(row?.filing_note ?? '').length, `${id} must state why nothing is owed`).toBeGreaterThan(60);
		}
	});

	it('the filing axis is pinned, and the debt it exposed is counted', () => {
		const dist: Record<string, number> = {};
		for (const v of verdicts) dist[String(v.filing)] = (dist[String(v.filing)] ?? 0) + 1;
		// ⚠ 186/73 ON THE FIRST RUN, AND THIS GATE CORRECTED IT TO 183/76 BEFORE THE MIGRATION LANDED. Three
		// PER-1 rows carried `filed_as: "n/a — no divergence to file for this limb."` — the row DENYING that
		// anything is owed — and my migration read the field's mere PRESENCE as FILED. Presence of a field is not
		// its assertion. The three are NOT_APPLICABLE, which is what their own text says, and the misleading
		// field was retired rather than reworded so nothing later reads "n/a" as a citation.
		// ⚠ `NOT_ESTABLISHED` IS ZERO — the 48 rows the migration exposed have been searched under EM-7, and the
		// result is the reason the value existed. SEVEN were already FILED (14.6%, against measured base rates of
		// 13.6% and 5.8% on the two earlier populations). TWENTY-ONE are NEAR_MISS: a filing exists and does not
		// cover the limb, which is the note that stops the next reader closing the row on it. EIGHTEEN are
		// genuinely UNFILED and each owes a register entry. Two are not divergences at all.
		// Had these been defaulted to UNFILED at migration time, 30 of the 48 would have been wrong.
		// ⚠ `UNFILED` IS NOW ZERO TOO. The 18 are filed as REG-F-234..245 and REG-Q-058..062 (2026-08-23),
		// 190 -> 208. The 21 NEAR_MISS rows are NOT discharged by that and the next assertion is why.
		expect(dist).toEqual({ FILED: 208, NEAR_MISS: 21, NOT_APPLICABLE: 78 });

		// ⚠ THIS IS THE MIGRATION'S WHOLE RETURN, AND IT IS A NUMBER THE OLD LADDER COULD NOT PRODUCE. The
		// retired `DIVERGENT_UNFILED` arm read ZERO outstanding filings on the day of the split, because all 49
		// of its rows had just been filed. These 48 were sitting on UNENFORCED arms the entire time — 25 observed
		// admissions, 21 with no shape at all, 2 dead predicates — each one a limb where canon says something the
		// code does not do, and where nobody has ever checked whether that is recorded.
		expect(verdicts.filter((v) => String(v.filing) === 'NOT_ESTABLISHED').length, 'nothing unsearched').toBe(0);

		// UNFILED means SEARCHED, and nothing covers it. Its 18 rows — 11 observed admissions and 7 limbs with
		// no shape at all — are filed, and the arm is empty. It may not refill without this reddening.
		expect(verdicts.filter((v) => String(v.filing) === 'UNFILED').length, 'each owed an entry').toBe(0);
	});

	// ── ⚠ THE CLOSE CONDITION, IN ITS GENERAL FORM — AND UNFILED WAS THE SPECIAL CASE ─────────────────────
	// `ROADMAP-invariant-enforcement-mapping.md` sets the programme's close as *"`filing = UNFILED` must be zero
	// across ALL verdicts"*. That sentence is TRUE as of this commit and it DOES NOT CLOSE THE PROGRAMME.
	//
	// A row owes a register entry exactly when a search has been run and nothing COVERING the limb was found.
	// `UNFILED` is that outcome when the search returned nothing. `NEAR_MISS` is the SAME outcome when the search
	// returned something that does not cover it. Whether a decoy turned up is a fact about the corpus, not about
	// the debt — so the general form is `UNFILED ∪ NEAR_MISS`, and the roadmap's condition names half of it.
	//
	// ⚠ 16 OF THE 21 SAY SO IN THEIR OWN `owed`, VERBATIM: *"A FILING IS OWED AND NOTHING RECORDS IT TODAY"*
	// (ASR-11:3), *"A REG-F FINDING IS OWED"* (PER-12:4, PER-4:3). The five that DENY it are exactly the rows
	// whose `owed` was authored for a verdict a refuter overturned: every non-stale row affirms, every denial is
	// orphaned prose. Two independent predicates — "stale AND still owes a filing" and "owes a filing AND its
	// `owed` was written for an ENFORCED arm" — pick out the SAME SIX ROWS.
	//
	// ⚠ AND IT WAS CONFIRMED BLIND, WITH A WORKING NEGATIVE CONTROL. Eight rows went to eight agents with
	// `owed`, `filing` and `near_miss_filing` STRIPPED OUT and the controls unlabelled. The negative control
	// (`limb:STA-4:8`, ENFORCED_DRIVEN / NOT_APPLICABLE) returned OWES-NOTHING; the positive control returned
	// OWES-AN-ENTRY; all six orphaned rows returned OWES-AN-ENTRY, five at HIGH confidence, each finding the
	// stale narrative unprompted. The negative control returning `false` is what makes the six mean anything.
	//
	// THE DECOYS ARE THE POINT. `PER-3:2`'s nearest hit is REG-F-222, which says *"the chokepoint conjunct
	// HOLDS and is deliberately not filed"*; `DEC-4:6`'s is an enforcement-register row whose `canonAnchor` is
	// THIS LIMB QUOTED VERBATIM, concluding the opposite. A missing filing invites a search. A confident
	// adjacent entry ends one.
	// ── ⚠ THE V-6 FILING IS RECONCILED AGAINST THE REGISTER, NOT TRUSTED TO MATCH IT ──────────────────────
	// The 18 rows that were UNFILED are filed as **REG-F-234..245 and REG-Q-058..062** — 12 findings and 5
	// questions over 18 limbs. Each row names its entry; each entry names the limbs it closes. Read from the
	// REGISTER FILE, so a row claiming an ordinal that was never written reddens here rather than passing on the
	// strength of its own field.
	//
	// ⚠ EVERY ONE OF THE 17 WAS AMENDED BY ADVERSARIAL VERIFICATION — 10 of 10 drafting groups, matching the
	// 32-of-36 rate the previous filing pass measured. 829 citations were re-opened at HEAD by a verifier who
	// had not written them: 9 were DEAD POINTERS (a cited range whose far end lands inside the NEXT entry; a
	// line cited for a comment that begins one line later; an `organizationId` that is a `tenantId` at the line
	// given; a rule id attributed to its neighbour), and 42 more were MATERIAL. Three REFUTED the draft outright:
	// a function's sole caller was named wrongly, a command asserted to have "no caller" has three, and one
	// entry's own remedy contradicted its claim that the carrier was "unbuildable today".
	//
	// ⚠ AND ONE COUNT WAS STRUCK RATHER THAN REPRINTED. A draft reported "318 unique object shapes, 58 carrying
	// the field" from a recursive walk of the schema barrel. An independent re-walk of the SAME barrel with a
	// different traversal returned different totals, so the totals came out of the entry. A measurement that
	// does not reproduce under a second implementation is not a measurement, and printing it beside verified
	// facts is how REG-F-148's four defects were made.
	it('the 18 newly-filed limbs reconcile against entries that exist in the register', () => {
		const register = readFileSync(
			new URL('../docs/canon/JPWB-REG-005 Decision and Divergence Register.md', import.meta.url),
			'utf8'
		);
		const filed = verdicts.filter((v) => /^REG-[FQ]-(2[3-9]\d|0?5[89]|06[0-2])$/.test(String(v.filed_entry ?? '')));
		const v6 = verdicts.filter((v) => {
			const m = /^REG-([FQ])-(\d{3})$/.exec(String(v.filed_entry ?? ''));
			if (!m) return false;
			const n = Number(m[2]);
			return m[1] === 'F' ? n >= 234 : n >= 58;
		});
		expect(v6.length, 'limbs closed by the V-6 batch').toBe(18);
		expect(filed.length).toBeGreaterThanOrEqual(18);

		const ordinals = new Set(v6.map((v) => String(v.filed_entry)));
		expect(ordinals.size, 'distinct V-6 entries carrying a census limb').toBe(16);

		// ⚠ THE ENTRY MUST EXIST AS A HEADING, not merely be mentioned. A row naming an ordinal nobody wrote is
		// the exact shape this reconciliation exists to refuse — and it is what an EM-7 search would report as
		// "filed" from the row alone.
		const missing = [...ordinals].filter((o) => !register.includes(`### ${o} — `));
		expect(missing, 'a census row naming a register entry that was never written').toEqual([]);

		// The one entry with no census limb is REG-F-241, spun out of limb:ASR-1:6 because its drafter found a
		// second defect at the same site. It is counted here so 17 entries and 16 ordinals do not read as a
		// discrepancy: 16 carry limbs, one carries none and says so in its own reconciliation bullet.
		expect(register.includes('### REG-F-241 — '), 'the spun-out entry that closes no limb').toBe(true);

		// Every V-6 entry must declare which of the two series it is in, and the two must partition.
		const kinds: Record<string, number> = {};
		for (const v of v6) kinds[String(v.filed_entry_kind)] = (kinds[String(v.filed_entry_kind)] ?? 0) + 1;
		expect(kinds).toEqual({ FINDING: 13, QUESTION: 5 });
	});

	it('the filing debt is counted in its general form, not just as UNFILED', () => {
		const owes = verdicts.filter((v) => OWES_A_FILING.has(String(v.filing)));
		expect(owes.length, 'limbs searched for, with no covering filing found').toBe(21);
		// A debt with no plan is not a debt anybody can pay. ⚠ THE THRESHOLD IS 40, NOT 80, AND THE LOWER NUMBER
		// IS THE HONEST ONE: `limb:ASR-14:3`'s entire `owed` is the 70-character sentence "a register finding:
		// waiver expiry unenforced on the authorization path", which names the finding AND the defect and is
		// complete. Length was never the property being tested.
		expect(
			owes.filter((v) => String(v.owed ?? '').length < 40).map((v) => String(v.limb_id)),
			'a row that owes a filing must state which'
		).toEqual([]);
	});

	it('a FILED row names its filing; a NEAR_MISS names the filing that misses', () => {
		// ⚠ A LENGTH THRESHOLD WAS THE WRONG TEST AND IT FAILED HONESTLY ON `limb:DEC-6:4`, whose `filed_as` is
		// the nine characters "REG-F-042" — a complete and precise citation. What FILED owes is a NAMEABLE
		// REFERENCE, not a word count: a register ordinal, or a path to the artifact that carries it.
		const NAMES = /REG-[FQDE]-\d{3}|RPH-[A-Z]{3}-\d{3}|\.(ts|md|json)/;
		const filedNoName = verdicts
			.filter((v) => String(v.filing) === 'FILED')
			.filter((v) => !v.filed_entry && !NAMES.test(String(v.filed_as ?? '')))
			.map((v) => String(v.limb_id));
		expect(filedNoName, 'FILED asserts a filing exists — it has to say WHICH').toEqual([]);
		const nearNoName = verdicts
			.filter((v) => String(v.filing) === 'NEAR_MISS')
			.filter((v) => String(v.near_miss_filing ?? '').length < 20)
			.map((v) => String(v.limb_id));
		expect(nearNoName).toEqual([]);
	});

	// ⚠ THE ARM THIS MIGRATION ADDED, AND THE ROW THAT PROVED IT WAS MISSING. `limb:ASR-9:8` forbids a DISPLAY —
	// "conditional satisfaction is never displayed as unconditional success" — so the presentation layer is the
	// CORRECT locus for it, not a deficiency. The old ladder's nearest arm, ENFORCED_AT_SURFACE_ONLY, is a
	// FINDING every time it is used, and filing one against a properly enforced rule would have been an
	// overstatement of exactly the kind REG-F-043 records. The row sat on ENFORCED_BY_CONSTRUCTION as a stated
	// interim for four commits while the gap was recorded and deferred.
	it('ENFORCED_AT_PRESENTATION carries the display limb, and SURFACE_ONLY stays a finding', () => {
		const pres = verdicts.filter((v) => String(v.verdict) === 'ENFORCED_AT_PRESENTATION');
		expect(pres.map((v) => String(v.limb_id))).toEqual(['limb:ASR-9:8']);
		expect(String(pres[0]?.verdict_before_migration)).toBe('ENFORCED_BY_CONSTRUCTION');
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
		// ⚠ THE ARM WAS EMPTY FOR FIVE SLICES AND NOW HAS EXACTLY ONE OCCUPANT, WHICH IS THE VINDICATION OF
		// DECLARING IT. The trial filed ASR-15:9 here; a refuter overturned it, because the cited route action
		// gates ProposeDecision — which mints a PROPOSED decision — while limb 9 speaks of an APPROVAL, which in
		// this engine requires status EFFECTIVE. So the arm sat at zero, held open only by the argument that the
		// SHAPE was real. `limb:PER-12:5` is the shape, and it is the worst possible subject to find it on.
		//
		// PER-12 is SPONSOR-RULED (REG-D-015). Limb 5 says a model's reasoning trace in an evaluator's context IS
		// a hidden-context independence violation. DRIVEN: the CoT trace was submitted as evidence, the assessment
		// was begun and completed with that trace in `evidenceConsidered`, all ACCEPTED, terminal state SATISFIED
		// — and NO AssuranceIndependenceViolated event was emitted. The engine does not treat it as a violation.
		// The only thing that keeps a reasoning trace away from a reviewer is `narrationOf` at
		// apps/rph-demo/src/lib/server/agent/transcript.ts:36, filtering to role === 'AGENT' && kind === 'message'
		// so a `thinking` entry cannot reach the evaluator — real, lock-tested, and entirely above the seam.
		//
		// Had this arm not existed, the row would have scored ENFORCED on a genuine, cited, tested fix, and a
		// sponsor ruling would have been reported as held by a filter the engine has never heard of.
		expect(rows).toHaveLength(2);
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
		// ⚠ THE OVERTURN RATE ACROSS THE THREE V-1 SLICES, MEASURED RATHER THAN HOPED: STA 3/12 = 25%, OBJ/REL
		// 5/19 = 26%, DEC/LYR 8/29 = 28%. Against V-0's 11/14 = 79%. The difference is not that the later lanes
		// were better staffed — it is that their prompts carried the MEASURED error modes WITH INSTANCES (the
		// sibling limb; the census whose positive control returned zero; the pattern blind to shorthand writes).
		// The rate has now been flat for three slices, which is the evidence that it is a property of the METHOD
		// and not of the families audited.
		// ⚠ `UNREFUTED` IS GONE — not suppressed, EMPTIED. It stood at 30 for six slices, and every one of those
		// rows is now HELD or OVERTURNED. The label existed because REG-F-202 is the recorded case of this exact
		// workflow's refuter half silently failing to launch, with the synthesis then producing a confident,
		// well-cited sweep under ZERO adversarial pressure. Rather than assert the stage ran, the rows that had
		// not faced one said so IN THE DATA until they had.
		// ⚠ AND THE DEBT WAS WORTH PAYING AT EXACTLY THE RATE PREDICTED: those 30 rows came back 15 HELD / 15
		// OVERTURNED — a 50% overturn rate, the highest of any slice in the programme, against a measured band of
		// 25–48% and V-0's 79%. Fifteen wrong verdicts were sitting in a census that already read as complete.
		// The vocabulary keeps UNREFUTED so a future row can be honest again; nothing occupies it today.
		expect(tally).toEqual({ HELD: 179, OVERTURNED: 128 });
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
		expect(new Set(verdicts.map((v) => String(v.method)))).toEqual(
			new Set([
				'w3b-lane:v0-trial',
				'w3b-lane:v1-sta',
				'w3b-lane:v1-objrel',
				'w3b-lane:v1-declyr',
				'w3b-lane:v1-asr',
				'w3b-lane:v1-perrel',
				'w3b-lane:v1-orphans',
				'w3b-lane:v2-a',
				'w3b-lane:v2-b',
				'w3b-lane:v2-c'
			])
		);
	});
});
