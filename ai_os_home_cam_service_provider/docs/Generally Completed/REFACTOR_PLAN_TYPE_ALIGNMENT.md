# Type Alignment Refactor Plan

**Status:** ✅ Completed  
**Last Updated:** 2024-12-20

## Progress Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Schema Updates (PHOTO enum) | ✅ Completed |
| Phase 1 | Audit Current State | ✅ Completed |
| Phase 2 | Fix `documentCategories.ts` | ✅ Completed |
| Phase 3 | Fix Workflow Files | ✅ Completed (36 files) |
| Phase 4 | Fix Frontend Components | ✅ Completed |
| Phase 5 | Consolidate API Schemas | ✅ Completed (20+ enum schemas) |

---

## Problem Statement

The codebase has type definitions scattered across multiple locations that can drift from the Prisma schema (source of truth):

1. **`src/lib/utils/documentCategories.ts`** - Manually maintained category lists
2. **`src/lib/server/workflows/*.ts`** - Local type/interface definitions
3. **Frontend components** - Hardcoded enum values with `as any` casts
4. **`src/lib/server/api/schemas.ts`** - Manually defined Zod schemas that duplicate generated ones

## Correct Architecture (per Onboarding Doc Section 4)

```
Prisma Schema (source of truth)
    ↓
npx prisma generate
    ↓
generated/prisma/enums.ts (runtime values + types)
generated/zod/inputTypeSchemas/*.ts (Zod schemas)
    ↓
npm run openapi:generate
    ↓
OpenAPI spec
    ↓
npm run types:generate
    ↓
src/lib/api/types.generated.ts (frontend types)
```

---

## Phase 0: Schema Updates

**Status:** ✅ Completed

### Task: Add `PHOTO` enum value to DocumentCategory

The current `JOB_PHOTO` is contractor-specific. Need a general-purpose `PHOTO` category that contextually means:
- **Property context**: Property photo
- **Job context**: Job photo  
- **Case context**: Service call photo

### Checklist

- [x] Add `PHOTO` to `DocumentCategory` enum in `prisma/schema.prisma`
- [x] Run `npx prisma generate` to update generated files
- [x] Run `npm run openapi:generate` to update OpenAPI spec
- [x] Run `npm run types:generate` to update frontend types
- [x] Update `documentCategories.ts` to use `PHOTO` instead of `JOB_PHOTO` for Concierge
- [x] Verify with `npm run check`

---

## Phase 1: Audit Current State

**Status:** ✅ Completed

### Workflow Files Audit

| File | Has Local Types | Uses Generated | Needs Fix |
|------|-----------------|----------------|-----------|
| `communicationWorkflow.ts` | ✅ Refactored | ✅ Yes | ✅ Done |
| `checklistWorkflow.ts` | ✅ Refactored | ✅ Yes | ✅ Done |
| `documentWorkflow.ts` | ✅ Refactored | ✅ Yes | ✅ Done |
| `caseLifecycleWorkflow.ts` | ✅ Refactored | ✅ Yes | ✅ Done |
| `jobWorkflow.ts` | ✅ Refactored | ✅ Yes | ✅ Done |
| `violationWorkflow.ts` | ✅ Refactored | ✅ Yes | ✅ Done |
| `arcRequestWorkflow.ts` | ✅ Refactored | ✅ Yes | ✅ Done |
| All 36 workflow files | ✅ Refactored | ✅ Yes | ✅ Done |

### Utility Files Audit

| File | Has Manual Enums | Uses Generated | Needs Fix |
|------|------------------|----------------|-----------|
| `documentCategories.ts` | ✅ Fixed | ✅ Yes | ✅ Done |
| `workflows/schemas.ts` | ✅ Created | ✅ Yes | ✅ Done |

### API Route Files Audit

| File | Has Local Types | Uses Generated | Needs Fix |
|------|-----------------|----------------|-----------|
| `schemas.ts` | ✅ Refactored | ✅ Yes | ✅ Done |
| Route files | ✅ Use schemas.ts | ✅ Yes | ✅ Done |

### Frontend Components Audit

| File | Has Hardcoded Values | Uses Centralized | Needs Fix |
|------|---------------------|------------------|-----------|
| `cam/documents/upload/+page.svelte` | ✅ Uses centralized | ✅ Yes | ✅ Done |
| `concierge/documents/upload/+page.svelte` | ✅ Uses centralized | ✅ Yes | ✅ Done |

### Audit Checklist (per file)

- [x] Local type/interface definitions that should use generated types
- [x] Hardcoded enum values that should import from generated enums
- [x] `as any` casts hiding type mismatches
- [x] Manual Zod schemas duplicating generated ones

---

## Phase 2: Fix `documentCategories.ts`

**Status:** ✅ Completed

### Current Problem
```typescript
// Manual list that can drift from Prisma schema
export const CONCIERGE_DOCUMENT_CATEGORIES = [
  'TITLE_DEED', 'INSURANCE', ...
] as const satisfies readonly DocumentCategory[];
```

### Solution
```typescript
import { DocumentCategorySchema } from '../../../generated/zod/inputTypeSchemas/DocumentCategorySchema';
import { DocumentCategory } from '../../../generated/prisma/enums';

// Derive from generated schema - compile-time validated
const ALL_DOCUMENT_CATEGORIES = DocumentCategorySchema.options;

// Pillar-specific subsets - still type-safe
export const CONCIERGE_DOCUMENT_CATEGORIES = [
  DocumentCategory.TITLE_DEED,
  DocumentCategory.INSURANCE,
  // ... use enum values, not strings
] as const satisfies readonly DocumentCategory[];
```

### Benefits
- Compile-time error if enum value doesn't exist
- IDE autocomplete shows valid options
- Single source of truth (Prisma schema)

## Phase 3: Fix Workflow Files

**Status:** ✅ Completed

### Solution Implemented

**Created `src/lib/server/workflows/schemas.ts`** with:
- Base workflow result types (`EntityWorkflowResult`, `LifecycleWorkflowResult`, `BaseWorkflowResult`)
- Re-exported Prisma enums for workflow use
- Centralized type definitions

**Refactored all 36 workflow files** to:
- Convert action types from `export type XAction = 'A' | 'B'` to `export const XAction = { A: 'A', B: 'B' } as const` pattern
- Update result interfaces to extend shared base types
- Import Prisma enums from `workflows/schemas.ts`
- Remove duplicate export statements

### Pattern Applied

```typescript
// Action types as const objects (type-safe, runtime accessible)
export const CommunicationAction = {
  SEND_EMAIL: 'SEND_EMAIL',
  SEND_SMS: 'SEND_SMS',
  // ...
} as const;

export type CommunicationAction = (typeof CommunicationAction)[keyof typeof CommunicationAction];

// Result types extend shared base
export interface CommunicationWorkflowResult extends EntityWorkflowResult {
  // Additional workflow-specific fields
}
```

### Files Refactored (36 total)

- `documentWorkflow.ts`, `checklistWorkflow.ts`, `communicationWorkflow.ts`, `violationWorkflow.ts`
- `caseLifecycleWorkflow.ts`, `jobWorkflow.ts`, `arcRequestWorkflow.ts`, `estimateWorkflow.ts`
- `arcReviewWorkflow.ts`, `billingWorkflow.ts`, `appealWorkflow.ts`, `complianceWorkflow.ts`
- `conciergeActionWorkflow.ts`, `contractWorkflow.ts`, `dispatchWorkflow.ts`, `inventoryWorkflow.ts`
- `governanceWorkflow.ts`, `mediaWorkflow.ts`, `ownerPortalWorkflow.ts`, `pricebookWorkflow.ts`
- `purchaseOrderWorkflow.ts`, `noticeTemplateWorkflow.ts`, `contractSLAWorkflow.ts`
- `contractorBranchWorkflow.ts`, `contractorComplianceWorkflow.ts`, `contractorProfileWorkflow.ts`
- `customerWorkflow.ts`, `dashboardWorkflow.ts`, `estimateCreateWorkflow.ts`, `externalApprovalWorkflow.ts`
- `inventoryItemWorkflow.ts`, `inventoryLocationWorkflow.ts`, `invoiceCreateWorkflow.ts`
- `jobCreateWorkflow.ts`, `offlineSyncWorkflow.ts`, `workOrderConfigWorkflow.ts`
- `violationFineWorkflow.ts`, `usageWorkflow.ts`, `transferWorkflow.ts`, `timeEntryWorkflow.ts`
- `supplierWorkflow.ts`, `stockWorkflow.ts`, `signatureWorkflow.ts`, `serviceAreaWorkflow.ts`
- `reserveWorkflow.ts`, `reportScheduleWorkflow.ts`, `reportExecutionWorkflow.ts`, `reportDefinitionWorkflow.ts`

### Checklist

- [x] Create `src/lib/server/workflows/schemas.ts` for shared workflow schemas
- [x] Refactor all 36 workflow files to use shared schemas
- [x] Verify all workflows with `npm run check`
- [x] Build passes with `npm run build`

---

## Phase 4: Fix Frontend Components

**Status:** ✅ Completed

### Solution Implemented

All frontend components now use centralized utilities from `documentCategories.ts`:

```typescript
import {
  CAM_DOCUMENT_CATEGORIES,
  CAM_CATEGORY_LABELS,
  CAM_TO_PRIMARY_DOCUMENT_CATEGORY,
  type CamDocumentCategory
} from '$lib/utils/documentCategories';

const categoryOptions = CAM_DOCUMENT_CATEGORIES.map((cat) => ({
  value: cat,
  label: CAM_CATEGORY_LABELS[cat]
}));
```

### Checklist

- [x] Fix `concierge/documents/upload/+page.svelte` - uses centralized utilities
- [x] Fix `cam/documents/upload/+page.svelte` - already uses centralized utilities
- [x] All components use `documentCategories.ts` for category options
- [x] Verify with `npm run check`

---

## Phase 5: Consolidate API Schemas

**Status:** ✅ Completed

### Solution Implemented

`src/lib/server/api/schemas.ts` now imports all enum schemas from generated Zod schemas:

```typescript
// Import generated enum schemas from Prisma/Zod generation
import { ARCCategorySchema as GeneratedARCCategorySchema } from '../../../../generated/zod/inputTypeSchemas/ARCCategorySchema.js';
import { ViolationStatusSchema as GeneratedViolationStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ViolationStatusSchema.js';
// ... 20+ more imports

// Re-export for API use
export const ARCCategorySchema = GeneratedARCCategorySchema;
export const ViolationStatusSchema = GeneratedViolationStatusSchema;
// ...
```

### Enum Schemas Consolidated (20+)

**ARC Domain:**
- `ARCCategorySchema`, `ARCRequestStatusSchema`, `ARCReviewActionSchema`, `ARCDocumentTypeSchema`

**Violation Domain:**
- `ViolationStatusSchema`, `ViolationSeveritySchema`, `NoticeTypeSchema`, `NoticeDeliveryMethodSchema`, `HearingOutcomeSchema`, `AppealStatusSchema`

**Document Domain:**
- `DocumentCategorySchema`, `DocumentContextTypeSchema`, `DocumentVisibilitySchema`, `DocumentStatusSchema`, `StorageProviderSchema`

**WorkOrder Domain:**
- `WorkOrderStatusSchema`, `WorkOrderPrioritySchema`, `WorkOrderCategorySchema`, `WorkOrderOriginTypeSchema`, `BidStatusSchema`, `FundTypeSchema`

### Checklist

- [x] Replace `DocumentCategorySchema` with import from generated
- [x] Audit `src/lib/server/api/schemas.ts` for other duplicated enum schemas
- [x] Replace all 20+ manual enum schemas with imports from generated
- [x] Keep only API-specific composite schemas (DTOs not in Prisma)
- [x] Verify with `npm run check`
- [x] Build passes with `npm run build`

---

## Implementation Order

1. ✅ **Phase 2** - Fix `documentCategories.ts` (immediate upload bug fix)
2. ✅ **Phase 0** - Add `PHOTO` enum to schema (prerequisite for correct categories)
3. ✅ **Phase 5** - Consolidate `schemas.ts` (all 20+ enum schemas now use generated)
4. ✅ **Phase 4** - Fix frontend components (all upload pages use centralized utilities)
5. ✅ **Phase 3** - Fix workflow files (all 36 workflow files refactored)
6. ✅ **Phase 1** - Full audit completed

---

## Verification Steps

After each phase:
- [x] Run `npm run check` - TypeScript/Svelte type checking (0 errors)
- [x] Run `npm run build` - Full build (success)
- [x] Docker build and deploy successful

---

## Migration Notes

- Keep backward compatibility during migration
- Update imports incrementally
- Run type checks frequently to catch drift early

---

## Future Prevention

- [ ] Add ESLint rule to warn on `as any` casts
- [ ] Consider pre-commit hook running `npm run check`
- [x] Document the type flow in onboarding doc (Section 4)
- [ ] Add CI check that fails on type errors

---

## Architecture Summary (Final State)

```
Prisma Schema (source of truth)
    ↓
npx prisma generate
    ↓
generated/prisma/enums.ts (runtime values + types)
generated/zod/inputTypeSchemas/*.ts (Zod schemas)
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend                                                     │
│ ├── workflows/schemas.ts (re-exports Prisma enums + base)   │
│ ├── workflows/*.ts (use schemas.ts)                         │
│ └── api/schemas.ts (re-exports generated Zod schemas)       │
└─────────────────────────────────────────────────────────────┘
    ↓
npm run openapi:generate → OpenAPI spec
    ↓
npm run types:generate
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend                                                    │
│ ├── src/lib/api/types.generated.ts (generated types)        │
│ └── src/lib/utils/documentCategories.ts (pillar mappings)   │
└─────────────────────────────────────────────────────────────┘
```
