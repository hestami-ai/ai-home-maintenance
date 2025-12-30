import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals }) => {
    // Build context for direct server-side calling
    let staffRoles: any[] = [];
    let pillarAccess: any[] = [];
    let orgRoles: Record<string, any> = {};
    
    if (locals.user) {
        const [staffProfile, memberships] = await Promise.all([
            prisma.staff.findUnique({ where: { userId: locals.user.id } }),
            prisma.userOrganization.findMany({ where: { userId: locals.user.id } })
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
    const entityType = url.searchParams.get('entityType') as any;
    const entityId = url.searchParams.get('entityId') || undefined;
    const action = url.searchParams.get('action') as any;
    const eventCategory = url.searchParams.get('eventCategory') as any;
    const performedByType = url.searchParams.get('actorType') as any;
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    try {
        let result;
        if (entityType && entityId) {
            result = await client.activityEvent.staffGetByEntity({
                entityType,
                entityId,
                limit: 50
            });
        } else {
            result = await client.activityEvent.staffList({
                entityType: entityType || undefined,
                action: action || undefined,
                eventCategory: eventCategory || undefined,
                performedByType: performedByType || undefined,
                startDate: startDate ? new Date(startDate).toISOString() : undefined,
                endDate: endDate ? new Date(endDate).toISOString() : undefined,
                limit: 50
            });
        }

        if (!result.ok) {
            throw error(500, 'Failed to fetch activity events from server');
        }

        return {
            events: result.data.events,
            pagination: result.data.pagination,
            filters: {
                entityType: entityType || '',
                entityId: entityId || '',
                action: action || '',
                eventCategory: eventCategory || '',
                actorType: performedByType || '',
                startDate: startDate || '',
                endDate: endDate || ''
            }
        };
    } catch (err) {
        console.error('Failed to load admin activity on server:', err);
        return {
            events: [],
            pagination: { total: 0, hasMore: false, nextCursor: null },
            filters: {
                entityType: entityType || '',
                entityId: entityId || '',
                action: action || '',
                eventCategory: eventCategory || '',
                actorType: performedByType || '',
                startDate: startDate || '',
                endDate: endDate || ''
            }
        };
    }
};
