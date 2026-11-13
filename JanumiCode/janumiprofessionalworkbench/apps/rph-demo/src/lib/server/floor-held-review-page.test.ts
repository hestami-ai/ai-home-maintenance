// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L14 — design D68 as amended (`REG-D-158`; the lead's decisions (a) to (c), and the page-read red (c) leaves to
// the builder's judgement) — THROUGH THE PWA PAGE'S OWN READ: A ROUND THAT HOLDS A TYPE INCONCLUSIVE FOR A FAILED CHECK, BESIDE A TYPE THE
// ROUND HOLDS NO CONCLUDED REVIEW OF, IS ANSWERED AS A REJECTED ONE, AND THE PAGE SAYS TO REVISE.
//
// ⛔ WHAT WAS WRONG. Package L13 answered a held review as a rejected one only where the round's fold was INCONCLUSIVE. The page reads the
// latest round with its complete expected inventory (`loadPwaFloor`): a type the round holds no review of — added since the round, or
// reviewed at another version — is a MISSING part, and a part whose latest review in the round is recorded in a state no completion
// concludes in (READY, after a newer request) is read as that state. Either folds the round UNASSESSED (`partsDisposition`), so the page
// said revising does not address a block whose review named a problem — where a REJECTED type beside the same part folds the round
// REJECTED and the page says to revise. The authoring route never makes such a round (`runPwaFloor` records a concluded review of every part
// it lists), and a unit's review has no parts; the page's read does. ⚠ A type EDITED after its round is not one: an edit raises the PWA's
// version, not the type's, so the round's review of it stays bound to the version the store holds (measured, l14-facts.md §4).
// ⭑ WHAT MUST HOLD (`REG-D-158`). The page's floor still folds UNASSESSED — the record and the aggregate unchanged — and only the answer moves:
// REFINE_SUBJECT with the held type's check under its type, the hint REVISE, and the escalation note, keyed on the hint, beside the findings.
// A type whose review could not tell, beside the same part, reads as today, word for word.
//
// ⭑ floor-parts.test.ts's arrangement, restated (a test file's fixtures are its own): a real engine, the real recorder, the real validator,
// its model replaced at the `print` seam by a reply per part, read off the part's own subject line (a criterion repair's prompt opens with
// its part's, so it is answered the same way); for a round's duration PATH finds no program (`withLiveReviewerSeam`), and the decision model
// is the product's double. The page's `load` is called in-process, as `authoring-route-substituted-reviewer.test.ts` calls it. The
// statements are stand-ins; no model is asked anything.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { load } from '../../routes/pwa/[id]/+page.server.js';
import { clearingJudgement, withLiveReviewerSeam } from './assurance/clearing-reviewer.testing.js';
import { clearAuthoringTurns } from './authoring-turn.js';
import {
	classifyFloorRemediation,
	reasoningReviewCriteria,
	runPwaFloor,
	type EscalationRecommendationNote,
	type FloorBlockedHint,
	type FloorProducer,
	type FloorView
} from './floor.js';
import { SESSION_CREDENTIAL } from './identity.js';
import { getEngine, mintUiId, resetEngine } from './workbench.js';

// The product's configured decision model stood in for by its double, which asks no model (`floor-parts.test.ts`'s mock, restated).
vi.mock('./assurance/decision-model.js', async (importOriginal) => {
	const { TEST_INDICATIONS } = await import('./assurance/indications.testing.js');
	return { ...(await importOriginal<typeof import('./assurance/decision-model.js')>()), configuredIndications: () => TEST_INDICATIONS };
});

type LoadEvent = Parameters<typeof load>[0];

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5R00';
/** Three types, defined in this order — the export's, and so the parts'; and one added after the round. */
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5R10';
const BUILD = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5R11';
const CHECK = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5R12';
const ADDED = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5R13';
const PRODUCER: FloorProducer = { agentId: 'jpwb-authoring-agent', modelId: 'pi-authoring', providerId: 'janumi' };
const REVIEW = 'floor.reasoning-review';
/** The held type's failed check — a stand-in statement. */
const HELD_FAULT = 'The build is said to pass a suite it never ran.';
/** The classifier's answers, verbatim (`floor.ts`) — restated, so a change to either reddens here. */
const REFINE_GUIDANCE =
	'PublishPwa remains blocked while valid Reasoning Review findings are open. Revise the reviewed PWA graph and/or its recorded professional rationale as the coded findings require, then rerun assurance.';
const INCOMPLETE_GUIDANCE =
	'PublishPwa remains blocked because the mandatory Reasoning Review is incomplete but produced no valid subject finding. Inspect the recorded policy result, configure or change the reviewer as needed, and rerun assurance. Do not revise the PWA or record a waiver merely to clear an incomplete review.';

let session: AuthedEngineHandle;
let sequence = 0;

function send(commandType: string, aggregateType: string, id: string, payload: unknown, correlationId = 'setup') {
	sequence += 1;
	const command: DomainCommand = {
		commandId: `held-page-setup-${sequence}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: aggregateType,
		targetAggregateId: id,
		issuedAt: '2026-10-23T09:00:00Z',
		correlationId,
		idempotencyKey: `held-page-setup-${sequence}`,
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

/** The policy's checks, as the store holds them. */
const checks = () => reasoningReviewCriteria(session);
/** The type a part's prompt reviews: its subject line's type id, which the export writes first. */
const partOf = (prompt: string): string | undefined => /\{"subject":\{"type":\{"id":"([^"]+)"/.exec(prompt)?.[1];
/** A reply recommending SATISFIED with the policy's second check failed — the sixth run's shape: the boundary refuses a SATISFIED over an
 *  unmet mandatory check, and the floor holds the type INCONCLUSIVE, the check beside it at the policy's BLOCKING. */
const held = (): string =>
	JSON.stringify({
		findings: checks().map((c, i) => ({
			criterionId: c.id,
			failed: i === 1,
			statement: i === 1 ? HELD_FAULT : 'evaluated; the failure class is absent'
		})),
		recommendation: 'SATISFIED',
		residualUncertainty: []
	});
/** A reply answering every check but the LAST, unfailed: a review that could not tell — INCONCLUSIVE, nothing observed. */
const unanswered = (): string =>
	JSON.stringify({
		findings: checks()
			.slice(0, -1)
			.map((c) => ({ criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent' })),
		recommendation: 'SATISFIED',
		residualUncertainty: []
	});
/** A clean reply its reviewer recommends ESCALATED: beside a type left unresolved the part stays SATISFIED, the recommendation recorded. */
const escalatingClean = (): string => JSON.stringify({ ...JSON.parse(clearingJudgement(checks())), recommendation: 'ESCALATED' });

/** Run the floor on canonical with a reply per part (`answers[typeId]`, a clean one otherwise): the round as the route returns it. */
async function runRound(answers: Record<string, () => string> = {}): Promise<FloorView | undefined> {
	return withLiveReviewerSeam(() =>
		runPwaFloor(
			PWA,
			{
				prompt: 'Author the realization of wordfreq.',
				producer: PRODUCER,
				canonical: session,
				print: async (prompt) => answers[partOf(prompt) ?? '']?.() ?? clearingJudgement(checks())
			},
			session
		)
	);
}

/** What the page's load hands the floor panel, read in-process as the browser's request reads it. */
async function loadThePage(): Promise<{
	floor?: FloorView;
	floorBlockedHint?: FloorBlockedHint;
	escalationRecommendationNote?: EscalationRecommendationNote;
}> {
	return (await load({ params: { id: PWA } } as unknown as LoadEvent)) as {
		floor?: FloorView;
		floorBlockedHint?: FloorBlockedHint;
		escalationRecommendationNote?: EscalationRecommendationNote;
	};
}

/** Each part of a floor: its type, its disposition and its recorded codes. */
const partsOf = (floor: FloorView | undefined) => floor?.parts?.map((p) => [p.typeId, p.disposition, p.observations.map((o) => o.code)]);
/** The classifier's answer over a floor: its action, autoRefine, findings by type, code and statement, and guidance. */
const answerOf = (floor: FloorView | undefined) => {
	const r = classifyFloorRemediation(floor!);
	return [r.action, r.autoRefine, r.findings.map((f) => [f.typeId, f.code, f.statement]), r.guidance];
};

beforeEach(() => {
	sequence = 0;
	clearAuthoringTurns();
	resetEngine('empty');
	session = getEngine().as(SESSION_CREDENTIAL);
	send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
		pwaId: PWA,
		name: 'wordfreq',
		description: 'A PWA reviewed in parts.',
		domain: 'software',
		version: '1.0.0'
	});
	defineType(BUILD, 'Build', false);
	defineType(CHECK, 'Check', false);
	defineType(ROOT, 'Realize', true, [BUILD, CHECK]);
});
afterEach(() => {
	clearAuthoringTurns();
});

describe('⭐⭐ L14 — REG-D-158: through the PWA page’s own read, a held type beside a type the round holds no concluded review of is answered as a rejected one', () => {
	// ⛔ PREDICTED RED, read from the code at 769394ba and measured by the build's probe before this test was placed: the page's fold is
	// UNASSESSED, which the classifier answers RETRY_OR_CONFIGURE_REVIEWER, so the hint reads NOT_BY_REVISION and the note
	// WITH_AN_INCOMPLETE_REVIEW. Its arrangements (the round, the page's inventory, its fold) green before it.
	it('⭐ RED — a type added since the round: the page’s floor still folds UNASSESSED, and its hint says to revise — the held type’s check the one finding under its type, and the escalation note beside the findings', async () => {
		const ran = await runRound({ [BUILD]: held, [ROOT]: escalatingClean });
		expect(partsOf(ran), 'arrangement: the round as the route returns it — Build held for its check, Realize passed, its reviewer’s recommendation beside it').toEqual([
			[BUILD, 'INCONCLUSIVE', [checks()[1]!.id]],
			[CHECK, 'SATISFIED', []],
			[ROOT, 'SATISFIED', ['REVIEWER_RECOMMENDED_ESCALATION']]
		]);
		defineType(ADDED, 'Report', false);

		const shown = await loadThePage();

		expect(partsOf(shown.floor), 'arrangement: the page’s inventory, the type added since the round MISSING').toEqual([
			[BUILD, 'INCONCLUSIVE', [checks()[1]!.id]],
			[CHECK, 'SATISFIED', []],
			[ROOT, 'SATISFIED', ['REVIEWER_RECOMMENDED_ESCALATION']],
			[ADDED, 'MISSING', []]
		]);
		expect(shown.floor?.aggregate, 'the page’s fold, which the ruling leaves as it is').toBe('UNASSESSED');
		expect(shown.floorBlockedHint, 'the page does not read the hint for a revision').toBe('REVISE');
		expect(shown.escalationRecommendationNote, 'the escalation note does not follow the hint').toBe('BESIDE_FINDINGS');
		expect(answerOf(shown.floor), 'the floor the page shows is not answered as a rejected one').toEqual([
			'REFINE_SUBJECT',
			true,
			[[BUILD, checks()[1]!.id, HELD_FAULT]],
			REFINE_GUIDANCE
		]);
	});

	// ⛔ PREDICTED RED, as the one above: the newer request leaves Check's latest review in the round READY, which the fold reads as no
	// concluded review, so the page's fold is UNASSESSED and its hint NOT_BY_REVISION.
	it('⭐ RED — a newer request for another type’s review under the round’s token: that part READY, a state no completion concludes in, the page’s floor UNASSESSED, and its hint says to revise — the held type’s check the one finding under its type', async () => {
		await runRound({ [BUILD]: held });
		const before = await loadThePage();
		expect([before.floor?.aggregate, before.floorBlockedHint], 'arrangement: the round as the page first reads it — package L13’s rule').toEqual([
			'INCONCLUSIVE',
			'REVISE'
		]);
		const token = before.floor?.reasoningReviewRunToken;
		expect(token, 'arrangement: the round’s token').toBeDefined();
		const assessmentId = mintUiId('asmt');
		send(
			'RequestAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			assessmentId,
			{
				assessmentId,
				assurancePolicyId: REVIEW,
				policyVersion: '1',
				subjectObjectIds: [CHECK],
				subjectSemanticVersions: { [CHECK]: session.loadObject(CHECK)!.semanticVersion },
				claimIds: []
			},
			token
		);

		const shown = await loadThePage();

		expect(partsOf(shown.floor), 'arrangement: the page’s inventory, Check’s latest review in the round READY').toEqual([
			[BUILD, 'INCONCLUSIVE', [checks()[1]!.id]],
			[CHECK, 'READY', []],
			[ROOT, 'SATISFIED', []]
		]);
		expect(shown.floor?.aggregate, 'the page’s fold, which the ruling leaves as it is').toBe('UNASSESSED');
		expect(shown.floorBlockedHint, 'the page does not read the hint for a revision').toBe('REVISE');
		expect(answerOf(shown.floor), 'the floor the page shows is not answered as a rejected one').toEqual([
			'REFINE_SUBJECT',
			true,
			[[BUILD, checks()[1]!.id, HELD_FAULT]],
			REFINE_GUIDANCE
		]);
	});

	// ⭑ L13'S OLD PROMISE, KEPT WHERE IT STILL HOLDS, THROUGH THE PAGE: a type whose review could not tell — a check left unanswered, recorded
	// INCONCLUSIVE with nothing observed — beside a type added since the round reads as today, word for word. Green at 769394ba and after.
	it('⭑ CONTROL — a type whose review could not tell (a check left unanswered), beside a type added since the round: the page reads as today, word for word — UNASSESSED, revising does not address it, no note, the incomplete review’s answer, nothing sent back', async () => {
		const ran = await runRound({ [BUILD]: unanswered });
		expect(partsOf(ran), 'arrangement: Build’s review could not tell — INCONCLUSIVE, nothing observed').toEqual([
			[BUILD, 'INCONCLUSIVE', []],
			[CHECK, 'SATISFIED', []],
			[ROOT, 'SATISFIED', []]
		]);
		defineType(ADDED, 'Report', false);

		const shown = await loadThePage();

		expect(partsOf(shown.floor)?.at(-1), 'arrangement: the type added since the round').toEqual([ADDED, 'MISSING', []]);
		expect([shown.floor?.aggregate, shown.floorBlockedHint, shown.escalationRecommendationNote]).toEqual([
			'UNASSESSED',
			'NOT_BY_REVISION',
			undefined
		]);
		expect(classifyFloorRemediation(shown.floor!)).toEqual({
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance: INCOMPLETE_GUIDANCE
		});
	});
});
