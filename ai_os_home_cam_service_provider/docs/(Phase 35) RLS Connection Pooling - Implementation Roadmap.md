# Phase 35: RLS Connection Pooling Fix - Implementation Roadmap

## Overview

This roadmap addresses the RLS connection pooling race condition causing intermittent zero counts on the Concierge Dashboard. Implementation is organized into three parallel workstreams.

**Scope**: This phase focuses on the **Concierge pillar**. The **CAM pillar** is already addressed by Phase 30.

**Reference**: This implementation follows the patterns defined in:
- `docs/Hestami AI Developer Agent - Onboarding v2.md`
  - Section 4: Multitenancy - "All queries filter on `organization_id`"
  - Section 6: DBOS Workflows - `prisma.$transaction()` inside `DBOS.runStep()`
  - Section 9: RLS & SECURITY DEFINER
- `(Phase 30) Association-Level Document Isolation Requirements.md`
  - Section 5.4: Transaction-scoped context setting (model solution for CAM pillar)

---

## Workstream 1: Defense in Depth (Application-Level Filtering)

**Priority**: HIGH - Immediate fix with low risk  
**Estimated Effort**: 2-4 hours  
**Dependencies**: None

### 1.1 Audit All oRPC Routers

- [ ] **`document.ts`** - Verify `organizationId` in all `WHERE` clauses
  - [ ] `listDocuments` procedure
  - [ ] `getDocument` procedure
  - [ ] `uploadDocument` procedure
  - [ ] `updateDocument` procedure
  - [ ] `deleteDocument` procedure
  - [ ] `listDocumentVersions` procedure

- [ ] **`conciergeCase.ts`** - Verify `organizationId` in all `WHERE` clauses
  - [x] `list` procedure (already has explicit filter)
  - [ ] `get` procedure
  - [ ] `create` procedure
  - [ ] `updateStatus` procedure
  - [ ] `assign` procedure
  - [ ] `resolve` procedure
  - [ ] `close` procedure
  - [ ] `cancel` procedure

- [ ] **`individualProperty.ts`** - Verify `ownerOrgId` in all `WHERE` clauses
  - [x] `list` procedure (already has explicit filter)
  - [x] `get` procedure (already has explicit filter)
  - [x] `create` procedure (already has explicit filter)
  - [x] `update` procedure (already has explicit filter)
  - [x] `delete` procedure (already has explicit filter)

- [ ] **Other Concierge Routers**
  - [ ] `ownerIntent.ts`
  - [ ] `caseNote.ts`
  - [ ] `caseAttachment.ts`
  - [ ] `caseParticipant.ts`
  - [ ] `conciergeAction.ts`
  - [ ] `vendorCandidate.ts`
  - [ ] `vendorBid.ts`
  - [ ] `externalHoaContext.ts`
  - [ ] `externalVendorContext.ts`
  - [ ] `materialDecision.ts`
  - [ ] `propertyPortfolio.ts`

### 1.2 Add Missing Explicit Filters

For each router identified in 1.1:
- [ ] Add `organizationId: context.organization.id` to all `findMany`, `findFirst`, `count` queries
- [ ] Verify `create` operations include `organizationId`
- [ ] Test each endpoint after modification

### 1.3 Verification

- [ ] Run full test suite
- [ ] Manual testing of dashboard counts
- [ ] Verify no regressions in existing functionality

---

## Workstream 2: Transactional RLS Context (Systemic Fix)

**Priority**: MEDIUM - Architectural fix  
**Estimated Effort**: 4-8 hours  
**Dependencies**: Workstream 1 should be completed first for safety

> **Note**: Per Hestami AI Developer Onboarding (Section 6), all mutations already use DBOS workflows with `prisma.$transaction()` inside `DBOS.runStep()`. The fix involves ensuring RLS context is set within the same transaction.

### 2.1 Evaluate Implementation Options

**Option A (Recommended)**: Set RLS context within each `DBOS.runStep` transaction
```typescript
await DBOS.runStep(
  () => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_current_org_id(${orgId})`;
    const entity = await tx.myEntity.create({ data: {...} });
    return entity;
  }),
  { name: 'createEntity' }
);
```
- [x] Aligns with existing DBOS workflow pattern
- [x] No middleware changes required
- [ ] Requires updating each workflow


### 2.2 Implement Option A (Per-Workflow Fix)

- [ ] Create helper function `withOrgContext(tx, orgId, fn)`
  ```typescript
  async function withOrgContext<T>(
    tx: PrismaTransaction,
    orgId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    await tx.$executeRaw`SELECT set_current_org_id(${orgId})`;
    return fn();
  }
  ```

- [ ] Update high-priority workflows:
  - [ ] `documentWorkflow_v1` - Document CRUD operations
  - [ ] `caseLifecycleWorkflow_v1` - Concierge case operations
  - [ ] Other workflows as needed

### 2.3 Update Read Operations (Non-Workflow)

- [ ] For read-only operations not using DBOS workflows:
  - [ ] Wrap in `prisma.$transaction` with RLS context
  - [ ] Or rely on Defense in Depth (Workstream 1) explicit filters

### 2.4 Testing

- [ ] Unit tests for `withOrgContext` helper
- [ ] Integration tests for concurrent requests
- [ ] Load testing to verify no deadlocks
- [ ] Performance benchmarking

---

## Workstream 3: Comprehensive RLS Coverage

**Priority**: MEDIUM - Security hardening  
**Estimated Effort**: 2-4 hours  
**Dependencies**: None (can run in parallel)

### 3.1 Create RLS Migration

- [ ] Create new migration file: `YYYYMMDDHHMMSS_add_missing_rls_policies`

### 3.2 Add RLS to Direct Org-Scoped Tables

- [ ] **`individual_properties`**
  ```sql
  ALTER TABLE individual_properties ENABLE ROW LEVEL SECURITY;
  ALTER TABLE individual_properties FORCE ROW LEVEL SECURITY;
  CREATE POLICY rls_individual_properties_select ON individual_properties 
    FOR SELECT USING (owner_org_id = current_org_id());
  CREATE POLICY rls_individual_properties_insert ON individual_properties 
    FOR INSERT WITH CHECK (owner_org_id = current_org_id());
  CREATE POLICY rls_individual_properties_update ON individual_properties 
    FOR UPDATE USING (owner_org_id = current_org_id());
  CREATE POLICY rls_individual_properties_delete ON individual_properties 
    FOR DELETE USING (owner_org_id = current_org_id());
  ```

### 3.3 Add RLS to Join-Based Tables (via `individual_properties`)

- [ ] **`individual_assets`**
  ```sql
  ALTER TABLE individual_assets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE individual_assets FORCE ROW LEVEL SECURITY;
  CREATE POLICY rls_individual_assets_select ON individual_assets FOR SELECT 
    USING (EXISTS (SELECT 1 FROM individual_properties p 
      WHERE p.id = individual_assets.property_id AND p.owner_org_id = current_org_id()));
  -- INSERT, UPDATE, DELETE policies similarly
  ```

- [ ] **`individual_maintenance_requests`** (same pattern)
- [ ] **`property_ownerships`** (same pattern)
- [ ] **`portfolio_properties`** (via `property_portfolios`)

### 3.4 Add RLS to Phase 3 Child Tables

- [ ] **`case_availability_slots`** (via `concierge_cases`)
- [ ] **`case_status_history`** (via `concierge_cases`)
- [ ] **`case_notes`** (via `concierge_cases`)
- [ ] **`case_attachments`** (via `concierge_cases`)
- [ ] **`case_participants`** (via `concierge_cases`)
- [ ] **`case_milestones`** (via `concierge_cases`)
- [ ] **`case_issues`** (via `concierge_cases`)
- [ ] **`case_communications`** (via `concierge_cases`)
- [ ] **`case_reviews`** (via `concierge_cases`)
- [ ] **`concierge_actions`** (via `concierge_cases`)
- [ ] **`concierge_action_logs`** (via `concierge_actions`)
- [ ] **`intent_notes`** (via `owner_intents`)
- [ ] **`vendor_candidates`** (has `organization_id`)
- [ ] **`vendor_bids`** (via `vendor_candidates`)
- [ ] **`external_hoa_approvals`** (via `external_hoa_contexts`)
- [ ] **`external_hoa_rules`** (via `external_hoa_contexts`)
- [ ] **`external_vendor_interactions`** (via `external_vendor_contexts`)
- [ ] **`delegated_authorities`** (via `property_ownerships`)

### 3.5 Testing

- [ ] Run migration in development
- [ ] Verify all queries still return expected data
- [ ] Test with multiple organizations
- [ ] Run migration in staging
- [ ] Production deployment

---

## Implementation Schedule

| Week | Workstream 1 | Workstream 2 | Workstream 3 |
|------|--------------|--------------|--------------|
| 1 | Audit & Fix routers | Create `withOrgContext` helper | Create migration |
| 2 | Testing & Verification | Update priority workflows | Test migration |
| 3 | - | Update remaining workflows | Deploy to staging |
| 4 | - | Testing & Rollout | Deploy to production |

**Note**: Workstream 1 (Defense in Depth) provides immediate protection and should be prioritized. Workstream 2 uses Option A (per-workflow fix) which aligns with existing DBOS patterns.

---

## Rollback Plan

### Workstream 1 (Defense in Depth)
- Revert individual router changes if issues found
- Low risk - additive changes only

### Workstream 2 (Transactional Context)
- Maintain backward compatibility during migration
- Can disable transactional mode via feature flag
- Revert middleware changes if deadlocks occur

### Workstream 3 (RLS Migration)
- Create corresponding rollback migration
- Test rollback in staging before production
- RLS policies can be dropped without data loss

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Dashboard zero-count incidents | Intermittent | 0 | Manual testing, monitoring |
| Tables with RLS | ~60 | ~80+ | Schema audit |
| Routers with explicit org filter | Partial | 100% | Code review |
| Concurrent request failures | Occasional | 0 | Load testing |

---

## Sign-Off Checklist

- [ ] All Workstream 1 tasks completed
- [ ] All Workstream 2 tasks completed
- [ ] All Workstream 3 tasks completed
- [ ] Full regression testing passed
- [ ] Performance benchmarks acceptable
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Deployed to production
- [ ] Monitoring confirmed stable
