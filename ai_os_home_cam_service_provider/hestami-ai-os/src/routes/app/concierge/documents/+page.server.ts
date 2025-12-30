import type { PageServerLoad } from './$types';
import { orpc } from '$lib/api';

export const load: PageServerLoad = async ({ parent }) => {
    const { organization } = await parent();

    if (!organization) {
        return {
            documents: []
        };
    }

    try {
        const result = await orpc.document.listDocuments({
            limit: 100
        });

        return {
            documents: result.data.documents
        };
    } catch (err) {
        console.error('Failed to load concierge documents:', err);
        return {
            documents: []
        };
    }
};
