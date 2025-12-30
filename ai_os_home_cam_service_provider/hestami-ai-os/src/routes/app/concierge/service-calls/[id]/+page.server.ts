import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();
    const caseId = params.id;

    if (!organization) {
        throw error(401, 'Organization context required');
    }

    // Build context using data from parent layout
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
    }
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const role = orgRoles[organization.id];

    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess, organization, role });
    const client = createDirectClient(context);

    try {
        // Fetch core service call detail
        const detailResult = await client.conciergeCase.getDetail({ id: caseId });

        if (!detailResult.ok) {
            const errResponse = detailResult as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Service call not found';
            throw error(status, message);
        }

        const data = detailResult.data;

        // Fetch quotes if status indicates they might exist
        let quotes: any[] = [];

        if (['QUOTE_REQUESTED', 'QUOTE_RECEIVED', 'QUOTE_APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(data.case.status)) {
            try {
                const quotesResult = await client.vendorBid.listByCase({ caseId, limit: 20 });
                if (quotesResult.ok) {
                    quotes = quotesResult.data.bids.filter((b: any) => b.isCustomerFacing !== false);
                }
            } catch (qErr) {
                console.error('Failed to load quotes on server:', qErr);
            }
        }

        return {
            serviceCall: {
                id: data.case.id,
                caseNumber: data.case.caseNumber,
                title: data.case.title,
                description: data.case.description,
                status: data.case.status,
                priority: data.case.priority,
                createdAt: data.case.createdAt,
                updatedAt: data.case.updatedAt,
                resolvedAt: data.case.resolvedAt ?? null,
                resolutionSummary: data.case.resolutionSummary ?? null
            },
            property: data.property,
            notes: data.notes.filter((n: any) => !n.isInternal),
            statusHistory: data.statusHistory,
            quotes
        };
    } catch (err) {
        console.error(`Failed to load service call ${caseId}:`, err);
        throw error(500, 'Failed to load service call details');
    }
};
