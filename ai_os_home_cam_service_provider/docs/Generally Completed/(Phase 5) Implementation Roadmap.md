# Phase 5 — Implementation Roadmap
## Platform UX Architecture

**Status:** Complete  
**Dependencies:** Phase 1–4 backend APIs complete  
**Scope:** Platform-level user experience, authentication flows, onboarding wizards, organization context management

---

## Overview

Phase 5 implements the **Platform UX Architecture** as defined in the Phase 5 Platform UX SRD. This is the foundational user experience layer that provides:

- User registration and authentication (Better Auth)
- Entry vector selection (intent-based onboarding)
- Organization creation with full onboarding wizards
- Role and authority establishment
- Organization context switching
- Persistent header navigation
- Cross-pillar UX consistency

---

## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend Framework | SvelteKit 5 with Runes |
| UI Framework | Skeleton UI + Flowbite Svelte |
| Form Handling | Superforms |
| Icons | Lucide Svelte |
| Styling | TailwindCSS |
| Authentication | Better Auth (self-hosted) |
| API | oRPC (existing backend) |
| Authorization | Cerbos |

---

## Design Decisions

1. **Entry Vector → Organization Type Mapping:**
   - "I own a property" → `INDIVIDUAL_PROPERTY_OWNER` or `TRUST_OR_LLC`
   - "I manage a community/HOA" → `COMMUNITY_ASSOCIATION` or `MANAGEMENT_COMPANY`
   - "I run a service/contracting business" → `SERVICE_PROVIDER`

2. **Invitations:** Deferred to future phase (build 3 entry vectors first)

3. **Onboarding Depth:** Full onboarding wizards with property/association/compliance setup

4. **Navigation:** Persistent top header across all pages (authenticated and unauthenticated)

---

## P5.1 Foundation — Layout & Design System ✅

### P5.1.1 Skeleton UI + Flowbite Setup

- [x] Configure Skeleton UI theme (dark/light mode support)
- [x] Set up TailwindCSS configuration with Skeleton + Flowbite
- [x] Create color palette and design tokens
- [x] Configure Flowbite Svelte components
- [x] Set up Lucide icons

### P5.1.2 Root Layout Structure

- [x] Create `+layout.svelte` with:
  - Theme provider (dark/light mode)
  - Toast/notification provider
  - Global styles
- [x] Create `+layout.server.ts` for session loading
- [x] Implement theme toggle persistence (localStorage)

### P5.1.3 Persistent Header Component

- [x] Create `Header.svelte` component with:
  - Hestami logo/branding (left)
  - Theme toggle (right)
  - Login/Register buttons (unauthenticated)
  - User menu dropdown (authenticated):
    - User name/email
    - Current organization & role badge
    - Organization switcher
    - Settings link
    - Sign out
- [x] Header appears on ALL pages (auth and non-auth)
- [x] Responsive design (mobile hamburger menu)

### P5.1.4 Base Page Components

- [x] Create `PageContainer.svelte` — consistent page wrapper with max-width
- [x] Create `Card.svelte` — styled card component
- [x] Create `FormCard.svelte` — card optimized for forms
- [x] Create `StepIndicator.svelte` — for multi-step wizards
- [x] Create `EmptyState.svelte` — for empty/unavailable states

### Deliverables
- [x] Design system configured
- [x] Root layout with theme support
- [x] Persistent header component
- [x] Base UI components ready

---

## P5.2 Authentication — Registration & Login ✅

### P5.2.1 Auth Store & Utilities

- [x] Create `$lib/stores/auth.ts` — Svelte store for session state
- [x] Create `$lib/utils/auth.ts` — helper functions for auth checks
- [x] Integrate with existing `auth-client.ts`
- [x] Create auth guard utility for protected routes

### P5.2.2 Registration Page (`/register`)

- [x] Create `/register/+page.svelte`
- [x] Form fields:
  - Name (required)
  - Email (required)
  - Password (required, min 8 chars)
  - Confirm password
- [x] Use Superforms for validation
- [x] Show password strength indicator
- [x] Link to login page
- [x] On success: redirect to Entry Vector Selection

### P5.2.3 Login Page (`/login`)

- [x] Create `/login/+page.svelte`
- [x] Form fields:
  - Email
  - Password
  - Remember me (optional)
- [x] Use Superforms for validation
- [x] "Forgot password" link (placeholder for future)
- [x] Link to registration page
- [x] On success:
  - If user has organizations → redirect to default org dashboard
  - If user has no organizations → redirect to Entry Vector Selection

### P5.2.4 Logout Flow

- [x] Implement sign-out action
- [x] Clear session and redirect to home/login
- [ ] Record activity event (LOGIN/LOGOUT) — deferred (auth handled by Better Auth)

### P5.2.5 Auth Route Protection

- [x] Create `+layout.server.ts` for `/app/*` routes (authenticated area)
- [x] Redirect unauthenticated users to `/login`
- [x] Redirect authenticated users without orgs to `/onboarding`

### Deliverables
- [x] Registration page functional
- [x] Login page functional
- [x] Session management working
- [x] Route protection in place

---

## P5.3 Entry Vector Selection ✅

### P5.3.1 Entry Vector Page (`/onboarding`)

- [x] Create `/onboarding/+page.svelte`
- [x] Display 3 entry options as large, clickable cards:
  1. **"I own a property"** — icon: Home
     - Subtitle: "Manage your property, find services, track maintenance"
  2. **"I manage a community or HOA"** — icon: Building2
     - Subtitle: "Governance, compliance, and community management"
  3. **"I run a service or contracting business"** — icon: Wrench
     - Subtitle: "Jobs, technicians, scheduling, and invoicing"
- [x] Each card links to respective onboarding wizard
- [x] Page is mandatory (no skip)
- [x] Show user's existing organizations (if any) with "Add another" option

### P5.3.2 Entry Vector State Management

- [x] Store selected entry vector in URL/session for wizard flow
- [x] Allow returning to entry vector selection from wizard

### Deliverables
- [x] Entry vector selection page complete
- [x] Clear visual distinction between options
- [x] Navigation to onboarding wizards

---

## P5.4 Property Owner Onboarding Wizard ✅

### P5.4.1 Wizard Structure (`/onboarding/property-owner`)

Multi-step wizard with progress indicator:

1. **Organization Type** — Individual or Trust/LLC
2. **Organization Details** — Name, contact info
3. **First Property** — Address, type, details
4. **HOA Linkage** — Optional HOA association or "No HOA"
5. **Preferences** — Concierge vs DIY preference
6. **Review & Create**

### P5.4.2 Step 1: Organization Type

- [x] Create `/onboarding/property-owner/+page.svelte` (redirects to step 1)
- [x] Create `/onboarding/property-owner/type/+page.svelte`
- [x] Two options:
  - **Individual** → `INDIVIDUAL_PROPERTY_OWNER`
  - **Trust, LLC, or Entity** → `TRUST_OR_LLC`
- [x] Store selection in wizard state

### P5.4.3 Step 2: Organization Details

- [x] Create `/onboarding/property-owner/details/+page.svelte`
- [x] Form fields:
  - Organization name (auto-filled with user name for Individual)
  - Slug (auto-generated, editable)
  - Contact email (pre-filled from user)
  - Contact phone (optional)
- [ ] Validate slug uniqueness (API call) — deferred

### P5.4.4 Step 3: First Property

- [x] Create `/onboarding/property-owner/property/+page.svelte`
- [x] Form fields:
  - Property name/label
  - Address (street, city, state, zip)
  - Property type (single family, condo, townhouse, etc.)
  - Year built (optional)
  - Square footage (optional)
- [ ] Address validation/autocomplete (future enhancement)

### P5.4.5 Step 4: HOA Linkage

- [x] Create `/onboarding/property-owner/hoa/+page.svelte`
- [x] Options:
  - **No HOA** — property is not in an HOA
  - **HOA exists but not on platform** — capture basic HOA info (name, contact)
  - **Search for HOA on platform** — (future: link to existing Association)
- [x] Store HOA context for ExternalHOAContext creation

### P5.4.6 Step 5: Preferences

- [x] Create `/onboarding/property-owner/preferences/+page.svelte`
- [x] Options:
  - **Concierge mode** — "Help me manage everything"
  - **DIY mode** — "I'll handle things myself"
- [x] Brief explanation of each mode
- [x] Store in organization settings

### P5.4.7 Step 6: Review & Create

- [x] Create `/onboarding/property-owner/review/+page.svelte`
- [x] Display summary of all entered information
- [x] "Create Organization" button
- [x] API calls:
  1. Create Organization (type: INDIVIDUAL_PROPERTY_OWNER or TRUST_OR_LLC)
  2. Create PropertyPortfolio — deferred to backend
  3. Create IndividualProperty — deferred to backend
  4. Create ExternalHOAContext (if applicable) — deferred to backend
  5. Set organization as user's default
- [x] Record activity events for organization creation
- [x] On success: redirect to Concierge dashboard

### P5.4.8 Wizard State Management

- [x] Create wizard state store (Svelte store or URL params)
- [x] Persist wizard state across steps
- [x] Allow back navigation without data loss
- [x] Clear state on completion or abandonment

### Deliverables
- [x] Complete 6-step property owner onboarding wizard
- [x] Organization creation API integration working
- [ ] Activity events recorded — deferred
- [x] Redirect to Concierge dashboard on completion

---

## P5.5 HOA/Community Onboarding Wizard ✅

### P5.5.1 Wizard Structure (`/onboarding/community`)

Multi-step wizard:

1. **Organization Type** — Association or Management Company
2. **Organization Details** — Name, address, contact
3. **Governance Structure** — Board size, fiscal year, meeting schedule
4. **Initial Data** — Unit count, document upload (optional)
5. **Your Role** — Admin, Manager, Board Member
6. **Review & Create**

### P5.5.2 Step 1: Organization Type

- [x] Create `/onboarding/community/type/+page.svelte`
- [x] Two options:
  - **Community Association / HOA** → `COMMUNITY_ASSOCIATION`
  - **Management Company** → `MANAGEMENT_COMPANY`
- [x] Different flows based on selection

### P5.5.3 Step 2: Organization Details

- [x] Create `/onboarding/community/details/+page.svelte`
- [x] Form fields:
  - Organization name
  - Slug (auto-generated)
  - Address (street, city, state, zip)
  - Contact email
  - Contact phone
  - Website (optional)
- [ ] Validate slug uniqueness — deferred

### P5.5.4 Step 3: Governance Structure

- [x] Create `/onboarding/community/governance/+page.svelte`
- [x] Form fields (for COMMUNITY_ASSOCIATION):
  - Number of board seats
  - Fiscal year start month
  - Annual meeting month
  - Governing document types present (CC&Rs, Bylaws, Rules)
- [ ] For MANAGEMENT_COMPANY:
  - Company size (employees)
  - Number of communities managed
  - Service regions

### P5.5.5 Step 4: Initial Data

- [x] Create `/onboarding/community/data/+page.svelte`
- [x] Form fields:
  - Total units/lots (number input)
  - Unit types (single family, condo, townhouse, mixed)
- [ ] Optional: Upload governing documents (defer actual upload to post-onboarding)
- [ ] Optional: Import unit list (CSV) — future enhancement

### P5.5.6 Step 5: Your Role

- [x] Create `/onboarding/community/role/+page.svelte`
- [x] Role selection:
  - **Administrator** → ADMIN role
  - **Community Manager** → MANAGER role
  - **Board Member** → BOARD_MEMBER role
- [x] Explanation of each role's permissions

### P5.5.7 Step 6: Review & Create

- [x] Create `/onboarding/community/review/+page.svelte`
- [x] Display summary
- [x] "Create Organization" button
- [x] API calls:
  1. Create Organization
  2. Create Association (for COMMUNITY_ASSOCIATION) — deferred to backend
  3. Set user role
  4. Set as default organization
- [x] Record activity events for organization creation
- [x] On success: redirect to CAM dashboard

### Deliverables
- [x] Complete 6-step community onboarding wizard
- [x] Support for both Association and Management Company types
- [x] Organization creation API integration working
- [x] Redirect to CAM dashboard on completion

---

## P5.6 Service Provider Onboarding Wizard ✅

### P5.6.1 Wizard Structure (`/onboarding/service-provider`)

Multi-step wizard:

1. **Business Details** — Company name, contact, service types
2. **Compliance Basics** — License info, insurance
3. **Service Area** — Geographic coverage
4. **Operational Setup** — Business hours, capacity
5. **Review & Create**

### P5.6.2 Step 1: Business Details

- [x] Create `/onboarding/service-provider/details/+page.svelte`
- [x] Form fields:
  - Business name
  - Slug (auto-generated)
  - Business type (sole proprietor, LLC, corporation)
  - Primary contact name
  - Contact email
  - Contact phone
  - Website (optional)
  - Service categories (multi-select: HVAC, Plumbing, Electrical, etc.)

### P5.6.3 Step 2: Compliance Basics

- [x] Create `/onboarding/service-provider/compliance/+page.svelte`
- [x] Form fields:
  - Business license number (optional at onboarding)
  - License state
  - General liability insurance (yes/no)
  - Workers comp insurance (yes/no)
- [x] Note: Full compliance documents uploaded post-onboarding
- [x] Display compliance requirements checklist

### P5.6.4 Step 3: Service Area

- [x] Create `/onboarding/service-provider/area/+page.svelte`
- [x] Form fields:
  - Primary service zip codes (multi-input)
  - Service radius (miles)
  - States served (multi-select)
- [ ] Map visualization (future enhancement)

### P5.6.5 Step 4: Operational Setup

- [x] Create `/onboarding/service-provider/operations/+page.svelte`
- [x] Form fields:
  - Business hours (start/end time, days of week)
  - Emergency services available (yes/no)
  - Team size (solo, 2-5, 6-20, 20+)
  - Scheduling preference (first available, customer choice)

### P5.6.6 Step 5: Review & Create

- [x] Create `/onboarding/service-provider/review/+page.svelte`
- [x] Display summary
- [x] "Create Organization" button
- [x] API calls:
  1. Create Organization (type: SERVICE_PROVIDER)
  2. Create ContractorProfile — deferred to backend
  3. Create initial ContractorBranch (headquarters) — deferred to backend
  4. Set user as ADMIN
  5. Set as default organization
- [x] Record activity events for organization creation
- [x] On success: redirect to Contractor Ops dashboard

### Deliverables
- [x] Complete 5-step service provider onboarding wizard
- [ ] ContractorProfile and Branch created — deferred to backend
- [x] Redirect to Contractor Ops dashboard on completion

---

## P5.7 Organization Context & Switching ✅

### P5.7.1 Organization Context Store

- [x] Create `$lib/stores/organization.ts`
- [x] Store current organization context:
  - Organization ID, name, slug, type
  - User's role in organization
  - isDefault flag
- [x] Load from API on app init
- [x] Persist selected org in session/cookie

### P5.7.2 Organization Switcher Component

- [x] Create `OrganizationSwitcher.svelte`
- [x] Dropdown showing:
  - Current organization (highlighted)
  - List of user's other organizations with role badges
  - "Add Organization" link → Entry Vector Selection
- [x] On switch:
  - Confirmation modal: "Switch to {org name}?" — simplified to direct switch
  - Call `organization.setDefault` API
  - Reset page context
  - Redirect to appropriate dashboard based on org type
  - Record activity event (context switch) — deferred

### P5.7.3 Context-Aware Navigation

- [x] Create `$lib/utils/navigation.ts` — implemented in `/app/+page.svelte`
- [x] Function to determine default dashboard by org type:
  - `INDIVIDUAL_PROPERTY_OWNER`, `TRUST_OR_LLC` → `/app/concierge`
  - `COMMUNITY_ASSOCIATION`, `MANAGEMENT_COMPANY` → `/app/cam`
  - `SERVICE_PROVIDER` → `/app/contractor`
- [x] Redirect logic after login/switch

### P5.7.4 Organization Header Badge

- [x] Display current org name and type in header
- [x] Color-coded badge by pillar:
  - Concierge: Purple
  - CAM: Blue
  - Contractor: Green
- [x] Role displayed as secondary text

### Deliverables
- [x] Organization context store working
- [x] Organization switcher in header
- [x] Context-aware navigation
- [x] Activity events for context switches

---

## P5.8 Dashboard Shells (Pillar Entry Points) ✅

### P5.8.1 Concierge Dashboard Shell (`/app/concierge`)

- [x] Create `/app/concierge/+layout.svelte` — Concierge-specific layout (uses shared app layout)
- [x] Create `/app/concierge/+page.svelte` — Dashboard home
- [ ] Sidebar navigation (future: populated with Concierge features)
- [x] Welcome message with user name
- [x] Quick stats placeholders (properties, active cases, etc.)
- [x] Empty state if no properties yet

### P5.8.2 CAM Dashboard Shell (`/app/cam`)

- [x] Create `/app/cam/+layout.svelte` — CAM-specific layout (uses shared app layout)
- [x] Create `/app/cam/+page.svelte` — Dashboard home
- [ ] Sidebar navigation (future: populated with CAM features)
- [x] Welcome message
- [x] Quick stats placeholders (units, violations, work orders, etc.)
- [x] Empty state if no association data

### P5.8.3 Contractor Dashboard Shell (`/app/contractor`)

- [x] Create `/app/contractor/+layout.svelte` — Contractor-specific layout (uses shared app layout)
- [x] Create `/app/contractor/+page.svelte` — Dashboard home
- [ ] Sidebar navigation (future: populated with Contractor features)
- [x] Welcome message
- [x] Quick stats placeholders (jobs, technicians, revenue, etc.)
- [x] Compliance status banner (if incomplete)

### P5.8.4 Pillar Layout Components

- [ ] Create `PillarLayout.svelte` — shared layout for all pillars — deferred (using shared app layout)
  - Header (from P5.1)
  - Sidebar (pillar-specific)
  - Main content area
  - Footer (optional)
- [ ] Create `Sidebar.svelte` — collapsible sidebar component — deferred
- [ ] Create `SidebarItem.svelte` — navigation item with icon — deferred

### Deliverables
- [x] Three dashboard shells created
- [ ] Pillar-specific layouts — deferred (using shared layout)
- [ ] Sidebar navigation structure — deferred
- [x] Empty states for new organizations

---

## P5.9 Role & Authority Display ✅

### P5.9.1 Role Badge Component

- [x] Create `RoleBadge.svelte`
- [x] Display role with appropriate styling:
  - ADMIN: Red badge
  - MANAGER: Orange badge
  - BOARD_MEMBER: Blue badge
  - OWNER: Green badge
  - TENANT: Gray badge
  - VENDOR: Purple badge
- [ ] Tooltip with role description — deferred

### P5.9.2 Authority Indicator

- [x] Show role in header user menu
- [x] Show role on dashboard welcome message
- [ ] Permission-based UI element visibility (via Cerbos) — deferred

### P5.9.3 Permission-Gated Components

- [x] Create `PermissionGate.svelte` — wrapper that hides children if no permission
- [ ] Integrate with Cerbos client-side checks (or server-side data) — deferred
- [ ] Use for:
  - Navigation items
  - Action buttons
  - Settings access

### Additional Components Created

- [x] Create `RoleIndicator.svelte` — displays role with icon and org type
- [x] Create `AuthorityCard.svelte` — displays user permissions summary
- [x] Create `OrganizationBadge.svelte` — displays organization type badge

### Deliverables
- [x] Role badges throughout UI
- [ ] Permission-based visibility — deferred (Cerbos integration)
- [x] Clear authority communication

---

## P5.10 Backend API Gaps ✅

### P5.10.1 Audit Existing APIs

- [x] Review `organization.ts` router — complete for basic CRUD
- [ ] Review property/portfolio APIs for Concierge onboarding — deferred
- [ ] Review association APIs for CAM onboarding — deferred
- [ ] Review contractor profile APIs for Service Provider onboarding — deferred

### P5.10.2 Potential New Endpoints

- [ ] `organization.checkSlugAvailability` — real-time slug validation — deferred
- [ ] `user.getOnboardingStatus` — check if user needs onboarding — deferred
- [ ] `user.completeOnboarding` — mark onboarding complete (optional) — deferred

### P5.10.3 Activity Event Integration

- [x] Organization creation emits activity events
- [x] Organization update emits activity events
- [x] Organization delete emits activity events
- [x] Context switching emits activity events
- [ ] Role assignment — deferred
- [ ] Property/Association/Profile creation — deferred

### P5.10.4 Organization Type Consolidation

- [x] Removed `INDIVIDUAL_CONCIERGE` from `OrganizationType` enum
- [x] Consolidated to `INDIVIDUAL_PROPERTY_OWNER` and `TRUST_OR_LLC` per Phase 3 Context Key
- [x] Updated organization API to support new types
- [x] Applied Prisma migration `20251217152506_remove_individual_concierge_org_type`

### Deliverables
- [x] API gaps identified
- [x] Organization types consolidated
- [x] Activity events for organization CRUD and context switching

---

## P5.11 Testing & Polish ✅

### P5.11.1 Flow Testing

- [ ] Test complete registration → onboarding → dashboard flow for each entry vector — manual testing required
- [ ] Test organization switching — manual testing required
- [ ] Test role-based visibility — manual testing required
- [ ] Test theme switching (dark/light) — manual testing required
- [ ] Test responsive design (mobile, tablet, desktop) — manual testing required

### P5.11.2 Error Handling

- [x] Form validation error display
- [x] API error handling with user-friendly messages
- [ ] Network error handling — basic implementation
- [ ] Session expiry handling — deferred

### P5.11.3 Loading States

- [x] Create `Skeleton.svelte` — skeleton loader component
- [x] Create `LoadingSpinner.svelte` — spinner component
- [x] Button loading states during form submission
- [ ] Page transition indicators — deferred

### P5.11.4 UI Polish Components

- [x] Create `Alert.svelte` — info/success/warning/error alerts
- [x] Create `LoadingSpinner.svelte` — loading indicator
- [x] Create `Skeleton.svelte` — content placeholder

### P5.11.5 Accessibility

- [ ] Keyboard navigation — basic support via native elements
- [ ] Screen reader compatibility — deferred
- [ ] Color contrast compliance — using Skeleton UI defaults
- [ ] Focus indicators — using Skeleton UI defaults

### Deliverables
- [ ] All flows tested end-to-end — manual testing required
- [x] Error handling components created
- [x] Loading states implemented
- [ ] Basic accessibility compliance — partial

---

## Implementation Order

1. **P5.1** Foundation — Layout & Design System
2. **P5.2** Authentication — Registration & Login
3. **P5.3** Entry Vector Selection
4. **P5.7** Organization Context & Switching (needed for dashboards)
5. **P5.8** Dashboard Shells (basic structure)
6. **P5.4** Property Owner Onboarding Wizard
7. **P5.5** HOA/Community Onboarding Wizard
8. **P5.6** Service Provider Onboarding Wizard
9. **P5.9** Role & Authority Display
10. **P5.10** Backend API Gaps
11. **P5.11** Testing & Polish

---

## Future Enhancements (Not in Phase 5)

- **Invitation System** — Email invitations to join organizations
- **Email Verification** — Better Auth email verification flow
- **Password Reset** — Forgot password flow
- **SSO/OAuth** — Google, Microsoft login
- **Address Autocomplete** — Google Places API integration
- **Document Upload** — During onboarding wizards
- **CSV Import** — Bulk unit/property import
- **Guided Tours** — First-time user walkthroughs
- **Notification System** — In-app notifications

---

## Non-Goals (Phase 5)

- Pillar-specific feature UIs (CAM violations, Contractor jobs, etc.)
- Real-time collaboration features
- Mobile native apps
- Advanced analytics dashboards
- AI-powered features

---

## Success Criteria

1. New user can register and complete onboarding for any of the 3 entry vectors
2. User lands on appropriate pillar dashboard after onboarding
3. User can switch between organizations seamlessly
4. Role and authority are always visible and clear
5. Theme switching works (dark/light)
6. Responsive design works on mobile
7. All actions produce audit trail via activity events
