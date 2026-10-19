// ⭐ `JAN-SELREV` SR-1 (D8) — THE GATE NEVER INHERITS A LIVE-BACKEND SELECTION.
//
// ⛔ EVERY BACKEND SWITCH KEYS ON ITS VARIABLE'S ABSENCE (`REG-F-457` G8): `JPWB_ASSURANCE_TOOL` turns the declared
// stand-in into the real reviewer, `JPWB_EXECUTOR` the fixture into a real executor, `JPWB_AGENT=pi` the mock into
// the live Pi agent, and a model or program variable decides what those run. The gate's test-mode entry points
// inherited the shell, so an operator who exported the selected configuration (`REG-D-084`) turned the gate's
// stand-ins into real, paid runs. Each entry point therefore REMOVES these when it starts:
//   · every project of both root vitest configs — `verif/live-backend-isolation-setup.ts`, declared at the root of
//     `vitest.config.ts` and `vitest.dist.config.ts` (`vitest.projects.ts`'s `SETUP_LIVE_BACKENDS`);
//   · `apps/rph-demo`'s own `vitest run` — the same setup file, from its `vitest.config.ts`. ⚠ Under `turbo run test`
//     that run was already sealed: turbo's default STRICT env mode passes a task no variable `turbo.json` does not
//     declare (measured, with this wiring removed). The wiring is for the same command started in that directory,
//     where nothing seals it, and for a turbo run in loose mode;
//   · the e2e server — `apps/rph-demo/playwright.config.ts`, at config load, so the runner holds none of them when
//     Playwright launches the server from its own environment.
// Tests that set one in-process for their own arrangement are unaffected: the removal runs before they do.
//
// ⚠ REMOVED, NEVER SET TO `''` (the design said `''`; the as-built deviation). A program override set to `''` is still
// an override: the qualification harness refuses any that is not `undefined` (`scripts/reviewer-qual/preflight.ts`),
// and `process.env.JPWB_AGY_BIN ?? 'agy'` would read `''` as an empty program name. The product's readers of the
// SELECTION variables still treat `''` and whitespace as unset (D2), for a shell that exports them empty:
// `resolveReviewerToolId`, `resolveJudgeModel`, `resolveAssuranceModel`, `resolveExecutorToolId`,
// `resolveExecutorModel` and `agentMode`.
//
// ⛔ THE LIVE LANES ARE NOT ENTRY POINTS OF THE GATE. `playwright.live.config.ts` and `playwright.live-exec.config.ts`
// exist to run the real backends, and neither imports the gate's config.

/**
 * The eight (D8) ~~.~~ ⭐ — and a ninth, `JPWB_REPLAY` (`JAN-EXEC` Phase 8; the review of E4, finding 11). It selects no
 * paid backend, but it keys on its absence exactly as the eight do: in test mode it turns the declared stand-ins into the
 * replay's arms (`apps/rph-demo/src/lib/server/replay/replay-switch.ts`), so an operator who exported it to replay a
 * recording turned every gate test that expects a stand-in into a replay of that folder — or into a refused reviewer, for a
 * folder that holds none (driven red on `live-backend-isolation.test.ts`, all four children).
 * ⭐ AND A TENTH, `JPWB_AGENT_MODEL` (the re-review of E4's fix round): the authoring agent's model. The replay refuses it
 * beside its switch (`LIVE_SELECTIONS_BESIDE_A_REPLAY`), so a shell that exported it for half B's authoring turned the
 * gate's replay tests into that refusal (driven red: the replay's tests, 4 failed; and `live-backend-isolation.test.ts`,
 * all four children, with it exported there and left off this list).
 * ⭐ AND AN ELEVENTH AND A TWELFTH (`JAN-MHX` MH-3, `DESIGN-multi-harness-executor.md` D39): `JPWB_EXECUTOR_EFFORT`, a
 * selection the executor selector reads, and `JPWB_CODEX_BIN`, a program override it captures when it loads (driven red:
 * `live-backend-isolation.test.ts`, all four children, with both exported there and left off this list).
 * ⭐ AND A THIRTEENTH (`JAN-MHX` MH-10, design D34, D39): `JPWB_MUSE_BIN`, the program override the Muse driver captures when
 * it loads (driven red: `live-backend-isolation.test.ts`, all four children, with it exported there and left off this list).
 */
export const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_EXECUTOR_EFFORT',
	'JPWB_AGENT',
	'JPWB_AGENT_MODEL',
	'JPWB_CODEX_BIN',
	'JPWB_MUSE_BIN',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN',
	'JPWB_REPLAY'
] as const;

/** Remove every live-backend selection from `env` — the process's own, at a gate entry point. */
export function forgetLiveBackendSelections(
	env: Record<string, string | undefined> = process.env
): void {
	for (const name of LIVE_BACKEND_VARIABLES) delete env[name];
}
