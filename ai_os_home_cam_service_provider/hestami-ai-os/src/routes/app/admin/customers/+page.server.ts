import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Redirect /app/admin/customers to /app/admin/organizations
 * This maintains backward compatibility for any bookmarked URLs
 */
export const load: PageServerLoad = async () => {
	redirect(301, '/app/admin/organizations');
};
