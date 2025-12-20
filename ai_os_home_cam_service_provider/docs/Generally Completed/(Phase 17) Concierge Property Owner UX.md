# **Phase 17 UX — Concierge / Property Owner Experience**

## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend Framework | SvelteKit 5 with Runes |
| UI Framework | Skeleton UI + Flowbite Svelte |
| Form Handling | Superforms |
| Icons | Lucide Svelte |
| Styling | TailwindCSS |
| Authentication | Better Auth (self-hosted) |
| API | oRPC (type-safe RPC) |
| Authorization | Cerbos |
| Observability | OpenTelemetry |

---

## **1. Purpose & Scope**

**Purpose**  
Provide individual property owners with a comprehensive, AI-assisted platform to manage their properties, submit service calls, store documents, and coordinate with service providers—all through a "concierge" experience that handles complexity on their behalf.

**Target Users**
- Individual property owners (personal ownership)
- Trust/LLC property owners (entity ownership)
- Property owners with or without HOA affiliations

**Key Value Proposition**
- **Concierge Mode**: "Set it and forget it" — Hestami AI handles vendor selection, scheduling, and coordination
- **DIY Mode**: Self-service tools for owners who prefer direct control

---

## **2. Terminology Clarification**

> **IMPORTANT**: Throughout this platform, we use **"Service Call"** (not "Service Request") to describe owner-initiated maintenance or service needs.

| Term | Definition |
|------|------------|
| **Service Call** | An owner-initiated request for maintenance, repair, or service at a property |
| **Concierge Case** | The durable workspace that tracks intent → decision → coordination → outcome |
| **Property Portfolio** | Collection of properties owned by an individual or entity |
| **Service Provider** | Contractor, vendor, or tradesperson who performs work |

**Rationale**: "Service Call" better reflects the industry-standard terminology and implies urgency and action, whereas "Service Request" sounds bureaucratic.

---

## **3. User Journey Overview**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROPERTY OWNER JOURNEY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ONBOARDING                                                               │
│     ├── Account Creation (Better Auth)                                       │
│     ├── Ownership Type Selection (Individual vs Trust/LLC)                   │
│     ├── Organization Details                                                 │
│     ├── First Property Registration                                          │
│     ├── HOA Association (none / external / platform)                         │
│     └── Management Preference (Concierge vs DIY)                             │
│                                                                              │
│  2. DASHBOARD (Post-Onboarding)                                              │
│     ├── Property Overview                                                    │
│     ├── Active Service Calls                                                 │
│     ├── Recent Activity                                                      │
│     └── Quick Actions                                                        │
│                                                                              │
│  3. PROPERTY MANAGEMENT                                                      │
│     ├── Add/Edit Properties                                                  │
│     ├── Property Details & Metadata                                          │
│     ├── Documents & Media                                                    │
│     └── Maintenance History                                                  │
│                                                                              │
│  4. SERVICE CALLS                                                            │
│     ├── Submit New Service Call                                              │
│     ├── Track Active Calls                                                   │
│     ├── Review Quotes & Approve Work                                         │
│     └── Rate & Review Providers                                              │
│                                                                              │
│  5. DOCUMENTS                                                                │
│     ├── Property Documents                                                   │
│     ├── Service Records                                                      │
│     ├── Warranties & Manuals                                                 │
│     └── HOA Documents (if applicable)                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## **4. Existing Implementation (As-Built)**

### **4.1 Onboarding Flow**

**Route**: `/onboarding/property-owner/*`

**Status**: ✅ Implemented

| Step | Route | Purpose | Status |
|------|-------|---------|--------|
| 0 | `/type` | Ownership type selection (Individual vs Trust/LLC) | ✅ |
| 1 | `/details` | Organization name, slug, contact info | ✅ |
| 2 | `/property` | First property address and details | ✅ |
| 3 | `/hoa` | HOA association (none / external / platform) | ✅ |
| 4 | `/preferences` | Management mode (Concierge vs DIY) | ✅ |
| 5 | `/review` | Review and submit | ✅ |

**Data Collected During Onboarding**:

```typescript
interface PropertyOwnerOnboardingState {
  organizationType: 'INDIVIDUAL_PROPERTY_OWNER' | 'TRUST_OR_LLC';
  organizationDetails: {
    name: string;
    slug: string;
    contactEmail: string;
    contactPhone: string;
  };
  property: {
    name: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    zipCode: string;
    propertyType: string;  // single_family, condo, townhouse, etc.
    yearBuilt: string;
    squareFootage: string;
  };
  hoa: {
    hasHoa: 'none' | 'external' | 'platform';
    hoaName: string;
    hoaContact: string;
  };
  preferences: {
    mode: 'concierge' | 'diy';
  };
}
```

**Current Behavior**:
- Creates Organization via oRPC (`organization.create`)
- Sets as default organization (`organization.setDefault`)
- Redirects to `/app/concierge` dashboard

**TODO (Not Yet Implemented)**:
- Create PropertyPortfolio record
- Create IndividualProperty record
- Create ExternalHOAContext if applicable

---

### **4.2 Concierge Dashboard**

**Route**: `/app/concierge`

**Status**: ✅ Implemented (Basic)

**Current Features**:
- Welcome header with user name
- Quick stats cards (Properties, Active Requests, Documents, Notifications) — all showing 0
- Recent Activity section (empty state)
- Quick Actions panel with links to:
  - Service Call (currently `/app/concierge/service-request` — **needs rename**)
  - Documents (`/app/concierge/documents`)
  - Properties (`/app/concierge/properties`)

---

### **4.3 Properties Page**

**Route**: `/app/concierge/properties`

**Status**: ✅ Implemented (Placeholder)

**Current Features**:
- Header with "Add Property" button
- Empty state when no properties exist

**TODO**:
- Property list view
- Property detail/edit view
- Property creation form
- Integration with PropertyPortfolio API

---

### **4.4 Service Call Page**

**Route**: `/app/concierge/service-request` → **Should be renamed to `/app/concierge/service-call`**

**Status**: ✅ Implemented (Placeholder)

**Current Features**:
- Category selection grid:
  - Plumbing
  - Electrical
  - HVAC
  - General Repairs
  - Pest Control
  - Landscaping
  - Security
  - Other
- "Coming Soon" notice

**TODO**:
- Service call submission form
- Property selection
- Photo/document upload
- Urgency/priority selection
- Integration with Concierge Case creation

---

### **4.5 Documents Page**

**Route**: `/app/concierge/documents`

**Status**: ✅ Implemented (Placeholder)

**Current Features**:
- Header with "Upload Document" button
- Search input
- Empty state when no documents exist

**TODO**:
- Document upload functionality
- Document categorization
- Property association
- Document viewer
- Integration with file storage

---

### **4.6 Concierge Cases**

**Route**: `/app/concierge/cases` and `/app/concierge/cases/[id]`

**Status**: ✅ Implemented (Full)

**Current Features**:
- Split-view list/detail layout
- Case list with status filtering
- Case detail with tabbed interface:
  - Overview
  - Intent
  - Decisions
  - Actions
  - Documents
  - Participants
  - History
- Concierge action panel
- Status management
- Note/clarification system

---

## **5. Required Implementation (Roadmap)**

### **Phase 14.1: Property Management**

**Priority**: High

#### **5.1.1 Property List View**

**Screen ID**: `CONCIERGE-PROP-01`

| Element | Description |
|---------|-------------|
| Property Cards | Grid of property cards showing address, type, and status |
| Add Property | Button to add new property |
| Search/Filter | Filter by type, status, HOA |
| Sort | By name, date added, address |

#### **5.1.2 Property Detail View**

**Screen ID**: `CONCIERGE-PROP-02`

**Tabs**:
1. **Overview** — Address, type, year built, square footage, HOA info
2. **Documents** — Property-specific documents (deed, insurance, warranties)
3. **Media** — Photos, videos, floor plans
4. **Service History** — Past service calls and maintenance
5. **Systems** — HVAC, plumbing, electrical details (make, model, age)

#### **5.1.3 Property Creation/Edit Form**

**Screen ID**: `CONCIERGE-PROP-03`

**Fields**:
- Property name (optional nickname)
- Address (with autocomplete)
- Property type
- Year built
- Square footage
- Bedrooms/bathrooms
- HOA association
- Notes

---

### **Phase 14.2: Service Call System**

**Priority**: High

> **Terminology Change**: Rename all "service-request" references to "service-call"

#### **5.2.1 Service Call Submission**

**Screen ID**: `CONCIERGE-CALL-01`

**Flow**:
1. Select property (if multiple)
2. Select category (plumbing, electrical, etc.)
3. Describe the issue (free text)
4. Upload photos/videos (optional but encouraged)
5. Select urgency:
   - **Routine** — Schedule at convenience
   - **Soon** — Within a few days
   - **Urgent** — Same day if possible
   - **Emergency** — Immediate (safety/damage risk)
6. Preferred scheduling (date/time preferences)
7. Review and submit

**Outcome**: Creates a Concierge Case with `INTAKE` status

#### **5.2.2 Service Call Tracking**

**Screen ID**: `CONCIERGE-CALL-02`

**Features**:
- List of active service calls
- Status badges (Submitted, Reviewing, Quoted, Scheduled, In Progress, Complete)
- Timeline of updates
- Communication thread with concierge
- Quote review and approval

#### **5.2.3 Quote Review & Approval**

**Screen ID**: `CONCIERGE-CALL-03`

**Features**:
- Quote details (scope, cost, timeline)
- Provider information
- Approve/Decline/Request Changes
- Payment authorization (if applicable)

---

### **Phase 14.3: Document Management**

**Priority**: Medium

#### **5.3.1 Document Upload**

**Screen ID**: `CONCIERGE-DOC-01`

**Features**:
- Drag-and-drop upload
- Category selection:
  - Property Documents (deed, title, survey)
  - Insurance
  - Warranties
  - Manuals
  - HOA Documents
  - Service Records
  - Other
- Property association
- Metadata (description, expiration date for warranties)

#### **5.3.2 Document Library**

**Screen ID**: `CONCIERGE-DOC-02`

**Features**:
- Grid/list view toggle
- Filter by category, property
- Search by name/content
- Document preview
- Download/share

---

### **Phase 14.4: Media Management**

**Priority**: Medium

#### **5.4.1 Property Media Gallery**

**Screen ID**: `CONCIERGE-MEDIA-01`

**Features**:
- Photo upload (multiple)
- Video upload
- Room/area tagging
- Before/after comparisons (for service calls)
- AI-assisted tagging (future)

---

### **Phase 14.5: Notifications & Communication**

**Priority**: Medium

#### **5.5.1 Notification Center**

**Screen ID**: `CONCIERGE-NOTIFY-01`

**Notification Types**:
- Service call status updates
- Quote received
- Appointment scheduled
- Work completed
- Document expiration reminders
- Maintenance reminders

#### **5.5.2 Communication Preferences**

**Screen ID**: `CONCIERGE-NOTIFY-02`

**Options**:
- Email notifications
- SMS notifications (future)
- Push notifications (mobile, future)
- Notification frequency

---

## **6. API Requirements**

### **6.1 Property APIs**

```typescript
// Property Portfolio
propertyPortfolio.create({ organizationId, name })
propertyPortfolio.list({ organizationId })
propertyPortfolio.get({ portfolioId })

// Individual Property
property.create({ portfolioId, address, type, metadata })
property.update({ propertyId, ...updates })
property.get({ propertyId })
property.list({ portfolioId })
property.delete({ propertyId })

// Property Systems (HVAC, etc.)
propertySystem.create({ propertyId, systemType, details })
propertySystem.update({ systemId, ...updates })
propertySystem.list({ propertyId })
```

### **6.2 Service Call APIs**

```typescript
// Service Calls (creates Concierge Case)
serviceCall.create({ propertyId, category, description, urgency, attachments })
serviceCall.list({ organizationId, status?, propertyId? })
serviceCall.get({ serviceCallId })

// Quotes
quote.list({ serviceCallId })
quote.approve({ quoteId })
quote.decline({ quoteId, reason })
quote.requestChanges({ quoteId, changes })
```

### **6.3 Document APIs**

```typescript
// Documents
document.upload({ propertyId?, category, file, metadata })
document.list({ organizationId, propertyId?, category? })
document.get({ documentId })
document.delete({ documentId })
document.download({ documentId })
```

---

## **7. Data Model Extensions**

### **7.1 PropertyPortfolio**

```prisma
model PropertyPortfolio {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  organization   Organization @relation(...)
  properties     IndividualProperty[]
}
```

### **7.2 IndividualProperty**

```prisma
model IndividualProperty {
  id              String   @id @default(cuid())
  portfolioId     String
  name            String?
  addressLine1    String
  addressLine2    String?
  city            String
  state           String
  zipCode         String
  propertyType    PropertyType
  yearBuilt       Int?
  squareFootage   Int?
  bedrooms        Int?
  bathrooms       Decimal?
  lotSize         Decimal?
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  portfolio       PropertyPortfolio @relation(...)
  hoaContext      ExternalHOAContext?
  systems         PropertySystem[]
  documents       PropertyDocument[]
  serviceCalls    ServiceCall[]
}
```

### **7.3 ServiceCall**

```prisma
model ServiceCall {
  id              String   @id @default(cuid())
  propertyId      String
  conciergeCaseId String?  @unique
  category        ServiceCategory
  description     String
  urgency         ServiceUrgency
  status          ServiceCallStatus
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  property        IndividualProperty @relation(...)
  conciergeCase   ConciergeCase? @relation(...)
  quotes          ServiceQuote[]
  attachments     ServiceCallAttachment[]
}

enum ServiceCategory {
  PLUMBING
  ELECTRICAL
  HVAC
  GENERAL_REPAIRS
  PEST_CONTROL
  LANDSCAPING
  SECURITY
  ROOFING
  APPLIANCES
  OTHER
}

enum ServiceUrgency {
  ROUTINE
  SOON
  URGENT
  EMERGENCY
}

enum ServiceCallStatus {
  SUBMITTED
  REVIEWING
  QUOTED
  APPROVED
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

---

## **8. UI/UX Patterns**

### **8.1 Consistent Navigation**

```
/app/concierge
├── /properties
│   ├── /new
│   └── /[id]
│       ├── /edit
│       ├── /documents
│       ├── /media
│       └── /history
├── /service-calls  (renamed from /service-request)
│   ├── /new
│   └── /[id]
├── /documents
│   └── /[id]
├── /cases
│   └── /[id]
└── /settings
```

### **8.2 Mobile-First Design**

All screens must be fully functional on mobile devices:
- Touch-friendly tap targets (min 44px)
- Responsive layouts
- Bottom navigation for key actions
- Pull-to-refresh where appropriate

### **8.3 Empty States**

Every list view must have a meaningful empty state with:
- Clear message explaining what would appear
- Call-to-action to create first item
- Helpful illustration or icon

### **8.4 Loading States**

- Skeleton loaders for content
- Spinner for actions
- Optimistic updates where safe

---

## **9. Implementation Priorities**

| Priority | Feature | Effort | Dependencies |
|----------|---------|--------|--------------|
| P0 | Rename service-request → service-call | Low | None |
| P0 | Property creation from onboarding | Medium | PropertyPortfolio API |
| P1 | Property list/detail views | Medium | Property API |
| P1 | Service call submission form | Medium | ServiceCall API |
| P1 | Service call tracking | Medium | Concierge Case integration |
| P2 | Document upload/management | Medium | File storage |
| P2 | Property media gallery | Medium | File storage |
| P3 | Quote review/approval | Medium | Provider integration |
| P3 | Notification system | High | Notification infrastructure |

---

## **10. Success Metrics**

| Metric | Target |
|--------|--------|
| Onboarding completion rate | > 80% |
| Time to first service call | < 5 minutes |
| Service call submission success | > 95% |
| Document upload success | > 95% |
| User satisfaction (NPS) | > 50 |

---

## **11. Future Enhancements**

### **11.1 AI-Assisted Features**
- Photo analysis for issue diagnosis
- Automatic categorization of service calls
- Predictive maintenance recommendations
- Document OCR and auto-tagging

### **11.2 Provider Marketplace**
- Browse vetted service providers
- Compare quotes
- Schedule directly
- Review and rate providers

### **11.3 Smart Home Integration**
- Connect smart devices
- Automated issue detection
- Energy monitoring
- Security alerts

---

## **12. Appendix: Route Renaming**

The following routes need to be renamed to use "service-call" terminology:

| Current Route | New Route |
|---------------|-----------|
| `/app/concierge/service-request` | `/app/concierge/service-calls` |
| `/app/concierge/service-request/new` | `/app/concierge/service-calls/new` |
| `/app/concierge/service-request/[id]` | `/app/concierge/service-calls/[id]` |

**Code Changes Required**:
1. Rename route directories
2. Update all `href` links in components
3. Update navigation components
4. Update any API endpoints if named similarly

---

*Document Version: 1.0*  
*Last Updated: December 19, 2024*  
*Author: Hestami AI Development Team*
