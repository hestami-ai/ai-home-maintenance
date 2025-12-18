import { z } from 'zod';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { InventoryLocationType } from '../../../../../../generated/prisma/client.js';

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ location: inventoryLocationOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'inventory_location', 'new');

			// Validate technician if provided
			if (input.technicianId) {
				const tech = await prisma.technician.findFirst({
					where: { id: input.technicianId, organizationId: context.organization!.id }
				});
				if (!tech) throw ApiException.notFound('Technician');
			}

			// Validate branch if provided
			if (input.branchId) {
				const branch = await prisma.contractorBranch.findFirst({
					where: { id: input.branchId, organizationId: context.organization!.id }
				});
				if (!branch) throw ApiException.notFound('Branch');
			}

			const createLocation = async () => {
				return prisma.inventoryLocation.create({
					data: {
						organizationId: context.organization!.id,
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
				});
			};

			const location = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createLocation)).result
				: await createLocation();

			return successResponse({ location: formatLocation(location) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ location: inventoryLocationOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'inventory_location', input.id);

			const location = await prisma.inventoryLocation.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});

			if (!location) throw ApiException.notFound('Inventory location');

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					locations: z.array(inventoryLocationOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ location: inventoryLocationOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'inventory_location', input.id);

			const existing = await prisma.inventoryLocation.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Inventory location');

			const updateLocation = async () => {
				const { id, idempotencyKey, ...data } = input;
				return prisma.inventoryLocation.update({
					where: { id: input.id },
					data
				});
			};

			const location = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateLocation)).result
				: await updateLocation();

			return successResponse({ location: formatLocation(location) }, context);
		}),

	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'inventory_location', input.id);

			const existing = await prisma.inventoryLocation.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Inventory location');

			// Check if location has inventory
			const hasInventory = await prisma.inventoryLevel.findFirst({
				where: { locationId: input.id, quantityOnHand: { gt: 0 } }
			});
			if (hasInventory) {
				throw ApiException.badRequest('Cannot delete location with inventory. Transfer stock first.');
			}

			const deleteLocation = async () => {
				await prisma.inventoryLocation.update({
					where: { id: input.id },
					data: { deletedAt: new Date() }
				});
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteLocation)).result
				: await deleteLocation();

			return successResponse(result, context);
		})
};
