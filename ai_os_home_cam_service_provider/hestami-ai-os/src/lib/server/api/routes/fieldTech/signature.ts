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
import { startSignatureWorkflow } from '../../../workflows/signatureWorkflow.js';

const jobSignatureOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobId: z.string(),
	jobVisitId: z.string().nullable(),
	signerName: z.string(),
	signerEmail: z.string().nullable(),
	signerRole: z.string(),
	signatureData: z.string(),
	signedAt: z.string(),
	latitude: z.string().nullable(),
	longitude: z.string().nullable(),
	documentType: z.string(),
	documentId: z.string().nullable(),
	ipAddress: z.string().nullable(),
	deviceInfo: z.string().nullable(),
	capturedBy: z.string(),
	createdAt: z.string()
});

const formatJobSignature = (s: any) => ({
	id: s.id,
	organizationId: s.organizationId,
	jobId: s.jobId,
	jobVisitId: s.jobVisitId,
	signerName: s.signerName,
	signerEmail: s.signerEmail,
	signerRole: s.signerRole,
	signatureData: s.signatureData,
	signedAt: s.signedAt.toISOString(),
	latitude: s.latitude?.toString() ?? null,
	longitude: s.longitude?.toString() ?? null,
	documentType: s.documentType,
	documentId: s.documentId,
	ipAddress: s.ipAddress,
	deviceInfo: s.deviceInfo,
	capturedBy: s.capturedBy,
	createdAt: s.createdAt.toISOString()
});

export const signatureRouter = {
	/**
	 * Capture a signature
	 */
	capture: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					jobVisitId: z.string().optional(),
					signerName: z.string().min(1).max(255),
					signerEmail: z.string().email().optional(),
					signerRole: z.string().min(1).max(100), // CUSTOMER, TECHNICIAN, MANAGER, etc.
					signatureData: z.string(), // Base64 or SVG path
					signedAt: z.string().datetime().optional(), // Defaults to now
					latitude: z.number().optional(),
					longitude: z.number().optional(),
					documentType: z.string().min(1).max(100), // WORK_COMPLETION, ESTIMATE_APPROVAL, etc.
					documentId: z.string().optional(),
					ipAddress: z.string().optional(),
					deviceInfo: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ signature: jobSignatureOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_signature', 'new');

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw ApiException.notFound('Job');

			// Use DBOS workflow for durable execution
			const result = await startSignatureWorkflow(
				{
					action: 'CAPTURE_SIGNATURE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						jobId: input.jobId,
						jobVisitId: input.jobVisitId,
						signerName: input.signerName,
						signerEmail: input.signerEmail,
						signerRole: input.signerRole,
						signatureData: input.signatureData,
						signedAt: input.signedAt,
						latitude: input.latitude,
						longitude: input.longitude,
						documentType: input.documentType,
						documentId: input.documentId,
						ipAddress: input.ipAddress,
						deviceInfo: input.deviceInfo
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to capture signature');
			}

			const signature = await prisma.jobSignature.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ signature: formatJobSignature(signature) }, context);
		}),

	/**
	 * List signatures for a job
	 */
	listByJob: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					documentType: z.string().optional(),
					signerRole: z.string().optional()
				})
				.merge(PaginationInputSchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					signatures: z.array(jobSignatureOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job_signature', input.jobId);

			const limit = input.limit ?? 50;
			const cursor = input.cursor;

			const where = {
				organizationId: context.organization!.id,
				jobId: input.jobId,
				...(input.documentType && { documentType: input.documentType }),
				...(input.signerRole && { signerRole: input.signerRole })
			};

			const signatures = await prisma.jobSignature.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { signedAt: 'desc' }
			});

			const hasMore = signatures.length > limit;
			if (hasMore) signatures.pop();

			const nextCursor = hasMore ? signatures[signatures.length - 1]?.id ?? null : null;

			return successResponse(
				{
					signatures: signatures.map(formatJobSignature),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Get signature by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ signature: jobSignatureOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job_signature', input.id);

			const signature = await prisma.jobSignature.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});

			if (!signature) throw ApiException.notFound('Signature');

			return successResponse({ signature: formatJobSignature(signature) }, context);
		}),

	/**
	 * Delete signature (admin only typically)
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
			await context.cerbos.authorize('delete', 'job_signature', input.id);

			const existing = await prisma.jobSignature.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Signature');

			// Use DBOS workflow for durable execution
			const result = await startSignatureWorkflow(
				{
					action: 'DELETE_SIGNATURE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					signatureId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to delete signature');
			}

			return successResponse({ deleted: true }, context);
		})
};
