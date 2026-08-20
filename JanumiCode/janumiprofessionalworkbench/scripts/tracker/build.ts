/**
 * tracker:build — derive the index. `bun scripts/tracker/build.ts [--root R] [--census C] [--db D]`
 *
 * The DB is DISPOSABLE AND GITIGNORED (design §3): this script may be run at any commit and must
 * produce the identical canonical digest for identical inputs — which is why it prints the digest,
 * and why nothing in core.ts reads a clock.
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));

import { buildDb, canonicalDigest } from './core.js';

function arg(name: string, fallback: string): string {
	const index = process.argv.indexOf(name);
	return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1]! : fallback;
}

const root = resolve(arg('--root', join(SCRIPT_DIR, '..', '..')));
const censusDir = resolve(arg('--census', join(root, 'docs', 'tracking', 'census')));
const dbPath = resolve(arg('--db', join(root, '.tracker', 'tracker.db')));

mkdirSync(dirname(dbPath), { recursive: true });
// A rebuild REPLACES; there is no incremental path on purpose — an index that can drift from its
// inputs by partial update is the staleness class `check` exists to catch, built in.
if (existsSync(dbPath)) rmSync(dbPath);

try {
	const db = buildDb(dbPath, root, censusDir);
	const counts = {
		sources: (db.prepare('SELECT COUNT(*) AS n FROM sources').get() as { n: number }).n,
		items: (db.prepare('SELECT COUNT(*) AS n FROM items').get() as { n: number }).n,
		verdicts: (db.prepare('SELECT COUNT(*) AS n FROM verdicts').get() as { n: number }).n,
		refs: (db.prepare('SELECT COUNT(*) AS n FROM refs').get() as { n: number }).n
	};
	const digest = canonicalDigest(db);
	db.close();
	console.log(JSON.stringify({ ok: true, mode: 'build', dbPath, digest, counts }));
} catch (error) {
	console.error(
		JSON.stringify({
			ok: false,
			mode: 'build',
			error: error instanceof Error ? error.message : String(error)
		})
	);
	process.exit(1);
}
