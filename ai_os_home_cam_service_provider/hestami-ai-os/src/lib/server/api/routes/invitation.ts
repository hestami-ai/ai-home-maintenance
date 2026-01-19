/**
 * Phase 38: Organization Invitation Routes
 *
 * Provides CRUD operations for organization invitations.
 * Supports inviting users to join existing organizations across all pillars.
 */

import { z } from 'zod';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	authedProcedure,
	orgProcedure,
	successResponse
} from '../router.js';
import { prisma } from '../../db.js';
import {
	InvitationStatusSchema,
	JoinRequestStatusSchema,
	InvitationDeliveryMethodSchema
} from '../schemas.js';
import {
	InvitationStatus,
	JoinRequestStatus,
	InvitationDeliveryMethod
} from '../../../../../generated/prisma/enums.js';
import { createModuleLogger } from '../../logger.js';
import { encrypt, decrypt, generateActivationCode } from '../../security/encryption.js';
import { recordSpanError } from '../middleware/tracing.js';
import { invitationWorkflow_v1, InvitationWorkflowAction } from '../../workflows/invitationWorkflow.js';
import { WorkflowErrorType } from '../../workflows/schemas.js';

const log = createModuleLogger('InvitationRoute');

// =============================================================================
// Zod Schemas for Invitation API
// =============================================================================

const InvitationOutputSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	email: z.string(),
	role: z.string(),
	invitedByUserId: z.string(),
	status: InvitationStatusSchema,
	deliveryMethod: InvitationDeliveryMethodSchema,
	expiresAt: z.string(),
	acceptedAt: z.string().nullable(),
	acceptedByUserId: z.string().nullable(),
	sentAt: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	organization: z
		.object({
			id: z.string(),
			name: z.string(),
			slug: z.string(),
			type: z.string()
		})
		.optional(),
	invitedBy: z
		.object({
			id: z.string(),
			email: z.string(),
			name: z.string().nullable()
		})
		.optional()
});

const InvitationListItemSchema = z.object({
	id: z.string(),
	email: z.string(),
	role: z.string(),
	status: InvitationStatusSchema,
	deliveryMethod: InvitationDeliveryMethodSchema,
	expiresAt: z.string(),
	sentAt: z.string().nullable(),
	createdAt: z.string(),
	invitedBy: z.object({
		id: z.string(),
		name: z.string().nullable()
	})
});

const JoinRequestOutputSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	userId: z.string(),
	requestedRole: z.string(),
	status: JoinRequestStatusSchema,
	verificationData: z.record(z.string(), z.unknown()).nullable(),
	reviewedByUserId: z.string().nullable(),
	reviewedAt: z.string().nullable(),
	rejectionReason: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	user: z
		.object({
			id: z.string(),
			email: z.string(),
			name: z.string().nullable()
		})
		.optional(),
	organization: z
		.object({
			id: z.string(),
			name: z.string(),
			slug: z.string(),
			type: z.string()
		})
		.optional()
});

// =============================================================================
// Invitation Router
// =============================================================================

export const invitationRouter = {
	/**
	 * Create a new invitation to join an organization
	 */
	create: orgProcedure
		.input(
			z.object({
				email: z.string().email().describe('Email address to invite'),
				role: z.string().describe('Role to assign on acceptance'),
				deliveryMethod: InvitationDeliveryMethodSchema.default('CODE'),
				expiresInHours: z.number().int().min(1).max(168).default(72), // 1 hour to 7 days
				metadata: z.record(z.string(), z.unknown()).optional().describe('Pillar-specific data (unit number, etc.)'),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invitation: InvitationOutputSchema,
					activationCode: z.string().optional() // Only returned for CODE delivery method
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			BAD_REQUEST: { message: 'Invalid request' },
			CONFLICT: { message: 'Invitation already exists' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to create invitation' }
		})
		.handler(async ({ input, context, errors }) => {
			const { email, role, deliveryMethod, expiresInHours, metadata } = input;

			// Check for existing pending invitation
			const existingInvitation = await prisma.organizationInvitation.findFirst({
				where: {
					organizationId: context.organization.id,
					email: email.toLowerCase(),
					status: InvitationStatus.PENDING
				}
			});

			if (existingInvitation) {
				throw errors.CONFLICT({
					message: 'A pending invitation already exists for this email. Revoke it first or wait for expiration.'
				});
			}

			// Generate activation code
			const activationCode = generateActivationCode();
			const codeEncrypted = encrypt(activationCode);
			const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

			// Start DBOS workflow
			const handle = await DBOS.startWorkflow(invitationWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: InvitationWorkflowAction.CREATE,
				organizationId: context.organization.id,
				userId: context.user.id,
				data: {
					email: email.toLowerCase(),
					role,
					deliveryMethod,
					codeEncrypted,
					expiresAt,
					metadata
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create invitation' });
			}

			// Fetch the created invitation
			const invitation = await prisma.organizationInvitation.findUniqueOrThrow({
				where: { id: result.invitationId },
				include: {
					organization: {
						select: { id: true, name: true, slug: true, type: true }
					},
					invitedBy: {
						select: { id: true, email: true, name: true }
					}
				}
			});

			return successResponse(
				{
					invitation: {
						id: invitation.id,
						organizationId: invitation.organizationId,
						email: invitation.email,
						role: invitation.role,
						invitedByUserId: invitation.invitedByUserId,
						status: invitation.status,
						deliveryMethod: invitation.deliveryMethod,
						expiresAt: invitation.expiresAt.toISOString(),
						acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
						acceptedByUserId: invitation.acceptedByUserId,
						sentAt: invitation.sentAt?.toISOString() ?? null,
						metadata: invitation.metadata as Record<string, unknown> | null,
						createdAt: invitation.createdAt.toISOString(),
						updatedAt: invitation.updatedAt.toISOString(),
						organization: invitation.organization,
						invitedBy: invitation.invitedBy
					},
					// Only return activation code for CODE delivery method
					...(deliveryMethod === InvitationDeliveryMethod.CODE && { activationCode })
				},
				context
			);
		}),

	/**
	 * List invitations for the current organization
	 */
	list: orgProcedure
		.input(
			z
				.object({
					status: InvitationStatusSchema.optional(),
					limit: z.number().int().min(1).max(100).default(50),
					cursor: z.string().optional()
				})
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invitations: z.array(InvitationListItemSchema),
					nextCursor: z.string().nullable(),
					hasMore: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Failed to list invitations' }
		})
		.handler(async ({ input, context }) => {
			const limit = input?.limit ?? 50;
			const where: Record<string, unknown> = {
				organizationId: context.organization.id
			};

			if (input?.status) {
				where.status = input.status;
			}

			const invitations = await prisma.organizationInvitation.findMany({
				where,
				include: {
					invitedBy: {
						select: { id: true, name: true }
					}
				},
				orderBy: { createdAt: 'desc' },
				take: limit + 1,
				...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = invitations.length > limit;
			const items = hasMore ? invitations.slice(0, -1) : invitations;
			const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

			return successResponse(
				{
					invitations: items.map((inv) => ({
						id: inv.id,
						email: inv.email,
						role: inv.role,
						status: inv.status,
						deliveryMethod: inv.deliveryMethod,
						expiresAt: inv.expiresAt.toISOString(),
						sentAt: inv.sentAt?.toISOString() ?? null,
						createdAt: inv.createdAt.toISOString(),
						invitedBy: inv.invitedBy
					})),
					nextCursor,
					hasMore
				},
				context
			);
		}),

	/**
	 * Get a single invitation by ID
	 */
	get: orgProcedure
		.input(z.object({ invitationId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invitation: InvitationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Invitation not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const invitation = await prisma.organizationInvitation.findFirst({
				where: {
					id: input.invitationId,
					organizationId: context.organization.id
				},
				include: {
					organization: {
						select: { id: true, name: true, slug: true, type: true }
					},
					invitedBy: {
						select: { id: true, email: true, name: true }
					}
				}
			});

			if (!invitation) {
				throw errors.NOT_FOUND({ message: 'Invitation not found' });
			}

			return successResponse(
				{
					invitation: {
						id: invitation.id,
						organizationId: invitation.organizationId,
						email: invitation.email,
						role: invitation.role,
						invitedByUserId: invitation.invitedByUserId,
						status: invitation.status,
						deliveryMethod: invitation.deliveryMethod,
						expiresAt: invitation.expiresAt.toISOString(),
						acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
						acceptedByUserId: invitation.acceptedByUserId,
						sentAt: invitation.sentAt?.toISOString() ?? null,
						metadata: invitation.metadata as Record<string, unknown> | null,
						createdAt: invitation.createdAt.toISOString(),
						updatedAt: invitation.updatedAt.toISOString(),
						organization: invitation.organization,
						invitedBy: invitation.invitedBy
					}
				},
				context
			);
		}),

	/**
	 * Resend an invitation (regenerates code if expired)
	 */
	resend: orgProcedure
		.input(
			z.object({
				invitationId: z.string(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invitation: InvitationOutputSchema,
					activationCode: z.string().optional()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Invitation not found' },
			BAD_REQUEST: { message: 'Cannot resend this invitation' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to resend invitation' }
		})
		.handler(async ({ input, context, errors }) => {
			const invitation = await prisma.organizationInvitation.findFirst({
				where: {
					id: input.invitationId,
					organizationId: context.organization.id
				}
			});

			if (!invitation) {
				throw errors.NOT_FOUND({ message: 'Invitation not found' });
			}

			if (invitation.status !== InvitationStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: `Cannot resend invitation with status: ${invitation.status}` });
			}

			// Regenerate code if expired
			let activationCode: string | undefined;
			let codeEncrypted = invitation.codeEncrypted;
			let expiresAt = invitation.expiresAt;

			if (invitation.expiresAt < new Date()) {
				activationCode = generateActivationCode();
				codeEncrypted = encrypt(activationCode);
				expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
			} else if (invitation.deliveryMethod === InvitationDeliveryMethod.CODE && invitation.codeEncrypted) {
				// Return existing code for CODE delivery
				try {
					activationCode = decrypt(invitation.codeEncrypted);
				} catch {
					// If decryption fails, generate new code
					activationCode = generateActivationCode();
					codeEncrypted = encrypt(activationCode);
				}
			}

			// Start DBOS workflow
			const handle = await DBOS.startWorkflow(invitationWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: InvitationWorkflowAction.RESEND,
				organizationId: context.organization.id,
				userId: context.user.id,
				invitationId: input.invitationId,
				data: {
					codeEncrypted,
					expiresAt
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to resend invitation' });
			}

			// Fetch updated invitation
			const updated = await prisma.organizationInvitation.findUniqueOrThrow({
				where: { id: input.invitationId },
				include: {
					organization: {
						select: { id: true, name: true, slug: true, type: true }
					},
					invitedBy: {
						select: { id: true, email: true, name: true }
					}
				}
			});

			return successResponse(
				{
					invitation: {
						id: updated.id,
						organizationId: updated.organizationId,
						email: updated.email,
						role: updated.role,
						invitedByUserId: updated.invitedByUserId,
						status: updated.status,
						deliveryMethod: updated.deliveryMethod,
						expiresAt: updated.expiresAt.toISOString(),
						acceptedAt: updated.acceptedAt?.toISOString() ?? null,
						acceptedByUserId: updated.acceptedByUserId,
						sentAt: updated.sentAt?.toISOString() ?? null,
						metadata: updated.metadata as Record<string, unknown> | null,
						createdAt: updated.createdAt.toISOString(),
						updatedAt: updated.updatedAt.toISOString(),
						organization: updated.organization,
						invitedBy: updated.invitedBy
					},
					...(activationCode && { activationCode })
				},
				context
			);
		}),

	/**
	 * Revoke a pending invitation
	 */
	revoke: orgProcedure
		.input(
			z.object({
				invitationId: z.string(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invitation: InvitationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Invitation not found' },
			BAD_REQUEST: { message: 'Cannot revoke this invitation' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to revoke invitation' }
		})
		.handler(async ({ input, context, errors }) => {
			const invitation = await prisma.organizationInvitation.findFirst({
				where: {
					id: input.invitationId,
					organizationId: context.organization.id
				}
			});

			if (!invitation) {
				throw errors.NOT_FOUND({ message: 'Invitation not found' });
			}

			if (invitation.status !== InvitationStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: `Cannot revoke invitation with status: ${invitation.status}` });
			}

			// Start DBOS workflow
			const handle = await DBOS.startWorkflow(invitationWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: InvitationWorkflowAction.REVOKE,
				organizationId: context.organization.id,
				userId: context.user.id,
				invitationId: input.invitationId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to revoke invitation' });
			}

			// Fetch updated invitation
			const updated = await prisma.organizationInvitation.findUniqueOrThrow({
				where: { id: input.invitationId },
				include: {
					organization: {
						select: { id: true, name: true, slug: true, type: true }
					},
					invitedBy: {
						select: { id: true, email: true, name: true }
					}
				}
			});

			return successResponse(
				{
					invitation: {
						id: updated.id,
						organizationId: updated.organizationId,
						email: updated.email,
						role: updated.role,
						invitedByUserId: updated.invitedByUserId,
						status: updated.status,
						deliveryMethod: updated.deliveryMethod,
						expiresAt: updated.expiresAt.toISOString(),
						acceptedAt: updated.acceptedAt?.toISOString() ?? null,
						acceptedByUserId: updated.acceptedByUserId,
						sentAt: updated.sentAt?.toISOString() ?? null,
						metadata: updated.metadata as Record<string, unknown> | null,
						createdAt: updated.createdAt.toISOString(),
						updatedAt: updated.updatedAt.toISOString(),
						organization: updated.organization,
						invitedBy: updated.invitedBy
					}
				},
				context
			);
		}),

	/**
	 * Accept an invitation using activation code (self-service)
	 * This is called by the user who received the invitation
	 */
	accept: authedProcedure
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
					success: z.boolean(),
					organizationId: z.string(),
					organizationName: z.string(),
					role: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Invitation not found' },
			BAD_REQUEST: { message: 'Invalid or expired code' },
			CONFLICT: { message: 'Already a member of this organization' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to accept invitation' }
		})
		.handler(async ({ input, context, errors }) => {
			const userEmail = context.user!.email.toLowerCase();

			// Find pending invitation for this user's email
			const invitation = await prisma.organizationInvitation.findFirst({
				where: {
					email: userEmail,
					status: InvitationStatus.PENDING
				},
				include: {
					organization: {
						select: { id: true, name: true, slug: true, type: true }
					}
				}
			});

			if (!invitation) {
				throw errors.NOT_FOUND({ message: 'No pending invitation found for your email' });
			}

			// Check expiration
			if (invitation.expiresAt < new Date()) {
				throw errors.BAD_REQUEST({ message: 'Invitation has expired. Please request a new one.' });
			}

			// Verify code
			if (!invitation.codeEncrypted) {
				throw errors.BAD_REQUEST({ message: 'Invalid invitation - no code set' });
			}

			try {
				const plainCode = decrypt(invitation.codeEncrypted);
				if (plainCode !== input.code.toUpperCase()) {
					throw errors.BAD_REQUEST({ message: 'Invalid activation code' });
				}
			} catch (e) {
				if (e && typeof e === 'object' && 'message' in e && (e as Error).message === 'Invalid activation code') {
					throw e;
				}
				log.error('Decryption failed during invitation acceptance', { error: e });
				await recordSpanError(e instanceof Error ? e : new Error(String(e)), {
					errorCode: 'INVITATION_ACCEPT_FAILED',
					errorType: WorkflowErrorType.INVITATION_ERROR
				});
				throw errors.BAD_REQUEST({ message: 'Invalid activation code' });
			}

			// Check if already a member
			const existingMembership = await prisma.userOrganization.findFirst({
				where: {
					userId: context.user!.id,
					organizationId: invitation.organizationId
				}
			});

			if (existingMembership) {
				throw errors.CONFLICT({ message: 'You are already a member of this organization' });
			}

			// Start DBOS workflow
			const handle = await DBOS.startWorkflow(invitationWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: InvitationWorkflowAction.ACCEPT,
				organizationId: invitation.organizationId,
				userId: context.user!.id,
				invitationId: invitation.id,
				data: {
					role: invitation.role,
					metadata: invitation.metadata as Record<string, unknown> | undefined
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to accept invitation' });
			}

			return successResponse(
				{
					success: true,
					organizationId: invitation.organizationId,
					organizationName: invitation.organization.name,
					role: invitation.role
				},
				context
			);
		}),

	/**
	 * Get pending invitations for the current user
	 */
	pending: authedProcedure
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invitations: z.array(
						z.object({
							id: z.string(),
							organizationId: z.string(),
							organizationName: z.string(),
							organizationType: z.string(),
							role: z.string(),
							expiresAt: z.string(),
							invitedByName: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Failed to fetch pending invitations' }
		})
		.handler(async ({ context }) => {
			const userEmail = context.user!.email.toLowerCase();

			const invitations = await prisma.organizationInvitation.findMany({
				where: {
					email: userEmail,
					status: InvitationStatus.PENDING,
					expiresAt: { gt: new Date() }
				},
				include: {
					organization: {
						select: { id: true, name: true, type: true }
					},
					invitedBy: {
						select: { name: true }
					}
				},
				orderBy: { createdAt: 'desc' }
			});

			return successResponse(
				{
					invitations: invitations.map((inv) => ({
						id: inv.id,
						organizationId: inv.organizationId,
						organizationName: inv.organization.name,
						organizationType: inv.organization.type,
						role: inv.role,
						expiresAt: inv.expiresAt.toISOString(),
						invitedByName: inv.invitedBy.name
					}))
				},
				context
			);
		})
};

// =============================================================================
// Join Request Router
// =============================================================================

export const joinRequestRouter = {
	/**
	 * Create a join request (self-service)
	 */
	create: authedProcedure
		.input(
			z.object({
				organizationId: z.string(),
				requestedRole: z.string(),
				verificationData: z.record(z.string(), z.unknown()).optional(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					joinRequest: JoinRequestOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Organization not found' },
			CONFLICT: { message: 'Request already exists or already a member' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to create join request' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify organization exists
			const organization = await prisma.organization.findUnique({
				where: { id: input.organizationId }
			});

			if (!organization) {
				throw errors.NOT_FOUND({ message: 'Organization not found' });
			}

			// Check if already a member
			const existingMembership = await prisma.userOrganization.findFirst({
				where: {
					userId: context.user!.id,
					organizationId: input.organizationId
				}
			});

			if (existingMembership) {
				throw errors.CONFLICT({ message: 'You are already a member of this organization' });
			}

			// Check for existing pending request
			const existingRequest = await prisma.joinRequest.findFirst({
				where: {
					userId: context.user!.id,
					organizationId: input.organizationId,
					status: JoinRequestStatus.PENDING
				}
			});

			if (existingRequest) {
				throw errors.CONFLICT({ message: 'You already have a pending join request for this organization' });
			}

			// Start DBOS workflow
			const handle = await DBOS.startWorkflow(invitationWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: InvitationWorkflowAction.CREATE_JOIN_REQUEST,
				organizationId: input.organizationId,
				userId: context.user!.id,
				data: {
					requestedRole: input.requestedRole,
					verificationData: input.verificationData
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create join request' });
			}

			// Fetch created request
			const joinRequest = await prisma.joinRequest.findUniqueOrThrow({
				where: { id: result.joinRequestId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					organization: {
						select: { id: true, name: true, slug: true, type: true }
					}
				}
			});

			return successResponse(
				{
					joinRequest: {
						id: joinRequest.id,
						organizationId: joinRequest.organizationId,
						userId: joinRequest.userId,
						requestedRole: joinRequest.requestedRole,
						status: joinRequest.status,
						verificationData: joinRequest.verificationData as Record<string, unknown> | null,
						reviewedByUserId: joinRequest.reviewedByUserId,
						reviewedAt: joinRequest.reviewedAt?.toISOString() ?? null,
						rejectionReason: joinRequest.rejectionReason,
						createdAt: joinRequest.createdAt.toISOString(),
						updatedAt: joinRequest.updatedAt.toISOString(),
						user: joinRequest.user,
						organization: joinRequest.organization
					}
				},
				context
			);
		}),

	/**
	 * List join requests for the current organization (admin)
	 */
	list: orgProcedure
		.input(
			z
				.object({
					status: JoinRequestStatusSchema.optional(),
					limit: z.number().int().min(1).max(100).default(50),
					cursor: z.string().optional()
				})
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					joinRequests: z.array(
						z.object({
							id: z.string(),
							userId: z.string(),
							requestedRole: z.string(),
							status: JoinRequestStatusSchema,
							verificationData: z.record(z.string(), z.unknown()).nullable(),
							createdAt: z.string(),
							user: z.object({
								id: z.string(),
								email: z.string(),
								name: z.string().nullable()
							})
						})
					),
					nextCursor: z.string().nullable(),
					hasMore: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Failed to list join requests' }
		})
		.handler(async ({ input, context }) => {
			const limit = input?.limit ?? 50;
			const where: Record<string, unknown> = {
				organizationId: context.organization.id
			};

			if (input?.status) {
				where.status = input.status;
			}

			const requests = await prisma.joinRequest.findMany({
				where,
				include: {
					user: {
						select: { id: true, email: true, name: true }
					}
				},
				orderBy: { createdAt: 'desc' },
				take: limit + 1,
				...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = requests.length > limit;
			const items = hasMore ? requests.slice(0, -1) : requests;
			const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

			return successResponse(
				{
					joinRequests: items.map((req) => ({
						id: req.id,
						userId: req.userId,
						requestedRole: req.requestedRole,
						status: req.status,
						verificationData: req.verificationData as Record<string, unknown> | null,
						createdAt: req.createdAt.toISOString(),
						user: req.user
					})),
					nextCursor,
					hasMore
				},
				context
			);
		}),

	/**
	 * Approve a join request (admin)
	 */
	approve: orgProcedure
		.input(
			z.object({
				joinRequestId: z.string(),
				role: z.string().optional().describe('Override the requested role'),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					joinRequest: JoinRequestOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Join request not found' },
			BAD_REQUEST: { message: 'Cannot approve this request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to approve join request' }
		})
		.handler(async ({ input, context, errors }) => {
			const request = await prisma.joinRequest.findFirst({
				where: {
					id: input.joinRequestId,
					organizationId: context.organization.id
				}
			});

			if (!request) {
				throw errors.NOT_FOUND({ message: 'Join request not found' });
			}

			if (request.status !== JoinRequestStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: `Cannot approve request with status: ${request.status}` });
			}

			const roleToAssign = input.role || request.requestedRole;

			// Start DBOS workflow
			const handle = await DBOS.startWorkflow(invitationWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: InvitationWorkflowAction.APPROVE_JOIN_REQUEST,
				organizationId: context.organization.id,
				userId: context.user.id,
				joinRequestId: input.joinRequestId,
				data: {
					role: roleToAssign,
					requestUserId: request.userId
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to approve join request' });
			}

			// Fetch updated request
			const updated = await prisma.joinRequest.findUniqueOrThrow({
				where: { id: input.joinRequestId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					organization: {
						select: { id: true, name: true, slug: true, type: true }
					}
				}
			});

			return successResponse(
				{
					joinRequest: {
						id: updated.id,
						organizationId: updated.organizationId,
						userId: updated.userId,
						requestedRole: updated.requestedRole,
						status: updated.status,
						verificationData: updated.verificationData as Record<string, unknown> | null,
						reviewedByUserId: updated.reviewedByUserId,
						reviewedAt: updated.reviewedAt?.toISOString() ?? null,
						rejectionReason: updated.rejectionReason,
						createdAt: updated.createdAt.toISOString(),
						updatedAt: updated.updatedAt.toISOString(),
						user: updated.user,
						organization: updated.organization
					}
				},
				context
			);
		}),

	/**
	 * Reject a join request (admin)
	 */
	reject: orgProcedure
		.input(
			z.object({
				joinRequestId: z.string(),
				reason: z.string().optional(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					joinRequest: JoinRequestOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Join request not found' },
			BAD_REQUEST: { message: 'Cannot reject this request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to reject join request' }
		})
		.handler(async ({ input, context, errors }) => {
			const request = await prisma.joinRequest.findFirst({
				where: {
					id: input.joinRequestId,
					organizationId: context.organization.id
				}
			});

			if (!request) {
				throw errors.NOT_FOUND({ message: 'Join request not found' });
			}

			if (request.status !== JoinRequestStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: `Cannot reject request with status: ${request.status}` });
			}

			// Start DBOS workflow
			const handle = await DBOS.startWorkflow(invitationWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: InvitationWorkflowAction.REJECT_JOIN_REQUEST,
				organizationId: context.organization.id,
				userId: context.user.id,
				joinRequestId: input.joinRequestId,
				data: {
					reason: input.reason
				}
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to reject join request' });
			}

			// Fetch updated request
			const updated = await prisma.joinRequest.findUniqueOrThrow({
				where: { id: input.joinRequestId },
				include: {
					user: {
						select: { id: true, email: true, name: true }
					},
					organization: {
						select: { id: true, name: true, slug: true, type: true }
					}
				}
			});

			return successResponse(
				{
					joinRequest: {
						id: updated.id,
						organizationId: updated.organizationId,
						userId: updated.userId,
						requestedRole: updated.requestedRole,
						status: updated.status,
						verificationData: updated.verificationData as Record<string, unknown> | null,
						reviewedByUserId: updated.reviewedByUserId,
						reviewedAt: updated.reviewedAt?.toISOString() ?? null,
						rejectionReason: updated.rejectionReason,
						createdAt: updated.createdAt.toISOString(),
						updatedAt: updated.updatedAt.toISOString(),
						user: updated.user,
						organization: updated.organization
					}
				},
				context
			);
		}),

	/**
	 * Cancel own join request
	 */
	cancel: authedProcedure
		.input(
			z.object({
				joinRequestId: z.string(),
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
			NOT_FOUND: { message: 'Join request not found' },
			FORBIDDEN: { message: 'Cannot cancel this request' },
			BAD_REQUEST: { message: 'Cannot cancel this request' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to cancel join request' }
		})
		.handler(async ({ input, context, errors }) => {
			const request = await prisma.joinRequest.findUnique({
				where: { id: input.joinRequestId }
			});

			if (!request) {
				throw errors.NOT_FOUND({ message: 'Join request not found' });
			}

			if (request.userId !== context.user!.id) {
				throw errors.FORBIDDEN({ message: 'You can only cancel your own requests' });
			}

			if (request.status !== JoinRequestStatus.PENDING) {
				throw errors.BAD_REQUEST({ message: `Cannot cancel request with status: ${request.status}` });
			}

			// Start DBOS workflow
			const handle = await DBOS.startWorkflow(invitationWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: InvitationWorkflowAction.CANCEL_JOIN_REQUEST,
				organizationId: request.organizationId,
				userId: context.user!.id,
				joinRequestId: input.joinRequestId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to cancel join request' });
			}

			return successResponse({ success: true }, context);
		})
};
