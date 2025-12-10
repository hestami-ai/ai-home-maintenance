import { z } from 'zod';
import { orgProcedure, successResponse, IdempotencyKeySchema, PaginationInputSchema, PaginationOutputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from './utils.js';

const branchOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	code: z.string().nullable(),
	contactName: z.string().nullable(),
	contactEmail: z.string().nullable(),
	contactPhone: z.string().nullable(),
	addressLine1: z.string(),
	addressLine2: z.string().nullable(),
	city: z.string(),
	state: z.string(),
	postalCode: z.string(),
	country: z.string(),
	operatingHoursJson: z.string().nullable(),
	timezone: z.string(),
	serviceRadiusMiles: z.number().int().nullable(),
	isActive: z.boolean(),
	isPrimary: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const upsertInput = z
	.object({
		id: z.string().optional(),
		name: z.string().min(1),
		code: z.string().optional(),
		contactName: z.string().optional(),
		contactEmail: z.string().email().optional(),
		contactPhone: z.string().optional(),
		addressLine1: z.string().min(1),
		addressLine2: z.string().optional(),
		city: z.string().min(1),
		state: z.string().min(1),
		postalCode: z.string().min(1),
		country: z.string().default('US'),
		operatingHoursJson: z.string().optional(),
		timezone: z.string().optional(),
		serviceRadiusMiles: z.number().int().optional(),
		isPrimary: z.boolean().optional()
	})
	.merge(IdempotencyKeySchema);

export const branchRouter = {
	createOrUpdate: orgProcedure
		.input(upsertInput)
		.output(z.object({ ok: z.literal(true), data: z.object({ branch: branchOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			await context.cerbos.authorize('edit', 'contractor_branch', input.id ?? 'new');
			const { id, idempotencyKey, ...data } = input;

			const result = await withIdempotency(idempotencyKey, context, async () => {
				if (id) {
					const existing = await prisma.contractorBranch.findFirst({
						where: { id, organizationId: context.organization.id }
					});
					if (!existing) throw ApiException.notFound('ContractorBranch');
					if (data.isPrimary) {
						await prisma.contractorBranch.updateMany({
							where: { organizationId: context.organization.id, isPrimary: true, NOT: { id } },
							data: { isPrimary: false }
						});
					}
					return prisma.contractorBranch.update({
						where: { id },
						data
					});
				}

				if (data.isPrimary) {
					await prisma.contractorBranch.updateMany({
						where: { organizationId: context.organization.id, isPrimary: true },
						data: { isPrimary: false }
					});
				}

				return prisma.contractorBranch.create({
					data: {
						organizationId: context.organization.id,
						...data
					}
				});
			});

			return successResponse(
				{
					branch: serializeBranch(result.result)
				},
				context
			);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ branch: branchOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const branch = await prisma.contractorBranch.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!branch) throw ApiException.notFound('ContractorBranch');
			await assertContractorOrg(branch.organizationId);
			await context.cerbos.authorize('view', 'contractor_branch', branch.id);

			return successResponse({ branch: serializeBranch(branch) }, context);
		}),

	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				includeInactive: z.boolean().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					branches: z.array(branchOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const queryPlan = await context.cerbos.queryFilter('view', 'contractor_branch');
			if (queryPlan.kind === 'always_denied') {
				return successResponse(
					{
						branches: [],
						pagination: { nextCursor: null, hasMore: false }
					},
					context
				);
			}

			const filter = {
				organizationId: context.organization.id,
				...(input.includeInactive ? {} : { isActive: true }),
				...(queryPlan.kind === 'conditional' ? queryPlan.filter : {})
			};

			const take = input.limit ?? 50;
			const cursor = input.cursor ? { id: input.cursor } : undefined;

			const branches = await prisma.contractorBranch.findMany({
				where: filter,
				take: take + 1,
				cursor,
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = branches.length > take;
			if (hasMore) branches.pop();

			return successResponse(
				{
					branches: branches.map(serializeBranch),
					pagination: { nextCursor: hasMore ? branches[branches.length - 1]?.id ?? null : null, hasMore }
				},
				context
			);
		}),

	archive: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(z.object({ ok: z.literal(true), data: z.object({ branch: branchOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const { id, idempotencyKey } = input;
			await assertContractorOrg(context.organization.id);
			await context.cerbos.authorize('delete', 'contractor_branch', id);

			const result = await withIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.contractorBranch.findFirst({
					where: { id, organizationId: context.organization.id }
				});
				if (!existing) throw ApiException.notFound('ContractorBranch');

				return prisma.contractorBranch.update({
					where: { id },
					data: {
						isActive: false,
						code: existing.code ? `${existing.code}-archived` : existing.code
					}
				});
			});

			return successResponse({ branch: serializeBranch(result.result) }, context);
		})
};

function serializeBranch(branch: any) {
	return {
		id: branch.id,
		organizationId: branch.organizationId,
		name: branch.name,
		code: branch.code,
		contactName: branch.contactName,
		contactEmail: branch.contactEmail,
		contactPhone: branch.contactPhone,
		addressLine1: branch.addressLine1,
		addressLine2: branch.addressLine2,
		city: branch.city,
		state: branch.state,
		postalCode: branch.postalCode,
		country: branch.country,
		operatingHoursJson: branch.operatingHoursJson,
		timezone: branch.timezone,
		serviceRadiusMiles: branch.serviceRadiusMiles,
		isActive: branch.isActive,
		isPrimary: branch.isPrimary,
		createdAt: branch.createdAt?.toISOString?.() ?? branch.createdAt,
		updatedAt: branch.updatedAt?.toISOString?.() ?? branch.updatedAt
	};
}
