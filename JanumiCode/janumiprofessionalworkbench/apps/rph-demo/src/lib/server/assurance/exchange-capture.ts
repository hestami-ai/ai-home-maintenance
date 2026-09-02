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
import type { ArtifactStore, StoredArtifactRef } from '@janumipwb/rph-ports';
import {
	beginExchange,
	type ExchangeDisposition,
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
}

function storedRef(ref: StoredArtifactRef) {
	return {
		status: 'STORED' as const,
		storageKey: ref.storageKey,
		purgeability: 'RETAINED_BY_PARTICIPATION' as const
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
		model: input.model
	});

	if (!input.store) {
		const pending = { ...base, disposition: input.disposition };
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
	// That second trigger is UNCONDITIONAL and fires here whether or not reasoning ever arrives: `Purgeability`
	// is ONE value per `put()`, so the contract cannot express a blob that is partly PURGEABLE_AT_EXPIRY
	// (reasoning, PER-12) and partly RETAINED_BY_PARTICIPATION (the answer, PER-8). Storing it whole under
	// either class is wrong in one direction or the other.
	//
	// ⚠ AND THE REGISTER FORBADE THIS BY NAME BEFORE IT WAS WRITTEN. REG-Q-066 is OPEN and reserved to the
	// sponsor — "item 23's `rawOutput` field was drafted, defended as 'retained whole', and withdrawn. Do not
	// write the field before the ruling." A first version of this module wrote it anyway (REG-F-330).
	//
	// E-1 is NOT affected: the judge prompt is composed by JPWB from its own scaffolding and the graph export,
	// so it is not a reasoning trace — which is exactly the warrant REG-D-050 states for it, and exactly the
	// property never established for E-2.
	const inputRef = await put(input.prompt);

	const recorded: ExchangeRecord = {
		...base,
		materializedInputRef: storedRef(inputRef),
		rawOutputBeforeCoercionRef: {
			status: 'PENDING_CONTENT_PLANE',
			reason:
				'E-2 BLOCKED-AND-DISCLOSED per Guide §9.7: the pre-coercion output may carry volunteered reasoning ' +
				'inline with the answer, and Purgeability admits ONE class per stored object — so the contract ' +
				'cannot represent a partly-purgeable blob losslessly. REG-Q-066 (OPEN, sponsor-reserved) forbids ' +
				'writing this field before its ruling. Unblocking requires lossless span separation into two ' +
				'artifacts (answer RETAINED_BY_PARTICIPATION, reasoning PURGEABLE_AT_EXPIRY) or that ruling.'
		},
		disposition: input.disposition
	};
	input.sink?.record(recorded);
	return recorded;
}
