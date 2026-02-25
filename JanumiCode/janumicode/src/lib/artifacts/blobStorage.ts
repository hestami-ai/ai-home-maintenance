/**
 * Blob Storage Module
 * Implements Phase 3.1: Content-Addressed Blob Storage
 * Handles reading/writing content-addressed blobs to SQLite
 */

import { randomUUID } from 'node:crypto';
import type { Result, Artifact } from '../types';
import { getDatabase } from '../database';
import { computeHash, createBlobReference, parseBlobReference } from './hash';

/**
 * Blob write options
 */
export interface BlobWriteOptions {
	/** MIME type of the content */
	mimeType: string;
	/** Optional artifact ID (auto-generated if not provided) */
	artifactId?: string;
}

/**
 * Write blob to storage
 * Implements automatic deduplication via content hashing
 * @param content Blob content (string or Buffer)
 * @param options Write options (MIME type, optional ID)
 * @returns Result containing artifact with content hash
 */
export function writeBlob(
	content: string | Buffer,
	options: BlobWriteOptions
): Result<Artifact> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Compute content hash for deduplication
		const contentHash = computeHash(content);

		// Check if blob already exists (deduplication)
		const existing = db
			.prepare(
				`
			SELECT artifact_id, content_hash, mime_type, size, created_at
			FROM artifacts
			WHERE content_hash = ?
		`
			)
			.get(contentHash) as
			| {
					artifact_id: string;
					content_hash: string;
					mime_type: string;
					size: number;
					created_at: string;
			  }
			| undefined;

		if (existing) {
			// Return existing artifact (deduplication)
			// Convert content to Buffer if it's a string
			const contentBuffer = Buffer.isBuffer(content)
				? content
				: Buffer.from(content);

			return {
				success: true,
				value: {
					artifact_id: existing.artifact_id,
					content_hash: existing.content_hash,
					content: contentBuffer,
					mime_type: existing.mime_type,
					size: existing.size,
					created_at: existing.created_at,
				},
			};
		}

		// Create new artifact
		const artifactId = options.artifactId || randomUUID();
		const size = Buffer.isBuffer(content)
			? content.length
			: Buffer.byteLength(content);
		const createdAt = new Date().toISOString();

		// Insert blob into database
		db.prepare(
			`
			INSERT INTO artifacts (artifact_id, content_hash, content, mime_type, size, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`
		).run(
			artifactId,
			contentHash,
			content,
			options.mimeType,
			size,
			createdAt
		);

		// Convert content to Buffer if it's a string
		const contentBuffer = Buffer.isBuffer(content)
			? content
			: Buffer.from(content);

		return {
			success: true,
			value: {
				artifact_id: artifactId,
				content_hash: contentHash,
				content: contentBuffer,
				mime_type: options.mimeType,
				size,
				created_at: createdAt,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write blob'),
		};
	}
}

/**
 * Read blob by content hash
 * @param contentHash SHA-256 hash of content
 * @returns Result containing artifact or error
 */
export function readBlobByHash(
	contentHash: string
): Result<Artifact | null> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const artifact = db
			.prepare(
				`
			SELECT artifact_id, content_hash, content, mime_type, size, created_at
			FROM artifacts
			WHERE content_hash = ?
		`
			)
			.get(contentHash) as
			| {
					artifact_id: string;
					content_hash: string;
					content: Buffer;
					mime_type: string;
					size: number;
					created_at: string;
			  }
			| undefined;

		if (!artifact) {
			return { success: true, value: null };
		}

		return {
			success: true,
			value: artifact,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to read blob by hash'),
		};
	}
}

/**
 * Read blob by artifact ID
 * @param artifactId Artifact UUID
 * @returns Result containing artifact or error
 */
export function readBlobById(
	artifactId: string
): Result<Artifact | null> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const artifact = db
			.prepare(
				`
			SELECT artifact_id, content_hash, content, mime_type, size, created_at
			FROM artifacts
			WHERE artifact_id = ?
		`
			)
			.get(artifactId) as
			| {
					artifact_id: string;
					content_hash: string;
					content: Buffer;
					mime_type: string;
					size: number;
					created_at: string;
			  }
			| undefined;

		if (!artifact) {
			return { success: true, value: null };
		}

		return {
			success: true,
			value: artifact,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to read blob by ID'),
		};
	}
}

/**
 * Read blob by blob reference (blob://hash)
 * @param blobRef Blob reference
 * @returns Result containing artifact or error
 */
export function readBlobByReference(
	blobRef: string
): Result<Artifact | null> {
	const hashResult = parseBlobReference(blobRef);
	if (!hashResult.success) {
		return {
			success: false,
			error: hashResult.error,
		};
	}

	return readBlobByHash(hashResult.value);
}

/**
 * Check if blob exists by content hash
 * @param contentHash SHA-256 hash
 * @returns Result indicating if blob exists
 */
export function blobExists(contentHash: string): Result<boolean> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const result = db
			.prepare(
				`
			SELECT 1 FROM artifacts WHERE content_hash = ?
		`
			)
			.get(contentHash);

		return { success: true, value: result !== undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to check blob existence'),
		};
	}
}

/**
 * Get blob metadata without retrieving content
 * @param contentHash SHA-256 hash
 * @returns Result containing metadata or error
 */
export function getBlobMetadata(contentHash: string): Result<{
	artifact_id: string;
	content_hash: string;
	mime_type: string;
	size: number;
	created_at: string;
} | null> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const metadata = db
			.prepare(
				`
			SELECT artifact_id, content_hash, mime_type, size, created_at
			FROM artifacts
			WHERE content_hash = ?
		`
			)
			.get(contentHash) as
			| {
					artifact_id: string;
					content_hash: string;
					mime_type: string;
					size: number;
					created_at: string;
			  }
			| undefined;

		if (!metadata) {
			return { success: true, value: null };
		}

		return { success: true, value: metadata };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get blob metadata'),
		};
	}
}

/**
 * List all blobs (for garbage collection analysis)
 * @param limit Optional limit (default: 100)
 * @param offset Optional offset (default: 0)
 * @returns Result containing array of blob metadata
 */
export function listBlobs(
	limit = 100,
	offset = 0
): Result<
	Array<{
		artifact_id: string;
		content_hash: string;
		mime_type: string;
		size: number;
		created_at: string;
	}>
> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const blobs = db
			.prepare(
				`
			SELECT artifact_id, content_hash, mime_type, size, created_at
			FROM artifacts
			ORDER BY created_at DESC
			LIMIT ? OFFSET ?
		`
			)
			.all(limit, offset) as Array<{
			artifact_id: string;
			content_hash: string;
			mime_type: string;
			size: number;
			created_at: string;
		}>;

		return { success: true, value: blobs };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to list blobs'),
		};
	}
}

/**
 * Delete blob by artifact ID
 * WARNING: Only use for garbage collection. Ensure no references exist.
 * @param artifactId Artifact UUID
 * @returns Result indicating success
 */
export function deleteBlob(artifactId: string): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// TODO: Add check for artifact_references before deletion
		const info = db
			.prepare(
				`
			DELETE FROM artifacts WHERE artifact_id = ?
		`
			)
			.run(artifactId);

		if (info.changes === 0) {
			return {
				success: false,
				error: new Error('Artifact not found'),
			};
		}

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to delete blob'),
		};
	}
}

/**
 * Get total storage size used by blobs
 * @returns Result containing total size in bytes
 */
export function getTotalBlobSize(): Result<number> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const result = db
			.prepare(
				`
			SELECT COALESCE(SUM(size), 0) as total_size
			FROM artifacts
		`
			)
			.get() as { total_size: number };

		return { success: true, value: result.total_size };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get total blob size'),
		};
	}
}

/**
 * Get blob count
 * @returns Result containing total number of blobs
 */
export function getBlobCount(): Result<number> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const result = db
			.prepare(
				`
			SELECT COUNT(*) as count
			FROM artifacts
		`
			)
			.get() as { count: number };

		return { success: true, value: result.count };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get blob count'),
		};
	}
}
