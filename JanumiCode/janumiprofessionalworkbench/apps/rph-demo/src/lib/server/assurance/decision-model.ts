// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50, D51 (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.2-§12.3) —
// THE ONE PLACE THE PRODUCT'S DECISION MODEL IS CONFIGURED: the source a real review's potential indications come from, as
// `devin-reviewer.ts` is the one place the reviewer's program is (`createFloorRegistry` asks both).
//
// ⛔ PACKAGE Z1 BUILDS NONE. The client — pplx-decider over Ollama's `POST /v1/systemone`, one cold request per check and per
// statement, the served digest and server version held to the committed records (D51, D54) — is package Z2's, configured
// by server address and model with no default model (`REG-D-052`). Until it lands this answers `undefined`, so every real
// review is refused before its first reviewer call (`NO_INDICATIONS_SOURCE_STATEMENT`): the fail-closed state Z1 leaves,
// which is why Z1 merges only with Z2 (the build brief's integration note). ⭑ A test that drives the product's own wiring
// stands a double in here (`vi.mock`), as it stands one in for `devinPrint`; nothing in production stands in for the model.
// ⚠ PURE AND IMPORTING TYPES ONLY, so the floor registry reaches it at no cost and it reaches no host.
import type { IndicationsSource } from './reasoning-review-validator.js';

/** The decision model a real review asks, as configured — none until package Z2 lands its client. */
export function configuredIndications(): IndicationsSource | undefined {
	return undefined;
}
