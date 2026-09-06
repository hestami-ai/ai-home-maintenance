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

const SUBJECT = {
	id: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X01',
	title: 'Route Assessment',
	purpose: 'Decide whether the route is viable',
	expectedOutputs: ['a viability finding']
};

const ACTIVE: PromptTemplate = {
	templateText: 'Assess {subject}. Deliver {expectedOutputs}.',
	templateVersion: 4,
	declaredPlaceholders: ['subject', 'expectedOutputs'],
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
		expect(seen).toBe('Assess Route Assessment. Deliver a viability finding.');

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
		expect(dispatched[0]!.disposition).toBe('REJECTED');
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
				answerText: ANSWER,
				rawOutput: ANSWER,
				producer: {
					agentId: 'execution.model-invocation',
					modelId: 'gpt-5.4-mini',
					providerId: 'openai-codex'
				},
				identityEvidence: 'PROVIDER_REPORTED' as const
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
				answerText: ANSWER,
				volunteeredReasoning: REASONING,
				rawOutput: REASONING + ANSWER,
				producer: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
				identityEvidence: 'PROVIDER_REPORTED' as const
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
				answerText: ANSWER,
				rawOutput: ANSWER,
				producer: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
				identityEvidence: 'PROVIDER_REPORTED' as const
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
