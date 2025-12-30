import { error } from '@sveltejs/kit';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
    const { organization } = await parent();

    if (!organization) {
        return {
            properties: []
        };
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
        // Fetch properties for selection
        const result = await client.individualProperty.list({ limit: 100 });
        const properties = result.data.properties.map((p) => ({
            id: p.id,
            name: p.name,
            addressLine1: p.addressLine1,
            city: p.city,
            state: p.state,
            postalCode: p.postalCode
        }));

        return {
            properties
        };
    } catch (err) {
        console.error('Failed to load properties for new service call:', err);
        return {
            properties: []
        };
    }
};
