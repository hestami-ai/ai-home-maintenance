// ICP-01 — the composed prompt must be OBTAINABLE before it can be recorded (PER-9 E-1).
//
// PER-9 requires "the exact materialized input presented to the model". Before this module the demo could not
// produce it at all: `pi-agent.ts` hands Pi a `systemPromptOverride` plus an `instruction`, and Pi's
// `DefaultResourceLoader` composes the rest inside the SDK. JPWB never held the composite it sent — so E-1 was
// UNAVAILABLE, not merely unrecorded, and no amount of persistence work could have reached it.
//
// The seam is Pi's own documented hook, `onPayload`: "Optional callback for inspecting or replacing provider
// payloads before sending. Return undefined to keep the payload unchanged." It fires once per provider request,
// which is exactly PER-9's unit — "each retry, reformat, and repair request included".
import { describe, expect, it } from 'vitest';
import { createMaterializedInputRecorder, type PayloadHookHost } from './materialized-input.js';

/** A stand-in for Pi's `Agent` carrying only the property this module touches. */
function fakeAgent(): PayloadHookHost {
	return {};
}

const MODEL = { id: 'gemini-2.5-pro', provider: 'google' };

/** The AUTHORED template — what `pi-agent.ts` hands Pi. Deliberately NOT what the provider receives. */
const AUTHORED_TEMPLATE = 'You are a JPWB authoring expert. {{tools}}';

/** What the provider actually receives after Pi composes: template + resources + history + tool schemas. */
const COMPOSED_PAYLOAD = {
	system: 'You are a JPWB authoring expert. read_pwa, propose_pwu',
	messages: [{ role: 'user', content: 'Add an architecture PWU' }],
	tools: [{ name: 'read_pwa' }]
};

describe('ICP-01 · materialized-input recorder — E-1 becomes obtainable', () => {
	it('captures the payload ACTUALLY PRESENTED, not the authored template', () => {
		const agent = fakeAgent();
		const rec = createMaterializedInputRecorder();
		rec.install(agent);

		agent.onPayload?.(COMPOSED_PAYLOAD, MODEL);

		expect(rec.captured()).toHaveLength(1);
		// THE MUTANT THIS ASSERTION EXISTS FOR: capture `AUTHORED_TEMPLATE` instead of the payload argument.
		// A pre-assembly capture is precisely the fingerprint PER-9 forbids substituting for the record
		// ("A prompt or template fingerprint identifies that record; it never substitutes for it").
		expect(rec.captured()[0].payload).toEqual(COMPOSED_PAYLOAD);
		expect(rec.captured()[0].payload).not.toEqual(AUTHORED_TEMPLATE);
	});

	it('returns undefined so the payload is sent UNCHANGED — it observes, it never replaces', () => {
		const agent = fakeAgent();
		createMaterializedInputRecorder().install(agent);

		// Pi's contract: "Return undefined to keep the payload unchanged." A recorder that returned the
		// payload would be exercising the REPLACE half of a hook it only means to observe.
		expect(agent.onPayload?.(COMPOSED_PAYLOAD, MODEL)).toBeUndefined();
	});

	it('records ONE entry per provider request — a repair turn yields TWO (PER-9-a)', () => {
		const agent = fakeAgent();
		const rec = createMaterializedInputRecorder();
		rec.install(agent);

		agent.onPayload?.(COMPOSED_PAYLOAD, MODEL);
		agent.onPayload?.({ ...COMPOSED_PAYLOAD, repair: true }, MODEL);

		// PER-9: "Every bounded model or agent try — each retry, reformat, and repair request included — is its
		// own durable exchange record." One record per turn would collapse the repair into the original.
		expect(rec.captured()).toHaveLength(2);
		expect(rec.captured()[1].payload).toMatchObject({ repair: true });
	});

	it('records the RESOLVED model and provider alongside the input (E-3)', () => {
		const agent = fakeAgent();
		const rec = createMaterializedInputRecorder();
		rec.install(agent);

		agent.onPayload?.(COMPOSED_PAYLOAD, MODEL);

		expect(rec.captured()[0].modelId).toBe('gemini-2.5-pro');
		expect(rec.captured()[0].providerId).toBe('google');
	});

	// The next two are split deliberately: dropping the prior hook and mis-recording its replacement are
	// DIFFERENT defects, and one test asserting both could not tell their mutants apart.

	it('CHAINS an existing hook — its replacement still reaches the provider', () => {
		const agent = fakeAgent();
		const replaced = { system: 'REPLACED BY A PRIOR HOOK' };
		agent.onPayload = () => replaced;

		const rec = createMaterializedInputRecorder();
		rec.install(agent);

		// Silently dropping a prior hook would change what the model is sent — a behaviour change smuggled in
		// by an observability feature.
		expect(agent.onPayload?.(COMPOSED_PAYLOAD, MODEL)).toBe(replaced);
	});

	it('records what was ACTUALLY SENT when a prior hook replaced it, not this hook’s own argument', () => {
		const agent = fakeAgent();
		const replaced = { system: 'REPLACED BY A PRIOR HOOK' };
		agent.onPayload = () => replaced;

		const rec = createMaterializedInputRecorder();
		rec.install(agent);
		agent.onPayload?.(COMPOSED_PAYLOAD, MODEL);

		// E-1 is what the MODEL received. Recording our own input here would be accurate about this module and
		// wrong about the exchange.
		expect(rec.captured()[0].payload).toBe(replaced);
	});
});
