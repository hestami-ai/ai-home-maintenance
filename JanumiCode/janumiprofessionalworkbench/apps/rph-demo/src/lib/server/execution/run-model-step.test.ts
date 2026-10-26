// JAN-EXECRUN XR-02 — the first model call ever made on behalf of an execution step.
//
// ⭑ THE EXECUTION PLANE HAS EXISTED SINCE `REG-D-055` AND NOTHING HAS EVER WRITTEN TO IT. `plane` is a
// generated enum with an `EXECUTION` member; every record in the system carries `ASSURANCE` or `AUTHORING`.
// This suite is the first thing that puts a record on it.
import { describe, expect, it } from 'vitest';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import type { PromptTemplate, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { assembledSources, runModelInvocationStep } from './run-model-step.js';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from '@janumipwb/rph-application';
import { oneShotSession } from './producer-session.js';
import { stepBindingFor } from './step-binding.js';

/**
 * ⭐ R11 — the adapter observation every `ToolInvocationResult` now owes.
 *
 * ⚠ `canObserve: false` IS THE HONEST FIXTURE DEFAULT, not a convenience. These stand-ins are functions that
 * return an answer; they mint no tool surface and watch no session, so they are not in a position to observe
 * anything. A fixture reporting `canObserve: true, calls: []` would be claiming a measurement no fixture made —
 * which is the very conflation `governedToolCallReport` exists to keep out of the record.
 */
const UNOBSERVED = {
	canObserve: false as const,
	reason: 'Fixture: this stand-in returns an answer and observes nothing.'
};

/**
 * The status a live, usable binding carries. ⛔ NAMED RATHER THAN SPELLED PER ARRANGEMENT, so the REVOKED cases
 * below differ from every other case by ONE token and nothing else — an arrangement that differed in two places
 * would leave the refusal attributable to either.
 */
const AUTHORIZED = 'AUTHORIZED';

const SUBJECT = {
	id: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X01',
	title: 'Route Assessment',
	// ⛔ NO `expectedOutputs` (`JAN-ASSERTED` `R29`). The old value — `['a viability finding']` — was a
	// PWU **the store rejects at write**: `OutputDefinitionSchema` is `z.record(...)`, so a string array
	// is `VALIDATION_FAILED` and nothing persists. Every assertion made over it was an assertion about
	// an object that cannot exist (`REG-F-411`).
	purpose: 'Decide whether the route is viable'
};

const ACTIVE: PromptTemplate = {
	templateText: 'Assess {subject}. Deliver {purpose}.',
	templateVersion: 4,
	declaredPlaceholders: ['subject', 'purpose'],
	status: 'ACTIVE'
};

const ANSWER = 'The route is viable; the northern leg carries the risk.';

function harness(over: Partial<Parameters<typeof runModelInvocationStep>[0]> = {}) {
	const dispatched: RecordModelExchangePayload[] = [];
	let n = 0;
	const store = createInMemoryArtifactStore();
	const input = {
		subject: SUBJECT,
		subjectSemanticVersion: 1,
		pwuTypeId: 'pwut_9',
		template: ACTIVE,
		session: oneShotSession(async () => ANSWER),
		store,
		tenantPrefix: 'tnt-test',
		dispatchExchange: (payload: RecordModelExchangePayload) => {
			dispatched.push(payload);
			return { status: 'ACCEPTED' };
		},
		newId: (prefix: string) => `${prefix}_${++n}`,
		now: () => '2026-09-05T10:00:00Z',
		modelId: 'test-model',
		providerId: 'test-provider',
		// ⭑ CP-04 — the deployment's own policy. Required, so no call site can skip the consultation.
		contextPolicy: DEFAULT_CONTEXT_ASSEMBLY_POLICY,
		// ⛔ SAID, NOT OMITTED. `binding` is required with an explicit NONE so that skipping the capability
		// check cannot be expressed by leaving a field out — the dodge shape `REG-F-364` records.
		binding: { kind: 'NONE' as const },
		...over
	};
	return { input, dispatched, store };
}

describe('JAN-EXECRUN — a work unit actually runs', () => {
	it('⭑ calls the model with the RENDERED prompt and records it on the EXECUTION plane', async () => {
		let seen = '';
		const { input, dispatched } = harness({
			session: oneShotSession(async (p: string) => {
				seen = p;
				return ANSWER;
			})
		});

		const out = await runModelInvocationStep(input);
		expect(out.ran, out.ran ? '' : out.refusedBecause).toBe(true);

		// The model got the AUTHORED prompt with the work unit's own facts in it — not a generic instruction
		// and not a template with the markers still in it.
		expect(seen).toBe('Assess Route Assessment. Deliver Decide whether the route is viable.');

		// THE MUTANT: record on the ASSURANCE plane, or omit the record entirely. The run still "works" and the
		// governed stream then contains a model call attributed to the wrong plane, or no trace that a work
		// unit was executed by a model at all.
		expect(dispatched, 'a model call left no record').toHaveLength(1);
		expect(dispatched[0]!.plane).toBe('EXECUTION');
		expect(dispatched[0]!.subjectObjectId, 'the record names the work unit it ran for').toBe(
			SUBJECT.id
		);
		expect(dispatched[0]!.subjectObjectType).toBe('PROFESSIONAL_WORK_UNIT');
	});

	it('⭑ the recorded fingerprint RESOLVES to the template that produced the prompt', async () => {
		// PER-9: "A prompt or template fingerprint identifies that record; it never substitutes for it." Before
		// REG-D-058 this field named a template with no home. THE MUTANT: drop the fingerprint from captureTry —
		// which is exactly what a cast was silently doing when this module was first written, and only removing
		// the cast surfaced it.
		const { input, dispatched } = harness();
		await runModelInvocationStep(input);
		expect(dispatched[0]!.promptTemplateFingerprint, 'the fingerprint was dropped in transit').toBe(
			'pwut_9@v4'
		);
	});

	// ── ⚠⚠ THE FINDING THIS SUITE TURNED UP, PINNED IN BOTH DIRECTIONS ─────────────────────────────────────
	//
	// The §9.7 retention split hunts for a JSON object, because the assurance validator's answer IS one and
	// anything around it is volunteered reasoning. AN EXECUTION STEP'S ANSWER IS PROSE — a work product — and
	// there is no marker separating product from reasoning inside it. `splitAnswerSpan` therefore reports
	// `located: false`, and §9.7's own instruction BLOCKS retention.
	//
	// ⭑ THAT IS THE CORRECT BEHAVIOUR, NOT A BUG TO ROUTE AROUND. Retaining undelimited prose whole would
	// classify any volunteered reasoning inside it as RETAINED_BY_PARTICIPATION — permanent under PER-8, when
	// PER-12 requires it purgeable. That is precisely the whole-blob write REG-D-056 was careful not to permit.
	//
	// ⭑⭑ AND THE REMEDY ALREADY EXISTS ON THE TEMPLATE: `outputContract`. A template that tells the model what
	// a conforming answer looks like gets a locatable answer back, and the existing split works unchanged. The
	// two tests below pin both sides so neither can drift into the other.
	it('⛔ an UNDELIMITED prose answer is NOT retained — §9.7 blocks it, and that is right', async () => {
		// THE MUTANT: retain the whole reply when nothing can be located. The run goes green, the artifact
		// appears, and any reasoning the model volunteered is now permanent — the exact defect REG-D-056 refused.
		const { input, dispatched } = harness();
		const out = await runModelInvocationStep(input);
		expect(out.ran, 'the call itself succeeded').toBe(true);

		const answerRef = dispatched[0]!.answerSpanRef as { status?: string; reason?: string };
		expect(answerRef.status, 'undelimited prose must not be retained as an answer span').toBe(
			'PENDING_CONTENT_PLANE'
		);
		expect(answerRef.reason, 'and the record must say why').toMatch(/separated losslessly|§9.7/i);
		// ⭐ `JAN-EXEC` Phase 7 P7-6 I2 — AND THE WHOLE REPLY IS NOT KEPT EITHER, ON THIS PLANE. The reviewer's plane now keeps
		// an unlocatable reply whole, purgeable, for diagnosis (`REG-D-103` (2); `captureTry`'s `unseparatedRawOutput`), and
		// the design leaves the executor's plane unchanged (`DESIGN-the-reviewer-isolated.md` §2 I2): here such an answer may
		// be the work product (`REG-F-351`). ⛔ THE MUTANT: the option's default flipped to retain.
		const wholeRef = dispatched[0]!.rawOutputBeforeCoercionRef as { status?: string };
		expect(wholeRef.status, 'the execution plane keeps no unlocatable answer whole').toBe('PENDING_CONTENT_PLANE');
	});

	it('⭑ a DELIMITED answer IS retained, and the ARTIFACT names the SAME bytes the exchange does', async () => {
		// ⭑ ONE OBJECT, TWO NAMES. The store keys on tenant + retention class + content hash, so the same bytes
		// under the same class ARE the same stored object. THE MUTANT: store the artifact under a different
		// class or a minted key. Two keys for one answer, and a reader cannot tell which the assessment rested
		// on — the ambiguity REG-F-345 spent three attempts to remove one layer up.
		const DELIMITED = '{"finding":"The route is viable; the northern leg carries the risk."}';
		const { input, dispatched, store } = harness({
			session: oneShotSession(async () => DELIMITED)
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;

		expect(await store.get(out.storageKey), 'the answer is not retained where it says').toBe(
			DELIMITED
		);
		const answerRef = dispatched[0]!.answerSpanRef as { storageKey?: string; status?: string };
		expect(answerRef.status).toBe('STORED');
		expect(answerRef.storageKey, 'the artifact and the exchange must name one object').toBe(
			out.storageKey
		);
	});

	it('⭐ REG-F-557 — an envelope whose work product holds a fenced block KEEPS its answer span (REG-D-056)', async () => {
		// P2: the execution exchange keeps no answer bytes when no span is located (`REG-D-056`), and the reader took
		// the first fence anywhere in the reply - here inside the work product's document string, with no brace pair
		// in it - so three phases' answers were unreadable. The envelope is ONE JSON object, so it is the span, whole
		// (`DESIGN-the-answer-span.md` AS1; §3's separable consequence). Built with JSON.stringify, as a model's is.
		const WORK_PRODUCT = {
			documents: [
				{ path: 'docs/requirements.md', text: '# Req\n\n```text\nnode bin/x.js [options]\n```\n' }
			]
		};
		const ENVELOPE = JSON.stringify({
			workProduct: WORK_PRODUCT,
			rationale: { rationale: 'The usage line is the contract the CLI is held to.' }
		});
		const { input, dispatched, store } = harness({
			session: oneShotSession(async () => ENVELOPE)
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;

		const answerRef = dispatched[0]!.answerSpanRef as { storageKey?: string; status?: string };
		expect(answerRef.status, 'the envelope is one JSON object: its span is located and retained').toBe('STORED');
		expect(await store.get(answerRef.storageKey!), 'the answer span is the whole envelope').toBe(ENVELOPE);
		expect(await store.get(out.storageKey), 'the artifact is the work product, unwrapped').toBe(
			JSON.stringify(WORK_PRODUCT)
		);
	});

	it('⛔ REFUSES when the type has no ACTIVE template — and records nothing', async () => {
		// A type with no prompt declares no agent behaviour. THE MUTANT: fall through to a default prompt. Every
		// work unit would then appear executable, against an instruction nobody authored or reviewed.
		const { input, dispatched } = harness({ template: undefined });
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(false);
		expect(!out.ran && out.refusedBecause).toMatch(/declares no agent behaviour/);
		expect(dispatched, 'a refusal before the call must not record a call').toHaveLength(0);
	});

	it('⚠ a FAILED model call is still recorded — the one try that broke the run is not the one with no evidence', async () => {
		// THE MUTANT: let the throw propagate before capture. The record then exists for every call except the
		// one anybody would want to look at, which is the defect inverted.
		const { input, dispatched } = harness({
			session: oneShotSession(async (_p: string) => {
				throw new Error('provider unreachable');
			})
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(false);
		expect(!out.ran && out.refusedBecause).toMatch(/provider unreachable/);
		expect(dispatched, 'the failed try left no record').toHaveLength(1);
		// ⭐⭐ THIS ASSERTION READ `REJECTED` AND PASSED, AND IT WAS ASSERTING SOMETHING FALSE.
		//
		// ⛔ CORRECTED BY SPONSOR RULING (`JAN-NOANS`, 2026-09-20), NOT BY CONVENIENCE. `rejected` is a
		// PRODUCER-FAULT disposition: it says an answer arrived and was refused. This arrangement throws before
		// any answer exists, so the producer committed no fault — and the ratified vocabulary note for
		// `NO_RESPONSE` names *"a timeout or abort"* as its referent, which is exactly this arm.
		//
		// ⚠ REWRITTEN RATHER THAN DELETED. The guarantee it carries is unchanged and still worth pinning: a
		// failed call LEAVES A RECORD, on the EXECUTION plane, with a disposition that does not lie about whose
		// fault it was. Only the expected token moved.
		expect(dispatched[0]!.disposition).toBe('NO_RESPONSE');
		// ⭑ AND E-5 STILL SEPARATES THE TWO NON-ANSWERS. A thrown call is `NOT_ATTEMPTED`; a call that returned
		// holding nothing is `EMPTY_RESPONSE` (`no-answer-is-not-an-answer.test.ts`). They share a disposition
		// and must not share an outcome — that is the whole reason only the disposition moved.
		expect(dispatched[0]!.parseOutcome.outcome).toBe('NOT_ATTEMPTED');
		expect(dispatched[0]!.plane).toBe('EXECUTION');
	});
});

describe('JAN-TOOLSUITE TS-04 — who produced the work product', () => {
	it('⭑⭑ a tool that REPORTS its identity is recorded as PROVIDER_REPORTED, with ITS model', async () => {
		// ⭑ THIS IS THE FIELD THAT MAKES THE WHOLE SLICE VISIBLE IN THE RECORD. Before it, the caller passed
		// `resolveJudgeModel()` as the producer — labelling the PRODUCING model with the REVIEWING model's id, so
		// `checkIndependence('DIFFERENT_MODEL', …)` compared a string with itself and could only refuse.
		//
		// THE MUTANT: keep using `input.modelId`. The reported identity is then discarded, the grade silently
		// weakens to HOST_CONFIGURED, and `PROVIDER_REPORTED` goes back to having zero producers.
		const { input, dispatched } = harness({
			session: oneShotSession(async () => ({
				answer: { arrived: true, text: ANSWER },
				rawOutput: ANSWER,
				producer: {
					agentId: 'execution.model-invocation',
					modelId: 'gpt-5.4-mini',
					providerId: 'openai-codex'
				},
				identityEvidence: 'PROVIDER_REPORTED' as const,
				observedToolCalls: UNOBSERVED
			}))
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;

		// The TOOL's model, not the host's configured `test-model`.
		expect(out.producer.modelId).toBe('gpt-5.4-mini');
		expect(out.producer.providerId).toBe('openai-codex');
		expect(out.identityEvidence).toBe('PROVIDER_REPORTED');

		// ⭑ AND IT REACHES THE EXCHANGE RECORD, not just the return value. A producer identity that stops short
		// of E-3 is a field with no consumer — the defect this repository calls "delivery is not the end".
		const rec = dispatched.at(-1)!;
		expect(rec.resolvedModel).toMatchObject({
			value: 'gpt-5.4-mini',
			evidence: 'PROVIDER_REPORTED'
		});
		expect(rec.resolvedProvider).toMatchObject({
			value: 'openai-codex',
			evidence: 'PROVIDER_REPORTED'
		});
	});

	it('⭑ CONTROL — a tool that returns only a string keeps the CONFIGURED identity, graded HOST_CONFIGURED', async () => {
		// Without this, "always PROVIDER_REPORTED" passes the test above — and grading a host assertion as
		// provider confirmation is the fabricated-measurement defect the grade exists to prevent.
		const { input, dispatched } = harness();
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		expect(out.producer.modelId).toBe('test-model');
		expect(out.identityEvidence).toBe('HOST_CONFIGURED');
		expect(dispatched.at(-1)!.resolvedModel).toMatchObject({ evidence: 'HOST_CONFIGURED' });
	});

	it('⚠ the model VERSION stays UNREPORTED, and its rationale names no single tool', async () => {
		// THE MUTANT: write the model label into `resolvedModelVersion`. A label is not a version and PER-9
		// forbids the substitution. The rationale is also asserted because the old one said "agy --print reports
		// no model version", which is FALSE about Pi and Devin — an absence explained by naming a tool that was
		// never used states something untrue.
		const { input, dispatched } = harness();
		await runModelInvocationStep(input);
		const version = dispatched.at(-1)!.resolvedModelVersion;
		expect(version.availability).toBe('UNREPORTED');
		expect(version.value).toBeUndefined();
		expect(version.rationale ?? '').not.toMatch(/agy/i);
	});
});

describe('JAN-TOOLSUITE TS-05 — the reviewer never receives the producer’s reasoning', () => {
	it('⛔ the ANSWER excludes volunteered reasoning, even when the tool returns both', async () => {
		// ⭑⭑ THIS IS AN ASR-13 PROTECTION WITH NOTHING ELSE GUARDING IT. `PER-12`: volunteered reasoning is
		// "never an input to any tier of assurance policy", and "its presence in an evaluator's context is a
		// hidden-context independence violation (ASR-13)". The survey found ASR-13's "shared hidden context" and
		// "shared prompt lineage" dimensions have ZERO representation in code — so this separation is the only
		// thing standing between the producer's interior and the reviewer's context.
		//
		// THE MUTANT: `answer = returned.rawOutput`. The reviewer is then handed the reasoning along with the
		// work product, and the violation is manufactured by the very code meant to prevent it. Nothing else in
		// the suite would notice.
		const REASONING = 'First I considered the southern leg, then rejected it.';
		const { input } = harness({
			session: oneShotSession(async () => ({
				answer: { arrived: true, text: ANSWER },
				volunteeredReasoning: REASONING,
				rawOutput: REASONING + ANSWER,
				producer: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
				identityEvidence: 'PROVIDER_REPORTED' as const,
				observedToolCalls: UNOBSERVED
			}))
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;

		expect(out.answer).toBe(ANSWER);
		expect(out.answer).not.toContain(REASONING);
		// ⭑ AND THE WORK PRODUCT THAT IS STORED — the bytes an assurance policy actually reads — carries none of
		// it either. Asserting only the return value would miss a retention path that stored the raw blob.
		// ⚠ AND THIS ASSERTION COULD NOT FAIL UNTIL THE TYPE-CHECKER SAID SO. It read `stored?.bytes ?? ''`;
		// `store.get` returns a STRING, so `.bytes` was undefined, `?? ''` made it empty, and "the empty string
		// does not contain the reasoning" is true no matter what was stored. Green, and proving nothing.
		const stored = await input.store.get(out.storageKey);
		expect(stored, 'the work product must actually be retained').toBeTruthy();
		expect(stored, 'the retained bytes ARE the answer').toContain(ANSWER);
		expect(stored).not.toContain(REASONING);
	});

	it('⭑ CONTROL — a tool that volunteers NONE still produces the same answer, so the check is not "strip everything"', async () => {
		// Devin volunteers no reasoning at all (measured: no thinking/reasoning/thought in a full ATIF export).
		// Without this control, "always return the empty string" would pass the assertion above.
		const { input } = harness({
			session: oneShotSession(async () => ({
				answer: { arrived: true, text: ANSWER },
				rawOutput: ANSWER,
				producer: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
				identityEvidence: 'PROVIDER_REPORTED' as const,
				observedToolCalls: UNOBSERVED
			}))
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran && out.answer).toBe(ANSWER);
	});
});

describe('JAN-EXECSESS — a repair is a TURN on a HELD session, not a re-rendered instruction', () => {
	// ⭑ SPONSOR (2026-09-06): *"the CLI session wasn't closed or released until the phase or sub-phase completed
	// … This approach allowed the assurance policies feedback to be fed back to the implementing agent before
	// that phase or sub-phase was determined complete."*

	/** A session that REMEMBERS, so the difference between a turn and a fresh call is observable. */
	function recordingSession() {
		const turns: string[] = [];
		return {
			turns,
			session: {
				retainsHistory: true,
				dispose: () => undefined,
				// ⭐ PHASE 5 — this fake ran no commands, and for a fake that is a MEASUREMENT rather than
				// a refusal to answer: no `ProcessRunner` was ever handed to anything here.
				processRuns: () => ({ runs: [], observedCount: 0, recordedLimit: 32, writes: [] }),
				lastTurnObservation: () => UNOBSERVED,
				turn: async (text: string) => {
					turns.push(text);
					return ANSWER;
				}
			}
		};
	}

	it('⭑⭑ turn 1 carries the INSTRUCTION; turn 2 carries the FINDINGS — on the same session', async () => {
		// THE MUTANT: re-render the template on retry (what `JAN-EXECLOOP` shipped). Turn 2 then asks the model
		// to produce the work afresh, as though it had never seen it — and the producer's history, which is the
		// component the sponsor made responsible for tracking its responses, is wasted.
		const { turns, session } = recordingSession();
		const { input } = harness({ session });
		await runModelInvocationStep(input);
		await runModelInvocationStep({
			...input,
			priorFindings: [
				{ code: 'RR-01-no-problem-substitution', statement: 'It restated the prompt.' }
			]
		});

		expect(turns).toHaveLength(2);
		// Turn 1 is the rendered template, with the work unit's own facts in it.
		expect(turns[0]).toContain('Route Assessment');
		// ⛔ Turn 2 must NOT be the instruction again.
		expect(turns[1]).not.toContain('Route Assessment');
		expect(turns[1]).toContain('RR-01-no-problem-substitution');
		expect(turns[1]).toContain('It restated the prompt.');
	});

	it('⚠ and the REVIEWER still receives the INSTRUCTION, never the repair turn', async () => {
		// ⭑ THIS IS WHAT KEEPS THE REVIEWER COLD. While findings were spliced into the producing prompt, the
		// reviewer saw them too — it receives that prompt as the "intent" — so it gained state it was never
		// designed to have, by accident. THE MUTANT: return `turnText` as `outcome.prompt`. The reviewer would
		// then judge the work against a repair request rather than against the obligation.
		const { session } = recordingSession();
		const { input } = harness({ session });
		const out = await runModelInvocationStep({
			...input,
			priorFindings: [
				{ code: 'RR-01-no-problem-substitution', statement: 'It restated the prompt.' }
			]
		});
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		expect(out.prompt, 'the reviewer judges against the obligation').toContain('Route Assessment');
		expect(out.prompt).not.toContain('RR-01-no-problem-substitution');
	});

	it('⛔ a one-shot tool declares that it does NOT retain history', async () => {
		// Retrofitting memory onto `agy` or the fixture would be the fabricated-capability defect: they have
		// none — each call is a fresh process with a fresh context. THE MUTANT: default `retainsHistory` to true.
		expect(oneShotSession(async () => ANSWER).retainsHistory).toBe(false);
	});
});

// ── ⭑ JAN-CTXPOL / CP-04a — WHAT THIS STEP DECLARES IT IS ASSEMBLING ──────────────────────────────────────
describe('assembledSources — the claim the policy is checked against', () => {
	it('⭑ try 1 assembles NOTHING beyond the instruction, even with a remembering session', () => {
		// ⚠ THE MUTANT: list the prior sources whenever `retainsHistory` is true. A FRESH session has no prior
		// turns to hold, so that would be a claim about material which does not exist — and it would make the
		// policy check pass or fail on a fiction.
		expect(assembledSources(undefined, true)).toEqual([]);
		expect(assembledSources([], true)).toEqual([]);
	});

	it('⭑ a repair turn assembles the findings — and, when the session REMEMBERS, its own prior turns', () => {
		// ⭑⭑ THIS IS `retainsHistory`'s FIRST CONSUMER. The field has been declared since `JAN-EXECSESS` and
		// read by nothing but tests: a held session genuinely carries the producer's own prior work product and
		// rationale into the repair turn, and that IS assembled context whether or not the harness handed it
		// over. THE MUTANT: ignore `retainsHistory` — a remembering producer would then be checked against a
		// policy describing a forgetful one.
		expect(assembledSources([{ code: 'C1', statement: 's' }], false)).toEqual([
			{ source: 'PRIOR_REVIEW_FINDING', scope: 'THIS_WORK_UNIT' }
		]);
		expect(assembledSources([{ code: 'C1', statement: 's' }], true)).toEqual([
			{ source: 'PRIOR_REVIEW_FINDING', scope: 'THIS_WORK_UNIT' },
			{ source: 'PRIOR_WORK_PRODUCT', scope: 'THIS_WORK_UNIT' },
			{ source: 'PRIOR_RATIONALE', scope: 'THIS_WORK_UNIT' }
		]);
	});

	it('⛔ and the step REFUSES when the policy does not permit what it is about to assemble', async () => {
		// ⭑ THE CONSULTATION, END TO END THROUGH THE STEP rather than through the pure function alone. THE
		// MUTANT: pass `alsoAssembles: []` unconditionally — the ceiling then approves every repair turn ever
		// made, because it is never told one happened.
		const { input } = harness({
			priorFindings: [{ code: 'C1', statement: 'the basis is not stated' }],
			contextPolicy: {
				policyId: 'ctx-narrow',
				permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }]
			}
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(false);
		expect(!out.ran && out.refusedBecause).toMatch(/ctx-narrow/);
		expect(!out.ran && out.refusedBecause).toMatch(/PRIOR_REVIEW_FINDING/);
	});
});

// ── ⭐⭐ `JAN-EXEC` P7-6R RD8 — A RE-RUN OF THE WORK CARRIES THE FINDINGS INTO A FRESH SESSION'S FIRST TURN ───────────
//
// `DESIGN-the-stopped-unit-recovery.md` RD8 (`REG-D-104` (1)): a person who re-runs refused work opens a FRESH session, and
// the hazard the route reader found is that a findings turn omits the instruction, because the HELD session already had
// it (`run-model-step.ts`'s findings turn, `JAN-EXECSESS`). Handed to a fresh session, that turn is findings with no task.
// ⭐ So a carried finding rides the FIRST turn, after the instruction; and the turn declares `PRIOR_REVIEW_FINDING` only —
// never `PRIOR_WORK_PRODUCT` or `PRIOR_RATIONALE`, which a fresh session does not hold, remembering or not.
describe('⭐ P7-6R RD8 — a re-run’s first turn is the instruction AND the carried findings, in a fresh session', () => {
	/** A FRESH session that remembers — so what its FIRST turn holds is the whole of what it was told. */
	function freshSession() {
		const turns: string[] = [];
		return {
			turns,
			session: {
				retainsHistory: true,
				dispose: () => undefined,
				processRuns: () => ({ runs: [], observedCount: 0, recordedLimit: 32, writes: [] }),
				lastTurnObservation: () => UNOBSERVED,
				turn: async (text: string) => {
					turns.push(text);
					return ANSWER;
				}
			}
		};
	}
	const CARRIED = [
		{ code: 'RR-04-no-proxy-satisfaction', statement: 'The work product is a plausible stub.' }
	];

	it('⛔ the first turn holds the INSTRUCTION, then the carried findings — and the reviewer is still handed the instruction alone', async () => {
		// THE MUTANT: send the findings turn the held session uses, which omits the instruction — or ignore what is carried.
		const { turns, session } = freshSession();
		const { input } = harness({ session, carriedFindings: CARRIED });
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		expect(turns, 'one turn, the fresh session’s first').toHaveLength(1);
		expect(turns[0]!.startsWith(out.prompt), 'the first turn does not open with the instruction').toBe(
			true
		);
		expect(turns[0]).toContain('RR-04-no-proxy-satisfaction: The work product is a plausible stub.');
		expect(turns[0], 'the producer is not told its earlier files may still be there').toContain(
			'files it wrote may still be in the workspace'
		);
		// ⛔ The reviewer stays cold: it judges the work against the obligation, never against the carried findings.
		expect(out.prompt).not.toContain('RR-04-no-proxy-satisfaction');
	});

	it('⛔ it declares PRIOR_REVIEW_FINDING: a policy permitting the instruction alone REFUSES the turn, naming it', async () => {
		// THE MUTANT: carry the findings and declare nothing — the ceiling then approves material it was never told about.
		const { session } = freshSession();
		const { input } = harness({
			session,
			carriedFindings: CARRIED,
			contextPolicy: {
				policyId: 'ctx-instruction-only',
				permittedSources: [{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' }]
			}
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran, 'carried findings were assembled under no declared authority').toBe(false);
		expect(!out.ran && out.refusedBecause).toMatch(/PRIOR_REVIEW_FINDING at THIS_WORK_UNIT/);
	});

	it('⭑ CONTROL — and ONLY that: a policy permitting the findings but not the producer’s prior work runs it, on a session that remembers', async () => {
		// ⛔ THE MUTANT: declare the held session's three sources — a fresh session holds no prior work product or rationale,
		// and this policy would then refuse a turn that carries neither.
		const { session } = freshSession();
		const { input } = harness({
			session,
			carriedFindings: CARRIED,
			contextPolicy: {
				policyId: 'ctx-findings-only',
				permittedSources: [
					{ source: 'RENDERED_INSTRUCTION', scope: 'THIS_TRY' },
					{ source: 'PRIOR_REVIEW_FINDING', scope: 'THIS_WORK_UNIT' }
				]
			}
		});
		expect((await runModelInvocationStep(input)).ran).toBe(true);
	});

	it('⭑ CONTROL — with nothing carried, the first turn is the instruction exactly, as Begin & Execute sends it', async () => {
		const { turns, session } = freshSession();
		const { input } = harness({ session, carriedFindings: [] });
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		expect(turns).toEqual([out.prompt]);
	});
});

// ── ⭑⭑ JAN-OUTCONTRACT OC-02 — THE CONTRACT REACHES THE REVIEWER, AND IT DOES SO INSIDE THE INSTRUCTION ────
//
// ⭑ THE ROADMAP PREDICTED A SECOND FIELD AND MEASUREMENT REFUTED IT. `OC-02` was drafted as
// `ReasoningReviewInput.outputContract` threaded into `judgePrompt`. Then the chain was traced:
// `plan.prompt` (which `OC-01` now builds WITH the contract) -> `outcome.prompt` -> `producingPrompt` ->
// `input.prompt` -> the judge prompt's *"was given exactly this instruction"*. The reviewer already has it.
//
// ⛔ ADDING THE FIELD WOULD HAVE BEEN `REG-F-353` — *"a second way to say one thing is how restated vocabulary
// comes to disagree"* — and here the disagreement is concrete: a reviewer handed an instruction saying one
// thing and a separate contract field saying another has no rule for which wins.
describe('OC-02 — the reviewer is handed the contract as part of the instruction', () => {
	it('⭑⭑ the prompt the outcome carries — what the reviewer judges against — includes the contract', async () => {
		// THE MUTANT: return `rendered.text` from `prepareModelInvocation`, or have this step return `turnText`
		// instead of `plan.prompt`. Either drops the contract from the reviewer's view of the obligation, so it
		// would judge the work product against an instruction the producer never received.
		const { input } = harness({
			template: {
				...ACTIVE,
				outputContract: 'A single JSON object: {"finding": string, "basis": string[]}.'
			}
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		expect(out.ran && out.prompt).toContain('{"finding": string, "basis": string[]}');
		// ⭑ AND IT IS THE SAME STRING THE PRODUCER WAS GIVEN, which is the property that makes the review a
		// judgement of the same pair rather than of a summary.
		expect(out.ran && out.prompt).toContain('Assess Route Assessment');
	});

	it('⭑ CONTROL — with no contract the reviewer’s instruction is unchanged', async () => {
		// Without this, "carries the contract" cannot be told apart from "carries a section always", and every
		// existing prompt would silently gain a trailer.
		const { input } = harness();
		const out = await runModelInvocationStep(input);
		expect(out.ran && out.prompt).toBe('Assess Route Assessment. Deliver Decide whether the route is viable.');
	});
});

// ── ⭑⭑ JAN-EXECGOV EG-03 — THE GRANT CONSTRAINS SOMETHING ──────────────────────────────────────────────────
//
// `EG-02` made a model step run under an AUTHORIZED binding, and disclosed what it did NOT do: *"a granted
// capability still constrains nothing at the point of use."* This is that increment.
//
// ⛔ AND IT REOPENS A DISCLOSED DEFERRAL ON ITS OWN STATED TERMS. `RPH-EXE-004` is recorded
// `UNENFORCED_DISCLOSED` because *"JPWB is never in the path of an operation: it governs plans and hosts no tool
// invocation"* and *"its caller does not exist yet. EXIT: revisit when a broker exists to call it."* Both
// grounds are now false — `runModelInvocationStep` IS the broker, and `execution-invocation.ts:3-8` already
// refutes the first sentence against the Guide. ⛔ The OPERATION tier stays the Platform's and is NOT built.
describe('EG-03 — the binding must still authorize the invocation', () => {
	// ⭐⭐ THE PRODUCTION TABLE, NOT A HAND-WRITTEN ONE, AND JAN-EXEC PHASE 3 IS WHY THAT CHANGED. This used to
	// be a literal `[{capability:'network'}]`, which was the whole request at the time. The request is now
	// derived from the step type's REQUIRES/USES needs, and a literal here would assert against a table this
	// suite invented — so a needs table that drifted from the one production uses would still be green.
	// ⛔ `!` IS SAFE AND IS THE POINT: a MODEL_INVOCATION on a MODEL type is exactly the case that IS bound, and
	// `step-binding.test.ts` is where the `undefined` arms are driven.
	const BINDING = stepBindingFor('MODEL_INVOCATION', 'MODEL', 'bind_1', 'step_1')!;

	it('⭑⭑ REFUSES when the stored grant no longer covers what the step needs — BEFORE any model call', async () => {
		// ⚠ THE ASSERTION THAT MATTERS IS `calls === 0`. A refusal that fires after the model has answered has
		// disclosed the harm afterwards — the ordering `prompt-render.ts:8-12` settles. THE MUTANT: run the check
		// after `session.turn(...)`; the refusal still returns, and a paid, unauthorized invocation has happened.
		let calls = 0;
		const { input } = harness({
			session: oneShotSession(async () => {
				calls += 1;
				return ANSWER;
			}),
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				granted: [],
				authorizationStatus: AUTHORIZED
			}
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(false);
		expect(!out.ran && out.refusedBecause).toMatch(/does not grant 'network'/);
		expect(calls, 'the model must not be invoked at all').toBe(0);
	});

	it('⚠ the refusal names the rule and what to do, not just the failure', async () => {
		// A refusal a reader cannot act on is the silent omission `PER-9` forbids one layer up. THE MUTANT:
		// return a bare boolean and let the caller invent a message.
		const { input } = harness({
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				granted: ['file-system'],
				authorizationStatus: AUTHORIZED
			}
		});
		const out = await runModelInvocationStep(input);
		expect(!out.ran && out.refusedBecause).toMatch(/RPH_CAPABILITY_NOT_GRANTED/);
		expect(!out.ran && out.refusedBecause).toMatch(
			/revoked binding cannot be used for new attempts/
		);
	});

	it('⭑ CONTROL — a binding that DOES grant it proceeds, so this is not "refuse everything"', async () => {
		// ⛔ Without this the check is satisfiable by refusing unconditionally, and `EG-02`'s whole path breaks.
		const { input } = harness({
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				granted: ['network'],
				authorizationStatus: AUTHORIZED
			}
		});
		expect((await runModelInvocationStep(input)).ran).toBe(true);
	});

	it('⭑⭑ CONTROL — a step with NO binding still runs, and that must stay true', async () => {
		// The `OUT_OF_SCOPE` case the kernel records as load-bearing: collapsing it *"would make every plan in
		// the reference seed — which authors no RuntimeBinding whatsoever — permanently unstartable."* THE
		// MUTANT: require a binding. Every TRANSFORMATION step, and every pre-existing plan, stops.
		expect((await runModelInvocationStep(harness().input)).ran).toBe(true);
	});

	it('⚠ a grant that is a SUPERSET still passes — the rule is coverage, not equality', async () => {
		// `RPH-EXE-004`'s example grants a subset and fails the operation outside it; nothing says a grant may
		// not exceed the request. THE MUTANT: compare the two sets for equality — a binding authorized for more
		// than this step asked would refuse a step it plainly covers.
		// ⚠ THE ARRANGEMENT HAD TO GROW WITH THE REQUEST. It read `['network','file-system']`, which WAS a
		// superset of the one-capability request and is now a strict SUBSET of a three-capability one — so it
		// would have gone on passing while testing a different thing entirely. Every requested capability plus
		// one nobody asked for is what "superset" means against the table production actually uses.
		const { input } = harness({
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				granted: ['network', 'file-system', 'process-execution', 'secrets'],
				authorizationStatus: AUTHORIZED
			}
		});
		expect((await runModelInvocationStep(input)).ran).toBe(true);
	});

	it('⭐⭐ an ungranted capability the step merely USES does NOT refuse the step — it narrows the tools', async () => {
		// ⛔ THIS IS THE LIMB `RPH-EXE-004`'s OPERATION-LEVEL WORDING TURNS ON, and before Phase 3 it did not
		// exist: every requested capability was REQUIRED, so an ungranted one could only ever refuse. The
		// ratified rule degrades an OPERATION — *"network operations fail authorization"* — and grant-by-absence
		// is how that is delivered: `process-execution` ungranted means `run_command` is never minted, and the
		// invocation proceeds with a narrower surface.
		// ⚠ THE MODEL IS CALLED, AND THAT IS THE ASSERTION. A refusal here would look like the check working
		// while actually overturning the rule it claims to enforce. THE MUTANT: drop the `need !== 'REQUIRES'`
		// guard in `stepCapabilityRefusal` — every USES capability becomes a step-killer and this goes red.
		let calls = 0;
		const { input } = harness({
			session: oneShotSession(async () => {
				calls += 1;
				return ANSWER;
			}),
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				granted: ['network', 'file-system'],
				authorizationStatus: AUTHORIZED
			}
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran, 'an ungranted USES capability must not refuse the step').toBe(true);
		expect(calls, 'the model must actually be invoked').toBe(1);
	});

	// ── ⭐⭐ `B-1` — §22.1 IS A RATIFIED RULE AND IT WAS NOT ENFORCED PER TRY ──────────────────────────────────
	//
	// ⛔ DRIVEN END TO END BEFORE THESE WERE WRITTEN. `RevokeRuntimeCapability` advances `authorizationStatus`
	// to REVOKED and DELIBERATELY leaves `grantedCapabilities` intact — its handler says so, because the
	// revocation EVENT is derived from the set the binding held. So the ONLY difference between a live binding
	// and a revoked one is the token these two cases change, and before this limb existed the two arrangements
	// below were INDISTINGUISHABLE to every reader in the Phase 3 path.
	//
	// ⚠ BOTH KINDS OF NEED, DELIBERATELY, AND THE `USES` CASE IS THE ONE THAT WOULD OTHERWISE HIDE. The old
	// disclosure claimed revocation refused a `REQUIRES` try and left a `USES` tool minted — so a suite that
	// only drove the REQUIRES case could be satisfied by the capability limb doing the work. Here BOTH grants
	// are FULL: every capability the step needs is present, so the capability limbs cannot fire and only the
	// status limb can explain a refusal.
	it('⭐⭐ a REVOKED binding refuses the next try, and the message says REVOKED rather than "not granted"', async () => {
		let calls = 0;
		const { input } = harness({
			session: oneShotSession(async () => {
				calls += 1;
				return ANSWER;
			}),
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				// ⛔ THE FULL GRANT, SURVIVING THE REVOCATION — which is exactly what the store holds after
				// RevokeRuntimeCapability, and exactly why a list is not an authorization.
				granted: ['network', 'file-system', 'process-execution'],
				authorizationStatus: 'REVOKED'
			}
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran, 'a revoked binding cannot back a new attempt (§22.1)').toBe(false);
		expect(!out.ran && out.refusedBecause).toMatch(/is REVOKED/);
		expect(!out.ran && out.refusedBecause).toMatch(/cannot back a new attempt/);
		// ⛔ AND IT MUST NOT CLAIM A CAPABILITY IS MISSING. Every one of them is granted; a message saying
		// otherwise would state something false about what this call was given, which this repository holds to
		// be worse than no refusal at all.
		expect(!out.ran && out.refusedBecause).not.toMatch(/does not grant/);
		expect(calls, 'and no model is invoked').toBe(0);
	});

	it('⛔ a DENIED binding refuses too — the kernel predicate names both terminal states', async () => {
		const { input } = harness({
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				granted: ['network', 'file-system', 'process-execution'],
				authorizationStatus: 'DENIED'
			}
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(false);
		expect(!out.ran && out.refusedBecause).toMatch(/is DENIED/);
	});

	it('⭑ CONTROL — the SAME full grant under AUTHORIZED runs, so the status limb is not "refuse everything"', async () => {
		// ⭐ THE ARRANGEMENT DIFFERS FROM THE REVOKED CASE IN ONE TOKEN. Without this the limb is satisfied by a
		// refusal that fires unconditionally — the shape this repository has shipped before and named *a control
		// that cannot fail* — and the whole Phase 3 path would be dead while every assertion above stayed green.
		const { input } = harness({
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				granted: ['network', 'file-system', 'process-execution'],
				authorizationStatus: AUTHORIZED
			}
		});
		expect((await runModelInvocationStep(input)).ran).toBe(true);
	});

	it('⭑ CONTROL — PARTIALLY_AUTHORIZED is NOT a refusal, because a narrow grant is lawful', async () => {
		// ⚠ THE OVER-REFUSAL THIS LIMB IS MOST AT RISK OF. `grantedWithinRequest` exists because a grant NARROWER
		// than the request is legal and expected — it is `RPH-EXE-004`'s own example and the reason the ratified
		// machine has this state at all. A limb that refused it would strand every least-privilege authorization
		// the platform is built to express, which is a worse failure than the one it is fixing.
		const { input } = harness({
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				granted: ['network'],
				authorizationStatus: 'PARTIALLY_AUTHORIZED'
			}
		});
		expect((await runModelInvocationStep(input)).ran).toBe(true);
	});

	it('⛔ CONTROL — the very same grant, with the REQUIRED capability removed, DOES refuse', async () => {
		// ⭐ THE CONTROL FOR THE CASE ABOVE, AND IT IS ITS OWN ARRANGEMENT RATHER THAN A RE-READING. Without it
		// "a USES capability does not refuse" is satisfied by a `stepCapabilityRefusal` that refuses NOTHING —
		// which is the shape this repository has shipped before and named *a control that cannot fail*. Same
		// binding, same fixture, one capability moved; only the REQUIRES limb can explain the difference.
		const { input } = harness({
			binding: {
				kind: 'BOUND' as const,
				binding: BINDING,
				granted: ['file-system'],
				authorizationStatus: AUTHORIZED
			}
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(false);
		expect(!out.ran && out.refusedBecause).toMatch(/does not grant 'network'/);
		expect(!out.ran && out.refusedBecause).toMatch(/REQUIRES/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('JAN-EXEC P0 — the exchange record must not disclose an absence the STEP manufactured', () => {
	// ⭐ UNBLOCKED BY A SPONSOR RULING (2026-09-14), AND THE HISTORY IS KEPT RATHER THAN DELETED.
	//
	// ⛔ THIS BLOCK WAS `it.skip` FOR A FORTNIGHT — blocked on a ratification gap, not on effort. The fix it pins
	// was built and proved both ways (`26 passed` with it, `1 failed | 25 passed` without) and then WITHDRAWN,
	// because it reddened a DIFFERENT ratified invariant that the unit suite cannot see:
	//
	//     Error: the artifact and the exchange must name ONE stored object
	//       expected tnt-local/RETAINED_BY_PARTICIPATION/4ece133d…  (answerSpanRef)
	//       received tnt-local/RETAINED_BY_PARTICIPATION/8044c907…  (the ARTIFACT)
	//
	// With the raw reply `splitAnswerSpan` locates the JSON ENVELOPE, so `answerSpanRef` names the envelope while
	// the artifact names `envelope.workProduct` — two objects where `REG-F-345` required one, *"and a reader
	// cannot tell which the assessment rested on"*.
	//
	// ⭐ THE SPONSOR RULED: *"the ANSWER HALF is the ENVELOPE; the ARTIFACT keeps naming the WORK PRODUCT; and the
	// RELATIONSHIP BETWEEN THEM MUST BE DECLARED."* ⭑ WHAT THAT SETTLES IS NOT WHICH OBLIGATION WINS — it is that
	// `REG-F-345`'s PROPERTY (a reader can tell which bytes the assessment rested on) is separable from its
	// MECHANISM (the same bytes are the same content-addressed key). The mechanism is gone; the property is now
	// carried by `declareWorkProductDerivation`, and the two tests below prove each half.
	//
	// ⚠ THE FIRST RED OF THE ORIGINAL ATTEMPT WAS INVALID AND THE FIXTURE STILL CARRIES THE CORRECTION: an
	// undelimited prose fixture makes `splitAnswerSpan` report `located: false`, §9.7 blocks every ref, and the
	// test would have reddened forever for the wrong reason. Every fixture here carries a locatable answer span.
	it('⛔ volunteered reasoning that ARRIVED must be separated at retention, never recorded as absent', async () => {
		// ⭑⭑ THE DEFECT THIS PINS IS IN THE RECORD PLANE, NOT IN A BYTE COUNT. `captureTry` already performs the
		// lawful Guide §9.7 separation — answer span RETAINED_BY_PARTICIPATION, volunteered reasoning
		// PURGEABLE_AT_EXPIRY, the mixed blob deliberately NOT stored, and `omittedRegions` carrying the byte
		// offset so the two reassemble losslessly. It never runs for an execution step, because this step hands
		// it a value from which the reasoning was ALREADY stripped upstream (`answer = returned.answerText`) and
		// which has ALSO been envelope-split.
		//
		// ⛔ SO THE RECORD TAKES THE "nothing to separate" BRANCH AND ASSERTS TWO FALSE THINGS: that the whole
		// output IS the answer, and — in `volunteeredReasoningRef`'s own words — that this is *"an observed
		// absence, not an unretained presence"*. The reasoning demonstrably arrived. A record that manufactures
		// the absence it then discloses is the shape this repository's register keeps catching.
		const REASONING = 'First I considered the southern leg, then rejected it.';
		// ⚠ THE ANSWER MUST BE LOCATABLE OR THE SPLIT IS BLOCKED, AND A BLOCKED SPLIT DEMONSTRATES NOTHING.
		// `splitAnswerSpan` locates a JSON object (optionally fenced); undelimited prose yields `located: false`
		// and every ref is refused — the behaviour this suite already pins at "an UNDELIMITED prose answer is NOT
		// retained". A fixture built from prose would redden this test forever, for the wrong reason.
		const ENVELOPE = `{"workProduct":"${ANSWER}","rationale":"Both legs were weighed."}`;
		const { input, dispatched } = harness({
			session: oneShotSession(async () => ({
				answer: { arrived: true, text: ENVELOPE },
				volunteeredReasoning: REASONING,
				rawOutput: REASONING + ENVELOPE,
				producer: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
				identityEvidence: 'PROVIDER_REPORTED' as const,
				observedToolCalls: UNOBSERVED
			}))
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);

		const rec = dispatched.at(-1);
		expect(rec, 'the try must be recorded at all').toBeTruthy();

		expect(
			rec!.volunteeredReasoningRef.status,
			'reasoning ARRIVED, so it must be retained under its own PURGEABLE_AT_EXPIRY class — not disclosed as absent'
		).toBe('STORED');
		expect(rec!.volunteeredReasoningRef.purgeability).toBe('PURGEABLE_AT_EXPIRY');

		expect(
			rec!.rawOutputBeforeCoercionRef.status,
			'the blob is MIXED, so storing it whole would classify reasoning as participating (PER-8, permanent) when PER-12 requires it purgeable'
		).toBe('PENDING_CONTENT_PLANE');

		expect(
			rec!.omittedRegions.length,
			'REG-D-057: the split must DECLARE the omission it performs, with enough structure to undo it'
		).toBeGreaterThan(0);
	});

	// ── ⭐⭐ THE SPONSOR'S RULING, AND THE OBLIGATION IT CREATED ────────────────────────────────────────────
	//
	// ⭐ RULING (2026-09-14): *"the ANSWER HALF is the ENVELOPE; the ARTIFACT keeps naming the WORK PRODUCT; and
	// the RELATIONSHIP BETWEEN THEM MUST BE DECLARED"* — so a reader can still tell which bytes an assessment
	// rested on.
	//
	// ⛔ THE RULING TOOK A GUARANTEE AWAY AND THIS IS WHAT REPLACES IT. Until it, the artifact and the exchange
	// named ONE content-addressed object and `art.storageKey === answerSpanRef.storageKey` held by arithmetic.
	// Two objects means that relation is gone, and an UNDECLARED pair of objects is strictly worse than the
	// single object it replaced. So the test below does not assert that the two differ — that is a consequence,
	// not a guarantee — it asserts that the record RESOLVES: starting from the exchange alone, a reader reaches
	// the exact bytes the assessment was recorded over.
	// ⭐⭐ R11 — THIS TEST USED TO PARSE A JSON FRAGMENT OUT OF A SENTENCE, AND THAT IS WHAT THE RULING ENDED.
	//
	// What stood here was `derivationIn(detail)`: find the literal `WORK_PRODUCT_DERIVATION` inside
	// `parseOutcome.detail`, slice from the next `{`, and `JSON.parse` the remainder. It worked, and its
	// existence WAS the finding — a typed record whose central relationship could only be read by scanning prose.
	// `R11` (sponsor, 2026-09-15) made it a typed `MODEL_EXCHANGE` field, so the assertions below read a FIELD.
	//
	// ⚠ THE ASSERTIONS ARE NOT WEAKENED BY THE MOVE, AND THE PROOF IS THAT THEY GREW. What they asserted before
	// — a tag is present, a parse succeeds, four values match, the key resolves — is now: the discriminator is
	// the right MEMBER, `sourceField` names what was taken, the whole address matches, and the key resolves. The
	// new limb is the one prose could never carry: a WRONG member (`NO_WORK_PRODUCT_EXPECTED`) is now a
	// `z.strictObject` value the handler REFUSES, where a wrong sentence was simply a sentence.
	//
	// ⭐ AND THE LITERAL IS STILL PINNED AS A LITERAL. The old test pinned the tag string deliberately, *"the one
	// assertion in the file that a rename of `WORK_PRODUCT_DERIVATION_TAG` cannot move with"* — because both
	// sides of a comparison that travel together are a control that cannot fail. The same reasoning applies to a
	// vocabulary field name, which is equally a WIRE FORMAT external readers grep: `'workProductDerivation'` and
	// `'ENVELOPE_FIELD'` are written out below rather than reached through the generated type.

	it('⭐⭐ the ARTIFACT is REACHABLE from the exchange record — the relation is DECLARED, not inferred', async () => {
		// ⭑ THE ASSERTION THAT MATTERS IS THE LAST ONE: the bytes are fetched USING ONLY WHAT THE RECORD SAYS.
		// THE MUTANT: return the old `{outcome: 'NOT_ATTEMPTED', detail: 'An execution step answer is a work
		// product; no schema coercion applies.'}`. Every other assertion in this file still passes, the run is
		// green, and the governed record now holds two stored objects with nothing relating them — which is the
		// ambiguity `REG-F-345` spent three attempts to remove, reintroduced by a ruling rather than by a bug.
		const REASONING = 'First I considered the southern leg, then rejected it.';
		// ⚠ A COMPLIANT ENVELOPE, WHICH THE SIBLING FIXTURE ABOVE DELIBERATELY IS NOT. That one carries
		// `"rationale": "<string>"`, which `splitExecutionEnvelope` records as a SHORTFALL — correctly, since the
		// execution contract asks for a rationale OBJECT. The compliant path is the one that must prove the
		// relation is declared when nothing went wrong; the shortfall path gets its own control below.
		const ENVELOPE =
			`{"workProduct":"${ANSWER}","rationale":{"rationale":"Both legs were weighed.",` +
			`"assumptions":[],"limitations":[],"residualUncertainty":[]}}`;
		const { input, dispatched, store } = harness({
			session: oneShotSession(async () => ({
				answer: { arrived: true, text: ENVELOPE },
				volunteeredReasoning: REASONING,
				rawOutput: REASONING + ENVELOPE,
				producer: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
				identityEvidence: 'PROVIDER_REPORTED' as const,
				observedToolCalls: UNOBSERVED
			}))
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;

		const rec = dispatched.at(-1)!;
		// The answer half IS the envelope, per the ruling — so the span holds the envelope's bytes.
		expect(rec.answerSpanRef.status).toBe('STORED');
		expect(
			await store.get((rec.answerSpanRef as { storageKey: string }).storageKey),
			'the ANSWER HALF is the ENVELOPE'
		).toBe(ENVELOPE);

		// ⭑ E-5 IS NO LONGER `NOT_ATTEMPTED`, and that is the ruling's own consequence: under it the answer half
		// is a structured envelope with a declared two-field shape, and this step coerces it.
		expect(rec.parseOutcome.outcome).toBe('PARSED');

		// ⭐ THE FIELD NAME AND THE MEMBER ARE PINNED AS LITERALS, DELIBERATELY NOT THROUGH THE GENERATED TYPE.
		// A durable `MODEL_EXCHANGE` is a WIRE FORMAT external readers query; a field renamed in the vocabulary
		// silently changes what they must look for, and a test that reached the name through the type would
		// travel with the rename — a control that cannot fail. This is the assertion that does not travel.
		expect(
			Object.keys(rec),
			'the governed record must carry the field under the name the vocabulary gives it'
		).toContain('workProductDerivation');

		const declared = rec.workProductDerivation;
		expect(
			declared.relation,
			'the envelope WAS honoured, so the work product came out of a named field of the answer span'
		).toBe('ENVELOPE_FIELD');
		expect(
			declared.sourceField,
			'and the record must say WHICH field, or it cannot be re-performed'
		).toBe('workProduct');
		// ⛔ THE WHOLE ADDRESS, NOT JUST THE KEY — a reference that cannot be verified cannot be challenged.
		expect(
			declared.storageProvider,
			'the provider holding the bytes, not just the key'
		).toBeTruthy();
		expect(declared.storageKey).toBe(out.storageKey);
		expect(declared.contentHash).toBe(out.contentHash);
		expect(declared.byteSize).toBe(out.byteSize);

		// ⭐ AND IT RESOLVES. This is the property the one-object rule used to give for free: from the exchange
		// record alone a reader reaches the exact bytes every assessment was recorded over.
		expect(await store.get(declared.storageKey!)).toBe(ANSWER);
	});

	it('⭑ CONTROL — a reply that IGNORES the envelope still declares where its work product went', async () => {
		// Without this, "declare the derivation" could be satisfied only on the compliant path — and the
		// non-compliant path is the one where a reader most needs to know which bytes were kept. The shortfall
		// is a RECORDED SHORTFALL, never a discarded work product: `splitExecutionEnvelope` treats the whole
		// answer as the work product, so an address still exists and still has to be named.
		const DELIMITED = '{"finding":"The route is viable."}';
		const { input, dispatched, store } = harness({
			session: oneShotSession(async () => DELIMITED)
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		const rec = dispatched.at(-1)!;
		expect(rec.parseOutcome.outcome).toBe('SCHEMA_COERCION_FAILED');
		expect(rec.parseOutcome.detail, 'the producer’s own shortfall, verbatim').toContain(
			'no `workProduct` field'
		);
		const declared = rec.workProductDerivation;
		// ⭐ R11 — THE SHORTFALL ARM IS ITS OWN MEMBER, AND THAT IS STRICTLY MORE THAN THE PROSE SAID. The old
		// fragment recorded `field: 'workProduct'` on BOTH paths, which was false here: no envelope was honoured
		// and there is no field. `WHOLE_ANSWER_SPAN` says what actually happened, and the handler REFUSES a
		// `sourceField` on it — so the pseudo-field the prose used to carry is now unrepresentable.
		expect(
			declared.relation,
			'the envelope was NOT honoured, so the whole answer span is the work product'
		).toBe('WHOLE_ANSWER_SPAN');
		expect(
			declared.sourceField,
			'and there is no envelope field to name — inventing one would assert a structure the answer lacked'
		).toBeUndefined();
		expect(declared.storageKey, 'a shortfall must not cost the reader the address').toBeTruthy();
		expect(await store.get(declared.storageKey!)).toBe(DELIMITED);
	});

	// ── ⭐⭐ R11 — THE OTHER HALF OF THE ACT: WHAT THE ADAPTER OBSERVED, NOT WHAT THE MODEL SAID ────────────
	//
	// ⛔ §22.1 MAKES MODEL OUTPUT UNTRUSTED EXTERNAL INPUT. Until this field the record's only account of what a
	// step DID was the model's own answer, so *"the model said it ran the tests"* and *"the tests ran"* were the
	// same record. This proves the governed record now distinguishes them — and, crucially, that an adapter
	// which CANNOT see is not recorded as one that LOOKED AND SAW NOTHING.
	it('⭐ a model that CLAIMS it ran a command is recorded as UNOBSERVED, not as evidence the command ran', async () => {
		// The producer asserts, in its own work product, that it executed a test suite. Nothing observed it.
		const CLAIM = 'I ran `npm test` and all 42 tests passed.';
		const ENVELOPE =
			`{"workProduct":"${CLAIM}","rationale":{"rationale":"Verified by running the suite.",` +
			`"assumptions":[],"limitations":[],"residualUncertainty":[]}}`;
		const { input, dispatched } = harness({
			session: oneShotSession(async () => ({
				answer: { arrived: true, text: ENVELOPE },
				rawOutput: ENVELOPE,
				producer: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
				identityEvidence: 'PROVIDER_REPORTED' as const,
				// The adapter mints no tool surface and watches no session — the measured state of every adapter
				// at HEAD, and the reason Phase 3 exists.
				observedToolCalls: UNOBSERVED
			}))
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);

		const rec = dispatched.at(-1)!;
		expect(Object.keys(rec), 'the field must exist under its vocabulary name').toContain(
			'observedToolCalls'
		);
		// ⛔ THE ASSERTION THAT MATTERS. `NONE_OBSERVED` would say an instrument looked and saw nothing, which
		// a reader may rely on. `NOT_OBSERVABLE` says nothing was in a position to look. The model's claim is
		// still in the work product where it belongs, and the record refuses to corroborate it.
		expect(rec.observedToolCalls.observation).toBe('NOT_OBSERVABLE');
		expect(rec.observedToolCalls.reason, 'and a disclosed absence must say why').toBeTruthy();
		expect(
			rec.observedToolCalls.calls,
			'an adapter that cannot see must not describe what it did not see'
		).toBeUndefined();
	});

	it('⭑ CONTROL — a FAILED call records EXPECTED_BUT_UNRETAINED, which is not the reviewer’s absence', async () => {
		// ⭐ THIS IS Q1 OF THE RULING, DRIVEN. Without it, "the derivation states its own absence" could be
		// satisfied by one absent member doing duty for every kind of absence — which is the bare-optional dodge
		// wearing an enum. An execution step that owed a work product and lost it must NOT be filed the same way
		// as a reviewer's call that never owed one, or an audit for steps that produced nothing finds neither.
		const { input, dispatched } = harness({
			session: oneShotSession(async () => {
				throw new Error('the backing tool exited 1');
			})
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(false);

		const rec = dispatched.at(-1)!;
		expect(rec.workProductDerivation.relation).toBe('EXPECTED_BUT_UNRETAINED');
		expect(rec.workProductDerivation.reason).toBeTruthy();
		expect(
			rec.workProductDerivation.storageKey,
			'nothing was retained, so the record must not address anything'
		).toBeUndefined();
		// ⚠ AND THE DIAGNOSTIC IS NOT COPIED INTO IT. E-5 already carries the failure verbatim; a second copy of
		// an untrusted diagnostic is a second copy nothing will ever redact.
		expect(rec.parseOutcome.detail).toContain('the backing tool exited 1');
		expect(rec.workProductDerivation.reason).not.toContain('exited 1');
	});

	// ── ⭐⭐ `B-2` — A FAILED CALL IS NOT A BLIND ONE, AND THE RECORD MUST NOT SAY IT IS ─────────────────────────
	//
	// ⛔ THE CATCH ARM USED TO ASSERT `NOT_OBSERVABLE` IN ITS OWN WORDS — *"nothing was in a position to observe
	// tool calls"* — WHICH WAS FALSE FOR THE PI ADAPTER. Its observer is SESSION-scoped, subscribed inside
	// `turn()` and unsubscribed in a `finally`, so when `prompt` rejects it already HOLDS the calls the model
	// made before the failure. ⚠ `R11` minted `NOT_OBSERVABLE` to mean *"nothing could look"*; using it for
	// *"the call failed"* collapses the two facts the discriminator exists to separate — in the direction that
	// hides the commands a model ran before it broke the run, which is when a reader most needs them.
	//
	// ⚠ THE FIXTURE IS SHAPED LIKE THE PI ADAPTER AND NOT LIKE A CONVENIENCE: it OBSERVES (so it answers
	// `canObserve: true`), it DECLARES its minted surface, and its `turn` throws AFTER a call has been seen.
	it('⭐⭐ a session that CAN observe reports what it saw when the turn THROWS', async () => {
		const { input, dispatched } = harness({
			session: {
				retainsHistory: true,
				dispose: () => undefined,
				// ⭑ THE MEASUREMENT WAS ALREADY TAKEN WHEN THE FAILURE ARRIVED — one call watched start and end,
				// on a surface this adapter minted and can name.
				// ⭐ PHASE 5 — this fake ran no commands, and for a fake that is a MEASUREMENT rather than
				// a refusal to answer: no `ProcessRunner` was ever handed to anything here.
				processRuns: () => ({ runs: [], observedCount: 0, recordedLimit: 32, writes: [] }),
				lastTurnObservation: () => ({
					canObserve: true as const,
					mintedToolNames: ['write_file', 'run_command'],
					calls: [{ name: 'run_command', outcome: 'COMPLETED' as const }]
				}),
				turn: async () => {
					throw new Error('the provider closed the stream mid-turn');
				}
			}
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(false);

		const rec = dispatched.at(-1)!;
		// ⛔ THE ASSERTION THIS TEST EXISTS FOR. `NOT_OBSERVABLE` here is the lost measurement.
		expect(rec.observedToolCalls.observation, 'the adapter HAD the calls').toBe('OBSERVED');
		expect(rec.observedToolCalls.observedCount).toBe(1);
		expect(rec.observedToolCalls.calls?.[0]?.toolName).toBe('run_command');
		expect(
			rec.observedToolCalls.calls?.[0]?.nameProvenance,
			'the adapter declared it minted this tool, so the record may hold the spelling'
		).toBe('MINTED_BY_HOST');
		// ⚠ AND THE FAILURE IS STILL RECORDED AS A FAILURE. The two facts are orthogonal, and a fix that made
		// the step look successful in order to keep the observation would be a worse record than the one it replaced.
		expect(rec.workProductDerivation.relation).toBe('EXPECTED_BUT_UNRETAINED');
		expect(rec.parseOutcome.detail).toContain('closed the stream mid-turn');
	});

	it('⭐ an observing session that saw NOTHING records NONE_OBSERVED — a measurement, not silence', async () => {
		// ⛔ THE CASE THAT SEPARATES THE TWO MEMBERS. A turn that failed before the model called anything is a
		// MEASUREMENT a reader may rely on — *the surface existed and nothing was called* — and it is the fact
		// `NOT_OBSERVABLE` would have destroyed. THE MUTANT: hand the caller a blanket `canObserve: false`;
		// this case and the one above collapse into the same record and neither can be told from silence.
		const { input, dispatched } = harness({
			session: {
				retainsHistory: true,
				dispose: () => undefined,
				// ⭐ PHASE 5 — this fake ran no commands, and for a fake that is a MEASUREMENT rather than
				// a refusal to answer: no `ProcessRunner` was ever handed to anything here.
				processRuns: () => ({ runs: [], observedCount: 0, recordedLimit: 32, writes: [] }),
				lastTurnObservation: () => ({
					canObserve: true as const,
					mintedToolNames: ['write_file'],
					calls: []
				}),
				turn: async () => {
					throw new Error('the provider refused the request');
				}
			}
		});
		expect((await runModelInvocationStep(input)).ran).toBe(false);
		const rec = dispatched.at(-1)!;
		expect(rec.observedToolCalls.observation).toBe('NONE_OBSERVED');
		expect(rec.observedToolCalls.reason, 'and it names the surface there was to call').toContain(
			'write_file'
		);
	});

	it('⭑ CONTROL — a ONE-SHOT session still records NOT_OBSERVABLE, in ITS OWN words', async () => {
		// ⭐ THE CONTROL THAT KEEPS THE FIX FROM BEING "CALL EVERYTHING OBSERVED". `agy --print` and the
		// deterministic fixture genuinely have no session, no tool surface and no subscriber, so the honest
		// answer for them is unchanged — and the REASON now comes from the adapter that knows why, rather than
		// from one sentence the caller wrote on every adapter's behalf. That sentence is what was false.
		const { input, dispatched } = harness({
			session: oneShotSession(async () => {
				throw new Error('the backing tool exited 1');
			})
		});
		expect((await runModelInvocationStep(input)).ran).toBe(false);
		const rec = dispatched.at(-1)!;
		expect(rec.observedToolCalls.observation).toBe('NOT_OBSERVABLE');
		expect(rec.observedToolCalls.reason, 'and the reason is about being ONE-SHOT').toMatch(
			/ONE-SHOT call with no held session/
		);
		expect(
			rec.observedToolCalls.calls,
			'an adapter that cannot see must not describe what it did not see'
		).toBeUndefined();
	});

	it('⭑ CONTROL — the REVIEWER still receives no reasoning, so the fix is not "record everything, leak everything"', async () => {
		// Without this, passing the whole blob straight through as the answer would satisfy the test above while
		// manufacturing the ASR-13 violation TS-05 exists to prevent. The two must hold together.
		const REASONING = 'First I considered the southern leg, then rejected it.';
		const ENVELOPE = `{"workProduct":"${ANSWER}","rationale":"Both legs were weighed."}`;
		const { input, store } = harness({
			session: oneShotSession(async () => ({
				answer: { arrived: true, text: ENVELOPE },
				volunteeredReasoning: REASONING,
				rawOutput: REASONING + ENVELOPE,
				producer: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
				identityEvidence: 'PROVIDER_REPORTED' as const,
				observedToolCalls: UNOBSERVED
			}))
		});
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		expect(out.answer).toBe(ANSWER);
		expect(out.answer).not.toContain(REASONING);
		const stored = await store.get(out.storageKey);
		expect(stored, 'the retained work product IS the answer').toContain(ANSWER);
		expect(stored, 'and carries none of the interior').not.toContain(REASONING);
	});
});
