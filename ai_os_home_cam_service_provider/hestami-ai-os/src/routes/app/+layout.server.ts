import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent, url }) => {
	const { user } = await parent();

	// Redirect unauthenticated users to login with return URL
	if (!user) {
		const returnTo = url.pathname + url.search;
		throw redirect(302, `/login?returnTo=${encodeURIComponent(returnTo)}`);
	}

	return {};
};
