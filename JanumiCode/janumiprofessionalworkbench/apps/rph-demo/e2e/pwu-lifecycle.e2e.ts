import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// Slice 3 — PWU lifecycle + INV-5 ("no green without assurance"). Drives a PWU through the four axes in the UI and
// proves the engine keeps execution success and assurance separate: a SUCCEEDED PWU is NOT green until an assurance
// assessment is SATISFIED, and attempting to mark it satisfied early is rejected.
test.describe('Undertaking Workbench — PWU lifecycle enforces no-green-without-assurance', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('a PWU only becomes SATISFIED after its assurance is SATISFIED', async ({
		page,
		request
	}) => {
		// Arrange: a fresh Undertaking with one PROPOSED PWU.
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Lifecycle Demo');
		await page.getByRole('combobox').selectOption({ index: 1 });
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		const row = page.getByRole('link', { name: /Lifecycle Demo/ });
		await expect(row).toBeVisible();
		await gotoHydrated(page, (await row.getAttribute('href'))!);
		await page.getByRole('button', { name: 'overview' }).click();
		await page.getByRole('combobox').selectOption({ label: 'Architecture Definition' });
		await page.getByPlaceholder(/Instance title/i).fill('Arch Work');
		await page.getByRole('button', { name: 'Instantiate PWU' }).click();
		await expect(page.getByText('Arch Work')).toBeVisible();

		// Act 1: Begin & Execute -> executionState SUCCEEDED, but still UNASSESSED (amber, NOT green).
		await page.getByRole('button', { name: 'Begin & Execute' }).click();
		await expect(page.getByRole('button', { name: 'Record Assurance' })).toBeVisible();
		let snap = await introspect(request);
		let pwu = snap.pwus.find((p) => p.state.title === 'Arch Work')!;
		expect(pwu.state.executionState).toBe('SUCCEEDED');
		expect(pwu.state.assuranceState).toBe('UNASSESSED');
		expect(pwu.state.workLifecycleState).not.toBe('SATISFIED');

		// Act 2: try to Mark Satisfied WITHOUT assurance -> the engine rejects; the PWU is still not SATISFIED.
		await page.getByRole('button', { name: 'Mark Satisfied' }).click();
		await expect(page.getByRole('alert')).toBeVisible();
		snap = await introspect(request);
		pwu = snap.pwus.find((p) => p.state.title === 'Arch Work')!;
		expect(pwu.state.workLifecycleState).not.toBe('SATISFIED');

		// Act 3: Record Assurance (a SATISFIED assessment), then Mark Satisfied -> green WITH assurance.
		await page.getByRole('button', { name: 'Record Assurance' }).click();
		await expect(page.getByRole('button', { name: 'Record Assurance' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Mark Satisfied' }).click();
		await expect(page.getByText('✓ satisfied')).toBeVisible();

		snap = await introspect(request);
		pwu = snap.pwus.find((p) => p.state.title === 'Arch Work')!;
		// Green ONLY now — and only because assuranceState is SATISFIED (INV-5 upheld end to end).
		expect(pwu.state.workLifecycleState).toBe('SATISFIED');
		expect(pwu.state.assuranceState).toBe('SATISFIED');
		expect(pwu.state.executionState).toBe('SUCCEEDED');

		await page.screenshot({ path: 'e2e-results/pwu-lifecycle-satisfied.png', fullPage: true });
	});

	test('the §38 Assurance View renders live: the reference undertaking shows folded independence status + validator identity', async ({
		page
	}) => {
		// The §38 Assurance View (buildAssuranceView) is a fold over the governed event stream. It was built but never
		// rendered — the assurance tab showed only raw policy + state from the object store. Now the tab consumes the
		// folded view, surfacing what only the events carry: the INDEPENDENCE STATUS (I2/I4 — the reference drive's
		// Reasoning Review is DIFFERENT_MODEL and passes, so an assessment reads VERIFIED) and the VALIDATOR
		// IMPLEMENTATION IDENTITY (Increment 37). This is the read model's first live consumer.
		await gotoHydrated(page, '/undertakings');
		const link = page.getByRole('link', { name: /Field Service Management/i });
		await expect(link).toBeVisible();
		await gotoHydrated(page, (await link.getAttribute('href'))!);
		await page.getByRole('button', { name: 'assurance' }).click();
		await expect(page.getByText('VERIFIED').first()).toBeVisible();
		await expect(page.getByText('deterministic.reasoning-review').first()).toBeVisible();

		// §38 completeness (Increments E–H): the full field set now renders per assessment. The detail block labels
		// every §38 field; missing evidence is the one unsourced field and reads 'unknown', never a false empty.
		await expect(page.getByText('§38 Assurance Workbench')).toBeVisible();
		await expect(page.getByText('Claims evaluated').first()).toBeVisible();
		await expect(page.getByText('Control actions').first()).toBeVisible();
		await expect(page.getByText('Missing evidence').first()).toBeVisible();
		await expect(page.getByText('unknown (source event unbuilt)').first()).toBeVisible();
		// §38 "applicable policies": the reference PWUs realize types carrying requiredAssurancePolicyIds, so the
		// per-PWU applicable-policies join renders — surfacing required-but-unassessed where no assessment covers one.
		await expect(page.getByRole('heading', { name: /Applicable policies/i }).first()).toBeVisible();
	});
});
