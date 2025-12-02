import type { PageServerLoad } from './$types';
import { NEXT_PUBLIC_TURNSTILE_SITE_KEY } from '$env/static/private';

export const load: PageServerLoad = async () => {
	return {
		turnstileSiteKey: NEXT_PUBLIC_TURNSTILE_SITE_KEY
	};
};
