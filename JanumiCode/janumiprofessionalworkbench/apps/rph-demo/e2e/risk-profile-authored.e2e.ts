import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// JPWB-SPEC-001-DR-002 W-4 — the risk profile is a professional's judgement, not a constant.
//
// THE DEFECT (roadmap finding F-D). Every PWU the surface created was written with the same five literals:
//
//     riskProfile: { consequence: 'MEDIUM', uncertainty: 'MEDIUM', irreversibility: 'MEDIUM',
//                    securitySensitivity: 'MEDIUM', regulatoryExposure: 'LOW' }
//
// AND THAT IS NOT COSMETIC, which is what made it worth its own work package. `riskProfile` SELECTS THE ASSURANCE
// PROFILE: `packages/rph-assurance/src/applicability.ts:72` resolves `$.riskProfile`, and HIGH_ASSURANCE — the
// profile the catalog reserves for "security-sensitive features; enterprise governance; regulated environments
// ... difficult-to-reverse operations" — gates on
//
//     RISK_AT_LEAST(CONSEQUENCE,HIGH) OR RISK_AT_LEAST(SECURITY_SENSITIVITY,HIGH)
//     OR RISK_AT_LEAST(IRREVERSIBILITY,HIGH) OR RISK_AT_LEAST(REGULATORY_EXPOSURE,HIGH)
//
// Five MEDIUMs and a LOW fail every disjunct. So the surface did not merely record an unchosen value — it placed
// EVERY PWU a professional creates below the high-assurance floor, silently, whatever the work actually was. The
// seeded reference root carries consequence/uncertainty/securitySensitivity = HIGH and duly selects
// HIGH_ASSURANCE; nothing a user creates ever could.
//
// This is O-8-R4's defect with the polarity reversed. The specification forbids RENDERING a field no read path
// populates from a real source; this WROTE one, into canonical state, indistinguishable downstream from a
// judgement.
//
// THE RED, OBSERVED BEFORE THE FORM EXISTED: this spec asserted only that a surface-created PWU's profile is not
// that constant, and failed reporting the constant verbatim. That order matters — the fill steps below could not
// have been written first, and a spec that begins by filling a field that does not exist fails on its locator and
// proves nothing about behaviour.

const FABRICATED = {
	consequence: 'MEDIUM',
	uncertainty: 'MEDIUM',
	irreversibility: 'MEDIUM',
	securitySensitivity: 'MEDIUM',
	regulatoryExposure: 'LOW'
};

test.describe('Undertaking Workbench — the risk profile is authored (DR-002 W-4)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('the declared risk judgement reaches every PWU the Undertaking instantiates', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Risk Probe');
		await page.getByRole('combobox', { name: /published PWA/i }).selectOption({ index: 1 });
		// The judgement. Declared HIGH where the fabricated constant said MEDIUM, so a surface that ignores the
		// declaration and a surface that honours it cannot report the same thing.
		await page.getByRole('combobox', { name: /consequence/i }).selectOption('HIGH');
		await page.getByRole('combobox', { name: /uncertainty/i }).selectOption('HIGH');
		await page.getByRole('combobox', { name: /irreversibility/i }).selectOption('LOW');
		// HIGH, not CRITICAL: `securitySensitivity` is NONE|LOW|MEDIUM|HIGH. The five dimensions do NOT share a
		// scale, and the first draft of this spec assumed they did — an illegal level is refused with "Schema
		// validation failed", which reads like a wiring fault and is not one.
		await page.getByRole('combobox', { name: /security sensitivity/i }).selectOption('HIGH');
		await page.getByRole('combobox', { name: /regulatory exposure/i }).selectOption('HIGH');
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		await expect(page.getByRole('link', { name: /Risk Probe/ })).toBeVisible();

		const snap = await introspect(request);
		const undertaking = snap.undertakings.find((u) => u.state.name === 'Risk Probe')!;
		expect(undertaking, 'the Undertaking must exist').toBeTruthy();
		const pwus = snap.pwus.filter((p) => p.state.undertakingId === undertaking.id);
		expect(pwus.length, 'W-3 instantiates the architecture; W-4 is about what it writes').toBe(8);

		for (const pwu of pwus) {
			expect(
				pwu.state.riskProfile,
				`${String(pwu.state.title)} must carry the DECLARED judgement, not a constant`
			).toEqual({
				consequence: 'HIGH',
				uncertainty: 'HIGH',
				irreversibility: 'LOW',
				securitySensitivity: 'HIGH',
				regulatoryExposure: 'HIGH'
			});
			// Stated separately and deliberately. The equality above would still pass if someone changed the
			// hardcoded constant to match this fixture; this says the specific fabricated value is gone.
			expect(pwu.state.riskProfile, 'the fabricated constant must not survive anywhere').not.toEqual(
				FABRICATED
			);
		}
	});

	test('CONTROL — the SERVER refuses an Undertaking with no judgement, not just the browser', async ({
		request
	}) => {
		// Fail closed, and PROVED AT THE SERVER. The first draft of this control drove the form with the risk
		// selects left empty and asserted nothing was created — which passed, but proved only that the browser
		// honours `required`. The submit never reached the action, so the server-side refusal was never executed
		// and a mutation that replaced it with a default would have left this test green.
		//
		// So it POSTs the form action directly, exactly as a client with scripting disabled — or anything that is
		// not a browser — would. `required` is a courtesy to the professional; the refusal is the guarantee.
		const start = await introspect(request);
		const before = start.undertakings.length;
		const beforeIntents = start.events.filter((e) => e.eventType === 'IntentCaptured').length;
		const pwaId = start.pwas.find((p) => p.state.publicationStatus === 'PUBLISHED')!.id;

		const res = await request.post('/undertakings?/create', {
			form: { name: 'No Judgement', objective: 'none', product: 'none', pwaId }
		});
		expect(res.status(), 'the action must respond, not error').toBeLessThan(500);

		const after = await introspect(request);
		expect(
			after.undertakings.length,
			'an Undertaking with no risk judgement must not be created'
		).toBe(before);
		expect(after.undertakings.find((u) => u.state.name === 'No Judgement')).toBeUndefined();
		// And nothing half-built either: the Intent lifecycle runs five commands before the Undertaking exists,
		// so a refusal discovered too late would strand an approved Intent behind a nonexistent Undertaking.
		expect(
			after.events.filter((e) => e.eventType === 'IntentCaptured').length,
			'the judgement is read BEFORE the Intent lifecycle commits anything'
		).toBe(beforeIntents);
	});
});
