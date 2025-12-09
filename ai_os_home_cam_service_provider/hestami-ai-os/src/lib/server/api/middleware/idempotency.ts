import { prisma } from '../../db.js';
import { ApiException, ErrorCode, ErrorType } from '../errors.js';
import type { RequestContext } from '../context.js';

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
	organizationId: string
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
	throw new ApiException(
		ErrorCode.IDEMPOTENCY_CONFLICT,
		ErrorType.CONFLICT,
		409,
		'Request with this idempotency key is already in progress',
		undefined,
		undefined,
		true
	);
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
	organizationId: string
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
		const result = await checkIdempotencyKey(key, organizationId);
		if (!result.isNew) {
			throw new ApiException(
				ErrorCode.IDEMPOTENCY_CONFLICT,
				ErrorType.CONFLICT,
				409,
				'Duplicate request detected',
				undefined,
				undefined,
				false
			);
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
	operation: () => Promise<T>
): Promise<{ result: T; fromCache: boolean }> {
	if (!context.organization) {
		throw ApiException.forbidden('Organization context required for idempotent operations');
	}

	const organizationId = context.organization.id;

	// Check for existing response
	const check = await checkIdempotencyKey(key, organizationId);
	if (!check.isNew && check.cachedResponse !== undefined) {
		return {
			result: check.cachedResponse as T,
			fromCache: true
		};
	}

	// Reserve the key
	await reserveIdempotencyKey(key, organizationId);

	try {
		// Execute the operation
		const result = await operation();

		// Store the response
		await storeIdempotencyResponse(key, organizationId, result, 200);

		return { result, fromCache: false };
	} catch (error) {
		// Store error response if it's an ApiException
		if (error instanceof ApiException) {
			await storeIdempotencyResponse(
				key,
				organizationId,
				{ error: error.toApiError() },
				error.httpStatus
			);
		}
		throw error;
	}
}
