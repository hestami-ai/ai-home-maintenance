/**
 * W-1's gate: the ingest is checked against INDEPENDENT readers of the same documents.
 *
 * The roadmap's rule: "a disagreement between two independent parsers of the same file is a
 * finding, not a formatting nit." Every assertion here derives its expectation from the SOURCE
 * DOCUMENT with a deliberately minimal second parser (a one-regex census), never from the ingest's
 * own output — so the two can genuinely disagree, and a drift in either direction goes red.
 *
 * Real-tree, not fixtures, ON PURPOSE: this suite pins the live populations the way the register's
 * own gates do. When the register gains an entry, the CROSS-CHECKS still pass (both readers move
 * together); only a PARSER defect can split them. The few absolute pins (struck ids, the one
 * undefined ref) are facts the register itself records in prose, cited at each assertion.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER = readFileSync(
	join(REPO, 'docs', 'canon', 'JPWB-REG-005 Decision and Divergence Register.md'),
	'utf8'
);

function bunCli(script: string, args: readonly string[]): { code: number; out: string } {
	const result = spawnSync('bun', [join(REPO, 'scripts', 'tracker', script), ...args], {
		cwd: REPO,
		encoding: 'utf8',
		timeout: 120_000
	});
	return { code: result.status ?? -1, out: result.stdout ?? '' };
}

function sql<T>(statement: string): T[] {
	const result = bunCli('query.ts', ['sql', statement]);
	expect(result.code, result.out).toBe(0);
	return (JSON.parse(result.out) as { rows: T[] }).rows;
}

beforeAll(() => {
	// The suite exercises the REAL build, so a parser regression cannot hide behind a stale DB.
	expect(bunCli('build.ts', []).code).toBe(0);
});

describe('tracker ingest (W-1) — two independent readers must agree', () => {
	it('register heading census: the ingest count equals an independent one-regex count', () => {
		const independent = [...REGISTER.matchAll(/^### (?:~~)?REG-[A-Z]-\d+/gm)].length;
		const ingested = sql<{ n: number }>(
			"SELECT COUNT(*) AS n FROM attrs WHERE key = 'grammar' AND value = 'heading'"
		)[0]!.n;
		expect(ingested).toBe(independent);
	});

	it('struck headers: the ingest marks exactly the ids an independent scan finds struck', () => {
		const independent = [...REGISTER.matchAll(/^### ~~(REG-[A-Z]-\d+)~~/gm)]
			.map((m) => `reg:${m[1]!}`)
			.sort();
		const ingested = sql<{ item_id: string }>(
			"SELECT item_id FROM attrs WHERE key = 'struck' ORDER BY item_id"
		).map((r) => r.item_id);
		expect(ingested).toEqual(independent);
		// The register records three struck entries (F-105, F-106, F-108) — if this moves, BOTH
		// readers moved together and the register itself changed; that is not a parser defect.
		expect(independent.length).toBeGreaterThanOrEqual(3);
	});

	it('the REG-E-022 collision is carried as two items, disambiguated, never merged', () => {
		const ids = sql<{ id: string }>(
			"SELECT id FROM items WHERE id LIKE 'reg:REG-E-022%' ORDER BY id"
		).map((r) => r.id);
		expect(ids).toEqual(['reg:REG-E-022', 'reg:REG-E-022@2']);
	});

	it('E-bullet census: every id E-001..E-031 is ingested exactly once (plus the collision twin)', () => {
		const ids = sql<{ id: string }>(
			"SELECT id FROM items i WHERE EXISTS (SELECT 1 FROM attrs a WHERE a.item_id = i.id AND a.key = 'grammar' AND a.value = 'bullet') ORDER BY id"
		).map((r) => r.id);
		const expected = Array.from(
			{ length: 31 },
			(_, i) => `reg:REG-E-${String(i + 1).padStart(3, '0')}`
		);
		expected.push('reg:REG-E-022@2');
		expect(ids).toEqual(expected.sort());
	});

	it('the reference graph closes except the one hole the register itself records', () => {
		// REG-F-115 is "a DELIBERATE hole — allocated only in a commit message"; the register's own
		// safe default is that such an id is not an entry. Everything else must resolve. (REG-F-998,
		// the gate's test fixture, is correctly ABSENT here: it appears only inside backticks, and
		// mention extraction strips code spans — the REG-F-113 rule applied to references.)
		const undefinedRefs = sql<{ to_id: string }>(
			'SELECT DISTINCT to_id FROM refs WHERE to_id NOT IN (SELECT id FROM items) ORDER BY to_id'
		).map((r) => r.to_id);
		expect(undefinedRefs).toEqual(['reg:REG-F-115']);
	});

	it('audit-roster verdicts: the ingest distribution equals an independent scan of the artifact', () => {
		const artifact = readFileSync(
			join(REPO, 'docs', '_working', 'AUDIT-shape-survivorship-2026-08-20.md'),
			'utf8'
		);
		const independent = new Map<string, number>();
		for (const m of artifact.matchAll(
			/^\|[^|]+\| (ENFORCED|REFERENCE_NO_FIXTURE|PLACEHOLDER|DIVERGENT_FILED|DIVERGENT_UNFILED|ABSENT) \|/gm
		))
			independent.set(m[1]!, (independent.get(m[1]!) ?? 0) + 1);
		const ingested = sql<{ verdict: string; n: number }>(
			"SELECT verdict, COUNT(*) AS n FROM verdicts WHERE method = 'REG-F-197 shape-survivorship audit' GROUP BY verdict"
		);
		expect(Object.fromEntries(ingested.map((r) => [r.verdict, r.n]))).toEqual(
			Object.fromEntries(independent)
		);
		// And the roster total is the REG-F-197 population — the roster that must not become a count.
		expect([...independent.values()].reduce((a, b) => a + b, 0)).toBe(247);
	});

	it('tracker rows: the ingest count equals an independent census of bold milestone cells', () => {
		const tracker = readFileSync(
			join(REPO, 'docs', 'JPWB Implementation Roadmap and Tracker.md'),
			'utf8'
		);
		const independent = new Set(
			[...tracker.matchAll(/^\|\s*\*\*(M\d+[a-z]?|MP)\*\*\s*\|/gm)].map((m) => m[1]!)
		).size;
		const ingested = sql<{ n: number }>(
			"SELECT COUNT(*) AS n FROM items WHERE kind = 'tracker-row'"
		)[0]!.n;
		expect(ingested).toBe(independent);
		expect(ingested).toBeGreaterThanOrEqual(16);
	});

	it('R1 dispositions come only from AMENDED annotations, never from checkboxes', () => {
		// The sheet was executed wholesale-interim with every ☐ unmarked (REG-D-010), so any
		// checkbox-derived disposition would be wrong 72 times out of 72. Every disposition the
		// ingest carries must therefore cite an amending act in the ratified form.
		const dispositions = sql<{ value: string }>(
			"SELECT a.value FROM attrs a JOIN items i ON i.id = a.item_id WHERE a.key = 'disposition' AND i.id LIKE 'sheet:r1:%'"
		).map((r) => r.value);
		expect(dispositions.length).toBeGreaterThanOrEqual(2);
		for (const value of dispositions)
			expect(value).toMatch(/^AMENDED \d{4}-\d{2}-\d{2} \(REG-[A-Z]-\d+\)$/);
	});

	it('backlog items carry content-derived ids, so reordering the file moves nothing', () => {
		const ids = sql<{ id: string }>("SELECT id FROM items WHERE kind = 'backlog-item'").map(
			(r) => r.id
		);
		expect(ids.length).toBeGreaterThan(0);
		for (const id of ids) expect(id).toMatch(/^backlog:[0-9a-f]{12}$/);
	});
});
