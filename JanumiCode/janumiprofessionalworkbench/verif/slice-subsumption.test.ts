// JAN-SLICE-SWP-04 — the subsumption gate: no working artifact may claim an item the Slice ledger now derives.
//
// ── WHY THIS GATE EXISTS, IN THE DESIGN'S OWN WORDS ──────────────────────────────────────────────────────────
// `SL-L4`, verbatim: *"JAN-SLICE MUST retire what it replaces. On each Slice's admission, every superseded
// roadmap or residual claim it covers MUST be struck in place — `~~old~~ **new**`, per the register's
// retire-by-striking idiom — and MUST NOT be deleted. **A JAN-SLICE that leaves the nineteen working roadmaps
// standing has become the twentieth**, and the programme SHALL be judged failed on that ground alone regardless
// of its test count."*
//
// The roadmap's own risk register (R-1) says the same thing about this work package specifically: it *"has no
// test forcing it and no feature to show"*, so it *"is the work package that will be skipped"* unless gated.
// This file is that gate. It exists because the obligation cannot enforce itself.
//
// ── WHAT COUNTS AS A SUPERSEDED CLAIM, STATED AS A PREDICATE RATHER THAN A JUDGEMENT ─────────────────────────
// A census artifact makes a LIVE claim about a ratified `RPH-E2E` rule when a line names that rule and is not
// struck. After `SWP-03` every one of those rules is asserted by a Slice, so any surviving hand-authored
// disposition of them is a second, unchecked answer to a question the ledger now derives — and the two can
// disagree with nothing to notice.
//
// ⚠ MENTIONING A RULE IS NOT THE OFFENCE; DISPOSING OF IT WITHOUT CITING THE DERIVATION IS. A line may name
// `RPH-E2E-006` freely — in a milestone's SCOPE column, in prose, in a design note. What it may not do is carry a
// STATUS for it (a ✅, a "delivered", a "deferred") while saying nothing about the Slice that now decides that
// status. So the predicate is: a line that names a rule AND carries a status marker MUST either be struck, or
// cite the ledger. That is narrow enough to be satisfiable by an honest edit and wide enough to catch the
// milestone rows that provoked this package.
//
// ── AND WHY THE CENSUS IS DERIVED FROM THE FILESYSTEM ────────────────────────────────────────────────────────
// A hand-written list of artifacts would rot the moment a twentieth roadmap appeared — which is the exact failure
// `SL-L4` is about. Worse, this programme has already made the hand-listing mistake in miniature three times in
// one session: a `RESIDUALS*.md` glob that missed `JAN-EXECREM-RESIDUALS.md`, a cancellation sweep that reported
// one hit where the concept net finds two, and an inventory pin that sat stale for two work packages. The census
// is globbed, and its non-emptiness is a CONTROL below.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Ratified rule ids the Slices now derive a disposition for. Derived, never listed. */
function derivedRuleIds(): string[] {
	const raw = readFileSync(`${ROOT}verif/slices/slice-ledger.baseline.json`, 'utf8');
	const rows = (JSON.parse(raw) as { rows?: { citedRules: string[] }[] }).rows ?? [];
	return [...new Set(rows.flatMap((r) => r.citedRules))].filter((id) => id.startsWith('RPH-E2E-'));
}

/**
 * The working-progress census: the artifacts `SL-L4` names.
 *
 * ⚠ CSAA's residual records are EXCLUDED BY NAME AND THE EXCLUSION IS DISCLOSED. `docs/ASTs and Code Analysis/`
 * holds `*Residual*` records belonging to another agent's programme; they make no claim about `RPH-E2E` and are
 * not this programme's to retire. Excluding them is a scoping decision, not an oversight — which is why it is
 * written here rather than achieved silently by a narrower glob.
 */
function census(): string[] {
	const working = readdirSync(`${ROOT}docs/_working`)
		.filter((f) => f.startsWith('ROADMAP-') && f.endsWith('.md'))
		.map((f) => `docs/_working/${f}`);
	return [
		...working,
		'docs/Command Precondition Legality/RESIDUALS.md',
		'docs/Execution Plan View Design and Implementation Planning/JAN-EXECREM-RESIDUALS.md',
		'docs/JPWB Implementation Roadmap and Tracker.md'
	];
}

/** A line carries a STATUS when it asserts a disposition rather than merely naming a subject. */
const STATUS_MARKER = /✅|❌|⚠️ done|\bDISCHARGED\b|\bDELIVERED\b|\bCOMPLETE\b|\bdeferred\b/i;

/** Struck text, the register's retire-by-striking idiom (`JPWB-REG-005:57`). */
const STRUCK = /~~/;

/** A line that points at the derivation is answerable to it, and is therefore not a second unchecked answer. */
const CITES_LEDGER = /JAN-SLICE|slice-ledger|LEDGER\.md|\.slice\.test\.ts|SWP-0[0-9]/;

interface Offence {
	readonly file: string;
	readonly line: number;
	readonly text: string;
}

function liveClaims(ruleIds: readonly string[]): Offence[] {
	const out: Offence[] = [];
	for (const rel of census()) {
		let text: string;
		try {
			text = readFileSync(`${ROOT}${rel}`, 'utf8');
		} catch {
			continue; // a census entry that has been renamed is caught by the control below, not silently skipped
		}
		text.split(/\r?\n/).forEach((line, i) => {
			if (!ruleIds.some((id) => line.includes(id))) return;
			if (!STATUS_MARKER.test(line)) return;
			if (STRUCK.test(line) || CITES_LEDGER.test(line)) return;
			out.push({ file: rel, line: i + 1, text: line.trim().slice(0, 160) });
		});
	}
	return out;
}

describe('SL-L4 — no working artifact claims an item the Slice ledger now derives', () => {
	it('CONTROL — the census is non-empty and every entry is readable', () => {
		// Without this the whole gate is vacuous: an empty census yields no offences and passes while measuring
		// nothing. The roadmap counted ~19 working roadmaps; fewer than that means the glob has drifted or files
		// were DELETED, which `SL-L4` forbids outright.
		const files = census();
		expect(files.length, 'the census must not be empty').toBeGreaterThanOrEqual(20);
		const unreadable = files.filter((rel) => {
			try {
				readFileSync(`${ROOT}${rel}`, 'utf8');
				return false;
			} catch {
				return true;
			}
		});
		expect(
			unreadable,
			`these census artifacts could not be read — SL-L4 forbids DELETING them, so a missing file is a finding, not a pass: ${unreadable.join(', ')}`
		).toEqual([]);
	});

	it('CONTROL — the ledger really yields the rules whose claims are being subsumed', () => {
		// The offence predicate is driven by `derivedRuleIds()`. If that returned nothing, `liveClaims` would find
		// nothing and this gate would go green over an unswept repository — the instrument failing exactly like
		// its subject, which this programme has already had happen once (the mutant driver reported all 41 inert
		// while reading one stale file).
		expect(
			derivedRuleIds().length,
			'the Slice ledger must yield the RPH-E2E rules whose dispositions it now derives'
		).toBeGreaterThan(0);
	});

	// ⚠⚠ THE ANTI-ACCUMULATION RATCHET, AND IT IS THE LIMB THAT MOST DIRECTLY EXPRESSES SL-L4. The obligation's
	// sharpest sentence is not about striking at all — it is *"A JAN-SLICE that leaves the nineteen working
	// roadmaps standing has become the twentieth"*. Striking claims is necessary; NOT ADDING A TWENTIETH is what
	// distinguishes this programme from its nineteen predecessors, and it is checkable where the striking is not.
	//
	// JAN-SLICE's own roadmap deliberately lives at `docs/Journey Slice Verification/`, NOT in `docs/_working/`,
	// precisely so that admitting it did not grow this population. That was a decision, and this is where it is
	// enforced rather than merely intended.
	//
	// ⚠ THIS PIN IS A RATCHET, NOT A PROHIBITION. A twentieth working roadmap may be legitimate — but it must be a
	// DELIBERATE act that edits this number and says why, not a file that appears and is noticed by nobody. That
	// is the whole content of finding F-7 ("the progress substrate is stale and multiplying"): nineteen of these
	// grew around a tracker whose own progress line had been wrong by a factor of 17 for seven weeks.
	it('the working-roadmap population has not grown — subsumption, not accumulation (SL-L4)', () => {
		const working = readdirSync(`${ROOT}docs/_working`).filter(
			(f) => f.startsWith('ROADMAP-') && f.endsWith('.md')
		);
		expect(
			working.length,
			`the working-roadmap population changed. SL-L4 makes ADDING one the failure mode this programme exists to end — if a twentieth is genuinely warranted, edit this number and record why. Present: ${working.sort().join(', ')}`
			// 19 -> 20 (2026-09-03): `ROADMAP-JAN-MXR-model-exchange-record.md`. ⚠ SL-L4 makes adding one the
			// failure mode this programme exists to end, so the warrant is stated rather than assumed: it
			// sequences work a SPONSOR RULING licensed on the day it was written (`REG-D-055`, resolving Guide
			// §16 item 23 for the exchange-record limb), and item 23's own instruction is a CONJUNCTION —
			// "registry, schemas, persistence, projections, fixtures, and conformance tests together" — which
			// is precisely the thing a roadmap exists to hold and a register entry cannot.
			// ⭑ IT SUBSUMES RATHER THAN ACCUMULATES, which is what SL-L4 actually asks: it absorbs the open
			// limbs of `JAN-ICP`'s `ICP-02`/`ICP-03` (the durable exchange record and the content/retention
			// seam), and it is bounded by an exit criterion that retires it rather than leaving it standing.
			//
			// 20 -> 21 (2026-09-04): `ROADMAP-exchange-resolution.md` (`JAN-MXREAD`). ⚠ THE WARRANT, STATED
			// RATHER THAN ASSUMED, and it is a different KIND from the twentieth. This one exists because its
			// design reaches a conclusion a register entry cannot enforce: `REG-F-244` remedy 3 blocks the
			// diagnostic read surface behind `REG-Q-056`, and the buildable remainder is a PAIR — a resolution
			// layer and its reader — with the rule "they ship together or neither ships". ⭑ That rule is the
			// whole point: shipped alone the resolution layer would be the hollow governed layer this
			// repository has recorded against itself repeatedly, and a rule binding two stages across one
			// commit is exactly what a roadmap holds and an entry does not.
			// ⭑ IT SUBSUMES: it closes the read half of `REG-F-245` (b′) — *"the system records WHERE an
			// artifact's content lives and never once resolves it"* — rather than opening a new front, and its
			// exit criterion (a non-test caller, verified with a positive control) retires it.
			//
			// 21 -> 22 (2026-09-04): `ROADMAP-prompt-template-and-context.md` (`JAN-PROMPT`). ⚠ THE WARRANT IS
			// THE SPONSOR'S OWN DIAGNOSIS, not a programme's convenience: *"a PWU is an agent with a prompt
			// template and relevant context … none of that existed in reality. So a PWA actually could not truly
			// run and do real work."* Measured and correct — every object definition searched for a
			// prompt/template/context field returned TWO hits and neither was a template. `REG-D-058` (sponsor)
			// then ruled the ownership axis, and item-23-style discipline applies: schema, handler, render guard,
			// surface and conformance move together or the field is a governed thing with no screen — which is
			// the defect being fixed, so shipping it that way would be self-refuting.
			// ⭑ IT SUBSUMES: canon already ratifies most of the hard half (DEC-1 puts rendering at the STEP,
			// ASR-4 makes a prompt a runtime asset rather than meaning, DEC-4 governs context assembly
			// exhaustively), so this roadmap builds CARRIERS for existing rules rather than opening a front —
			// and its exit criterion is a browser spec that reads a stored prompt back.
			//
			// 22 -> 23 (2026-09-05): `ROADMAP-model-invocation-step.md` (`JAN-EXECRUN`). ⭑ THE WARRANT IS A
			// REFUTATION, which is why it is a roadmap and not a ticket. An audit of this repository reported
			// that the system *"governs plans and hosts no tool invocation"* and recommended the sponsor rule on
			// whether that boundary still holds. Searched at HEAD, the corpus says the OPPOSITE: Guide `:1137`
			// defines an Execution Step AS *"model/tool invocation, retrieval, transformation…"*, and
			// `StepTypeSchema`'s FIRST member is `MODEL_INVOCATION`. `"hosts no"`, `"platform layer"`,
			// `"no tool invocation"` → 0 across DOC-003, the Guide and the register (control: `"execution"` →
			// 26 / 118). The caller was unbuilt, never forbidden — and a paraphrase would have cost a sponsor
			// round-trip.
			// ⭑ IT SUBSUMES: it is the CALLER `DESIGN-prompt-template-and-context.md` §4 named as owed by a
			// separate increment, and it writes to the `EXECUTION` plane that `REG-D-055` created and nothing
			// has ever used. Its exit criterion is a work unit that runs.
			//
			// 23 -> 24 (2026-09-05): `ROADMAP-work-discharge-declaration.md` (`JAN-DISCHARGE`). ⭑ THE WARRANT IS
			// A DEFECT THE PREVIOUS ROADMAP CREATED, which is why it is separate rather than folded in.
			// `JAN-EXECRUN` made "a model does this work" sayable, and thereby made ONE SILENCE stand for three
			// different facts: a person does it, a model does it, or nobody has decided. A professional could
			// not tell an unfinished type from a deliberately human one — the same shape as "a reader cannot
			// tell 'purged on schedule' from 'never stored' from 'lost'", arriving on the authoring plane.
			// ⭑ IT SUBSUMES: it makes the execute button read a DECLARATION instead of sniffing whether a
			// prompt happens to be armed, and its exit criterion is a visible open question rather than an
			// invisible gap.
			//
			// 24 -> 25 (2026-09-05): `ROADMAP-reasoning-review-over-work-products.md` (`JAN-EXECREVIEW`). ⭑ THE
			// WARRANT IS THAT `REG-F-352` LEFT THE FLOOR ABLE TO REFUSE AND UNABLE TO SATISFY: a model-executed
			// work unit could run, produce a work product, and never complete. A roadmap rather than a ticket
			// because the design's own §4 records a SCOPE JUDGEMENT — the deterministic facts are hours and the
			// reviewer is the part that decides whether "assured" means anything, so the two must not be
			// conflated by whoever picks this up.
			// ⭑ IT SUBSUMES: it reuses the floor validators, the remediation classifier and the recording plan
			// unchanged — three things measured subject-agnostic — and adds no second classifier. Its exit
			// criterion is a floor that RUNS over an artifact and says WHY it blocks.
			//
			// 25 -> 26 (2026-09-05): `ROADMAP-work-product-reviewer.md` (`JAN-WPREVIEW`). ⭑ THE LAST PIECE, and
			// a roadmap rather than a ticket because its design exists to FORBID a shortcut its own predecessor
			// named: `REG-F-355`'s e2e records the mutant as *"teach the offline reviewer to pass any parseable
			// work product, at which point 'assured' would mean a JSON parse."* A stage list that did not carry
			// that constraint would invite exactly it.
			// ⭑ IT SUBSUMES AND TERMINATES: it adds one arm to an existing validator (no second validator, no
			// new policy, no invented criterion ids — both are read from the policy), and its exit criterion is
			// a model-executed work unit reaching COMPLETED with its output assured. That closes the chain
			// REG-D-058 opened, so nothing follows it in this line.
		).toBe(26);
	});

	it('no census artifact carries a live, uncited status for a rule the ledger derives', () => {
		const offences = liveClaims(derivedRuleIds());
		expect(
			offences.map((o) => `${o.file}:${o.line} — ${o.text}`),
			'these lines carry a STATUS for a rule the Slice ledger now derives, and are neither struck nor citing the derivation. Strike them in place (`- ~~old~~ **new**`) citing the Slice — SL-L4 forbids deleting them'
		).toEqual([]);
	});

	it('CONTROL — a planted claim reddens the gate', () => {
		// ⚠ THE CONTROL IS SYNTHETIC AND IN-MEMORY, NOT A FILE EDIT. Planting a real line in a real census artifact
		// would leave the repository dirty if this test threw between plant and cleanup, and a control that can
		// corrupt its subject is worse than no control. This drives the PREDICATE over a fabricated line instead,
		// which is what `liveClaims` actually decides on.
		const ruleId = derivedRuleIds()[0]!;
		const planted = `| **M99** | some milestone | ${ruleId} | ✅ delivered |`;
		expect(
			STATUS_MARKER.test(planted) && !STRUCK.test(planted) && !CITES_LEDGER.test(planted),
			'a line naming a derived rule with a ✅ and no citation MUST be an offence, or the gate cannot catch the milestone rows that provoked this work package'
		).toBe(true);
		// And the three escapes must each be sufficient on their own, or a compliant edit could not clear the gate.
		expect(STRUCK.test(`~~${planted}~~`), 'striking must clear it').toBe(true);
		expect(
			CITES_LEDGER.test(`${planted} see e2e-006-restart-mid-execution.slice.test.ts`),
			'citing the Slice must clear it'
		).toBe(true);
		expect(
			STATUS_MARKER.test(`| **M99** | some milestone | ${ruleId} | scope only |`),
			'a line that merely NAMES the rule without a status marker must not be an offence'
		).toBe(false);
	});
});
