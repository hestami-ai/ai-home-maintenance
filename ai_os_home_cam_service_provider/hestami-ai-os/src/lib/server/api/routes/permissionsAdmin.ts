import { z } from 'zod';
import {
	ResponseMetaSchema,
	OrganizationTypeSchema,
	OrganizationStatusSchema,
	UserRoleSchema,
	ActivityEntityTypeSchema,
	ActivityActionTypeSchema,
	type ActivityEntityType,
	type ActivityActionType
} from '$lib/schemas/index.js';
import {
	authedProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../router.js';
import { prisma } from '../../db.js';
import { buildPrincipal, requireAuthorization, createResource } from '../../cerbos/index.js';
import { createModuleLogger } from '../../logger.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';

const log = createModuleLogger('PermissionsAdminRoute');

/**
 * Permissions Admin Router
 * 
 * Staff-only endpoints for cross-org permission visibility and audit.
 * Uses authedProcedure (not orgProcedure) for cross-org access.
 */
export const permissionsAdminRouter = {
	/**
	 * Get permission statistics for dashboard
	 */
	getStats: authedProcedure
		.errors({
			FORBIDDEN: { message: 'Staff access required' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					totalOrganizations: z.number(),
					activeOrganizations: z.number(),
					totalUsers: z.number(),
					totalMemberships: z.number(),
					roleDistribution: z.array(z.object({
						role: z.string(),
						count: z.number()
					})),
					organizationTypeDistribution: z.array(z.object({
						type: z.string(),
						count: z.number()
					}))
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ context, errors }) => {
			// Verify staff access
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('permissions_admin', 'stats', 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			// Get organization counts
			const [totalOrgs, activeOrgs] = await Promise.all([
				prisma.organization.count({ where: { deletedAt: null } }),
				prisma.organization.count({ where: { deletedAt: null, status: 'ACTIVE' } })
			]);

			// Get user and membership counts
			const [totalUsers, totalMemberships] = await Promise.all([
				prisma.user.count(),
				prisma.userOrganization.count()
			]);

			// Get role distribution
			const roleDistribution = await prisma.userOrganization.groupBy({
				by: ['role'],
				_count: { role: true }
			});

			// Get organization type distribution
			const orgTypeDistribution = await prisma.organization.groupBy({
				by: ['type'],
				where: { deletedAt: null },
				_count: { type: true }
			});

			return successResponse(
				{
					totalOrganizations: totalOrgs,
					activeOrganizations: activeOrgs,
					totalUsers,
					totalMemberships,
					roleDistribution: roleDistribution.map(r => ({
						role: r.role,
						count: r._count.role
					})),
					organizationTypeDistribution: orgTypeDistribution.map(o => ({
						type: o.type,
						count: o._count.type
					}))
				},
				context
			);
		}),

	/**
	 * List all organizations with member counts (staff cross-org view)
	 */
	listOrganizations: authedProcedure
		.errors({
			FORBIDDEN: { message: 'Staff access required' }
		})
		.input(
			PaginationInputSchema.extend({
				type: OrganizationTypeSchema.optional(),
				status: OrganizationStatusSchema.optional(),
				search: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					organizations: z.array(z.object({
						id: z.string(),
						name: z.string(),
						slug: z.string(),
						type: z.string(),
						status: z.string(),
						memberCount: z.number(),
						adminCount: z.number(),
						createdAt: z.string()
					})),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Verify staff access
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('permissions_admin', 'organizations', 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			const limit = input.limit ?? 20;
			const where = {
				deletedAt: null,
				...(input.type && { type: input.type }),
				...(input.status && { status: input.status }),
				...(input.search && {
					OR: [
						{ name: { contains: input.search, mode: 'insensitive' as const } },
						{ slug: { contains: input.search, mode: 'insensitive' as const } }
					]
				})
			};

			const organizations = await prisma.organization.findMany({
				where,
				include: {
					_count: {
						select: { memberships: true }
					},
					memberships: {
						where: { role: 'ADMIN' },
						select: { id: true }
					}
				},
				orderBy: { name: 'asc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = organizations.length > limit;
			const items = hasMore ? organizations.slice(0, -1) : organizations;

			return successResponse(
				{
					organizations: items.map(org => ({
						id: org.id,
						name: org.name,
						slug: org.slug,
						type: org.type,
						status: org.status,
						memberCount: org._count.memberships,
						adminCount: org.memberships.length,
						createdAt: org.createdAt.toISOString()
					})),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Get organization detail with member roles
	 */
	getOrganization: authedProcedure
		.errors({
			FORBIDDEN: { message: 'Staff access required' },
			NOT_FOUND: { message: 'Organization not found' }
		})
		.input(
			z.object({
				organizationId: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					organization: z.object({
						id: z.string(),
						name: z.string(),
						slug: z.string(),
						type: z.string(),
						status: z.string(),
						createdAt: z.string(),
						settings: z.record(z.string(), z.unknown())
					}),
					members: z.array(z.object({
						id: z.string(),
						userId: z.string(),
						userName: z.string().nullable(),
						userEmail: z.string(),
						role: z.string(),
						isDefault: z.boolean(),
						joinedAt: z.string()
					})),
					roleDistribution: z.array(z.object({
						role: z.string(),
						count: z.number()
					}))
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Verify staff access
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('permissions_admin', input.organizationId, 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			const organization = await prisma.organization.findUnique({
				where: { id: input.organizationId, deletedAt: null },
				include: {
					memberships: {
						include: {
							user: {
								select: { id: true, name: true, email: true }
							}
						},
						orderBy: { createdAt: 'desc' }
					}
				}
			});

			if (!organization) {
				throw errors.NOT_FOUND({ message: 'Organization not found' });
			}

			// Calculate role distribution
			const roleDistribution = organization.memberships.reduce((acc, m) => {
				const existing = acc.find(r => r.role === m.role);
				if (existing) {
					existing.count++;
				} else {
					acc.push({ role: m.role, count: 1 });
				}
				return acc;
			}, [] as { role: string; count: number }[]);

			return successResponse(
				{
					organization: {
						id: organization.id,
						name: organization.name,
						slug: organization.slug,
						type: organization.type,
						status: organization.status,
						createdAt: organization.createdAt.toISOString(),
						settings: organization.settings as Record<string, unknown>
					},
					members: organization.memberships.map(m => ({
						id: m.id,
						userId: m.userId,
						userName: m.user.name,
						userEmail: m.user.email,
						role: m.role,
						isDefault: m.isDefault,
						joinedAt: m.createdAt.toISOString()
					})),
					roleDistribution
				},
				context
			);
		}),

	/**
	 * Get recent permission changes (audit log)
	 */
	getAuditLog: authedProcedure
		.errors({
			FORBIDDEN: { message: 'Staff access required' }
		})
		.input(
			PaginationInputSchema.extend({
				organizationId: z.string().uuid().optional(),
				actorId: z.string().uuid().optional(),
				targetUserId: z.string().uuid().optional(),
				startDate: z.string().datetime().optional(),
				endDate: z.string().datetime().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(z.object({
						id: z.string(),
						timestamp: z.string(),
						actorId: z.string().nullable(),
						actorName: z.string().nullable(),
						actorType: z.string(),
						action: z.string(),
						entityType: z.string(),
						entityId: z.string(),
						summary: z.string(),
						organizationId: z.string(),
						organizationName: z.string().nullable(),
						previousState: z.record(z.string(), z.unknown()).nullable(),
						newState: z.record(z.string(), z.unknown()).nullable()
					})),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Verify staff access
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('permissions_admin', 'audit', 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			const limit = input.limit ?? 50;
			
			// Filter for permission-related events
			const permissionEntityTypes: ActivityEntityType[] = ['USER', 'USER_ROLE', 'ORGANIZATION', 'STAFF', 'STAFF_ASSIGNMENT'];
			const permissionActions: ActivityActionType[] = ['CREATE', 'UPDATE', 'DELETE', 'ROLE_CHANGE', 'ASSIGN', 'UNASSIGN'];

			const where: Prisma.ActivityEventWhereInput = {
				entityType: { in: permissionEntityTypes },
				action: { in: permissionActions },
				...(input.organizationId && { organizationId: input.organizationId }),
				...(input.actorId && { performedById: input.actorId }),
				...(input.targetUserId && { entityId: input.targetUserId }),
				...(input.startDate || input.endDate
					? {
						performedAt: {
							...(input.startDate && { gte: new Date(input.startDate) }),
							...(input.endDate && { lte: new Date(input.endDate) })
						}
					}
					: {})
			};

			const events = await prisma.activityEvent.findMany({
				where,
				orderBy: { performedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = events.length > limit;
			const items = hasMore ? events.slice(0, -1) : events;

			// Get actor names for events
			const actorIds = [...new Set(items.filter(e => e.performedById).map(e => e.performedById!))];
			const actors = actorIds.length > 0
				? await prisma.user.findMany({
					where: { id: { in: actorIds } },
					select: { id: true, name: true, email: true }
				})
				: [];
			const actorMap = new Map(actors.map(a => [a.id, a.name || a.email]));

			// Get organization names
			const orgIds = [...new Set(items.map(e => e.organizationId))];
			const orgs = orgIds.length > 0
				? await prisma.organization.findMany({
					where: { id: { in: orgIds } },
					select: { id: true, name: true }
				})
				: [];
			const orgMap = new Map(orgs.map(o => [o.id, o.name]));

			return successResponse(
				{
					events: items.map(e => ({
						id: e.id,
						timestamp: e.performedAt.toISOString(),
						actorId: e.performedById,
						actorName: e.performedById ? actorMap.get(e.performedById) ?? null : null,
						actorType: e.performedByType,
						action: e.action,
						entityType: e.entityType,
						entityId: e.entityId,
						summary: e.summary,
						organizationId: e.organizationId,
						organizationName: orgMap.get(e.organizationId) ?? null,
						previousState: e.previousState as Record<string, unknown> | null,
						newState: e.newState as Record<string, unknown> | null
					})),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Get recent permission changes for dashboard (last N changes)
	 */
	getRecentChanges: authedProcedure
		.errors({
			FORBIDDEN: { message: 'Staff access required' }
		})
		.input(
			z.object({
				limit: z.number().int().min(1).max(50).default(10)
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					changes: z.array(z.object({
						id: z.string(),
						timestamp: z.string(),
						actorName: z.string().nullable(),
						action: z.string(),
						entityType: z.string(),
						summary: z.string(),
						organizationName: z.string().nullable()
					}))
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Verify staff access
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('permissions_admin', 'recent', 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			const limit = input?.limit ?? 10;
			
			// Filter for permission-related events
			const permissionEntityTypes: ActivityEntityType[] = ['USER', 'USER_ROLE', 'ORGANIZATION', 'STAFF', 'STAFF_ASSIGNMENT'];
			const permissionActions: ActivityActionType[] = ['CREATE', 'UPDATE', 'DELETE', 'ROLE_CHANGE', 'ASSIGN', 'UNASSIGN'];

			const events = await prisma.activityEvent.findMany({
				where: {
					entityType: { in: permissionEntityTypes },
					action: { in: permissionActions }
				},
				orderBy: { performedAt: 'desc' },
				take: limit
			});

			// Get actor names
			const actorIds = [...new Set(events.filter(e => e.performedById).map(e => e.performedById!))];
			const actors = actorIds.length > 0
				? await prisma.user.findMany({
					where: { id: { in: actorIds } },
					select: { id: true, name: true, email: true }
				})
				: [];
			const actorMap = new Map(actors.map(a => [a.id, a.name || a.email]));

			// Get organization names
			const orgIds = [...new Set(events.map(e => e.organizationId))];
			const orgs = orgIds.length > 0
				? await prisma.organization.findMany({
					where: { id: { in: orgIds } },
					select: { id: true, name: true }
				})
				: [];
			const orgMap = new Map(orgs.map(o => [o.id, o.name]));

			return successResponse(
				{
					changes: events.map(e => ({
						id: e.id,
						timestamp: e.performedAt.toISOString(),
						actorName: e.performedById ? actorMap.get(e.performedById) ?? null : null,
						action: e.action,
						entityType: e.entityType,
						summary: e.summary,
						organizationName: orgMap.get(e.organizationId) ?? null
					}))
				},
				context
			);
		})
};
