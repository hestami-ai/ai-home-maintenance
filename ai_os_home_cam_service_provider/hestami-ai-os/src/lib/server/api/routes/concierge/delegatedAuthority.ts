import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { DelegatedAuthorityTypeSchema } from '../../../../../../generated/zod/inputTypeSchemas/DelegatedAuthorityTypeSchema.js';
import { DelegatedAuthorityStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/DelegatedAuthorityStatusSchema.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';

/**
 * Delegated Authority management procedures for Phase 3 Concierge Platform
 */
export const delegatedAuthorityRouter = {
	/**
	 * Grant delegated authority from a property ownership to another party
	 */
	grant: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyOwnershipId: z.string(),
				delegatePartyId: z.string(),
				authorityType: DelegatedAuthorityTypeSchema,
				monetaryLimit: z.number().positive().optional(),
				scopeDescription: z.string().optional(),
				scopeRestrictions: z.record(z.string(), z.unknown()).optional(),
				expiresAt: z.coerce.date().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					delegatedAuthority: z.object({
						id: z.string(),
						propertyOwnershipId: z.string(),
						delegatePartyId: z.string(),
						authorityType: z.string(),
						status: z.string(),
						monetaryLimit: z.number().nullable(),
						scopeDescription: z.string().nullable(),
						expiresAt: z.string().nullable(),
						grantedAt: z.string(),
						grantedBy: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'delegated_authority', 'new');

			// Verify property ownership exists and belongs to this organization
			const propertyOwnership = await prisma.propertyOwnership.findFirst({
				where: { id: input.propertyOwnershipId, deletedAt: null },
				include: { property: true, party: true }
			});

			if (!propertyOwnership || propertyOwnership.property.ownerOrgId !== context.organization.id) {
				throw ApiException.notFound('PropertyOwnership');
			}

			// Only OWNER or CO_OWNER can grant delegated authority
			if (!['OWNER', 'CO_OWNER'].includes(propertyOwnership.role)) {
				throw ApiException.forbidden('Only owners or co-owners can grant delegated authority');
			}

			// Verify delegate party exists and belongs to this organization
			const delegateParty = await prisma.party.findFirst({
				where: { id: input.delegatePartyId, organizationId: context.organization.id }
			});

			if (!delegateParty) {
				throw ApiException.notFound('Delegate Party');
			}

			// Cannot delegate to self
			if (propertyOwnership.partyId === input.delegatePartyId) {
				throw ApiException.badRequest('Cannot delegate authority to yourself');
			}

			// Check if similar delegation already exists
			const existing = await prisma.delegatedAuthority.findFirst({
				where: {
					propertyOwnershipId: input.propertyOwnershipId,
					delegatePartyId: input.delegatePartyId,
					authorityType: input.authorityType,
					status: { in: ['ACTIVE', 'PENDING_ACCEPTANCE'] }
				}
			});

			if (existing) {
				throw ApiException.conflict('Delegated authority already exists for this party and type');
			}

			const delegatedAuthority = await prisma.delegatedAuthority.create({
				data: {
					propertyOwnershipId: input.propertyOwnershipId,
					delegatePartyId: input.delegatePartyId,
					authorityType: input.authorityType,
					status: 'PENDING_ACCEPTANCE',
					monetaryLimit: input.monetaryLimit,
					scopeDescription: input.scopeDescription,
					scopeRestrictions: input.scopeRestrictions as Prisma.InputJsonValue | undefined,
					expiresAt: input.expiresAt,
					grantedBy: context.user.id
				}
			});

			return successResponse(
				{
					delegatedAuthority: {
						id: delegatedAuthority.id,
						propertyOwnershipId: delegatedAuthority.propertyOwnershipId,
						delegatePartyId: delegatedAuthority.delegatePartyId,
						authorityType: delegatedAuthority.authorityType,
						status: delegatedAuthority.status,
						monetaryLimit: delegatedAuthority.monetaryLimit
							? Number(delegatedAuthority.monetaryLimit)
							: null,
						scopeDescription: delegatedAuthority.scopeDescription,
						expiresAt: delegatedAuthority.expiresAt?.toISOString() ?? null,
						grantedAt: delegatedAuthority.grantedAt.toISOString(),
						grantedBy: delegatedAuthority.grantedBy
					}
				},
				context
			);
		}),

	/**
	 * Get delegated authority by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					delegatedAuthority: z.object({
						id: z.string(),
						propertyOwnershipId: z.string(),
						delegatePartyId: z.string(),
						authorityType: z.string(),
						status: z.string(),
						monetaryLimit: z.number().nullable(),
						scopeDescription: z.string().nullable(),
						scopeRestrictions: z.record(z.string(), z.unknown()).nullable(),
						grantedAt: z.string(),
						grantedBy: z.string(),
						acceptedAt: z.string().nullable(),
						expiresAt: z.string().nullable(),
						revokedAt: z.string().nullable(),
						revokedBy: z.string().nullable(),
						revokeReason: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					propertyOwnership: z.object({
						id: z.string(),
						role: z.string(),
						partyName: z.string()
					}),
					delegateParty: z.object({
						id: z.string(),
						displayName: z.string(),
						partyType: z.string()
					}),
					property: z.object({
						id: z.string(),
						name: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const delegatedAuthority = await prisma.delegatedAuthority.findFirst({
				where: { id: input.id },
				include: {
					propertyOwnership: {
						include: {
							property: true,
							party: true
						}
					},
					delegateParty: true
				}
			});

			if (
				!delegatedAuthority ||
				delegatedAuthority.propertyOwnership.property.ownerOrgId !== context.organization.id
			) {
				throw ApiException.notFound('DelegatedAuthority');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'delegated_authority', delegatedAuthority.id, {
				partyUserId: delegatedAuthority.delegateParty.userId ?? undefined
			});

			const ownerDisplayName =
				delegatedAuthority.propertyOwnership.party.partyType === 'INDIVIDUAL'
					? `${delegatedAuthority.propertyOwnership.party.firstName ?? ''} ${delegatedAuthority.propertyOwnership.party.lastName ?? ''}`.trim()
					: delegatedAuthority.propertyOwnership.party.entityName ?? '';

			const delegateDisplayName =
				delegatedAuthority.delegateParty.partyType === 'INDIVIDUAL'
					? `${delegatedAuthority.delegateParty.firstName ?? ''} ${delegatedAuthority.delegateParty.lastName ?? ''}`.trim()
					: delegatedAuthority.delegateParty.entityName ?? '';

			return successResponse(
				{
					delegatedAuthority: {
						id: delegatedAuthority.id,
						propertyOwnershipId: delegatedAuthority.propertyOwnershipId,
						delegatePartyId: delegatedAuthority.delegatePartyId,
						authorityType: delegatedAuthority.authorityType,
						status: delegatedAuthority.status,
						monetaryLimit: delegatedAuthority.monetaryLimit
							? Number(delegatedAuthority.monetaryLimit)
							: null,
						scopeDescription: delegatedAuthority.scopeDescription,
						scopeRestrictions: delegatedAuthority.scopeRestrictions as Record<string, unknown> | null,
						grantedAt: delegatedAuthority.grantedAt.toISOString(),
						grantedBy: delegatedAuthority.grantedBy,
						acceptedAt: delegatedAuthority.acceptedAt?.toISOString() ?? null,
						expiresAt: delegatedAuthority.expiresAt?.toISOString() ?? null,
						revokedAt: delegatedAuthority.revokedAt?.toISOString() ?? null,
						revokedBy: delegatedAuthority.revokedBy,
						revokeReason: delegatedAuthority.revokeReason,
						createdAt: delegatedAuthority.createdAt.toISOString(),
						updatedAt: delegatedAuthority.updatedAt.toISOString()
					},
					propertyOwnership: {
						id: delegatedAuthority.propertyOwnership.id,
						role: delegatedAuthority.propertyOwnership.role,
						partyName: ownerDisplayName
					},
					delegateParty: {
						id: delegatedAuthority.delegateParty.id,
						displayName: delegateDisplayName,
						partyType: delegatedAuthority.delegateParty.partyType
					},
					property: {
						id: delegatedAuthority.propertyOwnership.property.id,
						name: delegatedAuthority.propertyOwnership.property.name
					}
				},
				context
			);
		}),

	/**
	 * List delegated authorities by property ownership (authorities granted by this ownership)
	 */
	listByOwnership: orgProcedure
		.input(
			PaginationInputSchema.extend({
				propertyOwnershipId: z.string(),
				status: DelegatedAuthorityStatusSchema.optional(),
				authorityType: DelegatedAuthorityTypeSchema.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					delegatedAuthorities: z.array(
						z.object({
							id: z.string(),
							delegatePartyId: z.string(),
							delegatePartyName: z.string(),
							authorityType: z.string(),
							status: z.string(),
							monetaryLimit: z.number().nullable(),
							expiresAt: z.string().nullable(),
							grantedAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Verify property ownership exists and belongs to this organization
			const propertyOwnership = await prisma.propertyOwnership.findFirst({
				where: { id: input.propertyOwnershipId, deletedAt: null },
				include: { property: true }
			});

			if (!propertyOwnership || propertyOwnership.property.ownerOrgId !== context.organization.id) {
				throw ApiException.notFound('PropertyOwnership');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'property_ownership', propertyOwnership.id);

			const whereClause = {
				propertyOwnershipId: input.propertyOwnershipId,
				...(input.status && { status: input.status }),
				...(input.authorityType && { authorityType: input.authorityType })
			};

			const delegatedAuthorities = await prisma.delegatedAuthority.findMany({
				where: whereClause,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: [{ status: 'asc' }, { grantedAt: 'desc' }],
				include: { delegateParty: true }
			});

			const hasMore = delegatedAuthorities.length > input.limit;
			const items = hasMore ? delegatedAuthorities.slice(0, -1) : delegatedAuthorities;

			return successResponse(
				{
					delegatedAuthorities: items.map((da) => ({
						id: da.id,
						delegatePartyId: da.delegatePartyId,
						delegatePartyName:
							da.delegateParty.partyType === 'INDIVIDUAL'
								? `${da.delegateParty.firstName ?? ''} ${da.delegateParty.lastName ?? ''}`.trim()
								: da.delegateParty.entityName ?? '',
						authorityType: da.authorityType,
						status: da.status,
						monetaryLimit: da.monetaryLimit ? Number(da.monetaryLimit) : null,
						expiresAt: da.expiresAt?.toISOString() ?? null,
						grantedAt: da.grantedAt.toISOString()
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
	 * List delegated authorities received by a party
	 */
	listByDelegate: orgProcedure
		.input(
			PaginationInputSchema.extend({
				delegatePartyId: z.string(),
				status: DelegatedAuthorityStatusSchema.optional(),
				authorityType: DelegatedAuthorityTypeSchema.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					delegatedAuthorities: z.array(
						z.object({
							id: z.string(),
							propertyOwnershipId: z.string(),
							propertyId: z.string(),
							propertyName: z.string(),
							ownerPartyName: z.string(),
							authorityType: z.string(),
							status: z.string(),
							monetaryLimit: z.number().nullable(),
							scopeDescription: z.string().nullable(),
							expiresAt: z.string().nullable(),
							grantedAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Verify party exists and belongs to this organization
			const party = await prisma.party.findFirst({
				where: { id: input.delegatePartyId, organizationId: context.organization.id }
			});

			if (!party) {
				throw ApiException.notFound('Party');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'party', party.id, {
				partyUserId: party.userId ?? undefined
			});

			const whereClause = {
				delegatePartyId: input.delegatePartyId,
				...(input.status && { status: input.status }),
				...(input.authorityType && { authorityType: input.authorityType })
			};

			const delegatedAuthorities = await prisma.delegatedAuthority.findMany({
				where: whereClause,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: [{ status: 'asc' }, { grantedAt: 'desc' }],
				include: {
					propertyOwnership: {
						include: {
							property: true,
							party: true
						}
					}
				}
			});

			const hasMore = delegatedAuthorities.length > input.limit;
			const items = hasMore ? delegatedAuthorities.slice(0, -1) : delegatedAuthorities;

			return successResponse(
				{
					delegatedAuthorities: items.map((da) => ({
						id: da.id,
						propertyOwnershipId: da.propertyOwnershipId,
						propertyId: da.propertyOwnership.property.id,
						propertyName: da.propertyOwnership.property.name,
						ownerPartyName:
							da.propertyOwnership.party.partyType === 'INDIVIDUAL'
								? `${da.propertyOwnership.party.firstName ?? ''} ${da.propertyOwnership.party.lastName ?? ''}`.trim()
								: da.propertyOwnership.party.entityName ?? '',
						authorityType: da.authorityType,
						status: da.status,
						monetaryLimit: da.monetaryLimit ? Number(da.monetaryLimit) : null,
						scopeDescription: da.scopeDescription,
						expiresAt: da.expiresAt?.toISOString() ?? null,
						grantedAt: da.grantedAt.toISOString()
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
	 * Accept a delegated authority grant
	 */
	accept: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					delegatedAuthority: z.object({
						id: z.string(),
						status: z.string(),
						acceptedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.delegatedAuthority.findFirst({
				where: { id: input.id },
				include: {
					propertyOwnership: { include: { property: true } },
					delegateParty: true
				}
			});

			if (
				!existing ||
				existing.propertyOwnership.property.ownerOrgId !== context.organization.id
			) {
				throw ApiException.notFound('DelegatedAuthority');
			}

			if (existing.status !== 'PENDING_ACCEPTANCE') {
				throw ApiException.badRequest('Delegated authority is not pending acceptance');
			}

			// Cerbos authorization - delegate must accept
			await context.cerbos.authorize('accept', 'delegated_authority', existing.id, {
				partyUserId: existing.delegateParty.userId ?? undefined
			});

			const now = new Date();
			const delegatedAuthority = await prisma.delegatedAuthority.update({
				where: { id: input.id },
				data: {
					status: 'ACTIVE',
					acceptedAt: now
				}
			});

			return successResponse(
				{
					delegatedAuthority: {
						id: delegatedAuthority.id,
						status: delegatedAuthority.status,
						acceptedAt: delegatedAuthority.acceptedAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Revoke a delegated authority
	 */
	revoke: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				reason: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					delegatedAuthority: z.object({
						id: z.string(),
						status: z.string(),
						revokedAt: z.string(),
						revokedBy: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.delegatedAuthority.findFirst({
				where: { id: input.id },
				include: {
					propertyOwnership: { include: { property: true } }
				}
			});

			if (
				!existing ||
				existing.propertyOwnership.property.ownerOrgId !== context.organization.id
			) {
				throw ApiException.notFound('DelegatedAuthority');
			}

			if (!['ACTIVE', 'PENDING_ACCEPTANCE'].includes(existing.status)) {
				throw ApiException.badRequest('Delegated authority cannot be revoked');
			}

			// Cerbos authorization
			await context.cerbos.authorize('revoke', 'delegated_authority', existing.id);

			const now = new Date();
			const delegatedAuthority = await prisma.delegatedAuthority.update({
				where: { id: input.id },
				data: {
					status: 'REVOKED',
					revokedAt: now,
					revokedBy: context.user.id,
					revokeReason: input.reason
				}
			});

			return successResponse(
				{
					delegatedAuthority: {
						id: delegatedAuthority.id,
						status: delegatedAuthority.status,
						revokedAt: delegatedAuthority.revokedAt!.toISOString(),
						revokedBy: delegatedAuthority.revokedBy!
					}
				},
				context
			);
		}),

	/**
	 * Check if a party has specific authority for a property
	 */
	checkAuthority: orgProcedure
		.input(
			z.object({
				propertyId: z.string(),
				partyId: z.string(),
				authorityType: DelegatedAuthorityTypeSchema,
				amount: z.number().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					hasAuthority: z.boolean(),
					authoritySource: z.enum(['OWNER', 'CO_OWNER', 'DELEGATED']).nullable(),
					delegatedAuthorityId: z.string().nullable(),
					monetaryLimit: z.number().nullable(),
					withinLimit: z.boolean().nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Verify property belongs to this organization
			const property = await prisma.individualProperty.findFirst({
				where: { id: input.propertyId, ownerOrgId: context.organization.id }
			});

			if (!property) {
				throw ApiException.notFound('IndividualProperty');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'individual_property', property.id);

			// Check if party is an owner or co-owner (has inherent authority)
			const ownership = await prisma.propertyOwnership.findFirst({
				where: {
					propertyId: input.propertyId,
					partyId: input.partyId,
					role: { in: ['OWNER', 'CO_OWNER'] },
					status: 'ACTIVE',
					deletedAt: null
				}
			});

			if (ownership) {
				return successResponse(
					{
						hasAuthority: true,
						authoritySource: ownership.role as 'OWNER' | 'CO_OWNER',
						delegatedAuthorityId: null,
						monetaryLimit: null,
						withinLimit: null
					},
					context
				);
			}

			// Check for delegated authority
			const delegatedAuthority = await prisma.delegatedAuthority.findFirst({
				where: {
					delegatePartyId: input.partyId,
					authorityType: input.authorityType,
					status: 'ACTIVE',
					OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
					propertyOwnership: {
						propertyId: input.propertyId,
						status: 'ACTIVE',
						deletedAt: null
					}
				}
			});

			if (delegatedAuthority) {
				const monetaryLimit = delegatedAuthority.monetaryLimit
					? Number(delegatedAuthority.monetaryLimit)
					: null;
				const withinLimit =
					input.amount !== undefined && monetaryLimit !== null
						? input.amount <= monetaryLimit
						: null;

				return successResponse(
					{
						hasAuthority: withinLimit !== false,
						authoritySource: 'DELEGATED' as const,
						delegatedAuthorityId: delegatedAuthority.id,
						monetaryLimit,
						withinLimit
					},
					context
				);
			}

			// No authority found
			return successResponse(
				{
					hasAuthority: false,
					authoritySource: null,
					delegatedAuthorityId: null,
					monetaryLimit: null,
					withinLimit: null
				},
				context
			);
		})
};
