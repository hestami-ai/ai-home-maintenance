import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent, locals, cookies }) => {
    const { organization } = await parent();
    if (!organization) {
        return {
            associations: [],
            currentAssociation: null,
            badgeCounts: { violations: 0, arcRequests: 0, workOrders: 0 }
        };
    }

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

    // Pass organization through options (don't mutate locals)
    const role = orgRoles[organization.id];
    const context = buildServerContext(locals, { orgRoles, organization, role });
    const client = createDirectClient(context);

    try {
        const response = await client.association.list({});
        const associations = response.ok ? response.data.associations : [];

        // Determine current association from cookie or default to first
        const cookieId = cookies.get('cam_association_id');
        let currentAssociation = null;

        if (associations.length > 0) {
            if (cookieId) {
                currentAssociation = associations.find((a) => a.id === cookieId) || associations[0];
            } else {
                currentAssociation = associations[0];
            }
        }

        // Fetch badge counts if we have an association
        let badgeCounts = { violations: 0, arcRequests: 0, workOrders: 0 };

        if (currentAssociation) {
            try {
                const [violationsRes, arcRes, workOrdersRes] = await Promise.all([
                    client.violation.list({}),
                    client.arcRequest.list({ status: 'SUBMITTED' }),
                    client.workOrder.list({ status: 'IN_PROGRESS' })
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

