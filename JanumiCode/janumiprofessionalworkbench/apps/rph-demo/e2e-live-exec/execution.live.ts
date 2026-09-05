import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated, declareRisk } from '../e2e/support/harness';

// JAN-LIVEEXEC — a work unit runs on a REAL model and is reviewed by a REAL, DIFFERENT one.
//
// ⭑⭑ THIS IS THE FIRST TIME. `JAN-TOOLSUITE` built the chain and proved it against gates, but every green so
// far was against a deterministic fixture and an offline reviewer that judges STRUCTURE ONLY and records that
// limitation on every pass it issues. The sponsor's original diagnosis — *"a PWU is an agent with a prompt
// template and relevant context … none of that existed in reality"* — closes only when a real model does the
// work and a real, different model judges it.
//
// ── ⚠ STRUCTURE HARD, QUALITY SOFT ──────────────────────────────────────────────────────────────────────────
// The convention the sibling live spec already states: model output is non-deterministic, so a judgement about
// it is *"reported SOFTLY … rather than turned into a brittle live failure."*
//
// ⛔ AND THE SOFT HALF IS A CORRECTNESS REQUIREMENT, NOT TIMIDITY. A spec that REQUIRED the review to be
// SATISFIED would be asserting that one vendor approves of another vendor's work on one prompt — a fact about
// two models, not about this system. Worse: the cheapest way to make such a test pass is to WEAKEN THE
// REVIEWER, which is precisely the rubber stamp this floor exists to prevent.
// ── ⭑⭑ WHAT THE FIRST RUNS ACTUALLY FOUND (2026-09-05) ──────────────────────────────────────────────────────
// The lane paid for itself three times before it ever went green, and each defect was invisible to the gate:
//
//   1. `runWorkProductFloor` supplied a store with NO SINK, so the first real reviewer ever pointed at a work
//      product failed with `VALIDATOR_EXECUTION_FAILED: a store was supplied with no sink … an orphan
//      (REG-F-336 C-2)`. The MOCK captures nothing, so the sink was never reached and every gate run was green.
//   2. `getExecutionPrint` mapped the Pi adapter's result to `.then((r) => r.answerText)` — throwing away the
//      identity `TS-04` had just widened the seam to carry, so the record wrote `resolvedModel: "unresolved"`
//      while a real model had answered. NO UNIT TEST COULD SEE IT: they all inject their own `print`.
//   3. Two wrong waits of my own, recorded at the click below.
//
// ⭑ AND THE REVIEW ITSELF WAS SUBSTANTIVE. GLM-5.2 REJECTED the work product, saying the producer *"returned
// the required JSON output but omitted the Section 9.7 professional rationale summary entirely, implicitly
// treating output production as sufficient without accounting for how the obligation was discharged."*
//
// ⚠⚠ THAT REJECTION EXPOSES AN INCOHERENCE THIS SPEC DOES NOT RESOLVE, AND MUST NOT HIDE. The executor's own
// system prompt says *"Do not narrate, do not explain your reasoning"* — so we INSTRUCTED the producer not to
// do the thing the reviewer then faulted it for omitting. Either an execution step should declare a §9.7
// rationale (and the executor prompt is wrong), or the reviewer should not read that absence as a finding for
// execution subjects — §9.7's own rule is that *presence or absence is never a signal*. That is a sponsor
// question, not a thing to settle by quietly editing whichever side is easier to change.
//
// ⚠ ALSO DISCLOSED: the reviewer records `HOST_CONFIGURED` while the suite declares Devin `PROVIDER_REPORTED`.
// `readReportedModel` reads the model back out of Devin's ATIF export and IS NEVER CALLED — the assurance seam
// still returns a bare string, exactly as the execution seam did before `TS-04`. The declaration and the record
// therefore disagree, and the declaration is the one that is right. Owed, and asserted below only for the
// producer so this spec does not claim what the record does not say.

const TEMPLATE = [
	'You are assessing a delivery route for operational risk.',
	'',
	'Subject: {subject}',
	'Required outputs: {expectedOutputs}',
	'',
	// ⛔ A DELIMITED ANSWER IS A RETENTION REQUIREMENT, NOT A PREFERENCE. `REG-F-351`: the §9.7 split LOCATES a
	// JSON object, so an undelimited prose answer is blocked from retention and the step's work product is
	// never kept. A live prompt that asked for prose would exercise the blocked path and prove the opposite of
	// what this spec claims.
	'Return ONLY a single minified JSON object and no other text, shaped exactly as:',
	'{"finding":"...","risks":["..."],"recommendation":"..."}'
].join('\n');

/** The E-3 identity a model exchange recorded, as the projection holds it. */
type Identity = { availability?: string; evidence?: string; value?: string };

test.describe('LIVE — a work unit is executed by a real model and reviewed by a different one', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('produces a work product on the executor and has it reviewed by the assurance tool', async ({
		page,
		request
	}) => {
		// ⚠ THE CONFIGURED VALUE MAY CARRY A PROVIDER PREFIX (`openai-codex/gpt-5.4-mini`) while the RECORD holds
		// the resolved model id alone. Comparing the two forms directly fails on the prefix — the record is not
		// wrong, the two are simply different notations for the same choice.
		const executorModel = process.env.JPWB_EXECUTOR_MODEL!.split('/').pop()!;
		const assuranceModel = process.env.JPWB_ASSURANCE_MODEL!;
		// ⭑ THE PRECONDITION OF THE WHOLE LANE, ASSERTED RATHER THAN ASSUMED. If these matched, the review would
		// be refused for non-independence and the run would prove nothing about either model.
		expect(executorModel, 'producer and reviewer must be different models').not.toBe(assuranceModel);

		// ── 1. Author a type whose work a MODEL does, with a real prompt ──────────────────────────────────
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Live Operations PWA');
		await page.getByPlaceholder(/Domain/i).fill('logistics');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await page.getByRole('link', { name: /Live Operations PWA/ }).click();

		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Route Assessment');
		await page.locator('input[name="pwuKind"]').fill('ROUTE_ASSESSMENT');
		await page.getByLabel(/Root type/i).check();
		await page.getByTestId('pwu-type-discharge').selectOption('MODEL');
		await page.getByTestId('pwu-type-prompt').fill(TEMPLATE);
		await page.getByRole('checkbox', { name: /Ready to use/i }).check();
		await page.getByRole('button', { name: 'Add type' }).click();
		await expect(
			page.locator('.svelte-flow__node').filter({ hasText: 'Route Assessment' })
		).toBeVisible();

		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();

		// ── 2. Instantiate work from it ───────────────────────────────────────────────────────────────────
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Live Execution');
		const pwaSelect = page.getByRole('combobox', { name: 'Instantiate from published PWA' });
		await expect(pwaSelect.locator('option'), 'the PWA never published').toHaveCount(2);
		await pwaSelect.selectOption({ index: 1 });
		await declareRisk(page);
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		const row = page.getByRole('link', { name: /Live Execution/ });
		await expect(row).toBeVisible();
		await gotoHydrated(page, (await row.getAttribute('href'))!);

		// ── 3. Execute — two real model calls: produce, then review ───────────────────────────────────────
		await page.getByRole('button', { name: 'overview' }).click();

		// ⚠ THE WAIT IS ON THE SERVER ACTION, AND IT TOOK TWO WRONG TRIES TO GET THERE.
		//   1. Waiting for the Execute button to DISAPPEAR burned 480s: the button persists either way.
		//   2. Removing the wait entirely was an OVER-CORRECTION — `.click()` resolves when the click is
		//      dispatched, not when the POST returns. The deterministic spec gets away with it only because its
		//      backend answers instantly; two real model calls take minutes, so `introspect` ran against a work
		//      unit still sitting at PROPOSED and reported "no model was invoked" when nothing had been asked yet.
		// ⭑ Waiting on the RESPONSE settles both: it resolves whether the action SUCCEEDS or REFUSES, so a
		// refusal surfaces as an alert to read rather than as a timeout that hides it.
		const executed = page.waitForResponse((r) => r.request().method() === 'POST', {
			timeout: 480_000
		});
		await page
			.getByRole('row', { name: /Route Assessment/ })
			.first()
			.getByRole('button', { name: 'Begin & Execute' })
			.click();
		await executed;
		// Let the resulting render settle before reading engine state.
		await expect(page.getByRole('button', { name: 'Begin & Execute' }).first()).toBeVisible();

		// ── 4. ENGINE STATE — asserted HARD, because none of it depends on model quality ──────────────────
		const snap = await introspect(request);

		const exchanges = snap.modelExchanges.map((r) => r.state as Record<string, unknown>);
		const execution = exchanges.filter((e) => e.plane === 'EXECUTION');
		const assurance = exchanges.filter((e) => e.plane === 'ASSURANCE');
		expect(execution.length, 'no model was invoked for the step').toBeGreaterThanOrEqual(1);
		expect(assurance.length, 'no model reviewed the work product').toBeGreaterThanOrEqual(1);

		const producer = execution[0]!.resolvedModel as Identity;
		const reviewer = assurance[0]!.resolvedModel as Identity;

		// ⭑ THE PRODUCER IS THE EXECUTING MODEL. Before `JAN-TOOLSUITE` this field carried the JUDGE's model —
		// the producing side labelled with the reviewing side's identity, which is both a fiction and a
		// guaranteed independence refusal.
		expect(producer.value, 'the producer must be the EXECUTING model').toContain(executorModel);
		expect(reviewer.value, 'the reviewer must be the ASSURANCE model').toContain(assuranceModel);

		// ⭑⭑ THE FIRST REAL INDEPENDENCE VERDICT THIS SYSTEM HAS PRODUCED. Everything before this compared a
		// fixture against a mock with a hardcoded identity.
		expect(producer.value, 'producer and reviewer are the same model').not.toBe(reviewer.value);

		// ⭑ AND THE FIRST TIME `PROVIDER_REPORTED` IS WRITTEN BY LIVE TOOLS. It had ZERO producers from the day
		// it was ratified until this lane ran: the old seam returned a bare string and could not carry it.
		expect(producer.evidence, 'the executing tool reports its own model').toBe('PROVIDER_REPORTED');
		// ⚠ NOT ASSERTED FOR THE REVIEWER, DELIBERATELY. Devin DOES report its own model, but the assurance seam
		// still returns a bare string so the record says HOST_CONFIGURED. Asserting PROVIDER_REPORTED here would
		// redden honestly; asserting HOST_CONFIGURED would PIN THE DEFECT as though it were the design. Neither
		// is right, so the spec says nothing and the header discloses it.

		// ⚠ AND THE VERSION ARM STAYS UNREPORTED. Every tool returns a model LABEL; a label is not a version,
		// and writing one into the version field is the substitution PER-9 forbids.
		expect((execution[0]!.resolvedModelVersion as Identity).availability).toBe('UNREPORTED');

		// The work product exists and is retained.
		const answerRef = execution[0]!.answerSpanRef as { status?: string; storageKey?: string };
		expect(answerRef.status, 'the work product was not retained').toBe('STORED');
		expect(snap.artifacts, 'the step recorded no work product').not.toHaveLength(0);

		// ⛔ PER-12 — the reviewer must not have received the producer's reasoning. `thinkingLevel: 'off'` means
		// none is solicited, so this asserts the OBSERVED ABSENCE rather than a scrubbed presence.
		const reasoningRef = execution[0]!.volunteeredReasoningRef as { status?: string };
		expect(reasoningRef.status, 'reasoning must not be retained as participating').not.toBe(
			'RETAINED_BY_PARTICIPATION'
		);

		// ── 5. ⭑ THE OBSERVATION — reported, never asserted ───────────────────────────────────────────────
		// This is what the lane exists to produce. A green tick tells us the wiring holds; only this tells us
		// whether the reviewer is any good.
		const assessments = snap.assessments.map((r) => r.state as Record<string, unknown>);
		const observations = snap.observations.map((r) => r.state as Record<string, unknown>);
		console.log('\n─── LIVE REVIEW OUTCOME ' + '─'.repeat(52));
		// ⭑ JAN-EXECLOOP — ONE EXECUTION EXCHANGE PER TRY, so this IS the try count. `PER-9` requires each
		// retry and repair request be its own record, which makes the loop's behaviour readable from the
		// governed stream rather than from a log line.
		console.log(`tries    : ${execution.length}  (execution-plane exchanges)`);
		console.log(`producer : ${producer.value}  (${producer.evidence})`);
		console.log(`reviewer : ${reviewer.value}  (${reviewer.evidence})`);
		for (const a of assessments)
			console.log(`assessment ${String(a.policyId ?? '?')} -> ${String(a.assessmentState ?? '?')}`);
		for (const o of observations)
			console.log(`  · ${String(o.code ?? '?')}: ${String(o.statement ?? '').slice(0, 220)}`);
		console.log('─'.repeat(75) + '\n');

		test.info().annotations.push({
			type: 'live-review',
			description: assessments.map((a) => `${String(a.policyId)}=${String(a.assessmentState)}`).join(' ')
		});
	});
});
