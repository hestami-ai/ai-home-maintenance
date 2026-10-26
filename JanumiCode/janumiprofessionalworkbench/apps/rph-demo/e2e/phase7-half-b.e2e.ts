import { expect } from '@playwright/test';
import { test, resetEngine, introspect, registerStipulation, gotoHydrated } from './support/harness';
import { actionFields, createDraftPwa, createUndertakingThroughForm, unitRowById } from './support/phase7-pwa';
import {
	acceptCandidate,
	authoringRecordOf,
	authorThePwa,
	beginExecute,
	designerAct,
	agentTurnOn,
	markSatisfied,
	openLane,
	recordAssurance,
	startOfferOf,
	turnRunning,
	unitStateOf,
	PHASE7_UNDERTAKING,
	type AuthoringHands,
	type RunRecord
} from '../e2e-live-exec/phase7-operator';
import { PHASE7_HALF_B_DRAFT } from '../../../scripts/phase7/half-b';
import {
	phase7AuthoringAllowanceMs,
	phase7AuthoringReviewAllowance,
	phase7RecordAssuranceMs
} from '../e2e-live-exec/lane-config';

// ⭐⭐ `JAN-EXEC` Phase 7 completion programme, E3 (C6) — HALF B'S TURN, REHEARSED IN THE GATE WITH THE MOCK AGENT
// (`docs/_working/DESIGN-phase-7-completion.md` §4 C6: *"The turn itself is rehearsed in the gate with the mock agent,
// with stipulations only under `e2e/` (`REG-F-477`)"*).
//
// The paid half B (`e2e-live-exec/phase7.live.ts` with `JPWB_PHASE7_HALF=B`) asks the live agent for the PWA; its dry run
// stops before Send, because authoring is a model call. So nothing would show its turn → accept → publish → run path
// working until a paid run. This spec drives THE OPERATOR'S OWN ORDER (`authorThePwa`) on the REAL PAGE, through the same
// acts the live spec hands it — `agentTurnOn`, `turnRunning`, `acceptCandidate`, `designerAct` — with the deterministic
// mock agent in the author's seat, whose JSON plan scaffolds an agent-shaped PWA, then presses Begin & Execute on each
// unit in the order the operator read from the PUBLISHED PWA (C2).
// ⚠ IT IS A REHEARSAL OF THE LANE'S MACHINERY, NOT EVIDENCE OF AN AGENT: the plan is written here, the floor's reasoning
// review and the work products' are STIPULATED (the declared stand-in answers what the structural checker cannot judge,
// recorded as not judged — `JAN-CRITREAD` J1-3), and the fixture executor does the model's work. ⛔ The stipulation lives
// HERE, under `e2e/`, never under `e2e-live/` or `e2e-live-exec/` (`REG-F-477`).
// ⭐ AND THE PLAN CARRIES TWO OF C4'S TRAPS, so the gate sees the checks record and refuse nothing (`REG-D-110` (4)): a leaf
// whose discharge is UNDECLARED (`REG-F-505`), which then runs as a TRANSFORMATION with no model; and a policy scoped to
// another kind (`REG-F-524`).

/** The mock agent's plan: a root over two phases, scaffolded atomically (`scaffold_graph`), the children in tree order. */
const PLAN = {
	plan: [
		{
			tool: 'scaffold_graph',
			args: {
				types: [
					{
						tempKey: 'root',
						name: 'wordfreq Realization',
						pwuKind: 'PRODUCT_REALIZATION',
						purpose: 'Realize wordfreq from its requirements to its verification.',
						isRoot: true,
						workDischarge: 'HUMAN',
						requiredAssurancePolicyIds: ['pol_intent_preservation'],
						childTempKeys: ['specify', 'verify']
					},
					{
						tempKey: 'specify',
						name: 'Specify wordfreq',
						pwuKind: 'REQUIREMENT_DEFINITION',
						purpose: 'Write the numbered requirements of wordfreq.',
						workDischarge: 'MODEL',
						promptTemplateText: 'Write {subject} for wordfreq, the command-line tool: {purpose}',
						promptOutputContract: 'A JSON object whose workProduct holds the requirements document in full.',
						promptActive: true,
						requiredAssurancePolicyIds: ['pol_requirement_coverage']
					},
					{
						// ⭐ THE TRAPS: no discharge declared (REG-F-505), and a policy scoped to another kind (REG-F-524).
						tempKey: 'verify',
						name: 'Verify wordfreq',
						pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
						purpose: 'Run the real tool against its acceptance scenarios.',
						requiredAssurancePolicyIds: ['pol_requirement_coverage']
					}
				]
			}
		}
	]
};

test.describe('Phase 7 half B — the turn, accepted, published and run, through the operator’s own order (E3, C6)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('⭐ draft → Send → the candidate’s status → Accept → Submit, Validate, Publish → the units from the published PWA, each the page offers run and signed off in turn, the root waiting for its children (package M)', async ({
		page,
		request
	}) => {
		test.setTimeout(180_000);
		const lane = openLane(test.info().outputPath('half-b-lane'));
		const record: RunRecord = {
			mode: 'paid',
			half: 'B',
			units: [],
			authoring: authoringRecordOf(JSON.stringify(PLAN), null),
			dryRun: null,
			end: null,
			problems: []
		};
		let pwaId = '';
		const turn = agentTurnOn(page);
		const author: AuthoringHands = {
			createDraft: async () => {
				pwaId = await createDraftPwa(page, request, PHASE7_HALF_B_DRAFT);
				// ⭐ STIPULATED HERE, IN THE BODY, WITH THE ID READ FROM THE STORE (`JAN-CRITREAD` J1-3): the review of each type
				// of the graph (⭐ the review in parts, `REG-D-125`) and the work products', so the declared stand-in answers what the structural checker cannot judge.
				await registerStipulation(request, pwaId, 'PWA_TYPE');
				await registerStipulation(request, pwaId, 'WORK_PRODUCT');
				// ⭐ Package M (D6) — and each unit's declared policies, since each pressed unit is now signed off before the next press.
				await registerStipulation(request, pwaId, 'DECLARED_POLICY');
				return pwaId;
			},
			send: (instruction) => turn.send(instruction),
			turnRunning: () => turnRunning(page),
			producerLine: () => turn.producer(),
			accept: () => acceptCandidate(page, actionFields),
			lifecycle: (act) => designerAct(page, act, actionFields),
			createUndertaking: () => createUndertakingThroughForm(page, PHASE7_UNDERTAKING),
			pause: (ms) => page.waitForTimeout(ms),
			now: () => Date.now()
		};
		const read = async () => {
			const snapshot = await introspect(request);
			return { text: JSON.stringify(snapshot), snapshot };
		};

		const authored = await authorThePwa({
			record,
			authoring: record.authoring!,
			author,
			read,
			lane,
			dry: false,
			undertakingName: PHASE7_UNDERTAKING.name,
			// ⭐ `REG-D-112` (finding 2) — the limit before Send counts the calls spent before: none, in the gate.
			prior: 0
		});
		if ('end' in authored) throw new Error(`the half-B order did not reach the units: ${JSON.stringify(authored.end)}`);
		const a = record.authoring!;

		// ── C1: what the lane recorded of the turn ──────────────────────────────────────────────────────────────────
		expect([a.sent, a.candidate?.status, a.accept?.envelopeType, a.published]).toEqual([
			true,
			'READY_TO_COMMIT',
			'success',
			true
		]);
		expect(a.accept?.acceptedHash, 'the hash accepted is not the candidate’s').toBe(a.candidate?.candidateHash);
		// ⭐ `REG-D-112` (finding 2) — the limit was checked before Send, ~~the authoring floor's worst case counted ⭐ (the review in
		// parts, B6) for the inventory anticipated, sixteen types~~ ⭐ MOVED DELIBERATELY by package L2 — D20 (`REG-F-580`): the
		// allowance the lane hands the authoring review counted — the limit less none spent before and the negative control's 4,
		// so the check reaches the limit. ⚠ This gate's server is handed no allowance (`playwright.config.ts`): the lane's count is
		// rehearsed here, the server's bound in `floor-allowance.test.ts` and `authoring-route-allowance.test.ts`.
		expect(a.limitCheck, 'the limit before Send').toMatchObject({
			prior: 0,
			ahead: phase7AuthoringReviewAllowance(0),
			total: 2400,
			allowed: true
		});
		expect(a.floor.map((f) => f.state), 'the authoring floor, as the turn’s fork held it').toEqual([
			'SATISFIED',
			'SATISFIED',
			'SATISFIED'
		]);
		// ⭐ B6 — and its Reasoning Review is one round's complete part set, read off the fork as the real page staged it: the plan's
		// three types, each reviewed; the wait's allowance theirs; and ~~, three being fewer than anticipated,~~ no second count of
		// Send's (⛔ package L2, D20: Send counts the allowance, and no inventory is counted again).
		expect(
			a.floor.find((f) => f.policyId === 'floor.reasoning-review')?.parts?.map((p) => [p.typeName, p.state]),
			'the authoring floor’s parts, as the turn’s fork held them'
		).toEqual([
			['wordfreq Realization', 'SATISFIED'],
			['Specify wordfreq', 'SATISFIED'],
			['Verify wordfreq', 'SATISFIED']
		]);
		expect([a.parts, a.allowanceMs, a.inventoryCheck]).toEqual([3, phase7AuthoringAllowanceMs(3), null]);
		// ⭐ C3 — THE AUTHOR, AS THE TURN'S OWN STREAM NAMED IT: the mock's declared identity. ⚠ The floor's assessments name no
		// producer (found by this rehearsal's first run: each read null), and the page's log loses its status line when the
		// turn ends (its second), so the stream is the one place it is said.
		expect(a.authorModel.resolved, 'the turn’s stream named no producer').toBe('jpwb-mock/mock-structural');
		expect(a.floor.map((f) => f.producer), 'the floor now names its producer: read it from the store').toEqual([null, null, null]);
		expect(a.lifecycle.map((x) => [x.act, x.envelopeType])).toEqual([
			['submitForReview', 'success'],
			['validate', 'success'],
			['publish', 'success']
		]);
		// ⭐ C4 — the two traps found, and NOTHING REFUSED: the PWA published, and runs below.
		expect(a.checks?.refused).toBe(false);
		expect(a.checks?.findings.map((f) => [f.check, f.typeName])).toEqual([
			['model-leaf', 'Verify wordfreq'],
			['policy-governs', 'Verify wordfreq']
		]);

		// ── C2: the units, read from the PUBLISHED PWA — the root first, then the tree's order ──────────────────────
		expect(record.units.map((u) => [u.order, u.slug, u.title])).toEqual([
			[1, 'root', 'wordfreq Realization'],
			[2, 'specify-wordfreq', 'Specify wordfreq'],
			[3, 'verify-wordfreq', 'Verify wordfreq']
		]);
		// ⭐ `REG-D-112` (finding 5) — the rows BY ID, and each unit's id in the record from the start.
		const rows = authored.rows;
		expect(record.units.map((u) => rows.get(u.unitId!)?.state.title)).toEqual(record.units.map((u) => u.title));
		const idOf = (title: string): string => record.units.find((u) => u.title === title)!.unitId!;
		// ⭐ `REG-D-112` (finding 5) — THE OVERVIEW'S ROW IS FOUND BY ITS UNIT'S ID, one row each: the attribute the lane's every
		// act on a unit relies on (`unitRowById`), asked before anything is pressed.
		for (const unit of record.units)
			await expect(unitRowById(page, unit.unitId!), `the overview’s row for ${unit.title}, by its id`).toHaveCount(1);

		// ── ~~Each unit run in that order~~ ⭐ Each unit THE PAGE OFFERS run, the tree's order breaking ties: Begin & Execute pressed
		// by the operator's own act ON ITS ROW BY ID — the overview's row carries its unit's id (`data-pwu-id`) — the store read
		// after ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
		// ⛔ MOVED BY `JAN-EXEC` Phase 7, package M (`REG-D-135` (2); design D2, D3, D6, D7): the root, pressed first here, waits for
		// its two children to be ACCEPTED; each pressed unit is signed off — Record Assurance, then Mark Satisfied — before the
		// next press (D6). The plan declares no data flow, so the leaves wait for nothing.
		const rowOf = (title: string) => unitRowById(page, idOf(title));
		const offers = async () =>
			Object.fromEntries(
				await Promise.all(record.units.map(async (u) => [u.title, await startOfferOf(rowOf(u.title))] as const))
			);
		expect(await offers(), 'D3: before any press, the page offers each leaf and withholds the root').toEqual({
			'wordfreq Realization': {
				offered: false,
				reason: 'it waits for "Specify wordfreq" (PROPOSED) and "Verify wordfreq" (PROPOSED) to be accepted',
				kinds: ['waiting']
			},
			'Specify wordfreq': { offered: true, reason: null, kinds: [] },
			'Verify wordfreq': { offered: true, reason: null, kinds: [] }
		});
		const run = async (title: string) => {
			const ran = await beginExecute(page, rowOf(title), actionFields);
			expect(ran.envelopeType, `Begin & Execute on ${title}: ${ran.rawBody ?? ''}`).toBe('success');
			const after = unitStateOf(await introspect(request), idOf(title));
			expect([after.executionState, after.planStepState], title).toEqual(['SUCCEEDED', 'SUCCEEDED']);
		};
		const assure = (title: string) => recordAssurance(page, rowOf(title), actionFields, phase7RecordAssuranceMs(1));
		// The MODEL leaf, its work product's review and its declared policy stipulated: signed off.
		await run('Specify wordfreq');
		const specifyAssured = await assure('Specify wordfreq');
		expect(specifyAssured?.envelopeType, `Record Assurance on Specify wordfreq: ${specifyAssured?.rawBody ?? ''}`).toBe('success');
		const specifyGreen = await markSatisfied(page, rowOf('Specify wordfreq'), actionFields);
		expect(specifyGreen.envelopeType, `Mark Satisfied on Specify wordfreq: ${specifyGreen.rawBody ?? ''}`).toBe('success');
		// ⭐ THE TRAPS' LEAF: it ran a TRANSFORMATION with no model (`REG-F-505`), and its one declared policy is scoped to
		// another kind (`REG-F-524`), so the kernel's fold composes UNASSESSED over it and refuses SATISFIED — observed, the
		// first run of this rehearsal (2026-10-26). It is never accepted.
		await run('Verify wordfreq');
		const verifyAssured = await assure('Verify wordfreq');
		expect(verifyAssured?.envelopeType, 'the trap leaf’s sign-off was accepted').toBe('failure');
		expect(String(verifyAssured?.decoded?.error ?? verifyAssured?.rawBody)).toContain(
			'yields composed disposition UNASSESSED, which does not support SATISFIED'
		);
		// ⭐ AND SO THE ROOT, WAITING FOR IT, IS NEVER OFFERED (D2, D4): the page, loaded afresh, names the leaf it waits for.
		await gotoHydrated(page, new URL(page.url()).pathname);
		await page.getByRole('button', { name: 'overview', exact: true }).click();
		expect(await startOfferOf(rowOf('wordfreq Realization')), 'D3: the root was offered beside an unaccepted child').toEqual({
			offered: false,
			reason: 'it waits for "Verify wordfreq" (EXECUTING) to be accepted',
			kinds: ['waiting']
		});
		expect(unitStateOf(await introspect(request), idOf('wordfreq Realization')).lifecycleState).toBe('PROPOSED');
		// ⭐ THE TRAP PLAYED OUT LIVE (REG-D-110 (4)): the UNDECLARED leaf completed with NO model run — the false "Yes" the
		// run report now reads as a break (C5) — while the MODEL leaf's try is recorded.
		const exchanges = (await introspect(request)).modelExchanges.filter((x) => x.state.plane === 'EXECUTION');
		const triesOf = (title: string) => exchanges.filter((x) => x.state.subjectObjectId === idOf(title)).length;
		expect([triesOf('Specify wordfreq') > 0, triesOf('Verify wordfreq')]).toEqual([true, 0]);
	});
});
