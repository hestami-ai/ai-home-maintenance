// M12 conformance manifest — the coverage overlay over the full RPH-* rule catalog (Conformance Spec §3
// taxonomy: 7 layers, 125 rules, Properties P1–P8). This is the executable accounting that gates the suite:
// every rule in the catalog must map to a coverage status; a rule that resolves to `undefined` (UNACCOUNTED)
// fails the conformance test (the "CI fails on any single invariant violation" goal). The catalog itself is
// loaded from vocab/m12-conformance.json (the grounded source of truth) by conformance.test.ts.
//
// HONESTY RULE: a family is COVERED only when EVERY id in it is asserted; if only some ids are asserted the
// family is PARTIAL (with a note listing what is covered vs pending). This overlay was audited by the M12
// adversarial review, which downgraded several families that had been over-claimed as COVERED.

export type CoverageStatus =
	| 'COVERED' // every rule in the family is asserted by a concrete unit test
	| 'PROPERTY' // asserted generatively by a P1–P8 property test (properties.test.ts)
	| 'PARTIAL' // the core rules are asserted; specific ids remain pending (documented in the note)
	| 'DEFERRED'; // legitimately not an M12-kernel concern (M13 replay/e2e, M14 UI, or out-of-0.1.x scope)

export interface Coverage {
	readonly status: CoverageStatus;
	readonly testFile?: string;
	readonly note?: string;
}

/** Per-id coverage for the individually-asserted numbered rules (from the audited M12 coverage map). Each cited
 *  file is a concrete test that actually asserts that id (conformance.test.ts checks each path exists). */
const COVERED_BY_ID: Readonly<Record<string, string>> = {
	'RPH-CON-001': 'packages/rph-contracts/src/envelopes.test.ts',
	'RPH-CON-002': 'packages/rph-contracts/src/envelopes.test.ts',
	'RPH-CON-004': 'packages/rph-contracts/src/envelopes.test.ts',
	'RPH-CON-008': 'packages/rph-contracts/src/messages.test.ts',
	'RPH-PWU-005': 'packages/rph-domain/src/execution.test.ts',
	'RPH-PWU-007': 'packages/rph-domain/src/pwuGuards.test.ts', // satisfiesP1: rejected assurance can't satisfy
	'RPH-PWU-010': 'packages/rph-domain/src/execution.test.ts',
	'RPH-PER-001': 'packages/rph-persistence/src/sqlite-storage-adapter.test.ts',
	'RPH-PER-002': 'packages/rph-persistence/src/sqlite-storage-adapter.test.ts',
	'RPH-PER-007': 'packages/rph-projections/src/work-projection.test.ts',
	'RPH-PER-012': 'packages/rph-domain/src/execution.test.ts'
};

/** Prefix-level coverage. `testFile` may be a glob/multi-file description for by-concern families; the concrete
 *  single-file cites live in COVERED_BY_ID. */
const COVERAGE_BY_PREFIX: Readonly<Record<string, Coverage>> = {
	// Fully COVERED — the M9/M10/M11 kernel families, every id asserted by name.
	'RPH-DEC': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/decomposition.test.ts',
		note: 'RPH-DEC-001..007 by id'
	},
	'RPH-CNS': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/decomposition.test.ts',
		note: 'RPH-CNS-001..004 by id (004 also in governance.test.ts)'
	},
	'RPH-ASM': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/decomposition.test.ts',
		note: 'RPH-ASM-001..006 by id'
	},
	'RPH-GOV': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/governance.test.ts',
		note: 'RPH-GOV-001..007 by id'
	},
	'RPH-BAS': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/governance.test.ts',
		note: 'RPH-BAS-002..007 by id; BAS-001 via the item-shape happy path'
	},
	'RPH-EXE': {
		status: 'COVERED',
		testFile: 'packages/rph-domain/src/execution.test.ts',
		note: 'RPH-EXE-001..009 by id'
	},

	// PARTIAL — core asserted, specific ids pending (audited by the M12 review; honest split).
	'RPH-CON': {
		status: 'PARTIAL',
		testFile: 'packages/rph-contracts/src/*.test.ts',
		note: 'CON-001/002/004/008 by id; schema/enum/hash/id fidelity by concern; CON-003/005/006/007 pending explicit assertions'
	},
	'RPH-INT': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/{transitions,binding}.test.ts',
		note: 'state-machine legality + command→event binding covered; INT-004/005/006/007 (Intent-aggregate invariant/version/cascade/authority) pending an Intent-aggregate test'
	},
	'RPH-PWU': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/pwuGuards.test.ts',
		note: 'four-axis guards + P1/INV-5 + PWU-005/007/010 (by id); the command guards PWU-002/003/004 pending (rph-application)'
	},
	'RPH-ASR': {
		status: 'PARTIAL',
		testFile: 'packages/rph-assurance/src/assurance-rules.test.ts',
		note: 'disposition ladder / strictest-unresolved / independence / waiver / validator classification asserted (by Inv-N/§ labels); ASR-001 (request on EVIDENCE_PENDING) and ASR-009 (condition visibility) pending'
	},
	'RPH-EVD': {
		status: 'PARTIAL',
		testFile: 'packages/rph-assurance/src/assurance-rules.test.ts',
		note: 'evidence admissibility gate (EVD-003/004/007) asserted; EVD-001/002/006 and the EVD-005 cascade pending'
	},
	'RPH-TRC': {
		status: 'PARTIAL',
		testFile: 'packages/rph-domain/src/traceability.test.ts',
		note: 'directionality + invalidation cascade + graph queries asserted; TRC-002 (constraint-propagation path) and TRC-003 (unsupported-object detection) pending'
	},
	'RPH-PRJ': {
		status: 'PARTIAL',
		testFile: 'packages/rph-projections/src/work-projection.test.ts',
		note: 'PRJ-001/002 (no-green-without-assurance + fold/rebuild) asserted; PRJ-003/005 → M14 UI surface; PRJ-004 = Property P8'
	},
	'RPH-PER': {
		status: 'PARTIAL',
		testFile: 'rph-persistence + rph-domain',
		note: 'idempotency/concurrency/replay-equivalence/restart-classification asserted (001/002/007/012); remaining restart-scenario conformance (011/013/014, 003-006/008-010) completes with the M13 replay harness'
	},

	// DEFERRED — legitimately not an M12-kernel concern.
	'RPH-CMP': {
		status: 'DEFERRED',
		note: 'dual-run/shadow comparison classification — migration apparatus, explicitly OUT of 0.1.x (D2) / MP scope'
	},
	'RPH-FIX': {
		status: 'DEFERRED',
		note: 'field-service fixture replay (expected-events.jsonl) — the M13 Reference Undertaking replay harness'
	},
	'RPH-E2E': {
		status: 'DEFERRED',
		note: 'full end-to-end scenarios — the M13 Reference Undertaking replay + M14 surface'
	}
};

/** The families that may legitimately be DEFERRED (integration/e2e/migration). The gate asserts nothing else
 *  sneaks into DEFERRED. */
export const DEFERRABLE_PREFIXES: ReadonlySet<string> = new Set(['RPH-CMP', 'RPH-FIX', 'RPH-E2E']);

/** Properties P1–P8 are all asserted generatively in properties.test.ts. */
export const PROPERTY_COVERAGE: Readonly<Record<string, string>> = {
	P1: 'packages/rph-domain/src/properties.test.ts',
	P2: 'packages/rph-domain/src/properties.test.ts',
	P3: 'packages/rph-domain/src/properties.test.ts',
	P4: 'packages/rph-domain/src/properties.test.ts',
	P5: 'packages/rph-domain/src/properties.test.ts',
	P6: 'packages/rph-domain/src/properties.test.ts',
	P7: 'packages/rph-domain/src/properties.test.ts',
	P8: 'packages/rph-domain/src/properties.test.ts'
};

/** The rule-id prefix, e.g. "RPH-DEC-003" -> "RPH-DEC", "RPH-E2E-001" -> "RPH-E2E" (prefix may contain a digit). */
export function prefixOf(ruleId: string): string {
	const m = ruleId.match(/^(RPH-[A-Z0-9]+)-\d+$/);
	return m ? m[1]! : ruleId;
}

/**
 * Resolve the coverage of a single RPH-* rule id. Per-id coverage wins; otherwise the family's prefix status
 * applies. A rule that resolves to `undefined` is UNACCOUNTED — the conformance gate fails on it.
 */
export function coverageFor(ruleId: string): Coverage | undefined {
	if (COVERED_BY_ID[ruleId]) return { status: 'COVERED', testFile: COVERED_BY_ID[ruleId] };
	return COVERAGE_BY_PREFIX[prefixOf(ruleId)];
}

/** Every concrete single-file test path the manifest cites (for the gate's on-disk existence check). Glob/multi
 *  descriptions are excluded — only real *.test.ts paths. */
export function citedConcreteTestFiles(): string[] {
	const files = new Set<string>();
	for (const f of Object.values(COVERED_BY_ID)) files.add(f);
	for (const c of Object.values(COVERAGE_BY_PREFIX))
		if (c.testFile && /\.test\.ts$/.test(c.testFile) && !/[*{}]/.test(c.testFile))
			files.add(c.testFile);
	return [...files];
}
