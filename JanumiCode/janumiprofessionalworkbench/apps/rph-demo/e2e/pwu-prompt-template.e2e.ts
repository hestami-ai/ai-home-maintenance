import { expect } from '@playwright/test';
import { test, resetEngine, introspect, gotoHydrated } from './support/harness';

// JAN-PROMPT — the screen the sponsor went looking for and could not find.
//
// Their report, verbatim: *"I couldn't see for example in RPH-demo where to view or edit the PWU's prompt
// template since at its core a PWU is an agent with a prompt template and relevant context. And none of that
// existed in reality."* It did not: a search of every object definition for a prompt/template/context field
// returned two hits and neither was a template.
//
// ⭑ THIS SPEC IS THE ROADMAP'S NO-SHIP CONDITION. `ROADMAP-prompt-template-and-context.md` PT-04 says the
// contracts, the handler and the render guard "do not ship without PT-04", because a governed field with no
// screen is the hollow layer this repository has recorded against itself repeatedly — and in this case it is
// literally the defect being fixed.
test.describe('PWA Designer — a PWU type carries the prompt its work is attempted with', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('a prompt is authored, stored on the type, and READ BACK when the type is reopened', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Prompted Operations PWA');
		await page.getByPlaceholder(/Domain/i).fill('logistics');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await page.getByRole('link', { name: /Prompted Operations PWA/ }).click();

		// ── Author a type WITH a prompt ────────────────────────────────────────────────────────────────
		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Route Assessment');
		await page.locator('input[name="pwuKind"]').fill('ROUTE_ASSESSMENT');
		await page.getByLabel(/Root type/i).check();
		// JAN-DISCHARGE — the type must SAY a model does this work. Rule 2 refuses an ACTIVE prompt on a type
		// that declares anything else, so this line is the spec obeying the coherence rule rather than
		// dodging it: an armed prompt and a declared discharge are one decision, said once.
		await page.getByTestId('pwu-type-discharge').selectOption('MODEL');
		const PROMPT = 'Assess {subject} against {criteria}, and report findings.';
		await page.getByTestId('pwu-type-prompt').fill(PROMPT);

		// The markers are DERIVED from the text and shown back, so an author can see what the prompt will need
		// before they save it. Asking them to hand-list these is what manufactures the drift the render guard
		// exists to refuse.
		await expect(page.getByTestId('pwu-type-prompt-markers')).toContainText('subject');
		await expect(page.getByTestId('pwu-type-prompt-markers')).toContainText('criteria');

		await page.getByRole('button', { name: 'Add type' }).click();
		await expect(
			page.locator('.svelte-flow__node').filter({ hasText: 'Route Assessment' })
		).toBeVisible();

		// ── ENGINE STATE, not page text. The screen showing a prompt proves nothing about what was stored. ──
		const after = await introspect(request);
		expect(after.pwuTypes, 'exactly one type was authored').toHaveLength(1);
		const stored = (after.pwuTypes[0]!.state ?? {}) as {
			promptTemplate?: { templateText?: string; declaredPlaceholders?: string[]; status?: string };
		};
		expect(stored.promptTemplate?.templateText, 'the prompt reached the engine').toBe(PROMPT);
		// ⭑ DERIVED SERVER-SIDE. The browser was never asked for this list, so its presence here proves the
		// derivation ran on the write path rather than being echoed back from the DOM.
		expect(stored.promptTemplate?.declaredPlaceholders?.sort()).toEqual(['criteria', 'subject']);
		// Unchecked "Ready to use" means DRAFT — saved, and refused at render. Authoring is not arming.
		expect(stored.promptTemplate?.status).toBe('DRAFT');

		// ── AND IT COMES BACK. This is the sponsor's actual complaint: not "no field", but "nowhere to VIEW". ──
		await page.reload();
		await page.locator('.svelte-flow__node').filter({ hasText: 'Route Assessment' }).click();
		await page.getByRole('button', { name: /^Edit$/ }).first().click();
		await expect(
			page.getByTestId('pwu-type-prompt'),
			'the stored prompt must be visible in the editor, not merely writable'
		).toHaveValue(PROMPT);
	});

	test('⭑ editing ONLY the prompt is accepted — the no-op guard does not swallow it', async ({
		page,
		request
	}) => {
		// THE MUTANT THIS EXISTS FOR: `EditPwuType` refuses an edit that changes nothing, by comparing an
		// enumerated list of payload fields. A field missing from that list is invisible to the comparison, so
		// changing ONLY the prompt would be refused as "nothing changed" — the sponsor's complaint reproduced
		// one layer down, by the fix for it. The unit test drives the handler; this proves it through the UI,
		// where the failure would actually be met.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Prompt Edit PWA');
		await page.getByPlaceholder(/Domain/i).fill('logistics');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await page.getByRole('link', { name: /Prompt Edit PWA/ }).click();

		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Route Assessment');
		await page.locator('input[name="pwuKind"]').fill('ROUTE_ASSESSMENT');
		await page.getByLabel(/Root type/i).check();
		// JAN-DISCHARGE — the type must SAY a model does this work. Rule 2 refuses an ACTIVE prompt on a type
		// that declares anything else, so this line is the spec obeying the coherence rule rather than
		// dodging it: an armed prompt and a declared discharge are one decision, said once.
		await page.getByTestId('pwu-type-discharge').selectOption('MODEL');
		await page.getByTestId('pwu-type-prompt').fill('First draft of the prompt.');
		await page.getByRole('button', { name: 'Add type' }).click();
		await expect(
			page.locator('.svelte-flow__node').filter({ hasText: 'Route Assessment' })
		).toBeVisible();

		// Reopen and change the prompt AND NOTHING ELSE.
		await page.locator('.svelte-flow__node').filter({ hasText: 'Route Assessment' }).click();
		await page.getByRole('button', { name: /^Edit$/ }).first().click();
		const REVISED = 'Revised prompt: assess the route and report findings.';
		await page.getByTestId('pwu-type-prompt').fill(REVISED);
		await page.getByRole('button', { name: /Save|Update type/i }).click();

		const after = await introspect(request);
		const stored = (after.pwuTypes[0]!.state ?? {}) as { promptTemplate?: { templateText?: string } };
		expect(stored.promptTemplate?.templateText, 'a prompt-only edit was silently dropped').toBe(REVISED);
	});
});
