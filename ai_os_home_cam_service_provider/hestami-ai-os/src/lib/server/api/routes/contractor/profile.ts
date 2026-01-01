import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse, IdempotencyKeySchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { startContractorProfileWorkflow } from '../../../workflows/contractorProfileWorkflow.js';
import { assertContractorOrg } from './utils.js';
import { recordExecution } from '../../middleware/activityEvent.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ContractorProfileRoute');

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
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ profile: profileOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('edit', 'contractor_profile', context.organization.id);
			const { idempotencyKey, ...data } = input;

			// Use DBOS workflow for durable execution
			const result = await startContractorProfileWorkflow(
				{
					action: 'CREATE_OR_UPDATE_PROFILE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create/update profile' });
			}

			const profile = await prisma.contractorProfile.findUniqueOrThrow({ where: { id: result.entityId } });

			// Record activity event
			await recordExecution(context, {
				entityType: 'CONTRACTOR',
				entityId: profile.id,
				action: 'UPDATE',
				summary: `Contractor profile updated: ${profile.legalName}`,
				newState: { legalName: profile.legalName, dba: profile.dba }
			});

			return successResponse(
				{
					profile: {
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
				},
				context
			);
		}),

	get: orgProcedure
		.input(z.object({ organizationId: z.string().optional() }))
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ profile: profileOutput.nullable() }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			const organizationId = input.organizationId ?? context.organization.id;
			await assertContractorOrg(organizationId, errors);

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
