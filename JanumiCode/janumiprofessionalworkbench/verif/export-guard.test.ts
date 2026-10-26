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
 *
 * ⭑ AND A THIRD FINDING SINCE `REG-F-470`: a STALE RECORD — a guard gained, or a count of mutants crediting no export
 * moved, with the census not regenerated. It trips with neither of the other two, and the CLI refuses it, because a
 * field no check reads drifts silently: `handlers/execution.ts` recorded 18 through seven commits while the measured
 * value was 20, every gate green.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	attributeGuard,
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
		'packages/a/src/x.ts': {
			consumedExports: ['alpha', 'beta'],
			guardedExports: ['alpha', 'beta'],
			unattributedMutants: 0
		},
		'packages/b/src/y.ts': { consumedExports: ['gamma'], guardedExports: [], unattributedMutants: 1 }
	};

	it('passes when nothing moved', () => {
		expect(compareGuardCensus(BASE, BASE)).toEqual({
			guardLost: [],
			populationChanged: [],
			censusStale: []
		});
	});

	// ⚠ RETITLED 2026-10-26 (`REG-F-470`, at the integration of packages L2, M and N). It read *"passes when an
	// export GAINS a guard — it is a ratchet, not an equality"*, and the CHECK no longer passes on it: a gain the
	// baseline does not record is a guard the ratchet is not holding, so it is refused as a STALE RECORD until the
	// census is regenerated (the CENSUS_STALE tests below). What the old title pinned, and its assertion still pins,
	// is the RATCHET LIMB's direction: a gain is never reported as a lost guard.
	it('never reports a GAINED guard as a LOST one — the ratchet limb is one-directional', () => {
		const better: GuardCensus = {
			...BASE,
			'packages/b/src/y.ts': { consumedExports: ['gamma'], guardedExports: ['gamma'], unattributedMutants: 0 }
		};
		const r = compareGuardCensus(BASE, better);
		expect(r.guardLost).toEqual([]);
		expect(r.populationChanged).toEqual([]);
		expect(r.censusStale.join(' '), 'the gain is a stale record until regenerated').toContain(
			'packages/b/src/y.ts#gamma'
		);
	});

	// ── LIMB 1, ALONE — AND IT NAMES THE EXPORT ─────────────────────────────────────────────────────────────
	// ⭐ "this file has one fewer mutant" does not say what stopped being defended. This does.
	it('GUARD_LOST fires alone when ONE export loses its guard, and NAMES that export', () => {
		const worse: GuardCensus = {
			...BASE,
			'packages/a/src/x.ts': {
				consumedExports: ['alpha', 'beta'],
				guardedExports: ['alpha'],
				unattributedMutants: 0
			}
		};
		const r = compareGuardCensus(BASE, worse);
		expect(r.guardLost).toHaveLength(1);
		expect(r.guardLost[0]).toContain('packages/a/src/x.ts#beta');
		expect(r.populationChanged, 'a lost guard must not also report as a moved population').toEqual([]);
		expect(r.censusStale, 'a lost guard must not also report as a stale record').toEqual([]);
	});

	// ⛔ THE DEFECT THIS WHOLE REWORK EXISTS TO CATCH. Under the old per-FILE count, moving a guard from `beta`
	// onto `alpha` left the count at 2 and passed silently. Attribution makes it a named finding.
	it('GUARD_LOST fires when a guard MOVES between exports, which a per-file count could not see', () => {
		const moved: GuardCensus = {
			...BASE,
			'packages/a/src/x.ts': {
				consumedExports: ['alpha', 'beta'],
				guardedExports: ['alpha'],
				unattributedMutants: 1
			}
		};
		const r = compareGuardCensus(BASE, moved);
		expect(r.guardLost[0]).toContain('#beta');
	});

	// ── LIMB 2, ALONE, IN ITS THREE SHAPES ─────────────────────────────────────────────────────────────────
	it('POPULATION_CHANGED fires alone for a NEW file', () => {
		const added: GuardCensus = {
			...BASE,
			'packages/c/src/z.ts': { consumedExports: ['delta'], guardedExports: [], unattributedMutants: 0 }
		};
		const r = compareGuardCensus(BASE, added);
		expect(r.populationChanged.join(' ')).toContain('packages/c/src/z.ts');
		expect(r.guardLost).toEqual([]);
		expect(r.censusStale).toEqual([]);
	});

	it('POPULATION_CHANGED fires alone for a REMOVED file', () => {
		const fewer: GuardCensus = { 'packages/a/src/x.ts': BASE['packages/a/src/x.ts']! };
		const r = compareGuardCensus(BASE, fewer);
		expect(r.populationChanged.join(' ')).toContain('no longer measured');
		expect(r.guardLost).toEqual([]);
		expect(r.censusStale).toEqual([]);
	});

	it('POPULATION_CHANGED fires alone when a file’s consumed-export SET moves', () => {
		const renamed: GuardCensus = {
			...BASE,
			'packages/a/src/x.ts': {
				consumedExports: ['alpha', 'epsilon'],
				guardedExports: ['alpha', 'epsilon'],
				unattributedMutants: 0
			}
		};
		const r = compareGuardCensus(BASE, renamed);
		expect(r.populationChanged.join(' ')).toContain('production-consumed exports moved');
		// ⭑ A RENAMED EXPORT IS NOT A LOST GUARD. `beta` no longer exists, so claiming its guard was lost would
		// report a defect where there is only a rename — which is why limb 1 only considers exports still present.
		expect(r.guardLost).toEqual([]);
		// ⭑ NOR IS IT A GAINED ONE. `epsilon` is guarded now and the baseline never had it — a NEW export, so the
		// population limb's finding; the record limb asks only about exports the baseline already consumed.
		expect(r.censusStale).toEqual([]);
	});

	// ── LIMB 3, ALONE, IN ITS TWO SHAPES (`REG-F-470`) ─────────────────────────────────────────────────────
	// ⛔ NEITHER IS A REGRESSION, AND EACH IS REFUSED. GUARD_LOST asks only about what the baseline RECORDS as
	// guarded, so a gain it does not record could be lost again and nothing would say so; and a count no check
	// reads drifts silently.
	it('CENSUS_STALE fires alone when an export GAINS a guard the baseline does not record, and NAMES it', () => {
		const gained: GuardCensus = {
			...BASE,
			'packages/b/src/y.ts': { consumedExports: ['gamma'], guardedExports: ['gamma'], unattributedMutants: 1 }
		};
		const r = compareGuardCensus(BASE, gained);
		expect(r.censusStale).toHaveLength(1);
		expect(r.censusStale[0]).toContain('packages/b/src/y.ts#gamma');
		expect(r.censusStale[0]).toContain('the baseline records it as bare');
		expect(r.guardLost).toEqual([]);
		expect(r.populationChanged).toEqual([]);
	});

	it('CENSUS_STALE fires alone when a count of mutants crediting no export moves, EITHER way', () => {
		const drifted: GuardCensus = {
			'packages/a/src/x.ts': {
				consumedExports: ['alpha', 'beta'],
				guardedExports: ['alpha', 'beta'],
				unattributedMutants: 2
			},
			'packages/b/src/y.ts': { consumedExports: ['gamma'], guardedExports: [], unattributedMutants: 0 }
		};
		const r = compareGuardCensus(BASE, drifted);
		expect(r.censusStale).toHaveLength(2);
		// ⚠ BOTH DIRECTIONS. A count compared only for a RISE would pass the fall on `y.ts` — the
		// "ratchet, not an equality" instinct applied to a figure that is a record, not a floor.
		expect(r.censusStale[0]).toContain('packages/a/src/x.ts');
		expect(r.censusStale[0]).toContain('(0 -> 2)');
		expect(r.censusStale[1]).toContain('packages/b/src/y.ts');
		expect(r.censusStale[1]).toContain('(1 -> 0)');
		expect(r.guardLost).toEqual([]);
		expect(r.populationChanged).toEqual([]);
	});
});

// ── `REG-F-470` AT THE GATE: the CLI, not only the pure comparison ───────────────────────────────────────────
// ⛔ THE PURE FUNCTION CANNOT SHOW THE GATE REDDENS. `guards:export:check` is `gate:fast` step 2, and a limb the CLI
// computes and never reports is a gate that stays green on a stale census — the defect this limb closes.
// ⚠ THE FIXTURE IS THE COMMITTED BASELINE WITH ONE COUNT NO MEASUREMENT CAN GIVE (-1), and the assertion is that
// file's own line, so the case holds whatever else the measured tree differs in — a mutant applied elsewhere by the
// mutation runner included — and never asks the real repository to be clean.
describe('REG-F-470 — guards:export:check refuses a stale census', () => {
	const ROOT = fileURLToPath(new URL('..', import.meta.url));
	const SCRIPT = `${ROOT}scripts/export-guard.ts`;

	it('exits 1 and names the file whose recorded count the measurement does not give', () => {
		const baseline = JSON.parse(
			readFileSync(`${ROOT}verif/floors/export-guard.baseline.json`, 'utf8')
		) as { files: GuardCensus };
		const file = Object.keys(baseline.files).sort()[0]!;
		const stale = {
			...baseline,
			files: { ...baseline.files, [file]: { ...baseline.files[file]!, unattributedMutants: -1 } }
		};
		const dir = mkdtempSync(join(tmpdir(), 'jan-pfa-guard-'));
		const path = join(dir, 'export-guard.baseline.json');
		writeFileSync(path, JSON.stringify(stale));
		// ⚠ NO `shell: true`, as `tracker-census-freshness.test.ts` spawns `bun`: a shell spawn with an argument
		// array is deprecated in Node and concatenates rather than escapes.
		const r = spawnSync('bun', ['run', SCRIPT, '--check', `--baseline=${path}`], {
			cwd: ROOT,
			encoding: 'utf8',
			timeout: 120_000
		});
		const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
		expect(r.status, out).toBe(1);
		expect(out).toContain('guards:export — CENSUS_STALE');
		expect(out).toContain(`CENSUS_STALE  ${file}: mutants crediting no export moved (-1 -> `);
	}, 120_000);
});

describe('JAN-PFA R3 — outstandingObligation counts BARE EXPORTS, never a signed difference', () => {
	it('a surplus on one export cannot offset a bare one in the same file', () => {
		const census: GuardCensus = {
			'a.ts': { consumedExports: ['one', 'two', 'three'], guardedExports: ['one'], unattributedMutants: 9 }
		};
		const o = outstandingObligation(census);
		// ⛔ 2, NOT -7. Nine mutants piled anywhere in the file discharge exactly the ONE export they anchor in.
		// Under the previous per-file count this file reported "owes 0" — the averaging defect this entire
		// programme exists to remove, reappearing inside the instrument that measures it.
		expect(o.owed).toBe(2);
		expect(o.guardedExports).toBe(1);
		expect(o.unattributedMutants).toBe(9);
	});

	it('counts a file with no guarded export, even when it carries unattributed mutants', () => {
		const census: GuardCensus = {
			'a.ts': { consumedExports: ['one'], guardedExports: [], unattributedMutants: 4 }
		};
		// ⚠ FOUR GUARDS AND STILL WHOLLY UNGUARDED: they defend internal logic, and nothing says which promise.
		expect(outstandingObligation(census).filesWithNoGuard).toBe(1);
		expect(outstandingObligation(census).owed).toBe(1);
	});
});

describe('JAN-PFA R3 — attributeGuard is the function that ended fungibility', () => {
	const SPANS = [
		{ name: 'first', startLine: 10, endLine: 20 },
		{ name: 'second', startLine: 30, endLine: 40 }
	];

	it('credits the export whose declaration CONTAINS the anchor', () => {
		expect(attributeGuard(SPANS, 15)).toEqual(['first']);
		expect(attributeGuard(SPANS, 35)).toEqual(['second']);
	});

	it('credits on either boundary — a declaration’s first and last lines are part of it', () => {
		expect(attributeGuard(SPANS, 10)).toEqual(['first']);
		expect(attributeGuard(SPANS, 20)).toEqual(['first']);
	});

	// ⛔ THE HONEST EMPTY ANSWER. A mutant anchored in module-level code or a private helper defends real
	// behaviour, but nothing says WHICH promise — and crediting it to a nearby export would restore exactly the
	// fungibility attribution exists to remove. Measured: 58 of the repository's mutants land here.
	it('credits NOTHING for an anchor between declarations, rather than guessing the nearest', () => {
		expect(attributeGuard(SPANS, 25)).toEqual([]);
		expect(attributeGuard(SPANS, 5)).toEqual([]);
		expect(attributeGuard(SPANS, 99)).toEqual([]);
	});

	// ⚠ `export const a = 1, b = 2;` is ONE statement, so both names own the same lines. Returning the FIRST
	// match would silently pick one of two equally-entitled owners.
	it('credits EVERY export that owns the line, not the first one found', () => {
		const shared = [
			{ name: 'a', startLine: 7, endLine: 7 },
			{ name: 'b', startLine: 7, endLine: 7 }
		];
		expect(attributeGuard(shared, 7)).toEqual(['a', 'b']);
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
