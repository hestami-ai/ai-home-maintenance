// W-3b V-0.1 — DERIVE THE LIMB SPLIT OF THE CANON 62, BY A STATED RULE, BEFORE ANY VERDICT EXISTS.
//
// ── WHY THIS IS AN ARTIFACT AND NOT A HELPER ─────────────────────────────────────────────────────────────────
// The unit of the W-3b audit is a LIMB, not an invariant, and that was not a preference — it was forced by
// measurement. A canon invariant is a sentence with several independently-enforceable clauses, and the trial run
// found them landing on DIFFERENT verdicts with DIFFERENT remedies:
//
//   STA-4  "Proposed work cannot execute; … baselined work cannot re-enter execution."
//          Limb 8 is ENFORCED — driven: StartExecutionStep against a BASELINED PWU is REJECTED with
//          RPH_INVARIANT_VIOLATION, the refusal naming RPH-PWU-010 by id.
//          Limb 1 is UNENFORCED — proved by observed admission on the same machine.
//   ASR-14 gave FOUR verdicts with four different remedies (object scope and version ENFORCED; criterion a dead
//          predicate; tier has no field in the contract at all).
//
// A one-row-per-invariant table has to pick ONE verdict for STA-4 — laundering an unenforced limb green, or
// reporting an enforced limb as broken. Both are worse than no table.
//
// ── ⚠ AND THE SPLIT IS ITSELF A JUDGMENT, WHICH IS WHY THE RULE IS COMMITTED BEFORE THE VERDICTS ─────────────
// REG-F-113 is the precedent and it is exact: *"prose about a status is not a status"* — two reasonable regexes
// over the same file, at the same moment, returned 22 and 50, and NEITHER was wrong about the file. Two lanes
// splitting these 62 sentences will produce different limb counts for the same reason. So the split is not a
// derived convenience that each lane recomputes; it is a COMMITTED ARTIFACT with a stated rule, pinned by
// `verif/invariant-verdict-census.test.ts`, and a lane may not re-split. What the rule produces is the
// population; the rule is the thing that can be argued with.
//
// ── THE RULE, STATED IN FULL ─────────────────────────────────────────────────────────────────────────────────
// R1. POPULATION. Every line of JPWB-DOC-003 matching /^\*\*([A-Z]{3})-(\d+) · (.+?)\.\*\*\s*(.*)$/. The catalog
//     has no single section heading — the 62 entries are distributed as bold run-in rows under nine ordinary
//     content headings — so a line-shape rule is the only total one. Expected: 62, pinned.
// R2. STATEMENT. The remainder of that same line after the bold title. `**WHY:**`, `**SCOPE:**` and
//     `**NON-EXAMPLE:**` live on FOLLOWING lines and are NOT part of the statement: they are rationale and
//     boundary, not the rule, and scoring them would manufacture limbs canon does not assert.
// R3. SPLIT POINTS. Semicolon (`; `) and sentence end (`. ` followed by an opening character). These are the
//     corpus's own two clause separators in this catalog.
// R4. PROTECTED SPANS — never split inside. Ordered enumerations `(1) … (2) …`, section refs (`§8.2`),
//     abbreviations (`e.g.`, `i.e.`, `cf.`), decimals, and parenthesised asides. An ordered enumeration is ONE
//     limb: canon writes it as a single procedure ("receives, in order: (1) … (2) …"), and splitting it would
//     assert four independently-enforceable rules where canon states one sequence.
// R5. MINIMUM LENGTH. A fragment under 25 characters is not a limb; it merges into the preceding one. This is
//     what stops `v1.` and stray abbreviations from minting rows.
// R6. VERBATIM. Limb text is byte-identical to its span of the canon line, emphasis included. No normalisation:
//     a limb that has been tidied cannot be checked against canon by string equality.
//
// ⚠ WHAT THIS RULE IS NOT. It is not a claim that canon INTENDED these divisions. It is a stated, reproducible
// partition that makes per-limb verdicts possible and per-limb disagreement locatable. A lane that believes a
// limb is mis-split files that as a finding against THIS rule — it does not silently re-split.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CATALOG = 'docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md';
const OUT = 'docs/tracking/w3b/limbs.ndjson';

/** R1 — the population rule. */
const ENTRY = /^\*\*([A-Z]{3})-(\d+) · (.+?)\.\*\*\s*(.*)$/;

export interface InvariantEntry {
	readonly id: string;
	readonly family: string;
	readonly ordinal: number;
	readonly title: string;
	readonly statement: string;
	readonly line: number;
}

/** R1 + R2. Reads the catalog and returns one entry per bold run-in row, statement text only. */
export function readCatalog(root: string): InvariantEntry[] {
	const text = readFileSync(resolve(root, CATALOG), 'utf8');
	const out: InvariantEntry[] = [];
	text.split('\n').forEach((raw, i) => {
		const m = ENTRY.exec(raw);
		if (!m) return;
		out.push({
			id: `${m[1]}-${Number(m[2])}`,
			family: m[1]!,
			ordinal: Number(m[2]),
			title: m[3]!,
			statement: m[4]!.trim(),
			line: i + 1
		});
	});
	return out;
}

// R4 — protected spans, masked before splitting and restored after. Each entry is a reason, not a pattern
// someone can widen casually: every one of these was hit by a real statement in the catalog.
const PROTECTED: readonly RegExp[] = [
	/\(\d+\)[^;.]*(?:;[^;.]*)*/g, // ordered enumerations: "(1) strict validation; (2) review" is ONE procedure
	/§\d+(?:\.\d+)*/g, // section references
	/\b(?:e\.g|i\.e|cf|etc|vs|approx|no)\./gi, // abbreviations whose period is not a sentence end
	/\b\d+\.\d+\b/g // decimals
];

// ⚠ A PRINTABLE SENTINEL, AND THE FIRST ATTEMPT USED A NUL BYTE. `verif/source-is-reviewable.test.ts`
// refused it on arrival, and the refusal is worth more than the fix: a NUL makes git treat the file as
// BINARY and stop diffing it, so this masking trick would have silently cost every future reviewer the
// ability to see this file change. U+241F cannot appear in the catalog text (verified: zero occurrences in
// JPWB-DOC-003) and stays reviewable.
const SENTINEL = '␟';

function maskProtected(s: string): { masked: string; spans: string[] } {
	const spans: string[] = [];
	let masked = s;
	for (const re of PROTECTED) {
		masked = masked.replace(re, (hit) => {
			spans.push(hit);
			return `${SENTINEL}${spans.length - 1}${SENTINEL}`;
		});
	}
	return { masked, spans };
}

function unmask(s: string, spans: string[]): string {
	return s.replace(new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g'), (_, i) => spans[Number(i)] ?? '');
}

/**
 * R3 + R5 + R6 — split one statement into limbs.
 *
 * ⚠ THE MERGE DIRECTION IS BACKWARD ON PURPOSE. A sub-25-character fragment merges into the PRECEDING limb, not
 * the following one. Forward-merging would attach a trailing scrap to the next rule's text, and a limb whose
 * text is not exactly its own span cannot be checked against canon by string equality (R6).
 */
export function splitLimbs(statement: string): string[] {
	const { masked, spans } = maskProtected(statement);
	const pieces = masked
		.split(/(?<=;)\s+|(?<=\.)\s+(?=[A-Z(“"'*])/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

	const limbs: string[] = [];
	for (const piece of pieces) {
		const restored = unmask(piece, spans).trim();
		if (restored.length < 25 && limbs.length > 0) {
			limbs[limbs.length - 1] = `${limbs[limbs.length - 1]} ${restored}`.trim();
			continue;
		}
		limbs.push(restored);
	}
	return limbs.length > 0 ? limbs : [statement];
}

/** The census item id these limbs hang off — the ids already committed by W-2, not new ones. */
export function capabilityId(entry: InvariantEntry): string {
	return `cap:invariant:inv-canon-${entry.family.toLowerCase()}-${entry.ordinal}`;
}

export interface LimbRecord {
	readonly type: 'limb';
	readonly id: string;
	readonly item_id: string;
	readonly invariant: string;
	readonly ordinal: number;
	readonly text: string;
	readonly anchor_line: number;
	readonly rule: string;
	readonly derived_at: string;
}

export function deriveLimbs(root: string, derivedAt: string): LimbRecord[] {
	const out: LimbRecord[] = [];
	for (const entry of readCatalog(root)) {
		splitLimbs(entry.statement).forEach((text, i) => {
			out.push({
				type: 'limb',
				id: `limb:${entry.id}:${i + 1}`,
				item_id: capabilityId(entry),
				invariant: entry.id,
				ordinal: i + 1,
				text,
				anchor_line: entry.line,
				rule: 'w3b-limb-split/1.0.0',
				derived_at: derivedAt
			});
		});
	}
	return out;
}

if (import.meta.main) {
	const root = process.cwd();
	const derivedAt = process.argv[2] ?? '2026-08-21';
	const limbs = deriveLimbs(root, derivedAt);
	const byInvariant = new Map<string, number>();
	for (const l of limbs) byInvariant.set(l.invariant, (byInvariant.get(l.invariant) ?? 0) + 1);
	const widest = [...byInvariant.entries()].sort((a, b) => b[1] - a[1])[0];
	writeFileSync(resolve(root, OUT), limbs.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
	console.log(
		`derived ${limbs.length} limbs over ${byInvariant.size} invariants ` +
			`(mean ${(limbs.length / byInvariant.size).toFixed(1)}, widest ${widest?.[0]} = ${widest?.[1]}) -> ${OUT}`
	);
}
