/**
 * JAN-PFA `R1` / `S1.2` — the per-file coverage ratchet's two limbs, driven in ISOLATION.
 *
 * WHY FIXTURES RATHER THAN THE REAL COVERAGE RUN. The gate step exercises `--check` against the repository's
 * actual summary, and that is a single pass/fail over 106 files. It cannot show that the RATCHET limb and the
 * POPULATION limb fail SEPARATELY — and two limbs that always fail together are one check wearing two names
 * (`REG-F-099`'s recorded shape), which is exactly what a per-file mechanism must not be. Each case below moves
 * ONE thing and asserts both what reddens and what stays green.
 *
 * ⚠ THE MOST IMPORTANT CASE IS THE LAST PAIR, NOT THE FIRST. A checker that treats a MISSING or EMPTY input as
 * success is the control-that-cannot-fail this repository keeps recording, and this checker runs immediately
 * after `test:coverage` — precisely where "the coverage run did not happen" is a live possibility.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = `${ROOT}scripts/coverage-floor.ts`;

type Metric = 'statements' | 'branches' | 'functions' | 'lines';
const METRICS: readonly Metric[] = ['statements', 'branches', 'functions', 'lines'];

/** An istanbul-shaped summary entry with a chosen number of uncovered units per metric. */
const entry = (uncovered: Partial<Record<Metric, number>>) =>
	Object.fromEntries(
		METRICS.map((m) => [m, { total: 10, covered: 10 - (uncovered[m] ?? 0), skipped: 0, pct: 0 }])
	);

interface Run {
	readonly status: number;
	readonly out: string;
}

/** Writes a fixture pair into a private temp dir and runs one mode against it. */
function runCheck(
	summary: Record<string, unknown> | null,
	baseline: Record<string, unknown> | null
): Run {
	const dir = mkdtempSync(join(tmpdir(), 'jan-pfa-floor-'));
	const summaryPath = join(dir, 'coverage-summary.json');
	const baselinePath = join(dir, 'baseline.json');
	if (summary !== null) writeFileSync(summaryPath, JSON.stringify(summary));
	if (baseline !== null) writeFileSync(baselinePath, JSON.stringify(baseline));
	const r = spawnSync(
		'bun',
		['run', SCRIPT, '--check', `--summary=${summaryPath}`, `--baseline=${baselinePath}`],
		{ cwd: ROOT, encoding: 'utf8', shell: true }
	);
	return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const baselineOf = (files: Record<string, Partial<Record<Metric, number>>>) => ({
	note: 'fixture',
	generator: 'fixture',
	files: Object.fromEntries(
		Object.entries(files).map(([f, u]) => [
			f,
			Object.fromEntries(METRICS.map((m) => [m, u[m] ?? 0]))
		])
	)
});

const summaryOf = (files: Record<string, Partial<Record<Metric, number>>>) =>
	Object.fromEntries([
		['total', entry({})],
		...Object.entries(files).map(([f, u]) => [f, entry(u)])
	]);

describe('JAN-PFA R1 — the per-file coverage ratchet fails on the right limb', () => {
	const TWO_FILES = { 'packages/a/src/x.ts': { branches: 3 }, 'packages/b/src/y.ts': { lines: 1 } };

	it('passes when every file is at or below its recorded uncovered counts', () => {
		const r = runCheck(summaryOf(TWO_FILES), baselineOf(TWO_FILES));
		expect(r.status).toBe(0);
		expect(r.out).toContain('no uncovered count rose');
		expect(r.out).toContain('population unchanged');
	});

	it('passes when a file IMPROVES — the ratchet is a ceiling, not an equality', () => {
		const improved = { ...TWO_FILES, 'packages/a/src/x.ts': { branches: 1 } };
		const r = runCheck(summaryOf(improved), baselineOf(TWO_FILES));
		expect(r.status).toBe(0);
	});

	// ── LIMB 1, ALONE ───────────────────────────────────────────────────────────────────────────────────────
	it('FLOOR_REGRESSED fires alone when one file gains an uncovered branch, and NAMES it', () => {
		const worse = { ...TWO_FILES, 'packages/a/src/x.ts': { branches: 4 } };
		const r = runCheck(summaryOf(worse), baselineOf(TWO_FILES));
		expect(r.status).toBe(1);
		expect(r.out).toContain('FLOOR_REGRESSED');
		// ⭑ NAMED, never a bare count: file, metric, baseline and measured value all appear.
		expect(r.out).toContain('packages/a/src/x.ts');
		expect(r.out).toContain('branches: 3 uncovered at baseline, 4 now');
		// ⛔ AND THE OTHER LIMB STAYS SILENT. The population is identical, so a POPULATION_CHANGED line here
		// would mean the two limbs are one check.
		expect(r.out).not.toContain('POPULATION_CHANGED');
	});

	// ── LIMB 2, ALONE ───────────────────────────────────────────────────────────────────────────────────────
	it('POPULATION_CHANGED fires alone for a NEW measured file, and NAMES it', () => {
		const withNew = { ...TWO_FILES, 'packages/c/src/z.ts': { branches: 9 } };
		const r = runCheck(summaryOf(withNew), baselineOf(TWO_FILES));
		expect(r.status).toBe(1);
		expect(r.out).toContain('POPULATION_CHANGED');
		expect(r.out).toContain('packages/c/src/z.ts');
		// ⭑ THE HOLE THIS LIMB EXISTS TO CLOSE: a brand-new file carrying 9 uncovered branches cannot regress
		// against a baseline that has never heard of it, so limb 1 has nothing to say and MUST stay silent.
		expect(r.out).not.toContain('FLOOR_REGRESSED');
	});

	it('POPULATION_CHANGED fires alone for a file that has VANISHED from the measurement', () => {
		const fewer = { 'packages/a/src/x.ts': { branches: 3 } };
		const r = runCheck(summaryOf(fewer), baselineOf(TWO_FILES));
		expect(r.status).toBe(1);
		expect(r.out).toContain('packages/b/src/y.ts');
		expect(r.out).toContain('no longer measured');
		expect(r.out).not.toContain('FLOOR_REGRESSED');
	});

	// ── THE BLINDED READER, WHICH IS THE CASE THAT MATTERS MOST ─────────────────────────────────────────────
	it('a MISSING coverage summary FAILS LOUDLY — never "nothing to check"', () => {
		const r = runCheck(null, baselineOf(TWO_FILES));
		expect(r.status, 'an absent summary was treated as a pass').not.toBe(0);
		expect(r.out).toContain('MISSING COVERAGE SUMMARY');
		expect(r.out).toContain('which is a FAILURE, not an all-clear');
	});

	it('a MISSING baseline FAILS LOUDLY — an absent baseline is not an empty one', () => {
		const r = runCheck(summaryOf(TWO_FILES), null);
		expect(r.status).not.toBe(0);
		expect(r.out).toContain('MISSING BASELINE');
	});

	it('a summary reporting ZERO files is REFUSED, because it would make every per-file claim vacuous', () => {
		const r = runCheck({ total: entry({}) }, baselineOf(TWO_FILES));
		expect(r.status).not.toBe(0);
		expect(r.out).toContain('ZERO files');
	});
});

describe('JAN-PFA R1 — the committed baseline is the one the repository actually measures', () => {
	const BASELINE = `${ROOT}verif/floors/per-file-floor.baseline.json`;

	it('is DERIVED and says so, so a hand edit reads as the defect it is', () => {
		const b = JSON.parse(readFileSync(BASELINE, 'utf8')) as {
			note: string;
			generator: string;
			files: Record<string, Record<Metric, number>>;
		};
		expect(b.generator).toBe('scripts/coverage-floor.ts --write');
		expect(b.note).toContain('never hand-edited');
	});

	it('records UNCOVERED COUNTS, not percentages — every value is a non-negative integer', () => {
		const b = JSON.parse(readFileSync(BASELINE, 'utf8')) as {
			files: Record<string, Record<Metric, number>>;
		};
		const files = Object.entries(b.files);
		// ⛔ VACUITY CONTROL: an empty baseline would satisfy the loop below while asserting nothing, and it is
		// exactly what a broken writer produces.
		expect(files.length).toBeGreaterThan(50);
		for (const [file, counts] of files) {
			for (const metric of METRICS) {
				const v = counts[metric];
				expect(Number.isInteger(v), `${file}.${metric} is not an integer`).toBe(true);
				expect(v, `${file}.${metric} is negative`).toBeGreaterThanOrEqual(0);
			}
		}
	});
});
