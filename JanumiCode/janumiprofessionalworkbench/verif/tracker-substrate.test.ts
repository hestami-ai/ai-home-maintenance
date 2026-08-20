/**
 * The tracker substrate's witness — and the reason W-0 is not decorative.
 *
 * REG-F-196 Finding 1 is the shape this file exists to prevent: an instrument that is never run,
 * or whose green has never been shown capable of going red, is a claim of coverage rather than
 * coverage. So this suite does not only prove the happy path; it TAMPERS with inputs after a
 * build and asserts each named refusal fires (SOURCE_STALE, DIGEST_MISMATCH, RECORDS_INVALID) —
 * the check is only trusted because it has been seen to fail here.
 *
 * ⚠ RUNTIME SPLIT (driven 2026-08-20, recorded in scripts/tracker/bun-sqlite.d.ts): these tests
 * run under vitest = NODE, where `bun:sqlite` does not exist — and better-sqlite3 does not load
 * under bun. So this suite SPAWNS `bun scripts/tracker/*.ts` and asserts on the CLI contract,
 * which is the same boundary every human and gate consumer uses. The spawn pattern follows the
 * csaa providers' bun-worker spawns.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(REPO, 'scripts', 'tracker');

// A synthetic root: fixture SOURCE docs + fixture census, so nothing here touches (or depends on)
// the real register — a test that read the live register would redden on unrelated edits, and a
// fixture that names real files would survive their deletion (the anchor-ambiguity trap).
const root = mkdtempSync(join(tmpdir(), 'jtracker-'));
const censusDir = join(root, 'docs', 'tracking', 'census');
const dbPath = join(root, '.tracker', 'tracker.db');

function seedSources(): void {
	for (const relative of [
		'docs/canon/JPWB-REG-005 Decision and Divergence Register.md',
		'docs/canon/JPWB Canon Ratify Sheet (R1).md',
		'docs/canon/JPWB Constitution-Discussion Conferral Sheet (proposed).md',
		'docs/JPWB Implementation Roadmap and Tracker.md',
		'docs/JPWB Reconciliation Ratify Sheet (M0).md',
		'docs/_working/BACKLOG.md',
		'docs/_working/AUDIT-shape-survivorship-2026-08-20.md'
	]) {
		const absolute = join(root, relative);
		mkdirSync(dirname(absolute), { recursive: true });
		writeFileSync(absolute, `fixture body of ${relative}\n`);
	}
}

function run(
	script: string,
	extra: readonly string[] = []
): { code: number; out: string; err: string } {
	const result = spawnSync(
		'bun',
		[join(SCRIPTS, script), '--root', root, '--census', censusDir, '--db', dbPath, ...extra],
		{
			cwd: REPO,
			encoding: 'utf8',
			timeout: 60_000
		}
	);
	return { code: result.status ?? -1, out: result.stdout ?? '', err: result.stderr ?? '' };
}

const ITEM = {
	type: 'item',
	id: 'cap:synthetic-capability',
	kind: 'capability',
	name: 'synthetic capability for the substrate witness',
	origin: 'fixture',
	created_at: '2026-08-20',
	anchor_doc: 'fixture.md',
	anchor_text: 'a wholly synthetic anchor phrase'
} as const;

afterAll(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('tracker substrate (W-0)', () => {
	it('builds deterministically: two builds of identical inputs give the identical canonical digest', () => {
		seedSources();
		mkdirSync(censusDir, { recursive: true });
		writeFileSync(
			join(censusDir, 'w0.ndjson'),
			[
				JSON.stringify(ITEM),
				JSON.stringify({
					type: 'verdict',
					item_id: ITEM.id,
					verdict: 'DECLARED',
					evidence: 'fixture evidence',
					method: 'fixture',
					measured_at: '2026-08-20'
				})
			].join('\n') + '\n'
		);
		const first = run('build.ts');
		expect(first.code, first.err).toBe(0);
		const second = run('build.ts');
		expect(second.code, second.err).toBe(0);
		const d1 = (JSON.parse(first.out) as { digest: string }).digest;
		const d2 = (JSON.parse(second.out) as { digest: string }).digest;
		expect(d1).toBe(d2);
		expect(d1).toMatch(/^[a-f0-9]{64}$/);
	});

	it('check is green immediately after a build, and FTS finds the record lexically', () => {
		expect(run('check.ts').code).toBe(0);
		const fts = run('query.ts', ['fts', 'synthetic AND anchor']);
		expect(fts.code, fts.err).toBe(0);
		expect((JSON.parse(fts.out) as { matches: { id: string }[] }).matches.map((m) => m.id)).toEqual(
			[ITEM.id]
		);
	});

	it('surfaces the stub-fakeable tier: a DECLARED-only item appears in `unverified`', () => {
		const result = run('query.ts', ['unverified']);
		expect(result.code).toBe(0);
		expect(
			(JSON.parse(result.out) as { unverified: { id: string }[] }).unverified.map((u) => u.id)
		).toEqual([ITEM.id]);
	});

	// ⚠ THE CONTROLS. Each one proves a refusal can actually fire. Deleting or weakening any of
	// these converts the check into the REG-F-196 shape: green because nothing can redden it.
	it('CONTROL — a source document edited after the build reddens check with SOURCE_STALE', () => {
		const target = join(root, 'docs', '_working', 'BACKLOG.md');
		writeFileSync(target, readFileSync(target, 'utf8') + 'tampered after build\n');
		const result = run('check.ts');
		expect(result.code).toBe(1);
		expect(result.err).toContain('SOURCE_STALE');
		expect(result.err).toContain('BACKLOG.md');
		// Restore and re-arm: rebuild so later controls start from green, and PROVE it is green.
		expect(run('build.ts').code).toBe(0);
		expect(run('check.ts').code).toBe(0);
	});

	it('CONTROL — a census record added after the build reddens check with DIGEST_MISMATCH', () => {
		writeFileSync(
			join(censusDir, 'w0-late.ndjson'),
			JSON.stringify({ ...ITEM, id: 'cap:added-after-build' }) + '\n'
		);
		const result = run('check.ts');
		expect(result.code).toBe(1);
		expect(result.err).toContain('DIGEST_MISMATCH');
		rmSync(join(censusDir, 'w0-late.ndjson'));
		expect(run('check.ts').code).toBe(0);
	});

	it('CONTROL — the append-only law: a re-issued id refuses the whole build, naming the id', () => {
		writeFileSync(join(censusDir, 'w0-dup.ndjson'), JSON.stringify(ITEM) + '\n');
		const result = run('build.ts');
		expect(result.code).toBe(1);
		expect(result.err).toContain('duplicate item id');
		expect(result.err).toContain(ITEM.id);
		rmSync(join(censusDir, 'w0-dup.ndjson'));
	});

	it('CONTROL — a dangling supersede refuses the build rather than degrading to a warning', () => {
		writeFileSync(
			join(censusDir, 'w0-dangling.ndjson'),
			JSON.stringify({ type: 'supersede', id: ITEM.id, superseded_by: 'cap:never-existed' }) + '\n'
		);
		const result = run('build.ts');
		expect(result.code).toBe(1);
		expect(result.err).toContain('cap:never-existed');
		rmSync(join(censusDir, 'w0-dangling.ndjson'));
		// Leave the fixture tree green for whoever adds the next case.
		expect(run('build.ts').code).toBe(0);
		expect(run('check.ts').code).toBe(0);
	});
});
