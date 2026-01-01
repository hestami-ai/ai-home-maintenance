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
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { authedProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { createModuleLogger } from '../../logger.js';
import { buildPrincipal, requireAuthorization, createResource } from '../../cerbos/index.js';

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
		.errors({
			FORBIDDEN: { message: 'Staff access required for work queue' },
			INTERNAL_SERVER_ERROR: { message: 'Database error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization - verify user is staff with work queue access
			// Uses direct Cerbos call since work queue is cross-org (no orgProcedure)
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined, // no current org
				undefined, // no vendorId
				undefined, // no currentOrgId
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('work_queue', 'list', 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required for work queue'
				});
			}

			const pillar = input?.pillar ?? 'ALL';
			const limit = input?.limit ?? 50;
			const now = new Date();

			// Use SECURITY DEFINER function to bypass RLS for cross-org staff access
			// This function is defined in migration 20251228182900_staff_work_queue_functions
			interface WorkQueueRow {
				item_type: string;
				item_id: string;
				item_number: string;
				organization_id: string;
				organization_name: string | null;
				title: string;
				status: string;
				priority: string;
				property_name: string | null;
				association_name: string | null;
				assigned_to_id: string | null;
				assigned_to_name: string | null;
				created_at: Date;
				updated_at: Date;
			}

			let rawItems: WorkQueueRow[];
			try {
				rawItems = await prisma.$queryRaw<WorkQueueRow[]>`
					SELECT * FROM get_staff_work_queue()
				`;
			} catch (dbError) {
				log.error('Work queue database error', { error: dbError });
				throw errors.INTERNAL_SERVER_ERROR({
					message: dbError instanceof Error ? dbError.message : 'Failed to fetch work queue'
				});
			}

			// Transform and filter based on pillar
			let items: WorkQueueItem[] = [];

			for (const row of rawItems) {
				// Filter by pillar
				const itemPillar = row.item_type === 'CONCIERGE_CASE' ? 'CONCIERGE' : 'CAM';
				if (pillar !== 'ALL' && itemPillar !== pillar) continue;

				// Filter by state if specified
				if (input?.state && row.status !== input.state) continue;

				// Filter by assignment
				if (input?.assignedToMe && row.assigned_to_id !== context.user!.id) continue;
				if (input?.unassignedOnly && row.assigned_to_id !== null) continue;

				const timeInState = now.getTime() - new Date(row.updated_at).getTime();
				const urgency = calculateUrgency(row.priority, timeInState, null);

				items.push({
					id: `${row.item_type.toLowerCase().replace('_', '-')}-${row.item_id}`,
					pillar: itemPillar,
					itemType: row.item_type,
					itemId: row.item_id,
					itemNumber: row.item_number,
					organizationId: row.organization_id,
					title: row.title,
					currentState: row.status,
					timeInState,
					timeInStateFormatted: formatTimeInState(timeInState),
					requiredAction: getRequiredAction(row.status, row.item_type),
					priority: row.priority,
					urgency,
					slaStatus: null,
					slaDeadline: null,
					assignedToId: row.assigned_to_id,
					assignedToName: row.assigned_to_name,
					propertyName: row.property_name,
					associationName: row.association_name,
					organizationName: row.organization_name,
					createdAt: new Date(row.created_at).toISOString(),
					updatedAt: new Date(row.updated_at).toISOString()
				});
			}

			// Sort by urgency, then by time in state (oldest first)
			const urgencyOrder = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
			items.sort((a, b) => {
				const urgencyDiff = urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder];
				if (urgencyDiff !== 0) return urgencyDiff;
				return b.timeInState - a.timeInState; // Older items first
			});

			// Filter by urgency if specified
			if (input?.urgency) {
				items = items.filter((item) => item.urgency === input.urgency);
			}

			// Calculate summary
			const summary = {
				total: items.length,
				critical: items.filter((i) => i.urgency === 'CRITICAL').length,
				high: items.filter((i) => i.urgency === 'HIGH').length,
				normal: items.filter((i) => i.urgency === 'NORMAL').length,
				low: items.filter((i) => i.urgency === 'LOW').length,
				unassigned: items.filter((i) => !i.assignedToId).length
			};

			// Apply pagination
			const paginatedItems = items.slice(0, limit);
			const hasMore = items.length > limit;

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
		.errors({
			FORBIDDEN: { message: 'Staff access required for work queue' },
			INTERNAL_SERVER_ERROR: { message: 'Database error' }
		})
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
		.handler(async ({ context, errors }) => {
			// Cerbos authorization - verify user is staff with work queue access
			// Uses direct Cerbos call since work queue is cross-org (no orgProcedure)
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined, // no current org
				undefined, // no vendorId
				undefined, // no currentOrgId
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('work_queue', 'summary', 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required for work queue'
				});
			}

			// Use SECURITY DEFINER function to bypass RLS for cross-org staff access
			interface SummaryRow {
				concierge_intake: number;
				concierge_in_progress: number;
				concierge_pending_external: number;
				concierge_pending_owner: number;
				work_orders_open: number;
				violations_open: number;
				arc_requests_pending: number;
			}

			let summaryRow: SummaryRow | undefined;
			let urgencyRow: { emergency: bigint; high: bigint } | undefined;
			try {
				[summaryRow] = await prisma.$queryRaw<SummaryRow[]>`
					SELECT * FROM get_staff_work_queue_summary()
				`;

				// For urgency, use direct counts (these are simpler queries)
				[urgencyRow] = await prisma.$queryRaw<[{ emergency: bigint; high: bigint }]>`
					SELECT 
						COUNT(*) FILTER (WHERE priority = 'EMERGENCY') as emergency,
						COUNT(*) FILTER (WHERE priority = 'HIGH') as high
					FROM work_orders 
					WHERE status NOT IN ('CLOSED', 'CANCELLED')
				`;
			} catch (dbError) {
				log.error('Work queue summary database error', { error: dbError });
				throw errors.INTERNAL_SERVER_ERROR({
					message: dbError instanceof Error ? dbError.message : 'Failed to fetch work queue summary'
				});
			}

			const workOrderCount = summaryRow?.work_orders_open ?? 0;
			const emergencyWO = Number(urgencyRow?.emergency ?? 0);
			const highWO = Number(urgencyRow?.high ?? 0);

			return successResponse(
				{
					concierge: {
						total: (summaryRow?.concierge_intake ?? 0) +
							(summaryRow?.concierge_in_progress ?? 0) +
							(summaryRow?.concierge_pending_external ?? 0) +
							(summaryRow?.concierge_pending_owner ?? 0),
						intake: summaryRow?.concierge_intake ?? 0,
						inProgress: summaryRow?.concierge_in_progress ?? 0,
						pendingExternal: summaryRow?.concierge_pending_external ?? 0,
						pendingOwner: summaryRow?.concierge_pending_owner ?? 0
					},
					cam: {
						workOrders: workOrderCount,
						violations: summaryRow?.violations_open ?? 0,
						arcRequests: summaryRow?.arc_requests_pending ?? 0
					},
					urgency: {
						critical: emergencyWO,
						high: highWO,
						normal: workOrderCount - emergencyWO - highWO
					}
				},
				context
			);
		}),

	/**
	 * Get the organization ID for a work queue item
	 * Used by staff to get org context before calling org-scoped APIs
	 */
	getItemOrg: authedProcedure
		.input(
			z.object({
				itemType: z.enum(['CONCIERGE_CASE', 'WORK_ORDER', 'VIOLATION', 'ARC_REQUEST']),
				itemId: z.string()
			})
		)
		.errors({
			FORBIDDEN: { message: 'Staff access required' },
			NOT_FOUND: { message: 'Work item not found' },
			INTERNAL_SERVER_ERROR: { message: 'Database error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					organizationId: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization - verify user is staff
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('work_queue', 'item_lookup', 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			// Use SECURITY DEFINER function to look up org ID
			interface OrgLookupResult {
				get_work_item_org: string | null;
			}

			let result: OrgLookupResult[];
			try {
				result = await prisma.$queryRaw<OrgLookupResult[]>`
					SELECT get_work_item_org(${input.itemType}, ${input.itemId})
				`;
			} catch (dbError) {
				log.error('Work item org lookup error', { error: dbError });
				throw errors.INTERNAL_SERVER_ERROR({
					message: dbError instanceof Error ? dbError.message : 'Failed to look up work item'
				});
			}

			const orgId = result[0]?.get_work_item_org;
			if (!orgId) {
				throw errors.NOT_FOUND({
					message: `${input.itemType} with ID ${input.itemId} not found`
				});
			}

			return successResponse(
				{ organizationId: orgId },
				context
			);
		})
};
