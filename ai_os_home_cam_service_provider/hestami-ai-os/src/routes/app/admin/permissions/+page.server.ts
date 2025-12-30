import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals }) => {
    // Build context for direct server-side calling
    let staffRoles: any[] = [];
    let pillarAccess: any[] = [];
    let orgRoles: Record<string, any> = {};
    
    if (locals.user) {
        const [staffProfile, memberships] = await Promise.all([
            prisma.staff.findUnique({ where: { userId: locals.user.id } }),
            prisma.userOrganization.findMany({ where: { userId: locals.user.id } })
        ]);
        if (staffProfile && staffProfile.status === 'ACTIVE') {
            staffRoles = staffProfile.roles;
            pillarAccess = staffProfile.pillarAccess;
        }
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
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

        if (!statsRes.ok || !orgsRes.ok || !changesRes.ok) {
            throw error(500, 'Failed to fetch permissions data from server');
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
