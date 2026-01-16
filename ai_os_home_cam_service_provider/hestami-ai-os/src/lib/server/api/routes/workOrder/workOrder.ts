import { z } from 'zod';
import { orgProcedure, successResponse, IdempotencyKeySchema } from '../../router.js';
import { assertContractorComplianceForScheduling } from '../contractor/utils.js';

import {
	ResponseMetaSchema,
	WorkOrderStatusSchema,
	WorkOrderPrioritySchema,
	WorkOrderCategorySchema,
	WorkOrderOriginTypeSchema,
	FundTypeSchema
} from '$lib/schemas/index.js';
import type { Prisma, TechnicianAvailability, WorkOrderStatus } from '../../../../../../generated/prisma/client.js';
import { ContractorTradeType, PricebookItemType } from '../../../../../../generated/prisma/client.js';
import { prisma } from '../../../db.js';
import {
	startWorkOrderTransition,
	getWorkOrderTransitionStatus,
	getWorkOrderTransitionError,
	type TransitionInput
} from '../../../workflows/workOrderLifecycle.js';
import {
	startAddLineItemWorkflow,
	startRemoveLineItemWorkflow
} from '../../../workflows/workOrderLineItemWorkflow.js';
import { startWorkOrderConfigWorkflow } from '../../../workflows/workOrderConfigWorkflow.js';
import { startWorkOrderMutationWorkflow } from '../../../workflows/index.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('WorkOrderRoute');

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
	errors: any,
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
		throw errors.FORBIDDEN({ message: 'Technician not found or inactive for this organization' });
	}

	const hasSkills = await prisma.technicianSkill.count({ where: { technicianId: tech.id } });
	if (hasSkills === 0) {
		throw errors.CONFLICT({ message: 'Technician has no recorded skills' });
	}
	if (options?.requiredTrade) {
		const skill = await prisma.technicianSkill.findFirst({
			where: { technicianId: tech.id, trade: options.requiredTrade }
		});
		if (!skill) {
			throw errors.CONFLICT({ message: 'Technician lacks required trade/skill for this job' });
		}
	}

	if (options?.serviceAreaId) {
		const territory = await prisma.technicianTerritory.findFirst({
			where: { technicianId: tech.id, serviceAreaId: options.serviceAreaId }
		});
		if (!territory) {
			throw errors.CONFLICT({ message: 'Technician is not assigned to the required service area' });
		}
	}

	if (tech.branchId) {
		const branch = await prisma.contractorBranch.findFirst({
			where: { id: tech.branchId, organizationId: orgId, isActive: true }
		});
		if (!branch) {
			throw errors.FORBIDDEN({ message: 'Technician branch is not active for this organization' });
		}
	}

	// Ensure same-day scheduling for availability check
	if (start.toDateString() !== end.toDateString()) {
		throw errors.BAD_REQUEST({ message: 'Scheduling window must be within a single day for technician availability checks' });
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
			throw errors.CONFLICT({ message: 'Technician is not available in the requested window' });
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
		throw errors.CONFLICT({ message: 'Technician is on time off during the requested window' });
	}

	return tech;
};

const assertTechnicianActiveForOrg = async (technicianId: string, orgId: string, errors: any) => {
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
		throw errors.FORBIDDEN({ message: 'Technician not found or inactive for this organization' });
	}
	if (tech.branchId) {
		const branch = await prisma.contractorBranch.findFirst({
			where: { id: tech.branchId, organizationId: orgId, isActive: true }
		});
		if (!branch) {
			throw errors.FORBIDDEN({ message: 'Technician branch is not active for this organization' });
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
                idempotencyKey: z.string().uuid(),
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'work_order', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			// Validate unit if provided
			if (input.unitId) {
				const unit = await prisma.unit.findFirst({
					where: { id: input.unitId, organizationId: context.organization.id },
					include: { property: { include: { association: true } } }
				});
				if (!unit || unit.property.association.organizationId !== context.organization!.id) {
					throw errors.NOT_FOUND({ message: 'Unit' });
				}
			}

			// Validate asset if provided
			if (input.assetId) {
				const asset = await prisma.asset.findFirst({
					where: { id: input.assetId, organizationId: context.organization.id, associationId: association.id, deletedAt: null }
				});
				if (!asset) {
					throw errors.NOT_FOUND({ message: 'Asset' });
				}
			}

			// Generate work order number
			const lastWO = await prisma.workOrder.findFirst({
				where: { organizationId: context.organization.id, associationId: association.id },
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
					where: { id: input.violationId, organizationId: context.organization.id, associationId: association.id }
				});
				if (!violation) {
					throw errors.NOT_FOUND({ message: 'Violation' });
				}
			}
			if (input.arcRequestId) {
				const arcRequest = await prisma.aRCRequest.findFirst({
					where: { id: input.arcRequestId, organizationId: context.organization.id, associationId: association.id }
				});
				if (!arcRequest) {
					throw errors.NOT_FOUND({ message: 'ARC Request' });
				}
			}
			if (input.resolutionId) {
				const resolution = await prisma.resolution.findFirst({
					where: { id: input.resolutionId, associationId: association.id, association: { organizationId: context.organization.id } }
				});
				if (!resolution) {
					throw errors.NOT_FOUND({ message: 'Resolution' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'CREATE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderNumber,
					title: input.title,
					description: input.description,
					category: input.category,
					priority: input.priority,
					unitId: input.unitId,
					commonAreaName: input.commonAreaName,
					assetId: input.assetId,
					locationDetails: input.locationDetails,
					scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : null,
					scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : null,
					estimatedCost: input.estimatedCost,
					estimatedHours: input.estimatedHours,
					slaDeadline,
					originType: input.originType,
					violationId: input.violationId,
					arcRequestId: input.arcRequestId,
					resolutionId: input.resolutionId,
					originNotes: input.originNotes,
					budgetSource: input.budgetSource,
					approvedAmount: input.approvedAmount,
					constraints: input.constraints
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to create work order' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						workOrderNumber: workflowResult.workOrderNumber!,
						title: input.title,
						status: workflowResult.status!,
						priority: input.priority
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'work_order', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const where: Prisma.WorkOrderWhereInput = {
				organizationId: context.organization.id,
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
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
                idempotencyKey: z.string().uuid(),
                id: z.string(),
				status: workOrderStatusEnum,
				notes: z.string().max(1000).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			// Validate transition
			const allowed = validTransitions[wo.status];
			if (!allowed.includes(input.status)) {
				throw errors.BAD_REQUEST({
					message: `Cannot transition from ${wo.status} to ${input.status}`
				});
			}

			const previousStatus = wo.status;

			// Calculate slaMet for COMPLETED status
			let slaMet: boolean | null = null;
			if (input.status === 'COMPLETED' && wo.slaDeadline) {
				slaMet = new Date() <= wo.slaDeadline;
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'UPDATE_STATUS',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.id,
					previousStatus,
					newStatus: input.status,
					notes: input.notes,
					slaMet
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to update work order status' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						status: workflowResult.status!,
						previousStatus: workflowResult.previousStatus!
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
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				vendorId: z.string(),
				notes: z.string().max(1000).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			// Validate vendor
			const vendor = await prisma.vendor.findFirst({
				where: { id: input.vendorId, organizationId: context.organization.id, associationId: association.id, isActive: true }
			});

			if (!vendor) {
				throw errors.NOT_FOUND({ message: 'Vendor' });
			}

			// Phase 9: Must be in AUTHORIZED status to assign (or already ASSIGNED)
			if (wo.status !== 'AUTHORIZED' && wo.status !== 'ASSIGNED') {
				throw errors.BAD_REQUEST({ message: 'Work order must be authorized before assigning vendor' });
			}

			const previousStatus = wo.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'ASSIGN_VENDOR',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.id,
					vendorId: input.vendorId,
					vendorName: vendor.name,
					previousStatus,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to assign vendor' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						status: workflowResult.status!,
						assignedVendorId: input.vendorId
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
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				technicianId: z.string(),
				notes: z.string().max(1000).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			// Validate technician
			const tech = await assertTechnicianActiveForOrg(input.technicianId, context.organization!.id, errors);

			// Phase 9: Must be in AUTHORIZED/ASSIGNED/SCHEDULED to assign technician
			if (!['AUTHORIZED', 'ASSIGNED', 'SCHEDULED'].includes(wo.status)) {
				throw errors.BAD_REQUEST({ message: 'Work order must be authorized or assigned before assigning technician' });
			}

			const previousStatus = wo.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'ASSIGN_TECHNICIAN',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.id,
					technicianId: tech.id,
					technicianBranchId: tech.branchId,
					technicianName: `${tech.firstName} ${tech.lastName}`,
					previousStatus,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to assign technician' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						status: workflowResult.status!,
						assignedTechnicianId: tech.id
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
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				scheduledStart: z.string().datetime(),
				scheduledEnd: z.string().datetime().optional(),
				technicianId: z.string().optional(),
				requiredTrade: z.nativeEnum(ContractorTradeType).optional(),
				serviceAreaId: z.string().optional(),
				notes: z.string().max(1000).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			if (!wo.assignedVendorId) {
				throw errors.BAD_REQUEST({ message: 'Work order must have a vendor assigned before scheduling' });
			}

			// Compliance gate: ensure the contractor has active license/insurance before scheduling
			await assertContractorComplianceForScheduling(context.organization.id, errors);

			const start = new Date(input.scheduledStart);
			const end = input.scheduledEnd ? new Date(input.scheduledEnd) : new Date(start.getTime() + 30 * 60 * 1000);
			if (end <= start) {
				throw errors.BAD_REQUEST({ message: 'scheduledEnd must be after scheduledStart' });
			}

			const technicianId = input.technicianId ?? wo.assignedTechnicianId;
			let technicianBranchId: string | null | undefined = wo.assignedTechnicianBranchId;
			if (technicianId) {
				const tech = await assertTechnicianEligibleForSchedule(technicianId, context.organization.id, start, end, errors);
				technicianBranchId = tech.branchId ?? null;
			}

			const previousStatus = wo.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'SCHEDULE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.id,
					scheduledStart: start,
					scheduledEnd: end,
					technicianId: technicianId ?? wo.assignedTechnicianId ?? undefined,
					technicianBranchId: technicianBranchId ?? wo.assignedTechnicianBranchId,
					previousStatus,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to schedule work order' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						status: workflowResult.status!,
						scheduledStart: start.toISOString()
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
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				actualCost: z.number().min(0).optional(),
				actualHours: z.number().min(0).optional(),
				resolutionNotes: z.string().max(2000).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.id, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			if (wo.status !== 'IN_PROGRESS') {
				throw errors.BAD_REQUEST({ message: 'Work order must be in progress to complete' });
			}

			const now = new Date();
			const slaMet = wo.slaDeadline ? now <= wo.slaDeadline : null;

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'COMPLETE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.id,
					actualCost: input.actualCost,
					actualHours: input.actualHours,
					resolutionNotes: input.resolutionNotes,
					slaMet,
					assetId: wo.assetId,
					category: wo.category,
					title: wo.title,
					vendorId: wo.assignedVendorId ?? undefined
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to complete work order' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						status: workflowResult.status!,
						completedAt: workflowResult.completedAt!,
						slaMet: workflowResult.slaMet ?? null
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
				idempotencyKey: z.string().uuid(),
				workOrderId: z.string(),
				rationale: z.string().min(1).max(2000),
				budgetSource: fundTypeEnum,
				approvedAmount: z.number().min(0),
				constraints: z.string().max(2000).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('authorize', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			// Must be in TRIAGED status to authorize
			if (wo.status !== 'TRIAGED') {
				throw errors.BAD_REQUEST({ message: 'Work order must be triaged before authorization' });
			}

			// Phase 9: Validate required artifacts before authorization
			const missingArtifacts: string[] = [];
			if (!wo.originType) missingArtifacts.push('Origin type');
			if (!wo.unitId && !wo.commonAreaName && !wo.assetId) {
				missingArtifacts.push('Asset/location');
			}
			if (!wo.description) missingArtifacts.push('Scope description');

			if (missingArtifacts.length > 0) {
				throw errors.BAD_REQUEST({
					message: `Cannot authorize: missing required artifacts: ${missingArtifacts.join(', ')}`
				});
			}

			// Check if board approval is required based on threshold
			const settings = association.settings as Record<string, unknown> | null;
			const threshold = (settings?.workOrder as Record<string, unknown>)?.boardApprovalThreshold as number | undefined;
			const requiresBoardApproval = threshold !== undefined && input.approvedAmount > threshold;

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'AUTHORIZE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.workOrderId,
					rationale: input.rationale,
					budgetSource: input.budgetSource,
					approvedAmount: input.approvedAmount,
					constraints: input.constraints,
					requiresBoardApproval,
					authorizingRole: 'MANAGER'
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to authorize work order' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						status: workflowResult.status!,
						authorizedAt: workflowResult.authorizedAt ?? new Date().toISOString(),
						requiresBoardApproval: (workflowResult.requiresBoardApproval as boolean) ?? false
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
				idempotencyKey: z.string().uuid(),
				workOrderId: z.string(),
				outcomeSummary: z.string().min(1).max(2000),
				actualCost: z.number().min(0).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('accept', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			// Must be in COMPLETED or REVIEW_REQUIRED status
			if (wo.status !== 'COMPLETED' && wo.status !== 'REVIEW_REQUIRED') {
				throw errors.BAD_REQUEST({ message: 'Work order must be completed before accepting' });
			}

			const previousStatus = wo.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'ACCEPT_COMPLETION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.workOrderId,
					resolutionNotes: input.outcomeSummary,
					actualCost: input.actualCost ?? wo.actualCost?.toNumber(),
					previousStatus
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to accept completion' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						status: workflowResult.status!,
						closedAt: workflowResult.closedAt!
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
				idempotencyKey: z.string().uuid(),
				workOrderId: z.string(),
				meetingId: z.string(),
				question: z.string().max(500).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('request_board_approval', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			if (!wo.requiresBoardApproval) {
				throw errors.BAD_REQUEST({ message: 'Work order does not require board approval' });
			}

			if (wo.boardApprovalVoteId) {
				throw errors.BAD_REQUEST({ message: 'Board approval vote already exists for this work order' });
			}

			// Validate meeting exists and belongs to association
			const meeting = await prisma.meeting.findFirst({
				where: { id: input.meetingId, association: { organizationId: context.organization.id } },
				include: { board: true }
			});

			if (!meeting || !meeting.board || meeting.board.associationId !== association.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}

			const question = input.question ??
				`Approve work order ${wo.workOrderNumber}: ${wo.title} (Budget: $${wo.approvedAmount?.toString() ?? 'TBD'})`;

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'REQUEST_BOARD_APPROVAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.workOrderId,
					workOrderNumber: wo.workOrderNumber,
					meetingId: input.meetingId,
					voteQuestion: question
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to request board approval' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						boardApprovalVoteId: workflowResult.voteId!,
						boardApprovalStatus: workflowResult.boardApprovalStatus!
					},
					vote: {
						id: workflowResult.voteId!,
						question
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
                idempotencyKey: z.string().uuid(),
                workOrderId: z.string(),
				approved: z.boolean(),
				rationale: z.string().min(1).max(2000)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('record_board_decision', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			if (!wo.requiresBoardApproval) {
				throw errors.BAD_REQUEST({ message: 'Work order does not require board approval' });
			}

			if (wo.boardApprovalStatus !== 'PENDING') {
				throw errors.BAD_REQUEST({ message: 'Board decision has already been recorded' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'RECORD_BOARD_DECISION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.workOrderId,
					approved: input.approved,
					rationale: input.rationale,
					boardApprovalVoteId: wo.boardApprovalVoteId,
					previousStatus: wo.status
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to record board decision' });
			}

			return successResponse(
				{
					workOrder: {
						id: workflowResult.workOrderId!,
						status: workflowResult.status!,
						boardApprovalStatus: workflowResult.boardApprovalStatus!,
						authorizedAt: workflowResult.authorizedAt ?? null
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
				idempotencyKey: z.string().uuid(),
				workOrderId: z.string(),
				comment: z.string().min(1).max(2000),
				isInternal: z.boolean().default(false)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'ADD_COMMENT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.workOrderId,
					comment: input.comment,
					isInternal: input.isInternal
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to add comment' });
			}

			return successResponse(
				{
					comment: {
						id: workflowResult.commentId!,
						comment: input.comment,
						createdAt: new Date().toISOString()
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
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
                idempotencyKey: z.string().uuid(),
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			CONFLICT: { message: 'Resource conflict' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id },
				include: { assignedVendor: true }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			if (!wo.assignedVendorId || !wo.assignedVendor) {
				throw errors.BAD_REQUEST({ message: 'Work order must have an assigned vendor' });
			}

			if (wo.status !== 'COMPLETED') {
				throw errors.BAD_REQUEST({ message: 'Work order must be completed before creating invoice' });
			}

			if (wo.invoiceId) {
				throw errors.CONFLICT({ message: 'Invoice already created for this work order' });
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
				throw errors.NOT_FOUND({ message: 'GL Expense Account' });
			}

			const subtotal = input.laborAmount + input.materialsAmount;
			const totalAmount = subtotal + input.taxAmount;

			// Use DBOS workflow for durable execution
			const workflowResult = await startWorkOrderMutationWorkflow(
				{
					action: 'CREATE_INVOICE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					workOrderId: input.workOrderId,
					workOrderNumber: wo.workOrderNumber,
					title: wo.title,
					vendorId: wo.assignedVendorId!,
					invoiceNumber: input.invoiceNumber,
					invoiceDate: new Date(input.invoiceDate),
					dueDate: new Date(input.dueDate),
					laborAmount: input.laborAmount,
					materialsAmount: input.materialsAmount,
					taxAmount: input.taxAmount,
					invoiceDescription: input.description,
					glAccountId: input.glAccountId
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to create invoice' });
			}

			return successResponse(
				{
					invoice: {
						id: workflowResult.invoiceId!,
						invoiceNumber: input.invoiceNumber,
						totalAmount: totalAmount.toString(),
						status: 'PENDING_APPROVAL'
					},
					workOrder: {
						id: workflowResult.workOrderId!,
						status: workflowResult.status!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			// Verify work order exists and belongs to org
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});

			if (!wo) {
				throw errors.NOT_FOUND({ message: 'Work Order' });
			}

			// Start the durable workflow
			const { workflowId } = await startWorkOrderTransition({
				workOrderId: input.workOrderId,
				toStatus: input.toStatus as WorkOrderStatus,
				userId: context.user!.id,
				organizationId: context.organization!.id,
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					status: z.object({ step: z.string() }).passthrough().nullable(),
					error: z.object({ error: z.string() }).passthrough().nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'work_order', input.workflowId);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});
			if (!wo) throw errors.NOT_FOUND({ message: 'Work Order' });

			// Validate pricebook version if provided
			if (input.pricebookVersionId) {
				const version = await prisma.pricebookVersion.findFirst({
					where: { id: input.pricebookVersionId, pricebook: { organizationId: context.organization.id }, status: { in: ['ACTIVE', 'PUBLISHED'] } },
					include: { pricebook: true }
				});
				if (!version) throw errors.NOT_FOUND({ message: 'PricebookVersion' });
			}

			// Validate job template if provided
			if (input.jobTemplateId) {
				const template = await prisma.jobTemplate.findFirst({
					where: { id: input.jobTemplateId, organizationId: context.organization.id, isActive: true }
				});
				if (!template) throw errors.NOT_FOUND({ message: 'JobTemplate' });
			}

			// Use DBOS workflow for durable execution
			const result = await startWorkOrderConfigWorkflow(
				{
					action: 'SET_PRICEBOOK_OR_TEMPLATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					workOrderId: input.workOrderId,
					data: {
						pricebookVersionId: input.pricebookVersionId,
						jobTemplateId: input.jobTemplateId
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to set pricebook/template' });
			}

			const updatedWO = await prisma.workOrder.findFirstOrThrow({ where: { id: result.entityId, organizationId: context.organization.id } });

			return successResponse(
				{
					workOrder: {
						id: updatedWO.id,
						pricebookVersionId: updatedWO.pricebookVersionId,
						jobTemplateId: updatedWO.jobTemplateId
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});
			if (!wo) throw errors.NOT_FOUND({ message: 'Work Order' });

			// Use DBOS workflow for durable execution with idempotencyKey as workflowID
			const result = await startAddLineItemWorkflow(
				{
					organizationId: context.organization!.id,
					userId: context.user!.id,
					workOrderId: input.workOrderId,
					pricebookItemId: input.pricebookItemId,
					quantity: input.quantity,
					unitPrice: input.unitPrice,
					notes: input.notes,
					itemCode: input.itemCode,
					itemName: input.itemName,
					itemType: input.itemType,
					unitOfMeasure: input.unitOfMeasure,
					trade: input.trade
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add line item' });
			}

			// Fetch the created line item for the response
			const lineItem = await prisma.workOrderLineItem.findFirstOrThrow({
				where: { id: result.lineItemId, workOrder: { organizationId: context.organization.id } }
			});

			return successResponse(
				{
					lineItem: {
						id: lineItem.id,
						lineNumber: lineItem.lineNumber,
						itemName: lineItem.itemName,
						quantity: lineItem.quantity.toString(),
						unitPrice: lineItem.unitPrice.toString(),
						total: lineItem.total.toString()
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});
			if (!wo) throw errors.NOT_FOUND({ message: 'Work Order' });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
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
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});
			if (!wo) throw errors.NOT_FOUND({ message: 'Work Order' });

			const lineItem = await prisma.workOrderLineItem.findFirst({
				where: { id: input.lineItemId, workOrderId: input.workOrderId }
			});
			if (!lineItem) throw errors.NOT_FOUND({ message: 'LineItem' });

			// Use DBOS workflow for durable execution with idempotencyKey as workflowID
			const result = await startRemoveLineItemWorkflow(
				{
					organizationId: context.organization!.id,
					userId: context.user!.id,
					workOrderId: input.workOrderId,
					lineItemId: input.lineItemId
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to remove line item' });
			}

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const wo = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});
			if (!wo) throw errors.NOT_FOUND({ message: 'Work Order' });

			const template = await prisma.jobTemplate.findFirst({
				where: { id: input.jobTemplateId, organizationId: context.organization.id, isActive: true },
				include: { items: { include: { pricebookItem: true } } }
			});
			if (!template) throw errors.NOT_FOUND({ message: 'JobTemplate' });

			// Use DBOS workflow for durable execution
			const result = await startWorkOrderConfigWorkflow(
				{
					action: 'APPLY_JOB_TEMPLATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					workOrderId: input.workOrderId,
					data: {
						jobTemplateId: input.jobTemplateId,
						clearExisting: input.clearExisting
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to apply job template' });
			}

			const updatedWO = await prisma.workOrder.findFirstOrThrow({ where: { id: result.entityId, organizationId: context.organization.id } });

			return successResponse(
				{
					addedCount: result.addedCount ?? 0,
					workOrder: {
						id: updatedWO.id,
						jobTemplateId: updatedWO.jobTemplateId!
					}
				},
				context
			);
		})
};
