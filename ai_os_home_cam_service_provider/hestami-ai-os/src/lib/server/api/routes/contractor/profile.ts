import { z } from 'zod';
import { orgProcedure, successResponse, IdempotencyKeySchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { assertContractorOrg } from './utils.js';

const profileOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	legalName: z.string(),
	dba: z.string().nullable(),
	primaryContactName: z.string().nullable(),
	primaryContactEmail: z.string().email().nullable(),
	primaryContactPhone: z.string().nullable(),
	addressLine1: z.string().nullable(),
	addressLine2: z.string().nullable(),
	city: z.string().nullable(),
	state: z.string().nullable(),
	postalCode: z.string().nullable(),
	country: z.string(),
	operatingHoursJson: z.string().nullable(),
	timezone: z.string(),
	maxTechnicians: z.number().int().nullable(),
	maxServiceRadius: z.number().int().nullable(),
	complianceScore: z.number().int().nullable(),
	lastComplianceCheck: z.string().datetime().nullable(),
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

export const profileRouter = {
	createOrUpdate: orgProcedure
		.input(
			z
				.object({
					legalName: z.string().min(1),
					dba: z.string().optional(),
					taxId: z.string().optional(),
					primaryContactName: z.string().optional(),
					primaryContactEmail: z.string().email().optional(),
					primaryContactPhone: z.string().optional(),
					addressLine1: z.string().optional(),
					addressLine2: z.string().optional(),
					city: z.string().optional(),
					state: z.string().optional(),
					postalCode: z.string().optional(),
					country: z.string().default('US'),
					operatingHoursJson: z.string().optional(),
					timezone: z.string().optional(),
					maxTechnicians: z.number().int().optional(),
					maxServiceRadius: z.number().int().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ profile: profileOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			await context.cerbos.authorize('edit', 'contractor_profile', context.organization.id);
			const { idempotencyKey, ...data } = input;

			const result = await withIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.contractorProfile.findUnique({
					where: { organizationId: context.organization.id }
				});

				if (existing) {
					return prisma.contractorProfile.update({
						where: { organizationId: context.organization.id },
						data
					});
				}

				return prisma.contractorProfile.create({
					data: {
						organizationId: context.organization.id,
						...data
					}
				});
			});

			return successResponse(
				{
					profile: {
						id: result.result.id,
						organizationId: result.result.organizationId,
						legalName: result.result.legalName,
						dba: result.result.dba,
						primaryContactName: result.result.primaryContactName,
						primaryContactEmail: result.result.primaryContactEmail,
						primaryContactPhone: result.result.primaryContactPhone,
						addressLine1: result.result.addressLine1,
						addressLine2: result.result.addressLine2,
						city: result.result.city,
						state: result.result.state,
						postalCode: result.result.postalCode,
						country: result.result.country,
						operatingHoursJson: result.result.operatingHoursJson,
						timezone: result.result.timezone,
						maxTechnicians: result.result.maxTechnicians,
						maxServiceRadius: result.result.maxServiceRadius,
						complianceScore: result.result.complianceScore,
						lastComplianceCheck: result.result.lastComplianceCheck?.toISOString() ?? null,
						isActive: result.result.isActive,
						createdAt: result.result.createdAt.toISOString(),
						updatedAt: result.result.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	get: orgProcedure
		.input(z.object({ organizationId: z.string().optional() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ profile: profileOutput.nullable() }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const organizationId = input.organizationId ?? context.organization.id;
			await assertContractorOrg(organizationId);

			const profile = await prisma.contractorProfile.findUnique({
				where: { organizationId }
			});

			if (!profile || profile.organizationId !== context.organization.id) {
				await context.cerbos.authorize('view', 'contractor_profile', organizationId);
			}

			return successResponse(
				{
					profile: profile
						? {
								id: profile.id,
								organizationId: profile.organizationId,
								legalName: profile.legalName,
								dba: profile.dba,
								primaryContactName: profile.primaryContactName,
								primaryContactEmail: profile.primaryContactEmail,
								primaryContactPhone: profile.primaryContactPhone,
								addressLine1: profile.addressLine1,
								addressLine2: profile.addressLine2,
								city: profile.city,
								state: profile.state,
								postalCode: profile.postalCode,
								country: profile.country,
								operatingHoursJson: profile.operatingHoursJson,
								timezone: profile.timezone,
								maxTechnicians: profile.maxTechnicians,
								maxServiceRadius: profile.maxServiceRadius,
								complianceScore: profile.complianceScore,
								lastComplianceCheck: profile.lastComplianceCheck?.toISOString() ?? null,
								isActive: profile.isActive,
								createdAt: profile.createdAt.toISOString(),
								updatedAt: profile.updatedAt.toISOString()
						  }
						: null
				},
				context
			);
		})
};
