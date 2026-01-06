import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();

    // If no organization is selected, return empty data
    // The layout handles the actual redirection/access control
    if (!organization) {
        return {
            properties: [],
            serviceCalls: []
        , association: null};
    }

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

    try {
        // Use the server-side client to fetch data
        const [propertiesResult, casesResult, documentsResult] = await Promise.all([
            client.individualProperty.list({ limit: 50 }),
            client.conciergeCase.list({ limit: 10 }),
            client.document.listDocuments({ limit: 100 })
        ]);

        return {
            properties: propertiesResult.ok ? propertiesResult.data.properties.map((p) => ({
                id: p.id,
                name: p.name,
                addressLine1: p.addressLine1,
                city: p.city,
                state: p.state,
                postalCode: p.postalCode
            })) : [],
            serviceCalls: casesResult.ok ? casesResult.data.cases.map((c) => ({
                id: c.id,
                caseNumber: c.caseNumber,
                title: c.title,
                status: c.status,
                priority: c.priority,
                createdAt: c.createdAt
            })) : [],
            documentCount: documentsResult.ok ? documentsResult.data.documents.length : 0
        };
    } catch (err) {
        console.error('Failed to load concierge dashboard data:', err);
        return {
            properties: [],
            serviceCalls: [],
            documentCount: 0
        , association: null};
    }
};
