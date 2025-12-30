import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
    const { organization } = await parent();

    if (!organization) {
        return {
            cases: []
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
        const response = await client.conciergeCase.list({ limit: 5 });

        return {
            cases: response.ok ? response.data.cases.map(c => ({
                ...c,
                createdAt: c.createdAt
                // Ensure simple types for serialization if needed
            })) : []
        };
    } catch (err) {
        console.error('Failed to load owner dashboard data:', err);
        return {
            cases: []
        };
    }
};
