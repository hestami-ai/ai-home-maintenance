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
import { startCustomerWorkflow } from '../../../workflows/customerWorkflow.js';

const customerOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	companyName: z.string().nullable(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	altPhone: z.string().nullable(),
	addressLine1: z.string().nullable(),
	addressLine2: z.string().nullable(),
	city: z.string().nullable(),
	state: z.string().nullable(),
	postalCode: z.string().nullable(),
	country: z.string().nullable(),
	notes: z.string().nullable(),
	tags: z.array(z.string()),
	source: z.string().nullable(),
	referredBy: z.string().nullable(),
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatCustomer = (c: {
	id: string;
	organizationId: string;
	name: string;
	companyName: string | null;
	email: string | null;
	phone: string | null;
	altPhone: string | null;
	addressLine1: string | null;
	addressLine2: string | null;
	city: string | null;
	state: string | null;
	postalCode: string | null;
	country: string | null;
	notes: string | null;
	tags: string[];
	source: string | null;
	referredBy: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}) => ({
	id: c.id,
	organizationId: c.organizationId,
	name: c.name,
	companyName: c.companyName,
	email: c.email,
	phone: c.phone,
	altPhone: c.altPhone,
	addressLine1: c.addressLine1,
	addressLine2: c.addressLine2,
	city: c.city,
	state: c.state,
	postalCode: c.postalCode,
	country: c.country,
	notes: c.notes,
	tags: c.tags,
	source: c.source,
	referredBy: c.referredBy,
	isActive: c.isActive,
	createdAt: c.createdAt.toISOString(),
	updatedAt: c.updatedAt.toISOString()
});

export const customerRouter = {
	/**
	 * Create a new customer
	 */
	create: orgProcedure
		.input(
			z
				.object({
					name: z.string().min(1).max(255),
					companyName: z.string().max(255).optional(),
					email: z.string().email().optional(),
					phone: z.string().max(50).optional(),
					altPhone: z.string().max(50).optional(),
					addressLine1: z.string().max(255).optional(),
					addressLine2: z.string().max(255).optional(),
					city: z.string().max(100).optional(),
					state: z.string().max(100).optional(),
					postalCode: z.string().max(20).optional(),
					country: z.string().max(2).default('US'),
					notes: z.string().optional(),
					tags: z.array(z.string()).default([]),
					source: z.string().max(100).optional(),
					referredBy: z.string().max(255).optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ customer: customerOutput }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Forbidden' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'customer', 'new');

			// Use DBOS workflow for durable execution
			const result = await startCustomerWorkflow(
				{
					action: 'CREATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						displayName: input.name,
						companyName: input.companyName,
						email: input.email,
						phone: input.phone,
						alternatePhone: input.altPhone,
						addressLine1: input.addressLine1,
						addressLine2: input.addressLine2,
						city: input.city,
						state: input.state,
						postalCode: input.postalCode,
						country: input.country,
						notes: input.notes,
						tags: input.tags
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create customer' });
			}

			const customer = await prisma.customer.findFirstOrThrow({
				where: { id: result.customerId, organizationId: context.organization.id }
			});

			return successResponse({ customer: formatCustomer(customer) }, context);
		}),

	/**
	 * List customers with pagination and filtering
	 */
	list: orgProcedure
		.input(
			z
				.object({
					search: z.string().optional(),
					isActive: z.boolean().optional(),
					tags: z.array(z.string()).optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					customers: z.array(customerOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Forbidden' }
		})
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'customer', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization!.id,
				deletedAt: null,
				...(input?.isActive !== undefined && { isActive: input.isActive }),
				...(input?.search && {
					OR: [
						{ name: { contains: input.search, mode: 'insensitive' as const } },
						{ companyName: { contains: input.search, mode: 'insensitive' as const } },
						{ email: { contains: input.search, mode: 'insensitive' as const } },
						{ phone: { contains: input.search, mode: 'insensitive' as const } }
					]
				}),
				...(input?.tags &&
					input.tags.length > 0 && {
					tags: { hasSome: input.tags }
				})
			};

			const customers = await prisma.customer.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { name: 'asc' }
			});

			const hasMore = customers.length > limit;
			if (hasMore) customers.pop();

			const nextCursor = hasMore ? customers[customers.length - 1]?.id ?? null : null;

			return successResponse(
				{
					customers: customers.map(formatCustomer),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Get a customer by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ customer: customerOutput }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Customer not found' },
			FORBIDDEN: { message: 'Forbidden' }
		})
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'customer', input.id);

			const customer = await prisma.customer.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization!.id,
					deletedAt: null
				}
			});

			if (!customer) {
				throw errors.NOT_FOUND({ message: 'Customer' });
			}

			return successResponse({ customer: formatCustomer(customer) }, context);
		}),

	/**
	 * Update a customer
	 */
	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					name: z.string().min(1).max(255).optional(),
					companyName: z.string().max(255).nullable().optional(),
					email: z.string().email().nullable().optional(),
					phone: z.string().max(50).nullable().optional(),
					altPhone: z.string().max(50).nullable().optional(),
					addressLine1: z.string().max(255).nullable().optional(),
					addressLine2: z.string().max(255).nullable().optional(),
					city: z.string().max(100).nullable().optional(),
					state: z.string().max(100).nullable().optional(),
					postalCode: z.string().max(20).nullable().optional(),
					country: z.string().max(2).nullable().optional(),
					notes: z.string().nullable().optional(),
					tags: z.array(z.string()).optional(),
					source: z.string().max(100).nullable().optional(),
					referredBy: z.string().max(255).nullable().optional(),
					isActive: z.boolean().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ customer: customerOutput }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Customer not found' },
			FORBIDDEN: { message: 'Forbidden' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'customer', input.id);

			const existing = await prisma.customer.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization!.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Customer' });
			}

			const { id, idempotencyKey, ...data } = input;

			// Use DBOS workflow for durable execution
			const result = await startCustomerWorkflow(
				{
					action: 'UPDATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					customerId: id,
					data: {
						displayName: data.name,
						companyName: data.companyName,
						email: data.email,
						phone: data.phone,
						alternatePhone: data.altPhone,
						addressLine1: data.addressLine1,
						addressLine2: data.addressLine2,
						city: data.city,
						state: data.state,
						postalCode: data.postalCode,
						country: data.country,
						notes: data.notes,
						tags: data.tags
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update customer' });
			}

			const customer = await prisma.customer.findFirstOrThrow({
				where: { id: result.customerId, organizationId: context.organization.id }
			});

			return successResponse({ customer: formatCustomer(customer) }, context);
		}),

	/**
	 * Delete (soft) a customer
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Customer not found' },
			FORBIDDEN: { message: 'Forbidden' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('delete', 'customer', input.id);

			const existing = await prisma.customer.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization!.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Customer' });
			}

			// Use DBOS workflow for durable execution
			const result = await startCustomerWorkflow(
				{
					action: 'DELETE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					customerId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete customer' });
			}

			return successResponse({ deleted: true }, context);
		})
};
