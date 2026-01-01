import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { InventoryLocationType } from '../../../../../../generated/prisma/client.js';
import { startInventoryLocationWorkflow } from '../../../workflows/inventoryLocationWorkflow.js';

const inventoryLocationOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	code: z.string().nullable(),
	type: z.nativeEnum(InventoryLocationType),
	description: z.string().nullable(),
	addressLine1: z.string().nullable(),
	addressLine2: z.string().nullable(),
	city: z.string().nullable(),
	state: z.string().nullable(),
	postalCode: z.string().nullable(),
	technicianId: z.string().nullable(),
	branchId: z.string().nullable(),
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatLocation = (l: any) => ({
	id: l.id,
	organizationId: l.organizationId,
	name: l.name,
	code: l.code,
	type: l.type,
	description: l.description,
	addressLine1: l.addressLine1,
	addressLine2: l.addressLine2,
	city: l.city,
	state: l.state,
	postalCode: l.postalCode,
	technicianId: l.technicianId,
	branchId: l.branchId,
	isActive: l.isActive,
	createdAt: l.createdAt.toISOString(),
	updatedAt: l.updatedAt.toISOString()
});

export const inventoryLocationRouter = {
	create: orgProcedure
		.input(
			z
				.object({
					name: z.string().min(1),
					code: z.string().optional(),
					type: z.nativeEnum(InventoryLocationType),
					description: z.string().optional(),
					addressLine1: z.string().optional(),
					addressLine2: z.string().optional(),
					city: z.string().optional(),
					state: z.string().optional(),
					postalCode: z.string().optional(),
					technicianId: z.string().optional(),
					branchId: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ location: inventoryLocationOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'inventory_location', 'new');

			// Validate technician if provided
			if (input.technicianId) {
				const tech = await prisma.technician.findFirst({
					where: { id: input.technicianId, organizationId: context.organization!.id }
				});
				if (!tech) throw errors.NOT_FOUND({ message: 'Technician not found' });
			}

			// Validate branch if provided
			if (input.branchId) {
				const branch = await prisma.contractorBranch.findFirst({
					where: { id: input.branchId, organizationId: context.organization!.id }
				});
				if (!branch) throw errors.NOT_FOUND({ message: 'Branch not found' });
			}

			// Use DBOS workflow for durable execution
			const result = await startInventoryLocationWorkflow(
				{
					action: 'CREATE_LOCATION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						name: input.name,
						code: input.code,
						type: input.type,
						description: input.description,
						addressLine1: input.addressLine1,
						addressLine2: input.addressLine2,
						city: input.city,
						state: input.state,
						postalCode: input.postalCode,
						technicianId: input.technicianId,
						branchId: input.branchId
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create location' });
			}

			const location = await prisma.inventoryLocation.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ location: formatLocation(location) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ location: inventoryLocationOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'inventory_location', input.id);

			const location = await prisma.inventoryLocation.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});

			if (!location) throw errors.NOT_FOUND({ message: 'Inventory location not found' });

			return successResponse({ location: formatLocation(location) }, context);
		}),

	list: orgProcedure
		.input(
			z
				.object({
					type: z.nativeEnum(InventoryLocationType).optional(),
					technicianId: z.string().optional(),
					branchId: z.string().optional(),
					isActive: z.boolean().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					locations: z.array(inventoryLocationOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'inventory_location', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization!.id,
				deletedAt: null,
				...(input?.type && { type: input.type }),
				...(input?.technicianId && { technicianId: input.technicianId }),
				...(input?.branchId && { branchId: input.branchId }),
				...(input?.isActive !== undefined && { isActive: input.isActive })
			};

			const locations = await prisma.inventoryLocation.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { name: 'asc' }
			});

			const hasMore = locations.length > limit;
			if (hasMore) locations.pop();

			const nextCursor = hasMore ? locations[locations.length - 1]?.id ?? null : null;

			return successResponse(
				{
					locations: locations.map(formatLocation),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					name: z.string().min(1).optional(),
					code: z.string().nullable().optional(),
					description: z.string().nullable().optional(),
					addressLine1: z.string().nullable().optional(),
					addressLine2: z.string().nullable().optional(),
					city: z.string().nullable().optional(),
					state: z.string().nullable().optional(),
					postalCode: z.string().nullable().optional(),
					technicianId: z.string().nullable().optional(),
					branchId: z.string().nullable().optional(),
					isActive: z.boolean().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ location: inventoryLocationOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'inventory_location', input.id);

			const existing = await prisma.inventoryLocation.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Inventory location not found' });

			const { id, idempotencyKey, ...data } = input;

			// Use DBOS workflow for durable execution
			const result = await startInventoryLocationWorkflow(
				{
					action: 'UPDATE_LOCATION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					locationId: input.id,
					data
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update location' });
			}

			const location = await prisma.inventoryLocation.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ location: formatLocation(location) }, context);
		}),

	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('delete', 'inventory_location', input.id);

			const existing = await prisma.inventoryLocation.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Inventory location not found' });

			// Check if location has inventory
			const hasInventory = await prisma.inventoryLevel.findFirst({
				where: { locationId: input.id, quantityOnHand: { gt: 0 } }
			});
			if (hasInventory) {
				throw errors.BAD_REQUEST({ message: 'Cannot delete location with inventory. Transfer stock first.' });
			}

			// Use DBOS workflow for durable execution
			const result = await startInventoryLocationWorkflow(
				{
					action: 'DELETE_LOCATION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					locationId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete location' });
			}

			return successResponse({ deleted: true }, context);
		})
};
