import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent, url }) => {
	const { user, staff } = await parent();

	// Redirect unauthenticated users to login with return URL
	if (!user) {
		const returnTo = url.pathname + url.search;
		throw redirect(302, `/login?returnTo=${encodeURIComponent(returnTo)}`);
	}

	// Phase 19: Staff Onboarding Redirection
	const isStaffEmail = user.email?.endsWith('@hestami-ai.com');

	// 1. Staff domain user but no staff profile -> Pending Approval
	if (isStaffEmail && !staff) {
		throw redirect(302, '/staff/pending');
	}

	// 2. Staff profile exists but not active -> Activation
	if (staff) {
		if (staff.status === 'PENDING') {
			throw redirect(302, '/staff/activate');
		}

		// Block access for suspended/deactivated staff
		if (staff.status === 'SUSPENDED' || staff.status === 'DEACTIVATED') {
			throw redirect(302, '/staff/pending');
		}
	}

	return { association: null };
};
