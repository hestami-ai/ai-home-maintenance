import { z } from 'zod';
import { authedProcedure, orgProcedure, successResponse } from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';

/**
 * Organization management procedures
 */
export const organizationRouter = {
	/**
	 * Create a new organization
	 */
	create: authedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(255),
				slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
				type: z.enum(['COMMUNITY_ASSOCIATION', 'MANAGEMENT_COMPANY', 'SERVICE_PROVIDER', 'INDIVIDUAL_CONCIERGE', 'COMMERCIAL_CLIENT'])
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
						status: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Check if slug is already taken
			const existing = await prisma.organization.findUnique({
				where: { slug: input.slug }
			});

			if (existing) {
				throw ApiException.conflict('Organization with this slug already exists');
			}

			// Create organization and add creator as ADMIN
			const organization = await prisma.organization.create({
				data: {
					name: input.name,
					slug: input.slug,
					type: input.type,
					memberships: {
						create: {
							userId: context.user!.id,
							role: 'ADMIN',
							isDefault: true
						}
					}
				}
			});

			return successResponse(
				{
					organization: {
						id: organization.id,
						name: organization.name,
						slug: organization.slug,
						type: organization.type,
						status: organization.status
					}
				},
				context
			);
		}),

	/**
	 * List organizations the current user belongs to
	 */
	list: authedProcedure
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					organizations: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							slug: z.string(),
							type: z.string(),
							role: z.string(),
							isDefault: z.boolean()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ context }) => {
			const memberships = await prisma.userOrganization.findMany({
				where: { userId: context.user!.id, organization: { deletedAt: null } },
				include: { organization: true },
				orderBy: { organization: { name: 'asc' } }
			});

			return successResponse(
				{
					organizations: memberships
						.filter((m) => m.organization.deletedAt === null)
						.map((m) => ({
							id: m.organization.id,
							name: m.organization.name,
							slug: m.organization.slug,
							type: m.organization.type,
							role: m.role,
							isDefault: m.isDefault
						}))
				},
				context
			);
		}),

	/**
	 * Get current organization context details
	 */
	current: orgProcedure
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					organization: z.object({
						id: z.string(),
						name: z.string(),
						slug: z.string(),
						type: z.string(),
						status: z.string()
					}),
					role: z.string()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ context }) => {
			return successResponse(
				{
					organization: {
						id: context.organization!.id,
						name: context.organization!.name,
						slug: context.organization!.slug,
						type: context.organization!.type,
						status: context.organization!.status
					},
					role: context.role!
				},
				context
			);
		}),

	/**
	 * Set default organization for user
	 */
	setDefault: authedProcedure
		.input(
			z.object({
				organizationId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Verify user has access to this organization
			const membership = await prisma.userOrganization.findUnique({
				where: {
					userId_organizationId: {
						userId: context.user!.id,
						organizationId: input.organizationId
					}
				}
			});

			if (!membership) {
				throw ApiException.forbidden('You do not have access to this organization');
			}

			// Clear existing default and set new one
			await prisma.$transaction([
				prisma.userOrganization.updateMany({
					where: { userId: context.user!.id, isDefault: true },
					data: { isDefault: false }
				}),
				prisma.userOrganization.update({
					where: { id: membership.id },
					data: { isDefault: true }
				})
			]);

			return successResponse({ success: true }, context);
		}),

	/**
	 * Get organization by ID (requires membership)
	 */
	get: authedProcedure
		.input(
			z.object({
				organizationId: z.string()
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
						settings: z.record(z.string(), z.unknown())
					}),
					membership: z.object({
						role: z.string(),
						isDefault: z.boolean(),
						joinedAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const membership = await prisma.userOrganization.findUnique({
				where: {
					userId_organizationId: {
						userId: context.user!.id,
						organizationId: input.organizationId
					}
				},
				include: { organization: true }
			});

			if (!membership) {
				throw ApiException.notFound('Organization');
			}

			return successResponse(
				{
					organization: {
						id: membership.organization.id,
						name: membership.organization.name,
						slug: membership.organization.slug,
						type: membership.organization.type,
						status: membership.organization.status,
						settings: membership.organization.settings as Record<string, unknown>
					},
					membership: {
						role: membership.role,
						isDefault: membership.isDefault,
						joinedAt: membership.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Update organization details (requires ADMIN role)
	 */
	update: orgProcedure
		.input(
			z.object({
				name: z.string().min(1).max(255).optional(),
				settings: z.record(z.string(), z.unknown()).optional()
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
						status: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('edit', 'organization', context.organization!.id);

			const organization = await prisma.organization.update({
				where: { id: context.organization!.id },
				data: {
					...(input.name && { name: input.name }),
					...(input.settings && { settings: input.settings as Prisma.InputJsonValue })
				}
			});

			return successResponse(
				{
					organization: {
						id: organization.id,
						name: organization.name,
						slug: organization.slug,
						type: organization.type,
						status: organization.status
					}
				},
				context
			);
		}),

	/**
	 * Soft delete organization (requires ADMIN role)
	 */
	delete: orgProcedure
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean(),
					deletedAt: z.string()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('delete', 'organization', context.organization!.id);

			const now = new Date();
			await prisma.organization.update({
				where: { id: context.organization!.id },
				data: { deletedAt: now }
			});

			return successResponse(
				{
					success: true,
					deletedAt: now.toISOString()
				},
				context
			);
		})
};
