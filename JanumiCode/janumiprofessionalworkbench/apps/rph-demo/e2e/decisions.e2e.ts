import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// Decision Center authoring — a governance Decision must be proposeable (PROPOSED) and then approveable
// (PROPOSED -> EFFECTIVE), each step driving the real engine. Approval is gated by the decision's HUMAN
// authority (RPH-GOV-001/002): a PROPOSED recommendation is not approval until authority makes it EFFECTIVE.
//
// ⚠ THE SEED IS 'reference', NOT 'empty', AND THE CHANGE IS SUBSTANTIVE (REG-F-106, ruled REG-D-041). This file
// used to reset to an EMPTY workspace and propose a decision about nothing, because `subjectObjectIds: []` was
// what the route sent. `subjectObjectIds` is a REQUIRED field of DecisionObject in both ratified contracts, and
// OBJ-1 forbids reading meaning into an empty array — so the surface now requires a subject, and a workspace with
// no governed objects has nothing to decide about. An empty workspace is exactly the case where this form should
// not be offered, and the last test asserts that it is not.
test.describe('Decision Center — propose and approve a governance Decision', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	/** Open the form, select the first subject of `objectType`, and propose. Returns the id it named. */
	async function proposeAbout(
		page: import('@playwright/test').Page,
		option: string,
		rationale: string,
		objectType = 'PROFESSIONAL_WORK_UNIT'
	): Promise<string> {
		await page.getByRole('button', { name: '+ Propose Decision' }).click();
		await page.getByLabel(/Decision type/i).selectOption('APPROVAL');
		const picker = page.getByTestId('subject-picker');
		// ANCHORED at the start of the option text, which is `TYPE · label[ · vN]`. A bare substring match picked
		// `pol_intent_completeness` — an ASSURANCE_POLICY whose LABEL contains "intent" — when asked for an INTENT.
		const option0 = picker
			.locator('option')
			.filter({ hasText: new RegExp(`^${objectType} · `) })
			.first();
		const subjectId = (await option0.getAttribute('value'))!;
		await picker.selectOption(subjectId);
		await page.getByPlaceholder(/Chosen option/i).fill(option);
		await page.getByPlaceholder(/Why this decision/i).fill(rationale);
		await page.getByRole('button', { name: 'Propose', exact: true }).click();
		return subjectId;
	}

	test('propose an APPROVAL decision NAMING A SUBJECT, then approve it to EFFECTIVE', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/decisions');
		const before = (await introspect(request)).decisions.length;

		const subjectId = await proposeAbout(page, 'Approve delivery v0.1.0', 'Meets acceptance criteria');

		// SEMANTIC: the new decision appears as PROPOSED with an Approve action.
		await expect(page.getByRole('button', { name: 'Approve' }).first()).toBeVisible();

		// TRUTH: the engine recorded it, AND it names the subject — the assertion this file could not make before.
		const proposedSnap = await introspect(request);
		expect(proposedSnap.decisions).toHaveLength(before + 1);
		const proposed = proposedSnap.decisions.find(
			(d) => d.state.selectedOption === 'Approve delivery v0.1.0'
		);
		expect(proposed).toBeDefined();
		expect(proposed?.state.status).toBe('PROPOSED');
		expect(proposed?.state.subjectObjectIds, 'the decision must name what it is about').toEqual([
			subjectId
		]);

		// 2. Approve it. The route reads the subject's CURRENT version from the store and states it, so the
		//    engine's pin-agreement check has something real to compare (ASR-15).
		await page
			.getByRole('row')
			.filter({ hasText: 'Approve delivery v0.1.0' })
			.getByRole('button', { name: 'Approve' })
			.click();

		await expect(page.getByText('EFFECTIVE').first()).toBeVisible();

		// TRUTH: the engine really transitioned it, and the approval recorded the version it bound.
		const approvedSnap = await introspect(request);
		const approved = approvedSnap.decisions.find(
			(d) => d.state.selectedOption === 'Approve delivery v0.1.0'
		);
		expect(approved?.state.status).toBe('EFFECTIVE');
		expect(
			(approved?.state.subjectSemanticVersions as Record<string, number>)[subjectId],
			'the approval must state the version it approved, not {}'
		).toBeGreaterThan(0);

		// VISUAL: capture the effective decision for review.
		await page.screenshot({ path: 'e2e-results/decisions.png', fullPage: true });
	});

	// ⚠ THE REFUSAL THAT DID NOT EXIST. The form posted `subjectObjectIds: []` unconditionally, so there was no
	// state in which it could decline. The browser cannot omit the field either — the picker is `required` — so
	// this drives the ACTION directly, which is the only way to reach the server-side guard. Both halves matter:
	// a client-side `required` that the server does not enforce is a validation that a curl request walks past.
	test('the propose action REFUSES a decision that names no subject, with a reason', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/decisions');
		const before = (await introspect(request)).decisions.length;

		const res = await request.post('/decisions?/propose', {
			form: {
				decisionType: 'APPROVAL',
				selectedOption: 'Approve something unnamed',
				rationale: 'no subject supplied'
			}
		});
		expect(await res.text()).toContain('ASR-15');

		// TRUTH: nothing was recorded. A refusal that still minted the object would be no refusal.
		expect((await introspect(request)).decisions).toHaveLength(before);
	});

	// ⚠ THE OTHER THING `{}` MADE UNTESTABLE (REG-F-106). `approve` sent `subjectSemanticVersions: {}`, so the
	// engine's pin-agreement check compared nothing against nothing and could never refuse. Now that the route
	// states real versions, a subject that MOVED between proposal and approval makes the approval stale — which
	// is ASR-15 in force: "a decision approving version n never authorizes version n+1".
	test('an approval is REFUSED once its subject has moved on — the pin no longer agrees (ASR-15)', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/decisions');
		// ⚠ THE SUBJECT IS AN INTENT, NOT A PWU, AND THAT IS A FINDING RATHER THAN A CONVENIENCE. Measured while
		// writing this test: a PWU's `semanticVersion` is 1 FOREVER — only INTENT, DECOMPOSITION_CONTRACT and PWA
		// bump it (`advanceStatus`'s bumpSemanticVersion is used by reviseIntent and the decomposition path alone).
		// So for a PWU subject the ASR-15 pin can never DISagree, and a test written against one would have proved
		// the check works by choosing the one subject type that cannot exercise it.
		const subjectId = await proposeAbout(page, 'Approve the shape as it stands', 'looks right', 'INTENT');
		const before = (await introspect(request)).decisions.find(
			(d) => d.state.selectedOption === 'Approve the shape as it stands'
		);
		expect(before?.state.status).toBe('PROPOSED');

		// Move the subject on, through the SAME command bus the UI uses. ReviseIntent bumps semanticVersion.
		const bump = await request.post('/test-api/dispatch', {
			data: {
				steps: [
					[
						'ReviseIntent',
						'INTENT',
						subjectId,
						{ changeRationale: 'the subject moved after the decision was proposed' }
					]
				]
			}
		});
		const bumpBody = (await bump.json()) as { ok: boolean; results: unknown };
		expect(bumpBody.ok, `bumping the subject version: ${JSON.stringify(bumpBody.results)}`).toBeTruthy();

		// Now approve. The route reads the subject's CURRENT version, which no longer matches the pin.
		await page.reload();
		await page
			.getByRole('row')
			.filter({ hasText: 'Approve the shape as it stands' })
			.getByRole('button', { name: 'Approve' })
			.click();

		await expect(page.getByRole('alert')).toBeVisible();

		// TRUTH: it did NOT become EFFECTIVE. This is the assertion the `{}` payload made impossible.
		const after = (await introspect(request)).decisions.find(
			(d) => d.state.selectedOption === 'Approve the shape as it stands'
		);
		expect(after?.state.status, 'a stale approval must not take effect').toBe('PROPOSED');
	});

	// ⚠ NO TEST FOR THE EMPTY-CATALOG BRANCH, AND THE ABSENCE IS DISCLOSED RATHER THAN QUIET. The page guards
	// against rendering an empty picker beside a live Propose button, but NEITHER demo seed can reach that branch:
	// the 'empty' seed still creates PWU_TYPEs and ASSURANCE_POLICYs, which are governed objects and therefore
	// selectable subjects. I wrote a test for it, watched it fail for that reason, and removed it rather than
	// weaken it into one that passes for a different reason than its name claims. The guard stays as a fail-safe
	// with no reader — recorded in REG-F-108, not hidden behind a green tick.
});
