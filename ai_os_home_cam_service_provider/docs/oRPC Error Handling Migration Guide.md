# oRPC Error Handling Migration Guide

## Problem Statement

The current codebase uses a custom `ApiException` class for error handling in oRPC procedure handlers. However, oRPC does not recognize `ApiException` as a typed error, causing all thrown `ApiException` instances to be converted to generic `INTERNAL_SERVER_ERROR` responses with `"defined":false`.

### Observed Behavior

When a handler throws `ApiException.notFound('ConciergeCase')`, the client receives:

```json
{
  "json": {
    "defined": false,
    "code": "INTERNAL_SERVER_ERROR",
    "status": 500,
    "message": "Internal server error"
  }
}
```

Instead of the expected 404 response with proper error details.

### Root Cause

oRPC has one error handling approach we prefer:

**Type-Safe Approach**: Define errors with `.errors()` and use the `errors` helper in handlers

When a regular JavaScript `Error` (including our custom `ApiException`) is thrown, oRPC converts it to a generic 500 error. The `ApiException` class, while well-structured, doesn't integrate with oRPC's error system.

---

## Solution Overview

There is one approach to fix this:

### Type-Safe Errors

Define typed errors on procedures and use the `errors` helper:

```typescript
const example = orgProcedure
  .input(z.object({ id: z.string() }))
  .errors({
    NOT_FOUND: {
      message: 'Resource not found',
      data: z.object({ resourceType: z.string() })
    },
    FORBIDDEN: {
      message: 'Access denied'
    }
  })
  .output(/* ... */)
  .handler(async ({ input, context, errors }) => {
    // Use typed errors helper
    if (!resource) {
      throw errors.NOT_FOUND({ data: { resourceType: 'MyResource' } });
    }
    if (!hasAccess) {
      throw errors.FORBIDDEN();
    }
  });
```


---

## Migration Steps

### Step 1: Identify Files to Migrate

Run this command to find all files using `ApiException`:

```powershell
Get-ChildItem -Path src/lib/server/api/routes -Recurse -Filter "*.ts" | Select-String -Pattern "ApiException\." | Select-Object -ExpandProperty Path -Unique
```

**Current count**: 1169 usages across 85 files in `src/lib/server/api/routes/`

### Step 2: For Each File

#### 2.1 Define Typed Errors on the Procedure

Add an `.errors()` block to each procedure that can throw errors:

```typescript
.errors({
  NOT_FOUND: {
    message: 'Resource not found',
    data: z.object({ resourceType: z.string() })
  },
  BAD_REQUEST: {
    message: 'Invalid request'
  },
  FORBIDDEN: {
    message: 'Access denied'
  }
})
```

#### 2.2 Update Handler Signature

Add `errors` to the handler destructuring:

```typescript
// Before
.handler(async ({ input, context }) => {

// After
.handler(async ({ input, context, errors }) => {
```

#### 2.3 Replace ApiException Calls with Typed Errors

| Old Pattern | New Pattern (Type-Safe) |
|-------------|------------------------|
| `throw ApiException.notFound('Resource')` | `throw errors.NOT_FOUND({ data: { resourceType: 'Resource' } })` |
| `throw ApiException.forbidden('message')` | `throw errors.FORBIDDEN({ message: 'message' })` |
| `throw ApiException.badRequest('message')` | `throw errors.BAD_REQUEST({ message: 'message' })` |
| `throw ApiException.conflict('message')` | `throw errors.CONFLICT({ message: 'message' })` |
| `throw ApiException.internal('message')` | `throw errors.INTERNAL_SERVER_ERROR({ message: 'message' })` |

#### 2.4 Standard oRPC Error Codes

oRPC recognizes these standard error codes with default HTTP status mappings:

| Code | HTTP Status |
|------|-------------|
| `BAD_REQUEST` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `METHOD_NOT_ALLOWED` | 405 |
| `NOT_ACCEPTABLE` | 406 |
| `CONFLICT` | 409 |
| `PRECONDITION_FAILED` | 412 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 |
| `UNPROCESSABLE_CONTENT` | 422 |
| `TOO_MANY_REQUESTS` | 429 |
| `INTERNAL_SERVER_ERROR` | 500 |
| `NOT_IMPLEMENTED` | 501 |
| `BAD_GATEWAY` | 502 |
| `SERVICE_UNAVAILABLE` | 503 |
| `GATEWAY_TIMEOUT` | 504 |

---

## File-by-File Migration Priority

### High Priority (Most Affected Files)

1. `src/lib/server/api/routes/workOrder/workOrder.ts` - 82 usages
2. `src/lib/server/api/routes/governance/meeting.ts` - 45 usages
3. `src/lib/server/api/routes/governance/boardMotion.ts` - 41 usages
4. `src/lib/server/api/routes/billing/estimate.ts` - 32 usages
5. `src/lib/server/api/routes/concierge/conciergeCase.ts` - 32 usages
6. `src/lib/server/api/routes/violation/violation.ts` - 32 usages
7. `src/lib/server/api/routes/ownerPortal.ts` - 31 usages
8. `src/lib/server/api/routes/inventory/purchaseOrder.ts` - 29 usages
9. `src/lib/server/api/routes/job/job.ts` - 27 usages
10. `src/lib/server/api/routes/technician/technician.ts` - 27 usages

### Medium Priority (15-26 usages)

- `src/lib/server/api/routes/communication/communication.ts` - 26 usages
- `src/lib/server/api/routes/contract/serviceContract.ts` - 26 usages
- `src/lib/server/api/routes/document.ts` - 26 usages
- `src/lib/server/api/routes/staff.ts` - 25 usages
- `src/lib/server/api/routes/pricebook/pricebook.ts` - 24 usages
- `src/lib/server/api/routes/arc/request.ts` - 23 usages
- `src/lib/server/api/routes/billing/invoice.ts` - 23 usages
- `src/lib/server/api/routes/contract/visit.ts` - 21 usages
- `src/lib/server/api/routes/billing/proposal.ts` - 20 usages
- `src/lib/server/api/routes/workOrder/bid.ts` - 20 usages
- `src/lib/server/api/routes/governance/resolution.ts` - 19 usages
- `src/lib/server/api/routes/billing/payment.ts` - 18 usages
- `src/lib/server/api/routes/concierge/ownerIntent.ts` - 18 usages
- `src/lib/server/api/routes/reserve.ts` - 18 usages
- `src/lib/server/api/routes/accounting/glAccount.ts` - 17 usages
- `src/lib/server/api/routes/dispatch/dispatch.ts` - 16 usages
- `src/lib/server/api/routes/dispatch/sla.ts` - 16 usages

### Lower Priority (< 15 usages)

All remaining 68 files with fewer than 15 usages each.

---

## Example Migration

### Before (conciergeCase.ts getDetail handler)

```typescript
.handler(async ({ input, context }) => {
  const conciergeCase = await prisma.conciergeCase.findFirst({
    where: { id: input.id, organizationId: context.organization.id, deletedAt: null },
    include: { /* ... */ }
  });

  if (!conciergeCase) {
    throw ApiException.notFound('ConciergeCase');
  }

  // Cerbos authorization
  await context.cerbos.authorize('view', 'concierge_case', conciergeCase.id);
  
  // ... rest of handler
})
```

### After (Using Type-Safe Errors)

```typescript
.errors({
  NOT_FOUND: {
    message: 'Case not found',
    data: z.object({ resourceType: z.string() })
  }
})
.output(/* ... */)
.handler(async ({ input, context, errors }) => {
  const conciergeCase = await prisma.conciergeCase.findFirst({
    where: { id: input.id, organizationId: context.organization.id, deletedAt: null },
    include: { /* ... */ }
  });

  if (!conciergeCase) {
    throw errors.NOT_FOUND({ data: { resourceType: 'ConciergeCase' } });
  }

  // Cerbos authorization
  await context.cerbos.authorize('view', 'concierge_case', conciergeCase.id);
  
  // ... rest of handler
})
```

---

## Migrating Existing ORPCError to Type-Safe Errors

Some files may have already been partially migrated using `ORPCError` directly. These should be upgraded to use the type-safe `.errors()` approach.

### Before (ORPCError direct usage)

```typescript
import { ORPCError } from '@orpc/server';

const example = orgProcedure
  .input(z.object({ id: z.string() }))
  .output(/* ... */)
  .handler(async ({ input, context }) => {
    if (!resource) {
      throw new ORPCError('NOT_FOUND', { message: 'Resource not found' });
    }
  });
```

### After (Type-Safe errors)

```typescript
const example = orgProcedure
  .input(z.object({ id: z.string() }))
  .errors({
    NOT_FOUND: {
      message: 'Resource not found',
      data: z.object({ resourceType: z.string() })
    }
  })
  .output(/* ... */)
  .handler(async ({ input, context, errors }) => {
    if (!resource) {
      throw errors.NOT_FOUND({ data: { resourceType: 'Resource' } });
    }
  });
```

### Search for ORPCError Direct Usage

```powershell
# Find files using ORPCError directly (need to be upgraded)
Get-ChildItem -Path src/lib/server/api/routes -Recurse -Filter "*.ts" | Select-String -Pattern "new ORPCError" | Select-Object -ExpandProperty Path -Unique
```

---

## Special Cases

### 1. Middleware Errors (router.ts)

The file `src/lib/server/api/router.ts` contains middleware that throws `ApiException`. Middleware doesn't have access to typed `errors` from `.errors()`, so these must define errors at the base procedure level.

**Before:**
```typescript
// authedProcedure middleware
if (!context.user) {
  throw ApiException.unauthenticated();
}

// orgProcedure middleware  
if (!context.organization) {
  throw ApiException.forbidden('Organization context required. Set X-Org-Id header.');
}

// adminProcedure middleware
if (context.role !== 'ADMIN') {
  throw ApiException.forbidden('Admin access required');
}
```

**After (define errors on base procedures):**
```typescript
export const authedProcedure = orpc
  .errors({
    UNAUTHORIZED: { message: 'Authentication required' }
  })
  .use(async ({ context, next, errors }) => {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }
    return next({ context: { ...context, user: context.user } });
  });

export const orgProcedure = authedProcedure
  .errors({
    FORBIDDEN: { message: 'Organization context required' }
  })
  .use(async ({ context, next, errors }) => {
    if (!context.organization) {
      throw errors.FORBIDDEN({ message: 'Organization context required. Set X-Org-Id header.' });
    }
    return next({ context });
  });
```

### 2. Cerbos Authorization Errors

The Cerbos `requireAuthorization` function in `src/lib/server/cerbos/index.ts` likely throws `ApiException.forbidden()`. This should be updated to integrate with oRPC's error system.

### 3. Workflow Errors

DBOS workflow handlers may throw `ApiException.internal()`. These should be updated to use typed errors where possible.

---

## Validation

After migrating each file:

1. **TypeScript Check**: Run `npx tsc --noEmit --skipLibCheck` to ensure no type errors
2. **Test the endpoint**: Verify that errors now return proper HTTP status codes instead of 500
3. **Check logs**: Ensure error details are properly logged

---

## Notes

### Keep ApiException Class

The `ApiException` class in `src/lib/server/api/errors.ts` can remain for:
- Non-oRPC code paths
- Internal error handling utilities
- Type definitions and schemas

However, it should NOT be thrown directly in oRPC handlers.

### Do NOT Pass Sensitive Data

Per oRPC documentation: "Do not pass sensitive data in the ORPCError.data field" as it will be exposed to the client.

### Error Response Format

After migration, error responses will follow oRPC's format:

```json
{
  "defined": true,
  "code": "NOT_FOUND",
  "status": 404,
  "message": "ConciergeCase not found"
}
```

---

## Search Commands for Finding Issues

```powershell
# Find all ApiException usages in routes (with line numbers)
Get-ChildItem -Path src/lib/server/api/routes -Recurse -Filter "*.ts" | Select-String -Pattern "ApiException\."

# Find all ApiException usages in middleware/router
Select-String -Path src/lib/server/api/router.ts -Pattern "ApiException\."

# Find all ApiException usages in Cerbos
Get-ChildItem -Path src/lib/server/cerbos -Recurse -Filter "*.ts" | Select-String -Pattern "ApiException\."

# Count total usages
(Get-ChildItem -Path src/lib/server/api/routes -Recurse -Filter "*.ts" | Select-String -Pattern "ApiException\.").Count

# List unique files containing ApiException
Get-ChildItem -Path src/lib/server/api/routes -Recurse -Filter "*.ts" | Select-String -Pattern "ApiException\." | Select-Object -ExpandProperty Path -Unique
```

---

## OpenTelemetry & Logging Benefits

### Before Migration (ApiException)

When `ApiException` is thrown, oRPC converts it to a generic error:

```json
{"defined":false,"code":"INTERNAL_SERVER_ERROR","status":500,"message":"Internal server error"}
```

**Impact on observability:**
- Traces show HTTP 500 for ALL errors (not found, forbidden, validation, etc.)
- Log messages show generic "Internal server error"
- No way to distinguish between actual server errors and expected business errors
- Difficult to set up alerts (can't filter by error type)

### After Migration (Type-Safe Errors)

When `ORPCError` is thrown, the response contains actual error details:

```json
{"defined":true,"code":"NOT_FOUND","status":404,"message":"ConciergeCase not found"}
```

**Impact on observability:**
- Traces show correct HTTP status codes (404, 403, 400, etc.)
- Log messages include actual error code and message
- Can filter/alert on specific error types
- Clear distinction between client errors (4xx) and server errors (5xx)

### Current Logging Behavior

The oRPC handler in `src/routes/api/v1/rpc/[...rest]/+server.ts` already logs error response bodies:

```typescript
if (statusCode >= 400) {
    const clonedResponse = result.response.clone();
    const body = await clonedResponse.json();
    logRequestError(logContext, new Error(JSON.stringify(body)));
}
```

After migration, these logs will contain meaningful error information instead of generic messages.

### Required Enhancement

For even better structured logging, consider updating `+server.ts` to extract oRPC error fields:

```typescript
if (statusCode >= 400) {
    const clonedResponse = result.response.clone();
    try {
        const body = await clonedResponse.json();
        // Extract oRPC error structure for better logging
        const errorInfo = body?.json || body;
        logRequestError(logContext, new Error(errorInfo.message || 'Unknown error'), {
            errorCode: errorInfo.code,
            errorDefined: errorInfo.defined,
            errorData: errorInfo.data
        });
    } catch {
        // Non-JSON error response
    }
}
```

---

## Summary

1. **Add `.errors()` block** to each procedure defining the errors it can throw
2. **Update handler signature** to destructure `errors` alongside `input` and `context`
3. **Replace** all `ApiException.*()` calls with `errors.CODE({ message: '...' })`
4. **Migrate existing `ORPCError`** direct usage to type-safe `errors` helper
5. **Update** middleware in `router.ts` to define errors at base procedure level
6. **Update** Cerbos authorization to integrate with oRPC error system
7. **Verify** with TypeScript compilation and endpoint testing
8. **Benefit**: Traces and logs will now show actual error codes/messages instead of generic 500s
