import { expect, test } from '@playwright/test';
import { gotoHydrated, introspect, resetEngine } from './support/harness';

// JAN-EXECPLAN-DR-002 DWP-05 — the execution tab gains plan-terminal states/actions + per-step attempt history.
// A plan can now be driven to COMPLETED through the UI (retiring the Tier-1 "no completion" F-9 note); the retry cap
// (RPH-EXE-008) surfaces its exhaustion control actions verbatim; a COMPLETED plan is an execution-axis fact, never
// rendered as assurance/green (INV-5). We stage an ACTIVE plan through the test-mode dispatch endpoint, then drive
// the UI.
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69GT300';
const PLAN_ID = 'plan_01ARZ3NDEKTSV4RRFFQ69GT310';
const STEP_ID = 'step_01ARZ3NDEKTSV4RRFFQ69GT320';

async function stageActivePlan(
	request: import('@playwright/test').APIRequestContext,
	retryPolicy: Record<string, unknown> = {}
): Promise<string> {
	const snap = await introspect(request);
	const undertakingId = snap.undertakings[0]!.id;
	const intentId = String(snap.pwus[0]?.state.intentId ?? '');
	const res = await request.post('/test-api/dispatch', {
		data: {
			steps: [
				[
					'ProposePwu',
					'PROFESSIONAL_WORK_UNIT',
					PWU_ID,
					{
						pwuId: PWU_ID,
						pwuKind: 'PWU',
						title: 'Tier-3 plan PWU',
						description: 'staged for DWP-05',
						intentId,
						undertakingId,
						isLocalExtension: true,
						boundaries: {
							inScope: ['x'],
							outOfScope: ['not yet known'],
							permittedChanges: [],
							prohibitedChanges: []
						},
						obligationIds: [],
						constraintIds: [],
						assumptionIds: [],
						expectedOutputs: [{ outputId: `out_${PWU_ID}`, kind: 'DOCUMENT' }],
						assurancePolicyIds: [],
						riskProfile: {
							consequence: 'MEDIUM',
							uncertainty: 'MEDIUM',
							irreversibility: 'MEDIUM',
							securitySensitivity: 'MEDIUM',
							regulatoryExposure: 'LOW'
						}
					}
				],
				['BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', PWU_ID, {}],
				[
					'MarkPwuReady',
					'PROFESSIONAL_WORK_UNIT',
					PWU_ID,
					{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 }
				],
				[
					'ProposeExecutionPlan',
					'EXECUTION_PLAN',
					PLAN_ID,
					{
						executionPlanId: PLAN_ID,
						workUnitId: PWU_ID,
						steps: [
							{
								id: STEP_ID,
								executionPlanId: PLAN_ID,
								stepType: 'TRANSFORMATION',
								purpose: 'Produce the output',
								inputBindings: [],
								outputBindings: [],
								preconditions: [],
								postconditions: [],
								stepState: 'QUEUED'
							}
						],
						transitions: [],
						retryPolicy,
						tacticalChangePolicy: {},
						escalationPolicy: {},
						terminationPolicy: {}
					}
				],
				['ApproveExecutionPlan', 'EXECUTION_PLAN', PLAN_ID, {}],
				['ActivateExecutionPlan', 'EXECUTION_PLAN', PLAN_ID, { authorizedRuntimeBindingIds: [] }]
			]
		}
	});
	const body = (await res.json()) as { ok: boolean; results: unknown };
	expect(body.ok, `staging should succeed: ${JSON.stringify(body.results)}`).toBeTruthy();
	return undertakingId;
}

const planStatus = async (request: import('@playwright/test').APIRequestContext) => {
	const snap = await introspect(request);
	return (snap.executionPlans.find((p) => p.id === PLAN_ID)?.state as { status?: string } | undefined)
		?.status;
};

test.describe('Execution tab — plan-terminal states + attempt history (DWP-05)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('drives a plan to COMPLETED through the UI, shows attempt history, and never renders COMPLETED as green', async ({
		page,
		request
	}) => {
		const undertakingId = await stageActivePlan(request);
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();
		// Scope to MY staged PWU group — the reference seed leaves its own plans ACTIVE, so unscoped .first() is ambiguous.
		const grp = page.getByTestId('exec-pwu-group').filter({ hasText: 'Tier-3 plan PWU' });

		// The Tier-1 "no plan-completion" F-9 note is gone; the new note frames COMPLETED as an execution-axis fact.
		await expect(page.getByTestId('exec-nocomplete')).toHaveCount(0);
		await expect(page.getByTestId('exec-plan-actions-note')).toContainText('execution-axis');

		// Drive the step to SUCCEEDED (Start → Complete, no output → human, floor admits).
		await grp.getByTestId('step-action-start').click();
		await expect.poll(() => planStatus(request)).toBe('ACTIVE'); // still active while the step runs
		await grp.getByTestId('step-action-complete').click();
		// Attempt history renders for the step (one attempt, SUCCEEDED).
		await expect(grp.getByTestId('step-attempt').first()).toBeVisible();

		// Complete the PLAN → COMPLETED.
		await grp.getByTestId('plan-complete').click();
		await expect.poll(() => planStatus(request)).toBe('COMPLETED');
		await expect(grp.getByTestId('plan-status')).toHaveText('COMPLETED');
		// INV-5: COMPLETED is NOT green — the status tag carries no positive/assured colour class.
		const cls = (await grp.getByTestId('plan-status').getAttribute('class')) ?? '';
		expect(cls).not.toMatch(/\bpositive\b/);
		// Once terminal, my plan's terminal action buttons are gone (allowlist posture).
		await expect(grp.getByTestId('plan-complete')).toHaveCount(0);
	});

	test('surfaces the RPH-EXE-008 retry-cap exhaustion control actions verbatim (@default cap 3)', async ({
		page,
		request
	}) => {
		const undertakingId = await stageActivePlan(request); // no RetryPolicy → default cap 3
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();
		const grp = page.getByTestId('exec-pwu-group').filter({ hasText: 'Tier-3 plan PWU' });

		// Drive start→fail→retry cycles: 2 retries proceed, the 3rd is refused.
		const cycle = async () => {
			await grp.getByTestId('step-action-start').click();
			await grp.getByTestId('step-action-fail').click();
			await grp.getByTestId('step-action-retry').click();
		};
		await cycle(); // retry 1 (attemptsMade=1) → proceeds
		await cycle(); // retry 2 (attemptsMade=2) → proceeds
		// 3rd cycle: start+fail, then the retry is refused with the exhaustion actions.
		await grp.getByTestId('step-action-start').click();
		await grp.getByTestId('step-action-fail').click();
		await grp.getByTestId('step-action-retry').click();

		const err = page.getByTestId('exec-error');
		await expect(err).toBeVisible();
		await expect(err).toContainText('RPH-EXE-008');
		await expect(err).toContainText('CHANGE_TACTIC'); // a permitted control action, verbatim
	});

	test('an illegal plan-terminal action (Complete with a non-terminal step) is rejected verbatim', async ({
		page,
		request
	}) => {
		const undertakingId = await stageActivePlan(request); // the step is QUEUED (non-terminal)
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();
		const grp = page.getByTestId('exec-pwu-group').filter({ hasText: 'Tier-3 plan PWU' });

		await grp.getByTestId('plan-complete').click();
		const err = page.getByTestId('exec-error');
		await expect(err).toBeVisible();
		await expect(err).toContainText('not in terminal success'); // the allow-list rejection, verbatim
		expect(await planStatus(request)).toBe('ACTIVE'); // engine authoritative — not completed
	});
});
