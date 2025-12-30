import type { PageServerLoad } from './$types';
import { orpc } from '$lib/api';

export const load: PageServerLoad = async ({ parent }) => {
    const { organization } = await parent();

    if (!organization) {
        return {
            properties: []
        };
    }

    try {
        const result = await orpc.individualProperty.list({
            limit: 50
        });

        return {
            properties: result.data.properties
        };
    } catch (err) {
        console.error('Failed to load concierge properties:', err);
        return {
            properties: []
        };
    }
};
