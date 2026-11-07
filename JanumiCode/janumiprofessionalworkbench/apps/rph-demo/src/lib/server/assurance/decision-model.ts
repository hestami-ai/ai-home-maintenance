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
// ⭑ A test that drives the product's own wiring stands a double in here (`vi.mock`), as it stands one in for `devinPrint`;
// nothing in production stands in for the model.
// ⭑ THE LANE PASSES THE OPERATOR'S OWN: the live lane's server inherits the shell's environment (`playwright.live-exec.config.ts`,
// `{ ...process.env, ...webServer.env }`), so the four settings reach it only as the operator exports them.
// ~~⚠ PURE AND IMPORTING TYPES ONLY, so the floor registry reaches it at no cost and it reaches no host.~~ ⚠ IMPORTING THE CLIENT AND
// TYPES ONLY: building the client opens nothing, so the floor registry still reaches it at no cost — the client reaches the server
// only when a review asks it.
import { createDecisionModelClient } from './decision-model-client.js';
import type { IndicationsSource } from './reasoning-review-validator.js';

/** ⭐ The four settings, by what each configures. */
export const DECISION_MODEL_VARIABLES = Object.freeze({
	server: 'JPWB_DECISION_MODEL_SERVER',
	model: 'JPWB_DECISION_MODEL',
	digest: 'JPWB_DECISION_MODEL_DIGEST',
	serverVersion: 'JPWB_DECISION_MODEL_SERVER_VERSION'
});

/** `a`, `a and b`, `a, b and c`. */
const listed = (names: readonly string[]): string =>
	names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`;

/** The decision model a real review asks, as configured: the client, a refusal naming what is missing, or none at all. */
export function configuredIndications(): IndicationsSource | undefined {
	const read = (name: string): string | undefined => process.env[name]?.trim() || undefined;
	const server = read(DECISION_MODEL_VARIABLES.server);
	const model = read(DECISION_MODEL_VARIABLES.model);
	const digest = read(DECISION_MODEL_VARIABLES.digest);
	const serverVersion = read(DECISION_MODEL_VARIABLES.serverVersion);
	const missing = Object.values(DECISION_MODEL_VARIABLES).filter((name) => read(name) === undefined);
	if (missing.length === Object.values(DECISION_MODEL_VARIABLES).length) return undefined;
	if (server === undefined || model === undefined || digest === undefined || serverVersion === undefined) {
		const refusal =
			`the decision model is configured in part: ${listed(missing)} ${missing.length === 1 ? 'is' : 'are'} not set ` +
			`(REG-D-052: no default stands in for ${missing.length === 1 ? 'it' : 'them'})`;
		return async () => ({ refusal });
	}
	return createDecisionModelClient({ server, model, identity: { digest, serverVersion } });
}
