import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    const { id } = params;
    if (!id) throw error(404, 'Violation ID required');

    const { organization } = await parent();

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

    const context = buildServerContext(locals, { orgRoles });
    const client = createDirectClient(context);

    // Parallel fetching
    const [
        violationRes,
        documentsRes,
        historyRes,
        noticesRes,
        // responsesRes
    ] = await Promise.all([
        client.violation.get({ id }),
        client.document.listDocuments({ contextType: 'VIOLATION', contextId: id }),
        client.activityEvent.getByEntity({ entityType: 'VIOLATION', entityId: id }),
        client.violation.listNotices({ violationId: id }),
        // (client.violation as any).getResponses({ id }) 
    ]);


    if (!violationRes.ok || !violationRes.data.violation) {
        throw error(404, 'Violation not found');
    }

    // Transform history to match component expectations
    const history = historyRes.ok ? historyRes.data.events.map((e: any) => ({
        id: e.id,
        action: e.action,
        description: e.summary,
        performedBy: e.performedBy,
        createdAt: e.createdAt
    })) : [];

    // Transform notices
    const notices = noticesRes.ok ? noticesRes.data.notices.map((n: any) => ({
        id: n.id,
        noticeType: n.noticeType,
        sentDate: n.sentAt,
        recipient: '',
        deliveryStatus: n.deliveryMethod
    })) : [];

    // Transform owner responses (Stubbed for now as API endpoint is missing/being verified)
    const ownerResponses: any[] = [];
    /*
    const ownerResponses = responsesRes.ok ? responsesRes.data.responses.map((r: any) => ({
        id: r.id,
        submittedDate: r.submittedAt,
        content: r.content,
        submittedBy: r.responseType,
        hasAttachments: false,
        acknowledged: false
    })) : [];
    */

    return {
        violation: violationRes.data.violation,
        documents: documentsRes.ok ? documentsRes.data.documents : [],
        history,
        notices,
        ownerResponses
    };
};
