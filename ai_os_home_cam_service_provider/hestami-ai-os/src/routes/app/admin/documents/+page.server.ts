import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
    const searchQuery = url.searchParams.get('q') || '';
    const filterType = url.searchParams.get('type') || '';

    try {
        // Currently the staff documents page is a placeholder
        // We'll implement a cross-case document search/list here if the API supports it
        // For now, return empty to be consistent with the current implementation
        return {
            documents: [],
            filters: {
                q: searchQuery,
                type: filterType
            }
        };
    } catch (err) {
        console.error('Failed to load admin documents on server:', err);
        return {
            documents: [],
            filters: {
                q: searchQuery,
                type: filterType
            }
        };
    }
};
