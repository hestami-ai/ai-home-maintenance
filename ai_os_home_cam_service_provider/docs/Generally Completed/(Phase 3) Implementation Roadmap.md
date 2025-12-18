# Hestami Platform — Phase 3 Implementation Roadmap (Concierge Property Owner Platform)

**Version:** 1.0 (Draft)  
**Status:** Draft  
**Scope:** Concierge Property Owner Platform — owner-centric orchestration for fragmented ecosystems.  
**Numbering:** P3.x (distinct from Phase 1 and Phase 2).  
**Goal:** Deliver a property owner concierge subsystem enabling intent-driven orchestration across external HOAs, vendors, and document-only governance contexts, with workflows delivered after domain models/APIs are in place.

---

## Overview
Phase 3 completes the three-pillar Hestami OS by adding an owner-centric orchestration layer that operates across fragmented real-world ecosystems. This phase is **human-operated initially** with AI assistance only, but architected for progressive automation toward AI-agent orchestration.

### In Scope
- Property & ownership modeling with delegation and authority
- Property portfolio management
- Owner intent & request intake
- Concierge case lifecycle management
- Property document management (CC&Rs, permits, approvals, correspondence)
- Human concierge execution and action tracking
- External HOA context tracking (non-platform HOAs)
- External vendor coordination (non-platform vendors)
- Decision, rationale & trust ledger

### Out of Scope (Phase 3)
- AI autonomous execution (AI-assisted only; human-in-the-loop required)
- Mobile app UI (backend surfaces only)
- Deep ML document parsing (basic extraction only)
- External payment integrations (stubbed)

### Foundational Requirements
- Prisma as source of truth; Zod validation; oRPC with forward-slash naming.
- Postgres RLS; explicit org scope; idempotency on all writes.
- DBOS for durable workflows; OpenTelemetry tracing with org/case/property context.
- Cerbos authorization before all operations.

### Key Design Decisions
| # | Decision |
|---|----------|
| 1 | Add `INDIVIDUAL_PROPERTY_OWNER` and `TRUST_OR_LLC` to `OrganizationType` enum; reuse existing `INDIVIDUAL_CONCIERGE` pattern. |
| 2 | Extend `IndividualProperty` model for Phase 3 property management; add portfolio grouping. |
| 3 | Add `PropertyOwnershipRole` enum for delegation (OWNER, CO_OWNER, TRUSTEE, DELEGATED_AGENT). |
| 4 | Create `PropertyDocument` model following `AssociationDocument` pattern for owner-scoped documents. |
| 5 | External HOAs modeled as lightweight `ExternalHOAContext` records (not full organizations). |
| 6 | Concierge staff are system admin users; no separate model needed. |
| 7 | Create Cerbos resource policies as each domain is implemented. |
| 8 | Migration naming: `add_phase3_<domain>` (e.g., `add_phase3_property_ownership`). |
| 9 | Leverage existing file upload patterns (Nginx secure_link, malware scan, content moderation). |
| 10 | **Unified Document Model**: Migrate `AssociationDocument` to a unified `Document` model with multi-context bindings; single `DocumentCategory` enum spanning all pillars. |

---

## P3.0 Priorities & Sequencing
1) Establish foundation models (P3.1–P3.2): Property ownership, portfolios.
2) Intent & case domain (P3.3–P3.4): Owner intent intake, case lifecycle.
3) Document management (P3.5): Property documents with upload handling.
4) Human concierge execution (P3.6): Action tracking and recording.
5) External context (P3.7–P3.8): External HOA and vendor coordination.
6) Decision ledger (P3.9): Transparent decision and rationale tracking.
7) Implement DBOS workflows (P3.10) once models/APIs are stable.
8) Observability, RLS, idempotency applied throughout (P3.11).
9) Cross-domain integration with Phase 1 & 2 (P3.12).

---

## P3.1 Property & Ownership Modeling (Foundation)
**Goal:** Model properties, ownership roles, and delegated authority for property owners.

- [x] Add `INDIVIDUAL_PROPERTY_OWNER` and `TRUST_OR_LLC` to `OrganizationType` enum.
- [x] Add `PropertyOwnershipRole` enum: `OWNER`, `CO_OWNER`, `TRUSTEE_MANAGER`, `DELEGATED_AGENT`.
- [x] Add `PropertyOwnership` model linking `IndividualProperty` to parties with roles and authority scopes.
- [x] Add `DelegatedAuthority` model for scoped permission grants (e.g., "can approve repairs up to $5000").
- [ ] Extend `IndividualProperty` with optional `externalHoaContextId` for HOA linkage. *(Deferred to P3.7)*
- [ ] Add `PropertyAddress` model for normalized address handling (or extend existing address fields). *(Using existing address fields)*
- [x] Run migration `add_phase3_property_ownership` and regenerate Prisma client.
- [x] Add APIs: property CRUD, ownership CRUD, delegation grant/revoke, authority scope queries.
- [x] Enforce validation: ownership must have at least one OWNER; delegation requires explicit grant; RLS by organization.
- [x] Add Cerbos policies for property, property_ownership, delegated_authority.

### Deliverables
- [x] Property ownership and delegation models
- [x] Authority scope enforcement in APIs
- [x] RLS/idempotent endpoints

---

## P3.2 Property Portfolio Management
**Goal:** Support owners with multiple properties through portfolio grouping and aggregated views.

- [x] Add `PropertyPortfolio` model (org-scoped, name, description, settings).
- [x] Add `PortfolioProperty` junction table linking portfolios to properties.
- [x] Add `PortfolioSummary` view/computed fields for aggregated metrics.
- [x] Run migration `add_phase3_portfolio` and regenerate Prisma client.
- [x] Add APIs: portfolio CRUD, add/remove properties, list portfolios, get portfolio summary.
- [x] Enforce validation: property can belong to multiple portfolios; portfolio scoped to owner org.
- [x] Add Cerbos policies for portfolio resources.

### Deliverables
- [x] Portfolio grouping models
- [x] Aggregated portfolio views
- [x] Cross-property reporting hooks

---

## P3.3 Owner Intent & Request Intake
**Goal:** Capture owner goals and requests in natural language, classify intent, and convert to durable cases.

- [x] Add `OwnerIntentCategory` enum: `MAINTENANCE`, `IMPROVEMENT`, `COMPLIANCE`, `DISPUTE`, `INQUIRY`, `EMERGENCY`, `OTHER`.
- [x] Add `OwnerIntentPriority` enum: `LOW`, `NORMAL`, `HIGH`, `URGENT`.
- [x] Add `OwnerIntentStatus` enum: `DRAFT`, `SUBMITTED`, `ACKNOWLEDGED`, `CONVERTED_TO_CASE`, `DECLINED`, `WITHDRAWN`.
- [x] Add `OwnerIntent` model: org-scoped, propertyId, category, priority, freeform description, constraints, attachments (JSON), status, submittedAt, acknowledgedAt, convertedCaseId.
- [x] Add `IntentNote` model for internal notes on intents.
- [x] Run migration `add_phase3_intent` and regenerate Prisma client.
- [x] Add APIs: intent submit, get/list, acknowledge, convert to case, decline, withdraw, add note.
- [x] Enforce validation: intent must reference valid property in owner org; status transitions validated.
- [x] Add Cerbos policies for owner_intent, intent_note.

### Deliverables
- [x] Intent intake models
- [x] Classification and priority handling
- [x] Conversion to case workflow hook

---

## P3.4 Concierge Case Lifecycle
**Goal:** Durable case container for concierge operations spanning intake, execution, and resolution.

- [x] Add `ConciergeCaseStatus` enum: `INTAKE`, `ASSESSMENT`, `IN_PROGRESS`, `PENDING_EXTERNAL`, `PENDING_OWNER`, `ON_HOLD`, `RESOLVED`, `CLOSED`, `CANCELLED`.
- [x] Add `ConciergeCase` model: org-scoped, caseNumber, propertyId, originIntentId (nullable), title, description, status, priority, assignedConciergeUserId (nullable), createdAt, resolvedAt, closedAt.
- [x] Add `CaseStatusHistory` model for status transition audit trail.
- [x] Add `CaseNote` model for internal case notes.
- [x] Add `CaseAttachment` model for case-related files.
- [x] Add `CaseParticipant` model for tracking involved parties (owner, co-owner, external contacts).
- [x] Run migration `add_phase3_case` and regenerate Prisma client.
- [x] Add APIs: case create (from intent or direct), get/list, update status, assign concierge, add note/attachment, add participant, resolve, close, cancel.
- [x] Enforce validation: state-machine transitions; assignment requires active user; resolution requires all actions complete.
- [x] Add Cerbos policies for concierge_case, case_status_history, case_note, case_attachment, case_participant.

### Deliverables
- [x] Case lifecycle models and state machine
- [x] Status history and audit trail
- [x] Case assignment and participant tracking

---

## P3.5 Unified Document Management (CDM Refactor)
**Goal:** Create a unified document model spanning all pillars (CAM, Contractor, Concierge) with multi-context bindings, replacing the pillar-specific `AssociationDocument` model.

### P3.5.1 Unified DocumentCategory Enum
Expand the existing `DocumentCategory` enum to cover all pillars:

```
enum DocumentCategory {
  // === CAM / HOA (existing) ===
  GOVERNING_DOCS      // CC&Rs, Bylaws, Rules
  FINANCIAL           // Budgets, audits, statements
  MEETING             // Minutes, agendas
  LEGAL               // Contracts, legal notices
  INSURANCE           // Policies, certificates
  MAINTENANCE         // Maintenance records, warranties
  ARCHITECTURAL       // ARC guidelines, approvals
  RESERVE_STUDY       // Reserve studies
  INSPECTION          // Inspection reports
  CONTRACT            // Vendor contracts
  
  // === Property Owner / Concierge (new) ===
  CC_AND_RS           // CC&Rs (owner-held copy)
  PERMIT              // Building permits, work permits
  APPROVAL            // HOA approvals, government approvals
  CORRESPONDENCE      // Letters, emails, notices
  TITLE_DEED          // Property title, deed
  SURVEY              // Property surveys, plats
  WARRANTY            // Product/service warranties
  
  // === Contractor / Service Provider (new) ===
  LICENSE             // Business/trade licenses
  CERTIFICATION       // Professional certifications
  BOND                // Bonding documents
  PROPOSAL            // Service proposals
  ESTIMATE            // Cost estimates
  INVOICE             // Invoices, receipts
  WORK_ORDER          // Work order documents
  JOB_PHOTO           // Before/after photos
  JOB_VIDEO           // Job videos
  VOICE_NOTE          // Voice memos, transcriptions
  SIGNATURE           // Digital signatures
  CHECKLIST           // Completed checklists
  
  // === Cross-Pillar ===
  GENERAL             // Other documents
}
```

### P3.5.2 Unified Document Model
Replace `AssociationDocument` with a unified `Document` model:

- [x] Create `Document` model with:
  - **Core fields**: id, organizationId (required for RLS), title, description, category, visibility, status
  - **File storage**: storageProvider, storagePath, fileUrl, fileName, fileSize, mimeType, checksum
  - **Extracted metadata**: pageCount, thumbnailUrl, extractedText, metadata (JSON)
  - **Versioning**: version, parentDocumentId, supersededById
  - **Effective dates**: effectiveDate, expirationDate
  - **Upload metadata**: uploadedBy, tags, archivedAt, archivedBy, archiveReason
  - **Processing status**: malwareScanStatus, contentModerationStatus, processingCompletedAt
  - **Media-specific** (for photos/videos/voice): latitude, longitude, capturedAt, transcription, isTranscribed
  - **Timestamps**: createdAt, updatedAt, deletedAt

### P3.5.3 Document Context Bindings (Multi-Context Support)
Allow documents to be bound to multiple contexts via junction tables:

- [x] Add `DocumentContextType` enum: `ASSOCIATION`, `PROPERTY`, `UNIT`, `JOB`, `CASE`, `WORK_ORDER`, `TECHNICIAN`, `CONTRACTOR`, `VENDOR`, `PARTY`, `OWNER_INTENT`.
- [x] Add `DocumentContextBinding` model:
  - documentId, contextType, contextId
  - isPrimary (boolean) — marks the primary context for the document
  - bindingNotes (optional)
  - createdAt, createdBy
- [x] A document can have multiple context bindings (e.g., a permit bound to both a property AND a concierge case).
- [x] At least one context binding is required for each document.

### P3.5.4 Access Control & Audit
- [x] Update `DocumentAccessGrant` to reference unified `Document` (rename from AssociationDocument FK).
- [x] Update `DocumentDownloadLog` to reference unified `Document`.
- [ ] Add `DocumentProcessingLog` for tracking malware scan, content moderation, and extraction steps.

### P3.5.5 Migration from AssociationDocument
- [x] Run migration `unified_document_model`:
  1. Create new `Document` table with all fields.
  2. Create `DocumentContextBinding` table.
  3. Replace `AssociationDocument` with `Document` (no production data to migrate).
  4. Update `DocumentAccessGrant` and `DocumentDownloadLog` FKs.
- [x] Regenerate Prisma client and Zod schemas.

### P3.5.6 Unified Document APIs
- [x] Add APIs: 
  - `document/v1/upload` — unified upload with context binding
  - `document/v1/get`, `document/v1/list` — with context filtering
  - `document/v1/updateMetadata`, `document/v1/archive`, `document/v1/supersede`
  - `document/v1/grantAccess`, `document/v1/revokeAccess`
  - `document/v1/download` — secure link generation
- [ ] Add `document/v1/bindContext`, `document/v1/unbindContext` — manage context bindings (future)
- [ ] Enforce validation: upload triggers malware scan and content moderation workflow; documents are assistive only (not enforced rules).
- [x] Add Cerbos policies for document, document_context_binding.

### P3.5.7 JobMedia Migration (Future)
- [ ] Plan migration of `JobMedia` to unified `Document` model with contextType=JOB (deferred to avoid Phase 2 disruption; can coexist initially).

### Deliverables
- [ ] Unified Document model with multi-context bindings
- [ ] Expanded DocumentCategory enum for all pillars
- [ ] Migration from AssociationDocument
- [ ] Upload pipeline integration (malware scan, content moderation)
- [ ] Secure download link generation
- [ ] Cross-context document sharing

---

## P3.6 Human Concierge Execution
**Goal:** Enable internal concierge staff to coordinate, track, and record actions and outcomes.

- [x] Add `ConciergeActionType` enum: `PHONE_CALL`, `EMAIL`, `DOCUMENT_REVIEW`, `RESEARCH`, `VENDOR_CONTACT`, `HOA_CONTACT`, `SCHEDULING`, `APPROVAL_REQUEST`, `FOLLOW_UP`, `ESCALATION`, `OTHER`.
- [x] Add `ConciergeActionStatus` enum: `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `BLOCKED`.
- [x] Add `ConciergeAction` model: caseId, actionType, status, description, plannedAt, startedAt, completedAt, performedByUserId, outcome, notes, relatedDocumentIds (JSON), relatedExternalContactIds (JSON).
- [x] Add `ConciergeActionLog` model for detailed action audit trail.
- [x] Run migration `add_concierge_action_models` and regenerate Prisma client.
- [x] Add APIs: action create, get/list by case, start, complete with outcome, block, resume, cancel, add log entry.
- [ ] Enforce validation: action must belong to active case; completion requires outcome; all actions logged with OpenTelemetry.
- [x] Add Cerbos policies for concierge_action.

### Deliverables
- [x] Concierge action tracking models
- [x] Action outcome recording
- [x] Full audit trail for all actions

---

## P3.7 External HOA Context Tracking
**Goal:** Track HOA-related constraints and approvals when HOAs are external (not platform participants).

- [x] Add `ExternalHOAContext` model: org-scoped, propertyId, hoaName, hoaContactName, hoaContactEmail, hoaContactPhone, hoaAddress, notes, documentsJson (references to PropertyDocument IDs), createdAt, updatedAt.
- [x] Add `ExternalApprovalStatus` enum: `NOT_REQUIRED`, `PENDING`, `SUBMITTED`, `APPROVED`, `DENIED`, `EXPIRED`.
- [x] Add `ExternalHOAApproval` model: externalHoaContextId, caseId (nullable), approvalType, status, submittedAt, responseAt, expiresAt, approvalReference, notes, relatedDocumentIds (JSON).
- [x] Add `ExternalHOARule` model for document-based rule references: externalHoaContextId, ruleCategory, ruleDescription, sourceDocumentId, notes.
- [x] Run migration `add_external_context_and_decisions` and regenerate Prisma client.
- [x] Add APIs: external HOA context CRUD, approval create/update/track, rule reference CRUD.
- [ ] Enforce validation: system does not assume completeness or correctness of HOA documents; approvals are informational.
- [x] Add Cerbos policies for external_hoa_context, external_hoa_approval, external_hoa_rule.

### Deliverables
- [x] External HOA context models
- [x] Manual approval tracking
- [x] Document-based rule references

---

## P3.8 External Vendor Coordination
**Goal:** Track service providers without onboarding requirements, with migration path to Phase 2.

- [x] Add `ExternalVendorContext` model: org-scoped, propertyId (nullable), vendorName, vendorContactName, vendorContactEmail, vendorContactPhone, vendorAddress, tradeCategories (JSON array), notes, createdAt, updatedAt.
- [x] Add `ExternalVendorInteraction` model: externalVendorContextId, caseId (nullable), interactionType (QUOTE, SCHEDULE, WORK, INVOICE, OTHER), interactionDate, description, amount (nullable), relatedDocumentIds (JSON), notes.
- [x] Add `linkedServiceProviderOrgId` field to `ExternalVendorContext` for migration to Phase 2 when vendor onboards.
- [x] Run migration `add_external_context_and_decisions` and regenerate Prisma client.
- [x] Add APIs: external vendor CRUD, interaction log CRUD, link to platform vendor.
- [ ] Enforce validation: external vendors are informational; linking to platform vendor enables Phase 2 integration.
- [x] Add Cerbos policies for external_vendor_context, external_vendor_interaction.

### Deliverables
- [x] External vendor tracking models
- [x] Quote/schedule/invoice tracking (manual)
- [x] Migration path to Phase 2 vendors

---

## P3.9 Decision, Rationale & Trust Ledger
**Goal:** Transparent recording of material decisions for auditability and future AI delegation.

- [x] Add `DecisionCategory` enum: `VENDOR_SELECTION`, `APPROVAL`, `COST_AUTHORIZATION`, `SCHEDULING`, `ESCALATION`, `RESOLUTION`, `OTHER`.
- [x] Add `MaterialDecision` model: org-scoped, caseId, category, title, description, rationale, decidedByUserId, decidedAt, optionsConsidered (JSON), estimatedImpact, actualOutcome, outcomeRecordedAt, relatedDocumentIds (JSON), relatedActionIds (JSON).
- [ ] Add `DecisionEvidence` model: decisionId, evidenceType, description, sourceDocumentId (nullable), sourceUrl (nullable), notes. (Future enhancement)
- [ ] Add `DecisionAuditLog` model for immutable decision history. (Future enhancement)
- [x] Run migration `add_external_context_and_decisions` and regenerate Prisma client.
- [x] Add APIs: decision record, get/list by case, record outcome, update (before outcome), delete.
- [ ] Enforce validation: decisions are immutable after outcome recorded; all decisions logged with OpenTelemetry.
- [x] Add Cerbos policies for material_decision.

### Deliverables
- [x] Decision and rationale models
- [x] Options considered tracking
- [x] Outcome recording for AI delegation readiness

---

## P3.10 DBOS Workflow Families
Build after domain models/APIs are stable; versions match API versions.

- [x] `case_lifecycle_v1` — case creation, status transitions, assignment, resolution, closeout; compatible with intent conversion.
- [x] `external_approval_tracking_v1` — submission tracking, response handling, expiration alerts.
- [x] `concierge_action_execution_v1` — action planning, execution tracking, outcome recording.
- [ ] `document_review_v1` — upload processing, malware scan, content moderation, metadata extraction. (Future enhancement)
- [x] `resolution_closeout_v1` — resolution validation, decision recording, case closure, owner notification.

### Deliverables
- [x] 4 of 5 workflows implemented and versioned (document_review deferred)
- [x] Idempotent + observable (traces/logs via DBOS)

---

## P3.11 Observability, Security, Idempotency
- [x] OpenTelemetry on all APIs/workflows with org_id, case_id, property_id, action_id where applicable (via DBOS built-in tracing).
- [x] RLS enforced for all owner data; explicit org scope required (all queries filter by `organizationId: context.organization.id`).
- [x] Idempotency keys required on all mutating endpoints; persisted (IdempotencyKeySchema used on all create/update endpoints).
- [x] Audit logs on case changes, actions, decisions (CaseStatusHistory, ConciergeActionLog, MaterialDecision with decidedAt/decidedBy).
- [x] Error envelope identical to Phase 1/2 (code/type/field_errors/trace_id via ApiException).

### Deliverables
- [x] OTEL spans/metrics with tenancy context (DBOS built-in)
- [x] Idempotency middleware coverage (all mutating endpoints)
- [x] Audit logging for key actions (status history, action logs)

---

## P3.12 Cross-Domain Integration with Phase 1 & 2
- [x] Owner properties → HOA units (optional linkage via `linkedUnitId` on IndividualProperty).
- [x] Concierge cases → Jobs (linkage via `linkedJobId` on ConciergeCase for Phase 2 contractor work).
- [x] External vendors → Phase 2 contractors (migration path via `linkedServiceProviderOrgId` on ExternalVendorContext).
- [x] Property documents → Association documents (unified Document model with DocumentContextBinding).
- [ ] Owner intents → Phase 1 owner requests (mapping for HOA-linked properties). (Future enhancement)
- [ ] Shared file upload pipeline (malware scan, content moderation) across all pillars. (Future enhancement)
- [x] API endpoints: linkToUnit, linkToJob, unlinkCrossDomain on conciergeCase router.

### Deliverables
- [x] Mappings for properties/cases to Phase 1/2 entities (schema fields added)
- [x] Shared document patterns (unified Document model)
- [x] Vendor migration hooks (linkedServiceProviderOrgId)

---

## P3.13 Deliverables Checklist
- [x] Property & ownership modeling (P3.1)
- [x] Portfolio management (P3.2)
- [x] Owner intent & request intake (P3.3)
- [x] Concierge case lifecycle (P3.4)
- [x] Property document management (P3.5)
- [x] Human concierge execution (P3.6)
- [x] External HOA context tracking (P3.7)
- [x] External vendor coordination (P3.8)
- [x] Decision & trust ledger (P3.9)
- [x] 4 of 5 DBOS workflows (P3.10) — document_review deferred
- [x] Observability/idempotency/RLS (P3.11)
- [x] Phase 1 & 2 integration hooks (P3.12)
- [ ] OpenAPI/SDK regeneration and workflow version mapping (future)

---

## P3.14 Non-Goals (Phase 3)
- AI autonomous execution (human-in-the-loop required).
- Mobile app UI.
- Deep ML document parsing/understanding.
- External payment integrations (keep stubs).
- Automated HOA rule enforcement (documents are assistive only).

---

## P3.15 Technology Stack (unchanged from Phase 1 & 2)
| Layer | Technology |
|-------|------------|
| Backend Framework | SvelteKit (Node) |
| API Framework | oRPC (forward-slash naming) |
| Schema Validation | Zod (generated from Prisma) |
| ORM | Prisma |
| Database | PostgreSQL + RLS |
| Session Storage | Redis |
| Workflow Engine | DBOS |
| Observability | OpenTelemetry |
| Reverse Proxy | Traefik |
| Auth | Better-Auth |
| File Storage | Local filesystem (Nginx secure_link) |

---

## P3.16 DBOS Workflow Summary
| Workflow | Priority |
|----------|----------|
| `case_lifecycle_v1` | First after models |
| `document_review_v1` | High |
| `concierge_action_execution_v1` | High |
| `external_approval_tracking_v1` | Medium |
| `resolution_closeout_v1` | Medium |

---

## P3.17 Case Status State Machine

```
                    ┌─────────────┐
                    │   INTAKE    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ ASSESSMENT  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
              ┌─────┤ IN_PROGRESS ├─────┐
              │     └──────┬──────┘     │
              │            │            │
    ┌─────────▼─────┐ ┌────▼────┐ ┌─────▼─────────┐
    │PENDING_EXTERNAL│ │ON_HOLD │ │ PENDING_OWNER │
    └─────────┬─────┘ └────┬────┘ └─────┬─────────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼──────┐
                    │  RESOLVED   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   CLOSED    │
                    └─────────────┘

    (CANCELLED can be reached from any state except CLOSED)
```

---

## Appendix A: Domain to Phase Mapping (Phase 3)
| Domain | Phase |
|--------|-------|
| Property & Ownership Modeling | P3.1 |
| Property Portfolio Management | P3.2 |
| Owner Intent & Request Intake | P3.3 |
| Concierge Case Lifecycle | P3.4 |
| Unified Document Management (CDM Refactor) | P3.5 |
| Human Concierge Execution | P3.6 |
| External HOA Context Tracking | P3.7 |
| External Vendor Coordination | P3.8 |
| Decision, Rationale & Trust Ledger | P3.9 |
| DBOS Workflow Families | P3.10 |
| Observability, Security, Idempotency | P3.11 |
| Cross-Domain Integration | P3.12 |

---

## Appendix B: API Namespace Structure (Phase 3)
```
/api/v1/rpc
├── property.*                    (P3.1)
├── property.ownership.*          (P3.1)
├── property.delegation.*         (P3.1)
├── portfolio.*                   (P3.2)
├── intent.*                      (P3.3)
├── case.*                        (P3.4)
├── case.participant.*            (P3.4)
├── document.*                    (P3.5)
├── concierge.action.*            (P3.6)
├── external.hoa.*                (P3.7)
├── external.hoa.approval.*       (P3.7)
├── external.vendor.*             (P3.8)
├── decision.*                    (P3.9)
```

---

## Appendix C: Workflow ↔ API Version Mapping
| Workflow | API Namespace | Expected Version |
|----------|---------------|------------------|
| `case_lifecycle_v1` | `case/v1/*` | v1 |
| `document_review_v1` | `document/v1/*` | v1 |
| `concierge_action_execution_v1` | `concierge.action/v1/*` | v1 |
| `external_approval_tracking_v1` | `external.hoa.approval/v1/*` | v1 |
| `resolution_closeout_v1` | `case/v1/*` | v1 |

---

## Appendix D: New Prisma Models Summary
| Model | Domain | Description |
|-------|--------|-------------|
| `PropertyOwnership` | P3.1 | Links property to party with role |
| `DelegatedAuthority` | P3.1 | Scoped permission grants |
| `PropertyPortfolio` | P3.2 | Portfolio grouping |
| `PortfolioProperty` | P3.2 | Portfolio-property junction |
| `OwnerIntent` | P3.3 | Owner request/goal intake |
| `IntentNote` | P3.3 | Notes on intents |
| `ConciergeCase` | P3.4 | Case container |
| `CaseStatusHistory` | P3.4 | Status audit trail |
| `CaseNote` | P3.4 | Case notes |
| `CaseAttachment` | P3.4 | Case files |
| `CaseParticipant` | P3.4 | Involved parties |
| `Document` | P3.5 | Unified document model (replaces AssociationDocument) |
| `DocumentContextBinding` | P3.5 | Multi-context document bindings |
| `DocumentProcessingLog` | P3.5 | Processing audit (malware, moderation) |
| `ConciergeAction` | P3.6 | Action tracking |
| `ConciergeActionLog` | P3.6 | Action audit |
| `ExternalHOAContext` | P3.7 | External HOA info |
| `ExternalHOAApproval` | P3.7 | HOA approval tracking |
| `ExternalHOARule` | P3.7 | Document-based rules |
| `ExternalVendorContext` | P3.8 | External vendor info |
| `ExternalVendorInteraction` | P3.8 | Vendor interactions |
| `Decision` | P3.9 | Material decisions |
| `DecisionEvidence` | P3.9 | Supporting evidence |
| `DecisionAuditLog` | P3.9 | Decision audit |

---

## Appendix E: New Enums Summary
| Enum | Domain | Values |
|------|--------|--------|
| `PropertyOwnershipRole` | P3.1 | OWNER, CO_OWNER, TRUSTEE_MANAGER, DELEGATED_AGENT |
| `DocumentContextType` | P3.5 | ASSOCIATION, PROPERTY, UNIT, JOB, CASE, WORK_ORDER, TECHNICIAN, CONTRACTOR, VENDOR, PARTY |
| `DocumentCategory` (expanded) | P3.5 | See P3.5.1 for full list spanning all pillars |
| `OwnerIntentCategory` | P3.3 | MAINTENANCE, IMPROVEMENT, COMPLIANCE, DISPUTE, INQUIRY, EMERGENCY, OTHER |
| `OwnerIntentPriority` | P3.3 | LOW, NORMAL, HIGH, URGENT |
| `OwnerIntentStatus` | P3.3 | DRAFT, SUBMITTED, ACKNOWLEDGED, CONVERTED_TO_CASE, DECLINED, WITHDRAWN |
| `ConciergeCaseStatus` | P3.4 | INTAKE, ASSESSMENT, IN_PROGRESS, PENDING_EXTERNAL, PENDING_OWNER, ON_HOLD, RESOLVED, CLOSED, CANCELLED |
| `ConciergeActionType` | P3.6 | PHONE_CALL, EMAIL, DOCUMENT_REVIEW, RESEARCH, VENDOR_CONTACT, HOA_CONTACT, SCHEDULING, APPROVAL_REQUEST, FOLLOW_UP, ESCALATION, OTHER |
| `ConciergeActionStatus` | P3.6 | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, BLOCKED |
| `ExternalApprovalStatus` | P3.7 | NOT_REQUIRED, PENDING, SUBMITTED, APPROVED, DENIED, EXPIRED |
| `DecisionCategory` | P3.9 | VENDOR_SELECTION, APPROVAL, COST_AUTHORIZATION, SCHEDULING, ESCALATION, RESOLUTION, OTHER |
