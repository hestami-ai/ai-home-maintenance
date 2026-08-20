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

describe('capability census, code-side (W-2) — the second reader is module EXECUTION', () => {
	// The strongest independent reader available: import the actual modules under Node and compare
	// against what the bun-side regex parser ingested. A drift in either — the code, or the parser —
	// splits the pair. ⚠ This is also the check that retired a stale claim on day one: the command
	// map holds 102 entries, not the 84 the dispatch census's header prose still says (that suite
	// asserts only a `> 50` floor, so its prose rotted while the floor slept).
	it('commands: the ingest matches Object.keys(COMMANDS) exactly, id for id', async () => {
		const { COMMANDS } = await import('@janumipwb/rph-contracts');
		const executed = Object.keys(COMMANDS)
			.map((k) => `cap:command:${k}`)
			.sort();
		const ingested = sql<{ id: string }>(
			"SELECT id FROM items WHERE id LIKE 'cap:command:%' ORDER BY id"
		).map((r) => r.id);
		expect(ingested).toEqual(executed);
		expect(ingested.length).toBeGreaterThanOrEqual(102);
	});

	it('machines: the ingest matches Object.keys(STATE_MACHINES) exactly', async () => {
		const { STATE_MACHINES } = await import('@janumipwb/rph-domain');
		const executed = Object.keys(STATE_MACHINES)
			.map((k) => `cap:machine:${k}`)
			.sort();
		const ingested = sql<{ id: string }>(
			"SELECT id FROM items WHERE id LIKE 'cap:machine:%' ORDER BY id"
		).map((r) => r.id);
		expect(ingested).toEqual(executed);
		expect(ingested).toHaveLength(27);
	});

	it('rules: the ingest matches m12-conformance.json ruleCatalog exactly', () => {
		const catalog = (
			JSON.parse(
				readFileSync(join(REPO, 'packages', 'rph-domain', 'vocab', 'm12-conformance.json'), 'utf8')
			) as { ruleCatalog: { id: string }[] }
		).ruleCatalog;
		const independent = catalog.map((r) => `cap:rule:${r.id}`).sort();
		const ingested = sql<{ id: string }>(
			"SELECT id FROM items WHERE id LIKE 'cap:rule:%' ORDER BY id"
		).map((r) => r.id);
		expect(ingested).toEqual(independent);
		expect(ingested).toHaveLength(125);
	});

	it('policies: the ingest matches the distinct POL ids of the seeded ontology', () => {
		const ontology = readFileSync(
			join(REPO, 'packages', 'rph-product-realization-pwa', 'src', 'ontology.data.ts'),
			'utf8'
		);
		const independent = [
			...new Set([...ontology.matchAll(/\bPOL-[A-Z][A-Z-]+\b/g)].map((m) => m[0]))
		]
			.map((p) => `cap:policy:${p}`)
			.sort();
		const ingested = sql<{ id: string }>(
			"SELECT id FROM items WHERE id LIKE 'cap:policy:%' ORDER BY id"
		).map((r) => r.id);
		expect(ingested).toEqual(independent);
		expect(ingested).toHaveLength(12);
	});

	it('every census-record anchor still occurs in its source document', () => {
		// The census NDJSON's anchors are its ONLY tie back to the corpus — the mutation ledger's
		// anchor law, applied to records: an anchor that no longer occurs means the doc moved under
		// the roster, and the record must be superseded, not silently tolerated. Whitespace is
		// collapsed on both sides; nothing else is normalized (a paraphrase must fail).
		const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();
		const docCache = new Map<string, string>();
		const rows = sql<{ id: string; anchor_doc: string | null; anchor_text: string | null }>(
			"SELECT id, anchor_doc, anchor_text FROM items WHERE origin LIKE 'census:%'"
		);
		for (const row of rows) {
			if (row.anchor_doc === null || row.anchor_text === null) continue;
			if (!docCache.has(row.anchor_doc))
				docCache.set(row.anchor_doc, collapse(readFileSync(join(REPO, row.anchor_doc), 'utf8')));
			expect(
				docCache.get(row.anchor_doc)!.includes(collapse(row.anchor_text)),
				`${row.id}: anchor no longer occurs in ${row.anchor_doc}`
			).toBe(true);
		}
	});

	it('every code-side capability carries exactly one DECLARED verdict, and nothing higher yet', () => {
		// W-2's separation law: enumeration and verdicting are different acts. A tier above DECLARED
		// appearing here would mean a verdict rode in on enumeration — the two-errors-hiding shape.
		const rows = sql<{ verdict: string; n: number }>(
			"SELECT v.verdict, COUNT(*) AS n FROM verdicts v WHERE v.method = 'code-enumerable:w2' GROUP BY v.verdict"
		);
		expect(rows).toEqual([{ verdict: 'DECLARED', n: 266 }]);
	});
});

describe('measured verdicts (W-3) — measurements cross-checked, absences controlled', () => {
	it('enforcement-register verdicts match an independent per-kind count of the register file', () => {
		// The measure script's regex missed two comment-shadowed entries on its first run (110 of
		// 112); this cross-check is what makes that class of miss impossible to ship.
		const registerSource = readFileSync(
			join(REPO, 'packages', 'rph-domain', 'src', 'enforcement-register.ts'),
			'utf8'
		);
		// ⚠ The bare `kind: '…'` count over-reads by three: the discriminated union's TYPE
		// declarations (`readonly kind: '…';`) carry each literal once. Found when this check's first
		// run disagreed 32 vs 31 — the disagreement doing exactly its job, against the CHECK this time.
		const independent = { ENFORCED: 0, UNENFORCED_DISCLOSED: 0, NOT_A_COMMAND_REFUSAL: 0 };
		for (const m of registerSource.matchAll(
			/(readonly )?kind: '(ENFORCED|UNENFORCED_DISCLOSED|NOT_A_COMMAND_REFUSAL)'/g
		))
			if (m[1] === undefined) independent[m[2] as keyof typeof independent] += 1;
		const enforced = sql<{ n: number }>(
			"SELECT COUNT(*) AS n FROM verdicts WHERE method = 'enforcement-register:w3' AND verdict = 'ENFORCED'"
		)[0]!.n;
		const disclosed = sql<{ n: number }>(
			"SELECT COUNT(*) AS n FROM verdicts WHERE method = 'enforcement-register:w3' AND verdict = 'DIVERGENT_FILED'"
		)[0]!.n;
		const classified = sql<{ n: number }>(
			"SELECT COUNT(*) AS n FROM attrs WHERE key = 'enforcement_class' AND value = 'NOT_A_COMMAND_REFUSAL'"
		)[0]!.n;
		expect(enforced).toBe(independent.ENFORCED);
		expect(disclosed).toBe(independent.UNENFORCED_DISCLOSED);
		expect(classified).toBe(independent.NOT_A_COMMAND_REFUSAL);
		expect(enforced + disclosed + classified).toBe(112);
	});

	it('every consumer-walk ABSENT states its search and its fired positive control', () => {
		const rows = sql<{ evidence: string }>(
			"SELECT evidence FROM verdicts WHERE method = 'consumer-walk:w3' AND verdict = 'ABSENT'"
		);
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			expect(row.evidence).toContain('not found');
			expect(row.evidence).toContain('positive control');
		}
	});

	it('OBSERVED verdicts exist only where a probe mutation was actually driven', () => {
		const rows = sql<{ item_id: string; method: string }>(
			"SELECT item_id, method FROM verdicts WHERE verdict = 'OBSERVED' ORDER BY item_id"
		);
		expect(rows).toEqual([
			{ item_id: 'cap:machine:Intent.intentStatus', method: 'probe-mutation:w3' },
			{ item_id: 'cap:policy:POL-ASSUMPTION-DISCLOSURE', method: 'probe-mutation:w3' }
		]);
	});

	it('the CaptureIntent probe SURVIVAL is recorded as a finding, never laundered into a verdict', () => {
		const attrs = sql<{ value: string }>(
			"SELECT value FROM attrs WHERE item_id = 'cap:command:CaptureIntent' AND key = 'probe_mutation'"
		);
		expect(attrs).toHaveLength(1);
		expect(attrs[0]!.value).toContain('SURVIVED');
		expect(attrs[0]!.value).toContain('RAW');
		// And the item's ladder tier remains TESTED — a survived probe must not raise OR erase it.
		const latest = sql<{ verdict: string }>(
			"SELECT verdict FROM verdicts WHERE item_id = 'cap:command:CaptureIntent' AND measured_at <> 'at-build'"
		);
		expect(latest.map((r) => r.verdict)).toEqual(['TESTED']);
	});
});
