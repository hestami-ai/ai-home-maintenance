import { z } from 'zod';
import { orgProcedure, successResponse, IdempotencyKeySchema } from '../../router.js';
import { assertContractorComplianceForScheduling } from '../contractor/utils.js';
import { ApiException } from '../../errors.js';
import {
	ResponseMetaSchema,
	WorkOrderStatusSchema,
	WorkOrderPrioritySchema,
	WorkOrderCategorySchema,
	WorkOrderOriginTypeSchema,
	FundTypeSchema
} from '../../schemas.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import type { Prisma, TechnicianAvailability, WorkOrderStatus } from '../../../../../../generated/prisma/client.js';
import { ContractorTradeType, PricebookItemType } from '../../../../../../generated/prisma/client.js';
import { prisma } from '../../../db.js';
import {
	startWorkOrderTransition,
	getWorkOrderTransitionStatus,
	getWorkOrderTransitionError,
	type TransitionInput
} from '../../../workflows/workOrderLifecycle.js';
import { recordExecution, recordStatusChange, recordAssignment } from '../../middleware/activityEvent.js';

// Use shared enum schemas from schemas.ts
const workOrderStatusEnum = WorkOrderStatusSchema;
const workOrderOriginTypeEnum = WorkOrderOriginTypeSchema;
const fundTypeEnum = FundTypeSchema;
const workOrderPriorityEnum = WorkOrderPrioritySchema;
const workOrderCategoryEnum = WorkOrderCategorySchema;

// Valid status transitions (Phase 9: Added AUTHORIZED and REVIEW_REQUIRED)
const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
	DRAFT: ['SUBMITTED', 'CANCELLED'],
	SUBMITTED: ['TRIAGED', 'CANCELLED'],
	TRIAGED: ['AUTHORIZED', 'CANCELLED'], // Phase 9: Must go through AUTHORIZED
	AUTHORIZED: ['ASSIGNED', 'CANCELLED'], // Phase 9: New state
	ASSIGNED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
	SCHEDULED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
	IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
	ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
	COMPLETED: ['REVIEW_REQUIRED', 'INVOICED', 'CLOSED'], // Phase 9: Added REVIEW_REQUIRED
	REVIEW_REQUIRED: ['COMPLETED', 'CLOSED', 'CANCELLED'], // Phase 9: New state
	INVOICED: ['CLOSED'],
	CLOSED: [],
	CANCELLED: []
};

const dayIndexToName: Record<number, keyof Pick<TechnicianAvailability, 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'>> = {
	0: 'sunday',
	1: 'monday',
	2: 'tuesday',
	3: 'wednesday',
	4: 'thursday',
	5: 'friday',
	6: 'saturday'
};

const assertTechnicianEligibleForSchedule = async (
	technicianId: string,
	orgId: string,
	start: Date,
	end: Date,
	options?: {
		requiredTrade?: ContractorTradeType;
		serviceAreaId?: string;
	}
) => {
	const tech = await prisma.technician.findFirst({
		where: {
			id: technicianId,
			organizationId: orgId,
			isActive: true,
			OR: [
				{ terminationDate: null },
				{ terminationDate: { gt: start } }
			]
		}
	});
	if (!tech) {
		throw ApiException.forbidden('Technician not found or inactive for this organization');
	}

	const hasSkills = await prisma.technicianSkill.count({ where: { technicianId: tech.id } });
	if (hasSkills === 0) {
		throw ApiException.conflict('Technician has no recorded skills');
	}
	if (options?.requiredTrade) {
		const skill = await prisma.technicianSkill.findFirst({
			where: { technicianId: tech.id, trade: options.requiredTrade }
		});
		if (!skill) {
			throw ApiException.conflict('Technician lacks required trade/skill for this job');
		}
	}

	if (options?.serviceAreaId) {
		const territory = await prisma.technicianTerritory.findFirst({
			where: { technicianId: tech.id, serviceAreaId: options.serviceAreaId }
		});
		if (!territory) {
			throw ApiException.conflict('Technician is not assigned to the required service area');
		}
	}

	if (tech.branchId) {
		const branch = await prisma.contractorBranch.findFirst({
			where: { id: tech.branchId, organizationId: orgId, isActive: true }
		});
		if (!branch) {
			throw ApiException.forbidden('Technician branch is not active for this organization');
		}
	}

	// Ensure same-day scheduling for availability check
	if (start.toDateString() !== end.toDateString()) {
		throw ApiException.badRequest('Scheduling window must be within a single day for technician availability checks');
	}

	const availability = await prisma.technicianAvailability.findUnique({
		where: { technicianId: tech.id }
	});
	const dayName = dayIndexToName[start.getUTCDay()];

	if (availability && availability[dayName]) {
		const ranges = availability[dayName] as Array<{ start: string; end: string }>;
		const [startH, startM] = [start.getUTCHours(), start.getUTCMinutes()];
		const [endH, endM] = [end.getUTCHours(), end.getUTCMinutes()];
		const windowStart = startH * 60 + startM;
		const windowEnd = endH * 60 + endM;

		const fits = ranges.some((r) => {
			const [sh, sm] = r.start.split(':').map(Number);
			const [eh, em] = r.end.split(':').map(Number);
			const rangeStart = sh * 60 + sm;
			const rangeEnd = eh * 60 + em;
			return rangeStart <= windowStart && rangeEnd >= windowEnd;
		});
		if (!fits) {
			throw ApiException.conflict('Technician is not available in the requested window');
		}
	}

	const timeOff = await prisma.technicianTimeOff.findFirst({
		where: {
			technicianId: tech.id,
			startsAt: { lt: end },
			endsAt: { gt: start }
		}
	});
	if (timeOff) {
		throw ApiException.conflict('Technician is on time off during the requested window');
	}

	return tech;
};

const assertTechnicianActiveForOrg = async (technicianId: string, orgId: string) => {
	const tech = await prisma.technician.findFirst({
		where: {
			id: technicianId,
			organizationId: orgId,
			isActive: true,
			OR: [
				{ terminationDate: null },
				{ terminationDate: { gt: new Date() } }
			]
		}
	});
	if (!tech) {
		throw ApiException.forbidden('Technician not found or inactive for this organization');
	}
	if (tech.branchId) {
		const branch = await prisma.contractorBranch.findFirst({
			where: { id: tech.branchId, organizationId: orgId, isActive: true }
		});
		if (!branch) {
			throw ApiException.forbidden('Technician branch is not active for this organization');
		}
	}
	return tech;
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
				estimatedHours: z.number().min(0).optional(),
				// Phase 9: Origin tracking
				originType: workOrderOriginTypeEnum.optional(),
				violationId: z.string().optional(),
				arcRequestId: z.string().optional(),
				resolutionId: z.string().optional(),
				originNotes: z.string().max(2000).optional(),
				// Phase 9: Budget
				budgetSource: fundTypeEnum.optional(),
				approvedAmount: z.number().min(0).optional(),
				// Phase 9: Constraints
				constraints: z.string().max(2000).optional()
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
				meta: ResponseMetaSchema
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

			// Phase 9: Validate origin references if provided
			if (input.violationId) {
				const violation = await prisma.violation.findFirst({
					where: { id: input.violationId, associationId: association.id }
				});
				if (!violation) {
					throw ApiException.notFound('Violation');
				}
			}
			if (input.arcRequestId) {
				const arcRequest = await prisma.aRCRequest.findFirst({
					where: { id: input.arcRequestId, associationId: association.id }
				});
				if (!arcRequest) {
					throw ApiException.notFound('ARC Request');
				}
			}
			if (input.resolutionId) {
				const resolution = await prisma.resolution.findFirst({
					where: { id: input.resolutionId, associationId: association.id }
				});
				if (!resolution) {
					throw ApiException.notFound('Resolution');
				}
			}

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
						slaDeadline,
						// Phase 9: Origin tracking
						originType: input.originType,
						violationId: input.violationId,
						arcRequestId: input.arcRequestId,
						resolutionId: input.resolutionId,
						originNotes: input.originNotes,
						// Phase 9: Budget
						budgetSource: input.budgetSource,
						approvedAmount: input.approvedAmount,
						// Phase 9: Constraints
						constraints: input.constraints
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

			// Record activity event
			await recordExecution(context, {
				entityType: 'WORK_ORDER',
				entityId: workOrder.id,
				action: 'CREATE',
				summary: `Work order created: ${workOrder.title}`,
				workOrderId: workOrder.id,
				associationId: association.id,
				newState: {
					workOrderNumber: workOrder.workOrderNumber,
					title: workOrder.title,
					status: workOrder.status,
					priority: workOrder.priority,
					category: workOrder.category
				}
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
				assignedTechnicianId: z.string().optional(),
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
				meta: ResponseMetaSchema
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
			if (input?.assignedTechnicianId) where.assignedTechnicianId = input.assignedTechnicianId;
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
						assignedVendorId: wo.assignedVendorId,
						assignedTechnicianId: wo.assignedTechnicianId
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
				meta: ResponseMetaSchema
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
						assignedTechnicianId: wo.assignedTechnicianId,
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
				meta: ResponseMetaSchema
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

			// Record activity event
			await recordStatusChange(context, 'WORK_ORDER', updated.id, previousStatus, input.status,
				`Work order status changed from ${previousStatus} to ${input.status}${input.notes ? `: ${input.notes}` : ''}`,
				{ workOrderId: updated.id, associationId: association.id }
			);

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
				meta: ResponseMetaSchema
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

			// Phase 9: Must be in AUTHORIZED status to assign (or already ASSIGNED)
			if (wo.status !== 'AUTHORIZED' && wo.status !== 'ASSIGNED') {
				throw ApiException.badRequest('Work order must be authorized before assigning vendor');
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

			// Record activity event
			await recordAssignment(context, 'WORK_ORDER', updated.id, input.vendorId, vendor.name,
				`Vendor assigned to work order: ${vendor.name}`,
				{ workOrderId: updated.id, associationId: association.id }
			);

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
	 * Assign technician to work order
	 */
	assignTechnician: orgProcedure
		.input(
			z.object({
				id: z.string(),
				technicianId: z.string(),
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
						assignedTechnicianId: z.string()
					})
				}),
				meta: ResponseMetaSchema
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

			// Validate technician
			const tech = await assertTechnicianActiveForOrg(input.technicianId, context.organization!.id);

			// Phase 9: Must be in AUTHORIZED/ASSIGNED/SCHEDULED to assign technician
			if (!['AUTHORIZED', 'ASSIGNED', 'SCHEDULED'].includes(wo.status)) {
				throw ApiException.badRequest('Work order must be authorized or assigned before assigning technician');
			}

			const previousStatus = wo.status;

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.workOrder.update({
					where: { id: input.id },
					data: {
						assignedTechnicianId: tech.id,
						assignedTechnicianBranchId: tech.branchId,
						status: previousStatus === 'TRIAGED' ? 'ASSIGNED' : previousStatus
					}
				});

				if (previousStatus === 'TRIAGED') {
					await tx.workOrderStatusHistory.create({
						data: {
							workOrderId: input.id,
							fromStatus: previousStatus,
							toStatus: 'ASSIGNED',
							changedBy: context.user!.id,
							notes: input.notes || `Assigned to technician: ${tech.firstName} ${tech.lastName}`
						}
					});
				}

				return result;
			});

			// Record activity event
			await recordAssignment(context, 'WORK_ORDER', updated.id, tech.id, `${tech.firstName} ${tech.lastName}`,
				`Technician assigned to work order: ${tech.firstName} ${tech.lastName}`,
				{ workOrderId: updated.id, associationId: association.id, technicianId: tech.id }
			);

			return successResponse(
				{
					workOrder: {
						id: updated.id,
						status: updated.status,
						assignedTechnicianId: updated.assignedTechnicianId!
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
				technicianId: z.string().optional(),
				requiredTrade: z.nativeEnum(ContractorTradeType).optional(),
				serviceAreaId: z.string().optional(),
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
				meta: ResponseMetaSchema
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

			const start = new Date(input.scheduledStart);
			const end = input.scheduledEnd ? new Date(input.scheduledEnd) : new Date(start.getTime() + 30 * 60 * 1000);
			if (end <= start) {
				throw ApiException.badRequest('scheduledEnd must be after scheduledStart');
			}

			const technicianId = input.technicianId ?? wo.assignedTechnicianId;
			let technicianBranchId: string | null | undefined = wo.assignedTechnicianBranchId;
			if (technicianId) {
				const tech = await assertTechnicianEligibleForSchedule(technicianId, context.organization.id, start, end);
				technicianBranchId = tech.branchId ?? null;
			}

			const previousStatus = wo.status;

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.workOrder.update({
					where: { id: input.id },
					data: {
						scheduledStart: start,
						scheduledEnd: end,
						assignedTechnicianId: technicianId ?? wo.assignedTechnicianId,
						assignedTechnicianBranchId: technicianBranchId ?? wo.assignedTechnicianBranchId,
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
				meta: ResponseMetaSchema
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
	 * Phase 9: Authorize work order (CAM Oversight)
	 * Validates required artifacts and transitions to AUTHORIZED status
	 */
	authorize: orgProcedure
		.input(
			z.object({
				workOrderId: z.string(),
				rationale: z.string().min(1).max(2000),
				budgetSource: fundTypeEnum,
				approvedAmount: z.number().min(0),
				constraints: z.string().max(2000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						status: z.string(),
						authorizedAt: z.string(),
						requiresBoardApproval: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('authorize', 'work_order', input.workOrderId);

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

			// Must be in TRIAGED status to authorize
			if (wo.status !== 'TRIAGED') {
				throw ApiException.badRequest('Work order must be triaged before authorization');
			}

			// Phase 9: Validate required artifacts before authorization
			const missingArtifacts: string[] = [];
			if (!wo.originType) missingArtifacts.push('Origin type');
			if (!wo.unitId && !wo.commonAreaName && !wo.assetId) {
				missingArtifacts.push('Asset/location');
			}
			if (!wo.description) missingArtifacts.push('Scope description');

			if (missingArtifacts.length > 0) {
				throw ApiException.badRequest(
					`Cannot authorize: missing required artifacts: ${missingArtifacts.join(', ')}`
				);
			}

			// Check if board approval is required based on threshold
			const settings = association.settings as Record<string, unknown> | null;
			const threshold = (settings?.workOrder as Record<string, unknown>)?.boardApprovalThreshold as number | undefined;
			const requiresBoardApproval = threshold !== undefined && input.approvedAmount > threshold;

			const now = new Date();

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.workOrder.update({
					where: { id: input.workOrderId },
					data: {
						status: requiresBoardApproval ? 'TRIAGED' : 'AUTHORIZED', // Stay in TRIAGED if board approval needed
						authorizedBy: requiresBoardApproval ? null : context.user!.id,
						authorizedAt: requiresBoardApproval ? null : now,
						authorizationRationale: input.rationale,
						authorizingRole: requiresBoardApproval ? null : 'MANAGER',
						budgetSource: input.budgetSource,
						approvedAmount: input.approvedAmount,
						constraints: input.constraints,
						requiresBoardApproval,
						boardApprovalStatus: requiresBoardApproval ? 'PENDING' : null
					}
				});

				if (!requiresBoardApproval) {
					await tx.workOrderStatusHistory.create({
						data: {
							workOrderId: input.workOrderId,
							fromStatus: 'TRIAGED',
							toStatus: 'AUTHORIZED',
							changedBy: context.user!.id,
							notes: `Authorized by manager: ${input.rationale}`
						}
					});
				}

				return result;
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'WORK_ORDER',
				entityId: updated.id,
				action: requiresBoardApproval ? 'UPDATE' : 'APPROVE',
				summary: requiresBoardApproval
					? `Work order requires board approval (amount: ${input.approvedAmount})`
					: `Work order authorized: ${input.rationale}`,
				workOrderId: updated.id,
				associationId: association.id,
				newState: {
					status: updated.status,
					budgetSource: updated.budgetSource,
					approvedAmount: updated.approvedAmount?.toString(),
					requiresBoardApproval: updated.requiresBoardApproval,
					authorizingRole: updated.authorizingRole
				}
			});

			return successResponse(
				{
					workOrder: {
						id: updated.id,
						status: updated.status,
						authorizedAt: updated.authorizedAt?.toISOString() ?? now.toISOString(),
						requiresBoardApproval: updated.requiresBoardApproval
					}
				},
				context
			);
		}),

	/**
	 * Phase 9: Accept work order completion (CAM Oversight)
	 * Transitions from COMPLETED to CLOSED with outcome summary
	 */
	acceptCompletion: orgProcedure
		.input(
			z.object({
				workOrderId: z.string(),
				outcomeSummary: z.string().min(1).max(2000),
				actualCost: z.number().min(0).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						status: z.string(),
						closedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('accept', 'work_order', input.workOrderId);

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

			// Must be in COMPLETED or REVIEW_REQUIRED status
			if (wo.status !== 'COMPLETED' && wo.status !== 'REVIEW_REQUIRED') {
				throw ApiException.badRequest('Work order must be completed before accepting');
			}

			const now = new Date();
			const previousStatus = wo.status;

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.workOrder.update({
					where: { id: input.workOrderId },
					data: {
						status: 'CLOSED',
						closedAt: now,
						closedBy: context.user!.id,
						resolutionNotes: input.outcomeSummary,
						actualCost: input.actualCost ?? wo.actualCost,
						spendToDate: input.actualCost ?? wo.actualCost ?? wo.spendToDate
					}
				});

				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: input.workOrderId,
						fromStatus: previousStatus,
						toStatus: 'CLOSED',
						changedBy: context.user!.id,
						notes: `Completion accepted: ${input.outcomeSummary}`
					}
				});

				return result;
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'WORK_ORDER',
				entityId: updated.id,
				action: 'APPROVE',
				summary: `Work order completion accepted: ${input.outcomeSummary}`,
				workOrderId: updated.id,
				associationId: association.id,
				newState: {
					status: updated.status,
					closedAt: updated.closedAt?.toISOString(),
					resolutionNotes: updated.resolutionNotes
				}
			});

			return successResponse(
				{
					workOrder: {
						id: updated.id,
						status: updated.status,
						closedAt: updated.closedAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Phase 9: Request board approval for work order
	 * Creates a Vote linked to the work order for board decision
	 */
	requestBoardApproval: orgProcedure
		.input(
			z.object({
				workOrderId: z.string(),
				meetingId: z.string(),
				question: z.string().max(500).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						boardApprovalVoteId: z.string(),
						boardApprovalStatus: z.string()
					}),
					vote: z.object({
						id: z.string(),
						question: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('request_board_approval', 'work_order', input.workOrderId);

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

			if (!wo.requiresBoardApproval) {
				throw ApiException.badRequest('Work order does not require board approval');
			}

			if (wo.boardApprovalVoteId) {
				throw ApiException.badRequest('Board approval vote already exists for this work order');
			}

			// Validate meeting exists and belongs to association
			const meeting = await prisma.meeting.findFirst({
				where: { id: input.meetingId },
				include: { board: true }
			});

			if (!meeting || !meeting.board || meeting.board.associationId !== association.id) {
				throw ApiException.notFound('Meeting');
			}

			const question = input.question ?? 
				`Approve work order ${wo.workOrderNumber}: ${wo.title} (Budget: $${wo.approvedAmount?.toString() ?? 'TBD'})`;

			// Create vote for board approval
			const vote = await prisma.vote.create({
				data: {
					meetingId: input.meetingId,
					question,
					method: 'IN_PERSON',
					createdBy: context.user!.id
				}
			});

			// Link vote to work order
			const updated = await prisma.workOrder.update({
				where: { id: input.workOrderId },
				data: {
					boardApprovalVoteId: vote.id,
					boardApprovalStatus: 'PENDING'
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'WORK_ORDER',
				entityId: updated.id,
				action: 'UPDATE',
				summary: `Board approval requested for work order ${wo.workOrderNumber}`,
				workOrderId: updated.id,
				associationId: association.id,
				newState: {
					boardApprovalVoteId: vote.id,
					boardApprovalStatus: 'PENDING'
				}
			});

			return successResponse(
				{
					workOrder: {
						id: updated.id,
						boardApprovalVoteId: updated.boardApprovalVoteId!,
						boardApprovalStatus: updated.boardApprovalStatus!
					},
					vote: {
						id: vote.id,
						question: vote.question
					}
				},
				context
			);
		}),

	/**
	 * Phase 9: Record board decision on work order approval
	 * Updates work order based on vote outcome
	 */
	recordBoardDecision: orgProcedure
		.input(
			z.object({
				workOrderId: z.string(),
				approved: z.boolean(),
				rationale: z.string().min(1).max(2000)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						status: z.string(),
						boardApprovalStatus: z.string(),
						authorizedAt: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('record_board_decision', 'work_order', input.workOrderId);

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

			if (!wo.requiresBoardApproval) {
				throw ApiException.badRequest('Work order does not require board approval');
			}

			if (wo.boardApprovalStatus !== 'PENDING') {
				throw ApiException.badRequest('Board decision has already been recorded');
			}

			const now = new Date();
			const newStatus = input.approved ? 'AUTHORIZED' : 'CANCELLED';
			const boardApprovalStatus = input.approved ? 'APPROVED' : 'DENIED';

			const updated = await prisma.$transaction(async (tx) => {
				// Close the vote if it exists
				if (wo.boardApprovalVoteId) {
					await tx.vote.update({
						where: { id: wo.boardApprovalVoteId },
						data: { closedAt: now }
					});
				}

				const result = await tx.workOrder.update({
					where: { id: input.workOrderId },
					data: {
						status: newStatus,
						boardApprovalStatus,
						authorizedBy: input.approved ? context.user!.id : null,
						authorizedAt: input.approved ? now : null,
						authorizingRole: input.approved ? 'BOARD' : null,
						authorizationRationale: input.rationale
					}
				});

				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: input.workOrderId,
						fromStatus: wo.status,
						toStatus: newStatus,
						changedBy: context.user!.id,
						notes: input.approved 
							? `Board approved: ${input.rationale}`
							: `Board denied: ${input.rationale}`
					}
				});

				return result;
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'WORK_ORDER',
				entityId: updated.id,
				action: input.approved ? 'APPROVE' : 'DENY',
				summary: input.approved 
					? `Board approved work order: ${input.rationale}`
					: `Board denied work order: ${input.rationale}`,
				workOrderId: updated.id,
				associationId: association.id,
				newState: {
					status: updated.status,
					boardApprovalStatus: updated.boardApprovalStatus,
					authorizingRole: updated.authorizingRole
				}
			});

			return successResponse(
				{
					workOrder: {
						id: updated.id,
						status: updated.status,
						boardApprovalStatus: updated.boardApprovalStatus!,
						authorizedAt: updated.authorizedAt?.toISOString() ?? null
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
				meta: ResponseMetaSchema
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
				meta: ResponseMetaSchema
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
				meta: ResponseMetaSchema
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
				meta: ResponseMetaSchema
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
				meta: ResponseMetaSchema
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
		}),

	// =========================================================================
	// Pricebook / Line Items
	// =========================================================================

	/**
	 * Set pricebook version and/or job template for a work order
	 */
	setPricebook: orgProcedure
		.input(
			z
				.object({
					workOrderId: z.string(),
					pricebookVersionId: z.string().optional(),
					jobTemplateId: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					workOrder: z.object({
						id: z.string(),
						pricebookVersionId: z.string().nullable(),
						jobTemplateId: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});
			if (!wo) throw ApiException.notFound('Work Order');

			// Validate pricebook version if provided
			if (input.pricebookVersionId) {
				const version = await prisma.pricebookVersion.findFirst({
					where: { id: input.pricebookVersionId, status: { in: ['ACTIVE', 'PUBLISHED'] } },
					include: { pricebook: true }
				});
				if (!version) throw ApiException.notFound('PricebookVersion');
			}

			// Validate job template if provided
			if (input.jobTemplateId) {
				const template = await prisma.jobTemplate.findFirst({
					where: { id: input.jobTemplateId, isActive: true }
				});
				if (!template) throw ApiException.notFound('JobTemplate');
			}

			const result = await withIdempotency(input.idempotencyKey, context, async () =>
				prisma.workOrder.update({
					where: { id: input.workOrderId },
					data: {
						pricebookVersionId: input.pricebookVersionId ?? wo.pricebookVersionId,
						jobTemplateId: input.jobTemplateId ?? wo.jobTemplateId
					}
				})
			);

			return successResponse(
				{
					workOrder: {
						id: result.result.id,
						pricebookVersionId: result.result.pricebookVersionId,
						jobTemplateId: result.result.jobTemplateId
					}
				},
				context
			);
		}),

	/**
	 * Add line item to work order (from pricebook or custom)
	 */
	addLineItem: orgProcedure
		.input(
			z
				.object({
					workOrderId: z.string(),
					pricebookItemId: z.string().optional(),
					quantity: z.number().positive().default(1),
					unitPrice: z.number().nonnegative().optional(),
					notes: z.string().optional(),
					// For custom items (no pricebookItemId)
					itemCode: z.string().optional(),
					itemName: z.string().optional(),
					itemType: z.nativeEnum(PricebookItemType).optional(),
					unitOfMeasure: z.string().optional(),
					trade: z.nativeEnum(ContractorTradeType).optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					lineItem: z.object({
						id: z.string(),
						lineNumber: z.number(),
						itemName: z.string().nullable(),
						quantity: z.string(),
						unitPrice: z.string(),
						total: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});
			if (!wo) throw ApiException.notFound('Work Order');

			let unitPrice = input.unitPrice ?? 0;
			let itemCode = input.itemCode ?? null;
			let itemName = input.itemName ?? null;
			let itemType = input.itemType ?? null;
			let unitOfMeasure = input.unitOfMeasure ?? null;
			let trade = input.trade ?? null;
			const isCustom = !input.pricebookItemId;

			// If pricebook item provided, snapshot its data
			if (input.pricebookItemId) {
				const pbItem = await prisma.pricebookItem.findUnique({
					where: { id: input.pricebookItemId }
				});
				if (!pbItem) throw ApiException.notFound('PricebookItem');

				unitPrice = input.unitPrice ?? pbItem.basePrice.toNumber();
				itemCode = pbItem.code;
				itemName = pbItem.name;
				itemType = pbItem.type;
				unitOfMeasure = pbItem.unitOfMeasure;
				trade = pbItem.trade;
			}

			const total = unitPrice * input.quantity;

			// Get next line number
			const maxLine = await prisma.workOrderLineItem.aggregate({
				where: { workOrderId: input.workOrderId },
				_max: { lineNumber: true }
			});
			const lineNumber = (maxLine._max?.lineNumber ?? 0) + 1;

			const result = await withIdempotency(input.idempotencyKey, context, async () =>
				prisma.workOrderLineItem.create({
					data: {
						workOrderId: input.workOrderId,
						pricebookItemId: input.pricebookItemId ?? null,
						quantity: input.quantity,
						unitPrice,
						total,
						lineNumber,
						notes: input.notes ?? null,
						isCustom,
						itemCode,
						itemName,
						itemType,
						unitOfMeasure,
						trade
					}
				})
			);

			return successResponse(
				{
					lineItem: {
						id: result.result.id,
						lineNumber: result.result.lineNumber,
						itemName: result.result.itemName,
						quantity: result.result.quantity.toString(),
						unitPrice: result.result.unitPrice.toString(),
						total: result.result.total.toString()
					}
				},
				context
			);
		}),

	/**
	 * List line items for a work order
	 */
	listLineItems: orgProcedure
		.input(z.object({ workOrderId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					lineItems: z.array(
						z.object({
							id: z.string(),
							lineNumber: z.number(),
							pricebookItemId: z.string().nullable(),
							itemCode: z.string().nullable(),
							itemName: z.string().nullable(),
							itemType: z.string().nullable(),
							quantity: z.string(),
							unitPrice: z.string(),
							total: z.string(),
							notes: z.string().nullable(),
							isCustom: z.boolean()
						})
					),
					totals: z.object({
						lineCount: z.number(),
						grandTotal: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});
			if (!wo) throw ApiException.notFound('Work Order');

			const lineItems = await prisma.workOrderLineItem.findMany({
				where: { workOrderId: input.workOrderId },
				orderBy: { lineNumber: 'asc' }
			});

			const grandTotal = lineItems.reduce((sum, li) => sum + li.total.toNumber(), 0);

			return successResponse(
				{
					lineItems: lineItems.map((li) => ({
						id: li.id,
						lineNumber: li.lineNumber,
						pricebookItemId: li.pricebookItemId,
						itemCode: li.itemCode,
						itemName: li.itemName,
						itemType: li.itemType,
						quantity: li.quantity.toString(),
						unitPrice: li.unitPrice.toString(),
						total: li.total.toString(),
						notes: li.notes,
						isCustom: li.isCustom
					})),
					totals: {
						lineCount: lineItems.length,
						grandTotal: grandTotal.toString()
					}
				},
				context
			);
		}),

	/**
	 * Remove line item from work order
	 */
	removeLineItem: orgProcedure
		.input(
			z
				.object({
					workOrderId: z.string(),
					lineItemId: z.string()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});
			if (!wo) throw ApiException.notFound('Work Order');

			const lineItem = await prisma.workOrderLineItem.findFirst({
				where: { id: input.lineItemId, workOrderId: input.workOrderId }
			});
			if (!lineItem) throw ApiException.notFound('LineItem');

			await withIdempotency(input.idempotencyKey, context, async () =>
				prisma.workOrderLineItem.delete({ where: { id: input.lineItemId } })
			);

			return successResponse({ deleted: true }, context);
		}),

	/**
	 * Apply job template to work order (bulk add line items)
	 */
	applyJobTemplate: orgProcedure
		.input(
			z
				.object({
					workOrderId: z.string(),
					jobTemplateId: z.string(),
					clearExisting: z.boolean().default(false)
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					addedCount: z.number(),
					workOrder: z.object({
						id: z.string(),
						jobTemplateId: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});
			if (!wo) throw ApiException.notFound('Work Order');

			const template = await prisma.jobTemplate.findFirst({
				where: { id: input.jobTemplateId, isActive: true },
				include: { items: { include: { pricebookItem: true } } }
			});
			if (!template) throw ApiException.notFound('JobTemplate');

			const result = await withIdempotency(input.idempotencyKey, context, async () => {
				// Optionally clear existing line items
				if (input.clearExisting) {
					await prisma.workOrderLineItem.deleteMany({ where: { workOrderId: input.workOrderId } });
				}

				// Get starting line number
				const maxLine = await prisma.workOrderLineItem.aggregate({
					where: { workOrderId: input.workOrderId },
					_max: { lineNumber: true }
				});
				let lineNumber = input.clearExisting ? 1 : (maxLine._max?.lineNumber ?? 0) + 1;

				// Create line items from template
				const lineItemsData = template.items.map((ti) => {
					const pbItem = ti.pricebookItem;
					const unitPrice = pbItem.basePrice.toNumber();
					const quantity = ti.quantity.toNumber();
					const total = unitPrice * quantity;
					const data = {
						workOrderId: input.workOrderId,
						pricebookItemId: ti.pricebookItemId,
						quantity,
						unitPrice,
						total,
						lineNumber: lineNumber++,
						notes: ti.notes,
						isCustom: false,
						itemCode: pbItem.code,
						itemName: pbItem.name,
						itemType: pbItem.type,
						unitOfMeasure: pbItem.unitOfMeasure,
						trade: pbItem.trade
					};
					return data;
				});

				await prisma.workOrderLineItem.createMany({ data: lineItemsData });

				// Update work order with template reference
				const updatedWO = await prisma.workOrder.update({
					where: { id: input.workOrderId },
					data: {
						jobTemplateId: template.id,
						pricebookVersionId: template.pricebookVersionId
					}
				});

				return { addedCount: lineItemsData.length, workOrder: updatedWO };
			});

			return successResponse(
				{
					addedCount: result.result.addedCount,
					workOrder: {
						id: result.result.workOrder.id,
						jobTemplateId: result.result.workOrder.jobTemplateId!
					}
				},
				context
			);
		})
};
