import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';

/**
 * Server-side load function for admin cases list view.
 * 
 * Staff can see all concierge cases across all organizations.
 * Uses get_staff_concierge_cases_list() SECURITY DEFINER function
 * which bypasses RLS for cross-org staff access (Pattern C).
 */
export const load: PageServerLoad = async ({ parent, url }) => {
    const { staff, user } = await parent();

    // Verify the user is active staff (layout already checks but double-check)
    if (!staff || staff.status !== 'ACTIVE' || !user) {
        throw error(403, 'Staff access required');
    }

    // Get query parameters for filtering
    const statusFilter = url.searchParams.get('status') || null;
    const limit = 50;

    try {
        // Use the SECURITY DEFINER function for cross-org access
        // This function runs as owner (bypasses RLS) and returns all cases
        const cases = await prisma.$queryRaw<Array<{
            id: string;
            case_number: string;
            title: string;
            status: string;
            priority: string;
            organization_id: string;
            organization_name: string | null;
            property_id: string;
            property_name: string | null;
            assigned_concierge_user_id: string | null;
            assigned_concierge_name: string | null;
            created_at: Date;
            updated_at: Date;
        }>>`
            SELECT * FROM get_staff_concierge_cases_list(${statusFilter}, ${limit})
        `;

        return {
            cases: cases.map(c => ({
                id: c.id,
                caseNumber: c.case_number,
                title: c.title,
                status: c.status,
                priority: c.priority,
                organizationId: c.organization_id,
                organizationName: c.organization_name,
                propertyId: c.property_id,
                propertyName: c.property_name,
                createdAt: c.created_at.toISOString(),
                assignedConciergeName: c.assigned_concierge_name
            })),
            association: null
        };
    } catch (err) {
        console.error('Error loading cases:', err);
        throw error(500, 'Failed to load cases');
    }
};
