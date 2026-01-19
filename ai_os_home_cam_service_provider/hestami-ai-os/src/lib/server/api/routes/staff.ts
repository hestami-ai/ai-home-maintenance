/**
 * Phase 16: Staff Management Routes
 * 
 * Provides CRUD operations for Hestami internal staff entities.
 * Staff entities persist indefinitely for audit purposes.
 */

import { z } from 'zod';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { authedProcedure, orgProcedure, successResponse, IdempotencyKeySchema, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { StaffStatusSchema, StaffRoleSchema, PillarAccessSchema } from '../../../../../generated/zod/index.js';
import { StaffStatus, OrganizationType, PillarAccess } from '../../../../../generated/prisma/enums.js';
import { createModuleLogger } from '../../logger.js';
import { encrypt, decrypt, generateActivationCode } from '../../security/encryption.js';
import { recordSpanError } from '../middleware/tracing.js';
import { staffWorkflow_v1, StaffWorkflowAction } from '../../workflows/staffWorkflow.js';
import { SpanErrorType } from '../../workflows/schemas.js';

const log = createModuleLogger('StaffRoute');

// =============================================================================
// Zod Schemas for Staff API
// =============================================================================

const StaffOutputSchema = z.object({
	id: z.string(),
	userId: z.string(),
	displayName: z.string(),
	title: z.string().nullable(),
	status: StaffStatusSchema,
	roles: z.array(StaffRoleSchema),
	pillarAccess: z.array(PillarAccessSchema),
	canBeAssignedCases: z.boolean(),
	activatedAt: z.string().nullable(),
	suspendedAt: z.string().nullable(),
	deactivatedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	user: z.object({
		id: z.string(),
		email: z.string(),
		name: z.string().nullable()
	}).optional()
});

const StaffListItemSchema = z.object({
	id: z.string(),
	userId: z.string(),
	displayName: z.string(),
	title: z.string().nullable(),
	status: StaffStatusSchema,
	roles: z.array(StaffRoleSchema),
	pillarAccess: z.array(PillarAccessSchema),
	canBeAssignedCases: z.boolean(),
	createdAt: z.string(),
	user: z.object({
		email: z.string(),
		name: z.string().nullable()
	})
});

// =============================================================================
// Staff Router
// =============================================================================

export const staffRouter = {
	/**
	 * Create a new staff member (onboard)
	 * Creates a Staff entity linked to an existing User
	 */
	create: authedProcedure
		.input(
			z.object({
				email: z.string().email().describe('User email to link as staff'),
				displayName: z.string().min(1).max(255),
				title: z.string().max(255).optional(),
				roles: z.array(StaffRoleSchema).min(1).describe('At least one role required'),
				pillarAccess: z.array(PillarAccessSchema).min(1).describe('At least one pillar access required'),
				canBeAssignedCases: z.boolean().default(true),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'User with this email not found' },
			CONFLICT: { message: 'Staff profile already exists for this user' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to create staff' }
		})
		.handler(async ({ input, context, errors }) => {
			const user = await prisma.user.findUnique({
				where: { email: input.email }
			});

			if (!user) {
				throw errors.NOT_FOUND({ message: 'User with this email not found' });
			}

			// Check if staff profile already exists for this user
			const existingStaff = await prisma.staff.findUnique({
				where: { userId: user.id }
			});

			if (existingStaff) {
				throw errors.CONFLICT({ message: 'Staff profile already exists for this user' });
			}

			// Generate activation code
			const activationCode = generateActivationCode();
			const activationCodeEncrypted = encrypt(activationCode);
			const activationCodeExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.CREATE,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				data: {
					targetUserId: user.id,
					displayName: input.displayName,
					title: input.title,
					roles: input.roles,
					pillarAccess: input.pillarAccess,
					canBeAssignedCases: input.canBeAssignedCases,
					activationCodeEncrypted,
					activationCodeExpiresAt
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create staff' });
			}

			// Fetch the created staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: result.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Get a staff member by ID
	 */
	get: authedProcedure
		.input(
			z.object({
				staffId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const staff = await prisma.staff.findUnique({
				where: { id: input.staffId },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			if (!staff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Get staff profile for current user (if they are staff)
	 */
	me: authedProcedure
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema.nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
		.handler(async ({ context }) => {
			const staff = await prisma.staff.findUnique({
				where: { userId: context.user!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			if (!staff) {
				return successResponse({ staff: null }, context);
			}

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * List all staff members
	 */
	list: authedProcedure
		.input(
			z.object({
				status: StaffStatusSchema.optional(),
				role: StaffRoleSchema.optional(),
				pillar: PillarAccessSchema.optional(),
				limit: z.number().int().min(1).max(100).default(50),
				cursor: z.string().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: z.array(StaffListItemSchema),
					nextCursor: z.string().nullable(),
					hasMore: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
		.handler(async ({ input, context }) => {
			const limit = input?.limit ?? 50;
			const where: Record<string, unknown> = {};

			if (input?.status) {
				where.status = input.status;
			}

			if (input?.role) {
				where.roles = { has: input.role };
			}

			if (input?.pillar) {
				where.pillarAccess = { has: input.pillar };
			}

			const staffList = await prisma.staff.findMany({
				where,
				include: {
					user: {
						select: {
							email: true,
							name: true
						}
					}
				},
				orderBy: { createdAt: 'desc' },
				take: limit + 1,
				...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = staffList.length > limit;
			const items = hasMore ? staffList.slice(0, -1) : staffList;
			const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

			return successResponse(
				{
					staff: items.map((s) => ({
						id: s.id,
						userId: s.userId,
						displayName: s.displayName,
						title: s.title,
						status: s.status,
						roles: s.roles,
						pillarAccess: s.pillarAccess,
						canBeAssignedCases: s.canBeAssignedCases,
						createdAt: s.createdAt.toISOString(),
						user: s.user
					})),
					nextCursor,
					hasMore
				},
				context
			);
		}),

	/**
	 * Update staff member details
	 */
	update: authedProcedure
		.input(
			z.object({
				staffId: z.string(),
				displayName: z.string().min(1).max(255).optional(),
				title: z.string().max(255).nullable().optional(),
				canBeAssignedCases: z.boolean().optional(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to update staff' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.UPDATE,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				staffId: input.staffId,
				data: {
					displayName: input.displayName,
					title: input.title,
					canBeAssignedCases: input.canBeAssignedCases
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update staff' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Activate a pending staff member
	 */
	activate: authedProcedure
		.input(
			z.object({
				staffId: z.string(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to activate staff' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			if (existingStaff.status !== StaffStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: `Cannot activate staff with status: ${existingStaff.status}` });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.ACTIVATE,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				staffId: input.staffId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to activate staff' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Suspend a staff member (emergency)
	 */
	suspend: authedProcedure
		.input(
			z.object({
				staffId: z.string(),
				reason: z.string().min(1).max(1000),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema,
					escalatedCaseCount: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to suspend staff' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			if (existingStaff.status === StaffStatus.SUSPENDED || existingStaff.status === StaffStatus.DEACTIVATED) {
				throw errors.BAD_REQUEST({ message: `Cannot suspend staff with status: ${existingStaff.status}` });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.SUSPEND,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				staffId: input.staffId,
				data: {
					reason: input.reason
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to suspend staff' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					},
					escalatedCaseCount: result.escalatedCaseCount ?? 0
				},
				context
			);
		}),

	/**
	 * Deactivate a staff member (normal offboarding)
	 */
	deactivate: authedProcedure
		.input(
			z.object({
				staffId: z.string(),
				reason: z.string().min(1).max(1000),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema,
					activeCaseCount: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to deactivate staff' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId },
				include: {
					assignedCases: {
						where: { unassignedAt: null }
					}
				}
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			if (existingStaff.status === StaffStatus.DEACTIVATED) {
				throw errors.BAD_REQUEST({ message: 'Staff is already deactivated' });
			}

			// Check for active cases - must be reassigned first
			const activeCaseCount = existingStaff.assignedCases.length;
			if (activeCaseCount > 0) {
				throw errors.BAD_REQUEST({
					message: `Cannot deactivate staff with ${activeCaseCount} active case(s). Reassign cases first.`
				});
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.DEACTIVATE,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				staffId: input.staffId,
				data: {
					reason: input.reason
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to deactivate staff' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					},
					activeCaseCount
				},
				context
			);
		}),

	/**
	 * Reactivate a suspended or deactivated staff member
	 */
	reactivate: authedProcedure
		.input(
			z.object({
				staffId: z.string(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to reactivate staff' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			if (existingStaff.status === StaffStatus.ACTIVE) {
				throw errors.BAD_REQUEST({ message: 'Staff is already active' });
			}

			if (existingStaff.status === StaffStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: 'Use activate endpoint for pending staff' });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.REACTIVATE,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				staffId: input.staffId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to reactivate staff' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Update staff roles
	 */
	updateRoles: authedProcedure
		.input(
			z.object({
				staffId: z.string(),
				roles: z.array(StaffRoleSchema).min(1),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to update staff roles' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.UPDATE_ROLES,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				staffId: input.staffId,
				data: {
					roles: input.roles
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update staff roles' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Update staff pillar access
	 */
	updatePillarAccess: authedProcedure
		.input(
			z.object({
				staffId: z.string(),
				pillarAccess: z.array(PillarAccessSchema).min(1),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: StaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to update staff pillar access' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.UPDATE_PILLAR_ACCESS,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				staffId: input.staffId,
				data: {
					pillarAccess: input.pillarAccess
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update staff pillar access' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Get active case assignments for a staff member
	 */
	getAssignments: authedProcedure
		.input(
			z.object({
				staffId: z.string(),
				includeUnassigned: z.boolean().default(false)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					assignments: z.array(
						z.object({
							id: z.string(),
							caseId: z.string(),
							isPrimary: z.boolean(),
							assignedAt: z.string(),
							unassignedAt: z.string().nullable(),
							justification: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const staff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!staff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			const where: Record<string, unknown> = { staffId: input.staffId };
			if (!input.includeUnassigned) {
				where.unassignedAt = null;
			}

			const assignments = await prisma.staffCaseAssignment.findMany({
				where,
				orderBy: { assignedAt: 'desc' }
			});

			return successResponse(
				{
					assignments: assignments.map((a) => ({
						id: a.id,
						caseId: a.caseId,
						isPrimary: a.isPrimary,
						assignedAt: a.assignedAt.toISOString(),
						unassignedAt: a.unassignedAt?.toISOString() ?? null,
						justification: a.justification
					}))
				},
				context
			);
		}),

	/**
	 * Regenerate activation code for pending staff (Admin only)
	 */
	regenerateActivationCode: authedProcedure
		.input(
			z.object({
				staffId: z.string(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					activationCode: z.string(),
					expiresAt: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to regenerate activation code' }
		})
		.handler(async ({ input, context, errors }) => {
			const staff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!staff) {
				throw errors.NOT_FOUND({ message: 'Staff' });
			}

			if (staff.status !== StaffStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: 'Can only regenerate code for PENDING staff' });
			}

			const activationCode = generateActivationCode();
			const activationCodeEncrypted = encrypt(activationCode);
			const activationCodeExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.REGENERATE_ACTIVATION_CODE,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				staffId: input.staffId,
				data: {
					activationCodeEncrypted,
					activationCodeExpiresAt
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to regenerate activation code' });
			}

			return successResponse(
				{
					activationCode,
					expiresAt: activationCodeExpiresAt.toISOString()
				},
				context
			);
		}),

	/**
	 * Activate account with code (Self-service)
	 */
	activateWithCode: authedProcedure
		.input(
			z.object({
				code: z.string().length(8),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Forbidden' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to activate account' }
		})
		.handler(async ({ input, context, errors }) => {
			// Get current user's staff profile
			const staff = await prisma.staff.findUnique({
				where: { userId: context.user!.id }
			});

			if (!staff) {
				throw errors.FORBIDDEN({ message: 'Not a staff member' });
			}

			if (staff.status === StaffStatus.ACTIVE) {
				return successResponse({ success: true }, context);
			}

			if (staff.status !== StaffStatus.PENDING) {
				throw errors.FORBIDDEN({ message: 'Account cannot be activated' });
			}

			if (!staff.activationCodeEncrypted || !staff.activationCodeExpiresAt) {
				throw errors.BAD_REQUEST({ message: 'No activation code found. Ask admin to regenerate.' });
			}

			if (staff.activationCodeExpiresAt < new Date()) {
				throw errors.BAD_REQUEST({ message: 'Activation code expired. Ask admin to regenerate.' });
			}

			// Verify code
			try {
				const plainCode = decrypt(staff.activationCodeEncrypted);
				if (plainCode !== input.code.toUpperCase()) { // Case insensitive check
					throw errors.BAD_REQUEST({ message: 'Invalid activation code' });
				}
			} catch (e) {
				const errorObj = e instanceof Error ? e : new Error(String(e));
				log.error('Decryption failed during activation', { error: e });

				// Record error on span for trace visibility
				await recordSpanError(errorObj, {
					errorCode: 'ACTIVATION_FAILED',
					errorType: SpanErrorType.STAFF_ACTIVATION_ERROR
				});

				throw errors.BAD_REQUEST({ message: 'Invalid activation code' });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.ACTIVATE_WITH_CODE,
				organizationId: 'hestami-platform',
				userId: context.user!.id,
				staffId: staff.id,
				data: {
					displayName: staff.displayName
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to activate account' });
			}

			return successResponse({ success: true }, context);
		})
};

// =============================================================================
// Phase 28: Organization-Scoped Staff Management
// =============================================================================

/**
 * CAM Pillar Restriction:
 * For MANAGEMENT_COMPANY and COMMUNITY_ASSOCIATION organizations,
 * staff can ONLY be granted access to the CAM pillar.
 * This helper validates pillar access requests against org type.
 */
const CAM_ONLY_ORG_TYPES = new Set<OrganizationType>([OrganizationType.MANAGEMENT_COMPANY, OrganizationType.COMMUNITY_ASSOCIATION]);
const ALLOWED_PILLAR_FOR_CAM = PillarAccess.CAM;

function validatePillarAccessForOrgType(
	pillarAccess: string[],
	orgType: string,
	errors: { BAD_REQUEST: (opts: { message: string }) => Error }
): void {
	if (CAM_ONLY_ORG_TYPES.has(orgType as OrganizationType)) {
		const invalidPillars = pillarAccess.filter(p => p !== ALLOWED_PILLAR_FOR_CAM);
		if (invalidPillars.length > 0) {
			throw errors.BAD_REQUEST({
				message: `Organization type ${orgType} only allows CAM pillar access. Invalid pillars: ${invalidPillars.join(', ')}`
			});
		}
	}
}

/**
 * Organization-scoped staff output schema (includes organizationId)
 */
const OrgStaffOutputSchema = z.object({
	id: z.string(),
	userId: z.string(),
	organizationId: z.string(),
	displayName: z.string(),
	title: z.string().nullable(),
	status: StaffStatusSchema,
	roles: z.array(StaffRoleSchema),
	pillarAccess: z.array(PillarAccessSchema),
	canBeAssignedCases: z.boolean(),
	activatedAt: z.string().nullable(),
	suspendedAt: z.string().nullable(),
	deactivatedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	user: z.object({
		id: z.string(),
		email: z.string(),
		name: z.string().nullable()
	}).optional()
});

const OrgStaffListItemSchema = z.object({
	id: z.string(),
	userId: z.string(),
	displayName: z.string(),
	title: z.string().nullable(),
	status: StaffStatusSchema,
	roles: z.array(StaffRoleSchema),
	pillarAccess: z.array(PillarAccessSchema),
	canBeAssignedCases: z.boolean(),
	createdAt: z.string(),
	user: z.object({
		email: z.string(),
		name: z.string().nullable()
	})
});

/**
 * Organization-scoped staff router for CAM Management Companies and Self-Managed Associations.
 * Uses orgProcedure to require organization context.
 */
export const orgStaffRouter = {
	/**
	 * List staff members for the current organization
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				status: StaffStatusSchema.optional(),
				role: StaffRoleSchema.optional(),
				pillar: PillarAccessSchema.optional(),
				search: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: z.array(OrgStaffListItemSchema),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'staff', 'list');

			const take = input.limit ?? 50;
			const where: Record<string, unknown> = {
				organizationId: context.organization.id
			};

			if (input.status) {
				where.status = input.status;
			}

			if (input.role) {
				where.roles = { has: input.role };
			}

			if (input.pillar) {
				where.pillarAccess = { has: input.pillar };
			}

			if (input.search) {
				where.OR = [
					{ displayName: { contains: input.search, mode: 'insensitive' } },
					{ user: { email: { contains: input.search, mode: 'insensitive' } } },
					{ user: { name: { contains: input.search, mode: 'insensitive' } } }
				];
			}

			const staffList = await prisma.staff.findMany({
				where,
				include: {
					user: {
						select: {
							email: true,
							name: true
						}
					}
				},
				orderBy: { createdAt: 'desc' },
				take: take + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = staffList.length > take;
			const items = hasMore ? staffList.slice(0, -1) : staffList;
			const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

			return successResponse(
				{
					staff: items.map((s) => ({
						id: s.id,
						userId: s.userId,
						displayName: s.displayName,
						title: s.title,
						status: s.status,
						roles: s.roles,
						pillarAccess: s.pillarAccess,
						canBeAssignedCases: s.canBeAssignedCases,
						createdAt: s.createdAt.toISOString(),
						user: s.user
					})),
					pagination: { hasMore, nextCursor }
				},
				context
			);
		}),

	/**
	 * Get an organization staff member by ID
	 */
	get: orgProcedure
		.input(z.object({ staffId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: OrgStaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'staff', input.staffId);

			const staff = await prisma.staff.findFirst({
				where: {
					id: input.staffId,
					organizationId: context.organization.id
				},
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			if (!staff) {
				throw errors.NOT_FOUND({ message: 'Staff not found in this organization' });
			}

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						organizationId: staff.organizationId!,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Create a new organization staff member
	 * Enforces CAM-only pillar access for CAM org types
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					email: z.string().email().describe('User email to link as staff'),
					displayName: z.string().min(1).max(255),
					title: z.string().max(255).optional(),
					roles: z.array(StaffRoleSchema).min(1).describe('At least one role required'),
					pillarAccess: z.array(PillarAccessSchema).min(1).describe('Pillar access (CAM only for CAM orgs)'),
					canBeAssignedCases: z.boolean().default(false)
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: OrgStaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'User with this email not found' },
			CONFLICT: { message: 'Staff profile already exists' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to create staff' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'staff', 'new');

			// Validate pillar access against organization type
			validatePillarAccessForOrgType(input.pillarAccess, context.organization.type, errors);

			const user = await prisma.user.findUnique({
				where: { email: input.email }
			});

			if (!user) {
				throw errors.NOT_FOUND({ message: 'User with this email not found' });
			}

			// Check if staff profile already exists for this user in this org
			const existingStaff = await prisma.staff.findFirst({
				where: {
					userId: user.id,
					organizationId: context.organization.id
				}
			});

			if (existingStaff) {
				throw errors.CONFLICT({ message: 'Staff profile already exists for this user in this organization' });
			}

			// Generate activation code
			const activationCode = generateActivationCode();
			const activationCodeEncrypted = encrypt(activationCode);
			const activationCodeExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.CREATE,
				organizationId: context.organization.id,
				userId: context.user!.id,
				data: {
					targetUserId: user.id,
					displayName: input.displayName,
					title: input.title,
					roles: input.roles,
					pillarAccess: input.pillarAccess,
					canBeAssignedCases: input.canBeAssignedCases,
					activationCodeEncrypted,
					activationCodeExpiresAt
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create staff' });
			}

			// Fetch the created staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: result.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			// TODO: Send invitation email when email system is integrated
			log.info('Staff invitation created', {
				staffId: staff.id,
				email: input.email,
				organizationId: context.organization.id
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						organizationId: staff.organizationId!,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Update organization staff member details
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					staffId: z.string(),
					displayName: z.string().min(1).max(255).optional(),
					title: z.string().max(255).nullable().optional(),
					roles: z.array(StaffRoleSchema).optional(),
					pillarAccess: z.array(PillarAccessSchema).optional(),
					canBeAssignedCases: z.boolean().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: OrgStaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to update staff' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'staff', input.staffId);

			// Validate pillar access if being updated
			if (input.pillarAccess) {
				validatePillarAccessForOrgType(input.pillarAccess, context.organization.type, errors);
			}

			const existingStaff = await prisma.staff.findFirst({
				where: {
					id: input.staffId,
					organizationId: context.organization.id
				}
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff not found in this organization' });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.UPDATE,
				organizationId: context.organization.id,
				userId: context.user!.id,
				staffId: input.staffId,
				data: {
					displayName: input.displayName,
					title: input.title,
					roles: input.roles,
					pillarAccess: input.pillarAccess,
					canBeAssignedCases: input.canBeAssignedCases
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update staff' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						organizationId: staff.organizationId!,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Activate a pending organization staff member
	 */
	activate: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					staffId: z.string()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: OrgStaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to activate staff' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'staff', input.staffId);

			const existingStaff = await prisma.staff.findFirst({
				where: {
					id: input.staffId,
					organizationId: context.organization.id
				}
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff not found in this organization' });
			}

			if (existingStaff.status !== StaffStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: `Cannot activate staff with status: ${existingStaff.status}` });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.ACTIVATE,
				organizationId: context.organization.id,
				userId: context.user!.id,
				staffId: input.staffId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to activate staff' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						organizationId: staff.organizationId!,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		}),

	/**
	 * Deactivate an organization staff member
	 */
	deactivate: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					staffId: z.string(),
					reason: z.string().min(1).max(1000)
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					staff: OrgStaffOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Staff not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to deactivate staff' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'staff', input.staffId);

			const existingStaff = await prisma.staff.findFirst({
				where: {
					id: input.staffId,
					organizationId: context.organization.id
				}
			});

			if (!existingStaff) {
				throw errors.NOT_FOUND({ message: 'Staff not found in this organization' });
			}

			if (existingStaff.status === StaffStatus.DEACTIVATED) {
				throw errors.BAD_REQUEST({ message: 'Staff is already deactivated' });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(staffWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: StaffWorkflowAction.DEACTIVATE,
				organizationId: context.organization.id,
				userId: context.user!.id,
				staffId: input.staffId,
				data: {
					reason: input.reason
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to deactivate staff' });
			}

			// Fetch updated staff for response
			const staff = await prisma.staff.findFirstOrThrow({
				where: { id: input.staffId, organizationId: context.organization!.id },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true
						}
					}
				}
			});

			return successResponse(
				{
					staff: {
						id: staff.id,
						userId: staff.userId,
						organizationId: staff.organizationId!,
						displayName: staff.displayName,
						title: staff.title,
						status: staff.status,
						roles: staff.roles,
						pillarAccess: staff.pillarAccess,
						canBeAssignedCases: staff.canBeAssignedCases,
						activatedAt: staff.activatedAt?.toISOString() ?? null,
						suspendedAt: staff.suspendedAt?.toISOString() ?? null,
						deactivatedAt: staff.deactivatedAt?.toISOString() ?? null,
						createdAt: staff.createdAt.toISOString(),
						updatedAt: staff.updatedAt.toISOString(),
						user: staff.user
					}
				},
				context
			);
		})
};

