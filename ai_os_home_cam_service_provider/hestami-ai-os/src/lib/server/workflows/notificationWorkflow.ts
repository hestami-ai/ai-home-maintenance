import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { ActivityActionType, NotificationReadStatus as NotificationReadStatusEnum } from '../../../../generated/prisma/enums.js';
import {
    NotificationType,
    NotificationCategory,
    NotificationReadStatus,
    type EntityWorkflowResult
} from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { recordSpanError } from '../api/middleware/tracing.js';

// Workflow error types for tracing
const WorkflowErrorType = {
    NOTIFICATION_WORKFLOW_ERROR: 'NOTIFICATION_WORKFLOW_ERROR'
} as const;

const log = createWorkflowLogger('NotificationWorkflow');

// Action types
export const NotificationAction = {
    SEND_NOTIFICATION: 'SEND_NOTIFICATION'
} as const;

export type NotificationAction = (typeof NotificationAction)[keyof typeof NotificationAction];

export interface NotificationWorkflowInput {
    action: NotificationAction;
    organizationId: string;
    userId: string;
    data: {
        title: string;
        message: string;
        type: NotificationType;
        category: NotificationCategory;
        link?: string;
        metadata?: Prisma.InputJsonValue;
        forceEmail?: boolean; // For critical alerts like INFECTED
    };
}

export interface NotificationWorkflowResult extends EntityWorkflowResult {
    // success, error, entityId inherited
}

// Step 1: Create Notification Record
async function createNotificationRecord(
    organizationId: string,
    userId: string,
    data: NotificationWorkflowInput['data']
): Promise<string> {
    const notification = await orgTransaction(
        organizationId,
        async (tx) => {
            return tx.notification.create({
                data: {
                    organizationId,
                    userId,
                    title: data.title,
                    message: data.message,
                    type: data.type,
                    category: data.category,
                    status: NotificationReadStatusEnum.UNREAD,
                    link: data.link,
                    metadata: data.metadata ?? undefined
                }
            });
        },
        { userId, reason: 'Create notification record' }
    );

    log.info('Created notification', { notificationId: notification.id, userId });
    return notification.id;
}

// Step 2: Check Email Preference (Placeholder for Party/Preference resolution)
async function shouldSendEmail(
    userId: string,
    category: NotificationCategory,
    force: boolean
): Promise<boolean> {
    if (force) return true;

    // TODO: Resolve user -> party -> notification_settings
    // For now, return false (opt-in behavior) as per requirements
    console.log(`[NotificationWorkflow] Email preference check for user ${userId} skipped (default: false)`);
    return false;
}

// Step 3: Send Email (Mock)
async function sendEmailMock(
    organizationId: string,
    userId: string,
    subject: string,
    body: string
) {
    // Look up user email
    const user = await orgTransaction(
        organizationId,
        async (tx) => {
            return tx.user.findUnique({
                where: { id: userId },
                select: { email: true }
            });
        },
        { userId, reason: 'Look up user email for notification' }
    );

    if (user?.email) {
        log.info('Sending email', { email: user.email, subject });
    } else {
        log.warn('Could not send email - user has no email', { userId });
    }
    return true;
}

// Main Workflow
async function notificationWorkflow(input: NotificationWorkflowInput): Promise<NotificationWorkflowResult> {
    const log = createWorkflowLogger('NotificationWorkflow', DBOS.workflowID, input.action);

    try {
        // 1. Create In-App Notification (Always)
        const notificationId = await DBOS.runStep(
            () => createNotificationRecord(input.organizationId, input.userId, input.data),
            { name: 'createNotificationRecord' }
        );

        // 2. Handle Email Notification
        await DBOS.runStep(async () => {
            const shouldSend = await shouldSendEmail(
                input.userId,
                input.data.category,
                input.data.forceEmail ?? false
            );

            if (shouldSend) {
                await sendEmailMock(input.organizationId, input.userId, input.data.title, input.data.message);
            }
        }, { name: 'handleEmailNotification' });

        return { success: true, entityId: notificationId };

    } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        log.error('Workflow failed', { action: input.action, error: errorObj.message });

        await recordSpanError(errorObj, {
            errorCode: ActivityActionType.WORKFLOW_FAILED,
            errorType: WorkflowErrorType.NOTIFICATION_WORKFLOW_ERROR
        });

        return { success: false, error: errorObj.message };
    }
}

export const notificationWorkflow_v1 = DBOS.registerWorkflow(notificationWorkflow);
