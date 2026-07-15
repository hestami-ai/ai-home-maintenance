import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';
import { shot } from './support/gallery';

// The engine-backed Assurance Policy manager (§8.9/§17): the library lists the LOCKED mandatory floor policies +
// the additive ones; a human can create / suspend / activate / version a policy, and reference an ACTIVE policy on
// a PWU Type. Verifies the full round-trip form -> command -> engine (introspect) -> reload -> UI.
test.describe('PWA Designer — Assurance Policy manager', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('create, reference on a type, suspend, activate, and version a policy', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Policy Lifecycle PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await gotoHydrated(
			page,
			(await page.getByRole('link', { name: /Policy Lifecycle PWA/ }).getAttribute('href'))!
		);

		// Open the manager — even in the 'empty' authoring flow the library is seeded (floor + additive).
		await page.getByRole('button', { name: '⚖ Policies' }).click();
		const mgr = page.locator('.inspectorpanel');
		await expect(mgr.getByText('Identity, Provenance & Trace Completeness')).toBeVisible();
		await expect(mgr.locator('.policycard.floorcard').first()).toBeVisible(); // a locked mandatory policy

		// Create a new policy.
		await page.getByRole('button', { name: '＋ New policy' }).click();
		await page.locator('input[name="name"]').fill('Tenant Isolation Review');
		await page.locator('textarea[name="purpose"]').fill('Every tenant boundary is enforced and tested.');
		await page
			.locator('textarea[name="criteria"]')
			.fill('Tenant data is isolated\nCross-tenant access is denied');
		await page.getByRole('button', { name: 'Create policy' }).click();

		// TRUTH: the engine recorded the new ACTIVE policy with its criteria.
		let snap = await introspect(request);
		const findByName = (name: string) =>
			snap.assurancePolicies.find((p: { state: { name?: string } }) => p.state.name === name);
		let created = findByName('Tenant Isolation Review');
		expect(created, 'new policy exists').toBeTruthy();
		expect(created.state.status).toBe('ACTIVE');
		expect((created.state.criteria as unknown[]).length).toBe(2);
		const createdId = created.id as string;

		await shot(page, 'assurance policy manager — library + a newly authored policy');

		// Reference the new ACTIVE policy on a PWU Type: close the manager, define a root, edit it, pick the policy.
		await mgr.getByRole('button', { name: 'Close policy manager' }).click();
		await page.getByRole('button', { name: '+ Define PWU Type' }).click();
		await page.locator('input[name="name"]').fill('Realization Root');
		await page.locator('input[name="pwuKind"]').fill('REALIZATION');
		await page.getByLabel(/Root type/).check();
		await page.getByRole('checkbox', { name: 'Tenant Isolation Review', exact: true }).check();
		await page.getByRole('button', { name: 'Add type' }).click();

		// TRUTH: the root declares the policy.
		snap = await introspect(request);
		const root = snap.pwuTypes.find(
			(t: { state: { name?: string } }) => t.state.name === 'Realization Root'
		);
		expect(root.state.requiredAssurancePolicyIds).toContain(createdId);

		// Suspend the policy in the manager, then activate it — the engine status round-trips.
		await page.getByRole('button', { name: '⚖ Policies' }).click();
		const card = mgr.locator('.policycard').filter({ hasText: 'Tenant Isolation Review' });
		await card.getByRole('button', { name: 'Suspend' }).click();
		snap = await introspect(request);
		expect(findByName('Tenant Isolation Review').state.status).toBe('SUSPENDED');
		await card.getByRole('button', { name: 'Activate' }).click();
		snap = await introspect(request);
		expect(findByName('Tenant Isolation Review').state.status).toBe('ACTIVE');

		// Version it: a successor copy is created and the predecessor is SUPERSEDED.
		await card.getByRole('button', { name: 'New version' }).click();
		snap = await introspect(request);
		const predecessor = snap.assurancePolicies.find(
			(p: { id: string }) => p.id === createdId
		);
		expect(predecessor.state.status).toBe('SUPERSEDED');
		const successors = snap.assurancePolicies.filter(
			(p: { id: string; state: { name?: string } }) =>
				p.state.name === 'Tenant Isolation Review' && p.id !== createdId
		);
		expect(successors.length).toBe(1);
		expect(successors[0].state.status).toBe('ACTIVE');
	});
});
