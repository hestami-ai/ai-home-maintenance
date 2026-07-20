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
		await page
			.locator('textarea[name="purpose"]')
			.fill('Every tenant boundary is enforced and tested.');
		await page
			.locator('textarea[name="criteria"]')
			.fill('Tenant data is isolated\nCross-tenant access is denied');
		await page.getByRole('button', { name: 'Create policy' }).click();

		// TRUTH: a regular policy is born DRAFT, with its criteria, and must be deliberately activated.
		let snap = await introspect(request);
		const findByName = (name: string) =>
			snap.assurancePolicies.find((p: { state: { name?: string } }) => p.state.name === name);
		const created = findByName('Tenant Isolation Review');
		expect(created, 'new policy exists').toBeTruthy();
		expect(created.state.status).toBe('DRAFT');
		expect(created.state.criteria as unknown[]).toHaveLength(2);
		const createdId = created.id as string;
		const card = mgr.locator(`[data-policy-id="${createdId}"]`);
		await expect(card.getByText('DRAFT', { exact: true })).toBeVisible();
		await card.getByRole('button', { name: 'Activate', exact: true }).click();
		await expect(card.getByText('ACTIVE', { exact: true })).toBeVisible();
		snap = await introspect(request);
		expect(findByName('Tenant Isolation Review').state.status).toBe('ACTIVE');

		await shot(page, 'assurance policy manager — library + a newly authored policy');

		// Define directly from the open manager. The mode transition must reveal the type form and preserve the ACTIVE
		// policy as a selectable declared treatment.
		await page.getByRole('button', { name: '+ Define PWU Type' }).click();
		await expect(page.locator('input[name="name"]')).toBeVisible();
		await page.locator('input[name="name"]').fill('Realization Root');
		await page.locator('input[name="pwuKind"]').fill('REALIZATION');
		await page.getByLabel(/Root type/).check();
		await page.getByRole('checkbox', { name: 'Tenant Isolation Review', exact: true }).check();
		await page.getByRole('button', { name: 'Add type' }).click();
		await expect(
			page.locator('.svelte-flow__node').filter({ hasText: 'Realization Root' })
		).toBeVisible();

		// TRUTH: the root declares the policy.
		snap = await introspect(request);
		const root = snap.pwuTypes.find(
			(t: { state: { name?: string } }) => t.state.name === 'Realization Root'
		);
		expect(root.state.requiredAssurancePolicyIds).toContain(createdId);

		// Suspend the policy in the manager, then activate it — the engine status round-trips.
		await page.getByRole('button', { name: '⚖ Policies' }).click();
		await card.getByRole('button', { name: 'Suspend' }).click();
		await expect(card.getByText('SUSPENDED', { exact: true })).toBeVisible();
		snap = await introspect(request);
		expect(findByName('Tenant Isolation Review').state.status).toBe('SUSPENDED');

		// An unrelated edit must retain an existing declaration after its policy becomes inactive. The inactive row is
		// explicit and removable, rather than disappearing from the form and being silently dropped on save.
		await page.getByRole('button', { name: 'Close policy manager' }).click();
		await page.locator('.svelte-flow__node').filter({ hasText: 'Realization Root' }).click();
		await page.getByRole('button', { name: 'Edit', exact: true }).click();
		await expect(
			page.getByRole('checkbox', { name: /Tenant Isolation Review SUSPENDED/ })
		).toBeChecked();
		await page.locator('textarea[name="purpose"]').fill('Updated while its policy is suspended.');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
		snap = await introspect(request);
		expect(
			snap.pwuTypes.find((t: { id: string }) => t.id === root.id).state.requiredAssurancePolicyIds
		).toContain(createdId);

		await page.getByRole('button', { name: '⚖ Policies' }).click();
		await card.getByRole('button', { name: 'Activate', exact: true }).click();
		await expect(card.getByText('ACTIVE', { exact: true })).toBeVisible();
		snap = await introspect(request);
		expect(findByName('Tenant Isolation Review').state.status).toBe('ACTIVE');

		// Version it: a successor copy is created and the predecessor is SUPERSEDED.
		await card.getByRole('button', { name: 'Create & activate version' }).click();
		await expect(card.getByText('SUPERSEDED', { exact: true })).toBeVisible();
		snap = await introspect(request);
		const predecessor = snap.assurancePolicies.find((p: { id: string }) => p.id === createdId);
		expect(predecessor.state.status).toBe('SUPERSEDED');
		const successors = snap.assurancePolicies.filter(
			(p: { id: string; state: { name?: string } }) =>
				p.state.name === 'Tenant Isolation Review' && p.id !== createdId
		);
		expect(successors).toHaveLength(1);
		expect(successors[0].state.status).toBe('ACTIVE');
		const successorId = successors[0].id as string;
		const migratedRoot = snap.pwuTypes.find((t: { id: string }) => t.id === root.id);
		expect(migratedRoot.state.requiredAssurancePolicyIds).toContain(successorId);
		expect(migratedRoot.state.requiredAssurancePolicyIds).not.toContain(createdId);
		for (const field of [
			'findingDefinitions',
			'waiverRules',
			'requiredEvidence',
			'optionalEvidence',
			'dispositionRules',
			'escalationRules'
		]) {
			expect(successors[0].state[field]).toEqual(predecessor.state[field]);
		}

		// A published PWA is immutable, but its historical reference must not deadlock future policy evolution. Publish
		// this definition, version its current policy again, and prove the new policy is created while the published type
		// stays pinned to the exact policy version it declared.
		await page.getByRole('button', { name: 'Close policy manager' }).click();
		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();
		await expect(page.getByText(/Published versions are immutable/i)).toBeVisible();
		await page.getByRole('button', { name: '⚖ Policies' }).click();
		const successorCard = mgr.locator(`[data-policy-id="${successorId}"]`);
		await successorCard.getByRole('button', { name: 'Create & activate version' }).click();
		await expect(successorCard.getByText('SUPERSEDED', { exact: true })).toBeVisible();

		snap = await introspect(request);
		const newest = snap.assurancePolicies.filter(
			(p: { id: string; state: { name?: string } }) =>
				p.state.name === 'Tenant Isolation Review' && p.id !== createdId && p.id !== successorId
		);
		expect(newest).toHaveLength(1);
		expect(newest[0].state.status).toBe('ACTIVE');
		const publishedRoot = snap.pwuTypes.find((t: { id: string }) => t.id === root.id);
		expect(publishedRoot.state.requiredAssurancePolicyIds).toContain(successorId);
		expect(publishedRoot.state.requiredAssurancePolicyIds).not.toContain(newest[0].id);
	});
});
