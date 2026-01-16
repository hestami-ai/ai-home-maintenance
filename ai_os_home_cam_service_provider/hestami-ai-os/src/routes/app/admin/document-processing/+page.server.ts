import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { StaffRole, PillarAccess } from '$lib/schemas';

export const load: PageServerLoad = async ({ locals, parent }) => {
    // Get staff and memberships from parent layout (fetched via SECURITY DEFINER)
    const { staff, memberships } = await parent();

    // Require staff with appropriate role
    if (!staff || staff.status !== 'ACTIVE') {
        throw redirect(303, '/app');
    }

    // PLATFORM_ADMIN has full access to document processing
    const staffRoles = staff.roles as StaffRole[];
    const hasAccess = staffRoles.includes('PLATFORM_ADMIN');
    if (!hasAccess) {
        throw redirect(303, '/app');
    }

    // Check pillar access - ADMIN pillar grants access to document processing
    const staffPillarAccess = staff.pillarAccess as PillarAccess[];
    const hasPlatformOps = staffPillarAccess.includes('ADMIN');
    if (!hasPlatformOps) {
        throw redirect(303, '/app');
    }

    // Build context using data from parent layout (reuse typed variables from above)
    const pillarAccess = staffPillarAccess;
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
    }

    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess });
    const client = createDirectClient(context);

    try {
        // Fetch initial data
        const [statsResponse, settingsResponse, queueResponse] = await Promise.all([
            client.documentProcessing.getQueueStats(),
            client.documentProcessing.getSettings(),
            client.documentProcessing.listQueue({ view: 'processing', limit: 50 })
        ]);

        return {
            stats: statsResponse.data,
            settings: settingsResponse.data,
            initialQueue: queueResponse.data.documents,
            pagination: queueResponse.data.pagination
        , association: null};
    } catch (error) {
        console.error('Error loading DPQ admin data:', error);
        return {
            stats: [],
            settings: {},
            initialQueue: [],
            pagination: { nextCursor: null, hasMore: false },
            error: 'Failed to load document processing data'
        };
    }
};
