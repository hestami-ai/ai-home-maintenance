// P-5b — AN ENTRY'S STATUS MUST BE TRUE, not merely readable.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────────────────────
// `register-status.test.ts` next door proves every entry states its status exactly ONCE, so that "what does this
// entry currently say" is a lookup rather than an interpretation. It cannot prove the sentence it isolates is
// still the case. REG-F-284 (2026-08-28) censused that gap and adjudicated **forty stale clauses across
// thirty-seven entries and two ministerial blocks**, the oldest standing since 2026-07-16 — statuses and owed
// clauses advertising work a later act had already done — and named the instrument that would close part of the
// class in as many words: *"a gate that reads the supersession graph and reddens when an entry advertises work a
// later entry claims to have discharged."* This is that gate.
//
// ⚠ AND THE REGISTER HAD ALREADY RULED ON FOUR OF THEM, A MONTH EARLIER, IN THIS FILE. `### Closure sweep —
// 2026-07-24` records that its closure conditions fired, naming `REG-D-001..D-009`, `REG-Q-001`, `REG-F-003` and
// `REG-F-004`. At HEAD, `REG-D-008`, `REG-D-009`, `REG-F-003` and `REG-F-004` all still read `DECIDED — MERGE
// PENDING`. **The ruling exists and the statuses never received it**, because a closure sweep is not indexed by
// the entries it closes.
//
// ── THE RULE ──────────────────────────────────────────────────────────────────────────────────────────────────
// An entry is STALE when three things hold at once: its single live `**Status:**` advertises OWED work; a LATER
// block claims, in a field where it DECLARES a disposition, to have discharged it; and the status does not name
// that block. All three matter — the third is what separates a repaired status that cites its discharger by id
// from `REG-D-008`'s, which does not.
//
// ── THE FOUR MEASURED FACTS THIS FILE IS BUILT AGAINST, each re-derived here on 2026-08-28 at HEAD 313fcfa4 ────
//
// **(1) A KEYWORD SWEEP NARROWS SILENTLY AND REPORTS SUCCESS.** REG-F-095 repaired this exact class on
// 2026-08-09 by grepping the literal *"closes on canon ratification"*, struck REG-D-001..007, and stopped; four
// entries the same ruling covers phrase it differently and still read `DECIDED — MERGE PENDING` nineteen days
// later. **So nothing here keys on a phrase.** The owed/terminal split is DERIVED from the register's own §1
// enumeration and its glosses: a status token is UNSETTLED when its own gloss says *pending*, *live*, or *not
// yet*. If §1 gains a status, this gate classifies it without an edit — and the guard words in `preserves()`
// are the §1 token words themselves, not a list written here.
//
// **(2) THE RULING THAT SETTLES FOUR OF THE FORTY IS NOT IN AN ENTRY.** `### Closure sweep — 2026-07-24` is one
// of only TWO `###` headings that are not `REG-x-nnn`. An extractor anchored on `^### REG-` cannot see it —
// which is why REG-F-284's own derivation found 9 where the adjudicated answer was 40. `blocks()` therefore
// reads EVERY `###` heading; the two non-entry blocks get slug ids, and CONTROL 2 fails if their edges vanish.
//
// **(3) EDGE DETECTION MUST NOT ASSUME FORMATTING.** REG-F-284 measured a supersession regex requiring bold
// `**REG-F-277**` at 13 edges against 222 for the broadened form. Measured again here on the shipped extractor:
// **53 edges reading ids in any decoration, 13 requiring bold — 40 of 53 lost, and 4 of the 9 findings with
// them (REG-F-014, REG-F-045, REG-D-019, REG-F-083).** `ID_BOLD` exists only so CONTROL 3 can measure that gap.
//
// **(4) THE REGISTER IS APPEND-ONLY AND THIS GATE MAY NOT DEMAND ZERO.** 28 of REG-F-284's 40 are deliberately
// NOT repaired: a status strike inserts a line above thousands of line-citation targets, which `JPWB-DOC-004
// §10 item 10` forbids paying. A gate red on all of them would be satisfied by deleting the gate. So it
// RATCHETS on `KNOWN` — the shape `register-status.test.ts` established — and `KNOWN` may only shrink.
//
// ── WHAT IT CATCHES, MEASURED RATHER THAN ESTIMATED ───────────────────────────────────────────────────────────
// Driven over the register at HEAD: **9 findings — 8 of REG-F-284's 40, plus REG-F-014, which the census did not
// list and which I read at its source.** No false positives: every one of the 9 was verified in the register's
// own text.
//
// ⚠ **REG-F-284's ESTIMATE OF 9-OF-40 IS ONE TOO HIGH, AND CORRECTING IT IS THE POINT OF MEASURING.** The
// measured answer is **8 of 40**. The ninth it presumably counted is `REG-Q-052`, and a supersession graph
// cannot have it and should not: the Stage A notation NARROWS that question — *"STAGE A SATISFIED; OPEN FOR
// STAGE B ONLY"*, and REG-D-017's own merge target says *"`REG-Q-052` remains OPEN only for Stage B"* — so no
// discharge edge exists. The estimate was an orchestrator's guess about a script nobody ran; this is a count.
//
// ⚠ AND THE 32 IT MISSES ARE ATTRIBUTED MECHANICALLY RATHER THAN LEFT AS A RESIDUAL. **15** — REG-Q-052,
// REG-D-017, REG-F-046, REG-F-029, REG-F-035, REG-F-037, REG-F-078, REG-F-074, REG-F-086, REG-F-113, REG-F-114,
// REG-F-118, REG-F-155, REG-F-175, REG-F-177 — have NO discharge claim anywhere in the register; their
// staleness was established by reading the CODE or the target artifact, and a supersession graph cannot see
// that, by construction. **9** — REG-F-276, REG-F-281, REG-F-104, REG-F-133, REG-F-134, REG-F-192, REG-D-016,
// REG-F-273, REG-F-277 — carry the stale clause somewhere other than the status's owed-work claim (a count, a
// superlative, a heading, an indented `- **Merge target:**` continuation). **2** — REG-F-043, REG-F-070 — have
// two live statuses and are `register-status.test.ts`'s population, not this file's. **1** — REG-F-121 — states
// the discharge only in body prose. **1** — REG-F-274 — already names its discharger and is correctly not a
// finding. **This gate closes the supersession-visible part of the class and says so.**
//
// ── TWO OBJECT GUARDS, EACH ADDED ON ADJUDICATION AND EACH MEASURED ───────────────────────────────────────────
// An earlier draft of this extractor produced **11** findings. Two were refuted by a sentence inside the very
// entry that made the claim, and the extractor was corrected rather than the finding suppressed:
//   · `REG-D-021` ← REG-D-022, from *"This entry supersedes `REG-D-021` only where the earlier entry … conflicts"*
//     — whose NEXT sentence reads *"`REG-D-021` otherwise remains effective."* A supersession that preserves the
//     target's status is not a discharge of it. → `preserves()`.
//   · `REG-F-087` ← REG-F-121, from *"**Safe default (supersedes REG-F-087's and REG-F-119's):**"* — a
//     possessive: what is superseded is the entry's SAFE DEFAULT, not the entry. REG-F-121 says so four lines
//     above — *"THE PRIOR ENTRIES ARE NOT EDITED, and that is deliberate … the entries keep their history"* —
//     so the repair this gate would have demanded is one the register forbids. → the possessive check in
//     `objectsOf()`.
// **Measured cost of both guards together: 3 edges of 56 dropped, and all three read at their source as
// misreads of the object** (the third is REG-F-122's *"Safe default (retires REG-F-119's)"*, the same possessive
// shape). **Zero findings lost.** CONTROL 6 pins both, in both directions.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const REGISTER = new URL(
	'../docs/canon/JPWB-REG-005 Decision and Divergence Register.md',
	import.meta.url
);

// ── BLOCKS ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Block {
	/** `REG-x-nnn`, or `ministerial:<slug>` for the two `###` headings that are not entry ids (fact 2). */
	readonly id: string;
	readonly isEntry: boolean;
	readonly line: number;
	readonly heading: string;
	readonly body: readonly string[];
	readonly date: string | null;
	readonly ord: number;
}

const ENTRY_ID = /^[~`*\s]*(REG-[A-Z]-\d+)/;

/**
 * Every `###` block, entry or not.
 *
 * ⚠ BOUNDED BY THE NEXT HEADING OF ANY LEVEL. Splitting on `### ` alone swallows the following `## ` section
 * heading and its preamble: the Closure sweep block then inherits Section B's *"All Section B entries:
 * **Date:** 2026-07-16"* and dates itself eight days before the act it records.
 *
 * ⚠ A MINISTERIAL BLOCK'S ID IS A SLUG OF ITS HEADING, NEVER ITS LINE. This register's own repair idiom inserts
 * lines (a strike is a new line), so a `@162` id would rot the moment the class this gate watches is repaired.
 */
export function blocks(text: string): Block[] {
	const lines = text.split('\n');
	const headings: number[] = [];
	lines.forEach((l, i) => {
		if (/^#{1,3} /.test(l)) headings.push(i);
	});
	const out: Block[] = [];
	for (let k = 0; k < headings.length; k += 1) {
		const i = headings[k]!;
		if (!lines[i]!.startsWith('### ')) continue;
		const heading = lines[i]!.slice(4);
		const m = ENTRY_ID.exec(heading);
		const body = lines.slice(i, k + 1 < headings.length ? headings[k + 1]! : lines.length);
		// The `**Date:**` bullet if there is one; otherwise the date in the HEADING, which is where the two
		// ministerial blocks carry theirs — without it the Closure sweep is not "later" than REG-F-003 and the
		// four entries it ruled on stay invisible.
		const d =
			/\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(body.join('\n')) ??
			/(\d{4}-\d{2}-\d{2})/.exec(heading);
		out.push({
			id: m ? m[1]! : `ministerial:${slug(heading)}`,
			isEntry: m !== null,
			line: i + 1,
			heading,
			body,
			date: d ? d[1]! : null,
			ord: out.length
		});
	}
	return out;
}

function slug(heading: string): string {
	return heading
		.split(/[(—–]/)[0]!
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

// ── FIELDS ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Field {
	readonly label: string;
	readonly text: string;
}

const LABEL = /\*\*([^*\n]{1,80}?):\*\*/;

/**
 * A block's bullets, split into their labelled fields.
 *
 * ⚠ ONE BULLET CARRIES SEVERAL FIELDS, SEPARATED BY `·`, AND A FIELD SPANS SEVERAL LINES. REG-D-043 puts Date,
 * Type, Status and `**Closes the decision half of:**` on ONE line — a per-line reader that takes the first bold
 * label sees only `Date` and throws the ruling away. REG-D-020 puts `supersedes` on one line and its object
 * `REG-D-019` on the next. Both edges are load-bearing and both need this segmentation.
 */
export function fields(b: Block): Field[] {
	const chunks: { heading: boolean; text: string }[] = [];
	let cur: { heading: boolean; text: string } | null = null;
	b.body.forEach((l, i) => {
		if (i === 0) {
			chunks.push({ heading: true, text: l });
			return;
		}
		if (/^[ \t]*[-*+][ \t]/.test(l) || /^\S/.test(l)) {
			cur = { heading: false, text: l };
			chunks.push(cur);
		} else if (cur !== null && l.trim() !== '') cur.text += `\n${l}`;
	});
	const out: Field[] = [];
	for (const c of chunks) {
		if (c.heading) {
			out.push({ label: '#heading', text: c.text });
			continue;
		}
		let label = '#body';
		for (const part of c.text.split('·')) {
			const m = LABEL.exec(part);
			if (m) label = m[1]!.trim();
			out.push({ label, text: part });
		}
	}
	return out;
}

/**
 * Fields in which an entry DECLARES what it acts on, as against fields in which it argues.
 *
 * ⚠ THIS IS THE WHOLE OF THE PRECISION, AND THE TRADE IS MEASURED RATHER THAN ASSERTED. Declaration fields:
 * **53 edges, 9 findings, every one verified at its source.** Every field (`allFields`): **76 edges, 14
 * findings** — the five extra being REG-F-121 (a real one of the forty, whose discharge is stated only in body
 * prose) and four read out of ARGUMENT, which I could not verify. **One catch traded for a set that is wholly
 * checkable**, and CONTROL 1 pins that the two readings still differ so the trade stays visible.
 */
const DECLARES =
	/^(?:#heading|status|merge target|disposition|safe default|type|class|origin)$|\b(?:close[sd]?|supersede[sd]?|discharge[sd]?|resolve[sd]?|answer(?:s|ed)?|settle[sd]?|retire[sd]?|dispose[sd]?)\b/i;

// ── THE STATUS VOCABULARY, DERIVED FROM §1 ────────────────────────────────────────────────────────────────────

export interface StatusToken {
	readonly name: string;
	readonly gloss: string;
}

/** The register's own normalized status enumeration, read out of §1 with each token's parenthetical gloss. */
export function vocabulary(text: string): StatusToken[] {
	const line = text
		.split('\n')
		.find((l) => l.startsWith('- **Status** (the single normalized enumeration)'));
	if (line === undefined)
		throw new Error(
			'§1 no longer carries the normalized status enumeration this gate derives from'
		);
	const out: StatusToken[] = [];
	for (const m of line.matchAll(/`([A-Z][A-Z—– -]*[A-Z])`\s*\(([^)]*)\)/g))
		out.push({ name: m[1]!, gloss: m[2]! });
	return out;
}

/** UNSETTLED is not a list here — it is whatever §1's own gloss calls pending, live, or not yet carried. */
export function unsettledTokens(vocab: readonly StatusToken[]): string[] {
	return vocab.filter((v) => /\bpending\b|\blive\b|not yet/i.test(v.gloss)).map((v) => v.name);
}

// ── DISCHARGE EDGES ───────────────────────────────────────────────────────────────────────────────────────────

export interface Edge {
	readonly from: string;
	readonly to: string;
	/** The words that made this an edge — a failure must be checkable against the text, not against the id. */
	readonly why: string;
}

const ACTIVE =
	'closes?|supersedes?|discharges?|resolves?|answers?|reverses?|retires?|overturns?|refutes?|settles?|disposes?|repairs?|corrects?';
const PASSIVE =
	'closed by|superseded by|discharged by|answered by|reversed by|disposed by|resolved by|settled by|corrected by|repaired by|retired by|refuted by|overturned by';
const VERB = new RegExp(`\\b(?:${PASSIVE}|${ACTIVE})\\b`, 'gi');
const IS_PASSIVE = new RegExp(`^(?:${PASSIVE})$`, 'i');
/** `does not settle REG-F-006's open component` is a claim NOT to have discharged it. */
const NEGATED = /\b(?:not|never|nor|neither|without|cannot|no longer)\b[^.;]{0,45}$/i;
/** `LIMBS THIS QUESTION WOULD CLOSE` is a hypothetical, not an act. */
const MODAL = /\b(?:would|could|should|may|might|will|shall|can|must)\s+$/i;

const ID_ANY =
	/^(?:\*\*|`|~~|_)*REG-([A-Z])-(\d+)((?:\.\.\s*[A-Z]?-?\d+)|(?:\s*\/\s*[A-Z]?-?\d+)+)?(?:\*\*|`|~~|_)*/;
/** The formatting assumption of fact 3, kept ONLY so CONTROL 3 can measure what it costs. Never shipped. */
export const ID_BOLD =
	/^\*\*REG-([A-Z])-(\d+)((?:\.\.\s*[A-Z]?-?\d+)|(?:\s*\/\s*[A-Z]?-?\d+)+)?\*\*/;

const SEPARATOR = /^(?:[\s,;&·+]|and\b|—|-)+/;
/**
 * What may stand between a verb and its object without another candidate object intervening.
 *
 * ⚠ ORDER MATTERS AND COST ME AN EDGE. The code-span alternative must precede the single-character class, or a
 * greedy `+` consumes the opening backtick of `` `EFFECTIVE — MERGE PENDING` `` and stops — losing REG-D-020's
 * supersession of REG-D-019, one of the forty.
 */
const LEAD =
	/^(?:`[A-Z][A-Z—– /-]*`|[\s:*`~_—-]|\bthe\b|\bboth\b|\ball\b|\bof\b|\bon\b|\bit\b|\bits\b|\bthis\b|\bentry\b|\bdecision\b|\bhalf\b|\bleg\b|\bnow\b|\balso\b|\bfully\b|\bonly\b|\blive\b|\bstate\b|\bfor\b)+/i;

/**
 * ⚠ A POSSESSIVE OBJECT IS A POSSESSION, NOT THE ENTRY. *"Safe default (supersedes **REG-F-087's** and
 * REG-F-119's)"* supersedes those entries' SAFE DEFAULTS — REG-F-121 says four lines earlier that the entries
 * themselves *"are not edited, and that is deliberate."* Reading it as a discharge produced a finding whose
 * remedy the register forbids. Measured: exactly two sites in the register, both `Safe default (…'s)`.
 */
const POSSESSIVE = /^['’]s\b/;

function idsAt(m: RegExpExecArray): string[] {
	const family = m[1]!;
	const first = Number(m[2]!);
	const out = [`REG-${family}-${m[2]!.padStart(3, '0')}`];
	const tail = m[3];
	if (tail === undefined) return out;
	if (tail.includes('..')) {
		// `REG-D-001..D-009` and `REG-D-001..007` are both in use, and the Closure sweep needs the first.
		const last = Number(/(\d+)\s*$/.exec(tail)![1]);
		if (last >= first && last - first <= 80)
			for (let n = first; n <= last; n += 1)
				out.push(`REG-${family}-${String(n).padStart(3, '0')}`);
		return out;
	}
	for (const t of tail.matchAll(/\d+/g)) out.push(`REG-${family}-${t[0].padStart(3, '0')}`);
	return out;
}

/**
 * The verb's object: the run of ids immediately after it, in any decoration, stopping at the first token that is
 * neither an id nor a separator. A character window would instead sweep up every id in the next N characters —
 * measured on an earlier draft at 85 findings, 73 of them unverifiable.
 */
export function objectsOf(
	text: string,
	from: number,
	idPattern: RegExp,
	possessives = false
): string[] {
	let i = from;
	const lead = LEAD.exec(text.slice(i, i + 70));
	if (lead) i += lead[0].length;
	const ids: string[] = [];
	for (;;) {
		const m = idPattern.exec(text.slice(i, i + 40));
		if (!m) break;
		i += m[0].length;
		if (!possessives && POSSESSIVE.test(text.slice(i, i + 4))) break;
		ids.push(...idsAt(m));
		const sep = SEPARATOR.exec(text.slice(i, i + 12));
		if (!sep) break;
		i += sep[0].length;
	}
	return ids;
}

/**
 * Does this field, having named `id`, also say `id` KEEPS its status?
 *
 * ⚠ A PARTIAL SUPERSESSION THAT PRESERVES THE TARGET'S STATUS IS NOT A DISCHARGE OF IT. REG-D-022 reads
 * *"This entry supersedes `REG-D-021` only where the earlier entry … conflicts"* and then, in the same field,
 * *"`REG-D-021` otherwise remains effective."* Reading only the first sentence produced a finding the second
 * sentence refutes.
 *
 * ⚠ THE GUARD WORDS ARE §1's OWN STATUS TOKENS, split into words — NOT a phrase list. That is fact 1 applied
 * one level down: a guard keyed on the wordings I happened to see would narrow exactly the way REG-F-095's
 * grep did. `REG-F-014` survives this guard, correctly, because REG-F-040 preserves its BODY (*"stands, is
 * correct on its merits"*) and says nothing about its status — which is the clause that is stale.
 */
export function preserves(fieldText: string, id: string, statusNames: readonly string[]): boolean {
	const words = [
		...new Set(statusNames.flatMap((n) => n.split(/[^A-Z]+/).filter((w) => w.length > 2)))
	];
	const re = new RegExp(
		`\`?${id}\`?(?:['’]s)?[^.;]{0,80}?\\b(?:remains?|stays?|stand)\\b[^.;]{0,20}?\\b(?:${words.join('|')}|in force)\\b`,
		'i'
	);
	return re.test(fieldText.replace(/\s+/g, ' '));
}

export interface EdgeOptions {
	/** Fact 3's assumption, for CONTROL 3. */
	readonly idPattern?: RegExp;
	/** Read argument prose as well as declaration fields — the control that measures the precision cost. */
	readonly allFields?: boolean;
	/** Drop the two object guards, for CONTROL 6. */
	readonly rawObjects?: boolean;
}

/** Every claim by one block to have discharged another. */
export function dischargeEdges(text: string, options: EdgeOptions = {}): Edge[] {
	const bs = blocks(text);
	const present = new Set(bs.map((b) => b.id));
	const vocab = vocabulary(text);
	const names = vocab.map((v) => v.name);
	const unsettled = unsettledTokens(vocab);
	const terminal = names.filter((n) => !unsettled.includes(n));
	const idPattern = options.idPattern ?? ID_ANY;
	const anyId = new RegExp(ID_ANY.source.slice(1), 'g');
	const out: Edge[] = [];
	const seen = new Set<string>();
	const add = (from: string, to: string, why: string): void => {
		if (from === to || !present.has(from) || !present.has(to)) return;
		if (seen.has(`${from}>${to}`)) return;
		seen.add(`${from}>${to}`);
		out.push({ from, to, why });
	};
	for (const b of bs) {
		// A ministerial block exists only to record dispositions, so all of it declares. It also has no bullets
		// to segment: the Closure sweep is one paragraph.
		const fs = b.isEntry ? fields(b) : [{ label: '#heading', text: b.body.join('\n') }];
		for (const f of fs) {
			if (options.allFields !== true && !DECLARES.test(f.label)) continue;
			for (const m of f.text.matchAll(VERB)) {
				const before = f.text.slice(Math.max(0, m.index - 60), m.index);
				if (NEGATED.test(before) || MODAL.test(before)) continue;
				for (const id of objectsOf(f.text, m.index + m[0].length, idPattern, options.rawObjects)) {
					if (options.rawObjects !== true && preserves(f.text, id, names)) continue;
					if (IS_PASSIVE.test(m[0])) add(id, b.id, m[0]);
					else add(b.id, id, m[0]);
				}
			}
			// STATUS ASSIGNMENT BY ARROW — `**REG-D-001..D-009 → MERGED**`, the Closure sweep's whole grammar.
			// It uses no verb at all, which is the second reason REG-F-284's derivation could not see it.
			for (const m of f.text.matchAll(
				/((?:REG-[A-Z]-[\d./A-Z-]*\d[\s,]*)+)[^\n]{0,20}?→\s*\*{0,2}([A-Z][A-Z ]*)/g
			)) {
				const status = m[2]!.trim();
				if (
					!terminal.some((t) => status === t || status.startsWith(`${t} `)) ||
					unsettled.includes(status)
				)
					continue;
				for (const mm of m[1]!.matchAll(anyId))
					for (const id of idsAt(mm as RegExpExecArray)) add(b.id, id, `→ ${status}`);
			}
		}
		// STATUS ASSIGNMENT BY HEADED BULLET — `- **REG-Q-051 — SUPERSEDED / CLOSED FOR STAGE A:** …`. Read
		// wherever it stands, because it names its own subject: the notation that carries it is a bold paragraph
		// inside REG-D-017, not a heading, and no field label would ever admit it.
		//
		// ⚠ THE SUBJECT IS THE BULLET'S OWN HEAD AND NOTHING ELSE. The bullet directly below it reads
		// `- **REG-Q-052 — STAGE A SATISFIED; OPEN FOR STAGE B ONLY:**`, and a reader that took the ids in the
		// bullet's BODY as objects would rule REG-Q-052 discharged when the same notation is what keeps it open.
		for (const m of b.body
			.join('\n')
			.matchAll(/^[ \t]*[-*+][ \t]*\*\*(REG-[A-Z]-\d+)\s*[—–-]\s*([^:*\n]{0,70})/gm)) {
			if (!terminal.some((t) => new RegExp(`\\b${t.split(' ')[0]!}\\b`).test(m[2]!))) continue;
			if (/\b(OPEN|PENDING|OWED)\b/.test(m[2]!)) continue;
			add(b.id, m[1]!, `assigned: ${m[2]!.trim().slice(0, 28)}`);
		}
	}
	return out;
}

// ── OWED STATUSES ─────────────────────────────────────────────────────────────────────────────────────────────

const stripCode = (l: string): string => l.replace(/`[^`]*`/g, '');
/** A terminal headline with an owed remainder — `CLOSED for the mechanism; five findings remain OPEN`. */
const RESIDUAL =
	/\b(?:remains?|still|stays?)\b[^.;]{0,60}\b(?:OPEN|OWED|PENDING|UNRESOLVED)\b|\b(?:OPEN|OWED|PENDING)\b[^.;]{0,40}\b(?:remains?|still|owed)\b|\b(?:is|are)\s+(?:still\s+)?(?:OPEN|OWED)\b|\bstill owed\b/;

/**
 * The one live status, or null. Null when there is not exactly one — that population belongs to
 * `register-status.test.ts`, and claiming it here would let a finding hide behind an unreadable status.
 */
export function liveStatus(b: Block): string | null {
	const live = b.body.filter(
		(l) => stripCode(l).includes('**Status:**') && !l.trimStart().startsWith('- ~~')
	);
	if (live.length !== 1) return null;
	const rest = live[0]!.slice(live[0]!.indexOf('**Status:**') + '**Status:**'.length);
	const next = rest.indexOf('· **');
	return next > 0 ? rest.slice(0, next) : rest;
}

/** Which §1 token this status is, or RESIDUAL, or null when it advertises nothing owed. */
export function owedKind(status: string, unsettled: readonly string[]): string | null {
	const flat = stripCode(status).replace(/[*~]+/g, '').trim();
	for (const u of unsettled)
		if (new RegExp(`(^|[\\s:.;(])${u.replace(/ /g, '\\s*')}(\\b|$)`).test(flat)) return u;
	return RESIDUAL.test(stripCode(status)) ? 'RESIDUAL' : null;
}

// ── THE FINDING ───────────────────────────────────────────────────────────────────────────────────────────────

export interface StaleStatus {
	readonly id: string;
	readonly line: number;
	readonly kind: string;
	/** The blocks claiming to have discharged it, sorted — this is what the ratchet pins. */
	readonly by: string[];
}

export function staleStatuses(text: string, options: EdgeOptions = {}): StaleStatus[] {
	const bs = blocks(text);
	const byId = new Map(bs.map((b) => [b.id, b]));
	const unsettled = unsettledTokens(vocabulary(text));
	const incoming = new Map<string, Edge[]>();
	for (const e of dischargeEdges(text, options)) {
		const list = incoming.get(e.to);
		if (list) list.push(e);
		else incoming.set(e.to, [e]);
	}
	// Date first, file order as the tiebreak: the register is sectioned rather than chronological, and the
	// Closure sweep sits 300 lines ABOVE two of the four entries it ruled on.
	const later = (x: Block, y: Block): boolean =>
		x.date !== null && y.date !== null && x.date !== y.date ? x.date > y.date : x.ord > y.ord;
	const out: StaleStatus[] = [];
	for (const b of bs) {
		if (!b.isEntry) continue;
		const status = liveStatus(b);
		if (status === null) continue;
		const kind = owedKind(status, unsettled);
		if (kind === null) continue;
		const claimers = (incoming.get(b.id) ?? []).filter((c) => {
			const from = byId.get(c.from);
			return from !== undefined && later(from, b) && !status.includes(c.from);
		});
		if (claimers.length > 0)
			out.push({
				id: b.id,
				line: b.line,
				kind,
				by: [...new Set(claimers.map((c) => c.from))].sort()
			});
	}
	return out;
}

// ── THE RATCHET ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Every entry whose live status is stale at the supersession graph today, with the blocks that discharged it.
 *
 * **SHRINK-ONLY, and pinned to its claimers rather than to a count.** Removing an id means it was repaired.
 * Adding one means a status was written, or left standing, that a later entry has already discharged. A CLAIMER
 * LIST THAT GROWS is a new act on an entry nobody re-read — the exact shape of REG-F-284's four closure-sweep
 * survivors, which sat wrong for a month because a sweep is not indexed by what it closes.
 *
 * ⚠ EIGHT OF THESE ARE REG-F-284's. THE NINTH, `REG-F-014`, IS NOT, and it was read at its source: its live
 * status says *"OPEN, NARROWED TO THE THREE ABOVE — and it should be **re-titled**"*, while REG-F-040
 * (2026-08-06) *"supersedes **REG-F-014 only as to its heading, its instance arithmetic, and the disposition of
 * its residue**"* and rules the re-title impermissible in terms — *"The register's `changeProcedure` forbids
 * it."* The status asks for an act a later entry both performed differently and forbade. The census claims no
 * denominator (REG-F-272:25136), so this extends it rather than contradicting it, and it belongs in
 * REG-F-284's record when one is next appended.
 */
const KNOWN: Readonly<Record<string, readonly string[]>> = {
	// Ruled `MERGED` by `### Closure sweep — 2026-07-24`; all four still read `DECIDED — MERGE PENDING`.
	'REG-D-008': ['ministerial:closure-sweep'],
	'REG-D-009': ['ministerial:closure-sweep'],
	'REG-F-003': ['ministerial:closure-sweep'],
	'REG-F-004': ['ministerial:closure-sweep'],
	// Status still asks for a re-title REG-F-040 superseded and forbade. Not in REG-F-284; verified here.
	'REG-F-014': ['REG-F-040'],
	// `**Type:** DECISION RECORD (closes REG-F-045, filed 2026-08-06)`; REG-F-045 still reads `OPEN.`
	'REG-F-045': ['REG-D-040'],
	// `- **REG-Q-051 — SUPERSEDED / CLOSED FOR STAGE A:**` in REG-D-017's notation; still reads `OPEN.`
	'REG-Q-051': ['REG-D-017'],
	// `supersedes only the live \`EFFECTIVE — MERGE PENDING\` state of \`REG-D-019\`` — and it still reads it.
	'REG-D-019': ['REG-D-020'],
	// `**Closes the decision half of:** REG-F-083`; REG-F-083 still reads `OPEN`.
	'REG-F-083': ['REG-D-043']
};

describe('P-5b — no entry advertises work a later entry has already discharged', () => {
	const text = readFileSync(REGISTER, 'utf8');
	const found = staleStatuses(text);
	const derived = new Map(found.map((f) => [f.id, f.by]));

	it('no NEW entry stands stale against the supersession graph', () => {
		expect(
			found
				.filter((f) => !(f.id in KNOWN))
				.map((f) => `${f.id}:${f.line} (${f.kind}) discharged by ${f.by.join(', ')}`),
			'entry/entries whose live **Status:** advertises owed work that a LATER block claims to have done, ' +
				'and which do not name that block. Either strike the status and add a replacement citing the ' +
				'discharger, or — if the discharge is partial — say so in the status. Do not add the id to KNOWN ' +
				'to silence this: KNOWN is the population this gate inherited and it may only shrink.'
		).toEqual([]);
	});

	it('every KNOWN id is still stale — a repair must be removed from the list deliberately', () => {
		expect(
			Object.keys(KNOWN).filter((id) => !derived.has(id)),
			'KNOWN id(s) that no longer read as stale — the status was repaired, so remove them from the list. ' +
				'The list is SHRINK-ONLY; leaving a repaired id in it lets the next regression hide behind it.'
		).toEqual([]);
	});

	it('no KNOWN entry has acquired a NEW discharger nobody carried into its status', () => {
		expect(
			[...derived]
				.filter(([id, by]) => id in KNOWN && by.join(' ') !== KNOWN[id]!.join(' '))
				.map(([id, by]) => `${id}: ${KNOWN[id]!.join(', ')} -> ${by.join(', ')}`),
			'a later entry now claims to discharge an already-stale entry, and its status still does not say so. ' +
				'This is REG-F-284’s four closure-sweep survivors exactly: the ruling exists and the status never ' +
				'received it. Carry the discharge into the status, or update KNOWN with the reason recorded.'
		).toEqual([]);
	});

	// CONTROL 1 — THE POPULATION IS REAL. Every assertion above is satisfied by a parser that returns nothing.
	// ⚠ ITS OWN MUTANT: make `blocks()` return `[]`. All three assertions above stay green and this reddens.
	it('CONTROL — the parser reads a real register with a real vocabulary', () => {
		const bs = blocks(text);
		expect(bs.length, 'blocks parsed').toBeGreaterThan(350);
		expect(bs.filter((b) => b.isEntry).length, 'entries parsed').toBeGreaterThan(350);
		const vocab = vocabulary(text);
		expect(vocab.length, '§1 status tokens').toBeGreaterThanOrEqual(8);
		const unsettled = unsettledTokens(vocab);
		expect(unsettled, 'derived from §1 glosses, never enumerated here').toContain(
			'DECIDED — MERGE PENDING'
		);
		expect(unsettled.length, 'and the split is a split — not everything, not nothing').toBeLessThan(
			vocab.length
		);
		expect(dischargeEdges(text).length, 'discharge edges').toBeGreaterThan(30);
		expect(
			found.length,
			'findings — a zero here would be the instrument, not the register'
		).toBeGreaterThan(4);
		// AND THE DECLARATION-SITE RESTRICTION IS STILL DOING WORK. If reading argument prose ever stopped
		// adding edges, the restriction would be free and its measured cost (one real catch, REG-F-121) would
		// be a claim about a reading nobody performs.
		expect(
			dischargeEdges(text, { allFields: true }).length,
			'reading argument prose as well must still find MORE — that gap is the precision this file buys'
		).toBeGreaterThan(dischargeEdges(text).length);
	});

	// CONTROL 2 — THE NON-ENTRY HEADINGS ARE VISIBLE (fact 2). ⚠ ITS OWN MUTANT: restrict `blocks()` to
	// `^### REG-` — REG-F-284's own instrument bug — and this fails at 0 edges while CONTROL 1 still passes
	// with 403 entries. That is precisely how a derivation reported 9 where the answer was 40.
	it('CONTROL — the ministerial Closure sweep is read, and it rules on twelve entries', () => {
		const bs = blocks(text);
		expect(
			bs
				.filter((b) => !b.isEntry)
				.map((b) => b.id)
				.sort(),
			'the two `###` headings that are not entry ids'
		).toEqual(['ministerial:closure-sweep', 'ministerial:hygiene-passes']);
		expect(
			new Set(bs.map((b) => b.id)).size,
			'block ids are unique, so a slug never collides with an entry'
		).toBe(bs.length);
		expect(
			dischargeEdges(text)
				.filter((e) => e.from === 'ministerial:closure-sweep')
				.map((e) => e.to)
				.sort(),
			'REG-D-001..D-009, REG-Q-001, REG-F-003 and REG-F-004 — the ruling REG-F-284 found unindexed'
		).toEqual([
			'REG-D-001',
			'REG-D-002',
			'REG-D-003',
			'REG-D-004',
			'REG-D-005',
			'REG-D-006',
			'REG-D-007',
			'REG-D-008',
			'REG-D-009',
			'REG-F-003',
			'REG-F-004',
			'REG-Q-001'
		]);
	});

	// CONTROL 3 — FORMATTING BLINDNESS IS STILL MEASURED (fact 3). ⚠ ITS OWN MUTANT: point the shipped read at
	// `ID_BOLD` and this fails while the ratchet's own message says nothing about formatting.
	it('CONTROL — ids are read in any decoration, and requiring bold would still cost most of the graph', () => {
		const any = dischargeEdges(text);
		const bold = dischargeEdges(text, { idPattern: ID_BOLD });
		expect(bold.length, 'a bold-only reading').toBeLessThan(any.length / 2);
		expect(
			any.some((e) => e.from === 'REG-D-020' && e.to === 'REG-D-019'),
			"REG-D-020's `supersedes only the live `EFFECTIVE — MERGE PENDING` state of `REG-D-019`` — " +
				'backticked, multi-line, and one of REG-F-284’s forty'
		).toBe(true);
		expect(
			bold.some((e) => e.from === 'REG-D-020' && e.to === 'REG-D-019'),
			'and invisible to the bold assumption'
		).toBe(false);
	});

	// CONTROL 4 — IT DISCRIMINATES IN BOTH DIRECTIONS. Without this, a rule that flagged every OPEN entry with
	// any later mention would pass CONTROLs 1-3 and mean nothing. The GREEN half is what makes it a control
	// rather than a tripwire: it must tell the forbidden arrangement from the four permitted ones.
	it('CONTROL — a discharged-and-unsaid status is flagged; cited, earlier, negated and modal ones are not', () => {
		const preamble = text.slice(0, text.indexOf('### REG-D-001'));
		const pair = (statusLine: string, closer: string, closerDate = '2026-08-30'): string =>
			[
				preamble,
				'### REG-F-999 — a fixture entry',
				'- **Date:** 2026-08-29 · **Type:** DIVERGENCE FINDING',
				statusLine,
				'',
				'### REG-F-998 — the fixture that acts on it',
				`- **Date:** ${closerDate} · **Type:** DIVERGENCE FINDING`,
				`- **Merge target:** Repository. ${closer} **Status:** MERGED.`,
				''
			].join('\n');
		const OPEN = '- **Merge target:** Repository. **Status:** OPEN.';
		const ids = (t: string): string[] => staleStatuses(t).map((f) => f.id);

		expect(ids(pair(OPEN, 'Closes **REG-F-999**.')), 'the forbidden arrangement').toEqual([
			'REG-F-999'
		]);
		expect(
			ids(
				pair(
					'- **Merge target:** Repository. **Status:** OPEN — discharged by **REG-F-998**; carriage pending.',
					'Closes **REG-F-999**.'
				)
			),
			'a status that names its discharger is exactly the permitted act'
		).toEqual([]);
		expect(
			ids(pair(OPEN, 'Closes **REG-F-999**.', '2026-08-01')),
			'an EARLIER entry cannot have discharged it'
		).toEqual([]);
		expect(
			ids(pair(OPEN, 'Does not close **REG-F-999**.')),
			'a claim NOT to have closed it'
		).toEqual([]);
		expect(
			ids(pair(OPEN, 'It would close **REG-F-999**.')),
			'a hypothetical is not an act'
		).toEqual([]);
		expect(
			ids(pair('- **Merge target:** Repository. **Status:** MERGED.', 'Closes **REG-F-999**.')),
			'nothing owed, nothing stale'
		).toEqual([]);
	});

	// CONTROL 5 — THE TWO VERB-FREE ASSIGNMENT GRAMMARS ARE READ. Neither uses a discharge verb, and the
	// register's oldest stale statuses are downstream of both. ⚠ ITS OWN MUTANT: delete either grammar and one
	// of the two ids below disappears.
	it('CONTROL — status assignment by arrow and by headed bullet both produce edges', () => {
		const preamble = text.slice(0, text.indexOf('### REG-D-001'));
		const fixture = [
			preamble,
			'### REG-F-999 — a fixture entry',
			'- **Date:** 2026-08-29 · **Type:** DIVERGENCE FINDING',
			'- **Merge target:** Repository. **Status:** OPEN.',
			'',
			'### REG-F-998 — a second fixture entry',
			'- **Date:** 2026-08-29 · **Type:** DIVERGENCE FINDING',
			'- **Merge target:** Repository. **Status:** OPEN.',
			'',
			'### Fixture sweep — 2026-08-30 (ministerial)',
			'Every closure condition fired: **REG-F-999 → MERGED**.',
			'',
			'- **REG-F-998 — SUPERSEDED / CLOSED:** carried elsewhere.',
			''
		].join('\n');
		expect(
			staleStatuses(fixture)
				.map((f) => `${f.id} <- ${f.by.join(',')}`)
				.sort(),
			'arrow and headed-bullet assignment'
		).toEqual(['REG-F-998 <- ministerial:fixture-sweep', 'REG-F-999 <- ministerial:fixture-sweep']);
	});

	// CONTROL 6 — THE TWO OBJECT GUARDS, IN BOTH DIRECTIONS AND ON THE REAL REGISTER. Each was added because it
	// killed a finding the claimer's own next sentence refutes; without a control they would be invisible
	// suppressions. ⚠ ITS OWN MUTANT: pass `rawObjects` in the shipped read — the two ids below come back as
	// findings, this control reddens, and assertion 1 reddens with it naming them.
	it('CONTROL — a possessive object and a preserved status are not discharges, and the guards cost nothing else', () => {
		const guarded = dischargeEdges(text);
		const raw = dischargeEdges(text, { rawObjects: true });
		const key = (e: Edge): string => `${e.from}>${e.to}`;
		const dropped = raw.filter((e) => !guarded.some((g) => key(g) === key(e))).map(key);
		expect(
			dropped.sort(),
			'exactly the four misread objects, each verified at its source: REG-D-022 preserves REG-D-021 ' +
				'(“otherwise remains effective”); REG-F-121/REG-F-122 supersede a possession — those ' +
				'entries’ SAFE DEFAULTS — while saying in terms that the entries themselves are not edited; ' +
				'and REG-F-285 discharges REG-F-284’s REPOSITORY LEG, a possession, while that entry stays ' +
				'legitimately OPEN on the 28 clauses it deliberately did not repair. ' +
				'⚠ THE FOURTH ARRIVED ON THE DAY THIS GATE SHIPPED, from the entry announcing it: REG-F-285 ' +
				'both DESCRIBES the possessive guard and TRIPS it, because a partial discharge is naturally ' +
				'written as “X’s Y leg”. That is the guard working, not a regression — and it is why this ' +
				'control pins the dropped set by name rather than by count.'
		).toEqual([
			'REG-D-022>REG-D-021',
			'REG-F-121>REG-F-087',
			'REG-F-122>REG-F-119',
			'REG-F-285>REG-F-284'
		]);
		expect(
			staleStatuses(text, { rawObjects: true })
				.map((f) => f.id)
				.filter((id) => !derived.has(id))
				.sort(),
			'and dropping the guards costs exactly three false findings — the two adjudication killed, plus ' +
				'REG-F-284, which would be reported stale on the strength of REG-F-285 discharging one LEG of ' +
				'it. ⚠ The third is the sharper one: it is not a misreading of an old entry but a NEW entry ' +
				'written correctly, and without the possessive guard this gate would demand that a partially ' +
				'discharged entry close while 28 of its clauses are deliberately unrepaired.'
		).toEqual(['REG-D-021', 'REG-F-087', 'REG-F-284']);
		// AND THE GUARDS MUST NOT BE TOTAL. A guard that rejected every partial supersession would also lose
		// REG-F-014 — where REG-F-040 preserves the BODY and says nothing about the status.
		expect(
			guarded.some((e) => e.from === 'REG-F-040' && e.to === 'REG-F-014'),
			'REG-F-040 supersedes REG-F-014 “only as to its heading” and preserves its BODY, not its status — ' +
				'so the edge stands, and this is the known-opposite of the REG-D-021 case above'
		).toBe(true);
		expect(preserves('`REG-X-001` otherwise remains effective.', 'REG-X-001', ['EFFECTIVE'])).toBe(
			true
		);
		expect(
			preserves('REG-X-001’s body stands and is correct on its merits.', 'REG-X-001', [
				'EFFECTIVE'
			]),
			'a preserved BODY is not a preserved STATUS'
		).toBe(false);
	});
});