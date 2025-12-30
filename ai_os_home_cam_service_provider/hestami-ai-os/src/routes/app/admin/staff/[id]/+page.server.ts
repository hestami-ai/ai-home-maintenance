import { error } from '@sveltejs/kit';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
    // Build context for direct server-side calling
    let staffRoles: any[] = [];
    let pillarAccess: any[] = [];
    let orgRoles: Record<string, any> = {};
    
    if (locals.user) {
        const [staffProfile, memberships] = await Promise.all([
            prisma.staff.findUnique({ where: { userId: locals.user.id } }),
            prisma.userOrganization.findMany({ where: { userId: locals.user.id } })
        ]);
        if (staffProfile && staffProfile.status === 'ACTIVE') {
            staffRoles = staffProfile.roles;
            pillarAccess = staffProfile.pillarAccess;
        }
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
    }
    
    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess });
    const client = createDirectClient(context);

    try {
        const response = await client.staff.get({
            staffId: params.id
        });

        if (!response.ok) {
            throw error(404, 'Staff member not found');
        }

        return {
            staff: response.data.staff
        };
    } catch (err) {
        console.error('Failed to load staff member:', err);
        throw error(500, 'Internal Server Error');
    }
};
