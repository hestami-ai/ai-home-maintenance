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

/** The eight (D8). */
export const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN'
] as const;

/** Remove every live-backend selection from `env` — the process's own, at a gate entry point. */
export function forgetLiveBackendSelections(
	env: Record<string, string | undefined> = process.env
): void {
	for (const name of LIVE_BACKEND_VARIABLES) delete env[name];
}
