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
import type { ArtifactStore, ContentDurability, StoredArtifactRef } from '@janumipwb/rph-ports';
import {
	beginExchange,
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

function storedRef(ref: StoredArtifactRef, durability: ContentDurability) {
	return {
		status: 'STORED' as const,
		storageKey: ref.storageKey,
		// The whole address, not just the key — see ContentRef. contentHash is what later proves the retained
		// bytes are the ones this try saw; without it the reference cannot be challenged.
		storageProvider: ref.storageProvider,
		contentHash: ref.contentHash,
		byteSize: ref.byteSize,
		purgeability: 'RETAINED_BY_PARTICIPATION' as const,
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

	const put = (bytes: string) =>
		input.store!.put({
			tenantPrefix: input.tenantPrefix,
			bytes,
			mediaType: 'text/plain',
			// REG-D-050. Never PURGEABLE_AT_EXPIRY: this is the basis of a recorded professional judgement.
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});

	// ⛔ E-2 IS BLOCKED, DELIBERATELY, AND ONLY E-1 IS STORED.
	//
	// The raw pre-coercion output is a MIXED object: a reason-then-answer model returns its derivation and its
	// answer in one blob, and a measured `agy --print` run did exactly that. Guide §9.7 (:1340): "where it
	// arrives inline with the answer, separate it at retention so that only the answer span binds under Section
	// 8.4. Where the spans cannot be separated losslessly, OR ACCEPTED CONTRACTS CANNOT REPRESENT THESE RECORDS
	// LOSSLESSLY, block the capability and resolve Section 16 item 23."
	//
	// ⚠ THIS COMMENT USED TO CLAIM THAT SECOND TRIGGER FIRES UNCONDITIONALLY, BECAUSE "`Purgeability` is ONE
	// value per `put()`, so the contract cannot express a blob that is partly PURGEABLE_AT_EXPIRY (reasoning,
	// PER-12) and partly RETAINED_BY_PARTICIPATION (the answer, PER-8)." ⛔ THAT WAS FALSE, and it was the
	// load-bearing sentence of a blocker filed in the register (corrected by REG-F-336). One STORED OBJECT
	// carries one class. NOTHING limits a capture to one stored object — canon says the opposite outright
	// (DOC-003:89, "One Representation may have several Artifacts"), and two `put()` calls under two classes
	// has since been DRIVEN against the shipped adapter. Whole-blob was the only case that ever failed.
	//
	// BOTH TECHNICAL PREREQUISITES NOW EXIST:
	//   • the lossless separation primitive — `splitAnswerSpan` (REG-F-339), whose `located` flag reports
	//     exactly when §9.7's FIRST trigger fires and when it does not, instead of assuming it always does;
	//   • an anchor for the reasoning half — REG-D-053 discharges PER-12's "producing Attempt" onto the plane's
	//     own governed-stream record, so no governed ARTIFACT is minted and "never projected" holds
	//     STRUCTURALLY rather than by a filter.
	//
	// ⛔ WHAT STILL BLOCKS E-2 IS PROCEDURAL, AND IT IS NOT MINE TO LIFT. REG-Q-066 is OPEN and reserved to the
	// sponsor — "item 23's `rawOutput` field was drafted, defended as 'retained whole', and withdrawn. Do not
	// write the field before the ruling." A first version of this module wrote it anyway (REG-F-330). ⭑ The
	// remedy is now one sentence from the sponsor rather than one more design pass — and this comment must not
	// go on implying a technical impossibility that no longer exists.
	//
	// E-1 is NOT affected: the judge prompt is composed by JPWB from its own scaffolding and the graph export,
	// so it is not a reasoning trace — which is exactly the warrant REG-D-050 states for it, and exactly the
	// property never established for E-2.
	const inputRef = await put(input.prompt);

	const recorded: ExchangeRecord = {
		...base,
		materializedInputRef: storedRef(inputRef, input.store.durability),
		rawOutputBeforeCoercionRef: {
			status: 'PENDING_CONTENT_PLANE',
			reason:
				'E-2 BLOCKED-AND-DISCLOSED. The pre-coercion output may carry volunteered reasoning inline with ' +
				'the answer, so it is stored only as two separated spans — answer RETAINED_BY_PARTICIPATION, ' +
				'reasoning PURGEABLE_AT_EXPIRY — never whole. The TECHNICAL prerequisites now exist: ' +
				'splitAnswerSpan separates them losslessly wherever they are separable (REG-F-339), and ' +
				'REG-D-053 discharges the reasoning half onto the plane governed-stream record. What remains ' +
				'is PROCEDURAL: REG-Q-066 is OPEN and sponsor-reserved and forbids writing this field before ' +
				'its ruling.'
		},
		disposition: input.disposition,
		parseOutcome: input.parseOutcome
	};
	input.sink?.record(recorded);
	return recorded;
}
