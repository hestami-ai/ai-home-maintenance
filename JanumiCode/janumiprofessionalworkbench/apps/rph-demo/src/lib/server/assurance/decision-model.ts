// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50, D51 (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.2-§12.3) —
// THE ONE PLACE THE PRODUCT'S DECISION MODEL IS CONFIGURED: the source a real review's potential indications come from, as
// `devin-reviewer.ts` is the one place the reviewer's program is (`createFloorRegistry` asks both).
//
// ~~⛔ PACKAGE Z1 BUILDS NONE. The client — pplx-decider over Ollama's `POST /v1/systemone`, one cold request per check and per
// statement, the served digest and server version held to the committed records (D51, D54) — is package Z2's, configured
// by server address and model with no default model (`REG-D-052`). Until it lands this answers `undefined`, so every real
// review is refused before its first reviewer call (`NO_INDICATIONS_SOURCE_STATEMENT`): the fail-closed state Z1 leaves,
// which is why Z1 merges only with Z2 (the build brief's integration note).~~ ⭐⭐ PACKAGE Z2a (D51) BUILDS THE CLIENT
// (`decision-model-client.ts`), AND THIS HANDS IT OUT ONLY AS CONFIGURED, by four settings of the server's environment, read when
// the floor's registry is built (`DECISION_MODEL_VARIABLES`): the server's address, the model — never defaulted (`REG-D-052`) —
// and the identity its requests are held to, the model's digest and the server's version (`REG-F-608`). ⚠ In package Z2b that
// identity becomes D54's records' own. Unconfigured — none of the four set — this answers `undefined`, and every real review is
// refused before its first reviewer call (`NO_INDICATIONS_SOURCE_STATEMENT`), as Z1 left it. Configured in part, it answers a
// source that refuses every review, naming what is missing: no default stands in for a setting.
// ⛔ MOVED 2026-11-07 (`JAN-EXEC` Phase 7, package Z2b — D51, D54; the Z2b brief's item 3): ~~four settings~~ TWO — the server's
// address and the model. The identity the client is held to is D54's records' own (`DECISION_MODEL_RECORDS_IDENTITY`,
// `decision-model-identity.ts`), so `JPWB_DECISION_MODEL_DIGEST` and `JPWB_DECISION_MODEL_SERVER_VERSION` are no longer read: an
// operator's digest or version could only stand in for the records' — and another identity owes new records (`REG-F-608`). The model
// is still the operator's to configure, never defaulted (`REG-D-052`); one other than the records' is refused, since the records
// hold no score of its.
// ⭑ A test that drives the product's own wiring stands a double in here (`vi.mock`), as it stands one in for `devinPrint`;
// nothing in production stands in for the model.
// ⭑ THE LANE PASSES THE OPERATOR'S OWN: the live lane's server inherits the shell's environment (`playwright.live-exec.config.ts`,
// `{ ...process.env, ...webServer.env }`), so the four settings reach it only as the operator exports them.
// ~~⚠ PURE AND IMPORTING TYPES ONLY, so the floor registry reaches it at no cost and it reaches no host.~~ ⚠ IMPORTING THE CLIENT AND
// TYPES ONLY: building the client opens nothing, so the floor registry still reaches it at no cost — the client reaches the server
// only when a review asks it.
import { createDecisionModelClient } from './decision-model-client.js';
import { DECISION_MODEL_RECORDS_IDENTITY } from './decision-model-identity.js';
import type { IndicationsSource } from './reasoning-review-validator.js';

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L8 — D63 (`REG-D-152`) — THE SERVER VERSIONS THE PRODUCT'S REVIEWS ACCEPT BESIDE THE RECORDS'
 * (`DECISION_MODEL_RECORDS_IDENTITY.serverVersion`, 0.40.15), each accepted by the sponsor WITHOUT RE-MEASUREMENT: listed once, here,
 * beside the records' identity and not in it — the records, their identity and the scores the reviewer was measured with stay
 * 0.40.15's (`REG-F-608` measured scores moving between two earlier server versions). ⭑ The product's review path passes it
 * (`createFloorRegistry`, `index.ts`); D53's re-derivation passes none (`scripts/reviewer-qual/run.ts`): the re-measurement, on a
 * version nobody measured, refuses rather than re-derives on it (L8, the lead's decision (A)).
 */
export const DECISION_MODEL_ALSO_ACCEPTED: readonly string[] = Object.freeze(['0.40.16']);

/** ⭐ ~~The four settings~~ The two settings (Z2b), by what each configures. */
export const DECISION_MODEL_VARIABLES = Object.freeze({
	server: 'JPWB_DECISION_MODEL_SERVER',
	model: 'JPWB_DECISION_MODEL'
});

/** `a`, `a and b`, `a, b and c`. */
const listed = (names: readonly string[]): string =>
	names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`;

/**
 * The decision model a real review asks, as configured: the client, a refusal naming what is missing, or none at all.
 * ⭐⭐ Package L8 — D63 (`REG-D-152`) — `alsoAccepted`, REQUIRED: the server versions the client accepts beside the records' own, so
 * each caller says which — the product's review path `DECISION_MODEL_ALSO_ACCEPTED`, D53's re-derivation `[]`.
 */
export function configuredIndications(alsoAccepted: readonly string[]): IndicationsSource | undefined {
	const read = (name: string): string | undefined => process.env[name]?.trim() || undefined;
	const server = read(DECISION_MODEL_VARIABLES.server);
	const model = read(DECISION_MODEL_VARIABLES.model);
	const missing = Object.values(DECISION_MODEL_VARIABLES).filter((name) => read(name) === undefined);
	if (missing.length === Object.values(DECISION_MODEL_VARIABLES).length) return undefined;
	if (server === undefined || model === undefined) {
		const refusal =
			`the decision model is configured in part: ${listed(missing)} ${missing.length === 1 ? 'is' : 'are'} not set ` +
			`(REG-D-052: no default stands in for ${missing.length === 1 ? 'it' : 'them'})`;
		return async () => ({ refusal });
	}
	// ⭐ Z2b — the records' model, and the records' identity: the only scores the screen measured are theirs.
	const recorded = DECISION_MODEL_RECORDS_IDENTITY;
	if (model !== recorded.model) {
		const refusal = `the configured decision model is ${model}, not ${recorded.model}, the model D54’s records were made with (D51; REG-D-052)`;
		return async () => ({ refusal });
	}
	return createDecisionModelClient({ server, model, identity: { digest: recorded.digest, serverVersion: recorded.serverVersion, alsoAccepted } });
}
