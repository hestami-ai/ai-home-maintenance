/**
 * Document Workflow (v1)
 *
 * DBOS durable workflow for document management operations.
 * Handles: create, update, version management, category changes, context bindings.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
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

// Action types for document operations
export const DocumentAction = {
	CREATE_DOCUMENT: 'CREATE_DOCUMENT',
	CREATE_DOCUMENT_METADATA: 'CREATE_DOCUMENT_METADATA',
	UPDATE_DOCUMENT: 'UPDATE_DOCUMENT',
	CREATE_VERSION: 'CREATE_VERSION',
	RESTORE_VERSION: 'RESTORE_VERSION',
	CHANGE_CATEGORY: 'CHANGE_CATEGORY',
	ADD_CONTEXT_BINDING: 'ADD_CONTEXT_BINDING',
	HANDLE_TUS_HOOK: 'HANDLE_TUS_HOOK'
} as const;

export type DocumentAction = (typeof DocumentAction)[keyof typeof DocumentAction];

export interface DocumentWorkflowInput {
	action: DocumentAction;
	organizationId: string;
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
		isPrimary?: boolean;
		fileName?: string;
		fileSize?: number;
		mimeType?: string;
		storageProvider?: string;
		storagePath?: string;
		fileUrl?: string;
		checksum?: string;
		targetVersionId?: string;
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
	data: DocumentWorkflowInput['data']
): Promise<string> {
	const document = await prisma.document.create({
		data: {
			organizationId,
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
		await prisma.documentContextBinding.create({
			data: {
				documentId: document.id,
				contextType: data.contextType,
				contextId: data.contextId,
				isPrimary: true,
				createdBy: userId
			}
		});
	}

	console.log(`[DocumentWorkflow] CREATE_DOCUMENT document:${document.id} by user ${userId}`);
	return document.id;
}

async function createDocumentMetadata(
	organizationId: string,
	userId: string,
	data: DocumentWorkflowInput['data']
): Promise<string> {
	const document = await prisma.document.create({
		data: {
			organizationId,
			title: data.title!,
			description: data.description,
			category: data.category!,
			visibility: data.visibility || DocumentVisibility.PRIVATE,
			status: DocumentStatus.ACTIVE,
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
		await prisma.documentContextBinding.create({
			data: {
				documentId: document.id,
				contextType: data.contextType,
				contextId: data.contextId,
				isPrimary: true,
				createdBy: userId
			}
		});
	}

	console.log(`[DocumentWorkflow] CREATE_DOCUMENT_METADATA document:${document.id} by user ${userId}`);
	return document.id;
}

async function updateDocument(
	organizationId: string,
	userId: string,
	documentId: string,
	data: DocumentWorkflowInput['data']
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

	await prisma.document.update({
		where: { id: documentId },
		data: updateData
	});

	console.log(`[DocumentWorkflow] UPDATE_DOCUMENT document:${documentId} by user ${userId}`);
	return documentId;
}

async function createVersion(
	organizationId: string,
	userId: string,
	parentId: string,
	data: DocumentWorkflowInput['data']
): Promise<string> {
	// Get parent document
	const parent = await prisma.document.findUniqueOrThrow({
		where: { id: parentId },
		include: { contextBindings: true }
	});

	// Get primary context binding
	const primaryBinding = parent.contextBindings.find(b => b.isPrimary);

	// Get max version
	const maxVersion = await prisma.document.aggregate({
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
	await prisma.document.update({
		where: { id: parentId },
		data: { status: 'SUPERSEDED' }
	});

	// Create new version
	const newDoc = await prisma.document.create({
		data: {
			organizationId: parent.organizationId,
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
		await prisma.documentContextBinding.create({
			data: {
				documentId: newDoc.id,
				contextType: primaryBinding.contextType,
				contextId: primaryBinding.contextId,
				isPrimary: true,
				createdBy: userId
			}
		});
	}

	console.log(`[DocumentWorkflow] CREATE_VERSION document:${newDoc.id} parent:${parentId} version:${newVersion} by user ${userId}`);
	return newDoc.id;
}

async function restoreVersion(
	organizationId: string,
	userId: string,
	currentId: string,
	data: DocumentWorkflowInput['data']
): Promise<string> {
	const targetVersionId = data.targetVersionId!;

	// Get current and target documents
	const current = await prisma.document.findUniqueOrThrow({ where: { id: currentId } });
	const target = await prisma.document.findUniqueOrThrow({ where: { id: targetVersionId } });

	const rootId = current.parentDocumentId || current.id;

	// Get max version
	const maxVersion = await prisma.document.aggregate({
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
	await prisma.document.update({
		where: { id: currentId },
		data: { status: 'SUPERSEDED' }
	});

	// Create restored version
	const restored = await prisma.document.create({
		data: {
			organizationId: target.organizationId,
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

	console.log(`[DocumentWorkflow] RESTORE_VERSION document:${restored.id} from:${targetVersionId} version:${newVersion} by user ${userId}`);
	return restored.id;
}

async function changeCategory(
	organizationId: string,
	userId: string,
	documentId: string,
	data: DocumentWorkflowInput['data']
): Promise<string> {
	await prisma.document.update({
		where: { id: documentId },
		data: { category: data.category! }
	});

	console.log(`[DocumentWorkflow] CHANGE_CATEGORY document:${documentId} to:${data.category} by user ${userId}`);
	return documentId;
}

async function addContextBinding(
	organizationId: string,
	userId: string,
	documentId: string,
	data: DocumentWorkflowInput['data']
): Promise<string> {
	const contextType = data.contextType!;
	const contextId = data.contextId!;
	const isPrimary = data.isPrimary || false;

	// Check if binding already exists
	const existing = await prisma.documentContextBinding.findUnique({
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
		await prisma.documentContextBinding.updateMany({
			where: { documentId, isPrimary: true },
			data: { isPrimary: false }
		});
	}

	const binding = await prisma.documentContextBinding.create({
		data: {
			documentId,
			contextType,
			contextId,
			isPrimary,
			createdBy: userId
		}
	});

	console.log(`[DocumentWorkflow] ADD_CONTEXT_BINDING binding:${binding.id} document:${documentId} by user ${userId}`);
	return binding.id;
}

// ---- Phase 18: File Ingestion & Processing Steps ----

async function updateDocumentStatus(
	documentId: string,
	status: DocumentStatus,
	malwareStatus?: string
): Promise<void> {
	await prisma.document.update({
		where: { id: documentId },
		data: {
			status,
			...(malwareStatus ? { malwareScanStatus: malwareStatus } : {})
		}
	});
}

async function dispatchProcessing(
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

async function finalizeProcessing(
	documentId: string,
	workerResult: any
): Promise<void> {
	const isClean = workerResult.status === 'clean';

	await prisma.document.update({
		where: { id: documentId },
		data: {
			status: isClean ? DocumentStatus.ACTIVE : DocumentStatus.ARCHIVED, // Using ARCHIVED as proxy for QUARANTINED/SUSPENDED if enum not available
			malwareScanStatus: isClean ? 'CLEAN' : 'INFECTED',
			metadata: workerResult.metadata ?? {},
			processingCompletedAt: new Date()
		}
	});
	console.log(`[DocumentWorkflow] FINALIZED ${documentId}. Clean: ${isClean}`);
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
					() => createDocument(input.organizationId, input.userId, input.data),
					{ name: 'createDocument' }
				);
				break;

			case 'CREATE_DOCUMENT_METADATA':
				log.debug('Executing CREATE_DOCUMENT_METADATA step');
				entityId = await DBOS.runStep(
					() => createDocumentMetadata(input.organizationId, input.userId, input.data),
					{ name: 'createDocumentMetadata' }
				);
				break;

			case 'UPDATE_DOCUMENT':
				log.debug('Executing UPDATE_DOCUMENT step', { documentId: input.documentId });
				entityId = await DBOS.runStep(
					() => updateDocument(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'updateDocument' }
				);
				break;

			case 'CREATE_VERSION':
				log.debug('Executing CREATE_VERSION step', { documentId: input.documentId });
				entityId = await DBOS.runStep(
					() => createVersion(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'createVersion' }
				);
				break;

			case 'RESTORE_VERSION':
				log.debug('Executing RESTORE_VERSION step', { documentId: input.documentId, targetVersionId: input.data.targetVersionId });
				entityId = await DBOS.runStep(
					() => restoreVersion(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'restoreVersion' }
				);
				break;

			case 'CHANGE_CATEGORY':
				log.debug('Executing CHANGE_CATEGORY step', { documentId: input.documentId, category: input.data.category });
				entityId = await DBOS.runStep(
					() => changeCategory(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'changeCategory' }
				);
				break;

			case 'ADD_CONTEXT_BINDING':
				log.debug('Executing ADD_CONTEXT_BINDING step', { documentId: input.documentId, contextType: input.data.contextType });
				entityId = await DBOS.runStep(
					() => addContextBinding(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'addContextBinding' }
				);
				break;

			case 'HANDLE_TUS_HOOK':
				log.debug('Executing HANDLE_TUS_HOOK step');
				// TUS Hook Logic
				const tusPayload = input.data.tusPayload;
				if (!tusPayload) throw new Error('Missing TUS payload');

				const uploadId = tusPayload.Event.Upload.ID;
				const docIdFromMeta = tusPayload.Event.Upload.MetaData['documentId'];

				if (!docIdFromMeta) {
					// If no documentId in metadata, we can't link it easily without more logic.
					// Fallback: search by storagePath if we saved it in CREATE_DOCUMENT_METADATA.
					throw new Error('Missing documentId in TUS metadata');
				}

				entityId = docIdFromMeta;

				// 1. Mark Processing
				await DBOS.runStep(
					() => updateDocumentStatus(docIdFromMeta, DocumentStatus.ACTIVE, 'PENDING'), // Temporarily ACTIVE or keep as UPLOADING/PROCESSING if enum supported
					{ name: 'markPendingScan' }
				);

				// 2. Dispatch
				const workerResult = await DBOS.runStep(
					() => dispatchProcessing(docIdFromMeta, uploadId),
					{ name: 'dispatchProcessing' }
				);

				// 3. Finalize
				await DBOS.runStep(
					() => finalizeProcessing(docIdFromMeta, workerResult),
					{ name: 'finalizeProcessing' }
				);
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
	idempotencyKey?: string
): Promise<DocumentWorkflowResult> {
	const workflowId = idempotencyKey || `document-${input.action}-${input.documentId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(documentWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
