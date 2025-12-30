import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { error } from '@sveltejs/kit';
import { recordSpanError } from '$lib/server/api/middleware/tracing';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
    // Get staff and memberships from parent layout (already fetched via SECURITY DEFINER)
    const { staff, memberships } = await parent();

    // Build context using data from parent layout
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
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
            const errResponse = result as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Failed to fetch activity events from server';
            throw error(status, message);
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
        const errorObj = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to load admin activity on server:', err);

        // Record error in trace for observability
        await recordSpanError(errorObj, {
            errorCode: 'ACTIVITY_LOAD_FAILED',
            errorType: 'PAGE_LOAD_ERROR'
        });

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
            },
            error: 'Failed to load activity events'
        };
    }
};
