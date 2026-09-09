import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// Slice 1 — PWA Designer authoring (RPH-DOC-010 §6/§11). A DRAFT PWA must be extensible with PWU Types and
// advanceable through the publication lifecycle DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED, every step driving
// the real engine. This closes "creating a new PWA only lets you create it — you can't define its PWU Types".
test.describe('PWA Designer — author PWU Types and publish', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('author a draft PWA, define a root PWU Type, and publish it', async ({ page, request }) => {
		// 1. Create a DRAFT PWA from the Library.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Delivery Operations PWA');
		await page.getByPlaceholder(/Domain/i).fill('logistics');
		await page.getByRole('button', { name: 'Create draft' }).click();

		// 2. Open it — Library cards link to /pwa/[id].
		await page.getByRole('link', { name: /Delivery Operations PWA/ }).click();
		await expect(page.getByRole('heading', { name: 'Delivery Operations PWA' })).toBeVisible();

		// 3. Define a root PWU Type — the authoring control that was the dead-end.
		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Delivery Realization');
		await page.locator('input[name="pwuKind"]').fill('DELIVERY_REALIZATION');
		await page.getByLabel(/Root type/i).check();
		await page.getByRole('button', { name: 'Add type' }).click();

		// SEMANTIC: the new PWU Type shows as a node in the Work Architecture graph.
		await expect(
			page.locator('.svelte-flow__node').filter({ hasText: 'Delivery Realization' })
		).toBeVisible();

		// 4. Advance the publication lifecycle to PUBLISHED.
		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();

		// SEMANTIC: the PWA is now published + immutable.
		await expect(page.getByText(/Published versions are immutable/i)).toBeVisible();

		// TRUTH: the engine really recorded a PUBLISHED PWA with exactly one root PWU Type (not just rendered text).
		const snap = await introspect(request);
		expect(snap.pwas).toHaveLength(1);
		expect(snap.pwas[0].state.publicationStatus).toBe('PUBLISHED');
		const roots = snap.pwuTypes.filter((t) => t.state.isRoot === true);
		expect(roots).toHaveLength(1);
		expect(roots[0].state.name).toBe('Delivery Realization');

		// VISUAL: capture the published PWA for review.
		await page.screenshot({ path: 'e2e-results/pwa-authoring-published.png', fullPage: true });
	});

	// ── ⭑⭑ JAN-EXECGOV EG-06 — THE HELP A PROFESSIONAL READS DOES NOT CLAIM GOVERNANCE THAT DOES NOT EXIST ──
	//
	// Measured across the twenty controls of this form: five help strings asserted a guarantee the code does not
	// make. The worst was `completionRule` — "When an Instance of this type is DONE ... (no green without
	// assurance)" — where NOTHING evaluates the field, and "no green without assurance" is a REAL guarantee made
	// by requireGoverningPolicies and the locked floor, keyed on other fields entirely. A true guarantee attached
	// to an inert textbox is a reason to trust it.
	//
	// ⚠ THIS SPEC EXISTS BECAUSE THE GATE CANNOT SEE A BROWSER. verif/authoring-field-disposition.test.ts asserts
	// the admission is in the string and that the string is referenced by the markup; only this asserts a person
	// can read it. Content authored, validated, and terminated at the surface boundary is this repository's own
	// recurring finding.
	test('an unenforced PWU Type setting admits that, where the author reads it (EG-06)', async ({ page }) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Help Honesty PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await gotoHydrated(
			page,
			(await page.getByRole('link', { name: /Help Honesty PWA/ }).getAttribute('href'))!
		);
		await page.getByRole('button', { name: '+ Define PWU Type' }).click();

		const form = page.locator('form.typeform');
		// ⛔ THE ADMISSION. Before EG-06 this box claimed to decide when work is DONE.
		await expect(form.getByText(/RECORDED AND SHOWN, not evaluated/i)).toBeVisible();
		await expect(form.getByText(/no gate reads it/i)).toBeVisible();
		// ⭑ AND IT REDIRECTS the author to what actually holds a PWU back, rather than only warning them off.
		await expect(form.getByText(/locked floor plus the policies selected by/i)).toBeVisible();
		// The composition claim: it builds the graph, it does not permit or forbid. ⚠ THIS ASSERTION IS WHY THE
		// E2E EARNED ITS PLACE — it first failed, because the string EG-06 corrected for this control
		// (`permittedChildTypeIds`) was rendered by NOTHING. The admission was folded into the help that IS
		// rendered, and the dead entry deleted.
		await expect(form.getByText(/NOT AN ALLOW-LIST/i)).toBeVisible();

		// ⭑⭑ CONTROL — a field that IS enforced still says so. Without this the remedy degrades into
		// "disclaim everything", and a professional told that nothing works stops reading the notes at all.
		await expect(form.getByText(/Publishing requires a root/i)).toBeVisible();
	});

	// ── ⭑⭑ JAN-EXECGOV EG-07a — THE APPROVAL MOMENT CAN SEE WHAT IT APPROVES ──────────────────────────────
	//
	// SPONSOR DIRECTION: "the human reviewing the full PWA before approving its use would be the model."
	// MEASURED: that control failed at its own control point. `editable = isDraft && (!hasStagedCandidate ||
	// running)`, and the type FORM — the ONLY surface in this repository that rendered workDischarge or the
	// prompt — sits behind `{:else if editable && formMode !== null}`. With an agent candidate STAGED, editable
	// is FALSE and the panel falls to the read-only inspector, which showed Kind, Boundary, Purpose, Completion
	// rule, Required inputs, Required outputs — and NEITHER. So at acceptAgentCandidate, documented as "explicit
	// human acceptance of the exact assured preview", the human approved how work is discharged and what an
	// agent would be told without either being on screen.
	//
	// ⚠ WHAT THIS SPEC DOES AND DOES NOT REACH. It drives the read-only inspector directly — the same component
	// the staged-candidate path falls to — rather than standing up the agent harness. It therefore proves the
	// SURFACE renders the facts; it does not by itself prove the staged-candidate route reaches this component.
	// Stated rather than implied.
	test('the read-only inspector shows how work is discharged, and the prompt status (EG-07a)', async ({
		page
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Discharge Visibility PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await gotoHydrated(
			page,
			(await page.getByRole('link', { name: /Discharge Visibility PWA/ }).getAttribute('href'))!
		);

		await page.getByRole('button', { name: '+ Define PWU Type' }).click();
		await page.locator('input[name="name"]').fill('Model Discharged Type');
		await page.locator('input[name="pwuKind"]').fill('MODEL_WORK');
		await page.getByTestId('pwu-type-discharge').selectOption('MODEL');
		await page.getByTestId('pwu-type-prompt').fill('Assess {subject} and report findings.');
		await page.getByRole('button', { name: 'Add type' }).click();

		// The node is selected and NOT being edited — the state a staged candidate also lands in.
		await page.locator('.svelte-flow__node').filter({ hasText: 'Model Discharged Type' }).click();

		// ⛔ THE TWO FACTS THE APPROVAL MOMENT COULD NOT SEE.
		// ⚠⚠ `toBeVisible` BEFORE `toContainText`, AND A MUTANT PROVED IT NECESSARY. The first version asserted
		// only `toContainText`, which reads textContent and PASSES ON A HIDDEN ELEMENT — so adding `hidden` to
		// the field left the suite green. A test that accepts DOM presence in place of visibility is asserting
		// exactly the defect this increment exists to fix, one layer down.
		await expect(page.getByTestId('inspector-discharge')).toBeVisible();
		await expect(page.getByTestId('inspector-discharge')).toContainText('A MODEL');
		await expect(page.getByTestId('inspector-prompt')).toBeVisible();
		await expect(page.getByTestId('inspector-prompt')).toContainText('DRAFT');
		// ⭑ And the prompt's status is stated in consequence terms, not as a bare token: an unarmed instruction
		// renders nothing, which is the fact a professional needs at the moment they approve it.
		await expect(page.getByTestId('inspector-prompt')).toContainText(/authored, not armed/i);
	});
});
