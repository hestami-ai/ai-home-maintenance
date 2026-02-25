/**
 * File System Artifact Tracking
 * Implements Phase 3.2: File System Artifact Tracking
 * Tracks workspace files with Git integration and content snapshots
 */

import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Result, ArtifactReference } from '../types';
import { ArtifactType } from '../types';
import { getDatabase } from '../database';
import { computeFileHash } from './hash';

/**
 * File reference options
 */
export interface FileReferenceOptions {
	/** Absolute file path */
	filePath: string;
	/** Workspace root (for computing relative paths) */
	workspaceRoot: string;
	/** Optional Git commit hash */
	gitCommit?: string;
	/** Optional metadata (JSON-serializable) */
	metadata?: Record<string, unknown>;
	/** Whether to snapshot file content (default: true) */
	snapshotContent?: boolean;
}

/**
 * Create file reference
 * @param options File reference options
 * @returns Result containing artifact reference
 */
export async function createFileReference(
	options: FileReferenceOptions
): Promise<Result<ArtifactReference>> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Compute relative path
		const relativePath = path.relative(
			options.workspaceRoot,
			options.filePath
		);

		// Compute content hash if snapshotting
		let contentHash: string | null = null;
		if (options.snapshotContent !== false) {
			const hashResult = await computeFileHash(options.filePath);
			if (!hashResult.success) {
				return {
					success: false,
					error: new Error(
						`Failed to compute file hash: ${hashResult.error.message}`
					),
				};
			}
			contentHash = hashResult.value;
		}

		// Get file stats
		const stats = await fs.stat(options.filePath);
		const metadata = {
			...(options.metadata || {}),
			fileSize: stats.size,
			modifiedAt: stats.mtime.toISOString(),
			relativePath,
		};

		// Create artifact reference
		const referenceId = randomUUID();
		const createdAt = new Date().toISOString();

		db.prepare(
			`
			INSERT INTO artifact_references (
				reference_id,
				artifact_type,
				file_path,
				content_hash,
				git_commit,
				metadata,
				created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			referenceId,
			ArtifactType.FILE,
			relativePath,
			contentHash,
			options.gitCommit || null,
			JSON.stringify(metadata),
			createdAt
		);

		return {
			success: true,
			value: {
				reference_id: referenceId,
				artifact_type: ArtifactType.FILE,
				file_path: relativePath,
				content_hash: contentHash,
				git_commit: options.gitCommit || null,
				metadata: JSON.stringify(metadata),
				created_at: createdAt,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to create file reference'),
		};
	}
}

/**
 * Get file reference by ID
 * @param referenceId Reference UUID
 * @returns Result containing artifact reference or null
 */
export function getFileReference(
	referenceId: string
): Result<ArtifactReference | null> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const reference = db
			.prepare(
				`
			SELECT reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at
			FROM artifact_references
			WHERE reference_id = ? AND artifact_type = ArtifactType.FILE
		`
			)
			.get(referenceId) as ArtifactReference | undefined;

		if (!reference) {
			return { success: true, value: null };
		}

		return { success: true, value: reference };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get file reference'),
		};
	}
}

/**
 * Find file references by path
 * @param filePath Relative file path
 * @returns Result containing array of artifact references
 */
export function findFileReferencesByPath(
	filePath: string
): Result<ArtifactReference[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const references = db
			.prepare(
				`
			SELECT reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at
			FROM artifact_references
			WHERE artifact_type = ArtifactType.FILE AND file_path = ?
			ORDER BY created_at DESC
		`
			)
			.all(filePath) as ArtifactReference[];

		return { success: true, value: references };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to find file references'),
		};
	}
}

/**
 * Find file references by Git commit
 * @param gitCommit Git commit hash
 * @returns Result containing array of artifact references
 */
export function findFileReferencesByCommit(
	gitCommit: string
): Result<ArtifactReference[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const references = db
			.prepare(
				`
			SELECT reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at
			FROM artifact_references
			WHERE artifact_type = ArtifactType.FILE AND git_commit = ?
			ORDER BY created_at DESC
		`
			)
			.all(gitCommit) as ArtifactReference[];

		return { success: true, value: references };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to find file references by commit'),
		};
	}
}

/**
 * Update file reference metadata
 * @param referenceId Reference UUID
 * @param metadata New metadata (merged with existing)
 * @returns Result indicating success
 */
export function updateFileReferenceMetadata(
	referenceId: string,
	metadata: Record<string, unknown>
): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Get existing metadata
		const existing = db
			.prepare(
				`
			SELECT metadata FROM artifact_references WHERE reference_id = ?
		`
			)
			.get(referenceId) as { metadata: string } | undefined;

		if (!existing) {
			return {
				success: false,
				error: new Error('File reference not found'),
			};
		}

		// Merge metadata
		const existingMetadata = JSON.parse(existing.metadata);
		const mergedMetadata = { ...existingMetadata, ...metadata };

		// Update
		db.prepare(
			`
			UPDATE artifact_references
			SET metadata = ?
			WHERE reference_id = ?
		`
		).run(JSON.stringify(mergedMetadata), referenceId);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to update file reference metadata'),
		};
	}
}

/**
 * List all file references
 * @param limit Optional limit (default: 100)
 * @param offset Optional offset (default: 0)
 * @returns Result containing array of artifact references
 */
export function listFileReferences(
	limit = 100,
	offset = 0
): Result<ArtifactReference[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const references = db
			.prepare(
				`
			SELECT reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at
			FROM artifact_references
			WHERE artifact_type = ArtifactType.FILE
			ORDER BY created_at DESC
			LIMIT ? OFFSET ?
		`
			)
			.all(limit, offset) as ArtifactReference[];

		return { success: true, value: references };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to list file references'),
		};
	}
}

/**
 * Delete file reference
 * @param referenceId Reference UUID
 * @returns Result indicating success
 */
export function deleteFileReference(
	referenceId: string
): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const info = db
			.prepare(
				`
			DELETE FROM artifact_references
			WHERE reference_id = ? AND artifact_type = ArtifactType.FILE
		`
			)
			.run(referenceId);

		if (info.changes === 0) {
			return {
				success: false,
				error: new Error('File reference not found'),
			};
		}

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to delete file reference'),
		};
	}
}

/**
 * Check if file has been modified since reference creation
 * @param referenceId Reference UUID
 * @param workspaceRoot Workspace root
 * @returns Result indicating if file was modified
 */
export async function isFileModified(
	referenceId: string,
	workspaceRoot: string
): Promise<Result<boolean>> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Get reference
		const reference = db
			.prepare(
				`
			SELECT file_path, content_hash
			FROM artifact_references
			WHERE reference_id = ? AND artifact_type = ArtifactType.FILE
		`
			)
			.get(referenceId) as
			| { file_path: string; content_hash: string | null }
			| undefined;

		if (!reference) {
			return {
				success: false,
				error: new Error('File reference not found'),
			};
		}

		if (!reference.content_hash) {
			// No content hash stored, can't check modification
			return {
				success: false,
				error: new Error('No content hash available for comparison'),
			};
		}

		// Compute current file hash
		const absolutePath = path.join(workspaceRoot, reference.file_path);
		const hashResult = await computeFileHash(absolutePath);
		if (!hashResult.success) {
			return {
				success: false,
				error: hashResult.error,
			};
		}

		// Compare hashes
		const modified = hashResult.value !== reference.content_hash;
		return { success: true, value: modified };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to check file modification'),
		};
	}
}
