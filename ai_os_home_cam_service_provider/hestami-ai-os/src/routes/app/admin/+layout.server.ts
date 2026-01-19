import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { StaffStatus } from '../../../../generated/prisma/enums.js';

/**
 * Admin Area Route Protection
 * 
 * Ensures only active Hestami staff can access /app/admin/* routes.
 * All users who reach this layout have already passed the parent /app layout
 * checks (authenticated, not pending/suspended staff).
 */
export const load: LayoutServerLoad = async ({ parent }) => {
    const { staff, memberships, organization } = await parent();

    // Only active Hestami staff can access admin area
    if (!staff || staff.status !== StaffStatus.ACTIVE) {
        // Non-staff users are redirected to the main app
        throw redirect(302, '/app');
    }

    // Return staff info, memberships, and organization for child routes
    return {
        staff,
        memberships,
        organization,
        association: null
    };
};
