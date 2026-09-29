// The de minimis floor's identity/provenance step (§8.4 step 2) must CHECK the subject, not assert it. This locks
// the derivation that replaced five literal `true`s (findings 18/67): a PWA missing a stable id, semantic version,
// provenance, or an identified producer must fail its mandatory criterion. Mutation proof: revert any derived fact
// below to a literal `true` and the matching case here goes red.
import { describe, expect, it } from 'vitest';
import {
	classifyFloorRemediation,
	floorBlockedHint,
	identityProvenanceFactsOf,
	isOperationalRemediation
} from './floor.js';
import type {
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
// THREE SENTENCES. `floorBlockedHint` is the one answer the PWA page renders its hint from: 'REVISE' says "revise the
// graph and re-run", 'NOT_BY_REVISION' says revising does not address the block, and 'REVISE_AND_REVIEW' says to revise
// the graph for the findings the floor records against it AND that the review reached no verdict revising can answer.
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
		ESCALATE_REVIEW: [
			{
				shape: 'an ESCALATED review, nothing recorded',
				floor: floorView({ policies: [reviewPolicy({ disposition: 'ESCALATED' })] }),
				hint: 'NOT_BY_REVISION'
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

	it('⛔ an ESCALATED review carrying a subject observation → NOT_BY_REVISION: the escalation, not the finding, answers it', () => {
		const floor = floorView({
			policies: [reviewPolicy({ disposition: 'ESCALATED', observations: [subjectFinding] })]
		});
		expect(
			classifyFloorRemediation(floor).guidance,
			'arrangement: the escalation branch answered it'
		).toMatch(/an automatic subject edit cannot substitute for the escalation/i);
		expect(floorBlockedHint(floor)).toBe('NOT_BY_REVISION');
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
