import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();

    // Build context using data from parent layout
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
    }
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const role = organization ? orgRoles[organization.id] : undefined;

    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess, organization, role });
    const client = createDirectClient(context);

    try {
        const response = await client.job.list({ limit: 100 });
        if (!response.ok) {
            const errResponse = response as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Failed to fetch jobs for dispatch board';
            throw error(status, message);
        }

        return {
            jobs: response.data.jobs
        , association: null};
    } catch (err) {
        console.error('Failed to load dispatch board data on server:', err);
        throw error(500, 'Failed to fetch jobs from server');
    }
};
