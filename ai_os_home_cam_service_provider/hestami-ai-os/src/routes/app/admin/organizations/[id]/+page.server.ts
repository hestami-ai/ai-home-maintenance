import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { error } from '@sveltejs/kit';
import { createModuleLogger } from '$lib/server/logger';

const log = createModuleLogger('OrganizationDetailPage');

export const load: PageServerLoad = async ({ params, locals, parent }) => {
	const { staff, memberships } = await parent();

	const staffRoles = staff?.roles ?? [];
	const pillarAccess = staff?.pillarAccess ?? [];
	const orgRoles: Record<string, any> = {};
	for (const m of memberships ?? []) {
		orgRoles[m.organization.id] = m.role;
	}

	const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess });
	const client = createDirectClient(context);

	try {
		log.debug('Loading organization details', { organizationId: params.id });

		// Fetch organization details and members in parallel
		const [orgResponse, membersResponse] = await Promise.all([
			client.organizationAdmin.get({ organizationId: params.id }),
			client.organizationAdmin.getMembers({ organizationId: params.id, limit: 20 })
		]);

		if (!orgResponse.ok) {
			log.error('organizationAdmin.get returned not ok', { response: orgResponse });
			throw error(404, 'Organization not found');
		}

		return {
			organization: orgResponse.data.organization,
			members: membersResponse.ok ? membersResponse.data.members : [],
			membersHasMore: membersResponse.ok ? membersResponse.data.pagination.hasMore : false,
			isPlatformAdmin: staffRoles.includes('PLATFORM_ADMIN')
		};
	} catch (err) {
		log.error('Failed to load organization', {
			orgId: params.id,
			error: err instanceof Error ? err.message : String(err)
		});

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to load organization');
	}
};
