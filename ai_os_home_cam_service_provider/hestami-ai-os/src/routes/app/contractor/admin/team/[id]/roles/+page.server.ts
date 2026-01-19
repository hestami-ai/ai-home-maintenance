import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { Organization, Staff } from '$lib/api/cam';
import type { UserRole, Organization as PrismaOrganization } from '../../../../../../../../generated/prisma/client.js';

interface ParentData {
    staff: Staff | null;
    memberships: Array<{
        organization: Organization;
        role: string;
        isDefault: boolean;
    }>;
    organization: Organization | null;
}

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    // Get staff, memberships, and organization from parent layout
    const { staff, memberships, organization } = await parent() as ParentData;
    
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
        organization: organization as unknown as PrismaOrganization | undefined,
        role: currentMembership?.role as UserRole | undefined
    });
    const client = createDirectClient(context);

    try {
        const response = await client.serviceProviderTeam.get({
            teamMemberId: params.id
        });

        return {
            teamMember: response.ok ? response.data.teamMember : null,
            error: response.ok ? null : 'Failed to load team member'
        };
    } catch (err) {
        console.error('Failed to load team member on server:', err);
        return {
            teamMember: null,
            error: 'Failed to load team member'
        };
    }
};
