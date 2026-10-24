// The de minimis floor's identity/provenance step (§8.4 step 2) must CHECK the subject, not assert it. This locks
// the derivation that replaced five literal `true`s (findings 18/67): a PWA missing a stable id, semantic version,
// provenance, or an identified producer must fail its mandatory criterion. Mutation proof: revert any derived fact
// below to a literal `true` and the matching case here goes red.
import { vi } from 'vitest';

// ⭐ `JAN-ESCREC` D3 — the last describe records a floor through `runPwaFloor` and reads it back, as
// `floor-recording.test.ts` does: `workbench.ts` reads `RPH_DEMO_MODE` at load, so it is set before any import. The
// pure cases above it read no engine, and nothing in them depends on the mode.
vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import {
	FLOOR_POLICY_DEFINITIONS,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AggregateDisposition
} from '@janumipwb/rph-assurance';
import { createEngine, getObject, seedFloorPolicies } from '@janumipwb/rph-engine';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import {
	ProfessionalWorkObjectTypeSchema,
	type AssessmentCriterion,
	type DomainCommand
} from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { withLiveReviewerSeam } from './assurance/clearing-reviewer.testing.js';
import { SESSION_CREDENTIAL, standaloneAuthenticator } from './identity.js';
import {
	classifyFloorRemediation,
	escalationRecommendationNote,
	floorBlockedHint,
	floorChipLabel,
	floorStatusLine,
	identityProvenanceFactsOf,
	isOperationalRemediation,
	loadPwaFloor,
	runPwaFloor
} from './floor.js';
import type {
	EscalationRecommendationNote,
	FloorBlockedHint,
	FloorProducer,
	FloorRemediationAction,
	FloorView
} from './floor.js';

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

// ⭐ `JAN-SELRES` D8 (`REG-F-462`), AS REVISED IN RS-3 — THE PAGE'S BLOCKED HINT FOLLOWS THE FLOOR'S OWN CLASSIFIER, IN
// ~~THREE~~ FOUR SENTENCES. `floorBlockedHint` is the one answer the PWA page renders its hint from: 'REVISE' says "revise
// the graph and re-run", 'NOT_BY_REVISION' says revising does not address the block, and 'REVISE_AND_REVIEW' says to
// revise the graph for the findings the floor records against it AND that the review reached no verdict revising can
// answer. ⭐ `JAN-ESCREC` D3 (`REG-D-090`) added 'ROUTE_TO_HUMAN': an escalated review with no REJECTED non-review policy
// is routed to a human, whose review this workbench cannot record yet (`REG-F-474`).
// ⛔ IT ASKS `classifyFloorRemediation` WHETHER THE REVIEW IS THE PROBLEM, NEVER THE RECORDED CODES, and the non-review
// policies' dispositions whether the GRAPH is too: a two-way answer read "revising it does not address this" beside a
// refused substitute on a graph with two roots (the RS-3 re-verifier's MAJOR). ⭑ The first table is a `Record` over the
// action union, so an action added without rows here fails to COMPILE; every operational action has a row alone and a
// row beside a REJECTED non-review policy, and each row asserts, as arrangement, that its floor IS answered with that
// action.
describe('floorBlockedHint — "revise the graph" where revising answers the block, and never alone beside a review it does not answer', () => {
	const executionFailed = {
		code: 'VALIDATOR_EXECUTION_FAILED',
		severity: 'MATERIAL',
		statement: 'The reviewing tool did not run.'
	};
	const substituted = {
		code: 'VALIDATOR_MODEL_SUBSTITUTED',
		severity: 'MATERIAL',
		statement: 'The reviewing tool reported that another model answered.'
	};
	const independenceViolation = {
		code: 'INDEPENDENCE_VIOLATION',
		severity: 'BLOCKING',
		statement: 'Producer and reviewer resolve to the same model.'
	};
	const subjectFinding = {
		code: 'RR-02-no-obligation-elision',
		severity: 'BLOCKING',
		statement: 'A delegated deployment obligation is absent.'
	};
	/** What the schema/invariant policy records for a graph with two roots or an orphan (`floor.ts` `runPwaFloor`). */
	const notWellFormed = {
		code: 'PWA_GRAPH_NOT_WELL_FORMED',
		severity: 'BLOCKING',
		statement: 'Deterministic invariant violated: PWA_GRAPH_NOT_WELL_FORMED'
	};
	const nonReview = (
		policyId: 'floor.schema-invariant' | 'floor.identity-provenance',
		disposition: string,
		observations: FloorView['policies'][number]['observations'] = []
	): FloorView['policies'][number] => ({
		policyId,
		disposition,
		independenceOk: true,
		observations
	});
	/** A defect in the GRAPH, which revising answers: the schema/invariant policy REJECTED it. */
	const schemaRejected = nonReview('floor.schema-invariant', 'REJECTED', [notWellFormed]);
	/** A defect in the PWA's provenance, which revising answers: the identity/provenance policy REJECTED it. */
	const identityRejected = nonReview('floor.identity-provenance', 'REJECTED', [
		{ code: 'IP-03-provenance', severity: 'BLOCKING', statement: 'Missing provenance.' }
	]);
	const schemaSatisfied = nonReview('floor.schema-invariant', 'SATISFIED');
	const identitySatisfied = nonReview('floor.identity-provenance', 'SATISFIED');
	/** The RECORDED shape of a refused substitute: all three codes, a subject finding beside them. */
	const refusedSubstitute = reviewPolicy({
		independenceOk: false,
		observations: [subjectFinding, executionFailed, substituted, independenceViolation]
	});
	const notIndependent = reviewPolicy({
		disposition: 'SATISFIED',
		independenceOk: false,
		observations: [independenceViolation]
	});

	const BY_ACTION: Readonly<
		Record<
			FloorRemediationAction,
			readonly {
				readonly shape: string;
				readonly floor: FloorView;
				readonly hint: FloorBlockedHint | undefined;
			}[]
		>
	> = {
		// Nothing blocks, so there is no hint — even with a stale operational code on the review.
		NONE: [
			{
				shape: 'a SATISFIED floor whose review still carries a stale operational code',
				floor: floorView({
					aggregate: 'SATISFIED',
					satisfied: true,
					policies: [reviewPolicy({ disposition: 'SATISFIED', observations: [executionFailed] })]
				}),
				hint: undefined
			}
		],
		REFINE_SUBJECT: [
			{
				shape: 'a REJECTED review with a subject finding',
				floor: floorView({
					policies: [reviewPolicy({ disposition: 'REJECTED', observations: [subjectFinding] })]
				}),
				hint: 'REVISE'
			},
			// Revising answers both halves: nothing here is the review's problem.
			{
				shape: 'the same, beside a REJECTED schema policy',
				floor: floorView({
					policies: [
						schemaRejected,
						reviewPolicy({ disposition: 'REJECTED', observations: [subjectFinding] })
					]
				}),
				hint: 'REVISE'
			}
		],
		RETRY_OR_CONFIGURE_REVIEWER: [
			{
				shape: 'a review that did not execute',
				floor: floorView({ policies: [reviewPolicy({ observations: [executionFailed] })] }),
				hint: 'NOT_BY_REVISION'
			},
			{
				shape: 'a review that did not execute, beside a REJECTED schema policy',
				floor: floorView({
					policies: [schemaRejected, reviewPolicy({ observations: [executionFailed] })]
				}),
				hint: 'REVISE_AND_REVIEW'
			}
		],
		REQUALIFY_OR_RESELECT_REVIEWER: [
			{
				shape: 'a refused substitute, as recorded',
				floor: floorView({ policies: [refusedSubstitute] }),
				hint: 'NOT_BY_REVISION'
			},
			// ⛔ FD3, the RS-3 re-verifier's MAJOR: the page read "revising it does not address this" beside two roots.
			{
				shape: 'a refused substitute beside a graph that is not well formed',
				floor: floorView({ policies: [schemaRejected, refusedSubstitute] }),
				hint: 'REVISE_AND_REVIEW'
			}
		],
		CHANGE_REVIEWER: [
			{
				shape: 'a review that was not independent',
				floor: floorView({ policies: [notIndependent] }),
				hint: 'NOT_BY_REVISION'
			},
			{
				shape: 'a review that was not independent, beside a REJECTED identity policy',
				floor: floorView({ policies: [identityRejected, notIndependent] }),
				hint: 'REVISE_AND_REVIEW'
			}
		],
		// ⚠ NO CODE RECORDED AT ALL — the codes-keyed predicate answered the first of these "revise".
		// ⭐ `JAN-ESCREC` D3 (`REG-D-090`): ALONE, an escalation is routed to a human — the fourth sentence, which says a
		// human's review cannot be recorded yet (`REG-F-474`). This row read NOT_BY_REVISION until then. BESIDE a REJECTED
		// non-review policy it still reads REVISE_AND_REVIEW: the graph half is answered by revising, as for every other
		// operational action (the second row, unchanged — the control).
		ESCALATE_REVIEW: [
			{
				shape: 'an ESCALATED review, nothing recorded',
				floor: floorView({ policies: [reviewPolicy({ disposition: 'ESCALATED' })] }),
				hint: 'ROUTE_TO_HUMAN'
			},
			{
				shape: 'an ESCALATED review beside a REJECTED identity policy',
				floor: floorView({
					policies: [identityRejected, reviewPolicy({ disposition: 'ESCALATED' })]
				}),
				hint: 'REVISE_AND_REVIEW'
			}
		],
		// The review judged the graph and passed it; a non-review floor finding blocks, and revising answers it.
		RESOLVE_OTHER_FLOOR_FINDINGS: [
			{
				shape: 'a passing review beside a REJECTED identity policy',
				floor: floorView({
					policies: [identityRejected, reviewPolicy({ disposition: 'SATISFIED' })]
				}),
				hint: 'REVISE'
			}
		]
	};
	for (const [action, rows] of Object.entries(BY_ACTION) as [
		FloorRemediationAction,
		(typeof BY_ACTION)[FloorRemediationAction]
	][])
		for (const { shape, floor, hint } of rows)
			it(`${action} — ${shape} → ${String(hint)}`, () => {
				expect(
					classifyFloorRemediation(floor).action,
					'arrangement: the classifier answers this floor with its row'
				).toBe(action);
				expect(floorBlockedHint(floor)).toBe(hint);
			});

	// ⭐ THE SHAPES RS-3's REVISION NAMES, each over the whole floor the page loads: schema, identity, review.
	it('⛔ an operational review beside a REJECTED schema/invariant policy → REVISE_AND_REVIEW: the graph half is answered by revising', () => {
		// FD4's shape: a reviewer that did not run, and a graph with an orphan PWU the schema policy rejected.
		const floor = floorView({
			policies: [
				schemaRejected,
				identitySatisfied,
				reviewPolicy({ observations: [executionFailed] })
			]
		});
		expect(
			isOperationalRemediation(classifyFloorRemediation(floor).action),
			'arrangement: the classifier answers the review, operationally'
		).toBe(true);
		expect(
			floorBlockedHint(floor),
			'a defect in the graph was answered as a block revising does not address'
		).toBe('REVISE_AND_REVIEW');
	});

	it('⛔ an operational review beside a REJECTED identity/provenance policy → REVISE_AND_REVIEW: a non-review defect of either policy counts', () => {
		const floor = floorView({
			policies: [
				schemaSatisfied,
				identityRejected,
				reviewPolicy({ observations: [executionFailed] })
			]
		});
		expect(
			isOperationalRemediation(classifyFloorRemediation(floor).action),
			'arrangement: the classifier answers the review, operationally'
		).toBe(true);
		expect(floorBlockedHint(floor)).toBe('REVISE_AND_REVIEW');
	});

	it('an operational review ALONE, the other two policies SATISFIED → NOT_BY_REVISION', () => {
		expect(
			floorBlockedHint(
				floorView({
					policies: [
						schemaSatisfied,
						identitySatisfied,
						reviewPolicy({ observations: [executionFailed] })
					]
				})
			)
		).toBe('NOT_BY_REVISION');
	});

	it('⭑ VALIDATOR_EXECUTION_FAILED on the SCHEMA policy beside a review that passed (the T7 shape) → REVISE: the classifier answers it RESOLVE_OTHER_FLOOR_FINDINGS', () => {
		// ⚠ Whether a deterministic validator that did not execute is answered by revising is the CLASSIFIER's question;
		// the hint follows its answer, and a two-way hint did the same.
		const floor = floorView({
			policies: [
				nonReview('floor.schema-invariant', 'ASSESSING', [executionFailed]),
				identitySatisfied,
				reviewPolicy({ disposition: 'SATISFIED' })
			]
		});
		expect(
			classifyFloorRemediation(floor).action,
			'arrangement: the classifier answers the non-review finding'
		).toBe('RESOLVE_OTHER_FLOOR_FINDINGS');
		expect(floorBlockedHint(floor)).toBe('REVISE');
	});

	it('⛔ a recorded waiver changes no answer (ASR-3): the waived floor reads what the unwaived one does', () => {
		// A waiver moves nothing, so it may not move the hint either: yielding to `waived` puts "revise the graph and
		// re-run" back beside a review that did not execute. `e2e/assurance-floor-review-failure-hint.e2e.ts` records the
		// waiver through the page's own form.
		const shapes: readonly (readonly [FloorView['policies'], FloorBlockedHint])[] = [
			[
				[schemaSatisfied, identitySatisfied, reviewPolicy({ observations: [executionFailed] })],
				'NOT_BY_REVISION'
			],
			[
				[schemaRejected, identitySatisfied, reviewPolicy({ observations: [executionFailed] })],
				'REVISE_AND_REVIEW'
			],
			[
				[
					schemaSatisfied,
					identitySatisfied,
					reviewPolicy({ disposition: 'REJECTED', observations: [subjectFinding] })
				],
				'REVISE'
			]
		];
		for (const [policies, hint] of shapes) {
			expect(floorBlockedHint(floorView({ policies }))).toBe(hint);
			expect(
				floorBlockedHint(floorView({ waived: true, policies })),
				'a recorded waiver moved the hint'
			).toBe(hint);
		}
	});

	it('⛔ the review’s OWN REJECTED is not a non-review finding: a REJECTED review that was not independent, the others SATISFIED → NOT_BY_REVISION', () => {
		const floor = floorView({
			policies: [
				schemaSatisfied,
				identitySatisfied,
				reviewPolicy({
					disposition: 'REJECTED',
					independenceOk: false,
					observations: [subjectFinding, independenceViolation]
				})
			]
		});
		expect(
			classifyFloorRemediation(floor).action,
			'arrangement: the independence branch answers it, ahead of the subject finding'
		).toBe('CHANGE_REVIEWER');
		expect(
			floorBlockedHint(floor),
			'the review’s own disposition was read as a finding against the graph'
		).toBe('NOT_BY_REVISION');
	});

	it('⛔ a non-review policy that did not conclude (ASSESSING, its validator did not execute) beside an operational review → NOT_BY_REVISION: only a REJECTED one records a finding against the graph', () => {
		expect(
			floorBlockedHint(
				floorView({
					policies: [
						nonReview('floor.schema-invariant', 'ASSESSING', [executionFailed]),
						identitySatisfied,
						reviewPolicy({ observations: [executionFailed] })
					]
				})
			)
		).toBe('NOT_BY_REVISION');
	});

	it('⛔ NO reasoning-review result, a REJECTED schema policy → REVISE_AND_REVIEW: the missing review is operational, the defect is the graph’s', () => {
		const floor = floorView({ policies: [schemaRejected, identitySatisfied] });
		expect(
			classifyFloorRemediation(floor).guidance,
			'arrangement: the missing-review branch answered it'
		).toMatch(/did not produce a policy result/i);
		expect(floorBlockedHint(floor)).toBe('REVISE_AND_REVIEW');
	});

	// ⭐ THE BLOCKS THE CODES MISSED (the RS-3 verifier's MAJOR 1). The classifier answers each "Do not revise the PWA" —
	// or, for the escalation, that a subject edit cannot substitute — and the page told each "revise the graph and re-run".
	// Each carries no REJECTED non-review policy, so each is NOT_BY_REVISION.
	it('⛔ an INCOMPLETE review with nothing recorded (INCONCLUSIVE, no observation — what an unregistered draft stages, `e2e/resume-hint.e2e.ts`) → NOT_BY_REVISION', () => {
		const floor = floorView({ policies: [reviewPolicy({ disposition: 'INCONCLUSIVE' })] });
		expect(
			classifyFloorRemediation(floor).guidance,
			'arrangement: the classifier says not to revise the PWA'
		).toMatch(/do not revise the PWA or record a waiver merely to clear an incomplete review/i);
		expect(floorBlockedHint(floor)).toBe('NOT_BY_REVISION');
	});

	it('⛔ a review left ASSESSING with one BLOCKING RR-04 open → NOT_BY_REVISION: an open finding on an unconcluded review is not a verdict', () => {
		// The waiver e2e staged exactly this floor for a test about a SUBJECT rejection, and D8 keyed the hint on the codes
		// so that test kept "revise". The classifier calls it an incomplete review; the waiver e2e's revision test now
		// concludes its review REJECTED (`e2e/assurance-floor-waiver.e2e.ts`), and this answer changed from "revise" in
		// RS-3's revision.
		const floor = floorView({
			policies: [
				reviewPolicy({
					disposition: 'ASSESSING',
					observations: [
						{
							code: 'RR-04',
							severity: 'BLOCKING',
							statement: 'Staged blocking reasoning-review finding.'
						}
					]
				})
			]
		});
		expect(
			classifyFloorRemediation(floor).guidance,
			'arrangement: the classifier calls it an incomplete review'
		).toMatch(/merely to clear an incomplete review/i);
		expect(floorBlockedHint(floor)).toBe('NOT_BY_REVISION');
	});

	it('⛔ a review CONCLUDED INCONCLUSIVE with one BLOCKING RR-04 (the waiver e2e’s second test) → NOT_BY_REVISION: INCONCLUSIVE judged nothing, whatever it recorded', () => {
		const floor = floorView({
			policies: [
				schemaSatisfied,
				identitySatisfied,
				reviewPolicy({
					disposition: 'INCONCLUSIVE',
					observations: [
						{
							code: 'RR-04',
							severity: 'BLOCKING',
							statement: 'Staged blocking reasoning-review finding.'
						}
					]
				})
			]
		});
		expect(
			classifyFloorRemediation(floor).guidance,
			'arrangement: the classifier calls it an incomplete review'
		).toMatch(/merely to clear an incomplete review/i);
		expect(floorBlockedHint(floor)).toBe('NOT_BY_REVISION');
	});

	it('⛔ an ESCALATED review carrying a subject observation → ROUTE_TO_HUMAN: the escalation, not the finding, answers it, and it is routed to a human', () => {
		// ⭐ `JAN-ESCREC` D3: this answer was NOT_BY_REVISION until the hint gained its fourth sentence.
		const floor = floorView({
			policies: [reviewPolicy({ disposition: 'ESCALATED', observations: [subjectFinding] })]
		});
		expect(
			classifyFloorRemediation(floor).guidance,
			'arrangement: the escalation branch answered it'
		).toMatch(/an automatic subject edit cannot substitute for the escalation/i);
		expect(floorBlockedHint(floor)).toBe('ROUTE_TO_HUMAN');
	});

	it('⛔ NO reasoning-review result recorded, the other floor policies SATISFIED → NOT_BY_REVISION: the review did not produce a policy result', () => {
		// ⚠ THIS ANSWER CHANGED FROM "revise" IN RS-3's REVISION: keyed on the codes, the page said "revise" beside guidance
		// that says "Do not revise the PWA or record a waiver in response to the missing review".
		expect(floorBlockedHint(floorView({ policies: [schemaSatisfied, identitySatisfied] }))).toBe(
			'NOT_BY_REVISION'
		);
	});

	it('⛔ NO reasoning-review result, an operational code on ANOTHER policy → NOT_BY_REVISION, answered by the missing review and never by that code', () => {
		const floor = floorView({
			policies: [nonReview('floor.schema-invariant', 'INCONCLUSIVE', [executionFailed])]
		});
		expect(
			classifyFloorRemediation(floor).guidance,
			'arrangement: the missing-review branch answered it, not the other policy’s code'
		).toMatch(/did not produce a policy result/i);
		expect(floorBlockedHint(floor)).toBe('NOT_BY_REVISION');
	});

	it('an operational code on ANOTHER floor policy, beside a REJECTED review with a subject finding → REVISE: that review judged the graph', () => {
		expect(
			floorBlockedHint(
				floorView({
					policies: [
						nonReview('floor.schema-invariant', 'INCONCLUSIVE', [executionFailed]),
						reviewPolicy({ disposition: 'REJECTED', observations: [subjectFinding] })
					]
				})
			)
		).toBe('REVISE');
	});

	it('⭑ a VALIDATOR_MODEL_SUBSTITUTED observation ALONE → NOT_BY_REVISION — the classifier’s substitution branch answers it', () => {
		// ⚠ NOT THE RECORDED SHAPE (that is the REQUALIFY rows above): alone, only the substitution branch can answer it.
		expect(
			floorBlockedHint(floorView({ policies: [reviewPolicy({ observations: [substituted] })] }))
		).toBe('NOT_BY_REVISION');
	});

	it('an independence violation recorded after five subject findings (INCONCLUSIVE) → NOT_BY_REVISION: the findings recorded first do not make it a verdict', () => {
		expect(
			floorBlockedHint(
				floorView({
					policies: [
						reviewPolicy({
							independenceOk: false,
							observations: [
								subjectFinding,
								subjectFinding,
								subjectFinding,
								subjectFinding,
								subjectFinding,
								independenceViolation
							]
						})
					]
				})
			)
		).toBe('NOT_BY_REVISION');
	});

	it('a SATISFIED floor → undefined, whatever its review recorded: no blocked hint is rendered at all', () => {
		expect(
			floorBlockedHint(
				floorView({
					aggregate: 'SATISFIED',
					satisfied: true,
					policies: [schemaSatisfied, identitySatisfied, reviewPolicy({ disposition: 'SATISFIED' })]
				})
			)
		).toBeUndefined();
		expect(
			floorBlockedHint(
				floorView({
					aggregate: 'SATISFIED',
					satisfied: true,
					policies: [reviewPolicy({ disposition: 'SATISFIED', observations: [executionFailed] })]
				})
			),
			'a satisfied floor was given a blocked hint'
		).toBeUndefined();
	});
});

// ⭐⭐ `JAN-ESCREC` D3 (`REG-D-089`; `REG-D-090`) — THE REVIEWER'S ESCALATED RECOMMENDATION IS RECORDED, AND NEVER READ AS A
// FINDING ABOUT THE SUBJECT.
//
// ⛔ WHAT IS AT STAKE. A VALID Reasoning Review whose reviewer recommends the literal ESCALATED now carries one more
// observation, `REVIEWER_RECOMMENDED_ESCALATION` (INFORMATIONAL, typed RECOMMENDATION), whatever the review's outcome
// (`rph-assurance` D2): LAST, beside a REJECTED review's subject finding, and ALONE on the clean review D1 escalates. The
// classifier's subject-finding filter sent every non-operational code back to the producer, so the recommendation became
// WORK — a REJECTED review sent "the reviewing model's recommendation was ESCALATED" back as a defect to repair, and a
// review with no subject finding at all became a refinement of nothing. That one filter feeds `refineDirective` and
// `priorGaps` (authoring), `openPerTry` and `priorFindings` (execution) and the status line's count, so its one exclusion
// answers all five.
//
// ⭑ THE CODE IS RESTATED HERE AS A LITERAL, ON PURPOSE (part A's convention): it is the RECORDED word, so a rename in the
// package must redden this file rather than be followed silently. Production imports it, and
// `verif/validator-failure-codes-imported.test.ts` holds it to that. The statement is `REG-D-090`'s, byte for byte.
const RECOMMENDATION_CODE = 'REVIEWER_RECOMMENDED_ESCALATION';
const RECOMMENDATION_STATEMENT =
	"The reviewing model's recommendation was ESCALATED. The review prompt does not define ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated authority cannot resolve the issue within its authority or competence.";

describe('⭐ JAN-ESCREC D3 — the recommendation is never a subject finding, and an escalation alone routes to a human', () => {
	const recommendation = {
		code: RECOMMENDATION_CODE,
		severity: 'INFORMATIONAL',
		statement: RECOMMENDATION_STATEMENT
	};
	const subjectFinding = {
		code: 'RR-02-no-obligation-elision',
		severity: 'BLOCKING',
		statement: 'A delegated deployment obligation is absent.'
	};
	const passed = (
		policyId: 'floor.schema-invariant' | 'floor.identity-provenance'
	): FloorView['policies'][number] => ({
		policyId,
		disposition: 'SATISFIED',
		independenceOk: true,
		observations: []
	});

	it('⛔ a REJECTED review carrying a subject finding AND the recommendation → REFINE_SUBJECT, its findings the subject finding only, and the hint REVISE', () => {
		// The shape D2 records when a criterion failed: the subject finding first, the recommendation LAST.
		const floor = floorView({
			aggregate: 'REJECTED',
			policies: [
				passed('floor.schema-invariant'),
				passed('floor.identity-provenance'),
				reviewPolicy({ disposition: 'REJECTED', observations: [subjectFinding, recommendation] })
			]
		});
		const result = classifyFloorRemediation(floor);
		expect(result.action).toBe('REFINE_SUBJECT');
		expect(result.autoRefine).toBe(true);
		expect(
			result.findings,
			'the recommendation was sent back to the producer as a finding'
		).toEqual([subjectFinding]);
		expect(floorStatusLine(floor), 'the status line counted the recommendation as a finding').toBe(
			'⚖ Assurance floor REJECTED · 1 valid reasoning finding(s).'
		);
		expect(floorBlockedHint(floor)).toBe('REVISE');
	});

	it('⛔ a REJECTED review whose ONLY observation is the recommendation is no work to send back: no refinement, no findings', () => {
		// Without the exclusion the recommendation is the one "subject finding", and a review that recorded none is answered
		// with a refinement of nothing — work manufactured from a recommendation (`REG-D-059`: *"work from silence"*).
		const result = classifyFloorRemediation(
			floorView({
				policies: [reviewPolicy({ disposition: 'REJECTED', observations: [recommendation] })]
			})
		);
		expect(
			result.action,
			'the recommendation alone was answered as a subject finding to refine'
		).toBe('RETRY_OR_CONFIGURE_REVIEWER');
		expect(result.autoRefine).toBe(false);
		expect(result.findings).toEqual([]);
	});

	it('⛔ an ESCALATED review carrying the recommendation — the clean review D1 escalates → ESCALATE_REVIEW, no findings, and the hint ROUTE_TO_HUMAN', () => {
		// ⭑ Every OTHER operational action alone still reads NOT_BY_REVISION: the table above holds a row for each, so a
		// hint that sent every operational block to a human reddens there, not here.
		const floor = floorView({
			policies: [
				passed('floor.schema-invariant'),
				passed('floor.identity-provenance'),
				reviewPolicy({ disposition: 'ESCALATED', observations: [recommendation] })
			]
		});
		const result = classifyFloorRemediation(floor);
		expect(result.action).toBe('ESCALATE_REVIEW');
		expect(result.autoRefine).toBe(false);
		expect(result.findings).toEqual([]);
		expect(floorBlockedHint(floor)).toBe('ROUTE_TO_HUMAN');
	});

	it('⛔ the exclusion is of ONE CODE, not of a severity: an INFORMATIONAL subject finding beside the recommendation is still sent back, and counted', () => {
		// The ER-1 app verifier's finding [5] (its mutant `ER1-V51`): every neighbour above is BLOCKING, so a filter that
		// dropped every INFORMATIONAL observation along with the recommendation passed them all. Here a subject finding is
		// INFORMATIONAL too, and only the recommendation's CODE tells the two apart.
		const informational = {
			code: 'RR-08-evidence-integrity',
			severity: 'INFORMATIONAL',
			statement: 'An uncertainty the graph rests on is acknowledged but not carried forward.'
		};
		const floor = floorView({
			aggregate: 'REJECTED',
			policies: [
				passed('floor.schema-invariant'),
				passed('floor.identity-provenance'),
				reviewPolicy({
					disposition: 'REJECTED',
					observations: [subjectFinding, informational, recommendation]
				})
			]
		});
		const result = classifyFloorRemediation(floor);
		expect(result.action).toBe('REFINE_SUBJECT');
		expect(
			result.findings,
			'an informational subject finding was excluded with the recommendation'
		).toEqual([subjectFinding, informational]);
		expect(floorStatusLine(floor)).toBe(
			'⚖ Assurance floor REJECTED · 2 valid reasoning finding(s).'
		);
	});
});

// ⭐ `JAN-ESCREC` D3 (`REG-D-089`; `REG-D-090`) — WHEREVER THE HINT DOES NOT ROUTE THE REVIEW TO A HUMAN, THE PANEL SAYS THE
// REVIEWER ALSO RECOMMENDED ESCALATION, IN A SENTENCE THAT IS TRUE OF THE FLOOR IT IS SAID BESIDE.
//
// ⛔ WHAT WAS WRONG (the ER-1 app verifier's finding [7]). The recommendation is recorded whatever the outcome, and the page
// showed it nowhere unless the review itself escalated: the policy list renders no observation, `reasoningGaps` excludes
// it, and the hint and the banner key on ESCALATE_REVIEW. So beside a failed criterion, or a graph defect that kept the
// review SATISFIED, *"the escalation recorded beside it"* (`REG-D-089`) was visible only in the raw answer — and once the
// graph was fixed, the next run escalated with no earlier word.
//
// ⛔ AND THEN WHAT WAS FALSE (the ER-1 app re-verifier's finding [0], its mutant `ER1-V153`). The first answer was a boolean,
// and its one sentence — *"recorded beside the findings, which are addressed first"* — was shown beside an INCOMPLETE review
// too: D2 records the recommendation on a VALID INCONCLUSIVE review (a reply that left a criterion unanswered), whose page
// lists no finding at all, under a hint saying revising does not address the block. `REG-D-090` accepted option (a), no hard
// stop, on the condition that the operator is told honestly.
//
// ⭑ WHAT MUST HOLD. The server answers WHICH sentence (`escalationRecommendationNote`), never whether, keyed on the hint's
// answer — one table row per answer, exhaustive by `satisfies`, so a fifth answer must be decided here before this compiles:
//   · REVISE and REVISE_AND_REVIEW → `BESIDE_FINDINGS`: the floor records findings revising answers, and they come first;
//   · NOT_BY_REVISION → `WITH_AN_INCOMPLETE_REVIEW`: the review reached no usable verdict, and the recommendation is
//     recorded with it;
//   · ROUTE_TO_HUMAN → `undefined`: the hint says the escalation itself, so the line would say it twice;
//   · ⭐ REVISE_BESIDE_FAILED_REVIEWS (package E, E1) → `BESIDE_FINDINGS`: the concluded parts' findings come first;
// and `undefined` beside a satisfied floor, and beside a review that recorded no recommendation, whatever the hint.
// ⛔ Keyed on the hint's answer, not on the review's disposition: an ESCALATED review beside a REJECTED identity policy reads
// REVISE_AND_REVIEW, which names no escalation, so the line is shown there.
describe('⭐ JAN-ESCREC D3 — escalationRecommendationNote: which sentence the panel says beside the findings, for every hint', () => {
	const recommendation = {
		code: RECOMMENDATION_CODE,
		severity: 'INFORMATIONAL',
		statement: RECOMMENDATION_STATEMENT
	};
	const subjectFinding = {
		code: 'RR-02-no-obligation-elision',
		severity: 'BLOCKING',
		statement: 'A delegated deployment obligation is absent.'
	};
	const policy = (
		policyId: 'floor.schema-invariant' | 'floor.identity-provenance',
		disposition: 'SATISFIED' | 'REJECTED'
	): FloorView['policies'][number] => ({
		policyId,
		disposition,
		independenceOk: true,
		observations:
			disposition === 'REJECTED'
				? [
						{
							code: 'PWA_GRAPH_NOT_WELL_FORMED',
							severity: 'BLOCKING',
							statement: 'Not well formed.'
						}
					]
				: []
	});

	/** For each answer the hint can give an unsatisfied floor, the floors that reach it with the recommendation recorded,
	 *  and the sentence the panel says beside them — every answer a key, so a fifth must be decided here to compile. */
	const BY_HINT: Readonly<
		Record<
			FloorBlockedHint,
			readonly {
				readonly shape: string;
				readonly floor: FloorView;
				readonly note: EscalationRecommendationNote | undefined;
			}[]
		>
	> = {
		REVISE: [
			{
				shape: 'a REJECTED review carrying the recommendation beside its finding',
				floor: floorView({
					aggregate: 'REJECTED',
					policies: [
						policy('floor.schema-invariant', 'SATISFIED'),
						policy('floor.identity-provenance', 'SATISFIED'),
						reviewPolicy({
							disposition: 'REJECTED',
							observations: [subjectFinding, recommendation]
						})
					]
				}),
				note: 'BESIDE_FINDINGS'
			},
			// `REG-D-090`: *"nothing else already blocks"* is read across the floor, so the graph is revised first and the
			// review stays SATISFIED — with the escalation recorded beside it.
			{
				shape:
					'a review KEPT SATISFIED beside a REJECTED schema policy, carrying the recommendation',
				floor: floorView({
					aggregate: 'REJECTED',
					policies: [
						policy('floor.schema-invariant', 'REJECTED'),
						policy('floor.identity-provenance', 'SATISFIED'),
						reviewPolicy({ disposition: 'SATISFIED', observations: [recommendation] })
					]
				}),
				note: 'BESIDE_FINDINGS'
			}
		],
		REVISE_AND_REVIEW: [
			{
				shape:
					'an ESCALATED review beside a REJECTED identity policy — its hint names no escalation',
				floor: floorView({
					aggregate: 'REJECTED',
					policies: [
						policy('floor.schema-invariant', 'SATISFIED'),
						policy('floor.identity-provenance', 'REJECTED'),
						reviewPolicy({ disposition: 'ESCALATED', observations: [recommendation] })
					]
				}),
				note: 'BESIDE_FINDINGS'
			},
			// ⭐ THE SECOND FIX ROUND'S RE-VERIFIER'S CASE [5] (its probe P8, its mutant `ER1-V207`): a staged candidate with two
			// roots whose reviewer skipped a criterion AND recommended ESCALATED. The review is INCOMPLETE, yet the hint says to
			// revise the graph's findings first — so the line says they come first, never the incomplete-review sentence: keyed
			// on the hint's answer, not on the review's disposition. The only row above held an ESCALATED review alone.
			{
				shape:
					'an INCONCLUSIVE review carrying the recommendation beside a REJECTED schema policy — incomplete, with findings to revise first',
				floor: floorView({
					aggregate: 'REJECTED',
					policies: [
						policy('floor.schema-invariant', 'REJECTED'),
						policy('floor.identity-provenance', 'SATISFIED'),
						reviewPolicy({ disposition: 'INCONCLUSIVE', observations: [recommendation] })
					]
				}),
				note: 'BESIDE_FINDINGS'
			}
		],
		NOT_BY_REVISION: [
			// ⭐ THE RE-VERIFIER'S CASE: the reply left a criterion unanswered AND recommended ESCALATED. No finding is listed,
			// the hint says revising does not address it, and "beside the findings, which are addressed first" was false.
			{
				shape: 'an INCONCLUSIVE review carrying the recommendation, its neighbours SATISFIED',
				floor: floorView({
					policies: [
						policy('floor.schema-invariant', 'SATISFIED'),
						policy('floor.identity-provenance', 'SATISFIED'),
						reviewPolicy({ disposition: 'INCONCLUSIVE', observations: [recommendation] })
					]
				}),
				note: 'WITH_AN_INCOMPLETE_REVIEW'
			},
			// ⭑ The classifier's catch-all for a review with no subject finding (`RETRY_OR_CONFIGURE_REVIEWER`): the same
			// incomplete-review sentence, whatever disposition the review carries.
			{
				shape:
					'a REJECTED review whose ONLY observation is the recommendation, its neighbours SATISFIED',
				floor: floorView({
					aggregate: 'REJECTED',
					policies: [
						policy('floor.schema-invariant', 'SATISFIED'),
						policy('floor.identity-provenance', 'SATISFIED'),
						reviewPolicy({ disposition: 'REJECTED', observations: [recommendation] })
					]
				}),
				note: 'WITH_AN_INCOMPLETE_REVIEW'
			}
		],
		ROUTE_TO_HUMAN: [
			{
				shape: 'an ESCALATED review, nothing else blocking — the hint already routes it to a human',
				floor: floorView({
					policies: [
						policy('floor.schema-invariant', 'SATISFIED'),
						policy('floor.identity-provenance', 'SATISFIED'),
						reviewPolicy({ disposition: 'ESCALATED', observations: [recommendation] })
					]
				}),
				note: undefined
			}
		],
		// ⭐ The review in parts, package E, E1 — a round answered by revision beside a part whose review did not execute: the
		// findings of the part that concluded come first, so the line is said beside them.
		REVISE_BESIDE_FAILED_REVIEWS: [
			{
				shape:
					'a REJECTED part carrying the recommendation beside its finding, beside a part whose review did not execute',
				floor: ((): FloorView => {
					const failed = {
						typeId: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P01',
						typeName: 'Build',
						semanticVersion: 1,
						disposition: 'INCONCLUSIVE',
						independenceOk: false,
						observations: [
							{ code: 'VALIDATOR_EXECUTION_FAILED', severity: 'MATERIAL', statement: 'No reply.' }
						]
					};
					const rejected = {
						typeId: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P02',
						typeName: 'Check',
						semanticVersion: 1,
						disposition: 'REJECTED',
						independenceOk: true,
						observations: [subjectFinding, recommendation]
					};
					return floorView({
						aggregate: 'REJECTED',
						policies: [
							policy('floor.schema-invariant', 'SATISFIED'),
							policy('floor.identity-provenance', 'SATISFIED'),
							reviewPolicy({
								disposition: 'REJECTED',
								independenceOk: false,
								observations: [...failed.observations, ...rejected.observations]
							})
						],
						parts: [failed, rejected]
					});
				})(),
				note: 'BESIDE_FINDINGS'
			}
		]
	};
	for (const [hint, rows] of Object.entries(BY_HINT) as [
		FloorBlockedHint,
		(typeof BY_HINT)[FloorBlockedHint]
	][])
		for (const { shape, floor, note } of rows) {
			it(`⭐ ${hint} — ${shape} → ${String(note)}`, () => {
				expect(floorBlockedHint(floor), 'arrangement: the hint is not the row’s').toBe(hint);
				expect(
					escalationRecommendationNote(floor),
					'the line beside the findings says something that is not true of this floor'
				).toBe(note);
			});
			// ⛔ AND ONLY WHERE THE RECOMMENDATION IS RECORDED: the same floor without it reads the same hint, and no line.
			it(`⛔ ${hint} — ${shape}, with NO recommendation recorded → no line`, () => {
				const without: FloorView = {
					...floor,
					policies: floor.policies.map((p) => ({
						...p,
						observations: p.observations.filter((o) => o.code !== RECOMMENDATION_CODE)
					}))
				};
				expect(floorBlockedHint(without), 'arrangement: the hint is not the row’s').toBe(hint);
				expect(
					escalationRecommendationNote(without),
					'a line said the reviewer recommended escalation where nothing recorded it'
				).toBeUndefined();
			});
		}

	it('⛔ a SATISFIED floor → no line, whatever its review recorded: nothing blocks, and nothing is addressed first', () => {
		expect(
			escalationRecommendationNote(
				floorView({
					aggregate: 'SATISFIED',
					satisfied: true,
					policies: [
						policy('floor.schema-invariant', 'SATISFIED'),
						policy('floor.identity-provenance', 'SATISFIED'),
						reviewPolicy({ disposition: 'SATISFIED', observations: [recommendation] })
					]
				})
			)
		).toBeUndefined();
	});
});

// ⭐ `JAN-ESCREC` D3 — THE HEADER CHIP READS THE AGGREGATE IN WORDS. The read-back passes a CONDITIONALLY_SATISFIED review
// through as itself (`aggregateDisposition`), and the chip — `floor ${aggregate}` lower-cased in the template — then read
// "floor conditionally_satisfied", the contract's token with its underscore (the ER-1 app verifier's finding [4], its drive
// S10). Nothing in the suite asserted the underscore form (searched first). ⭑ The label is the server's (`floorChipLabel`),
// so every value is held here: the e2e lane may record no positive reasoning review but the stand-in's
// (`lane-control.ts`, LIMB 2), so no browser test can stage a CONDITIONALLY_SATISFIED review to read it from.
describe('⭐ JAN-ESCREC D3 — floorChipLabel: the header chip reads the aggregate in words, never as a token', () => {
	/** Every aggregate the floor can show, and its words — exhaustive by construction (`satisfies`). */
	const CHIP_WORDS = {
		REJECTED: 'floor rejected',
		EVIDENCE_REQUIRED: 'floor evidence required',
		UNASSESSED: 'floor unassessed',
		INCONCLUSIVE: 'floor inconclusive',
		CONDITIONALLY_SATISFIED: 'floor conditionally satisfied',
		SATISFIED: 'floor satisfied'
	} as const satisfies Record<AggregateDisposition, string>;

	it.each(Object.entries(CHIP_WORDS))('⭑ %s → "%s"', (aggregate, words) => {
		expect(floorChipLabel(floorView({ aggregate, satisfied: aggregate === 'SATISFIED' }))).toBe(
			words
		);
	});
});

// ⭐ `JAN-ESCREC` D3 — THE READ-BACK, AND THE RECORD BEHIND IT. A floor is recorded through `runPwaFloor` — the product's
// recorder, over a real engine — with the reviewer's reply injected (`withLiveReviewerSeam`: agy selected, PATH finding no
// program, so nothing is started), then read back by `loadPwaFloor`, the reader the PWA page uses.
//
// ⛔ THE READ-BACK AGGREGATE WAS A HAND-WRITTEN LADDER — SATISFIED, else REJECTED, else UNASSESSED — so an ESCALATED or an
// INCONCLUSIVE review read back UNASSESSED, "nothing assessed it", beside a review that ran and concluded. It now asks the
// package's `aggregateDisposition`, the composition's own, so the read-back says what the run said. ⭑ A review still IN
// PROGRESS keeps the reading it had (the control): nothing concluded it, and UNASSESSED says so.
describe('⭐ JAN-ESCREC D3 — the read-back says what the run concluded, and lists no recommendation among the findings', () => {
	const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5E00';
	const ROOT_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5E01';
	const PRODUCER: FloorProducer = {
		agentId: 'jpwb-authoring-agent',
		modelId: 'pi-authoring',
		providerId: 'janumi'
	};
	const review = (f: FloorView | undefined) =>
		f?.policies.find((p) => p.policyId === 'floor.reasoning-review');

	/** A reviewer's reply over the seeded criteria: the first faulted when asked, every other answered unfailed. */
	const reply = (recommendation: string, faultFirst = false): string =>
		JSON.stringify({
			findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
				criterionId: c.id,
				failed: faultFirst && i === 0,
				statement:
					faultFirst && i === 0
						? 'The graph substitutes an easier problem.'
						: 'evaluated; the failure class is absent'
			})),
			recommendation,
			residualUncertainty: []
		});

	/** A real engine holding one DRAFT PWA with one root type — a graph the schema/invariant policy passes. Its clock
	 *  moves on every read, so "the latest assessment" is never decided by a tie.
	 *  ⭑ `reviewCriteria`, when given, seeds the floor policies from their definitions with the reasoning review's
	 *  criteria passed through it — the POLICY in force, which the review reads from the store (`reasoningReviewCriteria`)
	 *  — and otherwise `seedFloorPolicies` seeds them as the workbench does. */
	function engineWithAPwa(
		reviewCriteria?: (criteria: readonly AssessmentCriterion[]) => AssessmentCriterion[]
	): {
		readonly session: AuthedEngineHandle;
		readonly send: (
			type: string,
			aggregateType: string,
			id: string,
			payload: unknown,
			correlationId?: string
		) => void;
	} {
		let tick = 0;
		let events = 0;
		const host = createEngine({
			authenticate: standaloneAuthenticator(),
			ontology,
			now: () => new Date(Date.UTC(2026, 9, 1, 9) + 1000 * ++tick).toISOString(),
			newEventId: () => `evt_${++events}`
		});
		const session = host.as(SESSION_CREDENTIAL);
		let sequence = 0;
		const send = (
			type: string,
			aggregateType: string,
			id: string,
			payload: unknown,
			correlationId = 'escrec-setup'
		): void => {
			sequence += 1;
			const command = {
				commandId: `escrec-${sequence}`,
				commandType: type,
				commandSchemaVersion: 1,
				targetAggregateType: aggregateType,
				targetAggregateId: id,
				issuedAt: '2026-10-01T09:00:00Z',
				correlationId,
				idempotencyKey: `escrec-idem-${sequence}`,
				payload
			} as DomainCommand;
			const r = session.dispatch(command);
			expect(r.status, `arrangement: ${type} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
		};
		if (reviewCriteria === undefined) seedFloorPolicies(session);
		else
			// `seedFloorPolicies`' own payload (`rph-engine` `seed-workbench.ts`), with the review's criteria passed through.
			for (const def of FLOOR_POLICY_DEFINITIONS)
				send('CreateAssurancePolicy', 'ASSURANCE_POLICY', def.policyId, {
					policyId: def.policyId,
					version: '1.0.0',
					name: def.name,
					purpose: def.purpose,
					rationale: def.rationale,
					applicableObjectTypes: [...ProfessionalWorkObjectTypeSchema.options],
					evaluatedClaimTypes: def.evaluatedClaimTypes,
					criteria:
						def.policyId === 'floor.reasoning-review' ? reviewCriteria(def.criteria) : def.criteria,
					evaluatorRole: def.evaluatorRole,
					independenceRequirement: def.independence,
					findingDefinitions: def.findingDefinitions,
					permittedControlActions: def.permittedControlActions
				});
		send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
			pwaId: PWA,
			name: 'Escalation read-back fixture',
			description: 'A DRAFT PWA whose review is recorded and read back.',
			domain: 'software',
			version: '1.0.0'
		});
		send('DefinePwuType', 'PWU_TYPE', ROOT_TYPE, {
			pwuTypeId: ROOT_TYPE,
			pwaId: PWA,
			pwuKind: 'PLAN',
			name: 'Plan',
			purpose: 'Plan the work',
			isRoot: true,
			permittedChildTypeIds: [],
			requiredInputs: [],
			requiredOutputs: [],
			requiredAssurancePolicyIds: []
		});
		return { session, send };
	}

	const runFloor = (session: AuthedEngineHandle, answer: string) =>
		withLiveReviewerSeam(() =>
			runPwaFloor(
				PWA,
				{
					prompt: 'Assess it.',
					producer: PRODUCER,
					print: async () => answer,
					canonical: session
				},
				session
			)
		);

	it('⛔ a clean review recommending ESCALATED: neither the run nor the read-back lists the recommendation as a finding, and the read-back reads INCONCLUSIVE, as the run did — not UNASSESSED', async () => {
		const { session } = engineWithAPwa();
		const run = await runFloor(session, reply('ESCALATED'));
		expect(review(run)?.disposition, 'arrangement: D1 did not escalate the clean review').toBe(
			'ESCALATED'
		);
		expect(
			run?.policies
				.filter((p) => p.policyId !== 'floor.reasoning-review')
				.map((p) => p.disposition),
			'arrangement: another floor policy blocks, so D1 had nothing to escalate'
		).toEqual(['SATISFIED', 'SATISFIED']);
		expect(run?.aggregate, 'arrangement: the composition did not shut the gate').toBe(
			'INCONCLUSIVE'
		);
		expect(
			review(run)?.observations.map((o) => o.code),
			'arrangement: D2 recorded no recommendation'
		).toEqual([RECOMMENDATION_CODE]);
		expect(
			run?.reasoningGaps,
			'the run listed the recommendation among the reasoning-review findings'
		).toEqual([]);

		const back = loadPwaFloor(PWA, session);
		expect(review(back)?.disposition).toBe('ESCALATED');
		// ⭑ READ FROM THE OBJECT: the recorded code, severity and statement — ⭐ B4: and the part's type, from the host.
		expect(review(back)?.observations).toEqual([
			{
				code: RECOMMENDATION_CODE,
				severity: 'INFORMATIONAL',
				statement: RECOMMENDATION_STATEMENT,
				typeId: ROOT_TYPE,
				typeName: 'Plan'
			}
		]);
		expect(
			back?.reasoningGaps,
			'the read-back listed the recommendation among the reasoning-review findings'
		).toEqual([]);
		expect(back?.satisfied).toBe(false);
		expect(back?.aggregate, 'an escalated review read back as though nothing had assessed it').toBe(
			'INCONCLUSIVE'
		);
		expect(floorBlockedHint(back!)).toBe('ROUTE_TO_HUMAN');
	});

	it('⛔ a review that answered nothing (INCONCLUSIVE) reads back INCONCLUSIVE, as the run did — not UNASSESSED', async () => {
		const { session } = engineWithAPwa();
		const run = await runFloor(
			session,
			JSON.stringify({ findings: [], recommendation: 'INCONCLUSIVE', residualUncertainty: [] })
		);
		expect(review(run)?.disposition, 'arrangement: the review was not INCONCLUSIVE').toBe(
			'INCONCLUSIVE'
		);
		expect(run?.aggregate, 'arrangement: the run did not read INCONCLUSIVE').toBe('INCONCLUSIVE');

		const back = loadPwaFloor(PWA, session);
		expect(review(back)?.disposition).toBe('INCONCLUSIVE');
		expect(
			back?.aggregate,
			'an inconclusive review read back as though nothing had assessed it'
		).toBe('INCONCLUSIVE');
	});

	it('⭑ a REJECTED review recommending ESCALATED: its subject finding is listed among the findings, the recommendation is not', async () => {
		// The exclusion is of ONE code: an exclusion that dropped the review's own findings with it passes the case above.
		const { session } = engineWithAPwa();
		const run = await runFloor(session, reply('ESCALATED', true));
		expect(review(run)?.disposition, 'arrangement: the faulted criterion did not reject').toBe(
			'REJECTED'
		);
		const codes = review(run)?.observations.map((o) => o.code) ?? [];
		expect(codes.at(-1), 'arrangement: the recommendation was not recorded last').toBe(
			RECOMMENDATION_CODE
		);
		expect(codes, 'arrangement: no subject finding was recorded beside it').toHaveLength(2);
		const finding = review(run)!.observations[0]!.statement;
		expect(run?.reasoningGaps).toEqual([finding]);
		expect(loadPwaFloor(PWA, session)?.reasoningGaps).toEqual([finding]);
	});

	it('⭑ CONTROL — a review still IN PROGRESS keeps the reading it had: begun and not concluded, it reads back UNASSESSED', async () => {
		// Without this, INCONCLUSIVE above could hold for a read-back that called every unsatisfied review INCONCLUSIVE —
		// which `aggregateDisposition` does to a state it does not know, unless the reader says the review is not concluded.
		const { session, send } = engineWithAPwa();
		const run = await runFloor(session, reply('SATISFIED'));
		expect(run?.satisfied, 'arrangement: the clean floor was not satisfied').toBe(true);
		expect(
			loadPwaFloor(PWA, session)?.aggregate,
			'arrangement: the satisfied floor did not read back SATISFIED'
		).toBe('SATISFIED');
		// A fresh review of the same subject, begun and left ASSESSING: the LATEST, so the one the reader takes. ⭐ B3: of the
		// PWA's one part, its type, in the round the run recorded — the round reader takes a part's review from its round.
		const assessmentId = 'assess_01ARZ3NDEKTSV4RRFFQ69G5E02';
		const version = Number(getObject(session, ROOT_TYPE)?.semanticVersion ?? 1);
		const round = loadPwaFloor(PWA, session)?.reasoningReviewRunToken;
		send(
			'RequestAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			assessmentId,
			{
				assessmentId,
				assurancePolicyId: 'floor.reasoning-review',
				policyVersion: '1',
				subjectObjectIds: [ROOT_TYPE],
				subjectSemanticVersions: { [ROOT_TYPE]: version },
				claimIds: []
			},
			round
		);
		send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {}, round);

		const back = loadPwaFloor(PWA, session);
		expect(
			back?.parts?.map((p) => p.disposition),
			'arrangement: the reader did not take the review in progress'
		).toEqual(['ASSESSING']);
		expect(review(back)?.disposition, 'the review in progress folded as a concluded one').toBe('UNASSESSED');
		expect(back?.aggregate, 'a review in progress read back as a concluded one').toBe('UNASSESSED');
	});

	it('⛔ a review concluded CONDITIONALLY_SATISFIED reads back CONDITIONALLY_SATISFIED — what it concluded, never UNASSESSED', async () => {
		// The ER-1 app verifier's finding [4] (its mutant `ER1-V53`; part B's disclosed problem 4). The read-back passes every
		// one of the five concluded dispositions to `aggregateDisposition`; the hand-written ladder read this one UNASSESSED,
		// and only ESCALATED and INCONCLUSIVE were pinned. Staged as the control above stages its review: the floor run
		// satisfied, then a fresh review of the same subject — the LATEST — concluded beside the MATERIAL finding that
		// conditions it (a positive disposition is foreclosed only by an open BLOCKING or CRITICAL one).
		const { session, send } = engineWithAPwa();
		const run = await runFloor(session, reply('SATISFIED'));
		expect(run?.satisfied, 'arrangement: the clean floor was not satisfied').toBe(true);
		// ⭐ B3 — of the PWA's one part, its type, in the round the run recorded (the control above says why).
		const assessmentId = 'assess_01ARZ3NDEKTSV4RRFFQ69G5E03';
		const version = Number(getObject(session, ROOT_TYPE)?.semanticVersion ?? 1);
		const round = loadPwaFloor(PWA, session)?.reasoningReviewRunToken;
		const finding = {
			findingCode: 'RR-08-evidence-integrity',
			severity: 'MATERIAL',
			statement: 'A cited source is summarised but not linked.'
		};
		send(
			'RequestAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			assessmentId,
			{
				assessmentId,
				assurancePolicyId: 'floor.reasoning-review',
				policyVersion: '1',
				subjectObjectIds: [ROOT_TYPE],
				subjectSemanticVersions: { [ROOT_TYPE]: version },
				claimIds: []
			},
			round
		);
		send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {}, round);
		send(
			'RecordAssuranceObservation',
			'ASSURANCE_OBSERVATION',
			'obs_01ARZ3NDEKTSV4RRFFQ69G5E04',
			{ assessmentId, observationType: 'FINDING', ...finding },
			round
		);
		send(
			'CompleteAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			assessmentId,
			{
				validatorResult: {
					validatorId: 'staged.reasoning-review',
					validatorVersion: '1',
					policyId: 'floor.reasoning-review',
					policyVersion: '1',
					assessmentId,
					subjectObjectIds: [ROOT_TYPE],
					subjectSemanticVersions: { [ROOT_TYPE]: version },
					claimResults: [],
					evidenceConsideredIds: [],
					evidenceRejected: [],
					observations: [{ ...finding, subjectObjectIds: [ROOT_TYPE] }],
					dispositionRecommendation: 'CONDITIONALLY_SATISFIED',
					recommendedControlActions: [],
					residualUncertainty: [],
					limitations: [],
					executionProvenance: {}
				}
			},
			round
		);

		const back = loadPwaFloor(PWA, session);
		expect(
			review(back)?.disposition,
			'arrangement: the reader did not take the conditionally satisfied review'
		).toBe('CONDITIONALLY_SATISFIED');
		expect(back?.satisfied, 'arrangement: a conditional review satisfied the floor').toBe(false);
		expect(
			back?.aggregate,
			'a conditionally satisfied review read back as though nothing had assessed it'
		).toBe('CONDITIONALLY_SATISFIED');
		// ⭑ And the header chip reads it in words, over this read-back (`floorChipLabel`, held whole in its describe above).
		expect(
			floorChipLabel(back!),
			'the header chip read the contract’s token, underscore and all'
		).toBe('floor conditionally satisfied');
	});

	it('⛔ the exclusion is of ONE CODE, not a severity: a finding the POLICY declares INFORMATIONAL is listed beside the BLOCKING one — run and read-back — and only the recommendation is not', async () => {
		// The ER-1 app verifier's finding [5] (its mutants `ER1-V52` and `ER1-V56`). A reply's finding is recorded at its
		// criterion's DECLARED severity (`reasoningReviewResultFromJudgement`), and every seeded floor criterion declares
		// BLOCKING — so a list that dropped every INFORMATIONAL observation along with the recommendation passed every case
		// above. Here the POLICY in force declares one criterion INFORMATIONAL, so two INFORMATIONAL observations meet in
		// one review, and only the recommendation's CODE tells them apart.
		const [blocking, informational] = SEEDED_REASONING_REVIEW_CRITERIA.map((c) => c.id);
		const { session } = engineWithAPwa((criteria) =>
			criteria.map((c) =>
				c.id === informational ? { ...c, severityIfNotMet: 'INFORMATIONAL' } : c
			)
		);
		const statements = [
			'The graph substitutes an easier problem.',
			'An obligation is named, but not who discharges it.'
		];
		const run = await runFloor(
			session,
			JSON.stringify({
				findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
					criterionId: c.id,
					failed: i < 2,
					statement: statements[i] ?? 'evaluated; the failure class is absent'
				})),
				recommendation: 'ESCALATED',
				residualUncertainty: []
			})
		);
		expect(review(run)?.disposition, 'arrangement: the BLOCKING finding did not reject').toBe(
			'REJECTED'
		);
		expect(
			review(run)?.observations.map((o) => `${o.code}/${o.severity}`),
			'arrangement: the review did not record a BLOCKING finding, an INFORMATIONAL one and the recommendation'
		).toEqual([
			`${blocking}/BLOCKING`,
			`${informational}/INFORMATIONAL`,
			`${RECOMMENDATION_CODE}/INFORMATIONAL`
		]);
		expect(
			run?.reasoningGaps,
			'the run dropped an informational finding along with the recommendation'
		).toEqual(statements);
		expect(
			loadPwaFloor(PWA, session)?.reasoningGaps,
			'the read-back dropped an informational finding along with the recommendation'
		).toEqual(statements);
	});
});
