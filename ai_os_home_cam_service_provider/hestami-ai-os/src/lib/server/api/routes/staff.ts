/**
 * Phase 16: Staff Management Routes
 * 
 * Provides CRUD operations for Hestami internal staff entities.
 * Staff entities persist indefinitely for audit purposes.
 */

import { z } from 'zod';
import { ResponseMetaSchema } from '../schemas.js';
import { authedProcedure, orgProcedure, successResponse, IdempotencyKeySchema } from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';
import { recordActivityEvent } from '../middleware/activityEvent.js';
import { StaffStatusSchema, StaffRoleSchema, PillarAccessSchema } from '../../../../../generated/zod/index.js';
import { createModuleLogger } from '../../logger.js';

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
				userId: z.string().describe('User ID to link as staff'),
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
		.handler(async ({ input, context }) => {
			// Verify the user exists
			const user = await prisma.user.findUnique({
				where: { id: input.userId }
			});

			if (!user) {
				throw ApiException.notFound('User');
			}

			// Check if staff profile already exists for this user
			const existingStaff = await prisma.staff.findUnique({
				where: { userId: input.userId }
			});

			if (existingStaff) {
				throw ApiException.conflict('Staff profile already exists for this user');
			}

			// Create staff entity
			const staff = await prisma.staff.create({
				data: {
					userId: input.userId,
					displayName: input.displayName,
					title: input.title,
					roles: input.roles,
					pillarAccess: input.pillarAccess,
					canBeAssignedCases: input.canBeAssignedCases,
					status: 'PENDING'
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

			// Record activity event
			await recordActivityEvent({
				organizationId: 'hestami-platform', // Platform-level entity
				entityType: 'STAFF',
				entityId: staff.id,
				action: 'CREATE',
				eventCategory: 'EXECUTION',
				summary: `Staff member "${staff.displayName}" created with roles: ${input.roles.join(', ')}`,
				performedById: context.user!.id,
				performedByType: 'HUMAN',
				newState: {
					id: staff.id,
					userId: staff.userId,
					displayName: staff.displayName,
					roles: staff.roles,
					pillarAccess: staff.pillarAccess,
					status: staff.status
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
		.handler(async ({ input, context }) => {
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
				throw ApiException.notFound('Staff');
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
		.handler(async ({ input, context }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw ApiException.notFound('Staff');
			}

			const previousState = {
				displayName: existingStaff.displayName,
				title: existingStaff.title,
				canBeAssignedCases: existingStaff.canBeAssignedCases
			};

			const staff = await prisma.staff.update({
				where: { id: input.staffId },
				data: {
					...(input.displayName && { displayName: input.displayName }),
					...(input.title !== undefined && { title: input.title }),
					...(input.canBeAssignedCases !== undefined && { canBeAssignedCases: input.canBeAssignedCases })
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

			// Record activity event
			await recordActivityEvent({
				organizationId: 'hestami-platform',
				entityType: 'STAFF',
				entityId: staff.id,
				action: 'UPDATE',
				eventCategory: 'EXECUTION',
				summary: `Staff member "${staff.displayName}" updated`,
				performedById: context.user!.id,
				performedByType: 'HUMAN',
				previousState,
				newState: {
					displayName: staff.displayName,
					title: staff.title,
					canBeAssignedCases: staff.canBeAssignedCases
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
		.handler(async ({ input, context }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw ApiException.notFound('Staff');
			}

			if (existingStaff.status !== 'PENDING') {
				throw ApiException.badRequest(`Cannot activate staff with status: ${existingStaff.status}`);
			}

			const now = new Date();
			const staff = await prisma.staff.update({
				where: { id: input.staffId },
				data: {
					status: 'ACTIVE',
					activatedAt: now
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

			// Record activity event
			await recordActivityEvent({
				organizationId: 'hestami-platform',
				entityType: 'STAFF',
				entityId: staff.id,
				action: 'STATUS_CHANGE',
				eventCategory: 'EXECUTION',
				summary: `Staff member "${staff.displayName}" activated`,
				performedById: context.user!.id,
				performedByType: 'HUMAN',
				previousState: { status: 'PENDING' },
				newState: { status: 'ACTIVE', activatedAt: now.toISOString() }
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
		.handler(async ({ input, context }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId },
				include: {
					assignedCases: {
						where: { unassignedAt: null }
					}
				}
			});

			if (!existingStaff) {
				throw ApiException.notFound('Staff');
			}

			if (existingStaff.status === 'SUSPENDED' || existingStaff.status === 'DEACTIVATED') {
				throw ApiException.badRequest(`Cannot suspend staff with status: ${existingStaff.status}`);
			}

			const previousStatus = existingStaff.status;
			const now = new Date();

			// Suspend staff and unassign all cases
			const [staff] = await prisma.$transaction([
				prisma.staff.update({
					where: { id: input.staffId },
					data: {
						status: 'SUSPENDED',
						suspendedAt: now,
						suspensionReason: input.reason
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
				}),
				// Mark all active assignments as unassigned
				prisma.staffCaseAssignment.updateMany({
					where: {
						staffId: input.staffId,
						unassignedAt: null
					},
					data: {
						unassignedAt: now,
						justification: `Staff suspended: ${input.reason}`
					}
				})
			]);

			const escalatedCaseCount = existingStaff.assignedCases.length;

			// Record activity event
			await recordActivityEvent({
				organizationId: 'hestami-platform',
				entityType: 'STAFF',
				entityId: staff.id,
				action: 'STATUS_CHANGE',
				eventCategory: 'EXECUTION',
				summary: `Staff member "${staff.displayName}" suspended. Reason: ${input.reason}. ${escalatedCaseCount} cases escalated.`,
				performedById: context.user!.id,
				performedByType: 'HUMAN',
				previousState: { status: previousStatus },
				newState: {
					status: 'SUSPENDED',
					suspendedAt: now.toISOString(),
					suspensionReason: input.reason,
					escalatedCaseCount
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
					escalatedCaseCount
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
		.handler(async ({ input, context }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId },
				include: {
					assignedCases: {
						where: { unassignedAt: null }
					}
				}
			});

			if (!existingStaff) {
				throw ApiException.notFound('Staff');
			}

			if (existingStaff.status === 'DEACTIVATED') {
				throw ApiException.badRequest('Staff is already deactivated');
			}

			// Check for active cases - must be reassigned first
			const activeCaseCount = existingStaff.assignedCases.length;
			if (activeCaseCount > 0) {
				throw ApiException.badRequest(
					`Cannot deactivate staff with ${activeCaseCount} active case(s). Reassign cases first.`
				);
			}

			const previousStatus = existingStaff.status;
			const now = new Date();

			const staff = await prisma.staff.update({
				where: { id: input.staffId },
				data: {
					status: 'DEACTIVATED',
					deactivatedAt: now,
					deactivationReason: input.reason,
					canBeAssignedCases: false
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

			// Record activity event
			await recordActivityEvent({
				organizationId: 'hestami-platform',
				entityType: 'STAFF',
				entityId: staff.id,
				action: 'STATUS_CHANGE',
				eventCategory: 'EXECUTION',
				summary: `Staff member "${staff.displayName}" deactivated. Reason: ${input.reason}`,
				performedById: context.user!.id,
				performedByType: 'HUMAN',
				previousState: { status: previousStatus },
				newState: {
					status: 'DEACTIVATED',
					deactivatedAt: now.toISOString(),
					deactivationReason: input.reason
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
		.handler(async ({ input, context }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw ApiException.notFound('Staff');
			}

			if (existingStaff.status === 'ACTIVE') {
				throw ApiException.badRequest('Staff is already active');
			}

			if (existingStaff.status === 'PENDING') {
				throw ApiException.badRequest('Use activate endpoint for pending staff');
			}

			const previousStatus = existingStaff.status;

			const staff = await prisma.staff.update({
				where: { id: input.staffId },
				data: {
					status: 'ACTIVE',
					canBeAssignedCases: true
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

			// Record activity event
			await recordActivityEvent({
				organizationId: 'hestami-platform',
				entityType: 'STAFF',
				entityId: staff.id,
				action: 'STATUS_CHANGE',
				eventCategory: 'EXECUTION',
				summary: `Staff member "${staff.displayName}" reactivated from ${previousStatus}`,
				performedById: context.user!.id,
				performedByType: 'HUMAN',
				previousState: { status: previousStatus },
				newState: { status: 'ACTIVE' }
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
		.handler(async ({ input, context }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw ApiException.notFound('Staff');
			}

			const previousRoles = existingStaff.roles;

			const staff = await prisma.staff.update({
				where: { id: input.staffId },
				data: {
					roles: input.roles
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

			// Record activity event
			await recordActivityEvent({
				organizationId: 'hestami-platform',
				entityType: 'STAFF',
				entityId: staff.id,
				action: 'ROLE_CHANGE',
				eventCategory: 'EXECUTION',
				summary: `Staff member "${staff.displayName}" roles updated: ${previousRoles.join(', ')} → ${input.roles.join(', ')}`,
				performedById: context.user!.id,
				performedByType: 'HUMAN',
				previousState: { roles: previousRoles },
				newState: { roles: input.roles }
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
		.handler(async ({ input, context }) => {
			const existingStaff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!existingStaff) {
				throw ApiException.notFound('Staff');
			}

			const previousPillarAccess = existingStaff.pillarAccess;

			const staff = await prisma.staff.update({
				where: { id: input.staffId },
				data: {
					pillarAccess: input.pillarAccess
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

			// Record activity event
			await recordActivityEvent({
				organizationId: 'hestami-platform',
				entityType: 'STAFF',
				entityId: staff.id,
				action: 'UPDATE',
				eventCategory: 'EXECUTION',
				summary: `Staff member "${staff.displayName}" pillar access updated: ${previousPillarAccess.join(', ')} → ${input.pillarAccess.join(', ')}`,
				performedById: context.user!.id,
				performedByType: 'HUMAN',
				previousState: { pillarAccess: previousPillarAccess },
				newState: { pillarAccess: input.pillarAccess }
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
		.handler(async ({ input, context }) => {
			const staff = await prisma.staff.findUnique({
				where: { id: input.staffId }
			});

			if (!staff) {
				throw ApiException.notFound('Staff');
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
		})
};
