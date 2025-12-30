# Plan to fix `z.any()` issues in `hestami-ai-os/src`

This plan addresses the "never use `z.any()`" rule from the onboarding documentation. We will define specific, reusable Zod schemas for common types like `Decimal` and `Json` and replace all occurrences of `z.any()` in the source code.

## Proposed Changes

### [API Schemas]

#### [MODIFY] [schemas.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/server/api/schemas.ts)
- Define `DecimalSchema` to handle Prisma Decimal types (accepts string or number, coerces to string for consistent API output).
- Define recursive `JsonSchema` to handle complex JSON fields.
- Replace all `z.any()` occurrences in this file with the new schemas:
  - `ARCRequestSchema.estimatedCost` -> `DecimalSchema`
  - `ViolationTypeSchema.firstFineAmount/secondFineAmount/subsequentFineAmount/maxFineAmount` -> `DecimalSchema`
  - `ViolationSchema.totalFinesAssessed/totalFinesPaid/totalFinesWaived` -> `DecimalSchema`
  - `ViolationEvidenceSchema.gpsLatitude/gpsLongitude` -> `DecimalSchema`
  - `ViolationNoticeSchema.fineAmount` -> `DecimalSchema`
  - `ViolationHearingSchema.fineAmount/reducedFineAmount` -> `DecimalSchema`
  - `ViolationFineSchema.amount/paidAmount/waivedAmount` -> `DecimalSchema`
  - `DocumentSchema.metadata` -> `JsonSchema`
  - `DocumentSchema.latitude/longitude` -> `DecimalSchema`
  - `WorkOrderSchema.estimatedCost/actualCost` -> `DecimalSchema`

### [API Routes]

#### [MODIFY] [activityEvent.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/server/api/routes/activityEvent.ts)
- Replace `z.any()` in `activityEventOutput` (previousState, newState, metadata) with `JsonSchema` (imported from `../schemas.js`).

#### [MODIFY] [ownerPortal.ts](file:///e:/Projects/hestami-ai/ai_os_home_cam_service_provider/hestami-ai-os/src/lib/server/api/routes/ownerPortal.ts)
- Replace `z.any()` in `JsonRecord` and `attachments` with `JsonSchema`.

#### [MODIFY] Other identified files
- We will audit and replace `z.any()` in the remaining identified files:
  - `materialDecision.ts`
  - `workOrder.ts`
  - `dispatch.ts`
  - `pricebook.ts`
  - `board.ts`, `boardMotion.ts`, `meeting.ts`, `resolution.ts`
  - `document.ts`
  - `compliance.ts`
  - `offlineSync.ts`
  - `communication.ts`

## Verification Plan

### Automated Tests
- Run `npm run check` to ensure TypeScript types are correctly inferred from the new Zod schemas and that no type regressions were introduced.
- Run `npm run openapi:generate && npm run types:generate` to verify that the OpenAPI spec and frontend types are correctly updated.

### Manual Verification
- Review the generated `types.generated.ts` to confirm that fields previously typed as `any` now have more specific types (e.g., `string | number` for Decimals, or a proper JSON type).
