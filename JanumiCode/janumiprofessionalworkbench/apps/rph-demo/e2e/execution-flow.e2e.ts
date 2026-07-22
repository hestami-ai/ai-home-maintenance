import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { gotoHydrated, introspect, resetEngine } from './support/harness';

// JAN-EXECPLAN-DR-004 DWP-06 (Tier 3C-ii) — the flow interpreter driven END TO END THROUGH THE UI.
//
// Every plan the app has shipped so far is LINEAR (`transitions: []`), so the graph interpreter — branch selection,
// prune, the parallel set-frontier, the barrier join, wait/resume — has never been exercised by a browser. These three
// specs stage GRAPH plans through the test-mode command bus and then drive them with real clicks, asserting engine
// ground truth after each one. They are the §18 exit criteria in executable form: "a branch plan selects+prunes+
// completes; a parallel plan runs concurrent+joins+completes; a wait plan pauses+resumes".
//
// Discipline: the UI must never offer an affordance the engine would reject (F-11). So each flow also asserts the
// NEGATIVE — the not-taken arm has no Start, the join has none while an arm is unfinished — and at least one flow
// forces the rejected command through the bus directly to prove the engine, not the template, is the authority.

const U = (suffix: string) => `01ARZ3NDEKTSV4RRFFQ69G${suffix}`;

interface Flow {
	readonly title: string;
	readonly pwuId: string;
	readonly planId: string;
	readonly stepIds: readonly string[];
}

const flow = (tag: string, title: string, stepCount: number): Flow => ({
	title,
	pwuId: `pwu_${U(`${tag}00`)}`,
	planId: `plan_${U(`${tag}10`)}`,
	stepIds: Array.from({ length: stepCount }, (_, i) => `step_${U(`${tag}2${i}`)}`)
});

// Tags feed Crockford base32 ULIDs, whose alphabet EXCLUDES I, L, O and U — so no tag may contain them ("PL" would
// be rejected at schema validation with an opaque "Schema validation failed").
const BRANCH = flow('BR', 'Flow branch PWU', 3);
const PARALLEL = flow('PR', 'Flow parallel PWU', 4);
const WAIT = flow('WT', 'Flow wait PWU', 2);

/** A plan step. TRANSFORMATION (not MODEL_INVOCATION) so a no-output completion clears the §8.4 floor gate — these
 *  specs are about SEQUENCING, not assurance. */
const mkStep = (f: Flow, i: number, stepType = 'TRANSFORMATION') => ({
	id: f.stepIds[i]!,
	executionPlanId: f.planId,
	stepType,
	purpose: `${f.title} step ${i + 1}`,
	inputBindings: [],
	outputBindings: [],
	preconditions: [],
	postconditions: [],
	stepState: 'QUEUED'
});

/** An unconditional (SEQUENTIAL) edge. */
const seqEdge = (f: Flow, from: number, to: number) => ({
	id: `tr_${f.planId.slice(5, 20)}_${from}${to}`,
	executionPlanId: f.planId,
	sourceStepId: f.stepIds[from]!,
	targetStepId: f.stepIds[to]!,
	transitionType: 'SEQUENTIAL'
});

/** A guarded (CONDITIONAL) edge. NOTE: a BRANCH's LAST out-edge must be the unconditional default or propose-time
 *  graph validation rejects the plan — so conditional arms are always authored FIRST. */
const condEdge = (f: Flow, from: number, to: number, conditionExpression: unknown) => ({
	...seqEdge(f, from, to),
	transitionType: 'CONDITIONAL',
	conditionExpression
});

/** Stage a graph plan: PWU → shaped → ready → plan proposed/approved/activated. Mirrors execution-tier3's helper,
 *  generalized over the step/transition fixture. Returns the seeded undertaking's id. */
async function stagePlan(
	request: APIRequestContext,
	f: Flow,
	steps: unknown[],
	transitions: unknown[]
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
					f.pwuId,
					{
						pwuId: f.pwuId,
						pwuKind: 'PWU',
						title: f.title,
						description: 'staged for DWP-06 flow specs',
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
						expectedOutputs: [{ outputId: `out_${f.pwuId}`, kind: 'DOCUMENT' }],
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
				['BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', f.pwuId, {}],
				[
					'MarkPwuReady',
					'PROFESSIONAL_WORK_UNIT',
					f.pwuId,
					{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 }
				],
				[
					'ProposeExecutionPlan',
					'EXECUTION_PLAN',
					f.planId,
					{
						executionPlanId: f.planId,
						workUnitId: f.pwuId,
						steps,
						transitions,
						retryPolicy: {},
						tacticalChangePolicy: {},
						escalationPolicy: {},
						terminationPolicy: {}
					}
				],
				['ApproveExecutionPlan', 'EXECUTION_PLAN', f.planId, {}],
				['ActivateExecutionPlan', 'EXECUTION_PLAN', f.planId, { authorizedRuntimeBindingIds: [] }]
			]
		}
	});
	const body = (await res.json()) as { ok: boolean; results: unknown };
	expect(body.ok, `staging should succeed: ${JSON.stringify(body.results)}`).toBeTruthy();
	return undertakingId;
}

const stepStateOf = async (request: APIRequestContext, f: Flow, i: number): Promise<string | undefined> => {
	const snap = await introspect(request);
	const plan = snap.executionPlans.find((p) => p.id === f.planId)?.state as
		| { steps?: Array<{ id: string; stepState: string }> }
		| undefined;
	return plan?.steps?.find((s) => s.id === f.stepIds[i])?.stepState;
};

const planStatusOf = async (request: APIRequestContext, f: Flow): Promise<string | undefined> =>
	((await introspect(request)).executionPlans.find((p) => p.id === f.planId)?.state as
		| { status?: string }
		| undefined)?.status;

/** Open the execution tab and scope every locator to THIS flow's PWU group — the reference seed renders its own
 *  plans in the same tab, so an unscoped locator would pick up seed steps. */
async function openFlow(page: Page, undertakingId: string, f: Flow) {
	await gotoHydrated(page, `/undertakings/${undertakingId}`);
	await page.getByRole('button', { name: 'execution' }).click();
	const group = page.getByTestId('exec-pwu-group').filter({ hasText: f.title });
	await expect(group).toBeVisible();
	return group;
}

/** Complete the currently-RUNNING step: a HUMAN, no-output completion the floor gate admits. The Complete form is
 *  compound (an output-id input + an AI checkbox), so it is submitted by clicking its own button within the row. */
const completeStep = (group: ReturnType<Page['getByTestId']>, i: number) =>
	group.getByTestId('exec-step').nth(i).getByTestId('step-action-complete').click();

const startStep = (group: ReturnType<Page['getByTestId']>, i: number) =>
	group.getByTestId('exec-step').nth(i).getByTestId('step-action-start').click();

test.describe('Execution flow — BRANCH selects an arm, prunes the other, and completes (DWP-06)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('the guard selects one arm; the not-taken arm offers no Start, is Pruned to SKIPPED, and the plan completes', async ({
		page,
		request
	}) => {
		// s1 BRANCH → [s2 guarded on "s1 succeeded" (taken), s3 unconditional default (not taken)].
		const undertakingId = await stagePlan(
			request,
			BRANCH,
			[mkStep(BRANCH, 0, 'BRANCH'), mkStep(BRANCH, 1), mkStep(BRANCH, 2)],
			[
				condEdge(BRANCH, 0, 1, { op: 'STEP_SUCCEEDED', stepId: BRANCH.stepIds[0] }),
				seqEdge(BRANCH, 0, 2)
			]
		);
		let group = await openFlow(page, undertakingId, BRANCH);

		// The transitions panel renders the authored graph with its edge roles and the guard in words.
		await expect(group.getByTestId('plan-transitions')).toBeVisible();
		await expect(group.getByTestId('plan-transition')).toHaveCount(2);
		await expect(group.getByTestId('transition-role').first()).toHaveText('CONDITIONAL');
		await expect(group.getByTestId('transition-condition').first()).toContainText('succeeded');

		// Only the BRANCH node is startable; both arms are behind it.
		await expect(group.getByTestId('step-action-start')).toHaveCount(1);
		await startStep(group, 0);
		await expect.poll(() => stepStateOf(request, BRANCH, 0)).toBe('RUNNING');
		await completeStep(group, 0);
		await expect.poll(() => stepStateOf(request, BRANCH, 0)).toBe('SUCCEEDED');

		// Selection: exactly ONE arm becomes startable — the guarded one — and the default arm offers no Start.
		group = await openFlow(page, undertakingId, BRANCH);
		await expect(group.getByTestId('step-action-start')).toHaveCount(1);
		await expect(group.getByTestId('exec-step').nth(1).getByTestId('step-action-start')).toHaveCount(1);
		await expect(group.getByTestId('exec-step').nth(2).getByTestId('step-action-start')).toHaveCount(0);

		// The edge plane explains WHY: the taken arm is SATISFIED, the not-taken one NEUTRALIZED.
		const dispositions = await group.getByTestId('transition-disposition').allTextContents();
		expect(dispositions).toEqual(['SATISFIED', 'NEUTRALIZED']);

		// The engine — not the template — is the authority: forcing a start on the not-taken arm is REJECTED.
		const forced = await request.post('/test-api/dispatch', {
			data: {
				steps: [
					['StartExecutionStep', 'EXECUTION_PLAN', BRANCH.planId, { stepId: BRANCH.stepIds[2] }]
				]
			}
		});
		const forcedBody = (await forced.json()) as { results: Array<{ status: string }> };
		expect(forcedBody.results[0]?.status).toBe('REJECTED');
		expect(await stepStateOf(request, BRANCH, 2)).toBe('QUEUED');

		// Prune is offered on exactly the unreachable arm, and drives it to SKIPPED (terminal-success).
		await expect(group.getByTestId('step-action-prune')).toHaveCount(1);
		await group.getByTestId('exec-step').nth(2).getByTestId('step-action-prune').click();
		await expect.poll(() => stepStateOf(request, BRANCH, 2)).toBe('SKIPPED');

		// Drive the taken arm home; the plan then completes (all terminal-success, ≥1 SUCCEEDED).
		group = await openFlow(page, undertakingId, BRANCH);
		await startStep(group, 1);
		await expect.poll(() => stepStateOf(request, BRANCH, 1)).toBe('RUNNING');
		await completeStep(group, 1);
		await expect.poll(() => stepStateOf(request, BRANCH, 1)).toBe('SUCCEEDED');

		group = await openFlow(page, undertakingId, BRANCH);
		await group.getByTestId('plan-complete').click();
		await expect.poll(() => planStatusOf(request, BRANCH)).toBe('COMPLETED');
	});
});

test.describe('Execution flow — PARALLEL fans out, runs concurrently, and JOINs (DWP-06)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('two arms start concurrently, the join is withheld until the last arm lands, then the plan completes', async ({
		page,
		request
	}) => {
		// s1 PARALLEL_GROUP → s2 ∥ s3 → s4 (join).
		const undertakingId = await stagePlan(
			request,
			PARALLEL,
			[
				mkStep(PARALLEL, 0, 'PARALLEL_GROUP'),
				mkStep(PARALLEL, 1),
				mkStep(PARALLEL, 2),
				mkStep(PARALLEL, 3)
			],
			[
				seqEdge(PARALLEL, 0, 1),
				seqEdge(PARALLEL, 0, 2),
				seqEdge(PARALLEL, 1, 3),
				seqEdge(PARALLEL, 2, 3)
			]
		);
		let group = await openFlow(page, undertakingId, PARALLEL);
		await expect(group.getByTestId('plan-transition')).toHaveCount(4);

		await startStep(group, 0);
		await expect.poll(() => stepStateOf(request, PARALLEL, 0)).toBe('RUNNING');
		await completeStep(group, 0);
		await expect.poll(() => stepStateOf(request, PARALLEL, 0)).toBe('SUCCEEDED');

		// THE SET FRONTIER: both arms are offered at once — the whole point of DWP-05.
		group = await openFlow(page, undertakingId, PARALLEL);
		await expect(group.getByTestId('step-action-start')).toHaveCount(2);
		// The join is NOT among them (both its in-edges are PENDING).
		await expect(group.getByTestId('exec-step').nth(3).getByTestId('step-action-start')).toHaveCount(0);

		// Start both. Re-query between clicks: the DOM re-renders after each form action, and re-starting an
		// already-RUNNING step would be rejected (it would burn a retry against the RPH-EXE-008 cap).
		await startStep(group, 1);
		await expect.poll(() => stepStateOf(request, PARALLEL, 1)).toBe('RUNNING');
		group = await openFlow(page, undertakingId, PARALLEL);
		await startStep(group, 2);
		await expect.poll(() => stepStateOf(request, PARALLEL, 2)).toBe('RUNNING');

		// TWO steps of ONE plan are RUNNING simultaneously — no lost update.
		expect([
			await stepStateOf(request, PARALLEL, 1),
			await stepStateOf(request, PARALLEL, 2)
		]).toEqual(['RUNNING', 'RUNNING']);

		// The barrier holds while one arm is unfinished…
		group = await openFlow(page, undertakingId, PARALLEL);
		await completeStep(group, 1);
		await expect.poll(() => stepStateOf(request, PARALLEL, 1)).toBe('SUCCEEDED');
		group = await openFlow(page, undertakingId, PARALLEL);
		await expect(group.getByTestId('exec-step').nth(3).getByTestId('step-action-start')).toHaveCount(0);

		// …and releases when the last arm lands.
		await completeStep(group, 2);
		await expect.poll(() => stepStateOf(request, PARALLEL, 2)).toBe('SUCCEEDED');
		group = await openFlow(page, undertakingId, PARALLEL);
		await expect(group.getByTestId('exec-step').nth(3).getByTestId('step-action-start')).toHaveCount(1);

		await startStep(group, 3);
		await expect.poll(() => stepStateOf(request, PARALLEL, 3)).toBe('RUNNING');
		group = await openFlow(page, undertakingId, PARALLEL);
		await completeStep(group, 3);
		await expect.poll(() => stepStateOf(request, PARALLEL, 3)).toBe('SUCCEEDED');

		group = await openFlow(page, undertakingId, PARALLEL);
		await group.getByTestId('plan-complete').click();
		await expect.poll(() => planStatusOf(request, PARALLEL)).toBe('COMPLETED');
	});
});

test.describe('Execution flow — WAIT pauses a running step inside a graph plan, and Resume returns it (DWP-06)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('a graph plan suspends to WAITING and resumes to RUNNING, then completes', async ({
		page,
		request
	}) => {
		// A two-step GRAPH plan (not the linear degenerate) so the wait is exercised with the interpreter engaged.
		const undertakingId = await stagePlan(
			request,
			WAIT,
			[mkStep(WAIT, 0), mkStep(WAIT, 1)],
			[seqEdge(WAIT, 0, 1)]
		);
		let group = await openFlow(page, undertakingId, WAIT);
		await expect(group.getByTestId('plan-transition')).toHaveCount(1);
		await expect(group.getByTestId('transition-role').first()).toHaveText('SEQUENTIAL');
		// An unconditional edge carries no guard text — the panel must not fabricate one.
		await expect(group.getByTestId('transition-condition')).toHaveCount(0);

		await startStep(group, 0);
		await expect.poll(() => stepStateOf(request, WAIT, 0)).toBe('RUNNING');

		// RUNNING affords Wait but never Resume.
		group = await openFlow(page, undertakingId, WAIT);
		await expect(group.getByTestId('step-action-wait')).toHaveCount(1);
		await expect(group.getByTestId('step-action-resolve')).toHaveCount(0);
		await group.getByTestId('step-action-wait').click();
		await expect.poll(() => stepStateOf(request, WAIT, 0)).toBe('WAITING');

		// WAITING affords Resume but no longer Wait; the successor is still withheld (its in-edge is PENDING).
		group = await openFlow(page, undertakingId, WAIT);
		await expect(group.getByTestId('step-action-resolve')).toHaveCount(1);
		await expect(group.getByTestId('step-action-wait')).toHaveCount(0);
		await expect(group.getByTestId('exec-step').nth(1).getByTestId('step-action-start')).toHaveCount(0);
		await expect(group.getByTestId('transition-disposition').first()).toHaveText('PENDING');

		await group.getByTestId('step-action-resolve').click();
		await expect.poll(() => stepStateOf(request, WAIT, 0)).toBe('RUNNING');

		group = await openFlow(page, undertakingId, WAIT);
		await completeStep(group, 0);
		await expect.poll(() => stepStateOf(request, WAIT, 0)).toBe('SUCCEEDED');
		group = await openFlow(page, undertakingId, WAIT);
		await expect(group.getByTestId('transition-disposition').first()).toHaveText('SATISFIED');

		await startStep(group, 1);
		await expect.poll(() => stepStateOf(request, WAIT, 1)).toBe('RUNNING');
		group = await openFlow(page, undertakingId, WAIT);
		await completeStep(group, 1);
		await expect.poll(() => stepStateOf(request, WAIT, 1)).toBe('SUCCEEDED');

		group = await openFlow(page, undertakingId, WAIT);
		await group.getByTestId('plan-complete').click();
		await expect.poll(() => planStatusOf(request, WAIT)).toBe('COMPLETED');
	});
});
