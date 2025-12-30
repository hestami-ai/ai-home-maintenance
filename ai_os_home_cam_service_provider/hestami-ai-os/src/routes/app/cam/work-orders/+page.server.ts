import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
    const { organization } = await parent();

    // Build context for direct server-side calling
    let orgRoles: Record<string, any> = {};
    if (locals.user) {
        const memberships = await prisma.userOrganization.findMany({
            where: { userId: locals.user.id }
        });
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
    }

    const context = buildServerContext(locals, { orgRoles });
    const client = createDirectClient(context);

    const status = url.searchParams.get('status') || undefined;
    const priority = url.searchParams.get('priority') || undefined;
    const search = url.searchParams.get('search') || undefined;

    // We can rely on the server client to automatically handle the organization context filtering
    // because buildServerContext uses locals.organization which is set in the hooks/layout
    // However, for CAM specifically, the "current association" might be different from the "user's organization"
    // if the user is a CAM manager.
    // In +layout.server.ts of app/cam, we likely set logic for selected association. 
    // BUT, the `createDirectClient` primarily uses `locals.organization`.
    // If the CAM routes rely on a specific `associationId` passed in headers or implicit context, 
    // we need to ensure that's propagated.

    // Looking at `workOrderApi.list` usage in the original svelte file:
    // It checked `!$currentAssociation?.id`.
    // The `list` method in `workOrder.ts` (client) likely sends `x-association-id` header or similar
    // OR the backend filters by organization if the organization IS the association.

    // Assuming the standard pattern where the Organization IS the context for the list:
    const response = await client.workOrder.list({
        status: status as any,
        priority: priority as any,
        search
    });

    return {
        workOrders: response.data.workOrders,
        filters: {
            status,
            priority,
            search
        }
    };
};
