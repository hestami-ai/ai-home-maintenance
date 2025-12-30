# Phase 20: Fix `z.any()` References — Implementation Roadmap

**Goal:** Replace all `z.any()` with typed Zod schemas in `hestami-ai-os/src`

**Versions:** Prisma 7.1.0, Zod 4.1.13

**Status:** ✅ COMPLETE — All z.any() removed, all type errors fixed, npm run check passes

**Last Updated:** 2025-12-27

---

## Prerequisites

- [x] Define `DecimalSchema` in `src/lib/server/api/schemas.ts`
- [x] Define `JsonSchema` (recursive) in `src/lib/server/api/schemas.ts`
- [x] Export both schemas for use in route files

---

## Phase 1: Core Schemas (`schemas.ts`) ✅ COMPLETE

### Decimal Fields
- [x] `ARCRequestSchema.estimatedCost`
- [x] `ViolationTypeSchema.firstFineAmount`
- [x] `ViolationTypeSchema.secondFineAmount`
- [x] `ViolationTypeSchema.subsequentFineAmount`
- [x] `ViolationTypeSchema.maxFineAmount`
- [x] `ViolationSchema.totalFinesAssessed`
- [x] `ViolationSchema.totalFinesPaid`
- [x] `ViolationSchema.totalFinesWaived`
- [x] `ViolationEvidenceSchema.gpsLatitude`
- [x] `ViolationEvidenceSchema.gpsLongitude`
- [x] `ViolationNoticeSchema.fineAmount`
- [x] `ViolationHearingSchema.fineAmount`
- [x] `ViolationHearingSchema.reducedFineAmount`
- [x] `ViolationFineSchema.amount`
- [x] `ViolationFineSchema.paidAmount`
- [x] `ViolationFineSchema.waivedAmount`
- [x] `DocumentSchema.latitude`
- [x] `DocumentSchema.longitude`
- [x] `WorkOrderSchema.estimatedCost`
- [x] `WorkOrderSchema.actualCost`

### JSON Fields
- [x] `DocumentSchema.metadata`

---

## Phase 2: Route Files ✅ COMPLETE

### Activity Events
- [x] `routes/activityEvent.ts` — `previousState`, `newState`, `metadata`

### Owner Portal
- [x] `routes/ownerPortal.ts` — `JsonRecord`, `attachments`

### Concierge
- [x] `routes/concierge/materialDecision.ts`

### Work Orders
- [x] `routes/workOrder/workOrder.ts`

### Dispatch
- [x] `routes/dispatch/dispatch.ts`

### Pricebook
- [x] `routes/pricebook/pricebook.ts`

### Governance
- [x] `routes/governance/board.ts`
- [x] `routes/governance/boardMotion.ts`
- [x] `routes/governance/meeting.ts`
- [x] `routes/governance/resolution.ts`

### Documents
- [x] `routes/document.ts`

### Compliance
- [x] `routes/compliance.ts`

### Field Tech
- [x] `routes/fieldTech/offlineSync.ts`

### Communication
- [x] `routes/communication/communication.ts`

### Billing
- [x] `routes/billing/payment.ts`

---

## Phase 3: Verification ✅ COMPLETE

- [x] Run `npm run openapi:generate && npm run types:generate`
- [x] Run `npm run check` — passed with 0 errors ✅
- [x] Review `types.generated.ts` for improved types
- [ ] Smoke test: start dev server, verify no runtime errors

### Resolved Type Mismatches

The stricter typing exposed 7 pre-existing frontend/backend type mismatches, all now fixed:

| File | Fix Applied |
|------|-------------|
| `compliance.ts:159` | Added type cast for `checklistTemplate` from `JsonValue` to expected array type |
| `cam/+page.svelte` | Changed `m.meetingType` → `m.type`, `m.scheduledDate` → `m.scheduledFor` |
| `governance/meetings/+page.svelte` | Same property name fixes as above |
| `governance/resolutions/+page.svelte` | Mapped API response to include `resolutionNumber` field |

---

## Notes

**DecimalSchema definition:**
```typescript
export const DecimalSchema = z.union([z.string(), z.number()]).transform(String);
```

**JsonSchema definition (Zod 4 compatible):**
```typescript
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export const JsonSchema = z.unknown().transform((val): JsonValue => {
  if (val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }
  if (Array.isArray(val)) {
    return val as JsonValue[];
  }
  if (typeof val === 'object') {
    return val as { [key: string]: JsonValue };
  }
  throw new Error('Invalid JSON value');
});
```

**Nullability:** Use `.nullish()` modifier on fields that are optional/nullable in the Prisma model.
