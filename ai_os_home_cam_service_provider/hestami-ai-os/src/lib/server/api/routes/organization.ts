import { z } from 'zod';
import { ResponseMetaSchema, OrganizationTypeSchema, OrganizationStatusSchema } from '$lib/schemas/index.js';
import { authedProcedure, orgProcedure, successResponse, IdempotencyKeySchema } from '../router.js';
import { prisma } from '../../db.js';
import type { Prisma, OrganizationType, OrganizationStatus } from '../../../../../generated/prisma/client.js';
import { recordActivityEvent, recordActivityFromContext, recordWorkflowEvent } from '../middleware/activityEvent.js';
import { createModuleLogger } from '../../logger.js';
import { setOrgContext } from '../../db/rls.js';
import { startOrganizationWorkflow } from '../../workflows/index.js';

/**
 * Result type for the create_organization_with_admin SECURITY DEFINER function
 */
interface CreateOrgResult {
	id: string;
	name: string;
	slug: string;
	type: string;
	status: string;
	created_at: Date;
	updated_at: Date;
}

const log = createModuleLogger('OrganizationRoute');

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
                idempotencyKey: z.string().uuid(),
                name: z.string().min(1).max(255),
				slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
				type: OrganizationTypeSchema,
				// Optional association config for self-managed HOAs (COMMUNITY_ASSOCIATION)
				associationConfig: z.object({
					legalName: z.string().max(255).optional(),
					boardSeats: z.number().int().min(1).max(20).optional(),
					totalUnits: z.number().int().min(1).optional(),
					fiscalYearEndMonth: z.number().int().min(1).max(12).optional()
				}).optional()
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
						type: OrganizationTypeSchema,
						status: OrganizationStatusSchema
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			CONFLICT: { message: 'Organization with this slug already exists' },
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
		.handler(async ({ input, context, errors }) => {
			// Check if slug is already taken
			const existing = await prisma.organization.findUnique({
				where: { slug: input.slug }
			});

			if (existing) {
				throw errors.CONFLICT({ message: 'Organization with this slug already exists' });
			}

			// Create organization and add creator as ADMIN via workflow
			const createResult = await startOrganizationWorkflow(
				{
					action: 'CREATE_WITH_ADMIN',
					userId: context.user!.id,
					data: {
						name: input.name,
						slug: input.slug,
						type: input.type
					}
				},
				input.idempotencyKey
			);

			if (!createResult.success || !createResult.organizationId) {
				throw errors.INTERNAL_SERVER_ERROR({ message: createResult.error || 'Failed to create organization' });
			}

			// Map to expected shape
			const organization = {
				id: createResult.organizationId,
				name: input.name,
				slug: input.slug,
				type: createResult.organizationType as OrganizationType,
				status: createResult.organizationStatus as OrganizationStatus
			};

			// Record activity event for organization creation
			// Use recordWorkflowEvent which bypasses RLS via SECURITY DEFINER function
			// This is necessary because the user doesn't have RLS access to the new org yet
			await recordWorkflowEvent({
				organizationId: organization.id,
				entityType: 'ORGANIZATION',
				entityId: organization.id,
				action: 'CREATE',
				eventCategory: 'EXECUTION',
				summary: `Organization "${organization.name}" created (${organization.type})`,
				performedById: context.user!.id,
				performedByType: 'HUMAN',
				workflowId: input.idempotencyKey,
				workflowStep: 'organization_created',
				newState: {
					name: organization.name,
					slug: organization.slug,
					type: organization.type,
					status: organization.status
				}
			});

			// Set org context to the newly created org so subsequent RLS-protected queries work
			await setOrgContext(organization.id, {
				userId: context.user!.id,
				reason: 'Organization creation - setting initial context'
			});

			// For self-managed HOAs (COMMUNITY_ASSOCIATION), auto-create the association
			if (organization.type === 'COMMUNITY_ASSOCIATION') {
				const assocResult = await startOrganizationWorkflow(
					{
						action: 'CREATE_ASSOCIATION',
						userId: context.user!.id,
						organizationId: organization.id,
						data: {
							name: organization.name,
							associationName: organization.name,
							legalName: input.associationConfig?.legalName ?? null,
							boardSeats: input.associationConfig?.boardSeats ?? 5,
							totalUnits: input.associationConfig?.totalUnits ?? 0,
							fiscalYearEndMonth: input.associationConfig?.fiscalYearEndMonth ?? 12
						}
					},
					`${input.idempotencyKey}-assoc`
				);

				if (assocResult.success && assocResult.associationId) {
					log.info('Auto-created association for self-managed HOA', {
						organizationId: organization.id,
						associationId: assocResult.associationId,
						associationName: organization.name
					});

					// Record activity event for association creation
					// Use recordWorkflowEvent which bypasses RLS via SECURITY DEFINER function
					await recordWorkflowEvent({
						organizationId: organization.id,
						entityType: 'ASSOCIATION',
						entityId: assocResult.associationId,
						action: 'CREATE',
						eventCategory: 'EXECUTION',
						summary: `Association "${organization.name}" auto-created during onboarding`,
						performedById: context.user!.id,
						performedByType: 'HUMAN',
						workflowId: `${input.idempotencyKey}-assoc`,
						workflowStep: 'association_created',
						associationId: assocResult.associationId,
						newState: {
							name: organization.name,
							status: 'ONBOARDING'
						}
					});
				}
			}

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
							type: OrganizationTypeSchema,
							status: OrganizationStatusSchema,
							role: z.string(),
							isDefault: z.boolean()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
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
							status: m.organization.status,
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
						type: OrganizationTypeSchema,
						status: OrganizationStatusSchema
					}),
					role: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
		.handler(async ({ context }) => {
			await context.cerbos.authorize('view', 'organization', context.organization!.id);

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
				idempotencyKey: z.string().uuid(),
				organizationId: z.string()
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
			FORBIDDEN: { message: 'Forbidden' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify user has access to this organization
			// Use raw query to bypass RLS since user_organizations table has RLS
			// and we need to look up memberships across all orgs the user belongs to
			const memberships = await prisma.$queryRaw<{ id: string; organization_id: string }[]>`
				SELECT id, organization_id 
				FROM user_organizations 
				WHERE user_id = ${context.user!.id} 
				AND organization_id = ${input.organizationId}
				LIMIT 1
			`;
			const membership = memberships[0] ?? null;

			if (!membership) {
				throw errors.FORBIDDEN({ message: 'You do not have access to this organization' });
			}

			// Get current default org for activity event (bypass RLS)
			const currentDefaults = await prisma.$queryRaw<{ organization_id: string; org_name: string }[]>`
				SELECT uo.organization_id, o.name as org_name
				FROM user_organizations uo
				JOIN organizations o ON o.id = uo.organization_id
				WHERE uo.user_id = ${context.user!.id} AND uo.is_default = true
				LIMIT 1
			`;
			const currentDefault = currentDefaults[0] ?? null;

			// Clear existing default and set new one via workflow
			const setDefaultResult = await startOrganizationWorkflow(
				{
					action: 'SET_DEFAULT',
					userId: context.user!.id,
					data: {
						membershipId: membership.id
					}
				},
				input.idempotencyKey
			);

			if (!setDefaultResult.success) {
				throw errors.FORBIDDEN({ message: setDefaultResult.error || 'Failed to set default organization' });
			}

			// Get new org details for activity event (organizations table has no RLS)
			const newOrg = await prisma.organization.findUnique({
				where: { id: input.organizationId }
			});

			// Record activity event for context switch using recordWorkflowEvent to bypass RLS
			if (newOrg) {
				await recordWorkflowEvent({
					organizationId: newOrg.id,
					entityType: 'USER',
					entityId: context.user!.id,
					action: 'UPDATE',
					eventCategory: 'EXECUTION',
					summary: `User switched organization context to "${newOrg.name}"`,
					performedById: context.user!.id,
					performedByType: 'HUMAN',
					workflowId: input.idempotencyKey,
					workflowStep: 'set_default_organization',
					previousState: currentDefault ? {
						defaultOrganizationId: currentDefault.organization_id,
						defaultOrganizationName: currentDefault.org_name
					} : undefined,
					newState: {
						defaultOrganizationId: newOrg.id,
						defaultOrganizationName: newOrg.name
					}
				});
			}

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
						type: OrganizationTypeSchema,
						status: OrganizationStatusSchema,
						settings: z.record(z.string(), z.unknown())
					}),
					membership: z.object({
						role: z.string(),
						isDefault: z.boolean(),
						joinedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Organization not found' }
		})
		.handler(async ({ input, context, errors }) => {
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
				throw errors.NOT_FOUND({ message: 'Organization' });
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
                idempotencyKey: z.string().uuid(),
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
						type: OrganizationTypeSchema,
						status: OrganizationStatusSchema
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('edit', 'organization', context.organization!.id);

			// Capture previous state for activity event
			const previousState = {
				name: context.organization!.name,
				settings: context.organization!.settings
			};

			// Update organization via workflow
			const updateResult = await startOrganizationWorkflow(
				{
					action: 'UPDATE',
					userId: context.user!.id,
					organizationId: context.organization!.id,
					data: {
						name: input.name,
						settings: input.settings
					}
				},
				input.idempotencyKey
			);

			if (!updateResult.success) {
				throw { code: 'INTERNAL_SERVER_ERROR', message: updateResult.error || 'Failed to update organization' };
			}

			// Fetch updated organization
			const organization = await prisma.organization.findUnique({
				where: { id: context.organization!.id }
			});

			// Record activity event for organization update
			await recordActivityFromContext(context, {
				entityType: 'ORGANIZATION',
				entityId: organization!.id,
				action: 'UPDATE',
				eventCategory: 'EXECUTION',
				summary: `Organization "${organization!.name}" updated`,
				previousState: previousState as Record<string, unknown>,
				newState: {
					name: organization!.name,
					settings: organization!.settings
				}
			});

			return successResponse(
				{
					organization: {
						id: organization!.id,
						name: organization!.name,
						slug: organization!.slug,
						type: organization!.type,
						status: organization!.status
					}
				},
				context
			);
		}),

	/**
	 * Soft delete organization (requires ADMIN role)
	 */
	delete: orgProcedure
		.input(IdempotencyKeySchema)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean(),
					deletedAt: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('delete', 'organization', context.organization!.id);

			// Delete organization via workflow
			const deleteResult = await startOrganizationWorkflow(
				{
					action: 'DELETE',
					userId: context.user!.id,
					organizationId: context.organization!.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!deleteResult.success) {
				throw { code: 'INTERNAL_SERVER_ERROR', message: deleteResult.error || 'Failed to delete organization' };
			}

			const now = new Date();

			// Record activity event for organization deletion
			await recordActivityFromContext(context, {
				entityType: 'ORGANIZATION',
				entityId: context.organization!.id,
				action: 'DELETE',
				eventCategory: 'EXECUTION',
				summary: `Organization "${context.organization!.name}" deleted`,
				newState: {
					deletedAt: now.toISOString()
				}
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
