import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import {
	test,
	resetEngine,
	introspect,
	gotoHydrated,
	registerStipulation,
	type EngineSnapshot,
	type ObjectRow
} from './support/harness';
import { shot } from './support/gallery';
import {
	actionFields,
	createDraftPwa,
	createUndertakingThroughForm,
	escapeRegExp,
	pressAction,
	publishThroughDesigner,
	typePwuTypes,
	unitRow,
	type ActionEnvelope
} from './support/phase7-pwa';
// ⭐ THE RUN'S OWN DECLARATION — the brief, the five types, their prompts and output contracts — from the one module the
// negative control and the run's lane read too (`scripts/phase7/pwa-content.ts`; its header says why it lives there).
import {
	PHASE7_INSTRUCTION_BUDGET,
	PHASE7_MARKERS,
	PHASE7_PHASES,
	PHASE7_PWA,
	PHASE7_REQUIREMENTS,
	PHASE7_ROOT,
	promptMarkers,
	renderedPrompt,
	type Phase7PwaDeclaration,
	type Phase7TypeDeclaration
} from '../../../scripts/phase7/pwa-content';

// ⭐⭐ `JAN-EXEC` Phase 7, P7-1b — THE FIVE-UNIT REHEARSAL, IN THE DETERMINISTIC GATE LANE
// (`docs/_working/DESIGN-the-live-end-to-end-run.md` §6; approved with the plan, `REG-D-102`).
//
// The paid run types §3.2's PWA into the designer as the operator, publishes it, creates an Undertaking of it, and
// runs its five units. This spec does all of that here first, at no cost: the fixture executor answers each model unit
// and the declared stand-in reviewer judges each work product (`REG-D-071`), and the test stipulates what the stand-in
// cannot judge. Then it signs each unit off and asserts the end state the design measures in place of an Undertaking
// that completes (stage 7; `REG-F-533`). A second PWA, its review left UNSTIPULATED, drives K1's refused-review arm.
//
// ── ⛔ WHAT THIS PROVES, AND WHAT IT DOES NOT ─────────────────────────────────────────────────────────────────────────
// It is a CHARACTERIZATION spec: each assertion pins TODAY'S behaviour and names the register id it pins, broken
// behaviour included. It proves the product's machinery carries a five-unit Undertaking of this shape from the
// designer to the end state — the forms, the publication, the instantiation, each step, each floor, each sign-off.
// ⚠ It is never evidence for the design's stages 3 to 5 (§2): the fixture runs no command and the stand-in judges two
// criteria and is stipulated the rest, so nothing here says how the executor or GLM behaves. That is the paid run's.
//
// ── ⭐ THE THREE PREDICTIONS, WRITTEN BEFORE THIS SPEC FIRST RAN (the design's P7-1b; 2026-10-09) ────────────────────
// Each is held in `PREDICTED` below, asserted where the spec reaches it, and recorded as a test annotation with what
// was observed — so a wrong prediction reddens and says what happened instead.
//   (a) Can the root be signed off while a child is stuck? PREDICTED: ALLOWED. Nothing gates a parent's sign-off on its
//       children: recomposition is undispatched in production (`REG-F-041`), and the design accounts the missing order
//       as by design (§7.4, B31). So a SATISFIED root is not a finished Undertaking (`REG-F-533`).
//   (b) Does a root whose TRANSFORMATION produced nothing turn green? PREDICTED: YES, GREEN (`REG-F-523`: *"A unit that
//       did nothing is signed off the same way"*). Its declared policies are signed off with no criterion answered.
//   (c) Does `completeStep` with no output close a step? PREDICTED: ADMITTED — for a model step whose structured result
//       is empty, the zero-subject rule admits it (`REG-F-520`, read from code there, not driven), and the unit stays
//       stuck, because no page action then moves its execution state (`REG-F-511`).
// ⭑ OBSERVED, 2026-10-09, at `60f81a20` with this spec uncommitted: each held, on the first run that reached it — (b)
//   GREEN on the first run; (a) ALLOWED on the second, the first having stopped at a locator of mine before it; (c)
//   ADMITTED on the third, the second having stopped at a baseline of mine before it. Neither stop was the product's.
// ⭐ OBSERVED BEFORE ANYTHING IS ASSERTED — since P7-1b's verifier found that (a) and (b) could only ever be recorded as
//   held. Each root sign-off went through `signOff`, which asserts each act, so a refusal reddened inside it and the
//   prediction was never recorded (driven: under a mutant refusing the root's sign-off, neither test's report carried
//   an annotation). Now the root is signed off through `attemptSignOff`, which asserts neither act, its observation —
//   a refusal included — is recorded, and only then is it held to the prediction. (c) was already recorded this way.
//
// ── ⚠ K1, DRIVEN (`REG-F-511`; the design's §5) ──────────────────────────────────────────────────────────────────────
// A model unit whose completion the floor refused stays EXECUTING with its execution RUNNING, and nothing on the page
// runs it again: Begin & Execute is offered only on a PROPOSED unit, Retry only re-queues the step, and Record
// Assurance is refused while the unit is RUNNING. The second test drives each limb, and then (c), the one lever left.
// ⚠ AND ONE THING NO ENTRY SAYS, FOUND BY THIS SPEC'S FIRST RUN: right after the refusal the page is STALE — the row
// still reads PROPOSED and still offers Begin & Execute, because SvelteKit's `enhance` reloads a page's data only on a
// success. Pressing that stale offer is refused at `BeginPwuShaping`; the second test pins both, then loads the page.
// ⭐ WHAT IT ANSWERS OF WHAT THE REGISTER HOLDS OPEN. `REG-F-511` was filed read from code, not driven: this drives it
// for ONE of the six stops it lists, the floor's refusal of a completion whose review is INCONCLUSIVE, and it holds.
// `REG-F-466`'s step retry, *"inferred, not driven"*: beside that refusal the page offers no Retry at all. And this
// plane has no re-run, so `REG-D-091`'s choice of no hard stop on an escalation, which assumed one, goes back to the
// sponsor (the design's §7.2; `REG-D-090`'s pointer). ⚠ An ESCALATED review stops its step through the same refusal,
// read from code, not driven here.
//
// ── ⛔ ITS MUTANTS, DRIVEN BEFORE IT LANDED — in a disposable copy of HEAD outside the repository, never this tree ──────
// Seven product mutants, one of them P7-1b's verifier's, and one arrangement control. Each reddened its test where
// marked "THE MUTANT" below (the control: "THE CONTROL"), as predicted — the red's own line can be inside the helper
// called there, `signOff`'s or `recordPrediction`'s expect — and the other test stayed green wherever that was
// predicted. ⭑ They are driven on this file's final bytes and its support module's: each run records the sha256 of
// both, and an edit to either is driven again. ⭐ AND, SINCE 2026-10-09, ON THE CONTENT MODULE'S: the declaration this
// file types moved to `scripts/phase7/pwa-content.ts` — the canonical brief, and each prompt's output contract, which
// the arrangement now reads back — so its bytes are a third that each run records; and the arrangement's new field has
// a mutant of its own (marked there). ⭐ AND SECTION 6'S PIN OF THE INSTRUCTION THE ROUTE SENT (round 2, 2026-10-09) HAS
// THREE, each driven on this file with the pin and without it (marked there); and on these bytes every earlier mutant
// was driven again, each reddening where it had. ⚠ ONLY THOSE ~~NINE~~ ~~TEN~~ ⭐ ELEVEN PLACES HAVE A MUTANT: every
// other assertion here — the Retry arm's "ran nothing" counts, `REG-F-533`'s ACTIVE and section 7's per-verdict rows
// among them — pins the record as it stands, and no mutant was driven against it.

/** The answers this spec predicted before it first ran (the header's section). ⛔ Changed only beside a new record. */
const PREDICTED = {
	a: 'ALLOWED',
	b: 'GREEN',
	c: 'ADMITTED'
} as const;

/** The operator: the host's session principal (`lib/server/identity.ts`), HUMAN. */
const OPERATOR = 'local-professional';
/** The second principal the declared-policy sign-off issues under (`R22`), also HUMAN (`REG-F-523`). */
const REVIEWER = 'assurance-reviewer-1';
/** That sign-off's validator (`lib/server/assurance/declared-policy-signoff.ts`, `DEMO_REVIEW_VALIDATOR_ID`). */
const SIGNOFF_VALIDATOR = 'workbench.independent-review';
/** The declared stand-in reviewer of this lane (`standin-reasoning-review-validator.ts`, `STANDIN_VALIDATOR_ID`). */
const STANDIN_VALIDATOR = 'standin.reasoning-review';
const REASONING_REVIEW = 'floor.reasoning-review';

/** The Undertaking of §3.2's PWA. Its objective reaches no unit's prompt (`REG-F-510`); the prompts name the product. */
const UNDERTAKING = {
	name: 'wordfreq realization',
	objective: 'Build wordfreq, a Node.js command-line tool that prints the N most frequent words.',
	product: 'wordfreq'
};

/** K1's PWA: the same root over ONE model phase, and no stipulation — so the stand-in leaves its review INCONCLUSIVE. */
const STUCK_PWA: Phase7PwaDeclaration = {
	name: 'CLI Product Realization, unstipulated',
	domain: 'software product',
	types: [PHASE7_REQUIREMENTS, { ...PHASE7_ROOT, children: [PHASE7_REQUIREMENTS.name] }]
};
const STUCK_UNDERTAKING = {
	name: 'wordfreq realization, unstipulated',
	objective: UNDERTAKING.objective,
	product: UNDERTAKING.product
};

// ── READERS OVER THE ENGINE'S GROUND TRUTH ─────────────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const payloadOf = (e: Record<string, unknown>) => (e.payload ?? {}) as Record<string, unknown>;

/** A unit's three axes as one value — lifecycle, assurance, execution — so a red names all three. */
const axes = (u: ObjectRow): string[] => [
	str(u.state.workLifecycleState),
	str(u.state.assuranceState),
	str(u.state.executionState)
];

/** The units of one Undertaking, by title. ⚠ Scoped HERE: `introspect` is unscoped by design. */
function unitsOf(snap: EngineSnapshot, undertakingName: string): Map<string, ObjectRow> {
	const undertaking = snap.undertakings.find((u) => u.state.name === undertakingName);
	expect(undertaking, `no Undertaking "${undertakingName}"`).toBeTruthy();
	return new Map(
		snap.pwus
			.filter((p) => p.state.undertakingId === undertaking!.id)
			.map((p) => [str(p.state.title), p])
	);
}

interface PlanStep {
	readonly id: string;
	readonly stepType: string;
	readonly stepState: string;
}

/** The unit's execution plans, each with its steps. */
function plansOf(snap: EngineSnapshot, unitId: string): { id: string; steps: PlanStep[] }[] {
	return snap.executionPlans
		.filter((p) => p.state.workUnitId === unitId)
		.map((p) => ({ id: p.id, steps: (p.state.steps as PlanStep[] | undefined) ?? [] }));
}

/** The unit's ONE plan and its ONE step — asserted, because every unit here is begun exactly once. */
function onlyStepOf(snap: EngineSnapshot, unitId: string): { planId: string; step: PlanStep } {
	const plans = plansOf(snap, unitId);
	expect(plans, `unit ${unitId} was not begun exactly once`).toHaveLength(1);
	expect(plans[0]!.steps, `unit ${unitId}'s plan has more than one step`).toHaveLength(1);
	return { planId: plans[0]!.id, step: plans[0]!.steps[0]! };
}

/** Every completion the step recorded — its `ExecutionStepSucceeded` payloads, in log order. */
function completionsOf(snap: EngineSnapshot, planId: string, stepId: string) {
	return snap.events
		.filter((e) => e.eventType === 'ExecutionStepSucceeded' && e.aggregateId === planId)
		.map(payloadOf)
		.filter((p) => p.executionStepId === stepId);
}

/** The assessments a unit's DECLARED policies were signed off by: each under a declared policy, naming the unit. */
function declaredVerdictsOf(snap: EngineSnapshot, unit: ObjectRow): ObjectRow[] {
	const declared = ids(unit.state.assurancePolicyIds);
	return snap.assessments.filter(
		(a) =>
			declared.includes(str(a.state.assurancePolicyId)) &&
			ids(a.state.subjectObjectIds).includes(unit.id)
	);
}

/** The validator an assessment's completion names — on the event, since the assessment object does not keep it. */
function validatorOf(snap: EngineSnapshot, assessmentId: string): string {
	const completed = snap.events.find(
		(e) =>
			e.eventType === 'AssuranceAssessmentCompleted' && payloadOf(e).assessmentId === assessmentId
	);
	return str(completed && payloadOf(completed).validatorId);
}

/** How many criterion answers were recorded against these assessments (`AssuranceCriterionEvaluated`). */
function criterionAnswersFor(snap: EngineSnapshot, assessmentIds: readonly string[]): number {
	const wanted = new Set(assessmentIds);
	return snap.events.filter(
		(e) =>
			e.eventType === 'AssuranceCriterionEvaluated' && wanted.has(str(payloadOf(e).assessmentId))
	).length;
}

/** What the record holds that a re-run would add to: exchanges, work products, assessments. */
const recordCounts = (snap: EngineSnapshot) => ({
	exchanges: snap.modelExchanges.length,
	artifacts: snap.artifacts.length,
	assessments: snap.assessments.length
});

/** Record a prediction's observation on the test (the run's JSON report keeps it), then hold it to the prediction. */
function recordPrediction(which: keyof typeof PREDICTED, observed: string, why: string): void {
	test.info().annotations.push({
		type: `P7-1b prediction (${which})`,
		description: `predicted ${PREDICTED[which]}, observed ${observed}: ${why}`
	});
	expect(observed, `prediction (${which}) did not hold: ${why}`).toBe(PREDICTED[which]);
}

/** An action's refusal text, or the whole envelope when it carries none — for a red that says why. */
const refusalOf = (envelope: ActionEnvelope): string =>
	str(actionFields(envelope).error) || JSON.stringify(envelope);

// ── THE OPERATOR'S ACTS ON THE UNDERTAKING PAGE ─────────────────────────────────────────────────────────────────────

/** Begin & Execute one unit, and return the action's own verdict. */
async function beginExecute(page: Page, title: string): Promise<ActionEnvelope> {
	return pressAction(
		page,
		'beginExecute',
		unitRow(page, title).getByRole('button', { name: 'Begin & Execute', exact: true })
	);
}

/** Record Assurance on one unit, and return the action's own verdict. */
async function recordAssurance(page: Page, title: string): Promise<ActionEnvelope> {
	return pressAction(
		page,
		'recordAssurance',
		unitRow(page, title).getByRole('button', { name: 'Record Assurance', exact: true })
	);
}

/** One sign-off as it came out: nothing refused, or the first act refused and the action's own envelope. */
interface SignOffAttempt {
	readonly refused?: {
		readonly act: 'Record Assurance' | 'Mark Satisfied';
		readonly envelope: ActionEnvelope;
	};
}

/**
 * Record Assurance, then — only if it was accepted — Mark Satisfied, ⭐ ASSERTING NEITHER: each act's own verdict is
 * returned, so a prediction is recorded before anything is held to it (the header's section). ⚠ Its one wait is the
 * re-render an accepted Record Assurance brings: the EXECUTING row offers a Mark Satisfied of its own, so the
 * UNDER_ASSURANCE row's is pressed only once Record Assurance has left the row.
 */
async function attemptSignOff(page: Page, title: string): Promise<SignOffAttempt> {
	const row = unitRow(page, title);
	const assured = await recordAssurance(page, title);
	if (assured.type !== 'success')
		return { refused: { act: 'Record Assurance', envelope: assured } };
	await expect(row.getByRole('button', { name: 'Record Assurance', exact: true })).toHaveCount(0);
	const green = await pressAction(
		page,
		'markSatisfied',
		row.getByRole('button', { name: 'Mark Satisfied', exact: true })
	);
	return green.type === 'success' ? {} : { refused: { act: 'Mark Satisfied', envelope: green } };
}

/** The refused act as one sentence — the act, the unit and the action's own reason — or nothing when none was. */
const signOffRefusal = (title: string, attempt: SignOffAttempt): string | undefined =>
	attempt.refused &&
	`${attempt.refused.act} on ${title} was refused: ${refusalOf(attempt.refused.envelope)}`;

/** Record Assurance, then Mark Satisfied — each asserted ACCEPTED by the action itself, and each re-render awaited. */
async function signOff(page: Page, title: string): Promise<void> {
	const refused = signOffRefusal(title, await attemptSignOff(page, title));
	expect(refused, refused).toBeUndefined();
	await expect(unitRow(page, title).getByText('✓ satisfied')).toBeVisible();
}

/**
 * A sign-off and the unit's axes after it, as ONE observed value for a prediction: `word` only when both acts were
 * accepted AND the store reads `expected` on the unit's leading axes; otherwise the refusal, or what the store holds.
 */
function observedSignOff(
	title: string,
	attempt: SignOffAttempt,
	unit: ObjectRow,
	expected: readonly string[],
	word: string
): string {
	const refused = signOffRefusal(title, attempt);
	if (refused) return `REFUSED — ${refused}`;
	const read = axes(unit);
	return read.slice(0, expected.length).join('/') === expected.join('/')
		? word
		: `ACCEPTED, but ${title} reads ${read.join('/')}`;
}

/**
 * The arrangement: the store holds the declaration as typed — kinds, discharges, purposes, armed prompts and their
 * output contracts, declared policies, and the root's children each M1. ⭑ Read back from the STORE, so a form that
 * dropped a field reddens here and not three steps later as a symptom.
 */
function expectTheTypesTyped(
	snap: EngineSnapshot,
	pwaId: string,
	declared: readonly Phase7TypeDeclaration[]
): void {
	const types = snap.pwuTypes.filter((t) => t.state.pwaId === pwaId);
	const idOf = new Map(types.map((t) => [str(t.state.name), t.id]));
	const typed = types
		.map((t) => {
			const prompt = t.state.promptTemplate as
				| {
						templateText?: string;
						status?: string;
						declaredPlaceholders?: string[];
						outputContract?: string;
				  }
				| undefined;
			const children =
				(t.state.permittedChildren as { typeId: string; cardinality: string }[] | undefined) ?? [];
			return {
				name: str(t.state.name),
				pwuKind: str(t.state.pwuKind),
				purpose: str(t.state.purpose),
				workDischarge: str(t.state.workDischarge),
				isRoot: t.state.isRoot === true,
				prompt: prompt ? `${prompt.status}: ${prompt.templateText}` : 'none',
				// The answer's shape, which the engine appends to the rendered prompt — typed, so held here like the text.
				// ⛔ THE MUTANT, DRIVEN (2026-10-09): the operator's hands leave it unfilled — both tests redden at the
				// arrangement's expect below, before anything else is asserted.
				outputContract: prompt?.outputContract ?? 'none',
				// ⭐ THE MARKERS THE ENGINE WILL DEMAND AT RENDER — derived by the server from the text, never typed.
				markers: [...(prompt?.declaredPlaceholders ?? [])].sort(),
				policyIds: ids(t.state.requiredAssurancePolicyIds).sort(),
				children: children.map((c) => `${c.typeId}:${c.cardinality}`).sort()
			};
		})
		.sort((x, y) => x.name.localeCompare(y.name));
	const expected = declared
		.map((t) => ({
			name: t.name,
			pwuKind: t.pwuKind,
			purpose: t.purpose,
			workDischarge: t.workDischarge,
			isRoot: t.isRoot === true,
			prompt: t.prompt === undefined ? 'none' : `ACTIVE: ${t.prompt}`,
			outputContract: t.outputContract ?? 'none',
			markers: promptMarkers(t.prompt ?? '').sort(),
			policyIds: [...t.policyIds].sort(),
			children: (t.children ?? []).map((name) => `${idOf.get(name)}:M1`).sort()
		}))
		.sort((x, y) => x.name.localeCompare(y.name));
	expect(typed, 'the designer did not record the PWA as declared (§3.2)').toEqual(expected);
}

test.describe('JAN-EXEC Phase 7 P7-1b — the five-unit rehearsal, in the gate lane', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('⭐ the §3.2 PWA, typed into the designer, publishes and runs as five units to SATISFIED — the root that produced nothing included (prediction b, REG-F-523)', async ({
		page,
		request
	}) => {
		test.setTimeout(60_000);

		// ── 0. THE DECLARATION KEEPS §3.2's PROMPT RULES — checked on the data the paid run would type ───────────────
		for (const t of PHASE7_PHASES) {
			expect(
				promptMarkers(t.prompt ?? '').filter((m) => !PHASE7_MARKERS.includes(m)),
				`${t.name}'s prompt uses a marker no work unit fills, which refuses its step at render (REG-F-507)`
			).toEqual([]);
			expect(
				renderedPrompt(t).length,
				`${t.name}'s prompt renders past what the reviewer is shown (§3.2)`
			).toBeLessThan(PHASE7_INSTRUCTION_BUDGET);
		}
		expect(
			PHASE7_PWA.types.filter((t) => t.purpose.trim() === '').map((t) => t.name),
			'a type with no purpose renders `{purpose}` empty (§3.2)'
		).toEqual([]);

		// ── 1. THE PWA, TYPED INTO THE DESIGNER AS THE OPERATOR ──────────────────────────────────────────────────────
		const pwaId = await createDraftPwa(page, request, PHASE7_PWA);
		// ⭐ THE TEST STIPULATES THE WORK PRODUCTS' REVIEW REMAINDER (`JAN-CRITREAD` J1-3): the WORK_PRODUCT arm, in the
		// body, after the reset, with the PWA's id READ FROM THE STORE. Each work product finds its PWA through artifact →
		// unit → Undertaking, so this one registration answers all four phases.
		await registerStipulation(request, pwaId, 'WORK_PRODUCT');
		await typePwuTypes(page, request, PHASE7_PWA.types);
		expectTheTypesTyped(await introspect(request), pwaId, PHASE7_PWA.types);
		await publishThroughDesigner(page, request, pwaId);
		const published = await introspect(request);
		// ⚠ A HUMAN AUTHOR, AND NO AI REVIEW OF THE PWA (the design's "In one screen"; stage 1 is P7-7's).
		expect(
			(published.pwas.find((p) => p.id === pwaId)!.state.createdBy as { actorId?: string })
				?.actorId,
			'the engine must record the operator as the PWA’s author'
		).toBe(OPERATOR);
		expect(
			published.assessments.filter((a) => ids(a.state.subjectObjectIds).includes(pwaId)),
			'a person-authored PWA publishes with no authoring floor (design §2, stage 1)'
		).toEqual([]);
		// The review gallery's view of it, laid out afresh. ⚠ UNTIL A LOAD, THE DESIGNER DRAWS NODES ON TOP OF EACH OTHER
		// (reported with P7-1b for filing; no register entry has it). Each type typed is laid out by ELK afresh, but the
		// layout effect keeps every node already drawn where it first landed and gives only the new one ELK's position
		// (`routes/pwa/[id]/+page.svelte`: *"only a genuinely new node takes ELK's computed position"*), so a new node can
		// land on a kept one. Measured by a log-only probe here, 2026-10-09: 4 overlapping pairs before this load — the root
		// over three phases, and Design and Implementation drawn at one box — and none after it.
		await gotoHydrated(page, new URL(page.url()).pathname);
		await expect(page.getByTestId('layout-engine')).toHaveText(/^Layout: /);
		await shot(page, 'the CLI Product Realization PWA, typed and published');

		// ── 2. THE UNDERTAKING: one unit per mandatory type, each phase a child of the root ─────────────────────────
		await createUndertakingThroughForm(page, UNDERTAKING);
		const created = unitsOf(await introspect(request), UNDERTAKING.name);
		expect([...created.keys()].sort(), 'instantiation did not build one unit per type').toEqual(
			PHASE7_PWA.types.map((t) => t.name).sort()
		);
		const rootId = created.get(PHASE7_ROOT.name)!.id;
		for (const t of PHASE7_PHASES)
			expect(created.get(t.name)!.state.parentWorkUnitId, `${t.name} is not under the root`).toBe(
				rootId
			);
		expect(created.get(PHASE7_ROOT.name)!.state.parentWorkUnitId ?? '').toBe('');

		// ── 3. BEGIN & EXECUTE — the root first (no model, no output), then each phase, each only after the one before
		//    has returned (`REG-F-535`: nothing else stops two running at once) ────────────────────────────────────────
		for (const t of [PHASE7_ROOT, ...PHASE7_PHASES]) {
			const ran = await beginExecute(page, t.name);
			expect(ran.type, `Begin & Execute on ${t.name} was refused: ${refusalOf(ran)}`).toBe(
				'success'
			);
			await expect(
				unitRow(page, t.name).getByRole('button', { name: 'Record Assurance', exact: true })
			).toBeVisible();
		}
		// ⭐ PREDICTION (b)'S ARRANGEMENT, READ BEFORE THE ROOT IS SIGNED OFF: its run was a TRANSFORMATION that produced
		// nothing — no output, no evidence, no work product, no exchange — and is recorded as the operator's.
		const executed = await introspect(request);
		const { planId: rootPlan, step: rootStep } = onlyStepOf(executed, rootId);
		const rootCompletions = completionsOf(executed, rootPlan, rootStep.id);
		expect(rootCompletions, 'the root’s step did not complete exactly once').toHaveLength(1);
		const done = rootCompletions[0]!;
		const producedNothing =
			rootStep.stepType === 'TRANSFORMATION' &&
			ids(done.outputArtifactIds).length === 0 &&
			ids(done.proposedEvidenceIds).length === 0 &&
			(done.noOutputResult as { reason?: string } | undefined)?.reason ===
				'NO_DOWNSTREAM_CONSUMABLE_RESULT' &&
			executed.artifacts.every((a) => a.state.producingPwuId !== rootId) &&
			executed.modelExchanges.every((x) => x.state.subjectObjectId !== rootId);
		expect(producedNothing, 'arrangement: the root’s run produced something').toBe(true);
		expect(
			(done.executionProvenance as { executedBy?: { actorId?: string } }).executedBy?.actorId,
			'the root’s TRANSFORMATION is recorded as the operator’s'
		).toBe(OPERATOR);

		// ── 4. SIGN-OFF — Record Assurance and Mark Satisfied on each phase, and on the root LAST (§3.2) ──────────────
		// ⛔ THE MUTANT, DRIVEN: conclude every declared verdict INCONCLUSIVE — this test reddens here, at the first phase's
		// Record Assurance, before the root is reached.
		for (const t of PHASE7_PHASES) await signOff(page, t.name);
		// ⭐ PREDICTION (b): A ROOT WHOSE TRANSFORMATION PRODUCED NOTHING TURNS GREEN (`REG-F-523`) — observed before
		// anything is asserted: the root's sign-off asserts neither act, and its observation is recorded first.
		// ⛔ THE MUTANT, DRIVEN: refuse the sign-off of a unit whose type a model does not run — this prediction reddens, and
		// its annotation records the refusal.
		const rootSignOff = await attemptSignOff(page, PHASE7_ROOT.name);
		recordPrediction(
			'b',
			observedSignOff(
				PHASE7_ROOT.name,
				rootSignOff,
				unitsOf(await introspect(request), UNDERTAKING.name).get(PHASE7_ROOT.name)!,
				['SATISFIED', 'SATISFIED'],
				'GREEN'
			),
			'REG-F-523 — a root whose TRANSFORMATION produced nothing is signed off green on two declared verdicts that answered no criterion'
		);
		await expect(unitRow(page, PHASE7_ROOT.name).getByText('✓ satisfied')).toBeVisible();
		await shot(page, 'five units SATISFIED');

		// ── 5. ⭐ THE END STATE, AS THE DESIGN MEASURES IT (stage 7, `REG-F-533`) ──────────────────────────────────────
		const snap = await introspect(request);
		const units = unitsOf(snap, UNDERTAKING.name);
		expect(
			[...units.entries()].map(([title, u]) => [title, ...axes(u)]).sort(),
			'every unit, the root included, SATISFIED in lifecycle and in assurance, its execution SUCCEEDED'
		).toEqual(PHASE7_PWA.types.map((t) => [t.name, 'SATISFIED', 'SATISFIED', 'SUCCEEDED']).sort());
		for (const [title, u] of units) {
			const { step } = onlyStepOf(snap, u.id);
			expect(step.stepState, `${title}'s plan step did not SUCCEED`).toBe('SUCCEEDED');
			expect(step.stepType, `${title} ran the wrong kind of step`).toBe(
				title === PHASE7_ROOT.name ? 'TRANSFORMATION' : 'MODEL_INVOCATION'
			);
		}
		// ⛔ AND THE UNDERTAKING ITSELF SAYS NOTHING (`REG-F-533`): every unit is green and its status is what creation
		// wrote. No state says its work is done, and nothing moves it.
		expect(
			snap.undertakings.find((u) => u.state.name === UNDERTAKING.name)!.state.status,
			'REG-F-533: an Undertaking has no state that says its work is done'
		).toBe('ACTIVE');

		// ── 6. EACH PHASE RAN ITS OWN PROMPT ON THE FIXTURE EXECUTOR, AND ITS WORK PRODUCT PASSED THE FLOOR ON A
		//    STIPULATION ─────────────────────────────────────────────────────────────────────────────────────────────────
		// ⚠ Every exchange is the EXECUTOR's: the declared stand-in records none (`REG-D-071`), so the review below rests
		// on the checker's two real answers and this test's stipulation — never on a model's judgement.
		expect(
			snap.modelExchanges.map((r) => str(r.state.plane)),
			'one EXECUTION exchange per phase, and nothing else'
		).toEqual(PHASE7_PHASES.map(() => 'EXECUTION'));
		for (const t of PHASE7_PHASES) {
			const unit = units.get(t.name)!;
			const exchanges = snap.modelExchanges.filter((r) => r.state.subjectObjectId === unit.id);
			expect(exchanges, `${t.name} did not run exactly one try`).toHaveLength(1);
			const type = snap.pwuTypes.find((x) => x.id === unit.state.pwuTypeId)!;
			const version = (type.state.promptTemplate as { templateVersion?: number }).templateVersion;
			expect(
				exchanges[0]!.state.promptTemplateFingerprint,
				`${t.name}'s try did not render its own type's prompt`
			).toBe(`${type.id}@v${version}`);
			// ⭐ AND THE ROUTE SENT EXACTLY `renderedPrompt(t)` — the instruction `pwa-content.ts` declares for the phase, and
			// for the end-to-end phase the one the negative control hands the reviewer (`negative-control.ts`, P7-4e).
			// ⚠ ROUND 1'S VERIFIER FOUND IT HELD ONLY BY A MODEL (2026-10-09): `verif/phase7-pwa-content.test.ts` holds
			// `renderedPrompt` to the engine's rendering of a type and a unit it builds BY HAND, so a route that built
			// either otherwise, outside `prepareModelInvocation`, left that file green. This holds it to what the route
			// built and sent: the try's recorded input, by hash and size. In this lane that record IS the instruction — a
			// first try's turn is `plan.prompt`, and the fixture executor reports no composite input of its own
			// (`run-model-step.ts`). The live lane's Pi executor records its composite (`materializedInput`), so this pin
			// is the gate's alone. ⚠ THAT EVERY REVIEW OF THE UNIT IS HANDED THE SAME `plan.prompt`, its commands' included
			// (`producingPrompt`), is READ FROM CODE, not pinned: the stand-in records no exchange of its own.
			// ⛔ THE MUTANTS, DRIVEN (2026-10-09), each type-checking clean: the route titles the step's subject with the
			// unit's id beside its title, or builds the step from its template less the output contract
			// (`undertakings/[id]/+page.server.ts`); or a first try's turn carries a line before the instruction
			// (`run-model-step.ts`). Each reddens here, at the first phase, and the other test stays green; without this
			// pin this file stayed green under all three, and so does `verif/phase7-pwa-content.test.ts`.
			const instruction = renderedPrompt(t);
			const sent = exchanges[0]!.state.materializedInputRef as
				{ status?: string; contentHash?: string; byteSize?: number } | undefined;
			expect(
				[sent?.status, sent?.contentHash, sent?.byteSize],
				`${t.name}'s try was not sent renderedPrompt's instruction for it (scripts/phase7/pwa-content.ts)`
			).toEqual([
				'STORED',
				`sha256:${createHash('sha256').update(instruction, 'utf8').digest('hex')}`,
				Buffer.byteLength(instruction, 'utf8')
			]);
			const products = snap.artifacts.filter((a) => a.state.producingPwuId === unit.id);
			expect(products, `${t.name} did not record exactly one work product`).toHaveLength(1);
			const reviews = snap.assessments.filter(
				(a) =>
					a.state.assurancePolicyId === REASONING_REVIEW &&
					ids(a.state.subjectObjectIds).includes(products[0]!.id)
			);
			expect(
				reviews.map((r) => [str(r.state.assessmentState), validatorOf(snap, r.id)]),
				`${t.name}'s work product was not passed by the declared stand-in, on the test’s stipulation`
			).toEqual([['SATISFIED', STANDIN_VALIDATOR]]);
		}

		// ── 7. ⛔ THE DECLARED POLICIES' SIGN-OFF JUDGED NOTHING (`REG-F-523`; `REG-D-102` (6)) ─────────────────────────
		// The design's 14 verdicts: two on the root, two, four, three and three on the phases. Each SATISFIED, each issued
		// by the second principal, and not one criterion answered — so a "Yes" can count none of them.
		const declared = [...units.values()].flatMap((u) => declaredVerdictsOf(snap, u));
		expect(declared, 'the design counts 14 declared verdicts (REG-D-102 (6))').toHaveLength(14);
		expect(
			declaredVerdictsOf(snap, units.get(PHASE7_ROOT.name)!)
				.map((a) => str(a.state.assurancePolicyId))
				.sort(),
			'the root’s declared policies are §3.3’s two'
		).toEqual([...PHASE7_ROOT.policyIds].sort());
		expect(
			declared.map((a) => [
				str(a.state.assessmentState),
				validatorOf(snap, a.id),
				str((a.state.evaluator as { actorId?: string } | undefined)?.actorId)
			]),
			'REG-F-523: each declared verdict is the sign-off’s SATISFIED, issued by the second principal'
		).toEqual(declared.map(() => ['SATISFIED', SIGNOFF_VALIDATOR, REVIEWER]));
		// ⛔ THE MUTANT, DRIVEN (P7-1b's verifier's first): the sign-off records each declared policy's criteria MET — this
		// count reddens.
		expect(
			criterionAnswersFor(
				snap,
				declared.map((a) => a.id)
			),
			'REG-F-523: the sign-off records no criterion result — it judges nothing'
		).toBe(0);
		// ⚠ AND IT NAMES THE OPERATOR AS EACH UNIT'S PRODUCER (`REG-F-514`), though a model did the phases' work: the
		// phases' steps name the model as their executor, and the verdicts check independence against the operator.
		expect(
			[...new Set(declared.map((a) => str((a.state.producer as { actorId?: string })?.actorId)))],
			'REG-F-514: every declared verdict records the operator as the producer'
		).toEqual([OPERATOR]);
		for (const t of PHASE7_PHASES) {
			const { planId, step } = onlyStepOf(snap, units.get(t.name)!.id);
			const executor = completionsOf(snap, planId, step.id)[0]?.executionProvenance as
				{ executedBy?: { actorType?: string } } | undefined;
			expect(executor?.executedBy?.actorType, `${t.name}'s step does not name the model`).toBe(
				'AGENT'
			);
		}
	});

	test('⛔ K1 — a phase whose review is INCONCLUSIVE can never complete (REG-F-511): the root signs off beside it (prediction a), Retry runs nothing, and Complete with no output closes its step and frees nothing (prediction c)', async ({
		page,
		request
	}) => {
		test.setTimeout(60_000);
		const PHASE = PHASE7_REQUIREMENTS.name;
		const ROOT = PHASE7_ROOT.name;

		// ── 1. THE PWA AND ITS UNDERTAKING — ⛔ NOTHING REGISTERED, so the stand-in leaves the review INCONCLUSIVE
		//    (`REG-D-071`), as a reviewer that answers no verdict would ────────────────────────────────────────────────
		const pwaId = await createDraftPwa(page, request, STUCK_PWA);
		await typePwuTypes(page, request, STUCK_PWA.types);
		expectTheTypesTyped(await introspect(request), pwaId, STUCK_PWA.types);
		await publishThroughDesigner(page, request, pwaId);
		await createUndertakingThroughForm(page, STUCK_UNDERTAKING);

		// ── 2. THE PHASE RUNS, AND ITS REVIEW STOPS IT ──────────────────────────────────────────────────────────────
		const ran = await beginExecute(page, PHASE);
		// ⛔ THE CONTROL, DRIVEN: register the stipulation for this PWA after all — the phase completes, and this reddens.
		expect(ran.type, 'arrangement: the unstipulated phase completed').toBe('failure');
		expect(refusalOf(ran), 'arrangement: the refusal is not the floor’s').toContain(
			'the assurance floor is NOT satisfied'
		);
		const stopped = await introspect(request);
		const phase = unitsOf(stopped, STUCK_UNDERTAKING.name).get(PHASE)!;
		expect(axes(phase), 'arrangement: the phase is not left EXECUTING and RUNNING').toEqual([
			'EXECUTING',
			'UNASSESSED',
			'RUNNING'
		]);
		const { planId, step } = onlyStepOf(stopped, phase.id);
		expect(step.stepState, 'arrangement: the phase’s step is not left RUNNING').toBe('RUNNING');
		const product = stopped.artifacts.find((a) => a.state.producingPwuId === phase.id);
		expect(product, 'arrangement: the try recorded no work product').toBeTruthy();
		expect(
			stopped.assessments
				.filter(
					(a) =>
						a.state.assurancePolicyId === REASONING_REVIEW &&
						ids(a.state.subjectObjectIds).includes(product!.id)
				)
				.map((a) => str(a.state.assessmentState)),
			'arrangement: the work product’s review is not INCONCLUSIVE'
		).toEqual(['INCONCLUSIVE']);
		const atStop = recordCounts(stopped);
		await expect(page.getByRole('alert')).toContainText('the assurance floor is NOT satisfied');
		await shot(page, 'the phase stopped by an INCONCLUSIVE review');

		// ── 3. ⚠ THE PAGE DOES NOT RELOAD AFTER A REFUSED ACTION — DRIVEN BY THIS SPEC'S FIRST RUN, AND IN NO REGISTER
		//    ENTRY YET (reported with P7-1b for filing) ────────────────────────────────────────────────────────────────
		// SvelteKit's `enhance` reloads a page's data only when the action succeeds; on a refusal it sets the form's error
		// and nothing else. So the row still reads PROPOSED and still offers Begin & Execute, over a unit the store holds
		// EXECUTING with its step RUNNING. `REG-F-513`'s *"The professional sees a unit EXECUTING, RUNNING and UNASSESSED"*
		// holds only once the page is loaded again.
		const phaseRow = unitRow(page, PHASE);
		// ⛔ THE MUTANT, DRIVEN: reload the page's data after a refused Begin & Execute — this reddens.
		await expect(
			phaseRow.getByRole('cell', { name: 'PROPOSED', exact: true }),
			'the page reloaded after the refused Begin & Execute — this pin is then obsolete'
		).toBeVisible();
		// ⛔ AND THE STALE OFFER CANNOT RUN THE UNIT AGAIN (`REG-F-511`): its batch opens with `BeginPwuShaping`, which
		// admits only a PROPOSED unit, so the press is refused before anything is tried or reviewed.
		const again = await beginExecute(page, PHASE);
		expect(again.type, 'REG-F-511: a second Begin & Execute was accepted on a stopped unit').toBe(
			'failure'
		);
		expect(
			refusalOf(again),
			'REG-F-511: the second press is not refused at BeginPwuShaping'
		).toContain('Execution failed: BeginPwuShaping');
		expect(recordCounts(await introspect(request)), 'the second press tried something').toEqual(
			atStop
		);

		// ── 4. ⛔ K1 ON THE PAGE AS THE OPERATOR NEXT LOADS IT (`REG-F-511`): Begin & Execute is not offered again, and
		//    Record Assurance is refused ─────────────────────────────────────────────────────────────────────────────────
		await gotoHydrated(page, new URL(page.url()).pathname);
		await page.getByRole('button', { name: 'overview', exact: true }).click();
		await expect(phaseRow.getByRole('cell')).toHaveText([
			PHASE,
			'EXECUTING',
			'RUNNING',
			'UNASSESSED',
			`${PHASE} ↗`,
			/Record Assurance/
		]);
		// ⛔ THE MUTANT, DRIVEN: offer Begin & Execute on an EXECUTING row too — this reddens; the five-unit test stays green.
		await expect(
			phaseRow.getByRole('button', { name: 'Begin & Execute', exact: true }),
			'REG-F-511: Begin & Execute is offered only on a PROPOSED unit'
		).toHaveCount(0);
		const refused = await recordAssurance(page, PHASE);
		expect(refused.type, 'REG-F-511: Record Assurance was accepted on a RUNNING unit').toBe(
			'failure'
		);
		// ⛔ THE MUTANT, DRIVEN: conclude every declared verdict INCONCLUSIVE — the refusal then names the sign-off, not the
		// hop, and this reddens. The reason is held, not only the refusal.
		expect(
			refusalOf(refused),
			'REG-F-511: the refusal is not the hop to SUCCEEDED that cites no plan'
		).toContain('with no execution plan evidencing it');
		expect(
			recordCounts(await introspect(request)),
			'a refused sign-off left records behind'
		).toEqual(atStop);

		// ── 5. ⭐ PREDICTION (a): THE ROOT IS SIGNED OFF WHILE ITS CHILD IS STUCK ─────────────────────────────────────
		const rootRan = await beginExecute(page, ROOT);
		expect(rootRan.type, `Begin & Execute on the root was refused: ${refusalOf(rootRan)}`).toBe(
			'success'
		);
		await expect(
			unitRow(page, ROOT).getByRole('button', { name: 'Record Assurance', exact: true })
		).toBeVisible();
		// ⭐ OBSERVED BEFORE ANYTHING IS ASSERTED, as (b) is: the root's sign-off asserts neither act, and its observation —
		// a refusal included — is recorded before it is held to the prediction.
		// ⛔ THE MUTANT, DRIVEN: refuse a unit's sign-off while a child of it is unsatisfied — this prediction reddens, its
		// annotation the refusal, and the five-unit test, which signs its root off last, stays green. Refusing the sign-off
		// of a unit whose type a model does not run reddens it here too, and the five-unit test with it.
		const rootSignOff = await attemptSignOff(page, ROOT);
		const signed = unitsOf(await introspect(request), STUCK_UNDERTAKING.name);
		recordPrediction(
			'a',
			observedSignOff(
				ROOT,
				rootSignOff,
				signed.get(ROOT)!,
				['SATISFIED', 'SATISFIED', 'SUCCEEDED'],
				'ALLOWED'
			),
			'nothing gates a parent’s sign-off on its children — recomposition is undispatched in production (REG-F-041) — so a SATISFIED root is not a finished Undertaking (REG-F-533)'
		);
		await expect(unitRow(page, ROOT).getByText('✓ satisfied')).toBeVisible();
		expect(axes(signed.get(PHASE)!), 'arrangement: the child is no longer stuck').toEqual([
			'EXECUTING',
			'UNASSESSED',
			'RUNNING'
		]);

		// ── 6. ⛔ K1: RETRY RUNS NOTHING (`REG-F-511`; `REG-F-520`) ──────────────────────────────────────────────────
		// The stopped step is RUNNING, where the page offers Complete and Fail and no Retry. The operator fails it so
		// Retry is offered; Retry re-queues it and Start runs it again — and neither executes nor reviews anything.
		// ⚠ MEASURED FROM HERE, NOT FROM THE STOP: the root's sign-off above added its own three assessments.
		const beforeRetry = recordCounts(await introspect(request));
		await page.getByRole('button', { name: 'execution', exact: true }).click();
		const group = page
			.getByTestId('exec-pwu-group')
			.filter({ has: page.getByRole('heading', { name: new RegExp(`^${escapeRegExp(PHASE)} `) }) });
		const stepRow = group.getByTestId('exec-step');
		const stepState = stepRow.getByTestId('step-state');
		await expect(stepState).toHaveText('RUNNING');
		await expect(stepRow.getByTestId('step-action-complete')).toBeVisible();
		// ⭐ `REG-F-466`'s STEP RETRY, ANSWERED FOR THIS REFUSAL. It says *"whether it is offered beside a substitution's
		// refusal was not driven"*: beside a refusal that leaves the step RUNNING, Retry is not offered — driven here for
		// an INCONCLUSIVE review. A substitution's refusal leaves the step RUNNING through the same return, the
		// `fail(400)` after a refused `CompleteExecutionStep` (`[id]/+page.server.ts`): read from code, not driven.
		await expect(
			stepRow.getByTestId('step-action-retry'),
			'REG-F-466: Retry is offered beside a refused completion, on a RUNNING step'
		).toHaveCount(0);
		for (const [action, testId, after] of [
			['failStep', 'step-action-fail', 'FAILED'],
			['retryStep', 'step-action-retry', 'QUEUED'],
			['startStep', 'step-action-start', 'RUNNING']
		] as const) {
			const moved = await pressAction(page, action, stepRow.getByTestId(testId));
			expect(moved.type, `${action} was refused: ${refusalOf(moved)}`).toBe('success');
			await expect(stepState).toHaveText(after);
		}
		const afterRetry = await introspect(request);
		expect(
			recordCounts(afterRetry),
			'REG-F-511: Retry or Start executed or reviewed something — no try, no work product, no review was added'
		).toEqual(beforeRetry);
		expect(
			completionsOf(afterRetry, planId, step.id),
			'nothing completed the re-queued step'
		).toEqual([]);
		await page.getByRole('button', { name: 'overview', exact: true }).click();
		await expect(
			phaseRow.getByRole('button', { name: 'Begin & Execute', exact: true }),
			'REG-F-511: a retried unit is offered Begin & Execute again'
		).toHaveCount(0);
		const stillRefused = await recordAssurance(page, PHASE);
		expect(stillRefused.type, 'REG-F-511: after Retry, Record Assurance was accepted').toBe(
			'failure'
		);

		// ── 7. ⭐ PREDICTION (c): COMPLETE WITH NO OUTPUT CLOSES THE STEP — AND FREES NOTHING ─────────────────────────
		await page.getByRole('button', { name: 'execution', exact: true }).click();
		await expect(stepRow.getByTestId('complete-output')).toHaveValue('');
		await expect(stepRow.getByTestId('complete-ai')).not.toBeChecked();
		// ⛔ THE MUTANT, DRIVEN: refuse a completion that names no output — this prediction reddens, its observation the
		// refusal.
		const completed = await pressAction(
			page,
			'completeStep',
			stepRow.getByTestId('step-action-complete')
		);
		const closed = await introspect(request);
		const completions = completionsOf(closed, planId, step.id);
		recordPrediction(
			'c',
			completed.type === 'success' && completions.length === 1
				? 'ADMITTED'
				: `${completed.type}: ${refusalOf(completed)}`,
			'the zero-subject rule admits a no-output completion of a model step whose structured result is empty (REG-F-520)'
		);
		await expect(stepState).toHaveText('SUCCEEDED');
		await shot(page, 'the stuck phase’s step closed by hand, with no output');
		const closing = completions[0]!;
		// ⚠ THE LEVER DISCARDS RATHER THAN REPAIRS (`REG-F-520`): the completion names neither the work product the
		// try recorded nor any evidence, and records the operator as the executor of a model's step.
		expect(
			[ids(closing.outputArtifactIds), ids(closing.proposedEvidenceIds)],
			'REG-F-520: the hand completion names an output or evidence'
		).toEqual([[], []]);
		expect(
			(closing.executionProvenance as { executedBy?: { actorId?: string; actorType?: string } })
				.executedBy,
			'REG-F-520: the hand completion does not record the operator as the executor'
		).toMatchObject({ actorId: OPERATOR, actorType: 'HUMAN' });
		// ⛔ AND THE UNIT IS STILL STUCK (`REG-F-511`): no page action moves its execution state, so the sign-off's hop
		// to SUCCEEDED still cites no plan, and only Abandon remains.
		expect(
			axes(unitsOf(closed, STUCK_UNDERTAKING.name).get(PHASE)!),
			'REG-F-511: a hand completion moved the unit'
		).toEqual(['EXECUTING', 'UNASSESSED', 'RUNNING']);
		await page.getByRole('button', { name: 'overview', exact: true }).click();
		const neverAssured = await recordAssurance(page, PHASE);
		expect(
			neverAssured.type,
			'REG-F-511: after a hand completion, Record Assurance was accepted'
		).toBe('failure');
		expect(refusalOf(neverAssured)).toContain('with no execution plan evidencing it');
		await expect(
			phaseRow.getByRole('button', { name: 'Abandon', exact: true }),
			'REG-F-511: the way out is Abandon'
		).toBeVisible();
	});
});
