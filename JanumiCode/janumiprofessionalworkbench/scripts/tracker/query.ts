/**
 * tracker:query — read the index. `bun scripts/tracker/query.ts <command> [args]`
 *
 *   counts                 — items by kind, verdicts by tier
 *   unverified             — items whose LATEST verdict is stub-fakeable (DECLARED/TESTED) or absent
 *   fts <match-expr>       — FTS5 lexical search over names/anchors
 *   item <id>              — one item with its full verdict history (append-only, so history IS audit)
 *
 * Day-one consumer per design §6: a tracker nothing reads is the hollow-layer finding
 * re-committed. This CLI existing — and being exercised by the verif test — is the anti-hollow
 * clause, not a convenience.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));

import { Database } from 'bun:sqlite';

function arg(name: string, fallback: string): string {
	const index = process.argv.indexOf(name);
	return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1]! : fallback;
}

const root = resolve(arg('--root', join(SCRIPT_DIR, '..', '..')));
const dbPath = resolve(arg('--db', join(root, '.tracker', 'tracker.db')));
// Skip EVERY `--flag value` pair generically: the verif harness passes a shared flag set to all
// three CLIs, and a flag this command does not consume must not leak its VALUE into the
// positionals — that is how '--census <dir>' briefly became the command name (caught by the witness suite).
const positional = process.argv
	.slice(2)
	.filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] ?? '').startsWith('--'));
const command = positional[0] ?? 'counts';

if (!existsSync(dbPath)) {
	console.error(
		JSON.stringify({ ok: false, error: 'DB_MISSING — run tracker:build first', dbPath })
	);
	process.exit(1);
}
const db = new Database(dbPath, { readonly: true });

// Latest verdict per item = the last record in (measured_at, rowid) order — append-only journals
// make "latest" a total order without any mutable status column existing anywhere.
const LATEST =
	'SELECT v.item_id, v.verdict, v.evidence, v.method, v.measured_at FROM verdicts v ' +
	'WHERE v.rowid = (SELECT v2.rowid FROM verdicts v2 WHERE v2.item_id = v.item_id ORDER BY v2.measured_at DESC, v2.rowid DESC LIMIT 1)';

switch (command) {
	case 'counts': {
		const byKind = db
			.prepare(
				'SELECT kind, COUNT(*) AS n FROM items WHERE superseded_by IS NULL GROUP BY kind ORDER BY kind'
			)
			.all();
		const byVerdict = db
			.prepare(`SELECT verdict, COUNT(*) AS n FROM (${LATEST}) GROUP BY verdict ORDER BY verdict`)
			.all();
		console.log(JSON.stringify({ ok: true, byKind, byVerdict }));
		break;
	}
	case 'unverified': {
		const rows = db
			.prepare(
				'SELECT i.id, i.kind, i.name, latest.verdict FROM items i ' +
					`LEFT JOIN (${LATEST}) latest ON latest.item_id = i.id ` +
					"WHERE i.superseded_by IS NULL AND (latest.verdict IS NULL OR latest.verdict IN ('DECLARED', 'TESTED')) ORDER BY i.id"
			)
			.all();
		console.log(JSON.stringify({ ok: true, unverified: rows }));
		break;
	}
	case 'fts': {
		const expr = positional[1];
		if (expr === undefined) {
			console.error(JSON.stringify({ ok: false, error: 'fts requires a MATCH expression' }));
			process.exit(1);
		}
		const rows = db
			.prepare('SELECT id, name FROM items_fts WHERE items_fts MATCH ? ORDER BY rank LIMIT 50')
			.all(expr);
		console.log(JSON.stringify({ ok: true, matches: rows }));
		break;
	}
	case 'item': {
		const id = positional[1];
		if (id === undefined) {
			console.error(JSON.stringify({ ok: false, error: 'item requires an id' }));
			process.exit(1);
		}
		const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
		const history = db
			.prepare(
				'SELECT verdict, evidence, method, measured_at FROM verdicts WHERE item_id = ? ORDER BY measured_at, rowid'
			)
			.all(id);
		console.log(JSON.stringify({ ok: true, item: item ?? null, history }));
		break;
	}
	default: {
		console.error(JSON.stringify({ ok: false, error: `unknown command '${command}'` }));
		process.exit(1);
	}
}
db.close();
