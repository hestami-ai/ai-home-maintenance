import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
    // Get staff and memberships from parent layout (already fetched via SECURITY DEFINER)
    const { staff, memberships } = await parent();

    // Build context using data from parent layout
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
    }

    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess });
    const client = createDirectClient(context);
    const orgSearch = url.searchParams.get('orgSearch') || undefined;
    const orgType = url.searchParams.get('orgType') as any;
    const orgStatus = url.searchParams.get('orgStatus') as any;

    try {
        const [statsRes, orgsRes, changesRes] = await Promise.all([
            client.permissionsAdmin.getStats({}),
            client.permissionsAdmin.listOrganizations({
                search: orgSearch,
                type: orgType || undefined,
                status: orgStatus || undefined,
                limit: 50
            }),
            client.permissionsAdmin.getRecentChanges({ limit: 20 })
        ]);

        const responses = [statsRes, orgsRes, changesRes];
        const firstError = responses.find(r => !r.ok);

        if (firstError) {
            const errResponse = firstError as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Failed to fetch permissions data from server';
            throw error(status, message);
        }

        return {
            stats: statsRes.data,
            organizations: orgsRes.data.organizations,
            recentChanges: changesRes.data.changes,
            filters: {
                orgSearch: orgSearch || '',
                orgType: orgType || '',
                orgStatus: orgStatus || ''
            }
        };
    } catch (err) {
        console.error('Failed to load permissions admin data on server:', err);
        return {
            stats: null,
            organizations: [],
            recentChanges: [],
            filters: {
                orgSearch: orgSearch || '',
                orgType: orgType || '',
                orgStatus: orgStatus || ''
            }
        };
    }
};
