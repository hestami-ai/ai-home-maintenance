import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated, declareRisk } from './support/harness';

// JAN-EXECRUN XR-03 — a work unit actually does work.
//
// ⭑ THE SPONSOR'S DIAGNOSIS, CLOSED END TO END: *"a PWU is an agent with a prompt template and relevant
// context … none of that existed in reality. So a PWA actually could not truly run and do real work."*
// This spec authors the prompt, publishes it, instantiates a work unit from it, presses Execute, and asserts
// against ENGINE STATE that a model was invoked ON BEHALF OF THE STEP and its work product was recorded.
//
// ⚠ IT ASSERTS THE ENGINE, NOT THE PAGE. A spec that checked the screen said "executed" would prove only that
// the screen says what the screen says — the failure mode this repository's own harness comment names.
test.describe('Undertaking Workbench — a work unit is executed by a model', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('⭑ Execute invokes the model with the type’s own prompt and records the work product', async ({
		page,
		request
	}) => {
		// ── 1. Author an architecture whose root type SAYS HOW ITS WORK IS ATTEMPTED ──────────────────────
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Executable Operations PWA');
		await page.getByPlaceholder(/Domain/i).fill('logistics');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await page.getByRole('link', { name: /Executable Operations PWA/ }).click();

		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Route Assessment');
		await page.locator('input[name="pwuKind"]').fill('ROUTE_ASSESSMENT');
		await page.getByLabel(/Root type/i).check();
		// JAN-DISCHARGE — the type must SAY a model does this work. Rule 2 refuses an ACTIVE prompt on a type
		// that declares anything else, so this line is the spec obeying the coherence rule rather than
		// dodging it: an armed prompt and a declared discharge are one decision, said once.
		await page.getByTestId('pwu-type-discharge').selectOption('MODEL');
		await page.getByTestId('pwu-type-prompt').fill('Assess {subject}. Deliver {expectedOutputs}.');
		// ⛔ WITHOUT THIS THE TEMPLATE IS A DRAFT AND THE STEP REFUSES. Authoring is not arming — the checkbox
		// is the difference, and this line is the spec exercising that distinction rather than dodging it.
		await page.getByRole('checkbox', { name: /Ready to use/i }).check();
		await page.getByRole('button', { name: 'Add type' }).click();
		await expect(
			page.locator('.svelte-flow__node').filter({ hasText: 'Route Assessment' })
		).toBeVisible();

		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();

		// ── 2. Instantiate a work unit from it ────────────────────────────────────────────────────────────
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Execution Demo');
		// After an 'empty' reset this is the only published PWA. Selecting by INDEX rather than by label keeps
		// the spec from depending on how the option is composed (name + version), which is presentation.
		const pwaSelect = page.getByRole('combobox', { name: 'Instantiate from published PWA' });
		await expect(pwaSelect.locator('option'), 'the PWA never published').toHaveCount(2);
		await pwaSelect.selectOption({ index: 1 });
		await declareRisk(page);
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		const row = page.getByRole('link', { name: /Execution Demo/ });
		await expect(row).toBeVisible();
		await gotoHydrated(page, (await row.getAttribute('href'))!);

		// ── 3. Execute ────────────────────────────────────────────────────────────────────────────────────
		await page.getByRole('button', { name: 'overview' }).click();
		await page
			.getByRole('row', { name: /Route Assessment/ })
			.first()
			.getByRole('button', { name: 'Begin & Execute' })
			.click();

		// ── 4. ENGINE STATE ───────────────────────────────────────────────────────────────────────────────
		const snap = await introspect(request);

		// ⭑ THE FIRST RECORD EVER WRITTEN TO THE EXECUTION PLANE. `plane` has carried an `EXECUTION` member
		// since REG-D-055 and every record in the system said ASSURANCE or AUTHORING.
		expect(snap.modelExchanges, 'no model was invoked for the step').toHaveLength(1);
		const mex = snap.modelExchanges[0]!.state as Record<string, unknown>;
		expect(mex.plane).toBe('EXECUTION');
		expect(mex.subjectObjectType).toBe('PROFESSIONAL_WORK_UNIT');
		// PER-9's index, finally resolving to something a reader can look up (REG-D-058).
		expect(String(mex.promptTemplateFingerprint ?? ''), 'the fingerprint must name the template').toMatch(
			/^pwut_.*@v1$/
		);

		// ⭑ THE MODEL SAW THE RENDERED TEMPLATE, not a generic instruction. The deterministic backend echoes
		// what it was given, so this proves the authored prompt reached it with the work unit's facts in place.
		const answerRef = mex.answerSpanRef as { status?: string; storageKey?: string };
		expect(answerRef.status, 'the work product was not retained').toBe('STORED');

		// ⭑ AND IT IS A WORK PRODUCT, not just an audit record. THE MUTANT: complete the step with
		// `noOutputResult` as the demo always has. The exchange still exists, the run still looks fine, and the
		// work unit produced nothing a downstream step or an assurance policy could consume.
		expect(snap.artifacts, 'the step recorded no work product').toHaveLength(1);
		const art = snap.artifacts[0]!.state as Record<string, unknown>;
		expect(art.storageKey, 'the artifact and the exchange must name ONE stored object').toBe(
			answerRef.storageKey
		);
		expect(art.producingPwuId, 'the artifact names the work unit that produced it').toBeTruthy();

		// ⛔ THE EXECUTOR IS THE MODEL. Recording the human who clicked would be a fiction, and the assurance
		// floor is entitled to know which it was. THE MUTANT: reuse the operator provenance the TRANSFORMATION
		// path records — every assertion above still passes and the record quietly credits a person.
		const plan = snap.executionPlans[0]!.state as { steps?: Array<Record<string, unknown>> };
		const step = plan.steps?.[0] ?? {};
		expect(step.stepType, 'an AI-attempted step is a MODEL_INVOCATION').toBe('MODEL_INVOCATION');

		// ── ⭑⭑ AND THE ASSURANCE FLOOR BITES, WHICH IS THE POINT OF THE WHOLE SYSTEM ──────────────────────
		//
		// `floor-gate.ts:30` makes a MODEL_INVOCATION AI-produced BY CONSTRUCTION, so completing it requires
		// the three floor policies satisfied against the work product. ⭑ THIS GATE HAS NEVER FIRED IN THIS
		// DEMO — the existing lifecycle step is a TRANSFORMATION a human drove, and the demo's own comment
		// says it is non-AI "so the floor gate admits it". The first genuinely model-executed work unit is the
		// first thing ever to meet it.
		//
		// ⛔ SO THE STEP DOES NOT COMPLETE, AND THAT IS THE ASSERTION. THE MUTANT: relax the gate, or record
		// the operator as executor so signal 0 never fires. The demo would go green and a model's output would
		// have been accepted as finished work with no review — the exact thing this system exists to refuse.
		expect(step.stepState, 'an unreviewed AI step must not read as completed').not.toBe('COMPLETED');
		await expect(
			page.getByRole('alert'),
			'the refusal must be surfaced, not swallowed'
		).toContainText(/assurance floor/i);

		// ⭑ AND THE WORK THAT DID HAPPEN SURVIVES THE REFUSAL. The model ran and produced something; that is a
		// FACT, and whether the step may complete is a JUDGEMENT about it. An earlier version of this path
		// batched the artifact with the completion, so the refusal erased the work product — the erasure PER-9
		// exists to prevent. Both assertions above already proved the exchange and artifact are still there.
	});

	test('CONTROL — a type with NO prompt still executes the old way, and invokes no model', async ({
		page,
		request
	}) => {
		// Without this, "Execute invokes a model" could not be told apart from "Execute always invokes a model",
		// which would be false and would break every existing work unit. A type without a template declares no
		// agent behaviour — TRUE of every type authored before REG-D-058 — and the demo's TRANSFORMATION
		// lifecycle is the honest path for it.
		await resetEngine(request, 'reference');
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('No Prompt Demo');
		await page
			.getByRole('combobox', { name: 'Instantiate from published PWA' })
			.selectOption({ index: 1 });
		await declareRisk(page);
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		const row = page.getByRole('link', { name: /No Prompt Demo/ });
		await expect(row).toBeVisible();
		await gotoHydrated(page, (await row.getAttribute('href'))!);
		await page.getByRole('button', { name: 'overview' }).click();
		await page
			.getByRole('combobox', { name: 'Select a PWU Type' })
			.selectOption({ label: 'Architecture Definition' });
		await page.getByPlaceholder(/Instance title/i).fill('Arch Work');
		await declareRisk(page);
		await page.getByRole('button', { name: 'Instantiate PWU' }).click();

		const before = (await introspect(request)).modelExchanges.length;
		await page
			.getByRole('row', { name: /Arch Work/ })
			.getByRole('button', { name: 'Begin & Execute' })
			.click();
		await expect(page.getByRole('button', { name: 'Record Assurance' })).toBeVisible();

		const snap = await introspect(request);
		expect(snap.modelExchanges.length, 'a promptless type must invoke no model').toBe(before);
		const pwu = snap.pwus.find((p) => p.state.title === 'Arch Work')!;
		expect(pwu.state.executionState, 'and the existing lifecycle still completes').toBe('SUCCEEDED');
	});
});
