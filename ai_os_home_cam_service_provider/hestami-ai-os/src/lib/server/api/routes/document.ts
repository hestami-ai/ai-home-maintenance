import { z } from 'zod';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';
import {
	successResponseSchema,
	ResponseMetaSchema,
	DocumentCategorySchema,
	DocumentContextTypeSchema,
	DocumentVisibilitySchema,
	DocumentStatusSchema,
	StorageProviderSchema
} from '../schemas.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { recordActivityFromContext } from '../middleware/activityEvent.js';
import type { RequestContext } from '../context.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';

// Use shared enum schemas from schemas.ts
const DocumentCategoryEnum = DocumentCategorySchema;
const DocumentContextTypeEnum = DocumentContextTypeSchema;
const DocumentVisibilityEnum = DocumentVisibilitySchema;
const DocumentStatusEnum = DocumentStatusSchema;
const StorageProviderEnum = StorageProviderSchema;

const requireIdempotency = async <T>(
	key: string,
	ctx: RequestContext,
	fn: () => Promise<T>
) => {
	const { result } = await withIdempotency(key, ctx, fn);
	return result;
};

export const documentRouter = {
	// =========================================================================
	// Document Upload & Creation
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'document', 'new');

			return requireIdempotency(input.idempotencyKey, context, async () => {
				// Create document with organization scope
				const document = await prisma.document.create({
					data: {
						organizationId: context.organization.id,
						title: input.title,
						description: input.description,
						category: input.category,
						visibility: input.visibility ?? 'PUBLIC',
						status: 'ACTIVE',
						storageProvider: input.storageProvider ?? 'LOCAL',
						storagePath: input.storagePath,
						fileUrl: input.fileUrl,
						fileName: input.fileName,
						fileSize: input.fileSize,
						mimeType: input.mimeType,
						checksum: input.checksum,
						effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : undefined,
						expirationDate: input.expirationDate ? new Date(input.expirationDate) : undefined,
						tags: input.tags ?? [],
						uploadedBy: context.user.id,
						// Create context binding inline
						contextBindings: {
							create: {
								contextType: input.contextType,
								contextId: input.contextId,
								isPrimary: true,
								createdBy: context.user.id
							}
						}
					}
				});

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
			});
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
		.handler(async ({ input, context }) => {
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
				throw ApiException.notFound('Document');
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
						{ title: { contains: input.search, mode: 'insensitive' } },
						{ description: { contains: input.search, mode: 'insensitive' } },
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
			}

			await context.cerbos.authorize('update', 'document', document.id);

			return requireIdempotency(input.idempotencyKey, context, async () => {
				const updated = await prisma.document.update({
					where: { id: input.id },
					data: {
						...(input.title && { title: input.title }),
						...(input.description !== undefined && { description: input.description }),
						...(input.category && { category: input.category }),
						...(input.visibility && { visibility: input.visibility }),
						...(input.effectiveDate && { effectiveDate: new Date(input.effectiveDate) }),
						...(input.expirationDate && { expirationDate: new Date(input.expirationDate) }),
						...(input.tags && { tags: input.tags })
					}
				});

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
			});
		}),

	updateExtractedMetadata: orgProcedure
		.input(
			z.object({
				id: z.string(),
				pageCount: z.number().int().positive().optional(),
				thumbnailUrl: z.string().optional(),
				extractedText: z.string().optional(),
				metadata: z.record(z.string(), z.any()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
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
		.handler(async ({ input, context }) => {
			const parent = await prisma.document.findFirst({
				where: { id: input.parentDocumentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!parent) {
				throw ApiException.notFound('Document');
			}

			await context.cerbos.authorize('update', 'document', parent.id);

			return requireIdempotency(input.idempotencyKey, context, async () => {
				// Get max version
				const maxVersion = await prisma.document.aggregate({
					where: {
						OR: [{ id: input.parentDocumentId }, { parentDocumentId: input.parentDocumentId }]
					},
					_max: { version: true }
				});

				const newVersion = (maxVersion._max.version ?? 0) + 1;

				const document = await prisma.document.create({
					data: {
						organizationId: parent.organizationId,
						title: parent.title,
						description: parent.description,
						category: parent.category,
						visibility: parent.visibility,
						status: 'ACTIVE',
						storageProvider: parent.storageProvider,
						storagePath: input.storagePath,
						fileUrl: input.fileUrl,
						fileName: input.fileName,
						fileSize: input.fileSize,
						mimeType: input.mimeType,
						checksum: input.checksum,
						version: newVersion,
						parentDocumentId: input.parentDocumentId,
						effectiveDate: parent.effectiveDate,
						tags: parent.tags,
						uploadedBy: context.user.id
					}
				});

				// Mark parent as superseded
				await prisma.document.update({
					where: { id: input.parentDocumentId },
					data: { status: 'SUPERSEDED', supersededById: document.id }
				});

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
			});
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
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
		.handler(async ({ input, context }) => {
			const current = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!current) {
				throw ApiException.notFound('Document');
			}

			const target = await prisma.document.findFirst({
				where: { id: input.targetVersionId, deletedAt: null }
			});

			if (!target) throw ApiException.notFound('Target version');

			await context.cerbos.authorize('update', 'document', current.id);

			return requireIdempotency(input.idempotencyKey, context, async () => {
				// Create new version from target
				const maxVersion = await prisma.document.aggregate({
					where: {
						OR: [
							{ id: current.parentDocumentId ?? current.id },
							{ parentDocumentId: current.parentDocumentId ?? current.id }
						]
					},
					_max: { version: true }
				});

				const newVersion = (maxVersion._max.version ?? 0) + 1;

				const reverted = await prisma.document.create({
					data: {
						organizationId: target.organizationId,
						title: target.title,
						description: target.description,
						category: target.category,
						visibility: target.visibility,
						status: 'ACTIVE',
						storageProvider: target.storageProvider,
						storagePath: target.storagePath,
						fileUrl: target.fileUrl,
						fileName: target.fileName,
						fileSize: target.fileSize,
						mimeType: target.mimeType,
						checksum: target.checksum,
						version: newVersion,
						parentDocumentId: current.parentDocumentId ?? current.id,
						effectiveDate: target.effectiveDate,
						tags: target.tags,
						uploadedBy: context.user.id
					}
				});

				// Mark current as superseded
				await prisma.document.update({
					where: { id: input.documentId },
					data: { status: 'SUPERSEDED', supersededById: reverted.id }
				});

				return successResponse(
					{
						document: {
							id: reverted.id,
							version: reverted.version
						}
					},
					context
				);
			});
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, status: 'ARCHIVED', deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null },
				include: { contextBindings: true }
			});

			if (!document) {
				throw ApiException.notFound('Document');
			}

			await context.cerbos.authorize('update', 'document', document.id);

			// Check if document is referenced - referenced documents may have restrictions
			const hasReferences = document.contextBindings.length > 0;
			if (hasReferences && document.status === 'ACTIVE') {
				// Allow reclassification but log it prominently
			}

			const previousCategory = document.category;

			return requireIdempotency(input.idempotencyKey, context, async () => {
				const updated = await prisma.document.update({
					where: { id: input.id },
					data: { category: input.category }
				});

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
			});
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
			}

			await context.cerbos.authorize('update', 'document', document.id);

			return requireIdempotency(input.idempotencyKey, context, async () => {
				// Check if binding already exists
				const existing = await prisma.documentContextBinding.findUnique({
					where: {
						documentId_contextType_contextId: {
							documentId: input.documentId,
							contextType: input.contextType,
							contextId: input.contextId
						}
					}
				});

				if (existing) {
					return successResponse(
						{
							binding: {
								id: existing.id,
								documentId: existing.documentId,
								contextType: existing.contextType,
								contextId: existing.contextId,
								isPrimary: existing.isPrimary
							}
						},
						context
					);
				}

				const binding = await prisma.documentContextBinding.create({
					data: {
						documentId: input.documentId,
						contextType: input.contextType,
						contextId: input.contextId,
						isPrimary: input.isPrimary ?? false,
						bindingNotes: input.bindingNotes,
						createdBy: context.user.id
					}
				});

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
			});
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
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
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
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
							previousState: z.any(),
							newState: z.any()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
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
