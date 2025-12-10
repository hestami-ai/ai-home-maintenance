import { z } from 'zod';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';

const assertServiceProviderOrg = async (organizationId: string) => {
	const org = await prisma.organization.findFirst({
		where: { id: organizationId, type: 'SERVICE_PROVIDER', deletedAt: null }
	});
	if (!org) {
		throw ApiException.forbidden('This feature is only available for service provider organizations');
	}
	return org;
};

export const serviceAreaRouter = {
	/**
	 * Create a service area
	 */
	create: orgProcedure
		.input(z.object({
			name: z.string().min(1).max(100),
			zipCodes: z.array(z.string().regex(/^\d{5}$/)).min(1),
			serviceCategories: z.array(z.string()).min(1),
			radius: z.number().int().min(1).max(500).optional(),
			centerLat: z.number().min(-90).max(90).optional(),
			centerLng: z.number().min(-180).max(180).optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				serviceArea: z.object({
					id: z.string(),
					name: z.string(),
					zipCodes: z.array(z.string()),
					serviceCategories: z.array(z.string())
				})
			}),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'service_area', 'new');
			const org = await assertServiceProviderOrg(context.organization!.id);

			const createArea = async () => {
				return prisma.serviceArea.create({
					data: {
						serviceProviderOrgId: org.id,
						name: input.name,
						zipCodes: input.zipCodes,
						serviceCategories: input.serviceCategories,
						radius: input.radius,
						centerLat: input.centerLat,
						centerLng: input.centerLng
					}
				});
			};

			const serviceArea = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createArea)).result
				: await createArea();

			return successResponse({
				serviceArea: {
					id: serviceArea.id,
					name: serviceArea.name,
					zipCodes: serviceArea.zipCodes,
					serviceCategories: serviceArea.serviceCategories
				}
			}, context);
		}),

	/**
	 * List service areas for the organization
	 */
	list: orgProcedure
		.input(z.object({
			isActive: z.boolean().optional()
		}).optional())
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				serviceAreas: z.array(z.object({
					id: z.string(),
					name: z.string(),
					zipCodes: z.array(z.string()),
					serviceCategories: z.array(z.string()),
					radius: z.number().nullable(),
					isActive: z.boolean()
				}))
			}),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'service_area', '*');
			const org = await assertServiceProviderOrg(context.organization!.id);

			const where: Record<string, unknown> = { serviceProviderOrgId: org.id };
			if (input?.isActive !== undefined) where.isActive = input.isActive;

			const serviceAreas = await prisma.serviceArea.findMany({
				where,
				orderBy: { name: 'asc' }
			});

			return successResponse({
				serviceAreas: serviceAreas.map(sa => ({
					id: sa.id,
					name: sa.name,
					zipCodes: sa.zipCodes,
					serviceCategories: sa.serviceCategories,
					radius: sa.radius,
					isActive: sa.isActive
				}))
			}, context);
		}),

	/**
	 * Update a service area
	 */
	update: orgProcedure
		.input(z.object({
			id: z.string(),
			name: z.string().min(1).max(100).optional(),
			zipCodes: z.array(z.string().regex(/^\d{5}$/)).min(1).optional(),
			serviceCategories: z.array(z.string()).min(1).optional(),
			radius: z.number().int().min(1).max(500).nullable().optional(),
			centerLat: z.number().min(-90).max(90).nullable().optional(),
			centerLng: z.number().min(-180).max(180).nullable().optional(),
			isActive: z.boolean().optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				serviceArea: z.object({
					id: z.string(),
					name: z.string(),
					isActive: z.boolean()
				})
			}),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'service_area', input.id);
			const org = await assertServiceProviderOrg(context.organization!.id);

			const updateArea = async () => {
				const existing = await prisma.serviceArea.findFirst({
					where: { id: input.id, serviceProviderOrgId: org.id }
				});
				if (!existing) throw ApiException.notFound('Service area');

				return prisma.serviceArea.update({
					where: { id: input.id },
					data: {
						name: input.name,
						zipCodes: input.zipCodes,
						serviceCategories: input.serviceCategories,
						radius: input.radius,
						centerLat: input.centerLat,
						centerLng: input.centerLng,
						isActive: input.isActive
					}
				});
			};

			const serviceArea = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateArea)).result
				: await updateArea();

			return successResponse({
				serviceArea: {
					id: serviceArea.id,
					name: serviceArea.name,
					isActive: serviceArea.isActive
				}
			}, context);
		}),

	/**
	 * Delete a service area
	 */
	delete: orgProcedure
		.input(z.object({
			id: z.string(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({ deleted: z.boolean() }),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('delete', 'service_area', input.id);
			const org = await assertServiceProviderOrg(context.organization!.id);

			const deleteArea = async () => {
				const existing = await prisma.serviceArea.findFirst({
					where: { id: input.id, serviceProviderOrgId: org.id }
				});
				if (!existing) throw ApiException.notFound('Service area');

				await prisma.serviceArea.delete({ where: { id: input.id } });
				return true;
			};

			input.idempotencyKey
				? await withIdempotency(input.idempotencyKey, context, deleteArea)
				: await deleteArea();

			return successResponse({ deleted: true }, context);
		})
};
