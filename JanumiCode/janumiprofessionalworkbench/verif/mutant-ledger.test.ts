// THE LEDGER'S OWN INTEGRITY — JAN-VERIF V-2c.
//
// The mutant ledger is an instrument, and this programme's recurring finding is that instruments go wrong in ways
// that read as passing. Three specific ways, all observed here, all now checked:
//
//   1. TWO ENTRIES DECLARING THE SAME MUTATION. The V-2 harvest merged two work-package harnesses without
//      deduplicating, so three mutations appeared twice. The first authoritative run then reported "90 mutants,
//      0 SURVIVED" when 87 distinct mutations had been measured and three kills had been counted twice. The
//      guarantee held; the DENOMINATOR did not, and a mutation score is a ratio.
//   2. AN ID THAT NAMES MORE THAN ONE ENTRY. `bun run mutants <id>` filters by substring and `show.ts` prints by
//      substring, so a repeated id makes "I ran that mutant" ambiguous about which one.
//   3. A CROSS-REFERENCE THAT NAMES NOTHING. `supersededBy` and `duplicateOf` are what make RETIRED and DUPLICATE
//      honest rather than a way to silence an inconvenient entry: each says "the guard is still proven, over there".
//      If the named successor does not exist, the entry has been retired into a void and the guard is unproven with
//      no verdict saying so — strictly worse than leaving it broken, because a broken entry at least reports.
//
// These are checks on the LEDGER, not on the product, which is why they live in `verif/` beside the source-resolution
// proof rather than in any package's suite.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DECLARED_MUTANTS } from '../scripts/mutants/ledger.js';

/** The three fields the anchor census reads — narrowed so the control below can build fixtures. */
interface Anchored {
	readonly id: string;
	readonly file: string;
	readonly find: string;
}

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The entries a run actually measures. Shared by the anchor census and its control, so that a population which
 *  shrinks to nothing reddens the CONTROL rather than being absorbed by the census passing vacuously. */
const MEASURABLE = DECLARED_MUTANTS.filter(
	(m) => m.supersededBy === undefined && m.duplicateOf === undefined
);

/**
 * The mutation itself, independent of who declared it or what they expected.
 *
 * `JSON.stringify` of the tuple rather than a delimiter-joined string: anchors contain tabs, newlines, backticks and
 * `${…}`, so any delimiter chosen for being "unlikely" is a delimiter that will eventually appear inside a `find`
 * and silently merge two different mutations into one key.
 */
const mutationKey = (m: (typeof DECLARED_MUTANTS)[number]) =>
	JSON.stringify([m.file, m.find, m.replace]);

describe('the mutant ledger is internally coherent', () => {
	it('gives every entry a unique id, so selecting one selects one', () => {
		const seen = new Map<string, number>();
		for (const m of DECLARED_MUTANTS) seen.set(m.id, (seen.get(m.id) ?? 0) + 1);
		expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
	});

	it('declares each distinct mutation ONCE — or says which entry it duplicates', () => {
		const groups = new Map<string, typeof DECLARED_MUTANTS>();
		for (const m of DECLARED_MUTANTS)
			groups.set(mutationKey(m), [...(groups.get(mutationKey(m)) ?? []), m]);

		const offenders: string[] = [];
		for (const group of groups.values()) {
			if (group.length === 1) continue;
			// THREE LEGITIMATE REASONS for a shared mutation, and each must be POSITIVELY declared:
			//   - all but one entry names the entry it duplicates;
			//   - an entry is RETIRED, so it never runs and cannot double-count. This is what lets V2C-T1 reuse
			//     WP12B-M3's edit: the same text change, kept for what it genuinely proves (the union is closed)
			//     while the entry that claimed the wrong thing about it stays on the record, retired;
			//   - the entries assert DIFFERENT victims, which is a different claim about the same edit. B4/B5 are the
			//     case that matters: one mutation, asked of the unit suite and of the reference seed, because "the unit
			//     tests catch it" and "the seed cannot survive it" are two facts and the second is the load-bearing one.
			const undeclared = group.filter(
				(m) => m.duplicateOf === undefined && m.supersededBy === undefined
			);
			const victimSets = new Set(undeclared.map((m) => [...m.expectRed].sort().join('|')));
			if (undeclared.length > 1 && victimSets.size !== undeclared.length)
				offenders.push(undeclared.map((m) => m.id).join('  ==  '));
		}
		expect(offenders).toEqual([]);
	});

	it('resolves every supersededBy and duplicateOf to an entry that EXISTS', () => {
		const ids = DECLARED_MUTANTS.map((m) => m.id);
		// The cross-reference is prose ending in an em-dash rationale; the id is what precedes it, and it must be
		// findable. Substring rather than equality because a reference names the twin's id as written, and several
		// ids were suffixed with their harvest source when they were disambiguated.
		const dangling = DECLARED_MUTANTS.flatMap((m) =>
			[m.supersededBy, m.duplicateOf].flatMap((ref) => {
				if (ref === undefined) return [];
				const named = ref.split(' —')[0]!.trim();
				return ids.some((id) => id.includes(named) || named.includes(id))
					? []
					: [`${m.id} -> ${named}`];
			})
		);
		expect(dangling).toEqual([]);
	});

	it('never marks one entry as both retired and duplicate, which would say the guard moved AND did not', () => {
		expect(
			DECLARED_MUTANTS.filter(
				(m) => m.supersededBy !== undefined && m.duplicateOf !== undefined
			).map((m) => m.id)
		).toEqual([]);
	});

	it('gives every entry a rationale and a provenance, because an unexplained mutant cannot be triaged', () => {
		expect(
			DECLARED_MUTANTS.filter((m) => m.why.trim() === '' || m.source.trim() === '').map((m) => m.id)
		).toEqual([]);
	});

	// ── V-3c: THE UNNAMED-VICTIM RATCHET, CHECKED IN SECONDS RATHER THAN IN THIRTY-SEVEN MINUTES ─────────────
	//
	// `run.ts` also fails on KILLED_UNNAMED, and that is the authoritative gate — it observes the mutant actually
	// being killed by the suite it names. But it is a **43.6-minute run (measured 2026-08-15 at 52dc5e1a; was
	// 37.2 min at e070c462 before REG-F-171 bought attribution with per-victim baselines; and before REG-F-164
	// this said "~30-minute", undated and wrong)**, so it is the WRONG place to learn that a
	// field was left blank: the feedback arrives long after the commit that caused it, which is how a records
	// defect accumulates for eighteen work packages while being truthfully reported every single run.
	//
	// This is the same claim decided from the DATA, in the ordinary `test` run. Two gates for one rule is
	// deliberate here — they fail at different times and neither subsumes the other.
	it('names a victim for every MEASURABLE mutant — "something caught it" is not a record', () => {
		// The exclusions are not leniency, they are correctness. An empty `expectRed` is CORRECT for a control (it
		// must redden NOTHING), for a type-prevented mutant (it never reaches a test run), and for entries decided
		// before they are applied. Demanding a victim from any of them would invent a defect to fix — and the set
		// is written to match `run.ts`'s HARVEST selection exactly, so the two instruments cannot disagree about
		// which population the rule governs.
		const measurable = DECLARED_MUTANTS.filter(
			(m) =>
				m.supersededBy === undefined &&
				m.duplicateOf === undefined &&
				m.expectSurvive === undefined &&
				m.expectNoCompile === undefined
		);
		expect(
			measurable.length,
			'the ledger must actually contain measurable mutants'
		).toBeGreaterThan(50);
		expect(
			measurable.filter((m) => m.expectRed.length === 0).map((m) => m.id),
			'mutant(s) with NO NAMED VICTIM — run `bun run mutants:harvest`, then CHOOSE against what the candidate suites assert'
		).toEqual([]);
	});

	// ── EVERY ANCHOR STILL LANDS (REG-F-100) ──────────────────────────────────────────────────────────────────
	//
	// WHY THIS IS HERE AND NOT IN `gate:fast` AS A NEW STEP. The obvious fix to REG-F-100 was "add
	// `bun run mutants:preflight` to gate:fast". It does not work, for three measured reasons:
	//
	//   1. **PREFLIGHT ABORTS ON A DIRTY TREE.** `treeIsClean()` runs at `run.ts` module scope, BEFORE any
	//      preflight branching, and exits 2. `gate:fast` is the thing you run on uncommitted work — the one
	//      condition under which preflight refuses to start.
	//   2. **PREFLIGHT MUTATES THE TREE.** It APPLIES each mutant and runs `tsc` on the mutated project before
	//      stopping. That is ~154 file writes and ~154 typechecks, and a killed process can strand a mutation
	//      (which is why `run.ts` carries crash recovery at all). A pre-commit gate must not be able to leave a
	//      guard disabled in the working tree.
	//   3. **IT COSTS MINUTES, AND SLOW GATES GET RUN LESS.** `run.ts` makes that argument itself about its
	//      cleanliness check; it applies here with more force, because gate:fast is the gate people actually run.
	//
	// AND NONE OF THAT IS NEEDED FOR THE CLASS THAT ACTUALLY OCCURRED. **Anchoring is a pure string count.** All
	// TEN mutants the SonarQube remediation detached were UNANCHORED, not NO_COMPILE — so the check that would
	// have caught them at the commit that caused them needs no mutation, no typecheck and no clean tree. It reads
	// files and counts. Preflight keeps the other half, where applying really is required.
	//
	// So gate:fast gains this protection with NO new step: `bun run test` includes `test:dist`, which runs the
	// root vitest config, which includes `verif`. The cost is milliseconds.
	// ⚠ ONE MUTANT MAY BE EXEMPT, AND ONLY WHILE THE RUNNER HAS IT APPLIED (REG-F-110).
	//
	// This census reads the WORKING TREE, which is right at `gate:fast` and unsatisfiable inside
	// `scripts/mutants/run.ts` — the runner has just replaced one of the very strings it counts. The cost was a
	// BLOCKING FALSE VERDICT rather than noise: a CONTROL declares `expectRed: []`, so the runner invokes the
	// WHOLE suite, which includes this file, so all four declared controls reported "declared a CONTROL, but a
	// test FAILED on it" and the mutation gate blocked on its own instrument. The census I added to close
	// REG-F-100 had silently broken the gate that consumes it — [[check the instrument itself]] again.
	//
	// THE EXEMPTION IS ONE ID, NOT "SKIP UNDER THE RUNNER". A mutation that rots a DIFFERENT mutant's anchor must
	// still be caught here — that is the whole of `F100-a-a-refactor-rewrites-an-anchored-line`, which reddens
	// this census by breaking two OTHER anchors. Exempting only the applied id makes that mutant strictly sharper:
	// it can no longer be killed by the trivial fact of its own `find` having been replaced.
	function unanchored(population: readonly Anchored[], appliedId?: string): string[] {
		return population.flatMap((m) => {
			if (m.id === appliedId) return [];
			const path = `${REPO_ROOT}${m.file}`;
			if (!existsSync(path)) return [`${m.id}: FILE MISSING — ${m.file}`];
			const n = readFileSync(path, 'utf8').split(m.find).length - 1;
			return n === 1 ? [] : [`${m.id}: ${n} occurrence(s) in ${m.file}`];
		});
	}

	it('anchors: every measurable mutant still occurs EXACTLY ONCE in its file', () => {
		const offenders = unanchored(MEASURABLE, process.env.RPH_MUTANT_APPLIED);
		expect(
			offenders,
			'UNANCHORED mutant(s). A claim someone cited as evidence can no longer be performed. If you moved or ' +
				'reindented this code, re-anchor IN THIS COMMIT (ledger rule #5) — anchor on CONTENT, without leading ' +
				'whitespace wherever content alone is unique (rule #4). If the guard genuinely went away, set ' +
				'`supersededBy` naming the entry that now proves it. See REG-F-100.'
		).toEqual([]);
	});

	// CONTROL — and it is a SEPARATE `it` on purpose, over a population computed ONCE at module scope.
	//
	// Written inside the census above, both assertions redden on every mutation and the control proves nothing
	// about the census — measured: emptying the population and restoring a rotted anchor each reddened the same
	// single test. That is the defect this repository has shipped three times and recorded at REG-F-099. Split,
	// and sharing `MEASURABLE`, a population that silently shrinks to nothing makes the census pass VACUOUSLY and
	// reddens THIS test alone.
	it('CONTROL — the anchor census has a population and a reader that resolves', () => {
		expect(MEASURABLE.length, 'the ledger must contain measurable mutants to check').toBeGreaterThan(100);
		expect(
			existsSync(`${REPO_ROOT}${MEASURABLE[0]!.file}`),
			"the first measurable mutant's file must resolve, or REPO_ROOT is wrong and every count is a fiction"
		).toBe(true);
	});

	// CONTROL — THE EXEMPTION IS NARROW (REG-F-110). Without this, `RPH_MUTANT_APPLIED` could be widened to skip
	// the whole census under the runner — which would make the gate green and make `F100-a` unkillable — and
	// nothing would say so. Two rotted anchors, one of them the applied mutant: EXACTLY ONE must be reported, and
	// it must be the other one.
	it('CONTROL — exempting the applied mutant exempts THAT ONE ONLY', () => {
		const rotted: Anchored[] = [
			{ id: 'applied', file: 'package.json', find: '__no_such_string_applied__' },
			{ id: 'other', file: 'package.json', find: '__no_such_string_other__' }
		];
		expect(unanchored(rotted, 'applied').map((s) => s.split(':')[0])).toEqual(['other']);
		// And with nothing applied, BOTH are reported — otherwise the first assertion would also pass on a reader
		// that silently drops rows.
		expect(unanchored(rotted, undefined).map((s) => s.split(':')[0])).toEqual(['applied', 'other']);
	});

	// ── REG-F-162: A NAMED VICTIM THAT NO LONGER EXISTS IS SCORED AS A KILL ─────────────────────────────────
	//
	// ⚠ THIS IS A FALSE **KILLED**, NOT A MISSING CHECK, WHICH IS WHY IT IS GATED RATHER THAN NOTED. `run.ts`
	// invokes `bunx vitest run <victim>` and reads ONE bit — the exit status. Every project sets
	// `passWithNoTests: false`, so vitest exits NON-ZERO when the named path matches nothing, and the runner
	// attributes that failure to the mutation: **the entry reports KILLED and the guard is recorded as proven by
	// a suite that is not there.**
	//
	// The anchor census above catches the mirror case — the mutated FILE moving — and has since REG-F-100. The
	// VICTIM moving was never checked, and the two rot by the same mechanism: an ordinary rename, committed by
	// someone who never opened the ledger. A rename is the worst shape of it, because `git diff --name-only`
	// reports only the DESTINATION, so nothing in a review shows the old path going stale.
	//
	// CHEAP BY CONSTRUCTION, and that is the argument for putting it here rather than in the runner: this file
	// already runs inside `bun run test` in milliseconds, so all 220 entries are checked on every commit —
	// whereas the runner only learns of the rot when it reaches that entry, ~40 minutes in, and then mis-reports
	// it. **A check that runs where the evidence is cheap beats one that runs where the failure happens.**
	function missingVictims(population: readonly { id: string; expectRed: readonly string[] }[]): string[] {
		return population.flatMap((m) =>
			m.expectRed
				.filter((v) => !existsSync(`${REPO_ROOT}${v}`))
				.map((v) => `${m.id}: VICTIM MISSING — ${v}`)
		);
	}

	it('every NAMED victim still exists on disk, so a rename cannot be scored as a kill', () => {
		expect(
			missingVictims(DECLARED_MUTANTS),
			'mutant(s) naming a victim suite that is GONE. `run.ts` reads only the exit status, and vitest exits ' +
				'non-zero on an unmatched path under `passWithNoTests: false` — so this entry would report KILLED ' +
				'and record the guard as proven by a suite that does not exist. Re-point `expectRed` at the suite ' +
				'that now carries the assertions, or retire the entry with `supersededBy`. See REG-F-162.'
		).toEqual([]);
	});

	// CONTROL — the assertion above is satisfied both by a reader that resolves every path and by one that
	// resolves NONE and returns `[]` regardless. This holds the discriminating half on a fixture, for the reason
	// REG-F-122 gives: the failing case cannot exist in the real population while the population is healthy, so
	// a test over the real ledger alone can never enter the arm it exists to prove.
	it('CONTROL — the victim census actually reads the filesystem, and reports only the missing', () => {
		const fixture = [
			{ id: 'present', expectRed: ['verif/mutant-ledger.test.ts'] },
			{ id: 'gone', expectRed: ['verif/a-suite-that-was-never-written.test.ts'] }
		];
		expect(missingVictims(fixture).map((s) => s.split(':')[0])).toEqual(['gone']);
		expect(missingVictims([]), 'an empty population yields no offenders').toEqual([]);
		expect(
			missingVictims([{ id: 'no-victim', expectRed: [] }]),
			'a CONTROL names no victim by design and must never be reported here'
		).toEqual([]);
	});

	it('names exactly ONE victim per mutant, because a longer list is a LOWER bar', () => {
		// THE COUNTER-INTUITIVE HALF, and the reason it is gated rather than written in a comment. `run.ts` invokes
		// vitest ONCE with every named suite and fails if the run fails — so naming a second suite means "any of
		// these reddens", which is WEAKER than naming the first alone. The instinct to add another name for safety
		// makes the claim smaller, and nothing about the green output would say so.
		expect(
			DECLARED_MUTANTS.filter((m) => m.expectRed.length > 1).map((m) => m.id),
			'mutant(s) naming several victims — pick the suite whose assertions are about the guard'
		).toEqual([]);
	});
});
