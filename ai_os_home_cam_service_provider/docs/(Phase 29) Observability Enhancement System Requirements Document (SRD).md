# Phase 29: Observability Enhancement - System Requirements Document (SRD)

## 1. Overview

This document defines the requirements for enhancing OpenTelemetry observability in the Hestami AI platform after the Bun migration. The goal is to ensure traces, logs, and metrics provide actionable diagnostic information for debugging, performance monitoring, and operational awareness.

## 2. Background

### 2.1 Current State
- OpenTelemetry SDK initialized in `src/lib/server/telemetry-init.ts`
- Basic span attributes captured in `hooks.server.ts` (user.id, org.id, http.*)
- Winston logger with OpenTelemetryTransportV3 for log export
- DBOS workflows provide some trace correlation
- Node.js auto-instrumentations **do not work** in Bun (no module hooks)

### 2.2 Problem Statement
After migrating from Node.js to Bun:
1. Auto-instrumentations for HTTP, PostgreSQL, etc. are non-functional
2. Traces lack sufficient context for debugging (missing RPC method, DB operations, auth decisions)
3. Error attribution is incomplete (Superforms returns HTTP 200 with error payloads)
4. No child spans for key operations (auth, Cerbos, DB queries)

## 3. Requirements

### 3.1 Critical Requirements (P0)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| OBS-001 | Add `rpc.method` and `rpc.service` attributes to oRPC spans | Identify which API endpoint was called |
| OBS-002 | Add `cerbos.action`, `cerbos.resource`, `cerbos.decision` to authorization spans | Track authorization decisions for security auditing |
| OBS-003 | Add `workflow.id` and `workflow.name` to DBOS workflow spans | Correlate workflow executions across services |
| OBS-004 | Add `idempotency.key` to mutating operation spans | Track idempotent request handling |
| OBS-005 | Record exceptions with full stack traces on error spans | Enable root cause analysis |
| OBS-006 | Set span status to ERROR for all failure scenarios | Proper error visibility in SigNoz |

### 3.2 High Priority Requirements (P1)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| OBS-007 | Add `db.operation` and `db.table` for Prisma operations | Track database query patterns |
| OBS-008 | Create child spans for authentication checks | Measure auth latency separately |
| OBS-009 | Create child spans for Cerbos authorization | Measure policy evaluation latency |
| OBS-010 | Add `request.id` for log correlation | Link logs to traces |
| OBS-011 | Add `session.id` for user session tracking | Track user journeys |

### 3.3 Nice to Have Requirements (P2)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| OBS-012 | Add `client.ip` and `client.user_agent` | Security and analytics |
| OBS-013 | Add `response.size_bytes` | Performance monitoring |
| OBS-014 | Create child spans for individual DB queries | Detailed query timing |
| OBS-015 | Add `cache.hit` for caching operations | Cache effectiveness |
| OBS-016 | Add `tenant.plan` for subscription tier tracking | Usage analytics |

## 4. Technical Approach

### 4.1 oRPC Middleware Enhancement
Add a tracing middleware to the oRPC router that:
- Creates/enhances spans with RPC-specific attributes
- Records idempotency keys
- Captures error details with proper status codes

### 4.2 Cerbos Helper Enhancement
Modify `src/lib/server/cerbos/index.ts` to:
- Add span attributes for authorization checks
- Create child spans for policy evaluation
- Record authorization decisions

### 4.3 DBOS Workflow Enhancement
Ensure DBOS workflows:
- Propagate trace context correctly
- Add workflow-specific attributes
- Record step-level spans

### 4.4 Prisma Middleware (Optional)
Consider adding Prisma middleware for:
- Query-level span creation
- Operation type tracking
- Table/model attribution

## 5. Files to Modify

| File | Changes |
|------|---------|
| `src/lib/server/telemetry-init.ts` | Ensure SDK properly initialized |
| `src/hooks.server.ts` | Add request.id, session.id attributes |
| `src/lib/server/api/router.ts` | Add oRPC tracing middleware |
| `src/lib/server/cerbos/index.ts` | Add authorization span attributes |
| `src/lib/server/api/middleware/tracing.ts` | Create/enhance tracing utilities |
| `src/routes/api/v1/rpc/[...rest]/+server.ts` | Ensure oRPC handler records errors |

## 6. Success Criteria

1. All oRPC calls show `rpc.method` and `rpc.service` in SigNoz
2. Authorization failures show `cerbos.decision: DENY` with resource details
3. DBOS workflows show `workflow.id` and `workflow.name`
4. All errors have span status ERROR with exception details
5. Traces can be filtered by user, organization, and RPC method

## 7. Out of Scope

- Bun-native auto-instrumentation (waiting for Bun support)
- Distributed tracing across microservices (single service currently)
- Custom metrics collection (future phase)
- Log aggregation pipeline changes

## 8. Dependencies

- OpenTelemetry SDK packages (already installed)
- SigNoz collector (already configured)
- DBOS SDK (already integrated)

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Performance overhead from additional spans | Use sampling, batch processing |
| Sensitive data in traces | Redact PII, use attribute filtering |
| Bun compatibility issues | Test thoroughly, fallback to manual instrumentation |
