// P-2 — make a canon clause's PROVENANCE and its RATIFYING ACTS reachable mechanically.
//
// ⚠ THIS IS NOT TOOLING. IT IS THE MECHANISM A CONSTITUTIONAL CLAUSE REQUIRES. CON-000 **B3**, as amended by
// REG-D-034 (sponsor ruling, 2026-08-09), reads: canon governs a principle *"only if the divergence carries a
// ratifying act naming it"*, and otherwise the canon clause is *"DEFECTIVE, not governing"*.
//
// To APPLY that clause you must be able to answer two questions about any canon rule:
//   (a) what source was it distilled from?   — the `.provenance.md` sidecars know, in prose
//   (b) is there a ratifying act naming it?  — the register knows, if you read it correctly
// A constitutional clause nobody can mechanically apply is CON-000 B7's hollow — *"no artifact… may claim a
// status its relations do not perform"* — one level up, in the constitution itself.
//
// ⚠ THREE TRAPS, ALL OF WHICH THE FIRST VERSION OF THIS FILE FELL INTO. They are documented because each one
// silently INVERTED an answer rather than failing loudly:
//
//  1. A FINDING IS NOT A RATIFYING ACT. `REG-F-094` discusses `ASR-14` and `ASR-16` at length — it is the entry
//     that identified them as DEFECTIVE. Searching the register for a clause name therefore reports an act for
//     exactly the two clauses that have none. Only `REG-D-*` confers.
//  2. NOR IS BEING MENTIONED BY A DECISION. Scoping to `REG-D-*` sections is still not enough: `REG-D-034`'s own
//     body discusses `ASR-14`, `ASR-16` and `PER-12`, so all three came back "ratified". **The discriminator is
//     the `Merge target` line** — REG-D-015 merges into *"JPWB-DOC-003 PER-12 (applied)"*, whereas REG-D-034
//     merges into *"JPWB-CON-000 B1 / B3 / B8"* and ratifies none of the three it discusses.
//  3. THE SIDECARS USE MORE THAN ONE LINE FORMAT. Requiring `- ID:` indexed 62 entries and silently dropped the
//     12-strong `- ID <text>` family (all of AX-*). A reader that under-reads its own population is the defect
//     this repository has measured four times in two days; the format census is asserted in the paired test.
import { readFileSync, readdirSync } from 'node:fs';

const CANON = new URL('../docs/canon/', import.meta.url);
const REGISTER = new URL('./JPWB-REG-005 Decision and Divergence Register.md', CANON);

export interface ClauseProvenance {
	readonly clause: string;
	readonly sidecar: string;
	/** the citation text, verbatim — never paraphrased */
	readonly citation: string;
	/**
	 * TRUE when the citation names no source document at all.
	 *
	 * ⚠ ANCHORED TO THE START, and it took two wrong versions to get here. Testing for the word NEW ANYWHERE
	 * wrongly flagged `ASR-14`, whose citation is richly sourced but ends *"NON-EXAMPLE: NEW (P6)"*. Testing
	 * instead for the mere PRESENCE of a source marker then wrongly cleared `OBJ-7`, whose citation opens
	 * *"NEW — brief §10.7 anti-vacuity clause"* and only later cites the Guide in support.
	 *
	 * The sidecars put the STATEMENT's provenance first, so that is what the flag reads. A clause may have an
	 * authored statement with supporting citations, or a distilled statement with an authored NON-EXAMPLE, and
	 * only position distinguishes them.
	 */
	readonly unsourced: boolean;
}

/** The statement's own provenance is the FIRST thing the citation names. */
const AUTHORED_AT_CANON = /^(NEW\b|session consensus)/i;

/** Every clause-keyed entry across the canon provenance sidecars, in either line format. */
export function provenanceIndex(): Map<string, ClauseProvenance> {
	const out = new Map<string, ClauseProvenance>();
	for (const file of readdirSync(CANON).sort()) {
		if (!file.includes('provenance.md')) continue;
		for (const raw of readFileSync(new URL(file, CANON), 'utf8').split('\n')) {
			// Both observed primary formats: `- ID: citation` and `- ID citation`. Section-keyed repair notes
			// (`- **§9 PER-7 SCOPE**: …`) are deliberately NOT primary entries — they annotate part of a clause.
			// Deliberately simple, and simplified twice for it (SonarLint S8786): `\s*:?\s+` backtracks
			// super-linearly, and the `\*{0,2}` bold-tolerance added a second ambiguity for nothing — the census
			// shows primary entries are only `- ID:` or `- ID `, while the bold `- **§9 ID**:` forms are
			// section-keyed repair notes this reader excludes on purpose. The count is pinned by the test, so a
			// simplification that quietly narrows the population fails there.
			// The `\S` anchor is what finally removed the ambiguity: ` +(.+)` lets `.` match spaces too, so the
			// separator and the capture compete for the same run of blanks. Requiring the capture to begin with a
			// non-space makes the split deterministic.
			const m = /^- ([A-Z]{2,4}-\d+):? +(\S.*)$/.exec(raw.trim());
			if (!m) continue;
			const [, clause, citation] = m;
			if (out.has(clause!)) continue; // a clause belongs to exactly one artifact; first entry wins
			out.set(clause!, {
				clause: clause!,
				sidecar: file,
				citation: citation!.trim(),
				unsourced: AUTHORED_AT_CANON.test(citation!.trim())
			});
		}
	}
	return out;
}

export function provenanceOf(clause: string): ClauseProvenance | undefined {
	return provenanceIndex().get(clause);
}

/**
 * The `REG-D-*` decisions that RATIFY `clause` — determined by their **Merge target**, not by mention.
 *
 * See trap 2 above: mention is not conferral, and the difference inverts the answer for every clause a decision
 * merely discusses. A decision ratifies a clause when it says where it merged and that target names the clause.
 */
export function ratifyingActsFor(clause: string): string[] {
	const acts: string[] = [];
	let current: string | undefined;
	for (const line of readFileSync(REGISTER, 'utf8').split('\n')) {
		const heading = /^#{2,4}\s+(REG-[A-Z]-\d+)\b/.exec(line);
		if (heading) {
			current = heading[1]!.startsWith('REG-D-') ? heading[1] : undefined;
			continue;
		}
		if (!current) continue;
		// Literal, not tolerant: censused across the register as 180 × `- **Merge target:** ` and 1 ×
		// `- **Merge targets (a…`. Optional quantifiers here only bought SonarLint S8786 backtracking, and the
		// paired test pins the population so a narrowing that loses lines fails there rather than silently.
		const merge = /^- \*\*Merge targets?[:*]{0,3} ?(.*)$/.exec(line.trim());
		if (!merge) continue;
		// ⚠ TRAP 2, THIRD FORM — and I caused this one myself, minutes after gating against the first two.
		// A register line is `- **Merge target:** <target>. **Status:** … **Next:** …`, and REG-D-035's own
		// Merge-target line ended with "Next: P-4 (ASR-14/ASR-16 repairs)". Matching the whole LINE therefore
		// reported REG-D-035 as ratifying the two clauses it merely scheduled — inverting the verdict for
		// exactly the clauses the ruling is about, for the third distinct reason. Only the text BEFORE the next
		// bold field label is the target.
		const target = merge[1]!.split(/\*\*/)[0]!;
		// Word-boundary match so `PER-1` does not match `PER-12`.
		if (new RegExp(String.raw`\b${clause}\b`).test(target)) acts.push(current);
	}
	return [...new Set(acts)];
}

/**
 * B3 applied to one clause, mechanically.
 *
 * Answers the half B3 makes decidable — *if this clause diverges from its source, does it still govern?* — and
 * deliberately NOT whether it diverges, which requires reading both texts. `RULING_SOURCED` is a real category,
 * not a gap: `PER-12` has no sidecar entry because REG-D-015 REPLACED its content, so the ruling IS its
 * provenance.
 */
export function b3Standing(clause: string): {
	clause: string;
	provenance: 'DISTILLED' | 'AUTHORED_AT_CANON' | 'RULING_SOURCED' | 'NO_RECORD';
	citation?: string;
	ratifyingActs: string[];
	divergenceWouldBePermitted: boolean;
} {
	const p = provenanceOf(clause);
	const acts = ratifyingActsFor(clause);
	let provenance: 'DISTILLED' | 'AUTHORED_AT_CANON' | 'RULING_SOURCED' | 'NO_RECORD';
	if (p) {
		provenance = p.unsourced ? 'AUTHORED_AT_CANON' : 'DISTILLED';
	} else {
		// No sidecar entry is NOT automatically a gap: a clause whose content a RULING replaced has the ruling as
		// its provenance (PER-12 / REG-D-015). Only the actless case is a true absence of record.
		provenance = acts.length > 0 ? 'RULING_SOURCED' : 'NO_RECORD';
	}
	return {
		clause,
		provenance,
		citation: p?.citation,
		ratifyingActs: acts,
		divergenceWouldBePermitted: acts.length > 0
	};
}
