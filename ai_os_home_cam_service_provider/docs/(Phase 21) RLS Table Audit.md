# Phase 21: RLS Table Audit & Migration Plan

**Created**: 2024-12-28  
**Updated**: 2024-12-28  
**Status**: ✅ Migration Complete - Schema & RLS Policies Created

---

## Executive Summary

This audit categorizes all 191 Prisma models by their RLS readiness. The key finding is that **43 models have direct `organizationId`** and are RLS-ready, while **148 models inherit organization context through parent relationships**.

### Key Decision Required

For tables that inherit `organizationId` through parent relationships, we have two options:

| Approach | Pros | Cons |
|----------|------|------|
| **A: Denormalize** (add `organizationId`) | Simple RLS policies, better query performance, consistent pattern | Data redundancy, migration effort, potential inconsistency |
| **B: Indirect RLS** (JOIN-based policies) | Normalized data, no migration | Complex policies, performance overhead, harder debugging |

**Recommendation**: Use a **hybrid approach**:
- **Denormalize** for frequently-queried parent tables (Property, Unit, WorkOrder, etc.)
- **Keep indirect** for child/detail tables always accessed via parent (CaseNote, JobAttachment, etc.)

---

## Category 1: RLS-Ready (Direct organizationId) - 43 Models ✅

These tables have direct `organizationId` and can have simple RLS policies.

| Model | Notes |
|-------|-------|
| `Technician` | Contractor pillar |
| `UserOrganization` | User-org membership |
| `IdempotencyKey` | Request deduplication |
| `ActivityEvent` | Audit trail |
| `Association` | CAM pillar - HOA entity |
| `Party` | CRM - people/entities |
| `Document` | Document management |
| `ComplianceRequirement` | Compliance pillar |
| `ServiceProviderProfile` | Service provider info |
| `ContractorProfile` | Contractor info |
| `ContractorBranch` | Contractor locations |
| `Pricebook` | Pricing |
| `JobTemplate` | Job templates |
| `Customer` | Contractor customers |
| `Job` | Job lifecycle |
| `DispatchAssignment` | Dispatch |
| `ScheduleSlot` | Scheduling |
| `RoutePlan` | Route planning |
| `SLAWindow` | SLA definitions |
| `SLARecord` | SLA tracking |
| `JobChecklist` | Job checklists |
| `JobMedia` | Job photos/videos |
| `JobTimeEntry` | Time tracking |
| `JobSignature` | Signatures |
| `OfflineSyncQueue` | Offline sync |
| `Estimate` | Estimates |
| `Proposal` | Proposals |
| `JobInvoice` | Invoicing |
| `PaymentIntent` | Payment processing |
| `Supplier` | Suppliers |
| `InventoryItem` | Inventory |
| `InventoryLocation` | Inventory locations |
| `InventoryTransfer` | Inventory transfers |
| `MaterialUsage` | Material tracking |
| `PurchaseOrder` | Procurement |
| `ServiceContract` | Maintenance contracts |
| `PropertyPortfolio` | Concierge - portfolios |
| `OwnerIntent` | Concierge - intents |
| `ConciergeCase` | Concierge - cases |
| `ExternalHOAContext` | External HOA info |
| `ExternalVendorContext` | External vendor info |
| `MaterialDecision` | Material decisions |
| `VendorCandidate` | Vendor discovery |

---

## Category 2: Recommend Adding organizationId - 15 Models 🔶

These are **frequently-queried parent tables** that would benefit from direct `organizationId` for RLS performance.

### Priority 1: Core Entity Tables (High Query Volume)

| Model | Current Path | Recommendation |
|-------|--------------|----------------|
| `Property` | → Association → Org | **Add organizationId** - Core entity, frequently queried |
| `Unit` | → Property → Association → Org | **Add organizationId** - High query volume, 3 hops |
| `WorkOrder` | → Association → Org | **Add organizationId** - Core workflow entity |
| `ARCRequest` | → Association → Org | **Add organizationId** - Core workflow entity |
| `Violation` | → Association → Org | **Add organizationId** - Core workflow entity |

### Priority 2: Supporting Entity Tables (Medium Query Volume)

| Model | Current Path | Recommendation |
|-------|--------------|----------------|
| `Vendor` | → Association → Org | **Add organizationId** - Frequently queried |
| `Asset` | → Association → Org | **Add organizationId** - Frequently queried |
| `GLAccount` | → Association → Org | **Add organizationId** - Accounting queries |
| `BankAccount` | → Association → Org | **Add organizationId** - Accounting queries |
| `AssessmentType` | → Association → Org | **Add organizationId** - Billing queries |
| `ViolationType` | → Association → Org | **Add organizationId** - Violation queries |

### Priority 3: Governance Tables (Lower Priority)

| Model | Current Path | Recommendation |
|-------|--------------|----------------|
| `Board` | → Association → Org | **Add organizationId** - Governance queries |
| `Meeting` | → Association → Org | **Add organizationId** - Governance queries |
| `ARCCommittee` | → Association → Org | **Add organizationId** - ARC queries |
| `PolicyDocument` | → Association → Org | **Add organizationId** - Document queries |

---

## Category 3: Keep Indirect RLS (Child Tables) - 133 Models ✅

These tables are **always accessed via their parent** and don't need direct `organizationId`. RLS is enforced by the parent query.

### Technician Children (via Technician → Org)
- `TechnicianSkill`, `TechnicianCertification`, `TechnicianAvailability`
- `TechnicianTimeOff`, `TechnicianTerritory`, `TechnicianKPI`

### Case Children (via ConciergeCase → Org)
- `CaseAvailabilitySlot`, `CaseStatusHistory`, `CaseNote`, `CaseCommunication`
- `CaseReview`, `CaseAttachment`, `CaseMilestone`, `CaseIssue`
- `CaseParticipant`, `ConciergeAction`, `StaffCaseAssignment`

### Job Children (via Job → Org)
- `JobStatusHistory`, `JobNote`, `JobAttachment`, `JobCheckpoint`, `JobVisit`

### WorkOrder Children (via WorkOrder → Org after migration)
- `WorkOrderBid`, `WorkOrderStatusHistory`, `WorkOrderComment`
- `WorkOrderAttachment`, `WorkOrderLineItem`

### Violation Children (via Violation → Org after migration)
- `ViolationEvidence`, `ViolationNotice`, `ViolationHearing`
- `ViolationFine`, `ViolationStatusHistory`

### ARC Children (via ARCRequest → Org after migration)
- `ARCDocument`, `ARCReview`

### Document Children (via Document → Org)
- `DocumentContextBinding`, `DocumentAccessGrant`, `DocumentDownloadLog`

### Intent Children (via OwnerIntent → Org)
- `IntentNote`

### Contract Children (via ServiceContract → Org)
- `ContractServiceItem`, `ContractSchedule`, `ScheduledVisit`
- `ContractRenewal`, `ContractSLARecord`

### Party Children (via Party → Org)
- `UserProfile`, `ContactPreference`, `NotificationSetting`
- `StoredPaymentMethod`, `Ownership`, `Tenancy`

### Accounting Children (via parent → Association → Org)
- `JournalEntryLine`, `PaymentApplication`, `APInvoiceLine`

### Other Detail Tables
- `PricebookVersion`, `PricebookItem`, `JobTemplateItem`
- `EstimateLine`, `EstimateOption`, `InvoiceLine`
- `InventoryLevel`, `InventoryTransferLine`
- `PurchaseOrderLine`, `PurchaseOrderReceipt`, `PurchaseOrderReceiptLine`

---

## Category 4: System/Global Tables (No RLS Needed) - 8 Models

These tables are either global or user-scoped, not organization-scoped.

| Model | Reason |
|-------|--------|
| `Organization` | Root tenant entity |
| `User` | Global user identity |
| `Session` | Auth session (user-scoped) |
| `Account` | OAuth accounts (user-scoped) |
| `Verification` | Email verification tokens |
| `ServiceArea` | Global service areas |
| `NoticeSequenceConfig` | Global config |
| `NoticeSequenceStep` | Global config |

---

## Migration Plan

### Phase A: Schema Changes (Priority 1 Tables)

```sql
-- 1. Add organizationId to Property
ALTER TABLE properties ADD COLUMN organization_id TEXT;
UPDATE properties p SET organization_id = a.organization_id 
FROM associations a WHERE p.association_id = a.id;
ALTER TABLE properties ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX idx_properties_org ON properties(organization_id);

-- 2. Add organizationId to Unit
ALTER TABLE units ADD COLUMN organization_id TEXT;
UPDATE units u SET organization_id = p.organization_id 
FROM properties p WHERE u.property_id = p.id;
ALTER TABLE units ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX idx_units_org ON units(organization_id);

-- 3. Add organizationId to WorkOrder
ALTER TABLE work_orders ADD COLUMN organization_id TEXT;
UPDATE work_orders w SET organization_id = a.organization_id 
FROM associations a WHERE w.association_id = a.id;
ALTER TABLE work_orders ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX idx_work_orders_org ON work_orders(organization_id);

-- 4. Add organizationId to ARCRequest
ALTER TABLE arc_requests ADD COLUMN organization_id TEXT;
UPDATE arc_requests ar SET organization_id = a.organization_id 
FROM associations a WHERE ar.association_id = a.id;
ALTER TABLE arc_requests ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX idx_arc_requests_org ON arc_requests(organization_id);

-- 5. Add organizationId to Violation
ALTER TABLE violations ADD COLUMN organization_id TEXT;
UPDATE violations v SET organization_id = a.organization_id 
FROM associations a WHERE v.association_id = a.id;
ALTER TABLE violations ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX idx_violations_org ON violations(organization_id);
```

### Phase B: RLS Policies

After adding `organizationId`, create RLS policies:

```sql
-- Example for Property
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_tenant_isolation ON properties
  USING (organization_id = current_setting('app.current_org_id', true));

CREATE POLICY property_tenant_insert ON properties
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true));
```

### Phase C: Prisma Schema Updates

Update `prisma/schema.prisma` to add `organizationId` fields:

```prisma
model Property {
  id             String       @id @default(cuid())
  organizationId String       @map("organization_id")  // NEW
  associationId  String       @map("association_id")
  // ... rest of fields
  
  organization Organization @relation(fields: [organizationId], references: [id])
  // ... rest of relations
  
  @@index([organizationId])  // NEW
}
```

### Phase D: Application Code Updates

1. Update all `Property.create()` calls to include `organizationId`
2. Add trigger or application logic to keep `organizationId` in sync if `associationId` changes
3. Update any raw queries to include `organizationId`

---

## Estimated Effort

| Phase | Tables | Effort |
|-------|--------|--------|
| Phase A: Priority 1 (Property, Unit, WorkOrder, ARCRequest, Violation) | 5 | 4-6 hours |
| Phase B: Priority 2 (Vendor, Asset, GLAccount, etc.) | 6 | 3-4 hours |
| Phase C: Priority 3 (Board, Meeting, etc.) | 4 | 2-3 hours |
| **Total** | **15** | **~1-2 days** |

---

## Decision Matrix

| If you want... | Then... |
|----------------|---------|
| Maximum RLS performance | Denormalize all 15 tables |
| Minimal migration effort | Only denormalize Priority 1 (5 tables) |
| No schema changes | Use JOIN-based RLS policies (complex, slower) |

---

## Completed Steps

1. [x] **Decision**: Full migration approved for all 15 tables
2. [x] **Prisma schema updated** - Added `organizationId` to all 15 tables with relations and indexes
3. [x] **Prisma migration created** - `20251228064220_add_organization_id_for_rls`
4. [x] **RLS policies created** - All 15 tables have `_org_isolation` policies

## Remaining Steps

1. [x] **Apply migration** - Run `npx prisma migrate deploy` against database ✅ Applied successfully
2. [ ] **Update application code** to populate `organizationId` on create operations
3. [ ] **Add database triggers** to keep `organizationId` in sync (optional)
4. [ ] **Test** RLS enforcement with `hestami_app` user

## Migration Details

**Migration file**: `prisma/migrations/20251228064220_add_organization_id_for_rls/migration.sql`

The migration:
1. Adds `organization_id` columns as nullable
2. Backfills data from `association.organization_id`
3. Makes columns NOT NULL
4. Creates indexes on `organization_id`
5. Adds foreign key constraints
6. Enables RLS on all 15 tables
7. Creates `_org_isolation` policies using `current_setting('app.current_org_id', true)`
