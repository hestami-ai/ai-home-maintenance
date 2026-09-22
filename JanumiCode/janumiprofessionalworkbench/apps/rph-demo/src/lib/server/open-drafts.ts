// ── WHICH PWAs HAVE AN OPEN AUTHORING DRAFT, IN THIS PROCESS (`JAN-CRITREAD` `DD-4`, `REG-D-070` §5.6) ──────────────
//
// A draft HOLDS its PWA from the moment its turn begins until it is committed or discarded — CONFLICTED and
// COMMIT_FAILED included, since their only exit is DISCARD, so the professional releases it by discarding. While a
// PWA is held, the workbench refuses a manual write to it: the page renders the draft's fork, so a manual edit would
// be invisible there, and would later refuse the draft at acceptance.
//
// `authoring-turn.ts` writes this and `workbench.ts` reads it — neither imports the other.
//
// ⚠ IN-MEMORY AND PER PROCESS, AND CORRECTNESS DOES NOT REST ON IT (PER-6, AX-10). The acceptance check is the durable
// guarantee: no draft is ever saved stale. This only stops a same-process edit from silently destroying a draft; with
// several processes (the SaaS and Enterprise tiers, `REG-D-041`) an edit in one still makes a draft in another be
// refused at acceptance, naming what changed. A durable per-PWA lease is the design-out, owed (DESIGN §10). A process
// restart releases everything, because turns are in memory too.

const held = new Map<string, string>();

/** The turn now holding `pwaId`. A PWA has at most one open draft per process (`beginAuthoringTurn` refuses a second). */
export function holdForDraft(pwaId: string, turnId: string): void {
	held.set(pwaId, turnId);
}

/** Release `pwaId` — only if `turnId` is the turn holding it, so a stale release cannot free a successor's hold. */
export function releaseDraft(pwaId: string, turnId: string): void {
	if (held.get(pwaId) === turnId) held.delete(pwaId);
}

/** The id of the turn holding `pwaId`, if a draft on it is open. */
export function openDraftOn(pwaId: string): string | undefined {
	return held.get(pwaId);
}
