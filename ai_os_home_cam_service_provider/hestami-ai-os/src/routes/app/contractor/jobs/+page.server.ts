import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { JobStatus, JobSourceType } from '$lib/api/cam';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
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
    const status = url.searchParams.get('status') as JobStatus | null;
    const sourceType = url.searchParams.get('sourceType') as JobSourceType | null;
    const search = url.searchParams.get('q') || undefined;

    try {
        const response = await client.job.list({
            status: status || undefined,
            sourceType: sourceType || undefined,
            search,
            limit: 50
        });

        return {
            jobs: response.ok ? response.data.jobs : [],
            filters: {
                status: status || '',
                sourceType: sourceType || '',
                search: search || ''
            }
        };
    } catch (err) {
        console.error('Failed to load contractor jobs on server:', err);
        return {
            jobs: [],
            filters: {
                status: status || '',
                sourceType: sourceType || '',
                search: search || ''
            }
        };
    }
};
