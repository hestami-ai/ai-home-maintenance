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
import { PropertyOwnershipRoleSchema } from '../../../../../../generated/zod/inputTypeSchemas/PropertyOwnershipRoleSchema.js';
import { PropertyOwnershipStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/PropertyOwnershipStatusSchema.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('PropertyOwnershipRoute');

/**
 * Property Ownership management procedures for Phase 3 Concierge Platform
 */
export const propertyOwnershipRouter = {
	/**
	 * Create a new property ownership record
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string(),
				partyId: z.string(),
				role: PropertyOwnershipRoleSchema,
				ownershipPercentage: z.number().min(0).max(100).optional(),
				isPrimaryContact: z.boolean().default(false),
				effectiveFrom: z.coerce.date().optional(),
				effectiveTo: z.coerce.date().optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					propertyOwnership: z.object({
						id: z.string(),
						propertyId: z.string(),
						partyId: z.string(),
						role: z.string(),
						status: z.string(),
						ownershipPercentage: z.number().nullable(),
						isPrimaryContact: z.boolean(),
						effectiveFrom: z.string(),
						effectiveTo: z.string().nullable(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'property_ownership', 'new');

			// Verify property belongs to this organization
			const property = await prisma.individualProperty.findFirst({
				where: { id: input.propertyId, ownerOrgId: context.organization.id }
			});

			if (!property) {
				throw ApiException.notFound('IndividualProperty');
			}

			// Verify party belongs to this organization
			const party = await prisma.party.findFirst({
				where: { id: input.partyId, organizationId: context.organization.id }
			});

			if (!party) {
				throw ApiException.notFound('Party');
			}

			// Check if ownership already exists for this property/party/role combination
			const existing = await prisma.propertyOwnership.findFirst({
				where: {
					propertyId: input.propertyId,
					partyId: input.partyId,
					role: input.role,
					deletedAt: null
				}
			});

			if (existing) {
				throw ApiException.conflict('Property ownership already exists for this party and role');
			}

			// Validate: at least one OWNER must exist (or this is creating the first OWNER)
			if (input.role !== 'OWNER') {
				const ownerExists = await prisma.propertyOwnership.findFirst({
					where: {
						propertyId: input.propertyId,
						role: 'OWNER',
						status: 'ACTIVE',
						deletedAt: null
					}
				});

				if (!ownerExists) {
					throw ApiException.badRequest('Cannot add non-owner role without an existing owner');
				}
			}

			// If setting as primary contact, unset other primaries for this property
			if (input.isPrimaryContact) {
				await prisma.propertyOwnership.updateMany({
					where: { propertyId: input.propertyId, isPrimaryContact: true },
					data: { isPrimaryContact: false }
				});
			}

			const propertyOwnership = await prisma.propertyOwnership.create({
				data: {
					propertyId: input.propertyId,
					partyId: input.partyId,
					role: input.role,
					status: 'ACTIVE',
					ownershipPercentage: input.ownershipPercentage,
					isPrimaryContact: input.isPrimaryContact,
					effectiveFrom: input.effectiveFrom ?? new Date(),
					effectiveTo: input.effectiveTo,
					notes: input.notes
				}
			});

			return successResponse(
				{
					propertyOwnership: {
						id: propertyOwnership.id,
						propertyId: propertyOwnership.propertyId,
						partyId: propertyOwnership.partyId,
						role: propertyOwnership.role,
						status: propertyOwnership.status,
						ownershipPercentage: propertyOwnership.ownershipPercentage
							? Number(propertyOwnership.ownershipPercentage)
							: null,
						isPrimaryContact: propertyOwnership.isPrimaryContact,
						effectiveFrom: propertyOwnership.effectiveFrom.toISOString(),
						effectiveTo: propertyOwnership.effectiveTo?.toISOString() ?? null,
						createdAt: propertyOwnership.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get property ownership by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					propertyOwnership: z.object({
						id: z.string(),
						propertyId: z.string(),
						partyId: z.string(),
						role: z.string(),
						status: z.string(),
						ownershipPercentage: z.number().nullable(),
						isPrimaryContact: z.boolean(),
						verifiedAt: z.string().nullable(),
						verifiedBy: z.string().nullable(),
						effectiveFrom: z.string(),
						effectiveTo: z.string().nullable(),
						notes: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					property: z.object({
						id: z.string(),
						name: z.string(),
						addressLine1: z.string(),
						city: z.string(),
						state: z.string()
					}),
					party: z.object({
						id: z.string(),
						displayName: z.string(),
						partyType: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const propertyOwnership = await prisma.propertyOwnership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: {
					property: true,
					party: true
				}
			});

			if (!propertyOwnership || propertyOwnership.property.ownerOrgId !== context.organization.id) {
				throw ApiException.notFound('PropertyOwnership');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'property_ownership', propertyOwnership.id, {
				partyUserId: propertyOwnership.party.userId ?? undefined
			});

			const displayName =
				propertyOwnership.party.partyType === 'INDIVIDUAL'
					? `${propertyOwnership.party.firstName ?? ''} ${propertyOwnership.party.lastName ?? ''}`.trim()
					: propertyOwnership.party.entityName ?? '';

			return successResponse(
				{
					propertyOwnership: {
						id: propertyOwnership.id,
						propertyId: propertyOwnership.propertyId,
						partyId: propertyOwnership.partyId,
						role: propertyOwnership.role,
						status: propertyOwnership.status,
						ownershipPercentage: propertyOwnership.ownershipPercentage
							? Number(propertyOwnership.ownershipPercentage)
							: null,
						isPrimaryContact: propertyOwnership.isPrimaryContact,
						verifiedAt: propertyOwnership.verifiedAt?.toISOString() ?? null,
						verifiedBy: propertyOwnership.verifiedBy,
						effectiveFrom: propertyOwnership.effectiveFrom.toISOString(),
						effectiveTo: propertyOwnership.effectiveTo?.toISOString() ?? null,
						notes: propertyOwnership.notes,
						createdAt: propertyOwnership.createdAt.toISOString(),
						updatedAt: propertyOwnership.updatedAt.toISOString()
					},
					property: {
						id: propertyOwnership.property.id,
						name: propertyOwnership.property.name,
						addressLine1: propertyOwnership.property.addressLine1,
						city: propertyOwnership.property.city,
						state: propertyOwnership.property.state
					},
					party: {
						id: propertyOwnership.party.id,
						displayName,
						partyType: propertyOwnership.party.partyType
					}
				},
				context
			);
		}),

	/**
	 * List property ownerships by property
	 */
	listByProperty: orgProcedure
		.input(
			PaginationInputSchema.extend({
				propertyId: z.string(),
				status: PropertyOwnershipStatusSchema.optional(),
				role: PropertyOwnershipRoleSchema.optional(),
				includeTerminated: z.boolean().default(false)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					propertyOwnerships: z.array(
						z.object({
							id: z.string(),
							partyId: z.string(),
							partyName: z.string(),
							partyType: z.string(),
							role: z.string(),
							status: z.string(),
							ownershipPercentage: z.number().nullable(),
							isPrimaryContact: z.boolean(),
							effectiveFrom: z.string(),
							effectiveTo: z.string().nullable()
						})
					),
					pagination: PaginationOutputSchema
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

			// Cerbos authorization for viewing property's ownerships
			await context.cerbos.authorize('view', 'individual_property', property.id);

			const whereClause = {
				propertyId: input.propertyId,
				deletedAt: null,
				...(input.status && { status: input.status }),
				...(input.role && { role: input.role }),
				...(!input.includeTerminated && { status: { not: 'TERMINATED' as const } })
			};

			const propertyOwnerships = await prisma.propertyOwnership.findMany({
				where: whereClause,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: [{ isPrimaryContact: 'desc' }, { role: 'asc' }, { createdAt: 'desc' }],
				include: { party: true }
			});

			const hasMore = propertyOwnerships.length > input.limit;
			const items = hasMore ? propertyOwnerships.slice(0, -1) : propertyOwnerships;

			return successResponse(
				{
					propertyOwnerships: items.map((po) => ({
						id: po.id,
						partyId: po.partyId,
						partyName:
							po.party.partyType === 'INDIVIDUAL'
								? `${po.party.firstName ?? ''} ${po.party.lastName ?? ''}`.trim()
								: po.party.entityName ?? '',
						partyType: po.party.partyType,
						role: po.role,
						status: po.status,
						ownershipPercentage: po.ownershipPercentage ? Number(po.ownershipPercentage) : null,
						isPrimaryContact: po.isPrimaryContact,
						effectiveFrom: po.effectiveFrom.toISOString(),
						effectiveTo: po.effectiveTo?.toISOString() ?? null
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
	 * List property ownerships by party
	 */
	listByParty: orgProcedure
		.input(
			PaginationInputSchema.extend({
				partyId: z.string(),
				status: PropertyOwnershipStatusSchema.optional(),
				includeTerminated: z.boolean().default(false)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					propertyOwnerships: z.array(
						z.object({
							id: z.string(),
							propertyId: z.string(),
							propertyName: z.string(),
							propertyAddress: z.string(),
							role: z.string(),
							status: z.string(),
							ownershipPercentage: z.number().nullable(),
							isPrimaryContact: z.boolean(),
							effectiveFrom: z.string(),
							effectiveTo: z.string().nullable()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Verify party belongs to this organization
			const party = await prisma.party.findFirst({
				where: { id: input.partyId, organizationId: context.organization.id }
			});

			if (!party) {
				throw ApiException.notFound('Party');
			}

			// Cerbos authorization for viewing party's ownerships
			await context.cerbos.authorize('view', 'party', party.id, {
				partyUserId: party.userId ?? undefined
			});

			const whereClause = {
				partyId: input.partyId,
				deletedAt: null,
				...(input.status && { status: input.status }),
				...(!input.includeTerminated && { status: { not: 'TERMINATED' as const } })
			};

			const propertyOwnerships = await prisma.propertyOwnership.findMany({
				where: whereClause,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: [{ isPrimaryContact: 'desc' }, { createdAt: 'desc' }],
				include: { property: true }
			});

			const hasMore = propertyOwnerships.length > input.limit;
			const items = hasMore ? propertyOwnerships.slice(0, -1) : propertyOwnerships;

			return successResponse(
				{
					propertyOwnerships: items.map((po) => ({
						id: po.id,
						propertyId: po.propertyId,
						propertyName: po.property.name,
						propertyAddress: `${po.property.addressLine1}, ${po.property.city}, ${po.property.state}`,
						role: po.role,
						status: po.status,
						ownershipPercentage: po.ownershipPercentage ? Number(po.ownershipPercentage) : null,
						isPrimaryContact: po.isPrimaryContact,
						effectiveFrom: po.effectiveFrom.toISOString(),
						effectiveTo: po.effectiveTo?.toISOString() ?? null
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
	 * Update property ownership
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				ownershipPercentage: z.number().min(0).max(100).optional(),
				isPrimaryContact: z.boolean().optional(),
				effectiveTo: z.coerce.date().optional().nullable(),
				notes: z.string().optional().nullable()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					propertyOwnership: z.object({
						id: z.string(),
						ownershipPercentage: z.number().nullable(),
						isPrimaryContact: z.boolean(),
						effectiveTo: z.string().nullable(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.propertyOwnership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { property: true }
			});

			if (!existing || existing.property.ownerOrgId !== context.organization.id) {
				throw ApiException.notFound('PropertyOwnership');
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'property_ownership', existing.id);

			// If setting as primary contact, unset other primaries for this property
			if (input.isPrimaryContact === true) {
				await prisma.propertyOwnership.updateMany({
					where: {
						propertyId: existing.propertyId,
						isPrimaryContact: true,
						id: { not: input.id }
					},
					data: { isPrimaryContact: false }
				});
			}

			const propertyOwnership = await prisma.propertyOwnership.update({
				where: { id: input.id },
				data: {
					...(input.ownershipPercentage !== undefined && {
						ownershipPercentage: input.ownershipPercentage
					}),
					...(input.isPrimaryContact !== undefined && { isPrimaryContact: input.isPrimaryContact }),
					...(input.effectiveTo !== undefined && { effectiveTo: input.effectiveTo }),
					...(input.notes !== undefined && { notes: input.notes })
				}
			});

			return successResponse(
				{
					propertyOwnership: {
						id: propertyOwnership.id,
						ownershipPercentage: propertyOwnership.ownershipPercentage
							? Number(propertyOwnership.ownershipPercentage)
							: null,
						isPrimaryContact: propertyOwnership.isPrimaryContact,
						effectiveTo: propertyOwnership.effectiveTo?.toISOString() ?? null,
						updatedAt: propertyOwnership.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Verify property ownership
	 */
	verify: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					propertyOwnership: z.object({
						id: z.string(),
						status: z.string(),
						verifiedAt: z.string(),
						verifiedBy: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.propertyOwnership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { property: true }
			});

			if (!existing || existing.property.ownerOrgId !== context.organization.id) {
				throw ApiException.notFound('PropertyOwnership');
			}

			// Cerbos authorization - requires admin or concierge role
			await context.cerbos.authorize('verify', 'property_ownership', existing.id);

			const now = new Date();
			const propertyOwnership = await prisma.propertyOwnership.update({
				where: { id: input.id },
				data: {
					status: 'ACTIVE',
					verifiedAt: now,
					verifiedBy: context.user.id
				}
			});

			return successResponse(
				{
					propertyOwnership: {
						id: propertyOwnership.id,
						status: propertyOwnership.status,
						verifiedAt: propertyOwnership.verifiedAt!.toISOString(),
						verifiedBy: propertyOwnership.verifiedBy!
					}
				},
				context
			);
		}),

	/**
	 * Terminate property ownership
	 */
	terminate: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				effectiveTo: z.coerce.date().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					propertyOwnership: z.object({
						id: z.string(),
						status: z.string(),
						effectiveTo: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.propertyOwnership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { property: true }
			});

			if (!existing || existing.property.ownerOrgId !== context.organization.id) {
				throw ApiException.notFound('PropertyOwnership');
			}

			// Cerbos authorization
			await context.cerbos.authorize('terminate', 'property_ownership', existing.id);

			// Check if this is the last OWNER - cannot terminate
			if (existing.role === 'OWNER') {
				const otherOwners = await prisma.propertyOwnership.count({
					where: {
						propertyId: existing.propertyId,
						role: 'OWNER',
						status: 'ACTIVE',
						id: { not: input.id },
						deletedAt: null
					}
				});

				if (otherOwners === 0) {
					throw ApiException.badRequest('Cannot terminate the last owner of a property');
				}
			}

			const effectiveTo = input.effectiveTo ?? new Date();
			const propertyOwnership = await prisma.propertyOwnership.update({
				where: { id: input.id },
				data: {
					status: 'TERMINATED',
					effectiveTo,
					isPrimaryContact: false
				}
			});

			// Also revoke any delegated authorities from this ownership
			await prisma.delegatedAuthority.updateMany({
				where: {
					propertyOwnershipId: input.id,
					status: 'ACTIVE'
				},
				data: {
					status: 'REVOKED',
					revokedAt: new Date(),
					revokedBy: context.user.id,
					revokeReason: 'Property ownership terminated'
				}
			});

			return successResponse(
				{
					propertyOwnership: {
						id: propertyOwnership.id,
						status: propertyOwnership.status,
						effectiveTo: propertyOwnership.effectiveTo!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Soft delete a property ownership record
	 */
	delete: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string()
			})
		)
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
		.handler(async ({ input, context }) => {
			const existing = await prisma.propertyOwnership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { property: true }
			});

			if (!existing || existing.property.ownerOrgId !== context.organization.id) {
				throw ApiException.notFound('PropertyOwnership');
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'property_ownership', existing.id);

			// Check if this is the last OWNER - cannot delete
			if (existing.role === 'OWNER') {
				const otherOwners = await prisma.propertyOwnership.count({
					where: {
						propertyId: existing.propertyId,
						role: 'OWNER',
						status: 'ACTIVE',
						id: { not: input.id },
						deletedAt: null
					}
				});

				if (otherOwners === 0) {
					throw ApiException.badRequest('Cannot delete the last owner of a property');
				}
			}

			const now = new Date();
			await prisma.propertyOwnership.update({
				where: { id: input.id },
				data: { deletedAt: now }
			});

			// Also soft delete any delegated authorities from this ownership
			await prisma.delegatedAuthority.updateMany({
				where: { propertyOwnershipId: input.id },
				data: {
					status: 'REVOKED',
					revokedAt: now,
					revokedBy: context.user.id,
					revokeReason: 'Property ownership deleted'
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
