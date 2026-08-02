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
	conflictStatusRuleIds,
	deadPredicateRuleIds,
	duplicateRefusalMarkers,
	ENFORCEMENT_REGISTER,
	enforcedRuleIds,
	layerOfTestFile,
	malformedSchemaMarkers,
	MIN_REFUSAL_MARKER_LENGTH,
	observedAdmissionRuleIds,
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

/**
 * The SIX canon artifacts, per JPWB-CON-000 B1: "The recognized corpus is exactly: JPWB-CON-000, JPWB-DOC-001,
 * JPWB-DOC-002, JPWB-DOC-003, JPWB-DOC-004, JPWB-REG-005."
 *
 * DERIVED FROM THE FILESYSTEM AGAINST THAT CLAUSE, rather than enumerated as paths, so a retitled artifact still
 * resolves — but COUNTED by the gate above, so a RENAMED or DELETED one cannot silently shrink the search set.
 *
 * TWO EXCLUSIONS, both load-bearing. `.provenance.md` sidecars record where canon text came from and are NOT
 * canon; letting one satisfy a carriage claim would let the map impersonate the territory. The Ratify Sheet is
 * the CONFERRAL INSTRUMENT, not an artifact — B1 lists six, and a sheet that quotes a rule while disposing of it
 * is not a home for that rule.
 */
function canonArtifacts(): string[] {
	return readdirSync(`${REPO_ROOT}docs/canon`)
		.filter(
			(f) =>
				/^JPWB-(CON-000|DOC-00[1-4]|REG-005)\b/.test(f) &&
				f.endsWith('.md') &&
				!f.includes('.provenance.')
		)
		.sort((a, b) => a.localeCompare(b));
}

/** Which canon artifacts contain `anchor` verbatim. Empty means the citation does not resolve. */
function canonFilesContaining(anchor: string): string[] {
	return canonArtifacts().filter((f) =>
		readFileSync(`${REPO_ROOT}docs/canon/${f}`, 'utf8').includes(anchor)
	);
}

/** The production files that mention `symbol` as a whole word. */
function productionReferencesTo(symbol: string): string[] {
	const pattern = new RegExp(`\\b${symbol}\\b`);
	return productionSourceFiles()
		.filter((rel) => rel !== REGISTER_MODULE)
		.filter((rel) => pattern.test(readFileSync(`${REPO_ROOT}${rel}`, 'utf8')))
		.sort((a, b) => a.localeCompare(b));
}

/**
 * The rule families the register is TOTAL over.
 *
 * WIDENED 2026-08-01 to add `RPH-EVD`. The register's original scope paragraph recorded the rest of the taxonomy as
 * "follow-up work rather than faked here"; this is that follow-up discharged for one family, and it is listed here —
 * as data, checked below — rather than left as a sentence, because the previous form of this gate hard-coded one
 * prefix in a filter and nothing would have reported a family being silently dropped from it.
 */
const TOTAL_OVER_FAMILIES: readonly string[] = [
	'RPH-EXE-',
	'RPH-EVD-',
	'RPH-ASR-',
	'RPH-INT-',
	// ADDED 2026-08-02, closing the family. RPH-PWU was deliberately ABSENT from this list for the three commits in
	// which it held 5, then 8, then 9 of its ten rules — because the missing rows were all UNENFORCED_DISCLOSED
	// with OBSERVED_ADMISSION guards, and landing a disclosure without its observation is the one thing that arm
	// may never do. The absence was a claim ("this family is not yet total"), gated by this list being data.
	'RPH-PWU-',
	// ADDED 2026-08-02. RPH-CON was called STRUCTURALLY INEXPRESSIBLE by this register's own scope paragraph until
	// the day it was closed: its obligations are enforced by the CONTRACT, and `classifyRefusal` read only
	// `REJECTED` while the boundary returns `VALIDATION_FAILED`, so real enforcement classified as ADMITTED. It was
	// never inexpressible — it was a second layer, and naming it (`RefusalLayer`) took one opt-in field.
	'RPH-CON-'
];

describe('WP-16 (c) — the register is TOTAL over the families it claims', () => {
	it.each(TOTAL_OVER_FAMILIES)('every %s* rule in the catalog carries a disposition', (family) => {
		// The anti-recurrence property: a tenth RPH-EXE rule cannot be ratified into the vocab and then quietly go
		// unenforced, because it lands here as a failing test on the day it is added. The same now holds for RPH-EVD.
		const catalogued = catalog.ruleCatalog.map((r) => r.id).filter((id) => id.startsWith(family));
		expect(catalogued.length, `the catalog must actually contain ${family}`).toBeGreaterThan(5);
		const disposed = new Set<string>(REGISTERED_RULE_IDS);
		expect(
			catalogued.filter((id) => !disposed.has(id)),
			`${family} rule(s) with no disposition`
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

// ── JAN-VERIF V-4a — THE CANON CARRIAGE GATE ─────────────────────────────────────────────────────────────────
//
// Every rule in this register is ratified in the PRE-CANON corpus, and Ratify Sheet Part 4 approves retiring that
// corpus to an archive outside the agent-visible tree. Without this gate a rule can lose its only readable
// statement and nothing reports it — the same laundering the register was built to stop, one layer out at the
// rule's TEXT rather than its enforcement.
describe('V-4a — every rule disposes CANON CARRIAGE, and every citation resolves', () => {
	it('the six canon artifacts are found — a rename must fail here, not shrink the search set in silence', () => {
		// DERIVED, then COUNTED. Deriving alone is not enough: if an artifact were renamed, the filter would return
		// five files, every anchor would still be searched against the remaining five, and a carriage claim could
		// pass while its carrier had vanished. The count is what makes the derivation honest.
		expect(canonArtifacts().map((f) => f.replace(/ .*/, ''))).toEqual([
			'JPWB-CON-000',
			'JPWB-DOC-001',
			'JPWB-DOC-002',
			'JPWB-DOC-003',
			'JPWB-DOC-004',
			'JPWB-REG-005'
		]);
	});

	it('every canonAnchor occurs in a canon artifact', () => {
		const unresolved: string[] = [];
		for (const id of REGISTERED_RULE_IDS) {
			const carriage = ENFORCEMENT_REGISTER[id].canonCarriage;
			if (carriage.kind === 'NO_CANON_CARRIER') continue;
			if (canonFilesContaining(carriage.canonAnchor).length === 0)
				unresolved.push(`${id}: ${carriage.canonAnchor}`);
		}
		expect(unresolved, 'carriage claim(s) citing text that is NOT in canon').toEqual([]);
	});

	it('a NO_CANON_CARRIER disposition is argued, never asserted', () => {
		// Same >80-character discipline the register's other reasoned arms carry. "Not in canon" is the easiest
		// disposition to reach for and the one most in need of an argument, because it is indistinguishable from
		// "I did not look" — which is exactly the error that produced V-4's first, overstated statement.
		for (const id of REGISTERED_RULE_IDS) {
			const carriage = ENFORCEMENT_REGISTER[id].canonCarriage;
			if (carriage.kind !== 'NO_CANON_CARRIER') continue;
			expect(carriage.why.length, `${id}'s NO_CANON_CARRIER must be argued`).toBeGreaterThan(80);
		}
	});

	it('the axis carries more than one verdict — a register that says CARRIED everywhere checks nothing', () => {
		// The same argument as the three-dispositions gate above. If every row read CARRIED the axis would be a
		// decoration; the point is that it is currently carrying a real NO_CANON_CARRIER finding.
		const kinds = new Set(
			REGISTERED_RULE_IDS.map((id) => ENFORCEMENT_REGISTER[id].canonCarriage.kind)
		);
		expect(kinds.size).toBeGreaterThan(1);
		expect([...kinds]).toContain('NO_CANON_CARRIER');
	});

	it('SELFTEST: the resolver reports failure on text absent from canon', () => {
		expect(canonFilesContaining('this sentence appears in no canon artifact whatsoever')).toEqual(
			[]
		);
	});

	it('SELFTEST: a PROVENANCE SIDECAR does not satisfy a carriage claim', () => {
		// The sharpest failure this gate must not have. `.provenance.md` records where canon text CAME FROM; if a
		// sidecar could satisfy an anchor, the map would impersonate the territory and a rule could be certified as
		// carried by a file that carries nothing. This string exists in exactly one sidecar and in no artifact.
		expect(canonFilesContaining('extract-doc008-a.md RPH-EXE-009')).toEqual([]);
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
	it.each(deadPredicateRuleIds())(
		'%s: its dead predicate still has exactly the declared production references',
		(id: RegisteredRuleId) => {
			// A prose disclosure outlives the condition it discloses. This one cannot: wire the predicate into a
			// handler and the reference set changes, this goes RED, and the row must be re-dispositioned as ENFORCED
			// with a probe. That is the difference between a disclosure and an excuse.
			const row = ENFORCEMENT_REGISTER[id];
			expect(row.kind).toBe('UNENFORCED_DISCLOSED');
			if (row.kind !== 'UNENFORCED_DISCLOSED' || row.guard.kind !== 'DEAD_PREDICATE') return;
			expect(
				productionReferencesTo(row.guard.deadPredicate),
				`${id}: ${row.guard.deadPredicate}'s production references changed — re-disposition this row`
			).toEqual([...row.guard.referencedOnlyBy].sort((a, b) => a.localeCompare(b)));
		}
	);

	// ── THE PRECONDITION THE CENSUS GUARD ALWAYS HAD AND NEVER CHECKED (added 2026-08-01) ──────────────────────
	//
	// `referencedOnlyBy` detects wiring by watching the reference SET change. That only works if the baseline
	// EXCLUDES the file the wiring would land in. `capabilityAuthorized`'s baseline is one file — its own
	// definition — so the archetype satisfied this silently, and nothing checked it.
	//
	// It is not satisfied generally. Measured over the RPH-EVD candidates, every plausible symbol's baseline
	// ALREADY CONTAINED a handler file, so wiring the check into that same handler would have changed nothing and
	// the row would have stayed green forever. That is a guard that cannot fail, and this gate is what stops one
	// being written: a DEAD_PREDICATE row whose census already names a command-layer file must instead be
	// dispositioned with an OBSERVED_ADMISSION guard, which watches behaviour rather than text.
	it.each(deadPredicateRuleIds())(
		'%s: its census baseline excludes the command layer, so wiring the predicate can actually redden it',
		(id: RegisteredRuleId) => {
			const row = ENFORCEMENT_REGISTER[id];
			if (row.kind !== 'UNENFORCED_DISCLOSED' || row.guard.kind !== 'DEAD_PREDICATE') return;
			const commandLayer = row.guard.referencedOnlyBy.filter(
				(f) => layerOfTestFile(f) === 'COMMAND'
			);
			expect(
				commandLayer,
				`${id}: the census baseline already contains command-layer file(s), so wiring the guard there ` +
					`would not change the set — this disclosure cannot detect its own condition ending. Use an ` +
					`OBSERVED_ADMISSION guard instead.`
			).toEqual([]);
		}
	);

	it('SELFTEST: that precondition gate is not vacuous — a command-layer path IS seen as command-layer', () => {
		// Without this, a `layerOfTestFile` that returned UNKNOWN for handler paths would make the gate above pass
		// for exactly the censuses it exists to reject. This is the mirror of the census instrument's own control.
		expect(layerOfTestFile('packages/rph-application/src/handlers/assurance.ts')).toBe('COMMAND');
		expect(layerOfTestFile('packages/rph-domain/src/execution.ts')).not.toBe('COMMAND');
	});

	it('every OBSERVED_ADMISSION guard argues why no predicate could be named', () => {
		// The arm is the easier one to reach for — it needs no symbol — so the thing that keeps it honest is that it
		// must positively explain why DEAD_PREDICATE was unavailable, at the same >80-character standard the
		// register's other reasoned arms carry.
		for (const id of observedAdmissionRuleIds()) {
			const row = ENFORCEMENT_REGISTER[id];
			if (row.kind !== 'UNENFORCED_DISCLOSED' || row.guard.kind !== 'OBSERVED_ADMISSION') continue;
			expect(row.guard.whyNoPredicate.length, `${id}: whyNoPredicate must be argued`).toBeGreaterThan(
				80
			);
			expect(row.guard.arrangement.length, `${id}: the arrangement must be stated`).toBeGreaterThan(40);
			expect(row.guard.control.length, `${id}: the control must be stated`).toBeGreaterThan(40);
		}
	});

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
		// SURFACE, added 2026-07-28 (SPEC-001 FORK-19). This assertion previously read `…'apps/rph-demo/e2e/x.e2e.ts'
		// -> UNKNOWN`, and that was correct at the time: the register could not express a surface-layer obligation
		// at all, so every app path fail-closed. It is now RECOGNISED — which is a different thing from being
		// ASSUMED, and the unrecognised cases below still fail closed exactly as before.
		expect(layerOfTestFile('apps/rph-demo/e2e/x.e2e.ts')).toBe('SURFACE');
		expect(layerOfTestFile('apps/rph-demo/src/routes/x.test.ts')).toBe('SURFACE');
		// The literal failing inputs: an unknown app, an unknown package, and an empty string must NOT read as
		// COMMAND — nor as SURFACE. A gate that guessed either would certify exactly the claims it exists to check.
		expect(layerOfTestFile('apps/some-other-app/e2e/x.e2e.ts')).toBe('UNKNOWN');
		expect(layerOfTestFile('packages/rph-something-new/src/x.test.ts')).toBe('UNKNOWN');
		expect(layerOfTestFile('')).toBe('UNKNOWN');
		// …and a path that merely CONTAINS the package name is not the package.
		expect(layerOfTestFile('vendor/packages/rph-application/src/x.test.ts')).toBe('UNKNOWN');
	});

	it('normalises Windows separators (this repo is developed on both)', () => {
		expect(layerOfTestFile('packages\\rph-application\\src\\handlers\\x.test.ts')).toBe('COMMAND');
	});
});

// ── SELFTESTS FOR THE SCHEMA ARM (2026-08-02) ────────────────────────────────────────────────────────────────
//
// The arm exists so RPH-CON's contract obligations can be recorded as ENFORCED; it is dangerous in exactly one
// way, and these tests are aimed at that way. If `VALIDATION_FAILED` counted as a refusal for rows that did NOT
// opt in, every probe in the register would be satisfiable by a malformed payload, and the six fixture errors this
// programme caught would have silently reported KILLED.
describe('classifyRefusal — the SCHEMA arm is OPT-IN and cannot leak into COMMAND rows', () => {
	const commandRow = {
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'the declared marker text'
	};
	const schemaRow = {
		refusalCode: 'RPH_VALIDATION_SCHEMA_FAILED',
		refusalMarker: 'unrecognized_keys@',
		refusalLayer: 'SCHEMA' as const
	};
	const boundaryRefusal = {
		status: 'VALIDATION_FAILED',
		code: 'RPH_VALIDATION_SCHEMA_FAILED',
		message: 'Schema validation failed',
		issues: [{ path: '', code: 'unrecognized_keys' }]
	};

	it('THE LOAD-BEARING ONE: a boundary refusal does NOT satisfy a COMMAND row', () => {
		// This is the whole safety property. A malformed payload in any of the register's COMMAND probes must read
		// as ADMITTED — i.e. the probe FAILS — not as a kill.
		expect(classifyRefusal(boundaryRefusal, commandRow)).toBe('ADMITTED');
	});

	it('and a row that merely omits refusalLayer is a COMMAND row', () => {
		// The default must be the SAFE one. Every row written before this arm existed omits the field.
		expect(classifyRefusal(boundaryRefusal, { ...schemaRow, refusalLayer: undefined })).toBe(
			'ADMITTED'
		);
	});

	it('reports KILLED only when the status, the code AND the structured issue all hold', () => {
		expect(classifyRefusal(boundaryRefusal, schemaRow)).toBe('KILLED');
	});

	it('REPORTS FAILURE on each literal failing input, and distinguishes them', () => {
		// ADMITTED — the boundary let it through.
		expect(classifyRefusal({ status: 'ACCEPTED' }, schemaRow)).toBe('ADMITTED');
		// WRONG_CODE — a SEMANTIC guard refused first. A row claiming schema enforcement whose arrangement is
		// caught by a handler has mis-declared its layer, and this is what that looks like.
		expect(
			classifyRefusal(
				{ status: 'REJECTED', code: 'RPH_INVARIANT_VIOLATION', message: 'a handler caught it' },
				schemaRow
			)
		).toBe('WRONG_CODE');
		// MASKED — the boundary refused, but on a DIFFERENT field than the row declares. This is the case a
		// message-based marker could never have distinguished, because the message is a constant.
		expect(
			classifyRefusal(
				{ ...boundaryRefusal, issues: [{ path: 'issuedAt', code: 'invalid_format' }] },
				schemaRow
			)
		).toBe('MASKED');
		// MASKED — no structured issues at all (an error shape that carried none) must not pass.
		expect(classifyRefusal({ ...boundaryRefusal, issues: [] }, schemaRow)).toBe('MASKED');
		expect(classifyRefusal({ ...boundaryRefusal, issues: undefined }, schemaRow)).toBe('MASKED');
	});

	it('matches the issue pair by EQUALITY, not by substring', () => {
		// `unrecognized_keys@` must not be satisfied by `unrecognized_keys@someField`: the empty path IS the claim
		// (zod reports an undeclared property at the object root), and a substring match would let a nested failure
		// green a root-level rule.
		expect(
			classifyRefusal(
				{ ...boundaryRefusal, issues: [{ path: 'someField', code: 'unrecognized_keys' }] },
				schemaRow
			)
		).toBe('MASKED');
	});

	it('SELFTEST: the marker-shape gate rejects a prose marker on a SCHEMA row', () => {
		// A SCHEMA row whose marker reads like a COMMAND marker would never match anything and would sit green-by-
		// never-being-probed if the probe map ever lost it. `malformedSchemaMarkers` is the structural check.
		expect(malformedSchemaMarkers()).toEqual([]);
	});
});

// ── SELFTESTS FOR THE DECLARED-STATUS ARM (2026-08-02, the RPH-PER tranche) ──────────────────────────────────
//
// `refusalStatus` exists because this engine has FOUR refusing statuses and the COMMAND arm read one. RPH-PER-001
// is refused at a named command-layer site with status CONFLICT, and until this field the register would have
// classified that working refusal as ADMITTED — the exact error it exists to prevent, made by the instrument.
//
// The danger is the mirror of the SCHEMA arm's: if CONFLICT counted for every row, a probe whose fixture happened
// to carry a stale `expectedRevision` would report KILLED without ever reaching the invariant it is about. The
// arrangement that produced RPH-CON-003's control is one line away from being that fixture, so this is not
// hypothetical. Hence opt-in, and hence the first test below.
describe('classifyRefusal — the declared-status arm is OPT-IN and cannot leak into REJECTED rows', () => {
	const rejectRow = {
		refusalCode: 'RPH_INVARIANT_VIOLATION',
		refusalMarker: 'the declared marker text'
	};
	const conflictRow = {
		refusalCode: 'RPH_REVISION_CONFLICT',
		refusalMarker: 'command expected revision',
		refusalStatus: 'CONFLICT' as const
	};
	/** The real shape, copied from an observed dispatch (see the RPH-PER-001 probe). */
	const concurrencyRefusal = {
		status: 'CONFLICT',
		code: 'RPH_REVISION_CONFLICT',
		message: 'Revision conflict on int_x: command expected revision 0, actual is 1'
	};

	it('THE LOAD-BEARING ONE: a CONFLICT does NOT satisfy a row that did not declare it', () => {
		// A stale expectedRevision in any REJECTED row's fixture must read as ADMITTED — the probe FAILS — because
		// the arrangement never reached the guard the row is about.
		expect(classifyRefusal(concurrencyRefusal, rejectRow)).toBe('ADMITTED');
	});

	it('and a row that merely omits refusalStatus is a REJECTED row', () => {
		// The default must be the SAFE one. Every row written before this arm existed omits the field.
		expect(classifyRefusal(concurrencyRefusal, { ...conflictRow, refusalStatus: undefined })).toBe(
			'ADMITTED'
		);
	});

	it('reports KILLED only when the declared status, the code AND the marker all hold', () => {
		expect(classifyRefusal(concurrencyRefusal, conflictRow)).toBe('KILLED');
	});

	it('REPORTS FAILURE on each literal failing input, and distinguishes them', () => {
		// ADMITTED — the command went through.
		expect(classifyRefusal({ status: 'ACCEPTED' }, conflictRow)).toBe('ADMITTED');
		// ADMITTED — refused, but with the WRONG status. For a CONFLICT row a plain REJECTED means some other
		// guard fired first, and the concurrency check the row is about was never reached.
		expect(classifyRefusal({ ...concurrencyRefusal, status: 'REJECTED' }, conflictRow)).toBe(
			'ADMITTED'
		);
		// WRONG_CODE — the right status carrying a different code is not this refusal.
		expect(
			classifyRefusal({ ...concurrencyRefusal, code: 'RPH_INVARIANT_VIOLATION' }, conflictRow)
		).toBe('WRONG_CODE');
		// MASKED — right status, right code, but the OTHER site produced it. The store's own conflict message
		// ('Revision conflict on X (actual revision N)') is byte-different from the handler's, which is exactly
		// why the marker names the handler's clause and not the shared prefix.
		expect(
			classifyRefusal(
				{ ...concurrencyRefusal, message: 'Revision conflict on int_x (actual revision 1)' },
				conflictRow
			)
		).toBe('MASKED');
	});

	it('SELFTEST: the arm is not vacuous — some registered row actually declares CONFLICT', () => {
		// An opt-in arm no row uses is an arm no mutant can redden, and this repository has shipped three of those.
		// If the last CONFLICT row is ever re-dispositioned, this fails and the arm must be removed with it.
		expect(conflictStatusRuleIds().length).toBeGreaterThan(0);
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
