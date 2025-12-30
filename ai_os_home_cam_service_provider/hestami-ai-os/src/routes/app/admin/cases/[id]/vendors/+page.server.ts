import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    // Get staff, memberships, and organization from parent layout (already fetched via SECURITY DEFINER)
    const { staff, memberships, organization } = await parent();
    
    // Build context using data from parent layout
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
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
