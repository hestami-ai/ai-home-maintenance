import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// Slice 2 — Undertaking creation + PWU instantiation (RPH-DOC-010 §14/§25/§28). Closes "there isn't a way to
// select PWUs because there aren't any": a new Undertaking is instantiated from a PUBLISHED PWA (establishing +
// approving its originating Intent under the hood), then PWU Instances are created by selecting a PWU Type from
// that PWA. Seeded 'reference' state supplies the published Product Realization PWA to instantiate from.
test.describe('Undertaking Workbench — create an Undertaking and instantiate a PWU', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('instantiate an Undertaking from a published PWA and add a PWU realizing a type', async ({
		page,
		request
	}) => {
		// 1. Create a new Undertaking bound to the published PWA.
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Pilot Delivery Program');
		await page.getByPlaceholder(/Objective/i).fill('Ship a pilot to first customers');
		await page.getByPlaceholder(/Intended product/i).fill('Pilot Delivery App');
		await page.getByRole('combobox').selectOption({ index: 1 }); // the one published PWA
		await page.getByRole('button', { name: 'Create Undertaking' }).click();

		// 2. Open the new Undertaking. Read its href and navigate directly — clicking the row is racy against the
		// enhance re-render that swaps the list DOM, and the row's <h3> would also satisfy a name-only heading match.
		const newRow = page.getByRole('link', { name: /Pilot Delivery Program/ });
		await expect(newRow).toBeVisible();
		const href = await newRow.getAttribute('href');
		expect(href).toMatch(/\/undertakings\/und_/);
		await gotoHydrated(page, href!);
		await expect(
			page.getByRole('heading', { name: 'Pilot Delivery Program', level: 1 })
		).toBeVisible();

		// 3. Instantiate a PWU realizing a PWU Type — the control that was the dead-end.
		await page.getByRole('button', { name: 'overview' }).click();
		await page.getByRole('combobox').selectOption({ label: 'Architecture Definition' });
		await page.getByPlaceholder(/Instance title/i).fill('Pilot Architecture');
		await page.getByRole('button', { name: 'Instantiate PWU' }).click();

		// SEMANTIC: the PWU Instance shows in the list.
		await expect(page.getByText('Pilot Architecture')).toBeVisible();

		// TRUTH: the engine recorded a PWU owned by THIS Undertaking, realizing the Architecture Definition type.
		const snap = await introspect(request);
		const undertaking = snap.undertakings.find((u) => u.state.name === 'Pilot Delivery Program');
		expect(undertaking, 'new Undertaking exists in the engine').toBeTruthy();
		const pwus = snap.pwus.filter((p) => p.state.undertakingId === undertaking!.id);
		expect(pwus).toHaveLength(1);
		expect(pwus[0].state.title).toBe('Pilot Architecture');
		expect(pwus[0].state.isLocalExtension).toBe(false);
		const type = snap.pwuTypes.find((t) => t.id === String(pwus[0].state.pwuTypeId));
		expect(type?.state.name).toBe('Architecture Definition');

		// VISUAL: capture the workbench with its first instantiated PWU.
		await page.screenshot({ path: 'e2e-results/undertaking-pwu.png', fullPage: true });
	});
});
