import { spawnSync } from 'node:child_process';
import { readFileSync, readlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from './support/harness';

// ⭐ JAN-TOOLCUR roadmap T6 — THE E2E BROWSER, OBSERVED, NOT READ FROM CONFIG TEXT. `toolchain:check`'s condition 9
// reads the configs (no `channel`, no `executablePath`); this spec asks the running browser itself. Its version comes
// from the browser; its executable from the operating system, for the process the browser reports as its own (CDP
// `SystemInfo.getProcessInfo`; `Browser.getBrowserCommandLine` answers only under --enable-automation, which
// Playwright does not pass). Both are held to the matrix's e2eBrowser row, so a config set back to `channel: 'msedge'`
// fails here, naming Edge's version and its executable; and both are printed into the gate's log, the run's own record
// of the browser it used.

interface E2eBrowserRow {
	readonly revision: string;
	readonly browserVersion: string;
	readonly headlessShellRevision: string;
}

/** The executable of a running process, asked of the operating system. */
function executableOf(pid: number): string {
	if (process.platform === 'win32') {
		const r = spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${pid}).Path`], { encoding: 'utf8' });
		return (r.stdout ?? '').trim();
	}
	if (process.platform === 'linux') return readlinkSync(`/proc/${pid}/exe`);
	return (spawnSync('ps', ['-o', 'comm=', '-p', String(pid)], { encoding: 'utf8' }).stdout ?? '').trim();
}

test("the e2e browser is Playwright's own Chromium, the matrix's e2eBrowser row", async ({ browser }) => {
	const configFile = test.info().config.configFile ?? '';
	const matrix = join(dirname(configFile), '..', '..', 'scripts', 'toolchain', 'matrix.json');
	const row = (JSON.parse(readFileSync(matrix, 'utf8')) as { e2eBrowser: E2eBrowserRow }).e2eBrowser;
	const cdp = await browser.newBrowserCDPSession();
	const info = (await cdp.send('SystemInfo.getProcessInfo')) as { processInfo: { type: string; id: number }[] };
	const pid = info.processInfo.find((p) => p.type === 'browser')?.id;
	expect(pid, 'the browser process, as the browser reports it').toBeDefined();
	const executable = executableOf(pid ?? 0).replaceAll('\\', '/');
	console.log(`[e2e browser] ${browser.browserType().name()} ${browser.version()} at ${executable}`);
	expect(browser.browserType().name(), 'the browser type').toBe('chromium');
	expect(browser.version(), `the running browser's version (its executable: ${executable})`).toBe(row.browserVersion);
	expect(executable, "the running browser's executable: in the folder of the revision the row records").toMatch(
		new RegExp(`/(chromium-${row.revision}|chromium_headless_shell-${row.headlessShellRevision})/`)
	);
});
