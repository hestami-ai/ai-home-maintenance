import type { LayoutServerLoad } from './$types';
import type { Organization, Staff, UserRole } from '../../generated/prisma/client';
import { auth } from '$lib/server/auth';
import { prisma } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ request }) => {
	// 1. Get session from Better Auth
	const session = await auth.api.getSession({
		headers: request.headers
	});

	// Initialize return data
	let memberships: Array<{
		organization: Organization;
		role: string;
		isDefault: boolean;
	}> = [];
	let organization: Organization | null = null;
	let staff: Staff | null = null;

	// 2. If authenticated, fetch context data
	// Note: We use Prisma directly here because we are BOOTSTRAPPING the user context.
	// For all other data fetching in child routes, use createDirectClient().
	if (session?.user) {
		const [membershipsList, staffProfile] = await Promise.all([
			prisma.userOrganization.findMany({
				where: {
					userId: session.user.id,
					organization: { deletedAt: null }
				},
				include: { organization: true },
				orderBy: { isDefault: 'desc' }
			}),
			prisma.staff.findUnique({
				where: { userId: session.user.id }
			})
		]);

		// Map to ensure we return the properly typed structure with full Organization objects
		memberships = membershipsList.map((m) => ({
			organization: m.organization,
			role: m.role,
			isDefault: m.isDefault
		}));

		if (memberships.length > 0) {
			organization = memberships[0].organization;
		}

		staff = staffProfile;
	}

	return {
		user: session?.user ?? null,
		session: session?.session ?? null,
		memberships,
		organization,
		staff
	};
};
