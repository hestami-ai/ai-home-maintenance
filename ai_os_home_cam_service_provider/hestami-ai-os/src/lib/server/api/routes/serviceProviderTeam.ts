/**
 * Service Provider Team Member Management Routes
 *
 * Provides CRUD operations for service provider organization team members.
 * Team members represent employees/contractors with role-based access.
 */

import { z } from 'zod';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { ServiceProviderTeamMemberStatusSchema, ServiceProviderRoleSchema } from '../../../../../generated/zod/index.js';
import { ServiceProviderTeamMemberStatus, ServiceProviderRole } from '../../../../../generated/prisma/enums.js';
import { encrypt, decrypt, generateActivationCode } from '../../security/encryption.js';
import {
	serviceProviderTeamWorkflow_v1,
	ServiceProviderTeamWorkflowAction
} from '../../workflows/serviceProviderTeamWorkflow.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('ServiceProviderTeamRoute');

// =============================================================================
// Zod Schemas for Service Provider Team API
// =============================================================================

const TeamMemberOutputSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	userId: z.string(),
	displayName: z.string(),
	title: z.string().nullable(),
	status: ServiceProviderTeamMemberStatusSchema,
	roles: z.array(ServiceProviderRoleSchema),
	technicianId: z.string().nullable(),
	activatedAt: z.string().nullable(),
	suspendedAt: z.string().nullable(),
	deactivatedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	user: z.object({
		id: z.string(),
		email: z.string(),
		name: z.string().nullable()
	}).optional(),
	technician: z.object({
		id: z.string(),
		firstName: z.string(),
		lastName: z.string()
	}).nullable().optional()
});

const TeamMemberListItemSchema = z.object({
	id: z.string(),
	userId: z.string(),
	displayName: z.string(),
	title: z.string().nullable(),
	status: ServiceProviderTeamMemberStatusSchema,
	roles: z.array(ServiceProviderRoleSchema),
	technicianId: z.string().nullable(),
	createdAt: z.string(),
	user: z.object({
		email: z.string(),
		name: z.string().nullable()
	})
});

// =============================================================================
// Helper: Ensure org admin exists as OWNER team member
// =============================================================================

/**
 * For existing SERVICE_PROVIDER orgs, ensure the org admin is registered as an OWNER team member.
 * This handles orgs created before the team member feature was added.
 */
async function ensureOwnerTeamMemberExists(organizationId: string): Promise<void> {
	// Check if any OWNER team member exists
	const existingOwner = await prisma.serviceProviderTeamMember.findFirst({
		where: {
			organizationId,
			roles: { has: ServiceProviderRole.OWNER }
		}
	});

	if (existingOwner) {
		return; // OWNER already exists
	}

	// Find the org admin (first ADMIN membership)
	const adminMembership = await prisma.userOrganization.findFirst({
		where: {
			organizationId,
			role: 'ADMIN'
		},
		include: {
			user: {
				select: { id: true, name: true, email: true }
			}
		},
		orderBy: { createdAt: 'asc' }
	});

	if (!adminMembership) {
		return; // No admin found
	}

	// Check if this user already has a team member record
	const existingMember = await prisma.serviceProviderTeamMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId,
				userId: adminMembership.userId
			}
		}
	});

	if (existingMember) {
		// Update to add OWNER role if not present
		if (!existingMember.roles.includes(ServiceProviderRole.OWNER)) {
			await prisma.serviceProviderTeamMember.update({
				where: { id: existingMember.id },
				data: {
					roles: [...existingMember.roles, ServiceProviderRole.OWNER]
				}
			});
		}
		return;
	}

	// Create new OWNER team member
	await prisma.serviceProviderTeamMember.create({
		data: {
			organizationId,
			userId: adminMembership.userId,
			displayName: adminMembership.user.name || adminMembership.user.email.split('@')[0],
			status: ServiceProviderTeamMemberStatus.ACTIVE,
			roles: [ServiceProviderRole.OWNER, ServiceProviderRole.ADMIN],
			activatedAt: new Date()
		}
	});
}

// =============================================================================
// Service Provider Team Router
// =============================================================================

export const serviceProviderTeamRouter = {
	/**
	 * Create a new team member (invite)
	 * Creates a TeamMember entity linked to an existing User
	 */
	create: orgProcedure
		.input(
			z.object({
				email: z.string().email().describe('User email to invite as team member'),
				displayName: z.string().min(1).max(255),
				title: z.string().max(255).optional(),
				roles: z.array(ServiceProviderRoleSchema).min(1).describe('At least one role required'),
				technicianId: z.string().optional().describe('Optional link to existing technician'),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema,
					activationCode: z.string().describe('Plain text activation code to share with user')
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'User with this email not found' },
			CONFLICT: { message: 'Team member already exists for this user in this organization' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to create team member' }
		})
		.handler(async ({ input, context, errors }) => {
			const user = await prisma.user.findUnique({
				where: { email: input.email }
			});

			if (!user) {
				throw errors.NOT_FOUND({ message: 'User with this email not found' });
			}

			// Check if team member already exists for this user in this organization
			const existingMember = await prisma.serviceProviderTeamMember.findUnique({
				where: {
					organizationId_userId: {
						organizationId: context.organization!.id,
						userId: user.id
					}
				}
			});

			if (existingMember) {
				throw errors.CONFLICT({ message: 'Team member already exists for this user in this organization' });
			}

			// If technicianId provided, verify it exists and belongs to this org
			if (input.technicianId) {
				const technician = await prisma.technician.findFirst({
					where: {
						id: input.technicianId,
						organizationId: context.organization!.id
					}
				});
				if (!technician) {
					throw errors.NOT_FOUND({ message: 'Technician not found in this organization' });
				}
			}

			// Generate activation code
			let activationCode: string;
			let activationCodeEncrypted: string;
			try {
				activationCode = generateActivationCode();
				activationCodeEncrypted = encrypt(activationCode);
			} catch (encryptError) {
				log.error('Encryption error', { error: encryptError instanceof Error ? encryptError.message : String(encryptError) });
				throw errors.INTERNAL_SERVER_ERROR({ 
					message: 'Failed to generate activation code. Check HESTAMI_ACTIVATION_KEY environment variable.' 
				});
			}
			const activationCodeExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.CREATE,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				data: {
					targetUserId: user.id,
					displayName: input.displayName,
					title: input.title,
					roles: input.roles,
					activationCodeEncrypted,
					activationCodeExpiresAt,
					technicianId: input.technicianId
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create team member' });
			}

			// Fetch the created team member for response
			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: result.teamMemberId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				},
				activationCode
			}, context);
		}),

	/**
	 * Get a team member by ID
	 */
	get: orgProcedure
		.input(z.object({ teamMemberId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Team member not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const teamMember = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					id: input.teamMemberId,
					organizationId: context.organization!.id
				},
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			if (!teamMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * List all team members with optional filters
	 */
	list: orgProcedure
		.input(
			z.object({
				status: ServiceProviderTeamMemberStatusSchema.optional(),
				role: ServiceProviderRoleSchema.optional(),
				search: z.string().optional(),
				...PaginationInputSchema.shape
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMembers: z.array(TeamMemberListItemSchema)
				}),
				meta: ResponseMetaSchema,
				pagination: PaginationOutputSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Ensure OWNER team member exists for existing orgs (one-time migration)
			await ensureOwnerTeamMemberExists(context.organization!.id);

			const where: Record<string, unknown> = {
				organizationId: context.organization!.id
			};

			if (input.status) {
				where.status = input.status;
			}

			if (input.role) {
				where.roles = { has: input.role };
			}

			if (input.search) {
				where.OR = [
					{ displayName: { contains: input.search, mode: 'insensitive' } },
					{ user: { email: { contains: input.search, mode: 'insensitive' } } },
					{ user: { name: { contains: input.search, mode: 'insensitive' } } }
				];
			}

			const limit = input.limit ?? 50;
			const [teamMembers, total] = await Promise.all([
				prisma.serviceProviderTeamMember.findMany({
					where,
					include: {
						user: {
							select: { email: true, name: true }
						}
					},
					orderBy: { createdAt: 'desc' },
					take: limit + 1,
					...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
				}),
				prisma.serviceProviderTeamMember.count({ where })
			]);

			const hasMore = teamMembers.length > limit;
			const items = hasMore ? teamMembers.slice(0, limit) : teamMembers;
			const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

			return {
				ok: true as const,
				data: {
					teamMembers: items.map((tm) => ({
						id: tm.id,
						userId: tm.userId,
						displayName: tm.displayName,
						title: tm.title,
						status: tm.status,
						roles: tm.roles,
						technicianId: tm.technicianId,
						createdAt: tm.createdAt.toISOString(),
						user: tm.user
					}))
				},
				meta: {
					requestId: context.requestId,
					traceId: context.traceId ?? null,
					spanId: context.spanId ?? null,
					timestamp: new Date().toISOString()
				},
				pagination: {
					total,
					hasMore,
					nextCursor
				}
			};
		}),

	/**
	 * Update a team member's basic info
	 */
	update: orgProcedure
		.input(
			z.object({
				teamMemberId: z.string(),
				displayName: z.string().min(1).max(255).optional(),
				title: z.string().max(255).nullable().optional(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Team member not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to update team member' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingMember = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					id: input.teamMemberId,
					organizationId: context.organization!.id
				}
			});

			if (!existingMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.UPDATE,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: input.teamMemberId,
				data: {
					displayName: input.displayName,
					title: input.title
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update team member' });
			}

			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: input.teamMemberId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Update a team member's roles
	 */
	updateRoles: orgProcedure
		.input(
			z.object({
				teamMemberId: z.string(),
				roles: z.array(ServiceProviderRoleSchema).min(1),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Team member not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to update team member roles' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingMember = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					id: input.teamMemberId,
					organizationId: context.organization!.id
				}
			});

			if (!existingMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.UPDATE_ROLES,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: input.teamMemberId,
				data: {
					roles: input.roles
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update team member roles' });
			}

			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: input.teamMemberId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Regenerate activation code (for pending members)
	 */
	regenerateActivationCode: orgProcedure
		.input(
			z.object({
				teamMemberId: z.string(),
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
			NOT_FOUND: { message: 'Team member not found' },
			BAD_REQUEST: { message: 'Team member is not in pending status' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to regenerate activation code' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingMember = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					id: input.teamMemberId,
					organizationId: context.organization!.id
				}
			});

			if (!existingMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			if (existingMember.status !== ServiceProviderTeamMemberStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: 'Team member is not in pending status' });
			}

			const activationCode = generateActivationCode();
			const activationCodeEncrypted = encrypt(activationCode);
			const activationCodeExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.REGENERATE_ACTIVATION_CODE,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: input.teamMemberId,
				data: {
					activationCodeEncrypted,
					activationCodeExpiresAt
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to regenerate activation code' });
			}

			return successResponse({
				activationCode,
				expiresAt: activationCodeExpiresAt.toISOString()
			}, context);
		}),

	/**
	 * Activate account with code (Self-service)
	 */
	activateWithCode: orgProcedure
		.input(
			z.object({
				code: z.string().min(6).max(12),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Invalid or expired activation code' },
			BAD_REQUEST: { message: 'Account already activated' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to activate account' }
		})
		.handler(async ({ input, context, errors }) => {
			// Find team member with matching activation code for current user
			const teamMembers = await prisma.serviceProviderTeamMember.findMany({
				where: {
					userId: context.user!.id,
					organizationId: context.organization!.id,
					status: ServiceProviderTeamMemberStatus.PENDING,
					activationCodeExpiresAt: { gt: new Date() }
				}
			});

			// Check each team member's activation code
			let matchingMember = null;
			for (const member of teamMembers) {
				if (member.activationCodeEncrypted) {
					try {
						const decryptedCode = decrypt(member.activationCodeEncrypted);
						if (decryptedCode === input.code) {
							matchingMember = member;
							break;
						}
					} catch {
						// Decryption failed, skip this member
					}
				}
			}

			if (!matchingMember) {
				throw errors.NOT_FOUND({ message: 'Invalid or expired activation code' });
			}

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.ACTIVATE_WITH_CODE,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: matchingMember.id
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to activate account' });
			}

			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: matchingMember.id },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Activate a team member (Admin override)
	 */
	activate: orgProcedure
		.input(
			z.object({
				teamMemberId: z.string(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Team member not found' },
			BAD_REQUEST: { message: 'Team member is not in pending status' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to activate team member' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingMember = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					id: input.teamMemberId,
					organizationId: context.organization!.id
				}
			});

			if (!existingMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			if (existingMember.status !== ServiceProviderTeamMemberStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: 'Team member is not in pending status' });
			}

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.ACTIVATE,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: input.teamMemberId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to activate team member' });
			}

			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: input.teamMemberId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Suspend a team member
	 */
	suspend: orgProcedure
		.input(
			z.object({
				teamMemberId: z.string(),
				reason: z.string().min(1).max(1000),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Team member not found' },
			BAD_REQUEST: { message: 'Team member cannot be suspended' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to suspend team member' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingMember = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					id: input.teamMemberId,
					organizationId: context.organization!.id
				}
			});

			if (!existingMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			if (existingMember.status === ServiceProviderTeamMemberStatus.DEACTIVATED) {
				throw errors.BAD_REQUEST({ message: 'Cannot suspend a deactivated team member' });
			}

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.SUSPEND,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: input.teamMemberId,
				data: {
					reason: input.reason
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to suspend team member' });
			}

			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: input.teamMemberId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Deactivate a team member
	 */
	deactivate: orgProcedure
		.input(
			z.object({
				teamMemberId: z.string(),
				reason: z.string().min(1).max(1000),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Team member not found' },
			BAD_REQUEST: { message: 'Team member is already deactivated' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to deactivate team member' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingMember = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					id: input.teamMemberId,
					organizationId: context.organization!.id
				}
			});

			if (!existingMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			if (existingMember.status === ServiceProviderTeamMemberStatus.DEACTIVATED) {
				throw errors.BAD_REQUEST({ message: 'Team member is already deactivated' });
			}

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.DEACTIVATE,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: input.teamMemberId,
				data: {
					reason: input.reason
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to deactivate team member' });
			}

			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: input.teamMemberId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Reactivate a suspended or deactivated team member
	 */
	reactivate: orgProcedure
		.input(
			z.object({
				teamMemberId: z.string(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Team member not found' },
			BAD_REQUEST: { message: 'Team member is not suspended or deactivated' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to reactivate team member' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingMember = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					id: input.teamMemberId,
					organizationId: context.organization!.id
				}
			});

			if (!existingMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			if (existingMember.status !== ServiceProviderTeamMemberStatus.SUSPENDED &&
				existingMember.status !== ServiceProviderTeamMemberStatus.DEACTIVATED) {
				throw errors.BAD_REQUEST({ message: 'Team member is not suspended or deactivated' });
			}

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.REACTIVATE,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: input.teamMemberId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to reactivate team member' });
			}

			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: input.teamMemberId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Link a team member to a technician
	 */
	linkTechnician: orgProcedure
		.input(
			z.object({
				teamMemberId: z.string(),
				technicianId: z.string(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Team member or technician not found' },
			CONFLICT: { message: 'Technician is already linked to another team member' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to link technician' }
		})
		.handler(async ({ input, context, errors }) => {
			const [existingMember, technician] = await Promise.all([
				prisma.serviceProviderTeamMember.findFirst({
					where: {
						id: input.teamMemberId,
						organizationId: context.organization!.id
					}
				}),
				prisma.technician.findFirst({
					where: {
						id: input.technicianId,
						organizationId: context.organization!.id
					}
				})
			]);

			if (!existingMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			if (!technician) {
				throw errors.NOT_FOUND({ message: 'Technician not found' });
			}

			// Check if technician is already linked to another team member
			const existingLink = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					technicianId: input.technicianId,
					id: { not: input.teamMemberId }
				}
			});

			if (existingLink) {
				throw errors.CONFLICT({ message: 'Technician is already linked to another team member' });
			}

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.LINK_TECHNICIAN,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: input.teamMemberId,
				data: {
					technicianId: input.technicianId
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to link technician' });
			}

			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: input.teamMemberId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Unlink a team member from a technician
	 */
	unlinkTechnician: orgProcedure
		.input(
			z.object({
				teamMemberId: z.string(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					teamMember: TeamMemberOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Team member not found' },
			BAD_REQUEST: { message: 'Team member is not linked to a technician' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to unlink technician' }
		})
		.handler(async ({ input, context, errors }) => {
			const existingMember = await prisma.serviceProviderTeamMember.findFirst({
				where: {
					id: input.teamMemberId,
					organizationId: context.organization!.id
				}
			});

			if (!existingMember) {
				throw errors.NOT_FOUND({ message: 'Team member not found' });
			}

			if (!existingMember.technicianId) {
				throw errors.BAD_REQUEST({ message: 'Team member is not linked to a technician' });
			}

			const handle = await DBOS.startWorkflow(serviceProviderTeamWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: ServiceProviderTeamWorkflowAction.UNLINK_TECHNICIAN,
				organizationId: context.organization!.id,
				userId: context.user!.id,
				teamMemberId: input.teamMemberId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to unlink technician' });
			}

			const teamMember = await prisma.serviceProviderTeamMember.findFirstOrThrow({
				where: { id: input.teamMemberId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					technician: {
						select: { id: true, firstName: true, lastName: true }
					}
				}
			});

			return successResponse({
				teamMember: {
					...teamMember,
					activatedAt: teamMember.activatedAt?.toISOString() ?? null,
					suspendedAt: teamMember.suspendedAt?.toISOString() ?? null,
					deactivatedAt: teamMember.deactivatedAt?.toISOString() ?? null,
					createdAt: teamMember.createdAt.toISOString(),
					updatedAt: teamMember.updatedAt.toISOString()
				}
			}, context);
		})
};
