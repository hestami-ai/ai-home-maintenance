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
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { EstimateStatus } from '../../../../../../generated/prisma/client.js';
import { startEstimateCreateWorkflow } from '../../../workflows/estimateCreateWorkflow.js';
import { startEstimateWorkflow } from '../../../workflows/estimateWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('EstimateRoute');

const estimateLineOutput = z.object({
	id: z.string(),
	estimateId: z.string(),
	lineNumber: z.number(),
	description: z.string(),
	quantity: z.string(),
	unitPrice: z.string(),
	lineTotal: z.string(),
	pricebookItemId: z.string().nullable(),
	isTaxable: z.boolean(),
	taxRate: z.string(),
	optionId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const estimateOptionOutput = z.object({
	id: z.string(),
	estimateId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isDefault: z.boolean(),
	isSelected: z.boolean(),
	subtotal: z.string(),
	taxAmount: z.string(),
	totalAmount: z.string(),
	sortOrder: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
	lines: z.array(estimateLineOutput).optional()
});

const estimateOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobId: z.string(),
	customerId: z.string(),
	estimateNumber: z.string(),
	version: z.number(),
	status: z.nativeEnum(EstimateStatus),
	issueDate: z.string(),
	validUntil: z.string().nullable(),
	sentAt: z.string().nullable(),
	viewedAt: z.string().nullable(),
	acceptedAt: z.string().nullable(),
	declinedAt: z.string().nullable(),
	subtotal: z.string(),
	taxAmount: z.string(),
	discount: z.string(),
	totalAmount: z.string(),
	title: z.string().nullable(),
	description: z.string().nullable(),
	notes: z.string().nullable(),
	terms: z.string().nullable(),
	previousVersionId: z.string().nullable(),
	createdBy: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	lines: z.array(estimateLineOutput).optional(),
	options: z.array(estimateOptionOutput).optional()
});

const formatEstimateLine = (l: any) => ({
	id: l.id,
	estimateId: l.estimateId,
	lineNumber: l.lineNumber,
	description: l.description,
	quantity: l.quantity.toString(),
	unitPrice: l.unitPrice.toString(),
	lineTotal: l.lineTotal.toString(),
	pricebookItemId: l.pricebookItemId,
	isTaxable: l.isTaxable,
	taxRate: l.taxRate.toString(),
	optionId: l.optionId,
	createdAt: l.createdAt.toISOString(),
	updatedAt: l.updatedAt.toISOString()
});

const formatEstimateOption = (o: any, includeLines = false) => ({
	id: o.id,
	estimateId: o.estimateId,
	name: o.name,
	description: o.description,
	isDefault: o.isDefault,
	isSelected: o.isSelected,
	subtotal: o.subtotal.toString(),
	taxAmount: o.taxAmount.toString(),
	totalAmount: o.totalAmount.toString(),
	sortOrder: o.sortOrder,
	createdAt: o.createdAt.toISOString(),
	updatedAt: o.updatedAt.toISOString(),
	...(includeLines && o.lines && { lines: o.lines.map(formatEstimateLine) })
});

const formatEstimate = (e: any, includeDetails = false) => ({
	id: e.id,
	organizationId: e.organizationId,
	jobId: e.jobId,
	customerId: e.customerId,
	estimateNumber: e.estimateNumber,
	version: e.version,
	status: e.status,
	issueDate: e.issueDate.toISOString(),
	validUntil: e.validUntil?.toISOString() ?? null,
	sentAt: e.sentAt?.toISOString() ?? null,
	viewedAt: e.viewedAt?.toISOString() ?? null,
	acceptedAt: e.acceptedAt?.toISOString() ?? null,
	declinedAt: e.declinedAt?.toISOString() ?? null,
	subtotal: e.subtotal.toString(),
	taxAmount: e.taxAmount.toString(),
	discount: e.discount.toString(),
	totalAmount: e.totalAmount.toString(),
	title: e.title,
	description: e.description,
	notes: e.notes,
	terms: e.terms,
	previousVersionId: e.previousVersionId,
	createdBy: e.createdBy,
	createdAt: e.createdAt.toISOString(),
	updatedAt: e.updatedAt.toISOString(),
	...(includeDetails && e.lines && { lines: e.lines.map(formatEstimateLine) }),
	...(includeDetails && e.options && { options: e.options.map((o: any) => formatEstimateOption(o, true)) })
});

async function generateEstimateNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await prisma.estimate.count({
		where: {
			organizationId,
			estimateNumber: { startsWith: `EST-${year}-` }
		}
	});
	return `EST-${year}-${String(count + 1).padStart(6, '0')}`;
}

function recalculateEstimateTotals(lines: any[], discount: number = 0) {
	const subtotal = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
	const taxAmount = lines
		.filter((l) => l.isTaxable)
		.reduce((sum, l) => sum + Number(l.lineTotal) * Number(l.taxRate), 0);
	const totalAmount = subtotal + taxAmount - discount;
	return { subtotal, taxAmount, totalAmount };
}

export const estimateRouter = {
	/**
	 * Create a new estimate
	 */
	create: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					customerId: z.string(),
					title: z.string().optional(),
					description: z.string().optional(),
					notes: z.string().optional(),
					terms: z.string().optional(),
					validUntil: z.string().datetime().optional(),
					discount: z.number().nonnegative().default(0),
					lines: z.array(
						z.object({
							description: z.string(),
							quantity: z.number().positive().default(1),
							unitPrice: z.number().nonnegative(),
							pricebookItemId: z.string().optional(),
							isTaxable: z.boolean().default(true),
							taxRate: z.number().nonnegative().default(0)
						})
					).optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'estimate', 'new');

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw ApiException.notFound('Job');

			// Validate customer exists
			const customer = await prisma.customer.findFirst({
				where: { id: input.customerId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!customer) throw ApiException.notFound('Customer');

			// Use DBOS workflow for durable execution with idempotencyKey as workflowID
			const result = await startEstimateCreateWorkflow(
				{
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.jobId,
					customerId: input.customerId,
					title: input.title,
					description: input.description,
					notes: input.notes,
					terms: input.terms,
					validUntil: input.validUntil,
					discount: input.discount,
					lines: input.lines
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to create estimate');
			}

			// Fetch the created estimate with relations for the response
			const estimate = await prisma.estimate.findUnique({
				where: { id: result.estimateId },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Generate estimate from pricebook items
	 */
	generateFromPricebook: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					customerId: z.string(),
					pricebookItemIds: z.array(z.string()),
					title: z.string().optional(),
					description: z.string().optional(),
					validUntil: z.string().datetime().optional(),
					defaultTaxRate: z.number().nonnegative().default(0)
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'estimate', 'new');

			// Validate job and customer
			const [job, customer] = await Promise.all([
				prisma.job.findFirst({
					where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
				}),
				prisma.customer.findFirst({
					where: { id: input.customerId, organizationId: context.organization!.id, deletedAt: null }
				})
			]);
			if (!job) throw ApiException.notFound('Job');
			if (!customer) throw ApiException.notFound('Customer');

			// Get pricebook items
			const pricebookItems = await prisma.pricebookItem.findMany({
				where: { id: { in: input.pricebookItemIds } },
				include: { pricebookVersion: { include: { pricebook: true } } }
			});

			// Validate all items belong to org's pricebooks
			for (const item of pricebookItems) {
				if (item.pricebookVersion.pricebook.organizationId !== context.organization!.id) {
					throw ApiException.forbidden();
				}
			}

			// Use DBOS workflow for durable execution
			const result = await startEstimateWorkflow(
				{
					action: 'GENERATE_FROM_PRICEBOOK',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						jobId: input.jobId,
						customerId: input.customerId,
						pricebookItemIds: input.pricebookItemIds,
						title: input.title ?? `Estimate for ${job.title}`,
						description: input.description,
						validUntil: input.validUntil,
						defaultTaxRate: input.defaultTaxRate
					}
				},
				input.idempotencyKey || `generate-estimate-from-pricebook-${Date.now()}`
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to generate estimate from pricebook');
			}

			const estimate = await prisma.estimate.findUniqueOrThrow({
				where: { id: result.entityId },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Get estimate by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'estimate', input.id);

			const estimate = await prisma.estimate.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			if (!estimate) throw ApiException.notFound('Estimate');

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * List estimates
	 */
	list: orgProcedure
		.input(
			z
				.object({
					jobId: z.string().optional(),
					customerId: z.string().optional(),
					status: z.nativeEnum(EstimateStatus).optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					estimates: z.array(estimateOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'estimate', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization!.id,
				...(input?.jobId && { jobId: input.jobId }),
				...(input?.customerId && { customerId: input.customerId }),
				...(input?.status && { status: input.status })
			};

			const estimates = await prisma.estimate.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = estimates.length > limit;
			if (hasMore) estimates.pop();

			const nextCursor = hasMore ? estimates[estimates.length - 1]?.id ?? null : null;

			return successResponse(
				{
					estimates: estimates.map((e) => formatEstimate(e)),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Update estimate (only if DRAFT)
	 */
	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					title: z.string().optional(),
					description: z.string().optional(),
					notes: z.string().optional(),
					terms: z.string().optional(),
					validUntil: z.string().datetime().nullable().optional(),
					discount: z.number().nonnegative().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'estimate', input.id);

			const existing = await prisma.estimate.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw ApiException.notFound('Estimate');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only edit DRAFT estimates');
			}

			// Use DBOS workflow for durable execution
			const result = await startEstimateWorkflow(
				{
					action: 'UPDATE_ESTIMATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					estimateId: input.id,
					data: {
						title: input.title,
						description: input.description,
						notes: input.notes,
						terms: input.terms,
						validUntil: input.validUntil,
						discount: input.discount
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to update estimate');
			}

			const estimate = await prisma.estimate.findUniqueOrThrow({
				where: { id: result.entityId },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Add line to estimate
	 */
	addLine: orgProcedure
		.input(
			z
				.object({
					estimateId: z.string(),
					description: z.string(),
					quantity: z.number().positive().default(1),
					unitPrice: z.number().nonnegative(),
					pricebookItemId: z.string().optional(),
					isTaxable: z.boolean().default(true),
					taxRate: z.number().nonnegative().default(0),
					optionId: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'estimate', input.estimateId);

			const existing = await prisma.estimate.findFirst({
				where: { id: input.estimateId, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw ApiException.notFound('Estimate');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only edit DRAFT estimates');
			}

			const lineNumber = existing.lines.length + 1;
			const lineTotal = input.quantity * input.unitPrice;

			// Use DBOS workflow for durable execution
			const result = await startEstimateWorkflow(
				{
					action: 'ADD_LINE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					estimateId: input.estimateId,
					data: {
						lineNumber,
						description: input.description,
						quantity: input.quantity,
						unitPrice: input.unitPrice,
						lineTotal,
						pricebookItemId: input.pricebookItemId,
						isTaxable: input.isTaxable,
						taxRate: input.taxRate,
						optionId: input.optionId
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to add line');
			}

			const estimate = await prisma.estimate.findUniqueOrThrow({
				where: { id: result.entityId },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Remove line from estimate
	 */
	removeLine: orgProcedure
		.input(
			z
				.object({
					estimateId: z.string(),
					lineId: z.string()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'estimate', input.estimateId);

			const existing = await prisma.estimate.findFirst({
				where: { id: input.estimateId, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Estimate');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only edit DRAFT estimates');
			}

			// Use DBOS workflow for durable execution
			const result = await startEstimateWorkflow(
				{
					action: 'REMOVE_LINE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					estimateId: input.estimateId,
					lineId: input.lineId,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to remove line');
			}

			const estimate = await prisma.estimate.findUniqueOrThrow({
				where: { id: result.entityId },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Send estimate to customer
	 */
	send: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('send', 'estimate', input.id);

			const existing = await prisma.estimate.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Estimate');

			if (!['DRAFT', 'REVISED'].includes(existing.status)) {
				throw ApiException.badRequest('Can only send DRAFT or REVISED estimates');
			}

			// Use DBOS workflow for durable execution
			const result = await startEstimateWorkflow(
				{
					action: 'SEND_ESTIMATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					estimateId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to send estimate');
			}

			const estimate = await prisma.estimate.findUniqueOrThrow({
				where: { id: result.entityId },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Mark estimate as viewed (called when customer views)
	 */
	markViewed: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.estimate.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Estimate');

			if (existing.status !== 'SENT') {
				return successResponse({ estimate: formatEstimate(existing) }, context);
			}

			const estimate = await prisma.estimate.update({
				where: { id: input.id },
				data: {
					status: 'VIEWED',
					viewedAt: new Date()
				},
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Accept estimate
	 */
	accept: orgProcedure
		.input(z.object({ id: z.string(), selectedOptionId: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.estimate.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { options: true }
			});
			if (!existing) throw ApiException.notFound('Estimate');

			if (!['SENT', 'VIEWED'].includes(existing.status)) {
				throw ApiException.badRequest('Can only accept SENT or VIEWED estimates');
			}

			// Use DBOS workflow for durable execution
			const result = await startEstimateWorkflow(
				{
					action: 'ACCEPT_ESTIMATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					estimateId: input.id,
					data: { selectedOptionId: input.selectedOptionId }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to accept estimate');
			}

			const estimate = await prisma.estimate.findUniqueOrThrow({
				where: { id: result.entityId },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Decline estimate
	 */
	decline: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.estimate.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Estimate');

			if (!['SENT', 'VIEWED'].includes(existing.status)) {
				throw ApiException.badRequest('Can only decline SENT or VIEWED estimates');
			}

			// Use DBOS workflow for durable execution
			const result = await startEstimateWorkflow(
				{
					action: 'DECLINE_ESTIMATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					estimateId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to decline estimate');
			}

			const estimate = await prisma.estimate.findUniqueOrThrow({
				where: { id: result.entityId },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Create revised version of estimate
	 */
	revise: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ estimate: estimateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('revise', 'estimate', input.id);

			const existing = await prisma.estimate.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true, options: { include: { lines: true } } }
			});
			if (!existing) throw ApiException.notFound('Estimate');

			// Use DBOS workflow for durable execution
			const result = await startEstimateWorkflow(
				{
					action: 'REVISE_ESTIMATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					estimateId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to revise estimate');
			}

			const estimate = await prisma.estimate.findUniqueOrThrow({
				where: { id: result.entityId },
				include: {
					lines: { orderBy: { lineNumber: 'asc' } },
					options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
				}
			});

			return successResponse({ estimate: formatEstimate(estimate, true) }, context);
		}),

	/**
	 * Delete estimate (only DRAFT)
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
			await context.cerbos.authorize('delete', 'estimate', input.id);

			const existing = await prisma.estimate.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Estimate');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only delete DRAFT estimates');
			}

			// Use DBOS workflow for durable execution
			const result = await startEstimateWorkflow(
				{
					action: 'DELETE_ESTIMATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					estimateId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to delete estimate');
			}

			return successResponse({ deleted: true }, context);
		})
};
