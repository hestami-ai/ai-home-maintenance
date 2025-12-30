import { error } from '@sveltejs/kit';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    const { organization } = await parent();

    if (!organization) {
        throw error(401, 'Organization required');
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
    const client = createDirectClient(context);

    try {
        const response = await client.individualProperty.get({
            propertyId: params.id
        });

        if (!response.ok) {
            throw error(404, 'Property not found');
        }

        return {
            property: response.data.property
        };
    } catch (err) {
        console.error('Failed to load property:', err);
        throw error(500, 'Internal Server Error');
    }
};
