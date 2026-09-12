/**
 * JAN-PFA `R3` / `S3.2` — the export-guard ratchet's limbs and predicates, driven on fixtures.
 *
 * ⭑ THE UNIT UNDER TEST IS A JUDGMENT, NOT AN ARITHMETIC. Three decisions here changed the obligation by
 * hundreds of exports between them, and each was wrong once:
 *   · what counts as a CONSUMER  — counting colocated tests as production inflated it;
 *   · what counts as a FILE      — generated sources carried 121 exports whose guarantee lives in a generator;
 *   · what counts as a FINDING   — a lost guard and a moved population must not trip together.
 * A census whose predicates are untested is a number nobody can defend, and this programme has already had to
 * withdraw two.
 */
import { describe, expect, it } from 'vitest';
import {
	compareGuardCensus,
	isGeneratedSource,
	isProductionConsumer,
	outstandingObligation,
	type GuardCensus
} from '../scripts/export-guard-core.js';

describe('JAN-PFA R3 — isProductionConsumer asks a RELATIONAL question', () => {
	it('admits ordinary production modules, in packages and apps alike', () => {
		expect(isProductionConsumer('/repo/packages/rph-domain/src/governance.ts')).toBe(true);
		expect(isProductionConsumer('/repo/apps/rph-demo/src/lib/pwaFlow.ts')).toBe(true);
	});

	// ⚠ THE REGRESSION THAT MATTERS. The first predicate asked "is this under packages/?" — an INTRINSIC
	// property — and so counted a colocated test as a production consumer, inflating the obligation by ~50.
	it('rejects a COLOCATED test file, which is the defect the first version shipped', () => {
		expect(isProductionConsumer('/repo/packages/rph-domain/src/governance.test.ts')).toBe(false);
		expect(isProductionConsumer('/repo/packages/rph-domain/src/governance.spec.ts')).toBe(false);
	});

	it('rejects tooling — verif/ and scripts/ are instruments, not consumers of a promise', () => {
		expect(isProductionConsumer('/repo/verif/assurance-surface.test.ts')).toBe(false);
		expect(isProductionConsumer('/repo/scripts/mutants/run.ts')).toBe(false);
	});
});

describe('JAN-PFA R3 — isGeneratedSource reads the file’s own banner', () => {
	it('recognises the repository’s generated banner', () => {
		expect(isGeneratedSource('// GENERATED FILE — do not edit by hand.\nimport { z } from "zod";')).toBe(
			true
		);
	});

	it('does NOT match a file that merely mentions generation in prose', () => {
		expect(
			isGeneratedSource('// This module is consumed by the GENERATED FILE emitter.\nexport const x = 1;')
		).toBe(false);
	});

	// ⛔ A banner buried a thousand lines down is not a banner. Bounding the read stops a passing mention deep
	// in a hand-written file from silently excusing it from the obligation.
	it('only looks at the head of the file', () => {
		expect(isGeneratedSource(`${'\n'.repeat(400)}// GENERATED FILE — do not edit by hand.`)).toBe(false);
	});
});

describe('JAN-PFA R3 — compareGuardCensus keeps a LOST GUARD apart from a MOVED POPULATION', () => {
	const BASE: GuardCensus = {
		'packages/a/src/x.ts': { consumedExports: ['alpha', 'beta'], mutants: 2 },
		'packages/b/src/y.ts': { consumedExports: ['gamma'], mutants: 0 }
	};

	it('passes when nothing moved', () => {
		expect(compareGuardCensus(BASE, BASE)).toEqual({ guardLost: [], populationChanged: [] });
	});

	it('passes when a file GAINS a guard — it is a ratchet, not an equality', () => {
		const better: GuardCensus = { ...BASE, 'packages/b/src/y.ts': { consumedExports: ['gamma'], mutants: 1 } };
		expect(compareGuardCensus(BASE, better).guardLost).toEqual([]);
	});

	// ── LIMB 1, ALONE ───────────────────────────────────────────────────────────────────────────────────────
	it('GUARD_LOST fires alone when a file sheds a declared guard, and NAMES the numbers', () => {
		const worse: GuardCensus = { ...BASE, 'packages/a/src/x.ts': { consumedExports: ['alpha', 'beta'], mutants: 1 } };
		const r = compareGuardCensus(BASE, worse);
		expect(r.guardLost).toHaveLength(1);
		expect(r.guardLost[0]).toContain('packages/a/src/x.ts');
		expect(r.guardLost[0]).toContain('2 declared guard(s) at baseline, 1 now');
		expect(r.populationChanged, 'a lost guard must not also report as a moved population').toEqual([]);
	});

	// ── LIMB 2, ALONE, IN ALL THREE OF ITS SHAPES ───────────────────────────────────────────────────────────
	it('POPULATION_CHANGED fires alone for a NEW file', () => {
		const added: GuardCensus = { ...BASE, 'packages/c/src/z.ts': { consumedExports: ['delta'], mutants: 0 } };
		const r = compareGuardCensus(BASE, added);
		expect(r.populationChanged.join(' ')).toContain('packages/c/src/z.ts');
		// ⭑ A NEW FILE HAS NO RECORDED GUARD COUNT TO FALL BELOW, so limb 1 is structurally silent and this is
		// the only limb that can see it — the same hole the coverage ratchet's population limb exists to close.
		expect(r.guardLost).toEqual([]);
	});

	it('POPULATION_CHANGED fires alone for a REMOVED file', () => {
		const fewer: GuardCensus = { 'packages/a/src/x.ts': BASE['packages/a/src/x.ts']! };
		const r = compareGuardCensus(BASE, fewer);
		expect(r.populationChanged.join(' ')).toContain('no longer measured');
		expect(r.guardLost).toEqual([]);
	});

	it('POPULATION_CHANGED fires alone when a file’s consumed-export SET moves', () => {
		const moved: GuardCensus = { ...BASE, 'packages/a/src/x.ts': { consumedExports: ['alpha', 'epsilon'], mutants: 2 } };
		const r = compareGuardCensus(BASE, moved);
		expect(r.populationChanged.join(' ')).toContain('production-consumed exports moved');
		expect(r.guardLost).toEqual([]);
	});

	// ⚠ A RENAME AT EQUAL COUNT IS STILL A MOVE. Comparing only lengths would let a guarded export be swapped
	// for an unguarded one with the obligation unchanged and nothing said.
	it('detects a RENAME that leaves the count identical', () => {
		const renamed: GuardCensus = { ...BASE, 'packages/a/src/x.ts': { consumedExports: ['alpha', 'renamed'], mutants: 2 } };
		expect(compareGuardCensus(BASE, renamed).populationChanged).toHaveLength(1);
	});
});

describe('JAN-PFA R3 — outstandingObligation is DERIVED, never quoted', () => {
	it('counts the shortfall per file and never lets a surplus offset a deficit', () => {
		const census: GuardCensus = {
			'a.ts': { consumedExports: ['one'], mutants: 5 }, // surplus of 4
			'b.ts': { consumedExports: ['one', 'two', 'three'], mutants: 0 } // owes 3
		};
		const o = outstandingObligation(census);
		// ⛔ 3, NOT -1. A file carrying extra guards does not discharge another file's promise — that is the
		// averaging defect this entire programme exists to remove, and it would reappear here as a sum.
		expect(o.owed).toBe(3);
		expect(o.filesWithNoGuard).toBe(1);
		expect(o.consumedExports).toBe(4);
		expect(o.mutants).toBe(5);
	});
});

describe('JAN-PFA R3 — the committed census is derived and well-formed', () => {
	it('declares its generator and its hand-edit prohibition', async () => {
		const baseline = (await import('./floors/export-guard.baseline.json', {
			with: { type: 'json' }
		})) as unknown as { default: { note: string; generator: string; files: GuardCensus } };
		const b = baseline.default;
		expect(b.generator).toBe('scripts/export-guard.ts --write');
		expect(b.note).toContain('never hand-edited');
		// ⛔ VACUITY CONTROL: an empty census satisfies every comparison above while asserting nothing.
		expect(Object.keys(b.files).length).toBeGreaterThan(50);
	});
});
