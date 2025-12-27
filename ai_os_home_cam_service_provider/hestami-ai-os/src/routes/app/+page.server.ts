import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user, organization, staff } = await parent();

	// Must be authenticated to access /app
	if (!user) {
		throw redirect(302, '/login');
	}

	// 1. Prioritize Staff Redirection
	if (staff) {
		throw redirect(302, '/app/admin');
	}

	// 2. No organization means user needs onboarding
	if (!organization) {
		throw redirect(302, '/onboarding');
	}

	// 3. Route based on organization type
	const orgType = organization.type;
	if (orgType === 'INDIVIDUAL_PROPERTY_OWNER' || orgType === 'TRUST_OR_LLC') {
		throw redirect(302, '/app/concierge');
	} else if (orgType === 'COMMUNITY_ASSOCIATION' || orgType === 'MANAGEMENT_COMPANY') {
		throw redirect(302, '/app/cam');
	} else if (orgType === 'SERVICE_PROVIDER') {
		throw redirect(302, '/app/contractor');
	} else {
		// Default to concierge dashboard for other owner types
		throw redirect(302, '/app/concierge');
	}
};
