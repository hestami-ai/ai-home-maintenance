// ICP-02 — the PER-9 exchange record.
//
// ── ADOPTED, NOT DERIVED ────────────────────────────────────────────────────────────────────────────────────
// The shape comes from `JAN-CSAA-007`'s `ModelExchangeRecord`, field by field, with every taken and refused
// field reasoned in `docs/Instruction and Context Plane/ICP-02 adoption decision.md`. CSAA is another agent's
// subsystem: this adopts the SHAPE and imports NOTHING from it. The reason to start there rather than from
// PER-9 alone is REG-F-314 — a design that re-derives a ratified obligation unaided produces a weaker set, and
// this repository has the receipt.
//
// ── WHY THIS RECORD HOLDS REFERENCES AND NOT CONTENT ────────────────────────────────────────────────────────
// `ModelExchangeRecord` stores the input and output BY REFERENCE (`materializedInputArtifactRef`,
// `rawOutputBeforeCoercionRef`). That is the two-plane architecture PER-12 + PER-8 require, arrived at
// independently: the RECORD is permanent (PER-8, no hard delete after participation) and the CONTENT is
// purgeable at retention expiry (PER-12), so they cannot share a store.
//
// ⚠ THE REFERENTS NOW EXIST — THIS PARAGRAPH USED TO SAY THEY DID NOT (`REG-F-348`). It read "There is no
// content store (`REG-F-315` … deferred as `DEF-W2-001`)", and at HEAD `ArtifactStore` has two adapters
// (`SqliteArtifactStore` durable, in-memory process-local), both wired through `getArtifactStore()`.
// Refs are still BORN `PENDING_CONTENT_PLANE`, for a different and smaller reason: a producer constructed
// WITHOUT a store retains nothing, and `captureTry` overwrites these the moment one is supplied. ⭑ Redaction
// is the half that has not moved (finding #60), so `inputRedactionManifestRef` stays PENDING on every path.
// A record that SAYS its bytes are unretained is the disclosed omission PER-9 permits; the silent one PER-9
// forbids ("record-plane omission is not") is what this module exists to avoid.

import type { ContentDurability, Purgeability } from '@janumipwb/rph-ports';
// ⭐ R11 — THE TWO NEW FIELDS CARRY THE CONTRACT TYPES DIRECTLY, WHICH IS A DEPARTURE WORTH STATING.
// Every other field here has an app-local twin (`'initial'` beside `'INITIAL'`, `'none-declared'` beside
// `NONE_DECLARED`) because this vocabulary PREDATED the contract and `exchange-recorder.ts` maps between them.
// These two are BORN WITH the contract, so minting a second lower-case vocabulary for them — and a third
// mapping table to keep in step — would be manufacturing exactly the drift those tables exist to absorb.
import type { ObservedToolCallReport, WorkProductDerivation } from '@janumipwb/rph-contracts';

/** PER-9-a's unit. Taken VERBATIM from `ModelExchangeRecord` — a narrower set would silently re-merge cases
 *  the corpus separates, which is the defect at `reasoning-review-validator.ts:180`. */
export type ExchangeRole = 'initial' | 'retry' | 'reformat' | 'repair';

/** E-4. `unknown` is the member that must never be dropped: it states an unobtained answer instead of guessing
 *  one. Finding #61 is what happens without it — truncation declared only inside a discarded prompt string. */
export type TruncationState = 'none-declared' | 'declared' | 'detected' | 'unknown';

/** E-5. `accepted-for-normalization` is renamed `accepted` (CSAA's normalization pipeline has no JPWB
 *  counterpart); the rest are verbatim. `repair-requested` is what a repair's PREDECESSOR records — the fact
 *  finding #62's bare `catch` currently drops. */
export type ExchangeDisposition = 'accepted' | 'rejected' | 'quarantined' | 'repair-requested';

/** The identity that actually served the try (E-3).
 *
 *  ⭑ THE SECOND AND THIRD ARMS ARE LOAD-BEARING. PER-12: availability is "provider- and configuration-
 *  dependent". An optional field cannot distinguish "the provider reported nothing" from "nobody looked" —
 *  and conflating those two is this repository's single most-recorded defect. Stating it costs one union. */
export type ResolvedModelIdentity =
	| {
			readonly kind: 'resolved';
			readonly modelId: string;
			readonly providerId: string;
			/** ⭑ HOW THE IDENTITY WAS OBTAINED, which is a different fact from the identity itself. A tool that
			 *  ECHOES BACK which model answered evidences its own identity (`PROVIDER_REPORTED`); a tool the host
			 *  merely configured evidences nothing (`HOST_CONFIGURED`), and grading an assertion as confirmation
			 *  is the fabricated-measurement defect. Optional, defaulting to the weaker grade, because every
			 *  existing caller IS host-configured and silently promoting them would be that same defect. */
			readonly evidence?: 'PROVIDER_REPORTED' | 'HOST_CONFIGURED';
	  }
	| { readonly kind: 'unreported'; readonly rationale: string }
	| { readonly kind: 'unresolvable'; readonly rationale: string };

/** A pointer to content that lives outside the record. `PENDING_CONTENT_PLANE` is not a placeholder for a
 *  missing value — it is a positive statement that the bytes were obtainable and are not yet retainable. */
export interface ContentRef {
	/** REG-D-050: which side of PER-8 this content falls on. Absent while PENDING — nothing is classified
	 *  until it is actually retained, because a classification on absent bytes asserts a fact about nothing. */
	readonly purgeability?: Purgeability;
	readonly status: 'PENDING_CONTENT_PLANE' | 'STORED';
	/**
	 * Set only when STORED — whether the referenced bytes survive a restart.
	 *
	 * ⭑ THE RECORD DISCLOSES THIS BECAUSE THE INVERSE ORPHAN IS OTHERWISE INVISIBLE. This record plane can be
	 * durable while the content plane is not; after one restart the reference then names bytes that are gone,
	 * and the store's answer is indistinguishable from a key never written — so the record still LOOKS intact.
	 * Carrying the content store's declared durability turns that from an undetectable hazard into a disclosed
	 * one, which is the posture `PER-9` requires: *"record-plane omission is not legal."*
	 */
	readonly contentDurability?: ContentDurability;
	/** Set only when STORED — the `ARTIFACT.storageKey` the bytes live under. */
	readonly storageKey?: string;
	/**
	 * Set only when STORED — the rest of what §18.1 needs to ADDRESS the bytes.
	 *
	 * ⚠ THESE WERE BEING DROPPED. `storedRef` kept only the key, so a record could name a location without
	 * saying which provider held it, what the bytes hashed to, or how many there were — and `contentHash` is
	 * the only thing that can later prove the retained bytes are the ones this try actually saw. A reference
	 * that cannot be verified is a reference that cannot be challenged, which is the half of PER-9 that makes
	 * a record worth keeping.
	 */
	readonly storageProvider?: string;
	readonly contentHash?: string;
	readonly byteSize?: number;
	/** Set only when PENDING — why, in terms a reader can act on. */
	readonly reason?: string;
}

/**
 * One region cut out of what was retained — `PER-9`'s *"declared truncation or omission"* (E-4).
 *
 * ⭑ `byteOffset` IS WHAT MAKES THE OMISSION REVERSIBLE, AND IT WAS ABSENT UNTIL `REG-D-057`. A region that
 * records only its SIZE says something was removed; it does not say from where, so the retained pieces cannot
 * be put back in order. `REG-F-345` drove the consequence: the replies `thinking hard here {"r":1}` and
 * `{"r":1}thinking hard here ` produced BYTE-IDENTICAL records. Reason-then-answer and
 * answer-then-rationalisation were the same record, on a policy whose subject is how the reviewer reasoned.
 *
 * ⚠ BOTH NUMBERS ARE UTF-8 BYTES, NOT STRING LENGTHS. They differ the moment a reply is not ASCII, and a
 * reconstruction that mixes the two units silently corrupts every non-English reply. Measured with
 * `Buffer.byteLength` at the producer and asserted against a non-ASCII fixture.
 */
export interface OmittedRegion {
	readonly role: string;
	readonly reason: string;
	/** UTF-8 bytes removed. */
	readonly byteSize: number;
	/** Where the removal began, as a UTF-8 byte offset into the ORIGINAL reply. */
	readonly byteOffset: number;
}

export interface ExchangeRecord {
	readonly exchangeId: string;
	readonly exchangeRole: ExchangeRole;
	/** Required unless `initial`. Names the try this one succeeds, which is what makes CSAA-007's rule —
	 *  "Repair never rewrites predecessor raw output" — checkable rather than aspirational. */
	readonly predecessorExchangeId?: string;
	readonly resolvedModelIdentity: ResolvedModelIdentity;
	/** E-1 — the exact materialized input, by reference. */
	readonly materializedInputRef: ContentRef;
	/**
	 * E-2 — the returned output before schema coercion or repair, by reference.
	 *
	 * ⭑ THREE REFS, BECAUSE THE BLOB IS MIXED AND ITS HALVES CARRY OPPOSITE OBLIGATIONS. The answer
	 * participated in a recorded judgement (`PER-8`, permanent); volunteered reasoning "participates in
	 * nothing" (`PER-12`, purgeable at expiry). One stored object carries one class, so §9.7 requires them
	 * SEPARATED at retention. `rawOutputBeforeCoercionRef` therefore holds the whole blob ONLY when there is
	 * nothing to separate; when reasoning arrives inline it is PENDING with that reason, which is a
	 * representation and not a block. `REG-D-056` is the ruling; `REG-D-050` classified the halves.
	 */
	readonly rawOutputBeforeCoercionRef: ContentRef;
	/** E-2's answer half — what binds under §8.4. */
	readonly answerSpanRef: ContentRef;
	/** E-2's reasoning half — purgeable, never Evidence, never projected (`PER-12`). */
	readonly volunteeredReasoningRef: ContentRef;
	/** E-6 — what was redacted from the input, by reference. */
	readonly inputRedactionManifestRef: ContentRef;
	/** INDEX, NEVER SUBSTITUTE (PER-9). Present or not, it does not satisfy E-1 — see `unsatisfiedElements`. */
	readonly promptTemplateFingerprint?: string;
	readonly truncationState: TruncationState;
	readonly omittedRegions: readonly OmittedRegion[];
	readonly disposition?: ExchangeDisposition;
	/** 1-based position of this try within its run. The aggregate id orders nothing across aggregates. */
	readonly attemptOrdinal: number;
	/**
	 * PER-11 occurrence time, bracketing the model call itself.
	 *
	 * ⭑ THESE CANNOT BE RECONSTRUCTED AT THE DRAIN, WHICH IS WHY THEY ARE CAPTURED HERE. The event's own
	 * `occurredAt`/`recordedAt` are stamped when the record is WRITTEN — up to two round-trips after the act —
	 * so without these, latency is unrecoverable and a timeout is permanently indistinguishable from a slow
	 * but successful answer.
	 */
	readonly requestedAt: string;
	readonly respondedAt: string;
	/** E-5. PER-9 names "the parse/validation/repair outcome"; a bare disposition loses WHY it went that way. */
	readonly parseOutcome: ExchangeParseOutcome;
	/**
	 * ⭐ R11 — WHICH BYTES THE ASSESSMENT RESTS ON, as a TYPED relation rather than a fragment in E-5's prose.
	 *
	 * ⛔ IT IS REQUIRED, AND THE REQUIREMENT IS THE GUARANTEE. JAN-EXEC Phase 0 split the ARTIFACT from the
	 * ANSWER SPAN, so `art.storageKey === answerSpanRef.storageKey` stopped holding by arithmetic and the
	 * relation had to be declared. An OPTIONAL field would make the declaration omissible, and an omission is
	 * indistinguishable from all four facts `relation` exists to separate — which is the `REG-F-364` dodge
	 * shape, *"skip the check by leaving it out"*, applied to the one relation this record exists to carry.
	 */
	readonly workProductDerivation: WorkProductDerivation;
	/**
	 * ⭐ R11 — WHAT THE ADAPTER OBSERVED THE MODEL DO, never what the model said it did.
	 *
	 * ⛔ §22.1 makes model output UNTRUSTED EXTERNAL INPUT, so *"the model said it ran the tests"* is not
	 * evidence that tests ran. Required for the same reason `truncationState` and `redactionState` are: a
	 * record unable to say whether tool calls were observed performs record-plane omission about its own
	 * instrument, and `PER-9` forbids that by name.
	 */
	readonly observedToolCalls: ObservedToolCallReport;
}

/** E-5's detail — what became of the bytes between the model and the judgement. */
export interface ExchangeParseOutcome {
	readonly outcome:
		| 'PARSED'
		| 'EMPTY_RESPONSE'
		| 'JSON_EXTRACTION_FAILED'
		| 'JSON_PARSE_FAILED'
		| 'SCHEMA_COERCION_FAILED'
		| 'NOT_ATTEMPTED';
	readonly detail: string;
}

/** Either a resolved model, or a stated reason there is none. */
export type ModelInput =
	| {
			readonly modelId: string;
			readonly providerId: string;
			readonly evidence?: 'PROVIDER_REPORTED' | 'HOST_CONFIGURED';
	  }
	| { readonly unavailable: 'unreported' | 'unresolvable'; readonly rationale: string };

export interface BeginExchangeInput {
	readonly exchangeId: string;
	readonly role: ExchangeRole;
	/** The PREDECESSOR RECORD, not its id.
	 *  ⭑ TAKING THE RECORD IS THE POINT. CSAA-007's rule is "Repair never rewrites predecessor raw output",
	 *  and a function handed only an id cannot violate it — so a test asserting non-mutation would be a
	 *  control that cannot fail. Passing the record makes the rule breakable, therefore assertable. */
	readonly predecessor?: ExchangeRecord;
	readonly model: ModelInput;
	readonly promptTemplateFingerprint?: string;
	/** 1-based position within the run. */
	readonly attemptOrdinal: number;
	/** PER-11 occurrence times, bracketing the model call. Only the caller can know these. */
	readonly requestedAt: string;
	readonly respondedAt: string;
	/**
	 * ⭐ R11 — REQUIRED HERE TOO, AND THAT IS THE SAME DECISION APPLIED ONE LAYER DOWN.
	 *
	 * ⛔ THERE IS NO DEFAULT BECAUSE EVERY CANDIDATE DEFAULT FABRICATES. `beginExchange` cannot know whether
	 * this try is an execution step that owes a work product or a reviewer's call that owes none — that is the
	 * caller's fact, and the four members of `relation` are exactly the four answers. Picking one here would
	 * assert a fact nobody established, which is the defect `truncationState: 'unknown'` and
	 * `parseOutcome: NOT_ATTEMPTED` were introduced to avoid two fields over.
	 */
	readonly workProductDerivation: WorkProductDerivation;
	/** ⭐ R11. Required for the same reason, and with the same refusal to default: whether an adapter CAN see
	 *  tool calls is a fact about the adapter, and only the caller that drove it knows. */
	readonly observedToolCalls: ObservedToolCallReport;
}

const PENDING_CONTENT: ContentRef = {
	status: 'PENDING_CONTENT_PLANE',
	reason:
		// ⚠ CORRECTED (`REG-F-348`). This said "No content store exists (REG-F-315 … deferred as DEF-W2-001)",
		// and a content store EXISTS at HEAD — `ArtifactStore` with two adapters, one durable. The reason is
		// stamped onto every ref of every record this path produces, so the falsehood was reproduced per write.
		// What remains true is narrower and is what a reader actually needs: none was SUPPLIED TO THIS CALL.
		'No content store was supplied to this capture, so these bytes were not retained. A store EXISTS ' +
		'(ArtifactStore; SqliteArtifactStore is durable, the in-memory default is process-local) — this ' +
		'record’s producer was constructed without one, which is a wiring fact about this call and not a ' +
		'statement about the system. Redaction is still unimplemented (finding #60), so E-6 stays PENDING ' +
		'independently of the store.'
};

function toIdentity(model: ModelInput): ResolvedModelIdentity {
	return 'unavailable' in model
		? { kind: model.unavailable, rationale: model.rationale }
		: {
				kind: 'resolved',
				modelId: model.modelId,
				providerId: model.providerId,
				...(model.evidence ? { evidence: model.evidence } : {})
			};
}

/**
 * Open the record for one bounded try.
 *
 * FAILS CLOSED ON THE ROLE/PREDECESSOR RELATION. A `retry` with no predecessor is an orphaned try, and an
 * `initial` with one is a mislabelled chain; both would make PER-9-a's "each retry, reformat, and repair"
 * uncountable. Refusing here is cheaper than discovering it in a record nobody can reconstruct.
 */
export function beginExchange(input: BeginExchangeInput): ExchangeRecord {
	if (input.role !== 'initial' && !input.predecessor)
		throw new Error(
			`ExchangeRecord ${input.exchangeId}: role '${input.role}' requires a predecessor — a non-initial try that names no predecessor cannot be reconstructed as part of its chain (PER-9-a).`
		);
	if (input.role === 'initial' && input.predecessor)
		throw new Error(
			`ExchangeRecord ${input.exchangeId}: role 'initial' must not carry a predecessor — an initial try by definition succeeds nothing.`
		);
	return {
		exchangeId: input.exchangeId,
		exchangeRole: input.role,
		...(input.predecessor ? { predecessorExchangeId: input.predecessor.exchangeId } : {}),
		resolvedModelIdentity: toIdentity(input.model),
		materializedInputRef: PENDING_CONTENT,
		rawOutputBeforeCoercionRef: PENDING_CONTENT,
		answerSpanRef: PENDING_CONTENT,
		volunteeredReasoningRef: PENDING_CONTENT,
		inputRedactionManifestRef: PENDING_CONTENT,
		...(input.promptTemplateFingerprint
			? { promptTemplateFingerprint: input.promptTemplateFingerprint }
			: {}),
		// NEVER 'none-declared' by default: that would assert a fact nobody established (finding #61).
		truncationState: 'unknown',
		omittedRegions: [],
		attemptOrdinal: input.attemptOrdinal,
		requestedAt: input.requestedAt,
		respondedAt: input.respondedAt,
		// NOT_ATTEMPTED until the caller says otherwise — the same reasoning as `truncationState: 'unknown'`.
		// A default of PARSED would assert an outcome nobody observed.
		parseOutcome: { outcome: 'NOT_ATTEMPTED', detail: 'The try has not been dispositioned yet.' },
		// ⭐ R11 — CARRIED THROUGH, NEVER SYNTHESIZED. Both are the caller's facts; see BeginExchangeInput.
		workProductDerivation: input.workProductDerivation,
		observedToolCalls: input.observedToolCalls
	};
}

/**
 * Which of PER-9's six elements this record does NOT yet satisfy.
 *
 * ⭑ THIS IS THE ANTI-SUBSTITUTION PREDICATE. A present `promptTemplateFingerprint` does not remove `E-1`,
 * because PER-9 says a fingerprint "identifies that record; it never substitutes for it" — and a byte-count
 * summary standing in for the input is precisely the design REG-F-314 records as wrong. Making the shortfall
 * ENUMERABLE is what converts today's silent omission into the disclosed one PER-9 permits.
 */
export function unsatisfiedElements(rec: ExchangeRecord): readonly string[] {
	const missing: string[] = [];
	if (rec.materializedInputRef.status !== 'STORED') missing.push('E-1');
	if (rec.rawOutputBeforeCoercionRef.status !== 'STORED') missing.push('E-2');
	if (rec.resolvedModelIdentity.kind === 'unresolvable') missing.push('E-3');
	if (rec.truncationState === 'unknown') missing.push('E-4');
	if (!rec.disposition) missing.push('E-5');
	if (rec.inputRedactionManifestRef.status !== 'STORED') missing.push('E-6');
	return missing;
}
