// RphError — the typed, classified error contract (Constitution: typed & classified errors).
// The command pipeline RETURNS an RphError inside CommandResult on domain rejection; RphErrorException
// is for fail-loud internal invariant breaches. VALIDATOR_FAILED is intentionally NOT an RphError code —
// it is an AssuranceAssessmentState (validator output ruled inadmissible), per docs §5 / DOC-004.
import { z } from 'zod';
import { RphErrorCategorySchema, type RphErrorCategory } from './enums.js';

/** The 15 canonical RPH error codes (DOC-007 §25.1). */
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
	'RPH_EXTERNAL_OPERATION_UNCERTAIN'
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
	RPH_EXTERNAL_OPERATION_UNCERTAIN: 'EXTERNAL_DEPENDENCY'
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
