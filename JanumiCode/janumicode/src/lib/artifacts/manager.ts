/**
 * Artifact Reference Manager
 * Implements Phase 3.3: Unified Artifact Reference API
 * Provides high-level API for managing all artifact types
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import type { Result, Artifact, ArtifactReference } from '../types';
import { getDatabase } from '../database';
import { writeBlob, readBlobByHash, readBlobById } from './blobStorage';
import {
	createFileReference,
	getFileReference,
	findFileReferencesByPath,
} from './fileTracking';
import {
	getGitRepoInfo,
	getGitFileInfo,
	getCurrentCommitHash,
	isGitRepository,
} from './gitIntegration';
import { computeHash, createBlobReference } from './hash';

/**
 * Store artifact options
 */
export interface StoreArtifactOptions {
	/** Artifact type */
	type: 'blob' | 'file' | 'evidence';
	/** Content (for blob or evidence) */
	content?: string | Buffer;
	/** File path (for file type) */
	filePath?: string;
	/** Workspace root (for file type) */
	workspaceRoot?: string;
	/** MIME type */
	mimeType: string;
	/** Metadata */
	metadata?: Record<string, unknown>;
	/** Evidence source URL (for evidence type) */
	sourceUrl?: string;
	/** Related claim IDs */
	relatedClaims?: string[];
	/** Related verdict ID */
	relatedVerdict?: string;
}

/**
 * Artifact with references
 */
export interface ArtifactWithReferences {
	artifact?: Artifact;
	reference: ArtifactReference;
	contentRef: string;
}

/**
 * Store artifact (unified API)
 * @param options Store options
 * @returns Result containing artifact with references
 */
export async function storeArtifact(
	options: StoreArtifactOptions
): Promise<Result<ArtifactWithReferences>> {
	try {
		switch (options.type) {
			case 'blob':
				return await storeBlobArtifact(options);
			case 'file':
				return await storeFileArtifact(options);
			case 'evidence':
				return await storeEvidenceArtifact(options);
			default:
				return {
					success: false,
					error: new Error(`Unknown artifact type: ${options.type}`),
				};
		}
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to store artifact'),
		};
	}
}

/**
 * Store blob artifact
 */
async function storeBlobArtifact(
	options: StoreArtifactOptions
): Promise<Result<ArtifactWithReferences>> {
	if (!options.content) {
		return {
			success: false,
			error: new Error('Content required for blob artifact'),
		};
	}

	// Write blob
	const blobResult = writeBlob(options.content, {
		mimeType: options.mimeType,
	});

	if (!blobResult.success) {
		return {
			success: false,
			error: blobResult.error,
		};
	}

	const blob = blobResult.value;

	// Create artifact reference
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	const referenceId = randomUUID();
	const metadata = {
		...(options.metadata || {}),
		relatedClaims: options.relatedClaims || [],
		relatedVerdict: options.relatedVerdict || null,
	};

	db.prepare(
		`
		INSERT INTO artifact_references (
			reference_id,
			artifact_type,
			content_hash,
			metadata,
			created_at
		) VALUES (?, ?, ?, ?, ?)
	`
	).run(
		referenceId,
		'BLOB',
		blob.content_hash,
		JSON.stringify(metadata),
		new Date().toISOString()
	);

	const reference = db
		.prepare(
			`
		SELECT reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at
		FROM artifact_references
		WHERE reference_id = ?
	`
		)
		.get(referenceId) as ArtifactReference;

	return {
		success: true,
		value: {
			artifact: blob,
			reference,
			contentRef: createBlobReference(blob.content_hash),
		},
	};
}

/**
 * Store file artifact
 */
async function storeFileArtifact(
	options: StoreArtifactOptions
): Promise<Result<ArtifactWithReferences>> {
	if (!options.filePath || !options.workspaceRoot) {
		return {
			success: false,
			error: new Error('filePath and workspaceRoot required for file artifact'),
		};
	}

	// Get Git info if available
	let gitCommit: string | null = null;
	const isGitRepoResult = await isGitRepository(options.workspaceRoot);
	if (isGitRepoResult.success && isGitRepoResult.value) {
		const gitInfoResult = await getGitFileInfo(
			options.filePath,
			options.workspaceRoot
		);
		if (gitInfoResult.success && gitInfoResult.value) {
			gitCommit = gitInfoResult.value.commit;
		}
	}

	// Create file reference
	const fileRefResult = await createFileReference({
		filePath: options.filePath,
		workspaceRoot: options.workspaceRoot,
		gitCommit: gitCommit || undefined,
		metadata: {
			...(options.metadata || {}),
			relatedClaims: options.relatedClaims || [],
			relatedVerdict: options.relatedVerdict || null,
		},
		snapshotContent: true,
	});

	if (!fileRefResult.success) {
		return {
			success: false,
			error: fileRefResult.error,
		};
	}

	const reference = fileRefResult.value;

	return {
		success: true,
		value: {
			reference,
			contentRef: `file://${reference.file_path}`,
		},
	};
}

/**
 * Store evidence artifact
 */
async function storeEvidenceArtifact(
	options: StoreArtifactOptions
): Promise<Result<ArtifactWithReferences>> {
	if (!options.content || !options.sourceUrl) {
		return {
			success: false,
			error: new Error('content and sourceUrl required for evidence artifact'),
		};
	}

	// Write evidence content as blob
	const blobResult = writeBlob(options.content, {
		mimeType: options.mimeType,
	});

	if (!blobResult.success) {
		return {
			success: false,
			error: blobResult.error,
		};
	}

	const blob = blobResult.value;

	// Create artifact reference for evidence
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	const referenceId = randomUUID();
	const metadata = {
		...(options.metadata || {}),
		sourceUrl: options.sourceUrl,
		retrievedAt: new Date().toISOString(),
		relatedClaims: options.relatedClaims || [],
		relatedVerdict: options.relatedVerdict || null,
	};

	db.prepare(
		`
		INSERT INTO artifact_references (
			reference_id,
			artifact_type,
			content_hash,
			metadata,
			created_at
		) VALUES (?, ?, ?, ?, ?)
	`
	).run(
		referenceId,
		'EVIDENCE',
		blob.content_hash,
		JSON.stringify(metadata),
		new Date().toISOString()
	);

	const reference = db
		.prepare(
			`
		SELECT reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at
		FROM artifact_references
		WHERE reference_id = ?
	`
		)
		.get(referenceId) as ArtifactReference;

	return {
		success: true,
		value: {
			artifact: blob,
			reference,
			contentRef: `evidence://${reference.reference_id}`,
		},
	};
}

/**
 * Retrieve artifact by reference
 * @param contentRef Content reference (blob://, file://, evidence://)
 * @param workspaceRoot Optional workspace root (for file references)
 * @returns Result containing artifact content
 */
export async function retrieveArtifact(
	contentRef: string,
	workspaceRoot?: string
): Promise<Result<{ content: string | Buffer; mimeType: string }>> {
	try {
		if (contentRef.startsWith('blob://')) {
			// Blob reference
			const hash = contentRef.substring(7);
			const blobResult = readBlobByHash(hash);

			if (!blobResult.success) {
				return {
					success: false,
					error: blobResult.error,
				};
			}

			if (!blobResult.value) {
				return {
					success: false,
					error: new Error('Blob not found'),
				};
			}

			return {
				success: true,
				value: {
					content: blobResult.value.content,
					mimeType: blobResult.value.mime_type,
				},
			};
		} else if (contentRef.startsWith('file://')) {
			// File reference
			const filePath = contentRef.substring(7);

			if (!workspaceRoot) {
				return {
					success: false,
					error: new Error('workspaceRoot required for file references'),
				};
			}

			const absolutePath = `${workspaceRoot}/${filePath}`;
			const content = await fs.readFile(absolutePath);

			return {
				success: true,
				value: {
					content,
					mimeType: 'application/octet-stream', // TODO: Detect MIME type
				},
			};
		} else if (contentRef.startsWith('evidence://')) {
			// Evidence reference
			const referenceId = contentRef.substring(11);

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
				SELECT content_hash
				FROM artifact_references
				WHERE reference_id = ? AND artifact_type = 'EVIDENCE'
			`
				)
				.get(referenceId) as { content_hash: string } | undefined;

			if (!reference || !reference.content_hash) {
				return {
					success: false,
					error: new Error('Evidence reference not found'),
				};
			}

			const blobResult = readBlobByHash(reference.content_hash);

			if (!blobResult.success) {
				return {
					success: false,
					error: blobResult.error,
				};
			}

			if (!blobResult.value) {
				return {
					success: false,
					error: new Error('Evidence blob not found'),
				};
			}

			return {
				success: true,
				value: {
					content: blobResult.value.content,
					mimeType: blobResult.value.mime_type,
				},
			};
		} else {
			return {
				success: false,
				error: new Error(`Unknown content reference format: ${contentRef}`),
			};
		}
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve artifact'),
		};
	}
}

/**
 * Find artifacts by claim ID
 * @param claimId Claim UUID
 * @returns Result containing array of artifact references
 */
export function findArtifactsByClaim(
	claimId: string
): Result<ArtifactReference[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Query artifacts where metadata contains the claim ID
		const references = db
			.prepare(
				`
			SELECT reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at
			FROM artifact_references
			WHERE metadata LIKE ?
			ORDER BY created_at DESC
		`
			)
			.all(`%"${claimId}"%`) as ArtifactReference[];

		// Filter to only those that actually have the claim ID in relatedClaims
		const filtered = references.filter((ref) => {
			try {
				const metadata = JSON.parse(ref.metadata);
				return (
					Array.isArray(metadata.relatedClaims) &&
					metadata.relatedClaims.includes(claimId)
				);
			} catch {
				return false;
			}
		});

		return { success: true, value: filtered };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to find artifacts by claim'),
		};
	}
}

/**
 * Find artifacts by verdict ID
 * @param verdictId Verdict UUID
 * @returns Result containing array of artifact references
 */
export function findArtifactsByVerdict(
	verdictId: string
): Result<ArtifactReference[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Query artifacts where metadata contains the verdict ID
		const references = db
			.prepare(
				`
			SELECT reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at
			FROM artifact_references
			WHERE metadata LIKE ?
			ORDER BY created_at DESC
		`
			)
			.all(`%"${verdictId}"%`) as ArtifactReference[];

		// Filter to only those that actually have the verdict ID
		const filtered = references.filter((ref) => {
			try {
				const metadata = JSON.parse(ref.metadata);
				return metadata.relatedVerdict === verdictId;
			} catch {
				return false;
			}
		});

		return { success: true, value: filtered };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to find artifacts by verdict'),
		};
	}
}

/**
 * Link artifact to claim
 * @param referenceId Artifact reference ID
 * @param claimId Claim ID
 * @returns Result indicating success
 */
export function linkArtifactToClaim(
	referenceId: string,
	claimId: string
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
		const reference = db
			.prepare(
				`
			SELECT metadata
			FROM artifact_references
			WHERE reference_id = ?
		`
			)
			.get(referenceId) as { metadata: string } | undefined;

		if (!reference) {
			return {
				success: false,
				error: new Error('Artifact reference not found'),
			};
		}

		const metadata = JSON.parse(reference.metadata);
		if (!Array.isArray(metadata.relatedClaims)) {
			metadata.relatedClaims = [];
		}

		// Add claim if not already present
		if (!metadata.relatedClaims.includes(claimId)) {
			metadata.relatedClaims.push(claimId);

			// Update metadata
			db.prepare(
				`
				UPDATE artifact_references
				SET metadata = ?
				WHERE reference_id = ?
			`
			).run(JSON.stringify(metadata), referenceId);
		}

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to link artifact to claim'),
		};
	}
}
