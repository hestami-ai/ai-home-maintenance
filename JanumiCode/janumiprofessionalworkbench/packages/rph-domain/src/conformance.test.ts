// M12 executable conformance suite — the accounting GATE over the full RPH-* catalog (Conformance Spec §3:
// 7 layers, 125 rules, Properties P1–P8). It loads the grounded catalog from vocab/m12-conformance.json and
// asserts that EVERY rule maps to a coverage status and every property has a property test — a rule that
// resolves to UNACCOUNTED fails this test (the "CI fails on any single invariant violation" goal). This is the
// mechanism that keeps the per-layer kernel tests honest as the suite grows.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	citedConcreteTestFiles,
	coverageFor,
	DEFERRABLE_PREFIXES,
	prefixOf,
	PROPERTY_COVERAGE,
	type CoverageStatus
} from './conformance-manifest.js';

interface Rule {
	readonly id: string;
	readonly statement: string;
	readonly layer: number;
	readonly sourceRef: string;
}
interface Catalog {
	readonly layers: readonly { n: number; name: string }[];
	readonly ruleCatalog: readonly Rule[];
	readonly ruleCountsByPrefix: Readonly<Record<string, number>>;
	readonly properties: readonly { id: string; name: string }[];
	readonly mutationCatalog: readonly unknown[];
}

const catalog = JSON.parse(
	readFileSync(new URL('../vocab/m12-conformance.json', import.meta.url), 'utf8')
) as Catalog;

describe('M12 conformance catalog structure (§3 taxonomy)', () => {
	it('defines the 7 test layers, 125 rules, 8 properties, and a mutation catalog', () => {
		expect(catalog.layers).toHaveLength(7);
		expect(catalog.ruleCatalog).toHaveLength(125);
		expect(catalog.properties.map((p) => p.id).sort()).toEqual([
			'P1',
			'P2',
			'P3',
			'P4',
			'P5',
			'P6',
			'P7',
			'P8'
		]);
		expect(catalog.mutationCatalog.length).toBeGreaterThan(0);
	});

	it('the per-prefix rule counts sum to the catalog total', () => {
		const declared = Object.entries(catalog.ruleCountsByPrefix)
			.filter(([k]) => k !== '_total')
			.reduce((s, [, n]) => s + n, 0);
		expect(declared).toBe(125);
		// and the catalog rows agree with the declared per-prefix counts
		for (const [prefix, n] of Object.entries(catalog.ruleCountsByPrefix)) {
			if (prefix === '_total') continue;
			const actual = catalog.ruleCatalog.filter((r) => r.id.startsWith(prefix + '-')).length;
			expect(actual, `${prefix}`).toBe(n);
		}
	});

	it('every rule cites a layer in 1..7', () => {
		for (const r of catalog.ruleCatalog) expect(r.layer, r.id).toBeGreaterThanOrEqual(1);
		for (const r of catalog.ruleCatalog) expect(r.layer, r.id).toBeLessThanOrEqual(7);
	});
});

describe('M12 conformance coverage GATE — no rule is silently unaccounted', () => {
	it('EVERY RPH-* rule resolves to a coverage status (fails CI on any unaccounted rule)', () => {
		const unaccounted = catalog.ruleCatalog
			.filter((r) => coverageFor(r.id) === undefined)
			.map((r) => r.id);
		expect(unaccounted, `unaccounted rules: ${unaccounted.join(', ')}`).toEqual([]);
	});

	it('every Property P1–P8 is bound to a property test', () => {
		for (const p of catalog.properties)
			expect(PROPERTY_COVERAGE[p.id], `${p.id} (${p.name})`).toBeDefined();
	});

	it('the covered/partial/deferred split is explicit and every non-COVERED rule carries a reason', () => {
		const byStatus: Record<CoverageStatus, number> = {
			COVERED: 0,
			PROPERTY: 0,
			PARTIAL: 0,
			DEFERRED: 0
		};
		for (const r of catalog.ruleCatalog) {
			const c = coverageFor(r.id)!;
			byStatus[c.status]++;
			if (c.status !== 'COVERED')
				expect(
					c.note,
					`${r.id} (${c.status}) must document what is covered vs pending`
				).toBeTruthy();
			// nothing sneaks into DEFERRED except the legitimately-deferred families (M13 replay / MP migration).
			if (c.status === 'DEFERRED')
				expect(
					DEFERRABLE_PREFIXES.has(prefixOf(r.id)),
					`${r.id} deferred but not a deferrable family`
				).toBe(true);
		}
		// ── THE COVERED COUNT, RE-EXPRESSED 2026-08-02 ────────────────────────────────────────────────────────
		//
		// This read `expect(byStatus.COVERED).toBeGreaterThanOrEqual(40)`, above the comment "the fully-by-id
		// kernel families (RPH-DEC/CNS/ASM/GOV/BAS/EXE = 40 rules) are the executably-COVERED floor". Four of
		// those five families were then dispositioned rule-by-rule in the enforcement register and shown NOT to be
		// executably covered: RPH-GOV, RPH-BAS, RPH-ASM and RPH-DEC were each COVERED "by id" on a PURE_KERNEL
		// test file, and each holds at least one rule the running engine enforces nowhere. RPH-CNS was re-stated
		// alongside them. So the floor asserted the very claim the register disproved, and it fired — correctly —
		// the moment the record was made honest.
		//
		// A FLOOR THAT IS LOWERED WHENEVER IT FIRES IS NOT A RATCHET, so it is not lowered. It is replaced by an
		// EXACT count, which fails in BOTH directions: coverage silently regressing still reddens, and coverage
		// legitimately growing also reddens, so the number can only move by a deliberate, reviewable edit that
		// says which rules moved and why. That is the same trade the enforcement register makes throughout —
		// convert a silent change into a justification-bearing one.
		//
		// WHAT THE OLD ASSERTION WAS PROTECTING IS NOT LOST: "coverage must not silently regress" is exactly what
		// an exact count enforces, and more strictly. What it can no longer do is protect a NUMBER that was only
		// ever true because four families were certified on evidence that could not see enforcement.
		expect(
			byStatus.COVERED,
			'the COVERED count changed — say which rules moved and why, in this comment, before editing the number'
		).toBe(31);
		expect(byStatus.DEFERRED).toBeLessThan(byStatus.COVERED);
	});

	it('every concrete test file the manifest cites exists on disk (a COVERED claim must point at a real test)', () => {
		const repoRoot = new URL('../../../', import.meta.url); // packages/rph-domain/src -> repo root
		for (const rel of citedConcreteTestFiles()) {
			const abs = new URL(rel, repoRoot);
			expect(existsSync(abs), `cited test file missing: ${rel}`).toBe(true);
		}
	});
});
