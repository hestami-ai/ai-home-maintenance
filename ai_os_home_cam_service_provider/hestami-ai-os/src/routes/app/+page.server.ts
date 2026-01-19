import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createModuleLogger } from '$lib/server/logger';
import { OrganizationType } from '../../../generated/prisma/enums.js';

const log = createModuleLogger('AppRootPage');

export const load: PageServerLoad = async ({ parent }) => {
	const { user, organization, staff } = await parent();

	// Must be authenticated to access /app
	if (!user) {
		log.debug('Unauthenticated access attempt to /app, redirecting to login');
		throw redirect(302, '/login');
	}

	log.debug('Processing /app redirection', {
		userId: user.id,
		userEmail: user.email,
		hasStaffProfile: !!staff,
		staffStatus: staff?.status,
		organizationId: organization?.id,
		organizationName: organization?.name,
		organizationType: organization?.type,
		organizationStatus: organization?.status
	});

	// 1. Prioritize Staff Redirection
	if (staff) {
		log.info('Redirecting staff member to admin portal', { userId: user.id });
		throw redirect(302, '/app/admin');
	}

	// 2. No organization means user needs onboarding
	if (!organization) {
		log.warn('No organization membership found for user, redirecting to onboarding', { userId: user.id });
		throw redirect(302, '/onboarding');
	}

	// 3. Route based on organization type
	const orgType = organization.type;
	log.info('Redirecting user to pillar dashboard', {
		userId: user.id,
		organizationId: organization.id,
		orgType
	});

	if (orgType === OrganizationType.INDIVIDUAL_PROPERTY_OWNER || orgType === OrganizationType.TRUST_OR_LLC) {
		throw redirect(302, '/app/concierge');
	} else if (orgType === OrganizationType.COMMUNITY_ASSOCIATION || orgType === OrganizationType.MANAGEMENT_COMPANY) {
		throw redirect(302, '/app/cam');
	} else if (orgType === OrganizationType.SERVICE_PROVIDER) {
		throw redirect(302, '/app/contractor');
	} else {
		// Default to concierge dashboard for other owner types
		throw redirect(302, '/app/concierge');
	}
};
