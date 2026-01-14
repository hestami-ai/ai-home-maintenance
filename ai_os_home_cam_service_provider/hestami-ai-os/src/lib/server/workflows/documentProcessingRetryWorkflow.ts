/**
 * Document Processing Retry Workflow (v1)
 *
 * DBOS durable workflow for retrying failed document processing.
 * Includes a scheduled workflow that polls for documents due for retry.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import {
    DocumentStatus,
    type EntityWorkflowResult
} from './schemas.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import {
    dispatchProcessing,
    finalizeProcessing,
    updateDocumentProcessingStatus,
    classifyError,
    calculateNextRetryTime,
    getOrgProcessingCount,
    getGlobalProcessingCount
} from './documentWorkflow.js';
import {
    processingStartedCounter,
    processingCompletedCounter,
    processingFailedCounter,
    processingInfectedCounter,
    processingDurationHistogram
} from '../metrics.js';

export const DocumentRetryAction = {
    RETRY_DOCUMENT: 'RETRY_DOCUMENT',
    SCHEDULED_RETRY_POLL: 'SCHEDULED_RETRY_POLL'
} as const;

export type DocumentRetryAction = (typeof DocumentRetryAction)[keyof typeof DocumentRetryAction];

export interface DocumentRetryWorkflowInput {
    documentId: string;
    triggeredBy: string; // User ID or 'SYSTEM'
}

export interface DocumentRetryWorkflowResult extends EntityWorkflowResult {
}

/**
 * Main retry workflow for a single document.
 */
async function retryDocument(input: DocumentRetryWorkflowInput): Promise<DocumentRetryWorkflowResult> {
    const log = createWorkflowLogger('DocumentRetryWorkflow', undefined, DocumentRetryAction.RETRY_DOCUMENT);
    const startTime = logWorkflowStart(log, DocumentRetryAction.RETRY_DOCUMENT, {
        documentId: input.documentId,
        triggeredBy: input.triggeredBy
    });

    try {
        // 1. Get document and verify eligibility
        const doc = await prisma.document.findUnique({
            where: { id: input.documentId }
        });

        if (!doc) {
            throw new Error(`Document ${input.documentId} not found`);
        }

        if (doc.status !== DocumentStatus.PROCESSING_FAILED) {
            throw new Error(`Document ${input.documentId} is not in PROCESSING_FAILED status (current: ${doc.status})`);
        }

        const maxAttempts = parseInt(process.env.DPQ_MAX_RETRY_ATTEMPTS || '3', 10);
        if (doc.processingAttemptCount >= maxAttempts && input.triggeredBy === 'SYSTEM') {
            log.info('Max retry attempts reached, skipping automatic retry', { documentId: input.documentId, attempts: doc.processingAttemptCount });
            return { success: true, entityId: input.documentId };
        }

        const s3ObjectKey = doc.storagePath?.split('+')[0] || doc.storagePath;

        // 2. Check Rate Limits BEFORE marking as processing (to avoid incrementing attempt count)
        const orgLimit = parseInt(process.env.DPQ_MAX_CONCURRENT_PER_ORG || '5', 10);
        const globalLimit = parseInt(process.env.DPQ_GLOBAL_MAX_CONCURRENT || '20', 10);

        const [orgCount, globalCount] = await Promise.all([
            DBOS.runStep(() => getOrgProcessingCount(doc.organizationId), { name: 'getOrgCount' }),
            DBOS.runStep(() => getGlobalProcessingCount(), { name: 'getGlobalCount' })
        ]);

        if (orgCount >= orgLimit || globalCount >= globalLimit) {
            const limitType = orgCount >= orgLimit ? 'ORGANIZATION' : 'GLOBAL';
            log.info(`Concurrency limit reached during retry (${limitType})`, { orgCount, globalCount, orgLimit, globalLimit });

            // Schedule another retry (without incrementing attempt count)
            const nextRetryAt = new Date(Date.now() + 60 * 1000); // Retry in 1 minute
            await DBOS.runStep(
                () => updateDocumentProcessingStatus(input.documentId, DocumentStatus.PROCESSING_FAILED, {
                    type: 'TRANSIENT',
                    message: `Concurrency limit reached during retry (${limitType})`,
                    details: { code: 'CONCURRENCY_LIMIT_REACHED', limitType },
                    nextRetryAt
                }),
                { name: 'markLimitReached' }
            );

            await DBOS.runStep(
                () => recordWorkflowEvent({
                    organizationId: doc.organizationId,
                    entityType: 'DOCUMENT',
                    entityId: input.documentId,
                    action: 'STATUS_CHANGE',
                    eventCategory: 'SYSTEM',
                    summary: `Retry delayed: ${limitType} concurrency limit reached`,
                    workflowId: 'DocumentRetryWorkflow',
                    workflowStep: 'markLimitReached',
                    previousState: { status: doc.status },
                    newState: { status: DocumentStatus.PROCESSING_FAILED },
                    metadata: { limitType, nextRetryAt }
                }),
                { name: 'recordLimitReached' }
            );

            return { success: true, entityId: input.documentId };
        }

        // 3. Mark as Processing (this splits the attempt count increment logic into the security definer)
        // Note: update_document_processing_status increments attempt count when status is PROCESSING
        await DBOS.runStep(
            () => updateDocumentProcessingStatus(input.documentId, DocumentStatus.PROCESSING),
            { name: 'markProcessing' }
        );

        await DBOS.runStep(
            () => recordWorkflowEvent({
                organizationId: doc.organizationId,
                entityType: 'DOCUMENT',
                entityId: input.documentId,
                action: 'DISPATCH',
                eventCategory: 'SYSTEM',
                summary: `Document processing retry ${doc.processingAttemptCount + 1} started by ${input.triggeredBy}`,
                workflowId: 'DocumentRetryWorkflow',
                workflowStep: 'markProcessing',
                previousState: { status: doc.status, attempts: doc.processingAttemptCount },
                newState: { status: DocumentStatus.PROCESSING, attempts: doc.processingAttemptCount + 1 }
            }),
            { name: 'recordRetryStarted' }
        );

        // Metric: Processing Started
        processingStartedCounter.add(1, { organizationId: doc.organizationId, type: 'RETRY' });
        const processingStartTime = Date.now();

        try {
            // 3. Dispatch to worker
            log.info('Dispatching to worker for retry', { documentId: input.documentId, s3ObjectKey });
            const workerResult = await DBOS.runStep(
                () => dispatchProcessing(input.documentId, s3ObjectKey),
                { name: 'dispatchProcessing' }
            );

            // 4. Finalize
            log.info('Finalizing retry processing', { documentId: input.documentId, status: workerResult.status });
            const isClean = workerResult.status === 'clean' || workerResult.malwareScan?.status === 'clean';

            await DBOS.runStep(
                () => finalizeProcessing(input.documentId, {
                    status: workerResult.status,
                    storagePath: s3ObjectKey,
                    fileUrl: doc.fileUrl,
                    fileName: workerResult.fileName || doc.fileName,
                    fileSize: workerResult.fileSize || doc.fileSize,
                    mimeType: workerResult.mimeType || doc.mimeType,
                    checksum: workerResult.checksum || doc.checksum,
                    workerResult: workerResult
                }, s3ObjectKey),
                { name: 'finalizeProcessing' }
            );

            // 5. Record Success or Infection
            const finalStatus = isClean ? DocumentStatus.ACTIVE : DocumentStatus.INFECTED;
            await DBOS.runStep(
                () => recordWorkflowEvent({
                    organizationId: doc.organizationId,
                    entityType: 'DOCUMENT',
                    entityId: input.documentId,
                    action: isClean ? 'COMPLETE' : 'STATUS_CHANGE',
                    eventCategory: 'SYSTEM',
                    summary: isClean
                        ? `Document processing retry completed successfully`
                        : `Malware detected in document during retry`,
                    workflowId: 'DocumentRetryWorkflow',
                    workflowStep: 'finalizeProcessing',
                    previousState: { status: DocumentStatus.PROCESSING },
                    newState: { status: finalStatus }
                }),
                { name: 'recordCompletion' }
            );

            // Metrics: Completion, Infection, Duration
            const duration = (Date.now() - processingStartTime) / 1000;
            processingDurationHistogram.record(duration, { organizationId: doc.organizationId, status: isClean ? 'SUCCESS' : 'INFECTED', type: 'RETRY' });

            if (isClean) {
                processingCompletedCounter.add(1, { organizationId: doc.organizationId, type: 'RETRY' });
            } else {
                processingInfectedCounter.add(1, { organizationId: doc.organizationId, type: 'RETRY' });
            }

        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            const classification = classifyError(errorObj);

            log.error(`Retry processing failed: ${errorObj.message}`, {
                type: classification.type,
                code: classification.code
            });

            // Calculate next retry time if transient
            let nextRetryAt: Date | undefined;
            if (classification.type === 'TRANSIENT') {
                // We need the updated attempt count to calculate the next backoff
                const updatedDoc = await prisma.document.findUnique({ where: { id: input.documentId } });
                nextRetryAt = calculateNextRetryTime(updatedDoc?.processingAttemptCount || 1);
            }

            await DBOS.runStep(
                () => updateDocumentProcessingStatus(input.documentId, DocumentStatus.PROCESSING_FAILED, {
                    type: classification.type,
                    message: errorObj.message,
                    details: { code: classification.code },
                    nextRetryAt
                }),
                { name: 'markProcessingFailed' }
            );

            await DBOS.runStep(
                () => recordWorkflowEvent({
                    organizationId: doc.organizationId,
                    entityType: 'DOCUMENT',
                    entityId: input.documentId,
                    action: 'WORKFLOW_FAILED',
                    eventCategory: 'SYSTEM',
                    summary: `Document processing retry failed: ${errorObj.message}`,
                    workflowId: 'DocumentRetryWorkflow',
                    workflowStep: 'markProcessingFailed',
                    previousState: { status: DocumentStatus.PROCESSING },
                    newState: { status: DocumentStatus.PROCESSING_FAILED },
                    metadata: {
                        error: {
                            type: classification.type,
                            code: classification.code,
                            message: errorObj.message
                        },
                        nextRetryAt
                    }
                }),
                { name: 'recordFailure' }
            );

            // Metric: Processing Failed
            processingFailedCounter.add(1, { organizationId: doc.organizationId, errorType: classification.type, type: 'RETRY' });

            throw error;
        }

        logWorkflowEnd(log, DocumentRetryAction.RETRY_DOCUMENT, true, startTime, { entityId: input.documentId });
        return { success: true, entityId: input.documentId };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStepError(log, DocumentRetryAction.RETRY_DOCUMENT, error instanceof Error ? error : new Error(errorMessage), {
            documentId: input.documentId
        });
        logWorkflowEnd(log, DocumentRetryAction.RETRY_DOCUMENT, false, startTime, { error: errorMessage });

        await recordSpanError(error instanceof Error ? error : new Error(errorMessage), {
            errorCode: 'WORKFLOW_FAILED',
            errorType: 'DOCUMENT_RETRY_WORKFLOW_ERROR'
        });

        return { success: false, error: errorMessage };
    }
}

/**
 * Scheduled workflow that polls for documents due for retry.
 */
async function scheduledRetryPoll(scheduledTime: Date, actualTime: Date): Promise<void> {
    const log = createWorkflowLogger('DocumentRetryWorkflow', undefined, DocumentRetryAction.SCHEDULED_RETRY_POLL);
    log.debug('Scheduled retry poll triggered', { scheduledTime, actualTime });

    try {
        const maxAttempts = parseInt(process.env.DPQ_MAX_RETRY_ATTEMPTS || '3', 10);

        // Find documents due for retry
        // status = PROCESSING_FAILED
        // error_type = TRANSIENT
        // attempt_count < maxAttempts
        // next_retry_at <= now
        const dueDocuments = await DBOS.runStep(
            () => prisma.document.findMany({
                where: {
                    status: DocumentStatus.PROCESSING_FAILED,
                    processingErrorType: 'TRANSIENT',
                    processingAttemptCount: { lt: maxAttempts },
                    processingNextRetryAt: { lte: new Date() }
                },
                take: 10, // Batch limit
                select: { id: true, organizationId: true }
            }),
            { name: 'findDueDocuments' }
        );

        if (dueDocuments.length === 0) {
            return;
        }

        log.info(`Found ${dueDocuments.length} documents due for retry`);

        // Start a retry workflow for each document
        for (const doc of dueDocuments) {
            // Trigger a new workflow for each document to maintain isolation and durability
            // Use a stable, idempotent workflow ID
            const idempotencyKey = `retry-${doc.id}-${Date.now()}`;

            await DBOS.startWorkflow(documentProcessingRetryWorkflow_v1, { workflowID: idempotencyKey })({
                documentId: doc.id,
                triggeredBy: 'SYSTEM'
            }, { workflowID: idempotencyKey });

            await DBOS.runStep(
                () => recordWorkflowEvent({
                    organizationId: doc.organizationId,
                    entityType: 'DOCUMENT',
                    entityId: doc.id,
                    action: 'SCHEDULE',
                    eventCategory: 'SYSTEM',
                    summary: `Automatic retry scheduled by polling job`,
                    workflowId: 'DocumentRetryWorkflow',
                    workflowStep: 'scheduledRetryPoll',
                    newState: { status: DocumentStatus.PROCESSING_FAILED }
                }),
                { name: `recordRetryScheduled-${doc.id}` }
            );
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`Scheduled retry poll failed: ${errorMessage}`);

        await recordSpanError(error instanceof Error ? error : new Error(errorMessage), {
            errorCode: 'WORKFLOW_FAILED',
            errorType: 'DOCUMENT_RETRY_POLL_ERROR'
        });
    }
}

export const documentProcessingRetryWorkflow_v1 = DBOS.registerWorkflow(retryDocument);

// Register the poll function as a workflow first, then schedule it
const scheduledRetryPollWorkflow = DBOS.registerWorkflow(scheduledRetryPoll);
DBOS.registerScheduled(scheduledRetryPollWorkflow, { crontab: '*/1 * * * *', name: 'scheduledRetryPoll' });
