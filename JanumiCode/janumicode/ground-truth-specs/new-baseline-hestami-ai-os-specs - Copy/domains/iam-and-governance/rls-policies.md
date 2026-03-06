# IAM and Governance - PostgreSQL RLS & Cerbos Rules

## 1. PostgreSQL RLS Configuration
The platform enforces strict Row-Level Security (RLS) to ensure multi-tenant isolation.
- **`hestami_app` Database User:** Runtime user with NO `BYPASSRLS`. Used via `DATABASE_URL` for `prisma.$queryRaw` and all standard queries.
- **`hestami` Database User:** Admin user WITH `BYPASSRLS`. Used ONLY for migrations (`DIRECT_DATABASE_URL`).

### 1.1 Core RLS Pattern
All tenant-scoped tables (e.g., `concierge_cases`, `work_orders`, `documents`) are filtered by evaluating the PostgreSQL session variable:
```sql
organization_id = current_setting('app.current_org_id', true)
```

### 1.2 Execution Mechanics (DBOS & Prisma)
Because DBOS pools connections, context must be explicitly set and cleared atomically:
```typescript
import { orgTransaction, clearOrgContext } from '../db/rls.js';

// RULE: MUST USE orgTransaction for operations mutating state in workflows
await orgTransaction(organizationId, async (tx) => {
  // Query executed by tx
}, { userId: session.user.id }); // Enables auditory logging

// Finally block MUST call clearOrgContext(userId)
```

### 1.3 Staff Cross-Org Access
Staff bypassing RLS to view all orgs do NOT use raw RLS dropping. They query explicit SECURITY DEFINER views.
```sql
CREATE VIEW staff_concierge_cases_list AS
SELECT cc.*, o.name as organization_name
FROM concierge_cases cc JOIN organizations o ON cc.organization_id = o.id
WHERE cc.deleted_at IS NULL;
-- GRANTED TO hestami_app
```

When Staff accesses an individual case from *another* organization:
```typescript
await setOrgContextForWorkItem(userId, 'CONCIERGE_CASE', input.id);
// Generates audit record of access
```

## 2. Cerbos Authorization & Derived Roles
Cerbos handles the business logic of *who* is allowed to perform Actions over Resources.

### 2.1 Staff Derived Roles
- `hestami_platform_admin`: Condition string requires `PLATFORM_ADMIN` in `staffRoles`.
- `hestami_staff`: Condition string requires any `staffRoles` present.

### 2.2 Organization Derived Roles
- `org_admin`: Requires `ADMIN` in org.
- `org_manager`: Requires `MANAGER` in org.
- `org_management`: Requires `ADMIN` OR `MANAGER`.
- `org_stakeholder`: Requires `OWNER`, `TENANT`, or `BOARD_MEMBER`.

### 2.3 Resource Enforcement Examples
**Resource `organization_admin`** (The staff portal view)
- `list`, `view`, `view_members`: Allowed for `hestami_staff`.
- `edit`, `update_status`, `suspend`, `activate`: ONLY allowed for `hestami_platform_admin`.

**Resource `work_queue`** (The global staff queue)
- `view`: Allowed for `hestami_staff` and `hestami_platform_admin`.
