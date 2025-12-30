import { prisma } from '../../db.js';
import type { RequestContext } from '../context.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('IdempotencyMiddleware');

/**
 * Idempotency key TTL in milliseconds (24 hours)
 */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Result of idempotency check
 */
export interface IdempotencyResult {
	isNew: boolean;
	cachedResponse?: unknown;
	cachedStatusCode?: number;
}

/**
 * Check if an idempotency key has been used before
 * Returns cached response if key exists and hasn't expired
 */
export async function checkIdempotencyKey(
	key: string,
	organizationId: string,
	errors: any
): Promise<IdempotencyResult> {
	const existing = await prisma.idempotencyKey.findUnique({
		where: {
			key_organizationId: {
				key,
				organizationId
			}
		}
	});

	if (!existing) {
		return { isNew: true };
	}

	// Check if expired
	if (existing.expiresAt < new Date()) {
		// Delete expired key
		await prisma.idempotencyKey.delete({
			where: { id: existing.id }
		});
		return { isNew: true };
	}

	// Key exists and is valid - return cached response
	if (existing.response !== null) {
		return {
			isNew: false,
			cachedResponse: existing.response,
			cachedStatusCode: existing.statusCode ?? 200
		};
	}

	// Key exists but no response yet - request is in progress
	// Key exists but no response yet - request is in progress
	throw errors.CONFLICT({
		message: 'Request with this idempotency key is already in progress'
	});
}

/**
 * Store the response for an idempotency key
 */
export async function storeIdempotencyResponse(
	key: string,
	organizationId: string,
	response: unknown,
	statusCode: number
): Promise<void> {
	const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

	await prisma.idempotencyKey.upsert({
		where: {
			key_organizationId: {
				key,
				organizationId
			}
		},
		create: {
			key,
			organizationId,
			response: response as object,
			statusCode,
			expiresAt
		},
		update: {
			response: response as object,
			statusCode,
			expiresAt
		}
	});
}

/**
 * Reserve an idempotency key before processing
 * This prevents duplicate concurrent requests
 */
export async function reserveIdempotencyKey(
	key: string,
	organizationId: string,
	errors: any
): Promise<void> {
	const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

	try {
		await prisma.idempotencyKey.create({
			data: {
				key,
				organizationId,
				expiresAt
			}
		});
	} catch (error) {
		// Key already exists - check if it's a duplicate request
		const result = await checkIdempotencyKey(key, organizationId, errors);
		if (!result.isNew) {
			throw errors.CONFLICT({
				message: 'Duplicate request detected'
			});
		}
	}
}

/**
 * Clean up expired idempotency keys
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
	const result = await prisma.idempotencyKey.deleteMany({
		where: {
			expiresAt: {
				lt: new Date()
			}
		}
	});
	return result.count;
}

/**
 * Wrapper for idempotent operations
 * Handles checking, reserving, and storing idempotency keys
 */
export async function withIdempotency<T>(
	key: string,
	context: RequestContext,
	errors: any,
	operation: () => Promise<T>
): Promise<{ result: T; fromCache: boolean }> {
	if (!context.organization) {
		throw errors.FORBIDDEN({ message: 'Organization context required for idempotent operations' });
	}

	const organizationId = context.organization.id;

	// Check for existing response
	const check = await checkIdempotencyKey(key, organizationId, errors);
	if (!check.isNew && check.cachedResponse !== undefined) {
		return {
			result: check.cachedResponse as T,
			fromCache: true
		};
	}

	// Reserve the key
	await reserveIdempotencyKey(key, organizationId, errors);

	try {
		// Execute the operation
		const result = await operation();

		// Store the response
		await storeIdempotencyResponse(key, organizationId, result, 200);

		return { result, fromCache: false };
	} catch (error: any) {
		// Store error response if it's an error object with a code
		if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
			const statusMap: Record<string, number> = {
				BAD_REQUEST: 400,
				UNAUTHORIZED: 401,
				FORBIDDEN: 403,
				NOT_FOUND: 404,
				CONFLICT: 409,
				INTERNAL_SERVER_ERROR: 500,
				TIMEOUT: 408,
				PRECONDITION_FAILED: 412,
				PAYLOAD_TOO_LARGE: 413,
				UNSUPPORTED_MEDIA_TYPE: 415,
				UNPROCESSABLE_CONTENT: 422,
				TOO_MANY_REQUESTS: 429,
				CLIENT_CLOSED_REQUEST: 499
			};
			const statusCode = statusMap[error.code] ?? 500;

			await storeIdempotencyResponse(
				key,
				organizationId,
				{
					error: {
						code: error.code,
						message: error.message,
						data: error.data,
						type: 'ORPC_ERROR'
					}
				},
				statusCode
			);
		}
		throw error;
	}
}
