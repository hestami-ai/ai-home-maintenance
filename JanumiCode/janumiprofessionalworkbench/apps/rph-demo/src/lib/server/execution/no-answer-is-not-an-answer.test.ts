// JAN-NOANS — a turn that yielded NOTHING is not a turn that answered BADLY (`REG-F-410`).
//
// ⛔ MEASURED, NOT IMAGINED. A live run was configured with a model the provider refuses outright — *"Codex
// error: The 'gpt-5.4-mini' model is not supported when using Codex with a ChatGPT account"*. No model ran.
// What the record said instead, on all three exchanges: `disposition: ACCEPTED`, `parseOutcome:
// SCHEMA_COERCION_FAILED` — *"The answer is not a JSON object"* — and a work product whose content hash is
// `sha256:e3b0c442…`, the hash of the EMPTY STRING. Three artifacts were recorded at `byteSize: 0` and nine
// assurance assessments ran over them; a live reviewer then returned nine findings at CRITICAL against an
// artifact that never existed.
//
// ⭐ EVERY LAYER BEHAVED CORRECTLY AND THE COMPOSITION LIED. The adapter accumulated `text_delta` only, so its
// answer stayed `''`; `session.prompt` resolved without throwing, so the turn looked successful;
// `splitExecutionEnvelope('')` could not parse it and reported — correctly, by its own contract — a PRODUCER
// shortfall, because a producer shortfall is the only thing it is able to report.
//
// ⭑ THE ASSURANCE PLANE ALREADY ASKS THE QUESTION THIS SUITE IS ABOUT, and says why:
// *"an empty response is an INFRASTRUCTURE OR BUDGET problem, prose is a PROMPT problem, and well-formed JSON
// of the wrong shape is a CONTRACT problem. Collapsing them loses the only thing the record was kept for."*
// (`reasoning-review-validator.ts`, `classifyParse`). The EXECUTION plane never asks it.
import { describe, expect, it } from 'vitest';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import type { PromptTemplate, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { runModelInvocationStep } from './run-model-step.js';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from '@janumipwb/rph-application';
import { oneShotSession } from './producer-session.js';

/** ⚠ The honest fixture default: a stand-in that returns an answer mints no tool surface and watches nothing. */
const UNOBSERVED = {
	canObserve: false as const,
	reason: 'Fixture: this stand-in returns an answer and observes nothing.'
};

const SUBJECT = {
	id: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X01',
	title: 'Route Assessment',
	// ⛔ NO `expectedOutputs` (`JAN-ASSERTED` `R29`). The old value — `['a viability finding']` — was a
	// PWU **the store rejects at write**: `OutputDefinitionSchema` is `z.record(...)`, so a string array
	// is `VALIDATION_FAILED` and nothing persists. Every assertion made over it was an assertion about
	// an object that cannot exist (`REG-F-411`).
	purpose: 'Decide whether the route is viable'
};

// ⛔ NO CAST. The first draft of this fixture invented a template shape and wrote `as unknown as
// PromptTemplate` over the mismatch — which is `REG-F-411`'s defect (an unchecked assertion switching off the
// gate that would have caught it) committed in the suite filed next to it. `check-types` now has to agree.
const ACTIVE: PromptTemplate = {
	templateText: 'Assess {subject}. Deliver {purpose}.',
	templateVersion: 4,
	declaredPlaceholders: ['subject', 'purpose'],
	status: 'ACTIVE'
};

/** ⭑ The sha256 of zero bytes. Named, because the whole finding is that this value reached a work product. */
const EMPTY_SHA256 = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function harness(over: Partial<Parameters<typeof runModelInvocationStep>[0]> = {}) {
	const dispatched: RecordModelExchangePayload[] = [];
	let n = 0;
	const store = createInMemoryArtifactStore();
	const input = {
		subject: SUBJECT,
		subjectSemanticVersion: 1,
		pwuTypeId: 'pwut_9',
		template: ACTIVE,
		session: oneShotSession(async () => ''),
		store,
		tenantPrefix: 'tnt-test',
		dispatchExchange: (payload: RecordModelExchangePayload) => {
			dispatched.push(payload);
			return { status: 'ACCEPTED' };
		},
		newId: (prefix: string) => `${prefix}_${++n}`,
		now: () => '2026-09-20T10:00:00Z',
		modelId: 'test-model',
		providerId: 'test-provider',
		contextPolicy: DEFAULT_CONTEXT_ASSEMBLY_POLICY,
		binding: { kind: 'NONE' as const },
		...over
	};
	return { input, dispatched, store };
}

describe('JAN-NOANS — a turn that yielded nothing is not a turn that answered badly', () => {
	it('⛔ a turn that returns NO BYTES is not recorded as an ACCEPTED try', async () => {
		// THE MUTANT: restore the hardcoded `disposition: 'accepted'` on the success path. The record then says
		// the try was accepted, which is what it said on all three live exchanges.
		const { input, dispatched } = harness();
		await runModelInvocationStep(input);

		expect(dispatched, 'the try left no record at all').toHaveLength(1);
		expect(
			dispatched[0]!.disposition,
			'a turn that produced nothing was accepted — REG-F-410, verbatim'
		).not.toBe('ACCEPTED');
	});

	it('⛔ and it does not blame the PRODUCER for a contract it was never given a chance to honour', async () => {
		// THE MUTANT: keep delegating E-5 to `describeWorkProductDerivation(envelope)`. That function is handed
		// only the PARSED ENVELOPE, never the raw string, so it is structurally incapable of asking whether any
		// bytes arrived — it can answer only PARSED or SCHEMA_COERCION_FAILED, and `splitExecutionEnvelope('')`
		// forces the second.
		const { input, dispatched } = harness();
		await runModelInvocationStep(input);

		const outcome = dispatched[0]!.parseOutcome.outcome;
		expect(
			outcome,
			'SCHEMA_COERCION_FAILED asserts the producer answered and answered badly; it did not answer'
		).not.toBe('SCHEMA_COERCION_FAILED');
		expect(outcome, 'the vocabulary has carried this member all along').toBe('EMPTY_RESPONSE');
	});

	it('⛔ and NO work product is derived from bytes that never arrived', async () => {
		// THE MUTANT: keep deriving `workProductDerivation` unconditionally. The live record then addressed
		// `sha256:e3b0c442…` — the empty string — as the bytes every downstream assessment rested on.
		const { input, dispatched } = harness();
		await runModelInvocationStep(input);

		const derivation = dispatched[0]!.workProductDerivation;
		if (derivation !== undefined)
			expect(
				derivation.contentHash,
				'the empty string was addressed as a professional work product'
			).not.toBe(EMPTY_SHA256);
	});

	it('⛔ the step REFUSES rather than reporting a run that produced nothing', async () => {
		// THE MUTANT: return `ran: true` anyway. Everything downstream — the artifact, the floor, the reviewer —
		// keys on this, and the live run proved each one proceeds.
		const { input } = harness();
		const out = await runModelInvocationStep(input);
		expect(out.ran, 'a step with no answer reported that it ran').toBe(false);
	});

	it('⚠ a tool that REPORTS a refusal has its own words recorded, not a gloss written from them', async () => {
		// ⭐ THE DISTINCTION THIS WHOLE SUITE TURNS ON. "The model returned no bytes" is FALSE when no model was
		// ever invoked — that is REG-F-410's class one level down, inside the record meant to fix it. The
		// provider's sentence is the only thing that tells a reader which of the two happened.
		//
		// THE MUTANT: collapse the refusal arm into the silent-turn arm. The record is then honest about the
		// absence and silent about its cause, and a reader still has to reproduce the run at a CLI to learn it.
		const REFUSAL = "The 'gpt-5.4-mini' model is not supported when using Codex with a ChatGPT account.";
		const { input, dispatched } = harness({
			session: oneShotSession(async () => ({
				answer: {
					arrived: false as const,
					cause: 'CALL_FAILED' as const,
					reportedBy: 'PROVIDER' as const,
					message: REFUSAL
				},
				rawOutput: '',
				producer: {
					agentId: 'execution.model-invocation',
					modelId: 'gpt-5.4-mini',
					providerId: 'openai-codex'
				},
				identityEvidence: 'PROVIDER_REPORTED' as const,
				observedToolCalls: UNOBSERVED
			}))
		});
		await runModelInvocationStep(input);

		expect(dispatched[0]!.parseOutcome.detail, 'the provider’s own sentence is not in the record').toContain(
			REFUSAL
		);
	});

	it('⭐ CONTROL — a real answer is still accepted, parsed, and derived exactly as before', async () => {
		// ⛔ WITHOUT THIS THE SUITE WOULD PASS FOR A STEP THAT REFUSED EVERYTHING. A guard that reddens on real
		// work is worse than the defect it replaces; the live lane on `gpt-6-astra` is this control at scale.
		const ENVELOPE = JSON.stringify({
			workProduct: { finding: 'The route is viable.' },
			rationale: {
				rationale: 'The instruction asked for a finding and the work product states one.',
				assumptions: [],
				limitations: [],
				residualUncertainty: []
			}
		});
		const { input, dispatched } = harness({ session: oneShotSession(async () => ENVELOPE) });
		const out = await runModelInvocationStep(input);

		expect(out.ran, 'the control refused a real answer').toBe(true);
		expect(dispatched[0]!.disposition).toBe('ACCEPTED');
		expect(dispatched[0]!.parseOutcome.outcome).toBe('PARSED');
		expect(dispatched[0]!.workProductDerivation?.contentHash).not.toBe(EMPTY_SHA256);
	});
});
