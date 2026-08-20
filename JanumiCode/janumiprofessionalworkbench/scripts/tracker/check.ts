/**
 * tracker:check — the gate. `bun scripts/tracker/check.ts [--root R] [--census C] [--db D]`
 *
 * Three ways to fail, each NAMED in the output, because a check that fails without saying which
 * law broke teaches its reader to re-run until green:
 *
 *   DB_MISSING       — no index on disk; run tracker:build.
 *   SOURCE_STALE     — a tracked source document changed after the index was built (hash mismatch).
 *   DIGEST_MISMATCH  — the census records changed after the index was built: a fresh in-memory
 *                      rebuild disagrees with the on-disk index's canonical digest.
 *
 * ⚠ THE CONTROL LIVES IN verif/tracker-substrate.test.ts: it tampers a source AFTER a build and
 * asserts this script goes RED with the right reason. A check that has never been seen to fail is
 * the REG-F-196 instrument shape — do not weaken that test to make a red go away.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));

import { Database } from 'bun:sqlite';

import { buildDb, canonicalDigest, currentSourceHashes } from './core.js';

function arg(name: string, fallback: string): string {
	const index = process.argv.indexOf(name);
	return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1]! : fallback;
}

const root = resolve(arg('--root', join(SCRIPT_DIR, '..', '..')));
const censusDir = resolve(arg('--census', join(root, 'docs', 'tracking', 'census')));
const dbPath = resolve(arg('--db', join(root, '.tracker', 'tracker.db')));

function refuse(reason: string, detail: unknown): never {
	console.error(JSON.stringify({ ok: false, mode: 'check', reason, detail }));
	process.exit(1);
}

if (!existsSync(dbPath)) refuse('DB_MISSING', { dbPath });

try {
	const disk = new Database(dbPath, { readonly: true });
	const recorded = new Map(
		(
			disk.prepare('SELECT path, sha256 FROM sources ORDER BY path').all() as {
				path: string;
				sha256: string;
			}[]
		).map((row) => [row.path, row.sha256])
	);
	const current = currentSourceHashes(root);
	const stale: string[] = [];
	for (const [path, sha] of current) if (recorded.get(path) !== sha) stale.push(path);
	for (const path of recorded.keys()) if (!current.has(path)) stale.push(path);
	if (stale.length > 0) refuse('SOURCE_STALE', { stale });

	const diskDigest = canonicalDigest(disk);
	disk.close();
	const fresh = buildDb(':memory:', root, censusDir);
	const freshDigest = canonicalDigest(fresh);
	fresh.close();
	if (diskDigest !== freshDigest) refuse('DIGEST_MISMATCH', { diskDigest, freshDigest });
	console.log(JSON.stringify({ ok: true, mode: 'check', digest: diskDigest }));
} catch (error) {
	if (error instanceof Error && error.message.startsWith('tracker:'))
		refuse('RECORDS_INVALID', error.message);
	throw error;
}
