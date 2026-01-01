import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { MediaType } from '../../../../../../generated/prisma/client.js';
import { startMediaWorkflow } from '../../../workflows/mediaWorkflow.js';

const jobMediaOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobId: z.string(),
	jobVisitId: z.string().nullable(),
	mediaType: z.nativeEnum(MediaType),
	fileName: z.string(),
	fileSize: z.number(),
	mimeType: z.string(),
	storageKey: z.string(),
	storageUrl: z.string().nullable(),
	caption: z.string().nullable(),
	latitude: z.string().nullable(),
	longitude: z.string().nullable(),
	capturedAt: z.string().nullable(),
	transcription: z.string().nullable(),
	isTranscribed: z.boolean(),
	isUploaded: z.boolean(),
	uploadedAt: z.string().nullable(),
	uploadedBy: z.string(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatJobMedia = (m: any) => ({
	id: m.id,
	organizationId: m.organizationId,
	jobId: m.jobId,
	jobVisitId: m.jobVisitId,
	mediaType: m.mediaType,
	fileName: m.fileName,
	fileSize: m.fileSize,
	mimeType: m.mimeType,
	storageKey: m.storageKey,
	storageUrl: m.storageUrl,
	caption: m.caption,
	latitude: m.latitude?.toString() ?? null,
	longitude: m.longitude?.toString() ?? null,
	capturedAt: m.capturedAt?.toISOString() ?? null,
	transcription: m.transcription,
	isTranscribed: m.isTranscribed,
	isUploaded: m.isUploaded,
	uploadedAt: m.uploadedAt?.toISOString() ?? null,
	uploadedBy: m.uploadedBy,
	createdAt: m.createdAt.toISOString(),
	updatedAt: m.updatedAt.toISOString()
});

export const mediaRouter = {
	/**
	 * Register media upload (stub - actual upload handled separately)
	 */
	register: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					jobVisitId: z.string().optional(),
					mediaType: z.nativeEnum(MediaType),
					fileName: z.string(),
					fileSize: z.number().int().positive(),
					mimeType: z.string(),
					storageKey: z.string(), // Pre-generated or from upload service
					caption: z.string().optional(),
					latitude: z.number().optional(),
					longitude: z.number().optional(),
					capturedAt: z.string().datetime().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job_media', 'new');

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw errors.NOT_FOUND({ message: 'Job not found' });

			// Use DBOS workflow for durable execution
			const result = await startMediaWorkflow(
				{
					action: 'REGISTER_MEDIA',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						jobId: input.jobId,
						jobVisitId: input.jobVisitId,
						mediaType: input.mediaType,
						fileName: input.fileName,
						fileSize: input.fileSize,
						mimeType: input.mimeType,
						storageKey: input.storageKey,
						caption: input.caption,
						latitude: input.latitude,
						longitude: input.longitude,
						capturedAt: input.capturedAt
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to register media' });
			}

			const media = await prisma.jobMedia.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ media: formatJobMedia(media) }, context);
		}),

	/**
	 * Mark media as uploaded (called after actual file upload completes)
	 */
	markUploaded: orgProcedure
		.input(
			z
				.object({
					mediaId: z.string(),
					storageUrl: z.string().optional() // Presigned URL if available
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);

			const existing = await prisma.jobMedia.findFirst({
				where: { id: input.mediaId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Media not found' });

			// Use DBOS workflow for durable execution
			const result = await startMediaWorkflow(
				{
					action: 'MARK_UPLOADED',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					mediaId: input.mediaId,
					data: { storageUrl: input.storageUrl }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to mark media as uploaded' });
			}

			const media = await prisma.jobMedia.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ media: formatJobMedia(media) }, context);
		}),

	/**
	 * Add voice note with transcription stub
	 */
	addVoiceNote: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					jobVisitId: z.string().optional(),
					fileName: z.string(),
					fileSize: z.number().int().positive(),
					mimeType: z.string(),
					storageKey: z.string(),
					caption: z.string().optional(),
					latitude: z.number().optional(),
					longitude: z.number().optional(),
					capturedAt: z.string().datetime().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job_media', 'new');

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw errors.NOT_FOUND({ message: 'Job not found' });

			// Use DBOS workflow for durable execution
			const result = await startMediaWorkflow(
				{
					action: 'ADD_VOICE_NOTE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						jobId: input.jobId,
						jobVisitId: input.jobVisitId,
						fileName: input.fileName,
						fileSize: input.fileSize,
						mimeType: input.mimeType,
						storageKey: input.storageKey,
						caption: input.caption,
						latitude: input.latitude,
						longitude: input.longitude,
						capturedAt: input.capturedAt
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add voice note' });
			}

			const media = await prisma.jobMedia.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ media: formatJobMedia(media) }, context);
		}),

	/**
	 * Update transcription (called by transcription service)
	 */
	updateTranscription: orgProcedure
		.input(
			z
				.object({
					mediaId: z.string(),
					transcription: z.string()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);

			const existing = await prisma.jobMedia.findFirst({
				where: { id: input.mediaId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Media not found' });

			if (existing.mediaType !== 'AUDIO') {
				throw errors.BAD_REQUEST({ message: 'Transcription only applies to audio media' });
			}

			// Use DBOS workflow for durable execution
			const result = await startMediaWorkflow(
				{
					action: 'UPDATE_TRANSCRIPTION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					mediaId: input.mediaId,
					data: { transcription: input.transcription }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update transcription' });
			}

			const media = await prisma.jobMedia.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ media: formatJobMedia(media) }, context);
		}),

	/**
	 * List media for a job
	 */
	listByJob: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					mediaType: z.nativeEnum(MediaType).optional(),
					jobVisitId: z.string().optional()
				})
				.merge(PaginationInputSchema)
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					media: z.array(jobMediaOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_media', input.jobId);

			const limit = input.limit ?? 50;
			const cursor = input.cursor;

			const where = {
				organizationId: context.organization!.id,
				jobId: input.jobId,
				...(input.mediaType && { mediaType: input.mediaType }),
				...(input.jobVisitId && { jobVisitId: input.jobVisitId })
			};

			const media = await prisma.jobMedia.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = media.length > limit;
			if (hasMore) media.pop();

			const nextCursor = hasMore ? media[media.length - 1]?.id ?? null : null;

			return successResponse(
				{
					media: media.map(formatJobMedia),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Get media by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_media', input.id);

			const media = await prisma.jobMedia.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});

			if (!media) throw errors.NOT_FOUND({ message: 'Media not found' });

			return successResponse({ media: formatJobMedia(media) }, context);
		}),

	/**
	 * Delete media
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('delete', 'job_media', input.id);

			const existing = await prisma.jobMedia.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Media not found' });

			// Use DBOS workflow for durable execution
			const result = await startMediaWorkflow(
				{
					action: 'DELETE_MEDIA',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					mediaId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete media' });
			}

			return successResponse({ deleted: true }, context);
		})
};
