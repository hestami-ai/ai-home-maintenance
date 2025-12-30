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
import { startContractorProfileWorkflow } from '../../../workflows/contractorProfileWorkflow.js';
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ license: licenseOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('edit', 'contractor_license', input.id ?? 'new');

			const { id, idempotencyKey, ...data } = input;
			const profile = await prisma.contractorProfile.findUnique({
				where: { organizationId: context.organization.id }
			});
			if (!profile) throw errors.NOT_FOUND({ message: 'ContractorProfile' });

			// Use DBOS workflow for durable execution
			const result = await startContractorProfileWorkflow(
				{
					action: 'CREATE_OR_UPDATE_LICENSE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: id,
					data: { profileId: profile.id, ...normalizeLicenseInput(data) }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create/update license' });
			}

			const license = await prisma.contractorLicense.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse(
				{
					license: serializeLicense(license)
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
		.output(z.object({ ok: z.literal(true), data: z.object({ license: licenseOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			const license = await prisma.contractorLicense.findFirst({
				where: { id: input.id, contractorProfile: { organizationId: context.organization.id } },
				include: { contractorProfile: true }
			});
			if (!license) throw errors.NOT_FOUND({ message: 'ContractorLicense' });
			await assertContractorOrg(license.contractorProfile.organizationId, errors);
			await context.cerbos.authorize('view', 'contractor_license', license.id);

			return successResponse({ license: serializeLicense(license) }, context);
		}),

	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				status: z.enum(['ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'PENDING_RENEWAL']).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ licenses: z.array(licenseOutput), pagination: PaginationOutputSchema }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			const profile = await prisma.contractorProfile.findUnique({
				where: { organizationId: context.organization.id }
			});
			if (!profile) throw errors.NOT_FOUND({ message: 'ContractorProfile' });

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
