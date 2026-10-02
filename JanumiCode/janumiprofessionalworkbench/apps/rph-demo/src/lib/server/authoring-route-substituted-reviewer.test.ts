// ⭐ `JAN-SELRES` RS-2 (D7; `REG-F-460`) — THE AUTHORING ROUTE HOLDS A REFUSED SUBSTITUTE AS AN EXTERNAL BLOCK, NEVER AS
// WORK FOR THE PRODUCER.
//
// ⛔ WHAT IS AT STAKE. `applyFloorDisposition` (`routes/pwa/[id]/agent/+server.ts`) decides whether an unsatisfied floor
// is the reviewer's problem (`BLOCKED_EXTERNAL`) or the candidate's (`REVISION_REQUIRED`). It enumerated the operational
// actions with three `===` comparisons, so an action added to `FloorRemediationAction` and missed there would mark a
// refused review REVISION_REQUIRED — a defect in the candidate, for a review nobody the sponsor selected gave. Its test
// is now `isOperationalRemediation`, an exhaustive switch (`floor.ts`); this file holds the ROUTE to it.
//
// ⭑ THE PRODUCTION COMPOSITION, END TO END. The route is POSTed in-process in test mode: the deterministic mock agent
// authors, and the floor runs the product's own devin branch (`JPWB_ASSURANCE_TOOL=devin` with a model — test mode
// admits a NAMED tool, `reviewer-selection.ts`). Only devin's PROGRAM is replaced: `devinPrint` is the real adapter
// handed an exec seam that writes the ATIF export devin writes, naming the model it reports having run.
//
// ⛔ HERMETIC. The exec seam starts nothing and PATH finds no program, so no case can reach a real devin; the agent is
// the mock (test mode, `JPWB_AGENT` unset).
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What devin's exec seam was handed, and the model the next call reports. Hoisted: the mock factory runs first. */
const seam = vi.hoisted(() => ({
	calls: [] as { readonly file: string; readonly args: readonly string[] }[],
	reported: '',
	answer: ''
}));

// ⭑ THE REAL ADAPTER, ITS PROGRAM REPLACED AT THE SEAM — so the reported model is read back from the export exactly as
// `readReportedModel` reads a real one, and `execFile` is never reached.
vi.mock('./tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (file, args) => {
				seam.calls.push({ file, args: [...args] });
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: seam.reported } }] }),
						'utf8'
					);
				return { stdout: seam.answer };
			})
		)
	};
});

import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { load } from '../../routes/pwa/[id]/+page.server.js';
import { clearingJudgement } from './assurance/clearing-reviewer.testing.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { clearAuthoringTurns, getPendingAuthoringTurn } from './authoring-turn.js';
import { loadPwaFloor, type FloorBlockedHint, type FloorView } from './floor.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];
type LoadEvent = Parameters<typeof load>[0];
interface StreamedEvent {
	readonly kind: string;
	readonly text?: string;
	readonly message?: string;
}

const CONFIGURED = 'fixture-devin-model';
/** D7's guidance, verbatim (`DESIGN-the-selection-residuals.md` D7). */
const REQUALIFY_OR_RESELECT_GUIDANCE =
	'PublishPwa remains blocked because the reviewing tool reported that a model other than the configured and selected one answered, so the review was refused. Retrying or reconfiguring the same selection does not fix this: another call is billed and may be served the same way. The remedy is a sponsor decision: re-qualify the model the tool actually serves and select it, or re-select the reviewer (REG-D-084, REG-D-086); then configure the host to the new selection. Do not revise the PWA or record a waiver in response to this refusal.';

/** A DRAFT PWA to author — the only kind the route opens a turn on. */
function draftPwa(): string {
	const pwaId = mintUiId('pwa');
	const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Substituted reviewer fixture',
		description: 'A DRAFT PWA whose review is answered by a model nobody selected.',
		domain: 'software',
		version: '0.1.0'
	});
	expect(r.status, `arrangement: CreatePwa — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	return pwaId;
}

/** A devin answer faulting one criterion — a genuine SUBJECT finding, which the route marks REVISION_REQUIRED. */
const subjectRejection = (): string =>
	JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
			criterionId: c.id,
			failed: i === 0,
			statement: i === 0 ? 'The graph substitutes an easier problem.' : 'evaluated; absent'
		})),
		recommendation: 'REJECTED',
		residualUncertainty: []
	});

/** The PWA page's load event, as the route test calls it in-process. */
const loadEvent = (pwaId: string): LoadEvent => ({ params: { id: pwaId } }) as unknown as LoadEvent;

/** What the page's load hands the floor panel, read in-process as the browser's request reads it. */
async function loadThePage(
	pwaId: string
): Promise<{ floor?: FloorView; floorBlockedHint?: FloorBlockedHint }> {
	return (await load(loadEvent(pwaId))) as {
		floor?: FloorView;
		floorBlockedHint?: FloorBlockedHint;
	};
}

/** A floor policy's disposition and recorded codes on the floor the page shows — the arrangement a case rests on. */
const policyOn = (floor: FloorView | undefined, policyId: string) => {
	const policy = floor?.policies.find((p) => p.policyId === policyId);
	return (
		policy && { disposition: policy.disposition, codes: policy.observations.map((o) => o.code) }
	);
};

/** A JSON plan the mock agent runs verbatim (`agent/mock-agent.ts`) — the e2e's root-only scaffold. ONE root: the graph
 *  is well formed, and the schema/invariant policy passes it. */
const ROOT_ONLY_PLAN = JSON.stringify({
	plan: [
		{
			tool: 'scaffold_graph',
			args: { types: [{ tempKey: 'plan', name: 'Plan', pwuKind: 'PLAN', isRoot: true }] }
		}
	]
});

/** TWO roots: the graph is not well formed, and the schema/invariant policy REJECTS it (`PWA_GRAPH_NOT_WELL_FORMED`) —
 *  a defect in the graph, which revising answers. */
const TWO_ROOTS_PLAN = JSON.stringify({
	plan: [
		{
			tool: 'scaffold_graph',
			args: {
				types: [
					{ tempKey: 'a', name: 'Plan A', pwuKind: 'PLAN', isRoot: true },
					{ tempKey: 'b', name: 'Plan B', pwuKind: 'PLAN', isRoot: true }
				]
			}
		}
	]
});

/** POST the route in-process and read its whole Server-Sent Event stream. Without an instruction, the mock agent runs
 *  its canned script — whose graph the schema/invariant policy REJECTS on the reference seed. */
async function postInstruction(
	pwaId: string,
	instruction = 'Author a minimal product realization graph.'
): Promise<StreamedEvent[]> {
	const response = await POST({
		params: { id: pwaId },
		request: new Request(`http://localhost/pwa/${pwaId}/agent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ instruction })
		})
	} as unknown as RouteEvent);
	const body = await response.text();
	return body
		.split('\n\n')
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as StreamedEvent);
}

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	seam.calls.length = 0;
	seam.reported = '';
	seam.answer = '';
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL', 'JPWB_AGENT'])
		vi.stubEnv(v, undefined);
	// ⭑ THE SELECTED REVIEWER, NAMED — test mode admits it, so the floor runs devin's branch, not the stand-in.
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', CONFIGURED);
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
});

describe('⭐ D7 — a review refused for a substituted model blocks the turn EXTERNALLY, with D7’s guidance', () => {
	it('⛔ devin reports another model: the staged candidate is BLOCKED_EXTERNAL, never REVISION_REQUIRED, and the operator is told to re-qualify or re-select', async () => {
		seam.reported = 'substituted-model';
		seam.answer = clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId);

		expect(events.at(-1)?.kind).toBe('done');
		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		expect(seam.calls[0]!.args.slice(0, 3)).toEqual(['--print', '--model', CONFIGURED]);
		const turn = getPendingAuthoringTurn(pwaId);
		expect(turn, 'the refused turn left no staged candidate').toBeDefined();
		expect(turn!.status, 'a refused substitute was recorded as a defect in the candidate').toBe(
			'BLOCKED_EXTERNAL'
		);
		expect(turn!.detail).toBe(REQUALIFY_OR_RESELECT_GUIDANCE);
		expect(
			events.filter((e) => e.kind === 'status').map((e) => e.text),
			'the operator was not shown D7’s guidance'
		).toContain(`⚠ ${REQUALIFY_OR_RESELECT_GUIDANCE}`);
	});

	it('⭑ CONTROL — the SAME route, devin reporting the configured model and faulting a criterion, marks REVISION_REQUIRED', async () => {
		// Without this, "BLOCKED_EXTERNAL" above could hold because the route marks every unsatisfied floor external: here
		// a genuine subject finding must reach the other arm through the same POST, the same reviewer and the same observer.
		seam.reported = CONFIGURED;
		seam.answer = JSON.stringify({
			findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
				criterionId: c.id,
				failed: i === 0,
				statement: i === 0 ? 'The graph substitutes an easier problem.' : 'evaluated; absent'
			})),
			recommendation: 'REJECTED',
			residualUncertainty: []
		});
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId);

		expect(events.at(-1)?.kind).toBe('done');
		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		const turn = getPendingAuthoringTurn(pwaId);
		expect(turn, 'the turn left no staged candidate').toBeDefined();
		expect(turn!.status, 'a valid subject finding did not require revision').toBe(
			'REVISION_REQUIRED'
		);
	});
});

// ⭐ `JAN-SELRES` RS-3 (D8 as revised, `REG-F-462`) — THE PAGE'S BLOCKED HINT IS ANSWERED FROM THE FLOOR THE PANEL SHOWS,
// WHICH BESIDE A STAGED CANDIDATE IS THE FORK'S, AND IN ~~THREE~~ FOUR SENTENCES — ⭐ `JAN-ESCREC` D3 added `ROUTE_TO_HUMAN`,
// which `authoring-route-escalated-review.test.ts` holds to the fork; this file holds the other three.
//
// ⛔ WHY THIS IS THE REAL PATH. In the product a refused or failed review reaches the PWA page ONLY through a staged
// candidate: the floor runs on an authoring turn and records into the turn's fork, and only a satisfied candidate is
// accepted — so CANONICAL holds no floor beside a BLOCKED_EXTERNAL candidate. A page load that asked
// `loadPwaFloor(id)`, whose default engine is canonical, would find no floor and put "revise the graph and re-run" back
// beside a refused substitute, while every e2e that stages a CANONICAL floor stayed green (the RS-3 verifier's ADV-A1).
// ⭑ The same route, seam and reviewer as above; the page's `load` is then called in-process, as the browser's request
// would call it.
//
// ⚠ THE FIXTURE WAS THE TELL AGAIN (the RS-3 re-verifier's MAJOR). This describe's refused-substitute case sent the
// free-text instruction, whose canned graph the schema/invariant policy REJECTS on the reference seed — so it pinned
// "revising it does not address this" beside a graph defect that revising DOES address. Each case now sends a JSON plan
// and asserts, as arrangement, what the non-review policies recorded: the well-formed graph is one case, the graph with
// two roots is two more, each with its own answer.
describe('⭐ RS-3 — the page load answers the blocked hint from the staged candidate’s fork', () => {
	it('⛔ a refused substitute on a WELL-FORMED graph, staged BLOCKED_EXTERNAL: canonical holds no floor, and the load says revising does not address the block', async () => {
		seam.reported = 'substituted-model';
		seam.answer = clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
		const pwaId = draftPwa();

		await postInstruction(pwaId, ROOT_ONLY_PLAN);

		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		expect(getPendingAuthoringTurn(pwaId)?.status, 'arrangement: the refusal was not staged').toBe(
			'BLOCKED_EXTERNAL'
		);
		expect(
			loadPwaFloor(pwaId),
			'arrangement: canonical holds a floor, so this case could not tell the fork from canonical'
		).toBeUndefined();
		const data = await loadThePage(pwaId);
		expect(data.floor, 'the page shows no floor beside the staged candidate').toBeDefined();
		expect(
			policyOn(data.floor, 'floor.schema-invariant'),
			'arrangement: the graph is not well formed, so this case could not tell the review from the graph'
		).toEqual({ disposition: 'SATISFIED', codes: [] });
		expect(
			policyOn(data.floor, 'floor.identity-provenance')?.disposition,
			'arrangement: the identity/provenance policy did not pass the graph'
		).toBe('SATISFIED');
		expect(data.floorBlockedHint, 'the hint did not follow the fork the panel shows').toBe(
			'NOT_BY_REVISION'
		);
	});

	it('⛔ a refused substitute beside a graph with TWO ROOTS (FD3): the load says revise the graph for its findings AND run the review again', async () => {
		seam.reported = 'substituted-model';
		seam.answer = clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
		const pwaId = draftPwa();

		await postInstruction(pwaId, TWO_ROOTS_PLAN);

		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		expect(getPendingAuthoringTurn(pwaId)?.status, 'arrangement: the refusal was not staged').toBe(
			'BLOCKED_EXTERNAL'
		);
		expect(loadPwaFloor(pwaId), 'arrangement: canonical holds a floor').toBeUndefined();
		const data = await loadThePage(pwaId);
		expect(
			policyOn(data.floor, 'floor.schema-invariant'),
			'arrangement: the schema/invariant policy did not reject the two roots'
		).toEqual({ disposition: 'REJECTED', codes: ['PWA_GRAPH_NOT_WELL_FORMED'] });
		expect(
			policyOn(data.floor, 'floor.reasoning-review')?.codes,
			'arrangement: the review was not refused for a substitution'
		).toContain('VALIDATOR_MODEL_SUBSTITUTED');
		expect(
			data.floorBlockedHint,
			'a defect in the graph was answered as a block revising does not address'
		).toBe('REVISE_AND_REVIEW');
	});

	it('⛔ the CONFIGURED model clears the review, and the graph has TWO ROOTS: the load says revise the graph — the review is not the problem', async () => {
		// The review judged the graph and passed it; only the schema/invariant policy blocks. The route stages it
		// REVISION_REQUIRED, and the page must say the same: a load keyed on the REVIEW's disposition alone answers this
		// floor "revising does not address this" (the RS-3 re-verifier's N3b).
		seam.reported = CONFIGURED;
		seam.answer = clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
		const pwaId = draftPwa();

		await postInstruction(pwaId, TWO_ROOTS_PLAN);

		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		expect(
			getPendingAuthoringTurn(pwaId)?.status,
			'arrangement: the schema finding was not staged for revision'
		).toBe('REVISION_REQUIRED');
		expect(loadPwaFloor(pwaId), 'arrangement: canonical holds a floor').toBeUndefined();
		const data = await loadThePage(pwaId);
		expect(
			policyOn(data.floor, 'floor.reasoning-review')?.disposition,
			'arrangement: the configured model’s clearing judgement did not pass the graph'
		).toBe('SATISFIED');
		expect(
			policyOn(data.floor, 'floor.schema-invariant'),
			'arrangement: the schema/invariant policy did not reject the two roots'
		).toEqual({ disposition: 'REJECTED', codes: ['PWA_GRAPH_NOT_WELL_FORMED'] });
		expect(
			data.floorBlockedHint,
			'a schema finding beside a review that passed was answered as a review problem'
		).toBe('REVISE');
	});

	it('⭑ CONTROL — a genuine subject finding staged REVISION_REQUIRED: the load says revising DOES answer the block', async () => {
		// Without this, 'NOT_BY_REVISION' above could hold because the load answers it beside every floor it loads. The
		// graph is WELL FORMED, so the review's subject finding is the block's only cause.
		seam.reported = CONFIGURED;
		seam.answer = subjectRejection();
		const pwaId = draftPwa();

		await postInstruction(pwaId, ROOT_ONLY_PLAN);

		expect(seam.calls.length, 'arrangement: the devin branch reviewed the candidate').toBe(1);
		expect(
			getPendingAuthoringTurn(pwaId)?.status,
			'arrangement: the subject finding was not staged'
		).toBe('REVISION_REQUIRED');
		const data = await loadThePage(pwaId);
		expect(data.floor, 'the page shows no floor beside the staged candidate').toBeDefined();
		expect(
			policyOn(data.floor, 'floor.schema-invariant'),
			'arrangement: the graph is not well formed, so the review’s finding is not the only cause'
		).toEqual({ disposition: 'SATISFIED', codes: [] });
		expect(
			policyOn(data.floor, 'floor.reasoning-review')?.disposition,
			'arrangement: the review did not reject the graph'
		).toBe('REJECTED');
		expect(
			data.floorBlockedHint,
			'a subject finding was answered as a block revising cannot answer'
		).toBe('REVISE');
	});
});
