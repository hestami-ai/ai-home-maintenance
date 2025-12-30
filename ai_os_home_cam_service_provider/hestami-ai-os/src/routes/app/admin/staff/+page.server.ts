import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
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
    const status = url.searchParams.get('status') as any;
    const role = url.searchParams.get('role') as any;

    try {
        const response = await client.staff.list({
            status: status || undefined,
            role: role || undefined
        });

        return {
            staffList: response.ok ? response.data.staff : [],
            filters: {
                status: status || '',
                role: role || ''
            }
        };
    } catch (err) {
        console.error('Failed to load staff list on server:', err);
        return {
            staffList: [],
            filters: {
                status: status || '',
                role: role || ''
            }
        };
    }
};
