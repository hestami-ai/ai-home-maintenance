import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();
    
    if (!organization) {
        return { technicians: [], filters: { status: 'all' } };
    }

    // Build context using data from parent layout
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
    }
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const role = orgRoles[organization.id];
    
    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess, organization, role });
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
