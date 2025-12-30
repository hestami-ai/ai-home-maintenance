import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
    const { organization } = await parent();
    if (!organization) {
        return { technicians: [], filters: { status: 'all' } };
    }

    // Build context for direct server-side calling
    let orgRoles: Record<string, any> = {};
    if (locals.user) {
        const memberships = await prisma.userOrganization.findMany({ where: { userId: locals.user.id } });
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
    }
    
    // Pass organization through options (don't mutate locals)
    const role = orgRoles[organization.id];
    const context = buildServerContext(locals, { orgRoles, organization, role });
    const status = url.searchParams.get('status') || 'all';
    const client = createDirectClient(context);

    try {
        const result = await client.technician.list({
            // The API expects includeInactive boolean
            includeInactive: status !== 'active' // If status is 'all' or 'inactive', include inactive
        });

        return {
            technicians: result.data.technicians,
            filters: {
                status
            }
        };
    } catch (err) {
        console.error('Failed to load technicians:', err);
        return { technicians: [], filters: { status } };
    }
};
