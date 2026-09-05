// JAN-EXECRUN XR-02 — the caller. A model is invoked ON BEHALF OF AN EXECUTION STEP, for the first time.
//
// ⭑ WHAT WAS MISSING WAS ONLY THIS. `StepTypeSchema`'s first member is `MODEL_INVOCATION`; Guide `:1137`
// defines a step AS a model/tool invocation; `MODEL_EXCHANGE` records one durably, verifiably and readably
// (`REG-D-055`/`056`/`057`, `JAN-MXREAD`); a work-unit type now owns the prompt (`REG-D-058`). Every part
// existed except something that put them together — 37 mentions of `stepType` in shipped code and exactly two
// that branch on it, neither running anything.
//
// ⛔ AND THE EXECUTOR IS THE MODEL, NOT THE OPERATOR. The demo's existing lifecycle step records the human who
// clicked, and says so deliberately — it is a `TRANSFORMATION` a human drove. This path is different in kind:
// recording a human for work a model did would be a fiction, and the assurance floor is entitled to know
// which it was. That the floor may then BLOCK is the system working.
import {
	prepareModelInvocation,
	type InvocationSubject
} from '@janumipwb/rph-application';
import type { PromptTemplate, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { captureTry, createExchangeSink } from '../assurance/exchange-capture.js';
import { recordExchanges } from '../assurance/exchange-recorder.js';

export interface RunModelStepInput {
	readonly subject: InvocationSubject;
	readonly subjectSemanticVersion: number;
	readonly pwuTypeId: string;
	readonly template: PromptTemplate | undefined;
	/** The model seam. Injected so the gate never spawns a subprocess and a live run is configuration. */
	readonly print: (prompt: string) => Promise<string>;
	readonly store: ArtifactStore;
	readonly tenantPrefix: string;
	readonly dispatchExchange: (
		payload: RecordModelExchangePayload,
		aggregateId: string
	) => { status: string };
	readonly newId: (prefix: string) => string;
	readonly now: () => string;
	readonly modelId: string;
	readonly providerId: string;
}

export type RunModelStepOutcome =
	| {
			readonly ran: true;
			readonly answer: string;
			readonly fingerprint: string;
			/** Where the answer is retained. The exchange record already names these exact bytes. */
			readonly storageKey: string;
			readonly contentHash: string;
			readonly byteSize: number;
			readonly exchangesRecorded: number;
	  }
	| { readonly ran: false; readonly refusedBecause: string };

/**
 * Run one `MODEL_INVOCATION` step.
 *
 * ⭑ THE ANSWER IS STORED ONCE AND NAMED TWICE, and that is content-addressing paying for itself rather than a
 * shortcut. The exchange record retains the answer because `PER-9` requires the returned output kept per try;
 * an `ARTIFACT` names it because that is what a downstream step or an assurance policy consumes. Both point at
 * the same key, because the store keys on tenant + retention class + content hash — so the same bytes under
 * the same class ARE the same stored object. Writing them twice would produce two keys for one answer and a
 * reader could not tell which the assessment rested on.
 */
export async function runModelInvocationStep(
	input: RunModelStepInput
): Promise<RunModelStepOutcome> {
	const plan = prepareModelInvocation(input.subject, input.pwuTypeId, input.template);
	if (!plan.ready) return { ran: false, refusedBecause: plan.reason };

	const sink = createExchangeSink();
	const requestedAt = input.now();
	let answer: string;
	try {
		answer = await input.print(plan.prompt);
	} catch (e) {
		// ⚠ A FAILED CALL IS STILL A TRY THAT HAPPENED. `PER-9` wants the record; recording nothing here would
		// make the one call that broke the run the one call with no evidence, which is the defect inverted.
		const respondedAt = input.now();
		await captureTry({
			store: input.store,
			sink,
			tenantPrefix: input.tenantPrefix,
			exchangeId: input.newId('exch'),
			role: 'initial',
			model: { modelId: input.modelId, providerId: input.providerId },
			prompt: plan.prompt,
			rawOutput: '',
			disposition: 'rejected',
			attemptOrdinal: 1,
			requestedAt,
			respondedAt,
			parseOutcome: {
				outcome: 'NOT_ATTEMPTED',
				detail: `The model call itself failed: ${e instanceof Error ? e.message : String(e)}`
			},
			promptTemplateFingerprint: plan.fingerprint
		});
		record(input, sink);
		return {
			ran: false,
			refusedBecause: `The model call failed: ${e instanceof Error ? e.message : String(e)}`
		};
	}

	const respondedAt = input.now();
	await captureTry({
		store: input.store,
		sink,
		tenantPrefix: input.tenantPrefix,
		exchangeId: input.newId('exch'),
		role: 'initial',
		model: { modelId: input.modelId, providerId: input.providerId },
		prompt: plan.prompt,
		rawOutput: answer,
		disposition: 'accepted',
		attemptOrdinal: 1,
		requestedAt,
		respondedAt,
		// An execution step's answer is the WORK PRODUCT, not a structured judgement, so there is no schema to
		// coerce it against and nothing was attempted. Saying PARSED would assert an outcome nobody observed.
		parseOutcome: {
			outcome: 'NOT_ATTEMPTED',
			detail: 'An execution step answer is a work product; no schema coercion applies.'
		},
		promptTemplateFingerprint: plan.fingerprint
	});

	const exchangesRecorded = record(input, sink);

	// The same bytes, the same class — therefore the same key the exchange record already names.
	const stored = await input.store.put({
		tenantPrefix: input.tenantPrefix,
		bytes: answer,
		mediaType: 'text/plain',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});

	return {
		ran: true,
		answer,
		fingerprint: plan.fingerprint,
		storageKey: stored.storageKey,
		contentHash: stored.contentHash,
		byteSize: stored.byteSize,
		exchangesRecorded
	};
}

function record(input: RunModelStepInput, sink: ReturnType<typeof createExchangeSink>): number {
	const outcome = recordExchanges(input.dispatchExchange, sink.drain(), {
		runToken: input.newId('execrun'),
		// ⭑ THE EXECUTION PLANE, WHICH THIS ENUM HAS CARRIED SINCE REG-D-055 AND NOTHING HAS EVER WRITTEN.
		plane: 'EXECUTION',
		invokerId: `execution.model-invocation:${input.pwuTypeId}`,
		subjectObjectId: input.subject.id,
		subjectObjectType: 'PROFESSIONAL_WORK_UNIT',
		subjectSemanticVersion: input.subjectSemanticVersion,
		newId: input.newId
	});
	return outcome.recorded;
}
