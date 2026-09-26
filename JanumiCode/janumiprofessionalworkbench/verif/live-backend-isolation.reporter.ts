// ⭐ `JAN-SELREV` SR-1 (D8) — WHAT THE e2e SERVER WOULD BE GIVEN, read inside the real Playwright runner.
//
// A Playwright reporter, loaded with `--list` by `verif/live-backend-isolation.test.ts` against the gate's own
// `apps/rph-demo/playwright.config.ts`. It runs in the RUNNER process, after that config has loaded — the process and
// the moment from which Playwright launches the e2e server, with
// `{ ...DEFAULT_ENVIRONMENT_VARIABLES, ...process.env, ...webServer.env }` (`playwright/lib/runner/index.js`,
// `WebServerPlugin`). So the environment composed here is the server's, minus Playwright's own fixed defaults.
//
// ⚠ AN EQUIVALENT PROBE, NOT A BOOT, AND WHAT THAT LEAVES OUT: `--list` starts no server, so nothing here watches vite
// start. What the server would SELECT from this environment is what the vitest probe measures in the same child test.
import type { FullConfig, Reporter } from '@playwright/test/reporter';

/** The line this reporter prints, and the parent parses. */
export const PROBE_MARK = 'LIVE-BACKEND-PROBE ';

/** What the probe reports: every `JPWB_*` name the server's environment would carry, and the mode it would boot in. */
export interface ServerEnvironmentReport {
	readonly jpwbVariables: readonly string[];
	readonly demoMode: string | undefined;
}

export default class LiveBackendProbe implements Reporter {
	onBegin(config: FullConfig): void {
		const server: Record<string, string | undefined> = { ...process.env, ...config.webServer?.env };
		const report: ServerEnvironmentReport = {
			jpwbVariables: Object.keys(server)
				.filter((k) => k.startsWith('JPWB_') && server[k] !== undefined)
				.sort((a, b) => a.localeCompare(b)),
			demoMode: server.RPH_DEMO_MODE
		};
		process.stdout.write(`${PROBE_MARK}${JSON.stringify(report)}\n`);
	}

	printsToStdio(): boolean {
		return true;
	}
}
