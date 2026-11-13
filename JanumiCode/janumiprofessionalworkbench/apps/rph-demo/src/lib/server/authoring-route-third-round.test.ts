// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L12 — design D67 (`REG-D-156` (2); `REG-F-628`; the lead's decision (c)) — THROUGH THE AUTHORING
// ROUTE AND THE PRODUCT'S OWN FLOOR: THE THIRD ROUND'S REVIEWER IS SHOWN, FOR EACH PART, ITS OWN TYPE'S FINDINGS FROM THE SECOND ROUND,
// AS THE SECOND IS SHOWN THE FIRST'S — THE SAME CONSTRUCT, SO NO REVIEWER PROMPT'S FORM CHANGES.
//
// ⭑ THE PRODUCTION COMPOSITION, on `authoring-route-failed-part.test.ts`'s arrangement: the route POSTed in-process in test mode, the
// deterministic mock agent authoring a JSON plan (and its canned graph for each free-text directive), the floor running the product's
// own devin branch with only devin's PROGRAM replaced at its exec seam — which answers each part by the type its prompt's subject
// names and by the round it is in (the agent's runs so far): round 1 rejects "Realize", round 2 rejects "Check", round 3 rejects none.
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
// no model, as the reviewer's program is (`authoring-route-failed-part.test.ts`).
vi.mock('./assurance/decision-model.js', async (importOriginal) => {
	const { TEST_INDICATIONS } = await import('./assurance/indications.testing.js');
	return { ...(await importOriginal<typeof import('./assurance/decision-model.js')>()), configuredIndications: () => TEST_INDICATIONS };
});

import type { AuthoringAgent } from './agent/index.js';
import { createHash } from 'node:crypto';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { clearAuthoringTurns } from './authoring-turn.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];

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

/** Round 1's finding, about "Realize"; round 2's, about "Check" — each its round's only one. */
const FIRST_FAULT = 'Realize claims the product is verified, and no type verifies it.';
const SECOND_FAULT = 'Check reports test runs it never made, and nothing in its prompt forbids it.';
/** ⭐ D67 — the lead's two sentences, verbatim (`l12-facts.md` §3 (a)). */
const EVERY_TYPE =
	'Every type of the PWA is reviewed again after this revision, not only those named below. Where a finding names a problem, look for the same problem in every other type and fix it wherever it occurs.';

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
		name: 'Third round fixture',
		description: 'A DRAFT PWA whose second round still asks for revision.',
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

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	seam.instructions.length = 0;
	seam.reviews.length = 0;
	seam.answerFor = (typeName, round) =>
		round === 1 && typeName === 'Realize' ? faulting(FIRST_FAULT) : round === 2 && typeName === 'Check' ? faulting(SECOND_FAULT) : CLEAN;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL', 'JPWB_AGENT']) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
	vi.stubEnv('JPWB_AGENT', 'pi');
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
});

describe('⭐⭐ L12 — D67, through the route and the product’s floor: the third round is shown the second round’s findings, as the second is shown the first’s', () => {
	// ⛔ PREDICTED RED, read from the code at 7e45efb0: the route returns after the second round, so no review is made in a third.
	it('⭐ RED — each part of the third round is shown its own type’s findings from the second round, and none from the first; the agent is given the second round’s finding with D67’s words', async () => {
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId, PLAN);

		expect(events.at(-1)?.kind).toBe('done');
		// ⭑ The second round, as today: Realize is shown its first-round finding, Check none.
		expect(promptOf(2, 'Realize'), 'arrangement: the second round’s Realize is not shown its first-round finding').toContain(FIRST_FAULT);
		expect(promptOf(2, 'Check'), 'arrangement: the second round’s Check is shown another type’s finding').not.toContain(FIRST_FAULT);
		// ⭐ THE SECOND REFINEMENT: the agent is given the directive over the second round's finding, with D67's words.
		expect(seam.instructions, 'no second refinement ran').toHaveLength(3);
		expect(seam.instructions[2], 'the second directive does not carry the second round’s finding').toContain(SECOND_FAULT);
		expect(seam.instructions[2], 'the second directive carries the first round’s finding').not.toContain(FIRST_FAULT);
		expect(seam.instructions[2], 'the second directive lacks D67’s words').toContain(EVERY_TYPE);
		// ⭐ THE THIRD ROUND: every part reviewed again, each shown its own type's second-round findings.
		expect(seam.reviews.filter((r) => r.round === 3).map((r) => r.typeName), 'the third round did not review the plan’s types').toEqual(
			expect.arrayContaining(['Realize', 'Check'])
		);
		expect(promptOf(3, 'Check'), 'the third round’s Check is not shown its second-round finding').toContain(SECOND_FAULT);
		expect(promptOf(3, 'Realize'), 'the third round’s Realize is shown another type’s finding').not.toContain(SECOND_FAULT);
		for (const review of seam.reviews.filter((r) => r.round === 3))
			expect(review.prompt, `the third round’s "${review.typeName}" is shown the first round’s finding`).not.toContain(FIRST_FAULT);
		// ⭑ And no fourth: the third round's clean reviews ask for no refinement.
		expect(seam.reviews.filter((r) => r.round > 3), 'a fourth round ran').toEqual([]);
	});

	// ⭑ CONTROL, green at HEAD and after — EVERY REVIEWER PROMPT BYTE FOR BYTE (the brief's control): the prompts of the two rounds HEAD
	// makes too are HEAD's, each by its sha256, measured at 7e45efb0 on exactly this arrangement before this file was written
	// (`l12-facts.md` §4 item 3: the same in two runs, and under the prototype). Only a round HEAD never makes is new; the reviewer's
	// template is unchanged (`reviewer:qual:check`, the fingerprint aba310bd…). ⭑ Its own mutant: a round after a refinement shown no
	// account (`P6X-L12-M12`), which moves the second round's prompts.
	it('⭑ CONTROL — the reviewer prompts of the first two rounds are HEAD’s, byte for byte', async () => {
		const pwaId = draftPwa();

		await postInstruction(pwaId, PLAN);

		const sha256 = (prompt: string) => createHash('sha256').update(prompt, 'utf8').digest('hex');
		expect(
			seam.reviews.filter((r) => r.round <= 2).map((r) => [r.round, r.typeName, sha256(r.prompt)]),
			'a reviewer prompt of the first two rounds is not HEAD’s, byte for byte'
		).toEqual([
			[1, 'Realize', '3aed56599538c482ca8dc1e1d8f83b77fad998f8eaf6f22eb6fcb2060eaec3a4'],
			[1, 'Check', 'eb7d546657d7bc4348b089327947f1f35ec3ba0f17e33ed556e65c0e47dda811'],
			[2, 'Realize', '3ad1a328e37810b5a19e7767ce114d126f76457c8ef86476c0171649ca511633'],
			[2, 'Check', '5eaff24a86ef45e6fa9a1062a7fc6b6e82e08e46013ff8286c87d1415a357925'],
			[2, 'Product Realization', 'e2ba3e63bd8147c6f313c3d961d481484c8eb3fc75c1681fb7b082833b4056ec'],
			[2, 'Architecture Definition', '14813b924e99bbbc9ae42e5d5ca29a6dc7bb4091d3d04232dd3a345b99d6e471']
		]);
	});
});
