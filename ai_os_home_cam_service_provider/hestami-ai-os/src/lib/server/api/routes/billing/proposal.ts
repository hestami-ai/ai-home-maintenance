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
import { ProposalStatus } from '../../../../../../generated/prisma/client.js';
import { startBillingWorkflow } from '../../../workflows/billingWorkflow.js';

const proposalOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	customerId: z.string(),
	estimateId: z.string().nullable(),
	proposalNumber: z.string(),
	status: z.nativeEnum(ProposalStatus),
	issueDate: z.string(),
	validUntil: z.string().nullable(),
	sentAt: z.string().nullable(),
	viewedAt: z.string().nullable(),
	acceptedAt: z.string().nullable(),
	declinedAt: z.string().nullable(),
	title: z.string().nullable(),
	coverLetter: z.string().nullable(),
	terms: z.string().nullable(),
	signatureData: z.string().nullable(),
	signedAt: z.string().nullable(),
	signedByName: z.string().nullable(),
	signedByEmail: z.string().nullable(),
	selectedOptionId: z.string().nullable(),
	createdBy: z.string(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatProposal = (p: any) => ({
	id: p.id,
	organizationId: p.organizationId,
	customerId: p.customerId,
	estimateId: p.estimateId,
	proposalNumber: p.proposalNumber,
	status: p.status,
	issueDate: p.issueDate.toISOString(),
	validUntil: p.validUntil?.toISOString() ?? null,
	sentAt: p.sentAt?.toISOString() ?? null,
	viewedAt: p.viewedAt?.toISOString() ?? null,
	acceptedAt: p.acceptedAt?.toISOString() ?? null,
	declinedAt: p.declinedAt?.toISOString() ?? null,
	title: p.title,
	coverLetter: p.coverLetter,
	terms: p.terms,
	signatureData: p.signatureData,
	signedAt: p.signedAt?.toISOString() ?? null,
	signedByName: p.signedByName,
	signedByEmail: p.signedByEmail,
	selectedOptionId: p.selectedOptionId,
	createdBy: p.createdBy,
	createdAt: p.createdAt.toISOString(),
	updatedAt: p.updatedAt.toISOString()
});

async function generateProposalNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await prisma.proposal.count({
		where: {
			organizationId,
			proposalNumber: { startsWith: `PROP-${year}-` }
		}
	});
	return `PROP-${year}-${String(count + 1).padStart(6, '0')}`;
}

export const proposalRouter = {
	/**
	 * Create a proposal from an estimate
	 */
	create: orgProcedure
		.input(
			z
				.object({
					customerId: z.string(),
					estimateId: z.string().optional(),
					title: z.string().optional(),
					coverLetter: z.string().optional(),
					terms: z.string().optional(),
					validUntil: z.string().datetime().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ proposal: proposalOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'proposal', 'new');

			// Validate customer exists
			const customer = await prisma.customer.findFirst({
				where: { id: input.customerId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!customer) throw ApiException.notFound('Customer');

			// Validate estimate if provided
			if (input.estimateId) {
				const estimate = await prisma.estimate.findFirst({
					where: { id: input.estimateId, organizationId: context.organization!.id }
				});
				if (!estimate) throw ApiException.notFound('Estimate');
			}

			const proposalNumber = await generateProposalNumber(context.organization!.id);

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'CREATE_PROPOSAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						customerId: input.customerId,
						estimateId: input.estimateId,
						proposalNumber,
						title: input.title,
						coverLetter: input.coverLetter,
						terms: input.terms,
						validUntil: input.validUntil
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to create proposal');
			}

			const proposal = await prisma.proposal.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ proposal: formatProposal(proposal) }, context);
		}),

	/**
	 * Get proposal by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ proposal: proposalOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'proposal', input.id);

			const proposal = await prisma.proposal.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});

			if (!proposal) throw ApiException.notFound('Proposal');

			return successResponse({ proposal: formatProposal(proposal) }, context);
		}),

	/**
	 * List proposals
	 */
	list: orgProcedure
		.input(
			z
				.object({
					customerId: z.string().optional(),
					estimateId: z.string().optional(),
					status: z.nativeEnum(ProposalStatus).optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					proposals: z.array(proposalOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'proposal', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization!.id,
				...(input?.customerId && { customerId: input.customerId }),
				...(input?.estimateId && { estimateId: input.estimateId }),
				...(input?.status && { status: input.status })
			};

			const proposals = await prisma.proposal.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = proposals.length > limit;
			if (hasMore) proposals.pop();

			const nextCursor = hasMore ? proposals[proposals.length - 1]?.id ?? null : null;

			return successResponse(
				{
					proposals: proposals.map(formatProposal),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Update proposal (only if DRAFT)
	 */
	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					title: z.string().optional(),
					coverLetter: z.string().optional(),
					terms: z.string().optional(),
					validUntil: z.string().datetime().nullable().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ proposal: proposalOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'proposal', input.id);

			const existing = await prisma.proposal.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Proposal');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only edit DRAFT proposals');
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'UPDATE_PROPOSAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entityId: input.id,
					data: { status: existing.status }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to update proposal');
			}

			const proposal = await prisma.proposal.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ proposal: formatProposal(proposal) }, context);
		}),

	/**
	 * Send proposal to customer
	 */
	send: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ proposal: proposalOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('send', 'proposal', input.id);

			const existing = await prisma.proposal.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Proposal');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only send DRAFT proposals');
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'SEND_PROPOSAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to send proposal');
			}

			const proposal = await prisma.proposal.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ proposal: formatProposal(proposal) }, context);
		}),

	/**
	 * Mark proposal as viewed
	 */
	markViewed: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ proposal: proposalOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.proposal.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Proposal');

			if (existing.status !== 'SENT') {
				return successResponse({ proposal: formatProposal(existing) }, context);
			}

			const proposal = await prisma.proposal.update({
				where: { id: input.id },
				data: {
					status: 'VIEWED',
					viewedAt: new Date()
				}
			});

			return successResponse({ proposal: formatProposal(proposal) }, context);
		}),

	/**
	 * Accept proposal with signature
	 */
	accept: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					signatureData: z.string(),
					signedByName: z.string(),
					signedByEmail: z.string().email().optional(),
					selectedOptionId: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ proposal: proposalOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('accept', 'proposal', input.id);

			const existing = await prisma.proposal.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Proposal');

			if (!['SENT', 'VIEWED'].includes(existing.status)) {
				throw ApiException.badRequest('Can only accept SENT or VIEWED proposals');
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'ACCEPT_PROPOSAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to accept proposal');
			}

			const proposal = await prisma.proposal.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ proposal: formatProposal(proposal) }, context);
		}),

	/**
	 * Decline proposal
	 */
	decline: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ proposal: proposalOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('decline', 'proposal', input.id);

			const existing = await prisma.proposal.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Proposal');

			if (!['SENT', 'VIEWED'].includes(existing.status)) {
				throw ApiException.badRequest('Can only decline SENT or VIEWED proposals');
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'DECLINE_PROPOSAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to decline proposal');
			}

			const proposal = await prisma.proposal.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ proposal: formatProposal(proposal) }, context);
		}),

	/**
	 * Delete proposal (only DRAFT)
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
			await context.cerbos.authorize('delete', 'proposal', input.id);

			const existing = await prisma.proposal.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Proposal');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only delete DRAFT proposals');
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'DELETE_PROPOSAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to delete proposal');
			}

			return successResponse({ deleted: true }, context);
		})
};
