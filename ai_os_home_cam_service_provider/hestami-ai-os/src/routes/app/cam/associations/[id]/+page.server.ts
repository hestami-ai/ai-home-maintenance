import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { DocumentContextType, ActivityEntityType } from '../../../../../../generated/prisma/enums.js';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();
    if (!organization) return {};

    // Build context using data from parent layout
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
    }
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const role = orgRoles[organization.id];
    
    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess, organization, role });
    const client = createDirectClient(context);

    const associationId = params.id;

    try {
        const [associationRes, documentsRes, historyRes] = await Promise.all([
            client.association.get({ id: associationId }),
            client.document.listDocuments({
                contextType: DocumentContextType.ASSOCIATION,
                contextId: associationId
            }),
            client.activityEvent.getByEntity({
                entityType: ActivityEntityType.ASSOCIATION,
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
