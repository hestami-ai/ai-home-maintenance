import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';
import { shot } from './support/gallery';

// The engine-backed Assurance Policy manager (§8.9/§17): the library lists the LOCKED mandatory floor policies +
// the additive ones; a human can create / suspend / activate / version a policy, and reference an ACTIVE policy on
// a PWU Type. Verifies the full round-trip form -> command -> engine (introspect) -> reload -> UI.
/**
 * FIND-OR-FAIL. Narrows `T | undefined` to `T`, and turns a missing row into a NAMED assertion failure instead
 * of a TypeError three lines later.
 *
 * ⚠ ADDED WHEN `apps/rph-demo/e2e/` WAS FIRST PUT UNDER A TYPE GATE (REG-F-166). Every `.find()` here was used
 * unnarrowed, which typechecked as `possibly undefined` the moment anything looked — and nothing ever had: 38
 * specs were compiled by nothing at all. A bare `!` would have silenced the compiler while leaving the runtime
 * failure exactly as opaque; this asserts the thing the spec already believes, so the failure names itself.
 */
function must<T>(row: T | undefined, what: string): T {
	expect(row, what).toBeTruthy();
	return row as T;
}

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
			must(
				snap.assurancePolicies.find((p: { state: { name?: string } }) => p.state.name === name),
				`assurance policy ${name} exists`
			);
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
		const root = must(
			snap.pwuTypes.find((t: { state: { name?: string } }) => t.state.name === 'Realization Root'),
			'the Realization Root PWU Type exists'
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
			must(
				snap.pwuTypes.find((t: { id: string }) => t.id === root.id),
				'the root survives the reload'
			).state.requiredAssurancePolicyIds
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
		const predecessor = must(
			snap.assurancePolicies.find((p: { id: string }) => p.id === createdId),
			'the superseded predecessor is still stored'
		);
		expect(predecessor.state.status).toBe('SUPERSEDED');
		const successors = snap.assurancePolicies.filter(
			(p: { id: string; state: { name?: string } }) =>
				p.state.name === 'Tenant Isolation Review' && p.id !== createdId
		);
		expect(successors).toHaveLength(1);
		expect(successors[0].state.status).toBe('ACTIVE');
		const successorId = successors[0].id as string;
		const migratedRoot = must(
			snap.pwuTypes.find((t: { id: string }) => t.id === root.id),
			'the root survives the version migration'
		);
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
		const publishedRoot = must(
			snap.pwuTypes.find((t: { id: string }) => t.id === root.id),
			'the root survives publication'
		);
		expect(publishedRoot.state.requiredAssurancePolicyIds).toContain(successorId);
		expect(publishedRoot.state.requiredAssurancePolicyIds).not.toContain(newest[0].id);
	});

	// ── ⛔⛔ JAN-EXECGOV EG-04 — EDITING A POLICY MUST NOT WIDEN WHAT IT GOVERNS ──────────────────────────────
	//
	// THE DEFECT, MEASURED. `policy-fields.ts` read `form.get('applicableObjectTypes')` and NO control emitted
	// it — the name has never appeared in any `.svelte` file in this repository's history. `csvList(null)`
	// returned `[]`, `[]` is TRUTHY, so the create fallback was DEAD and the edit guard ALWAYS fired. Every
	// UI-authored policy was born with an empty scope, and every edit re-emptied it.
	//
	// ⚠ AND AN EMPTY SCOPE DOES NOT NARROW — IT WIDENS. `governance.ts` guards its `NOT_APPLICABLE` limb on
	// `objectTypes.length > 0`, so an empty condition set skips the guard and falls through to `REQUIRED`.
	// Driven against the engine before the fix: a policy created for `PROFESSIONAL_WORK_UNIT` was
	// `NOT_APPLICABLE` to a PWA, and after a RENAME it was `REQUIRED`. Both commands ACCEPTED.
	//
	// ⭑⭑ THIS SPEC EXISTS BECAUSE THE UNIT TESTS CANNOT SEE THE ROUTE. `policy-round-trip.test.ts` proves
	// `policyEditPatch` omits the field; nothing there proves the ACTION CALLS IT. Reverting the route to its
	// eight inline spreads leaves every unit test green — which is the wired-but-unproven shape this repository
	// has recorded against itself repeatedly. The assertions below read the ENGINE, through `introspect`.
	test('editing and versioning a policy cannot widen what it applies to (EG-04)', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Scope Integrity PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await gotoHydrated(
			page,
			(await page.getByRole('link', { name: /Scope Integrity PWA/ }).getAttribute('href'))!
		);
		await page.getByRole('button', { name: '⚖ Policies' }).click();

		await page.getByRole('button', { name: '＋ New policy' }).click();
		await page.locator('input[name="name"]').fill('Scope Integrity Review');
		await page.locator('textarea[name="purpose"]').fill('That a policy keeps the scope it was born with.');
		await page.locator('textarea[name="criteria"]').fill('The scope survives an edit.');
		await page.getByRole('button', { name: 'Create policy' }).click();

		const scopeOf = async (name: string) => {
			const snap = await introspect(request);
			const row = must(
				snap.assurancePolicies.find((p: { state: { name?: string } }) => p.state.name === name),
				`assurance policy ${name} exists`
			);
			return row.state as {
				applicableObjectTypes?: string[];
				applicability?: { objectTypeConditions?: string[] };
			};
		};

		// ⭑ THE ARRANGEMENT, ASSERTED. Before the fix this was `[]` — so a spec that only checked the edge
		// would have compared one empty scope against another and passed while measuring nothing.
		const born = await scopeOf('Scope Integrity Review');
		expect(born.applicableObjectTypes, 'a UI-authored policy is born SCOPED, not universal').toEqual([
			'PROFESSIONAL_WORK_UNIT'
		]);
		expect(born.applicability?.objectTypeConditions).toEqual(['PROFESSIONAL_WORK_UNIT']);

		// ⛔ A RENAME. Nothing about changing a policy's wording should change what it governs — the same
		// sentence `policy-fields.ts` already carried about severity, on the other half of the round trip.
		const card = page.locator('.policycard', { hasText: 'Scope Integrity Review' });
		await card.getByRole('button', { name: 'Edit', exact: true }).click();
		await page.locator('input[name="name"]').fill('Scope Integrity Review (renamed)');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect(page.getByText('Scope Integrity Review (renamed)')).toBeVisible();

		const renamed = await scopeOf('Scope Integrity Review (renamed)');
		expect(renamed.applicableObjectTypes, 'a rename must not empty the scope').toEqual([
			'PROFESSIONAL_WORK_UNIT'
		]);
		// ⭑ THE FIELD THE ENFORCED §5.1 DETERMINATION ACTUALLY PREFERS. Asserting `applicableObjectTypes` alone
		// would pass on the day someone "fixes" this by writing `[]` consistently into both places.
		expect(
			renamed.applicability?.objectTypeConditions,
			'reconcileApplicability must have taken its "scope untouched by this edit" limb'
		).toEqual(['PROFESSIONAL_WORK_UNIT']);
	});
});
