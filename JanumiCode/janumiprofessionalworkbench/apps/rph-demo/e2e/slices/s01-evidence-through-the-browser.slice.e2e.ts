// S-01 — THE FIRST SURFACE SLICE: a human proposes evidence, has it admitted, and submits it for assessment,
// through the browser (JAN-SLICE-SWP-06).
//
// ── WHAT THIS SLICE IS FOR ───────────────────────────────────────────────────────────────────────────────────
// The roadmap's F-4: `ProposeEvidence`, `AdmitEvidence` and `SubmitEvidenceForAssessment` appeared in **0** files
// under `apps/rph-demo/src` and **0** under `apps/rph-demo/e2e`, with a positive control that returned 5 / 2 / 2
// when re-driven. So the workbench could sign work off and could not evidence it — while the ENGINE Slice
// `E2E-001` asserts on the other plane that an assessment must name *"BOTH what it assessed AND the evidence it
// considered"*. Two planes disagreeing, and only one of them checked.
//
// ⚠ AND THE MECHANISM WAS NARROWER THAN "NO PATHWAY", WHICH IS WHY THIS SLICE ASSERTS WHERE IT DOES. The helper
// the workbench already called — `driveAssessmentToAssessing` — ALREADY dispatches
// `SubmitEvidenceForAssessment`, for every member of an optional `evidence` argument that was never passed. And
// the demo policy declared no `requiredEvidence`, so `submitEvidenceForAssessment` would have refused any
// submission anyway: *"evidence can only be submitted against a declared requirement"*. The absent things were a
// defaulted argument and an undeclared requirement, not a missing route.
//
// ── SL-6: WHAT THIS PRESUPPOSES, AND WHY IT IS NOT A FORMALITY ───────────────────────────────────────────────
// `presupposes: 'E2E-001'`. That Slice's clause O-c drives the same journey on the ENGINE plane and asserts that
// `EvidenceAdmitted` exists and that an assessment names `evidenceConsideredIds.length > 0`. So if this SURFACE
// Slice reddens while `E2E-001` is green, the fault is in the browser path and nowhere else — which is the whole
// content of `SL-6`: *"a SURFACE Slice must not be admitted while that Slice is failing or absent — otherwise a
// browser failure cannot be told apart from a domain failure."*
//
// ── ⚠ HOW THIS ASSERTS, AND THE PROHIBITED SHORTCUT IT AVOIDS ────────────────────────────────────────────────
// The roadmap forbids asserting a SURFACE journey *"by inspecting server-rendered HTML alone"*, recording that an
// earlier probe of that kind **failed in BOTH directions — its positive control also returned zero, because the
// page hydrates client-side**. So every clause below drives the REAL UI (through `gotoHydrated`, which waits on
// `html[data-hydrated="true"]`) and then asserts against the ENGINE's own state via `/test-api/introspect`.
// The page is used to ACT; the store is what says the act landed.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { declareRisk, gotoHydrated, introspect, resetEngine, type ObjectRow } from '../support/harness';

export const SLICE = {
	id: 'S-01',
	title: 'A human evidences a sign-off through the browser, and admission can refuse them',
	plane: 'SURFACE',
	// SL-6 — the ENGINE Slice that drives this same journey on the other plane.
	presupposes: 'E2E-001',
	// ⚠ RATIFIED HERE WITH ITS REASON, NOT INHERITED. This is the `normal path`: an operator produces evidence,
	// it is admitted, it is submitted, and the sign-off records it. Clause (b) drives a REFUSAL, which might
	// suggest `user-error path` — but that class is about a journey whose SUBJECT is the error, and here the
	// refusal is one guarded step inside a journey that completes successfully. `CLS-USER-ERROR` already holds
	// the class whose whole journey is a user's mistake; duplicating it here would make two Slices claim one
	// class and neither would be the one to look at.
	scenarioClass: 'normal path',
	// ⚠ ONE RULE, AND NOT THE OBVIOUS ONE. `RPH-EVD-003` — "An Evidence Object with no producing actor or source
	// has its admission rejected (evidence requires provenance)" — is what clause (b) actually drives: the
	// engine's `evidenceAdmissibility` refuses on `CONTENT_AVAILABLE` when no source is referenced.
	// NOT `RPH-E2E-001`, which `E2E-001` cites: this Slice asserts one stage of that flow through a browser, not
	// the intent-to-architecture journey, and citing it would claim coverage this file does not earn — the F-3
	// defect the whole programme exists to close.
	// NOT `RPH-EVD-007`, whose antecedent is model-generated prose; this journey admits operator-supplied
	// evidence, and stretching the rule to fit would be the same overclaim wearing a better citation.
	citedRules: ['RPH-EVD-003'],
	dischargesRegisterEntries: [],
	// ⚠⚠ THREE MUTANTS FOR FIVE CLAUSES, AND THE SHORTFALL IS STRUCTURAL, NOT LAZINESS. This Slice is a LINEAR
	// JOURNEY: S-c admits the evidence S-a proposed, S-d submits what S-c admitted, S-e signs off what S-d
	// submitted. So every clause is a strict PREFIX of the ones after it, and any mutation that breaks S-c or
	// S-d necessarily breaks S-e too — `SL-3a` says a mutant reddening more than one cited clause proves NONE of
	// them individually, so such a mutant is worth less than no mutant plus an honest note.
	//
	// ⚠ AN EARLIER DRAFT DECLARED FOUR MUTANTS AND THREE OF THEM WERE WRONG — declared, never driven, and
	// wrong in three different ways: one reddened S-d AND S-e (prefix subsumption, exactly the trap above); one
	// was INERT because `blockingEvidenceIds` filters `requiredForDispositions === 'ALL'` BEFORE cardinality is
	// consulted, so changing the cardinality could not move anything; and one was foreclosed by
	// `ActorReferenceSchema`'s `.min(1)` at the command bus, minting no object at all and reddening every
	// clause with a message none of them predicted. **A predicted red that has not been observed is a
	// hypothesis, and three of four hypotheses here were false.** The three below are driven.
	//
	// S-c and S-d therefore carry NO mutant, and that is declared rather than left to be noticed: what makes
	// them load-bearing is that S-e cannot pass unless both did their work, plus S-b's mutant proving the
	// admission judgement is real in the opposite direction.
	mutants: [
		{
			id: 'S-01-M1',
			file: 'apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts',
			find: '				scope,',
			replace: "				scope: `${scope}-mutated`,",
			expectRed: ['S-a'],
			predictedMessage: 'and carries the scope the operator stated',
			why: "Proves clause (a) asserts the CONTENT the operator supplied reached the engine, not merely that an object appeared. The mutation keeps the scope NON-EMPTY, which is what makes it single-victim: admissibility's SCOPE_STATED limb still passes, so S-b still refuses on CONTENT_AVAILABLE, S-c still admits, and S-d/S-e still complete — only the value S-a compares changes. Emptying the scope instead would have reddened four clauses and proved nothing about any."
		},
		{
			id: 'S-01-M2',
			file: 'packages/rph-assurance/src/assurance-rules.ts',
			find: "	if (typeof value === 'object') return Object.keys(value as object).length > 0;",
			replace: "	if (typeof value === 'object') return true;",
			expectRed: ['S-b'],
			predictedMessage: 'failed CONTENT_AVAILABLE',
			why: "Proves clause (b) asserts the ENGINE's admissibility JUDGEMENT and not the button's behaviour. `referencesContent` is the limb that fails for evidence proposed with no source — the ONE limb that fails for S-b's arrangement, since scope is stated, limitations are recorded and `producedBy` names the real session actor — so making it accept `{}` admits the unsourced evidence and S-b's expected refusal disappears. Single-victim by construction: every other clause supplies a real content reference, so a MORE permissive predicate changes nothing for them."
		},
		{
			id: 'S-01-M3',
			file: 'apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts',
			find: '		const considered = pending ? evidenceSubmittedTo(pending) : [];',
			replace: '		const considered: string[] = [];',
			expectRed: ['S-e'],
			predictedMessage:
				'the sign-off must record the evidence it considered — evidenceConsideredIds is what an unevidenced assessment leaves empty',
			why: 'Proves clause (e) asserts the JOIN between the evidence stage and the sign-off, not that both merely happened. Before SWP-06 `evidenceConsideredIds` was unconditionally `[]`; under this mutant the operator still proposes, admits and submits — S-a through S-d all stay green — and the assessment still records that it considered nothing. That is exactly the state the work package exists to end, and without this mutant clause (e) would be satisfied by a surface whose two halves never met.'
		}
	]
} as const;

const EVIDENCE_SCOPE = 'The generated architecture covers the approved intent';
const EVIDENCE_URI = 'artifact://demo/architecture-review.md';

/**
 * ⚠ THIS SLICE ASSERTS A DELTA, NOT A TOTAL, AND THE CONTROL THAT FOUND THAT OUT IS RECORDED RATHER THAN QUIETLY
 * REPLACED.
 *
 * A first draft opened with `expect(evidence).toHaveLength(0)` — "the journey starts with no evidence". The
 * `reference` seed holds **16** evidence objects before the browser is touched, because the engine's own drive
 * mints them (`submitRequiredEvidenceForPolicy`). The assumption was wrong and the control caught it, which is
 * the only reason it is not still sitting here reading as a passing baseline.
 *
 * It also sharpens what this Slice may claim. The seed's evidence arrives through the ENGINE; what F-4 measured
 * is that none could arrive through the BROWSER. So the subject is the delta THIS journey causes, and a total
 * would have been satisfied by work nobody did here.
 */
async function evidenceIds(request: APIRequestContext): Promise<Set<string>> {
	return new Set((await introspect(request)).evidence.map((e) => e.id));
}

async function evidenceById(request: APIRequestContext, id: string): Promise<ObjectRow | undefined> {
	return (await introspect(request)).evidence.find((e) => e.id === id);
}

/**
 * Click a workbench tab BY ITS EXACT NAME.
 *
 * ⚠ NON-EXACT MATCHING BROKE THIS SLICE ONCE AND WOULD HAVE AGAIN. `getByRole('button', { name: 'Assurance' })`
 * is a case-insensitive SUBSTRING match, so once a PWU is EXECUTING it resolves to two elements — the
 * `assurance` tab and the `Record Assurance` sign-off button — and strict mode fails. It passed in the clauses
 * that never execute work, which is the worst version: a locator that is correct only while the page is missing
 * the thing the journey is about.
 */
async function tab(page: Page, name: string): Promise<void> {
	await page.getByRole('button', { name, exact: true }).click();
}

/**
 * Do a piece of professional work, so there is something to evidence — then land on the assurance tab.
 *
 * ⚠ THIS BUILDS ITS OWN WORK RATHER THAN BORROWING THE SEED'S, AND THE SEED IS WHY. The reference workbench's
 * eight auto-instantiated PWUs stay `QUEUED` through `Begin & Execute`, so the sign-off later refuses with
 * *"Illegal transition on PWU.executionState: QUEUED -> SUCCEEDED"* — a real refusal, correctly raised, that
 * has nothing to do with evidence. Instantiating a PWU the way `pwu-lifecycle.e2e.ts` does reaches SUCCEEDED,
 * which is the state a sign-off is actually offered from. Borrowing seeded state would have made this Slice's
 * last clause fail for a reason it does not assert.
 *
 * ⚠ AND THE PWU ID IS READ OFF THE SIGN-OFF AFFORDANCE ITSELF, not chosen. A first draft proposed evidence
 * for the first option in the propose form and signed off the first `Record Assurance` button — different
 * work units. The journey then did every act correctly and proved nothing: evidence reached PWU A's
 * assessment while PWU B was signed off by a fresh one that had never seen it, which is EXACTLY the failure
 * clause (e) exists to catch, arrived at by accident.
 */
async function startEvidenceableWork(page: Page): Promise<string> {
	await gotoHydrated(page, '/undertakings');
	await page.getByRole('button', { name: '+ New Undertaking' }).click();
	await page.getByPlaceholder(/Undertaking name/i).fill('Evidence Slice');
	await page
		.getByRole('combobox', { name: 'Instantiate from published PWA' })
		.selectOption({ index: 1 });
	await declareRisk(page);
	await page.getByRole('button', { name: 'Create Undertaking' }).click();
	const link = page.getByRole('link', { name: /Evidence Slice/ });
	await expect(link).toBeVisible();
	await gotoHydrated(page, (await link.getAttribute('href'))!);
	await tab(page, 'overview');
	await page
		.getByRole('combobox', { name: 'Select a PWU Type' })
		.selectOption({ label: 'Architecture Definition' });
	await page.getByPlaceholder(/Instance title/i).fill('Evidenced Work');
	await declareRisk(page);
	await page.getByRole('button', { name: 'Instantiate PWU' }).click();
	await page
		.getByRole('row', { name: /Evidenced Work/ })
		.getByRole('button', { name: 'Begin & Execute' })
		.click();
	const form = page.locator('form[action="?/recordAssurance"]').first();
	await form.waitFor();
	const pwuId = (await form.locator('input[name="pwuId"]').inputValue()).trim();
	await tab(page, 'assurance');
	return pwuId;
}

/** Propose one piece of evidence through the real form; returns the id the ENGINE minted for it. */
async function proposeThroughBrowser(
	page: Page,
	request: APIRequestContext,
	opts: { scope: string; uri: string; pwuId?: string }
): Promise<string> {
	const before = await evidenceIds(request);
	if (opts.pwuId) await page.locator('form[action="?/proposeEvidence"] select[name="pwuId"]').selectOption(opts.pwuId);
	await page.getByPlaceholder(/its scope/i).fill(opts.scope);
	await page.getByPlaceholder(/Where it lives/i).fill(opts.uri);
	await page.getByRole('button', { name: 'Propose evidence' }).click();
	let minted = '';
	await expect
		.poll(
			async () => {
				const after = await evidenceIds(request);
				minted = [...after].find((id) => !before.has(id)) ?? '';
				return minted;
			},
			{ message: 'the proposal must reach the engine as a governed EVIDENCE object' }
		)
		.not.toBe('');
	return minted;
}

async function receiptCount(request: APIRequestContext, evidenceId: string): Promise<number> {
	return (await introspect(request)).events.filter(
		(e) =>
			e.eventType === 'AssuranceEvidenceReceived' &&
			(e.payload as { evidenceId?: string } | undefined)?.evidenceId === evidenceId
	).length;
}

test.describe('S-01 — the evidence stage, through the browser', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('S-a — a human proposes evidence through the browser and the ENGINE holds it as PROPOSED', async ({
		page,
		request
	}) => {
		const pwuId = await startEvidenceableWork(page);
		const id = await proposeThroughBrowser(page, request, {
			scope: EVIDENCE_SCOPE,
			uri: EVIDENCE_URI,
			pwuId
		});
		const ev = await evidenceById(request, id);
		expect(ev?.state.status, 'a newly proposed evidence object is PROPOSED').toBe('PROPOSED');
		expect(ev?.state.scope, 'and carries the scope the operator stated').toBe(EVIDENCE_SCOPE);
	});

	test('S-b — admission is a JUDGEMENT and refuses evidence that references no source', async ({
		page,
		request
	}) => {
		const pwuId = await startEvidenceableWork(page);
		// Scope stated, source absent — so exactly one admissibility limb fails and the refusal is attributable.
		const id = await proposeThroughBrowser(page, request, { scope: EVIDENCE_SCOPE, uri: '', pwuId });
		await page.locator(`tr[data-evidence-id="${id}"]`).getByRole('button', { name: 'Admit' }).click();

		// ⚠⚠ THE MESSAGE IS THE ASSERTION, AND AN EARLIER DRAFT GOT THIS WRONG IN A WAY WORTH RECORDING. It
		// asserted only that the object stayed `PROPOSED` — which is the state it was ALREADY IN, asserted
		// identically by clause (a) — so the clause could not distinguish "the engine refused admission" from
		// "the click did nothing at all", and `expect.poll` discharges on its first sample against a
		// `use:enhance` fetch. A refusal test that passes when nothing happens is not a refusal test.
		//
		// So the ENGINE's own words are what is asserted: `evidenceAdmissibility` names the limb that failed, and
		// for this arrangement exactly ONE can — scope is stated, limitations are recorded, and `producedBy` is
		// the real session actor, leaving `CONTENT_AVAILABLE` alone to fail. That is what makes the refusal
		// ATTRIBUTABLE rather than merely present, and it is why `S-01-M2` sites its mutation on
		// `referencesContent` and nowhere else.
		await expect(
			page.getByTestId('evidence-error'),
			"the ENGINE's refusal must reach the operator, naming the limb that failed"
		).toContainText('failed CONTENT_AVAILABLE');

		// And the governed fact behind the message: the object did not move.
		expect(
			(await evidenceById(request, id))?.state.status,
			'evidence referencing no source must NOT become ADMISSIBLE'
		).toBe('PROPOSED');
	});

	test('S-c — well-formed evidence IS admitted, so the judgement can pass as well as refuse', async ({
		page,
		request
	}) => {
		const pwuId = await startEvidenceableWork(page);
		const id = await proposeThroughBrowser(page, request, {
			scope: EVIDENCE_SCOPE,
			uri: EVIDENCE_URI,
			pwuId
		});
		await page.locator(`tr[data-evidence-id="${id}"]`).getByRole('button', { name: 'Admit' }).click();
		await expect
			.poll(async () => (await evidenceById(request, id))?.state.status, {
				message: 'admissible evidence must reach ADMISSIBLE — a guard that only ever refuses is a constant'
			})
			.toBe('ADMISSIBLE');
	});

	test('S-d — the admitted evidence is SUBMITTED to the open assessment', async ({ page, request }) => {
		const pwuId = await startEvidenceableWork(page);
		const id = await proposeThroughBrowser(page, request, {
			scope: EVIDENCE_SCOPE,
			uri: EVIDENCE_URI,
			pwuId
		});
		const row = page.locator(`tr[data-evidence-id="${id}"]`);
		await row.getByRole('button', { name: 'Admit' }).click();
		await expect
			.poll(async () => (await evidenceById(request, id))?.state.status, {
				message: 'PRECONDITION for (d): admission must succeed before submission is offered'
			})
			.toBe('ADMISSIBLE');
		await row.getByRole('button', { name: 'Submit for assessment' }).click();

		// The receipt is an EVENT, not object state — `submitEvidenceForAssessment` commits no state delta — so
		// the governed fact lives in the log, and that is where it is read.
		await expect
			.poll(async () => receiptCount(request, id), {
				message:
					'the submission must reach the ENGINE as an AssuranceEvidenceReceived naming the declared requirement'
			})
			.toBe(1);
	});

	test('S-e — and the sign-off then RECORDS what it considered', async ({ page, request }) => {
		const pwuId = await startEvidenceableWork(page);
		const id = await proposeThroughBrowser(page, request, {
			scope: EVIDENCE_SCOPE,
			uri: EVIDENCE_URI,
			pwuId
		});
		const row = page.locator(`tr[data-evidence-id="${id}"]`);
		await row.getByRole('button', { name: 'Admit' }).click();
		await expect
			.poll(async () => (await evidenceById(request, id))?.state.status, {
				message: 'PRECONDITION for (e): the evidence must be admitted before it can be submitted'
			})
			.toBe('ADMISSIBLE');
		await row.getByRole('button', { name: 'Submit for assessment' }).click();
		await expect
			.poll(async () => receiptCount(request, id), {
				message: 'PRECONDITION for (e): the submission must be received before a sign-off can consider it'
			})
			.toBe(1);

		// Sign the work off through the surface's own existing affordance.
		await tab(page, 'overview');
		await page
			.locator(`form[action="?/recordAssurance"]:has(input[value="${pwuId}"])`)
			.getByRole('button', { name: 'Record Assurance' })
			.click();

		// ⚠ THIS IS THE CLAUSE THE WHOLE WORK PACKAGE IS FOR. Before SWP-06 `evidenceConsideredIds` was
		// unconditionally `[]`: the workbench reached SATISFIED with a §20 ValidatorResult recording that it had
		// considered nothing, while `E2E-001` asserts on the ENGINE plane that an assessment must name BOTH what
		// it assessed and the evidence it considered. The two planes disagreed and only one was checked.
		await expect
			.poll(
				async () =>
					(await introspect(request)).events.some((e) => {
						if (e.eventType !== 'AssuranceAssessmentCompleted') return false;
						// ⚠ TOP-LEVEL ON THE EVENT, NOT NESTED UNDER `validatorResult`. A first draft read
						// `payload.validatorResult.evidenceConsideredIds` — the shape the COMMAND carries — and got
						// `undefined` for every assessment including the SEEDED ones that genuinely hold evidence.
						// It could not have passed whatever the code did, which is the tell: an assertion that reads
						// the wrong path is not a failing test, it is a test of nothing. The ratified
						// `AssuranceAssessmentCompleted` payload declares `evidenceConsideredIds` at the top level.
						const considered = (e.payload as { evidenceConsideredIds?: unknown[] })
							.evidenceConsideredIds;
						return Array.isArray(considered) && considered.includes(id);
					}),
				{
					message:
						'the sign-off must record the evidence it considered — evidenceConsideredIds is what an unevidenced assessment leaves empty'
				}
			)
			.toBe(true);
	});
});
