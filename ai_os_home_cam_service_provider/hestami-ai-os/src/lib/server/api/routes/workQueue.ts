/**
 * Phase 16: Work Queue Routes
 * 
 * Provides the staff Work Queue - the default landing page for staff
 * that answers "What needs attention right now?"
 * 
 * Aggregates work items from:
 * - Concierge Cases
 * - CAM Work Orders
 * - Violations
 * - ARC Requests
 */

import { z } from 'zod';
import { ResponseMetaSchema } from '../schemas.js';
import { authedProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('WorkQueueRoute');

// =============================================================================
// Types & Schemas
// =============================================================================

const WorkQueuePillarSchema = z.enum(['CONCIERGE', 'CAM', 'CONTRACTOR', 'ALL']);
const WorkQueueUrgencySchema = z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']);

const WorkQueueItemSchema = z.object({
	id: z.string(),
	pillar: z.string(),
	itemType: z.string(),
	itemId: z.string(),
	itemNumber: z.string(),
	organizationId: z.string(), // Required for RLS context switching
	title: z.string(),
	currentState: z.string(),
	timeInState: z.number(), // milliseconds
	timeInStateFormatted: z.string(),
	requiredAction: z.string(),
	priority: z.string(),
	urgency: z.string(),
	slaStatus: z.enum(['ON_TRACK', 'AT_RISK', 'BREACHED']).nullable(),
	slaDeadline: z.string().nullable(),
	assignedToId: z.string().nullable(),
	assignedToName: z.string().nullable(),
	propertyName: z.string().nullable(),
	associationName: z.string().nullable(),
	organizationName: z.string().nullable(), // Human-readable org name
	createdAt: z.string(),
	updatedAt: z.string()
});

type WorkQueueItem = z.infer<typeof WorkQueueItemSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimeInState(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h`;
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m`;
	return `${seconds}s`;
}

function getRequiredAction(status: string, itemType: string): string {
	// Concierge Case actions
	if (itemType === 'CONCIERGE_CASE') {
		switch (status) {
			case 'INTAKE':
				return 'Assess case and determine next steps';
			case 'ASSESSMENT':
				return 'Complete assessment and begin work';
			case 'IN_PROGRESS':
				return 'Continue case resolution';
			case 'PENDING_EXTERNAL':
				return 'Follow up with external party';
			case 'PENDING_OWNER':
				return 'Await owner response or follow up';
			case 'ON_HOLD':
				return 'Review hold status and resume';
			default:
				return 'Review case';
		}
	}

	// Work Order actions
	if (itemType === 'WORK_ORDER') {
		switch (status) {
			case 'SUBMITTED':
				return 'Triage and assign vendor';
			case 'TRIAGED':
				return 'Authorize work';
			case 'AUTHORIZED':
				return 'Assign vendor';
			case 'ASSIGNED':
				return 'Schedule work';
			case 'SCHEDULED':
				return 'Monitor for completion';
			case 'IN_PROGRESS':
				return 'Monitor progress';
			case 'COMPLETED':
				return 'Review and close';
			default:
				return 'Review work order';
		}
	}

	// Violation actions
	if (itemType === 'VIOLATION') {
		switch (status) {
			case 'OPEN':
				return 'Send initial notice';
			case 'NOTICE_SENT':
				return 'Monitor cure period';
			case 'HEARING_SCHEDULED':
				return 'Prepare for hearing';
			case 'ESCALATED':
				return 'Review escalation';
			default:
				return 'Review violation';
		}
	}

	// ARC Request actions
	if (itemType === 'ARC_REQUEST') {
		switch (status) {
			case 'SUBMITTED':
				return 'Review application';
			case 'UNDER_REVIEW':
				return 'Complete review';
			case 'PENDING_INFO':
				return 'Follow up for information';
			default:
				return 'Review request';
		}
	}

	return 'Review item';
}

function calculateUrgency(
	priority: string,
	timeInState: number,
	slaStatus: string | null
): 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' {
	// SLA breached = CRITICAL
	if (slaStatus === 'BREACHED') return 'CRITICAL';

	// SLA at risk = HIGH
	if (slaStatus === 'AT_RISK') return 'HIGH';

	// Priority-based urgency
	if (priority === 'EMERGENCY' || priority === 'URGENT') return 'CRITICAL';
	if (priority === 'HIGH') return 'HIGH';
	if (priority === 'LOW') return 'LOW';

	// Time-based escalation (over 48 hours in state = bump up urgency)
	const hoursInState = timeInState / (1000 * 60 * 60);
	if (hoursInState > 48) return 'HIGH';

	return 'NORMAL';
}

// =============================================================================
// Work Queue Router
// =============================================================================

export const workQueueRouter = {
	/**
	 * List work queue items for the current staff member
	 */
	list: authedProcedure
		.input(
			PaginationInputSchema.extend({
				pillar: WorkQueuePillarSchema.default('ALL'),
				urgency: WorkQueueUrgencySchema.optional(),
				assignedToMe: z.boolean().default(false),
				unassignedOnly: z.boolean().default(false),
				state: z.string().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					items: z.array(WorkQueueItemSchema),
					summary: z.object({
						total: z.number(),
						critical: z.number(),
						high: z.number(),
						normal: z.number(),
						low: z.number(),
						unassigned: z.number()
					}),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const userId = context.user!.id;
			const pillar = input?.pillar ?? 'ALL';
			const limit = input?.limit ?? 50;
			const now = new Date();

			const items: WorkQueueItem[] = [];

			// Fetch Concierge Cases (if pillar is ALL or CONCIERGE)
			if (pillar === 'ALL' || pillar === 'CONCIERGE') {
				const caseWhere: Record<string, unknown> = {
					deletedAt: null,
					status: { notIn: ['CLOSED', 'CANCELLED'] }
				};
				if (input?.assignedToMe) caseWhere.assignedConciergeUserId = userId;
				if (input?.unassignedOnly) caseWhere.assignedConciergeUserId = null;
				if (input?.state) caseWhere.status = input.state;

				const conciergeCases = await prisma.conciergeCase.findMany({
					where: caseWhere,
					include: {
						property: true,
						assignedConcierge: true,
						organization: {
							select: { id: true, name: true }
						}
					},
					orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
					take: limit
				});

				for (const c of conciergeCases) {
					const timeInState = now.getTime() - c.updatedAt.getTime();
					const urgency = calculateUrgency(c.priority, timeInState, null);

					items.push({
						id: `case-${c.id}`,
						pillar: 'CONCIERGE',
						itemType: 'CONCIERGE_CASE',
						itemId: c.id,
						itemNumber: c.caseNumber,
						organizationId: c.organizationId,
						title: c.title,
						currentState: c.status,
						timeInState,
						timeInStateFormatted: formatTimeInState(timeInState),
						requiredAction: getRequiredAction(c.status, 'CONCIERGE_CASE'),
						priority: c.priority,
						urgency,
						slaStatus: null, // TODO: Implement SLA tracking
						slaDeadline: null,
						assignedToId: c.assignedConciergeUserId,
						assignedToName: c.assignedConcierge?.name ?? null,
						propertyName: c.property.name,
						associationName: null,
						organizationName: c.organization.name,
						createdAt: c.createdAt.toISOString(),
						updatedAt: c.updatedAt.toISOString()
					});
				}
			}

			// Fetch Work Orders (if pillar is ALL or CAM)
			if (pillar === 'ALL' || pillar === 'CAM') {
				const woWhere: Record<string, unknown> = {
					status: { notIn: ['CLOSED', 'CANCELLED'] }
				};
				if (input?.state) woWhere.status = input.state;

				const workOrders = await prisma.workOrder.findMany({
					where: woWhere,
					include: {
						association: {
							include: {
								organization: { select: { id: true, name: true } }
							}
						},
						unit: true
					},
					orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
					take: limit
				});

				for (const wo of workOrders) {
					const timeInState = now.getTime() - wo.updatedAt.getTime();
					const urgency = calculateUrgency(wo.priority, timeInState, null);

					items.push({
						id: `wo-${wo.id}`,
						pillar: 'CAM',
						itemType: 'WORK_ORDER',
						itemId: wo.id,
						itemNumber: wo.workOrderNumber,
						organizationId: wo.association.organization.id,
						title: wo.title,
						currentState: wo.status,
						timeInState,
						timeInStateFormatted: formatTimeInState(timeInState),
						requiredAction: getRequiredAction(wo.status, 'WORK_ORDER'),
						priority: wo.priority,
						urgency,
						slaStatus: null,
						slaDeadline: null,
						assignedToId: null,
						assignedToName: null,
						propertyName: wo.unit?.unitNumber ?? null,
						associationName: wo.association?.name ?? null,
						organizationName: wo.association.organization.name,
						createdAt: wo.createdAt.toISOString(),
						updatedAt: wo.updatedAt.toISOString()
					});
				}
			}

			// Fetch Violations (if pillar is ALL or CAM)
			if (pillar === 'ALL' || pillar === 'CAM') {
				const vioWhere: Record<string, unknown> = {
					deletedAt: null,
					status: { notIn: ['CLOSED', 'DISMISSED'] }
				};
				if (input?.state) vioWhere.status = input.state;

				const violations = await prisma.violation.findMany({
					where: vioWhere,
					include: {
						association: {
							include: {
								organization: { select: { id: true, name: true } }
							}
						},
						unit: true
					},
					orderBy: [{ severity: 'desc' }, { updatedAt: 'asc' }],
					take: limit
				});

				for (const v of violations) {
					const timeInState = now.getTime() - v.updatedAt.getTime();
					const urgency = calculateUrgency(v.severity, timeInState, null);

					items.push({
						id: `vio-${v.id}`,
						pillar: 'CAM',
						itemType: 'VIOLATION',
						itemId: v.id,
						itemNumber: v.violationNumber,
						organizationId: v.association.organization.id,
						title: v.title,
						currentState: v.status,
						timeInState,
						timeInStateFormatted: formatTimeInState(timeInState),
						requiredAction: getRequiredAction(v.status, 'VIOLATION'),
						priority: v.severity,
						urgency,
						slaStatus: null,
						slaDeadline: v.curePeriodEnds?.toISOString() ?? null,
						assignedToId: null,
						assignedToName: null,
						propertyName: v.unit?.unitNumber ?? null,
						associationName: v.association?.name ?? null,
						organizationName: v.association.organization.name,
						createdAt: v.createdAt.toISOString(),
						updatedAt: v.updatedAt.toISOString()
					});
				}
			}

			// Fetch ARC Requests (if pillar is ALL or CAM)
			if (pillar === 'ALL' || pillar === 'CAM') {
				const arcWhere: Record<string, unknown> = {
					status: { notIn: ['APPROVED', 'DENIED', 'WITHDRAWN'] }
				};
				if (input?.state) arcWhere.status = input.state;

				const arcRequests = await prisma.aRCRequest.findMany({
					where: arcWhere,
					include: {
						association: {
							include: {
								organization: { select: { id: true, name: true } }
							}
						},
						unit: true
					},
					orderBy: [{ submittedAt: 'asc' }],
					take: limit
				});

				for (const arc of arcRequests) {
					const timeInState = now.getTime() - arc.updatedAt.getTime();
					const urgency = calculateUrgency('NORMAL', timeInState, null);

					items.push({
						id: `arc-${arc.id}`,
						pillar: 'CAM',
						itemType: 'ARC_REQUEST',
						itemId: arc.id,
						itemNumber: arc.requestNumber,
						organizationId: arc.association.organization.id,
						title: arc.title,
						currentState: arc.status,
						timeInState,
						timeInStateFormatted: formatTimeInState(timeInState),
						requiredAction: getRequiredAction(arc.status, 'ARC_REQUEST'),
						priority: 'NORMAL',
						urgency,
						slaStatus: null,
						slaDeadline: null,
						assignedToId: null,
						assignedToName: null,
						propertyName: arc.unit?.unitNumber ?? null,
						associationName: arc.association?.name ?? null,
						organizationName: arc.association.organization.name,
						createdAt: arc.createdAt.toISOString(),
						updatedAt: arc.updatedAt.toISOString()
					});
				}
			}

			// Sort by urgency, then by time in state (oldest first)
			const urgencyOrder = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
			items.sort((a, b) => {
				const urgencyDiff = urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder];
				if (urgencyDiff !== 0) return urgencyDiff;
				return b.timeInState - a.timeInState; // Older items first
			});

			// Filter by urgency if specified
			let filteredItems = items;
			if (input?.urgency) {
				filteredItems = items.filter((item) => item.urgency === input.urgency);
			}

			// Calculate summary
			const summary = {
				total: filteredItems.length,
				critical: filteredItems.filter((i) => i.urgency === 'CRITICAL').length,
				high: filteredItems.filter((i) => i.urgency === 'HIGH').length,
				normal: filteredItems.filter((i) => i.urgency === 'NORMAL').length,
				low: filteredItems.filter((i) => i.urgency === 'LOW').length,
				unassigned: filteredItems.filter((i) => !i.assignedToId).length
			};

			// Apply pagination
			const paginatedItems = filteredItems.slice(0, limit);
			const hasMore = filteredItems.length > limit;

			return successResponse(
				{
					items: paginatedItems,
					summary,
					pagination: {
						nextCursor: hasMore ? paginatedItems[paginatedItems.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	/**
	 * Get work queue summary counts by pillar
	 */
	summary: authedProcedure
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					concierge: z.object({
						total: z.number(),
						intake: z.number(),
						inProgress: z.number(),
						pendingExternal: z.number(),
						pendingOwner: z.number()
					}),
					cam: z.object({
						workOrders: z.number(),
						violations: z.number(),
						arcRequests: z.number()
					}),
					urgency: z.object({
						critical: z.number(),
						high: z.number(),
						normal: z.number()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ context }) => {
			// Concierge counts
			const [intakeCount, inProgressCount, pendingExternalCount, pendingOwnerCount] =
				await Promise.all([
					prisma.conciergeCase.count({
						where: { deletedAt: null, status: 'INTAKE' }
					}),
					prisma.conciergeCase.count({
						where: { deletedAt: null, status: 'IN_PROGRESS' }
					}),
					prisma.conciergeCase.count({
						where: { deletedAt: null, status: 'PENDING_EXTERNAL' }
					}),
					prisma.conciergeCase.count({
						where: { deletedAt: null, status: 'PENDING_OWNER' }
					})
				]);

			// CAM counts
			const [workOrderCount, violationCount, arcCount] = await Promise.all([
				prisma.workOrder.count({
					where: { status: { notIn: ['CLOSED', 'CANCELLED'] } }
				}),
				prisma.violation.count({
					where: { deletedAt: null, status: { notIn: ['CLOSED', 'DISMISSED'] } }
				}),
				prisma.aRCRequest.count({
					where: { status: { notIn: ['APPROVED', 'DENIED', 'WITHDRAWN'] } }
				})
			]);

			// For urgency, we'd need to calculate based on priorities
			// Simplified version - count by priority
			const [emergencyWO, highWO] = await Promise.all([
				prisma.workOrder.count({
					where: { status: { notIn: ['CLOSED', 'CANCELLED'] }, priority: 'EMERGENCY' }
				}),
				prisma.workOrder.count({
					where: { status: { notIn: ['CLOSED', 'CANCELLED'] }, priority: 'HIGH' }
				})
			]);

			return successResponse(
				{
					concierge: {
						total: intakeCount + inProgressCount + pendingExternalCount + pendingOwnerCount,
						intake: intakeCount,
						inProgress: inProgressCount,
						pendingExternal: pendingExternalCount,
						pendingOwner: pendingOwnerCount
					},
					cam: {
						workOrders: workOrderCount,
						violations: violationCount,
						arcRequests: arcCount
					},
					urgency: {
						critical: emergencyWO,
						high: highWO,
						normal: workOrderCount - emergencyWO - highWO
					}
				},
				context
			);
		})
};
