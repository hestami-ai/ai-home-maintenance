import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ parent }) => {
    const { session } = await parent();

    if (!session) {
        throw redirect(303, '/login');
    }

    return {
        onboardingState: {}
    };
};
