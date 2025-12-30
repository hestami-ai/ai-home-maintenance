import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse, IdempotencyKeySchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { startContractorComplianceWorkflow } from '../../../workflows/contractorComplianceWorkflow.js';
import { assertContractorOrg } from './utils.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ContractorComplianceRoute');

const vendorApprovalEnum = z.enum(['PENDING', 'APPROVED', 'CONDITIONAL', 'SUSPENDED', 'REJECTED']);

const complianceOutput = z.object({
	vendorId: z.string(),
	isCompliant: z.boolean(),
	complianceScore: z.number().int(),
	hasValidLicense: z.boolean(),
	hasValidInsurance: z.boolean(),
	hasW9OnFile: z.boolean(),
	meetsMinCoverage: z.boolean(),
	earliestLicenseExpiry: z.string().datetime().nullable(),
	earliestInsuranceExpiry: z.string().datetime().nullable(),
	isBlocked: z.boolean(),
	blockReason: z.string().nullable(),
	lastCheckedAt: z.string()
});

export const complianceRouter = {
	getStatus: orgProcedure
		.input(z.object({ vendorId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ status: complianceOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			const status = await computeCompliance(input.vendorId, context.organization.id, errors);
			await context.cerbos.authorize('view', 'contractor_compliance', input.vendorId);

			return successResponse({ status: serializeCompliance(status) }, context);
		}),

	refresh: orgProcedure
		.input(z.object({ vendorId: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ status: complianceOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'contractor_compliance', input.vendorId);
			// Use DBOS workflow for durable execution
			const result = await startContractorComplianceWorkflow(
				{
					action: 'REFRESH',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					vendorId: input.vendorId,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to refresh compliance' });
			}

			return successResponse({ status: serializeCompliance(result.complianceData) }, context);
		}),

	setBlock: orgProcedure
		.input(
			z
				.object({
					vendorId: z.string(),
					isBlocked: z.boolean(),
					blockReason: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ status: complianceOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'contractor_compliance', input.vendorId);
			// Use DBOS workflow for durable execution
			const result = await startContractorComplianceWorkflow(
				{
					action: 'SET_BLOCK',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					vendorId: input.vendorId,
					data: { isBlocked: input.isBlocked, blockReason: input.blockReason }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to set block status' });
			}

			return successResponse({ status: serializeCompliance(result.complianceData) }, context);
		}),

	linkHoaApproval: orgProcedure
		.input(
			z
				.object({
					vendorId: z.string(),
					approvalStatus: vendorApprovalEnum,
					insuranceVerified: z.boolean().optional(),
					licenseVerified: z.boolean().optional(),
					complianceNotes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ status: complianceOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'contractor_compliance', input.vendorId);
			const { idempotencyKey, ...payload } = input;

			// Use DBOS workflow for durable execution
			const result = await startContractorComplianceWorkflow(
				{
					action: 'LINK_HOA_APPROVAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					vendorId: payload.vendorId,
					data: {
						approvalStatus: payload.approvalStatus,
						insuranceVerified: payload.insuranceVerified,
						licenseVerified: payload.licenseVerified,
						complianceNotes: payload.complianceNotes
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to link HOA approval' });
			}

			return successResponse({ status: serializeCompliance(result.complianceData) }, context);
		})
};

async function getLinkAndProfile(vendorId: string, organizationId: string, errors: any) {
	await assertContractorOrg(organizationId, errors);
	const link = await prisma.serviceProviderLink.findFirst({
		where: { vendorId, serviceProviderOrgId: organizationId }
	});
	if (!link) throw errors.NOT_FOUND({ message: 'ServiceProviderLink' });

	const profile = await prisma.contractorProfile.findUnique({
		where: { organizationId }
	});
	if (!profile) throw errors.NOT_FOUND({ message: 'ContractorProfile' });

	return { link, profile };
}

async function ensureComplianceRecord(vendorId: string, organizationId: string, errors: any) {
	const existing = await prisma.contractorComplianceStatus.findUnique({
		where: { vendorId }
	});
	if (existing) return existing;

	const { link } = await getLinkAndProfile(vendorId, organizationId, errors);
	return prisma.contractorComplianceStatus.create({
		data: {
			vendorId: link.vendorId,
			lastCheckedAt: new Date()
		}
	});
}

async function computeCompliance(vendorId: string, organizationId: string, errors: any, persist = false) {
	const { link, profile } = await getLinkAndProfile(vendorId, organizationId, errors);

	// Find latest valid license and insurance
	const now = new Date();
	const license = await prisma.contractorLicense.findFirst({
		where: {
			contractorProfileId: profile.id,
			status: 'ACTIVE',
			OR: [{ expirationDate: null }, { expirationDate: { gt: now } }]
		},
		orderBy: { expirationDate: 'asc' }
	});

	const insurance = await prisma.contractorInsurance.findFirst({
		where: {
			contractorProfileId: profile.id,
			status: 'ACTIVE',
			expirationDate: { gt: now }
		},
		orderBy: { expirationDate: 'asc' }
	});

	const hasValidLicense = !!license;
	const hasValidInsurance = !!insurance;
	const earliestLicenseExpiry = license?.expirationDate ?? null;
	const earliestInsuranceExpiry = insurance?.expirationDate ?? null;
	const meetsMinCoverage = !!insurance;
	const hasW9OnFile = !!(await prisma.vendor.findUnique({ where: { id: vendorId }, select: { w9OnFile: true } }))
		?.w9OnFile;

	let complianceScore = 0;
	if (hasValidLicense) complianceScore += 45;
	if (hasValidInsurance) complianceScore += 45;
	if (meetsMinCoverage) complianceScore += 5;
	if (hasW9OnFile) complianceScore += 5;

	const baseStatus = await prisma.contractorComplianceStatus.findUnique({ where: { vendorId } });
	const isBlocked = baseStatus?.isBlocked ?? false;
	const blockReason = baseStatus?.blockReason ?? null;

	const status = {
		vendorId,
		isCompliant: hasValidLicense && hasValidInsurance && !isBlocked,
		complianceScore,
		hasValidLicense,
		hasValidInsurance,
		hasW9OnFile,
		meetsMinCoverage,
		earliestLicenseExpiry,
		earliestInsuranceExpiry,
		isBlocked,
		blockReason,
		lastCheckedAt: new Date()
	};

	if (persist) {
		const existing = await prisma.contractorComplianceStatus.findUnique({ where: { vendorId } });
		if (existing) {
			return prisma.contractorComplianceStatus.update({
				where: { vendorId },
				data: status
			});
		}
		return prisma.contractorComplianceStatus.create({
			data: status
		});
	}

	return status;
}

function serializeCompliance(status: any) {
	return {
		vendorId: status.vendorId,
		isCompliant: status.isCompliant,
		complianceScore: status.complianceScore,
		hasValidLicense: status.hasValidLicense,
		hasValidInsurance: status.hasValidInsurance,
		hasW9OnFile: status.hasW9OnFile,
		meetsMinCoverage: status.meetsMinCoverage,
		earliestLicenseExpiry: status.earliestLicenseExpiry?.toISOString?.() ?? status.earliestLicenseExpiry ?? null,
		earliestInsuranceExpiry: status.earliestInsuranceExpiry?.toISOString?.() ?? status.earliestInsuranceExpiry ?? null,
		isBlocked: status.isBlocked,
		blockReason: status.blockReason ?? null,
		lastCheckedAt: status.lastCheckedAt?.toISOString?.() ?? status.lastCheckedAt
	};
}
