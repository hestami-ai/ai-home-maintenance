// ⛔ THE IMPORT CENSUS — no browser spec escapes the lane control (`JAN-CRITREAD` J1-3; `DESIGN-what-the-tests-prove.md`
// §4.8; `ROADMAP-what-the-tests-prove.md` §J1-3).
//
// The lane goes green by STIPULATING what the structural checker cannot judge, and the lane control is what keeps that
// the ONLY permission it uses. Its per-test attribution is an automatic fixture on the `test` that
// `e2e/support/harness.ts` exports; its authority is the server's own check, which `globalTeardown` reads. A spec that
// declares its tests on Playwright's own `test` would run with no fixture — and nothing would say so. This census
// says so: every `.ts` under `apps/rph-demo/e2e/` other than the harness is scanned, and any file that takes
// Playwright's `test` — named, aliased, default, namespace, re-exported, required or import-equals, from
// `@playwright/test` or the unscoped `playwright/test` it re-exports — is red.
//
// ⭑ WHY `e2e/` AND NOT THE LIVE LANES. `e2e-live*/` run no stipulation and are outside the lane control by design
// (§4.8); they keep Playwright's `test`, and their configs keep the gallery's teardown alone.
//
// ⭑ RED FIRST, OBSERVED: over `HEAD`'s tree (4ece4f09, extracted with `git archive`), 44 files took Playwright's
// `test` (43 specs and `support/gallery.ts`), 43 specs took no `test` from the harness, and the harness exported no
// extended `test` at all.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
	E2E_DIR,
	HARNESS,
	e2eImportCensus,
	harnessTestIsAutoExtended,
	playwrightTestTakes,
	takesHarnessTest
} from './e2e-harness-imports.js';

const REPO = new URL('../', import.meta.url).pathname
	.replace(/^\/([A-Za-z]:)/, '$1')
	.replace(/\/$/, '');

/** A floor, not a count: the 43 specs and `support/gallery.ts` that took the harness's `test` when this landed. A walk
 *  that broke and scanned nothing would otherwise pass every limb below. */
const HARNESS_TAKERS_FLOOR = 44;

describe('⛔ every browser spec takes its `test` from the harness, so the lane control reaches it', () => {
	const census = e2eImportCensus(REPO);

	it('⛔ no file under e2e/ takes Playwright’s own `test`', () => {
		expect(
			census.takers,
			'a file under apps/rph-demo/e2e/ takes `test` from @playwright/test, so its tests run WITHOUT the lane control’s fixture — take it from ./support/harness'
		).toEqual({});
	});

	it('⛔ every spec takes `test` from the harness module', () => {
		expect(
			census.specsWithoutHarnessTest,
			'a spec declares its tests on no harness `test`'
		).toEqual([]);
	});

	it('⭐ the population is the one the lane runs — large enough that a broken walk would show', () => {
		expect(census.harnessTakers).toBeGreaterThanOrEqual(HARNESS_TAKERS_FLOOR);
		expect(census.scanned.filter((f) => f.endsWith('.e2e.ts')).length).toBeGreaterThanOrEqual(43);
		expect(census.scanned, 'the harness is not itself in the population').not.toContain(HARNESS);
	});

	it('⛔ the harness’s `test` is Playwright’s EXTENDED with an automatic fixture — the lane control’s', () => {
		expect(harnessTestIsAutoExtended(readFileSync(`${REPO}/${HARNESS}`, 'utf8'))).toBe(true);
	});
});

describe('CONTROL — the scanner discriminates every form, and frees what it should', () => {
	it('⭐ each form of taking Playwright’s `test` is caught', () => {
		const taken = [
			"import { test, expect } from '@playwright/test';",
			"import { expect, test as t } from '@playwright/test';",
			"import pw from '@playwright/test';",
			"import * as pw from '@playwright/test';",
			"export { test } from '@playwright/test';",
			"export * from '@playwright/test';",
			"const pw = require('@playwright/test');",
			"const pw = await import('@playwright/test');"
		];
		for (const source of taken)
			expect(playwrightTestTakes(source), `not caught: ${source}`).toHaveLength(1);
	});

	it('⭐ the UNSCOPED module `playwright/test` is where `@playwright/test` gets its `test` — it is caught too', () => {
		// ⭑ J1-3's adversarial review: this form resolves to `node_modules/playwright/test.js` — the module
		// `@playwright/test` re-exports — and got past the first limb, which knew only the scoped name.
		expect(playwrightTestTakes("import { test as raw } from 'playwright/test';")).toEqual([
			'1: a named import of test'
		]);
	});

	it('⭐ a TypeScript import-equals — `import pw = require(…)` — is caught', () => {
		// ⭑ J1-3's adversarial review: an `ImportEqualsDeclaration`, not a `CallExpression`, so the `require` limb
		// never saw it.
		expect(playwrightTestTakes("import pw = require('@playwright/test');")).toEqual([
			'1: an import-equals require of the module'
		]);
	});

	it('⭐ what is not `test` is free', () => {
		const free = [
			"import { expect, type Page, type APIRequestContext } from '@playwright/test';",
			"import type { Page } from '@playwright/test';",
			"import { type test } from '@playwright/test';",
			"import { request, devices, defineConfig } from '@playwright/test';",
			"import { test } from './support/harness';",
			"export type { Page } from '@playwright/test';",
			"import { expect } from 'playwright/test';",
			"import type pw = require('@playwright/test');"
		];
		for (const source of free)
			expect(playwrightTestTakes(source), `wrongly caught: ${source}`).toEqual([]);
	});

	it('⭐ taking the harness `test` is recognised only from the harness module, and only by value', () => {
		expect(takesHarnessTest("import { test, resetEngine } from './support/harness';", false)).toBe(
			true
		);
		expect(
			takesHarnessTest("import { resetEngine, test as t } from '../support/harness';", false)
		).toBe(true);
		expect(takesHarnessTest("import { test, introspect } from './harness';", true)).toBe(true);
		expect(takesHarnessTest("import { resetEngine } from './support/harness';", false)).toBe(false);
		expect(takesHarnessTest("import { test } from './support/gallery';", false)).toBe(false);
		expect(takesHarnessTest("import type { test } from './support/harness';", false)).toBe(false);
	});

	it('⭐ the harness check wants `extend` AND `auto: true`', () => {
		const extended =
			"import { test as base } from '@playwright/test';\nexport const test = base.extend<{ x: void }>({ x: [async ({}, use) => { await use(); }, { auto: true }] });";
		expect(harnessTestIsAutoExtended(extended)).toBe(true);
		expect(harnessTestIsAutoExtended(extended.replace('auto: true', 'auto: false'))).toBe(false);
		expect(
			harnessTestIsAutoExtended("import { test } from '@playwright/test';\nexport { test };")
		).toBe(false);
	});

	const dirs: string[] = [];
	afterAll(() => {
		for (const d of dirs) rmSync(d, { recursive: true, force: true });
	});

	it('⭐ over a planted tree: a spec on Playwright’s `test`, and one on no `test` at all, each redden — and the harness is exempt', () => {
		const root = mkdtempSync(join(tmpdir(), 'jpwb-e2e-census-'));
		dirs.push(root);
		mkdirSync(`${root}/${E2E_DIR}/support`, { recursive: true });
		writeFileSync(
			`${root}/${HARNESS}`,
			"import { test as base } from '@playwright/test';\nexport const test = base;\n"
		);
		writeFileSync(`${root}/${E2E_DIR}/ok.e2e.ts`, "import { test } from './support/harness';\n");
		writeFileSync(
			`${root}/${E2E_DIR}/raw.e2e.ts`,
			"import { test, expect } from '@playwright/test';\n"
		);
		writeFileSync(`${root}/${E2E_DIR}/none.e2e.ts`, "import { expect } from '@playwright/test';\n");
		const r = e2eImportCensus(root);
		expect(Object.keys(r.takers)).toEqual([`${E2E_DIR}/raw.e2e.ts`]);
		expect(r.specsWithoutHarnessTest).toEqual([`${E2E_DIR}/none.e2e.ts`, `${E2E_DIR}/raw.e2e.ts`]);
		expect(r.harnessTakers).toBe(1);
	});
});
