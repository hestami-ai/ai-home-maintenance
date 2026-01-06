import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();
    
    if (!organization) {
        return { properties: [] , association: null};
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
    const client = createDirectClient(context);

    try {
        const result = await client.individualProperty.list({ limit: 100 });
        return {
            properties: result.data.properties.map((p) => ({
                id: p.id,
                name: p.name,
                addressLine1: p.addressLine1
            }))
        };
    } catch (err) {
        console.error('Failed to load properties for upload:', err);
        return { properties: [] , association: null};
    }
};
