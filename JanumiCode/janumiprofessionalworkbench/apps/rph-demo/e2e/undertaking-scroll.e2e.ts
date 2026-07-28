import { test, expect, type Page } from '@playwright/test';
import { resetEngine, gotoHydrated } from './support/harness';

// JPWB-SPEC-001-DR-002 W-1 — the Undertaking workbench must be reachable in full.
//
// THE DEFECT THIS PINS, measured on 2026-07-28 and reported by the sponsor as "that didn't appear to be working
// as I expected". `+layout.svelte:74-76` derives `fullBleed` true for `/undertakings/<id>`, and `:311-314` then
// applies `.content.full { padding: 0; overflow: hidden }`. The warrant is a comment:
//
//     "Full-bleed, viewport-locked graph surfaces manage their own internal scrolling."
//
// The Undertaking workbench does NOT. Its 1,128-line `+page.svelte` carried exactly one `overflow: hidden`
// (`:735`, on the graph canvas) and one `overflow-x: auto` (`:813`, on a table) — no vertical scroll container
// anywhere. So every tab but `graph` renders a document taller than the viewport into a clipped box, and
// everything below the fold is unreachable. A comment asserting an invariant that nothing checks, licensing a
// rule the thing it licenses does not satisfy.
//
// WHY THIS TESTS THE WHEEL AND NOT `scrollIntoViewIfNeeded`. An `overflow: hidden` box is still scrollable
// PROGRAMMATICALLY — `scrollTop` can be set, and `scrollIntoViewIfNeeded()` therefore succeeds on the broken
// page. A spec written that way would have gone green against the defect and certified it. What a user has is a
// wheel, so that is what is asserted: content must MOVE under a wheel event.
//
// THE PREDICTED RED: `the workbench scrolls` fails against the pre-fix tree because the wheel moves nothing —
// the last assurance row sits at the same y after 4000px of scrolling as before it.
//
// THE CONTROL, and it is not decoration: the `graph` tab must NOT scroll. It is a genuinely viewport-locked
// canvas that pans internally, and the obvious lazy repair — letting the whole page scroll — would give it a
// page scrollbar and a short canvas. A fix that makes everything scroll is not a fix. Mutant
// `W1-b-the-graph-tab-scrolls-with-the-page` exists to prove this case can fail.

/** The seeded reference Undertaking's id, read from the portfolio rather than hardcoded. */
async function referenceUndertaking(page: Page): Promise<string> {
	await gotoHydrated(page, '/undertakings');
	const row = page.locator('a.row[href^="/undertakings/und_"]').first();
	await expect(row).toBeVisible();
	return (await row.getAttribute('href'))!.replace('/undertakings/', '');
}

/**
 * Scroll the workbench with the WHEEL — the affordance a user actually has — and report how far the given
 * element moved up the page. Zero means the page did not scroll, whatever `scrollTop` would have allowed.
 */
async function wheelAndMeasure(page: Page, locator: ReturnType<Page['locator']>): Promise<number> {
	const before = await locator.boundingBox();
	expect(before, 'the probe element must be laid out before the wheel test means anything').not.toBeNull();
	// Park the pointer over the middle of the content area so the wheel lands on the workbench, not the nav rail.
	const viewport = page.viewportSize()!;
	await page.mouse.move(viewport.width / 2, viewport.height / 2);
	await page.mouse.wheel(0, 4000);
	const after = await settled(locator);
	return before!.y - after;
}

/**
 * The element's y once it stops moving — a synchronization on the observable condition rather than a fixed wait,
 * which would encode a guess about scroll duration and go flaky on a slow machine. Each read is a round-trip, so
 * two consecutive identical positions mean the smooth scroll has come to rest.
 */
async function settled(locator: ReturnType<Page['locator']>): Promise<number> {
	let previous = Number.NaN;
	for (let i = 0; i < 40; i++) {
		const box = await locator.boundingBox();
		expect(box, 'the probe element must remain laid out while it settles').not.toBeNull();
		if (box!.y === previous) return box!.y;
		previous = box!.y;
	}
	return previous;
}

test.describe('Undertaking Workbench — the page is reachable in full (DR-002 W-1)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('the workbench scrolls, and the last assurance row can be reached', async ({ page }) => {
		const id = await referenceUndertaking(page);
		await gotoHydrated(page, `/undertakings/${id}`);
		await page.getByRole('button', { name: 'assurance', exact: true }).click();

		const rows = page.locator('main tbody tr');
		// THE ARRANGEMENT, ASSERTED RATHER THAN ASSUMED. If the tab held only a handful of rows the page would fit
		// the viewport, nothing would need to scroll, and a clipped workbench would be indistinguishable from a
		// working one — both "pass". The seed carries 65 assessments; require enough of them to overflow.
		await expect(rows.first()).toBeVisible();
		expect(
			await rows.count(),
			'the reference seed must carry enough assessments to overflow the viewport'
		).toBeGreaterThan(20);

		// And assert the content really does extend past the fold, before asserting anything about reaching it.
		// Measured as "the last row starts below the viewport", which is a fact about the PAGE and holds equally
		// before and after the repair — an arrangement assertion that only holds in one of the two states is a
		// defect assertion wearing the wrong label. It deliberately names no element that the fix introduces:
		// probing `main .content` here would have passed pre-fix and then broken ON THE FIX, because the scrollport
		// moves into the page. That happened, and this comment is why it will not happen silently again.
		const last = rows.last();
		const viewportHeight = page.viewportSize()!.height;
		const restingY = (await last.boundingBox())!.y;
		expect(
			restingY,
			'the last assurance row must start below the fold, or there is nothing to scroll to'
		).toBeGreaterThan(viewportHeight);

		// The defect: the user wheels, and nothing moves.
		const moved = await wheelAndMeasure(page, last);
		expect(moved, 'wheeling the workbench must scroll it — this is the W-1 defect').toBeGreaterThan(100);

		// One gesture proves the workbench scrolls; reaching the end is a second claim and takes as many gestures
		// as the content is long. Keep wheeling while it still moves — asserting a single 4000px wheel lands on the
		// last row would encode the seed's current row count as a magic number.
		for (let i = 0; i < 12 && (await last.boundingBox())!.y > viewportHeight; i++) {
			if ((await wheelAndMeasure(page, last)) === 0) break;
		}
		await expect(last, 'the last row must be reachable by scrolling').toBeInViewport();
	});

	test('CONTROL — the graph tab stays viewport-locked and does NOT scroll with the page', async ({ page }) => {
		const id = await referenceUndertaking(page);
		await gotoHydrated(page, `/undertakings/${id}`);
		await page.getByRole('button', { name: 'graph', exact: true }).click();

		const canvas = page.locator('.svelte-flow');
		await expect(canvas).toBeVisible();

		// The canvas fills the available height rather than being pushed below a scrolling document. Asserted as a
		// share of the viewport so it does not encode a magic number of its own — the very thing W-1 retires.
		const box = (await canvas.boundingBox())!;
		const viewport = page.viewportSize()!;
		expect(
			box.height / viewport.height,
			'the graph canvas must fill the viewport-locked area, not collapse into a scrolling document'
		).toBeGreaterThan(0.45);

		// And the whole canvas is visible without scrolling to it — the precise thing the lazy repair breaks. If
		// the graph tab became an ordinary scrolling document, the canvas bottom would fall past the fold.
		expect(
			box.y + box.height,
			'the graph canvas must end within the viewport — this tab is locked, not scrolled'
		).toBeLessThanOrEqual(viewport.height + 4);
	});
});
