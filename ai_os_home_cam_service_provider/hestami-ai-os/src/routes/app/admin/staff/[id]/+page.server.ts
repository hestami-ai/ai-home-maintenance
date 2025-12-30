import { error } from '@sveltejs/kit';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
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
        const response = await client.staff.get({
            staffId: params.id
        });

        if (!response.ok) {
            const errResponse = response as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Staff member not found';
            throw error(status, message);
        }

        return {
            staff: response.data.staff
        };
    } catch (err) {
        console.error('Failed to load staff member:', err);
        throw error(500, 'Internal Server Error');
    }
};
