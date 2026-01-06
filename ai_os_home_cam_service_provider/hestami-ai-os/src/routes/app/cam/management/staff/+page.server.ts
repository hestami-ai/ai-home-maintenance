import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();

    // Build context using data from parent layout
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
    }
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const role = orgRoles[organization?.id ?? ''];

    const context = buildServerContext(locals, {
        orgRoles,
        staffRoles,
        pillarAccess,
        organization: organization ?? undefined,
        role
    });
    const client = createDirectClient(context);

    const status = url.searchParams.get('status') || undefined;
    const roleFilter = url.searchParams.get('role') || undefined;
    const search = url.searchParams.get('search') || undefined;

    const response = await client.orgStaff.list({
        status: status as any,
        role: roleFilter as any,
        search,
        limit: 100
    });

    return {
        staffMembers: response.data?.staff ?? [],
        filters: {
            status,
            role: roleFilter,
            search
        }
    };
};
