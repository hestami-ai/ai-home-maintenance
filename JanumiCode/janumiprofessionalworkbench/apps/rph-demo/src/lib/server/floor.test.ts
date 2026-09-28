// The de minimis floor's identity/provenance step (§8.4 step 2) must CHECK the subject, not assert it. This locks
// the derivation that replaced five literal `true`s (findings 18/67): a PWA missing a stable id, semantic version,
// provenance, or an identified producer must fail its mandatory criterion. Mutation proof: revert any derived fact
// below to a literal `true` and the matching case here goes red.
import { describe, expect, it } from 'vitest';
import {
	classifyFloorRemediation,
	identityProvenanceFactsOf,
	isOperationalRemediation
} from './floor.js';
import type { FloorProducer, FloorRemediationAction, FloorView } from './floor.js';

const PRODUCER: FloorProducer = {
	agentId: 'authoring-agent',
	modelId: 'gpt-5.4',
	providerId: 'openai'
};
const GOOD_PWA: Record<string, unknown> = {
	id: 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00',
	semanticVersion: 2,
	provenance: { originType: 'USER_INPUT', sourceObjectIds: [], sourceEventIds: [] }
};

describe('identityProvenanceFactsOf — §8.4 step 2 CHECKS the subject, never asserts it', () => {
	it('a well-formed PWA + resolved producer satisfies the four derivable facts', () => {
		const f = identityProvenanceFactsOf(GOOD_PWA, PRODUCER);
		expect(f.hasStableId).toBe(true);
		expect(f.hasSemanticVersion).toBe(true);
		expect(f.hasProvenance).toBe(true);
		expect(f.hasProducer).toBe(true);
	});

	it('a PWA with NO provenance fails IP-03 (was a literal true — could never fail)', () => {
		const { provenance: _omit, ...noProv } = GOOD_PWA;
		expect(identityProvenanceFactsOf(noProv, PRODUCER).hasProvenance).toBe(false);
	});

	it('a PWA with an empty id fails IP-01', () => {
		expect(identityProvenanceFactsOf({ ...GOOD_PWA, id: '' }, PRODUCER).hasStableId).toBe(false);
	});

	it('a PWA with no semantic version fails IP-02', () => {
		const { semanticVersion: _omit, ...noVer } = GOOD_PWA;
		expect(identityProvenanceFactsOf(noVer, PRODUCER).hasSemanticVersion).toBe(false);
	});

	it('an unidentified producer (no agent id) fails IP-04', () => {
		const anon: FloorProducer = { agentId: '', modelId: '', providerId: '' };
		expect(identityProvenanceFactsOf(GOOD_PWA, anon).hasProducer).toBe(false);
	});
});

const floorView = (overrides: Partial<FloorView> = {}): FloorView => ({
	subjectId: 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00',
	aggregate: 'INCONCLUSIVE',
	satisfied: false,
	waived: false,
	policies: [],
	reasoningGaps: [],
	...overrides
});

const reviewPolicy = (
	overrides: Partial<FloorView['policies'][number]> = {}
): FloorView['policies'][number] => ({
	policyId: 'floor.reasoning-review',
	disposition: 'INCONCLUSIVE',
	independenceOk: true,
	observations: [],
	...overrides
});

describe('classifyFloorRemediation — operational assurance failures never become graph edits', () => {
	it('auto-refines a valid coded Reasoning Review subject finding', () => {
		const finding = {
			code: 'RR-02-no-obligation-elision',
			severity: 'BLOCKING',
			statement: 'A delegated deployment obligation is absent.'
		};
		const result = classifyFloorRemediation(
			floorView({ policies: [reviewPolicy({ disposition: 'REJECTED', observations: [finding] })] })
		);

		expect(result.action).toBe('REFINE_SUBJECT');
		expect(result.autoRefine).toBe(true);
		expect(result.findings).toEqual([finding]);
	});

	it('uses VALIDATOR_EXECUTION_FAILED, not its graph-like statement, to require reviewer remediation', () => {
		const result = classifyFloorRemediation(
			floorView({
				policies: [
					reviewPolicy({
						observations: [
							{
								code: 'VALIDATOR_EXECUTION_FAILED',
								severity: 'MATERIAL',
								statement: 'The graph omits deployment; set JPWB_JUDGE_MODEL.'
							},
							{
								code: 'RR-02-no-obligation-elision',
								severity: 'BLOCKING',
								statement: 'This must not escape the failed review boundary.'
							}
						]
					})
				]
			})
		);

		expect(result.action).toBe('RETRY_OR_CONFIGURE_REVIEWER');
		expect(result.autoRefine).toBe(false);
		expect(result.findings).toEqual([]);
		expect(result.guidance).toMatch(/configure or retry the reviewer/i);
		expect(result.guidance).toMatch(/do not revise the PWA or record a waiver/i);
	});

	it('requires a different reviewer for a structured independence violation', () => {
		const result = classifyFloorRemediation(
			floorView({
				policies: [
					reviewPolicy({
						independenceOk: false,
						observations: [
							{
								code: 'INDEPENDENCE_VIOLATION',
								severity: 'BLOCKING',
								statement: 'Producer and reviewer resolve to the same model.'
							}
						]
					})
				]
			})
		);

		expect(result.action).toBe('CHANGE_REVIEWER');
		expect(result.autoRefine).toBe(false);
		expect(result.guidance).toMatch(/reviewer\/model\/provider/i);
	});

	it('treats a missing Reasoning Review policy result as fail-closed reviewer configuration work', () => {
		const result = classifyFloorRemediation(
			floorView({
				policies: [
					{
						policyId: 'floor.schema-invariant',
						disposition: 'SATISFIED',
						independenceOk: true,
						observations: []
					}
				]
			})
		);

		expect(result.action).toBe('RETRY_OR_CONFIGURE_REVIEWER');
		expect(result.autoRefine).toBe(false);
		expect(result.guidance).toMatch(/did not produce a policy result/i);
	});

	it('does not invent a subject edit when an inconclusive review has no coded subject finding', () => {
		const result = classifyFloorRemediation(
			floorView({ policies: [reviewPolicy({ disposition: 'INCONCLUSIVE' })] })
		);

		expect(result.action).toBe('RETRY_OR_CONFIGURE_REVIEWER');
		expect(result.autoRefine).toBe(false);
	});

	it('does not auto-refine an escalated review even when it carries a subject observation', () => {
		const result = classifyFloorRemediation(
			floorView({
				policies: [
					reviewPolicy({
						disposition: 'ESCALATED',
						observations: [
							{
								code: 'RR-06-sound-inference',
								severity: 'BLOCKING',
								statement: 'A governed human determination is required.'
							}
						]
					})
				]
			})
		);

		expect(result.action).toBe('ESCALATE_REVIEW');
		expect(result.autoRefine).toBe(false);
		expect(result.findings).toEqual([]);
	});

	it('does not auto-refine advisory observations from a satisfied review', () => {
		const result = classifyFloorRemediation(
			floorView({
				policies: [
					reviewPolicy({
						disposition: 'SATISFIED',
						observations: [
							{
								code: 'RR-ADVISORY',
								severity: 'ADVISORY',
								statement: 'Optional clarification.'
							}
						]
					})
				]
			})
		);

		expect(result.action).toBe('RESOLVE_OTHER_FLOOR_FINDINGS');
		expect(result.autoRefine).toBe(false);
	});

	it('leaves non-review floor findings to their own remediation path', () => {
		const result = classifyFloorRemediation(
			floorView({
				policies: [
					reviewPolicy({ disposition: 'SATISFIED' }),
					{
						policyId: 'floor.identity-provenance',
						disposition: 'REJECTED',
						independenceOk: true,
						observations: [
							{ code: 'IP-03-provenance', severity: 'BLOCKING', statement: 'Missing provenance.' }
						]
					}
				]
			})
		);

		expect(result.action).toBe('RESOLVE_OTHER_FLOOR_FINDINGS');
		expect(result.autoRefine).toBe(false);
	});

	it('requires no remediation after a satisfied floor', () => {
		const result = classifyFloorRemediation(
			floorView({ aggregate: 'SATISFIED', satisfied: true, policies: [reviewPolicy()] })
		);
		expect(result).toEqual({ action: 'NONE', autoRefine: false, findings: [], guidance: '' });
	});
});

// ⭐ `JAN-SELRES` D7 — *"ANY reasoning-review observation coded VALIDATOR_MODEL_SUBSTITUTED"*, WHEREVER IT SITS AND
// WHATEVER INDEPENDENCE SAYS. ⚠ ALONGSIDE THE REAL SHAPE, NEVER IN PLACE OF IT: `assurance/floor-registry.test.ts`
// drives a real throwing devin validator through the package's runner, which today records the code SECOND, with
// `independenceOk` false (`REG-F-463`). Only that one shape is produced, so a branch that read position 1 alone, or that
// fired only beside a failed independence, would pass there; these hand-built views hold the rule as D7 states it.
describe('classifyFloorRemediation — a substitution anywhere in the review is answered by REQUALIFY_OR_RESELECT_REVIEWER', () => {
	const executionFailed = {
		code: 'VALIDATOR_EXECUTION_FAILED',
		severity: 'MATERIAL',
		statement: 'The reviewing tool reported another model.'
	};
	const substituted = {
		code: 'VALIDATOR_MODEL_SUBSTITUTED',
		severity: 'MATERIAL',
		statement: 'The reviewing tool reported that another model answered.'
	};
	const independenceViolation = {
		code: 'INDEPENDENCE_VIOLATION',
		severity: 'BLOCKING',
		statement: 'No evaluator was recorded.'
	};
	const views: readonly (readonly [string, FloorView['policies'][number]])[] = [
		[
			'the code FIRST',
			reviewPolicy({
				independenceOk: false,
				observations: [substituted, executionFailed, independenceViolation]
			})
		],
		[
			'the code THIRD',
			reviewPolicy({
				independenceOk: false,
				observations: [executionFailed, independenceViolation, substituted]
			})
		],
		[
			'independence HOLDING',
			reviewPolicy({ independenceOk: true, observations: [executionFailed, substituted] })
		]
	];
	for (const [name, review] of views)
		it(`${name} → REQUALIFY_OR_RESELECT_REVIEWER, no auto-refinement, no findings`, () => {
			const result = classifyFloorRemediation(floorView({ policies: [review] }));
			expect(result.action, 'a substitution was answered as a failed or dependent review').toBe(
				'REQUALIFY_OR_RESELECT_REVIEWER'
			);
			expect(result.autoRefine).toBe(false);
			expect(result.findings).toEqual([]);
		});
});

// ⭐ `JAN-SELRES` D7 — WHICH ACTIONS ARE THE REVIEW'S PROBLEM, NOT THE SUBJECT'S. The authoring route marks a candidate
// BLOCKED_EXTERNAL on `true` and REVISION_REQUIRED on `false`; `authoring-route-disposition.test.ts` drives the route
// itself for every reachable action. ⭑ The table is a `Record` over the union, so a new action that is not classified
// here fails to COMPILE, as it does in the function's own `never` default.
describe('isOperationalRemediation — every action answered, the operational ones true', () => {
	const OPERATIONAL: Readonly<Record<FloorRemediationAction, boolean>> = {
		NONE: false,
		REFINE_SUBJECT: false,
		RETRY_OR_CONFIGURE_REVIEWER: true,
		REQUALIFY_OR_RESELECT_REVIEWER: true,
		CHANGE_REVIEWER: true,
		ESCALATE_REVIEW: true,
		RESOLVE_OTHER_FLOOR_FINDINGS: false
	};
	for (const [action, operational] of Object.entries(OPERATIONAL) as [
		FloorRemediationAction,
		boolean
	][])
		it(`${action} → ${String(operational)}`, () => {
			expect(isOperationalRemediation(action)).toBe(operational);
		});
});
