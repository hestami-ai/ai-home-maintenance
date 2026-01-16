import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { createModuleLogger } from '$lib/server/logger';
import type { PageServerLoad } from './$types';

const log = createModuleLogger('ConciergeDashboard');

export const load: PageServerLoad = async ({ locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();

    log.debug('Dashboard load started', {
        hasOrganization: !!organization,
        orgId: organization?.id,
        orgName: organization?.name,
        membershipsCount: memberships?.length ?? 0,
        hasStaff: !!staff
    });

    // If no organization is selected, return empty data
    // The layout handles the actual redirection/access control
    if (!organization) {
        log.warn('No organization in context, returning empty data');
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

    log.debug('Context built for API calls', {
        orgId: organization.id,
        role,
        staffRoles,
        pillarAccess
    });

    try {
        // Use the server-side client to fetch data
        const [propertiesResult, casesResult, documentsResult] = await Promise.all([
            client.individualProperty.list({ limit: 50 }),
            client.conciergeCase.list({ limit: 10 }),
            client.document.listDocuments({ limit: 100 })
        ]);

        // Log the raw results for debugging
        log.debug('API results received', {
            propertiesOk: propertiesResult.ok,
            propertiesCount: propertiesResult.ok ? propertiesResult.data.properties.length : 0,
            propertiesError: !propertiesResult.ok ? (propertiesResult as any).error : undefined,
            casesOk: casesResult.ok,
            casesCount: casesResult.ok ? casesResult.data.cases.length : 0,
            casesError: !casesResult.ok ? (casesResult as any).error : undefined,
            documentsOk: documentsResult.ok,
            documentsCount: documentsResult.ok ? documentsResult.data.documents.length : 0,
            documentsError: !documentsResult.ok ? (documentsResult as any).error : undefined
        });

        const result = {
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

        log.info('Dashboard data loaded successfully', {
            propertiesCount: result.properties.length,
            serviceCallsCount: result.serviceCalls.length,
            documentCount: result.documentCount
        });

        return result;
    } catch (err) {
        log.error('Failed to load concierge dashboard data', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
        });
        return {
            properties: [],
            serviceCalls: [],
            documentCount: 0
        , association: null};
    }
};
