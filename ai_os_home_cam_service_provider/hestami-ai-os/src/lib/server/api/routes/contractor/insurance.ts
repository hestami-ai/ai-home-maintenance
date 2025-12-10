import { z } from 'zod';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { assertContractorOrg } from './utils.js';
import { Prisma } from '../../../../../../generated/prisma/client.js';

const insuranceOutput = z.object({
	id: z.string(),
	contractorProfileId: z.string(),
	insuranceType: z.string(),
	policyNumber: z.string(),
	carrier: z.string(),
	coverageAmount: z.string(),
	deductible: z.string().nullable(),
	effectiveDate: z.string().datetime(),
	expirationDate: z.string().datetime(),
	status: z.string(),
	verifiedAt: z.string().datetime().nullable(),
	verifiedBy: z.string().nullable(),
	coiDocumentUrl: z.string().nullable(),
	additionalInsuredJson: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const upsertInput = z
	.object({
		id: z.string().optional(),
		insuranceType: z.enum([
			'GENERAL_LIABILITY',
			'WORKERS_COMPENSATION',
			'PROFESSIONAL_LIABILITY',
			'AUTO_LIABILITY',
			'UMBRELLA',
			'BONDING'
		]),
		policyNumber: z.string().min(1),
		carrier: z.string().min(1),
		coverageAmount: z.union([z.number().positive(), z.string().min(1)]),
		deductible: z.union([z.number().nonnegative(), z.string()]).optional(),
		effectiveDate: z.string().datetime(),
		expirationDate: z.string().datetime(),
		status: z.enum(['ACTIVE', 'EXPIRED', 'PENDING_VERIFICATION', 'CANCELLED']).optional(),
		verifiedAt: z.string().datetime().optional(),
		verifiedBy: z.string().optional(),
		coiDocumentUrl: z.string().url().optional(),
		additionalInsuredJson: z.string().optional(),
		notes: z.string().optional()
	})
	.merge(IdempotencyKeySchema);

type InsuranceInput = z.infer<typeof upsertInput>;

export const insuranceRouter = {
	createOrUpdate: orgProcedure
		.input(upsertInput)
		.output(z.object({ ok: z.literal(true), data: z.object({ insurance: insuranceOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			await context.cerbos.authorize('edit', 'contractor_insurance', input.id ?? 'new');

			const { id, idempotencyKey, ...data } = input;
			const profile = await prisma.contractorProfile.findUnique({
				where: { organizationId: context.organization.id }
			});
			if (!profile) throw ApiException.notFound('ContractorProfile');

			const result = await withIdempotency(idempotencyKey, context, async () => {
				const normalized = normalizeInsuranceInput(data);
				if (id) {
					const existing = await prisma.contractorInsurance.findFirst({
						where: { id, contractorProfileId: profile.id }
					});
					if (!existing) throw ApiException.notFound('ContractorInsurance');

					return prisma.contractorInsurance.update({
						where: { id },
						data: normalized
					});
				}

				return prisma.contractorInsurance.create({
					data: {
						contractorProfileId: profile.id,
						...normalized
					}
				});
			});

			return successResponse({ insurance: serializeInsurance(result.result) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ insurance: insuranceOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const insurance = await prisma.contractorInsurance.findFirst({
				where: { id: input.id, contractorProfile: { organizationId: context.organization.id } },
				include: { contractorProfile: true }
			});
			if (!insurance) throw ApiException.notFound('ContractorInsurance');
			await assertContractorOrg(insurance.contractorProfile.organizationId);
			await context.cerbos.authorize('view', 'contractor_insurance', insurance.id);

			return successResponse({ insurance: serializeInsurance(insurance) }, context);
		}),

	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				status: z.enum(['ACTIVE', 'EXPIRED', 'PENDING_VERIFICATION', 'CANCELLED']).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ insurances: z.array(insuranceOutput), pagination: PaginationOutputSchema }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const profile = await prisma.contractorProfile.findUnique({
				where: { organizationId: context.organization.id }
			});
			if (!profile) throw ApiException.notFound('ContractorProfile');

			const queryPlan = await context.cerbos.queryFilter('view', 'contractor_insurance');
			if (queryPlan.kind === 'always_denied') {
				return successResponse(
					{
						insurances: [],
						pagination: { nextCursor: null, hasMore: false }
					},
					context
				);
			}

			const where = {
				contractorProfileId: profile.id,
				...(input.status ? { status: input.status } : {}),
				...(queryPlan.kind === 'conditional' ? queryPlan.filter : {})
			};

			const take = input.limit ?? 50;
			const cursor = input.cursor ? { id: input.cursor } : undefined;

			const insurances = await prisma.contractorInsurance.findMany({
				where,
				take: take + 1,
				cursor,
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = insurances.length > take;
			if (hasMore) insurances.pop();

			return successResponse(
				{
					insurances: insurances.map(serializeInsurance),
					pagination: { nextCursor: hasMore ? insurances.at(-1)?.id ?? null : null, hasMore }
				},
				context
			);
		})
};

function normalizeInsuranceInput(input: Omit<InsuranceInput, 'id' | 'idempotencyKey'>) {
	const { coverageAmount, deductible, effectiveDate, expirationDate, ...rest } = input;
	return {
		...rest,
		coverageAmount: new Prisma.Decimal(coverageAmount as any),
		deductible: deductible !== undefined ? new Prisma.Decimal(deductible as any) : undefined,
		effectiveDate: new Date(effectiveDate),
		expirationDate: new Date(expirationDate)
	};
}

function serializeInsurance(insurance: any) {
	return {
		id: insurance.id,
		contractorProfileId: insurance.contractorProfileId,
		insuranceType: insurance.insuranceType,
		policyNumber: insurance.policyNumber,
		carrier: insurance.carrier,
		coverageAmount: insurance.coverageAmount?.toString?.() ?? String(insurance.coverageAmount),
		deductible: insurance.deductible ? insurance.deductible.toString() : null,
		effectiveDate: insurance.effectiveDate?.toISOString?.() ?? insurance.effectiveDate,
		expirationDate: insurance.expirationDate?.toISOString?.() ?? insurance.expirationDate,
		status: insurance.status,
		verifiedAt: insurance.verifiedAt?.toISOString?.() ?? insurance.verifiedAt ?? null,
		verifiedBy: insurance.verifiedBy ?? null,
		coiDocumentUrl: insurance.coiDocumentUrl ?? null,
		additionalInsuredJson: insurance.additionalInsuredJson ?? null,
		notes: insurance.notes ?? null,
		createdAt: insurance.createdAt?.toISOString?.() ?? insurance.createdAt,
		updatedAt: insurance.updatedAt?.toISOString?.() ?? insurance.updatedAt
	};
}
