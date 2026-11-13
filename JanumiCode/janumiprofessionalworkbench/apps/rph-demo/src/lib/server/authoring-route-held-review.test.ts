// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L13 — design D68 (`REG-D-157`; `REG-F-630`; the lead's decisions (b) and (c)) — THROUGH THE AUTHORING
// ROUTE AND THE PRODUCT'S OWN FLOOR: A ROUND THAT HOLDS A TYPE INCONCLUSIVE FOR A FAILED CHECK ASKS FOR A REPAIR, THE REPAIR CARRIES THAT
// CHECK UNDER ITS TYPE, AND THE NEXT ROUND'S REVIEWER OF THAT TYPE IS SHOWN IT.
//
// ⛔ WHAT WAS WRONG. In P6 again's sixth paid run a reviewer passed "CLI and Error Handling Design" with one check failed; the floor
// held the type INCONCLUSIVE, and no repair could carry its check: beside a rejected type it was left out of the directive and so out
// of the next round's prior findings, and alone the round asked for no repair at all (`REG-F-630`).
//
// ⭑ THE PRODUCTION COMPOSITION, on `authoring-route-third-round.test.ts`'s arrangement (package L12), restated because a route test's
// mocks are its own file's: the route POSTed in-process in test mode, the deterministic mock agent authoring a JSON plan (and its
// canned graph for each free-text directive), the floor running the product's own devin branch with only devin's PROGRAM replaced at
// its exec seam — which answers each part by the type its prompt's subject names and by the round it is in (the agent's runs so far).
// ⭑ THE HELD REPLY is the sixth run's shape: it recommends SATISFIED and fails one check, at the reviewer's own severity ADVISORY;
// the policy declares the check BLOCKING (`R25`), the boundary refuses a SATISFIED over an unmet mandatory check, and the floor
// records the type INCONCLUSIVE with the check beside it.
//
// ⛔ HERMETIC, as that file is: the exec seam starts nothing and PATH finds no program; the agent is always the mock, whatever mode the
// route asks for (`JPWB_AGENT=pi` reaches auto-refinement), and the module that imports Pi's SDK is mocked to throw. The decision
// model is the product's double (`indications.testing.js`), which asks no model.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What happened, in order. Hoisted: the mocks run first. */
const seam = vi.hoisted(() => ({
	/** Every instruction the agent was run on, in order: the operator's, then each refinement's directive. */
	instructions: [] as string[],
	/** Every review prompt devin was handed: its round (the agent's runs before it), the type its subject names, and the prompt. */
	reviews: [] as { readonly round: number; readonly typeName: string; readonly prompt: string }[],
	/** The reply devin's program gives a part's review, by the type its subject names and the round. */
	answerFor: (_typeName: string, _round: number): string => ''
}));

vi.mock('./tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (_file, args) => {
				const typeName = /\{"subject":\{"type":\{"id":"[^"]+","name":"([^"]+)"/.exec(prompt)?.[1] ?? '';
				const round = seam.instructions.length;
				seam.reviews.push({ round, typeName, prompt });
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(exportPath, JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-devin-model' } }] }), 'utf8');
				return { stdout: seam.answerFor(typeName, round) };
			})
		)
	};
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
						seam.instructions.push(instruction);
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

// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 (`REG-D-146`): the product's configured decision model, stood in for by a double that calls
// no model, as the reviewer's program is (`authoring-route-third-round.test.ts`).
vi.mock('./assurance/decision-model.js', async (importOriginal) => {
	const { TEST_INDICATIONS } = await import('./assurance/indications.testing.js');
	return { ...(await importOriginal<typeof import('./assurance/decision-model.js')>()), configuredIndications: () => TEST_INDICATIONS };
});

import type { AuthoringAgent } from './agent/index.js';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { clearAuthoringTurns, getPendingAuthoringTurn, summarizeAuthoringTurn } from './authoring-turn.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];

/** The check the held reply fails: the sixth run's, `RR-07`. */
const HELD_CHECK = 'RR-07-no-contradiction';
/** devin's reply failing `HELD_CHECK` at the reviewer's own severity ADVISORY and recommending SATISFIED, the rest unfailed: held. */
const held = (fault: string): string =>
	JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) =>
			c.id === HELD_CHECK
				? { criterionId: c.id, failed: true, statement: fault, severity: 'ADVISORY' }
				: { criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent' }
		),
		recommendation: 'SATISFIED',
		residualUncertainty: []
	});
/** devin's reply with the FIRST criterion failed, stating `fault`, and the rest unfailed: REJECTED. */
const faulting = (fault: string): string =>
	JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
			criterionId: c.id,
			failed: i === 0,
			statement: i === 0 ? fault : 'evaluated; the failure class is absent'
		})),
		recommendation: 'REJECTED',
		residualUncertainty: []
	});
const CLEAN = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent' })),
	recommendation: 'SATISFIED',
	residualUncertainty: []
});

/** The held type's check, and the rejected type's finding — stand-in statements. */
const HELD_FAULT = 'Check says every failure is reported, and its own example drops the failure of a missing input file.';
const REJECTED_FAULT = 'Realize claims the product is verified, and no type verifies it.';

/** A root over one child: two types, two parts. */
const PLAN = JSON.stringify({
	plan: [
		{
			tool: 'scaffold_graph',
			args: {
				types: [
					{ tempKey: 'root', name: 'Realize', pwuKind: 'PRODUCT_REALIZATION', isRoot: true, childTempKeys: ['check'] },
					{ tempKey: 'check', name: 'Check', pwuKind: 'VERIFICATION' }
				]
			}
		}
	]
});

function draftPwa(): string {
	const pwaId = mintUiId('pwa');
	const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Held review fixture',
		description: 'A DRAFT PWA whose first round holds a type INCONCLUSIVE for a failed check.',
		domain: 'software',
		version: '0.1.0'
	});
	expect(r.status, `arrangement: CreatePwa — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	return pwaId;
}

async function postInstruction(pwaId: string, instruction: string): Promise<{ kind: string; text?: string }[]> {
	const response = await POST({
		params: { id: pwaId },
		request: new Request(`http://localhost/pwa/${pwaId}/agent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ instruction })
		})
	} as unknown as RouteEvent);
	return (await response.text())
		.split('\n\n')
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as { kind: string; text?: string });
}

/** The prompt a round's review of `typeName` was handed: exactly one. */
function promptOf(round: number, typeName: string): string {
	const found = seam.reviews.filter((r) => r.round === round && r.typeName === typeName);
	expect(found, `round ${round} reviewed "${typeName}" other than once`).toHaveLength(1);
	return found[0]!.prompt;
}

/** The directive's findings section about the type named `typeName`: its heading line and the lines after it, to the blank line. */
function sectionAbout(directive: string, typeName: string): string {
	const at = directive.indexOf(`Findings about the type ${JSON.stringify(typeName)} (`);
	if (at === -1) return '';
	const end = directive.indexOf('\n\n', at);
	return directive.slice(at, end === -1 ? undefined : end);
}

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	seam.instructions.length = 0;
	seam.reviews.length = 0;
	seam.answerFor = () => CLEAN;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL', 'JPWB_AGENT']) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
});

describe('⭐⭐ L13 — D68, through the route and the product’s floor: a type held INCONCLUSIVE for a failed check is repaired, and its next review is shown the check', () => {
	// ⛔ PREDICTED RED, read from the code at 230574f3: the round's fold is INCONCLUSIVE, which the classifier answers
	// RETRY_OR_CONFIGURE_REVIEWER with autoRefine false — so the route runs no refinement and returns after the first round.
	it('⭐ RED — the held type alone: the route runs a repair whose directive carries the check under its type, and the next round’s reviewer of that type is shown the check', async () => {
		vi.stubEnv('JPWB_AGENT', 'pi');
		seam.answerFor = (typeName, round) => (round === 1 && typeName === 'Check' ? held(HELD_FAULT) : CLEAN);
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId, PLAN);

		expect(events.at(-1)?.kind).toBe('done');
		expect(promptOf(1, 'Check'), 'arrangement: the first round did not review Check').toContain('"name":"Check"');
		promptOf(1, 'Realize');
		// ⭐ THE REPAIR: one refinement, its directive carrying the held type's check under the held type.
		expect(seam.instructions, 'the route ran no repair for the round that held a type INCONCLUSIVE for a failed check').toHaveLength(2);
		expect(sectionAbout(seam.instructions[1]!, 'Check'), 'the directive does not carry the held type’s check under its type').toContain(
			`1. [${HELD_CHECK}] ${HELD_FAULT}`
		);
		expect(sectionAbout(seam.instructions[1]!, 'Realize'), 'the directive lists a type nothing was found in').toBe('');
		// ⭐ THE NEXT ROUND: the held type's reviewer is shown its check; the other type's is not.
		expect(promptOf(2, 'Check'), 'the second round’s reviewer of Check is not shown its check').toContain(HELD_FAULT);
		expect(promptOf(2, 'Realize'), 'the second round’s reviewer of Realize is shown another type’s check').not.toContain(HELD_FAULT);
		// ⭑ And the second round, clean, asks for no third.
		expect(seam.reviews.filter((r) => r.round > 2), 'a third round ran').toEqual([]);
	});

	// ⛔ PREDICTED RED, read from the code at 230574f3: the fold is REJECTED, so the route refines, but only the rejected part's
	// observations are its findings — the directive and the second round's prior findings lack the held type's check.
	it('⭐ RED — the sixth run’s shape: a rejected type beside a held one — the repair carries both, each under its type, and each type’s next reviewer is shown its own', async () => {
		vi.stubEnv('JPWB_AGENT', 'pi');
		seam.answerFor = (typeName, round) =>
			round === 1 && typeName === 'Realize' ? faulting(REJECTED_FAULT) : round === 1 && typeName === 'Check' ? held(HELD_FAULT) : CLEAN;
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId, PLAN);

		expect(events.at(-1)?.kind).toBe('done');
		expect(seam.instructions, 'arrangement: the rejected type’s round was not refined once').toHaveLength(2);
		expect(sectionAbout(seam.instructions[1]!, 'Realize'), 'arrangement: the directive lacks the rejected type’s finding').toContain(
			REJECTED_FAULT
		);
		// ⭐ THE HELD TYPE'S CHECK BESIDE IT, under its own type.
		expect(sectionAbout(seam.instructions[1]!, 'Check'), 'the directive left out the held type’s check').toContain(
			`1. [${HELD_CHECK}] ${HELD_FAULT}`
		);
		// ⭐ EACH TYPE'S NEXT REVIEWER SHOWN ITS OWN, NEVER THE OTHER'S.
		expect(promptOf(2, 'Check'), 'the second round’s reviewer of Check is not shown its check').toContain(HELD_FAULT);
		expect(promptOf(2, 'Check'), 'the second round’s reviewer of Check is shown Realize’s finding').not.toContain(REJECTED_FAULT);
		expect(promptOf(2, 'Realize'), 'arrangement: the second round’s reviewer of Realize is not shown its finding').toContain(REJECTED_FAULT);
		expect(promptOf(2, 'Realize'), 'the second round’s reviewer of Realize is shown Check’s check').not.toContain(HELD_FAULT);
	});

	// ⛔ PREDICTED RED, read from the code at 230574f3: the classifier answers the held round RETRY_OR_CONFIGURE_REVIEWER, an operational
	// action, so the candidate is staged BLOCKED_EXTERNAL on the guidance that names the reviewer.
	it('⭐ RED — mock mode: the held round is not refined, and its candidate is staged for revision on REFINE_SUBJECT’s guidance, never blocked on the reviewer', async () => {
		seam.answerFor = (typeName) => (typeName === 'Check' ? held(HELD_FAULT) : CLEAN);
		const pwaId = draftPwa();

		await postInstruction(pwaId, PLAN);

		expect(seam.instructions, 'arrangement: mock mode refined').toEqual([PLAN]);
		const turn = getPendingAuthoringTurn(pwaId)!;
		expect([turn.status, summarizeAuthoringTurn(turn).remediationAction], 'the held round’s candidate is blocked on the reviewer').toEqual([
			'REVISION_REQUIRED',
			undefined
		]);
		expect(turn.detail).toBe(
			'PublishPwa remains blocked while valid Reasoning Review findings are open. Revise the reviewed PWA graph and/or its recorded professional rationale as the coded findings require, then rerun assurance.'
		);
	});

	// ⭑ CONTROL, green at 230574f3 and after — MOCK MODE RUNS NO REFINEMENT, whatever the round asks: one round, the agent run once.
	it('⭑ CONTROL — mock mode: a round that holds a type for a failed check runs one round and no refinement', async () => {
		seam.answerFor = (typeName) => (typeName === 'Check' ? held(HELD_FAULT) : CLEAN);
		const pwaId = draftPwa();

		await postInstruction(pwaId, PLAN);

		expect(seam.instructions).toEqual([PLAN]);
		expect(seam.reviews.filter((r) => r.round > 1), 'a second round ran in mock mode').toEqual([]);
		expect(seam.reviews.map((r) => r.typeName).sort(), 'the one round did not review both types once').toEqual(['Check', 'Realize']);
	});
});
