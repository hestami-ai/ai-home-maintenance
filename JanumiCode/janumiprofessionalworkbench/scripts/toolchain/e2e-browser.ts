/**
 * The e2e browser's facts, read from the tree (JAN-TOOLCUR roadmap T6): the locked `@playwright/test`, and the Chromium
 * its `playwright-core` bundles, from that package's `browsers.json`. `generate.ts` writes them into the matrix's
 * `e2eBrowser` row; `check.ts`'s condition 9 holds the row to them, so a Playwright that moves its browser is seen.
 */

import { copiesOf, type Lockfile } from './lockfile.js';
import type { TreeReader } from './tree.js';

export const BROWSERS_PATH = 'node_modules/playwright-core/browsers.json';

export interface E2eBrowserFacts {
	readonly playwright: string;
	readonly revision: string;
	readonly browserVersion: string;
	readonly headlessShellRevision: string;
}

/** The facts, or throw naming what could not be read. */
export function e2eBrowserFacts(reader: TreeReader, lock: Lockfile): E2eBrowserFacts {
	const playwright = copiesOf(lock, '@playwright/test').find((c) => c.parent === '');
	if (playwright === undefined) throw new Error('bun.lock holds no hoisted @playwright/test');
	const text = reader.read(BROWSERS_PATH);
	if (text === undefined) throw new Error(`${BROWSERS_PATH} is missing`);
	type Entry = { readonly name?: string; readonly revision?: string; readonly browserVersion?: string };
	const browsers = (JSON.parse(text) as { readonly browsers?: readonly Entry[] }).browsers ?? [];
	const chromium = browsers.find((b) => b.name === 'chromium');
	const shell = browsers.find((b) => b.name === 'chromium-headless-shell');
	if (!chromium?.revision || !chromium.browserVersion || !shell?.revision) {
		throw new Error(`${BROWSERS_PATH} names no chromium revision and version, or no chromium-headless-shell revision`);
	}
	return {
		playwright: playwright.version,
		revision: chromium.revision,
		browserVersion: chromium.browserVersion,
		headlessShellRevision: shell.revision
	};
}
