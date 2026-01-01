import { z } from 'zod';

/**
 * Standard error codes used across the API
 */
export const ErrorCode = {
	// Validation errors (400)
	VALIDATION_FAILED: 'VALIDATION_FAILED',
	INVALID_INPUT: 'INVALID_INPUT',

	// Authentication errors (401)
	UNAUTHENTICATED: 'UNAUTHENTICATED',
	INVALID_TOKEN: 'INVALID_TOKEN',
	SESSION_EXPIRED: 'SESSION_EXPIRED',

	// Authorization errors (403)
	FORBIDDEN: 'FORBIDDEN',
	INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
	ORGANIZATION_ACCESS_DENIED: 'ORGANIZATION_ACCESS_DENIED',

	// Not found errors (404)
	NOT_FOUND: 'NOT_FOUND',
	RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

	// Conflict errors (409)
	CONFLICT: 'CONFLICT',
	DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
	IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',

	// Rate limiting (429)
	RATE_LIMITED: 'RATE_LIMITED',

	// Server errors (500)
	INTERNAL_ERROR: 'INTERNAL_ERROR',
	DATABASE_ERROR: 'DATABASE_ERROR',
	WORKFLOW_ERROR: 'WORKFLOW_ERROR'
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Error type classification
 */
export const ErrorType = {
	VALIDATION: 'validation',
	AUTHENTICATION: 'authentication',
	AUTHORIZATION: 'authorization',
	NOT_FOUND: 'not_found',
	CONFLICT: 'conflict',
	RATE_LIMIT: 'rate_limit',
	INTERNAL: 'internal'
} as const;

export type ErrorTypeType = (typeof ErrorType)[keyof typeof ErrorType];

/**
 * Field-level validation error
 */
export const FieldErrorSchema = z.object({
	field: z.string(),
	message: z.string(),
	code: z.string().optional()
});

export type FieldError = z.infer<typeof FieldErrorSchema>;

/**
 * Standard error response structure per SRD spec
 */
export const ApiErrorSchema = z.object({
	code: z.string(),
	type: z.string(),
	httpStatus: z.number(),
	message: z.string(),
	details: z.string().optional(),
	fieldErrors: z.array(FieldErrorSchema).optional(),
	retryable: z.boolean()
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Response metadata
 */
export const ResponseMetaSchema = z.object({
	requestId: z.string(),
	traceId: z.string().nullable(),
	spanId: z.string().nullable(),
	timestamp: z.string(),
	locale: z.string().default('en-US')
});

export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

/**
 * Standard error response envelope
 */
export const ErrorResponseSchema = z.object({
	ok: z.literal(false),
	error: ApiErrorSchema,
	meta: ResponseMetaSchema
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Standard success response envelope
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
	return z.object({
		ok: z.literal(true),
		data: dataSchema,
		meta: ResponseMetaSchema
	});
}


