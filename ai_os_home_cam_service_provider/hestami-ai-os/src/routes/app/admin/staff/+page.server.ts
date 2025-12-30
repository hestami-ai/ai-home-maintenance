import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, locals }) => {
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
    const status = url.searchParams.get('status') as any;
    const role = url.searchParams.get('role') as any;

    try {
        const response = await client.staff.list({
            status: status || undefined,
            role: role || undefined
        });

        return {
            staffList: response.ok ? response.data.staff : [],
            filters: {
                status: status || '',
                role: role || ''
            }
        };
    } catch (err) {
        console.error('Failed to load staff list on server:', err);
        return {
            staffList: [],
            filters: {
                status: status || '',
                role: role || ''
            }
        };
    }
};
