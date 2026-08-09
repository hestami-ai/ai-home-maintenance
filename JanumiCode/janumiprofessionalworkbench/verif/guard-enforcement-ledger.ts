// C-0b — EVERY DECLARED ARROW GUARD IS CLASSIFIED, AND THE CLASSIFICATION IS PERSISTED.
//
// ── WHAT WAS MISSING, AND WHY A ONE-OFF CENSUS WAS NOT ENOUGH ────────────────────────────────────────────────
// `transitions.data.ts` declares a `guard:` string on 152 arrows in 86 distinct texts, and REG-F-072 recorded
// that **no control in this repository has ever checked that any of them is enforced**. That finding came with a
// census — UNENFORCED 33 · ARROW_UNREACHABLE 26 · ENFORCED 21 · NOT_MECHANICALLY_CHECKABLE 4 ·
// REDUNDANT_WITH_MACHINE 2 — and **the per-text result was never persisted anywhere**. So the repository carried
// a headline number it could not reproduce, and "this increment closes N of 33" could be bounded but never
// verified. A census that leaves no ledger is an anecdote.
//
// ── THE POPULATION IS DERIVED FROM THE EXPORTED DATA, NEVER PARSED, AND THAT IS NOT FASTIDIOUSNESS ───────────
// The first attempt at this file line-parsed `transitions.data.ts` and found 108 of its 154 raw `guard:`
// occurrences — a SILENT 30% DROP, because guards also sit in the `guarded` and `illegal` sections and some are
// written across lines. It was caught only by comparing against a raw `grep -c`, and it would have produced a
// ledger that looked complete while omitting a third of the surface. `STATE_MACHINES` already holds the parsed
// values; reading them removes the whole class, the same way C-0c reads `STEP_COMMAND_SPECS` rather than
// re-parsing its file.
//
// ⚠ AND THE EXCLUSION LIST IS SHARED, not re-invented here — `machine-exclusions.ts`, the same table C-0 and C-0c
// read. Two censuses over one table must not each keep their own idea of the table.
import { readFileSync } from 'node:fs';
import { STATE_MACHINES, isExcludedMachine } from '@janumipwb/rph-domain';

/** What a declared guard text turned out to be, once someone read the code that performs its arrows. */
export type GuardDisposition =
	/** A production write path evaluates the condition and REFUSES when unmet. `enforcingSite` is mandatory. */
	| 'ENFORCED'
	/** The arrow is performable and nothing checks the condition. The DEFAULT when in doubt. */
	| 'UNENFORCED'
	/** No command can perform the arrow, so the guard cannot fire. */
	| 'ARROW_UNREACHABLE'
	/** The text states something no code could decide. */
	| 'NOT_MECHANICALLY_CHECKABLE'
	/** The transition table already makes the illegal case impossible; the guard restates the machine. */
	| 'REDUNDANT_WITH_MACHINE';

export interface GuardRow {
	readonly disposition: GuardDisposition;
	/** Why — file:line and what the code does. Never a bare assertion. */
	readonly evidence: string;
	/**
	 * ENFORCED only: the handler site. Required, and the test enforces that it is.
	 *
	 * ⚠ THE LINE NUMBER IS A NAVIGATION HINT AND NOTHING MORE. Six of the fourteen went stale within two days of
	 * being written — pointing at `({`, at `/**`, at a doc comment — because every edit above them shifts them,
	 * and the first version of this control only checked the string was non-empty. **That is a control that
	 * cannot fail on the thing it claims.** What is CHECKED is `enforcingAnchor`.
	 */
	readonly enforcingSite?: string;
	/**
	 * ENFORCED only: a distinctive fragment that must appear EXACTLY ONCE in the file named by `enforcingSite`.
	 *
	 * Text, not a line number, for the same reason `scripts/mutants/ledger.ts` anchors on text: a line number
	 * rots on the next edit and rots SILENTLY, whereas a moved anchor either still exists (and the row is fine)
	 * or does not (and the row reddens). Exactly-once, because an anchor matching twice cannot say which site
	 * the row means — and an auto-derivation that took the NEAREST refusal to each stale line mapped three
	 * cross-axis rows onto an unrelated staleness check before this uniqueness rule caught it.
	 */
	readonly enforcingAnchor?: string;
}

/** One arrow that carries a guard, as the exported machine data holds it. */
export interface GuardedArrow {
	readonly machine: string;
	readonly from: string;
	readonly to: string;
	readonly guard: string;
}

/**
 * Every guarded arrow on a non-excluded machine, read from `STATE_MACHINES` at runtime.
 *
 * Scoped to the `transitions` section deliberately: `guarded` and `illegal` rows carry prose too, but they
 * describe edges the machine already forbids or qualifies rather than arrows a command performs, and mixing them
 * in would make "is this enforced?" mean two different questions in one ledger.
 */
export function guardedArrows(): GuardedArrow[] {
	const out: GuardedArrow[] = [];
	for (const [machine, def] of Object.entries(STATE_MACHINES)) {
		if (isExcludedMachine(machine)) continue;
		const transitions = (def as unknown as { transitions?: readonly Record<string, unknown>[] })
			.transitions;
		for (const t of transitions ?? []) {
			if (typeof t.guard === 'string' && t.guard !== '')
				out.push({ machine, from: String(t.from), to: String(t.to), guard: t.guard });
		}
	}
	if (out.length === 0)
		throw new Error('guard-enforcement-ledger: no guarded arrows found at all — the reader is broken');
	return out;
}

/** The distinct guard texts, sorted, which is what the ledger is keyed by. */
export const guardTexts = (): string[] =>
	[...new Set(guardedArrows().map((a) => a.guard))].sort((a, b) => a.localeCompare(b));

export interface LedgerAudit {
	/** Declared guard texts with NO ledger row. A new guard cannot be added without classifying it. */
	readonly unclassified: string[];
	/** Ledger rows naming a text no arrow declares — a stale row, left behind by an edit upstream. */
	readonly stale: string[];
	/** ENFORCED rows that name no enforcing site. "Enforced" without a site is the claim, not the evidence. */
	readonly enforcedWithoutSite: string[];
	/** ENFORCED rows whose anchor is missing, absent from its file, or matches more than once. */
	readonly enforcedAnchorBroken: string[];
	/** How many texts fell in each disposition. */
	readonly counts: Readonly<Record<string, number>>;
	/** Arrows and texts, so the ledger cannot be "improved" by deleting guards from the machine table. */
	readonly arrowCount: number;
	readonly textCount: number;
}

/**
 * Why an ENFORCED row's anchor does not hold, or `undefined` when it does.
 *
 * Reads the file off disk deliberately: the claim is about the SOURCE the ledger cites, and a check that read
 * anything else would be checking a copy of itself.
 */
function anchorFault(row: GuardRow): string | undefined {
	const site = row.enforcingSite;
	const anchor = row.enforcingAnchor;
	if (!anchor) return 'no enforcingAnchor';
	if (!site) return 'no enforcingSite';
	const file = site.replace(/:\d+$/, '');
	let text: string;
	try {
		text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
	} catch {
		return `cannot read ${file}`;
	}
	const hits = text.split(anchor).length - 1;
	if (hits === 0) return `anchor absent from ${file}`;
	if (hits > 1) return `anchor matches ${hits} times in ${file} — ambiguous`;
	return undefined;
}

export function auditLedger(ledger: Readonly<Record<string, GuardRow>>): LedgerAudit {
	const texts = guardTexts();
	const declared = new Set(texts);
	const counts: Record<string, number> = {};
	for (const t of texts) {
		const row = ledger[t];
		if (row) counts[row.disposition] = (counts[row.disposition] ?? 0) + 1;
	}
	return {
		unclassified: texts.filter((t) => !ledger[t]),
		stale: Object.keys(ledger)
			.filter((t) => !declared.has(t))
			.sort((a, b) => a.localeCompare(b)),
		enforcedWithoutSite: texts
			.filter((t) => ledger[t]?.disposition === 'ENFORCED' && !ledger[t]?.enforcingSite)
			.sort((a, b) => a.localeCompare(b)),
		enforcedAnchorBroken: texts
			.filter((t) => ledger[t]?.disposition === 'ENFORCED')
			.map((t) => ({ t, why: anchorFault(ledger[t]!) }))
			.filter((r) => r.why !== undefined)
			.map((r) => `${r.t}  [${r.why}]`)
			.sort((a, b) => a.localeCompare(b)),
		counts,
		arrowCount: guardedArrows().length,
		textCount: texts.length
	};
}
