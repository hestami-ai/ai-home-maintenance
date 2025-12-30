# Span Error Recording Migration Guide

## Overview

This document provides instructions for migrating all DBOS workflows to include proper OpenTelemetry span error recording. This ensures that errors are visible in traces (SigNoz) with detailed error information, not just in logs.

## Problem Statement

Currently, when errors occur in DBOS workflows:
- Errors are logged via `workflowLogger`
- Errors are recorded via `DBOS.setEvent()` for workflow status
- **BUT** errors are NOT recorded on the active OpenTelemetry span

This means traces in SigNoz show:
- `status code string: Unset` (instead of `ERROR`)
- No `exception.message`, `exception.type`, or `exception.stacktrace`
- No custom error attributes for filtering (`error.code`, `error.type`)

## Solution

Add `recordSpanError()` calls in all workflow catch blocks to record errors on the active span.

## Files to Modify

### Workflow Files (67 files in `src/lib/server/workflows/`)

Each workflow file needs to be updated to:
1. Import `recordSpanError` from the tracing middleware
2. Call `recordSpanError()` in catch blocks

**Complete list of workflow files:**
```
src/lib/server/workflows/appealWorkflow.ts
src/lib/server/workflows/arcRequestWorkflow.ts
src/lib/server/workflows/arcReviewLifecycle.ts
src/lib/server/workflows/arcReviewWorkflow.ts
src/lib/server/workflows/assessmentPosting.ts
src/lib/server/workflows/billingWorkflow.ts
src/lib/server/workflows/caseLifecycleWorkflow.ts
src/lib/server/workflows/checklistWorkflow.ts
src/lib/server/workflows/communicationWorkflow.ts
src/lib/server/workflows/complianceWorkflow.ts
src/lib/server/workflows/conciergeActionWorkflow.ts
src/lib/server/workflows/contractSLAWorkflow.ts
src/lib/server/workflows/contractWorkflow.ts
src/lib/server/workflows/contractorBranchWorkflow.ts
src/lib/server/workflows/contractorComplianceWorkflow.ts
src/lib/server/workflows/contractorProfileWorkflow.ts
src/lib/server/workflows/crudWorkflow.ts
src/lib/server/workflows/customerWorkflow.ts
src/lib/server/workflows/dashboardWorkflow.ts
src/lib/server/workflows/dispatchAssignment.ts
src/lib/server/workflows/dispatchWorkflow.ts
src/lib/server/workflows/documentWorkflow.ts
src/lib/server/workflows/estimateCreateWorkflow.ts
src/lib/server/workflows/estimateGeneration.ts
src/lib/server/workflows/estimateWorkflow.ts
src/lib/server/workflows/externalApprovalWorkflow.ts
src/lib/server/workflows/governanceWorkflow.ts
src/lib/server/workflows/inventoryItemWorkflow.ts
src/lib/server/workflows/inventoryLocationWorkflow.ts
src/lib/server/workflows/inventoryWorkflow.ts
src/lib/server/workflows/invoiceCreateWorkflow.ts
src/lib/server/workflows/invoicePayment.ts
src/lib/server/workflows/jobCreateWorkflow.ts
src/lib/server/workflows/jobLifecycle.ts
src/lib/server/workflows/jobWorkflow.ts
src/lib/server/workflows/maintenanceContract.ts
src/lib/server/workflows/mediaWorkflow.ts
src/lib/server/workflows/meetingLifecycle.ts
src/lib/server/workflows/motionLifecycle.ts
src/lib/server/workflows/noticeTemplateWorkflow.ts
src/lib/server/workflows/offlineSyncWorkflow.ts
src/lib/server/workflows/ownerPortalWorkflow.ts
src/lib/server/workflows/pricebookWorkflow.ts
src/lib/server/workflows/purchaseOrderWorkflow.ts
src/lib/server/workflows/reportDefinitionWorkflow.ts
src/lib/server/workflows/reportExecutionWorkflow.ts
src/lib/server/workflows/reportScheduleWorkflow.ts
src/lib/server/workflows/reserveWorkflow.ts
src/lib/server/workflows/resolutionCloseout.ts
src/lib/server/workflows/resolutionCloseoutWorkflow.ts
src/lib/server/workflows/serviceCatalogWorkflow.ts
src/lib/server/workflows/staffWorkflow.ts
src/lib/server/workflows/technicianWorkflow.ts
src/lib/server/workflows/timeEntryWorkflow.ts
src/lib/server/workflows/vendorBidWorkflow.ts
src/lib/server/workflows/vendorCandidateWorkflow.ts
src/lib/server/workflows/violationLifecycle.ts
src/lib/server/workflows/violationWorkflow.ts
src/lib/server/workflows/visitWorkflow.ts
src/lib/server/workflows/workOrderLineItemWorkflow.ts
src/lib/server/workflows/workOrderWorkflow.ts
```

## Migration Pattern

### Step 1: Add Import

At the top of each workflow file, add the import for `recordSpanError`:

```typescript
// BEFORE
import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';

// AFTER
import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
```

### Step 2: Update Catch Blocks

Find all `catch (error)` blocks in the workflow and add `recordSpanError()` call:

```typescript
// BEFORE
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    log.error('Workflow failed', {
        action: input.action,
        error: errorMessage,
        stack: errorStack
    });
    
    await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });
    const errorResult = {
        success: false,
        action: input.action,
        timestamp: new Date().toISOString(),
        error: errorMessage
    };
    logWorkflowEnd(log, input.action, false, startTime, errorResult);
    return errorResult;
}

// AFTER
} catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorMessage = errorObj.message;
    
    log.error('Workflow failed', {
        action: input.action,
        error: errorMessage,
        stack: errorObj.stack
    });
    
    await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });
    
    // Record error on span for trace visibility
    await recordSpanError(errorObj, {
        errorCode: 'WORKFLOW_FAILED',
        errorType: `${WORKFLOW_NAME}_ERROR`  // e.g., 'CASE_LIFECYCLE_ERROR'
    });
    
    const errorResult = {
        success: false,
        action: input.action,
        timestamp: new Date().toISOString(),
        error: errorMessage
    };
    logWorkflowEnd(log, input.action, false, startTime, errorResult);
    return errorResult;
}
```

### Key Changes:
1. Convert `error` to `Error` object at the start: `const errorObj = error instanceof Error ? error : new Error(String(error));`
2. Use `errorObj.message` and `errorObj.stack` consistently
3. Add `await recordSpanError(errorObj, { ... })` after `DBOS.setEvent()`
4. Set `errorType` to a workflow-specific identifier (e.g., `CASE_LIFECYCLE_ERROR`, `JOB_WORKFLOW_ERROR`)

## Reference Implementation

The `recordSpanError` function is defined in `src/lib/server/api/middleware/tracing.ts`:

```typescript
/**
 * Record an error on the current active span
 * This sets the span status to ERROR and records the exception details
 */
export async function recordSpanError(
    error: Error,
    attributes?: {
        errorCode?: string;
        httpStatus?: number;
        errorType?: string;
    }
): Promise<void> {
    const trace = await getTraceApi();
    if (!trace) return;

    const span = trace.getActiveSpan();
    if (!span) return;

    // Record the exception (adds exception.type, exception.message, exception.stacktrace)
    span.recordException(error);

    // Set span status to ERROR with the error message
    span.setStatus({ code: 2, message: error.message }); // SpanStatusCode.ERROR = 2

    // Add custom error attributes for better filtering in SigNoz
    if (attributes?.errorCode) {
        span.setAttribute('error.code', attributes.errorCode);
    }
    if (attributes?.httpStatus) {
        span.setAttribute('http.status_code', attributes.httpStatus);
    }
    if (attributes?.errorType) {
        span.setAttribute('error.type', attributes.errorType);
    }
}
```

## Example: caseLifecycleWorkflow.ts

### Current Code (lines 733-754):
```typescript
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    log.error('Workflow failed', {
        action: input.action,
        caseId: input.caseId,
        intentId: input.intentId,
        error: errorMessage,
        stack: errorStack
    });
    
    await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });
    const errorResult = {
        success: false,
        action: input.action,
        timestamp: new Date().toISOString(),
        error: errorMessage
    };
    logWorkflowEnd(log, input.action, false, startTime, errorResult);
    return errorResult;
}
```

### Updated Code:
```typescript
} catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorMessage = errorObj.message;
    
    log.error('Workflow failed', {
        action: input.action,
        caseId: input.caseId,
        intentId: input.intentId,
        error: errorMessage,
        stack: errorObj.stack
    });
    
    await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });
    
    // Record error on span for trace visibility
    await recordSpanError(errorObj, {
        errorCode: 'WORKFLOW_FAILED',
        errorType: 'CASE_LIFECYCLE_ERROR'
    });
    
    const errorResult = {
        success: false,
        action: input.action,
        timestamp: new Date().toISOString(),
        error: errorMessage
    };
    logWorkflowEnd(log, input.action, false, startTime, errorResult);
    return errorResult;
}
```

## Workflow-Specific Error Types

Use these error type identifiers for each workflow:

| Workflow File | Error Type |
|---------------|------------|
| appealWorkflow.ts | `APPEAL_WORKFLOW_ERROR` |
| arcRequestWorkflow.ts | `ARC_REQUEST_WORKFLOW_ERROR` |
| arcReviewLifecycle.ts | `ARC_REVIEW_LIFECYCLE_ERROR` |
| arcReviewWorkflow.ts | `ARC_REVIEW_WORKFLOW_ERROR` |
| assessmentPosting.ts | `ASSESSMENT_POSTING_ERROR` |
| billingWorkflow.ts | `BILLING_WORKFLOW_ERROR` |
| caseLifecycleWorkflow.ts | `CASE_LIFECYCLE_ERROR` |
| checklistWorkflow.ts | `CHECKLIST_WORKFLOW_ERROR` |
| communicationWorkflow.ts | `COMMUNICATION_WORKFLOW_ERROR` |
| complianceWorkflow.ts | `COMPLIANCE_WORKFLOW_ERROR` |
| conciergeActionWorkflow.ts | `CONCIERGE_ACTION_WORKFLOW_ERROR` |
| contractSLAWorkflow.ts | `CONTRACT_SLA_WORKFLOW_ERROR` |
| contractWorkflow.ts | `CONTRACT_WORKFLOW_ERROR` |
| contractorBranchWorkflow.ts | `CONTRACTOR_BRANCH_WORKFLOW_ERROR` |
| contractorComplianceWorkflow.ts | `CONTRACTOR_COMPLIANCE_WORKFLOW_ERROR` |
| contractorProfileWorkflow.ts | `CONTRACTOR_PROFILE_WORKFLOW_ERROR` |
| crudWorkflow.ts | `CRUD_WORKFLOW_ERROR` |
| customerWorkflow.ts | `CUSTOMER_WORKFLOW_ERROR` |
| dashboardWorkflow.ts | `DASHBOARD_WORKFLOW_ERROR` |
| dispatchAssignment.ts | `DISPATCH_ASSIGNMENT_ERROR` |
| dispatchWorkflow.ts | `DISPATCH_WORKFLOW_ERROR` |
| documentWorkflow.ts | `DOCUMENT_WORKFLOW_ERROR` |
| estimateCreateWorkflow.ts | `ESTIMATE_CREATE_WORKFLOW_ERROR` |
| estimateGeneration.ts | `ESTIMATE_GENERATION_ERROR` |
| estimateWorkflow.ts | `ESTIMATE_WORKFLOW_ERROR` |
| externalApprovalWorkflow.ts | `EXTERNAL_APPROVAL_WORKFLOW_ERROR` |
| governanceWorkflow.ts | `GOVERNANCE_WORKFLOW_ERROR` |
| inventoryItemWorkflow.ts | `INVENTORY_ITEM_WORKFLOW_ERROR` |
| inventoryLocationWorkflow.ts | `INVENTORY_LOCATION_WORKFLOW_ERROR` |
| inventoryWorkflow.ts | `INVENTORY_WORKFLOW_ERROR` |
| invoiceCreateWorkflow.ts | `INVOICE_CREATE_WORKFLOW_ERROR` |
| invoicePayment.ts | `INVOICE_PAYMENT_ERROR` |
| jobCreateWorkflow.ts | `JOB_CREATE_WORKFLOW_ERROR` |
| jobLifecycle.ts | `JOB_LIFECYCLE_ERROR` |
| jobWorkflow.ts | `JOB_WORKFLOW_ERROR` |
| maintenanceContract.ts | `MAINTENANCE_CONTRACT_ERROR` |
| mediaWorkflow.ts | `MEDIA_WORKFLOW_ERROR` |
| meetingLifecycle.ts | `MEETING_LIFECYCLE_ERROR` |
| motionLifecycle.ts | `MOTION_LIFECYCLE_ERROR` |
| noticeTemplateWorkflow.ts | `NOTICE_TEMPLATE_WORKFLOW_ERROR` |
| offlineSyncWorkflow.ts | `OFFLINE_SYNC_WORKFLOW_ERROR` |
| ownerPortalWorkflow.ts | `OWNER_PORTAL_WORKFLOW_ERROR` |
| pricebookWorkflow.ts | `PRICEBOOK_WORKFLOW_ERROR` |
| purchaseOrderWorkflow.ts | `PURCHASE_ORDER_WORKFLOW_ERROR` |
| reportDefinitionWorkflow.ts | `REPORT_DEFINITION_WORKFLOW_ERROR` |
| reportExecutionWorkflow.ts | `REPORT_EXECUTION_WORKFLOW_ERROR` |
| reportScheduleWorkflow.ts | `REPORT_SCHEDULE_WORKFLOW_ERROR` |
| reserveWorkflow.ts | `RESERVE_WORKFLOW_ERROR` |
| resolutionCloseout.ts | `RESOLUTION_CLOSEOUT_ERROR` |
| resolutionCloseoutWorkflow.ts | `RESOLUTION_CLOSEOUT_WORKFLOW_ERROR` |
| serviceCatalogWorkflow.ts | `SERVICE_CATALOG_WORKFLOW_ERROR` |
| staffWorkflow.ts | `STAFF_WORKFLOW_ERROR` |
| technicianWorkflow.ts | `TECHNICIAN_WORKFLOW_ERROR` |
| timeEntryWorkflow.ts | `TIME_ENTRY_WORKFLOW_ERROR` |
| vendorBidWorkflow.ts | `VENDOR_BID_WORKFLOW_ERROR` |
| vendorCandidateWorkflow.ts | `VENDOR_CANDIDATE_WORKFLOW_ERROR` |
| violationLifecycle.ts | `VIOLATION_LIFECYCLE_ERROR` |
| violationWorkflow.ts | `VIOLATION_WORKFLOW_ERROR` |
| visitWorkflow.ts | `VISIT_WORKFLOW_ERROR` |
| workOrderLineItemWorkflow.ts | `WORK_ORDER_LINE_ITEM_WORKFLOW_ERROR` |
| workOrderWorkflow.ts | `WORK_ORDER_WORKFLOW_ERROR` |

## Verification

After migration, verify by:

1. **Run type check**: `npm run check` must pass with 0 errors
2. **Run build**: `npm run build` must succeed
3. **Test in development**: Trigger an error in a workflow and verify in SigNoz that:
   - The trace shows `status: ERROR`
   - `exception.message` contains the error message
   - `error.type` contains the workflow-specific error type

## Additional Files to Modify (Non-Workflow)

Beyond workflow files, the following files also have catch blocks that should record errors on spans:

### Route Files with Internal Try/Catch

These route files have internal try/catch blocks that handle errors before they propagate to the oRPC handler:

| File | Error Type |
|------|------------|
| `src/lib/server/api/routes/accounting/payment.ts` | `PAYMENT_ROUTE_ERROR` |
| `src/lib/server/api/routes/accounting/assessment.ts` | `ASSESSMENT_ROUTE_ERROR` |
| `src/lib/server/api/routes/association.ts` | `ASSOCIATION_ROUTE_ERROR` |
| `src/lib/server/api/routes/concierge/conciergeCase.ts` | `CONCIERGE_CASE_ROUTE_ERROR` |
| `src/lib/server/api/routes/document.ts` | `DOCUMENT_ROUTE_ERROR` |
| `src/lib/server/api/routes/job/job.ts` | `JOB_ROUTE_ERROR` |

**Migration Pattern for Route Files:**
```typescript
// Add import at top of file
import { recordSpanError } from '../../middleware/tracing.js';
// or adjust relative path as needed: '../middleware/tracing.js', etc.

// In catch blocks:
} catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    // Record error on span for trace visibility
    await recordSpanError(errorObj, {
        errorCode: 'ROUTE_ERROR',
        errorType: 'PAYMENT_ROUTE_ERROR'  // Use appropriate error type
    });
    
    // Continue with existing error handling...
    throw error; // or handle as appropriate
}
```

### Authorization (Cerbos)

| File | Error Type |
|------|------------|
| `src/lib/server/cerbos/index.ts` | `AUTHORIZATION_ERROR` |

**Migration Pattern for Cerbos:**
```typescript
// Add import
import { recordSpanError } from '../api/middleware/tracing.js';

// In the authorize catch block:
} catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    await recordSpanError(errorObj, {
        errorCode: 'AUTHORIZATION_FAILED',
        errorType: 'AUTHORIZATION_ERROR'
    });
    
    log.error('Authorization check failed', { ... });
    throw error;
}
```

### Files to SKIP (Already Handled or Infrastructure)

These files should NOT be modified as they are part of the tracing/logging infrastructure or already handle span errors:

| File | Reason |
|------|--------|
| `src/lib/server/api/middleware/tracing.ts` | Defines `recordSpanError` itself |
| `src/lib/server/api/middleware/logging.ts` | Logging infrastructure - errors propagate up |
| `src/lib/server/api/middleware/idempotency.ts` | Errors re-thrown and caught at handler level |
| `src/routes/api/v1/rpc/[...rest]/+server.ts` | Already has span error recording |

### Service Files (Optional)

Service files like `src/lib/server/accounting/glService.ts` typically don't have their own catch blocks - they let errors propagate to the calling workflow or route. If a service file DOES have a catch block that swallows or transforms errors, it should also call `recordSpanError()`.

**Pattern for identifying service files that need updates:**
1. Search for `catch` in service files
2. If the catch block re-throws the error unchanged, no update needed (error will be recorded at workflow/route level)
3. If the catch block swallows the error or transforms it, add `recordSpanError()` before the transformation

## Notes

- The `recordSpanError` function is async but safe to call without await if needed (it handles missing spans gracefully)
- The function does nothing if OpenTelemetry is not initialized or no active span exists
- This migration does NOT affect the oRPC handler layer - that already has span error recording implemented in `src/routes/api/v1/rpc/[...rest]/+server.ts`
- For route files, the relative import path for `recordSpanError` varies based on file location

## Related Documentation

- `docs/Hestami AI Developer Agent - Onboarding Package.md` - Section e (Error Handling) and Section f (DBOS Workflows)
- `src/lib/server/api/middleware/tracing.ts` - Contains `recordSpanError` and other tracing utilities
