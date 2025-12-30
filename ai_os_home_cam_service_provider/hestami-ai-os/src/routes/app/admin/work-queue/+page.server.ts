import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals }) => {
    const pillar = (url.searchParams.get('pillar') || 'ALL') as any;
    const urgency = url.searchParams.get('urgency') || undefined;
    const assignedToMe = url.searchParams.get('assignedToMe') === 'true';
    const unassignedOnly = url.searchParams.get('unassignedOnly') === 'true';

    // Build context from locals for direct server-side calling
    // Fetch staff profile for authorization (work queue is staff-only)
    let staffRoles: any[] = [];
    let pillarAccess: any[] = [];
    let orgRoles: Record<string, any> = {};
    
    if (locals.user) {
        const [staffProfile, memberships] = await Promise.all([
            prisma.staff.findUnique({
                where: { userId: locals.user.id }
            }),
            prisma.userOrganization.findMany({
                where: { userId: locals.user.id }
            })
        ]);
        
        if (staffProfile && staffProfile.status === 'ACTIVE') {
            staffRoles = staffProfile.roles;
            pillarAccess = staffProfile.pillarAccess;
        }
        
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
    }
    
    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess });
    const client = createDirectClient(context);

    try {
        const response = await client.workQueue.list({
            pillar,
            urgency: urgency as any,
            assignedToMe,
            unassignedOnly
        });

        if (!response.ok) {
            throw error(500, 'Failed to fetch work queue from server');
        }

        return {
            items: response.data.items,
            summary: response.data.summary,
            filters: {
                pillar,
                urgency,
                assignedToMe,
                unassignedOnly
            }
        };
    } catch (err) {
        console.error('Failed to load work queue on server:', err);
        return {
            items: [],
            summary: null,
            filters: {
                pillar,
                urgency,
                assignedToMe,
                unassignedOnly
            }
        };
    }
};
