import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';

export const load: PageServerLoad = async ({ locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();

    if (!organization) {
        return {
            documents: []
        , association: null};
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
        const result = await client.document.listDocuments({
            limit: 100
        });

        return {
            documents: result.ok ? result.data.documents : [],
            organization
        , association: null};
    } catch (err) {
        console.error('Failed to load concierge documents:', err);
        return {
            documents: []
        , association: null};
    }
};
