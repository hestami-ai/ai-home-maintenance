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
import { PropertyOwnershipRoleSchema } from '../../../../../../generated/zod/inputTypeSchemas/PropertyOwnershipRoleSchema.js';
import { PropertyOwnershipStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/PropertyOwnershipStatusSchema.js';
import { PartyType, PropertyOwnershipRole, PropertyOwnershipStatus } from '../../../../../../generated/prisma/enums.js';
import { createModuleLogger } from '../../../logger.js';
import { startPropertyOwnershipWorkflow, PropertyOwnershipWorkflowAction } from '../../../workflows/index.js';

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Resource already exists' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'property_ownership', 'new');

			// Verify property belongs to this organization
			const property = await prisma.individualProperty.findFirst({
				where: { id: input.propertyId, ownerOrgId: context.organization.id }
			});

			if (!property) {
				throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
			}

			// Verify party belongs to this organization
			const party = await prisma.party.findFirst({
				where: { id: input.partyId, organizationId: context.organization.id }
			});

			if (!party) {
				throw errors.NOT_FOUND({ message: 'Party not found' });
			}

			// Check if ownership already exists for this property/party/role combination
			// Defense in depth: explicit org filter via property relationship for connection pool safety
			const existing = await prisma.propertyOwnership.findFirst({
				where: {
					propertyId: input.propertyId,
					partyId: input.partyId,
					role: input.role,
					deletedAt: null,
					property: { ownerOrgId: context.organization.id }
				}
			});

			if (existing) {
				throw errors.CONFLICT({ message: 'Property ownership already exists for this party and role' });
			}

			// Validate: at least one OWNER must exist (or this is creating the first OWNER)
			if (input.role !== PropertyOwnershipRole.OWNER) {
				// Defense in depth: explicit org filter via property relationship for connection pool safety
				const ownerExists = await prisma.propertyOwnership.findFirst({
					where: {
						propertyId: input.propertyId,
						role: PropertyOwnershipRole.OWNER,
						status: PropertyOwnershipStatus.ACTIVE,
						deletedAt: null,
						property: { ownerOrgId: context.organization.id }
					}
				});

				if (!ownerExists) {
					throw errors.BAD_REQUEST({ message: 'Cannot add non-owner role without an existing owner' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startPropertyOwnershipWorkflow(
				{
					action: PropertyOwnershipWorkflowAction.CREATE,
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId: input.propertyId,
					partyId: input.partyId,
					role: input.role,
					ownershipPercentage: input.ownershipPercentage,
					isPrimaryContact: input.isPrimaryContact,
					effectiveFrom: input.effectiveFrom,
					effectiveTo: input.effectiveTo,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create property ownership' });
			}

			return successResponse(
				{
					propertyOwnership: {
						id: workflowResult.propertyOwnershipId!,
						propertyId: workflowResult.propertyId!,
						partyId: workflowResult.partyId!,
						role: workflowResult.role!,
						status: workflowResult.status!,
						ownershipPercentage: workflowResult.ownershipPercentage ?? null,
						isPrimaryContact: workflowResult.isPrimaryContact!,
						effectiveFrom: workflowResult.effectiveFrom!,
						effectiveTo: workflowResult.effectiveTo ?? null,
						createdAt: workflowResult.createdAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// Defense in depth: explicit org filter via property relationship for connection pool safety
			const propertyOwnership = await prisma.propertyOwnership.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					property: { ownerOrgId: context.organization.id }
				},
				include: {
					property: true,
					party: true
				}
			});

			if (!propertyOwnership) {
				throw errors.NOT_FOUND({ message: 'PropertyOwnership not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'property_ownership', propertyOwnership.id, {
				partyUserId: propertyOwnership.party.userId ?? undefined
			});

			const displayName =
				propertyOwnership.party.partyType === PartyType.INDIVIDUAL
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// Verify property belongs to this organization
			const property = await prisma.individualProperty.findFirst({
				where: { id: input.propertyId, ownerOrgId: context.organization.id }
			});

			if (!property) {
				throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
			}

			// Cerbos authorization for viewing property's ownerships
			await context.cerbos.authorize('view', 'individual_property', property.id);

			// Defense in depth: explicit org filter via property relationship for connection pool safety
			const propertyOwnerships = await prisma.propertyOwnership.findMany({
				where: {
					propertyId: input.propertyId,
					deletedAt: null,
					property: { ownerOrgId: context.organization.id },
					...(input.status && { status: input.status }),
					...(input.role && { role: input.role }),
					...(!input.includeTerminated && { status: { not: 'TERMINATED' as const } })
				},
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
							po.party.partyType === PartyType.INDIVIDUAL
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// Verify party belongs to this organization
			const party = await prisma.party.findFirst({
				where: { id: input.partyId, organizationId: context.organization.id }
			});

			if (!party) {
				throw errors.NOT_FOUND({ message: 'Party not found' });
			}

			// Cerbos authorization for viewing party's ownerships
			await context.cerbos.authorize('view', 'party', party.id, {
				partyUserId: party.userId ?? undefined
			});

			// Defense in depth: explicit org filter via property relationship for connection pool safety
			const propertyOwnerships = await prisma.propertyOwnership.findMany({
				where: {
					partyId: input.partyId,
					deletedAt: null,
					property: { ownerOrgId: context.organization.id },
					...(input.status && { status: input.status }),
					...(!input.includeTerminated && { status: { not: 'TERMINATED' as const } })
				},
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// Defense in depth: explicit org filter via property relationship for connection pool safety
			const existing = await prisma.propertyOwnership.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					property: { ownerOrgId: context.organization.id }
				},
				include: { property: true }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'PropertyOwnership not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'property_ownership', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startPropertyOwnershipWorkflow(
				{
					action: PropertyOwnershipWorkflowAction.UPDATE,
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyOwnershipId: input.id,
					propertyId: existing.propertyId,
					ownershipPercentage: input.ownershipPercentage,
					isPrimaryContact: input.isPrimaryContact,
					effectiveTo: input.effectiveTo,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to update property ownership' });
			}

			return successResponse(
				{
					propertyOwnership: {
						id: workflowResult.propertyOwnershipId!,
						ownershipPercentage: workflowResult.ownershipPercentage ?? null,
						isPrimaryContact: workflowResult.isPrimaryContact!,
						effectiveTo: workflowResult.effectiveTo ?? null,
						updatedAt: workflowResult.updatedAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// Defense in depth: explicit org filter via property relationship for connection pool safety
			const existing = await prisma.propertyOwnership.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					property: { ownerOrgId: context.organization.id }
				},
				include: { property: true }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'PropertyOwnership not found' });
			}

			// Cerbos authorization - requires admin or concierge role
			await context.cerbos.authorize('verify', 'property_ownership', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startPropertyOwnershipWorkflow(
				{
					action: PropertyOwnershipWorkflowAction.VERIFY,
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyOwnershipId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to verify property ownership' });
			}

			return successResponse(
				{
					propertyOwnership: {
						id: workflowResult.propertyOwnershipId!,
						status: workflowResult.status!,
						verifiedAt: workflowResult.verifiedAt!,
						verifiedBy: workflowResult.verifiedBy!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// Defense in depth: explicit org filter via property relationship for connection pool safety
			const existing = await prisma.propertyOwnership.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					property: { ownerOrgId: context.organization.id }
				},
				include: { property: true }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'PropertyOwnership not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('terminate', 'property_ownership', existing.id);

			// Check if this is the last OWNER - cannot terminate
			if (existing.role === PropertyOwnershipRole.OWNER) {
				// Defense in depth: explicit org filter via property relationship for connection pool safety
				const otherOwners = await prisma.propertyOwnership.count({
					where: {
						propertyId: existing.propertyId,
						role: PropertyOwnershipRole.OWNER,
						status: PropertyOwnershipStatus.ACTIVE,
						id: { not: input.id },
						deletedAt: null,
						property: { ownerOrgId: context.organization.id }
					}
				});

				if (otherOwners === 0) {
					throw errors.BAD_REQUEST({ message: 'Cannot terminate the last owner of a property' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startPropertyOwnershipWorkflow(
				{
					action: PropertyOwnershipWorkflowAction.TERMINATE,
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyOwnershipId: input.id,
					effectiveTo: input.effectiveTo
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to terminate property ownership' });
			}

			return successResponse(
				{
					propertyOwnership: {
						id: workflowResult.propertyOwnershipId!,
						status: workflowResult.status!,
						effectiveTo: workflowResult.effectiveTo!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// Defense in depth: explicit org filter via property relationship for connection pool safety
			const existing = await prisma.propertyOwnership.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					property: { ownerOrgId: context.organization.id }
				},
				include: { property: true }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'PropertyOwnership not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'property_ownership', existing.id);

			// Check if this is the last OWNER - cannot delete
			if (existing.role === PropertyOwnershipRole.OWNER) {
				// Defense in depth: explicit org filter via property relationship for connection pool safety
				const otherOwners = await prisma.propertyOwnership.count({
					where: {
						propertyId: existing.propertyId,
						role: PropertyOwnershipRole.OWNER,
						status: PropertyOwnershipStatus.ACTIVE,
						id: { not: input.id },
						deletedAt: null,
						property: { ownerOrgId: context.organization.id }
					}
				});

				if (otherOwners === 0) {
					throw errors.BAD_REQUEST({ message: 'Cannot delete the last owner of a property' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startPropertyOwnershipWorkflow(
				{
					action: PropertyOwnershipWorkflowAction.DELETE,
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyOwnershipId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to delete property ownership' });
			}

			return successResponse(
				{
					success: true,
					deletedAt: workflowResult.deletedAt!
				},
				context
			);
		})
};
