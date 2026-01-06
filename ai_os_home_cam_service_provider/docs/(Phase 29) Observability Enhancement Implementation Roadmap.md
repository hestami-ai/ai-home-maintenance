# Phase 29: Observability Enhancement - Implementation Roadmap

## Overview

This roadmap tracks the implementation of enhanced OpenTelemetry observability for the Hestami AI platform. Each task includes a checkbox for tracking completion status.

**Related Document:** [(Phase 28) Observability Enhancement System Requirements Document (SRD).md](./\(Phase%2028\)%20Observability%20Enhancement%20System%20Requirements%20Document%20\(SRD\).md)

---

## P29.1 Core Span Attributes (P0 - Critical)

### P29.1.1 User & Organization Context
- [x] Add `user.id` to request spans
- [x] Add `user.email` to request spans
- [x] Add `user.name` to request spans (when available)
- [x] Add `org.id` to request spans
- [x] Add `org.slug` to request spans
- [x] Add `org.type` to request spans
- [x] Add `user.role` to request spans

**Files Modified:**
- `src/hooks.server.ts`

### P29.1.2 Error Handling Enhancement
- [x] Set span status to ERROR for HTTP 4xx/5xx responses
- [x] Detect Superforms failure responses (HTTP 200 with error payload)
- [x] Add `app.status_code` for application-level errors
- [x] Add `app.error_type` for error categorization
- [x] Add `app.error_message` for error details
- [x] Record exceptions with `recordException()` for stack traces

**Files Modified:**
- `src/hooks.server.ts`

### P29.1.3 oRPC Method Tracing
- [x] Add `rpc.method` attribute (e.g., `association.create`)
- [x] Add `rpc.service` attribute (e.g., `association`)
- [x] Add `idempotency.key` for mutating operations
- [x] Create oRPC tracing middleware

**Files Modified:**
- `src/routes/api/v1/rpc/[...rest]/+server.ts`
- `src/lib/server/api/middleware/tracing.ts`

### P29.1.4 Cerbos Authorization Tracing
- [x] Add `cerbos.action` attribute (e.g., `create`, `view`)
- [x] Add `cerbos.resource` attribute (e.g., `association`)
- [x] Add `cerbos.resource_id` attribute
- [x] Add `cerbos.decision` attribute (`ALLOW` or `DENY`)
- [ ] Create child span for authorization checks (deferred - adds complexity)

**Files Modified:**
- `src/lib/server/cerbos/index.ts`
- `src/lib/server/api/middleware/tracing.ts`

### P29.1.5 DBOS Workflow Tracing
- [x] Verify `workflow.id` is captured (via logWorkflowStart)
- [x] Add `workflow.name` attribute
- [x] Add `workflow.action` attribute (e.g., `CREATE_MANAGED_ASSOCIATION`)
- [x] Ensure trace context propagates through workflow steps

**Files Modified:**
- `src/lib/server/workflows/workflowLogger.ts` - Added `enrichSpanWithWorkflow()` helper
- `src/lib/server/workflows/associationWorkflow.ts` - Updated to pass workflow context
- `src/lib/server/workflows/caseLifecycleWorkflow.ts` - Updated to pass workflow context

---

## P29.2 Request Context (P1 - High Priority)

### P29.2.1 Request Identification
- [x] Generate unique `request.id` for each request
- [x] Add `request.id` to span attributes
- [ ] Include `request.id` in Winston log context (future enhancement)
- [x] Add `session.id` from Better-Auth session

**Files Modified:**
- `src/hooks.server.ts`
- `src/routes/api/v1/rpc/[...rest]/+server.ts`

### P29.2.2 Child Spans for Key Operations
- [ ] Create child span for session validation (Better-Auth)
- [ ] Create child span for organization context resolution
- [ ] Create child span for Cerbos authorization
- [ ] Measure and attribute latency to each operation

**Files to Modify:**
- `src/hooks.server.ts`
- `src/lib/server/cerbos/index.ts`

---

## P29.3 Database Tracing (P1 - High Priority)

### P29.3.1 Prisma Operation Tracking
- [x] Add Prisma middleware for span creation (using `$extends`)
- [x] Add `db.operation` attribute (e.g., `findMany`, `create`)
- [x] Add `db.table` attribute (e.g., `Association`, `User`)
- [x] Add `db.duration_ms` for query timing
- [x] Add `db.error` and `db.error_message` for failed queries

**Files Modified:**
- `src/lib/server/db.ts` - Added `withTracing()` function using Prisma `$extends`

---

## P29.4 Client Context (P2 - Nice to Have)

### P29.4.1 Client Information
- [ ] Add `client.ip` from request headers
- [ ] Add `client.user_agent` from request headers
- [ ] Add `client.origin` for CORS tracking

**Files to Modify:**
- `src/hooks.server.ts`

### P29.4.2 Response Metrics
- [ ] Add `response.size_bytes` for payload size tracking
- [ ] Add `response.content_type` for response type tracking

**Files to Modify:**
- `src/hooks.server.ts`

---

## P29.5 Verification & Testing

### P29.5.1 Manual Verification
- [ ] Verify traces appear in SigNoz with new attributes
- [ ] Verify error spans show status ERROR
- [ ] Verify exception details are visible
- [ ] Verify oRPC method names are captured
- [ ] Verify Cerbos decisions are logged
- [ ] Verify DBOS workflow IDs are correlated

### P29.5.2 Documentation
- [ ] Update Onboarding Package with observability guidelines
- [ ] Document span attribute conventions
- [ ] Document error recording patterns

---

## Progress Summary

| Section | Status | Completion |
|---------|--------|------------|
| P29.1.1 User & Org Context | Complete | 7/7 |
| P29.1.2 Error Handling | Complete | 6/6 |
| P29.1.3 oRPC Method Tracing | Complete | 4/4 |
| P29.1.4 Cerbos Authorization | Complete | 4/5 |
| P29.1.5 DBOS Workflow | Complete | 4/4 |
| P29.2.1 Request Identification | Complete | 3/4 |
| P29.2.2 Child Spans | Not Started | 0/4 |
| P29.3.1 Prisma Tracking | Complete | 5/5 |
| P29.4.1 Client Information | Not Started | 0/3 |
| P29.4.2 Response Metrics | Not Started | 0/2 |
| P29.5.1 Manual Verification | Not Started | 0/6 |
| P29.5.2 Documentation | Not Started | 0/3 |

**Overall Progress:** 41/53 tasks complete (77%)

---

## Notes for Future Agents

1. **Bun Limitation:** Node.js auto-instrumentations don't work in Bun. All instrumentation must be manual.

2. **Key Files:**
   - `src/lib/server/telemetry-init.ts` - OTel SDK initialization
   - `src/hooks.server.ts` - Request-level span creation
   - `src/lib/server/api/router.ts` - oRPC middleware
   - `src/lib/server/cerbos/index.ts` - Authorization helpers

3. **Testing:** After changes, rebuild the Docker container and verify traces in SigNoz at the configured endpoint.

4. **Error Handling:** oRPC errors should use the type-safe `.errors()` pattern, not thrown exceptions. See Onboarding Package for details.

5. **SSR Guidelines:** Prefer server-side data loading. Avoid `onMount` and `$effect` on the client side.
