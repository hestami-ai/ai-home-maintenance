# Document Processing Queue - Alerts

This document defines the alert configuration requirements for the Document Processing Queue (DPQ).

## Alert Configurations

These alerts should be configured in the observability platform (e.g., SigNoz, Prometheus/AlertManager).

### 1. Critical: Failed Documents Requiring Attention
**Description**: Triggers when there are documents that have failed processing and exhausted all retry attempts, or encountered permanent errors.
- **Metric**: `document_processing_failed_total` (filtering for final failures if possible, or using queue depth gauge)
- **Signal**: `document_processing_queue_depth{status="failed_needs_attention"}` > 0
- **Threshold**: > 10 documents
- **Severity**: Critical
- **Action**: Email to Operations Team
- **Runbook**: Check `src/routes/app/admin/document-processing` "Needs Attention" tab.

### 2. Critical: Low Success Rate
**Description**: Triggers when the processing success rate drops below acceptable levels.
- **Metric**: `rate(document_processing_completed_total)` / `rate(document_processing_started_total)`
- **Window**: 1 hour
- **Threshold**: < 80%
- **Severity**: Critical
- **Action**: Email to Engineering Team

### 3. Critical: Worker Unavailability
**Description**: Triggers when the worker service is returning 5xx errors consistently.
- **Metric**: `document_processing_failed_total{error_type="TRANSIENT", code="WORKER_ERROR"}`
- **Window**: 5 minutes
- **Threshold**: Rate increase > 10%
- **Severity**: Critical
- **Action**: PagerDuty to On-Call

### 4. Warning: Infected Documents Spikes
**Description**: Triggers when there is an unusual spike in malware detections.
- **Metric**: `document_processing_infected_total`
- **Window**: 24 hours
- **Threshold**: > 5 documents
- **Severity**: Warning
- **Action**: Email to Security Team

## Dashboards
A DPQ Dashboard should be created including:
- Processing Throughput (Started vs Completed)
- Failure Rate by Type
- Average Processing Duration (p50, p95, p99)
- Queue Depth Trends
