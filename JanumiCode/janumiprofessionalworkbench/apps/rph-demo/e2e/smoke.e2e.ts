import { test, expect } from '@playwright/test';

// Phase 0 linchpin: proves a headless browser can drive THIS app in THIS environment and that a
// screenshot artifact is produced (which the agent reads back visually to close the feedback loop).
// No engine mutation — this only loads the PWA Library and captures what the reviewer would see.
test('PWA Library renders in a real browser', async ({ page }) => {
	await page.goto('/');
	// The persistent per-context banner (RPH-DOC-010 §46 #20) proves we landed in the PWA Design context.
	await expect(page.locator('body')).toContainText(/PWA/i);
	await page.screenshot({ path: 'e2e-results/smoke-home.png', fullPage: true });
});
