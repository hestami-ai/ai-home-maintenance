// ⭐ `JAN-CRITREAD` J2-3 — THE DIGESTS A QUALIFICATION RECORD IS STAMPED WITH, AND THE ONE WAY THEY ARE WRITTEN
// (DESIGN-what-the-tests-prove.md §5.5).
//
// ⚠ PURE, AND IMPORTING NOTHING BUT `node:crypto`. The check's core (`check-core.ts`) reads a record against the
// current reviewer fingerprint with this module and nothing heavier: deciding whether a move was confined to the
// scoring needs only the components and the one function that combines them, never the validator.

import { createHash } from 'node:crypto';

export const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** JSON with every object's keys sorted, at every depth — for values whose key order carries no behaviour. */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(value, (_key, v: unknown) =>
		typeof v === 'object' && v !== null && !Array.isArray(v)
			? Object.fromEntries(
					Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
				)
			: v
	);
}

/**
 * ⭐ THE FOUR COMPONENTS OF THE REVIEWER FINGERPRINT (§5.5), each a sha256.
 *   · `probes`   — the materialized prompts of the fingerprint probe set (`probes.ts`), one per branch of assembly;
 *   · `budget`   — the excerpt budget constants themselves (`REASONING_REVIEW_BUDGET`), hashed explicitly;
 *   · `criteria` — the seed criteria as whole objects;
 *   · `scoring`  — the scoring digest: a fixed corpus of raw replies through the real path (`scoring-corpus.ts`).
 */
export interface FingerprintComponents {
	readonly probes: string;
	readonly budget: string;
	readonly criteria: string;
	readonly scoring: string;
}

/**
 * The reviewer fingerprint of its four components.
 * ⭐ WHY IT IS A HASH OF THE COMPONENT HASHES: a RUN line records the fingerprint and the scoring digest, never the
 * other three — yet the check must tell a move confined to the SCORING (discharged by RESCORED alone) from one in the
 * probe set, the budget or the criteria (which also owes an ACKNOWLEDGED line, §5.6 limb 1). Recombining TODAY's
 * prompt-side components with the RUN's own scoring digest reproduces its fingerprint exactly when nothing but the
 * scoring moved since it — so the question needs no field the record does not already carry.
 */
export function reviewerFingerprintOf(c: FingerprintComponents): string {
	return sha256(canonicalJson({ budget: c.budget, criteria: c.criteria, probes: c.probes, scoring: c.scoring }));
}
