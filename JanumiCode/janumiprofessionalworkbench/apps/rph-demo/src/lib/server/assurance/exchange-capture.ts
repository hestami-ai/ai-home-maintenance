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
import type { ObservedToolCallReport, WorkProductDerivation } from '@janumipwb/rph-contracts';
import { splitAnswerSpan } from './agy-cli.js';
import {
	beginExchange,
	type ContentRef,
	type OmittedRegion,
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
	/** PER-9's index, not its substitute: `<pwuTypeId>@v<n>` for a template-driven call. Absent for calls whose
	 *  prompt is assembled in code rather than from an authored template. */
	readonly promptTemplateFingerprint?: string;
	/** 1-based position within the run. */
	readonly attemptOrdinal: number;
	/** PER-11 occurrence times, bracketing the model call. Only this caller can know them: the event's own
	 *  stamps are taken at the DRAIN, up to two round-trips later. */
	readonly requestedAt: string;
	readonly respondedAt: string;
	/** E-5's detail — what became of the bytes between the model and the judgement. */
	readonly parseOutcome: ExchangeParseOutcome;
	/**
	 * ⭐ R11 — WHICH BYTES THE ASSESSMENT RESTS ON, and ⭐ WHAT THE ADAPTER OBSERVED THE MODEL DO.
	 *
	 * ⛔ BOTH REQUIRED, AND NEITHER DEFAULTED, WHICH IS THE SAME REFUSAL `store`/`sink` MAKE IMMEDIATELY ABOVE
	 * IN THE OTHER DIRECTION. Those two are optional TOGETHER because "neither was supplied" is a lawful,
	 * disclosed degradation. These two are required because there is no honest default: whether this try owed a
	 * work product is the CALLER's fact — an execution step owes one, a reviewer's call does not — and whether
	 * the adapter could see tool calls is a fact about the adapter the caller drove. Any value chosen here
	 * would assert one of those on somebody else's behalf, which is the fabrication `truncationState: 'unknown'`
	 * and `parseOutcome: NOT_ATTEMPTED` were introduced to avoid.
	 */
	readonly workProductDerivation: WorkProductDerivation;
	readonly observedToolCalls: ObservedToolCallReport;
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7 P7-6 I2 (`DESIGN-the-reviewer-isolated.md` §2; `REG-F-351`; `REG-D-103` (2)) — WHAT BECOMES OF A
	 * REPLY IN WHICH NO ANSWER SPAN CAN BE LOCATED, which only the caller can say.
	 *   · absent, or `BLOCKED` — Guide §9.7's own instruction, on every plane as before: nothing of it is stored. ⛔ THE
	 *     EXECUTION PLANE NEVER ASKS OTHERWISE (the design leaves it unchanged): there an unlocatable answer may be the work
	 *     product itself (`REG-F-351`), and retaining it whole would be the whole-blob write `REG-D-056` refused.
	 *   · `RETAINED_FOR_DIAGNOSIS` — the reviewer's plane: the whole reply is stored PURGEABLE_AT_EXPIRY and pointed at by
	 *     `rawOutputBeforeCoercionRef`; its two spans stay PENDING, saying where it is. ⭑ Why that class, and why it is
	 *     wrong in NEITHER direction §9.7 fears: whatever reasoning the reply holds stays purgeable (PER-12); and no
	 *     judgement rests on its bytes — a reply with no locatable object coerces to the same empty judgement whatever it
	 *     says (`coerceJudgement`) — so purging it severs no trace (PER-8's why). It is kept for diagnosis, ASR-11 limb 3
	 *     (*"raw output is retained for diagnostics"*) and PER-12's one permitted use. The sponsor approved keeping the
	 *     reviewer's unparsed replies (`REG-D-103` (2)), after the measured run kept none of its 10 (`REG-F-351`'s pointer).
	 * ⚠ ASKED ONLY FOR A TRY THAT GOT A REPLY. A call that threw has `rawOutput` '' because nothing came back; stored, it
	 * would read as an empty reply that never arrived (`JAN-NOANS`). The validator does not ask for one.
	 */
	readonly unseparatedRawOutput?: 'BLOCKED' | 'RETAINED_FOR_DIAGNOSIS';
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7 P5, package A (F1) — A REPLY THE TOOL ENDED AT THE MODEL'S OUTPUT-TOKEN LIMIT
	 * (`tools/output-limit.ts`), which only the caller can say. Nothing is judged from any of it, so it is kept WHOLE, as
	 * `RETAINED_FOR_DIAGNOSIS` keeps a reply — PURGEABLE_AT_EXPIRY, its two spans PENDING saying why — whatever span can be
	 * located in it: a span the cut left is an answer that participated in nothing, and kept RETAINED_BY_PARTICIPATION it
	 * would claim a judgement rested on it. ⭐ And E-4 says its output was declared truncated (`outputTruncationState`).
	 */
	readonly cutAtOutputLimit?: true;
	/**
	 * ⭐⭐ P7-6 I2 — THE BACKING TOOL'S OWN RECORD OF THE SESSION (`ToolInvocationResult.sessionExport`: devin's export, which
	 * lists every step and any tool devin called). Stored PURGEABLE_AT_EXPIRY — a session trace, never Evidence (PER-12) —
	 * and pointed at from the record: the record's tool-call observation, whose reason already says this adapter could
	 * not watch the session, gains where the tool's own account of it is kept.
	 * ⛔ THE POINTER IS WHAT MAKES IT LAWFUL: stored with nothing pointing at it, it would be the orphan `REG-F-336` C-2
	 * forbids. So beside an OBSERVED report — an arm that may carry no reason (`model-exchange.ts`) — it is NOT stored. No
	 * adapter that observes calls writes an export today.
	 * ⚠ NOT A TYPED FIELD, AND SAID SO: `MODEL_EXCHANGE` has no ref for a session export, and adding one is a ratified
	 * contract change (the design §10 route, `R11`'s act). Until then the pointer is prose, bounded with the reason it
	 * joins (`RecordPlaneProseSchema`, 4,096 characters; devin's reason and the pointer are under 1,000).
	 */
	readonly toolSessionExport?: string;
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
		respondedAt: input.respondedAt,
		// ⚠ JAN-EXECRUN — THIS WAS DROPPED SILENTLY AND A CAST HID IT. `beginExchange` has accepted a
		// `promptTemplateFingerprint` all along; `captureTry` neither declared nor forwarded one, so the first
		// caller with a real fingerprint (`REG-D-058` finally gave the field a referent) passed it in and it
		// vanished. It compiled because that call site cast its argument — the cast was the bug, not the shape.
		...(input.promptTemplateFingerprint
			? { promptTemplateFingerprint: input.promptTemplateFingerprint }
			: {}),
		// ⭐ R11 — forwarded, never synthesized. `beginExchange` requires both for the same reason this does.
		workProductDerivation: input.workProductDerivation,
		observedToolCalls: input.observedToolCalls
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

	// ⭐ P5 package A (F1) — E-4 of a reply the tool ended at the model's output-token limit, on either path below.
	const cutOutput = input.cutAtOutputLimit ? { outputTruncationState: 'declared' as const } : {};

	if (!input.store) {
		const pending = { ...base, ...cutOutput, disposition: input.disposition, parseOutcome: input.parseOutcome };
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
	// ⭑ `REG-D-057` (sponsor, option (a)): the split DECLARES the omission it performs, and declares it with
	// enough structure to undo. Guide §9.7 and `PER-9` both require *"declared truncation or omission"* in the
	// same sentence that names the elements to record — so this is the field the obligation always pointed at,
	// filled for the first time since it was authored.
	let omittedRegions: OmittedRegion[] = [];

	if (input.cutAtOutputLimit) {
		// ⭐ P5 package A (F1) — a reply the tool cut: kept whole for diagnosis, whatever span it holds (`cutAtOutputLimit`).
		({ answerSpanRef, volunteeredReasoningRef, rawOutputRef } = await unlocatedRefs(
			input.rawOutput,
			'RETAINED_FOR_DIAGNOSIS',
			input.store.durability,
			put,
			CUT_REPLY_KEPT
		));
	} else if (!span.located) {
		// ⛔ §9.7's OWN INSTRUCTION, and the only branch that still refuses — ⭐ unless the caller asks to keep the whole
		// reply for diagnosis (P7-6 I2, the reviewer's plane; `unlocatedRefs`). `located` is a MEASUREMENT
		// (REG-F-339), so this is entered on evidence about THIS blob rather than on a class of blob assumed
		// unsplittable — the over-broad claim REG-F-340 corrected.
		({ answerSpanRef, volunteeredReasoningRef, rawOutputRef } = await unlocatedRefs(
			input.rawOutput,
			input.unseparatedRawOutput,
			input.store.durability,
			put
		));
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
						'stored object carries one retention class and this one is mixed. The reply is NOT lost: ' +
						'`omittedRegions` carries the answer span’s byte offset, so the two retained objects ' +
						'reassemble into the exact bytes that arrived.'
				)
			: // Nothing to separate: the whole output IS the answer, so a single class fits it exactly.
				answerSpanRef;

		if (volunteered)
			omittedRegions = [
				{
					role: 'MODEL_ANSWER',
					reason:
						'The answer span was cut out of the retained reasoning at retention (Guide §9.7) because ' +
						'the two halves carry opposite retention classes. It is retained separately as ' +
						'`answerSpanRef` under RETAINED_BY_PARTICIPATION. Reassemble the reply as ' +
						'reasoning.slice(0, byteOffset) + answer + reasoning.slice(byteOffset), in BYTES.',
					// ⚠ UTF-8 BYTES, measured — not `String.length`, which is UTF-16 code units and disagrees
					// with `byteSize` everywhere else in this record the moment a reply is not ASCII.
					byteSize: Buffer.byteLength(span.answer, 'utf8'),
					byteOffset: Buffer.byteLength(span.prefix, 'utf8')
				}
			];
	}

	const inputRef = await put(input.prompt, 'RETAINED_BY_PARTICIPATION');

	const recorded: ExchangeRecord = {
		...base,
		...cutOutput,
		materializedInputRef: storedRef(inputRef, input.store.durability, 'RETAINED_BY_PARTICIPATION'),
		rawOutputBeforeCoercionRef: rawOutputRef,
		answerSpanRef,
		volunteeredReasoningRef,
		omittedRegions,
		disposition: input.disposition,
		parseOutcome: input.parseOutcome,
		// ⭐ P7-6 I2 — the observation as the adapter reported it, and, where the tool wrote one, where its export is kept.
		observedToolCalls: await withSessionExport(
			input.store,
			input.tenantPrefix,
			input.observedToolCalls,
			input.toolSessionExport
		)
	};
	input.sink?.record(recorded);
	return recorded;
}

/** The three E-2 refs of a reply. */
interface ReplyRefs {
	readonly answerSpanRef: ContentRef;
	readonly volunteeredReasoningRef: ContentRef;
	readonly rawOutputRef: ContentRef;
}

/** Why a kept reply's two spans hold nothing, when no answer span could be located in it (P7-6 I2). */
const UNLOCATED_REPLY_KEPT =
	'No answer span could be located in this reply, so nothing in it can be told apart as an answer or as ' +
	'volunteered reasoning (Guide §9.7). The whole reply is kept instead, under rawOutputBeforeCoercionRef, ' +
	'PURGEABLE_AT_EXPIRY, for diagnosis (ASR-11 limb 3): no judgement rests on its bytes. JAN-EXEC Phase 7 ' +
	'P7-6 I2; REG-D-103 (2).';

/** ⭐ P5 package A (F1) — why a kept reply's two spans hold nothing, when the tool cut the reply (`cutAtOutputLimit`). */
const CUT_REPLY_KEPT =
	'The reviewing tool ended this reply at the model’s output-token limit, so nothing in it is judged — any span in it ' +
	'is an answer cut short, and participated in nothing. The whole reply is kept instead, under ' +
	'rawOutputBeforeCoercionRef, PURGEABLE_AT_EXPIRY, for diagnosis (ASR-11 limb 3). JAN-EXEC Phase 7 P5, package A.';

/**
 * The E-2 refs of a reply in which NO answer span could be located: blocked, as Guide §9.7 instructs — or, where the
 * caller asks (`unseparatedRawOutput`, the reviewer's plane, P7-6 I2), the whole reply kept PURGEABLE_AT_EXPIRY for
 * diagnosis, its two spans saying they hold nothing and where the reply is. ⭑ Nothing was cut out of anything in either
 * arm, so neither declares a region. ⭐ P5 package A — and of a reply the tool cut, kept whole the same way, its spans
 * saying why (`keptBecause`).
 */
async function unlocatedRefs(
	rawOutput: string,
	asked: CaptureTryInput['unseparatedRawOutput'],
	durability: ContentDurability,
	put: (bytes: string, purgeability: Purgeability) => Promise<StoredArtifactRef>,
	keptBecause = UNLOCATED_REPLY_KEPT
): Promise<ReplyRefs> {
	if (asked === 'RETAINED_FOR_DIAGNOSIS') {
		const kept = pendingRef(keptBecause);
		return {
			answerSpanRef: kept,
			volunteeredReasoningRef: kept,
			rawOutputRef: storedRef(await put(rawOutput, 'PURGEABLE_AT_EXPIRY'), durability, 'PURGEABLE_AT_EXPIRY')
		};
	}
	const blocked = pendingRef(
		'No answer span could be located, so the answer and any volunteered reasoning cannot be separated ' +
			'losslessly. Guide §9.7: block the capability and resolve Section 16 item 23. Retaining the blob ' +
			'whole would classify reasoning as participating (PER-8, permanent) or the answer as purgeable ' +
			'(PER-12) — wrong in one direction or the other.'
	);
	return { answerSpanRef: blocked, volunteeredReasoningRef: blocked, rawOutputRef: blocked };
}

/**
 * ⭐⭐ P7-6 I2 — STORE A TOOL'S EXPORT OF THE SESSION, AND SAY ON THE RECORD WHERE IT IS (`CaptureTryInput.toolSessionExport`).
 *
 * The pointer joins the observation's own reason, after the adapter's words, which stay whole: that reason already says
 * this adapter could not watch the session, so where the tool's own account of the session is kept is the next thing a
 * reader of it needs. ⛔ An OBSERVED report may carry no reason (`model-exchange.ts`), so beside one the export is not
 * stored at all — stored there, nothing could point at it (`REG-F-336` C-2).
 */
async function withSessionExport(
	store: ArtifactStore,
	tenantPrefix: string,
	report: ObservedToolCallReport,
	bytes: string | undefined
): Promise<ObservedToolCallReport> {
	if (bytes === undefined || report.observation === 'OBSERVED') return report;
	const ref = await store.put({ tenantPrefix, bytes, mediaType: 'application/json', purgeability: 'PURGEABLE_AT_EXPIRY' });
	return {
		...report,
		reason:
			`${report.reason ?? ''} ⭑ The backing tool's own export of this session, which lists every step and any tool ` +
			`it called, is kept on the content plane, PURGEABLE_AT_EXPIRY: storage key ${ref.storageKey}, ` +
			`${ref.contentHash}, ${ref.byteSize} bytes (JAN-EXEC Phase 7 P7-6 I2).`
	};
}
