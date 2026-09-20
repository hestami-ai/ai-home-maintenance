import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated, declareRisk } from './support/harness';

// JAN-EXECGOV EG-07f — `STA-8` closes for the AGENT path, proved end to end.
//
// ⭑⭑ WHY THIS EXISTS AS A SEPARATE SPEC. `EG-02` proved *"Execution requires an approved plan and AUTHORIZED
// Runtime Bindings"* on a real execution — but the type in that spec was authored BY A HUMAN, at the form.
// `REG-F-371` recorded the boundary explicitly: **`EG-02`/`EG-03` closed `STA-8` for the HUMAN path only**, and
// that limit was not stated when they landed. A PWU Type has TWO authors, and the agent's half of the surface
// carried NONE of the discharge fields: `DefineTypeInput` had twelve, the tool schema named none of the four, so
// `workDischarge: 'MODEL'` was reachable only by a person. An agent-authored type therefore produced a step that
// took `bindingAuthorityVerdict`'s `OUT_OF_SCOPE` limb — which is exactly `REG-F-365`'s measured state, reached
// by a different road.
//
// ⚠ IT ASSERTS THE ENGINE, NOT THE PAGE, for the same reason `execution-model-invocation.e2e.ts` does: a spec
// that checked the screen said "executed" would prove only that the screen says what the screen says.
//
// ⛔ AND THE AGENT REALLY AUTHORS IT. Test mode forces the deterministic mock agent, so a JSON plan drives exact
// tool calls — the same road a real model takes, with the model's non-determinism removed. Nothing here touches
// the PWU Type form, which is the whole point: if the fields were still human-only, this spec could not express
// its own setup.
test.describe('Undertaking Workbench — an AGENT-authored type executes under an authorized binding', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('⭑ STA-8 holds for a type the AGENT authored, never touching the form', async ({
		page,
		request
	}) => {
		// ── 1. A DRAFT PWA for the agent to work in ───────────────────────────────────────────────────────
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Agent Discharge PWA');
		await page.getByPlaceholder(/Domain/i).fill('logistics');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Agent Discharge PWA/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);

		// ── 2. THE AGENT AUTHORS THE TYPE, DISCHARGE AND ALL ──────────────────────────────────────────────
		// ⭑ These four args are `EG-07b`'s subject. Before it, the tool schema named none of them and this
		// object could not be expressed — the spec would fail at authoring rather than at binding, which is
		// why the mutant below is stated against `DefineTypeInput` rather than against the assertion.
		const plan = {
			plan: [
				{
					tool: 'define_pwu_type',
					args: {
						name: 'Route Assessment',
						pwuKind: 'ROUTE_ASSESSMENT',
						isRoot: true,
						// The type SAYS a model does this work. `stepBindingFor` requires BOTH this and a
						// MODEL_INVOCATION step type; either alone yields no binding.
						workDischarge: 'MODEL',
						promptTemplateText: 'Assess {subject}.',
						promptOutputContract: 'A short assessment.',
						// ⛔ ARMING, NOT AUTHORING. A DRAFT template renders nothing and the step refuses; this
						// boolean is the difference, and `EG-07b` made it reachable by the agent at all.
						promptActive: true
					}
				}
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(page.getByTestId('agent-log')).toContainText('define_pwu_type');
		await page.getByRole('button', { name: 'Accept exact candidate' }).click();

		// ⭑ CONTROL — the AGENT's write actually carried the discharge into canonical state. Without this, a
		// spec whose tool call silently dropped `workDischarge` would fail later at the binding and read as a
		// BINDING defect, sending the next reader to the wrong layer entirely.
		const authored = (await introspect(request)).pwuTypes as { state: Record<string, unknown> }[];
		expect(authored, 'the agent authored no PWU Type').toHaveLength(1);
		expect(
			authored[0]!.state.workDischarge,
			'the agent wrote a type, but its discharge did not survive the tool call — this is an AUTHORING ' +
				'failure, not a binding one'
		).toBe('MODEL');

		// ── 3. Publish, instantiate, execute ──────────────────────────────────────────────────────────────
		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();

		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Agent Discharge Demo');
		const pwaSelect = page.getByRole('combobox', { name: 'Instantiate from published PWA' });
		await expect(pwaSelect.locator('option'), 'the PWA never published').toHaveCount(2);
		await pwaSelect.selectOption({ index: 1 });
		await declareRisk(page);
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		const row = page.getByRole('link', { name: /Agent Discharge Demo/ });
		await expect(row).toBeVisible();
		await gotoHydrated(page, (await row.getAttribute('href'))!);

		await page.getByRole('button', { name: 'overview' }).click();
		await page
			.getByRole('row', { name: /Route Assessment/ })
			.first()
			.getByRole('button', { name: 'Begin & Execute' })
			.click();

		// ── 4. ⭑⭑ `STA-8` ON THE AGENT PATH ──────────────────────────────────────────────────────────────
		const snap = await introspect(request);
		const bindings = snap.runtimeBindings as { state: Record<string, unknown> }[];
		expect(
			bindings,
			'no RUNTIME_BINDING was created for a step whose type the AGENT declared MODEL — this is ' +
				'REG-F-365’s measured state reached by the agent road, and REG-F-371’s named gap'
		).toHaveLength(1);
		const bind = bindings[0]!.state;
		// AUTHORIZED, not merely REQUESTED — `STA-8` says authorized, and `RPH-EXE-003` refuses a start on a
		// binding still in REQUESTED.
		expect(bind.authorizationStatus, 'STA-8 requires an AUTHORIZED binding').toBe('AUTHORIZED');
	});

	// ── THE CONTROL ───────────────────────────────────────────────────────────────────────────────────────
	test('CONTROL — an agent-authored type that declares NO discharge gets NO binding', async ({
		page,
		request
	}) => {
		// ⛔ WITHOUT THIS, THE SPEC ABOVE PROVES ONLY THAT SOME EXECUTION MINTS A BINDING. `stepBindingFor`
		// requires `workDischarge === 'MODEL'`; a type that declares nothing must take the `OUT_OF_SCOPE` limb
		// and mint none. That is not a defect — it is the documented behaviour, and asserting it is what makes
		// the positive case mean "because the agent declared MODEL" rather than "because a step ran".
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Agent Silent PWA');
		await page.getByPlaceholder(/Domain/i).fill('logistics');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Agent Silent PWA/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);

		const plan = {
			plan: [
				{
					tool: 'define_pwu_type',
					args: { name: 'Silent Assessment', pwuKind: 'SILENT_ASSESSMENT', isRoot: true }
				}
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(page.getByTestId('agent-log')).toContainText('define_pwu_type');
		await page.getByRole('button', { name: 'Accept exact candidate' }).click();

		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();

		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Agent Silent Demo');
		const pwaSelect = page.getByRole('combobox', { name: 'Instantiate from published PWA' });
		await pwaSelect.selectOption({ index: 1 });
		await declareRisk(page);
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		const row = page.getByRole('link', { name: /Agent Silent Demo/ });
		await expect(row).toBeVisible();
		await gotoHydrated(page, (await row.getAttribute('href'))!);

		await page.getByRole('button', { name: 'overview' }).click();
		await page
			.getByRole('row', { name: /Silent Assessment/ })
			.first()
			.getByRole('button', { name: 'Begin & Execute' })
			.click();

		const snap = await introspect(request);
		expect(
			snap.runtimeBindings as unknown[],
			'a binding was minted for a type that declared no discharge — stepBindingFor requires MODEL, so ' +
				'this would mean the positive case above proves nothing about the declaration'
		).toHaveLength(0);
	});
});
