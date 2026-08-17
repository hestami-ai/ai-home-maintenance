// RphError — the typed, classified error contract (Constitution: typed & classified errors).
// The command pipeline RETURNS an RphError inside CommandResult on domain rejection; RphErrorException
// is for fail-loud internal invariant breaches. VALIDATOR_FAILED is intentionally NOT an RphError code —
// it is an AssuranceAssessmentState (validator output ruled inadmissible), per docs §5 / DOC-004.
import { z } from 'zod';
import { RphErrorCategorySchema, type RphErrorCategory } from './enums.js';

/**
 * The RPH error codes. Fifteen transcribed from DOC-007 §25.1 (**HISTORICAL MATERIAL** — evidence of intent
 * for the spellings, binding nothing as prose), plus one AUTHORED addition disclosed inline below.
 *
 * ⚠ THE COUNT IS NOT IN THIS COMMENT ON PURPOSE. It said "The 15 canonical RPH error codes" and that number
 * was load-bearing in three other places — including a code comment in `command-bus.ts` that refused to mint a
 * needed code on the strength of it. `errors.test.ts` derives the set from `vocab/canonical-vocabulary.json`
 * and asserts equality, so the vocabulary is the population and this list is checked against it.
 *
 * ── WHO MAY ADD ONE, SETTLED 2026-08-07 (REG-D-027, REG-F-057) ───────────────────────────────────────────────
 * **A repository shape change, through the contract procedure — NOT a sponsor act.** `command-bus.ts` carried
 * the claim that *"minting one is a sponsor act"* and the codebase obeyed it; it is contradicted by ratified
 * text. **REG-D-004** (sponsor-participated DECISION): *"The repository — generated contracts, schemas,
 * migrations, conformance tests — is authoritative for exact shapes: wire envelopes, JSON schemas, enum
 * spellings, ID prefixes, **error codes**."* **DOC-004 §5** routes the change: *"extending an enum — is a
 * contract change: new schema version, coordinated code/storage/fixture/test change, **through the
 * repository's contract procedure**."* **DOC-004 §8.2** reserves Constitutional, Vocabulary, Hypothesis and
 * Canon text to the sponsor and grants *"Code — full agency within this protocol"*; shapes are not reserved.
 * SPEC-001 §6.1's `SHALL NOT` binds *that specification*, not this repository, and SPEC-001 §11.4.15 rejected
 * enum growth **under delegated authority** on cost and arithmetic — never on reservation.
 */
export const RphErrorCodeSchema = z.enum([
	'RPH_VALIDATION_SCHEMA_FAILED',
	'RPH_VALIDATION_SEMANTIC_FAILED',
	'RPH_AUTHORITY_INSUFFICIENT',
	'RPH_REVISION_CONFLICT',
	'RPH_ILLEGAL_STATE_TRANSITION',
	'RPH_INVARIANT_VIOLATION',
	'RPH_EVIDENCE_MISSING',
	'RPH_EVIDENCE_INVALIDATED',
	'RPH_VALIDATOR_OUTPUT_INVALID',
	'RPH_VALIDATOR_INDEPENDENCE_VIOLATION',
	'RPH_POLICY_VERSION_MISMATCH',
	'RPH_SUBJECT_VERSION_MISMATCH',
	'RPH_BASELINE_VERSION_MISMATCH',
	'RPH_IDEMPOTENCY_DUPLICATE',
	'RPH_EXTERNAL_OPERATION_UNCERTAIN',
	// ── AUTHORED 2026-08-07 (REG-D-027). Not from DOC-007 §25.1; disclosed rather than blended in. ──────────
	// The acting principal could not be established from authenticated context, so the command cannot be
	// ATTRIBUTED and is refused before any effect (PER-3; DOC-004 §5).
	//
	// WHY NOT REUSE `RPH_AUTHORITY_INSUFFICIENT`: it means the principal IS known and may not act. Conflating
	// the two would make the governed record unable to distinguish *"I do not know who you are"* from *"I know
	// who you are and you may not"* — and telling those apart is the first clause of the accountability
	// standard this work exists to serve. It is also the distinction each deployment tier routes DIFFERENTLY:
	// in SaaS and Enterprise an unauthenticated command is a security event, in standalone it is a
	// misconfiguration. A distinct code lets any host route it without string-matching a message.
	'RPH_AUTHENTICATION_REQUIRED',
	// ── AUTHORED 2026-08-15 (REG-D-027/REG-F-057 · REG-F-181). Not from DOC-007 §25.1; disclosed, not blended. ──
	// An idempotency key on record was reused for a DIFFERENT command — differing command type, target aggregate,
	// or payload hash — so returning the prior result would report success for work that never happened (PER-5).
	//
	// WHY NOT REUSE `RPH_IDEMPOTENCY_DUPLICATE`: that one is the true REPLAY, which REG-F-010 records as correctly
	// carrying NO error at all. Conflating them would make *"I already did this, here is the answer"* and *"you
	// asked me something different under a key that is spoken for"* indistinguishable to a caller — and the second
	// is a refusal while the first is a success.
	//
	// ⚠ IT TOOK EIGHT DAYS TO ARRIVE BECAUSE THE GROUND MOVED AND THE CONSUMERS WERE NEVER TOLD. Both call sites
	// carried *"minting one is a sponsor act"*; REG-D-027/REG-F-057 settled on 2026-08-07 that it is a repository
	// shape change through the contract procedure; the correction landed in THIS file, and the two consumers went
	// on declining to mint on a ground that no longer existed (REG-F-144).
	'RPH_IDEMPOTENCY_CONFLICT'
]);
export type RphErrorCode = z.infer<typeof RphErrorCodeSchema>;

/**
 * Best-judgment code→category mapping. OPEN ITEM #6: DOC-007 §25 lists the codes AND the 10-value
 * category enum but gives NO mapping — this is a sponsor-confirmable decision (see OPEN-QUESTIONS.md).
 */
export const ERROR_CODE_CATEGORY: Readonly<Record<RphErrorCode, RphErrorCategory>> = {
	RPH_VALIDATION_SCHEMA_FAILED: 'VALIDATION',
	RPH_VALIDATION_SEMANTIC_FAILED: 'VALIDATION',
	RPH_AUTHORITY_INSUFFICIENT: 'AUTHORIZATION',
	RPH_REVISION_CONFLICT: 'CONCURRENCY',
	RPH_ILLEGAL_STATE_TRANSITION: 'INVARIANT',
	RPH_INVARIANT_VIOLATION: 'INVARIANT',
	RPH_EVIDENCE_MISSING: 'ASSURANCE',
	RPH_EVIDENCE_INVALIDATED: 'ASSURANCE',
	RPH_VALIDATOR_OUTPUT_INVALID: 'ASSURANCE',
	RPH_VALIDATOR_INDEPENDENCE_VIOLATION: 'ASSURANCE',
	RPH_POLICY_VERSION_MISMATCH: 'ASSURANCE',
	RPH_SUBJECT_VERSION_MISMATCH: 'ASSURANCE',
	RPH_BASELINE_VERSION_MISMATCH: 'INVARIANT',
	RPH_IDEMPOTENCY_DUPLICATE: 'CONCURRENCY',
	RPH_EXTERNAL_OPERATION_UNCERTAIN: 'EXTERNAL_DEPENDENCY',
	// AUTHORIZATION, deliberately, and NOT a new category. `RphErrorCategorySchema` is GENERATED from
	// `vocab/canonical-vocabulary.json` and its ten values are canon-facing; adding an AUTHENTICATION category
	// would be a second, larger shape change for no gain the code itself does not already carry. The CODE is
	// what an operator routes on; the category is a coarse bucket, and "you may not act, because I cannot
	// establish who you are" sits in it honestly.
	RPH_AUTHENTICATION_REQUIRED: 'AUTHORIZATION',
	// CONCURRENCY BY TWO INDEPENDENT PRECEDENTS, NOT BY TASTE (REG-F-181). `RPH_IDEMPOTENCY_DUPLICATE` — the
	// sibling code for the same concept — is already CONCURRENCY, and so is `RPH_REVISION_CONFLICT`, the only
	// other `*_CONFLICT` member. Same concept and same suffix, arrived at separately, agreeing.
	//
	// ⚠ AND THIS MOVES THE CATEGORY THE REUSE REFUSAL REPORTS, from VALIDATION to CONCURRENCY, because the old
	// VALIDATION was an artifact of the BORROWED code rather than a judgment about the condition. `makeRphError`
	// derives `category` from this map, so anything routing on category sees the refusal change buckets — pinned
	// in `idempotency-key-reuse.test.ts` rather than left for someone to discover in a log.
	RPH_IDEMPOTENCY_CONFLICT: 'CONCURRENCY'
};

/** The serialized error shape carried in CommandResult.error and event/observation payloads. */
export const RphErrorSchema = z.strictObject({
	code: RphErrorCodeSchema,
	category: RphErrorCategorySchema,
	message: z.string(),
	retryable: z.boolean(),
	targetObjectIds: z.array(z.string()),
	details: z.record(z.string(), z.unknown()).optional(),
	correlationId: z.string()
});
export type RphError = z.infer<typeof RphErrorSchema>;

export interface MakeRphErrorOptions {
	message: string;
	correlationId: string;
	retryable?: boolean;
	targetObjectIds?: string[];
	details?: Record<string, unknown>;
}

/** Construct a well-formed RphError, deriving `category` from the canonical mapping. */
export function makeRphError(code: RphErrorCode, opts: MakeRphErrorOptions): RphError {
	return {
		code,
		category: ERROR_CODE_CATEGORY[code],
		message: opts.message,
		retryable: opts.retryable ?? false,
		targetObjectIds: opts.targetObjectIds ?? [],
		...(opts.details ? { details: opts.details } : {}),
		correlationId: opts.correlationId
	};
}

/** Throwable wrapper for fail-loud paths (e.g. invariant violations) that must not be swallowed. */
export class RphErrorException extends Error {
	override readonly name = 'RphErrorException';
	constructor(readonly error: RphError) {
		super(`${error.code}: ${error.message}`);
	}
}
