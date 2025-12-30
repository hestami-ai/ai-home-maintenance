import type { PageServerLoad } from './$types';
import { orpc } from '$lib/api';

export const load: PageServerLoad = async ({ parent }) => {
    const { organization } = await parent();

    if (!organization) {
        return {
            notifications: []
        };
    }

    try {
        // Mock notification generation moved to server side for consistency
        // In production, this would fetch from a dedicated notifications API
        const casesResult = await orpc.conciergeCase.list({ limit: 10 });

        const getStatusNotificationTitle = (status: string): string => {
            const titles: Record<string, string> = {
                INTAKE: 'Service Call Submitted',
                TRIAGE: 'Service Call Under Review',
                QUOTE_REQUESTED: 'Quotes Requested',
                QUOTE_RECEIVED: 'Quote Received',
                QUOTE_APPROVED: 'Quote Approved',
                SCHEDULED: 'Service Scheduled',
                IN_PROGRESS: 'Work In Progress',
                COMPLETED: 'Service Completed',
                CLOSED: 'Service Call Closed'
            };
            return titles[status] || 'Service Call Update';
        };

        const getStatusMessage = (status: string): string => {
            const messages: Record<string, string> = {
                INTAKE: 'Your service call has been received and is being reviewed.',
                TRIAGE: 'Our team is reviewing your request.',
                QUOTE_REQUESTED: 'We are gathering quotes from service providers.',
                QUOTE_RECEIVED: 'A quote is ready for your review.',
                QUOTE_APPROVED: 'The quote has been approved. Work will be scheduled.',
                SCHEDULED: 'Your service has been scheduled.',
                IN_PROGRESS: 'Work is currently in progress.',
                COMPLETED: 'The work has been completed.',
                CLOSED: 'This service call has been closed.'
            };
            return messages[status] || 'Status has been updated.';
        };

        const notifications = casesResult.data.cases.map((c) => ({
            id: `case-${c.id}`,
            type: 'service_call' as const,
            title: getStatusNotificationTitle(c.status),
            message: `${c.title} - ${getStatusMessage(c.status)}`,
            isRead: false,
            createdAt: c.createdAt,
            linkUrl: `/app/concierge/service-calls/${c.id}`,
            entityId: c.id
        })).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return {
            notifications
        };
    } catch (err) {
        console.error('Failed to load concierge notifications:', err);
        return {
            notifications: []
        };
    }
};
