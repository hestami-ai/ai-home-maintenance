import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { createModuleLogger } from '$lib/server/logger';
import { prisma } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

const log = createModuleLogger('CamLayout');

export const load: LayoutServerLoad = async ({ parent, locals }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();
    
    if (!organization) {
        return {
            associations: [],
            currentAssociation: null,
            badgeCounts: { violations: 0, arcRequests: 0, workOrders: 0 }
        };
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
        const response = await client.association.list({});
        const associations: Array<{ id: string; name: string; status: string; propertyCount?: number }> = 
            response.ok ? response.data.associations : [];

        // Determine current association from user preference in database
        let currentAssociation = null;

        if (associations.length > 0 && locals.user) {
            // Look up user's preferred association for this organization
            const preference = await prisma.userAssociationPreference.findUnique({
                where: {
                    userId_organizationId: {
                        userId: locals.user.id,
                        organizationId: organization.id
                    }
                }
            });

            log.debug('Association preference check', {
                userId: locals.user.id,
                preferredAssociationId: preference?.associationId,
                associationsCount: associations.length
            });

            if (preference?.associationId) {
                // Use preferred association if it exists in the list
                currentAssociation = associations.find((a) => a.id === preference.associationId) || associations[0];
            } else {
                // Default to first association
                currentAssociation = associations[0];
            }
        } else if (associations.length > 0) {
            currentAssociation = associations[0];
        }

        log.debug('Current association selected', {
            currentAssociationId: currentAssociation?.id,
            currentAssociationName: currentAssociation?.name
        });

        // Fetch badge counts if we have an association
        let badgeCounts = { violations: 0, arcRequests: 0, workOrders: 0 };

        if (currentAssociation) {
            // Rebuild context with association for badge count queries
            const assocContext = buildServerContext(locals, { 
                orgRoles, 
                staffRoles, 
                pillarAccess, 
                organization, 
                role,
                association: currentAssociation as any // Pass association for context.associationId
            });
            const assocClient = createDirectClient(assocContext);

            try {
                const [violationsRes, arcRes, workOrdersRes] = await Promise.all([
                    assocClient.violation.list({}),
                    assocClient.arcRequest.list({ status: 'SUBMITTED' }),
                    assocClient.workOrder.list({ status: 'IN_PROGRESS' })
                ]);

                if (violationsRes.ok && violationsRes.data?.violations) {
                    // Filter for active violations
                    const activeStatuses = ['OPEN', 'NOTICE_SENT', 'CURE_PERIOD', 'ESCALATED'];
                    badgeCounts.violations = violationsRes.data.violations.filter((v: any) =>
                        activeStatuses.includes(v.status)
                    ).length;
                }

                if (arcRes.ok && arcRes.data?.requests) {
                    badgeCounts.arcRequests = arcRes.data.requests.length;
                }

                if (workOrdersRes.ok && workOrdersRes.data?.workOrders) {
                    badgeCounts.workOrders = workOrdersRes.data.workOrders.length;
                }
            } catch (e) {
                console.error('Failed to load badge counts:', e);
            }
        }

        return {
            associations,
            currentAssociation,
            badgeCounts
        };
    } catch (err) {
        console.error('Failed to load associations in CAM layout:', err);
        return {
            associations: [],
            currentAssociation: null,
            badgeCounts: { violations: 0, arcRequests: 0, workOrders: 0 }
        };
    }
};

