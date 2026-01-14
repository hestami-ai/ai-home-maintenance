# Phase 34: Durable Queues & Scheduled Workflows - Implementation Roadmap

**Source Document**: `(Phase 34) Durable Queues SRD.md`  
**Status**: Not Started  
**Last Updated**: 2026-01-13

---

## Overview

Implement durable queues and scheduled workflows for container-native DBOS architecture. This enables all replicas to participate in background work execution with exactly-once scheduled task semantics.

---

## Phase 1: Foundation & DBOS Queue Infrastructure

### 1.1 DBOS Queue Configuration
- [ ] Research DBOS durable queue API and configuration options
- [ ] Define queue configuration schema (concurrency limits, retry policies)
- [ ] Create `src/lib/server/queues/` directory structure
- [ ] Implement base queue configuration module (`queueConfig.ts`)
- [ ] Define standard queues:
  - [ ] `background-processing` - general background tasks
  - [ ] `reports` - report generation tasks
  - [ ] `cleanup` - maintenance/cleanup tasks
  - [ ] `notifications` - notification delivery

### 1.2 Queue Registration & Initialization
- [ ] Create queue registration module (`queueRegistry.ts`)
- [ ] Implement queue initialization on DBOS startup
- [ ] Add queue health check endpoints
- [ ] Verify queues are shared across replicas (multi-container test)

---

## Phase 2: Scheduled Workflow Infrastructure

### 2.1 Scheduler Configuration
- [ ] Research DBOS scheduled workflow API
- [ ] Define schedule configuration schema (cron expressions, timezone handling)
- [ ] Create `src/lib/server/schedules/` directory structure
- [ ] Implement schedule registration module (`scheduleRegistry.ts`)

### 2.2 Exactly-Once Execution Guarantee
- [ ] Implement schedule coordination mechanism
- [ ] Add schedule lock/claim pattern for multi-replica safety
- [ ] Create schedule execution logging
- [ ] Test exactly-once semantics with 3+ replicas

---

## Phase 3: Core Queue Operations

### 3.1 Enqueue Operations
- [ ] Implement `enqueueTask()` helper function
- [ ] Add task metadata schema (priority, retry config, correlation ID)
- [ ] Implement batch enqueue for fan-out patterns
- [ ] Add idempotency key support for task deduplication

### 3.2 Task Processing
- [ ] Implement task handler registration pattern
- [ ] Add task execution wrapper with error handling
- [ ] Implement retry logic with exponential backoff
- [ ] Add dead-letter queue handling for failed tasks

### 3.3 Concurrency Control
- [ ] Implement per-queue concurrency limits
- [ ] Add global concurrency limit option
- [ ] Create concurrency monitoring utilities
- [ ] Test concurrency enforcement across replicas

---

## Phase 4: Observability & Monitoring

### 4.1 Queue Metrics
- [ ] Add queue depth metrics (OpenTelemetry)
- [ ] Add task processing latency metrics
- [ ] Add task success/failure rate metrics
- [ ] Create queue health dashboard queries

### 4.2 Task Tracing
- [ ] Integrate task execution with OpenTelemetry spans
- [ ] Add correlation ID propagation
- [ ] Implement task execution logging with `workflowLogger.ts` pattern
- [ ] Add executor identification to traces

### 4.3 Schedule Observability
- [ ] Add scheduled execution start/completion events
- [ ] Create schedule execution history tracking
- [ ] Add missed schedule detection and alerting
- [ ] Implement schedule status API endpoint

---

## Phase 5: Fan-Out Pattern Implementation

### 5.1 Fan-Out Utilities
- [ ] Create `fanOutToQueue()` helper function
- [ ] Implement work unit enumeration patterns
- [ ] Add batch size configuration for queue writes
- [ ] Implement progress tracking for fan-out operations

### 5.2 Idempotent Fan-Out
- [ ] Add idempotency checks for enumeration
- [ ] Implement deduplication for re-enqueued tasks
- [ ] Create fan-out state tracking
- [ ] Test fan-out recovery after partial failure

---

## Phase 6: Example Implementations

### 6.1 Monthly Reports Scheduled Workflow
- [ ] Create `monthlyReportsSchedule.ts`
- [ ] Implement tenant enumeration step
- [ ] Implement report task enqueue step
- [ ] Create report generation task handler
- [ ] Add report completion aggregation
- [ ] Test with multiple tenants and replicas

### 6.2 SeaweedFS Cleanup Scheduled Workflow
- [ ] Create `seaweedfsCleanupSchedule.ts`
- [ ] Implement bucket/prefix enumeration
- [ ] Implement cleanup task enqueue step
- [ ] Create cleanup task handler with safe delete logic
- [ ] Add cleanup completion logging
- [ ] Test partial failure recovery

---

## Phase 7: Testing & Validation

### 7.1 Unit Tests
- [ ] Queue configuration tests
- [ ] Task enqueue/dequeue tests
- [ ] Concurrency limit tests
- [ ] Retry logic tests

### 7.2 Integration Tests
- [ ] Multi-replica queue distribution test
- [ ] Scheduled workflow exactly-once test
- [ ] Fan-out pattern test
- [ ] Crash recovery test

### 7.3 Load Testing
- [ ] Queue throughput benchmarks
- [ ] Concurrency limit validation under load
- [ ] Postgres connection pool impact assessment
- [ ] Memory usage under high queue depth

---

## Phase 8: Documentation & Operational Readiness

### 8.1 Developer Documentation
- [ ] Queue usage guide
- [ ] Scheduled workflow creation guide
- [ ] Fan-out pattern examples
- [ ] Troubleshooting guide

### 8.2 Operational Runbooks
- [ ] Queue monitoring procedures
- [ ] Stuck task recovery procedures
- [ ] Schedule failure recovery procedures
- [ ] Replica scaling procedures

### 8.3 Configuration Management
- [ ] Environment-specific queue configurations
- [ ] Schedule definitions as code
- [ ] Concurrency tuning guidelines

---

## Verification Checklist

Before marking complete, verify:

- [ ] All replicas can enqueue and dequeue tasks
- [ ] Scheduled tasks run exactly once per interval with 3 replicas
- [ ] Concurrency limits are enforced across replicas
- [ ] Task failures retry correctly
- [ ] Crash recovery works (kill replica mid-task)
- [ ] Queue depth is observable in metrics
- [ ] Task execution appears in traces
- [ ] `bun run check` passes
- [ ] No cross-tenant data leakage in queued tasks

---

## Dependencies

- DBOS durable queue feature (verify availability)
- DBOS scheduled workflow feature (verify availability)
- OpenTelemetry integration (existing)
- Postgres connection pool capacity

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| DBOS queue API differs from expectations | Research API early in Phase 1 |
| Postgres overload from queue polling | Tune concurrency limits, monitor connections |
| Explosive queue growth from fan-out | Implement batch size limits, add queue depth alerts |
| Scheduled task drift across timezones | Use UTC internally, document timezone handling |

---

## Notes

- Follow DBOS workflow patterns from onboarding doc
- Use `workflowLogger.ts` helpers for all queue/schedule logging
- All tasks must be idempotent
- Record activity events for audit trail where applicable
