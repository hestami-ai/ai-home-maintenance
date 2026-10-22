// ⭐⭐ `REG-F-501` — IN HARNESS MODE, THE DEV SERVER KEEPS AN IDLE CONNECTION OPEN LONGER THAN ANY TEST CAN LAST.
//
// ── THE RESET ───────────────────────────────────────────────────────────────────────────────────────────────────
// Each Playwright config that boots the harness (`playwright.config.ts`, `playwright.live.config.ts`,
// `playwright.live-exec.config.ts`) starts `vite.js`, and Vite 7.3.6 builds its dev server with `node:http`'s
// `createServer(app)` and no options, so Node's defaults hold: an idle connection is closed `keepAliveTimeout` (5,000 ms)
// plus `keepAliveTimeoutBuffer` (1,000 ms) after its last response. With no proxy set, Playwright 1.61.1 sends every
// request context's requests through one keep-alive agent per process (`httpHappyEyeballsAgent`), so a request rides
// the connection the last one left idle, a fresh context's included. A request that goes out on it at that close is reset
// (`read ECONNRESET`): the e2e suite's after-test checks and introspect reads, in `REG-F-501`; and the execution lane's
// candidate poll pauses 5 s between two reads of the store (`PHASE7_CANDIDATE_POLL_MS`), so with the work around each
// read, a read can go out at that close.
//
// ── THE REMEDY, `REG-F-501`'s CANDIDATE 1 ──────────────────────────────────────────────────────────────────────
// `harnessKeepAlive`, a plugin `vite.config.ts` carries, raises the dev server's `keepAliveTimeout` in harness mode: no
// connection a test leaves idle is closed under it. Outside harness mode it changes nothing.
// `harness-keep-alive-connection.test.ts` drives the reset and its remedy; `harness-keep-alive.test.ts` the plugin.
import { Server } from 'node:http';
import type { Plugin } from 'vite';

/**
 * ⭐ `REG-F-501` — HOW LONG THE HARNESS'S DEV SERVER KEEPS AN IDLE CONNECTION OPEN: 2,147,482,647 ms, so the timer Node
 * arms for it, this plus `keepAliveTimeoutBuffer` (1,000 ms by default), sits at Node's timer ceiling, 2,147,483,647 ms.
 * Past the ceiling Node cuts a socket's timer to it, with a `TimeoutOverflowWarning` on every response.
 *
 * ⚠ ABOVE EVERY IDLE A TEST CAN LEAVE, BECAUSE NO TEST OUTLASTS THAT CEILING: Playwright arms a test's timeout as a Node
 * timer, and past the ceiling it would time the test out at once (`e2e-live-exec/lane-config.ts`, which caps half B's
 * there). No shorter figure is above every wait between two requests: the suite's tests are given 30 s, up to 180 s
 * where a spec sets its own; the authoring lane's, 360 s; the execution lane's candidate poll pauses 5 s between two
 * reads, but between two reads it also waits on the page for up to a phase's allowance, 38,160 s
 * (`PHASE7_UNIT_ALLOWANCE_MS`), and on an archive's copying, which has no bound (`PHASE7_SETUP_MS`).
 */
export const HARNESS_KEEP_ALIVE_TIMEOUT_MS = 2_147_482_647;

/**
 * ⭐ Whether `env` declares the harness — `harnessExposed()`'s question (`workbench.ts`), asked of an environment:
 * `RPH_DEMO_MODE=test` (the suite, the authoring lane) or `JPWB_HARNESS=1` (the execution lane, a server too). Asked here
 * rather than imported, because importing `workbench.ts` loads the engine; `harness-keep-alive.test.ts` holds the two
 * answers equal, declaration by declaration.
 */
export function harnessDeclared(env: NodeJS.ProcessEnv): boolean {
	return env.RPH_DEMO_MODE === 'test' || env.JPWB_HARNESS === '1';
}

/**
 * ⭐ `REG-F-501` — keep `server`'s idle connections open for `HARNESS_KEEP_ALIVE_TIMEOUT_MS`. Node reads `keepAliveTimeout`
 * as each response finishes, so every connection gets it.
 *
 * ⚠ IT CHANGES `keepAliveTimeout` ALONE. `headersTimeout` and `requestTimeout` are checked "in incomplete requests"
 * (Node's `connectionsCheckingInterval`), so they bound a request in progress, not the idle between two; and Node's
 * constructor refuses a `headersTimeout` above `requestTimeout` (`ERR_OUT_OF_RANGE`), which one above this would be.
 */
export function keepHarnessConnectionsOpen(server: Server): void {
	server.keepAliveTimeout = HARNESS_KEEP_ALIVE_TIMEOUT_MS;
}

/**
 * ⭐ THE PLUGIN `vite.config.ts` CARRIES: on a dev server Vite built over `node:http`, in harness mode, it keeps the idle
 * connections open (`keepHarnessConnectionsOpen`). Outside harness mode, or with no such server (Vite's middleware mode
 * builds none), Node's defaults stand.
 */
export function harnessKeepAlive(env: NodeJS.ProcessEnv = process.env): Plugin {
	return {
		name: 'jpwb-harness-keep-alive',
		configureServer(server) {
			if (harnessDeclared(env) && server.httpServer instanceof Server)
				keepHarnessConnectionsOpen(server.httpServer);
		}
	};
}
