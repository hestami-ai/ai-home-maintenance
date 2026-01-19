import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { UserRole } from '../../../../../../generated/prisma/client.js';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
    // Get staff, memberships, and organization from parent layout
    const { staff, memberships, organization } = await parent();
    
    // Build context using data from parent layout
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const orgRoles: Record<string, UserRole> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role as UserRole;
    }
    
    // Find the user's role in the current organization
    const currentMembership = memberships?.find(m => m.organization.id === organization?.id);
    
    const context = buildServerContext(locals, { 
        orgRoles, 
        staffRoles, 
        pillarAccess,
        organization: organization ?? undefined,
        role: currentMembership?.role as UserRole | undefined
    });
    const client = createDirectClient(context);
    
    const status = url.searchParams.get('status') as 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | null;
    const role = url.searchParams.get('role') as 'OWNER' | 'ADMIN' | 'OFFICE_MANAGER' | 'DISPATCHER' | 'ESTIMATOR' | 'BOOKKEEPER' | 'TECHNICIAN' | null;

    try {
        const response = await client.serviceProviderTeam.list({
            status: status || undefined,
            role: role || undefined
        });

        return {
            teamMembers: response.ok ? response.data.teamMembers : [],
            filters: {
                status: status || '',
                role: role || ''
            }
        };
    } catch (err) {
        console.error('Failed to load team members on server:', err);
        return {
            teamMembers: [],
            filters: {
                status: status || '',
                role: role || ''
            }
        };
    }
};
