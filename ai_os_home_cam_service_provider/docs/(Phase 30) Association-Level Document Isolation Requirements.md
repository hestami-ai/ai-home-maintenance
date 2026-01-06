# (Phase 30) Association-Level Document Isolation Requirements

## 1. Overview
This document defines the requirements for implementing Association-level isolation within the Community Association Management (CAM) pillar. The platform currently enforces multi-tenant isolation at the `Organization` level via Row-Level Security (RLS). While effective for standalone organizations, this identifies a security gap for CAM Management Companies that manage multiple Associations under a single Organization context.

## 2. Problem Statement
The current multi-tenant architecture uses `Organization` as the primary isolation boundary.
- **Shared Org Context**: Management Companies (the Organization) manage multiple Associations (sub-tenants) that share the same `organization_id`.
- **Isolation Gap**: RLS policies currently filter only by `organization_id`. This means that database-level isolation between Associations within a single Management Company does not exist.
- **Leakage Risk**: External users (Board Members, Owners) assigned to a specific Association could technically access data from other Associations managed by the same company if application-layer filters are bypassed or misconfigured.
- **Unified Document Model**: The unified `Document` model lacks a direct `association_id` column, relying on `DocumentContextBinding` for linkage, which is not evaluated by RLS.

## 3. Objectives
- Enable a secondary tier of RLS-enforced isolation based on Association context.
- **Model Consolidation**: Deprecate specialized document holder models (`ViolationEvidence`, `ARCDocument`) and migrate them to the unified `Document` model with `DocumentContextBinding` records linking to parent entities.
- **Document Model Enhancement**: Add `associationId` to the unified `Document` model for RLS enforcement.
- **Permission-by-Assignment**: Implement RLS logic that grants access based on active assignments (Work Orders, Contracts) for Service Providers and Concierge users.
- Ensure strict segregation of Documents, Violations, ARC Requests, and Activity Logs between Associations.
- Maintain seamless cross-association visibility for authorized Management Company staff.
- Preserve backward compatibility for non-CAM organizations (Service Providers, Concierge clients).
- **Cross-Pillar Consistency**: Apply `associationId` uniformly across CAM, Concierge, and Service Provider pillars for consistent code paths and policy checks.

## 4. Functional Requirements

### 4.1 Tiered Context Management
- The application must support two active isolation contexts simultaneously: `Organization` and `Association`.
- **Validation**:
    - For **Management Company Staff**: Association context is optional and primarily used for focused views and auditing.
    - For **External Association Members**: Association context is **mandatory** and strictly validated against the user's membership/role.

### 4.2 Unified & Isolated Document Repository
- **Model Consolidation**: Deprecate `ViolationEvidence` and `ARCDocument` models. Migrate existing data to `Document` records with `DocumentContextBinding` linking to parent entities:
    - `ViolationEvidence` → `Document` + `DocumentContextBinding` with `contextType=VIOLATION`
    - `ARCDocument` → `Document` + `DocumentContextBinding` with `contextType=ARC_REQUEST`
- **Direct Labeling**: The `Document` model must include a direct `associationId` field to enable efficient RLS filtering without complex joins.
- **Stamping**: All documents created within an Association-scoped workflow (ARC, Violation, Meeting) must be stamped with the `associationId`.
- **Visibility Tiers**: 
    - **Association-scoped**: Visible only when the matching association context is active OR via assignment bypass.
    - **Organization-wide**: Documents stamped with `association_id IS NULL` remain visible to all authorized organization members (e.g., company-wide policies).
- **Management Company Pseudo-Association**: Management Companies may optionally be assigned a "pseudo-association" record to serve as the owner of organization-wide documents, providing a consistent non-null `associationId` pattern.

### 4.3 Domain Model Hardening
- **CAM-Specific Tables**: Update RLS policies for `violations`, `arc_requests`, and `policy_documents` to require `association_id` matching for non-staff users.
- **Assignment-Based Access**: 
    - **Service Providers**: Access to documents is granted if they have an active `WorkOrder` assignment linked to that document via `DocumentContextBinding`.
    - **Property Owners**: Access is granted if the document is linked to their `Unit` or a `ConciergeCase` they participate in.
- **Audit Logging**: `ActivityEvent` records must inherit the association context to ensure per-association audit trails.

## 5. Technical Requirements

### 5.1 Prisma Schema Enhancements
Modify `prisma/schema.prisma` to add Association identity to the unified model:

```prisma
model Document {
  // Existing fields...
  id             String  @id @default(cuid())
  organizationId String  @map("organization_id")
  associationId  String? @map("association_id") // NEW: Required for tiered RLS

  // Relations
  association    Association? @relation(fields: [associationId], references: [id])
  
  // Indexes for performance
  @@index([organizationId, associationId])
}
```

### 5.2 SQL RLS Infrastructure
- **Session Variables**: 
    - `app.current_assoc_id`: Set via `set_config`.
    - `app.is_org_staff`: Boolean set during context bootstrapping to enable staff bypass.
- **SQL Helper Functions**:
    - `current_assoc_id()`: Returns the current association context from the session.
    - `check_document_assignment(doc_id, user_id)`: Helper function to evaluate assignment-based access for Service Providers and Owners.
- **SECURITY DEFINER Functions**:
    - `get_user_associations(user_id, org_id)`: Allows bootstrapping the association switcher before context is set.
    - `get_document_organization(doc_id)`: Update existing function to return association context alongside organization for TUS hook processing.
- **Updated RLS Policies**:
    - All CAM-scoped tables must be updated to a tiered policy:
      ```sql
      -- Example logic for the 'documents' table
      CREATE POLICY rls_documents_tiered_isolation ON documents
      FOR ALL
      USING (
        organization_id = current_org_id() 
        AND (
          is_org_staff() -- Bypasses association check if user has mgmt staff role
          OR association_id = current_assoc_id() 
          OR check_document_assignment(id, current_user_id()) -- Assignment bypass
        )
      );
      ```

### 5.3 Backend Integration
- **Context Propagation**: Support the `X-Assoc-Id` header for API requests (browser-side).
- **Server Hooks**: Update `src/hooks.server.ts` to:
    - Extract `X-Assoc-Id` header from incoming requests
    - Validate association membership/access against user's roles
    - Populate `locals.association` following the same pattern as `locals.organization`
- **oRPC Procedures**: Update `orgProcedure` and `baseProcedure` in `router.ts` to set the Association RLS context (`app.current_assoc_id`) before query execution.
- **DBOS Workflows**: Extend workflow inputs to include `associationId` and use association-aware transaction wrappers.

### 5.4 SvelteKit Frontend Integration
- **`buildServerContext()`**: Update to include `associationId` in the context object, following the same pattern as `organizationId`. The association context should be set at the same time and using the same mechanism.
- **`createOrgClient()` / `createDirectClient()`**: Update to propagate `associationId` for both browser-side and server-side API calls.
- **Layout Hierarchy**: Association context flows through `parent()` calls in `+page.server.ts` files, similar to organization context.
- **Session Variables**: Set `app.current_assoc_id` at the start of every transaction (not just when context changes) to prevent stale context from connection pooling.

### 5.5 Service Provider Document Scoping
- **CAM Pillar**: Service Provider documents are scoped to associations via:
    - Work Order assignments (linked via `DocumentContextBinding`)
    - Contracted services with the association
- **Vendor Documents**: License/insurance documents uploaded by vendors should reference the `Vendor` model AND be stamped with the `associationId` of the association they are contracted with.
- **Concierge Pillar**: Service calls and concierge cases link documents to the owner's association context.

## 6. Migration Requirements
- **Data Backfill**: Populate `Document.association_id` from existing `DocumentContextBinding` records where `contextType = 'ASSOCIATION'`.
- **Policy Migration**: Recreate policies for `violations`, `arc_requests`, and `policy_documents` to use the tiered filtering logic.

## 7. Success Criteria
- Database-enforced isolation prevents non-staff users from accessing data belonging to other associations in the same organization.
- Staff members can switch association contexts without data leakage between sessions.
- Activity logs accurately reflect association context for all operations.
- No performance degradation in document listing or retrieval operations.

## 8. Design Notes & Considerations

### 8.1 RLS Performance
- **`check_document_assignment()` Per-Row Evaluation**: This function is called for each row during RLS evaluation. For large document tables, this could impact performance.
- **Mitigation Strategies**:
    - Consider materializing assignments to a junction table with appropriate indexes
    - Use indexed `ANY()` patterns instead of per-row function calls where possible
    - Add composite indexes that include commonly-filtered columns (e.g., `status`)

### 8.2 Management Company as Pseudo-Association
- For organization-wide documents (company policies, templates), Management Companies should be assigned a "pseudo-association" record.
- This provides a consistent non-null `associationId` pattern and simplifies RLS logic.
- The pseudo-association would have a distinguishing flag or naming convention (e.g., `isOrgWide: true` or name pattern `[Company Name] - Organization-Wide`).

### 8.3 Current Development Context
- **Workflow Versioning**: Not required at this stage—breaking changes are acceptable. Existing workflows can be updated in place.
- **Migration Scope**: Minimal data exists in the system; no active CAM documents require backfill. Migration is primarily structural.
- **No Active DPQ Workers**: Document processing queue workers are not actively running; updates to `get_document_organization()` can be made in place.

### 8.4 Cross-Pillar Consistency
- The `associationId` field should be used consistently across CAM, Concierge, and Service Provider pillars.
- For Concierge users, even if practically less relevant, using `associationId` ensures consistent code paths and policy checks.
- This reduces the need for pillar-specific conditional logic in RLS policies and application code.
