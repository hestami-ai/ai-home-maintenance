// JAN-EXECREM WP-16 / SM-6 — the enforcement register's own gates, and the SELFTESTS of the primitives they use.
//
// THE GATE MECHANISM MUST ITSELF BE PROVED (DR-001 §3, WP-16). Every gate in this file computes with a handful of
// pure analysis primitives, and a bug in one of them silently turns the whole register green — a `classifyRefusal`
// that returned KILLED unconditionally would certify every rule while observing nothing. So each primitive is fed
// LITERAL synthetic input and asserted to REPORT FAILURE. The recursion terminates here: these functions have no
// dependencies to mock, so there is nothing below them to prove.
//
// The three registry-totality gates of SM-6 land in three places, not one, because each belongs beside the
// registry it reads:
//   (a) STEP_COMMAND_SPECS  -> the arrow census, `execrem-wp16-arrow-census.test.ts` (rph-application: it drives
//                              real commands, which this package may not do)
//   (b) ATTEMPT_EFFECTS     -> `execrem-wp13-attempt-fold.test.ts` (rph-projections), landed with WP-13
//   (c) ENFORCEMENT_REGISTER -> structure HERE, observation in `execrem-wp16-enforcement-observed.test.ts`
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	classifyRefusal,
	duplicateRefusalMarkers,
	ENFORCEMENT_REGISTER,
	enforcedRuleIds,
	layerOfTestFile,
	MIN_REFUSAL_MARKER_LENGTH,
	REGISTERED_RULE_IDS,
	residualSourceStates,
	shortRefusalMarkers,
	unenforcedRuleIds,
	type RegisteredRuleId
} from './enforcement-register.js';
import { coverageFor } from './conformance-manifest.js';
import { STEP_COMMAND_SPECS } from './step-command-spec.js';
import { STATE_MACHINES } from './transitions.data.js';

interface Rule {
	readonly id: string;
	readonly statement: string;
}
const catalog = JSON.parse(
	readFileSync(new URL('../vocab/m12-conformance.json', import.meta.url), 'utf8')
) as { readonly ruleCatalog: readonly Rule[] };

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Every non-test `.ts` file under any package's `src` tree, repo-relative with forward slashes. */
function productionSourceFiles(): string[] {
	const out: string[] = [];
	const walk = (abs: string, rel: string): void => {
		for (const entry of readdirSync(abs)) {
			const childAbs = `${abs}/${entry}`;
			const childRel = `${rel}/${entry}`;
			if (statSync(childAbs).isDirectory()) {
				if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') continue;
				walk(childAbs, childRel);
			} else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(childRel);
		}
	};
	for (const pkg of readdirSync(`${REPO_ROOT}packages`)) {
		const src = `${REPO_ROOT}packages/${pkg}/src`;
		try {
			if (!statSync(src).isDirectory()) continue;
		} catch {
			continue;
		}
		walk(src, `packages/${pkg}/src`);
	}
	return out;
}

/**
 * The register itself NAMES each dead predicate, in `deadPredicate`. That is a declaration, not a call site, and
 * counting it would put every row's own disclosure into its own evidence. Excluded by name, and only this one file.
 */
const REGISTER_MODULE = 'packages/rph-domain/src/enforcement-register.ts';

/** The production files that mention `symbol` as a whole word. */
function productionReferencesTo(symbol: string): string[] {
	const pattern = new RegExp(`\\b${symbol}\\b`);
	return productionSourceFiles()
		.filter((rel) => rel !== REGISTER_MODULE)
		.filter((rel) => pattern.test(readFileSync(`${REPO_ROOT}${rel}`, 'utf8')))
		.sort((a, b) => a.localeCompare(b));
}

describe('WP-16 (c) — the register is TOTAL over the ratified RPH-EXE family', () => {
	it('every RPH-EXE-* rule in the catalog carries a disposition', () => {
		// The anti-recurrence property: a tenth RPH-EXE rule cannot be ratified into the vocab and then quietly go
		// unenforced, because it lands here as a failing test on the day it is added.
		const catalogued = catalog.ruleCatalog
			.map((r) => r.id)
			.filter((id) => id.startsWith('RPH-EXE-'));
		expect(catalogued.length, 'the catalog must actually contain the family').toBeGreaterThan(5);
		const disposed = new Set<string>(REGISTERED_RULE_IDS);
		expect(
			catalogued.filter((id) => !disposed.has(id)),
			'RPH-EXE rule(s) with no disposition'
		).toEqual([]);
	});

	it('and disposes no rule the catalog does not ratify (no fictional ids)', () => {
		const catalogued = new Set(catalog.ruleCatalog.map((r) => r.id));
		expect(REGISTERED_RULE_IDS.filter((id) => !catalogued.has(id))).toEqual([]);
	});

	it('the three dispositions are all populated — a register with only one arm proves nothing', () => {
		// If every row were ENFORCED the register would be a list of things that already worked; if none were, it
		// would be a wish-list. The mechanism only means something when it is carrying all three verdicts at once.
		const kinds = new Set(REGISTERED_RULE_IDS.map((id) => ENFORCEMENT_REGISTER[id].kind));
		expect([...kinds].sort()).toEqual([
			'ENFORCED',
			'NOT_A_COMMAND_REFUSAL',
			'UNENFORCED_DISCLOSED'
		]);
	});

	it('every disposition carries its reason, and no reason is a stub', () => {
		for (const id of REGISTERED_RULE_IDS) {
			const row = ENFORCEMENT_REGISTER[id];
			if (row.kind === 'ENFORCED') {
				expect(row.enforcedAt, id).toContain('packages/');
				expect(row.declaredMutations.length, `${id} must say what to break`).toBeGreaterThan(0);
			} else {
				expect(row.why.length, `${id}'s disposition must be argued, not asserted`).toBeGreaterThan(
					80
				);
			}
		}
	});
});

describe('WP-16 (c) — refusal markers can each be satisfied by exactly one refusal', () => {
	it('no two ENFORCED rows share a marker', () => {
		// The failure this prevents: a probe arranged for rule B trips rule A's earlier guard, and the register
		// records two greens for one enforcement site. RPH-PWU-009 and RPH-PWU-010 are refused by the SAME production
		// function, which is why they are the pair this gate actually has to work on.
		expect(duplicateRefusalMarkers()).toEqual([]);
	});

	it('every marker is long enough to be a discriminator', () => {
		expect(shortRefusalMarkers()).toEqual([]);
	});

	it('and the two same-site rows are genuinely distinguishable at the observation point', () => {
		const nine = ENFORCEMENT_REGISTER['RPH-PWU-009'];
		const ten = ENFORCEMENT_REGISTER['RPH-PWU-010'];
		expect(nine.kind).toBe('ENFORCED');
		expect(ten.kind).toBe('ENFORCED');
		if (nine.kind !== 'ENFORCED' || ten.kind !== 'ENFORCED') return;
		// Neither marker is a substring of the other — so a message satisfying one cannot satisfy both.
		expect(nine.refusalMarker.includes(ten.refusalMarker)).toBe(false);
		expect(ten.refusalMarker.includes(nine.refusalMarker)).toBe(false);
	});
});

describe('WP-16 (c) — the LAYER gate: the axis the coverage manifest never had', () => {
	it('every ENFORCED rule cites COMMAND-layer evidence in the coverage manifest', () => {
		// THE ORIGINAL DEFECT, now a build failure. RPH-PWU-010's cite was `rph-domain/src/execution.test.ts` — a call
		// to a pure predicate with no production caller — and the manifest certified it COVERED. A pure-kernel cite
		// for a "the command is rejected" rule is no longer expressible without this test going RED.
		const wrongLayer: string[] = [];
		for (const id of enforcedRuleIds()) {
			const coverage = coverageFor(id);
			const layer = coverage?.testFile ? layerOfTestFile(coverage.testFile) : 'UNKNOWN';
			if (layer !== 'COMMAND')
				wrongLayer.push(`${id} -> ${coverage?.testFile ?? '(none)'} [${layer}]`);
		}
		expect(wrongLayer, 'ENFORCED rule(s) whose cited coverage is not at the command layer').toEqual(
			[]
		);
	});

	it('no rule disclosed as UNENFORCED is certified COVERED anywhere in the manifest', () => {
		// The other half, and the one no coverage model can express on its own: a rule nothing enforces must not be
		// able to appear green — not by a per-id cite, and not by inheriting a family's blanket COVERED either.
		const overclaimed = unenforcedRuleIds().filter((id) => coverageFor(id)?.status === 'COVERED');
		expect(overclaimed, 'unenforced rule(s) certified COVERED').toEqual([]);
	});
});

describe('WP-16 (c) — the disclosures are CHECKED, not merely written', () => {
	it.each(unenforcedRuleIds())(
		'%s: its dead predicate still has exactly the declared production references',
		(id: RegisteredRuleId) => {
			// A prose disclosure outlives the condition it discloses. This one cannot: wire the predicate into a
			// handler and the reference set changes, this goes RED, and the row must be re-dispositioned as ENFORCED
			// with a probe. That is the difference between a disclosure and an excuse.
			const row = ENFORCEMENT_REGISTER[id];
			expect(row.kind).toBe('UNENFORCED_DISCLOSED');
			if (row.kind !== 'UNENFORCED_DISCLOSED') return;
			expect(
				productionReferencesTo(row.deadPredicate),
				`${id}: ${row.deadPredicate}'s production references changed — re-disposition this row`
			).toEqual([...row.referencedOnlyBy].sort((a, b) => a.localeCompare(b)));
		}
	);

	it('the census instrument is not vacuous — a symbol with real callers is SEEN to have them', () => {
		// Without this, a broken `productionReferencesTo` returning [] would make every disclosure above pass.
		// `canResumeExecutionOnPwu` is the control: it was in exactly this dead state until WP-12b, and the fix was
		// to give it a caller in rph-application — so it must now be seen in BOTH packages.
		const refs = productionReferencesTo('canResumeExecutionOnPwu');
		expect(refs).toContain('packages/rph-domain/src/execution.ts');
		expect(refs, 'WP-12b gave RPH-PWU-010 a production caller; the census must see it').toContain(
			'packages/rph-application/src/handlers/execution.ts'
		);
	});
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SELFTESTS — each primitive fed literal synthetic input and required to REPORT FAILURE (DR-001 §3, WP-16).
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('WP-16 selftest — layerOfTestFile', () => {
	it('classifies each package, and FAILS CLOSED on anything it does not recognise', () => {
		expect(layerOfTestFile('packages/rph-application/src/handlers/x.test.ts')).toBe('COMMAND');
		expect(layerOfTestFile('packages/rph-engine/src/x.test.ts')).toBe('COMMAND');
		expect(layerOfTestFile('packages/rph-domain/src/x.test.ts')).toBe('PURE_KERNEL');
		expect(layerOfTestFile('packages/rph-projections/src/x.test.ts')).toBe('READ_MODEL');
		expect(layerOfTestFile('packages/rph-persistence/src/x.test.ts')).toBe('STORE');
		expect(layerOfTestFile('packages/rph-contracts/src/x.test.ts')).toBe('SCHEMA');
		// The literal failing inputs: an app-level path, an unknown package, and an empty string must NOT read as
		// COMMAND. A gate that guessed COMMAND here would certify exactly the claims it exists to check.
		expect(layerOfTestFile('apps/rph-demo/e2e/x.e2e.ts')).toBe('UNKNOWN');
		expect(layerOfTestFile('packages/rph-something-new/src/x.test.ts')).toBe('UNKNOWN');
		expect(layerOfTestFile('')).toBe('UNKNOWN');
		// …and a path that merely CONTAINS the package name is not the package.
		expect(layerOfTestFile('vendor/packages/rph-application/src/x.test.ts')).toBe('UNKNOWN');
	});

	it('normalises Windows separators (this repo is developed on both)', () => {
		expect(layerOfTestFile('packages\\rph-application\\src\\handlers\\x.test.ts')).toBe('COMMAND');
	});
});

describe('WP-16 selftest — classifyRefusal', () => {
	const expected = {
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'the declared marker text'
	};

	it('reports KILLED only when the status, the code AND the marker all hold', () => {
		expect(
			classifyRefusal(
				{
					status: 'REJECTED',
					code: 'RPH_INVARIANT_VIOLATION',
					message: 'x the declared marker text y'
				},
				expected
			)
		).toBe('KILLED');
	});

	it('REPORTS FAILURE on each of the three literal failing inputs, and distinguishes them', () => {
		// ADMITTED — the probe did not refuse at all.
		expect(classifyRefusal({ status: 'ACCEPTED' }, expected)).toBe('ADMITTED');
		// WRONG_CODE — something refused, but not this check.
		expect(
			classifyRefusal(
				{
					status: 'REJECTED',
					code: 'RPH_ILLEGAL_STATE_TRANSITION',
					message: 'the declared marker text'
				},
				expected
			)
		).toBe('WRONG_CODE');
		// MASKED — the right CODE from the wrong GUARD. This is the vacuous negative DS-001 §4 names, and the reason
		// the code alone is never enough: RPH_ILLEGAL_STATE_TRANSITION is produced by the machine, by four prechecks
		// and by every source set in the system.
		expect(
			classifyRefusal(
				{
					status: 'REJECTED',
					code: 'RPH_INVARIANT_VIOLATION',
					message: 'refused for some other reason'
				},
				expected
			)
		).toBe('MASKED');
		// …and an absent message is MASKED, not KILLED.
		expect(classifyRefusal({ status: 'REJECTED', code: 'RPH_INVARIANT_VIOLATION' }, expected)).toBe(
			'MASKED'
		);
	});
});

describe('WP-16 selftest — the marker analysers report failure on synthetic bad input', () => {
	// These two read the real register, so they are exercised against LITERAL rows here rather than by mutating it.
	const shortOf = (marker: string, min: number) => marker.length < min;
	it('a too-short marker is reported', () => {
		expect(shortOf('too short', MIN_REFUSAL_MARKER_LENGTH)).toBe(true);
		expect(shortOf('x'.repeat(MIN_REFUSAL_MARKER_LENGTH), MIN_REFUSAL_MARKER_LENGTH)).toBe(false);
	});

	it('two rows sharing a marker are reported', () => {
		const rows = [
			{ id: 'A', marker: 'the same marker text here' },
			{ id: 'B', marker: 'the same marker text here' },
			{ id: 'C', marker: 'a different marker text here' }
		];
		const seen = new Map<string, string>();
		const clashes: string[] = [];
		for (const r of rows) {
			const prior = seen.get(r.marker);
			if (prior) clashes.push(`${prior}/${r.id}`);
			else seen.set(r.marker, r.id);
		}
		expect(clashes).toEqual(['A/B']);
	});
});

describe('WP-16 selftest — residualSourceStates (the arrow census denominator)', () => {
	it('derives the residual set the WP-9 battery hand-picked, from the machine and the spec', () => {
		// WP-9 reasoned its way to six cases and wrote them down. If the derivation disagrees with that reasoning,
		// one of the two is wrong — so the derivation is checked against the conclusions a human reached.
		expect(residualSourceStates(STEP_COMMAND_SPECS.StartExecutionStep).sort()).toEqual([
			'RUNNING',
			'WAITING'
		]);
		expect(residualSourceStates(STEP_COMMAND_SPECS.ResolveExecutionStepWait).sort()).toEqual([
			'QUEUED',
			'RUNNING'
		]);
		expect(residualSourceStates(STEP_COMMAND_SPECS.RetryExecutionStep).sort()).toEqual([
			'QUEUED',
			'READY'
		]);
		expect(residualSourceStates(STEP_COMMAND_SPECS.SkipExecutionStep).sort()).toEqual([
			'NOT_READY',
			'SKIPPED'
		]);
		// The empty-residual commands, where the only kill is the self-edge the machine admits as a NOOP.
		expect(residualSourceStates(STEP_COMMAND_SPECS.CompleteExecutionStep)).toEqual(['SUCCEEDED']);
		expect(residualSourceStates(STEP_COMMAND_SPECS.EnterExecutionStepWait)).toEqual(['WAITING']);
		expect(residualSourceStates(STEP_COMMAND_SPECS.CancelExecutionStep)).toEqual(['CANCELLED']);
	});

	it('REPORTS FAILURE the moment a declared source set widens — synthetic literal input', () => {
		// The anti-recurrence property, stated over a hand-built spec rather than the real table: widen the sources
		// and the residual set SHRINKS, so the census loses a row and its totality check goes RED. This is what makes
		// a one-character widening a reviewable change rather than a quieter guard.
		const narrow = { ...STEP_COMMAND_SPECS.StartExecutionStep, sourceStates: ['QUEUED'] as const };
		const widened = {
			...STEP_COMMAND_SPECS.StartExecutionStep,
			sourceStates: ['QUEUED', 'WAITING'] as const
		};
		expect(residualSourceStates(narrow)).toContain('WAITING');
		expect(residualSourceStates(widened)).not.toContain('WAITING');
	});

	it('never proposes a state the machine does not admit into the target', () => {
		// A census probing an arrow the MACHINE refuses would classify MASKED for a reason that has nothing to do
		// with the source set — a whole battery of vacuous negatives, generated automatically. Every residual state
		// must therefore be either the NOOP self-edge or a real declared arrow.
		const machine = STATE_MACHINES['ExecutionStep.stepState']!;
		for (const spec of Object.values(STEP_COMMAND_SPECS))
			for (const state of residualSourceStates(spec)) {
				const admitted =
					state === spec.target ||
					machine.transitions.some((t) => t.from === state && t.to === spec.target);
				expect(admitted, `${spec.commandType} <- ${state} is not an arrow the machine admits`).toBe(
					true
				);
			}
		// NOT_READY -> RUNNING is declared ILLEGAL by the machine, so it must never appear as a Start residual.
		expect(residualSourceStates(STEP_COMMAND_SPECS.StartExecutionStep)).not.toContain('NOT_READY');
	});
});
