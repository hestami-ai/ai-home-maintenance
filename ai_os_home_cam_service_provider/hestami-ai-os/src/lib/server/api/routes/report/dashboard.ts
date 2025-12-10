import { z } from 'zod';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';

const widgetTypeEnum = z.enum([
	'CHART_BAR', 'CHART_LINE', 'CHART_PIE', 'CHART_DONUT',
	'METRIC_CARD', 'TABLE', 'LIST', 'CALENDAR', 'MAP'
]);

const getAssociationOrThrow = async (organizationId: string) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw ApiException.notFound('Association');
	return association;
};

export const dashboardRouter = {
	/**
	 * Create a dashboard widget
	 */
	createWidget: orgProcedure
		.input(z.object({
			widgetType: widgetTypeEnum,
			title: z.string().min(1).max(100),
			configJson: z.string().optional(),
			position: z.number().int().min(0).optional(),
			width: z.number().int().min(1).max(4).optional(),
			height: z.number().int().min(1).max(4).optional(),
			userId: z.string().optional(), // For user-specific widgets
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				widget: z.object({
					id: z.string(),
					widgetType: z.string(),
					title: z.string(),
					position: z.number()
				})
			}),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'dashboard_widget', 'new');
			const association = await getAssociationOrThrow(context.organization!.id);

			const createWidget = async () => {
				// Get max position for ordering
				const maxPos = await prisma.dashboardWidget.aggregate({
					where: { associationId: association.id, userId: input.userId ?? null },
					_max: { position: true }
				});

				return prisma.dashboardWidget.create({
					data: {
						associationId: association.id,
						userId: input.userId,
						widgetType: input.widgetType,
						title: input.title,
						configJson: input.configJson,
						position: input.position ?? (maxPos._max.position ?? 0) + 1,
						width: input.width ?? 1,
						height: input.height ?? 1
					}
				});
			};

			const widget = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createWidget)).result
				: await createWidget();

			return successResponse({
				widget: {
					id: widget.id,
					widgetType: widget.widgetType,
					title: widget.title,
					position: widget.position
				}
			}, context);
		}),

	/**
	 * List dashboard widgets
	 */
	listWidgets: orgProcedure
		.input(z.object({
			userId: z.string().optional(), // Filter by user or association-wide
			isActive: z.boolean().optional()
		}).optional())
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				widgets: z.array(z.object({
					id: z.string(),
					widgetType: z.string(),
					title: z.string(),
					configJson: z.string().nullable(),
					position: z.number(),
					width: z.number(),
					height: z.number(),
					isActive: z.boolean()
				}))
			}),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'dashboard_widget', '*');
			const association = await getAssociationOrThrow(context.organization!.id);

			const where: Record<string, unknown> = { associationId: association.id };
			if (input?.userId !== undefined) where.userId = input.userId;
			if (input?.isActive !== undefined) where.isActive = input.isActive;

			const widgets = await prisma.dashboardWidget.findMany({
				where,
				orderBy: { position: 'asc' }
			});

			return successResponse({
				widgets: widgets.map(w => ({
					id: w.id,
					widgetType: w.widgetType,
					title: w.title,
					configJson: w.configJson,
					position: w.position,
					width: w.width,
					height: w.height,
					isActive: w.isActive
				}))
			}, context);
		}),

	/**
	 * Update a widget
	 */
	updateWidget: orgProcedure
		.input(z.object({
			id: z.string(),
			title: z.string().min(1).max(100).optional(),
			configJson: z.string().nullable().optional(),
			position: z.number().int().min(0).optional(),
			width: z.number().int().min(1).max(4).optional(),
			height: z.number().int().min(1).max(4).optional(),
			isActive: z.boolean().optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				widget: z.object({
					id: z.string(),
					title: z.string(),
					position: z.number(),
					isActive: z.boolean()
				})
			}),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'dashboard_widget', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const updateWidget = async () => {
				const existing = await prisma.dashboardWidget.findFirst({
					where: { id: input.id, associationId: association.id }
				});
				if (!existing) throw ApiException.notFound('Dashboard widget');

				return prisma.dashboardWidget.update({
					where: { id: input.id },
					data: {
						title: input.title,
						configJson: input.configJson,
						position: input.position,
						width: input.width,
						height: input.height,
						isActive: input.isActive
					}
				});
			};

			const widget = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateWidget)).result
				: await updateWidget();

			return successResponse({
				widget: {
					id: widget.id,
					title: widget.title,
					position: widget.position,
					isActive: widget.isActive
				}
			}, context);
		}),

	/**
	 * Delete a widget
	 */
	deleteWidget: orgProcedure
		.input(z.object({
			id: z.string(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({ deleted: z.boolean() }),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('delete', 'dashboard_widget', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const deleteWidget = async () => {
				const existing = await prisma.dashboardWidget.findFirst({
					where: { id: input.id, associationId: association.id }
				});
				if (!existing) throw ApiException.notFound('Dashboard widget');

				await prisma.dashboardWidget.delete({ where: { id: input.id } });
				return true;
			};

			input.idempotencyKey
				? await withIdempotency(input.idempotencyKey, context, deleteWidget)
				: await deleteWidget();

			return successResponse({ deleted: true }, context);
		}),

	/**
	 * Reorder widgets
	 */
	reorderWidgets: orgProcedure
		.input(z.object({
			widgetIds: z.array(z.string()).min(1),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({ reordered: z.boolean() }),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'dashboard_widget', '*');
			const association = await getAssociationOrThrow(context.organization!.id);

			const reorderWidgets = async () => {
				// Verify all widgets belong to this association
				const widgets = await prisma.dashboardWidget.findMany({
					where: { id: { in: input.widgetIds }, associationId: association.id }
				});

				if (widgets.length !== input.widgetIds.length) {
					throw ApiException.badRequest('Some widgets not found or not accessible');
				}

				// Update positions in order
				await prisma.$transaction(
					input.widgetIds.map((id, index) =>
						prisma.dashboardWidget.update({
							where: { id },
							data: { position: index }
						})
					)
				);

				return true;
			};

			input.idempotencyKey
				? await withIdempotency(input.idempotencyKey, context, reorderWidgets)
				: await reorderWidgets();

			return successResponse({ reordered: true }, context);
		}),

	/**
	 * Get dashboard summary data (aggregated metrics)
	 */
	getSummary: orgProcedure
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				summary: z.object({
					financials: z.object({
						totalReceivables: z.string(),
						totalPayables: z.string(),
						delinquentUnits: z.number()
					}),
					operations: z.object({
						openWorkOrders: z.number(),
						pendingViolations: z.number(),
						pendingArcRequests: z.number()
					}),
					compliance: z.object({
						upcomingDeadlines: z.number(),
						overdueItems: z.number()
					})
				})
			}),
			meta: z.any()
		}))
		.handler(async ({ context }) => {
			await context.cerbos.authorize('view', 'dashboard_widget', '*');
			const association = await getAssociationOrThrow(context.organization!.id);

			// Aggregate financial data
			const receivables = await prisma.assessmentCharge.aggregate({
				where: { associationId: association.id, status: { in: ['PENDING', 'BILLED', 'PARTIALLY_PAID'] } },
				_sum: { balanceDue: true }
			});

			const payables = await prisma.aPInvoice.aggregate({
				where: { associationId: association.id, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID'] } },
				_sum: { balanceDue: true }
			});

			// Count units with outstanding balances as proxy for delinquent
			const delinquentCharges = await prisma.assessmentCharge.findMany({
				where: {
					associationId: association.id,
					balanceDue: { gt: 0 },
					unitId: { not: undefined }
				},
				select: { unitId: true },
				distinct: ['unitId']
			});
			const delinquentUnitsCount = delinquentCharges.filter(c => c.unitId !== null).length;

			// Aggregate operational data
			const openWorkOrders = await prisma.workOrder.count({
				where: {
					associationId: association.id,
					status: { in: ['DRAFT', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'] }
				}
			});

			const pendingViolations = await prisma.violation.count({
				where: {
					associationId: association.id,
					status: { in: ['DRAFT', 'OPEN', 'NOTICE_SENT', 'CURE_PERIOD'] },
					deletedAt: null
				}
			});

			const pendingArcRequests = await prisma.aRCRequest.count({
				where: {
					associationId: association.id,
					status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }
				}
			});

			// Compliance data
			const now = new Date();
			const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

			const upcomingDeadlines = await prisma.complianceDeadline.count({
				where: {
					associationId: association.id,
					dueDate: { gte: now, lte: thirtyDaysFromNow },
					status: { in: ['NOT_STARTED', 'IN_PROGRESS'] }
				}
			});

			const overdueItems = await prisma.complianceDeadline.count({
				where: {
					associationId: association.id,
					dueDate: { lt: now },
					status: { in: ['NOT_STARTED', 'IN_PROGRESS'] }
				}
			});

			return successResponse({
				summary: {
					financials: {
						totalReceivables: (receivables._sum?.balanceDue ?? 0).toString(),
						totalPayables: (payables._sum?.balanceDue ?? 0).toString(),
						delinquentUnits: delinquentUnitsCount
					},
					operations: {
						openWorkOrders,
						pendingViolations,
						pendingArcRequests
					},
					compliance: {
						upcomingDeadlines,
						overdueItems
					}
				}
			}, context);
		})
};
