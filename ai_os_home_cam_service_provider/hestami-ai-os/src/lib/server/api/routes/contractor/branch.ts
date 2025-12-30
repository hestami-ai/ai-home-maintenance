import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse, IdempotencyKeySchema, PaginationInputSchema, PaginationOutputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { startContractorBranchWorkflow } from '../../../workflows/contractorBranchWorkflow.js';
import { assertContractorOrg } from './utils.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ContractorBranchRoute');

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ branch: branchOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('edit', 'contractor_branch', input.id ?? 'new');
			const { id, idempotencyKey, ...data } = input;

			// Use DBOS workflow for durable execution
			const result = await startContractorBranchWorkflow(
				{
					action: 'CREATE_OR_UPDATE_BRANCH',
					organizationId: context.organization.id,
					userId: context.user!.id,
					branchId: id,
					data
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create/update branch' });
			}

			const branch = await prisma.contractorBranch.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse(
				{
					branch: serializeBranch(branch)
				},
				context
			);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ branch: branchOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			const branch = await prisma.contractorBranch.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!branch) throw errors.NOT_FOUND({ message: 'ContractorBranch' });
			await assertContractorOrg(branch.organizationId, errors);
			await context.cerbos.authorize('view', 'contractor_branch', branch.id);

			return successResponse({ branch: serializeBranch(branch) }, context);
		}),

	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				includeInactive: z.boolean().optional()
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					branches: z.array(branchOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
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
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ branch: branchOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			const { id, idempotencyKey } = input;
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('delete', 'contractor_branch', id);

			// Use DBOS workflow for durable execution
			const result = await startContractorBranchWorkflow(
				{
					action: 'ARCHIVE_BRANCH',
					organizationId: context.organization.id,
					userId: context.user!.id,
					branchId: id,
					data: {}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to archive branch' });
			}

			const branch = await prisma.contractorBranch.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse({ branch: serializeBranch(branch) }, context);
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
