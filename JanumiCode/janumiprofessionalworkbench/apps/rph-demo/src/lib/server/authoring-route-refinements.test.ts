// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L12 — design D67 (`REG-D-156` (2); `REG-F-628`; the lead's count, decisions (b) and (c)) — THROUGH THE
// AUTHORING ROUTE: AT MOST TWO REFINEMENTS, SO AT MOST THREE ROUNDS — THE SECOND ASKED BY THE RULE THAT ASKS FOR THE FIRST, THE THIRD
// ROUND SHOWN THE SECOND'S FINDINGS.
//
// ⛔ WHAT WAS WRONG. P6 again's sixth paid run stopped in its authoring (`REG-F-628`): the route ran the floor, ONE refinement and the
// floor again, and returned — so the second round's findings, on a type the refinement had not touched and on another judged afresh,
// had no refinement left to answer them, and the candidate stayed REVISION_REQUIRED.
// ⭑ WHAT MUST HOLD. After the second round, when its remediation asks for refinement (`autoRefine`), the agent is given the directive
// again with the second round's findings and failed parts, and the floor runs a third time, each part shown its own type's findings
// from the round before (`priorFindings`); after the third round the turn ends as today. No third refinement. A round that asks for
// none ends the loop as it ends it today. Mock mode runs none.
//
// ⭑ ONLY THE FLOOR RUN IS REPLACED, as in `authoring-route-disposition.test.ts`: `runPwaFloor` returns a hand-built round per call,
// and the route's own classifier, directive, turn marking and guidance run as in production. A round beyond those a case expects is
// scripted too, as a trap: a route that ran it would be seen by the count of calls. The agent is the deterministic mock whatever mode
// the route asks for (`JPWB_AGENT=pi` reaches refinement), its runs observed; the module that imports Pi's SDK is mocked to throw.
//
// ⛔ HERMETIC. No reviewer runs at all (the floor run is replaced), PATH finds no program, and no model is asked anything.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** Every instruction the agent was run on, in order: the operator's, then each refinement's directive. Hoisted: the mocks run first. */
const agentSeam = vi.hoisted(() => ({ instructions: [] as string[] }));

vi.mock('./floor.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./floor.js')>();
	return { ...actual, runPwaFloor: vi.fn(actual.runPwaFloor) };
});

vi.mock('./agent/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./agent/index.js')>();
	return {
		...actual,
		createAuthoringAgent: vi.fn(
			async (broker: Parameters<typeof actual.createAuthoringAgent>[0]): Promise<AuthoringAgent> => {
				const mock = await actual.createAuthoringAgent(broker, 'mock');
				return {
					run: (instruction, emit, signal) => {
						agentSeam.instructions.push(instruction);
						return mock.run(instruction, emit, signal);
					},
					rationale: () => mock.rationale(),
					materializedInputs: () => mock.materializedInputs()
				};
			}
		)
	};
});

vi.mock('./agent/pi-agent.js', () => {
	throw new Error('hermetic: no route test loads Pi');
});

import type { AuthoringAgent } from './agent/index.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { clearAuthoringTurns, getPendingAuthoringTurn, hashAuthoringSubject, summarizeAuthoringTurn } from './authoring-turn.js';
import {
	classifyFloorRemediation,
	partsDisposition,
	refineDirective,
	runPwaFloor,
	type FloorObservationView,
	type FloorPartView,
	type FloorView
} from './floor.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];
interface StreamedEvent {
	readonly kind: string;
	readonly text?: string;
}

const INSTRUCTION = 'Author the product realization graph for the CLI.';
const REVIEW = 'floor.reasoning-review';

function draftPwa(): string {
	const pwaId = mintUiId('pwa');
	const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Refinements fixture',
		description: 'A DRAFT PWA whose rounds are scripted one by one.',
		domain: 'software',
		version: '0.1.0'
	});
	expect(r.status, `arrangement: CreatePwa — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	return pwaId;
}

async function postInstruction(pwaId: string): Promise<StreamedEvent[]> {
	const response = await POST({
		params: { id: pwaId },
		request: new Request(`http://localhost/pwa/${pwaId}/agent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ instruction: INSTRUCTION })
		})
	} as unknown as RouteEvent);
	return (await response.text())
		.split('\n\n')
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as StreamedEvent);
}

// ── Hand-built rounds, as the floor returns one: the PWA's two deterministic policies, and the review in parts ──────────────────
const LEAF_A = 'pwut_00000000000000000000000LA1';
const LEAF_B = 'pwut_00000000000000000000000LB1';
const DESIGN = 'pwut_00000000000000000000000DS1';
const executionFailed = { code: 'VALIDATOR_EXECUTION_FAILED', severity: 'MATERIAL', statement: 'The reviewer did not respond.' };
const allowanceStopped = {
	code: 'VALIDATOR_ALLOWANCE_STOPPED',
	severity: 'MATERIAL',
	statement: 'No reviewer failed: the authoring review’s allowance stopped this review before any reviewer call.'
};
const fault = (statement: string, code = 'RR-07-no-contradiction') => ({ code, severity: 'BLOCKING', statement });

const part = (
	typeId: string,
	typeName: string,
	disposition: string,
	observations: readonly { readonly code: string; readonly severity: string; readonly statement: string }[] = [],
	independenceOk = true
): FloorPartView => ({
	typeId,
	typeName,
	semanticVersion: 1,
	disposition,
	independenceOk,
	observations: observations.map((o) => ({ ...o, typeId, typeName }))
});
/** A round over `parts`, folded as the floor folds one, beside the PWA's two deterministic policies (each SATISFIED unless given). */
const roundOf = (parts: readonly FloorPartView[], schema: FloorView['policies'][number] | undefined = undefined): FloorView => {
	const fold = partsDisposition(parts);
	const satisfied = fold === 'SATISFIED' && schema === undefined;
	return {
		subjectId: 'pwa-under-review',
		aggregate: satisfied ? 'SATISFIED' : fold === 'SATISFIED' ? 'REJECTED' : fold,
		satisfied,
		waived: false,
		policies: [
			schema ?? { policyId: 'floor.schema-invariant', disposition: 'SATISFIED', independenceOk: true, observations: [] },
			{ policyId: 'floor.identity-provenance', disposition: 'SATISFIED', independenceOk: true, observations: [] },
			{
				policyId: REVIEW,
				disposition: fold,
				independenceOk: parts.every((p) => p.independenceOk),
				observations: parts.flatMap((p) => p.observations)
			}
		],
		reasoningGaps: [],
		parts
	};
};

/** Round 1 — the sixth run's shape: one leaf rejected, its sibling and the design passed. */
const FIRST_FAULT = 'The account says the prompts forbid inventing run evidence; this leaf’s prompt does not.';
const ROUND_1 = roundOf([
	part(LEAF_A, 'Successful Workflow E2E Verification', 'REJECTED', [fault(FIRST_FAULT)]),
	part(LEAF_B, 'Failure and Interface E2E Verification', 'SATISFIED'),
	part(DESIGN, 'CLI and Error Handling Design', 'SATISFIED')
]);
/** Round 2 — the sibling rejected for the same gap, and the design's review failed beside it: revision, the failed part named. */
const SECOND_FAULT = 'Unlike its revised sibling, this leaf’s prompt neither forbids fabricated evidence nor represents unavailable evidence.';
const ROUND_2 = roundOf([
	part(LEAF_A, 'Successful Workflow E2E Verification', 'SATISFIED'),
	part(LEAF_B, 'Failure and Interface E2E Verification', 'REJECTED', [fault(SECOND_FAULT, 'RR-04-no-proxy-satisfaction')]),
	part(DESIGN, 'CLI and Error Handling Design', 'INCONCLUSIVE', [executionFailed], false)
]);
/** Round 3 — every part passes. */
const SATISFIED_ROUND = roundOf([
	part(LEAF_A, 'Successful Workflow E2E Verification', 'SATISFIED'),
	part(LEAF_B, 'Failure and Interface E2E Verification', 'SATISFIED'),
	part(DESIGN, 'CLI and Error Handling Design', 'SATISFIED')
]);
/** A round that still asks for revision: the design rejected. */
const THIRD_FAULT = 'The design declares policies outside those its kind may take.';
const ROUND_STILL_REJECTED = roundOf([
	part(LEAF_A, 'Successful Workflow E2E Verification', 'SATISFIED'),
	part(LEAF_B, 'Failure and Interface E2E Verification', 'SATISFIED'),
	part(DESIGN, 'CLI and Error Handling Design', 'REJECTED', [fault(THIRD_FAULT, 'RR-03-no-unsupported-claim')])
]);
/** A trap: a round no case expects the route to reach — a rejected one, so a route that reached it would refine again. */
const TRAP = roundOf([part(LEAF_A, 'Successful Workflow E2E Verification', 'REJECTED', [fault('A round the route must never reach.')])]);

/** The rounds a case scripts, in order; each call of the floor takes the next. */
function scriptRounds(...rounds: (FloorView | undefined)[]): void {
	for (const round of rounds) vi.mocked(runPwaFloor).mockResolvedValueOnce(round);
}
/** What the route handed the floor at each call. */
const floorCalls = () => vi.mocked(runPwaFloor).mock.calls.map(([, opts]) => opts);
/** The route's `⚠` lines: the floor's guidance, sent after the last round. */
const warnings = (events: readonly StreamedEvent[]) =>
	events.filter((e) => e.kind === 'status' && e.text?.startsWith('⚠ ')).map((e) => e.text!);

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	vi.mocked(runPwaFloor).mockReset();
	agentSeam.instructions.length = 0;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL', 'JPWB_AGENT']) vi.stubEnv(v, undefined);
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
});

describe('⭐⭐ L12 — D67, through the route: a second refinement and a third round when the second round still asks for revision', () => {
	// ⛔ PREDICTED RED, read from the code at 7e45efb0: the route refines once and returns after the second round — two floor calls,
	// two agent runs, and the candidate staged REVISION_REQUIRED on the second round's findings.
	it('⭐ RED — the second round asks for refinement: the agent is given the directive again, with the second round’s findings and failed parts, and the floor runs a third time, shown the second round’s findings', async () => {
		vi.stubEnv('JPWB_AGENT', 'pi');
		scriptRounds(ROUND_1, ROUND_2, SATISFIED_ROUND, TRAP);
		const first = classifyFloorRemediation(ROUND_1);
		const second = classifyFloorRemediation(ROUND_2);
		expect([first.action, first.autoRefine, second.action, second.autoRefine, second.failedParts], 'arrangement').toEqual([
			'REFINE_SUBJECT',
			true,
			'REFINE_SUBJECT',
			true,
			[{ typeId: DESIGN, typeName: 'CLI and Error Handling Design' }]
		]);
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId);

		expect(events.at(-1)?.kind).toBe('done');
		expect(vi.mocked(runPwaFloor), 'the route did not run the floor a third time').toHaveBeenCalledTimes(3);
		// ⭐ TWO REFINEMENTS, each the product's directive over the round before it, byte for byte.
		expect(agentSeam.instructions, 'the agent was not given the directive a second time').toEqual([
			INSTRUCTION,
			refineDirective(INSTRUCTION, first.findings, first.failedParts),
			refineDirective(INSTRUCTION, second.findings, second.failedParts)
		]);
		expect(agentSeam.instructions[2], 'arrangement: the second directive names the second round’s failed part').toContain(
			`Do not change them on account of that failure:\n- "CLI and Error Handling Design" (${DESIGN})\n`
		);
		// ⭐ EACH ROUND AFTER A REFINEMENT IS SHOWN THE ROUND BEFORE'S FINDINGS — the third, the second's; never the first's.
		const [round1, round2, round3] = floorCalls();
		expect(round1?.priorFindings, 'the first round was shown findings').toBeUndefined();
		expect(round2?.priorFindings, 'the second round was not shown the first round’s findings').toEqual(first.findings);
		expect(round3?.priorFindings, 'the third round was not shown the second round’s findings').toEqual(second.findings);
		expect(
			(round3?.priorFindings ?? []).map((f: FloorObservationView) => f.statement),
			'the third round was shown the first round’s findings'
		).not.toContain(FIRST_FAULT);
		// ⭑ Under the candidate's hash as it stood after the second refinement, which nothing changed after.
		const turn = getPendingAuthoringTurn(pwaId)!;
		expect(round3?.candidateSubjectHash, 'the third round was not bound to the refined candidate').toBe(hashAuthoringSubject(turn));
		// ⭑ The third round satisfied: the candidate is assured, as any satisfied last round leaves it.
		expect(turn.status, 'the satisfied third round did not assure the candidate').toBe('READY_TO_COMMIT');
		expect(warnings(events), 'a satisfied last round was followed by guidance').toEqual([]);
	});

	// ⛔ PREDICTED RED, read from the code at 7e45efb0: two floor calls and two agent runs, where three and three are the bound.
	it('⭐ RED — no fourth round: every round asks for refinement, and the turn runs three rounds and two refinements, then ends on the third round’s guidance, sent once', async () => {
		vi.stubEnv('JPWB_AGENT', 'pi');
		scriptRounds(ROUND_1, ROUND_2, ROUND_STILL_REJECTED, TRAP);
		const third = classifyFloorRemediation(ROUND_STILL_REJECTED);
		expect([third.action, third.autoRefine], 'arrangement: the third round still asks for refinement').toEqual(['REFINE_SUBJECT', true]);
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId);

		expect(events.at(-1)?.kind).toBe('done');
		expect(vi.mocked(runPwaFloor), 'the route did not stop at the third round').toHaveBeenCalledTimes(3);
		expect(agentSeam.instructions, 'a third refinement ran, or no second').toHaveLength(3);
		const turn = getPendingAuthoringTurn(pwaId)!;
		expect(turn.status).toBe('REVISION_REQUIRED');
		expect(turn.detail, 'the turn does not carry the third round’s guidance').toBe(third.guidance);
		expect(warnings(events), 'the guidance was not sent once, after the last round').toEqual([`⚠ ${third.guidance}`]);
		expect(summarizeAuthoringTurn(turn).status).toBe('REVISION_REQUIRED');
	});
});

// ⭑ GUARDS — A SECOND ROUND THAT ASKS FOR NO REFINEMENT ENDS THE TURN AS TODAY. ⚠ Green at HEAD by construction: HEAD runs no third
// round in any turn, so a test that a turn runs no third is not red there (named in `l12-facts.md`). Their reds are the mutants':
// a loop that ignored the second round's remediation, or a candidate that could not be loaded, would run a third.
describe('⭑ L12 — D67, through the route: a second round that asks for no refinement ends the turn, with no third', () => {
	const NOT_LOADED = undefined;
	const cases: readonly {
		readonly name: string;
		readonly round2: FloorView | undefined;
		readonly status: 'READY_TO_COMMIT' | 'REVISION_REQUIRED' | 'BLOCKED_EXTERNAL';
		/** The second round's remediation as the classifier answers it; none for a candidate that could not be loaded. */
		readonly action?: string;
	}[] = [
		{ name: 'satisfied', round2: SATISFIED_ROUND, status: 'READY_TO_COMMIT', action: 'NONE' },
		{
			name: 'stopped by the allowance',
			round2: roundOf([
				part(LEAF_A, 'Successful Workflow E2E Verification', 'INCONCLUSIVE', [executionFailed, allowanceStopped], false),
				part(LEAF_B, 'Failure and Interface E2E Verification', 'INCONCLUSIVE', [executionFailed, allowanceStopped], false)
			]),
			status: 'BLOCKED_EXTERNAL',
			action: 'FIT_THE_REVIEW_ALLOWANCE'
		},
		{
			name: 'failed operationally alone',
			round2: roundOf([
				part(LEAF_A, 'Successful Workflow E2E Verification', 'INCONCLUSIVE', [executionFailed], false),
				part(LEAF_B, 'Failure and Interface E2E Verification', 'INCONCLUSIVE', [executionFailed], false)
			]),
			status: 'BLOCKED_EXTERNAL',
			action: 'RETRY_OR_CONFIGURE_REVIEWER'
		},
		{
			name: 'its review missing',
			round2: { ...SATISFIED_ROUND, aggregate: 'REJECTED', satisfied: false, policies: SATISFIED_ROUND.policies.filter((p) => p.policyId !== REVIEW) },
			status: 'BLOCKED_EXTERNAL',
			action: 'RETRY_OR_CONFIGURE_REVIEWER'
		},
		{
			name: 'a PWA with no type',
			round2: roundOf([], {
				policyId: 'floor.schema-invariant',
				disposition: 'REJECTED',
				independenceOk: true,
				observations: [{ code: 'PWA_GRAPH_NOT_WELL_FORMED', severity: 'BLOCKING', statement: 'The graph has no root.' }]
			}),
			status: 'REVISION_REQUIRED',
			action: 'RESOLVE_OTHER_FLOOR_FINDINGS'
		},
		{
			name: 'its only finding not the review’s',
			round2: roundOf([part(LEAF_A, 'Successful Workflow E2E Verification', 'SATISFIED')], {
				policyId: 'floor.schema-invariant',
				disposition: 'REJECTED',
				independenceOk: true,
				observations: [{ code: 'PWA_GRAPH_NOT_WELL_FORMED', severity: 'BLOCKING', statement: 'The graph has two roots.' }]
			}),
			status: 'REVISION_REQUIRED',
			action: 'RESOLVE_OTHER_FLOOR_FINDINGS'
		},
		{ name: 'a candidate that could not be loaded', round2: NOT_LOADED, status: 'REVISION_REQUIRED' }
	];

	for (const { name, round2, status, action } of cases)
		it(`⭑ the second round ${name}: two rounds, one refinement, the candidate ${status}`, async () => {
			vi.stubEnv('JPWB_AGENT', 'pi');
			if (round2 !== undefined)
				expect(
					[classifyFloorRemediation(round2).autoRefine, classifyFloorRemediation(round2).action],
					'arrangement: the second round asks for no refinement, by the classifier’s own answer'
				).toEqual([false, action]);
			scriptRounds(ROUND_1, round2, TRAP);
			const pwaId = draftPwa();

			const events = await postInstruction(pwaId);

			expect(events.at(-1)?.kind).toBe('done');
			expect(vi.mocked(runPwaFloor), 'a third round ran').toHaveBeenCalledTimes(2);
			expect(agentSeam.instructions, 'a second refinement ran').toHaveLength(2);
			const turn = getPendingAuthoringTurn(pwaId)!;
			expect(turn.status).toBe(status);
			// ⭑ The turn ends on the second round's own remediation: an external block carries its action, a revision its guidance;
			// a candidate that could not be loaded keeps the first round's, as today.
			if (status === 'BLOCKED_EXTERNAL') expect(summarizeAuthoringTurn(turn).remediationAction).toBe(action);
			if (status === 'REVISION_REQUIRED')
				expect(turn.detail).toBe(classifyFloorRemediation(round2 ?? ROUND_1).guidance);
		});
});

// ⭑ CONTROLS, green at HEAD and after.
describe('⭑ L12 — D67, controls: a first round that asks for none runs one round, and mock mode refines nothing', () => {
	it('⭑ CONTROL — a satisfied first round: one round, no refinement, the candidate assured', async () => {
		vi.stubEnv('JPWB_AGENT', 'pi');
		scriptRounds(SATISFIED_ROUND, TRAP);
		const pwaId = draftPwa();

		await postInstruction(pwaId);

		expect(vi.mocked(runPwaFloor)).toHaveBeenCalledTimes(1);
		expect(agentSeam.instructions).toEqual([INSTRUCTION]);
		expect(getPendingAuthoringTurn(pwaId)?.status).toBe('READY_TO_COMMIT');
	});

	it('⭑ CONTROL — mock mode: a first round that asks for refinement is not refined; one round, the candidate staged for revision', async () => {
		scriptRounds(ROUND_1, TRAP);
		const pwaId = draftPwa();

		await postInstruction(pwaId);

		expect(vi.mocked(runPwaFloor)).toHaveBeenCalledTimes(1);
		expect(agentSeam.instructions).toEqual([INSTRUCTION]);
		expect(getPendingAuthoringTurn(pwaId)?.status).toBe('REVISION_REQUIRED');
	});
});
