import { test, expect } from '@playwright/test';
import { gotoHydrated, introspect, resetEngine } from './support/harness';

const STORAGE_KEY = 'jpwb-color-theme';

test.describe('application color theme', () => {
	test('defaults to dark and persists an explicit light preference', async ({ page }) => {
		await gotoHydrated(page, '/');

		const root = page.locator('html');
		const body = page.locator('body');
		await expect(root).toHaveAttribute('data-theme', 'dark');
		await expect(root).toHaveCSS('color-scheme', 'dark');
		await expect(body).toHaveCSS('background-color', 'rgb(19, 19, 19)');

		const lightToggle = page.getByRole('button', { name: 'Light color mode' });
		await expect(lightToggle).toHaveAttribute('aria-pressed', 'false');
		await lightToggle.click();

		await expect(root).toHaveAttribute('data-theme', 'light');
		await expect(root).toHaveCSS('color-scheme', 'light');
		await expect(body).toHaveCSS('background-color', 'rgb(240, 236, 223)');
		await expect(page.getByRole('button', { name: 'Light color mode' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('light');
		await expect(page.locator('meta[data-jpwb-theme-color]')).toHaveAttribute('content', '#f0ecdf');

		await page.getByRole('link', { name: 'Undertakings' }).click();
		await expect(root).toHaveAttribute('data-theme', 'light');
		await page.reload();
		await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
		await expect(root).toHaveAttribute('data-theme', 'light');
	});

	test('restores light before hydration and propagates the mode to Svelte Flow', async ({
		page,
		request
	}) => {
		await resetEngine(request, 'reference');
		const snapshot = await introspect(request);
		const pwaId = snapshot.pwas[0]?.id;
		const undertakingId = snapshot.undertakings[0]?.id;
		expect(pwaId).toBeTruthy();
		expect(undertakingId).toBeTruthy();

		await page.goto('/');
		await page.evaluate((key) => localStorage.setItem(key, 'light'), STORAGE_KEY);
		await page.goto(`/pwa/${pwaId}`);
		const root = page.locator('html');
		await expect(root).toHaveAttribute('data-theme', 'light');
		await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
		await expect(page.locator('.svelte-flow')).toHaveClass(/\blight\b/);
		await expect(page.locator('.svelte-flow__node .card').first()).toHaveCSS(
			'background-color',
			'rgb(250, 247, 239)'
		);
		await expect(page.locator('.svelte-flow__controls-button').first()).toHaveCSS(
			'background-color',
			'rgb(250, 247, 239)'
		);

		await page.getByRole('button', { name: 'Light color mode' }).click();
		await expect(root).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('.svelte-flow')).toHaveClass(/\bdark\b/);
		await expect(page.locator('.svelte-flow__node .card').first()).toHaveCSS(
			'background-color',
			'rgb(27, 27, 28)'
		);

		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await expect(page.locator('.svelte-flow')).toHaveClass(/\bdark\b/);
		await expect(page.locator('.svelte-flow__controls-button').first()).toHaveCSS(
			'background-color',
			'rgb(38, 40, 44)'
		);
	});
});
