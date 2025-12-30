import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, parent }) => {
    const { organization } = await parent();
    
    // Build context for direct server-side calling
    let orgRoles: Record<string, any> = {};
    if (locals.user) {
        const memberships = await prisma.userOrganization.findMany({ where: { userId: locals.user.id } });
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
    }
    
    // Pass organization through options (don't mutate locals)
    const role = organization ? orgRoles[organization.id] : undefined;
    const context = buildServerContext(locals, { orgRoles, organization, role });
    const client = createDirectClient(context);

    try {
        const response = await client.job.list({ limit: 100 });
        if (!response.ok) {
            throw error(500, 'Failed to fetch jobs for dispatch board');
        }

        return {
            jobs: response.data.jobs
        };
    } catch (err) {
        console.error('Failed to load dispatch board data on server:', err);
        throw error(500, 'Failed to fetch jobs from server');
    }
};
