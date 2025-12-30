import type { PageServerLoad } from './$types';
import { orpc } from '$lib/api';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent }) => {
    const { organization } = await parent();
    const documentId = params.id;

    if (!organization) {
        throw error(401, 'Organization context required');
    }

    try {
        const result = await orpc.document.getDocument({ id: documentId });

        return {
            document: result.data.document,
            contextBindings: result.data.contextBindings
        };
    } catch (err) {
        console.error(`Failed to load document detail for ${documentId}:`, err);
        throw error(500, 'Failed to load document details');
    }
};
