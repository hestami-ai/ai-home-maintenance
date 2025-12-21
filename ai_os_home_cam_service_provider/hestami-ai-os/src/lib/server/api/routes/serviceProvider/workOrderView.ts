import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse, PaginationInputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('WorkOrderViewRoute');

const assertServiceProviderOrg = async (organizationId: string) => {
	const org = await prisma.organization.findFirst({
		where: { id: organizationId, type: 'SERVICE_PROVIDER', deletedAt: null }
	});
	if (!org) {
		throw ApiException.forbidden('This feature is only available for service provider organizations');
	}
	return org;
};

export const workOrderViewRouter = {
	/**
	 * List all work orders assigned to this service provider across all associations
	 */
	listAssigned: orgProcedure
		.input(z.object({
			status: z.enum([
				'DRAFT', 'OPEN', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 
				'ON_HOLD', 'COMPLETED', 'INVOICED', 'CLOSED', 'CANCELLED'
			]).optional(),
			priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
			pagination: PaginationInputSchema.optional()
		}).optional())
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				workOrders: z.array(z.object({
					id: z.string(),
					workOrderNumber: z.string(),
					title: z.string(),
					status: z.string(),
					priority: z.string(),
					scheduledStart: z.string().nullable(),
					scheduledEnd: z.string().nullable(),
					association: z.object({
						id: z.string(),
						name: z.string()
					}),
					unit: z.object({
						id: z.string(),
						unitNumber: z.string()
					}).nullable(),
					vendor: z.object({
						id: z.string(),
						name: z.string()
					}).nullable()
				})),
				pagination: z.object({
					hasMore: z.boolean(),
					nextCursor: z.string().nullable()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'work_order', '*');
			const org = await assertServiceProviderOrg(context.organization!.id);

			// Get all vendor records linked to this service provider org
			const links = await prisma.serviceProviderLink.findMany({
				where: { serviceProviderOrgId: org.id, status: 'VERIFIED' },
				select: { vendorId: true }
			});

			// Also check vendors with direct serviceProviderOrgId link
			const directVendors = await prisma.vendor.findMany({
				where: { serviceProviderOrgId: org.id, deletedAt: null },
				select: { id: true }
			});

			const vendorIds = [
				...links.map(l => l.vendorId),
				...directVendors.map(v => v.id)
			];

			if (vendorIds.length === 0) {
				return successResponse({
					workOrders: [],
					pagination: { hasMore: false, nextCursor: null }
				}, context);
			}

			// Build query
			const where: Record<string, unknown> = {
				assignedVendorId: { in: vendorIds }
			};
			if (input?.status) where.status = input.status;
			if (input?.priority) where.priority = input.priority;

			const limit = input?.pagination?.limit ?? 50;
			const cursor = input?.pagination?.cursor;

			const workOrders = await prisma.workOrder.findMany({
				where,
				include: {
					association: { select: { id: true, name: true } },
					unit: { select: { id: true, unitNumber: true } },
					assignedVendor: { select: { id: true, name: true } }
				},
				orderBy: [
					{ priority: 'desc' },
					{ createdAt: 'desc' }
				],
				take: limit + 1,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
			});

			const hasMore = workOrders.length > limit;
			const results = hasMore ? workOrders.slice(0, limit) : workOrders;

			return successResponse({
				workOrders: results.map(wo => ({
					id: wo.id,
					workOrderNumber: wo.workOrderNumber,
					title: wo.title,
					status: wo.status,
					priority: wo.priority,
					scheduledStart: wo.scheduledStart?.toISOString() ?? null,
					scheduledEnd: wo.scheduledEnd?.toISOString() ?? null,
					association: {
						id: wo.association.id,
						name: wo.association.name
					},
					unit: wo.unit ? {
						id: wo.unit.id,
						unitNumber: wo.unit.unitNumber
					} : null,
					vendor: wo.assignedVendor ? {
						id: wo.assignedVendor.id,
						name: wo.assignedVendor.name
					} : null
				})),
				pagination: {
					hasMore,
					nextCursor: hasMore ? results[results.length - 1].id : null
				}
			}, context);
		}),

	/**
	 * Get work order details (cross-tenant view)
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				workOrder: z.object({
					id: z.string(),
					workOrderNumber: z.string(),
					title: z.string(),
					description: z.string(),
					status: z.string(),
					priority: z.string(),
					category: z.string(),
					scheduledStart: z.string().nullable(),
					scheduledEnd: z.string().nullable(),
					startedAt: z.string().nullable(),
					completedAt: z.string().nullable(),
					estimatedCost: z.string().nullable(),
					actualCost: z.string().nullable(),
					association: z.object({
						id: z.string(),
						name: z.string()
					}),
					unit: z.object({
						id: z.string(),
						unitNumber: z.string()
					}).nullable(),
					createdAt: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'work_order', input.id);
			const org = await assertServiceProviderOrg(context.organization!.id);

			// Get vendor IDs for this service provider
			const links = await prisma.serviceProviderLink.findMany({
				where: { serviceProviderOrgId: org.id, status: 'VERIFIED' },
				select: { vendorId: true }
			});
			const directVendors = await prisma.vendor.findMany({
				where: { serviceProviderOrgId: org.id, deletedAt: null },
				select: { id: true }
			});
			const vendorIds = [
				...links.map(l => l.vendorId),
				...directVendors.map(v => v.id)
			];

			const workOrder = await prisma.workOrder.findFirst({
				where: {
					id: input.id,
					assignedVendorId: { in: vendorIds }
				},
				include: {
					association: { select: { id: true, name: true } },
					unit: { select: { id: true, unitNumber: true } }
				}
			});

			if (!workOrder) {
				throw ApiException.notFound('Work order');
			}

			return successResponse({
				workOrder: {
					id: workOrder.id,
					workOrderNumber: workOrder.workOrderNumber,
					title: workOrder.title,
					description: workOrder.description,
					status: workOrder.status,
					priority: workOrder.priority,
					category: workOrder.category,
					scheduledStart: workOrder.scheduledStart?.toISOString() ?? null,
					scheduledEnd: workOrder.scheduledEnd?.toISOString() ?? null,
					startedAt: workOrder.startedAt?.toISOString() ?? null,
					completedAt: workOrder.completedAt?.toISOString() ?? null,
					estimatedCost: workOrder.estimatedCost?.toString() ?? null,
					actualCost: workOrder.actualCost?.toString() ?? null,
					association: {
						id: workOrder.association.id,
						name: workOrder.association.name
					},
					unit: workOrder.unit ? {
						id: workOrder.unit.id,
						unitNumber: workOrder.unit.unitNumber
					} : null,
					createdAt: workOrder.createdAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Get summary statistics for service provider dashboard
	 */
	summary: orgProcedure
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				summary: z.object({
					totalAssignedWorkOrders: z.number(),
					byStatus: z.record(z.string(), z.number()),
					byPriority: z.record(z.string(), z.number()),
					associationCount: z.number(),
					overdueCount: z.number()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ context }) => {
			await context.cerbos.authorize('view', 'work_order', '*');
			const org = await assertServiceProviderOrg(context.organization!.id);

			// Get vendor IDs
			const links = await prisma.serviceProviderLink.findMany({
				where: { serviceProviderOrgId: org.id, status: 'VERIFIED' },
				select: { vendorId: true }
			});
			const directVendors = await prisma.vendor.findMany({
				where: { serviceProviderOrgId: org.id, deletedAt: null },
				select: { id: true }
			});
			const vendorIds = [
				...links.map(l => l.vendorId),
				...directVendors.map(v => v.id)
			];

			if (vendorIds.length === 0) {
				return successResponse({
					summary: {
						totalAssignedWorkOrders: 0,
						byStatus: {},
						byPriority: {},
						associationCount: 0,
						overdueCount: 0
					}
				}, context);
			}

			// Get all work orders
			const workOrders = await prisma.workOrder.findMany({
				where: {
					assignedVendorId: { in: vendorIds },
					status: { notIn: ['CLOSED', 'CANCELLED'] }
				},
				select: {
					status: true,
					priority: true,
					associationId: true,
					slaDeadline: true
				}
			});

			const now = new Date();
			const byStatus: Record<string, number> = {};
			const byPriority: Record<string, number> = {};
			const associations = new Set<string>();
			let overdueCount = 0;

			for (const wo of workOrders) {
				byStatus[wo.status] = (byStatus[wo.status] || 0) + 1;
				byPriority[wo.priority] = (byPriority[wo.priority] || 0) + 1;
				associations.add(wo.associationId);
				if (wo.slaDeadline && wo.slaDeadline < now) {
					overdueCount++;
				}
			}

			return successResponse({
				summary: {
					totalAssignedWorkOrders: workOrders.length,
					byStatus,
					byPriority,
					associationCount: associations.size,
					overdueCount
				}
			}, context);
		})
};
