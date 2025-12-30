# oRPC Error Handling Migration - Implementation Roadmap

**Related Document**: [oRPC Error Handling Migration Guide](./oRPC%20Error%20Handling%20Migration%20Guide.md)

**Objective**: Migrate all oRPC procedure handlers from `ApiException` (and any existing `ORPCError` direct usage) to the type-safe `.errors()` approach for proper error handling and observability.

---

## Phase 1: Infrastructure & Foundation

**Goal**: Update core infrastructure to support type-safe errors

### 1.1 Update Base Procedures in router.ts
- [ ] Add `.errors()` definitions to `authedProcedure`
- [ ] Add `.errors()` definitions to `orgProcedure`
- [ ] Add `.errors()` definitions to `adminProcedure`
- [ ] Update middleware to use `errors` helper instead of `ApiException`
- [ ] Verify TypeScript compilation passes
- [ ] Test authentication/authorization error responses

### 1.2 Update Cerbos Integration
- [ ] Review `src/lib/server/cerbos/index.ts` for `ApiException` usage
- [ ] Update `requireAuthorization` to integrate with oRPC error system
- [ ] Test authorization denial responses

### 1.3 Update Logging Infrastructure
- [ ] Update `src/routes/api/v1/rpc/[...rest]/+server.ts` with enhanced error extraction
- [ ] Verify structured error fields appear in logs
- [ ] Test OpenTelemetry trace attributes

---

## Phase 2: High Priority Files (82-27 usages)

**Goal**: Migrate the 10 most affected files first

### 2.1 workOrder/workOrder.ts (82 usages)
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [ ] Replace all `ApiException` calls
- [ ] Replace any `ORPCError` direct usage
- [ ] Remove `ApiException` import
- [ ] Verify TypeScript compilation
- [ ] Test error responses

### 2.2 governance/meeting.ts (45 usages)
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [ ] Replace all `ApiException` calls
- [ ] Replace any `ORPCError` direct usage
- [ ] Remove `ApiException` import
- [ ] Verify TypeScript compilation
- [ ] Test error responses

### 2.3 governance/boardMotion.ts (41 usages)
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [ ] Replace all `ApiException` calls
- [ ] Replace any `ORPCError` direct usage
- [ ] Remove `ApiException` import
- [ ] Verify TypeScript compilation
- [ ] Test error responses

### 2.4 billing/estimate.ts (32 usages)
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [ ] Replace all `ApiException` calls
- [ ] Replace any `ORPCError` direct usage
- [ ] Remove `ApiException` import
- [ ] Verify TypeScript compilation
- [ ] Test error responses

### 2.5 concierge/conciergeCase.ts (32 usages) - PARTIALLY COMPLETE
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [x] Replace all `ApiException` calls (done with ORPCError)
- [ ] Migrate `ORPCError` direct usage to type-safe `errors`
- [ ] Remove `ORPCError` import after migration
- [ ] Verify TypeScript compilation
- [ ] Test error responses

### 2.6 violation/violation.ts (32 usages)
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [ ] Replace all `ApiException` calls
- [ ] Replace any `ORPCError` direct usage
- [ ] Remove `ApiException` import
- [ ] Verify TypeScript compilation
- [ ] Test error responses

### 2.7 ownerPortal.ts (31 usages)
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [ ] Replace all `ApiException` calls
- [ ] Replace any `ORPCError` direct usage
- [ ] Remove `ApiException` import
- [ ] Verify TypeScript compilation
- [ ] Test error responses

### 2.8 inventory/purchaseOrder.ts (29 usages)
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [ ] Replace all `ApiException` calls
- [ ] Replace any `ORPCError` direct usage
- [ ] Remove `ApiException` import
- [ ] Verify TypeScript compilation
- [ ] Test error responses

### 2.9 job/job.ts (27 usages)
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [ ] Replace all `ApiException` calls
- [ ] Replace any `ORPCError` direct usage
- [ ] Remove `ApiException` import
- [ ] Verify TypeScript compilation
- [ ] Test error responses

### 2.10 technician/technician.ts (27 usages)
- [ ] Add `.errors()` blocks to all procedures
- [ ] Update handler signatures to include `errors`
- [ ] Replace all `ApiException` calls
- [ ] Replace any `ORPCError` direct usage
- [ ] Remove `ApiException` import
- [ ] Verify TypeScript compilation
- [ ] Test error responses

---

## Phase 3: Medium Priority Files (26-15 usages)

**Goal**: Migrate files with 15-26 usages

### 3.1 Communication & Documents
- [ ] communication/communication.ts (26 usages)
- [ ] document.ts (26 usages)

### 3.2 Contracts
- [ ] contract/serviceContract.ts (26 usages)
- [ ] contract/visit.ts (21 usages)

### 3.3 Staff & Pricebook
- [ ] staff.ts (25 usages)
- [ ] pricebook/pricebook.ts (24 usages)

### 3.4 ARC & Billing
- [ ] arc/request.ts (23 usages)
- [ ] billing/invoice.ts (23 usages)
- [ ] billing/proposal.ts (20 usages)
- [ ] billing/payment.ts (18 usages)

### 3.5 Work Orders & Governance
- [ ] workOrder/bid.ts (20 usages)
- [ ] governance/resolution.ts (19 usages)

### 3.6 Concierge & Reserve
- [ ] concierge/ownerIntent.ts (18 usages)
- [ ] reserve.ts (18 usages)

### 3.7 Accounting & Dispatch
- [ ] accounting/glAccount.ts (17 usages)
- [ ] dispatch/dispatch.ts (16 usages)
- [ ] dispatch/sla.ts (16 usages)

---

## Phase 4: Lower Priority Files (< 15 usages)

**Goal**: Complete migration of remaining 68 files

### 4.1 Accounting Module
- [ ] accounting/apInvoice.ts (14 usages)
- [ ] accounting/bankAccount.ts (14 usages)
- [ ] accounting/journalEntry.ts (14 usages)
- [ ] accounting/assessment.ts (10 usages)
- [ ] accounting/vendor.ts (10 usages)
- [ ] accounting/payment.ts (9 usages)

### 4.2 Inventory Module
- [ ] inventory/transfer.ts (14 usages)
- [ ] inventory/location.ts (9 usages)

### 4.3 Work Order Module
- [ ] workOrder/asset.ts (14 usages)

### 4.4 Compliance
- [ ] compliance.ts (14 usages)

### 4.5 Concierge Module
- [ ] concierge/conciergeAction.ts (13 usages)
- [ ] concierge/delegatedAuthority.ts (13 usages)
- [ ] concierge/propertyOwnership.ts (13 usages)
- [ ] concierge/portfolio.ts (10 usages)
- [ ] concierge/individualProperty.ts (8 usages)

### 4.6 Field Tech Module
- [ ] fieldTech/media.ts (12 usages)
- [ ] fieldTech/timeEntry.ts (11 usages)
- [ ] fieldTech/checklist.ts (10 usages)
- [ ] fieldTech/offlineSync.ts (9 usages)

### 4.7 ARC Module
- [ ] arc/review.ts (11 usages)

### 4.8 Contract Module
- [ ] contract/schedule.ts (11 usages)

### 4.9 Governance Module
- [ ] governance/board.ts (9 usages)

### 4.10 Vendor
- [ ] vendorBid.ts (10 usages)

### 4.11 Remaining Files
- [ ] All other files with < 9 usages (approximately 48 files)

---

## Phase 5: Verification & Cleanup

**Goal**: Ensure complete migration and clean up

### 5.1 Verification
- [ ] Run PowerShell search to confirm no `ApiException` usage remains in routes
  ```powershell
  Get-ChildItem -Path src/lib/server/api/routes -Recurse -Filter "*.ts" | Select-String -Pattern "ApiException\."
  ```
- [ ] Run PowerShell search to confirm no direct `ORPCError` usage remains
  ```powershell
  Get-ChildItem -Path src/lib/server/api/routes -Recurse -Filter "*.ts" | Select-String -Pattern "new ORPCError"
  ```
- [ ] Full TypeScript compilation check: `npx tsc --noEmit --skipLibCheck`
- [ ] Review OpenTelemetry traces for proper error codes
- [ ] Review logs for structured error information

### 5.2 Cleanup
- [ ] Remove unused `ApiException` imports from all files
- [ ] Remove unused `ORPCError` imports from all files
- [ ] Consider deprecating `ApiException` class or marking for non-oRPC use only
- [ ] Update any documentation referencing old error patterns

### 5.3 Testing
- [ ] Run full test suite
- [ ] Manual testing of critical error paths
- [ ] Verify 4xx errors no longer appear as 500s in monitoring

---

## Progress Tracking

### Overall Status

| Phase | Status | Files Complete | Files Total |
|-------|--------|----------------|-------------|
| Phase 1: Infrastructure | Not Started | 0 | 3 |
| Phase 2: High Priority | In Progress | 0 | 10 |
| Phase 3: Medium Priority | Not Started | 0 | 17 |
| Phase 4: Lower Priority | Not Started | 0 | 68+ |
| Phase 5: Verification | Not Started | 0 | N/A |

### Key Metrics

- **Total ApiException usages at start**: 1169
- **Total files to migrate**: 85+
- **Files completed**: 0 (conciergeCase.ts partially done)
- **Current ApiException count**: TBD (run verification command)

---

## Notes

### Files Already Partially Migrated
- `concierge/conciergeCase.ts` - Has `ORPCError` direct usage, needs upgrade to type-safe

### Dependencies
- Phase 1 should be completed before other phases to ensure base procedures have proper error definitions
- Files can be migrated in parallel within each phase

### Rollback Plan
- Keep `ApiException` class available during migration
- Each file can be reverted independently if issues arise
- Monitor error rates in production after each batch deployment
