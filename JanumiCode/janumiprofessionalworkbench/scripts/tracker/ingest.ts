/**
 * W-1 — parse the tracking documents that exist into index rows. NO SOURCE DOCUMENT IS MODIFIED.
 *
 * Every grammar rule here was SURVEYED before it was written (design §8, 2026-08-20), and the
 * traps are the point:
 *
 * - Register `###` headers must tolerate a `~~` prefix (3 struck entries) or silently drop them.
 * - Inline code spans are stripped BEFORE field matching — REG-F-113 quotes `**Status:**` in
 *   backticks, and a raw count reads prose about a status as a status.
 * - REG-E items are a SECOND grammar (bullets, not headers), REG-E-022 is a true duplicate-id
 *   collision (two different entries, two sections) disambiguated by occurrence,
 *   and E-amendment bullets are annotations on an item, not new items.
 * - Ratify Sheet R1's checkboxes DO NOT encode ratification (the sheet was executed
 *   wholesale-interim with every ☐ unmarked) — dispositions come from `AMENDED … (REG-D-nnn)`
 *   annotations only. An ingest that read checkboxes would be wrong about all 72 of them.
 * - The audit artifact's verdict tables become REAL verdict rows: REG-F-197's roster queryable,
 *   which is what "the residue cannot evaporate into an ordinal" means in practice.
 *
 * Determinism: every function here is a pure function of file text. No clock, no filesystem
 * enumeration order (sources are a fixed list), no randomness.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ItemRecord, RefRecord, VerdictRecord } from './core.js';

export interface AttrRecord {
	readonly item_id: string;
	readonly key: string;
	readonly value: string;
}

export interface IngestResult {
	readonly items: ItemRecord[];
	readonly verdicts: VerdictRecord[];
	readonly attrs: AttrRecord[];
	readonly refs: RefRecord[];
	/** parser name recorded on the source row, so `sources` says HOW each document entered. */
	readonly parsers: Map<string, string>;
}

const stripCode = (line: string): string => line.replace(/`[^`]*`/g, '');

function item(
	id: string,
	kind: string,
	name: string,
	origin: string,
	created_at: string,
	anchor_doc: string,
	anchor_text: string
): ItemRecord {
	return { type: 'item', id, kind, name, origin, created_at, anchor_doc, anchor_text };
}

/** REG-id mentions in a block become edges. The graph is near-closed (survey: 2 undefined of 326). */
function mentionRefs(fromId: string, text: string): RefRecord[] {
	const seen = new Set<string>();
	for (const m of stripCode(text).matchAll(/\bREG-[A-Z]-\d+\b/g)) seen.add(m[0]);
	seen.delete(fromId.replace(/^reg:/, '').replace(/@\d+$/, ''));
	return [...seen]
		.sort()
		.map((to) => ({ type: 'ref', from_id: fromId, to_id: `reg:${to}`, kind: 'mentions' }));
}

/** ── The register: grammar 1 (### entries) + grammar 2 (REG-E bullets) ─────────────────────── */
export function parseRegister(text: string, path: string): IngestResult {
	const items: ItemRecord[] = [];
	const attrs: AttrRecord[] = [];
	const refs: RefRecord[] = [];

	// Grammar 1 — the same split the register-status gate uses, so the two parsers can disagree
	// ONLY about fields, never about the population. The verif cross-check asserts exactly that.
	for (const block of text.split(/^### /m).slice(1)) {
		const heading = block.split('\n', 1)[0] ?? '';
		const m = /^(~~)?(REG-[A-Z]-\d+)(~~)?\s*—\s*(.*)$/.exec(heading);
		if (!m) continue;
		const id = `reg:${m[2]!}`;
		const struck = m[1] !== undefined;
		const title = (m[4] ?? '').replace(/~~/g, '').trim() || m[2]!;
		// Date: the fused `- **Date:** YYYY-MM-DD · **Type:** X` form (246 entries), the REG-F-196
		// `**Raised:**` variant, or absent (section-defaulted REG-Q entries — attributed below).
		const dateMatch = /\*\*(?:Date|Raised):\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(stripCode(block));
		items.push(
			item(
				id,
				'register-entry',
				title.slice(0, 200),
				path,
				dateMatch?.[1] ?? 'undated',
				path,
				`### ${m[2]!} — ${title.slice(0, 120)}`
			)
		);
		attrs.push({ item_id: id, key: 'grammar', value: 'heading' });
		if (struck) attrs.push({ item_id: id, key: 'struck', value: 'true' });
		const typeMatch = /\*\*Type:\*\*\s*([^·\n]*)/.exec(stripCode(block));
		if (typeMatch)
			attrs.push({ item_id: id, key: 'type', value: typeMatch[1]!.trim().slice(0, 160) });
		// Live status = the gate's own rule: code-stripped, not opened `- ~~`. Multiple/zero live
		// lines are themselves facts (the 63 grandfathered) — record what IS, count included.
		const liveStatuses = block
			.split('\n')
			.map(stripCode)
			.filter((l) => l.includes('**Status:**') && !l.trimStart().startsWith('- ~~'));
		attrs.push({ item_id: id, key: 'live_status_lines', value: String(liveStatuses.length) });
		const statusValue =
			liveStatuses[0] === undefined ? undefined : /\*\*Status:\*\*\s*(.*)$/.exec(liveStatuses[0]);
		if (statusValue)
			attrs.push({ item_id: id, key: 'status', value: statusValue[1]!.trim().slice(0, 200) });
		refs.push(...mentionRefs(id, block));
	}

	// Grammar 2 — REG-E bullets. Definition: `- **REG-E-NNN** — …` (bold closes right after the
	// id). Amendment: `- **REG-E-NNN — annotation…` (annotation INSIDE the bold) — an attr on the
	// item, never a new item. REG-E-022 collides (two definitions): occurrence ordinal suffixes
	// the second, and both carry their section context as an attr for a human to disambiguate.
	const eSeen = new Map<string, number>();
	let eSection = '';
	for (const line of text.split('\n')) {
		const section = /^\*\*([^*]+):\*\*\s*$/.exec(line.trim());
		if (section) eSection = section[1]!.trim();
		const definition = /^- \*\*(~~)?(REG-E-\d{3})(~~)?\*\*\s*—\s*(.*)$/.exec(line);
		if (definition) {
			const bare = definition[2]!;
			const count = (eSeen.get(bare) ?? 0) + 1;
			eSeen.set(bare, count);
			const id = count === 1 ? `reg:${bare}` : `reg:${bare}@${count}`;
			// ### grammar already ingested E-032/033; a bullet re-defining a heading id would be a
			// register defect, not an ingest choice — refuse loudly rather than merge silently.
			if (items.some((existing) => existing.id === id))
				throw new Error(`tracker: register E-bullet re-defines ${id}`);
			items.push(
				item(
					id,
					'register-entry',
					stripCode(definition[4] ?? '').slice(0, 200),
					path,
					'undated',
					path,
					line.slice(0, 160)
				)
			);
			attrs.push({ item_id: id, key: 'grammar', value: 'bullet' });
			if (definition[1] !== undefined) attrs.push({ item_id: id, key: 'struck', value: 'true' });
			if (eSection !== '') attrs.push({ item_id: id, key: 'section', value: eSection });
			refs.push(...mentionRefs(id, line));
			continue;
		}
		const amendment = /^- \*\*(~~)?(REG-E-\d{3})\s*—\s*([^*]+?):?\*\*/.exec(line);
		if (amendment) {
			const bare = amendment[2]!;
			// ⚠ ORDER-SENSITIVE, LEARNED FROM THE FIRST REAL BUILD: E-023 and E-024 were CLOSED by
			// editing the annotation INTO the definition bullet's own bold — so a bullet of this shape
			// with NO prior definition IS the definition, carrying its disposition inline. Reading it
			// as an amendment created attrs on items that never existed (30 bullets, not 31, and refs
			// pointing at nothing). An annotation is an amendment only when its item already exists.
			if (eSeen.get(bare) === undefined) {
				eSeen.set(bare, 1);
				const id = `reg:${bare}`;
				if (items.some((existing) => existing.id === id))
					throw new Error(`tracker: register E-bullet re-defines ${id}`);
				items.push(
					item(
						id,
						'register-entry',
						stripCode(amendment[3]!).trim().slice(0, 200),
						path,
						'undated',
						path,
						line.slice(0, 160)
					)
				);
				attrs.push({ item_id: id, key: 'grammar', value: 'bullet' });
				attrs.push({
					item_id: id,
					key: 'annotation',
					value: stripCode(amendment[3]!).trim().slice(0, 200)
				});
				if (eSection !== '') attrs.push({ item_id: id, key: 'section', value: eSection });
				refs.push(...mentionRefs(id, line));
				continue;
			}
			const target = eSeen.get(bare) === 1 ? `reg:${bare}` : `reg:${bare}@${eSeen.get(bare)}`;
			attrs.push({
				item_id: target,
				key: 'amendment',
				value: stripCode(amendment[3]!).trim().slice(0, 200)
			});
		}
	}
	return { items, verdicts: [], attrs, refs, parsers: new Map([[path, 'register:w1']]) };
}

/** ── Roadmap Tracker §6 milestone rows ─────────────────────────────────────────────────────── */
export function parseRoadmapTracker(text: string, path: string): IngestResult {
	const items: ItemRecord[] = [];
	const attrs: AttrRecord[] = [];
	const refs: RefRecord[] = [];
	// Milestone rows are `| M9 | name | … | status |`. The emoji legend is declared in the file
	// header; the status CELL is ingested verbatim — normalization is a query concern, not ingest.
	for (const line of text.split('\n')) {
		// Milestone ids are BOLD in the live table (`| **M1** |`) — learned from the first real
		// build, where the unbolded pattern matched ZERO of 16 rows and the kind vanished silently.
		const row = /^\|\s*\*{0,2}(M\d+[a-z]?|MP)\*{0,2}\s*\|(.*)\|\s*(.*?)\s*\|$/.exec(line);
		if (!row) continue;
		const cells = line.split('|').map((c) => c.trim());
		if (cells.length < 4) continue;
		const id = `tracker:${row[1]!}`;
		if (items.some((existing) => existing.id === id)) continue; // §-repeat of a milestone name in prose tables
		items.push(
			item(
				id,
				'tracker-row',
				`${row[1]!} — ${cells[2] ?? ''}`.slice(0, 200),
				path,
				'undated',
				path,
				line.slice(0, 160)
			)
		);
		attrs.push({ item_id: id, key: 'status_cell', value: (cells.at(-2) ?? '').slice(0, 160) });
		refs.push(...mentionRefs(id, line));
	}
	return { items, verdicts: [], attrs, refs, parsers: new Map([[path, 'roadmap-tracker:w1']]) };
}

/** ── Ratify sheets and the conferral sheet ─────────────────────────────────────────────────── */
export function parseSheet(
	text: string,
	path: string,
	sheet: 'r1' | 'm0' | 'conferral'
): IngestResult {
	const items: ItemRecord[] = [];
	const attrs: AttrRecord[] = [];
	const refs: RefRecord[] = [];
	let rowIndex = 0;
	for (const line of text.split('\n')) {
		if (!line.startsWith('|')) continue;
		const cells = line.split('|').map((c) => c.trim());
		if (cells.length < 3 || /^[-: ]+$/.test(cells[1] ?? '') || /^#$/.test(cells[1] ?? '')) continue;
		rowIndex += 1;
		const id = `sheet:${sheet}:${rowIndex}`;
		const kind = sheet === 'conferral' ? 'question' : 'sheet-row';
		items.push(
			item(
				id,
				kind,
				cells.slice(1, 3).join(' — ').replace(/~~/g, '').slice(0, 200) ||
					`${sheet} row ${rowIndex}`,
				path,
				'undated',
				path,
				line.slice(0, 160)
			)
		);
		// ⚠ THE R1 RULE: dispositions come ONLY from amendment annotations. Checkbox glyphs are
		// deliberately NOT read — R1 was executed wholesale-interim with every ☐ unmarked, so a
		// checkbox-derived disposition would be wrong 72 times out of 72.
		const amended = /AMENDED\s+(\d{4}-\d{2}-\d{2})\s*\((REG-[A-Z]-\d+)\)/.exec(line);
		if (amended) {
			attrs.push({
				item_id: id,
				key: 'disposition',
				value: `AMENDED ${amended[1]} (${amended[2]})`
			});
		}
		refs.push(...mentionRefs(id, line));
	}
	return { items, verdicts: [], attrs, refs, parsers: new Map([[path, `sheet-${sheet}:w1`]]) };
}

/** ── BACKLOG checkbox bullets ──────────────────────────────────────────────────────────────── */
export function parseBacklog(text: string, path: string): IngestResult {
	const items: ItemRecord[] = [];
	const attrs: AttrRecord[] = [];
	const refs: RefRecord[] = [];
	for (const line of text.split('\n')) {
		const bullet = /^- \[([ x])\] (.*)$/.exec(line);
		if (!bullet) continue;
		const title = stripCode(bullet[2]!).replace(/[*~]/g, '').trim();
		// Backlog items carry no native id; the id is a content hash of the normalized first line —
		// stable until the item is REWORDED, which under strike-in-place discipline is a new item
		// anyway. Recorded here because a reader will otherwise assume ordinals, which reorder.
		const id = `backlog:${createHash('sha256').update(title).digest('hex').slice(0, 12)}`;
		items.push(
			item(id, 'backlog-item', title.slice(0, 200), path, 'undated', path, title.slice(0, 160))
		);
		attrs.push({ item_id: id, key: 'checked', value: bullet[1] === 'x' ? 'true' : 'false' });
		refs.push(...mentionRefs(id, line));
	}
	return { items, verdicts: [], attrs, refs, parsers: new Map([[path, 'backlog:w1']]) };
}

/** ── The shape-survivorship audit artifact: roster rows INCLUDING their verdicts ───────────── */
export function parseAuditRoster(text: string, path: string): IngestResult {
	const items: ItemRecord[] = [];
	const verdicts: VerdictRecord[] = [];
	const refs: RefRecord[] = [];
	let doc = '';
	for (const line of text.split('\n')) {
		const section = /^## (RPH-DOC-\d{3})\b/.exec(line);
		if (section) doc = section[1]!;
		if (doc === '' || !line.startsWith('|')) continue;
		const cells = line.split('|').map((c) => c.trim());
		// Roster rows are `| schema | verdict | evidence |`; header/rule/totals rows fail the
		// verdict-vocabulary test below, which is the narrowest filter that cannot rot.
		const verdict = cells[2] ?? '';
		if (
			!/^(ENFORCED|REFERENCE_NO_FIXTURE|PLACEHOLDER|DIVERGENT_FILED|DIVERGENT_UNFILED|ABSENT)$/.test(
				verdict
			)
		)
			continue;
		const schema = (cells[1] ?? '').replace(/\\/g, '');
		const id = `audit:shape-survivorship:${doc}:${createHash('sha256').update(schema).digest('hex').slice(0, 8)}`;
		items.push(
			item(
				id,
				'audit-roster-item',
				`${doc} / ${schema}`.slice(0, 200),
				path,
				'2026-08-20',
				path,
				schema.slice(0, 160)
			)
		);
		verdicts.push({
			type: 'verdict',
			item_id: id,
			verdict,
			evidence: (cells[3] ?? '').slice(0, 500),
			method: 'REG-F-197 shape-survivorship audit',
			measured_at: '2026-08-20'
		});
		refs.push(...mentionRefs(id, line));
	}
	return { items, verdicts, attrs: [], refs, parsers: new Map([[path, 'audit-roster:w1']]) };
}

/** ── All sources, one deterministic pass ───────────────────────────────────────────────────── */
export function ingestAll(root: string): IngestResult {
	const read = (p: string): string => readFileSync(join(root, p), 'utf8');
	const parts: IngestResult[] = [
		parseRegister(
			read('docs/canon/JPWB-REG-005 Decision and Divergence Register.md'),
			'docs/canon/JPWB-REG-005 Decision and Divergence Register.md'
		),
		parseSheet(
			read('docs/canon/JPWB Canon Ratify Sheet (R1).md'),
			'docs/canon/JPWB Canon Ratify Sheet (R1).md',
			'r1'
		),
		parseSheet(
			read('docs/canon/JPWB Constitution-Discussion Conferral Sheet (proposed).md'),
			'docs/canon/JPWB Constitution-Discussion Conferral Sheet (proposed).md',
			'conferral'
		),
		parseRoadmapTracker(
			read('docs/JPWB Implementation Roadmap and Tracker.md'),
			'docs/JPWB Implementation Roadmap and Tracker.md'
		),
		parseSheet(
			read('docs/JPWB Reconciliation Ratify Sheet (M0).md'),
			'docs/JPWB Reconciliation Ratify Sheet (M0).md',
			'm0'
		),
		parseBacklog(read('docs/_working/BACKLOG.md'), 'docs/_working/BACKLOG.md'),
		parseAuditRoster(
			read('docs/_working/AUDIT-shape-survivorship-2026-08-20.md'),
			'docs/_working/AUDIT-shape-survivorship-2026-08-20.md'
		)
	];
	const merged: IngestResult = { items: [], verdicts: [], attrs: [], refs: [], parsers: new Map() };
	for (const part of parts) {
		merged.items.push(...part.items);
		merged.verdicts.push(...part.verdicts);
		merged.attrs.push(...part.attrs);
		merged.refs.push(...part.refs);
		for (const [k, v] of part.parsers) merged.parsers.set(k, v);
	}
	return merged;
}
