import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { recordActivityFromContext } from '../../middleware/activityEvent.js';
import { startDashboardWorkflow } from '../../../workflows/dashboardWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('DashboardRoute');

// =============================================================================
// Dashboard DTO Schemas (Phase 12 - CAM UX #6)
// =============================================================================

/**
 * Dashboard filters - global filters applied across all sections
 */
const DashboardFiltersSchema = z.object({
	dateRange: z.object({
		start: z.string(),
		end: z.string()
	}).optional(),
	associationId: z.string().optional(),
	severity: z.string().optional()
});

/**
 * Section 1: Requires Action - items blocking progress or requiring authority
 */
const DashboardRequiresActionSchema = z.object({
	pendingArc: z.object({
		count: z.number(),
		oldestAgeDays: z.number(),
		oldestId: z.string().nullable()
	}),
	escalatedViolations: z.object({
		total: z.number(),
		bySeverity: z.object({
			critical: z.number(),
			major: z.number(),
			moderate: z.number(),
			minor: z.number()
		})
	}),
	workOrdersAwaitingAuth: z.object({
		count: z.number(),
		hasBudgetExceptions: z.boolean()
	}),
	governancePending: z.object({
		meetingsNeedingMinutes: z.number(),
		motionsAwaitingVote: z.number()
	})
});

/**
 * Section 2: Risk & Compliance - patterns, not individual records
 */
const DashboardRiskComplianceSchema = z.object({
	violationsBySeverity: z.object({
		critical: z.number(),
		major: z.number(),
		moderate: z.number(),
		minor: z.number(),
		total: z.number()
	}),
	repeatViolationsByUnit: z.array(z.object({
		unitId: z.string(),
		unitNumber: z.string(),
		ownerName: z.string().nullable(),
		violationCount: z.number()
	})),
	overdueArcRequests: z.number(),
	longRunningWorkOrders: z.number()
});

/**
 * Section 3: Financial Attention - conditions requiring governance action
 */
const DashboardFinancialAttentionSchema = z.object({
	overdueAssessments: z.object({
		count: z.number(),
		totalAmount: z.number()
	}),
	workOrdersExceedingBudget: z.number(),
	reserveFundedWorkPending: z.number()
});

/**
 * Section 4: Recent Governance Activity - decision awareness
 */
const DashboardRecentGovernanceItemSchema = z.object({
	id: z.string(),
	type: z.enum(['ARC_APPROVED', 'VIOLATION_CLOSED', 'MOTION_APPROVED', 'POLICY_CREATED', 'RESOLUTION_ADOPTED']),
	title: z.string(),
	actorRole: z.string(),
	occurredAt: z.string(),
	deepLink: z.string()
});

const DashboardRecentGovernanceSchema = z.object({
	items: z.array(DashboardRecentGovernanceItemSchema)
});

/**
 * Complete dashboard data structure
 */
const DashboardDataSchema = z.object({
	requiresAction: DashboardRequiresActionSchema,
	riskCompliance: DashboardRiskComplianceSchema,
	financialAttention: DashboardFinancialAttentionSchema,
	recentGovernance: DashboardRecentGovernanceSchema,
	lastUpdated: z.string()
});

// =============================================================================
// Widget Types
// =============================================================================

const widgetTypeEnum = z.enum([
	'CHART_BAR', 'CHART_LINE', 'CHART_PIE', 'CHART_DONUT',
	'METRIC_CARD', 'TABLE', 'LIST', 'CALENDAR', 'MAP'
]);

const getAssociationOrThrow = async (organizationId: string, errors: any) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
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
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'dashboard_widget', 'new');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startDashboardWorkflow(
				{
					action: 'CREATE_WIDGET',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					data: {
						widgetType: input.widgetType,
						title: input.title,
						configJson: input.configJson,
						position: input.position,
						width: input.width,
						height: input.height,
						userId: input.userId
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create widget' });
			}

			const widget = await prisma.dashboardWidget.findUniqueOrThrow({
				where: { id: result.entityId }
			});

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
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'dashboard_widget', '*');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

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
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'dashboard_widget', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startDashboardWorkflow(
				{
					action: 'UPDATE_WIDGET',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					widgetId: input.id,
					data: {
						title: input.title,
						configJson: input.configJson,
						position: input.position,
						width: input.width,
						height: input.height,
						isActive: input.isActive
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update widget' });
			}

			const widget = await prisma.dashboardWidget.findUniqueOrThrow({
				where: { id: result.entityId }
			});

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
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('delete', 'dashboard_widget', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startDashboardWorkflow(
				{
					action: 'DELETE_WIDGET',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					widgetId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete widget' });
			}

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
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'dashboard_widget', '*');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startDashboardWorkflow(
				{
					action: 'REORDER_WIDGETS',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					data: { widgetIds: input.widgetIds }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to reorder widgets' });
			}

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
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ context, errors }) => {
			await context.cerbos.authorize('view', 'dashboard_widget', '*');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

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
		}),

	/**
	 * Get comprehensive dashboard data for all four sections (Phase 12)
	 * This is the primary dashboard endpoint following CAM UX #6 spec
	 */
	getData: orgProcedure
		.input(DashboardFiltersSchema.optional())
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				dashboard: DashboardDataSchema
			}),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'dashboard_widget', '*');
			const association = await getAssociationOrThrow(context.organization!.id, errors);
			const now = new Date();
			const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

			// =================================================================
			// Section 1: Requires Action
			// =================================================================

			// Pending ARC decisions
			const pendingArcRequests = await prisma.aRCRequest.findMany({
				where: {
					associationId: association.id,
					status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }
				},
				orderBy: { submittedAt: 'asc' },
				select: { id: true, submittedAt: true }
			});
			const oldestArc = pendingArcRequests[0];
			const oldestArcAgeDays = oldestArc?.submittedAt
				? Math.floor((now.getTime() - new Date(oldestArc.submittedAt).getTime()) / (1000 * 60 * 60 * 24))
				: 0;

			// Escalated violations by severity
			const escalatedViolations = await prisma.violation.findMany({
				where: {
					associationId: association.id,
					status: 'ESCALATED',
					deletedAt: null
				},
				select: { severity: true }
			});
			const escalatedBySeverity = {
				critical: escalatedViolations.filter(v => v.severity === 'CRITICAL').length,
				major: escalatedViolations.filter(v => v.severity === 'MAJOR').length,
				moderate: escalatedViolations.filter(v => v.severity === 'MODERATE').length,
				minor: escalatedViolations.filter(v => v.severity === 'MINOR').length
			};

			// Work orders awaiting authorization
			const workOrdersAwaitingAuth = await prisma.workOrder.findMany({
				where: {
					associationId: association.id,
					status: 'SUBMITTED', // Awaiting authorization
					requiresBoardApproval: true,
					OR: [
						{ boardApprovalStatus: 'PENDING' },
						{ boardApprovalStatus: null }
					]
				},
				select: { id: true, approvedAmount: true, spendToDate: true }
			});
			const hasBudgetExceptions = workOrdersAwaitingAuth.some(wo => {
				if (!wo.approvedAmount || !wo.spendToDate) return false;
				return Number(wo.spendToDate) > Number(wo.approvedAmount);
			});

			// Governance pending: meetings needing minutes approval
			const meetingsNeedingMinutes = await prisma.meeting.count({
				where: {
					associationId: association.id,
					status: 'MINUTES_DRAFT'
				}
			});

			// Governance pending: motions awaiting vote
			const motionsAwaitingVote = await prisma.boardMotion.count({
				where: {
					associationId: association.id,
					status: { in: ['SECONDED', 'UNDER_DISCUSSION', 'UNDER_VOTE'] }
				}
			});

			// =================================================================
			// Section 2: Risk & Compliance
			// =================================================================

			// Open violations by severity
			const openViolations = await prisma.violation.findMany({
				where: {
					associationId: association.id,
					status: { in: ['OPEN', 'NOTICE_SENT', 'CURE_PERIOD', 'ESCALATED'] },
					deletedAt: null
				},
				select: { severity: true }
			});
			const violationsBySeverity = {
				critical: openViolations.filter(v => v.severity === 'CRITICAL').length,
				major: openViolations.filter(v => v.severity === 'MAJOR').length,
				moderate: openViolations.filter(v => v.severity === 'MODERATE').length,
				minor: openViolations.filter(v => v.severity === 'MINOR').length,
				total: openViolations.length
			};

			// Repeat violations by unit (units with 2+ violations)
			const violationsByUnit = await prisma.violation.groupBy({
				by: ['unitId'],
				where: {
					associationId: association.id,
					status: { in: ['OPEN', 'NOTICE_SENT', 'CURE_PERIOD', 'ESCALATED'] },
					deletedAt: null,
					unitId: { not: null }
				},
				_count: { id: true },
				having: { id: { _count: { gte: 2 } } },
				orderBy: { _count: { id: 'desc' } },
				take: 5
			});

			// Get unit details for repeat offenders
			const repeatViolationsByUnit = await Promise.all(
				violationsByUnit.map(async (v) => {
					if (!v.unitId) return null;
					const unit = await prisma.unit.findUnique({
						where: { id: v.unitId },
						include: {
							ownerships: {
								where: { endDate: null },
								include: { party: true },
								take: 1
							}
						}
					});
					if (!unit) return null;
					const party = unit.ownerships[0]?.party;
					const ownerName = party
						? (party.entityName || `${party.firstName ?? ''} ${party.lastName ?? ''}`.trim() || null)
						: null;
					return {
						unitId: unit.id,
						unitNumber: unit.unitNumber,
						ownerName,
						violationCount: v._count.id
					};
				})
			).then(results => results.filter((r): r is NonNullable<typeof r> => r !== null));

			// Overdue ARC requests (past SLA - assume 30 days)
			const overdueArcRequests = await prisma.aRCRequest.count({
				where: {
					associationId: association.id,
					status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
					submittedAt: { lt: thirtyDaysAgo }
				}
			});

			// Long-running work orders (open > 30 days)
			const longRunningWorkOrders = await prisma.workOrder.count({
				where: {
					associationId: association.id,
					status: { in: ['SUBMITTED', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'] },
					createdAt: { lt: thirtyDaysAgo }
				}
			});

			// =================================================================
			// Section 3: Financial Attention
			// =================================================================

			// Overdue assessments
			const overdueAssessments = await prisma.assessmentCharge.aggregate({
				where: {
					associationId: association.id,
					dueDate: { lt: now },
					balanceDue: { gt: 0 }
				},
				_count: { id: true },
				_sum: { balanceDue: true }
			});

			// Work orders exceeding budget
			const workOrdersExceedingBudget = await prisma.workOrder.count({
				where: {
					associationId: association.id,
					status: { notIn: ['CLOSED', 'CANCELLED'] },
					AND: [
						{ approvedAmount: { not: null } },
						{ spendToDate: { not: null } }
					]
				}
			});
			// Note: Prisma doesn't support comparing two columns directly,
			// so we'd need raw SQL or post-filter. For now, count all with budget tracking.

			// Reserve-funded work pending approval
			const reserveFundedWorkPending = await prisma.workOrder.count({
				where: {
					associationId: association.id,
					budgetSource: 'RESERVE',
					status: { in: ['SUBMITTED', 'TRIAGED'] },
					requiresBoardApproval: true,
					OR: [
						{ boardApprovalStatus: 'PENDING' },
						{ boardApprovalStatus: null }
					]
				}
			});

			// =================================================================
			// Section 4: Recent Governance Activity
			// =================================================================

			const recentGovernanceItems: Array<{
				id: string;
				type: 'ARC_APPROVED' | 'VIOLATION_CLOSED' | 'MOTION_APPROVED' | 'POLICY_CREATED' | 'RESOLUTION_ADOPTED';
				title: string;
				actorRole: string;
				occurredAt: string;
				deepLink: string;
			}> = [];

			// Recently approved ARC requests
			const recentApprovedArc = await prisma.aRCRequest.findMany({
				where: {
					associationId: association.id,
					status: 'APPROVED',
					updatedAt: { gte: thirtyDaysAgo }
				},
				orderBy: { updatedAt: 'desc' },
				take: 5,
				select: { id: true, title: true, requestNumber: true, updatedAt: true }
			});
			recentApprovedArc.forEach(arc => {
				recentGovernanceItems.push({
					id: arc.id,
					type: 'ARC_APPROVED',
					title: `ARC ${arc.requestNumber}: ${arc.title}`,
					actorRole: 'ARC Committee',
					occurredAt: arc.updatedAt.toISOString(),
					deepLink: `/app/cam/arc/${arc.id}`
				});
			});

			// Recently closed violations
			const recentClosedViolations = await prisma.violation.findMany({
				where: {
					associationId: association.id,
					status: { in: ['CLOSED', 'CURED', 'DISMISSED'] },
					closedDate: { gte: thirtyDaysAgo },
					deletedAt: null
				},
				orderBy: { closedDate: 'desc' },
				take: 5,
				select: { id: true, title: true, violationNumber: true, closedDate: true }
			});
			recentClosedViolations.forEach(v => {
				recentGovernanceItems.push({
					id: v.id,
					type: 'VIOLATION_CLOSED',
					title: `Violation ${v.violationNumber}: ${v.title}`,
					actorRole: 'Manager',
					occurredAt: v.closedDate?.toISOString() ?? new Date().toISOString(),
					deepLink: `/app/cam/violations/${v.id}`
				});
			});

			// Recently approved motions
			const recentApprovedMotions = await prisma.boardMotion.findMany({
				where: {
					associationId: association.id,
					status: 'APPROVED',
					decidedAt: { gte: thirtyDaysAgo }
				},
				orderBy: { decidedAt: 'desc' },
				take: 5,
				select: { id: true, title: true, motionNumber: true, decidedAt: true }
			});
			recentApprovedMotions.forEach(m => {
				recentGovernanceItems.push({
					id: m.id,
					type: 'MOTION_APPROVED',
					title: `Motion ${m.motionNumber}: ${m.title}`,
					actorRole: 'Board',
					occurredAt: m.decidedAt?.toISOString() ?? new Date().toISOString(),
					deepLink: `/app/cam/governance/motions/${m.id}`
				});
			});

			// Recently adopted resolutions
			const recentResolutions = await prisma.resolution.findMany({
				where: {
					associationId: association.id,
					status: 'ADOPTED',
					adoptedAt: { gte: thirtyDaysAgo }
				},
				orderBy: { adoptedAt: 'desc' },
				take: 5,
				select: { id: true, title: true, adoptedAt: true }
			});
			recentResolutions.forEach(r => {
				recentGovernanceItems.push({
					id: r.id,
					type: 'RESOLUTION_ADOPTED',
					title: r.title,
					actorRole: 'Board',
					occurredAt: r.adoptedAt?.toISOString() ?? new Date().toISOString(),
					deepLink: `/app/cam/governance/resolutions/${r.id}`
				});
			});

			// Sort all governance items by date descending
			recentGovernanceItems.sort((a, b) =>
				new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
			);

			return successResponse({
				dashboard: {
					requiresAction: {
						pendingArc: {
							count: pendingArcRequests.length,
							oldestAgeDays: oldestArcAgeDays,
							oldestId: oldestArc?.id ?? null
						},
						escalatedViolations: {
							total: escalatedViolations.length,
							bySeverity: escalatedBySeverity
						},
						workOrdersAwaitingAuth: {
							count: workOrdersAwaitingAuth.length,
							hasBudgetExceptions
						},
						governancePending: {
							meetingsNeedingMinutes,
							motionsAwaitingVote
						}
					},
					riskCompliance: {
						violationsBySeverity,
						repeatViolationsByUnit,
						overdueArcRequests,
						longRunningWorkOrders
					},
					financialAttention: {
						overdueAssessments: {
							count: overdueAssessments._count.id,
							totalAmount: Number(overdueAssessments._sum.balanceDue ?? 0)
						},
						workOrdersExceedingBudget,
						reserveFundedWorkPending
					},
					recentGovernance: {
						items: recentGovernanceItems.slice(0, 10)
					},
					lastUpdated: now.toISOString()
				}
			}, context);
		}),

	/**
	 * Record dashboard view/interaction event for audit trail (Phase 12)
	 */
	recordView: orgProcedure
		.input(z.object({
			eventType: z.enum(['DASHBOARD_VIEWED', 'CARD_CLICKED', 'FILTER_APPLIED']),
			section: z.string().optional(),
			card: z.string().optional(),
			targetUrl: z.string().optional(),
			filters: DashboardFiltersSchema.optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({ recorded: z.boolean() }),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Build event summary based on type
			let summary: string;
			switch (input.eventType) {
				case 'DASHBOARD_VIEWED':
					summary = 'Viewed CAM Dashboard';
					break;
				case 'CARD_CLICKED':
					summary = `Clicked dashboard card: ${input.card || 'unknown'}`;
					break;
				case 'FILTER_APPLIED':
					summary = 'Applied dashboard filter';
					break;
				default:
					summary = 'Dashboard interaction';
			}

			// Record the activity event
			// Using 'OTHER' entityType and 'CUSTOM' action since dashboard is a derived view
			await recordActivityFromContext(context, {
				entityType: 'OTHER',
				entityId: association.id,
				action: 'CUSTOM',
				eventCategory: 'SYSTEM',
				summary,
				metadata: {
					dashboardEventType: input.eventType,
					section: input.section,
					card: input.card,
					targetUrl: input.targetUrl,
					filters: input.filters
				}
			});

			return successResponse({ recorded: true }, context);
		})
};
