import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
    // Get staff and memberships from parent layout (fetched via SECURITY DEFINER)
    const { staff, memberships } = await parent();

    // Require staff with appropriate role
    if (!staff || staff.status !== 'ACTIVE') {
        throw redirect(303, '/app');
    }

    const hasAccess = (staff.roles as any[]).includes('ADMIN') || (staff.roles as any[]).includes('SUPPORT') || (staff.roles as any[]).includes('OWNER');
    if (!hasAccess) {
        throw redirect(303, '/app');
    }

    // Double check pillar access (as defined in requirements)
    const hasPlatformOps = (staff.pillarAccess as any[]).includes('PLATFORM_OPERATIONS') || (staff.pillarAccess as any[]).includes('ALL');
    if (!hasPlatformOps) {
        throw redirect(303, '/app');
    }

    // Build context using data from parent layout
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
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
        };
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
