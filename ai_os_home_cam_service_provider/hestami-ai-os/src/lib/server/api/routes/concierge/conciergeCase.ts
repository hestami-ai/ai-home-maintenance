import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { setOrgContextForWorkItem, clearOrgContext } from '../../../db/rls.js';
import { ConciergeCaseStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/ConciergeCaseStatusSchema.js';
import { ConciergeCasePrioritySchema } from '../../../../../../generated/zod/inputTypeSchemas/ConciergeCasePrioritySchema.js';
import { CaseNoteTypeSchema } from '../../../../../../generated/zod/inputTypeSchemas/CaseNoteTypeSchema.js';
import { AvailabilityTypeSchema } from '../../../../../../generated/zod/inputTypeSchemas/AvailabilityTypeSchema.js';
import type { ConciergeCaseStatus } from '../../../../../../generated/prisma/client.js';
import { recordIntent, recordExecution, recordDecision } from '../../middleware/activityEvent.js';
import { DBOS } from '../../../dbos.js';
import { caseLifecycleWorkflow_v1 } from '../../../workflows/caseLifecycleWorkflow.js';
import { recordSpanError } from '../../middleware/tracing.js';
import { createLogger, createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ConciergeCaseRoute');

/**
 * Check if the user has cross-organization access for concierge cases.
 * This is determined by:
 * - Being a PLATFORM_ADMIN staff member, OR
 * - Being a staff member with CONCIERGE pillar access
 * 
 * @param staffRoles - User's staff roles (empty if not staff)
 * @param pillarAccess - User's pillar access (empty if not staff)
 * @returns true if user can access cases across all organizations
 */
function hasCrossOrgAccess(staffRoles: string[], pillarAccess: string[]): boolean {
	// Platform admins have full cross-org access
	if (staffRoles.includes('PLATFORM_ADMIN')) {
		return true;
	}
	// Staff with CONCIERGE pillar access have cross-org access for concierge cases
	if (staffRoles.length > 0 && pillarAccess.includes('CONCIERGE')) {
		return true;
	}
	return false;
}

/**
 * Build organization filter for queries.
 * Users with cross-org access can query without org filter.
 * Regular users are restricted to their own organization.
 */
function buildOrgFilter(
	orgId: string,
	staffRoles: string[],
	pillarAccess: string[]
): { organizationId?: string } {
	return hasCrossOrgAccess(staffRoles, pillarAccess) ? {} : { organizationId: orgId };
}

// Schema for availability time slots
const AvailabilitySlotSchema = z.object({
	startTime: z.string().datetime(),
	endTime: z.string().datetime(),
	notes: z.string().optional()
});

// Valid status transitions for the case state machine
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
	INTAKE: ['ASSESSMENT', 'CANCELLED'],
	ASSESSMENT: ['IN_PROGRESS', 'PENDING_EXTERNAL', 'PENDING_OWNER', 'ON_HOLD', 'CANCELLED'],
	IN_PROGRESS: ['PENDING_EXTERNAL', 'PENDING_OWNER', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
	PENDING_EXTERNAL: ['IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
	PENDING_OWNER: ['IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
	ON_HOLD: ['ASSESSMENT', 'IN_PROGRESS', 'PENDING_EXTERNAL', 'PENDING_OWNER', 'CANCELLED'],
	RESOLVED: ['CLOSED', 'IN_PROGRESS'], // Can reopen if needed
	CLOSED: [], // Terminal state
	CANCELLED: [] // Terminal state
};

/**
 * Concierge Case management procedures for Phase 3 Concierge Platform
 */
export const conciergeCaseRouter = {
	/**
	 * Create a new concierge case
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string(),
				title: z.string().min(1).max(255),
				description: z.string().min(1),
				priority: ConciergeCasePrioritySchema.optional(),
				originIntentId: z.string().optional(),
				assignedConciergeUserId: z.string().optional(),
				// Owner availability for service visits
				availabilityType: AvailabilityTypeSchema.optional(),
				availabilityNotes: z.string().optional(),
				availabilitySlots: z.array(AvailabilitySlotSchema).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					case: z.object({
						id: z.string(),
						caseNumber: z.string(),
						propertyId: z.string(),
						title: z.string(),
						status: z.string(),
						priority: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const reqLog = createLogger(context).child({ handler: 'create' });

			reqLog.info('Creating concierge case', {
				propertyId: input.propertyId,
				title: input.title,
				priority: input.priority
			});

			try {
				// Cerbos authorization
				await context.cerbos.authorize('create', 'concierge_case', 'new');
				reqLog.debug('Authorization passed');

				// Verify property belongs to this organization
				const property = await prisma.individualProperty.findFirst({
					where: { id: input.propertyId, ownerOrgId: context.organization.id }
				});

				if (!property) {
					reqLog.warn('Property not found', { propertyId: input.propertyId });
					throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
				}

				// Use DBOS workflow for durable execution with idempotencyKey as workflowID
				reqLog.debug('Starting case lifecycle workflow');
				const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
					workflowID: input.idempotencyKey
				})({
					action: 'CREATE_CASE',
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId: input.propertyId,
					title: input.title,
					description: input.description,
					priority: input.priority,
					intentId: input.originIntentId,
					assigneeUserId: input.assignedConciergeUserId,
					availabilityType: input.availabilityType,
					availabilityNotes: input.availabilityNotes,
					availabilitySlots: input.availabilitySlots
				});

				// Wait for the workflow to complete and get the result
				const result = await handle.getResult();

				if (!result.success) {
					reqLog.error('Case creation workflow failed', { error: result.error });
					throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create case' });
				}

				// Re-set RLS context since workflow clears it when done
				await setOrgContextForWorkItem(context.user.id, 'CONCIERGE_CASE', result.caseId!);

				// Fetch the created case for the response
				const conciergeCase = await prisma.conciergeCase.findFirstOrThrow({
					where: { id: result.caseId, organizationId: context.organization.id }
				});

				reqLog.info('Concierge case created', {
					caseId: conciergeCase.id,
					caseNumber: conciergeCase.caseNumber,
					status: conciergeCase.status
				});

				return successResponse(
					{
						case: {
							id: conciergeCase.id,
							caseNumber: conciergeCase.caseNumber,
							propertyId: conciergeCase.propertyId,
							title: conciergeCase.title,
							status: conciergeCase.status,
							priority: conciergeCase.priority,
							createdAt: conciergeCase.createdAt.toISOString()
						}
					},
					context
				);
			} catch (error) {
				const errorObj = error instanceof Error ? error : new Error(String(error));
				reqLog.exception(errorObj);

				// Record error on span for trace visibility
				await recordSpanError(errorObj, {
					errorCode: 'CASE_CREATION_FAILED',
					errorType: 'ConciergeCase_Create_Error'
				});

				throw error;
			}
		}),

	/**
	 * Get case by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					case: z.object({
						id: z.string(),
						caseNumber: z.string(),
						propertyId: z.string(),
						title: z.string(),
						description: z.string(),
						status: z.string(),
						priority: z.string(),
						originIntentId: z.string().nullable(),
						assignedConciergeUserId: z.string().nullable(),
						assignedConciergeName: z.string().nullable(),
						resolvedAt: z.string().nullable(),
						resolutionSummary: z.string().nullable(),
						closedAt: z.string().nullable(),
						cancelledAt: z.string().nullable(),
						cancelReason: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					property: z.object({
						id: z.string(),
						name: z.string(),
						addressLine1: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			let staffOrgContextSet = false;

			try {
				// For staff with cross-org access, set RLS context to the case's org
				if (hasCrossOrgAccess(context.staffRoles, context.pillarAccess)) {
					const orgId = await setOrgContextForWorkItem(
						context.user.id,
						'CONCIERGE_CASE',
						input.id
					);
					if (!orgId) {
						throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
					}
					staffOrgContextSet = true;
				}
				// For regular users, middleware already set context to their org

				const conciergeCase = await prisma.conciergeCase.findFirst({
					where: {
						id: input.id,
						deletedAt: null
					},
					include: {
						property: true,
						assignedConcierge: true
					}
				});

				if (!conciergeCase) {
					throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
				}

				// Cerbos authorization - uses case's actual organizationId for policy check
				await context.cerbos.authorize('view', 'concierge_case', conciergeCase.id, {
					organizationId: conciergeCase.organizationId
				});

				return successResponse(
					{
						case: {
							id: conciergeCase.id,
							caseNumber: conciergeCase.caseNumber,
							propertyId: conciergeCase.propertyId,
							title: conciergeCase.title,
							description: conciergeCase.description,
							status: conciergeCase.status,
							priority: conciergeCase.priority,
							originIntentId: conciergeCase.originIntentId,
							assignedConciergeUserId: conciergeCase.assignedConciergeUserId,
							assignedConciergeName: conciergeCase.assignedConcierge?.name ?? null,
							resolvedAt: conciergeCase.resolvedAt?.toISOString() ?? null,
							resolutionSummary: conciergeCase.resolutionSummary,
							closedAt: conciergeCase.closedAt?.toISOString() ?? null,
							cancelledAt: conciergeCase.cancelledAt?.toISOString() ?? null,
							cancelReason: conciergeCase.cancelReason,
							createdAt: conciergeCase.createdAt.toISOString(),
							updatedAt: conciergeCase.updatedAt.toISOString()
						},
						property: {
							id: conciergeCase.property.id,
							name: conciergeCase.property.name,
							addressLine1: conciergeCase.property.addressLine1
						}
					},
					context
				);
			} finally {
				// Clear staff cross-org context if it was set
				if (staffOrgContextSet) {
					await clearOrgContext(context.user.id);
				}
			}
		}),

	/**
	 * List cases with filtering
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				propertyId: z.string().optional(),
				status: ConciergeCaseStatusSchema.optional(),
				priority: ConciergeCasePrioritySchema.optional(),
				assignedConciergeUserId: z.string().optional(),
				includeClosedCancelled: z.boolean().default(false)
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					cases: z.array(
						z.object({
							id: z.string(),
							caseNumber: z.string(),
							propertyId: z.string(),
							propertyName: z.string(),
							title: z.string(),
							status: z.string(),
							priority: z.string(),
							assignedConciergeName: z.string().nullable(),
							createdAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization for listing
			await context.cerbos.authorize('view', 'concierge_case', 'list');

			// Staff with cross-org access: use staff view (no RLS filtering)
			if (hasCrossOrgAccess(context.staffRoles, context.pillarAccess)) {
				// Use Prisma's safe parameterized query for staff view
				const staffCases = await prisma.$queryRaw<Array<{
					id: string;
					case_number: string;
					title: string;
					status: string;
					priority: string;
					organization_id: string;
					organization_name: string;
					created_at: Date;
					assigned_concierge_user_id: string | null;
				}>>`
					SELECT id, case_number, title, status, priority, organization_id, 
						   organization_name, created_at, assigned_concierge_user_id
					FROM staff_concierge_cases_list
					WHERE (${input.status}::text IS NULL OR status = ${input.status})
					  AND (${input.priority}::text IS NULL OR priority = ${input.priority})
					  AND (${input.assignedConciergeUserId}::text IS NULL OR assigned_concierge_user_id = ${input.assignedConciergeUserId})
					  AND (${input.includeClosedCancelled}::boolean = true OR status NOT IN ('CLOSED', 'CANCELLED'))
					ORDER BY priority DESC, created_at DESC
					LIMIT ${input.limit + 1}
				`;

				const hasMore = staffCases.length > input.limit;
				const items = hasMore ? staffCases.slice(0, -1) : staffCases;

				return successResponse(
					{
						cases: items.map((c) => ({
							id: c.id,
							caseNumber: c.case_number,
							propertyId: '', // Not available in staff view
							propertyName: c.organization_name, // Use org name for staff view
							title: c.title,
							status: c.status,
							priority: c.priority,
							assignedConciergeName: null, // Would need join to get this
							createdAt: c.created_at.toISOString()
						})),
						pagination: {
							nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
							hasMore
						}
					},
					context
				);
			}

			// Regular users: Filter by organizationId explicitly (defense in depth, not relying solely on RLS)
			const whereClause = {
				organizationId: context.organization.id, // Explicit org filter for connection pool safety
				deletedAt: null,
				...(input.propertyId && { propertyId: input.propertyId }),
				...(input.status && { status: input.status }),
				...(input.priority && { priority: input.priority }),
				...(input.assignedConciergeUserId && {
					assignedConciergeUserId: input.assignedConciergeUserId
				}),
				...(!input.includeClosedCancelled && {
					status: { notIn: ['CLOSED', 'CANCELLED'] as ConciergeCaseStatus[] }
				})
			};

			// Debug: Check total cases for this org (regardless of filters)
			const totalCasesForOrg = await prisma.conciergeCase.count({
				where: { organizationId: context.organization.id }
			});

			log.debug('conciergeCase.list query', {
				orgId: context.organization.id,
				includeClosedCancelled: input.includeClosedCancelled,
				totalCasesForOrg,
				whereClause: JSON.stringify(whereClause)
			});

			const cases = await prisma.conciergeCase.findMany({
				where: whereClause,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
				include: {
					property: true,
					assignedConcierge: true
				}
			});

			log.debug('conciergeCase.list results', {
				casesFound: cases.length,
				caseStatuses: cases.map(c => c.status)
			});

			const hasMore = cases.length > input.limit;
			const items = hasMore ? cases.slice(0, -1) : cases;

			return successResponse(
				{
					cases: items.map((c) => ({
						id: c.id,
						caseNumber: c.caseNumber,
						propertyId: c.propertyId,
						propertyName: c.property.name,
						title: c.title,
						status: c.status,
						priority: c.priority,
						assignedConciergeName: c.assignedConcierge?.name ?? null,
						createdAt: c.createdAt.toISOString()
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	/**
	 * Update case status with state machine validation
	 */
	updateStatus: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				status: ConciergeCaseStatusSchema,
				reason: z.string().optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					case: z.object({
						id: z.string(),
						status: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.conciergeCase.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Validate status transition
			const validTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
			if (!validTransitions.includes(input.status)) {
				throw errors.BAD_REQUEST({
					message: `Invalid status transition from ${existing.status} to ${input.status}`
				});
			}

			// Cerbos authorization
			await context.cerbos.authorize('update_status', 'concierge_case', existing.id);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'TRANSITION_STATUS',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.id,
				targetStatus: input.status,
				statusChangeReason: input.reason
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update status' });
			}

			// Fetch updated case for response
			const conciergeCase = await prisma.conciergeCase.findFirstOrThrow({
				where: { id: input.id, organizationId: context.organization.id }
			});

			return successResponse(
				{
					case: {
						id: conciergeCase.id,
						status: conciergeCase.status,
						updatedAt: conciergeCase.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Assign concierge to case
	 */
	assign: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				assignedConciergeUserId: z.string().nullable()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					case: z.object({
						id: z.string(),
						assignedConciergeUserId: z.string().nullable(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.conciergeCase.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('assign', 'concierge_case', existing.id);

			// Verify assignee exists if provided
			if (input.assignedConciergeUserId) {
				const user = await prisma.user.findUnique({
					where: { id: input.assignedConciergeUserId }
				});
				if (!user) {
					throw errors.NOT_FOUND({ message: 'User not found' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowAction = input.assignedConciergeUserId ? 'ASSIGN_CONCIERGE' : 'UNASSIGN_CONCIERGE';
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: workflowAction,
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.id,
				assigneeUserId: input.assignedConciergeUserId ?? undefined
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to assign concierge' });
			}

			// Fetch updated case for response
			const conciergeCase = await prisma.conciergeCase.findFirstOrThrow({
				where: { id: input.id, organizationId: context.organization.id }
			});

			return successResponse(
				{
					case: {
						id: conciergeCase.id,
						assignedConciergeUserId: conciergeCase.assignedConciergeUserId,
						updatedAt: conciergeCase.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Resolve case
	 */
	resolve: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				resolutionSummary: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					case: z.object({
						id: z.string(),
						status: z.string(),
						resolvedAt: z.string(),
						resolutionSummary: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.conciergeCase.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Validate status transition
			const validTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
			if (!validTransitions.includes('RESOLVED')) {
				throw errors.BAD_REQUEST({ message: `Cannot resolve case in ${existing.status} status` });
			}

			// Cerbos authorization
			await context.cerbos.authorize('resolve', 'concierge_case', existing.id);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'RESOLVE_CASE',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.id,
				resolutionSummary: input.resolutionSummary
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to resolve case' });
			}

			// Fetch updated case for response
			const conciergeCase = await prisma.conciergeCase.findFirstOrThrow({
				where: { id: input.id, organizationId: context.organization.id }
			});

			return successResponse(
				{
					case: {
						id: conciergeCase.id,
						status: conciergeCase.status,
						resolvedAt: conciergeCase.resolvedAt!.toISOString(),
						resolutionSummary: conciergeCase.resolutionSummary!
					}
				},
				context
			);
		}),

	/**
	 * Close case (after resolution)
	 */
	close: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					case: z.object({
						id: z.string(),
						status: z.string(),
						closedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.conciergeCase.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			if (existing.status !== 'RESOLVED') {
				throw errors.BAD_REQUEST({ message: 'Can only close cases in RESOLVED status' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('close', 'concierge_case', existing.id);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'CLOSE_CASE',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.id
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to close case' });
			}

			// Fetch updated case for response
			const conciergeCase = await prisma.conciergeCase.findFirstOrThrow({
				where: { id: input.id, organizationId: context.organization.id }
			});

			return successResponse(
				{
					case: {
						id: conciergeCase.id,
						status: conciergeCase.status,
						closedAt: conciergeCase.closedAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Cancel case
	 */
	cancel: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				reason: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					case: z.object({
						id: z.string(),
						status: z.string(),
						cancelledAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.conciergeCase.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Cannot cancel closed cases
			if (existing.status === 'CLOSED') {
				throw errors.BAD_REQUEST({ message: 'Cannot cancel a closed case' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('cancel', 'concierge_case', existing.id);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'CANCEL_CASE',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.id,
				cancelReason: input.reason
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to cancel case' });
			}

			// Fetch updated case for response
			const conciergeCase = await prisma.conciergeCase.findFirstOrThrow({
				where: { id: input.id, organizationId: context.organization.id }
			});

			return successResponse(
				{
					case: {
						id: conciergeCase.id,
						status: conciergeCase.status,
						cancelledAt: conciergeCase.cancelledAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get case status history
	 */
	getStatusHistory: orgProcedure
		.input(z.object({ caseId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
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
							reason: z.string().nullable(),
							changedBy: z.string(),
							createdAt: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'concierge_case', conciergeCase.id);

			const history = await prisma.caseStatusHistory.findMany({
				where: { caseId: input.caseId },
				orderBy: { createdAt: 'desc' }
			});

			return successResponse(
				{
					history: history.map((h) => ({
						id: h.id,
						fromStatus: h.fromStatus,
						toStatus: h.toStatus,
						reason: h.reason,
						changedBy: h.changedBy,
						createdAt: h.createdAt.toISOString()
					}))
				},
				context
			);
		}),

	/**
	 * Add note to case
	 */
	addNote: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				content: z.string().min(1),
				noteType: CaseNoteTypeSchema.optional(),
				isInternal: z.boolean().default(true)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					note: z.object({
						id: z.string(),
						caseId: z.string(),
						content: z.string(),
						noteType: z.string(),
						isInternal: z.boolean(),
						createdBy: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('add_note', 'concierge_case', conciergeCase.id);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'ADD_NOTE',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.caseId,
				noteContent: input.content,
				noteType: input.noteType ?? 'GENERAL',
				isInternal: input.isInternal
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add note' });
			}

			// Fetch created note for response - use findFirstOrThrow with caseId to ensure RLS safety
			const note = await prisma.caseNote.findFirstOrThrow({
				where: { id: result.noteId, caseId: input.caseId, case: { organizationId: context.organization.id } }
			});

			return successResponse(
				{
					note: {
						id: note.id,
						caseId: note.caseId,
						content: note.content,
						noteType: note.noteType,
						isInternal: note.isInternal,
						createdBy: note.createdBy,
						createdAt: note.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List notes for a case
	 */
	listNotes: orgProcedure
		.input(
			z.object({
				caseId: z.string(),
				noteType: CaseNoteTypeSchema.optional(),
				includeInternal: z.boolean().default(true)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					notes: z.array(
						z.object({
							id: z.string(),
							content: z.string(),
							noteType: z.string(),
							isInternal: z.boolean(),
							createdBy: z.string(),
							createdAt: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'concierge_case', conciergeCase.id);

			const notes = await prisma.caseNote.findMany({
				where: {
					caseId: input.caseId,
					case: { organizationId: context.organization.id },
					...(input.noteType && { noteType: input.noteType }),
					...(input.includeInternal ? {} : { isInternal: false })
				},
				orderBy: { createdAt: 'desc' }
			});

			return successResponse(
				{
					notes: notes.map((n) => ({
						id: n.id,
						content: n.content,
						noteType: n.noteType,
						isInternal: n.isInternal,
						createdBy: n.createdBy,
						createdAt: n.createdAt.toISOString()
					}))
				},
				context
			);
		}),

	/**
	 * Add participant to case
	 */
	addParticipant: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				partyId: z.string().optional(),
				externalContactName: z.string().optional(),
				externalContactEmail: z.string().email().optional(),
				externalContactPhone: z.string().optional(),
				role: z.string(),
				notes: z.string().optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					participant: z.object({
						id: z.string(),
						caseId: z.string(),
						partyId: z.string().nullable(),
						externalContactName: z.string().nullable(),
						role: z.string(),
						addedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Must provide either partyId or external contact info
			if (!input.partyId && !input.externalContactName) {
				throw errors.BAD_REQUEST({
					message: 'Must provide either partyId or external contact information'
				});
			}

			// Verify party if provided
			if (input.partyId) {
				const party = await prisma.party.findFirst({
					where: { id: input.partyId, organizationId: context.organization.id }
				});
				if (!party) {
					throw errors.NOT_FOUND({ message: 'Party not found' });
				}
			}

			// Cerbos authorization
			await context.cerbos.authorize('add_participant', 'concierge_case', conciergeCase.id);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'ADD_PARTICIPANT',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.caseId,
				partyId: input.partyId,
				externalContactName: input.externalContactName,
				externalContactEmail: input.externalContactEmail,
				externalContactPhone: input.externalContactPhone,
				participantRole: input.role,
				participantNotes: input.notes
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add participant' });
			}

			// Fetch created participant for response - use findFirstOrThrow with caseId to ensure RLS safety
			const participant = await prisma.caseParticipant.findFirstOrThrow({
				where: { id: result.participantId, caseId: input.caseId, case: { organizationId: context.organization.id } }
			});

			return successResponse(
				{
					participant: {
						id: participant.id,
						caseId: participant.caseId,
						partyId: participant.partyId,
						externalContactName: participant.externalContactName,
						role: participant.role,
						addedAt: participant.addedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List participants for a case
	 */
	listParticipants: orgProcedure
		.input(z.object({ caseId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					participants: z.array(
						z.object({
							id: z.string(),
							partyId: z.string().nullable(),
							partyName: z.string().nullable(),
							externalContactName: z.string().nullable(),
							externalContactEmail: z.string().nullable(),
							externalContactPhone: z.string().nullable(),
							role: z.string(),
							notes: z.string().nullable(),
							addedAt: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'concierge_case', conciergeCase.id);

			const participants = await prisma.caseParticipant.findMany({
				where: {
					caseId: input.caseId,
					case: { organizationId: context.organization.id },
					removedAt: null
				},
				include: { party: true },
				orderBy: { addedAt: 'asc' }
			});

			return successResponse(
				{
					participants: participants.map((p) => ({
						id: p.id,
						partyId: p.partyId,
						partyName: p.party
							? p.party.partyType === 'INDIVIDUAL'
								? `${p.party.firstName ?? ''} ${p.party.lastName ?? ''}`.trim()
								: p.party.entityName ?? ''
							: null,
						externalContactName: p.externalContactName,
						externalContactEmail: p.externalContactEmail,
						externalContactPhone: p.externalContactPhone,
						role: p.role,
						notes: p.notes,
						addedAt: p.addedAt.toISOString()
					}))
				},
				context
			);
		}),

	/**
	 * Remove participant from case
	 */
	removeParticipant: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				participantId: z.string()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean(),
					removedAt: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const participant = await prisma.caseParticipant.findFirst({
				where: { id: input.participantId, case: { organizationId: context.organization.id }, removedAt: null },
				include: { case: true }
			});

			if (!participant) {
				throw errors.NOT_FOUND({ message: 'CaseParticipant not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('remove_participant', 'concierge_case', participant.caseId);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'REMOVE_PARTICIPANT',
				organizationId: context.organization.id,
				userId: context.user.id,
				participantId: input.participantId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to remove participant' });
			}

			return successResponse(
				{
					success: true,
					removedAt: result.removedAt!
				},
				context
			);
		}),

	/**
	 * Link case to Phase 1 HOA unit (P3.12 Cross-Domain Integration)
	 */
	linkToUnit: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				unitId: z.string()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					caseId: z.string(),
					linkedUnitId: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: { id: input.caseId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			await context.cerbos.authorize('update', 'concierge_case', conciergeCase.id);

			// Verify unit exists (Phase 1 unit) - use findFirstOrThrow with organizationId for RLS safety
			const unit = await prisma.unit.findFirst({
				where: { id: input.unitId, organizationId: context.organization.id }
			});
			if (!unit) {
				throw errors.NOT_FOUND({ message: 'Unit not found' });
			}

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'LINK_UNIT',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.caseId,
				unitId: input.unitId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to link unit' });
			}

			return successResponse(
				{
					caseId: input.caseId,
					linkedUnitId: result.linkedUnitId!
				},
				context
			);
		}),

	/**
	 * Link case to Phase 2 Job (P3.12 Cross-Domain Integration)
	 */
	linkToJob: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				jobId: z.string()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					caseId: z.string(),
					linkedJobId: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: { id: input.caseId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			await context.cerbos.authorize('update', 'concierge_case', conciergeCase.id);

			// Verify job exists (Phase 2 job) - use findFirst with organizationId for RLS safety
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization.id }
			});
			if (!job) {
				throw errors.NOT_FOUND({ message: 'Job not found' });
			}

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'LINK_JOB',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.caseId,
				jobId: input.jobId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to link job' });
			}

			return successResponse(
				{
					caseId: input.caseId,
					linkedJobId: result.linkedJobId!
				},
				context
			);
		}),

	/**
	 * Unlink case from Phase 1/2 entities
	 */
	unlinkCrossDomain: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				unlinkType: z.enum(['unit', 'job', 'all'])
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					caseId: z.string(),
					unlinked: z.array(z.string())
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: { id: input.caseId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			await context.cerbos.authorize('update', 'concierge_case', conciergeCase.id);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'UNLINK_CROSS_DOMAIN',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.caseId,
				unlinkType: input.unlinkType
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to unlink' });
			}

			return successResponse(
				{
					caseId: input.caseId,
					unlinked: result.unlinked ?? []
				},
				context
			);
		}),

	/**
	 * Request clarification from owner (creates note + transitions to PENDING_OWNER)
	 */
	requestClarification: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				question: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					note: z.object({
						id: z.string(),
						caseId: z.string(),
						content: z.string(),
						noteType: z.string(),
						createdAt: z.string()
					}),
					case: z.object({
						id: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('request_clarification', 'concierge_case', conciergeCase.id);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'REQUEST_CLARIFICATION',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.caseId,
				clarificationQuestion: input.question
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to request clarification' });
			}

			// Fetch note and case for response - use findFirstOrThrow with organizationId for RLS safety
			const note = await prisma.caseNote.findFirstOrThrow({
				where: { id: result.noteId, caseId: input.caseId, case: { organizationId: context.organization.id } }
			});
			const updatedCase = await prisma.conciergeCase.findFirstOrThrow({
				where: { id: input.caseId, organizationId: context.organization.id }
			});

			return successResponse(
				{
					note: {
						id: note.id,
						caseId: note.caseId,
						content: note.content,
						noteType: note.noteType,
						createdAt: note.createdAt.toISOString()
					},
					case: {
						id: updatedCase.id,
						status: updatedCase.status
					}
				},
				context
			);
		}),

	/**
	 * Owner responds to clarification request
	 */
	respondToClarification: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				response: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					note: z.object({
						id: z.string(),
						caseId: z.string(),
						content: z.string(),
						noteType: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Cerbos authorization - owners can respond to clarifications
			await context.cerbos.authorize('respond_clarification', 'concierge_case', conciergeCase.id);

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'RESPOND_CLARIFICATION',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.caseId,
				clarificationResponse: input.response
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to respond to clarification' });
			}

			// Fetch note for response - use findFirstOrThrow with caseId for RLS safety
			const note = await prisma.caseNote.findFirstOrThrow({
				where: { id: result.noteId, caseId: input.caseId, case: { organizationId: context.organization.id } }
			});

			return successResponse(
				{
					note: {
						id: note.id,
						caseId: note.caseId,
						content: note.content,
						noteType: note.noteType,
						createdAt: note.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get full case detail with all related data for split view
	 */
	getDetail: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: {
				message: 'Case not found',
				data: z.object({ resourceType: z.string() })
			}
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					case: z.object({
						id: z.string(),
						caseNumber: z.string(),
						propertyId: z.string(),
						title: z.string(),
						description: z.string(),
						status: z.string(),
						priority: z.string(),
						originIntentId: z.string().nullable(),
						assignedConciergeUserId: z.string().nullable(),
						assignedConciergeName: z.string().nullable(),
						linkedUnitId: z.string().nullable(),
						linkedJobId: z.string().nullable(),
						linkedArcRequestId: z.string().nullable(),
						linkedWorkOrderId: z.string().nullable(),
						resolvedAt: z.string().nullable(),
						resolutionSummary: z.string().nullable(),
						closedAt: z.string().nullable(),
						cancelledAt: z.string().nullable(),
						cancelReason: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					property: z.object({
						id: z.string(),
						name: z.string(),
						addressLine1: z.string(),
						city: z.string().nullable(),
						state: z.string().nullable(),
						postalCode: z.string().nullable()
					}),
					originIntent: z
						.object({
							id: z.string(),
							title: z.string(),
							description: z.string(),
							status: z.string(),
							createdAt: z.string()
						})
						.nullable(),
					statusHistory: z.array(
						z.object({
							id: z.string(),
							fromStatus: z.string().nullable(),
							toStatus: z.string(),
							reason: z.string().nullable(),
							changedBy: z.string(),
							createdAt: z.string()
						})
					),
					notes: z.array(
						z.object({
							id: z.string(),
							content: z.string(),
							noteType: z.string(),
							isInternal: z.boolean(),
							createdBy: z.string(),
							createdAt: z.string()
						})
					),
					participants: z.array(
						z.object({
							id: z.string(),
							partyId: z.string().nullable(),
							partyName: z.string().nullable(),
							externalContactName: z.string().nullable(),
							externalContactEmail: z.string().nullable(),
							role: z.string(),
							addedAt: z.string()
						})
					),
					actions: z.array(
						z.object({
							id: z.string(),
							actionType: z.string(),
							status: z.string(),
							description: z.string(),
							plannedAt: z.string().nullable(),
							completedAt: z.string().nullable(),
							createdAt: z.string()
						})
					),
					decisions: z.array(
						z.object({
							id: z.string(),
							category: z.string(),
							title: z.string(),
							rationale: z.string(),
							decidedAt: z.string(),
							hasOutcome: z.boolean()
						})
					),
					attachments: z.array(
						z.object({
							id: z.string(),
							fileName: z.string(),
							fileSize: z.number(),
							mimeType: z.string(),
							fileUrl: z.string(),
							uploadedBy: z.string(),
							createdAt: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const reqLog = createLogger(context).child({ handler: 'getDetail', caseId: input.id });
			let staffOrgContextSet = false;

			try {
				// For staff with cross-org access, set RLS context to the case's org
				if (hasCrossOrgAccess(context.staffRoles, context.pillarAccess)) {
					const orgId = await setOrgContextForWorkItem(
						context.user.id,
						'CONCIERGE_CASE',
						input.id
					);
					if (!orgId) {
						throw errors.NOT_FOUND({ data: { resourceType: 'ConciergeCase' } });
					}
					staffOrgContextSet = true;
				}
				// For regular users, middleware already set context to their org

				const conciergeCase = await prisma.conciergeCase.findFirst({
					where: {
						id: input.id,
						deletedAt: null
					},
					include: {
						property: true,
						assignedConcierge: true,
						statusHistory: { orderBy: { createdAt: 'desc' } },
						notes: { orderBy: { createdAt: 'desc' } },
						participants: {
							where: { removedAt: null },
							include: { party: true },
							orderBy: { addedAt: 'asc' }
						},
						actions: {
							where: { deletedAt: null },
							orderBy: { createdAt: 'desc' }
						},
						decisions: {
							where: { deletedAt: null },
							orderBy: { decidedAt: 'desc' }
						},
						attachments: { orderBy: { createdAt: 'desc' } }
					}
				});

				if (!conciergeCase) {
					throw errors.NOT_FOUND({ data: { resourceType: 'ConciergeCase' } });
				}

				// Cerbos authorization - uses case's actual organizationId for policy check
				await context.cerbos.authorize('view', 'concierge_case', conciergeCase.id, {
					organizationId: conciergeCase.organizationId
				});

				// Fetch origin intent if exists - use findFirst with organizationId for RLS safety
				let originIntent = null;
				if (conciergeCase.originIntentId) {
					const intent = await prisma.ownerIntent.findFirst({
						where: { id: conciergeCase.originIntentId, organizationId: conciergeCase.organizationId }
					});
					if (intent) {
						originIntent = {
							id: intent.id,
							title: intent.title,
							description: intent.description,
							status: intent.status,
							createdAt: intent.createdAt.toISOString()
						};
					}
				}

				// Fetch documents bound to this case via DocumentContextBinding
				const documentBindings = await prisma.documentContextBinding.findMany({
					where: {
						contextType: 'CASE',
						contextId: input.id
					},
					include: {
						document: true
					},
					orderBy: { createdAt: 'desc' }
				});

				// Filter to only show ACTIVE documents
				const boundDocuments = documentBindings
					.filter((b) => b.document.status === 'ACTIVE')
					.map((b) => ({
						id: b.document.id,
						fileName: b.document.fileName,
						fileSize: b.document.fileSize,
						mimeType: b.document.mimeType,
						fileUrl: b.document.fileUrl ?? '',
						uploadedBy: b.document.uploadedBy,
						createdAt: b.document.createdAt.toISOString()
					}));

				return successResponse(
					{
						case: {
							id: conciergeCase.id,
							caseNumber: conciergeCase.caseNumber,
							propertyId: conciergeCase.propertyId,
							title: conciergeCase.title,
							description: conciergeCase.description,
							status: conciergeCase.status,
							priority: conciergeCase.priority,
							originIntentId: conciergeCase.originIntentId,
							assignedConciergeUserId: conciergeCase.assignedConciergeUserId,
							assignedConciergeName: conciergeCase.assignedConcierge?.name ?? null,
							linkedUnitId: conciergeCase.linkedUnitId,
							linkedJobId: conciergeCase.linkedJobId,
							linkedArcRequestId: conciergeCase.linkedArcRequestId ?? null,
							linkedWorkOrderId: conciergeCase.linkedWorkOrderId ?? null,
							resolvedAt: conciergeCase.resolvedAt?.toISOString() ?? null,
							resolutionSummary: conciergeCase.resolutionSummary,
							closedAt: conciergeCase.closedAt?.toISOString() ?? null,
							cancelledAt: conciergeCase.cancelledAt?.toISOString() ?? null,
							cancelReason: conciergeCase.cancelReason,
							createdAt: conciergeCase.createdAt.toISOString(),
							updatedAt: conciergeCase.updatedAt.toISOString()
						},
						property: {
							id: conciergeCase.property.id,
							name: conciergeCase.property.name,
							addressLine1: conciergeCase.property.addressLine1,
							city: conciergeCase.property.city,
							state: conciergeCase.property.state,
							postalCode: conciergeCase.property.postalCode
						},
						originIntent,
						statusHistory: conciergeCase.statusHistory.map((h) => ({
							id: h.id,
							fromStatus: h.fromStatus,
							toStatus: h.toStatus,
							reason: h.reason,
							changedBy: h.changedBy,
							createdAt: h.createdAt.toISOString()
						})),
						notes: conciergeCase.notes.map((n) => ({
							id: n.id,
							content: n.content,
							noteType: n.noteType,
							isInternal: n.isInternal,
							createdBy: n.createdBy,
							createdAt: n.createdAt.toISOString()
						})),
						participants: conciergeCase.participants.map((p) => ({
							id: p.id,
							partyId: p.partyId,
							partyName: p.party
								? p.party.partyType === 'INDIVIDUAL'
									? `${p.party.firstName ?? ''} ${p.party.lastName ?? ''}`.trim()
									: p.party.entityName ?? ''
								: null,
							externalContactName: p.externalContactName,
							externalContactEmail: p.externalContactEmail,
							role: p.role,
							addedAt: p.addedAt.toISOString()
						})),
						actions: conciergeCase.actions.map((a) => ({
							id: a.id,
							actionType: a.actionType,
							status: a.status,
							description: a.description,
							plannedAt: a.plannedAt?.toISOString() ?? null,
							completedAt: a.completedAt?.toISOString() ?? null,
							createdAt: a.createdAt.toISOString()
						})),
						decisions: conciergeCase.decisions.map((d) => ({
							id: d.id,
							category: d.category,
							title: d.title,
							rationale: d.rationale,
							decidedAt: d.decidedAt.toISOString(),
							hasOutcome: d.actualOutcome !== null
						})),
						// Combine legacy CaseAttachment and new Document bindings
						attachments: [
							...boundDocuments,
							...conciergeCase.attachments.map((a) => ({
								id: a.id,
								fileName: a.fileName,
								fileSize: a.fileSize,
								mimeType: a.mimeType,
								fileUrl: a.fileUrl,
								uploadedBy: a.uploadedBy,
								createdAt: a.createdAt.toISOString()
							}))
						]
					},
					context
				);
			} catch (error) {
				reqLog.error('Failed to get case detail', { error: error instanceof Error ? error.message : String(error) });
				reqLog.exception(error instanceof Error ? error : new Error(String(error)));
				throw error;
			} finally {
				// Clear staff cross-org context if it was set
				if (staffOrgContextSet) {
					await clearOrgContext(context.user.id);
				}
			}
		}),

	/**
	 * Link case to CAM ARC Request
	 */
	linkToArc: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				arcRequestId: z.string()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					caseId: z.string(),
					linkedArcRequestId: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: { id: input.caseId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			await context.cerbos.authorize('update', 'concierge_case', conciergeCase.id);

			// Verify ARC request exists - use findFirst with organizationId for RLS safety
			const arcRequest = await prisma.aRCRequest.findFirst({
				where: { id: input.arcRequestId, organizationId: context.organization.id }
			});
			if (!arcRequest) {
				throw errors.NOT_FOUND({ message: 'ARCRequest not found' });
			}

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'LINK_ARC',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.caseId,
				arcRequestId: input.arcRequestId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to link ARC request' });
			}

			return successResponse(
				{
					caseId: input.caseId,
					linkedArcRequestId: result.linkedArcRequestId!
				},
				context
			);
		}),

	/**
	 * Link case to CAM Work Order
	 */
	linkToWorkOrder: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				workOrderId: z.string()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					caseId: z.string(),
					linkedWorkOrderId: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const conciergeCase = await prisma.conciergeCase.findFirst({
				where: { id: input.caseId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!conciergeCase) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			await context.cerbos.authorize('update', 'concierge_case', conciergeCase.id);

			// Verify work order exists - use findFirst with organizationId for RLS safety
			const workOrder = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id }
			});
			if (!workOrder) {
				throw errors.NOT_FOUND({ message: 'WorkOrder not found' });
			}

			// Use DBOS workflow for durable execution
			const handle = await DBOS.startWorkflow(caseLifecycleWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'LINK_WORK_ORDER',
				organizationId: context.organization.id,
				userId: context.user.id,
				caseId: input.caseId,
				workOrderId: input.workOrderId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to link work order' });
			}

			return successResponse(
				{
					caseId: input.caseId,
					linkedWorkOrderId: input.workOrderId
				},
				context
			);
		}),

	/**
	 * List available concierges (organization members who can be assigned)
	 */
	listConcierges: orgProcedure
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					concierges: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							email: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
		.handler(async ({ context }) => {
			await context.cerbos.authorize('view', 'concierge_case', 'list');

			// Get all members of the organization who can be assigned as concierges
			// Include ADMIN and MANAGER roles as potential concierges
			const memberships = await prisma.userOrganization.findMany({
				where: {
					organizationId: context.organization.id,
					role: { in: ['ADMIN', 'MANAGER'] }
				}
			});

			// Fetch user details for each membership
			const userIds = memberships.map((m) => m.userId);
			const users = await prisma.user.findMany({
				where: { id: { in: userIds } },
				select: { id: true, name: true, email: true }
			});

			return successResponse(
				{
					concierges: users.map((u) => ({
						id: u.id,
						name: u.name ?? u.email,
						email: u.email
					}))
				},
				context
			);
		})
};
