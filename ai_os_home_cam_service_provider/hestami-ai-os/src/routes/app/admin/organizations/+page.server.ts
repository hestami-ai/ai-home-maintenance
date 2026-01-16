import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { createModuleLogger } from '$lib/server/logger';

const log = createModuleLogger('OrganizationsPage');

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const type = url.searchParams.get('type') || undefined;
	const status = url.searchParams.get('status') || undefined;
	const search = url.searchParams.get('search') || undefined;

	// Get staff and memberships from parent layout (already fetched via SECURITY DEFINER)
	const { staff, memberships } = await parent();

	// Build context using data from parent layout
	const staffRoles = staff?.roles ?? [];
	const pillarAccess = staff?.pillarAccess ?? [];
	const orgRoles: Record<string, any> = {};
	for (const m of memberships ?? []) {
		orgRoles[m.organization.id] = m.role;
	}

	const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess });
	const client = createDirectClient(context);

	try {
		log.debug('Calling organizationAdmin.list', { type, status, search });

		const response = await client.organizationAdmin.list({
			type: type as any,
			status: status as any,
			search
		});

		if (!response.ok) {
			log.error('organizationAdmin.list returned not ok', { response });
			return {
				organizations: [],
				summary: {
					total: 0,
					byStatus: { active: 0, suspended: 0, inactive: 0 },
					byType: {
						communityAssociation: 0,
						managementCompany: 0,
						serviceProvider: 0,
						individualPropertyOwner: 0,
						trustOrLlc: 0,
						commercialClient: 0,
						externalServiceProvider: 0,
						platformOperator: 0
					}
				},
				filters: {
					type: type || '',
					status: status || '',
					search: search || ''
				},
				isPlatformAdmin: staffRoles.includes('PLATFORM_ADMIN')
			};
		}

		return {
			organizations: response.data.organizations,
			summary: response.data.summary,
			filters: {
				type: type || '',
				status: status || '',
				search: search || ''
			},
			isPlatformAdmin: staffRoles.includes('PLATFORM_ADMIN')
		};
	} catch (err) {
		log.error('Failed to load organizations', {
			error: err instanceof Error ? err.message : String(err)
		});
		return {
			organizations: [],
			summary: {
				total: 0,
				byStatus: { active: 0, suspended: 0, inactive: 0 },
				byType: {
					communityAssociation: 0,
					managementCompany: 0,
					serviceProvider: 0,
					individualPropertyOwner: 0,
					trustOrLlc: 0,
					commercialClient: 0,
					externalServiceProvider: 0,
					platformOperator: 0
				}
			},
			filters: {
				type: type || '',
				status: status || '',
				search: search || ''
			},
			isPlatformAdmin: staffRoles.includes('PLATFORM_ADMIN')
		};
	}
};
