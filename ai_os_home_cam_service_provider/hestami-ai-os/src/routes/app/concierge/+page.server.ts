import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
    const { organization } = await parent();

    // If no organization is selected, return empty data
    // The layout handles the actual redirection/access control
    if (!organization) {
        return {
            properties: [],
            serviceCalls: []
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

    const role = orgRoles[organization.id];
    const context = buildServerContext(locals, { orgRoles, organization, role });
    const client = createDirectClient(context);

    try {
        // Use the server-side client to fetch data
        const [propertiesResult, casesResult] = await Promise.all([
            client.individualProperty.list({ limit: 50 }),
            client.conciergeCase.list({ limit: 10 })
        ]);

        return {
            properties: propertiesResult.ok ? propertiesResult.data.properties.map((p) => ({
                id: p.id,
                name: p.name,
                addressLine1: p.addressLine1,
                city: p.city,
                state: p.state,
                postalCode: p.postalCode
            })) : [],
            serviceCalls: casesResult.ok ? casesResult.data.cases.map((c) => ({
                id: c.id,
                caseNumber: c.caseNumber,
                title: c.title,
                status: c.status,
                priority: c.priority,
                createdAt: c.createdAt
            })) : []
        };
    } catch (err) {
        console.error('Failed to load concierge dashboard data:', err);
        return {
            properties: [],
            serviceCalls: []
        };
    }
};
