# cam.ts Refactoring Roadmap

## Overview

This document tracks the refactoring of `src/lib/api/cam.ts` to follow the proper type generation pipeline:

```
Prisma Schema → Zod Schemas → oRPC → OpenAPI → types.generated.ts → API Clients
```

**Current State:**
- File size: ~2,400 lines
- Uses legacy `apiCall` from `client.ts` (165 references)
- Manually defines ~50+ interfaces/types
- Consumed by 80+ Svelte components

**Target State:**
- Use `orpc` client for all API calls
- Extract all types from `types.generated.ts`
- Remove dependency on `client.ts`
- Maintain backward compatibility for consumers

---

## Phase 1: Type Extraction (Foundation)

Replace manually defined types with types extracted from `types.generated.ts`.

### 1.1 Core Entity Types
- [ ] `Violation` → Extract from `operations['violation.list']`
- [ ] `ViolationDetail` → Extract from `operations['violation.get']`
- [ ] `ViolationType` → Extract from `operations['violationType.list']`
- [ ] `ARCRequest` → Extract from `operations['arcRequest.get']`
- [ ] `WorkOrder` → Extract from `operations['workOrder.get']`
- [ ] `Unit` → Extract from `operations['unit.get']`
- [ ] `Property` → Extract from `operations['property.get']`
- [ ] `Vendor` → Extract from `operations['vendor.get']`
- [ ] `Association` → Extract from `operations['association.get']`
- [ ] `Document` → Extract from `operations['document.get']`
- [ ] `DocumentDetail` → Extract from `operations['document.get']`

### 1.2 Governance Types (Phase 11)
- [ ] `Meeting` → Extract from governance operations
- [ ] `MeetingAgendaItem` → Extract from governance operations
- [ ] `MeetingAttendance` → Extract from governance operations
- [ ] `MeetingMinutes` → Extract from governance operations
- [ ] `BoardMotion` → Extract from `operations['boardMotion.get']`
- [ ] `Vote` → Extract from governance operations
- [ ] `VoteBallot` → Extract from governance operations
- [ ] `Resolution` → Extract from `operations['governanceResolution.getResolution']`
- [ ] `MeetingType`, `MeetingStatus`, `MeetingAttendanceStatus` enums
- [ ] `BoardMotionStatus`, `VoteChoice`, `ResolutionStatus` enums

### 1.3 Concierge Types (Phase 13)
- [ ] `ConciergeCase` → Extract from `operations['concierge/case.get']`
- [ ] `ConciergeCaseDetail` → Extract from `operations['concierge/case.getDetail']`
- [ ] `CaseNote` → Extract from case operations
- [ ] `CaseStatusHistoryItem` → Extract from case operations
- [ ] `CaseParticipant` → Extract from case operations
- [ ] `CaseAction`, `CaseDecision`, `CaseAttachment` → Extract from case operations
- [ ] `ConciergeCaseStatus`, `ConciergeCasePriority`, `CaseNoteType` enums

### 1.4 Job/Billing Types (Phase 15)
- [ ] `Job` → Extract from `operations['job.get']`
- [ ] `JobNote` → Extract from job operations
- [ ] `JobStatusHistoryItem` → Extract from job operations
- [ ] `Estimate`, `EstimateLine` → Extract from billing operations
- [ ] `JobInvoice`, `InvoiceLine`, `InvoicePayment` → Extract from billing operations
- [ ] `Technician` → Extract from technician operations
- [ ] `JobDocument` → Extract from job document operations
- [ ] `JobStatus`, `JobSourceType`, `EstimateStatus`, `InvoiceStatus` enums

### 1.5 Dashboard Types
- [x] `DashboardData` → Already extracted from `types.generated.ts`
- [x] `DashboardFilters` → Already extracted
- [x] `DashboardRequiresAction`, etc. → Already extracted

---

## Phase 2: API Function Migration

Convert each API object from `apiCall` to `orpc`.

### 2.1 Violation APIs
- [ ] `violationApi.list` → `orpc.violation.list`
- [ ] `violationApi.get` → `orpc.violation.get`
- [ ] `violationApi.create` → `orpc.violation.create`
- [ ] `violationApi.update` → `orpc.violation.update`
- [ ] `violationApi.changeStatus` → `orpc.violation.changeStatus`
- [ ] `violationApi.sendNotice` → `orpc.violation.sendNotice`
- [ ] `violationApi.scheduleHearing` → `orpc.violation.scheduleHearing`
- [ ] `violationApi.assessFine` → `orpc.violation.assessFine`
- [ ] `violationApi.getNotices` → `orpc.violation.getNotices`
- [ ] `violationApi.getResponses` → `orpc.violation.getResponses`
- [ ] `violationApi.recordAction` → `orpc.violation.recordAction`
- [ ] `violationApi.fileAppeal` → `orpc.violation.fileAppeal`
- [ ] `violationApi.authorizeRemediation` → `orpc.violation.authorizeRemediation`
- [ ] `violationApi.getResponse` → `orpc.violation.getResponse`
- [ ] `violationApi.acknowledgeResponse` → `orpc.violation.acknowledgeResponse`

### 2.2 Violation Type APIs
- [ ] `violationTypeApi.list` → `orpc.violationType.list`
- [ ] `violationTypeApi.get` → `orpc.violationType.get`

### 2.3 ARC Request APIs
- [ ] `arcRequestApi.list` → `orpc.arcRequest.list`
- [ ] `arcRequestApi.get` → `orpc.arcRequest.get`
- [ ] `arcRequestApi.create` → `orpc.arcRequest.create`
- [ ] `arcRequestApi.getPriorPrecedents` → `orpc.arcRequest.getPriorPrecedents`
- [ ] `arcRequestApi.recordDecision` → `orpc.arcRequest.recordDecision`
- [ ] `arcRequestApi.requestInfo` → `orpc.arcRequest.requestInfo`
- [ ] `arcRequestApi.submitInfo` → `orpc.arcRequest.submitInfo`

### 2.4 ARC Review APIs
- [ ] `arcReviewApi.getVotes` → `orpc.arcReview.getVotes`
- [ ] `arcReviewApi.getCommitteeForRequest` → `orpc.arcReview.getCommitteeForRequest`
- [ ] `arcReviewApi.submitReview` → `orpc.arcReview.submitReview`
- [ ] `arcReviewApi.recordDecision` → `orpc.arcReview.recordDecision`

### 2.5 Work Order APIs
- [ ] `workOrderApi.list` → `orpc.workOrder.list`
- [ ] `workOrderApi.get` → `orpc.workOrder.get`
- [ ] `workOrderApi.create` → `orpc.workOrder.create`
- [ ] `workOrderApi.update` → `orpc.workOrder.update`
- [ ] `workOrderApi.assign` → `orpc.workOrder.assign`
- [ ] `workOrderApi.schedule` → `orpc.workOrder.schedule`
- [ ] `workOrderApi.complete` → `orpc.workOrder.complete`

### 2.6 Unit APIs
- [ ] `unitApi.list` → `orpc.unit.list`
- [ ] `unitApi.get` → `orpc.unit.get`
- [ ] `unitApi.create` → `orpc.unit.create`
- [ ] `unitApi.update` → `orpc.unit.update`

### 2.7 Property APIs
- [ ] `propertyApi.list` → `orpc.property.list`
- [ ] `propertyApi.get` → `orpc.property.get`
- [ ] `propertyApi.create` → `orpc.property.create`
- [ ] `propertyApi.update` → `orpc.property.update`

### 2.8 Vendor APIs
- [ ] `vendorApi.list` → `orpc.vendor.list`
- [ ] `vendorApi.get` → `orpc.vendor.get`
- [ ] `vendorApi.create` → `orpc.vendor.create`
- [ ] `vendorApi.update` → `orpc.vendor.update`
- [ ] `vendorApi.updateStatus` → `orpc.vendor.updateStatus`

### 2.9 Association APIs
- [ ] `associationApi.list` → `orpc.association.list`
- [ ] `associationApi.get` → `orpc.association.get`
- [ ] `associationApi.update` → `orpc.association.update`

### 2.10 Document APIs
- [ ] `documentApi.list` → `orpc.document.list`
- [ ] `documentApi.get` → `orpc.document.get`
- [ ] `documentApi.classify` → `orpc.document.classifyDocument`
- [ ] `documentApi.linkToContext` → `orpc.document.linkToContext`
- [ ] `documentApi.unlinkFromContext` → `orpc.document.unlinkFromContext`
- [ ] `documentApi.getReferences` → `orpc.document.getReferences`
- [ ] `documentApi.getActivityHistory` → `orpc.document.getActivityHistory`
- [ ] `documentApi.getVersions` → `orpc.document.getVersions`

### 2.11 Activity Event APIs (in cam.ts)
- [ ] `activityEventApi.list` → Remove (duplicate of `src/lib/api/activityEvent.ts`)

### 2.12 Governance APIs
- [ ] `governanceApi.boards.list` → `orpc.governanceBoard.list`
- [ ] `governanceApi.policies.list` → `orpc.governancePolicy.list`
- [ ] `governanceApi.meetings.*` → `orpc.governanceMeeting.*` (15+ methods)
- [ ] `governanceApi.resolutions.*` → `orpc.governanceResolution.*` (6 methods)
- [ ] `governanceApi.motions.*` → `orpc.boardMotion.*` (12 methods)

### 2.13 Report APIs
- [ ] `reportApi.definitions.list` → `orpc.reportDefinition.list`
- [ ] `reportApi.definitions.get` → `orpc.reportDefinition.get`
- [ ] `reportApi.execute` → `orpc.report.execute`
- [ ] `reportApi.schedule` → `orpc.report.schedule`

### 2.14 Accounting APIs
- [ ] `accountingApi.assessments.list` → `orpc.accounting.assessments.list`
- [ ] `accountingApi.payables.list` → `orpc.accounting.payables.list`
- [ ] `accountingApi.receivables.list` → `orpc.accounting.receivables.list`
- [ ] `accountingApi.gl.accounts` → `orpc.accounting.gl.accounts`
- [ ] `accountingApi.gl.journal` → `orpc.accounting.gl.journal`

### 2.15 Dashboard APIs
- [ ] `dashboardApi.getData` → `orpc.dashboard.getData`
- [ ] `dashboardApi.recordView` → `orpc.dashboard.recordView`
- [ ] `dashboardApi.getSummary` → `orpc.dashboard.getSummary`

### 2.16 Badge Count APIs
- [ ] `badgeCountApi.get` → `orpc.cam.getBadgeCounts`

### 2.17 Concierge Case APIs
- [ ] `conciergeCaseApi.list` → `orpc.concierge.case.list`
- [ ] `conciergeCaseApi.get` → `orpc.concierge.case.get`
- [ ] `conciergeCaseApi.getDetail` → `orpc.concierge.case.getDetail`
- [ ] `conciergeCaseApi.create` → `orpc.concierge.case.create`
- [ ] `conciergeCaseApi.updateStatus` → `orpc.concierge.case.updateStatus`
- [ ] `conciergeCaseApi.assign` → `orpc.concierge.case.assign`
- [ ] `conciergeCaseApi.resolve` → `orpc.concierge.case.resolve`
- [ ] `conciergeCaseApi.close` → `orpc.concierge.case.close`
- [ ] `conciergeCaseApi.cancel` → `orpc.concierge.case.cancel`
- [ ] `conciergeCaseApi.addNote` → `orpc.concierge.case.addNote`
- [ ] `conciergeCaseApi.listNotes` → `orpc.concierge.case.listNotes`
- [ ] `conciergeCaseApi.requestClarification` → `orpc.concierge.case.requestClarification`
- [ ] `conciergeCaseApi.respondToClarification` → `orpc.concierge.case.respondToClarification`
- [ ] `conciergeCaseApi.linkToArc` → `orpc.concierge.case.linkToArc`
- [ ] `conciergeCaseApi.linkToWorkOrder` → `orpc.concierge.case.linkToWorkOrder`
- [ ] `conciergeCaseApi.linkToUnit` → `orpc.concierge.case.linkToUnit`
- [ ] `conciergeCaseApi.linkToJob` → `orpc.concierge.case.linkToJob`
- [ ] `conciergeCaseApi.getStatusHistory` → `orpc.concierge.case.getStatusHistory`
- [ ] `conciergeCaseApi.addParticipant` → `orpc.concierge.case.addParticipant`
- [ ] `conciergeCaseApi.listParticipants` → `orpc.concierge.case.listParticipants`
- [ ] `conciergeCaseApi.removeParticipant` → `orpc.concierge.case.removeParticipant`
- [ ] `conciergeCaseApi.listConcierges` → `orpc.concierge.case.listConcierges`

### 2.18 Job APIs
- [ ] `jobApi.list` → `orpc.job.list`
- [ ] `jobApi.get` → `orpc.job.get`
- [ ] `jobApi.create` → `orpc.job.create`
- [ ] `jobApi.update` → `orpc.job.update`
- [ ] `jobApi.transitionStatus` → `orpc.job.transitionStatus`
- [ ] `jobApi.assignTechnician` → `orpc.job.assignTechnician`
- [ ] `jobApi.schedule` → `orpc.job.schedule`
- [ ] `jobApi.getStatusHistory` → `orpc.job.getStatusHistory`
- [ ] `jobApi.addNote` → `orpc.job.addNote`
- [ ] `jobApi.listNotes` → `orpc.job.listNotes`
- [ ] `jobApi.delete` → `orpc.job.delete`

### 2.19 Estimate APIs
- [ ] `estimateApi.list` → `orpc.billing.estimate.list`
- [ ] `estimateApi.get` → `orpc.billing.estimate.get`
- [ ] `estimateApi.create` → `orpc.billing.estimate.create`
- [ ] `estimateApi.update` → `orpc.billing.estimate.update`
- [ ] `estimateApi.addLine` → `orpc.billing.estimate.addLine`
- [ ] `estimateApi.removeLine` → `orpc.billing.estimate.removeLine`
- [ ] `estimateApi.send` → `orpc.billing.estimate.send`
- [ ] `estimateApi.accept` → `orpc.billing.estimate.accept`
- [ ] `estimateApi.decline` → `orpc.billing.estimate.decline`
- [ ] `estimateApi.revise` → `orpc.billing.estimate.revise`

### 2.20 Invoice APIs
- [ ] `invoiceApi.list` → `orpc.billing.invoice.list`
- [ ] `invoiceApi.get` → `orpc.billing.invoice.get`
- [ ] `invoiceApi.createFromEstimate` → `orpc.billing.invoice.createFromEstimate`
- [ ] `invoiceApi.create` → `orpc.billing.invoice.create`
- [ ] `invoiceApi.send` → `orpc.billing.invoice.send`
- [ ] `invoiceApi.recordPayment` → `orpc.billing.invoice.recordPayment`
- [ ] `invoiceApi.void` → `orpc.billing.invoice.void`
- [ ] `invoiceApi.getPayments` → `orpc.billing.invoice.getPayments`

### 2.21 Technician APIs
- [ ] `technicianApi.list` → `orpc.contractor.technician.list`
- [ ] `technicianApi.get` → `orpc.contractor.technician.get`

### 2.22 Job Document APIs
- [ ] `jobDocumentApi.listForJob` → `orpc.job.listDocuments`
- [ ] `jobDocumentApi.upload` → `orpc.job.uploadDocument`
- [ ] `jobDocumentApi.delete` → `orpc.job.deleteDocument`

### 2.23 Helper Functions
- [ ] `fetchBadgeCounts` → Already uses `orpc` (verify and clean up)

---

## Phase 3: Consumer Updates

Update components that consume `cam.ts` APIs to handle the new response format.

**Key Changes:**
1. Remove `organizationId` parameter from API calls (oRPC handles via header)
2. Update error handling (oRPC throws on error, no `response.error`)
3. Update type imports if interface names change

### 3.1 High-Priority Components (Core CAM Features)
- [ ] `src/routes/app/cam/+page.svelte` (Dashboard)
- [ ] `src/routes/app/cam/violations/+page.svelte`
- [ ] `src/routes/app/cam/violations/[id]/+page.svelte`
- [ ] `src/routes/app/cam/arc/+page.svelte`
- [ ] `src/routes/app/cam/arc/[id]/+page.svelte`
- [ ] `src/routes/app/cam/work-orders/+page.svelte`
- [ ] `src/routes/app/cam/work-orders/[id]/+page.svelte`

### 3.2 Property & Unit Management
- [ ] `src/routes/app/cam/properties/+page.svelte`
- [ ] `src/routes/app/cam/properties/[id]/+page.svelte`
- [ ] `src/routes/app/cam/units/+page.svelte`
- [ ] `src/routes/app/cam/units/[id]/+page.svelte`

### 3.3 Governance Components
- [ ] `src/routes/app/cam/governance/board/+page.svelte`
- [ ] `src/routes/app/cam/governance/meetings/+page.svelte`
- [ ] `src/routes/app/cam/governance/policies/+page.svelte`
- [ ] `src/routes/app/cam/governance/resolutions/+page.svelte`

### 3.4 Concierge Components
- [ ] `src/routes/app/admin/cases/+page.svelte`
- [ ] `src/routes/app/admin/cases/[id]/+page.svelte`
- [ ] `src/lib/components/cam/concierge/*.svelte` (14 components)

### 3.5 Dashboard Components
- [ ] `src/lib/components/cam/dashboard/*.svelte` (4 components)

### 3.6 Other Components
- [ ] `src/routes/app/cam/documents/+page.svelte`
- [ ] `src/routes/app/cam/reports/+page.svelte`
- [ ] `src/routes/app/cam/accounting/*.svelte` (4 pages)
- [ ] `src/routes/app/cam/associations/*.svelte` (3 pages)

---

## Phase 4: Cleanup

### 4.1 Remove Legacy Code
- [ ] Remove `import { apiCall } from './client'` from `cam.ts`
- [ ] Delete `src/lib/api/client.ts` (after all consumers migrated)
- [ ] Remove duplicate `activityEventApi` from `cam.ts`

### 4.2 Update Exports
- [ ] Update `src/lib/api/index.ts` to export new types if needed
- [ ] Ensure backward compatibility for type exports

### 4.3 Verification
- [ ] Run `npm run check` - 0 errors
- [ ] Run `npm run build` - successful
- [ ] Manual testing of key flows

---

## Recommended Approach

### Option A: Incremental Migration (Recommended)
Migrate one API group at a time, testing after each:
1. Start with simpler APIs (Unit, Property, Association)
2. Move to medium complexity (Violation, ARC, WorkOrder)
3. Finish with complex APIs (Governance, Concierge, Job)

**Pros:** Lower risk, easier to debug, can be done incrementally
**Cons:** Longer timeline, temporary mixed patterns

### Option B: Big Bang Migration
Migrate all at once in a single PR.

**Pros:** Clean cutover, no mixed patterns
**Cons:** High risk, harder to debug, requires significant testing

---

## Estimated Effort

| Phase | Items | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Type Extraction | ~50 types | 4-6 hours |
| Phase 2: API Migration | ~165 API calls | 8-12 hours |
| Phase 3: Consumer Updates | ~80 components | 6-10 hours |
| Phase 4: Cleanup | - | 1-2 hours |
| **Total** | | **19-30 hours** |

---

## Notes

- Dashboard types are already correctly extracted (Phase 12 work)
- `fetchBadgeCounts` already uses `orpc` - just needs cleanup
- Some oRPC routes may not exist yet - verify before migrating
- Run `npm run openapi:generate && npm run types:generate` before starting to ensure types are current
