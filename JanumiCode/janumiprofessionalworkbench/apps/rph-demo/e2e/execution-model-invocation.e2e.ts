import { expect } from '@playwright/test';
import {
	test,
	resetEngine,
	introspect,
	gotoHydrated,
	declareRisk,
	registerStipulation
} from './support/harness';

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
		// ⭐ THE TEST STIPULATES THE WORK PRODUCT'S REVIEW REMAINDER (`JAN-CRITREAD` J1-3; `DESIGN-what-the-tests-prove.md`
		// §4.5, §4.6): the WORK_PRODUCT arm, in the body, after the reset, with the PWA's id READ FROM THE STORE. The
		// work product finds its PWA through artifact → work unit → undertaking, so this is the PWA it will answer to.
		const pwaId = (await introspect(request)).pwas.find(
			(p) => p.state.name === 'Executable Operations PWA'
		)!.id;
		await registerStipulation(request, pwaId, 'WORK_PRODUCT');

		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Route Assessment');
		await page.locator('input[name="pwuKind"]').fill('ROUTE_ASSESSMENT');
		await page.getByLabel(/Root type/i).check();
		// JAN-DISCHARGE — the type must SAY a model does this work. Rule 2 refuses an ACTIVE prompt on a type
		// that declares anything else, so this line is the spec obeying the coherence rule rather than
		// dodging it: an armed prompt and a declared discharge are one decision, said once.
		await page.getByTestId('pwu-type-discharge').selectOption('MODEL');
		await page.getByTestId('pwu-type-prompt').fill('Assess {subject}.');
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
		// ⚠ WAIT FOR THE ACTION, NOT THE CLICK (`JAN-CRITREAD` J1-4). `.click()` resolves when the click is dispatched,
		// not when the POST returns, so reading the engine straight after it can run before the step has executed.
		const executeUrl = new URL('?/beginExecute', page.url()).href;
		const executed = page.waitForResponse(
			(r) => r.url() === executeUrl && r.request().method() === 'POST'
		);
		await page
			.getByRole('row', { name: /Route Assessment/ })
			.first()
			.getByRole('button', { name: 'Begin & Execute' })
			.click();
		await executed;

		// ── 4. ENGINE STATE ───────────────────────────────────────────────────────────────────────────────
		const snap = await introspect(request);

		// ── ⭑⭑ JAN-EXECGOV EG-02 — `STA-8` IS SATISFIED ON A REAL EXECUTION, FOR THE FIRST TIME ──────────
		//
		// *"Execution requires an approved plan and AUTHORIZED Runtime Bindings."* `REG-F-365` measured the
		// production count of RUNTIME_BINDING at ZERO — `RequestRuntimeBinding` had no dispatch site at all —
		// so every step took `bindingAuthorityVerdict`'s `OUT_OF_SCOPE` limb and the four binding checks were
		// live, tested, and unreachable on real work. THE MUTANT: drop the request/authorize pair from the
		// batch; the run still succeeds and the invariant is silently unmet again, exactly as before.
		const bindings = snap.runtimeBindings as { state: Record<string, unknown> }[];
		expect(bindings, 'no RUNTIME_BINDING was created for the model step').toHaveLength(1);
		const bind = bindings[0]!.state;
		// ⭑ AUTHORIZED, not merely REQUESTED — `STA-8` says authorized, and `RPH-EXE-003` refuses a start on a
		// binding still in REQUESTED. That refusal has never been reachable in production until now.
		expect(bind.authorizationStatus, 'STA-8 requires an AUTHORIZED binding').toBe('AUTHORIZED');
		// ⭑ AND IT AUTHORIZES THIS STEP. A binding authorizes the step it names and no other.
		expect(bind.executionStepId, 'the binding must name the step it authorizes').toBe(
			(snap.executionPlans[0]!.state.steps as { id: string }[])[0]!.id
		);
		// ⛔ THE GRANT IS EXACTLY THE REQUEST, AND NOT ONE CAPABILITY MORE. §22.1: an unrequested grant is
		// privilege expansion without an authorization event, which `grantedWithinRequest` refuses. THE MUTANT:
		// authorize a capability the request did not ask for.
		//
		// ⭐ THIS USED TO READ `toEqual([{ capability: 'network' }])` AND IT WENT RED ON JAN-EXEC PHASE 3, WHICH
		// IS THE ASSERTION WORKING. The request is no longer one hardcoded capability: it is DERIVED from the
		// step type's REQUIRES/USES table, because Phase 3 mints the model a file-writing and a
		// command-running tool and a binding that never asked for them would be granting privilege nobody
		// requested. ⚠ Re-typing the new list here would be the weaker repair — a literal asserts against a
		// table this spec invented, so a needs table that drifted from production would stay green. The
		// assertion is therefore GRANTED === REQUESTED, on the live objects.
		expect(bind.grantedCapabilities).toEqual(bind.requestedCapabilities);
		// ⭑ `network` IS STILL THERE BY NAME, because it is the one capability the ratified `RPH-EXE-004`
		// example supplies and the one this step REQUIRES — a derivation-only assertion would pass on an empty
		// request, which `RequestRuntimeBinding` refuses (N-20) but this spec should not depend on.
		expect(bind.requestedCapabilities).toContainEqual({ capability: 'network' });
		// ⛔ AND `process-execution` IS DISTINCT FROM `file-system`, ON THE WIRE. Starting a process is strictly
		// larger than writing a file; collapsed into one capability the grant could not express "may write, may
		// not run", which is the narrowest useful authorization this seam has.
		expect(bind.requestedCapabilities).toContainEqual({ capability: 'file-system' });
		expect(bind.requestedCapabilities).toContainEqual({ capability: 'process-execution' });

		// ⭑ THE FIRST RECORD EVER WRITTEN TO THE EXECUTION PLANE. `plane` has carried an `EXECUTION` member
		// since REG-D-055 and every record in the system said ASSURANCE or AUTHORING.
		expect(snap.modelExchanges, 'no model was invoked for the step').toHaveLength(1);
		const mex = snap.modelExchanges[0]!.state as Record<string, unknown>;
		expect(mex.plane).toBe('EXECUTION');
		expect(mex.subjectObjectType).toBe('PROFESSIONAL_WORK_UNIT');
		// PER-9's index, finally resolving to something a reader can look up (REG-D-058).
		expect(
			String(mex.promptTemplateFingerprint ?? ''),
			'the fingerprint must name the template'
		).toMatch(/^pwut_.*@v1$/);

		// ⭑ THE MODEL SAW THE RENDERED TEMPLATE, not a generic instruction. The deterministic backend echoes
		// what it was given, so this proves the authored prompt reached it with the work unit's facts in place.
		const answerRef = mex.answerSpanRef as {
			status?: string;
			storageKey?: string;
			byteSize?: number;
		};
		expect(answerRef.status, 'the work product was not retained').toBe('STORED');

		// ⭑ AND IT IS A WORK PRODUCT, not just an audit record. THE MUTANT: complete the step with
		// `noOutputResult` as the demo always has. The exchange still exists, the run still looks fine, and the
		// work unit produced nothing a downstream step or an assurance policy could consume.
		expect(snap.artifacts, 'the step recorded no work product').toHaveLength(1);
		const art = snap.artifacts[0]!.state as Record<string, unknown>;

		// ── ⭐⭐ THE ASSERTION BELOW IS CHANGED BY A SPONSOR RULING, NOT BY A FAILING RUN ──────────────────
		//
		// ⚠ IT USED TO READ: `expect(art.storageKey, 'the artifact and the exchange must name ONE stored
		// object').toBe(answerRef.storageKey)`. That was a TRUE invariant and it is recorded here rather than
		// deleted, because editing a test to admit a change is the move this programme never makes — what
		// changed is what the test SHOULD assert, and only a ruling may do that.
		//
		// ⭐ SPONSOR RULING (JAN-EXEC Phase 0, 2026-09-14): *"the ANSWER HALF is the ENVELOPE; the ARTIFACT keeps
		// naming the WORK PRODUCT; and the RELATIONSHIP BETWEEN THEM MUST BE DECLARED"* — so a reader can still
		// tell which bytes an assessment rested on.
		//
		// ⛔ WHY THE OLD ASSERTION CANNOT SURVIVE THE RULING, AND WHY THAT IS NOT A WEAKENING. Handing
		// `captureTry` the TRUE raw reply is what lets Guide §9.7's lawful split run at all — without it the
		// record disclosed *"No volunteered reasoning arrived … an observed absence, not an unretained
		// presence"* for replies that carried some, which is a record manufacturing the absence it discloses.
		// With it, `splitAnswerSpan` locates the ENVELOPE, and the envelope is not the work product: two objects,
		// two hashes, and `art.storageKey === answerRef.storageKey` is arithmetically impossible. The property
		// the old line PROTECTED — *"a reader cannot tell which the assessment rested on"* — is not abandoned; it
		// is now carried explicitly, and the three assertions below are what carry it.
		const parse = mex.parseOutcome as { outcome?: string; detail?: string };
		// 1. THE ANSWER HALF IS THE ENVELOPE. `PARSED` is reachable on this path only when the reply was read AS
		//    the execution contract's envelope. THE MUTANT: leave E-5 at `NOT_ATTEMPTED` as it was — the record
		//    then says nothing was coerced while a work product was extracted and stored.
		expect(parse.outcome, 'E-2’s answer half was not read as the execution ENVELOPE').toBe(
			'PARSED'
		);
		// 2. THE RELATION IS DECLARED, AND IT RESOLVES TO THE ARTIFACT. The whole address, not just the key:
		//    `contentHash` is what lets a reader re-hash the retained bytes and refuse a record that lied.
		//    THE MUTANT: declare the ANSWER SPAN's own address instead. Every other assertion still passes and
		//    the record points a reader at the envelope while every assessment was recorded over the artifact.
		//
		// ⭐⭐ R11 (sponsor, 2026-09-15) — THIS READS A TYPED FIELD NOW, AND IT USED TO READ A SENTENCE. What
		// stood here found the literal `WORK_PRODUCT_DERIVATION` inside `parseOutcome.detail`, sliced from the
		// next `{`, and `JSON.parse`d the tail of a prose string. It worked; its existence was the finding. The
		// ruling made the relation a typed `MODEL_EXCHANGE` field, so the durable record a reader queries now
		// HAS a field to query. ⚠ Nothing is weakened: the same address is asserted, plus the discriminator that
		// says WHICH of four relations this is — a distinction the prose could not carry at all.
		const declared = mex.workProductDerivation as Record<string, unknown>;
		expect(declared, 'the exchange record declares no relation to the artifact at all').toBeTruthy();
		expect(
			declared.relation,
			'the envelope was honoured here, so the work product came out of a NAMED FIELD of the answer span'
		).toBe('ENVELOPE_FIELD');
		expect(declared.sourceField).toBe('workProduct');
		expect(declared.storageKey, 'the declared relation does not reach the ARTIFACT').toBe(
			art.storageKey
		);
		expect(declared.contentHash, 'the declaration names bytes other than the artifact’s').toBe(
			art.contentHash
		);
		// ⭐⭐ R11 (b) — AND THE RECORD SAYS WHAT WAS OBSERVED, WHICH IS NOTHING, RATHER THAN STAYING SILENT.
		//    §22.1 makes model output UNTRUSTED EXTERNAL INPUT. No adapter at HEAD mints a tool surface, so the
		//    honest value is NOT_OBSERVABLE with a stated reason — NOT `NONE_OBSERVED`, which would claim an
		//    instrument looked and found nothing, and which a reader is entitled to rely on.
		//    THE MUTANT: report NONE_OBSERVED from the adapter. The run stays green everywhere else and the
		//    governed record silently acquires a measurement nobody made.
		const observed = mex.observedToolCalls as Record<string, unknown>;
		expect(observed, 'the record says nothing about what the step was observed to do').toBeTruthy();
		expect(observed.observation).toBe('NOT_OBSERVABLE');
		expect(observed.reason, 'a disclosed absence must say why, or it is the silent one PER-9 forbids').toBeTruthy();
		expect(observed.calls, 'an adapter that cannot see must not describe what it did not see').toBeUndefined();
		// 3. AND THE SPAN GENUINELY CARRIED IT. The envelope wraps the work product plus the rationale, so it is
		//    strictly the larger object. THE MUTANT: store the work product as the answer span after all — the
		//    declaration would still resolve, and the §9.7 split would again have nothing to separate.
		expect(
			Number(answerRef.byteSize),
			'the answer span is not the envelope that carried the work product'
		).toBeGreaterThan(Number(art.byteSize));

		expect(art.producingPwuId, 'the artifact names the work unit that produced it').toBeTruthy();

		// ⛔ THE EXECUTOR IS THE MODEL. Recording the human who clicked would be a fiction, and the assurance
		// floor is entitled to know which it was. THE MUTANT: reuse the operator provenance the TRANSFORMATION
		// path records — every assertion above still passes and the record quietly credits a person.
		const plan = snap.executionPlans[0]!.state as { steps?: Array<Record<string, unknown>> };
		const step = plan.steps?.[0] ?? {};
		expect(step.stepType, 'an AI-attempted step is a MODEL_INVOCATION').toBe('MODEL_INVOCATION');

		// ── ⭑⭑ AND IT COMPLETED BECAUSE THE FLOOR COMPOSED SATISFIED FROM THE CHECKER'S REAL ANSWERS AND A STIPULATED
		//    REMAINDER — NOT BECAUSE NOTHING CHECKED ──────────────────────────────────────────────────────────────
		//
		// ⭐⭐ RESTATED (`JAN-CRITREAD` J1-3; `REG-D-071` Q6b). This banner read "AND IT COMPLETED BECAUSE IT WAS ASSURED",
		// and its message "the work product was not assured": a claim that a REVIEWER satisfied the floor over the work
		// product. On this lane nobody judges seven of the nine criteria — the declared stand-in records the structural
		// checker's two real answers and the remainder THIS TEST stipulated, each `UNABLE_TO_DETERMINE` with the
		// stipulation beside it. So the claim is now what the lane can prove: the step completed because the floor
		// composed SATISFIED — from real answers and a declared stipulation, in an engine built for tests — and the
		// record says which rows are which (below). Whether a reviewer can EARN it moved to reviewer qualification.
		//
		// `floor-gate.ts:30` makes a MODEL_INVOCATION AI-produced BY CONSTRUCTION, so completing it REQUIRES
		// the three floor policies satisfied against the work product. Three assessments now exist against the
		// ARTIFACT, and the reasoning review is SATISFIED.
		//
		// ⛔ THE MUTANT: weaken the gate, or record the operator as executor so the AI signal never fires. The
		// step would complete with nothing reviewed — the thing this system exists to refuse.
		const artifactId = String(art.id ?? snap.artifacts[0]!.id);
		const overArtifact = snap.assessments.filter((a) =>
			((a.state.subjectObjectIds as string[] | undefined) ?? []).includes(artifactId)
		);
		expect(overArtifact.length, 'the floor never ran over the work product').toBe(3);
		const rr = overArtifact.find((a) => a.state.assurancePolicyId === 'floor.reasoning-review');
		expect(
			rr?.state.assessmentState,
			'the floor did not compose SATISFIED from the checker’s real answers and the stipulated remainder'
		).toBe('SATISFIED');

		// ⭐ AND WHICH ROWS ARE WHICH — the work-product arm's (§4.6). The checker read a work product with content, so it
		// judged RR-04 and RR-01, EVALUATED `MET` with no stipulation beside them; every other criterion of the policy is
		// `UNABLE_TO_DETERMINE` — nobody judged it — with the test's stipulation beside it. The LATEST recording of each —
		// and ⚠ NOT "ONCE": the handler lets a criterion be recorded again and Gate E reads the latest
		// (`undetermined-criterion-gate.test.ts`, "a later determination SUPERSEDES…"), so no count of recordings is claimed.
		const latest = new Map<string, [string, string, string | null]>();
		for (const e of snap.events) {
			if (e.eventType !== 'AssuranceCriterionEvaluated') continue;
			const p = e.payload as { assessmentId: string; criterionId: string; result: string; stipulated?: string };
			if (p.assessmentId === rr?.id) latest.set(p.criterionId, [p.criterionId, p.result, p.stipulated ?? null]);
		}
		const rows = [...latest.values()].sort((a, b) => a[0].localeCompare(b[0]));
		const policy = snap.assurancePolicies.find((p) => p.id === 'floor.reasoning-review')!;
		expect(
			rows.map(([id]) => id),
			'every criterion of the policy is recorded (its latest recording read, as Gate E reads it)'
		).toEqual((policy.state.criteria as { id: string }[]).map((c) => c.id).sort((a, b) => a.localeCompare(b)));
		expect(
			rows.filter(([, , claim]) => claim === null),
			'the structural checker judged RR-01 and RR-04 on a work product with content, and only those'
		).toEqual([
			['RR-01-no-problem-substitution', 'MET', null],
			['RR-04-no-proxy-satisfaction', 'MET', null]
		]);
		const stipulatedRows = rows.filter(([, , claim]) => claim !== null);
		expect(stipulatedRows, 'seven criteria the checker cannot judge').toHaveLength(7);
		expect(
			stipulatedRows.filter(([, result, claim]) => result !== 'UNABLE_TO_DETERMINE' || claim !== 'MET'),
			'a stipulated row must say nobody judged it, with the test’s answer BESIDE the result'
		).toEqual([]);

		// ⚠ AND THE REVIEW WAS INDEPENDENT OF THE PRODUCER, which is not a formality: the policy requires
		// DIFFERENT_MODEL, and `checkIndependence` refuses when either side leaves the field undefined — an
		// absence never evidences independence. THE MUTANT: put the producing model id in `agentId` and leave
		// `modelId` unset. Every assertion above fails, which is how this was found.
		expect(
			(rr?.state.observationIds as string[] | undefined) ?? [],
			'an independence violation would have been recorded'
		).toHaveLength(0);
		// ⚠ THE "REFUSAL IS SURFACED" ASSERTION LIVED HERE AND IS GONE, DELIBERATELY. It was correct while the
		// floor could only refuse; now the step completes, there is no alert, and keeping it would have meant
		// asserting that a successful run still shows an error. ⭑ **The refusal path is not lost, and it is
		// proven by a DRIVEN test rather than by this comment**: `work-product-floor-run.test.ts` runs the real
		// floor over an empty work product against a real engine and asserts it is NOT satisfied, with RR-04
		// recorded. Naming the file is deliberate — "it is covered elsewhere" is how coverage gets asserted
		// rather than shown.

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
		expect(pwu.state.executionState, 'and the existing lifecycle still completes').toBe(
			'SUCCEEDED'
		);
		// ⛔⛔ AND NO BINDING WAS MINTED — the control that keeps `OUT_OF_SCOPE` REACHABLE (`JAN-EXECGOV`).
		// A TRANSFORMATION step invokes no model and needs no network. The kernel records why this matters:
		// collapsing the no-binding case *"would make every plan in the reference seed — which authors no
		// RuntimeBinding whatsoever — permanently unstartable"*. THE MUTANT: bind every step. This run would
		// still pass its other assertions while every pre-existing plan in the system broke.
		expect(
			snap.runtimeBindings,
			'a step that invokes no model must need no binding — OUT_OF_SCOPE has to stay reachable'
		).toHaveLength(0);
	});
});
