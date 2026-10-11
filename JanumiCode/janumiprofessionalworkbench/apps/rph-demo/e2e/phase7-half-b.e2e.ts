import { expect } from '@playwright/test';
import { test, resetEngine, introspect, registerStipulation } from './support/harness';
import { actionFields, createDraftPwa, createUndertakingThroughForm, unitRow } from './support/phase7-pwa';
import {
	acceptCandidate,
	authoringRecordOf,
	authorThePwa,
	beginExecute,
	designerAct,
	agentTurnOn,
	openLane,
	turnRunning,
	unitStateOf,
	PHASE7_UNDERTAKING,
	type AuthoringHands,
	type RunRecord
} from '../e2e-live-exec/phase7-operator';
import { PHASE7_HALF_B_DRAFT } from '../../../scripts/phase7/half-b';

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

	test('⭐ draft → Send → the candidate’s status → Accept → Submit, Validate, Publish → the units from the published PWA, each run in tree order', async ({
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
				// ⭐ STIPULATED HERE, IN THE BODY, WITH THE ID READ FROM THE STORE (`JAN-CRITREAD` J1-3): the graph's review and
				// the work products', so the declared stand-in answers what the structural checker cannot judge.
				await registerStipulation(request, pwaId, 'PWA_GRAPH');
				await registerStipulation(request, pwaId, 'WORK_PRODUCT');
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
			undertakingName: PHASE7_UNDERTAKING.name
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
		expect(a.floor.map((f) => f.state), 'the authoring floor, as the turn’s fork held it').toEqual([
			'SATISFIED',
			'SATISFIED',
			'SATISFIED'
		]);
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
		const rows = authored.rows;

		// ── Each unit run in that order: Begin & Execute pressed by the operator's own act, the store read after ──────
		for (const unit of record.units) {
			const ran = await beginExecute(page, unitRow(page, unit.title), actionFields);
			expect(ran.envelopeType, `Begin & Execute on ${unit.title}: ${ran.rawBody ?? ''}`).toBe('success');
			const after = unitStateOf(await introspect(request), rows.get(unit.title)!.id);
			expect([after.executionState, after.planStepState], unit.title).toEqual(['SUCCEEDED', 'SUCCEEDED']);
		}
		// ⭐ THE TRAP PLAYED OUT LIVE (REG-D-110 (4)): the UNDECLARED leaf completed with NO model run — the false "Yes" the
		// run report now reads as a break (C5) — while the MODEL leaf's try is recorded.
		const exchanges = (await introspect(request)).modelExchanges.filter((x) => x.state.plane === 'EXECUTION');
		const triesOf = (title: string) => exchanges.filter((x) => x.state.subjectObjectId === rows.get(title)!.id).length;
		expect([triesOf('Specify wordfreq') > 0, triesOf('Verify wordfreq')]).toEqual([true, 0]);
	});
});
