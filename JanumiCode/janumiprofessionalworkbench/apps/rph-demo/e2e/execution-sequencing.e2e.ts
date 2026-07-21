import { expect, test } from '@playwright/test';
import { gotoHydrated, introspect, resetEngine } from './support/harness';

// JAN-EXECPLAN-DR-003 DWP-03 — the execution tab VISIBLY sequences a multi-step plan (Tier 3C-i start-gate). Start is
// offered ONLY on the startable step (the first non-terminal step whose predecessors are all terminal-success);
// completing OR skipping it advances the frontier automatically. An out-of-order start is neither offered by the UI
// nor accepted by the engine (the startExecutionStep gate is the authoritative backstop). We stage a 2-step ACTIVE
// plan through the test-mode dispatch endpoint (the reference seed's plans are single-step), then drive the UI.
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69GS300';
const PLAN_ID = 'plan_01ARZ3NDEKTSV4RRFFQ69GS310';
const STEP1 = 'step_01ARZ3NDEKTSV4RRFFQ69GS320';
const STEP2 = 'step_01ARZ3NDEKTSV4RRFFQ69GS330';

const mkStep = (id: string, purpose: string) => ({
	id,
	executionPlanId: PLAN_ID,
	stepType: 'TRANSFORMATION',
	purpose,
	inputBindings: [],
	outputBindings: [],
	preconditions: [],
	postconditions: [],
	stepState: 'QUEUED'
});

async function stage2StepPlan(
	request: import('@playwright/test').APIRequestContext
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
						title: 'Tier-3C seq PWU',
						description: 'staged for DWP-03 sequencing',
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
						steps: [mkStep(STEP1, 'first step'), mkStep(STEP2, 'second step')],
						transitions: [],
						retryPolicy: {},
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

const step2State = async (request: import('@playwright/test').APIRequestContext) => {
	const snap = await introspect(request);
	const plan = snap.executionPlans.find((p) => p.id === PLAN_ID);
	const steps = (plan?.state.steps as Array<{ id: string; stepState: string }>) ?? [];
	return steps.find((s) => s.id === STEP2)?.stepState;
};

test.describe('Execution tab — linear sequencing (DWP-03)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('offers Start on the startable step only, and advances it on completion', async ({
		page,
		request
	}) => {
		const undertakingId = await stage2StepPlan(request);
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();
		const grp = page.getByTestId('exec-pwu-group').filter({ hasText: 'Tier-3C seq PWU' });
		const steps = grp.getByTestId('exec-step');

		// Start is offered on exactly ONE step — the startable step 1 (step 2's predecessor is not done).
		await expect(grp.getByTestId('step-action-start')).toHaveCount(1);
		await expect(steps.nth(0).getByTestId('step-action-start')).toBeVisible();
		await expect(steps.nth(1).getByTestId('step-action-start')).toHaveCount(0);

		// Drive step 1 to SUCCEEDED (Start → Complete; no output → human completion the floor admits).
		await steps.nth(0).getByTestId('step-action-start').click();
		await steps.nth(0).getByTestId('step-action-complete').click();
		await expect(steps.nth(0).getByTestId('step-state')).toHaveText('SUCCEEDED');

		// The start-gate advances automatically: Start now sits on step 2 (still exactly one Start in the plan).
		await expect(grp.getByTestId('step-action-start')).toHaveCount(1);
		await expect(steps.nth(1).getByTestId('step-action-start')).toBeVisible();
	});

	test('skipping the startable step advances the sequence (SKIPPED is terminal-success — no deadlock)', async ({
		page,
		request
	}) => {
		const undertakingId = await stage2StepPlan(request);
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();
		const grp = page.getByTestId('exec-pwu-group').filter({ hasText: 'Tier-3C seq PWU' });
		const steps = grp.getByTestId('exec-step');

		// Skip step 1 (optional skip, mandatory:false) → SKIPPED.
		await steps.nth(0).getByTestId('step-action-skip').click();
		await expect(steps.nth(0).getByTestId('step-state')).toHaveText('SKIPPED');
		// Start moves to step 2 (the skip advanced the frontier).
		await expect(steps.nth(1).getByTestId('step-action-start')).toBeVisible();
		await expect(grp.getByTestId('step-action-start')).toHaveCount(1);
	});

	test('an out-of-order start is not offered, and is rejected verbatim if forced through the engine', async ({
		page,
		request
	}) => {
		const undertakingId = await stage2StepPlan(request);
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();
		const grp = page.getByTestId('exec-pwu-group').filter({ hasText: 'Tier-3C seq PWU' });
		const steps = grp.getByTestId('exec-step');

		// The UI does not tempt an out-of-order start — step 2 shows no Start while step 1 is QUEUED.
		await expect(steps.nth(1).getByTestId('step-action-start')).toHaveCount(0);

		// Force it through the engine anyway: the start-gate is the AUTHORITY and rejects it (RPH-EXE-005).
		const res = await request.post('/test-api/dispatch', {
			data: { steps: [['StartExecutionStep', 'EXECUTION_PLAN', PLAN_ID, { stepId: STEP2 }]] }
		});
		const body = (await res.json()) as {
			ok: boolean;
			results: Array<{ status: string; code?: string }>;
		};
		expect(body.ok, 'the out-of-order start must be rejected').toBeFalsy();
		expect(body.results[0]?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		// Engine ground truth: step 2 stays QUEUED — nothing ran out of order.
		expect(await step2State(request)).toBe('QUEUED');
	});
});
