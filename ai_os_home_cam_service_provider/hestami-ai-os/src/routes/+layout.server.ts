import type { LayoutServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { prisma } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ request, cookies }) => {
	// Get session from Better Auth
	const session = await auth.api.getSession({
		headers: request.headers
	});

	// Get user's default organization if authenticated
	let organization = null;
	if (session?.user) {
		const membership = await prisma.userOrganization.findFirst({
			where: {
				userId: session.user.id,
				isDefault: true,
				organization: { deletedAt: null }
			},
			include: { organization: true }
		});
		organization = membership?.organization ?? null;
	}

	return {
		user: session?.user ?? null,
		session: session?.session ?? null,
		organization
	};
};
