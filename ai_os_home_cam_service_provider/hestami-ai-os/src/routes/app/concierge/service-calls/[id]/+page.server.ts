import type { PageServerLoad } from './$types';
import { orpc } from '$lib/api';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent }) => {
    const { organization } = await parent();
    const caseId = params.id;

    if (!organization) {
        throw error(401, 'Organization context required');
    }

    try {
        // Fetch core service call detail
        const detailResult = await orpc.conciergeCase.getDetail({ id: caseId });
        const data = detailResult.data;

        // Fetch quotes if status indicates they might exist
        let quotes: any[] = [];

        if (['QUOTE_REQUESTED', 'QUOTE_RECEIVED', 'QUOTE_APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(data.case.status)) {
            try {
                const quotesResult = await orpc.vendorBid.listByCase({ caseId, limit: 20 });
                quotes = quotesResult.data.bids.filter((b: any) => b.isCustomerFacing !== false);
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
