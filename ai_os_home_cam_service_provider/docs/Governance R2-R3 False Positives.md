# Governance R2/R3 False Positives

This document details the 21 violations that are flagged by the R2/R3 governance rules but are **intentional exceptions** and do not require remediation.

## Overview

The R2 rule requires all Prisma database mutations to be wrapped in DBOS durable workflows. The R3 rule requires workflow wrappers to accept an `idempotencyKey` parameter for exactly-once execution.

However, certain infrastructure code and internal services are exempt from these rules because:
1. They operate at a lower level than the application layer
2. They are called from within workflows (avoiding double-wrapping)
3. They handle their own idempotency or transaction semantics
4. They are system-level operations that don't benefit from workflow durability

## False Positive Categories

### 1. Row-Level Security (RLS) Infrastructure - 10 violations

**File:** `src/lib/server/rls.ts`

| Line | Operation | Reason for Exemption |
|------|-----------|---------------------|
| 48 | `$executeRaw` | Sets RLS session variables - must execute before workflows |
| 54 | `$executeRaw` | Clears RLS session variables - cleanup operation |
| 77 | `$executeRaw` | Transaction-scoped RLS context setup |
| 91 | `$executeRaw` | Transaction-scoped RLS context cleanup |
| 110 | `$executeRaw` | Organization context setup for transactions |
| 128 | `$executeRaw` | Clears organization context after transaction |
| 147 | `$transaction` | Wrapper for RLS-protected transactions |
| 165 | `$executeRaw` | Sets user context for RLS policies |
| 180 | `$executeRaw` | Clears user context |
| 195 | `$executeRaw` | Audit context setup for RLS |

**Justification:** RLS functions are foundational security infrastructure that:
- Must execute before any workflow can access data
- Are called internally by workflows and other infrastructure
- Use raw SQL for PostgreSQL session variable manipulation
- Have no application-level idempotency requirements

### 2. Chart of Accounts Seeding Service - 4 violations

**File:** `src/lib/server/accounting/glService.ts`

| Line | Operation | Reason for Exemption |
|------|-----------|---------------------|
| 45 | `glAccount.createMany` | Bulk seed of default GL accounts |
| 78 | `glAccount.createMany` | Category-specific account creation |
| 112 | `glAccount.create` | Individual account creation during seeding |
| 145 | `glAccount.update` | Account hierarchy setup |

**Justification:** The GL seeding service:
- Is called from within the `createManagedAssociation_v1` workflow
- Operates as a single atomic step within that workflow
- Has workflow-level idempotency from the parent workflow
- Would create unnecessary complexity if wrapped in a separate workflow

### 3. Idempotency Infrastructure - 4 violations

**File:** `src/lib/server/api/middleware/idempotency.ts`

| Line | Operation | Reason for Exemption |
|------|-----------|---------------------|
| 32 | `idempotencyKey.findUnique` | Check for existing idempotency record |
| 58 | `idempotencyKey.create` | Create new idempotency record |
| 85 | `idempotencyKey.update` | Update idempotency record with result |
| 110 | `idempotencyKey.delete` | Cleanup expired idempotency records |

**Justification:** The idempotency service itself:
- Provides the foundation for workflow idempotency
- Cannot be wrapped in a workflow (circular dependency)
- Uses database transactions for atomicity
- Is infrastructure-level code, not application logic

### 4. Activity Event Recording - 1 violation

**File:** `src/lib/server/api/middleware/activityEvent.ts`

| Line | Operation | Reason for Exemption |
|------|-----------|---------------------|
| 67 | `activityEvent.create` | Creates audit trail records |

**Justification:** Activity event recording:
- Is called from within workflows as a side effect
- Is a fire-and-forget audit operation
- Should not affect workflow success/failure
- Has its own error handling with graceful degradation

### 5. Governance Activity Service - 1 violation

**File:** `src/lib/server/governance/governanceActivityService.ts`

| Line | Operation | Reason for Exemption |
|------|-----------|---------------------|
| 89 | `activityEvent.create` | Governance-specific audit logging |

**Justification:** Similar to general activity events:
- Called from within governance workflows
- Audit-only operation that shouldn't block workflows
- Has independent error handling

### 6. Organization Context Switching - 1 violation

**File:** `src/routes/app/organization/switch/+page.server.ts`

| Line | Operation | Reason for Exemption |
|------|-----------|---------------------|
| 45 | `session.update` | Updates user session for org switch |

**Justification:** Session management:
- Is a SvelteKit server-side operation
- Not suitable for DBOS workflow wrapping
- Uses SvelteKit's session handling mechanisms
- Is a UI/session concern, not a business transaction

## Recommendations

### For Future Development

1. **Do not wrap** these operations in workflows - they are intentionally exempt
2. **Document** any new infrastructure-level code that should be exempt
3. **Review** periodically to ensure exemptions are still valid

### For Governance Tooling

Consider updating the governance verification to:
1. Support an allowlist of exempt files/patterns
2. Add inline comments for exemption (e.g., `// @governance-exempt: infrastructure`)
3. Generate separate reports for infrastructure vs. application violations

## Verification

To verify the current violation count:

```bash
cd ai_os_home_cam_service_provider/executable_governance
bun run verify
```

Expected output should show ~21 violations, all from the files listed above.

## Change History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-13 | Governance Remediation | Initial documentation of false positives |
