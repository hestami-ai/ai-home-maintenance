import { error } from '@sveltejs/kit';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();

    if (!organization) {
        throw error(401, 'Organization required');
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
        const response = await client.individualProperty.get({
            propertyId: params.id
        });

        if (!response.ok) {
            const errResponse = response as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Property not found';
            throw error(status, message);
        }

        return {
            property: response.data.property
        };
    } catch (err) {
        console.error('Failed to load property:', err);
        throw error(500, 'Internal Server Error');
    }
};
