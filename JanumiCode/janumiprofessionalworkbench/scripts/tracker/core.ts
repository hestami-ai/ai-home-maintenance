/**
 * The tracker substrate: schema, NDJSON record loading, deterministic build, canonical digest.
 *
 * DESIGN AUTHORITY: docs/_working/DESIGN-implementation-ground-truth.md. The three load-bearing
 * decisions, restated where the code enacts them:
 *
 * 1. AN INDEX, NOT A PEER. Nothing here records a decision. The DB is derived, gitignored, and
 *    rebuilt from committed plaintext; its only native content is the census NDJSON under
 *    `docs/tracking/census/`.
 * 2. APPEND-ONLY. A record is never edited; corrections are new records superseding by id — the
 *    register's strike-don't-delete discipline, in data. `loadRecords` REFUSES a duplicate id and
 *    REFUSES a dangling supersede, because an append-only journal that tolerates either has
 *    silently become an editable one.
 * 3. DETERMINISTIC. Same committed inputs ⇒ byte-identical canonical digest. That is why nothing
 *    here calls Date.now(): every timestamp in the DB comes from the records themselves. A digest
 *    that moves without an input moving is a check that cries wolf; a build stamped with
 *    wall-clock time is exactly that.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { Database } from 'bun:sqlite';

import { ingestAll } from './ingest.js';

export const DDL = `
CREATE TABLE sources (path TEXT PRIMARY KEY, sha256 TEXT NOT NULL, parser TEXT NOT NULL);
CREATE TABLE items (
	id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
	anchor_doc TEXT, anchor_text TEXT, origin TEXT NOT NULL,
	created_at TEXT NOT NULL, superseded_by TEXT REFERENCES items(id)
);
CREATE TABLE verdicts (
	item_id TEXT NOT NULL REFERENCES items(id), verdict TEXT NOT NULL,
	evidence TEXT NOT NULL, method TEXT NOT NULL, measured_at TEXT NOT NULL
);
CREATE TABLE refs (from_id TEXT NOT NULL, to_id TEXT NOT NULL, kind TEXT NOT NULL);
CREATE TABLE attrs (item_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL);
CREATE VIRTUAL TABLE items_fts USING fts5(id UNINDEXED, name, anchor_text, evidence);
`;

/**
 * The closed kind vocabulary (design §4). Closed ON PURPOSE: an open kind column is how a second
 * tracker grows inside the index — every widening must arrive as a design amendment, not a typo.
 */
export const KINDS = new Set([
	'register-entry',
	'sheet-row',
	'tracker-row',
	'backlog-item',
	'audit-roster-item',
	'capability',
	'schema',
	'mutant',
	'question'
]);

/** Evidence ladder (design §5) + the REG-F-197 audit vocabulary, one closed set. */
export const VERDICTS = new Set([
	'DECLARED',
	'TESTED',
	'OBSERVED',
	'DRIVEN',
	'HOLLOW',
	'ENFORCED',
	'REFERENCE_NO_FIXTURE',
	'PLACEHOLDER',
	'DIVERGENT_FILED',
	'DIVERGENT_UNFILED',
	'ABSENT'
]);

export interface ItemRecord {
	readonly type: 'item';
	readonly id: string;
	readonly kind: string;
	readonly name: string;
	readonly origin: string;
	readonly created_at: string;
	readonly anchor_doc?: string;
	readonly anchor_text?: string;
}
export interface VerdictRecord {
	readonly type: 'verdict';
	readonly item_id: string;
	readonly verdict: string;
	readonly evidence: string;
	readonly method: string;
	readonly measured_at: string;
}
export interface SupersedeRecord {
	readonly type: 'supersede';
	readonly id: string;
	readonly superseded_by: string;
}
export interface RefRecord {
	readonly type: 'ref';
	readonly from_id: string;
	readonly to_id: string;
	readonly kind: string;
}
export type TrackerRecord = ItemRecord | VerdictRecord | SupersedeRecord | RefRecord;

export interface LoadedCensus {
	readonly items: ItemRecord[];
	readonly verdicts: VerdictRecord[];
	readonly supersedes: SupersedeRecord[];
	readonly refs: RefRecord[];
}

function fail(message: string): never {
	throw new Error(`tracker: ${message}`);
}

function requireText(record: Record<string, unknown>, field: string, where: string): string {
	const value = record[field];
	if (typeof value !== 'string' || value.length === 0)
		fail(`${where}: field '${field}' must be non-empty text`);
	return value;
}

/**
 * Load and VALIDATE every .ndjson journal under the census dir, sorted by filename then line —
 * a total order, so the build is deterministic regardless of filesystem enumeration order.
 */
export function loadRecords(censusDir: string): LoadedCensus {
	const items: ItemRecord[] = [];
	const verdicts: VerdictRecord[] = [];
	const supersedes: SupersedeRecord[] = [];
	const refs: RefRecord[] = [];
	const ids = new Set<string>();
	const files = existsSync(censusDir)
		? readdirSync(censusDir)
				.filter((f) => f.endsWith('.ndjson'))
				.sort()
		: [];
	for (const file of files) {
		const lines = readFileSync(join(censusDir, file), 'utf8').split('\n');
		lines.forEach((line, index) => {
			if (line.trim() === '') return;
			const where = `${file}:${index + 1}`;
			let parsed: unknown;
			try {
				parsed = JSON.parse(line);
			} catch {
				fail(`${where}: not valid JSON`);
			}
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
				fail(`${where}: record must be a JSON object`);
			const record = parsed as Record<string, unknown>;
			switch (record.type) {
				case 'item': {
					const id = requireText(record, 'id', where);
					// THE APPEND-ONLY LAW, half one: an id enters at most once, across ALL journals.
					if (ids.has(id))
						fail(
							`${where}: duplicate item id '${id}' — records are append-only; supersede, never re-issue`
						);
					ids.add(id);
					const kind = requireText(record, 'kind', where);
					if (!KINDS.has(kind))
						fail(`${where}: unknown kind '${kind}' — the kind vocabulary is closed (design §4)`);
					items.push({
						type: 'item',
						id,
						kind,
						name: requireText(record, 'name', where),
						origin: requireText(record, 'origin', where),
						created_at: requireText(record, 'created_at', where),
						anchor_doc: typeof record.anchor_doc === 'string' ? record.anchor_doc : undefined,
						anchor_text: typeof record.anchor_text === 'string' ? record.anchor_text : undefined
					});
					break;
				}
				case 'verdict': {
					const verdict = requireText(record, 'verdict', where);
					if (!VERDICTS.has(verdict))
						fail(`${where}: unknown verdict '${verdict}' — the vocabulary is closed (design §5)`);
					verdicts.push({
						type: 'verdict',
						item_id: requireText(record, 'item_id', where),
						verdict,
						evidence: requireText(record, 'evidence', where),
						method: requireText(record, 'method', where),
						measured_at: requireText(record, 'measured_at', where)
					});
					break;
				}
				case 'supersede':
					supersedes.push({
						type: 'supersede',
						id: requireText(record, 'id', where),
						superseded_by: requireText(record, 'superseded_by', where)
					});
					break;
				case 'ref':
					refs.push({
						type: 'ref',
						from_id: requireText(record, 'from_id', where),
						to_id: requireText(record, 'to_id', where),
						kind: requireText(record, 'kind', where)
					});
					break;
				default:
					fail(
						`${where}: unknown record type '${String(record.type as string | number | boolean)}'`
					);
			}
		});
	}
	// THE APPEND-ONLY LAW, half two: every reference resolves. A dangling supersede or verdict is a
	// record about nothing, and tolerating it is how a roster decays back into a count.
	for (const s of supersedes) {
		if (!ids.has(s.id)) fail(`supersede of unknown item '${s.id}'`);
		if (!ids.has(s.superseded_by)) fail(`supersede target '${s.superseded_by}' does not exist`);
	}
	for (const v of verdicts)
		if (!ids.has(v.item_id)) fail(`verdict for unknown item '${v.item_id}'`);
	return { items, verdicts, supersedes, refs };
}

/**
 * W-0 SOURCE SET: the tracker documents are HASHED, not yet parsed — parsing is W-1's ground.
 * Recording the hashes now means `check` already detects a source moving under a stale index,
 * which is the freshness half of the csaa:inventory pattern, live before any ingest exists.
 */
export const SOURCE_DOCS: readonly string[] = [
	'docs/canon/JPWB-REG-005 Decision and Divergence Register.md',
	'docs/canon/JPWB Canon Ratify Sheet (R1).md',
	'docs/canon/JPWB Constitution-Discussion Conferral Sheet (proposed).md',
	'docs/JPWB Implementation Roadmap and Tracker.md',
	'docs/JPWB Reconciliation Ratify Sheet (M0).md',
	'docs/_working/BACKLOG.md',
	'docs/_working/AUDIT-shape-survivorship-2026-08-20.md',
	// W-2: the four code-side enumerables (design §7). Hash-tracked like every source, so a command
	// added without a rebuild reddens tracker:check the same way a register edit does.
	'packages/rph-contracts/src/messages.ts',
	'packages/rph-domain/src/transitions.data.ts',
	'packages/rph-domain/vocab/m12-conformance.json',
	'packages/rph-product-realization-pwa/src/ontology.data.ts'
];

export function buildDb(dbPath: string, repoRoot: string, censusDir: string): Database {
	const census = loadRecords(censusDir);
	// W-1: the tracking documents are PARSED, not merely hashed. Ingested rows and census rows share
	// one table set; `origin` separates them, and the census's append-only validation deliberately
	// does NOT apply to ingested rows — their ground truth is the source document, re-derived every
	// build, so "editing" them means editing the source, which SOURCE_STALE already polices.
	const ingested = ingestAll(repoRoot);
	const db = new Database(dbPath, { create: true });
	db.exec('PRAGMA journal_mode = MEMORY;');
	db.exec(DDL);
	const insertSource = db.prepare('INSERT INTO sources (path, sha256, parser) VALUES (?, ?, ?)');
	for (const path of SOURCE_DOCS) {
		const absolute = join(repoRoot, path);
		if (!existsSync(absolute)) fail(`source document missing: ${path}`);
		insertSource.run(
			path,
			createHash('sha256').update(readFileSync(absolute)).digest('hex'),
			ingested.parsers.get(path) ?? 'hash-only:w0'
		);
	}
	// An ingested id colliding with a census id would silently shadow authored ground truth — refuse.
	const censusIds = new Set(census.items.map((i) => i.id));
	for (const i of ingested.items)
		if (censusIds.has(i.id)) fail(`ingested id '${i.id}' collides with a census record id`);
	const insertItem = db.prepare(
		'INSERT INTO items (id, kind, name, anchor_doc, anchor_text, origin, created_at, superseded_by) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)'
	);
	const insertFts = db.prepare(
		'INSERT INTO items_fts (id, name, anchor_text, evidence) VALUES (?, ?, ?, ?)'
	);
	for (const item of census.items) {
		insertItem.run(
			item.id,
			item.kind,
			item.name,
			item.anchor_doc ?? null,
			item.anchor_text ?? null,
			item.origin,
			item.created_at
		);
		insertFts.run(item.id, item.name, item.anchor_text ?? '', '');
	}
	const applySupersede = db.prepare('UPDATE items SET superseded_by = ? WHERE id = ?');
	for (const s of census.supersedes) applySupersede.run(s.superseded_by, s.id);
	const insertVerdict = db.prepare(
		'INSERT INTO verdicts (item_id, verdict, evidence, method, measured_at) VALUES (?, ?, ?, ?, ?)'
	);
	for (const v of census.verdicts)
		insertVerdict.run(v.item_id, v.verdict, v.evidence, v.method, v.measured_at);
	const insertRef = db.prepare('INSERT INTO refs (from_id, to_id, kind) VALUES (?, ?, ?)');
	for (const r of census.refs) insertRef.run(r.from_id, r.to_id, r.kind);
	for (const i of ingested.items) {
		insertItem.run(
			i.id,
			i.kind,
			i.name,
			i.anchor_doc ?? null,
			i.anchor_text ?? null,
			i.origin,
			i.created_at
		);
		insertFts.run(i.id, i.name, i.anchor_text ?? '', '');
	}
	for (const v of ingested.verdicts)
		insertVerdict.run(v.item_id, v.verdict, v.evidence, v.method, v.measured_at);
	for (const r of ingested.refs) insertRef.run(r.from_id, r.to_id, r.kind);
	const insertAttr = db.prepare('INSERT INTO attrs (item_id, key, value) VALUES (?, ?, ?)');
	for (const a of ingested.attrs) insertAttr.run(a.item_id, a.key, a.value);
	return db;
}

/**
 * Canonical digest = sha256 over ORDERED JSON dumps of every table. Deliberately NOT the file
 * bytes: SQLite page layout is an implementation detail two identical builds may disagree on;
 * the CONTENT ordered by primary key is what "same inputs, same index" means.
 */
export function canonicalDigest(db: Database): string {
	const dump = {
		sources: db.prepare('SELECT path, sha256, parser FROM sources ORDER BY path').all(),
		items: db
			.prepare(
				'SELECT id, kind, name, anchor_doc, anchor_text, origin, created_at, superseded_by FROM items ORDER BY id'
			)
			.all(),
		verdicts: db
			.prepare(
				'SELECT item_id, verdict, evidence, method, measured_at FROM verdicts ORDER BY item_id, measured_at, verdict'
			)
			.all(),
		refs: db.prepare('SELECT from_id, to_id, kind FROM refs ORDER BY from_id, to_id, kind').all(),
		attrs: db.prepare('SELECT item_id, key, value FROM attrs ORDER BY item_id, key, value').all()
	};
	return createHash('sha256').update(JSON.stringify(dump)).digest('hex');
}

export function currentSourceHashes(repoRoot: string): Map<string, string> {
	const map = new Map<string, string>();
	for (const path of SOURCE_DOCS) {
		const absolute = join(repoRoot, path);
		if (existsSync(absolute))
			map.set(path, createHash('sha256').update(readFileSync(absolute)).digest('hex'));
	}
	return map;
}
