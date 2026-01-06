import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Admin Area Route Protection
 * 
 * Ensures only active Hestami staff can access /app/admin/* routes.
 * All users who reach this layout have already passed the parent /app layout
 * checks (authenticated, not pending/suspended staff).
 */
export const load: LayoutServerLoad = async ({ parent }) => {
    const { staff } = await parent();

    // Only active Hestami staff can access admin area
    if (!staff || staff.status !== 'ACTIVE') {
        // Non-staff users are redirected to the main app
        throw redirect(302, '/app');
    }

    // Return staff info for child routes
    return {
        staff,
        association: null
    };
};
