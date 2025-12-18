import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { MediaType } from '../../../../../../generated/prisma/client.js';

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_media', 'new');

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw ApiException.notFound('Job');

			const createMedia = async () => {
				return prisma.jobMedia.create({
					data: {
						organizationId: context.organization!.id,
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
						capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
						uploadedBy: context.user!.id,
						isUploaded: false // Will be marked true after actual upload
					}
				});
			};

			const media = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createMedia)).result
				: await createMedia();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.jobMedia.findFirst({
				where: { id: input.mediaId, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Media');

			const markUploaded = async () => {
				return prisma.jobMedia.update({
					where: { id: input.mediaId },
					data: {
						isUploaded: true,
						uploadedAt: new Date(),
						storageUrl: input.storageUrl
					}
				});
			};

			const media = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, markUploaded)).result
				: await markUploaded();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_media', 'new');

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw ApiException.notFound('Job');

			const createVoiceNote = async () => {
				return prisma.jobMedia.create({
					data: {
						organizationId: context.organization!.id,
						jobId: input.jobId,
						jobVisitId: input.jobVisitId,
						mediaType: 'AUDIO',
						fileName: input.fileName,
						fileSize: input.fileSize,
						mimeType: input.mimeType,
						storageKey: input.storageKey,
						caption: input.caption,
						latitude: input.latitude,
						longitude: input.longitude,
						capturedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
						uploadedBy: context.user!.id,
						isUploaded: false,
						isTranscribed: false
						// Transcription would be handled by a background job
					}
				});
			};

			const media = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createVoiceNote)).result
				: await createVoiceNote();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.jobMedia.findFirst({
				where: { id: input.mediaId, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Media');

			if (existing.mediaType !== 'AUDIO') {
				throw ApiException.badRequest('Transcription only applies to audio media');
			}

			const updateTranscription = async () => {
				return prisma.jobMedia.update({
					where: { id: input.mediaId },
					data: {
						transcription: input.transcription,
						isTranscribed: true
					}
				});
			};

			const media = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateTranscription)).result
				: await updateTranscription();

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
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ media: jobMediaOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job_media', input.id);

			const media = await prisma.jobMedia.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});

			if (!media) throw ApiException.notFound('Media');

			return successResponse({ media: formatJobMedia(media) }, context);
		}),

	/**
	 * Delete media
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'job_media', input.id);

			const existing = await prisma.jobMedia.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Media');

			const deleteMedia = async () => {
				// Note: Actual file deletion from storage would be handled separately
				await prisma.jobMedia.delete({ where: { id: input.id } });
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteMedia)).result
				: await deleteMedia();

			return successResponse(result, context);
		})
};
