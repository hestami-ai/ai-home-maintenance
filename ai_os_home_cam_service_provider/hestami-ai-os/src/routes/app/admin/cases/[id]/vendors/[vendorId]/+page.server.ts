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

    const role = organization ? orgRoles[organization.id] : undefined;
    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess, organization, role });
    const client = createDirectClient(context);

    const caseId = params.id;
    const vendorId = params.vendorId;

    try {
        const [candidateRes, bidsRes] = await Promise.all([
            client.vendorCandidate.get({ id: vendorId }),
            client.vendorBid.listByCase({ caseId })
        ]);

        if (!candidateRes.ok) {
            throw error(404, 'Vendor candidate not found');
        }

        return {
            vendorCandidate: candidateRes.data.vendorCandidate,
            bids: bidsRes.ok ? bidsRes.data.bids.filter(b => b.vendorCandidateId === vendorId) : []
        };
    } catch (err) {
        console.error('Failed to load vendor candidate on server:', err);
        if ((err as any).status === 404) throw err;
        throw error(500, 'Failed to fetch vendor candidate details');
    }
};
