/**
 * Document Workflow (v1)
 *
 * DBOS durable workflow for document management operations.
 * Handles: create, update, version management, category changes, context bindings.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';

export type DocumentAction =
	| 'CREATE_DOCUMENT'
	| 'CREATE_DOCUMENT_METADATA'
	| 'UPDATE_DOCUMENT'
	| 'CREATE_VERSION'
	| 'RESTORE_VERSION'
	| 'CHANGE_CATEGORY'
	| 'ADD_CONTEXT_BINDING';

export interface DocumentWorkflowInput {
	action: DocumentAction;
	organizationId: string;
	userId: string;
	documentId?: string;
	data: Record<string, unknown>;
}

export interface DocumentWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
}

async function createDocument(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const document = await prisma.document.create({
		data: {
			organizationId,
			title: data.title as string,
			description: data.description as string | undefined,
			category: data.category as any,
			visibility: (data.visibility as any) || 'INTERNAL',
			status: 'ACTIVE',
			fileName: data.fileName as string,
			fileSize: data.fileSize as number,
			mimeType: data.mimeType as string,
			storageProvider: 'LOCAL',
			storagePath: data.storagePath as string,
			fileUrl: data.fileUrl as string,
			checksum: data.checksum as string | undefined,
			uploadedBy: userId,
			version: 1
		}
	});

	// Create context binding if provided
	if (data.contextType && data.contextId) {
		await prisma.documentContextBinding.create({
			data: {
				documentId: document.id,
				contextType: data.contextType as any,
				contextId: data.contextId as string,
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
	data: Record<string, unknown>
): Promise<string> {
	const document = await prisma.document.create({
		data: {
			organizationId,
			title: data.title as string,
			description: data.description as string | undefined,
			category: data.category as any,
			visibility: (data.visibility as any) || 'INTERNAL',
			status: 'ACTIVE',
			fileName: data.fileName as string,
			fileSize: (data.fileSize as number) || 0,
			mimeType: (data.mimeType as string) || 'application/octet-stream',
			storageProvider: data.storageProvider as any || 'EXTERNAL',
			storagePath: (data.storagePath as string) || '',
			fileUrl: data.fileUrl as string,
			checksum: data.checksum as string | undefined,
			uploadedBy: userId,
			version: 1
		}
	});

	// Create context binding if provided
	if (data.contextType && data.contextId) {
		await prisma.documentContextBinding.create({
			data: {
				documentId: document.id,
				contextType: data.contextType as any,
				contextId: data.contextId as string,
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
	data: Record<string, unknown>
): Promise<string> {
	const updateData: Record<string, unknown> = {};
	
	if (data.title !== undefined) updateData.title = data.title as string;
	if (data.description !== undefined) updateData.description = data.description as string;
	if (data.visibility !== undefined) updateData.visibility = data.visibility;
	if (data.status !== undefined) updateData.status = data.status;

	await prisma.document.update({
		where: { id: documentId },
		data: updateData as any
	});

	console.log(`[DocumentWorkflow] UPDATE_DOCUMENT document:${documentId} by user ${userId}`);
	return documentId;
}

async function createVersion(
	organizationId: string,
	userId: string,
	parentId: string,
	data: Record<string, unknown>
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
			description: (data.description as string) || parent.description,
			category: parent.category,
			visibility: parent.visibility,
			status: 'ACTIVE',
			fileName: data.fileName as string,
			fileSize: data.fileSize as number,
			mimeType: data.mimeType as string,
			storageProvider: 'LOCAL',
			storagePath: data.storagePath as string,
			fileUrl: data.fileUrl as string,
			checksum: data.checksum as string | undefined,
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
	data: Record<string, unknown>
): Promise<string> {
	const targetVersionId = data.targetVersionId as string;

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
			status: 'ACTIVE',
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
	data: Record<string, unknown>
): Promise<string> {
	await prisma.document.update({
		where: { id: documentId },
		data: { category: data.category as any }
	});

	console.log(`[DocumentWorkflow] CHANGE_CATEGORY document:${documentId} to:${data.category} by user ${userId}`);
	return documentId;
}

async function addContextBinding(
	organizationId: string,
	userId: string,
	documentId: string,
	data: Record<string, unknown>
): Promise<string> {
	const contextType = data.contextType as string;
	const contextId = data.contextId as string;
	const isPrimary = data.isPrimary as boolean || false;

	// Check if binding already exists
	const existing = await prisma.documentContextBinding.findUnique({
		where: {
			documentId_contextType_contextId: {
				documentId,
				contextType: contextType as any,
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
			contextType: contextType as any,
			contextId,
			isPrimary,
			createdBy: userId
		}
	});

	console.log(`[DocumentWorkflow] ADD_CONTEXT_BINDING binding:${binding.id} document:${documentId} by user ${userId}`);
	return binding.id;
}

async function documentWorkflow(input: DocumentWorkflowInput): Promise<DocumentWorkflowResult> {
	try {
		let entityId: string;

		switch (input.action) {
			case 'CREATE_DOCUMENT':
				entityId = await DBOS.runStep(
					() => createDocument(input.organizationId, input.userId, input.data),
					{ name: 'createDocument' }
				);
				break;

			case 'CREATE_DOCUMENT_METADATA':
				entityId = await DBOS.runStep(
					() => createDocumentMetadata(input.organizationId, input.userId, input.data),
					{ name: 'createDocumentMetadata' }
				);
				break;

			case 'UPDATE_DOCUMENT':
				entityId = await DBOS.runStep(
					() => updateDocument(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'updateDocument' }
				);
				break;

			case 'CREATE_VERSION':
				entityId = await DBOS.runStep(
					() => createVersion(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'createVersion' }
				);
				break;

			case 'RESTORE_VERSION':
				entityId = await DBOS.runStep(
					() => restoreVersion(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'restoreVersion' }
				);
				break;

			case 'CHANGE_CATEGORY':
				entityId = await DBOS.runStep(
					() => changeCategory(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'changeCategory' }
				);
				break;

			case 'ADD_CONTEXT_BINDING':
				entityId = await DBOS.runStep(
					() => addContextBinding(input.organizationId, input.userId, input.documentId!, input.data),
					{ name: 'addContextBinding' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[DocumentWorkflow] Error in ${input.action}:`, errorMessage);
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
