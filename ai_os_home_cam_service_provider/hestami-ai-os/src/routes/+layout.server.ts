import type { LayoutServerLoad } from './$types';
import type { Organization, Staff } from '../../generated/prisma/client';
import { auth } from '$lib/server/auth';
import { prisma } from '$lib/server/db';
import { createModuleLogger } from '$lib/server/logger';

const log = createModuleLogger('RootLayout');

// Type for the raw membership row from SECURITY DEFINER function
interface MembershipRow {
	id: string;
	user_id: string;
	organization_id: string;
	role: string;
	is_default: boolean;
	created_at: Date;
	updated_at: Date;
	org_id: string;
	org_name: string;
	org_slug: string;
	org_type: string;
	org_status: string;
}

// Type for the raw staff row from SECURITY DEFINER function
interface StaffRow {
	id: string;
	user_id: string;
	display_name: string;
	title: string | null;
	status: string;
	activated_at: Date | null;
	suspended_at: Date | null;
	deactivated_at: Date | null;
	suspension_reason: string | null;
	deactivation_reason: string | null;
	roles: string[];
	pillar_access: string[];
	can_be_assigned_cases: boolean;
	created_at: Date;
	updated_at: Date;
}

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

	// 2. If authenticated, fetch context data using SECURITY DEFINER functions
	// These functions bypass RLS to solve the chicken-and-egg problem:
	// - We need memberships to set org context
	// - But RLS on user_organizations requires org context to be set
	if (session?.user) {
		log.debug('Fetching user context', { userId: session.user.id, email: session.user.email });

		// Use SECURITY DEFINER functions to bypass RLS for context bootstrapping
		const [membershipRows, staffRows] = await Promise.all([
			prisma.$queryRaw<MembershipRow[]>`SELECT * FROM get_user_memberships(${session.user.id})`,
			prisma.$queryRaw<StaffRow[]>`SELECT * FROM get_staff_profile(${session.user.id})`
		]);

		log.debug('Context fetched', {
			membershipsCount: membershipRows.length,
			hasStaff: staffRows.length > 0,
			staffStatus: staffRows[0]?.status
		});

		// Transform membership rows to the expected structure
		memberships = membershipRows.map((row) => ({
			organization: {
				id: row.org_id,
				name: row.org_name,
				slug: row.org_slug,
				type: row.org_type,
				status: row.org_status
			} as Organization,
			role: row.role,
			isDefault: row.is_default
		}));

		if (memberships.length > 0) {
			organization = memberships[0].organization;
			log.debug('Default organization set', {
				orgId: organization.id,
				orgName: organization.name,
				orgSlug: organization.slug
			});
		}

		// Transform staff row to Staff type
		if (staffRows.length > 0) {
			const row = staffRows[0];
			staff = {
				id: row.id,
				userId: row.user_id,
				displayName: row.display_name,
				title: row.title,
				status: row.status,
				activatedAt: row.activated_at,
				suspendedAt: row.suspended_at,
				deactivatedAt: row.deactivated_at,
				suspensionReason: row.suspension_reason,
				deactivationReason: row.deactivation_reason,
				roles: row.roles,
				pillarAccess: row.pillar_access,
				canBeAssignedCases: row.can_be_assigned_cases,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				activationCodeEncrypted: null,
				activationCodeExpiresAt: null
			} as Staff;
		}
	}

	return {
		user: session?.user ?? null,
		session: session?.session ?? null,
		memberships,
		organization,
		staff
	};
};
