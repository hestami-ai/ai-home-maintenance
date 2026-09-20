// JAN-ASSERTED `AS-02` — WHAT A REAL STORED WORK UNIT RENDERS INTO A PROFESSIONAL'S INSTRUCTION.
//
// ⛔ THIS SUITE EXISTS BECAUSE THE EXISTING ONE CANNOT EXPRESS ITS OWN DEFECT, AND THE REASON IS THE FIXTURE
// RATHER THAN THE ASSERTION. `execution-invocation.test.ts:31` DOES assert the rendered value — it is not a
// weak test. What it asserts is the rendering of a PWU **the store would reject at write**: driving the real
// engine with `expectedOutputs: ['a viability finding']` returns `VALIDATION_FAILED` — *"expected record,
// received string"* — and persists nothing. A hand-built literal can only ever carry the type its author
// asserted, and the whole defect is that the STORED shape differs from the asserted one.
//
// ⭐ SO THE ONLY INSTRUMENT THAT CAN SEE IT IS A REAL WRITE FOLLOWED BY A REAL READ. That is this file.
//
// ⚠ `REG-F-411`: `objects.ts:556` declares `expectedOutputs: z.array(OutputDefinitionSchema)` and
// `OutputDefinitionSchema = z.record(z.string(), z.unknown())` — OBJECTS. A cast in the demo route laundered
// them into `readonly string[]`, `execution-invocation.ts:94` rendered them with `.join(', ')`, and every
// executing model and every reviewer was shown `Required outputs: [object Object]`.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from './index.js';
import {
	assembleStepContext,
	prepareModelInvocation,
	resolveInvocationSubject,
	resolvePwuTypeFacts
} from './execution-invocation.js';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from './context-assembly.js';

const TS = '2026-09-20T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5K00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5K10';

describe('⭐ AS-02 — the invocation subject is built from a REAL stored work unit', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id: string, type: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	/**
	 * ⭑ THE SHAPE THE SURFACE ACTUALLY MINTS — `+page.server.ts:957`, verbatim, for every PWU it creates.
	 *
	 * ⛔ EVERY OTHER FIELD IS FULLY VALID, AND THAT IS NOT TIDINESS. The first draft of this helper passed
	 * `boundaries: {}` and `riskProfile: {}`, and the command was refused with NINE issues — none of them about
	 * `expectedOutputs`. The refusal test below then PASSED WHILE PROVING NOTHING: an arrangement that trips
	 * two guards attributes to neither. `expectedOutputs` is the only variable here, and the test asserts the
	 * MESSAGE rather than the status so it cannot drift back.
	 */
	const proposePwu = (expectedOutputs: unknown) =>
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU,
				pwuKind: 'ASSESSMENT',
				title: 'Route Assessment',
				description: 'Assess the delivery route',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs,
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'LOW',
					uncertainty: 'LOW',
					irreversibility: 'LOW',
					securitySensitivity: 'NONE',
					regulatoryExposure: 'NONE'
				}
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);

	/** The issue paths a refusal named, so a test can say WHICH guard fired rather than merely that one did. */
	const issuePaths = (out: unknown): string[] =>
		(
			(out as { error?: { details?: { issues?: { path?: string }[] } } }).error?.details?.issues ?? []
		).map((i) => i.path ?? '');

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
	});

	it('⛔ the store REFUSES the string fixture three suites were built on', () => {
		// ⭐ THIS IS THE TEST THAT EXPLAINS THE BLINDNESS, and it is why `AS-01` lands before anything else.
		// `execution-invocation.test.ts:14`, `run-model-step.test.ts:38` and
		// `no-answer-is-not-an-answer.test.ts:37` all describe a work unit that CANNOT BE WRITTEN. Every
		// assertion they make about rendering is an assertion about an object that does not exist.
		const out = proposePwu(['a viability finding']);
		expect(out.status, 'the store accepted a shape its own contract forbids').not.toBe('ACCEPTED');
		// ⭑ THE MESSAGE, NOT THE STATUS. Every other field in this arrangement is valid, so the refusal must
		// name `expectedOutputs` and nothing else — otherwise this test would pass for a fixture that was
		// malformed somewhere the finding is not about, which is precisely how its first draft behaved.
		expect(issuePaths(out), 'the refusal must be about expectedOutputs and nothing else').toEqual([
			'expectedOutputs.0'
		]);
		expect(store.loadObject(PWU), 'a refused command persisted an object').toBeUndefined();
	});

	it('⛔ and a work unit the store DOES accept must never render [object Object]', () => {
		// THE MUTANT: render `expectedOutputs` with `.join(', ')`. That is HEAD before this programme, and it
		// is what every executing model and every reviewer was shown.
		const out = proposePwu([{ outputId: `out_${PWU}`, kind: 'DOCUMENT' }]);
		expect(out.status, `the surface-minted shape must be storable: ${issuePaths(out).join(', ')}`).toBe(
			'ACCEPTED'
		);

		const stored = store.loadObject(PWU)?.state as Record<string, unknown>;
		expect(stored, 'the accepted command persisted nothing').toBeDefined();

		const ctx = assembleStepContext(
			{ id: PWU, title: String(stored.title), ...stored },
			{
				templateText: 'Assess {subject}. Deliver {expectedOutputs}.',
				templateVersion: 1,
				declaredPlaceholders: ['subject', 'expectedOutputs'],
				status: 'ACTIVE'
			}
		);
		// ⭑ ASSERTED OVER EVERY SUPPLIED VALUE, NOT JUST THE ONE FIELD. A remedy that fixes `expectedOutputs`
		// and lets a sibling launder the same way would pass a single-field assertion.
		for (const [key, value] of Object.entries(ctx))
			expect(String(value), `the producer must never be shown [object Object] for {${key}}`).not.toContain(
				'[object Object]'
			);

		// ⛔⛔ AND THE ABSENCE MUST BE A REFUSAL, NOT A SILENCE — WITHOUT THIS THE ASSERTION ABOVE IS TRIVIAL.
		// Once `R29` stops supplying `{expectedOutputs}`, the loop iterates a context that simply does not
		// contain it, and "no supplied value says [object Object]" becomes true of an implementation that
		// supplies NOTHING. That is the difference between honouring the ratified rule and quietly disabling it.
		//
		// ⭑ THE RULE IS THE SPONSOR'S: `JAN-PROMPT` default #2 (2026-09-04, `REG-D-058`) — *"A missing declared
		// placeholder at render time is a REFUSAL, not a disclosed gap."*
		const plan = prepareModelInvocation(
			{ id: PWU, title: String(stored.title) },
			'pwut_9',
			{
				templateText: 'Assess {subject}. Deliver {expectedOutputs}.',
				templateVersion: 1,
				declaredPlaceholders: ['subject', 'expectedOutputs'],
				status: 'ACTIVE'
			},
			{ policy: DEFAULT_CONTEXT_ASSEMBLY_POLICY, alsoAssembles: [] }
		);
		expect(plan.ready, 'a template declaring an unsuppliable placeholder must REFUSE').toBe(false);
		expect(!plan.ready && plan.reason, 'the refusal must name the marker it could not fill').toMatch(
			/\{expectedOutputs\}/
		);
	});

	it('⭐ CONTROL — a placeholder the work unit genuinely cannot supply is ABSENT, not empty', () => {
		// ⛔ WITHOUT THIS, "never render [object Object]" passes for an implementation that supplies NOTHING —
		// and supplying nothing would silently disable the ratified refusal rather than honour it.
		//
		// ⭑ THE RULE IS THE SPONSOR'S, NOT THIS SUITE'S: `JAN-PROMPT` default #2 (2026-09-04, `REG-D-058`) —
		// *"A missing declared placeholder at render time is a REFUSAL, not a disclosed gap."* A `?? []` at the
		// production call site turned ABSENT into PRESENT-BUT-EMPTY and made it unreachable there.
		const ctx = assembleStepContext(
			{ id: PWU, title: 'Route Assessment' },
			{
				templateText: 'Assess {subject} against {criteria}.',
				templateVersion: 1,
				declaredPlaceholders: ['subject', 'criteria'],
				status: 'ACTIVE'
			}
		);
		expect('criteria' in ctx, 'absent, not present-and-empty — the refusal depends on this').toBe(false);
		expect(ctx.subject, 'the control must still supply what the unit HAS').toBe('Route Assessment');
	});

	// ── ⭐⭐ `JAN-ASSERTED` `AS-04` — THE BOUNDARY REFUSES ON SHAPE, NOT ONLY ON ABSENCE ──────────────────────────
	//
	// ⛔ THIS SUITE WAS COMMITTED WITHOUT THESE TWO, AND THE ROADMAP HAD PREDICTED THEM. `AS-04`'s own table names
	// *"assert instead of parse → a stored row that does not parse must REFUSE, not proceed"* and *"refuse on
	// absence only, not on shape → the same test."* The remedy landed; the test that proves it did not. It was
	// found by asking why `guards:export` reported two newly BARE exports — the census noticing an unguarded
	// promise is what surfaced a missing test, which is the census doing exactly its job.
	describe('⭐ AS-04 — the invocation subject is PARSED, so a malformed projection refuses', () => {
		it('⛔ REFUSES a projection that does not parse as a PROFESSIONAL_WORK_UNIT — the cast said it did', () => {
			// THE MUTANT: assert instead of parse (`raw as ProfessionalWorkUnit`). The malformed row then flows
			// straight through to the template renderer, which is `REG-F-411` exactly: eleven hand-written
			// assertions and a `check-types` that could say nothing about any of them.
			expect(() =>
				resolveInvocationSubject(() => ({ objectType: 'PROFESSIONAL_WORK_UNIT', title: 42 }), PWU)
			).toThrow(/does not parse as a PROFESSIONAL_WORK_UNIT/);
		});

		it('⛔ and REFUSES an id that resolves to nothing, naming the work unit', () => {
			expect(() => resolveInvocationSubject(() => undefined, PWU)).toThrow(/does not resolve/);
		});

		it('⭐ CONTROL — a well-formed STORED work unit resolves, so this is not "refuse everything"', () => {
			// ⛔ WITHOUT THIS, BOTH ASSERTIONS ABOVE PASS FOR A RESOLVER THAT THROWS UNCONDITIONALLY — the shape
			// `D-2`'s first horn describes, and the one a refusal-based remedy is most likely to ship.
			const out = proposePwu([{ outputId: `out_${PWU}`, kind: 'DOCUMENT' }]);
			expect(out.status).toBe('ACCEPTED');
			const subject = resolveInvocationSubject((id) => store.loadObject(id)?.state, PWU);
			expect(subject.id).toBe(PWU);
			expect(subject.title, 'the parsed subject lost the value it exists to carry').toBe(
				'Route Assessment'
			);
		});

		it('⭐ CONTROL — the TYPE facts parse too, and an absent type is not an error', () => {
			// ⭑ THE ASYMMETRY IS DELIBERATE AND IS ASSERTED, not left to a reader. A work unit with no resolvable
			// TYPE is already handled downstream by `prepareModelInvocation`'s "declares no agent behaviour"
			// refusal, which names the type; throwing here would replace a good refusal with a worse one.
			expect(resolvePwuTypeFacts(() => undefined, undefined)).toEqual({});
			expect(resolvePwuTypeFacts(() => undefined, 'pwut_missing')).toEqual({});
			expect(() => resolvePwuTypeFacts(() => ({ objectType: 'PWU_TYPE', purpose: 7 }), 'pwut_9')).toThrow(
				/does not parse as a PWU_TYPE/
			);

			// ⛔⛔ AND THE CONTROL DID NOT CONTROL, WHICH THE COVERAGE FLOOR CAUGHT AND NOT A REVIEWER.
			// Everything above is an EMPTY or a THROW: three assertions, not one of which passes a well-formed
			// PWU_TYPE through. A resolver that returned `{}` for every parseable input would satisfy two of the
			// three, and this block is titled *“the TYPE facts parse too”* — a claim it never tested.
			// `JAN-PFA`'s per-file floor is what surfaced it: `resolvePwuTypeFacts`'s success path was the only
			// uncovered statement pair in the file, which is the ratchet catching a control that could not fail.
			//
			// ⭑ THE FIXTURE IS NOT HAND-INVENTED. It is the `base` object `rph-contracts/src/objects.test.ts`
			// asserts parses (`PwuTypeSchema.safeParse(base).success === true`), so a drift in the schema fails
			// there first. And if it did not parse, `resolvePwuTypeFacts` THROWS — so a bad fixture here is loud,
			// unlike the silent one that made an earlier control unreadable.
			const actor = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
			const wellFormedType = {
				id: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5FAV',
				objectType: 'PWU_TYPE',
				schemaVersion: 1,
				semanticVersion: 1,
				revision: 0,
				lifecycleStatus: 'DRAFT',
				createdAt: TS,
				createdBy: actor,
				updatedAt: TS,
				updatedBy: actor,
				provenance: { originType: 'HUMAN_DECISION', sourceObjectIds: [], sourceEventIds: [] },
				tags: [],
				extensions: [],
				pwaId: 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00',
				pwaVersion: '1.0.0',
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'Root',
				purpose: 'assess the route against the approved need',
				isRoot: true,
				permittedParentTypeIds: [],
				permittedChildTypeIds: [],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: [],
				completionRule: 'done',
				status: 'DRAFT'
			};
			const facts = resolvePwuTypeFacts(() => wellFormedType, 'pwut_01ARZ3NDEKTSV4RRFFQ69G5FAV');
			expect(facts.purpose, 'the parsed type lost the purpose it exists to carry').toBe(
				'assess the route against the approved need'
			);
			// ⭑ AND THE TWO OPTIONAL SPREADS STAY ABSENT rather than arriving as `undefined` keys: a caller
			// spreading these into an invocation must not introduce a key whose value is a silent nothing.
			expect(Object.keys(facts)).toEqual(['purpose']);

			// ⭐ AND THE PRESENT SIDE OF BOTH SPREADS — the other half of each branch pair, and the half that
			// actually carries a professional's authored work. A type whose `promptTemplate` were silently
			// dropped here would reach the producer with no instruction at all, which is `R29`'s defect in the
			// opposite direction: not a bad rendering, an absent one.
			const rich = resolvePwuTypeFacts(
				() => ({
					...wellFormedType,
					promptTemplate: {
						templateText: 'Assess {subject}.',
						templateVersion: 1,
						declaredPlaceholders: ['subject'],
						status: 'DRAFT'
					},
					contextSpecification: { requiredElements: ['subject'], constraintDispositions: [] }
				}),
				'pwut_01ARZ3NDEKTSV4RRFFQ69G5FAV'
			);
			expect(Object.keys(rich).sort()).toEqual(['contextSpecification', 'promptTemplate', 'purpose']);
			expect(rich.promptTemplate?.templateText).toBe('Assess {subject}.');
		});
	});
});
