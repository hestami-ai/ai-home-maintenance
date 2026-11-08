// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D51 and D54 (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.3 and
// §12.6, revision 9) — THE IDENTITY THE DECISION MODEL IS HELD TO: the model, its served digest and the Ollama server's version that
// D54's records were made on (`docs/tracking/reviewer-qualification/decision-model/`, each file's `IDENTITY` line).
//   · the product's client is held to it before a review's first request (D51: *"The served digest and server version must equal
//     D54's records"*; `decision-model.ts`);
//   · the static source refuses records of any other identity, never reading them (`scripts/reviewer-qual/recorded-indications.ts`);
//   · the reviewer fingerprint's pointer component covers it, so another identity moves the fingerprint (D54).
// ⛔ ONE PLACE, AND HELD TO THE RECORDS BY A TEST: `verif/recorded-indications.test.ts` reads the committed records' identity lines
// and requires this, byte for byte. A server update changes the scoring identity (`REG-F-608`): new records, this restated with
// them, and qualification owed again.
// ⚠ PURE, IMPORTING NOTHING.

/** A decision model's scoring identity: the model as the server names it, its served digest (64 hex) and the server's version. */
export interface DecisionModelRecordsIdentity {
	readonly model: string;
	readonly digest: string;
	readonly serverVersion: string;
}

/**
 * ⭐ THE RECORDS' IDENTITY. ⚠ PACKAGE Z2b, PHASE 1: the identity the screen's canary measured on this host (2026-11-07,
 * `z2a-facts.md` item 7) — the server D54's records are being made on. Phase 2 holds it to the committed records' own lines.
 */
export const DECISION_MODEL_RECORDS_IDENTITY: DecisionModelRecordsIdentity = Object.freeze({
	model: 'pplx-decider:27b-q4_K_M',
	digest: '733585a9ebb6205d2d5b64a13748f0b1c9f1285885dd267780cfdb1c4c8ef141',
	serverVersion: '0.40.15'
});

/** The identity in words, as a refusal names it: the model, the digest's first twelve characters and the server's version. */
export const identityWords = (i: DecisionModelRecordsIdentity): string => `${i.model} ${i.digest.slice(0, 12)} on Ollama ${i.serverVersion}`;
