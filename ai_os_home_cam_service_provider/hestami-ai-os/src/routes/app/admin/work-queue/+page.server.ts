import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { error } from '@sveltejs/kit';
import { createModuleLogger } from '$lib/server/logger';

const log = createModuleLogger('WorkQueuePage');

export const load: PageServerLoad = async ({ url, locals, parent }) => {
    const pillar = (url.searchParams.get('pillar') || 'ALL') as any;
    const urgency = url.searchParams.get('urgency') || undefined;
    const assignedToMe = url.searchParams.get('assignedToMe') === 'true';
    const unassignedOnly = url.searchParams.get('unassignedOnly') === 'true';

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

    try {
        log.debug('Calling workQueue.list', { pillar, urgency, assignedToMe, unassignedOnly });
        log.debug('Context info', { userId: locals.user?.id, staffRoles, pillarAccess });

        const response = await client.workQueue.list({
            pillar,
            urgency: urgency as any,
            assignedToMe,
            unassignedOnly
        });

        log.debug('workQueue.list response', {
            ok: response.ok,
            itemCount: response.ok ? response.data.items.length : 0
        });

        if (!response.ok) {
            log.error('workQueue.list returned not ok', { response });
            // Access status from error object if available, otherwise default to 500
            const errResponse = response as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Failed to fetch work queue from server';
            throw error(status, message);
        }

        return {
            items: response.data.items,
            summary: response.data.summary,
            filters: {
                pillar,
                urgency: urgency || '',
                assignedToMe,
                unassignedOnly
            }
        };
    } catch (err) {
        log.error('Failed to load work queue', { error: err instanceof Error ? err.message : String(err) });
        return {
            items: [],
            summary: null,
            filters: {
                pillar,
                urgency: urgency || '',
                assignedToMe,
                unassignedOnly
            }
        };
    }
};
