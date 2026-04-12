/**
 * Layer C suite entrypoint — @vscode/test-cli now handles Mocha discovery
 * and execution via .vscode-test.mjs. This file is kept as a minimal
 * compatibility bridge: @vscode/test-cli looks for the `run()` export when
 * using the older programmatic API path (runTests()), but with the config-
 * file approach the CLI sets up Mocha itself and discovers `*.smoke.test.js`
 * via the `files` glob.
 *
 * This file is intentionally minimal. The actual test files live alongside
 * it as `extension.smoke.test.ts`.
 */

export async function run(): Promise<void> {
  // @vscode/test-cli handles this — no manual Mocha wiring needed.
}
