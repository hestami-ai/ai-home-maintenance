import { z } from 'zod';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import {
	successResponseSchema,
	ResponseMetaSchema,
	DocumentCategorySchema,
	DocumentContextTypeSchema,
	DocumentVisibilitySchema,
	DocumentStatusSchema,
	StorageProviderSchema,
	JsonSchema
} from '../schemas.js';
import { startDocumentWorkflow } from '../../workflows/documentWorkflow.js';
import { recordActivityFromContext } from '../middleware/activityEvent.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { recordSpanError } from '../middleware/tracing.js';
import { createLogger, createModuleLogger } from '../../logger.js';

const log = createModuleLogger('DocumentRoute');

// Use shared enum schemas from schemas.ts
const DocumentCategoryEnum = DocumentCategorySchema;
const DocumentContextTypeEnum = DocumentContextTypeSchema;
const DocumentVisibilityEnum = DocumentVisibilitySchema;
const DocumentStatusEnum = DocumentStatusSchema;
const StorageProviderEnum = StorageProviderSchema;


// Helper to get upload directory path
const getUploadDir = () => {
	// UPLOAD_DIR should be set in production (e.g., /mnt/hestami-user-media)
	// Falls back to ./uploads relative to cwd for local development
	return process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
};

// Helper to compute file checksum
const computeChecksum = async (buffer: ArrayBuffer): Promise<string> => {
	const hash = createHash('sha256');
	hash.update(Buffer.from(buffer));
	return hash.digest('hex');
};

// Helper to save file to local storage
const saveFileToLocal = async (
	file: File,
	organizationId: string,
	contextType: string,
	contextId: string
): Promise<{ storagePath: string; fileUrl: string; checksum: string }> => {
	const uploadDir = getUploadDir();
	const orgDir = join(uploadDir, organizationId, contextType.toLowerCase(), contextId);

	// Ensure directory exists
	await mkdir(orgDir, { recursive: true });

	// Generate unique filename
	const timestamp = Date.now();
	const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
	const fileName = `${timestamp}-${safeFileName}`;
	const filePath = join(orgDir, fileName);

	// Read file content and compute checksum
	const buffer = await file.arrayBuffer();
	const checksum = await computeChecksum(buffer);

	// Write file to disk
	await writeFile(filePath, Buffer.from(buffer));

	// Return relative path for storage
	const storagePath = join(organizationId, contextType.toLowerCase(), contextId, fileName);
	const fileUrl = `/uploads/${storagePath.replace(/\\/g, '/')}`;

	return { storagePath, fileUrl, checksum };
};

export const documentRouter = {
	// =========================================================================
	// Document Upload & Creation (with actual file)
	// =========================================================================

	/**
	 * Upload a document with the actual file content.
	 * Uses oRPC's native File/Blob support.
	 */
	uploadWithFile: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				file: z.instanceof(File),
				contextType: DocumentContextTypeEnum,
				contextId: z.string(),
				title: z.string().max(255),
				description: z.string().optional(),
				category: DocumentCategoryEnum,
				visibility: DocumentVisibilityEnum.optional(),
				effectiveDate: z.string().datetime().optional(),
				expirationDate: z.string().datetime().optional(),
				tags: z.array(z.string()).optional()
			})
		)
		.output(
			successResponseSchema(
				z.object({
					document: z.object({
						id: z.string(),
						title: z.string(),
						fileName: z.string(),
						fileSize: z.number(),
						mimeType: z.string(),
						category: DocumentCategorySchema,
						status: DocumentStatusSchema,
						version: z.number(),
						fileUrl: z.string(),
						createdAt: z.string()
					})
				})
			)
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const reqLog = createLogger(context).child({ handler: 'uploadWithFile' });

			reqLog.info('Document upload started', {
				fileName: input.file.name,
				fileSize: input.file.size,
				mimeType: input.file.type,
				category: input.category,
				contextType: input.contextType,
				contextId: input.contextId
			});

			try {
				await context.cerbos.authorize('create', 'document', 'new');
				reqLog.debug('Authorization passed for document creation');

				// Save file to local storage first (non-idempotent file operation)
				reqLog.debug('Saving file to local storage');
				const { storagePath, fileUrl, checksum } = await saveFileToLocal(
					input.file,
					context.organization.id,
					input.contextType,
					input.contextId
				);
				reqLog.debug('File saved to local storage', { storagePath, fileUrl });

				// Use DBOS workflow for durable database execution
				reqLog.debug('Starting document workflow', { action: 'CREATE_DOCUMENT' });
				const workflowResult = await startDocumentWorkflow(
					{
						action: 'CREATE_DOCUMENT',
						organizationId: context.organization.id,
						userId: context.user.id,
						data: {
							title: input.title,
							description: input.description,
							category: input.category,
							visibility: input.visibility ?? 'PUBLIC',
							storagePath,
							fileUrl,
							fileName: input.file.name,
							fileSize: input.file.size,
							mimeType: input.file.type || 'application/octet-stream',
							checksum,
							contextType: input.contextType,
							contextId: input.contextId
						}
					},
					input.idempotencyKey
				);

				if (!workflowResult.success) {
					reqLog.error('Document workflow failed', { error: workflowResult.error });
					throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create document' });
				}

				reqLog.debug('Document workflow completed', { documentId: workflowResult.entityId });

				const document = await prisma.document.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

				reqLog.info('Document upload completed', {
					documentId: document.id,
					fileName: document.fileName,
					version: document.version
				});

				return successResponse(
					{
						document: {
							id: document.id,
							title: document.title,
							fileName: document.fileName,
							fileSize: document.fileSize,
							mimeType: document.mimeType,
							category: document.category,
							status: document.status,
							version: document.version,
							fileUrl: document.fileUrl,
							createdAt: document.createdAt.toISOString()
						}
					},
					context
				);
			} catch (error) {
				const errorObj = error instanceof Error ? error : new Error(String(error));
				reqLog.exception(errorObj, {
					fileName: input.file.name,
					category: input.category
				});
				// Record error on span for trace visibility
				await recordSpanError(errorObj, {
					errorCode: 'UPLOAD_FAILED',
					errorType: 'DOCUMENT_UPLOAD_ERROR'
				});
				throw error;
			}
		}),

	/**
	 * Upload a new version of an existing document with the actual file content.
	 */
	uploadVersionWithFile: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				file: z.instanceof(File),
				parentDocumentId: z.string()
			})
		)
		.output(
			successResponseSchema(
				z.object({
					document: z.object({
						id: z.string(),
						title: z.string(),
						fileName: z.string(),
						fileSize: z.number(),
						mimeType: z.string(),
						version: z.number(),
						fileUrl: z.string(),
						createdAt: z.string()
					})
				})
			)
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			// Get parent document
			const parent = await prisma.document.findFirst({
				where: {
					id: input.parentDocumentId,
					organizationId: context.organization.id
				},
				include: {
					contextBindings: true
				}
			});

			if (!parent) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('update', 'document', parent.id);

			// Get primary context binding
			const primaryBinding = parent.contextBindings.find(b => b.isPrimary);
			if (!primaryBinding) {
				throw errors.BAD_REQUEST({ message: 'Document has no primary context binding' });
			}

			// Save file to local storage first (non-idempotent file operation)
			const { storagePath, fileUrl, checksum } = await saveFileToLocal(
				input.file,
				context.organization.id,
				primaryBinding.contextType,
				primaryBinding.contextId
			);

			// Use DBOS workflow for durable database execution
			const workflowResult = await startDocumentWorkflow(
				{
					action: 'CREATE_VERSION',
					organizationId: context.organization.id,
					userId: context.user.id,
					documentId: parent.parentDocumentId ?? parent.id,
					data: {
						fileName: input.file.name,
						fileSize: input.file.size,
						mimeType: input.file.type || 'application/octet-stream',
						storagePath,
						fileUrl,
						checksum
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create document version' });
			}

			const document = await prisma.document.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					document: {
						id: document.id,
						title: document.title,
						fileName: document.fileName,
						fileSize: document.fileSize,
						mimeType: document.mimeType,
						version: document.version,
						fileUrl: document.fileUrl,
						createdAt: document.createdAt.toISOString()
					}
				},
				context
			);
		}),

	// =========================================================================
	// Document Upload & Creation (metadata only - for pre-uploaded files)
	// =========================================================================

	uploadDocument: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				contextType: DocumentContextTypeEnum,
				contextId: z.string(),
				title: z.string().max(255),
				description: z.string().optional(),
				category: DocumentCategoryEnum,
				visibility: DocumentVisibilityEnum.optional(),
				storageProvider: StorageProviderEnum.optional(),
				storagePath: z.string(),
				fileUrl: z.string(),
				fileName: z.string(),
				fileSize: z.number().int().positive(),
				mimeType: z.string(),
				checksum: z.string().optional(),
				effectiveDate: z.string().datetime().optional(),
				expirationDate: z.string().datetime().optional(),
				tags: z.array(z.string()).optional()
			})
		)
		.output(
			successResponseSchema(
				z.object({
					document: z.object({
						id: z.string(),
						title: z.string(),
						category: DocumentCategorySchema,
						status: DocumentStatusSchema,
						version: z.number(),
						createdAt: z.string()
					})
				})
			)
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'document', 'new');

			// Use DBOS workflow for durable database execution
			const workflowResult = await startDocumentWorkflow(
				{
					action: 'CREATE_DOCUMENT_METADATA',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						title: input.title,
						description: input.description,
						category: input.category,
						visibility: input.visibility ?? 'PUBLIC',
						storageProvider: input.storageProvider ?? 'LOCAL',
						storagePath: input.storagePath,
						fileUrl: input.fileUrl,
						fileName: input.fileName,
						fileSize: input.fileSize,
						mimeType: input.mimeType,
						checksum: input.checksum,
						contextType: input.contextType,
						contextId: input.contextId
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create document' });
			}

			const document = await prisma.document.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					document: {
						id: document.id,
						title: document.title,
						category: document.category,
						status: document.status,
						version: document.version,
						createdAt: document.createdAt.toISOString()
					}
				},
				context
			);
		}),

	// =========================================================================
	// Document Retrieval
	// =========================================================================

	getDocument: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					document: z.object({
						id: z.string(),
						title: z.string(),
						description: z.string().nullable(),
						category: z.string(),
						visibility: z.string(),
						status: z.string(),
						storageProvider: z.string(),
						storagePath: z.string(),
						fileUrl: z.string(),
						fileName: z.string(),
						fileSize: z.number(),
						mimeType: z.string(),
						checksum: z.string().nullable(),
						pageCount: z.number().nullable(),
						thumbnailUrl: z.string().nullable(),
						version: z.number(),
						effectiveDate: z.string().nullable(),
						expirationDate: z.string().nullable(),
						tags: z.array(z.string()),
						uploadedBy: z.string(),
						archivedAt: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					versions: z.array(
						z.object({
							id: z.string(),
							version: z.number(),
							createdAt: z.string()
						})
					),
					contextBindings: z.array(
						z.object({
							contextType: z.string(),
							contextId: z.string(),
							isPrimary: z.boolean()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				},
				include: {
					childVersions: { where: { deletedAt: null }, orderBy: { version: 'desc' } },
					contextBindings: true
				}
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('view', 'document', document.id);

			return successResponse(
				{
					document: {
						id: document.id,
						title: document.title,
						description: document.description ?? null,
						category: document.category,
						visibility: document.visibility,
						status: document.status,
						storageProvider: document.storageProvider,
						storagePath: document.storagePath,
						fileUrl: document.fileUrl,
						fileName: document.fileName,
						fileSize: document.fileSize,
						mimeType: document.mimeType,
						checksum: document.checksum ?? null,
						pageCount: document.pageCount ?? null,
						thumbnailUrl: document.thumbnailUrl ?? null,
						version: document.version,
						effectiveDate: document.effectiveDate?.toISOString() ?? null,
						expirationDate: document.expirationDate?.toISOString() ?? null,
						tags: document.tags,
						uploadedBy: document.uploadedBy,
						archivedAt: document.archivedAt?.toISOString() ?? null,
						createdAt: document.createdAt.toISOString(),
						updatedAt: document.updatedAt.toISOString()
					},
					versions: document.childVersions.map((v: { id: string; version: number; createdAt: Date }) => ({
						id: v.id,
						version: v.version,
						createdAt: v.createdAt.toISOString()
					})),
					contextBindings: document.contextBindings.map((b: { contextType: string; contextId: string; isPrimary: boolean }) => ({
						contextType: b.contextType,
						contextId: b.contextId,
						isPrimary: b.isPrimary
					}))
				},
				context
			);
		}),

	listDocuments: orgProcedure
		.input(
			PaginationInputSchema.extend({
				contextType: DocumentContextTypeEnum.optional(),
				contextId: z.string().optional(),
				category: DocumentCategoryEnum.optional(),
				status: DocumentStatusEnum.optional(),
				search: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					documents: z.array(
						z.object({
							id: z.string(),
							title: z.string(),
							category: z.string(),
							status: z.string(),
							visibility: z.string(),
							fileName: z.string(),
							fileSize: z.number(),
							mimeType: z.string(),
							version: z.number(),
							createdAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			try {
				await context.cerbos.authorize('view', 'document', 'list');

				const where: Prisma.DocumentWhereInput = {
					organizationId: context.organization.id,
					deletedAt: null,
					...(input.category && { category: input.category }),
					...(input.status && { status: input.status }),
					...(input.contextType && input.contextId && {
						contextBindings: {
							some: {
								contextType: input.contextType,
								contextId: input.contextId
							}
						}
					}),
					...(input.search && {
						OR: [
							{ title: { contains: input.search, mode: 'insensitive' as const } },
							{ description: { contains: input.search, mode: 'insensitive' as const } },
							{ tags: { has: input.search } }
						]
					})
				};

				const documents = await prisma.document.findMany({
					where,
					take: input.limit + 1,
					...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
					orderBy: { createdAt: 'desc' }
				});

				const hasMore = documents.length > input.limit;
				const items = hasMore ? documents.slice(0, -1) : documents;

				return successResponse(
					{
						documents: items.map((d) => ({
							id: d.id,
							title: d.title,
							category: d.category,
							status: d.status,
							visibility: d.visibility,
							fileName: d.fileName,
							fileSize: d.fileSize,
							mimeType: d.mimeType,
							version: d.version,
							createdAt: d.createdAt.toISOString()
						})),
						pagination: {
							nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
							hasMore
						}
					},
					context
				);
			} catch (error) {
				const errorObj = error instanceof Error ? error : new Error(String(error));
				console.error('[document.listDocuments] Error:', error);

				// Record error on span for trace visibility
				await recordSpanError(errorObj, {
					errorCode: 'LIST_FAILED',
					errorType: 'DOCUMENT_LIST_ERROR'
				});

				throw error;
			}
		}),

	// =========================================================================
	// Document Updates
	// =========================================================================

	updateMetadata: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				title: z.string().max(255).optional(),
				description: z.string().optional(),
				category: DocumentCategoryEnum.optional(),
				visibility: DocumentVisibilityEnum.optional(),
				effectiveDate: z.string().datetime().optional(),
				expirationDate: z.string().datetime().optional(),
				tags: z.array(z.string()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					document: z.object({
						id: z.string(),
						title: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('update', 'document', document.id);

			// Use DBOS workflow for durable database execution
			const workflowResult = await startDocumentWorkflow(
				{
					action: 'UPDATE_DOCUMENT',
					organizationId: context.organization.id,
					userId: context.user.id,
					documentId: input.id,
					data: {
						title: input.title,
						description: input.description,
						category: input.category,
						visibility: input.visibility
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to update document' });
			}

			const updated = await prisma.document.findUniqueOrThrow({ where: { id: input.id } });

			return successResponse(
				{
					document: {
						id: updated.id,
						title: updated.title,
						updatedAt: updated.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	updateExtractedMetadata: orgProcedure
		.input(
			z.object({
				id: z.string(),
				pageCount: z.number().int().positive().optional(),
				thumbnailUrl: z.string().optional(),
				extractedText: z.string().optional(),
				metadata: z.record(z.string(), JsonSchema).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('update', 'document', document.id);

			await prisma.document.update({
				where: { id: input.id },
				data: {
					...(input.pageCount && { pageCount: input.pageCount }),
					...(input.thumbnailUrl && { thumbnailUrl: input.thumbnailUrl }),
					...(input.extractedText && { extractedText: input.extractedText }),
					...(input.metadata && { metadata: input.metadata as Prisma.InputJsonValue })
				}
			});

			return successResponse({ success: true }, context);
		}),

	// =========================================================================
	// Document Versioning
	// =========================================================================

	uploadNewVersion: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				parentDocumentId: z.string(),
				storagePath: z.string(),
				fileUrl: z.string(),
				fileName: z.string(),
				fileSize: z.number().int().positive(),
				mimeType: z.string(),
				checksum: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					document: z.object({
						id: z.string(),
						version: z.number(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const parent = await prisma.document.findFirst({
				where: { id: input.parentDocumentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!parent) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('update', 'document', parent.id);

			// Use DBOS workflow for durable database execution
			const workflowResult = await startDocumentWorkflow(
				{
					action: 'CREATE_VERSION',
					organizationId: context.organization.id,
					userId: context.user.id,
					documentId: input.parentDocumentId,
					data: {
						storagePath: input.storagePath,
						fileUrl: input.fileUrl,
						fileName: input.fileName,
						fileSize: input.fileSize,
						mimeType: input.mimeType,
						checksum: input.checksum
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create document version' });
			}

			const document = await prisma.document.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					document: {
						id: document.id,
						version: document.version,
						createdAt: document.createdAt.toISOString()
					}
				},
				context
			);
		}),

	getVersions: orgProcedure
		.input(z.object({ documentId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					versions: z.array(
						z.object({
							id: z.string(),
							version: z.number(),
							status: DocumentStatusEnum,
							fileName: z.string(),
							fileSize: z.number(),
							uploadedBy: z.string(),
							createdAt: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('view', 'document', document.id);

			// Get all versions (parent and children)
			const rootId = document.parentDocumentId ?? document.id;
			const versions = await prisma.document.findMany({
				where: {
					OR: [{ id: rootId }, { parentDocumentId: rootId }],
					deletedAt: null
				},
				orderBy: { version: 'desc' }
			});

			return successResponse(
				{
					versions: versions.map((v) => ({
						id: v.id,
						version: v.version,
						status: v.status,
						fileName: v.fileName,
						fileSize: v.fileSize,
						uploadedBy: v.uploadedBy,
						createdAt: v.createdAt.toISOString()
					}))
				},
				context
			);
		}),

	revertToVersion: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				documentId: z.string(),
				targetVersionId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					document: z.object({
						id: z.string(),
						version: z.number()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Entity not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const current = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!current) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			const target = await prisma.document.findFirst({
				where: { id: input.targetVersionId, deletedAt: null }
			});

			if (!target) throw errors.NOT_FOUND({ message: 'Target version' });

			await context.cerbos.authorize('update', 'document', current.id);

			// Use DBOS workflow for durable database execution
			const workflowResult = await startDocumentWorkflow(
				{
					action: 'RESTORE_VERSION',
					organizationId: context.organization.id,
					userId: context.user.id,
					documentId: input.documentId,
					data: {
						targetVersionId: input.targetVersionId
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to restore document version' });
			}

			const reverted = await prisma.document.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					document: {
						id: reverted.id,
						version: reverted.version
					}
				},
				context
			);
		}),

	// =========================================================================
	// Document Archive & Restore
	// =========================================================================

	archiveDocument: orgProcedure
		.input(
			z.object({
				id: z.string(),
				reason: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean(), archivedAt: z.string() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('delete', 'document', document.id);

			const now = new Date();
			await prisma.document.update({
				where: { id: input.id },
				data: {
					status: 'ARCHIVED',
					archivedAt: now,
					archivedBy: context.user.id,
					archiveReason: input.reason
				}
			});

			return successResponse({ success: true, archivedAt: now.toISOString() }, context);
		}),

	restoreDocument: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, status: 'ARCHIVED', deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('update', 'document', document.id);

			await prisma.document.update({
				where: { id: input.id },
				data: {
					status: 'ACTIVE',
					archivedAt: null,
					archivedBy: null,
					archiveReason: null
				}
			});

			return successResponse({ success: true }, context);
		}),

	// =========================================================================
	// Document Download Tracking
	// =========================================================================

	logDownload: orgProcedure
		.input(
			z.object({
				documentId: z.string(),
				partyId: z.string().optional(),
				ipAddress: z.string().optional(),
				userAgent: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ logged: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await prisma.documentDownloadLog.create({
				data: {
					documentId: input.documentId,
					partyId: input.partyId,
					userId: context.user.id,
					ipAddress: input.ipAddress,
					userAgent: input.userAgent
				}
			});

			return successResponse({ logged: true }, context);
		}),

	getDownloadHistory: orgProcedure
		.input(
			PaginationInputSchema.extend({
				documentId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					downloads: z.array(
						z.object({
							id: z.string(),
							userId: z.string(),
							partyId: z.string().nullable(),
							downloadedAt: z.string(),
							ipAddress: z.string().nullable()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('view', 'document', document.id);

			const downloads = await prisma.documentDownloadLog.findMany({
				where: { documentId: input.documentId },
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { downloadedAt: 'desc' }
			});

			const hasMore = downloads.length > input.limit;
			const items = hasMore ? downloads.slice(0, -1) : downloads;

			return successResponse(
				{
					downloads: items.map((d) => ({
						id: d.id,
						userId: d.userId,
						partyId: d.partyId ?? null,
						downloadedAt: d.downloadedAt.toISOString(),
						ipAddress: d.ipAddress ?? null
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	// =========================================================================
	// Document Classification (CAM-specific)
	// =========================================================================

	classifyDocument: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				category: DocumentCategoryEnum,
				reason: z.string().min(1, 'Reason is required for classification changes')
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					document: z.object({
						id: z.string(),
						category: z.string(),
						previousCategory: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null },
				include: { contextBindings: true }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('update', 'document', document.id);

			// Check if document is referenced - referenced documents may have restrictions
			const hasReferences = document.contextBindings.length > 0;
			if (hasReferences && document.status === 'ACTIVE') {
				// Allow reclassification but log it prominently
			}

			const previousCategory = document.category;

			// Use DBOS workflow for durable database execution
			const workflowResult = await startDocumentWorkflow(
				{
					action: 'CHANGE_CATEGORY',
					organizationId: context.organization.id,
					userId: context.user.id,
					documentId: input.id,
					data: {
						category: input.category
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to change document category' });
			}

			const updated = await prisma.document.findUniqueOrThrow({ where: { id: input.id } });

			// Record audit event for classification change
			await recordActivityFromContext(context, {
				entityType: 'DOCUMENT',
				entityId: document.id,
				action: 'CLASSIFY',
				eventCategory: 'EXECUTION',
				summary: `Document reclassified from ${previousCategory} to ${input.category}: ${input.reason}`,
				previousState: { category: previousCategory },
				newState: { category: input.category },
				metadata: { reason: input.reason }
			});

			return successResponse(
				{
					document: {
						id: updated.id,
						category: updated.category,
						previousCategory,
						updatedAt: updated.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	// =========================================================================
	// Document Context Linking
	// =========================================================================

	linkToContext: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				documentId: z.string(),
				contextType: DocumentContextTypeEnum,
				contextId: z.string(),
				isPrimary: z.boolean().optional(),
				bindingNotes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					binding: z.object({
						id: z.string(),
						documentId: z.string(),
						contextType: z.string(),
						contextId: z.string(),
						isPrimary: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('update', 'document', document.id);

			// Use DBOS workflow for durable database execution
			const workflowResult = await startDocumentWorkflow(
				{
					action: 'ADD_CONTEXT_BINDING',
					organizationId: context.organization.id,
					userId: context.user.id,
					documentId: input.documentId,
					data: {
						contextType: input.contextType,
						contextId: input.contextId,
						isPrimary: input.isPrimary ?? false
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to link document to context' });
			}

			const binding = await prisma.documentContextBinding.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			// Record audit event for document reference
			await recordActivityFromContext(context, {
				entityType: 'DOCUMENT',
				entityId: document.id,
				action: 'REFERENCED',
				eventCategory: 'EXECUTION',
				summary: `Document linked to ${input.contextType} ${input.contextId}`,
				newState: { contextType: input.contextType, contextId: input.contextId },
				metadata: {
					documentsReferenced: [{ documentId: document.id, version: document.version }]
				}
			});

			return successResponse(
				{
					binding: {
						id: binding.id,
						documentId: binding.documentId,
						contextType: binding.contextType,
						contextId: binding.contextId,
						isPrimary: binding.isPrimary
					}
				},
				context
			);
		}),

	unlinkFromContext: orgProcedure
		.input(
			z.object({
				documentId: z.string(),
				contextType: DocumentContextTypeEnum,
				contextId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('update', 'document', document.id);

			await prisma.documentContextBinding.deleteMany({
				where: {
					documentId: input.documentId,
					contextType: input.contextType,
					contextId: input.contextId
				}
			});

			return successResponse({ success: true }, context);
		}),

	// =========================================================================
	// Document References Query
	// =========================================================================

	getReferences: orgProcedure
		.input(z.object({ documentId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					references: z.array(
						z.object({
							contextType: z.string(),
							contextId: z.string(),
							isPrimary: z.boolean(),
							bindingNotes: z.string().nullable(),
							createdAt: z.string()
						})
					),
					referenceCount: z.number(),
					byType: z.record(z.string(), z.number())
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('view', 'document', document.id);

			const bindings = await prisma.documentContextBinding.findMany({
				where: { documentId: input.documentId },
				orderBy: { createdAt: 'desc' }
			});

			// Group by type for summary
			const byType: Record<string, number> = {};
			for (const binding of bindings) {
				byType[binding.contextType] = (byType[binding.contextType] ?? 0) + 1;
			}

			return successResponse(
				{
					references: bindings.map((b) => ({
						contextType: b.contextType,
						contextId: b.contextId,
						isPrimary: b.isPrimary,
						bindingNotes: b.bindingNotes ?? null,
						createdAt: b.createdAt.toISOString()
					})),
					referenceCount: bindings.length,
					byType
				},
				context
			);
		}),

	// =========================================================================
	// Document Activity History
	// =========================================================================

	getActivityHistory: orgProcedure
		.input(
			PaginationInputSchema.extend({
				documentId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(
						z.object({
							id: z.string(),
							action: z.string(),
							eventCategory: z.string(),
							summary: z.string(),
							performedById: z.string().nullable(),
							performedByType: z.string(),
							performedAt: z.string(),
							previousState: JsonSchema,
							newState: JsonSchema
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Document not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			await context.cerbos.authorize('view', 'document', document.id);

			const events = await prisma.activityEvent.findMany({
				where: {
					organizationId: context.organization.id,
					entityType: 'DOCUMENT',
					entityId: input.documentId
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { performedAt: 'desc' }
			});

			const hasMore = events.length > input.limit;
			const items = hasMore ? events.slice(0, -1) : events;

			return successResponse(
				{
					events: items.map((e) => ({
						id: e.id,
						action: e.action,
						eventCategory: e.eventCategory,
						summary: e.summary,
						performedById: e.performedById ?? null,
						performedByType: e.performedByType,
						performedAt: e.performedAt.toISOString(),
						previousState: e.previousState,
						newState: e.newState
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		})
};
