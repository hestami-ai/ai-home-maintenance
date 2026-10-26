// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L2 — D20 (`REG-F-580`; `REG-D-135` (4); DESIGN-data-flow-order-and-deliverable-review.md D20,
// revision 2; roadmap 9b.2a) — THE AUTHORING REVIEW'S ALLOWANCE, AT THE FLOOR.
//
// ⛔ WHAT WAS WRONG. Before Send no candidate exists, and the agent may author any number of types; the floor reviews each one
// inside the Send press, so the lane's count before Send was an estimate and the limit could be crossed there (`REG-F-580`).
// ⭑ WHAT MUST HOLD. With an allowance set (`JPWB_AUTHORING_REVIEW_ALLOWANCE`), before EACH review round `runPwaFloor` reserves
// that round's worst case — its parts × the validator's calls a review (`REVIEWER_CALLS_PER_REVIEW`, 6) — and runs the round only
// while the worst cases already reserved and this one stay within the allowance. A round that would pass it makes NO reviewer
// call: each part is recorded as a review that did not execute, with the stated reason, the review is not SATISFIED, and the
// candidate is not accepted. With no allowance, the product's default, nothing changes.
//
// ⭑ A REAL ENGINE, THE REAL RECORDER, THE REAL VALIDATOR, as `floor-parts.test.ts` arranges them — the model replaced at the
// `print` seam, and the allowance injected at the floor's own seam (`opts.allowance`). No model is called.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { listByType, type AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_CREDENTIAL } from './identity.js';
import { getEngine, resetEngine } from './workbench.js';
import {
	classifyFloorRemediation,
	isOperationalRemediation,
	loadPwaFloor,
	reasoningReviewCriteria,
	runPwaFloor,
	type FloorProducer,
	type FloorView
} from './floor.js';
import { clearingJudgement, withLiveReviewerSeam } from './assurance/clearing-reviewer.testing.js';
import { REVIEWER_CALLS_PER_REVIEW } from './assurance/reasoning-review-validator.js';
import {
	AUTHORING_REVIEW_ALLOWANCE_VARIABLE,
	authoringReviewAllowanceSetting,
	createAuthoringReviewAllowance,
	type AuthoringReviewAllowance
} from './assurance/review-allowance.js';
import { clearAuthoringTurns } from './authoring-turn.js';

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5Q00';
/** Three types, defined in this order — the export's, and so the parts'. */
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q10';
const BUILD = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q11';
const CHECK = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q12';
const PRODUCER: FloorProducer = { agentId: 'jpwb-authoring-agent', modelId: 'pi-authoring', providerId: 'janumi' };
const REVIEW = 'floor.reasoning-review';
/** The round's worst case: three parts, six calls a review — 18. */
const WORST = 3 * 6;

let session: AuthedEngineHandle;
let sequence = 0;

function send(commandType: string, aggregateType: string, id: string, payload: unknown) {
	sequence += 1;
	const command: DomainCommand = {
		commandId: `allowance-setup-${sequence}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: aggregateType,
		targetAggregateId: id,
		issuedAt: '2026-10-25T09:00:00Z',
		correlationId: 'setup',
		idempotencyKey: `allowance-setup-${sequence}`,
		payload
	};
	const r = session.dispatch(command);
	expect(r.status, `arrangement: ${commandType} ${id} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
}

function defineType(id: string, name: string, isRoot: boolean, children: string[] = []) {
	send('DefinePwuType', 'PWU_TYPE', id, {
		pwuTypeId: id,
		pwaId: PWA,
		pwuKind: name.toUpperCase(),
		name,
		purpose: `${name} the work`,
		isRoot,
		permittedChildTypeIds: children,
		requiredInputs: [],
		requiredOutputs: [],
		requiredAssurancePolicyIds: []
	});
}

/** One round of the floor on canonical, every part answered clean; the prompts in order. */
async function runRound(
	allowance?: AuthoringReviewAllowance
): Promise<{ readonly floor: FloorView | undefined; readonly prompts: string[] }> {
	const prompts: string[] = [];
	const floor = await withLiveReviewerSeam(() =>
		runPwaFloor(
			PWA,
			{
				prompt: 'Author the realization of wordfreq.',
				producer: PRODUCER,
				canonical: session,
				...(allowance === undefined ? {} : { allowance }),
				print: async (prompt) => {
					prompts.push(prompt);
					return clearingJudgement(reasoningReviewCriteria(session));
				}
			},
			session
		)
	);
	return { floor, prompts };
}

const allowanceOf = (configured: string | undefined) =>
	createAuthoringReviewAllowance(authoringReviewAllowanceSetting(configured));

/** The stated reason a stopped round records for one part, as the host names it: restated here, so a change reddens. */
const stopped = (part: string, name: string, round: { allowance: number; left: number; reserved: number }) =>
	'No reviewer call was made for this type: the authoring review’s allowance stopped its round before the round’s first ' +
	`call (${AUTHORING_REVIEW_ALLOWANCE_VARIABLE}; REG-F-580; design D20). The round reviews 3 type(s), "${name}" (${part}) ` +
	`among them; its worst case is 3 × 6 = 18 reviewer calls, and the allowance of ${round.allowance} has ${round.left} ` +
	`left, ${round.reserved} reserved by earlier rounds. A round runs only while its worst case fits what is left, so ` +
	'this type is not reviewed and the candidate is not accepted.';

const review = (f: FloorView | undefined) => f?.policies.find((p) => p.policyId === REVIEW);
const exchanges = () => listByType(session, 'MODEL_EXCHANGE');

beforeEach(() => {
	sequence = 0;
	delete process.env[AUTHORING_REVIEW_ALLOWANCE_VARIABLE];
	clearAuthoringTurns();
	resetEngine('empty');
	session = getEngine().as(SESSION_CREDENTIAL);
	send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
		pwaId: PWA,
		name: 'wordfreq',
		description: 'A PWA reviewed in parts, under an allowance.',
		domain: 'software',
		version: '1.0.0'
	});
	defineType(BUILD, 'Build', false);
	defineType(CHECK, 'Check', false);
	defineType(ROOT, 'Realize', true, [BUILD, CHECK]);
});
afterEach(() => {
	clearAuthoringTurns();
	delete process.env[AUTHORING_REVIEW_ALLOWANCE_VARIABLE];
});

describe('⭐⭐ L2 — D20: before each round the floor reserves its worst case, parts × 6, against the allowance', () => {
	it('the worst case a part is the validator’s own bound, six calls a review — the product’s constant', () => {
		expect([REVIEWER_CALLS_PER_REVIEW, WORST]).toEqual([6, 18]);
	});

	// ⛔ PREDICTED RED, read from the code at 59135143: `runPwaFloor` has no allowance — every round reviews every part, so a
	// round whose worst case passes the allowance by one call makes its three reviewer calls.
	it('⛔ RED — a round whose worst case passes the allowance by one call makes NO reviewer call: each part is recorded with the stated reason, the review is not SATISFIED, and the candidate is not accepted', async () => {
		const { floor, prompts } = await runRound(allowanceOf(String(WORST - 1)));

		expect(prompts, 'the round made reviewer calls past the allowance').toEqual([]);
		expect(exchanges(), 'an exchange was recorded for a round the allowance stopped').toEqual([]);
		expect(floor?.satisfied, 'a stopped round satisfied the floor').toBe(false);
		expect(review(floor)?.disposition, 'the review of a stopped round').toBe('INCONCLUSIVE');
		// ⭐ THE STATED REASON, ON EACH PART, BY THE HOST'S NAME FOR IT: its parts, the worst case and what is left — FIRST, as the
		// floor records any review that did not execute; beside it the `INDEPENDENCE_VIOLATION` the recording adds to every failed
		// review, no evaluator having run (`REG-F-463`; `assurance/floor-registry.test.ts`, RS-2's real shape).
		const left = { allowance: WORST - 1, left: WORST - 1, reserved: 0 };
		const failed = (part: string, name: string) => [
			['VALIDATOR_EXECUTION_FAILED', stopped(part, name, left)],
			['INDEPENDENCE_VIOLATION', 'validator execution failed']
		];
		expect(
			floor?.parts?.map((p) => [p.typeId, p.disposition, p.observations.map((o) => [o.code, o.statement])]),
			'each part of the stopped round, as the run returns it'
		).toEqual([
			[BUILD, 'INCONCLUSIVE', failed(BUILD, 'Build')],
			[CHECK, 'INCONCLUSIVE', failed(CHECK, 'Check')],
			[ROOT, 'INCONCLUSIVE', failed(ROOT, 'Realize')]
		]);
		// ⭐ NEVER A THROW, AND NEVER A FINDING: the floor answers it as a review that did not execute — an operational block,
		// so the authoring route stages the candidate BLOCKED_EXTERNAL and no one can accept it.
		const remediation = classifyFloorRemediation(floor!);
		expect([remediation.action, remediation.findings, isOperationalRemediation(remediation.action)]).toEqual([
			'RETRY_OR_CONFIGURE_REVIEWER',
			[],
			true
		]);
		// ⭐ LEGIBLE IN THE RECORD AND ON THE PAGE: the page's read of the round carries each part's reason.
		const page = loadPwaFloor(PWA, session);
		expect(page?.satisfied).toBe(false);
		expect(page?.reasoningGaps, 'the page’s read of the round does not carry the reason').toEqual([
			stopped(BUILD, 'Build', left),
			'validator execution failed',
			stopped(CHECK, 'Check', left),
			'validator execution failed',
			stopped(ROOT, 'Realize', left),
			'validator execution failed'
		]);
	});

	// ⭑ CONTROL — the boundary, from the other side: reaching the allowance is allowed.
	it('⭑ CONTROL — a round whose worst case is EXACTLY the allowance is reviewed, every part, as today', async () => {
		const { floor, prompts } = await runRound(allowanceOf(String(WORST)));

		expect(prompts, 'a round exactly at the allowance was stopped').toHaveLength(3);
		expect(floor?.satisfied).toBe(true);
		expect(floor?.parts?.map((p) => p.disposition)).toEqual(['SATISFIED', 'SATISFIED', 'SATISFIED']);
	});

	// ⛔ PREDICTED RED, read from the code at 59135143: nothing is reserved, so a second round — the refinement's — reviews every
	// part whatever the first round reserved.
	it('⛔ RED — a second round that would pass what the first left is stopped before its first call: the first reserved its worst case', async () => {
		const allowance = allowanceOf(String(WORST + WORST - 6));
		const first = await runRound(allowance);
		expect(first.prompts, 'arrangement: the first round, within the allowance, is reviewed').toHaveLength(3);

		const second = await runRound(allowance);

		expect(second.prompts, 'the second round made reviewer calls past what the first left').toEqual([]);
		expect(second.floor?.satisfied).toBe(false);
		expect(second.floor?.parts?.[0]?.observations.map((o) => o.statement)).toEqual([
			stopped(BUILD, 'Build', { allowance: WORST + WORST - 6, left: WORST - 6, reserved: WORST }),
			'validator execution failed'
		]);
	});

	it('⭑ CONTROL — an allowance holding both rounds’ worst cases reviews both', async () => {
		const allowance = allowanceOf(String(WORST + WORST));
		const first = await runRound(allowance);
		const second = await runRound(allowance);

		expect([first.prompts.length, second.prompts.length]).toEqual([3, 3]);
		expect(second.floor?.satisfied).toBe(true);
	});

	// ⛔ FAIL-CLOSED: a value that reads as no number of calls stops every round that has a part, and says so.
	it('⛔ an allowance that is not a whole number of calls stops the round before any call, naming the value', async () => {
		const { floor, prompts } = await runRound(allowanceOf('18 calls'));

		expect(prompts).toEqual([]);
		expect(floor?.parts?.[0]?.observations.map((o) => o.statement)).toEqual([
			'No reviewer call was made for this type: the authoring review’s allowance, ' +
				`${AUTHORING_REVIEW_ALLOWANCE_VARIABLE}="18 calls", is not a whole number of reviewer calls, so no round’s worst ` +
				'case can be reserved against it and no round with a type in it runs (REG-F-580; design D20). The round reviews ' +
				`3 type(s), "Build" (${BUILD}) among them; its worst case is 3 × 6 = 18 reviewer calls. This type is not ` +
				'reviewed and the candidate is not accepted.',
			'validator execution failed'
		]);
	});
});

describe('⭑ L2 — with no allowance, the product’s default, nothing changes', () => {
	// ⭑ CONTROL, BYTE FOR BYTE: the reviewer calls a round makes with the variable unset, blank, or white space, and with the
	// floor's own default (the process's allowance, the variable unset) — each the same prompts, one per part, in export order.
	it('⭑ CONTROL — unset, blank and white space are no allowance: the same reviewer calls, byte for byte, as the floor’s default makes', async () => {
		const byDefault = await runRound();
		const runs = [byDefault];
		for (const configured of [undefined, '', '  \t ']) {
			resetEngine('empty');
			session = getEngine().as(SESSION_CREDENTIAL);
			sequence = 100 * runs.length;
			send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
				pwaId: PWA,
				name: 'wordfreq',
				description: 'A PWA reviewed in parts, under an allowance.',
				domain: 'software',
				version: '1.0.0'
			});
			defineType(BUILD, 'Build', false);
			defineType(CHECK, 'Check', false);
			defineType(ROOT, 'Realize', true, [BUILD, CHECK]);
			runs.push(await runRound(allowanceOf(configured)));
		}

		expect(byDefault.prompts, 'the floor’s default made other than one call per part').toHaveLength(3);
		for (const run of runs.slice(1)) expect(run.prompts, 'no allowance changed the reviewer calls').toEqual(byDefault.prompts);
		expect(runs.map((r) => r.floor?.satisfied)).toEqual([true, true, true, true]);
		// ⭑ And a round as large as any: no allowance stops nothing, whatever the worst case.
		const none = allowanceOf(undefined);
		expect(none.reserve(Number.MAX_SAFE_INTEGER)).toEqual({ admitted: true });
	});
});
