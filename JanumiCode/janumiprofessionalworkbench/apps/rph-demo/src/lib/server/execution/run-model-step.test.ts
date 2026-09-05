// JAN-EXECRUN XR-02 — the first model call ever made on behalf of an execution step.
//
// ⭑ THE EXECUTION PLANE HAS EXISTED SINCE `REG-D-055` AND NOTHING HAS EVER WRITTEN TO IT. `plane` is a
// generated enum with an `EXECUTION` member; every record in the system carries `ASSURANCE` or `AUTHORING`.
// This suite is the first thing that puts a record on it.
import { describe, expect, it } from 'vitest';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import type { PromptTemplate, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { runModelInvocationStep } from './run-model-step.js';

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
		print: async (_p: string) => ANSWER,
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
		...over
	};
	return { input, dispatched, store };
}

describe('JAN-EXECRUN — a work unit actually runs', () => {
	it('⭑ calls the model with the RENDERED prompt and records it on the EXECUTION plane', async () => {
		let seen = '';
		const { input, dispatched } = harness({
			print: async (p: string) => {
				seen = p;
				return ANSWER;
			}
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
		expect(dispatched[0]!.subjectObjectId, 'the record names the work unit it ran for').toBe(SUBJECT.id);
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
		const { input, dispatched, store } = harness({ print: async () => DELIMITED });
		const out = await runModelInvocationStep(input);
		expect(out.ran).toBe(true);
		if (!out.ran) return;

		expect(await store.get(out.storageKey), 'the answer is not retained where it says').toBe(DELIMITED);
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
			print: async () => {
				throw new Error('provider unreachable');
			}
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
			print: async () => ({
				answerText: ANSWER,
				rawOutput: ANSWER,
				producer: {
					agentId: 'execution.model-invocation',
					modelId: 'gpt-5.4-mini',
					providerId: 'openai-codex'
				},
				identityEvidence: 'PROVIDER_REPORTED' as const
			})
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
		expect(rec.resolvedModel).toMatchObject({ value: 'gpt-5.4-mini', evidence: 'PROVIDER_REPORTED' });
		expect(rec.resolvedProvider).toMatchObject({ value: 'openai-codex', evidence: 'PROVIDER_REPORTED' });
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
