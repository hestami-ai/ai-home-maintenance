/**
 * Content Hashing Utilities
 * Implements Phase 3.1: Content-Addressed Blob Storage (SHA-256 hashing)
 * Provides cryptographic content hashing for artifact deduplication
 */

import { createHash } from 'node:crypto';
import type { Result } from '../types';

/**
 * Compute SHA-256 hash of content
 * @param content Content to hash (string or Buffer)
 * @returns Hex-encoded SHA-256 hash
 */
export function computeHash(content: string | Buffer): string {
	const hash = createHash('sha256');
	hash.update(content);
	return hash.digest('hex');
}

/**
 * Compute SHA-256 hash of content with Result wrapper
 * @param content Content to hash
 * @returns Result containing hash or error
 */
export function computeHashSafe(
	content: string | Buffer
): Result<string> {
	try {
		const hash = computeHash(content);
		return { success: true, value: hash };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to compute hash'),
		};
	}
}

/**
 * Verify content matches expected hash
 * @param content Content to verify
 * @param expectedHash Expected SHA-256 hash
 * @returns True if content matches hash
 */
export function verifyHash(
	content: string | Buffer,
	expectedHash: string
): boolean {
	const actualHash = computeHash(content);
	return actualHash === expectedHash;
}

/**
 * Verify content matches expected hash with Result wrapper
 * @param content Content to verify
 * @param expectedHash Expected SHA-256 hash
 * @returns Result indicating if hash matches
 */
export function verifyHashSafe(
	content: string | Buffer,
	expectedHash: string
): Result<boolean> {
	try {
		const matches = verifyHash(content, expectedHash);
		return { success: true, value: matches };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to verify hash'),
		};
	}
}

/**
 * Compute hash from file path
 * @param filePath Path to file
 * @returns Result containing hash or error
 */
export async function computeFileHash(
	filePath: string
): Promise<Result<string>> {
	try {
		const fs = await import('node:fs/promises');
		const content = await fs.readFile(filePath);
		const hash = computeHash(content);
		return { success: true, value: hash };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to compute file hash'),
		};
	}
}

/**
 * Create content reference from hash
 * @param hash SHA-256 hash
 * @returns Content reference in blob:// format
 */
export function createBlobReference(hash: string): string {
	return `blob://${hash}`;
}

/**
 * Parse blob reference to extract hash
 * @param blobRef Blob reference (blob://hash)
 * @returns Result containing hash or error
 */
export function parseBlobReference(
	blobRef: string
): Result<string> {
	try {
		if (!blobRef.startsWith('blob://')) {
			return {
				success: false,
				error: new Error('Invalid blob reference format'),
			};
		}

		const hash = blobRef.substring(7);

		// Validate hash format (64 hex characters)
		if (!/^[0-9a-f]{64}$/i.test(hash)) {
			return {
				success: false,
				error: new Error('Invalid SHA-256 hash format'),
			};
		}

		return { success: true, value: hash };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to parse blob reference'),
		};
	}
}

/**
 * Compute hash of JSON object (stable serialization)
 * @param obj Object to hash
 * @returns SHA-256 hash of object
 */
export function computeObjectHash(obj: unknown): string {
	// Use JSON.stringify with sorted keys for stable hashing
	const json = JSON.stringify(obj, Object.keys(obj as object).sort());
	return computeHash(json);
}

/**
 * Compute truncated hash for display
 * @param hash Full SHA-256 hash
 * @param length Number of characters to keep (default: 8)
 * @returns Truncated hash
 */
export function truncateHash(hash: string, length = 8): string {
	return hash.substring(0, length);
}
