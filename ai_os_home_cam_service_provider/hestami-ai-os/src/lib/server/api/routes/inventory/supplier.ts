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

const supplierOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	code: z.string().nullable(),
	contactName: z.string().nullable(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	website: z.string().nullable(),
	addressLine1: z.string().nullable(),
	addressLine2: z.string().nullable(),
	city: z.string().nullable(),
	state: z.string().nullable(),
	postalCode: z.string().nullable(),
	country: z.string().nullable(),
	paymentTermsDays: z.number().nullable(),
	creditLimit: z.string().nullable(),
	vendorId: z.string().nullable(),
	notes: z.string().nullable(),
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatSupplier = (s: any) => ({
	id: s.id,
	organizationId: s.organizationId,
	name: s.name,
	code: s.code,
	contactName: s.contactName,
	email: s.email,
	phone: s.phone,
	website: s.website,
	addressLine1: s.addressLine1,
	addressLine2: s.addressLine2,
	city: s.city,
	state: s.state,
	postalCode: s.postalCode,
	country: s.country,
	paymentTermsDays: s.paymentTermsDays,
	creditLimit: s.creditLimit?.toString() ?? null,
	vendorId: s.vendorId,
	notes: s.notes,
	isActive: s.isActive,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString()
});

export const supplierRouter = {
	create: orgProcedure
		.input(
			z
				.object({
					name: z.string().min(1),
					code: z.string().optional(),
					contactName: z.string().optional(),
					email: z.string().email().optional(),
					phone: z.string().optional(),
					website: z.string().url().optional(),
					addressLine1: z.string().optional(),
					addressLine2: z.string().optional(),
					city: z.string().optional(),
					state: z.string().optional(),
					postalCode: z.string().optional(),
					country: z.string().optional(),
					paymentTermsDays: z.number().int().positive().optional(),
					creditLimit: z.number().nonnegative().optional(),
					vendorId: z.string().optional(),
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ supplier: supplierOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'supplier', 'new');

			const createSupplier = async () => {
				return prisma.supplier.create({
					data: {
						organizationId: context.organization!.id,
						name: input.name,
						code: input.code,
						contactName: input.contactName,
						email: input.email,
						phone: input.phone,
						website: input.website,
						addressLine1: input.addressLine1,
						addressLine2: input.addressLine2,
						city: input.city,
						state: input.state,
						postalCode: input.postalCode,
						country: input.country,
						paymentTermsDays: input.paymentTermsDays,
						creditLimit: input.creditLimit,
						vendorId: input.vendorId,
						notes: input.notes
					}
				});
			};

			const supplier = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createSupplier)).result
				: await createSupplier();

			return successResponse({ supplier: formatSupplier(supplier) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ supplier: supplierOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'supplier', input.id);

			const supplier = await prisma.supplier.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});

			if (!supplier) throw ApiException.notFound('Supplier');

			return successResponse({ supplier: formatSupplier(supplier) }, context);
		}),

	list: orgProcedure
		.input(
			z
				.object({
					isActive: z.boolean().optional(),
					search: z.string().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					suppliers: z.array(supplierOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'supplier', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				organizationId: context.organization!.id,
				deletedAt: null,
				...(input?.isActive !== undefined && { isActive: input.isActive })
			};

			if (input?.search) {
				where.OR = [
					{ name: { contains: input.search, mode: 'insensitive' } },
					{ code: { contains: input.search, mode: 'insensitive' } }
				];
			}

			const suppliers = await prisma.supplier.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { name: 'asc' }
			});

			const hasMore = suppliers.length > limit;
			if (hasMore) suppliers.pop();

			const nextCursor = hasMore ? suppliers[suppliers.length - 1]?.id ?? null : null;

			return successResponse(
				{
					suppliers: suppliers.map(formatSupplier),
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
					contactName: z.string().nullable().optional(),
					email: z.string().email().nullable().optional(),
					phone: z.string().nullable().optional(),
					website: z.string().url().nullable().optional(),
					addressLine1: z.string().nullable().optional(),
					addressLine2: z.string().nullable().optional(),
					city: z.string().nullable().optional(),
					state: z.string().nullable().optional(),
					postalCode: z.string().nullable().optional(),
					country: z.string().nullable().optional(),
					paymentTermsDays: z.number().int().positive().nullable().optional(),
					creditLimit: z.number().nonnegative().nullable().optional(),
					vendorId: z.string().nullable().optional(),
					notes: z.string().nullable().optional(),
					isActive: z.boolean().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ supplier: supplierOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'supplier', input.id);

			const existing = await prisma.supplier.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Supplier');

			const updateSupplier = async () => {
				const { id, idempotencyKey, ...data } = input;
				return prisma.supplier.update({
					where: { id: input.id },
					data
				});
			};

			const supplier = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateSupplier)).result
				: await updateSupplier();

			return successResponse({ supplier: formatSupplier(supplier) }, context);
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
			await context.cerbos.authorize('delete', 'supplier', input.id);

			const existing = await prisma.supplier.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Supplier');

			const deleteSupplier = async () => {
				await prisma.supplier.update({
					where: { id: input.id },
					data: { deletedAt: new Date() }
				});
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteSupplier)).result
				: await deleteSupplier();

			return successResponse(result, context);
		})
};
