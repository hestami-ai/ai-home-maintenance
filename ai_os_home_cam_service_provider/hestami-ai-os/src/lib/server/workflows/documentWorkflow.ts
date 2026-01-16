/**
 * Document Workflow (v1)
 *
 * DBOS durable workflow for document management operations.
 * Handles: create, update, version management, category changes, context bindings.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import {
	DocumentCategory,
	DocumentContextType,
	DocumentVisibility,
	DocumentStatus,
	StorageProvider,
	type EntityWorkflowResult
} from './schemas.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { notificationWorkflow_v1, NotificationAction } from './notificationWorkflow.js';
import { NotificationCategory, NotificationType } from './schemas.js';
import {
	processingStartedCounter,
	processingCompletedCounter,
	processingFailedCounter,
	processingInfectedCounter,
	processingDurationHistogram
} from '../metrics.js';

// Action types for document operations
export const DocumentAction = {
	CREATE_DOCUMENT: 'CREATE_DOCUMENT',
	CREATE_DOCUMENT_METADATA: 'CREATE_DOCUMENT_METADATA',
	UPDATE_DOCUMENT: 'UPDATE_DOCUMENT',
	UPDATE_EXTRACTED_METADATA: 'UPDATE_EXTRACTED_METADATA',
	CREATE_VERSION: 'CREATE_VERSION',
	RESTORE_VERSION: 'RESTORE_VERSION',
	CHANGE_CATEGORY: 'CHANGE_CATEGORY',
	ADD_CONTEXT_BINDING: 'ADD_CONTEXT_BINDING',
	REMOVE_CONTEXT_BINDING: 'REMOVE_CONTEXT_BINDING',
	ARCHIVE_DOCUMENT: 'ARCHIVE_DOCUMENT',
	RESTORE_DOCUMENT: 'RESTORE_DOCUMENT',
	LOG_DOWNLOAD: 'LOG_DOWNLOAD',
	HANDLE_TUS_HOOK: 'HANDLE_TUS_HOOK'
} as const;

export type DocumentAction = (typeof DocumentAction)[keyof typeof DocumentAction];

export interface DocumentWorkflowInput {
	action: DocumentAction;
	organizationId: string;
	associationId?: string | null; // NEW: Propagate association context (Phase 30)
	userId: string;
	documentId?: string;
	data: {
		title?: string;
		description?: string;
		category?: DocumentCategory;
		visibility?: DocumentVisibility;
		status?: DocumentStatus;
		contextType?: DocumentContextType;
		contextId?: string;
		associationId?: string | null; // NEW: Direct association override
		isPrimary?: boolean;
		fileName?: string;
		fileSize?: number;
		mimeType?: string;
		storageProvider?: string;
		storagePath?: string;
		fileUrl?: string;
		checksum?: string;
		targetVersionId?: string;
		// Extracted metadata fields
		pageCount?: number;
		thumbnailUrl?: string;
		extractedText?: string;
		metadata?: Record<string, unknown>;
		// Archive fields
		archiveReason?: string;
		// Download log fields
		partyId?: string;
		ipAddress?: string;
		userAgent?: string;
		// TUS Hook Data
		tusPayload?: any;
	};
}

export interface DocumentWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

async function createDocument(
	organizationId: string,
	userId: string,
	data: DocumentWorkflowInput['data'],
	log: ReturnType<typeof createWorkflowLogger>,
	workflowAssocId?: string | null
): Promise<string> {
	// Determine association ID priority: data override > workflow context > ASSOCIATION context binding
	let associationId = data.associationId || workflowAssocId || null;
	if (!associationId && data.contextType === DocumentContextType.ASSOCIATION) {
		associationId = data.contextId!;
	}

	return orgTransaction(organizationId, async (tx) => {
		const document = await tx.document.create({
			data: {
				organizationId,
				associationId,
				title: data.title!,
				description: data.description,
				category: data.category!,
				visibility: data.visibility || DocumentVisibility.PRIVATE,
				status: DocumentStatus.ACTIVE,
				fileName: data.fileName!,
				fileSize: data.fileSize!,
				mimeType: data.mimeType!,
				storageProvider: 'LOCAL',
				storagePath: data.storagePath!,
				fileUrl: data.fileUrl!,
				checksum: data.checksum,
				uploadedBy: userId,
				version: 1
			}
		});

		// Create context binding if provided
		if (data.contextType && data.contextId) {
			await tx.documentContextBinding.create({
				data: {
					documentId: document.id,
					contextType: data.contextType,
					contextId: data.contextId,
					isPrimary: true,
					createdBy: userId
				}
			});
		}

		log.info(`CREATE_DOCUMENT document:${document.id} by user ${userId}`);
		return document.id;
	}, { userId, reason: 'CREATE_DOCUMENT' });
}

async function createDocumentMetadata(
	organizationId: string,
	userId: string,
	data: DocumentWorkflowInput['data'],
	log: ReturnType<typeof createWorkflowLogger>,
	workflowAssocId?: string | null
): Promise<string> {
	// Determine association ID priority: data override > workflow context > ASSOCIATION context binding
	let associationId = data.associationId || workflowAssocId || null;
	if (!associationId && data.contextType === DocumentContextType.ASSOCIATION) {
		associationId = data.contextId!;
	}

	return orgTransaction(organizationId, async (tx) => {
		const document = await tx.document.create({
			data: {
				organizationId,
				associationId,
				title: data.title!,
				description: data.description,
				category: data.category!,
				visibility: data.visibility || DocumentVisibility.PRIVATE,
				// For TUS uploads, initial status should be PENDING_UPLOAD (waiting for file upload to complete)
				// Never default to ACTIVE - documents must go through processing pipeline first
				status: data.status || DocumentStatus.PENDING_UPLOAD,
				fileName: data.fileName!,
				fileSize: data.fileSize || 0,
				mimeType: data.mimeType || 'application/octet-stream',
				storageProvider: StorageProvider.S3,
				storagePath: data.storagePath || '',
				fileUrl: data.fileUrl!,
				checksum: data.checksum,
				uploadedBy: userId,
				version: 1
			}
		});

		// Create context binding if provided
		if (data.contextType && data.contextId) {
			await tx.documentContextBinding.create({
				data: {
					documentId: document.id,
					contextType: data.contextType,
					contextId: data.contextId,
					isPrimary: true,
					createdBy: userId
				}
			});
		}

		log.info(`CREATE_DOCUMENT_METADATA document:${document.id} by user ${userId}`);
		return document.id;
	}, { userId, reason: 'CREATE_DOCUMENT_METADATA' });
}

async function updateDocument(
	organizationId: string,
	userId: string,
	documentId: string,
	data: DocumentWorkflowInput['data'],
	log: ReturnType<typeof createWorkflowLogger>
): Promise<string> {
	const updateData: {
		title?: string;
		description?: string;
		visibility?: DocumentVisibility;
		status?: DocumentStatus;
	} = {};

	if (data.title !== undefined) updateData.title = data.title;
	if (data.description !== undefined) updateData.description = data.description;
	if (data.visibility !== undefined) updateData.visibility = data.visibility;
	if (data.status !== undefined) updateData.status = data.status;

	return orgTransaction(organizationId, async (tx) => {
		await tx.document.update({
			where: { id: documentId },
			data: updateData
		});

		log.info(`UPDATE_DOCUMENT document:${documentId} by user ${userId}`);
		return documentId;
	}, { userId, reason: 'UPDATE_DOCUMENT' });
}

async function createVersion(
	organizationId: string,
	userId: string,
	parentId: string,
	data: DocumentWorkflowInput['data'],
	log: ReturnType<typeof createWorkflowLogger>
): Promise<string> {
	return orgTransaction(organizationId, async (tx) => {
		// Get parent document
		const parent = await tx.document.findUniqueOrThrow({
			where: { id: parentId },
			include: { contextBindings: true }
		});

		// Get primary context binding
		const primaryBinding = parent.contextBindings.find(b => b.isPrimary);

		// Get max version
		const maxVersion = await tx.document.aggregate({
			where: {
				OR: [
					{ id: parentId },
					{ parentDocumentId: parentId }
				]
			},
			_max: { version: true }
		});

		const newVersion = (maxVersion._max.version || 0) + 1;

		// Mark previous version as superseded
		await tx.document.update({
			where: { id: parentId },
			data: { status: 'SUPERSEDED' }
		});

		// Create new version
		const newDoc = await tx.document.create({
			data: {
				organizationId: parent.organizationId,
				associationId: parent.associationId, // NEW: Copy associationId (Phase 30)
				parentDocumentId: parentId,
				title: parent.title,
				description: data.description || parent.description,
				category: parent.category,
				visibility: parent.visibility,
				status: DocumentStatus.ACTIVE,
				fileName: data.fileName!,
				fileSize: data.fileSize!,
				mimeType: data.mimeType!,
				storageProvider: StorageProvider.LOCAL,
				storagePath: data.storagePath!,
				fileUrl: data.fileUrl!,
				checksum: data.checksum,
				uploadedBy: userId,
				version: newVersion
			}
		});

		// Copy primary context binding
		if (primaryBinding) {
			await tx.documentContextBinding.create({
				data: {
					documentId: newDoc.id,
					contextType: primaryBinding.contextType,
					contextId: primaryBinding.contextId,
					isPrimary: true,
					createdBy: userId
				}
			});
		}

		log.info(`CREATE_VERSION document:${newDoc.id} parent:${parentId} version:${newVersion} by user ${userId}`);
		return newDoc.id;
	}, { userId, reason: 'CREATE_VERSION' });
}

async function restoreVersion(
	organizationId: string,
	userId: string,
	currentId: string,
	data: DocumentWorkflowInput['data'],
	log: ReturnType<typeof createWorkflowLogger>
): Promise<string> {
	const targetVersionId = data.targetVersionId!;

	return orgTransaction(organizationId, async (tx) => {
		// Get current and target documents
		const current = await tx.document.findUniqueOrThrow({ where: { id: currentId } });
		const target = await tx.document.findUniqueOrThrow({ where: { id: targetVersionId } });

		const rootId = current.parentDocumentId || current.id;

		// Get max version
		const maxVersion = await tx.document.aggregate({
			where: {
				OR: [
					{ id: rootId },
					{ parentDocumentId: rootId }
				]
			},
			_max: { version: true }
		});

		const newVersion = (maxVersion._max.version || 0) + 1;

		// Mark current as superseded
		await tx.document.update({
			where: { id: currentId },
			data: { status: 'SUPERSEDED' }
		});

		// Create restored version
		const restored = await tx.document.create({
			data: {
				organizationId: target.organizationId,
				associationId: target.associationId, // NEW: Copy associationId (Phase 30)
				parentDocumentId: rootId,
				title: target.title,
				description: target.description,
				category: target.category,
				visibility: target.visibility,
				status: DocumentStatus.ACTIVE,
				fileName: target.fileName,
				fileSize: target.fileSize,
				mimeType: target.mimeType,
				storageProvider: target.storageProvider,
				storagePath: target.storagePath,
				fileUrl: target.fileUrl,
				checksum: target.checksum,
				uploadedBy: userId,
				version: newVersion
			}
		});

		log.info(`RESTORE_VERSION document:${restored.id} from:${targetVersionId} version:${newVersion} by user ${userId}`);
		return restored.id;
	}, { userId, reason: 'RESTORE_VERSION' });
}

async function changeCategory(
	organizationId: string,
	userId: string,
	documentId: string,
	data: DocumentWorkflowInput['data'],
	log: ReturnType<typeof createWorkflowLogger>
): Promise<string> {
	return orgTransaction(organizationId, async (tx) => {
		await tx.document.update({
			where: { id: documentId },
			data: { category: data.category! }
		});

		log.info(`CHANGE_CATEGORY document:${documentId} to:${data.category} by user ${userId}`);
		return documentId;
	}, { userId, reason: 'CHANGE_CATEGORY' });
}

async function addContextBinding(
	organizationId: string,
	userId: string,
	documentId: string,
	data: DocumentWorkflowInput['data'],
	log: ReturnType<typeof createWorkflowLogger>
): Promise<string> {
	const contextType = data.contextType!;
	const contextId = data.contextId!;
	const isPrimary = data.isPrimary || false;

	return orgTransaction(organizationId, async (tx) => {
		// Check if binding already exists
		const existing = await tx.documentContextBinding.findUnique({
			where: {
				documentId_contextType_contextId: {
					documentId,
					contextType,
					contextId
				}
			}
		});

		if (existing) {
			return existing.id;
		}

		// If setting as primary, unset other primary bindings
		if (isPrimary) {
			await tx.documentContextBinding.updateMany({
				where: { documentId, isPrimary: true },
				data: { isPrimary: false }
			});
		}

		const binding = await tx.documentContextBinding.create({
			data: {
				documentId,
				contextType,
				contextId,
				isPrimary,
				createdBy: userId
			}
		});

		log.info(`ADD_CONTEXT_BINDING binding:${binding.id} document:${documentId} by user ${userId}`);
		return binding.id;
	}, { userId, reason: 'ADD_CONTEXT_BINDING' });
}

async function removeContextBinding(
	organizationId: string,
	userId: string,
	documentId: string,
	contextType: DocumentContextType,
	contextId: string,
	log: ReturnType<typeof createWorkflowLogger>
): Promise<string> {
	return orgTransaction(organizationId, async (tx) => {
		await tx.documentContextBinding.deleteMany({
			where: {
				documentId,
				contextType,
				contextId
			}
		});

		log.info(`REMOVE_CONTEXT_BINDING document:${documentId} context:${contextType}/${contextId}`);
		return documentId;
	}, { userId, reason: 'REMOVE_CONTEXT_BINDING' });
}

async function updateExtractedMetadata(
	organizationId: string,
	userId: string,
	documentId: string,
	data: {
		pageCount?: number;
		thumbnailUrl?: string;
		extractedText?: string;
		metadata?: Record<string, unknown>;
	},
	log: ReturnType<typeof createWorkflowLogger>
): Promise<string> {
	return orgTransaction(organizationId, async (tx) => {
		await tx.document.update({
			where: { id: documentId },
			data: {
				...(data.pageCount && { pageCount: data.pageCount }),
				...(data.thumbnailUrl && { thumbnailUrl: data.thumbnailUrl }),
				...(data.extractedText && { extractedText: data.extractedText }),
				...(data.metadata && { metadata: data.metadata as any })
			}
		});

		log.info(`UPDATE_EXTRACTED_METADATA document:${documentId}`);
		return documentId;
	}, { userId, reason: 'UPDATE_EXTRACTED_METADATA' });
}

async function archiveDocument(
	organizationId: string,
	userId: string,
	documentId: string,
	reason: string | undefined,
	log: ReturnType<typeof createWorkflowLogger>
): Promise<{ id: string; archivedAt: string }> {
	const now = new Date();
	return orgTransaction(organizationId, async (tx) => {
		await tx.document.update({
			where: { id: documentId },
			data: {
				status: 'ARCHIVED',
				archivedAt: now,
				archivedBy: userId,
				archiveReason: reason
			}
		});

		log.info(`ARCHIVE_DOCUMENT document:${documentId} by user ${userId}`);
		return { id: documentId, archivedAt: now.toISOString() };
	}, { userId, reason: 'ARCHIVE_DOCUMENT' });
}

async function restoreDocument(
	organizationId: string,
	userId: string,
	documentId: string,
	log: ReturnType<typeof createWorkflowLogger>
): Promise<string> {
	return orgTransaction(organizationId, async (tx) => {
		await tx.document.update({
			where: { id: documentId },
			data: {
				status: 'ACTIVE',
				archivedAt: null,
				archivedBy: null,
				archiveReason: null
			}
		});

		log.info(`RESTORE_DOCUMENT document:${documentId}`);
		return documentId;
	}, { userId, reason: 'RESTORE_DOCUMENT' });
}

async function logDownload(
	organizationId: string,
	userId: string,
	documentId: string,
	data: {
		partyId?: string;
		ipAddress?: string;
		userAgent?: string;
	},
	wfLog: ReturnType<typeof createWorkflowLogger>
): Promise<string> {
	return orgTransaction(organizationId, async (tx) => {
		const downloadLog = await tx.documentDownloadLog.create({
			data: {
				documentId,
				partyId: data.partyId,
				userId,
				ipAddress: data.ipAddress,
				userAgent: data.userAgent
			}
		});

		wfLog.info(`LOG_DOWNLOAD document:${documentId} log:${downloadLog.id}`);
		return downloadLog.id;
	}, { userId, reason: 'LOG_DOWNLOAD' });
}

// ---- Phase 18: File Ingestion & Processing Steps ----

export async function updateDocumentStatus(
	documentId: string,
	status: DocumentStatus,
	malwareStatus?: string
): Promise<void> {
	// Use SECURITY DEFINER function to bypass RLS for system-level updates
	await prisma.$queryRaw`
		SELECT update_document_status_system(
			${documentId}::TEXT,
			${status}::TEXT,
			${malwareStatus || null}::TEXT
		)
	`;
}

export async function dispatchProcessing(
	documentId: string,
	storagePath: string
): Promise<any> {
	// Call the hestami-worker-document
	const workerUrl = process.env.WORKER_DOCUMENT_URL || 'http://hestami-worker-document:8000';
	console.log(`[DocumentWorkflow] Dispatching ${documentId} to worker at ${workerUrl}...`);

	// In production, use standard fetch
	const response = await fetch(`${workerUrl}/process`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			documentId,
			storagePath,
		}),
	});

	if (!response.ok) {
		throw new Error(`Worker returned status ${response.status}`);
	}

	return await response.json();
}

export async function finalizeProcessing(
	documentId: string,
	workerResult: any,
	storagePath: string
): Promise<void> {
	const isClean = workerResult.status === 'clean' || workerResult.malwareScan?.status === 'clean';
	const s3Bucket = process.env.S3_BUCKET || 'uploads';
	const s3Endpoint = process.env.S3_ENDPOINT || 'https://dev-s3.hestami-ai.com';

	const status = isClean ? DocumentStatus.ACTIVE : DocumentStatus.ARCHIVED;
	const malwareScanStatus = isClean ? 'CLEAN' : 'INFECTED';
	const fileUrl = `${s3Endpoint}/${s3Bucket}/${storagePath}`;
	const thumbnailUrl = workerResult.derivatives?.thumbnail
		? `${s3Endpoint}/${s3Bucket}/${workerResult.derivatives.thumbnail}`
		: (workerResult.derivatives?.poster
			? `${s3Endpoint}/${s3Bucket}/${workerResult.derivatives.poster}`
			: null);
	const checksum = workerResult.checksum || workerResult.fileHash || null;
	const metadata = workerResult.metadata || workerResult;

	// Use SECURITY DEFINER function to bypass RLS for system-level updates
	await prisma.$queryRaw`
		SELECT finalize_document_processing_system(
			${documentId}::TEXT,
			${status}::TEXT,
			${malwareScanStatus}::TEXT,
			${storagePath}::TEXT,
			${fileUrl}::TEXT,
			${thumbnailUrl}::TEXT,
			${workerResult.fileName || null}::TEXT,
			${workerResult.fileSize || null}::BIGINT,
			${workerResult.mimeType || null}::TEXT,
			${checksum}::TEXT,
			${JSON.stringify(metadata)}::JSONB
		)
	`;
	console.log(`[DocumentWorkflow] FINALIZED ${documentId}. Clean: ${isClean}`);
}

/**
 * Gets the count of documents currently in PROCESSING status for an organization.
 * Uses SECURITY DEFINER function to bypass RLS.
 */
export async function getOrgProcessingCount(organizationId: string): Promise<number> {
	const result = await prisma.$queryRaw<{ count: bigint }[]>`
		SELECT get_org_processing_count(${organizationId}) as count
	`;
	return Number(result[0]?.count || 0);
}

/**
 * Gets the global count of documents currently in PROCESSING status.
 * Uses SECURITY DEFINER function to bypass RLS.
 */
export async function getGlobalProcessingCount(): Promise<number> {
	const result = await prisma.$queryRaw<{ count: bigint }[]>`
		SELECT get_global_processing_count() as count
	`;
	return Number(result[0]?.count || 0);
}

/**
 * Gets the total queue depth (Pending, Processing, Failed) for an organization.
 * Uses SECURITY DEFINER function to bypass RLS.
 */
export async function getOrgQueueDepth(organizationId: string): Promise<number> {
	const result = await prisma.$queryRaw<{ count: bigint }[]>`
		SELECT get_org_queue_depth(${organizationId}) as count
	`;
	return Number(result[0]?.count || 0);
}

/**
 * Classifies an error into TRANSIENT or PERMANENT categories for retry logic.
 */
export function classifyError(error: Error): { type: 'TRANSIENT' | 'PERMANENT'; code: string } {
	const message = error.message.toLowerCase();

	// Transient errors (auto-retry eligible)
	if (message.includes('500') || message.includes('502') || message.includes('503')) {
		return { type: 'TRANSIENT', code: 'WORKER_ERROR' };
	}
	if (message.includes('timeout') || message.includes('timed out')) {
		return { type: 'TRANSIENT', code: 'TIMEOUT' };
	}
	if (message.includes('connection') || message.includes('network')) {
		return { type: 'TRANSIENT', code: 'NETWORK_ERROR' };
	}
	if (message.includes('clamav') && message.includes('unavailable')) {
		return { type: 'TRANSIENT', code: 'CLAMAV_UNAVAILABLE' };
	}

	// Permanent errors (no auto-retry)
	if (message.includes('corrupt') || message.includes('invalid')) {
		return { type: 'PERMANENT', code: 'CORRUPT_FILE' };
	}
	if (message.includes('unsupported') || message.includes('format')) {
		return { type: 'PERMANENT', code: 'UNSUPPORTED_FORMAT' };
	}
	if (message.includes('size limit') || message.includes('too large')) {
		return { type: 'PERMANENT', code: 'FILE_TOO_LARGE' };
	}

	// Default to transient (safer - allows retry)
	return { type: 'TRANSIENT', code: 'UNKNOWN_FAILURE' };
}

/**
 * Calculates the next retry time using exponential backoff.
 */
export function calculateNextRetryTime(attemptCount: number): Date | undefined {
	const maxAttempts = parseInt(process.env.DPQ_MAX_RETRY_ATTEMPTS || '3', 10);
	if (attemptCount >= maxAttempts) {
		return undefined;
	}

	const initialInterval = parseInt(process.env.DPQ_RETRY_INTERVAL_SECONDS || '300', 10);
	const backoffMultiplier = parseInt(process.env.DPQ_RETRY_BACKOFF_MULTIPLIER || '2', 10);

	// interval * (multiplier ^ attemptCount)
	const delaySeconds = initialInterval * Math.pow(backoffMultiplier, attemptCount);
	return new Date(Date.now() + delaySeconds * 1000);
}

/**
 * Updates document processing status and metadata via SECURITY DEFINER function.
 */
export async function updateDocumentProcessingStatus(
	documentId: string,
	status: DocumentStatus,
	errorMetadata?: {
		type?: string;
		message?: string;
		details?: any;
		nextRetryAt?: Date;
	}
): Promise<void> {
	await prisma.$queryRaw`
		SELECT update_document_processing_status(
			${documentId}::TEXT,
			${status}::TEXT,
			${errorMetadata?.type || null}::TEXT,
			${errorMetadata?.message || null}::TEXT,
			${errorMetadata?.details ? JSON.stringify(errorMetadata.details) : null}::JSONB,
			${errorMetadata?.nextRetryAt || null}::TIMESTAMPTZ
		)
	`;
}

async function documentWorkflow(input: DocumentWorkflowInput): Promise<DocumentWorkflowResult> {
	const log = createWorkflowLogger('DocumentWorkflow', undefined, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		documentId: input.documentId,
		category: input.data.category,
		contextType: input.data.contextType,
		contextId: input.data.contextId,
		fileName: input.data.fileName
	});

	try {
		let entityId: string;

		switch (input.action) {
			case 'CREATE_DOCUMENT':
				log.debug('Executing CREATE_DOCUMENT step');
				entityId = await DBOS.runStep(
					() => createDocument(input.organizationId, input.userId, input.data, log, input.associationId),
					{ name: 'createDocument' }
				);
				break;

			case 'CREATE_DOCUMENT_METADATA':
				log.debug('Executing CREATE_DOCUMENT_METADATA step');
				entityId = await DBOS.runStep(
					() => createDocumentMetadata(input.organizationId, input.userId, input.data, log, input.associationId),
					{ name: 'createDocumentMetadata' }
				);
				break;

			case 'UPDATE_DOCUMENT':
				log.debug('Executing UPDATE_DOCUMENT step', { documentId: input.documentId });
				entityId = await DBOS.runStep(
					() => updateDocument(input.organizationId, input.userId, input.documentId!, input.data, log),
					{ name: 'updateDocument' }
				);
				break;

			case 'CREATE_VERSION':
				log.debug('Executing CREATE_VERSION step', { documentId: input.documentId });
				entityId = await DBOS.runStep(
					() => createVersion(input.organizationId, input.userId, input.documentId!, input.data, log),
					{ name: 'createVersion' }
				);
				break;

			case 'RESTORE_VERSION':
				log.debug('Executing RESTORE_VERSION step', { documentId: input.documentId, targetVersionId: input.data.targetVersionId });
				entityId = await DBOS.runStep(
					() => restoreVersion(input.organizationId, input.userId, input.documentId!, input.data, log),
					{ name: 'restoreVersion' }
				);
				break;

			case 'CHANGE_CATEGORY':
				log.debug('Executing CHANGE_CATEGORY step', { documentId: input.documentId, category: input.data.category });
				entityId = await DBOS.runStep(
					() => changeCategory(input.organizationId, input.userId, input.documentId!, input.data, log),
					{ name: 'changeCategory' }
				);
				break;

			case 'ADD_CONTEXT_BINDING':
				log.debug('Executing ADD_CONTEXT_BINDING step', { documentId: input.documentId, contextType: input.data.contextType });
				entityId = await DBOS.runStep(
					() => addContextBinding(input.organizationId, input.userId, input.documentId!, input.data, log),
					{ name: 'addContextBinding' }
				);
				break;

			case 'REMOVE_CONTEXT_BINDING':
				log.debug('Executing REMOVE_CONTEXT_BINDING step', { documentId: input.documentId, contextType: input.data.contextType });
				entityId = await DBOS.runStep(
					() => removeContextBinding(input.organizationId, input.userId, input.documentId!, input.data.contextType!, input.data.contextId!, log),
					{ name: 'removeContextBinding' }
				);
				break;

			case 'UPDATE_EXTRACTED_METADATA':
				log.debug('Executing UPDATE_EXTRACTED_METADATA step', { documentId: input.documentId });
				entityId = await DBOS.runStep(
					() => updateExtractedMetadata(input.organizationId, input.userId, input.documentId!, {
						pageCount: input.data.pageCount,
						thumbnailUrl: input.data.thumbnailUrl,
						extractedText: input.data.extractedText,
						metadata: input.data.metadata
					}, log),
					{ name: 'updateExtractedMetadata' }
				);
				break;

			case 'ARCHIVE_DOCUMENT':
				log.debug('Executing ARCHIVE_DOCUMENT step', { documentId: input.documentId });
				const archiveResult = await DBOS.runStep(
					() => archiveDocument(input.organizationId, input.userId, input.documentId!, input.data.archiveReason, log),
					{ name: 'archiveDocument' }
				);
				entityId = archiveResult.id;
				break;

			case 'RESTORE_DOCUMENT':
				log.debug('Executing RESTORE_DOCUMENT step', { documentId: input.documentId });
				entityId = await DBOS.runStep(
					() => restoreDocument(input.organizationId, input.userId, input.documentId!, log),
					{ name: 'restoreDocument' }
				);
				break;

			case 'LOG_DOWNLOAD':
				log.debug('Executing LOG_DOWNLOAD step', { documentId: input.documentId });
				entityId = await DBOS.runStep(
					() => logDownload(input.organizationId, input.userId, input.documentId!, {
						partyId: input.data.partyId,
						ipAddress: input.data.ipAddress,
						userAgent: input.data.userAgent
					}, log),
					{ name: 'logDownload' }
				);
				break;

			case 'HANDLE_TUS_HOOK':
				const tusPayload = input.data.tusPayload;
				if (!tusPayload) throw new Error('Missing TUS payload');

				// Supporting both TUSD v1 and v2 structures
				const uploadId = tusPayload.Upload?.ID || tusPayload.Event?.Upload?.ID || tusPayload.ID;
				const metaData = tusPayload.Upload?.MetaData || tusPayload.Event?.Upload?.MetaData || tusPayload.MetaData || {};
				const docIdFromMeta = metaData['documentId'];

				// tusd with S3 storage uses format: hash+signature_uuid
				// The S3 object key is just the hash part (before the +)
				const s3ObjectKey = uploadId?.split('+')[0] || uploadId;

				log.info('Handling TUS hook', { uploadId, s3ObjectKey, docIdFromMeta });

				if (!docIdFromMeta) {
					throw new Error('Missing documentId in TUS metadata');
				}

				entityId = docIdFromMeta;

				// Look up the document to get the actual organizationId (TUS hook passes 'system')
				// Use SECURITY DEFINER function to bypass RLS since this is a system-level operation without org context
				interface DocOrgRow { organization_id: string }
				const docForOrg = await DBOS.runStep(
					async () => {
						const rows = await prisma.$queryRaw<DocOrgRow[]>`
							SELECT * FROM get_document_organization(${docIdFromMeta})
						`;
						if (rows.length === 0) {
							return null;
						}
						return { organizationId: rows[0].organization_id };
					},
					{ name: 'lookupDocOrg' }
				);

				if (!docForOrg) {
					throw new Error(`Document not found after retries: ${docIdFromMeta}`);
				}

				const actualOrgId = docForOrg.organizationId;
				log.debug('Resolved organization from document', { docIdFromMeta, actualOrgId });

				try {
					// 1. Check Rate Limits BEFORE marking as processing (to avoid incrementing attempt count)
					const orgLimit = parseInt(process.env.DPQ_MAX_CONCURRENT_PER_ORG || '5', 10);
					const globalLimit = parseInt(process.env.DPQ_GLOBAL_MAX_CONCURRENT || '20', 10);

					const [orgCount, globalCount] = await Promise.all([
						DBOS.runStep(() => getOrgProcessingCount(actualOrgId), { name: 'getOrgCount' }),
						DBOS.runStep(() => getGlobalProcessingCount(), { name: 'getGlobalCount' })
					]);

					if (orgCount >= orgLimit || globalCount >= globalLimit) {
						const limitType = orgCount >= orgLimit ? 'ORGANIZATION' : 'GLOBAL';
						log.info(`Concurrency limit reached (${limitType})`, { orgCount, globalCount, orgLimit, globalLimit });

						// Mark as failed with transient error to trigger retry (without incrementing attempt count)
						const nextRetryAt = new Date(Date.now() + 60 * 1000); // Retry in 1 minute
						await DBOS.runStep(
							() => updateDocumentProcessingStatus(docIdFromMeta, DocumentStatus.PROCESSING_FAILED, {
								type: 'TRANSIENT',
								message: `Concurrency limit reached (${limitType})`,
								details: { code: 'CONCURRENCY_LIMIT_REACHED', limitType },
								nextRetryAt
							}),
							{ name: 'markLimitReached' }
						);

						await DBOS.runStep(
							() => recordWorkflowEvent({
								organizationId: actualOrgId,
								entityType: 'DOCUMENT',
								entityId: docIdFromMeta,
								action: 'STATUS_CHANGE',
								eventCategory: 'SYSTEM',
								summary: `Processing delayed: ${limitType} concurrency limit reached`,
								workflowId: 'DocumentWorkflow',
								workflowStep: 'markLimitReached',
								previousState: { status: DocumentStatus.PENDING_UPLOAD },
								newState: { status: DocumentStatus.PROCESSING_FAILED },
								metadata: { limitType, nextRetryAt }
							}),
							{ name: 'recordLimitReached' }
						);

						return { success: true, entityId: docIdFromMeta };
					}

					// 2. Mark Processing
					const docBefore = await prisma.document.findUnique({
						where: { id: docIdFromMeta }
					});

					await DBOS.runStep(
						() => updateDocumentProcessingStatus(docIdFromMeta, DocumentStatus.PROCESSING),
						{ name: 'markProcessing' }
					);

					await DBOS.runStep(
						() => recordWorkflowEvent({
							organizationId: actualOrgId,
							entityType: 'DOCUMENT',
							entityId: docIdFromMeta,
							action: 'STATUS_CHANGE',
							eventCategory: 'SYSTEM',
							summary: `Document processing started for ${s3ObjectKey}`,
							workflowId: 'DocumentWorkflow',
							workflowStep: 'markProcessing',
							previousState: { status: docBefore?.status },
							newState: { status: DocumentStatus.PROCESSING }
						}),
						{ name: 'recordProcessingStarted' }
					);

					// Metric: Processing Started
					processingStartedCounter.add(1, { organizationId: actualOrgId });
					const processingStartTime = Date.now();

					// 2. Dispatch to worker
					log.info('Dispatching to worker', { docIdFromMeta, s3ObjectKey });
					const workerResult = await DBOS.runStep(
						() => dispatchProcessing(docIdFromMeta, s3ObjectKey),
						{ name: 'dispatchProcessing' }
					);

					// 3. Finalize
					log.info('Finalizing processing', { docIdFromMeta, status: workerResult.status });
					const isClean = workerResult.status === 'clean' || workerResult.malwareScan?.status === 'clean';

					await DBOS.runStep(
						() => finalizeProcessing(docIdFromMeta, {
							status: workerResult.status,
							storagePath: s3ObjectKey,
							fileUrl: `${process.env.S3_ENDPOINT || 'https://dev-s3.hestami-ai.com'}/${process.env.S3_BUCKET || 'uploads'}/${s3ObjectKey}`,
							fileName: workerResult.fileName,
							fileSize: workerResult.fileSize,
							mimeType: workerResult.mimeType,
							checksum: workerResult.checksum,
							derivatives: workerResult.derivatives,
							metadata: workerResult.metadata
						}, s3ObjectKey),
						{ name: 'finalizeProcessing' }
					);

					// 4. Record Success or Infection
					const finalStatus = isClean ? DocumentStatus.ACTIVE : DocumentStatus.INFECTED;
					await DBOS.runStep(
						() => recordWorkflowEvent({
							organizationId: actualOrgId,
							entityType: 'DOCUMENT',
							entityId: docIdFromMeta,
							action: isClean ? 'COMPLETE' : 'STATUS_CHANGE',
							eventCategory: 'SYSTEM',
							summary: isClean
								? `Document processing completed successfully`
								: `Malware detected in document ${s3ObjectKey}`,
							workflowId: 'DocumentWorkflow',
							workflowStep: 'finalizeProcessing',
							previousState: { status: DocumentStatus.PROCESSING },
							newState: { status: finalStatus },
							metadata: {
								malwareInfo: !isClean ? workerResult.malwareScan : undefined
							}
						}),
						{ name: 'recordCompletion' }
					);

					// Metrics: Completion, Infection, Duration
					const duration = (Date.now() - processingStartTime) / 1000;
					processingDurationHistogram.record(duration, { organizationId: actualOrgId, status: isClean ? 'SUCCESS' : 'INFECTED' });

					if (isClean) {
						processingCompletedCounter.add(1, { organizationId: actualOrgId });
					} else {
						processingInfectedCounter.add(1, { organizationId: actualOrgId });
					}

					// 5. Send Notification
					const notificationType = isClean ? NotificationType.SUCCESS : NotificationType.ERROR;
					const title = isClean ? 'Document Processed' : 'Security Risk Detected';
					const message = isClean
						? `Your document "${workerResult.fileName}" has been successfully processed.`
						: `File "${workerResult.fileName}" was flagged as unsafe and has been rejected.`;

					await DBOS.runStep(async () => {
						const doc = await prisma.document.findUnique({ where: { id: docIdFromMeta } });
						if (!doc) return;

						const handle = await DBOS.startWorkflow(notificationWorkflow_v1, {
							workflowID: crypto.randomUUID()
						})({
							action: NotificationAction.SEND_NOTIFICATION,
							organizationId: actualOrgId,
							userId: doc.uploadedBy,
							data: {
								title,
								message,
								type: notificationType,
								category: NotificationCategory.DOCUMENT_PROCESSING,
								link: `/app/concierge/documents/${docIdFromMeta}`,
								forceEmail: !isClean
							}
						});
					}, { name: 'triggerCompletionNotification' });

				} catch (error) {
					const errorObj = error instanceof Error ? error : new Error(String(error));
					const classification = classifyError(errorObj);

					log.error(`Processing failed: ${errorObj.message}`, {
						type: classification.type,
						code: classification.code
					});

					let nextRetryAt: Date | undefined;
					if (classification.type === 'TRANSIENT') {
						const doc = await prisma.document.findUnique({ where: { id: docIdFromMeta } });
						nextRetryAt = calculateNextRetryTime(doc?.processingAttemptCount || 1);
					}

					await DBOS.runStep(
						() => updateDocumentProcessingStatus(docIdFromMeta, DocumentStatus.PROCESSING_FAILED, {
							type: classification.type,
							message: errorObj.message,
							details: { code: classification.code },
							nextRetryAt
						}),
						{ name: 'markProcessingFailed' }
					);

					await DBOS.runStep(
						() => recordWorkflowEvent({
							organizationId: actualOrgId,
							entityType: 'DOCUMENT',
							entityId: docIdFromMeta,
							action: 'WORKFLOW_FAILED',
							eventCategory: 'SYSTEM',
							summary: `Document processing failed: ${errorObj.message}`,
							workflowId: 'DocumentWorkflow',
							workflowStep: 'markProcessingFailed',
							previousState: { status: DocumentStatus.PROCESSING },
							newState: { status: DocumentStatus.PROCESSING_FAILED },
							metadata: {
								error: {
									type: classification.type,
									code: classification.code,
									message: errorObj.message
								},
							}
						}),
						{ name: 'recordFailure' }
					);

					// Metric: Processing Failed
					processingFailedCounter.add(1, { organizationId: input.organizationId, errorType: classification.type });

					// Trigger failure notification if retries exhausted or permanent error
					if (!nextRetryAt || classification.type === 'PERMANENT') {
						const doc = await prisma.document.findUnique({ where: { id: docIdFromMeta } });
						await DBOS.runStep(async () => {
							if (!doc) return;

							const handle = await DBOS.startWorkflow(notificationWorkflow_v1, {
								workflowID: crypto.randomUUID()
							})({
								action: NotificationAction.SEND_NOTIFICATION,
								organizationId: actualOrgId,
								userId: doc.uploadedBy,
								data: {
									title: 'Processing Failed',
									message: `We could not process "${doc.fileName}". ${classification.type === 'PERMANENT' ? 'This file type or content is not supported.' : 'Please delete and try uploading again.'}`,
									type: NotificationType.ERROR,
									category: NotificationCategory.DOCUMENT_PROCESSING,
									link: `/app/concierge/documents/${docIdFromMeta}`,
									forceEmail: false
								}
							});
						}, { name: 'triggerFailureNotification' });
					}

					// Rethrow to fail the workflow
					throw error;
				}
				break;

			default:
				log.error('Unknown action', { action: input.action });
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		logWorkflowEnd(log, input.action, true, startTime, { entityId });
		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logStepError(log, input.action, error instanceof Error ? error : new Error(errorMessage), {
			organizationId: input.organizationId,
			documentId: input.documentId
		});
		logWorkflowEnd(log, input.action, false, startTime, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(error instanceof Error ? error : new Error(errorMessage), {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'DOCUMENT_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const documentWorkflow_v1 = DBOS.registerWorkflow(documentWorkflow);

export async function startDocumentWorkflow(
	input: DocumentWorkflowInput,
	idempotencyKey: string
): Promise<DocumentWorkflowResult> {
	const handle = await DBOS.startWorkflow(documentWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
