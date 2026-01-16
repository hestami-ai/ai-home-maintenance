/**
 * Work Order Mutation Workflow (v1)
 *
 * DBOS durable workflow for work order mutations that were previously using
 * direct Prisma transactions. Provides exactly-once execution guarantees.
 *
 * Actions: CREATE, UPDATE_STATUS, ASSIGN_VENDOR, ASSIGN_TECHNICIAN, SCHEDULE,
 * COMPLETE, AUTHORIZE, ACCEPT_COMPLETION, REQUEST_BOARD_APPROVAL,
 * RECORD_BOARD_DECISION, ADD_COMMENT, CREATE_INVOICE
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { Prisma, WorkOrderStatus, FundType } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'work_order_mutation_workflow_status';
const WORKFLOW_ERROR_EVENT = 'work_order_mutation_workflow_error';

export const WorkOrderMutationAction = {
	CREATE: 'CREATE',
	UPDATE_STATUS: 'UPDATE_STATUS',
	ASSIGN_VENDOR: 'ASSIGN_VENDOR',
	ASSIGN_TECHNICIAN: 'ASSIGN_TECHNICIAN',
	SCHEDULE: 'SCHEDULE',
	COMPLETE: 'COMPLETE',
	AUTHORIZE: 'AUTHORIZE',
	ACCEPT_COMPLETION: 'ACCEPT_COMPLETION',
	REQUEST_BOARD_APPROVAL: 'REQUEST_BOARD_APPROVAL',
	RECORD_BOARD_DECISION: 'RECORD_BOARD_DECISION',
	ADD_COMMENT: 'ADD_COMMENT',
	CREATE_INVOICE: 'CREATE_INVOICE'
} as const;

export type WorkOrderMutationAction = (typeof WorkOrderMutationAction)[keyof typeof WorkOrderMutationAction];

export interface WorkOrderMutationInput {
	action: WorkOrderMutationAction;
	organizationId: string;
	userId: string;
	associationId: string;

	// CREATE fields
	workOrderNumber?: string;
	title?: string;
	description?: string;
	category?: string;
	priority?: string;
	unitId?: string | null;
	commonAreaName?: string | null;
	assetId?: string | null;
	locationDetails?: string | null;
	scheduledStart?: Date | null;
	scheduledEnd?: Date | null;
	estimatedCost?: number | null;
	estimatedHours?: number | null;
	slaDeadline?: Date | null;
	originType?: string | null;
	violationId?: string | null;
	arcRequestId?: string | null;
	resolutionId?: string | null;
	originNotes?: string | null;
	budgetSource?: FundType | null;
	approvedAmount?: number | null;
	constraints?: string | null;

	// UPDATE_STATUS / ASSIGN_* / SCHEDULE / etc.
	workOrderId?: string;
	previousStatus?: WorkOrderStatus;
	newStatus?: WorkOrderStatus;
	notes?: string | null;

	// ASSIGN_VENDOR
	vendorId?: string;
	vendorName?: string;

	// ASSIGN_TECHNICIAN
	technicianId?: string;
	technicianBranchId?: string | null;
	technicianName?: string;

	// COMPLETE
	actualCost?: number | null;
	actualHours?: number | null;
	resolutionNotes?: string | null;
	slaMet?: boolean | null;

	// AUTHORIZE
	rationale?: string;
	authorizingRole?: string;
	requiresBoardApproval?: boolean;

	// REQUEST_BOARD_APPROVAL
	meetingId?: string;
	voteQuestion?: string;

	// RECORD_BOARD_DECISION
	approved?: boolean;
	boardApprovalVoteId?: string | null;

	// CREATE_INVOICE
	invoiceNumber?: string;
	invoiceDate?: Date;
	dueDate?: Date;
	laborAmount?: number;
	materialsAmount?: number;
	taxAmount?: number;
	invoiceDescription?: string;
	glAccountId?: string;

	// ADD_COMMENT
	comment?: string;
	isInternal?: boolean;
}

export interface WorkOrderMutationResult extends EntityWorkflowResult {
	workOrderId?: string;
	workOrderNumber?: string;
	status?: string;
	previousStatus?: string;
	voteId?: string;
	invoiceId?: string;
	commentId?: string;
	authorizedAt?: string | null;
	completedAt?: string | null;
	closedAt?: string | null;
	slaMet?: boolean | null;
	boardApprovalStatus?: string | null;
	[key: string]: unknown;
}

// Step functions

async function createWorkOrder(
	input: WorkOrderMutationInput
): Promise<{ id: string; workOrderNumber: string; title: string; status: string; priority: string }> {
	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			const wo = await tx.workOrder.create({
				data: {
					organizationId: input.organizationId,
					associationId: input.associationId,
					workOrderNumber: input.workOrderNumber!,
					title: input.title!,
					description: input.description!,
					category: input.category! as Prisma.WorkOrderCreateInput['category'],
					priority: input.priority! as Prisma.WorkOrderCreateInput['priority'],
					status: 'DRAFT',
					unitId: input.unitId,
					commonAreaName: input.commonAreaName,
					assetId: input.assetId,
					locationDetails: input.locationDetails,
					requestedBy: input.userId,
					scheduledStart: input.scheduledStart,
					scheduledEnd: input.scheduledEnd,
					estimatedCost: input.estimatedCost,
					estimatedHours: input.estimatedHours,
					slaDeadline: input.slaDeadline,
					originType: input.originType as Prisma.WorkOrderCreateInput['originType'],
					violationId: input.violationId,
					arcRequestId: input.arcRequestId,
					resolutionId: input.resolutionId,
					originNotes: input.originNotes,
					budgetSource: input.budgetSource,
					approvedAmount: input.approvedAmount,
					constraints: input.constraints
				}
			});

			await tx.workOrderStatusHistory.create({
				data: {
					workOrderId: wo.id,
					fromStatus: null,
					toStatus: 'DRAFT',
					changedBy: input.userId,
					notes: 'Work order created'
				}
			});

			return wo;
		},
		{ userId: input.userId, reason: 'Create work order' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Work order created: ${result.title}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'CREATE',
		workflowVersion: 'v1',
		newState: {
			workOrderNumber: result.workOrderNumber,
			title: result.title,
			status: result.status,
			priority: result.priority
		}
	});

	return {
		id: result.id,
		workOrderNumber: result.workOrderNumber,
		title: result.title,
		status: result.status,
		priority: result.priority
	};
}

async function updateWorkOrderStatus(
	input: WorkOrderMutationInput
): Promise<{ id: string; status: string; previousStatus: string }> {
	const now = new Date();
	const updateData: Prisma.WorkOrderUpdateInput = {
		status: input.newStatus
	};

	if (input.newStatus === 'IN_PROGRESS') {
		updateData.startedAt = now;
	}
	if (input.newStatus === 'COMPLETED') {
		updateData.completedAt = now;
		if (input.slaMet !== undefined) {
			updateData.slaMet = input.slaMet;
		}
	}
	if (input.newStatus === 'CLOSED') {
		updateData.closedAt = now;
		updateData.closedBy = input.userId;
	}

	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			const wo = await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: updateData
			});

			await tx.workOrderStatusHistory.create({
				data: {
					workOrderId: input.workOrderId!,
					fromStatus: input.previousStatus!,
					toStatus: input.newStatus!,
					changedBy: input.userId,
					notes: input.notes
				}
			});

			return wo;
		},
		{ userId: input.userId, reason: 'Update work order status' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.id,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Work order status changed from ${input.previousStatus} to ${input.newStatus}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'UPDATE_STATUS',
		workflowVersion: 'v1',
		previousState: { status: input.previousStatus },
		newState: { status: result.status }
	});

	return {
		id: result.id,
		status: result.status,
		previousStatus: input.previousStatus!
	};
}

async function assignVendorToWorkOrder(
	input: WorkOrderMutationInput
): Promise<{ id: string; status: string; assignedVendorId: string }> {
	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			const wo = await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: {
					assignedVendorId: input.vendorId,
					assignedAt: new Date(),
					assignedBy: input.userId,
					status: 'ASSIGNED'
				}
			});

			if (input.previousStatus !== 'ASSIGNED') {
				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: input.workOrderId!,
						fromStatus: input.previousStatus!,
						toStatus: 'ASSIGNED',
						changedBy: input.userId,
						notes: input.notes || `Assigned to vendor: ${input.vendorName}`
					}
				});
			}

			return wo;
		},
		{ userId: input.userId, reason: 'Assign vendor to work order' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.id,
		action: 'ASSIGN',
		eventCategory: 'EXECUTION',
		summary: `Vendor assigned to work order: ${input.vendorName}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'ASSIGN_VENDOR',
		workflowVersion: 'v1',
		newState: { assignedVendorId: input.vendorId, status: result.status }
	});

	return {
		id: result.id,
		status: result.status,
		assignedVendorId: result.assignedVendorId!
	};
}

async function assignTechnicianToWorkOrder(
	input: WorkOrderMutationInput
): Promise<{ id: string; status: string; assignedTechnicianId: string }> {
	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			const newStatus = input.previousStatus === 'TRIAGED' ? 'ASSIGNED' : input.previousStatus!;
			const wo = await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: {
					assignedTechnicianId: input.technicianId,
					assignedTechnicianBranchId: input.technicianBranchId,
					status: newStatus
				}
			});

			if (input.previousStatus === 'TRIAGED') {
				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: input.workOrderId!,
						fromStatus: input.previousStatus!,
						toStatus: 'ASSIGNED',
						changedBy: input.userId,
						notes: input.notes || `Assigned to technician: ${input.technicianName}`
					}
				});
			}

			return wo;
		},
		{ userId: input.userId, reason: 'Assign technician to work order' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.id,
		action: 'ASSIGN',
		eventCategory: 'EXECUTION',
		summary: `Technician assigned to work order: ${input.technicianName}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'ASSIGN_TECHNICIAN',
		workflowVersion: 'v1',
		newState: { assignedTechnicianId: input.technicianId, status: result.status }
	});

	return {
		id: result.id,
		status: result.status,
		assignedTechnicianId: result.assignedTechnicianId!
	};
}

async function scheduleWorkOrder(
	input: WorkOrderMutationInput
): Promise<{ id: string; status: string; scheduledStart: string }> {
	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			const wo = await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: {
					scheduledStart: input.scheduledStart,
					scheduledEnd: input.scheduledEnd,
					assignedTechnicianId: input.technicianId,
					assignedTechnicianBranchId: input.technicianBranchId,
					status: 'SCHEDULED'
				}
			});

			if (input.previousStatus !== 'SCHEDULED') {
				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: input.workOrderId!,
						fromStatus: input.previousStatus!,
						toStatus: 'SCHEDULED',
						changedBy: input.userId,
						notes: input.notes || `Scheduled for ${input.scheduledStart?.toISOString()}`
					}
				});
			}

			return wo;
		},
		{ userId: input.userId, reason: 'Schedule work order' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.id,
		action: 'SCHEDULE',
		eventCategory: 'EXECUTION',
		summary: `Work order scheduled for ${input.scheduledStart?.toISOString()}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'SCHEDULE',
		workflowVersion: 'v1',
		newState: { scheduledStart: input.scheduledStart?.toISOString(), status: result.status }
	});

	return {
		id: result.id,
		status: result.status,
		scheduledStart: result.scheduledStart!.toISOString()
	};
}

async function completeWorkOrder(
	input: WorkOrderMutationInput
): Promise<{ id: string; status: string; completedAt: string; slaMet: boolean | null }> {
	const now = new Date();

	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			const wo = await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: {
					status: 'COMPLETED',
					completedAt: now,
					actualCost: input.actualCost,
					actualHours: input.actualHours,
					resolutionNotes: input.resolutionNotes,
					slaMet: input.slaMet
				}
			});

			await tx.workOrderStatusHistory.create({
				data: {
					workOrderId: input.workOrderId!,
					fromStatus: 'IN_PROGRESS',
					toStatus: 'COMPLETED',
					changedBy: input.userId,
					notes: input.resolutionNotes || 'Work completed'
				}
			});

			// If there's an asset, log maintenance
			if (input.assetId) {
				await tx.assetMaintenanceLog.create({
					data: {
						assetId: input.assetId,
						maintenanceDate: now,
						maintenanceType: input.category || 'GENERAL',
						description: input.title || 'Work order completion',
						performedBy: input.vendorId ? 'Vendor' : 'Internal',
						cost: input.actualCost,
						workOrderId: input.workOrderId!,
						notes: input.resolutionNotes,
						createdBy: input.userId
					}
				});

				// Update asset maintenance dates
				const asset = await tx.asset.findUnique({ where: { id: input.assetId } });
				if (asset) {
					await tx.asset.update({
						where: { id: input.assetId },
						data: {
							lastMaintenanceDate: now,
							nextMaintenanceDate: asset.maintenanceFrequencyDays
								? new Date(now.getTime() + asset.maintenanceFrequencyDays * 24 * 60 * 60 * 1000)
								: null
						}
					});
				}
			}

			return wo;
		},
		{ userId: input.userId, reason: 'Complete work order' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.id,
		action: 'COMPLETE',
		eventCategory: 'EXECUTION',
		summary: `Work order completed${input.slaMet ? ' (SLA met)' : input.slaMet === false ? ' (SLA missed)' : ''}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'COMPLETE',
		workflowVersion: 'v1',
		newState: {
			status: result.status,
			completedAt: result.completedAt?.toISOString(),
			actualCost: result.actualCost?.toString(),
			slaMet: result.slaMet
		}
	});

	return {
		id: result.id,
		status: result.status,
		completedAt: result.completedAt!.toISOString(),
		slaMet: result.slaMet
	};
}

async function authorizeWorkOrder(
	input: WorkOrderMutationInput
): Promise<{ id: string; status: string; authorizedAt: string | null; requiresBoardApproval: boolean }> {
	const now = new Date();
	const requiresBoardApproval = input.requiresBoardApproval ?? false;

	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			const wo = await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: {
					status: requiresBoardApproval ? 'TRIAGED' : 'AUTHORIZED',
					authorizedBy: requiresBoardApproval ? null : input.userId,
					authorizedAt: requiresBoardApproval ? null : now,
					authorizationRationale: input.rationale,
					authorizingRole: requiresBoardApproval ? null : (input.authorizingRole || 'MANAGER'),
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
						workOrderId: input.workOrderId!,
						fromStatus: 'TRIAGED',
						toStatus: 'AUTHORIZED',
						changedBy: input.userId,
						notes: `Authorized by manager: ${input.rationale}`
					}
				});
			}

			return wo;
		},
		{ userId: input.userId, reason: 'Authorize work order' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.id,
		action: requiresBoardApproval ? 'UPDATE' : 'APPROVE',
		eventCategory: 'EXECUTION',
		summary: requiresBoardApproval
			? `Work order requires board approval (amount: ${input.approvedAmount})`
			: `Work order authorized: ${input.rationale}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'AUTHORIZE',
		workflowVersion: 'v1',
		newState: {
			status: result.status,
			budgetSource: result.budgetSource,
			approvedAmount: result.approvedAmount?.toString(),
			requiresBoardApproval: result.requiresBoardApproval,
			authorizingRole: result.authorizingRole
		}
	});

	return {
		id: result.id,
		status: result.status,
		authorizedAt: result.authorizedAt?.toISOString() ?? null,
		requiresBoardApproval: result.requiresBoardApproval
	};
}

async function acceptWorkOrderCompletion(
	input: WorkOrderMutationInput
): Promise<{ id: string; status: string; closedAt: string }> {
	const now = new Date();

	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			const wo = await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: {
					status: 'CLOSED',
					closedAt: now,
					closedBy: input.userId,
					resolutionNotes: input.resolutionNotes,
					actualCost: input.actualCost,
					spendToDate: input.actualCost
				}
			});

			await tx.workOrderStatusHistory.create({
				data: {
					workOrderId: input.workOrderId!,
					fromStatus: input.previousStatus!,
					toStatus: 'CLOSED',
					changedBy: input.userId,
					notes: `Completion accepted: ${input.resolutionNotes}`
				}
			});

			return wo;
		},
		{ userId: input.userId, reason: 'Accept work order completion' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.id,
		action: 'APPROVE',
		eventCategory: 'EXECUTION',
		summary: `Work order completion accepted: ${input.resolutionNotes}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'ACCEPT_COMPLETION',
		workflowVersion: 'v1',
		newState: {
			status: result.status,
			closedAt: result.closedAt?.toISOString(),
			resolutionNotes: result.resolutionNotes
		}
	});

	return {
		id: result.id,
		status: result.status,
		closedAt: result.closedAt!.toISOString()
	};
}

async function requestBoardApprovalForWorkOrder(
	input: WorkOrderMutationInput
): Promise<{ workOrderId: string; voteId: string; boardApprovalStatus: string }> {
	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			// Create vote for board approval
			const vote = await tx.vote.create({
				data: {
					meetingId: input.meetingId!,
					question: input.voteQuestion!,
					method: 'IN_PERSON',
					createdBy: input.userId
				}
			});

			// Link vote to work order
			const wo = await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: {
					boardApprovalVoteId: vote.id,
					boardApprovalStatus: 'PENDING'
				}
			});

			return { vote, workOrder: wo };
		},
		{ userId: input.userId, reason: 'Request board approval for work order' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.workOrder.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Board approval requested for work order ${input.workOrderNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'REQUEST_BOARD_APPROVAL',
		workflowVersion: 'v1',
		newState: {
			boardApprovalVoteId: result.vote.id,
			boardApprovalStatus: 'PENDING'
		}
	});

	return {
		workOrderId: result.workOrder.id,
		voteId: result.vote.id,
		boardApprovalStatus: result.workOrder.boardApprovalStatus!
	};
}

async function recordBoardDecisionForWorkOrder(
	input: WorkOrderMutationInput
): Promise<{ id: string; status: string; boardApprovalStatus: string; authorizedAt: string | null }> {
	const now = new Date();
	const newStatus = input.approved ? 'AUTHORIZED' : 'CANCELLED';
	const boardApprovalStatus = input.approved ? 'APPROVED' : 'DENIED';

	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			// Close the vote if it exists
			if (input.boardApprovalVoteId) {
				await tx.vote.update({
					where: { id: input.boardApprovalVoteId },
					data: { closedAt: now }
				});
			}

			const wo = await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: {
					status: newStatus,
					boardApprovalStatus,
					authorizedBy: input.approved ? input.userId : null,
					authorizedAt: input.approved ? now : null,
					authorizingRole: input.approved ? 'BOARD' : null,
					authorizationRationale: input.rationale
				}
			});

			await tx.workOrderStatusHistory.create({
				data: {
					workOrderId: input.workOrderId!,
					fromStatus: input.previousStatus!,
					toStatus: newStatus,
					changedBy: input.userId,
					notes: input.approved
						? `Board approved: ${input.rationale}`
						: `Board denied: ${input.rationale}`
				}
			});

			return wo;
		},
		{ userId: input.userId, reason: 'Record board decision for work order' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: result.id,
		action: input.approved ? 'APPROVE' : 'DENY',
		eventCategory: 'EXECUTION',
		summary: input.approved
			? `Board approved work order: ${input.rationale}`
			: `Board denied work order: ${input.rationale}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'RECORD_BOARD_DECISION',
		workflowVersion: 'v1',
		newState: {
			status: result.status,
			boardApprovalStatus: result.boardApprovalStatus,
			authorizingRole: result.authorizingRole
		}
	});

	return {
		id: result.id,
		status: result.status,
		boardApprovalStatus: result.boardApprovalStatus!,
		authorizedAt: result.authorizedAt?.toISOString() ?? null
	};
}

async function addWorkOrderComment(
	input: WorkOrderMutationInput
): Promise<{ id: string; comment: string; createdAt: string }> {
	const commentRecord = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.workOrderComment.create({
				data: {
					workOrderId: input.workOrderId!,
					comment: input.comment!,
					isInternal: input.isInternal ?? false,
					authorId: input.userId
				}
			});
		},
		{ userId: input.userId, reason: 'Add work order comment' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: input.workOrderId!,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Comment added to work order`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'ADD_COMMENT',
		workflowVersion: 'v1',
		newState: { commentId: commentRecord.id, isInternal: commentRecord.isInternal }
	});

	return {
		id: commentRecord.id,
		comment: commentRecord.comment,
		createdAt: commentRecord.createdAt.toISOString()
	};
}

async function createWorkOrderInvoice(
	input: WorkOrderMutationInput
): Promise<{ invoiceId: string; workOrderId: string; invoiceNumber: string; totalAmount: string; status: string; workOrderStatus: string }> {
	const subtotal = (input.laborAmount ?? 0) + (input.materialsAmount ?? 0);
	const totalAmount = subtotal + (input.taxAmount ?? 0);

	const result = await orgTransaction(
		input.organizationId,
		async (tx) => {
			// Create AP Invoice with line items
			const lineItems: Prisma.APInvoiceLineCreateWithoutInvoiceInput[] = [];

			if ((input.laborAmount ?? 0) > 0) {
				lineItems.push({
					description: 'Labor',
					quantity: 1,
					unitPrice: input.laborAmount!,
					amount: input.laborAmount!,
					glAccountId: input.glAccountId!,
					lineNumber: 1
				});
			}

			if ((input.materialsAmount ?? 0) > 0) {
				lineItems.push({
					description: 'Materials',
					quantity: 1,
					unitPrice: input.materialsAmount!,
					amount: input.materialsAmount!,
					glAccountId: input.glAccountId!,
					lineNumber: 2
				});
			}

			const invoice = await tx.aPInvoice.create({
				data: {
					associationId: input.associationId,
					vendorId: input.vendorId!,
					invoiceNumber: input.invoiceNumber!,
					invoiceDate: input.invoiceDate!,
					dueDate: input.dueDate!,
					subtotal,
					taxAmount: input.taxAmount ?? 0,
					totalAmount,
					balanceDue: totalAmount,
					status: 'PENDING_APPROVAL',
					description: input.invoiceDescription || `Work Order ${input.workOrderNumber}: ${input.title}`,
					workOrderId: input.workOrderId,
					lineItems: {
						create: lineItems
					}
				}
			});

			// Update work order with invoice reference and status
			const wo = await tx.workOrder.update({
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
					workOrderId: input.workOrderId!,
					fromStatus: 'COMPLETED',
					toStatus: 'INVOICED',
					changedBy: input.userId,
					notes: `Invoice ${input.invoiceNumber} created`
				}
			});

			return { invoice, workOrder: wo };
		},
		{ userId: input.userId, reason: 'Create work order invoice' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: input.workOrderId!,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Invoice ${input.invoiceNumber} created for work order`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderMutationWorkflow_v1',
		workflowStep: 'CREATE_INVOICE',
		workflowVersion: 'v1',
		newState: {
			invoiceId: result.invoice.id,
			invoiceNumber: result.invoice.invoiceNumber,
			status: result.workOrder.status
		}
	});

	return {
		invoiceId: result.invoice.id,
		workOrderId: result.workOrder.id,
		invoiceNumber: result.invoice.invoiceNumber,
		totalAmount: result.invoice.totalAmount.toString(),
		status: result.invoice.status,
		workOrderStatus: result.workOrder.status
	};
}

// Main workflow function

async function workOrderMutationWorkflow(input: WorkOrderMutationInput): Promise<WorkOrderMutationResult> {
	const workflowName = 'workOrderMutationWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		workOrderId: input.workOrderId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.workOrderNumber || !input.title || !input.description) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createWorkOrder starting', { title: input.title });
				const result = await DBOS.runStep(
					() => createWorkOrder(input),
					{ name: 'createWorkOrder' }
				);
				log.info('Step: createWorkOrder completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'work_order_created', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					workOrderId: result.id,
					workOrderNumber: result.workOrderNumber,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE_STATUS': {
				if (!input.workOrderId || !input.newStatus || !input.previousStatus) {
					const error = new Error('Missing required fields for UPDATE_STATUS');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: updateWorkOrderStatus starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => updateWorkOrderStatus(input),
					{ name: 'updateWorkOrderStatus' }
				);
				log.info('Step: updateWorkOrderStatus completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'status_updated', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					workOrderId: result.id,
					status: result.status,
					previousStatus: result.previousStatus
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ASSIGN_VENDOR': {
				if (!input.workOrderId || !input.vendorId) {
					const error = new Error('Missing required fields for ASSIGN_VENDOR');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: assignVendorToWorkOrder starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => assignVendorToWorkOrder(input),
					{ name: 'assignVendorToWorkOrder' }
				);
				log.info('Step: assignVendorToWorkOrder completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'vendor_assigned', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					workOrderId: result.id,
					status: result.status,
					assignedVendorId: result.assignedVendorId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ASSIGN_TECHNICIAN': {
				if (!input.workOrderId || !input.technicianId) {
					const error = new Error('Missing required fields for ASSIGN_TECHNICIAN');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: assignTechnicianToWorkOrder starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => assignTechnicianToWorkOrder(input),
					{ name: 'assignTechnicianToWorkOrder' }
				);
				log.info('Step: assignTechnicianToWorkOrder completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'technician_assigned', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					workOrderId: result.id,
					status: result.status,
					assignedTechnicianId: result.assignedTechnicianId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'SCHEDULE': {
				if (!input.workOrderId || !input.scheduledStart) {
					const error = new Error('Missing required fields for SCHEDULE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: scheduleWorkOrder starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => scheduleWorkOrder(input),
					{ name: 'scheduleWorkOrder' }
				);
				log.info('Step: scheduleWorkOrder completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'scheduled', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					workOrderId: result.id,
					status: result.status,
					scheduledStart: result.scheduledStart
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'COMPLETE': {
				if (!input.workOrderId) {
					const error = new Error('Missing required fields for COMPLETE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: completeWorkOrder starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => completeWorkOrder(input),
					{ name: 'completeWorkOrder' }
				);
				log.info('Step: completeWorkOrder completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					workOrderId: result.id,
					status: result.status,
					completedAt: result.completedAt,
					slaMet: result.slaMet
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'AUTHORIZE': {
				if (!input.workOrderId || !input.rationale) {
					const error = new Error('Missing required fields for AUTHORIZE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: authorizeWorkOrder starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => authorizeWorkOrder(input),
					{ name: 'authorizeWorkOrder' }
				);
				log.info('Step: authorizeWorkOrder completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'authorized', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					workOrderId: result.id,
					status: result.status,
					authorizedAt: result.authorizedAt,
					requiresBoardApproval: result.requiresBoardApproval
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ACCEPT_COMPLETION': {
				if (!input.workOrderId || !input.resolutionNotes) {
					const error = new Error('Missing required fields for ACCEPT_COMPLETION');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: acceptWorkOrderCompletion starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => acceptWorkOrderCompletion(input),
					{ name: 'acceptWorkOrderCompletion' }
				);
				log.info('Step: acceptWorkOrderCompletion completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completion_accepted', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					workOrderId: result.id,
					status: result.status,
					closedAt: result.closedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'REQUEST_BOARD_APPROVAL': {
				if (!input.workOrderId || !input.meetingId || !input.voteQuestion) {
					const error = new Error('Missing required fields for REQUEST_BOARD_APPROVAL');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: requestBoardApprovalForWorkOrder starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => requestBoardApprovalForWorkOrder(input),
					{ name: 'requestBoardApprovalForWorkOrder' }
				);
				log.info('Step: requestBoardApprovalForWorkOrder completed', { workOrderId: result.workOrderId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'board_approval_requested', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.workOrderId,
					workOrderId: result.workOrderId,
					voteId: result.voteId,
					boardApprovalStatus: result.boardApprovalStatus
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'RECORD_BOARD_DECISION': {
				if (!input.workOrderId || input.approved === undefined || !input.rationale) {
					const error = new Error('Missing required fields for RECORD_BOARD_DECISION');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: recordBoardDecisionForWorkOrder starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => recordBoardDecisionForWorkOrder(input),
					{ name: 'recordBoardDecisionForWorkOrder' }
				);
				log.info('Step: recordBoardDecisionForWorkOrder completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'board_decision_recorded', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					workOrderId: result.id,
					status: result.status,
					boardApprovalStatus: result.boardApprovalStatus,
					authorizedAt: result.authorizedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ADD_COMMENT': {
				if (!input.workOrderId || !input.comment) {
					const error = new Error('Missing required fields for ADD_COMMENT');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: addWorkOrderComment starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => addWorkOrderComment(input),
					{ name: 'addWorkOrderComment' }
				);
				log.info('Step: addWorkOrderComment completed', { commentId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'comment_added', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.id,
					commentId: result.id,
					workOrderId: input.workOrderId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CREATE_INVOICE': {
				if (!input.workOrderId || !input.invoiceNumber || !input.glAccountId) {
					const error = new Error('Missing required fields for CREATE_INVOICE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createWorkOrderInvoice starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => createWorkOrderInvoice(input),
					{ name: 'createWorkOrderInvoice' }
				);
				log.info('Step: createWorkOrderInvoice completed', { invoiceId: result.invoiceId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'invoice_created', ...result });
				const successResult: WorkOrderMutationResult = {
					success: true,
					entityId: result.workOrderId,
					workOrderId: result.workOrderId,
					invoiceId: result.invoiceId,
					invoiceNumber: result.invoiceNumber,
					status: result.workOrderStatus
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: WorkOrderMutationResult = {
					success: false,
					error: `Unknown action: ${input.action}`
				};
				log.warn('Unknown workflow action', { action: input.action });
				logWorkflowEnd(log, input.action, false, startTime, errorResult);
				return errorResult;
			}
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		log.error('Workflow failed', {
			action: input.action,
			workOrderId: input.workOrderId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'WORK_ORDER_MUTATION_WORKFLOW_ERROR'
		});
		const errorResult: WorkOrderMutationResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const workOrderMutationWorkflow_v1 = DBOS.registerWorkflow(workOrderMutationWorkflow);

export async function startWorkOrderMutationWorkflow(
	input: WorkOrderMutationInput,
	idempotencyKey: string
): Promise<WorkOrderMutationResult> {
	const handle = await DBOS.startWorkflow(workOrderMutationWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
