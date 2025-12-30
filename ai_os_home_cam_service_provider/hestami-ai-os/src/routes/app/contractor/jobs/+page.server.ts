import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { JobStatus, JobSourceType } from '$lib/api/cam';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
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
