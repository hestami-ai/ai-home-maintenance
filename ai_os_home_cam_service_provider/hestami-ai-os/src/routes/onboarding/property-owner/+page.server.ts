import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    // Redirect to first step of property owner onboarding
    // Store reset will happen in the client via $effect.pre() when page loads
    redirect(302, '/onboarding/property-owner/type');
};
