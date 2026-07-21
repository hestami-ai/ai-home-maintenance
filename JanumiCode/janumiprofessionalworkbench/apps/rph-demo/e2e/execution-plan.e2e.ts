import { expect, test } from '@playwright/test';
import { gotoHydrated, introspect, resetEngine } from './support/harness';

// JAN-EXECPLAN-DR-001 — the Execution Plan view on the Undertaking Workbench's "execution" tab.
// DWP-02: the flat, engine-GLOBAL, count-only table is replaced by an undertaking-SCOPED, per-PWU plan → steps panel
// (the F-6 bug fix). This spec drives the seeded reference undertaking (the shapeAndExecute path, F-8) and asserts the
// panel renders each plan's steps + stepState against engine ground truth, scoped to this undertaking's PWUs.

/** Open the seeded reference undertaking and return its id. */
async function openSeededUndertaking(page: import('@playwright/test').Page): Promise<string> {
	await gotoHydrated(page, '/undertakings');
	const row = page.locator('a.row[href^="/undertakings/und_"]').first();
	await expect(row).toBeVisible();
	const href = (await row.getAttribute('href'))!;
	await gotoHydrated(page, href);
	return href.replace('/undertakings/', '');
}

test.describe('Execution Plan view — DWP-02 scoped plan → steps panel', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('renders each PWU plan’s steps + stepState, scoped to the undertaking (F-6 fix)', async ({
		page,
		request
	}) => {
		const undertakingId = await openSeededUndertaking(page);
		await page.getByRole('button', { name: 'execution' }).click();

		// The panel renders plan cards (not a count-only table) with steps + a coloured stepState chip.
		const planCards = page.getByTestId('exec-plan');
		await expect(planCards.first()).toBeVisible();
		const steps = page.getByTestId('exec-step');
		await expect(steps.first()).toBeVisible();

		// Every stepState chip carries exactly one defined tone class — no stepState renders without a colour
		// (DWP-02 colour totality; the tone comes from rph-projections' stepStateTone, unit-tested exhaustively).
		const chip = page.getByTestId('step-state').first();
		await expect(chip).toBeVisible();
		const cls = (await chip.getAttribute('class')) ?? '';
		expect(cls).toMatch(/\b(positive|active|negative|pending|muted)\b/);

		// Ground-truth SCOPE: the rendered plan ids are EXACTLY the engine's execution plans whose workUnitId is one
		// of THIS undertaking's PWUs — never the global list (F-6). (The cross-undertaking no-leak edge is covered
		// exhaustively by the plansForPwus unit test; here we assert the wiring shows exactly the scoped set.)
		const snap = await introspect(request);
		const myPwuIds = new Set(
			snap.pwus.filter((p) => String(p.state.undertakingId ?? '') === undertakingId).map((p) => p.id)
		);
		const inScopePlanIds = new Set(
			snap.executionPlans
				.filter((pl) => myPwuIds.has(String(pl.state.workUnitId ?? '')))
				.map((pl) => pl.id)
		);
		expect(inScopePlanIds.size, 'the seeded undertaking should have ≥1 execution plan').toBeGreaterThan(0);

		// The rendered plan id fragments (first 14 chars, matching the panel's `.slice(0, 14)`) correspond 1:1 to the
		// in-scope plan set — no plan outside this undertaking's PWUs appears, and none in-scope is missing.
		const renderedFragments = await planCards.evaluateAll((els) =>
			els.map((el) => el.querySelector('.mono')?.textContent?.replace('…', '').trim() ?? '')
		);
		expect(renderedFragments).toHaveLength(inScopePlanIds.size);
		for (const frag of renderedFragments) {
			expect([...inScopePlanIds].some((id) => id.startsWith(frag))).toBeTruthy();
		}
	});
});

// DWP-03: handler-backed step actions from the EXPLICIT allowlist (Start/Complete/Fail/Retry step + Cancel plan).
// The reference seed drives every plan to SUCCEEDED, so we STAGE an ACTIVE plan with actionable steps through the
// test-mode dispatch endpoint (the same command bus the UI uses). Steps: step1/step2 QUEUED (drive-able), step3
// NOT_READY (below the domain's floor — F-11). Plus a resolvable artifact whose de minimis floor is unsatisfied,
// to demonstrate the §8.4 floor gate REJECTING an AI-produced completion (not just admitting a vacuous happy path).
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69GSTGA';
const PLAN_ID = 'plan_01ARZ3NDEKTSV4RRFFQ69GSTGB';
const STEP1 = 'step_01ARZ3NDEKTSV4RRFFQ69GSTGC';
const STEP2 = 'step_01ARZ3NDEKTSV4RRFFQ69GSTGD';
const STEP3 = 'step_01ARZ3NDEKTSV4RRFFQ69GSTGE';
const ARTIFACT_ID = 'art_01ARZ3NDEKTSV4RRFFQ69GSTGF';

const mkStep = (id: string, stepState: string) => ({
	id,
	executionPlanId: PLAN_ID,
	stepType: 'TRANSFORMATION',
	purpose: 'Produce the PWU output',
	inputBindings: [],
	outputBindings: [],
	preconditions: [],
	postconditions: [],
	stepState
});

/** Stage an ACTIVE plan (+ an unassured artifact) on a fresh local-extension PWU in the seeded undertaking. */
async function stageActivePlan(
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
						title: 'Staged execution PWU',
						description: 'Staged for the DWP-03 step-action e2e',
						intentId,
						undertakingId,
						isLocalExtension: true,
						boundaries: {
							inScope: ['staged execution'],
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
						steps: [mkStep(STEP1, 'QUEUED'), mkStep(STEP2, 'QUEUED'), mkStep(STEP3, 'NOT_READY')],
						transitions: [],
						retryPolicy: {},
						tacticalChangePolicy: {},
						escalationPolicy: {},
						terminationPolicy: {}
					}
				],
				['ApproveExecutionPlan', 'EXECUTION_PLAN', PLAN_ID, {}],
				['ActivateExecutionPlan', 'EXECUTION_PLAN', PLAN_ID, { authorizedRuntimeBindingIds: [] }],
				[
					'RecordArtifact',
					'ARTIFACT',
					ARTIFACT_ID,
					{
						artifactId: ARTIFACT_ID,
						artifactType: 'DOCUMENT',
						mediaType: 'text/plain',
						storageProvider: 'inline',
						storageKey: `k_${ARTIFACT_ID}`,
						contentHash: `sha256:${'0'.repeat(64)}`,
						securityClassification: 'INTERNAL',
						retentionClass: 'STANDARD',
						status: 'RECORDED'
					}
				]
			]
		}
	});
	const body = (await res.json()) as { ok: boolean; results: unknown };
	expect(body.ok, `staging should succeed: ${JSON.stringify(body.results)}`).toBeTruthy();
	return undertakingId;
}

async function stepStateOf(
	request: import('@playwright/test').APIRequestContext,
	stepId: string
): Promise<string | undefined> {
	const snap = await introspect(request);
	const plan = snap.executionPlans.find((p) => p.id === PLAN_ID);
	const steps = (Array.isArray(plan?.state.steps) ? plan!.state.steps : []) as Array<
		Record<string, unknown>
	>;
	return steps.find((s) => String(s.id) === stepId)?.stepState as string | undefined;
}

test.describe('Execution Plan view — DWP-03 handler-backed step actions', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('Start then Complete a step advances it to SUCCEEDED via the real commands', async ({
		page,
		request
	}) => {
		const undertakingId = await stageActivePlan(request);
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();

		// step1 (QUEUED) offers ONLY Start (allowlist). Start it → RUNNING → Complete (no output → human; admitted).
		await page.getByTestId('step-action-start').first().click();
		await expect.poll(() => stepStateOf(request, STEP1)).toBe('RUNNING');
		await page.getByTestId('step-action-complete').first().click();
		await expect.poll(() => stepStateOf(request, STEP1)).toBe('SUCCEEDED');
	});

	test('the allowlist shows no action for commandless/terminal steps, and no step-cancel button (F-11)', async ({
		page,
		request
	}) => {
		const undertakingId = await stageActivePlan(request);
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();

		// step3 is NOT_READY → below the domain's driveable floor: NO action button, the honest note instead (F-11).
		await expect(page.getByTestId('step-belowqueued')).toBeVisible();
		// There is no step-level cancel/skip/supersede anywhere — only the four command-backed step actions exist.
		await expect(page.getByTestId('step-action-skip')).toHaveCount(0);
		await expect(page.getByTestId('step-action-cancel')).toHaveCount(0);
		// The seeded plans' SUCCEEDED steps (terminal) render no advance action.
		const startBtns = await page.getByTestId('step-action-start').count();
		expect(startBtns).toBe(2); // exactly the two staged QUEUED steps — never the seed's SUCCEEDED steps
	});

	test('the Complete form action surfaces the FLOOR-GATE rejection verbatim; the step does not advance', async ({
		page,
		request
	}) => {
		const undertakingId = await stageActivePlan(request);
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();

		// Start step2 (the LAST of the two Start buttons) → RUNNING, then complete it naming an AI-produced,
		// floor-UNSATISFIED artifact → the §8.4 floor gate REJECTS (RPH_INVARIANT_VIOLATION), surfaced verbatim.
		await page.getByTestId('step-action-start').last().click();
		await expect.poll(() => stepStateOf(request, STEP2)).toBe('RUNNING');
		await page.getByTestId('complete-output').fill(ARTIFACT_ID);
		await page.getByTestId('complete-ai').check();
		await page.getByTestId('step-action-complete').click();

		const err = page.getByTestId('exec-error');
		await expect(err).toBeVisible();
		await expect(err).toContainText('RPH_INVARIANT_VIOLATION');
		// Gate is AUTHORITATIVE: the form action did NOT fabricate success — the step is still RUNNING.
		expect(await stepStateOf(request, STEP2)).toBe('RUNNING');
	});

	test('the Complete form action surfaces the unresolved-artifact rejection verbatim', async ({
		page,
		request
	}) => {
		const undertakingId = await stageActivePlan(request);
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'execution' }).click();

		await page.getByTestId('step-action-start').last().click();
		await expect.poll(() => stepStateOf(request, STEP2)).toBe('RUNNING');
		// Naming a result that is not a recorded object fails closed (execution.ts:410-417) — the bypass the gate
		// exists to stop ("name a nonexistent artifact to yield zero subjects and sail through").
		await page.getByTestId('complete-output').fill('art_01ARZ3NDEKTSV4RRFFQ69GNONE0');
		await page.getByTestId('step-action-complete').click();

		const err = page.getByTestId('exec-error');
		await expect(err).toBeVisible();
		await expect(err).toContainText('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(await stepStateOf(request, STEP2)).toBe('RUNNING');
	});

	test('an illegal action (Complete a non-RUNNING step) is rejected with its reason', async ({
		request
	}) => {
		await stageActivePlan(request);
		// The UI never OFFERS Complete on a QUEUED step (allowlist), so force it through the same command bus and
		// assert the engine rejects it — the guard the allowlist mirrors is real, not merely a UI convenience.
		const res = await request.post('/test-api/dispatch', {
			data: {
				steps: [
					[
						'CompleteExecutionStep',
						'EXECUTION_PLAN',
						PLAN_ID,
						{
							executionStepId: STEP1, // still QUEUED — the machine has only RUNNING→SUCCEEDED
							executionAttemptId: 'attempt_01ARZ3NDEKTSV4RRFFQ69GSTG9',
							resultStatus: 'SUCCEEDED',
							outputArtifactIds: [],
							proposedEvidenceIds: [],
							detectedAssumptionIds: [],
							structuredResult: {},
							executionProvenance: {
								executedBy: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' }
							}
						}
					]
				]
			}
		});
		const body = (await res.json()) as { ok: boolean; results: Array<{ status: string }> };
		expect(body.ok).toBeFalsy();
		expect(body.results[0]!.status).not.toBe('ACCEPTED');
		expect(await stepStateOf(request, STEP1)).toBe('QUEUED'); // unchanged
	});
});

// DWP-04 (Tier 2, fork C): the Undertaking execution SEQUENCE + the single-axis layerHandoff advisory. The reference
// seed's PWA is composition-only (no requiredInputs/Outputs → no hand-off edges), so to demonstrate the advisory we
// author a minimal HAND-OFF PWA (Root permits Producer + Consumer; Producer outputs 'a', Consumer inputs 'a'),
// instantiate ONLY the Consumer, and drive it to executionState=QUEUED. Its producer TYPE then has zero succeeded
// instances → the advisory fires (consumer began before any producer produced the artifact). Advisory-only: it must
// NOT block the Consumer's own step actions.
const H_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69GH000';
const H_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69GHR00';
const H_PROD = 'pwut_01ARZ3NDEKTSV4RRFFQ69GHP00';
const H_CONS = 'pwut_01ARZ3NDEKTSV4RRFFQ69GHC00';
const H_INT = 'int_01ARZ3NDEKTSV4RRFFQ69GHJ00'; // ULID: no I/L/O/U (Crockford base32)
const H_UND = 'und_01ARZ3NDEKTSV4RRFFQ69GHV00';
const H_CINST = 'pwu_01ARZ3NDEKTSV4RRFFQ69GHCJ0';
const H_PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GHPM0';
const H_STEP = 'step_01ARZ3NDEKTSV4RRFFQ69GHST0';
const H_DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69GHDE0';

const defType = (id: string, name: string, kind: string, extra: Record<string, unknown>) => [
	'DefinePwuType',
	'PWU_TYPE',
	id,
	{
		pwuTypeId: id,
		pwaId: H_PWA,
		pwuKind: kind,
		name,
		purpose: name,
		isRoot: false,
		permittedChildTypeIds: [],
		permittedChildren: [],
		requiredInputs: [],
		requiredOutputs: [],
		requiredAssurancePolicyIds: [],
		executionBoundary: 'INTERNAL',
		...extra
	}
];

/** Author a Producer→Consumer hand-off PWA + an Undertaking, instantiate ONLY the Consumer, drive it to QUEUED. */
async function stageHandoffUndertaking(
	request: import('@playwright/test').APIRequestContext
): Promise<void> {
	const chg = (prev: string, next: string, exec: string) => [
		'ChangePwuState',
		'PROFESSIONAL_WORK_UNIT',
		H_CINST,
		{
			previousState: prev,
			newState: next,
			executionState: exec,
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: [H_PLAN]
		}
	];
	const res = await request.post('/test-api/dispatch', {
		data: {
			steps: [
				// ── author the hand-off PWA ──
				['CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', H_PWA, { pwaId: H_PWA, name: 'Handoff PWA', description: 'DWP-04 hand-off fixture', domain: 'test', version: '0.1.0' }],
				defType(H_ROOT, 'Root', 'ROOT', {
					isRoot: true,
					permittedChildTypeIds: [H_PROD, H_CONS],
					permittedChildren: [
						{ typeId: H_PROD, cardinality: 'M1' },
						{ typeId: H_CONS, cardinality: 'M1' }
					]
				}),
				defType(H_PROD, 'Producer', 'PRODUCER', { requiredOutputs: ['a'] }),
				defType(H_CONS, 'Consumer', 'CONSUMER', { requiredInputs: ['a'] }),
				['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', H_PWA, {}],
				['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', H_PWA, {}],
				['PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', H_PWA, { rootPwuTypeId: H_ROOT }],
				// ── intent + undertaking bound to the published PWA ──
				['CaptureIntent', 'INTENT', H_INT, { intentId: H_INT, originatingExpression: 'Deliver the hand-off product', ontologyId: H_PWA, ontologyVersion: '0.1.0' }],
				['BeginIntentDiscovery', 'INTENT', H_INT, {}],
				['ProvisionIntent', 'INTENT', H_INT, { ambiguityIds: [] }],
				['FormalizeIntent', 'INTENT', H_INT, { formalizedObjective: 'Deliver the hand-off product', desiredOutcomes: [{ description: 'product' }], successConditions: [{ statement: 'delivered' }], nonGoals: [], ambiguityIds: [], constraintIds: [], stakeholderIds: [] }],
				['ApproveIntent', 'INTENT', H_INT, { decisionId: H_DEC, approvedSemanticVersion: 1, approvalScope: 'full' }],
				['CreateUndertaking', 'UNDERTAKING', H_UND, { undertakingId: H_UND, name: 'Handoff Undertaking', description: 'DWP-04', pwaId: H_PWA, pwaVersion: '0.1.0', instantiationProfile: 'Standard', objective: 'Deliver', intendedOutputProduct: 'product' }],
				// ── instantiate ONLY the Consumer (producer type has zero instances) and drive it to QUEUED ──
				['ProposePwu', 'PROFESSIONAL_WORK_UNIT', H_CINST, {
					pwuId: H_CINST,
					pwuKind: 'CONSUMER',
					title: 'Consumer instance',
					description: 'Consumer instance',
					intentId: H_INT,
					undertakingId: H_UND,
					isLocalExtension: false,
					pwuTypeId: H_CONS,
					boundaries: { inScope: ['consume a'], outOfScope: ['not yet known'], permittedChanges: [], prohibitedChanges: [] },
					obligationIds: [],
					constraintIds: [],
					assumptionIds: [],
					expectedOutputs: [{ outputId: `out_${H_CINST}`, kind: 'DOCUMENT' }],
					assurancePolicyIds: [],
					riskProfile: { consequence: 'MEDIUM', uncertainty: 'MEDIUM', irreversibility: 'MEDIUM', securitySensitivity: 'MEDIUM', regulatoryExposure: 'LOW' }
				}],
				['BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', H_CINST, {}],
				['MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', H_CINST, { shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 }],
				['ProposeExecutionPlan', 'EXECUTION_PLAN', H_PLAN, { executionPlanId: H_PLAN, workUnitId: H_CINST, steps: [mkStepFor(H_PLAN, H_STEP, 'QUEUED')], transitions: [], retryPolicy: {}, tacticalChangePolicy: {}, escalationPolicy: {}, terminationPolicy: {} }],
				['ApproveExecutionPlan', 'EXECUTION_PLAN', H_PLAN, {}],
				['ActivateExecutionPlan', 'EXECUTION_PLAN', H_PLAN, { authorizedRuntimeBindingIds: [] }],
				chg('READY', 'PLANNED', 'PLANNED'),
				chg('PLANNED', 'EXECUTING', 'QUEUED')
			]
		}
	});
	const body = (await res.json()) as { ok: boolean; results: unknown };
	expect(body.ok, `hand-off staging should succeed: ${JSON.stringify(body.results)}`).toBeTruthy();
}

function mkStepFor(planId: string, stepId: string, stepState: string) {
	return {
		id: stepId,
		executionPlanId: planId,
		stepType: 'TRANSFORMATION',
		purpose: 'Consume a',
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState
	};
}

test.describe('Execution Plan view — DWP-04 Tier-2 sequence + layerHandoff advisory', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('the sequence renders as DEPENDENCY (not a schedule) and shows no advisory for the composition-only seed', async ({
		page
	}) => {
		await gotoHydrated(page, '/undertakings');
		const row = page.locator('a.row[href^="/undertakings/und_"]').first();
		await gotoHydrated(page, (await row.getAttribute('href'))!);
		await page.getByRole('button', { name: 'execution' }).click();

		// The Tier-2 section frames itself as DEPENDENCY, never an execution schedule (§9.1).
		await expect(page.getByTestId('seq-caveat')).toContainText('NOT an execution schedule');
		// The seed PWA is composition-only (no hand-off edges) → instances are shown but not dependency-placed, and
		// there is NO advisory. This is honest: the sequence exists only where hand-off is declared.
		await expect(page.getByTestId('seq-noadvisory')).toBeVisible();
		await expect(page.getByTestId('seq-unplaced').first()).toBeVisible();
	});

	test('the advisory FIRES for an out-of-order hand-off fixture and gates NOTHING', async ({
		page,
		request
	}) => {
		await stageHandoffUndertaking(request);
		await gotoHydrated(page, `/undertakings/${H_UND}`);
		await page.getByRole('button', { name: 'execution' }).click();

		// The consumer instance is placed at its type's dependency layer (Producer=dep 1, Consumer=dep 2).
		await expect(page.getByTestId('seq-instance').filter({ hasText: 'Consumer instance' })).toBeVisible();
		// The advisory fires: consumer began (executionState=QUEUED) but no Producer instance has produced 'a'.
		const advisory = page.getByTestId('seq-advisory').first();
		await expect(advisory).toBeVisible();
		await expect(advisory).toContainText('Consumer instance');
		await expect(advisory).toContainText('Producer');

		// GATES NOTHING (fork C): the consumer's own QUEUED step still offers its Start action while the advisory
		// is showing — the advisory blocks no affordance.
		await expect(page.getByTestId('step-action-start').first()).toBeVisible();
		await page.getByTestId('step-action-start').first().click();
		await expect.poll(async () => {
			const snap = await introspect(request);
			const plan = snap.executionPlans.find((p) => p.id === H_PLAN);
			const steps = (Array.isArray(plan?.state.steps) ? plan!.state.steps : []) as Array<
				Record<string, unknown>
			>;
			return steps.find((s) => String(s.id) === H_STEP)?.stepState;
		}).toBe('RUNNING'); // the action worked despite the advisory
	});
});
