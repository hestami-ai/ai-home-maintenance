import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('hestami-ai-os-dpq');

/**
 * Counter for document processing start events
 */
export const processingStartedCounter = meter.createCounter('document_processing_started_total', {
    description: 'Total number of document processing workflows started'
});

/**
 * Counter for document processing completion events (success)
 */
export const processingCompletedCounter = meter.createCounter('document_processing_completed_total', {
    description: 'Total number of documents successfully processed'
});

/**
 * Counter for document processing failure events
 */
export const processingFailedCounter = meter.createCounter('document_processing_failed_total', {
    description: 'Total number of documents failed processing'
});

/**
 * Counter for infected document events
 */
export const processingInfectedCounter = meter.createCounter('document_processing_infected_total', {
    description: 'Total number of documents flagged as infected'
});

/**
 * Histogram for document processing duration
 */
export const processingDurationHistogram = meter.createHistogram(
    'document_processing_duration_seconds',
    {
        description: 'Time taken to process a document in seconds',
        unit: 's'
    }
);

/**
 * Gauge for processing queue depth
 * Note: Gauges are best updated via a scheduled observer or job, not event-driven workflows.
 * We will export it here for use in the stats job.
 */
export const processingQueueDepthGauge = meter.createObservableGauge(
    'document_processing_queue_depth',
    {
        description: 'Number of documents currently in PROCESSING status'
    }
);

/**
 * Gauge for retry queue depth
 */
export const retryQueueDepthGauge = meter.createObservableGauge(
    'document_processing_retry_queue_depth',
    {
        description: 'Number of documents in PROCESSING_FAILED status awaiting retry'
    }
);
