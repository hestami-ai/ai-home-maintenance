/**
 * Artifact Query Interface
 * Implements Phase 3.3: Artifact query capabilities
 * Provides advanced querying for artifacts and references
 */

import type { Result, Artifact, ArtifactReference } from '../types';
import { getDatabase } from '../database';

/**
 * Artifact query filters
 */
export interface ArtifactQueryFilters {
	/** Filter by artifact type */
	artifactType?: 'BLOB' | 'FILE' | 'EVIDENCE';
	/** Filter by MIME type pattern */
	mimeType?: string;
	/** Filter by minimum size (bytes) */
	minSize?: number;
	/** Filter by maximum size (bytes) */
	maxSize?: number;
	/** Filter by date range (from) */
	createdAfter?: string;
	/** Filter by date range (to) */
	createdBefore?: string;
	/** Filter by Git commit */
	gitCommit?: string;
	/** Filter by file path pattern */
	filePathPattern?: string;
	/** Limit results */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

/**
 * Reference query filters
 */
export interface ReferenceQueryFilters {
	/** Filter by artifact type */
	artifactType?: 'BLOB' | 'FILE' | 'EVIDENCE';
	/** Filter by content hash */
	contentHash?: string;
	/** Filter by Git commit */
	gitCommit?: string;
	/** Filter by file path */
	filePath?: string;
	/** Filter by date range (from) */
	createdAfter?: string;
	/** Filter by date range (to) */
	createdBefore?: string;
	/** Limit results */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

/**
 * Query artifacts with filters
 * @param filters Query filters
 * @returns Result containing array of artifacts
 */
export function queryArtifacts(
	filters: ArtifactQueryFilters
): Result<Artifact[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Build query
		const conditions: string[] = [];
		const params: unknown[] = [];

		if (filters.mimeType) {
			conditions.push('mime_type LIKE ?');
			params.push(`%${filters.mimeType}%`);
		}

		if (filters.minSize !== undefined) {
			conditions.push('size >= ?');
			params.push(filters.minSize);
		}

		if (filters.maxSize !== undefined) {
			conditions.push('size <= ?');
			params.push(filters.maxSize);
		}

		if (filters.createdAfter) {
			conditions.push('created_at >= ?');
			params.push(filters.createdAfter);
		}

		if (filters.createdBefore) {
			conditions.push('created_at <= ?');
			params.push(filters.createdBefore);
		}

		const whereClause =
			conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		const limit = filters.limit || 100;
		const offset = filters.offset || 0;

		params.push(limit, offset);

		const query = `
			SELECT artifact_id, content_hash, content, mime_type, size, created_at
			FROM artifacts
			${whereClause}
			ORDER BY created_at DESC
			LIMIT ? OFFSET ?
		`;

		const artifacts = db.prepare(query).all(...params) as Artifact[];

		return { success: true, value: artifacts };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to query artifacts'),
		};
	}
}

/**
 * Query artifact references with filters
 * @param filters Query filters
 * @returns Result containing array of artifact references
 */
export function queryArtifactReferences(
	filters: ReferenceQueryFilters
): Result<ArtifactReference[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Build query
		const conditions: string[] = [];
		const params: unknown[] = [];

		if (filters.artifactType) {
			conditions.push('artifact_type = ?');
			params.push(filters.artifactType);
		}

		if (filters.contentHash) {
			conditions.push('content_hash = ?');
			params.push(filters.contentHash);
		}

		if (filters.gitCommit) {
			conditions.push('git_commit = ?');
			params.push(filters.gitCommit);
		}

		if (filters.filePath) {
			conditions.push('file_path LIKE ?');
			params.push(`%${filters.filePath}%`);
		}

		if (filters.createdAfter) {
			conditions.push('created_at >= ?');
			params.push(filters.createdAfter);
		}

		if (filters.createdBefore) {
			conditions.push('created_at <= ?');
			params.push(filters.createdBefore);
		}

		const whereClause =
			conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		const limit = filters.limit || 100;
		const offset = filters.offset || 0;

		params.push(limit, offset);

		const query = `
			SELECT reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at
			FROM artifact_references
			${whereClause}
			ORDER BY created_at DESC
			LIMIT ? OFFSET ?
		`;

		const references = db.prepare(query).all(...params) as ArtifactReference[];

		return { success: true, value: references };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to query artifact references'),
		};
	}
}

/**
 * Get artifact statistics
 * @returns Result containing statistics
 */
export function getArtifactStatistics(): Result<{
	totalArtifacts: number;
	totalReferences: number;
	totalSize: number;
	artifactsByType: Record<string, number>;
	referencesByType: Record<string, number>;
}> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Total artifacts
		const totalArtifacts = (
			db.prepare('SELECT COUNT(*) as count FROM artifacts').get() as {
				count: number;
			}
		).count;

		// Total references
		const totalReferences = (
			db
				.prepare('SELECT COUNT(*) as count FROM artifact_references')
				.get() as { count: number }
		).count;

		// Total size
		const totalSize = (
			db
				.prepare('SELECT COALESCE(SUM(size), 0) as total FROM artifacts')
				.get() as { total: number }
		).total;

		// Artifacts by MIME type
		const artifactsByType: Record<string, number> = {};
		const artifactTypeRows = db
			.prepare(
				'SELECT mime_type, COUNT(*) as count FROM artifacts GROUP BY mime_type'
			)
			.all() as Array<{ mime_type: string; count: number }>;

		for (const row of artifactTypeRows) {
			artifactsByType[row.mime_type] = row.count;
		}

		// References by type
		const referencesByType: Record<string, number> = {};
		const referenceTypeRows = db
			.prepare(
				'SELECT artifact_type, COUNT(*) as count FROM artifact_references GROUP BY artifact_type'
			)
			.all() as Array<{ artifact_type: string; count: number }>;

		for (const row of referenceTypeRows) {
			referencesByType[row.artifact_type] = row.count;
		}

		return {
			success: true,
			value: {
				totalArtifacts,
				totalReferences,
				totalSize,
				artifactsByType,
				referencesByType,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get artifact statistics'),
		};
	}
}

/**
 * Find duplicate artifacts (same content hash)
 * @returns Result containing array of duplicate groups
 */
export function findDuplicateArtifacts(): Result<
	Array<{
		contentHash: string;
		count: number;
		totalSize: number;
		artifactIds: string[];
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

		// Find content hashes with multiple artifacts
		const duplicates = db
			.prepare(
				`
			SELECT content_hash, COUNT(*) as count, SUM(size) as total_size
			FROM artifacts
			GROUP BY content_hash
			HAVING COUNT(*) > 1
			ORDER BY count DESC
		`
			)
			.all() as Array<{
			content_hash: string;
			count: number;
			total_size: number;
		}>;

		const result = duplicates.map((dup) => {
			// Get artifact IDs for this hash
			const artifacts = db
				.prepare(
					`
				SELECT artifact_id
				FROM artifacts
				WHERE content_hash = ?
			`
				)
				.all(dup.content_hash) as Array<{ artifact_id: string }>;

			return {
				contentHash: dup.content_hash,
				count: dup.count,
				totalSize: dup.total_size,
				artifactIds: artifacts.map((a) => a.artifact_id),
			};
		});

		return { success: true, value: result };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to find duplicate artifacts'),
		};
	}
}

/**
 * Find orphaned artifacts (no references)
 * @returns Result containing array of orphaned artifact IDs
 */
export function findOrphanedArtifacts(): Result<string[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Find artifacts that have no references
		const orphans = db
			.prepare(
				`
			SELECT a.artifact_id
			FROM artifacts a
			LEFT JOIN artifact_references r ON a.content_hash = r.content_hash
			WHERE r.reference_id IS NULL
		`
			)
			.all() as Array<{ artifact_id: string }>;

		return {
			success: true,
			value: orphans.map((o) => o.artifact_id),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to find orphaned artifacts'),
		};
	}
}

/**
 * Get recent artifacts
 * @param limit Number of results (default: 10)
 * @returns Result containing array of recent artifacts
 */
export function getRecentArtifacts(limit = 10): Result<Artifact[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const artifacts = db
			.prepare(
				`
			SELECT artifact_id, content_hash, content, mime_type, size, created_at
			FROM artifacts
			ORDER BY created_at DESC
			LIMIT ?
		`
			)
			.all(limit) as Artifact[];

		return { success: true, value: artifacts };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get recent artifacts'),
		};
	}
}

/**
 * Get recent artifact references
 * @param limit Number of results (default: 10)
 * @returns Result containing array of recent references
 */
export function getRecentArtifactReferences(
	limit = 10
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
			ORDER BY created_at DESC
			LIMIT ?
		`
			)
			.all(limit) as ArtifactReference[];

		return { success: true, value: references };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get recent artifact references'),
		};
	}
}

/**
 * Get artifact by ID
 * @param artifactId Artifact ID
 * @returns Result containing artifact
 */
export function getArtifact(artifactId: string): Result<Artifact> {
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
			.get(artifactId) as Artifact | undefined;

		if (!artifact) {
			return {
				success: false,
				error: new Error(`Artifact not found: ${artifactId}`),
			};
		}

		return { success: true, value: artifact };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to get artifact'),
		};
	}
}

/**
 * Get all artifacts for dialogue
 * @param dialogueId Dialogue ID
 * @returns Result containing array of artifacts
 */
export function getAllArtifacts(dialogueId: string): Result<Artifact[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Query artifacts that are associated with the dialogue
		// This assumes artifacts have metadata with dialogueId
		// If the schema is different, this query would need adjustment
		const artifacts = db
			.prepare(
				`
			SELECT artifact_id, content_hash, content, mime_type, size, created_at
			FROM artifacts
			WHERE artifact_id IN (
				SELECT artifact_id
				FROM artifact_references
				WHERE metadata LIKE ?
			)
			ORDER BY created_at DESC
		`
			)
			.all(`%"dialogueId":"${dialogueId}"%`) as Artifact[];

		return { success: true, value: artifacts };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get artifacts'),
		};
	}
}
