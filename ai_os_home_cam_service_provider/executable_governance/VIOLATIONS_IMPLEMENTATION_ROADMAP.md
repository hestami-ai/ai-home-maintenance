# GOVERNANCE VIOLATIONS - IMPLEMENTATION ROADMAP

**Generated from:** mutations_final.json
**Analysis Date:** 2026-01-12
**Total Violations:** 444
- **R2** (Prisma outside workflows): 258 violations
- **R3 Input Schema** (missing idempotencyKey): 42 violations
- **R3 Workflow Mapping** (missing workflowID): 144 violations

---

## PART 1: R3 INPUT SCHEMA VIOLATIONS
### Missing idempotencyKey in Input Schemas

**Overview:**
- **Total:** 42 violations across 23 files in 17 directories
- **Fix:** Add `idempotencyKey: z.string().uuid()` to input schema for mutating oRPC handlers
- **Complexity:** LOW - Simple schema additions
- **Estimated Time:** 2-4 hours

### RECOMMENDED BATCHES

#### Batch 1: Work Order Domain
- **Violations:** 8
- **Files:** 3
- **Estimated Time:** 45 minutes
- **Priority:** HIGH (Work order is core functionality)

**Files:**
1. `src/lib/server/api/routes/workOrder/workOrder.ts` - 4 handlers (lines 199, 604, 1537, 1795)
2. `src/lib/server/api/routes/workOrder/asset.ts` - 3 handlers (lines 25, 321, 400)
3. `src/lib/server/api/routes/workOrder/bid.ts` - 1 handler (line 128)

#### Batch 2: Concierge Domain
- **Violations:** 4
- **Files:** 2
- **Estimated Time:** 30 minutes
- **Priority:** HIGH (Material decisions need idempotency)

**Files:**
1. `src/lib/server/api/routes/concierge/materialDecision.ts` - 3 handlers (lines 276, 345, 417)
2. `src/lib/server/api/routes/concierge/externalVendor.ts` - 1 handler (line 256)

#### Batch 3: Violation Domain
- **Violations:** 4
- **Files:** 2
- **Estimated Time:** 30 minutes
- **Priority:** MEDIUM

**Files:**
1. `src/lib/server/api/routes/violation/violation.ts` - 2 handlers (lines 213, 1184)
2. `src/lib/server/api/routes/violation/violationType.ts` - 2 handlers (lines 18, 252)

#### Batch 4: Core Entity Management
- **Violations:** 12
- **Files:** 4
- **Estimated Time:** 1 hour
- **Priority:** HIGH (Core entities)

**Files:**
1. `src/lib/server/api/routes/organization.ts` - 3 handlers (lines 32, 423, 498)
2. `src/lib/server/api/routes/party.ts` - 3 handlers (lines 16, 243, 308)
3. `src/lib/server/api/routes/property.ts` - 3 handlers (lines 16, 257, 327)
4. `src/lib/server/api/routes/unit.ts` - 3 handlers (lines 16, 246, 316)

#### Batch 5: Contractor Domain
- **Violations:** 3
- **Files:** 3
- **Estimated Time:** 30 minutes
- **Priority:** MEDIUM

**Files:**
1. `src/lib/server/api/routes/contractor/branch.ts` - 1 handler (line 56)
2. `src/lib/server/api/routes/contractor/insurance.ts` - 1 handler (line 64)
3. `src/lib/server/api/routes/contractor/license.ts` - 1 handler (line 50)

#### Batch 6: Remaining Single-File Updates
- **Violations:** 11
- **Files:** 9
- **Estimated Time:** 1.5 hours
- **Priority:** MEDIUM

**Files:**
1. `src/lib/server/api/routes/association.ts` - 2 handlers (lines 265, 402)
2. `src/lib/server/api/routes/ownership.ts` - 2 handlers (lines 17, 338)
3. `src/lib/server/api/routes/dispatch/sla.ts` - 1 handler (line 597)
4. `src/lib/server/api/routes/document.ts` - 1 handler (line 1054)
5. `src/lib/server/api/routes/documentProcessing.ts` - 1 handler (line 135)
6. `src/lib/server/api/routes/governance/boardMotion.ts` - 1 handler (line 235)
7. `src/lib/server/api/routes/report/dashboard.ts` - 1 handler (line 899)
8. `src/lib/server/api/routes/reserve.ts` - 1 handler (line 369)
9. `src/lib/server/api/routes/technician/technician.ts` - 1 handler (line 241)

---

## PART 2: R3 WORKFLOW MAPPING VIOLATIONS
### Missing workflowID Mapping

**Overview:**
- **Total:** 144 violations across 71 files in 4 directories
- **Fix:** Add `workflowID: idempotencyKey` to `DBOS.startWorkflow()` options
- **Complexity:** LOW - Simple parameter addition
- **Estimated Time:** 3-5 hours

### DIRECTORY BREAKDOWN
- **workflows:** 140 violations across 70 files
- **api/internal/tus-hook:** 2 violations across 1 file
- **association.ts:** 1 violation
- **concierge:** 1 violation

### RECOMMENDED APPROACH

**Strategy:** Bulk update all workflow files in a single batch
**Reason:** These are all mechanical changes - same fix pattern across all files
**Automation:** Consider creating a script to automate this fix

#### Batch 1: All Workflow Files
- **Violations:** 140
- **Files:** 70 workflow files in `src/lib/server/workflows/`
- **Estimated Time:** 3-4 hours
- **Priority:** HIGH
- **Note:** Most files have exactly 2 violations (duplicate line numbers suggest retry logic)

**Top Files by Violation Count:**
1. `documentWorkflow.ts` - 5 violations
2. `workOrderLineItemWorkflow.ts` - 4 violations
3. All others - 2 violations each

**Pattern:** Most workflow files have 2 violations at the same line number, indicating duplicate calls or retry logic.

**Automation Script Pattern:**
```typescript
// Find: DBOS.startWorkflow(ctx, workflow, {
// Add after options: workflowID: idempotencyKey
// OR
// Find: DBOS.startWorkflow(ctx, workflow, { ...options })
// Replace: DBOS.startWorkflow(ctx, workflow, { ...options, workflowID: idempotencyKey })
```

#### Batch 2: Route Files with Workflow Calls
- **Violations:** 4
- **Files:** 3
- **Estimated Time:** 15 minutes
- **Priority:** HIGH

**Files:**
1. `src/routes/api/internal/tus-hook/+server.ts` - lines 37, 37
2. `src/lib/server/api/routes/association.ts` - line 68
3. `src/lib/server/api/routes/concierge/conciergeCase.ts` - line 150

---

## PART 3: R2 VIOLATIONS
### Prisma Mutations Outside Workflows

**Overview:**
- **Total:** 258 violations across 54 files in 30 directories
- **Fix:** Move Prisma mutations into DBOS workflows
- **Complexity:** HIGH - Requires refactoring and workflow creation
- **Estimated Time:** 60-80 hours (8-10 weeks)

### HIGH-IMPACT FILES (5+ violations)

| File | Violations | Lines | Domain |
|------|-----------|-------|--------|
| `staff.ts` | 16 | 119, 429, 525, 626, 627, 645, 756, 859, 947, 1034, 1193, 1294, 1611, 1741, 1846, 1945 | Staff management |
| `conciergeCase.ts` | 15 | 524, 631, 715, 812, 907, 1067, 1235, 1377, 1432, 1487, 1554, 1619, 1731, 2104, 2170 | Concierge |
| `ownerPortal.ts` | 14 | 98, 204, 251, 356, 403, 500, 597, 838, 922, 1012, 1309, 1489, 1743, 1869 | Owner portal |
| `conciergeAction.ts` | 13 | 92, 107, 360, 368, 449, 459, 537, 545, 621, 626, 702, 710, 785 | Concierge |
| `workOrder.ts` | 13 | 326, 679, 779, 880, 996, 1091, 1238, 1358, 1485, 1495, 1594, 1706, 1881 | Work orders |
| `crossDomainIntegration.ts` | 12 | 127, 211, 274, 362, 471, 648, 921, 942, 1024, 1045, 1132, 1157 | API services |
| `rls.ts` | 10 | 28, 40, 41, 53, 56, 57, 110, 112, 123, 124 | Database security |
| `violation.ts` | 10 | 234, 631, 698, 786, 943, 1086, 1227, 1327, 1426, 1970 | Violations |
| `ownerIntent.ts` | 9 | 83, 389, 470, 550, 636, 722, 805, 884, 1015 | Concierge |
| `propertyOwnership.ts` | 9 | 117, 123, 501, 511, 580, 661, 671, 751, 757 | Concierge |
| `individualProperty.ts` | 7 | 124, 490, 577, 647, 696, 757, 770 | Concierge |
| `bid.ts` | 7 | 99, 101, 185, 194, 351, 468, 536 | Work orders |
| `externalHoa.ts` | 6 | 67, 307, 374, 454, 532, 586 | Concierge |
| `bankAccount.ts` | 6 | 91, 101, 353, 366, 437, 495 | Accounting |
| `asset.ts` | 6 | 102, 377, 444, 506, 507, 520 | Work orders |
| `organization.ts` | 6 | 126, 311, 312, 316, 459, 518 | Core entities |
| `portfolio.ts` | 5 | 53, 264, 328, 416, 494 | Concierge |
| `vendorBid.ts` | 5 | 167, 191, 362, 441, 534 | Vendor management |
| `document.ts` | 5 | 1085, 1346, 1382, 1427, 1725 | Documents |

### RECOMMENDED BATCHES

#### Batch 1: Infrastructure & Core Systems
- **Violations:** 18
- **Estimated Time:** 8-10 hours
- **Priority:** CRITICAL (affects all other domains)
- **Complexity:** HIGH (RLS, idempotency middleware)

**Directories:**
- `api/middleware` (5 violations)
  - `idempotency.ts` - 4 violations (lines 46, 79, 113, 136)
  - `activityEvent.ts` - 1 violation (line 180)
- `db` (10 violations)
  - `rls.ts` - 10 violations (lines 28, 40, 41, 53, 56, 57, 110, 112, 123, 124)
- `services` (1 violation)
  - `governanceActivityService.ts` - 1 violation (line 40)
- `api/services` (1 violation in counting - should be separate)
  - `crossDomainIntegration.ts` - 12 violations (lines 127, 211, 274, 362, 471, 648, 921, 942, 1024, 1045, 1132, 1157)
- `api/organization/switch` (1 violation)
  - `+server.ts` - 1 violation (line 28)

**Critical Notes:**
- RLS mutations must be addressed first as they affect security
- Idempotency middleware fixes will prevent cascading issues
- These changes impact all other domains

#### Batch 2: Concierge Domain
- **Violations:** 79
- **Files:** 11
- **Estimated Time:** 20-25 hours
- **Priority:** HIGH (largest domain)
- **Complexity:** HIGH (complex business logic)

**Files (sorted by violation count):**
1. `conciergeCase.ts` - 15 violations
2. `conciergeAction.ts` - 13 violations
3. `ownerIntent.ts` - 9 violations
4. `propertyOwnership.ts` - 9 violations
5. `individualProperty.ts` - 7 violations
6. `externalHoa.ts` - 6 violations
7. `portfolio.ts` - 5 violations
8. `externalVendor.ts` - 4 violations
9. `materialDecision.ts` - 4 violations
10. `propertyPortfolio.ts` - 4 violations
11. `delegatedAuthority.ts` - 3 violations

#### Batch 3: Accounting Domain
- **Violations:** 26
- **Files:** 8
- **Estimated Time:** 8-10 hours
- **Priority:** HIGH (financial transactions require idempotency)
- **Complexity:** MEDIUM-HIGH

**Files (sorted by violation count):**
1. `bankAccount.ts` - 6 violations (lines 91, 101, 353, 366, 437, 495)
2. `glService.ts` - 4 violations (lines 39, 167, 274, 374)
3. `apInvoice.ts` - 3 violations (lines 107, 382, 447)
4. `glAccount.ts` - 3 violations (lines 100, 368, 449)
5. `journalEntry.ts` - 3 violations (lines 111, 364, 469)
6. `vendor.ts` - 3 violations (lines 77, 332, 397)
7. `assessment.ts` - 2 violations (lines 103, 275)
8. `payment.ts` - 2 violations (lines 88, 407)

#### Batch 4: Work Order Domain
- **Violations:** 26
- **Files:** 3
- **Estimated Time:** 8-10 hours
- **Priority:** HIGH
- **Complexity:** MEDIUM-HIGH

**Files:**
1. `workOrder.ts` - 13 violations (lines 326, 679, 779, 880, 996, 1091, 1238, 1358, 1485, 1495, 1594, 1706, 1881)
2. `bid.ts` - 7 violations (lines 99, 101, 185, 194, 351, 468, 536)
3. `asset.ts` - 6 violations (lines 102, 377, 444, 506, 507, 520)

#### Batch 5: High-Impact Individual Files
- **Violations:** 30
- **Files:** 3
- **Estimated Time:** 10-12 hours
- **Priority:** HIGH
- **Complexity:** MEDIUM-HIGH

**Files:**
1. `staff.ts` - 16 violations (lines 119, 429, 525, 626, 627, 645, 756, 859, 947, 1034, 1193, 1294, 1611, 1741, 1846, 1945)
2. `ownerPortal.ts` - 14 violations (lines 98, 204, 251, 356, 403, 500, 597, 838, 922, 1012, 1309, 1489, 1743, 1869)
3. `violation.ts` - 10 violations (lines 234, 631, 698, 786, 943, 1086, 1227, 1327, 1426, 1970)

#### Batch 6: Medium-Impact Files (3-5 violations each)
- **Violations:** ~45
- **Files:** 12
- **Estimated Time:** 10-12 hours
- **Priority:** MEDIUM
- **Complexity:** MEDIUM

**Files:**
- `organization.ts` - 6 violations (lines 126, 311, 312, 316, 459, 518)
- `document.ts` - 5 violations (lines 1085, 1346, 1382, 1427, 1725)
- `vendorBid.ts` - 5 violations (lines 167, 191, 362, 441, 534)
- `vendorCandidate.ts` - 4 violations (lines 184, 369, 449, 509)
- `ownership.ts` - 4 violations (lines 78, 85, 319, 371)
- `idempotency.ts` - 4 violations (lines 46, 79, 113, 136)
- `materialDecision.ts` - 4 violations (lines 80, 311, 390, 440)
- `externalVendor.ts` - 4 violations (lines 67, 297, 368, 439)
- `propertyPortfolio.ts` - 4 violations (lines 55, 268, 337, 384)
- `party.ts` - 3 violations (lines 56, 289, 340)
- `property.ts` - 3 violations (lines 73, 307, 360)
- `unit.ts` - 3 violations (lines 66, 296, 349)

#### Batch 7: Low-Impact Files (1-2 violations each)
- **Violations:** ~35
- **Files:** ~20
- **Estimated Time:** 8-10 hours
- **Priority:** LOW-MEDIUM
- **Complexity:** LOW-MEDIUM

**Directories:**
- `governance` - 2 violations (boardMotion.ts, meeting.ts)
- `job` - 2 violations (job.ts)
- `caseCommunication.ts` - 2 violations (lines 156, 335)
- `caseReview.ts` - 2 violations (lines 135, 261)
- `violationType.ts` - 2 violations (lines 73, 307)
- `billing` - 3 violations total (estimate, invoice, proposal - 1 each)
- `compliance.ts` - 3 violations (lines 649, 709, 765)
- `contractor/compliance.ts` - 3 violations (lines 178, 245, 250)
- `association.ts` - 3 violations (lines 307, 366, 434)
- `delegatedAuthority.ts` - 3 violations (lines 110, 522, 594)
- `dispatch` - 1 violation (dispatch.ts line 775)
- `documentProcessing.ts` - 1 violation (line 150)
- `reserve.ts` - 1 violation (line 394)

---

## IMPLEMENTATION TIMELINE & RECOMMENDATIONS

### PHASE 1: Quick Wins (R3 Violations)
**Duration:** 1-2 weeks
**Effort:** 5-9 hours

#### Week 1: R3 Input Schema violations (42 violations)
- **Days 1-2:** Batches 1-3 (workOrder, concierge, violation) - 16 violations
- **Days 3-4:** Batches 4-5 (core entities, contractor) - 15 violations
- **Day 5:** Batch 6 (remaining files) - 11 violations

#### Week 2: R3 Workflow Mapping violations (144 violations)
- **Days 1-4:** All workflow files (consider automation) - 140 violations
- **Day 5:** Route files + testing - 4 violations

### PHASE 2: Deep Refactoring (R2 Violations)
**Duration:** 8-10 weeks
**Effort:** 60-80 hours

#### Week 1: Infrastructure & Core (Batch 1)
- **Critical:** RLS, idempotency middleware must be fixed first
- Sets foundation for all other fixes
- **Effort:** 8-10 hours

#### Weeks 2-4: Major Domains
- **Week 2-3:** Concierge Domain (Batch 2) - 20-25 hours
- **Week 4:** Accounting Domain (Batch 3) - 8-10 hours

#### Weeks 5-6: Work Orders & High-Impact Files
- **Week 5:** Work Order Domain (Batch 4) - 8-10 hours
- **Week 6:** High-impact individual files (Batch 5) - 10-12 hours

#### Weeks 7-10: Medium & Low Impact Files
- **Weeks 7-8:** Medium-impact files (Batch 6) - 10-12 hours
- **Weeks 9-10:** Low-impact files (Batch 7) - 8-10 hours

### TOTAL ESTIMATED EFFORT
- **Phase 1 (R3):** 5-9 hours = 1-2 weeks
- **Phase 2 (R2):** 60-80 hours = 8-10 weeks
- **Total:** 10-12 weeks for complete implementation

---

## RISK MITIGATION

1. **Start with infrastructure** (RLS, middleware) to prevent cascading issues
2. **Implement batches incrementally** with testing between each
3. **Consider feature flags** for gradual rollout
4. **Prioritize domains** with financial/legal implications (accounting, governance)
5. **Document workflow patterns** for consistency across refactoring
6. **Create comprehensive tests** before refactoring high-impact files
7. **Parallel work streams** possible for independent domains after infrastructure

---

## AUTOMATION OPPORTUNITIES

### 1. R3 Workflow Mapping (Highest ROI)
- **Script to add workflowID parameter** to all `DBOS.startWorkflow()` calls
- **Pattern:** `workflowID: idempotencyKey` or `workflowID: input.idempotencyKey`
- **Savings:** ~50% time reduction (from 5 hours to 2.5 hours)

### 2. R3 Input Schema (Medium ROI)
- **Script to detect mutating handlers** and add idempotencyKey
- **Pattern:** Look for oRPC handlers with mutations, add to input schema
- **Savings:** ~30% time reduction

### 3. R2 Violations (Low ROI, but helpful)
- **Generate workflow templates** based on mutation patterns
- **Identify common patterns** and create reusable workflow templates
- **Generate skeleton code** for workflow creation
- **Savings:** Reduces boilerplate, ensures consistency

---

## TESTING STRATEGY

### For R3 Violations
1. **Unit tests:** Verify idempotencyKey is present in schemas
2. **Integration tests:** Verify workflowID mapping works correctly
3. **Regression tests:** Ensure existing functionality unchanged

### For R2 Violations
1. **Before refactoring:** Create comprehensive tests for existing behavior
2. **After refactoring:** Verify workflows maintain same behavior
3. **Idempotency tests:** Verify duplicate calls are handled correctly
4. **Performance tests:** Ensure workflow overhead is acceptable
5. **Rollback plan:** Feature flags to disable workflows if issues arise

---

## SUCCESS METRICS

- **All 444 violations resolved**
- **Zero regression in functionality**
- **Improved system reliability** through workflow durability
- **Idempotent operations** for all mutations
- **Documentation** of workflow patterns
- **Automated tests** for governance rules

---

## DEPENDENCIES & PREREQUISITES

1. **DBOS properly configured** and tested
2. **Workflow infrastructure stable**
3. **Testing environment** ready for incremental validation
4. **Team training** on workflow patterns
5. **Code review process** for workflow changes
6. **Monitoring/logging** for workflow execution

---

## NEXT STEPS

1. **Review and approve roadmap** with stakeholders
2. **Set up automation scripts** for R3 violations
3. **Create workflow templates** for common patterns
4. **Assign batches** to team members
5. **Establish testing protocols**
6. **Begin Phase 1** with R3 violations

---

## APPENDIX: Complete File Listings by Batch

### R3 Input Schema - Complete List

**workOrder (8 violations):**
- src/lib/server/api/routes/workOrder/workOrder.ts: 199, 604, 1537, 1795
- src/lib/server/api/routes/workOrder/asset.ts: 25, 321, 400
- src/lib/server/api/routes/workOrder/bid.ts: 128

**concierge (4 violations):**
- src/lib/server/api/routes/concierge/materialDecision.ts: 276, 345, 417
- src/lib/server/api/routes/concierge/externalVendor.ts: 256

**violation (4 violations):**
- src/lib/server/api/routes/violation/violation.ts: 213, 1184
- src/lib/server/api/routes/violation/violationType.ts: 18, 252

**Core Entities (12 violations):**
- src/lib/server/api/routes/organization.ts: 32, 423, 498
- src/lib/server/api/routes/party.ts: 16, 243, 308
- src/lib/server/api/routes/property.ts: 16, 257, 327
- src/lib/server/api/routes/unit.ts: 16, 246, 316

**contractor (3 violations):**
- src/lib/server/api/routes/contractor/branch.ts: 56
- src/lib/server/api/routes/contractor/insurance.ts: 64
- src/lib/server/api/routes/contractor/license.ts: 50

**Remaining (11 violations):**
- src/lib/server/api/routes/association.ts: 265, 402
- src/lib/server/api/routes/ownership.ts: 17, 338
- src/lib/server/api/routes/dispatch/sla.ts: 597
- src/lib/server/api/routes/document.ts: 1054
- src/lib/server/api/routes/documentProcessing.ts: 135
- src/lib/server/api/routes/governance/boardMotion.ts: 235
- src/lib/server/api/routes/report/dashboard.ts: 899
- src/lib/server/api/routes/reserve.ts: 369
- src/lib/server/api/routes/technician/technician.ts: 241

### R3 Workflow Mapping - Top Files (140 violations in workflows/)

Files with 5+ violations:
- documentWorkflow.ts: 5 violations

Files with 4 violations:
- workOrderLineItemWorkflow.ts: 4 violations

All remaining 68 files: 2 violations each (typically duplicate line numbers)

Route files (4 violations):
- src/routes/api/internal/tus-hook/+server.ts: 37, 37
- src/lib/server/api/routes/association.ts: 68
- src/lib/server/api/routes/concierge/conciergeCase.ts: 150