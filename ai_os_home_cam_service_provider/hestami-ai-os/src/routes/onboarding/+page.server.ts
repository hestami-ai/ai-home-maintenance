import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ parent }) => {
    const { session, memberships } = await parent();

    if (!session) {
        throw redirect(303, '/login');
    }

    return {
        memberships
    };
};
