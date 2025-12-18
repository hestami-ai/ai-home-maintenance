import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
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

const licenseOutput = z.object({
	id: z.string(),
	contractorProfileId: z.string(),
	licenseType: z.string(),
	licenseNumber: z.string(),
	issuingAuthority: z.string(),
	issuingState: z.string().nullable(),
	issueDate: z.string().datetime().nullable(),
	expirationDate: z.string().datetime().nullable(),
	status: z.string(),
	verifiedAt: z.string().datetime().nullable(),
	verifiedBy: z.string().nullable(),
	documentUrl: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const upsertInput = z
	.object({
		id: z.string().optional(),
		licenseType: z.string().min(1),
		licenseNumber: z.string().min(1),
		issuingAuthority: z.string().min(1),
		issuingState: z.string().optional(),
		issueDate: z.string().datetime().optional(),
		expirationDate: z.string().datetime().optional(),
		status: z.enum(['ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'PENDING_RENEWAL']).optional(),
		documentUrl: z.string().url().optional(),
		notes: z.string().optional()
	})
	.merge(IdempotencyKeySchema);

type LicenseInput = z.infer<typeof upsertInput>;

export const licenseRouter = {
	createOrUpdate: orgProcedure
		.input(upsertInput)
		.output(z.object({ ok: z.literal(true), data: z.object({ license: licenseOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			await context.cerbos.authorize('edit', 'contractor_license', input.id ?? 'new');

			const { id, idempotencyKey, ...data } = input;
			const profile = await prisma.contractorProfile.findUnique({
				where: { organizationId: context.organization.id }
			});
			if (!profile) throw ApiException.notFound('ContractorProfile');

			const result = await withIdempotency(idempotencyKey, context, async () => {
				if (id) {
					const existing = await prisma.contractorLicense.findFirst({
						where: { id, contractorProfileId: profile.id }
					});
					if (!existing) throw ApiException.notFound('ContractorLicense');

					return prisma.contractorLicense.update({
						where: { id },
						data: normalizeLicenseInput(data)
					});
				}

				return prisma.contractorLicense.create({
					data: {
						contractorProfileId: profile.id,
						...normalizeLicenseInput(data)
					}
				});
			});

			return successResponse(
				{
					license: serializeLicense(result.result)
				},
				context
			);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ license: licenseOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context }) => {
			const license = await prisma.contractorLicense.findFirst({
				where: { id: input.id, contractorProfile: { organizationId: context.organization.id } },
				include: { contractorProfile: true }
			});
			if (!license) throw ApiException.notFound('ContractorLicense');
			await assertContractorOrg(license.contractorProfile.organizationId);
			await context.cerbos.authorize('view', 'contractor_license', license.id);

			return successResponse({ license: serializeLicense(license) }, context);
		}),

	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				status: z.enum(['ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'PENDING_RENEWAL']).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ licenses: z.array(licenseOutput), pagination: PaginationOutputSchema }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const profile = await prisma.contractorProfile.findUnique({
				where: { organizationId: context.organization.id }
			});
			if (!profile) throw ApiException.notFound('ContractorProfile');

			const queryPlan = await context.cerbos.queryFilter('view', 'contractor_license');
			if (queryPlan.kind === 'always_denied') {
				return successResponse(
					{
						licenses: [],
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

			const licenses = await prisma.contractorLicense.findMany({
				where,
				take: take + 1,
				cursor,
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = licenses.length > take;
			if (hasMore) licenses.pop();

			return successResponse(
				{
					licenses: licenses.map(serializeLicense),
					pagination: { nextCursor: hasMore ? licenses.at(-1)?.id ?? null : null, hasMore }
				},
				context
			);
		})
};

function normalizeLicenseInput(input: Omit<LicenseInput, 'id' | 'idempotencyKey'>) {
	const { issueDate, expirationDate, ...rest } = input;
	return {
		...rest,
		issueDate: issueDate ? new Date(issueDate) : undefined,
		expirationDate: expirationDate ? new Date(expirationDate) : undefined
	};
}

function serializeLicense(license: any) {
	return {
		id: license.id,
		contractorProfileId: license.contractorProfileId,
		licenseType: license.licenseType,
		licenseNumber: license.licenseNumber,
		issuingAuthority: license.issuingAuthority,
		issuingState: license.issuingState,
		issueDate: license.issueDate?.toISOString?.() ?? license.issueDate ?? null,
		expirationDate: license.expirationDate?.toISOString?.() ?? license.expirationDate ?? null,
		status: license.status,
		verifiedAt: license.verifiedAt?.toISOString?.() ?? license.verifiedAt ?? null,
		verifiedBy: license.verifiedBy ?? null,
		documentUrl: license.documentUrl ?? null,
		notes: license.notes ?? null,
		createdAt: license.createdAt?.toISOString?.() ?? license.createdAt,
		updatedAt: license.updatedAt?.toISOString?.() ?? license.updatedAt
	};
}
