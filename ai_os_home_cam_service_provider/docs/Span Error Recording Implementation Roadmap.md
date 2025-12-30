# Span Error Recording Implementation Roadmap

## Overview

This roadmap tracks the implementation progress of adding `recordSpanError()` calls to all error handling locations in the codebase.

**Reference**: See `docs/Span Error Recording Migration Guide.md` for detailed implementation patterns.

---

## Phase 1: Workflow Files

### Batch 1: Core Lifecycle Workflows (10 files)

- [x] `src/lib/server/workflows/caseLifecycleWorkflow.ts`
- [x] `src/lib/server/workflows/jobLifecycle.ts`
- [x] `src/lib/server/workflows/violationLifecycle.ts`
- [x] `src/lib/server/workflows/arcReviewLifecycle.ts`
- [x] `src/lib/server/workflows/meetingLifecycle.ts`
- [x] `src/lib/server/workflows/motionLifecycle.ts`
- [x] `src/lib/server/workflows/workOrderLifecycle.ts`
- [x] `src/lib/server/workflows/resolutionCloseout.ts`
- [x] `src/lib/server/workflows/resolutionCloseoutWorkflow.ts`
- [x] `src/lib/server/workflows/invoicePayment.ts`

**Status**: Complete  
**Completed**: 10/10

---

### Batch 2: Entity CRUD Workflows (15 files)

- [x] `src/lib/server/workflows/jobWorkflow.ts`
- [x] `src/lib/server/workflows/jobCreateWorkflow.ts`
- [x] `src/lib/server/workflows/violationWorkflow.ts`
- [x] `src/lib/server/workflows/violationCreateWorkflow.ts`
- [x] `src/lib/server/workflows/violationFineWorkflow.ts`
- [x] `src/lib/server/workflows/workOrderWorkflow.ts`
- [x] `src/lib/server/workflows/workOrderLineItemWorkflow.ts`
- [x] `src/lib/server/workflows/workOrderConfigWorkflow.ts`
- [x] `src/lib/server/workflows/documentWorkflow.ts`
- [x] `src/lib/server/workflows/staffWorkflow.ts`
- [x] `src/lib/server/workflows/technicianWorkflow.ts`
- [x] `src/lib/server/workflows/customerWorkflow.ts`
- [x] `src/lib/server/workflows/crudWorkflow.ts`
- [x] `src/lib/server/workflows/mediaWorkflow.ts`
- [x] `src/lib/server/workflows/communicationWorkflow.ts`

**Status**: Complete  
**Completed**: 15/15

---

### Batch 3: Billing & Estimate Workflows (8 files)

- [x] `src/lib/server/workflows/billingWorkflow.ts`
- [x] `src/lib/server/workflows/estimateWorkflow.ts`
- [x] `src/lib/server/workflows/estimateCreateWorkflow.ts`
- [x] `src/lib/server/workflows/estimateGeneration.ts`
- [x] `src/lib/server/workflows/invoiceCreateWorkflow.ts`
- [x] `src/lib/server/workflows/assessmentPosting.ts`
- [x] `src/lib/server/workflows/reserveWorkflow.ts`
- [x] `src/lib/server/workflows/pricebookWorkflow.ts`

**Status**: Complete  
**Completed**: 8/8

---

### Batch 4: Inventory & Purchase Workflows (8 files)

- [x] `src/lib/server/workflows/inventoryWorkflow.ts`
- [x] `src/lib/server/workflows/inventoryItemWorkflow.ts`
- [x] `src/lib/server/workflows/inventoryLocationWorkflow.ts`
- [x] `src/lib/server/workflows/purchaseOrderWorkflow.ts`
- [x] `src/lib/server/workflows/stockWorkflow.ts`
- [x] `src/lib/server/workflows/transferWorkflow.ts`
- [x] `src/lib/server/workflows/supplierWorkflow.ts`
- [x] `src/lib/server/workflows/usageWorkflow.ts`

**Status**: Complete  
**Completed**: 8/8

---

### Batch 5: Contract & Dispatch Workflows (8 files)

- [x] `src/lib/server/workflows/contractWorkflow.ts`
- [x] `src/lib/server/workflows/contractSLAWorkflow.ts`
- [x] `src/lib/server/workflows/maintenanceContract.ts`
- [x] `src/lib/server/workflows/dispatchWorkflow.ts`
- [x] `src/lib/server/workflows/dispatchAssignment.ts`
- [x] `src/lib/server/workflows/scheduleWorkflow.ts`
- [x] `src/lib/server/workflows/visitWorkflow.ts`
- [x] `src/lib/server/workflows/slaWorkflow.ts`

**Status**: Complete  
**Completed**: 8/8

---

### Batch 6: ARC & Compliance Workflows (6 files)

- [x] `src/lib/server/workflows/arcRequestWorkflow.ts`
- [x] `src/lib/server/workflows/arcReviewWorkflow.ts`
- [x] `src/lib/server/workflows/appealWorkflow.ts`
- [x] `src/lib/server/workflows/complianceWorkflow.ts`
- [x] `src/lib/server/workflows/noticeTemplateWorkflow.ts`
- [x] `src/lib/server/workflows/externalApprovalWorkflow.ts`

**Status**: Complete  
**Completed**: 6/6

---

### Batch 7: Contractor & Service Workflows (6 files)

- [x] `src/lib/server/workflows/contractorProfileWorkflow.ts`
- [x] `src/lib/server/workflows/contractorBranchWorkflow.ts`
- [x] `src/lib/server/workflows/contractorComplianceWorkflow.ts`
- [x] `src/lib/server/workflows/serviceCatalogWorkflow.ts`
- [x] `src/lib/server/workflows/serviceAreaWorkflow.ts`
- [x] `src/lib/server/workflows/vendorBidWorkflow.ts`

**Status**: Complete  
**Completed**: 6/6

---

### Batch 8: Concierge & Portal Workflows (4 files)

- [x] `src/lib/server/workflows/conciergeActionWorkflow.ts`
- [x] `src/lib/server/workflows/vendorCandidateWorkflow.ts`
- [x] `src/lib/server/workflows/ownerPortalWorkflow.ts`
- [x] `src/lib/server/workflows/checklistWorkflow.ts`

**Status**: Complete  
**Completed**: 4/4

---

### Batch 9: Governance Workflows (2 files)

- [x] `src/lib/server/workflows/governanceWorkflow.ts`
- [x] `src/lib/server/workflows/signatureWorkflow.ts`

**Status**: Complete  
**Completed**: 2/2

---

### Batch 10: Reporting & Dashboard Workflows (4 files)

- [x] `src/lib/server/workflows/reportDefinitionWorkflow.ts`
- [x] `src/lib/server/workflows/reportExecutionWorkflow.ts`
- [x] `src/lib/server/workflows/reportScheduleWorkflow.ts`
- [x] `src/lib/server/workflows/dashboardWorkflow.ts`

**Status**: Complete  
**Completed**: 4/4

---

### Batch 11: Miscellaneous Workflows (4 files)

- [x] `src/lib/server/workflows/timeEntryWorkflow.ts`
- [x] `src/lib/server/workflows/offlineSyncWorkflow.ts`
- [x] `src/lib/server/workflows/serviceCatalogWorkflow.ts`
- [x] `src/lib/server/workflows/signatureWorkflow.ts`

**Status**: Complete  
**Completed**: 4/4

---

## Phase 2: Route Files

### Route Files with Internal Try/Catch (6 files)

- [x] `src/lib/server/api/routes/accounting/payment.ts`
- [x] `src/lib/server/api/routes/accounting/assessment.ts`
- [x] `src/lib/server/api/routes/association.ts`
- [x] `src/lib/server/api/routes/concierge/conciergeCase.ts`
- [x] `src/lib/server/api/routes/document.ts`
- [x] `src/lib/server/api/routes/job/job.ts`

**Status**: Complete  
**Completed**: 6/6

---

## Phase 3: Authorization

### Cerbos Authorization (1 file)

- [x] `src/lib/server/cerbos/index.ts`

**Status**: Complete  
**Completed**: 1/1

---

## Phase 4: Verification

### Final Checks

- [x] Run `npm run check` - must pass with 0 errors
- [x] Run `npm run build` - must succeed
- [ ] Deploy to development environment
- [ ] Trigger test errors and verify in SigNoz:
  - [ ] Traces show `status: ERROR`
  - [ ] `exception.message` contains error message
  - [ ] `error.type` contains workflow/route-specific error type
  - [ ] `error.code` is populated

**Status**: In Progress

---

## Summary

| Phase | Category | Files | Completed |
|-------|----------|-------|-----------|
| 1.1 | Core Lifecycle Workflows | 10 | 10 |
| 1.2 | Entity CRUD Workflows | 15 | 15 |
| 1.3 | Billing & Estimate Workflows | 8 | 8 |
| 1.4 | Inventory & Purchase Workflows | 8 | 8 |
| 1.5 | Contract & Dispatch Workflows | 8 | 8 |
| 1.6 | ARC & Compliance Workflows | 6 | 6 |
| 1.7 | Contractor & Service Workflows | 6 | 6 |
| 1.8 | Concierge & Portal Workflows | 4 | 4 |
| 1.9 | Governance Workflows | 2 | 2 |
| 1.10 | Reporting & Dashboard Workflows | 4 | 4 |
| 1.11 | Miscellaneous Workflows | 4 | 4 |
| 2 | Route Files | 6 | 6 |
| 3 | Authorization | 1 | 1 |
| 4 | Verification | 4 | 2 |
| **Total** | | **86** | **84** |

---

## Notes

- Work through batches sequentially or in parallel as capacity allows
- After each batch, run `npm run check` to catch any issues early
- Mark items with `[x]` when complete
- Update batch status and completed counts as you progress
