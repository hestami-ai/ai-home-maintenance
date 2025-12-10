import { z } from 'zod';
import { orgProcedure, successResponse } from '../../router.js';
import { assertContractorComplianceForScheduling } from '../contractor/utils.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import type { Prisma, WorkOrderStatus } from '../../../../../../generated/prisma/client.js';
import {
	startWorkOrderTransition,
	getWorkOrderTransitionStatus,
	getWorkOrderTransitionError
} from '../../../workflows/index.js';

const workOrderStatusEnum = z.enum([
	'DRAFT', 'SUBMITTED', 'TRIAGED', 'ASSIGNED', 'SCHEDULED',
	'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'INVOICED', 'CLOSED', 'CANCELLED'
]);

const workOrderPriorityEnum = z.enum(['EMERGENCY', 'HIGH', 'MEDIUM', 'LOW', 'SCHEDULED']);

const workOrderCategoryEnum = z.enum([
	'MAINTENANCE', 'REPAIR', 'INSPECTION', 'INSTALLATION', 'REPLACEMENT',
	'EMERGENCY', 'PREVENTIVE', 'LANDSCAPING', 'CLEANING', 'SECURITY', 'OTHER'
]);

// Valid status transitions
const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
	DRAFT: ['SUBMITTED', 'CANCELLED'],
	SUBMITTED: ['TRIAGED', 'CANCELLED'],
	TRIAGED: ['ASSIGNED', 'CANCELLED'],
	ASSIGNED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
	SCHEDULED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
	IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
	ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
	COMPLETED: ['INVOICED', 'CLOSED'],
	INVOICED: ['CLOSED'],
	CLOSED: [],
	CANCELLED: []
};

/**
 * Work Order management procedures
 */
export const workOrderRouter = {
	/**
	 * Create a new work order
	 */
	create: orgProcedure
		.input(
			z.object({
				title: z.string().min(1).max(255),
				description: z.string().min(1).max(2000),
				category: workOrderCategoryEnum,
				priority: workOrderPriorityEnum.default('MEDIUM'),
				// Location
				unitId: z.string().optional(),
				commonAreaName: z.string().max(255).optional(),
				assetId: z.string().optional(),
				locationDetails: z.string().max(500).optional(),
				// Optional scheduling
				scheduledStart: z.string().datetime().optional(),
				scheduledEnd: z.string().datetime().optional(),
				// Estimates
				estimatedCost: z.number().min(0).optional(),
				estimatedHours: z.number().min(0).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						workOrderNumber: z.string(),
						title: z.string(),
						status: z.string(),
						priority: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'work_order', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Validate unit if provided
			if (input.unitId) {
				const unit = await prisma.unit.findFirst({
					where: { id: input.unitId },
					include: { property: { include: { association: true } } }
				});
				if (!unit || unit.property.association.organizationId !== context.organization!.id) {
					throw ApiException.notFound('Unit');
				}
			}

			// Validate asset if provided
			if (input.assetId) {
				const asset = await prisma.asset.findFirst({
					where: { id: input.assetId, associationId: association.id, deletedAt: null }
				});
				if (!asset) {
					throw ApiException.notFound('Asset');
				}
			}

			// Generate work order number
			const lastWO = await prisma.workOrder.findFirst({
				where: { associationId: association.id },
				orderBy: { createdAt: 'desc' }
			});

			const workOrderNumber = lastWO
				? `WO-${String(parseInt(lastWO.workOrderNumber.split('-')[1] || '0') + 1).padStart(6, '0')}`
				: 'WO-000001';

			// Calculate SLA deadline based on priority
			const slaHours: Record<string, number> = {
				EMERGENCY: 4,
				HIGH: 24,
				MEDIUM: 72,
				LOW: 168,
				SCHEDULED: 336
			};
			const slaDeadline = new Date(Date.now() + slaHours[input.priority] * 60 * 60 * 1000);

			const workOrder = await prisma.$transaction(async (tx) => {
				const wo = await tx.workOrder.create({
					data: {
						associationId: association.id,
						workOrderNumber,
						title: input.title,
						description: input.description,
						category: input.category,
						priority: input.priority,
						status: 'DRAFT',
						unitId: input.unitId,
						commonAreaName: input.commonAreaName,
						assetId: input.assetId,
						locationDetails: input.locationDetails,
						requestedBy: context.user!.id,
						scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : null,
						scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : null,
						estimatedCost: input.estimatedCost,
						estimatedHours: input.estimatedHours,
						slaDeadline
					}
				});

				// Record initial status
				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: wo.id,
						fromStatus: null,
						toStatus: 'DRAFT',
						changedBy: context.user!.id,
						notes: 'Work order created'
					}
				});

				return wo;
			});

			return successResponse(
				{
					workOrder: {
						id: workOrder.id,
						workOrderNumber: workOrder.workOrderNumber,
						title: workOrder.title,
						status: workOrder.status,
						priority: workOrder.priority
					}
				},
				context
			);
		}),

	/**
	 * List work orders
	 */
	list: orgProcedure
		.input(
			z.object({
				status: workOrderStatusEnum.optional(),
				priority: workOrderPriorityEnum.optional(),
				category: workOrderCategoryEnum.optional(),
				unitId: z.string().optional(),
				assetId: z.string().optional(),
				assignedVendorId: z.string().optional(),
				search: z.string().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrders: z.array(
						z.object({
							id: z.string(),
							workOrderNumber: z.string(),
							title: z.string(),
							category: z.string(),
							priority: z.string(),
							status: z.string(),
							requestedAt: z.string(),
							scheduledStart: z.string().nullable(),
							slaDeadline: z.string().nullable(),
							assignedVendorId: z.string().nullable()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'work_order', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const where: Prisma.WorkOrderWhereInput = {
				associationId: association.id
			};

			if (input?.status) where.status = input.status;
			if (input?.priority) where.priority = input.priority;
			if (input?.category) where.category = input.category;
			if (input?.unitId) where.unitId = input.unitId;
			if (input?.assetId) where.assetId = input.assetId;
			if (input?.assignedVendorId) where.assignedVendorId = input.assignedVendorId;
			if (input?.search) {
				where.OR = [
					{ title: { contains: input.search, mode: 'insensitive' } },
					{ workOrderNumber: { contains: input.search, mode: 'insensitive' } },
					{ description: { contains: input.search, mode: 'insensitive' } }
				];
			}

			const workOrders = await prisma.workOrder.findMany({
				where,
				orderBy: [{ priority: 'asc' }, { requestedAt: 'desc' }]
			});

			return successResponse(
				{
					workOrders: workOrders.map((wo) => ({
						id: wo.id,
						workOrderNumber: wo.workOrderNumber,
						title: wo.title,
						category: wo.category,
						priority: wo.priority,
						status: wo.status,
						requestedAt: wo.requestedAt.toISOString(),
						scheduledStart: wo.scheduledStart?.toISOString() ?? null,
						slaDeadline: wo.slaDeadline?.toISOString() ?? null,
						assignedVendorId: wo.assignedVendorId
					}))
				},
				context
			);
		}),

	/**
	 * Get work order by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						workOrderNumber: z.string(),
						title: z.string(),
						description: z.string(),
						category: z.string(),
						priority: z.string(),
						status: z.string(),
						unitId: z.string().nullable(),
						commonAreaName: z.string().nullable(),
						assetId: z.string().nullable(),
						locationDetails: z.string().nullable(),
						requestedBy: z.string(),
						requestedAt: z.string(),
						assignedVendorId: z.string().nullable(),
						assignedAt: z.string().nullable(),
						scheduledStart: z.string().nullable(),
						scheduledEnd: z.string().nullable(),
						startedAt: z.string().nullable(),
						completedAt: z.string().nullable(),
						estimatedCost: z.string().nullable(),
						actualCost: z.string().nullable(),
						estimatedHours: z.string().nullable(),
						actualHours: z.string().nullable(),
						resolutionNotes: z.string().nullable(),
						slaDeadline: z.string().nullable(),
						slaMet: z.boolean().nullable()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!wo) {
				throw ApiException.notFound('Work Order');
			}

			return successResponse(
				{
					workOrder: {
						id: wo.id,
						workOrderNumber: wo.workOrderNumber,
						title: wo.title,
						description: wo.description,
						category: wo.category,
						priority: wo.priority,
						status: wo.status,
						unitId: wo.unitId,
						commonAreaName: wo.commonAreaName,
						assetId: wo.assetId,
						locationDetails: wo.locationDetails,
						requestedBy: wo.requestedBy,
						requestedAt: wo.requestedAt.toISOString(),
						assignedVendorId: wo.assignedVendorId,
						assignedAt: wo.assignedAt?.toISOString() ?? null,
						scheduledStart: wo.scheduledStart?.toISOString() ?? null,
						scheduledEnd: wo.scheduledEnd?.toISOString() ?? null,
						startedAt: wo.startedAt?.toISOString() ?? null,
						completedAt: wo.completedAt?.toISOString() ?? null,
						estimatedCost: wo.estimatedCost?.toString() ?? null,
						actualCost: wo.actualCost?.toString() ?? null,
						estimatedHours: wo.estimatedHours?.toString() ?? null,
						actualHours: wo.actualHours?.toString() ?? null,
						resolutionNotes: wo.resolutionNotes,
						slaDeadline: wo.slaDeadline?.toISOString() ?? null,
						slaMet: wo.slaMet
					}
				},
				context
			);
		}),

	/**
	 * Update work order status
	 */
	updateStatus: orgProcedure
		.input(
			z.object({
				id: z.string(),
				status: workOrderStatusEnum,
				notes: z.string().max(1000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						status: z.string(),
						previousStatus: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!wo) {
				throw ApiException.notFound('Work Order');
			}

			// Validate transition
			const allowed = validTransitions[wo.status];
			if (!allowed.includes(input.status)) {
				throw ApiException.badRequest(
					`Cannot transition from ${wo.status} to ${input.status}`
				);
			}

			const previousStatus = wo.status;
			const now = new Date();

			// Build update data based on new status
			const updateData: Prisma.WorkOrderUpdateInput = {
				status: input.status
			};

			if (input.status === 'IN_PROGRESS' && !wo.startedAt) {
				updateData.startedAt = now;
			}
			if (input.status === 'COMPLETED') {
				updateData.completedAt = now;
				// Check SLA
				if (wo.slaDeadline) {
					updateData.slaMet = now <= wo.slaDeadline;
				}
			}
			if (input.status === 'CLOSED') {
				updateData.closedAt = now;
				updateData.closedBy = context.user!.id;
			}

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.workOrder.update({
					where: { id: input.id },
					data: updateData
				});

				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: input.id,
						fromStatus: previousStatus,
						toStatus: input.status,
						changedBy: context.user!.id,
						notes: input.notes
					}
				});

				return result;
			});

			return successResponse(
				{
					workOrder: {
						id: updated.id,
						status: updated.status,
						previousStatus
					}
				},
				context
			);
		}),

	/**
	 * Assign vendor to work order
	 */
	assignVendor: orgProcedure
		.input(
			z.object({
				id: z.string(),
				vendorId: z.string(),
				notes: z.string().max(1000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						status: z.string(),
						assignedVendorId: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!wo) {
				throw ApiException.notFound('Work Order');
			}

			// Validate vendor
			const vendor = await prisma.vendor.findFirst({
				where: { id: input.vendorId, associationId: association.id, isActive: true }
			});

			if (!vendor) {
				throw ApiException.notFound('Vendor');
			}

			// Must be in TRIAGED status to assign
			if (wo.status !== 'TRIAGED' && wo.status !== 'ASSIGNED') {
				throw ApiException.badRequest('Work order must be triaged before assigning vendor');
			}

			const previousStatus = wo.status;

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.workOrder.update({
					where: { id: input.id },
					data: {
						assignedVendorId: input.vendorId,
						assignedAt: new Date(),
						assignedBy: context.user!.id,
						status: 'ASSIGNED'
					}
				});

				if (previousStatus !== 'ASSIGNED') {
					await tx.workOrderStatusHistory.create({
						data: {
							workOrderId: input.id,
							fromStatus: previousStatus,
							toStatus: 'ASSIGNED',
							changedBy: context.user!.id,
							notes: input.notes || `Assigned to vendor: ${vendor.name}`
						}
					});
				}

				return result;
			});

			return successResponse(
				{
					workOrder: {
						id: updated.id,
						status: updated.status,
						assignedVendorId: updated.assignedVendorId!
					}
				},
				context
			);
		}),

	/**
	 * Schedule work order
	 */
	schedule: orgProcedure
		.input(
			z.object({
				id: z.string(),
				scheduledStart: z.string().datetime(),
				scheduledEnd: z.string().datetime().optional(),
				notes: z.string().max(1000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						status: z.string(),
						scheduledStart: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!wo) {
				throw ApiException.notFound('Work Order');
			}

			if (!wo.assignedVendorId) {
				throw ApiException.badRequest('Work order must have a vendor assigned before scheduling');
			}

			// Compliance gate: ensure the contractor has active license/insurance before scheduling
			await assertContractorComplianceForScheduling(context.organization.id);

			const previousStatus = wo.status;

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.workOrder.update({
					where: { id: input.id },
					data: {
						scheduledStart: new Date(input.scheduledStart),
						scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : null,
						status: 'SCHEDULED'
					}
				});

				if (previousStatus !== 'SCHEDULED') {
					await tx.workOrderStatusHistory.create({
						data: {
							workOrderId: input.id,
							fromStatus: previousStatus,
							toStatus: 'SCHEDULED',
							changedBy: context.user!.id,
							notes: input.notes || `Scheduled for ${input.scheduledStart}`
						}
					});
				}

				return result;
			});

			return successResponse(
				{
					workOrder: {
						id: updated.id,
						status: updated.status,
						scheduledStart: updated.scheduledStart!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Complete work order
	 */
	complete: orgProcedure
		.input(
			z.object({
				id: z.string(),
				actualCost: z.number().min(0).optional(),
				actualHours: z.number().min(0).optional(),
				resolutionNotes: z.string().max(2000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						status: z.string(),
						completedAt: z.string(),
						slaMet: z.boolean().nullable()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!wo) {
				throw ApiException.notFound('Work Order');
			}

			if (wo.status !== 'IN_PROGRESS') {
				throw ApiException.badRequest('Work order must be in progress to complete');
			}

			const now = new Date();
			const slaMet = wo.slaDeadline ? now <= wo.slaDeadline : null;

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.workOrder.update({
					where: { id: input.id },
					data: {
						status: 'COMPLETED',
						completedAt: now,
						actualCost: input.actualCost,
						actualHours: input.actualHours,
						resolutionNotes: input.resolutionNotes,
						slaMet
					}
				});

				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: input.id,
						fromStatus: 'IN_PROGRESS',
						toStatus: 'COMPLETED',
						changedBy: context.user!.id,
						notes: input.resolutionNotes || 'Work completed'
					}
				});

				// If there's an asset, log maintenance
				if (wo.assetId) {
					await tx.assetMaintenanceLog.create({
						data: {
							assetId: wo.assetId,
							maintenanceDate: now,
							maintenanceType: wo.category,
							description: wo.title,
							performedBy: wo.assignedVendorId ? 'Vendor' : 'Internal',
							cost: input.actualCost,
							workOrderId: wo.id,
							notes: input.resolutionNotes,
							createdBy: context.user!.id
						}
					});

					// Update asset maintenance dates
					const asset = await tx.asset.findUnique({ where: { id: wo.assetId } });
					if (asset) {
						await tx.asset.update({
							where: { id: wo.assetId },
							data: {
								lastMaintenanceDate: now,
								nextMaintenanceDate: asset.maintenanceFrequencyDays
									? new Date(now.getTime() + asset.maintenanceFrequencyDays * 24 * 60 * 60 * 1000)
									: null
							}
						});
					}
				}

				return result;
			});

			return successResponse(
				{
					workOrder: {
						id: updated.id,
						status: updated.status,
						completedAt: updated.completedAt!.toISOString(),
						slaMet: updated.slaMet
					}
				},
				context
			);
		}),

	/**
	 * Add comment to work order
	 */
	addComment: orgProcedure
		.input(
			z.object({
				workOrderId: z.string(),
				comment: z.string().min(1).max(2000),
				isInternal: z.boolean().default(false)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					comment: z.object({
						id: z.string(),
						comment: z.string(),
						createdAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});

			if (!wo) {
				throw ApiException.notFound('Work Order');
			}

			const comment = await prisma.workOrderComment.create({
				data: {
					workOrderId: input.workOrderId,
					comment: input.comment,
					isInternal: input.isInternal,
					authorId: context.user!.id
				}
			});

			return successResponse(
				{
					comment: {
						id: comment.id,
						comment: comment.comment,
						createdAt: comment.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get work order status history
	 */
	getStatusHistory: orgProcedure
		.input(z.object({ workOrderId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					history: z.array(
						z.object({
							id: z.string(),
							fromStatus: z.string().nullable(),
							toStatus: z.string(),
							changedBy: z.string(),
							changedAt: z.string(),
							notes: z.string().nullable()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});

			if (!wo) {
				throw ApiException.notFound('Work Order');
			}

			const history = await prisma.workOrderStatusHistory.findMany({
				where: { workOrderId: input.workOrderId },
				orderBy: { changedAt: 'asc' }
			});

			return successResponse(
				{
					history: history.map((h) => ({
						id: h.id,
						fromStatus: h.fromStatus,
						toStatus: h.toStatus,
						changedBy: h.changedBy,
						changedAt: h.changedAt.toISOString(),
						notes: h.notes
					}))
				},
				context
			);
		}),

	/**
	 * Create AP Invoice from completed work order
	 */
	createInvoice: orgProcedure
		.input(
			z.object({
				workOrderId: z.string(),
				invoiceNumber: z.string().min(1).max(50),
				invoiceDate: z.string().datetime(),
				dueDate: z.string().datetime(),
				laborAmount: z.number().min(0),
				materialsAmount: z.number().min(0).default(0),
				taxAmount: z.number().min(0).default(0),
				description: z.string().max(500).optional(),
				glAccountId: z.string() // Expense account for the invoice
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invoice: z.object({
						id: z.string(),
						invoiceNumber: z.string(),
						totalAmount: z.string(),
						status: z.string()
					}),
					workOrder: z.object({
						id: z.string(),
						status: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id },
				include: { assignedVendor: true }
			});

			if (!wo) {
				throw ApiException.notFound('Work Order');
			}

			if (!wo.assignedVendorId || !wo.assignedVendor) {
				throw ApiException.badRequest('Work order must have an assigned vendor');
			}

			if (wo.status !== 'COMPLETED') {
				throw ApiException.badRequest('Work order must be completed before creating invoice');
			}

			if (wo.invoiceId) {
				throw ApiException.conflict('Invoice already created for this work order');
			}

			// Validate GL account
			const glAccount = await prisma.gLAccount.findFirst({
				where: {
					id: input.glAccountId,
					associationId: association.id,
					accountType: 'EXPENSE',
					deletedAt: null
				}
			});

			if (!glAccount) {
				throw ApiException.notFound('GL Expense Account');
			}

			const subtotal = input.laborAmount + input.materialsAmount;
			const totalAmount = subtotal + input.taxAmount;

			const result = await prisma.$transaction(async (tx) => {
				// Create AP Invoice
				const invoice = await tx.aPInvoice.create({
					data: {
						associationId: association.id,
						vendorId: wo.assignedVendorId!,
						invoiceNumber: input.invoiceNumber,
						invoiceDate: new Date(input.invoiceDate),
						dueDate: new Date(input.dueDate),
						subtotal,
						taxAmount: input.taxAmount,
						totalAmount,
						balanceDue: totalAmount,
						status: 'PENDING_APPROVAL',
						description: input.description || `Work Order ${wo.workOrderNumber}: ${wo.title}`,
						workOrderId: wo.id,
						lineItems: {
							create: [
								...(input.laborAmount > 0 ? [{
									description: 'Labor',
									quantity: 1,
									unitPrice: input.laborAmount,
									amount: input.laborAmount,
									glAccountId: input.glAccountId,
									lineNumber: 1
								}] : []),
								...(input.materialsAmount > 0 ? [{
									description: 'Materials',
									quantity: 1,
									unitPrice: input.materialsAmount,
									amount: input.materialsAmount,
									glAccountId: input.glAccountId,
									lineNumber: 2
								}] : [])
							]
						}
					}
				});

				// Update work order with invoice reference and status
				const updatedWO = await tx.workOrder.update({
					where: { id: input.workOrderId },
					data: {
						invoiceId: invoice.id,
						status: 'INVOICED',
						actualCost: totalAmount
					}
				});

				// Record status change
				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: input.workOrderId,
						fromStatus: 'COMPLETED',
						toStatus: 'INVOICED',
						changedBy: context.user!.id,
						notes: `Invoice ${input.invoiceNumber} created`
					}
				});

				return { invoice, workOrder: updatedWO };
			});

			return successResponse(
				{
					invoice: {
						id: result.invoice.id,
						invoiceNumber: result.invoice.invoiceNumber,
						totalAmount: result.invoice.totalAmount.toString(),
						status: result.invoice.status
					},
					workOrder: {
						id: result.workOrder.id,
						status: result.workOrder.status
					}
				},
				context
			);
		}),

	// =========================================================================
	// DBOS Workflow-based Endpoints
	// =========================================================================

	/**
	 * Transition work order status using DBOS durable workflow
	 * This provides crash-resilient status transitions with automatic recovery
	 */
	transitionStatus: orgProcedure
		.input(
			z.object({
				workOrderId: z.string(),
				toStatus: workOrderStatusEnum,
				notes: z.string().max(1000).optional(),
				// Optional data for specific transitions
				vendorId: z.string().optional(),
				scheduledStart: z.string().datetime().optional(),
				scheduledEnd: z.string().datetime().optional(),
				actualCost: z.number().min(0).optional(),
				actualHours: z.number().min(0).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workflowId: z.string(),
					message: z.string()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			// Verify work order exists and belongs to org
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});

			if (!wo) {
				throw ApiException.notFound('Work Order');
			}

			// Start the durable workflow
			const { workflowId } = await startWorkOrderTransition({
				workOrderId: input.workOrderId,
				toStatus: input.toStatus as WorkOrderStatus,
				userId: context.user!.id,
				notes: input.notes,
				vendorId: input.vendorId,
				scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
				scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : undefined,
				actualCost: input.actualCost,
				actualHours: input.actualHours
			});

			return successResponse(
				{
					workflowId,
					message: `Workflow started for transitioning work order to ${input.toStatus}`
				},
				context
			);
		}),

	/**
	 * Get the status of a work order transition workflow
	 */
	getTransitionStatus: orgProcedure
		.input(z.object({ workflowId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					status: z.any().nullable(),
					error: z.any().nullable()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const status = await getWorkOrderTransitionStatus(input.workflowId);
			const error = await getWorkOrderTransitionError(input.workflowId);

			return successResponse(
				{
					status,
					error
				},
				context
			);
		})
};
