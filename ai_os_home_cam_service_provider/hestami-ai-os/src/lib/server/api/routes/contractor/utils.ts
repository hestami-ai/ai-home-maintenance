import { ApiException } from '../../errors.js';
import { prisma } from '../../../db.js';

export const assertContractorOrg = async (organizationId: string) => {
	const org = await prisma.organization.findFirst({
		where: {
			id: organizationId,
			type: { in: ['SERVICE_PROVIDER', 'EXTERNAL_SERVICE_PROVIDER'] },
			deletedAt: null
		}
	});
	if (!org) {
		throw ApiException.forbidden('This feature is only available for contractor organizations');
	}
	return org;
};

/**
 * Enforce that a contractor organization has at least one active, unexpired license and insurance policy.
 * Intended to gate scheduling/dispatch/job creation.
 */
export const assertContractorComplianceForScheduling = async (organizationId: string) => {
	await assertContractorOrg(organizationId);

	const profile = await prisma.contractorProfile.findUnique({
		where: { organizationId }
	});
	if (!profile) {
		throw ApiException.forbidden('Contractor profile is required before scheduling');
	}

	const now = new Date();

	const activeLicense = await prisma.contractorLicense.findFirst({
		where: {
			contractorProfileId: profile.id,
			status: 'ACTIVE',
			OR: [{ expirationDate: null }, { expirationDate: { gt: now } }]
		}
	});
	if (!activeLicense) {
		throw ApiException.forbidden('Contractor has no active license for scheduling or dispatch');
	}

	const activeInsurance = await prisma.contractorInsurance.findFirst({
		where: {
			contractorProfileId: profile.id,
			status: 'ACTIVE',
			expirationDate: { gt: now }
		}
	});
	if (!activeInsurance) {
		throw ApiException.forbidden('Contractor has no active insurance for scheduling or dispatch');
	}

	return { license: activeLicense, insurance: activeInsurance };
};
