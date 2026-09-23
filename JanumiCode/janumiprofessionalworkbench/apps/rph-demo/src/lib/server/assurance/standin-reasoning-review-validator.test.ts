// ⭐⭐ THE DECLARED STAND-IN, RULE BY RULE (`JAN-CRITREAD` J1-2; `DESIGN-what-the-tests-prove.md` §4.1; `REG-D-071`).
//
// The stand-in is the structural checker plus a CLEAN answer the TEST stipulates for what the checker cannot judge.
// Every rule of §4.1 is a test here, and each names the mutant that deletes it.
import { describe, expect, it } from 'vitest';
import {
	composeAssuranceOutcome,
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorResult
} from '@janumipwb/rph-assurance';
import type { ObservedToolCallReport } from '@janumipwb/rph-contracts';
import { buildPwaGraphExport, type PwaGraphNode } from '@janumipwb/rph-projections';
import { judgeStructurally } from './mock-reasoning-review-validator.js';
import {
	createStandinReasoningReviewValidator,
	STANDIN_VALIDATOR_ID,
	type StipulationLookup
} from './standin-reasoning-review-validator.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'pwa_01ARZ3NDEKTSV4RRFFQ69G5S01',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'authoring-agent', modelId: 'mock-author', providerId: 'jpwb' }
};

const node = (over: Partial<PwaGraphNode>): PwaGraphNode =>
	({
		id: 'root',
		name: 'root',
		pwuKind: 'PRODUCT_REALIZATION',
		isRoot: true,
		permittedChildTypeIds: [],
		requiredInputs: [],
		requiredOutputs: [],
		...over
	}) as PwaGraphNode;
const graph = (nodes: PwaGraphNode[]) =>
	JSON.stringify(
		buildPwaGraphExport(
			{ id: 'pwa_t', name: 'T', domain: 'software', version: '0.1.0', publicationStatus: 'DRAFT' } as never,
			nodes
		)
	);
/** A well-formed graph the checker passes on both of its criteria. */
const CLEAN_GRAPH = graph([node({})]);
/** The same root producing an output nobody consumes — the checker's real RR-04 fault. */
const DEAD_END_GRAPH = graph([node({ requiredOutputs: ['report'] })]);

const ALL = SEEDED_REASONING_REVIEW_CRITERIA.map((c) => c.id);
const always =
	(answer: 'CLEAN' | undefined): StipulationLookup =>
	() =>
		answer;

async function review(
	framing: 'PWA_GRAPH' | 'WORK_PRODUCT' | 'PROCESS_RESULT',
	content: string,
	lookup: StipulationLookup,
	observedToolCalls?: ObservedToolCallReport
): Promise<ValidatorResult> {
	return createStandinReasoningReviewValidator({ stipulationFor: lookup }).evaluate(SUBJECT, {
		reasoningReview: {
			content,
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			framing,
			prompt: 'Produce the requirements document for the thing.',
			...(observedToolCalls ? { observedToolCalls } : {})
		}
	} as never);
}

const judgedRows = (r: ValidatorResult) =>
	r.criteria.filter((c) => c.outcome !== 'UNABLE_TO_DETERMINE').map((c) => `${c.criterionId}=${c.outcome}`).sort();
const stipulatedRows = (r: ValidatorResult) =>
	r.criteria.filter((c) => c.stipulated === 'MET').map((c) => c.criterionId).sort();
const unjudgedUnstipulated = (r: ValidatorResult) =>
	r.criteria.filter((c) => c.outcome === 'UNABLE_TO_DETERMINE' && c.stipulated === undefined).map((c) => c.criterionId);

/** The reasoning review's disposition in an engine that ADMITS stipulations — what the lane will record. */
const admittedDisposition = (r: ValidatorResult) =>
	composeAssuranceOutcome(
		SUBJECT,
		deMinimisFloorPlan(SUBJECT).filter((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW),
		[r],
		{ admitStipulatedAnswers: true }
	).perPolicy[0]?.disposition;

describe('⭐ the stand-in — the checker’s real answers plus the test’s stipulated remainder', () => {
	it('⭐ rule 3 — a clean graph with a registration: 2 evaluated, 7 stipulated, SATISFIED in an admitting engine', async () => {
		const r = await review('PWA_GRAPH', CLEAN_GRAPH, always('CLEAN'));
		expect(r.validatorId).toBe(STANDIN_VALIDATOR_ID);
		expect(judgedRows(r)).toEqual(['RR-04-no-proxy-satisfaction=MET', 'RR-09-no-completeness-from-existence=MET']);
		expect(stipulatedRows(r)).toHaveLength(7);
		expect(unjudgedUnstipulated(r)).toEqual([]);
		expect(r.dispositionRecommendation).toBe('SATISFIED');
		expect(admittedDisposition(r)).toBe('SATISFIED');
	});

	it('⛔ rule 4 — no registration: the remainder is NOT answered, and the review is INCONCLUSIVE (not a throw)', async () => {
		// THE MUTANT: default to a stipulation. Every unregistered review on the lane would then pass.
		const r = await review('PWA_GRAPH', CLEAN_GRAPH, always(undefined));
		expect(r.executionFailed, 'fail-closed, never VALIDATOR_FAILED').toBe(false);
		expect(stipulatedRows(r)).toEqual([]);
		expect(unjudgedUnstipulated(r)).toHaveLength(7);
		expect(admittedDisposition(r)).toBe('INCONCLUSIVE');
	});

	it('⛔ rule 6 — the recommendation is DERIVED: unregistered, it is INCONCLUSIVE though the checker says SATISFIED', async () => {
		// THE MUTANT: copy the checker's constant. The mock's clean arms recommend SATISFIED over two of nine
		// (`REG-F-418`); the stand-in must not carry that shape.
		expect(judgeStructurally({ content: CLEAN_GRAPH, criteria: SEEDED_REASONING_REVIEW_CRITERIA, framing: 'PWA_GRAPH', prompt: 'x' } as never).recommendation).toBe('SATISFIED');
		const r = await review('PWA_GRAPH', CLEAN_GRAPH, always(undefined));
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
	});

	it('⛔ a stipulation never overrules a real fault — the dead end stays REJECTED, RR-04 NOT_MET and unstipulated', async () => {
		// The checker's RR-04 row is its own; the remainder is derived from what it judged, so RR-04 is never in it.
		const r = await review('PWA_GRAPH', DEAD_END_GRAPH, always('CLEAN'));
		expect(r.criteria.find((c) => c.criterionId === 'RR-04-no-proxy-satisfaction')).toMatchObject({ outcome: 'NOT_MET' });
		expect(r.criteria.find((c) => c.criterionId === 'RR-04-no-proxy-satisfaction')).not.toHaveProperty('stipulated');
		expect(stipulatedRows(r)).toHaveLength(7);
		expect(admittedDisposition(r)).toBe('REJECTED');
	});

	it('⛔ rule 2 — an UNREADABLE subject is never stipulated over, even with a registration', async () => {
		// THE MUTANT: stipulate over what the checker could not read. The whole rubric would then be answered by the
		// test for a subject nobody read at all.
		const r = await review('PWA_GRAPH', 'not json at all', always('CLEAN'));
		expect(stipulatedRows(r)).toEqual([]);
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
		expect(admittedDisposition(r)).toBe('INCONCLUSIVE');
	});

	it('⭐ the work-product arm: content judged on RR-01 and RR-04, the other 7 stipulated', async () => {
		const r = await review('WORK_PRODUCT', JSON.stringify({ findings: ['the load path is sound'] }), always('CLEAN'));
		expect(judgedRows(r)).toEqual(['RR-01-no-problem-substitution=MET', 'RR-04-no-proxy-satisfaction=MET']);
		expect(stipulatedRows(r)).toHaveLength(7);
		expect(admittedDisposition(r)).toBe('SATISFIED');
	});

	it('⛔ the work-product arm: an EMPTY product is still REJECTED — RR-04 is the checker’s, 8 stipulated', async () => {
		const r = await review('WORK_PRODUCT', JSON.stringify({}), always('CLEAN'));
		expect(judgedRows(r)).toEqual(['RR-04-no-proxy-satisfaction=NOT_MET']);
		expect(stipulatedRows(r)).toHaveLength(8);
		expect(admittedDisposition(r)).toBe('REJECTED');
	});

	it('⛔ the process-result arm is NEVER stipulated — the lookup is not even asked', async () => {
		let asked = 0;
		const r = await review(
			'PROCESS_RESULT',
			'ok',
			() => {
				asked++;
				return 'CLEAN';
			},
			{
				observation: 'OBSERVED',
				calls: [{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: 'run_command', outcome: 'COMPLETED' }],
				observedCount: 1,
				recordedLimit: 32
			}
		);
		expect(asked).toBe(0);
		expect(stipulatedRows(r)).toEqual([]);
	});

	it('⭐ the remainder is DERIVED from the policy in force — a tenth criterion is stipulated too, never hand-listed', async () => {
		const tenth = { ...SEEDED_REASONING_REVIEW_CRITERIA[0]!, id: 'RR-10-hypothetical' };
		const r = await createStandinReasoningReviewValidator({ stipulationFor: always('CLEAN') }).evaluate(SUBJECT, {
			reasoningReview: {
				content: CLEAN_GRAPH,
				criteria: [...SEEDED_REASONING_REVIEW_CRITERIA, tenth],
				framing: 'PWA_GRAPH',
				prompt: 'x'
			}
		} as never);
		expect(stipulatedRows(r)).toContain('RR-10-hypothetical');
		expect(stipulatedRows(r)).toHaveLength(ALL.length + 1 - 2);
	});

	it('⭐ it discloses itself in `limitations` — what was evaluated and what the test stipulated', async () => {
		const r = await review('PWA_GRAPH', CLEAN_GRAPH, always('CLEAN'));
		expect(r.limitations.join(' ')).toContain('2 criteria evaluated by the structural checker; 7 stipulated CLEAN by the test and NOT reviewed');
	});
});
