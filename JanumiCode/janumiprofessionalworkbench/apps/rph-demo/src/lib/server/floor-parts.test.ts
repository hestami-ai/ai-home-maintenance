// ⭐⭐ `JAN-EXEC` Phase 7, THE REVIEW OF AN AUTHORED PWA IN PARTS, B3 and B4 (`REG-D-125`; DESIGN-authoring-review-in-parts.md
// D1, D5, D6, D7, D8; roadmap 9a.4, 9a.5) — THE FLOOR, ONE ROUND, RECORDED PART BY PART, AND READ BACK AS ONE ROUND.
//
// `runPwaFloor` reviewed a PWA as ONE graph, in one prompt, and one reviewer saw about half of a 16-type PWA once each
// type's prompt and policies were exported (`REG-F-571`). Now it runs the two deterministic policies once over the PWA
// and the Reasoning Review once over each type, its subject the type; it composes each part on its own, folds them to
// the strictest unresolved part's, and records the round under one floor-run token. `loadPwaFloor` reads the latest
// round back with its complete expected part inventory.
//
// ⭑ A REAL ENGINE, THE REAL RECORDER, THE REAL VALIDATOR — its model replaced at the `print` seam by a reply chosen per
// part, read off the part's own subject line. No model is called.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { listByType, type AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_CREDENTIAL } from './identity.js';
import { getEngine, mintUiId, resetEngine } from './workbench.js';
import {
	classifyFloorRemediation,
	loadPwaFloor,
	loadSubjectFloor,
	partsDisposition,
	reasoningReviewCriteria,
	refineDirective,
	runPwaFloor,
	type FloorObservationView,
	type FloorProducer,
	type FloorView
} from './floor.js';
import { clearingJudgement, withLiveReviewerSeam } from './assurance/clearing-reviewer.testing.js';
import { DEMO_POLICY_ID, DEMO_POLICY_PAYLOAD } from './assurance/demo-policy.js';
import { registerStipulation } from './stipulations.js';
import {
	beginAuthoringTurn,
	clearAuthoringTurns,
	hashAuthoringSubject,
	markAuthoringTurnAssured,
	markAuthoringTurnValid
} from './authoring-turn.js';

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5Q00';
/** Three types, defined in this order — the export's, and so the parts'. */
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q10';
const BUILD = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q11';
const CHECK = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q12';
const PRODUCER: FloorProducer = {
	agentId: 'jpwb-authoring-agent',
	modelId: 'pi-authoring',
	providerId: 'janumi'
};
const REVIEW = 'floor.reasoning-review';

let session: AuthedEngineHandle;
let sequence = 0;

function send(commandType: string, aggregateType: string, id: string, payload: unknown, correlationId = 'setup') {
	sequence += 1;
	const command: DomainCommand = {
		commandId: `parts-setup-${sequence}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: aggregateType,
		targetAggregateId: id,
		issuedAt: '2026-10-23T09:00:00Z',
		correlationId,
		idempotencyKey: `parts-setup-${sequence}`,
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

/** The type a part's prompt reviews: its subject line's type id, which the export writes first. */
const partOf = (prompt: string): string | undefined => /\{"subject":\{"type":\{"id":"([^"]+)"/.exec(prompt)?.[1];

/** A reply faulting the policy's first criterion with `statement`, every other criterion answered unfailed. */
const rejecting = (statement: string): string =>
	JSON.stringify({
		findings: reasoningReviewCriteria(session).map((c, i) => ({
			criterionId: c.id,
			failed: i === 0,
			statement: i === 0 ? statement : 'evaluated; the failure class is absent'
		})),
		recommendation: 'REJECTED',
		residualUncertainty: []
	});
/** A clean reply its reviewer recommends ESCALATED — rule (a)'s subject (`REG-D-089`). */
const escalatingClean = (): string =>
	JSON.stringify({ ...JSON.parse(clearingJudgement(reasoningReviewCriteria(session))), recommendation: 'ESCALATED' });

/** Run the floor on canonical with a reply per part (`answers[typeId]`, a clean one otherwise); the prompts in order. */
async function runRound(
	answers: Record<string, string | (() => never)> = {},
	opts: { readonly priorFindings?: readonly FloorObservationView[]; readonly candidateSubjectHash?: string } = {}
): Promise<{ readonly floor: FloorView | undefined; readonly prompts: string[] }> {
	const prompts: string[] = [];
	const floor = await withLiveReviewerSeam(() =>
		runPwaFloor(
			PWA,
			{
				prompt: 'Author the realization of wordfreq.',
				producer: PRODUCER,
				canonical: session,
				...opts,
				print: async (prompt) => {
					prompts.push(prompt);
					const answer = answers[partOf(prompt) ?? ''];
					if (typeof answer === 'function') return answer();
					return answer ?? clearingJudgement(reasoningReviewCriteria(session));
				}
			},
			session
		)
	);
	return { floor, prompts };
}

const review = (f: FloorView | undefined) => f?.policies.find((p) => p.policyId === REVIEW);
const assessments = () => listByType(session, 'ASSURANCE_ASSESSMENT');
const subjectOf = (row: { readonly state: Record<string, unknown> }) => (row.state.subjectObjectIds as string[])[0];
const firstEventOf = (id: string) => session.readAllEvents().find((e) => e.aggregateId === id)!;

beforeEach(() => {
	sequence = 0;
	process.env.JPWB_ASSURANCE_TOOL = 'agy';
	process.env.JPWB_JUDGE_MODEL = 'test-judge-model';
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
	delete process.env.JPWB_ASSURANCE_TOOL;
	delete process.env.JPWB_JUDGE_MODEL;
});

describe('⭐⭐ B3 — one round, one review per type, recorded part by part under one token', () => {
	it('⭐ RED — the round records each type’s review under the type at its stored version, the two deterministic policies under the PWA, all under one floor-run token', async () => {
		// PREDICTED RED BEFORE B3: one reasoning-review assessment, its subject the PWA, and one prompt over the whole graph.
		const { floor, prompts } = await runRound({}, { candidateSubjectHash: 'sha256:candidate' });
		expect(prompts.map(partOf), 'one prompt per part, sequentially, in export order').toEqual([BUILD, CHECK, ROOT]);
		const rows = assessments();
		expect(
			rows.map((a) => `${String(a.state.assurancePolicyId)}@${subjectOf(a)}`).sort(),
			'one review per type, the deterministic policies over the PWA'
		).toEqual(
			[
				`floor.identity-provenance@${PWA}`,
				`floor.schema-invariant@${PWA}`,
				`${REVIEW}@${BUILD}`,
				`${REVIEW}@${CHECK}`,
				`${REVIEW}@${ROOT}`
			].sort()
		);
		for (const a of rows.filter((x) => x.state.assurancePolicyId === REVIEW)) {
			const typeId = subjectOf(a);
			expect(
				(a.state.subjectSemanticVersions as Record<string, number>)[typeId],
				'the review is bound to the version the store holds of its type'
			).toBe(session.loadObject(typeId)!.semanticVersion);
		}
		const tokens = new Set(rows.map((a) => firstEventOf(a.id).correlationId));
		expect([...tokens], 'one token for the whole round').toHaveLength(1);
		expect([...tokens][0]).toMatch(/^authoring-floor:sha256:candidate:floorrun_/);
		// ⛔ A COMMAND PREFIX OF ITS OWN FOR EACH PLAN: the recorder numbers its commands from one in every plan, and a
		// repeated idempotency key is answered DUPLICATE — accepted by the recorder, and never applied. So every plan's
		// review is there above, and each is concluded here.
		expect(rows.map((a) => a.state.assessmentState), 'a plan’s commands were answered for another’s').toEqual(
			rows.map(() => 'SATISFIED')
		);
		expect(floor?.parts?.map((p) => [p.typeId, p.typeName, p.disposition])).toEqual([
			[BUILD, 'Build', 'SATISFIED'],
			[CHECK, 'Check', 'SATISFIED'],
			[ROOT, 'Realize', 'SATISFIED']
		]);
		expect(floor?.satisfied).toBe(true);
	});

	it('⭐ each part’s reviewer exchanges are recorded under the part’s own subject, with the round’s token', async () => {
		await runRound();
		const exchanges = listByType(session, 'MODEL_EXCHANGE').map((r) => r.state as Record<string, unknown>);
		expect(
			exchanges.map((e) => [e.subjectObjectId, e.subjectObjectType, e.subjectSemanticVersion]),
			'an exchange recorded under the PWA instead of its type'
		).toEqual(
			[BUILD, CHECK, ROOT].map((id) => [id, 'PWU_TYPE', session.loadObject(id)!.semanticVersion])
		);
		const token = firstEventOf(assessments()[0]!.id).correlationId;
		expect(new Set(exchanges.map((e) => e.runToken)), 'the exchanges carry the round’s token').toEqual(new Set([token]));
	});

	it('⛔ ONE REJECTED PART AMONG SATISFIED ONES KEEPS THE PWA REJECTED — its findings carry its type, from the host', async () => {
		const { floor } = await runRound({ [CHECK]: rejecting('The check reports runs it never made.') });
		expect(floor?.parts?.map((p) => p.disposition)).toEqual(['SATISFIED', 'REJECTED', 'SATISFIED']);
		expect(review(floor)?.disposition, 'the strictest part').toBe('REJECTED');
		expect(floor?.aggregate).toBe('REJECTED');
		expect(floor?.satisfied).toBe(false);
		const remediation = classifyFloorRemediation(floor!);
		expect(remediation.action).toBe('REFINE_SUBJECT');
		expect(remediation.findings.map((f) => [f.typeId, f.typeName, f.statement])).toEqual([
			[CHECK, 'Check', 'The check reports runs it never made.']
		]);
		// ⭐ AND THE READ-BACK IS THE SAME ROUND, PART BY PART.
		const back = loadPwaFloor(PWA, session);
		expect(back?.parts?.map((p) => p.disposition)).toEqual(['SATISFIED', 'REJECTED', 'SATISFIED']);
		expect(back?.aggregate).toBe('REJECTED');
		expect(review(back)?.observations.map((o) => o.typeId)).toEqual([CHECK]);
	});

	it('⛔ an OPERATIONAL failure of one part leaves the review incomplete, and never becomes a graph-edit instruction — even beside another part’s finding', async () => {
		const { floor } = await runRound({
			[BUILD]: () => {
				throw new Error('the reviewing tool did not respond');
			},
			[CHECK]: rejecting('The check reports runs it never made.')
		});
		expect(floor?.parts?.map((p) => p.disposition)).toEqual(['INCONCLUSIVE', 'REJECTED', 'SATISFIED']);
		expect(floor?.satisfied).toBe(false);
		const remediation = classifyFloorRemediation(floor!);
		expect(remediation.action, 'a failed review was answered by revising the graph').toBe(
			'RETRY_OR_CONFIGURE_REVIEWER'
		);
		expect([remediation.autoRefine, remediation.findings]).toEqual([false, []]);
	});

	it('⛔ an independence-invalid review blocks the round, and is answered by changing the reviewer', async () => {
		// The producer named as the reviewer's own model: every part's review fails §8.12's DIFFERENT_MODEL.
		const prompts: string[] = [];
		const floor = await withLiveReviewerSeam(() =>
			runPwaFloor(
				PWA,
				{
					prompt: 'Author it.',
					producer: { ...PRODUCER, modelId: 'test-judge-model', providerId: 'google' },
					canonical: session,
					print: async (prompt) => {
						prompts.push(prompt);
						return clearingJudgement(reasoningReviewCriteria(session));
					}
				},
				session
			)
		);
		expect(prompts, 'arrangement: every part was reviewed').toHaveLength(3);
		expect(floor?.parts?.every((p) => !p.independenceOk)).toBe(true);
		expect(floor?.satisfied).toBe(false);
		expect(classifyFloorRemediation(floor!).action).toBe('CHANGE_REVIEWER');
	});

	it('⭑ rule (a) across the round — a clean part its reviewer escalates beside a REJECTED part stays SATISFIED, its recommendation recorded beside it', async () => {
		const { floor } = await runRound({
			[BUILD]: escalatingClean(),
			[CHECK]: rejecting('The check reports runs it never made.')
		});
		expect(floor?.parts?.map((p) => p.disposition), 'the escalation was put in place of the block').toEqual([
			'SATISFIED',
			'REJECTED',
			'SATISFIED'
		]);
		expect(floor?.parts?.[0]?.observations.map((o) => o.code)).toEqual(['REVIEWER_RECOMMENDED_ESCALATION']);
		expect(classifyFloorRemediation(floor!).action).toBe('REFINE_SUBJECT');
		// CONTROL — nothing else blocking in the round: the same clean reply escalates its part, and the round routes to a human.
		const clean = await runRound({ [BUILD]: escalatingClean() });
		expect(clean.floor?.parts?.map((p) => p.disposition)).toEqual(['ESCALATED', 'SATISFIED', 'SATISFIED']);
		expect(review(clean.floor)?.disposition).toBe('ESCALATED');
		expect(classifyFloorRemediation(clean.floor!).action).toBe('ESCALATE_REVIEW');
	});

	it('⭐ B6 — each part is asked about with its PWA: a part’s own registration answers that part, the PWA’s every part', async () => {
		delete process.env.JPWB_ASSURANCE_TOOL;
		registerStipulation(getEngine(), { pwaId: PWA, framing: 'PWA_TYPE', typeId: CHECK, remaining: 'CLEAN' });
		const one = await runPwaFloor(PWA, { prompt: 'Author it.', producer: PRODUCER }, session);
		expect(one?.parts?.map((p) => p.disposition), 'only the registered part was stipulated').toEqual([
			'INCONCLUSIVE',
			'SATISFIED',
			'INCONCLUSIVE'
		]);
		registerStipulation(getEngine(), { pwaId: PWA, framing: 'PWA_TYPE', remaining: 'CLEAN' });
		const every = await runPwaFloor(PWA, { prompt: 'Author it.', producer: PRODUCER }, session);
		expect(every?.parts?.map((p) => p.disposition)).toEqual(['SATISFIED', 'SATISFIED', 'SATISFIED']);
	});
});

describe('⭐⭐ B3 — the round read back: the complete expected inventory, never an older part’s result', () => {
	it('⛔ a partial newer round borrows nothing: its missing parts are MISSING, and the floor is not satisfied', async () => {
		await runRound();
		expect(loadPwaFloor(PWA, session)?.satisfied, 'arrangement: round one satisfied').toBe(true);
		// A newer round that recorded its deterministic policy and nothing else — as a round whose recording stopped.
		const assessmentId = mintUiId('asmt');
		const version = session.loadObject(PWA)!.semanticVersion;
		send(
			'RequestAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			assessmentId,
			{
				assessmentId,
				assurancePolicyId: 'floor.schema-invariant',
				policyVersion: '1',
				subjectObjectIds: [PWA],
				subjectSemanticVersions: { [PWA]: version },
				claimIds: []
			},
			'authoring-floor:floorrun_partial'
		);
		const back = loadPwaFloor(PWA, session);
		expect(back?.reasoningReviewRunToken, 'the round with no part names no reviewer run').toBeUndefined();
		expect(back?.parts?.map((p) => p.disposition), 'an older round’s part was borrowed').toEqual([
			'MISSING',
			'MISSING',
			'MISSING'
		]);
		expect(back?.satisfied).toBe(false);
		expect(back?.aggregate).toBe('UNASSESSED');
	});

	it('⛔ a review bound to another version of its type is stale, and a type added since the round is missing: the inventory is the store’s now', async () => {
		await runRound();
		const round = loadPwaFloor(PWA, session)?.reasoningReviewRunToken;
		// The round's latest review of BUILD, bound to a version the store does not hold.
		const assessmentId = mintUiId('asmt');
		const stale = session.loadObject(BUILD)!.semanticVersion + 1;
		send(
			'RequestAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			assessmentId,
			{
				assessmentId,
				assurancePolicyId: REVIEW,
				policyVersion: '1',
				subjectObjectIds: [BUILD],
				subjectSemanticVersions: { [BUILD]: stale },
				claimIds: []
			},
			round
		);
		const after = loadPwaFloor(PWA, session);
		expect(after?.parts?.map((p) => [p.typeId, p.disposition])).toEqual([
			[BUILD, 'MISSING'],
			[CHECK, 'SATISFIED'],
			[ROOT, 'SATISFIED']
		]);
		expect(after?.satisfied).toBe(false);
		const added = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q13';
		defineType(added, 'Report', false);
		expect(loadPwaFloor(PWA, session)?.parts?.map((p) => p.typeId)).toEqual([BUILD, CHECK, ROOT, added]);
		expect(loadPwaFloor(PWA, session)?.parts?.at(-1)?.disposition).toBe('MISSING');
	});

	it('⭐ the execution plane’s reader of ONE subject’s floor lists its review’s findings and never the reviewer’s recommendation', async () => {
		// `loadSubjectFloor` is the per-policy reader `loadPwaFloor` was before the review in parts — the stopped-unit
		// recovery reads a work product's floor through it. Asked of one reviewed type, it reads that review alone.
		const escalatedFault = JSON.stringify({ ...JSON.parse(rejecting('The check reports runs it never made.')), recommendation: 'ESCALATED' });
		await runRound({ [CHECK]: escalatedFault });
		const one = loadSubjectFloor(CHECK, session);
		expect(review(one)?.observations.map((o) => o.code), 'arrangement: a finding and the recommendation').toEqual([
			reasoningReviewCriteria(session)[0]!.id,
			'REVIEWER_RECOMMENDED_ESCALATION'
		]);
		expect(one?.reasoningGaps).toEqual(['The check reports runs it never made.']);
		expect(one?.parts, 'a subject’s floor is no round of parts').toBeUndefined();
	});

	it('⭐ the fold — strictest unresolved, a PWA with no part UNASSESSED, an escalation kept as itself only alone', () => {
		const of = (...ds: string[]) => partsDisposition(ds.map((disposition) => ({ disposition })));
		expect(of(), 'the fold of nothing is not a pass').toBe('UNASSESSED');
		expect(of('SATISFIED', 'SATISFIED')).toBe('SATISFIED');
		expect(of('SATISFIED', 'REJECTED', 'MISSING')).toBe('REJECTED');
		expect(of('SATISFIED', 'MISSING')).toBe('UNASSESSED');
		expect(of('SATISFIED', 'ASSESSING')).toBe('UNASSESSED');
		expect(of('SATISFIED', 'CONDITIONALLY_SATISFIED')).toBe('CONDITIONALLY_SATISFIED');
		expect(of('SATISFIED', 'ESCALATED')).toBe('ESCALATED');
		expect(of('INCONCLUSIVE', 'ESCALATED')).toBe('INCONCLUSIVE');
	});
});

describe('⭐⭐ B4 — the turn: findings by type, the whole inventory again after refinement, acceptance of the exact candidate', () => {
	const finding = (typeId: string, typeName: string, statement: string, code = 'RR-01-no-problem-substitution') => ({
		code,
		severity: 'BLOCKING',
		statement,
		typeId,
		typeName
	});

	it('⭐ RED — the refinement directive groups the findings by the type the HOST names, whatever the prose names', () => {
		// PREDICTED RED BEFORE B4: a flat, numbered list of the round's first six findings, no type named.
		const directive = refineDirective('Build wordfreq.', [
			finding(BUILD, 'Build', 'The type "Check" skips its failure paths.'),
			finding(CHECK, 'Check', 'Reports a run it never made.')
		]);
		expect(directive).toContain(
			`Findings about the type "Build" (${BUILD}):\n1. [RR-01-no-problem-substitution] The type "Check" skips its failure paths.`
		);
		expect(directive).toContain(
			`Findings about the type "Check" (${CHECK}):\n1. [RR-01-no-problem-substitution] Reports a run it never made.`
		);
		expect(directive.indexOf('"Build"'), 'the types in the order their findings came').toBeLessThan(
			directive.indexOf('"Check" (')
		);
	});

	it('⛔ a bound on a type’s findings says what it left out — and a later type’s findings are never dropped', () => {
		const many = Array.from({ length: 8 }, (_, i) => finding(BUILD, 'Build', `Build finding ${i + 1}.`));
		const directive = refineDirective('Build wordfreq.', [...many, finding(ROOT, 'Realize', 'The root claims too much.')]);
		expect(directive).toContain('6. [RR-01-no-problem-substitution] Build finding 6.');
		expect(directive).not.toContain('Build finding 7.');
		expect(directive).toContain('(2 further finding(s) about this type are not listed here.)');
		expect(directive, 'a later type’s finding was dropped').toContain(
			`Findings about the type "Realize" (${ROOT}):\n1. [RR-01-no-problem-substitution] The root claims too much.`
		);
		// CONTROL — a type within its bound says nothing of omissions.
		expect(refineDirective('x', [finding(ROOT, 'Realize', 'One.')])).not.toContain('not listed here');
	});

	it('⭐ the re-review shows each part its OWN prior findings, never another type’s', async () => {
		const { prompts } = await runRound({}, {
			priorFindings: [finding(CHECK, 'Check', 'Reports a run it never made.')]
		});
		const shown = prompts.map((p) => [partOf(p), p.includes('Reports a run it never made.')]);
		expect(shown).toEqual([
			[BUILD, false],
			[CHECK, true],
			[ROOT, false]
		]);
	});

	it('⭐ after a refinement that removes one type and adds another, the round reviews the refined inventory under a new token, and no earlier result survives', async () => {
		await runRound({ [CHECK]: rejecting('Reports a run it never made.') });
		const first = new Set(assessments().map((a) => firstEventOf(a.id).correlationId));
		// The refinement: the check is removed, a report is added.
		send('EditPwuType', 'PWU_TYPE', ROOT, { pwuTypeId: ROOT, permittedChildTypeIds: [BUILD] });
		send('RemovePwuType', 'PWU_TYPE', CHECK, { pwuTypeId: CHECK });
		const report = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q14';
		defineType(report, 'Report', false);
		send('EditPwuType', 'PWU_TYPE', ROOT, { pwuTypeId: ROOT, permittedChildTypeIds: [BUILD, report] });
		const { floor, prompts } = await runRound();
		expect(prompts.map(partOf), 'the refined inventory, the removed type not reviewed').toEqual([BUILD, ROOT, report]);
		const second = [...new Set(assessments().map((a) => firstEventOf(a.id).correlationId))].filter((t) => !first.has(t));
		expect(second, 'a new round token').toHaveLength(1);
		expect(floor?.parts?.map((p) => [p.typeId, p.disposition])).toEqual([
			[BUILD, 'SATISFIED'],
			[ROOT, 'SATISFIED'],
			[report, 'SATISFIED']
		]);
		const back = loadPwaFloor(PWA, session);
		expect(back?.parts?.map((p) => p.typeId)).toEqual([BUILD, ROOT, report]);
		expect(back?.reasoningReviewRunToken).toBe(second[0]);
		expect(back?.satisfied, 'an earlier round’s rejection survived into the new one').toBe(true);
	});

	it('⛔ acceptance binds the complete candidate: a type changed after its round was reviewed is refused as stale', async () => {
		const turn = beginAuthoringTurn(PWA);
		const reviewed = markAuthoringTurnValid(turn);
		const floor = await withLiveReviewerSeam(() =>
			runPwaFloor(
				PWA,
				{
					prompt: 'Author it.',
					producer: PRODUCER,
					candidateSubjectHash: reviewed,
					print: async () => clearingJudgement(reasoningReviewCriteria(session))
				},
				turn.engine
			)
		);
		expect(floor?.satisfied, 'arrangement: the round satisfied the candidate').toBe(true);
		expect(turn.broker.editType(CHECK, { purpose: 'Check something else' }).ok).toBe(true);
		expect(hashAuthoringSubject(turn), 'arrangement: the candidate changed').not.toBe(reviewed);
		expect(() => markAuthoringTurnAssured(turn, reviewed)).toThrow(
			`Assurance is stale: reviewer subject ${reviewed}, current candidate ${hashAuthoringSubject(turn)}.`
		);
	});
});

// ── ⭐⭐ D3a (`REG-D-127`; `REG-F-573`) — THE FLOOR HANDS EACH PART THE LIBRARY OF THE ENGINE IT REVIEWS ────────────────────
const IMPLEMENT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q13';
/** A part's line of JSON, as its prompt carries it inside the fence: the subject's, or the context's. */
function partLine(prompt: string, key: 'subject' | 'context'): Record<string, unknown> {
	const line = prompt.split('\n').find((l) => l.startsWith(`{"${key}":`));
	expect(line, `the prompt carries the part's ${key} line`).toBeDefined();
	return (JSON.parse(line!) as Record<string, Record<string, unknown>>)[key]!;
}

describe('⭐⭐ D3a (REG-D-127) — the floor hands each part the policy library of the engine it reviews: the declared policies named, and those the kind may take', () => {
	it('⛔ RED FIRST — through the materialized prompt: a PRODUCT_IMPLEMENTATION type declaring Intent Preservation alone shows its declared policy named, and Test Adequacy’s id, name and purpose among those its kind may take; ⛔ CONTROLS: no floor policy, and not a suspended one; a policy naming no kind listed for every type', async () => {
		// An inactive policy its kind names (Assumption Disclosure, suspended), and an ACTIVE one naming no kind (the demo's).
		send('SuspendAssurancePolicy', 'ASSURANCE_POLICY', 'pol_assumption_disclosure', { policyId: 'pol_assumption_disclosure' });
		send('CreateAssurancePolicy', 'ASSURANCE_POLICY', DEMO_POLICY_ID, DEMO_POLICY_PAYLOAD);
		send('ActivateAssurancePolicy', 'ASSURANCE_POLICY', DEMO_POLICY_ID, { policyId: DEMO_POLICY_ID });
		send('DefinePwuType', 'PWU_TYPE', IMPLEMENT, {
			pwuTypeId: IMPLEMENT,
			pwaId: PWA,
			pwuKind: 'PRODUCT_IMPLEMENTATION',
			name: 'Implementation',
			purpose: 'Build wordfreq with its unit tests.',
			isRoot: false,
			permittedChildTypeIds: [],
			requiredInputs: [],
			requiredOutputs: [],
			requiredAssurancePolicyIds: ['pol_intent_preservation']
		});
		const { prompts } = await runRound();
		const implementation = prompts.find((p) => partOf(p) === IMPLEMENT)!;
		expect(partLine(implementation, 'subject').declaredPolicies, 'its declared policy, named as the library holds it').toEqual([
			{
				id: 'pol_intent_preservation',
				name: 'Intent Preservation',
				purpose: 'Determine whether a transformation of professional work remains faithful to the authorized intent.'
			}
		]);
		const applicable = partLine(implementation, 'context').applicablePolicies as { id: string }[];
		expect(applicable, 'Test Adequacy, which it does not declare, among those its kind may take').toContainEqual({
			id: 'pol_test_adequacy',
			name: 'Test Adequacy',
			purpose: 'Determine whether the available tests are sufficient to support the claims being made.'
		});
		expect(applicable.map((p) => p.id), 'the library’s ACTIVE non-floor policies its kind names, or that name none').toEqual([
			'pol_intent_preservation',
			'pol_test_adequacy',
			DEMO_POLICY_ID
		]);
		// ⭑ CONTROL — a type of a kind no seeded policy names is shown the no-kind policy alone.
		const build = prompts.find((p) => partOf(p) === BUILD)!;
		expect((partLine(build, 'context').applicablePolicies as { id: string }[]).map((p) => p.id)).toEqual([DEMO_POLICY_ID]);
		expect(partLine(build, 'subject').declaredPolicies, 'a type that declares none, named as none').toEqual([]);
	});
});
