// THE SEVEN DEPENDENCY-CRUISER BOUNDARY RULES ARE WATCHED FROM `verif/` — JAN-CSAADEC CD-01.
//
// ⚠ 8 -> 7 (2026-09-11, JAN-CSAAEXT S5): `product-does-not-import-csaa` is REMOVED, not lost. Its `to` was the
// PATH `^packages/csaa/`, which ceases to exist at S6 — so the rule would become permanently unmatchable while
// this file's name pin stayed green, which is the control-that-cannot-fail this programme keeps removing. Its
// guarantee is owned by `verif/product-boundary.test.ts` (S2), which walks `apps/` AND `packages/rph-*` and
// targets the npm specifier, so it SUBSUMES the rule rather than replacing half of it. The prose below that
// still says "eight" is historical — the searches and mutants it records were run against eight.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────────────────────
// `.dependency-cruiser.cjs` declares the package DAG: seven `forbidden` rules, every one `severity: 'error'`.
// depcruise ENFORCES the rules it is handed, so a rule that is WRONG is caught by the cruise itself. What no
// cruise can see is a rule that has silently STOPPED BEING A RULE — deleted, renamed, downgraded to a warning,
// or relocated out of `forbidden`. depcruise then exits 0 and reports nothing, because there is nothing left
// for it to report. The absence of a violation and the absence of a rule are the same observation.
//
// Exactly ONE thing in this repository watched for that, and it is leaving. The CSAA inventory baseline
// (`verif/csaa/jan-csaa-005.inventory.baseline.json`, field `dependencyBoundary.ruleIds`) pins the eight names;
// it is produced by `packages/csaa/src/inventory/collect-inventory.ts:1663-1671`. JAN-CSAADEC decouples CSAA
// from the default gate, so that pin stops being consulted. This file reproduces the guarantee first.
//
// ⚠ THE ABSENCE WAS SEARCHED FOR, WITH A POSITIVE CONTROL, because a false zero here is indistinguishable from
// a finding (REG-F-093). Population `verif/**/*.ts` + `scripts/**/*.ts`, searched 2026-09-09:
//   · the eight rule names, alternated as one regex .............................. 0 hits
//   · CONTROL, same population, same tool: `dependency-cruiser` .................. 17 hits
//   · CONTROL, same population, same tool: `boundary` ............................ 36 hits
// So the walk reaches these directories and the zero is real. Checked the OTHER direction as well, because an
// absence claim has two sides: the same rule-name query over `packages/**/*.ts` returns exactly one hit,
// `packages/csaa/src/inventory/boundary-policy.test.ts:45` — inside the package being decoupled. Nothing
// outside CSAA would have noticed a boundary rule disappearing.
//
// ── WHY THIS IS STRICTLY STRONGER THAN THE PIN IT REPLACES, AND THE ONE PLACE IT IS WEAKER ────────────────────
// The incumbent collector is a TEXT walk: `collect-inventory.ts:1665-1671` collects the initializer of EVERY
// `PropertyAssignment` named `name` anywhere in the file, with no `forbidden` scoping, no severity, no `from`,
// no `to`. Read off that source, not carried from a design. Three silent-removal routes it cannot see:
//   · a SEVERITY DOWNGRADE to 'warn' — depcruise exits 0, the name is unchanged, the baseline stays green;
//   · a RELOCATION out of `forbidden` into another rule array — the text walk finds the name wherever it sits;
//   · a rule shorn of its `from`/`to` — never looked at.
// All three become findings here, because this reads `forbidden` STRUCTURALLY.
//
// ⛔ AND ONE CAPABILITY IS GENUINELY LOST, STATED RATHER THAN NETTED OUT OF A "STRICTLY STRONGER" CLAIM. The
// incumbent would redden on a stray `name: 'anything'` added ANYWHERE in the file, including outside every rule
// array — pollution detection, a side effect of its being unscoped. This file reads `forbidden` and therefore
// will not. That is a real subtraction and it is disclosed here rather than omitted.
//
// ── THE ANTI-VACUITY FLOOR IS DELIBERATELY NOT `>= PINNED.length` ─────────────────────────────────────────────
// The obvious floor is `rules.length >= PINNED.length`, i.e. `>= 7` against 7 rules. It is a trap. Deleting one
// rule leaves 7, which reddens the FLOOR and the VANISHED check together — an arrangement that trips two guards
// proves neither, and the control becomes indistinguishable from its subject on the single mutant that matters
// most. So the floor is a LOWER constant with its own stated job: it owns POPULATION COLLAPSE and READER
// BREAKAGE (a require that resolves to the wrong file, a config whose shape changed, a walk returning `[]`),
// while the VANISHED check owns the loss of any individual rule. Four — half the declared population — is the
// line: fewer than half surviving is a collapse, not a deletion.
//
// ⚠ HONEST LIMIT OF THAT SEPARATION, DISCLOSED BECAUSE IT WOULD OTHERWISE BE OVERCLAIMED. With a FIXED pinned
// set, no mutation of this config can empty the population without also vanishing names, so `forbidden: []`
// reddens the floor AND the VANISHED check. The separation that is actually achievable — and that the trap
// above is about — runs the other way: deleting ONE rule reddens the VANISHED check ALONE and leaves the floor
// green at 7. That is measured below. Buying "the floor reddens alone" would mean guarding the VANISHED check
// behind the floor, i.e. suppressing the only detector so that a control looks independent, and that is the
// control-that-cannot-fail this file exists to avoid building.
//
// ── WHAT THIS DELIBERATELY DOES NOT CLOSE ─────────────────────────────────────────────────────────────────────
// REG-F-271 (Status OPEN) is about these rules being WRONG — its remedy (2) requires a gate that asserts on
// `to.path` against the package directories on disk, with its own predicted red naming `controller` as
// nonexistent and `rph-authoring` as unmatched by all three purity rules. This file is `to.path`-AGNOSTIC: it
// asserts that a `to` exists, never what it contains. CD-01 is about the rules DISAPPEARING, not about their
// being wrong. They share a file, so whoever discharges REG-F-271 must EXTEND this test rather than write a
// second one beside it — said out loud because landing this silently would leave the next reader believing the
// config is fully watched.
//
// ── THE MUTANTS, DRIVEN BY HAND AND RECORDED ──────────────────────────────────────────────────────────────────
// Driven by editing `.dependency-cruiser.cjs`, running `--project verif dependency-boundary-rules`, and
// restoring the file byte-for-byte. BY HAND rather than through the mutation ledger because no program the runner
// compiles holds a `.cjs`: `compileProjectOf` (`scripts/mutants/verdict.ts`) compiles a ROOT-LEVEL file under
// `tsconfig.root-configs.json`, whose `files` are the root `.ts` files only, so a ledger mutant on this `.cjs`
// would be judged by a program that does not contain it — and `verif/mutant-verdict.test.ts`'s ledger census
// refuses exactly that (every measurable entry must be a root file of the program it compiles under). Before
// JAN-SELREV SR-1 the reason was different: the runner took `pkgOf`'s first path segment as the project, ran
// `tsc -p .dependency-cruiser.cjs/tsconfig.json`, hit TS5058 and BLOCKED as NO_COMPILE. Hand-driving is still
// correct; only its reason changed.
//
// Every "the incumbent is GREEN/RED here" claim below is MEASURED, not reasoned from the source: the incumbent
// derivation (`collect-inventory.ts:1655-1671`) was reproduced in a throwaway OS-temp probe and run against each
// mutated config, its output compared to the checked-in `dependencyBoundary.ruleIds`.
//
// ⚠ AND THE FIRST VERSION OF THAT COMPARATOR WAS BROKEN IN THE WAY THAT READS AS AGREEMENT. It compared JSON
// TEXT, and the pin is serialised with `, ` separators while the probe emitted `,` — so it reported RED for
// every mutant AND for the UNMUTATED control. A control that fails exactly like its subject looks like the
// subject failing. It was caught only because the unmutated row is in the table; comparing parsed arrays fixed
// it. The rows below are from the repaired instrument, whose unmutated row reads GREEN.
//
//   mutant                                    this file                                incumbent CSAA pin
//   ────────────────────────────────────────  ───────────────────────────────────────  ───────────────────
//   (unmutated)                               7 passed                                 GREEN  (control)
//   M-A1  delete the `domain-purity` object   1 failed / 6 passed — VANISHED red        RED
//         naming ['domain-purity']; NOT-PINNED GREEN; floor GREEN at 7. A deletion, distinguished.
//   M-A2  rename it to `domain-purity-v2`     2 failed / 5 passed — VANISHED red        RED
//         naming ['domain-purity'] AND NOT-PINNED red naming ['domain-purity-v2']. A rename is told apart
//         from a deletion ONLY because these are two assertions in two separate tests; one `toEqual` diff
//         cannot tell a rename from a delete-plus-add.
//   M-A3  `severity: 'error'` -> `'warn'`     1 failed / 6 passed — severity red       ⭑ GREEN
//         naming ['domain-purity: warn']. ⭑ THE INCUMBENT IS GREEN: its walk never looks at severity, so
//         depcruise would exit 0 on a rule that no longer forbids anything and the baseline would agree.
//         This row is the proof the salvage is not a re-implementation.
//   M-A4  relocate it into a new `allowed: []` 2 failed / 5 passed — sole-rule-array   ⭑ GREEN
//         red naming ['allowed'] AND VANISHED red. ⚠ Weaker than M-A1: it ADDS a key that does not exist
//         today. Labelled weaker rather than counted equal.
//   M-A5  `name: 'unrelated'` outside forbidden 7 passed — NOTHING, deliberately        ⛔ RED
//         The disclosed loss, above, now measured rather than asserted.
//   M-A0  `forbidden: [ ... ]` -> `[]`        2 failed / 5 passed — floor red          RED
//         ("forbidden rules found: 0 (collapse floor 4)") AND VANISHED red naming all eight, per the honest
//         limit above. This is the one row where the two do not separate, and it is printed rather than hidden.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

/** The config depcruise is actually pointed at. Asserted against `scripts.boundary` below, so this file cannot
 *  end up diligently watching a file the gate does not read. */
const CONFIG_PATH = '.dependency-cruiser.cjs';

/** The boundary rules, pinned by name. Sorted, so a rename's diff reads as one name out and one name in. */
const PINNED = [
	'contracts-is-foundation',
	'domain-purity',
	'no-app-or-ui-in-core',
	'no-circular',
	'not-to-unresolvable',
	'ports-purity',
	'projections-browser-safe'
] as const;

/** See "THE ANTI-VACUITY FLOOR IS DELIBERATELY NOT `>= PINNED.length`" above. Half the declared population. */
const COLLAPSE_FLOOR = 4;

/** Every key dependency-cruiser reads a rule array from. `forbidden` is the only one this repository declares;
 *  the others are named so that MOVING a rule into one is a finding rather than a silent disappearance. */
const RULE_ARRAY_KEYS = ['allowed', 'forbidden', 'required'] as const;

interface BoundaryRule {
	readonly name: string;
	readonly severity: string;
	readonly hasFrom: boolean;
	readonly hasTo: boolean;
}

/** The config as the cruiser sees it. `createRequire` on a `.cjs` from an ESM vitest test is proven on this
 *  runner — `packages/csaa/src/inventory/boundary-policy.test.ts:1,10,37` already does exactly this. */
export function loadCruiserConfig(): Record<string, unknown> {
	return require(`${ROOT}${CONFIG_PATH}`) as Record<string, unknown>;
}

/**
 * The declared `forbidden` rules, read STRUCTURALLY.
 *
 * A malformed entry is described rather than dropped: a rule with no `name` becomes a named placeholder, so it
 * surfaces in the NOT-PINNED diff instead of quietly shrinking the population into the floor's territory.
 */
export function forbiddenRules(config: Record<string, unknown>): BoundaryRule[] {
	const forbidden = config.forbidden;
	if (!Array.isArray(forbidden)) return [];
	return forbidden.map((entry: unknown, index: number): BoundaryRule => {
		const rule = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
			string,
			unknown
		>;
		return {
			name: typeof rule.name === 'string' ? rule.name : `<unnamed rule at index ${index}>`,
			severity: typeof rule.severity === 'string' ? rule.severity : '<no severity>',
			hasFrom: typeof rule.from === 'object' && rule.from !== null,
			hasTo: typeof rule.to === 'object' && rule.to !== null
		};
	});
}

describe('dependency-cruiser boundary rules are watched from verif/', () => {
	// ⭑ THE WIRING CONTROL, AND IT COMES FIRST BECAUSE EVERYTHING BELOW IS VACUOUS WITHOUT IT. A test that reads
	// a config no command consumes measures nothing. This pins the perimeter (`packages`, whole) and the config
	// path together, so the file this test loads is provably the file depcruise is handed.
	//
	// ⚠ SCOPED TO `boundary` ON PURPOSE. `boundary-policy.test.ts:28-30` holds this same assertion today and
	// leaves with CSAA, so it is reproduced. Its NEIGHBOUR at :31-33 — which pins `gate:fast` as opening with
	// two CSAA steps — is NOT reproduced: JAN-CSAADEC CD-05 makes that assertion false by design, and copying
	// it here would be authoring a gate against the increment it belongs to.
	it('the boundary command still cruises the whole packages perimeter with THIS config', () => {
		const manifest = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(manifest.scripts.boundary).toMatch(
			new RegExp(`^depcruise packages --config ${CONFIG_PATH.replace(/\./g, '\\.')}(\\s|$)`)
		);
	});

	// THE FLOOR. Owns collapse and reader breakage; owns NO individual rule. See the header for why it is 4 and
	// not 8, and for the honest limit of that separation.
	it('the rule population has not collapsed, so a broken read cannot pass as an empty config', () => {
		const config = loadCruiserConfig();
		expect(Array.isArray(config.forbidden)).toBe(true);
		const found = forbiddenRules(config).length;
		// Asserted as text rather than `toBeGreaterThanOrEqual`, so the failure message carries the number found
		// AND the floor it missed — a bare "expected 0 to be >= 4" does not say which config was read.
		expect(`forbidden rules found: ${found} (collapse floor ${COLLAPSE_FLOOR})`).toBe(
			`forbidden rules found: ${Math.max(found, COLLAPSE_FLOOR)} (collapse floor ${COLLAPSE_FLOOR})`
		);
	});

	// M-A1 / M-A2, deletion side. Separate from the NOT-PINNED test below so that BOTH results are observable
	// on the same run: a deletion reddens this one alone, a rename reddens both.
	it('every pinned boundary rule is still declared — one that VANISHED is named', () => {
		const declared = new Set(forbiddenRules(loadCruiserConfig()).map((rule) => rule.name));
		const vanished = PINNED.filter((name) => !declared.has(name));
		expect({ 'boundary rules that VANISHED': vanished }).toEqual({
			'boundary rules that VANISHED': []
		});
	});

	// M-A2, addition side / M-A4. An unpinned rule is not automatically wrong — but it is unreviewed, and a
	// rename arrives here as an addition that this test is the only place to see.
	it('every declared boundary rule is pinned — one that is NOT PINNED is named', () => {
		const pinned = new Set<string>(PINNED);
		const extra = forbiddenRules(loadCruiserConfig())
			.map((rule) => rule.name)
			.filter((name) => !pinned.has(name))
			.sort();
		expect({ 'boundary rules NOT PINNED': extra }).toEqual({ 'boundary rules NOT PINNED': [] });
	});

	// M-A3. The route the incumbent pin is blind to: depcruise exits 0 on a 'warn', so a downgraded rule is
	// enforcement that has ended without anything saying so.
	it('every boundary rule is severity error — a DOWNGRADED rule is named', () => {
		const downgraded = forbiddenRules(loadCruiserConfig())
			.filter((rule) => rule.severity !== 'error')
			.map((rule) => `${rule.name}: ${rule.severity}`)
			.sort();
		expect({ 'boundary rules NOT severity error': downgraded }).toEqual({
			'boundary rules NOT severity error': []
		});
	});

	// M-A4. `forbidden` is the file's only rule array today; a rule moved into `allowed` keeps its name and its
	// severity and stops forbidding anything.
	it('forbidden is the only rule array, so a rule RELOCATED out of it is named', () => {
		const config = loadCruiserConfig();
		const declaredArrays = RULE_ARRAY_KEYS.filter((key) => Array.isArray(config[key]));
		expect({ 'rule arrays declared': declaredArrays }).toEqual({
			'rule arrays declared': ['forbidden']
		});
	});

	// SHAPE CONTROL. A rule with no `to` forbids nothing; a rule with no `from` is not the rule that was
	// reviewed. ⚠ This asserts that `to` EXISTS, never what `to.path` CONTAINS — REG-F-271's remedy (2) is the
	// `to.path` half and it remains OPEN. Deliberately not widened here; see the header.
	it('every boundary rule still carries both a from and a to', () => {
		const shapeless = forbiddenRules(loadCruiserConfig())
			.filter((rule) => !rule.hasFrom || !rule.hasTo)
			.map((rule) => `${rule.name}: from=${rule.hasFrom} to=${rule.hasTo}`)
			.sort();
		expect({ 'boundary rules missing from/to': shapeless }).toEqual({
			'boundary rules missing from/to': []
		});
	});
});
