import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    const { organization } = await parent();
    
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
    
    // Pass organization through options (don't mutate locals)
    const role = organization ? orgRoles[organization.id] : undefined;
    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess, organization, role });
    const client = createDirectClient(context);
    const caseId = params.id;

    try {
        const [caseRes, vendorsRes] = await Promise.all([
            client.conciergeCase.getDetail({ id: caseId }),
            client.vendorCandidate.listByCase({ caseId })
        ]);

        if (!caseRes.ok) {
            throw error(404, 'Case not found');
        }

        return {
            caseDetail: caseRes.data,
            vendors: vendorsRes.ok ? vendorsRes.data.vendorCandidates : []
        };
    } catch (err) {
        console.error('Failed to load case vendors on server:', err);
        if ((err as any).status === 404) throw err;
        throw error(500, 'Failed to fetch case or vendors from server');
    }
};
