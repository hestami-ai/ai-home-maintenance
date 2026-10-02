import { expect, type Page } from '@playwright/test';

/**
 * ⭐ `JAN-ESCREC` D3 (the ER-1 app re-verifier's finding [1]; the third fix round's re-verifier's finding [0]) — THE
 * INSTRUCTION STAYS ON SCREEN. The PWA page's floor panel is capped (`.floorpanel` max-height calc(50vh - 96px)) and its
 * body scrolls, and whatever renders above the blocked hint pushes it down: an escalation line rendered BEFORE it pushed
 * "revise the graph and re-run" below the panel's fold at the default viewport, and so did the reasoning-review findings
 * and the reviewer's answer — beside a review whose program did not run, on a second authoring turn, beside a waived
 * floor — so the professional read a half-cut list where the instruction was. The hint now renders FIRST in the panel's
 * body, before the floor's own head and its policy list. ⭑ It must lie wholly inside the panel body's visible box: its
 * padding box, within the viewport, before anything is scrolled. Asked beside every review
 * `assurance-floor-escalated-review-hint.e2e.ts` and `assurance-floor-review-failure-hint.e2e.ts` stage.
 */
export async function expectTheHintOnScreen(page: Page): Promise<void> {
	const fold = await page.locator('.floorpanel .panelbody').evaluate((body) => {
		const hint = body.querySelector('[data-testid="floor-blocked-hint"]');
		if (hint === null) return 'the blocked hint is not in the floor panel’s body';
		const b = body.getBoundingClientRect();
		const top = Math.max(b.top + body.clientTop, 0);
		const left = Math.max(b.left + body.clientLeft, 0);
		const bottom = Math.min(b.top + body.clientTop + body.clientHeight, window.innerHeight);
		const right = Math.min(b.left + body.clientLeft + body.clientWidth, window.innerWidth);
		const h = hint.getBoundingClientRect();
		return h.top >= top - 0.5 &&
			h.bottom <= bottom + 0.5 &&
			h.left >= left - 0.5 &&
			h.right <= right + 0.5
			? 'inside'
			: `outside: the hint spans y ${Math.round(h.top)}-${Math.round(h.bottom)}, the panel body shows y ${Math.round(top)}-${Math.round(bottom)}`;
	});
	expect(fold, 'the blocked hint is not wholly on screen in the floor panel').toBe('inside');
}
