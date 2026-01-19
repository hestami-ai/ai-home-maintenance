/**
 * Document Cleanup Workflow (v1)
 *
 * DBOS durable workflow for periodic cleanup tasks.
 * Handles: Deletion of quarantined (infected) files past retention period.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import { DocumentStatus } from './schemas.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ActivityActionType } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
    CLEANUP_WORKFLOW_ERROR: 'CLEANUP_WORKFLOW_ERROR'
} as const;

const s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || 'https://dev-s3.hestami-ai.com',
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin'
    }
});

export const CleanupAction = {
    CLEANUP_INFECTED: 'CLEANUP_INFECTED',
    DELETE_FILE_S3: 'DELETE_FILE_S3'
} as const;

export type CleanupAction = (typeof CleanupAction)[keyof typeof CleanupAction];

/**
 * Helper to delete a file from S3
 */
async function deleteFileFromS3(storagePath: string): Promise<void> {
    const bucket = process.env.S3_BUCKET || 'uploads';
    try {
        await s3.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: storagePath
        }));
    } catch (error) {
        console.error(`Failed to delete file from S3: ${storagePath}`, error);
        throw error;
    }
}

/**
 * Cleanup Infected Files Workflow
 * Finds infected files older than retention period and deletes them.
 */
async function cleanupInfectedFiles(scheduledTime: Date, actualTime: Date): Promise<void> {
    const log = createWorkflowLogger('DocumentCleanupWorkflow', undefined, CleanupAction.CLEANUP_INFECTED);
    const retentionDays = parseInt(process.env.DPQ_INFECTED_RETENTION_DAYS || '30', 10);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    log.info('Starting infected file cleanup', { cutoffDate: cutoffDate.toISOString() });

    try {
        // 1. Find lapsed infected documents
        // We use UpdatedAt as proxy for "when it was marked infected" roughly, 
        // though ideally we'd track `infectedAt`.
        const documents = await DBOS.runStep(
            () => prisma.document.findMany({
                where: {
                    status: DocumentStatus.INFECTED,
                    updatedAt: { lt: cutoffDate }
                },
                take: 50 // Limit batch size
            }),
            { name: 'findLapsedInfected' }
        );

        if (documents.length === 0) {
            log.info('No infected files to clean up');
            return;
        }

        log.info(`Found ${documents.length} infected files to delete`);

        for (const doc of documents) {
            try {
                const s3Key = doc.storagePath?.split('+')[0] || doc.storagePath;

                // 2. Delete S3 Object
                if (s3Key) {
                    await DBOS.runStep(
                        () => deleteFileFromS3(s3Key),
                        { name: `deleteS3-${doc.id}` }
                    );
                }

                // 3. Mark as Deleted (or Hard Delete)
                // Requirement says "Delete Permanently: Hard delete from S3 and database"
                // WE WILL USE HARD DELETE for the document record as per requirement implications on "Cleanup"
                // Note: For scheduled cleanup workflows without user context, we use 'system' as userId
                await DBOS.runStep(
                    () => orgTransaction(doc.organizationId, async (tx) => {
                        await tx.document.delete({
                            where: { id: doc.id }
                        });
                    }, { userId: 'system', reason: 'Cleanup infected document past retention period' }),
                    { name: `deleteDb-${doc.id}` }
                );

                // 4. Record Activity (Not possible since doc is deleted? 
                // Actually we can record system event but there's no entity to link to.
                // We'll log it.)
                log.info(`Deleted infected document ${doc.id}`);

            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                log.error(`Failed to clean up document ${doc.id}: ${msg}`);
                // Continue to next document
            }
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`Cleanup workflow failed: ${errorMessage}`);
        await recordSpanError(error instanceof Error ? error : new Error(errorMessage), {
            errorCode: ActivityActionType.WORKFLOW_FAILED,
            errorType: WorkflowErrorType.CLEANUP_WORKFLOW_ERROR
        });
    }
}

// Register scheduled workflow to run daily
DBOS.registerScheduled(cleanupInfectedFiles, { crontab: '0 3 * * *', name: 'cleanupInfectedFiles' });
