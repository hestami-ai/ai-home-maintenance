// ICP-02 deliverable 2b — turn a bounded model try into a PER-9 exchange record, with the content retained.
//
// ── WHAT THIS CLOSES ────────────────────────────────────────────────────────────────────────────────────────
// The Reasoning Review runs up to FOUR bounded tries per authoring turn: the floor runs twice (once, then the
// auto-refine pass), and each run can call the model twice (the original and its repair). Today that produces
// ZERO records — findings #24 (the materialized input is never recorded), #25 (the pre-coercion answer is
// destroyed by reassignment on the repair path) and #62 (the parse outcome is swallowed by a bare catch).
//
// ── WHY IT LIVES IN ITS OWN MODULE ──────────────────────────────────────────────────────────────────────────
// Same reason `transcript.ts` does: as an inline closure inside the Validator these boundaries would be
// reachable only by driving `agy`, so they would never be exercised in the gate and the regression that
// removed them would be silent.
//
// ── ⭑ THE RETENTION CLASSIFICATION, AND ITS WARRANT ─────────────────────────────────────────────────────────
// `REG-D-050` (sponsor, 2026-09-02): "The intention is for the governed stream to be fully auditable and
// reconstructable." So a materialized assurance input PARTICIPATES and is RETAINED_BY_PARTICIPATION — purging
// it would make a recorded Assessment's conclusion unreproducible, which is `PER-8`'s stated WHY: "deletion
// severs the trace spine retroactively; a record with holes cannot answer who decided what on what basis."
// ⚠ THE SENSITIVITY ANSWER IS REDACTION, NOT PURGE (`PER-9`: retention is "subject to recorded redaction";
// "record-plane omission is not [legal]"). Redaction preserves reconstructability because the manifest records
// what was removed; purge does not. That is why these two are not interchangeable, and why nothing here is
// marked purgeable — only volunteered reasoning is, and `PER-8`'s NON-EXAMPLE names it by name.
import type {
	ArtifactStore,
	ContentDurability,
	Purgeability,
	StoredArtifactRef
} from '@janumipwb/rph-ports';
import { splitAnswerSpan } from './agy-cli.js';
import {
	beginExchange,
	type ContentRef,
	type ExchangeDisposition,
	type ExchangeParseOutcome,
	type ExchangeRecord,
	type ExchangeRole,
	type ModelInput
} from '../agent/exchange-record.js';

/**
 * Collects the exchange records a run produces.
 *
 * ⚠ A SINK RATHER THAN A RETURN VALUE, AND NOT BY PREFERENCE. `ValidatorResult` is a `z.strictObject` and the
 * dispatch boundary REJECTS an unrecognized key — driven: a 17th field on `ValidatorResult`, an added key on
 * `CompleteAssuranceAssessment`, and one on `ExecutionProvenance` were each refused with `unrecognized_keys`
 * (`REG-F-327`). So the Validator cannot widen what it returns. This follows the shape `RationaleSink` already
 * established for exactly this problem.
 */
export interface ExchangeSink {
	record(exchange: ExchangeRecord): void;
	/** Everything recorded this run, in dispatch order — one entry per bounded try. */
	drain(): readonly ExchangeRecord[];
}

export function createExchangeSink(): ExchangeSink {
	const exchanges: ExchangeRecord[] = [];
	return {
		record: (e) => {
			exchanges.push(e);
		},
		drain: () => exchanges
	};
}

export interface CaptureTryInput {
	/** Absent in the assurance path until the host supplies one; capture then degrades to today's behaviour. */
	readonly store?: ArtifactStore;
	readonly sink?: ExchangeSink;
	readonly tenantPrefix: string;
	readonly exchangeId: string;
	readonly role: ExchangeRole;
	readonly predecessor?: ExchangeRecord;
	readonly model: ModelInput;
	/** E-1 — the exact bytes presented to the model. */
	readonly prompt: string;
	/** E-2 — the returned answer BEFORE any coercion or repair. */
	readonly rawOutput: string;
	/** E-5 — what became of it. */
	readonly disposition: ExchangeDisposition;
	/** 1-based position within the run. */
	readonly attemptOrdinal: number;
	/** PER-11 occurrence times, bracketing the model call. Only this caller can know them: the event's own
	 *  stamps are taken at the DRAIN, up to two round-trips later. */
	readonly requestedAt: string;
	readonly respondedAt: string;
	/** E-5's detail — what became of the bytes between the model and the judgement. */
	readonly parseOutcome: ExchangeParseOutcome;
}

/** A disclosed absence, which PER-9 permits — as distinct from the silent one it forbids. */
function pendingRef(reason: string): ContentRef {
	return { status: 'PENDING_CONTENT_PLANE', reason };
}

function storedRef(
	ref: StoredArtifactRef,
	durability: ContentDurability,
	purgeability: Purgeability
): ContentRef {
	return {
		status: 'STORED' as const,
		purgeability,
		storageKey: ref.storageKey,
		// The whole address, not just the key — see ContentRef. contentHash is what later proves the retained
		// bytes are the ones this try saw; without it the reference cannot be challenged.
		storageProvider: ref.storageProvider,
		contentHash: ref.contentHash,
		byteSize: ref.byteSize,
		// Taken from the store that actually holds the bytes, never assumed. A durable record naming
		// process-local content is lawful only if it SAYS SO — otherwise the reference survives the bytes
		// and nothing on the record reveals it.
		contentDurability: durability
	};
}

/**
 * Record one bounded try.
 *
 * ⚠ OPTIONAL WIRING, DELIBERATELY. The Validator is constructed fresh on every floor run with an empty options
 * object, so a HARD dependency on a store would break the assurance path outright rather than degrade. With no
 * store the record is still produced and still counted — the refs simply stay `PENDING_CONTENT_PLANE`, which is
 * the disclosed absence `PER-9` permits rather than the silent one it forbids.
 *
 * ⭑ EACH TRY STORES ITS OWN BYTES. The content store is content-addressed, so two tries with different bytes
 * get different keys and a repair CANNOT overwrite its predecessor — which is finding #25 (`raw = await
 * print(...)`) made structurally impossible rather than merely discouraged. CSAA-007 states the rule this
 * enforces: "Repair never rewrites predecessor raw output."
 */
export async function captureTry(input: CaptureTryInput): Promise<ExchangeRecord> {
	const base = beginExchange({
		exchangeId: input.exchangeId,
		role: input.role,
		...(input.predecessor ? { predecessor: input.predecessor } : {}),
		model: input.model,
		attemptOrdinal: input.attemptOrdinal,
		requestedAt: input.requestedAt,
		respondedAt: input.respondedAt
	});

	// ⛔ A STORE WITHOUT A SINK IS A MISCONFIGURATION, NOT A DEGRADED MODE — REFUSE IT.
	//
	// `artifacts` and `exchanges` are INDEPENDENTLY OPTIONAL on `AgyValidatorOptions`, and everything below
	// runs `put()` unconditionally while handing the record to `input.sink?.record(...)` — optional-chained,
	// so with no sink the record is silently dropped. ⚠ ONE added property at the composition root would
	// therefore retain bytes that NO record references: exactly what `REG-F-336` C-2 forbids — *"content on
	// the content plane with no record on the record plane pointing at it… a half-wire is worse than the
	// disclosed absence it replaces."*
	//
	// ⭑ IT REFUSES RATHER THAN DEGRADING BECAUSE THIS CANNOT HAPPEN AT RUNTIME. It is reachable only by
	// wiring the host wrong, so the failure belongs at the moment of misconfiguration, loudly, and not as a
	// quiet orphan discovered later by someone auditing retention. The NEITHER case below is a different
	// thing entirely and stays legal: it is the DISCLOSED absence `PER-9` permits.
	if (input.store && !input.sink)
		throw new Error(
			'captureTry: a store was supplied with no sink. The bytes would be retained on the content plane ' +
				'with no exchange record on the record plane referencing them — an orphan (REG-F-336 C-2). ' +
				'Supply both, or neither: with neither, capture degrades to the disclosed PENDING_CONTENT_PLANE ' +
				'absence, which PER-9 permits. Store, sink and record consumer land together or not at all.'
		);

	if (!input.store) {
		const pending = { ...base, disposition: input.disposition, parseOutcome: input.parseOutcome };
		input.sink?.record(pending);
		return pending;
	}

	// The class is per-span now, not per-call: REG-D-050 classified the input and the answer as participating
	// and volunteered reasoning as purgeable, and one stored object carries exactly one class.
	const put = (bytes: string, purgeability: Purgeability) =>
		input.store!.put({ tenantPrefix: input.tenantPrefix, bytes, mediaType: 'text/plain', purgeability });

	// ⭑ E-2 IS RETAINED, AND THE SHAPE IS THE COROLLARY RATHER THAN A CHOICE.
	//
	// `REG-D-056` (sponsor, 2026-09-03): *"Yes, save raw answer."* Guide §9.7 (:1340) dictates HOW: *"where it
	// arrives inline with the answer, separate it at retention so that only the answer span binds under
	// Section 8.4. Where the spans cannot be separated losslessly … block the capability."*
	//
	// The two halves carry OPPOSITE obligations — the answer participated in a recorded judgement and is
	// RETAINED_BY_PARTICIPATION (PER-8); volunteered reasoning "participates in nothing" and is
	// PURGEABLE_AT_EXPIRY (PER-12). Both were already classified by `REG-D-050`. One stored object carries one
	// class, so a mixed blob written whole is wrong in one direction or the other — which is precisely the
	// `rawOutput` field item 23 drafted, defended as "retained whole", and WITHDREW.
	//
	// ⚠ SO THE WHOLE BLOB IS STORED ONLY WHEN THERE IS NOTHING TO SEPARATE. When reasoning arrives inline the
	// spans carry it and the whole-blob ref says so — that is not a block, it is the §9.7 representation.
	const span = splitAnswerSpan(input.rawOutput);
	const volunteered = span.located ? span.prefix + span.suffix : '';

	let answerSpanRef: ContentRef;
	let volunteeredReasoningRef: ContentRef;
	let rawOutputRef: ContentRef;

	if (!span.located) {
		// ⛔ §9.7's OWN INSTRUCTION, and the only branch that still refuses. `located` is a MEASUREMENT
		// (REG-F-339), so this is entered on evidence about THIS blob rather than on a class of blob assumed
		// unsplittable — the over-broad claim REG-F-340 corrected.
		const blocked = pendingRef(
			'No answer span could be located, so the answer and any volunteered reasoning cannot be separated ' +
				'losslessly. Guide §9.7: block the capability and resolve Section 16 item 23. Retaining the blob ' +
				'whole would classify reasoning as participating (PER-8, permanent) or the answer as purgeable ' +
				'(PER-12) — wrong in one direction or the other.'
		);
		answerSpanRef = blocked;
		volunteeredReasoningRef = blocked;
		rawOutputRef = blocked;
	} else {
		answerSpanRef = storedRef(
			await put(span.answer, 'RETAINED_BY_PARTICIPATION'),
			input.store.durability,
			'RETAINED_BY_PARTICIPATION'
		);
		volunteeredReasoningRef = volunteered
			? storedRef(
					await put(volunteered, 'PURGEABLE_AT_EXPIRY'),
					input.store.durability,
					'PURGEABLE_AT_EXPIRY'
				)
			: pendingRef(
					'No volunteered reasoning arrived with this answer. PER-12: availability is provider- and ' +
						'configuration-dependent and there is no obligation to solicit or procure a trace — so this ' +
						'is an observed absence, not an unretained presence.'
				);
		rawOutputRef = volunteered
			? pendingRef(
					'Separated at retention per Guide §9.7: the answer span and the volunteered reasoning are ' +
						'retained as two objects under their own classes. The whole blob is not stored because one ' +
						'stored object carries one retention class and this one is mixed.'
				)
			: // Nothing to separate: the whole output IS the answer, so a single class fits it exactly.
				answerSpanRef;
	}

	const inputRef = await put(input.prompt, 'RETAINED_BY_PARTICIPATION');

	const recorded: ExchangeRecord = {
		...base,
		materializedInputRef: storedRef(inputRef, input.store.durability, 'RETAINED_BY_PARTICIPATION'),
		rawOutputBeforeCoercionRef: rawOutputRef,
		answerSpanRef,
		volunteeredReasoningRef,
		disposition: input.disposition,
		parseOutcome: input.parseOutcome
	};
	input.sink?.record(recorded);
	return recorded;
}
