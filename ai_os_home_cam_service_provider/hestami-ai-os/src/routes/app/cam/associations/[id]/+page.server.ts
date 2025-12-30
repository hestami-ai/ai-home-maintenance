import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
    const { organization } = await parent();
    if (!organization) return {};

    // Build context
    let orgRoles: Record<string, any> = {};
    if (locals.user) {
        const memberships = await prisma.userOrganization.findMany({
            where: { userId: locals.user.id }
        });
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
    }

    const role = orgRoles[organization.id];
    const context = buildServerContext(locals, { orgRoles, organization, role });
    const client = createDirectClient(context);

    const associationId = params.id;

    try {
        const [associationRes, documentsRes, historyRes] = await Promise.all([
            client.association.get({ id: associationId }),
            client.document.listDocuments({
                contextType: 'ASSOCIATION',
                contextId: associationId
            }),
            client.activityEvent.getByEntity({
                entityType: 'ASSOCIATION',
                entityId: associationId,
                limit: 10
            })
        ]);

        if (!associationRes.ok || !associationRes.data?.association) {
            throw error(404, 'Association not found');
        }

        return {
            association: associationRes.data.association,
            documents: documentsRes.ok ? documentsRes.data.documents : [],
            history: historyRes.ok ? historyRes.data.events : []
        };

    } catch (err) {
        console.error('Failed to load association details:', err);
        throw error(404, 'Association not found');
    }
};
