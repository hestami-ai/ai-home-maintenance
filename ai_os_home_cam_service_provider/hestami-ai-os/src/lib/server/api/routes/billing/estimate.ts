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
import { EstimateStatus } from '../../../../../../generated/prisma/client.js';

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

			const createEstimate = async () => {
				const estimateNumber = await generateEstimateNumber(context.organization!.id);

				return prisma.$transaction(async (tx) => {
					// Calculate line totals
					const linesWithTotals = (input.lines ?? []).map((line, idx) => ({
						...line,
						lineNumber: idx + 1,
						lineTotal: line.quantity * line.unitPrice
					}));

					const { subtotal, taxAmount, totalAmount } = recalculateEstimateTotals(
						linesWithTotals,
						input.discount
					);

					const estimate = await tx.estimate.create({
						data: {
							organizationId: context.organization!.id,
							jobId: input.jobId,
							customerId: input.customerId,
							estimateNumber,
							title: input.title,
							description: input.description,
							notes: input.notes,
							terms: input.terms,
							validUntil: input.validUntil ? new Date(input.validUntil) : null,
							discount: input.discount,
							subtotal,
							taxAmount,
							totalAmount,
							createdBy: context.user!.id
						}
					});

					// Create lines
					if (linesWithTotals.length > 0) {
						await tx.estimateLine.createMany({
							data: linesWithTotals.map((line) => ({
								estimateId: estimate.id,
								lineNumber: line.lineNumber,
								description: line.description,
								quantity: line.quantity,
								unitPrice: line.unitPrice,
								lineTotal: line.lineTotal,
								pricebookItemId: line.pricebookItemId,
								isTaxable: line.isTaxable,
								taxRate: line.taxRate
							}))
						});
					}

					return tx.estimate.findUnique({
						where: { id: estimate.id },
						include: {
							lines: { orderBy: { lineNumber: 'asc' } },
							options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
						}
					});
				});
			};

			const estimate = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createEstimate)).result
				: await createEstimate();

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

			const generateEstimate = async () => {
				const estimateNumber = await generateEstimateNumber(context.organization!.id);

				return prisma.$transaction(async (tx) => {
					const linesWithTotals = pricebookItems.map((item, idx) => ({
						lineNumber: idx + 1,
						description: `${item.name}${item.description ? ` - ${item.description}` : ''}`,
						quantity: 1,
						unitPrice: Number(item.basePrice),
						lineTotal: Number(item.basePrice),
						pricebookItemId: item.id,
						isTaxable: item.isTaxable,
						taxRate: input.defaultTaxRate
					}));

					const { subtotal, taxAmount, totalAmount } = recalculateEstimateTotals(linesWithTotals, 0);

					const estimate = await tx.estimate.create({
						data: {
							organizationId: context.organization!.id,
							jobId: input.jobId,
							customerId: input.customerId,
							estimateNumber,
							title: input.title ?? `Estimate for ${job.title}`,
							description: input.description,
							validUntil: input.validUntil ? new Date(input.validUntil) : null,
							subtotal,
							taxAmount,
							totalAmount,
							createdBy: context.user!.id
						}
					});

					if (linesWithTotals.length > 0) {
						await tx.estimateLine.createMany({
							data: linesWithTotals.map((line) => ({
								estimateId: estimate.id,
								...line
							}))
						});
					}

					return tx.estimate.findUnique({
						where: { id: estimate.id },
						include: {
							lines: { orderBy: { lineNumber: 'asc' } },
							options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
						}
					});
				});
			};

			const estimate = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, generateEstimate)).result
				: await generateEstimate();

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

			const updateEstimate = async () => {
				const discount = input.discount ?? Number(existing.discount);
				const { subtotal, taxAmount, totalAmount } = recalculateEstimateTotals(
					existing.lines,
					discount
				);

				return prisma.estimate.update({
					where: { id: input.id },
					data: {
						title: input.title ?? existing.title,
						description: input.description ?? existing.description,
						notes: input.notes ?? existing.notes,
						terms: input.terms ?? existing.terms,
						validUntil: input.validUntil === null ? null : input.validUntil ? new Date(input.validUntil) : existing.validUntil,
						discount,
						subtotal,
						taxAmount,
						totalAmount
					},
					include: {
						lines: { orderBy: { lineNumber: 'asc' } },
						options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
					}
				});
			};

			const estimate = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateEstimate)).result
				: await updateEstimate();

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

			const addLine = async () => {
				return prisma.$transaction(async (tx) => {
					const lineNumber = existing.lines.length + 1;
					const lineTotal = input.quantity * input.unitPrice;

					await tx.estimateLine.create({
						data: {
							estimateId: input.estimateId,
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
					});

					// Recalculate totals
					const allLines = await tx.estimateLine.findMany({
						where: { estimateId: input.estimateId }
					});
					const { subtotal, taxAmount, totalAmount } = recalculateEstimateTotals(
						allLines,
						Number(existing.discount)
					);

					return tx.estimate.update({
						where: { id: input.estimateId },
						data: { subtotal, taxAmount, totalAmount },
						include: {
							lines: { orderBy: { lineNumber: 'asc' } },
							options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
						}
					});
				});
			};

			const estimate = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, addLine)).result
				: await addLine();

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

			const removeLine = async () => {
				return prisma.$transaction(async (tx) => {
					await tx.estimateLine.delete({ where: { id: input.lineId } });

					// Renumber remaining lines
					const remainingLines = await tx.estimateLine.findMany({
						where: { estimateId: input.estimateId },
						orderBy: { lineNumber: 'asc' }
					});

					for (let i = 0; i < remainingLines.length; i++) {
						await tx.estimateLine.update({
							where: { id: remainingLines[i].id },
							data: { lineNumber: i + 1 }
						});
					}

					// Recalculate totals
					const { subtotal, taxAmount, totalAmount } = recalculateEstimateTotals(
						remainingLines,
						Number(existing.discount)
					);

					return tx.estimate.update({
						where: { id: input.estimateId },
						data: { subtotal, taxAmount, totalAmount },
						include: {
							lines: { orderBy: { lineNumber: 'asc' } },
							options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
						}
					});
				});
			};

			const estimate = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, removeLine)).result
				: await removeLine();

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

			const sendEstimate = async () => {
				// Note: Actual email sending would be handled by a separate service
				return prisma.estimate.update({
					where: { id: input.id },
					data: {
						status: 'SENT',
						sentAt: new Date()
					},
					include: {
						lines: { orderBy: { lineNumber: 'asc' } },
						options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
					}
				});
			};

			const estimate = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, sendEstimate)).result
				: await sendEstimate();

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

			const acceptEstimate = async () => {
				return prisma.$transaction(async (tx) => {
					// If option selected, mark it
					if (input.selectedOptionId && existing.options.length > 0) {
						await tx.estimateOption.updateMany({
							where: { estimateId: input.id },
							data: { isSelected: false }
						});
						await tx.estimateOption.update({
							where: { id: input.selectedOptionId },
							data: { isSelected: true }
						});
					}

					return tx.estimate.update({
						where: { id: input.id },
						data: {
							status: 'ACCEPTED',
							acceptedAt: new Date()
						},
						include: {
							lines: { orderBy: { lineNumber: 'asc' } },
							options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
						}
					});
				});
			};

			const estimate = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, acceptEstimate)).result
				: await acceptEstimate();

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

			const declineEstimate = async () => {
				return prisma.estimate.update({
					where: { id: input.id },
					data: {
						status: 'DECLINED',
						declinedAt: new Date(),
						notes: input.reason ? `${existing.notes ?? ''}\nDecline reason: ${input.reason}`.trim() : existing.notes
					},
					include: {
						lines: { orderBy: { lineNumber: 'asc' } },
						options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
					}
				});
			};

			const estimate = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, declineEstimate)).result
				: await declineEstimate();

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

			const reviseEstimate = async () => {
				return prisma.$transaction(async (tx) => {
					// Mark old as revised
					await tx.estimate.update({
						where: { id: input.id },
						data: { status: 'REVISED' }
					});

					// Create new version
					const newEstimate = await tx.estimate.create({
						data: {
							organizationId: existing.organizationId,
							jobId: existing.jobId,
							customerId: existing.customerId,
							estimateNumber: existing.estimateNumber,
							version: existing.version + 1,
							status: 'DRAFT',
							title: existing.title,
							description: existing.description,
							notes: existing.notes,
							terms: existing.terms,
							validUntil: existing.validUntil,
							subtotal: existing.subtotal,
							taxAmount: existing.taxAmount,
							discount: existing.discount,
							totalAmount: existing.totalAmount,
							previousVersionId: existing.id,
							createdBy: context.user!.id
						}
					});

					// Copy lines
					if (existing.lines.length > 0) {
						await tx.estimateLine.createMany({
							data: existing.lines.map((line) => ({
								estimateId: newEstimate.id,
								lineNumber: line.lineNumber,
								description: line.description,
								quantity: line.quantity,
								unitPrice: line.unitPrice,
								lineTotal: line.lineTotal,
								pricebookItemId: line.pricebookItemId,
								isTaxable: line.isTaxable,
								taxRate: line.taxRate
							}))
						});
					}

					return tx.estimate.findUnique({
						where: { id: newEstimate.id },
						include: {
							lines: { orderBy: { lineNumber: 'asc' } },
							options: { orderBy: { sortOrder: 'asc' }, include: { lines: true } }
						}
					});
				});
			};

			const estimate = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, reviseEstimate)).result
				: await reviseEstimate();

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

			const deleteEstimate = async () => {
				await prisma.estimate.delete({ where: { id: input.id } });
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteEstimate)).result
				: await deleteEstimate();

			return successResponse(result, context);
		})
};
